import { afterEach, describe, expect, it } from "vitest";
import "../mc-chip";
import type { PressDetail } from "../../../../shared/press/press.types";

afterEach(() => document.body.replaceChildren());

async function chip(set: (el: HTMLElementTagNameMap["mc-chip"]) => void) {
  const el = document.createElement("mc-chip");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const heard = (el: HTMLElement): PressDetail[] => {
  const seen: PressDetail[] = [];
  el.addEventListener("mc-pressed", (e) => seen.push(e.detail));
  return seen;
};

describe("mc-chip", () => {
  it("draws its words and says chosen through the selected attribute", async () => {
    const el = await chip((c) => {
      c.label = "II";
      c.selected = true;
    });
    expect(el.shadowRoot!.querySelector(".box")!.textContent).toBe("II");
    expect(el.hasAttribute("selected")).toBe(true);
    expect(el.getAttribute("role")).toBe("button");
  });

  it("raises mc-pressed with its action on press() and on click(), composed and bubbling", async () => {
    const el = await chip((c) => (c.action = { type: "pick", id: "a" }));
    const seen = heard(document.body);
    el.press();
    el.click();
    expect(seen).toEqual([
      { action: { type: "pick", id: "a" }, hold: false },
      { action: { type: "pick", id: "a" }, hold: false },
    ]);
  });

  it("raises nothing while disabled or with no action", async () => {
    const off = await chip((c) => {
      c.action = "x";
      c.disabled = true;
    });
    const none = await chip(() => undefined);
    const seen = heard(document.body);
    off.press();
    none.press();
    expect(seen).toEqual([]);
  });

  it("raises its hold action on inspect()", async () => {
    const el = await chip((c) => (c.holdAction = "look"));
    const seen = heard(el);
    el.inspect();
    expect(seen).toEqual([{ action: "look", hold: true }]);
  });

  it("taps on a press and release on it, not on a release elsewhere", async () => {
    const el = await chip((c) => (c.action = "go"));
    const seen = heard(el);
    const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
    el.dispatchEvent(new PointerEvent("pointerdown", at));
    el.dispatchEvent(new PointerEvent("pointerup", at));
    expect(seen).toEqual([{ action: "go", hold: false }]);
  });
});
