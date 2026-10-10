/**
 * `EffectSpec forEachCard`: "For each [card], … that [card] …". Synthetic cards shaped like an event that reads "Hero
 * Action: For each ally you control, choose to either exhaust that ally or place 1 threat on the main scheme."
 *
 * Sources: RRG 1.8 "'For Each'" (p. 20): "'For each' indicates an effect is repeated based on the number of a
 * countable game element"; "If a 'for each' effect has a 'choose' instruction, each iteration of that choice is
 * considered a separate instance of that effect"; "The game state updates after each instance". RRG 1.8 "Exhausted"
 * (p. 19): "An exhausted card cannot be exhausted again until it is ready." RRG 1.8 "Choose (Option)" (p. 12): an
 * option that cannot happen is not chosen; a script says so with the option's `condition`, as everywhere else.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetQuery, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const you = { kind: "controller" } as const;
const slot = (name: string) => ({ kind: "slot", slot: name }) as const;
const each = (query: TargetQuery) => ({ kind: "each", query }) as const;
const MAIN = { kind: "mainScheme" } as const;
const MY_ALLIES: TargetQuery = { categories: ["ally"], controller: "you" };

const AGENT = stubAlly({ id: "agent", cost: 1, atk: 1, thw: 1, hp: 3 });

const EXHAUST = "Exhaust that ally";
const THREAT = "Place 1 threat on the main scheme";
const DISMISS = "Discard another ally you control";
const exhaustOrThreat: EffectSpec = {
  kind: "chooseOne",
  chooser: you,
  options: [
    {
      label: EXHAUST,
      condition: { kind: "exists", query: { inSlot: "ally", exhausted: false } },
      effects: [{ kind: "exhaust", target: slot("ally") }],
    },
    { label: THREAT, effects: [{ kind: "placeThreat", target: MAIN, amount: n(1) }] },
  ],
};

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "For each ally you control, choose to either exhaust that ally or place 1 threat on the main scheme." */
const CAMERAS = actionEvent("cameras", [
  { kind: "forEachCard", cards: each(MY_ALLIES), slot: "ally", effects: [exhaustOrThreat] },
]);
/** "For each ally you control, choose to either discard another ally you control or place 1 threat …". */
const PURGE = actionEvent("purge", [
  {
    kind: "forEachCard",
    cards: each(MY_ALLIES),
    slot: "ally",
    effects: [
      {
        kind: "chooseOne",
        chooser: you,
        options: [
          {
            label: DISMISS,
            effects: [
              {
                kind: "chooseTarget",
                slot: "other",
                query: { ...MY_ALLIES, excludeSlots: ["ally"] },
                chooser: you,
              },
              { kind: "discardFromPlay", target: slot("other") },
            ],
          },
          { label: THREAT, effects: [{ kind: "placeThreat", target: MAIN, amount: n(1) }] },
        ],
      },
    ],
  },
]);
/** "For each ready ally you control, place 1 mark on that ally and exhaust each ally you control." */
const DRILL = actionEvent("drill", [
  {
    kind: "forEachCard",
    cards: each({ ...MY_ALLIES, exhausted: false }),
    slot: "ally",
    effects: [
      { kind: "addCounters", target: slot("ally"), counterType: "mark", amount: n(1) },
      { kind: "exhaust", target: each(MY_ALLIES) },
    ],
  },
]);

const EVENTS = [CAMERAS, PURGE, DRILL];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

function start(staged: { readonly allies?: number; readonly theirs?: number; readonly players?: 1 | 2 } = {}) {
  let state = gameAtFirstTurn({
    cards: [...EVENTS.map((e) => e.card), AGENT],
    deps,
    deck: [...EVENTS.flatMap((e) => copiesOf(e.card.id, 2)), ...copiesOf(AGENT.id, 6)],
    encounter: [],
    players: staged.players ?? 1,
  });
  const allies: InstanceId[] = [];
  for (let i = 0; i < (staged.allies ?? 0); i++) {
    const entered = playerCardIntoPlay(state, AGENT.id);
    state = entered.state;
    allies.push(entered.id);
  }
  for (let i = 0; i < (staged.theirs ?? 0); i++) state = playerCardIntoPlay(state, AGENT.id, P2).state;
  const main = state.mainScheme.instanceId;
  state = { ...state, instances: { ...state.instances, [main]: { ...mustInstance(state, main), threat: 2 } } };
  return { state, allies };
}

const exhausted = (state: GameState, id: InstanceId): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), exhausted: true } },
});

interface Asked {
  readonly kind: string;
  readonly offered: readonly string[];
}

/**
 * Plays `card` from hand for 0, answering each option prompt with the next label of `labels` and each card prompt
 * (which card's pass is next, or a pass's own target) with the next id of `cards`; the first one offered when they
 * run out or name something not offered. Records every prompt.
 */
function playPicking(
  state: GameState,
  card: (typeof EVENTS)[number]["card"],
  labels: readonly string[] = [],
  cards: readonly InstanceId[] = [],
) {
  const given = giveCard(state, P1, card.id);
  const asked: Asked[] = [];
  const nextLabels = [...labels];
  const nextCards = [...cards];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    if (choice.prompt.kind === "chooseOption") {
      asked.push({ kind: "chooseOption", offered: choice.options.map((o) => o.label ?? "") });
      const label = nextLabels.shift();
      const hit = choice.options.find((o) => o.label === label);
      return [hit ? (hit.optionId as string) : offered[0]!];
    }
    if (choice.prompt.kind === "chooseTarget") {
      asked.push({ kind: `chooseTarget:${choice.prompt.slot}`, offered });
      const target = nextCards.shift();
      return [target !== undefined && offered.includes(target) ? target : offered[0]!];
    }
    return defaultPick(s);
  };
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const { session, events } = driveSession(startSession(given.state), deps, [command], pick);
  return { session, state: session.state, events, asked, played: given.id };
}

const mainThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const isExhausted = (state: GameState, id: InstanceId): boolean => mustInstance(state, id).exhausted;
const of = (asked: readonly Asked[], kind: string): Asked[] => asked.filter((a) => a.kind === kind);
/** The card each pass was about, in the order the passes ran. */
const passes = (events: readonly GameEvent[]): InstanceId[] =>
  events.flatMap((e) => (e.type === "targetChosen" && e.slot === "ally" ? [...e.instanceIds] : []));

describe("forEachCard: one pass per card, that card bound (RRG 1.8 \"'For Each'\", p. 20)", () => {
  it("0 cards: nothing is asked, nothing changes, and the event is still played and discarded", () => {
    const { state } = start();
    const result = playPicking(state, CAMERAS.card);
    expect(result.asked).toEqual([]);
    expect(passes(result.events)).toEqual([]);
    expect(mainThreat(result.state)).toBe(2);
    expect(mustPlayer(result.state, P1).discard).toContain(result.played);
  });

  it("1 card, exhausted: one option prompt, no prompt for which card, the ally is exhausted and threat stays 2", () => {
    const { state, allies } = start({ allies: 1 });
    const result = playPicking(state, CAMERAS.card, [EXHAUST]);
    expect(result.asked).toEqual([{ kind: "chooseOption", offered: [EXHAUST, THREAT] }]);
    expect(passes(result.events)).toEqual([allies[0]]);
    expect(isExhausted(result.state, allies[0]!)).toBe(true);
    expect(mainThreat(result.state)).toBe(2);
  });

  it("1 card, the other option: the ally stays ready and the main scheme goes from 2 to 3", () => {
    const { state, allies } = start({ allies: 1 });
    const result = playPicking(state, CAMERAS.card, [THREAT]);
    expect(isExhausted(result.state, allies[0]!)).toBe(false);
    expect(mainThreat(result.state)).toBe(3);
  });

  it("3 cards, all exhausted: three passes, three allies exhausted, threat stays 2", () => {
    const { state, allies } = start({ allies: 3 });
    const result = playPicking(state, CAMERAS.card, [EXHAUST, EXHAUST, EXHAUST]);
    expect(of(result.asked, "chooseOption")).toHaveLength(3);
    expect(allies.map((id) => isExhausted(result.state, id))).toEqual([true, true, true]);
    expect(mainThreat(result.state)).toBe(2);
  });

  it("3 cards, mixed: exhaust, threat, threat exhausts exactly the first pass's ally and leaves 4 threat", () => {
    const { state, allies } = start({ allies: 3 });
    const result = playPicking(state, CAMERAS.card, [EXHAUST, THREAT, THREAT], [allies[1]!, allies[2]!]);
    expect(passes(result.events)).toEqual([allies[1], allies[2], allies[0]]);
    expect(allies.map((id) => isExhausted(result.state, id))).toEqual([false, true, false]);
    expect(mainThreat(result.state)).toBe(4);
  });

  it("the player picks which card is next while two or more wait: 3 offered, then 2, then the last unasked", () => {
    const { state, allies } = start({ allies: 3 });
    const result = playPicking(state, CAMERAS.card, [THREAT, THREAT, THREAT], [allies[2]!, allies[0]!]);
    const order = of(result.asked, "chooseTarget:ally");
    expect(order).toHaveLength(2);
    expect([...order[0]!.offered].sort()).toEqual([...allies].sort());
    expect([...order[1]!.offered].sort()).toEqual([allies[0]!, allies[1]!].sort());
    expect(passes(result.events)).toEqual([allies[2], allies[0], allies[1]]);
    expect(mainThreat(result.state)).toBe(5);
  });

  it("an already exhausted card cannot be chosen to exhaust: its pass has one option left and places 1 threat", () => {
    const { state, allies } = start({ allies: 1 });
    const result = playPicking(exhausted(state, allies[0]!), CAMERAS.card, [EXHAUST]);
    // One option left resolves without asking.
    expect(result.asked).toEqual([]);
    expect(passes(result.events)).toEqual([allies[0]]);
    expect(isExhausted(result.state, allies[0]!)).toBe(true);
    expect(mainThreat(result.state)).toBe(3);
  });

  it("one exhausted card of 3: the two ready ones are offered both options, 2 exhausted more and 1 threat", () => {
    const { state, allies } = start({ allies: 3 });
    const result = playPicking(
      exhausted(state, allies[1]!),
      CAMERAS.card,
      [EXHAUST, EXHAUST],
      [allies[0]!, allies[1]!],
    );
    expect(of(result.asked, "chooseOption")).toEqual([
      { kind: "chooseOption", offered: [EXHAUST, THREAT] },
      { kind: "chooseOption", offered: [EXHAUST, THREAT] },
    ]);
    expect(allies.map((id) => isExhausted(result.state, id))).toEqual([true, true, true]);
    expect(mainThreat(result.state)).toBe(3);
  });

  it("only the named cards get a pass: another player's 2 allies add none", () => {
    const { state, allies } = start({ allies: 1, theirs: 2, players: 2 });
    const result = playPicking(state, CAMERAS.card, [THREAT]);
    expect(passes(result.events)).toEqual([allies[0]]);
    expect(mainThreat(result.state)).toBe(3);
  });

  it("a card that left play before its pass is skipped: 3 allies, the first pass discards one, 2 passes in all", () => {
    const { state, allies } = start({ allies: 3 });
    const result = playPicking(state, PURGE.card, [DISMISS, THREAT], [allies[0]!, allies[1]!]);
    expect(passes(result.events)).toEqual([allies[0], allies[2]]);
    // After the discard a single card waits, so the player is asked which card is next only once.
    expect(of(result.asked, "chooseTarget:ally")).toHaveLength(1);
    expect(of(result.asked, "chooseOption")).toHaveLength(2);
    const seat = mustPlayer(result.state, P1);
    expect(seat.discard).toContain(allies[1]);
    expect(seat.playArea).toEqual(expect.arrayContaining([allies[0], allies[2]]));
    expect(mainThreat(result.state)).toBe(3);
  });

  it("a pass's own choice never offers the pass's card, and the next pass starts without that choice", () => {
    const { state, allies } = start({ allies: 3 });
    const result = playPicking(state, PURGE.card, [DISMISS, DISMISS], [allies[0]!, allies[1]!, allies[0]!]);
    const others = of(result.asked, "chooseTarget:other");
    expect([...others[0]!.offered].sort()).toEqual([allies[1]!, allies[2]!].sort());
    // Second pass: the last waiting ally (the third), offered the only other ally left.
    expect(others[1]!.offered).toEqual([allies[0]]);
    expect(passes(result.events)).toEqual([allies[0], allies[2]]);
    expect(mustPlayer(result.state, P1).playArea).toContain(allies[2]);
    expect(mustPlayer(result.state, P1).discard).toEqual(expect.arrayContaining([allies[0], allies[1]]));
    expect(mainThreat(result.state)).toBe(2);
  });

  it("the set is fixed as the effect begins: a card that stops matching but stays in play keeps its pass", () => {
    const { state, allies } = start({ allies: 3 });
    const result = playPicking(state, DRILL.card);
    expect(passes(result.events)).toHaveLength(3);
    for (const id of allies) {
      expect(mustInstance(result.state, id).counters).toEqual({ mark: 1 });
      expect(isExhausted(result.state, id)).toBe(true);
    }
  });

  it("the set is fixed as the effect begins: a card exhausted beforehand was never in it", () => {
    const { state, allies } = start({ allies: 3 });
    const result = playPicking(exhausted(state, allies[0]!), DRILL.card);
    expect(passes(result.events)).toHaveLength(2);
    expect(mustInstance(result.state, allies[0]!).counters).toEqual({});
  });

  it("replays to the same state", () => {
    const { state, allies } = start({ allies: 3 });
    const result = playPicking(state, CAMERAS.card, [EXHAUST, THREAT, EXHAUST], [allies[2]!, allies[0]!]);
    const replayed = replay(result.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(result.state);
  });
});
