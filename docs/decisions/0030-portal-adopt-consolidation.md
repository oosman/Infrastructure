# ADR-0030: Adopt MCP Server Portal for Connector Consolidation

<!-- Resume context: Portal at mcp-test.deltaops.dev consolidates vault-mcp + mac-mcp + future servers into single Claude.ai connector -->

## Status
Accepted

## Date
2026-02-28

## Context
Claude.ai has a limited number of connector slots. Each MCP server (vault-mcp, mac-mcp, GitHub, etc.) consumes one slot. As we add more services, this becomes a constraint. Cloudflare MCP Server Portals (open beta, Aug 2025) consolidate multiple servers behind a single OAuth-authenticated endpoint.

## Decision
Adopt the MCP Server Portal at `mcp-test.deltaops.dev` as the primary connector, while keeping direct connectors as fallback.

### Key Findings from Spike
1. **API-created servers don't generate backing Access applications.** Dashboard-created servers do. This is the root cause of "No allowed servers available" errors when using API-only creation.
2. **Two-layer policy model:** Portal Access app controls authentication; individual server Access apps control visibility. Both need policies.
3. **Managed OAuth with DCR works with Claude.ai.** Redirect URIs: `claude.ai/api/mcp/auth_callback` and `claude.com/api/mcp/auth_callback`. Do NOT manually enter Client ID.
4. **Portal adds 3 management tools** (`portal_list_servers`, `portal_toggle_servers`, `portal_toggle_single_server`).
5. **Third-party OAuth servers (GitHub) can be proxied** through the portal with separate auth flows per server.

### Portal Configuration
- Portal: Infrastructure (id=infra)
- Hostname: mcp-test.deltaops.dev
- Servers: vault-mcp (10 tools), mac-mcp (11 tools) + 3 portal tools = 24 total
- Access policy: Allow (oosman414@gmail.com)
- Managed OAuth: Enabled with DCR

## Consequences
- Single connector slot serves all infrastructure MCP servers
- Adding new servers (GitHub, etc.) doesn't consume additional connector slots
- Extra proxy hop adds minor latency
- Portal is open beta — potential for breaking changes
- Tool names get `Infra:` prefix with server name embedded (e.g., `Infra:mac-mcp_run_command`)
- If portal goes down, all tools are unavailable (vs only one server with direct connectors)

## Alternatives Considered
- **Direct connectors only:** Simpler, no proxy hop, but doesn't scale as servers increase
- **Production domain (mcp.deltaops.dev):** Deferred until portal proves stable on test subdomain
