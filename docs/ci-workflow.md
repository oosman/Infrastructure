<!-- RESUME CONTEXT
What: CI/CD configuration — current deployment and automation state
Why: Documents how code gets deployed to each service
Next: intent-validation.md for validation philosophy
Depends-on: architecture.md
-->
---
title: "CI/CD Configuration"
type: reference
status: active
date: 2026-02-28
tags: [ci, deployment]
---

# CI/CD Configuration

## Current State

Deployment automation is minimal. Most deployments are manual, with auto-restart handled by launchd and systemd.

## Deployment Methods

| Service | Method | Trigger |
|---------|--------|---------|
| Docs site | GitHub Actions (Zensical build) | Push to main |
| vault-mcp | `wrangler deploy` | Manual |
| Executor | systemd on VM | Manual (auto-restart on failure) |
| Mac MCP | launchd | Auto-restart on failure |

## GitHub Actions

The docs site builds automatically on push to main:
- Runs `zensical build` (or `mkdocs build --strict` as fallback)
- Deploys to GitHub Pages
- Configured in `.github/workflows/`

## Service Auto-Restart

| Service | Manager | Restart Policy |
|---------|---------|---------------|
| Mac MCP server | launchd (com.osman.local-mcp) | KeepAlive + watchdog |
| CF Tunnel | launchd (com.osman.mcp-tunnel) | KeepAlive |
| Watchdog | launchd (com.osman.mcp-watchdog) | KeepAlive |
| Executor | systemd on Lightsail | restart=always |

## Future Considerations

- Pre-commit hooks for linting and validation
- PR checks for doc builds
- Automated test workflow (after test framework is established)
- Wrangler deploy automation via GitHub Actions
