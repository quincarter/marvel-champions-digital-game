/** What the pool's filter, sort and view events do to the state: each one narrows the pool and sends it back to its top. */
import type { Trait } from "@mc/content";
import {
  singleChoiceOf,
  stepChoice,
  withCycles,
  type FilterChoice,
  type PoolFilter,
  type PoolSort,
} from "../../view/deck-builder-model.js";
import { choicesWithPicks as withPicks } from "../../view/pool-pick-rows.js";
import { inputDevice } from "../../platform/input-device.js";
import { t } from "../../i18n/translate.js";
import type { DeckBuilderEventDetail } from "../../components/deck-builder/shared/deck-builder-events.types.js";
import type { PoolPickSheetData } from "../pool-pick-sheet.js";
import type { SearchHelpSheetData } from "../search-help-sheet.js";
import { SCENES } from "../keys.js";
import type { BuilderHost } from "./builder-host.js";
import { QUICK_FILTERS, SORT_CYCLE, TYPE_FILTERS, thenChoicesFor } from "./filters-data.js";
import { stepChoices } from "./model-filters.js";
import { packInfos } from "./pool-data.js";

/** A new filter, kept for the next visit: the pool starts again from its top. */
function apply(host: BuilderHost, filter: PoolFilter): void {
  host.state.filter = filter;
  host.rememberView();
  host.resetPool();
  host.compose();
}

function resort(host: BuilderHost, sort: PoolSort): void {
  host.state.sort = sort;
  host.rememberView();
  host.resetPool();
  host.compose();
}

/** The search box's text changed: the pool is ranked for it and redrawn from its top. */
export function applyFilterText(host: BuilderHost, value: string): void {
  host.state.filterText = value;
  host.resetPool();
  host.state.poolSearch?.request(value);
}

/** The pack or wave picker (issue #977): every press applies at once, so the pool behind it updates. */
function openPoolPick(
  host: BuilderHost,
  title: string,
  choices: readonly FilterChoice[],
  chosen: readonly string[] | null | undefined,
  onChange: (chosen: readonly string[]) => void,
): void {
  const { scene } = host;
  if (scene.scene.isActive(SCENES.poolPick)) return;
  scene.scene.launch(SCENES.poolPick, {
    from: scene.scene.key,
    title,
    choices,
    chosen: chosen ?? [],
    onChange: (next) => {
      if (scene.sys.isActive()) onChange(next);
    },
    onClose: () => {
      if (scene.sys.isActive()) host.compose();
    },
  } satisfies PoolPickSheetData);
}

/** The search cheat sheet (issue #531): Use puts an example in the search and closes it. */
function openSearchHelp(host: BuilderHost): void {
  const { scene } = host;
  if (scene.scene.isActive(SCENES.searchHelp)) return;
  scene.scene.launch(SCENES.searchHelp, {
    from: scene.scene.key,
    onUse: (query) => {
      applyFilterText(host, query);
      host.compose();
    },
    onClose: () => {
      if (scene.sys.isActive()) host.compose();
    },
  } satisfies SearchHelpSheetData);
}

/** True for an event this handles; false leaves it to the caller. */
export function handleFilterEvent(host: BuilderHost, detail: DeckBuilderEventDetail): boolean {
  const { state } = host;
  const deck = state.deck;
  switch (detail.type) {
    case "show":
      apply(host, { ...state.filter, [detail.key]: !state.filter[detail.key] });
      return true;
    case "type-filter":
      apply(host, { ...state.filter, type: TYPE_FILTERS.find((f) => f.id === detail.id)?.type ?? null });
      return true;
    case "quick": {
      const chip = QUICK_FILTERS.find((f) => f.id === detail.id);
      if (chip) apply(host, chip.apply(state.filter, !chip.isOn(state.filter)));
      return true;
    }
    case "trait": {
      if (!deck || !state.identity) return true;
      const { traits } = stepChoices(state, deck);
      apply(host, { ...state.filter, trait: stepChoice(traits, state.filter.trait, detail.dir) as Trait | null });
      return true;
    }
    case "pack-step": {
      if (!deck || !state.identity) return true;
      const { packs } = stepChoices(state, deck);
      // With several packs picked, an arrow steps from "All packs": it goes back to one pack at a time.
      const next = stepChoice(packs, singleChoiceOf(state.filter.packCodes), detail.dir);
      apply(host, { ...state.filter, packCodes: next ? [next] : null });
      return true;
    }
    case "pack-pick": {
      if (!deck || !state.identity) return true;
      const { packs } = stepChoices(state, deck);
      // Every pack, for picks the other filters have emptied: they stay in the picker, ticked (PR #980 review).
      const all = packInfos().map((p) => ({ id: p.code, name: p.name, group: p.cycleName }));
      openPoolPick(
        host,
        t("deckBuilder.pickPacksTitle"),
        withPicks(packs, state.filter.packCodes, all),
        state.filter.packCodes,
        (chosen) => apply(host, { ...state.filter, packCodes: chosen.length ? chosen : null }),
      );
      return true;
    }
    case "cycle-pick": {
      if (!deck || !state.identity) return true;
      const { cycles } = stepChoices(state, deck);
      // Every wave, for picks the other filters have emptied: they stay in the picker, ticked (PR #980 review).
      const all = [...new Map(packInfos().map((p) => [p.cycleId, { id: p.cycleId, name: p.cycleName }])).values()];
      openPoolPick(
        host,
        t("deckBuilder.pickWavesTitle"),
        withPicks(cycles, state.filter.cycleIds, all),
        state.filter.cycleIds,
        (chosen) => apply(host, withCycles(state.filter, chosen)),
      );
      return true;
    }
    case "sort": {
      const { primary, secondary } = state.sort;
      const at = Math.max(0, SORT_CYCLE.indexOf(primary));
      const next = SORT_CYCLE[(at + 1) % SORT_CYCLE.length]!;
      resort(host, { primary: next, secondary: secondary === next ? null : secondary });
      return true;
    }
    case "then": {
      const { primary, secondary } = state.sort;
      const choices = thenChoicesFor(primary);
      const at = Math.max(0, choices.indexOf(secondary));
      resort(host, { primary, secondary: choices[(at + 1) % choices.length] ?? null });
      return true;
    }
    case "filters-toggle":
      state.filtersOpen = !state.filtersOpen;
      host.compose();
      if (inputDevice().mode === "keyboard" || inputDevice().mode === "pad") host.focusKey("filters-toggle");
      return true;
    case "search":
      if (detail.text !== state.filterText) applyFilterText(host, detail.text);
      return true;
    case "search-help":
      openSearchHelp(host);
      return true;
    case "pool-view":
      state.poolView = state.poolView === "grid" ? "list" : "grid";
      host.rememberView();
      host.resetPool();
      host.compose();
      return true;
    default:
      return false;
  }
}
