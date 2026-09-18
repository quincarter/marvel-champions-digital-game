import { describe, expect, it } from "vitest";
import { interpretDeckResponse } from "./marvelcdb-upstream.js";
import { capacitorBody, type NativeResponse } from "./native-http.js";
import { nativeArtResolver } from "./native-art.js";
import { detectPlatform } from "./platform.js";

describe("detectPlatform", () => {
  it("is web with no shell globals, and with Capacitor's web build", () => {
    expect(detectPlatform({})).toBe("web");
    expect(detectPlatform({ Capacitor: { isNativePlatform: () => false } })).toBe("web");
  });

  it("recognises each native shell", () => {
    expect(detectPlatform({ Capacitor: { isNativePlatform: () => true } })).toBe("capacitor");
    expect(detectPlatform({ __TAURI_INTERNALS__: {} })).toBe("tauri");
  });
});

describe("capacitorBody", () => {
  it("decodes base64 for bytes and keeps text as text", () => {
    expect([...capacitorBody(btoa("\xff\xd8\xff"), "bytes")]).toEqual([0xff, 0xd8, 0xff]);
    expect(new TextDecoder().decode(capacitorBody("{\"a\":1}", "text"))).toBe("{\"a\":1}");
  });

  it("re-serialises JSON the plugin already parsed", () => {
    expect(new TextDecoder().decode(capacitorBody({ a: 1 }, "text"))).toBe("{\"a\":1}");
  });
});

describe("interpretDeckResponse", () => {
  it("passes JSON through and turns both not-found shapes into one 404", () => {
    expect(interpretDeckResponse("decklist", "1", { ok: true, contentType: "application/json", body: "{}" })).toEqual({ status: 200, body: "{}" });
    expect(interpretDeckResponse("decklist", "1", { ok: true, contentType: "application/json", body: " " }).status).toBe(404);
    expect(interpretDeckResponse("deck", "1", { ok: true, contentType: "text/html", body: "<html>" }).status).toBe(404);
  });
});

describe("nativeArtResolver", () => {
  const image = (status = 200, contentType = "image/png"): NativeResponse => ({ status, contentType, body: new Uint8Array([1, 2, 3]) });

  /** Answers each fetch with the next of `responses`, repeating the last. */
  function harness(...responses: (NativeResponse | Error)[]) {
    const fetched: string[] = [];
    const revoked: string[] = [];
    const slept: number[] = [];
    let n = 0;
    const resolve = nativeArtResolver(
      "capacitor",
      async (_platform, url) => {
        const response = responses[Math.min(fetched.length, responses.length - 1)]!;
        fetched.push(url);
        if (response instanceof Error) throw response;
        return response;
      },
      { createObjectURL: () => `blob:${++n}`, revokeObjectURL: (url) => void revoked.push(url) },
      async (ms) => void slept.push(ms),
    );
    return { resolve, fetched, revoked, slept };
  }

  it("fetches the route's path from MarvelCDB and caches the blob URL", async () => {
    const { resolve, fetched } = harness(image());
    expect(await resolve("/card-art/bundles/cards/01001a.png")).toBe("blob:1");
    expect(await resolve("/card-art/bundles/cards/01001a.png")).toBe("blob:1");
    expect(fetched).toEqual(["https://marvelcdb.com/bundles/cards/01001a.png"]);
  });

  it("answers null at once for a non-image or a 404", async () => {
    for (const response of [image(200, "text/html"), image(404)]) {
      const { resolve, fetched } = harness(response);
      expect(await resolve("/card-art/x.png")).toBeNull();
      expect(fetched).toHaveLength(1);
    }
  });

  it("retries a network failure, a 429 or a 5xx with backoff before giving up", async () => {
    const recovered = harness(new Error("offline"), image(503), image());
    expect(await recovered.resolve("/card-art/x.png")).toBe("blob:1");
    expect(recovered.slept).toEqual([400, 1500]);

    const down = harness(image(429));
    expect(await down.resolve("/card-art/x.png")).toBeNull();
    expect(down.fetched).toHaveLength(3);
  });

  it("forgets a failure so a later request can try again", async () => {
    const { resolve, fetched } = harness(image(404));
    await resolve("/card-art/x.png");
    await Promise.resolve();
    await resolve("/card-art/x.png");
    expect(fetched).toHaveLength(2);
  });

  it("keeps at most six upstream requests in flight", async () => {
    let active = 0;
    let peak = 0;
    const resolve = nativeArtResolver(
      "tauri",
      async () => {
        peak = Math.max(peak, ++active);
        await new Promise((done) => setTimeout(done, 1));
        active--;
        return image();
      },
      { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined },
    );
    await Promise.all(Array.from({ length: 20 }, (_, i) => resolve(`/card-art/${i}.png`)));
    expect(peak).toBe(6);
  });

  it("revokes the least recently used blob URLs past its bound", async () => {
    const { resolve, revoked } = harness(image());
    for (let i = 0; i < 301; i++) await resolve(`/card-art/${i}.png`);
    await Promise.resolve();
    expect(revoked).toEqual(["blob:1"]);
  });
});
