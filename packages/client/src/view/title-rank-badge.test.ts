import { describe, expect, it } from "vitest";
import { RANKS } from "../progression/achievements.js";
import { RANK_SEEN_KEY, lastRankSeen, rememberRankSeen } from "../platform/rank-seen.js";
import { rankUpAnnouncementOf, titleRankBadgeOf } from "./title-rank-badge.js";

describe("titleRankBadgeOf", () => {
  it("words rank, points and the step to the next rank", () => {
    const badge = titleRankBadgeOf(0);
    expect(badge.rankLabel).toBe("RANK 1");
    expect(badge.title).toBe(RANKS[0]!.title);
    expect(badge.pointsLabel).toBe("0 pts");
    expect(badge.fraction).toBe(0);
    expect(badge.nextLabel).toBe(`${RANKS[1]!.threshold} to ${RANKS[1]!.title}`);
    expect(badge.shortNextLabel).toBe(`${RANKS[1]!.threshold} to rank 2`);
  });

  it("fills part of the bar between ranks and groups thousands", () => {
    const points = RANKS[2]!.threshold + 1000;
    const badge = titleRankBadgeOf(points);
    expect(badge.rankLabel).toBe("RANK 3");
    expect(badge.fraction).toBeGreaterThan(0);
    expect(badge.fraction).toBeLessThan(1);
    expect(badge.pointsLabel).toBe(`${points.toLocaleString("en-US")} pts`);
  });

  it("reads Top rank with a full bar at the last rank", () => {
    const top = RANKS.at(-1)!;
    const badge = titleRankBadgeOf(top.threshold);
    expect(badge.rankLabel).toBe("RANK 9");
    expect(badge.fraction).toBe(1);
    expect(badge.nextLabel).toBe("Top rank");
    expect(badge.shortNextLabel).toBe("Top rank");
    expect(badge.summary).toContain("Opens the Trophy Room");
  });
});

describe("rankUpAnnouncementOf", () => {
  const pointsFor = (rank: number): number => RANKS[rank - 1]!.threshold;

  it("only records on the first visit, announcing nothing", () => {
    expect(rankUpAnnouncementOf(null, pointsFor(4))).toEqual({ announce: false, text: "", remember: 4 });
  });

  it("announces a higher rank by name and remembers it", () => {
    expect(rankUpAnnouncementOf(2, pointsFor(3))).toEqual({
      announce: true,
      text: `Rank up: ${RANKS[2]!.title}`,
      remember: 3,
    });
  });

  it("stays quiet at the same rank, and never lowers the remembered rank", () => {
    expect(rankUpAnnouncementOf(3, pointsFor(3)).announce).toBe(false);
    expect(rankUpAnnouncementOf(5, pointsFor(2))).toEqual({ announce: false, text: "", remember: 5 });
  });
});

describe("the remembered rank", () => {
  const memory = (): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  };

  it("round-trips through storage", () => {
    const store = memory();
    expect(lastRankSeen(store)).toBeNull();
    rememberRankSeen(4, store);
    expect(store.data.get(RANK_SEEN_KEY)).toBe("4");
    expect(lastRankSeen(store)).toBe(4);
  });

  it("reads nonsense as nothing stored, and survives a store that throws", () => {
    const store = memory();
    store.data.set(RANK_SEEN_KEY, "banana");
    expect(lastRankSeen(store)).toBeNull();
    const broken = {
      getItem: (): string | null => {
        throw new Error("blocked");
      },
      setItem: (): void => {
        throw new Error("full");
      },
    };
    expect(lastRankSeen(broken)).toBeNull();
    expect(() => rememberRankSeen(2, broken)).not.toThrow();
    expect(lastRankSeen(null)).toBeNull();
    expect(() => rememberRankSeen(2, null)).not.toThrow();
  });
});
