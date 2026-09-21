import { describe, expect, it } from "vitest";
import { interpretDeckResponse } from "./marvelcdb-upstream.js";
import { capacitorBody } from "./native-http.js";
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
    expect(new TextDecoder().decode(capacitorBody('{"a":1}', "text"))).toBe('{"a":1}');
  });

  it("re-serialises JSON the plugin already parsed", () => {
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
