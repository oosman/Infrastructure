<!-- RESUME CONTEXT
What: ADR-0018 — D1 database renamed to vault-db
Why: Records the database rename from pipeline-db to vault-db
Next: No further action needed
Depends-on: _adr-template.md
-->
---
title: "Vault DB Rename"
status: accepted
date: 2026-02-28
tags: [d1, naming]
supersedes: null
---

# ADR-0018: Vault DB Rename

## Context
The D1 database was originally named "pipeline-db", a legacy name inconsistent with ADR-0017. The database had zero tables at time of rename, making it a clean swap with no migration needed.

## Decision
Rename D1 database from pipeline-db to vault-db (UUID: 5a0c53ff-963c-48f9-b68d-f13536104aa1). Update all references in wrangler.toml and documentation.

## Consequences
- ✅ Naming consistent with ADR-0017 conventions
- ✅ Zero-table state meant no data migration required
- ⚠️ Any hardcoded references to pipeline-db must be updated
