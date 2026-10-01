/**
 * 端点方法（**32 个**）—— 签名对齐线上 `/openapi.json`（OpenAPI 3.1.0）
 *
 * 命名：**camelCase 为主**（JS 惯例）+ **snake_case 别名**（让 Python 版用户 / 文档零摩擦迁移）
 *
 * 防漂移：`tests/shape.test.ts` 会拉线上 `/openapi.json` 比对方法名 —— 端点增减即测试红灯。
 */

import { AShareAPIBase } from "./client.js";
import { normalizeCode } from "./code.js";
import type { ChallengeResult, HealthResult, QuoteRow, Row, SectionedResult, TableList, UsageResult } from "./types.js";

export class AShareAPI extends AShareAPIBase {
  // ══════════ 基础 / 工具 ══════════

  /** 服务健康检查（数据源就绪状态） */
  health(): Promise<HealthResult> {
    return this.get<HealthResult>("/v1/health");
  }

  /** 查询自身用量与额度 */
  usage(): Promise<UsageResult> {
    return this.get<UsageResult>("/v1/usage");
  }

  /** 获取 PoW 挑战（**匿名提额**：解出后单次请求带 `X-PoW` 头，额度 5/分 → 60/分） */
  challenge(difficulty = 0): Promise<ChallengeResult> {
    return this.get<ChallengeResult>("/v1/challenge", { difficulty });
  }

  // ══════════ 行情 ══════════

  /** 实时行情快照。`code`: `sh600667` / `000001.SZ` / `600667` */
  quote(code: string): Promise<QuoteRow[]> {
    return this.get<QuoteRow[]>("/v1/quote", { code: normalizeCode(code) });
  }

  /** K 线。`period`: `day` | `week` | `month`
   *
   * ⚠️ 价格口径**固定为前复权**（除权除息日不跳空；**没有** `adjust` 参数）
   * —— **不要再自己复权**（会二次复权）。
   */
  kline(code: string, period = "day", count = 30): Promise<Row[]> {
    return this.get("/v1/kline", { code: normalizeCode(code), period, count });
  }

  /** 全市场热搜榜（上游榜单上限 50，超出按 50 返回） */
  hot(limit = 30): Promise<Row[]> {
    return this.get("/v1/hot", { limit });
  }

  /** 市场总览。`type`: `summary` | `trade` | `interval` | `technical` | `valuation` | `rotation` */
  marketOverview(type = "summary"): Promise<Row[]> {
    return this.get("/v1/market-overview", { type });
  }

  /** 涨跌分布（市场广度） */
  changedist(): Promise<Row[]> {
    return this.get("/v1/changedist");
  }

  // ══════════ 财务 / 公司 ══════════

  /** 三大报表（利润表 / 资产负债表 / 现金流量表）—— `data` 是**表列表**（`Row[][]`，期次降序） */
  finance(code: string, num = 4): Promise<TableList> {
    return this.get<TableList>("/v1/finance", { code: normalizeCode(code), num });
  }

  /** 公司简况（上市日期 / 主营业务 / 行业） */
  profile(code: string): Promise<Row[]> {
    return this.get("/v1/profile", { code: normalizeCode(code) });
  }

  /** 分红送转历史 */
  dividend(code: string, years = 3): Promise<Row[]> {
    return this.get("/v1/dividend", { code: normalizeCode(code), years });
  }

  /** 股东研究（十大股东 / 股东户数 / 机构持仓）—— `data` 是**多段结构**（`data.tables`） */
  shareholder(code: string): Promise<SectionedResult> {
    return this.get<SectionedResult>("/v1/shareholder", { code: normalizeCode(code) });
  }

  /** 筹码分布 / 成本 */
  chip(code: string): Promise<Row[]> {
    return this.get("/v1/chip", { code: normalizeCode(code) });
  }

  /**
   * 五档盘口 order book（买一~买五 / 卖一~卖五）
   *
   * **秒级快照，盘中才有意义**（收盘后为当日最后快照）；量单位 = **手**（×100 = 股）。
   * 字段对齐 Tushare 惯例：`b1_p`/`b1_v` ~ `b5_p`/`b5_v`（买档价格/量）、
   * `a1_p`/`a1_v` ~ `a5_p`/`a5_v`（卖档）。跌停时买档全 0 / 涨停时卖档全 0（正常）。
   */
  orderbook(code: string): Promise<Row[]> {
    return this.get("/v1/orderbook", { code: normalizeCode(code) });
  }

  /**
   * 全字段行情画像（价格 + 盘口 + 估值 + 市值 + 股本 + 涨停跌停价 + 量比 + 振幅 + 涨速）
   *
   * ⚠️ **与 `quote()` 的分工**：`quote()` 轻（8 字段，**免费**）；本方法全（24+ 字段，**付费**）
   * —— **只要现价用 `quote()` 更轻（字段少、响应快）**。
   * ⚠️ **仅 A 股**（港股/美股字段布局不同，用 `quote()`）—— **传其他市场返回空，不返回错数据**。
   * **计费 = 次数**：本方法 1 次拿全 24+ 字段 —— **要估值+市值+股本+涨停价多项时，比分别调 quote/valuation/orderbook 更省次数**（3 次 → 1 次）。
   * 单位：`amount` 万元 · `volume` 手 · 市值 亿元 · 股本 股 · 比率 百分数。
   */
  snapshot(code: string): Promise<Row[]> {
    return this.get("/v1/snapshot", { code: normalizeCode(code) });
  }

  /** 个股事件标签（42 类） */
  events(code: string): Promise<Row[]> {
    return this.get("/v1/events", { code: normalizeCode(code) });
  }

  // ══════════ 资金 / 交易 ══════════

  /** 个股资金 + 龙虎榜 + 大宗 + 两融（综合，一接口全有） */
  fund(code: string): Promise<Row[]> {
    return this.get("/v1/fund", { code: normalizeCode(code) });
  }

  /** 龙虎榜分榜。`type`: `institution`（机构）| `hotmoney`（游资）| `activeseat`（活跃席位） */
  lhb(type = "institution", date = ""): Promise<Row[]> {
    return this.get("/v1/lhb", { type, date });
  }

  /** 融资融券明细。`code` 留空 = 全市场 */
  marginTrade(code = "", date = ""): Promise<Row[]> {
    return this.get("/v1/margin-trade", { code: normalizeCode(code), date });
  }

  /** 大宗交易。`code` 留空 = 全市场 */
  blockTrade(code = "", date = ""): Promise<Row[]> {
    return this.get("/v1/block-trade", { code: normalizeCode(code), date });
  }

  // ══════════ 指标 / 选股 ══════════

  /** 技术指标：MA / MACD / KDJ / RSI / BOLL */
  technical(code: string): Promise<Row[]> {
    return this.get("/v1/technical", { code: normalizeCode(code) });
  }

  /** 因子选股。`expr` 如 `"intersect([PE_TTM > 0, PE_TTM < 20, ROETTM > 15])"`；`preset` 如 `"low_pe"` */
  screen(
    expr = "",
    preset = "",
    limit = 20,
    orderby = "",
    desc = true,
    market = "",
  ): Promise<Row[]> {
    return this.get("/v1/screen", { expr, preset, limit, orderby, desc, market });
  }

  // ══════════ 板块 / 产业链 ══════════

  /** 板块行情榜（行业 / 概念 / 地域 + 领涨股） */
  sector(): Promise<Row[]> {
    return this.get("/v1/sector");
  }

  /** 板块估值（PE/PB/PS + 历史百分位）。`code` 如 `pt01801780` */
  sectorValuation(code: string): Promise<Row[]> {
    return this.get("/v1/sector-valuation", { code: normalizeCode(code) });
  }

  /** 产业链。`mode`: `list`（主题清单）| `graph`（图谱，配 `topic`）| `stock`（个股定位，配 `code`） */
  industryChain(mode = "graph", topic = "", code = ""): Promise<Row[]> {
    return this.get("/v1/industry-chain", { mode, topic, code: normalizeCode(code) });
  }

  // ══════════ 宏观 / 固收 / ETF / 新股 ══════════

  /** 宏观数据。`region`: `cn` | `us` | `jp` | `eu` | `hk` */
  macro(region = "cn", names = ""): Promise<Row[]> {
    return this.get("/v1/macro", { region, names });
  }

  /** 可转债条款（溢价率 / 双低 / 强赎触发 / 评级） */
  bond(code: string): Promise<Row[]> {
    return this.get("/v1/bond", { code: normalizeCode(code) });
  }

  /** ETF 概览（行情 / 规模 / 折溢价 / 资金流） */
  etf(code: string): Promise<Row[]> {
    return this.get("/v1/etf", { code: normalizeCode(code) });
  }

  /** 新股日历（发行 / 申购 / 中签 / 上市） */
  ipo(days = 15): Promise<Row[]> {
    return this.get("/v1/ipo", { days });
  }

  // ══════════ 日历 / 研报 / 搜索 ══════════

  /** 投资日历（个股事件：分红派息 / 解禁 / 财报）—— `data` 是**多段结构**（`data.tables`） */
  calendar(date = "", limit = 20): Promise<SectionedResult> {
    return this.get<SectionedResult>("/v1/calendar", { date, limit });
  }

  /** 脱水研报。`mode`: `list` | `detail`（配 `symbol`） */
  dehydrated(mode = "list", symbol = "", limit = 10): Promise<Row[]> {
    return this.get("/v1/dehydrated", { mode, symbol, limit });
  }

  /** 搜索股票 / 基金 / 板块（消歧） */
  search(q: string): Promise<Row[]> {
    return this.get("/v1/search", { q });
  }

  // ══════════ snake_case 别名（与 Python SDK 方法名一致，零摩擦迁移）══════════

  /** @see {@link marketOverview} */
  market_overview(type = "summary"): Promise<Row[]> {
    return this.marketOverview(type);
  }

  /** @see {@link marginTrade} */
  margin_trade(code = "", date = ""): Promise<Row[]> {
    return this.marginTrade(code, date);
  }

  /** @see {@link blockTrade} */
  block_trade(code = "", date = ""): Promise<Row[]> {
    return this.blockTrade(code, date);
  }

  /** @see {@link sectorValuation} */
  sector_valuation(code: string): Promise<Row[]> {
    return this.sectorValuation(code);
  }

  /** @see {@link industryChain} */
  industry_chain(mode = "graph", topic = "", code = ""): Promise<Row[]> {
    return this.industryChain(mode, topic, code);
  }
}
