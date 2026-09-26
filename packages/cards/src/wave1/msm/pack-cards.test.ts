import { activeVillain, characterProfile, remainingHitPoints } from "@mc/engine";
import type { GameEvent, GameState } from "@mc/engine";
import {
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  picking,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { MSM_DEPS, runMsm, startMsmGame } from "./testing.js";

// Real wave 1 content: the Ms. Marvel (Protection) precon against Rhino, standard, solo.
const msmVsRhino = () =>
  startMsmGame(wave1Scenario("rhino", { players: [{ starterDeckId: "msm-protection" }], seed: 3 }));

/**
 * Melee (05030, aggression), Concussive Blow (05031, justice), Morale Boost (05032, leadership) and Down Time
 * (05033, basic) are bundled in the physical Ms. Marvel pack but are **not** part of the 40-card "Ms. Marvel
 * (Protection)" precon `msm-protection` (`packages/content/src/data/msm/starterDecks.ts` lists only up to 05024) —
 * they're pool cards for a differently-built Ms. Marvel deck (a different secondary aspect, or a generic/basic
 * card usable by any deck). Reaching them through a *real game* the way the tests below do would need a second,
 * fully-built 40-card legal deck of a different aspect, which is disproportionate for four cards whose shapes are
 * already proven elsewhere in this exact test file (Melee/Concussive Blow mirror Big Hands/Tackle's
 * attack-with-conditional-bonus shape; Morale Boost/Down Time mirror Endurance's stat-modifier shape). This matches
 * `cap`'s own precedent: its four analogous off-precon pack cards (Enraged, Followed, Expert Defense, Enhanced
 * Awareness — `wave1/cap/pack-cards.ts`) have no dedicated tests in `captain-america.test.ts` either. They're still
 * scripted (not a "record and skip" gap) and exercised structurally by `coverage.test.ts` and `defineAbilities`'s
 * own validation at import time.
 */

describe("Ms. Marvel pack cards", () => {
  it("Nova: an Interrupt dealing 2 damage to an enemy that initiates an attack against you", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05012", "05005"); // Nova (cost 4), Wiggle Room (a spare [energy] card)
    const [nova, energyCard] = given.ids as [never, never];
    const hero = runMsm(given.state, toHero());
    const withNova = settle(
      runMsm(hero, play(P1, nova, payWith(hero, P1, 4, [nova, energyCard]))),
      firstLegal,
      undefined,
      MSM_DEPS,
    );
    const villain = activeVillain(withNova).instanceId;
    const hpBefore = remainingHitPoints(withNova, villain);
    const option = `${nova}:05012.nova-interrupt`;
    const after = settle(
      runMsm(withNova, endTurn()),
      (s) => {
        const prompt = s.pendingChoice?.prompt;
        if (prompt?.kind === "chooseTriggers") return picking(option)(s);
        if (prompt?.kind === "payForAbility" && prompt.instanceId === nova) return [`hand:${energyCard}`];
        return firstLegal(s);
      },
      undefined,
      MSM_DEPS,
    );
    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 2);
  });

  it("Tackle: stuns an enemy, and deals 3 damage if paid with a [physical] resource", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05015", "05003"); // Tackle (cost 3), Big Hands (a spare [physical] card)
    const [tackle, physicalCard] = given.ids as [never, never];
    const hero = runMsm(given.state, toHero());
    const villain = activeVillain(hero).instanceId;
    const hpBefore = remainingHitPoints(hero, villain);
    // A card cannot pay for itself, so the [physical] resource has to come from a different card in the payment.
    const payment = [physicalCard, ...payWith(hero, P1, 2, [tackle, physicalCard])];
    const after = settle(runMsm(hero, play(P1, tackle, payment)), firstLegal, undefined, MSM_DEPS);
    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 3);
    expect(after.instances[villain]?.statuses.stunned).toBeGreaterThan(0);
  });

  it("Energy Barrier: prevents 1 damage and deals 1 to an enemy, spending a reflection counter", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05017"); // Energy Barrier, cost 2, Uses (3 reflection counters)
    const [barrier] = given.ids as [never];
    const hero = runMsm(given.state, toHero());
    const withBarrier = runMsm(hero, play(P1, barrier, payWith(hero, P1, 2, [barrier])));
    expect(inst(withBarrier, barrier).counters.reflection).toBe(3);
    const villain = activeVillain(withBarrier).instanceId;
    const hpBefore = remainingHitPoints(withBarrier, villain);
    const option = `${barrier}:05017.energy-barrier-interrupt`;
    const after = settle(runMsm(withBarrier, endTurn()), picking(option), undefined, MSM_DEPS);
    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 1);
    expect(inst(after, barrier).counters.reflection).toBe(2);
  });

  it("Lockjaw: may be played from the discard pile during your turn", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05018", "05003", "05004", "05005", "05009"); // Lockjaw (cost 4) + 4 filler
    const [lockjaw, ...filler] = given.ids as [never, never, never, never, never];
    // Test surgery: put Lockjaw straight in the discard pile (without playing/defeating him), to isolate
    // "playableFrom discard" from everything else that could put a card there.
    const inDiscard = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((id) => id !== lockjaw), discard: [...p.discard, lockjaw] } : p,
      ),
    };
    const hero = runMsm(inDiscard, toHero());
    const after = settle(runMsm(hero, play(P1, lockjaw, filler)), firstLegal, undefined, MSM_DEPS);
    expect(playerOf(after, P1).playArea).toContain(lockjaw);
    expect(playerOf(after, P1).discard).not.toContain(lockjaw);
  });

  it("Endurance: +3 hit points", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05023");
    const [endurance] = given.ids as [never];
    const before = characterProfile(given.state, identityOf(given.state), MSM_DEPS)!.maxHp;
    const after = settle(
      runMsm(given.state, play(P1, endurance, payWith(given.state, P1, 1, [endurance]))),
      firstLegal,
      undefined,
      MSM_DEPS,
    );
    expect(characterProfile(after, identityOf(after), MSM_DEPS)!.maxHp).toBe(before + 3);
  });

  it("Enhanced Reflexes: a Uses (3 energy counters) Hero Resource", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05024", "05003");
    const [reflexes, bigHands] = given.ids as [never, never];
    const hero = runMsm(given.state, toHero());
    const withReflexes = runMsm(hero, play(P1, reflexes, payWith(hero, P1, 2, [reflexes, bigHands])));
    expect(inst(withReflexes, reflexes).counters.energy).toBe(3);
    const villain = activeVillain(withReflexes).instanceId;
    const hpBefore = remainingHitPoints(withReflexes, villain);
    const after = settle(
      runMsm(
        withReflexes,
        play(P1, bigHands, payWith(withReflexes, P1, 1, [reflexes, bigHands]), {
          abilities: [{ ability: { instanceId: reflexes, abilityId: "05024.enhanced-reflexes-resource" as never } }],
        }),
      ),
      firstLegal,
      undefined,
      MSM_DEPS,
    );
    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 4);
    expect(inst(after, reflexes).counters.energy).toBe(2);
  });

  // docs/phase7-wave4.md §4 Q20 (user decision 2026-09-25): a player's attack whose attacker left play ends, but a
  // villain whose stage is defeated mid-attack advances and is the same character still in play, so its attack goes on
  // and deals damage with the new stage's ATK (RRG 1.8 "Villain Defeat", p. 47; "Activation", p. 6 only ends an attack
  // whose enemy left play).
  it("Preemptive Strike defeats Klaw I mid-attack: the attack continues at Klaw II's ATK", () => {
    const start = startMsmGame(wave1Scenario("klaw", { players: [{ starterDeckId: "msm-protection" }], seed: 3 }));
    const given = moveToHand(start, P1, "05014", "05005"); // Preemptive Strike (cost 1), Wiggle Room (to pay)
    const [strike, payment] = given.ids as [never, never];
    const hero = runMsm(given.state, toHero());
    const villain = activeVillain(hero).instanceId;
    expect(activeVillain(hero).stageIndex).toBe(0);
    expect(characterProfile(hero, villain, MSM_DEPS)!.atk).toBe(0);
    // Klaw I at 1 remaining hit point. His two boost cards (his forced interrupt gives him the second) are Armored
    // Guards, 1 boost icon each, so cancelling the first one's icon deals the 1 damage that defeats the stage.
    const primed = stackEncounterDeck(
      patchInstance(hero, villain, { damage: remainingHitPoints(hero, villain)! - 1 + inst(hero, villain).damage }),
      "01120",
      "01120",
    );
    const option = `${strike}:05014.preemptive-strike-interrupt`;
    let used = false;
    const pick = (s: GameState): readonly string[] => {
      const prompt = s.pendingChoice?.prompt;
      if (!used && s.pendingChoice?.options.some((o) => o.optionId === option)) {
        used = true;
        return [option];
      }
      if (prompt?.kind === "payForCard" && prompt.instanceId === strike) return [`hand:${payment}`];
      // End of turn: keep the two cards this test needs.
      if (prompt?.kind === "discardDownToHandSize") {
        const keep: readonly string[] = [strike, payment];
        const spare = s.pendingChoice!.options.filter((o) => !keep.includes(o.optionId));
        return spare.slice(0, s.pendingChoice!.minSelections).map((o) => o.optionId);
      }
      return firstLegal(s);
    };
    // Drive the villain phase until Klaw's attack has dealt its damage, keeping every event.
    const events: GameEvent[] = [];
    let state = applyOk(primed, endTurn(), MSM_DEPS).state;
    const attackDone = () => events.some((e) => e.type === "attackResolved" && e.enemyInstanceId === villain);
    for (let guard = 0; state.pendingChoice && !attackDone(); guard++) {
      if (guard > 200) throw new Error(`stuck on ${state.pendingChoice.prompt.kind}`);
      const choice = state.pendingChoice;
      const step = applyOk(
        state,
        { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: pick(state) },
        MSM_DEPS,
      );
      events.push(...step.events);
      state = step.state;
    }
    expect(used).toBe(true);
    // The same villain card, now on stage II (ATK 1); the stage defeat is not a villain defeat.
    expect(events.filter((e) => e.type === "villainStageAdvanced")).toEqual([
      { type: "villainStageAdvanced", stageIndex: 1, instanceId: villain },
    ]);
    expect(activeVillain(state).instanceId).toBe(villain);
    expect(activeVillain(state).stageIndex).toBe(1);
    // The attack was not ended: Klaw II's ATK 1 plus the other Armored Guard's 1 icon, undefended.
    const resolved = events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === villain);
    expect(resolved).toEqual([
      expect.objectContaining({ baseAtk: 1, boostIcons: 1, defenseReduction: 0, damageDealt: 2 }),
    ]);
    expect(inst(state, identityOf(state)).damage).toBe(2);
  });
});

// RRG 1.8 "'Then'" (p. 44) and FAQ "Attacrobatics (#6)" (RRG 1.8 p. 59), docs/then-sweep.md: "cancel all boost icons on
// that card. Then deal 1 damage … for each boost icon cancelled this way". A boost card with no icons is no target for
// the cancel, so Preemptive Strike isn't offered for it at all; with icons, the cancel resolves and its "then" deals the
// damage.
describe("Preemptive Strike (05014): the cancel needs icons to cancel", () => {
  /** Plays to the end of the villain's attack with Preemptive Strike in hand, using it whenever it is offered. */
  function villainAttacksWith(boostCard: string) {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05014", "05005");
    const [strike, payment] = given.ids as [never, never];
    const hero = runMsm(given.state, toHero());
    const villain = activeVillain(hero).instanceId;
    const primed = stackEncounterDeck(hero, boostCard);
    const option = `${strike}:05014.preemptive-strike-interrupt`;
    let offered = false;
    const pick = (s: GameState): readonly string[] => {
      const prompt = s.pendingChoice?.prompt;
      if (s.pendingChoice?.options.some((o) => o.optionId === option)) {
        offered = true;
        return [option];
      }
      if (prompt?.kind === "payForCard" && prompt.instanceId === strike) return [`hand:${payment}`];
      if (prompt?.kind === "discardDownToHandSize") {
        const keep: readonly string[] = [strike, payment];
        const spare = s.pendingChoice!.options.filter((o) => !keep.includes(o.optionId));
        return spare.slice(0, s.pendingChoice!.minSelections).map((o) => o.optionId);
      }
      return firstLegal(s);
    };
    const events: GameEvent[] = [];
    let state = applyOk(primed, endTurn(), MSM_DEPS).state;
    const attackDone = () => events.some((e) => e.type === "attackResolved" && e.enemyInstanceId === villain);
    for (let guard = 0; state.pendingChoice && !attackDone(); guard++) {
      if (guard > 200) throw new Error(`stuck on ${state.pendingChoice.prompt.kind}`);
      const choice = state.pendingChoice;
      const step = applyOk(
        state,
        { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: pick(state) },
        MSM_DEPS,
      );
      events.push(...step.events);
      state = step.state;
    }
    return { offered, events, villain, before: remainingHitPoints(hero, villain)!, state };
  }

  it("a 0-icon boost card (Advance) is no target: Preemptive Strike is not offered", () => {
    const { offered } = villainAttacksWith("01186");
    expect(offered).toBe(false);
  });

  it("a 1-icon boost card (Stampede): its icon is cancelled, then 1 damage is dealt to the villain", () => {
    const { offered, events, villain, before, state } = villainAttacksWith("01106");
    expect(offered).toBe(true);
    expect(events.some((e) => e.type === "thenSkipped")).toBe(false);
    expect(remainingHitPoints(state, villain)).toBe(before - 1);
  });
});
