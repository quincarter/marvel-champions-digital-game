/**
 * What the Title's canvas draws under its page: the ink ground with its dot grid, this visit's picture and, on a phone,
 * the scrim that keeps the paper text on top legible. The page is DOM and transparent over the art column (the whole
 * screen on a phone), so the scene hands this the box that column has been laid out at and draws into it.
 */
import type Phaser from "phaser";
import { TITLE_ART, coverFit, pickTitleArtFor, titleArtSizeOf, type TitleArt } from "../art/title-art.js";
import { ensurePictureLoaded } from "../art/pictures.js";
import { drawnDensity } from "../platform/screen-settings.js";
import { dotGrid, surface } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { paintDotGrid } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import { setupMetrics } from "../view/setup-metrics.js";
import { onlineSideFits, sideArtWidth } from "../view/title-online-panel.js";

/**
 * Depth ladder for the title picture: the ink ground and dot grid under it, the picture, then (phone only) the
 * legibility scrim, all below the default depth 0. Depth rather than display-list order because the picture arrives
 * asynchronously and would otherwise land on top of what is drawn after it.
 */
const GROUND_DEPTH = -3;
const ART_DEPTH = -2;
const SCRIM_DEPTH = -1;

/** The picture the last Title visit showed, so the next visit shows a different one (`pickTitleArt`). */
let lastKey: string | null = null;
/** The picture the next visit shows, picked and loaded during this one (`preloadNext`). */
let next: TitleArt | null = null;

/** The art column's box for a screen of `width` x `height` (to pick a picture by), or null on a phone: the whole screen. */
export function artPanelOf(width: number, height: number): Rect | null {
  const { phone, pad } = setupMetrics(width, height);
  if (phone) return null;
  const side = onlineSideFits(width, height, pad, 520);
  return { x: 0, y: 0, width: side ? sideArtWidth(width, pad, 520) : Math.round(width * 0.45), height };
}

export class TitleArtLayer {
  readonly #scene: Phaser.Scene;
  #art: TitleArt | null = null;
  /** Bumped by every draw, so a picture that finishes loading after a redraw is placed by the current one only. */
  #generation = 0;
  #drawn = "";

  constructor(scene: Phaser.Scene) {
    this.#scene = scene;
  }

  #pick(): TitleArt | null {
    const { width, height } = this.#scene.scale.gameSize;
    return pickTitleArtFor(TITLE_ART, titleArtSizeOf, artPanelOf(width, height), drawnDensity(), lastKey);
  }

  /** This visit's picture: the one the last visit already loaded for it, else a fresh pick. */
  choose(): void {
    this.#art = next ?? this.#pick();
    lastKey = this.#art?.key ?? null;
    next = null;
    this.#drawn = "";
  }

  /** Resolves once this visit's picture is loaded (at once when it already is, or there is none). */
  loaded(): Promise<void> {
    const art = this.#art;
    return new Promise((resolve) => {
      if (!art || ensurePictureLoaded(this.#scene, art, resolve) !== null) resolve();
    });
  }

  /** Loads the picture the next visit will show, so coming back to the Title does not wait on it. */
  preloadNext(): void {
    if (!this.#scene.sys.isActive() || next) return;
    next = this.#pick();
    if (next) ensurePictureLoaded(this.#scene, next, () => undefined);
  }

  /** Draws the ground and the picture into `panel`; a no-op while neither the box nor the layout mode changed. */
  draw(panel: Rect, phone: boolean): void {
    const scene = this.#scene;
    const signature = `${panel.x},${panel.y},${panel.width},${panel.height},${phone}`;
    if (signature === this.#drawn) return;
    this.#drawn = signature;
    destroyChildren(scene);
    const { width, height } = scene.scale.gameSize;
    scene.add
      .rectangle(panel.x, panel.y, panel.width, panel.height, surface.ink.hex)
      .setOrigin(0, 0)
      .setDepth(GROUND_DEPTH);
    paintDotGrid(scene, panel, "ink", dotGrid.onInk).setDepth(GROUND_DEPTH);
    // A phone has no art panel: the picture goes full-bleed under an ink scrim so the paper text on top stays legible.
    if (phone) scene.add.rectangle(0, 0, width, height, surface.ink.hex, 0.62).setOrigin(0, 0).setDepth(SCRIM_DEPTH);
    const art = this.#art;
    if (!art) return;
    const generation = ++this.#generation;
    const place = (): void => {
      if (generation !== this.#generation || !scene.sys.isActive() || !scene.textures.exists(art.key)) return;
      const frame = scene.textures.get(art.key).getSourceImage() as { width: number; height: number };
      const fit = coverFit(frame, panel);
      scene.add
        .image(panel.x + panel.width / 2, panel.y + panel.height / 2, art.key)
        .setScale(fit.scale)
        .setCrop(fit.cropX, fit.cropY, fit.cropWidth, fit.cropHeight)
        .setDepth(ART_DEPTH);
    };
    // Through the shared loader: the guide chooser draws the same wallpaper, and two scenes loading one key at once log
    // "Texture key already in use".
    if (ensurePictureLoaded(scene, art, place) !== null) place();
  }
}
