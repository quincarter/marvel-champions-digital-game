/**
 * docs/phase7-wave9.md §3.27: `removeCountersAmong` (a `divide` of counters, `mode: "remove"`) and
 * `withFewestCounters` / `withMostCounters` (`superlative` measured by counters), the builders behind "Remove 3 secret
 * counters from among Board Member environments" (Baron Zemo, `aos` 50165a) and "the Board Member environment with the
 * fewest secret counters" (S.H.I.E.L.D. Agent, 50172). The engine's `divide-counters.test.ts` drives the plain data.
 */

import { trait } from "@mc/content";
import type { EffectSpec } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  addCounters,
  bindTargets,
  chooseTarget,
  chosen,
  divide,
  each,
  firstPlayer,
  perHero,
  query,
  removeCountersAmong,
  validateDefinition,
  whenDefeated,
  whenRevealed,
  withFewestCounters,
  withMostCounters,
} from "./index.js";

const BOARD_MEMBERS = query("environment", { trait: trait("BOARD MEMBER") });

describe("`removeCountersAmong`", () => {
  it("is a divide of that counter type in remove mode, the controller choosing by default", () => {
    expect(removeCountersAmong("secret", 3, BOARD_MEMBERS)).toEqual({
      kind: "divide",
      what: { counters: "secret" },
      mode: "remove",
      amount: { kind: "const", value: 3 },
      among: BOARD_MEMBERS,
      chooser: { kind: "controller" },
    });
    expect(divide({ counters: "secret" }, 3, BOARD_MEMBERS)).toEqual(removeCountersAmong("secret", 3, BOARD_MEMBERS));
  });
  it("takes the first player as chooser, a value amount, 'up to' and a bind", () => {
    const effect = removeCountersAmong("any", perHero(1), BOARD_MEMBERS, {
      chooser: firstPlayer,
      upTo: true,
      bind: "gone",
    });
    expect(effect).toMatchObject({
      what: { counters: "any" },
      mode: "remove",
      amount: perHero(1),
      chooser: { kind: "firstPlayer" },
      upTo: true,
      bind: "gone",
    });
  });
  it("leaves the other divisions without a mode", () => {
    expect(divide("threat", 3, query("scheme"))).not.toHaveProperty("mode");
  });
  it("validates on an encounter card's When Defeated", () => {
    const definition = whenDefeated(removeCountersAmong("secret", perHero(1), BOARD_MEMBERS, { chooser: firstPlayer }));
    expect(validateDefinition(definition)).toEqual([]);
  });
  it("rejects a counter division with no mode, a mode on another division, and 'allPurpose' as the type taken", () => {
    const base = removeCountersAmong("secret", 3, BOARD_MEMBERS) as Extract<EffectSpec, { kind: "divide" }>;
    const { mode: _mode, ...noMode } = base;
    expect(validateDefinition(whenRevealed(noMode))).toContain('divide: a division of counters needs mode "remove"');
    const threat = { ...(divide("threat", 3, query("scheme")) as typeof base), mode: "remove" as const };
    expect(validateDefinition(whenRevealed(threat))).toContain(
      "divide: mode is for a division of counters ({ counters: type })",
    );
    expect(validateDefinition(whenRevealed(removeCountersAmong("allPurpose", 3, BOARD_MEMBERS)))).toContain(
      'divide: counters of any type are removed as "any", not "allPurpose"',
    );
  });
});

describe("`withFewestCounters` / `withMostCounters`", () => {
  it("are superlatives measured by each candidate's counters of the type", () => {
    expect(withFewestCounters(each(BOARD_MEMBERS), "secret")).toEqual({
      kind: "superlative",
      among: { kind: "each", query: BOARD_MEMBERS },
      order: "lowest",
      measure: { kind: "counters", of: { kind: "slot", slot: "candidate" }, counterType: "secret" },
    });
    expect(withMostCounters(each(BOARD_MEMBERS), "any", { ties: "first" })).toEqual({
      kind: "superlative",
      among: { kind: "each", query: BOARD_MEMBERS },
      order: "highest",
      measure: { kind: "counters", of: { kind: "slot", slot: "candidate" }, counterType: "any" },
      ties: "first",
    });
  });
  it("validates as 'place 2 secret counters on the Board Member environment with the fewest', the first player's tie", () => {
    const definition = whenRevealed(
      bindTargets("tied", withFewestCounters(each(BOARD_MEMBERS), "secret")),
      chooseTarget("board", { inSlot: "tied" }, { chooser: firstPlayer }),
      addCounters("allPurpose", 2, chosen("board")),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });
});
