/**
 * A picture's gray copy, as a canvas Phaser can upload (issue #716). Baked in `workers/picture-gray.worker.ts` where
 * the browser has workers and `OffscreenCanvas`; elsewhere on the main thread, the same mix (`art/grayscale.ts`).
 */
import { canvasOf } from "./bitmap-canvas.js";
import { bakedSizeOf, grayscalePixels, type Size } from "./grayscale.js";

export interface GrayPictureRequest {
  readonly id: number;
  readonly url: string;
  /** The slot it is drawn in, in device pixels: it is baked no larger than that needs. */
  readonly slot: Size;
}

export interface GrayPictureReply {
  readonly id: number;
  readonly bitmap: ImageBitmap | null;
}

let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, (bitmap: ImageBitmap | null) => void>();

function grayWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return null;
  try {
    const made = new Worker(new URL("../workers/picture-gray.worker.ts", import.meta.url), {
      type: "module",
      name: "mc-picture-gray",
    });
    made.onmessage = (event: MessageEvent<GrayPictureReply>) => {
      pending.get(event.data.id)?.(event.data.bitmap);
      pending.delete(event.data.id);
    };
    made.onerror = () => {
      // A worker that fails to start answers nothing: let everything waiting on it go, and bake on the main thread.
      for (const settle of pending.values()) settle(null);
      pending.clear();
      worker = null;
    };
    worker = made;
  } catch {
    worker = null;
  }
  return worker;
}

/** Bakes on the main thread, where there is no worker to do it. */
async function grayOnMain(url: string, slot: Size): Promise<HTMLCanvasElement | null> {
  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const loading = new Image();
    loading.onload = () => resolve(loading);
    loading.onerror = () => resolve(null);
    loading.src = url;
  });
  if (!image) return null;
  const canvas = document.createElement("canvas");
  const size = bakedSizeOf({ width: image.naturalWidth, height: image.naturalHeight }, slot);
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, size.width, size.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  grayscalePixels(pixels.data);
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/** The gray copy of the picture at `url`, baked to cover `slot`, or null when it can't be loaded. */
export async function decodedGrayPicture(url: string, slot: Size): Promise<HTMLCanvasElement | null> {
  const baker = grayWorker();
  if (!baker) return grayOnMain(url, slot);
  const id = nextId++;
  const absolute = new URL(url, document.baseURI).href;
  const bitmap = await new Promise<ImageBitmap | null>((resolve) => {
    pending.set(id, resolve);
    baker.postMessage({
      id,
      url: absolute,
      slot: { width: slot.width, height: slot.height },
    } satisfies GrayPictureRequest);
  });
  return bitmap ? canvasOf(bitmap) : grayOnMain(url, slot);
}
