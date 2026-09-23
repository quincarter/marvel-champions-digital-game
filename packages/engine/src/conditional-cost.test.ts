/**
 * docs/phase7-wave3.md §3.49: a cost component the board picks (`AbilityCost.conditional`). Synthetic upgrades shaped
 * like two Milano mods (`gmw`):
 *
 * - Reactor Core (16165): "Exhaust Reactor Core and discard the top 2 cards of your deck (the top card instead if you
 *   control the Milano) →" — how many.
 * - Navigation Column (16172): "Exhaust Navigation Column, choose and discard 1 card from your hand (discard the top
 *   card of your deck instead if you control the Milano) →" — which zone.
 *
 * "The Milano" is a stub support here; the condition is any `Predicate`.
 *
 * Sources: RRG 1.8 "Initiating Abilities" (p. 24): step 3 determines the cost, step 5 pays it or aborts without paying
 * anything; "Replacement Effect" (p. 37): an "instead" replaces the printed effect, so the replaced cost is not the
 * cost at all; "Cost" (p. 13): a cost is paid in full.
 */

import type { AbilityId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, AbilityDefinition } from "./abilities.js";
import type { Command, CostChoices } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const SHIP_CONTROLLED: Predicate = {
  kind: "exists",
  query: { categories: ["support"], name: "ship", controller: "you" },
};
/** The effect records which branch was paid: `cost.condition` counters on the card (1 = the condition held). */
const RECORD_BRANCH = [
  {
    kind: "addCounters",
    target: { kind: "self" },
    counterType: "branch",
    amount: { kind: "var", name: "cost.condition" },
  },
] as const;

const conditional = (then: AbilityCost, otherwise: AbilityCost): AbilityCost => ({
  conditional: { condition: SHIP_CONTROLLED, then, else: otherwise },
});
const CORE_ABILITY = stubAbility(
  "core.action",
  def({
    trigger: { kind: "action" },
    cost: { exhaustSelf: true, ...conditional({ discardFromDeck: 1 }, { discardFromDeck: 2 }) },
    effects: RECORD_BRANCH,
  }),
);
const COLUMN_ABILITY = stubAbility(
  "column.action",
  def({
    trigger: { kind: "action" },
    cost: { exhaustSelf: true, ...conditional({ discardFromDeck: 1 }, { discardFromHand: { min: 1, max: 1 } }) },
    effects: RECORD_BRANCH,
  }),
);
const CORE = stubUpgrade({ id: "core", cost: 0, abilities: [CORE_ABILITY.ref] });
const COLUMN = stubUpgrade({ id: "column", cost: 0, abilities: [COLUMN_ABILITY.ref] });
const SHIP = stubSupport({ id: "ship", cost: 0 });
const deps = depsOf(CORE_ABILITY, COLUMN_ABILITY);

interface Table {
  readonly state: GameState;
  readonly core: InstanceId;
  readonly column: InstanceId;
}

/**
 * p1 with both upgrades in play, and the ship under `ship`'s control (none when false; two players when "p2").
 * `piles` empties p1's zones by surgery.
 */
function table(ship: boolean | "p2", piles: { readonly hand?: "empty"; readonly deck?: "empty" } = {}): Table {
  let state = gameAtFirstTurn({
    cards: [CORE, COLUMN, SHIP],
    deps,
    deck: [CORE.id, COLUMN.id, SHIP.id],
    players: ship === "p2" ? 2 : 1,
  });
  const core = playerCardIntoPlay(state, CORE.id);
  const column = playerCardIntoPlay(core.state, COLUMN.id);
  state = ship ? playerCardIntoPlay(column.state, SHIP.id, ship === "p2" ? P2 : P1).state : column.state;
  state = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            ...(piles.hand === "empty" ? { hand: [] } : {}),
            ...(piles.deck === "empty" ? { deck: [], discard: [] } : {}),
          }
        : p,
    ),
  };
  return { state, core: core.id, column: column.id };
}

const use = (card: InstanceId, abilityId: AbilityId, costChoices?: CostChoices): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId,
  payment: [],
  ...(costChoices ? { costChoices } : {}),
});

function run(state: GameState, command: Command): GameState {
  const { session } = driveSession(startSession(state), deps, [command]);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return session.state;
}

const sizes = (state: GameState) => {
  const seat = mustPlayer(state, P1);
  return { hand: seat.hand.length, deck: seat.deck.length, discard: seat.discard.length };
};
const branch = (state: GameState, id: InstanceId): number => mustInstance(state, id).counters.branch ?? 0;

function legalEntry(state: GameState, card: InstanceId) {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
  return {
    legal: actions.legal.find((a) => a.action.kind === "useAbility" && a.action.instanceId === card),
    illegal: actions.illegal.find((a) => a.action.kind === "useAbility" && a.action.instanceId === card),
  };
}

describe("§3.49 a cost the board picks: 'discard the top 2 cards of your deck (the top card instead if …)'", () => {
  it("without the ship pays the printed 2 cards; with it, 1 card instead; the branch is recorded as cost.condition", () => {
    const without = table(false);
    const before = sizes(without.state);
    const paid = run(without.state, use(without.core, CORE_ABILITY.ref.id));
    expect(sizes(paid)).toMatchObject({ deck: before.deck - 2, discard: before.discard + 2 });
    expect(mustInstance(paid, without.core).exhausted).toBe(true);
    expect(branch(paid, without.core)).toBe(0);

    const withShip = table(true);
    const beforeShip = sizes(withShip.state);
    const paidShip = run(withShip.state, use(withShip.core, CORE_ABILITY.ref.id));
    expect(sizes(paidShip)).toMatchObject({ deck: beforeShip.deck - 1, discard: beforeShip.discard + 1 });
    expect(branch(paidShip, withShip.core)).toBe(1);
  });

  it("a ship controlled by another player does not count: `you` is the paying player", () => {
    const theirs = table("p2");
    const before = sizes(theirs.state);
    const paid = run(theirs.state, use(theirs.core, CORE_ABILITY.ref.id));
    expect(sizes(paid).deck).toBe(before.deck - 2);
    expect(branch(paid, theirs.core)).toBe(0);
  });
});

describe("§3.49 '… from your hand (discard the top card of your deck instead if …)': the board picks the zone", () => {
  it("without the ship a hand card must be picked; with it the deck pays and the hand is untouched", () => {
    const without = table(false);
    const [pick] = mustPlayer(without.state, P1).hand;
    // No pick: the hand branch cannot be paid.
    expect(applyCommand(without.state, use(without.column, COLUMN_ABILITY.ref.id), deps).ok).toBe(false);
    const paid = run(without.state, use(without.column, COLUMN_ABILITY.ref.id, { discard: [pick!] }));
    expect(mustPlayer(paid, P1).discard).toContain(pick);
    expect(sizes(paid).deck).toBe(sizes(without.state).deck);

    const withShip = table(true);
    const handBefore = mustPlayer(withShip.state, P1).hand;
    const paidShip = run(withShip.state, use(withShip.column, COLUMN_ABILITY.ref.id));
    expect(mustPlayer(paidShip, P1).hand).toEqual(handBefore);
    expect(sizes(paidShip).deck).toBe(sizes(withShip.state).deck - 1);
    expect(branch(paidShip, withShip.column)).toBe(1);
  });

  it("legalActions fills in the picks of the branch the board picked", () => {
    const without = legalEntry(table(false).state, table(false).column).legal;
    expect(without?.example).toMatchObject({ costChoices: { discard: [expect.any(String)] } });
    const withShip = legalEntry(table(true).state, table(true).column).legal;
    expect(withShip).toBeDefined();
    expect(withShip?.example).not.toHaveProperty("costChoices.discard");
  });

  it("no fallback: the picked branch must be payable, even when the other one could be", () => {
    // Ship, empty deck and discard pile, a full hand: the deck branch is the cost, and it cannot be paid.
    const stranded = table(true, { deck: "empty" });
    expect(mustPlayer(stranded.state, P1).hand.length).toBeGreaterThan(0);
    const refused = applyCommand(
      stranded.state,
      use(stranded.column, COLUMN_ABILITY.ref.id, { discard: [mustPlayer(stranded.state, P1).hand[0]!] }),
      deps,
    );
    expect(refused.ok).toBe(false);
    expect(legalEntry(stranded.state, stranded.column).legal).toBeUndefined();
    expect(legalEntry(stranded.state, stranded.column).illegal).toBeDefined();

    // No ship, an empty hand, a full deck: the hand branch is the cost, and it cannot be paid.
    const emptyHand = table(false, { hand: "empty" });
    expect(applyCommand(emptyHand.state, use(emptyHand.column, COLUMN_ABILITY.ref.id), deps).ok).toBe(false);
    expect(legalEntry(emptyHand.state, emptyHand.column).legal).toBeUndefined();
  });
});
