import { describe, expect, it } from "vitest";
import "./mc-action-bar.js";

describe("mc-action-bar", () => {
  it("holds its buttons in a slot, so a wide one can take a row of its own", async () => {
    const el = document.createElement("mc-action-bar");
    const wide = document.createElement("button");
    wide.dataset.wide = "";
    el.append(wide, document.createElement("button"));
    document.body.append(el);
    await el.updateComplete;
    const slot = el.shadowRoot!.querySelector("slot")!;
    expect(slot.assignedElements()).toHaveLength(2);
    expect(slot.assignedElements()[0]!.hasAttribute("data-wide")).toBe(true);
    el.remove();
  });
});
