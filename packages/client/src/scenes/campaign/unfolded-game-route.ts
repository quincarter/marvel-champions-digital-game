/**
 * Issue #265: a campaign game that ended without reaching Aftermath ("Back to title" on Game over, or the app
 * closed there) is picked back up on the way into the campaign, so its result is folded instead of the mission
 * being offered again. Called first by every screen a campaign is entered through (Cover, Run, Dossier, Briefing),
 * before any of them can throw the composed attempt away.
 */
import type Phaser from "phaser";
import { unfoldedGameOf } from "../../campaign/unfolded-game.js";
import type { CampaignRecord } from "../../engine/campaign-storage.js";
import { appSession } from "../../session.js";
import { goToScreen } from "../../ui/transitions.js";
import { SCENES } from "../keys.js";

/**
 * True when the record had a finished, unfolded game and the scene has been sent on to Aftermath with that game
 * loaded (or has stopped meanwhile), so the caller should draw nothing more. The replay runs in the engine host,
 * off the main thread. A game that no longer replays is left alone: the caller carries on as before.
 */
export async function routeUnfoldedGame(scene: Phaser.Scene, record: CampaignRecord): Promise<boolean> {
  if (!record.attempt) return false;
  const { store } = appSession();
  const game = unfoldedGameOf(record, await store.listSaves());
  if (!game) return false;
  if (!scene.sys.isActive()) return true;
  await store.resume(game.id);
  if (!scene.sys.isActive()) return true;
  if (store.state.status === "failed" || !store.state.game?.outcome) return false;
  goToScreen(scene, SCENES.campaignAftermath, { runId: record.id });
  return true;
}
