/**
 * The one call Title makes for the one-time "Share your results?" question: `maybeAskGlobalStats(this, asked)`, with
 * whether the sync question was put in this visit. It asks only when the player has finished a game, has never
 * answered, the Worker is reachable, Title is the top screen and the sync question was not put in this visit. Best
 * effort: any failure means no question this visit. Imports only the ask's own small view module and the consent
 * store (not the stats model), so Title's chunk stays small.
 */
import type Phaser from "phaser";
import { finishedIdsOf, readConsent, wasAsked } from "../global-stats/global-consent.js";
import { appSession } from "../session.js";
import { syncIsAvailable } from "../sync/sync-available.js";
import { shouldAskGlobal } from "../view/global-ask.js";
import { titleIsTopScene } from "../view/sync-setup-prompt.js";
import { CHROME_SCENES, SCENES } from "./keys.js";

const ALWAYS_UP: ReadonlySet<string> = new Set([
  ...CHROME_SCENES,
  SCENES.boot,
  SCENES.music,
  SCENES.reportButton,
  SCENES.musicButton,
  SCENES.languageButton,
]);

let checking = false;
/** The question has been put in this page load: with storage that cannot save the answer, it is still asked once. */
let askedThisLoad = false;

export function maybeAskGlobalStats(scene: Phaser.Scene, syncAskedThisVisit: boolean): void {
  if (checking || askedThisLoad || syncAskedThisVisit || wasAsked()) return;
  checking = true;
  void run(scene, syncAskedThisVisit)
    .catch(() => undefined)
    .finally(() => {
      checking = false;
    });
}

async function run(scene: Phaser.Scene, syncAskedThisVisit: boolean): Promise<void> {
  const finished = finishedIdsOf(await appSession().store.listSaves()).length;
  if (!shouldAskGlobal({ consent: readConsent(), finishedGames: finished, syncAskedThisVisit })) return;
  // The Worker must be on offer (the same probe the sync question uses, once per page load), or the question would lead
  // nowhere. Nothing is remembered otherwise, so a later visit asks.
  if (!(await syncIsAvailable())) return;
  const manager = scene.scene.manager;
  if (manager.isActive(SCENES.globalStatsPrompt)) return;
  const running = manager.getScenes(true).map((other) => other.sys.settings.key);
  if (!scene.sys.isActive() || !titleIsTopScene(running, scene.sys.settings.key, ALWAYS_UP)) return;
  // Read again just before launching: an answer given elsewhere while the probe was out stands.
  if (wasAsked()) return;
  askedThisLoad = true;
  scene.scene.launch(SCENES.globalStatsPrompt);
}
