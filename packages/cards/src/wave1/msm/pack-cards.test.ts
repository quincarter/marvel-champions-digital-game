import { activeVillain, characterProfile, remainingHitPoints } from "@mc/engine";
import { endTurn, firstLegal, identityOf, inst, moveToHand, P1, payWith, picking, play, playerOf, settle, toHero } from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { MSM_DEPS, runMsm, startMsmGame } from "./testing.js";

// Real wave 1 content: the Ms. Marvel (Protection) precon against Rhino, standard, solo.
const msmVsRhino = () => startMsmGame(wave1Scenario("rhino", { players: [{ starterDeckId: "msm-protection" }], seed: 3 }));

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
    const withNova = settle(runMsm(hero, play(P1, nova, payWith(hero, P1, 4, [nova, energyCard]))), firstLegal, undefined, MSM_DEPS);
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
      players: given.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((id) => id !== lockjaw), discard: [...p.discard, lockjaw] } : p)),
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
    const after = settle(runMsm(given.state, play(P1, endurance, payWith(given.state, P1, 1, [endurance]))), firstLegal, undefined, MSM_DEPS);
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
});
