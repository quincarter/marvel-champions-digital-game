// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-creator-list.js";
import { mount } from "../../shared/__tests__/test-mount.js";
import type { McCreatorList } from "../McCreatorList.js";

describe("mc-creator-list", () => {
  it("says who the list is, then a native scroller (list:credits) with a row per creator", async () => {
    const el = await mount<McCreatorList>("mc-creator-list", {
      intro: "The people who make the store's packs.",
      empty: "No creators yet.",
      credits: [
        { name: "A", countText: "1 pack ▸", line: "Hero pack: X" },
        { name: "B", countText: "2 packs ▸", line: "Scenario: Y" },
      ],
    });
    expect(el.shadowRoot!.querySelector(".intro")!.textContent).toBe("The people who make the store's packs.");
    expect(el.scroller!.getAttribute("data-key")).toBe("list:credits");
    expect(el.scroller!.querySelectorAll("mc-creator-row").length).toBe(2);
    el.remove();
  });

  it("says there are none in place of the list", async () => {
    const el = await mount<McCreatorList>("mc-creator-list", { intro: "Who", empty: "No creators yet.", credits: [] });
    expect(el.scroller).toBeNull();
    expect(el.shadowRoot!.querySelector(".empty")!.textContent).toBe("No creators yet.");
    el.remove();
  });
});
