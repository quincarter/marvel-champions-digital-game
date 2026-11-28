// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, tap } from "../../shared/test-support.js";
import "../mc-pool-row.js";
import type { McPoolRow } from "../McPoolRow.js";
import type { PoolCardModel } from "../mc-pool-row.types.js";

afterEach(() => document.body.replaceChildren());

const card = (over: Partial<PoolCardModel> = {}): PoolCardModel => ({
  cardId: "01022",
  picture: { src: "a.png" },
  title: "Web-Swing",
  cost: 1,
  caption: "",
  captionStrong: false,
  typeLine: "Event · Aggression",
  note: "Spider-Man's aspect",
  rules: "Interrupt: Do a thing.",
  quantity: 2,
  minus: { aria: "Remove", disabled: null },
  plus: { aria: "Add", disabled: null },
  face: null,
  ...over,
});

describe("mc-pool-row", () => {
  it("draws the name, type line, note and rules, and is the card:<id> stop", async () => {
    const el = await mount<McPoolRow>("mc-pool-row", { model: card() });
    expect(el.dataset.stop).toBe("card:01022");
    expect(inner(el, ".title")!.textContent).toBe("Web-Swing");
    expect(inner(el, ".type")!.textContent).toBe("Event · Aggression");
    expect(inner(el, ".note")!.textContent).toBe("Spider-Man's aspect");
    expect(inner(el, ".rules")!.textContent!.trim()).toBe("Interrupt: Do a thing.");
  });

  it("leaves the note and rules out when a card has none", async () => {
    const el = await mount<McPoolRow>("mc-pool-row", { model: card({ note: null, rules: "" }) });
    expect(inner(el, ".note")).toBeNull();
    expect(inner(el, ".rules")).toBeNull();
  });

  it("adds on the route's Enter, opens on Inspect and on a tap", async () => {
    const el = await mount<McPoolRow>("mc-pool-row", { model: card() });
    const seen = builderEvents(el);
    el.click();
    el.inspect();
    tap(inner(el, ".face")!);
    expect(seen.map((s) => s.type)).toEqual(["add", "open", "open"]);
  });
});
