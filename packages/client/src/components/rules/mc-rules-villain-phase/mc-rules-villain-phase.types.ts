import type { RulesStepModel } from "../mc-rules-step/mc-rules-step.types.js";

export interface McRulesVillainPhaseProps {
  steps: readonly RulesStepModel[];
  /** "RRG 1.8 p. 47 Villain Phase". */
  citation: string;
}
