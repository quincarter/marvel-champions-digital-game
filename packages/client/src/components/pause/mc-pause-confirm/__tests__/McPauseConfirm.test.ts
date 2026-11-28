// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pause-confirm";
import type { PauseEventDetail } from "../../shared/pause-events.types";

afterEach(() => document.body.replaceChildren());

async function dialog() {
  const el = document.createElement("mc-pause-confirm");
  el.input = { sentence: "Concede? This ends the game for the whole table.", yes: "Yes, concede", cancel: "Cancel" };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-pause-confirm", () => {
  it("draws nothing without an input, and the sentence with both buttons as stops with one", async () => {
    const none = document.createElement("mc-pause-confirm");
    document.body.append(none);
    await none.updateComplete;
    expect(none.shadowRoot!.children.length).toBe(0);
    const el = await dialog();
    expect(el.shadowRoot!.querySelector(".sentence")!.textContent).toContain("Concede?");
    const stops = [...el.shadowRoot!.querySelectorAll("[data-stop]")].map((n) => n.getAttribute("data-stop"));
    expect(stops).toEqual(["concede-confirm-yes", "concede-confirm-cancel"]);
  });

  it("says which button was pressed", async () => {
    const el = await dialog();
    const seen: PauseEventDetail[] = [];
    el.addEventListener("mc-pause", (e) => seen.push(e.detail));
    for (const key of ["concede-confirm-cancel", "concede-confirm-yes"])
      el.shadowRoot!.querySelector<HTMLElement>(`[data-stop="${key}"]`)!.dispatchEvent(
        new CustomEvent("mc-press", { bubbles: true, composed: true }),
      );
    expect(seen).toEqual([
      { type: "menu", id: "concede-confirm-cancel" },
      { type: "menu", id: "concede-confirm-yes" },
    ]);
  });
});
