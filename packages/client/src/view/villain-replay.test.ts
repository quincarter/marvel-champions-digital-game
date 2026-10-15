import { describe, expect, it } from "vitest";
import {
  decisionReached,
  decisionTitleOf,
  outcomeReleasable,
  seatHeadingName,
  tableHoldOf,
  totalBeats,
} from "./villain-replay.js";
import { emptyWalkthrough, type Walkthrough, type WalkthroughBeat } from "./villain-walkthrough.js";

const beat = (id: string): WalkthroughBeat => ({ id, text: id, pause: null, activation: null });

/** A walkthrough with `counts[i]` beats in step i. */
function walkthroughOf(counts: readonly number[], round = 1): Walkthrough {
  const base = emptyWalkthrough(round);
  return {
    ...base,
    steps: base.steps.map((step, i) => ({
      ...step,
      beats: Array.from({ length: counts[i] ?? 0 }, (_unused, n) => beat(`s${i}b${n}`)),
    })),
  };
}

describe("decisionReached", () => {
  it("holds a pending decision until the cursor is on the last beat", () => {
    expect(decisionReached(true, 3, 7)).toBe(false);
    expect(decisionReached(true, 7, 7)).toBe(true);
  });
  it("has nothing to hold when no decision is parked in the phase", () => {
    expect(decisionReached(false, 0, 7)).toBe(true);
  });
});

describe("tableHoldOf", () => {
  const walkthrough = walkthroughOf([2, 4, 1]);

  it("keeps the villain phase's round and step on the table while the replay is behind", () => {
    expect(tableHoldOf(walkthrough, 1)).toEqual({ round: 1, stepLabel: "Villain phase · step 1 of 5" });
    expect(tableHoldOf(walkthrough, 4)).toEqual({ round: 1, stepLabel: "Villain phase · step 2 of 5" });
  });

  it("says the phase is about to begin before anything is shown", () => {
    expect(tableHoldOf(walkthrough, 0)?.stepLabel).toBe("Villain phase · about to begin");
  });

  it("lets the live table through once the replay has caught up", () => {
    expect(tableHoldOf(walkthrough, totalBeats(walkthrough))).toBeNull();
    expect(tableHoldOf(emptyWalkthrough(1), 0)).toBeNull();
  });
});

describe("outcomeReleasable", () => {
  it("waits for the last beat", () => {
    expect(outcomeReleasable(5, 9)).toBe(false);
    expect(outcomeReleasable(9, 9)).toBe(true);
    expect(outcomeReleasable(0, 0)).toBe(true);
  });
});

describe("decisionTitleOf", () => {
  it("names the deciding seat and the activation when there are several seats", () => {
    expect(
      decisionTitleOf({ seatCount: 3, deciderName: "She-Hulk", activation: "Electro attacks You", subject: null }),
    ).toBe("She-Hulk — Electro attacks You");
  });
  it("says 'Your decision' with one seat", () => {
    expect(
      decisionTitleOf({ seatCount: 1, deciderName: "Spider-Man", activation: null, subject: "Golden Horse" }),
    ).toBe("Your decision — Golden Horse");
  });
  it("falls back to the phase when nothing is being narrated", () => {
    expect(decisionTitleOf({ seatCount: 2, deciderName: "Hulk", activation: null, subject: null })).toBe(
      "Hulk — The villain phase",
    );
  });
});

describe("seatHeadingName", () => {
  it("drops the alter-ego in brackets", () => {
    expect(seatHeadingName("Spider-Man (Peter Parker)")).toBe("Spider-Man");
    expect(seatHeadingName("She-Hulk")).toBe("She-Hulk");
  });
});
