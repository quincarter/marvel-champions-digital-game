/**
 * The mission section (Age of Apocalypse, MC45 p. 5): what it is handed (the issue's `MissionBriefing`) and what it reports (a
 * card's Inspect chip pressed).
 */
import type { MissionBriefing } from "../../../../../view/campaign-mission-model.js";
import type { SectionBase, SectionEvents } from "../sections.types.js";

export interface MissionInput extends SectionBase {
  readonly mission: MissionBriefing;
}

export type MissionEvents = SectionEvents;

/** One labelled row: a kind word, the card's name, a short line beneath and an Inspect chip when it has a card. */
export interface MissionRowModel {
  readonly key: "mission" | "overseer";
  readonly kind: string;
  readonly name: string;
  readonly detail: string;
  readonly cardId: string | null;
}
