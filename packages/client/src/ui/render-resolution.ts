/**
 * Draws the game at a fixed resolution scaled up to fill the window, black bars where the shapes differ: the desktop
 * app's Borderless and Fullscreen modes at a resolution below native (`platform/desktop-window.ts#renderSizeOf`).
 *
 * The game normally runs in Phaser's RESIZE mode, where the canvas is its parent's size in CSS pixels (`main.ts`). A
 * fixed resolution switches it to FIT: the canvas's drawing buffer is the chosen size, Phaser scales it to fit #game
 * and centres it, and maps pointer input and the DOM text fields through that same scale. Scenes see the chosen size
 * as `scale.gameSize` and get the usual `resize` event, so they lay out for it as they would for a window that size.
 */
import Phaser from "phaser";

/** The letterbox colour: the bars read as the screen's edge, not as part of the table. */
const BARS = "#000";

export function applyRenderSize(
  game: Phaser.Game,
  size: { readonly width: number; readonly height: number } | null,
): void {
  const scale = game.scale as Phaser.Scale.ScaleManager & {
    scaleMode: Phaser.Scale.ScaleModeType;
    autoCenter: Phaser.Scale.CenterType;
  };
  const parent = scale.parent as HTMLElement | null;
  if (size === null) {
    if (scale.scaleMode === Phaser.Scale.RESIZE) return;
    scale.scaleMode = Phaser.Scale.RESIZE;
    scale.autoCenter = Phaser.Scale.NO_CENTER;
    scale.displaySize.setAspectMode(Phaser.Structs.Size.NONE);
    // FIT sizes and centres the canvas with inline styles; RESIZE never writes them, so they would stay behind and
    // keep the game stretched to the old fit (a 1920 x 1080 canvas drawn 2560 wide after Borderless).
    game.canvas.style.marginLeft = "";
    game.canvas.style.marginTop = "";
    game.canvas.style.width = "";
    game.canvas.style.height = "";
    if (parent !== null) parent.style.background = "";
    scale.refresh();
    return;
  }
  scale.scaleMode = Phaser.Scale.FIT;
  scale.autoCenter = Phaser.Scale.CENTER_BOTH;
  // Phaser sets the display size's aspect mode only at boot, from the configured scale mode (RESIZE leaves it free).
  scale.displaySize.setAspectMode(Phaser.Structs.Size.FIT);
  scale.displaySize.setParent(scale.parentSize);
  if (parent !== null) parent.style.background = BARS;
  scale.setGameSize(size.width, size.height);
  scale.refresh();
}
