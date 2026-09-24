/**
 * docs/phase7-wave4.md §3.17: the alliance keyword, paying a card's costs as a group. Synthetic cards shaped like As
 * One! / Problem Solvers ("Alliance. Hero Action: Exhaust an [Avenger] character and a [Guardian] character → …") and
 * Cosmic Alliance / Team Investigation (a plain resource cost).
 *
 * Sources: RRG 1.8 "Alliance" (p. 6): "When a player declares their intention to play a card with the alliance keyword,
 * any player(s) may help pay the costs for that card", equivalent to "While paying costs for this card, any player may
 * contribute to paying those costs", and "Only the player playing the card with the alliance keyword is considered to
 * be resolving that card." "Cost" (pp. 13–14): costs are otherwise paid with cards the player controls, and a cost's
 * components are paid simultaneously, so one card cannot pay two of them.
 */

import { trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command, CostChoices, Payment } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubResource, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCards } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const AVENGER = trait("AVENGER");
const GUARDIAN = trait("GUARDIAN");
const draw = (n: number) =>
  ({ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: n } }) as const;

/** "Action: draw 1 card." on a cost-3 event, with and without alliance. */
const DRAW_ACTION = stubAbility("draw.action", def({ trigger: { kind: "action" }, effects: [draw(1)] }));
const GROUP_EVENT = stubEvent({
  id: "group-event",
  cost: 3,
  keywords: [{ name: "alliance" }],
  abilities: [DRAW_ACTION.ref],
});
const SOLO_EVENT = stubEvent({ id: "solo-event", cost: 3, abilities: [DRAW_ACTION.ref] });

/** "Exhaust an [Avenger] character and a [Guardian] character → draw cards equal to their combined ATK." */
const TEAM_ACTION = stubAbility(
  "team.action",
  def({
    trigger: { kind: "action" },
    cost: {
      exhaustCards: [
        { slot: "avenger", query: { categories: ["identity", "ally"], trait: AVENGER }, min: 1, max: 1 },
        { slot: "guardian", query: { categories: ["identity", "ally"], trait: GUARDIAN }, min: 1, max: 1 },
      ],
    },
    effects: [
      {
        kind: "draw",
        player: { kind: "controller" },
        amount: {
          kind: "sum",
          values: [
            { kind: "stat", of: { kind: "slot", slot: "avenger" }, stat: "atk" },
            { kind: "stat", of: { kind: "slot", slot: "guardian" }, stat: "atk" },
          ],
        },
      },
    ],
  }),
);
const TEAM_EVENT = stubEvent({
  id: "team-event",
  cost: 0,
  keywords: [{ name: "alliance" }],
  abilities: [TEAM_ACTION.ref],
});
const SOLO_TEAM_EVENT = stubEvent({ id: "solo-team-event", cost: 0, abilities: [TEAM_ACTION.ref] });
const AVENGER_ALLY = stubAlly({ id: "avenger-ally", traits: [AVENGER], cost: 0, atk: 2, thw: 1, hp: 3 });
const GUARDIAN_ALLY = stubAlly({ id: "guardian-ally", traits: [GUARDIAN], cost: 0, atk: 1, thw: 1, hp: 3 });
const BOTH_ALLY = stubAlly({ id: "both-ally", traits: [AVENGER, GUARDIAN], cost: 0, atk: 1, thw: 1, hp: 3 });

/** "Resource: Exhaust this card → generate a [wild] resource." on a support. */
const GEAR_RESOURCE = stubAbility(
  "gear.resource",
  def({ trigger: { kind: "resource" }, cost: { exhaustSelf: true }, generates: 1, effects: [] }),
);
const GEAR = stubSupport({ id: "gear", cost: 0, abilities: [GEAR_RESOURCE.ref] });

/** "Response: After you spend this card, draw 1 card." — heard by the spender, "you" being the card's owner. */
const SPENT_RESPONSE = stubAbility(
  "spent.response",
  def({
    trigger: {
      kind: "response",
      forced: false,
      on: { on: "resourcesSpent", selfIs: "source", playerIs: "controller" },
    },
    effects: [draw(1)],
  }),
);
const SPENT = stubResource({ id: "spent", icons: 1, abilities: [SPENT_RESPONSE.ref] });
const PLAIN = stubResource({ id: "plain", icons: 1 });

/**
 * Stand Together's shape inside a timing window: "Interrupt: When your turn would end, exhaust an [Avenger] character
 * and a [Guardian] character → draw cards equal to their combined ATK."
 */
const WINDOW_TEAM = stubAbility(
  "window-team.interrupt",
  def({
    trigger: { kind: "interrupt", forced: false, on: { on: "turnEnding", playerIs: "controller" } },
    cost: TEAM_ACTION.definition.cost!,
    effects: TEAM_ACTION.definition.effects,
  }),
);
const WINDOW_EVENT = stubEvent({
  id: "window-event",
  cost: 0,
  keywords: [{ name: "alliance" }],
  abilities: [WINDOW_TEAM.ref],
});

const CARDS = [
  GROUP_EVENT,
  SOLO_EVENT,
  TEAM_EVENT,
  SOLO_TEAM_EVENT,
  WINDOW_EVENT,
  AVENGER_ALLY,
  GUARDIAN_ALLY,
  BOTH_ALLY,
  GEAR,
  SPENT,
  PLAIN,
];
const deps = depsOf(DRAW_ACTION, TEAM_ACTION, WINDOW_TEAM, GEAR_RESOURCE, SPENT_RESPONSE);
const DECK: readonly CardId[] = CARDS.flatMap((card) => [card.id, card.id, card.id]);

function start(): GameState {
  return gameAtFirstTurn({ cards: CARDS, deps, players: 2, deck: DECK });
}
const fromHand = (...ids: readonly InstanceId[]): readonly Payment[] => ids.map((id) => ({ fromHand: id }));
const play = (
  card: InstanceId,
  payment: readonly Payment[],
  costChoices?: CostChoices,
  playerId: PlayerId = P1,
): Command => ({
  type: "playCard",
  playerId,
  cardInstanceId: card,
  payment,
  attachToInstanceId: null,
  ...(costChoices ? { costChoices } : {}),
});
/** Accepts every optional trigger offered; everything else as `defaultPick`. */
const acceptTriggers = (state: GameState): readonly string[] =>
  state.pendingChoice?.prompt.kind === "chooseTriggers"
    ? state.pendingChoice.options.map((o) => o.optionId)
    : defaultPick(state);
function run(state: GameState, ...commands: readonly Command[]) {
  const driven = driveSession(startSession(state), deps, commands, acceptTriggers);
  return { state: driven.session.state, events: driven.events, session: driven.session };
}
/** The hand cards `legalActions` offers P1 to play. */
function playable(state: GameState): readonly InstanceId[] {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`not P1's turn: ${actions.kind}`);
  return actions.legal.flatMap((entry) => (entry.example.type === "playCard" ? [entry.example.cardInstanceId] : []));
}
const handSize = (state: GameState, player: PlayerId) => mustPlayer(state, player).hand.length;

describe("§3.17 Alliance: any player may help pay an alliance card's costs", () => {
  it("pays a resource cost from two players' hands; each card goes to its owner's discard and only the player playing resolves the card", () => {
    const mine = giveCards(start(), P1, GROUP_EVENT.id, PLAIN.id);
    const theirs = giveCards(mine.state, P2, PLAIN.id, PLAIN.id);
    const [event, own] = mine.ids as [InstanceId, InstanceId];
    const [a, b] = theirs.ids as [InstanceId, InstanceId];
    const before = theirs.state;
    const { state } = run(before, play(event, fromHand(own, a, b)));
    expect(mustPlayer(state, P1).discard).toEqual(expect.arrayContaining([own, event]));
    expect(mustPlayer(state, P2).discard).toEqual(expect.arrayContaining([a, b]));
    expect(mustPlayer(state, P2).hand).not.toContain(a);
    // P1 spent 2 cards (event, own) and drew 1; P2 spent 2 and drew none.
    expect(handSize(state, P1)).toBe(handSize(before, P1) - 2 + 1);
    expect(handSize(state, P2)).toBe(handSize(before, P2) - 2);
  });

  it("refuses another player's hand card for a card without alliance", () => {
    const mine = giveCards(start(), P1, SOLO_EVENT.id, PLAIN.id);
    const theirs = giveCards(mine.state, P2, PLAIN.id, PLAIN.id);
    const [event, own] = mine.ids as [InstanceId, InstanceId];
    const result = applyCommand(theirs.state, play(event, fromHand(own, ...theirs.ids)), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("card_not_in_zone");
  });

  it("uses another player's resource ability; that player pays its cost and is the one who generated", () => {
    const mine = giveCards(start(), P1, GROUP_EVENT.id, PLAIN.id, PLAIN.id);
    const gear = playerCardIntoPlay(mine.state, GEAR.id, P2);
    const [event, x, y] = mine.ids as [InstanceId, InstanceId, InstanceId];
    const payment: Payment[] = [
      ...fromHand(x, y),
      { ability: { instanceId: gear.id, abilityId: GEAR_RESOURCE.ref.id } },
    ];
    const { state, events } = run(gear.state, play(event, payment));
    expect(mustInstance(state, gear.id).exhausted).toBe(true);
    const generated = events.find(
      (e): e is Extract<GameEvent, { type: "resourcesGenerated" }> => e.type === "resourcesGenerated",
    );
    expect(generated?.playerId).toBe(P2);

    // The same ability cannot pay for a card without alliance.
    const solo = giveCards(gear.state, P1, SOLO_EVENT.id);
    const refused = applyCommand(
      solo.state,
      play(solo.ids[0]!, [...fromHand(x, y), { ability: { instanceId: gear.id, abilityId: GEAR_RESOURCE.ref.id } }]),
      deps,
    );
    expect(refused.ok ? null : refused.error.code).toBe("no_valid_target");
  });

  it("'Exhaust an [Avenger] character and a [Guardian] character →' may take another player's character", () => {
    const avenger = playerCardIntoPlay(start(), AVENGER_ALLY.id, P1);
    const guardian = playerCardIntoPlay(avenger.state, GUARDIAN_ALLY.id, P2);
    const given = giveCards(guardian.state, P1, TEAM_EVENT.id, SOLO_TEAM_EVENT.id);
    const [team, solo] = given.ids as [InstanceId, InstanceId];
    const choices = { avenger: [avenger.id], guardian: [guardian.id] };

    const { state } = run(given.state, play(team, [], choices));
    expect(mustInstance(state, avenger.id).exhausted).toBe(true);
    expect(mustInstance(state, guardian.id).exhausted).toBe(true);
    // Combined ATK 2 + 1: P1 draws 3 (and spent the event).
    expect(handSize(state, P1)).toBe(handSize(given.state, P1) - 1 + 3);

    // Without alliance, P2's Guardian cannot pay P1's cost.
    const refused = applyCommand(given.state, play(solo, [], choices), deps);
    expect(refused.ok ? null : refused.error.code).toBe("no_valid_target");
  });

  it("one character with both traits cannot pay both parts of the cost", () => {
    const both = playerCardIntoPlay(start(), BOTH_ALLY.id, P1);
    const given = giveCards(both.state, P1, TEAM_EVENT.id);
    const result = applyCommand(
      given.state,
      play(given.ids[0]!, [], { avenger: [both.id], guardian: [both.id] }),
      deps,
    );
    expect(result.ok ? null : result.error.code).toBe("invalid_choice");
  });

  it("legalActions offers an alliance card the table can pay for together, and picks one character per slot", () => {
    const avenger = playerCardIntoPlay(start(), AVENGER_ALLY.id, P1);
    const guardian = playerCardIntoPlay(avenger.state, GUARDIAN_ALLY.id, P2);
    const given = giveCards(guardian.state, P1, TEAM_EVENT.id, SOLO_TEAM_EVENT.id);
    const [team, solo] = given.ids as [InstanceId, InstanceId];
    const offered = playable(given.state);
    expect(offered).toContain(team);
    expect(offered).not.toContain(solo);
  });

  it("the resource cost counts every player's resources: P1 alone cannot afford it, the table can", () => {
    // P1's hand is only the event; P2 holds three resources.
    const base = start();
    const emptied: GameState = {
      ...base,
      players: base.players.map((p) => (p.playerId === P1 ? { ...p, deck: [...p.hand, ...p.deck], hand: [] } : p)),
    };
    const mine = giveCards(emptied, P1, GROUP_EVENT.id, SOLO_EVENT.id);
    const theirs = giveCards(mine.state, P2, PLAIN.id, PLAIN.id, PLAIN.id);
    const [group, solo] = mine.ids as [InstanceId, InstanceId];
    const offered = playable(theirs.state);
    expect(offered).toContain(group);
    expect(offered).not.toContain(solo);
  });

  it("'After you spend this card' is heard by the spender, whose event names the paying player; replay is deep-equal", () => {
    const mine = giveCards(start(), P1, GROUP_EVENT.id, PLAIN.id, PLAIN.id);
    const theirs = giveCards(mine.state, P2, SPENT.id);
    const [event, x, y] = mine.ids as [InstanceId, InstanceId, InstanceId];
    const spent = theirs.ids[0]!;
    const before = theirs.state;
    const { state, events, session } = run(before, play(event, fromHand(x, y, spent)));
    const spentEvents = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "resourcesSpent" ? [e.event] : [],
    );
    expect(spentEvents).toEqual([expect.objectContaining({ playerId: P2, forPlayerId: P1, cardInstanceIds: [spent] })]);
    // P2's response drew P2 a card: P2 lost the spent card and gained one.
    expect(handSize(state, P2)).toBe(handSize(before, P2));
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it("inside a timing window, asks which character pays each unforced pick before playing; a forced pick is not asked", () => {
    const first = playerCardIntoPlay(start(), AVENGER_ALLY.id, P1);
    const second = playerCardIntoPlay(first.state, AVENGER_ALLY.id, P1);
    const guardian = playerCardIntoPlay(second.state, GUARDIAN_ALLY.id, P2);
    const given = giveCards(guardian.state, P1, WINDOW_EVENT.id);
    const asked: string[] = [];
    const pickLast = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseCostCards") {
        asked.push(choice.prompt.slot);
        expect(choice.options.map((o) => o.optionId)).toEqual([first.id, second.id]);
        return [choice.options[choice.options.length - 1]!.optionId];
      }
      return acceptTriggers(state);
    };
    const driven = driveSession(startSession(given.state), deps, [{ type: "endTurn", playerId: P1 }], pickLast);
    const state = driven.session.state;
    expect(asked).toEqual(["avenger"]);
    expect(mustInstance(state, second.id).exhausted).toBe(true);
    expect(mustInstance(state, first.id).exhausted).toBe(false);
    expect(mustInstance(state, guardian.id).exhausted).toBe(true);
    expect(mustPlayer(state, P1).discard).toContain(given.ids[0]);
    const replayed = replay(driven.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it("choosing no card for a pick backs out: the event stays out of the discard pile and nothing is exhausted", () => {
    const first = playerCardIntoPlay(start(), AVENGER_ALLY.id, P1);
    const second = playerCardIntoPlay(first.state, AVENGER_ALLY.id, P1);
    const guardian = playerCardIntoPlay(second.state, GUARDIAN_ALLY.id, P2);
    const given = giveCards(guardian.state, P1, WINDOW_EVENT.id);
    const decline = (state: GameState): readonly string[] =>
      state.pendingChoice?.prompt.kind === "chooseCostCards" ? [] : acceptTriggers(state);
    const driven = driveSession(startSession(given.state), deps, [{ type: "endTurn", playerId: P1 }], decline);
    const state = driven.session.state;
    expect(mustInstance(state, guardian.id).exhausted).toBe(false);
    expect(mustInstance(state, first.id).exhausted).toBe(false);
    expect(mustInstance(state, second.id).exhausted).toBe(false);
    expect(mustPlayer(state, P1).discard).not.toContain(given.ids[0]);
  });
});
