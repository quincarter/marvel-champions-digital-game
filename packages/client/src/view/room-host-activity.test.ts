import { describe, expect, it } from "vitest";
import { ACTIVITY_DOT_MS, activityDots, hostActivityWords } from "./room-host-activity.js";

describe("hostActivityWords", () => {
  it("is nothing while the host is in the lobby", () => {
    expect(hostActivityWords(null)).toBeNull();
  });

  it("words each step, naming the scenario once it is chosen", () => {
    expect(hostActivityWords({ step: "scenario" })).toEqual({ key: "room.activity.scenario" });
    expect(hostActivityWords({ step: "table" })).toEqual({ key: "room.activity.table" });
    expect(hostActivityWords({ step: "table", scenario: "Rhino" })).toEqual({
      key: "room.activity.tableScenario",
      params: { scenario: "Rhino" },
    });
    expect(hostActivityWords({ step: "modular", scenario: "Rhino" })).toEqual({ key: "room.activity.modular" });
    expect(hostActivityWords({ step: "decks" })).toEqual({ key: "room.activity.decks" });
    expect(hostActivityWords({ step: "starting" })).toEqual({ key: "room.activity.starting" });
  });
});

describe("activityDots", () => {
  it("cycles one, two, three dots", () => {
    expect([0, 1, 2, 3].map((i) => activityDots(i * ACTIVITY_DOT_MS, false))).toEqual([".", "..", "...", "."]);
  });

  it("is a still ellipsis under reduced motion", () => {
    expect(activityDots(0, true)).toBe("...");
    expect(activityDots(ACTIVITY_DOT_MS, true)).toBe("...");
  });
});
