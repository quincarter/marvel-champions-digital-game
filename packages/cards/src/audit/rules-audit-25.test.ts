/**
 * Rules audit, chunk 25 (FFG rulings December 17, 2025 - January 26, 2026). One proof, marked it.fails so it flips when
 * the engine is fixed.
 *
 * January 11, 2026 - Ruling 4 (Aggression Bombshell, 29033): "You resolve Bombshell's ability by dividing her attack as
 * evenly as possible among valid targets." The card is a constant: "Divide damage from Bombshell's attack among each
 * enemy as evenly as possible." (not "may"). RRG 1.8 "Golden Rules" (p. 4): card text takes precedence over the rules.
 * The engine only lets the player divide when the basic attack command carries a `divide` (`dividedShares`,
 * engine/src/actions.ts ~5936), and accepts any split of whole shares >= 1 over any chosen targets, so an undivided
 * attack on one enemy (all of her ATK on the villain) is legal while another valid enemy is in play.
 */
import { encounterSetId } from "@mc/content";
import { activeVillain, applyCommand, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { inst, P1, playerOf, toHero } from "../testing/harness.js";
import { encounterCardInVillainArea } from "../testing/staging.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../wave5/testing.js";
import { ironheartScenarioWithExtras } from "../wave5/ironheart/support.js";

const game = (): GameState =>
  startWave5Game(
    ironheartScenarioWithExtras("rhino", { seed: 1, extraCodes: ["29033"], modularSetIds: [encounterSetId("zzzax")] }),
  );

describe("Aggression Bombshell (29033): the division is not optional (ruling January 11, 2026 - Ruling 4)", () => {
  it("a basic attack with no division, while Zzzax (no Guard) is also in play, deals nothing to him", () => {
    const hero = playerOf(game(), P1).identity.form === "hero" ? game() : runWave5(game(), toHero(P1));
    const played = playFromHand(hero, "29033", 4);
    const villain = activeVillain(played.state).instanceId;
    const placed = encounterCardInVillainArea(played.state, "29037");
    const withZzzax: GameState = {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      players: placed.state.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: [...p.playArea, placed.id] } : p,
      ),
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...inst(placed.state, placed.id), engagedWith: P1 },
      },
    };
    const result = applyCommand(
      withZzzax,
      { type: "basicAttack", playerId: P1, attackerInstanceId: played.id, targetInstanceId: villain },
      WAVE5_DEPS,
    );
    // Expected: the engine refuses an undivided attack, or divides it itself. Either way the villain does not take all of
    // her ATK 3 while a valid enemy gets none.
    const accepted = result.ok;
    const villainDamage = accepted ? inst(result.state, villain).damage : 0;
    const zzzaxDamage = accepted ? inst(result.state, placed.id as InstanceId).damage : 0;
    expect(accepted && villainDamage === 3 && zzzaxDamage === 0).toBe(false);
  });
});
