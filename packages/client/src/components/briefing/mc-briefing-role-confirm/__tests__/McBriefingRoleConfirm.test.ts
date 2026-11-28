// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { find, mount, press, stepEvents, stopsOf, wordsOf } from "../../test-support.js";
import "../mc-briefing-role-confirm.js";

afterEach(() => document.body.replaceChildren());

const model = {
  roleId: "brawler",
  title: "COLOSSUS WILL BE THE BRAWLER",
  chips: [{ aspect: "aggression", label: "Aggression" }],
  summary: "The front-line fighter.",
  relation: "Adds Aggression",
  notes: ["Role upgrades.", "Role-building.", "Recorded in the campaign log."],
  bar: { stops: { back: "role-back", confirm: "role-confirm" }, glyph: null },
  phone: false,
};

describe("mc-briefing-role-confirm", () => {
  it("states the pick in words, and only Confirm is the forward stop", async () => {
    const el = await mount("mc-briefing-role-confirm", { model });
    expect(wordsOf(el)).toContain("COLOSSUS WILL BE THE BRAWLER");
    expect(wordsOf(el)).toContain("Recorded in the campaign log.");
    expect(stopsOf(el)).toEqual(["role-back", "role-confirm"]);
  });

  it("the bar steps reach the call that owns them", async () => {
    const el = await mount("mc-briefing-role-confirm", { model });
    const seen = stepEvents(el);
    press(find(el, '[data-stop="role-confirm"]')!);
    press(find(el, '[data-stop="role-back"]')!);
    expect(seen).toEqual([{ type: "confirm" }, { type: "back" }]);
  });
});
