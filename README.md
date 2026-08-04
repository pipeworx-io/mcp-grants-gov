# @pipeworx/grants-gov

Grants.gov MCP — open federal funding opportunities, no auth.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

- `search_opportunities(keyword?, status?, agencies?, funding_categories?, aln?, limit?, offset?)` — filter open opportunities.
- `get_opportunity(opportunity_id)` — full record with synopsis, eligibility, attachments.

## Data source

`https://api.grants.gov/v1/api/` — public POST-JSON API, no key required.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Grants Gov data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
