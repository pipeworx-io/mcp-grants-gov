# @pipeworx/grants-gov

Grants.gov MCP — open federal funding opportunities, no auth.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1686+ live data sources.

## Tools

Live (proxies Grants.gov's search2 API — currently-open coverage only):

- `search_opportunities(keyword?, status?, agencies?, funding_categories?, aln?, limit?, offset?)` — filter open opportunities.
- `get_opportunity(opportunity_id)` — full record with synopsis, eligibility, attachments.

Local mirror (fleet #2512 — closed, archived and forecasted history the live API cannot serve):

- `search_historical_opportunities(agency_code?, cfda?, keyword?, status?, opportunity_category?, post_date_from?, post_date_to?, limit?, offset?)` — search the FULL extract, every status, back to 2004.
- `get_historical_opportunity(opportunity_id)` — one record, any status, with a computed `status`.
- `agency_posting_trend(agency_code, years?)` — an agency's opportunity count / funding by federal fiscal year.

## Data sources

- Live: `https://api.grants.gov/v1/api/` — public POST-JSON API, no key required.
- Mirror: Grants.gov's own daily full-catalog XML extract (`grants.gov/xml-extract` ->
  `prod-grants-gov-chatbot.s3.amazonaws.com/extracts/GrantsDBExtract<YYYYMMDD>v2.zip`,
  no auth). Loaded into Supabase `grants_gov_opportunities`
  (`supabase/migrations/226_grants_gov_extract.sql`) by
  `scripts/grants-gov-upsert.sh` via `.github/workflows/grants-gov-refresh.yml`
  (`workflow_dispatch` for now — see that workflow for why no `schedule:` is
  wired yet). Every mirror response carries `data_as_of`, the last successful
  refresh.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "grants-gov": {
      "url": "https://gateway.pipeworx.io/grants-gov/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/grants-gov/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1686+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/search_opportunities \
  -H 'Content-Type: application/json' \
  -d '{"keyword":"climate resilience","status":"posted","agencies":"EPA,NOAA","funding_categories":"ENV","limit":25}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/search_opportunities`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "grants-gov": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-grants-gov"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-grants-gov
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Grants Gov data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
