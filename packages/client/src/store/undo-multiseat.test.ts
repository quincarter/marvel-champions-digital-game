/**
 * Undo in a two-seat hot-seat game, played through the real store and engine (the v0.20.0 QA could only read this from
 * code): another seat's off-turn Action in the middle of the move stops Undo there, and the hero's own move after it
 * is still theirs to take back.
 */
import { describe, expect, test } from "vitest";
import type { PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { UNDO_REASONS, undoOf } from "../view/undo.js";
import { codeOf } from "./dev-game-steps.js";
import { MULLIGAN_CARD, startOffTurnDevGame } from "./dev-off-turn-game.js";
import { SessionStore } from "./session-store.js";

async function offTurnGame() {
  const store = new SessionStore(new LocalEngineHost());
  await startOffTurnDevGame(store);
  for (let i = 0; i < 50 && store.state.offTurnSeats.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
  const [p1, p2] = store.state.game!.players;
  return { store, p1: p1!.playerId, p2: p2!.playerId };
}

/** P2 plays Mulligan off turn: the first legal play, paid with three other cards from hand. */
async function playMulligan(store: SessionStore, p2: PlayerId): Promise<void> {
  expect(await store.takeOffTurnSeat(p2)).toBe(true);
  const actions = store.state.legal!.actions;
  if (actions.kind !== "notYourTurn") throw new Error("expected an off-turn offer");
  const entry = actions.legal.find((e) => e.action.kind === "playCard")!;
  const game = store.state.game!;
  const other = game.players[1]!.hand.filter((id) => codeOf(game, id) !== MULLIGAN_CARD).slice(0, 3);
  const played = await store.dispatch({ ...entry.example, payment: other.map((fromHand) => ({ fromHand })) } as never);
  expect(played).toBe(true);
}

function ownMove(store: SessionStore) {
  const turn = store.state.legal!.actions;
  if (turn.kind !== "turn") throw new Error("expected P1's turn");
  return turn.legal.find((e) => e.action.kind === "changeForm" || e.action.kind === "basicRecover")!.example;
}

describe("Undo with more than one seat", () => {
  test("the active hero's move is undoable until another seat acts after it", async () => {
    const { store, p1, p2 } = await offTurnGame();
    expect(await store.dispatch(ownMove(store))).toBe(true);
    expect(undoOf(store.state.commandTrail, store.state.game!, p1)).toMatchObject({ kind: "available" });

    // P2 answers with an off-turn Action: the last command in the trail is theirs, so P1's Undo stops.
    await playMulligan(store, p2);
    expect(store.state.perspectiveId).toBe(p1);
    expect(store.state.commandTrail.at(-1)!.playerId).toBe(p2);
    expect(undoOf(store.state.commandTrail, store.state.game!, p1)).toEqual({
      kind: "unavailable",
      reason: UNDO_REASONS.otherPlayer,
    });
  });

  test("P1's own move after an off-turn Action by P2 can be undone, and only that move", async () => {
    const { store, p1, p2 } = await offTurnGame();
    await playMulligan(store, p2);
    expect(store.state.perspectiveId).toBe(p1);
    const before = store.state.game!;
    const versionBefore = store.state.version;
    expect(await store.dispatch(ownMove(store))).toBe(true);
    const offer = undoOf(store.state.commandTrail, store.state.game!, p1);
    expect(offer).toMatchObject({ kind: "available", target: versionBefore });
    if (offer?.kind !== "available") return;
    expect(await store.rewindTo(offer.target)).toBe(true);
    expect(store.state.game).toEqual(before);
    // Undo again would reach into P2's Action: refused.
    expect(undoOf(store.state.commandTrail, store.state.game!, p1)).toMatchObject({ kind: "unavailable" });
  });

  test("the other seat has no Undo on a turn that is not theirs", async () => {
    const { store, p2 } = await offTurnGame();
    expect(undoOf(store.state.commandTrail, store.state.game!, p2)).toBeNull();
  });
});
