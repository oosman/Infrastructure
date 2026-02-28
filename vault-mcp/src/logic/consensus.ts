import { STRUCTURED_FIELDS } from "../utils";

interface StageOutput {
  files_changed?: string[];
  security_surface?: string[];
  test_targets?: string[];
  dependencies_added?: string[];
  breaking_changes?: string[];
  raw?: string;
}

interface Stage {
  stage_name: string;
  stage_type: string;
  output: StageOutput;
}

interface FieldDivergence {
  field: string;
  values: Record<string, string[]>;
}

export interface ConsensusResult {
  task_id: string;
  impl_stages_count: number;
  agreed: string[];
  diverged: FieldDivergence[];
}

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((item) => setA.has(item));
}

export function computeConsensus(taskId: string, stages: Stage[]): ConsensusResult {
  const implStages = stages.filter((s) => s.stage_type === "impl");

  if (implStages.length < 2) {
    return {
      task_id: taskId,
      impl_stages_count: implStages.length,
      agreed: [],
      diverged: [],
    };
  }

  const agreed: string[] = [];
  const diverged: FieldDivergence[] = [];

  for (const field of STRUCTURED_FIELDS) {
    const fieldValues: Record<string, string[]> = {};
    let allPresent = true;

    for (const stage of implStages) {
      const val = stage.output?.[field];
      if (!val || !Array.isArray(val)) {
        allPresent = false;
        break;
      }
      fieldValues[stage.stage_name] = val;
    }

    if (!allPresent) continue;

    const values = Object.values(fieldValues);
    const allEqual = values.every((v) => setsEqual(v, values[0]));

    if (allEqual) {
      agreed.push(field);
    } else {
      diverged.push({ field, values: fieldValues });
    }
  }

  return {
    task_id: taskId,
    impl_stages_count: implStages.length,
    agreed,
    diverged,
  };
}
