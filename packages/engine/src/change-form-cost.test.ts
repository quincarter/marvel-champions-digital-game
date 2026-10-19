/**
 * "Change to hero form and discard this card →" as an ability cost (`AbilityCost.changeForm`, `change-form-cost.ts`;
 * Entrapment 61024: "Alter-Ego Response (attack): After the villain schemes, change to hero form and discard this
 * card → deal damage to the villain …"). Synthetic cards: the response answers a card entering play (the primitive
 * does not care what it answers), an "after you change form" listener, a Work-Life Balance shaped additional cost
 * ("As an additional cost to change forms, discard 1 card from your hand", 61030) and a Claustrophobia shaped rule
 * ("You cannot change to hero form", 36030).
 *
 * Sources: RRG 1.8 "Cost" (pp. 13–14: paid in full or not at all; additional costs are paid simultaneously with the
 * cost they add to), "Form, Change Form" (p. 21: once per round, which a change by a card ability does not use),
 * "Initiating Abilities" (p. 24: costs are paid, step 5, before the effects resolve, step 6).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { Form, GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubResource, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCards } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const ENTRAP_COST: AbilityCost = { changeForm: "hero", discardSelf: true };

/** "Alter-Ego Response: After a card enters play, change to hero form and discard this card → 1 damage to the villain." */
const ENTRAP_RESPONSE = stubAbility("entrap.response", {
  trigger: { kind: "response", forced: false, form: "alterEgo", on: { on: "cardEntersPlay" } },
  cost: ENTRAP_COST,
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 1 } }],
});
const ENTRAP = stubSupport({ id: "entrap", cost: 0, abilities: [ENTRAP_RESPONSE.ref] });
/** The same cost on an Action: "Alter-Ego Action: Change to hero form → 1 damage to the villain." */
const LUNGE_ACTION = stubAbility("lunge.action", {
  trigger: { kind: "action", form: "alterEgo" },
  cost: { changeForm: "hero" },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 1 } }],
});
const LUNGE = stubSupport({ id: "lunge", cost: 0, abilities: [LUNGE_ACTION.ref] });
/** "Forced Response: After you change form, draw 1 card." */
const WATCH_RESPONSE = stubAbility("watch.response", {
  trigger: { kind: "response", forced: true, on: { on: "formChanged", playerIs: "controller" } },
  effects: [{ kind: "draw", player: you, amount: { kind: "const", value: 1 } }],
});
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_RESPONSE.ref] });
const constant = (id: string, rules: readonly RuleSpec[]) =>
  stubAbility(id, { trigger: { kind: "constant", rules }, effects: [] });
/** Work-Life Balance's shape: "As an additional cost to change forms, discard 1 card from your hand." */
const BALANCE_RULE = constant("balance.constant", [
  { kind: "formChangeCost", player: you, cost: { discardFromHand: { min: 1, max: 1 } } },
]);
const BALANCE = stubSupport({ id: "balance", cost: 0, abilities: [BALANCE_RULE.ref] });
/** Claustrophobia's shape: "You cannot change to hero form" (a rule while in alter-ego form; here always). */
const CLAUSTRO_RULE = constant("claustro.constant", [{ kind: "cannotChangeForm", player: you }]);
const CLAUSTRO = stubSupport({ id: "claustro", cost: 0, abilities: [CLAUSTRO_RULE.ref] });
/** The card whose entering play opens the response window. */
const SPARK = stubSupport({ id: "spark", cost: 0 });
const ENERGY = stubResource({ id: "energy", icons: 0, produces: { energy: 1 } });

const deps: EngineDeps = depsOf(LUNGE_ACTION, ENTRAP_RESPONSE, WATCH_RESPONSE, BALANCE_RULE, CLAUSTRO_RULE);

/** The first turn in `form`: these supports in play, exactly this hand plus Spark, Entrapment's shape in play. */
function table(supports: readonly CardId[], hand: readonly CardId[], form: Form = "alterEgo") {
  let state = gameAtFirstTurn({
    cards: [ENTRAP, LUNGE, WATCH, BALANCE, CLAUSTRO, SPARK, ENERGY],
    deps,
    deck: [ENTRAP.id, LUNGE.id, WATCH.id, BALANCE.id, CLAUSTRO.id, SPARK.id, ...copiesOf(ENERGY.id, 6)],
  });
  state = {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      hand: [],
      deck: [...p.deck, ...p.hand],
      identity: { ...p.identity, form },
    })),
  };
  const entrap = playerCardIntoPlay(state, ENTRAP.id);
  state = entrap.state;
  for (const card of supports) state = playerCardIntoPlay(state, card).state;
  const spark = giveCards(state, P1, SPARK.id);
  const dealt = giveCards(spark.state, P1, ...hand);
  return { state: dealt.state, entrap: entrap.id, spark: spark.ids[0]!, hand: dealt.ids };
}

const playSpark = (spark: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: spark,
  payment: [],
  attachToInstanceId: null,
});

/** Takes Entrapment's response when offered, pays a hand-discard cost with `discard`; else `defaultPick`. */
function run(state: GameState, entrap: InstanceId, spark: InstanceId, discard: readonly InstanceId[] = []) {
  const offered: boolean[] = [];
  const asked: string[][] = [];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      const option = choice.options.find((o) => o.ref.kind === "ability" && o.ref.instanceId === entrap);
      offered.push(option !== undefined);
      return option ? [option.optionId] : defaultPick(s);
    }
    if (choice?.prompt.kind === "chooseCostCards") {
      asked.push(choice.options.map((o) => o.optionId));
      return discard;
    }
    return defaultPick(s);
  };
  const { session, events } = driveSession(startSession(state), deps, [playSpark(spark)], pick);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events, offered: offered.some(Boolean), asked };
}

const formOf = (state: GameState): Form => mustPlayer(state, P1).identity.form;
const villainDamage = (state: GameState): number => mustInstance(state, state.activeVillainId).damage;
const indexOf = (events: readonly GameEvent[], test: (event: GameEvent) => boolean): number => events.findIndex(test);

describe("`AbilityCost.changeForm` (Entrapment 61024)", () => {
  it("pays by changing to hero form and discarding the card; the round's own change is left unused", () => {
    const { state, entrap, spark } = table([], []);
    const after = run(state, entrap, spark);
    expect(after.offered).toBe(true);
    expect(formOf(after.state)).toBe("hero");
    expect(mustPlayer(after.state, P1).discard).toContain(entrap);
    expect(villainDamage(after.state)).toBe(1);
    // A change by a card ability is not the once-per-round change (RRG 1.8 p. 21): the option is still there.
    expect(mustPlayer(after.state, P1).identity.changedFormThisRound).toBe(false);
    const actions = legalActions(after.state, P1, deps);
    expect(actions.kind === "turn" && actions.legal.some((entry) => entry.action.kind === "changeForm")).toBe(true);
  });

  it("'after you change form' resolves before the effect: the change and its response come before the damage", () => {
    const { state, entrap, spark } = table([WATCH.id], []);
    const before = mustPlayer(state, P1).hand.length;
    const { state: after, events } = run(state, entrap, spark);
    // Spark left the hand; the response drew one.
    expect(mustPlayer(after, P1).hand.length).toBe(before - 1 + 1);
    const changed = indexOf(events, (e) => e.type === "formChanged");
    const drew = indexOf(events, (e) => e.type === "cardDrawn");
    const damaged = indexOf(events, (e) => e.type === "damageDealt");
    expect(changed).toBeGreaterThanOrEqual(0);
    expect(drew).toBeGreaterThan(changed);
    expect(damaged).toBeGreaterThan(drew);
    // The change is logged as by an effect, not the player's own option.
    expect(events[changed]).toMatchObject({ type: "formChanged", to: "hero", byEffect: true });
  });

  it("control: already in hero form, the cost cannot be paid and the response is not offered", () => {
    const { state, entrap, spark } = table([], [], "hero");
    const after = run(state, entrap, spark);
    expect(after.offered).toBe(false);
    expect(mustPlayer(after.state, P1).discard).not.toContain(entrap);
    expect(villainDamage(after.state)).toBe(0);
  });

  it("a rule that forbids the change (Claustrophobia's shape) makes it unpayable: not offered", () => {
    const { state, entrap, spark } = table([CLAUSTRO.id], []);
    const after = run(state, entrap, spark);
    expect(after.offered).toBe(false);
    expect(formOf(after.state)).toBe("alterEgo");
    expect(villainDamage(after.state)).toBe(0);
  });

  it("Work-Life Balance's shape with an empty hand: the additional cost cannot be paid, so neither is offered", () => {
    const { state, entrap, spark } = table([BALANCE.id], []);
    const after = run(state, entrap, spark);
    expect(after.offered).toBe(false);
    expect(formOf(after.state)).toBe("alterEgo");
    expect(mustPlayer(after.state, P1).discard).not.toContain(entrap);
  });

  it("Work-Life Balance's shape with a card in hand: asked for the discard, and both costs are paid together", () => {
    const { state, entrap, spark, hand } = table([BALANCE.id], [ENERGY.id]);
    const [energy] = hand as [InstanceId];
    const after = run(state, entrap, spark, [energy]);
    expect(after.offered).toBe(true);
    expect(after.asked).toEqual([[energy]]);
    expect(formOf(after.state)).toBe("hero");
    expect(mustPlayer(after.state, P1).discard).toEqual(expect.arrayContaining([entrap, energy]));
    expect(mustPlayer(after.state, P1).hand).not.toContain(energy);
    expect(villainDamage(after.state)).toBe(1);
    expect(after.events.find((e) => e.type === "formChangeCostSettled")).toMatchObject({ outcome: "paid", to: "hero" });
  });

  it("declining the additional cost's discard pays nothing: no change, the card stays, no damage", () => {
    const { state, entrap, spark, hand } = table([BALANCE.id], [ENERGY.id]);
    const after = run(state, entrap, spark, []);
    expect(formOf(after.state)).toBe("alterEgo");
    expect(mustPlayer(after.state, P1).hand).toEqual(hand);
    expect(mustPlayer(after.state, P1).discard).not.toContain(entrap);
    expect(villainDamage(after.state)).toBe(0);
  });

  it("as an Action's cost: listed illegal with Work-Life Balance's shape and an empty hand; with a card, the example pays both", () => {
    const lungeOf = (state: GameState) => {
      const actions = legalActions(state, P1, deps);
      if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
      const mine = (entry: { readonly action: { readonly kind: string; readonly abilityId?: unknown } }) =>
        entry.action.kind === "useAbility" && entry.action.abilityId === LUNGE_ACTION.ref.id;
      return { legal: actions.legal.find(mine), illegal: actions.illegal.find(mine) };
    };
    const empty = table([LUNGE.id, BALANCE.id], []);
    // Spark is the only card in hand: it pays the discard, so play it away first.
    const bare = driveSession(startSession(empty.state), deps, [playSpark(empty.spark)], defaultPick).session.state;
    expect(lungeOf(bare).legal).toBeUndefined();
    expect(lungeOf(bare).illegal).toBeDefined();

    // The one card in hand (Spark) pays the discard.
    const { state, spark } = table([LUNGE.id, BALANCE.id], []);
    const { legal } = lungeOf(state);
    expect(legal?.example).toMatchObject({
      type: "useAbility",
      costChoices: { discard: [spark] },
    });
    const { session } = driveSession(startSession(state), deps, [legal!.example], defaultPick);
    expect(formOf(session.state)).toBe("hero");
    expect(villainDamage(session.state)).toBe(1);
    expect(mustPlayer(session.state, P1).discard).toContain(spark);
    expect(mustPlayer(session.state, P1).identity.changedFormThisRound).toBe(false);
  });
});
