// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { findAll, mount, wordsOf } from "../../test-support.js";
import "../mc-briefing-pool-group.js";

afterEach(() => document.body.replaceChildren());

const rows = [
  {
    fieldId: "a",
    name: "Black Cat",
    destination: "Put into play at setup.",
    destinationKind: "intoPlay",
    helps: true,
    card: { cardId: "01002", name: "Black Cat" },
    picture: { src: null, missing: "no scan" },
  },
  {
    fieldId: "b",
    name: "Rhino",
    destination: "Put into play at setup.",
    destinationKind: "intoPlay",
    helps: false,
    card: null,
    picture: { src: null, missing: "no scan" },
  },
];

describe("mc-briefing-pool-group", () => {
  it("a wide group is a boxed header over picture tiles, each with its ALLY or ENEMY word", async () => {
    const el = await mount("mc-briefing-pool-group", { group: { kind: "intoPlay", rows } });
    expect(findAll(el, "mc-briefing-card-thumb")).toHaveLength(2);
    expect(wordsOf(el)).toContain("INTO PLAY");
    expect(wordsOf(el)).toContain("ALLY");
    expect(wordsOf(el)).toContain("ENEMY");
  });

  it("a phone group is a header bar over the flat rows", async () => {
    const el = await mount("mc-briefing-pool-group", { group: { kind: "intoPlay", rows }, phone: true });
    expect(findAll(el, "mc-briefing-pool-row")).toHaveLength(2);
  });
});
