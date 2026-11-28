// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-extras-doors.js";

afterEach(() => document.body.replaceChildren());

describe("mc-extras-doors", () => {
  it("has a focus stop per door and says which one was pressed", async () => {
    const el = document.createElement("mc-extras-doors");
    el.trophiesLabel = "Trophy Room";
    el.creditsLabel = "Credits";
    document.body.append(el);
    await el.updateComplete;
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLElement>("mc-button")];
    expect(buttons.map((button) => button.dataset.stop)).toEqual(["trophies", "credits"]);
    const heard = vi.fn();
    el.addEventListener("mc-extras", (event) => heard(event.detail));
    for (const button of buttons) button.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(heard.mock.calls.map(([detail]) => detail)).toEqual([
      { type: "door", id: "trophies" },
      { type: "door", id: "credits" },
    ]);
  });
});
