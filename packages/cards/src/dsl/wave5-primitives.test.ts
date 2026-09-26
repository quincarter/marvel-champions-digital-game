/**
 * docs/phase7-wave5.md §3: the DSL builders for cycle 4's engine primitives. Each composition below is the one the spec
 * gives the scripter for a printed card; this file proves each validates and emits exactly the plain data the
 * per-primitive engine test drives.
 */

import { describe, expect, it } from "vitest";
import {
  forcedInterrupt,
  forcedResponse,
  heroInterrupt,
  mainSchemeMarkedBy,
  on,
  setup,
  whenDefeated,
  whenRevealed,
} from "./abilities.js";
import {
  addAccelerationToken,
  addVillain,
  cancelIt,
  dealDamage,
  dealIndirectDamage,
  encounterSetAside,
  ifThen,
  moveActiveCounterToNextVillain,
  moveCounters,
  resolveSpecialsOf,
  selectCards,
  setActiveVillain,
  setVillainAside,
} from "./effects.js";
import {
  activationOrderOf,
  chosen,
  each,
  eventTarget,
  exists,
  firstPlayer,
  not,
  perHero,
  query,
  refMatches,
  self,
  superlative,
  threatOn,
} from "./values.js";
import { validateDefinition } from "./validate.js";

const valid = (definition: Parameters<typeof validateDefinition>[0]) =>
  expect(validateDefinition(definition)).toEqual([]);

describe("§3.1 villains that enter and leave play (The Sinister Six)", () => {
  it("Sinister Synchronization 1A: X = players + 1 random set-aside villains, the lowest activation order active", () => {
    const definition = setup(
      selectCards("starting", encounterSetAside(query("villain"), { random: perHero(1, 1) })),
      addVillain(chosen("starting")),
      setActiveVillain(superlative("lowest", each(query("villain")), activationOrderOf(chosen("candidate")))),
    );
    valid(definition);
    expect(definition.effects[2]).toEqual({
      kind: "setActiveVillain",
      villain: {
        kind: "superlative",
        order: "lowest",
        among: { kind: "each", query: { categories: ["villain"] } },
        measure: { kind: "activationOrder", of: { kind: "slot", slot: "candidate" } },
      },
    });
  });

  it("a Sinister Six villain's When Defeated sets it aside; Ambush! reports what entered", () => {
    valid(whenDefeated(setVillainAside(self)));
    expect(addVillain(chosen("pick"), { bind: "ambush" })).toEqual({
      kind: "addVillain",
      villain: { kind: "slot", slot: "pick" },
      bind: "ambush",
    });
    expect(moveActiveCounterToNextVillain).toEqual({ kind: "moveActiveCounter", to: "nextInActivationOrder" });
  });
});

describe("§3.2 an enemy activation that can be interrupted and canceled", () => {
  it("Web Binding: cancel that activation; 4 damage to a minion whose activation was cancelled", () => {
    const definition = heroInterrupt(
      on.enemyActivating(),
      cancelIt(),
      ifThen(refMatches(eventTarget, query("minion")), dealDamage(4, eventTarget)),
    );
    valid(definition);
    expect(definition.trigger).toMatchObject({ kind: "interrupt", on: { on: "enemyActivating" } });
  });

  it("Sinister Synchronization 1B: if no villain is in play, resolve Ambush! and continue", () => {
    valid(forcedInterrupt(on.enemyActivating(), ifThen(not(exists(query("villain"))), setActiveVillain(self))));
    expect(on.enemyActivating(query("minion"))).toEqual({
      on: "enemyActivating",
      targetIs: { categories: ["minion"] },
    });
  });
});

describe("§3.3 several main schemes, one marked by the glider counter", () => {
  it("the glider rule names the main scheme with the counter; Joy Ride moves it to the most threat", () => {
    expect(mainSchemeMarkedBy("glider")).toEqual({
      kind: "focusedMainScheme",
      scheme: { kind: "each", query: { categories: ["mainScheme"], hasCounter: "glider" } },
      encounterCards: "focused",
    });
    const joyRide = whenRevealed(
      moveCounters(
        each(query("mainScheme", { hasCounter: "glider" })),
        superlative("highest", each(query("mainScheme")), threatOn(chosen("candidate"))),
        "glider",
      ),
      resolveSpecialsOf(each(query("mainScheme", { hasCounter: "glider" }))),
    );
    valid(joyRide);
  });
});

describe("§3.4 acceleration tokens on any card", () => {
  it("Hapless Pedestrians 1B hears a token placed on itself; Tracking Prey places one on itself", () => {
    const pedestrians = forcedResponse(on.accelerationTokenPlaced("self"), dealIndirectDamage(firstPlayer, 3));
    valid(pedestrians);
    expect(pedestrians.trigger).toMatchObject({ on: { on: "accelerationTokenPlaced", selfIs: "target" } });
    valid(whenRevealed(addAccelerationToken(self)));
  });
});
