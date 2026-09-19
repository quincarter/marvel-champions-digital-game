/**
 * Redraws every text object after the WebGL context comes back.
 *
 * When the context is restored, Phaser recreates each GPU texture from its
 * source. For a Text object that source is the object's own 2D canvas. On
 * WebKit (the Tauri/Capacitor webviews) those 2D canvases are GPU-backed too,
 * so the same GPU-process reset that dropped the WebGL context also wiped
 * them, and Phaser re-uploads blank pixels: every label on every screen turns
 * into a solid black box while images (re-decoded from their source) and
 * graphics (redrawn each frame) come back fine.
 *
 * `updateText()` re-renders the text into its canvas and re-uploads it, which
 * is all the recovery a text object needs. Nothing else in the client owns a
 * canvas-backed texture.
 */
import type Phaser from "phaser";

// Phaser's `Renderer.Events.RESTORE_WEBGL` and `Core.Events.BOOT`, spelled out
// so this module imports Phaser for types only and stays testable under Node.
const RESTORE_WEBGL = "restorewebgl";
const BOOT = "boot";

/** The part of a game object this walk reads, so it can be tested without a renderer. */
export interface TextRedrawNode {
  readonly updateText?: () => unknown;
  readonly list?: readonly TextRedrawNode[];
}

/** Calls `updateText()` on every text object in `nodes`, descending into containers; returns how many were redrawn. */
export function redrawTexts(nodes: readonly TextRedrawNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (typeof node.updateText === "function") {
      node.updateText();
      count++;
    }
    if (Array.isArray(node.list)) count += redrawTexts(node.list);
  }
  return count;
}

/** Wires the redraw to the renderer's restore event. A no-op under the Canvas renderer, which has no GPU context to lose. */
export function recoverTextOnContextRestore(game: Phaser.Game): void {
  const wire = (): void => {
    const renderer = game.renderer;
    if (!renderer || !("gl" in renderer)) return;
    renderer.on(RESTORE_WEBGL, () => {
      // Every scene, not only running ones: a sleeping scene's text would
      // otherwise wake up still black.
      for (const scene of game.scene.scenes) {
        redrawTexts(scene.sys.displayList.list as unknown as readonly TextRedrawNode[]);
      }
    });
  };
  // The renderer is created during boot, which Phaser defers until the DOM is ready.
  if (game.renderer) wire();
  else game.events.once(BOOT, wire);
}
