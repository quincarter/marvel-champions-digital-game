/**
 * The DSL builders for three engine primitives a custom-content hero needs before any base card uses them (Agile X,
 * "the last card you played this round", a per-player blank), and `ENGINE_ONLY_DSL_EXAMPLES`, the definitions the mod
 * SDK walks with the base registry so a pack using them is not refused (docs/custom-content-packs.md §6, §11.2).
 */

import { describe, expect, it } from "vitest";
import { trait } from "@mc/content";
import type { AbilityDefinition } from "@mc/engine";
import {
  agile,
  cannotBeAttachedUnlessInPlay,
  constant,
  doubleStat,
  minDamageTaken,
  multiplyStat,
  on,
  resourcesGeneratedAsWild,
  setAsideDestination,
  special,
  tagged,
  upgradesCannotBeRemoved,
  VILLAIN_OR_VILLAINOUS,
} from "./abilities.js";
import {
  cancelBoostedActivation,
  blankTextBoxForPlayers,
  blankTextBoxUntil,
  cards,
  doubleNextCardSpent,
  draw,
  enemyActivates,
  findCard,
  loseKeywordUntil,
  loseTraitUntil,
  moveCards,
  putIntoPlayFacedown,
  replaceNextVillainPhaseWithPlayerPhase,
  resolveOneTagged,
  resolveTagged,
  scenarioArea,
  selectCards,
  topOfDeck,
} from "./effects.js";
import { ENGINE_ONLY_DSL_EXAMPLES, engineOnlyDslProblems } from "./engine-only-features.js";
import { validateDefinition } from "./validate.js";
import {
  each,
  hasTaggedAbility,
  lastPlayedThisRound,
  query,
  self,
  statOf,
  taggedAbilitiesOn,
  thatPlayer,
  you,
  YOUR_IDENTITY,
} from "./values.js";

describe("engine-only DSL primitives", () => {
  it("agile(X) is an attack damage reduction for undefended villain and villainous attacks only", () => {
    const hero = { categories: ["hero"], controller: "you" } as const;
    expect(agile(2, hero)).toEqual({
      rules: [
        {
          kind: "reduceDamageTaken",
          target: hero,
          amount: 2,
          fromAttack: true,
          onlyAttacker: VILLAIN_OR_VILLAINOUS,
          onlyUndefended: true,
        },
      ],
    });
  });

  it("lastPlayedThisRound reads 'you' by default", () => {
    expect(lastPlayedThisRound(query("event"))).toEqual({
      kind: "lastPlayedThisRound",
      player: you,
      cards: { categories: ["event"] },
    });
  });

  it("blankTextBoxForPlayers is a blankTextBox with forPlayers; without it the blank is everyone's", () => {
    expect(blankTextBoxForPlayers(self, thatPlayer, "endOfPhase")).toEqual({
      kind: "blankTextBox",
      target: self,
      until: "endOfPhase",
      forPlayers: thatPlayer,
    });
    expect(blankTextBoxUntil(self, "endOfPhase")).toEqual({ kind: "blankTextBox", target: self, until: "endOfPhase" });
  });

  it("tagged abilities: a Special with a tag, resolved, counted and matched by that tag", () => {
    expect(tagged("pinkBubble", draw(1)).trigger).toEqual({ kind: "special", tag: "pinkBubble" });
    // A flavor bubble: no effects, still a valid definition.
    expect(validateDefinition(tagged("pinkBubble"))).toEqual([]);
    expect(special(draw(1)).trigger).toEqual({ kind: "special" });
    expect(resolveTagged("purpleBubble")).toEqual({ kind: "resolveSpecials", cards: {}, tag: "purpleBubble" });
    expect(resolveOneTagged("pinkBubble", { cards: query("hero"), of: self, bind: "b" })).toEqual({
      kind: "resolveSpecials",
      cards: { categories: ["hero"] },
      tag: "pinkBubble",
      pick: "one",
      of: self,
      bind: "b",
    });
    expect(taggedAbilitiesOn("pinkBubble", { controller: "you" })).toEqual({
      kind: "taggedAbilities",
      tag: "pinkBubble",
      cards: { controller: "you" },
    });
    expect(taggedAbilitiesOn("purpleBubble")).toEqual({ kind: "taggedAbilities", tag: "purpleBubble" });
    expect(hasTaggedAbility("pinkBubble")).toEqual({ hasTaggedAbility: "pinkBubble" });
  });

  it("the validator refuses an empty tag and a tag on a non-Special resolve", () => {
    const emptyTag: AbilityDefinition = { trigger: { kind: "special", tag: "" }, effects: [] };
    expect(validateDefinition(emptyTag)).toContain("tagged ability: the tag is a non-empty name");
    const wrongKind: AbilityDefinition = {
      trigger: { kind: "action" },
      effects: [{ kind: "resolveSpecials", cards: {}, tag: "x", trigger: "boost" }],
    };
    expect(validateDefinition(wrongKind)).toContain(
      'resolveSpecials: `tag` names tagged abilities, which are `trigger: "special"`',
    );
  });

  it("the extra player phase and the lasting losses", () => {
    expect(replaceNextVillainPhaseWithPlayerPhase()).toEqual({ kind: "replaceNextVillainPhaseWithPlayerPhase" });
    expect(loseKeywordUntil({ name: "guard" }, self, "endOfRound")).toEqual({
      kind: "grantKeywordUntil",
      keyword: { name: "guard" },
      target: self,
      until: "endOfRound",
      loses: true,
    });
    expect(loseTraitUntil(trait("Elite"), self, "endOfRound")).toEqual({
      kind: "grantTraitUntil",
      trait: "ELITE",
      target: self,
      until: "endOfRound",
      loses: true,
    });
  });

  it("cards(ref, filter, { random }) picks that many of the named cards at random; the validator refuses 0", () => {
    const yours = each(query("upgrade", { controller: "you" }));
    expect(cards(yours, undefined, { random: 1 })).toEqual({
      kind: "ref",
      ref: yours,
      random: { kind: "const", value: 1 },
    });
    expect(cards(yours)).toEqual({ kind: "ref", ref: yours });
    const zero: AbilityDefinition = {
      trigger: { kind: "action" },
      effects: [selectCards("x", cards(yours, undefined, { random: 0 }))],
    };
    expect(validateDefinition(zero).join(" ")).toMatch(/ref selector's random count/);
  });

  it("Damnation-style scenario areas: facedown moves, random picks, a set-aside redirect", () => {
    expect(moveCards(topOfDeck(1), { scenarioArea: "Damnation" }, undefined, { facedown: true })).toMatchObject({
      kind: "moveCards",
      to: { scenarioArea: "Damnation" },
      facedown: true,
    });
    expect(scenarioArea("Damnation", undefined, { random: 2 })).toEqual({
      kind: "scenarioArea",
      name: "Damnation",
      random: { kind: "const", value: 2 },
    });
    expect(scenarioArea("Damnation")).toEqual({ kind: "scenarioArea", name: "Damnation" });
    expect(setAsideDestination("Damnation", { facedown: true })).toEqual({
      rules: [{ kind: "setAsideDestination", area: "Damnation", facedown: true }],
    });
    const faceupElsewhere: AbilityDefinition = {
      trigger: { kind: "action" },
      effects: [moveCards(topOfDeck(1), "discard", undefined, { facedown: true })],
    };
    expect(validateDefinition(faceupElsewhere).join(" ")).toMatch(/facedown is only for a \{ scenarioArea \}/);
    const zeroPick: AbilityDefinition = {
      trigger: { kind: "action" },
      effects: [moveCards(scenarioArea("Damnation", undefined, { random: 0 }), "deckShuffle")],
    };
    expect(validateDefinition(zeroPick).join(" ")).toMatch(/scenarioArea selector's random count/);
  });

  it("stat doubling, a damage floor, wild generation and a facedown minion from the discard pile", () => {
    expect(doubleStat("atk", YOUR_IDENTITY)).toEqual({
      rules: [{ kind: "multiplyStat", stat: "atk", factor: 2, target: YOUR_IDENTITY }],
    });
    expect(validateDefinition(constant(multiplyStat("def", 0, YOUR_IDENTITY))).join(" ")).toMatch(
      /factor must be a number above 0/,
    );
    const lasting: AbilityDefinition = {
      trigger: { kind: "action" },
      effects: [
        {
          kind: "applyRuleUntil",
          rule: { kind: "multiplyStat", stat: "atk", factor: -1, target: YOUR_IDENTITY },
          until: "endOfPhase",
        },
      ],
    };
    expect(validateDefinition(lasting).join(" ")).toMatch(/multiplyStat atk: the factor must be a number above 0/);
    expect(on.cardPutIntoScenarioArea("Damnation", { from: "deck", notFromSelf: true })).toEqual({
      on: "cardPutIntoScenarioArea",
      eventIs: { area: "Damnation", from: "deck" },
      sourceIs: { not: { self: true } },
    });
    expect(enemyActivates(self, { boostCards: self })).toMatchObject({ kind: "enemyActivation", boostCards: self });
    const its = statOf({ kind: "slot", slot: "affected" }, "def");
    expect(minDamageTaken(YOUR_IDENTITY, its)).toEqual({
      rules: [{ kind: "minDamageTakenPerAttack", target: YOUR_IDENTITY, amount: its }],
    });
    expect(resourcesGeneratedAsWild(you)).toEqual({ rules: [{ kind: "resourcesGeneratedAsWild", player: you }] });
    const mystic = { kind: "minion", traits: [trait("MYSTIC")] } as const;
    expect(putIntoPlayFacedown(you, mystic, 2, { from: "discard" })).toEqual({
      kind: "putIntoPlayFacedown",
      player: you,
      as: mystic,
      count: { kind: "const", value: 2 },
      from: "discard",
    });
    expect(putIntoPlayFacedown(you, mystic)).toEqual({ kind: "putIntoPlayFacedown", player: you, as: mystic });
  });

  it("a Boost ability's 'cancel this activation'", () => {
    expect(cancelBoostedActivation()).toEqual({ kind: "cancelBoostedActivation" });
    expect(ENGINE_ONLY_DSL_EXAMPLES["engine-only.boost-cancels-activation"]).toMatchObject({
      trigger: { kind: "boost" },
      effects: [{ kind: "cancelBoostedActivation" }],
    });
  });

  it("the Yondu pack's primitives: attach only in play, removed from a host, next card doubled, held upgrades, find anywhere", () => {
    expect(cannotBeAttachedUnlessInPlay).toEqual({ attachedOnlyWhileInPlay: true });
    expect(ENGINE_ONLY_DSL_EXAMPLES["engine-only.attached-only-in-play"]).toMatchObject({
      trigger: { kind: "constant", attachedOnlyWhileInPlay: true },
    });
    expect(ENGINE_ONLY_DSL_EXAMPLES["engine-only.card-unattached"]).toMatchObject({
      trigger: {
        kind: "response",
        on: { on: "cardUnattached", sourceIs: { name: "Yaka Arrow" }, targetIs: { categories: ["enemy"] } },
      },
      effects: [{ kind: "dealDamage", target: { kind: "eventTarget" } }],
    });
    expect(doubleNextCardSpent()).toEqual({ kind: "doubleNextCardSpent" });
    expect(ENGINE_ONLY_DSL_EXAMPLES["engine-only.double-next-card-spent"]).toMatchObject({
      effects: [{ rule: { kind: "doubleNextCardSpent" }, until: "endOfRound" }],
    });
    expect(upgradesCannotBeRemoved()).toEqual({
      rules: [{ kind: "cannotLeaveHost", target: { categories: ["upgrade"], host: { kind: "self" } } }],
    });
    expect(findCard({ name: "Tahlei" }, "hand", { anywhere: true })).toMatchObject({
      kind: "findCard",
      anywhere: true,
    });
    expect(findCard({ name: "Tahlei" }, "hand")).not.toHaveProperty("anywhere");
  });

  it("every example passes the DSL's validator and there is one per primitive", () => {
    expect(engineOnlyDslProblems()).toEqual([]);
    expect(Object.keys(ENGINE_ONLY_DSL_EXAMPLES).sort()).toEqual([
      "engine-only.activation-boost-card",
      "engine-only.agile",
      "engine-only.attached-only-in-play",
      "engine-only.basic-power-boost",
      "engine-only.boost-cancels-activation",
      "engine-only.cannot-leave-host",
      "engine-only.card-unattached",
      "engine-only.double-next-card-spent",
      "engine-only.double-stat",
      "engine-only.enemy-attacks-enemy-bind",
      "engine-only.extra-player-phase",
      "engine-only.facedown-from-discard",
      "engine-only.facedown-into-area",
      "engine-only.find-anywhere",
      "engine-only.has-tagged",
      "engine-only.last-played",
      "engine-only.lasting-flip-lock",
      "engine-only.lose-keyword",
      "engine-only.lose-trait",
      "engine-only.min-damage-taken",
      "engine-only.per-player-blank",
      "engine-only.put-into-area",
      "engine-only.random-from-area",
      "engine-only.random-in-play",
      "engine-only.resolve-all-tagged",
      "engine-only.resolve-one-tagged",
      "engine-only.resources-as-wild",
      "engine-only.set-aside-destination",
      "engine-only.tagged",
      "engine-only.tagged-count",
    ]);
  });
});
