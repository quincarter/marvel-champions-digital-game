/**
 * F5/F6 of docs/phase7-wave6-qa-modular-matrix.md: modular picks are checked before a game is built (RRG 1.8 "Modular
 * Encounter Set", p. 29; "Standard Set" p. 40; MC21 p. 16), and the owner's Q-M3 (Experimental Weapons).
 */
import { PLAYABLE_ENCOUNTER_SETS } from "./modular-pool.js";
import { describe, expect, it } from "vitest";
import { playableScenario } from "./playable/index.js";

const seat = [{ starterDeckId: "core-she-hulk-aggression" }] as const;
const build = (scenario: string, modularSetIds: readonly string[]) =>
  playableScenario(scenario, { seed: 1, players: [...seat], modularSetIds });

describe("modular picks", () => {
  it("a pick that meets the scenario's count still builds", () => {
    expect(() => build("sandman", ["exodus"])).not.toThrow();
    expect(() => build("red-skull", ["bomb_scare", "exper_weapon"])).not.toThrow();
  });

  it("the wrong number of picks is refused (Red Skull asks for two, Crossbones for three, Rhino for one)", () => {
    expect(() => build("red-skull", ["bomb_scare"])).toThrow(/uses 2 modular set/);
    expect(() => build("crossbones", ["bomb_scare", "under_attack"])).toThrow(/uses 3 modular set/);
    expect(() => build("rhino", [])).toThrow(/uses 1 modular set/);
  });

  it("another scenario's own set is refused", () => {
    expect(() => build("sandman", ["rhino"])).toThrow(/belongs to another scenario/);
  });

  it("Experimental Weapons is already part of Crossbones (Q-M3) and an ordinary pick elsewhere", () => {
    expect(() => build("crossbones", ["exper_weapon", "bomb_scare", "under_attack"])).toThrow(/already part of/);
    expect(() => build("rhino", ["exper_weapon"])).not.toThrow();
  });

  it("the Galaxy's Most Wanted Campaign Challenge set is a campaign set, not a modular pick (RRG p. 61 lists eight)", () => {
    expect(PLAYABLE_ENCOUNTER_SETS.find((set) => set.id === "challenge")?.campaignSpecific).toBe(true);
    expect(() => build("rhino", ["challenge"])).toThrow(/challenge is a campaign set/);
  });

  it("Tower Defense refuses the Infinity Gauntlet set (MC21 p. 16)", () => {
    expect(() => build("tower-defense", ["infinity_gauntlet"])).toThrow(/more than one villain/);
  });
});
