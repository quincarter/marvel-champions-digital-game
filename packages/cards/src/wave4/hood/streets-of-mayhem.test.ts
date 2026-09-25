import { characterProfile, hasKeyword } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, firstLegal, settle } from "../../testing/harness.js";
import { runWave4, WAVE4_DEPS } from "../testing.js";
import { encounterCardInVillainArea, foldModularSetIntoDeck, game, onStage, stackTop, villainId } from "./testing.js";

/**
 * Real-game tests for the Streets of Mayhem modular set (`streets-of-mayhem.ts`): Back-Alley Enclave (24060), Sewer
 * Tunnels (24062) and Warehouse District (24063). Secret Lair (24061) is tested in
 * `hood-gaps.test.ts`.
 *
 * Ref -> covering test:
 *  24060.when-revealed               -> "discards each other Setting environment already in play"
 *  24060.back-alley-enclave-constant -> "every character gets +1 ATK"
 *  24062.when-revealed               -> "discards each other Setting environment already in play" (Sewer Tunnels)
 *  24062.sewer-tunnels-constant      -> "every character gains retaliate 1"
 *  24063.when-revealed               -> "discards each other Setting environment already in play" (Warehouse District)
 *  24063.warehouse-district-constant -> "every character gains steady"
 */

// streets_of_mayhem is the pack's 8th modular set, outside the default first-7 set-aside pool: name it explicitly.
const SETS_WITH_STREETS_OF_MAYHEM = [
  "beasty_boys",
  "brothers_grimm",
  "crossfire_crew",
  "mister_hyde",
  "ransacked_armory",
  "sinister_syndicate",
  "streets_of_mayhem",
];
const withSet = (seed = 1) => foldModularSetIntoDeck(game(seed, [], SETS_WITH_STREETS_OF_MAYHEM), "streets_of_mayhem");

describe("Streets of Mayhem (24060, 24062, 24063)", () => {
  it("24060.when-revealed: discards an already-in-play Setting environment", () => {
    const base = onStage(withSet(), 0);
    const already = encounterCardInVillainArea(base, "24063");
    const staged = stackTop(already.state, "01186", "24060");
    const revealed = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(revealed.villainArea).not.toContain(already.id);
  });

  it("24060.back-alley-enclave-constant: every character gets +1 ATK", () => {
    const before = onStage(withSet(), 0);
    const villainBefore = characterProfile(before, villainId(before), WAVE4_DEPS)!.atk;
    const identityBefore = characterProfile(before, before.players[0]!.identity.instanceId, WAVE4_DEPS)!.atk;
    const staged = encounterCardInVillainArea(before, "24060");
    expect(characterProfile(staged.state, villainId(staged.state), WAVE4_DEPS)!.atk).toBe(villainBefore + 1);
    expect(characterProfile(staged.state, staged.state.players[0]!.identity.instanceId, WAVE4_DEPS)!.atk).toBe(
      identityBefore + 1,
    );
  });

  it("24062.when-revealed: discards an already-in-play Setting environment (Sewer Tunnels)", () => {
    const base = onStage(withSet(), 0);
    const already = encounterCardInVillainArea(base, "24063");
    const staged = stackTop(already.state, "01186", "24062");
    const revealed = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(revealed.villainArea).not.toContain(already.id);
  });

  it("24062.sewer-tunnels-constant: every character gains retaliate 1", () => {
    const staged = encounterCardInVillainArea(onStage(withSet(), 0), "24062");
    expect(hasKeyword(staged.state, villainId(staged.state), "retaliate", WAVE4_DEPS)).toBe(true);
    expect(hasKeyword(staged.state, staged.state.players[0]!.identity.instanceId, "retaliate", WAVE4_DEPS)).toBe(true);
  });

  it("24063.when-revealed: discards an already-in-play Setting environment (Warehouse District)", () => {
    const base = onStage(withSet(), 0);
    const already = encounterCardInVillainArea(base, "24060");
    const staged = stackTop(already.state, "01186", "24063");
    const revealed = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(revealed.villainArea).not.toContain(already.id);
  });

  it("24063.warehouse-district-constant: every character gains steady", () => {
    const staged = encounterCardInVillainArea(onStage(withSet(), 0), "24063");
    expect(hasKeyword(staged.state, villainId(staged.state), "steady", WAVE4_DEPS)).toBe(true);
    expect(hasKeyword(staged.state, staged.state.players[0]!.identity.instanceId, "steady", WAVE4_DEPS)).toBe(true);
  });
});
