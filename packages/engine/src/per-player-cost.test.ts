/**
 * docs/phase7-wave7.md §3.4: a printed cost with the per player icon (`CostedCard.costPerPlayer`), read through
 * `printedCostOf`. Synthetic cards shaped like Team Investigation ("2[per_hero]" cost, Alliance) and the cards that
 * read a printed cost: a "reduce the cost by 1" constant, Echo's Katana ("discard a card → deal damage equal to its
 * printed cost"), "the highest-cost ally", Make the Call ("pay the printed cost of an ally in a discard pile").
 *
 * Sources: RRG 1.8 "Per Player Icon" (p. 32): "The [per player] icon next to a value multiplies that value by the
 * number of players who started the scenario. If a player is eliminated, this value does not change." Ruling of
 * Aug 3, 2026 (5): "Printed cost scales with player count: In a 2-player game, printed cost is 4, dealing 4 damage
 * with Echo's Katana." RRG 1.8 "Alliance" (p. 6): any player may help pay.
 */

import type { AllyCard, CardId, EventCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { discardCombinedValue, playCostOf } from "./actions.js";
import type { Command, CostChoices, Payment } from "./commands.js";
import { applyCommand, sessionApply, startSession } from "./engine.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer, printedCostOf } from "./query.js";
import { resolveRef, resolveValue, type EffectContext } from "./select.js";
import type { TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubResource, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard, giveCards } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const P3: PlayerId = playerId("p3");
const P4: PlayerId = playerId("p4");
const SEATS = [P1, P2, P3, P4] as const;
type Players = 1 | 2 | 3 | 4;
const COUNTS: readonly Players[] = [1, 2, 3, 4];

const def = (definition: AbilityDefinition) => definition;

const DRAW_ACTION = stubAbility(
  "draw.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
  }),
);
/** "2[per_hero]" cost, Alliance. */
const TEAM: EventCard = {
  ...stubEvent({ id: "team", cost: 2, keywords: [{ name: "alliance" }], abilities: [DRAW_ACTION.ref] }),
  costPerPlayer: true,
};
/** The same card with a flat 2. */
const FLAT = stubEvent({ id: "flat", cost: 2, abilities: [DRAW_ACTION.ref] });
const PLAIN = stubResource({ id: "plain", icons: 1 });

/** "Reduce the cost of each event you play by 1." */
const DISCOUNT_RULE = stubAbility(
  "discount.constant",
  def({
    trigger: { kind: "constant", costModifiers: [{ delta: -1, appliesTo: { categories: ["event"] } }] },
    effects: [],
  }),
);
const DISCOUNT = stubSupport({ id: "discount", cost: 0, abilities: [DISCOUNT_RULE.ref] });

/** "Action: Exhaust this card and discard a card from your hand → deal damage to the villain equal to its printed cost." */
const KATANA_ACTION = stubAbility(
  "katana.action",
  def({
    trigger: { kind: "action" },
    cost: { exhaustSelf: true, discardFromHand: { min: 1, max: 1 } },
    effects: [
      {
        kind: "dealDamage",
        target: { kind: "villain" },
        amount: { kind: "printedCost", of: { kind: "slot", slot: "discard" } },
      },
    ],
  }),
);
const KATANA = stubSupport({ id: "katana", cost: 0, abilities: [KATANA_ACTION.ref] });

/** A "2[per_hero]" ally beside a flat 3: the flat one costs more with one player, the scaled one with two or more. */
const SQUAD: AllyCard = { ...stubAlly({ id: "squad", cost: 2, atk: 1, thw: 1, hp: 3 }), costPerPlayer: true };
const VETERAN = stubAlly({ id: "veteran", cost: 3, atk: 1, thw: 1, hp: 3 });

/** "Action: Pay the printed cost of an ally in your discard pile → put it into play." */
const CALL_ACTION = stubAbility(
  "call.action",
  def({
    trigger: { kind: "action" },
    cost: {
      payPrintedCostOf: { slot: "ally", from: { zone: "discard", player: "you", query: { categories: ["ally"] } } },
    },
    effects: [{ kind: "putIntoPlay", card: { kind: "slot", slot: "ally" }, controller: { kind: "controller" } }],
  }),
);
const CALL = stubEvent({ id: "call", cost: 0, abilities: [CALL_ACTION.ref] });

/** "Interrupt: When you make a basic attack, …" on a "2[per_hero]" event, played from hand inside the window. */
const LEAP_INTERRUPT = stubAbility(
  "leap.interrupt",
  def({ trigger: { kind: "interrupt", forced: false, on: { on: "attack", playerIs: "controller" } }, effects: [] }),
);
const LEAP: EventCard = { ...stubEvent({ id: "leap", cost: 2, abilities: [LEAP_INTERRUPT.ref] }), costPerPlayer: true };

const CARDS = [TEAM, FLAT, PLAIN, DISCOUNT, KATANA, SQUAD, VETERAN, CALL, LEAP];
const deps = depsOf(DRAW_ACTION, DISCOUNT_RULE, KATANA_ACTION, CALL_ACTION, LEAP_INTERRUPT);
const DECK: readonly CardId[] = [...CARDS.map((card) => card.id), ...copiesOf(PLAIN.id, 8)];

const start = (players: Players): GameState => gameAtFirstTurn({ cards: CARDS, deps, players, deck: DECK });
const plains = (count: number): readonly string[] => copiesOf(PLAIN.id, count);
const fromHand = (...ids: readonly InstanceId[]): readonly Payment[] => ids.map((id) => ({ fromHand: id }));
const play = (card: InstanceId, payment: readonly Payment[], costChoices?: CostChoices): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment,
  attachToInstanceId: null,
  ...(costChoices ? { costChoices } : {}),
});
const run = (state: GameState, ...commands: readonly Command[]): GameState =>
  driveSession(startSession(state), deps, commands, defaultPick).session.state;
/** The error code a command is refused with, or null when it is accepted. */
const refusal = (state: GameState, command: Command): string | null => {
  const result = applyCommand(state, command, deps);
  return result.ok ? null : result.error.code;
};
/** P1 holding `card` and `resources` one-icon resource cards. */
function holding(state: GameState, card: CardId, resources: number) {
  const given = giveCards(state, P1, card, ...plains(resources));
  const [subject, ...paid] = given.ids as [InstanceId, ...InstanceId[]];
  return { state: given.state, subject, paid };
}
const contextOf = (state: GameState): EffectContext => ({
  selfInstanceId: mustPlayer(state, P1).identity.instanceId,
  controllerId: P1,
  event: null,
  bindings: {},
  deps,
});
const ALLIES_IN_PLAY: TargetRef = { kind: "each", query: { categories: ["ally"] } };

describe("§3.4 a per player printed cost is the numeral times the players who started the game", () => {
  it.each(COUNTS)("%i player(s): the price of the play is 2 per player, paid in full", (players) => {
    const { state, subject, paid } = holding(start(players), TEAM.id, 2 * players);
    expect(printedCostOf(state, TEAM)).toBe(2 * players);
    expect(playCostOf(state, P1, subject, deps)).toMatchObject({ printed: 2 * players, current: 2 * players });
    expect(refusal(state, play(subject, fromHand(...paid.slice(1))))).toBe("insufficient_resources");
    const after = run(state, play(subject, fromHand(...paid)));
    expect(mustPlayer(after, P1).discard).toEqual(expect.arrayContaining([subject, ...paid]));
  });

  it.each(COUNTS)("%i player(s): 'reduce the cost by 1' comes off the multiplied cost", (players) => {
    const discounted = playerCardIntoPlay(start(players), DISCOUNT.id).state;
    const { state, subject, paid } = holding(discounted, TEAM.id, 2 * players - 1);
    expect(playCostOf(state, P1, subject, deps)).toMatchObject({ printed: 2 * players, current: 2 * players - 1 });
    expect(refusal(state, play(subject, fromHand(...paid.slice(1))))).toBe("insufficient_resources");
    const after = run(state, play(subject, fromHand(...paid)));
    expect(mustPlayer(after, P1).discard).toContain(subject);
  });

  it.each(COUNTS)(
    "%i player(s): an effect that reads the printed cost reads the multiplied number (ruling of Aug 3, 2026, 5)",
    (players) => {
      const katana = playerCardIntoPlay(start(players), KATANA.id);
      const given = giveCard(katana.state, P1, TEAM.id);
      const villain = activeVillain(given.state).instanceId;
      const before = mustInstance(given.state, villain).damage;
      const after = run(given.state, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: katana.id,
        abilityId: KATANA_ACTION.ref.id,
        payment: [],
        costChoices: { discard: [given.id] },
      });
      expect(mustPlayer(after, P1).discard).toContain(given.id);
      expect(mustInstance(after, villain).damage - before).toBe(2 * players);
    },
  );

  it.each(COUNTS)("%i player(s): the highest-cost comparison and cost filters use the multiplied number", (players) => {
    const squad = playerCardIntoPlay(start(players), SQUAD.id);
    const veteran = playerCardIntoPlay(squad.state, VETERAN.id);
    const state = veteran.state;
    const context = contextOf(state);
    const highest = resolveRef(
      state,
      {
        kind: "superlative",
        among: ALLIES_IN_PLAY,
        order: "highest",
        measure: { kind: "printedCost", of: { kind: "slot", slot: "candidate" } },
      },
      context,
    );
    // 2 against 3 with one player; 4, 6 and 8 against 3 with more.
    expect(highest).toEqual([players === 1 ? veteran.id : squad.id]);
    expect(discardCombinedValue(state, squad.id, { measure: "printedCost", atLeast: 0 })).toBe(2 * players);
    expect(resolveValue(state, { kind: "totalPrintedCost", cards: ALLIES_IN_PLAY }, context)).toBe(2 * players + 3);
    // "An ally with a printed cost of 3 or less."
    const cheap = resolveRef(state, { kind: "each", query: { categories: ["ally"], maxPrintedCost: 3 } }, context);
    expect([...cheap].sort()).toEqual((players === 1 ? [squad.id, veteran.id] : [veteran.id]).sort());
  });

  it.each(COUNTS)("%i player(s): 'pay the printed cost of' a card asks for the multiplied number", (players) => {
    const base = start(players);
    const squad = giveCard(base, P1, SQUAD.id);
    // Into the discard pile, where the cost picks it from.
    const discarded: GameState = {
      ...squad.state,
      players: squad.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((id) => id !== squad.id), discard: [...p.discard, squad.id] }
          : p,
      ),
    };
    const { state, subject, paid } = holding(discarded, CALL.id, 2 * players);
    const choices = { ally: [squad.id] };
    expect(refusal(state, play(subject, fromHand(...paid.slice(1)), choices))).toBe("insufficient_resources");
    const after = run(state, play(subject, fromHand(...paid), choices));
    expect(mustPlayer(after, P1).playArea).toContain(squad.id);
  });

  it.each(COUNTS)("%i player(s): an event played inside a timing window is priced the same way", (players) => {
    // With the resources in hand to pay it: a window offers only an event its player can afford.
    const given = holding(start(players), LEAP.id, 2 * players);
    const hero = applyCommand(given.state, { type: "changeForm", playerId: P1 }, deps);
    if (!hero.ok) throw new Error(hero.error.message);
    const attacked = sessionApply(
      startSession(hero.state),
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: mustPlayer(hero.state, P1).identity.instanceId,
        targetInstanceId: activeVillain(hero.state).instanceId,
      },
      deps,
    );
    if (!attacked.ok) throw new Error(attacked.error.message);
    let state = attacked.session.state;
    const offered = state.pendingChoice;
    // A single candidate may go straight to `payForCard` with no `chooseTriggers` step.
    if (offered?.prompt.kind === "chooseTriggers") {
      const offer = offered.options.find((option) => option.optionId.endsWith(`:${LEAP_INTERRUPT.ref.id}`));
      if (!offer) throw new Error("the interrupt was not offered");
      const accepted = applyCommand(
        state,
        {
          type: "resolveChoice",
          playerId: offered.playerId,
          choiceId: offered.choiceId,
          selectedOptionIds: [offer.optionId],
        },
        deps,
      );
      if (!accepted.ok) throw new Error(accepted.error.message);
      state = accepted.state;
    }
    const paying = state.pendingChoice;
    if (paying?.prompt.kind !== "payForCard") throw new Error(`expected payForCard, got ${paying?.prompt.kind}`);
    expect(paying.prompt.cost).toBe(2 * players);
  });

  it.each(COUNTS)("%i player(s): a card without the icon costs its printed number", (players) => {
    const { state, subject, paid } = holding(start(players), FLAT.id, 2);
    expect(printedCostOf(state, FLAT)).toBe(2);
    expect(printedCostOf(state, VETERAN)).toBe(3);
    expect(printedCostOf(state, PLAIN)).toBe(0);
    expect(playCostOf(state, P1, subject, deps)).toMatchObject({ printed: 2, current: 2 });
    expect(refusal(state, play(subject, fromHand(...paid.slice(1))))).toBe("insufficient_resources");
    const after = run(state, play(subject, fromHand(...paid)));
    expect(mustPlayer(after, P1).discard).toContain(subject);
  });
});

describe("§3.4 with alliance, the group pays the multiplied cost", () => {
  it.each([2, 3, 4] as const)("%i players: each pays 2 from their own hand", (players) => {
    let state = start(players);
    const payment: InstanceId[] = [];
    for (const seat of SEATS.slice(0, players)) {
      const given = giveCards(state, seat, ...plains(2));
      state = given.state;
      payment.push(...given.ids);
    }
    const team = giveCard(state, P1, TEAM.id);
    // One card short, whoever holds it, is not enough.
    expect(refusal(team.state, play(team.id, fromHand(...payment.slice(1))))).toBe("insufficient_resources");
    const after = run(team.state, play(team.id, fromHand(...payment)));
    for (const [index, seat] of SEATS.slice(0, players).entries()) {
      expect(mustPlayer(after, seat).discard).toEqual(expect.arrayContaining(payment.slice(index * 2, index * 2 + 2)));
    }
    expect(mustPlayer(after, P1).discard).toContain(team.id);
  });
});

describe("§3.4 the count is the players who started, not those still in the game", () => {
  const eliminate = (state: GameState, ...out: readonly PlayerId[]): GameState => ({
    ...state,
    players: state.players.map((p) => (out.includes(p.playerId) ? { ...p, eliminated: true } : p)),
  });

  it("three started, one eliminated: still 6, and 6 is what the play costs", () => {
    const { state, subject, paid } = holding(eliminate(start(3), P3), TEAM.id, 6);
    expect(printedCostOf(state, TEAM)).toBe(6);
    expect(playCostOf(state, P1, subject, deps)).toMatchObject({ printed: 6, current: 6 });
    expect(refusal(state, play(subject, fromHand(...paid.slice(1))))).toBe("insufficient_resources");
    expect(refusal(state, play(subject, fromHand(...paid)))).toBeNull();
  });

  it("four started, two eliminated: still 8", () => {
    const state = eliminate(start(4), P3, P4);
    expect(printedCostOf(state, TEAM)).toBe(8);
    expect(printedCostOf(state, SQUAD)).toBe(8);
    expect(printedCostOf(state, FLAT)).toBe(2);
  });
});
