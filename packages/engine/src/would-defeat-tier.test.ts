/**
 * `trigger.would` on interrupts to a defeat (docs/phase7-wave7.md §4.1, owner ruling 2026-10-06): a genuine "would be
 * defeated" replacement has the same earlier tier as "would attack" (`would-interrupt-tier.test.ts`).
 *
 * RRG 1.8 "'Would'" (p. 48) gives a defeat as its own example: the word "establishes a higher timing priority … than
 * interrupts to the same triggering condition without the word 'would'", and once such an interrupt "changes the
 * nature of that which is about to occur (such as through a replacement effect), no further interrupts to the original
 * trigger may be used". So "When attached minion would be defeated, … instead" resolves before "When attached minion is
 * defeated, …" is gathered, the first player is never asked to order one against the other, and a replaced defeat never
 * reaches the second. Proven with synthetic cards on a minion's defeat (the sweep's grouped window) and on an
 * identity's (its own event frame).
 */

import { flat, type AbilityReference, type AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import {
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_DECK, defaultPick, giveCard, newGame } from "./testing/scenario.js";

const p1 = playerId("p1");

const abilities: StubAbility[] = [];
const ability = (id: string, definition: AbilityDefinition): AbilityReference => {
  const stub = stubAbility(id, definition);
  abilities.push(stub);
  return stub.ref;
};
/** A mark on the main scheme, so the state as well as the log shows what resolved. */
const mark = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "each", query: { categories: ["mainScheme"] } },
  counterType,
  amount: { kind: "const", value: 1 },
});
const hostDefeated: EventPattern = { on: "characterDefeated", targetIs: { hostOfSelf: true } };
const identityDefeated: EventPattern = { on: "characterDefeated", targetIs: { categories: ["identity"] } };
const healHost: EffectSpec = { kind: "heal", target: { kind: "host" }, amount: { kind: "const", value: 99 } };

const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 3, boostIcons: 0 });

/** An upgrade that attaches to a minion, with one interrupt to its host's defeat. */
const onMinion = (id: string, trigger: { forced: boolean; would?: true }, effects: readonly EffectSpec[]): AnyCard => ({
  ...stubUpgrade({
    id,
    cost: 0,
    abilities: [ability(`${id}.interrupt`, { trigger: { kind: "interrupt", on: hostDefeated, ...trigger }, effects })],
  }),
  attachesTo: { kind: "minion" },
});

/** "Forced Interrupt: When attached minion would be defeated, heal all damage from it instead." */
const SAVER = onMinion("saver", { forced: true, would: true }, [
  { kind: "replaceTriggeringEvent", with: [healHost, mark("saved")] },
]);
/** "Interrupt: When attached minion would be defeated, heal all damage from it instead." Optional. */
const HELMET = onMinion("helmet", { forced: false, would: true }, [
  { kind: "replaceTriggeringEvent", with: [healHost, mark("saved")] },
]);
/** "Forced Interrupt: When attached minion would be defeated, [mark]." It replaces nothing. */
const WATCHER = onMinion("watcher", { forced: true, would: true }, [mark("watched")]);
/** The same replacement as `SAVER` without the marker: one tier with "is defeated", as before the marker existed. */
const UNMARKED = onMinion("unmarked", { forced: true }, [
  { kind: "replaceTriggeringEvent", with: [healHost, mark("saved")] },
]);
/** "Forced Interrupt: When attached minion is defeated, [mark]." The ordinary wording. */
const TRACER = onMinion("tracer", { forced: true }, [mark("fell")]);
/** "Interrupt: When attached minion is defeated, [mark]." Optional. */
const TARGET = onMinion("target", { forced: false }, [mark("claimed")]);

/** "Hero Action (attack): Deal 3 damage to a minion." */
const BLAST = stubEvent({
  id: "blast",
  cost: 0,
  abilities: [
    ability("blast", {
      trigger: { kind: "action" },
      label: ["attack"],
      effects: [
        { kind: "chooseTarget", slot: "m", chooser: { kind: "controller" }, query: { categories: ["minion"] } },
        { kind: "attack", target: { kind: "slot", slot: "m" }, amount: { kind: "const", value: 3 } },
      ],
    }),
  ],
});

/** "Forced Interrupt: When you would be defeated, set your hit point dial to 1 instead." */
const SECOND_WIND = stubSupport({
  id: "second-wind",
  cost: 0,
  abilities: [
    ability("second-wind.would", {
      trigger: { kind: "interrupt", forced: true, would: true, on: identityDefeated },
      effects: [
        {
          kind: "replaceTriggeringEvent",
          with: [
            {
              kind: "setRemainingHitPoints",
              target: { kind: "each", query: { categories: ["identity"] } },
              amount: { kind: "const", value: 1 },
            },
            mark("saved"),
          ],
        },
      ],
    }),
  ],
});
/** "Forced Interrupt: When your hero is defeated, [mark]." */
const LAST_WORDS = stubSupport({
  id: "last-words",
  cost: 0,
  abilities: [
    ability("last-words.interrupt", {
      trigger: { kind: "interrupt", forced: true, on: identityDefeated },
      effects: [mark("fell")],
    }),
  ],
});

const deps: EngineDeps = depsOf(...abilities);
const UPGRADES: readonly AnyCard[] = [SAVER, HELMET, WATCHER, UNMARKED, TRACER, TARGET];
const SUPPORTS: readonly AnyCard[] = [SECOND_WIND, LAST_WORDS];
const PLAYER_CARDS: readonly AnyCard[] = [...UPGRADES, ...SUPPORTS, BLAST];

type Prompt = { readonly kind: string; readonly labels: readonly string[] };
type Choose = (kind: string, optionIds: readonly string[]) => readonly string[];

/** Runs `commands`, answering each trigger prompt through `choose` and every other prompt with the default. */
function drive(state: GameState, commands: readonly Command[], choose: Choose) {
  const prompts: Prompt[] = [];
  const pick = (now: GameState): readonly string[] => {
    const choice = now.pendingChoice;
    if (!choice || (choice.prompt.kind !== "orderTriggers" && choice.prompt.kind !== "chooseTriggers"))
      return defaultPick(now);
    prompts.push({ kind: choice.prompt.kind, labels: choice.options.map((option) => option.label) });
    return choose(
      choice.prompt.kind,
      choice.options.map((option) => option.optionId),
    );
  };
  return { ...runCommandsPicking(state, deps, pick, ...commands), prompts };
}

const play = (cardInstanceId: InstanceId, attachToInstanceId: InstanceId | null = null): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId,
  payment: [],
  attachToInstanceId,
});
const thugsIn = (state: GameState): readonly InstanceId[] =>
  mustPlayer(state, p1).playArea.filter((id) => state.instances[id]?.cardId === THUG.id);

/**
 * A minion engaged with the player (dealt in the first villain phase), `attached` played onto it in round two, then 3
 * damage to it: its defeat. Returns the trigger prompts asked from the first upgrade on.
 */
function minionDefeat(attached: readonly AnyCard[], choose: Choose = (_kind, ids) => ids) {
  const opened = newGame({
    villain: stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 0, sch: 0 }] }),
    mainScheme: SCHEME,
    deps,
    extraCards: [BLANK, THUG, ...PLAYER_CARDS],
    encounterDeck: Array.from({ length: 12 }, () => THUG.id),
    deck: [...DEFAULT_DECK, ...PLAYER_CARDS.map((card) => card.id)],
  });
  let state = runCommandsPicking(opened, deps, defaultPick, { type: "endTurn", playerId: p1 }).state;
  const [thug] = thugsIn(state) as [InstanceId];
  const commands: Command[] = [{ type: "changeForm", playerId: p1 }];
  for (const card of [...attached, BLAST]) {
    const given = giveCard(state, p1, card.id);
    state = given.state;
    commands.push(play(given.id, card === BLAST ? null : thug));
  }
  return { ...drive(state, commands, choose), thug };
}

/** The player's hero attacked for 99 by the villain with `inPlay` played: its defeat. */
function identityDefeat(inPlay: readonly AnyCard[]) {
  let state = newGame({
    villain: stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 99, sch: 0 }] }),
    mainScheme: SCHEME,
    deps,
    extraCards: [BLANK, THUG, ...PLAYER_CARDS],
    encounterDeck: Array.from({ length: 12 }, () => BLANK.id),
    deck: [...DEFAULT_DECK, ...PLAYER_CARDS.map((card) => card.id)],
  });
  const commands: Command[] = [{ type: "changeForm", playerId: p1 }];
  for (const card of inPlay) {
    const given = giveCard(state, p1, card.id);
    state = given.state;
    commands.push(play(given.id));
  }
  commands.push({ type: "endTurn", playerId: p1 });
  return drive(state, commands, (_kind, ids) => ids);
}

const resolved = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "abilityResolved" && String(e.abilityId) !== "blast" ? [String(e.abilityId)] : []));
const counters = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).counters;
const defeatWindows = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "windowOpened" && e.timing === "interrupt" && e.event.kind === "characterDefeated"
      ? [{ would: e.would === true, abilities: e.candidates.map((c) => String(c.abilityId)) }]
      : [],
  );
const expectReplays = (session: ReturnType<typeof drive>["session"]) => {
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
};

describe("RRG 1.8 'Would' (p. 48): a 'would be defeated' interrupt resolves before the 'is defeated' interrupts are gathered", () => {
  it("a 'would be defeated' replacement and a forced 'is defeated' interrupt: no ordering prompt, the second never used", () => {
    const { state, events, prompts, session, thug } = minionDefeat([SAVER, TRACER]);
    expect(prompts).toEqual([]);
    expect(resolved(events)).toEqual(["saver.interrupt"]);
    expect(defeatWindows(events)).toEqual([{ would: true, abilities: ["saver.interrupt"] }]);
    expect(counters(state).saved).toBe(1);
    expect(counters(state).fell).toBeUndefined();
    expect(thugsIn(state)).toContain(thug);
    expect(mustInstance(state, thug).damage).toBe(0);
    expectReplays(session);
  });

  it("without the marker the two share a tier and the first player orders them (the marker is what separates them)", () => {
    const { prompts } = minionDefeat([UNMARKED, TRACER]);
    expect(prompts).toEqual([{ kind: "orderTriggers", labels: expect.arrayContaining(["tracer", "unmarked"]) }]);
    expect(prompts[0]?.labels).toHaveLength(2);
  });

  it("the defeat not replaced: the 'would' interrupt resolves first, then the 'is defeated' tier opens and the minion falls", () => {
    const { state, events, prompts, session, thug } = minionDefeat([WATCHER, TRACER]);
    expect(prompts).toEqual([]);
    expect(resolved(events)).toEqual(["watcher.interrupt", "tracer.interrupt"]);
    expect(defeatWindows(events)).toEqual([
      { would: true, abilities: ["watcher.interrupt"] },
      { would: false, abilities: ["tracer.interrupt"] },
    ]);
    expect(counters(state)).toMatchObject({ watched: 1, fell: 1 });
    expect(thugsIn(state)).not.toContain(thug);
    expectReplays(session);
  });

  it("an optional 'is defeated' interrupt is not offered for a defeat a 'would' interrupt replaced", () => {
    const { state, events, prompts, thug } = minionDefeat([SAVER, TARGET]);
    expect(prompts).toEqual([]);
    expect(resolved(events)).toEqual(["saver.interrupt"]);
    expect(counters(state).claimed).toBeUndefined();
    expect(thugsIn(state)).toContain(thug);
  });

  it("an optional 'would be defeated' replacement is offered alone, before the forced 'is defeated' interrupt; used, it preempts it", () => {
    const { state, events, prompts, session, thug } = minionDefeat([HELMET, TRACER]);
    expect(prompts).toEqual([{ kind: "chooseTriggers", labels: ["helmet"] }]);
    expect(resolved(events)).toEqual(["helmet.interrupt"]);
    expect(counters(state).fell).toBeUndefined();
    expect(thugsIn(state)).toContain(thug);
    expectReplays(session);
  });

  it("an optional 'would be defeated' replacement declined: the 'is defeated' tier opens and the minion falls", () => {
    const { state, events, prompts, session, thug } = minionDefeat([HELMET, TRACER], () => []);
    expect(prompts).toEqual([{ kind: "chooseTriggers", labels: ["helmet"] }]);
    expect(resolved(events)).toEqual(["tracer.interrupt"]);
    expect(counters(state)).toMatchObject({ fell: 1 });
    expect(counters(state).saved).toBeUndefined();
    expect(thugsIn(state)).not.toContain(thug);
    expectReplays(session);
  });

  it("a defeat no 'would' interrupt answers opens the one ordinary window, unchanged", () => {
    const { events, prompts, session } = minionDefeat([TRACER]);
    expect(prompts).toEqual([]);
    expect(defeatWindows(events)).toEqual([{ would: false, abilities: ["tracer.interrupt"] }]);
    expectReplays(session);
  });

  it("a hero's own 'would be defeated' replacement precedes 'when your hero is defeated': no prompt, the hero stays in", () => {
    const { state, events, prompts, session } = identityDefeat([SECOND_WIND, LAST_WORDS]);
    expect(prompts).toEqual([]);
    expect(resolved(events)).toEqual(["second-wind.would"]);
    expect(defeatWindows(events)).toEqual([{ would: true, abilities: ["second-wind.would"] }]);
    expect(counters(state).fell).toBeUndefined();
    expect(state.outcome).toBeNull();
    const identity = mustInstance(state, mustPlayer(state, p1).identity.instanceId);
    expect(identity.damage).toBe(9);
    expectReplays(session);
  });

  it("with no replacement the 'is defeated' interrupt resolves and the hero is defeated", () => {
    const { state, events, prompts } = identityDefeat([LAST_WORDS]);
    expect(prompts).toEqual([]);
    expect(resolved(events)).toEqual(["last-words.interrupt"]);
    expect(counters(state).fell).toBe(1);
    expect(state.outcome).not.toBeNull();
  });
});
