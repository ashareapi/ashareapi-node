/**
 * 端点方法（**33 个**）—— 签名对齐线上 `/openapi.json`（OpenAPI 3.1.0）
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

  /** 获取 PoW 挑战（**匿名提额**：解出后单次请求带 `X-PoW` 头，额度 5/分 → 60/分；**只提每分钟次数，每日条数上限不变**） */
  challenge(difficulty = 0): Promise<ChallengeResult> {
    return this.get<ChallengeResult>("/v1/challenge", { difficulty });
  }

  // ══════════ 行情 ══════════

  /** 实时行情快照。`code`: `sh600667` / `000001.SZ` / `600667` */
  quote(code: string): Promise<QuoteRow[]> {
    return this.get<QuoteRow[]>("/v1/quote", { code: normalizeCode(code) });
  }

  /** K 线。`period`: `day` | `week` | `month` | `season` | `year` | `m1` | `m5` | `m15` | `m30` | `m60` | `m120`
   *
   * - `start` / `end`: `YYYY-MM-DD`，**仅 `day` 与分钟线支持**（须配对；传了它 `count` 被忽略，
   *   默认取满 1212 条）。港股 / 美股 / 期货 / 外汇不支持。
   *
   * ⚠️ 复权口径**由服务端固定**，没有 `adjust` 参数：日线及以上为**前复权**（除权除息日不跳空），
   * 分钟线为**不复权** —— **不要再自己复权**（会二次复权）。
   * ⚠️ 分钟线（`m*`）属**付费层**且**窗口为近 1 个月**，不支持 北交所 / 期货 / 外汇。
   */
  kline(code: string, period = "day", count = 30, start = "", end = ""): Promise<Row[]> {
    const params: Record<string, unknown> = { code: normalizeCode(code), period, count };
    if (start) params.start = start;
    if (end) params.end = end;
    return this.get("/v1/kline", params);
  }

  /** 分时（当日 / 近 5 日盘中走势）。`days`: `1`（当日，默认）| `5`（近 5 个交易日）
   *
   * ⚠️ 与 {@link kline} 的分钟线**不是一回事**：`kline` 给分钟 **K 线**（OHLC 蜡烛），
   * 本方法是**分时**（每分钟一个价 + 累计量）。
   * ⚠️ 付费层；`days` **只有 1 和 5 两档**（传其他值会按 5 日返回）。
   */
  minute(code: string, days = 1): Promise<Row[]> {
    return this.get("/v1/minute", { code: normalizeCode(code), days });
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

  // ══════════ 量化：回测 / 批量回测 / 策略清单 / 因子库 / 方法论库 ══════════
  //   ⚠️ 这几个端点属**付费层**（standard 起；批量回测 pro 起），且计入**重型日额度**。

  /**
   * 量化回测。`mode`: `single`（单标的实时，配 `code`）| `portfolio`（组合，查预置区间）。
   * `weighting` 仅 `mode=portfolio` 有效：`equal`（等权）| `inv_vol`（波动率倒数，不限量版）。
   */
  backtest(opts: {
    strategy?: string;
    mode?: string;
    code?: string;
    start?: string;
    end?: string;
    initial_cash?: number;
    weighting?: string;
    include_equity?: boolean;
  } = {}): Promise<Record<string, unknown>> {
    return this.get("/v1/backtest", {
      strategy: (opts.strategy ?? "buy_hold").toLowerCase(),
      mode: (opts.mode ?? "single").toLowerCase(),
      code: opts.code ? normalizeCode(opts.code) : "",
      start: opts.start ?? "2019-01-01",
      end: opts.end ?? "",
      initial_cash: opts.initial_cash ?? 1_000_000,
      weighting: (opts.weighting ?? "equal").toLowerCase(),
      include_equity: String(Boolean(opts.include_equity)),
    });
  }

  /**
   * 批量回测（多标的 × 多策略对比矩阵）。
   * `codes` / `strategies` 可为数组或逗号分隔字符串。
   * ⚠️ 上限：标的 ≤ 20 · 策略 ≤ 10 · 组合 ≤ 60（超限直接报错，不静默截断）。属 **pro** 档。
   */
  backtestBatch(
    codes: string | string[],
    strategies: string | string[] = "buy_hold",
    opts: { start?: string; end?: string; initial_cash?: number } = {},
  ): Promise<Record<string, unknown>> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    const ss = Array.isArray(strategies) ? strategies.join(",") : strategies;
    return this.get("/v1/backtest-batch", {
      codes: cs,
      strategies: ss,
      start: opts.start ?? "2019-01-01",
      end: opts.end ?? "",
      initial_cash: opts.initial_cash ?? 1_000_000,
    });
  }

  /** 量化策略清单（20 条单标的择时 + 9 条组合选股，含参数范围）。不占重型额度。 */
  strategies(): Promise<Record<string, unknown>> {
    return this.get("/v1/strategies");
  }

  /**
   * 量化因子库（88 因子 + 50 筛选入口 + 22 预设）。不占重型额度。
   * ⚠️ `category` / `kind` **只接受中文枚举值**：
   * `估值`/`行情`/`盈利`/`资产负债`/`现金流`；`排行`/`标签`/`事件`。
   */
  factors(category = "", kind = ""): Promise<Record<string, unknown>> {
    return this.get("/v1/factors", { category, kind });
  }

  /** 量化方法论库（13 条「怎么判断市场」流程，含判据 / 阶段 / 实测证据）。不占重型额度。 */
  playbooks(category = "", id = ""): Promise<Record<string, unknown>> {
    return this.get("/v1/playbooks", { category, id });
  }

  /**
   * **全历史**日线一次拿全（约 2465 根 · 2016-08-08 起），是 {@link kline} 的超集。
   * @param fq `qfq` 前复权（默认，画图用）| `hfq` 后复权（**回测用** —— 历史不随未来分红变化，可复现）| `nofq` 不复权
   * @param start 起始日期 `YYYY-MM-DD`（可省略；与 `end` 配对）
   * @param end 结束日期 `YYYY-MM-DD`（可省略）
   * ⚠️ **仅 A 股个股**；ETF / 可转债 / 指数 / 板块 / 港美股 / 期货 / 外汇用 {@link kline}。属**付费层**（standard 起）。
   */
  klineFull(code: string, fq = "qfq", start = "", end = ""): Promise<Row[]> {
    return this.get("/v1/kline-full", { code: normalizeCode(code), fq, start, end });
  }

  /**
   * **IP 白名单**（把 Key 锁定到固定 IP，外泄也用不了）。属 **Unlimited** 档。
   * @param action `get`（查）| `set`（设置，整体替换，配 `ips`）| `clear`（清空）
   * @param ips 仅 `action="set"` 需要 —— IP 列表（数组或逗号分隔，≤50，精确 IPv4/IPv6，⛔ 不支持网段）
   * ⚠️ 设置后**只有名单内的 IP 能调用该 Key**（含本方法自身）⇒ 换网络请把新旧 IP **一起传**。
   */
  ipWhitelist(action = "get", ips: string | string[] = ""): Promise<Record<string, unknown>> {
    if (action === "get") return this.send("/v1/ip-whitelist");
    if (action === "clear") return this.send("/v1/ip-whitelist", {}, "DELETE");
    if (action === "set") {
      const s = Array.isArray(ips) ? ips.join(",") : ips;
      return this.send("/v1/ip-whitelist", { ips: s }, "POST");
    }
    throw new Error(`action 只支持 get / set / clear（当前：${action}）`);
  }

  // ══════════ snake_case 别名（与 Python SDK 方法名一致，零摩擦迁移）══════════

  /** @see {@link klineFull} */
  kline_full(code: string, fq = "qfq", start = "", end = ""): Promise<Row[]> {
    return this.klineFull(code, fq, start, end);
  }

  /** @see {@link ipWhitelist} */
  ip_whitelist(action = "get", ips: string | string[] = ""): Promise<Record<string, unknown>> {
    return this.ipWhitelist(action, ips);
  }

  /** @see {@link backtestBatch} */
  backtest_batch(
    codes: string | string[],
    strategies: string | string[] = "buy_hold",
    opts: { start?: string; end?: string; initial_cash?: number } = {},
  ): Promise<Record<string, unknown>> {
    return this.backtestBatch(codes, strategies, opts);
  }

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
