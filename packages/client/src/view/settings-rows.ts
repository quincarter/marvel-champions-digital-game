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
  CARD_HOVER_SCALE_VALUES,
  CARD_SIZE_VALUES,
  SHARP_TEXT_RESOLUTION_CEILING,
  type CardHoverScale,
  type CardSize,
  type Settings,
  type VillainAutoAdvance,
  type VillainBeatSpeed,
} from "../settings.js";

export type SettingsRowId =
  | "reduced-motion"
  | "sharper-text"
  | "large-card-text"
  | "sound"
  | "confirm-end-turn"
  | "same-name-conflict";

export interface SettingsRowInfo {
  readonly id: SettingsRowId;
  readonly title: string;
  readonly detail: string;
  readonly on: boolean;
  /** Present only for a row this build can't act on yet — drawn dim with this as its reason, never omitted. */
  readonly unavailable?: string;
}

export function settingsRowInfoOf(settings: Settings): readonly SettingsRowInfo[] {
  return [
    {
      id: "reduced-motion",
      title: "Reduced motion",
      detail:
        "Skip travel animation and auto-advancing reveals; beats and state changes still appear, just without the motion.",
      on: settings.reducedMotion,
    },
    {
      id: "sharper-text",
      title: "Sharper text",
      detail: "Renders text at the screen's own pixel density. Off trades a little crispness for less texture memory.",
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
  ];
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
    case "confirm-end-turn":
      return { ...settings, confirmBeforeEndTurn: !settings.confirmBeforeEndTurn };
    case "same-name-conflict":
      return { ...settings, sameNameHeroAllyConflict: !settings.sameNameHeroAllyConflict };
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

export type VillainRowId = "villain-auto" | "villain-hold" | "villain-speed" | "villain-dock";

export interface VillainRowsInfo {
  readonly autoAdvance: {
    readonly title: string;
    readonly detail: string;
    readonly options: readonly VillainOption<VillainAutoAdvance>[];
    readonly selected: VillainAutoAdvance;
  };
  readonly hold: { readonly title: string; readonly detail: string; readonly on: boolean };
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
  value?: VillainAutoAdvance | VillainBeatSpeed,
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
    case "villain-hold":
      return { ...settings, holdEncounterCards: !settings.holdEncounterCards };
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
