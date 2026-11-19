import { describe, expect, it } from "vitest";
import type { SessionConfig } from "../engine/host.js";
import type { Rect } from "./layout.js";
import type { PastGameNames } from "./past-games-model.js";
import { VERSUS_GAP, replayMatchupOf, versusLayout } from "./replay-matchup.js";

const names: PastGameNames = {
  scenarioName: (id) => (id === "rhino" ? "Rhino" : undefined),
  identityName: (id) => ({ "spider-man": "Spider-Man", "she-hulk": "She-Hulk" })[id],
  starterDeckName: () => undefined,
  campaignName: () => undefined,
  starterIdentity: (id) => (id === "she-hulk-precon" ? "she-hulk" : undefined),
  scenarioCardId: (id) => (id === "rhino" ? "rhino-1" : undefined),
};

const config = (players: unknown[], scenarioId = "rhino"): SessionConfig =>
  ({ scenarioId, difficulty: "standard", players }) as unknown as SessionConfig;

describe("replayMatchupOf (issue #858)", () => {
  it("names the villain and each hero, from a saved deck or a precon", () => {
    const matchup = replayMatchupOf(
      config([{ identityCardId: "spider-man", deck: [] }, { starterDeckId: "she-hulk-precon" }]),
      names,
    );
    expect(matchup).toEqual({
      scenarioId: "rhino",
      villain: { cardId: "rhino-1", name: "Rhino" },
      heroes: [
        { cardId: "spider-man", name: "Spider-Man" },
        { cardId: "she-hulk", name: "She-Hulk" },
      ],
    });
  });

  it("falls back to the ids for a hero or scenario the pool doesn't know, and skips an unknown precon", () => {
    const matchup = replayMatchupOf(
      config([{ identityCardId: "gone-hero", deck: [] }, { starterDeckId: "nope" }], "gone"),
      names,
    );
    expect(matchup.villain).toEqual({ cardId: null, name: "gone" });
    expect(matchup.heroes).toEqual([{ cardId: "gone-hero", name: "gone-hero" }]);
  });

  it("names a game's custom content from its own packs", () => {
    const packs = [{ id: "pack" }];
    const forPacks = (given: readonly unknown[]): PastGameNames => {
      expect(given).toBe(packs);
      return { ...names, identityName: () => "Custom Hero" };
    };
    const matchup = replayMatchupOf(
      { ...config([{ identityCardId: "x", deck: [] }]), packs } as unknown as SessionConfig,
      { ...names, forPacks },
    );
    expect(matchup.heroes[0]?.name).toBe("Custom Hero");
  });
});

describe("versusLayout (issue #858)", () => {
  it("puts the villain left and the heroes right on a wide screen", () => {
    const layout = versusLayout(1280, 720, 2);
    expect(layout.wide).toBe(true);
    expect(layout.villain).toEqual({ x: 0, y: 0, width: 637, height: 720 });
    expect(layout.heroes).toHaveLength(2);
    expect(layout.heroes[0]!.x).toBe(637 + VERSUS_GAP);
    const last = layout.heroes[1]!;
    expect(last.x + last.width).toBe(1280);
    expect(layout.versus).toEqual({ x: 640, y: 360 });
  });

  it("puts the villain on top and the heroes below on a tall screen", () => {
    const layout = versusLayout(375, 667, 2);
    expect(layout.wide).toBe(false);
    expect(layout.villain.width).toBe(375);
    for (const hero of layout.heroes) expect(hero.y).toBe(layout.villain.height + VERSUS_GAP);
    expect(layout.heroes[1]!.x + layout.heroes[1]!.width).toBe(375);
    expect(layout.versus.x).toBe(Math.round(375 / 2));
  });

  it("puts four heroes two to a row, filling the heroes' half", () => {
    const layout = versusLayout(375, 667, 4);
    const [a, b, c, d] = layout.heroes as [Rect, Rect, Rect, Rect];
    expect(a.y).toBe(b.y);
    expect(c.y).toBe(d.y);
    expect(c.y).toBeGreaterThan(a.y + a.height);
    expect(b.x + b.width).toBe(375);
    expect(d.y + d.height).toBe(667);
  });

  it("stretches a third hero across the second row", () => {
    const layout = versusLayout(1280, 720, 3);
    const side = { x: layout.heroes[0]!.x, right: 1280 };
    const third = layout.heroes[2]!;
    expect(third.x).toBe(side.x);
    expect(third.x + third.width).toBe(side.right);
    expect(third.y + third.height).toBe(720);
  });

  it("lifts the names that would meet VERSUS on the seam", () => {
    const tall = versusLayout(375, 667, 2);
    expect(tall.villainNameLift).toBeGreaterThan(0);
    expect(tall.heroNameLifts).toEqual([0, 0]);
    const wide = versusLayout(1440, 980, 4);
    expect(wide.villainNameLift).toBe(0);
    expect(wide.heroNameLifts[0]).toBeGreaterThan(0);
    expect(wide.heroNameLifts.slice(1)).toEqual([0, 0, 0]);
    expect(versusLayout(1440, 980, 2).heroNameLifts).toEqual([0, 0]);
  });

  it("starts a hero's picture below VERSUS where the tile's top meets it", () => {
    const tall = versusLayout(820, 1180, 1);
    expect(tall.heroArtDrops[0]).toBeGreaterThan(0);
    const wide = versusLayout(1440, 980, 4);
    expect(wide.heroArtDrops).toEqual([0, 0, wide.heroArtDrops[2], 0]);
    expect(wide.heroArtDrops[2]).toBeGreaterThan(0);
    expect(versusLayout(1440, 980, 2).heroArtDrops).toEqual([0, 0]);
  });

  it("keeps the VERSUS mark readable on a phone and bounded on a big screen", () => {
    expect(versusLayout(375, 667, 1).versusSize).toBeGreaterThanOrEqual(44);
    expect(versusLayout(3840, 2160, 1).versusSize).toBeLessThanOrEqual(120);
  });
});
