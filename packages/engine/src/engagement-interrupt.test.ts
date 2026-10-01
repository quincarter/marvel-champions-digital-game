/**
 * Interrupts to a minion engaging a player ("Hero Interrupt: When you engage a minion", Anticipation; "Interrupt: When a
 * minion would engage a player", Target Spotter), proven with synthetic cards.
 *
 * RRG 1.8 "Engage" (p. 18): a minion entering play in a player's play area engages that player; an ability telling a
 * player to engage a minion counts as it engaging them. "Interrupt" (p. 25): resolves immediately before its triggering
 * condition resolves. "Response" (p. 38). "Triggering Condition" (p. 45): one occurrence's conditions share a single
 * interrupt window. FAQ "Target Spotter (#38)" (p. 65): it "interrupts the engagement of that minion". "After you engage"
 * responses keep their place after the minion's keywords (ruling Jan 17, 2026 (3) answer 2).
 */

import { flat, type AbilityReference, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, AbilityTriggerSpec, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, DEFAULT_DECK, giveCard, newGame, withEncounterPiles } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const one = { kind: "const", value: 1 } as const;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const abilities: StubAbility[] = [];
const ability = (id: string, definition: AbilityDefinition): AbilityReference => {
  const stub = stubAbility(id, definition);
  abilities.push(stub);
  return stub.ref;
};
/** A counter on the main scheme: every mark lands on one card, so the log orders them. */
const mark = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "each", query: { categories: ["mainScheme"] } },
  counterType,
  amount: one,
});
const youEngage: Extract<AbilityTriggerSpec, { kind: "response" }>["on"] = {
  on: "minionEngaged",
  playerIs: "controller",
};

const VILLAIN = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(50), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

/** Forced interrupt and forced response to "you engage a minion". */
const BOTH_WAYS = stubSupport({
  id: "both-ways",
  cost: 0,
  abilities: [
    ability("both-ways.interrupt", {
      trigger: { kind: "interrupt", forced: true, on: youEngage },
      effects: [mark("before")],
    }),
    ability("both-ways.response", {
      trigger: { kind: "response", forced: true, on: youEngage },
      effects: [mark("after")],
    }),
  ],
});
/** An optional "Hero Interrupt: When you engage a minion" (Anticipation's shape). */
const ANTICIPATE = stubSupport({
  id: "anticipate",
  cost: 0,
  abilities: [
    ability("anticipate.interrupt", {
      trigger: { kind: "interrupt", forced: false, on: youEngage },
      effects: [mark("ready")],
    }),
  ],
});
/** A quickstrike minion whose When Revealed leaves a mark. */
const SENTRY = stubMinion({
  id: "sentry",
  atk: 1,
  sch: 0,
  hp: 5,
  boostIcons: 0,
  keywords: [{ name: "quickstrike" }],
  abilities: [ability("sentry.when-revealed", { trigger: { kind: "whenRevealed" }, effects: [mark("revealed")] })],
});
/** Get Over Here!: "engage that enemy". */
const PULL_ABILITY = stubAbility("pull.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "chooseTarget", slot: "minion", query: { categories: ["minion"] }, chooser: { kind: "controller" } },
    { kind: "engage", minion: { kind: "slot", slot: "minion" }, player: { kind: "controller" } },
  ],
});
abilities.push(PULL_ABILITY);
const PULL = stubEvent({ id: "pull", cost: 0, abilities: [PULL_ABILITY.ref] });

const PLAYER_CARDS: readonly AnyCard[] = [BOTH_WAYS, ANTICIPATE, PULL];
const deps: EngineDeps = depsOf(...abilities);

function game(players = 1): GameState {
  const start = newGame({
    players,
    villain: VILLAIN,
    mainScheme: SCHEME,
    deps,
    extraCards: [...PLAYER_CARDS, SENTRY, BLANK],
    encounterDeck: [SENTRY.id, ...copies(BLANK.id, 15)],
    deck: [...DEFAULT_DECK, ...PLAYER_CARDS.flatMap((card) => copies(card.id, 2))],
  });
  // Test surgery: the sentry second from the top of the encounter deck, under the villain's boost card, so p1's first
  // villain phase reveals it.
  const deck = activeEncounterDeck(start).deck;
  const sentry = deck.find((id) => start.instances[id]?.cardId === SENTRY.id) as InstanceId;
  const [boost, ...rest] = deck.filter((id) => id !== sentry);
  return withEncounterPiles(start, { deck: [boost as InstanceId, sentry, ...rest] });
}

function play(state: GameState, card: AnyCard, player: PlayerId = p1) {
  const given = giveCard(state, player, card.id);
  return runCommands(given.state, deps, {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const marked = (events: readonly GameEvent[], counterType: string): number =>
  events.findIndex((e) => e.type === "counterAdded" && e.counterType === counterType);
const sentryIn = (state: GameState): InstanceId =>
  mustPlayer(state, p1).playArea.find((id) => state.instances[id]?.cardId === SENTRY.id) as InstanceId;

describe("interrupts to a minion engaging a player", () => {
  it("a revealed minion: the interrupt resolves before its When Revealed and quickstrike; the response after both", () => {
    const watching = play(game(), BOTH_WAYS).state;
    const { state, events } = runCommands(runCommands(watching, deps, toHero).state, deps, endTurn);
    const scheme = mustInstance(state, state.mainScheme.instanceId);
    expect(scheme.counters.before).toBe(1);
    expect(scheme.counters.after).toBe(1);
    const quickstrike = events.findIndex(
      (e) =>
        e.type === "triggerEvent" &&
        e.phase === "initiated" &&
        e.event.kind === "enemyAttack" &&
        state.instances[e.event.enemyInstanceId]?.cardId === SENTRY.id,
    );
    expect(marked(events, "before")).toBeGreaterThanOrEqual(0);
    expect(marked(events, "before")).toBeLessThan(marked(events, "revealed"));
    expect(marked(events, "before")).toBeLessThan(quickstrike);
    expect(marked(events, "after")).toBeGreaterThan(quickstrike);
    expect(mustInstance(state, sentryIn(state)).engagedWith).toBe(p1);
  });

  it("is offered in the minion's enters-play interrupt window (one window per occurrence), under its plain option id", () => {
    const watching = play(game(), ANTICIPATE);
    const anticipate = mustPlayer(watching.state, p1).playArea.find(
      (id) => watching.state.instances[id]?.cardId === ANTICIPATE.id,
    ) as InstanceId;
    const offered: string[][] = [];
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseTriggers" && choice.prompt.timing === "interrupt") {
        expect(choice.prompt.event.kind).toBe("cardEntersPlay");
        offered.push(choice.options.map((o) => o.optionId));
        return choice.options.map((o) => o.optionId);
      }
      return defaultPick(state);
    };
    const { state } = runCommandsPicking(runCommands(watching.state, deps, toHero).state, deps, pick, endTurn);
    expect(offered).toEqual([[`${anticipate}:anticipate.interrupt`]]);
    expect(mustInstance(state, state.mainScheme.instanceId).counters.ready).toBe(1);
  });

  it("'engage that enemy' on a minion already in play: one engagement event, interrupt then response", () => {
    const start = play(game(2), BOTH_WAYS).state;
    // Test surgery: the sentry in play, engaged with p2.
    const deck = activeEncounterDeck(start).deck;
    const sentry = deck.find((id) => start.instances[id]?.cardId === SENTRY.id) as InstanceId;
    const engagedWithP2: GameState = {
      ...withEncounterPiles(start, { deck: deck.filter((id) => id !== sentry) }),
      players: start.players.map((p) => (p.playerId === p2 ? { ...p, playArea: [...p.playArea, sentry] } : p)),
      instances: {
        ...start.instances,
        [sentry]: { ...mustInstance(start, sentry), faceup: true, engagedWith: p2, controllerId: null },
      },
    };
    const { state, events } = play(engagedWithP2, PULL);
    expect(mustInstance(state, sentry).engagedWith).toBe(p1);
    const scheme = mustInstance(state, state.mainScheme.instanceId);
    expect(scheme.counters.before).toBe(1);
    expect(scheme.counters.after).toBe(1);
    expect(marked(events, "before")).toBeLessThan(marked(events, "after"));
    const engagement = events.filter((e) => e.type === "triggerEvent" && e.event.kind === "minionEngaged");
    expect(engagement.map((e) => (e.type === "triggerEvent" ? e.phase : null))).toEqual(["initiated", "resolved"]);
  });

  it("with nothing listening, no engagement event goes on the stack", () => {
    const { events } = runCommands(runCommands(game(), deps, toHero).state, deps, endTurn);
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "minionEngaged")).toBe(false);
  });
});
