import type Phaser from "phaser";
import { onLoadedPacksChange } from "../packs/pack-registry.js";

/**
 * Rebuilds a screen when the loaded packs change (docs/custom-content-packs.md §7.4). Installed packs load a moment after
 * boot (validated in a worker) and again after an install or removal in the Mod Store, so a screen that lists heroes,
 * decks or cards must draw again when the set changes under it. Unsubscribes when the scene shuts down.
 */
export function rebuildOnPackChange(scene: Phaser.Scene, rebuild: () => void): void {
  const off = onLoadedPacksChange(() => {
    if (scene.sys.isActive()) rebuild();
  });
  scene.events.once("shutdown", off);
}
