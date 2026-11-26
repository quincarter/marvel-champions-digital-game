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
 * rather than re-rasterized while fitting, and the art still decoded by `createImageBitmap` rather than the loader.
 *
 * Requests are not all started at once: they wait in a priority queue (`bake-queue.ts`) and at most `IN_FLIGHT` are
 * being baked at a time, in either mode, so a screenful of tiles doesn't decode every picture together and an
 * on-screen tile doesn't wait behind overscan. A caller that knows where a tile is (the shelf roster) wraps its draw
 * in `track`, gets tickets for the faces still baking, re-prioritises them as the view scrolls and releases them when
 * the tile goes; a face nobody holds a ticket for and that has not started is dropped, never baked.
 *
 * Faces are cached by spec, one texture each, under a byte budget: least recently requested first, and never one a
 * live image still shows (`hold`).
 */
import type Phaser from "phaser";

import { BakeQueue } from "./bake-queue.js";
import { canvasOf } from "./bitmap-canvas.js";
import { ArtBitmaps, bakeCardFace } from "./card-face-bake.js";
import { cardFaceKey, type CardFaceSpec } from "./card-face.js";
import type { CardFaceRequest, CardFaceResponse, FontSource } from "./card-face-protocol.js";
import { faceBudgetBytes } from "./memory-budget.js";
import { WorkerCrashGuard } from "../platform/worker-crash-guard.js";

/** Decoded bytes of baked faces allowed resident: 96 MB, half that on iOS (`memory-budget.ts`, #871). */
const FACE_BUDGET_BYTES = faceBudgetBytes();
/** Faces being baked at once (in the worker, or inline on the main thread). */
export const IN_FLIGHT = 2;
/** The priority of a request made outside `track`: as if on screen. */
const DEFAULT_PRIORITY = 0;
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
  /** Accepted or requested since the last `onBaked` notice: its scene hasn't drawn and held it yet. */
  fresh: boolean;
  triedInline: boolean;
  /** Handed to the worker or the inline baker: no longer cancellable. */
  started: boolean;
  /** Lower bakes sooner (`BakeQueue`). */
  priority: number;
  /** Tracked requests still wanting this face (`track`); a queued face with none left is dropped. */
  waiters: number;
  /** Asked for outside `track`: nobody holds a ticket for it, so `release` never drops it. */
  pinned: boolean;
  /** The worker failed it: it is baked on this thread, whatever the mode, once. */
  forceInline: boolean;
  readonly spec: CardFaceSpec;
}

/** A pending face a tracked request is waiting on (`CardFaceBaker.track`). */
export type FaceTicket = object;

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
  readonly #queue = new BakeQueue<Entry>(IN_FLIGHT);
  #context: { priority: number; tickets: Entry[] } | null = null;
  #inlineArt: ArtBitmaps | null = null;
  #nextId = 1;
  #tick = 0;
  #notifyQueued = false;
  /** Skips the worker after a start that crashed the page (`platform/worker-crash-guard.ts`, #932). */
  readonly #guard = new WorkerCrashGuard("card-faces");

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
        fresh: true,
        triedInline: false,
        started: false,
        priority: DEFAULT_PRIORITY,
        waiters: 0,
        pinned: false,
        forceInline: false,
        spec,
      };
      this.#entries.set(specKey, entry);
      this.#byTexture.set(entry.textureKey, entry);
    }
    entry.lastUsed = ++this.#tick;
    entry.fresh = true;
    if (entry.state === "ready") return entry.textureKey;
    if (entry.state === "pending") {
      const context = this.#context;
      if (!context) entry.pinned = true;
      if (context) {
        entry.waiters++;
        context.tickets.push(entry);
      }
      if (!entry.started) {
        // An untracked asker wants it as if on screen; when wants meet, the most urgent one sets the order.
        const asked = context ? context.priority : DEFAULT_PRIORITY;
        if (this.#queue.has(entry)) this.#setPriority(entry, Math.min(entry.priority, asked));
        else {
          entry.priority = asked;
          this.#queue.enqueue(entry, asked);
          this.#pump();
        }
      }
    }
    return null;
  }

  /**
   * Runs `draw` (which makes `request` calls), queueing every face it leaves baking at `priority` and returning
   * tickets for them; `reprioritize` and `release` take those tickets.
   */
  track<R>(priority: number, draw: () => R): { readonly result: R; readonly tickets: FaceTicket[] } {
    const outer = this.#context;
    const context = { priority, tickets: [] as Entry[] };
    this.#context = context;
    try {
      return { result: draw(), tickets: context.tickets };
    } finally {
      this.#context = outer;
    }
  }

  /** Moves the faces behind `tickets` that have not started baking to `priority` (lower bakes sooner). */
  reprioritize(tickets: readonly FaceTicket[], priority: number): void {
    for (const ticket of tickets) this.#setPriority(ticket as Entry, priority);
  }

  /** The tile behind `tickets` is gone: a face nobody else wants and not yet started is never baked. */
  release(tickets: readonly FaceTicket[]): void {
    for (const ticket of tickets) {
      const entry = ticket as Entry;
      entry.waiters = Math.max(0, entry.waiters - 1);
      if (entry.waiters > 0 || entry.pinned || !this.#queue.remove(entry)) continue;
      this.#entries.delete(cardFaceKey(entry.spec));
      this.#byTexture.delete(entry.textureKey);
    }
  }

  /** How many faces wait for a free slot; for diagnostics and tests. */
  get queued(): number {
    return this.#queue.size;
  }

  #setPriority(entry: Entry, priority: number): void {
    // A face an untracked caller wants is never ranked below on screen.
    if (entry.pinned) priority = Math.min(priority, DEFAULT_PRIORITY);
    entry.priority = priority;
    this.#queue.reprioritize(entry, priority);
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
    if (this.#guard.skip()) {
      this.#goInline("the last start crashed with the worker");
      return;
    }
    let worker: Worker;
    try {
      this.#guard.starting();
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
      this.#pump();
      return;
    }
    // A face came back (baked or not): the worker lived through that job.
    this.#guard.answered();
    const entry = this.#inflight.get(message.id);
    this.#inflight.delete(message.id);
    if (!entry) {
      if (message.type === "baked") message.bitmap.close();
      return;
    }
    this.#queue.done();
    if (message.type === "baked") this.#accept(entry, message.bitmap);
    else this.#retryInline(entry);
    this.#pump();
  }

  /** Stops using the worker; everything it was asked for is painted here instead. */
  #goInline(reason: string): void {
    if (this.#mode === "inline") return;
    // The page saw the worker stop (or never start it): not the crash the guard watches for.
    this.#guard.settled();
    // Worth knowing when a device scrolls worse than expected; says nothing when the worker is doing its job.
    console.info(`Card faces: painting on the main thread (${reason}).`);
    this.#mode = "inline";
    this.#worker?.terminate();
    this.#worker = null;
    // What the worker was baking is baked again here, ahead of what is still waiting.
    const orphans = [...this.#inflight.values()];
    this.#inflight.clear();
    this.#queue.clearInFlight();
    for (const entry of orphans) this.#requeueFirst(entry);
    this.#pump();
  }

  #requeueFirst(entry: Entry): void {
    entry.started = false;
    entry.priority = -1;
    this.#queue.enqueue(entry, -1);
  }

  /** Starts queued faces while there is a free slot; waits out `starting` (the worker's first reply). */
  #pump(): void {
    if (this.#mode === "starting") return;
    for (let entry = this.#queue.next(); entry; entry = this.#queue.next()) {
      entry.started = true;
      if (this.#mode === "inline" || !this.#worker || entry.forceInline) {
        this.#bakeInline(entry);
        continue;
      }
      const id = this.#nextId++;
      this.#inflight.set(id, entry);
      const message: CardFaceRequest = { type: "bake", id, spec: entry.spec };
      this.#guard.working();
      this.#worker.postMessage(message);
    }
  }

  /** The worker couldn't bake this one: once more here, in a slot of its own. */
  #retryInline(entry: Entry): void {
    if (entry.triedInline) {
      entry.state = "failed";
      return;
    }
    entry.forceInline = true;
    this.#requeueFirst(entry);
  }

  /** Bakes on this thread in a slot the caller took from the queue, given back when it is done. */
  #bakeInline(entry: Entry): void {
    if (entry.triedInline) {
      entry.state = "failed";
      this.#queue.done();
      return;
    }
    entry.triedInline = true;
    this.#inlineArt ??= new ArtBitmaps();
    bakeCardFace(entry.spec, this.#inlineArt)
      .then(
        (bitmap) => this.#accept(entry, bitmap),
        () => {
          entry.state = "failed";
        },
      )
      .finally(() => {
        this.#queue.done();
        this.#pump();
      });
  }

  #accept(entry: Entry, bitmap: ImageBitmap): void {
    // Evicted while it was baking: nobody is waiting on this one any more.
    if (this.#byTexture.get(entry.textureKey) !== entry) {
      bitmap.close();
      return;
    }
    const textures = this.#game.textures;
    if (textures.exists(entry.textureKey)) textures.remove(entry.textureKey);
    // Read the size first: handing the bitmap to a canvas detaches it, and its width and height read 0 afterwards, which
    // left every face counting as 0 bytes and the budget below never evicting anything.
    const bytes = bitmap.width * bitmap.height * 4;
    textures.addImage(entry.textureKey, canvasOf(bitmap) as unknown as HTMLImageElement);
    entry.state = "ready";
    entry.bytes = bytes;
    this.#evict();
    this.#queueNotify();
  }

  #evict(): void {
    let total = 0;
    for (const entry of this.#entries.values()) total += entry.bytes;
    if (total <= FACE_BUDGET_BYTES) return;
    const coldestFirst = [...this.#entries.entries()]
      // Held faces stay, and so do ones asked for or just baked and not yet drawn (they'd be re-baked at once, forever);
      // if nothing else is left the cache runs over budget.
      .filter(([, entry]) => entry.state === "ready" && entry.holds <= 0 && !entry.fresh)
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
      for (const entry of this.#entries.values()) entry.fresh = false;
      for (const listener of [...this.#listeners]) listener();
    });
  }
}

/**
 * The page's own `@font-face` rules for `families`, with every `url(…)` made absolute against the stylesheet that
 * declared it — whatever Vite emitted, in dev (inline `<style>`) or a build (hashed files), with nothing to keep in
 * step by hand. A font the build inlined as a `data:` URL goes as its bytes (`inlineFontBytes`).
 */
export function pageFontSources(families: ReadonlySet<string>): FontSource[] {
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
      sources.push({ family, src: inlineFontBytes(src) ?? src, descriptors });
    }
  }
  return sources;
}

/**
 * The bytes of a `src` that is one inline `data:` font (`url("data:font/woff2;base64,…") format("woff2")`), or null.
 * Vite inlines small fonts in a build (Bangers' 7, `fonts/bangers-seven.css`, is 2.6 KB), and WebView2 158 crashes the
 * whole page (STATUS_BREAKPOINT) when a worker's `FontFace` loads a `data:` URL (#932); bytes load fine everywhere.
 */
export function inlineFontBytes(src: string): ArrayBuffer | null {
  const match = /^\s*url\(\s*(["']?)(data:[^"')]*)\1\s*\)(?:\s+format\([^)]*\))?\s*$/i.exec(src);
  if (!match) return null;
  const url = match[2]!;
  const comma = url.indexOf(",");
  if (comma < 0) return null;
  const meta = url.slice(5, comma);
  const payload = url.slice(comma + 1);
  try {
    if (/;base64$/i.test(meta)) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }
    // Percent-encoded: each %XX is one byte (not UTF-8 text), every other character its own code.
    const bytes: number[] = [];
    for (let i = 0; i < payload.length; i++) {
      if (payload[i] === "%" && /^[0-9a-f]{2}$/i.test(payload.slice(i + 1, i + 3))) {
        bytes.push(parseInt(payload.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(payload.charCodeAt(i) & 0xff);
      }
    }
    return new Uint8Array(bytes).buffer;
  } catch {
    return null;
  }
}
