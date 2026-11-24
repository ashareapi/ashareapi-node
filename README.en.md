<div align="center">

<a href="https://ashareapi.com/en/"><img src="https://ashareapi.com/icon-512.png" width="88" height="88" alt="ashareapi"></a>

# ashareapi — Official Node.js / TypeScript SDK for the A-Share Data API

**Quotes (intraday line · five-level depth) / K-lines / Financials / Money flow / Dragon-Tiger list / L2 order flow / Sectors / Factor screening / Quant backtest / short-term board plays / call auction / news & filings** — **102 endpoints**, and the **free endpoints require no sign-up**.
**Zero runtime dependencies** (uses Node's native `fetch`), with TypeScript types built in.

![Node.js](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=nodedotjs&logoColor=white)
[![npm](https://img.shields.io/npm/v/ashareapi?label=npm)](https://www.npmjs.com/package/ashareapi)
[![CI](https://github.com/ashareapi/ashareapi-node/actions/workflows/ci.yml/badge.svg)](https://github.com/ashareapi/ashareapi-node/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/license-MIT-green)

[中文](README.md) · **English**

[Website](https://ashareapi.com/en/) · [Docs](https://ashareapi.com/en/docs/) · [Endpoint list](https://ashareapi.com/en/endpoints/) · [MCP](https://ashareapi.com/en/mcp/) · [Agent Skill](https://ashareapi.com/en/skill/)

[Source](https://github.com/ashareapi/ashareapi-node) · [Issues](https://github.com/ashareapi/ashareapi-node/issues) · [Changelog](https://ashareapi.com/en/changelog/)

</div>

Popular endpoint docs: [K-line](https://ashareapi.com/en/docs/endpoints/kline/) · [Factor screening](https://ashareapi.com/en/docs/endpoints/screen/) · [Health check](https://ashareapi.com/en/docs/endpoints/health/)

```bash
npm install ashareapi
```

> **Server-side only** (Node / Next.js server routes / scripts). In a browser your API key would be exposed — this package deliberately ships no browser build.

> There is also a **Python SDK**: `pip install ashareapi` — [PyPI](https://pypi.org/project/ashareapi/)

## What this is

**The official Node.js / TypeScript SDK for the A-Share Data API** — one method call returns the result: URL building, retries, rate-limit backoff, typed errors and response shapes are already handled for you. After `npm install ashareapi`:

```ts
import { AShareAPI } from "ashareapi";
const cli = new AShareAPI({ apiKey: "ct-your-key" });   // or set the ASHARE_API_KEY env var
console.log(await cli.quote("sh600667"));               // quotes
console.log(await cli.backtest({ code: "sh600667", strategy: "mom20" }));  // quant backtest
```

**10 endpoints need no key** (they work as soon as you install): `/v1/quote` · `/v1/kline` · `/v1/hot` · `/v1/market-overview` · `/v1/changedist` · `/v1/wiki` · `/v1/trade-calendar` · `/v1/models` · `/v1/health` · `/v1/challenge`. The rest need a key ([get one](https://ashareapi.com/en/pricing/), from ¥9.9).

## 30-second quickstart

```ts
import { AShareAPI } from "ashareapi";

const cli = new AShareAPI();                 // free endpoints need no key
const bars = await cli.quote("sh600667");    // real-time quote
console.log(bars[0]);                        // { date, open, last, high, low, volume, amount, turnover }

console.log(await cli.kline("600667.SH", "day", 5));  // any code format works (auto-normalized)
console.log(await cli.hot(10));                       // hot-search ranking
```

**Paid endpoints** (financials / money flow / Dragon-Tiger list / screening, etc.) need a key — [get one](https://ashareapi.com/en/pricing/) from ¥9.9:

```ts
const cli = new AShareAPI({ apiKey: "ct-your-key" });  // or set the ASHARE_API_KEY env var
const rows = await cli.screen({ preset: "low_pe", sort: "roe_ttm", limit: 10 });
console.table(rows);
```

**CommonJS works too**:

```js
const { AShareAPI } = require("ashareapi");   // dual build; both import and require work
```

## Why use it

- **No caching on intraday data**: every call re-fetches · `minute` intraday line (242 points per day) · `auction` call-auction series (09:15–09:25, ~150 points)
- **10 years of K-line history**: back to 2016-08-08, `kline_full` returns it in one call (~2,500 bars; each symbol starts at **its own listing date**, so a 2019 STAR-market listing has ~1,700); daily / weekly / monthly / quarterly / yearly + minute bars `m1`–`m120`, **forward-adjusted** (no `adjust` parameter, no double-adjust)
- **Whole-market in one call**: `market_kline` returns daily bars for **every A-share (5,000+) on a given trading day** — no 5,000-iteration loop (Pro and up; one call counts as 500 quota)
- **7 L2 microstructure endpoints**: market-wide main-force net-flow ranking **in one call (5,568 stocks)** · dragon-tiger seats **drilled to branch level** with an `is_youzi` flag · four-way large orders / add-cancel queue / 100-day large-order history
- **9 batch endpoints**: quotes / K-lines / snapshots / financials / technicals / chips / shareholders / money flow / company profile — **150 symbols in one call ≈ 2s** (200 one-by-one ≈ 5 min)
- **One key, five markets**: A-shares + on-exchange ETFs (1,716) + HK (22 endpoints) + US (16 endpoints) + futures & FX (65 symbols)
- **No code needed**: wire up MCP and just ask "how is Moutai doing today" — Claude Code / Cursor / Codex, plus personal agents such as Today / Grok Bot / Muse (**19 clients · 94 tools**)
- **Quant stack in one place**: 87 factors + 29 strategies + 25 playbooks + backtests (single / portfolio / batch) + portfolio weight optimisation
- **You are not charged for what you do not get**: empty results, failed fetches and mistyped codes cost **nothing** (billing follows rows actually returned)
- **10 endpoints need no key**: `quote / kline / hot / market-overview / changedist / wiki / trade-calendar / models / health / challenge` — no sign-up
- **Traceable failures**: every response carries a `trace_id`; quote it in a support request and we can look up that exact request
- **Clear error taxonomy**: 401 → `AuthError`, 429 → `RateLimitError`, failed fetch → `UpstreamError`, no data → `EmptyResultError` (**no data ≠ failure**) — all four are plain `catch` branches
- **Ticker format tolerant**: `sh600667` / `600667.SH` / `600667` all accepted
- **Automatic source failover**: 70 data sources back each other up; a failed fetch switches source and **does not consume your quota**
- **Zero dependencies**: uses Node's built-in `fetch` — fast install, no supply-chain surface
- **Both naming styles work**: `marketOverview()` and `market_overview()` are the same method (zero friction for Python users)
- **TypeScript native**: full `.d.ts`; type `cli.` in your editor and get all 102 methods with parameters
## Endpoints

| Method | Description | Key-free |
|---|---|---|
| `quote(code)` | Last 30 trading days of quotes (one row per day) | ✅ |
| `kline(code, period, count, start, end)` | K-line (daily / weekly / monthly / quarterly / yearly + minute bars `m1`–`m120`) · adjustment fixed server-side (qfq for daily and above · raw for minute bars) | ✅ daily and above / paid for minute bars |
| `minute(code, days)` | **Intraday tick chart** (today / last 5 sessions) · paid | — |
| `hot(limit)` | Hot-search ranking | ✅ |
| `marketOverview(type)` | Market overview (profile / valuation / style rotation) | ✅ |
| `changedist()` | Advance-decline distribution (market breadth) | ✅ |
| `finance(code, num)` | The three financial statements | — |
| `fund(code)` | Money flow + Dragon-Tiger list + block trades + margin trading | — |
| `technical(code)` | MA / MACD / KDJ / RSI / BOLL | — |
| `lhb(type)` | Dragon-Tiger sub-rankings (institutions / hot money / active seats) | — |
| `screen(opts)` | Factor screening / conditional filter: `filters` · `sort` · `board` · `mode` · `metric` | — |
| `search(q)` | Search with disambiguation | — |
| `klineFull(code, fq, start, end)` | **Full-history** daily bars in one call (~2,500 bars since 2016-08-08) · `fq` is `qfq`/`hfq`/`nofq` | — |
| `backtest(opts)` | **Quant backtest** (single stock live / portfolio preset ranges · `weighting` = equal or inverse-volatility) | — |
| `backtestBatch(codes, strategies, ...)` | **Batch backtest** (many stocks × many strategies comparison matrix · ≤20 × 10) | — |
| `strategies()` | Quant strategy list (20 single-stock + 9 portfolio, with parameter ranges) | — |
| `factors(category, kind)` | Quant factor library (87 factors + 50 screening entries + 22 presets + 14 strategy templates) | — |
| `playbooks(category, id)` | Quant playbook library (25 "how to judge the market" workflows) | — |
| `ipWhitelist(action, ips)` | **IP allow-list** (lock a key to fixed IPs · `action` = get/set/clear) | — |


**The remaining endpoints**, grouped (each also has a `snake_case` alias):

| Group | Methods |
|---|---|
| Batch (many symbols per call) | `quoteBatch` · `klineBatch` · `snapshotBatch` · `profileBatch` · `financeBatch` · `technicalBatch` · `chipBatch` · `shareholderBatch` |
| L2 order flow | `bigorder` · `bigorderFlow` · `bigorderFlowFull` · `bigorderQueue` · `bigorderHistory` · `bigorderSplit` · `bigorderRank` |
| Dragon-tiger board | `lhbSeats` · `lhbAgency` |
| Sentiment / boards | `marketMood` · `limitReason` · `brokenBoard` · `tailChase` · `northbound` · `newHigh` · `flash` |
| AI Agent | `agentSearch` · `agentAsk` · `agentResearch` · `agentResearchStatus` · `scanner` · `scannerSnapshots` · `analyst` · `evidence` |
| Watchlist | `watchlist` · `watchlistImport` · `watchlistQuotes` |
| Protocol-compatible | `messages` · `chatCompletions` · `responses` (OpenAI / Anthropic clients, BYOK) |
| Futures / FX | `futures` · `forex` |
| Everything else | `models` · `tradeCalendar` · `indexList` · `indexConstituent` · `suspension` · `buyback` · `consensus` · `rating` · `disclosure` · `fundFlow` · `fundShort` · `fundSouth` · `score` · `report` · `stocks` |
> **L2 microstructure (7 endpoints · Institutional tier)** — brokers call this layer "Level-2 enhanced" and usually sell the feed as a separate licence; here it is 7 method calls:
> - `bigorderRank`: **market-wide main-force net-flow ranking — 5,568 stocks in one call**, 8 sort orders (not one symbol at a time)
> - `lhbSeats`: dragon-tiger seats **drilled down to branch level**, with an `is_youzi` (hot-money) flag
> - The other 5: intraday large-order net flow · tick-level four-way large orders · order add/cancel queue · 100-day large-order history · main-force four-way split

> **Batch endpoints (9)** — most APIs take one symbol per call, so 200 symbols means 200 round trips; here you pass many at once:
> - Covers: quotes / K-lines / snapshots / company profile / financials / technical indicators / chips / shareholders / money flow
> - Limits: 200 symbols per call on Pro · 1000 on Institutional
> - Billing: charged **per row actually returned** — failed symbols are not charged
> - Measured: 150 symbols of daily bars in one call ≈ 2s (200 symbols one-by-one ≈ 5 min); split 200 into 2 batches

> **K-line adjustment is fixed server-side** (there is **no** `adjust` parameter): forward-adjusted (qfq) for daily bars and above — no gaps on ex-dividend dates — and **raw** for minute bars. **Do not adjust them yourself** (that would double-adjust).

(All 102 endpoints: [endpoint list](https://ashareapi.com/en/endpoints/); method signatures match the live `/openapi.json`)

## Return shapes

Methods return an **array of objects** (`Row[]`) — the JS equivalent of a table:

```ts
const rows = await cli.kline("sh600667", "day", 3);
// [ { date: '2026-09-23', open: '20.10', last: '20.59', ... }, ... ]
```

When you need the full envelope (with `elapsed_ms` / `source` / `tier`):

```ts
const cli = new AShareAPI({ raw: true });
const env = await cli.quote("sh600667");
// { ok: true, endpoint: '/v1/quote', tier: 'free', elapsed_ms: 862, source: '...', data: [...] }
```

> **Differences from the Python version**: Python returns a `pandas.DataFrame` by default (`list[dict]` when pandas is missing); the JS version has no DataFrame concept and **always returns `Row[]`**. Also, every JS method **returns a Promise** (the Python version is synchronous).

## Error handling

```ts
import { AShareAPI, AuthError, RateLimitError, UpstreamError, EmptyResultError } from "ashareapi";

const cli = new AShareAPI();
try {
  const rows = await cli.fund("sh600667");
} catch (e) {
  if (e instanceof AuthError) console.log(e.message);          // 401 / missing key → go get a key
  else if (e instanceof RateLimitError) console.log(e.message); // 429 → slow down / solve PoW for a higher per-minute quota / upgrade
  else if (e instanceof UpstreamError) console.log(e.message);  // upstream fetch failed (source already switched, quota not charged) → one retry usually fixes it
  else if (e instanceof EmptyResultError) console.log(e.message); // no data right now (e.g. no block trades today) → not billed
  else throw e;
}
```

## Ways to connect (one key, several ways in)

Pick whatever your stack already uses — same key, same plan, nothing extra to buy:

| Way in | Install | Covers |
|---|---|---|
| **Node.js / TS SDK** | `npm install ashareapi` | services / frontends / cron jobs |
| **Python SDK** | `pip install ashareapi` | scripts / backtests / data pipelines |
| **MCP** | one URL: `https://api.ashareapi.com/mcp` | **19 clients** (Claude Code / Cursor / Codex / VS Code…) · **94 tools** |
| **Personal agents** | add MCP inside the assistant app | Today / Grok Bot / Muse / Dots / Duet |
| **Agent Skill** | drop into your skills directory | works with **45+ clients** |
| **Pi (pi.dev)** | `npm install ashareapi-pi` | query from inside Pi; knows which endpoint to call |
| **DSH plugin** | install the plugin | DeepSeek Harness |

All of these are native support, not a relay layer — same endpoints, same quota, same key. Details in the sections below.

## Other ways to connect

### MCP server

- Server URL **`https://api.ashareapi.com/mcp`** (use **that** endpoint URL; the site page `ashareapi.com/en/mcp/` is the **guide**, not the endpoint)
- **Per-client configuration** (Claude Code / Cursor / VS Code / Codex and **19 clients** in total, every key name checked against official docs): <https://ashareapi.com/en/mcp/>
- **Agent Skill** (an endpoint manual for AI Agents + a downloadable package; drop it into your skills directory): <https://ashareapi.com/en/skill/>

> Free tools/endpoints need **no key**; paid tools take `Authorization: Bearer <your-key>` in the request header.

### Personal agents (assistants on your phone)

No code: add one MCP entry inside the assistant app and ask for quotes, financials or K-lines.

| Assistant | Where to add it | Auth |
|---|---|---|
| **Today** | Settings → Connected apps → Add custom MCP | Bearer Token |
| **Grok Bot** | Connect apps → custom remote MCP | Bearer Header |
| **Muse** | Settings → Connectors → Custom Connector | Bearer / OAuth |
| **Dots** | Add a connector in ChatGPT first | Inherited from ChatGPT |
| **Duet** | Add a connector in Claude first | Inherited from Claude |

Same values everywhere:

```
URL:       https://api.ashareapi.com/mcp
Transport: Streamable HTTP
Auth:      Authorization: Bearer <your-key>
```

- Public HTTPS only — **localhost is not supported**
- In a "Bearer token" field, paste **the key only** (do not type `Bearer` again)
- Only fall back to `?key=` when the client cannot send headers

Once connected you can ask: "how is sh600519 doing", "give me the last 30 daily bars for 600519", "today's top 10 limit-up stocks by turnover".
Full walkthrough: <https://ashareapi.com/en/docs/guides/personal-agent/>

## Examples

Runnable examples live in [`examples/`](https://github.com/ashareapi/ashareapi-node/tree/main/examples):

| File | What it does |
|---|---|
| [`examples/quickstart.mjs`](https://github.com/ashareapi/ashareapi-node/blob/main/examples/quickstart.mjs) | Fetch **quotes / K-lines / hot search** from free endpoints (no key) |
| [`examples/kline-to-csv.mjs`](https://github.com/ashareapi/ashareapi-node/blob/main/examples/kline-to-csv.mjs) | Pull 120 daily bars → write them to a CSV |
| [`examples/dashboard-next.ts`](https://github.com/ashareapi/ashareapi-node/blob/main/examples/dashboard-next.ts) | **Next.js server route** example (the key never reaches the browser) |

```bash
node examples/quickstart.mjs
node examples/kline-to-csv.mjs
```

## Requirements

- **Node.js ≥ 18** (needs native `fetch`; 20 LTS or newer recommended)
- Zero runtime dependencies
- Example code in [`examples/`](https://github.com/ashareapi/ashareapi-node/tree/main/examples): quickstart / K-line to CSV / Next.js server route

## Related

**Official SDKs**: Python `pip install ashareapi` · Node.js / TypeScript `npm install ashareapi`

**MCP server**: `https://api.ashareapi.com/mcp` ([setup](https://ashareapi.com/en/mcp/))

**Agent Skill** (an interface manual for AI Agents): <https://ashareapi.com/en/skill/>

## Version history

**Current version: `0.3.1`** (2026-11-24)

| Version | Changes |
|---|---|
| `0.3.1` | **First version covering all 102 endpoints**: 9 batch · 7 L2 order-flow · 2 dragon-tiger · 7 sentiment boards · 8 AI Agent · 3 protocol-compatible · 3 watchlist · 2 futures & FX · 14 others; `screen()` takes semantic options; JSON request bodies; 429 retry and 4xx error handling fixed |
| `0.2.0` | New quant methods `backtest()` / `backtestBatch()` / `strategies()` / `factors()` / `playbooks()`; added `klineFull()` (full-history K-line) and `ipWhitelist()`; POST/DELETE support in the core |
| `0.1.11` | New `minute()` intraday method; `kline()` now supports minute bars `m1`–`m120` and `start`/`end` date ranges; PoW raise changed from 60/min to 15/min |
| `0.1.10` | 429 message now states the anonymous quota precisely (max **250 rows** per request / **100k rows** per day) · distinguishes "per-minute rate exceeded" from "daily row cap exceeded" (PoW does **not** help for the latter) · no behavior change |
| `0.1.9` | Documentation: README gains "Requirements", "Return shapes" and "Examples" · added GitHub repo / Issues links and the CI badge · source comments and docs wording aligned (no behavior change) |
| `0.1.8` | Documentation wording: price convention (forward-adjusted) unified across README / method docs / CHANGELOG · MCP URL and Agent Skill descriptions clarified |
| `0.1.7` | Documentation: **MCP server URL** `https://api.ashareapi.com/mcp` made explicit · **Agent Skill** section added (`/skill`) · changelog links switched to clickable absolute URLs |
| `0.1.6` | Documentation: `kline()` now states the **price convention** (forward-adjusted · no `adjust` parameter · do not double-adjust) |
| `0.1.5` | Documentation: turnover field example updated to `turnover` · added the `0.1.3` / `0.1.4` rows |
| `0.1.4` | Types aligned with return shapes: `finance()` → `TableList` · `shareholder()` / `calendar()` → `SectionedResult` · `QuoteRow.turnover` docs corrected |
| `0.1.3` | Documentation revision (`snapshot()` / `orderbook()` boundaries) · `CHANGELOG.md` added to the package |
| `0.1.2` | Added `snapshot()` (full-field profile) · methods 31 → 32 |
| `0.1.1` | Added `orderbook()` (5-level depth) · methods 30 → 31 |
| `0.1.0` | First release (30 methods · 5 free endpoints) |

> **The endpoints themselves are always current** (the service evolves server-side, **no SDK upgrade needed**) — upgrading only gets you the **new convenience methods**.

Full changelog → `CHANGELOG.md` in the package · [site changelog](https://ashareapi.com/en/changelog/) · [npm version history](https://www.npmjs.com/package/ashareapi?activeTab=versions)

## License

MIT · Data is for research reference only and is not investment advice
