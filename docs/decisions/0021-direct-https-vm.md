<!-- RESUME CONTEXT
What: ADR-0021 — Direct HTTPS for VM evaluation (superseded)
Why: Records the initial consideration of direct HTTPS over tunnel for VM
Next: See ADR-0027 for final decision
Depends-on: _adr-template.md
-->
---
title: "Direct HTTPS for VM"
status: superseded
date: 2026-02-28
tags: [vm, networking]
supersedes: null
superseded-by: "0027"
---

# ADR-0021: Direct HTTPS for VM

## Context
The Lightsail VM has a public IP. Direct HTTPS with Caddy + Let's Encrypt + ACL could be simpler than routing through a Cloudflare Tunnel, which adds latency and a dependency.

## Decision
Evaluate direct HTTPS for VM executor in Phase 4. Caddy handles TLS termination and ACL enforcement.

## Consequences
- ✅ Simpler architecture — no tunnel dependency for VM
- ✅ Lower latency for direct connections
- ⚠️ Requires managing TLS certificates and ACLs on the VM
- ⚠️ **Superseded by ADR-0027** — decided to stay with tunnel
