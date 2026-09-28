import { cardsInPlay, maxHitPoints, type GameState, type InstanceId } from "@mc/engine";
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

  describe("28006.unleash-nova-force-action", () => {
    const MINION = "01101"; // Hydra Mercenary: 3 hit points, no text beyond Guard.
    const SIDE_SCHEME = "01109"; // Bomb Scare.
    const hand = (state: GameState) => playerOf(state, P1).hand.length;
    const exhausted = (state: GameState) => inst(state, identityOf(state)).exhausted;
    const attackWith = (state: GameState, attacker: InstanceId, target: InstanceId) =>
      settle(
        runWave5(state, { type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: target }),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
    const thwartWithNova = (state: GameState, scheme: InstanceId) =>
      settle(
        runWave5(state, {
          type: "basicThwart",
          playerId: P1,
          thwarterInstanceId: identityOf(state),
          schemeInstanceId: scheme,
        }),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
    /**
     * Ends the turn with `code` dealt to Nova in the villain phase (behind Advance, a 0-boost card for Rhino's attack),
     * settling into the next round's player phase; returns the revealed card's in-play instance.
     */
    const revealNext = (state: GameState, code: string) => {
      const stacked = stackEncounterDeck(state, "01186", code);
      const next = settle(runWave5(stacked, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
      const id = instancesOf(next, code).find((i) => cardsInPlay(next).includes(i))!;
      return { state: next, id };
    };
    /** Nova in hero form, a Hydra Mercenary engaged with her on 1 remaining hit point (round 2, after its reveal). */
    const withMinion = () => {
      const hero = runWave5(novaVsRhino(), toHero(P1));
      const { state, id } = revealNext(hero, MINION);
      const hp = maxHitPoints(state, id, WAVE5_DEPS) ?? 3;
      return { state: patchInstance(state, id, { damage: hp - 1 }), minion: id };
    };

    it("defeating an enemy readies Nova and draws 1 card", () => {
      const { state: staged, minion } = withMinion();
      const { state: played } = playFromHand(staged, "28006", 1);
      const handBefore = hand(played);
      const after = attackWith(played, identityOf(played), minion);
      expect(cardsInPlay(after)).not.toContain(minion); // defeated
      expect(exhausted(after)).toBe(false); // the basic attack exhausted her; the effect readied her
      expect(hand(after)).toBe(handBefore + 1);
    });

    it("without it, the same defeat leaves Nova exhausted and draws nothing", () => {
      const { state: staged, minion } = withMinion();
      const handBefore = hand(staged);
      const after = attackWith(staged, identityOf(staged), minion);
      expect(cardsInPlay(after)).not.toContain(minion);
      expect(exhausted(after)).toBe(true);
      expect(hand(after)).toBe(handBefore);
    });

    it("removing the last threat from a side scheme readies Nova and draws 1 card", () => {
      const hero = runWave5(novaVsRhino(), toHero(P1));
      const { state: revealed, id: scheme } = revealNext(hero, SIDE_SCHEME);
      const { state: played } = playFromHand(patchInstance(revealed, scheme, { threat: 1 }), "28006", 1);
      const handBefore = hand(played);
      const after = thwartWithNova(played, scheme); // Nova's THW is 1
      expect(cardsInPlay(after)).not.toContain(scheme); // defeated
      expect(exhausted(after)).toBe(false);
      expect(hand(after)).toBe(handBefore + 1);
    });

    it("removing some but not all of a scheme's threat does nothing", () => {
      const hero = runWave5(novaVsRhino(), toHero(P1));
      const { state: revealed, id: scheme } = revealNext(hero, SIDE_SCHEME);
      const { state: played } = playFromHand(patchInstance(revealed, scheme, { threat: 3 }), "28006", 1);
      const handBefore = hand(played);
      const after = thwartWithNova(played, scheme);
      expect(inst(after, scheme).threat).toBe(2);
      expect(exhausted(after)).toBe(true);
      expect(hand(after)).toBe(handBefore);
    });

    it("removing the last threat from the main scheme counts too (it is a scheme)", () => {
      const hero = runWave5(novaVsRhino(), toHero(P1));
      const scheme = hero.mainScheme.instanceId;
      const { state: played } = playFromHand(patchInstance(hero, scheme, { threat: 1 }), "28006", 1);
      const handBefore = hand(played);
      const after = thwartWithNova(played, scheme);
      expect(mainThreat(after)).toBe(0);
      expect(exhausted(after)).toBe(false);
      expect(hand(after)).toBe(handBefore + 1);
    });

    it("happens each time: a defeat and then a cleared scheme in the same round ready and draw twice", () => {
      const { state: staged, minion } = withMinion();
      const scheme = staged.mainScheme.instanceId;
      const { state: played } = playFromHand(patchInstance(staged, scheme, { threat: 1 }), "28006", 1);
      const handBefore = hand(played);
      const first = attackWith(played, identityOf(played), minion);
      expect(exhausted(first)).toBe(false);
      expect(hand(first)).toBe(handBefore + 1);
      const second = thwartWithNova(first, scheme); // only possible because the first trigger readied her
      expect(mainThreat(second)).toBe(0);
      expect(exhausted(second)).toBe(false);
      expect(hand(second)).toBe(handBefore + 2);
    });

    it("ends at the end of the round: a defeat in the next round does nothing", () => {
      const hero = runWave5(novaVsRhino(), toHero(P1));
      const { state: played } = playFromHand(hero, "28006", 1);
      expect(played.lastingEffects.some((e) => e.kind === "eachTime")).toBe(true);
      // Ending the turn runs the villain phase (revealing the minion) and starts the next round.
      const { state: nextRound, id: minion } = revealNext(played, MINION);
      expect(nextRound.round).toBe(played.round + 1);
      expect(nextRound.lastingEffects.some((e) => e.kind === "eachTime")).toBe(false);
      const hp = maxHitPoints(nextRound, minion, WAVE5_DEPS) ?? 3;
      const primed = patchInstance(nextRound, minion, { damage: hp - 1 });
      const handBefore = hand(primed);
      const after = attackWith(primed, identityOf(primed), minion);
      expect(cardsInPlay(after)).not.toContain(minion);
      expect(exhausted(after)).toBe(true);
      expect(hand(after)).toBe(handBefore);
    });

    it("another character defeating an enemy does not trigger it", () => {
      const { state: staged, minion } = withMinion();
      const { state: withAlly, id: ally } = playFromHand(staged, "28002", 3); // Ms. Marvel, ATK 1
      expect(cardsInPlay(withAlly)).toContain(ally);
      const { state: played } = playFromHand(withAlly, "28006", 1);
      const handBefore = hand(played);
      const after = attackWith(played, ally, minion);
      expect(cardsInPlay(after)).not.toContain(minion);
      expect(exhausted(after)).toBe(false); // Nova never exhausted, and nothing else changed
      expect(hand(after)).toBe(handBefore);
    });
  });

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
