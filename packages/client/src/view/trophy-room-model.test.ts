import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_FAMILIES,
  NO_HISTORY,
  RANKS,
  achievementStatuses,
  type AchievementHistory,
} from "../progression/achievements.js";
import {
  DEFAULT_TROPHY_VIEW,
  TRACKED_LATER,
  formatTrophyNumber,
  trophyHeaderOf,
  trophyRowHeightsOf,
  trophyRowsOf,
  trophySortLabel,
  type TrophyRow,
  type TrophyView,
} from "./trophy-room-model.js";

const won = (scenarioId: string) => ({
  status: "won",
  round: 5,
  config: { scenarioId, players: [{ starterDeckId: "core-spider-man-justice" }] },
});
const history: AchievementHistory = { saves: [won("rhino"), won("klaw")], campaigns: [] };

const achievement = (rows: readonly TrophyRow[], id: string) => {
  const row = rows.find((r) => r.kind === "achievement" && r.id === id);
  if (!row || row.kind !== "achievement") throw new Error(`no row ${id}`);
  return row;
};

describe("trophyRowsOf", () => {
  const rows = trophyRowsOf(achievementStatuses(history));

  it("lists every achievement once, under its family heading, in the Trophy Room's order", () => {
    expect(rows.filter((r) => r.kind === "achievement")).toHaveLength(ACHIEVEMENTS.length);
    const headings = rows.flatMap((r) => (r.kind === "section" ? [r.id] : []));
    expect(headings).toEqual(ACHIEVEMENT_FAMILIES.map((f) => f.id));
    // Each achievement follows its own family's heading.
    let family = "";
    for (const row of rows) {
      if (row.kind === "section") family = row.id;
      else expect(ACHIEVEMENTS.find((a) => a.id === row.id)!.family).toBe(family);
    }
  });

  it("counts earned against the family total on the heading", () => {
    const wins = rows.find((r) => r.kind === "section" && r.id === "wins");
    expect(wins).toMatchObject({ count: "1 of 7 · 14%", expanded: true });
  });

  it("folds a family to its heading alone, and starts with every family folded (#479)", () => {
    const statuses = achievementStatuses(history);
    const folded = trophyRowsOf(statuses, DEFAULT_TROPHY_VIEW);
    expect(folded.every((r) => r.kind === "section" && !r.expanded)).toBe(true);
    expect(folded).toHaveLength(ACHIEVEMENT_FAMILIES.length);
    const one = trophyRowsOf(statuses, { ...DEFAULT_TROPHY_VIEW, expanded: new Set(["wins"]) });
    const wins = ACHIEVEMENTS.filter((a) => a.family === "wins").length;
    expect(one).toHaveLength(ACHIEVEMENT_FAMILIES.length + wins);
    expect(one[0]).toMatchObject({ kind: "section", id: "wins", expanded: true });
    expect(one.slice(1, 1 + wins).every((r) => r.kind === "achievement")).toBe(true);
  });

  describe("sorting", () => {
    const statuses = achievementStatuses(history);
    const all = new Set(ACHIEVEMENT_FAMILIES.map((f) => f.id));
    const headings = (view: Partial<TrophyView>) =>
      trophyRowsOf(statuses, { ...DEFAULT_TROPHY_VIEW, expanded: all, ...view }).flatMap((r) =>
        r.kind === "section" ? [r.title] : [],
      );
    const names = (family: string, view: Partial<TrophyView>) => {
      const rows = trophyRowsOf(statuses, { ...DEFAULT_TROPHY_VIEW, expanded: new Set([family]) as never, ...view });
      return rows.flatMap((r) => (r.kind === "achievement" ? [r.name] : []));
    };

    it("by category keeps the book's order, and reverses it descending", () => {
      const labels = ACHIEVEMENT_FAMILIES.map((f) => f.label);
      expect(headings({})).toEqual(labels);
      expect(headings({ descending: true })).toEqual([...labels].reverse());
    });

    it("by name sorts families and achievements alphabetically, either way", () => {
      const asc = headings({ sort: "name" });
      expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));
      expect(headings({ sort: "name", descending: true })).toEqual([...asc].reverse());
      const inWins = names("wins", { sort: "name" });
      expect(inWins).toEqual([...inWins].sort((a, b) => a.localeCompare(b)));
    });

    it("by completion puts the most-finished first descending, earned ones ahead of ones in progress", () => {
      const desc = headings({ sort: "completion", descending: true });
      expect(desc[0]).toBe("Battles won");
      const inWins = names("wins", { sort: "completion", descending: true });
      const first = ACHIEVEMENTS.find((a) => a.id === "wins-1")!.name;
      expect(inWins[0]).toBe(first);
    });

    it("by points orders achievements by what they are worth, ties in the book's order", () => {
      const rows = trophyRowsOf(statuses, { sort: "points", descending: true, expanded: all });
      const worth = new Map(ACHIEVEMENTS.map((a) => [a.id, a.points]));
      let last = Infinity;
      for (const row of rows) {
        if (row.kind === "section") last = Infinity;
        else {
          expect(worth.get(row.id)!).toBeLessThanOrEqual(last);
          last = worth.get(row.id)!;
        }
      }
    });
  });

  it("labels the sort for the Filters button", () => {
    expect(trophySortLabel({ sort: "completion", descending: true })).toBe("Complete % ▼");
    expect(trophySortLabel({ sort: "category", descending: false })).toBe("Category ▲");
  });

  it("marks earned and locked with a word, and gives a locked one its how-to", () => {
    const first = achievement(rows, "wins-1");
    expect(first).toMatchObject({ state: "earned", stateLabel: "EARNED", reward: "+25 points" });
    const five = achievement(rows, "wins-5");
    expect(five).toMatchObject({ state: "locked", stateLabel: "LOCKED", detail: "Win 5 battles." });
    expect(five.progress).toEqual({ current: 2, target: 5, fraction: 0.4 });
    expect(five.progressLabel).toBe("2 / 5");
    expect(first.progress).toBeNull();
  });

  it("says an untracked one is tracked from a future update, with no bar", () => {
    // None is untracked today, so mark one by hand to check the row still reads right.
    const untracked = achievementStatuses(history).map((s) =>
      s.def.id === "feat-one-hit-point" ? { ...s, def: { ...s.def, tracked: false } } : s,
    );
    const row = achievement(trophyRowsOf(untracked), "feat-one-hit-point");
    expect(row.state).toBe("untracked");
    expect(row.stateLabel).toBe("SOON");
    expect(row.detail).toContain(TRACKED_LATER);
    expect(row.progress).toBeNull();
  });

  it("names a silly pack for the funny ones instead of points", () => {
    expect(achievement(rows, "losses-10").reward).toBe("Silly pack");
  });

  it("shows every achievement locked on an empty history", () => {
    const none = trophyRowsOf(achievementStatuses(NO_HISTORY));
    expect(none.filter((r) => r.kind === "achievement" && r.state === "earned")).toHaveLength(0);
  });
});

describe("trophyHeaderOf", () => {
  it("shows the first rank with a bar toward the second", () => {
    const header = trophyHeaderOf(0, achievementStatuses(NO_HISTORY));
    expect(header).toMatchObject({ rankLabel: "Rank 1 of 9", title: RANKS[0]!.title, fraction: 0 });
    expect(header.nextLabel).toBe(`${RANKS[1]!.threshold} to ${RANKS[1]!.title}`);
  });

  it("reads lifetime points, halfway through a step", () => {
    const mid = (RANKS[2]!.threshold + RANKS[3]!.threshold) / 2;
    const header = trophyHeaderOf(mid, achievementStatuses(history));
    expect(header.rankLabel).toBe("Rank 3 of 9");
    expect(header.fraction).toBeCloseTo(0.5, 2);
    expect(header.pointsLabel).toBe(`${formatTrophyNumber(mid)} lifetime points`);
    expect(header.earnedLabel).toMatch(/^\d+ of \d+ achievements$/);
  });

  it("is full at the top rank", () => {
    const top = trophyHeaderOf(RANKS[8]!.threshold, achievementStatuses(NO_HISTORY));
    expect(top).toMatchObject({ rankLabel: "Rank 9 of 9", fraction: 1, nextLabel: "Top rank" });
  });
});

describe("formatting and sizing", () => {
  it("groups thousands", () => {
    expect(formatTrophyNumber(1250)).toBe("1,250");
    expect(formatTrophyNumber(12)).toBe("12");
    expect(formatTrophyNumber(1234567)).toBe("1,234,567");
  });

  it("gives a phone taller achievement rows than a desktop", () => {
    expect(trophyRowHeightsOf(true).achievement).toBeGreaterThan(trophyRowHeightsOf(false).achievement);
  });
});
