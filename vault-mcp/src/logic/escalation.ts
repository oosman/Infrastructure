// Model escalation ladder and retry logic
// Plan: DeepSeek → Flash → 2.5 Pro → Sonnet → Opus → Consensus → Human

// Each rung maps to an executor + model pair the VM can run
export interface LadderRung {
  executor: string;
  model: string;
  label: string;
  costPerMtokIn: number;
  costPerMtokOut: number;
  available: boolean;
}

// Ordered cheapest → most expensive
export const MODEL_LADDER: LadderRung[] = [
  // Not yet installed — available: false
  { executor: "deepseek", model: "deepseek-v3.2", label: "DeepSeek V3.2", costPerMtokIn: 0.28, costPerMtokOut: 0.42, available: false },

  // Gemini CLI installed
  { executor: "gemini", model: "gemini-3-flash", label: "Gemini 3 Flash", costPerMtokIn: 0.50, costPerMtokOut: 3.00, available: true },
  { executor: "gemini", model: "gemini-2.5-pro", label: "Gemini 2.5 Pro", costPerMtokIn: 1.25, costPerMtokOut: 10.00, available: true },

  // Codex CLI installed (subscription, not per-token)
  { executor: "codex", model: "gpt-5.3-codex", label: "GPT-5.3 Codex", costPerMtokIn: 1.75, costPerMtokOut: 14.00, available: true },

  // Claude CLI installed (Max OAuth)
  { executor: "claude", model: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5", costPerMtokIn: 3.00, costPerMtokOut: 15.00, available: true },

  // Opus reserved for hardest tasks — available but gated
  { executor: "claude", model: "claude-opus-4-6", label: "Opus 4.6", costPerMtokIn: 5.00, costPerMtokOut: 25.00, available: true },

  // Consensus = special executor (runs 2 models + diff)
  { executor: "consensus", model: "consensus", label: "Consensus", costPerMtokIn: 0, costPerMtokOut: 0, available: true },
];

// Error types that are infrastructure issues — don't escalate, just fail
const NON_ESCALATABLE_ERRORS = new Set(["auth_failure", "timeout", "syntax_error"]);

export const MAX_ATTEMPTS = 3;
export const MAX_TOTAL_ATTEMPTS = 5;

// Given current executor+model, find the next available rung up the ladder
export function getNextRung(currentExecutor: string, currentModel: string): LadderRung | null {
  const currentIdx = MODEL_LADDER.findIndex(
    r => r.executor === currentExecutor && r.model === currentModel
  );

  // If not found in ladder, start from after Sonnet (assume it was a custom model)
  const startIdx = currentIdx >= 0 ? currentIdx + 1 : MODEL_LADDER.findIndex(r => r.label === "Opus 4.6");

  if (startIdx < 0) return null;

  for (let i = startIdx; i < MODEL_LADDER.length; i++) {
    if (MODEL_LADDER[i].available) {
      return MODEL_LADDER[i];
    }
  }
  return null;
}

// Should we escalate for this error type?
export function shouldEscalate(errorType: string): boolean {
  if (NON_ESCALATABLE_ERRORS.has(errorType)) return false;
  return true;
}

// Get the default starting rung for a given complexity
export function getStartingRung(complexity: string): LadderRung {
  const available = MODEL_LADDER.filter(r => r.available && r.executor !== "consensus");

  switch (complexity) {
    case "trivial":
      return available[0];
    case "simple":
      return available.find(r => r.executor === "gemini" && r.model.includes("pro")) ?? available[0];
    case "moderate":
      return available.find(r => r.label === "Sonnet 4.5") ?? available[available.length - 1];
    case "complex":
      return available.find(r => r.label === "Sonnet 4.5") ?? available[available.length - 1];
    default:
      return available.find(r => r.label === "Sonnet 4.5") ?? available[0];
  }
}
