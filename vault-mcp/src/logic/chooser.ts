// Model routing: data-driven (50+ tasks) with rule-based fallback
// Efficiency score: W1*success_rate + W2*normCost + W3*normLatency + W4*(1-correction_rate)

const W1 = 0.35; // success rate weight
const W2 = 0.25; // cost weight (inverted — lower is better)
const W3 = 0.15; // latency weight (inverted)
const W4 = 0.25; // correction rate weight (inverted)

const DATA_DRIVEN_THRESHOLD = 50;

interface ChooserParams {
  task_type: string;
  complexity: string;
  language?: string;
  stack?: string;
  context_tokens?: number;
}

interface ModelStat {
  model: string;
  total_tasks: number;
  successes: number;
  failures: number;
  avg_cost_usd: number;
  avg_latency_ms: number;
  first_attempt_success_rate: number;
  human_correction_rate: number;
}

interface Recommendation {
  model: string;
  method: "data-driven" | "rule-based";
  confidence: string;
  reasoning: string;
  alternatives?: Array<{ model: string; score: number }>;
}

function computeEfficiencyScore(
  stat: ModelStat,
  maxCost: number,
  maxLatency: number,
): number {
  const normCost = maxCost > 0 ? 1 - stat.avg_cost_usd / maxCost : 1;
  const normLatency = maxLatency > 0 ? 1 - stat.avg_latency_ms / maxLatency : 1;
  return (
    W1 * stat.first_attempt_success_rate +
    W2 * normCost +
    W3 * normLatency +
    W4 * (1 - stat.human_correction_rate)
  );
}

export function ruleBasedRoute(params: ChooserParams): Recommendation {
  const { task_type, complexity, context_tokens } = params;

  // Complex tasks → opus
  if (complexity === "complex") {
    return {
      model: "claude-sonnet-4-20250514",
      method: "rule-based",
      confidence: "medium",
      reasoning: `Complex ${task_type} — sonnet for balance of quality and cost`,
    };
  }

  // Large context → sonnet (handles it well)
  if (context_tokens && context_tokens > 100000) {
    return {
      model: "claude-sonnet-4-20250514",
      method: "rule-based",
      confidence: "medium",
      reasoning: `Large context (${context_tokens} tokens) — sonnet for extended context handling`,
    };
  }

  // Review/docs → haiku (cheaper, fast)
  if (task_type === "review" || task_type === "docs") {
    return {
      model: "claude-haiku-4-5-20251001",
      method: "rule-based",
      confidence: "high",
      reasoning: `${task_type} task — haiku for fast, cost-effective processing`,
    };
  }

  // Trivial → haiku
  if (complexity === "trivial") {
    return {
      model: "claude-haiku-4-5-20251001",
      method: "rule-based",
      confidence: "high",
      reasoning: `Trivial ${task_type} — haiku is sufficient`,
    };
  }

  // Default → sonnet
  return {
    model: "claude-sonnet-4-20250514",
    method: "rule-based",
    confidence: "medium",
    reasoning: `${complexity} ${task_type} — sonnet as default balance`,
  };
}

export async function getChooserRecommendation(
  db: D1Database,
  params: ChooserParams,
): Promise<Recommendation> {
  // Check if we have enough data for data-driven routing
  const stats = await db
    .prepare(
      `SELECT model, total_tasks, successes, failures, avg_cost_usd, avg_latency_ms,
              first_attempt_success_rate, human_correction_rate
       FROM model_stats
       WHERE task_type = ? AND complexity = ?
       ORDER BY total_tasks DESC`,
    )
    .bind(params.task_type, params.complexity)
    .all<ModelStat>();

  const rows = stats.results ?? [];
  const totalTasks = rows.reduce((sum, r) => sum + r.total_tasks, 0);

  if (totalTasks < DATA_DRIVEN_THRESHOLD) {
    return ruleBasedRoute(params);
  }

  // Data-driven: compute efficiency scores
  const maxCost = Math.max(...rows.map((r) => r.avg_cost_usd), 0.001);
  const maxLatency = Math.max(...rows.map((r) => r.avg_latency_ms), 1);

  const scored = rows
    .filter((r) => r.total_tasks >= 5) // minimum sample size
    .map((r) => ({
      model: r.model,
      score: computeEfficiencyScore(r, maxCost, maxLatency),
      tasks: r.total_tasks,
    }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return ruleBasedRoute(params);
  }

  const best = scored[0];
  return {
    model: best.model,
    method: "data-driven",
    confidence: best.tasks >= 20 ? "high" : "medium",
    reasoning: `Best efficiency score (${best.score.toFixed(3)}) from ${best.tasks} tasks`,
    alternatives: scored.slice(1, 3).map((s) => ({ model: s.model, score: s.score })),
  };
}
