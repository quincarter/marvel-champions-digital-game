/**
 * The keyboard route. A canvas has no focus order of its own, so this is the
 * only thing standing between a keyboard player and a board they cannot use.
 */

import { describe, expect, test } from "vitest";
import type { InstanceId } from "@mc/engine";
import { focusOrder, sameTarget, stepFocus, type FocusTarget } from "./focus.js";
import type { BasicAction, Highlights } from "./highlights.js";

const id = (value: string): InstanceId => value as InstanceId;

const marksWith = (actions: readonly BasicAction[]): Highlights => ({
  yourTurn: true,
  playable: new Set(),
  unplayable: new Map(),
  usableAbilities: new Set(),
  anyTarget: new Set(),
  blocked: new Map(),
  basics: actions.map((action) => ({ action, enabled: true, reason: null, code: null, targets: [] })),
  openChoice: null,
});

describe("focusOrder", () => {
  test("runs the hand first, then the action bar", () => {
    const order = focusOrder({ kind: "idle", hand: [id("a"), id("b")] }, marksWith(["attack", "endTurn"]));
    expect(order).toEqual<FocusTarget[]>([
      { kind: "card", instanceId: id("a") },
      { kind: "card", instanceId: id("b") },
      { kind: "basic", action: "attack" },
      { kind: "basic", action: "endTurn" },
    ]);
  });

  test("keeps an unusable control on the route, because its reason lives there", () => {
    const marks = marksWith(["attack"]);
    const disabled: Highlights = {
      ...marks,
      basics: [
        { action: "attack", enabled: false, reason: "already exhausted", code: "already_exhausted", targets: [] },
      ],
    };
    expect(focusOrder({ kind: "idle", hand: [] }, disabled)).toEqual([{ kind: "basic", action: "attack" }]);
  });

  test("puts a card in play with a usable ability between the hand and the action bar", () => {
    const marks: Highlights = { ...marksWith(["attack", "endTurn"]), usableAbilities: new Set([id("villain")]) };
    const order = focusOrder({ kind: "idle", hand: [id("a")] }, marks);
    expect(order).toEqual<FocusTarget[]>([
      { kind: "card", instanceId: id("a") },
      { kind: "card", instanceId: id("villain") },
      { kind: "basic", action: "attack" },
      { kind: "basic", action: "endTurn" },
    ]);
  });

  test("doesn't focus a hand card twice, if it were ever also a usable-ability id", () => {
    const marks: Highlights = { ...marksWith(["endTurn"]), usableAbilities: new Set([id("a")]) };
    const order = focusOrder({ kind: "idle", hand: [id("a")] }, marks);
    expect(order.filter((target) => target.kind === "card")).toEqual([{ kind: "card", instanceId: id("a") }]);
  });

  test("narrows to the targets while one is being chosen, plus Cancel at the end", () => {
    const order = focusOrder({ kind: "targeting", targets: [id("villain")] }, marksWith(["attack", "endTurn"]));
    // Stepping through an action bar you can't use to reach the one target you
    // can is worse than no keyboard support. Cancel is still reachable by tab,
    // not only by Escape, since the targeting panel draws it as a real control.
    expect(order).toEqual([{ kind: "card", instanceId: id("villain") }, { kind: "cancel" }]);
  });

  test("a multi-pick panel puts its Confirm between the cards and Cancel, and focus on it survives a redraw", () => {
    const order = focusOrder(
      { kind: "targeting", targets: [id("a1"), id("a2")], confirm: true },
      marksWith(["attack", "endTurn"]),
    );
    expect(order).toEqual([
      { kind: "card", instanceId: id("a1") },
      { kind: "card", instanceId: id("a2") },
      { kind: "confirm" },
      { kind: "cancel" },
    ]);
    expect(sameTarget({ kind: "confirm" }, { kind: "confirm" })).toBe(true);
    expect(sameTarget({ kind: "confirm" }, { kind: "cancel" })).toBe(false);
  });

  test("narrows to what can pay while a payment is open", () => {
    const order = focusOrder({ kind: "paying", sources: [id("r1"), id("r2")] }, marksWith(["attack"]));
    expect(order.map((target) => (target.kind === "card" ? target.instanceId : null))).toEqual([id("r1"), id("r2")]);
  });
});

describe("stepFocus", () => {
  const order: FocusTarget[] = [
    { kind: "card", instanceId: id("a") },
    { kind: "basic", action: "attack" },
  ];

  test("wraps in both directions", () => {
    expect(stepFocus(order, 1, 1)).toBe(0);
    expect(stepFocus(order, 0, -1)).toBe(1);
  });

  test("enters at the start going forward and at the end going back", () => {
    expect(stepFocus(order, -1, 1)).toBe(0);
    expect(stepFocus(order, -1, -1)).toBe(1);
  });

  test("has nowhere to go when nothing is focusable", () => {
    expect(stepFocus([], -1, 1)).toBe(-1);
  });
});

describe("sameTarget", () => {
  test("survives a redraw by identity, not by position", () => {
    expect(sameTarget({ kind: "card", instanceId: id("a") }, { kind: "card", instanceId: id("a") })).toBe(true);
    expect(sameTarget({ kind: "card", instanceId: id("a") }, { kind: "card", instanceId: id("b") })).toBe(false);
    expect(sameTarget({ kind: "basic", action: "attack" }, { kind: "card", instanceId: id("a") })).toBe(false);
    expect(sameTarget(null, { kind: "basic", action: "attack" })).toBe(false);
    expect(sameTarget({ kind: "cancel" }, { kind: "cancel" })).toBe(true);
    expect(sameTarget({ kind: "cancel" }, { kind: "basic", action: "attack" })).toBe(false);
  });
});

describe("Team-Up ring focus stops", () => {
  test("rings are the last stops of the idle route, after the basics, and only when the board shows them", () => {
    const order = focusOrder({ kind: "idle", hand: [id("a")], teamUps: ["gambit-rogue"] }, null);
    expect(order.at(-1)).toEqual({ kind: "teamUp", pairKey: "gambit-rogue" });
    expect(order[0]).toEqual({ kind: "card", instanceId: id("a") });
    expect(focusOrder({ kind: "idle", hand: [id("a")] }, null).some((t) => t.kind === "teamUp")).toBe(false);
  });

  test("a ring is never a stop while a decision narrows the route", () => {
    const order = focusOrder({ kind: "targeting", targets: [id("x")] }, null);
    expect(order.some((t) => t.kind === "teamUp")).toBe(false);
  });

  test("two rings are the same stop only for the same pair", () => {
    expect(sameTarget({ kind: "teamUp", pairKey: "a" }, { kind: "teamUp", pairKey: "a" })).toBe(true);
    expect(sameTarget({ kind: "teamUp", pairKey: "a" }, { kind: "teamUp", pairKey: "b" })).toBe(false);
    expect(sameTarget({ kind: "teamUp", pairKey: "a" }, { kind: "cancel" })).toBe(false);
  });
});
