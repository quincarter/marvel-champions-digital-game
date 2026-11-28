/**
 * What every Briefing section is handed and what it reports back: the page's context, its builder, the column it sits in and
 * where it starts (`SectionBase`), the data the sections read (`SectionData`, decided by `data.ts` from the models), and the
 * one event they share (a card's name pressed to read it in Inspect). Each section's own input and events extend these in its
 * folder's `.types.ts`. A section draws, returns its bottom and decides nothing: legality and state live in the engine.
 */
import type { CardId } from "@mc/content";
import type { SheetBuilder } from "../../../../dom/sheet-builder.js";
import type { EasierStartBriefing } from "../../../../view/campaign-easier-start-model.js";
import type { IssueModeRow } from "../../../../view/campaign-modes-model.js";
import type { MissionBriefing } from "../../../../view/campaign-mission-model.js";
import type { ShieldBriefing } from "../../../../view/campaign-shield-model.js";
import type { SideSchemeBriefing } from "../../../../view/campaign-side-scheme-model.js";
import type { BriefingCtx, Column } from "../context.js";

/** The page's context, the builder, the column and the y a section starts at. */
export interface SectionBase {
  readonly ctx: BriefingCtx;
  readonly b: SheetBuilder;
  readonly col: Column;
  readonly top: number;
}

/** A card a section names, by the id Inspect opens. */
export interface SectionCard {
  readonly cardId: CardId;
  readonly name: string;
}

/** What the sections share: opening a card in Inspect. */
export interface SectionEvents {
  readonly inspect: (card: SectionCard) => void;
}

/** The composed issue's sections, each null (or empty) when the box or the issue has none. */
export interface SectionData {
  readonly scheme: SideSchemeBriefing | null;
  readonly mission: MissionBriefing | null;
  readonly shield: ShieldBriefing | null;
  readonly easier: EasierStartBriefing | null;
  readonly modes: readonly IssueModeRow[];
}
