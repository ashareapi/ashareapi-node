/**
 * 核心客户端 —— 认证 / 请求 / 重试 / 信封解析
 *
 * 与 Python SDK 的 client.py **行为一致**（同一后端、同一套规则）：
 *   · 认证：`Authorization: Bearer` + `ASHARE_API_KEY` + 构造参数
 *   · 免费端点（7 个）无需 Key
 *   · 429 / 5xx / 网络错误 → 指数退避 3 次（0.5s / 1.5s / 4s）
 *   · `ok:false` **不重试**（服务端已自动处理，不扣调用次数）
 *   · 空结果 → EmptyResultError（"当前无数据" ≠ "取数失败"）
 *
 * 差异（语言惯例）：JS 版**全部返回 Promise**。
 */

import { normalizeCode } from "./code.js";
import { APIError, AuthError, EmptyResultError, RateLimitError, UpstreamError } from "./errors.js";
import type { AShareAPIOptions, Envelope, Row } from "./types.js";
import { VERSION } from "./version.js";

export const DEFAULT_BASE = "https://api.ashareapi.com";

/** 免 Key 端点：5 个数据端点 + 2 个工具端点 */
export const FREE_ENDPOINTS: readonly string[] = [
  "/v1/quote",
  "/v1/kline",
  "/v1/hot",
  "/v1/market-overview",
  "/v1/changedist",
  "/v1/health",
  "/v1/challenge",
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 内部：把参数对象变成 query string（跳过 undefined / null / 空串；`0` 与 `false` 保留） */
function toQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  return qs.toString();
}

export class AShareAPIBase {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeout: number;
  readonly retries: number;
  readonly raw: boolean;

  /**
   * @example
   * ```ts
   * const cli = new AShareAPI();                     // 免费端点无需 Key
   * const bars = await cli.quote("sh600667");
   *
   * const cli2 = new AShareAPI({ apiKey: "ct-..." }); // 或设 ASHARE_API_KEY
   * ```
   */
  constructor(opts: AShareAPIOptions = {}) {
    this.apiKey = (opts.apiKey ?? process.env.ASHARE_API_KEY ?? "").trim();
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
    this.timeout = opts.timeout ?? 30_000;
    this.retries = Math.max(1, Math.trunc(opts.retries ?? 3));
    this.raw = opts.raw ?? false;
  }

  /** 内部：统一请求（认证 / 超时 / 重试 / 信封校验）→ 原始信封 */
  async request(path: string, params: Record<string, unknown> = {}): Promise<Envelope> {
    const q = toQuery(params);
    const url = `${this.baseUrl}${path}${q ? "?" + q : ""}`;

    const headers: Record<string, string> = { "User-Agent": `ashareapi-node/${VERSION}` };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    } else if (!FREE_ENDPOINTS.includes(path)) {
      throw new AuthError(
        `端点 ${path} 需要 API Key（免 Key 端点：${FREE_ENDPOINTS.join(" / ")}）。` +
          `获取：https://ashareapi.com/pricing`,
      );
    }

    let lastErr: Error | undefined;

    for (let i = 0; i < this.retries; i++) {
      let res: Response;
      try {
        res = await fetch(url, { headers, signal: AbortSignal.timeout(this.timeout) });
      } catch (e) {
        lastErr = new APIError(`网络错误：${String(e)}`);
        await sleep(500 * 3 ** i);
        continue;
      }

      if (res.status === 401) {
        throw new AuthError("Key 无效或未携带（401）—— 检查 ASHARE_API_KEY", 401);
      }
      if (res.status === 429) {
        lastErr = new RateLimitError(
          "超频（429）：降频重试；或解一次 PoW 挑战提额到 60 次/分" +
            "（GET /v1/challenge，只提每分钟次数）。若提示为每日条数用尽，" +
            "解 PoW 无效 —— 次日恢复或用 Key",
          429,
        );
        await sleep(500 * 3 ** i);
        continue;
      }
      if (res.status >= 500) {
        lastErr = new APIError(`服务端 ${res.status}`, res.status);
        await sleep(500 * 3 ** i);
        continue;
      }

      let body: Envelope;
      try {
        body = (await res.json()) as Envelope;
      } catch {
        throw new APIError(`响应不是 JSON（HTTP ${res.status}）`, res.status);
      }

      // 只有**显式** ok=false 才算失败（服务端已自动处理，不扣调用次数）→ 重试无意义
      // health / challenge 这类工具端点没有 ok 字段 → 不能误判为失败
      if (body.ok === false) {
        const d = body.data;
        const isEmpty =
          d === null ||
          d === undefined ||
          (Array.isArray(d) && d.length === 0) ||
          (typeof d === "object" && !Array.isArray(d) && Object.keys(d as object).length === 0);
        if (isEmpty) {
          throw new EmptyResultError(
            `当前无数据（非失败）：${body.endpoint ?? path} —— 不计费，稍后重试或换条件`,
          );
        }
        throw new UpstreamError(String(d || "上游取数失败（已自动换源，重试一次通常可好）"));
      }

      return body;
    }

    throw lastErr ?? new APIError(`重试 ${this.retries} 次仍失败`);
  }

  /**
   * 内部：信封 → 表格行数组（`raw: true` 时返回整个信封）
   *
   * 端点 `data` 有两种形态：直接是数组，或是 Markdown 但附带 **`structured`**
   * 结构化数组 → 这里**零 Markdown 解析**（与 Python 版同一逻辑）
   */
  async get<T = Row[]>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    const body = await this.request(path, params);
    if (this.raw) return body as unknown as T;
    const rows = body.structured ?? (Array.isArray(body.data) ? (body.data as Row[]) : null);
    if (rows === null) return (body.data ?? body) as unknown as T; // health / challenge / usage
    return rows as unknown as T;
  }

  /** 内部：供端点方法使用的代码归一化（也导出给用户，见 index.ts） */
  protected _code(code: string): string {
    return normalizeCode(code);
  }
}
