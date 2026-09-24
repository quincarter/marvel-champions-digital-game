/**
 * docs/phase7-wave4.md §3: the DSL builders for cycle 3's engine primitives. Each composition below is the one the spec
 * gives the scripter for a printed card; this file proves each validates and emits exactly the plain data the
 * per-primitive engine test drives.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import {
  action,
  constant,
  focusedMainScheme,
  forcedInterrupt,
  forcedResponse,
  heroAction,
  heroResponse,
  on,
  playOnlyIf,
  rule,
  setup,
  stateCheck,
  whenDefeated,
  whenRevealed,
} from "./abilities.js";
import {
  advanceToSetAsideVillain,
  attachCard,
  attackAnEnemy,
  changeAdditionalForm,
  damageAnEnemy,
  dealDamage,
  detach,
  discard,
  chooseTarget,
  draw,
  endGame,
  enemyScheme,
  ifThen,
  putMainSchemeStageIntoPlay,
  removeCountersFrom,
  swapVillain,
  turnFacedown,
} from "./effects.js";
import { validateDefinition } from "./validate.js";
import {
  chosen,
  each,
  eventTarget,
  host,
  inAdditionalForm,
  inPlayAreaOf,
  named,
  not,
  printedForm,
  query,
  self,
  theVillain,
  valueAtLeast,
  victoryCondition,
  victoryDisplayCount,
  you,
  yourIdentity,
} from "./values.js";

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

describe("§3.2 two main schemes", () => {
  it("Under Siege 1A and Focused Defense (21098a, 21101)", () => {
    valid(setup(putMainSchemeStageIntoPlay(2)));
    const focused = constant(focusedMainScheme());
    expect(focused.trigger).toMatchObject({ rules: [{ kind: "focusedMainScheme", scheme: { kind: "host" } }] });
    valid(focused);
    valid(forcedResponse(on.phaseEnding("player"), attachCard(self, each(query("mainScheme", { excluding: host })))));
  });
});

describe("§3.7 Loki", () => {
  it("All Hail King Loki 1B, The Trickster (21165b, 21176)", () => {
    valid(forcedInterrupt(on.defeated(query("villain", { name: "Loki" })), advanceToSetAsideVillain(eventTarget)));
    valid(
      stateCheck(
        valueAtLeast(victoryDisplayCount(query("villain", { name: "Loki" })), victoryCondition),
        endGame("win"),
      ),
    );
    valid(whenRevealed(swapVillain(), enemyScheme(theVillain)));
  });
});

describe("§3.8 an encounter ally attached to the main scheme", () => {
  it("Hall of Nastrond and Odin (21141, 21139a)", () => {
    valid(whenDefeated(detach(named("Odin"))));
    valid(
      constant(
        rule({ kind: "cannotHaveAttachments", target: { self: true } }),
        rule({ kind: "leavingPlayLoses", target: { self: true } }),
      ),
    );
  });
});

describe("§3.15 / §3.16 Ebony Maw's Spells", () => {
  it("Fireball and Ebony Maw (21076, 21071)", () => {
    valid(forcedResponse(on.lastCounterRemoved("invocation"), discard(self), dealDamage(4, yourIdentity)));
    valid(constant(rule({ kind: "entersRevealersPlayArea", cards: { trait: trait("SPELL") } })));
    valid(
      forcedInterrupt(
        on.villainAttacks({ againstYou: true }),
        removeCountersFrom(each(query([], { trait: trait("SPELL"), ...inPlayAreaOf() })), "invocation", 1),
      ),
    );
  });
});
