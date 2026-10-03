/**
 * docs/phase7-wave6.md §3.52: the DSL side of "that event deal +1 damage for each counter removed" (Throw de Card,
 * Gambit 37001a) and "If Gambit's 'Throw de Card' ability removed at least: • 1 counter, …" (Charged Card 37006).
 * `modifyCardEffect` compiles to the engine's `modifyCardEffect` (with `note`), `playNote` to `Predicate playNote`. The
 * engine's `play-note.test.ts` drives the behaviour.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { heroAction, interrupt, on, removeUpToCounters } from "./abilities.js";
import { anAttackableEnemy, attack, ifThen, modifyCardEffect } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, eventTarget, playNote, query, varOf } from "./values.js";

describe("§3.52 modifyCardEffect note, playNote", () => {
  it("compiles the bonus and the note; only what is given", () => {
    expect(modifyCardEffect(eventTarget, { damage: 2 })).toEqual({
      kind: "modifyCardEffect",
      card: { kind: "eventTarget" },
      damage: { kind: "const", value: 2 },
    });
    expect(
      modifyCardEffect(eventTarget, {
        damage: varOf("removed"),
        note: { name: "throwDeCard", value: varOf("removed") },
      }),
    ).toEqual({
      kind: "modifyCardEffect",
      card: { kind: "eventTarget" },
      damage: { kind: "var", name: "removed" },
      note: { name: "throwDeCard", value: { kind: "var", name: "removed" } },
    });
    expect(modifyCardEffect(eventTarget, { threatRemoved: 1, note: { name: "n", value: 0 } })).toEqual({
      kind: "modifyCardEffect",
      card: { kind: "eventTarget" },
      threatRemoved: { kind: "const", value: 1 },
      note: { name: "n", value: { kind: "const", value: 0 } },
    });
    expect(playNote("throwDeCard")).toEqual({ kind: "playNote", name: "throwDeCard", atLeast: 1 });
    expect(playNote("throwDeCard", 3)).toEqual({ kind: "playNote", name: "throwDeCard", atLeast: 3 });
  });

  it("Throw de Card's shape: an interrupt to an ATTACK event's play, paid with up to 3 counters, validates", () => {
    const definition = interrupt(
      on.youPlay(query("event", { trait: trait("ATTACK") })),
      { cost: removeUpToCounters("charge", 3, { bind: "removed" }) },
      modifyCardEffect(eventTarget, {
        damage: varOf("removed"),
        note: { name: "throwDeCard", value: varOf("removed") },
      }),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("Charged Card's shape: the thresholds read the note", () => {
    const definition = heroAction(
      { label: "attack" },
      anAttackableEnemy("enemy"),
      ifThen(
        playNote("throwDeCard", 3),
        attack(4, chosen("enemy"), { keywords: ["ranged", "piercing", "overkill"] }),
        attack(4, chosen("enemy")),
      ),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects[1]).toMatchObject({
      kind: "if",
      condition: { kind: "playNote", name: "throwDeCard", atLeast: 3 },
    });
  });
});
