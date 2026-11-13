/**
 * How the Mod Store reaches the pack host. The web fetches `packs.<domain>` with CORS (the bucket's CORS policy allows
 * the site). A packaged app goes through the native HTTP stack instead, as MarvelCDB requests do
 * (`platform/native-http.ts`), so its `tauri.localhost` / `capacitor://` origin never needs a CORS entry.
 *
 * Every response is size-capped: the caller's `maxBytes` (an install passes the catalog's `zipBytes`), never above
 * `HARD_CAP_BYTES`. An oversized `content-length` is refused before the body is read; on the web a body without a
 * length is cut at the cap as it streams. See `nativeGet` for what each native transport can enforce.
 */
import { detectPlatform, type Platform } from "../platform/platform.js";
import type { FetchLike } from "./catalog.js";

/** No store download, catalog or preview is bigger than this, whatever a URL claims. */
export const HARD_CAP_BYTES = 256 * 1024 * 1024;

export class ResponseTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`The response is larger than ${maxBytes} bytes`);
    this.name = "ResponseTooLargeError";
  }
}

function capOf(maxBytes: number | undefined): number {
  return Math.min(maxBytes ?? HARD_CAP_BYTES, HARD_CAP_BYTES);
}

/** The response with a body that errors once more than `max` bytes have passed through it. */
export function capResponse(response: Response, max: number): Response {
  if (Number(response.headers.get("content-length")) > max) {
    void response.body?.cancel();
    throw new ResponseTooLargeError(max);
  }
  if (!response.body) return response;
  let seen = 0;
  const limiter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > max) controller.error(new ResponseTooLargeError(max));
      else controller.enqueue(chunk);
    },
  });
  return new Response(response.body.pipeThrough(limiter), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export function packFetchFor(platform: Platform = detectPlatform()): FetchLike {
  if (platform === "web") {
    return async (url, init) => {
      const { maxBytes, ...rest } = init ?? {};
      return capResponse(await fetch(url, rest), capOf(maxBytes));
    };
  }
  return async (url, init) => {
    const { nativeGet, NativeTooLargeError } = await import("../platform/native-http.js");
    const max = capOf(init?.maxBytes);
    let response;
    try {
      response = await nativeGet(platform, url, "bytes", max);
    } catch (error) {
      if (error instanceof NativeTooLargeError) throw new ResponseTooLargeError(max);
      throw error;
    }
    const body = response.body.buffer.slice(
      response.body.byteOffset,
      response.body.byteOffset + response.body.byteLength,
    ) as ArrayBuffer;
    const headers: Record<string, string> = { "content-length": String(response.body.byteLength) };
    if (response.contentType) headers["content-type"] = response.contentType;
    // A 204 or 304 has no body, and `Response` refuses one with it.
    const noBody = response.status === 204 || response.status === 205 || response.status === 304;
    return new Response(noBody ? null : body, { status: response.status, headers });
  };
}
