import type { CompositionRow, NemesisStandby } from "../../../view/table-setup-preview.js";

/** What the encounter deck section shows. It is read-only: the player changes nothing here, so it raises no events. */
export interface EncounterInput {
  /** The deck's makeup (obligations in red). */
  readonly composition: readonly CompositionRow[];
  readonly whatsInThere: readonly CompositionRow[];
  /** The nemesis sets held back, or null when none apply (or a room has not chosen heroes yet). */
  readonly nemesis: NemesisStandby | null;
  readonly deckSize: number;
}
