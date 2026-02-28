<!-- RESUME CONTEXT
What: Testing conventions — validation patterns and quality gates
Why: Documents how work is validated in this infrastructure
Next: ci-workflow.md for deployment details
Depends-on: workflow.md
-->
---
title: "Testing Conventions"
type: reference
status: active
date: 2026-02-28
tags: [testing, validation]
---

# Testing Conventions

## Validation Pattern: N-of-M

Run N times, accept if M pass. This handles flaky external services and non-deterministic AI outputs.

- **CLI validation**: 5-10 test runs per tool during development
- **Smoke tests**: `curl` health endpoints after deployment
- **Integration tests**: End-to-end MCP protocol calls (connect, list tools, call tool, verify response)

## Smoke Tests

```bash
# Mac MCP server
curl -sf http://127.0.0.1:3001/health | jq .status

# Cloudflare Tunnel
curl -sf http://127.0.0.1:20241/ready

# vault-mcp
curl -sf https://vault.deltaops.dev/health

# All launchd services
launchctl list | grep com.osman
```

## Validation Gates

Each infrastructure phase has validation criteria that must pass before moving to the next phase. Gates are defined in the infrastructure plan and checked by the orchestrator.

Example gate criteria:
- All health endpoints return 200
- Auth rejects unauthorized requests
- Tools execute and return expected output format
- No regressions in existing functionality

## Current State

No unit test framework (solo operator, infrastructure focus). Validation is primarily:
1. Smoke tests via curl
2. N-of-M tool invocation during development
3. Orchestrator review of CC agent output
4. Manual verification of end-to-end flows
