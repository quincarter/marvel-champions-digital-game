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
 *
 * Nothing ever evicted a loaded texture until this cap was added. A scan
 * decodes to `width * height * 4` bytes on the GPU/CPU regardless of its
 * compressed size on disk, most Core scans decode to 2-3 MB and a few (a
 * villain's landscape stage art) run past 8 MB, and a long game — or several
 * games back to back in the one tab this app never reloads (`main.ts` builds
 * exactly one `Phaser.Game`) — touches far more than a table's worth of them:
 * every side scheme cycled through, every discard pile browsed, every
 * encounter card that ever left the deck. Left unbounded that is an
 * unrecoverable multi-gigabyte climb for the life of the tab; a player
 * reported the browser crashing at 3.5 GB. `RESIDENT_BUDGET_BYTES` below is
 * the fix: a soft cap on decoded bytes resident at once, enforced by evicting
 * the least-recently-*requested* textures (not "least recently drawn" —
 * `request()` runs on every redraw for every card a scene currently wants to
 * show, so anything still on screen is always the newest tick and is always
 * the last thing evicted).
 */

import type Phaser from "phaser";
import type { Rect } from "../view/layout.js";
import { CARD_BACKS, type ArtSource } from "./art-source.js";

/**
 * `Phaser.Loader.Events.FILE_COMPLETE` / `.FILE_LOAD_ERROR` and
 * `Phaser.Scenes.Events.SHUTDOWN`, spelled out as the string literals they
 * are (`phaser/src/loader/events/FILE_COMPLETE_EVENT.js` etc. — stable public
 * event names, not implementation detail).
 *
 * Only a *type* import of `phaser` remains above. The real package has a
 * module-scope `window` reference that throws outside a browser
 * (`phaser.esm.js`'s environment sniff runs on import, not on use), so a
 * runtime import here would make this file — the one with the actual
 * eviction logic worth regression-testing — impossible to unit test without
 * a DOM shim. Nothing else in this module needs Phaser as a value.
 */
const FILE_COMPLETE = "filecomplete";
const FILE_LOAD_ERROR = "loaderror";
const SHUTDOWN = "shutdown";

/**
 * Textures live on the game, not the scene, so this cache does too: one per
 * `Phaser.Game`, shared by the board and every overlay above it.
 */
const caches = new WeakMap<Phaser.Game, CardArt>();

/**
 * Decoded bytes allowed resident at once. ~256 MB comfortably holds a full
 * board plus an open overlay (a few hundred typically-sized scans, more if
 * they're the rare oversized ones) while keeping a long or repeated session
 * from climbing toward the gigabytes that crashed a real game. Tune here if
 * play reveals it's too tight (visible re-fetch stutter) or too loose
 * (memory still climbing).
 */
const RESIDENT_BUDGET_BYTES = 256 * 1024 * 1024;

/**
 * The three card backs are requested constantly (every hidden card in every
 * hand/deck/discard) and are cheap relative to the budget, so they are kept
 * out of eviction accounting entirely rather than fought over with the LRU
 * sweep on every redraw.
 */
const PINNED_KEYS: ReadonlySet<string> = new Set(Object.values(CARD_BACKS).map((back) => back.key));

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
/** How long arrivals are gathered before the screens showing them redraw. Short enough to read as "the art popped in". */
const ARRIVAL_WINDOW_MS = 120;

export class CardArt {
  /** Keys already handed to the loader, so one scan is fetched once. */
  readonly #requested = new Set<string>();
  /** Keys the server has no scan for. The generated frame is the answer for these. */
  readonly #missing = new Set<string>();
  readonly #listeners = new Set<() => void>();
  /** Scenes whose loader this cache has already hooked. */
  readonly #hooked = new WeakSet<Phaser.Scene>();
  /** Requested but not yet handed to a loader. */
  #pending: ArtSource[] = [];
  /**
   * Keys handed to a loader and not yet answered, by the scene whose loader
   * has them. A scene's loader dies with the scene — an overlay stopped
   * mid-fetch never reports those files at all — so on shutdown these are
   * un-requested and the next redraw that wants them asks again.
   */
  readonly #inflight = new Map<string, Phaser.Scene>();
  /**
   * The scene whose clock holds the scheduled flush/notify, or null. Held as
   * the scene rather than a boolean because a scene's clock dies with it: the
   * choice and inspect overlays are launched and stopped constantly, and a
   * flush scheduled on one that closed before the next tick used to leave a
   * `true` flag behind that blocked every later scan for the rest of the tab.
   */
  #flushScene: Phaser.Scene | null = null;
  #notifyScene: Phaser.Scene | null = null;
  /** Decoded byte size of every non-pinned texture currently resident. */
  readonly #resident = new Map<string, number>();
  /** Tick a key was last asked for, by *any* scene. Lower = colder = evicted first. */
  readonly #lastUsed = new Map<string, number>();
  #tick = 0;

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
    // Every request, hit or miss, marks the key as the newest tick — this is
    // the only signal eviction uses, so a key still being drawn is always the
    // last one evicted, never the first.
    this.#lastUsed.set(source.key, ++this.#tick);
    if (scene.textures.exists(source.key)) return source.key;
    if (this.#missing.has(source.key)) return null;

    if (!this.#requested.has(source.key)) {
      this.#requested.add(source.key);
      this.#pending.push(source);
    }
    // Also re-arms a flush whose scene closed before it ran: the work is still
    // pending, and this scene is alive to run it.
    if (this.#pending.length > 0) this.#schedule(scene);
    return null;
  }

  /** True when the server has said it has no scan for this key. */
  isMissing(key: string): boolean {
    return this.#missing.has(key);
  }

  /** Test/diagnostic hook: decoded bytes currently counted as resident. */
  residentBytes(): number {
    let total = 0;
    for (const bytes of this.#resident.values()) total += bytes;
    return total;
  }

  /**
   * One flush per frame. A board redraw asks for every visible card at once, so
   * batching keeps that to a single loader run.
   */
  #schedule(scene: Phaser.Scene): void {
    if (this.#flushScene) return;
    this.#flushScene = scene;
    // Hooked before the call is armed, so this scene's shutdown can release
    // the schedule even if it closes before the tick.
    this.#hook(scene);
    scene.time.delayedCall(0, () => {
      if (this.#flushScene !== scene) return;
      this.#flushScene = null;
      this.#flush(scene);
    });
  }

  #flush(scene: Phaser.Scene): void {
    const batch = this.#pending;
    this.#pending = [];
    if (batch.length === 0) return;

    for (const source of batch) {
      this.#inflight.set(source.key, scene);
      scene.load.image(source.key, source.url);
    }
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

    const onFile = (key: string): void => {
      this.#inflight.delete(key);
      this.#track(scene, key);
      this.#notify(scene);
    };
    // A 404 is the ordinary answer for a card with no scan, so it is recorded
    // rather than reported: the frame the board already drew is the fallback.
    const onError = (file: Phaser.Loader.File): void => {
      this.#inflight.delete(file.key);
      this.#missing.add(file.key);
      this.#notify(scene);
    };

    scene.load.on(FILE_COMPLETE, onFile);
    scene.load.on(FILE_LOAD_ERROR, onError);
    scene.events.once(SHUTDOWN, () => {
      scene.load.off(FILE_COMPLETE, onFile);
      scene.load.off(FILE_LOAD_ERROR, onError);
      this.#hooked.delete(scene);
      // The loader is reset with its scene, so whatever it still had will never
      // report back. Forget those keys were ever asked for; the next redraw
      // that wants one asks a live scene.
      for (const [key, owner] of this.#inflight) {
        if (owner !== scene) continue;
        this.#inflight.delete(key);
        this.#requested.delete(key);
      }
      if (this.#flushScene === scene) this.#flushScene = null;
      if (this.#notifyScene === scene) {
        this.#notifyScene = null;
        // The redraw this scene owed the others still has to happen.
        setTimeout(() => this.#fireListeners(), 0);
      }
    });
  }

  /**
   * Records a freshly-loaded texture's decoded size and sweeps the
   * least-recently-used ones out if that pushes residency over budget.
   */
  #track(scene: Phaser.Scene, key: string): void {
    if (PINNED_KEYS.has(key)) return;
    if (!scene.textures.exists(key)) return;
    const image = scene.textures.get(key).getSourceImage() as { width?: number; height?: number };
    const bytes = (image.width ?? 0) * (image.height ?? 0) * 4;
    this.#resident.set(key, bytes);
    this.#evict(scene);
  }

  /**
   * Removes the coldest non-pinned textures until residency is back under
   * budget. A removed key is also dropped from `#requested` so asking for it
   * again (the ordinary thing to happen the next time it's drawn) reloads it
   * rather than silently returning null forever.
   */
  #evict(scene: Phaser.Scene): void {
    if (this.residentBytes() <= RESIDENT_BUDGET_BYTES) return;
    const coldestFirst = [...this.#resident.keys()].sort(
      (a, b) => (this.#lastUsed.get(a) ?? 0) - (this.#lastUsed.get(b) ?? 0),
    );
    for (const key of coldestFirst) {
      if (this.residentBytes() <= RESIDENT_BUDGET_BYTES) break;
      this.#resident.delete(key);
      this.#lastUsed.delete(key);
      this.#requested.delete(key);
      if (scene.textures.exists(key)) scene.textures.remove(key);
    }
  }

  /**
   * Coalesces a run of arrivals into one redraw, so eight cards cost one pass. Over a window rather than a frame:
   * scans stream in across many frames, every listener rebuilds its whole screen, and one rebuild per frame for the
   * length of a download is what made a list of thumbnails (Rules reference, the roster) stutter on a tablet.
   */
  #notify(scene: Phaser.Scene): void {
    if (this.#notifyScene) return;
    this.#notifyScene = scene;
    scene.time.delayedCall(ARRIVAL_WINDOW_MS, () => {
      if (this.#notifyScene !== scene) return;
      this.#notifyScene = null;
      this.#fireListeners();
    });
  }

  #fireListeners(): void {
    for (const listener of [...this.#listeners]) listener();
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
