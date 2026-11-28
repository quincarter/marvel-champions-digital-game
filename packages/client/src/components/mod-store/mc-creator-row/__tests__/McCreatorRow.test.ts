// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-creator-row.js";
import { hear, mount } from "../../shared/__tests__/test-mount.js";
import type { McCreatorRow } from "../McCreatorRow.js";

const credit = { name: "Someone", countText: "2 packs ▸", line: "Hero pack: Wolverine X" };

describe("mc-creator-row", () => {
  it("says the creator's name, how many packs and which", async () => {
    const el = await mount<McCreatorRow>("mc-creator-row", { credit });
    expect(el.shadowRoot!.querySelector(".name")!.textContent).toBe("Someone");
    expect(el.shadowRoot!.querySelector(".count")!.textContent).toBe("2 packs ▸");
    expect(el.shadowRoot!.querySelector(".line")!.textContent).toBe("Hero pack: Wolverine X");
    el.remove();
  });

  it("is a stop named creator:<name>, and a press says creator", async () => {
    const el = await mount<McCreatorRow>("mc-creator-row", { credit });
    expect(el.getAttribute("data-stop")).toBe("creator:Someone");
    expect(el.getAttribute("data-key")).toBe("creator:Someone");
    const heard = hear(el);
    el.click();
    expect(heard).toEqual([{ type: "creator", name: "Someone" }]);
    el.remove();
  });
});
