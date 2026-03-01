import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  Activity, DollarSign, Trophy, List, BarChart3, Settings,
  RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock,
  Zap, Server, Database, Cpu, Shield, ChevronRight, Eye,
  Loader2, Wifi, WifiOff,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const MODEL_COLORS = { "claude-opus-4-6": "#8b5cf6", "claude-sonnet-4-20250514": "#3b82f6", "claude-haiku-4-5-20251001": "#10b981" };
const STATUS_COLORS = { ok: "text-emerald-400", degraded: "text-amber-400", error: "text-red-400" };
const TABS = [
  { id: "health", label: "Health", icon: Activity },
  { id: "cost", label: "Cost", icon: DollarSign },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "tasks", label: "Tasks", icon: List },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

const shortModel = (m) => m?.replace("claude-", "").replace("-20250514", "").replace("-20251001", "") ?? "—";
const fmt$ = (n) => n == null ? "—" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
const fmtMs = (ms) => ms == null ? "—" : ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
const fmtPct = (n) => n == null ? "—" : `${(n * 100).toFixed(0)}%`;
const timeAgo = (iso) => {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// ── Mock Data (matches vault-mcp response shapes) ─────────────────────────────

const MOCK_HEALTH = {
  status: "ok", version: "2.0.0", timestamp: new Date().toISOString(),
  d1: "connected", kv: "connected", executor: "reachable",
};

const MOCK_STATS = {
  task_counts: [
    { status: "closed", count: 47, total_cost: 3.82 },
    { status: "open", count: 3, total_cost: 0.15 },
    { status: "in_progress", count: 1, total_cost: 0.08 },
  ],
  cost_by_model: [
    { model: "claude-sonnet-4-20250514", count: 38, total_cost: 2.45, avg_cost: 0.064 },
    { model: "claude-haiku-4-5-20251001", count: 9, total_cost: 0.12, avg_cost: 0.013 },
    { model: "claude-opus-4-6", count: 4, total_cost: 1.48, avg_cost: 0.370 },
  ],
  model_performance: [
    { model: "claude-sonnet-4-20250514", task_type: "feature", complexity: "moderate", total_tasks: 15, first_attempt_success_rate: 0.80, human_correction_rate: 0.13, avg_cost_usd: 0.072 },
    { model: "claude-sonnet-4-20250514", task_type: "fix", complexity: "simple", total_tasks: 12, first_attempt_success_rate: 0.92, human_correction_rate: 0.08, avg_cost_usd: 0.041 },
    { model: "claude-haiku-4-5-20251001", task_type: "docs", complexity: "trivial", total_tasks: 6, first_attempt_success_rate: 0.83, human_correction_rate: 0.17, avg_cost_usd: 0.008 },
    { model: "claude-sonnet-4-20250514", task_type: "refactor", complexity: "complex", total_tasks: 5, first_attempt_success_rate: 0.60, human_correction_rate: 0.40, avg_cost_usd: 0.095 },
    { model: "claude-opus-4-6", task_type: "feature", complexity: "complex", total_tasks: 3, first_attempt_success_rate: 0.67, human_correction_rate: 0.33, avg_cost_usd: 0.410 },
    { model: "claude-haiku-4-5-20251001", task_type: "review", complexity: "simple", total_tasks: 3, first_attempt_success_rate: 1.00, human_correction_rate: 0.00, avg_cost_usd: 0.015 },
    { model: "claude-sonnet-4-20250514", task_type: "test", complexity: "simple", total_tasks: 6, first_attempt_success_rate: 0.83, human_correction_rate: 0.17, avg_cost_usd: 0.055 },
    { model: "claude-opus-4-6", task_type: "review", complexity: "complex", total_tasks: 1, first_attempt_success_rate: 1.00, human_correction_rate: 0.00, avg_cost_usd: 0.280 },
  ],
  circuit_breaker: {
    daily_cost_usd: 1.24, monthly_cost_usd: 4.05,
    daily_task_count: 4, monthly_task_count: 51,
    halted: false, alert: false, message: null,
  },
};

const MOCK_STATE = {
  open_tasks: [
    { id: "01JNBK7X9F", task_type: "feature", complexity: "moderate", status: "in_progress", total_cost_usd: 0.08, created_at: "2026-02-28T14:30:00Z" },
    { id: "01JNBL3M2A", task_type: "fix", complexity: "simple", status: "open", total_cost_usd: 0, created_at: "2026-02-28T15:10:00Z" },
    { id: "01JNBM9P4C", task_type: "docs", complexity: "trivial", status: "open", total_cost_usd: 0, created_at: "2026-02-28T16:00:00Z" },
  ],
  recent_closed: [
    { id: "01JNA1Q8K2", task_type: "feature", complexity: "complex", status: "closed", total_cost_usd: 0.42, completed_at: "2026-02-28T12:00:00Z" },
    { id: "01JNA2R3J7", task_type: "fix", complexity: "simple", status: "closed", total_cost_usd: 0.03, completed_at: "2026-02-28T10:30:00Z" },
    { id: "01JNA3S5L1", task_type: "refactor", complexity: "moderate", status: "closed", total_cost_usd: 0.09, completed_at: "2026-02-27T22:15:00Z" },
    { id: "01JNA4T7N9", task_type: "test", complexity: "simple", status: "closed", total_cost_usd: 0.05, completed_at: "2026-02-27T18:45:00Z" },
    { id: "01JNA5U2M4", task_type: "docs", complexity: "trivial", status: "closed", total_cost_usd: 0.01, completed_at: "2026-02-27T16:30:00Z" },
    { id: "01JNA6V4P6", task_type: "feature", complexity: "moderate", status: "closed", total_cost_usd: 0.07, completed_at: "2026-02-27T14:00:00Z" },
    { id: "01JNA7W6R8", task_type: "fix", complexity: "simple", status: "closed", total_cost_usd: 0.02, completed_at: "2026-02-27T11:20:00Z" },
    { id: "01JNA8X8T3", task_type: "feature", complexity: "complex", status: "closed", total_cost_usd: 0.38, completed_at: "2026-02-26T20:00:00Z" },
  ],
};

// ── Reusable Components ───────────────────────────────────────────────────────

function Card({ children, className = "" }) {
  return <div className={`bg-slate-800 border border-slate-700 rounded-lg p-4 ${className}`}>{children}</div>;
}

function MetricCard({ icon: Icon, label, value, sub, color = "text-blue-400" }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={color} />
        <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-100">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </Card>
  );
}

function StatusDot({ ok }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />;
}

function Badge({ children, color = "bg-slate-700 text-slate-300" }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{children}</span>;
}

const complexityColor = {
  trivial: "bg-slate-600 text-slate-300",
  simple: "bg-blue-900 text-blue-300",
  moderate: "bg-amber-900 text-amber-300",
  complex: "bg-red-900 text-red-300",
};

const statusBadge = {
  open: "bg-blue-900 text-blue-300",
  in_progress: "bg-amber-900 text-amber-300",
  closed: "bg-emerald-900 text-emerald-300",
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-xs shadow-xl">
      {label && <div className="text-slate-400 mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="text-slate-200">
          <span style={{ color: p.color }}>{p.name}:</span> {typeof p.value === "number" && p.name?.includes("cost") ? fmt$(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

// ── Health View ───────────────────────────────────────────────────────────────

function HealthView({ health, stats }) {
  const cb = stats?.circuit_breaker;
  const services = [
    { name: "vault-mcp", status: health?.status, icon: Server, detail: `v${health?.version ?? "—"}` },
    { name: "D1 Database", status: health?.d1 === "connected" ? "ok" : "error", icon: Database, detail: health?.d1 },
    { name: "KV Store", status: health?.kv === "connected" ? "ok" : "error", icon: Database, detail: health?.kv },
    { name: "Executor", status: health?.executor === "reachable" ? "ok" : "error", icon: Cpu, detail: health?.executor },
  ];
  const dailyPct = cb ? Math.min((cb.daily_cost_usd / 20) * 100, 100) : 0;
  const monthlyPct = cb ? Math.min((cb.monthly_cost_usd / 80) * 100, 100) : 0;
  const totalTasks = stats?.task_counts?.reduce((s, t) => s + t.count, 0) ?? 0;
  const totalCost = stats?.task_counts?.reduce((s, t) => s + t.total_cost, 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {services.map((s) => (
          <Card key={s.name}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={14} className="text-slate-400" />
              <span className="text-xs text-slate-400">{s.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot ok={s.status === "ok"} />
              <span className={`text-sm font-semibold ${s.status === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                {s.status === "ok" ? "Healthy" : "Down"}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">{s.detail}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Shield size={14} className={cb?.halted ? "text-red-400" : cb?.alert ? "text-amber-400" : "text-emerald-400"} />
          <span className="text-sm font-semibold text-slate-200">Circuit Breaker</span>
          {cb?.halted && <Badge color="bg-red-900 text-red-300">HALTED</Badge>}
          {cb?.alert && !cb?.halted && <Badge color="bg-amber-900 text-amber-300">ALERT</Badge>}
        </div>
        {cb?.message && <div className="text-xs text-red-400 mb-3 font-mono">{cb.message}</div>}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Daily spend</span>
              <span>{fmt$(cb?.daily_cost_usd)} / $20.00</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${dailyPct > 80 ? "bg-red-500" : dailyPct > 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${dailyPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Monthly spend</span>
              <span>{fmt$(cb?.monthly_cost_usd)} / $80.00</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${monthlyPct > 80 ? "bg-red-500" : monthlyPct > 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${monthlyPct}%` }} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <MetricCard icon={CheckCircle} label="Total Tasks" value={totalTasks} sub={`${stats?.task_counts?.find(t => t.status === "closed")?.count ?? 0} completed`} color="text-emerald-400" />
        <MetricCard icon={DollarSign} label="Total Spend" value={fmt$(totalCost)} sub={`avg ${fmt$(totalTasks ? totalCost / totalTasks : 0)}/task`} color="text-blue-400" />
        <MetricCard icon={Zap} label="Today" value={cb?.daily_task_count ?? 0} sub={`${fmt$(cb?.daily_cost_usd)} spent`} color="text-amber-400" />
      </div>
    </div>
  );
}

// ── Cost View ─────────────────────────────────────────────────────────────────

function CostView({ stats }) {
  const costByModel = (stats?.cost_by_model ?? []).map((m) => ({
    name: shortModel(m.model), cost: m.total_cost, count: m.count, avg: m.avg_cost,
  }));
  const costByType = {};
  (stats?.model_performance ?? []).forEach((p) => {
    costByType[p.task_type] = (costByType[p.task_type] ?? 0) + p.total_tasks * p.avg_cost_usd;
  });
  const typeData = Object.entries(costByType).map(([k, v]) => ({ name: k, cost: v })).sort((a, b) => b.cost - a.cost);
  const costByComplexity = {};
  (stats?.model_performance ?? []).forEach((p) => {
    costByComplexity[p.complexity] = (costByComplexity[p.complexity] ?? 0) + p.total_tasks * p.avg_cost_usd;
  });
  const complexityData = Object.entries(costByComplexity).map(([k, v]) => ({ name: k, cost: v }));
  const totalCost = costByModel.reduce((s, m) => s + m.cost, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard icon={DollarSign} label="Total Spend" value={fmt$(totalCost)} color="text-blue-400" />
        <MetricCard icon={BarChart3} label="Models Used" value={costByModel.length} color="text-violet-400" />
        <MetricCard icon={Activity} label="Task Types" value={typeData.length} color="text-emerald-400" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Spend by Model</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={costByModel} dataKey="cost" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {costByModel.map((_, i) => <Cell key={i} fill={Object.values(MODEL_COLORS)[i] ?? CHART_COLORS[i]} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Spend by Task Type</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={typeData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
              <YAxis dataKey="name" type="category" tick={{ fill: "#94a3b8", fontSize: 11 }} width={60} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="cost" name="cost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Spend by Complexity</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={complexityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="cost" name="cost" fill="#f59e0b" radius={[4, 4, 0, 0]}>
              {complexityData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Model Cost Breakdown</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
              <th className="pb-2">Model</th><th className="pb-2 text-right">Tasks</th><th className="pb-2 text-right">Total</th><th className="pb-2 text-right">Avg/Task</th><th className="pb-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {costByModel.map((m) => (
              <tr key={m.name} className="border-b border-slate-700/50 text-slate-300">
                <td className="py-2 font-mono text-xs">{m.name}</td>
                <td className="py-2 text-right">{m.count}</td>
                <td className="py-2 text-right font-mono">{fmt$(m.cost)}</td>
                <td className="py-2 text-right font-mono">{fmt$(m.avg)}</td>
                <td className="py-2 text-right">{fmtPct(totalCost > 0 ? m.cost / totalCost : 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Leaderboard View ──────────────────────────────────────────────────────────

function LeaderboardView({ stats }) {
  const modelAgg = {};
  (stats?.model_performance ?? []).forEach((p) => {
    if (!modelAgg[p.model]) modelAgg[p.model] = { tasks: 0, successWeighted: 0, correctionWeighted: 0, totalCost: 0 };
    const a = modelAgg[p.model];
    a.tasks += p.total_tasks;
    a.successWeighted += p.first_attempt_success_rate * p.total_tasks;
    a.correctionWeighted += p.human_correction_rate * p.total_tasks;
    a.totalCost += p.avg_cost_usd * p.total_tasks;
  });
  const leaderboard = Object.entries(modelAgg)
    .map(([model, a]) => ({
      model, tasks: a.tasks,
      successRate: a.tasks > 0 ? a.successWeighted / a.tasks : 0,
      correctionRate: a.tasks > 0 ? a.correctionWeighted / a.tasks : 0,
      avgCost: a.tasks > 0 ? a.totalCost / a.tasks : 0,
      totalCost: a.totalCost,
      efficiency: a.tasks > 0 ? (a.successWeighted / a.tasks) / Math.max(a.totalCost / a.tasks, 0.001) : 0,
    }))
    .sort((a, b) => b.efficiency - a.efficiency);

  const chartData = leaderboard.map((m) => ({
    name: shortModel(m.model),
    "Success %": Math.round(m.successRate * 100),
    "Correction %": Math.round(m.correctionRate * 100),
  }));

  return (
    <div className="space-y-4">
      <Card>
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Efficiency Ranking</div>
        <div className="text-xs text-slate-500 mb-4">Score = success_rate / avg_cost — higher is better</div>
        <div className="space-y-3">
          {leaderboard.map((m, i) => (
            <div key={m.model} className={`flex items-center gap-3 p-3 rounded-lg ${i === 0 ? "bg-emerald-900/20 border border-emerald-800/50" : "bg-slate-700/30"}`}>
              <div className={`text-2xl font-bold w-8 text-center ${i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : "text-amber-700"}`}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm text-slate-200">{shortModel(m.model)}</div>
                <div className="text-xs text-slate-500">{m.tasks} tasks</div>
              </div>
              <div className="text-right space-y-0.5">
                <div className="text-xs"><span className="text-slate-500">success:</span> <span className="text-emerald-400 font-mono">{fmtPct(m.successRate)}</span></div>
                <div className="text-xs"><span className="text-slate-500">avg cost:</span> <span className="text-blue-400 font-mono">{fmt$(m.avgCost)}</span></div>
                <div className="text-xs"><span className="text-slate-500">efficiency:</span> <span className="text-amber-400 font-mono">{m.efficiency.toFixed(1)}</span></div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Success vs Correction Rate</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
            <Bar dataKey="Success %" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Correction %" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Performance Detail</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-700">
                <th className="pb-2">Model</th><th className="pb-2">Type</th><th className="pb-2">Complexity</th>
                <th className="pb-2 text-right">Tasks</th><th className="pb-2 text-right">Success</th><th className="pb-2 text-right">Correction</th><th className="pb-2 text-right">Avg Cost</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.model_performance ?? []).sort((a, b) => b.total_tasks - a.total_tasks).map((p, i) => (
                <tr key={i} className="border-b border-slate-700/30 text-slate-300">
                  <td className="py-1.5 font-mono">{shortModel(p.model)}</td>
                  <td className="py-1.5">{p.task_type}</td>
                  <td className="py-1.5"><Badge color={complexityColor[p.complexity]}>{p.complexity}</Badge></td>
                  <td className="py-1.5 text-right">{p.total_tasks}</td>
                  <td className="py-1.5 text-right font-mono text-emerald-400">{fmtPct(p.first_attempt_success_rate)}</td>
                  <td className="py-1.5 text-right font-mono text-red-400">{fmtPct(p.human_correction_rate)}</td>
                  <td className="py-1.5 text-right font-mono">{fmt$(p.avg_cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Task Feed View ────────────────────────────────────────────────────────────

function TaskFeedView({ state }) {
  const tasks = [
    ...(state?.open_tasks ?? []).map((t) => ({ ...t, time: t.created_at, sortKey: new Date(t.created_at).getTime() })),
    ...(state?.recent_closed ?? []).map((t) => ({ ...t, time: t.completed_at ?? t.created_at, sortKey: new Date(t.completed_at ?? t.created_at).getTime() })),
  ].sort((a, b) => b.sortKey - a.sortKey);

  const statusIcon = { open: Clock, in_progress: Loader2, closed: CheckCircle };
  const statusColor = { open: "text-blue-400", in_progress: "text-amber-400", closed: "text-emerald-400" };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard icon={Clock} label="Open" value={state?.open_tasks?.length ?? 0} color="text-blue-400" />
        <MetricCard icon={Loader2} label="In Progress" value={state?.open_tasks?.filter(t => t.status === "in_progress").length ?? 0} color="text-amber-400" />
        <MetricCard icon={CheckCircle} label="Recent Closed" value={state?.recent_closed?.length ?? 0} color="text-emerald-400" />
      </div>

      <Card>
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Task Feed</div>
        <div className="space-y-1">
          {tasks.map((t) => {
            const Icon = statusIcon[t.status] ?? Clock;
            return (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                <Icon size={14} className={`flex-shrink-0 ${statusColor[t.status] ?? "text-slate-400"} ${t.status === "in_progress" ? "animate-spin" : ""}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-200 font-mono">{t.id}</span>
                    <Badge color={statusBadge[t.status]}>{t.status.replace("_", " ")}</Badge>
                    <Badge>{t.task_type}</Badge>
                    <Badge color={complexityColor[t.complexity]}>{t.complexity}</Badge>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-slate-400 font-mono">{fmt$(t.total_cost_usd)}</div>
                  <div className="text-xs text-slate-500">{timeAgo(t.time)}</div>
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && <div className="text-center text-sm text-slate-500 py-8">No tasks found</div>}
        </div>
      </Card>
    </div>
  );
}

// ── Analytics View ────────────────────────────────────────────────────────────

function AnalyticsView({ stats }) {
  const perf = stats?.model_performance ?? [];
  const byType = {};
  perf.forEach((p) => {
    if (!byType[p.task_type]) byType[p.task_type] = { tasks: 0, cost: 0, successW: 0 };
    byType[p.task_type].tasks += p.total_tasks;
    byType[p.task_type].cost += p.avg_cost_usd * p.total_tasks;
    byType[p.task_type].successW += p.first_attempt_success_rate * p.total_tasks;
  });
  const typeEfficiency = Object.entries(byType).map(([type, d]) => ({
    name: type, tasks: d.tasks,
    avgCost: d.tasks > 0 ? d.cost / d.tasks : 0,
    successRate: d.tasks > 0 ? Math.round((d.successW / d.tasks) * 100) : 0,
  })).sort((a, b) => b.tasks - a.tasks);

  const byComplexity = {};
  perf.forEach((p) => {
    if (!byComplexity[p.complexity]) byComplexity[p.complexity] = { tasks: 0, cost: 0, successW: 0 };
    byComplexity[p.complexity].tasks += p.total_tasks;
    byComplexity[p.complexity].cost += p.avg_cost_usd * p.total_tasks;
    byComplexity[p.complexity].successW += p.first_attempt_success_rate * p.total_tasks;
  });
  const complexityEfficiency = Object.entries(byComplexity).map(([c, d]) => ({
    name: c, tasks: d.tasks,
    avgCost: d.tasks > 0 ? +(d.cost / d.tasks).toFixed(4) : 0,
    successRate: d.tasks > 0 ? Math.round((d.successW / d.tasks) * 100) : 0,
  }));
  const order = ["trivial", "simple", "moderate", "complex"];
  complexityEfficiency.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  // Estimated token counts from cost (rough: Sonnet ~$3/1M in, ~$15/1M out → ~$9/1M avg)
  const tokenEstimates = (stats?.cost_by_model ?? []).map((m) => {
    const ratePerMToken = m.model.includes("haiku") ? 2.4 : m.model.includes("opus") ? 45 : 9;
    return { name: shortModel(m.model), tokens: Math.round((m.total_cost / ratePerMToken) * 1_000_000), cost: m.total_cost };
  });

  const costPerTask = perf.map((p) => ({
    label: `${p.task_type}/${p.complexity}`,
    model: shortModel(p.model),
    cost: p.avg_cost_usd,
    success: Math.round(p.first_attempt_success_rate * 100),
    tasks: p.total_tasks,
  })).sort((a, b) => b.tasks - a.tasks).slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Success Rate by Task Type</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={typeEfficiency}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="successRate" name="success %" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Cost by Complexity</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={complexityEfficiency}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="avgCost" name="avg cost" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                {complexityEfficiency.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Estimated Token Throughput</div>
        <div className="text-xs text-slate-500 mb-3">Derived from cost data and model pricing</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={tokenEstimates}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="tokens" name="est. tokens" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
              {tokenEstimates.map((e, i) => <Cell key={i} fill={Object.values(MODEL_COLORS)[i] ?? CHART_COLORS[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Cost-Performance Matrix (top 10 segments)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-700">
                <th className="pb-2">Segment</th><th className="pb-2">Model</th>
                <th className="pb-2 text-right">Tasks</th><th className="pb-2 text-right">Avg Cost</th>
                <th className="pb-2 text-right">Success</th><th className="pb-2 text-right">Cost/Success</th>
              </tr>
            </thead>
            <tbody>
              {costPerTask.map((r, i) => (
                <tr key={i} className="border-b border-slate-700/30 text-slate-300">
                  <td className="py-1.5">{r.label}</td>
                  <td className="py-1.5 font-mono">{r.model}</td>
                  <td className="py-1.5 text-right">{r.tasks}</td>
                  <td className="py-1.5 text-right font-mono">{fmt$(r.cost)}</td>
                  <td className="py-1.5 text-right font-mono text-emerald-400">{r.success}%</td>
                  <td className="py-1.5 text-right font-mono text-amber-400">{r.success > 0 ? fmt$(r.cost / (r.success / 100)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Settings Panel ────────────────────────────────────────────────────────────

function SettingsPanel({ settings, setSettings, onConnect, onDisconnect, connected, onClose }) {
  const [url, setUrl] = useState(settings.vaultUrl);
  const [token, setToken] = useState(settings.authToken);
  const [interval, setInterval_] = useState(settings.refreshInterval);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-96 max-w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">Dashboard Settings</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg">&times;</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">vault-mcp URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono" placeholder="https://vault.deltaops.dev" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Auth Token (Bearer)</label>
            <input value={token} onChange={(e) => setToken(e.target.value)} type="password" className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono" placeholder="optional" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Refresh Interval (seconds)</label>
            <select value={interval} onChange={(e) => setInterval_(+e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
              <option value={30}>30s</option><option value={60}>60s</option><option value={120}>2m</option><option value={300}>5m</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            {connected ? (
              <button onClick={() => { onDisconnect(); onClose(); }} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm py-2 rounded font-medium transition-colors">
                Disconnect
              </button>
            ) : (
              <button onClick={() => { setSettings({ vaultUrl: url, authToken: token, refreshInterval: interval }); onConnect(); onClose(); }} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm py-2 rounded font-medium transition-colors">
                Connect
              </button>
            )}
            <button onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm py-2 rounded font-medium transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("health");
  const [showSettings, setShowSettings] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [settings, setSettings] = useState({
    vaultUrl: "https://vault.deltaops.dev",
    authToken: "",
    refreshInterval: 60,
  });
  const [data, setData] = useState({
    health: MOCK_HEALTH,
    stats: MOCK_STATS,
    state: MOCK_STATE,
  });

  const fetchData = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    const base = settings.vaultUrl.replace(/\/$/, "");
    const headers = { "Content-Type": "application/json" };
    if (settings.authToken) headers["Authorization"] = `Bearer ${settings.authToken}`;

    try {
      const [healthRes, statsRes, stateRes] = await Promise.allSettled([
        fetch(`${base}/health`, { headers }).then((r) => r.json()),
        fetch(`${base}/workflow/stats`, { headers }).then((r) => r.json()),
        fetch(`${base}/workflow/state/current`, { headers }).then((r) => r.json()),
      ]);
      setData({
        health: healthRes.status === "fulfilled" ? healthRes.value : data.health,
        stats: statsRes.status === "fulfilled" ? statsRes.value : data.stats,
        state: stateRes.status === "fulfilled" ? stateRes.value : data.state,
      });
      setLastRefresh(new Date());
      const failed = [healthRes, statsRes, stateRes].filter((r) => r.status === "rejected");
      if (failed.length === 3) throw new Error("All endpoints unreachable");
      if (failed.length > 0) setError(`${failed.length}/3 endpoints failed`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [connected, settings, data]);

  const handleConnect = useCallback(() => {
    setConnected(true);
    setTimeout(() => fetchData(), 100);
  }, [fetchData]);

  const handleDisconnect = useCallback(() => {
    setConnected(false);
    setData({ health: MOCK_HEALTH, stats: MOCK_STATS, state: MOCK_STATE });
    setError(null);
  }, []);

  useEffect(() => {
    if (!connected) return;
    const id = setInterval(fetchData, settings.refreshInterval * 1000);
    return () => clearInterval(id);
  }, [connected, settings.refreshInterval, fetchData]);

  const tabContent = {
    health: <HealthView health={data.health} stats={data.stats} />,
    cost: <CostView stats={data.stats} />,
    leaderboard: <LeaderboardView stats={data.stats} />,
    tasks: <TaskFeedView state={data.state} />,
    analytics: <AnalyticsView stats={data.stats} />,
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-100">Infrastructure</h1>
          <div className="flex items-center gap-1.5">
            {connected ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-slate-500" />}
            <span className="text-xs text-slate-500">{connected ? "Live" : "Demo"}</span>
          </div>
          {!connected && (
            <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded">sample data — connect in settings</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle size={12} />
              <span>{error}</span>
            </div>
          )}
          {lastRefresh && (
            <span className="text-xs text-slate-500">{timeAgo(lastRefresh.toISOString())}</span>
          )}
          <button onClick={fetchData} disabled={!connected || loading} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors" title="Refresh">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors" title="Settings">
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-4 border-b border-slate-800 pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t transition-colors ${
              activeTab === tab.id
                ? "bg-slate-800 text-slate-100 border-b-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-w-5xl">{tabContent[activeTab]}</div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          setSettings={setSettings}
          connected={connected}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
