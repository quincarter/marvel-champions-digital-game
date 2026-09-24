/**
 * docs/phase7-wave4.md §3.7: Loki. Synthetic villains shaped like Loki I ×5 (`mts` 21160–21164: five stage-I cards titled
 * "Loki", each "Victory 1.", one with stalwart), All Hail King Loki 1B ("Forced Interrupt: When Loki is defeated, advance
 * to a random set-aside Loki villain. If the number of Lokis in the victory display is equal to the victory condition,
 * the players win the game."), The Trickster ("Swap Loki with a random set-aside Loki villain") and Loki's Cape ("After
 * Loki is swapped with a set-aside Loki villain, give him a tough status card").
 *
 * Sources: MC21 p. 24 ("choose one Loki villain card at random", "transfer all attachments, status cards, counters, and
 * tokens", the rules clarification on swapping and on stalwart); RRG 1.8 "'Swap'" (p. 42), "Villain Defeat" (p. 47),
 * "Victory X" (p. 46), "Stalwart" (p. 40); ruling, Feb 28, 2026 (3) (swapped Lokis keep permanent attachments).
 */

import { flat, type CardId, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import { mustInstance, villainOf } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO } from "./testing/scenario.js";
import { copiesOf, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const loki = (id: string, extra: "stalwart" | null = null): VillainCard =>
  stubVillain({
    id,
    name: "Loki",
    stages: [
      {
        hp: flat(10),
        atk: 0,
        sch: 0,
        keywords: [{ name: "victory", value: 1 }, ...(extra ? [{ name: extra } as const] : [])],
      },
    ],
  });
const LOKIS = [loki("loki-a"), loki("loki-b"), loki("loki-c")];
const STALWART_LOKI = loki("loki-stalwart", "stalwart");

const theVillain: TargetRef = { kind: "villain" };
const tracker: TargetRef = { kind: "each", query: { categories: ["support"], name: "tracker" } };
const ADVANCE = stubAbility("king-loki.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated", targetIs: { categories: ["villain"] } } },
  effects: [{ kind: "advanceToSetAsideVillain", villain: { kind: "eventTarget" } }],
});
const WIN = stubAbility("king-loki.state-check", {
  trigger: {
    kind: "stateCheck",
    when: {
      kind: "compare",
      left: { kind: "victoryDisplayCount", filter: { categories: ["villain"], name: "Loki" } },
      op: "atLeast",
      right: { kind: "victoryCondition" },
    },
  },
  effects: [{ kind: "endGame", result: "win" }],
});
const KING_LOKI = stubMainScheme({
  id: "all-hail-king-loki",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), abilities: [ADVANCE.ref, WIN.ref] },
  ],
});
const PLAIN_SCHEME = stubMainScheme({
  id: "plain",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const CAPE = stubAbility("cape.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "villainSwapped" } },
  effects: [{ kind: "addCounters", target: tracker, counterType: "swaps", amount: { kind: "const", value: 1 } }],
});
const TRACKER = stubSupport({ id: "tracker", cost: 0, abilities: [CAPE.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const TRICKSTER = event("trickster", [{ kind: "swapVillain", villain: theVillain }]);
const MARK = event("mark", [
  { kind: "dealDamage", target: theVillain, amount: { kind: "const", value: 3 } },
  { kind: "giveStatus", target: theVillain, status: "confused" },
  { kind: "addCounters", target: theVillain, counterType: "mischief", amount: { kind: "const", value: 2 } },
]);
const SLAY = event("slay", [{ kind: "dealDamage", target: theVillain, amount: { kind: "const", value: 10 } }]);
const EVENTS = [TRICKSTER, MARK, SLAY];

const deps: EngineDeps = depsOf(ADVANCE, WIN, CAPE, ...EVENTS.map((e) => e.ability));

function start(options: { lokis: readonly VillainCard[]; scheme?: typeof KING_LOKI; random?: boolean }): GameState {
  const [first, ...rest] = options.lokis;
  const result = createGame(
    {
      seed: 8,
      cards: [
        ...DEFAULT_CARDS,
        ...options.lokis,
        KING_LOKI,
        PLAIN_SCHEME,
        TRACKER,
        FILLER,
        ...EVENTS.map((e) => e.card),
      ],
      villainCardId: first!.id,
      setAsideVillainCardIds: rest.map((card) => card.id),
      ...(options.random === false ? {} : { randomStartingVillain: true as const }),
      mainSchemeCardId: (options.scheme ?? KING_LOKI).id,
      encounterDeck: copiesOf(FILLER.id, 10),
      victory: options.scheme === PLAIN_SCHEME ? "finalVillainStage" : "cardAbility",
      victoryCondition: 2,
      includeIdentitySets: false,
      players: [
        {
          identityCardId: HERO.id,
          deck: [...DEFAULT_DECK, TRACKER.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 3))],
        },
      ],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const state = driveSession(startSession(result.state), deps).session.state;
  return playerCardIntoPlay(state, TRACKER.id).state;
}
const villain = (state: GameState) => villainOf(state, state.activeVillainId)!;
const setAsideCards = (state: GameState): readonly CardId[] =>
  state.encounterSetAside.map((id) => mustInstance(state, id).cardId);
const trackerCount = (state: GameState, type: string): number => {
  const id = state.players[0]!.playArea.find((i) => mustInstance(state, i).cardId === TRACKER.id)!;
  return mustInstance(state, id).counters[type] ?? 0;
};

describe("§3.7 Loki: a random starting villain", () => {
  it("one of the Lokis starts, at random from the seed, and the others are set aside", () => {
    const state = start({ lokis: LOKIS });
    const all = LOKIS.map((card) => card.id);
    expect(all).toContain(villain(state).cardId);
    expect([...setAsideCards(state), villain(state).cardId].sort()).toEqual([...all].sort());
    expect(start({ lokis: LOKIS }).activeVillainId).toBe(state.activeVillainId);
  });
});

describe("§3.7 swapping Loki (RRG 1.8 'Swap')", () => {
  it("the new card keeps the dial, status cards and counters; the old one is set aside; 'after Loki is swapped' fires", () => {
    const marked = playFree(start({ lokis: [LOKIS[0]!, LOKIS[1]!], random: false }), deps, MARK.card.id).state;
    const before = villain(marked);
    const { state: after, session } = playFree(marked, deps, TRICKSTER.card.id);
    const now = villain(after);
    expect(now.instanceId).toBe(before.instanceId);
    expect(now.cardId).toBe(LOKIS[1]!.id);
    expect(setAsideCards(after)).toEqual([LOKIS[0]!.id]);
    const instance = mustInstance(after, now.instanceId);
    expect(instance.damage).toBe(3);
    expect(instance.statuses.confused).toBe(1);
    expect(instance.counters["mischief"]).toBe(2);
    expect(trackerCount(after, "swaps")).toBe(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a Loki with stalwart sheds its stunned and confused status cards when swapped in (MC21 p. 24)", () => {
    const marked = playFree(start({ lokis: [LOKIS[0]!, STALWART_LOKI], random: false }), deps, MARK.card.id).state;
    const after = playFree(marked, deps, TRICKSTER.card.id).state;
    expect(villain(after).cardId).toBe(STALWART_LOKI.id);
    expect(mustInstance(after, after.activeVillainId).statuses.confused).toBe(0);
  });
});

describe("§3.7 'advance to a random set-aside Loki villain', Victory X on a villain, the victory count", () => {
  it("a defeated Loki goes to the victory display and the next takes over; at the victory condition the players win", () => {
    const marked = playFree(start({ lokis: LOKIS, random: false }), deps, MARK.card.id).state;
    const first = playFree(marked, deps, SLAY.card.id).state;
    expect(first.outcome).toBeNull();
    expect(first.victoryDisplay.map((id) => mustInstance(first, id).cardId)).toEqual([LOKIS[0]!.id]);
    const next = mustInstance(first, first.activeVillainId);
    expect(next.damage).toBe(0);
    expect(next.statuses.confused).toBe(1);
    expect(next.counters["mischief"]).toBe(2);
    expect(villain(first).defeated).toBe(false);
    const second = playFree(first, deps, SLAY.card.id);
    expect(second.state.victoryDisplay).toHaveLength(2);
    expect(second.state.outcome?.result).toBe("win");
    const replayed = replay(second.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(second.session.state);
  });

  it("a villain whose last stage has Victory X goes to the victory display when defeated the ordinary way", () => {
    const state = start({ lokis: [LOKIS[0]!], scheme: PLAIN_SCHEME, random: false });
    const after = playFree(state, deps, SLAY.card.id).state;
    expect(after.outcome?.result).toBe("win");
    expect(after.victoryDisplay).toContain(state.activeVillainId);
  });
});
