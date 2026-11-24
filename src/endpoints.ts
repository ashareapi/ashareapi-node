/**
 * 端点方法（**102 个**）—— 签名对齐线上 `/openapi.json`（OpenAPI 3.1.0）
 *
 * 命名：**camelCase 为主**（JS 惯例）+ **snake_case 别名**（让 Python 版用户 / 文档零摩擦迁移）
 *
 * 防漂移：`tests/shape.test.ts` 会拉线上 `/openapi.json` 比对方法名 —— 端点增减即测试红灯。
 */

import { AShareAPIBase } from "./client.js";
import { normalizeCode } from "./code.js";
import type { ChallengeResult, HealthResult, QuoteRow, Row, SectionedResult, TableList, UsageResult } from "./types.js";

/**
 * 选股参数（语义命名，如 `filters: "pe_ttm:0..20,roe_ttm:>=15"`）
 *
 * 可用字段 94 个，用 `screen({ list: "fields" })` 拿清单（带中文名与单位）。
 * 旧字段 `expr` / `orderby` / `desc` / `market` **继续可用**（服务端兼容），但新代码别再用。
 */
export interface ScreenOptions {
  /** 模式：`filter` 条件筛选（默认）/ `pool` 主题池 / `rank` 排行 / `strategy` 策略 / `event` 事件 */
  mode?: "filter" | "pool" | "rank" | "strategy" | "event";
  /** [filter] 条件，逗号分隔＝AND：`"pe_ttm:0..20,roe_ttm:>=15"`（区间含两端，支持 `>=` `<=` `>` `<` `=`） */
  filters?: string;
  /** 排序字段（语义名）：`"roe_ttm"` 降序 / `"-roe_ttm"` 升序 */
  sort?: string;
  /** 股票池：`hs300` / `zz500` / `zz1000` / `sse50` / `sz_component`（不传＝全市场） */
  board?: string;
  /** [rank] 排行指标：`overall` / `capital` / `fundamental` / `risk` / `technical` */
  metric?: string;
  /** [filter] 官方预设名（与 `filters` 二选一），如 `"low_pe"` */
  preset?: string;
  /** [pool] 主题池 / 属性标签取值（见 `list: "pools"`） */
  pool?: string;
  /** [strategy] 策略取值（见 `list: "strategies"`） */
  strategy?: string;
  /** [event] 事件取值（见 `list: "events"`） */
  event?: string;
  /** 返回条数，默认 20；filter 模式无上限（传 9999 一次取全市场） */
  limit?: number;
  /** 跳过前 N 条（仅 pool / rank / strategy / event） */
  offset?: number;
  /** 查询日期 `YYYY-MM-DD`（留空＝最新交易日） */
  date?: string;
  /** [pool/strategy] 区间起始日（须与 `end` 同时给） */
  start?: string;
  /** [pool/strategy] 区间结束日（须与 `start` 同时给） */
  end?: string;
  /** 资产类型（rank 等）；留空＝股票 */
  asset?: string;
  /** 列清单：`true`＝当前模式全部取值；或 `"fields"` / `"boards"` / `"presets"` / `"metrics"` / `"pools"` / `"strategies"` / `"events"` */
  list?: boolean | string;
  /** 响应精简：`true` 时省掉与 `structured` 重复的 `tables`（单表约 −42% 体积） */
  slim?: boolean;
  /** @deprecated 旧参数：等价 `filters` 的原始表达式 */
  expr?: string;
  /** @deprecated 旧参数：等价 `sort`（`desc: false` 时升序） */
  orderby?: string;
  /** @deprecated 旧参数 */
  desc?: boolean;
  /** @deprecated 旧参数：等价 `board` */
  market?: string;
}

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

  /** 最近 30 个交易日的行情（每天一行，降序，`data[0]` 最新）。`code`: `sh600667` / `000001.SZ` / `600667` */
  quote(code: string): Promise<QuoteRow[]> {
    return this.get<QuoteRow[]>("/v1/quote", { code: normalizeCode(code) });
  }

  /** K 线。`period`: `day` | `week` | `month` | `season` | `year` | `m1` | `m5` | `m15` | `m30` | `m60` | `m120`
   *
   * - `start` / `end`: `YYYY-MM-DD`，**仅 `day` 与分钟线支持**（须配对；传了它 `count` 被忽略，
   *   默认取满 1212 条）。港股 / 美股 / 期货 / 外汇不支持。
   *
   * 复权口径**由服务端固定**，没有 `adjust` 参数：日线及以上为**前复权**（除权除息日不跳空），
   * 分钟线为**不复权** —— **不要再自己复权**（会二次复权）。
   * 分钟线（`m*`）属**付费层**且**窗口为近 1 个月**，不支持 北交所 / 期货 / 外汇。
   */
  kline(code: string, period = "day", count = 30, start = "", end = ""): Promise<Row[]> {
    const params: Record<string, unknown> = { code: normalizeCode(code), period, count };
    if (start) params.start = start;
    if (end) params.end = end;
    return this.get("/v1/kline", params);
  }

  /** 分时（当日 / 近 5 日盘中走势）。`days`: `1`（当日，默认）| `5`（近 5 个交易日）
   *
   * 与 {@link kline} 的分钟线**不是一回事**：`kline` 给分钟 **K 线**（OHLC 蜡烛），
   * 本方法是**分时**（每分钟一个价 + 累计量）。
   * 付费层；`days` **只有 1 和 5 两档**（传其他值会按 5 日返回）。
   */
  minute(code: string, days = 1): Promise<Row[]> {
    return this.get("/v1/minute", { code: normalizeCode(code), days });
  }

  /** 全市场热搜榜（数据源榜单上限 50，超出按 50 返回） */
  hot(limit = 30, type = "stock"): Promise<Row[]> {
    return this.get("/v1/hot", { limit, type });
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

  /** 筹码分布 / 成本（套牢盘 / 获利盘比例）
   *
   * - `date`: 交易日 `YYYY-MM-DD`（缺省 = 最新）。**历史仅保留约近 1 年**；更早的日期返回
   *   空结果（`ok:false`，**不扣次数**）。非交易日 / 未来日期会**自动回退**到最近交易日 ——
   *   以返回行的 `date` 字段为准，别假定它等于传入值。
   */
  chip(code: string, date = ""): Promise<Row[]> {
    const params: Record<string, unknown> = { code: normalizeCode(code) };
    if (date) params.date = date;
    return this.get("/v1/chip", params);
  }

  /**
   * 五档盘口 order book（买一~买五 / 卖一~卖五）
   *
   * **秒级快照，盘中才有意义**（收盘后为当日最后快照）；量单位 = **手**（×100 = 股）。
   * 字段沿用行情惯例：`b1_p`/`b1_v` ~ `b5_p`/`b5_v`（买档价格/量）、
   * `a1_p`/`a1_v` ~ `a5_p`/`a5_v`（卖档）。跌停时买档全 0 / 涨停时卖档全 0（正常）。
   */
  orderbook(code: string): Promise<Row[]> {
    return this.get("/v1/orderbook", { code: normalizeCode(code) });
  }

  /**
   * 全字段行情画像（价格 + 盘口 + 估值 + 市值 + 股本 + 涨停跌停价 + 量比 + 振幅 + 涨速）
   *
   * **与 `quote()` 的分工**：`quote()` 轻（8 字段，**免费**）；本方法全（24+ 字段，**付费**）
   * —— **只要现价用 `quote()` 更轻（字段少、响应快）**。
   * **仅 A 股**（港股/美股字段布局不同，用 `quote()`）—— **传其他市场返回空，不返回错数据**。
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
  technical(code: string, date = ""): Promise<Row[]> {
    return this.get("/v1/technical", { code: normalizeCode(code), date });
  }

  /**
   * 因子选股 / 条件筛选。**推荐传对象**（语义参数，见 {@link ScreenOptions}）
   *
   * @example
   * ```ts
   * await cli.screen({ preset: "low_pe", sort: "roe_ttm", limit: 10 });
   * await cli.screen({ filters: "pe_ttm:0..20,roe_ttm:>=15", board: "hs300" });
   * await cli.screen({ mode: "rank", metric: "technical", limit: 50 });
   * await cli.screen({ list: "fields" });   // 94 个可用字段（带中文名与单位）
   * ```
   */
  screen(options?: ScreenOptions): Promise<Row[]>;
  /**
   * @deprecated 位置参数写法（旧签名，仍可用）—— 等价
   * `screen({ expr, preset, limit, orderby, desc, market })`。新代码请传对象。
   */
  screen(
    expr?: string,
    preset?: string,
    limit?: number,
    orderby?: string,
    desc?: boolean,
    market?: string,
  ): Promise<Row[]>;
  screen(
    a: ScreenOptions | string = {},
    preset?: string,
    limit?: number,
    orderby?: string,
    desc?: boolean,
    market?: string,
  ): Promise<Row[]> {
    // 两种写法都收：字符串 = 旧的位置参数（expr 打头），对象 = 新语义参数。
    //    空串 / undefined 由 `toQuery` 跳过，不会拼出 `?expr=` 这种空值。
    const opts: ScreenOptions =
      typeof a === "string" ? { expr: a, preset, limit, orderby, desc, market } : a;
    return this.get("/v1/screen", { ...opts } as Record<string, unknown>);
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
  macro(region = "cn", names = "", limit = 12): Promise<Row[]> {
    return this.get("/v1/macro", { region, names, limit });
  }

  /** 可转债条款（溢价率 / 双低 / 强赎触发 / 评级） */
  bond(code: string): Promise<Row[]> {
    return this.get("/v1/bond", { code: normalizeCode(code) });
  }

  /** ETF 数据。`kind` 选子集：`概览`（默认，行情 / 规模 / 折溢价 / 资金流 / 回撤 / 估值）
   * | `详情`（基金要素 / 费率 / 份额）| `持仓`（成分股及权重）
   * | `净值`（历史**单位净值**，4 位小数）| `公司`（管理人 / 托管人 / 跟踪指数）
   * | `持有人`（户数 / 机构个人占比）| `财务`（股 / 债 / 商品 / 基金占比）
   *
   * - `start` / `end`: 仅 `kind=净值`，`YYYY-MM-DD`，**须配对**
   * - `date`: 仅 `kind=概览` / `kind=持仓`，**历史快照日**（概览＝那天的折溢价/规模/估值百分位；
   *   持仓＝那天的重仓股）。留空＝最新。
   *
   * **单次只查 1 只**：`code` 传逗号会 422（本端点没有批量价），多只请分别调用、每只独立计次。
   * **仅 ETF 代码**：传个股代码返回 `ok:false`（**不扣次数**），不会给全 0 空壳。
   * 代码可传裸 6 位（`510300`）或带前缀（`sh510300`）。
   * `kind=净值` 的 `nav` 是**真实单位净值**，不是收盘价（跨境 / 商品 ETF 两者可能差 10% 以上）。
   * 多表结果（`详情` 3 表 / `公司` 2 表）需 `raw: true` 拿 `tables` 才全。
   * 历史快照边界：**未来日期按最近交易日返回**（看返回的 `date` 列自证）；
   *   **上市前日期回全 0**（会被拦成 `ok:false`）。持仓不传 `date` 是 **Top20**，
   *   传 `date` 是两段（重仓股涨跌 + 申赎清单前 10）。
   */
  etf(code: string, kind = "概览", start = "", end = "", date = ""): Promise<Row[]> {
    const params: Record<string, unknown> = { code: normalizeCode(code), kind };
    if (start) params.start = start;
    if (end) params.end = end;
    if (date) params.date = date;
    return this.get("/v1/etf", params);
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
  //   这几个端点属**付费层**（均为**专业版**起），且计入**重型日额度**。

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
   * 上限：标的 ≤ 20 · 策略 ≤ 10 · 组合 ≤ 60（超限直接报错，不静默截断）。属 **pro** 档。
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
   * 量化因子库（87 因子 + 50 筛选入口 + 22 预设）。不占重型额度。
   * `category` / `kind` **只接受中文枚举值**：
   * `估值`/`行情`/`盈利`/`资产负债`/`现金流`；`排行`/`标签`/`事件`。
   */
  factors(category = "", kind = ""): Promise<Record<string, unknown>> {
    return this.get("/v1/factors", { category, kind });
  }

  /** 量化方法论库（25 条「怎么判断市场」流程，含判据 / 阶段 / 依据）。不占重型额度。 */
  playbooks(category = "", id = ""): Promise<Record<string, unknown>> {
    return this.get("/v1/playbooks", { category, id });
  }

  /**
   * **全历史**日线一次拿全（约 2,500 根 · 2016-08-08 起），是 {@link kline} 的超集。
   * @param fq `qfq` 前复权（默认，画图用）| `hfq` 后复权（**回测用** —— 历史不随未来分红变化，可复现）| `nofq` 不复权
   * @param start 起始日期 `YYYY-MM-DD`（可省略；与 `end` 配对）
   * @param end 结束日期 `YYYY-MM-DD`（可省略）
   * **仅 A 股个股**；ETF / 可转债 / 指数 / 板块 / 港美股 / 期货 / 外汇用 {@link kline}。属**付费层**（standard 起）。
   */
  klineFull(code: string, fq = "qfq", start = "", end = ""): Promise<Row[]> {
    return this.get("/v1/kline-full", { code: normalizeCode(code), fq, start, end });
  }

  /**
   * **IP 白名单**（把 Key 锁定到固定 IP，外泄也用不了）。属 **Unlimited** 档。
   * @param action `get`（查）| `set`（设置，整体替换，配 `ips`）| `clear`（清空）
   * @param ips 仅 `action="set"` 需要 —— IP 列表（数组或逗号分隔，≤50，精确 IPv4/IPv6，不支持网段）
   * 设置后**只有名单内的 IP 能调用该 Key**（含本方法自身）⇒ 换网络请把新旧 IP **一起传**。
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

  // ══════════ 短线打板（standard 起；auction 需 pro）══════════

  /**
   * **集合竞价**（个股 9:15–9:25）。
   * @param mode `stock` 当日竞价分时（默认）| `stock-history` 历史**秒级**分时（配 `date`）| `volume` 当日竞价量/净额
   * 顶层含**「竞价触及涨停」判定**与 `up_px` / `down_px` / `open_px`。
   * `mode=stock` **仅当日**；查历史用 `stock-history` + `date`（须真实交易日）。
   */
  auction(code: string, mode = "stock", date = ""): Promise<Row[]> {
    return this.get("/v1/auction", { code: normalizeCode(code), mode, date });
  }

  /**
   * **打板（涨停池明细）**：当日全部涨停股 + **涨停原因** + 资金面。
   * @param mode `limit`（涨停池明细，默认）
   * 字段含 `streak` 连板数 / `reason` 涨停原因 / `seal_amount` 封单额 / `main_net` 主力净额 / `turnover` 换手%。
   * `date` = 取该交易日历史；留空 = 实时。
   */
  limitUp(mode = "limit", date = ""): Promise<Row[]> {
    return this.get("/v1/limit-up", { mode, date });
  }

  /**
   * **短线复盘（涨停结构）**。
   * @param mode `board` 板块主线（默认）| `ladder` 连板梯队
   * `board` = 当日涨停最集中的题材（`limit_count` / `amount` / `stocks`）；
   * `ladder` = 按连板高度分组的涨停个股（`streak` / `market_cap` / `tips` 如「7天4板」）。
   */
  review(mode = "board", date = ""): Promise<Row[]> {
    return this.get("/v1/review", { mode, date });
  }

  /**
   * **监管异动 / 偏离值**（短线风控关键信号）。
   * @param mode `deviation` 偏离值热门榜（今日实时，默认）| `deviation_hist`（配 `date`）| `deviation_plan`（今日+明日）| `abnormal`（频率）
   * @param limit 1–2000（默认 600）
   * 字段含 `reason` 规则 / `pct` / `turnover` / `board_desc` 连板 / `concepts`。
   */
  abnormal(mode = "deviation", date = "", limit = 600): Promise<Row[]> {
    return this.get("/v1/abnormal", { mode, date, limit });
  }

  // ══════════ 全市场 / 批量（pro 起）══════════

  /**
   * **全市场单日 K 线**：一次返回某交易日全 A 股（5000+ 只）的日线。
   * @param date 交易日 `YYYY-MM-DD`（**必填**）
   * @param limit 分页条数（0 = 全部） · @param offset 分页偏移 · @param codes 只取指定股票（逗号分隔）
   * **仅 pro / unlimited**；**1 次调用折算 500 次额度**；日额度 pro 200 / unlimited 1000。
   * 仅 A 股股票（5572 只 · 2016-08-08 起）· **不复权原始价**；最新到**前一交易日**。
   */
  marketKline(date: string, limit = 0, offset = 0, codes = ""): Promise<Row[]> {
    return this.get("/v1/market-kline", { date, limit, offset, codes });
  }

  /**
   * **批量资金流**：一次拿多只股票的资金流（主力资金 + 龙虎榜 + 大宗 + 两融），每只一条。
   * @param codes 股票代码（数组或**逗号分隔**字符串，如 `"sh600519,sz000001"`）
   * **仅 pro / unlimited**；单次上限 pro **200** / unlimited **1000**；**计费按实际返回只数**（失败的**不计**）。
   */
  fundBatch(codes: string | string[]): Promise<Row[]> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get("/v1/fund-batch", { codes: cs });
  }

  // ══════════ 资讯 / 公告（standard 起）══════════

  /**
   * **个股 / 指数 / ETF / 板块 / 转债资讯**。不传 `id` ⇒ 列表（`code` 必填）；传 `id` ⇒ 该条**完整正文**（干净 Markdown）。
   * 列表**只有最新 N 条**（无翻页/历史）；要历史用 {@link notice}。
   * 列表里的 `url` 指向动态页、**抓不到正文** ⇒ 要正文必须用 `id`。
   */
  news(code = "", id = "", limit = 50, type = ""): Promise<Row[]> {
    return this.get("/v1/news", { code: normalizeCode(code), id, limit, type });
  }

  /**
   * **上市公司公告**。不传 `id` ⇒ 列表（`code` 必填，可翻页，回溯约 **16 年**）；传 `id` ⇒ 详情。
   * 详情两种形态：多数 ⇒ `text` = 正文；少数（长报告）⇒ `text` 空、`url` = **PDF 链接** ⇒ 先看 `text` 有没有值。
   */
  notice(code = "", id = "", type = "", limit = 50, offset = 0): Promise<Row[]> {
    return this.get("/v1/notice", { code: normalizeCode(code), id, type, limit, offset });
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

  /** @see {@link limitUp} */
  limit_up(mode = "limit", date = ""): Promise<Row[]> {
    return this.limitUp(mode, date);
  }

  /** @see {@link marketKline} */
  market_kline(date: string, limit = 0, offset = 0, codes = ""): Promise<Row[]> {
    return this.marketKline(date, limit, offset, codes);
  }

  /** @see {@link fundBatch} */
  fund_batch(codes: string | string[]): Promise<Row[]> {
    return this.fundBatch(codes);
  }
  /** OpenAI / Anthropic 兼容模型清单（免费） */
  models(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>("/v1/models", {});
  }

  /** 交易日历（开市/休市 · 年末最后交易日） */
  tradeCalendar(date = "", start = "", end = "", year = "", trading_only = false, limit = 0, offset = 0): Promise<Row[]> {
    return this.get<Row[]>("/v1/trade-calendar", { date: date, start: start, end: end, year: year, trading_only: trading_only, limit: limit, offset: offset });
  }
  /** @see {@link tradeCalendar} */
  trade_calendar(date = "", start = "", end = "", year = "", trading_only = false, limit = 0, offset = 0): Promise<Row[]> {
    return this.tradeCalendar(date, start, end, year, trading_only, limit, offset);
  }

  /** 自然语言受控检索（带证据链 · 供开发者编排） */
  agentSearch(q: string, scope = "", depth = "fast", max_results = 10, clarify = false, claim = "", replay = false, authority_min = 0.0, recency = ""): Promise<Row[]> {
    return this.get<Row[]>("/v1/agent-search", { q: q, scope: scope, depth: depth, max_results: max_results, clarify: clarify, claim: claim, replay: replay, authority_min: authority_min, recency: recency });
  }
  /** @see {@link agentSearch} */
  agent_search(q: string, scope = "", depth = "fast", max_results = 10, clarify = false, claim = "", replay = false, authority_min = 0.0, recency = ""): Promise<Row[]> {
    return this.agentSearch(q, scope, depth, max_results, clarify, claim, replay, authority_min, recency);
  }

  /** 自然语言问答（带内联引用 · BYOK：用你自己的模型 key） */
  agentAsk(q: string, scope = "", max_results = 10, recency = ""): Promise<Row[]> {
    return this.send<Row[]>("/v1/agent-ask", { q: q, scope: scope, max_results: max_results, recency: recency }, "POST");
  }
  /** @see {@link agentAsk} */
  agent_ask(q: string, scope = "", max_results = 10, recency = ""): Promise<Row[]> {
    return this.agentAsk(q, scope, max_results, recency);
  }

  /** Anthropic Messages 协议（Claude Code / Anthropic SDK · BYOK） */
  messages(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.send<Record<string, unknown>>("/v1/messages", {}, "POST", payload);
  }

  /** 自选股（列表 / 添加 / 删除） */
  watchlist(action = "list", code = "", codes: string | string[] = "", listName = "", name = "", note = "", tags = ""): Promise<Row[]> {
    const _c = normalizeCode(code);
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get<Row[]>("/v1/watchlist", { action: action, code: _c, codes: cs, list: listName, name: name, note: note, tags: tags });
  }

  /** 自选股导入（CSV / JSON） */
  watchlistImport(payload: Record<string, unknown>): Promise<Row[]> {
    return this.send<Row[]>("/v1/watchlist", {}, "POST", payload);
  }

  /** 自选股批量行情 */
  watchlistQuotes(listName = ""): Promise<Row[]> {
    return this.get<Row[]>("/v1/watchlist/quotes", { list: listName });
  }
  /** @see {@link watchlistQuotes} */
  watchlist_quotes(listName = ""): Promise<Row[]> {
    return this.watchlistQuotes(listName);
  }

  /** 选股员快照（按 Key 隔离 · 含前向收益汇总） */
  scannerSnapshots(limit = 20): Promise<Row[]> {
    return this.get<Row[]>("/v1/scanner/snapshots", { limit: limit });
  }
  /** @see {@link scannerSnapshots} */
  scanner_snapshots(limit = 20): Promise<Row[]> {
    return this.scannerSnapshots(limit);
  }

  /** 选股员（scanner Agent · 条件选股 · 证据链 · 工具轨迹 · 专业版起） */
  scanner(q: string): Promise<Row[]> {
    return this.get<Row[]>("/v1/scanner", { q: q });
  }

  /** 复盘分析师（读 scanner 快照 · 不选股 · 不预测） */
  analyst(snapshot_id: string, focus = "overall", horizon = ""): Promise<Row[]> {
    return this.get<Row[]>("/v1/analyst", { snapshot_id: snapshot_id, focus: focus, horizon: horizon });
  }

  /** OpenAI Chat Completions 协议（OpenAI SDK / 通用客户端 · BYOK） */
  chatCompletions(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.send<Record<string, unknown>>("/v1/chat/completions", {}, "POST", payload);
  }

  /** OpenAI Responses API（Codex / openai SDK 2.x · BYOK） */
  responses(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.send<Record<string, unknown>>("/v1/responses", {}, "POST", payload);
  }

  /** 异步研究任务（提交 · 带引用报告 · BYOK） */
  agentResearch(q: string, depth = "standard"): Promise<Row[]> {
    return this.send<Row[]>("/v1/agent-research", { q: q, depth: depth }, "POST");
  }
  /** 查研究任务（进度 / 报告）。`taskId` 来自 {@link agentResearch} 的返回 */
  agentResearchStatus(taskId: string): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>(`/v1/agent-research/${taskId}`, {});
  }
  /** @see {@link agentResearchStatus} */
  agent_research_status(taskId: string): Promise<Record<string, unknown>> {
    return this.agentResearchStatus(taskId);
  }

  /** @see {@link agentResearch} */
  agent_research(q: string, depth = "standard"): Promise<Row[]> {
    return this.agentResearch(q, depth);
  }

  /** 外盘期货实时快照（买卖价 / 结算价 / 持仓变化 / 到期日） */
  futures(code: string): Promise<Row[]> {
    return this.get<Row[]>("/v1/futures", { code: code });
  }

  /** 外汇现货实时报价（买一卖一 / 涨跌幅 / 市场状态） */
  forex(code: string): Promise<Row[]> {
    return this.get<Row[]>("/v1/forex", { code: code });
  }

  /** 批量财务报表（多只一次取） */
  financeBatch(codes: string | string[], periods = 4, type = "", fields = "all"): Promise<Row[]> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get<Row[]>("/v1/finance-batch", { codes: cs, periods: periods, type: type, fields: fields });
  }
  /** @see {@link financeBatch} */
  finance_batch(codes: string | string[], periods = 4, type = "", fields = "all"): Promise<Row[]> {
    return this.financeBatch(codes, periods, type, fields);
  }

  /** 批量技术指标（多只一次取 · 55 项） */
  technicalBatch(codes: string | string[], date = ""): Promise<Row[]> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get<Row[]>("/v1/technical-batch", { codes: cs, date: date });
  }
  /** @see {@link technicalBatch} */
  technical_batch(codes: string | string[], date = ""): Promise<Row[]> {
    return this.technicalBatch(codes, date);
  }

  /** 批量行情（多只一次取） */
  quoteBatch(codes: string | string[], period = "day", count = 1, start = "", end = ""): Promise<Row[]> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get<Row[]>("/v1/quote-batch", { codes: cs, period: period, count: count, start: start, end: end });
  }
  /** @see {@link quoteBatch} */
  quote_batch(codes: string | string[], period = "day", count = 1, start = "", end = ""): Promise<Row[]> {
    return this.quoteBatch(codes, period, count, start, end);
  }

  /** 批量 K 线（多只一次取） */
  klineBatch(codes: string | string[], period = "day", count = 30, start = "", end = "", fq = ""): Promise<Row[]> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get<Row[]>("/v1/kline-batch", { codes: cs, period: period, count: count, start: start, end: end, fq: fq });
  }
  /** @see {@link klineBatch} */
  kline_batch(codes: string | string[], period = "day", count = 30, start = "", end = "", fq = ""): Promise<Row[]> {
    return this.klineBatch(codes, period, count, start, end, fq);
  }

  /** 批量全字段画像（多只一次取） */
  snapshotBatch(codes: string | string[]): Promise<Row[]> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get<Row[]>("/v1/snapshot-batch", { codes: cs });
  }
  /** @see {@link snapshotBatch} */
  snapshot_batch(codes: string | string[]): Promise<Row[]> {
    return this.snapshotBatch(codes);
  }

  /** 批量公司简况（多只一次取） */
  profileBatch(codes: string | string[]): Promise<Row[]> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get<Row[]>("/v1/profile-batch", { codes: cs });
  }
  /** @see {@link profileBatch} */
  profile_batch(codes: string | string[]): Promise<Row[]> {
    return this.profileBatch(codes);
  }

  /** 批量筹码分布（多只一次取） */
  chipBatch(codes: string | string[], date = ""): Promise<Row[]> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get<Row[]>("/v1/chip-batch", { codes: cs, date: date });
  }
  /** @see {@link chipBatch} */
  chip_batch(codes: string | string[], date = ""): Promise<Row[]> {
    return this.chipBatch(codes, date);
  }

  /** 批量股东研究（多只一次取） */
  shareholderBatch(codes: string | string[]): Promise<Row[]> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get<Row[]>("/v1/shareholder-batch", { codes: cs });
  }
  /** @see {@link shareholderBatch} */
  shareholder_batch(codes: string | string[]): Promise<Row[]> {
    return this.shareholderBatch(codes);
  }

  /** L2 大单净额分时（分钟级 · 机构版专属） */
  bigorder(code: string): Promise<Row[]> {
    const _c = normalizeCode(code);
    return this.get<Row[]>("/v1/bigorder", { code: _c });
  }

  /** L2 大单成交明细（含主动/被动拆分 · 机构版专属） */
  bigorderFlow(code: string, money = 0, limit = 100, offset = 0): Promise<Row[]> {
    const _c = normalizeCode(code);
    return this.get<Row[]>("/v1/bigorder-flow", { code: _c, money: money, limit: limit, offset: offset });
  }
  /** @see {@link bigorderFlow} */
  bigorder_flow(code: string, money = 0, limit = 100, offset = 0): Promise<Row[]> {
    return this.bigorderFlow(code, money, limit, offset);
  }

  /** L2 大单成交·全天完整（含主动/被动拆分 · 机构版专属） */
  bigorderFlowFull(code: string, money = 0, max_rows = 6000): Promise<Row[]> {
    const _c = normalizeCode(code);
    return this.get<Row[]>("/v1/bigorder-flow-full", { code: _c, money: money, max_rows: max_rows });
  }
  /** @see {@link bigorderFlowFull} */
  bigorder_flow_full(code: string, money = 0, max_rows = 6000): Promise<Row[]> {
    return this.bigorderFlowFull(code, money, max_rows);
  }

  /** L2 大单委托流（挂单 + 撤单标记 · 机构版专属） */
  bigorderQueue(code: string, vol = 500, tur = 30, limit = 100): Promise<Row[]> {
    const _c = normalizeCode(code);
    return this.get<Row[]>("/v1/bigorder-queue", { code: _c, vol: vol, tur: tur, limit: limit });
  }
  /** @see {@link bigorderQueue} */
  bigorder_queue(code: string, vol = 500, tur = 30, limit = 100): Promise<Row[]> {
    return this.bigorderQueue(code, vol, tur, limit);
  }

  /** L2 历史大单净额（逐日 · 最多 100 个交易日 · 机构版专属） */
  bigorderHistory(code: string, limit = 100): Promise<Row[]> {
    const _c = normalizeCode(code);
    return this.get<Row[]>("/v1/bigorder-history", { code: _c, limit: limit });
  }
  /** @see {@link bigorderHistory} */
  bigorder_history(code: string, limit = 100): Promise<Row[]> {
    return this.bigorderHistory(code, limit);
  }

  /** L2 主力四分解（分钟级 · 主动/被动 × 买/卖 · 机构版专属） */
  bigorderSplit(code: string, date = ""): Promise<Row[]> {
    const _c = normalizeCode(code);
    return this.get<Row[]>("/v1/bigorder-split", { code: _c, date: date });
  }
  /** @see {@link bigorderSplit} */
  bigorder_split(code: string, date = ""): Promise<Row[]> {
    return this.bigorderSplit(code, date);
  }

  /** L2 全市场主力净额榜（5568 只 · 8 种排序 · 机构版专属） */
  bigorderRank(sort = "net_in", limit = 100, offset = 0, date = ""): Promise<Row[]> {
    return this.get<Row[]>("/v1/bigorder-rank", { sort: sort, limit: limit, offset: offset, date: date });
  }
  /** @see {@link bigorderRank} */
  bigorder_rank(sort = "net_in", limit = 100, offset = 0, date = ""): Promise<Row[]> {
    return this.bigorderRank(sort, limit, offset, date);
  }

  /** 龙虎榜席位明细（营业部 · 游资标记 · 机构版专属） */
  lhbSeats(code: string, date = ""): Promise<Row[]> {
    const _c = normalizeCode(code);
    return this.get<Row[]>("/v1/lhb-seats", { code: _c, date: date });
  }
  /** @see {@link lhbSeats} */
  lhb_seats(code: string, date = ""): Promise<Row[]> {
    return this.lhbSeats(code, date);
  }

  /** 龙虎榜机构参与个股榜（全市场 · 机构买入/卖出 · 机构版专属） */
  lhbAgency(date = "", sort = "net_buy", limit = 100): Promise<Row[]> {
    return this.get<Row[]>("/v1/lhb-agency", { date: date, sort: sort, limit: limit });
  }
  /** @see {@link lhbAgency} */
  lhb_agency(date = "", sort = "net_buy", limit = 100): Promise<Row[]> {
    return this.lhbAgency(date, sort, limit);
  }

  /** 市场情绪（破板率 + 赚钱效应 9 日趋势） */
  marketMood(date = ""): Promise<Row[]> {
    return this.get<Row[]>("/v1/market-mood", { date: date });
  }
  /** @see {@link marketMood} */
  market_mood(date = ""): Promise<Row[]> {
    return this.marketMood(date);
  }

  /** 涨停原因（某只票的历史涨停记录 + 完整原因文案） */
  limitReason(code: string, date = "", limit = 20): Promise<Row[]> {
    const _c = normalizeCode(code);
    return this.get<Row[]>("/v1/limit-reason", { code: _c, date: date, limit: limit });
  }
  /** @see {@link limitReason} */
  limit_reason(code: string, date = "", limit = 20): Promise<Row[]> {
    return this.limitReason(code, date, limit);
  }

  /** 炸板历史（某日炸板股清单 + 概念） */
  brokenBoard(date = "", limit = 100): Promise<Row[]> {
    return this.get<Row[]>("/v1/broken-board", { date: date, limit: limit });
  }
  /** @see {@link brokenBoard} */
  broken_board(date = "", limit = 100): Promise<Row[]> {
    return this.brokenBoard(date, limit);
  }

  /** 尾盘抢筹（全市场 · 抢筹金额榜） */
  tailChase(limit = 300, sort = "chase_amount"): Promise<Row[]> {
    return this.get<Row[]>("/v1/tail-chase", { limit: limit, sort: sort });
  }
  /** @see {@link tailChase} */
  tail_chase(limit = 300, sort = "chase_amount"): Promise<Row[]> {
    return this.tailChase(limit, sort);
  }

  /** A 股北向资金分板块持仓（季度） */
  northbound(date = "", limit = 50): Promise<Row[]> {
    return this.get<Row[]>("/v1/northbound", { date: date, limit: limit });
  }

  /** 百日新高（按题材汇总） */
  newHigh(date = "", limit = 50): Promise<Row[]> {
    return this.get<Row[]>("/v1/new-high", { date: date, limit: limit });
  }
  /** @see {@link newHigh} */
  new_high(date = "", limit = 50): Promise<Row[]> {
    return this.newHigh(date, limit);
  }

  /** 7×24 财经快讯（全市场电报） */
  flash(limit = 50, index = 0): Promise<Row[]> {
    return this.get<Row[]>("/v1/flash", { limit: limit, index: index });
  }

  /** 财经多源取证（公告 + 资讯 · 带证据指纹） */
  evidence(q: string, scope = "notice,news", limit = 10): Promise<Row[]> {
    return this.get<Row[]>("/v1/evidence", { q: q, scope: scope, limit: limit });
  }

  /** 指数成分股（沪深300 等 · 全量清单） */
  indexConstituent(code: string): Promise<Row[]> {
    const _c = normalizeCode(code);
    return this.get<Row[]>("/v1/index-constituent", { code: _c });
  }
  /** @see {@link indexConstituent} */
  index_constituent(code: string): Promise<Row[]> {
    return this.indexConstituent(code);
  }

  /** 停复牌列表（沪深 / 港股 / 美股） */
  suspension(market = "沪深"): Promise<Row[]> {
    return this.get<Row[]>("/v1/suspension", { market: market });
  }

  /** 公司回购（A股 / 港股） */
  buyback(code: string, start = "", end = ""): Promise<Row[]> {
    const _c = normalizeCode(code);
    return this.get<Row[]>("/v1/buyback", { code: _c, start: start, end: end });
  }

  /** 一致预期（目标价 + 未来盈利预测） */
  consensus(codes: string | string[]): Promise<Row[]> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get<Row[]>("/v1/consensus", { codes: cs });
  }

  /** 机构评级（港股 / 美股 · 目标价 + 评级分布） */
  rating(codes: string | string[]): Promise<Row[]> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get<Row[]>("/v1/rating", { codes: cs });
  }

  /** 财报披露日历（业绩预约披露日） */
  disclosure(codes: string | string[]): Promise<Row[]> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get<Row[]>("/v1/disclosure", { codes: cs });
  }

  /** 个股资金流向（A股 / 港股；沪深支持历史区间） */
  fundFlow(code: string, start = "", end = ""): Promise<Row[]> {
    const _c = normalizeCode(code);
    return this.get<Row[]>("/v1/fund-flow", { code: _c, start: start, end: end });
  }
  /** @see {@link fundFlow} */
  fund_flow(code: string, start = "", end = ""): Promise<Row[]> {
    return this.fundFlow(code, start, end);
  }

  /** 卖空数据（港股 / 美股） */
  fundShort(code: string, date = ""): Promise<Row[]> {
    const _c = normalizeCode(code);
    return this.get<Row[]>("/v1/fund-short", { code: _c, date: date });
  }
  /** @see {@link fundShort} */
  fund_short(code: string, date = ""): Promise<Row[]> {
    return this.fundShort(code, date);
  }

  /** 南下资金持仓（港股通 · 季度） */
  fundSouth(codes: string | string[], date = ""): Promise<Row[]> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get<Row[]>("/v1/fund-south", { codes: cs, date: date });
  }
  /** @see {@link fundSouth} */
  fund_south(codes: string | string[], date = ""): Promise<Row[]> {
    return this.fundSouth(codes, date);
  }

  /** 指数清单（1223 个 · 含港股指数） */
  indexList(limit = 50, offset = 0, date = ""): Promise<Row[]> {
    return this.get<Row[]>("/v1/index-list", { limit: limit, offset: offset, date: date });
  }
  /** @see {@link indexList} */
  index_list(limit = 50, offset = 0, date = ""): Promise<Row[]> {
    return this.indexList(limit, offset, date);
  }

  /** 股票评分（五维 · 含周月季变动） */
  score(codes: string | string[], date = ""): Promise<Row[]> {
    const cs = Array.isArray(codes) ? codes.join(",") : codes;
    return this.get<Row[]>("/v1/score", { codes: cs, date: date });
  }

  /** 研报（列表 / 全文） */
  report(code = "", id = "", limit = 20, offset = 0): Promise<Row[]> {
    const _c = normalizeCode(code);
    return this.get<Row[]>("/v1/report", { code: _c, id: id, limit: limit, offset: offset });
  }

  /** 全市场股票清单（代码 / 名称 / 上市日期 / 行业） */
  stocks(market = "", industry = "", limit = 0, offset = 0): Promise<Row[]> {
    return this.get<Row[]>("/v1/stocks", { market: market, industry: industry, limit: limit, offset: offset });
  }
}
