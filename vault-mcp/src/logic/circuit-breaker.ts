import { today, thisMonth, now } from "../utils";
import type { Env } from "../env";

export interface CircuitBreakerState {
  daily_cost_usd: number;
  monthly_cost_usd: number;
  daily_task_count: number;
  monthly_task_count: number;
  halted: boolean;
  alert: boolean;
  message?: string;
}

const DAILY_HALT_LIMIT = 20;
const MONTHLY_ALERT_LIMIT = 80;

export async function getCircuitBreakerState(db: D1Database): Promise<CircuitBreakerState> {
  const d = today();
  const m = thisMonth();

  const [dailyRow, monthlyRow] = await Promise.all([
    db.prepare("SELECT total_cost_usd, task_count FROM circuit_breaker WHERE period_type = 'daily' AND period_key = ?").bind(d).first<{ total_cost_usd: number; task_count: number }>(),
    db.prepare("SELECT total_cost_usd, task_count FROM circuit_breaker WHERE period_type = 'monthly' AND period_key = ?").bind(m).first<{ total_cost_usd: number; task_count: number }>(),
  ]);

  const dailyCost = dailyRow?.total_cost_usd ?? 0;
  const monthlyCost = monthlyRow?.total_cost_usd ?? 0;
  const halted = dailyCost >= DAILY_HALT_LIMIT;
  const alert = monthlyCost >= MONTHLY_ALERT_LIMIT;

  return {
    daily_cost_usd: dailyCost,
    monthly_cost_usd: monthlyCost,
    daily_task_count: dailyRow?.task_count ?? 0,
    monthly_task_count: monthlyRow?.task_count ?? 0,
    halted,
    alert,
    message: halted
      ? `HALTED: Daily cost $${dailyCost.toFixed(2)} >= $${DAILY_HALT_LIMIT}`
      : alert
        ? `ALERT: Monthly cost $${monthlyCost.toFixed(2)} >= $${MONTHLY_ALERT_LIMIT}`
        : undefined,
  };
}

export async function incrementCircuitBreaker(db: D1Database, costUsd: number): Promise<void> {
  const d = today();
  const m = thisMonth();
  const ts = now();

  await db.batch([
    db.prepare(
      `INSERT INTO circuit_breaker (period_type, period_key, total_cost_usd, task_count, updated_at)
       VALUES ('daily', ?, ?, 1, ?)
       ON CONFLICT(period_type, period_key) DO UPDATE SET
         total_cost_usd = total_cost_usd + ?,
         task_count = task_count + 1,
         updated_at = ?`,
    ).bind(d, costUsd, ts, costUsd, ts),
    db.prepare(
      `INSERT INTO circuit_breaker (period_type, period_key, total_cost_usd, task_count, updated_at)
       VALUES ('monthly', ?, ?, 1, ?)
       ON CONFLICT(period_type, period_key) DO UPDATE SET
         total_cost_usd = total_cost_usd + ?,
         task_count = task_count + 1,
         updated_at = ?`,
    ).bind(m, costUsd, ts, costUsd, ts),
  ]);
}
