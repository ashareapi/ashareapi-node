/**
 * 3 行拿数据（免费端点，无需 Key）
 *
 * 运行：node examples/quickstart.mjs
 */
import { AShareAPI } from "ashareapi";

const cli = new AShareAPI(); // 免费端点无需 Key

// 1) 实时行情快照
const bars = await cli.quote("sh600667");
console.log("行情（最新一根）:", bars[0]);

// 2) K 线（代码格式随便写，自动归一化）
const k = await cli.kline("600667.SH", "day", 3);
console.log("K 线最近 3 根:", k);

// 3) 热搜榜
const hot = await cli.hot(5);
console.log("热搜 Top5:", hot.map((r) => `${r.name}(${r.code}) ${r.zdf}%`).join(" · "));

// 4) 市场总览（估值分位）
const overview = await cli.marketOverview("valuation");
console.log("市场总览:", overview);
