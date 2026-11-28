// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { CARDS_BY_ID } from "../../../../../content/pool.js";
import { cardOfName } from "../../names.js";
import type { BriefingPoolRow, BriefingPoolView } from "../../../../../view/campaign-pool-model.js";
import { bangersMock, recorder, sectionHarness, textsOf } from "../sections.test-support.js";
import { drawPool } from "./pool.js";
import { poolBadgeIn, poolGroupTitleIn, poolHeadingIn } from "./pool-text.js";

vi.mock("phaser", () => ({ default: {}, Scene: class {} }));
vi.mock("../../../../../ui/campaign-chrome.js", () => bangersMock);
vi.mock("../../../../../dom/ui-layer.js", () => ({ uiLayer: () => document.body }));

const [first, second] = [...CARDS_BY_ID.values()];
const row = (over: Partial<BriefingPoolRow> = {}): BriefingPoolRow => ({
  fieldId: "f1",
  name: first!.name,
  helps: true,
  destination: "Put into play.",
  destinationKind: "intoPlay",
  badgeLabel: "ALLY",
  ...over,
});
const flat = (rows: readonly BriefingPoolRow[]): BriefingPoolView => ({ rows, groups: null });

describe("From the pool", () => {
  it("draws one row per card, each picture its own stop that opens the card", () => {
    const h = sectionHarness();
    const pool = flat([row(), row({ fieldId: "f2", name: second!.name, helps: false })]);
    const { b, bottom } = h.run((base) => drawPool({ ...base, pool }, recorder()));
    expect(h.stopKeys()).toEqual(["pool-card:f1", "pool-card:f2"]);
    expect(bottom).toBeGreaterThan(100);
    expect(textsOf(b)).toEqual(expect.arrayContaining(["✓", "✗", "FROM THE POOL"]));
    expect(h.ctx.inspects.has("pool-card:f2")).toBe(true);
  });

  it("opens a pool card in Inspect by its id", () => {
    const h = sectionHarness();
    h.run((base) => drawPool({ ...base, pool: flat([row()]) }, { inspect: (card) => h.ctx.inspectCard(card.cardId) }));
    h.press("pool-card:f1");
    expect(h.inspected.map((open) => open.cardId)).toEqual([cardOfName(first!.name)!.id]);
  });

  it("gives a card the pool has no scan for a plain frame and nothing to press", () => {
    const h = sectionHarness();
    h.run((base) => drawPool({ ...base, pool: flat([row({ name: "No Such Card" })]) }, recorder()));
    expect(h.stopKeys()).toEqual([]);
  });

  it("stacks the finale's groups on a phone and grids them on a wide column", () => {
    const groups = [
      { kind: "intoPlay", title: "Into play", subtitle: "x", rows: [row()] },
      {
        kind: "encounterDeck",
        title: "Encounter deck",
        subtitle: "x",
        rows: [row({ fieldId: "f2", name: second!.name })],
      },
    ] as const;
    const pool: BriefingPoolView = { rows: groups.flatMap((group) => group.rows), groups };
    const phone = sectionHarness();
    const stacked = phone.run((base) => drawPool({ ...base, pool }, recorder()));
    expect(textsOf(stacked.b)).toContain("FROM THE POOL · 2 CARDS");
    expect(phone.stopKeys()).toEqual(["pool-card:f1", "pool-card:f2"]);
    const wide = sectionHarness(() => {}, false);
    const grid = wide.run((base) => drawPool({ ...base, pool }, recorder()));
    expect(wide.stopKeys()).toEqual(["pool-card:f1", "pool-card:f2"]);
    expect(textsOf(grid.b)).toEqual(expect.arrayContaining(["INTO PLAY", "ENCOUNTER DECK", "ALLY"]));
  });
});

describe("the pool's words", () => {
  it("says the destination kinds and the badges", () => {
    expect(poolHeadingIn(null)).toBe("From the pool");
    expect(poolHeadingIn(1)).toBe("From the pool · 1 card");
    expect(poolGroupTitleIn("eachPlayersDeck")).toBe("Each player's deck");
    expect(poolBadgeIn({ destinationKind: "upgrades", helps: false })).toBe("Against");
    expect(poolBadgeIn({ destinationKind: "encounterDeck", helps: false })).toBe("Enemy");
  });
});
