/**
 * The page's contract with its five sections: what each one is shown (sliced from the view model, so none reaches into
 * another's state) and the events each raises (which the scene turns into draft changes).
 */
import type { DifficultyEvents, DifficultyInput } from "../difficulty/difficulty.types.js";
import type { EncounterInput } from "../encounter/encounter.types.js";
import type { ModularsEvents, ModularsInput } from "../modulars/modulars.types.js";
import type { SeatingEvents, SeatingInput } from "../seating/seating.types.js";
import type { SummaryEvents, SummaryInput } from "../summary/summary.types.js";

export interface SectionInputs {
  readonly difficulty: DifficultyInput;
  readonly modulars: ModularsInput;
  readonly seating: SeatingInput;
  readonly summary: SummaryInput;
  readonly encounter: EncounterInput;
}

export interface SectionEvents {
  readonly difficulty: DifficultyEvents;
  readonly modulars: ModularsEvents;
  readonly seating: SeatingEvents;
  readonly summary: SummaryEvents;
  /** The top bar's Back. */
  readonly back: () => void;
}
