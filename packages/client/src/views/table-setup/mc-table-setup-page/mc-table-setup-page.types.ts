import type { ControlGlyph } from "@mc/ui";
import type { DealBarInput } from "../../../components/table-setup/mc-setup-deal-bar/mc-setup-deal-bar.types.js";
import type { DifficultyInput } from "../../../components/table-setup/mc-setup-difficulty/mc-setup-difficulty.types.js";
import type { EncounterInput } from "../../../components/table-setup/mc-setup-encounter/mc-setup-encounter.types.js";
import type { ModularsInput } from "../../../components/table-setup/mc-setup-modulars/mc-setup-modulars.types.js";
import type { SeatingInput } from "../../../components/table-setup/mc-setup-seating/mc-setup-seating.types.js";
import type { SummaryInput } from "../../../components/table-setup/mc-setup-summary/mc-setup-summary.types.js";

/** What Set up the table shows: each section's own input, sliced from the view model so none reaches into another's. */
export interface TableSetupPageInput {
  readonly difficulty: DifficultyInput;
  readonly modulars: ModularsInput;
  readonly seating: SeatingInput;
  readonly summary: SummaryInput;
  readonly encounter: EncounterInput;
  readonly deal: DealBarInput;
  /** Where the dark mode tab leaves the top bar's title room (`ui/campaign-chrome.ts` `sheetThemeFor`). */
  readonly titleDrop: number;
  /** The width the title may take, or 0 for no limit. */
  readonly titleMax: number;
  /** The Cancel glyph on Back (wide only), while a keyboard or pad is in use. */
  readonly backGlyph?: ControlGlyph | undefined;
}
