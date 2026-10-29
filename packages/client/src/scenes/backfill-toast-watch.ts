/**
 * Starts the "Building your stats" toast (`scenes/backfill-toast.ts`) when a backfill run begins, unless the player
 * closed it earlier this session. The run itself is `progression/stats-backfill.ts`'s.
 */
import type Phaser from "phaser";
import { onBackfillProgress } from "../progression/stats-backfill.js";
import { SCENES } from "./keys.js";
import { sceneLoader } from "./scene-loader.js";

export function startBackfillToastWatch(game: Phaser.Game): () => void {
  let shown = false;
  return onBackfillProgress((progress) => {
    if (!progress.running || shown) return;
    shown = true;
    const start = (): void => {
      // The toast module says whether the player closed it; it is loaded by now.
      void import("./backfill-toast.js").then(({ backfillToastDismissed }) => {
        if (!backfillToastDismissed()) game.scene.start(SCENES.backfillToast);
      });
    };
    const loader = sceneLoader();
    if (loader) void loader.load(SCENES.backfillToast).then(start);
    else start();
  });
}
