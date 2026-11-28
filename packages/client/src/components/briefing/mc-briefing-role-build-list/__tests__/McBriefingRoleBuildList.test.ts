// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, mount, press, stepEvents, stopsOf, wordsOf } from "../../test-support.js";
import "../mc-briefing-role-build-list.js";

afterEach(() => document.body.replaceChildren());

const stamp = { aspect: "justice", label: "Justice", fill: 0xf4c20d, ink: 0 };
const card = (id: string, recommended: boolean) => ({
  id,
  label: `Card ${id}`,
  name: `Card ${id}`,
  aspect: stamp,
  cost: 2,
  recommended,
  reason: recommended ? "Cheap: costs 2" : null,
});

const view = {
  noun: "event",
  chips: [],
  recommended: [card("r1", true)],
  rest: [card("c1", false), card("c2", false)],
  all: [card("r1", true), card("c1", false), card("c2", false)],
};

describe("mc-briefing-role-build-list", () => {
  it("keeps every card stop: the picture, Take, and Inspect or the name read", async () => {
    const el = await mount("mc-briefing-role-build-list", { model: { view, pictures: new Map() } });
    const stops = stopsOf(el);
    for (const key of [
      "rb-card:r1",
      "rb-inspect:r1",
      "rb-take:r1",
      "rb-card:c1",
      "rb-read:c1",
      "rb-take:c1",
      "rb-take:c2",
    ]) {
      expect(stops, key).toContain(key);
    }
    expect(wordsOf(el)).toContain("RECOMMENDED FOR YOU");
    expect(wordsOf(el)).toContain("Cost 2 · Justice");
  });

  it("Take is a step, and a picture offers Take this card from Inspect", async () => {
    const el = await mount("mc-briefing-role-build-list", { model: { view, pictures: new Map() } });
    const steps = stepEvents(el);
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="rb-take:c2"]')!);
    expect(steps).toEqual([{ type: "take", id: "c2" }]);
    press(find(el, '[data-stop="rb-card:c1"]')!);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ type: "inspect", cardId: "c1", choice: { optionId: "c1" } });
  });
});
