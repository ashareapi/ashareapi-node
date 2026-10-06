import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AShareAPI } from "../src/endpoints.js";
import {
  APIError,
  AuthError,
  EmptyResultError,
  RateLimitError,
  UpstreamError,
} from "../src/errors.js";

/** 每次调用都产出**新的** Response —— Response body 只能读一次，复用会假报"不是 JSON" */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

let fetchMock: ReturnType<typeof vi.fn>;

/** 让 fetch 固定返回同一份 body（每次新建 Response） */
const respond = (body: unknown, status = 200) =>
  fetchMock.mockImplementation(async () => json(body, status));

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const ok = (data: unknown, extra: Record<string, unknown> = {}) => ({
  ok: true,
  endpoint: "/v1/x",
  data,
  ...extra,
});

describe("认证（与 Python SDK 一致）", () => {
  it("免费端点无 Key 可调用（不发 Authorization 头）", async () => {
    respond(ok([{ a: 1 }]));
    const cli = new AShareAPI({ apiKey: "" });
    const rows = await cli.request("/v1/quote", { code: "sh600667" });
    expect(rows.ok).toBe(true);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("付费端点无 Key → AuthError（且不发起请求）", async () => {
    const cli = new AShareAPI({ apiKey: "" });
    await expect(cli.request("/v1/finance", { code: "sh600667" })).rejects.toBeInstanceOf(AuthError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("有 Key → 带 Bearer 头", async () => {
    respond(ok([]));
    const cli = new AShareAPI({ apiKey: "ct-abc" });
    await cli.request("/v1/finance", { code: "sh600667" });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer ct-abc");
  });

  it("401 → AuthError", async () => {
    respond({ detail: "nope" }, 401);
    const cli = new AShareAPI({ apiKey: "bad" });
    await expect(cli.request("/v1/quote", { code: "sh600667" })).rejects.toBeInstanceOf(AuthError);
  });
});

describe("信封解析（structured / data / 非表格）", () => {
  it("data 是数组 → 直接返回", async () => {
    respond(ok([{ x: 1 }, { x: 2 }]));
    const cli = new AShareAPI({ apiKey: "" });
    const rows = await cli.get<Record<string, unknown>[]>("/v1/quote", { code: "sh600667" });
    expect(rows).toEqual([{ x: 1 }, { x: 2 }]);
  });

  it("data 是 Markdown 但带 structured → 用 structured（零解析）", async () => {
    respond(ok("| a | b |\n|---|---|\n| 1 | 2 |", { structured: [{ a: 1, b: 2 }] }));
    const cli = new AShareAPI({ apiKey: "k" });
    const rows = await cli.get<Record<string, unknown>[]>("/v1/sector");
    expect(rows).toEqual([{ a: 1, b: 2 }]);
  });

  it("非表格（data 非数组、无 structured）→ 返回 data", async () => {
    respond(ok({ quota: 100 }));
    const cli = new AShareAPI({ apiKey: "k" });
    const res = await cli.get<Record<string, unknown>>("/v1/usage");
    expect(res).toEqual({ quota: 100 });
  });

  it("raw: true → 返回整个信封", async () => {
    respond(ok([{ x: 1 }], { elapsed_ms: 862, source: "s1" }));
    const cli = new AShareAPI({ apiKey: "", raw: true });
    const env = await cli.get<Record<string, unknown>>("/v1/quote", { code: "sh600667" });
    expect(env.elapsed_ms).toBe(862);
    expect(env.source).toBe("s1");
    expect(env.data).toEqual([{ x: 1 }]);
  });
});

describe("ok:false 的两类区分（无数据 ≠ 取数失败）", () => {
  it("空数组 → EmptyResultError", async () => {
    respond({ ok: false, endpoint: "/v1/block-trade", data: [] });
    const cli = new AShareAPI({ apiKey: "k" });
    await expect(cli.request("/v1/block-trade", {})).rejects.toBeInstanceOf(EmptyResultError);
  });

  it("空对象 → EmptyResultError", async () => {
    respond({ ok: false, endpoint: "/v1/x", data: {} });
    const cli = new AShareAPI({ apiKey: "k" });
    await expect(cli.request("/v1/x", {})).rejects.toBeInstanceOf(EmptyResultError);
  });

  it("有内容 → UpstreamError（且信息里带原文）", async () => {
    respond({ ok: false, endpoint: "/v1/x", data: "上游取数失败：两融尚未披露" });
    const cli = new AShareAPI({ apiKey: "k" });
    await expect(cli.request("/v1/x", {})).rejects.toThrow(/两融尚未披露/);
    await expect(cli.request("/v1/x", {})).rejects.toBeInstanceOf(UpstreamError);
  });

  it("health / challenge 无 ok 字段 → 不误判为失败", async () => {
    respond({ status: "ok", data_ready: true });
    const cli = new AShareAPI({ apiKey: "" });
    const res = (await cli.request("/v1/health", {})) as unknown as Record<string, unknown>;
    expect(res.status).toBe("ok");
  });
});

describe("重试与退避", () => {
  it("429 → 重试 retries 次后抛 RateLimitError", async () => {
    vi.useFakeTimers();
    respond({ detail: "slow down" }, 429);
    const cli = new AShareAPI({ apiKey: "", retries: 3 });
    const p = cli.request("/v1/quote", { code: "sh600667" });
    const assertion = expect(p).rejects.toBeInstanceOf(RateLimitError);
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("5xx → 重试后抛 APIError", async () => {
    vi.useFakeTimers();
    respond({}, 502);
    const cli = new AShareAPI({ apiKey: "", retries: 2 });
    const p = cli.request("/v1/quote", { code: "sh600667" });
    const assertion = expect(p).rejects.toBeInstanceOf(APIError);
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("网络错误（fetch reject）→ 重试后抛 APIError", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    const cli = new AShareAPI({ apiKey: "", retries: 2 });
    const p = cli.request("/v1/quote", { code: "sh600667" });
    const assertion = expect(p).rejects.toThrow(/网络错误/);
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ok:false **不重试**", async () => {
    respond({ ok: false, endpoint: "/v1/x", data: "失败了" });
    const cli = new AShareAPI({ apiKey: "k", retries: 3 });
    await expect(cli.request("/v1/x", {})).rejects.toBeInstanceOf(UpstreamError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("重试成功后正常返回", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockImplementationOnce(async () => json({}, 503))
      .mockImplementationOnce(async () => json(ok([{ x: 1 }])));
    const cli = new AShareAPI({ apiKey: "", retries: 3 });
    const p = cli.request("/v1/quote", { code: "sh600667" });
    await vi.advanceTimersByTimeAsync(60_000);
    const res = await p;
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("请求构造", () => {
  it("参数过滤：跳过 undefined / null / 空串，保留 0 与 false", async () => {
    respond(ok([]));
    const cli = new AShareAPI({ apiKey: "k" });
    await cli.request("/v1/screen", {
      expr: "",
      preset: "low_pe",
      limit: 0,
      desc: false,
      orderby: undefined,
      market: null,
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("preset=low_pe");
    expect(url).toContain("limit=0");
    expect(url).toContain("desc=false");
    expect(url).not.toContain("expr=");
    expect(url).not.toContain("orderby=");
    expect(url).not.toContain("market=");
  });

  it("baseUrl 尾斜杠被去掉 · User-Agent 带版本", async () => {
    respond(ok([]));
    const cli = new AShareAPI({ apiKey: "", baseUrl: "https://example.com///" });
    await cli.request("/v1/quote", {});
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/v1/quote");
    expect(init.headers["User-Agent"]).toMatch(/^ashareapi-node\/\d+\.\d+\.\d+$/);
  });

  it("非 JSON 响应 → APIError", async () => {
    fetchMock.mockImplementation(async () => new Response("<html>oops</html>", { status: 200 }));
    const cli = new AShareAPI({ apiKey: "" });
    await expect(cli.request("/v1/quote", {})).rejects.toBeInstanceOf(APIError);
  });

  it("env ASHARE_API_KEY 作为后备（构造参数优先）", async () => {
    respond(ok([]));
    vi.stubEnv("ASHARE_API_KEY", "ct-from-env");
    const cli = new AShareAPI();
    await cli.request("/v1/finance", {});
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer ct-from-env");

    const cli2 = new AShareAPI({ apiKey: "ct-explicit" });
    await cli2.request("/v1/finance", {});
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer ct-explicit");
  });
});
