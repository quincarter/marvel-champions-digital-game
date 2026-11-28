// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-mod-message.js";
import { hear, mount, press, stop } from "../../shared/__tests__/test-mount.js";
import type { McModMessage } from "../McModMessage.js";

describe("mc-mod-message", () => {
  it("says its line, and has no Try again unless it was given its words", async () => {
    const el = await mount<McModMessage>("mc-mod-message", { text: "Loading the store..." });
    expect(el.shadowRoot!.querySelector(".text")!.textContent).toBe("Loading the store...");
    expect(el.shadowRoot!.querySelector("[data-stop]")).toBeNull();
    el.remove();
  });

  it("raises retry from Try again", async () => {
    const el = await mount<McModMessage>("mc-mod-message", { text: "Could not be reached.", retryLabel: "Try again" });
    const heard = hear(el);
    press(stop(el, "retry"));
    expect(heard).toEqual([{ type: "retry" }]);
    el.remove();
  });

  it("is an ink strip as the offline banner", async () => {
    const el = await mount<McModMessage>("mc-mod-message", { kind: "offline", text: "OFFLINE" });
    expect(el.getAttribute("kind")).toBe("offline");
    el.remove();
  });
});
