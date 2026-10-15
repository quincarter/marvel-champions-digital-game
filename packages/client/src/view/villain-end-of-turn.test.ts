import { describe, expect, it } from "vitest";
import type { GameEvent, InstanceId, PlayerId } from "@mc/engine";
import { endOfTurnDrawsOf, endOfTurnLine } from "./villain-end-of-turn.js";

const me = "p1" as PlayerId;
const ally = "p2" as PlayerId;
const id = (value: string): InstanceId => value as InstanceId;
const drawn = (playerId: PlayerId, instance: string): GameEvent =>
  ({ type: "cardDrawn", playerId, instanceId: id(instance) }) as GameEvent;
const begins = { type: "stepChanged", to: { phase: "villain", kind: "placeThreat" } } as unknown as GameEvent;
const names: Record<string, string> = { a: "Backflip", b: "Genius", c: "Web-Shooter", d: "Energy" };

describe("endOfTurnDrawsOf", () => {
  it("collects the draws before the villain phase's first step, by seat", () => {
    const later = drawn(me, "z");
    const draws = endOfTurnDrawsOf([drawn(me, "a"), drawn(ally, "d"), drawn(me, "b"), begins, later])!;
    expect([...draws.bySeat.get(me)!]).toEqual(["a", "b"]);
    expect([...draws.bySeat.get(ally)!]).toEqual(["d"]);
  });

  it("is null for a command that did not begin the villain phase", () => {
    expect(endOfTurnDrawsOf([drawn(me, "a")])).toBeNull();
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
    expect(line([drawn(me, "a"), drawn(me, "b"), drawn(me, "c"), drawn(ally, "d"), begins])).toBe(
      "You drew 3 cards: Backflip, Genius and Web-Shooter. Captain Marvel drew 1 card.",
    );
    expect(line([drawn(me, "b"), begins])).toBe("You drew 1 card: Genius.");
  });

  it("says nothing when nobody drew", () => {
    expect(line([begins])).toBe("");
  });
});
