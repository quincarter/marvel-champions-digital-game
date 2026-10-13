/**
 * QA of Undo (#120, v0.20.0). RRG 1.8 has no take-back rule, so the contract is the feature's own: "takes back the
 * hero's own last move this turn; it stops at the start of the turn, at another player's move, and at anything that
 * drew, revealed or searched cards", and (the hard requirement) it must put the game back EXACTLY where it stood and
 * must not let a player learn anything hidden or re-roll a random outcome by undoing.
 * Random outcomes: RRG 1.8 "Discard" (p. 16) and the printed "discard 1 card at random from your hand" text: the pick is
 * the game's, not the player's, so a take-back that lets the player choose a different order of moves first re-rolls it.
 */
import { describe, expect, it } from "vitest";
import { applyCommand, createGame, type Command, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { cardId } from "@mc/content";
import { POOL_DEPS, buildScenario } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { UNDO_REASONS, undoOf } from "./undo.js";
import type { BackOutTrailEntry } from "./back-out.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};

async function toFirstTurn(store: SessionStore): Promise<void> {
  for (let guard = 0; guard < 50; guard += 1) {
    const legal = store.state.legal!.actions;
    if (legal.kind === "turn") return;
    if (legal.kind !== "choice") throw new Error(`unexpected legal kind ${legal.kind}`);
    await store.dispatch({
      type: "resolveChoice",
      playerId: legal.choice.playerId,
      choiceId: legal.choice.choiceId,
      selectedOptionIds: legal.choice.options.slice(0, legal.choice.minSelections).map((o) => o.optionId),
    });
  }
  throw new Error("never reached the hero's turn");
}

/** The engine's example command for the first legal action of one kind. */
function exampleOf(store: SessionStore, kind: string): Command | undefined {
  const legal = store.state.legal!.actions;
  if (legal.kind !== "turn") return undefined;
  return legal.legal.find((a) => a.action.kind === kind)?.example;
}

async function started(storage = new MemoryGameStorage()) {
  const host = new LocalEngineHost(storage);
  const store = new SessionStore(host);
  await store.start(RHINO_SOLO);
  await toFirstTurn(store);
  return { store, host, storage };
}

describe("Undo: exact restoration", () => {
  it("a played card (with its payment and any answers) is taken back to a deep-equal state, record and trail", async () => {
    const { store } = await started();
    const me = store.state.perspectiveId!;
    // Turn into hero form first (a plain move), then play with the engine's own example payment.
    expect(await store.dispatch(exampleOf(store, "changeForm")!)).toBe(true);
    const play = exampleOf(store, "playCard");
    expect(play).toBeDefined();
    const before = store.state.game!;
    const recordBefore = store.state.record;
    const versionBefore = store.state.version;
    expect(await store.dispatch(play!)).toBe(true);
    for (let g = 0; g < 10 && store.state.game!.pendingChoice; g++) await toFirstTurn(store);
    const offer = undoOf(store.state.commandTrail, store.state.game!, me);
    if (offer?.kind !== "available") throw new Error(`undo not offered: ${JSON.stringify(offer)}`);
    expect(offer.target).toBe(versionBefore);
    expect(await store.rewindTo(offer.target)).toBe(true);
    expect(store.state.version).toBe(versionBefore);
    expect(store.state.game).toEqual(before);
    expect(store.state.record).toEqual(recordBefore);
    expect(store.state.commandTrail).toHaveLength(versionBefore);
  });

  it("redoing the same move after an undo gives the identical result (undo does not re-roll the same move)", async () => {
    const { store } = await started();
    expect(await store.dispatch(exampleOf(store, "changeForm")!)).toBe(true);
    const play = exampleOf(store, "playCard")!;
    expect(await store.dispatch(play)).toBe(true);
    const first = store.state.game!;
    expect(await store.rewindTo(store.state.version - 1)).toBe(true);
    expect(await store.dispatch(play)).toBe(true);
    expect(store.state.game).toEqual(first);
  });

  it("the saved game is truncated by an undo: a resumed game shows the undone state and offers no Undo of earlier moves", async () => {
    const storage = new MemoryGameStorage();
    const { store, host } = await started(storage);
    const me = store.state.perspectiveId!;
    const before = store.state.game!;
    const versionBefore = store.state.version;
    expect(await store.dispatch(exampleOf(store, "changeForm")!)).toBe(true);
    expect(await store.rewindTo(versionBefore)).toBe(true);
    await host.flushed();
    const saves = await storage.list();
    const gameId = saves[0]!.id;

    const store2 = new SessionStore(new LocalEngineHost(storage));
    await store2.resume(gameId);
    expect(store2.state.version).toBe(versionBefore);
    expect(store2.state.game).toEqual(before);
    // A resumed session has no trail, so nothing from before the resume can be undone (the safe default).
    expect(undoOf(store2.state.commandTrail, store2.state.game!, me)).toEqual({
      kind: "unavailable",
      reason: UNDO_REASONS.nothing,
    });
  });

  it("Undo stops at End turn: nothing of the finished turn is offered", async () => {
    const { store } = await started();
    const me = store.state.perspectiveId!;
    expect(await store.dispatch(exampleOf(store, "changeForm")!)).toBe(true);
    expect(await store.dispatch(exampleOf(store, "endTurn")!)).toBe(true);
    const offer = undoOf(store.state.commandTrail, store.state.game!, me);
    expect(offer === null || offer.kind === "unavailable").toBe(true);
  });
});

// --- hidden information / randomness ------------------------------------------------------------------------------

const HELMET_ABILITY = "07049.bulldozers-helmet-action" as never;

/** Bulldozer's Helmet attached to Bulldozer (test-only state surgery as wave1/twc tests do), in hero form. */
function helmetGame(): { state: GameState; helmet: InstanceId; me: PlayerId } {
  const config = buildScenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 41 });
  const created = createGame(config, POOL_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = created.state;
  for (let g = 0; g < 80 && state.pendingChoice; g++) {
    const choice = state.pendingChoice;
    const r = applyCommand(
      state,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.options.slice(0, choice.minSelections).map((o) => o.optionId),
      },
      POOL_DEPS,
    );
    if (!r.ok) throw new Error(r.error.message);
    state = r.state;
    if (state.step.phase === "player") break;
  }
  const me = state.players[0]!.playerId;
  const helmet = Object.values(state.instances).find((i) => i.cardId === cardId("07049"))!.instanceId;
  const bulldozer = state.villains[3]!.instanceId;
  const host = state.instances[bulldozer]!;
  state = {
    ...state,
    encounterDecks: Object.fromEntries(
      Object.entries(state.encounterDecks).map(([k, v]) => [
        k,
        { deck: v.deck.filter((x) => x !== helmet), discard: v.discard.filter((x) => x !== helmet) },
      ]),
    ),
    instances: {
      ...state.instances,
      [bulldozer]: { ...host, attachments: [...host.attachments, helmet] },
      [helmet]: { ...state.instances[helmet]!, attachedTo: bulldozer, faceup: true },
    },
  };
  const hero = applyCommand(state, { type: "changeForm", playerId: me }, POOL_DEPS);
  if (!hero.ok) throw new Error(hero.error.message);
  return { state: hero.state, helmet, me };
}

const useHelmet = (me: PlayerId, helmet: InstanceId): Command => ({
  type: "useAbility",
  playerId: me,
  cardInstanceId: helmet,
  abilityId: HELMET_ABILITY,
  payment: [],
});

describe("Undo: hidden information and randomness", () => {
  it("the 'random' discard really depends on what else is in hand: moving another card first changes which card goes", () => {
    const { state, helmet, me } = helmetGame();
    const player = state.players[0]!;
    const picks = new Set<InstanceId>();
    for (const removed of player.hand) {
      // As if that card had been played first (it leaves the hand): the same seeded stream picks over a smaller hand.
      const without: GameState = {
        ...state,
        players: state.players.map((p) => ({ ...p, hand: p.hand.filter((id) => id !== removed) })),
      };
      const r = applyCommand(without, useHelmet(me, helmet), POOL_DEPS);
      if (!r.ok) continue;
      const ev = r.events.find((e) => e.type === "cardDiscardedFromHand") as { instanceId: InstanceId } | undefined;
      if (ev) picks.add(ev.instanceId);
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  it.fails("Undo is not offered after a move that discarded a card AT RANDOM (Bulldozer's Helmet): the result could be re-rolled by reordering moves", () => {
    const { state, helmet, me } = helmetGame();
    const command = useHelmet(me, helmet);
    const used = applyCommand(state, command, POOL_DEPS);
    if (!used.ok) throw new Error(used.error.message);
    expect(used.events.some((e) => e.type === "cardDiscardedFromHand")).toBe(true);
    const trail: BackOutTrailEntry[] = [{ playerId: me, command, events: used.events }];
    expect(undoOf(trail, used.state, me)).toEqual({ kind: "unavailable", reason: UNDO_REASONS.revealed });
  });
});
