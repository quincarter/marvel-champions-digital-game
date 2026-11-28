import { afterEach, describe, expect, it } from "vitest";
import "../mc-card-art";

afterEach(() => document.body.replaceChildren());

async function art(cardId: string) {
  const el = document.createElement("mc-card-art");
  el.cardId = cardId;
  el.face = { kind: "hero" };
  el.picture = { src: "a.png", missing: "Spider-Man" };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-card-art", () => {
  it("draws its picture in a tile", async () => {
    const el = await art("01001a");
    const tile = el.shadowRoot!.querySelector("mc-picture-tile")!;
    expect(tile.picture?.src).toBe("a.png");
  });

  it("raises the card hover events for the card and face it stands for", async () => {
    const el = await art("01001a");
    const seen: unknown[] = [];
    document.body.addEventListener("mc-card-hover", (e) => seen.push((e as CustomEvent).detail));
    document.body.addEventListener("mc-card-hover-end", (e) => seen.push((e as CustomEvent).detail));
    el.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    el.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatchObject({ cardId: "01001a", face: { kind: "hero" } });
    expect(seen[1]).toEqual({ cardId: "01001a" });
  });

  it("raises nothing without a card", async () => {
    const el = await art("");
    const seen: unknown[] = [];
    document.body.addEventListener("mc-card-hover", (e) => seen.push(e));
    el.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    expect(seen).toHaveLength(0);
  });
});
