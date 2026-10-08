/**
 * Owner decision of 2026-10-08 (docs/phase7-wave8.md §4.1 row 73, rules check A1, second half), proved on REAL cards:
 * an "(attack)" ability that makes its attack after an earlier instruction begins that attack when the ability begins
 * resolving, like an ability that only deals damage (row 61).
 *
 * Official rule, RRG 1.8 "Labeled Ability" (p. 26): "The identity of the player using the labeled ability is considered
 * to be performing the labeled effect when the labeled ability begins resolving (after costs have been paid)."
 *
 * The rule is the engine's (`packages/engine/src/resolve/attack-ability.ts`, fixtures in the engine's
 * `attack-label.test.ts`, "Row 73"); no card script was rewritten for it. Each test states the order before the
 * decision (the attack, and its "when … attacks" window, began at the damage instruction) and asserts the order now.
 * What the engine reads ahead to decide that an attack will be made, and what a stun received meanwhile does, are
 * interpretations, stated with their alternatives in that file.
 *
 * Every card is played from a real Core Spider-Man (Justice) hand in a real Rhino game (`testing/qa-bench.ts`).
 */
import { cardId } from "@mc/content";
import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { identityOf, inst, P1, patchInstance, payWith, play, playerOf } from "./testing/harness.js";
import { conjure, drive, playOut, rhino, withTrait } from "./testing/qa-bench.js";
import { engageMinion } from "./wave6/mut_gen/project-wideawake-testing.js";

const MERCENARY = "01101"; // Hydra Mercenary: 3 hit points, Guard.
const STRENGTH = "01090"; // Strength: a double [physical] resource.

const villainOf = (state: GameState): InstanceId => state.activeVillainId!;
const costOf = (state: GameState, code: string): number => {
  const card = state.cardPool[cardId(code)]!;
  return "cost" in card && typeof card.cost === "number" ? card.cost : 0;
};
const index = (events: readonly GameEvent[], test: (e: GameEvent) => boolean): number => events.findIndex(test);
const indexes = (events: readonly GameEvent[], test: (e: GameEvent) => boolean): number[] =>
  events.flatMap((e, at) => (test(e) ? [at] : []));
const begins = (e: GameEvent): boolean =>
  e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "attack";
const begun = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "attack" ? [e.event] : [],
  );
const resolved = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack" ? [e.event] : [],
  );
const instances = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "dealDamage" ? [e.event] : [],
  );
const attacked = (events: readonly GameEvent[]): InstanceId[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "characterAttacked"
      ? [e.event.targetInstanceId]
      : [],
  );
const damageTo =
  (id: InstanceId) =>
  (e: GameEvent): boolean =>
    e.type === "damageDealt" && e.targetInstanceId === id;
const statusGiven =
  (id: InstanceId, status: string) =>
  (e: GameEvent): boolean =>
    e.type === "statusGiven" && e.instanceId === id && e.status === status;
const takenBy = (events: readonly GameEvent[], id: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === id ? [e.amount] : []));

/** A Hydra Mercenary engaged with P1 with no guard, `hp` hit points and, if given, retaliate. */
function withMinion(
  state: GameState,
  as: { readonly hp: number; readonly retaliate?: number },
): { readonly state: GameState; readonly id: InstanceId } {
  const engaged = engageMinion(state, MERCENARY, P1);
  const printed = engaged.state.cardPool[cardId(MERCENARY)]!;
  if (printed.type !== "minion") throw new Error("Hydra Mercenary is not a minion");
  const card = {
    ...printed,
    hp: as.hp,
    keywords: as.retaliate ? [{ name: "retaliate" as const, value: as.retaliate }] : [],
  };
  return { id: engaged.id, state: { ...engaged.state, cardPool: { ...engaged.state.cardPool, [card.id]: card } } };
}

const stunned = (state: GameState): GameState => {
  const hero = identityOf(state);
  return patchInstance(state, hero, { statuses: { ...inst(state, hero).statuses, stunned: 1 } });
};

describe("Repulsor Blast (01031): 'Deal 1 damage to an enemy and discard the top 5 cards of your deck. For each [energy] discarded this way, deal 2 additional damage'", () => {
  // Before: the 5 cards were discarded, then the attack began (its window after the discard) and dealt its damage.
  // Now: the attack begins against the chosen enemy, then the discard, then the one instance of damage.
  it("the attack begins before the discard, against the chosen enemy; the discard still sizes its one instance of damage", () => {
    const given = conjure(rhino(), "01031");
    const villain = villainOf(given.state);
    const hero = identityOf(given.state);
    const deckBefore = playerOf(given.state, P1).deck.length;
    const done = playOut(given.state, given.id, costOf(given.state, "01031"), { target: villain });
    expect(done.accepted).toBe(true);
    const [made, ...more] = begun(done.events);
    expect(more).toEqual([]);
    expect(made).toMatchObject({ begun: true, attackerInstanceId: hero, targetInstanceId: villain, amount: 0 });
    const discarded = index(done.events, (e) => e.type === "cardDiscardedFromDeck");
    expect(index(done.events, begins)).toBeGreaterThanOrEqual(0);
    expect(index(done.events, begins)).toBeLessThan(discarded);
    expect(discarded).toBeLessThan(index(done.events, damageTo(villain)));
    expect(playerOf(done.state, P1).deck.length).toBe(deckBefore - 5);
    // One attack, one instance: 1 + 2 for each [energy] discarded.
    const [attack] = resolved(done.events);
    expect(resolved(done.events)).toHaveLength(1);
    const [dealt] = takenBy(done.events, villain);
    expect(takenBy(done.events, villain)).toHaveLength(1);
    expect(dealt! % 2).toBe(1);
    expect(attack).toMatchObject({ targetInstanceId: villain, amount: dealt });
    expect(instances(done.events).filter((d) => d.targetInstanceId === villain)[0]).toMatchObject({
      fromAttack: true,
      sourceInstanceId: hero,
    });
    expect(done.state.stack).toEqual([]);
  });

  it("stunned: the stunned card is discarded instead, with no discard from the deck and no damage (RRG 1.8 pp. 26, 41)", () => {
    // P. 41: "If a stunned identity or ally attempts to attack or use an attack ability, discard the stunned card
    // instead. Costs associated with the attack attempt … must still be paid." P. 26: "the entire ability (except
    // for its costs) is canceled", so the instruction before the damage does not resolve either.
    const given = conjure(stunned(rhino()), "01031");
    const villain = villainOf(given.state);
    const before = playerOf(given.state, P1);
    const done = playOut(given.state, given.id, costOf(given.state, "01031"), { target: villain });
    expect(done.accepted).toBe(true);
    expect(inst(done.state, identityOf(done.state)).statuses.stunned).toBe(0);
    expect(begun(done.events)).toEqual([]);
    expect(takenBy(done.events, villain)).toEqual([]);
    expect(playerOf(done.state, P1).deck.length).toBe(before.deck.length);
    // Its cost stays paid and the event is discarded.
    expect(playerOf(done.state, P1).discard).toContain(given.id);
  });
});

describe("Tackle (05015): 'Stun an enemy. If you paid for this card using a [physical] resource, deal 3 damage to that enemy.'", () => {
  /** Tackle in hand with a Strength to pay for it, or paid with the hand's first cards (no [physical] among them). */
  const tackle = (state: GameState, physical: boolean) => {
    const given = conjure(state, "05015");
    if (!physical) return { ...given, payment: undefined };
    const strength = conjure(given.state, STRENGTH);
    // Tackle costs 3: the Strength's two [physical] and one more card.
    const [other] = payWith(strength.state, P1, 1, [given.id, strength.id]);
    return { state: strength.state, id: given.id, payment: [strength.id, other!] };
  };

  // Before: the enemy was stunned, then the attack began and dealt 3. Now: the attack begins, then the stun, then 3.
  it("paid with [physical]: the attack begins before the stun; stunned card, then 3 attack damage to that enemy", () => {
    const minion = withMinion(rhino(), { hp: 9, retaliate: 1 });
    const given = tackle(minion.state, true);
    const hero = identityOf(given.state);
    const done = drive(given.state, play(P1, given.id, given.payment!), { target: minion.id });
    expect(done.accepted).toBe(true);
    const [made, ...more] = begun(done.events);
    expect(more).toEqual([]);
    expect(made).toMatchObject({ begun: true, attackerInstanceId: hero, targetInstanceId: minion.id });
    const stun = index(done.events, statusGiven(minion.id, "stunned"));
    expect(index(done.events, begins)).toBeLessThan(stun);
    expect(stun).toBeLessThan(index(done.events, damageTo(minion.id)));
    expect(takenBy(done.events, minion.id)).toEqual([3]);
    expect(inst(done.state, minion.id).statuses.stunned).toBe(1);
    // One attack on the minion: it retaliates once, after the ability.
    expect(attacked(done.events)).toEqual([minion.id]);
    expect(takenBy(done.events, hero)).toEqual([1]);
    expect(done.state.stack).toEqual([]);
  });

  it("not paid with [physical]: the branch is not taken, so no attack is made; the enemy is stunned", () => {
    const minion = withMinion(rhino(), { hp: 9, retaliate: 1 });
    const given = tackle(minion.state, false);
    const hero = identityOf(given.state);
    const done = playOut(given.state, given.id, costOf(given.state, "05015"), { target: minion.id });
    expect(done.accepted).toBe(true);
    // The hand's first cards hold no [physical] resource in this seed; if they did, this would be the case above.
    expect(begun(done.events)).toEqual([]);
    expect(takenBy(done.events, minion.id)).toEqual([]);
    expect(takenBy(done.events, hero)).toEqual([]);
    expect(inst(done.state, minion.id).statuses.stunned).toBe(1);
  });

  it("stunned: the whole ability is cancelled, so the enemy is not stunned either (RRG 1.8 p. 26)", () => {
    const minion = withMinion(stunned(rhino()), { hp: 9 });
    const given = tackle(minion.state, true);
    const done = drive(given.state, play(P1, given.id, given.payment!), { target: minion.id });
    expect(done.accepted).toBe(true);
    expect(inst(done.state, identityOf(done.state)).statuses.stunned).toBe(0);
    expect(inst(done.state, minion.id).statuses.stunned).toBe(0);
    expect(begun(done.events)).toEqual([]);
    expect(takenBy(done.events, minion.id)).toEqual([]);
  });
});

describe("Giant Stomp (12003): 'Deal 1 damage to each minion. Deal 8 damage to an enemy.'", () => {
  // Before: the 1 damage to each minion was plain damage dealt before the attack existed (no retaliate, not attacked),
  // and the attack began at "deal 8". Now: the attack begins first and both sentences are its damage (RRG 1.8 p. 10:
  // "An ability labeled as an attack is considered a single attack, even if that attack deals multiple instances").
  it("one attack from its first sentence: each minion and the enemy chosen are attacked; a retaliating minion answers once", () => {
    const minion = withMinion(withTrait(rhino(), "GIANT"), { hp: 9, retaliate: 1 });
    const given = conjure(minion.state, "12003");
    const villain = villainOf(given.state);
    const hero = identityOf(given.state);
    const done = playOut(given.state, given.id, costOf(given.state, "12003"), { target: villain });
    expect(done.accepted).toBe(true);
    const [made, ...more] = begun(done.events);
    expect(more).toEqual([]);
    // It begins against the first enemy one of its instructions names: the minion.
    expect(made).toMatchObject({ begun: true, attackerInstanceId: hero, targetInstanceId: minion.id });
    expect(index(done.events, begins)).toBeLessThan(index(done.events, damageTo(minion.id)));
    expect(index(done.events, damageTo(minion.id))).toBeLessThan(index(done.events, damageTo(villain)));
    expect(takenBy(done.events, minion.id)).toEqual([1]);
    expect(takenBy(done.events, villain)).toEqual([8]);
    expect(
      instances(done.events)
        .filter((d) => d.targetInstanceId !== hero)
        .map((d) => [d.fromAttack, d.sourceInstanceId]),
    ).toEqual([
      [true, hero],
      [true, hero],
    ]);
    const [attack, ...others] = resolved(done.events);
    expect(others).toEqual([]);
    expect(attack).toMatchObject({ targetInstanceId: villain, attacked: [minion.id, villain] });
    expect(attack!.results?.damage).toBe(9);
    expect(attacked(done.events)).toEqual([minion.id, villain]);
    // The minion's retaliate follows the whole ability.
    expect(takenBy(done.events, hero)).toEqual([1]);
    expect(indexes(done.events, damageTo(hero))[0]!).toBeGreaterThan(index(done.events, damageTo(villain)));
    expect(done.state.stack).toEqual([]);
  });
});

describe("Toe to Toe (10015): 'Choose an enemy. That enemy attacks you. Deal 5 damage to that enemy.'", () => {
  // Before: the enemy attacked, then the hero's attack began and dealt 5. Now: the hero's attack begins against the
  // chosen enemy, that enemy attacks, then the 5 damage.
  it("the hero's attack begins before the enemy attacks, and its 5 damage follows that attack", () => {
    const given = conjure(rhino(), "10015");
    const villain = villainOf(given.state);
    const hero = identityOf(given.state);
    const done = playOut(given.state, given.id, costOf(given.state, "10015"), { target: villain });
    expect(done.accepted).toBe(true);
    const [made, ...more] = begun(done.events);
    expect(more).toEqual([]);
    expect(made).toMatchObject({ begun: true, attackerInstanceId: hero, targetInstanceId: villain });
    const enemyAttacks = index(
      done.events,
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "enemyAttack",
    );
    const enemyAttackOver = index(
      done.events,
      (e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "enemyAttack",
    );
    expect(index(done.events, begins)).toBeLessThan(enemyAttacks);
    expect(enemyAttacks).toBeLessThan(enemyAttackOver);
    expect(enemyAttackOver).toBeLessThan(index(done.events, damageTo(villain)));
    expect(takenBy(done.events, villain)).toEqual([5]);
    expect(resolved(done.events)).toHaveLength(1);
    expect(resolved(done.events)[0]).toMatchObject({ targetInstanceId: villain, amount: 5 });
    expect(done.state.stack).toEqual([]);
  });
});

describe("Unlikely Duo (47022): 'Confuse an enemy. Deal 4 damage to a confused enemy.'", () => {
  // Before: the enemy was confused and the target chosen, then the attack began. Now: the attack begins after the
  // enemy to confuse is chosen (an opening target choice) and before the confused card is given. Its own target is
  // chosen after that, so the attack begins naming no enemy and takes the enemy its instruction attacks.
  /** Unlikely Duo reprinted for this game without Team-Up (Jubilee and Wolverine), which is not what is under test. */
  const withoutTeamUp = (state: GameState): GameState => {
    const printed = state.cardPool[cardId("47022")]!;
    if (printed.type !== "event") throw new Error("Unlikely Duo is not an event");
    const card = { ...printed, keywords: printed.keywords.filter((keyword) => keyword.name !== "teamUp") };
    return { ...state, cardPool: { ...state.cardPool, [card.id]: card } };
  };

  it("the attack begins before the enemy is confused; its target is the confused enemy chosen afterwards", () => {
    const given = conjure(withoutTeamUp(rhino()), "47022");
    const villain = villainOf(given.state);
    const hero = identityOf(given.state);
    const done = playOut(given.state, given.id, costOf(given.state, "47022"), { target: villain });
    expect(done.accepted).toBe(true);
    const [made, ...more] = begun(done.events);
    expect(more).toEqual([]);
    expect(made).toMatchObject({ begun: true, attackerInstanceId: hero, targetInstanceId: null });
    const [firstChoice, secondChoice] = indexes(done.events, (e) => e.type === "targetChosen");
    const confused = index(done.events, statusGiven(villain, "confused"));
    expect(firstChoice!).toBeLessThan(index(done.events, begins));
    expect(index(done.events, begins)).toBeLessThan(confused);
    expect(confused).toBeLessThan(secondChoice!);
    expect(secondChoice!).toBeLessThan(index(done.events, damageTo(villain)));
    expect(takenBy(done.events, villain)).toEqual([4]);
    expect(inst(done.state, villain).statuses.confused).toBe(1);
    expect(resolved(done.events)).toHaveLength(1);
    expect(resolved(done.events)[0]).toMatchObject({ targetInstanceId: villain, amount: 4 });
    expect(attacked(done.events)).toEqual([villain]);
    expect(done.state.stack).toEqual([]);
  });
});

describe("Swift Retribution (15014): 'The villain schemes. Deal 4 damage to the villain.'", () => {
  // Before: the villain schemed, then the attack began. Now: the attack begins, the villain schemes, then 4 damage.
  it("the attack begins before the villain schemes", () => {
    // No threat on the main scheme, so the villain's scheme does not complete it and end the game.
    const start = rhino();
    const given = conjure(patchInstance(start, start.mainScheme.instanceId, { threat: 0 }), "15014");
    const villain = villainOf(given.state);
    const done = playOut(given.state, given.id, costOf(given.state, "15014"));
    expect(done.accepted).toBe(true);
    expect(begun(done.events)).toHaveLength(1);
    expect(begun(done.events)[0]).toMatchObject({ begun: true, targetInstanceId: villain });
    const schemes = index(done.events, (e) => e.type === "schemeResolved");
    expect(schemes).toBeGreaterThanOrEqual(0);
    expect(index(done.events, begins)).toBeLessThan(schemes);
    expect(schemes).toBeLessThan(index(done.events, damageTo(villain)));
    expect(takenBy(done.events, villain)).toEqual([4]);
    expect(done.state.stack).toEqual([]);
  });
});

describe("Karmic Blast (21038): 'Deal 4 damage to an enemy and discard up to 4 cards from the top of your deck → 1 additional damage for each different aspect discarded this way'", () => {
  // Before: the number was chosen and the cards discarded, then the attack began. Now: every choice of how many to
  // discard makes the attack, so it begins before that choice, against the enemy already chosen.
  it("the attack begins before the discard, whatever number is chosen", () => {
    const given = conjure(rhino(), "21038");
    const villain = villainOf(given.state);
    const done = playOut(given.state, given.id, costOf(given.state, "21038"), { target: villain });
    expect(done.accepted).toBe(true);
    expect(begun(done.events)).toHaveLength(1);
    expect(begun(done.events)[0]).toMatchObject({ begun: true, targetInstanceId: villain });
    const asked = index(done.events, (e) => e.type === "choiceRequested" && e.choice.prompt.kind !== "chooseTarget");
    expect(index(done.events, begins)).toBeLessThan(asked);
    expect(asked).toBeLessThan(index(done.events, damageTo(villain)));
    expect(takenBy(done.events, villain)).toHaveLength(1);
    expect(takenBy(done.events, villain)[0]!).toBeGreaterThanOrEqual(4);
    expect(resolved(done.events)).toHaveLength(1);
    expect(done.state.stack).toEqual([]);
  });
});

describe("unchanged: an ability whose attack instruction resolves first makes its event there, with no early event", () => {
  it("Swinging Web Kick (01005): 'Deal 8 damage to an enemy.'", () => {
    const given = conjure(rhino(), "01005");
    const done = playOut(given.state, given.id, costOf(given.state, "01005"), { target: villainOf(given.state) });
    expect(done.accepted).toBe(true);
    expect(begun(done.events)).toHaveLength(1);
    expect(begun(done.events)[0]?.begun).toBeUndefined();
    expect(takenBy(done.events, villainOf(done.state))).toEqual([8]);
  });
});
