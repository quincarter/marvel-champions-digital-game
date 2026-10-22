/**
 * The one-time "Set up cross-device sync?" prompt (issue #276, step 2), as plain decisions: whether it shows, what it
 * says, and the two `localStorage` markers it keeps. `scenes/sync-setup-prompt.ts` draws it and
 * `scenes/sync-setup-prompt-launch.ts` gathers the inputs and launches it.
 *
 * The markers deliberately do not start with `mc-`: every `mc-*` key travels in a save export and is synced, and
 * "this device was asked" is about the device, like the recovery code's own `mcsync.code`.
 */
import { SYNC_ROW_TITLE } from "./sync-model.js";

/** Set once the player has answered (Set up, Join or Not now); the prompt is never shown again after it. */
export const SYNC_PROMPTED_KEY = "mcsync.prompted";
/** Set once a launch has looked at this device, so "the first launch after this update" is only ever one launch. */
export const SYNC_SEEN_KEY = "mcsync.seen";

export const SYNC_SETUP_TITLE = "Set up cross-device sync?";
export const SYNC_SETUP_BODY =
  "Keep your saves in step across your phone, tablet and computer. There is no account to make, and your saves are encrypted so only your devices can read them.";
/** Where the settings live, spelled with the on-screen labels (Settings tab "More", row "Save data", the sync row). */
export const SYNC_SETUP_PATH = `Settings → More → Save data → ${SYNC_ROW_TITLE}`;
export const SYNC_SETUP_LATER = `You can set this up any time in ${SYNC_SETUP_PATH}.`;

export const SYNC_SETUP_BUTTONS = {
  setUp: "Set up",
  join: "Join with a code",
  notNow: "Not now",
} as const;

export type SyncSetupAnswer = "set-up" | "join" | "not-now";

/** The notice that follows "Not now": the same pointer, short enough for a few seconds on screen. */
export const SYNC_NOTICE_HEADING = "Cross-device sync is off";
export const SYNC_NOTICE_BODY = SYNC_SETUP_LATER;
/** How long the notice stays up. */
export const SYNC_NOTICE_HOLD_MS = 6000;

/** What the launch learned about this device. */
export interface SyncSetupPromptInputs {
  /** This device is already linked to a sync space. */
  readonly syncOn: boolean;
  /** The player answered the prompt on an earlier launch. */
  readonly answered: boolean;
  /** At least one saved game, of any status (in progress, won or lost). */
  readonly hasSavedGames: boolean;
  /** No launch has looked at this device since the update brought the prompt. */
  readonly firstLaunchSinceUpdate: boolean;
  /** Save data other than games (unlocks, guide choices): this device has been played on before. */
  readonly hasOtherSaveData: boolean;
}

/**
 * Whether the prompt is worth showing: never when sync is on or the player answered; otherwise a player with a saved
 * game, or an existing player (some save data) on the first launch since the update. A brand-new player with nothing
 * saved is not asked; they are asked once they have a game worth keeping.
 */
export function shouldShowSyncSetupPrompt(inputs: SyncSetupPromptInputs): boolean {
  if (inputs.syncOn || inputs.answered) return false;
  if (inputs.hasSavedGames) return true;
  return inputs.firstLaunchSinceUpdate && inputs.hasOtherSaveData;
}

/** The slice of `Storage` the markers need. */
export type PromptMarkerStorage = Pick<Storage, "getItem" | "setItem">;

function readMarker(storage: PromptMarkerStorage | null, key: string): boolean {
  try {
    const value = storage?.getItem(key);
    return value !== null && value !== undefined;
  } catch {
    return false;
  }
}

function writeMarker(storage: PromptMarkerStorage | null, key: string): void {
  try {
    storage?.setItem(key, "1");
  } catch {
    // Storage refused (private mode, full): the prompt may come back next launch, which is the safe way to be wrong.
  }
}

export const syncPromptAnswered = (storage: PromptMarkerStorage | null): boolean =>
  readMarker(storage, SYNC_PROMPTED_KEY);
export const markSyncPromptAnswered = (storage: PromptMarkerStorage | null): void =>
  writeMarker(storage, SYNC_PROMPTED_KEY);
export const syncPromptSeen = (storage: PromptMarkerStorage | null): boolean => readMarker(storage, SYNC_SEEN_KEY);
export const markSyncPromptSeen = (storage: PromptMarkerStorage | null): void => writeMarker(storage, SYNC_SEEN_KEY);

/** What the player's answer does: Not now closes with a notice; the other two hand over to the sync screen. */
export function syncSetupAnswerOutcome(answer: SyncSetupAnswer): {
  readonly notice: boolean;
  readonly openSyncScreen: "setup" | "join" | null;
} {
  switch (answer) {
    case "set-up":
      return { notice: false, openSyncScreen: "setup" };
    case "join":
      return { notice: false, openSyncScreen: "join" };
    case "not-now":
      return { notice: true, openSyncScreen: null };
  }
}

/**
 * `localStorage` keys that are real progress or a real choice by the player. An allowlist, on purpose: the game and its
 * chrome write bookkeeping on any first launch (`mc-rank-seen`, `mc-achievements-seen`, guide preferences), and that
 * must never make a brand-new player look like an existing one.
 */
const PROGRESS_KEYS: ReadonlySet<string> = new Set(["mc-unlocks", "mc-unlocked-everything", "mc-deck-feats"]);
const PROGRESS_KEY_PREFIXES: readonly string[] = ["mc-deck-freeze-optin:"];

/** Whether any of these `localStorage` keys is real progress (see `PROGRESS_KEYS`). */
export function hasProgressKeys(keys: Iterable<string>): boolean {
  for (const key of keys) {
    if (PROGRESS_KEYS.has(key) || PROGRESS_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) return true;
  }
  return false;
}

/**
 * Whether the prompt may launch now: every running scene other than Title is chrome that is always up (the music
 * controller, the Report and music buttons, the notices, the sync watcher). Anything else over Title (the games list,
 * Settings, a confirm, a link's join question) means the moment has passed, and the chance is not spent.
 */
export function titleIsTopScene(
  runningKeys: readonly string[],
  titleKey: string,
  alwaysUp: ReadonlySet<string>,
): boolean {
  return runningKeys.every((key) => key === titleKey || alwaysUp.has(key));
}
