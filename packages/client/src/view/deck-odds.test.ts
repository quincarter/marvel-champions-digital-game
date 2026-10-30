import { describe, expect, test } from "vitest";
import { CORE_CARDS, CORE_STARTER_DECKS, deckFromStarterDeck, type AnyCard } from "@mc/content";
import { deckCopiesOf, drawOdds, oddsGroupsOf, oddsRowsOf, percentText } from "./deck-odds.js";

const byId = new Map(CORE_CARDS.map((card) => [card.id as string, card]));
const cardOf = (id: string): AnyCard | undefined => byId.get(id);

describe("deck odds (issue #531)", () => {
  test("hypergeometric odds sum to 1 and match a hand computation", () => {
    // 40 cards, 10 resources, top 2 (Black Cat): P(0) = 30·29 / (40·39), P(2) = 10·9 / (40·39).
    const odds = drawOdds(40, 10, 2);
    expect(odds).toHaveLength(3);
    expect(odds[0]).toBeCloseTo((30 * 29) / (40 * 39), 10);
    expect(odds[2]).toBeCloseTo((10 * 9) / (40 * 39), 10);
    expect(odds.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    // More draws than hits: the list stops at every hit drawn.
    expect(drawOdds(40, 1, 6)).toHaveLength(2);
    expect(drawOdds(40, 1, 6)[1]).toBeCloseTo(6 / 40, 10);
    // Drawing the whole deck draws every hit.
    expect(drawOdds(5, 2, 9)).toEqual([0, 0, 1]);
  });

  test("rows fold 3 and up, and the at-least-one chance", () => {
    const { rows, atLeastOne } = oddsRowsOf([0.1, 0.2, 0.3, 0.25, 0.15]);
    expect(rows.map((r) => r.label)).toEqual(["0", "1", "2", "3+"]);
    expect(rows[3]!.p).toBeCloseTo(0.4, 10);
    expect(atLeastOne).toBeCloseTo(0.9, 10);
  });

  test("percent text never rounds a near-certainty to a certainty", () => {
    expect(percentText(0.004)).toBe("<1%");
    expect(percentText(0.996)).toBe(">99%");
    expect(percentText(0.414)).toBe("41%");
    expect(percentText(0)).toBe("0%");
  });

  test("groups from a Core precon: icons count wild toward every icon, then types, traits and titles", () => {
    const deck = deckFromStarterDeck(CORE_STARTER_DECKS[0]!, "poolv1");
    const copies = deckCopiesOf(deck, cardOf);
    expect(copies.length).toBe(deck.cards.reduce((n, line) => n + line.quantity, 0));
    const groups = oddsGroupsOf(copies);
    const ids = groups.map((g) => g.id);
    expect(ids[0]!.startsWith("icon:")).toBe(true);
    expect(ids.some((id) => id.startsWith("type:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("title:"))).toBe(true);
    expect(groups.every((g) => g.count > 0)).toBe(true);
    const wild = groups.find((g) => g.id === "icon:wild")?.count ?? 0;
    const physical = groups.find((g) => g.id === "icon:physical")!.count;
    expect(physical).toBeGreaterThanOrEqual(wild);
    const resources = groups.find((g) => g.id === "type:resource")!.count;
    expect(resources).toBe(copies.filter((c) => c.type === "resource").length);
  });
});
