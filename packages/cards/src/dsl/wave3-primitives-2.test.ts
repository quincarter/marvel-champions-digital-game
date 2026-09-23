/**
 * docs/phase7-wave3.md §3.39 onward: the DSL builders for the third wave 3 primitives pass (the last skipped `gmw`,
 * `stld` and `drax` refs). Each composition below is the one docs/phase7-wave3-scripting.md §6d gives the scripter; this
 * file proves each validates and emits exactly the plain data the per-primitive engine test drives.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import {
  constant,
  discardThis,
  heroAction,
  interrupt,
  after,
  on,
  playOnlyIf,
  response,
  spendSameType,
  whenRevealed,
} from "./abilities.js";
import { discard, divide, enemyAttack, giveTough, ifThen, modifyStat, surge } from "./effects.js";
import { validateDefinition } from "./validate.js";
import {
  controllerOf,
  each,
  eachPlayer,
  eventSource,
  exists,
  self,
  hasAttachment,
  made,
  not,
  query,
  theVillain,
  valueAtLeast,
  victoryDisplayCount,
} from "./values.js";

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

describe("§3.41 divide 'up to'", () => {
  it("Agile Flight (17029): remove a total of up to 5 threat from among schemes", () => {
    const definition = heroAction({ label: "thwart" }, divide("threat", 5, query("scheme"), { upTo: true }));
    valid(definition);
    expect(definition.effects).toEqual([
      {
        kind: "divide",
        what: "threat",
        amount: { kind: "const", value: 5 },
        among: { categories: ["scheme"] },
        chooser: { kind: "controller" },
        upTo: true,
      },
    ]);
  });
});

describe("§3.42 playOnlyIf", () => {
  it("Sliding Shot (17005): play only if you control an Element Gun", () => {
    const definition = constant(playOnlyIf(exists({ name: "Element Gun", controller: "you" })));
    valid(definition);
    expect(definition.trigger).toEqual({
      kind: "constant",
      playOnlyIf: { kind: "exists", query: { name: "Element Gun", controller: "you" } },
    });
  });

  it("the other surveyed wordings compose", () => {
    const WEB_WARRIOR = trait("WEB-WARRIOR");
    // "Play only if you control a [Web-Warrior] card" (Spider-Man 27017, Ghost-Spider 27048, …).
    valid(constant(playOnlyIf(exists({ trait: WEB_WARRIOR, controller: "you" }))));
    // "Play only if any player controls a [Martial Artist] card" (Black Belt 62037).
    valid(constant(playOnlyIf(exists({ trait: trait("MARTIAL ARTIST"), controlledBy: eachPlayer }))));
    // "Play only if there is a side scheme in the victory display" (Mission Planning 40017, Critical Hit 43016).
    valid(constant(playOnlyIf(valueAtLeast(victoryDisplayCount(query("sideScheme")), 1))));
    // Two parts are ANDed.
    const both = constant(playOnlyIf(exists({ name: "A" })), playOnlyIf(exists({ name: "B" })));
    expect(both.trigger).toEqual({
      kind: "constant",
      playOnlyIf: {
        kind: "and",
        of: [
          { kind: "exists", query: { name: "A" } },
          { kind: "exists", query: { name: "B" } },
        ],
      },
    });
  });
});

describe("§3.43 a cost of N resources of one type", () => {
  it("Kree Combat Armor (16131): spend 3 resources of the same type → discard this card", () => {
    const definition = heroAction({ cost: spendSameType(3) }, discard(self));
    valid(definition);
    expect(definition.cost).toEqual({ resources: 3, sameResourceType: true });
    expect(
      validateDefinition(heroAction({ cost: { resources: { physical: 1 }, sameResourceType: true } })),
    ).not.toEqual([]);
  });
});

describe("§3.44 consequential damage from an attack", () => {
  it("Martyr (19012): after she takes consequential damage from an attack that defeated an enemy", () => {
    const definition = response(after.consequentialDamage("self", { from: "attack", defeated: true }), giveTough(self));
    valid(definition);
    expect(definition.trigger).toEqual({
      kind: "response",
      forced: false,
      on: {
        on: "dealDamage",
        selfIs: "target",
        requireResults: { amount: 1, "attack.made": 1, "attack.defeated": 1 },
      },
    });
  });
});
