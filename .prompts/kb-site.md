You are setting up a full documentation site for this infrastructure project using MkDocs with Material theme, deployed to GitHub Pages. The site must be the browsable source of truth.

## Context
- Repo: ~/Developer/infrastructure/ with remote https://github.com/oosman/Infrastructure.git
- Existing docs in docs/ (architecture.md, cloudflare.md, local-mcp.md, setup.md, vault-mcp.md)
- Existing ADRs in docs/decisions/ (0001-0010 + _adr-template.md)
- docs/specs/ exists but is empty
- No mkdocs.yml exists yet
- No GitHub Actions workflow exists
- Git identity: Osama Osman, oosman@deltaops.dev
- NAMING: This is an "infrastructure" project. Never use "pipeline" or "mobile-pipeline" or "deltaforce". Use "workflow" if you need to describe task routing.

## Task 1: Create mkdocs.yml

Create mkdocs.yml in repo root with Material theme:
- site_name: "Infrastructure Knowledge Base"
- site_url: "https://oosman.github.io/Infrastructure/"
- repo_url: "https://github.com/oosman/Infrastructure"
- edit_uri: "edit/main/docs/"
- Material theme with light/dark toggle, indigo/teal palette, Inter + JetBrains Mono fonts
- Features: navigation.instant, navigation.tracking, navigation.sections, navigation.top, navigation.indexes, search.suggest, search.highlight, content.code.copy, content.code.annotate, content.action.edit, toc.follow
- Plugins: search, tags (tags_file: tags.md)
- Extensions: admonition, pymdownx.details, pymdownx.superfences (with mermaid), pymdownx.highlight, pymdownx.inlinehilite, pymdownx.tasklist, pymdownx.tabbed, attr_list, md_in_html, toc with permalink
- nav:
  - Home: index.md
  - Architecture: architecture.md
  - Setup: setup.md
  - Services:
    - Mac MCP: local-mcp.md
    - Vault MCP: vault-mcp.md
    - Cloudflare: cloudflare.md
  - Operations:
    - Task Routing: task-routing.md
    - Git Conventions: git-conventions.md
    - Known Risks: risks.md
  - Decisions:
    - decisions/0001-foundational-constraints.md
    - decisions/0002-cloudflare-tunnel.md
    - decisions/0003-lightsail-dual-stack.md
    - decisions/0004-mac-mcp-architecture.md
    - decisions/0005-model-discipline.md
    - decisions/0006-three-layer-auth.md
    - decisions/0007-tool-consolidation.md
    - decisions/0008-streamable-http.md
    - decisions/0009-portal-spike.md
    - decisions/0010-ai-gateway-deferred.md
  - Tags: tags.md

## Task 2: Create GitHub Actions workflow

Create .github/workflows/deploy-docs.yml:
- Triggers on push to main (paths: docs/**, mkdocs.yml) and workflow_dispatch
- permissions: contents: write
- Uses actions/checkout@v4, actions/setup-python@v5 (3.12)
- pip install mkdocs-material
- mkdocs gh-deploy --force

## Task 3: Create missing docs

ALL docs must have YAML frontmatter with: title, type, status, date (2026-02-28), tags.

1. docs/index.md — Home page. Brief infrastructure project description, list sections covered. Under 50 lines.
2. docs/tags.md — Just title: Tags frontmatter, blank body.
3. docs/git-conventions.md — Branch naming, conventional commits, PR conventions, merge strategy. Under 80 lines.
4. docs/task-routing.md — The orchestrator (Claude.ai) plans only. CC agents (sonnet/haiku) execute via cc_dispatch through Mac MCP. Model discipline: orchestrator never executes, executors never plan. Under 80 lines.
5. docs/risks.md — Known risks: mac-mcp SPOF (mitigated by VM SSH backup), auth (closed with secret path), Cloudflare concentration, 200K context limit, credential management via Keychain. Under 80 lines.

## Task 4: Clean stale references in existing docs

Read ALL docs in docs/ and docs/decisions/. Fix:
- "mobile-pipeline", "Mobile Pipeline", "pipeline", "deltaforce", "DeltaForce" -> "infrastructure" or "workflow"
- "pipeline-db" -> "vault-db"
- ~/Pipeline/ references -> remove or replace
- architecture.md "Three-Instance Model" references Mobile Pipeline -> rewrite for infrastructure only
- architecture.md should reflect: mac-mcp (secret path auth), vault-mcp (CF Worker), executor (Lightsail VM), backup (VM SSH to Mac)

## Task 5: Build and verify

  pip install mkdocs-material --break-system-packages 2>/dev/null || pip install mkdocs-material
  mkdocs build --strict

Fix any errors.

## Task 6: Commit and push

  git add -A
  git commit -m "docs: complete KB site — mkdocs, GitHub Actions, missing docs, cleanup stale refs"
  git push origin main

## Task 7: Enable GitHub Pages

  gh api repos/oosman/Infrastructure/pages -X POST -f source.branch=gh-pages -f source.path=/ 2>/dev/null || echo "Pages needs first workflow run"

## Verification
  gh run list --limit 1

Do NOT create files outside ~/Developer/infrastructure/. Do NOT touch ~/Developer/archive/.
