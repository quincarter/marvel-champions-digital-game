import { describe, expect, it } from "vitest";
import { interpretDeckResponse } from "./marvelcdb-upstream.js";
import { capacitorBody } from "./native-http.js";
import { detectPlatform, drawsEdgeToEdge, externalOpenerFor } from "./platform.js";

describe("detectPlatform", () => {
  it("is web with no shell globals, and with Capacitor's web build", () => {
    expect(detectPlatform({})).toBe("web");
    expect(detectPlatform({ Capacitor: { isNativePlatform: () => false } })).toBe("web");
  });

  it("recognizes each native shell", () => {
    expect(detectPlatform({ Capacitor: { isNativePlatform: () => true } })).toBe("capacitor");
    expect(detectPlatform({ __TAURI_INTERNALS__: {} })).toBe("tauri");
  });
});

describe("drawsEdgeToEdge", () => {
  it("is off in a browser tab, on in a native shell or an installed app", () => {
    expect(drawsEdgeToEdge("web", false)).toBe(false);
    expect(drawsEdgeToEdge("web", true)).toBe(true);
    expect(drawsEdgeToEdge("capacitor", false)).toBe(true);
    expect(drawsEdgeToEdge("tauri", false)).toBe(true);
  });
});

describe("externalOpenerFor", () => {
  const android = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

  it("sends Android links to the browser plugin, not past the GitHub app's link capture", () => {
    expect(externalOpenerFor("capacitor", android)).toBe("android-browser");
  });

  it("uses the opener plugin on desktop and window.open on iOS and the web", () => {
    expect(externalOpenerFor("tauri", "Windows NT 10.0")).toBe("tauri-opener");
    expect(externalOpenerFor("capacitor", iphone)).toBe("window");
    expect(externalOpenerFor("web", android)).toBe("window");
  });
});

describe("capacitorBody", () => {
  it("decodes base64 for bytes and keeps text as text", () => {
    expect([...capacitorBody(btoa("\xff\xd8\xff"), "bytes")]).toEqual([0xff, 0xd8, 0xff]);
    expect(new TextDecoder().decode(capacitorBody('{"a":1}', "text"))).toBe('{"a":1}');
  });

  it("re-serializes JSON the plugin already parsed", () => {
    expect(new TextDecoder().decode(capacitorBody({ a: 1 }, "text"))).toBe('{"a":1}');
  });
});

describe("interpretDeckResponse", () => {
  it("passes JSON through and turns both not-found shapes into one 404", () => {
    expect(interpretDeckResponse("decklist", "1", { ok: true, contentType: "application/json", body: "{}" })).toEqual({
      status: 200,
      body: "{}",
    });
    expect(
      interpretDeckResponse("decklist", "1", { ok: true, contentType: "application/json", body: " " }).status,
    ).toBe(404);
    expect(interpretDeckResponse("deck", "1", { ok: true, contentType: "text/html", body: "<html>" }).status).toBe(404);
  });
});
