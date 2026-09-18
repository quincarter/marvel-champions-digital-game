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

export async function nativeGet(platform: Exclude<Platform, "web">, url: string, as: NativeBody = "bytes"): Promise<NativeResponse> {
  return platform === "tauri" ? tauriGet(url) : capacitorGet(url, as);
}

async function tauriGet(url: string): Promise<NativeResponse> {
  // Scoped to https://marvelcdb.com/* by src-tauri/capabilities/default.json.
  const { fetch } = await import("@tauri-apps/plugin-http");
  const response = await fetch(url);
  return {
    status: response.status,
    contentType: (response.headers.get("content-type") ?? "").toLowerCase(),
    body: new Uint8Array(await response.arrayBuffer()),
  };
}

async function capacitorGet(url: string, as: NativeBody): Promise<NativeResponse> {
  const { CapacitorHttp } = await import("@capacitor/core");
  const response = await CapacitorHttp.get({ url, responseType: as === "bytes" ? "arraybuffer" : "text" });
  const contentType = Object.entries(response.headers).find(([name]) => name.toLowerCase() === "content-type")?.[1] ?? "";
  return { status: response.status, contentType: contentType.toLowerCase(), body: capacitorBody(response.data, as) };
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
