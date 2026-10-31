/**
 * The deck builder's pool view between visits (issue #531): its sort, its quick and pack filters and its card/list
 * view, so a player sets them once, and the sort of a deck's own card list (issue #594), which Deck check shares. Kept in `localStorage` (an `mc-*` entry, so a save file carries it), with the
 * storage passed in so the rule is tested without a browser. The search text and the aspect filter are not kept: they
 * belong to one deck. Anything unreadable falls back to the default for that one field.
 */
import type { CardType, ResourceIconType, Trait } from "@mc/content";
import {
  DEFAULT_POOL_SORT,
  QUICK_COST_MAX,
  type PoolFilter,
  type PoolSort,
  type PoolSortKey,
} from "../view/deck-builder-model.js";
import { DECK_LIST_SORTS, DEFAULT_DECK_LIST_SORT, type DeckListSort } from "../view/deck-stats.js";

export const DECK_BUILDER_VIEW_KEY = "mc-deck-builder-view";

export interface DeckBuilderView {
  readonly sort: PoolSort;
  /** Only the filter fields that outlive a deck: type, cost, icon, trait, pack and wave. */
  readonly filter: PoolFilter;
  readonly poolView: "grid" | "list";
  readonly deckSort: DeckListSort;
}

export const DEFAULT_DECK_BUILDER_VIEW: DeckBuilderView = {
  sort: DEFAULT_POOL_SORT,
  filter: {},
  poolView: "grid",
  deckSort: DEFAULT_DECK_LIST_SORT,
};

type PrefStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): PrefStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

const SORT_KEYS: readonly PoolSortKey[] = ["match", "name", "cost", "type", "aspect", "pack"];
const CARD_TYPES: readonly CardType[] = ["ally", "event", "upgrade", "support", "resource", "player_side_scheme"];
const ICONS: readonly ResourceIconType[] = ["physical", "mental", "energy", "wild"];

const sortKeyOf = (value: unknown): PoolSortKey | null => SORT_KEYS.find((key) => key === value) ?? null;
const stringOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

/** The kept part of `filter`, as stored. */
export function keptFilterOf(filter: PoolFilter): PoolFilter {
  const kept: { -readonly [K in keyof PoolFilter]?: PoolFilter[K] } = {};
  if (filter.type) kept.type = filter.type;
  if (typeof filter.cost === "number") kept.cost = filter.cost;
  if (filter.resource) kept.resource = filter.resource;
  if (filter.trait) kept.trait = filter.trait;
  if (filter.packCode) kept.packCode = filter.packCode;
  if (filter.cycleId) kept.cycleId = filter.cycleId;
  return kept;
}

export function deckBuilderView(storage: PrefStorage | null = browserStorage()): DeckBuilderView {
  try {
    const raw = storage?.getItem(DECK_BUILDER_VIEW_KEY);
    if (!raw) return DEFAULT_DECK_BUILDER_VIEW;
    const parsed = JSON.parse(raw) as {
      sort?: { primary?: unknown; secondary?: unknown };
      filter?: Record<string, unknown>;
      poolView?: unknown;
      deckSort?: unknown;
    };
    const primary = sortKeyOf(parsed.sort?.primary) ?? DEFAULT_POOL_SORT.primary;
    const secondary = sortKeyOf(parsed.sort?.secondary);
    const f = parsed.filter ?? {};
    const filter = keptFilterOf({
      type: CARD_TYPES.find((type) => type === f["type"]) ?? null,
      cost:
        typeof f["cost"] === "number" && Number.isInteger(f["cost"]) && f["cost"] >= 0
          ? Math.min(f["cost"], QUICK_COST_MAX)
          : null,
      resource: ICONS.find((icon) => icon === f["resource"]) ?? null,
      trait: stringOf(f["trait"]) as Trait | null,
      packCode: stringOf(f["packCode"]),
      cycleId: stringOf(f["cycleId"]),
    });
    return {
      sort: { primary, secondary: secondary === primary || secondary === "match" ? null : secondary },
      filter,
      poolView: parsed.poolView === "list" ? "list" : "grid",
      deckSort: DECK_LIST_SORTS.find((sort) => sort === parsed.deckSort) ?? DEFAULT_DECK_LIST_SORT,
    };
  } catch {
    return DEFAULT_DECK_BUILDER_VIEW;
  }
}

export function rememberDeckBuilderView(view: DeckBuilderView, storage: PrefStorage | null = browserStorage()): void {
  try {
    storage?.setItem(
      DECK_BUILDER_VIEW_KEY,
      JSON.stringify({
        sort: view.sort,
        filter: keptFilterOf(view.filter),
        poolView: view.poolView,
        deckSort: view.deckSort,
      }),
    );
  } catch {
    // A full or blocked store only means the builder opens with its defaults next time.
  }
}

/** Keeps a deck list's sort without touching the rest of the view: Deck check, which holds none of it, sets this too. */
export function rememberDeckListSort(deckSort: DeckListSort, storage: PrefStorage | null = browserStorage()): void {
  rememberDeckBuilderView({ ...deckBuilderView(storage), deckSort }, storage);
}
