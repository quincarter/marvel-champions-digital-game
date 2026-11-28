/**
 * The settled side-scheme section (NeXt Evolution, MC40 p. 7): what it is handed (the issue's `SideSchemeBriefing` and how to
 * say an encounter set's name) and what it reports (a card pressed or held to read it).
 */
import type { CarryInRow, SideSchemeBriefing } from "../../../../../view/campaign-side-scheme-model.js";
import type { SectionBase, SectionEvents } from "../sections.types.js";

export interface SideSchemeInput extends SectionBase {
  readonly scheme: SideSchemeBriefing;
  /** An encounter set's name by id (a fixed set is listed by name). */
  readonly setNameOf: (id: string) => string;
}

export type SideSchemeEvents = SectionEvents;

export interface CarryInInput extends SectionBase {
  readonly carry: CarryInRow;
}
