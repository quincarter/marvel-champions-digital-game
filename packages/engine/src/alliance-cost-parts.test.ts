/**
 * The owner's answer 48B (2026-10-13, docs/phase7-wave10.md §4.0): a helper may also pay an eligible non-resource part
 * of an alliance card's costs. `CostSelection.paidBy` (built for `RuleSpec costsPayableByAnyPlayer`, hero-packs H3.19,
 * tested in `costs-payable-by-any-player.test.ts`) works the same way for an alliance card being played
 * (`costPartsPayableByAnyPlayer`, `actions.ts`): the same delegable parts, the same exclusions, a part paid whole by
 * one player (answer 47A).
 *
 * Sources: RRG 1.8 "Alliance" (p. 6): "When a player declares their intention to play a card with the alliance
 * keyword, any player(s) may help pay the costs for that card", read as "While paying costs for this card, any player
 * may contribute to paying those costs"; "Cost" (pp. 13-14): a cost is paid in full or not at all, with what its player
 * controls unless a card says otherwise.
 *
 * Synthetic cards only: no alliance card in the pool prints a delegable part (they print resource costs and "exhaust
 * an X character and a Y character").
 */

import type { CardId, PlayerCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, AbilityDefinition } from "./abilities.js";
import type { Command, CostSelection, Payment } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { costHelpFor, legalActions, tryPayment, type ActionRef, type LegalAction } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubResource, stubSupport } from "./testing/fixtures.js";
import { giveCards } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const draw = { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } } as const;
/** "Action: [cost] → draw 1 card." */
const action = (id: string, cost: AbilityCost): StubAbility =>
  stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, cost, effects: [draw] }));
const ALLIANCE = [{ name: "alliance" }] as const;

/** "Alliance. Action: Take 2 damage → draw 1 card." Cost 1. */
const PACT_ACTION = action("pact", { damageSelf: 2 });
const PACT: PlayerCard = { ...stubEvent({ id: "pact", cost: 1, abilities: [PACT_ACTION.ref] }), keywords: ALLIANCE };
/** The same card without the keyword. */
const LONER = stubEvent({ id: "loner", cost: 1, abilities: [PACT_ACTION.ref] });
/** "Alliance. Action: Discard the top 2 cards of your deck → draw 1 card." Cost 0. */
const DIG_ACTION = action("dig", { discardFromDeck: 2 });
const DIG: PlayerCard = { ...stubEvent({ id: "dig", cost: 0, abilities: [DIG_ACTION.ref] }), keywords: ALLIANCE };
/** "Alliance. Action: Exhaust your identity and take 1 damage → draw 1 card." Cost 0. */
const OATH_ACTION = action("oath", { exhaustIdentity: true, damageSelf: 1 });
const OATH: PlayerCard = { ...stubEvent({ id: "oath", cost: 0, abilities: [OATH_ACTION.ref] }), keywords: ALLIANCE };
/** An alliance card in play with an ability of its own: "Action: Take 1 damage → draw 1 card." */
const HALL_ACTION = action("hall", { damageSelf: 1 });
const HALL: PlayerCard = { ...stubSupport({ id: "hall", cost: 0, abilities: [HALL_ACTION.ref] }), keywords: ALLIANCE };
const PLAIN = stubResource({ id: "plain", icons: 1 });

const CARDS = [PACT, LONER, DIG, OATH, HALL, PLAIN];
const deps = depsOf(PACT_ACTION, DIG_ACTION, OATH_ACTION, HALL_ACTION);
const DECK: readonly CardId[] = CARDS.flatMap((card) => [card.id, card.id, card.id]);

const start = (players: 1 | 2 = 2): GameState => gameAtFirstTurn({ cards: CARDS, deps, players, deck: DECK });

const fromHand = (...ids: readonly InstanceId[]): readonly Payment[] => ids.map((id) => ({ fromHand: id }));
const play = (
  card: InstanceId,
  payment: readonly Payment[] = [],
  costSelection?: CostSelection,
): Command & { readonly type: "playCard" } => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment,
  attachToInstanceId: null,
  ...(costSelection ? { costSelection } : {}),
});
const refusal = (state: GameState, command: Command) => {
  const result = applyCommand(state, command, deps);
  return result.ok ? null : { code: result.error.code, message: result.error.message };
};
const identityOf = (state: GameState, player: PlayerId) =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId);
const handSize = (state: GameState, player: PlayerId) => mustPlayer(state, player).hand.length;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type);
const playRef = (card: InstanceId): ActionRef => ({ kind: "playCard", instanceId: card });
function listed(state: GameState, card: InstanceId): LegalAction | undefined {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`no actions: ${actions.kind}`);
  return actions.legal.find((entry) => entry.action.kind === "playCard" && entry.action.instanceId === card);
}
const NOT_OPEN = { code: "no_valid_target", message: "only the player using this ability can pay its costs" };

describe("48B an alliance card being played: a helper pays a whole non-resource part of its costs", () => {
  it("'take 2 damage': the helper named in paidBy takes it, the user takes none and resolves the card; the log says who paid", () => {
    const given = giveCards(start(), P1, PACT.id, PLAIN.id);
    const [pact, plain] = given.ids as [InstanceId, InstanceId];
    const command = play(pact, fromHand(plain), { paidBy: { damageSelf: P2 } });
    const { state, events, session } = runCommands(given.state, deps, command);
    expect(identityOf(state, P2).damage).toBe(2);
    expect(identityOf(state, P1).damage).toBe(0);
    // The event and its payer left P1's hand; P1 drew 1.
    expect(handSize(state, P1)).toBe(handSize(given.state, P1) - 2 + 1);
    expect(mustPlayer(state, P1).discard).toEqual(expect.arrayContaining([pact, plain]));
    expect(ofType(events, "costPartPaidBy")).toEqual([
      { type: "costPartPaidBy", playerId: P1, helperId: P2, sourceInstanceId: pact, part: "damageSelf" },
    ]);
    const replayed = replay(session.log, deps);
    expect(replayed.ok ? replayed.state : null).toEqual(state);
  });

  it("one helper may pay the resource cost and the damage both: their card is spent and their identity takes it", () => {
    const mine = giveCards(start(), P1, PACT.id);
    const theirs = giveCards(mine.state, P2, PLAIN.id);
    const [pact] = mine.ids as [InstanceId];
    const [plain] = theirs.ids as [InstanceId];
    const { state } = runCommands(theirs.state, deps, play(pact, fromHand(plain), { paidBy: { damageSelf: P2 } }));
    expect(mustPlayer(state, P2).discard).toContain(plain);
    expect(identityOf(state, P2).damage).toBe(2);
    expect(identityOf(state, P1).damage).toBe(0);
  });

  it("with nobody named, or the user named, the user takes the damage and nothing is logged as help", () => {
    const given = giveCards(start(), P1, PACT.id, PLAIN.id);
    const [pact, plain] = given.ids as [InstanceId, InstanceId];
    for (const costSelection of [undefined, { paidBy: { damageSelf: P1 } }]) {
      const { state, events } = runCommands(given.state, deps, play(pact, fromHand(plain), costSelection));
      expect(identityOf(state, P1).damage).toBe(2);
      expect(identityOf(state, P2).damage).toBe(0);
      expect(ofType(events, "costPartPaidBy")).toEqual([]);
    }
  });

  it("'discard the top 2 cards of your deck': the helper's deck is discarded from, the user's is not", () => {
    const given = giveCards(start(), P1, DIG.id);
    const [dig] = given.ids as [InstanceId];
    const top = mustPlayer(given.state, P2).deck.slice(0, 2);
    const mine = mustPlayer(given.state, P1).deck;
    const { state } = runCommands(given.state, deps, play(dig, [], { paidBy: { discardFromDeck: P2 } }));
    expect(mustPlayer(state, P2).discard).toEqual(expect.arrayContaining([...top]));
    expect(mustPlayer(state, P2).deck).toHaveLength(mustPlayer(given.state, P2).deck.length - 2);
    // P1's deck lost only the card the effect drew.
    expect(mustPlayer(state, P1).deck).toEqual(mine.slice(1));
  });
});

describe("48B the same exclusions as under the 'any player may help pay' rule", () => {
  it("a card without alliance: paidBy is refused, and the user still pays it alone", () => {
    const given = giveCards(start(), P1, LONER.id, PLAIN.id);
    const [loner, plain] = given.ids as [InstanceId, InstanceId];
    expect(refusal(given.state, play(loner, fromHand(plain), { paidBy: { damageSelf: P2 } }))).toEqual(NOT_OPEN);
    const { state } = runCommands(given.state, deps, play(loner, fromHand(plain)));
    expect(identityOf(state, P1).damage).toBe(2);
  });

  it("a part naming the user's own identity stays with the user: 'exhaust your identity' cannot be handed over, the damage beside it can", () => {
    const given = giveCards(start(), P1, OATH.id);
    const [oath] = given.ids as [InstanceId];
    const own = { exhaustIdentity: P2 } as unknown as NonNullable<CostSelection["paidBy"]>;
    expect(refusal(given.state, play(oath, [], { paidBy: own }))).toEqual({
      code: "invalid_choice",
      message: "another player cannot pay that part: exhausting your identity is your own cost to pay",
    });
    const { state } = runCommands(given.state, deps, play(oath, [], { paidBy: { damageSelf: P2 } }));
    expect(identityOf(state, P1).exhausted).toBe(true);
    expect(identityOf(state, P2).exhausted).toBe(false);
    expect(identityOf(state, P2).damage).toBe(1);
    expect(identityOf(state, P1).damage).toBe(0);
  });

  it("a part the cost does not hold, and a player not in the game, are refused", () => {
    const given = giveCards(start(), P1, PACT.id, PLAIN.id);
    const [pact, plain] = given.ids as [InstanceId, InstanceId];
    expect(refusal(given.state, play(pact, fromHand(plain), { paidBy: { discardFromDeck: P2 } }))).toMatchObject({
      code: "invalid_choice",
    });
    const nobody = "p9" as PlayerId;
    expect(refusal(given.state, play(pact, fromHand(plain), { paidBy: { damageSelf: nobody } }))).toMatchObject({
      code: "unknown_player",
    });
  });

  it("a part is paid whole by one player, checked against that player: a helper whose deck is too short cannot take the discard", () => {
    const given = giveCards(start(), P1, DIG.id);
    const [dig] = given.ids as [InstanceId];
    // Surgery: P2's deck holds one card (the rest in their discard pile).
    const short: GameState = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P2 ? { ...p, deck: p.deck.slice(0, 1), discard: [...p.discard, ...p.deck.slice(1)] } : p,
      ),
    };
    const answers = costHelpFor(short, P1, playRef(dig), P2, {}, deps);
    expect(answers).toHaveLength(1);
    expect(answers[0]).toMatchObject({ part: "discardFromDeck", ok: false });
    expect(refusal(short, play(dig, [], { paidBy: { discardFromDeck: P2 } }))).not.toBeNull();
    // The user, with a full deck, still pays it.
    expect(refusal(short, play(dig))).toBeNull();
  });

  it("an alliance card already in play: the cost of its own ability is not opened by the keyword", () => {
    const placed = playerCardIntoPlay(start(), HALL.id);
    const command = (costSelection?: CostSelection): Command => ({
      type: "useAbility",
      playerId: P1,
      cardInstanceId: placed.id,
      abilityId: HALL_ACTION.ref.id,
      payment: [],
      ...(costSelection ? { costSelection } : {}),
    });
    expect(refusal(placed.state, command({ paidBy: { damageSelf: P2 } }))).toEqual(NOT_OPEN);
    expect(refusal(placed.state, command())).toBeNull();
    const actions = legalActions(placed.state, P1, deps);
    if (actions.kind !== "turn") throw new Error("expected P1's turn");
    const use = actions.legal.find((a) => a.action.kind === "useAbility" && a.action.instanceId === placed.id);
    expect(use).toBeDefined();
    expect(use?.costHelp).toBeUndefined();
  });
});

describe("48B what the engine tells a client about an alliance play", () => {
  it("legalActions lists who can pay the part, the user first; the example has the user pay it", () => {
    const given = giveCards(start(), P1, PACT.id, PLAIN.id);
    const [pact] = given.ids as [InstanceId];
    const legal = listed(given.state, pact);
    expect(legal?.costHelp).toEqual([{ part: "damageSelf", payers: [P1, P2] }]);
    expect(legal?.example).not.toHaveProperty("costSelection");
  });

  it("a part the user cannot pay: the play is still legal with the helper paying it, and the example names them", () => {
    const given = giveCards(start(), P1, PACT.id, PLAIN.id);
    const [pact] = given.ids as [InstanceId];
    // Surgery: P1's identity cannot take damage as a cost while it holds a tough status card.
    const me = identityOf(given.state, P1);
    const tough: GameState = {
      ...given.state,
      instances: { ...given.state.instances, [me.instanceId]: { ...me, statuses: { ...me.statuses, tough: 1 } } },
    };
    const legal = listed(tough, pact);
    expect(legal?.costHelp).toEqual([{ part: "damageSelf", payers: [P2] }]);
    expect(legal?.example).toMatchObject({ costSelection: { paidBy: { damageSelf: P2 } } });
  });

  it("costHelpFor answers for a play: yes for an alliance card, the engine's refusal for its twin without the keyword", () => {
    const given = giveCards(start(), P1, PACT.id, LONER.id, PLAIN.id);
    const [pact, loner] = given.ids as [InstanceId, InstanceId, InstanceId];
    expect(costHelpFor(given.state, P1, playRef(pact), P2, {}, deps)).toEqual([{ part: "damageSelf", ok: true }]);
    expect(costHelpFor(given.state, P1, playRef(loner), P2, {}, deps)).toEqual([
      { part: "damageSelf", ok: false, reason: NOT_OPEN.code, message: NOT_OPEN.message },
    ]);
    expect(listed(given.state, loner)?.costHelp).toBeUndefined();
  });

  it("tryPayment builds the play with the helper the client names", () => {
    const given = giveCards(start(), P1, PACT.id, PLAIN.id);
    const [pact, plain] = given.ids as [InstanceId, InstanceId];
    const tried = tryPayment(
      given.state,
      P1,
      playRef(pact),
      [`hand:${plain}`],
      { costSelection: { paidBy: { damageSelf: P2 } } },
      deps,
    );
    expect(tried).toMatchObject({ ok: true, command: { costSelection: { paidBy: { damageSelf: P2 } } } });
  });

  it("a solo game: nobody to help, so nothing is listed and the command is as it always was", () => {
    const given = giveCards(start(1), P1, PACT.id, PLAIN.id);
    const [pact] = given.ids as [InstanceId];
    const legal = listed(given.state, pact);
    expect(legal).toBeDefined();
    expect(legal?.costHelp).toBeUndefined();
    expect(legal?.example).not.toHaveProperty("costSelection");
  });
});
