// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-mod-store-header.js";
import { hear, mount, press, stop } from "../../shared/__tests__/test-mount.js";
import type { McModStoreHeader } from "../McModStoreHeader.js";

const props = {
  backLabel: "◂ TITLE",
  heading: "Mod Store",
  badge: "Beta",
  installedText: "2 installed",
  aboutLabel: "About mods",
};

describe("mc-mod-store-header", () => {
  it("says the title, the beta tag and how many packs are installed", async () => {
    const el = await mount<McModStoreHeader>("mc-mod-store-header", props);
    const text = el.shadowRoot!.textContent!;
    expect(text).toContain("Mod Store");
    expect(el.shadowRoot!.querySelector(".badge")!.textContent).toBe("Beta");
    expect(el.shadowRoot!.querySelector(".installed")!.textContent).toBe("2 installed");
    el.remove();
  });

  it("leaves the installed count and the tag out while there are none", async () => {
    const el = await mount<McModStoreHeader>("mc-mod-store-header", { ...props, badge: "", installedText: "" });
    expect(el.shadowRoot!.querySelector(".badge")).toBeNull();
    expect(el.shadowRoot!.querySelector(".installed")).toBeNull();
    el.remove();
  });

  it("raises back and about from the buttons with the keys the pad route and the specs use", async () => {
    const el = await mount<McModStoreHeader>("mc-mod-store-header", props);
    const heard = hear(el);
    press(stop(el, "back"));
    press(stop(el, "about"));
    expect(heard).toEqual([{ type: "back" }, { type: "about" }]);
    expect(stop(el, "back").getAttribute("data-key")).toBe("back");
    el.remove();
  });
});
