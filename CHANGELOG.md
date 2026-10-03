# Changelog

This package follows [Semantic Versioning](https://semver.org/): **minor** = new endpoints/methods, **patch** = bug fixes / docs.

> The endpoints themselves are **always current** (the server evolves; no SDK upgrade needed) — upgrading the SDK is only about **getting the convenience methods for new endpoints**.
> Full endpoint list and field semantics: <https://ashareapi.com/endpoints>

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
  ex-dividend days**) and there is **no** `adjust` parameter ⇒ ⚠️ **do not re-adjust** (double adjustment
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
  - ⚠️ **A-shares only** (HK/US use a different field layout — use `quote()`) — other markets return empty, **never wrong data**
  - ⚠️ **Billing is per call**: use it once for multiple dimensions instead of `quote` + `valuation` + `orderbook` (3 calls → 1)

### Fixed
- `orderbook()` field docs now describe the **flat columns** (`b1_p`/`b1_v` ~ `b5_p`/`b5_v` bids + `a1_p`/`a1_v` ~ `a5_p`/`a5_v` asks) — aligned with mainstream data-API conventions, so `df["b1_p"]` works directly

### Changed
- Method count **31 → 32**

---

## [0.1.1] — 2026-09-23

### Added
- `orderbook(code)` — five-level order book (`GET /v1/orderbook`)
  - Bid 1–5 / ask 1–5 with **price and resting size (lots)** + last price / change / data time
  - ⚠️ **Second-level snapshot** (10s cache) · **meaningful intraday** (after close it is the final snapshot of the day)
  - ⚠️ Size unit is **lots** (×100 = shares); bids all 0 at limit-down / asks all 0 at limit-up (normal)
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
