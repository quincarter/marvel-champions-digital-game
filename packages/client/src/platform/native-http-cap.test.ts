import { describe, expect, it, vi } from "vitest";

const tauriFetch = vi.fn();
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: tauriFetch }));
const capacitorGet = vi.fn();
vi.mock("@capacitor/core", () => ({ CapacitorHttp: { get: capacitorGet } }));

import { NativeTooLargeError, base64DecodedLength, nativeGet, readCapped } from "./native-http.js";

function streamOf(chunks: number[], onPull?: () => void): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        onPull?.();
        if (i >= chunks.length) controller.close();
        else controller.enqueue(new Uint8Array(chunks[i++]!));
      },
    },
    { highWaterMark: 0 },
  );
}

describe("native response size cap", () => {
  it("refuses a Tauri response whose content-length is over the cap before reading the body", async () => {
    const pulled = vi.fn();
    tauriFetch.mockResolvedValueOnce(new Response(streamOf([10], pulled), { headers: { "content-length": "9999" } }));
    await expect(nativeGet("tauri", "https://packs.example/x.zip", "bytes", 100)).rejects.toBeInstanceOf(
      NativeTooLargeError,
    );
    expect(pulled).not.toHaveBeenCalled();
  });

  it("aborts a streaming body at the cap", async () => {
    const pulled = vi.fn();
    await expect(readCapped(new Response(streamOf([40, 40, 40, 40], pulled)), 100)).rejects.toBeInstanceOf(
      NativeTooLargeError,
    );
    expect(pulled.mock.calls.length).toBeLessThan(5);
  });

  it("reads a normal body in full", async () => {
    tauriFetch.mockResolvedValueOnce(new Response(streamOf([30, 30]), { headers: { "content-length": "60" } }));
    const result = await nativeGet("tauri", "https://packs.example/x.zip", "bytes", 100);
    expect(result.body.byteLength).toBe(60);
  });
});

/** Android's `Base64.DEFAULT`: a newline after every 76 characters, and one at the end. */
const wrapped = (bytes: Uint8Array): string =>
  (btoa(String.fromCharCode(...bytes)).match(/.{1,76}/g) ?? []).join("\n") + "\n";

describe("Android base64 bodies", () => {
  it("counts only the bytes a base64 body decodes to, not its line breaks or padding", () => {
    for (const size of [0, 1, 2, 3, 56, 57, 58, 1000, 4097]) {
      const bytes = new Uint8Array(size).map((_, i) => i % 251);
      expect(base64DecodedLength(btoa(String.fromCharCode(...bytes)))).toBe(size);
      expect(base64DecodedLength(wrapped(bytes))).toBe(size);
    }
  });

  it("takes a wrapped body of exactly the cap, and decodes it whole", async () => {
    const bytes = new Uint8Array(5000).map((_, i) => (i * 7) % 256);
    capacitorGet.mockResolvedValueOnce({ status: 200, headers: { "Content-Length": "5000" }, data: wrapped(bytes) });
    const response = await nativeGet("capacitor", "https://packs.example/x.zip", "bytes", 5000);
    expect([...response.body]).toEqual([...bytes]);
  });

  it("still refuses a wrapped body over the cap", async () => {
    const bytes = new Uint8Array(5001);
    capacitorGet.mockResolvedValueOnce({ status: 200, headers: {}, data: wrapped(bytes) });
    await expect(nativeGet("capacitor", "https://packs.example/x.zip", "bytes", 5000)).rejects.toBeInstanceOf(
      NativeTooLargeError,
    );
  });
});
