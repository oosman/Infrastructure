# Infrastructure Validation Plan — Post Phase 8

> Run this in a **new Claude.ai session** in the Infrastructure project.
> Paste each section as a message. Record PASS/FAIL for each test.
> Report results back.

---

## Today's Session Summary (Mar 1)

### What was built/fixed:
1. **Transcript capture** — title-based extraction (no UUID), VPS service on port 8081, wired into `/done` protocol
2. **Dashboard v2** — deployed to Cloudflare Pages (dashboard-cbn.pages.dev), 5 tabs, auto-refresh, settings modal
3. **vault-mcp fixes** — CORS on all responses, /health returns real D1/KV/Executor checks, CB field names fixed
4. **Sonnet 4.5 purge** — removed from code (escalation, pricing, chooser), D1 data (20 stage rows updated), completion.md
5. **Stats endpoint enhanced** — cost_by_day, cost_by_task_type, leaderboard, recent_tasks added to /workflow/stats

### Pending (requires Osama):
- Add `dashboard.deltaops.dev` custom domain in CF dashboard (Workers & Pages → dashboard → Custom domains)

---

## Test 1: Cold Start Protocol (/bismillah)

**What to type:** `/bismillah`

**Expected behavior:**
1. Claude calls `vault-mcp task(action: "list")` as canary
2. Claude calls `vault-mcp checkpoint(action: "load")`
3. Claude calls `mac-mcp run_command("echo ok")`
4. Claude orients from checkpoint state

**PASS criteria:**
- [ ] All 3 calls succeed (no errors)
- [ ] Claude summarizes current state from checkpoint
- [ ] 43 open tasks visible (or close to it)

---

## Test 2: Vault Health (REST)

**What to type:** `Use mac-mcp to curl https://vault.deltaops.dev/health and show me the result`

**PASS criteria:**
- [ ] Returns JSON with `status: "ok"`
- [ ] `d1: "connected"`
- [ ] `kv: "connected"`
- [ ] `executor: "reachable"`

---

## Test 3: Dashboard Connectivity

**What to do:** Open https://dashboard-cbn.pages.dev (or dashboard.deltaops.dev if custom domain is set)

**PASS criteria:**
- [ ] Page loads (not blank)
- [ ] Settings modal appears on first visit (no token stored)
- [ ] After entering token `8dfa3967fcd5bacc695d86855c244b867ccaa28f85a66a8ea0966e260e4d7f79`:
  - [ ] Health tab: vault-mcp ● connected, D1 ● connected, KV ● connected, Executor ● connected
  - [ ] Health tab: Circuit Breaker shows dollar amounts (not "—")
  - [ ] Cost tab: pie chart, bar charts render with data
  - [ ] Leaderboard tab: table has models, NO "sonnet-4-5" anywhere
  - [ ] Tasks tab: shows 43+ open tasks with expandable rows
  - [ ] Analytics tab: line chart and success rate matrix render
  - [ ] Auto-refresh countdown (green dot, 60s) is ticking

---

## Test 4: Sonnet 4.5 Purge Verification

**What to type:** `Use Cloudflare MCP to query D1 database 5a0c53ff-963c-48f9-b68d-f13536104aa1: SELECT DISTINCT model FROM stages ORDER BY model`

**PASS criteria:**
- [ ] No model contains "sonnet-4-5" or "sonnet-4-6-2025"
- [ ] `claude-sonnet-4-6` exists (without date suffix)

**Then type:** `Search for "sonnet-4-5" or "sonnet 4.5" in ~/Developer/infrastructure using mac-mcp, excluding node_modules`

**PASS criteria:**
- [ ] Zero matches in own code (node_modules matches are fine to ignore)

---

## Test 5: Execute End-to-End

**What to type:** `Use vault-mcp execute tool: instruction "echo hello from validation test", executor "claude", repo "oosman/infrastructure"`

**PASS criteria:**
- [ ] Returns a result (not an error)
- [ ] D1 gets a new task + stage record
- [ ] Model should be claude-sonnet-4-6 (not 4-5)

---

## Test 6: Transcript Capture

**What to type:** `Use mac-mcp to run: curl -s -H "X-Auth-Token: $(cat /Users/osman/.transcript-token 2>/dev/null || echo test)" http://localhost:8081/health`

**If that fails, try:** `ssh to executor.deltaops.dev and check: systemctl status transcript`

**PASS criteria:**
- [ ] Transcript service responds (either locally or on VPS)
- [ ] If on VPS: active and running

---

## Test 7: Stats Endpoint Fields

**What to type:** `Use mac-mcp to curl the stats endpoint with Bearer auth and show me the top-level keys`

```
VAULT_TOKEN=$(security find-generic-password -a "osman" -s "VAULT_AUTH_TOKEN" -w)
curl -s "https://vault.deltaops.dev/workflow/stats" -H "Authorization: Bearer $VAULT_TOKEN" | python3 -c "import sys,json; print(list(json.load(sys.stdin).keys()))"
```

**PASS criteria:**
- [ ] Keys include: task_counts, cost_by_model, cost_by_day, cost_by_task_type, model_performance, leaderboard, recent_tasks, circuit_breaker

---

## Test 8: CORS Headers

**What to type:** `Use mac-mcp to run: curl -sI "https://vault.deltaops.dev/health" -H "Origin: https://dashboard-cbn.pages.dev" | grep -i access-control`

**PASS criteria:**
- [ ] `access-control-allow-origin: *` present
- [ ] `access-control-allow-headers: Authorization, Content-Type` present

---

## Test 9: Model Ladder Consistency

**What to type:** `Use mac-mcp to grep for model strings in the escalation and chooser files`

```
grep "model:" ~/Developer/infrastructure/vault-mcp/src/logic/escalation.ts ~/Developer/infrastructure/vault-mcp/src/logic/chooser.ts
```

**PASS criteria:**
- [ ] All Claude references use `claude-sonnet-4-6` or `claude-opus-4-6`
- [ ] No `4-5` or `20250514` or `20250929` date suffixes

---

## Test 10: /done Protocol

**What to type:** `/done`

**Expected behavior:**
1. Claude calls `vault-mcp checkpoint(action: "save")`
2. Claude updates completion.md via mac-mcp
3. Claude commits and pushes via mac-mcp

**PASS criteria:**
- [ ] Checkpoint saved without error
- [ ] Git commit + push succeeds
- [ ] No errors in the chain

---

## Scorecard

| Test | Result | Notes |
|------|--------|-------|
| 1. Cold start (/bismillah) | | |
| 2. Vault health | | |
| 3. Dashboard | | |
| 4. Sonnet 4.5 purge | | |
| 5. Execute E2E | | |
| 6. Transcript capture | | |
| 7. Stats endpoint | | |
| 8. CORS headers | | |
| 9. Model ladder | | |
| 10. /done protocol | | |

**Total: __ / 10**

---

## If Tests Fail

- **Test 1 fails (canary):** vault-mcp may be down. Check `curl https://vault.deltaops.dev/health`
- **Test 3 fails (dashboard blank):** Open browser DevTools Console, screenshot errors
- **Test 5 fails (execute):** Check executor health: `curl https://executor.deltaops.dev/health`
- **Test 6 fails (transcript):** Service may need restart: `ssh -i ~/.ssh/lightsail-infra.pem ubuntu@executor.deltaops.dev "sudo systemctl restart transcript"`
