# @pipeworx/grants-gov

Grants.gov MCP — open federal funding opportunities, no auth.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1856+ live data sources. This is an independent, unofficial integration — not affiliated with, endorsed by, or published by the upstream provider.

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

Both URLs reach the same gateway and the same 1856+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/search_opportunities \
  -H 'Content-Type: application/json' \
  -d '{"keyword":"climate resilience","status":"posted","agencies":"EPA,NOAA","funding_categories":"ENV","limit":25}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/search_opportunities`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Run it from npm

`@pipeworx/mcp-grants-gov` is a local stdio bridge to the Pipeworx gateway: your MCP client
starts it with `npx`, and it forwards every call to the same
`https://gateway.pipeworx.io/grants-gov/mcp` endpoint shown above. It needs network access;
there is no offline mode.

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

Without a key it calls anonymously, capped at 50 calls a day. A free account
raises that to 200 a day: get a key at https://pipeworx.io/signup and add
`"env": { "PIPEWORX_API_KEY": "<your key>" }` to the server entry.
The key is sent as a Bearer token, the same way a hosted connection sends it,
so calls are metered and billed exactly as they are there.

It lists **only** this pack's tools by default. Set `PIPEWORX_META_TOOLS=1` to
also list `ask_pipeworx` and the other gateway-wide tools.

Behind an HTTPS proxy: Node's built-in `fetch` does not read `HTTPS_PROXY` by
default. Newer Node releases honour it when `NODE_USE_ENV_PROXY=1` is set; check
your Node version's documentation.

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
