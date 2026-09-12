/**
 * Which picture belongs to which face, as a pure function.
 *
 * A card is not always one image: a hero identity has two faces, a villain has
 * a picture per stage, and a main scheme has an A and a B side per stage. The
 * content schema puts the reference on whichever of those is its own printed
 * card, so this module is the one place that knows how to ask.
 *
 * Two kinds of reference, in the order the content package says to prefer them
 * (`schema/ids.ts`): a card's `ArtRef` is a key into the gitignored local asset
 * folder and wins; its `ImageRef` is what the source publishes and is the
 * fallback. Both resolve to a path under this app's own origin, because the
 * upstream host sends no CORS header and WebGL will not take a tainted image as
 * a texture — `vite-card-art.ts` is the server half of that.
 *
 * Nothing here loads anything: it returns a URL and a stable texture key, so it
 * is testable without a canvas and without the network.
 */

import type { AnyCard, ArtRef, ImageRef } from "@mc/content";

/** Must match `CARD_ART_ROUTE` in vite-card-art.ts. */
const ROUTE = "/card-art/";

/**
 * Which card back a hidden card shows.
 *
 * The physical game has three, and only three: every player card shares one,
 * every encounter card shares one, and the villain deck has its own. MarvelCDB
 * carries a `backimagesrc` for six records in the whole Core Set — the main
 * scheme A/B pairs — precisely because there is no per-card back to publish.
 * So a hidden card resolves to one of these rather than to anything on the card.
 */
export type CardBack = "player" | "encounter" | "villain";

/** Which printed face of a card is being drawn. */
export type CardFace =
  /** The card's own front, for everything single-faced. */
  | { readonly kind: "front" }
  /**
   * Not a face at all: this card's face may not be seen, so it shows a back.
   * Resolved without consulting the card, so a hidden card cannot leak its own
   * front through a missing-back fallback.
   */
  | { readonly kind: "back"; readonly back: CardBack }
  | { readonly kind: "hero" }
  | { readonly kind: "alterEgo" }
  | { readonly kind: "villainStage"; readonly sideIndex: number; readonly stageIndex: number }
  /** A main scheme stage. The B side carries the threat values the table shows. */
  | { readonly kind: "mainSchemeStage"; readonly stageIndex: number; readonly side: "A" | "B" };

export interface ArtSource {
  /** Stable Phaser texture key. Derived from the path, so two cards sharing art share a texture. */
  readonly key: string;
  readonly url: string;
}

/** The art for one face, or null when the content has no reference for it. */
export function artFor(card: AnyCard | undefined, face: CardFace): ArtSource | null {
  // Answered before the card is consulted at all: a hidden card must not be
  // able to fall through to its own front.
  if (face.kind === "back") return CARD_BACKS[face.back];
  if (!card) return null;
  const local = localRefFor(card, face);
  if (local) return source(`${local as string}.png`);
  const upstream = imageRefFor(card, face);
  return upstream ? source(upstream as string) : null;
}

/**
 * The local-scan key for a face, when the content carries one. Only the pieces
 * the schema gives an `ArtRef` are reachable here: the card itself and a hero
 * identity's two faces.
 */
function localRefFor(card: AnyCard, face: CardFace): ArtRef | undefined {
  if (card.type === "hero_identity") {
    if (face.kind === "hero") return card.hero.art;
    if (face.kind === "alterEgo") return card.alterEgo.art;
  }
  return "art" in card ? card.art : undefined;
}

function imageRefFor(card: AnyCard, face: CardFace): ImageRef | undefined {
  switch (face.kind) {
    case "hero":
      return card.type === "hero_identity" ? (card.hero.image ?? card.images?.front) : card.images?.front;
    case "alterEgo":
      return card.type === "hero_identity" ? (card.alterEgo.image ?? card.images?.back) : card.images?.front;
    case "villainStage": {
      if (card.type !== "villain") return card.images?.front;
      const side = card.sides[face.sideIndex] ?? card.sides[0];
      return side?.stages[face.stageIndex]?.image ?? card.images?.front;
    }
    case "mainSchemeStage": {
      if (card.type !== "main_scheme") return card.images?.front;
      const stage = card.stages[face.stageIndex] ?? card.stages[0];
      if (!stage) return card.images?.front;
      return (face.side === "A" ? stage.aSide.image : stage.image) ?? card.images?.front;
    }
    default:
      return card.images?.front;
  }
}

/**
 * A path and its texture key. The key is the path with the separators flattened
 * so it reads in a texture dump; the path itself is already unique per face.
 */
function source(refPath: string): ArtSource {
  const clean = refPath.replace(/^\/+/, "");
  return { key: `art:${clean}`, url: `${ROUTE}${clean}` };
}

/**
 * The three card backs, from the gitignored local asset folder like every other
 * scan. They are not `ImageRef`s: no card names them, because in the physical
 * game the back is a property of the deck a card came from, not of the card.
 */
export const CARD_BACKS: Readonly<Record<CardBack, ArtSource>> = {
  player: source("bundles/cards/marvel-player-back.webp"),
  encounter: source("bundles/cards/marvel-encounter-back.webp"),
  villain: source("bundles/cards/marvel-villain-back.webp"),
};
