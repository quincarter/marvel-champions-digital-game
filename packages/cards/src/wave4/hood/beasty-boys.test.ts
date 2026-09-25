import { describe, expect, it } from "vitest";
import { P1, firstLegal, settle } from "../../testing/harness.js";
import { runWave4, WAVE4_DEPS } from "../testing.js";
import {
  deckId,
  foldModularSetIntoDeck,
  game,
  heroified,
  minionEngagedWith,
  onStage,
  patchInstance,
  stackTop,
} from "./testing.js";

/**
 * Real-game tests for the Beasty Boys modular set (`beasty-boys.ts`): Griffin (24015), Mandrill (24016) and Double
 * Trouble (24017). Beast Mode (24014) and Mandrill's retaliate X are tested in `hood-gaps.test.ts`.
 *
 * Ref -> covering test:
 *  24015.griffin-forced-response -> "after Griffin attacks and damages a character, stun it"
 *  24015.when-defeated           -> "shuffles Griffin back in when a friendly character is stunned"
 *  24016.when-revealed           -> "Mandrill confuses each character P1 controls"
 *  24017.when-revealed           -> "stuns and confuses a character P1 controls"
 *  24017.boost                   -> "the boost resolves the same When Revealed effect again"
 */

describe("Beasty Boys (24014-24017)", () => {
  it("24015.griffin-forced-response: after Griffin attacks and damages a character, stun it", () => {
    const base = heroified(onStage(foldModularSetIntoDeck(game(), "beasty_boys"), 0), P1);
    const staged = minionEngagedWith(base, "24015", P1);
    const identity = staged.state.players[0]!.identity.instanceId;
    // Griffin's own villain-phase activation (an attack, since P1 is in hero form) damages the identity, then her
    // own Forced Response stuns it.
    const activated = settle(
      runWave4(staged.state, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(activated.instances[identity]?.statuses.stunned).toBe(1);
  });

  it("24015.when-defeated: shuffles Griffin back into the encounter deck when a friendly character is stunned", () => {
    // Two players: P2's identity is the stunned "friendly character in play"; P1 (unstunned) makes the attack.
    const base = heroified(
      onStage(foldModularSetIntoDeck(game(1, [{ starterDeckId: "core-black-panther-protection" }]), "beasty_boys"), 0),
      P1,
    );
    const staged = minionEngagedWith(base, "24015", P1);
    const stunned = patchInstance(staged.state, staged.state.players[1]!.identity.instanceId, {
      statuses: { stunned: 1, confused: 0, tough: 0 },
    });
    const identity = stunned.players[0]!.identity.instanceId;
    const near = patchInstance(stunned, staged.id, { damage: 999 });
    const defeated = settle(
      runWave4(near, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: staged.id,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(defeated.encounterDecks[deckId(defeated)]!.deck).toContain(staged.id);
    expect(defeated.instances[staged.id]?.faceup).toBe(false);
  });

  it("24016.when-revealed: Mandrill confuses each character P1 controls", () => {
    const base = onStage(foldModularSetIntoDeck(game(), "beasty_boys"), 0);
    const staged = stackTop(base, "01186", "24016");
    const identity = staged.players[0]!.identity.instanceId;
    const revealed = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(revealed.instances[identity]?.statuses.confused).toBe(1);
  });

  it("24017.when-revealed: stuns and confuses a character P1 controls", () => {
    const base = onStage(foldModularSetIntoDeck(game(), "beasty_boys"), 0);
    const staged = stackTop(base, "01186", "24017");
    const identity = staged.players[0]!.identity.instanceId;
    const revealed = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(revealed.instances[identity]?.statuses.stunned).toBe(1);
    expect(revealed.instances[identity]?.statuses.confused).toBe(1);
  });

  it("24017.boost: after Double Trouble is dealt as a boost card, its own When Revealed resolves again", () => {
    const base = heroified(onStage(foldModularSetIntoDeck(game(), "beasty_boys"), 0), P1);
    const staged = stackTop(base, "24017");
    const identity = staged.players[0]!.identity.instanceId;
    const attacked = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(attacked.instances[identity]?.statuses.stunned).toBe(1);
    expect(attacked.instances[identity]?.statuses.confused).toBe(1);
  });
});
