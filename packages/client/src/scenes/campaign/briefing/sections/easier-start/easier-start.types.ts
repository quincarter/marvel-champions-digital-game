/**
 * The easier-start toggle (Age of Apocalypse issue #3, `view/campaign-easier-start-model.ts`): what it is handed (the
 * toggle's state) and what it reports (the card pressed).
 */
import type { EasierStartBriefing } from "../../../../../view/campaign-easier-start-model.js";
import type { SectionBase } from "../sections.types.js";

export interface EasierStartInput extends SectionBase {
  readonly easier: EasierStartBriefing;
}

export interface EasierStartEvents {
  readonly toggle: () => void;
}
