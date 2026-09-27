/**
 * What the teaching features remember between launches: whether Guided mode and game tips are on, whether the
 * player has already been asked about Guided mode, and which one-time tips they've already seen.
 *
 * Kept in `localStorage` (`mc-teaching`), the same way `progression/progression.ts` keeps its unlock preferences:
 * a few bytes read once at startup. Where `localStorage` is missing or throws (Vitest, a locked-down webview), the
 * defaults hold for the session. Nothing here reaches the engine.
 */

export const TEACHING_PREFS_VERSION = 1;
const PREFS_KEY = "mc-teaching";

export interface TeachingPrefs {
  readonly guidedMode: boolean;
  readonly gameTips: boolean;
  /** True once the first New game has asked "New to Marvel Champions?", whatever the answer. */
  readonly askedAboutGuide: boolean;
  /** Ids of one-time tips already shown (`view/guide/game-tips.ts`'s `Tip.id`). */
  readonly seenTips: readonly string[];
}

export const DEFAULT_TEACHING_PREFS: TeachingPrefs = {
  guidedMode: false,
  gameTips: true,
  askedAboutGuide: false,
  seenTips: [],
};

/** Tolerant of anything: a missing key, bad JSON or a wrong field type falls back to that field's default. */
export function parseTeachingPrefs(raw: string | null): TeachingPrefs {
  if (!raw) return DEFAULT_TEACHING_PREFS;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_TEACHING_PREFS;
  }
  if (typeof data !== "object" || data === null) return DEFAULT_TEACHING_PREFS;
  const record = data as Record<string, unknown>;
  const bool = (key: keyof TeachingPrefs): boolean =>
    typeof record[key] === "boolean" ? (record[key] as boolean) : (DEFAULT_TEACHING_PREFS[key] as boolean);
  const seen = Array.isArray(record.seenTips) ? record.seenTips.filter((id) => typeof id === "string") : [];
  return {
    guidedMode: bool("guidedMode"),
    gameTips: bool("gameTips"),
    askedAboutGuide: bool("askedAboutGuide"),
    seenTips: seen as string[],
  };
}

export function serializeTeachingPrefs(prefs: TeachingPrefs): string {
  return JSON.stringify({ version: TEACHING_PREFS_VERSION, ...prefs });
}

let current: TeachingPrefs | null = null;

export function teachingPrefs(): TeachingPrefs {
  if (current) return current;
  try {
    current = parseTeachingPrefs(globalThis.localStorage?.getItem(PREFS_KEY) ?? null);
  } catch {
    current = DEFAULT_TEACHING_PREFS;
  }
  return current;
}

export function updateTeachingPrefs(patch: Partial<TeachingPrefs>): TeachingPrefs {
  current = { ...teachingPrefs(), ...patch };
  try {
    globalThis.localStorage?.setItem(PREFS_KEY, serializeTeachingPrefs(current));
  } catch {
    // Private mode or a full quota: the choice still holds for this session.
  }
  return current;
}

export function markTipSeen(id: string): void {
  const seen = teachingPrefs().seenTips;
  if (!seen.includes(id)) updateTeachingPrefs({ seenTips: [...seen, id] });
}

/** Lets every one-time tip show again (Settings ▸ "Game tips", switched back on). */
export function resetSeenTips(): void {
  updateTeachingPrefs({ seenTips: [] });
}
