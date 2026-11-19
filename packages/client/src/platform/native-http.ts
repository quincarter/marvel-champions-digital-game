/**
 * A GET through the native shell's HTTP stack.
 *
 * MarvelCDB sends no CORS headers, so a webview `fetch` to it fails, and an
 * image loaded cross-origin could not become a WebGL texture anyway. On the web
 * the Vite routes proxy it; in a packaged app these native clients do, since
 * requests made outside the webview are not subject to CORS at all.
 *
 * Each shell's package is imported dynamically, so the web bundle never loads
 * either one and a Tauri build never loads Capacitor's (or the reverse).
 */

import type { Platform } from "./platform.js";

export interface NativeResponse {
  readonly status: number;
  /** Lower-cased `content-type`, or "" when the response had none. */
  readonly contentType: string;
  readonly body: Uint8Array;
}

/** `bytes` for images, `text` for JSON — CapacitorHttp encodes the two differently. */
export type NativeBody = "bytes" | "text";

/** Thrown when a response is larger than the caller's `maxBytes`. */
export class NativeTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`The response is larger than ${maxBytes} bytes`);
    this.name = "NativeTooLargeError";
  }
}

/**
 * `maxBytes` refuses an oversized response. Tauri's fetch streams: a declared `content-length` over the cap is refused
 * before any body is read, and a body (or one with no length) is read in chunks and cancelled past the cap.
 * CapacitorHttp does not stream (the plugin hands the whole body across the bridge as one value), so there the cap is
 * enforced only once the response is back, before it is decoded or copied: the remaining gap is that the native layer
 * and the bridge have already buffered it.
 */
export async function nativeGet(
  platform: Exclude<Platform, "web">,
  url: string,
  as: NativeBody = "bytes",
  maxBytes: number = Infinity,
): Promise<NativeResponse> {
  return platform === "tauri" ? tauriGet(url, maxBytes) : capacitorGet(url, as, maxBytes);
}

/**
 * A GET through Tauri's HTTP plugin, with its body still streaming (the Mod Store reads it chunk by chunk to show
 * download progress). Scoped to MarvelCDB and the Mod Store pack hosts by src-tauri/capabilities/default.json.
 */
export async function tauriFetch(url: string): Promise<Response> {
  const { fetch } = await import("@tauri-apps/plugin-http");
  return fetch(url);
}

async function tauriGet(url: string, maxBytes: number): Promise<NativeResponse> {
  const response = await tauriFetch(url);
  if (Number(response.headers.get("content-length")) > maxBytes) {
    void response.body?.cancel();
    throw new NativeTooLargeError(maxBytes);
  }
  return {
    status: response.status,
    contentType: (response.headers.get("content-type") ?? "").toLowerCase(),
    body: await readCapped(response, maxBytes),
  };
}

/** Reads a body in chunks, cancelling it and throwing once it passes `maxBytes`. */
export async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new NativeTooLargeError(maxBytes);
    return bytes;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      void reader.cancel();
      throw new NativeTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(received);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

async function capacitorGet(url: string, as: NativeBody, maxBytes: number): Promise<NativeResponse> {
  const { CapacitorHttp } = await import("@capacitor/core");
  const response = await CapacitorHttp.get({ url, responseType: as === "bytes" ? "arraybuffer" : "text" });
  const header = (wanted: string): string =>
    Object.entries(response.headers).find(([name]) => name.toLowerCase() === wanted)?.[1] ?? "";
  // Checked before decoding, so an oversized body is not also copied; the bridge has already held it (see nativeGet).
  const tooLarge =
    Number(header("content-length")) > maxBytes ||
    (typeof response.data === "string" && as === "bytes" && base64DecodedLength(response.data) > maxBytes) ||
    (response.data instanceof ArrayBuffer && response.data.byteLength > maxBytes);
  if (tooLarge) throw new NativeTooLargeError(maxBytes);
  return {
    status: response.status,
    contentType: header("content-type").toLowerCase(),
    body: capacitorBody(response.data, as),
  };
}

/**
 * How many bytes a base64 string decodes to. Android's CapacitorHttp encodes with `Base64.DEFAULT`, which breaks the
 * text with a newline every 76 characters: counted as data, those made every pack about 1% larger than its catalog
 * size, and every Mod Store install on Android was refused as oversized. Whitespace is skipped, as `atob` does.
 */
export function base64DecodedLength(data: string): number {
  let chars = 0;
  let padding = 0;
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    if (code === 0x0a || code === 0x0d || code === 0x20 || code === 0x09 || code === 0x0c) continue;
    chars++;
    padding = code === 0x3d ? padding + 1 : 0;
  }
  return Math.floor((chars * 3) / 4) - Math.min(padding, 2);
}

/**
 * CapacitorHttp's `data`: base64 for a binary responseType; for text, a string
 * — or already-parsed JSON when the response said `application/json`.
 */
export function capacitorBody(data: unknown, as: NativeBody): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof data === "string") {
    return as === "bytes" ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0)) : new TextEncoder().encode(data);
  }
  return new TextEncoder().encode(data == null ? "" : JSON.stringify(data));
}
