/**
 * The case-file section (Agents of S.H.I.E.L.D., MC50 pp. 5, 6 and 24): what it is handed (the issue's `ShieldBriefing`, which
 * never carries the sealed A.I.M. envelope's contents) and what it reports (a card picture pressed or held to read it).
 */
import type { ShieldBriefing, ShieldCard } from "../../../../../view/campaign-shield-model.js";
import type { SectionBase, SectionEvents } from "../sections.types.js";

export interface ShieldInput extends SectionBase {
  readonly shield: ShieldBriefing;
}

export type ShieldEvents = SectionEvents;

/** A card in a picture row, with the few words under it. */
export interface ShieldPicture extends ShieldCard {
  readonly caption: string;
}

export interface ShieldPicturesInput extends SectionBase {
  readonly cards: readonly ShieldPicture[];
  /** The stop keys are `<keyBase>-<index>`. */
  readonly keyBase: string;
}
