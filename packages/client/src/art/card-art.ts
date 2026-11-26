/**
 * Loading and drawing card scans.
 *
 * Art is fetched **lazily, per card, as the table asks for it** rather than in
 * one per-scenario batch. A Core scenario touches a few hundred cards, and a
 * preload of all of them would put a progress bar in front of a game that only
 * ever shows a dozen at once. The board draws its frame immediately, the scan
 * arrives, and the board redraws — which is also the honest behavior when a
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
import { onArtChange, onLanguageChange } from "../language-change.js";
import { currentPackArt, releasePackArt } from "./pack-art.js";
import { artBudgetBytes } from "./memory-budget.js";
import { decodedBakedPicture } from "./picture-bake-client.js";
import type { Size } from "./grayscale.js";
import { currentRenderScale } from "../ui/render-scale.js";

/**
 * Textures live on the game, not the scene, so this cache does too: one per
 * `Phaser.Game`, shared by the board and every overlay above it.
 */
const caches = new WeakMap<Phaser.Game, CardArt>();

/**
 * Decoded bytes allowed resident at once. ~256 MB comfortably holds a full
 * board plus an open overlay while keeping a long or repeated session from
 * climbing toward the gigabytes that crashed a real game. Half that on iOS
 * and in the WebKit desktop apps (`memory-budget.ts`, #871).
 */
const RESIDENT_BUDGET_BYTES = artBudgetBytes();

/**
 * The three card backs are requested constantly (every hidden card in every
 * hand/deck/discard) and are cheap relative to the budget, so they are kept
 * out of eviction accounting entirely rather than fought over with the LRU
 * sweep on every redraw.
 */
const PINNED_KEYS: ReadonlySet<string> = new Set(Object.values(CARD_BACKS).map((back) => back.key));

/**
 * The share of the screen's height the biggest card on a table takes (the villain, an identity, the main scheme), which
 * is the height a scan is decoded to for the table. A scan is 900 pixels tall; a table card on a laptop is 200 to 300.
 * Decoding every scan at full size kept three to five times the pixels any table card shows, and in the WebKit apps
 * (the Mac and Linux desktop builds) each kept scan also costs a decoded copy beside its texture: a long game climbed
 * ~180 MB a round. A card drawn bigger than this (the hover preview, Inspect) gets the full scan, `upgrade` below.
 */
const TABLE_SHARE = 0.34;
/** Never decoded smaller than this, whatever the window: a phone or a small window still shows crisp cards. */
const MIN_TABLE_HEIGHT = 360;
/** A slot this much taller than the table copy is still drawn from it: a few percent of upscaling doesn't show. */
const UPGRADE_SLACK = 1.12;
/**
 * The full copy's size: the scan's own (`bakedSizeOf` never scales up; a scan is 900 pixels tall), but never taller
 * than this, so one oversized picture can't take a large share of the budget and evict its own table copy.
 */
const FULL_SLOT: Size = { width: 1, height: 1400 };
const FULL_SUFFIX = "#full";
/** The full-size copy's texture key, beside the table copy (which keeps the source's own key). */
const fullKeyOf = (key: string): string => `${key}${FULL_SUFFIX}`;
/** Decodes running at once. A cold screen asks for dozens of scans; each decode holds the whole scan while it runs. */
const MAX_DECODES = 4;

interface DecodeJob {
  readonly textures: Phaser.Textures.TextureManager;
  readonly key: string;
  readonly url: string;
  readonly slot: Size;
}

/** Fetches and decodes `url` no larger than `slot` (off the main thread where it can), or null for a missing scan. */
export type ScanDecoder = (url: string, slot: Size) => Promise<HTMLCanvasElement | null>;

export interface CardArtDeps {
  readonly decode?: ScanDecoder;
  readonly budgetBytes?: number;
  /** Device pixels per game unit, read at each draw (Settings > Resolution, the display's scale). */
  readonly renderScale?: () => number;
}

export function cardArt(scene: Phaser.Scene): CardArt {
  const existing = caches.get(scene.game);
  if (existing) return existing;
  const created = new CardArt();
  caches.set(scene.game, created);
  // A new card language (`Settings.cardLanguage`) gives every face a new texture key: redraw, and the screens ask anew.
  onLanguageChange(() => created.redrawAll());
  // An installed pack's pictures arriving redraws the screens showing art, nothing more.
  onArtChange(() => created.redrawAll());
  return created;
}

/** How long arrivals are gathered before the screens showing them redraw. Short enough to read as "the art popped in". */
const ARRIVAL_WINDOW_MS = 120;

/** Why `CardArt.onArrived` listeners are called: scans landed, or every face may have a new source. */
export type ArtRedraw = "arrival" | "all";

/**
 * What this cache tracks is deliberately *not* "has this scan arrived" — the
 * texture manager already knows that, and a second answer to the same question
 * is a second answer that can be wrong. So the texture manager decides what can
 * be drawn, and this class only remembers what it alone knows: what has already
 * been asked for (don't ask twice), what came back 404 (don't ask again, ever),
 * and which keys are table copies with a full-size copy to be had.
 *
 * Scans are decoded by `picture-bake-client.ts` (in the picture-bake worker where
 * there is one) rather than by Phaser's loader: the decode is scaled to the size
 * the table needs, and the main thread only uploads the result. Textures belong to
 * the game, so a scan that lands after the scene that asked for it closed is kept
 * like any other.
 */
export class CardArt {
  /** Keys asked for and not yet answered (or answered and resident). One scan is fetched once. */
  readonly #requested = new Set<string>();
  /** Keys the server has no scan for. The generated frame is the answer for these. */
  readonly #missing = new Set<string>();
  readonly #listeners = new Set<(why: ArtRedraw) => void>();
  /** The source behind each table copy, so `upgrade` can fetch its full-size copy. */
  readonly #sources = new Map<string, ArtSource>();
  /** Decoded byte size of every non-pinned texture currently resident. */
  readonly #resident = new Map<string, number>();
  /** Tick a key was last asked for, by *any* scene. Lower = colder = evicted first. */
  readonly #lastUsed = new Map<string, number>();
  #tick = 0;
  #notifyTimer: ReturnType<typeof setTimeout> | null = null;
  /** Decodes waiting for a free slot, oldest first. */
  #queue: DecodeJob[] = [];
  #decoding = 0;
  /** Decodes running or queued, by url: a pack picture's blob: URL is not revoked while one still reads it. */
  readonly #urlsInUse = new Map<string, number>();
  /** Evicted pack pictures whose URL a decode still reads, by url: revoked once it settles. */
  readonly #revokeLater = new Map<string, string>();
  /** A scan's own height once a full copy has been decoded, by url: no full copy is asked for a table copy as tall. */
  readonly #nativeHeight = new Map<string, number>();
  readonly #decode: ScanDecoder;
  readonly #budget: number;
  readonly #renderScale: () => number;

  constructor(deps: CardArtDeps = {}) {
    this.#decode = deps.decode ?? ((url, slot) => decodedBakedPicture(url, slot, false));
    this.#budget = deps.budgetBytes ?? RESIDENT_BUDGET_BYTES;
    this.#renderScale = deps.renderScale ?? currentRenderScale;
  }

  /**
   * Called when art arrives, so the board can redraw with it. `why` is "arrival" for scans landing, and "all" when
   * every face may have a new source (a card language switch, a pack's pictures): a screen that fills tiles in place
   * (`art/art-slot.ts`) draws itself again for "all", since its tiles were drawn from the old sources.
   */
  onArrived(listener: (why: ArtRedraw) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * The texture key if the scan is on hand, else null — and the scan is asked
   * for. Callers draw their frame either way and get a redraw later. The key is
   * the table copy's; `drawArt` swaps in the full-size copy for a slot that
   * needs it.
   */
  request(scene: Phaser.Scene, held: ArtSource | null): string | null {
    if (!held) return null;
    // A source held across an eviction (a slot, a pane) may carry a blob URL revoked since: resolve it at request time.
    // Null while the fresh URL is being read from the store (the art change announced then redraws).
    const source = currentPackArt(held);
    if (!source) return null;
    // Every request, hit or miss, marks the key as the newest tick — this is
    // the only signal eviction uses, so a key still being drawn is always the
    // last one evicted, never the first.
    this.#lastUsed.set(source.key, ++this.#tick);
    if (scene.textures.exists(source.key)) {
      this.#sources.set(source.key, source);
      return source.key;
    }
    // The full-size copy alone (its table copy evicted to make room for it) draws a table slot just as well, and
    // loading the table copy again would only evict the full one in turn.
    const full = fullKeyOf(source.key);
    if (scene.textures.exists(full)) {
      this.#lastUsed.set(full, this.#tick);
      this.#sources.set(source.key, source);
      return full;
    }
    if (this.#missing.has(source.key)) return null;
    this.#sources.set(source.key, source);
    this.#load(scene.textures, source.key, source.url, this.#tableSlot(scene));
    return null;
  }

  /**
   * The key to draw `key` from in a slot `slotHeight` game units tall: the table
   * copy while it is big enough for the slot, else the full-size copy once it
   * has arrived (asked for here, and the screens redraw when it lands). Any key
   * this cache did not load is its own answer.
   */
  upgrade(scene: Phaser.Scene, key: string, slotHeight: number): string {
    if (key.endsWith(FULL_SUFFIX)) return key;
    const held = this.#sources.get(key);
    if (!held || !scene.textures.exists(key)) return key;
    // The remembered source may carry a URL revoked since its table copy loaded.
    const source = currentPackArt(held);
    if (!source) return key;
    this.#sources.set(key, source);
    const height = scene.textures.get(key).getSourceImage().height;
    if (!height || slotHeight * this.#renderScale() <= height * UPGRADE_SLACK) return key;
    // The scan itself is no taller than the table copy (a small scan, or a big window): nothing better to fetch.
    const native = this.#nativeHeight.get(source.url);
    if (native !== undefined && native <= height) return key;
    const full = fullKeyOf(key);
    // Both copies are in use: the table copy must not be the one evicted to make room for the full one.
    this.#lastUsed.set(full, ++this.#tick);
    this.#lastUsed.set(key, this.#tick);
    if (scene.textures.exists(full)) return full;
    this.#load(scene.textures, full, source.url, FULL_SLOT);
    return key;
  }

  /**
   * The full-size copy's key while it is on its way for a slot that `upgrade` found too big for the table copy `key`,
   * else null: a screen that draws only on arrivals it waits for (the hover preview) waits for this one too.
   */
  fullOnTheWay(key: string): string | null {
    const full = fullKeyOf(key);
    return this.#requested.has(full) && !this.#resident.has(full) ? full : null;
  }

  /** Tells every screen showing art to redraw, as an arrival does (a card language switch). */
  redrawAll(): void {
    this.#fireListeners("all");
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

  /** Test/diagnostic hook: decodes running now, and sources remembered. */
  get stats(): { readonly decoding: number; readonly queued: number; readonly sources: number } {
    return { decoding: this.#decoding, queued: this.#queue.length, sources: this.#sources.size };
  }

  /** The table copy's size: a share of the screen's height in device pixels, never below a floor. */
  #tableSlot(scene: Phaser.Scene): Size {
    const screen = (scene.scale?.height ?? 0) * this.#renderScale();
    return { width: 1, height: Math.max(MIN_TABLE_HEIGHT, Math.round(screen * TABLE_SHARE)) };
  }

  /** Queues a decode; at most `MAX_DECODES` run at once, so a cold screen of new cards doesn't decode them all at once. */
  #load(textures: Phaser.Textures.TextureManager, key: string, url: string, slot: Size): void {
    if (this.#requested.has(key)) return;
    this.#requested.add(key);
    this.#queue.push({ textures, key, url, slot });
    this.#pump();
  }

  #pump(): void {
    while (this.#decoding < MAX_DECODES) {
      const job = this.#queue.shift();
      if (!job) return;
      // A pack picture released (evicted) while this job waited has a revoked URL: decoding it would fail and mark
      // the picture missing. Forget the ask; the next draw resolves the fresh URL through `request`.
      const table = job.key.endsWith(FULL_SUFFIX) ? job.key.slice(0, -FULL_SUFFIX.length) : job.key;
      if (currentPackArt({ key: table, url: job.url })?.url !== job.url) {
        this.#requested.delete(job.key);
        continue;
      }
      this.#decoding++;
      this.#urlsInUse.set(job.url, (this.#urlsInUse.get(job.url) ?? 0) + 1);
      this.#decode(job.url, job.slot)
        .then(
          (canvas) => this.#landed(job, canvas),
          // A decode that threw (no answer at all): forget it was asked for, so the next draw asks again.
          () => this.#requested.delete(job.key),
        )
        .finally(() => {
          this.#decoding--;
          const left = (this.#urlsInUse.get(job.url) ?? 1) - 1;
          if (left > 0) this.#urlsInUse.set(job.url, left);
          else {
            this.#urlsInUse.delete(job.url);
            // An evicted pack picture's blob: URL waited for this decode before it was revoked.
            const revoke = this.#revokeLater.get(job.url);
            if (revoke !== undefined) {
              this.#revokeLater.delete(job.url);
              releasePackArt(revoke);
            }
          }
          this.#pump();
        });
    }
  }

  #landed(job: DecodeJob, canvas: HTMLCanvasElement | null): void {
    const { textures, key } = job;
    const full = key.endsWith(FULL_SUFFIX);
    if (!canvas) {
      // No table copy is a missing scan. A full copy that failed after its table copy loaded is not (its pack URL may
      // have been revoked by an eviction meanwhile): forget it was asked for, and the next hover asks again.
      if (full) this.#requested.delete(key);
      else this.#missing.add(key);
    } else if (full && this.#tableCovers(textures, key, canvas.height)) {
      // The scan is no taller than its table copy: not kept, and not fetched again while the table copy is this size.
      this.#nativeHeight.set(job.url, canvas.height);
      this.#requested.delete(key);
      canvas.width = 0;
      canvas.height = 0;
    } else if (!this.#requested.has(key) || textures.exists(key)) {
      canvas.width = 0;
      canvas.height = 0;
    } else {
      if (full) this.#nativeHeight.set(job.url, canvas.height);
      textures.addImage(key, canvas as unknown as HTMLImageElement);
      this.#track(textures, key);
    }
    this.#notify();
  }

  /** Whether the table copy of a full key is already as tall as the full scan turned out to be. */
  #tableCovers(textures: Phaser.Textures.TextureManager, key: string, height: number): boolean {
    const table = key.slice(0, -FULL_SUFFIX.length);
    return textures.exists(table) && textures.get(table).getSourceImage().height >= height;
  }

  /**
   * Records a freshly-loaded texture's decoded size and sweeps the
   * least-recently-used ones out if that pushes residency over budget.
   */
  #track(textures: Phaser.Textures.TextureManager, key: string): void {
    if (PINNED_KEYS.has(key)) return;
    if (!textures.exists(key)) return;
    const image = textures.get(key).getSourceImage() as { width?: number; height?: number };
    const bytes = (image.width ?? 0) * (image.height ?? 0) * 4;
    this.#resident.set(key, bytes);
    this.#evict(textures);
  }

  /**
   * Removes the coldest non-pinned textures until residency is back under
   * budget. A removed key is also dropped from `#requested` so asking for it
   * again (the ordinary thing to happen the next time it's drawn) reloads it
   * rather than silently returning null forever.
   */
  #evict(textures: Phaser.Textures.TextureManager): void {
    if (this.residentBytes() <= this.#budget) return;
    const coldestFirst = [...this.#resident.keys()].sort(
      (a, b) => (this.#lastUsed.get(a) ?? 0) - (this.#lastUsed.get(b) ?? 0),
    );
    for (const key of coldestFirst) {
      if (this.residentBytes() <= this.#budget) break;
      this.#resident.delete(key);
      this.#lastUsed.delete(key);
      this.#requested.delete(key);
      if (textures.exists(key)) {
        const source = textures.get(key).getSourceImage() as unknown as { width?: number; height?: number };
        textures.remove(key);
        // The decoded copy goes with the texture now, not whenever the collector gets to the canvas: an evicted
        // scan's pixels otherwise outlived it in the WebKit apps.
        if (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) {
          source.width = 0;
          source.height = 0;
        }
      }
      const table = key.endsWith(FULL_SUFFIX) ? key.slice(0, -FULL_SUFFIX.length) : key;
      const url = this.#sources.get(table)?.url;
      // The source stays while either copy is resident or wanted; past that a redraw that wants it hands it over again.
      if (!textures.exists(table) && !textures.exists(fullKeyOf(table)) && !this.#requested.has(table)) {
        this.#sources.delete(table);
        if (url !== undefined) this.#nativeHeight.delete(url);
      }
      if (key.endsWith(FULL_SUFFIX)) continue;
      // A pack picture was loaded from a blob: URL; revoke it (a later ask reads the store again), once no decode
      // still reads it (a full copy on its way).
      if (url !== undefined && this.#urlsInUse.has(url)) this.#revokeLater.set(url, key);
      else releasePackArt(key);
    }
  }

  /**
   * Coalesces a run of arrivals into one redraw, so eight cards cost one pass. Over a window rather than a frame:
   * scans stream in across many frames, every listener rebuilds its whole screen, and one rebuild per frame for the
   * length of a download is what made a list of thumbnails (Rules reference, the roster) stutter on a tablet.
   */
  #notify(): void {
    if (this.#notifyTimer !== null) return;
    this.#notifyTimer = setTimeout(() => {
      this.#notifyTimer = null;
      this.#fireListeners();
    }, ARRIVAL_WINDOW_MS);
  }

  #fireListeners(why: ArtRedraw = "arrival"): void {
    for (const listener of [...this.#listeners]) listener(why);
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
 *
 * A scan is kept at the size the table needs (`CardArt`); a slot bigger than
 * that (the hover preview, Inspect) is drawn from the full-size scan once it
 * arrives, and from the table copy until then.
 */
export function drawArt(
  scene: Phaser.Scene,
  given: string | null,
  rect: Rect,
  options: DrawArtOptions = {},
): Phaser.GameObjects.Image | null {
  if (!given || !scene.textures.exists(given)) return null;
  const fit = options.fit ?? "contain";
  const fitScale = (width: number, height: number): number =>
    fit === "cover"
      ? Math.max(rect.width / width, rect.height / height)
      : Math.min(rect.width / width, rect.height / height);
  const table = scene.textures.get(given).getSourceImage();
  if (!table.width || !table.height) return null;
  const key = cardArt(scene).upgrade(scene, given, table.height * fitScale(table.width, table.height));
  const size = key === given ? table : scene.textures.get(key).getSourceImage();
  const sourceWidth = size.width;
  const sourceHeight = size.height;
  if (!sourceWidth || !sourceHeight) return null;

  const scale = fitScale(sourceWidth, sourceHeight);

  const image = scene.add
    .image(0, 0, key)
    .setOrigin(0, 0)
    .setScale(scale)
    .setAlpha(options.alpha ?? 1);

  if (fit === "contain") {
    // Centered in the slot, whole card visible.
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
