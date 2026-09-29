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
import { SHARP_TEXT_RESOLUTION_CEILING, type Settings } from "../settings.js";

export type SettingsRowId = "reduced-motion" | "sharper-text" | "large-card-text" | "sound" | "confirm-end-turn";

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
