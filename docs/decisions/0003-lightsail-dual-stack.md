---
title: "Lightsail Dual-Stack Small"
status: accepted
date: 2026-02-24
tags: [infrastructure, vm, aws]
supersedes: null
---

# ADR-0003: Lightsail Dual-Stack Small

## Context
Need a persistent Linux VM for running CLI executors (Claude Code, Codex, Gemini CLI) with shared repos.

## Decision
AWS Lightsail dual-stack Small ($12/mo, 3 months free). 2GB RAM, 2 vCPU, 60GB SSD, 3TB transfer. Decouples VM billing from API/GCP credits.

## Consequences
- ✅ Predictable flat pricing, generous bandwidth
- ✅ IPv4+IPv6 — GitHub/npm work without NAT64 hacks
- ⚠️ Not co-located with GCP (slightly higher latency to Vertex AI)
- ⚠️ $2/mo premium over IPv6-only
