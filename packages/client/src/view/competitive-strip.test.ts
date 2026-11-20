import { describe, expect, test } from "vitest";
import { competitiveStripOf } from "./competitive-strip.js";
import type { CompetitiveBoard } from "./board-model.js";

const board = (over: Partial<CompetitiveBoard> = {}): CompetitiveBoard => ({
  mySide: "registration",
  activeSide: "registration",
  phase: "hero",
  inactive: false,
  turnLine: "",
  other: {
    side: "resistance",
    leader: { name: "Iron Man", hp: { current: 14, max: 20 }, instanceId: "i1" as never },
    mainScheme: { name: "Superhero Registration", threat: 3, target: 9 },
    minionCount: 2,
    sideSchemeCount: 1,
    heroes: [
      { playerId: "p2" as never, name: "Hulkling", hp: { current: 7, max: 10 }, handCount: 4, eliminated: false },
    ],
    encounterDeck: 30,
  },
  ...over,
});

describe("competitiveStripOf", () => {
  test("words the other side with counts only", () => {
    const strip = competitiveStripOf(board(), 200);
    expect(strip.lines[0]!.text).toBe(
      "Resistance table: Leader: Iron Man 14/20 HP · Scheme 3/9 · 2 minions · 1 side schemes",
    );
    expect(strip.lines[1]!.text).toBe("Hulkling 7/10 (4 in hand)");
    expect(strip.leaderId).toBe("i1");
    expect(strip.lines.some((l) => l.tone === "alert")).toBe(false);
  });

  test("an inactive side gets an alert line in words", () => {
    const strip = competitiveStripOf(board({ inactive: true }), 200);
    expect(strip.lines.at(-1)).toMatchObject({ tone: "alert" });
    expect(strip.lines.at(-1)!.text).toMatch(/inactive/);
  });

  test("wraps to the character budget", () => {
    const strip = competitiveStripOf(board(), 30);
    expect(strip.lines.length).toBeGreaterThan(2);
    expect(strip.lines.every((l) => l.text.length <= 30 || !l.text.includes(" "))).toBe(true);
  });

  test("never carries a hand or deck beyond counts", () => {
    const text = JSON.stringify(competitiveStripOf(board(), 200));
    expect(text).not.toMatch(/cardId|hand":\[/);
  });
});
