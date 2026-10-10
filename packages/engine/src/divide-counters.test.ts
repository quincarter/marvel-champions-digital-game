/**
 * docs/phase7-wave9.md §3.27: "Remove N counters from among" several cards (`EffectSpec divide` with `what: { counters
 * }`, `mode: "remove"`) and "the [card] with the fewest / most counters" (`TargetRef superlative` measured by
 * `ValueSpec counters`). Synthetic cards shaped like the Executive Board's Board Member environments (`aos`), whose
 * text defines secret counters: "Remove 3 secret counters from among Board Member environments" (Baron Zemo 50165a),
 * "place 1 secret counter on the Board Member environment with the fewest secret counters" (50170).
 *
 * Sources: RRG 1.8 "First Player" (p. 19: "If an encounter card targets a specific player or card, and there are
 * multiple eligible targets, the first player selects among the eligible options"; a choice an encounter card "does
 * not specify which player should act" is the first player's), "Target" (p. 43: a target is valid "if any part of that
 * ability can affect that target"), "All-Purpose Counter" (p. 6: an ability that refers to an all-purpose counter "can
 * refer to any all-purpose counter, regardless of what other types that counter might have"), "Uses" (p. 46). The RRG
 * has no entry for "among" or "divided"; the split follows `divide`'s healing ("heal 3 damage from among").
 */

import type { CardId, EnvironmentCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { PendingChoice } from "./choices.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, PlayerRef, TargetQuery, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const you: PlayerRef = { kind: "controller" };
const firstPlayer: PlayerRef = { kind: "firstPlayer" };
const BOARD: TargetQuery = { categories: ["environment"], trait: "BOARD MEMBER" as never };
const tally: TargetRef = { kind: "each", query: { categories: ["support"], name: "tally" } };

const removeAmong = (
  counterType: string,
  amount: number,
  chooser: PlayerRef,
  more: Partial<Extract<EffectSpec, { kind: "divide" }>> = {},
): EffectSpec => ({
  kind: "divide",
  what: { counters: counterType },
  mode: "remove",
  amount: n(amount),
  among: BOARD,
  chooser,
  ...more,
});
/** "The Board Member environment with the fewest / most [type] counters", every tied card. */
const extreme = (order: "highest" | "lowest", counterType: string): TargetRef => ({
  kind: "superlative",
  among: { kind: "each", query: BOARD },
  order,
  measure: { kind: "counters", of: { kind: "slot", slot: "candidate" }, counterType },
});
/** "Place `amount` secret counters on the Board Member environment with the fewest / most [type] counters." */
const placeOnExtreme = (order: "highest" | "lowest", counterType: string, chooser: PlayerRef, amount = 1) =>
  [
    { kind: "bindTargets", slot: "tied", target: extreme(order, counterType) },
    { kind: "chooseTarget", slot: "board", query: { inSlot: "tied" }, chooser },
    { kind: "addCounters", target: { kind: "slot", slot: "board" }, counterType: "allPurpose", amount: n(amount) },
  ] as const satisfies readonly EffectSpec[];

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const revealed = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.when-revealed`, { trigger: { kind: "whenRevealed" }, effects });
  return { card: stubTreachery({ id, boostIcons: 0, abilities: [ability.ref] }), ability };
};

/** A player card: "Remove 3 secret counters from among Board Member environments", the number removed tallied. */
const EXPOSE = action("expose", [
  removeAmong("secret", 3, you, { bind: "gone" }),
  { kind: "addCounters", target: tally, counterType: "gone", amount: { kind: "var", name: "gone.amount" } },
]);
const EXPOSE_UP_TO = action("expose-up-to", [removeAmong("secret", 3, you, { upTo: true })]);
const EXPOSE_4 = action("expose-4", [removeAmong("secret", 4, you)]);
const EXPOSE_ANY = action("expose-any", [removeAmong("any", 3, you)]);
const TO_FEWEST = action("to-fewest", placeOnExtreme("lowest", "secret", you));
const TO_MOST = action("to-most", placeOnExtreme("highest", "secret", you));
const TO_FEWEST_ANY = action("to-fewest-any", placeOnExtreme("lowest", "any", you));
/** An encounter card: the same removal and the same placement, the first player's to decide. */
const PURGE = revealed("purge", [removeAmong("secret", 3, firstPlayer)]);
const LEAK = revealed("leak", placeOnExtreme("lowest", "secret", firstPlayer, 2));
const PLAYS = [EXPOSE, EXPOSE_UP_TO, EXPOSE_4, EXPOSE_ANY, TO_FEWEST, TO_MOST, TO_FEWEST_ANY];
const REVEALS = [PURGE, LEAK];

/** "Forced Response: After the last secret counter is removed from here, place 1 threat on the main scheme." */
const EMPTIED = stubAbility("board.emptied", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "countersRemoved", selfIs: "target", eventIs: { counterType: "secret" }, eventAtMost: { remaining: 0 } },
  },
  effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: n(1) }],
});

const board = (id: string, listens = false): EnvironmentCard => ({
  ...stubEnvironment({ id, traits: ["BOARD MEMBER" as never], abilities: listens ? [EMPTIED.ref] : [] }),
  definedCounterTypes: ["secret"],
});
const BOARDS = [board("board-a"), board("board-b"), board("board-c")];
const WATCHED = board("board-watched", true);
const TALLY = stubSupport({ id: "tally", cost: 0 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
/** A second blank, so two different boost cards can be stacked above a card (`onTopOfEncounterDeck` moves a copy). */
const BLANK_2 = stubTreachery({ id: "blank-2", boostIcons: 0 });

const deps: EngineDeps = depsOf(EMPTIED, ...[...PLAYS, ...REVEALS].map((e) => e.ability));

interface Table {
  readonly state: GameState;
  /** The Board Members in play, in the order given. */
  readonly ids: readonly InstanceId[];
  readonly tallyId: InstanceId;
}
/** Board Members in the villain's area holding the given counters, each `{ type: count }` or a secret count. */
function table(
  held: readonly (number | Readonly<Record<string, number>>)[],
  options: { readonly players?: 1 | 2; readonly watched?: boolean } = {},
): Table {
  const cards = options.watched ? [WATCHED, ...BOARDS.slice(1)] : BOARDS;
  let state = gameAtFirstTurn({
    cards: [...BOARDS, WATCHED, TALLY, BLANK, BLANK_2, ...[...PLAYS, ...REVEALS].map((e) => e.card)],
    deps,
    players: options.players ?? 1,
    encounter: [
      ...BOARDS.map((card) => card.id),
      WATCHED.id,
      ...REVEALS.map((e) => e.card.id),
      BLANK_2.id,
      TREACHERY.id,
      ...copiesOf(BLANK.id, 30),
    ],
    deck: [TALLY.id, ...PLAYS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  const ids: InstanceId[] = [];
  held.forEach((counters, index) => {
    const placed = encounterCardInVillainArea(state, cards[index]!.id);
    const instance = mustInstance(placed.state, placed.id);
    const stored = typeof counters === "number" ? (counters > 0 ? { secret: counters } : {}) : counters;
    state = {
      ...placed.state,
      instances: { ...placed.state.instances, [placed.id]: { ...instance, counters: stored } },
    };
    ids.push(placed.id);
  });
  const tallied = playerCardIntoPlay(state, TALLY.id);
  return { state: tallied.state, ids, tallyId: tallied.id };
}

type Pick = (state: GameState) => readonly string[];
const run = (state: GameState, pick: Pick, ...commands: readonly Command[]) =>
  runCommandsPicking(state, deps, pick, ...commands);
/** Plays `card` for free, answering each choice of `kind` with `answer` and recording what was asked. */
function play(
  state: GameState,
  card: { readonly card: { readonly id: CardId } },
  kind: PendingChoice["prompt"]["kind"] = "divide",
  answer?: readonly string[],
) {
  const asked: PendingChoice[] = [];
  const given = giveCard(state, P1, card.card.id);
  const result = run(
    given.state,
    (now) => {
      const choice = now.pendingChoice;
      if (choice?.prompt.kind !== kind) return defaultPick(now);
      asked.push(choice);
      return answer ?? defaultPick(now);
    },
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  );
  return { ...result, asked };
}
/**
 * Ends both turns with two blank boost cards, a blank for P1 and then `card` on top of the encounter deck: P2, who is
 * not the first player, is dealt `card` and reveals it.
 */
function reveal(
  state: GameState,
  card: { readonly card: { readonly id: CardId } },
  kind: PendingChoice["prompt"]["kind"],
  answer: (choice: PendingChoice) => readonly string[],
) {
  const asked: PendingChoice[] = [];
  const stacked = [card.card.id, TREACHERY.id, BLANK_2.id, BLANK.id].reduce(
    (deck, id) => onTopOfEncounterDeck(deck, id),
    state,
  );
  const result = run(
    stacked,
    (now) => {
      const choice = now.pendingChoice;
      if (choice?.prompt.kind !== kind) return defaultPick(now);
      asked.push(choice);
      return answer(choice);
    },
    { type: "endTurn", playerId: P1 },
    { type: "endTurn", playerId: P2 },
  );
  const dealtToP2 = result.events.some(
    (e) =>
      e.type === "cardMoved" && e.cardId === card.card.id && e.to.kind === "dealtEncounter" && e.to.playerId === P2,
  );
  expect(dealtToP2).toBe(true);
  return { ...result, asked };
}

const secrets = (state: GameState, ids: readonly InstanceId[]): readonly number[] =>
  ids.map((id) => mustInstance(state, id).counters.secret ?? 0);
const countersOf = (state: GameState, id: InstanceId) =>
  Object.fromEntries(Object.entries(mustInstance(state, id).counters).filter(([, count]) => count > 0));
const removals = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "counterRemoved" ? [[e.instanceId, e.counterType, e.amount] as const] : []));
const optionIds = (choice: PendingChoice | undefined): readonly string[] =>
  (choice?.options ?? []).map((o) => o.optionId);
const threat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;

function expectReplays(result: ReturnType<typeof run>): void {
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.session.state);
}

describe("§3.27 divide: remove N counters from among several cards", () => {
  it("counters 2, 2, 0 and 'remove 3': any split of 3 over the first two, as the player chooses", () => {
    const { state, ids, tallyId } = table([2, 2, 0]);
    const [a, b] = ids as [InstanceId, InstanceId];
    const result = play(state, EXPOSE, "divide", [`${a}#1`, `${a}#2`, `${b}#1`]);
    expect(secrets(result.state, ids)).toEqual([0, 1, 0]);
    // One prompt for exactly 3, each card offered no more than it holds; the card with none is not offered.
    expect(result.asked).toHaveLength(1);
    expect(result.asked[0]).toMatchObject({
      playerId: P1,
      authority: "player",
      minSelections: 3,
      maxSelections: 3,
      prompt: { kind: "divide", what: "counters", counterType: "secret", amount: 3 },
    });
    expect(optionIds(result.asked[0])).toEqual([`${a}#1`, `${a}#2`, `${b}#1`, `${b}#2`]);
    // Removed in the order chosen, counted in all for "removed this way".
    expect(removals(result.events)).toEqual([
      [a, "secret", 2],
      [b, "secret", 1],
    ]);
    expect(mustInstance(result.state, tallyId).counters.gone).toBe(3);
    expectReplays(result);
    // The other split of 3.
    const other = play(state, EXPOSE, "divide", [`${a}#1`, `${b}#1`, `${b}#2`]);
    expect(secrets(other.state, ids)).toEqual([1, 0, 0]);
  });

  it("a split of fewer or more than the amount, or more than a card holds, is refused", () => {
    const { state, ids } = table([2, 2, 0]);
    const [a, b] = ids as [InstanceId, InstanceId];
    expect(() => play(state, EXPOSE, "divide", [`${a}#1`, `${b}#1`])).toThrow();
    expect(() => play(state, EXPOSE, "divide", [`${a}#1`, `${a}#2`, `${a}#3`])).toThrow();
  });

  it("counters 1, 0, 0 and 'remove 3': 1 removed, nobody asked", () => {
    const { state, ids, tallyId } = table([1, 0, 0]);
    const result = play(state, EXPOSE);
    expect(secrets(result.state, ids)).toEqual([0, 0, 0]);
    expect(result.asked).toEqual([]);
    expect(mustInstance(result.state, tallyId).counters.gone).toBe(1);
    expectReplays(result);
  });

  it("fewer counters in all than the amount (2, 1, 0 and 'remove 4'): all 3 go, nobody asked", () => {
    const { state, ids } = table([2, 1, 0]);
    const result = play(state, EXPOSE_4);
    expect(secrets(result.state, ids)).toEqual([0, 0, 0]);
    expect(result.asked).toEqual([]);
    expectReplays(result);
  });

  it("an amount read from a card (cost 4) with counters 3, 2, 0: exactly 4 go, split as the player chooses", () => {
    const { state, ids } = table([3, 2, 0]);
    const [a, b] = ids as [InstanceId, InstanceId];
    const result = play(state, EXPOSE_4, "divide", [`${a}#1`, `${a}#2`, `${b}#1`, `${b}#2`]);
    expect(result.asked[0]).toMatchObject({ minSelections: 4, maxSelections: 4, prompt: { amount: 4 } });
    expect(optionIds(result.asked[0])).toEqual([`${a}#1`, `${a}#2`, `${a}#3`, `${b}#1`, `${b}#2`]);
    expect(secrets(result.state, ids)).toEqual([1, 0, 0]);
  });

  it("exactly as many as the amount (2, 1, 0 and 'remove 3') is the one legal split: nobody asked", () => {
    const { state, ids } = table([2, 1, 0]);
    const result = play(state, EXPOSE);
    expect(secrets(result.state, ids)).toEqual([0, 0, 0]);
    expect(result.asked).toEqual([]);
  });

  it("no counters anywhere: nothing happens and nothing is asked", () => {
    const { state, ids, tallyId } = table([0, 0, 0]);
    const result = play(state, EXPOSE);
    expect(secrets(result.state, ids)).toEqual([0, 0, 0]);
    expect(result.asked).toEqual([]);
    expect(removals(result.events)).toEqual([]);
    expect(mustInstance(result.state, tallyId).counters.gone ?? 0).toBe(0);
  });

  it("a card holding more than the amount is offered only the amount (5, 1 and 'remove 3')", () => {
    const { state, ids } = table([5, 1]);
    const [a, b] = ids as [InstanceId, InstanceId];
    const result = play(state, EXPOSE, "divide", [`${a}#1`, `${a}#2`, `${a}#3`]);
    expect(optionIds(result.asked[0])).toEqual([`${a}#1`, `${a}#2`, `${a}#3`, `${b}#1`]);
    expect(secrets(result.state, ids)).toEqual([2, 1]);
  });

  it("'up to 3': from 1 to 3 as the player chooses, asked even with one card holding counters", () => {
    const { state, ids } = table([2, 0, 0]);
    const [a] = ids as [InstanceId];
    const result = play(state, EXPOSE_UP_TO, "divide", [`${a}#1`]);
    expect(result.asked[0]).toMatchObject({ minSelections: 1, maxSelections: 2 });
    expect(secrets(result.state, ids)).toEqual([1, 0, 0]);
  });

  it("on an encounter card the first player divides (RRG p. 19)", () => {
    const { state, ids } = table([2, 2, 0], { players: 2 });
    const [a, b] = ids as [InstanceId, InstanceId];
    // P2 reveals the card; the split is still the first player's, with their authority over an encounter card.
    expect(state.firstPlayerId).toBe(P1);
    const result = reveal(state, PURGE, "divide", () => [`${a}#1`, `${b}#1`, `${b}#2`]);
    expect(result.asked).toHaveLength(1);
    expect(result.asked[0]).toMatchObject({
      playerId: P1,
      authority: "firstPlayerTargets",
      prompt: { kind: "divide", what: "counters", counterType: "secret", amount: 3 },
    });
    expect(secrets(result.state, ids)).toEqual([1, 0, 0]);
    expectReplays(result);
  });

  it("each card's share is removed as a plain removal: 'the last secret counter is removed' answers it", () => {
    const { state, ids } = table([1, 2, 0], { watched: true });
    const [a, b] = ids as [InstanceId, InstanceId];
    const before = threat(state);
    // 1 from the watched card (its last) and 1 from the other: the watched card's response fires once.
    const result = play(state, EXPOSE_UP_TO, "divide", [`${a}#1`, `${b}#1`]);
    expect(secrets(result.state, ids)).toEqual([0, 1, 0]);
    expect(threat(result.state)).toBe(before + 1);
    expectReplays(result);
  });

  it("typed counters only: 'secret' leaves a card's other counters alone and does not count them", () => {
    const { state, ids } = table([{ secret: 1, lock: 2 }, { lock: 3 }, 0]);
    const result = play(state, EXPOSE);
    // Only one secret counter exists among them: it goes, unasked. The lock counters stay.
    expect(result.asked).toEqual([]);
    expect(countersOf(result.state, ids[0]!)).toEqual({ lock: 2 });
    expect(countersOf(result.state, ids[1]!)).toEqual({ lock: 3 });
  });

  it("'any' counts every counter on a card, whatever its type (RRG p. 6)", () => {
    const { state, ids } = table([{ secret: 1 }, { lock: 3 }, 0]);
    const [a, b] = ids as [InstanceId, InstanceId];
    const result = play(state, EXPOSE_ANY, "divide", [`${a}#1`, `${b}#1`, `${b}#2`]);
    expect(optionIds(result.asked[0])).toEqual([`${a}#1`, `${b}#1`, `${b}#2`, `${b}#3`]);
    expect(result.asked[0]).toMatchObject({ prompt: { what: "counters", counterType: "any", amount: 3 } });
    expect(countersOf(result.state, a)).toEqual({});
    expect(countersOf(result.state, b)).toEqual({ lock: 1 });
    expectReplays(result);
  });

  it("'any' from a card holding two types, fewer than it holds: the player then picks which", () => {
    const { state, ids } = table([{ secret: 2, lock: 2 }, 0, 0]);
    const [a] = ids as [InstanceId];
    // One card holds all of them, so the division itself asks nothing; which 3 of its 4 is `chooseCounters`.
    const result = play(state, EXPOSE_ANY, "chooseCounters", ["lock#1", "lock#2", "secret#1"]);
    expect(result.asked).toHaveLength(1);
    expect(result.asked[0]).toMatchObject({
      prompt: { kind: "chooseCounters", instanceId: a, amount: 3, reason: "remove" },
    });
    expect(countersOf(result.state, a)).toEqual({ secret: 1 });
    expectReplays(result);
  });
});

describe("§3.27 superlative by counters: the card with the fewest / most counters", () => {
  it("'fewest' with 2, 0, 0: a card holding none is the fewest, and the player picks between the two at 0", () => {
    const { state, ids } = table([2, 0, 0]);
    const [, b, c] = ids as [InstanceId, InstanceId, InstanceId];
    const result = play(state, TO_FEWEST, "chooseTarget", [c]);
    expect(result.asked).toHaveLength(1);
    expect(optionIds(result.asked[0])).toEqual([b, c]);
    expect(result.asked[0]).toMatchObject({ playerId: P1, authority: "player" });
    // The all-purpose counter placed takes the type the card defines.
    expect(secrets(result.state, ids)).toEqual([2, 0, 1]);
    expectReplays(result);
  });

  it("'fewest' with one card strictly lowest (2, 1, 3): that card alone is the target", () => {
    const { state, ids } = table([2, 1, 3]);
    const result = play(state, TO_FEWEST, "chooseTarget");
    // Only the one card is a candidate.
    expect(result.asked.map(optionIds)).toEqual([[ids[1]]]);
    expect(secrets(result.state, ids)).toEqual([2, 2, 3]);
  });

  it("'most' with 3, 3, 1: the player picks between the tied two; with none anywhere, among all three", () => {
    const { state, ids } = table([3, 3, 1]);
    const [a, b] = ids as [InstanceId, InstanceId];
    const result = play(state, TO_MOST, "chooseTarget", [b]);
    expect(optionIds(result.asked[0])).toEqual([a, b]);
    expect(secrets(result.state, ids)).toEqual([3, 4, 1]);
    const empty = table([0, 0, 0]);
    const none = play(empty.state, TO_MOST, "chooseTarget", [empty.ids[1]!]);
    expect(optionIds(none.asked[0])).toEqual(empty.ids);
    expect(secrets(none.state, empty.ids)).toEqual([0, 1, 0]);
  });

  it("on an encounter card the first player breaks the tie (RRG p. 19)", () => {
    const { state, ids } = table([2, 0, 0], { players: 2 });
    const [, b, c] = ids as [InstanceId, InstanceId, InstanceId];
    const result = reveal(state, LEAK, "chooseTarget", (choice) =>
      choice.options.some((o) => o.optionId === c) ? [c] : defaultPick({ ...state, pendingChoice: choice }),
    );
    const tie = result.asked.find((choice) => choice.options.some((o) => o.optionId === c));
    expect(optionIds(tie)).toEqual([b, c]);
    // P2 revealed it; the first player picks.
    expect(tie).toMatchObject({ playerId: P1, authority: "firstPlayerTargets" });
    expect(secrets(result.state, ids)).toEqual([2, 0, 2]);
    expectReplays(result);
  });

  it("typed vs any: by secret counters a card holding only lock counters holds none; by any counter it does not", () => {
    const held = [{ secret: 1 }, { lock: 3 }, { secret: 2 }] as const;
    const typed = table(held);
    const bySecret = play(typed.state, TO_FEWEST, "chooseTarget");
    // 0 secret counters on the second card: it is the fewest outright.
    expect(bySecret.asked.map(optionIds)).toEqual([[typed.ids[1]]]);
    expect(countersOf(bySecret.state, typed.ids[1]!)).toEqual({ lock: 3, secret: 1 });
    const any = table(held);
    const byAny = play(any.state, TO_FEWEST_ANY, "chooseTarget");
    // Counting every counter (1, 3, 2), the first card is.
    expect(byAny.asked.map(optionIds)).toEqual([[any.ids[0]]]);
    expect(countersOf(byAny.state, any.ids[0]!)).toEqual({ secret: 2 });
  });
});
