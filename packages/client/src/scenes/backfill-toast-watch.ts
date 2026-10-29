/**
 * Shows the "Building your stats" toast (`scenes/backfill-toast.ts`) while a backfill run goes on and the Title is the
 * screen, unless the player closed it this session: it is placed for the Title's layout, and over another screen it
 * would sit on that screen's controls. It hides when the Title gives way and comes back on returning to it while the
 * run still goes. The run itself is `progression/stats-backfill.ts`'s.
 */
import Phaser from "phaser";
import { backfillProgress, onBackfillProgress } from "../progression/stats-backfill.js";
import { SCENES } from "./keys.js";
import { sceneLoader } from "./scene-loader.js";

export function startBackfillToastWatch(game: Phaser.Game): () => void {
  const titleUp = (): boolean => game.scene.isActive(SCENES.title);
  const show = (): void => {
    if (!backfillProgress().running || !titleUp() || game.scene.isActive(SCENES.backfillToast)) return;
    const start = (): void => {
      // The toast module says whether the player closed it; it is loaded by now.
      void import("./backfill-toast.js").then(({ backfillToastDismissed }) => {
        if (!backfillToastDismissed() && titleUp() && backfillProgress().running)
          game.scene.start(SCENES.backfillToast);
      });
    };
    const loader = sceneLoader();
    if (loader) void loader.load(SCENES.backfillToast).then(start);
    else start();
  };
  const hide = (): void => {
    if (game.scene.isActive(SCENES.backfillToast) && backfillProgress().running) game.scene.stop(SCENES.backfillToast);
  };
  const title = game.scene.getScene(SCENES.title);
  title?.events.on(Phaser.Scenes.Events.CREATE, show);
  title?.events.on(Phaser.Scenes.Events.SHUTDOWN, hide);
  const off = onBackfillProgress(() => show());
  return () => {
    off();
    title?.events.off(Phaser.Scenes.Events.CREATE, show);
    title?.events.off(Phaser.Scenes.Events.SHUTDOWN, hide);
  };
}
