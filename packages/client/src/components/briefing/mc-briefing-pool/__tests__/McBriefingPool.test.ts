// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { findAll, mount, wordsOf } from "../../test-support.js";
import "../mc-briefing-pool.js";
import "../../mc-briefing-pool-group/mc-briefing-pool-group.js";

afterEach(() => document.body.replaceChildren());

const row = (id: string) => ({
  fieldId: id,
  name: id,
  destination: "Shuffled in.",
  destinationKind: "encounterDeck",
  helps: false,
  card: null,
  picture: { src: null, missing: "no scan" },
});

describe("mc-briefing-pool", () => {
  it("lists the flat rows under the From the pool heading", async () => {
    const el = await mount("mc-briefing-pool", { model: { rows: [row("a"), row("b")], groups: null } });
    expect(findAll(el, "mc-briefing-pool-row")).toHaveLength(2);
    expect(wordsOf(el)).toContain("FROM THE POOL");
  });

  it("the finale shows one group per destination and counts the cards in the heading", async () => {
    const rows = [row("a"), row("b")];
    const el = await mount("mc-briefing-pool", {
      model: { rows, groups: [{ kind: "encounterDeck", rows }] },
    });
    expect(findAll(el, "mc-briefing-pool-group")).toHaveLength(1);
    expect(wordsOf(el)).toContain("FROM THE POOL · 2 CARDS");
  });
});
