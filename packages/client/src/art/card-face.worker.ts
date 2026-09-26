/**
 * The card-face worker (`card-face-baker.ts` owns it): bakes roster card faces off the main thread. Fetching,
 * decoding and downscaling the art, laying out and painting the text, and encoding the result as an `ImageBitmap`
 * all happen here; the main thread only uploads the one finished bitmap as a texture.
 *
 * It needs the app's fonts, which a worker doesn't share with the page: `init` carries the page's own `@font-face`
 * sources (read from its stylesheets, so they are whatever Vite emitted), and they are loaded here before anything
 * is painted. A worker that can't do any of that (no `OffscreenCanvas` 2D, no `self.fonts`) says so in its `ready`
 * reply, and the baker paints on the main thread instead.
 *
 * Requests are served newest first: while a shelf is flung past, the cards now on screen are the ones worth having
 * soonest, not the ones that scrolled away.
 */
import { ArtBitmaps, bakeCardFace } from "./card-face-bake.js";
import type { CardFaceRequest, CardFaceResponse, FontSource } from "./card-face-protocol.js";
import type { CardFaceSpec } from "./card-face.js";

/**
 * The client compiles with the DOM lib and `lib.webworker.d.ts` can't be added alongside it (`engine.worker.ts` has
 * the same note), so this names the members of the worker global actually used.
 */
interface WorkerGlobal {
  postMessage(message: CardFaceResponse, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<CardFaceRequest>) => void) | null;
  readonly fonts?: FontFaceSet;
}

const worker = self as unknown as WorkerGlobal;

const art = new ArtBitmaps();
const queue: { readonly id: number; readonly spec: CardFaceSpec }[] = [];
/** Bakes in flight at once: enough to overlap one card's fetch with another's paint. */
const CONCURRENCY = 3;
let running = 0;
let ready: Promise<void> | null = null;

function post(message: CardFaceResponse, transfer: Transferable[] = []): void {
  worker.postMessage(message, transfer);
}

async function loadFonts(fonts: readonly FontSource[]): Promise<void> {
  const set = worker.fonts;
  if (!set || typeof FontFace === "undefined") throw new Error("no FontFaceSet in workers");
  await Promise.all(
    fonts.map(async (source) => {
      const face = new FontFace(source.family, source.src, source.descriptors);
      set.add(face);
      await face.load();
    }),
  );
}

function capable(): string | null {
  if (typeof OffscreenCanvas === "undefined") return "no OffscreenCanvas";
  if (!new OffscreenCanvas(1, 1).getContext("2d")) return "no OffscreenCanvas 2D context";
  if (typeof createImageBitmap === "undefined") return "no createImageBitmap";
  return null;
}

function pump(): void {
  while (running < CONCURRENCY && queue.length > 0) {
    const job = queue.pop()!;
    running++;
    void (ready ?? Promise.resolve())
      .then(() => bakeCardFace(job.spec, art))
      .then(
        (bitmap) => post({ type: "baked", id: job.id, bitmap }, [bitmap]),
        (error: unknown) => post({ type: "failed", id: job.id, reason: String(error) }),
      )
      .finally(() => {
        running--;
        pump();
      });
  }
}

worker.onmessage = (event: MessageEvent<CardFaceRequest>) => {
  const message = event.data;
  if (message.type === "init") {
    const problem = capable();
    if (problem) {
      post({ type: "ready", ok: false, reason: problem });
      return;
    }
    ready = loadFonts(message.fonts);
    ready.then(
      () => post({ type: "ready", ok: true }),
      (error: unknown) => post({ type: "ready", ok: false, reason: String(error) }),
    );
    return;
  }
  if (message.type === "bake") {
    queue.push({ id: message.id, spec: message.spec });
    pump();
  }
};
