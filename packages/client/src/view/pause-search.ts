/**
 * Pause's search (`scenes/pause.ts`): with something typed, the results take the whole sheet between the field and
 * the footer, grouped Settings first, then Rules, then Pause's own Reference rows, then the pages under Settings.
 *
 * The ranking is Settings' own (`view/settings-search.ts`, run in its worker): Pause hands it the rows below as the
 * Settings rows, and its Reference rows as extra entries. What is here is the part Pause draws: each Settings row it
 * can change in place (a toggle, or a choice of a few options), how a press changes it, the groups, and where each
 * row of the results sits. A Settings row with no control here opens Settings on that row.
 */
import type { EarnedItemId } from "../progression/earned-items.js";
import type { GuidePrefs } from "../guide/guide-prefs.js";
import type { GuideLevel } from "../guide/guide-prefs.js";
import type { Settings } from "../settings.js";
import { hit } from "../tokens.js";
import { estimateWrappedLines, toggleRowHeight } from "./layout.js";
import type { SettingsItemId } from "./settings-sections.js";
import type {
  SettingsRowText,
  SettingsSearchEntry,
  SettingsSearchIndexInput,
  SettingsSearchResult,
} from "./settings-search.js";
import {
  GUIDE_LEVEL_SEARCH_DETAIL,
  achievementPopupPlaceRowInfoOf,
  achievementPopupSizeRowInfoOf,
  achievementPopupTimeRowInfoOf,
  cardHoverRowInfoOf,
  cardLanguageRowInfoOf,
  cardSizeRowInfoOf,
  customPlacementRowInfoOf,
  customUnlockedRowInfoOf,
  deckCopyLimitsRowInfoOf,
  deckListOnOpenRowInfoOf,
  deckSignatureRowInfoOf,
  earnedItemRowInfoOf,
  effectsVolumeRowInfoOf,
  extraModularSetsRowInfoOf,
  fadeColorRowInfoOf,
  fadedCampaignArtRowInfoOf,
  guideRowDetailOf,
  guideRowInfoOf,
  heroArtRowInfoOf,
  inspectCardRowInfoOf,
  musicVolumeRowInfoOf,
  nextGuidePrefsAfterRow,
  nextSettingsAfterAchievementPopupPlace,
  nextSettingsAfterAchievementPopupSize,
  nextSettingsAfterAchievementPopupTime,
  nextSettingsAfterCardHover,
  nextSettingsAfterCardLanguage,
  nextSettingsAfterCardSize,
  nextSettingsAfterCustomPlacement,
  nextSettingsAfterDeckListOnOpen,
  nextSettingsAfterDeckSignature,
  nextSettingsAfterEffectsVolume,
  nextSettingsAfterFadeColor,
  nextSettingsAfterHeroArt,
  nextSettingsAfterInspectCard,
  nextSettingsAfterMusicVolume,
  nextSettingsAfterPlayAreaOrder,
  nextSettingsAfterToggle,
  nextSettingsAfterTokenMotion,
  nextSettingsAfterUndoPastTurn,
  nextSettingsAfterVillainRow,
  playAreaOrderRowInfoOf,
  settingsRowInfoOf,
  showPreconDecksRowInfoOf,
  tokenMotionRowInfoOf,
  undoPastTurnRowInfoOf,
  villainRowInfoOf,
  type SettingsRowInfo,
  type VillainRowId,
} from "./settings-rows.js";

/** What a Settings row found by Pause's search draws on its right, or under it. */
export type PauseControl =
  | { readonly kind: "toggle"; readonly on: boolean; readonly unavailable?: string }
  | {
      readonly kind: "choice";
      readonly options: readonly { readonly value: string; readonly label: string }[];
      readonly selected: string;
    }
  /** No control of its own here: a press opens Settings on the row. */
  | { readonly kind: "open" };

/** What a change from Pause's search writes: the settings, and the guide's own prefs. */
export interface PauseSettingsState {
  readonly settings: Settings;
  readonly guide: GuidePrefs;
}

export interface PauseSettingRow extends SettingsRowText {
  readonly id: SettingsItemId;
  readonly control: PauseControl;
  /** The state after a press on the toggle, or on the choice `value`. Absent for an "open" row. */
  readonly apply?: (
    state: PauseSettingsState,
    value: string | undefined,
    devicePixelRatio: number,
  ) => PauseSettingsState;
}

/** What this device has that the rows' words or controls depend on. */
export interface PauseSettingsEnv {
  /** Power saving mode is on (`platform/power-saving.ts`), which Reduced motion and Sharper text say. */
  readonly powerSaving: boolean;
  /** The music volume's own words differ where the Windows mixer has the game's volume. */
  readonly mixer: boolean;
  /** The hero art choice offers promo art once some is earned (`view/hero-art-choice.ts`). */
  readonly promoShown: boolean;
  readonly earned: ReadonlySet<EarnedItemId>;
}

const withSettings =
  (next: (settings: Settings, value: string) => Settings) =>
  (state: PauseSettingsState, value: string | undefined): PauseSettingsState =>
    value === undefined ? state : { ...state, settings: next(state.settings, value) };

/**
 * Every Settings row Pause's search can find, in no order (the ranking orders them): those it can change in place
 * with what a press does, and the rest as rows that open Settings. Rows that need the screen or the desktop window
 * (Screen, Window, Couch mode, Game volume, Discord, Steam) are left out: Settings itself has them, and they are found there.
 */
export function pauseSettingRowsOf(settings: Settings, guide: GuidePrefs, env: PauseSettingsEnv): PauseSettingRow[] {
  const rows: PauseSettingRow[] = [];
  const toggle = (row: SettingsRowInfo): void => {
    rows.push({
      id: row.id,
      title: row.title,
      detail: row.unavailable ?? row.detail,
      control: {
        kind: "toggle",
        on: row.on,
        ...(row.unavailable !== undefined ? { unavailable: row.unavailable } : {}),
      },
      apply: (state, _value, dpr) => ({ ...state, settings: nextSettingsAfterToggle(state.settings, row.id, dpr) }),
    });
  };
  for (const row of [
    ...settingsRowInfoOf(settings, env.powerSaving),
    deckCopyLimitsRowInfoOf(settings),
    showPreconDecksRowInfoOf(settings),
    extraModularSetsRowInfoOf(settings),
    fadedCampaignArtRowInfoOf(settings),
    customUnlockedRowInfoOf(settings),
    ...earnedItemRowInfoOf(settings, env.earned),
  ])
    toggle(row);

  const choice = <V extends string>(
    id: SettingsItemId,
    info: {
      readonly title: string;
      readonly detail: string;
      readonly options: readonly { readonly value: V; readonly label: string }[];
      readonly selected: V;
    },
    next: (settings: Settings, value: V) => Settings,
  ): void => {
    rows.push({
      id,
      title: info.title,
      detail: info.detail,
      control: { kind: "choice", options: info.options, selected: info.selected },
      // Each `next` already ignores a value that is not one of its own.
      apply: withSettings((s, v) => next(s, v as V)),
    });
  };
  choice("card-size", cardSizeRowInfoOf(settings), nextSettingsAfterCardSize);
  choice("undo-past-turn", undoPastTurnRowInfoOf(settings), nextSettingsAfterUndoPastTurn);
  choice("play-area-order", playAreaOrderRowInfoOf(settings), nextSettingsAfterPlayAreaOrder);
  choice("token-motion", tokenMotionRowInfoOf(settings), nextSettingsAfterTokenMotion);
  choice("deck-signature", deckSignatureRowInfoOf(settings), nextSettingsAfterDeckSignature);
  choice("deck-list-on-open", deckListOnOpenRowInfoOf(settings), nextSettingsAfterDeckListOnOpen);
  choice("card-hover", cardHoverRowInfoOf(settings), nextSettingsAfterCardHover);
  choice("inspect-card", inspectCardRowInfoOf(settings), nextSettingsAfterInspectCard);
  // Shown only where the bundle carries more than one language: Settings' tabs leave it out elsewhere.
  choice("card-language", cardLanguageRowInfoOf(settings), nextSettingsAfterCardLanguage);
  choice("fade-color", fadeColorRowInfoOf(settings), nextSettingsAfterFadeColor);
  choice("hero-art", heroArtRowInfoOf(settings, env.promoShown), nextSettingsAfterHeroArt);
  choice("custom-placement", customPlacementRowInfoOf(settings), nextSettingsAfterCustomPlacement);
  choice("music-volume", musicVolumeRowInfoOf(settings, env.mixer), nextSettingsAfterMusicVolume);
  choice("effects-volume", effectsVolumeRowInfoOf(settings), nextSettingsAfterEffectsVolume);
  choice("achievement-popup-time", achievementPopupTimeRowInfoOf(settings), nextSettingsAfterAchievementPopupTime);
  choice("achievement-popup-place", achievementPopupPlaceRowInfoOf(settings), nextSettingsAfterAchievementPopupPlace);
  choice("achievement-popup-size", achievementPopupSizeRowInfoOf(settings), nextSettingsAfterAchievementPopupSize);

  const villain = villainRowInfoOf(settings);
  const villainNext =
    (id: VillainRowId) =>
    (s: Settings, v: string): Settings =>
      nextSettingsAfterVillainRow(s, id, v as Parameters<typeof nextSettingsAfterVillainRow>[2]);
  choice("villain-auto", villain.autoAdvance, villainNext("villain-auto"));
  choice("villain-flip-speed", villain.flipSpeed, villainNext("villain-flip-speed"));
  choice("villain-speed", villain.beatSpeed, villainNext("villain-speed"));
  for (const [id, row] of [
    ["villain-hold", villain.hold],
    ["villain-flip", villain.flip],
    ["villain-dock", villain.dock],
  ] as const) {
    rows.push({
      id,
      title: row.title,
      detail: row.detail,
      control: { kind: "toggle", on: row.on },
      apply: (state) => ({ ...state, settings: nextSettingsAfterVillainRow(state.settings, id) }),
    });
  }

  for (const row of guideRowInfoOf(guide)) {
    if (row.kind === "segmented") {
      rows.push({
        id: row.id,
        title: row.title,
        detail: GUIDE_LEVEL_SEARCH_DETAIL,
        control: { kind: "choice", options: row.options, selected: row.selected },
        apply: (state, value) =>
          value === undefined
            ? state
            : { ...state, guide: nextGuidePrefsAfterRow(state.guide, "guide-level", value as GuideLevel) },
      });
    } else if (row.kind === "toggle") {
      rows.push({
        id: row.id,
        title: row.title,
        detail: guideRowDetailOf(row),
        control: { kind: "toggle", on: row.on },
        apply: (state) => ({ ...state, guide: nextGuidePrefsAfterRow(state.guide, row.id) }),
      });
    } else {
      rows.push({ id: row.id, title: row.title, detail: guideRowDetailOf(row), control: { kind: "open" } });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export type PauseResultGroupId = "settings" | "rules" | "reference" | "more";

export interface PauseResultGroup {
  readonly id: PauseResultGroupId;
  readonly title: string;
  readonly results: readonly SettingsSearchResult[];
}

const GROUP_TITLES: Readonly<Record<PauseResultGroupId, string>> = {
  settings: "Settings",
  rules: "Rules",
  reference: "Reference",
  more: "More",
};

function groupOf(entry: SettingsSearchEntry): PauseResultGroupId {
  switch (entry.target.kind) {
    case "setting":
      return "settings";
    case "rules":
      return "rules";
    case "pause":
      return "reference";
    default:
      return "more";
  }
}

/**
 * The ranked results in their groups: Settings first (the reason to search Pause mid-game is usually a setting), then
 * Rules, Pause's own Reference rows, and the pages under Settings. Each group keeps the ranking's order; an empty group
 * is left out. The Rules group is kept even when empty, for the row that opens the glossary on the query.
 */
export function groupPauseResults(results: readonly SettingsSearchResult[]): readonly PauseResultGroup[] {
  const order: PauseResultGroupId[] = ["settings", "rules", "reference", "more"];
  return order.flatMap((id) => {
    const inGroup = results.filter((result) => groupOf(result.entry) === id);
    if (inGroup.length === 0 && id !== "rules") return [];
    return [{ id, title: GROUP_TITLES[id], results: inGroup }];
  });
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** One row of the results, as it sizes: a group heading, a Settings row by its control, or a row that opens a page. */
export type PauseResultSlot =
  | { readonly kind: "heading" }
  | { readonly kind: "toggle"; readonly detail: string }
  | { readonly kind: "choice"; readonly detail: string }
  | { readonly kind: "link" };

export const PAUSE_RESULT_HEADING_HEIGHT = 22;
/** A row that opens a page: its title and one line of description (`scenes/settings-search-row.ts`). */
export const PAUSE_RESULT_LINK_HEIGHT = 52;
const ROW_GAP = 6;
const GROUP_GAP = 14;
const CHOICE_DETAIL_TOP = 20;
/** The description is drawn at 10px, whose lines are a little over 12px apart. */
const CHOICE_DETAIL_LINE = 12.5;
const CHOICE_DETAIL_CHAR = 5.4;

/** A choice row: its title, its description wrapped across the full width, then its options at a touch height. */
export function choiceRowHeight(detail: string, width: number): number {
  const lines = estimateWrappedLines(detail, Math.max(1, width), CHOICE_DETAIL_CHAR);
  return CHOICE_DETAIL_TOP + lines * CHOICE_DETAIL_LINE + 6 + hit.target + 6;
}

export interface PauseResultsContent {
  /** One rect per slot, in content space (`y` from the list's own top). */
  readonly rects: readonly {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
  readonly totalHeight: number;
}

/** Where each slot sits in a list `width` wide: a heading gets room above it after the first, rows a small gap. */
export function pauseResultsContentOf(slots: readonly PauseResultSlot[], width: number): PauseResultsContent {
  const rects: { x: number; y: number; width: number; height: number }[] = [];
  let y = 0;
  slots.forEach((slot, index) => {
    if (index > 0) y += slot.kind === "heading" ? GROUP_GAP : ROW_GAP;
    const height =
      slot.kind === "heading"
        ? PAUSE_RESULT_HEADING_HEIGHT
        : slot.kind === "toggle"
          ? toggleRowHeight(slot.detail, width)
          : slot.kind === "choice"
            ? choiceRowHeight(slot.detail, width)
            : PAUSE_RESULT_LINK_HEIGHT;
    rects.push({ x: 0, y, width, height });
    y += height;
  });
  return { rects, totalHeight: y };
}

// ---------------------------------------------------------------------------
// The query and its answer
// ---------------------------------------------------------------------------

/** The part of `SettingsSearchClient` the session uses, so a test can stand in a slow worker. */
export interface PauseSearchClient {
  index(input: SettingsSearchIndexInput): void;
  search(query: string, done: (results: readonly SettingsSearchResult[]) => void): void;
  cancel(): void;
}

/**
 * What is typed in Pause's search and the worker's answer for it. An answer only ever belongs to the query it was asked
 * for: typing again drops the last answer at once (the sheet says it is searching), so a result for an older query is
 * never drawn or pressed under a newer one. `reindex` sends what the rows say now and asks again for what is typed, so a
 * setting changed from the results reads as it is now.
 */
export class PauseSearchSession {
  readonly #client: PauseSearchClient;
  readonly #input: () => SettingsSearchIndexInput;
  readonly #onAnswer: (newQuery: boolean) => void;
  #query = "";
  #answer: { readonly query: string; readonly results: readonly SettingsSearchResult[] } | null = null;
  /** The query the list on screen was last answered for, kept through `setQuery` dropping the answer itself. */
  #lastAnswered: string | null = null;

  /**
   * `onAnswer` is told whether the answer is for a new query (a list to read from its top) or a fresh answer for the
   * same one after `reindex` (the same list, where the player was).
   */
  constructor(client: PauseSearchClient, input: () => SettingsSearchIndexInput, onAnswer: (newQuery: boolean) => void) {
    this.#client = client;
    this.#input = input;
    this.#onAnswer = onAnswer;
  }

  get query(): string {
    return this.#query;
  }

  /** True with something typed: the results have the sheet. */
  get searching(): boolean {
    return this.#query.trim() !== "";
  }

  /** The answer for what is typed now; null while it is on its way, and with nothing typed. */
  get results(): readonly SettingsSearchResult[] | null {
    return this.#answer !== null && this.#answer.query === this.#query ? this.#answer.results : null;
  }

  setQuery(query: string): void {
    this.#query = query;
    if (!this.searching) {
      this.#client.cancel();
      this.#answer = null;
      this.#lastAnswered = null;
      return;
    }
    if (this.#answer?.query !== query) this.#answer = null;
    this.#ask();
  }

  /** Sends what the rows say now, and asks again for what is typed. The answer on screen stays until the new one. */
  reindex(): void {
    this.#client.index(this.#input());
    if (this.searching) this.#ask();
  }

  #ask(): void {
    const query = this.#query;
    this.#client.search(query, (results) => {
      if (query !== this.#query) return;
      this.#answer = { query, results };
      const newQuery = this.#lastAnswered !== query;
      this.#lastAnswered = query;
      this.#onAnswer(newQuery);
    });
  }
}
