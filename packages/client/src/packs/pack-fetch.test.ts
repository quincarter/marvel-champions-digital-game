import { afterEach, describe, expect, it, vi } from "vitest";

const { NativeTooLargeError } = vi.hoisted(() => ({ NativeTooLargeError: class extends Error {} }));

vi.mock("../platform/native-http.js", () => ({
  NativeTooLargeError,
  nativeGet: vi.fn(async () => ({
    status: 200,
    contentType: "application/json",
    body: new TextEncoder().encode("{}"),
  })),
}));

import { nativeGet } from "../platform/native-http.js";
import { capResponse, packFetchFor, ResponseTooLargeError } from "./pack-fetch.js";

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

afterEach(() => vi.unstubAllGlobals());

describe("packFetchFor", () => {
  it("goes through the native HTTP stack in a packaged app, passing the cap on", async () => {
    const response = await packFetchFor("tauri")("https://packs.example/index.json", { maxBytes: 100 });
    expect(nativeGet).toHaveBeenCalledWith("tauri", "https://packs.example/index.json", "bytes", 100);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
  });

  it("reports a native transport's oversized refusal as ResponseTooLargeError", async () => {
    vi.mocked(nativeGet).mockRejectedValueOnce(new NativeTooLargeError("big"));
    await expect(packFetchFor("capacitor")("https://packs.example/x.zip", { maxBytes: 5 })).rejects.toBeInstanceOf(
      ResponseTooLargeError,
    );
  });

  it("refuses a web response whose content-length is over the cap before reading the body", async () => {
    const pulled = vi.fn();
    const body = streamOf([10], pulled);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, { headers: { "content-length": "9999" } })),
    );
    await expect(packFetchFor("web")("https://packs.example/x.zip", { maxBytes: 100 })).rejects.toBeInstanceOf(
      ResponseTooLargeError,
    );
    expect(pulled).not.toHaveBeenCalled();
  });

  it("lets a normal web pack through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(streamOf([30, 30]), { headers: { "content-length": "60" } })),
    );
    const response = await packFetchFor("web")("https://packs.example/x.zip", { maxBytes: 60 });
    expect((await response.arrayBuffer()).byteLength).toBe(60);
  });
});

describe("capResponse", () => {
  it("aborts a streaming body with no length once it passes the cap", async () => {
    const response = capResponse(new Response(streamOf([40, 40, 40])), 100);
    await expect(response.arrayBuffer()).rejects.toBeInstanceOf(ResponseTooLargeError);
  });
});
