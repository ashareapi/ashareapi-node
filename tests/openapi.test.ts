/**
 * 端点覆盖守护 —— 拉线上 `/openapi.json` 比对 SDK 方法（防"API 加了端点、SDK 忘了补"）
 *
 * ⚠️ 需要网络；离线自动 skip（不误报）—— 与 Python 版 `test_endpoint_coverage.py` 同一哲学。
 */
import { describe, expect, it } from "vitest";
import { AShareAPI } from "../src/endpoints.js";

const OPENAPI = "https://api.ashareapi.com/openapi.json";

/** 端点路径 → SDK 方法名（`-` → camelCase；单段保持原样） */
function methodName(path: string): string {
  const seg = path.replace(/\/+$/, "").split("/").pop() ?? "";
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
    const paths = Object.keys(s.paths);
    expect(paths.length).toBeGreaterThanOrEqual(30);
    const hit = paths.filter((p) => typeof (AShareAPI.prototype as never)[methodName(p)] === "function");
    expect(hit.length).toBe(paths.length);
  });
});
