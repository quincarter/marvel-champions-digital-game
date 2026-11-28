/**
 * The art behind every tab of Your stats: a title wallpaper over the whole screen under a wash of the ground, lightest at the
 * top and nearly solid at the foot, as the landing page fades its art into the page. The panel is clear over it; the tiles
 * and rows are opaque, so it shows around them and under the tabs, and text on the ground stays readable. Drawn on the
 * canvas behind the panel.
 */
import type Phaser from "phaser";
import { surface } from "../tokens.js";
import { drawPicture } from "../ui/campaign-chrome.js";
import { TITLE_ART, pickTitleArtFor, titleArtSizeOf, type TitleArt } from "../art/title-art.js";
import { drawnDensity } from "../platform/screen-settings.js";

/** How much of the art the wash hides at the top of the screen and at the foot. */
const WASH_TOP = 0.76;
const WASH_FOOT = 0.94;
/** The last visit's backdrop, so the next one shows another while there is a choice. */
let lastKey: string | null = null;

export class StatsBackdrop {
  readonly #scene: Phaser.Scene;
  /** This visit's backdrop, picked once per open so a redraw keeps it. */
  readonly #art: TitleArt | null;
  #objects: Phaser.GameObjects.GameObject[] = [];
  #drawn: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.#scene = scene;
    this.#art = pickTitleArtFor(
      TITLE_ART,
      titleArtSizeOf,
      { width: scene.scale.width, height: scene.scale.height },
      drawnDensity(),
      lastKey,
    );
    lastKey = this.#art?.key ?? null;
  }

  /** The picture's texture key as drawn, or null while it loads (e2e reads it). */
  get drawn(): string | null {
    return this.#drawn;
  }

  /** Draws it again at the screen's size; `onLoaded` is called once the picture has loaded (draw again then). */
  draw(onLoaded: () => void): void {
    for (const object of this.#objects) object.destroy();
    this.#objects = [];
    const scene = this.#scene;
    const { width, height } = scene.scale.gameSize;
    this.#objects.push(scene.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0).setDepth(-3));
    const picture = drawPicture(scene, this.#art, { x: 0, y: 0, width, height }, onLoaded, {
      focusY: 0.3,
      scaleToSlot: true,
    });
    this.#drawn = picture?.texture.key ?? null;
    if (!picture) return;
    this.#objects.push(picture.setDepth(-2));
    const wash = scene.add.graphics().setDepth(-1);
    this.#objects.push(wash);
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const top = Math.round((height * i) / steps);
      wash
        .fillStyle(surface.paper.hex, WASH_TOP + ((WASH_FOOT - WASH_TOP) * i) / (steps - 1))
        // Whole-pixel strips that meet without overlapping: an overlap doubles the wash into a visible line.
        .fillRect(0, top, width, Math.round((height * (i + 1)) / steps) - top);
    }
  }
}
