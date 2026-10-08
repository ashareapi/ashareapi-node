/**
 * K 线落 CSV（免费端点，无需 Key）
 *
 * 运行：node examples/kline-to-csv.mjs
 */
import { writeFileSync } from "node:fs";
import { AShareAPI } from "ashareapi";

const cli = new AShareAPI();
const rows = await cli.kline("sh600667", "day", 120);

if (rows.length === 0) {
  console.log("没有数据（休市或代码有误）");
  process.exit(0);
}

const cols = Object.keys(rows[0]);
const csv = [
  cols.join(","),
  ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(",")),
].join("\n");

const out = "600667-kline.csv";
writeFileSync(out, csv, "utf8");
console.log(`已写入 ${out}（${rows.length} 行 · 列：${cols.join("/")}）`);
