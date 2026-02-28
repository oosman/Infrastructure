---
title: "Git Conventions"
type: reference
status: active
date: 2026-02-28
tags: [git, conventions, workflow]
---

# Git Conventions

## Identity

```
Osama Osman <oosman@deltaops.dev>
```

## Branch Naming

| Pattern | Use |
|---------|-----|
| `main` | Production. Always deployable. |
| `feat/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `docs/<name>` | Documentation changes |
| `chore/<name>` | Maintenance, tooling, CI |

## Conventional Commits

All commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

[optional body]
```

### Types

| Type | When |
|------|------|
| `feat:` | New feature or capability |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `chore:` | Tooling, CI, dependencies |
| `refactor:` | Code change that neither fixes a bug nor adds a feature |
| `test:` | Adding or updating tests |

### Examples

```
feat: vault-mcp v2 — McpAgent + 10 consolidated tools
fix: tunnel reconnection on wake from sleep
docs: add ADR-0008 streamable HTTP
chore: bump node to 25.x in CI
```

## Pull Requests

- Title matches conventional commit format
- Description includes what changed and why
- Link related ADRs or issues
- Squash merge to main (clean history)

## Merge Strategy

- **Squash merge** into main for feature branches
- **Fast-forward** for single-commit doc/chore changes
- Never force-push main
