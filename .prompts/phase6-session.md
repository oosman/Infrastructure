# Phase 6 — MCP Server Portal Spike Session Prompt

## Context
Infrastructure phases 0-4 complete. Phase 5 (orchestration wiring) running in parallel. This is a **2-hour timeboxed spike** to evaluate Cloudflare's MCP Server Portal for consolidating 3 MCP endpoints into 1.

## Critical Discovery Since Plan Was Written
Claude.ai MCP connectors **cannot send custom headers** (no Bearer, no CF-Access-Jwt-Assertion). Our auth model uses:
- Claude.ai → secret path segment (URL-based auth)
- CC/scripts → Bearer token or x-auth-token header

The original plan assumed CF Access headers for the Portal. This may make the Portal incompatible with our setup. **The primary goal of this spike is to determine if that's true.**

## Current Endpoints
| Endpoint | Auth (Claude.ai) | Auth (CC/scripts) | Transport |
|----------|-------------------|--------------------|-----------| 
| vault.deltaops.dev/mcp | Bearer (Claude.ai connector handles this) | Bearer header | Streamable HTTP |
| mac-mcp.deltaops.dev/{secret}/mcp | Secret path segment | Bearer header | Streamable HTTP |
| executor.deltaops.dev | N/A (not MCP — REST only, called by vault-mcp) | x-auth-token | REST HTTP |

Note: executor is NOT an MCP server. Only vault-mcp and mac-mcp are MCP endpoints.

## Spike Tasks

### 6.1 — Research Portal Auth Model (30 min)
Search Cloudflare docs for MCP Server Portal:
1. Does the Portal support URL-based auth (secret path segments)?
2. Does the Portal require CF Access headers from the client?
3. Can the Portal proxy to servers behind CF Tunnel (mac-mcp)?
4. Does the Portal work with non-Worker MCP servers?
5. What auth does the Portal add between itself and upstream servers?

Key question: If Claude.ai connects to the Portal, and the Portal proxies to mac-mcp, how does mac-mcp auth work? The Portal would need to either:
- Forward the secret path segment (unlikely — Portal probably normalizes URLs)
- Add its own auth header to upstream requests (possible)
- Use some other mechanism

### 6.2 — Test vault-mcp Through Portal (30 min)
vault-mcp is a CF Worker — this is the happy path:
1. Create test portal at mcp-test.deltaops.dev (CF dashboard)
2. Add vault-mcp as a server
3. Connect from Claude.ai
4. Test: are all 10 tools visible? Can you call task(action: "list")?
5. Measure latency vs direct connection

### 6.3 — Test mac-mcp Through Portal (30 min)
mac-mcp is behind CF Tunnel — this is the risky path:
1. Add mac-mcp to the portal
2. Test: does portal discover mac-mcp's 11 tools?
3. Does auth work? (mac-mcp expects secret path segment)
4. If auth fails, is there a Portal-side mechanism to inject auth?

### 6.4 — Decision (30 min)
| Outcome | Action |
|---------|--------|
| Both work, <200ms overhead | Adopt Portal, move to mcp.deltaops.dev |
| vault-mcp works, mac-mcp doesn't | Partial or skip — not worth split model |
| Latency >200ms overhead | Skip — stay 3-endpoint |
| Auth incompatible | Skip — write ADR-0029, move on |

Write ADR-0029 recording the decision regardless of outcome. Template in docs/decisions/_adr-template.md.

## Expected Outcome
Given the auth constraints, **this spike will likely result in "Skip Portal"**. That's a valid outcome — the 3-endpoint model works fine for a solo operator. The ADR documenting why is the deliverable.

## Validation Criteria
- [ ] Spike completed within 2-hour timebox
- [ ] Decision documented in ADR-0029 with latency measurements (if tested)
- [ ] If adopting: portal accessible, all tools work
- [ ] If skipping: 3-endpoint model confirmed, rationale documented
- [ ] Commit and push ADR

## Key Files
- ~/Developer/infrastructure/docs/decisions/_adr-template.md (ADR format)
- ~/Developer/infrastructure/docs/decisions/0009-portal-spike.md (original decision to spike)
- CF Account ID: 3d18a8bf1d47b952ec66dc00b76f38cd

## Rules
- 2-hour hard timebox. If blocked at 90 min, write "Skip" ADR and stop.
- Don't modify vault-mcp or mac-mcp code for this spike
- Test on mcp-test.deltaops.dev, not production
- Clean up test resources when done
- This is independent of Phase 5 — don't touch execute/workflow code
