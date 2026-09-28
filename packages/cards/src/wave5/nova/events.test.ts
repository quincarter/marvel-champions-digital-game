import { cardsInPlay, maxHitPoints, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  putOnTopOfDeck,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { novaScenario, novaScenarioWithExtras } from "./support.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";

const novaVsRhino = (seed = 1) => startWave5Game(novaScenario("rhino", { seed }));

/**
 * Accepts the named optional response/interrupt (by ability id); declines everything else. Also pays a reactively
 * played card's own `payForCard` step by taking the first `cost` offered options — `firstLegal`'s own
 * `minSelections` (0, since paying is itself optional up to the point of failing to pay) would otherwise pay
 * nothing at all and quietly let the response fizzle. Mirrors `../sm/ghost-spider/events-a.test.ts`'s own `accepting`.
 */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") {
      return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    }
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("Nova's events (28003-28006, 28011-28014, 28026)", () => {
  it("28003.forcefield-projection-interrupt: prevents 3 damage from an attack; paid with a [wild] resource deals 3 damage to an enemy", () => {
    const given = moveToHand(runWave5(novaVsRhino(), toHero(P1)), P1, "28003", "28007"); // Forcefield Projection + Connection to the Worldmind (a [wild] resource).
    const [, wildCard] = given.ids as [InstanceId, InstanceId];
    const villain = given.state.villains[0]!.instanceId;
    const stacked = stackEncounterDeck(given.state, "01186"); // Advance: 0 boost icons, keeps Rhino's own ATK the whole story.
    const reached = settle(
      runWave5(stacked, endTurn(P1)),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE5_DEPS,
    );
    const identity = identityOf(reached);
    const heroDamageBefore = inst(reached, identity).damage;
    const villainDamageBefore = inst(reached, villain).damage;
    const payWithWild: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "payForCard") return [`hand:${wildCard}`];
      return accepting("28003.forcefield-projection-interrupt")(state);
    };
    const after = settle(reached, payWithWild, undefined, WAVE5_DEPS);
    expect(inst(after, identity).damage).toBe(heroDamageBefore); // Rhino's ATK (2) < the 3 prevented.
    expect(inst(after, villain).damage).toBe(villainDamageBefore + 3); // paid with [wild]: 3 damage to an enemy.
  });

  it("28003.forcefield-projection-interrupt: prevents 3 damage; paid without a [wild] resource deals no bonus damage", () => {
    const given = moveToHand(runWave5(novaVsRhino(), toHero(P1)), P1, "28003", "28002"); // + Ms. Marvel (a printed [physical] resource, no wild).
    const [, physicalCard] = given.ids as [InstanceId, InstanceId];
    const villain = given.state.villains[0]!.instanceId;
    const stacked = stackEncounterDeck(given.state, "01186");
    const reached = settle(
      runWave5(stacked, endTurn(P1)),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE5_DEPS,
    );
    const identity = identityOf(reached);
    const heroDamageBefore = inst(reached, identity).damage;
    const villainDamageBefore = inst(reached, villain).damage;
    const payWithPhysical: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "payForCard") return [`hand:${physicalCard}`];
      return accepting("28003.forcefield-projection-interrupt")(state);
    };
    const after = settle(reached, payWithPhysical, undefined, WAVE5_DEPS);
    expect(inst(after, identity).damage).toBe(heroDamageBefore); // still fully prevented.
    expect(inst(after, villain).damage).toBe(villainDamageBefore); // no [wild] spent: no bonus damage.
  });

  // 28004.lightspeed-flight-constant ("Double the number of [wild] resources generated while paying for this
  // card") is a genuine engine gap — see the module docblock in `events.ts` — so only its Hero Action is exercised.
  it("28004.lightspeed-flight-action: removes 3 threat from a scheme", () => {
    const hero = runWave5(novaVsRhino(), toHero(P1));
    const scheme = hero.mainScheme.instanceId;
    const withThreat = patchInstance(hero, scheme, { threat: 10 });
    const { state } = playFromHand(withThreat, "28004", 2);
    expect(mainThreat(state)).toBe(10 - 3);
  });

  // 28005.pot-shot-constant is the same gap as Lightspeed Flight's — only its Hero Action is exercised.
  it("28005.pot-shot-action: deals 4 damage to an enemy", () => {
    const hero = runWave5(novaVsRhino(), toHero(P1));
    const villain = hero.villains[0]!.instanceId;
    const before = inst(hero, villain).damage;
    const { state } = playFromHand(hero, "28005", 2);
    expect(inst(state, villain).damage).toBe(before + 4);
  });

  // 28006.unleash-nova-force-action ("Until the end of the round, each time Nova defeats an enemy or removes the
  // last threat from a scheme, ready Nova and draw 1 card") is a genuine engine gap — see the module docblock in
  // `events.ts` — so it has no test here.

  it("28011.chase-them-down-response: removes 2 threat from a scheme after your hero attacks and defeats an enemy", () => {
    const given = moveToHand(runWave5(novaVsRhino(), toHero(P1)), P1, "28011");
    const identity = identityOf(given.state);
    const villain = given.state.villains[0]!.instanceId;
    const scheme = given.state.mainScheme.instanceId;
    const withThreat = patchInstance(given.state, scheme, { threat: 8 });
    const max = maxHitPoints(withThreat, villain, WAVE5_DEPS) ?? 1;
    const primed = patchInstance(withThreat, villain, { damage: Math.max(0, max - 1) }); // Nova's own basic ATK is 1.
    const attacked = settle(
      runWave5(primed, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }),
      accepting("28011.chase-them-down-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(attacked, villain).damage).toBe(0); // defeated; the stage's own dial resets.
    expect(mainThreat(attacked)).toBe(8 - 2);
  });

  it("28011.chase-them-down-response: removes no threat when the attack doesn't defeat its target", () => {
    const given = moveToHand(runWave5(novaVsRhino(), toHero(P1)), P1, "28011");
    const identity = identityOf(given.state);
    const villain = given.state.villains[0]!.instanceId;
    const scheme = given.state.mainScheme.instanceId;
    const withThreat = patchInstance(given.state, scheme, { threat: 8 });
    const undamaged = patchInstance(withThreat, villain, { damage: 0 }); // Rhino's own hit points are well above 1.
    const attacked = settle(
      runWave5(undamaged, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(mainThreat(attacked)).toBe(8);
  });

  it("28012.pitchback-response: deals 4 damage to an enemy after your hero attacks, once Nova has the Aerial trait (Supernova Helmet in play)", () => {
    const hero = runWave5(novaVsRhino(), toHero(P1));
    const withHelmet = playFromHand(hero, "28009", 1).state; // Supernova Helmet: "Nova gains the Aerial trait."
    const given = moveToHand(withHelmet, P1, "28012");
    const identity = identityOf(given.state);
    const villain = given.state.villains[0]!.instanceId;
    const before = inst(given.state, villain).damage;
    const attacked = settle(
      runWave5(given.state, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      accepting("28012.pitchback-response"),
      undefined,
      WAVE5_DEPS,
    );
    // 1 (Nova's own basic ATK) + 4 (Pitchback).
    expect(inst(attacked, villain).damage).toBe(before + 1 + 4);
  });

  it("28012.pitchback-response: never offered without the Aerial trait (its own printed play restriction)", () => {
    const hero = runWave5(novaVsRhino(), toHero(P1));
    const given = moveToHand(hero, P1, "28012"); // no Supernova Helmet in play: identity has no Aerial trait.
    const identity = identityOf(given.state);
    const villain = given.state.villains[0]!.instanceId;
    const before = inst(given.state, villain).damage;
    const attacked = settle(
      runWave5(given.state, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(attacked, villain).damage).toBe(before + 1); // only Nova's own basic ATK; Pitchback was never playable.
  });

  it("28013.no-quarter-action: deals 4 damage to an enemy; for each point of excess damage, discards a card from the top of your deck and adds each Aggression card discarded this way to your hand", () => {
    const hero = runWave5(novaVsRhino(), toHero(P1));
    const villain = hero.villains[0]!.instanceId;
    const max = maxHitPoints(hero, villain, WAVE5_DEPS) ?? 4;
    const primed = patchInstance(hero, villain, { damage: Math.max(0, max - 2) }); // 2 remaining hit points: 4 damage is 2 excess.
    // The Locust (28010, aspect "aggression") on top, then Ms. Marvel (28002, aspect "hero:28001a", not Aggression).
    const stacked = putOnTopOfDeck(primed, P1, "28010", "28002");
    const given = moveToHand(stacked.state, P1, "28013", "28002", "28015"); // No Quarter, plus explicit Requirement([physical]) payment.
    const [card, physicalCard, wildCard] = given.ids as [InstanceId, InstanceId, InstanceId];
    const after = settle(
      runWave5(given.state, play(P1, card, [physicalCard, wildCard])),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(0); // defeated; the stage's own dial resets.
    const [locust, marvel] = stacked.ids as [InstanceId, InstanceId];
    expect(playerOf(after, P1).hand).toContain(locust); // the Aggression card, added to hand.
    expect(playerOf(after, P1).discard).toContain(marvel); // the non-Aggression card, left discarded.
    expect(playerOf(after, P1).discard).not.toContain(locust);
  });

  it("28013.no-quarter-action: no excess damage discards nothing from the top of your deck", () => {
    const hero = runWave5(novaVsRhino(), toHero(P1));
    const villain = hero.villains[0]!.instanceId;
    const undamaged = patchInstance(hero, villain, { damage: 0 }); // Rhino's own hit points are well above 4.
    const stacked = putOnTopOfDeck(undamaged, P1, "28010");
    const given = moveToHand(stacked.state, P1, "28013", "28002", "28015");
    const [card, physicalCard, wildCard] = given.ids as [InstanceId, InstanceId, InstanceId];
    const before = inst(given.state, villain).damage;
    const after = settle(
      runWave5(given.state, play(P1, card, [physicalCard, wildCard])),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(before + 4); // 0 excess (4 damage, well below Rhino's remaining hit points).
    const [locust] = stacked.ids as [InstanceId];
    expect(playerOf(after, P1).deck).toContain(locust); // never discarded.
    expect(playerOf(after, P1).hand).not.toContain(locust);
  });

  it("28014.one-by-one-action: deals 2 damage to an enemy, then 2 more to an enemy if that attack defeats it", () => {
    const ADVANCE = "01186";
    const HYDRA_MERCENARY = "01101";
    const state = stackEncounterDeck(runWave5(novaVsRhino(), toHero(P1)), ADVANCE, HYDRA_MERCENARY);
    const afterRound1 = settle(runWave5(state, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const minion = instancesOf(afterRound1, HYDRA_MERCENARY).find((id) => cardsInPlay(afterRound1).includes(id))!;
    expect(minion).toBeDefined();
    const maxMinionHp = maxHitPoints(afterRound1, minion, WAVE5_DEPS) ?? 2;
    const primedMinion = patchInstance(afterRound1, minion, { damage: Math.max(0, maxMinionHp - 2) }); // 2 remaining hit points.
    const villain = afterRound1.villains[0]!.instanceId;
    const villainDamageBefore = inst(primedMinion, villain).damage;
    const pickTargets: Picker = (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      // First target: the minion (defeated by this attack). Second: the villain (still in play, Guard no
      // longer applies once the minion is gone).
      const offered = choice.options.map((o) => o.optionId);
      if (offered.includes(minion)) return [minion];
      if (offered.includes(villain)) return [villain];
      return firstLegal(s);
    };
    const { state: after } = playFromHand(primedMinion, "28014", 1, pickTargets);
    expect(cardsInPlay(after)).not.toContain(minion); // defeated by the first 2 damage.
    expect(inst(after, villain).damage).toBe(villainDamageBefore + 2); // the second "deal 2 damage to an enemy".
  });

  it("28014.one-by-one-action: deals only the first 2 damage when that attack doesn't defeat its target", () => {
    const hero = runWave5(novaVsRhino(), toHero(P1));
    const villain = hero.villains[0]!.instanceId;
    const undamaged = patchInstance(hero, villain, { damage: 0 }); // Rhino's own hit points are well above 2.
    const before = inst(undamaged, villain).damage;
    const { state } = playFromHand(undamaged, "28014", 1);
    expect(inst(state, villain).damage).toBe(before + 2);
  });

  it("28026.yaw-and-roll-response: removes 3 threat from a scheme after your hero thwarts, once Nova has the Aerial trait", () => {
    const base = startWave5Game(novaScenarioWithExtras("rhino", { seed: 1, extraCodes: ["28026"] }));
    const hero = runWave5(base, toHero(P1));
    const withHelmet = playFromHand(hero, "28009", 1).state; // Supernova Helmet: "Nova gains the Aerial trait."
    const given = moveToHand(withHelmet, P1, "28026");
    const identity = identityOf(given.state);
    const scheme = given.state.mainScheme.instanceId;
    const withThreat = patchInstance(given.state, scheme, { threat: 10 });
    const thwarted = settle(
      runWave5(withThreat, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      }),
      accepting("28026.yaw-and-roll-response"),
      undefined,
      WAVE5_DEPS,
    );
    // 1 (Nova's own basic THW) + 3 (Yaw and Roll).
    expect(mainThreat(thwarted)).toBe(10 - 1 - 3);
  });

  it("28026.yaw-and-roll-response: never offered without the Aerial trait (its own printed play restriction)", () => {
    const base = startWave5Game(novaScenarioWithExtras("rhino", { seed: 1, extraCodes: ["28026"] }));
    const hero = runWave5(base, toHero(P1));
    const given = moveToHand(hero, P1, "28026"); // no Supernova Helmet in play: identity has no Aerial trait.
    const identity = identityOf(given.state);
    const scheme = given.state.mainScheme.instanceId;
    const withThreat = patchInstance(given.state, scheme, { threat: 10 });
    const thwarted = settle(
      runWave5(withThreat, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(mainThreat(thwarted)).toBe(10 - 1); // only Nova's own basic THW; Yaw and Roll was never playable.
  });
});
