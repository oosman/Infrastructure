<!-- RESUME CONTEXT
What: ADR-0027 — Keep CF Tunnel for executor
Why: Records the decision to stay with tunnel over direct HTTPS
Next: No further action needed
Depends-on: _adr-template.md
-->
---
title: "Executor Stay With Tunnel"
status: accepted
date: 2026-02-28
tags: [executor, networking]
supersedes: "0021"
---

# ADR-0027: Executor Stay With Tunnel

## Context
ADR-0021 proposed evaluating direct HTTPS for the executor VM. After Phase 4 evaluation, the existing Cloudflare Tunnel is already working, simpler to configure, and provides CF Access integration for free.

## Decision
Keep Cloudflare Tunnel for the executor instead of switching to direct HTTPS + Caddy. The tunnel is already operational and simplifies auth and TLS management.

## Consequences
- ✅ No additional TLS/certificate management on the VM
- ✅ CF Access integration works without extra configuration
- ✅ Consistent architecture — all services behind CF Tunnel
- ⚠️ Slight latency overhead from tunnel routing
