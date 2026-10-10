/**
 * `RuleSpec gainsAbility`: a card in play has, in addition to its printed abilities, a registry ability a constant
 * names. "If each of your allies has the Aerial trait, … this card gains: 'Response: After you play an Aerial card,
 * exhaust this card → ready an ally you control.'"; "each ally you control gains: 'Action: …'".
 *
 * RRG 1.8 "'Gains'" (p. 21): "If a card gains a characteristic (such as a trait, keyword, or ability text), the card
 * functions as if it possesses the gained characteristic. Gained characteristics are not considered to be printed on
 * the card." "Limit" (pp. 26-27); "Cost" (p. 13); "Constant Abilities" (p. 4: in effect while the card is in play).
 *
 * Synthetic cards only: a squadron that gains a response while each ally its player controls is Aerial, a lantern that
 * gains an action, a drill sergeant whose allies gain one, and the misuses that give nothing.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { activeAbilityRefs, gainedAbilities, printedAbilityRefs } from "./select.js";
import type { EffectSpec, Predicate, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubSupport } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const AERIAL = trait("AERIAL");
const self: TargetRef = { kind: "self" };
const n = (value: number) => ({ kind: "const", value }) as const;
const bump = (counterType: string): EffectSpec => ({ kind: "addCounters", target: self, counterType, amount: n(1) });
/** "If each of your allies has the Aerial trait" (true with no allies). */
const EACH_ALLY_AERIAL: Predicate = {
  kind: "not",
  of: { kind: "exists", query: { categories: ["ally"], controller: "you", withoutTrait: AERIAL } },
};

// "If each of your allies has the Aerial trait, this card gains: 'Response: After you play an Aerial card, remove 1
// fuel counter from this card → place 1 sortie counter here. (Limit once per round.)'"
const SQUADRON_RESPONSE = stubAbility("squadron.granted-response", {
  trigger: {
    kind: "response",
    forced: false,
    on: { on: "cardPlayed", targetIs: { trait: AERIAL }, playerIs: "controller" },
  },
  cost: { spendCounters: { counterType: "fuel", amount: 1 } },
  limit: { count: 1, period: "round" },
  effects: [bump("sortie")],
});
const SQUADRON_CONSTANT = stubAbility("squadron.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "gainsAbility", abilityId: SQUADRON_RESPONSE.ref.id, while: EACH_ALLY_AERIAL }],
  },
  effects: [],
});
const SQUADRON = stubSupport({ id: "squadron", cost: 0, abilities: [SQUADRON_CONSTANT.ref] });

// "This card gains: 'Action: Exhaust this card → place 1 glow counter here.'"
const LANTERN_ACTION = stubAbility("lantern.granted-action", {
  trigger: { kind: "action" },
  cost: { exhaustSelf: true },
  effects: [bump("glow")],
});
const LANTERN_CONSTANT = stubAbility("lantern.constant", {
  trigger: { kind: "constant", rules: [{ kind: "gainsAbility", abilityId: LANTERN_ACTION.ref.id }] },
  effects: [],
});
const LANTERN = stubSupport({ id: "lantern", cost: 0, abilities: [LANTERN_CONSTANT.ref] });

// "Each ally you control gains: 'Action: Exhaust this ally → place 1 drill counter on it.'"
const DRILL_ACTION = stubAbility("sergeant.granted-action", {
  trigger: { kind: "action" },
  cost: { exhaustSelf: true },
  effects: [bump("drill")],
});
const SERGEANT_CONSTANT = stubAbility("sergeant.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "gainsAbility", abilityId: DRILL_ACTION.ref.id, to: { categories: ["ally"], controller: "you" } }],
  },
  effects: [],
});
const SERGEANT = stubSupport({ id: "sergeant", cost: 0, abilities: [SERGEANT_CONSTANT.ref] });

// Misuses: a rule naming a constant, and one naming an id the registry lacks. Neither gives anything.
const INERT_CONSTANT = stubAbility("inert.other-constant", { trigger: { kind: "constant" }, effects: [] });
const MISUSE_CONSTANT = stubAbility("misuse.constant", {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "gainsAbility", abilityId: INERT_CONSTANT.ref.id },
      { kind: "gainsAbility", abilityId: "nowhere.to-be-found" as never },
    ],
  },
  effects: [],
});
const MISUSE = stubSupport({ id: "misuse", cost: 0, abilities: [MISUSE_CONSTANT.ref] });

const HAWK = stubAlly({ id: "hawk", traits: [AERIAL], cost: 0, atk: 1, thw: 1, hp: 2 });
const MOLE = stubAlly({ id: "mole", cost: 0, atk: 1, thw: 1, hp: 2 });
const KITE = stubSupport({ id: "kite", cost: 0, traits: [AERIAL] });
const CART = stubSupport({ id: "cart", cost: 0 });

const ABILITIES = [
  SQUADRON_RESPONSE,
  SQUADRON_CONSTANT,
  LANTERN_ACTION,
  LANTERN_CONSTANT,
  DRILL_ACTION,
  SERGEANT_CONSTANT,
  INERT_CONSTANT,
  MISUSE_CONSTANT,
];
const deps: EngineDeps = depsOf(...ABILITIES);
const CARDS = [SQUADRON, LANTERN, SERGEANT, MISUSE, HAWK, MOLE, KITE, CART];

function start(): GameState {
  return gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [...CARDS.map((c) => c.id), ...copiesOf(KITE.id, 3), ...copiesOf(HAWK.id, 2), SERGEANT.id],
  });
}
const put = (state: GameState, card: { readonly id: string }) => playerCardIntoPlay(state, card.id as never);
/** `state` with counters set on a card (surgery). */
const withCounters = (state: GameState, id: InstanceId, counters: Readonly<Record<string, number>>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), counters } },
});
/** One copy of `card` moved from P1's deck to their hand (surgery). */
function toHand(
  state: GameState,
  card: { readonly id: string },
): { readonly state: GameState; readonly id: InstanceId } {
  const seat = mustPlayer(state, P1);
  const id = seat.deck.find((candidate) => mustInstance(state, candidate).cardId === card.id);
  if (!id) throw new Error(`no ${card.id} in P1's deck`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((x) => x !== id), hand: [...p.hand, id] } : p,
      ),
    },
  };
}
/** A card in play moved to its owner's discard pile (surgery: it left play). */
const outOfPlay = (state: GameState, id: InstanceId): GameState => ({
  ...state,
  players: state.players.map((p) =>
    p.playerId === P1 ? { ...p, playArea: p.playArea.filter((x) => x !== id), discard: [id, ...p.discard] } : p,
  ),
});
const play = (card: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
});
const ids = (state: GameState, id: InstanceId) => activeAbilityRefs(state, id, deps).map((ref) => ref.id as string);
const counter = (state: GameState, id: InstanceId, type: string) => mustInstance(state, id).counters[type] ?? 0;
/** The option of an open trigger choice that is `abilityId` on `id`, if it is offered. */
const offered = (state: GameState, id: InstanceId, abilityId: string): string | undefined => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind !== "chooseTriggers") return undefined;
  return choice.options.find(
    (o) => o.ref.kind === "ability" && o.ref.instanceId === id && o.ref.abilityId === abilityId,
  )?.optionId;
};
const applied = (state: GameState, command: Command) => {
  const result = applyCommand(state, command, deps);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
};
/** The `useAbility` actions `legalActions` lists for P1 on `id`. */
const usable = (state: GameState, id: InstanceId): readonly string[] => {
  const listed = legalActions(state, P1, deps);
  if (listed.kind !== "turn") throw new Error("expected P1's turn");
  return listed.legal.flatMap((a) =>
    a.action.kind === "useAbility" && a.action.instanceId === id ? [a.action.abilityId as string] : [],
  );
};

describe("`RuleSpec gainsAbility`: a card in play gains a registry ability", () => {
  it("the gained ability joins the card's live abilities, and is not printed on it", () => {
    const squadron = put(start(), SQUADRON);
    expect(ids(squadron.state, squadron.id)).toEqual([SQUADRON_CONSTANT.ref.id, SQUADRON_RESPONSE.ref.id]);
    expect(printedAbilityRefs(SQUADRON).map((ref) => ref.id)).toEqual([SQUADRON_CONSTANT.ref.id]);
    expect(gainedAbilities(squadron.state, deps).get(squadron.id)).toEqual([
      { abilityId: SQUADRON_RESPONSE.ref.id, grantedBy: squadron.id },
    ]);
    // Without the registry there is no rule to read: the printed ref alone.
    expect(activeAbilityRefs(squadron.state, squadron.id).map((ref) => ref.id)).toEqual([SQUADRON_CONSTANT.ref.id]);
  });

  it("the granted response is offered while the condition holds: paid and limited under its own id", () => {
    const squadron = put(start(), SQUADRON);
    const hawk = put(squadron.state, HAWK);
    const fueled = withCounters(hawk.state, squadron.id, { fuel: 2 });
    const kite = toHand(fueled, KITE);
    const second = toHand(kite.state, KITE);
    const played = applied(second.state, play(kite.id));
    const option = offered(played, squadron.id, SQUADRON_RESPONSE.ref.id);
    expect(option).toBeDefined();
    const taken = applied(played, {
      type: "resolveChoice",
      playerId: P1,
      choiceId: played.pendingChoice!.choiceId,
      selectedOptionIds: [option!],
    });
    // Its cost: 1 of 2 fuel counters. Its effect: 1 sortie counter. Its limit: counted under the granted id.
    expect(counter(taken, squadron.id, "fuel")).toBe(1);
    expect(counter(taken, squadron.id, "sortie")).toBe(1);
    expect(taken.abilityUses).toEqual({ [`${squadron.id}:${SQUADRON_RESPONSE.ref.id}`]: 1 });
    expect(taken.pendingChoice).toBeNull();

    // A second Aerial card the same round: fuel is left, the limit is used, so it is not offered again.
    const again = applied(taken, play(second.id));
    expect(offered(again, squadron.id, SQUADRON_RESPONSE.ref.id)).toBeUndefined();
    expect(again.pendingChoice).toBeNull();
    expect(counter(again, squadron.id, "sortie")).toBe(1);

    const { session } = driveSession(startSession(second.state), deps, [play(kite.id), play(second.id)], (s) =>
      offered(s, squadron.id, SQUADRON_RESPONSE.ref.id) ? [offered(s, squadron.id, SQUADRON_RESPONSE.ref.id)!] : [],
    );
    expect(counter(session.state, squadron.id, "sortie")).toBe(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("not offered when the condition does not hold, when the card played is not the kind, or when the cost cannot be paid", () => {
    const squadron = put(start(), SQUADRON);
    const fueled = withCounters(squadron.state, squadron.id, { fuel: 2 });
    // A non-Aerial ally among the player's allies: the rule is off, the ability is not on the card.
    const mole = put(put(fueled, HAWK).state, MOLE);
    expect(ids(mole.state, squadron.id)).toEqual([SQUADRON_CONSTANT.ref.id]);
    const kite = toHand(mole.state, KITE);
    const played = applied(kite.state, play(kite.id));
    expect(played.pendingChoice).toBeNull();
    expect(counter(played, squadron.id, "sortie")).toBe(0);
    // The ally gone, the ability is back.
    expect(ids(outOfPlay(mole.state, mole.id), squadron.id)).toContain(SQUADRON_RESPONSE.ref.id);

    // The condition holds, and a card without the trait is played.
    const cart = toHand(fueled, CART);
    expect(applied(cart.state, play(cart.id)).pendingChoice).toBeNull();

    // The condition holds, and no fuel is left to pay with.
    const dry = toHand(withCounters(fueled, squadron.id, {}), KITE);
    expect(ids(dry.state, squadron.id)).toContain(SQUADRON_RESPONSE.ref.id);
    expect(applied(dry.state, play(dry.id)).pendingChoice).toBeNull();
  });

  it("the card leaving play removes the ability", () => {
    const squadron = put(start(), SQUADRON);
    const fueled = withCounters(squadron.state, squadron.id, { fuel: 2 });
    const gone = outOfPlay(fueled, squadron.id);
    expect(ids(gone, squadron.id)).not.toContain(SQUADRON_RESPONSE.ref.id);
    expect(gainedAbilities(gone, deps).size).toBe(0);
    const kite = toHand(gone, KITE);
    const played = applied(kite.state, play(kite.id));
    expect(played.pendingChoice).toBeNull();
    expect(counter(played, squadron.id, "fuel")).toBe(2);
  });

  it("a granted action appears in legal actions, is used by command, and is gone with the card", () => {
    const lantern = put(start(), LANTERN);
    expect(usable(lantern.state, lantern.id)).toEqual([LANTERN_ACTION.ref.id]);
    const use: Command = {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: lantern.id,
      abilityId: LANTERN_ACTION.ref.id,
      payment: [],
    };
    const { session } = driveSession(startSession(lantern.state), deps, [use]);
    expect(counter(session.state, lantern.id, "glow")).toBe(1);
    expect(mustInstance(session.state, lantern.id).exhausted).toBe(true);
    // Exhausted, its cost cannot be paid again: still its ability, no longer legal.
    expect(ids(session.state, lantern.id)).toContain(LANTERN_ACTION.ref.id);
    expect(usable(session.state, lantern.id)).toEqual([]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);

    const gone = outOfPlay(lantern.state, lantern.id);
    const refused = applyCommand(gone, use, deps);
    expect(refused.ok).toBe(false);
  });

  it("`to`: each card the query names gains it, with itself as `self`; two granting cards give it once", () => {
    const sergeant = put(start(), SERGEANT);
    const hawk = put(sergeant.state, HAWK);
    const mole = put(hawk.state, MOLE);
    expect(ids(mole.state, hawk.id)).toEqual([DRILL_ACTION.ref.id]);
    expect(ids(mole.state, mole.id)).toEqual([DRILL_ACTION.ref.id]);
    // Not the granting card itself, and not a support.
    expect(ids(mole.state, sergeant.id)).toEqual([SERGEANT_CONSTANT.ref.id]);
    expect(usable(mole.state, hawk.id)).toEqual([DRILL_ACTION.ref.id]);
    const { session } = driveSession(startSession(mole.state), deps, [
      { type: "useAbility", playerId: P1, cardInstanceId: hawk.id, abilityId: DRILL_ACTION.ref.id, payment: [] },
    ]);
    expect(counter(session.state, hawk.id, "drill")).toBe(1);
    expect(mustInstance(session.state, hawk.id).exhausted).toBe(true);
    expect(counter(session.state, mole.id, "drill")).toBe(0);
    expect(mustInstance(session.state, sergeant.id).exhausted).toBe(false);

    // A second sergeant: two rules reach the ally, which has the ability once.
    const two = put(mole.state, SERGEANT);
    expect(gainedAbilities(two.state, deps).get(hawk.id)).toHaveLength(2);
    expect(ids(two.state, hawk.id)).toEqual([DRILL_ACTION.ref.id]);
    expect(usable(two.state, hawk.id)).toEqual([DRILL_ACTION.ref.id]);
    // Both sergeants gone: the allies have nothing.
    const none = outOfPlay(outOfPlay(two.state, sergeant.id), two.id);
    expect(ids(none, hawk.id)).toEqual([]);
    expect(usable(none, hawk.id)).toEqual([]);
  });

  it("a rule naming a constant, or an id the registry lacks, gives nothing", () => {
    const misuse = put(start(), MISUSE);
    expect(ids(misuse.state, misuse.id)).toEqual([MISUSE_CONSTANT.ref.id]);
    expect(gainedAbilities(misuse.state, deps).size).toBe(0);
  });

  it("a registry with no such rule: a card's abilities are its printed list, the same array", () => {
    const plain: EngineDeps = depsOf(LANTERN_ACTION);
    const state = gameAtFirstTurn({ cards: CARDS, deps: plain, deck: CARDS.map((c) => c.id) });
    const lantern = playerCardIntoPlay(state, LANTERN.id);
    expect(gainedAbilities(lantern.state, plain).size).toBe(0);
    expect(activeAbilityRefs(lantern.state, lantern.id, plain)).toBe(LANTERN.abilities);
  });
});
