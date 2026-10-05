/**
 * docs/phase7-wave7.md §3.12: what advanced the main scheme. A stage that asks "If the previous stage was advanced by
 * knock counters, …" needs the cause of the advance that revealed it. `MainSchemeState.advancedBy` records it on every
 * advance: `completed` (RRG 1.8 "Main Scheme", p. 27: the stage reached its target threat, or a card completed it) or
 * `cardEffect` with the card whose ability advanced it. It is copied onto the `mainSchemeAdvanced` log and trigger
 * events and read by `Predicate mainSchemeAdvancedBy`.
 *
 * Synthetic scheme: stage 1 advances itself by its own text after the player phase ends, every later stage's When
 * Revealed marks the scheme with one counter per cause it reads, and stage 3's When Completed advances by card text
 * before the completion's own advance.
 */
import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { playerId } from "./ids.js";
import { mustInstance } from "./query.js";
import { evaluate } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, Predicate, TargetRef } from "./spec.js";
import type { GameState, MainSchemeAdvancedBy, MainSchemeState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCard, HERO, seatIdentities } from "./testing/scenario.js";

const p1 = playerId("p1");
const self: TargetRef = { kind: "self" };
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

const byCompletion: Predicate = { kind: "mainSchemeAdvancedBy", cause: "completed" };
const byAnyCard: Predicate = { kind: "mainSchemeAdvancedBy", cause: "cardEffect" };
const byItself: Predicate = { kind: "mainSchemeAdvancedBy", cause: "cardEffect", source: self };
const mark = (condition: Predicate, counterType: string): EffectSpec => ({
  kind: "if",
  condition,
  then: [{ kind: "addCounters", target: self, counterType, amount: { kind: "const", value: 1 } }],
});

/** "Forced Response: After the player phase ends, advance to the next stage." The scheme's own text, not a completion. */
const KNOCK = stubAbility("knock.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "phaseEnding", eventIs: { phase: "player" } } },
  effects: [{ kind: "advanceMainScheme" }],
});
/** "When Revealed: If the previous stage was advanced by [its own text / any card / its completion], …" */
const REVEALED = stubAbility("stage.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [mark(byItself, "byItself"), mark(byAnyCard, "byCard"), mark(byCompletion, "byCompletion")],
});
/** "When Completed: Advance to the next stage." Card text, resolved before the completion's own advance. */
const COMPLETED_ADVANCE = stubAbility("stage.when-completed", {
  trigger: { kind: "whenCompleted" },
  effects: [{ kind: "advanceMainScheme" }],
});

const eventCard = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const ADVANCE = eventCard("advance-card", [{ kind: "advanceMainScheme" }]);
const PLOT = eventCard("plot-card", [
  { kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 3 } },
]);
const COMPLETE = eventCard("complete-card", [{ kind: "completeMainScheme", scheme: { kind: "mainScheme" } }]);

const later = { startingThreat: flat(1), targetThreat: flat(3), acceleration: flat(0), aSideAbilities: [REVEALED.ref] };
/** Five stages: 1 knocks itself forward, 2–5 read the cause, 3 advances from its When Completed, 5 is the last. */
const SIEGE = stubMainScheme({
  id: "siege",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(3), acceleration: flat(0), abilities: [KNOCK.ref] },
    later,
    { ...later, abilities: [COMPLETED_ADVANCE.ref] },
    later,
    { ...later, targetThreat: flat(99) },
  ],
});

/** A second scheme in the shared area: stage 1 puts stage 2 into play beside it; four stages so both can advance. */
const SETUP_SECOND = stubAbility("pair.setup", {
  trigger: { kind: "setup" },
  effects: [{ kind: "putMainSchemeStageIntoPlay", stageNumber: 2 }],
});
const PAIR = stubMainScheme({
  id: "pair",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [SETUP_SECOND.ref] },
    { startingThreat: flat(0), targetThreat: flat(3), acceleration: flat(0) },
    { ...later, targetThreat: flat(99) },
    { ...later, targetThreat: flat(99) },
  ],
});
const central: TargetRef = { kind: "mainScheme", of: "central" };
const ADVANCE_CENTRAL = eventCard("advance-central", [
  { kind: "advanceMainScheme", scheme: central, to: { stageNumber: 4 } },
]);
const PLOT_OTHER = eventCard("plot-other", [
  {
    kind: "placeThreat",
    target: { kind: "each", query: { categories: ["mainScheme"], excluding: central } },
    amount: { kind: "const", value: 3 },
  },
]);

const EVENTS = [ADVANCE, PLOT, COMPLETE, ADVANCE_CENTRAL, PLOT_OTHER];
const ABILITIES: readonly StubAbility[] = [
  KNOCK,
  REVEALED,
  COMPLETED_ADVANCE,
  SETUP_SECOND,
  ...EVENTS.map((e) => e.ability),
];
const deps: EngineDeps = depsOf(...ABILITIES);

function game(scheme = SIEGE) {
  const identities = seatIdentities(HERO, 1);
  const result = createGame(
    {
      seed: 5,
      cards: [QUIET_VILLAIN, scheme, BLANK, ...EVENTS.map((e) => e.card), ...identities],
      villainCardId: QUIET_VILLAIN.id,
      mainSchemeCardId: scheme.id,
      encounterDeck: Array.from({ length: 16 }, () => BLANK.id as CardId),
      includeIdentitySets: false,
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: EVENTS.flatMap((e) => [e.card.id, e.card.id, e.card.id]),
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps);
}

/** Plays a free event from hand; also returns the played card's instance id (the source of its ability). */
function play(state: GameState, card: { readonly card: { readonly id: CardId } }) {
  const given = giveCard(state, p1, card.card.id);
  const run = runCommands(given.state, deps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
  return { ...run, playedId: given.id };
}

const counters = (state: GameState, scheme: MainSchemeState = state.mainScheme) => {
  const held = mustInstance(state, scheme.instanceId).counters;
  return { byItself: held.byItself ?? 0, byCard: held.byCard ?? 0, byCompletion: held.byCompletion ?? 0 };
};
const advances = (events: readonly GameEvent[]) =>
  events.filter((event) => event.type === "mainSchemeAdvanced" || event.type === "mainSchemeCompleted");
const COMPLETED: MainSchemeAdvancedBy = { cause: "completed", sourceInstanceId: null };
const byCard = (sourceInstanceId: InstanceId): MainSchemeAdvancedBy => ({ cause: "cardEffect", sourceInstanceId });
/** The predicate as the scheme's own ability would read it. */
const reads = (state: GameState, predicate: Predicate, scheme: MainSchemeState = state.mainScheme): boolean =>
  evaluate(state, predicate, {
    selfInstanceId: scheme.instanceId,
    controllerId: null,
    event: null,
    bindings: {},
    deps,
  });

describe("§3.12 what advanced the main scheme", () => {
  it("a scheme that has not advanced records no cause, and the predicate is false for every cause", () => {
    const { state } = game();
    expect(state.mainScheme.stageIndex).toBe(0);
    expect("advancedBy" in state.mainScheme).toBe(false);
    expect([byCompletion, byAnyCard, byItself].map((predicate) => reads(state, predicate))).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("threat reaching the target: cause `completed`, no source, on the state and on the log event", () => {
    const { state, events } = play(game().state, PLOT);
    expect(state.mainScheme.stageIndex).toBe(1);
    expect(state.mainScheme.advancedBy).toEqual(COMPLETED);
    expect(advances(events)).toEqual([
      { type: "mainSchemeCompleted", stageIndex: 0 },
      { type: "mainSchemeAdvanced", stageIndex: 1, advancedBy: COMPLETED },
    ]);
    // The new stage's When Revealed read it: only the completion branch applied its effect.
    expect(counters(state)).toEqual({ byItself: 0, byCard: 0, byCompletion: 1 });
  });

  it("a card that completes the stage (`completeMainScheme`) is a completion too, not that card's advance", () => {
    const { state, events } = play(game().state, COMPLETE);
    expect(state.mainScheme.stageIndex).toBe(1);
    expect(state.mainScheme.advancedBy).toEqual(COMPLETED);
    expect(advances(events).at(-1)).toEqual({ type: "mainSchemeAdvanced", stageIndex: 1, advancedBy: COMPLETED });
    expect(counters(state)).toEqual({ byItself: 0, byCard: 0, byCompletion: 1 });
  });

  it("another card's `advanceMainScheme`: cause `cardEffect` with that card as the source", () => {
    const { state, events, playedId } = play(game().state, ADVANCE);
    expect(state.mainScheme.stageIndex).toBe(1);
    expect(state.mainScheme.advancedBy).toEqual(byCard(playedId));
    expect(advances(events)).toEqual([{ type: "mainSchemeAdvanced", stageIndex: 1, advancedBy: byCard(playedId) }]);
    // A card advanced it, but not the scheme's own text: `source: self` is false, the unsourced read true.
    expect(counters(state)).toEqual({ byItself: 0, byCard: 1, byCompletion: 0 });
    expect(reads(state, { kind: "mainSchemeAdvancedBy", cause: "cardEffect", source: self })).toBe(false);
  });

  it("the scheme's own text: cause `cardEffect` with the scheme as the source, and only then does 2A's effect apply", () => {
    const { state, events } = runCommands(game().state, deps, { type: "endTurn", playerId: p1 });
    const schemeId = state.mainScheme.instanceId;
    expect(state.mainScheme.stageIndex).toBe(1);
    expect(state.mainScheme.advancedBy).toEqual(byCard(schemeId));
    expect(advances(events)).toEqual([{ type: "mainSchemeAdvanced", stageIndex: 1, advancedBy: byCard(schemeId) }]);
    expect(counters(state)).toEqual({ byItself: 1, byCard: 1, byCompletion: 0 });
  });

  it("the trigger event carries the same cause as the log event", () => {
    const { events, playedId } = play(game().state, ADVANCE);
    const heard = events.flatMap((event) =>
      event.type === "triggerEvent" && event.event.kind === "mainSchemeAdvanced" ? [event] : [],
    );
    expect(heard.map((event) => [event.phase, event.event])).toEqual([
      ["resolved", { kind: "mainSchemeAdvanced", stageIndex: 1, advancedBy: byCard(playedId) }],
    ]);
  });

  it("the next advance replaces the cause; nothing accumulates", () => {
    const first = play(game().state, ADVANCE);
    expect(first.state.mainScheme.advancedBy).toEqual(byCard(first.playedId));
    const second = play(first.state, PLOT);
    expect(second.state.mainScheme.stageIndex).toBe(2);
    expect(second.state.mainScheme.advancedBy).toEqual(COMPLETED);
    // One counter per stage revealed: stage 2 read the card, stage 3 the completion.
    expect(counters(second.state)).toEqual({ byItself: 0, byCard: 1, byCompletion: 1 });
  });

  it("a When Completed that advances, then the completion's own advance: each stage reads its own, the last one stays", () => {
    const atThree = play(play(game().state, ADVANCE).state, ADVANCE).state;
    expect(atThree.mainScheme.stageIndex).toBe(2);
    expect(counters(atThree)).toEqual({ byItself: 0, byCard: 2, byCompletion: 0 });
    const { state, events } = play(atThree, PLOT);
    const schemeId = state.mainScheme.instanceId;
    expect(advances(events)).toEqual([
      { type: "mainSchemeCompleted", stageIndex: 2 },
      { type: "mainSchemeAdvanced", stageIndex: 3, advancedBy: byCard(schemeId) },
      { type: "mainSchemeAdvanced", stageIndex: 4, advancedBy: COMPLETED },
    ]);
    expect(state.mainScheme.stageIndex).toBe(4);
    expect(state.mainScheme.advancedBy).toEqual(COMPLETED);
    // Stage 4 was revealed by the scheme's own When Completed (+1 byItself, +1 byCard); stage 5 by the completion.
    expect(counters(state)).toEqual({ byItself: 1, byCard: 3, byCompletion: 1 });
  });

  it("two main schemes in play each keep their own cause", () => {
    const start = game(PAIR).state;
    const [other] = start.extraMainSchemes ?? [];
    if (!other) throw new Error("no second main scheme");
    expect(start.mainScheme.stageIndex).toBe(0);
    expect(other.stageIndex).toBe(1);

    const plotted = play(start, PLOT_OTHER);
    const [afterPlot] = plotted.state.extraMainSchemes ?? [];
    expect(afterPlot).toMatchObject({ instanceId: other.instanceId, stageIndex: 2, advancedBy: COMPLETED });
    expect("advancedBy" in plotted.state.mainScheme).toBe(false);
    expect(advances(plotted.events).at(-1)).toEqual({
      type: "mainSchemeAdvanced",
      stageIndex: 2,
      schemeInstanceId: other.instanceId,
      advancedBy: COMPLETED,
    });

    const { state, playedId } = play(plotted.state, ADVANCE_CENTRAL);
    const [afterBoth] = state.extraMainSchemes ?? [];
    if (!afterBoth) throw new Error("no second main scheme");
    expect(state.mainScheme).toMatchObject({ stageIndex: 3, advancedBy: byCard(playedId) });
    expect(afterBoth.advancedBy).toEqual(COMPLETED);
    // Each stage's When Revealed read its own scheme's cause, not the other's.
    expect(counters(state)).toEqual({ byItself: 0, byCard: 1, byCompletion: 0 });
    expect(counters(state, afterBoth)).toEqual({ byItself: 0, byCard: 0, byCompletion: 1 });
    expect(reads(state, byCompletion)).toBe(false);
    expect(reads(state, byCompletion, afterBoth)).toBe(true);
  });

  it("the cause is plain data: it survives a JSON round trip and a replay of the log", () => {
    let { state, session } = game();
    for (const card of [ADVANCE, ADVANCE, PLOT]) {
      ({ state, session } = play(state, card));
      const replayed = replay(session.log, deps);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(state);
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    }
    expect(state.mainScheme.advancedBy).toEqual(COMPLETED);
  });

  it("a game saved before the field existed loads: the cause reads as unknown until the next advance records one", () => {
    const saved = play(game().state, ADVANCE).state;
    const { advancedBy: _dropped, ...oldScheme } = saved.mainScheme;
    const old: GameState = JSON.parse(JSON.stringify({ ...saved, mainScheme: oldScheme }));
    expect("advancedBy" in old.mainScheme).toBe(false);
    expect([byCompletion, byAnyCard, byItself].map((predicate) => reads(old, predicate))).toEqual([
      false,
      false,
      false,
    ]);
    const { state } = play(old, PLOT);
    expect(state.mainScheme.stageIndex).toBe(2);
    expect(state.mainScheme.advancedBy).toEqual(COMPLETED);
  });
});
