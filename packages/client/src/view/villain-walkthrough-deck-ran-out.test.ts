/**
 * Issue #984: "Stampede makes Rhino attack, then a second encounter card is revealed." The engine was right: the
 * player's deck ran out at the end of the player phase, which deals them a facedown encounter card (RRG 1.8 "Player
 * Deck", p. 33), and that card is revealed in step 4 ahead of the card step 3 deals. What was wrong is that nothing
 * said so: the log read "You are dealt a facedown encounter card." with no reason, and the walkthrough's step 3 said
 * "1 card each" while step 4 revealed two. A real Rhino game whose player deck holds one card, so the draw up to hand
 * size empties it, played on the engine's own commands.
 */
import { describe, expect, test } from "vitest";
import { type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { DevStateHost } from "../engine/dev-state-host.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { nextTurn } from "../store/dev-game-steps.js";
import { SessionStore } from "../store/session-store.js";
import { appendEvents, emptyLog } from "./log-lines.js";
import { encounterStripOf } from "./villain-encounter-strip.js";
import { villainRecapOf } from "./villain-recap.js";
import { appendWalkthrough, emptyWalkthrough, walkthroughSeededFrom } from "./villain-walkthrough.js";

const config = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 7,
} as const;

type Dealt = Extract<GameEvent, { type: "encounterCardDealt" }>;

/** The first turn's end and the villain phase after it, with the player's hand down to 1 card and their deck to 1. */
async function deckRunsOut() {
  const probe = new SessionStore(new LocalEngineHost());
  await probe.start(config);
  const state = probe.state.game!;
  const staged: GameState = {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      hand: player.hand.slice(0, 1),
      deck: player.deck.slice(0, 1),
      discard: [...player.discard, ...player.hand.slice(1), ...player.deck.slice(1)],
    })),
  };
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
  const before = store.state.game!;
  const turn = await nextTurn(store);
  await store.dispatch(turn!.legal.find((entry) => entry.action.kind === "endTurn")!.example);
  await nextTurn(store);
  const all = updates.flatMap((u) => u.events);
  const ranOut = all.find((e): e is Dealt => e.type === "encounterCardDealt" && e.source === "deckReset")!;
  const stepThree = all.find((e): e is Dealt => e.type === "encounterCardDealt" && e.source === "villainPhase")!;
  return { store, updates, all, before, ranOut, stepThree, me: store.state.perspectiveId! };
}

const revealOrder = (events: readonly GameEvent[]): InstanceId[] =>
  events.flatMap((e) => (e.type === "encounterCardRevealed" ? [e.instanceId] : []));

describe("the encounter card a deck running out deals (#984)", () => {
  test("the engine deals it before the villain phase and reveals it ahead of step 3's card", async () => {
    const { all, ranOut, stepThree } = await deckRunsOut();
    expect(all.some((e) => e.type === "playerDeckReset")).toBe(true);
    expect(ranOut).toBeDefined();
    expect(stepThree).toBeDefined();
    const order = revealOrder(all);
    expect(order.indexOf(ranOut.instanceId)).toBeGreaterThanOrEqual(0);
    expect(order.indexOf(ranOut.instanceId)).toBeLessThan(order.indexOf(stepThree.instanceId));
  });

  test("the log says the deal is because the deck ran out; step 3's deal reads as before", async () => {
    const { updates, me } = await deckRunsOut();
    let log = emptyLog();
    for (const u of updates) log = appendEvents(log, u.events, u.state, me, POOL_DEPS);
    const texts = log.lines.map((line) => line.text);
    expect(texts).toContain("You are dealt a facedown encounter card because your deck ran out.");
    expect(texts).toContain("You are dealt a facedown encounter card.");
    // Revealed since: the log no longer carries it.
    expect(log.dealtBefore).toEqual([]);
  });

  test("the strip lists it first, marked DECK RAN OUT, and the recap's step 3 says where it came from", async () => {
    const { updates, before, ranOut, stepThree, store, me } = await deckRunsOut();
    let walk = emptyWalkthrough(1);
    for (const u of updates) walk = appendWalkthrough(walk, u.events, u.state, me, POOL_DEPS);
    expect(walk.encounter.dealtBefore).toEqual([
      { instanceId: ranOut.instanceId, playerId: ranOut.playerId, source: "deckReset" },
    ]);
    const beatIds = walk.steps.flatMap((step) => step.beats).map((beat) => beat.encounterInstanceId);
    const strip = encounterStripOf(
      walk.encounter,
      beatIds,
      me,
      () => "Card",
      () => "Hero",
    );
    expect(strip.tiles.map((tile) => tile.instanceId)).toEqual([ranOut.instanceId, stepThree.instanceId]);
    expect(strip.tiles[0]!.marks).toEqual(["DECK RAN OUT"]);
    expect(strip.tiles[1]!.marks).toEqual([]);
    // It waited facedown from before the phase, so the strip shows it from the start, ahead of step 3's deal.
    const opening = encounterStripOf(
      walk.encounter,
      [],
      me,
      () => "Card",
      () => "Hero",
    );
    expect(opening.tiles.map((tile) => [tile.instanceId, tile.status])).toEqual([[ranOut.instanceId, "next"]]);

    const recap = villainRecapOf(walk, before, store.state.game!, me, POOL_DEPS);
    const deal = recap.columns.find((column) => column.number === 3)!;
    expect(deal.entries.map((entry) => entry.headline)).toEqual([
      "1 card each, facedown",
      "1 more card dealt earlier: your deck ran out",
    ]);
    expect(deal.entries[1]!.dealt.map((card) => card.instanceId)).toEqual([ranOut.instanceId]);
  });

  test("a walkthrough opened after the deal, seeded from the log, still knows the card", async () => {
    const { updates, ranOut, me } = await deckRunsOut();
    // The deal folded into the log in an earlier command; the phase's own events follow in a fresh walkthrough.
    const all = updates.flatMap((u) => u.events);
    const at = all.findIndex((e) => e.type === "encounterCardDealt" && e.source === "deckReset");
    const game = updates.at(-1)!.state;
    const log = appendEvents(emptyLog(), all.slice(0, at + 1), game, me, POOL_DEPS);
    expect(log.dealtBefore?.map((card) => card.instanceId)).toEqual([ranOut.instanceId]);
    const walk = appendWalkthrough(
      walkthroughSeededFrom(1, log.surgeDealt, log.dealtBefore),
      all.slice(at + 1),
      game,
      me,
      POOL_DEPS,
    );
    expect(walk.encounter.dealtBefore?.map((card) => card.instanceId)).toEqual([ranOut.instanceId]);
    // Revealed in this phase: nothing is carried into the next one.
    expect(walk.dealtBefore).toEqual([]);
  });
});

test("a card dealt earlier that leaves for the encounter discard unrevealed drops off the strip and the recap", async () => {
  const { updates, ranOut, me } = await deckRunsOut();
  const all = updates.flatMap((u) => u.events);
  const game = updates.at(-1)!.state;
  // Only the phase's opening: the card is carried in; then it is discarded unrevealed before step 4.
  const opening = all.findIndex(
    (e) => e.type === "stepChanged" && e.to.phase === "villain" && e.to.kind === "placeThreat",
  );
  let walk = appendWalkthrough(emptyWalkthrough(1), all.slice(0, opening + 1), game, me, POOL_DEPS);
  expect(walk.encounter.dealtBefore?.map((card) => card.instanceId)).toEqual([ranOut.instanceId]);
  const discarded = {
    type: "cardMoved",
    instanceId: ranOut.instanceId,
    from: { kind: "dealtEncounter", playerId: ranOut.playerId },
    to: { kind: "encounterDiscard", deckId: "e1" },
  } as unknown as GameEvent;
  walk = appendWalkthrough(walk, [discarded], game, me, POOL_DEPS);
  expect(walk.encounter.dealtBefore).toEqual([]);
  expect(walk.dealtBefore).toEqual([]);
});
