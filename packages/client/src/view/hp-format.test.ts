/**
 * ∞ hit points, rendered (docs/phase7-wave3.md §3.1: the Collector's back face, `VillainStage.infiniteHp`).
 * `remainingHitPoints`/`maxHitPoints` (`@mc/engine`) return the real `Infinity`, unformatted — these are the one
 * place that turns it into the printed symbol, for every reader in the client.
 */

import { describe, expect, test } from "vitest";
import { CARDS_BY_ID } from "../content/pool.js";
import { hpFraction, hpNumber, hpRatio } from "./hp-format.js";

describe("hpFraction", () => {
  test("an ordinary character reads current/max", () => {
    expect(hpFraction(8, 22)).toBe("8/22");
  });

  test("an ∞-hit-point face reads the bare symbol, never 'Infinity/Infinity'", () => {
    expect(hpFraction(Infinity, Infinity)).toBe("∞");
  });
});

describe("hpNumber", () => {
  test("an ordinary number is unchanged", () => {
    expect(hpNumber(14)).toBe("14");
  });

  test("Infinity reads as the symbol, for prose like 'with N hit points left'", () => {
    expect(hpNumber(Infinity)).toBe("∞");
  });
});

describe("hpRatio", () => {
  test("an ordinary character's bar fills proportionally", () => {
    expect(hpRatio(11, 22)).toBe(0.5);
    expect(hpRatio(0, 22)).toBe(0);
    expect(hpRatio(22, 22)).toBe(1);
  });

  test("a character with 0 max hit points never divides by zero", () => {
    expect(hpRatio(0, 0)).toBe(0);
  });

  test("an ∞-hit-point face always reads full — there is no 'how much of infinity is used up', and Infinity/Infinity is never computed (it would be NaN)", () => {
    expect(hpRatio(Infinity, Infinity)).toBe(1);
    // Even a stale `current` reading (mid-tween, before the widget catches up) still reads full.
    expect(hpRatio(3, Infinity)).toBe(1);
  });
});

describe("the real card this exists for", () => {
  test("the Collector's flipped face (gmw 16080b) really carries infiniteHp, in the pool this client actually runs", () => {
    const collector = CARDS_BY_ID.get("16080a");
    if (collector?.type !== "villain") throw new Error("expected the Collector's villain card");
    const backFace = collector.sides.find((side) => side.side === "B")?.stages[0];
    expect(backFace?.infiniteHp).toBe(true);
  });
});
