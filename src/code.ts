/**
 * 股票代码格式归一化 —— 兼容多种写法，统一成 API 原生格式（`sh600667`）
 *
 * 与 Python SDK 的 `_code.py` **同规则**（两边行为必须一致）：
 *     sh600667        原生（沪）
 *     sz000001        原生（深）
 *     600667.SH       通用后缀风格
 *     000001.SZ       通用后缀风格
 *     600667          纯 6 位（按首位推断：5/6→沪 0/3→深 4/8→北）
 *     hk00700 / usAAPL  原样返回（前缀小写化）
 *
 * 认不出来就**原样返回**（让 API 报错，不猜）。
 */

const SUFFIX = /^(\d{6})\.(SH|SZ|BJ)$/i;
const PREFIX = /^(SH|SZ|BJ|HK|US)(.+)$/i;
const BARE = /^\d{6}$/;

export function normalizeCode(code: string): string {
  const c = (code ?? "").trim();
  if (!c) return c;

  const suf = SUFFIX.exec(c); // 600667.SH → sh600667
  if (suf) return suf[2].toLowerCase() + suf[1];

  const pre = PREFIX.exec(c); // SH600667 → sh600667（前缀小写，后缀原样）
  if (pre) return pre[1].toLowerCase() + pre[2];

  if (BARE.test(c)) {
    // 纯 6 位 → 按首位推断市场
    const head = c[0];
    if (head === "5" || head === "6") return "sh" + c;
    if (head === "0" || head === "3") return "sz" + c;
    if (head === "4" || head === "8") return "bj" + c;
  }
  return c;
}
