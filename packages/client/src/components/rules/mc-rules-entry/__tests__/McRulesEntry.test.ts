// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-rules-entry.js";
import type { RulesEntryModel } from "../mc-rules-entry.types.js";

afterEach(() => document.body.replaceChildren());

const entry = (over: Partial<RulesEntryModel> = {}): RulesEntryModel => ({
  id: "retaliate",
  name: "Retaliate",
  definition: "After this enemy attacks, it deals damage back.",
  cite: "RRG 1.8 p. 38",
  tiles: [{ key: "row:entry:retaliate:card:01", name: "Rhino", cardId: "01", picture: { src: null } }],
  more: 2,
  ...over,
});

async function make(model: RulesEntryModel) {
  const el = document.createElement("mc-rules-entry");
  el.entry = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-rules-entry", () => {
  it("is a focus stop with its term, definition, source and a strip of cards", async () => {
    const el = await make(entry());
    expect(el.dataset.stop).toBe("row:entry:retaliate");
    const root = el.shadowRoot!;
    expect(root.querySelector(".term")!.textContent).toBe("Retaliate");
    expect(root.querySelector(".cite")!.textContent).toBe("RRG 1.8 p. 38");
    expect(root.querySelector('[data-stop="row:entry:retaliate:card:01"]')).not.toBeNull();
    expect(root.querySelector(".more")).not.toBeNull();
  });

  it("opens its first card on Enter and Inspect, and follows an origin link instead when it has one", async () => {
    const el = await make(entry());
    const heard = vi.fn();
    el.addEventListener("mc-rules", (event) => heard(event.detail));
    el.click();
    el.inspect();
    expect(heard.mock.calls.map(([detail]) => detail)).toEqual([
      { type: "card", key: "row:entry:retaliate:card:01" },
      { type: "card", key: "row:entry:retaliate:card:01" },
    ]);
    const linked = await make(entry({ origin: { text: "Added with Mutant Genesis", boxId: "mutant-genesis" } }));
    const origin = vi.fn();
    linked.addEventListener("mc-rules", (event) => origin(event.detail));
    linked.click();
    expect(origin).toHaveBeenCalledWith({ type: "origin", boxId: "mutant-genesis" });
  });

  it("marks a status with a stripe class beside its plain word", async () => {
    const el = await make(entry({ id: "stunned", name: "Stunned", status: "stunned", tiles: [], more: 0 }));
    expect(el.shadowRoot!.querySelector(".card")!.classList.contains("stunned")).toBe(true);
    expect(el.shadowRoot!.querySelector(".term")!.textContent).toBe("Stunned");
  });
});
