/**
 * Rules audit chunk 36 (FFG rulings post-RRG 1.5, May-June 2023). Audit proofs only: each `it.fails` marks a place the
 * engine does something an official source forbids, and flips to a failure when it is fixed.
 */
import { cardId } from "@mc/content";
import { activeVillain, applyCommand, remainingHitPoints, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { coreScenario } from "../core/setup.js";
import {
  P1,
  P2,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  run,
  settle,
  startCoreGame,
  toHero,
  firstLegal,
  type Picker,
} from "../testing/harness.js";

import { driveEventsPicking, withForm } from "../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../wave7/index.js";
import { createGame } from "@mc/engine";
import { gambitGame } from "../wave6/gambit/gambit/support.js";
import { WAVE6_DEPS } from "../wave6/index.js";
import { WAVE4_DEPS } from "../wave4/index.js";
import { playFromHand, startWave4Game } from "../wave4/testing.js";
import { adamWarlockScenario } from "../wave4/mts/support.js";

const sheHulk = () =>
  startCoreGame(coreScenario("rhino", { players: [{ starterDeckId: "core-she-hulk-aggression" }], seed: 21 }));

describe("Superhuman Strength (01028) when the attacked enemy leaves play (FFG ruling May 25, 2023 - Ruling 13; May 30, 2023 - Ruling 14 third bullet)", () => {
  it("She-Hulk's attack defeats the enemy: the Forced Response has no valid target, does not initiate, and the upgrade is not discarded", () => {
    const given = moveToHand(sheHulk(), P1, "01028");
    const [strength] = given.ids as [InstanceId];
    const hero = settle(run(given.state, toHero()));
    const villainId = activeVillain(hero).instanceId;
    // Leave the villain 1 hit point so She-Hulk's 5 ATK defeats it (a minion would do too; the villain keeps the staging short).
    const hp = remainingHitPoints(hero, villainId)!;
    const nearDead = patchInstance(hero, villainId, { damage: inst(hero, villainId).damage + hp - 1 });
    const strong = run(nearDead, play(P1, strength, payWith(nearDead, P1, 2, given.ids)));
    const after = settle(
      run(strong, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(strong),
        targetInstanceId: villainId,
      }),
    );
    // Staging sanity: the enemy took the damage (the villain advanced to its next stage or the game ended).
    expect(
      inst(after, villainId).damage === 0 || after.outcome !== undefined || after.activeVillainId !== villainId,
    ).toBe(true);
    expect(playerOf(after, P1).discard).not.toContain(strength);
  });
});

const CABLE = { starterDeckId: "cable-leadership" } as const;
const ANGEL = { starterDeckId: "angel-protection" } as const; // two hero forms, like Ant-Man (Tiny/Giant)

describe("Bodyslide (40002) with a player already in a hero form (FFG ruling June 8, 2023 - Ruling 22)", () => {
  it.fails("Cable changes to hero form: Angel (hero form 0) is asked and can change to his other hero form (Archangel), as Ant-Man could from Tiny to Giant", () => {
    const config = wave7Scenario("juggernaut", {
      players: [CABLE, ANGEL],
      seed: 1,
      difficulty: "standard",
      modularSetIds: [],
    });
    const created = createGame(config, WAVE7_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
    // Cable in alter-ego form (so Bodyslide takes him to hero form); Angel (P2) in hero form 0.
    const staged = withForm(withForm(settled, "alterEgo", P1), { heroForm: 0 }, P2);
    const antFormBefore = playerOf(staged, P2).identity.heroFormIndex;
    const given = moveToHand(staged, P1, "40002");
    const [id] = given.ids as [InstanceId];
    const asked: string[][] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseOption" && choice.playerId === P2) {
        asked.push(choice.options.map((o) => o.label));
        return [
          choice.options.find((o) => o.label.toLowerCase().includes("change"))?.optionId ?? choice.options[0]!.optionId,
        ];
      }
      return firstLegal(s);
    };
    const driven = driveEventsPicking(WAVE7_DEPS, given.state, pick, play(P1, id, payWith(given.state, P1, 0, [id])));
    expect(playerOf(driven.state, P1).identity.form).toBe("hero");
    // Ruling: P2 may change to another hero form (Ant-Man: Tiny to Giant). Actual: P2 is in hero form already, so is never asked.
    expect(asked.length).toBe(1);
    expect(playerOf(driven.state, P2).identity.heroFormIndex).not.toBe(antFormBefore);
  });
});

describe("Adam Warlock's Karmic Blast (21038) and Cosmic Awareness (21039) while Stunned or Confused (FFG ruling May 18, 2023 - Ruling 8; RRG 1.8 'Cost Arrow Icon' p. 13, 'Stun' p. 41, 'Confuse' p. 12)", () => {
  /** Text before the cost arrow is the cost: "Deal 4 damage to an enemy and discard up to 4 cards" / "Remove 3 threat ... and discard up to 4 cards". */
  const heroGame = (seed: number, change: (s: GameState) => GameState = (s) => s) => {
    const base = change(startWave4Game(adamWarlockScenario("rhino", { seed })));
    return settle(applyOk4(base), firstLegal, undefined, WAVE4_DEPS);
  };

  const applyOk4 = (s: GameState) => {
    const result = applyCommand(s, toHero(), WAVE4_DEPS);
    if (!result.ok) throw new Error(result.error.message);
    return result.state;
  };
  const accepting =
    (...wanted: readonly string[]): Picker =>
    (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      const hits = choice.options
        .filter((o) => wanted.some((w) => o.optionId.includes(w) || o.label.includes(w)))
        .map((o) => o.optionId);
      return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
    };

  it("Stunned Adam plays Karmic Blast: the 4 damage (the cost) is still dealt and the stunned card is discarded", () => {
    const hero = heroGame(20);
    const me = identityOf(hero);
    const stunned = patchInstance(hero, me, { statuses: { ...inst(hero, me).statuses, stunned: 1 } });
    const villain = activeVillain(stunned).instanceId;
    const before = inst(stunned, villain).damage;
    const { state } = playFromHand(stunned, "21038", 2, accepting("Discard 1", villain));
    expect(inst(state, me).statuses.stunned).toBe(0);
    // Ruling: only the part after the arrow (the additional damage, the "attack") is replaced. Actual: nothing is dealt.
    expect(inst(state, villain).damage - before).toBeGreaterThanOrEqual(4);
  });

  it("Confused Adam plays Cosmic Awareness: the 3 threat (the cost) is still removed and the confused card is discarded", () => {
    const hero = heroGame(21, (s) => patchInstance(s, s.mainScheme.instanceId, { threat: 10 }));
    const me = identityOf(hero);
    const confused = patchInstance(hero, me, { statuses: { ...inst(hero, me).statuses, confused: 1 } });
    const scheme = confused.mainScheme.instanceId;
    const before = inst(confused, scheme).threat;
    const { state } = playFromHand(confused, "21039", 2, accepting("Discard 1", scheme));
    expect(inst(state, me).statuses.confused).toBe(0);
    expect(before - inst(state, scheme).threat).toBeGreaterThanOrEqual(3);
  });
});

describe("X-Men Instruction (37031) with nothing to resolve (FFG ruling May 22, 2023 - Ruling 9, answers 3 and 4; RRG 1.8 'Target' p. 42)", () => {
  it("no X-MEN ally in the discard pile and no X-Mansion in play: the event cannot be played", () => {
    const base = gambitGame("rhino", { seed: 1 }); // alter-ego form, empty discard pile, no X-Mansion
    const top = playerOf(base, P1).deck[0]!;
    const hand = moveToHand(patchInstance(base, top, { cardId: cardId("37031") }), P1, "37031");
    const [id] = hand.ids as [InstanceId];
    // Staging sanity: nothing X-MEN in the discard pile, X-Mansion not in play.
    expect(playerOf(hand.state, P1).discard.filter((i) => inst(hand.state, i).cardId === "37011")).toEqual([]);
    const result = applyCommand(hand.state, play(P1, id, payWith(hand.state, P1, 0, [id])), WAVE6_DEPS);
    // Ruling: no sentence can resolve, so it cannot be played. Actual: accepted (the choice is `min: 0`, the draw is gated by an `ifThen`).
    expect(result.ok).toBe(false);
  });
});
