import { describe, expect, test } from "vitest";
import type { Command, GameEvent, GameState, PendingChoice, PlayerId } from "@mc/engine";
import type { BackOutTrailEntry } from "./back-out.js";
import { choiceTakebackOf, gateTakebackOf, handoverTakebackOf, TAKEBACK_AFTER_OWN_DRAW } from "./end-turn-takeback.js";

const P1 = "p1" as PlayerId;
const P2 = "p2" as PlayerId;

type GameLike = Pick<GameState, "outcome" | "pendingChoice" | "step">;

const turnOf = (activePlayerId: PlayerId, extra: Partial<GameLike> = {}): GameLike =>
  ({
    outcome: null,
    pendingChoice: null,
    step: { phase: "player", kind: "turn", activePlayerId, remainingPlayerIds: [] },
    ...extra,
  }) as GameLike;

const command = (type: Command["type"], playerId: PlayerId = P1): Command => ({ type, playerId }) as unknown as Command;
const entry = (cmd: Command, events: readonly GameEvent[] = []): BackOutTrailEntry => ({
  playerId: cmd.playerId,
  command: cmd,
  events,
});
const event = (type: string, extra: object = {}): GameEvent => ({ type, ...extra }) as unknown as GameEvent;

const OPEN = { outcome: null } as Pick<GameState, "outcome">;
const gate = (trail: readonly BackOutTrailEntry[], seat: PlayerId = P1, game = OPEN): number | null =>
  gateTakebackOf(trail, seat, game);
const sheet = (trail: readonly BackOutTrailEntry[], choice: PendingChoice, seat: PlayerId = P1): number | null =>
  choiceTakebackOf(trail, choice, seat);

const ended = event("turnEnded", { playerId: P1 });
const started = event("turnStarted", { playerId: P2 });
const toTurn = event("stepChanged", { to: { phase: "player", kind: "turn" } });
const toVillain = event("stepChanged", { to: { phase: "villain", kind: "placeThreat" } });
const drawn = event("cardDrawn", { playerId: P1, instanceId: "c1" });
const deckToHand = event("cardMoved", {
  instanceId: "c1",
  from: { kind: "deck", playerId: P1 },
  to: { kind: "hand", playerId: P1 },
});

describe("handoverTakebackOf (End turn passed the turn to another hero)", () => {
  const trail = [entry(command("playCard")), entry(command("endTurn"), [ended, started, toTurn])];

  test("offers the End turn as the move to take back, to the count before it", () => {
    expect(handoverTakebackOf(trail, turnOf(P2))).toMatchObject({ target: 1, command: { type: "endTurn" } });
  });

  test("closes once the next hero has done anything, or when End turn was not the last command", () => {
    expect(handoverTakebackOf([...trail, entry(command("basicThwart", P2))], turnOf(P2))).toBeNull();
    expect(handoverTakebackOf([entry(command("playCard"))], turnOf(P1))).toBeNull();
    expect(handoverTakebackOf([], turnOf(P1))).toBeNull();
  });

  test("closes while a choice is open, after the game ends, and outside a player turn", () => {
    expect(handoverTakebackOf(trail, turnOf(P2, { pendingChoice: {} as GameState["pendingChoice"] }))).toBeNull();
    expect(handoverTakebackOf(trail, turnOf(P2, { outcome: "won" as unknown as GameState["outcome"] }))).toBeNull();
    expect(
      handoverTakebackOf(trail, { ...turnOf(P2), step: { phase: "villain", kind: "placeThreat" } } as GameLike),
    ).toBeNull();
  });

  test("closes when the turn change drew, revealed or shuffled anything", () => {
    for (const extra of [drawn, event("deckShuffled"), event("cardsLookedAt")]) {
      const revealed = [entry(command("endTurn"), [ended, started, extra, toTurn])];
      expect(handoverTakebackOf(revealed, turnOf(P2))).toBeNull();
    }
  });

  test("closes when the turn that began is not the one now active", () => {
    expect(handoverTakebackOf(trail, turnOf(P1))).toBeNull();
  });
});

describe("gateTakebackOf (the villain phase is waiting on START)", () => {
  const refill = [ended, drawn, deckToHand, event("handRefilled", { playerId: P1, drawn: 1, handSize: 5 })];
  const reveals = [
    event("enemyActivated"),
    event("boostCardDealt"),
    event("encounterCardRevealed"),
    event("deckShuffled"),
    event("mainSchemeAdvanced"),
  ];

  test("is open right after the End turn that began the phase, whatever the phase has dealt behind the gate", () => {
    const trail = [entry(command("playCard")), entry(command("endTurn"), [ended, toVillain, ...reveals])];
    expect(gate(trail)).toBe(1);
  });

  test("stays open over the end-of-turn hand refill (the one thing already shown), unless switched off", () => {
    const trail = [entry(command("endTurn"), [...refill, toVillain, ...reveals])];
    expect(gate(trail)).toBe(TAKEBACK_AFTER_OWN_DRAW ? 0 : null);
  });

  test("closes when the end of the turn itself revealed something else or spent the RNG", () => {
    for (const extra of [event("deckShuffled"), event("cardsLookedAt"), event("encounterCardRevealed")]) {
      expect(gate([entry(command("endTurn"), [ended, extra, toVillain])])).toBeNull();
    }
  });

  test("closes when the phase changed the hand after it began", () => {
    expect(gate([entry(command("endTurn"), [ended, toVillain, drawn])])).toBeNull();
    expect(
      gate([
        entry(command("endTurn"), [
          ended,
          toVillain,
          event("cardMoved", { from: { kind: "hand", playerId: P1 }, to: { kind: "discard", playerId: P1 } }),
        ]),
      ]),
    ).toBeNull();
  });

  test("is shut when End turn is not the last command, or never began a villain phase", () => {
    const began = entry(command("endTurn"), [ended, toVillain]);
    expect(gate([began, entry(command("resolveChoice"))])).toBeNull();
    expect(gate([entry(command("endTurn"), [ended, started, toTurn])])).toBeNull();
    expect(gate([])).toBeNull();
  });
});

describe("the end-of-phase discard sheet", () => {
  const asked = event("choiceRequested", { choice: { playerId: P1, prompt: { kind: "discardDownToHandSize" } } });
  const discard = [
    event("cardDiscardedFromHand", { playerId: P1, instanceId: "c2" }),
    event("cardMoved", { from: { kind: "hand", playerId: P1 }, to: { kind: "discard", playerId: P1 } }),
  ];
  const discardChoice = { playerId: P1, prompt: { kind: "discardDownToHandSize" } } as unknown as PendingChoice;
  const askedTrail = [
    entry(command("playCard")),
    entry(command("endTurn"), [
      ended,
      event("stepChanged", { to: { phase: "player", kind: "endPhaseDiscard" } }),
      asked,
    ]),
  ];

  test("offers Nevermind on the sheet End turn opened, back to the count before End turn", () => {
    expect(sheet(askedTrail, discardChoice)).toBe(1);
  });

  test("stays open over another seat's discards, but not on any other kind of choice", () => {
    const trail = [...askedTrail, entry(command("resolveChoice"), [...discard, asked])];
    expect(sheet(trail, discardChoice)).toBe(1);
    expect(sheet(askedTrail, { ...discardChoice, prompt: { kind: "chooseOption" } } as PendingChoice)).toBeNull();
  });

  test("is shut when End turn was not the last thing, or something was drawn or revealed", () => {
    expect(sheet([entry(command("playCard"))], discardChoice)).toBeNull();
    const drew = [entry(command("endTurn"), [ended, drawn, asked])];
    expect(sheet(drew, discardChoice)).toBeNull();
    const shuffled = [entry(command("endTurn"), [ended, event("deckShuffled"), asked])];
    expect(sheet(shuffled, discardChoice)).toBeNull();
  });

  test("the gate that follows the discards still offers Nevermind, back to before End turn", () => {
    const answered = entry(command("resolveChoice"), [...discard, ...refill(), toVillain, event("enemyActivated")]);
    expect(gate([...askedTrail, answered])).toBe(1);
    const revealed = entry(command("resolveChoice"), [event("deckShuffled"), toVillain]);
    expect(gate([...askedTrail, revealed])).toBeNull();
  });
});

function refill(): GameEvent[] {
  return [drawn, deckToHand, event("handRefilled", { playerId: P1, drawn: 1, handSize: 5 })];
}

describe("the shared gates", () => {
  const rng = { before: 3, after: 4 };
  const spent = (cmd: Command, events: readonly GameEvent[]): BackOutTrailEntry => ({
    ...entry(cmd, events),
    rngDraws: rng,
  });
  const discardChoice = { playerId: P1, prompt: { kind: "discardDownToHandSize" } } as unknown as PendingChoice;
  const asked = event("choiceRequested", { choice: { playerId: P1, prompt: { kind: "discardDownToHandSize" } } });

  test("a command that spent the RNG closes the handover and the discard sheet", () => {
    expect(handoverTakebackOf([spent(command("endTurn"), [ended, started, toTurn])], turnOf(P2))).toBeNull();
    expect(sheet([spent(command("endTurn"), [ended, asked])], discardChoice)).toBeNull();
    expect(
      sheet([entry(command("endTurn"), [ended, asked]), spent(command("resolveChoice"), [])], discardChoice),
    ).toBeNull();
  });

  test("a handover that included the hero's own face-up discard stays open", () => {
    const discards = [
      event("cardDiscardedFromHand", { playerId: P1, instanceId: "c2" }),
      event("cardMoved", { from: { kind: "hand", playerId: P1 }, to: { kind: "discard", playerId: P1 } }),
    ];
    const trail = [entry(command("endTurn"), [ended, ...discards, started, toTurn])];
    expect(handoverTakebackOf(trail, turnOf(P2))).toMatchObject({ target: 0 });
  });

  test("a finished game closes the gate", () => {
    const trail = [entry(command("endTurn"), [ended, toVillain])];
    expect(gate(trail)).toBe(0);
    expect(gate(trail, P1, { outcome: "won" } as unknown as Pick<GameState, "outcome">)).toBeNull();
  });

  test("another seat's End turn is not offered back from this seat, on the sheet or the gate", () => {
    const trail = [entry(command("endTurn", P2), [ended, toVillain])];
    expect(gate(trail, P1)).toBeNull();
    expect(gate(trail, P2)).toBe(0);
    const asking = [entry(command("endTurn", P2), [ended, asked])];
    expect(sheet(asking, discardChoice, P1)).toBeNull();
    expect(sheet(asking, discardChoice, P2)).toBe(0);
  });
});
