/**
 * A股数据 API 官方 Node.js / TypeScript SDK
 *
 * ```ts
 * import { AShareAPI } from "ashareapi";
 *
 * const cli = new AShareAPI();                 // 免费端点（quote/kline/hot/market-overview/changedist）无需 Key
 * const bars = await cli.quote("sh600667");
 * console.log(bars[0]);                        // { date, open, last, high, low, volume, amount, turnover }
 *
 * const cli2 = new AShareAPI({ apiKey: "ct-..." }); // 付费端点需 Key（也读 ASHARE_API_KEY）
 * const rows = await cli2.screen("", "low_pe", 10, "ROETTM");   // expr, preset, limit, orderby
 * ```
 *
 * ⚠️ **仅在服务端使用** —— 浏览器里会暴露你的 API Key（本包刻意不提供浏览器构建）。
 *
 * 文档：https://ashareapi.com/docs  ·  端点清单：https://ashareapi.com/endpoints
 */

export { AShareAPI } from "./endpoints.js";
export { AShareAPIBase, DEFAULT_BASE, FREE_ENDPOINTS } from "./client.js";
export { normalizeCode } from "./code.js";
export {
  AShareError,
  APIError,
  AuthError,
  EmptyResultError,
  RateLimitError,
  UpstreamError,
} from "./errors.js";
export { VERSION } from "./version.js";
export type {
  AShareAPIOptions,
  ChallengeResult,
  Envelope,
  HealthResult,
  QuoteRow,
  Row,
  Section,
  SectionedResult,
  TableList,
  UsageResult,
} from "./types.js";
