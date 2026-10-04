/**
 * The owner's answers of 2026-10-04 to the matrix's open questions Q-M1 to Q-M4 (docs/phase7-wave6-qa-modular-matrix.md),
 * each as a scenario test.
 */
import { cardId } from "@mc/content";
import { activeEncounterDeckId, cardsInPlay, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { revealOnTurnEnd, startPairing } from "./testing/modular-matrix.js";

const inPlay = (state: GameState, code: string): InstanceId[] =>
  cardsInPlay(state).filter((id) => state.instances[id]!.cardId === cardId(code));
const piles = (state: GameState) => state.encounterDecks[activeEncounterDeckId(state)]!;
const inPiles = (state: GameState, code: string): InstanceId[] =>
  [...piles(state).deck, ...piles(state).discard].filter((id) => state.instances[id]!.cardId === cardId(code));
const revealedCodes = (events: readonly GameEvent[]): string[] =>
  events.flatMap((event) => (event.type === "encounterCardRevealed" ? [event.cardId as string] : []));
const reveal = (state: GameState, code: string) => revealOnTurnEnd(state, inPiles(state, code)[0]!, { form: "hero" });
const surged = (events: readonly GameEvent[], code: string): boolean => {
  const codes = revealedCodes(events);
  return codes.length > codes.indexOf(code) + 1;
};

describe("Q-M1: an in-play card titled Ronan the Accuser counts, the Ronan villain included", () => {
  it("at Ronan's own scenario the Kree Fanatic minion cannot enter play: it fails the unique check and is discarded", () => {
    const run = reveal(startPairing("kree_fanatic", "ronan-the-accuser"), "90001");
    expect(run.revealed).toBe(true);
    expect(inPlay(run.state, "90001")).toEqual([]);
    // Discarded, and the revealing player was dealt a facedown encounter card instead (RRG "Unique Icon", p. 46).
    expect(piles(run.state).discard.some((id) => run.state.instances[id]!.cardId === cardId("90001"))).toBe(true);
    expect(run.events.some((event) => event.type === "uniqueEntryBlocked")).toBe(true);
  });

  it("Bring the Hammer Down (90004) at Ronan's scenario: Ronan is in play, so its 'not in play' branch (surge) does not fire", () => {
    const run = reveal(startPairing("kree_fanatic", "ronan-the-accuser"), "90004");
    expect(revealedCodes(run.events)).toContain("90004");
    expect(surged(run.events, "90004")).toBe(false);
  });

  it("Bring the Hammer Down (90004) at another villain with no Ronan in play: it gains surge", () => {
    const run = reveal(startPairing("kree_fanatic", "sandman"), "90004");
    expect(surged(run.events, "90004")).toBe(true);
  });

  it("at another villain the Kree Fanatic minion enters play", () => {
    const run = reveal(startPairing("kree_fanatic", "rhino"), "90001");
    expect(inPlay(run.state, "90001")).toHaveLength(1);
  });
});
