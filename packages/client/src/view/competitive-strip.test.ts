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

describe("competitiveStripOf on a narrow screen", () => {
  const captain = board({
    other: {
      ...board().other,
      leader: { name: "Captain America", hp: { current: 14, max: 14 }, instanceId: "i1" as never },
    },
  });

  test("the leader's name and HP stay on one line, whatever the width", () => {
    for (const width of [32, 39, 60]) {
      const lines = competitiveStripOf(captain, width).lines.map((l) => l.text);
      expect(lines.some((text) => text.includes("Leader: Captain America 14/14 HP"))).toBe(true);
    }
  });

  test("the table title stands alone when the leader does not fit beside it", () => {
    const lines = competitiveStripOf(captain, 39).lines.map((l) => l.text);
    expect(lines[0]).toBe("Resistance table:");
    expect(lines[1]).toBe("Leader: Captain America 14/14 HP");
  });

  test("a wrapped inactive banner marks its first line only, the rest are continued", () => {
    const lines = competitiveStripOf({ ...captain, inactive: true }, 39).lines.filter((l) => l.tone === "alert");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0]!.continued).toBeUndefined();
    expect(lines.slice(1).every((l) => l.continued === true)).toBe(true);
  });
});

describe("a hero too long for a line breaks before its hand count", () => {
  test("name and hit points first, then the count", () => {
    const wide = board({
      other: {
        ...board().other,
        heroes: [
          {
            playerId: "p2" as never,
            name: "Spider-Man (Peter Parker)",
            hp: { current: 10, max: 10 },
            handCount: 6,
            eliminated: false,
          },
        ],
      },
    });
    const lines = competitiveStripOf(wide, 33).lines.map((l) => l.text);
    expect(lines).toContain("Spider-Man (Peter Parker) 10/10");
    expect(lines).toContain("(6 in hand)");
  });
});
