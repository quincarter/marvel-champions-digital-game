import { hasKeyword, maxHitPoints } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  P1,
  patchInstance,
  playerOf,
  settle,
  toHero,
  use,
} from "../../testing/harness.js";
import { wave3Scenario } from "../setup.js";
import { playFromHand, runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

// Real wave 3 content: the Groot (Protection) precon against Rhino (a Core scenario, seated with wave 3 content —
// `wave3Scenario`'s fallback), standard, solo. Groot starts in alter-ego.
const grootVsRhino = () =>
  startWave3Game(wave3Scenario("rhino", { players: [{ starterDeckId: "groot-protection" }], seed: 2026 }));

describe("Groot kit", () => {
  it("Fruition: places 2 growth counters on Groot (to a maximum of 10)", () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const { state } = playFromHand(hero, "16002", 0);
    const identity = identityOf(state);
    expect(inst(state, identity).counters.growth).toBe(2);
  });

  it("Fruition: capped at 10 growth counters", () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const near = patchInstance(hero, identity, { counters: { growth: 9 } });
    const { state } = playFromHand(near, "16002", 0);
    expect(inst(state, identity).counters.growth).toBe(10);
  });

  it('"I am Groot": removes threat from a scheme equal to the number of growth counters on Groot', () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const withCounters = patchInstance(hero, identity, { counters: { growth: 3 } });
    const withThreat = patchInstance(withCounters, withCounters.mainScheme.instanceId, { threat: 10 });
    const before = mainThreat(withThreat);
    const { state } = playFromHand(withThreat, "16003", 3);
    expect(mainThreat(state)).toBe(before - 3);
    expect(inst(state, identity).counters.growth).toBe(3); // reading the counters didn't spend them
  });

  it('"I. AM. GROOT!": deals damage to an enemy equal to the number of growth counters on Groot', () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const withCounters = patchInstance(hero, identity, { counters: { growth: 4 } });
    const villain = withCounters.villains[0]!.instanceId;
    const before = inst(withCounters, villain).damage;
    const { state } = playFromHand(withCounters, "16004", 2);
    expect(inst(state, villain).damage).toBe(before + 4);
  });

  it("Root Stomp: deals 5 damage to an enemy, placing 1 growth counter on Groot if that attack defeats it", () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const villain = hero.villains[0]!.instanceId;
    const before = inst(hero, identity).counters.growth ?? 0;
    // Prime Rhino to exactly 5 remaining hit points, so this attack defeats him. A defeated villain stage's own
    // damage dial resets to 0 (there is nothing left to have taken damage), which is what confirms the defeat
    // actually happened here, rather than merely that 5 damage was dealt.
    const max = maxHitPoints(hero, villain, WAVE3_DEPS) ?? 5;
    const primed = patchInstance(hero, villain, { damage: Math.max(0, max - 5) });
    const { state } = playFromHand(primed, "16005", 2);
    expect(inst(state, villain).damage).toBe(0);
    expect(inst(state, identity).counters.growth ?? 0).toBe(before + 1);
  });

  it("Root Stomp: places no growth counter when the attack doesn't defeat its target", () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const villain = hero.villains[0]!.instanceId;
    const before = inst(hero, identity).counters.growth ?? 0;
    const undamaged = patchInstance(hero, villain, { damage: 0 }); // Rhino's hit points are well above 5
    const { state } = playFromHand(undamaged, "16005", 2);
    expect(inst(state, villain).damage).toBe(5);
    expect(inst(state, identity).counters.growth ?? 0).toBe(before);
  });

  it("Flora Colossus: Forced Interrupt prevents damage to Groot by removing that many growth counters", () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const withCounters = patchInstance(hero, identity, { counters: { growth: 5 }, damage: 0 });
    const villain = withCounters.villains[0]!.instanceId;
    const villainDamageBefore = inst(withCounters, villain).damage;
    // Undefended villain phase attack: Rhino's ATK is small (well under 5), so it's fully prevented and every
    // point of damage removes one growth counter 1-for-1.
    const attacked = settle(runWave3(withCounters, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    expect(inst(attacked, identity).damage).toBe(0);
    expect(inst(attacked, identity).counters.growth).toBeLessThan(5);
    expect(inst(attacked, villain).damage).toBe(villainDamageBefore);
  });

  it("Fighting Fit: deals 2 damage to the villain (5 instead if Groot is undamaged)", () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const undamaged = patchInstance(hero, identity, { damage: 0 });
    const villain = undamaged.villains[0]!.instanceId;
    const before = inst(undamaged, villain).damage;
    const { state } = playFromHand(undamaged, "16014", 2);
    expect(inst(state, villain).damage).toBe(before + 5);
  });

  it("Fighting Fit: deals only 2 damage to the villain once Groot has taken damage", () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const damaged = patchInstance(hero, identity, { damage: 1 });
    const villain = damaged.villains[0]!.instanceId;
    const before = inst(damaged, villain).damage;
    const { state } = playFromHand(damaged, "16014", 2);
    expect(inst(state, villain).damage).toBe(before + 2);
  });

  it("Fertile Ground: Alter-Ego Action, exhaust it to place 1 growth counter and draw 1 card", () => {
    const { state: withFertileGround, id: fertileGround } = playFromHand(grootVsRhino(), "16007", 1);
    const identity = identityOf(withFertileGround);
    const handBefore = playerOf(withFertileGround, P1).hand.length;
    const used = runWave3(withFertileGround, use(P1, fertileGround, "16007.fertile-ground-action"));
    expect(inst(used, identity).counters.growth).toBe(1);
    expect(playerOf(used, P1).hand.length).toBe(handBefore + 1);
    expect(inst(used, fertileGround).exhausted).toBe(true);
  });

  it("Dauntless: your hero gains retaliate 1 while undamaged, loses it once damaged", () => {
    const { state: withDauntless } = playFromHand(runWave3(grootVsRhino(), toHero()), "16016", 1);
    const identity = identityOf(withDauntless);
    const undamaged = patchInstance(withDauntless, identity, { damage: 0 });
    expect(hasKeyword(undamaged, identity, "retaliate", WAVE3_DEPS)).toBe(true);
    const damaged = patchInstance(withDauntless, identity, { damage: 1 });
    expect(hasKeyword(damaged, identity, "retaliate", WAVE3_DEPS)).toBe(false);
  });
});
