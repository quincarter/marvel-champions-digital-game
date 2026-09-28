/**
 * Three cost shapes the Osborn Tech modular (`sm` 27147–27150) needed, on synthetic support cards whose effect is
 * "draw 2 cards", so a test can tell the effect resolving from the cost being paid:
 *
 * - `InPlayCostPick.superlative`: "Discard the highest-cost upgrade you control →" (Arm Cannon, 27147).
 * - `AbilityCost.indirectDamage`: "Take 3 indirect damage →" (Kinetic Armor, 27149).
 * - `AbilityCost.giveStatus` / `giveBoostCards`: "Give the villain a tough status card and 1 facedown boost card →"
 *   (Neocarbon Scales, 27150).
 *
 * Sources: RRG 1.8 "Cost" (pp. 13–14: paid in full or not at all; "If taking damage is a cost, that cost is not
 * considered paid unless all of that damage was taken"), "Initiating Abilities" (p. 24, steps 3 and 5), "Indirect
 * Damage" (p. 24), "Status Cards" (p. 41), "Boost, Boost Icon" (p. 11), "Encounter Deck" (p. 17), and the Focused Rage
 * FAQ entry (p. 57: a damage cost a tough status card would prevent cannot be paid).
 */

import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import type { Command, CostChoices } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeEncounterDeckId, activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const DRAW_2 = { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 2 } } as const;

function rig(id: string, cost: AbilityCost) {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, cost, effects: [DRAW_2] });
  return { ability, card: stubSupport({ id, cost: 0, abilities: [ability.ref] }) };
}

const HIGHEST = rig("highest-rig", {
  discardCards: {
    slot: "discarded",
    query: { categories: ["upgrade"] },
    min: 1,
    max: 1,
    superlative: { order: "highest", measure: "printedCost" },
  },
});
const INDIRECT = rig("indirect-rig", { indirectDamage: 3 });
const GIVE = rig("give-rig", {
  giveStatus: { status: "tough", to: { kind: "villain" } },
  giveBoostCards: { count: 1, to: { kind: "villain" } },
});
const CHEAP = stubUpgrade({ id: "cheap-gear", cost: 1 });
const PRICEY = stubUpgrade({ id: "pricey-gear", cost: 3 });
const STURDY_ALLY = stubAlly({ id: "sturdy-ally", cost: 0, atk: 1, thw: 1, hp: 4 });
/** "Reduce the damage your identity takes by 1" (any damage, not only an attack's). */
const PADDING_RULE = stubAbility("padding.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "reduceDamageTaken", target: { categories: ["identity"] }, amount: 1 }],
  },
  effects: [],
});
const PADDING = stubSupport({ id: "padding", cost: 0, abilities: [PADDING_RULE.ref] });

const deps: EngineDeps = depsOf(HIGHEST.ability, INDIRECT.ability, GIVE.ability, PADDING_RULE);
const CARDS = [HIGHEST.card, INDIRECT.card, GIVE.card, CHEAP, PRICEY, STURDY_ALLY, PADDING];

const start = (): GameState =>
  gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [
      HIGHEST.card.id,
      INDIRECT.card.id,
      GIVE.card.id,
      PADDING.id,
      STURDY_ALLY.id,
      ...copiesOf(CHEAP.id, 2),
      ...copiesOf(PRICEY.id, 2),
    ],
  });

function inPlay(state: GameState, ...cards: readonly string[]): { state: GameState; ids: InstanceId[] } {
  const ids: InstanceId[] = [];
  let current = state;
  for (const card of cards) {
    const placed = playerCardIntoPlay(current, card as never);
    current = placed.state;
    ids.push(placed.id);
  }
  return { state: current, ids };
}

const use = (card: InstanceId, abilityId: string, costChoices?: CostChoices): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: abilityId as never,
  payment: [],
  ...(costChoices ? { costChoices } : {}),
});

function offered(state: GameState, abilityId: string): boolean {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`expected P1's turn, got ${actions.kind}`);
  return actions.legal.some((a) => a.action.kind === "useAbility" && a.action.abilityId === abilityId);
}

function run(state: GameState, command: Command) {
  const { session, events } = driveSession(startSession(state), deps, [command]);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}

const handSize = (state: GameState): number => mustPlayer(state, P1).hand.length;
const resolvedAt = (events: readonly GameEvent[], abilityId: string): number =>
  events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === abilityId);

describe("`InPlayCostPick.superlative`: discard the highest-cost upgrade you control", () => {
  const ABILITY = "highest-rig.action";

  it("only the highest-cost upgrade can pay; paid before the effect resolves", () => {
    const { state, ids } = inPlay(start(), HIGHEST.card.id, CHEAP.id, PRICEY.id);
    const [rigId, cheap, pricey] = ids as [InstanceId, InstanceId, InstanceId];
    expect(offered(state, ABILITY)).toBe(true);
    expect(applyCommand(state, use(rigId, ABILITY, { discarded: [cheap] }), deps).ok).toBe(false);
    const hand = handSize(state);
    const { state: after, events } = run(state, use(rigId, ABILITY));
    expect(mustPlayer(after, P1).discard).toContain(pricey);
    expect(mustPlayer(after, P1).playArea).toContain(cheap);
    expect(handSize(after)).toBe(hand + 2);
    const paid = events.findIndex((e) => e.type === "cardMoved" && e.instanceId === pricey);
    expect(paid).toBeGreaterThanOrEqual(0);
    expect(paid).toBeLessThan(resolvedAt(events, ABILITY));
  });

  it("a tie is the payer's pick, named in costChoices; either tied card can pay", () => {
    const { state, ids } = inPlay(start(), HIGHEST.card.id, CHEAP.id, PRICEY.id, PRICEY.id);
    const [rigId, cheap, first, second] = ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    expect(applyCommand(state, use(rigId, ABILITY), deps).ok).toBe(false); // not a forced choice
    expect(applyCommand(state, use(rigId, ABILITY, { discarded: [cheap] }), deps).ok).toBe(false);
    const { state: after } = run(state, use(rigId, ABILITY, { discarded: [second] }));
    expect(mustPlayer(after, P1).discard).toContain(second);
    expect(mustPlayer(after, P1).playArea).toEqual(expect.arrayContaining([cheap, first]));
  });

  it("with no upgrade the cost can't be paid: not offered, refused", () => {
    const { state, ids } = inPlay(start(), HIGHEST.card.id);
    expect(offered(state, ABILITY)).toBe(false);
    expect(applyCommand(state, use(ids[0]!, ABILITY), deps).ok).toBe(false);
  });
});

describe("`AbilityCost.indirectDamage`: take 3 indirect damage", () => {
  const ABILITY = "indirect-rig.action";

  it("your identity takes all 3 before the effect resolves", () => {
    const { state, ids } = inPlay(start(), INDIRECT.card.id);
    const identity = mustPlayer(state, P1).identity.instanceId;
    expect(offered(state, ABILITY)).toBe(true);
    const hand = handSize(state);
    const { state: after, events } = run(state, use(ids[0]!, ABILITY));
    expect(mustInstance(after, identity).damage).toBe(3);
    expect(handSize(after)).toBe(hand + 2);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "costDamageSettled", amount: 3, taken: 3, paid: true }),
    );
    const damaged = events.findIndex((e) => e.type === "damageDealt" && e.targetInstanceId === identity);
    expect(damaged).toBeGreaterThanOrEqual(0);
    expect(damaged).toBeLessThan(resolvedAt(events, ABILITY));
  });

  it("not offered when your characters can't absorb all of it", () => {
    const { state, ids } = inPlay(start(), INDIRECT.card.id);
    const identity = mustPlayer(state, P1).identity.instanceId;
    const worn = {
      ...state,
      instances: { ...state.instances, [identity]: { ...mustInstance(state, identity), damage: 8 } }, // 2 of 10 left
    };
    expect(offered(worn, ABILITY)).toBe(false);
    expect(applyCommand(worn, use(ids[0]!, ABILITY), deps).ok).toBe(false);
  });

  it("a character with a tough status card can't pay it: alone, not offered; beside an ally, the ally takes it all", () => {
    const placed = inPlay(start(), INDIRECT.card.id);
    const identity = mustPlayer(placed.state, P1).identity.instanceId;
    const tough = (s: GameState): GameState => ({
      ...s,
      instances: {
        ...s.instances,
        [identity]: { ...mustInstance(s, identity), statuses: { ...mustInstance(s, identity).statuses, tough: 1 } },
      },
    });
    const alone = tough(placed.state);
    expect(offered(alone, ABILITY)).toBe(false);
    expect(applyCommand(alone, use(placed.ids[0]!, ABILITY), deps).ok).toBe(false);

    const withAlly = inPlay(alone, STURDY_ALLY.id);
    const ally = withAlly.ids[0]!;
    expect(offered(withAlly.state, ABILITY)).toBe(true);
    const { state: after } = run(withAlly.state, use(placed.ids[0]!, ABILITY));
    expect(mustInstance(after, ally).damage).toBe(3);
    expect(mustInstance(after, identity).damage).toBe(0);
    expect(mustInstance(after, identity).statuses.tough).toBe(1); // never assigned any
  });

  it("with an identity and an ally, the payer divides it (one assignIndirectDamage choice)", () => {
    const { state, ids } = inPlay(start(), INDIRECT.card.id, STURDY_ALLY.id);
    const [rigId, ally] = ids as [InstanceId, InstanceId];
    const identity = mustPlayer(state, P1).identity.instanceId;
    const applied = applyCommand(state, use(rigId, ABILITY), deps);
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.state.pendingChoice?.prompt).toMatchObject({ kind: "assignIndirectDamage", amount: 3 });
    const { state: after } = run(state, use(rigId, ABILITY));
    expect(mustInstance(after, identity).damage + mustInstance(after, ally).damage).toBe(3);
  });

  it("damage prevented as it is taken means the cost was not paid: the effect does not resolve", () => {
    const { state, ids } = inPlay(start(), INDIRECT.card.id, PADDING.id);
    const identity = mustPlayer(state, P1).identity.instanceId;
    expect(offered(state, ABILITY)).toBe(true); // the reduction can't be known before paying
    const hand = handSize(state);
    const { state: after, events } = run(state, use(ids[0]!, ABILITY));
    expect(mustInstance(after, identity).damage).toBe(2); // taken stays taken
    expect(handSize(after)).toBe(hand); // no draw
    expect(events).toContainEqual(
      expect.objectContaining({ type: "costDamageSettled", amount: 3, taken: 2, paid: false }),
    );
    expect(resolvedAt(events, ABILITY)).toBe(-1);
  });
});

describe("`AbilityCost.giveStatus` / `giveBoostCards`: give the villain a tough status card and 1 facedown boost card", () => {
  const ABILITY = "give-rig.action";

  it("the villain gets both before the effect resolves", () => {
    const { state, ids } = inPlay(start(), GIVE.card.id);
    const villain = activeVillain(state).instanceId;
    expect(mustInstance(state, villain).statuses.tough).toBe(0);
    expect(offered(state, ABILITY)).toBe(true);
    const hand = handSize(state);
    const { state: after, events } = run(state, use(ids[0]!, ABILITY));
    expect(mustInstance(after, villain).statuses.tough).toBe(1);
    const boosts = mustInstance(after, villain).boostCards;
    expect(boosts).toHaveLength(1);
    expect(mustInstance(after, boosts[0]!).faceup).toBe(false);
    expect(handSize(after)).toBe(hand + 2);
    const resolved = resolvedAt(events, ABILITY);
    const given = events.findIndex((e) => e.type === "statusGiven" && e.instanceId === villain);
    const dealt = events.findIndex((e) => e.type === "boostCardDealt" && e.enemyInstanceId === villain);
    expect(given).toBeGreaterThanOrEqual(0);
    expect(dealt).toBeGreaterThanOrEqual(0);
    expect(Math.max(given, dealt)).toBeLessThan(resolved);
  });

  it("a villain that already has a tough status card can't be given another: not offered, refused", () => {
    const { state, ids } = inPlay(start(), GIVE.card.id);
    const villain = activeVillain(state).instanceId;
    const tough = {
      ...state,
      instances: {
        ...state.instances,
        [villain]: {
          ...mustInstance(state, villain),
          statuses: { ...mustInstance(state, villain).statuses, tough: 1 },
        },
      },
    };
    expect(offered(tough, ABILITY)).toBe(false);
    expect(applyCommand(tough, use(ids[0]!, ABILITY), deps).ok).toBe(false);
  });

  it("an empty encounter deck and discard pile can't supply the boost card: not offered", () => {
    const { state, ids } = inPlay(start(), GIVE.card.id);
    const deckId = activeEncounterDeckId(state);
    const empty = { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { deck: [], discard: [] } } };
    expect(offered(empty, ABILITY)).toBe(false);
    expect(applyCommand(empty, use(ids[0]!, ABILITY), deps).ok).toBe(false);
  });

  it('an empty encounter deck is reshuffled from its discard pile to pay (RRG 1.8 "Encounter Deck", p. 17)', () => {
    const { state, ids } = inPlay(start(), GIVE.card.id);
    const deckId = activeEncounterDeckId(state);
    const piles = state.encounterDecks[deckId]!;
    const moved = {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { deck: [], discard: [...piles.deck, ...piles.discard] } },
    };
    expect(offered(moved, ABILITY)).toBe(true);
    const { state: after } = run(moved, use(ids[0]!, ABILITY));
    expect(mustInstance(after, activeVillain(after).instanceId).boostCards).toHaveLength(1);
    expect(after.encounterDecks[deckId]!.discard).toHaveLength(0);
  });
});
