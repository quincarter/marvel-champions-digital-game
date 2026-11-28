// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pause-menu";
import type { PauseMenuItem } from "../../pause.types";
import type { PauseEventDetail } from "../../shared/pause-events.types";

afterEach(() => document.body.replaceChildren());

const items: PauseMenuItem[] = [
  { id: "resume", label: "Resume", kind: "primary", span: 2 },
  { id: "settings", label: "Settings", kind: "onInk", span: 1 },
  { id: "stats", label: "Your stats", kind: "onInk", span: 1 },
  { id: "concede", label: "Concede", kind: "onInk", span: 2, foot: true },
];

async function menu(list: PauseMenuItem[]) {
  const el = document.createElement("mc-pause-menu");
  el.items = list;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-pause-menu", () => {
  it("makes a stop of every button, and puts the foot items in their own group", async () => {
    const el = await menu(items);
    const stops = [...el.shadowRoot!.querySelectorAll("[data-stop]")].map((n) => n.getAttribute("data-stop"));
    expect(stops).toEqual(["resume", "settings", "stats", "concede"]);
    expect(el.shadowRoot!.querySelectorAll(".foot [data-stop]").length).toBe(1);
    expect(el.shadowRoot!.querySelector(".foot [data-stop]")!.getAttribute("data-stop")).toBe("concede");
  });

  it("says which button was pressed", async () => {
    const el = await menu(items);
    const seen: PauseEventDetail[] = [];
    el.addEventListener("mc-pause", (e) => seen.push(e.detail));
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="stats"]')!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(seen).toEqual([{ type: "menu", id: "stats" }]);
  });

  it("hangs a glyph hint only on a button that has one", async () => {
    const el = await menu([
      { ...items[0]!, glyph: { specs: [], width: 20, height: 20, ground: "ink", openness: 1 } as never },
    ]);
    expect(el.shadowRoot!.querySelectorAll("mc-glyph-hint").length).toBe(1);
    const plain = await menu(items);
    expect(plain.shadowRoot!.querySelectorAll("mc-glyph-hint").length).toBe(0);
  });
});
