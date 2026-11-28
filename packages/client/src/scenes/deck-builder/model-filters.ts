/** The pool's filters as the elements take them: type chips, Hero / Basic toggles, quick chips, pack and sort, search. */
import type { Deck } from "@mc/content";
import { artLanguageNow } from "../../art/art-source.js";
import { aspectStampOf } from "../../view/aspect-stamp.js";
import {
  DEFAULT_POOL_SORT,
  packFilterChoices,
  pickSummaryOf,
  traitFilterChoices,
  traitLabelOf,
  type PoolSortKey,
} from "../../view/deck-builder-model.js";
import { activeDeckFilterCount } from "../../view/deck-builder-tabs.js";
import { t, type MessageKey } from "../../i18n/translate.js";
import type { PackSortModel } from "../../components/deck-builder/mc-pack-sort/mc-pack-sort.types.js";
import type { PoolSearchModel } from "../../components/deck-builder/mc-pool-search/mc-pool-search.types.js";
import type { QuickFiltersModel } from "../../components/deck-builder/mc-quick-filters/mc-quick-filters.types.js";
import type { ShowTogglesModel } from "../../components/deck-builder/mc-show-toggles/mc-show-toggles.types.js";
import type { TypeFiltersModel } from "../../components/deck-builder/mc-type-filters/mc-type-filters.types.js";
import type { FiltersFoldModel } from "../../views/deck-builder/mc-deck-builder-page/mc-deck-builder-page.types.js";
import type { BuilderState } from "./builder-state.js";
import { QUICK_FILTERS, TYPE_FILTERS, thenChoicesFor } from "./filters-data.js";
import { packInfos } from "./pool-data.js";

/** The filter the pool is ranked and listed under, with the search text's own clauses. */
export const filterNow = (state: BuilderState) => state.poolSearch?.filterFor(state.filter) ?? state.filter;

export function typeFiltersModel(state: BuilderState): TypeFiltersModel {
  const active = TYPE_FILTERS.find((f) => f.type === (state.filter.type ?? null))?.id ?? "all";
  return {
    label: t("deckBuilder.filterLabel"),
    chips: TYPE_FILTERS.map((chip) => ({
      id: chip.id,
      label: t(`deckBuilder.type.${chip.id}` as MessageKey),
      selected: chip.id === active,
    })),
  };
}

/** Each toggle on shows that kind of card in the pool, off hides it (issue #977). */
export function showTogglesModel(state: BuilderState, countText: string): ShowTogglesModel {
  return {
    label: t("deckBuilder.show"),
    toggles: [
      { id: "show-hero", key: "hideHero", label: t("deckBuilder.showHero"), shown: !state.filter.hideHero },
      {
        id: "show-basic",
        key: "hideBasic",
        label: aspectStampOf("basic", artLanguageNow()).label,
        shown: !state.filter.hideBasic,
      },
    ],
    count: countText,
  };
}

export function quickFiltersModel(state: BuilderState): QuickFiltersModel {
  const textOf = (chip: (typeof QUICK_FILTERS)[number]): string =>
    chip.id.startsWith("icon:") ? t(`deckBuilder.${chip.id.replace(":", ".")}` as MessageKey) : chip.text;
  const chip = (c: (typeof QUICK_FILTERS)[number]) => ({ id: c.id, text: textOf(c), on: c.isOn(state.filter) });
  return {
    label: t("deckBuilder.quickLabel"),
    costs: QUICK_FILTERS.filter((c) => c.id.startsWith("cost:")).map(chip),
    icons: QUICK_FILTERS.filter((c) => c.id.startsWith("icon:")).map(chip),
    // A kept trait no card shows under the other filters still names itself, so an empty pool says why.
    trait: {
      name: state.filter.trait ? traitLabelOf(state.filter.trait) : t("deckBuilder.allTraits"),
      on: state.filter.trait != null,
    },
  };
}

const sortName = (key: PoolSortKey | null): string => t(`deckBuilder.sort.${key ?? "none"}` as MessageKey);

export function packSortModel(state: BuilderState): PackSortModel {
  const infos = packInfos();
  const packNames = new Map(infos.map((p) => [p.code, p.name]));
  const cycleNames = new Map(infos.map((p) => [p.cycleId, p.cycleName]));
  const { primary, secondary } = state.sort;
  return {
    label: t("deckBuilder.packLabel"),
    pack: {
      label: `${pickSummaryOf(state.filter.packCodes, packNames, t("deckBuilder.allPacks"), (count) => t("deckBuilder.packsCount", { count }))} ▾`,
      on: Boolean(state.filter.packCodes?.length),
    },
    cycle: {
      label: `${pickSummaryOf(state.filter.cycleIds, cycleNames, t("deckBuilder.allWaves"), (count) => t("deckBuilder.wavesCount", { count }))} ▾`,
      on: Boolean(state.filter.cycleIds?.length),
    },
    sort: { label: t("deckBuilder.sortBy", { name: sortName(primary) }), on: primary !== DEFAULT_POOL_SORT.primary },
    then: { label: t("deckBuilder.thenBy", { name: sortName(secondary) }), on: secondary !== null },
  };
}

/** The trait and pack choices the steppers walk: only what the pool holds under the other filters. */
export function stepChoices(state: BuilderState, deck: Deck) {
  const args = [state.pool(), state.identity!, deck.aspects, filterNow(state), packInfos()] as const;
  const { packs, cycles } = packFilterChoices(...args);
  return { traits: traitFilterChoices(...args), packs, cycles };
}

export function searchModel(state: BuilderState): PoolSearchModel {
  return {
    text: state.filterText,
    placeholder: t("deckBuilder.searchPlaceholder"),
    clearLabel: t("deckBuilder.clearSearch"),
    helpLabel: t("deckBuilder.searchHelp"),
    viewLabel: state.poolView === "grid" ? t("deckBuilder.listView") : t("deckBuilder.cardView"),
  };
}

export function foldModel(state: BuilderState): FiltersFoldModel {
  return {
    label: t("deckBuilder.filters"),
    open: state.filtersOpen,
    active: activeDeckFilterCount(state.filter, state.sort),
  };
}

export { thenChoicesFor };
