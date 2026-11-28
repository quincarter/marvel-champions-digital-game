import { afterEach, describe, expect, it } from "vitest";
import "../mc-check-row";

afterEach(() => document.body.replaceChildren());

async function row(set: (el: HTMLElementTagNameMap["mc-check-row"]) => void) {
  const el = document.createElement("mc-check-row");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-check-row", () => {
  it("shows the name, the line under it and a tick only when on", async () => {
    const off = await row((r) => {
      r.name = "Bomb Scare";
      r.meta = "6 cards";
    });
    expect(off.shadowRoot!.querySelector(".name")!.textContent).toBe("Bomb Scare");
    expect(off.shadowRoot!.querySelector(".label")!.textContent).toBe("6 cards");
    expect(off.shadowRoot!.querySelector(".box")!.textContent!.trim()).toBe("");
    const on = await row((r) => (r.checked = true));
    expect(on.shadowRoot!.querySelector(".box")!.textContent).toBe("✓");
  });

  it("raises its action, and its hold action on inspect()", async () => {
    const el = await row((r) => {
      r.action = "toggle";
      r.holdAction = "cards";
    });
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail));
    el.press();
    el.inspect();
    expect(seen).toEqual([
      { action: "toggle", hold: false },
      { action: "cards", hold: true },
    ]);
  });

  it("is ticked and inert when locked", async () => {
    const el = await row((r) => {
      r.locked = true;
      r.action = "toggle";
    });
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail));
    el.press();
    expect(seen).toEqual([]);
    expect(el.shadowRoot!.querySelector(".box")!.textContent).toBe("✓");
  });
});
