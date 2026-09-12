/**
 * Loading and drawing card scans.
 *
 * Art is fetched **lazily, per card, as the table asks for it** rather than in
 * one per-scenario batch. A Core scenario touches a few hundred cards, and a
 * preload of all of them would put a progress bar in front of a game that only
 * ever shows a dozen at once. The board draws its frame immediately, the scan
 * arrives, and the board redraws — which is also the honest behaviour when a
 * scan is missing, since the generated frame is the designed fallback for that
 * (PLAN.md Phase 4, "a missing scan falls back to a generated frame").
 *
 * A failed load is remembered as missing so a 404 is asked for exactly once.
 */

import Phaser from "phaser";
import type { Rect } from "../view/layout.js";
import type { ArtSource } from "./art-source.js";

type Status = "loading" | "ready" | "missing";

/**
 * Textures live on the game, not the scene, so this cache does too: one per
 * `Phaser.Game`, shared by the board and every overlay above it.
 */
const caches = new WeakMap<Phaser.Game, CardArt>();

export function cardArt(scene: Phaser.Scene): CardArt {
  const existing = caches.get(scene.game);
  if (existing) return existing;
  const created = new CardArt();
  caches.set(scene.game, created);
  return created;
}

export class CardArt {
  readonly #status = new Map<string, Status>();
  readonly #listeners = new Set<() => void>();
  /** Keys queued this frame but not yet handed to the loader. */
  #pending: { readonly scene: Phaser.Scene; readonly source: ArtSource }[] = [];
  #flushScheduled = false;

  /** Called when a batch of art arrives, so the board can redraw with it. */
  onArrived(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * The texture key if the scan is on hand, else null — and the request is
   * queued. Callers draw their frame either way and get a redraw later.
   */
  request(scene: Phaser.Scene, source: ArtSource | null): string | null {
    if (!source) return null;
    const status = this.#status.get(source.key);
    if (status === "ready") return source.key;
    if (status) return null;

    this.#status.set(source.key, "loading");
    this.#pending.push({ scene, source });
    this.#schedule(scene);
    return null;
  }

  /** True once the loader has answered for this key, either way. */
  settled(key: string): boolean {
    const status = this.#status.get(key);
    return status === "ready" || status === "missing";
  }

  /**
   * One flush per frame. A board redraw asks for every visible card at once, so
   * batching keeps that to a single loader run and a single redraw afterwards.
   */
  #schedule(scene: Phaser.Scene): void {
    if (this.#flushScheduled) return;
    this.#flushScheduled = true;
    scene.time.delayedCall(0, () => {
      this.#flushScheduled = false;
      this.#flush();
    });
  }

  #flush(): void {
    const batch = this.#pending;
    this.#pending = [];
    const scene = batch[0]?.scene;
    if (!scene) return;

    for (const { source } of batch) {
      if (scene.textures.exists(source.key)) {
        this.#status.set(source.key, "ready");
        continue;
      }
      scene.load.image(source.key, source.url);
    }

    // A 404 is the ordinary answer for a card with no scan, so it is recorded
    // rather than reported: the frame the board already drew is the fallback.
    const onError = (file: Phaser.Loader.File): void => {
      if (this.#status.get(file.key) === "loading") this.#status.set(file.key, "missing");
    };
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      for (const { source } of batch) {
        if (scene.textures.exists(source.key)) this.#status.set(source.key, "ready");
        else if (this.#status.get(source.key) === "loading") this.#status.set(source.key, "missing");
      }
      for (const listener of [...this.#listeners]) listener();
    });
    if (!scene.load.isLoading()) scene.load.start();
  }
}

/** How a scan is fitted into the slot it's drawn in. */
export type ArtFit =
  /** Fill the slot and crop the overflow — for the art band on a panel. */
  | "cover"
  /** Fit the whole card inside the slot — for a hand card or Inspect. */
  | "contain";

export interface DrawArtOptions {
  readonly fit?: ArtFit;
  /**
   * Which part of the scan a `cover` crop keeps vertically, 0 = top, 1 = bottom.
   * A card scan is name · illustration · rules text top to bottom, so the
   * default keeps the illustration rather than centring on the rules box.
   */
  readonly focusY?: number;
  readonly alpha?: number;
}

/**
 * Draws a loaded scan into `rect`. Returns null when the key isn't a texture,
 * so a caller can draw its own frame in the same pass without asking twice.
 *
 * `cover` crops in texture space and shifts the image back by the crop offset:
 * Phaser keeps a cropped object's frame layout, so the visible piece would
 * otherwise land one crop-origin to the right of where it belongs.
 */
export function drawArt(
  scene: Phaser.Scene,
  key: string | null,
  rect: Rect,
  options: DrawArtOptions = {},
): Phaser.GameObjects.Image | null {
  if (!key || !scene.textures.exists(key)) return null;
  const size = scene.textures.get(key).getSourceImage();
  const sourceWidth = size.width;
  const sourceHeight = size.height;
  if (!sourceWidth || !sourceHeight) return null;

  const fit = options.fit ?? "cover";
  const scale =
    fit === "cover"
      ? Math.max(rect.width / sourceWidth, rect.height / sourceHeight)
      : Math.min(rect.width / sourceWidth, rect.height / sourceHeight);

  const image = scene.add.image(0, 0, key).setOrigin(0, 0).setScale(scale).setAlpha(options.alpha ?? 1);

  if (fit === "contain") {
    // Centred in the slot, whole card visible.
    image.setPosition(
      rect.x + (rect.width - sourceWidth * scale) / 2,
      rect.y + (rect.height - sourceHeight * scale) / 2,
    );
    return image;
  }

  const visibleWidth = Math.min(sourceWidth, rect.width / scale);
  const visibleHeight = Math.min(sourceHeight, rect.height / scale);
  const cropX = (sourceWidth - visibleWidth) / 2;
  const focus = options.focusY ?? 0.34;
  const cropY = Math.max(0, Math.min(sourceHeight - visibleHeight, (sourceHeight - visibleHeight) * focus));
  image.setCrop(cropX, cropY, visibleWidth, visibleHeight);
  image.setPosition(rect.x - cropX * scale, rect.y - cropY * scale);
  return image;
}
