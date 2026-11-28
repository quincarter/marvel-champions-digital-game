// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-setup-set-tile";
import type { SetupEventDetail } from "../../shared/setup-events.types";
import type { SetTileInput } from "../mc-setup-set-tile.types";

afterEach(() => document.body.replaceChildren());

const tile = (over: Partial<SetTileInput> = {}): SetTileInput => ({
  id: "bomb_scare",
  name: "Bomb Scare",
  label: "CHOSEN · 6 CARDS",
  selected: true,
  barred: false,
  dim: false,
  picture: { source: { src: "bomb.jpg" }, cardId: "01100" },
  ...over,
});

async function make(input: SetTileInput | null, mode: "wide" | "phone" = "wide") {
  const el = document.createElement("mc-setup-set-tile");
  el.tile = input;
  el.mode = mode;
  document.body.append(el);
  await el.updateComplete;
  const seen: SetupEventDetail[] = [];
  el.addEventListener("mc-setup", (e) => seen.push(e.detail));
  return { el, seen };
}

describe("mc-setup-set-tile", () => {
  it("draws a card with its name and count line, red-bordered when chosen, that toggles the set", async () => {
    const { el, seen } = await make(tile());
    const card = el.shadowRoot!.querySelector("mc-press-card")!;
    expect(card.getAttribute("data-stop")).toBe("modular:bomb_scare");
    expect(card.hasAttribute("selected")).toBe(true);
    expect(card.textContent).toContain("Bomb Scare");
    expect(card.textContent).toContain("CHOSEN · 6 CARDS");
    card.press();
    expect(seen).toEqual([{ type: "modular-toggle", id: "bomb_scare" }]);
  });

  it("opens the set's cards from the picture's area, the Cards tab and a hold, none of which toggle", async () => {
    const { el, seen } = await make(tile());
    el.shadowRoot!.querySelector("mc-hit-area")!.press();
    el.shadowRoot!.querySelector("mc-chip.tab")!.press();
    el.shadowRoot!.querySelector("mc-press-card")!.inspect();
    expect(seen).toEqual([
      { type: "modular-cards", id: "bomb_scare" },
      { type: "modular-cards", id: "bomb_scare" },
      { type: "modular-cards", id: "bomb_scare" },
    ]);
  });

  it("does nothing on a tap of a barred set, which is faded", async () => {
    const { el, seen } = await make(tile({ barred: true, dim: true, selected: false }));
    el.shadowRoot!.querySelector("mc-press-card")!.press();
    expect(seen).toEqual([]);
    expect(el.shadowRoot!.querySelector("mc-press-card")!.hasAttribute("dim")).toBe(true);
  });

  it("raises the card hover from the picture's area for a mouse, and not for a finger", async () => {
    const { el } = await make(tile());
    const hovered: string[] = [];
    el.addEventListener("mc-card-hover", (e) => hovered.push(e.detail.cardId));
    const area = el.shadowRoot!.querySelector("mc-hit-area")!;
    area.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "touch" }));
    area.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    expect(hovered).toEqual(["01100"]);
  });

  it("is a check row with the picture at its end on a phone, and has no picture area for a set without one", async () => {
    const { el } = await make(tile(), "phone");
    const row = el.shadowRoot!.querySelector("mc-check-row")!;
    expect(row.hasAttribute("checked")).toBe(true);
    expect(el.shadowRoot!.querySelector("mc-press-card")).toBeNull();
    const bare = await make(tile({ picture: null }));
    expect(bare.el.shadowRoot!.querySelector("mc-hit-area")).toBeNull();
    expect(bare.el.shadowRoot!.querySelector("mc-picture-tile")).toBeNull();
  });
});
