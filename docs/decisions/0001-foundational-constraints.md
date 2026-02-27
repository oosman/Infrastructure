---
title: "Foundational Constraints"
status: accepted
date: 2026-02-24
tags: [architecture, constraints, foundational]
supersedes: null
---

# ADR-0001: Foundational Constraints

## Context
Establishing non-negotiable principles for how all projects operate under AI-driven development.

## Decision
Six constraints govern all work:
1. Code must not be written by humans
2. Code must not be reviewed by humans
3. Value of context engineering is in distillation not plumbing
4. Never delegate decision of what context matters to tools that manage it
5. Humans own intent and curation, machines own implementation and validation
6. Dotfiles symlink structure — all config lives in ~/dotfiles/claude/ and is symlinked from ~/.claude/

## Consequences
- ✅ Clear division of responsibility between human and AI
- ✅ All config is version-controlled via dotfiles
- ⚠️ Requires discipline to never shortcut and write code directly
