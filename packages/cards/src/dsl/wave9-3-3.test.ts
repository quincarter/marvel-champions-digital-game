/**
 * docs/phase7-wave9.md §3.3: `grantsPreparation(...)` and `grantingCard`, "Each encounter card without a printed
 * 'Preparation' ability gains 'Preparation: …'" (Night Vision Goggles, `aos` 50070; Automated Defenses 50074). The
 * engine's `grants-labeled-ability.test.ts` drives the plain data.
 */

import { GRANTED_BY_SLOT } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { constant, forcedResponse, grantingCard, grantsPreparation, preparation } from "./abilities.js";
import { dealDamage, discard } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { eventSource, isHero } from "./values.js";

describe("§3.3 `grantsPreparation` and `grantingCard`", () => {
  it("`grantsPreparation` is a constant rule naming the granted ability's registry id", () => {
    const definition = constant(grantsPreparation("50074.automated-defenses-granted-preparation"));
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "grantsLabeledAbility",
          label: "preparation",
          to: "encounterCardsWithoutPrinted",
          abilityId: "50074.automated-defenses-granted-preparation",
        },
      ],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("`while` gates the rule like any other constant part", () => {
    const inHeroForm = isHero();
    const definition = constant(grantsPreparation("x.granted-preparation", { while: inHeroForm }));
    const [rule] = definition.trigger.kind === "constant" ? (definition.trigger.rules ?? []) : [];
    expect(rule).toMatchObject({ kind: "grantsLabeledAbility", while: inHeroForm });
  });

  it("`grantingCard` is the engine's slot, bound for a Preparation and for no other ability", () => {
    expect(grantingCard).toEqual({ kind: "slot", slot: GRANTED_BY_SLOT });
    // "Preparation: Deal 1 damage to the attacking character. Then, discard [the granting card]."
    const granted = preparation(dealDamage(1, eventSource), discard(grantingCard));
    expect(granted.effects.at(-1)).toEqual({ kind: "discardFromPlay", target: grantingCard });
    expect(validateDefinition(granted)).toEqual([]);
    expect(
      validateDefinition(forcedResponse({ on: "attack", selfIs: "target" }, discard(grantingCard))).join("\n"),
    ).toMatch(/slot "_grantedBy" is read before it is bound/);
  });
});
