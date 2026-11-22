/**
 * The faces a deck check lists above its card grid (issue #754): the deck's identity (its hero and alter-ego faces,
 * and any extra hero forms such as the Tiny and Giant faces of Ant-Man and Wasp), then every player card in the deck
 * that prints more than one face (a card with a `flipSide`). A single-faced card is not listed: its one face is in
 * the grid.
 *
 * Pure decisions only: which faces, in which order, with which caption and which scan (`artFor`, the same answer the
 * table and Inspect get), and how the tiles wrap into rows at a given width. The scene draws what this returns.
 */
import type { AnyCard, Deck, HeroIdentityCard } from "@mc/content";
import { artFor, type ArtSource, type CardFace } from "../art/art-source.js";
import { heroFaceNameAt } from "./hero-names.js";
import { identityFaces } from "./card-side-toggle.js";
import type { Rect } from "./layout.js";
import { t } from "../i18n/translate.js";

export interface DeckFaceTile {
  readonly face: CardFace;
  /** Small caption over the name: "Hero", "Alter-Ego", "Hero form", "Front", "Back". */
  readonly label: string;
  /** The face's own printed name. */
  readonly name: string;
  readonly art: ArtSource | null;
}

export interface DeckFaceGroup {
  /** A stable key: "identity", or the card's id. */
  readonly key: string;
  readonly cardId: string;
  readonly title: string;
  readonly identity: boolean;
  readonly tiles: readonly DeckFaceTile[];
}

/** An identity's faces in toggle order: Hero, Alter-Ego, then each extra hero form. */
export function identityFaceTiles(card: HeroIdentityCard): readonly DeckFaceTile[] {
  return identityFaces(card).map((face): DeckFaceTile => {
    const art = artFor(card, face);
    if (face.kind === "alterEgo") return { face, label: t("deckFaces.alterEgo"), name: card.alterEgo.faceName, art };
    const index = face.kind === "heroForm" ? face.index : 0;
    return {
      face,
      label: index === 0 ? t("aspect.hero") : t("deckFaces.heroForm"),
      name: heroFaceNameAt(card, index) ?? card.hero.faceName,
      art,
    };
  });
}

/** A card's printed faces: its front, and its other side when it has one. One tile for a single-faced card. */
export function cardFaceTiles(card: AnyCard): readonly DeckFaceTile[] {
  const front: DeckFaceTile = {
    face: { kind: "front" },
    label: t("deckFaces.front"),
    name: card.name,
    art: artFor(card, { kind: "front" }),
  };
  const back = "flipSide" in card ? card.flipSide : undefined;
  if (!back) return [front];
  const flip: CardFace = { kind: "flipSide" };
  return [front, { face: flip, label: t("deckFaces.back"), name: back.name, art: artFor(card, flip) }];
}

/**
 * The groups to list: the identity first (when the pool has it), then each card of the deck with more than one face,
 * in the deck's own order and once however many copies it runs.
 */
export function deckFaceGroups(
  deck: Pick<Deck, "identityCardId" | "cards">,
  cardsById: ReadonlyMap<string, AnyCard>,
): readonly DeckFaceGroup[] {
  const groups: DeckFaceGroup[] = [];
  const identity = cardsById.get(deck.identityCardId as string);
  if (identity?.type === "hero_identity") {
    groups.push({
      key: "identity",
      cardId: identity.id as string,
      title: "Identity",
      identity: true,
      tiles: identityFaceTiles(identity),
    });
  }
  const seen = new Set<string>();
  for (const entry of deck.cards) {
    const id = entry.cardId as string;
    const card = cardsById.get(id);
    if (!card || seen.has(id)) continue;
    seen.add(id);
    const tiles = cardFaceTiles(card);
    if (tiles.length > 1) groups.push({ key: id, cardId: id, title: card.name, identity: false, tiles });
  }
  return groups;
}

const TILE_GAP = 8;
const TILE_MIN_WIDTH = 84;
const TILE_MAX_WIDTH = 140;
/** The group's title line over its tiles. */
export const FACE_TITLE_HEIGHT = 30;
/** The label and name under a tile's picture. */
export const FACE_CAPTION_HEIGHT = 36;
/** The space under a group before the next one. */
export const FACE_GROUP_GAP = 10;
/** A card face is 5 wide to 7 tall. */
const CARD_RATIO = 7 / 5;

export interface DeckFaceGroupLayout {
  readonly height: number;
  /** The picture of each tile, in `group.tiles` order, relative to the group's own top-left corner. */
  readonly art: readonly Rect[];
  /** The whole tile (picture and caption), for a hit area and a focus ring. */
  readonly tiles: readonly Rect[];
}

/** How a group's tiles wrap into rows within `width`: as many per row as keep each at least 84 wide. */
export function deckFaceGroupLayout(width: number, tileCount: number): DeckFaceGroupLayout {
  const perRow = Math.max(1, Math.min(tileCount, Math.floor((width + TILE_GAP) / (TILE_MIN_WIDTH + TILE_GAP))));
  const tileWidth = Math.floor(Math.min(TILE_MAX_WIDTH, (width - TILE_GAP * (perRow - 1)) / perRow));
  const artHeight = Math.round(tileWidth * CARD_RATIO);
  const rowHeight = artHeight + FACE_CAPTION_HEIGHT + TILE_GAP;
  const art: Rect[] = [];
  const tiles: Rect[] = [];
  for (let i = 0; i < tileCount; i++) {
    const x = (i % perRow) * (tileWidth + TILE_GAP);
    const y = FACE_TITLE_HEIGHT + Math.floor(i / perRow) * rowHeight;
    art.push({ x, y, width: tileWidth, height: artHeight });
    tiles.push({ x, y, width: tileWidth, height: artHeight + FACE_CAPTION_HEIGHT });
  }
  const rows = Math.ceil(tileCount / perRow);
  return { height: FACE_TITLE_HEIGHT + rows * rowHeight + FACE_GROUP_GAP, art, tiles };
}
