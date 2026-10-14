import { describe, expect, test } from "vitest";
import type { Command, GameEvent, GameState, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import type { BackOutTrailEntry } from "./back-out.js";
import { UNDO_REASONS, undoOf, undoTargetsOf } from "./undo.js";

const P1 = "p1" as PlayerId;
const P2 = "p2" as PlayerId;

type GameLike = Pick<GameState, "outcome" | "pendingChoice" | "step">;

function turnOf(activePlayerId: PlayerId, extra: Partial<GameLike> = {}): GameLike {
  return {
    outcome: null,
    pendingChoice: null,
    step: { phase: "player", kind: "turn", activePlayerId, remainingPlayerIds: [] },
    ...extra,
  } as GameLike;
}

const command = (type: Command["type"], playerId: PlayerId = P1): Command =>
  ({
    type,
    playerId,
    cardInstanceId: "i1",
    abilityId: "a1",
    payment: [],
    attachToInstanceId: null,
  }) as unknown as Command;

const entry = (cmd: Command, events: readonly GameEvent[] = []): BackOutTrailEntry => ({
  playerId: cmd.playerId,
  command: cmd,
  events,
});

const event = (type: string, extra: object = {}): GameEvent => ({ type, ...extra }) as unknown as GameEvent;

describe("undoOf", () => {
  test("offers nothing off the hero's own turn, while a choice is open, or once the game is over", () => {
    const trail = [entry(command("playCard"))];
    expect(undoOf(trail, turnOf(P2), P1)).toBeNull();
    expect(undoOf(trail, turnOf(P1, { pendingChoice: {} as GameState["pendingChoice"] }), P1)).toBeNull();
    expect(undoOf(trail, turnOf(P1, { outcome: "won" as unknown as GameState["outcome"] }), P1)).toBeNull();
    expect(
      undoOf(trail, { ...turnOf(P1), step: { phase: "villain", kind: "placeThreat" } } as GameLike, P1),
    ).toBeNull();
  });

  test("takes back the last move with every answer its resolution asked for", () => {
    const trail = [
      entry(command("endTurn", P2), [event("turnStarted", { playerId: P1 })]),
      entry(command("basicThwart")),
      entry(command("playCard")),
      entry(command("resolveChoice")),
      entry(command("resolveChoice")),
    ];
    const offer = undoOf(trail, turnOf(P1), P1);
    expect(offer).toMatchObject({ kind: "available", target: 2 });
    // Undo again from there: the move before it.
    expect(undoOf(trail.slice(0, 2), turnOf(P1), P1)).toMatchObject({ kind: "available", target: 1 });
  });

  test("stops at the start of the turn", () => {
    const trail = [entry(command("endTurn", P2), [event("turnStarted", { playerId: P1 })])];
    expect(undoOf(trail, turnOf(P1), P1)).toEqual({ kind: "unavailable", reason: UNDO_REASONS.nothing });
    expect(undoOf([], turnOf(P1), P1)).toEqual({ kind: "unavailable", reason: UNDO_REASONS.nothing });
  });

  test("stops at a move that drew or revealed a card, so a new hand can't be fished for", () => {
    const trail = [
      entry(command("basicThwart")),
      entry(command("useAbility"), [event("cardDrawn", { playerId: P1, instanceId: "x" })]),
    ];
    expect(undoOf(trail, turnOf(P1), P1)).toEqual({ kind: "unavailable", reason: UNDO_REASONS.revealed });
  });

  test("never takes back another player's move or answer", () => {
    expect(undoOf([entry(command("useAbility", P2))], turnOf(P1), P1)).toEqual({
      kind: "unavailable",
      reason: UNDO_REASONS.otherPlayer,
    });
    const answeredByP2 = [entry(command("playCard")), entry(command("resolveChoice", P2))];
    expect(undoOf(answeredByP2, turnOf(P1), P1)).toEqual({ kind: "unavailable", reason: UNDO_REASONS.otherPlayer });
  });

  test("never takes back a move that crossed a turn or step boundary", () => {
    const trail = [entry(command("basicAttack"), [event("stepChanged")])];
    expect(undoOf(trail, turnOf(P1), P1)).toEqual({ kind: "unavailable", reason: UNDO_REASONS.boundary });
  });
});

describe("undoTargetsOf", () => {
  test("lists every point repeated Undo reaches, newest first, and stops where Undo stops", () => {
    const trail = [
      entry(command("endTurn", P2), [event("turnStarted", { playerId: P1 })]),
      entry(command("useAbility"), [event("cardDrawn", { playerId: P1, instanceId: "x" })]),
      entry(command("basicThwart")),
      entry(command("playCard")),
      entry(command("resolveChoice")),
    ];
    expect(undoTargetsOf(trail, turnOf(P1), P1)).toEqual([3, 2]);
  });

  test("lists nothing when Undo isn't offered", () => {
    expect(undoTargetsOf([entry(command("playCard"))], turnOf(P2), P1)).toEqual([]);
    expect(undoTargetsOf([], turnOf(P1), P1)).toEqual([]);
  });
});

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};

describe("Undo in a real game", () => {
  /** Answers every setup choice with its first options until the hero's turn is open. */
  async function toFirstTurn(store: SessionStore): Promise<void> {
    for (let guard = 0; guard < 50; guard += 1) {
      const legal = store.state.legal!.actions;
      if (legal.kind === "turn") return;
      if (legal.kind !== "choice") throw new Error(`unexpected legal kind ${legal.kind}`);
      const ok = await store.dispatch({
        type: "resolveChoice",
        playerId: legal.choice.playerId,
        choiceId: legal.choice.choiceId,
        selectedOptionIds: legal.choice.options.slice(0, legal.choice.minSelections).map((o) => o.optionId),
      });
      expect(ok).toBe(true);
    }
    throw new Error("never reached the hero's turn");
  }

  test("a change of form is taken back to exactly the state before it, and ending the turn ends undo", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(RHINO_SOLO);
    await toFirstTurn(store);
    const me = store.state.perspectiveId!;
    const before = store.state.game!;
    const versionBefore = store.state.version;

    const legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected the hero's turn");
    const flip = legal.legal.find((a) => a.action.kind === "changeForm");
    expect(flip).toBeDefined();
    expect(await store.dispatch(flip!.example)).toBe(true);
    expect(store.state.game!.players[0]!.identity.form).not.toBe(before.players[0]!.identity.form);

    const offer = undoOf(store.state.commandTrail, store.state.game!, me);
    expect(offer).toMatchObject({ kind: "available", target: versionBefore });
    expect(await store.rewindTo(versionBefore)).toBe(true);
    expect(store.state.version).toBe(versionBefore);
    expect(store.state.game!.players[0]!.identity.form).toBe(before.players[0]!.identity.form);
    expect(store.state.game!.players[0]!.hand).toEqual(before.players[0]!.hand);
    // Nothing earlier this turn to take back.
    expect(undoOf(store.state.commandTrail, store.state.game!, me)).toMatchObject({ kind: "unavailable" });

    const turn = store.state.legal!.actions;
    if (turn.kind !== "turn") throw new Error("expected the hero's turn");
    expect(await store.dispatch(turn.legal.find((a) => a.action.kind === "endTurn")!.example)).toBe(true);
    // The turn is over: whatever comes next, the hero can't reach back into it.
    const after = store.state.game!;
    const offerAfter = undoOf(store.state.commandTrail, after, me);
    expect(offerAfter === null || offerAfter.kind === "unavailable").toBe(true);
  });
});

describe("undoOf: randomness and reveals beyond the old denylist", () => {
  const withDraws = (
    cmd: Command,
    before: number,
    after: number,
    events: readonly GameEvent[] = [],
  ): BackOutTrailEntry => ({
    ...entry(cmd, events),
    rngDraws: { before, after },
  });

  test("a move that spent the engine's randomness can't be taken back, whatever events it produced", () => {
    const trail = [
      withDraws(command("useAbility"), 4, 5, [event("cardDiscardedFromHand", { playerId: P1, instanceId: "x" })]),
    ];
    expect(undoOf(trail, turnOf(P1), P1)).toEqual({ kind: "unavailable", reason: UNDO_REASONS.revealed });
  });

  test("a move that spent none is not stopped by the RNG gate", () => {
    const trail = [withDraws(command("useAbility"), 4, 4, [event("damageDealt")])];
    expect(undoOf(trail, turnOf(P1), P1)).toMatchObject({ kind: "available", target: 0 });
  });

  test("an answer inside the move that used randomness stops the whole move", () => {
    const trail = [entry(command("playCard")), withDraws(command("resolveChoice"), 1, 2)];
    expect(undoOf(trail, turnOf(P1), P1)).toEqual({ kind: "unavailable", reason: UNDO_REASONS.revealed });
  });

  test.each([
    "cardFound",
    "deckTopShown",
    "encounterTopShown",
    "hiddenPileRevealed",
    "revealedInPlay",
    "cardsRearranged",
    "cardsSwapped",
    "revealedCardDiscarded",
  ])("%s stops Undo", (type) => {
    expect(undoOf([entry(command("useAbility"), [event(type)])], turnOf(P1), P1)).toEqual({
      kind: "unavailable",
      reason: UNDO_REASONS.revealed,
    });
  });

  test("an event type nobody classified stops Undo rather than passing", () => {
    expect(undoOf([entry(command("useAbility"), [event("aBrandNewEvent")])], turnOf(P1), P1)).toEqual({
      kind: "unavailable",
      reason: UNDO_REASONS.revealed,
    });
  });
});
