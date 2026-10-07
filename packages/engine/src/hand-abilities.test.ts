/**
 * docs/phase7-wave4.md §3.13: abilities that work while their card is in hand, and "You cannot choose to discard this card
 * from your hand". Synthetic cards shaped like Pip the Troll (`mts` 21032: "While Pip the Troll is in your hand, he gains
 * 'Interrupt: When a player is attacked, spend [energy][mental] resources → put Pip the Troll into play under that player's
 * control.'") and System Shock (21185: "You cannot choose to discard this card from your hand. While this card is in your
 * hand, it gains: 'Alter-Ego Action: Spend a [mental] resource → remove this card from the game.'").
 *
 * Sources: the cards' own text; RRG 1.8 "Ability" (p. 4: an ability is active while its card is in play unless it says
 * otherwise), "Discard" (p. 16).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { locateCard, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
/** System Shock's gained Alter-Ego Action, here a plain action: "→ remove this card from the game". */
const SHOCK_ACTION = stubAbility("shock.action", {
  trigger: { kind: "action" },
  activeIn: "hand",
  effects: [{ kind: "moveCards", cards: { kind: "ref", ref: self }, to: "removedFromGame" }],
} satisfies AbilityDefinition);
const SHOCK_RULE = stubAbility("shock.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotChooseToDiscard" }] },
  activeIn: "hand",
  effects: [],
} satisfies AbilityDefinition);
const SHOCK = stubAlly({
  id: "system-shock",
  cost: 0,
  atk: 0,
  thw: 0,
  hp: 1,
  abilities: [SHOCK_ACTION.ref, SHOCK_RULE.ref],
});
/** Pip-like: "Response: after you change form, put this card into play" — from hand only. */
const PIP_RESPONSE = stubAbility("pip.response", {
  trigger: { kind: "response", forced: false, on: { on: "formChanged", playerIs: "controller" } },
  activeIn: "hand",
  effects: [{ kind: "putIntoPlay", card: self, controller: { kind: "controller" } }],
} satisfies AbilityDefinition);
const PIP = stubAlly({ id: "pip", cost: 2, atk: 1, thw: 1, hp: 2, abilities: [PIP_RESPONSE.ref] });

const DISCARD_ONE: { card: ReturnType<typeof stubEvent>; ability: ReturnType<typeof stubAbility> } = (() => {
  const effects: EffectSpec[] = [
    { kind: "discardFromHand", player: { kind: "controller" }, amount: { kind: "const", value: 1 } },
  ];
  const ability = stubAbility("discard-one.action", { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id: "discard-one", cost: 0, abilities: [ability.ref] }), ability };
})();

const deps: EngineDeps = depsOf(SHOCK_ACTION, SHOCK_RULE, PIP_RESPONSE, DISCARD_ONE.ability);

function start(): GameState {
  return gameAtFirstTurn({
    cards: [SHOCK, PIP, DISCARD_ONE.card],
    deps,
    deck: [SHOCK.id, PIP.id, ...copiesOf(DISCARD_ONE.card.id, 2)],
  });
}
const inHand = (state: GameState, card: typeof SHOCK): { state: GameState; id: InstanceId } =>
  giveCard(state, P1, card.id);
const offersAbility = (state: GameState, id: InstanceId): boolean => {
  const actions = legalActions(state, P1, deps);
  return (
    actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "useAbility" && a.action.instanceId === id)
  );
};

describe("§3.13 abilities active in hand", () => {
  it("an action that works in hand is offered and used from hand, and not once the card is in play", () => {
    const given = inHand(start(), SHOCK);
    const { session } = driveSession(startSession(given.state), deps, [
      { type: "useAbility", playerId: P1, cardInstanceId: given.id, abilityId: SHOCK_ACTION.ref.id, payment: [] },
    ]);
    expect(locateCard(session.state, given.id)).toEqual({ kind: "removedFromGame" });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
    const inPlay = playerCardIntoPlay(start(), SHOCK.id);
    expect(offersAbility(inPlay.state, inPlay.id)).toBe(false);
    expect(offersAbility(given.state, given.id)).toBe(true);
  });

  it("a response that works in hand fires from hand and puts the card into play", () => {
    const given = inHand(start(), PIP);
    // Take the offered response whenever the window names Pip; otherwise the default (pass).
    const takePip = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      const option = choice?.options.find((o) => o.ref?.kind === "ability" && o.ref.instanceId === given.id);
      return option ? [option.optionId] : defaultPick(state);
    };
    const { session } = driveSession(startSession(given.state), deps, [{ type: "changeForm", playerId: P1 }], takePip);
    expect(locateCard(session.state, given.id)).toEqual({ kind: "playArea", playerId: P1 });
  });

  it("'You cannot choose to discard this card from your hand': a chosen discard never offers it", () => {
    const given = inHand(start(), SHOCK);
    const { state } = playFree(given.state, deps, DISCARD_ONE.card.id);
    expect(mustPlayer(state, P1).hand).toContain(given.id);
  });
});

/**
 * An event's own "while in your hand" abilities: "Forced Response: After your turn ends, if this card is in your hand,
 * take 1 damage." beside the Action that plays it. RRG 1.8 "In Play and Out of Play" (p. 23): an ability is used out of
 * play when it "specifically refer[s] to being used from an out-of-play area"; such an ability resolves from the hand
 * and is no play of the event (RRG 1.8 "Event", p. 18).
 */
describe("an event's own in-hand abilities resolve from hand without playing it", () => {
  const you = { kind: "identityOf", player: { kind: "controller" } } as const;
  const BURN = stubAbility("fire.forced", {
    trigger: { kind: "response", forced: true, on: { on: "turnEnding", playerIs: "controller" } },
    activeIn: "hand",
    effects: [{ kind: "dealDamage", target: you, amount: { kind: "const", value: 1 } }],
  } satisfies AbilityDefinition);
  /** Optional, in hand: "Response: After you change form, take 2 damage." */
  const SINGE = stubAbility("fire.optional", {
    trigger: { kind: "response", forced: false, on: { on: "formChanged", playerIs: "controller" } },
    activeIn: "hand",
    effects: [{ kind: "dealDamage", target: you, amount: { kind: "const", value: 2 } }],
  } satisfies AbilityDefinition);
  /** The play: "Action: Take 4 damage." */
  const BLAZE = stubAbility("fire.action", {
    trigger: { kind: "action" },
    effects: [{ kind: "dealDamage", target: you, amount: { kind: "const", value: 4 } }],
  } satisfies AbilityDefinition);
  const FIRE = stubEvent({ id: "fire", cost: 1, abilities: [BURN.ref, SINGE.ref, BLAZE.ref] });
  const fireDeps: EngineDeps = depsOf(BURN, SINGE, BLAZE);
  const endTurn = { type: "endTurn", playerId: P1 } as const;

  /** A first turn with exactly `inHand` copies of the event in hand and the other of its two in the discard pile. */
  const withCopies = (inHand: 0 | 1 | 2): { state: GameState; hand: readonly InstanceId[] } => {
    const base = gameAtFirstTurn({ cards: [FIRE], deps: fireDeps, deck: copiesOf(FIRE.id, 2) });
    const seat = mustPlayer(base, P1);
    const isCopy = (id: InstanceId) => base.instances[id]?.cardId === FIRE.id;
    const copies = [...seat.hand, ...seat.deck, ...seat.discard].filter(isCopy);
    const hand = copies.slice(0, inHand);
    const state: GameState = {
      ...base,
      players: base.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: [...p.hand.filter((id) => !isCopy(id)), ...hand],
              deck: p.deck.filter((id) => !isCopy(id)),
              discard: [...p.discard.filter((id) => !isCopy(id)), ...copies.slice(inHand)],
            }
          : p,
      ),
    };
    return { state, hand };
  };
  const identity = (state: GameState) => mustPlayer(state, P1).identity.instanceId;
  const drive = (state: GameState, commands: Parameters<typeof driveSession>[2], pick = defaultPick) =>
    driveSession(startSession(state), fireDeps, commands, pick);
  /** The damage each card dealt to the identity, by source. */
  const dealtBy = (events: ReturnType<typeof drive>["events"], state: GameState, source: InstanceId) =>
    events
      .filter(
        (e) => e.type === "damageDealt" && e.targetInstanceId === identity(state) && e.sourceInstanceId === source,
      )
      .map((e) => (e.type === "damageDealt" ? e.amount : 0));

  it("the forced response in hand resolves at the end of its player's turn: 1 damage, the event unplayed and still in hand", () => {
    const { state, hand } = withCopies(1);
    const [id] = hand as [InstanceId];
    const { session, events } = drive(state, [endTurn]);
    expect(dealtBy(events, state, id)).toEqual([1]);
    expect(mustPlayer(session.state, P1).hand).toContain(id);
    expect(events.filter((e) => e.type === "cardPlayed" && e.instanceId === id)).toEqual([]);
    const replayed = replay(session.log, fireDeps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("two copies in hand: 1 damage from each", () => {
    const { state, hand } = withCopies(2);
    const { events } = drive(state, [endTurn]);
    expect(hand.map((id) => dealtBy(events, state, id))).toEqual([[1], [1]]);
  });

  it("not in hand (both copies in the discard pile): nothing", () => {
    const { state } = withCopies(0);
    const { events } = drive(state, [endTurn]);
    expect(events.filter((e) => e.type === "damageDealt" && e.targetInstanceId === identity(state))).toEqual([]);
  });

  it("an optional in-hand response on an event is used from hand at no cost: 2 damage, the event not played", () => {
    const { state, hand } = withCopies(1);
    const [id] = hand as [InstanceId];
    const take = (s: GameState): readonly string[] => {
      const option = s.pendingChoice?.options.find((o) => o.ref?.kind === "ability" && o.ref.instanceId === id);
      return option ? [option.optionId] : defaultPick(s);
    };
    const { session, events } = drive(state, [{ type: "changeForm", playerId: P1 }], take);
    expect(dealtBy(events, state, id)).toEqual([2]);
    expect(events.filter((e) => e.type === "cardPlayed")).toEqual([]);
    // Nothing was paid: the hand and the discard pile are as they were.
    expect(mustPlayer(session.state, P1).hand).toEqual(mustPlayer(state, P1).hand);
    expect(mustPlayer(session.state, P1).discard).toEqual(mustPlayer(state, P1).discard);
  });

  it("playing the event resolves its Action only: 4 damage, into the discard pile, and no in-hand ability is a play", () => {
    const { state, hand } = withCopies(1);
    const [id] = hand as [InstanceId];
    const seat = mustPlayer(state, P1);
    const payment = seat.hand.filter((card) => card !== id).slice(0, 1);
    const { session, events } = drive(state, [
      {
        type: "playCard",
        playerId: P1,
        cardInstanceId: id,
        payment: payment.map((fromHand) => ({ fromHand })),
        attachToInstanceId: null,
      },
    ]);
    expect(dealtBy(events, state, id)).toEqual([4]);
    expect(mustPlayer(session.state, P1).discard).toContain(id);
  });
});
