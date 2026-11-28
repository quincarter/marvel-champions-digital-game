import { afterEach, describe, expect, it } from "vitest";
import "../mc-press-card";

afterEach(() => document.body.replaceChildren());

describe("mc-press-card", () => {
  it("slots its content and reflects the chosen and dim states as attributes", async () => {
    const el = document.createElement("mc-press-card");
    el.selected = true;
    el.dim = true;
    el.innerHTML = "<span>Standard</span>";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("slot")).not.toBeNull();
    expect(el.hasAttribute("selected")).toBe(true);
    expect(el.hasAttribute("dim")).toBe(true);
  });

  it("raises its action on a press, and its hold action on inspect()", async () => {
    const el = document.createElement("mc-press-card");
    el.action = "a";
    el.holdAction = "b";
    document.body.append(el);
    await el.updateComplete;
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail));
    el.click();
    el.inspect();
    expect(seen).toEqual([
      { action: "a", hold: false },
      { action: "b", hold: true },
    ]);
  });
});
