/**
 * The client-preference toggle rows shown on the standalone Settings screen
 * (`scenes/settings.ts`) and inline in Pause's "Table" group (`scenes/pause.ts`,
 * design canvases D13/P16/L07) — one shared, tested list of titles/details/on-state
 * so the wording can't drift between the two places it's drawn. Pure data: a scene
 * still owns the actual toggle (it needs `appSession()`, which view modules never
 * import), keyed by `SettingsRowInfo.id`.
 */
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
  RENDER_SCALE_VALUES,
  SHARP_TEXT_RESOLUTION_CEILING,
  clampMusicVolume,
  renderScaleFactorOf,
  resolutionPixelsOf,
  type FrameRate,
  type RenderScale,
  type AchievementPopupPlace,
  type AchievementPopupSize,
  type AchievementPopupTime,
  type CardHoverScale,
  type CardSize,
  type DisplayMode,
  type FirstPlayerTokenMotion,
  type Settings,
  type VillainAutoAdvance,
  type VillainBeatSpeed,
  type FlipEncounterSpeed,
  type Resolution,
} from "../settings.js";
import { FIRST_PLAYER_TOKEN_MOTION_LABELS } from "./first-player-token-motion.js";
import { POWER_SAVING_ROW_NOTE } from "./power-saving-notice.js";
import { EARNED_ITEMS, type EarnedItemId } from "../progression/earned-items.js";

export type SettingsRowId =
  | "reduced-motion"
  | "sharper-text"
  | "large-card-text"
  | "sound"
  | "music-shuffle"
  | "confirm-end-turn"
  | "same-name-conflict"
  | "hover-hero"
  | "hover-villain"
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
  const followsPowerSaving = (detail: string): string => (powerSaving ? `${detail} ${POWER_SAVING_ROW_NOTE}` : detail);
  return [
    {
      id: "reduced-motion",
      title: "Reduced motion",
      detail: followsPowerSaving(
        "Skip travel animation and auto-advancing reveals; beats and state changes still appear, just without the motion.",
      ),
      on: settings.reducedMotion,
    },
    {
      id: "sharper-text",
      title: "Sharper text",
      detail: followsPowerSaving(
        "Renders text at the screen's own pixel density. Off trades a little crispness for less texture memory.",
      ),
      on: settings.textResolution > 1,
    },
    {
      id: "large-card-text",
      title: "Large card text",
      detail:
        "Reads a card's full rules text larger in the Inspect sheet — the screen whose whole job is reading a card closely.",
      on: settings.largeCardText,
    },
    {
      id: "sound",
      title: "Sound",
      detail: "Background music and audio across menus and games.",
      on: settings.sound,
    },
    {
      id: "music-shuffle",
      title: "Shuffle earned music",
      detail:
        "Plays the songs you've earned in Extras, shuffled, in menus and games. Openers, Game over and finales keep their own.",
      on: settings.musicShuffle,
    },
    {
      id: "confirm-end-turn",
      title: "Confirm before ending turn",
      detail:
        "Ask before End turn whenever a basic attack, thwart or recover is still open, for you or an ally. Off ends the turn straight away.",
      on: settings.confirmBeforeEndTurn,
    },
    {
      id: "same-name-conflict",
      title: "Same-name hero and ally",
      detail:
        "A hero and an ally with the same name can't both be in play. Applies to new games; the ally can still be spent as a resource.",
      on: settings.sameNameHeroAllyConflict,
    },
    {
      id: "hover-hero",
      title: "Hero card popover",
      detail: "With a mouse, resting on a hero card shows the larger popover. Off leaves hero cards as they are.",
      on: settings.hoverHeroCard,
    },
    {
      id: "hover-villain",
      title: "Villain card popover",
      detail: "With a mouse, resting on a villain card shows the larger popover. Off leaves villain cards as they are.",
      on: settings.hoverVillainCard,
    },
  ];
}

/**
 * Settings ▸ More ▸ Earned items (issue #291): one toggle per earned item. One not earned yet is still listed, dim, and
 * says how to earn it instead of what it does.
 */
export function earnedItemRowInfoOf(settings: Settings, earned: ReadonlySet<EarnedItemId>): readonly SettingsRowInfo[] {
  return EARNED_ITEMS.map((item) => ({
    id: item.id,
    title: item.title,
    detail: item.detail,
    on: earned.has(item.id) && settings[item.setting],
    ...(earned.has(item.id) ? {} : { unavailable: item.howToEarn }),
  }));
}

/** The value "Sharper text" should switch *to* when it's off, given the screen's own device pixel ratio. What "off" restores is always `1`. */
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
    case "sound":
      return { ...settings, sound: !settings.sound };
    case "music-shuffle":
      return { ...settings, musicShuffle: !settings.musicShuffle };
    case "confirm-end-turn":
      return { ...settings, confirmBeforeEndTurn: !settings.confirmBeforeEndTurn };
    case "same-name-conflict":
      return { ...settings, sameNameHeroAllyConflict: !settings.sameNameHeroAllyConflict };
    case "hover-hero":
      return { ...settings, hoverHeroCard: !settings.hoverHeroCard };
    case "hover-villain":
      return { ...settings, hoverVillainCard: !settings.hoverVillainCard };
    case "ultron-drone-art":
      return { ...settings, ultronDroneArt: !settings.ultronDroneArt };
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
export const GUIDE_LEVEL_OPTIONS: readonly GuideLevelOption[] = [
  { value: "full", label: "Full", detail: "Every step explained" },
  { value: "hints", label: "Hints", detail: "Only before mistakes" },
  { value: "off", label: "Off", detail: "Glossary stays on" },
];

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

const WARNING_ROW_COPY: Record<SilencedWarningKey, { readonly title: string; readonly detail: string }> = {
  schemeFinish: {
    title: "Scheme warning",
    detail: "Catches ending your turn when the main scheme would finish next villain phase.",
  },
  lethal: {
    title: "Lethal hit warning",
    detail: "Catches ending your turn in hero form with no ready defender against a lethal-looking attack.",
  },
  schemeClose: {
    title: "Close-call warning",
    detail: "Catches ending your turn with the main scheme one or two threat from finishing.",
  },
  flipDanger: {
    title: "Flip warning",
    detail: "Catches flipping to (or staying in) alter-ego when the scheme would complete from it.",
  },
  wastedPay: {
    title: "Overpay warning",
    detail: "Catches a payment that spends more than a card costs, or skips a cheaper card that would cover it.",
  },
};

/** The Guide group's own rows, in draw order, from the live `GuidePrefs`. */
export function guideRowInfoOf(prefs: GuidePrefs): readonly GuideRowInfo[] {
  return [
    { kind: "segmented", id: "guide-level", title: "Guide level", options: GUIDE_LEVEL_OPTIONS, selected: prefs.level },
    {
      kind: "action",
      id: "play-tutorial",
      title: prefs.tutorial.finished ? "Replay the tutorial" : "Play the tutorial",
      detail: "A short scripted first game against Rhino with Spider-Man — five lessons long.",
    },
    {
      kind: "action",
      id: "aspect-lessons",
      title: "Aspect lessons",
      detail: "What each aspect is for, when to pick it, and a couple of signature cards.",
    },
    ...SILENCED_WARNING_KEYS.map((key): GuideToggleRowInfo => ({
      kind: "toggle",
      id: key,
      title: WARNING_ROW_COPY[key].title,
      detail: WARNING_ROW_COPY[key].detail,
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

export const VILLAIN_AUTO_ADVANCE_OPTIONS: readonly VillainOption<VillainAutoAdvance>[] = [
  { value: "off", label: "Off", detail: "Recap waits for Start player phase" },
  { value: "afterPause", label: "After a pause", detail: "Recap closes itself after 6 seconds" },
  { value: "on", label: "On", detail: "Straight to your turn, no recap" },
];

export const VILLAIN_BEAT_SPEED_OPTIONS: readonly VillainOption<VillainBeatSpeed>[] = [
  { value: "slow", label: "Slow", detail: "Longest on screen" },
  { value: "normal", label: "Normal", detail: "" },
  { value: "fast", label: "Fast", detail: "Shortest on screen" },
];

export const FLIP_ENCOUNTER_SPEED_OPTIONS: readonly VillainOption<FlipEncounterSpeed>[] = [
  { value: "slow", label: "Slow", detail: "1 second" },
  { value: "normal", label: "Normal", detail: "" },
  { value: "off", label: "Off", detail: "Turns over at once" },
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
      title: "Auto-advance",
      detail: "What happens once the villain phase has nothing left for you to answer.",
      options: VILLAIN_AUTO_ADVANCE_OPTIONS,
      selected: settings.villainAutoAdvance,
    },
    hold: {
      title: "Hold each encounter card",
      detail: "Keep every revealed card on screen until you tap past it, even when you have no answer to it.",
      on: settings.holdEncounterCards,
    },
    flip: {
      title: "Flip each encounter card",
      detail: "Stop on each facedown encounter card until you press Flip Encounter Card.",
      on: settings.flipEncounterCards,
    },
    flipSpeed: {
      title: "Flip animation",
      detail: "How long a facedown encounter card takes to turn over. Off turns it at once; you still press Flip.",
      options: FLIP_ENCOUNTER_SPEED_OPTIONS,
      selected: settings.flipEncounterSpeed,
    },
    beatSpeed: {
      title: "Beat speed",
      detail: "How long each step stays up while the phase runs on its own.",
      options: VILLAIN_BEAT_SPEED_OPTIONS,
      selected: settings.villainBeatSpeed,
    },
    dock: {
      title: "Show the table beside it",
      detail: "Desktop and tablet dock the villain phase on the right. Off draws it full screen, as now.",
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
      return VILLAIN_AUTO_ADVANCE_OPTIONS.some((o) => o.value === value)
        ? { ...settings, villainAutoAdvance: value as VillainAutoAdvance }
        : settings;
    case "villain-speed":
      return VILLAIN_BEAT_SPEED_OPTIONS.some((o) => o.value === value)
        ? { ...settings, villainBeatSpeed: value as VillainBeatSpeed }
        : settings;
    case "villain-flip-speed":
      return FLIP_ENCOUNTER_SPEED_OPTIONS.some((o) => o.value === value)
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

export const CARD_HOVER_SCALE_LABELS: Readonly<Record<CardHoverScale, string>> = {
  off: "Off",
  "1.5x": "1.5×",
  "2x": "2×",
  "2.5x": "2.5×",
  "3x": "3×",
  "4x": "4×",
};

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
    options: VOLUME_STEPS.map((value) => ({ value, label: value === "0" ? "Off" : `${value}%` })),
    selected,
  };
}

/** The game's volume in the Windows mixer, as last read (`platform/app-volume.ts`). */
export function gameVolumeRowInfoOf(mixerPercent: number): VolumeRowInfo {
  return volumeRowInfo(
    "Game volume",
    "The game's own volume in the Windows volume mixer, music and effects together. The music player's slider sets it finer.",
    mixerPercent,
  );
}

export function musicVolumeRowInfoOf(settings: Settings, mixer: boolean): VolumeRowInfo {
  return volumeRowInfo(
    "Music volume",
    mixer
      ? "How loud the music plays within the game, against the effects."
      : "How loud the music plays, against the effects. On desktop the music player's slider sets it finer.",
    settings.musicVolume,
  );
}

export function effectsVolumeRowInfoOf(settings: Settings): VolumeRowInfo {
  return volumeRowInfo(
    "Effects volume",
    "How loud the sound effects play (attacks, thwarts, cards played), against the music.",
    settings.effectsVolume,
  );
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
    title: "Card size on hover",
    detail:
      "With a mouse, rest on a card on the table to see it larger beside the pointer, with its state. Off turns the popover off.",
    options: CARD_HOVER_SCALE_VALUES.map((value) => ({ value, label: CARD_HOVER_SCALE_LABELS[value] })),
    selected: settings.cardHoverScale,
  };
}

/** `settings` with the hover size set; a value that is not one of the five changes nothing. */
export function nextSettingsAfterCardHover(settings: Settings, value: CardHoverScale): Settings {
  return CARD_HOVER_SCALE_VALUES.includes(value) ? { ...settings, cardHoverScale: value } : settings;
}

// ---------------------------------------------------------------------------
// "Card size": how large every card is drawn on the Decks, deck builder, Rules and campaign card grids. A global
// setting, shown on every form factor.
// ---------------------------------------------------------------------------

export const CARD_SIZE_LABELS: Readonly<Record<CardSize, string>> = {
  standard: "Fit to screen",
  same: "Same size",
  large: "Large",
  xlarge: "Extra large",
};

export interface CardSizeRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: CardSize; readonly label: string }[];
  readonly selected: CardSize;
}

export function cardSizeRowInfoOf(settings: Settings): CardSizeRowInfo {
  return {
    title: "Card size",
    detail:
      "Fit to screen sizes every card to the screen it is on. Same size draws a card the size a desktop does on every device. Large and Extra large draw them bigger still. Larger cards scroll (the table, the villain phase, decks and card lists).",
    options: CARD_SIZE_VALUES.map((value) => ({ value, label: CARD_SIZE_LABELS[value] })),
    selected: settings.cardSize,
  };
}

/** `settings` with the card size set; a value that is not one of the three changes nothing. */
export function nextSettingsAfterCardSize(settings: Settings, value: CardSize): Settings {
  return CARD_SIZE_VALUES.includes(value) ? { ...settings, cardSize: value } : settings;
}

// ---------------------------------------------------------------------------
// "First player token": how the token travels to a new first player (`view/first-player-token-motion.ts`). A
// five-segment choice after Card size, shown on every form factor.
// ---------------------------------------------------------------------------

export interface TokenMotionRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: FirstPlayerTokenMotion; readonly label: string }[];
  readonly selected: FirstPlayerTokenMotion;
}

export function tokenMotionRowInfoOf(settings: Settings): TokenMotionRowInfo {
  return {
    title: "First player token",
    detail: settings.reducedMotion
      ? "How the token moves to a new first player. Reduced motion is on, so it is placed without moving."
      : "How the token moves to a new first player: tossed, slid, bounced or spun across the table, or placed at once.",
    options: FIRST_PLAYER_TOKEN_MOTION_VALUES.map((value) => ({
      value,
      label: FIRST_PLAYER_TOKEN_MOTION_LABELS[value],
    })),
    selected: settings.firstPlayerTokenMotion,
  };
}

/** `settings` with the token's motion set; a value that is not one of the five changes nothing. */
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

const ACHIEVEMENT_POPUP_TIME_LABELS: Readonly<Record<AchievementPopupTime, string>> = {
  off: "Off",
  "3s": "3 s",
  "5s": "5 s",
  "8s": "8 s",
  "10s": "10 s",
};

const ACHIEVEMENT_POPUP_PLACE_LABELS: Readonly<Record<AchievementPopupPlace, string>> = {
  titleBar: "Title bar",
  top: "Top",
  middle: "Middle",
  bottom: "Bottom",
};

const ACHIEVEMENT_POPUP_SIZE_LABELS: Readonly<Record<AchievementPopupSize, string>> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export function achievementPopupSizeRowInfoOf(settings: Settings): AchievementPopupRowInfo<AchievementPopupSize> {
  return {
    title: "Popup size",
    detail: "How large the achievement popup is drawn. Picking one shows a sample.",
    options: ACHIEVEMENT_POPUP_SIZE_VALUES.map((value) => ({ value, label: ACHIEVEMENT_POPUP_SIZE_LABELS[value] })),
    selected: settings.achievementPopupSize,
  };
}

/** `settings` with the popup's size set; a value that is not one of the three changes nothing. */
export function nextSettingsAfterAchievementPopupSize(settings: Settings, value: AchievementPopupSize): Settings {
  return ACHIEVEMENT_POPUP_SIZE_VALUES.includes(value) ? { ...settings, achievementPopupSize: value } : settings;
}

export function achievementPopupTimeRowInfoOf(settings: Settings): AchievementPopupRowInfo<AchievementPopupTime> {
  return {
    title: "Achievement popup",
    detail:
      settings.achievementPopupTime === "off"
        ? "Off: a new achievement shows only in the Trophy Room, with no popup or sound."
        : "How long the popup stays up when you earn an achievement, with its sound.",
    options: ACHIEVEMENT_POPUP_TIME_VALUES.map((value) => ({ value, label: ACHIEVEMENT_POPUP_TIME_LABELS[value] })),
    selected: settings.achievementPopupTime,
  };
}

export function achievementPopupPlaceRowInfoOf(settings: Settings): AchievementPopupRowInfo<AchievementPopupPlace> {
  return {
    title: "Popup position",
    detail: "Where on the screen the achievement popup shows. Picking one shows a sample there.",
    options: ACHIEVEMENT_POPUP_PLACE_VALUES.map((value) => ({ value, label: ACHIEVEMENT_POPUP_PLACE_LABELS[value] })),
    selected: settings.achievementPopupPlace,
  };
}

/** `settings` with the popup's time set; a value that is not one of the five changes nothing. */
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

const DISPLAY_MODE_LABELS: Readonly<Record<DisplayMode, string>> = {
  windowed: "Windowed",
  borderless: "Borderless",
  fullscreen: "Fullscreen",
};

export interface DisplayModeRowInfo {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: DisplayMode; readonly label: string }[];
  readonly selected: DisplayMode;
}

export function displayModeRowInfoOf(settings: Settings): DisplayModeRowInfo {
  return {
    title: "Window mode",
    detail:
      "Windowed is a normal window. Borderless fills the screen with a window you can switch away from at once. Fullscreen is your computer's own full screen.",
    options: DISPLAY_MODE_VALUES.map((value) => ({ value, label: DISPLAY_MODE_LABELS[value] })),
    selected: settings.displayMode,
  };
}

/** `settings` with the window mode set; a value that is not one of the three changes nothing. */
export function nextSettingsAfterDisplayMode(settings: Settings, value: DisplayMode): Settings {
  return DISPLAY_MODE_VALUES.includes(value) ? { ...settings, displayMode: value } : settings;
}

// ---------------------------------------------------------------------------
// "Resolution" and "Frame rate" under Display > Screen: the Android app's own screen (`platform/screen-settings.ts`).
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

/** " Recommended for this phone (mid-range: 6 GB, Adreno 642L): 720p." */
function adviceSentence(advice: ScreenAdvice, choice: string, withReason: boolean): string {
  const reason = withReason ? ` (${advice.tier}${advice.summary ? `: ${advice.summary}` : ""})` : "";
  return ` Recommended for this phone${reason}: ${choice}.`;
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
      value === "native" ? "Native" : `${Math.round(short * renderScaleFactorOf(value, screen.devicePixelRatio))}p`,
  }));
  const recommended = advice && (options.find((o) => o.value === advice.renderScale) ?? options[0]!);
  const detail =
    selected === "native"
      ? `Draws at ${size}, the screen's own. Lower is lighter on the GPU, memory and battery.`
      : `Draws at ${size} and scales it up to the screen. Native is sharpest.`;
  return {
    title: "Resolution",
    detail: advice && recommended ? detail + adviceSentence(advice, recommended.label, true) : detail,
    options,
    selected,
  };
}

/** `settings` with the render scale set; a value that is not one of the four changes nothing. */
export function nextSettingsAfterRenderScale(settings: Settings, value: RenderScale): Settings {
  return RENDER_SCALE_VALUES.includes(value) ? { ...settings, renderScale: value } : settings;
}

const FRAME_RATE_LABELS: Readonly<Record<FrameRate, string>> = { screen: "Screen", "60": "60 fps", "30": "30 fps" };

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
      ? `Runs at the screen's own refresh rate${rate}. A cap saves battery; 30 fps saves the most.`
      : `Holds the game to ${selected} fps and asks the screen to slow down to match, to save battery.`;
  const recommended = advice && (offered.includes(advice.frameRate) ? advice.frameRate : "screen");
  const advised = recommended ? detail + adviceSentence(advice!, FRAME_RATE_LABELS[recommended], false) : detail;
  return {
    title: "Frame rate",
    detail: powerSaving ? `${advised} ${POWER_SAVING_ROW_NOTE}` : advised,
    options: offered.map((value) => ({ value, label: FRAME_RATE_LABELS[value] })),
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
  return native === null ? "Native" : `Native · ${native.width} × ${native.height}`;
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
    title: "Resolution",
    detail:
      settings.displayMode === "fullscreen" && switchesDisplayMode
        ? "Fullscreen switches your screen to this resolution. Your own comes back when you leave Fullscreen, switch to another app, or quit."
        : settings.displayMode === "windowed"
          ? "In a window, the window's own size; Native draws at whatever size the window is. Your computer's display resolution is never changed."
          : "Other than native, the game draws at that resolution and is scaled to fit the screen, with black bars where the shapes differ. Your computer's display resolution is never changed.",
    options: values.map((value) => ({ value, label: resolutionLabelOf(value, native) })),
    selected: values.includes(settings.resolution) ? settings.resolution : "native",
  };
}

/** `settings` with the resolution set; a malformed one changes nothing. */
export function nextSettingsAfterResolution(settings: Settings, value: Resolution): Settings {
  return value === "native" || resolutionPixelsOf(value) !== null ? { ...settings, resolution: value } : settings;
}
