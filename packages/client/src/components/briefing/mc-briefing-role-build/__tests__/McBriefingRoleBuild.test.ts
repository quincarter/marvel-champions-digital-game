// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, findAll, mount, press, stopsOf, wordsOf } from "../../test-support.js";
import "../mc-briefing-role-build.js";

afterEach(() => document.body.replaceChildren());

const cards = [
  { id: "e1", label: "Drop Kick", name: "Drop Kick", type: "event", aspect: "aggression", cost: 1, text: "Attack. Deal 3 damage." },
  { id: "e2", label: "Toe to Toe", name: "Toe to Toe", type: "event", aspect: "protection", cost: 4, text: "Attack." },
];

const model = {
  build: {
    ctx: {
      heroName: "Colossus",
      roleName: "Brawler",
      roleAspects: ["aggression", "protection"],
      deckAspects: ["justice"],
      atk: 3,
      thw: 1,
    },
    cards,
  },
  pictures: new Map(),
  confirmGlyph: null,
  phone: false,
};

const next = async (el: Element) => (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

describe("mc-briefing-role-build", () => {
  it("starts on the list: an intro, the filter chips, every card and Decline", async () => {
    const el = await mount("mc-briefing-role-build", { model });
    const stops = stopsOf(el);
    expect(stops).toContain("rb-chip:all");
    expect(stops).toContain("rb-take:e1");
    expect(stops).toContain("rb-take:e2");
    expect(stops).toContain("call-decline");
    expect(wordsOf(el)).toContain("Brawler");
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="call-decline"]')!);
    expect(seen).toEqual([{ type: "answer", picked: [] }]);
  });

  it("Take opens the confirm step, and only Confirm answers; Back returns to the list", async () => {
    const el = await mount("mc-briefing-role-build", { model });
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="rb-take:e2"]')!);
    await next(el);
    const stops = stopsOf(el);
    expect(stops).toEqual(["rb-back", "rb-inspect", "rb-confirm"]);
    expect(wordsOf(el)).toContain("ADD TOE TO TOE TO COLOSSUS");
    expect(seen).toEqual([]);
    press(find(el, '[data-stop="rb-back"]')!);
    await next(el);
    expect(stopsOf(el)).toContain("rb-take:e2");
    press(find(el, '[data-stop="rb-take:e1"]')!);
    await next(el);
    press(find(el, '[data-stop="rb-confirm"]')!);
    expect(seen).toEqual([{ type: "answer", picked: ["e1"] }]);
  });

  it("a card taken from the Inspect sheet opens the same confirm step", async () => {
    const el = await mount("mc-briefing-role-build", { model });
    (el as unknown as { take(id: string): void }).take("e1");
    await next(el);
    expect(stopsOf(el)).toEqual(["rb-back", "rb-inspect", "rb-confirm"]);
  });

  it("a filter chip narrows the list to its aspect", async () => {
    const el = await mount("mc-briefing-role-build", { model });
    press(find(el, '[data-stop="rb-chip:protection"]')!);
    await next(el);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const takes = findAll(el, '[data-stop^="rb-take:"]').map((node) => node.getAttribute("data-stop"));
    expect(takes).toEqual(["rb-take:e2"]);
  });
});
