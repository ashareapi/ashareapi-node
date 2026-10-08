/**
 * Next.js 服务端用法（示范"**只在服务端**"）
 *
 * ⚠️ 放在 `app/api/.../route.ts`（服务端）里用 —— 不要放到客户端组件，
 *    否则 API Key 会被打进浏览器包，泄露给终端用户。
 *
 * 运行前提：`process.env.ASHARE_API_KEY`（或 .env.local）里有 Key。
 */
import { NextResponse } from "next/server";
import { AShareAPI, AuthError, EmptyResultError, RateLimitError } from "ashareapi";

// 模块级单例（Node 运行时复用连接）
const cli = new AShareAPI(); // 读 process.env.ASHARE_API_KEY

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code") ?? "sh600667";

  try {
    const [quote, technical] = await Promise.all([
      cli.quote(code),
      cli.technical(code),
    ]);
    return NextResponse.json({ ok: true, code, quote: quote[0], technical: technical[0] });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, error: "缺少或无效的 API Key" }, { status: 401 });
    }
    if (e instanceof RateLimitError) {
      return NextResponse.json({ ok: false, error: "触发限流，请稍后重试" }, { status: 429 });
    }
    if (e instanceof EmptyResultError) {
      return NextResponse.json({ ok: true, code, quote: null, note: "当前无数据" });
    }
    throw e;
  }
}
