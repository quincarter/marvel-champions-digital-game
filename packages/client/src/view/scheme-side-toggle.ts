/**
 * The Inspect sheet's "Show A side" / "Show B side" toggle on a main scheme (issue #295): a scheme in play shows its
 * B side, and a player who wants to read what the A side did (its Setup, the text they missed) flips the sheet over.
 *
 * Pure decisions only: whether the sheet offers the toggle, which face it then shows and what the button says. The
 * scene keeps one boolean ("flipped") and asks here; nothing about a card's rules is decided.
 */

import type { AnyCard } from "@mc/content";
import type { CardFace } from "../art/art-source.js";

export interface SchemeSideToggle {
  /** The face the sheet draws now: the card's own face, or its other side once flipped. */
  readonly face: CardFace;
  /** The button's label: the side a press switches to. */
  readonly label: string;
}

/**
 * The toggle for a sheet whose subject is `card` shown on `face` (the face it opens on), or null when none is offered:
 * anything but a main scheme stage face, and a stage whose other face is a separate card (`otherFaceId`, a stage that
 * flips to an environment), which has no A/B scans of its own to flip between.
 */
export function schemeSideToggle(card: AnyCard | undefined, face: CardFace, flipped: boolean): SchemeSideToggle | null {
  if (card?.type !== "main_scheme" || face.kind !== "mainSchemeStage") return null;
  const stage = card.stages[face.stageIndex] ?? card.stages[0];
  if (!stage || stage.otherFaceId !== undefined) return null;
  const showing = flipped ? (face.side === "A" ? "B" : "A") : face.side;
  return {
    face: { kind: "mainSchemeStage", stageIndex: face.stageIndex, side: showing },
    label: showing === "B" ? "Show A side" : "Show B side",
  };
}
