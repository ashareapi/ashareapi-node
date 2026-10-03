/**
 * 类型定义 —— 与 Python SDK 的返回形态对应：
 *   Python: `pandas.DataFrame`（无 pandas → `list[dict]`）
 *   JS:     `Row[]`（对象数组 —— JS 生态没有 DataFrame 概念，也不强加）
 */

/** 一行数据（字段随端点而定，见 https://ashareapi.com/endpoints） */
export type Row = Record<string, unknown>;

/** 统一信封（所有数据端点） */
export interface Envelope<T = unknown> {
  ok: boolean;
  endpoint?: string;
  tier?: string;
  elapsed_ms?: number;
  source?: string;
  data: T;
  /** 表格类端点的**结构化数组**（无需解析 Markdown） */
  structured?: Row[];
  /** 多表端点（sector / macro / calendar）的全部表 */
  tables?: Row[][];
  error?: string;
}

/** 构造参数 */
export interface AShareAPIOptions {
  /** API Key；不传则读 `process.env.ASHARE_API_KEY`。**免费端点可不传** */
  apiKey?: string;
  /** 服务地址，默认 `https://api.ashareapi.com` */
  baseUrl?: string;
  /** 单请求超时（**毫秒**，默认 30000） */
  timeout?: number;
  /** 429 / 5xx / 网络错误的**重试次数**（默认 3；指数退避 0.5s / 1.5s / 4s） */
  retries?: number;
  /** `true` → 返回**原始信封**（含 `endpoint` / `tier` / `elapsed_ms` / `source`），不取表格 */
  raw?: boolean;
}

/** `/v1/health` —— 字段以线上返回为准 */
export interface HealthResult extends Record<string, unknown> {
  ok?: boolean;
  uptime_s?: number;
  data_ready?: boolean;
  tiers?: Record<string, unknown>;
}

/** `/v1/usage` —— 字段以线上返回为准 */
export type UsageResult = Record<string, unknown>;

/** `/v1/challenge` —— PoW 挑战（匿名提额用） */
export interface ChallengeResult extends Record<string, unknown> {
  challenge?: string;
  difficulty?: number;
  salt?: string;
  expire_at?: number;
  signature?: string;
}

/** 行情快照行（`quote` 的常见字段，其他字段仍可访问） */
export interface QuoteRow extends Row {
  date?: string;
  open?: number | string;
  last?: number | string;
  high?: number | string;
  low?: number | string;
  volume?: number;
  amount?: number;
  /** 换手率（%）—— 与 `/v1/snapshot` 的 `turnover` 同名同值（早期版本曾用名 `exchange`） */
  turnover?: number | string;
}

/** 多段结构里的**一段**（`shareholder` / `calendar`） */
export interface Section {
  /** 中文标题，如 `十大股东` / `财报发布` */
  title?: string;
  /** 英文键，如 `top10_holders` / `financial_report` */
  slug?: string;
  rows: Row[];
}

/**
 * **多段结构**（`shareholder` / `calendar` 的 `data`）
 *
 * ⚠️ 这两个端点的 `data` 是**多段对象**，不是 `Row[]`。
 */
export interface SectionedResult {
  /** 段列表（**保序**） */
  tables: Section[];
  /** `{slug: rows}` 便捷索引 */
  data?: Record<string, Row[]>;
}

/**
 * **表列表**（`finance` 的 `data`）
 *
 * ⚠️ `data` 是 `Row[][]`，不是 `Row[]`
 * （`[0]`=利润表 · `[1]`=资产负债表 · `[2]`=现金流量表，每张表**期次降序**）。
 */
export type TableList = Row[][];
