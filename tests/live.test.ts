/**
 * 真实调用测试（需网络；付费端点需 `ASHARE_API_KEY`）
 *
 * 运行：npm run test:live
 * 默认 `npm test` **不跑**本文件。
 */
import { describe, expect, it } from "vitest";
import { AShareAPI } from "../src/endpoints.js";
import { AuthError } from "../src/errors.js";

const KEY = process.env.ASHARE_API_KEY ?? "";
const cli = new AShareAPI(); // 免费端点

describe("免费端点（无需 Key）", () => {
  it("quote 返回行情行（含 last）", async () => {
    const rows = await cli.quote("sh600667");
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("last");
  });

  it("kline 返回 OHLCV", async () => {
    const rows = await cli.kline("sh600667", "day", 5);
    expect(rows.length).toBeGreaterThan(0);
    for (const c of ["date", "open", "high", "low", "last"]) {
      expect(rows[0]).toHaveProperty(c);
    }
  });

  it("hot 尊重 limit", async () => {
    const rows = await cli.hot(3);
    expect(rows.length).toBeLessThanOrEqual(3);
  });

  it("marketOverview('valuation') 有数据", async () => {
    const rows = await cli.marketOverview("valuation");
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("changedist 有数据", async () => {
    const rows = await cli.changedist();
    expect(rows.length).toBeGreaterThan(0);
  });

  it("代码格式兼容：600667.SH 与 sh600667 等价", async () => {
    const a = await cli.quote("600667.SH");
    const b = await cli.quote("sh600667");
    expect(a[0].last).toBe(b[0].last);
  });

  it("health 可用", async () => {
    const h = await cli.health();
    expect(h).toBeTruthy();
  });

  it("付费端点无 Key → AuthError", async () => {
    const noKey = new AShareAPI({ apiKey: "" });
    await expect(noKey.finance("sh600667")).rejects.toBeInstanceOf(AuthError);
  });
});

describe.runIf(KEY)("付费端点（需 ASHARE_API_KEY）", () => {
  const paid = new AShareAPI({ apiKey: KEY });

  it("screen 预设生效（limit 被尊重）", async () => {
    const rows = await paid.screen("", "low_pe", 5);
    expect(rows.length).toBeLessThanOrEqual(5);
  });

  it("fund 有数据", async () => {
    const rows = await paid.fund("sh600667");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("usage 返回额度信息", async () => {
    const u = await paid.usage();
    expect(u).toBeTruthy();
  });
});
