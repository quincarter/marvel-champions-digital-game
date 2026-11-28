// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pack-title.js";
import { mount } from "../../shared/__tests__/test-mount.js";
import type { McPackTitle } from "../McPackTitle.js";

describe("mc-pack-title", () => {
  it("says the name, byline and meta, and carries the state chip", async () => {
    const el = await mount<McPackTitle>("mc-pack-title", {
      pack: {
        name: "Wolverine X",
        byline: "by Someone",
        meta: "Hero pack · v1.0.0 · 1.2 MB",
        chip: "+ Install",
        solid: true,
      },
    });
    expect(el.shadowRoot!.querySelector(".name")!.textContent).toBe("Wolverine X");
    expect(el.shadowRoot!.querySelector(".byline")!.textContent).toBe("by Someone");
    expect(el.shadowRoot!.querySelector(".meta")!.textContent).toBe("Hero pack · v1.0.0 · 1.2 MB");
    const chip = el.shadowRoot!.querySelector<HTMLElement & { text: string; solid: boolean }>("mc-pack-state-chip")!;
    expect(chip.text).toBe("+ Install");
    expect(chip.solid).toBe(true);
    el.remove();
  });
});
