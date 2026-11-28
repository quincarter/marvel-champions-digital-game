// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-side-story-actions.js";

afterEach(() => document.body.replaceChildren());

describe("mc-side-story-actions", () => {
  it("has NEXT always and BACK only after the first beat, each a focus stop", async () => {
    const el = document.createElement("mc-side-story-actions");
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector('[data-stop="back"]')).toBeNull();
    expect(root.querySelector('[data-stop="next"]')).not.toBeNull();
    el.hasBack = true;
    await el.updateComplete;
    expect(root.querySelector('[data-stop="back"]')).not.toBeNull();
  });

  it("says back and next as mc-side-story events", async () => {
    const el = document.createElement("mc-side-story-actions");
    el.hasBack = true;
    document.body.append(el);
    await el.updateComplete;
    const heard = vi.fn();
    el.addEventListener("mc-side-story", (event) => heard(event.detail));
    for (const stop of ["back", "next"]) {
      el.shadowRoot!.querySelector(`[data-stop="${stop}"]`)!.dispatchEvent(
        new CustomEvent("mc-press", { bubbles: true, composed: true }),
      );
    }
    expect(heard.mock.calls.map(([detail]) => detail)).toEqual([{ type: "back" }, { type: "next" }]);
  });
});
