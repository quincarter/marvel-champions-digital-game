/**
 * docs/phase7-wave6.md §3.11: who may trigger an ability. `{ triggerableBy }` on `action` / `alterEgoAction` /
 * `heroResponse` and the other optional builders emits the `trigger.triggerableBy` the engine reads
 * (`triggerable-by.test.ts` drives it); `playersWhere` is the "any player whose …" ref.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { action, alterEgoAction, exhaustThis, forcedResponse, heroResponse, on } from "./abilities.js";
import { heal, ready } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { controllerOf, hasTrait, identityOf, named, playersWhere, thatPlayer, you } from "./values.js";

const MUTANT = trait("Mutant");
const mutantAlterEgo = playersWhere(hasTrait(identityOf(thatPlayer), MUTANT));

describe("§3.11 `triggerableBy`", () => {
  it("playersWhere(predicate) is the players a predicate holds for, each read as thatPlayer", () => {
    expect(mutantAlterEgo).toEqual({
      kind: "where",
      predicate: { kind: "hasTrait", of: { kind: "identityOf", player: { kind: "scoped" } }, trait: MUTANT },
    });
    expect(playersWhere(hasTrait(identityOf(thatPlayer), MUTANT), you)).toMatchObject({ among: you });
  });

  it("X-Mansion's shape: an Alter-Ego Action any player whose alter-ego is a Mutant may trigger", () => {
    const definition = alterEgoAction({ cost: exhaustThis, triggerableBy: mutantAlterEgo }, heal(1, identityOf(you)));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({ kind: "action", form: "alterEgo", triggerableBy: mutantAlterEgo });
    expect(action({ triggerableBy: mutantAlterEgo }).trigger).toEqual({
      kind: "action",
      triggerableBy: mutantAlterEgo,
    });
  });

  it("Protect the Senator's shape: a Hero Response only the controller of a named card may trigger", () => {
    const senator = controllerOf(named("Robert Kelly"));
    const definition = heroResponse(
      on.defends({ categories: ["hero"], controller: "you" }),
      { triggerableBy: senator },
      ready(identityOf(you)),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toMatchObject({ kind: "response", forced: false, form: "hero", triggerableBy: senator });
  });

  it("absent, the trigger carries no triggerableBy; on a forced ability it is an authoring error", () => {
    expect(alterEgoAction(heal(1, identityOf(you))).trigger).toEqual({ kind: "action", form: "alterEgo" });
    expect(() => forcedResponse(on.defends({ categories: ["hero"] }), { triggerableBy: mutantAlterEgo })).toThrow(
      "forced",
    );
  });
});
