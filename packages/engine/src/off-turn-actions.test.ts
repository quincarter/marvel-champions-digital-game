/**
 * Action abilities during another player's turn (owner ruling 2026-10-05, docs/phase7-wave7.md §4.1). RRG 1.8 "Action"
 * (p. 6): "Players are permitted to trigger action abilities during their turn, or by request during other players'
 * turns." "Player Turn" (pp. 34–35): "(Another player may offer to use an action during the active player's turn, as
 * well.)" The command is the offer; the engine asks nobody. Everything that is not an Action ability stays the active
 * player's alone.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions, type ActionRef } from "./legal.js";
import { mainSchemeStates, mustInstance, mustPlayer, undefeatedVillains } from "./query.js";
import type { PlayerRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubSupport } from "./testing/fixtures.js";
import { ALLY, defaultPick, giveCard, payFor, RESOURCE, TREACHERY, UPGRADE } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const you: PlayerRef = { kind: "controller" };
const markYou = (counterType: string) =>
  ({ kind: "addCounters", target: { kind: "identityOf", player: you }, counterType, amount: one }) as const;

/** "Action: Spend 1 resource → draw 1 card. (Limit once per round.)" */
const GADGET_ACTION = stubAbility("gadget.action", {
  trigger: { kind: "action" },
  cost: { resources: 1 },
  limit: { count: 1, period: "round" },
  effects: [{ kind: "draw", player: you, amount: one }],
});
const GADGET = stubSupport({ id: "gadget", cost: 0, abilities: [GADGET_ACTION.ref] });

/** "Hero Action: Place a suit counter on your identity." */
const SUIT_ACTION = stubAbility("suit.action", {
  trigger: { kind: "action", form: "hero" },
  effects: [markYou("suit")],
});
const SUIT = stubSupport({ id: "suit", cost: 0, abilities: [SUIT_ACTION.ref] });

/** "Action: Choose one: …" — an ability that stops on a choice, to hold something on the stack. */
const PONDER_ACTION = stubAbility("ponder.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "chooseOne",
      chooser: you,
      options: [
        { label: "Left", effects: [markYou("left")] },
        { label: "Right", effects: [markYou("right")] },
      ],
    },
  ],
});
const PONDER = stubSupport({ id: "ponder", cost: 0, abilities: [PONDER_ACTION.ref] });

/** An event whose play is its Action: cost 1, "Action: Place a burst counter on your identity." */
const BURST_ACTION = stubAbility("burst.action", { trigger: { kind: "action" }, effects: [markYou("burst")] });
const BURST = stubEvent({ id: "burst", cost: 1, abilities: [BURST_ACTION.ref] });

/** An event played only from its response window: never an Action. */
const REPLY_RESPONSE = stubAbility("reply.response", {
  trigger: { kind: "response", forced: false, on: { on: "defended" } },
  effects: [markYou("reply")],
});
const REPLY = stubEvent({ id: "reply", cost: 0, abilities: [REPLY_RESPONSE.ref] });

/** An encounter environment's Action, with nobody named: any player may trigger an action on an encounter card. */
const RELAY_ACTION = stubAbility("relay.action", { trigger: { kind: "action" }, effects: [markYou("relay")] });
const RELAY = stubEnvironment({ id: "relay", abilities: [RELAY_ACTION.ref] });
/** "Action: … (Limit once per round per player.) Any player can do this." */
const BEACON_ACTION = stubAbility("beacon.action", {
  trigger: { kind: "action", triggerableBy: { kind: "each" } },
  limit: { count: 1, period: "round", per: "player" },
  effects: [markYou("beacon")],
});
const BEACON = stubEnvironment({ id: "beacon", abilities: [BEACON_ACTION.ref] });

const deps: EngineDeps = depsOf(
  GADGET_ACTION,
  SUIT_ACTION,
  PONDER_ACTION,
  BURST_ACTION,
  REPLY_RESPONSE,
  RELAY_ACTION,
  BEACON_ACTION,
);

const endTurn = (playerId: PlayerId): Command => ({ type: "endTurn", playerId });
const changeForm = (playerId: PlayerId): Command => ({ type: "changeForm", playerId });
const use = (
  playerId: PlayerId,
  cardInstanceId: InstanceId,
  ability: StubAbility,
  payment: readonly Payment[] = [],
): Command => ({ type: "useAbility", playerId, cardInstanceId, abilityId: ability.ref.id, payment });

/** Two seats at p1's first turn, both in alter-ego form. */
const start = (): GameState =>
  gameAtFirstTurn({
    deps,
    players: 2,
    cards: [GADGET, SUIT, PONDER, BURST, REPLY, RELAY, BEACON],
    encounter: [RELAY.id, BEACON.id, ...copiesOf(TREACHERY.id, 30)],
    deck: [GADGET.id, SUIT.id, PONDER.id, BURST.id, REPLY.id],
  });

const counters = (state: GameState, player: PlayerId): Readonly<Record<string, number>> =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).counters;
const handSize = (state: GameState, player: PlayerId): number => mustPlayer(state, player).hand.length;
const activePlayer = (state: GameState): PlayerId | null =>
  state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : null;

function refusal(state: GameState, command: Command): { readonly code: string; readonly message: string } | "ok" {
  const result = applyCommand(state, command, deps);
  return result.ok ? "ok" : { code: result.error.code, message: result.error.message };
}
const refusalCode = (state: GameState, command: Command): string => {
  const refused = refusal(state, command);
  return refused === "ok" ? "ok" : refused.code;
};

function expectReplays(session: ReturnType<typeof driveSession>["session"]): void {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("an Action on a card in play, during another player's turn", () => {
  it("resolves for the acting player, with their cost and their limit, and it stays the active player's turn", () => {
    const placed = playerCardIntoPlay(start(), GADGET.id, P2);
    const state = giveCard(placed.state, P2, RESOURCE.id).state;
    expect(activePlayer(state)).toBe(P1);
    const payment = payFor(state, P2, 1);
    const hands = [handSize(state, P1), handSize(state, P2)];
    const used = driveSession(startSession(state), deps, [use(P2, placed.id, GADGET_ACTION, payment)]);
    const after = used.session.state;
    // p2 spent one card from their own hand and drew one; p1's hand is untouched.
    expect([handSize(after, P1), handSize(after, P2)]).toEqual([hands[0], hands[1]! - 1 + 1]);
    expect(mustPlayer(after, P2).discard).toHaveLength(1);
    expect(mustPlayer(after, P1).discard).toHaveLength(0);
    expect(used.events).toContainEqual(
      expect.objectContaining({ type: "abilityResolved", instanceId: placed.id, controllerId: P2 }),
    );
    expect(activePlayer(after)).toBe(P1);
    expect(after.stack).toHaveLength(0);
    // "(Limit once per round.)" is the card's, spent by p2's use.
    const again = giveCard(after, P2, RESOURCE.id).state;
    expect(refusalCode(again, use(P2, placed.id, GADGET_ACTION, payFor(again, P2, 1)))).toBe("limit_reached");
    // The active player can still take their own turn afterwards.
    expect(refusalCode(after, endTurn(P1))).toBe("ok");
    expectReplays(used.session);
  });

  it("is paid from the acting player's hand only, and only on a card they control", () => {
    const placed = playerCardIntoPlay(start(), GADGET.id, P2);
    const given = giveCard(placed.state, P1, RESOURCE.id);
    // p2 cannot pay with a card in p1's hand.
    expect(refusal(given.state, use(P2, placed.id, GADGET_ACTION, [{ fromHand: given.id }]))).toEqual({
      code: "card_not_in_zone",
      message: `payment card ${given.id} is not in hand`,
    });
    expect(refusalCode(given.state, use(P2, placed.id, GADGET_ACTION, []))).toBe("insufficient_resources");
    // p1, on their own turn, still cannot use p2's card ("cards they control", RRG 1.8 "Action", p. 6).
    expect(refusal(given.state, use(P1, placed.id, GADGET_ACTION, [{ fromHand: given.id }]))).toEqual({
      code: "no_valid_target",
      message: "you do not control that card",
    });
  });

  it("reads the acting player's form for a Hero Action, not the active player's", () => {
    const placed = playerCardIntoPlay(start(), SUIT.id, P2);
    // Both in alter-ego form: refused by p2's own form.
    expect(refusalCode(placed.state, use(P2, placed.id, SUIT_ACTION))).toBe("wrong_form");
    // p1 a hero, p2 still an alter-ego: still refused.
    const p1Hero = driveSession(startSession(placed.state), deps, [changeForm(P1)]).session.state;
    expect(mustPlayer(p1Hero, P1).identity.form).toBe("hero");
    expect(refusalCode(p1Hero, use(P2, placed.id, SUIT_ACTION))).toBe("wrong_form");
    // Round 2 (p2 is first player and passes): p2 a hero, p1 an alter-ego, on p1's turn. Allowed, and the counter is
    // on p2's identity.
    const round2 = driveSession(startSession(placed.state), deps, [
      endTurn(P1),
      changeForm(P2),
      endTurn(P2),
      endTurn(P2),
    ]).session;
    expect(round2.state.round).toBe(2);
    expect(activePlayer(round2.state)).toBe(P1);
    expect(mustPlayer(round2.state, P1).identity.form).toBe("alterEgo");
    expect(mustPlayer(round2.state, P2).identity.form).toBe("hero");
    const used = driveSession(round2, deps, [use(P2, placed.id, SUIT_ACTION)]).session;
    expect(counters(used.state, P2).suit).toBe(1);
    expect(counters(used.state, P1).suit).toBeUndefined();
    expectReplays(used);
  });
});

describe("an Action event from hand, during another player's turn", () => {
  it("is played and paid from the acting player's hand", () => {
    const given = giveCard(giveCard(start(), P2, RESOURCE.id).state, P2, BURST.id);
    const state = given.state;
    const payment = payFor(state, P2, 1);
    const hands = [handSize(state, P1), handSize(state, P2)];
    const played = driveSession(startSession(state), deps, [
      { type: "playCard", playerId: P2, cardInstanceId: given.id, payment, attachToInstanceId: null },
    ]);
    const after = played.session.state;
    expect([handSize(after, P1), handSize(after, P2)]).toEqual([hands[0], hands[1]! - 2]);
    expect(mustPlayer(after, P2).discard).toContain(given.id);
    expect(mustPlayer(after, P2).discard).toHaveLength(2);
    expect(counters(after, P2).burst).toBe(1);
    expect(counters(after, P1).burst).toBeUndefined();
    expect(activePlayer(after)).toBe(P1);
    expectReplays(played.session);
  });

  it("cannot be another player's card, and an event that is not an Action stays out", () => {
    const burst = giveCard(start(), P1, BURST.id);
    const reply = giveCard(burst.state, P2, REPLY.id);
    const play = (playerId: PlayerId, cardInstanceId: InstanceId): Command => ({
      type: "playCard",
      playerId,
      cardInstanceId,
      payment: [],
      attachToInstanceId: null,
    });
    // p2 cannot play the Action event in p1's hand.
    expect(refusalCode(reply.state, play(P2, burst.id))).toBe("card_not_in_zone");
    // A response event is played from its window, never as an Action: not on another player's turn.
    expect(refusalCode(reply.state, play(P2, reply.id))).toBe("not_active_player");
  });
});

describe("what is still the active player's alone", () => {
  it("refuses each basic power, a form change, playing an ally, support or upgrade, and ending the turn", () => {
    // p2 in hero form with an ally in play, on p1's turn of round 2, so nothing but the turn stands in the way.
    const ally = playerCardIntoPlay(start(), ALLY.id, P2);
    const round2 = driveSession(startSession(ally.state), deps, [endTurn(P1), changeForm(P2), endTurn(P2), endTurn(P2)])
      .session.state;
    expect(activePlayer(round2)).toBe(P1);
    expect(mustPlayer(round2, P2).identity.form).toBe("hero");
    expect(mustInstance(round2, ally.id).exhausted).toBe(false);
    const hero = mustPlayer(round2, P2).identity.instanceId;
    const villain = undefeatedVillains(round2)[0]!.instanceId;
    const scheme = mainSchemeStates(round2)[0]!.instanceId;
    let state = round2;
    const inHand = (card: string): InstanceId => {
      const given = giveCard(state, P2, card, [ally.id]);
      state = given.state;
      return given.id;
    };
    const play = (cardInstanceId: InstanceId): Command => ({
      type: "playCard",
      playerId: P2,
      cardInstanceId,
      payment: [],
      attachToInstanceId: null,
    });
    const commands: Record<string, Command> = {
      heroAttack: { type: "basicAttack", playerId: P2, attackerInstanceId: hero, targetInstanceId: villain },
      heroThwart: { type: "basicThwart", playerId: P2, thwarterInstanceId: hero, schemeInstanceId: scheme },
      allyAttack: { type: "basicAttack", playerId: P2, attackerInstanceId: ally.id, targetInstanceId: villain },
      allyThwart: { type: "basicThwart", playerId: P2, thwarterInstanceId: ally.id, schemeInstanceId: scheme },
      recover: { type: "basicRecover", playerId: P2 },
      changeForm: changeForm(P2),
      playAlly: play(inHand(ALLY.id)),
      playSupport: play(inHand(GADGET.id)),
      playUpgrade: play(inHand(UPGRADE.id)),
      playResource: play(inHand(RESOURCE.id)),
      endTurn: endTurn(P2),
    };
    const codes = Object.fromEntries(Object.entries(commands).map(([name, c]) => [name, refusalCode(state, c)]));
    expect(codes).toEqual(Object.fromEntries(Object.keys(commands).map((name) => [name, "not_active_player"])));
    expect(refusal(state, endTurn(P2))).toEqual({ code: "not_active_player", message: "it is p1's turn" });
  });

  it("refuses a player who is out of the game", () => {
    const placed = playerCardIntoPlay(start(), GADGET.id, P2);
    const out: GameState = {
      ...placed.state,
      players: placed.state.players.map((p) => (p.playerId === P2 ? { ...p, eliminated: true } : p)),
    };
    expect(refusal(out, use(P2, placed.id, GADGET_ACTION))).toEqual({
      code: "not_active_player",
      message: "p2 is out of the game",
    });
    expect(legalActions(out, P2, deps)).toEqual({ kind: "notYourTurn", activePlayerId: P1, legal: [], illegal: [] });
  });
});

describe("only when an Action could be taken at all", () => {
  it("accepts nothing while a choice is pending or anything is on the stack, and nothing outside a player's turn", () => {
    const ponder = playerCardIntoPlay(start(), PONDER.id, P1);
    const gadget = playerCardIntoPlay(ponder.state, GADGET.id, P2);
    const resource = giveCard(gadget.state, P2, RESOURCE.id);
    const burst = giveCard(resource.state, P2, BURST.id, [resource.id]);
    const payment = [{ fromHand: resource.id }] as const;
    const useGadget = use(P2, gadget.id, GADGET_ACTION, payment);
    const playBurst: Command = {
      type: "playCard",
      playerId: P2,
      cardInstanceId: burst.id,
      payment,
      attachToInstanceId: null,
    };
    expect(refusalCode(burst.state, useGadget)).toBe("ok");
    expect(refusalCode(burst.state, playBurst)).toBe("ok");

    // p1's ability stops on its choice: it is on the stack and the choice is p1's.
    const choosing = applyCommand(burst.state, use(P1, ponder.id, PONDER_ACTION), deps);
    if (!choosing.ok) throw new Error(choosing.error.message);
    expect(choosing.state.pendingChoice?.playerId).toBe(P1);
    expect(choosing.state.stack.length).toBeGreaterThan(0);
    expect(refusalCode(choosing.state, useGadget)).toBe("choice_pending");
    expect(refusalCode(choosing.state, playBurst)).toBe("choice_pending");
    expect(legalActions(choosing.state, P2, deps).kind).toBe("choice");

    // The same stack with no choice open (surgery): still nothing for the other player.
    const resolving: GameState = { ...choosing.state, pendingChoice: null };
    const busy = { code: "wrong_phase", message: "an Action cannot be taken while something is resolving" };
    expect(refusal(resolving, useGadget)).toEqual(busy);
    expect(refusal(resolving, playBurst)).toEqual(busy);
    const listed = legalActions(resolving, P2, deps);
    expect(listed.kind === "notYourTurn" && listed.legal).toEqual([]);

    // The villain phase (stopped at its first choice, then with that choice lifted by surgery): not a player's turn.
    let villainPhase = burst.state;
    for (const command of [changeForm(P1), endTurn(P1), endTurn(P2)]) {
      const applied = applyCommand(villainPhase, command, deps);
      if (!applied.ok) throw new Error(applied.error.message);
      villainPhase = applied.state;
    }
    for (let choice = villainPhase.pendingChoice; choice && villainPhase.step.phase === "player";) {
      const applied = applyCommand(
        villainPhase,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: defaultPick(villainPhase),
        },
        deps,
      );
      if (!applied.ok) throw new Error(applied.error.message);
      villainPhase = applied.state;
      choice = villainPhase.pendingChoice;
    }
    expect(villainPhase.step.phase).toBe("villain");
    expect(villainPhase.pendingChoice).not.toBeNull();
    expect(refusalCode(villainPhase, useGadget)).toBe("choice_pending");
    expect(refusalCode({ ...villainPhase, pendingChoice: null }, useGadget)).toBe("wrong_phase");
    expect(refusalCode({ ...villainPhase, pendingChoice: null }, playBurst)).toBe("wrong_phase");
    expect(legalActions({ ...villainPhase, pendingChoice: null }, P2, deps)).toEqual({
      kind: "notYourTurn",
      activePlayerId: null,
      legal: [],
      illegal: [],
    });
  });
});

describe("an encounter card's Action", () => {
  it("works for either seat during p1's turn, each as 'you'", () => {
    const relay = encounterCardInVillainArea(start(), RELAY.id);
    const beacon = encounterCardInVillainArea(relay.state, BEACON.id);
    const run = driveSession(startSession(beacon.state), deps, [
      use(P2, relay.id, RELAY_ACTION),
      use(P1, relay.id, RELAY_ACTION),
      use(P2, beacon.id, BEACON_ACTION),
      use(P1, beacon.id, BEACON_ACTION),
    ]);
    const after = run.session.state;
    expect(activePlayer(after)).toBe(P1);
    expect(counters(after, P1)).toEqual({ relay: 1, beacon: 1 });
    expect(counters(after, P2)).toEqual({ relay: 1, beacon: 1 });
    // "(Limit once per round per player.)": each seat has spent its own.
    expect(refusalCode(after, use(P2, beacon.id, BEACON_ACTION))).toBe("limit_reached");
    expect(refusalCode(after, use(P1, beacon.id, BEACON_ACTION))).toBe("limit_reached");
    expectReplays(run.session);
  });
});

describe("legalActions for each seat", () => {
  const refOf = (action: ActionRef): string =>
    action.kind === "useAbility"
      ? `useAbility:${action.instanceId}:${action.abilityId}`
      : "instanceId" in action
        ? `${action.kind}:${action.instanceId}`
        : action.kind;

  it("lists a non-active player's Actions and nothing else; the active player's list is their whole turn", () => {
    const relay = encounterCardInVillainArea(start(), RELAY.id);
    const gadget = playerCardIntoPlay(relay.state, GADGET.id, P2);
    const suit = playerCardIntoPlay(gadget.state, SUIT.id, P2);
    const ally = playerCardIntoPlay(suit.state, ALLY.id, P2);
    // p2's hand: one resource, the Action event, a response event and an upgrade.
    const resource = giveCard(ally.state, P2, RESOURCE.id);
    const burst = giveCard(resource.state, P2, BURST.id);
    const reply = giveCard(burst.state, P2, REPLY.id);
    const upgrade = giveCard(reply.state, P2, UPGRADE.id);
    const hand = [resource.id, burst.id, reply.id, upgrade.id];
    const state: GameState = {
      ...upgrade.state,
      players: upgrade.state.players.map((p) =>
        p.playerId === P2 ? { ...p, hand, deck: [...p.hand.filter((id) => !hand.includes(id)), ...p.deck] } : p,
      ),
    };

    const offTurn = legalActions(state, P2, deps);
    if (offTurn.kind !== "notYourTurn") throw new Error(`p2 got ${offTurn.kind}`);
    expect(offTurn.activePlayerId).toBe(P1);
    expect(offTurn.legal.map((entry) => refOf(entry.action)).sort()).toEqual(
      [
        `playCard:${burst.id}`,
        `useAbility:${gadget.id}:${GADGET_ACTION.ref.id}`,
        `useAbility:${relay.id}:${RELAY_ACTION.ref.id}`,
      ].sort(),
    );
    // The Hero Action is listed with the acting player's reason; nothing that is not an Action is listed at all.
    expect(offTurn.illegal.map((entry) => [refOf(entry.action), entry.reason])).toEqual([
      [`useAbility:${suit.id}:${SUIT_ACTION.ref.id}`, "wrong_form"],
    ]);
    // Every listed example is a command the engine accepts from p2 right now, paid from p2's hand.
    for (const entry of offTurn.legal) {
      expect(entry.example.playerId).toBe(P2);
      expect(refusalCode(state, entry.example)).toBe("ok");
    }
    const burstEntry = offTurn.legal.find((entry) => entry.action.kind === "playCard");
    expect(burstEntry?.example).toEqual({
      type: "playCard",
      playerId: P2,
      cardInstanceId: burst.id,
      payment: [{ fromHand: resource.id }],
      attachToInstanceId: null,
    });

    // p1, whose turn it is: the full turn, the encounter card's Action included, and nothing on p2's cards.
    const ownTurn = legalActions(state, P1, deps);
    if (ownTurn.kind !== "turn") throw new Error(`p1 got ${ownTurn.kind}`);
    const p1Refs = [...ownTurn.legal, ...ownTurn.illegal].map((entry) => refOf(entry.action));
    const p1Hero = mustPlayer(state, P1).identity.instanceId;
    expect([...p1Refs].sort()).toEqual(
      [
        ...mustPlayer(state, P1).hand.map((id) => `playCard:${id}`),
        `useAbility:${relay.id}:${RELAY_ACTION.ref.id}`,
        `basicAttack:${p1Hero}`,
        `basicThwart:${p1Hero}`,
        "basicRecover",
        "changeForm",
        "endTurn",
      ].sort(),
    );
    expect(ownTurn.legal.map((entry) => entry.action.kind)).toContain("endTurn");

    // On p2's own turn the same Actions are offered, now among everything else a turn allows.
    const p2Turn = driveSession(startSession(state), deps, [endTurn(P1)]).session.state;
    const own = legalActions(p2Turn, P2, deps);
    if (own.kind !== "turn") throw new Error(`p2 got ${own.kind}`);
    const ownRefs = own.legal.map((entry) => refOf(entry.action));
    for (const entry of offTurn.legal) expect(ownRefs).toContain(refOf(entry.action));
    expect(ownRefs).toContain("endTurn");
    expect(ownRefs).toContain("changeForm");
    // …and p1 now has the encounter card's Action, and any Action event in their hand, alone.
    const p1Waiting = legalActions(p2Turn, P1, deps);
    if (p1Waiting.kind !== "notYourTurn") throw new Error(`p1 got ${p1Waiting.kind}`);
    expect(p1Waiting.activePlayerId).toBe(P2);
    const p1Bursts = mustPlayer(p2Turn, P1).hand.filter((id) => mustInstance(p2Turn, id).cardId === BURST.id);
    expect([...p1Waiting.legal, ...p1Waiting.illegal].map((entry) => refOf(entry.action)).sort()).toEqual(
      [...p1Bursts.map((id) => `playCard:${id}`), `useAbility:${relay.id}:${RELAY_ACTION.ref.id}`].sort(),
    );
  });
});
