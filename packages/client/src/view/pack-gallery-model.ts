/**
 * The Mod Store pack page's card gallery and load status (docs/custom-content-packs.md §11.6). Pure: the scene
 * (`scenes/mod-store.ts`) draws what this returns. The cards come from the loaded pack (`packs/pack-registry.ts`), so
 * the gallery shows exactly what a game would deal, and a pack that did not load shows why instead of cards.
 */
import type { AnyCard } from "@mc/content";
import { defaultFaceFor } from "../art/art-source.js";
import type { ActivePackStatus } from "../packs/active-packs.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import type { ExtrasGrid } from "./extras-model.js";
import { cardInspectModel } from "./inspect-model.js";

/** One tile of the gallery. */
export interface GalleryCard {
  readonly cardId: string;
  readonly name: string;
  /** "Event · Attack", "Hero identity": the type line a tile's caption carries. */
  readonly typeLine: string;
}

/** The first line of the page's load status, and what it says. A symbol and words, never color alone. */
export interface LoadStatusLine {
  readonly state: "loaded" | "skipped" | "loading";
  readonly label: string;
  readonly detail: string;
}

/** The gallery's order: the hero identity first, then the pack's own order. Duplicate ids (a card listed twice) show once. */
export function galleryOf(pack: Pick<PackRuntime, "cards"> | undefined): readonly GalleryCard[] {
  if (!pack) return [];
  const seen = new Set<string>();
  const tiles: GalleryCard[] = [];
  const identities: GalleryCard[] = [];
  for (const card of pack.cards as readonly AnyCard[]) {
    const id = card.id as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const model = cardInspectModel(card, defaultFaceFor(card));
    const tile = { cardId: id, name: model.name, typeLine: model.typeLine };
    (card.type === "hero_identity" ? identities : tiles).push(tile);
  }
  return [...identities, ...tiles];
}

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
const TILE_MIN_WIDTH = 96;
const TILE_ASPECT = 3.5 / 2.5;
const CAPTION = 34;

/** The gallery grid for a region `width` wide: as many columns as fit at the least tile width, tiles sized to fill it. */
export function galleryGridOf(width: number, phone: boolean): ExtrasGrid {
  const gap = phone ? 8 : 12;
  const columns = Math.max(1, Math.floor((width + gap) / (TILE_MIN_WIDTH + gap)));
  const tileWidth = Math.max(1, Math.min(150, (width - gap * (columns - 1)) / columns));
  const tileHeight = Math.round(tileWidth * TILE_ASPECT) + CAPTION;
  return { columns, gap, tileWidth, tileHeight, rowHeight: tileHeight + gap };
}

/** Where the picture sits inside a tile (above the caption). */
export function galleryPictureHeight(grid: ExtrasGrid): number {
  return grid.tileHeight - CAPTION;
}

/**
 * How the pack page's body is split: the text panel on top and the gallery under it. A pack with no cards to show gives
 * the whole body to the text. Both stay usable at 375x667: the text never shrinks below `MIN_TEXT`, the gallery never
 * below `MIN_GALLERY` (one row of tiles, with its count line).
 */
const MIN_TEXT = 84;
const MIN_GALLERY = 120;
const COUNT_LINE = 22;

export interface PageSplit {
  readonly text: { readonly height: number };
  readonly gallery: { readonly height: number; readonly count: number } | null;
}

export function pageSplitOf(bodyHeight: number, cardCount: number, phone: boolean): PageSplit {
  if (cardCount === 0 || bodyHeight < MIN_TEXT + MIN_GALLERY + COUNT_LINE)
    return { text: { height: bodyHeight }, gallery: null };
  const text = Math.max(MIN_TEXT, Math.round(bodyHeight * (phone ? 0.34 : 0.3)));
  return { text: { height: text }, gallery: { height: bodyHeight - text, count: COUNT_LINE } };
}
