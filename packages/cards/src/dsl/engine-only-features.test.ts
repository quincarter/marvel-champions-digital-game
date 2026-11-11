/**
 * The DSL builders for three engine primitives a custom-content hero needs before any base card uses them (Agile X,
 * "the last card you played this round", a per-player blank), and `ENGINE_ONLY_DSL_EXAMPLES`, the definitions the mod
 * SDK walks with the base registry so a pack using them is not refused (docs/custom-content-packs.md §6, §11.2).
 */

import { describe, expect, it } from "vitest";
import { trait } from "@mc/content";
import type { AbilityDefinition } from "@mc/engine";
import { agile, special, tagged, VILLAIN_OR_VILLAINOUS } from "./abilities.js";
import {
  blankTextBoxForPlayers,
  blankTextBoxUntil,
  draw,
  loseKeywordUntil,
  loseTraitUntil,
  replaceNextVillainPhaseWithPlayerPhase,
  resolveOneTagged,
  resolveTagged,
} from "./effects.js";
import { ENGINE_ONLY_DSL_EXAMPLES, engineOnlyDslProblems } from "./engine-only-features.js";
import { validateDefinition } from "./validate.js";
import { hasTaggedAbility, lastPlayedThisRound, query, self, taggedAbilitiesOn, thatPlayer, you } from "./values.js";

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

  it("every example passes the DSL's validator and there is one per primitive", () => {
    expect(engineOnlyDslProblems()).toEqual([]);
    expect(Object.keys(ENGINE_ONLY_DSL_EXAMPLES).sort()).toEqual([
      "engine-only.agile",
      "engine-only.basic-power-boost",
      "engine-only.extra-player-phase",
      "engine-only.has-tagged",
      "engine-only.last-played",
      "engine-only.lasting-flip-lock",
      "engine-only.lose-keyword",
      "engine-only.lose-trait",
      "engine-only.per-player-blank",
      "engine-only.resolve-all-tagged",
      "engine-only.resolve-one-tagged",
      "engine-only.tagged",
      "engine-only.tagged-count",
    ]);
  });
});
