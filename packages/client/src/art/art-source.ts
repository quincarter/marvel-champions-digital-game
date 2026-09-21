/**
 * Which picture belongs to which face, as a pure function.
 *
 * A card is not always one image: a hero identity has two faces, a villain has
 * a picture per stage, and a main scheme has an A and a B side per stage. The
 * content schema puts the reference on whichever of those is its own printed
 * card, so this module is the one place that knows how to ask.
 *
 * Two kinds of reference, in the order the content package says to prefer them
 * (`schema/ids.ts`): a card's `ArtRef` wins, and its `ImageRef` (the path the
 * source publishes the scan under) is the fallback. Both resolve to the same
 * place: a file under the repo's `assets/card-art/`, served from this app's own
 * origin at `/card-art/<path>`. Same-origin matters because WebGL will not take
 * a cross-origin image as a texture.
 *
 * The scans are a **build input**, never fetched at runtime. The content
 * scripts put them in `assets/card-art/`; `vite-card-art.ts` serves that folder
 * in dev and copies the pool's share of it into `dist/card-art/` at build, so a
 * web deploy and both native shells (Tauri and Capacitor wrap the same `dist/`)
 * load art as plain static files. `allArtFor` below is what decides which files
 * that is, so the bundle and the loader cannot disagree.
 *
 * Nothing here loads anything: it returns a URL and a stable texture key, so it
 * is testable without a canvas and without the network.
 */

import type { AnyCard, ArtRef, ImageRef } from "@mc/content";

/** The URL prefix every scan is served under. `vite-card-art.ts` imports this, so the two cannot drift. */
export const CARD_ART_ROUTE = "/card-art/";

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
  | { readonly kind: "mainSchemeStage"; readonly stageIndex: number; readonly side: "A" | "B" }
  /**
   * The back of a double-sided encounter card that has been flipped — Criminal Enterprise showing State of
   * Madness. Not a `back`: the face is fully visible at the table, it is simply the other one.
   */
  | { readonly kind: "flipSide" };

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
    case "flipSide":
      return "flipSide" in card && card.flipSide
        ? (card.flipSide.image ?? card.images?.back ?? card.images?.front)
        : card.images?.front;
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
  return { key: `art:${clean}`, url: `${CARD_ART_ROUTE}${clean}` };
}

/**
 * The three card backs, from `assets/card-art/` like every other scan. They are
 * not `ImageRef`s: no card names them, because in the physical game the back is
 * a property of the deck a card came from, not of the card.
 */
export const CARD_BACKS: Readonly<Record<CardBack, ArtSource>> = {
  player: source("bundles/cards/marvel-player-back.webp"),
  encounter: source("bundles/cards/marvel-encounter-back.webp"),
  villain: source("bundles/cards/marvel-villain-back.webp"),
};

/** The path under `assets/card-art/` (and under `/card-art/` when served) an `ArtSource` names. */
export function artPathOf(art: ArtSource): string {
  return art.url.slice(CARD_ART_ROUTE.length);
}

/**
 * Every picture this card can ever ask for, across all of its printed faces —
 * both faces of an identity, every stage of every side of a villain, the A and
 * B side of every main scheme stage, a flip side, and the plain front (which a
 * list or Inspect may ask of any card).
 *
 * It asks `artFor` rather than reading the refs itself, so it is by
 * construction the same answer the table gets. The build uses it to decide
 * which scans go into `dist/` (`vite-card-art.ts`); deduplicated by texture key.
 */
export function allArtFor(card: AnyCard): readonly ArtSource[] {
  const faces: CardFace[] = [{ kind: "front" }];
  if (card.type === "hero_identity") faces.push({ kind: "hero" }, { kind: "alterEgo" });
  if (card.type === "villain") {
    card.sides.forEach((side, sideIndex) =>
      side.stages.forEach((_, stageIndex) => faces.push({ kind: "villainStage", sideIndex, stageIndex })),
    );
  }
  if (card.type === "main_scheme") {
    card.stages.forEach((_, stageIndex) =>
      faces.push(
        { kind: "mainSchemeStage", stageIndex, side: "A" },
        { kind: "mainSchemeStage", stageIndex, side: "B" },
      ),
    );
  }
  if ("flipSide" in card && card.flipSide) faces.push({ kind: "flipSide" });

  const byKey = new Map<string, ArtSource>();
  for (const face of faces) {
    const art = artFor(card, face);
    if (art) byKey.set(art.key, art);
  }
  return [...byKey.values()];
}
