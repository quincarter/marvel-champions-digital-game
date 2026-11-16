/**
 * Finding a pack in the Mod Store (issue #734, bluefireF5ran's playtest notes, after Steam Workshop and Nexus Mods
 * browsing): a search box, tag chips, a creator filter and a sort, over the tiles a tab shows, and the Credits tab's
 * list of creators with what each one made. Pure: `scenes/mod-store.ts` draws it.
 */
import { t } from "../i18n/translate.js";
import type { CardLanguage } from "../art/card-language.js";
import type { ModStoreTile } from "./mod-store-model.js";

export type ModStoreSort = "name" | "newest";

export interface ModStoreFilter {
  /** What the player typed: every word must match the pack's name, creator, summary, kind or tags. */
  readonly text: string;
  /** Tag chips switched on: a pack must carry every one. */
  readonly tags: readonly string[];
  /** A creator picked on the Credits tab: only their packs. */
  readonly creator: string | null;
  readonly sort: ModStoreSort;
}

export const EMPTY_FILTER: ModStoreFilter = { text: "", tags: [], creator: null, sort: "name" };

/** Lower case without accents, so "heroe" finds "Héroe" and "SPIDER" finds "Spider". */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * The creators a catalog's `creator` line names: "A, B & C" and "A and B" are three and two people. A note in brackets
 * after a name ("BlueHG (nemesis set)", "Neptune (Typhon00)") says what they did or another name they go by: the
 * credit is the name before it, so one person's packs gather under one name.
 */
export function creatorsIn(creator: string): readonly string[] {
  return creator
    .replace(/\s*\([^)]*\)/g, "")
    .split(/\s*(?:,|&|\band\b|\by\b)\s*/i)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/** Whether `tile` matches every word of `text`. */
export function matchesText(tile: ModStoreTile, text: string): boolean {
  const words = foldText(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = foldText([tile.name, tile.creator, tile.summary, tile.kindLabel, ...tile.tags].join(" "));
  return words.every((word) => haystack.includes(word.replace(/^#/, "")));
}

const hasTag = (tile: ModStoreTile, tag: string): boolean => tile.tags.some((one) => foldText(one) === foldText(tag));

/** The tiles that pass the filter, in its order. Name order is the tab's own; Newest puts the latest approval first. */
export function filterTiles(tiles: readonly ModStoreTile[], filter: ModStoreFilter): readonly ModStoreTile[] {
  const kept = tiles.filter(
    (tile) =>
      matchesText(tile, filter.text) &&
      filter.tags.every((tag) => hasTag(tile, tag)) &&
      (filter.creator === null || tile.creators.some((one) => foldText(one) === foldText(filter.creator!))),
  );
  if (filter.sort === "name") return kept;
  return [...kept].sort((a, b) => (b.approved ?? "").localeCompare(a.approved ?? "") || a.name.localeCompare(b.name));
}

/** Whether anything narrows the list (the sort does not). */
export const isFiltering = (filter: ModStoreFilter): boolean =>
  filter.text.trim().length > 0 || filter.tags.length > 0 || filter.creator !== null;

/**
 * The tag chips a tab offers: the tags its packs carry, the most used first (then A to Z), each with how many packs carry
 * it. A tag already switched on stays in the list even when no pack in view carries it, so it can be switched off.
 */
export function tagChipsOf(
  tiles: readonly ModStoreTile[],
  active: readonly string[],
): readonly { readonly tag: string; readonly count: number; readonly on: boolean }[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const tile of tiles) {
    // The catalog tags every pack with its kind ("hero"), which the tabs already sort by: no chip for it.
    const kind = new Set([foldText(tile.kind), foldText(tile.kindLabel)]);
    for (const tag of new Set(tile.tags.map((one) => one.trim()).filter((one) => one && !kind.has(foldText(one))))) {
      const key = foldText(tag);
      const known = counts.get(key);
      if (known) known.count += 1;
      else counts.set(key, { tag, count: 1 });
    }
  }
  for (const tag of active) if (!counts.has(foldText(tag))) counts.set(foldText(tag), { tag, count: 0 });
  const on = new Set(active.map(foldText));
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .map(({ tag, count }) => ({ tag, count, on: on.has(foldText(tag)) }));
}

/** `tags` with `tag` switched (added when off, removed when on). */
export function toggleTag(tags: readonly string[], tag: string): readonly string[] {
  const key = foldText(tag);
  return tags.some((one) => foldText(one) === key) ? tags.filter((one) => foldText(one) !== key) : [...tags, tag];
}

export interface ChipSlot<T> {
  readonly item: T;
  readonly x: number;
  readonly width: number;
  readonly row: number;
}

/**
 * Packs chips of measured widths left to right into at most `maxRows` rows of `width`, `gap` apart. Chips that do not
 * fit are left out (the search box still finds them by typing the tag): `hidden` says how many.
 */
export function packChips<T>(
  items: readonly T[],
  widthOf: (item: T) => number,
  width: number,
  maxRows: number,
  gap = 8,
): { readonly slots: readonly ChipSlot<T>[]; readonly hidden: number; readonly rows: number } {
  const slots: ChipSlot<T>[] = [];
  let row = 0;
  let x = 0;
  let hidden = 0;
  for (const item of items) {
    const w = Math.min(width, widthOf(item));
    if (x > 0 && x + w > width) {
      row += 1;
      x = 0;
    }
    if (row >= maxRows) {
      hidden += 1;
      continue;
    }
    slots.push({ item, x, width: w, row });
    x += w + gap;
  }
  return { slots, hidden, rows: slots.length === 0 ? 0 : Math.max(...slots.map((slot) => slot.row)) + 1 };
}

export interface CreatorCredit {
  readonly name: string;
  readonly packs: readonly { readonly id: string; readonly name: string; readonly kindLabel: string }[];
}

/**
 * The Credits tab: every creator the store's packs credit (a shared credit, or a co-author the `creator` line leaves out,
 * counts for each person), the most packs first, then A to Z, each with their packs by name.
 */
export function creditsOf(tiles: readonly ModStoreTile[]): readonly CreatorCredit[] {
  const byCreator = new Map<string, { name: string; packs: Map<string, CreatorCredit["packs"][number]> }>();
  for (const tile of tiles) {
    for (const name of tile.creators) {
      const key = foldText(name);
      let credit = byCreator.get(key);
      if (!credit) {
        credit = { name, packs: new Map() };
        byCreator.set(key, credit);
      }
      credit.packs.set(tile.id, { id: tile.id, name: tile.name, kindLabel: tile.kindLabel });
    }
  }
  return [...byCreator.values()]
    .map(({ name, packs }) => ({ name, packs: [...packs.values()].sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => b.packs.length - a.packs.length || a.name.localeCompare(b.name));
}

/** "1 pack" / "3 packs", in the player's language. */
export function packCountText(count: number, lang?: CardLanguage): string {
  return t(count === 1 ? "modStore.credits.packs_one" : "modStore.credits.packs_other", { count }, lang);
}

/** The line under a creator's name: their packs, kind first. */
export function creditLineOf(credit: CreatorCredit): string {
  return credit.packs.map((pack) => `${pack.name} (${pack.kindLabel})`).join(" · ");
}

/** What the result count line says: "4 packs", or "2 of 9 packs" while a filter narrows the list. */
export function resultCountText(shown: number, total: number, filtering: boolean, lang?: CardLanguage): string {
  if (!filtering) return packCountText(total, lang);
  return t("modStore.results", { shown, total }, lang);
}
