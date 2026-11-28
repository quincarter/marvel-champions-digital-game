// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount, press, selectEvents } from "../../test-support.js";
import "../mc-scenario-actions.js";

afterEach(() => document.body.replaceChildren());

const base = {
  customize: null,
  next: "Choose heroes",
  nextDisabled: null,
  nextGlyph: null,
  caption: "Step 1 of 4",
  captionIsLock: false,
};

describe("mc-scenario-actions", () => {
  it("the call to action is a focus stop that presses next, with its caption under it", async () => {
    const el = await mount("mc-scenario-actions", { model: base });
    const seen = selectEvents(el);
    const next = inner<HTMLElement>(el, '[data-stop="next"]')!;
    press(next);
    expect(seen).toEqual([{ type: "press", key: "next" }]);
    expect(inner(el, ".caption")!.textContent).toBe("Step 1 of 4");
    expect(inner(el, '[data-stop="customize"]')).toBeNull();
  });

  it("a dimmed call to action stays a stop but presses nothing, and says why", async () => {
    const el = await mount("mc-scenario-actions", { model: { ...base, nextDisabled: "Pick a villain first" } });
    const seen = selectEvents(el);
    const next = inner<HTMLElement & { disabled: boolean; reason: string }>(el, '[data-stop="next"]')!;
    expect(next.disabled).toBe(true);
    expect(next.reason).toBe("Pick a villain first");
    press(next);
    expect(seen).toEqual([]);
  });

  it("Customize this scenario is its own stop ahead of next, and a lock reason is full-strength words", async () => {
    const el = await mount("mc-scenario-actions", {
      model: { ...base, customize: "Customize this scenario", caption: "Locked: win Rhino", captionIsLock: true },
    });
    const stops = [...el.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map((node) => node.dataset.stop);
    expect(stops).toEqual(["customize", "next"]);
    expect(inner(el, ".caption")!.classList.contains("lock")).toBe(true);
    const seen = selectEvents(el);
    press(inner(el, '[data-stop="customize"]')!);
    expect(seen).toEqual([{ type: "press", key: "customize" }]);
  });
});
