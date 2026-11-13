import { describe, expect, it, vi } from "vitest";

const tauriFetch = vi.fn();
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: tauriFetch }));

import { NativeTooLargeError, nativeGet, readCapped } from "./native-http.js";

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
