import { defineConfig } from "tsup";

/**
 * 双格式打包：ESM + CJS + .d.ts
 *   · Node 生态 `import` / `require` 都要能用 → 两种格式都得发
 *   · target=node18：与 package.json 的 engines 一致（原生 fetch 可用）
 *   · 产物文件名固定 .mjs / .cjs，与 exports map 一一对应
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: false,
  target: "node18",
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".mjs" };
  },
});
