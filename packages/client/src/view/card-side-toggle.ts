/**
 * The Inspect sheet's side toggle, for a card with more than one printed face to read:
 *
 * - a main scheme's "Show A side" / "Show B side" (issue #295): a scheme in play shows its B side, and a player who
 *   wants to read what the A side did (its Setup, the text they missed) flips the sheet over;
 * - a hero identity's Hero, Alter-Ego and extra hero forms (issue #532): the hero picker opens an identity on its hero
 *   side, and a player who does not own the pack reads the other sides before picking it.
 *
 * Pure decisions only: whether the sheet offers the toggle, which face it then shows and what the button says. The
 * scene keeps one counter (how many presses since it opened) and asks here; nothing about a card's rules is decided.
 */

import type { AnyCard, HeroIdentityCard } from "@mc/content";
import type { CardFace } from "../art/art-source.js";
import { heroFaceNameAt } from "./hero-names.js";

export interface CardSideToggle {
  /** The face the sheet draws now: the face it opened on, or another side after `step` presses. */
  readonly face: CardFace;
  /** The button's label: the side a press switches to. */
  readonly label: string;
}

/**
 * The toggle for a sheet whose subject is `card` opened on `face`, `step` presses later, or null when none is offered.
 * A main scheme stage steps between its A and B sides, except a stage whose other face is a separate card
 * (`otherFaceId`, a stage that flips to an environment), which has no A/B scans of its own. A hero identity steps
 * through Hero, Alter-Ego and each of its `additionalHeroForms`, in that order, starting from the face it opened on.
 */
export function cardSideToggle(card: AnyCard | undefined, face: CardFace, step: number): CardSideToggle | null {
  if (card?.type === "hero_identity") return identityToggle(card, face, step);
  if (card?.type !== "main_scheme" || face.kind !== "mainSchemeStage") return null;
  const stage = card.stages[face.stageIndex] ?? card.stages[0];
  if (!stage || stage.otherFaceId !== undefined) return null;
  const showing = step % 2 === 1 ? (face.side === "A" ? "B" : "A") : face.side;
  return {
    face: { kind: "mainSchemeStage", stageIndex: face.stageIndex, side: showing },
    label: showing === "B" ? "Show A side" : "Show B side",
  };
}

/**
 * In a game: the side to read as printed, when the toggle has stepped an identity off the side it is on. The live
 * sheet's stats, traits, keywords, timing and usable abilities all belong to the side in play, so another side is
 * read from the card alone (`cardInspectModel`), as the hero picker reads it. Null on the live side, after the toggle
 * wraps back to it, and for anything but an identity (a scheme's other side keeps the live sheet).
 */
export function printedIdentitySide(card: AnyCard | undefined, liveFace: CardFace, step: number): CardFace | null {
  if (card?.type !== "hero_identity" || step === 0) return null;
  const face = identityToggle(card, liveFace, step).face;
  return heroFormIndexOf(face) === heroFormIndexOf(liveFace) ? null : face;
}

/** Every face of an identity, in the order the toggle steps through them. */
export function identityFaces(card: HeroIdentityCard): readonly CardFace[] {
  return [
    { kind: "hero" },
    { kind: "alterEgo" },
    ...(card.additionalHeroForms ?? []).map((_, i): CardFace => ({ kind: "heroForm", index: i + 1 })),
  ];
}

function identityToggle(card: HeroIdentityCard, face: CardFace, step: number): CardSideToggle {
  const faces = identityFaces(card);
  const start = Math.max(
    0,
    faces.findIndex((f) => heroFormIndexOf(f) === heroFormIndexOf(face)),
  );
  const at = (offset: number): CardFace => faces[(start + offset) % faces.length]!;
  return { face: at(step), label: `Show ${identityFaceLabel(card, at(step + 1))}` };
}

/**
 * Which hero face `face` names, by `heroFaceNameAt`'s index (`hero` is 0, `{ kind: "heroForm", index: 0 }` is the hero
 * face too, as in `art-source.ts`), -1 for the alter-ego, and -2 for a face no identity has (the toggle then starts on
 * the hero side).
 */
function heroFormIndexOf(face: CardFace): number {
  if (face.kind === "hero") return 0;
  if (face.kind === "heroForm") return face.index;
  return face.kind === "alterEgo" ? -1 : -2;
}

/**
 * What the button calls a side: "Alter-Ego", and "Hero" on a two-sided identity. An identity with extra hero forms
 * names each hero face instead ("Tiny Ant-Man", "Giant Ant-Man"), since "Hero" alone would not say which.
 */
function identityFaceLabel(card: HeroIdentityCard, face: CardFace): string {
  const index = heroFormIndexOf(face);
  if (index === -1) return "Alter-Ego";
  if (!card.additionalHeroForms?.length) return "Hero";
  return heroFaceNameAt(card, index) ?? "Hero";
}
