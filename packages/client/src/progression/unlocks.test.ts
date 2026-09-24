import { describe, expect, it } from "vitest";
import { POOL_SCENARIOS, POOL_STARTER_DECKS } from "../content/pool.js";
import {
  DEFAULT_UNLOCK_PREFS,
  NO_PROGRESS,
  UNLOCK_HEROES,
  UNLOCK_WAVES,
  Unlocks,
  devUnlockAllFrom,
  heroCycleOf,
  parseUnlockPrefs,
  progressOf,
  scenarioCycleOf,
  toggleHeroPref,
  type UnlockProgress,
} from "./unlocks.js";

const scenario = (id: string) => POOL_SCENARIOS.find((s) => (s.id as string) === id)!;
const heroNamed = (name: string) => UNLOCK_HEROES.find((h) => h.name === name)!.identityCardId;
const fresh = (progress: UnlockProgress = NO_PROGRESS) => new Unlocks({ progress, prefs: DEFAULT_UNLOCK_PREFS });

describe("the unlock path", () => {
  it("lists every wave the pool's scenarios and heroes come from", () => {
    const listed = new Set(UNLOCK_WAVES.map((w) => w.cycleId));
    for (const s of POOL_SCENARIOS) expect(listed, `${s.id as string}`).toContain(scenarioCycleOf(s));
    for (const d of POOL_STARTER_DECKS) expect(listed, d.name).toContain(heroCycleOf(d.identityCardId as string));
  });

  it("names only scenarios that exist as gates", () => {
    const ids = new Set(POOL_SCENARIOS.map((s) => s.id as string));
    for (const wave of UNLOCK_WAVES) {
      if (wave.gate?.kind === "scenarioWin") for (const id of wave.gate.scenarioIds) expect(ids).toContain(id);
    }
  });

  it("opens only the Core Set on a first launch", () => {
    const u = fresh();
    expect(u.scenarioLock(scenario("rhino"))).toBeNull();
    expect(u.scenarioLock(scenario("ultron"))).toBeNull();
    expect(u.heroLock(heroNamed("Spider-Man"))).toBeNull();
    expect(u.scenarioLock(scenario("risky-business"))).toBe("Beat Rhino to unlock Wave 1");
    expect(u.heroLock(heroNamed("Thor"))).toBe("Beat Rhino to unlock Wave 1");
    expect(u.scenarioLock(scenario("red-skull"))).not.toBeNull();
    expect(u.campaignLock("trors")).not.toBeNull();
    expect(u.heroLock(heroNamed("Groot"))).not.toBeNull();
  });

  it("opens each wave in turn", () => {
    const rhino = fresh({ wonScenarioIds: ["rhino"], wonCampaignIds: [] });
    expect(rhino.heroLock(heroNamed("Thor"))).toBeNull();
    expect(rhino.scenarioLock(scenario("breakout"))).toBeNull();
    expect(rhino.campaignLock("trors")).toBe("Beat Green Goblin or the Wrecking Crew to unlock The Rise of Red Skull");

    const goblin = fresh({ wonScenarioIds: ["mutagen-formula", "rhino"], wonCampaignIds: [] });
    expect(goblin.campaignLock("trors")).toBeNull();
    expect(goblin.heroLock(heroNamed("Hawkeye"))).toBeNull();
    expect(goblin.campaignLock("gmw")).toBe(
      "Complete The Rise of Red Skull campaign to unlock The Galaxy's Most Wanted",
    );

    const skull = fresh({ wonScenarioIds: ["mutagen-formula", "rhino"], wonCampaignIds: ["trors"] });
    expect(skull.campaignLock("gmw")).toBeNull();
    expect(skull.heroLock(heroNamed("Venom"))).toBeNull();
  });

  it("keeps what was earned out of order", () => {
    // A campaign won while everything was unlocked still opens the next wave once the setting is off.
    const u = fresh({ wonScenarioIds: [], wonCampaignIds: ["trors"] });
    expect(u.campaignLock("gmw")).toBeNull();
    expect(u.campaignLock("trors")).not.toBeNull();
  });
});

describe("opting out", () => {
  it("opens everything with the setting or the dev param", () => {
    const all = new Unlocks({ progress: NO_PROGRESS, prefs: { unlockAll: true, heroIds: [] } });
    const dev = new Unlocks({ progress: NO_PROGRESS, prefs: DEFAULT_UNLOCK_PREFS, devUnlockAll: true });
    for (const u of [all, dev]) {
      expect(u.everything).toBe(true);
      expect(u.campaignLock("gmw")).toBeNull();
      for (const s of POOL_SCENARIOS) expect(u.scenarioLock(s)).toBeNull();
      for (const h of UNLOCK_HEROES) expect(u.heroLock(h.identityCardId)).toBeNull();
      expect(u.heroEarned(heroNamed("Thor"))).toBe(false);
    }
  });

  it("opens a single hero without its wave", () => {
    const thor = heroNamed("Thor");
    const u = new Unlocks({ progress: NO_PROGRESS, prefs: toggleHeroPref(DEFAULT_UNLOCK_PREFS, thor) });
    expect(u.heroLock(thor)).toBeNull();
    expect(u.heroLock(heroNamed("Hulk"))).not.toBeNull();
    expect(u.scenarioLock(scenario("risky-business"))).not.toBeNull();
    expect(toggleHeroPref(toggleHeroPref(DEFAULT_UNLOCK_PREFS, thor), thor).heroIds).toEqual([]);
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
    expect(parseUnlockPrefs('{"unlockAll":"yes","heroIds":["03001a",4]}')).toEqual({
      unlockAll: false,
      heroIds: ["03001a"],
    });
    expect(parseUnlockPrefs('{"unlockAll":true}')).toEqual({ unlockAll: true, heroIds: [] });
  });
});

describe("progressOf", () => {
  it("counts only wins", () => {
    const progress = progressOf(
      [
        { status: "won", config: { scenarioId: "rhino" } },
        { status: "won", config: { scenarioId: "rhino" } },
        { status: "lost", config: { scenarioId: "klaw" } },
        { status: "abandoned", config: { scenarioId: "ultron" } },
      ],
      [
        { status: "won", campaignId: "trors" },
        { status: "active", campaignId: "gmw" },
      ],
    );
    expect(progress).toEqual({ wonScenarioIds: ["rhino"], wonCampaignIds: ["trors"] });
  });

  it("lists every pool hero once", () => {
    const ids = UNLOCK_HEROES.map((h) => h.identityCardId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(UNLOCK_HEROES.filter((h) => h.name === "Captain Marvel")).toHaveLength(1);
  });
});
