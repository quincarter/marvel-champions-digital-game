/**
 * Guided mode preferences: the guide level the player picked, whether they've seen the first-run chooser, tutorial
 * progress, which aspect lessons they've finished, which hint warnings they've silenced, and which one-time tips
 * they've already seen (docs/guided-mode.md §3.8, §5.1, §5.2, §5.4).
 *
 * Kept in `localStorage` (`mc-guide`), the same way `progression/progression.ts` keeps its unlock preferences: a
 * few bytes read once at startup. Where `localStorage` is missing or throws (Vitest, a locked-down webview), the
 * defaults hold for the session. Nothing here reaches the engine, and nothing here is wired into a scene yet
 * (that's G2b) — this module is pure data plus pure helpers.
 */

export const GUIDE_PREFS_VERSION = 1;
const PREFS_KEY = "mc-guide";

/** Full: scripted lessons and hints. Hints: warnings only, no scripted lessons. Off: neither. */
export type GuideLevel = "full" | "hints" | "off";

/** One silence toggle per hint heuristic (docs/guided-mode.md §5.2). */
export type SilencedWarningKey = "schemeFinish" | "lethal" | "flipDanger" | "wastedPay";

export const SILENCED_WARNING_KEYS: readonly SilencedWarningKey[] = [
  "schemeFinish",
  "lethal",
  "flipDanger",
  "wastedPay",
];

export interface TutorialProgress {
  /** Ids of the scripted lessons completed this far (docs/guided-mode.md §5.1's five lessons). */
  readonly lessonsDone: readonly string[];
  readonly finished: boolean;
  readonly skipped: boolean;
}

export interface GuidePrefs {
  readonly level: GuideLevel;
  /** True once the first-run chooser has shown, whatever the player picked. It never shows again unprompted. */
  readonly chooserSeen: boolean;
  readonly tutorial: TutorialProgress;
  /** Aspect ids (§5.4) whose "Try it" lesson game has been completed. */
  readonly aspectLessonsDone: readonly string[];
  readonly silencedWarnings: readonly SilencedWarningKey[];
  /** Ids of one-time opportunistic tips already shown (§5.3). */
  readonly seenTips: readonly string[];
}

const DEFAULT_TUTORIAL_PROGRESS: TutorialProgress = {
  lessonsDone: [],
  finished: false,
  skipped: false,
};

export const defaultGuidePrefs: GuidePrefs = {
  level: "full",
  chooserSeen: false,
  tutorial: DEFAULT_TUTORIAL_PROGRESS,
  aspectLessonsDone: [],
  silencedWarnings: [],
  seenTips: [],
};

function isGuideLevel(value: unknown): value is GuideLevel {
  return value === "full" || value === "hints" || value === "off";
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function parseTutorialProgress(value: unknown): TutorialProgress {
  if (typeof value !== "object" || value === null) return DEFAULT_TUTORIAL_PROGRESS;
  const record = value as Record<string, unknown>;
  return {
    lessonsDone: stringArray(record.lessonsDone),
    finished: typeof record.finished === "boolean" ? record.finished : DEFAULT_TUTORIAL_PROGRESS.finished,
    skipped: typeof record.skipped === "boolean" ? record.skipped : DEFAULT_TUTORIAL_PROGRESS.skipped,
  };
}

function parseSilencedWarnings(value: unknown): readonly SilencedWarningKey[] {
  const strings = stringArray(value);
  return SILENCED_WARNING_KEYS.filter((key) => strings.includes(key));
}

/** Tolerant of anything: a missing key, bad JSON or a wrong field type falls back to that field's default. */
export function parseGuidePrefs(raw: string | null): GuidePrefs {
  if (!raw) return defaultGuidePrefs;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaultGuidePrefs;
  }
  if (typeof data !== "object" || data === null) return defaultGuidePrefs;
  const record = data as Record<string, unknown>;
  return {
    level: isGuideLevel(record.level) ? record.level : defaultGuidePrefs.level,
    chooserSeen: typeof record.chooserSeen === "boolean" ? record.chooserSeen : defaultGuidePrefs.chooserSeen,
    tutorial: parseTutorialProgress(record.tutorial),
    aspectLessonsDone: stringArray(record.aspectLessonsDone),
    silencedWarnings: parseSilencedWarnings(record.silencedWarnings),
    seenTips: stringArray(record.seenTips),
  };
}

/** Reads `mc-guide` from `localStorage`, falling back to `defaultGuidePrefs` when it's missing, throws or is junk. */
export function loadGuidePrefs(): GuidePrefs {
  try {
    return parseGuidePrefs(globalThis.localStorage?.getItem(PREFS_KEY) ?? null);
  } catch {
    return defaultGuidePrefs;
  }
}

/** Writes `prefs` to `localStorage`. Swallows private-mode/quota errors: the choice still holds for this session. */
export function saveGuidePrefs(prefs: GuidePrefs): void {
  try {
    globalThis.localStorage?.setItem(PREFS_KEY, JSON.stringify({ version: GUIDE_PREFS_VERSION, ...prefs }));
  } catch {
    // Private mode or a full quota: the choice still holds for this session.
  }
}

/** True before the first-run chooser has shown (no `mc-guide` record, or one that never marked it seen). */
export function isFirstLaunch(prefs: GuidePrefs): boolean {
  return !prefs.chooserSeen;
}

/**
 * Sets the guide level. Switching from `off` back to `full` resets `seenTips`, so opportunistic tips (§5.3) fire
 * again the way they would for a player turning the guide on for the first time (adapted from the parked
 * prototype's `resetSeenTips`, cf134edf `teaching/teaching-prefs.ts`).
 */
export function withLevel(prefs: GuidePrefs, level: GuideLevel): GuidePrefs {
  const resetTips = prefs.level === "off" && level === "full";
  return { ...prefs, level, chooserSeen: true, seenTips: resetTips ? [] : prefs.seenTips };
}

/** Marks the first-run chooser seen without changing the level (declining the tutorial still records a choice). */
export function markChooserSeen(prefs: GuidePrefs): GuidePrefs {
  return prefs.chooserSeen ? prefs : { ...prefs, chooserSeen: true };
}

/** Adds `lessonId` to the tutorial's completed lessons, if it isn't there already. */
export function markLessonDone(prefs: GuidePrefs, lessonId: string): GuidePrefs {
  if (prefs.tutorial.lessonsDone.includes(lessonId)) return prefs;
  return { ...prefs, tutorial: { ...prefs.tutorial, lessonsDone: [...prefs.tutorial.lessonsDone, lessonId] } };
}

/** Marks the scripted tutorial finished (all five lessons done in order). */
export function markTutorialFinished(prefs: GuidePrefs): GuidePrefs {
  return { ...prefs, tutorial: { ...prefs.tutorial, finished: true } };
}

/** Marks the scripted tutorial skipped (§3.10: "Skip lesson" ends scripted lessons for this game). */
export function markTutorialSkipped(prefs: GuidePrefs): GuidePrefs {
  return { ...prefs, tutorial: { ...prefs.tutorial, skipped: true } };
}

/** Adds `aspectId` to the completed aspect lessons, if it isn't there already. */
export function markAspectLessonDone(prefs: GuidePrefs, aspectId: string): GuidePrefs {
  if (prefs.aspectLessonsDone.includes(aspectId)) return prefs;
  return { ...prefs, aspectLessonsDone: [...prefs.aspectLessonsDone, aspectId] };
}

/** Turns off a hint warning ("Don't warn me about this again"). */
export function silenceWarning(prefs: GuidePrefs, key: SilencedWarningKey): GuidePrefs {
  if (prefs.silencedWarnings.includes(key)) return prefs;
  return { ...prefs, silencedWarnings: [...prefs.silencedWarnings, key] };
}

/** Turns a silenced warning back on (Settings lists the silenced ones, per docs/guided-mode.md §3.5). */
export function unsilenceWarning(prefs: GuidePrefs, key: SilencedWarningKey): GuidePrefs {
  if (!prefs.silencedWarnings.includes(key)) return prefs;
  return { ...prefs, silencedWarnings: prefs.silencedWarnings.filter((k) => k !== key) };
}

/** Adds `tipId` to the seen opportunistic tips, if it isn't there already. */
export function markTipSeen(prefs: GuidePrefs, tipId: string): GuidePrefs {
  if (prefs.seenTips.includes(tipId)) return prefs;
  return { ...prefs, seenTips: [...prefs.seenTips, tipId] };
}
