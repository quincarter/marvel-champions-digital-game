import { describe, expect, it } from "vitest";
import { chatPopoutAllowed, chatPopoutUrl } from "./chat-popout.js";

describe("chatPopoutAllowed", () => {
  it("is for desktops: a desktop browser and the Tauri app", () => {
    expect(chatPopoutAllowed({ platform: "web", form: "desktop", hasBroadcastChannel: true })).toBe(true);
    expect(chatPopoutAllowed({ platform: "tauri", form: "desktop", hasBroadcastChannel: true })).toBe(true);
  });
  it("is not for phones, tablets or the native phone shell", () => {
    expect(chatPopoutAllowed({ platform: "web", form: "phone", hasBroadcastChannel: true })).toBe(false);
    expect(chatPopoutAllowed({ platform: "web", form: "tablet", hasBroadcastChannel: true })).toBe(false);
    expect(chatPopoutAllowed({ platform: "capacitor", form: "desktop", hasBroadcastChannel: true })).toBe(false);
    expect(chatPopoutAllowed({ platform: "web", form: null, hasBroadcastChannel: true })).toBe(false);
  });
  it("needs a BroadcastChannel", () => {
    expect(chatPopoutAllowed({ platform: "web", form: "desktop", hasBroadcastChannel: false })).toBe(false);
  });
});

describe("chatPopoutUrl", () => {
  it("names the page, the room and the language, escaped", () => {
    expect(chatPopoutUrl({ roomId: "a b&c", lang: "es" })).toBe("/chat-popout.html?room=a+b%26c&lang=es");
  });
});
