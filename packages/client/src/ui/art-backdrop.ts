/**
 * A faded picture behind a screen's panels (Play online, the room lobby): the Title's art pool, one picture chosen per
 * session so both screens show the same one, laid under a wash of the page colour so text over it stays readable in the
 * light and the dark theme alike. A picture that is missing or still loading leaves the plain page.
 */
import type Phaser from "phaser";
import { TITLE_ART, pickTitleArtFor, titleArtSizeOf, type TitleArt } from "../art/title-art.js";
import { drawnDensity } from "../platform/screen-settings.js";
import { surface } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { drawPicture } from "./campaign-chrome.js";

/** How much of the page colour is laid over the picture: the picture is a tint, never competing with text. */
export const BACKDROP_WASH = 0.72;

let chosen: TitleArt | null | undefined;

/** The session's backdrop picture (chosen on first use, so a redraw never swaps it), or null when there is none. */
function backdropArt(width: number, height: number): TitleArt | null {
  if (chosen === undefined) chosen = pickTitleArtFor(TITLE_ART, titleArtSizeOf, { width, height }, drawnDensity());
  return chosen;
}

/** Paints the page, the faded picture and the wash over the whole screen, behind everything drawn after. `onReady` redraws once the picture has loaded. */
export function drawArtBackdrop(scene: Phaser.Scene, width: number, height: number, onReady: () => void): void {
  scene.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
  const rect: Rect = { x: 0, y: 0, width, height };
  drawPicture(scene, backdropArt(width, height), rect, onReady, { focusY: 0.35 });
  scene.add.rectangle(0, 0, width, height, surface.paper.hex, BACKDROP_WASH).setOrigin(0, 0);
}
