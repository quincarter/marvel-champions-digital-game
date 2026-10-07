/**
 * `notWhileResolving` on an interrupt or response trigger: the ability is not gathered again while an earlier use of it
 * by the same card is still resolving (owner ruling 2026-10-07 on Hidden in the Clutter, docs/phase7-wave7.md §4.1: "The
 * attachment is not eligible to retrigger while the attack it created resolves"). Off by default: the RRG has no general
 * rule against an ability triggering from an event its own resolution causes, and the first test pins that it does.
 *
 * Synthetic cards. "Echo": "Forced Response: After your hero takes damage, remove 1 fuel counter from the pot. Deal
 * damage to your hero equal to the fuel counters left there. Then mark this card." The damage it deals is the event
 * that would set it off again; with no fuel left it deals 0 damage, which opens no window, so every chain ends.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, giveCard, HERO, runWith } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const yourHero: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const POT: TargetRef = { kind: "each", query: { categories: ["support"], name: "pot" } };
const FUEL = { kind: "counters", of: POT, counterType: "fuel" } as const;

const echoEffects: readonly EffectSpec[] = [
  { kind: "removeCounters", target: POT, counterType: "fuel", amount: n(1) },
  { kind: "dealDamage", target: yourHero, amount: FUEL },
  { kind: "addCounters", target: { kind: "self" }, counterType: "done", amount: n(1) },
];
const echo = (id: string, notWhileResolving: boolean) =>
  stubAbility(`${id}.forced-response`, {
    trigger: {
      kind: "response",
      forced: true,
      on: {
        on: "dealDamage",
        targetIs: { categories: ["hero"], controller: "you" },
        requireResults: { amount: 1 },
      },
      ...(notWhileResolving ? { notWhileResolving: true } : {}),
    },
    effects: echoEffects,
  } as AbilityDefinition);
const ECHO = echo("echo", false);
const ONCE = echo("once", true);
const ECHO_CARD = stubSupport({ id: "echo", cost: 0, abilities: [ECHO.ref] });
const ONCE_CARD = stubSupport({ id: "once", cost: 0, abilities: [ONCE.ref] });
const POT_CARD = stubSupport({ id: "pot", cost: 0 });

/** "Deal 1 damage to your hero." */
const HIT_ABILITY = stubAbility("hit.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: yourHero, amount: n(1) }],
});
const HIT = stubEvent({ id: "hit", cost: 0, abilities: [HIT_ABILITY.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const deps: EngineDeps = depsOf(ECHO, ONCE, HIT_ABILITY);

function setup(cards: readonly (typeof ECHO_CARD)[], fuel: number) {
  const hero = stubIdentity({
    id: HERO.id,
    hp: 20,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
  });
  let state = gameAtFirstTurn({
    cards: [hero, ECHO_CARD, ONCE_CARD, POT_CARD, HIT, BLANK],
    deps,
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 1, sch: 1 }] }),
    mainScheme: stubMainScheme({
      id: "main",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    deck: [POT_CARD.id, ...cards.map((card) => card.id), HIT.id, HIT.id],
    encounter: copiesOf(BLANK.id, 30),
  });
  const pot = playerCardIntoPlay(state, POT_CARD.id);
  state = pot.state;
  const placed: InstanceId[] = [];
  for (const card of cards) {
    const put = playerCardIntoPlay(state, card.id);
    state = put.state;
    placed.push(put.id);
  }
  if (mustPlayer(state, P1).identity.form !== "hero")
    state = runWith(deps, state, { type: "changeForm", playerId: P1 });
  state = {
    ...state,
    instances: {
      ...state.instances,
      [pot.id]: { ...mustInstance(state, pot.id), counters: { fuel } },
    },
  };
  return { state, pot: pot.id, cards: placed, hero: mustPlayer(state, P1).identity.instanceId };
}

function hit(state: GameState) {
  const given = giveCard(state, P1, HIT.id);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const { session, events } = driveSession(startSession(given.state), deps, [command], defaultPick);
  return { session, state: session.state, events };
}
const counter = (state: GameState, id: InstanceId, name: string) => mustInstance(state, id).counters[name] ?? 0;
const resolvedBy = (events: readonly GameEvent[], id: InstanceId) =>
  events.filter((e) => e.type === "abilityResolved" && e.instanceId === id).length;
const expectReplays = (session: { log: Parameters<typeof replay>[0]; state: GameState }) => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};

describe("notWhileResolving", () => {
  it("without it an ability triggers again from the damage its own resolution deals (the engine's default)", () => {
    const s = setup([ECHO_CARD], 3);
    const { state, events, session } = hit(s.state);
    // 1 from the event, then 2 and 1 from the nested uses; the third use deals 0, which opens no window.
    expect(mustInstance(state, s.hero).damage).toBe(4);
    expect(counter(state, s.pot, "fuel")).toBe(0);
    expect(counter(state, s.cards[0]!, "done")).toBe(3);
    expect(resolvedBy(events, s.cards[0]!)).toBe(3);
    expectReplays(session);
  });

  it("with it the damage its own resolution deals does not set it off again", () => {
    const s = setup([ONCE_CARD], 3);
    const { state, events, session } = hit(s.state);
    expect(mustInstance(state, s.hero).damage).toBe(3);
    expect(counter(state, s.pot, "fuel")).toBe(2);
    expect(counter(state, s.cards[0]!, "done")).toBe(1);
    expect(resolvedBy(events, s.cards[0]!)).toBe(1);
    // The damage it dealt was still dealt and answered as any other: its response window opened with nothing in it.
    expect(events.filter((e) => e.type === "damageDealt").map((e) => e.amount)).toEqual([1, 2]);
    expectReplays(session);
  });

  it("it is not a limit: once that use has finished, the next damage triggers it as usual", () => {
    const s = setup([ONCE_CARD], 3);
    const first = hit(s.state);
    const second = hit(first.state);
    // The second hit: 1, then the use removes a fuel counter (2 to 1) and deals 1.
    expect(mustInstance(second.state, s.hero).damage).toBe(3 + 2);
    expect(counter(second.state, s.pot, "fuel")).toBe(1);
    expect(counter(second.state, s.cards[0]!, "done")).toBe(2);
    expect(resolvedBy(second.events, s.cards[0]!)).toBe(1);
  });

  it("it is the card's own use that counts: another copy still answers the damage this copy deals", () => {
    const s = setup([ONCE_CARD, ONCE_CARD], 3);
    const { state, events, session } = hit(s.state);
    const [a, b] = s.cards as [InstanceId, InstanceId];
    // Both copies answer the first hit. Whichever resolves first deals 2, which only the other copy may answer (fuel 2
    // to 1, 1 damage, answered by neither: both are resolving); the other copy's answer to the first hit then finds
    // 1 fuel, removes it and deals 0.
    expect(mustInstance(state, s.hero).damage).toBe(1 + 2 + 1);
    expect(counter(state, s.pot, "fuel")).toBe(0);
    expect(resolvedBy(events, a) + resolvedBy(events, b)).toBe(3);
    expect([resolvedBy(events, a), resolvedBy(events, b)].sort()).toEqual([1, 2]);
    expectReplays(session);
  });
});
