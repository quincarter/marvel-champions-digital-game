/**
 * docs/phase7-wave7.md §3.66: "change the target of this attack to a friendly character of your choice"
 * (`retargetPlayerAttack`, chosen among `CAN_TAKE_THIS_ATTACK`) and "a resource of the named type"
 * (`hasNamedResource`, with the reading of a printed wild icon said each time; §4.1 Q40 = B). The engine's
 * `player-attack-retarget.test.ts` drives the behavior.
 */

import { describe, expect, it } from "vitest";
import { forcedInterrupt, on } from "./abilities.js";
import { chooseTarget, retargetAttack, retargetPlayerAttack } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { CAN_TAKE_THIS_ATTACK, chosen, FRIENDLY_CHARACTER, hasNamedResource, query, YOUR_IDENTITY } from "./values.js";

describe("§3.66 a player's attack redirected to a friendly character", () => {
  it("retargetPlayerAttack is retargetAttack marked for the player attack; the enemy form is unchanged", () => {
    expect(retargetPlayerAttack(chosen("new"))).toEqual({
      kind: "retargetAttack",
      attack: "player",
      character: { kind: "slot", slot: "new" },
    });
    expect(retargetAttack(chosen("new"))).toEqual({ kind: "retargetAttack", character: { kind: "slot", slot: "new" } });
  });

  it("the candidates are the friendly characters that can take the attack in progress", () => {
    expect(CAN_TAKE_THIS_ATTACK).toEqual({ ...FRIENDLY_CHARACTER, canTakeAttackInProgress: "player" });
  });

  it("hasNamedResource states how a printed wild icon is read", () => {
    expect(hasNamedResource("mental", "anyType")).toEqual({
      printedResourceNamed: { type: "mental", wild: "anyType" },
    });
    expect(hasNamedResource("mental", "ownType")).toEqual({
      printedResourceNamed: { type: "mental", wild: "ownType" },
    });
  });

  it("'When you attack an enemy, … change the target of this attack to a friendly character of your choice' validates", () => {
    const definition = forcedInterrupt(
      on.attacks(YOUR_IDENTITY, { target: query("enemy") }),
      chooseTarget("new", CAN_TAKE_THIS_ATTACK),
      retargetPlayerAttack(chosen("new")),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      { kind: "chooseTarget", slot: "new", query: CAN_TAKE_THIS_ATTACK, chooser: { kind: "controller" } },
      { kind: "retargetAttack", attack: "player", character: { kind: "slot", slot: "new" } },
    ]);
  });
});
