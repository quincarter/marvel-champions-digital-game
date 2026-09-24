/**
 * docs/phase7-wave4.md §3: the DSL builders for cycle 3's engine primitives. Each composition below is the one the spec
 * gives the scripter for a printed card; this file proves each validates and emits exactly the plain data the
 * per-primitive engine test drives.
 */

import { describe, expect, it } from "vitest";
import {
  action,
  constant,
  forcedResponse,
  heroAction,
  heroResponse,
  on,
  playOnlyIf,
  rule,
  setup,
} from "./abilities.js";
import {
  attackAnEnemy,
  changeAdditionalForm,
  damageAnEnemy,
  chooseTarget,
  draw,
  ifThen,
  turnFacedown,
} from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, each, inAdditionalForm, not, printedForm, query, you } from "./values.js";

const valid = (definition: Parameters<typeof validateDefinition>[0]) =>
  expect(validateDefinition(definition)).toEqual([]);

const FACEDOWN_ENERGY_FORM = query("upgrade", { ...printedForm("energy"), facedown: true, controller: "you" });

describe("§3.1 additional forms", () => {
  it("Spectrum's Energy Transformation (21001a): choose a facedown energy form upgrade → flip it faceup to change to it", () => {
    expect(FACEDOWN_ENERGY_FORM).toEqual({
      categories: ["upgrade"],
      printedForm: "energy",
      facedown: true,
      controller: "you",
    });
    const definition = forcedResponse(
      on.youChangeIdentityForm(),
      chooseTarget("form", FACEDOWN_ENERGY_FORM),
      changeAdditionalForm("energy", { to: chosen("form") }),
    );
    expect(definition.trigger).toMatchObject({
      kind: "response",
      forced: true,
      on: { on: "formChanged", playerIs: "controller", eventIs: { change: "identity" } },
    });
    valid(definition);
  });

  it("Monica Rambeau (21001b): Setup puts the forms into play facedown; Power Down turns them facedown", () => {
    valid(setup(turnFacedown(each(query("upgrade", { ...printedForm("energy"), controller: "you" })))));
    valid(forcedResponse(on.youChangeIdentityForm(), turnFacedown(each(query("upgrade", printedForm("energy"))))));
  });

  it("Gamma (21002) and Gamma Blast (21007): 'After you change to this energy form'; 'if you were already in Gamma energy form'", () => {
    const heard = heroResponse(on.youChangeToThisForm(), damageAnEnemy(1));
    expect(heard.trigger).toMatchObject({ on: { selfIs: "target", eventIs: { change: "additional" } } });
    valid(heard);
    valid(
      heroAction(
        { label: "attack" },
        ifThen(not(inAdditionalForm("energy", "Gamma")), changeAdditionalForm("energy", { toName: "Gamma" })),
        attackAnEnemy(7),
      ),
    );
  });

  it("Loss of Control (21026): 'You cannot change energy forms'", () => {
    const definition = constant(rule({ kind: "cannotChangeForm", player: you, formType: "energy" }));
    valid(definition);
  });

  it("Vision (26001a/b, 26002, 26007, 26009): flip the mass form upgrade; play only in Dense; after you change mass form", () => {
    valid(action({ limit: { count: 1, period: "round" } }, changeAdditionalForm("mass")));
    valid(constant(playOnlyIf(inAdditionalForm("mass", "Dense"))));
    const density = heroResponse(on.youChangeAdditionalForm("mass"), draw(1));
    expect(density.trigger).toMatchObject({ on: { eventIs: { change: "additional", formType: "mass" } } });
    valid(density);
  });
});
