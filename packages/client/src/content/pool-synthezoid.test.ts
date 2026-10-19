import { describe, expect, it } from "vitest";
import type { Scenario } from "@mc/content";
import { DEFAULT_UNLOCK_PREFS, NO_PROGRESS, Unlocks, scenarioCycleOf } from "../progression/unlocks.js";
import { POOL_HERO_SHELF_PACKS, POOL_PACKS, POOL_SCENARIOS } from "./pool.js";

/**
 * Synthezoid Smackdown sits in cycle 10 between Civil War and Wonder Man (the owner's decision of 2026-10-19;
 * docs/phase7-synthezoid.md section 1.2 item 7 and test T3). `scenarioCycleOf` reads the shelf packs, so a pack missing
 * there would have no cycle and its scenarios would fall outside the wave lock.
 */
const codes = POOL_PACKS.map((p) => p.code as string);
const scenario = (id: string) => POOL_SCENARIOS.find((s) => (s.id as string) === id)!;

describe("T3: the pool lists Synthezoid Smackdown between Civil War and Wonder Man", () => {
  it("in POOL_PACKS", () => {
    expect(codes.indexOf("synthezoid")).toBe(codes.indexOf("cw") + 1);
    expect(codes.indexOf("wonder_man")).toBe(codes.indexOf("synthezoid") + 1);
  });

  it("in the hero shelf packs, in cycle 10", () => {
    const shelf = POOL_HERO_SHELF_PACKS.map((p) => p.code);
    expect(shelf.indexOf("synthezoid")).toBe(shelf.indexOf("cw") + 1);
    expect(shelf.indexOf("wonder_man")).toBe(shelf.indexOf("synthezoid") + 1);
    const pack = POOL_HERO_SHELF_PACKS.find((p) => p.code === "synthezoid")!;
    expect([pack.cycleId, pack.cycleOrder, pack.cycleName]).toEqual(["cycle10", 10, "Civil War"]);
  });

  it("gives its pack cycle 10, locked exactly as Civil War's four (its scenarios are gated while unscripted)", () => {
    const sz = { id: "registration-she-hulk", packCode: "synthezoid" } as Pick<Scenario, "id" | "packCode">;
    expect(scenarioCycleOf(sz)).toBe("cycle10");
    expect(POOL_SCENARIOS.some((s) => s.packCode === "synthezoid")).toBe(false);
    const fresh = new Unlocks({ progress: NO_PROGRESS, prefs: DEFAULT_UNLOCK_PREFS });
    const civilWar = fresh.scenarioLock(scenario("registration-iron-man"));
    expect(civilWar).not.toBeNull();
    expect(fresh.scenarioLock(sz)).toBe(civilWar);
    const finished = new Unlocks({
      progress: { ...NO_PROGRESS, wonCampaignIds: ["aos"] },
      prefs: DEFAULT_UNLOCK_PREFS,
    });
    expect(finished.scenarioLock(sz)).toBeNull();
  });
});
