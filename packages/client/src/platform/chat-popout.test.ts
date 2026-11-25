import { describe, expect, it } from "vitest";
import { chatPopoutAllowed, chatPopoutLabel, chatPopoutUrl } from "./chat-popout.js";

describe("chatPopoutAllowed", () => {
  it("is for the browser and the Tauri app, wherever a BroadcastChannel exists", () => {
    expect(chatPopoutAllowed({ platform: "web", hasBroadcastChannel: true })).toBe(true);
    expect(chatPopoutAllowed({ platform: "tauri", hasBroadcastChannel: true })).toBe(true);
    expect(chatPopoutAllowed({ platform: "web", hasBroadcastChannel: false })).toBe(false);
  });
  it("is not for the native phone and tablet shell", () => {
    expect(chatPopoutAllowed({ platform: "capacitor", hasBroadcastChannel: true })).toBe(false);
  });
});

describe("chatPopoutUrl", () => {
  it("names the page, the room and the language, escaped", () => {
    expect(chatPopoutUrl({ roomId: "a b&c", token: "t0k", lang: "es" })).toBe(
      "/chat-popout.html?room=a+b%26c&token=t0k&lang=es",
    );
  });
});

describe("chatPopoutLabel", () => {
  it("is one window per token, in the characters a window label allows", () => {
    expect(chatPopoutLabel("Ab_9-x")).toBe("chat-popout-Ab_9-x");
    expect(chatPopoutLabel("a b/c")).toBe("chat-popout-a_b_c");
    expect(chatPopoutLabel("one")).not.toBe(chatPopoutLabel("two"));
  });
});
