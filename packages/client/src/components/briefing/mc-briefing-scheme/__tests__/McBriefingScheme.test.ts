// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { findAll, mount, stopsOf, wordsOf } from "../../test-support.js";
import "../mc-briefing-scheme.js";

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

const chosen = {
  heading: "SAFEHOUSE ESTABLISHED",
  repeated: true,
  cards: [card("scheme", "Scheme"), card("environment", "Earns"), card("encounter", "Brings")],
};

describe("mc-briefing-scheme", () => {
  it("shows the chosen row with its three cards as stops, and says when a retry repeats it", async () => {
    const el = await mount("mc-briefing-scheme", { model: { chosen, carryIns: [], fixedSets: null, phone: false } });
    expect(wordsOf(el)).toContain("SAFEHOUSE ESTABLISHED");
    expect(wordsOf(el)).toContain("SAME AS LAST TIME");
    expect(stopsOf(el)).toEqual(["scheme-chosen:scheme", "scheme-chosen:environment", "scheme-chosen:encounter"]);
  });

  it("lists the carry-ins and the fixed sets, and a row with nothing chosen has neither the row nor the marker", async () => {
    const el = await mount("mc-briefing-scheme", {
      model: {
        chosen: null,
        carryIns: [{ key: "k", title: "Spent", detail: "", cards: [] }],
        fixedSets: "Bomb Scare, Legions of Hydra",
        phone: false,
      },
    });
    expect(findAll(el, "mc-briefing-carry-in")).toHaveLength(1);
    expect(wordsOf(el)).toContain("FIXED SET");
    expect(wordsOf(el)).toContain("Bomb Scare, Legions of Hydra");
    expect(wordsOf(el)).not.toContain("SAME AS LAST TIME");
  });
});
