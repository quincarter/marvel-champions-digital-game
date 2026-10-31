import { describe, expect, it } from "vitest";
import type { GameEvent, InstanceId, PlayerId } from "@mc/engine";
import { NO_REFILL, endOfTurnDrawsOf, endOfTurnLine, trackRefill } from "./villain-end-of-turn.js";

const me = "p1" as PlayerId;
const ally = "p2" as PlayerId;
const id = (value: string): InstanceId => value as InstanceId;
const drawn = (playerId: PlayerId, instance: string): GameEvent =>
  ({ type: "cardDrawn", playerId, instanceId: id(instance) }) as GameEvent;
const refilled = (playerId: PlayerId, count: number): GameEvent =>
  ({ type: "handRefilled", playerId, drawn: count, handSize: 5 }) as GameEvent;
const refillStarts = {
  type: "stepChanged",
  from: { phase: "player", kind: "endPhaseDiscard", remainingPlayerIds: [] },
  to: { phase: "player", kind: "endPhaseDraw" },
} as unknown as GameEvent;
/** The refill stopping on `playerId` for a drawn card's ability, `count` cards into its draw. */
const stops = (playerId: PlayerId, count: number, rest: readonly PlayerId[] = []): GameEvent =>
  ({
    type: "stepChanged",
    from: { phase: "player", kind: "endPhaseDraw" },
    to: { phase: "player", kind: "endPhaseDraw", remainingPlayerIds: [playerId, ...rest], drawn: count },
  }) as unknown as GameEvent;
const begins = { type: "stepChanged", to: { phase: "villain", kind: "placeThreat" } } as unknown as GameEvent;
const names: Record<string, string> = { a: "Backflip", b: "Genius", c: "Web-Shooter", d: "Energy" };

describe("endOfTurnDrawsOf", () => {
  it("collects each seat's refill, by seat", () => {
    const later = drawn(me, "z");
    const draws = endOfTurnDrawsOf([
      refillStarts,
      drawn(me, "a"),
      drawn(me, "b"),
      refilled(me, 2),
      drawn(ally, "d"),
      refilled(ally, 1),
      begins,
      later,
      // Step one marked `placed` later in the same command is not a new phase.
      { type: "stepChanged", to: { phase: "villain", kind: "placeThreat", placed: true } } as unknown as GameEvent,
    ])!;
    expect([...draws.bySeat.get(me)!]).toEqual(["a", "b"]);
    expect([...draws.bySeat.get(ally)!]).toEqual(["d"]);
  });

  it("is null for a command that did not begin the villain phase", () => {
    expect(endOfTurnDrawsOf([refillStarts, drawn(me, "a"), refilled(me, 1)])).toBeNull();
  });

  it("leaves out a card an ability drew earlier in the command", () => {
    const draws = endOfTurnDrawsOf([drawn(me, "x"), refillStarts, drawn(me, "a"), refilled(me, 1), begins])!;
    expect([...draws.bySeat.get(me)!]).toEqual(["a"]);
  });
});

describe("trackRefill: a refill that stops for a drawn card's ability (RRG 1.8 p. 21)", () => {
  it("keeps the cards drawn before the stop, across commands", () => {
    const first = trackRefill(NO_REFILL, [refillStarts, drawn(me, "a"), drawn(me, "b"), stops(me, 2)]);
    expect(first.ended).toBeNull();
    const second = trackRefill(first.tracker, [drawn(me, "c"), refilled(me, 3), begins]);
    expect([...second.ended!.bySeat.get(me)!]).toEqual(["a", "b", "c"]);
    // The next refill starts empty.
    expect(second.tracker).toEqual(NO_REFILL);
  });

  it("leaves out a card the stopped-for ability draws, and counts on through a second stop", () => {
    const first = trackRefill(NO_REFILL, [refillStarts, drawn(me, "a"), stops(me, 1)]);
    // The answered response draws "x" itself; the refill resumes with "b" and stops again.
    const second = trackRefill(first.tracker, [drawn(me, "x"), drawn(me, "b"), stops(me, 2)]);
    const third = trackRefill(second.tracker, [drawn(me, "y"), drawn(me, "c"), drawn(me, "d"), refilled(me, 4)]);
    const fourth = trackRefill(third.tracker, [begins]);
    expect([...fourth.ended!.bySeat.get(me)!]).toEqual(["a", "b", "c", "d"]);
  });

  it("follows each seat: the next seat draws once the stopped one finishes", () => {
    const first = trackRefill(NO_REFILL, [refillStarts, drawn(me, "a"), stops(me, 1, [ally])]);
    const second = trackRefill(first.tracker, [drawn(me, "b"), refilled(me, 2), drawn(ally, "d"), refilled(ally, 1)]);
    const ended = trackRefill(second.tracker, [begins]).ended!;
    expect([...ended.bySeat.get(me)!]).toEqual(["a", "b"]);
    expect([...ended.bySeat.get(ally)!]).toEqual(["d"]);
  });

  it("Back out to the stop restores the tracker saved there, and the recap still names every refill card", () => {
    const atStop = trackRefill(NO_REFILL, [refillStarts, drawn(me, "a"), drawn(me, "b"), stops(me, 2)]).tracker;
    // An answer after the stop, then backed out (the Board puts back the tracker it saved at that version).
    trackRefill(atStop, [drawn(me, "x")]);
    const ended = trackRefill(atStop, [drawn(me, "x"), drawn(me, "c"), refilled(me, 3), begins]).ended!;
    expect([...ended.bySeat.get(me)!]).toEqual(["a", "b", "c"]);
  });

  it("keeps the cards of a seat eliminated while its refill waited (it did draw them)", () => {
    const first = trackRefill(NO_REFILL, [refillStarts, drawn(ally, "d"), stops(ally, 1, [me])]);
    const ended = trackRefill(first.tracker, [drawn(me, "a"), refilled(me, 1), begins]).ended!;
    expect([...ended.bySeat.get(ally)!]).toEqual(["d"]);
    expect([...ended.bySeat.get(me)!]).toEqual(["a"]);
  });

  it("starts over when a new refill begins", () => {
    const stale = trackRefill(NO_REFILL, [refillStarts, drawn(me, "a"), stops(me, 1)]).tracker;
    const ended = trackRefill(stale, [refillStarts, drawn(me, "b"), refilled(me, 1), begins]).ended!;
    expect([...ended.bySeat.get(me)!]).toEqual(["b"]);
  });
});

describe("endOfTurnLine", () => {
  const line = (events: GameEvent[]) =>
    endOfTurnLine(
      endOfTurnDrawsOf(events)!,
      me,
      () => "Captain Marvel",
      (instance) => names[instance as string] ?? "?",
    );

  it("names your own cards and only counts a teammate's", () => {
    expect(
      line([
        refillStarts,
        drawn(me, "a"),
        drawn(me, "b"),
        drawn(me, "c"),
        refilled(me, 3),
        drawn(ally, "d"),
        refilled(ally, 1),
        begins,
      ]),
    ).toBe("You drew 3 cards: Backflip, Genius and Web-Shooter. Captain Marvel drew 1 card.");
    expect(line([refillStarts, drawn(me, "b"), refilled(me, 1), begins])).toBe("You drew 1 card: Genius.");
  });

  it("says nothing when nobody drew", () => {
    expect(line([begins])).toBe("");
  });
});
