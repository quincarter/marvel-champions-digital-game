/**
 * The client-preference toggle rows shown on the standalone Settings screen
 * (`scenes/settings.ts`) and inline in Pause's "Table" group (`scenes/pause.ts`,
 * design canvases D13/P16/L07) — one shared, tested list of titles/details/on-state
 * so the wording can't drift between the two places it's drawn. Pure data: a scene
 * still owns the actual toggle (it needs `appSession()`, which view modules never
 * import), keyed by `SettingsRowInfo.id`.
 */
import { t } from "../i18n/translate.js";
import { CUSTOM_PLACEMENT_VALUES, type CustomPlacement } from "../packs/custom-content-prefs.js";
import { couchFactorFits, type CouchSize } from "./couch-mode.js";
import {
  SILENCED_WARNING_KEYS,
  silenceWarning,
  unsilenceWarning,
  withLevel,
  type GuideLevel,
  type GuidePrefs,
  type SilencedWarningKey,
} from "../guide/guide-prefs.js";
import {
  ACHIEVEMENT_POPUP_PLACE_VALUES,
  ACHIEVEMENT_POPUP_SIZE_VALUES,
  ACHIEVEMENT_POPUP_TIME_VALUES,
  CARD_HOVER_SCALE_VALUES,
  CARD_SIZE_VALUES,
  DISPLAY_MODE_VALUES,
  FIRST_PLAYER_TOKEN_MOTION_VALUES,
  FRAME_RATE_VALUES,
  COUCH_MODE_VALUES,
  couchModeFactor,
  RENDER_SCALE_VALUES,
  SHARP_TEXT_RESOLUTION_CEILING,
  clampMusicVolume,
  renderScaleFactorOf,
  resolutionPixelsOf,
  type FrameRate,
  type CouchMode,
  type RenderScale,
  type AchievementPopupPlace,
  type AchievementPopupSize,
  type AchievementPopupTime,
  type CardHoverScale,
  type InspectCard,
  INSPECT_CARD_VALUES,
  type CardSize,
  PLAY_AREA_ORDER_VALUES,
  SCHEME_FAN_BACKGROUND_VALUES,
  type SchemeFanBackground,
  DECK_LIST_ON_OPEN_VALUES,
  type DeckListOnOpen,
  type PlayAreaOrder,
  type DisplayMode,
  type FirstPlayerTokenMotion,
  CAMPAIGN_FADE_COLOR_VALUES,
  type CampaignFadeColor,
  type Settings,
  DECK_SIGNATURE_CARDS_VALUES,
  UNDO_PAST_TURN_VALUES,
  type UndoPastTurn,
  type DeckSignatureCards,
  type VillainAutoAdvance,
  type VillainBeatSpeed,
  type FlipEncounterSpeed,
  type Resolution,
  HERO_ART_VALUES,
  type HeroArt,
} from "../settings.js";
import {
  CARD_LANGUAGES,
  CARD_LANGUAGE_NAMES,
  availableCardLanguages,
  type CardLanguage,
} from "../art/card-language.js";
import { CAMPAIGN_FADE_COLOR_KEYS } from "./campaign-fade-color.js";
import { FIRST_PLAYER_TOKEN_MOTION_KEYS } from "./first-player-token-motion.js";
import { powerSavingRowNote } from "./power-saving-notice.js";
import { EARNED_ITEMS, type EarnedItemId } from "../progression/earned-items.js";
import { HERO_ART_KEYS, heroArtChoicesOf, heroArtInForce } from "./hero-art-choice.js";

export type SettingsRowId =
  | "reduced-motion"
  | "sharper-text"
  | "large-card-text"
  | "dark-mode"
  | "not-offered-notices"
  | "sound"
  | "music-shuffle"
  | "confirm-end-turn"
  | "deck-copy-limits"
  | "show-precon-decks"
  | "extra-modular-sets"
  | "same-name-conflict"
  | "deck-counts-hero"
  | "deck-counts-encounter"
  | "deck-boost-average"
  | "hover-hero"
  | "hover-villain"
  | "large-schemes"
  | "scheme-stack"
  | "faded-campaign-art"
  | "discord-presence"
  | "live-watch"
  | "custom-unlocked"
  | "manual-adjust"
  | EarnedItemId;

export interface SettingsRowInfo {
  readonly id: SettingsRowId;
  readonly title: string;
  readonly detail: string;
  readonly on: boolean;
  /** Present only for a row this build can't act on yet — drawn dim with this as its reason, never omitted. */
  readonly unavailable?: string;
}

/** `powerSaving`: the device is in power saving mode (`platform/power-saving.ts`), which the two rows it turns down say. */
export function settingsRowInfoOf(settings: Settings, powerSaving = false): readonly SettingsRowInfo[] {
  const followsPowerSaving = (detail: string): string => (powerSaving ? `${detail} ${powerSavingRowNote()}` : detail);
  return [
    {
      id: "reduced-motion",
      title: t("settings.reducedMotion.title"),
      detail: followsPowerSaving(t("settings.reducedMotion.detail")),
      on: settings.reducedMotion,
    },
    {
      id: "sharper-text",
      title: t("settings.sharperText.title"),
      detail: followsPowerSaving(t("settings.sharperText.detail")),
      on: settings.textResolution > 1,
    },
    {
      id: "dark-mode",
      title: t("settings.darkMode.title"),
      detail: t("settings.darkMode.detail"),
      on: settings.darkMode,
    },
    {
      id: "large-card-text",
      title: t("settings.largeCardText.title"),
      detail: t("settings.largeCardText.detail"),
      on: settings.largeCardText,
    },
    {
      id: "sound",
      title: t("settings.sound.title"),
      detail: t("settings.sound.detail"),
      on: settings.sound,
    },
    {
      id: "music-shuffle",
      title: t("settings.musicShuffle.title"),
      detail: t("settings.musicShuffle.detail"),
      on: settings.musicShuffle,
    },
    {
      id: "confirm-end-turn",
      title: t("settings.confirmEndTurn.title"),
      detail: t("settings.confirmEndTurn.detail"),
      on: settings.confirmBeforeEndTurn,
    },
    {
      id: "not-offered-notices",
      title: t("settings.notOffered.title"),
      detail: t("settings.notOffered.detail"),
      on: settings.notOfferedNotices,
    },
    {
      id: "same-name-conflict",
      title: t("settings.sameName.title"),
      detail: t("settings.sameName.detail"),
      on: settings.sameNameHeroAllyConflict,
    },
    {
      id: "deck-counts-hero",
      title: t("settings.deckCountsHero.title"),
      detail: t("settings.deckCountsHero.detail"),
      on: settings.deckCountsHero,
    },
    {
      id: "deck-counts-encounter",
      title: t("settings.deckCountsEncounter.title"),
      detail: t("settings.deckCountsEncounter.detail"),
      on: settings.deckCountsEncounter,
    },
    {
      id: "deck-boost-average",
      title: t("settings.boostAverage.title"),
      detail: t("settings.boostAverage.detail"),
      on: settings.deckBoostAverage,
    },
    {
      id: "hover-hero",
      title: t("settings.hoverHero.title"),
      detail: t("settings.hoverHero.detail"),
      on: settings.hoverHeroCard,
    },
    {
      id: "hover-villain",
      title: t("settings.hoverVillain.title"),
      detail: t("settings.hoverVillain.detail"),
      on: settings.hoverVillainCard,
    },
    {
      id: "large-schemes",
      title: t("settings.largeSchemes.title"),
      detail: t("settings.largeSchemes.detail"),
      on: settings.largeSchemes,
    },
    {
      id: "scheme-stack",
      title: t("settings.schemeStack.title"),
      detail: t("settings.schemeStack.detail"),
      on: settings.schemeStack,
    },
  ];
}

/**
 * "Copy limits" under Gameplay (issue #531): the deck builder refuses an add that breaks a copy limit. Only the
 * Settings screen draws it (not Pause's in-game group), so it is not in `settingsRowInfoOf`.
 */
export function deckCopyLimitsRowInfoOf(settings: Settings): SettingsRowInfo {
  return {
    id: "deck-copy-limits",
    title: t("settings.copyLimits.title"),
    detail: t("settings.copyLimits.detail"),
    on: settings.deckCopyLimits,
  };
}

/**
 * "Allow extra modular sets" under Gameplay (issue #761): a house rule for Table setup. Settings only, so not in
 * `settingsRowInfoOf`. Off by default: a scenario takes the modular sets it calls for.
 */
export function extraModularSetsRowInfoOf(settings: Settings): SettingsRowInfo {
  return {
    id: "extra-modular-sets",
    title: t("settings.extraModular.title"),
    detail: t("settings.extraModular.detail"),
    on: settings.allowExtraModularSets,
  };
}

/**
 * "Show preconstructed decks" under Gameplay (issue #755): the Decks screen's list. Settings only, so not in
 * `settingsRowInfoOf`. It never takes a precon out of Take your seats.
 */
export function showPreconDecksRowInfoOf(settings: Settings): SettingsRowInfo {
  return {
    id: "show-precon-decks",
    title: t("settings.showPrecons.title"),
    detail: t("settings.showPrecons.detail"),
    on: settings.showPreconDecks,
  };
}

/** "Faded art on campaign pages" under Animation and display (issue #609). Settings only, not Pause's in-game group, so it is not in `settingsRowInfoOf`. */
export function fadedCampaignArtRowInfoOf(settings: Settings): SettingsRowInfo {
  return {
    id: "faded-campaign-art",
    title: t("settings.fadedArt.title"),
    detail: t("settings.fadedArt.detail"),
    on: settings.fadedCampaignArt,
  };
}

/**
 * Settings > More > Custom content (issue #734): whether new custom content starts unlocked. Settings only, not Pause's
 * in-game group.
 */
export function customUnlockedRowInfoOf(settings: Settings): SettingsRowInfo {
  return {
    id: "custom-unlocked",
    title: t("settings.customUnlocked.title"),
    detail: t("settings.customUnlocked.detail"),
    on: settings.customUnlocked,
  };
}

/**
 * Settings > More > Cheats (the owner, 2026-11-19): whether Pause offers Manual adjust (#791). Off by default;
 * turning it on asks first (`cheatUnlockWarningOf`).
 */
export function manualAdjustRowInfoOf(settings: Settings): SettingsRowInfo {
  return {
    id: "manual-adjust",
    title: t("settings.manualAdjust.title"),
    detail: t("settings.manualAdjust.detail"),
    on: settings.allowManualAdjust,
  };
}

const customPlacementLabels = (): Readonly<Record<CustomPlacement, string>> => ({
  top: t("settings.top"),
  bottom: t("settings.bottom"),
  mixed: t("settings.customPlacement.mixed"),
});

/** Settings > More > Custom content (issue #734): where installed packs' heroes and scenarios sit in the lists. */
export function customPlacementRowInfoOf(settings: Settings): AchievementPopupRowInfo<CustomPlacement> {
  return {
    title: t("settings.customPlacement.title"),
    detail: t("settings.customPlacement.detail"),
    options: (["top", "bottom", "mixed"] as const).map((value) => ({ value, label: customPlacementLabels()[value] })),
    selected: settings.customPlacement,
  };
}

/** `settings` with the custom content placement set; a value that is not one of the three changes nothing. */
export function nextSettingsAfterCustomPlacement(settings: Settings, value: CustomPlacement): Settings {
  return CUSTOM_PLACEMENT_VALUES.includes(value) ? { ...settings, customPlacement: value } : settings;
}

/** The desktop app's "Show my game on Discord" row. Drawn only there, so it is not in `settingsRowInfoOf` (shared with Pause). */
export function discordRowInfoOf(settings: Settings): SettingsRowInfo {
  return {
    id: "discord-presence",
    title: t("settings.discord.title"),
    detail: t("settings.discord.detail"),
    on: settings.discordPresence,
  };
}

/** Settings > More > Online name (#880): one button showing the name (or asking for one); it opens the name sheet. */
export function onlineNameRowInfoOf(settings: Settings): AchievementPopupRowInfo<string> {
  return {
    title: t("online.nameSetting"),
    detail: t("online.nameSettingDetail"),
    options: [{ value: "change", label: settings.onlineName || t("online.nameSettingNone") }],
    selected: "",
  };
}

/** "Let people watch my games" (#876): off until switched on; anyone with the watch link can then watch. */
export function liveWatchRowInfoOf(settings: Settings): SettingsRowInfo {
  return {
    id: "live-watch",
    title: t("live.setting.title"),
    detail: t("live.setting.detail"),
    on: settings.liveWatch,
  };
}

/**
 * Settings ▸ More ▸ Earned items (issue #291): one toggle per earned item. One not earned yet is still listed, dim, and
 * says how to earn it instead of what it does.
 */
export function earnedItemRowInfoOf(settings: Settings, earned: ReadonlySet<EarnedItemId>): readonly SettingsRowInfo[] {
  return EARNED_ITEMS.map((item) => ({
    id: item.id,
    title: t(`settings.earned.${item.id}.title`),
    detail: t(`settings.earned.${item.id}.detail`),
    on: earned.has(item.id) && settings[item.setting],
    ...(earned.has(item.id) ? {} : { unavailable: t(`settings.earned.${item.id}.howToEarn`) }),
  }));
}

/**
 * The value "Sharper text" should switch *to* when it's off, given the density the game draws at
 * (`platform/screen-settings.ts#drawnDensity`: the pixel ratio or the render scale, couch mode's included). What "off"
 * restores is always `1`.
 */
export function sharperTextTargetResolution(devicePixelRatio: number): number {
  return Math.min(SHARP_TEXT_RESOLUTION_CEILING, Math.max(1, devicePixelRatio || 1));
}

/**
 * `settings` with one row's toggle applied — the one place that logic lives,
 * so Pause's inline "Table" group and the standalone Settings screen flip the
 * same field the same way.
 */
export function nextSettingsAfterToggle(settings: Settings, id: SettingsRowId, devicePixelRatio: number): Settings {
  switch (id) {
    case "reduced-motion":
      return { ...settings, reducedMotion: !settings.reducedMotion };
    case "sharper-text":
      return {
        ...settings,
        textResolution: settings.textResolution > 1 ? 1 : sharperTextTargetResolution(devicePixelRatio),
      };
    case "large-card-text":
      return { ...settings, largeCardText: !settings.largeCardText };
    case "dark-mode":
      return { ...settings, darkMode: !settings.darkMode };
    case "sound":
      return { ...settings, sound: !settings.sound };
    case "music-shuffle":
      return { ...settings, musicShuffle: !settings.musicShuffle };
    case "confirm-end-turn":
      return { ...settings, confirmBeforeEndTurn: !settings.confirmBeforeEndTurn };
    case "deck-copy-limits":
      return { ...settings, deckCopyLimits: !settings.deckCopyLimits };
    case "extra-modular-sets":
      return { ...settings, allowExtraModularSets: !settings.allowExtraModularSets };
    case "show-precon-decks":
      return { ...settings, showPreconDecks: !settings.showPreconDecks };
    case "not-offered-notices":
      return { ...settings, notOfferedNotices: !settings.notOfferedNotices };
    case "same-name-conflict":
      return { ...settings, sameNameHeroAllyConflict: !settings.sameNameHeroAllyConflict };
    case "deck-counts-hero":
      return { ...settings, deckCountsHero: !settings.deckCountsHero };
    case "deck-counts-encounter":
      return { ...settings, deckCountsEncounter: !settings.deckCountsEncounter };
    case "deck-boost-average":
      return { ...settings, deckBoostAverage: !settings.deckBoostAverage };
    case "hover-hero":
      return { ...settings, hoverHeroCard: !settings.hoverHeroCard };
    case "hover-villain":
      return { ...settings, hoverVillainCard: !settings.hoverVillainCard };
    case "large-schemes":
      return { ...settings, largeSchemes: !settings.largeSchemes };
    case "scheme-stack":
      return { ...settings, schemeStack: !settings.schemeStack };
    case "faded-campaign-art":
      return { ...settings, fadedCampaignArt: !settings.fadedCampaignArt };
    case "discord-presence":
      return { ...settings, discordPresence: !settings.discordPresence };
    case "live-watch":
      return { ...settings, liveWatch: !settings.liveWatch };
    case "custom-unlocked":
      return { ...settings, customUnlocked: !settings.customUnlocked };
    case "manual-adjust":
      return { ...settings, allowManualAdjust: !settings.allowManualAdjust };
    case "ultron-drone-art":
      return { ...settings, ultronDroneArt: !settings.ultronDroneArt };
    case "promo-art":
      return { ...settings, promoArtOn: !settings.promoArtOn };
  }
}

// ---------------------------------------------------------------------------
// The Guide group (docs/guided-mode.md §4 G2b): a segmented "Guide level" row,
// two action rows opening the "How to play" hub (`scenes/how-to-play.ts`, G6c/G10c) — "Play the tutorial"
// at THE BASICS, "Aspect lessons" at ASPECTS — and one toggle per hint warning. Drawn in the same two
// places as the rows above (`scenes/settings.ts`, Pause's inline group), from `guideRowInfoOf`.
// ---------------------------------------------------------------------------

export interface GuideLevelOption {
  readonly value: GuideLevel;
  readonly label: string;
  readonly detail: string;
}

/** "Full — Every step explained" / "Hints — Only before mistakes" / "Off — Glossary stays on" (docs/guided-mode.md §3.9, the debrief tile). */
export const guideLevelOptions = (): readonly GuideLevelOption[] => [
  { value: "full", label: t("settings.guide.full"), detail: t("settings.guide.fullDetail") },
  { value: "hints", label: t("settings.guide.hints"), detail: t("settings.guide.hintsDetail") },
  { value: "off", label: t("settings.guide.off"), detail: t("settings.guide.offDetail") },
];

/** The Guide level row's text for Settings' search: it draws no detail line of its own, its options say it. */
export const guideLevelSearchDetail = (): string =>
  guideLevelOptions()
    .map((o) => `${o.label}: ${o.detail}.`)
    .join(" ");

export interface GuideLevelRowInfo {
  readonly kind: "segmented";
  readonly id: "guide-level";
  readonly title: string;
  readonly options: readonly GuideLevelOption[];
  readonly selected: GuideLevel;
}

export interface GuideActionRowInfo {
  readonly kind: "action";
  readonly id: "play-tutorial" | "aspect-lessons";
  readonly title: string;
  readonly detail: string;
  /** Unset today — both actions open the "How to play" hub. Kept for a future action row without a target yet. */
  readonly unavailable?: string;
}

export interface GuideToggleRowInfo {
  readonly kind: "toggle";
  readonly id: SilencedWarningKey;
  readonly title: string;
  readonly detail: string;
  /** On when this warning is *not* silenced — the default. */
  readonly on: boolean;
}

export type GuideRowInfo = GuideLevelRowInfo | GuideActionRowInfo | GuideToggleRowInfo;

export type GuideSettingsRowId = "guide-level" | "play-tutorial" | "aspect-lessons" | SilencedWarningKey;

const warningRowCopy = (): Record<SilencedWarningKey, { readonly title: string; readonly detail: string }> => ({
  schemeFinish: {
    title: t("settings.warning.schemeFinish.title"),
    detail: t("settings.warning.schemeFinish.detail"),
  },
  lethal: {
    title: t("settings.warning.lethal.title"),
    detail: t("settings.warning.lethal.detail"),
  },
  schemeClose: {
    title: t("settings.warning.schemeClose.title"),
    detail: t("settings.warning.schemeClose.detail"),
  },
  flipDanger: {
    title: t("settings.warning.flipDanger.title"),
    detail: t("settings.warning.flipDanger.detail"),
  },
  wastedPay: {
    title: t("settings.warning.wastedPay.title"),
    detail: t("settings.warning.wastedPay.detail"),
  },
});

/** The Guide group's own rows, in draw order, from the live `GuidePrefs`. */
export function guideRowInfoOf(prefs: GuidePrefs): readonly GuideRowInfo[] {
  return [
    {
      kind: "segmented",
      id: "guide-level",
      title: t("settings.guide.level"),
      options: guideLevelOptions(),
      selected: prefs.level,
    },
    {
      kind: "action",
      id: "play-tutorial",
      title: prefs.tutorial.finished ? t("settings.guide.replayTutorial") : t("settings.guide.playTutorial"),
      detail: t("settings.guide.tutorialDetail"),
    },
    {
      kind: "action",
      id: "aspect-lessons",
      title: t("settings.guide.aspectLessons"),
      detail: t("settings.guide.aspectLessonsDetail"),
    },
    ...SILENCED_WARNING_KEYS.map((key): GuideToggleRowInfo => ({
      kind: "toggle",
      id: key,
      title: warningRowCopy()[key].title,
      detail: warningRowCopy()[key].detail,
      on: !prefs.silencedWarnings.includes(key),
    })),
  ];
}

/**
 * `prefs` with one Guide row's control applied — the one place that logic lives, mirroring
 * `nextSettingsAfterToggle` above. `level` is only read for `"guide-level"`; the two action rows carry no prefs
 * change of their own — opening the "How to play" hub is `scenes/settings.ts#activateGuideRow`'s own job, a
 * navigation rather than a preference.
 */
export function nextGuidePrefsAfterRow(prefs: GuidePrefs, id: GuideSettingsRowId, level?: GuideLevel): GuidePrefs {
  if (id === "guide-level") return withLevel(prefs, level ?? prefs.level);
  if (id === "play-tutorial" || id === "aspect-lessons") return prefs;
  return prefs.silencedWarnings.includes(id) ? unsilenceWarning(prefs, id) : silenceWarning(prefs, id);
}

/** The text an action or toggle row after "Guide level" actually renders — `row.unavailable ?? row.detail` for an action row (both scenes' own layout pass this to `settingsLayout`/`pauseLayout` to size the row), `row.detail` for a toggle. */
export function guideRowDetailOf(row: GuideActionRowInfo | GuideToggleRowInfo): string {
  return row.kind === "action" ? (row.unavailable ?? row.detail) : row.detail;
}

// ---------------------------------------------------------------------------
// The Villain phase group (settings mockup artifacts/design-screenshots/villain-phase/s1-...): a three-tile
// "Auto-advance" choice, two toggles and a three-segment "Beat speed". Drawn only on the standalone Settings
// screen, so it has its own info list rather than joining `settingsRowInfoOf` (which Pause's inline Table group shares).
// ---------------------------------------------------------------------------

export interface VillainOption<V extends string> {
  readonly value: V;
  readonly label: string;
  readonly detail: string;
}

export const villainAutoAdvanceOptions = (): readonly VillainOption<VillainAutoAdvance>[] => [
  { value: "off", label: t("settings.optionOff"), detail: t("settings.villainAuto.offDetail") },
  {
    value: "afterPause",
    label: t("settings.villainAuto.afterPause"),
    detail: t("settings.villainAuto.afterPauseDetail"),
  },
  { value: "on", label: t("settings.optionOn"), detail: t("settings.villainAuto.onDetail") },
];

export const villainBeatSpeedOptions = (): readonly VillainOption<VillainBeatSpeed>[] => [
  { value: "slow", label: t("settings.slow"), detail: t("settings.beatSpeed.slowDetail") },
  { value: "normal", label: t("settings.normal"), detail: "" },
  { value: "fast", label: t("settings.fast"), detail: t("settings.beatSpeed.fastDetail") },
];

export const flipEncounterSpeedOptions = (): readonly VillainOption<FlipEncounterSpeed>[] => [
  { value: "slow", label: t("settings.slow"), detail: t("settings.flipSpeed.slowDetail") },
  { value: "normal", label: t("settings.normal"), detail: "" },
  { value: "off", label: t("settings.optionOff"), detail: t("settings.flipSpeed.offDetail") },
];

export type VillainRowId =
  | "villain-auto"
  | "villain-hold"
  | "villain-flip"
  | "villain-flip-speed"
  | "villain-speed"
  | "villain-dock";

export interface VillainRowsInfo {
  readonly autoAdvance: {
    readonly title: string;
    readonly detail: string;
    readonly options: readonly VillainOption<VillainAutoAdvance>[];
    readonly selected: VillainAutoAdvance;
  };
  readonly hold: { readonly title: string; readonly detail: string; readonly on: boolean };
  readonly flip: { readonly title: string; readonly detail: string; readonly on: boolean };
  readonly flipSpeed: {
    readonly title: string;
    readonly detail: string;
    readonly options: readonly VillainOption<FlipEncounterSpeed>[];
    readonly selected: FlipEncounterSpeed;
  };
  readonly beatSpeed: {
    readonly title: string;
    readonly detail: string;
    readonly options: readonly VillainOption<VillainBeatSpeed>[];
    readonly selected: VillainBeatSpeed;
  };
  readonly dock: { readonly title: string; readonly detail: string; readonly on: boolean };
}

export function villainRowInfoOf(settings: Settings): VillainRowsInfo {
  return {
    autoAdvance: {
      title: t("settings.villainAuto.title"),
      detail: t("settings.villainAuto.detail"),
      options: villainAutoAdvanceOptions(),
      selected: settings.villainAutoAdvance,
    },
    hold: {
      title: t("settings.villainHold.title"),
      detail: t("settings.villainHold.detail"),
      on: settings.holdEncounterCards,
    },
    flip: {
      title: t("settings.villainFlip.title"),
      detail: t("settings.villainFlip.detail"),
      on: settings.flipEncounterCards,
    },
    flipSpeed: {
      title: t("settings.flipSpeed.title"),
      detail: t("settings.flipSpeed.detail"),
      options: flipEncounterSpeedOptions(),
      selected: settings.flipEncounterSpeed,
    },
    beatSpeed: {
      title: t("settings.beatSpeed.title"),
      detail: t("settings.beatSpeed.detail"),
      options: villainBeatSpeedOptions(),
      selected: settings.villainBeatSpeed,
    },
    dock: {
      title: t("settings.villainDock.title"),
      detail: t("settings.villainDock.detail"),
      on: settings.villainDockTable,
    },
  };
}

/** `settings` with one Villain phase control applied; `value` is read only for the two choice rows. */
export function nextSettingsAfterVillainRow(
  settings: Settings,
  id: VillainRowId,
  value?: VillainAutoAdvance | VillainBeatSpeed | FlipEncounterSpeed,
): Settings {
  switch (id) {
    case "villain-auto":
      return villainAutoAdvanceOptions().some((o) => o.value === value)
        ? { ...settings, villainAutoAdvance: value as VillainAutoAdvance }
        : settings;
    case "villain-speed":
      return villainBeatSpeedOptions().some((o) => o.value === value)
        ? { ...settings, villainBeatSpeed: value as VillainBeatSpeed }
        : settings;
    case "villain-flip-speed":
      return flipEncounterSpeedOptions().some((o) => o.value === value)
        ? { ...settings, flipEncounterSpeed: value as FlipEncounterSpeed }
        : settings;
    case "villain-hold":
      return { ...settings, holdEncounterCards: !settings.holdEncounterCards };
    case "villain-flip":
      return { ...settings, flipEncounterCards: !settings.flipEncounterCards };
    case "villain-dock":
      return { ...settings, villainDockTable: !settings.villainDockTable };
  }
}

// ---------------------------------------------------------------------------
// "Card size on hover": the desktop mouse popover (`scenes/board/hover-preview.ts`). A five-segment choice, drawn only
// on a desktop-sized Settings screen (a phone or tablet has long-press Inspect and never shows the popover).
// ---------------------------------------------------------------------------

export const cardHoverScaleLabels = (): Readonly<Record<CardHoverScale, string>> => ({
  off: t("settings.optionOff"),
  "1.5x": "1.5×",
  "2x": "2×",
  "2.5x": "2.5×",
  "3x": "3×",
  "4x": "4×",
});

// ---------------------------------------------------------------------------
// The volumes (#243), desktop only (a phone or tablet uses the device's own volume): the game's own entry in the
// Windows volume mixer (the Windows desktop app only), and the music's and the sound effects' levels within the game,
// so either can sit louder than the other.
// ---------------------------------------------------------------------------

export const VOLUME_STEPS = ["0", "25", "50", "75", "100"] as const;
export type VolumeStep = (typeof VOLUME_STEPS)[number];

export interface VolumeRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: VolumeStep; readonly label: string }[];
  /** The step nearest the volume set (the music player's slider and the mixer set any whole percent). */
  readonly selected: VolumeStep;
}

function volumeRowInfo(title: string, detail: string, percent: number): VolumeRowInfo {
  const volume = clampMusicVolume(percent);
  const selected = VOLUME_STEPS.reduce((best, step) =>
    Math.abs(Number(step) - volume) < Math.abs(Number(best) - volume) ? step : best,
  );
  return {
    title,
    detail,
    options: VOLUME_STEPS.map((value) => ({ value, label: value === "0" ? t("settings.optionOff") : `${value}%` })),
    selected,
  };
}

/** The game's volume in the Windows mixer, as last read (`platform/app-volume.ts`). */
export function gameVolumeRowInfoOf(mixerPercent: number): VolumeRowInfo {
  return volumeRowInfo(t("settings.gameVolume.title"), t("settings.gameVolume.detail"), mixerPercent);
}

export function musicVolumeRowInfoOf(settings: Settings, mixer: boolean): VolumeRowInfo {
  return volumeRowInfo(
    t("settings.musicVolume.title"),
    mixer ? t("settings.musicVolume.detailMixer") : t("settings.musicVolume.detail"),
    settings.musicVolume,
  );
}

export function effectsVolumeRowInfoOf(settings: Settings): VolumeRowInfo {
  return volumeRowInfo(t("settings.effectsVolume.title"), t("settings.effectsVolume.detail"), settings.effectsVolume);
}

/** `settings` with the music volume set to a step; a value that is not a step changes nothing. */
export function nextSettingsAfterMusicVolume(settings: Settings, value: VolumeStep): Settings {
  return VOLUME_STEPS.includes(value) ? { ...settings, musicVolume: Number(value) } : settings;
}

/** `settings` with the effects volume set to a step; a value that is not a step changes nothing. */
export function nextSettingsAfterEffectsVolume(settings: Settings, value: VolumeStep): Settings {
  return VOLUME_STEPS.includes(value) ? { ...settings, effectsVolume: Number(value) } : settings;
}

export interface CardHoverRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: CardHoverScale; readonly label: string }[];
  readonly selected: CardHoverScale;
}

export function cardHoverRowInfoOf(settings: Settings): CardHoverRowInfo {
  return {
    title: t("settings.cardHover.title"),
    detail: t("settings.cardHover.detail"),
    options: CARD_HOVER_SCALE_VALUES.map((value) => ({ value, label: cardHoverScaleLabels()[value] })),
    selected: settings.cardHoverScale,
  };
}

/** `settings` with the hover size set; a value that is not one of the seven changes nothing. */
export function nextSettingsAfterCardHover(settings: Settings, value: CardHoverScale): Settings {
  return CARD_HOVER_SCALE_VALUES.includes(value) ? { ...settings, cardHoverScale: value } : settings;
}

// ---------------------------------------------------------------------------
// "Card size": how large every card is drawn on the Decks, deck builder, Rules and campaign card grids. A global
// setting, shown on every form factor.
// ---------------------------------------------------------------------------

export const cardSizeLabels = (): Readonly<Record<CardSize, string>> => ({
  standard: t("settings.cardSize.standard"),
  same: t("settings.cardSize.same"),
  large: t("settings.large"),
  xlarge: t("settings.cardSize.xlarge"),
});

export const inspectCardLabels = (): Readonly<Record<InspectCard, string>> => ({
  large: t("settings.inspectCard.large"),
  sideBySide: t("settings.inspectCard.sideBySide"),
});

export interface InspectCardRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: InspectCard; readonly label: string }[];
  readonly selected: InspectCard;
}

/** The phone-portrait Inspect layout (#358): the scan across the sheet, or the older small scan beside the text. */
export function inspectCardRowInfoOf(settings: Settings): InspectCardRowInfo {
  return {
    title: t("settings.inspectCard.title"),
    detail: t("settings.inspectCard.detail"),
    options: INSPECT_CARD_VALUES.map((value) => ({ value, label: inspectCardLabels()[value] })),
    selected: settings.inspectCard,
  };
}

/** `settings` with the Inspect layout set; a value that is not one of the two changes nothing. */
export function nextSettingsAfterInspectCard(settings: Settings, value: InspectCard): Settings {
  return INSPECT_CARD_VALUES.includes(value) ? { ...settings, inspectCard: value } : settings;
}

export interface CardLanguageRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: CardLanguage; readonly label: string }[];
  readonly selected: CardLanguage;
}

/** "Card art language" (#337): the languages this bundle carries (the web carries all; a native installer one, so no row). */
export function cardLanguageRowInfoOf(settings: Settings): CardLanguageRowInfo {
  const carried = availableCardLanguages();
  return {
    title: t("settings.cardLanguage.title"),
    detail: t("settings.cardLanguage.detail"),
    options: carried.map((value) => ({ value, label: CARD_LANGUAGE_NAMES[value] })),
    selected: carried.includes(settings.cardLanguage) ? settings.cardLanguage : (carried[0] ?? "en"),
  };
}

/** `settings` with the card art language set; one this bundle does not carry changes nothing. */
export function nextSettingsAfterCardLanguage(settings: Settings, value: CardLanguage): Settings {
  return CARD_LANGUAGES.includes(value) && availableCardLanguages().includes(value)
    ? { ...settings, cardLanguage: value }
    : settings;
}

export interface CardSizeRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: CardSize; readonly label: string }[];
  readonly selected: CardSize;
}

export function cardSizeRowInfoOf(settings: Settings): CardSizeRowInfo {
  return {
    title: t("settings.cardSize.title"),
    detail: t("settings.cardSize.detail"),
    options: CARD_SIZE_VALUES.map((value) => ({ value, label: cardSizeLabels()[value] })),
    selected: settings.cardSize,
  };
}

/** `settings` with the card size set; a value that is not one of the three changes nothing. */
export function nextSettingsAfterCardSize(settings: Settings, value: CardSize): Settings {
  return CARD_SIZE_VALUES.includes(value) ? { ...settings, cardSize: value } : settings;
}

export const playAreaOrderLabels = (): Readonly<Record<PlayAreaOrder, string>> => ({
  played: t("settings.playAreaOrder.played"),
  type: t("settings.playAreaOrder.type"),
  cost: t("settings.playAreaOrder.cost"),
  name: t("settings.playAreaOrder.name"),
});

const schemeFanBackgroundLabels = (): Readonly<Record<SchemeFanBackground, string>> => ({
  "0": t("settings.fanBackground.none"),
  "25": "25%",
  "50": "50%",
  "75": "75%",
  "100": t("settings.fanBackground.solid"),
});

/** "Fan background" under Cards: how solid the paper behind the scheme fan's cards is. Settings only, like Card size. */
export function schemeFanBackgroundRowInfoOf(settings: Settings): AchievementPopupRowInfo<SchemeFanBackground> {
  return {
    title: t("settings.fanBackground.title"),
    detail: t("settings.fanBackground.detail"),
    options: SCHEME_FAN_BACKGROUND_VALUES.map((value) => ({ value, label: schemeFanBackgroundLabels()[value] })),
    selected: settings.schemeFanBackground,
  };
}

/** `settings` with the scheme fan's background set; a value that is not one of the five changes nothing. */
export function nextSettingsAfterSchemeFanBackground(settings: Settings, value: SchemeFanBackground): Settings {
  return SCHEME_FAN_BACKGROUND_VALUES.includes(value) ? { ...settings, schemeFanBackground: value } : settings;
}

export interface PlayAreaOrderRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: PlayAreaOrder; readonly label: string }[];
  readonly selected: PlayAreaOrder;
}

/** "Play area order" under Cards (#768): how the cards in a play area are laid out. Only the drawing changes. */
export function playAreaOrderRowInfoOf(settings: Settings): PlayAreaOrderRowInfo {
  return {
    title: t("settings.playAreaOrder.title"),
    detail: t("settings.playAreaOrder.detail"),
    options: PLAY_AREA_ORDER_VALUES.map((value) => ({ value, label: playAreaOrderLabels()[value] })),
    selected: settings.playAreaOrder,
  };
}

/** `settings` with the play area order set; a value that is not one of the four changes nothing. */
export function nextSettingsAfterPlayAreaOrder(settings: Settings, value: PlayAreaOrder): Settings {
  return PLAY_AREA_ORDER_VALUES.includes(value) ? { ...settings, playAreaOrder: value } : settings;
}

export const deckListOnOpenLabels = (): Readonly<Record<DeckListOnOpen, string>> => ({
  all: t("settings.deckListOnOpen.all"),
  precon: t("settings.deckListOnOpen.precon"),
  build: t("settings.deckListOnOpen.build"),
  community: t("settings.deckListOnOpen.community"),
  last: t("settings.deckListOnOpen.last"),
});

export interface DeckListOnOpenRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: DeckListOnOpen; readonly label: string }[];
  readonly selected: DeckListOnOpen;
}

/** "Deck list on open" under Gameplay (#755): which list the Decks screen opens on. Hiding precons drops that option. */
export function deckListOnOpenRowInfoOf(settings: Settings): DeckListOnOpenRowInfo {
  return {
    title: t("settings.deckListOnOpen.title"),
    detail: t("settings.deckListOnOpen.detail"),
    options: DECK_LIST_ON_OPEN_VALUES.filter((value) => value !== "precon" || settings.showPreconDecks).map(
      (value) => ({
        value,
        label: deckListOnOpenLabels()[value],
      }),
    ),
    selected: settings.deckListOnOpen === "precon" && !settings.showPreconDecks ? "all" : settings.deckListOnOpen,
  };
}

/** `settings` with the opening list set; a value that is not one of the five changes nothing. */
export function nextSettingsAfterDeckListOnOpen(settings: Settings, value: DeckListOnOpen): Settings {
  return DECK_LIST_ON_OPEN_VALUES.includes(value) ? { ...settings, deckListOnOpen: value } : settings;
}

// ---------------------------------------------------------------------------
// "First player token": how the token travels to a new first player (`view/first-player-token-motion.ts`). A
// five-segment choice after Card size, shown on every form factor.
// ---------------------------------------------------------------------------

export interface UndoPastTurnRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: UndoPastTurn; readonly label: string }[];
  readonly selected: UndoPastTurn;
}

/** "Undo past your turn" under More > Cheats (issues #791, #899): allow, warn first, or off. */
export function undoPastTurnRowInfoOf(settings: Settings): UndoPastTurnRowInfo {
  return {
    title: t("settings.undoPastTurn.title"),
    detail: t("settings.undoPastTurn.detail"),
    options: [
      { value: "allow", label: t("settings.undoPastTurn.allow") },
      { value: "warn", label: t("settings.undoPastTurn.warn") },
      { value: "off", label: t("settings.optionOff") },
    ],
    selected: settings.undoPastTurn,
  };
}

/** What a change that turns on a way out of the rules says before it takes effect (`cheatUnlockWarningOf`). */
export interface CheatUnlockWarning {
  readonly title: string;
  readonly sentence: string;
  readonly confirmLabel: string;
}

/**
 * The warning a settings change must show before it lands, or null (BluefireF5ran and the owner, 2026-11-19): turning
 * Undo past your turn on from Off, or turning Allow manual adjust on. Either lets a game stop counting, which a player
 * should only ever find out about up front. Moving between Warn and Allow, or turning either off, asks nothing.
 */
export function cheatUnlockWarningOf(before: Settings, after: Settings): CheatUnlockWarning | null {
  if (before.undoPastTurn === "off" && after.undoPastTurn !== "off") {
    return {
      title: t("settings.cheat.undo.title"),
      sentence: t("settings.cheat.undo.sentence"),
      confirmLabel: t("settings.cheat.undo.confirm"),
    };
  }
  if (!before.allowManualAdjust && after.allowManualAdjust) {
    return {
      title: t("settings.cheat.adjust.title"),
      sentence: t("settings.cheat.adjust.sentence"),
      confirmLabel: t("settings.cheat.adjust.confirm"),
    };
  }
  return null;
}

/** `settings` with Undo's reach set; a value that is not one of the three changes nothing. */
export function nextSettingsAfterUndoPastTurn(settings: Settings, value: UndoPastTurn): Settings {
  return UNDO_PAST_TURN_VALUES.includes(value) ? { ...settings, undoPastTurn: value } : settings;
}

export interface DeckSignatureRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: DeckSignatureCards; readonly label: string }[];
  readonly selected: DeckSignatureCards;
}

/** "Signature cards" under Gameplay (issue #531): free, standard (kept at the set's count) or hidden from the pool. */
export function deckSignatureRowInfoOf(settings: Settings): DeckSignatureRowInfo {
  return {
    title: t("settings.signature.title"),
    detail: t("settings.signature.detail"),
    options: [
      { value: "free", label: t("settings.signature.free") },
      { value: "standard", label: t("settings.signature.standard") },
      { value: "hidden", label: t("settings.signature.hidden") },
    ],
    selected: settings.deckSignatureCards,
  };
}

/** `settings` with the signature cards rule set; a value that is not one of the three changes nothing. */
export function nextSettingsAfterDeckSignature(settings: Settings, value: DeckSignatureCards): Settings {
  return DECK_SIGNATURE_CARDS_VALUES.includes(value) ? { ...settings, deckSignatureCards: value } : settings;
}

export interface FadeColorRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: CampaignFadeColor; readonly label: string }[];
  readonly selected: CampaignFadeColor;
}

/** "Fade color" under Animation and display, after Faded art on campaign pages (issue #609). */
export function fadeColorRowInfoOf(settings: Settings): FadeColorRowInfo {
  return {
    title: t("settings.fadeColor.title"),
    detail: t("settings.fadeColor.detail"),
    options: CAMPAIGN_FADE_COLOR_VALUES.map((value) => ({ value, label: t(CAMPAIGN_FADE_COLOR_KEYS[value]) })),
    selected: settings.campaignFadeColor,
  };
}

/** `settings` with the fade color set; a value that is not one of the five changes nothing. */
export function nextSettingsAfterFadeColor(settings: Settings, value: CampaignFadeColor): Settings {
  return CAMPAIGN_FADE_COLOR_VALUES.includes(value) ? { ...settings, campaignFadeColor: value } : settings;
}

export interface TokenMotionRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: FirstPlayerTokenMotion; readonly label: string }[];
  readonly selected: FirstPlayerTokenMotion;
}

export function tokenMotionRowInfoOf(settings: Settings): TokenMotionRowInfo {
  return {
    title: t("settings.tokenMotion.title"),
    detail: settings.reducedMotion ? t("settings.tokenMotion.detailReduced") : t("settings.tokenMotion.detail"),
    options: FIRST_PLAYER_TOKEN_MOTION_VALUES.map((value) => ({
      value,
      label: t(FIRST_PLAYER_TOKEN_MOTION_KEYS[value]),
    })),
    selected: settings.firstPlayerTokenMotion,
  };
}

/** `settings` with the token's motion set; a value that is not one of the seven changes nothing. */
export function nextSettingsAfterTokenMotion(settings: Settings, value: FirstPlayerTokenMotion): Settings {
  return FIRST_PLAYER_TOKEN_MOTION_VALUES.includes(value) ? { ...settings, firstPlayerTokenMotion: value } : settings;
}

// ---------------------------------------------------------------------------
// "Achievement popup": how long the "Achievement unlocked" popup stays up and where it shows
// (`scenes/achievement-toast.ts`). Two segmented rows under More, beside Unlocks and the earned items.
// ---------------------------------------------------------------------------

export interface AchievementPopupRowInfo<V extends string> {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: V; readonly label: string }[];
  readonly selected: V;
}

const achievementPopupTimeLabels = (): Readonly<Record<AchievementPopupTime, string>> => ({
  off: t("settings.optionOff"),
  "3s": "3 s",
  "5s": "5 s",
  "8s": "8 s",
  "10s": "10 s",
});

const achievementPopupPlaceLabels = (): Readonly<Record<AchievementPopupPlace, string>> => ({
  titleBar: t("settings.popupPlace.titleBar"),
  top: t("settings.top"),
  middle: t("settings.popupPlace.middle"),
  bottom: t("settings.bottom"),
});

const achievementPopupSizeLabels = (): Readonly<Record<AchievementPopupSize, string>> => ({
  small: t("settings.popupSize.small"),
  medium: t("settings.popupSize.medium"),
  large: t("settings.large"),
});

export function achievementPopupSizeRowInfoOf(settings: Settings): AchievementPopupRowInfo<AchievementPopupSize> {
  return {
    title: t("settings.popupSize.title"),
    detail: t("settings.popupSize.detail"),
    options: ACHIEVEMENT_POPUP_SIZE_VALUES.map((value) => ({ value, label: achievementPopupSizeLabels()[value] })),
    selected: settings.achievementPopupSize,
  };
}

/** `settings` with the popup's size set; a value that is not one of the three changes nothing. */
export function nextSettingsAfterAchievementPopupSize(settings: Settings, value: AchievementPopupSize): Settings {
  return ACHIEVEMENT_POPUP_SIZE_VALUES.includes(value) ? { ...settings, achievementPopupSize: value } : settings;
}

export function achievementPopupTimeRowInfoOf(settings: Settings): AchievementPopupRowInfo<AchievementPopupTime> {
  return {
    title: t("settings.popupTime.title"),
    detail:
      settings.achievementPopupTime === "off" ? t("settings.popupTime.detailOff") : t("settings.popupTime.detail"),
    options: ACHIEVEMENT_POPUP_TIME_VALUES.map((value) => ({ value, label: achievementPopupTimeLabels()[value] })),
    selected: settings.achievementPopupTime,
  };
}

export function achievementPopupPlaceRowInfoOf(settings: Settings): AchievementPopupRowInfo<AchievementPopupPlace> {
  return {
    title: t("settings.popupPlace.title"),
    detail: t("settings.popupPlace.detail"),
    options: ACHIEVEMENT_POPUP_PLACE_VALUES.map((value) => ({ value, label: achievementPopupPlaceLabels()[value] })),
    selected: settings.achievementPopupPlace,
  };
}

/** The Hero art row: Game art, Card art, and Promo art once a promo is on offer (`view/hero-art-choice.ts`). */
export function heroArtRowInfoOf(settings: Settings, promoShown: boolean): AchievementPopupRowInfo<HeroArt> {
  return {
    title: t("settings.heroArt.title"),
    detail: t("settings.heroArt.detail"),
    options: heroArtChoicesOf(promoShown).map((value) => ({ value, label: t(HERO_ART_KEYS[value]) })),
    selected: heroArtInForce(settings.heroArt, promoShown),
  };
}

/** `settings` with the hero art set; a value that is not one of the three changes nothing. */
export function nextSettingsAfterHeroArt(settings: Settings, value: HeroArt): Settings {
  return HERO_ART_VALUES.includes(value) ? { ...settings, heroArt: value } : settings;
}

/** `settings` with the popup's time set; a value that is not one of the seven changes nothing. */
export function nextSettingsAfterAchievementPopupTime(settings: Settings, value: AchievementPopupTime): Settings {
  return ACHIEVEMENT_POPUP_TIME_VALUES.includes(value) ? { ...settings, achievementPopupTime: value } : settings;
}

/** `settings` with the popup's position set; a value that is not one of the four changes nothing. */
export function nextSettingsAfterAchievementPopupPlace(settings: Settings, value: AchievementPopupPlace): Settings {
  return ACHIEVEMENT_POPUP_PLACE_VALUES.includes(value) ? { ...settings, achievementPopupPlace: value } : settings;
}

// ---------------------------------------------------------------------------
// "Window mode" and "Resolution": the desktop app's window (`platform/desktop-window.ts`). Desktop (Tauri) only; the
// Settings screen leaves both rows out on the web and the phone apps.
// ---------------------------------------------------------------------------

const displayModeLabels = (): Readonly<Record<DisplayMode, string>> => ({
  windowed: t("settings.displayMode.windowed"),
  borderless: t("settings.displayMode.borderless"),
  fullscreen: t("settings.displayMode.fullscreen"),
});

export interface DisplayModeRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: DisplayMode; readonly label: string }[];
  readonly selected: DisplayMode;
}

export function displayModeRowInfoOf(settings: Settings): DisplayModeRowInfo {
  return {
    title: t("settings.displayMode.title"),
    detail: t("settings.displayMode.detail"),
    options: DISPLAY_MODE_VALUES.map((value) => ({ value, label: displayModeLabels()[value] })),
    selected: settings.displayMode,
  };
}

/** `settings` with the window mode set; a value that is not one of the three changes nothing. */
export function nextSettingsAfterDisplayMode(settings: Settings, value: DisplayMode): Settings {
  return DISPLAY_MODE_VALUES.includes(value) ? { ...settings, displayMode: value } : settings;
}

// "Couch mode": everything drawn bigger for a TV (`ui/render-resolution.ts`). Every build but a phone.
// `base` is the size the game is drawn from (`couchBaseSize`): only the choices it can use whole are offered.
export function couchModeRowInfoOf(
  settings: Settings,
  base: CouchSize = { width: Infinity, height: Infinity },
): ScreenChoiceRowInfo<CouchMode> {
  return {
    title: t("settings.couchMode.title"),
    detail: t("settings.couchMode.detail"),
    options: COUCH_MODE_VALUES.filter(
      (value) => value === "off" || value === settings.couchMode || couchFactorFits(couchModeFactor(value), base),
    ).map((value) => ({ value, label: value === "off" ? t("settings.optionOff") : value })),
    selected: settings.couchMode,
  };
}

/** `settings` with couch mode set; a value that is not one of the seven changes nothing. */
export function nextSettingsAfterCouchMode(settings: Settings, value: CouchMode): Settings {
  return COUCH_MODE_VALUES.includes(value) ? { ...settings, couchMode: value } : settings;
}

// ---------------------------------------------------------------------------
// Shown on every build; the desktop app also has its Window section, whose Resolution is the window's own size.
// The desktop app has its Window section instead; the web and iOS show neither.
// ---------------------------------------------------------------------------

export interface ScreenChoiceRowInfo<V extends string> {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: V; readonly label: string }[];
  readonly selected: V;
}

/** The screen in CSS pixels and its density, as the row needs to name the sizes. */
export interface ScreenSize {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
}

/**
 * Native, then each lighter multiplier this screen is denser than, named by its short side the way games name
 * resolutions ("720p"). A 2x phone has no "2x": that is its native.
 */
/**
 * What the hardware check recommends for this phone (`platform/device-tier.ts`), and what it went on: "mid-range" and
 * "6 GB, Adreno 642L".
 */
export interface ScreenAdvice {
  readonly renderScale: RenderScale;
  readonly frameRate: FrameRate;
  readonly tier: string;
  readonly summary: string;
}

/** " Recommended for this device (mid-range: 6 GB, Adreno 642L): 720p." */
function adviceSentence(advice: ScreenAdvice, choice: string, withReason: boolean): string {
  const reason = withReason ? ` (${advice.tier}${advice.summary ? `: ${advice.summary}` : ""})` : "";
  return ` ${t("settings.advice", { reason, choice })}`;
}

export function renderScaleRowInfoOf(
  settings: Settings,
  screen: ScreenSize,
  advice?: ScreenAdvice,
): ScreenChoiceRowInfo<RenderScale> {
  const native = renderScaleFactorOf("native", screen.devicePixelRatio);
  const short = Math.min(screen.width, screen.height);
  const offered = RENDER_SCALE_VALUES.filter(
    (value) => value === "native" || renderScaleFactorOf(value, screen.devicePixelRatio) < native,
  );
  const selected = offered.includes(settings.renderScale) ? settings.renderScale : "native";
  const factor = renderScaleFactorOf(selected, screen.devicePixelRatio);
  const size = `${Math.round(screen.width * factor)} × ${Math.round(screen.height * factor)}`;
  const options = offered.map((value) => ({
    value,
    label:
      value === "native"
        ? t("settings.native")
        : `${Math.round(short * renderScaleFactorOf(value, screen.devicePixelRatio))}p`,
  }));
  const recommended = advice && (options.find((o) => o.value === advice.renderScale) ?? options[0]!);
  const detail =
    selected === "native"
      ? t("settings.renderScale.detailNative", { size })
      : t("settings.renderScale.detailScaled", { size });
  return {
    title: t("settings.renderScale.title"),
    detail: advice && recommended ? detail + adviceSentence(advice, recommended.label, true) : detail,
    options,
    selected,
  };
}

/** `settings` with the render scale set; a value that is not one of the four changes nothing. */
/** Whether Settings draws the Render scale row (and so whether a search can find it): a 1x screen has nothing below
 * Native to offer, so the row is left out there. */
export function renderScaleRowShown(info: { readonly options: readonly unknown[] }): boolean {
  return info.options.length > 1;
}

export function nextSettingsAfterRenderScale(settings: Settings, value: RenderScale): Settings {
  return RENDER_SCALE_VALUES.includes(value) ? { ...settings, renderScale: value } : settings;
}

const frameRateLabels = (): Readonly<Record<FrameRate, string>> => ({
  screen: t("settings.frameRate.screen"),
  "60": "60 fps",
  "30": "30 fps",
});

/**
 * Match screen, 60 and 30. `maxRefreshRate` is the screen's fastest mode as the app reports it (null until read): a
 * 60 Hz screen gets no separate 60 fps choice. `powerSaving`: the device is in power saving mode, which caps it at 30.
 */
export function frameRateRowInfoOf(
  settings: Settings,
  maxRefreshRate: number | null,
  powerSaving = false,
  advice?: ScreenAdvice,
): ScreenChoiceRowInfo<FrameRate> {
  const offered = FRAME_RATE_VALUES.filter((value) => value !== "60" || maxRefreshRate === null || maxRefreshRate > 61);
  const selected = offered.includes(settings.frameRate) ? settings.frameRate : "screen";
  const rate = maxRefreshRate === null ? "" : ` (${maxRefreshRate} Hz)`;
  const detail =
    selected === "screen"
      ? t("settings.frameRate.detailScreen", { rate })
      : t("settings.frameRate.detailCapped", { fps: selected });
  const recommended = advice && (offered.includes(advice.frameRate) ? advice.frameRate : "screen");
  const advised = recommended ? detail + adviceSentence(advice!, frameRateLabels()[recommended], false) : detail;
  return {
    title: t("settings.frameRate.title"),
    detail: powerSaving ? `${advised} ${powerSavingRowNote()}` : advised,
    options: offered.map((value) => ({ value, label: frameRateLabels()[value] })),
    selected,
  };
}

/** `settings` with the frame rate set; a value that is not one of the three changes nothing. */
export function nextSettingsAfterFrameRate(settings: Settings, value: FrameRate): Settings {
  return FRAME_RATE_VALUES.includes(value) ? { ...settings, frameRate: value } : settings;
}

export interface ResolutionRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: Resolution; readonly label: string }[];
  readonly selected: Resolution;
}

/** "1920x1080" as "1920 × 1080"; Native as "Native", or "Native · 3440 × 1440" once the monitor's size is known. */
export function resolutionLabelOf(
  size: Resolution,
  native: { readonly width: number; readonly height: number } | null = null,
): string {
  const px = resolutionPixelsOf(size);
  if (px !== null) return `${px.width} × ${px.height}`;
  return native === null
    ? t("settings.native")
    : t("settings.nativeSize", { width: native.width, height: native.height });
}

/**
 * `offered` is the resolutions the current monitor offers in this mode (`resolutionOptionsFor`), listed with Native largest first;
 * `native` is the monitor's own resolution. A saved resolution this monitor doesn't offer shows as Native, which is what
 * the game then draws at.
 */
export function resolutionRowInfoOf(
  settings: Settings,
  offered: readonly Resolution[],
  native: { readonly width: number; readonly height: number } | null = null,
  /** Fullscreen here really switches the monitor's display mode (Windows). */
  switchesDisplayMode = false,
): ResolutionRowInfo {
  // Largest first, Native among them at its own size (the owner, 2026-10-16); first when the size isn't known yet.
  const sizeOf = (value: Resolution): { readonly width: number; readonly height: number } | null =>
    value === "native" ? native : resolutionPixelsOf(value);
  const area = (value: Resolution): number => {
    const px = sizeOf(value);
    return px === null ? Number.POSITIVE_INFINITY : px.width * px.height;
  };
  const values: readonly Resolution[] = (["native", ...offered] as Resolution[]).sort(
    (a, b) => area(b) - area(a) || (sizeOf(b)?.width ?? 0) - (sizeOf(a)?.width ?? 0),
  );
  return {
    title: t("settings.resolution.title"),
    detail:
      settings.displayMode === "fullscreen" && switchesDisplayMode
        ? t("settings.resolution.detailFullscreen")
        : settings.displayMode === "windowed"
          ? t("settings.resolution.detailWindowed")
          : t("settings.resolution.detailScaled"),
    options: values.map((value) => ({ value, label: resolutionLabelOf(value, native) })),
    selected: values.includes(settings.resolution) ? settings.resolution : "native",
  };
}

/** `settings` with the resolution set; a malformed one changes nothing. */
export function nextSettingsAfterResolution(settings: Settings, value: Resolution): Settings {
  return value === "native" || resolutionPixelsOf(value) !== null ? { ...settings, resolution: value } : settings;
}
