import { describe, expect, it } from "vitest";
import { POOL_SCENARIOS, POOL_STARTER_DECKS } from "../content/pool.js";
import {
  DEFAULT_UNLOCK_PREFS,
  NO_PROGRESS,
  POINTS,
  UNLOCK_CAMPAIGNS,
  UNLOCK_HEROES,
  UNLOCK_WAVES,
  Unlocks,
  devUnlockAllFrom,
  heroCycleOf,
  newsBetween,
  parseUnlockPrefs,
  progressOf,
  relock,
  scenarioCycleOf,
  unlockByHand,
  villainLabelOf,
  withWin,
  type UnlockPrefs,
  type UnlockProgress,
} from "./unlocks.js";

const scenario = (id: string) => POOL_SCENARIOS.find((s) => (s.id as string) === id)!;
const heroNamed = (name: string) => UNLOCK_HEROES.find((h) => h.name === name)!.identityCardId;
const won = (wonScenarioIds: string[], wonCampaignIds: string[] = []): UnlockProgress => ({
  ...NO_PROGRESS,
  wonScenarioIds,
  wonCampaignIds,
});
/** 750 points (a Galaxy's Most Wanted campaign, won and won on Expert) and nothing on the path opened by it. */
const RICH: UnlockProgress = { ...NO_PROGRESS, wonCampaignIds: ["gmw"], wonExpertCampaignIds: ["gmw"] };
const make = (progress: UnlockProgress = NO_PROGRESS, prefs: UnlockPrefs = DEFAULT_UNLOCK_PREFS) =>
  new Unlocks({ progress, prefs });

describe("the unlock path", () => {
  it("lists every wave the pool's scenarios and heroes come from", () => {
    const listed = new Set(UNLOCK_WAVES.map((w) => w.cycleId));
    for (const s of POOL_SCENARIOS) expect(listed, `${s.id as string}`).toContain(scenarioCycleOf(s));
    for (const d of POOL_STARTER_DECKS) expect(listed, d.name).toContain(heroCycleOf(d.identityCardId as string));
  });

  it("gives every hero outside the Core Set exactly one way in: its box's cast or one villain", () => {
    for (const hero of UNLOCK_HEROES) {
      const wave = UNLOCK_WAVES.find((w) => w.cycleId === hero.cycleId)!;
      if (wave.starterHeroIds === "all") continue;
      const ways =
        (wave.starterHeroIds.includes(hero.identityCardId) ? 1 : 0) +
        wave.heroRewards.filter((r) => r.identityCardId === hero.identityCardId).length;
      expect(ways, hero.name).toBe(1);
    }
  });

  it("names only scenarios and heroes that exist", () => {
    const ids = new Set(POOL_SCENARIOS.map((s) => s.id as string));
    const heroes = new Set(UNLOCK_HEROES.map((h) => h.identityCardId));
    for (const wave of UNLOCK_WAVES) {
      if (wave.gate?.kind === "scenarioWin") for (const id of wave.gate.scenarioIds) expect(ids).toContain(id);
      for (const reward of wave.heroRewards) {
        expect(ids).toContain(reward.scenarioId);
        expect(heroes).toContain(reward.identityCardId);
      }
    }
    expect(UNLOCK_CAMPAIGNS.map((c) => c.campaignId)).toEqual(["trors", "gmw"]);
  });

  it("keeps the Core Set fully open and nothing else on a first launch", () => {
    const u = make();
    for (const s of POOL_SCENARIOS.filter((s) => scenarioCycleOf(s) === "core")) expect(u.scenarioLock(s)).toBeNull();
    for (const h of UNLOCK_HEROES.filter((h) => h.cycleId === "core")) expect(u.heroLock(h.identityCardId)).toBeNull();
    expect(u.scenarioLock(scenario("risky-business"))).toBe("Beat Rhino to unlock Wave 1");
    expect(u.heroLock(heroNamed("Thor"))).toBe("Beat Rhino to unlock Wave 1");
    expect(u.campaignLock("trors")).not.toBeNull();
  });

  it("opens heroes one villain at a time", () => {
    const rhino = make(won(["rhino"]));
    expect(rhino.heroLock(heroNamed("Captain America"))).toBeNull();
    expect(rhino.heroLock(heroNamed("Thor"))).toBe("Beat Ultron to unlock Thor");
    expect(rhino.heroLock(heroNamed("Black Widow"))).toBe("Beat Norman Osborn (Risky Business) to unlock Black Widow");
    expect(rhino.scenarioLock(scenario("breakout"))).toBeNull();
    // One Rhino win leaves the Core Set: The Rise of Red Skull opens with Wave 1.
    expect(rhino.scenarioLock(scenario("red-skull"))).toBeNull();
    expect(rhino.campaignLock("trors")).toBeNull();
    expect(rhino.campaignLock("gmw")).not.toBeNull();
    expect(make(won(["rhino", "ultron"])).heroLock(heroNamed("Thor"))).toBeNull();
  });

  it("seats a campaign box's cast when its wave opens, and the rest as its villains fall", () => {
    const goblin = make(won(["rhino"]));
    expect(goblin.campaignLock("trors")).toBeNull();
    expect(goblin.heroLock(heroNamed("Hawkeye"))).toBeNull();
    expect(goblin.heroLock(heroNamed("Spider-Woman"))).toBeNull();
    expect(goblin.heroLock(heroNamed("Ant-Man"))).toBe("Beat Crossbones to unlock Ant-Man");
    expect(make(won(["rhino", "crossbones"])).heroLock(heroNamed("Ant-Man"))).toBeNull();
    expect(goblin.campaignLock("gmw")).toBe(
      "Complete The Rise of Red Skull campaign to unlock The Galaxy's Most Wanted",
    );

    const skull = make(won(["rhino"], ["trors"]));
    expect(skull.campaignLock("gmw")).toBeNull();
    expect(skull.heroLock(heroNamed("Groot"))).toBeNull();
    expect(skull.heroLock(heroNamed("Venom"))).toBe("Beat Nebula to unlock Venom");
  });

  it("names a villain by its scenario when they differ", () => {
    expect(villainLabelOf("rhino")).toBe("Rhino");
    expect(villainLabelOf("infiltrate-the-museum")).toMatch(/\(Infiltrate the Museum\)$/);
  });
});

describe("opening things by hand", () => {
  it("opens everything with the setting or the dev param", () => {
    const all = make(NO_PROGRESS, { ...DEFAULT_UNLOCK_PREFS, unlockAll: true });
    const dev = new Unlocks({ progress: NO_PROGRESS, prefs: DEFAULT_UNLOCK_PREFS, devUnlockAll: true });
    for (const u of [all, dev]) {
      expect(u.everything).toBe(true);
      for (const c of UNLOCK_CAMPAIGNS) expect(u.campaignLock(c.campaignId)).toBeNull();
      for (const s of POOL_SCENARIOS) expect(u.scenarioLock(s)).toBeNull();
      for (const h of UNLOCK_HEROES) expect(u.heroLock(h.identityCardId)).toBeNull();
      expect(u.heroEarned(heroNamed("Thor"))).toBe(false);
    }
  });

  it("opens one hero, charging for it once and refunding nothing", () => {
    const thor = heroNamed("Thor");
    const progress: UnlockProgress = { ...RICH, wonScenarioIds: ["rhino"] };
    const prefs = unlockByHand(make(progress), { kind: "hero", identityCardId: thor });
    expect(prefs.charges).toEqual([{ id: `hero:${thor}`, points: POINTS.unlockHero }]);
    const opened = make(progress, prefs);
    expect(opened.heroLock(thor)).toBeNull();
    expect(opened.heroLock(heroNamed("Hulk"))).not.toBeNull();
    expect(opened.points()).toEqual({ earned: 850, spent: 150, total: 700 });

    const closed = make(progress, relock(prefs, { kind: "hero", identityCardId: thor }));
    expect(closed.heroLock(thor)).not.toBeNull();
    expect(closed.points().spent).toBe(POINTS.unlockHero);
    expect(closed.chargesFor({ kind: "hero", identityCardId: thor })).toEqual([]);
  });

  it("never spends points the player hasn't earned", () => {
    const thor = heroNamed("Thor");
    const poor = make(won(["rhino"]));
    expect(poor.canAfford({ kind: "hero", identityCardId: thor })).toBe(false);
    expect(unlockByHand(poor, { kind: "hero", identityCardId: thor })).toBe(poor.prefs);
    expect(poor.canAfford({ kind: "scenario", scenarioId: "red-skull" })).toBe(true);
  });

  it("charges nothing for what play already opened", () => {
    expect(make(won(["rhino"])).chargesFor({ kind: "hero", identityCardId: heroNamed("Captain America") })).toEqual([]);
    expect(make(won(["rhino"])).chargesFor({ kind: "campaign", campaignId: "trors" })).toEqual([]);
  });

  it("opens a campaign with its cast, out of the Saga's order", () => {
    const u = make(RICH, unlockByHand(make(RICH), { kind: "campaign", campaignId: "gmw" }));
    expect(u.campaignLock("gmw")).toBeNull();
    expect(u.campaignManual("gmw")).toBe(true);
    expect(u.heroLock(heroNamed("Groot"))).toBeNull();
    expect(u.heroLock(heroNamed("Venom"))).not.toBeNull();
    expect(u.points().spent).toBe(POINTS.unlockCampaign);
  });

  it("opens everything for free, with no points needed", () => {
    const u = make();
    expect(u.chargesFor({ kind: "everything" })).toEqual([]);
    expect(u.canAfford({ kind: "everything" })).toBe(true);
    const prefs = unlockByHand(u, { kind: "everything" });
    expect(prefs).toMatchObject({ unlockAll: true, charges: [] });
    expect(make(NO_PROGRESS, prefs).points()).toEqual({ earned: 0, spent: 0, total: 0 });
  });
});

describe("points and news", () => {
  it("scores first wins, Expert wins and campaigns", () => {
    const u = make({
      wonScenarioIds: ["klaw", "rhino"],
      wonExpertScenarioIds: ["rhino"],
      wonCampaignIds: ["trors"],
      wonExpertCampaignIds: ["trors"],
    });
    expect(u.points().earned).toBe(2 * 100 + 50 + 500 + 250);
  });

  it("says what a win just opened", () => {
    const before = make();
    const after = make(withWin(before.progress, "rhino", "expert"));
    expect(newsBetween(before, after)).toEqual({
      points: 150,
      unlocked: ["Wave 1", "The Rise of Red Skull", "Captain America", "Hawkeye", "Spider-Woman"],
    });
    const again = make(withWin(after.progress, "rhino", "standard"));
    expect(newsBetween(after, again)).toEqual({ points: 0, unlocked: [] });
  });
});

describe("storage", () => {
  it("counts only wins", () => {
    const progress = progressOf(
      [
        { status: "won", config: { scenarioId: "rhino", difficulty: "standard" } },
        { status: "won", config: { scenarioId: "rhino", difficulty: "expert" } },
        { status: "lost", config: { scenarioId: "klaw", difficulty: "expert" } },
        { status: "abandoned", config: { scenarioId: "ultron" } },
      ],
      [
        { status: "won", campaignId: "trors", modes: { campaign: { expertCampaign: true } } },
        { status: "active", campaignId: "gmw" },
      ],
    );
    expect(progress).toEqual({
      wonScenarioIds: ["rhino"],
      wonExpertScenarioIds: ["rhino"],
      wonCampaignIds: ["trors"],
      wonExpertCampaignIds: ["trors"],
    });
  });

  it("reads the dev param", () => {
    expect(devUnlockAllFrom("?unlock=all")).toBe(true);
    expect(devUnlockAllFrom("?screen=seats&unlock=all")).toBe(true);
    expect(devUnlockAllFrom("?unlock=none")).toBe(false);
    expect(devUnlockAllFrom("")).toBe(false);
  });

  it("reads stored preferences defensively", () => {
    expect(parseUnlockPrefs(null)).toEqual(DEFAULT_UNLOCK_PREFS);
    expect(parseUnlockPrefs("not json")).toEqual(DEFAULT_UNLOCK_PREFS);
    expect(
      parseUnlockPrefs(
        '{"version":2,"unlockAll":"yes","heroIds":["03001a",4],"charges":[{"id":"hero:03001a","points":150},{}]}',
      ),
    ).toEqual({
      unlockAll: false,
      heroIds: ["03001a"],
      campaignIds: [],
      scenarioIds: [],
      charges: [{ id: "hero:03001a", points: 150 }],
    });
    // Before version 2, "Unlock everything" charged points; those charges are dropped rather than kept negative.
    expect(parseUnlockPrefs('{"unlockAll":true,"charges":[{"id":"hero:03001a","points":150}]}').charges).toEqual([]);
  });

  it("lists every pool hero once", () => {
    const ids = UNLOCK_HEROES.map((h) => h.identityCardId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("your own decks", () => {
  it("locks only preconstructed decks", () => {
    const u = make();
    const thor = heroNamed("Thor");
    expect(u.deckLock({ identityCardId: thor, source: { kind: "precon" } })).toBe("Beat Rhino to unlock Wave 1");
    expect(u.deckLock({ identityCardId: thor, source: { kind: "imported" } })).toBeNull();
    expect(u.deckLock({ identityCardId: thor, source: { kind: "built" } })).toBeNull();
  });
});

describe("scenarios by hand", () => {
  it("opens one scenario on its own, for the price of a first win", () => {
    const u = make();
    expect(u.chargesFor({ kind: "scenario", scenarioId: "klaw" })).toEqual([]);
    expect(u.chargesFor({ kind: "scenario", scenarioId: "red-skull" })).toEqual([
      { id: "scenario:red-skull", points: POINTS.unlockScenario },
    ]);
    const opened = make(RICH, unlockByHand(make(RICH), { kind: "scenario", scenarioId: "red-skull" }));
    expect(opened.scenarioLock(scenario("red-skull"))).toBeNull();
    expect(opened.scenarioLock(scenario("zola"))).not.toBeNull();
    expect(opened.points().spent).toBe(POINTS.unlockScenario);
  });

  it("says where earned points came from", () => {
    const u = make({ ...NO_PROGRESS, wonScenarioIds: ["rhino"], wonExpertScenarioIds: ["rhino"] });
    expect(u.pointsSources()).toEqual([
      { label: "First win: Rhino", points: 100 },
      { label: "First Expert win: Rhino", points: 50 },
    ]);
    expect(make().pointsSources()).toEqual([]);
  });
});
