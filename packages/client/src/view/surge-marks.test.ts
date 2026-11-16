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
import { appendEvents, emptyLog } from "./log-lines.js";
import { encounterStripOf } from "./villain-encounter-strip.js";
import { appendWalkthrough, emptyWalkthrough, walkthroughSeededFrom } from "./villain-walkthrough.js";

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
    const dealt = updates[dealtAt]!.events.find(
      (e): e is Extract<GameEvent, { type: "encounterCardDealt" }> =>
        e.type === "encounterCardDealt" && e.source === "surge",
    )!;
    const reveal = updates
      .flatMap((u) => u.events)
      .find((e) => e.type === "encounterCardRevealed" && e.instanceId === dealt.instanceId)!;
    const game = store.state.game!;
    // The deal in one command, the reveal alone in the next.
    let log = appendEvents(emptyLog(), [dealt], game, me, POOL_DEPS);
    log = appendEvents(log, [reveal], game, me, POOL_DEPS);
    expect(log.lines.at(-1)?.text).toMatch(/\(from surge\)\.$/);
    expect(log.surgeDealt).toEqual([]);
  });

  /** The surge deal and the reveal of one card from a real game, to be arranged in different orders. */
  async function surgeCardEvents() {
    const { store, updates } = await surgeGame();
    const all = updates.flatMap((u) => u.events);
    const surgeDeal = all.find(
      (e): e is Extract<GameEvent, { type: "encounterCardDealt" }> =>
        e.type === "encounterCardDealt" && e.source === "surge",
    )!;
    const reveal = all.find((e) => e.type === "encounterCardRevealed" && e.instanceId === surgeDeal.instanceId)!;
    const normalDeal = { ...surgeDeal, source: "villainPhase" } as GameEvent;
    return { store, surgeDeal: surgeDeal as GameEvent, reveal, normalDeal };
  }

  test("one folded history marks a reveal only when a surge deal came before it", async () => {
    const { store, surgeDeal, reveal, normalDeal } = await surgeCardEvents();
    const me = store.state.perspectiveId!;
    const game = store.state.game!;
    // Revealed normally first, surge-dealt and revealed later: a look-ahead would mark both.
    const early = appendEvents(emptyLog(), [normalDeal, reveal, surgeDeal, reveal], game, me, POOL_DEPS);
    const earlyReveals = early.lines.filter((line) => line.text.startsWith("You revealed"));
    expect(earlyReveals.map((line) => line.text.includes("(from surge)"))).toEqual([false, true]);
    // Surge-dealt and revealed, then dealt normally and revealed again: the mark does not outlive its reveal.
    const later = appendEvents(emptyLog(), [surgeDeal, reveal, normalDeal, reveal], game, me, POOL_DEPS);
    const laterReveals = later.lines.filter((line) => line.text.startsWith("You revealed"));
    expect(laterReveals.map((line) => line.text.includes("(from surge)"))).toEqual([true, false]);
    // A normal deal clears a mark the reveal never used.
    const cleared = appendEvents(emptyLog(), [surgeDeal, normalDeal, reveal], game, me, POOL_DEPS);
    expect(cleared.lines.at(-1)?.text).not.toMatch(/from surge/);
  });

  test("the recap marks a card surge-dealt outside the villain phase when its reveal comes, as the log does", async () => {
    const { store, surgeDeal, reveal } = await surgeCardEvents();
    const me = store.state.perspectiveId!;
    const game = store.state.game!;
    const { updates } = await surgeGame();
    const rest = updates
      .flatMap((u) => u.events)
      .filter((e) => e !== surgeDeal && !(e.type === "encounterCardDealt" && e.source === "surge"));
    const revealText = (walk: ReturnType<typeof emptyWalkthrough>) =>
      walk.steps
        .flatMap((step) => step.beats)
        .filter((beat) => beat.eventType === "encounterCardRevealed")
        .map((beat) => beat.text);
    // The surge deal arrives in a command of its own, outside any villain phase; the phase's events follow.
    let walk = appendWalkthrough(emptyWalkthrough(1), [surgeDeal], game, me, POOL_DEPS);
    walk = appendWalkthrough(walk, rest, game, me, POOL_DEPS);
    const marked = revealText(walk).filter((text) => text.includes("(from surge)"));
    expect(marked).toHaveLength(1);
    expect(reveal.type).toBe("encounterCardRevealed");
    // With no earlier deal seen, the same phase marks nothing.
    const bare = appendWalkthrough(emptyWalkthrough(1), rest, game, me, POOL_DEPS);
    expect(revealText(bare).some((text) => /from surge/.test(text))).toBe(false);
  });

  test("a phase opened after the player phase's surge deal, seeded from the log, marks the reveal beat", async () => {
    const { store, surgeDeal, reveal } = await surgeCardEvents();
    const me = store.state.perspectiveId!;
    const game = store.state.game!;
    const { updates } = await surgeGame();
    const rest = updates
      .flatMap((u) => u.events)
      .filter((e) => e !== surgeDeal && !(e.type === "encounterCardDealt" && e.source === "surge"));
    // The deal is folded into the log in the player phase's command; the scene is launched fresh afterwards with
    // only what the log carried, never the Walkthrough value that saw the deal.
    const log = appendEvents(emptyLog(), [surgeDeal], game, me, POOL_DEPS);
    // In the real flow the deal's own move happened in the player phase, so the phase holds no deal of the card.
    const surgedId = (surgeDeal as Extract<GameEvent, { type: "encounterCardDealt" }>).instanceId;
    const inPhase = rest.filter(
      (e) => !(e.type === "cardMoved" && e.instanceId === surgedId && e.to.kind === "dealtEncounter"),
    );
    const walk = appendWalkthrough(walkthroughSeededFrom(1, log.surgeDealt), inPhase, game, me, POOL_DEPS);
    const texts = walk.steps
      .flatMap((step) => step.beats)
      .filter((beat) => beat.eventType === "encounterCardRevealed")
      .map((beat) => beat.text);
    expect(reveal.type).toBe("encounterCardRevealed");
    expect(texts.filter((text) => text.includes("(from surge)"))).toHaveLength(1);
    // The strip marks the tile too, though the card has no in-phase deal; only once its reveal beat is shown.
    const revealId = (reveal as Extract<GameEvent, { type: "encounterCardRevealed" }>).instanceId;
    const beatIds = walk.steps.flatMap((step) => step.beats).map((beat) => beat.encounterInstanceId);
    const strip = (shown: number) =>
      encounterStripOf(
        walk.encounter,
        beatIds.slice(0, shown),
        me,
        () => "Card",
        () => "Hero",
      );
    expect(walk.encounter.dealt.some((card) => card.instanceId === revealId)).toBe(false);
    expect(strip(beatIds.length).tiles.find((tile) => tile.instanceId === revealId)?.marks).toContain("FROM SURGE");
    expect(strip(0).tiles.find((tile) => tile.instanceId === revealId)).toBeUndefined();
    // No marks carried over: nothing is marked.
    const bare = appendWalkthrough(walkthroughSeededFrom(1, undefined), rest, game, me, POOL_DEPS);
    expect(bare.steps.flatMap((step) => step.beats).some((beat) => /from surge/.test(beat.text))).toBe(false);
  });

  test("a surge-dealt card discarded unrevealed loses its mark, in the log and the recap", async () => {
    const { store, surgeDeal, reveal } = await surgeCardEvents();
    const me = store.state.perspectiveId!;
    const game = store.state.game!;
    const id = (surgeDeal as Extract<GameEvent, { type: "encounterCardDealt" }>).instanceId;
    const discard = {
      type: "cardMoved",
      instanceId: id,
      cardId: game.instances[id]!.cardId,
      from: { kind: "dealtEncounter", playerId: me },
      to: { kind: "encounterDiscard", deckId: "scenario" },
    } as unknown as GameEvent;
    const log = appendEvents(emptyLog(), [surgeDeal, discard, reveal], game, me, POOL_DEPS);
    expect(log.lines.at(-1)?.text).toMatch(/^You revealed /);
    expect(log.lines.at(-1)?.text).not.toMatch(/from surge/);
    const stateBefore = appendEvents(emptyLog(), [surgeDeal], game, me, POOL_DEPS);
    expect(stateBefore.surgeDealt).toEqual([id]);
    const kept = appendEvents(stateBefore, [discard], game, me, POOL_DEPS);
    expect(kept.surgeDealt).toEqual([]);
    const walk = appendWalkthrough(emptyWalkthrough(1), [surgeDeal, discard], game, me, POOL_DEPS);
    expect(walk.surgeDealt).toEqual([]);
  });

  test("one batch holding a reveal and its later surge shows SURGE only once playback reaches the surge beat", async () => {
    const { store, surger, updates } = await surgeGame();
    const me = store.state.perspectiveId!;
    const game = store.state.game!;
    // Every event of the phase as one command, as the engine can deliver it.
    const walk = appendWalkthrough(
      emptyWalkthrough(1),
      updates.flatMap((u) => u.events),
      game,
      me,
      POOL_DEPS,
    );
    const beats = walk.steps.flatMap((step) => step.beats);
    const ids = beats.map((beat) => beat.encounterInstanceId ?? null);
    const stripAt = (shown: number) =>
      encounterStripOf(
        walk.encounter,
        ids.slice(0, shown),
        me,
        (id) => id,
        () => "x",
      );
    const marksOf = (shown: number) => stripAt(shown).tiles.find((tile) => tile.instanceId === surger)?.marks;
    const revealBeat = beats.findIndex(
      (beat) => beat.eventType === "encounterCardRevealed" && beat.encounterInstanceId === surger,
    );
    const surgeAt = walk.encounter.surgedAt!.find((entry) => entry.instanceId === surger)!.atBeat;
    expect(revealBeat).toBeGreaterThanOrEqual(0);
    // The surge comes after the reveal, with beats between that the recap has yet to show.
    expect(surgeAt).toBeGreaterThan(revealBeat);
    // The reveal is on screen, the surge's beat is not: no SURGE yet.
    expect(marksOf(revealBeat + 1)).toEqual([]);
    expect(marksOf(surgeAt)).toEqual([]);
    // Playback past the surge beat: SURGE.
    expect(marksOf(surgeAt + 1)).toEqual(["SURGE"]);
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
    // Before the surging card's reveal is on screen, nothing is marked: it is still facedown. Stop just short of
    // the reveal, with tiles on the strip, so the check cannot pass on an empty list.
    const revealAt = shown.findIndex((id) => id === surger);
    expect(revealAt).toBeGreaterThanOrEqual(0);
    const early = encounterStripOf(
      walk.encounter,
      shown.slice(0, revealAt),
      me,
      (id) => id,
      () => "x",
    );
    expect(early.tiles.length).toBeGreaterThan(0);
    expect(early.tiles.every((tile) => tile.marks.length === 0)).toBe(true);
  });
});
