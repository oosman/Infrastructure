#!/bin/bash
# Infrastructure Phase 8 — Automated Validation
set -uo pipefail

VAULT_URL="https://vault.deltaops.dev"
VAULT_TOKEN=$(security find-generic-password -a "osman" -s "VAULT_AUTH_TOKEN" -w)
INFRA="$HOME/Developer/infrastructure"

PASS=0 FAIL=0 SKIP=0
declare -a RESULTS=()

check() {
  local name="$1" result="$2" note="${3:-}"
  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1)); RESULTS+=("✅ $name")
  elif [ "$result" = "SKIP" ]; then
    SKIP=$((SKIP + 1)); RESULTS+=("⏭️  $name: $note")
  else
    FAIL=$((FAIL + 1)); RESULTS+=("❌ $name: $note")
  fi
  echo "  → $result ${note:+($note)}"
}

echo "══════════════════════════════════════════════"
echo " Infrastructure Phase 8 Validation"
echo " $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "══════════════════════════════════════════════"

# ── 1. Vault Health ──
echo -e "\n▶ Test 1: Vault Health"
H=$(curl -sf "$VAULT_URL/health" 2>/dev/null || echo '{}')
d1=$(echo "$H" | python3 -c "import sys,json; print(json.load(sys.stdin).get('d1',''))" 2>/dev/null)
kv=$(echo "$H" | python3 -c "import sys,json; print(json.load(sys.stdin).get('kv',''))" 2>/dev/null)
ex=$(echo "$H" | python3 -c "import sys,json; print(json.load(sys.stdin).get('executor',''))" 2>/dev/null)
st=$(echo "$H" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
if [ "$d1" = "connected" ] && [ "$kv" = "connected" ] && [ "$ex" = "reachable" ] && [ "$st" = "ok" ]; then
  check "Vault Health" "PASS"
else
  check "Vault Health" "FAIL" "d1=$d1 kv=$kv exec=$ex status=$st"
fi

# ── 2. CORS GET ──
echo -e "\n▶ Test 2: CORS GET"
cors=$(curl -sI "$VAULT_URL/health" -H "Origin: https://dashboard-cbn.pages.dev" 2>/dev/null | grep -ci "access-control-allow-origin" || true)
if [ "$cors" -ge 1 ]; then check "CORS GET" "PASS"; else check "CORS GET" "FAIL" "no ACAO header"; fi

# ── 3. CORS Preflight ──
echo -e "\n▶ Test 3: CORS Preflight"
pre=$(curl -sI -X OPTIONS "$VAULT_URL/health" -H "Origin: https://dashboard-cbn.pages.dev" -H "Access-Control-Request-Method: GET" 2>/dev/null | grep -ci "access-control-allow-origin" || true)
if [ "$pre" -ge 1 ]; then check "CORS Preflight" "PASS"; else check "CORS Preflight" "FAIL"; fi

# ── 4. Sonnet 4.5 purge — D1 (via stats leaderboard) ──
echo -e "\n▶ Test 4: Sonnet 4.5 Purge (D1)"
purge_check=$(curl -sf "$VAULT_URL/workflow/stats" -H "Authorization: Bearer $VAULT_TOKEN" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
models=[m['model'] for m in d.get('leaderboard',[])]
bad=[m for m in models if 'sonnet-4-5' in m]
has_46='claude-sonnet-4-6' in models
print(f'{len(bad)} {\"yes\" if has_46 else \"no\"}')
" 2>/dev/null || echo "ERR ERR")
bad=$(echo "$purge_check" | cut -d' ' -f1)
has46=$(echo "$purge_check" | cut -d' ' -f2)
if [ "$bad" = "0" ] && [ "$has46" = "yes" ]; then
  check "Sonnet 4.5 Purge (D1)" "PASS"
else
  check "Sonnet 4.5 Purge (D1)" "FAIL" "bad=$bad has_4.6=$has46"
fi

# ── 5. Sonnet 4.5 purge — code ──
echo -e "\n▶ Test 5: Sonnet 4.5 Purge (Code)"
code_hits=$(grep -r "sonnet-4-5\|sonnet.4.5\|Sonnet 4\.5" "$INFRA" --include="*.ts" --include="*.md" --include="*.js" \
  --exclude-dir=node_modules --exclude-dir=.wrangler --exclude="validation-plan*" --exclude="validate-*" 2>/dev/null | \
  grep -v "haiku" | wc -l | tr -d ' ')
if [ "$code_hits" -eq 0 ]; then
  check "Sonnet 4.5 Purge (Code)" "PASS"
else
  check "Sonnet 4.5 Purge (Code)" "FAIL" "$code_hits hits"
fi

# ── 6. Stats endpoint fields ──
echo -e "\n▶ Test 6: Stats Endpoint"
stats_keys=$(curl -sf "$VAULT_URL/workflow/stats" -H "Authorization: Bearer $VAULT_TOKEN" 2>/dev/null | \
  python3 -c "import sys,json; print(','.join(sorted(json.load(sys.stdin).keys())))" 2>/dev/null || echo "FAIL")
expected="circuit_breaker,cost_by_day,cost_by_model,cost_by_task_type,leaderboard,model_performance,recent_tasks,task_counts"
if [ "$stats_keys" = "$expected" ]; then
  check "Stats Endpoint" "PASS"
else
  check "Stats Endpoint" "FAIL" "got: $stats_keys"
fi

# ── 7. Model ladder ──
echo -e "\n▶ Test 7: Model Ladder"
ladder_bad=$(grep -n "sonnet" "$INFRA/vault-mcp/src/logic/escalation.ts" "$INFRA/vault-mcp/src/logic/chooser.ts" \
  "$INFRA/vault-mcp/src/tools/pricing.ts" 2>/dev/null | \
  grep -c "sonnet-4-5\|sonnet-4-20250514\|sonnet-4-5-20250929" || true)
if [ "$ladder_bad" -eq 0 ]; then check "Model Ladder" "PASS"; else check "Model Ladder" "FAIL" "$ladder_bad stale refs"; fi

# ── 8. Dashboard HTTP ──
echo -e "\n▶ Test 8: Dashboard HTTP"
dash=$(curl -so /dev/null -w '%{http_code}' "https://dashboard-cbn.pages.dev" 2>/dev/null)
if [ "$dash" = "200" ]; then check "Dashboard HTTP" "PASS"; else check "Dashboard HTTP" "FAIL" "status=$dash"; fi

# ── 9. Executor health ──
echo -e "\n▶ Test 9: Executor Health"
exec_st=$(curl -sf "https://executor.deltaops.dev/health" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
if [ -n "$exec_st" ]; then check "Executor Health" "PASS" "status=$exec_st"; else check "Executor Health" "FAIL" "no response"; fi

# ── 10. Workflow data in D1 (tasks exist) ──
echo -e "\n▶ Test 10: Workflow Data"
task_count=$(curl -sf "$VAULT_URL/workflow/stats" -H "Authorization: Bearer $VAULT_TOKEN" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
tc=d.get('task_counts',[])
total=sum(t.get('count',0) for t in tc)
print(total)
" 2>/dev/null || echo "0")
if [ "$task_count" -gt 0 ]; then
  check "Workflow Data" "PASS" "$task_count tasks"
else
  check "Workflow Data" "FAIL" "no tasks"
fi

# ── 11. Search returns title field ──
echo -e "\n▶ Test 11: Search Title Field"
title_check=$(curl -sf "$VAULT_URL/search?q=bismillah&limit=1" -H "Authorization: Bearer $VAULT_TOKEN" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('results',[])
print('yes' if r and 'title' in r[0] else 'no')
" 2>/dev/null || echo "no")
if [ "$title_check" = "yes" ]; then check "Search Title Field" "PASS"; else check "Search Title Field" "FAIL"; fi

# ── 12. Transcript service ──
echo -e "\n▶ Test 12: Transcript Service"
check "Transcript Service" "SKIP" "VPS port 8081 not tunneled — manual test"

# ── 13. Circuit breaker data ──
echo -e "\n▶ Test 13: Circuit Breaker"
cb=$(curl -sf "$VAULT_URL/workflow/stats" -H "Authorization: Bearer $VAULT_TOKEN" 2>/dev/null | python3 -c "
import sys,json
cb=json.load(sys.stdin).get('circuit_breaker',{})
has_keys='daily_cost_usd' in cb and 'monthly_cost_usd' in cb and 'halted' in cb
print('yes' if has_keys else 'no')
" 2>/dev/null || echo "no")
if [ "$cb" = "yes" ]; then check "Circuit Breaker" "PASS"; else check "Circuit Breaker" "FAIL"; fi

# ══════════════════════════════════════════════
echo -e "\n══════════════════════════════════════════════"
echo " RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
echo "══════════════════════════════════════════════"
for r in "${RESULTS[@]}"; do echo " $r"; done
echo ""
echo "Manual tests (you):"
echo "  • /bismillah in new Claude.ai session"
echo "  • /done in same session"  
echo "  • Dashboard visual check (5 tabs)"
echo "══════════════════════════════════════════════"
