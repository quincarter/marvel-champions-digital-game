/**
 * Beats: what a command is worth saying out loud, and over what.
 *
 * The risk this guards against is a beat pointing at the wrong card — a "−4"
 * over the villain when the damage landed on your hero is worse than no beat
 * at all, because the player will believe it.
 */

import { describe, expect, test } from "vitest";
import type { GameEvent, InstanceId } from "@mc/engine";
import { beatsFrom } from "./beats.js";

const id = (value: string): InstanceId => value as InstanceId;

describe("beatsFrom", () => {
  test("anchors damage on the card that took it", () => {
    const beats = beatsFrom([
      { type: "damageDealt", targetInstanceId: id("villain-1"), amount: 4, sourceInstanceId: null },
    ]);
    expect(beats).toHaveLength(1);
    expect(beats[0]!.anchor).toBe("villain-1");
    expect(beats[0]!.text).toBe("−4");
    expect(beats[0]!.tone).toBe("damage");
  });

  test("distinguishes threat placed from threat removed", () => {
    const beats = beatsFrom([
      { type: "threatPlaced", schemeInstanceId: id("scheme-1"), amount: 2, sourceInstanceId: null },
      { type: "threatRemoved", schemeInstanceId: id("scheme-1"), amount: 3, sourceInstanceId: null },
    ]);
    expect(beats.map((beat) => beat.text)).toEqual(["+2 THREAT", "−3 THREAT"]);
    expect(beats.map((beat) => beat.tone)).toEqual(["threat", "heal"]);
  });

  test("says Tough when damage was prevented by it, since the board shows no change", () => {
    const beats = beatsFrom([
      { type: "damagePrevented", targetInstanceId: id("minion-1"), amount: 3, reason: "tough" },
    ]);
    expect(beats[0]!.text).toBe("TOUGH");
  });

  test("says Crisis when a thwart was blocked, which otherwise looks like a bug", () => {
    const beats = beatsFrom([{ type: "threatRemovalBlocked", schemeInstanceId: id("main"), reason: "crisis" }]);
    expect(beats[0]!.text).toBe("CRISIS");
  });

  test("anchors overkill spill on the card it spilled onto", () => {
    const beats = beatsFrom([
      { type: "overkillSpilled", fromInstanceId: id("minion-1"), toInstanceId: id("hero-1"), amount: 2 },
    ]);
    expect(beats[0]!.anchor).toBe("hero-1");
  });

  test("anchors a resolved ability on the card whose ability it is — an Invocation Special with no other beat-worthy event still shows something", () => {
    const beats = beatsFrom([
      { type: "abilityResolved", instanceId: id("invocation-1"), abilityId: "09036.winds-of-watoomb-special" as never, controllerId: "p1" as never },
    ]);
    expect(beats).toHaveLength(1);
    expect(beats[0]!.anchor).toBe("invocation-1");
    expect(beats[0]!.text).toBe("RESOLVED");
    expect(beats[0]!.tone).toBe("status");
  });

  test("stays quiet about the engine talking to itself", () => {
    const events: GameEvent[] = [
      { type: "framePopped", frameId: "f1" as never, frame: "ability" as never },
      { type: "windowOpened" } as GameEvent,
      { type: "roundStarted", round: 2 },
      { type: "damageDealt", targetInstanceId: id("villain-1"), amount: 0, sourceInstanceId: null },
    ];
    // Zero damage is a real event and a useless beat.
    expect(beatsFrom(events)).toHaveLength(0);
  });
});
