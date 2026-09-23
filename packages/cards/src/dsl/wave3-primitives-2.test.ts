/**
 * docs/phase7-wave3.md §3.39 onward: the DSL builders for the third wave 3 primitives pass (the last skipped `gmw`,
 * `stld` and `drax` refs). Each composition below is the one docs/phase7-wave3-scripting.md §6d gives the scripter; this
 * file proves each validates and emits exactly the plain data the per-primitive engine test drives.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { discardThis, interrupt, on, whenRevealed } from "./abilities.js";
import { enemyAttack, ifThen, modifyStat, surge } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { controllerOf, each, eventSource, hasAttachment, made, not, query, theVillain } from "./values.js";

const valid = (definition: Parameters<typeof validateDefinition>[0]) =>
  expect(validateDefinition(definition)).toEqual([]);

const WEAPON = trait("WEAPON");

describe("§3.39 PlayerRef controllerOf, §3.40 TargetQuery.hasAttachment", () => {
  it("Single-Minded Fury (16114): Ronan attacks the player who controls the Power Stone, else the card surges", () => {
    const stoneHolder = controllerOf(each(query("identity", hasAttachment({ name: "Power Stone" }))));
    expect(stoneHolder).toEqual({
      kind: "controllerOf",
      target: { kind: "each", query: { categories: ["identity"], hasAttachment: { name: "Power Stone" } } },
    });
    valid(
      whenRevealed(enemyAttack(theVillain, { against: stoneHolder, bind: "fury" }), ifThen(not(made("fury")), surge())),
    );
  });

  it("Target Practice (17017): an ally with a weapon attachment upgrade makes an attack", () => {
    const definition = interrupt(
      on.attacks(query("ally", hasAttachment(query("upgrade", { trait: WEAPON })))),
      { cost: discardThis },
      modifyStat("atk", 2, eventSource, "endOfAttack"),
    );
    valid(definition);
    expect(definition.trigger).toEqual({
      kind: "interrupt",
      forced: false,
      on: {
        on: "attack",
        sourceIs: { categories: ["ally"], hasAttachment: { categories: ["upgrade"], trait: WEAPON } },
      },
    });
  });
});
