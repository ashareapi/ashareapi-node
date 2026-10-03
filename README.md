<div align="center">

<a href="https://ashareapi.com"><img src="https://ashareapi.com/icon-512.png" width="88" height="88" alt="ashareapi"></a>

# ashareapi — A股数据 API 官方 Node.js / TypeScript SDK

**行情 / K线 / 财务 / 资金 / 龙虎榜 / 板块 / 因子选股** —— 32 个端点，**免费端点无需注册**。
**零运行时依赖**（用 Node 原生 `fetch`），自带 TypeScript 类型。

![Node.js](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=nodedotjs&logoColor=white)
[![npm](https://img.shields.io/npm/v/ashareapi?label=npm)](https://www.npmjs.com/package/ashareapi)
[![CI](https://github.com/ashareapi/ashareapi-node/actions/workflows/ci.yml/badge.svg)](https://github.com/ashareapi/ashareapi-node/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/license-MIT-green)

**中文** · [English](README.en.md)

[官网](https://ashareapi.com) · [文档](https://ashareapi.com/docs/) · [端点清单](https://ashareapi.com/endpoints/) · [MCP 接入](https://ashareapi.com/mcp) · [Agent Skill](https://ashareapi.com/skill)

[GitHub 源码](https://github.com/ashareapi/ashareapi-node) · [问题反馈 Issues](https://github.com/ashareapi/ashareapi-node/issues) · [更新日志](https://ashareapi.com/changelog)

</div>

常用端点文档：[K 线](https://ashareapi.com/docs/endpoints/kline/) · [因子选股](https://ashareapi.com/docs/endpoints/screen/) · [健康检查](https://ashareapi.com/docs/endpoints/health/)

```bash
npm install ashareapi
```

> ⚠️ **仅在服务端使用**（Node / Next.js 服务端 / 脚本）。浏览器里会暴露你的 API Key —— 本包刻意不提供浏览器构建。

> 也有 **Python SDK**：`pip install ashareapi` —— [PyPI](https://pypi.org/project/ashareapi/)

## 30 秒上手

```ts
import { AShareAPI } from "ashareapi";

const cli = new AShareAPI();                 // 免费端点无需 Key
const bars = await cli.quote("sh600667");    // 实时行情
console.log(bars[0]);                        // { date, open, last, high, low, volume, amount, turnover }

console.log(await cli.kline("600667.SH", "day", 5));  // 代码格式随便写（自动归一化）
console.log(await cli.hot(10));                       // 热搜榜
```

**付费端点**（财务 / 资金 / 龙虎榜 / 选股等）需要 Key（[获取](https://ashareapi.com/pricing)，¥9.9 起）：

```ts
const cli = new AShareAPI({ apiKey: "ct-你的Key" });  // 或设环境变量 ASHARE_API_KEY
const rows = await cli.screen("", "low_pe", 10, "ROETTM");
console.table(rows);
```

**CommonJS 同样可用**：

```js
const { AShareAPI } = require("ashareapi");   // 双格式产物，import / require 都行
```

## 为什么用它

- **零依赖**：只用 Node 原生 `fetch` —— 安装快、无供应链风险（Python 版还需要 `requests`）
- **免费端点真的免 Key**：`quote / kline / hot / market-overview / changedist` 直接调，无需注册
- **代码格式兼容**：`sh600667` / `600667.SH` / `600667` 都认
- **方法名两种写法都认**：`marketOverview()` 与 `market_overview()` 是同一个方法（Python 版用户零摩擦迁移）
- **多源自动切换**：后端 70 个数据源互为备份，取数失败会自动换源且**不扣调用次数**
- **错误分类清楚**：`AuthError` / `RateLimitError` / `UpstreamError` / `EmptyResultError`（无数据 ≠ 失败）—— 每类都告诉你该做什么
- **TypeScript 原生**：完整 `.d.ts`，编辑器里 `cli.` 直接补全 32 个方法与参数

## 端点一览

| 方法 | 说明 | 免 Key |
|---|---|---|
| `quote(code)` | 实时行情快照 | ✅ |
| `kline(code, period, count)` | K 线（日/周/月）· **口径固定为前复权** | ✅ |
| `hot(limit)` | 热搜榜 | ✅ |
| `marketOverview(type)` | 市场总览（画像/估值/风格轮动） | ✅ |
| `changedist()` | 涨跌分布（市场广度） | ✅ |
| `finance(code, num)` | 三大报表 | — |
| `fund(code)` | 资金流 + 龙虎榜 + 大宗 + 两融 | — |
| `technical(code)` | MA / MACD / KDJ / RSI / BOLL | — |
| `lhb(type)` | 龙虎榜分榜（机构 / 游资 / 活跃席位） | — |
| `screen(expr, preset, limit, orderby, desc, market)` | 因子选股 | — |
| `search(q)` | 搜索消歧 | — |

> ⚠️ **K 线价格口径固定为前复权**（除权除息日不跳空；**没有** `adjust` 参数）—— **不要再自己复权**（会二次复权）。

（完整 32 端点见 [端点清单](https://ashareapi.com/endpoints)；方法签名与线上 `/openapi.json` 一致）

## 返回形态

方法返回 **对象数组**（`Row[]`），即 JS 里的"表格"：

```ts
const rows = await cli.kline("sh600667", "day", 3);
// [ { date: '2026-09-23', open: '20.10', last: '20.59', ... }, ... ]
```

需要完整信封（含 `elapsed_ms` / `source` / `tier`）时：

```ts
const cli = new AShareAPI({ raw: true });
const env = await cli.quote("sh600667");
// { ok: true, endpoint: '/v1/quote', tier: 'free', elapsed_ms: 862, source: '...', data: [...] }
```

> **与 Python 版差异**：Python 版默认返回 `pandas.DataFrame`（没装 pandas 则 `list[dict]`）；JS 版没有 DataFrame 概念，**统一返回 `Row[]`**。另外 JS 版**全部返回 Promise**（Python 版是同步）。

## 错误处理

```ts
import { AShareAPI, AuthError, RateLimitError, UpstreamError, EmptyResultError } from "ashareapi";

const cli = new AShareAPI();
try {
  const rows = await cli.fund("sh600667");
} catch (e) {
  if (e instanceof AuthError) console.log(e.message);          // 401 / 缺 Key → 去拿 Key
  else if (e instanceof RateLimitError) console.log(e.message); // 429 → 降频 / 解 PoW 提额（只提次数）/ 升级档位
  else if (e instanceof UpstreamError) console.log(e.message);  // 上游取数失败（已自动换源、不扣次数）→ 重试一次通常就好
  else if (e instanceof EmptyResultError) console.log(e.message); // 当前无数据（如当天无大宗交易）→ 不计费
  else throw e;
}
```

## 也用 AI Agent（MCP / Agent Skill）

除了 Node SDK，我们还提供两种 **AI Agent** 接入方式：

- **MCP 服务器**（Streamable HTTP）—— 服务器地址 **`https://api.ashareapi.com/mcp`**
  （⚠️ 填**这个**接口地址；站点介绍页 `ashareapi.com/mcp` **不是**接口）
- **各客户端配置写法**（Claude Code / Cursor / VS Code / Codex 等 **19 家**，键名差异都核对过官方文档）：
  <https://ashareapi.com/mcp>
- **Agent Skill**（给 AI Agent 读的接口说明书 + 分发包，装进 skills 目录即用）：<https://ashareapi.com/skill>

> 免费工具/端点**无需 Key**；付费工具在请求头带 `Authorization: Bearer <你的 Key>`。

## 示例

仓里 [`examples/`](https://github.com/ashareapi/ashareapi-node/tree/main/examples) 有可直接跑的示例：

| 文件 | 做什么 |
|---|---|
| [`examples/quickstart.mjs`](https://github.com/ashareapi/ashareapi-node/blob/main/examples/quickstart.mjs) | 免费端点拿**行情 / K 线 / 热搜**（无需 Key）|
| [`examples/kline-to-csv.mjs`](https://github.com/ashareapi/ashareapi-node/blob/main/examples/kline-to-csv.mjs) | 拉 120 根日线 → 落成 CSV |
| [`examples/dashboard-next.ts`](https://github.com/ashareapi/ashareapi-node/blob/main/examples/dashboard-next.ts) | **Next.js 服务端路由**示例（Key 不进浏览器）|

```bash
node examples/quickstart.mjs
node examples/kline-to-csv.mjs
```

## 环境要求

- **Node.js ≥ 18**（依赖原生 `fetch`；建议 20 LTS 或更高）
- 零运行时依赖
- 示例代码见 [`examples/`](https://github.com/ashareapi/ashareapi-node/tree/main/examples)：快速上手 / K 线落 CSV / Next.js 服务端

## 版本记录

**当前版本：`0.1.10`**（2026-10-03）

| 版本 | 变更 |
|---|---|
| `0.1.10` | 429 提示补充匿名额度口径（单次最多 250 条 / 每天最多 10 万条）· 区分「每分钟次数超」与「当天条数超」（后者解 PoW 无效）· 无行为变更 |
| `0.1.9` | 文档完善：README 新增「环境要求」「返回形态」「示例」· 补 GitHub 仓 / Issues 链接与 CI 徽章 · 源码注释与文档表述统一（无行为变更）|
| `0.1.8` | 文档措辞修订：价格口径（前复权）在 README / 方法文档 / CHANGELOG 中表述统一 · MCP 地址与 Agent Skill 说明更明确 |
| `0.1.7` | 文档：明确 **MCP 服务器地址** `https://api.ashareapi.com/mcp` · 新增 **Agent Skill** 说明（`/skill`）· 变更记录链接改为可直接点开的绝对地址 |
| `0.1.6` | 文档：`kline()` 写明**价格口径**（前复权 · 无 `adjust` 参数 · 勿二次复权）|
| `0.1.5` | 文档：换手率字段示例更新为 `turnover` · 补齐 `0.1.3` / `0.1.4` 两行 |
| `0.1.4` | 类型对齐返回形态：`finance()` → `TableList` · `shareholder()` / `calendar()` → `SectionedResult` · `QuoteRow.turnover` 文档更正 |
| `0.1.3` | 文档修订（`snapshot()` / `orderbook()` 边界）· `CHANGELOG.md` 进包 |
| `0.1.2` | 新增 `snapshot()`（全字段画像）· 方法数 31 → 32 |
| `0.1.1` | 新增 `orderbook()`（五档盘口）· 方法数 30 → 31 |
| `0.1.0` | 首个版本（30 个方法 · 5 个免费端点）|

> ⚠️ **端点本身永远是最新的**（服务端演进，**无需升级 SDK**）—— 升级只是为了用上**新增的便利方法**。

完整变更记录 → 包内 `CHANGELOG.md` · [站内更新日志](https://ashareapi.com/changelog) · [npm 版本历史](https://www.npmjs.com/package/ashareapi?activeTab=versions)

## License

MIT · 数据仅供研究参考，不构成投资建议
