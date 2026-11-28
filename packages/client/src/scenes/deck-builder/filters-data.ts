/** The pool filters' fixed choices: the type chips, the quick cost and icon chips, and the sort keys. */
import type { CardType } from "@mc/content";
import { QUICK_COST_MAX, type PoolFilter, type PoolSortKey } from "../../view/deck-builder-model.js";

/** The Hero and Basic show toggles' focus stops (`type:<id>`), drawn before the type chips (issue #977). */
export const SHOW_TOGGLE_IDS = ["show-hero", "show-basic"] as const;

/**
 * W1's type filter chips (docs/phase4-screen-gaps.md §3): "All" plus every `PoolFilter.type` the pool actually holds
 * player-deck cards of. `type` null means "All": no filter.
 */
export const TYPE_FILTERS: readonly { readonly id: string; readonly label: string; readonly type: CardType | null }[] =
  [
    { id: "all", label: "All", type: null },
    { id: "ally", label: "Ally", type: "ally" },
    { id: "event", label: "Event", type: "event" },
    { id: "upgrade", label: "Upgrade", type: "upgrade" },
    { id: "support", label: "Support", type: "support" },
    { id: "resource", label: "Resource", type: "resource" },
    { id: "scheme", label: "Side scheme", type: "player_side_scheme" },
  ];

/** The quick Cost and Icon chips (issue #531): one tap filters, a second tap on the same chip clears it. */
export const QUICK_FILTERS: readonly {
  readonly id: string;
  readonly text: string;
  readonly apply: (filter: PoolFilter, on: boolean) => PoolFilter;
  readonly isOn: (filter: PoolFilter) => boolean;
}[] = [
  ...Array.from({ length: QUICK_COST_MAX + 1 }, (_, cost) => ({
    id: `cost:${cost}`,
    text: cost === QUICK_COST_MAX ? `${cost}+` : `${cost}`,
    apply: (filter: PoolFilter, on: boolean): PoolFilter => ({ ...filter, cost: on ? cost : null }),
    isOn: (filter: PoolFilter): boolean => filter.cost === cost,
  })),
  ...(["physical", "mental", "energy", "wild"] as const).map((icon) => ({
    id: `icon:${icon}`,
    text: `${icon.charAt(0).toUpperCase()}${icon.slice(1)}`,
    apply: (filter: PoolFilter, on: boolean): PoolFilter => ({ ...filter, resource: on ? icon : null }),
    isOn: (filter: PoolFilter): boolean => filter.resource === icon,
  })),
];

/** The Sort button's cycle (the primary key); the Then button cycles "None" and the rest but `match` and the primary. */
export const SORT_CYCLE: readonly PoolSortKey[] = ["match", "name", "aspect", "type", "cost", "pack"];

/** The Then button's choices under `primary`: none first, then every key but `match` and the primary itself. */
export const thenChoicesFor = (primary: PoolSortKey): readonly (PoolSortKey | null)[] => [
  null,
  ...SORT_CYCLE.filter((key) => key !== "match" && key !== primary),
];
