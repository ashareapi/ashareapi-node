<div align="center">

<a href="https://ashareapi.com/en/"><img src="https://ashareapi.com/icon-512.png" width="88" height="88" alt="ashareapi"></a>

# ashareapi — Official Node.js / TypeScript SDK for the A-Share Data API

**Quotes / K-lines / Financials / Money flow / Dragon-Tiger list / Sectors / Factor screening** — 32 endpoints, and the **free endpoints require no sign-up**.
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

> ⚠️ **Server-side only** (Node / Next.js server routes / scripts). In a browser your API key would be exposed — this package deliberately ships no browser build.

> There is also a **Python SDK**: `pip install ashareapi` — [PyPI](https://pypi.org/project/ashareapi/)

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
const rows = await cli.screen("", "low_pe", 10, "ROETTM");
console.table(rows);
```

**CommonJS works too**:

```js
const { AShareAPI } = require("ashareapi");   // dual build; both import and require work
```

## Why use it

- **Zero dependencies**: only Node's native `fetch` — fast installs, no supply-chain surface (the Python version still needs `requests`)
- **Free endpoints are genuinely key-free**: `quote / kline / hot / market-overview / changedist` work immediately, no registration
- **Ticker format tolerant**: `sh600667` / `600667.SH` / `600667` all accepted
- **Both method spellings accepted**: `marketOverview()` and `market_overview()` are the same method (zero-friction migration for Python SDK users)
- **Automatic source failover**: 70 data sources back each other up on the backend; a failed fetch switches source automatically and **does not consume your quota**
- **Clear error taxonomy**: `AuthError` / `RateLimitError` / `UpstreamError` / `EmptyResultError` (no data ≠ failure) — each one tells you what to do next
- **TypeScript-first**: complete `.d.ts`, so `cli.` autocompletes all 32 methods and their arguments

## Endpoints

| Method | Description | Key-free |
|---|---|---|
| `quote(code)` | Real-time quote snapshot | ✅ |
| `kline(code, period, count)` | K-line (daily / weekly / monthly) · **always forward-adjusted (qfq)** | ✅ |
| `hot(limit)` | Hot-search ranking | ✅ |
| `marketOverview(type)` | Market overview (profile / valuation / style rotation) | ✅ |
| `changedist()` | Advance-decline distribution (market breadth) | ✅ |
| `finance(code, num)` | The three financial statements | — |
| `fund(code)` | Money flow + Dragon-Tiger list + block trades + margin trading | — |
| `technical(code)` | MA / MACD / KDJ / RSI / BOLL | — |
| `lhb(type)` | Dragon-Tiger sub-rankings (institutions / hot money / active seats) | — |
| `screen(expr, preset, limit, orderby, desc, market)` | Factor screening | — |
| `search(q)` | Search with disambiguation | — |

> ⚠️ **K-line prices are always forward-adjusted (qfq)** — no gaps on ex-dividend dates, and there is **no** `adjust` parameter. **Do not adjust them yourself** (that would double-adjust).

(All 32 endpoints: [endpoint list](https://ashareapi.com/en/endpoints/); method signatures match the live `/openapi.json`)

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

## Also works with AI agents (MCP / Agent Skill)

Besides the Node SDK, we offer two ways to plug into **AI agents**:

- **MCP server** (Streamable HTTP) — server URL **`https://api.ashareapi.com/mcp`**
  (⚠️ use **that** endpoint URL; the site page `ashareapi.com/en/mcp/` is the **guide**, not the endpoint)
- **Per-client configuration** (Claude Code / Cursor / VS Code / Codex and **19 clients** in total, every key name checked against official docs):
  <https://ashareapi.com/en/mcp/>
- **Agent Skill** (an endpoint manual for AI agents + a downloadable package; drop it into your skills directory): <https://ashareapi.com/en/skill/>

> Free tools/endpoints need **no key**; paid tools take `Authorization: Bearer <your-key>` in the request header.

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

## Version history

**Current version: `0.1.10`** (2026-10-03)

| Version | Changes |
|---|---|
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

> ⚠️ **The endpoints themselves are always current** (the service evolves server-side, **no SDK upgrade needed**) — upgrading only gets you the **new convenience methods**.

Full changelog → `CHANGELOG.md` in the package · [site changelog](https://ashareapi.com/en/changelog/) · [npm version history](https://www.npmjs.com/package/ashareapi?activeTab=versions)

## License

MIT · Data is for research reference only and is not investment advice
