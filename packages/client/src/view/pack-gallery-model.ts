/**
 * The Mod Store pack page's card gallery and load status (docs/custom-content-packs.md §11.6). Pure: the scene
 * (`scenes/mod-store.ts`) draws what this returns. The cards come from the loaded pack (`packs/pack-registry.ts`) once it
 * is installed, so the gallery shows exactly what a game would deal, and from the pack's `preview.json` before that.
 */
import type { AnyCard } from "@mc/content";
import { defaultFaceFor } from "../art/art-source.js";
import type { ActivePackStatus } from "../packs/active-packs.js";
import type { ExtrasGrid } from "./extras-model.js";
import type { Rect } from "./layout.js";
import { cardInspectModel } from "./inspect-model.js";

/** One tile of the gallery. */
export interface GalleryCard {
  readonly cardId: string;
  readonly name: string;
  /** "Event · Attack", "Hero identity": the type line a tile's caption carries. */
  readonly typeLine: string;
  /** Copies the deck (or the set) holds: a tile shows "×2" past one. */
  readonly quantity: number;
}

/** The first line of the page's load status, and what it says. A symbol and words, never color alone. */
export interface LoadStatusLine {
  readonly state: "loaded" | "skipped" | "loading";
  readonly label: string;
  readonly detail: string;
}

export type GallerySectionId = "hero" | "villain" | "encounter" | "deck";

/** A group of the gallery: the hero's own cards, a scenario's villain and schemes, nemesis and obligation, or the deck. */
export interface GallerySection {
  readonly id: GallerySectionId;
  readonly title: string;
  readonly cards: readonly GalleryCard[];
}

/** What the gallery is built from: the pack's own cards, its precon decks and the base game's cards by id. */
export interface GalleryInput {
  readonly cards: readonly AnyCard[];
  readonly decks: readonly { readonly cards: readonly { readonly cardId: string; readonly quantity: number }[] }[];
  /** The base game's cards by id: a precon names them, the pack does not carry them. */
  readonly baseCards: ReadonlyMap<string, AnyCard>;
}

const PLAYER_TYPES: ReadonlySet<string> = new Set([
  "ally",
  "event",
  "support",
  "upgrade",
  "resource",
  "player_side_scheme",
]);

/** The hero's own cards: the identity and the signature cards (`aspect: "hero:<identity>"`). */
function isHeroCard(card: AnyCard): boolean {
  return card.type === "hero_identity" || String((card as { aspect?: unknown }).aspect ?? "").startsWith("hero:");
}

function sectionOf(card: AnyCard): GallerySectionId {
  if (isHeroCard(card)) return "hero";
  if (card.type === "villain" || card.type === "main_scheme") return "villain";
  if (PLAYER_TYPES.has(card.type)) return "deck";
  return "encounter";
}

const SECTION_TITLES: Readonly<Record<GallerySectionId, string>> = {
  hero: "Hero",
  villain: "Villain and scheme",
  encounter: "Nemesis and obligation",
  deck: "Aspect and basic cards",
};
const SECTION_ORDER: readonly GallerySectionId[] = ["hero", "villain", "encounter", "deck"];

/**
 * The gallery's groups, in table order: the hero (identity first), the villain and its scheme, nemesis and obligation
 * (or a scenario's encounter cards), then the aspect and basic cards of the first precon deck, base-game ones
 * included. A card listed twice shows once. `records` has every card shown, by id, for the tiles' art and Inspect.
 */
export function gallerySectionsOf(input: GalleryInput): {
  readonly sections: readonly GallerySection[];
  readonly records: ReadonlyMap<string, AnyCard>;
} {
  const deck = new Map((input.decks[0]?.cards ?? []).map((entry) => [entry.cardId, entry.quantity]));
  const hasHero = input.cards.some((card) => card.type === "hero_identity");
  const records = new Map<string, AnyCard>();
  const groups = new Map<GallerySectionId, GalleryCard[]>();
  const add = (card: AnyCard, section: GallerySectionId, quantity: number): void => {
    const id = card.id as string;
    if (records.has(id)) return;
    records.set(id, card);
    const model = cardInspectModel(card, defaultFaceFor(card));
    const list = groups.get(section) ?? [];
    list.push({ cardId: id, name: model.name, typeLine: model.typeLine, quantity });
    groups.set(section, list);
  };
  const own = [...input.cards].sort(
    (a, b) => (a.type === "hero_identity" ? 0 : 1) - (b.type === "hero_identity" ? 0 : 1),
  );
  for (const card of own) {
    const quantity = deck.get(card.id as string) ?? (card as { quantityInSet?: number }).quantityInSet ?? 1;
    add(card, sectionOf(card), Math.max(1, quantity));
  }
  const base = [...deck.keys()]
    .filter((id) => !records.has(id) && input.baseCards.has(id))
    .map((id) => input.baseCards.get(id)!)
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const card of base) add(card, "deck", deck.get(card.id as string) ?? 1);
  const sections = SECTION_ORDER.flatMap((id): GallerySection[] => {
    const cards = groups.get(id);
    const title = id === "encounter" && !hasHero ? "Encounter cards" : SECTION_TITLES[id];
    return cards && cards.length > 0 ? [{ id, title, cards }] : [];
  });
  return { sections, records };
}

/** The sections without their groupings: how many distinct cards the gallery shows. */
export const galleryCardCount = (sections: readonly GallerySection[]): number =>
  sections.reduce((sum, section) => sum + section.cards.length, 0);

/** One row of the gallery's list: a group heading, or a row of tiles. `first` is the flat index of its first tile. */
export type GalleryRow =
  | { readonly kind: "heading"; readonly title: string; readonly count: number }
  | { readonly kind: "tiles"; readonly cards: readonly GalleryCard[]; readonly first: number };

export const GALLERY_HEADING_HEIGHT = 22;

/** The sections laid out as list rows for `columns` tiles across. Every group starts on a row of its own. */
export function galleryRowsOf(sections: readonly GallerySection[], columns: number): readonly GalleryRow[] {
  const rows: GalleryRow[] = [];
  let first = 0;
  for (const section of sections) {
    rows.push({ kind: "heading", title: section.title, count: section.cards.length });
    for (let at = 0; at < section.cards.length; at += columns) {
      const cards = section.cards.slice(at, at + columns);
      rows.push({ kind: "tiles", cards, first });
      first += cards.length;
    }
  }
  return rows;
}

/** The flat tile order of the sections: what hover slots and focus stops index. */
export const galleryFlat = (sections: readonly GallerySection[]): readonly GalleryCard[] =>
  sections.flatMap((section) => section.cards);

/** The count line above the gallery: "9 cards". */
export function galleryCountText(count: number): string {
  return `${count} ${count === 1 ? "card" : "cards"}`;
}

/**
 * What the page says about whether an installed pack is working. `status` is `undefined` while the loader has not yet
 * answered for it (just after an install, or at boot). Not installed: no line at all.
 */
export function loadStatusOf(installed: boolean, status: ActivePackStatus | undefined): LoadStatusLine | null {
  if (!installed) return null;
  if (!status) return { state: "loading", label: "… Loading", detail: "Checking the pack." };
  if (status.loaded) {
    const notes = status.notes?.length ? ` ${status.notes.join(". ")}.` : "";
    return {
      state: "loaded",
      label: "✓ Loaded",
      detail: `Ready to play: its heroes and cards are in the game.${notes}`,
    };
  }
  return { state: "skipped", label: "! Not loaded", detail: status.reason ?? "Not loaded" };
}

/** The status as one paragraph of the page's text. */
export const loadStatusText = (line: LoadStatusLine): string => `${line.label}. ${line.detail}`;

/** A gallery tile: a small card, picture over a two-line caption. */
const TILE_MIN_WIDTH = 104;
const TILE_ASPECT = 3.5 / 2.5;
const CAPTION = 34;

/** The gallery grid for a region `width` wide: as many columns as fit at the least tile width, tiles sized to fill it. */
export function galleryGridOf(width: number, phone: boolean): ExtrasGrid {
  const gap = phone ? 8 : 12;
  const columns = Math.max(1, Math.floor((width + gap) / (TILE_MIN_WIDTH + gap)));
  const tileWidth = Math.max(1, Math.min(176, (width - gap * (columns - 1)) / columns));
  const tileHeight = Math.round(tileWidth * TILE_ASPECT) + CAPTION;
  return { columns, gap, tileWidth, tileHeight, rowHeight: tileHeight + gap };
}

/** Where the picture sits inside a tile (above the caption). */
export function galleryPictureHeight(grid: ExtrasGrid): number {
  return grid.tileHeight - CAPTION;
}

/** The portrait ratio of a card: width over height. */
const CARD_RATIO = 5 / 7;
const COUNT_LINE = 22;
const MIN_TEXT = 84;
const MIN_GALLERY = 120;
/** The title block (name, byline, meta, chip) beside the featured faces on a wide page. */
const TITLE_BLOCK = 108;

export interface PackPageLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly phone: boolean;
  readonly gutter: number;
  /** The top bar's height. */
  readonly top: number;
  /** Featured faces to show: 0 (a pack with no preview), 1 or 2 (a hero's two sides). */
  readonly faceCount: number;
  /** Cards in the gallery; 0 gives the text the whole body. */
  readonly cardCount: number;
  /** The height of the button row, 0 for none. */
  readonly buttonsHeight: number;
}

export interface PackPageLayout {
  /** The featured faces, left to right; one square slot (the old thumbnail) when the pack has none. */
  readonly faces: readonly Rect[];
  readonly squareThumb: boolean;
  readonly title: { readonly x: number; readonly y: number; readonly width: number };
  /** The scrolling description, credits and permission text. */
  readonly text: Rect;
  /** True when the text sits beside the faces under the title (wide pages with faces), else under the header. */
  readonly textBeside: boolean;
  readonly gallery: { readonly count: Rect; readonly list: Rect } | null;
  readonly status: Rect;
  readonly buttonsY: number;
}

/**
 * The pack page, laid out. The featured card(s) lead on the left; the title block and (on wide pages) the description
 * sit beside them, while on a phone the description goes under them. The gallery takes the rest above the status line,
 * and the buttons sit below that, never over the gallery. Both stay usable at 375x667: the text never shrinks below
 * `MIN_TEXT`, the gallery never below `MIN_GALLERY` (one row of tiles, with its count line).
 */
export function packPageLayoutOf(input: PackPageLayoutInput): PackPageLayout {
  const { width, height, phone, gutter, top, faceCount, cardCount, buttonsHeight } = input;
  const innerWidth = width - gutter * 2;
  const buttonsY = height - gutter - buttonsHeight;
  const statusH = 30;
  const statusY = buttonsY - (buttonsHeight > 0 ? 10 : 0) - statusH;
  const bodyBottom = statusY - 10;
  const headY = top + 14;
  const square = faceCount === 0;
  const faceH = square ? (phone ? 72 : 112) : phone ? 124 : Math.min(200, Math.round((bodyBottom - headY) * 0.45));
  const faceW = square ? faceH : Math.round(faceH * CARD_RATIO);
  // Two faces only where the title block still has room beside them.
  const shown = square ? 1 : faceCount >= 2 && innerWidth - 2 * faceW - 8 - 14 >= 150 ? 2 : 1;
  const faces: Rect[] = Array.from({ length: shown }, (_, i) => ({
    x: gutter + i * (faceW + 8),
    y: headY,
    width: faceW,
    height: faceH,
  }));
  const facesWidth = shown * faceW + (shown - 1) * 8;
  const titleX = gutter + facesWidth + 14;
  const title = { x: titleX, y: headY, width: width - gutter - titleX };
  const beside = !phone && !square;
  const bodyTop = headY + faceH + 12;
  const bodyHeight = Math.max(0, bodyBottom - bodyTop);
  const hasGallery = cardCount > 0 && bodyHeight >= MIN_GALLERY + COUNT_LINE + (beside ? 0 : MIN_TEXT);
  let text: Rect;
  let galleryTop = bodyTop;
  if (beside) {
    text = { x: titleX, y: headY + TITLE_BLOCK, width: title.width, height: Math.max(40, faceH - TITLE_BLOCK) };
  } else {
    const textH = hasGallery ? Math.max(MIN_TEXT, Math.round(bodyHeight * (phone ? 0.34 : 0.3))) : bodyHeight;
    text = { x: gutter, y: bodyTop, width: innerWidth, height: Math.max(60, textH) };
    galleryTop = bodyTop + textH + 10;
  }
  const gallery = hasGallery
    ? {
        count: { x: gutter, y: galleryTop, width: innerWidth, height: COUNT_LINE },
        list: {
          x: gutter,
          y: galleryTop + COUNT_LINE,
          width: innerWidth,
          height: Math.max(MIN_GALLERY, bodyBottom - galleryTop - COUNT_LINE),
        },
      }
    : null;
  return {
    faces,
    squareThumb: square,
    title,
    text,
    textBeside: beside,
    gallery,
    status: { x: gutter, y: statusY, width: innerWidth, height: statusH },
    buttonsY,
  };
}
