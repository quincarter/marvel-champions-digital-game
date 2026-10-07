/**
 * `by` on `dealDamage` / `removeThreat` (docs/phase7-wave7.md §3.1 gap 3, §4.1 Q2): the player a card names as dealing
 * the damage or removing the threat. "When Defeated: The player who defeated this scheme deals 5 per player damage to
 * the villain" (Lay the Trap, `psylocke` 41016) and "… removes 5 per player threat from the main scheme" (Keep Them
 * Busy, `x23` 43018). `player-side-scheme-no-player.test.ts` in the engine drives both, the no-player case included.
 */

import { describe, expect, it } from "vitest";
import { whenDefeated } from "./abilities.js";
import { dealDamage, removeThreat } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { defeatingPlayer, perHero, theMainScheme, theVillain, you } from "./values.js";

const FIVE_PER_PLAYER = { kind: "perPlayer", base: 0, perPlayer: 5 };

describe("`by`: the player an effect's damage or threat removal is by", () => {
  it("dealDamage carries the named player; without the option the spec has no `by`", () => {
    expect(dealDamage(perHero(5), theVillain, { by: defeatingPlayer })).toEqual({
      kind: "dealDamage",
      target: { kind: "villain" },
      amount: FIVE_PER_PLAYER,
      by: { kind: "defeatingPlayer" },
    });
    expect(dealDamage(5, theVillain)).toEqual({
      kind: "dealDamage",
      target: { kind: "villain" },
      amount: { kind: "const", value: 5 },
    });
  });

  it("removeThreat carries the named player; without the option the spec has no `by`", () => {
    expect(removeThreat(perHero(5), theMainScheme, { by: defeatingPlayer })).toEqual({
      kind: "removeThreat",
      target: { kind: "mainScheme" },
      amount: FIVE_PER_PLAYER,
      by: { kind: "defeatingPlayer" },
    });
    expect(removeThreat(5, theMainScheme)).toEqual({
      kind: "removeThreat",
      target: { kind: "mainScheme" },
      amount: { kind: "const", value: 5 },
    });
  });

  it("`by` sits beside the builders' other options", () => {
    expect(dealDamage(2, theVillain, { bind: "hit", perTarget: true, by: you })).toEqual({
      kind: "dealDamage",
      target: { kind: "villain" },
      amount: { kind: "const", value: 2 },
      bind: "hit",
      perTarget: true,
      by: { kind: "controller" },
    });
    expect(removeThreat(2, theMainScheme, { bind: "cleared", ignoreCrisis: true, by: you })).toEqual({
      kind: "removeThreat",
      target: { kind: "mainScheme" },
      amount: { kind: "const", value: 2 },
      ignoreCrisis: true,
      bind: "cleared",
      by: { kind: "controller" },
    });
  });

  it("both When Defeated abilities validate", () => {
    const layTheTrap = whenDefeated(dealDamage(perHero(5), theVillain, { by: defeatingPlayer }));
    const keepThemBusy = whenDefeated(removeThreat(perHero(5), theMainScheme, { by: defeatingPlayer }));
    expect(validateDefinition(layTheTrap)).toEqual([]);
    expect(validateDefinition(keepThemBusy)).toEqual([]);
    expect(layTheTrap.trigger).toEqual({ kind: "whenDefeated" });
    expect(keepThemBusy.effects).toHaveLength(1);
  });
});
