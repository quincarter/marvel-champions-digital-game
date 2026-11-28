import { afterEach, describe, expect, it, vi } from "vitest";
import { watchCard, type CardHoverDetail } from "./card-events.js";

afterEach(() => document.body.replaceChildren());

const pointer = (type: string, pointerType: string): Event => Object.assign(new Event(type), { pointerType });

describe("watchCard", () => {
  it("raises mc-card-hover with the card and the picture's box when a mouse enters, and -end when it leaves", () => {
    const el = document.createElement("div");
    document.body.append(el);
    const seen: string[] = [];
    document.body.addEventListener("mc-card-hover", (e) => seen.push(`hover:${(e.detail as CardHoverDetail).cardId}`));
    document.body.addEventListener("mc-card-hover-end", (e) => seen.push(`end:${e.detail.cardId}`));
    watchCard(el, () => ({ cardId: "01094" }));
    el.dispatchEvent(pointer("pointerenter", "mouse"));
    el.dispatchEvent(pointer("pointerleave", "mouse"));
    expect(seen).toEqual(["hover:01094", "end:01094"]);
  });

  it("raises no hover for a finger or pen, and nothing while no card is shown", () => {
    const el = document.createElement("div");
    document.body.append(el);
    const hover = vi.fn();
    document.body.addEventListener("mc-card-hover", hover);
    let card: { cardId: string } | null = { cardId: "01094" };
    watchCard(el, () => card);
    el.dispatchEvent(pointer("pointerenter", "touch"));
    card = null;
    el.dispatchEvent(pointer("pointerenter", "mouse"));
    expect(hover).not.toHaveBeenCalled();
  });

  it("stops listening when undone", () => {
    const el = document.createElement("div");
    document.body.append(el);
    const hover = vi.fn();
    document.body.addEventListener("mc-card-hover", hover);
    const undo = watchCard(el, () => ({ cardId: "x" }));
    undo();
    el.dispatchEvent(pointer("pointerenter", "mouse"));
    expect(hover).not.toHaveBeenCalled();
  });
});
