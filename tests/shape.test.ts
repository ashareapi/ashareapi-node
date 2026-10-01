import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AShareAPI } from "../src/endpoints.js";
import { FREE_ENDPOINTS } from "../src/client.js";
import { VERSION } from "../src/version.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as Record<string, unknown>;

/** 32 个端点方法（对齐线上 /openapi.json） */
const METHODS = [
  // 基础 / 工具
  "health", "usage", "challenge",
  // 行情
  "quote", "kline", "hot", "marketOverview", "changedist",
  // 财务 / 公司
  "finance", "profile", "dividend", "shareholder", "chip", "events",
  // 个股深度（盘口 / 全字段画像）
  "orderbook", "snapshot",
  // 资金 / 交易
  "fund", "lhb", "marginTrade", "blockTrade",
  // 指标 / 选股
  "technical", "screen",
  // 板块 / 产业链
  "sector", "sectorValuation", "industryChain",
  // 宏观 / 固收 / ETF / 新股
  "macro", "bond", "etf", "ipo",
  // 日历 / 研报 / 搜索
  "calendar", "dehydrated", "search",
];

const SNAKE_ALIASES: Array<[string, string]> = [
  ["market_overview", "marketOverview"],
  ["margin_trade", "marginTrade"],
  ["block_trade", "blockTrade"],
  ["sector_valuation", "sectorValuation"],
  ["industry_chain", "industryChain"],
];

describe("端点覆盖（形状）", () => {
  it("32 个方法都在原型上", () => {
    const missing = METHODS.filter((m) => typeof (AShareAPI.prototype as never)[m] !== "function");
    expect(missing, `缺方法：${missing.join(", ")}`).toEqual([]);
  });

  it("方法数正好 32（防漏也防多）", () => {
    expect(METHODS).toHaveLength(32);
  });

  it("免 Key 端点 = 7 个（5 数据 + 2 工具）", () => {
    expect([...FREE_ENDPOINTS].sort()).toEqual(
      [
        "/v1/challenge", "/v1/changedist", "/v1/health", "/v1/hot",
        "/v1/kline", "/v1/market-overview", "/v1/quote",
      ].sort(),
    );
  });
});

describe("snake_case 别名", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    // 每次调用新建 Response（Response body 只能读一次）
    fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true, endpoint: "/v1/x", data: [{ x: 1 }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("5 个别名都是函数", () => {
    for (const [snake] of SNAKE_ALIASES) {
      expect(typeof (AShareAPI.prototype as never)[snake], `${snake} 缺失`).toBe("function");
    }
  });

  it("别名与 camelCase 打到同一端点", async () => {
    const cli = new AShareAPI({ apiKey: "k" });
    await cli.market_overview("valuation");
    await cli.marketOverview("valuation");
    const [u1, u2] = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(u1).toBe(u2);
    expect(u1).toContain("/v1/market-overview");

    await cli.margin_trade("sh600667", "2026-09-18");
    await cli.marginTrade("sh600667", "2026-09-18");
    expect(fetchMock.mock.calls[2][0]).toBe(fetchMock.mock.calls[3][0]);
    expect(fetchMock.mock.calls[2][0]).toContain("/v1/margin-trade");

    await cli.block_trade("sh600667");
    expect(fetchMock.mock.calls[4][0]).toContain("/v1/block-trade");

    await cli.sector_valuation("pt01801780");
    expect(fetchMock.mock.calls[5][0]).toContain("/v1/sector-valuation");

    await cli.industry_chain("list");
    expect(fetchMock.mock.calls[6][0]).toContain("/v1/industry-chain");
  });
});

describe("版本与打包配置（防漂移）", () => {
  it("src/version.ts 与 package.json 版本一致", () => {
    expect(VERSION).toBe(pkg.version);
  });

  it("零运行时依赖", () => {
    expect(pkg.dependencies).toEqual({});
  });

  it("只发 dist + README（中英）+ CHANGELOG + LICENSE", () => {
    // CHANGELOG.md 必须进包（版本记录随包分发）；
    // README.en.md 也必须进（英文门面 —— package.json 的 files 是**显式白名单**，不加就不进包）
    expect(pkg.files).toEqual(["dist", "README.md", "README.en.md", "CHANGELOG.md", "LICENSE"]);
  });

  it("exports map 覆盖 import / require / types", () => {
    const exp = (pkg.exports as Record<string, Record<string, string>>)["."];
    expect(exp.import).toBe("./dist/index.mjs");
    expect(exp.require).toBe("./dist/index.cjs");
    expect(exp.types).toBe("./dist/index.d.ts");
  });

  it("engines 要求 node >= 18", () => {
    expect((pkg.engines as Record<string, string>).node).toBe(">=18");
  });
});
