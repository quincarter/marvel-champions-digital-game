/**
 * docs/phase7-wave7.md §3.11: the DSL builder for "a character that can be given a [status] status card", and how an
 * encounter card's "choose" option composes from it (§4.1 Q8 = A: offered only if it can be carried out in full). The
 * engine's `status-room.test.ts` proves what the compiled query selects.
 */

import { describe, expect, it } from "vitest";
import { chooseOne, chooseTarget, confuse, forcedInterrupt, option, placeThreat, stun } from "./index.js";
import { defineAbilities } from "./validate.js";
import { canTakeStatus, chosen, exists, notMatching, query } from "./values.js";

describe("§3.11 canTakeStatus", () => {
  it("is the query field, for each status", () => {
    expect(canTakeStatus("stunned")).toEqual({ canTakeStatus: "stunned" });
    expect(canTakeStatus("confused")).toEqual({ canTakeStatus: "confused" });
    expect(canTakeStatus("tough")).toEqual({ canTakeStatus: "tough" });
    // "A character you control" that a confused status card can be placed on.
    expect(query("character", { controller: "you", ...canTakeStatus("confused") })).toEqual({
      categories: ["character"],
      controller: "you",
      canTakeStatus: "confused",
    });
  });

  it("notMatching negates it: a character with no room for the card", () => {
    expect(query("character", notMatching(canTakeStatus("tough")))).toEqual({
      categories: ["character"],
      not: { canTakeStatus: "tough" },
    });
  });

  it('a "choose: stun a character you control, or …" option carries the condition and the restricted choice', () => {
    const able = query("character", { controller: "you", ...canTakeStatus("stunned") });
    const registry = defineAbilities({
      "99001.forced-interrupt": forcedInterrupt(
        { on: "enemyAttack", selfIs: "source" },
        chooseOne(
          option(
            "Stun a character you control",
            { when: exists(able) },
            chooseTarget("target", able),
            stun(chosen("target")),
          ),
          option("Place 2 threat on the main scheme", placeThreat(2, { kind: "mainScheme" })),
        ),
      ),
    });
    expect(registry["99001.forced-interrupt"]?.effects).toEqual([
      {
        kind: "chooseOne",
        chooser: { kind: "controller" },
        options: [
          {
            label: "Stun a character you control",
            condition: { kind: "exists", query: able },
            effects: [
              expect.objectContaining({ kind: "chooseTarget", slot: "target", query: able }),
              { kind: "giveStatus", target: { kind: "slot", slot: "target" }, status: "stunned" },
            ],
          },
          expect.objectContaining({ label: "Place 2 threat on the main scheme" }),
        ],
      },
    ]);
    // The confuse option reads the same way.
    expect(confuse(chosen("target"))).toEqual({
      kind: "giveStatus",
      target: { kind: "slot", slot: "target" },
      status: "confused",
    });
  });
});
