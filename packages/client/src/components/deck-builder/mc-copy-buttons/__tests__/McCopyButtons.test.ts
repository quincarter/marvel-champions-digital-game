// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount } from "../../shared/test-support.js";
import "../mc-copy-buttons.js";
import type { McCopyButtons } from "../McCopyButtons.js";
import type { CopyButtonsModel } from "../mc-copy-buttons.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<CopyButtonsModel> = {}): CopyButtonsModel => ({
  cardId: "01022",
  minus: { aria: "Remove a copy", disabled: null },
  plus: { aria: "Add a copy", disabled: null },
  ...over,
});

const button = (el: McCopyButtons, key: string): HTMLElement => inner<HTMLElement>(el, `[data-key="${key}"]`)!;
const pressed = (target: HTMLElement): void => {
  target.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
};

describe("mc-copy-buttons", () => {
  it("says add or remove for the card when a button is pressed", async () => {
    const el = await mount<McCopyButtons>("mc-copy-buttons", { model: model(), quantity: 1 });
    const seen = builderEvents(el);
    pressed(button(el, "plus:01022"));
    pressed(button(el, "minus:01022"));
    expect(seen).toEqual([
      { type: "add", cardId: "01022" },
      { type: "remove", cardId: "01022" },
    ]);
  });

  it("shows the copies in the deck, and nothing at none", async () => {
    const el = await mount<McCopyButtons>("mc-copy-buttons", { model: model(), quantity: 2 });
    expect(inner(el, ".qty")!.textContent).toBe("×2");
    el.quantity = 0;
    await el.updateComplete;
    expect(inner(el, ".qty")!.textContent).toBe("");
  });

  it("dims a refused button and carries the reason as its tooltip", async () => {
    const el = await mount<McCopyButtons>("mc-copy-buttons", {
      model: model({ plus: { aria: "Add", disabled: "Campaign removed this card" } }),
    });
    const plus = button(el, "plus:01022") as HTMLElement & { reason: string };
    expect(plus.hasAttribute("disabled")).toBe(true);
    expect(plus.reason).toBe("Campaign removed this card");
    expect(button(el, "minus:01022").hasAttribute("disabled")).toBe(false);
  });
});
