import { describe, expect, test } from "vitest";
import type { Walkthrough, WalkthroughBeat } from "./villain-walkthrough.js";
import { revealOf } from "./villain-phase-reveal.js";

const beat = (id: string, text: string): WalkthroughBeat => ({ id, text, pause: null, activation: null });

/** A walkthrough that already ran to completion in one command, no pause. */
function completedWalkthrough(): Walkthrough {
  return {
    round: 3,
    steps: [
      { kind: "placeThreat", number: 1, title: "Place threat", beats: [beat("b1", "+4 threat placed")], status: "done" },
      {
        kind: "enemyActivations",
        number: 2,
        title: "Villain and minions activate",
        beats: [beat("b2", "Rhino activates against you"), beat("b3", "2 damage dealt")],
        status: "done",
      },
      { kind: "dealEncounterCards", number: 3, title: "Deal encounter cards", beats: [beat("b4", "1 card dealt")], status: "done" },
      { kind: "revealEncounterCards", number: 4, title: "Reveal encounter cards", beats: [beat("b5", "Card revealed")], status: "done" },
      { kind: "passFirstPlayer", number: 5, title: "Pass the first player token", beats: [beat("b6", "Token passed")], status: "done" },
    ],
    activeStep: null,
    pausedAt: null,
    complete: true,
    nextBeatId: 7,
    activation: null,
  };
}

describe("revealOf", () => {
  test("shows nothing before the first beat is revealed, even though the engine already finished the whole phase", () => {
    const reveal = revealOf(completedWalkthrough(), 0);

    expect(reveal.current).toBeNull();
    expect(reveal.caughtUp).toBe(false);
    expect(reveal.total).toBe(6);
    for (const step of reveal.steps) {
      expect(step.beats).toHaveLength(0);
      expect(step.revealStatus).toBe("pending");
    }
  });

  test("reveals beats one at a time, in order, without skipping ahead", () => {
    const reveal = revealOf(completedWalkthrough(), 3);

    expect(reveal.current?.id).toBe("b3");
    expect(reveal.caughtUp).toBe(false);
    expect(reveal.steps[0]!.beats.map((b) => b.id)).toEqual(["b1"]);
    expect(reveal.steps[0]!.revealStatus).toBe("done");
    expect(reveal.steps[1]!.beats.map((b) => b.id)).toEqual(["b2", "b3"]);
    expect(reveal.steps[1]!.revealStatus).toBe("active");
    // Steps 3-5 are already `done` in the underlying walkthrough, but haven't
    // been revealed to the screen yet.
    expect(reveal.steps[2]!.beats).toHaveLength(0);
    expect(reveal.steps[2]!.revealStatus).toBe("pending");
    expect(reveal.steps[4]!.revealStatus).toBe("pending");
  });

  test("every step reads done once every beat has been revealed", () => {
    const reveal = revealOf(completedWalkthrough(), 6);

    expect(reveal.caughtUp).toBe(true);
    expect(reveal.current?.id).toBe("b6");
    expect(reveal.steps.every((step) => step.revealStatus === "done")).toBe(true);
  });

  test("clamps a revealed count past the end rather than throwing", () => {
    const reveal = revealOf(completedWalkthrough(), 999);

    expect(reveal.caughtUp).toBe(true);
    expect(reveal.current?.id).toBe("b6");
  });

  test("a phase with no beats yet (just launched) reveals nothing and nothing is caught up prematurely", () => {
    const empty: Walkthrough = {
      round: 1,
      steps: completedWalkthrough().steps.map((step) => ({ ...step, beats: [], status: "pending" })),
      activeStep: 1,
      pausedAt: null,
      complete: false,
      nextBeatId: 1,
      activation: null,
    };

    const reveal = revealOf(empty, 0);
    expect(reveal.total).toBe(0);
    expect(reveal.caughtUp).toBe(true);
    expect(reveal.current).toBeNull();
    expect(reveal.steps.every((step) => step.revealStatus === "pending")).toBe(true);
  });

  test("a mid-phase pause stops the reveal at the pause's own beat", () => {
    const paused: Walkthrough = {
      round: 2,
      steps: [
        { kind: "placeThreat", number: 1, title: "Place threat", beats: [beat("b1", "+2 threat placed")], status: "done" },
        {
          kind: "enemyActivations",
          number: 2,
          title: "Villain and minions activate",
          beats: [
            beat("b2", "Klaw activates against you"),
            {
              id: "b3",
              text: "Auto-advance paused for your interrupt",
              pause: { playerId: "p1" as never, promptKind: "chooseTriggers", authority: "player", label: "Auto-advance paused for your interrupt", soleDecider: false, offer: "" },
              activation: null,
            },
          ],
          status: "active",
        },
        { kind: "dealEncounterCards", number: 3, title: "Deal encounter cards", beats: [], status: "pending" },
        { kind: "revealEncounterCards", number: 4, title: "Reveal encounter cards", beats: [], status: "pending" },
        { kind: "passFirstPlayer", number: 5, title: "Pass the first player token", beats: [], status: "pending" },
      ],
      activeStep: 2,
      pausedAt: { playerId: "p1" as never, promptKind: "chooseTriggers", authority: "player", label: "Auto-advance paused for your interrupt", soleDecider: false, offer: "" },
      complete: false,
      nextBeatId: 4,
      activation: null,
    };

    const reveal = revealOf(paused, 3);
    expect(reveal.caughtUp).toBe(true);
    expect(reveal.current?.pause).not.toBeNull();
    expect(reveal.steps[1]!.revealStatus).toBe("active");
    expect(reveal.steps[2]!.revealStatus).toBe("pending");
  });
});
