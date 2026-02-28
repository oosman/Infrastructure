---
title: "Portal Spike Before Commitment"
status: proposed
date: 2026-02-27
tags: [architecture, cloudflare, evaluation]
supersedes: null
---

# ADR-0009: Portal Spike Before Commitment

## Context
Cloudflare MCP Server Portal could unify 3 endpoints into 1. Untested with custom Node.js servers behind tunnels — risk of committing to an architecture that doesn't work.

## Decision
2-hour spike in Phase 6 with test subdomain (mcp-test.deltaops.dev). Adopt only if latency < 200ms overhead and both servers work. 3-endpoint model is the baseline fallback.

## Consequences
- ✅ No architecture dependency on Portal — clear go/no-go criteria
- ✅ Low-cost evaluation with defined success metrics
- ⚠️ Fallback is current working 3-endpoint model if spike fails
