/**
 * The pictures of the Civil War builder, as plain data (docs/phase7-wave10-client.md section 2; owner, 2026-10-13: "show
 * card/hero images for the heroes and the scenario selection as well as modules"). No Phaser, no art loading: this says
 * WHICH card face stands for a leader stage, a main scheme stage or a modular set, how a card sits in a box of a given
 * shape, and what the "cards in this set" sheet lists. The scene turns a `FaceRef` into a scan with `artFor` and draws it.
 *
 * Decisions kept here so they are tested:
 *  - A set is represented by up to three faces, "most recognizable first": a minion, then a side scheme, then an
 *    attachment, a treachery, an environment, an obligation; within a type the unique card first, then by name. The
 *    leader and main scheme cards of a set never stand for it (they are the leader's own, not a modular card).
 *  - Villains, main schemes and side schemes are printed landscape; leaders and every other card portrait.
 */
import type { AnyCard } from "@mc/content";
import { defaultFaceFor, type CardFace } from "../art/art-source.js";
import type { Rect } from "./layout.js";

/** One card face to draw: which card, which of its faces, and its shape. */
export interface FaceRef {
  readonly cardId: string;
  readonly face: CardFace;
  readonly landscape: boolean;
  readonly name: string;
}

const LANDSCAPE_TYPES: ReadonlySet<string> = new Set(["villain", "main_scheme", "side_scheme"]);
/** A Civil War leader is a villain-type card printed portrait, like a hero; every other villain is landscape. */
export const isLandscapeCard = (card: AnyCard): boolean =>
  LANDSCAPE_TYPES.has(card.type) && !(card.type === "villain" && card.printedType === "leader");

export function faceRefOf(card: AnyCard, face: CardFace = defaultFaceFor(card), name: string = card.name): FaceRef {
  return { cardId: card.id as string, face, landscape: isLandscapeCard(card), name };
}

/** Card types a modular set is made of, most recognizable first. */
const TYPE_RANK: Readonly<Record<string, number>> = {
  minion: 0,
  side_scheme: 1,
  attachment: 2,
  treachery: 3,
  environment: 4,
  obligation: 5,
};
const TYPE_WORD: Readonly<Record<string, string>> = {
  minion: "Minion",
  side_scheme: "Side scheme",
  attachment: "Attachment",
  treachery: "Treachery",
  environment: "Environment",
  obligation: "Obligation",
};
export const typeWordOf = (card: AnyCard): string => TYPE_WORD[card.type] ?? card.type;

const indexes = new WeakMap<ReadonlyMap<string, AnyCard>, ReadonlyMap<string, readonly AnyCard[]>>();

/** Every card of each encounter set, built once per pool (the builder asks for ~120 sets on every redraw). */
export function cardsBySet(cards: ReadonlyMap<string, AnyCard>): ReadonlyMap<string, readonly AnyCard[]> {
  const cached = indexes.get(cards);
  if (cached) return cached;
  const built = new Map<string, AnyCard[]>();
  for (const card of cards.values()) {
    if (!("encounterSetIds" in card)) continue;
    for (const setId of card.encounterSetIds as readonly string[]) {
      const list = built.get(setId) ?? [];
      list.push(card);
      built.set(setId, list);
    }
  }
  indexes.set(cards, built);
  return built;
}

const isModularCard = (card: AnyCard): boolean => card.type !== "villain" && card.type !== "main_scheme";

/** The cards a set shows, most recognizable first: by type rank, unique cards first, then by name. */
export function orderedSetCards(setCards: readonly AnyCard[]): readonly AnyCard[] {
  return setCards
    .filter(isModularCard)
    .slice()
    .sort(
      (a, b) =>
        (TYPE_RANK[a.type] ?? 9) - (TYPE_RANK[b.type] ?? 9) ||
        Number(b.unique) - Number(a.unique) ||
        a.name.localeCompare(b.name) ||
        (a.id as string).localeCompare(b.id as string),
    );
}

/** The faces that stand for a set on its tile: up to `count`, most recognizable first. */
export function setFacesOf(setCards: readonly AnyCard[], count = 3): readonly FaceRef[] {
  return orderedSetCards(setCards)
    .slice(0, count)
    .map((card) => faceRefOf(card));
}

export interface SetSheetCard {
  readonly face: FaceRef;
  readonly copies: number;
  readonly typeWord: string;
}

export interface SetSheetView {
  readonly setId: string;
  readonly name: string;
  readonly cards: readonly SetSheetCard[];
  /** Printed cards in the set (copies counted). */
  readonly totalCards: number;
}

/** What the "cards in this set" sheet lists: one face per distinct card with its copy count. */
export function setSheetOf(setId: string, name: string, setCards: readonly AnyCard[]): SetSheetView {
  const cards = orderedSetCards(setCards).map<SetSheetCard>((card) => ({
    face: faceRefOf(card),
    copies: card.quantityInSet,
    typeWord: typeWordOf(card),
  }));
  return { setId, name, cards, totalCards: cards.reduce((sum, c) => sum + c.copies, 0) };
}

/** The size of a card of the given shape fitted inside a `width` by `height` box (5:7 portrait, 7:5 landscape). */
export function fitCard(
  box: { readonly width: number; readonly height: number },
  landscape: boolean,
): { readonly width: number; readonly height: number } {
  const ratio = landscape ? 7 / 5 : 5 / 7;
  const width = Math.min(box.width, box.height * ratio);
  return { width: Math.round(width), height: Math.round(width / ratio) };
}

/** Where each of `faces` goes in a small fan inside `box`: overlapped from the left, each centered in a square of the box's height. */
export function fanRects(box: Rect, faces: readonly FaceRef[]): readonly Rect[] {
  const square = Math.min(box.height, box.width);
  const sizes = faces.map((f) => fitCard({ width: square, height: square }, f.landscape));
  const step = faces.length > 1 ? Math.min(Math.round(square * 0.46), (box.width - square) / (faces.length - 1)) : 0;
  return faces.map((_, i) => {
    const size = sizes[i]!;
    return {
      x: Math.round(box.x + i * step + (square - size.width) / 2),
      y: Math.round(box.y + (box.height - size.height) / 2),
      width: size.width,
      height: size.height,
    };
  });
}

/** A card of this shape centered in `box`, as a rect. */
export function centeredCard(box: Rect, landscape: boolean): Rect {
  const size = fitCard(box, landscape);
  return {
    x: Math.round(box.x + (box.width - size.width) / 2),
    y: Math.round(box.y + (box.height - size.height) / 2),
    width: size.width,
    height: size.height,
  };
}

/** Which of `rects` (content space, from the top of the scroll content) are near the scrolled viewport: the ones worth loading art for. */
export function rectsNearViewport(
  rects: readonly Rect[],
  viewport: { readonly top: number; readonly height: number },
  margin: number,
): readonly number[] {
  const out: number[] = [];
  rects.forEach((r, i) => {
    if (r.y + r.height >= viewport.top - margin && r.y <= viewport.top + viewport.height + margin) out.push(i);
  });
  return out;
}
