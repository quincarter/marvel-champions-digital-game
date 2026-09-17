import { activeVillain, type InstanceId } from "@mc/engine";
import { coreScenario } from "../setup.js";
import {
  answer,
  endTurn,
  identityOf,
  inst,
  moveToHand,
  P1,
  payWith,
  play,
  playerOf,
  run,
  settle,
  settleUntil,
  stackEncounterDeck,
  startCoreGame,
  toHero,
} from "../../testing/harness.js";

/**
 * Protection's two Responses to defending, at the timing RRG 1.8 "Defend, Defense" (p. 16) prints: "Abilities that
 * trigger after a character defends an attack resolve after that attack ends." RRG 1.8 "Attack (Enemy Activation)"
 * (p. 9) step 6 puts them in the step the attack triggers as it finishes resolving — after its damage (step 5) and
 * after the forced abilities of step 6a, which for Black Panther includes his own retaliate 1.
 *
 * Black Panther (01040a: ATK 2, DEF 2, retaliate 1) against Rhino I (ATK 2), with Crowd Control (01108: 2 boost
 * icons, no "Boost" ability) stacked as the boost card: a basic defense takes 2 + 2 - 2 = 2 damage.
 */
const rhinoVsBlackPanther = () =>
  startCoreGame(coreScenario("rhino", { players: [{ starterDeckId: "core-black-panther-protection" }], seed: 11 }));
const CROWD_CONTROL = "01108";

describe("Protection: Responses to defending resolve after the attack ends (RRG 1.8 p. 16)", () => {
  it("Counter-Punch (01077) is offered only once the attack has dealt its damage, and hits for Black Panther's ATK", () => {
    const given = moveToHand(rhinoVsBlackPanther(), P1, "01077");
    const [punch] = given.ids as [InstanceId];
    const stacked = stackEncounterDeck(run(given.state, toHero()), CROWD_CONTROL);
    const atDefence = settleUntil(run(stacked, endTurn()), "declareDefender");
    const hero = identityOf(atDefence);
    const villain = activeVillain(atDefence).instanceId;
    const villainBefore = inst(atDefence, villain).damage;
    expect(inst(atDefence, hero).damage).toBe(0);

    const offered = answer(atDefence, [hero]);
    const option = `${punch}:01077.counter-punch-response`;
    expect(offered.pendingChoice?.prompt).toMatchObject({ kind: "chooseTriggers", timing: "response" });
    expect(offered.pendingChoice?.options.map((o) => o.optionId)).toContain(option);
    // The attack is over by the time the Response is offered: its damage is on Black Panther, and his retaliate
    // (step 6a, forced) has already answered it.
    expect(inst(offered, hero).damage).toBe(2);
    expect(inst(offered, villain).damage).toBe(villainBefore + 1);

    const after = settle(answer(offered, [option]));
    expect(inst(after, villain).damage).toBe(villainBefore + 1 + 2);
    expect(playerOf(after, P1).discard).toContain(punch);
  });

  it("Indomitable (01082) readies Black Panther after that attack, so the defense's damage is already taken", () => {
    const given = moveToHand(rhinoVsBlackPanther(), P1, "01082");
    const [indomitable] = given.ids as [InstanceId];
    const hero = run(given.state, toHero());
    const withUpgrade = settle(run(hero, play(P1, indomitable, payWith(hero, P1, 1, given.ids))));
    const stacked = stackEncounterDeck(withUpgrade, CROWD_CONTROL);
    const atDefence = settleUntil(run(stacked, endTurn()), "declareDefender");
    const heroId = identityOf(atDefence);

    const offered = answer(atDefence, [heroId]);
    const option = `${indomitable}:01082.indomitable-response`;
    expect(offered.pendingChoice?.options.map((o) => o.optionId)).toContain(option);
    // Exhausted by the basic defense and already holding that attack's damage.
    expect(inst(offered, heroId).exhausted).toBe(true);
    expect(inst(offered, heroId).damage).toBe(2);

    const after = settle(answer(offered, [option]));
    expect(inst(after, heroId).exhausted).toBe(false);
    expect(playerOf(after, P1).discard).toContain(indomitable);
  });
});
