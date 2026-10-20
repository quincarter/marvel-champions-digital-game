import { describe, expect, test } from "vitest";
import {
  achievementToastRect,
  achievementToastsOf,
  extrasToastsOf,
  toastListLayout,
  newAchievementsOf,
  sampleAchievementToast,
  toastFrameAt,
  toastShapeAt,
} from "./achievement-toast.js";

describe("newAchievementsOf", () => {
  test("a first run (nothing stored) announces nothing and records what is earned", () => {
    const result = newAchievementsOf(null, ["wins-1", "wins-5"]);
    expect(result.fresh).toEqual([]);
    expect([...result.remember]).toEqual(["wins-1", "wins-5"]);
  });

  test("announces only what was not seen, in the earned order", () => {
    const result = newAchievementsOf(new Set(["wins-1"]), ["wins-1", "beat-rhino", "wins-5"]);
    expect(result.fresh).toEqual(["beat-rhino", "wins-5"]);
    expect([...result.remember].sort()).toEqual(["beat-rhino", "wins-1", "wins-5"]);
  });

  test("an id once seen stays seen even when no longer earned", () => {
    const result = newAchievementsOf(new Set(["wins-1", "beat-rhino"]), ["wins-1"]);
    expect(result.fresh).toEqual([]);
    expect(result.remember.has("beat-rhino")).toBe(true);
  });
});

describe("achievementToastsOf", () => {
  test("one alone names itself, with its points or its joke pack", () => {
    expect(achievementToastsOf([{ id: "wins-1", name: "First Blood", points: 10 }])).toEqual([
      { kind: "achievement", heading: "Achievement unlocked", title: "First Blood", reward: "+10 points", items: [] },
    ]);
    expect(
      achievementToastsOf([
        { id: "lose-10", name: "Glutton for Punishment", points: 0, rewardPackId: "pack-glutton" },
      ])[0]!.reward,
    ).toBe("Joke pack");
  });

  test("two or more stack into one popup that lists them all", () => {
    const toasts = achievementToastsOf([
      { id: "wins-1", name: "First Blood", points: 25 },
      { id: "beat-rhino", name: "Down Goes Rhino", points: 25 },
      { id: "lose-10", name: "Glutton for Punishment", points: 0, rewardPackId: "pack-glutton" },
    ]);
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      heading: "3 achievements unlocked",
      title: "Tap to see them all",
      reward: "+50 points",
    });
    expect(toasts[0]!.items).toEqual([
      { title: "First Blood", detail: "+25 points" },
      { title: "Down Goes Rhino", detail: "+25 points" },
      { title: "Glutton for Punishment", detail: "Joke pack" },
    ]);
  });

  test("none is no popup", () => {
    expect(achievementToastsOf([])).toEqual([]);
  });

  test("the Settings sample names its time", () => {
    expect(sampleAchievementToast(5).reward).toBe("5 s here");
  });
});

describe("extrasToastsOf", () => {
  test("one names itself under its kind; several stack as extras in the vault", () => {
    expect(extrasToastsOf([{ title: "The Rhino Has Fallen", label: "New song earned" }])).toEqual([
      { kind: "extra", heading: "New song earned", title: "The Rhino Has Fallen", reward: "", items: [] },
    ]);
    const five = Array.from({ length: 5 }, (_, i) => ({ title: `Song ${i}`, label: "New song earned" }));
    const [stack] = extrasToastsOf(five);
    expect(stack).toMatchObject({ kind: "extra", heading: "5 extras in the vault", title: "Tap to see them all" });
    expect(stack!.items).toHaveLength(5);
  });
});

describe("toastListLayout", () => {
  test("lists every line that fits, centered, with Collapse and Dismiss under them", () => {
    const layout = toastListLayout(5, 1440, 900, false);
    expect(layout.rows).toHaveLength(5);
    expect(layout.more).toBe(0);
    expect(layout.panel.x + layout.panel.width / 2).toBe(720);
    const lastRow = layout.rows.at(-1)!;
    expect(layout.collapse.y).toBeGreaterThanOrEqual(lastRow.y + lastRow.height);
    expect(layout.dismiss.x).toBeGreaterThan(layout.collapse.x);
    expect(layout.panel.y + layout.panel.height).toBeLessThanOrEqual(900);
  });

  test("more lines than fit end in a counted last row, and the panel stays on screen", () => {
    const layout = toastListLayout(60, 390, 844, true);
    expect(layout.more).toBeGreaterThan(0);
    expect(layout.rows.length + layout.more).toBe(60);
    expect(layout.moreRow).not.toBeNull();
    expect(layout.panel.y).toBeGreaterThanOrEqual(0);
    expect(layout.panel.y + layout.panel.height).toBeLessThanOrEqual(844);
  });
});

describe("achievementToastRect", () => {
  const W = 1440;
  const H = 900;

  test("centered across the screen, title bar above top above middle above bottom", () => {
    const middle = achievementToastRect("middle", W, H, false);
    expect(middle.x + middle.width / 2).toBe(W / 2);
    expect(middle.y + middle.height / 2).toBe(H / 2);
    const top = achievementToastRect("top", W, H, false);
    const bottom = achievementToastRect("bottom", W, H, false);
    const bar = achievementToastRect("titleBar", W, H, false);
    expect(bar.y).toBeLessThan(top.y);
    expect(top.y).toBeLessThan(middle.y);
    expect(middle.y).toBeLessThan(bottom.y);
    expect(bottom.y + bottom.height).toBeLessThan(H);
  });

  test("the title bar popup is slim enough for the top strip", () => {
    const bar = achievementToastRect("titleBar", W, H, false);
    expect(bar.y + bar.height).toBeLessThanOrEqual(60);
  });

  test("small and large scale the popup, still centered", () => {
    const medium = achievementToastRect("middle", W, H, false);
    const small = achievementToastRect("middle", W, H, false, 0.8);
    const large = achievementToastRect("middle", W, H, false, 1.3);
    expect(small.height).toBeLessThan(medium.height);
    expect(large.height).toBeGreaterThan(medium.height);
    expect(large.width).toBeGreaterThan(medium.width);
    expect(large.x + large.width / 2).toBe(W / 2);
  });

  test("a phone keeps a margin either side, even large", () => {
    for (const place of ["titleBar", "top", "middle", "bottom"] as const) {
      const rect = achievementToastRect(place, 390, 844, true, 1.3);
      expect(rect.x).toBeGreaterThanOrEqual(8);
      expect(rect.x + rect.width).toBeLessThanOrEqual(382);
    }
  });
});

describe("toastFrameAt", () => {
  test("pops, opens, holds, folds and is done when the time is up", () => {
    expect(toastFrameAt(0, 5000, false)).toMatchObject({ open: 0, done: false });
    expect(toastFrameAt(100, 5000, false).open).toBe(0);
    expect(toastFrameAt(400, 5000, false).open).toBeGreaterThan(0);
    expect(toastFrameAt(400, 5000, false).open).toBeLessThan(1);
    expect(toastFrameAt(2500, 5000, false)).toEqual({ badgeScale: 1, open: 1, alpha: 1, done: false });
    expect(toastFrameAt(4600, 5000, false).open).toBeLessThan(1);
    expect(toastFrameAt(4950, 5000, false).open).toBe(0);
    expect(toastFrameAt(5000, 5000, false).done).toBe(true);
  });

  test("reduced motion shows it open the whole time", () => {
    expect(toastFrameAt(0, 3000, true)).toEqual({ badgeScale: 1, open: 1, alpha: 1, done: false });
    expect(toastFrameAt(2999, 3000, true).open).toBe(1);
    expect(toastFrameAt(3000, 3000, true).done).toBe(true);
  });

  test("a time shorter than the moves squeezes them in", () => {
    expect(toastFrameAt(500, 1000, false).done).toBe(false);
    expect(toastFrameAt(1000, 1000, false).done).toBe(true);
  });
});

describe("toastShapeAt", () => {
  const rect = { x: 100, y: 50, width: 460, height: 72 };

  test("closed: just the badge, in the middle", () => {
    const { bar, badge } = toastShapeAt(rect, 0);
    expect(bar.width).toBe(72);
    expect(badge.cx).toBe(rect.x + rect.width / 2);
    expect(badge.r).toBe(36);
  });

  test("open: the whole rect, the badge at its left", () => {
    const { bar, badge } = toastShapeAt(rect, 1);
    expect(bar).toEqual(rect);
    expect(badge.cx).toBe(rect.x + 36);
  });
});
