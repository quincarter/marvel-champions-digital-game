/**
 * docs/phase7-wave7.md §3.28: alternative main scheme stages, one removed at random and the rest in a random order.
 * A stage 1B prints "When Revealed: Remove 1 random stage 2 from the game. Then advance to a random stage 2A", and
 * each stage 2B "When Completed: Advance to the other stage 2A. If you cannot, advance to stage 3A."
 *
 * `EffectSpec removeMainSchemeStages` marks the removed stage spent; `shuffleMainSchemeStages.stageNumber` orders only
 * the stage 2 group, leaving stage 3 behind it; the default advance (wave 6 §3.18) then walks 1 → 2x → 2y → 3. The
 * stage 2s' When Completed is that walk and is not an effect: a completion already advances once
 * (`completeMainScheme`), so the synthetic stage 2s here carry no advance of their own.
 *
 * Hidden or public: nothing here is hidden. MC40 p. 16: "the order of these stages is randomized and one of the stages
 * is removed from the game at random"; a removed card is out of play in the open, the stage advanced to is showing, and
 * with three alternatives the one left is known by elimination. So `mainSchemeStageRemoved` names the stage, and the
 * `mainSchemeStagesShuffled` order (a replay-log field, §3.18) holds nothing the table could not work out.
 */
import { flat, type AbilityReference, type CardId, type MainSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId } from "./ids.js";
import { mustInstance } from "./query.js";
import { nextMainSchemeStage } from "./resolve/defeat.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCard, HERO, seatIdentities } from "./testing/scenario.js";

const p1 = playerId("p1");
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

/** Stage indexes of the synthetic deck: stage 1, three stage 2s, stage 3. */
const STAGE_2S = [1, 2, 3] as const;
const STAGE_3 = 4;
const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1);

const remove = (count: number): EffectSpec => ({
  kind: "removeMainSchemeStages",
  stageNumber: 2,
  random: { kind: "const", value: count },
});
const SHUFFLE_2S: EffectSpec = { kind: "shuffleMainSchemeStages", fromStageIndex: 0, stageNumber: 2 };
const ADVANCE_EFFECT: EffectSpec = { kind: "advanceMainScheme" };

/** "Remove N random stage 2 from the game. Then advance to a random stage 2A." */
const reveal = (count: number): StubAbility =>
  stubAbility(`reveal-${count}.when-revealed`, {
    trigger: { kind: "whenRevealed" },
    effects: [remove(count), SHUFFLE_2S, ADVANCE_EFFECT],
  });
const REVEAL = { 1: reveal(1), 2: reveal(2), 9: reveal(9) } as const;

/** Each stage 2B's When Revealed leaves its own mark on the villain, standing in for the attachment it brings. */
const powerOf = (stageIndex: number): string => `power-${stageIndex}`;
const STAGE_2_REVEALS = STAGE_2S.map((stageIndex) =>
  stubAbility(`stage-${stageIndex}.when-revealed`, {
    trigger: { kind: "whenRevealed" },
    effects: [
      {
        kind: "addCounters",
        target: { kind: "villain" },
        counterType: powerOf(stageIndex),
        amount: { kind: "const", value: 1 },
      },
    ],
  }),
);

const ADVANCE = stubAbility("advance.action", { trigger: { kind: "action" }, effects: [ADVANCE_EFFECT] });
const PLOT = stubAbility("plot.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 3 } }],
});
const PURGE = stubAbility("purge.action", {
  trigger: { kind: "action" },
  effects: [{ ...remove(9), bind: "gone" } as EffectSpec, SHUFFLE_2S],
});
const SHUFFLE_ONLY = stubAbility("shuffle-only.setup", { trigger: { kind: "setup" }, effects: [SHUFFLE_2S] });
const ADVANCE_CARD = stubEvent({ id: "advance-card", cost: 0, abilities: [ADVANCE.ref] });
const PLOT_CARD = stubEvent({ id: "plot-card", cost: 0, abilities: [PLOT.ref] });
const PURGE_CARD = stubEvent({ id: "purge-card", cost: 0, abilities: [PURGE.ref] });

const POWERS = { kind: "sum", values: STAGE_2S.map((stageIndex) => counters(powerOf(stageIndex))) } as const;
function counters(counterType: string) {
  return { kind: "counters", of: { kind: "self" }, counterType } as const;
}
/**
 * The expert villain's When Revealed: it notes the stage number showing, then places 1 threat on the main scheme, or 2
 * while it has fewer than two of the stage 2s' marks.
 */
const VILLAIN_REVEAL = stubAbility("villain-ii.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "self" },
      counterType: "stage-seen",
      amount: { kind: "mainSchemeStageNumber" },
    },
    {
      kind: "if",
      condition: { kind: "compare", left: POWERS, op: "atLeast", right: { kind: "const", value: 2 } },
      then: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }],
      otherwise: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 2 } }],
    },
  ],
});

const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const EXPERT_VILLAIN = stubVillain({
  id: "expert",
  stages: [
    { hp: flat(30), atk: 0, sch: 0 },
    { hp: flat(30), atk: 0, sch: 0, abilities: [VILLAIN_REVEAL.ref] },
  ],
});

/** Stage 1 (never completes here), three alternative stage 2s (starting 1, target 4), then stage 3. */
function scheme(id: string, stageOne: { readonly setup?: AbilityReference; readonly revealed?: AbilityReference }) {
  const stub = stubMainScheme({
    id,
    stages: [
      {
        startingThreat: flat(0),
        targetThreat: flat(99),
        acceleration: flat(0),
        aSideAbilities: stageOne.setup ? [stageOne.setup] : [],
        abilities: stageOne.revealed ? [stageOne.revealed] : [],
      },
      ...STAGE_2_REVEALS.map((ability) => ({
        startingThreat: flat(1),
        targetThreat: flat(4),
        acceleration: flat(0),
        abilities: [ability.ref],
      })),
      { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) },
    ],
  });
  const stages = stub.stages.map((stage, index) =>
    index === 0
      ? stage
      : index === STAGE_3
        ? { ...stage, stageNumber: 3 }
        : { ...stage, stageNumber: 2, name: `2-${index}` },
  ) as unknown as MainSchemeCard["stages"];
  return { ...stub, stages };
}

const ONE_REMOVED = scheme("one-removed", { revealed: REVEAL[1].ref });
const TWO_REMOVED = scheme("two-removed", { revealed: REVEAL[2].ref });
const ALL_ASKED = scheme("all-asked", { revealed: REVEAL[9].ref });
const SHUFFLED_ONLY = scheme("shuffled-only", { setup: SHUFFLE_ONLY.ref });

const deps: EngineDeps = depsOf(
  ...Object.values(REVEAL),
  ...STAGE_2_REVEALS,
  ADVANCE,
  PLOT,
  PURGE,
  SHUFFLE_ONLY,
  VILLAIN_REVEAL,
);

function game(seed: number, mainScheme: MainSchemeCard = ONE_REMOVED, expert = false) {
  const identities = seatIdentities(HERO, 1);
  const villain = expert ? EXPERT_VILLAIN : QUIET_VILLAIN;
  const config: GameSetupConfig = {
    seed,
    cards: [villain, mainScheme, BLANK, ADVANCE_CARD, PLOT_CARD, PURGE_CARD, ...identities],
    villainCardId: villain.id,
    ...(expert ? { villainStartStageIndex: 1, difficulty: "expert" as const } : {}),
    mainSchemeCardId: mainScheme.id,
    encounterDeck: Array.from({ length: 16 }, () => BLANK.id as CardId),
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [ADVANCE_CARD.id, ADVANCE_CARD.id, PLOT_CARD.id, PLOT_CARD.id, PURGE_CARD.id],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  const run = runCommands(result.state, deps);
  return { ...run, events: [...result.events, ...run.events] };
}

function play(state: GameState, cardId: string) {
  const given = giveCard(state, p1, cardId);
  return runCommands(given.state, deps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

const schemeThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
function villainCounters(state: GameState): Readonly<Record<string, number>> {
  const [villain] = state.villains;
  if (!villain) throw new Error("no villain in play");
  return mustInstance(state, villain.instanceId).counters;
}
const removedOf = (events: readonly GameEvent[]): number[] =>
  events.flatMap((event) => (event.type === "mainSchemeStageRemoved" ? [event.stageIndex] : []));
const advancedTo = (events: readonly GameEvent[]): number[] =>
  events.flatMap((event) => (event.type === "mainSchemeAdvanced" ? [event.stageIndex] : []));

describe("§3.28 removeMainSchemeStages", () => {
  it("removes one unspent stage of the number, marks it spent, logs it, and leaves it out of the order", () => {
    const { state, events } = game(1);
    const [removed] = removedOf(events);
    expect(removedOf(events)).toHaveLength(1);
    expect(STAGE_2S).toContain(removed);
    expect(state.spentMainSchemeStages).toEqual([removed]);
    expect(events.filter((event) => event.type === "mainSchemeStageRemoved")).toEqual([
      // No instance: the scheme in play stays, only a stage of its deck is gone.
      { type: "mainSchemeStageRemoved", schemeInstanceId: null, stageIndex: removed },
    ]);
    const survivors = STAGE_2S.filter((stageIndex) => stageIndex !== removed);
    const current = state.mainScheme.stageIndex;
    const other = survivors.find((stageIndex) => stageIndex !== current);
    expect(survivors).toContain(current);
    expect(state.mainScheme.stageOrder).toEqual([0, current, other, STAGE_3]);
  });

  it("over many seeds each stage 2 is the removed one, and the two survivors come in both orders", () => {
    const removedSeen = new Set<number>();
    const orders = new Set<string>();
    for (const seed of SEEDS) {
      const { state, events } = game(seed);
      const [removed] = removedOf(events);
      const order = state.mainScheme.stageOrder ?? [];
      removedSeen.add(removed as number);
      orders.add(`${removed}:${order.slice(1, 3).join(">")}`);
      // Stage 1 first and stage 3 last, whatever the seed: only the stage 2 group is shuffled.
      expect(order).toHaveLength(4);
      expect(order[0]).toBe(0);
      expect(order[3]).toBe(STAGE_3);
      expect([...order.slice(1, 3), removed].sort()).toEqual([...STAGE_2S]);
    }
    expect([...removedSeen].sort()).toEqual([...STAGE_2S]);
    expect([...orders].sort()).toEqual(["1:2>3", "1:3>2", "2:1>3", "2:3>1", "3:1>2", "3:2>1"]);
  });

  it("the setup advance shows a surviving stage 2 with its When Revealed and starting threat resolved", () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const { state, events } = game(seed);
      const [removed] = removedOf(events);
      const current = state.mainScheme.stageIndex;
      expect(current).not.toBe(removed);
      expect(STAGE_2S).toContain(current);
      expect(advancedTo(events)).toEqual([current]);
      expect(schemeThreat(state)).toBe(1);
      expect(villainCounters(state)).toEqual({ [powerOf(current)]: 1 });
      expect(state.mainScheme.advancedBy).toEqual({
        cause: "cardEffect",
        sourceInstanceId: state.mainScheme.instanceId,
      });
    }
  });

  it("completing the first stage 2 advances to the other, completing the second to stage 3; the removed one is never revealed", () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const start = game(seed);
      const [removed] = removedOf(start.events);
      const [, first, second] = start.state.mainScheme.stageOrder ?? [];
      expect(start.state.mainScheme.stageIndex).toBe(first);

      const afterFirst = play(start.state, PLOT_CARD.id);
      expect(afterFirst.state.mainScheme.stageIndex).toBe(second);
      expect(afterFirst.state.mainScheme.completed).toBe(false);
      expect(schemeThreat(afterFirst.state)).toBe(1);
      expect(afterFirst.events.filter((event) => event.type.startsWith("mainScheme"))).toEqual([
        { type: "mainSchemeCompleted", stageIndex: first },
        { type: "mainSchemeAdvanced", stageIndex: second, advancedBy: { cause: "completed", sourceInstanceId: null } },
      ]);

      const afterSecond = play(afterFirst.state, PLOT_CARD.id);
      expect(afterSecond.state.mainScheme.stageIndex).toBe(STAGE_3);
      expect(afterSecond.state.outcome).toBeNull();
      expect(advancedTo(afterSecond.events)).toEqual([STAGE_3]);
      expect(nextMainSchemeStage(afterSecond.state, afterSecond.state.mainScheme)).toBeNull();

      const all = [...start.events, ...afterFirst.events, ...afterSecond.events];
      expect(advancedTo(all)).toEqual([first, second, STAGE_3]);
      expect(advancedTo(all)).not.toContain(removed);
      expect(villainCounters(afterSecond.state)).toEqual({
        [powerOf(first as number)]: 1,
        [powerOf(second as number)]: 1,
      });
    }
  });

  it("a card's own default advance walks the same order", () => {
    const start = game(3);
    const [, first, second] = start.state.mainScheme.stageOrder ?? [];
    expect(start.state.mainScheme.stageIndex).toBe(first);
    const next = play(start.state, ADVANCE_CARD.id).state;
    expect(next.mainScheme.stageIndex).toBe(second);
    expect(play(next, ADVANCE_CARD.id).state.mainScheme.stageIndex).toBe(STAGE_3);
  });

  it("with two removed, the walk is stage 1, the one stage 2 left, then stage 3", () => {
    const left = new Set<number>();
    for (const seed of SEEDS.slice(0, 20)) {
      const start = game(seed, TWO_REMOVED);
      const removed = removedOf(start.events);
      expect(new Set(removed).size).toBe(2);
      expect([...start.state.spentMainSchemeStages].sort()).toEqual([...removed].sort());
      const [only] = STAGE_2S.filter((stageIndex) => !removed.includes(stageIndex));
      left.add(only as number);
      expect(start.state.mainScheme.stageOrder).toEqual([0, only, STAGE_3]);
      expect(start.state.mainScheme.stageIndex).toBe(only);
      const after = play(start.state, PLOT_CARD.id);
      expect(after.state.mainScheme.stageIndex).toBe(STAGE_3);
      expect(advancedTo([...start.events, ...after.events])).toEqual([only, STAGE_3]);
    }
    expect([...left].sort()).toEqual([...STAGE_2S]);
  });

  it("asking for more than there are removes what there is; the advance then goes on to stage 3", () => {
    const { state, events } = game(2, ALL_ASKED);
    expect([...removedOf(events)].sort()).toEqual([...STAGE_2S]);
    expect([...state.spentMainSchemeStages].sort()).toEqual([...STAGE_2S]);
    expect(state.mainScheme.stageOrder).toEqual([0, STAGE_3]);
    expect(state.mainScheme.stageIndex).toBe(STAGE_3);
    expect(villainCounters(state)).toEqual({});
  });

  it("the current stage is never removed, and a stage already spent is not removed twice", () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const start = game(seed);
      const current = start.state.mainScheme.stageIndex;
      const [removedAtSetup] = removedOf(start.events);
      const [other] = STAGE_2S.filter((stageIndex) => stageIndex !== current && stageIndex !== removedAtSetup);
      // "Remove 9 random stage 2s" while a stage 2 is showing: only the one other unspent stage 2 goes.
      const { state, events } = play(start.state, PURGE_CARD.id);
      expect(removedOf(events)).toEqual([other]);
      expect(state.mainScheme.stageIndex).toBe(current);
      expect(schemeThreat(state)).toBe(1);
      expect(state.spentMainSchemeStages).toEqual([removedAtSetup, other]);
      expect(state.mainScheme.stageOrder).toEqual([0, current, STAGE_3]);
      expect(play(state, PLOT_CARD.id).state.mainScheme.stageIndex).toBe(STAGE_3);
    }
  });

  it("a removal after a shuffle drops the stage from the stored order", () => {
    const start = game(4, SHUFFLED_ONLY);
    expect(start.state.mainScheme.stageIndex).toBe(0);
    const before = start.state.mainScheme.stageOrder ?? [];
    expect(before).toHaveLength(5);
    expect(before[0]).toBe(0);
    expect(before[4]).toBe(STAGE_3);
    const { state, events } = play(start.state, PURGE_CARD.id);
    expect([...removedOf(events)].sort()).toEqual([...STAGE_2S]);
    expect(state.mainScheme.stageOrder).toEqual([0, STAGE_3]);
    expect(play(state, ADVANCE_CARD.id).state.mainScheme.stageIndex).toBe(STAGE_3);
  });
});

describe("§3.28 shuffleMainSchemeStages with a stage number", () => {
  it("orders only that group: stage 3 stays last, so the walk never reaches it early", () => {
    const orders = new Set<string>();
    for (const seed of SEEDS) {
      const { state } = game(seed, SHUFFLED_ONLY);
      const order = state.mainScheme.stageOrder ?? [];
      expect(order[0]).toBe(0);
      expect(order[4]).toBe(STAGE_3);
      expect([...order.slice(1, 4)].sort()).toEqual([...STAGE_2S]);
      orders.add(order.slice(1, 4).join(">"));
    }
    expect(orders.size).toBe(6);
  });

  it("shuffled while one of the group is showing, the others follow it and stage 3 follows them", () => {
    let state = play(game(6, SHUFFLED_ONLY).state, ADVANCE_CARD.id).state;
    const current = state.mainScheme.stageIndex;
    expect(STAGE_2S).toContain(current);
    // PURGE removes the other two and shuffles again; nothing is left of the group but the stage showing.
    state = play(state, PURGE_CARD.id).state;
    expect(state.mainScheme.stageOrder).toEqual([0, current, STAGE_3]);
    expect(nextMainSchemeStage(state, state.mainScheme)).toBe(STAGE_3);
  });
});

describe("§3.28 what the log says", () => {
  it("names the removed stage and holds no order the table could not work out", () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const { events } = game(seed);
      const kinds = events.filter((event) => event.type.startsWith("mainScheme")).map((event) => event.type);
      expect(kinds).toEqual(["mainSchemeStageRemoved", "mainSchemeStagesShuffled", "mainSchemeAdvanced"]);
      const [removed] = removedOf(events);
      const [showing] = advancedTo(events);
      // The removed stage and the one showing are public; the third stage 2 is the one left, so the order is known.
      const [left] = STAGE_2S.filter((stageIndex) => stageIndex !== removed && stageIndex !== showing);
      const shuffled = events.find((event) => event.type === "mainSchemeStagesShuffled");
      expect(shuffled).toMatchObject({ order: [0, showing, left, STAGE_3] });
    }
  });
});

describe("§3.28 determinism", () => {
  it("same seed, same removal and order", () => {
    for (const seed of [1, 7, 23]) {
      const a = game(seed);
      const b = game(seed);
      expect(a.state).toEqual(b.state);
      expect(a.events).toEqual(b.events);
    }
  });

  it("replays deep-equal through both completions", () => {
    let { state, session } = game(9);
    for (const cardId of [PLOT_CARD.id, PLOT_CARD.id]) {
      const given = giveCard(state, p1, cardId);
      ({ state, session } = runCommands(given.state, deps, {
        type: "playCard",
        playerId: p1,
        cardInstanceId: given.id,
        payment: [],
        attachToInstanceId: null,
      }));
      const replayed = replay(session.log, deps);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(state);
    }
    expect(state.mainScheme.stageIndex).toBe(STAGE_3);
  });
});

/**
 * MC40 p. 21: "The 'When Revealed' effect on Sinister Intent is resolved first. This advances the main scheme to a
 * random stage 2, which has both its A and B sides revealed. The 'When Revealed' effect on Mister Sinister II is
 * resolved last." RRG 1.8 Appendix II step 12 (p. 51) gives the same order (12b the main scheme's 1B, 12c the villain).
 * The advance's frames go above the villain's When Revealed already queued for step 12c, so they resolve first.
 */
describe("§3.28 expert setup order", () => {
  it("stage 1B's remove, shuffle and advance fully resolve before the villain's When Revealed", () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const { state, events } = game(seed, ONE_REMOVED, true);
      const scheme = state.mainScheme.instanceId;
      const current = state.mainScheme.stageIndex;
      expect(STAGE_2S).toContain(current);
      // The villain read stage number 2 and counted one mark, so it placed 2: on the stage 2, on top of its starting 1.
      expect(villainCounters(state)).toEqual({ [powerOf(current)]: 1, "stage-seen": 2 });
      expect(schemeThreat(state)).toBe(3);
      const trace = events.flatMap((event) =>
        event.type === "mainSchemeStageRemoved" ||
        event.type === "mainSchemeStagesShuffled" ||
        event.type === "mainSchemeAdvanced"
          ? [event.type]
          : event.type === "threatPlaced" && event.schemeInstanceId === scheme
            ? [`threatPlaced ${event.amount}`]
            : [],
      );
      expect(trace).toEqual([
        "mainSchemeStageRemoved",
        "mainSchemeStagesShuffled",
        "mainSchemeAdvanced",
        "threatPlaced 1",
        "threatPlaced 2",
      ]);
    }
  });

  it("with both other stage 2s gone the villain still sees the one stage 2 showing", () => {
    const { state } = game(5, TWO_REMOVED, true);
    expect(STAGE_2S).toContain(state.mainScheme.stageIndex);
    expect(villainCounters(state)).toEqual({ [powerOf(state.mainScheme.stageIndex)]: 1, "stage-seen": 2 });
    expect(schemeThreat(state)).toBe(3);
  });
});
