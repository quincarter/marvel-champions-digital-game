// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, findAll, mount, press, stopsOf, wordsOf } from "../../test-support.js";
import "../mc-briefing-scheme-pick.js";

afterEach(() => document.body.replaceChildren());

const card = (key: string, caption: string) => ({
  key,
  caption,
  earned: key === "environment",
  cardId: `c-${key}`,
  name: `Card ${key}`,
  shape: "portrait",
  picture: { src: null, missing: "no scan" },
});

const rows = ["Mission Prep", "Gear Up"].map((name) => ({
  name,
  label: `${name} → Done`,
  cards: [card("scheme", "Scheme"), card("environment", "Earns"), card("encounter", "Brings")],
}));

describe("mc-briefing-scheme-pick", () => {
  it("each row has a stop per card picture and its own PICK", async () => {
    const el = await mount("mc-briefing-scheme-pick", { model: { rows } });
    const stops = stopsOf(el);
    expect(stops).toContain("call-scheme:Mission Prep:scheme");
    expect(stops).toContain("call-scheme:Gear Up:encounter");
    expect(stops).toContain("call-option:Mission Prep");
    expect(findAll(el, "mc-button").filter((button) => button.getAttribute("label") === null)).toHaveLength(2);
    expect(wordsOf(el).match(/PICK/g)).toHaveLength(2);
  });

  it("Pick answers with the row name, and reading a card answers nothing", async () => {
    const el = await mount("mc-briefing-scheme-pick", { model: { rows } });
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="call-scheme:Gear Up:environment"]')!);
    expect(seen).toEqual([{ type: "inspect", cardId: "c-environment", name: "Card environment" }]);
    press(find(el, '[data-stop="call-option:Gear Up"]')!);
    expect(seen[1]).toEqual({ type: "answer", picked: ["Gear Up"] });
  });
});
