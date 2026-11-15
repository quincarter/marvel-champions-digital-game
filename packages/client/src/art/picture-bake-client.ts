/**
 * A picture baked for the slot it is drawn in, as a canvas Phaser can upload: scaled to that size (issue #722), and
 * gray when asked (issue #716). Baked in `workers/picture-bake.worker.ts` where the browser has workers and
 * `OffscreenCanvas`; elsewhere on the main thread, the same way (`art/grayscale.ts`).
 */
import { canvasOf } from "./bitmap-canvas.js";
import { bakedSizeOf, grayscalePixels, type Size } from "./grayscale.js";

export interface BakeRequest {
  readonly id: number;
  readonly url: string;
  /** The slot it is drawn in, in device pixels: it is baked no larger than that needs. */
  readonly slot: Size;
  /** Mixed to gray (a locked tile's ghost). */
  readonly gray: boolean;
}

export interface BakeReply {
  readonly id: number;
  readonly bitmap: ImageBitmap | null;
  /** The bake failed in the worker (a fetch it couldn't make, a decode error), not a missing picture: bake it here. */
  readonly failed?: boolean;
}

/** How long a bake may take in the worker before it is done on the main thread instead. */
export const BAKE_WORKER_TIMEOUT_MS = 4000;

/** No answer from the worker (it failed to start, or was stopped): the picture is baked on the main thread. */
const UNAVAILABLE = "unavailable" as const;
type WorkerAnswer = ImageBitmap | null | typeof UNAVAILABLE;

let worker: Worker | null | undefined;
/** How many answers the worker has sent: a worker still answering is slow (a big picture, a slow line), not stuck. */
let answers = 0;
let nextId = 1;
const pending = new Map<number, (answer: WorkerAnswer) => void>();

function bakeWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return null;
  try {
    const made = new Worker(new URL("../workers/picture-bake.worker.ts", import.meta.url), {
      type: "module",
      name: "mc-picture-bake",
    });
    made.onmessage = (event: MessageEvent<BakeReply>) => {
      answers++;
      const { id, bitmap, failed } = event.data;
      const settle = pending.get(id);
      pending.delete(id);
      if (settle) settle(failed ? UNAVAILABLE : bitmap);
      else bitmap?.close(); // Answered after its request timed out: nobody is waiting for it.
    };
    made.onerror = () => retireWorker();
    worker = made;
  } catch {
    worker = null;
  }
  return worker;
}

/**
 * Stops using the worker (it failed to start, or stopped answering): everything waiting on it goes to the main thread,
 * and so does every later bake, rather than each one waiting out the timeout.
 */
function retireWorker(): void {
  const retired = worker;
  worker = null;
  retired?.terminate();
  for (const settle of pending.values()) settle(UNAVAILABLE);
  pending.clear();
}

/** The picture decoded the way `decodedPicture` does (fetched, then `createImageBitmap`), or as a CORS image. */
async function decodedSource(url: string): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === "function" && typeof fetch === "function") {
    try {
      const response = await fetch(url);
      if (response.ok) return await createImageBitmap(await response.blob());
    } catch {
      // Fall through to the plain image.
    }
  }
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** Bakes on the main thread, where there is no worker to do it (or it didn't answer). */
async function bakeOnMain(url: string, slot: Size, gray: boolean): Promise<HTMLCanvasElement | null> {
  const source = await decodedSource(url);
  if (!source) return null;
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const size = bakedSizeOf({ width, height }, slot);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, size.width, size.height);
  if (!(source instanceof HTMLImageElement)) source.close();
  if (!gray) return canvas;
  try {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    grayscalePixels(pixels.data);
    context.putImageData(pixels, 0, 0);
  } catch {
    return null; // A picture the page may not read back (cross-origin without CORS): no gray copy.
  }
  return canvas;
}

/**
 * The picture at `url` baked to cover `slot` (gray when asked), or null when it can't be loaded. A worker that answers
 * nothing at all for `BAKE_WORKER_TIMEOUT_MS` (stopped under memory pressure, a fetch that hangs) is not waited on for
 * good: it is retired and the bake moves to the main thread, so the picture's key never stays loading. A worker that
 * answered other bakes meanwhile is only slow, and is given another period rather than moving the work back here.
 */
export async function decodedBakedPicture(url: string, slot: Size, gray: boolean): Promise<HTMLCanvasElement | null> {
  const baker = bakeWorker();
  if (!baker) return bakeOnMain(url, slot, gray);
  const id = nextId++;
  const absolute = new URL(url, document.baseURI).href;
  const answer = await new Promise<WorkerAnswer>((resolve) => {
    let heard = answers;
    let timer: ReturnType<typeof setTimeout>;
    const expire = (): void => {
      if (worker === baker && answers !== heard) {
        heard = answers;
        timer = setTimeout(expire, BAKE_WORKER_TIMEOUT_MS);
        return;
      }
      pending.delete(id);
      resolve(UNAVAILABLE);
      if (worker === baker) retireWorker();
    };
    timer = setTimeout(expire, BAKE_WORKER_TIMEOUT_MS);
    pending.set(id, (reply) => {
      clearTimeout(timer);
      resolve(reply);
    });
    baker.postMessage({
      id,
      url: absolute,
      slot: { width: slot.width, height: slot.height },
      gray,
    } satisfies BakeRequest);
  });
  if (answer === UNAVAILABLE) return bakeOnMain(url, slot, gray);
  // The worker's own null is a picture that didn't load (a 404): fetching it again here would fail the same way.
  return answer ? canvasOf(answer) : null;
}
