/** Messages between `card-face-baker.ts` (main thread) and `card-face.worker.ts`. */
import type { CardFaceSpec } from "./card-face.js";

/** One `@font-face` rule, as the page's stylesheets declare it, with its `src` URLs made absolute. */
export interface FontSource {
  readonly family: string;
  /**
   * A CSS `src` value (`url("…") format("woff2"), …`), or the font's bytes when the page has it inline as a `data:`
   * URL: WebView2 158 crashes the whole page when a worker's `FontFace` loads a `data:` URL (#932).
   */
  readonly src: string | ArrayBuffer;
  readonly descriptors: FontFaceDescriptors;
}

export type CardFaceRequest =
  | { readonly type: "init"; readonly fonts: readonly FontSource[] }
  | { readonly type: "bake"; readonly id: number; readonly spec: CardFaceSpec };

export type CardFaceResponse =
  | { readonly type: "ready"; readonly ok: boolean; readonly reason?: string }
  | { readonly type: "baked"; readonly id: number; readonly bitmap: ImageBitmap }
  | { readonly type: "failed"; readonly id: number; readonly reason: string };
