/**
 * The guard on Undo's allowlist: every engine event type is classified in `UNDO_EVENT_VERDICTS`, so a new event type
 * fails here until someone decides whether a move that produced it may still be taken back (the model is
 * `log-lines-coverage.test.ts`). The typecheck catches it too; this catches a run without one.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { GameEvent, PlayerId } from "@mc/engine";
import { UNDO_EVENT_VERDICTS, eventStopsUndo } from "./undo.js";

const eventKinds = (): string[] => {
  const source = readFileSync(new URL("../../../engine/src/events.ts", import.meta.url), "utf8");
  return [...new Set([...source.matchAll(/readonly type: "([A-Za-z]+)"/g)].map((m) => m[1]!))].sort();
};

const ME = "p1" as PlayerId;
const THEM = "p2" as PlayerId;
const event = (type: string, extra: object = {}): GameEvent => ({ type, ...extra }) as unknown as GameEvent;

describe("every engine event type is classified for Undo", () => {
  test("no event type is missing from the table", () => {
    const classified = new Set(Object.keys(UNDO_EVENT_VERDICTS));
    expect(eventKinds().filter((kind) => !classified.has(kind))).toEqual([]);
  });

  test("no entry names an event type the engine no longer has", () => {
    const kinds = new Set(eventKinds());
    expect(Object.keys(UNDO_EVENT_VERDICTS).filter((kind) => !kinds.has(kind))).toEqual([]);
  });

  test("every entry says allowed, stops or checked, with a reason", () => {
    for (const [kind, [verdict, why]] of Object.entries(UNDO_EVENT_VERDICTS)) {
      expect(["allowed", "stops", "checked"], kind).toContain(verdict);
      expect(why.length, kind).toBeGreaterThan(3);
    }
  });

  test("everything that draws, reveals, looks, searches, shuffles or deals stops Undo", () => {
    const mustStop = [
      "cardDrawn",
      "cardFound",
      "cardsLookedAt",
      "deckTopShown",
      "deckTopHidden",
      "encounterTopShown",
      "encounterTopHidden",
      "encounterCardRevealed",
      "hiddenPileRevealed",
      "hiddenPilesDealt",
      "revealedInPlay",
      "revealedCardDiscarded",
      "cardsRearranged",
      "cardsSwapped",
      "deckShuffled",
      "boostCardDealt",
      "boostCardFlipped",
      "cardTurnedFaceup",
      "drawnObligationPlaced",
      "costPartPaidBy",
      "turnEnded",
      "turnStarted",
      "stepChanged",
      "roundStarted",
    ];
    for (const kind of mustStop) expect(eventStopsUndo(event(kind), ME), kind).toBe(true);
  });

  test("a hero's own visible, deterministic moves are allowed", () => {
    const allowed = [
      "cardPlayed",
      "formChanged",
      "damageDealt",
      "threatRemoved",
      "threatPlaced",
      "counterAdded",
      "cardExhausted",
      "cardReadied",
      "resourcesGenerated",
      "attackResolved",
      "lastingEffectAdded",
      "statusGiven",
    ];
    for (const kind of allowed) expect(eventStopsUndo(event(kind), ME), kind).toBe(false);
  });
});

describe("events decided by their payload", () => {
  const zone = (kind: string, playerId: PlayerId = ME) => ({ kind, playerId });
  const moved = (from: object) => event("cardMoved", { from, to: zone("discard") });

  test("a card leaving a deck, the dealt encounter queue or a boost stops Undo; one leaving hand, play or discard does not", () => {
    for (const kind of ["deck", "dealtEncounter", "setAside", "boost", "encounterDeck", "separateDeck"]) {
      expect(eventStopsUndo(moved(zone(kind)), ME), kind).toBe(true);
    }
    for (const kind of ["hand", "playArea", "discard", "resolving", "identity", "encounterDiscard"]) {
      expect(eventStopsUndo(moved(zone(kind)), ME), kind).toBe(false);
    }
  });

  test("a card leaving another seat's hand stops Undo", () => {
    expect(eventStopsUndo(moved(zone("hand", THEM)), ME)).toBe(true);
  });

  test("a prompt to look through a deck, or one for another seat, stops Undo; a pick among public options does not", () => {
    const choice = (kind: string, playerId: PlayerId = ME) =>
      event("choiceRequested", { choice: { playerId, prompt: { kind } } });
    for (const kind of ["chooseCards", "lookAt", "chooseBottomCards", "orderCards"]) {
      expect(eventStopsUndo(choice(kind), ME), kind).toBe(true);
    }
    expect(eventStopsUndo(choice("chooseTargets"), ME)).toBe(false);
    expect(eventStopsUndo(choice("chooseTargets", THEM), ME)).toBe(true);
  });

  test("a discard from another seat's hand stops Undo; the mover's own is left to the RNG gate", () => {
    expect(eventStopsUndo(event("cardDiscardedFromHand", { playerId: THEM }), ME)).toBe(true);
    expect(eventStopsUndo(event("cardDiscardedFromHand", { playerId: ME }), ME)).toBe(false);
  });
});
