/**
 * docs/phase7-wave9.md §3.4: the DSL surface for the attack in progress as a Preparation reads it.
 * `modifyAttack({ preventAllDamage, bind })` with its readers, and `attackResolvedLabeled`. The engine side is driven
 * by `packages/engine/src/attack-in-progress-readers.test.ts`.
 */

import { attackPreventedVars, labeledResolvedVar } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { forcedResponse, on, preparation } from "./abilities.js";
import { atEndOfAttack, dealDamage, discard, ifThen, modifyAttack, retargetPlayerAttack } from "./effects.js";
import { validateDefinition } from "./validate.js";
import {
  attackPreventedAmount,
  attackPreventedTotal,
  attackResolvedLabeled,
  attackWasPrevented,
  eventSource,
  not,
  self,
  varOf,
} from "./values.js";

describe("§3.4 `modifyAttack({ preventAllDamage, bind })`", () => {
  it("'Preparation: Prevent all damage from this attack. Deal that much damage to the attacking character'", () => {
    const definition = preparation(
      modifyAttack({ preventAllDamage: true, bind: "prevented" }),
      atEndOfAttack(dealDamage(attackPreventedAmount("prevented"), eventSource)),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects[0]).toEqual({ kind: "modifyAttack", preventAllDamage: true, bind: "prevented" });
    expect(attackPreventedAmount("prevented")).toEqual({ kind: "eventResult", key: "prevented.amount" });
  });

  it("the readers are the engine's result names", () => {
    const vars = attackPreventedVars("p");
    expect(attackPreventedAmount("p")).toEqual({ kind: "eventResult", key: vars.amount });
    expect(attackPreventedTotal("p")).toEqual({ kind: "eventResult", key: vars.total });
    expect(attackWasPrevented("p")).toEqual({ kind: "eventResultAtLeast", key: vars.prevented, amount: 1 });
  });

  it("absent, no bind key is emitted", () => {
    expect(modifyAttack({ preventAllDamage: true })).toEqual({ kind: "modifyAttack", preventAllDamage: true });
  });

  it("a bind without preventAllDamage, or with no name, is rejected", () => {
    expect(validateDefinition(preparation(modifyAttack({ overkill: true, bind: "prevented" })))).toEqual([
      "modifyAttack: bind reports what preventAllDamage stops; it needs preventAllDamage",
    ]);
    expect(validateDefinition(preparation(modifyAttack({ preventAllDamage: true, bind: "" })))).toEqual([
      "modifyAttack: bind needs a name",
    ]);
  });

  it("the amount is the attack's result, not a var of the ability: reading it as a var is rejected", () => {
    const definition = preparation(
      modifyAttack({ preventAllDamage: true, bind: "prevented" }),
      dealDamage(varOf("prevented.amount"), eventSource),
    );
    expect(validateDefinition(definition)).not.toEqual([]);
  });
});

describe("§3.4 `attackResolvedLabeled` and the retarget onto the card itself", () => {
  it("'if no Preparation ability was resolved, discard this card': the existing eventResultAtLeast, no new predicate", () => {
    expect(attackResolvedLabeled("preparation")).toEqual({
      kind: "eventResultAtLeast",
      key: labeledResolvedVar("preparation"),
      amount: 1,
    });
    const definition = forcedResponse(
      on.attacks({ categories: ["identity", "ally"] }, { target: { hostOfSelf: true } }),
      ifThen(not(attackResolvedLabeled("preparation")), discard(self)),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("'resolve this attack against this card instead' is the player retarget, naming the card", () => {
    expect(retargetPlayerAttack(self)).toEqual({
      kind: "retargetAttack",
      attack: "player",
      character: { kind: "self" },
    });
    expect(validateDefinition(preparation(retargetPlayerAttack(self)))).toEqual([]);
  });
});
