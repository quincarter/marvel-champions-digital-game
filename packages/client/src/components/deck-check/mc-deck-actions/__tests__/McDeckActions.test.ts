// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-deck-actions.js";

describe("mc-deck-actions", () => {
  it("says edit and start, and dims Start game with its reason when it cannot be pressed", async () => {
    const el = document.createElement("mc-deck-actions");
    el.editLabel = "Edit deck";
    el.startLabel = "Start game";
    el.startUnavailable = "Open this deck from Take your seats.";
    document.body.append(el);
    await el.updateComplete;
    const heard = vi.fn();
    el.addEventListener("mc-deck-check", (event) => heard(event.detail));
    const press = (stop: string): void => {
      el.shadowRoot!.querySelector(`[data-stop="${stop}"]`)!.dispatchEvent(
        new CustomEvent("mc-press", { bubbles: true, composed: true }),
      );
    };
    press("edit-deck");
    press("start");
    expect(heard.mock.calls.map(([detail]) => detail)).toEqual([{ type: "edit" }, { type: "start" }]);
    const start = el.shadowRoot!.querySelector<HTMLElement & { disabled: boolean; reason: string }>(
      '[data-stop="start"]',
    )!;
    expect(start.disabled).toBe(true);
    expect(start.reason).toBe("Open this deck from Take your seats.");
    el.startUnavailable = "";
    await el.updateComplete;
    expect(start.disabled).toBe(false);
    el.remove();
  });
});
