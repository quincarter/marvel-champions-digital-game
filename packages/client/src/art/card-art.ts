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

/**
 * What this cache tracks is deliberately *not* "has this scan arrived" — the
 * texture manager already knows that, and a second answer to the same question
 * is a second answer that can be wrong. An earlier version kept a per-key
 * loading/ready/missing state and gated drawing on it; a scan could land in the
 * texture manager while its entry stayed "loading", and the table then drew the
 * placeholder until some unrelated redraw happened to fix it.
 *
 * So the texture manager decides what can be drawn, and this class only
 * remembers two things it alone knows: what has already been handed to the
 * loader (don't ask twice) and what came back 404 (don't ask again, ever).
 */
export class CardArt {
  /** Keys already handed to the loader, so one scan is fetched once. */
  readonly #requested = new Set<string>();
  /** Keys the server has no scan for. The generated frame is the answer for these. */
  readonly #missing = new Set<string>();
  readonly #listeners = new Set<() => void>();
  /** Scenes whose loader this cache has already hooked. */
  readonly #hooked = new WeakSet<Phaser.Scene>();
  #pending: { readonly scene: Phaser.Scene; readonly source: ArtSource }[] = [];
  #flushScheduled = false;
  #notifyScheduled = false;

  /** Called when art arrives, so the board can redraw with it. */
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
    if (scene.textures.exists(source.key)) return source.key;
    if (this.#missing.has(source.key) || this.#requested.has(source.key)) return null;

    this.#requested.add(source.key);
    this.#pending.push({ scene, source });
    this.#schedule(scene);
    return null;
  }

  /** True when the server has said it has no scan for this key. */
  isMissing(key: string): boolean {
    return this.#missing.has(key);
  }

  /**
   * One flush per frame. A board redraw asks for every visible card at once, so
   * batching keeps that to a single loader run.
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

    this.#hook(scene);
    for (const { source } of batch) scene.load.image(source.key, source.url);
    // Files added while a run is in flight are picked up by that run; starting
    // a second one would be the race, not the fix.
    if (!scene.load.isLoading()) scene.load.start();
  }

  /**
   * Redraw on *any* file arriving, rather than on a particular batch finishing.
   * A redraw is cheap and idempotent, and the alternative — deciding which
   * batch a completion belongs to — is exactly the bookkeeping this class no
   * longer keeps.
   */
  #hook(scene: Phaser.Scene): void {
    if (this.#hooked.has(scene)) return;
    this.#hooked.add(scene);

    const onFile = (): void => this.#notify(scene);
    // A 404 is the ordinary answer for a card with no scan, so it is recorded
    // rather than reported: the frame the board already drew is the fallback.
    const onError = (file: Phaser.Loader.File): void => {
      this.#missing.add(file.key);
      this.#notify(scene);
    };

    scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, onFile);
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.load.off(Phaser.Loader.Events.FILE_COMPLETE, onFile);
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      this.#hooked.delete(scene);
    });
  }

  /** Coalesces a run of arrivals into one redraw, so eight cards cost one pass. */
  #notify(scene: Phaser.Scene): void {
    if (this.#notifyScheduled) return;
    this.#notifyScheduled = true;
    scene.time.delayedCall(0, () => {
      this.#notifyScheduled = false;
      for (const listener of [...this.#listeners]) listener();
    });
  }
}

/**
 * How a scan is fitted into the slot it is drawn in.
 *
 * `contain` is the default and the right answer nearly everywhere, because a
 * scan is a *whole card* — frame, name, stat box and all — not a picture of a
 * character. Cropping one does not produce artwork, it produces a card with its
 * edges cut off, which is exactly what it looks like.
 */
export type ArtFit =
  /** Fit the whole card inside the slot. Nothing is ever lost. */
  | "contain"
  /**
   * Fill the slot and crop the overflow. Only for a slot that is already the
   * card's own shape, where "cover" and "contain" are the same fit and neither
   * crops anything — a hand card's 2.5:3.5 slot against a 300×419 scan.
   */
  | "cover";

export interface DrawArtOptions {
  readonly fit?: ArtFit;
  /**
   * Which part of the scan a `cover` crop keeps vertically, 0 = top, 1 = bottom.
   * Only consulted when the slot and the scan disagree about shape, which for
   * `cover`'s intended use they essentially never do.
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

  const fit = options.fit ?? "contain";
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
