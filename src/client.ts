/**
 * 核心客户端 —— 认证 / 请求 / 重试 / 信封解析
 *
 * 与 Python SDK 的 client.py **行为一致**（同一后端、同一套规则）：
 *   · 认证：`Authorization: Bearer` + `ASHARE_API_KEY` + 构造参数
 *   · 免费端点（10 个）无需 Key
 *   · 5xx / 网络错误 → 指数退避 3 次（0.5s / 1.5s / 4s）
 *   · 429 → 读 `Retry-After`：服务端要求等待 > 5s 时**不重试**、直接抛 RateLimitError
 *     （否则会把 1 次调用放大成 N 次，且必然再撞限流）
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

/**
 * 429 退避上限（秒）：服务端返 `Retry-After: 60`（每分钟窗口）⇒ 若要求等待超过这个秒数，
 * 盲目重试只会把 1 次调用放大成 N 次、且**必然再撞 429**（3 次重试 = 3 倍请求量）。
 * ⇒ 只有「服务端要求等待很短」时才睡等重试；否则立即抛出，由调用方决定何时再来。
 */
export const RETRY_429_MAX_WAIT = 5;

/**
 * 匿名档「安全轮询间隔」（毫秒）—— 匿名限 **5 次/分** ⇒ 12s。
 * 仅用于**过密提示**；只提示、不做限速/延迟。
 */
export const ANON_SAFE_INTERVAL_MS = 12_000;

/** 解析 `Retry-After` 响应头（秒数形式）。HTTP-date 形式或缺失 → 0。 */
function retryAfterSeconds(value: string | null): number {
  if (!value) return 0;
  const n = Number.parseFloat(value.trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * 从 **4xx 响应体**里取出服务端写给人看的那句话（`error` / `detail`）。
 *
 * 服务端 4xx 的形状有两种：
 *   · 服务端返回的：`{"error": "单次预估 242,400 条，超过上限 60,000 条…", ...}`
 *   · 参数校验（FastAPI）：`{"detail": [{"loc": ["query","period"], "msg": "周期不支持；可选：…"}]}`
 * 取不到就退回响应原文（截断 120 字）—— **宁可糙也不要吞掉**。
 */
async function serverErrorText(res: Response): Promise<string> {
  try {
    const raw = await res.text();
    try {
      const body = JSON.parse(raw) as Record<string, unknown>;
      const d = body.error ?? body.detail;
      if (typeof d === "string" && d.trim()) return d.trim();
      if (Array.isArray(d)) {
        const parts = d.map((item) =>
          item && typeof item === "object"
            ? String((item as { msg?: unknown }).msg ?? JSON.stringify(item))
            : String(item),
        );
        if (parts.length) return parts.join("; ");
      }
    } catch {
      /* 不是 JSON → 退回原文 */
    }
    return raw.slice(0, 120);
  } catch {
    return "";
  }
}

/** 免 Key 端点：6 个数据端点（含 `/v1/wiki` 文档检索）+ 2 个工具端点 */
export const FREE_ENDPOINTS: readonly string[] = [
  "/v1/quote",
  "/v1/kline",
  "/v1/hot",
  "/v1/market-overview",
  "/v1/changedist",
  "/v1/wiki",
  "/v1/trade-calendar",
  "/v1/models",
  "/v1/health",
  "/v1/challenge",
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 私有：把参数对象变成 query string（跳过 undefined / null / 空串；`0` 与 `false` 保留） */
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
  /** 上次请求时刻（"轮询过密"提示用，不做限速） */
  private lastTs = 0;
  private paceWarned = false;

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

  /** 私有：统一请求（认证 / 超时 / 重试 / 信封校验）→ 原始信封 */
  async request(
    path: string,
    params: Record<string, unknown> = {},
    method: "GET" | "POST" | "DELETE" = "GET",
    jsonBody?: unknown,
  ): Promise<Envelope> {
    const q = toQuery(params);
    const url = `${this.baseUrl}${path}${q ? "?" + q : ""}`;

    // 轮询节奏提示：匿名档 5 次/分 ⇒ 间隔 <12s 必撞 429。
    //    只 `console.warn` 一次、**不 delay 不拦截**（SDK 绝不改调用行为）。
    const now = Date.now();
    if (!this.apiKey && this.lastTs && now - this.lastTs < ANON_SAFE_INTERVAL_MS && !this.paceWarned) {
      this.paceWarned = true;
      console.warn(
        `ashareapi：调用间隔仅 ${((now - this.lastTs) / 1000).toFixed(1)}s —— 匿名档限 5 次/分，` +
          "建议轮询间隔 ≥12s（解一次 PoW 挑战可到 15 次/分 ≈ ≥4s）；过密会收到 429 并白耗调用。" +
          "配 API Key 后 standard 档 120 次/分：https://ashareapi.com/pricing",
      );
    }
    this.lastTs = now;

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
        if (jsonBody !== undefined) {
          headers["Content-Type"] = "application/json";
        }
        res = await fetch(url, {
          method,
          headers,
          signal: AbortSignal.timeout(this.timeout),
          ...(jsonBody !== undefined ? { body: JSON.stringify(jsonBody) } : {}),
        });
      } catch (e) {
        lastErr = new APIError(`网络错误：${String(e)}`);
        await sleep(500 * 3 ** i);
        continue;
      }

      if (res.status === 401) {
        throw new AuthError(
          `Key 无效或未携带（401）：${await serverErrorText(res)}`,
          401,
        );
      }
      if (res.status === 429) {
        const wait = retryAfterSeconds(res.headers.get("Retry-After"));
        lastErr = new RateLimitError(
          `超频（429）：${wait ? `服务端要求 ${wait} 秒后再试` : "已被限流"}；` +
            "或解一次 PoW 挑战提额到 15 次/分" +
            "（GET /v1/challenge，只提每分钟次数）。若提示为每日条数用尽，" +
            "解 PoW 无效 —— 次日恢复或用 Key",
          429,
        );
        // 服务端给了 Retry-After（通常 60s）⇒ 窗口远大于退避上限 ⇒ **不再重试**，立即抛出。
        if (wait > RETRY_429_MAX_WAIT) throw lastErr;
        if (i === this.retries - 1) break;
        await sleep(wait ? wait * 1000 : 500 * 3 ** i);
        continue;
      }
      if (res.status >= 500) {
        lastErr = new APIError(`服务端 ${res.status}`, res.status);
        await sleep(500 * 3 ** i);
        continue;
      }

      // 其余 4xx（403 / 413 / 422 …）必须抛错，不能当成功返回。
      // 服务端 4xx 的错误体没有 data 字段，当结果返回会让表格转换失败，且吞掉失败原因。
      // 4xx = 请求本身有问题 ⇒ 重试无意义，立即抛出并带上服务端原话。
      // 403 = 无权限（档位不够）→ 归 AuthError。
      if (res.status >= 400) {
        const msg = `HTTP ${res.status}：${await serverErrorText(res)}`;
        throw res.status === 403 ? new AuthError(msg, 403) : new APIError(msg, res.status);
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
        throw new UpstreamError(String(d || "取数失败（已自动换源，重试一次通常可好）"));
      }

      return body;
    }

    throw lastErr ?? new APIError(`重试 ${this.retries} 次仍失败`);
  }

  /**
   * 私有：信封 → 表格行数组（`raw: true` 时返回整个信封）
   *
   * 端点 `data` 有两种形态：直接是数组，或是 Markdown 但附带 **`structured`**
   * 结构化数组 → 这里**零 Markdown 解析**（与 Python 版同一逻辑）
   */
  async get<T = Row[]>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    return this.send<T>(path, params, "GET");
  }

  /** 非 GET（POST / DELETE）的同款解包 —— 仅 `ip_whitelist` 这类管理端点在用。 */
  async send<T = Row[]>(
    path: string,
    params: Record<string, unknown> = {},
    method: "GET" | "POST" | "DELETE" = "GET",
    jsonBody?: unknown,
  ): Promise<T> {
    const body = await this.request(path, params, method, jsonBody);
    if (this.raw) return body as unknown as T;
    const rows = body.structured ?? (Array.isArray(body.data) ? (body.data as Row[]) : null);
    if (rows === null) return (body.data ?? body) as unknown as T; // health / challenge / usage
    return rows as unknown as T;
  }

  /** 私有：供端点方法使用的代码归一化（也导出给用户，见 index.ts） */
  protected _code(code: string): string {
    return normalizeCode(code);
  }
}
