import type { HintGlyph, PictureSource } from "@mc/ui";
import type { CardFace } from "../../art/art-source.js";
import type { BuilderView } from "../../view/civil-war-builder-model.js";
import type { FaceRef, SetSheetView } from "../../view/civil-war-builder-art.js";

/**
 * Everything the Civil War builder's elements say to the scene: one `mc-civil-war` event (bubbles and composed), listed in
 * `GUARDED_EVENTS`. A control raises `mc-pressed` with one of these as its action; `FeatureRelay` turns that into the event.
 * Every choice is the builder model's own action string (`civil:side:...`, `civil:start`), so the scene sends it to
 * `applyBuilderAction` and counts nothing itself.
 */
export const CIVIL_WAR_EVENT = "mc-civil-war";

/** A card to read: its face and, where the card is a choice, the "Choose this ..." button Inspect carries. */
export interface CivilInspect {
  readonly cardId: string;
  readonly face: CardFace;
  readonly choice?: { readonly optionId: string; readonly label: string };
}

export type CivilWarEventDetail =
  /** A builder action string: a tap on a card, a step, a button. */
  | { readonly type: "act"; readonly action: string }
  /** Read a card (a picture's "Read ... ▸" strip, or a hold on a choice). */
  | ({ readonly type: "inspect" } & CivilInspect)
  /** Open or close the "cards in this set" sheet. */
  | { readonly type: "sheet"; readonly id: string | null };

declare global {
  interface HTMLElementEventMap {
    "mc-civil-war": CustomEvent<CivilWarEventDetail>;
  }
}

/** How the page lays out: wide (desktop: rail and review column), tablet, or a phone (step bar, one column). */
export type CivilMode = "wide" | "tablet" | "phone";

/** The pictures of the screen, resolved and leased by the scene: a function per kind, so an element asks for what it draws. */
export interface CivilPictures {
  /** A leader's picture (`art/scenarios/<id>/villain.*`, else the leader card's own scan), fitted around the face. */
  readonly leader: (scenarioId: string, cardId: string) => PictureSource;
  /** One card face whole (a scan), with its name as the word it says while it has no picture. */
  readonly face: (face: FaceRef | null) => PictureSource;
  /** The encounter card back: what a hidden item shows, never its face. */
  readonly back: PictureSource;
}

export interface CivilPageModel {
  readonly mode: CivilMode;
  readonly view: BuilderView;
  readonly pictures: CivilPictures;
  readonly bar: { readonly backLabel: string; readonly backGlyph: HintGlyph | null };
  /** The notice from the last action, else the one sentence that reads the whole scenario. */
  readonly status: string;
  /** The open "cards in this set" sheet, or null. */
  readonly sheet: {
    readonly view: SetSheetView;
    readonly picked: boolean;
    readonly enabled: boolean;
    readonly reason: string | null;
  } | null;
}
