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
    return new Response(body, {
      status: response.status,
      headers: response.contentType ? { "content-type": response.contentType } : {},
    });
  };
}
