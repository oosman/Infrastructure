import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  Activity, DollarSign, Trophy, List, BarChart3, Settings,
  RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock,
  Zap, Server, Database, Cpu, Shield, Eye, Loader2,
  Wifi, WifiOff, ChevronDown, ChevronUp, Timer,
} from "lucide-react";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const MODEL_COLORS = {
  "opus-4-6": "#8b5cf6", "sonnet-4-6": "#3b82f6", "sonnet-4-20250514": "#3b82f6",
  "haiku-4-5": "#10b981", "gpt-5.3-codex": "#f59e0b", "gemini-3.1-pro": "#ef4444",
  "gemini-3-flash": "#ec4899", "deepseek-v3": "#06b6d4",
};

const TABS = [
  { id: "health", label: "Health", Icon: Activity },
  { id: "cost", label: "Cost", Icon: DollarSign },
  { id: "leaderboard", label: "Leaderboard", Icon: Trophy },
  { id: "tasks", label: "Tasks", Icon: List },
  { id: "analytics", label: "Analytics", Icon: BarChart3 },
];

const short = (m) => m?.replace("claude-", "").replace("-20250514", "").replace("-20251001", "").replace("-preview", "") ?? "—";
const fmt$ = (n) => n == null ? "—" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
const fmtMs = (ms) => ms == null ? "—" : ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
const fmtPct = (n) => n == null ? "—" : `${(n * 100).toFixed(0)}%`;
const ago = (iso) => {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const modelColor = (m) => MODEL_COLORS[short(m)] || "#6b7280";

const Card = ({ children, className = "" }) => (
  <div className={`bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 ${className}`}>{children}</div>
);

const Badge = ({ color, children }) => {
  const colors = {
    emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    gray: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[color] || colors.gray}`}>{children}</span>;
};

const statusBadge = (s) => {
  const map = { closed: "emerald", open: "blue", in_progress: "amber", ok: "emerald", degraded: "amber", error: "red", halted: "red" };
  return <Badge color={map[s] || "gray"}>{s}</Badge>;
};

const typeBadge = (t) => {
  const map = { fix: "red", feature: "blue", test: "emerald", refactor: "purple", review: "amber", docs: "gray" };
  return <Badge color={map[t] || "gray"}>{t}</Badge>;
};

const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-slate-700/50 rounded ${className}`} />
);

const Stat = ({ label, value, sub, Icon, color = "text-blue-400" }) => (
  <Card>
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      {Icon && <Icon className={`w-4 h-4 ${color}`} />}
    </div>
    <div className="text-2xl font-semibold text-white">{value}</div>
    {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
  </Card>
);

const ChartTip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-white font-medium">{formatter ? formatter(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const HealthTab = ({ health, stats, state }) => {
  if (!health) return <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  const services = [
    { name: "vault-mcp", status: health.status || "ok", icon: Server, detail: health.version },
    { name: "D1", status: health.d1 === "connected" ? "ok" : "error", icon: Database, detail: health.d1 },
    { name: "KV", status: health.kv === "connected" ? "ok" : "error", icon: Cpu, detail: health.kv },
    { name: "Executor", status: health.executor === "reachable" ? "ok" : "error", icon: Zap, detail: health.executor },
  ];
  const cb = stats?.circuit_breaker || {};
  const stateData = state || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {services.map((s) => (
          <Card key={s.name}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.status === "ok" ? "text-emerald-400" : "text-red-400"}`} />
              <span className="text-sm text-white font-medium">{s.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {s.status === "ok" ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
              <span className={`text-xs ${s.status === "ok" ? "text-emerald-400" : "text-red-400"}`}>{s.detail || s.status}</span>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Shield className={`w-4 h-4 ${cb.halted ? "text-red-400" : "text-emerald-400"}`} />
            <span className="text-sm text-white font-medium">Circuit Breaker</span>
          </div>
          {statusBadge(cb.halted ? "halted" : "ok")}
          <div className="mt-2 space-y-1 text-xs text-slate-400">
            <div>Total: {fmt$(cb.total_spent)}</div>
            <div>Today: {fmt$(cb.daily_spent)}</div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <List className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-white font-medium">Open Tasks</span>
          </div>
          <div className="text-2xl font-semibold text-white">{stateData.open_tasks?.length ?? "—"}</div>
          {(stateData.open_tasks || []).slice(0, 3).map((t) => (
            <div key={t.id} className="text-xs text-slate-400 mt-1 truncate">
              {typeBadge(t.task_type)} <span className="ml-1">{t.id?.slice(0, 10)}… {fmt$(t.total_cost_usd)}</span>
            </div>
          ))}
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-white font-medium">Recent Closed</span>
          </div>
          <div className="text-2xl font-semibold text-white">{stateData.recent_closed?.length ?? "—"}</div>
          {(stateData.recent_closed || []).slice(0, 3).map((t) => (
            <div key={t.id} className="text-xs text-slate-400 mt-1 truncate">
              {typeBadge(t.task_type)} <span className="ml-1">{ago(t.completed_at)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

const CostTab = ({ stats }) => {
  if (!stats) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64" />)}</div>;
  const totalSpend = (stats.task_counts || []).reduce((a, t) => a + (t.total_cost || 0), 0);
  const byDay = (stats.cost_by_day || []).slice(0, 14).reverse();
  const byModel = (stats.cost_by_model || []).map((m) => ({ ...m, name: short(m.model) }));
  const byType = (stats.cost_by_task_type || []);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total Spend" value={fmt$(totalSpend)} Icon={DollarSign} color="text-emerald-400" />
        <Stat label="Stages" value={byModel.reduce((a, m) => a + (m.count || 0), 0)} sub="total executions" Icon={Zap} />
        <Stat label="Today" value={fmt$(stats.circuit_breaker?.daily_spent)} sub="daily spend" Icon={Timer} color="text-amber-400" />
      </div>
      <Card>
        <h3 className="text-sm text-slate-300 font-medium mb-3">Cost by Day (last 14d)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(d) => d?.slice(5)} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<ChartTip formatter={fmt$} />} />
            <Bar dataKey="total_cost" name="Cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm text-slate-300 font-medium mb-3">Cost by Model</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byModel} dataKey="total_cost" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {byModel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTip formatter={fmt$} />} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="text-sm text-slate-300 font-medium mb-3">Cost by Task Type</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
              <YAxis type="category" dataKey="task_type" tick={{ fill: "#94a3b8", fontSize: 10 }} width={60} />
              <Tooltip content={<ChartTip formatter={fmt$} />} />
              <Bar dataKey="total_cost" name="Cost" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};

const LeaderboardTab = ({ stats }) => {
  if (!stats) return <Skeleton className="h-96" />;
  const board = (stats.leaderboard || []).map((m) => ({
    ...m, name: short(m.model),
    efficiency: m.avg_cost > 0 ? (1 / m.avg_cost).toFixed(1) : "—",
  }));
  const perfByModel = {};
  (stats.model_performance || []).forEach((p) => {
    const name = short(p.model);
    if (!perfByModel[name]) perfByModel[name] = { success: 0, total: 0 };
    perfByModel[name].success += (p.first_attempt_success_rate || 0) * (p.total_tasks || 0);
    perfByModel[name].total += p.total_tasks || 0;
  });
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm text-slate-300 font-medium mb-3">Model Leaderboard</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Model</th>
                <th className="text-right py-2 px-2">Stages</th>
                <th className="text-right py-2 px-2">Total Cost</th>
                <th className="text-right py-2 px-2">Avg Cost</th>
                <th className="text-right py-2 px-2">Avg Latency</th>
                <th className="text-right py-2 px-2">Success %</th>
                <th className="text-right py-2 px-2">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {board.map((m, i) => {
                const perf = perfByModel[m.name] || {};
                const successRate = perf.total > 0 ? perf.success / perf.total : null;
                return (
                  <tr key={m.model || i} className="border-b border-slate-800 hover:bg-slate-700/30">
                    <td className="py-2 px-2 text-slate-500">{i + 1}</td>
                    <td className="py-2 px-2"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: modelColor(m.model) }} /><span className="text-white font-medium">{m.name}</span></td>
                    <td className="text-right py-2 px-2 text-slate-300">{m.total_stages}</td>
                    <td className="text-right py-2 px-2 text-slate-300">{fmt$(m.total_cost)}</td>
                    <td className="text-right py-2 px-2 text-slate-300">{fmt$(m.avg_cost)}</td>
                    <td className="text-right py-2 px-2 text-slate-300">{fmtMs(m.avg_latency_ms)}</td>
                    <td className="text-right py-2 px-2">{successRate != null ? <span className={successRate >= 0.8 ? "text-emerald-400" : successRate >= 0.5 ? "text-amber-400" : "text-red-400"}>{fmtPct(successRate)}</span> : <span className="text-slate-500">—</span>}</td>
                    <td className="text-right py-2 px-2 text-blue-400">{m.efficiency}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h3 className="text-sm text-slate-300 font-medium mb-3">Cost vs Latency by Model</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={board}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <YAxis yAxisId="cost" tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
            <YAxis yAxisId="latency" orientation="right" tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}s`} />
            <Tooltip content={<ChartTip formatter={(v) => typeof v === "number" && v > 100 ? fmtMs(v) : fmt$(v)} />} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar yAxisId="cost" dataKey="avg_cost" name="Avg Cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="latency" dataKey="avg_latency_ms" name="Avg Latency" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

const TaskRow = ({ task }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-800">
      <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-slate-700/20 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex-shrink-0 w-5">{open ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}</div>
        <div className="flex-shrink-0">{typeBadge(task.task_type)}</div>
        <div className="flex-shrink-0">{statusBadge(task.status)}</div>
        <div className="flex-shrink-0"><Badge color="gray">{task.complexity}</Badge></div>
        <div className="flex-1 text-xs text-slate-400 font-mono truncate">{task.id}</div>
        <div className="flex-shrink-0 text-xs text-slate-300 w-16 text-right">{fmt$(task.total_cost_usd)}</div>
        <div className="flex-shrink-0 text-xs text-slate-400 w-16 text-right">{fmtMs(task.total_latency_ms)}</div>
        <div className="flex-shrink-0 text-xs text-slate-500 w-16 text-right">{ago(task.created_at)}</div>
      </div>
      {open && (
        <div className="px-12 pb-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><span className="text-slate-500">Model:</span> <span className="text-slate-300">{short(task.final_model)}</span></div>
          <div><span className="text-slate-500">1st attempt:</span> <span className={task.first_attempt_success ? "text-emerald-400" : "text-red-400"}>{task.first_attempt_success ? "✓" : "✗"}</span></div>
          <div><span className="text-slate-500">Created:</span> <span className="text-slate-300">{task.created_at?.slice(0, 16)}</span></div>
          <div><span className="text-slate-500">Completed:</span> <span className="text-slate-300">{task.completed_at?.slice(0, 16) || "—"}</span></div>
        </div>
      )}
    </div>
  );
};

const TasksTab = ({ stats }) => {
  if (!stats) return <Skeleton className="h-96" />;
  const tasks = stats.recent_tasks || [];
  const counts = {};
  (stats.task_counts || []).forEach((t) => { counts[t.status] = t.count; });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Open" value={counts.open || 0} Icon={Eye} color="text-blue-400" />
        <Stat label="In Progress" value={counts.in_progress || 0} Icon={Loader2} color="text-amber-400" />
        <Stat label="Closed" value={counts.closed || 0} Icon={CheckCircle} color="text-emerald-400" />
        <Stat label="Total" value={Object.values(counts).reduce((a, b) => a + b, 0)} Icon={List} />
      </div>
      <Card className="p-0">
        <div className="px-4 py-2.5 border-b border-slate-700 flex items-center gap-3">
          <span className="text-sm text-slate-300 font-medium">Recent Tasks</span>
          <span className="text-xs text-slate-500">{tasks.length} shown</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {tasks.length === 0 ? <div className="text-center text-slate-500 text-sm py-8">No tasks yet</div> : tasks.map((t) => <TaskRow key={t.id} task={t} />)}
        </div>
      </Card>
    </div>
  );
};

const AnalyticsTab = ({ stats }) => {
  if (!stats) return <Skeleton className="h-96" />;
  const byDay = (stats.cost_by_day || []).slice(0, 14).reverse();
  const byModel = (stats.cost_by_model || []).map((m) => ({ ...m, name: short(m.model) }));
  const perfData = (stats.model_performance || []).map((p) => ({
    label: `${short(p.model)} / ${p.task_type} / ${p.complexity}`,
    success: p.first_attempt_success_rate, tasks: p.total_tasks,
  })).filter((p) => p.tasks >= 1).slice(0, 15);
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm text-slate-300 font-medium mb-3">Execution Volume by Day</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={byDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(d) => d?.slice(5)} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <Tooltip content={<ChartTip />} />
            <Line type="monotone" dataKey="stage_count" name="Stages" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm text-slate-300 font-medium mb-3">Avg Cost per Execution by Model</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byModel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<ChartTip formatter={fmt$} />} />
              <Bar dataKey="avg_cost" name="Avg Cost" radius={[4, 4, 0, 0]}>
                {byModel.map((m, i) => <Cell key={i} fill={modelColor(m.model)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="text-sm text-slate-300 font-medium mb-3">Success Rate by Model × Type × Complexity</h3>
          <div className="max-h-48 overflow-y-auto">
            {perfData.length === 0 ? <div className="text-slate-500 text-xs text-center py-4">No performance data</div> : perfData.map((p, i) => (
              <div key={i} className="flex items-center gap-2 py-1 text-xs">
                <span className="flex-1 text-slate-400 truncate">{p.label}</span>
                <span className="text-slate-500 w-8 text-right">n={p.tasks}</span>
                <div className="w-24 bg-slate-700 rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ width: `${(p.success || 0) * 100}%`, background: p.success >= 0.8 ? "#10b981" : p.success >= 0.5 ? "#f59e0b" : "#ef4444" }} />
                </div>
                <span className="w-10 text-right text-slate-300">{fmtPct(p.success)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

const SettingsPanel = ({ url, setUrl, token, setToken, onClose }) => (
  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <h2 className="text-white text-lg font-semibold mb-4">Settings</h2>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1">vault-mcp URL</label>
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" placeholder="https://vault.deltaops.dev" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Bearer Token</label>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" placeholder="paste token here" />
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <button onClick={onClose} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">Done</button>
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const [tab, setTab] = useState("health");
  const [url, setUrl] = useState("https://vault.deltaops.dev");
  const [token, setToken] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [state, setState] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const timerRef = useRef(null);

  const headers = useCallback(() => {
    const h = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }, [token]);

  const fetchAll = useCallback(async () => {
    if (!token) { setError("Set Bearer token in Settings"); return; }
    setLoading(true); setError(null);
    try {
      const [hRes, sRes, stRes] = await Promise.allSettled([
        fetch(`${url}/health`, { headers: headers() }).then((r) => r.json()),
        fetch(`${url}/workflow/stats`, { headers: headers() }).then((r) => r.json()),
        fetch(`${url}/workflow/state/current`, { headers: headers() }).then((r) => r.json()),
      ]);
      if (hRes.status === "fulfilled") setHealth(hRes.value);
      if (sRes.status === "fulfilled") setStats(sRes.value);
      if (stRes.status === "fulfilled") setState(stRes.value);
      if (hRes.status === "rejected" && sRes.status === "rejected") throw new Error("All fetches failed");
      setLastFetch(new Date());
    } catch (e) { setError(e.message || "Fetch failed"); }
    finally { setLoading(false); setCountdown(60); }
  }, [url, token, headers]);

  useEffect(() => {
    if (!autoRefresh || !token) return;
    timerRef.current = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { fetchAll(); return 60; } return c - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [autoRefresh, token, fetchAll]);

  useEffect(() => { if (token) fetchAll(); }, [token]);
  useEffect(() => { if (!token) setShowSettings(true); }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {showSettings && <SettingsPanel url={url} setUrl={setUrl} token={token} setToken={setToken} onClose={() => setShowSettings(false)} />}
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold">Infrastructure Dashboard</h1>
            {lastFetch && <span className="text-xs text-slate-500">{ago(lastFetch.toISOString())}</span>}
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-400 mr-2">{error}</span>}
            <button onClick={() => setAutoRefresh(!autoRefresh)} className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${autoRefresh ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
              {autoRefresh ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {autoRefresh ? `${countdown}s` : "Auto"}
            </button>
            <button onClick={fetchAll} disabled={loading} className="p-1.5 rounded hover:bg-slate-800 transition-colors">
              <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => setShowSettings(true)} className="p-1.5 rounded hover:bg-slate-800 transition-colors">
              <Settings className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
      <div className="border-b border-slate-800 px-4">
        <div className="max-w-7xl mx-auto flex gap-1">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 transition-colors ${tab === id ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-4">
        {tab === "health" && <HealthTab health={health} stats={stats} state={state} />}
        {tab === "cost" && <CostTab stats={stats} />}
        {tab === "leaderboard" && <LeaderboardTab stats={stats} />}
        {tab === "tasks" && <TasksTab stats={stats} />}
        {tab === "analytics" && <AnalyticsTab stats={stats} />}
      </div>
    </div>
  );
}
