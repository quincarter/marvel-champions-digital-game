// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, findAll, mount, press, stopsOf, wordsOf } from "../../test-support.js";
import "../mc-briefing-carry-in.js";

afterEach(() => document.body.replaceChildren());

const carry = {
  key: "spent",
  title: "Spent schemes",
  detail: "Struck on the sheet.",
  cards: [
    { cardId: "40001", name: "Mission Prep" },
    { cardId: "40001", name: "Mission Prep" },
    { cardId: "40002", name: "Gear Up" },
  ],
};

describe("mc-briefing-carry-in", () => {
  it("names each distinct card once as an Inspect chip, a repeat reading times two", async () => {
    const el = await mount("mc-briefing-carry-in", { carry });
    expect(findAll(el, "mc-briefing-inspect-chip")).toHaveLength(2);
    expect(wordsOf(el)).toContain("Mission Prep ×2");
    expect(stopsOf(el)).toEqual(["carry:spent:40001", "carry:spent:40002"]);
    expect(find(el, ".detail")?.textContent).toBe("Struck on the sheet.");
  });

  it("a chip reads the card and answers nothing", async () => {
    const el = await mount("mc-briefing-carry-in", { carry });
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="carry:spent:40002"]')!);
    expect(seen).toEqual([{ type: "inspect", cardId: "40002", name: "Gear Up" }]);
  });
});
