/**
 * 端点覆盖守护 —— 拉线上 `/openapi.json` 比对 SDK 方法（防"API 加了端点、SDK 忘了补"）
 *
 * ⚠️ 需要网络；离线自动 skip（不误报）—— 与 Python 版 `test_endpoint_coverage.py` 同一哲学。
 */
import { describe, expect, it } from "vitest";
import { AShareAPI } from "../src/endpoints.js";

const OPENAPI = "https://api.ashareapi.com/openapi.json";

/**
 * ⚠️ **有意不进 SDK** 的端点 —— 必须在这里**显式列出**（而不是放宽断言），
 * 这样"其它新端点漏补"仍然会红灯；"豁免写错 / 端点被删"由下面第二个用例挡住。
 * 为什么 wiki 不进 SDK：它是**文档检索**（给 AI Agent 读的字段单位 / 口径说明），
 * 不是取数接口 —— 见 SKILL.md §八。端点数 = 102（`/v1/wiki` 除外）。
 */
const EXEMPT: Record<string, string> = {
  "/v1/wiki": "文档检索（给 AI Agent 读的，不是取数接口）",
};

/** 带路径参数的端点：方法名无法由路径推导，显式映射 */
const ALIAS: Record<string, string> = {
  "/v1/agent-research/{task_id}": "agentResearchStatus",
};

/** 端点路径 → SDK 方法名（`-` → camelCase；单段保持原样） */
function methodName(path: string): string {
  if (path in ALIAS) return ALIAS[path];
  const segs = path.replace(/\/+$/, "").split("/").filter((x) => x && x !== "v1");
  const seg = segs.join("-");
  const parts = seg.split("-");
  return parts[0] + parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

async function spec(): Promise<{ paths: Record<string, unknown> } | null> {
  try {
    const res = await fetch(OPENAPI, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    return (await res.json()) as { paths: Record<string, unknown> };
  } catch {
    return null;
  }
}

describe("openapi 覆盖守护（需网络，离线 skip）", () => {
  it("每个线上端点都有对应 SDK 方法", async () => {
    const s = await spec();
    if (!s) {
      console.warn("[skip] 拉不到 /openapi.json（离线？）");
      return;
    }
    const missing: string[] = [];
    for (const path of Object.keys(s.paths)) {
      if (path in EXEMPT) continue;
      const name = methodName(path);
      if (typeof (AShareAPI.prototype as never)[name] !== "function") {
        missing.push(`${path} → ${name}()`);
      }
    }
    expect(missing, `SDK 缺方法（新端点未补？）：${missing.join(", ")}`).toEqual([]);
  });

  it("端点数 ≥ 30 且覆盖率 100%", async () => {
    const s = await spec();
    if (!s) return;
    const paths = Object.keys(s.paths).filter((p) => !(p in EXEMPT));
    expect(paths.length).toBeGreaterThanOrEqual(30);
    const hit = paths.filter((p) => typeof (AShareAPI.prototype as never)[methodName(p)] === "function");
    expect(hit.length).toBe(paths.length);
  });

  it("豁免名单里的端点仍然真实存在（防名单腐化）", async () => {
    const s = await spec();
    if (!s) return;
    const gone = Object.keys(EXEMPT).filter((p) => !(p in s.paths));
    expect(gone, `豁免名单里的端点已不存在，请清理 EXEMPT：${gone.join(", ")}`).toEqual([]);
  });
});
