/**
 * The one call Title makes for the one-time "Set up cross-device sync?" prompt (issue #276, step 2):
 * `maybeShowSyncSetupPrompt(this)` from Title once it is on screen. It reads what this device has, decides
 * (`view/sync-setup-prompt.ts`) and, when the prompt is due and online sync is on offer, launches
 * `scenes/sync-setup-prompt.ts` over Title. Everything is best effort: any failure means no prompt this launch.
 *
 * Kept free of Phaser scene code and of the sync service, so Title can import it without pulling either into its chunk.
 */
import type Phaser from "phaser";
import { SAVED_DATABASES } from "../save-data/databases.js";
import { open, settle } from "../save-data/save-data.js";
import { loadSyncCode } from "../sync/sync-credentials.js";
import { syncIsAvailable } from "../sync/sync-available.js";
import {
  hasProgressKeys,
  markSyncPromptSeen,
  shouldShowSyncSetupPrompt,
  syncPromptAnswered,
  syncPromptSeen,
  titleIsTopScene,
  type SyncSetupPromptInputs,
} from "../view/sync-setup-prompt.js";
import { CHROME_SCENES, SCENES } from "./keys.js";

/** A check is under way (or the prompt is up) for this page load. */
let checking = false;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** How many rows `store` of the database `name` holds; 0 when it can't be read. */
async function rowCount(name: string, store: string): Promise<number> {
  try {
    const spec = SAVED_DATABASES.find((database) => database.name === name);
    if (!spec) return 0;
    const db = await open(globalThis.indexedDB, spec);
    try {
      return await settle(db.transaction(store).objectStore(store).count());
    } finally {
      db.close();
    }
  } catch {
    return 0;
  }
}

/**
 * Real progress other than games: a decks or campaigns row, or a progress key (`hasProgressKeys`). The chrome's own
 * first-launch bookkeeping (`mc-rank-seen`, `mc-achievements-seen`) is not progress.
 */
async function hasOtherSaveData(local: Storage | null): Promise<boolean> {
  const keys: string[] = [];
  for (let i = 0; local && i < local.length; i++) {
    const key = local.key(i);
    if (key) keys.push(key);
  }
  if (hasProgressKeys(keys)) return true;
  return (await rowCount("mc-decks", "decks")) + (await rowCount("mc-campaigns", "campaigns")) > 0;
}

/** Scenes that run for the whole session without covering Title. */
const ALWAYS_UP: ReadonlySet<string> = new Set([
  ...CHROME_SCENES,
  SCENES.boot,
  SCENES.music,
  SCENES.reportButton,
  SCENES.musicButton,
  SCENES.languageButton,
]);

/**
 * Decides and launches. Safe to call on every Title visit: it does nothing once the player has answered, while sync is
 * on, with no online sync on offer (then it neither shows nor remembers anything, so a later launch asks), or while
 * another check or the prompt itself is running.
 */
export function maybeShowSyncSetupPrompt(scene: Phaser.Scene): void {
  if (checking) return;
  checking = true;
  void run(scene)
    .catch(() => undefined)
    .finally(() => {
      // The prompt, once launched, stays up on its own; a later call finds it active.
      checking = false;
    });
}

async function run(scene: Phaser.Scene): Promise<void> {
  const local = storage();
  if (syncPromptAnswered(local)) return;
  if (scene.scene.manager.isActive(SCENES.syncSetupPrompt)) return;

  const inputs: SyncSetupPromptInputs = {
    syncOn: local ? loadSyncCode(local) !== null : false,
    answered: false,
    hasSavedGames: (await rowCount("mc-saves", "games")) > 0,
    firstLaunchSinceUpdate: !syncPromptSeen(local),
    hasOtherSaveData: await hasOtherSaveData(local),
  };
  if (!shouldShowSyncSetupPrompt(inputs)) return;
  // Online sync must be on offer, or the invitation would only lead to "unavailable". Nothing is remembered otherwise.
  if (!(await syncIsAvailable())) return;
  // Title must still be the top screen: the games list, Settings, a link's join question or anything else over it
  // means the moment has passed. The chance is not spent (`mcsync.seen` is written only once the prompt launches).
  const manager = scene.scene.manager;
  const running = manager.getScenes(true).map((other) => other.sys.settings.key);
  if (!scene.sys.isActive() || !titleIsTopScene(running, scene.sys.settings.key, ALWAYS_UP)) return;
  markSyncPromptSeen(local);
  scene.scene.launch(SCENES.syncSetupPrompt);
}
