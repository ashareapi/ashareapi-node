# Changelog

This package follows [Semantic Versioning](https://semver.org/): **minor** = new endpoints/methods, **patch** = bug fixes / docs.

> The endpoints themselves are **always current** (the server evolves; no SDK upgrade needed) — upgrading the SDK is only about **getting the convenience methods for new endpoints**.
> Full endpoint list and field semantics: <https://ashareapi.com/endpoints>

---

## [0.3.1] — 2026-11-24

### ✨ Every endpoint now has a method: 102 / 102

- **54 new methods**: batches (9: `financeBatch` / `quoteBatch` / `klineBatch` / `snapshotBatch` /
  `profileBatch` / `chipBatch` / `shareholderBatch` / `technicalBatch` / `fundBatch`), L2 order flow (7),
  dragon-tiger board (2), sentiment & event boards (7), AI Agent (8), protocol-compatible (3),
  watchlist (3), futures / forex (2), and the rest (14). Each comes with a `snake_case` alias.
- **New**: `request()` / `send()` accept a JSON body — the protocol endpoints (`messages` /
  `chatCompletions` / `responses`) need it; previously only query params were supported.
- Coverage: **102 / 102** except `/v1/wiki` (doc search, not a data endpoint).

### ✨ `screen()` now takes semantic options — no more datasource field codes

- **New**: `screen({ filters, sort, board, mode, metric, limit, … })`
  - `filters: "pe_ttm:0..20,roe_ttm:>=15"` — comma = AND, ranges `0..20` (both ends inclusive),
    operators `>=` `<=` `>` `<` `=`. Get the **94 available fields** with
    `screen({ list: "fields" })` (Chinese labels + units included).
  - `sort: "roe_ttm"` (descending) / `sort: "-roe_ttm"` (ascending) — replaces `orderby` + `desc`.
  - `board: "hs300" | "zz500" | "zz1000" | "sse50" | "sz_component"` — omit for the whole market.
  - `mode: "filter" | "pool" | "rank" | "strategy" | "event"` (default `filter`).
  - `metric` for `mode: "rank"`; `list:` also accepts `"pools"` / `"strategies"` / `"events"` /
    `"boards"` / `"presets"` / `"metrics"` to enumerate valid values.
- **Backward compatible** — the old positional form `screen(expr, preset, limit, orderby, desc, market)`
  still works (now marked `@deprecated`). **No code changes required.**
- **Better errors** — an invalid parameter now returns HTTP 422 with the allowed values and a one-line
  hint, instead of a raw datasource message.
- **`trace_id`** — every response carries a request id; quote it in a bug report and we can trace it.

### Fixed: 4xx errors were returned as if they were successful data (silent, 2026-10-19)
- **Symptom**: methods such as `kline()` resolved with an **error object instead of rows**, so the caller's
  table conversion blew up (Python: `ValueError: If using all scalar values, you must pass an index`).
- **Root cause**: the request layer only handled `401` / `429` / `5xx`; **every other 4xx fell through to
  "return the response body"** ⇒ the caller received the server's *error* payload
  (`{"error": "…", "min_tier": "standard"}`, no `data` field) as a normal success value — **swallowing the
  server's explanation too**.
- **Three ways to hit it** (none is a network problem — the *request* must change):
  | Status | Trigger | Server message (previously swallowed) |
  |---|---|---|
  | `413` | `/v1/kline` with `codes × count` > 60,000 (e.g. 200 codes × 1212) | split the codes or lower `count` |
  | `403` | minute bars (`period=m1…m120`) on a tier below Standard | minute bars need Standard — daily/weekly/monthly stay free |
  | `422` | > 5 codes anonymously / illegal `period` | get an API key / unsupported period |
- **Now**: every 4xx **throws** (`403` → `AuthError`; others → `APIError`) with the server's own message attached;
  4xx is **never retried** (retrying is pointless and only multiplies requests). The `401` message also now
  carries the server's explanation (it used to be a fixed "check ASHARE_API_KEY", which mislabelled
  "this endpoint is paid" as "your key is broken").
- Regression test: `tests/client.test.ts`.

### Pacing hint (new · **does not change call behaviour**)
- **Too-frequent polling hint**: when calling **anonymously** (no key) less than **12 seconds** after the previous call,
  `console.warn` fires **once**: "anonymous tier is 5 req/min — poll at ≥12s; solving one PoW challenge raises it to
  15 req/min (≈ ≥4s); with an API key the Standard tier allows 120 req/min".
  **Warn only — no delay, no blocking.** The SDK never silently changes your call cadence.
- Background: the anonymous tier allows 5 req/min, so anything under 12s will hit 429. **~93% of today's 429s came from
  just two polling IPs** — one of them an **older version of this SDK**.

### Added methods (filling in previously missing endpoints)
- `auction()` — call auction (intraday / second-level history / auction volume; includes the **"touched limit-up during auction"** flag)
- `limitUp()` — limit-up pool detail (with **reason** + money flow)
- `review()` — short-term review (sector leadership / streak ladder)
- `abnormal()` — regulatory abnormal moves / deviation
- `marketKline()` — whole-market daily K-line (5000+ stocks in one call; **pro+**, 1 call = 500 quota)
- `fundBatch()` — batch money flow (**pro+**; up to 200 / 1000 codes, billed per returned code)
- `news()` — stock news (no `id` = list / with `id` = full article)
- `notice()` — filings (paged list, ~16 years of history / detail)

### Endpoint parameters (following the server)
- **`etf(code, kind = "概览", start = "", end = "")`** — new `kind` selector:
  `概览` (default, **identical** to the previous behaviour) | `详情` (fund facts / fees / shares) |
  `持仓` (constituents and weights) | `净值` (historical **unit NAV**, 4 decimals, **requires both `start` and `end`**) |
  `公司` (manager / custodian / tracked index) | `持有人` (holder accounts / institutional vs retail) |
  `财务` (stock / bond / commodity / fund allocation).
- **`chip(code, date = "")`** — new `date` for historical chip data (`YYYY-MM-DD`, defaults to the latest session).
  History is retained for **roughly the last year only** (earlier dates return empty ⇒ `ok:false`, **no quota consumed**);
  non-trading days / future dates **fall back** to the most recent trading day — always read the returned row's `date`.
- **Backward compatible**: without the new parameters both methods send and receive exactly what `0.2.0` did.
- `/v1/etf` **accepts ETF codes only**: an equity code returns `ok:false` (**no quota consumed**) instead of an all-zero shell.
- `kind=净值`'s `nav` is the **real unit NAV**, not the closing price (cross-border / commodity ETFs can differ by >10%).
- Multi-table results (`详情` = 3 tables / `公司` = 2 tables) need `raw: true` to get every table in `tables`.

### Fixed
- **429 retry bug**: the old code blindly retried 429 (0.5s / 1.5s / 4s ≈ 6.5s) while the server returns `Retry-After: 60` (per-minute window) ⇒ retries **always hit 429 again** and amplified **1 call into 3 requests**. It now **honours `Retry-After`**: if the required wait is > 5s it **does not retry** and throws `RateLimitError` immediately (short waits still sleep-and-retry).
- `/v1/wiki` (doc search) has no SDK method — it documents field semantics for AI Agents, not a data endpoint.

## [0.2.0] — 2026-10-08

### Added (minor) — Quant
- **`backtest(opts)`** — quant backtest (`/v1/backtest`). `mode` is `single` (one stock, live, pass `code`) or `portfolio` (precomputed preset ranges).
  `weighting: "inv_vol"` sizes positions by **inverse volatility**; portfolio mode only, **Unlimited tier**.
- **`backtestBatch(codes, strategies, opts)`** — batch backtest (`/v1/backtest-batch`): many stocks × many strategies in one call, returning a comparison matrix.
  `codes` / `strategies` accept **arrays**. Limits: ≤20 stocks · ≤10 strategies · ≤60 combinations. **Pro tier**.
- **`strategies()`** — quant strategy list (20 single-stock + 9 portfolio, with parameter ranges).
- **`factors(category, kind)`** — quant factor library (88 factors + 50 screening shortcuts + 22 presets). `category` / `kind` accept **Chinese enum values only**.
- **`playbooks(category, id)`** — quant playbook library (13 "how to judge the market" workflows with signals, stages and measured evidence).

### Added (minor) — Other
- **`klineFull(code, fq)`** — **full-history** daily bars in one call (the full series since 2016-08-08). `fq` is `qfq` (default) / `hfq` (**for backtests**) / `nofq`. Paid tier.
- **`ipWhitelist(action, ips)`** — **IP allow-list**. `action` is `get` / `set` / `clear`. **Unlimited tier**.

### Under the hood
- `request()` now supports **POST / DELETE**; added a `send()` unwrap helper (used by `ipWhitelist`).

## [0.1.11] — 2026-10-06

### Added (minor)
- **`minute(code, days = 1)`** — new **intraday tick chart** method (today / last 5 sessions, endpoint `/v1/minute`).
  Not the same as `kline`'s minute bars: `kline` returns minute **candles** (OHLC); `minute` returns the **tick chart** (one price per minute plus cumulative volume).
  Paid tier; `days` only accepts **`1` and `5`**.
- **`kline()` now supports minute bars and date ranges**: `period` gains `season` / `year` / `m1` / `m5` / `m15` / `m30` / `m60` / `m120`; new `start` / `end` parameters (only for `day` and minute bars; must be paired). Minute bars are paid-tier and cover roughly the last month.

### Docs / comments (patch)
- **PoW free-tier raise adjusted**: solving one PoW challenge now raises the anonymous rate to **15/min** (was 60/min); the 429 message was updated to match.
- **Endpoint total 32 → 33** (after adding `/v1/minute`); the counts in the README were updated to match.

---

## [0.1.10] — 2026-10-03

### Docs / comments (patch)
- **Clearer 429 guidance**: the message now states the anonymous limits (**250 rows** per request, **100,000 rows** per day) and distinguishes the two cases — **per-minute rate** exceeded (solve one PoW challenge for a higher rate) vs **daily row quota** exhausted (PoW does **not** help; wait for the next day or use a key).

> Runtime behaviour is identical to `0.1.9` — comments and docs only.

---

## [0.1.9] — 2026-09-30

### Docs / comments (patch)
- **Source comments and docs wording unified**: the notes in the client, the type definitions, the examples and the tests now use user-facing wording throughout.
- **README completed**: added *Requirements*, *Return shapes* and *Examples* sections; header now links to the **GitHub repo / Issues** with a CI badge.
- **Package metadata**: `repository` / `bugs` now point at the GitHub repo.

> Runtime behaviour is identical to `0.1.8` — comments and docs only.

---

## [0.1.8] — 2026-09-28

### Docs (patch)
- **Consistent wording for the price basis**: `kline()` returns **forward-adjusted** prices
  (no gap on ex-dividend days, no `adjust` parameter) — the README, the method docs and this file
  now say the same thing, including "**do not re-adjust**".
- **MCP server address and Agent Skill** are described more clearly.

> Runtime behaviour is identical to `0.1.7` — wording only.

---

## [0.1.7] — 2026-09-28

### Docs (patch)
- **MCP server address: `https://api.ashareapi.com/mcp`** — use this in your client config
  (`ashareapi.com/mcp` is the setup guide for 19 clients).
- **Agent Skill** section added: <https://ashareapi.com/skill>
- **Changelog links**: site changelog + npm version history (absolute URLs that work from the package page).

> Runtime behaviour unchanged — docs-only release.

---

## [0.1.6] — 2026-09-28

### Docs (patch)
- **The price basis of `kline()` is now stated**: it returns **forward-adjusted** prices (**no gap on
  ex-dividend days**) and there is **no** `adjust` parameter ⇒ **do not re-adjust** (double adjustment
  leaves prices that no longer match the real market). The README endpoint table and sample comment say so too.

> Runtime behaviour is identical to `0.1.5` (docs only).

---

## [0.1.5] — 2026-09-28

### Docs / metadata (patch)
- **The turnover-rate field in the README samples is now `turnover`** (since 2026-09-26 the field is `turnover`;
  the old alias is gone) — the samples run as-is, with no `KeyError`.
- **README version table** now includes `0.1.3` / `0.1.4`.
- **Metadata link**: `Changelog` points to <https://ashareapi.com/changelog> (always available).

> Runtime behaviour is identical to `0.1.4` (no behaviour change) — docs and metadata only.

---

## [0.1.4] — 2026-09-26

### Fixed
- **Return types now match the response shapes** — three methods return nested structures while typed as `Row[]`:
  - `finance()` → **`Promise<TableList>`** (`Row[][]`; `[0]`=income · `[1]`=balance sheet · `[2]`=cash flow, each in **descending period order**)
  - `shareholder()` → **`Promise<SectionedResult>`** (`{ tables: Section[], data?: {slug: rows} }`)
  - `calendar()` → **`Promise<SectionedResult>`** (sections by event type: `financial_report` / `dividend` / `ipo` / `meeting` / `lockup_release` / `rights_issue`)
- Exported the new types `Section`, `SectionedResult`, `TableList`
- `QuoteRow.turnover` doc: it is the **turnover rate (%)** (same value as `/v1/snapshot`'s `turnover`)

---

## [0.1.3] — 2026-09-23

### Changed
- Docs revision: `snapshot()` / `orderbook()` notes now state the boundaries (**A-shares only** / **billing is per call** / "other markets return empty, never wrong data")
- Added this file (`CHANGELOG.md`) to the package + included in `files` whitelist

> Functionally identical to `0.1.2` (`snapshot()` already shipped there); this release is docs and packaging only.

---

## [0.1.2] — 2026-09-23

### Added
- `snapshot(code)` — full quote profile (`GET /v1/snapshot`)
  - One call returns price / order book / valuation (PE TTM·dynamic·static + PB) / market cap (float·total) / shares / limit up & down / volume ratio / amplitude / speed
  - **A-shares only** (HK/US use a different field layout — use `quote()`) — other markets return empty, **never wrong data**
  - **Billing is per call**: use it once for multiple dimensions instead of `quote` + `valuation` + `orderbook` (3 calls → 1)

### Fixed
- `orderbook()` field docs now describe the **flat columns** (`b1_p`/`b1_v` ~ `b5_p`/`b5_v` bids + `a1_p`/`a1_v` ~ `a5_p`/`a5_v` asks) — aligned with mainstream data-API conventions, so `df["b1_p"]` works directly

### Changed
- Method count **31 → 32**

---

## [0.1.1] — 2026-09-23

### Added
- `orderbook(code)` — five-level order book (`GET /v1/orderbook`)
  - Bid 1–5 / ask 1–5 with **price and resting size (lots)** + last price / change / data time
  - **Second-level snapshot** (10s cache) · **meaningful intraday** (after close it is the final snapshot of the day)
  - Size unit is **lots** (×100 = shares); bids all 0 at limit-down / asks all 0 at limit-up (normal)
  - `data` is a **row array** (`[{...}]`) → consistent with `quote()` etc., auto-converted to DataFrame when pandas is installed

### Changed
- Method count **30 → 31**

---

## [0.1.0] — 2026-09-23

**First release.**

- **30 endpoints as 30 methods**, named 1:1 with the HTTP paths (`/v1/margin-trade` → `margin_trade()`)
- **5 free data endpoints**, **no key needed**: `quote` / `kline` / `hot` / `market_overview` / `changedist`
- **Code formats accepted**: `sh600667` / `600667.SH` / `600667` (auto-normalised)
- **Typed errors**: `AuthError` (401) / `RateLimitError` (429) / `UpstreamError` (upstream failed, source already switched, **not billed**) / `EmptyResultError` (no data ≠ failure)
- **pandas optional**: returns a DataFrame if installed, otherwise `list[dict]`
- **Automatic retries** (3 by default, configurable); multi-source failover
- Ships with `examples/` (quickstart / error handling / factor screening)
