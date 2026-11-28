// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, tap } from "../../shared/test-support.js";
import "../mc-pool-cell.js";
import type { McPoolCell } from "../McPoolCell.js";
import type { PoolCardModel } from "../mc-pool-cell.types.js";

afterEach(() => document.body.replaceChildren());

export const card = (over: Partial<PoolCardModel> = {}): PoolCardModel => ({
  cardId: "01022",
  picture: { src: "a.png", missing: "Web-Swing" },
  title: "Web-Swing",
  cost: 1,
  caption: "Event",
  captionStrong: false,
  typeLine: "Event",
  note: null,
  rules: "",
  quantity: 0,
  minus: { aria: "Remove", disabled: true },
  plus: { aria: "Add", disabled: null },
  face: null,
  ...over,
});

describe("mc-pool-cell", () => {
  it("is the card:<id> stop and draws the name, cost and caption", async () => {
    const el = await mount<McPoolCell>("mc-pool-cell", { model: card() });
    expect(el.dataset.stop).toBe("card:01022");
    expect(inner(el, ".title")!.textContent).toBe("Web-Swing");
    expect(inner(el, ".cost")!.textContent).toBe("1");
    expect(inner(el, ".line")!.textContent!.trim()).toBe("Event");
  });

  it("adds a copy on the route's Enter and opens the card on its Inspect and on a tap", async () => {
    const el = await mount<McPoolCell>("mc-pool-cell", { model: card({ face: "Enhanced" }) });
    const seen = builderEvents(el);
    el.click();
    el.inspect();
    tap(inner(el, ".face")!);
    expect(seen).toEqual([
      { type: "add", cardId: "01022" },
      { type: "open", cardId: "01022", face: "Enhanced" },
      { type: "open", cardId: "01022", face: "Enhanced" },
    ]);
  });

  it("wears the red frame only while a copy is in the deck", async () => {
    const el = await mount<McPoolCell>("mc-pool-cell", { model: card({ quantity: 2 }) });
    expect(el.hasAttribute("framed")).toBe(true);
    el.model = card({ quantity: 0 });
    await el.updateComplete;
    expect(el.hasAttribute("framed")).toBe(false);
  });
});
