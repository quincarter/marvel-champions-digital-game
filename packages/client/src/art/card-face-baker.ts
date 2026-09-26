/**
 * Roster card faces as textures, baked off the main thread.
 *
 * `request(spec)` answers with a texture key when that exact face is already baked, and otherwise queues it and
 * answers null — the same "draw a placeholder now, redraw when it arrives" contract `art/card-art.ts` uses for scans.
 * Baking happens in `card-face.worker.ts`: the worker fetches the art, decodes it downscaled to the size the card
 * shows it at, lays out and paints the whole face on an `OffscreenCanvas`, and transfers back one `ImageBitmap`,
 * which becomes one texture. The main thread's share of a new card is that one upload.
 *
 * Where the worker can't bake (no `OffscreenCanvas`, or no fonts in workers — older WebKit, which Safari, the Tauri
 * shell on macOS and the iOS app all run), the same code (`card-face-bake.ts`) runs here instead. That is still far
 * cheaper than the game-object card it replaces: one canvas and one upload rather than one per label, measured
 * rather than re-rasterised while fitting, and the art still decoded by `createImageBitmap` rather than the loader.
 *
 * Faces are cached by spec, one texture each, under a byte budget: least recently requested first, and never one a
 * live image still shows (`hold`).
 */
import type Phaser from "phaser";

import { ArtBitmaps, bakeCardFace } from "./card-face-bake.js";
import { cardFaceKey, type CardFaceSpec } from "./card-face.js";
import type { CardFaceRequest, CardFaceResponse, FontSource } from "./card-face-protocol.js";

/** Decoded bytes of baked faces allowed resident. A desktop card at 2× is ~1.2 MB, so this holds about eighty. */
const FACE_BUDGET_BYTES = 96 * 1024 * 1024;
/** How long to wait for the worker to load its fonts before painting on the main thread instead. */
const READY_TIMEOUT_MS = 5000;
/** The font families a card face draws with; only their `@font-face` rules are sent to the worker. */
const FACE_FAMILIES: ReadonlySet<string> = new Set(["Bangers", "Public Sans"]);

interface Entry {
  readonly textureKey: string;
  state: "pending" | "ready" | "failed";
  bytes: number;
  lastUsed: number;
  holds: number;
  triedInline: boolean;
  readonly spec: CardFaceSpec;
}

type Mode = "starting" | "worker" | "inline";

const bakers = new WeakMap<Phaser.Game, CardFaceBaker>();

export function cardFaces(scene: Phaser.Scene): CardFaceBaker {
  let baker = bakers.get(scene.game);
  if (!baker) {
    baker = new CardFaceBaker(scene.game);
    bakers.set(scene.game, baker);
  }
  return baker;
}

export class CardFaceBaker {
  readonly #game: Phaser.Game;
  readonly #entries = new Map<string, Entry>();
  readonly #byTexture = new Map<string, Entry>();
  readonly #inflight = new Map<number, Entry>();
  readonly #listeners = new Set<() => void>();
  #mode: Mode = "starting";
  #worker: Worker | null = null;
  #waiting: Entry[] = [];
  #inlineArt: ArtBitmaps | null = null;
  #nextId = 1;
  #tick = 0;
  #notifyQueued = false;

  constructor(game: Phaser.Game) {
    this.#game = game;
    this.#start();
  }

  /** The texture key for `spec` if it's baked; otherwise null, and it's queued (once). */
  request(spec: CardFaceSpec): string | null {
    const specKey = cardFaceKey(spec);
    let entry = this.#entries.get(specKey);
    if (!entry) {
      entry = {
        textureKey: `card-face:${this.#nextId++}`,
        state: "pending",
        bytes: 0,
        lastUsed: 0,
        holds: 0,
        triedInline: false,
        spec,
      };
      this.#entries.set(specKey, entry);
      this.#byTexture.set(entry.textureKey, entry);
      this.#dispatch(entry);
    }
    entry.lastUsed = ++this.#tick;
    return entry.state === "ready" ? entry.textureKey : null;
  }

  /** Keeps `textureKey` from being evicted until `object` is destroyed. */
  hold(textureKey: string, object: Phaser.GameObjects.GameObject): void {
    const entry = this.#byTexture.get(textureKey);
    if (!entry) return;
    entry.holds++;
    object.once("destroy", () => {
      entry.holds--;
    });
  }

  /** Called (at most once a frame) after new faces arrive. Returns the unsubscribe. */
  onBaked(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Which thread paints — for diagnostics. */
  get mode(): Mode {
    return this.#mode;
  }

  #start(): void {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./card-face.worker.ts", import.meta.url), { type: "module", name: "mc-card-faces" });
    } catch (error) {
      this.#goInline(`no worker: ${String(error)}`);
      return;
    }
    this.#worker = worker;
    const timeout = setTimeout(() => {
      if (this.#mode === "starting") this.#goInline("the worker never became ready");
    }, READY_TIMEOUT_MS);
    worker.onmessage = (event: MessageEvent<CardFaceResponse>) => this.#onMessage(event.data, timeout);
    worker.onerror = (event) => {
      clearTimeout(timeout);
      this.#goInline(`worker error: ${event.message}`);
    };
    const message: CardFaceRequest = { type: "init", fonts: pageFontSources(FACE_FAMILIES) };
    worker.postMessage(message);
  }

  #onMessage(message: CardFaceResponse, timeout: ReturnType<typeof setTimeout>): void {
    if (message.type === "ready") {
      clearTimeout(timeout);
      if (!message.ok) {
        this.#goInline(message.reason ?? "the worker can't bake here");
        return;
      }
      if (this.#mode !== "starting") return;
      this.#mode = "worker";
      const waiting = this.#waiting;
      this.#waiting = [];
      for (const entry of waiting) this.#dispatch(entry);
      return;
    }
    const entry = this.#inflight.get(message.id);
    this.#inflight.delete(message.id);
    if (!entry) {
      if (message.type === "baked") message.bitmap.close();
      return;
    }
    if (message.type === "baked") this.#accept(entry, message.bitmap);
    else this.#bakeInline(entry);
  }

  /** Stops using the worker; everything it was asked for is painted here instead. */
  #goInline(reason: string): void {
    if (this.#mode === "inline") return;
    // Worth knowing when a device scrolls worse than expected; says nothing when the worker is doing its job.
    console.info(`Card faces: painting on the main thread (${reason}).`);
    this.#mode = "inline";
    this.#worker?.terminate();
    this.#worker = null;
    const orphans = [...this.#waiting, ...this.#inflight.values()];
    this.#waiting = [];
    this.#inflight.clear();
    for (const entry of orphans) this.#bakeInline(entry);
  }

  #dispatch(entry: Entry): void {
    if (this.#mode === "starting") {
      this.#waiting.push(entry);
      return;
    }
    if (this.#mode === "inline" || !this.#worker) {
      this.#bakeInline(entry);
      return;
    }
    const id = this.#nextId++;
    this.#inflight.set(id, entry);
    const message: CardFaceRequest = { type: "bake", id, spec: entry.spec };
    this.#worker.postMessage(message);
  }

  #bakeInline(entry: Entry): void {
    if (entry.triedInline) {
      entry.state = "failed";
      return;
    }
    entry.triedInline = true;
    this.#inlineArt ??= new ArtBitmaps();
    bakeCardFace(entry.spec, this.#inlineArt).then(
      (bitmap) => this.#accept(entry, bitmap),
      () => {
        entry.state = "failed";
      },
    );
  }

  #accept(entry: Entry, bitmap: ImageBitmap): void {
    // Evicted while it was baking: nobody is waiting on this one any more.
    if (this.#byTexture.get(entry.textureKey) !== entry) {
      bitmap.close();
      return;
    }
    const textures = this.#game.textures;
    if (textures.exists(entry.textureKey)) textures.remove(entry.textureKey);
    textures.addImage(entry.textureKey, canvasOf(bitmap) as unknown as HTMLImageElement);
    entry.state = "ready";
    entry.bytes = bitmap.width * bitmap.height * 4;
    this.#evict();
    this.#queueNotify();
  }

  #evict(): void {
    let total = 0;
    for (const entry of this.#entries.values()) total += entry.bytes;
    if (total <= FACE_BUDGET_BYTES) return;
    const coldestFirst = [...this.#entries.entries()]
      .filter(([, entry]) => entry.state === "ready" && entry.holds <= 0)
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);
    for (const [specKey, entry] of coldestFirst) {
      if (total <= FACE_BUDGET_BYTES) break;
      total -= entry.bytes;
      this.#entries.delete(specKey);
      this.#byTexture.delete(entry.textureKey);
      const textures = this.#game.textures;
      if (textures.exists(entry.textureKey)) {
        const source = textures.get(entry.textureKey).getSourceImage() as unknown as HTMLCanvasElement;
        textures.remove(entry.textureKey);
        // Releases the canvas's backing store now rather than whenever it is collected.
        source.width = 0;
        source.height = 0;
      }
    }
  }

  #queueNotify(): void {
    if (this.#notifyQueued) return;
    this.#notifyQueued = true;
    requestAnimationFrame(() => {
      this.#notifyQueued = false;
      for (const listener of [...this.#listeners]) listener();
    });
  }
}

/**
 * The bitmap as a canvas, which is what Phaser is handed. Not the `ImageBitmap` itself: WebGL ignores
 * `UNPACK_FLIP_Y_WEBGL` for an `ImageBitmap`, and Phaser flips every texture it uploads, so a bitmap came out upside
 * down. A `bitmaprenderer` canvas takes the bitmap over without copying it and uploads like any other canvas.
 */
function canvasOf(bitmap: ImageBitmap): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const renderer = canvas.getContext("bitmaprenderer");
  if (renderer) {
    renderer.transferFromImageBitmap(bitmap);
    return canvas;
  }
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

/**
 * The page's own `@font-face` rules for `families`, with every `url(…)` made absolute against the stylesheet that
 * declared it — whatever Vite emitted, in dev (inline `<style>`) or a build (hashed files), with nothing to keep in
 * step by hand.
 */
function pageFontSources(families: ReadonlySet<string>): FontSource[] {
  const sources: FontSource[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    const base = sheet.href ?? document.baseURI;
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const style = rule.style;
      const family = style
        .getPropertyValue("font-family")
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!families.has(family)) continue;
      const src = style
        .getPropertyValue("src")
        .replace(
          /url\(\s*(["']?)([^"')]+)\1\s*\)/g,
          (_, _quote: string, url: string) => `url("${new URL(url, base).href}")`,
        );
      const descriptors: FontFaceDescriptors = {};
      const weight = style.getPropertyValue("font-weight").trim();
      const fontStyle = style.getPropertyValue("font-style").trim();
      const unicodeRange = style.getPropertyValue("unicode-range").trim();
      if (weight) descriptors.weight = weight;
      if (fontStyle) descriptors.style = fontStyle;
      if (unicodeRange) descriptors.unicodeRange = unicodeRange;
      sources.push({ family, src, descriptors });
    }
  }
  return sources;
}
