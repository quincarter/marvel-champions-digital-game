/**
 * The filters row of Take your seats as the plain model `mc-seats-filters` takes: the search field, the aspect / source /
 * playable chips and the sort pair, the Random / hero art / Use preconstructed buttons and the open aspect tip. The press
 * handlers live in the scene (`applyChip`); this words and orders them.
 */
import type { CoreAspect } from "@mc/content";
import { artLanguageNow } from "../../art/art-source.js";
import type { FilterChip, SeatsFiltersModel } from "../../components/seats/seats.types.js";
import { sheetColor } from "../../dom/sheet-builder.js";
import { t } from "../../i18n/translate.js";
import { aspectStampOf } from "../../view/aspect-stamp.js";
import { aspectTipContentOf } from "../../view/aspect-tip-model.js";
import type { DeckOption } from "../../view/deck-list-model.js";
import { filtersLabel } from "../../view/filters-layout.js";
import { HERO_ART_KEYS } from "../../view/hero-art-choice.js";
import { searchPending } from "../../view/hero-random.js";
import { heroAspectsOf, type HeroSourceFilter } from "../../view/roster-filter.js";
import { aspectLabelOf } from "../../view/seat-slots.js";
import { setHeroFilter, setHeroSortMode, type HeroSortMode, type SetupDraft } from "../../view/setup-draft.js";
import type { HeroArt } from "../../settings.js";

const SOURCES: readonly {
  readonly kind: HeroSourceFilter;
  readonly key: "deckSource.precon" | "deckSource.imported" | "deckSource.built" | "deckSource.tested";
}[] = [
  { kind: "precon", key: "deckSource.precon" },
  { kind: "imported", key: "deckSource.imported" },
  { kind: "userBuilt", key: "deckSource.built" },
  { kind: "tested", key: "deckSource.tested" },
];
const SORTS: readonly { readonly mode: HeroSortMode; readonly key: "seats.sortWave" | "seats.sortAz" }[] = [
  { mode: "wave", key: "seats.sortWave" },
  { mode: "az", key: "seats.sortAz" },
];

/** The chips in the order the row has always had: aspects, sources, Playable now, then the By wave / A to Z pair. */
export function chipsOf(
  draft: SetupDraft,
  deckOptions: readonly DeckOption[],
  tipAspect: CoreAspect | null,
): readonly FilterChip[] {
  const filter = draft.heroFilter;
  const aspects: FilterChip[] = heroAspectsOf(deckOptions.map((option) => option.deck)).map((aspect) => {
    const label = aspectLabelOf([aspect], artLanguageNow());
    const stamp = aspectStampOf(aspect);
    return {
      id: `aspect:${aspect}`,
      label,
      selected: filter.aspect === aspect,
      tint: { fill: sheetColor(stamp.fill, "fill"), ink: sheetColor(stamp.ink, "text") },
      ...(aspectTipContentOf(aspect as CoreAspect)
        ? { info: { open: tipAspect === aspect, label: t("seats.aspectInfo", { aspect: label }) } }
        : {}),
    };
  });
  return [
    ...aspects,
    ...SOURCES.map(({ kind, key }) => ({ id: `source:${kind}`, label: t(key), selected: filter.source === kind })),
    { id: "playable-now", label: t("seats.playableNow"), selected: filter.playableOnly === true },
    ...SORTS.map(({ mode, key }) => ({ id: `sort:${mode}`, label: t(key), selected: draft.heroSortMode === mode })),
  ];
}

/** What a chip press does to the draft (a chip is a toggle; the sort pair is a segmented pair with no off). */
export function applyChip(draft: SetupDraft, id: string): SetupDraft {
  const filter = draft.heroFilter;
  if (id.startsWith("aspect:")) {
    const aspect = id.slice("aspect:".length);
    return setHeroFilter(draft, { ...filter, aspect: filter.aspect === aspect ? null : (aspect as CoreAspect) });
  }
  if (id.startsWith("source:")) {
    const kind = id.slice("source:".length) as HeroSourceFilter;
    return setHeroFilter(draft, { ...filter, source: filter.source === kind ? null : kind });
  }
  if (id === "playable-now") return setHeroFilter(draft, { ...filter, playableOnly: !filter.playableOnly });
  if (id.startsWith("sort:")) {
    const mode = id.slice("sort:".length) as HeroSortMode;
    return draft.heroSortMode === mode ? draft : setHeroSortMode(draft, mode);
  }
  return draft;
}

export interface FiltersView {
  readonly draft: SetupDraft;
  readonly deckOptions: readonly DeckOption[];
  readonly narrow: boolean;
  /** The chips are behind the Filters button (narrow, or a pad in use). */
  readonly behindButton: boolean;
  readonly folded: boolean;
  readonly searchOpen: boolean;
  /** What is typed in the field now (its debounce lags behind the keys), or null. */
  readonly typed: string | null;
  readonly tipAspect: CoreAspect | null;
  readonly heroArt: HeroArt;
  readonly randomAvailable: boolean;
  readonly rankedFor: string | null;
}

export function filtersModelOf(view: FiltersView): SeatsFiltersModel {
  const { draft } = view;
  const filter = draft.heroFilter;
  const active = (filter.aspect ? 1 : 0) + (filter.source ? 1 : 0) + (filter.playableOnly ? 1 : 0);
  const chips = view.folded ? [] : chipsOf(draft, view.deckOptions, view.tipAspect);
  const tip = !view.folded && view.tipAspect ? aspectTipContentOf(view.tipAspect) : null;
  const randomReason = searchPending(filter, view.rankedFor)
    ? t("seats.randomHeroSearching")
    : t("seats.randomHeroNone");
  return {
    searchToggle: view.narrow
      ? { label: t("seats.searchToggle"), open: view.searchOpen || filter.text.length > 0 }
      : null,
    filtersButton: view.behindButton
      ? { label: filtersLabel(active, !view.folded, artLanguageNow()), open: !view.folded }
      : null,
    search: {
      visible: !view.narrow || view.searchOpen,
      text: view.typed ?? filter.text,
      placeholder: t("seats.search"),
    },
    chips,
    rail: view.narrow,
    buttons: [
      {
        action: "random",
        label: t("seats.randomHero"),
        disabled: view.randomAvailable ? null : randomReason,
        selected: false,
      },
      { action: "game-art", label: t(HERO_ART_KEYS[view.heroArt]), disabled: null, selected: view.heroArt === "game" },
      { action: "preconstructed", label: t("seats.usePrecon"), disabled: null, selected: false },
    ],
    tip,
    tipChipId: tip && view.tipAspect ? `aspect:${view.tipAspect}` : null,
  };
}
