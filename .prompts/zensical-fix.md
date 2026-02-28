Fix the documentation site to use Zensical instead of mkdocs-material, commit dotfiles cleanup, and fix remaining bootstrap gaps.

## Context
- Repo: ~/Developer/infrastructure/
- The site is currently live using mkdocs-material but should use Zensical (per ADR decision)
- Zensical reads mkdocs.yml natively and is mkdocs-compatible
- Install: pip install zensical (currently v0.0.24)
- Build: zensical build --clean (NOT mkdocs build)
- Serve: zensical serve
- Zensical does NOT support gh-deploy. Must use GitHub native Pages deployment.
- Git identity: Osama Osman, oosman@deltaops.dev

## Task 1: Update GitHub Actions workflow

Replace .github/workflows/deploy-docs.yml with this exact content:

name: Deploy Docs
on:
  push:
    branches: [main]
    paths: ["docs/**", "mkdocs.yml"]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/configure-pages@v5
      - uses: actions/checkout@v5
      - uses: actions/setup-python@v5
        with:
          python-version: "3.x"
      - run: pip install zensical
      - run: zensical build --clean
      - uses: actions/upload-pages-artifact@v4
        with:
          path: site
      - uses: actions/deploy-pages@v4
        id: deployment

## Task 2: Update mkdocs.yml emoji extensions

In mkdocs.yml, find the pymdownx.emoji section and update the namespace:
- emoji_index should use: !!python/name:zensical.extensions.emoji.twemoji
- emoji_generator should use: !!python/name:zensical.extensions.emoji.to_svg

If there is no pymdownx.emoji section, add one under markdown_extensions:
  - pymdownx.emoji:
      emoji_index: !!python/name:zensical.extensions.emoji.twemoji
      emoji_generator: !!python/name:zensical.extensions.emoji.to_svg

## Task 3: Build locally and verify

  pip install zensical --break-system-packages 2>/dev/null || pip install zensical
  cd ~/Developer/infrastructure && zensical build --clean

Fix any errors. Delete the site/ directory after build (it's in .gitignore).

## Task 4: Create AGENTS.md symlink

  cd ~/Developer/infrastructure && ln -sf CLAUDE.md AGENTS.md

## Task 5: Clean up

  rm -rf ~/Developer/infrastructure/site/
  echo "site/" >> ~/Developer/infrastructure/.gitignore (if not already there)

## Task 6: Commit and push

  cd ~/Developer/infrastructure && git add -A && git commit -m "docs: swap mkdocs-material for zensical, add AGENTS.md symlink" && git push origin main

## Task 7: Update GitHub Pages settings

The repo needs Pages source set to "GitHub Actions" (not "Deploy from branch"):
  gh api repos/oosman/Infrastructure/pages -X PUT -f build_type=workflow 2>/dev/null || echo "May need manual: Settings > Pages > Source > GitHub Actions"

## Task 8: Commit dotfiles cleanup

  cd ~/Developer/dotfiles && git add -A && git commit -m "chore: archive stale pipeline-era docs" && git push origin main 2>/dev/null || echo "No remote configured"

## Verification
  gh run list --limit 1
  curl -sf -o /dev/null -w "%{http_code}" https://oosman.github.io/Infrastructure/

Do NOT touch ~/Developer/archive/. Do NOT edit files in plans/archive/ or .entire/.
