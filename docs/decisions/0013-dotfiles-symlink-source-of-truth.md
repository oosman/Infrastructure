<!-- RESUME CONTEXT
What: ADR-0013 — Dotfiles symlink source of truth
Why: Records that ~/dotfiles/claude/ is canonical and ~/.claude/ is symlinks only
Next: Implementation in Phase 0
Depends-on: _adr-template.md
-->
---
title: "Dotfiles Symlink Source of Truth"
status: accepted
date: 2026-02-28
tags: [dotfiles, conventions]
supersedes: null
---

# ADR-0013: Dotfiles Symlink Source of Truth

## Context
Claude Code configuration files (CLAUDE.md, settings.json, commands/, hooks/) need to be version-controlled and portable. Writing directly to ~/.claude/ risks losing changes that aren't committed.

## Decision
~/Developer/dotfiles/claude/ is the canonical location for all Claude configuration. ~/.claude/ contains only symlinks pointing there. Never write directly to ~/.claude/.

## Consequences
- ✅ All config is version-controlled in the dotfiles repo
- ✅ Portable across machines via git clone + symlink setup
- ⚠️ Tools that auto-write to ~/.claude/ may break symlinks — must monitor
