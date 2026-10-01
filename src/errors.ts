/**
 * 异常类型 —— **按"用户能采取的动作"分类，不只按 HTTP 码**
 * （与 Python SDK 的 errors.py 一一对应，5 类完全相同）
 */

export class AShareError extends Error {
  /** HTTP 状态码（若来自 HTTP 响应） */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = new.target.name; // 子类名（instanceof 与 name 都可用）
    this.status = status;
    // 让 instanceof 在编译到 ES5 时也正确（Node 18+ 其实不需要，保留零成本）
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 401 / 缺 Key —— 动作：检查 `ASHARE_API_KEY` 或去 https://ashareapi.com/pricing 获取 */
export class AuthError extends AShareError {}

/** 429 超频 —— 动作：降频；或解一次 PoW 挑战提额到 60 次/分（`GET /v1/challenge`）；或升级档位 */
export class RateLimitError extends AShareError {}

/**
 * 当前**无数据**（≠ 取数失败）—— 如当天无大宗交易。
 *
 * **不扣调用次数**；稍后重试或换条件即可。
 * 区别于 {@link UpstreamError}（上游取数失败、已自动换源）。
 */
export class EmptyResultError extends AShareError {}

/** `ok:false`（上游取数失败）—— 我们已**自动换源且不扣次数**，动作：重试一次通常就好 */
export class UpstreamError extends AShareError {}

/** 5xx / 其他非预期响应 */
export class APIError extends AShareError {}
