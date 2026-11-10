/**
 * How the Mod Store reaches the pack host. The web fetches `packs.<domain>` with CORS (the bucket's CORS policy allows
 * the site). A packaged app goes through the native HTTP stack instead, as MarvelCDB requests do
 * (`platform/native-http.ts`), so its `tauri.localhost` / `capacitor://` origin never needs a CORS entry.
 */
import { detectPlatform, type Platform } from "../platform/platform.js";
import type { FetchLike } from "./catalog.js";

export function packFetchFor(platform: Platform = detectPlatform()): FetchLike {
  if (platform === "web") return (url, init) => fetch(url, init);
  return async (url) => {
    const { nativeGet } = await import("../platform/native-http.js");
    const response = await nativeGet(platform, url, "bytes");
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
