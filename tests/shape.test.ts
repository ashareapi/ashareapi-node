import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AShareAPI } from "../src/endpoints.js";
import { FREE_ENDPOINTS } from "../src/client.js";
import { VERSION } from "../src/version.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as Record<string, unknown>;

/** 102 个端点方法（对齐线上 /openapi.json；`/v1/wiki` 文档检索不进 SDK） */
const METHODS = [
  "abnormal",
  "agent_ask",
  "agent_research",
  "agentResearchStatus",
  "agent_search",
  "analyst",
  "auction",
  "backtest",
  "backtest_batch",
  "bigorder",
  "bigorder_flow",
  "bigorder_flow_full",
  "bigorder_history",
  "bigorder_queue",
  "bigorder_rank",
  "bigorder_split",
  "block_trade",
  "bond",
  "broken_board",
  "buyback",
  "calendar",
  "challenge",
  "changedist",
  "chatCompletions",
  "chip",
  "chip_batch",
  "consensus",
  "dehydrated",
  "disclosure",
  "dividend",
  "etf",
  "events",
  "evidence",
  "factors",
  "finance",
  "finance_batch",
  "flash",
  "forex",
  "fund",
  "fund_batch",
  "fund_flow",
  "fund_short",
  "fund_south",
  "futures",
  "health",
  "hot",
  "index_constituent",
  "index_list",
  "industry_chain",
  "ip_whitelist",
  "ipo",
  "kline",
  "kline_batch",
  "kline_full",
  "lhb",
  "lhb_agency",
  "lhb_seats",
  "limit_reason",
  "limit_up",
  "macro",
  "margin_trade",
  "market_kline",
  "market_mood",
  "market_overview",
  "messages",
  "minute",
  "models",
  "new_high",
  "news",
  "northbound",
  "notice",
  "orderbook",
  "playbooks",
  "profile",
  "profile_batch",
  "quote",
  "quote_batch",
  "rating",
  "report",
  "responses",
  "review",
  "scanner",
  "scannerSnapshots",
  "score",
  "screen",
  "search",
  "sector",
  "sector_valuation",
  "shareholder",
  "shareholder_batch",
  "snapshot",
  "snapshot_batch",
  "stocks",
  "strategies",
  "suspension",
  "tail_chase",
  "technical",
  "technical_batch",
  "trade_calendar",
  "usage",
  "watchlist",
  "watchlistQuotes",
];

const SNAKE_ALIASES: Array<[string, string]> = [
  ["market_overview", "marketOverview"],
  ["margin_trade", "marginTrade"],
  ["block_trade", "blockTrade"],
  ["sector_valuation", "sectorValuation"],
  ["industry_chain", "industryChain"],
  ["kline_full", "klineFull"],
  ["ip_whitelist", "ipWhitelist"],
  ["backtest_batch", "backtestBatch"],
  ["limit_up", "limitUp"],
  ["market_kline", "marketKline"],
  ["fund_batch", "fundBatch"],
];

describe("端点覆盖（形状）", () => {
  it("102 个方法都在原型上", () => {
    const missing = METHODS.filter((m) => typeof (AShareAPI.prototype as never)[m] !== "function");
    expect(missing, `缺方法：${missing.join(", ")}`).toEqual([]);
  });

  it("方法数正好 48（防漏也防多）", () => {
    expect(METHODS).toHaveLength(102);
  });

  it("免 Key 端点 = 10 个（8 数据 + 2 工具）", () => {
    expect([...FREE_ENDPOINTS].sort()).toEqual(
      [
        "/v1/challenge", "/v1/changedist", "/v1/health", "/v1/hot",
        "/v1/kline", "/v1/market-overview", "/v1/models", "/v1/quote",
        "/v1/trade-calendar", "/v1/wiki",
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

  it("11 个别名都是函数", () => {
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
