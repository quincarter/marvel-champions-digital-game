/**
 * Two primitives Thwip Thwip! (`spdr` 31017) and Quick Quip (`silk` 52034) need, on synthetic cards:
 *
 * - `AbilityCost.damageCards`: "Deal 1 damage to a [Web-Warrior] character you control →", a cost that deals damage to
 *   a picked character. RRG 1.8 "Cost" (p. 14): "If taking damage is a cost, that cost is not considered paid unless
 *   all of that damage was taken"; "Initiating Abilities" (p. 24, steps 3 and 5); the Focused Rage FAQ entry (p. 57: a
 *   damage cost a tough status card would prevent cannot be paid).
 * - `EffectSpec divide` of status cards with `maxTargets`: "place a total of 2 stun status cards on up to 2 enemies".
 *   RRG 1.8 "Status Cards" (p. 41: one of each type per character, a second stunned or confused with steady); ruling,
 *   Mar 6, 2026 (2) (Quick Quip on two non-steady enemies may place a card on just one).
 */

import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import type { Command, CostChoices } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";
import { trait } from "@mc/content";

const WEB = trait("WEB-WARRIOR");
const DRAW_2 = { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 2 } } as const;
const WEB_COST: AbilityCost = {
  damageCards: {
    slot: "damaged",
    query: { categories: ["identity", "ally"], trait: WEB, controller: "you" },
    min: 1,
    max: 1,
    amount: 1,
  },
};

const eventWith = (id: string, cost: AbilityCost | undefined, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, ...(cost ? { cost } : {}), effects });
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }) };
};

const STUN_2: EffectSpec = {
  kind: "divide",
  what: "stunned",
  amount: { kind: "const", value: 2 },
  among: { categories: ["enemy"] },
  chooser: { kind: "controller" },
  maxTargets: 2,
  bind: "placed",
};
const WEB_DRAW = eventWith("web-draw", WEB_COST, [DRAW_2]);
const STUNS = eventWith("stuns", undefined, [STUN_2]);
const STUNS_3 = eventWith("stuns-3", undefined, [{ ...STUN_2, amount: { kind: "const", value: 3 } } as EffectSpec]);

const WEB_ALLY = stubAlly({ id: "web-ally", traits: [WEB], cost: 0, atk: 1, thw: 1, hp: 3 });
const PLAIN_ALLY = stubAlly({ id: "plain-ally", cost: 0, atk: 1, thw: 1, hp: 3 });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 5 });
const BRUTE = stubMinion({ id: "brute", atk: 1, sch: 1, hp: 5, keywords: [{ name: "steady" }] });
/** "Forced Interrupt: when an ally would take damage, prevent 1 of it" — unknowable when the cost is checked. */
const SHIELD_INTERRUPT = stubAbility("shield.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: { categories: ["ally"] } } },
  effects: [{ kind: "preventDamage", amount: { kind: "const", value: 1 } }],
});
const SHIELD = stubSupport({ id: "shield", cost: 0, abilities: [SHIELD_INTERRUPT.ref] });
/** "Your allies cannot take damage." */
const WARD_RULE = stubAbility("ward.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotTakeDamage", target: { categories: ["ally"] } }] },
  effects: [],
});
const WARD = stubSupport({ id: "ward", cost: 0, abilities: [WARD_RULE.ref] });

const deps: EngineDeps = depsOf(WEB_DRAW.ability, STUNS.ability, STUNS_3.ability, SHIELD_INTERRUPT, WARD_RULE);
const CARDS = [WEB_DRAW.card, STUNS.card, STUNS_3.card, WEB_ALLY, PLAIN_ALLY, GOON, BRUTE, SHIELD, WARD];

const start = (): GameState =>
  gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [
      WEB_DRAW.card.id,
      STUNS.card.id,
      STUNS_3.card.id,
      ...copiesOf(WEB_ALLY.id, 2),
      PLAIN_ALLY.id,
      SHIELD.id,
      WARD.id,
    ],
    encounter: [...copiesOf(GOON.id, 3), BRUTE.id, ...copiesOf("treachery" as never, 10)],
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

function engaged(state: GameState, ...cards: readonly string[]): { state: GameState; ids: InstanceId[] } {
  const ids: InstanceId[] = [];
  let current = state;
  for (const card of cards) {
    const placed = minionEngagedWith(current, card as never);
    current = placed.state;
    ids.push(placed.id);
  }
  return { state: current, ids };
}

const playCmd = (card: InstanceId, costChoices?: CostChoices): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
  ...(costChoices ? { costChoices } : {}),
});

function offered(state: GameState, card: InstanceId): boolean {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`expected P1's turn, got ${actions.kind}`);
  return actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === card);
}

function run(state: GameState, command: Command, pick?: (s: GameState) => readonly string[]) {
  const { session, events } = driveSession(startSession(state), deps, [command], pick);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}

const handSize = (state: GameState): number => mustPlayer(state, P1).hand.length;
const resolvedAt = (events: readonly GameEvent[], abilityId: string): number =>
  events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === abilityId);
const stunned = (state: GameState, id: InstanceId): number => mustInstance(state, id).statuses.stunned;

describe("`AbilityCost.damageCards`: deal 1 damage to a Web-Warrior character you control", () => {
  const ABILITY = "web-draw.action";

  it("the one matching character takes exactly 1 damage before the effect resolves (a forced pick)", () => {
    const { state: withAllies, ids } = inPlay(start(), WEB_ALLY.id, PLAIN_ALLY.id);
    const [web, plain] = ids as [InstanceId, InstanceId];
    const given = giveCard(withAllies, P1, WEB_DRAW.card.id);
    const identity = mustPlayer(given.state, P1).identity.instanceId;
    expect(offered(given.state, given.id)).toBe(true);
    const hand = handSize(given.state);
    const { state: after, events } = run(given.state, playCmd(given.id));
    expect(mustInstance(after, web).damage).toBe(1);
    expect(mustInstance(after, plain).damage).toBe(0);
    expect(mustInstance(after, identity).damage).toBe(0);
    expect(handSize(after)).toBe(hand - 1 + 2);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "costDamageSettled", amount: 1, taken: 1, paid: true }),
    );
    const damaged = events.findIndex((e) => e.type === "damageDealt" && e.targetInstanceId === web);
    expect(damaged).toBeGreaterThanOrEqual(0);
    expect(damaged).toBeLessThan(resolvedAt(events, ABILITY));
  });

  it("two matching characters: the command names the pick; a non-matching character is refused", () => {
    const { state: withAllies, ids } = inPlay(start(), WEB_ALLY.id, WEB_ALLY.id, PLAIN_ALLY.id);
    const [first, second, plain] = ids as [InstanceId, InstanceId, InstanceId];
    const given = giveCard(withAllies, P1, WEB_DRAW.card.id);
    expect(applyCommand(given.state, playCmd(given.id), deps).ok).toBe(false); // not a forced choice
    expect(applyCommand(given.state, playCmd(given.id, { damaged: [plain] }), deps).ok).toBe(false);
    expect(applyCommand(given.state, playCmd(given.id, { damaged: [first, second] }), deps).ok).toBe(false);
    const { state: after } = run(given.state, playCmd(given.id, { damaged: [second] }));
    expect([mustInstance(after, first).damage, mustInstance(after, second).damage]).toEqual([0, 1]);
  });

  it("no character that matches: not offered, refused", () => {
    const { state: withAlly } = inPlay(start(), PLAIN_ALLY.id);
    const given = giveCard(withAlly, P1, WEB_DRAW.card.id);
    expect(offered(given.state, given.id)).toBe(false);
    expect(applyCommand(given.state, playCmd(given.id), deps).ok).toBe(false);
  });

  it("a matching character that can't take all of it can't pay: tough status card (Focused Rage FAQ), cannot take damage", () => {
    const { state: withAlly, ids } = inPlay(start(), WEB_ALLY.id);
    const web = ids[0]!;
    const tough: GameState = {
      ...withAlly,
      instances: {
        ...withAlly.instances,
        [web]: { ...mustInstance(withAlly, web), statuses: { ...mustInstance(withAlly, web).statuses, tough: 1 } },
      },
    };
    const toughHand = giveCard(tough, P1, WEB_DRAW.card.id);
    expect(offered(toughHand.state, toughHand.id)).toBe(false);
    expect(applyCommand(toughHand.state, playCmd(toughHand.id), deps).ok).toBe(false);

    const warded = inPlay(withAlly, WARD.id).state;
    const wardHand = giveCard(warded, P1, WEB_DRAW.card.id);
    expect(offered(wardHand.state, wardHand.id)).toBe(false);
  });

  it("damage prevented as it is taken means the cost was not paid: the effect does not resolve", () => {
    const { state: withAlly, ids } = inPlay(start(), WEB_ALLY.id, SHIELD.id);
    const web = ids[0]!;
    const given = giveCard(withAlly, P1, WEB_DRAW.card.id);
    expect(offered(given.state, given.id)).toBe(true); // an interrupt can't be known before paying
    const hand = handSize(given.state);
    const { state: after, events } = run(given.state, playCmd(given.id));
    expect(mustInstance(after, web).damage).toBe(0);
    expect(handSize(after)).toBe(hand - 1); // the event left hand, no draw
    expect(events).toContainEqual(
      expect.objectContaining({ type: "costDamageSettled", amount: 1, taken: 0, paid: false }),
    );
    expect(resolvedAt(events, ABILITY)).toBe(-1);
  });
});

describe("`EffectSpec divide` of status cards: place a total of 2 stun status cards on up to 2 enemies", () => {
  /** Plays the stun event, answering the divide with `shares`; records what was asked. */
  function playStuns(state: GameState, shares: readonly string[]) {
    const given = giveCard(state, P1, STUNS.card.id);
    const asked: { options?: readonly string[]; min?: number; max?: number; prompt?: unknown } = {};
    const pick = (current: GameState): readonly string[] => {
      const choice = current.pendingChoice;
      if (choice?.prompt.kind !== "divide") return defaultPick(current);
      asked.options = choice.options.map((o) => o.optionId);
      asked.min = choice.minSelections;
      asked.max = choice.maxSelections;
      asked.prompt = choice.prompt;
      return shares;
    };
    return { ...run(given.state, playCmd(given.id), pick), asked };
  }

  it("splits 1 + 1 between two enemies", () => {
    const { state: table, ids } = engaged(start(), GOON.id);
    const goon = ids[0]!;
    const villain = activeVillain(table).instanceId;
    const { state: after, asked } = playStuns(table, [`${villain}#1`, `${goon}#1`]);
    expect([stunned(after, villain), stunned(after, goon)]).toEqual([1, 1]);
    expect(asked).toMatchObject({ min: 1, max: 2, prompt: { kind: "divide", what: "stunned", maxTargets: 2 } });
    // A non-steady enemy is offered one card only (RRG 1.8 "Status Cards", p. 41).
    expect(asked.options).toEqual([`${villain}#1`, `${goon}#1`]);
  });

  it("both on one non-steady enemy is not an option; choosing just that one places 1 (ruling, Mar 6, 2026 (2))", () => {
    const { state: table, ids } = engaged(start(), GOON.id);
    const goon = ids[0]!;
    const villain = activeVillain(table).instanceId;
    expect(() => playStuns(table, [`${goon}#1`, `${goon}#2`])).toThrow();
    const { state: after } = playStuns(table, [`${goon}#1`]);
    expect([stunned(after, villain), stunned(after, goon)]).toEqual([0, 1]);
  });

  it("both on one steady enemy is legal (it can hold two); choosing it alone must place both", () => {
    const { state: table, ids } = engaged(start(), BRUTE.id);
    const brute = ids[0]!;
    const villain = activeVillain(table).instanceId;
    expect(() => playStuns(table, [`${brute}#1`])).toThrow(); // chose one target that can hold 2: place both
    const { state: after, asked } = playStuns(table, [`${brute}#1`, `${brute}#2`]);
    expect(asked.options).toEqual([`${villain}#1`, `${brute}#1`, `${brute}#2`]);
    expect([stunned(after, villain), stunned(after, brute)]).toEqual([0, 2]);
  });

  it("at most `maxTargets` different enemies: 3 cards over 3 enemies is refused, over 2 is fine", () => {
    const { state: table, ids } = engaged(start(), GOON.id, GOON.id);
    const [a, b] = ids as [InstanceId, InstanceId];
    const villain = activeVillain(table).instanceId;
    const given = giveCard(table, P1, STUNS_3.card.id);
    const applied = applyCommand(given.state, playCmd(given.id), deps);
    if (!applied.ok) throw new Error(applied.error.message);
    const choice = applied.state.pendingChoice!;
    const answer = (selectedOptionIds: readonly string[]) =>
      applyCommand(
        applied.state,
        { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds },
        deps,
      );
    expect(answer([`${villain}#1`, `${a}#1`, `${b}#1`]).ok).toBe(false);
    const two = answer([`${a}#1`, `${b}#1`]);
    expect(two.ok).toBe(true);
    if (two.ok) expect([stunned(two.state, villain), stunned(two.state, a), stunned(two.state, b)]).toEqual([0, 1, 1]);
  });

  it("an enemy already stunned is no candidate; the only one left takes what it can without a choice", () => {
    const { state: table, ids } = engaged(start(), GOON.id);
    const goon = ids[0]!;
    const villain = activeVillain(table).instanceId;
    const held: GameState = {
      ...table,
      instances: {
        ...table.instances,
        [villain]: {
          ...mustInstance(table, villain),
          statuses: { ...mustInstance(table, villain).statuses, stunned: 1 },
        },
      },
    };
    const { state: after, asked } = playStuns(held, []);
    expect(asked.options).toBeUndefined(); // nothing asked
    expect([stunned(after, villain), stunned(after, goon)]).toEqual([1, 1]);
  });
});
