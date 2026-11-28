/** The whole Choose a scenario page model: its top bar, filters, shelves, stat strip, stages panel and actions. */
import type { Scenario } from "@mc/content";
import type { ScenarioSelectPageModel } from "../../views/scenario-select/mc-scenario-select-page/mc-scenario-select-page.types.js";
import { t } from "../../i18n/translate.js";
import { artLanguageNow } from "../../art/art-source.js";
import { filtersLabel } from "../../view/filters-layout.js";
import type { ScenarioDetail } from "../../view/scenario-detail.js";
import type { ScenarioRecord } from "../../view/results-history.js";
import type { ScenarioSelection } from "../../view/scenario-selection.js";
import type { ScenarioChip } from "../../components/scenario-select/mc-scenario-chips/mc-scenario-chips.types.js";
import type { ScenarioShelvesModel } from "../../components/scenario-select/mc-scenario-shelves/mc-scenario-shelves.types.js";
import type { ScenarioHints } from "./hints.js";
import { pickedModelOf, statCellsOf } from "./picked-model.js";
import type Phaser from "phaser";

export interface PageInput {
  readonly scene: Phaser.Scene;
  readonly width: number;
  readonly wide: boolean;
  readonly phone: boolean;
  readonly hints: ScenarioHints;
  readonly padMode: boolean;
  /** The chips are behind the Filters button, and whether they are folded away. */
  readonly behindButton: boolean;
  readonly folded: boolean;
  readonly searchOpen: boolean;
  readonly stagesOpen: boolean;
  readonly filter: { readonly text: string; readonly product: string | null };
  readonly chips: readonly ScenarioChip[];
  readonly shelves: ScenarioShelvesModel;
  readonly selection: ScenarioSelection;
  readonly scenario: Scenario | undefined;
  readonly detail: ScenarioDetail | null;
  readonly difficulty: string;
  readonly record: ScenarioRecord | null;
  /** Why the picked scenario is locked (the footer says how to open it for free), or null. */
  readonly lock: string | null;
  readonly unlockCost: number;
  readonly customize: string | null;
  /** The text now in the search field, if it holds more than the draft (the typist is ahead of the debounce). */
  readonly liveSearchText: string | null;
}

export function pageModelOf(input: PageInput): ScenarioSelectPageModel {
  const { wide, phone, hints, padMode, selection, lock } = input;
  const back = t("scenario.back");
  const right = t("scenario.step");
  const searchToggle = wide
    ? null
    : {
        label: t("scenario.search"),
        active: input.searchOpen || input.filter.text.length > 0,
      };
  const filtersButton = input.behindButton
    ? {
        label: filtersLabel(input.filter.product ? 1 : 0, !input.folded, artLanguageNow()),
        glyph: hints.glyph("filters"),
      }
    : null;
  // View opens Inspect here, because Y is the filters' fold (the keyboard's Inspect key is unchanged).
  const peek = padMode && wide && filtersButton !== null ? hints.glyph("peek") : null;
  const picked = pickedModelOf({
    detail: input.detail,
    difficulty: input.difficulty,
    record: input.record,
    stagesOpen: input.stagesOpen && input.scenario !== undefined,
    collapsible: !wide,
  });
  return {
    wide,
    phone,
    topBar: {
      backLabel: back,
      title: t("scenario.title"),
      right,
      backGlyph: hints.glyph("back"),
    },
    filters: {
      searchValue: input.liveSearchText ?? input.filter.text,
      placeholder: t("scenario.search"),
      clearLabel: t("deckPicker.searchClear"),
      searchShown: wide || input.searchOpen,
      searchToggle,
      filtersButton,
      inspectHint: peek ? { text: t("seats.hintInspect"), glyph: peek } : null,
      chipsShown: !input.folded,
      chips: input.chips,
    },
    shelves: input.shelves,
    stats: input.detail ? statCellsOf(input.detail) : [],
    picked,
    actions: {
      customize: input.customize,
      next: lock ? t("scenario.unlockCost", { cost: input.unlockCost }) : t("scenario.chooseHeroes"),
      nextDisabled: selection.canContinue
        ? null
        : selection.selectedId === null
          ? t("scenario.pickVillainFirst")
          : t("scenario.noneShowing"),
      nextGlyph: selection.canContinue ? hints.glyph("next") : null,
      caption: lock ?? t("scenario.stepFooter"),
      captionIsLock: lock !== null,
    },
  };
}
