/**
 * Issue #764: the log and the villain phase recap mark the card that surged and the card its surge dealt. A real Rhino
 * game with a printed-surge card staged on top of the encounter deck, played on the engine's own commands; the marks
 * come from the engine's `surgeTriggered` and the `encounterCardDealt` source, never from the order cards came up in.
 */
import { describe, expect, test } from "vitest";
import { type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { DevStateHost } from "../engine/dev-state-host.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { nextTurn } from "../store/dev-game-steps.js";
import { SessionStore } from "../store/session-store.js";
import { appendEvents, emptyLog, logLine } from "./log-lines.js";
import { encounterStripOf } from "./villain-encounter-strip.js";
import { appendWalkthrough, emptyWalkthrough } from "./villain-walkthrough.js";

const config = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 7,
} as const;

/** The villain phase of `staged` played on the engine's own commands, every update's events kept. */
async function play(staged: GameState) {
  const store = new SessionStore(new DevStateHost(staged, POOL_DEPS));
  await store.start(config);
  const updates: { events: readonly GameEvent[]; state: GameState }[] = [];
  let last: readonly GameEvent[] | null = null;
  store.subscribe((s) => {
    if (s.game && s.lastEvents !== last) {
      last = s.lastEvents;
      updates.push({ events: s.lastEvents, state: s.game });
    }
  });
  const turn = await nextTurn(store);
  await store.dispatch(turn!.legal.find((entry) => entry.action.kind === "endTurn")!.example);
  await nextTurn(store);
  return { store, updates };
}

/** A Rhino game where the first card dealt in the villain phase is a core treachery that prints surge. */
async function surgeGame() {
  const probe = new SessionStore(new LocalEngineHost());
  await probe.start(config);
  const state = probe.state.game!;
  // Rhino's own deck prints no surge: the first card dealt becomes one that does (an instance keeps its id).
  const first = (await play(state)).updates
    .flatMap((u) => u.events)
    .find((e) => e.type === "encounterCardDealt" && e.source === "villainPhase")!;
  const surger = (first as Extract<GameEvent, { type: "encounterCardDealt" }>).instanceId;
  const surgeCard = POOL_CARDS.find(
    (card) => card.type === "treachery" && card.keywords?.some((keyword) => keyword.name === "surge"),
  )!;
  const staged: GameState = {
    ...state,
    instances: { ...state.instances, [surger]: { ...state.instances[surger]!, cardId: surgeCard.id } },
  };
  return { ...(await play(staged)), surger };
}

describe("surge marks in the log and the recap (#764)", () => {
  test("the log names the card that surged and marks the card it dealt", async () => {
    const { store, surger, updates } = await surgeGame();
    const me = store.state.perspectiveId!;
    const all = updates.flatMap((u) => u.events);
    const surged = all.find((e) => e.type === "surgeTriggered");
    expect(surged && surged.type === "surgeTriggered" && surged.instanceId).toBe(surger);
    const dealt = all.find((e) => e.type === "encounterCardDealt" && e.source === "surge");
    expect(dealt).toBeDefined();
    const id = (dealt as Extract<GameEvent, { type: "encounterCardDealt" }>).instanceId;

    let log = emptyLog();
    for (const u of updates) log = appendEvents(log, u.events, u.state, me, POOL_DEPS);
    const texts = log.lines.map((line) => line.text);
    const name = (instanceId: InstanceId) => CARDS_BY_ID.get(store.state.game!.instances[instanceId]!.cardId)!.name;
    expect(texts).toContain(`${name(surger)} surges — You are dealt another encounter card.`);
    expect(texts).toContain(`You revealed ${name(id)} (from surge).`);
    // The card that surged was dealt by the villain phase: no mark on its own reveal.
    expect(texts).toContain(`You revealed ${name(surger)}.`);
  });

  test("a reveal in a later command than its surge deal is still marked", async () => {
    const { store, updates } = await surgeGame();
    const me = store.state.perspectiveId!;
    const dealtAt = updates.findIndex((u) =>
      u.events.some((e) => e.type === "encounterCardDealt" && e.source === "surge"),
    );
    const reveal = updates.flatMap((u) => u.events).find((e) => e.type === "encounterCardRevealed")!;
    let log = emptyLog();
    log = appendEvents(log, updates[dealtAt]!.events, updates[dealtAt]!.state, me, POOL_DEPS);
    const later = logLine(
      { ...reveal, instanceId: log.surgeDealt![0]! },
      store.state.game!,
      me,
      POOL_DEPS,
      false,
      undefined,
      { events: [], at: 0, surgeDealt: log.surgeDealt! },
    );
    expect(later?.text).toMatch(/\(from surge\)\.$/);
  });

  test("the recap's strip marks SURGE on the card that surged and FROM SURGE on the card it dealt", async () => {
    const { store, surger, updates } = await surgeGame();
    const me = store.state.perspectiveId!;
    let walk = emptyWalkthrough(1);
    for (const u of updates) walk = appendWalkthrough(walk, u.events, u.state, me, POOL_DEPS);
    const dealtBySurge = walk.encounter.dealt.filter((card) => card.fromSurge);
    expect(dealtBySurge).toHaveLength(1);
    expect(walk.encounter.surged).toEqual([surger]);

    const shown = walk.steps.flatMap((step) => step.beats.map((beat) => beat.encounterInstanceId ?? null));
    const strip = encounterStripOf(
      walk.encounter,
      shown,
      me,
      (id) => id,
      () => "x",
    );
    const marked = (instanceId: InstanceId) => strip.tiles.find((tile) => tile.instanceId === instanceId)?.marks;
    expect(marked(surger)).toEqual(["SURGE"]);
    expect(marked(dealtBySurge[0]!.instanceId)).toEqual(["FROM SURGE"]);
    const others = strip.tiles.filter((t) => t.instanceId !== surger && t.instanceId !== dealtBySurge[0]!.instanceId);
    expect(others.every((tile) => tile.marks.length === 0)).toBe(true);
    // Before the surging card's reveal is on screen, nothing is marked: it is still facedown.
    const early = encounterStripOf(
      walk.encounter,
      [],
      me,
      (id) => id,
      () => "x",
    );
    expect(early.tiles.every((tile) => tile.marks.length === 0)).toBe(true);
  });
});
