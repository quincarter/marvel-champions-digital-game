/**
 * docs/phase7-wave11.md §3.11: "Choose 1 upgrade in your hand that can attach to a minion or side scheme" (Contingency
 * Planning, `fne` 60030), as `TargetQuery.canAttachToCategory: ["minion", "sideScheme"]`. The wave 8 field
 * (docs/phase7-wave8.md §3.59, `can-attach-to-category.test.ts`) widened from "ally" to minions and side schemes, a list
 * meaning any of them.
 *
 * Sources: RRG 1.8 "Attach To" (p. 8), "Upgrade" (p. 46: an upgrade with no host text enters play by its controller's
 * identity), "Enemy" (a minion is an enemy). Owner decision wave 8 §4.1 Q30 = A, kept for wave 11: eligibility comes
 * from the upgrade's own attach text; no minion or side scheme needs to be in play.
 */

import { FNE_CARDS, type AnyCard, type AttachmentHost, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import { hostAllowsCategory } from "./attachment-hosts.js";
import { explainQuery, selectTargets } from "./select.js";
import type { AttachCategory, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";

const MINION_OR_SIDE_SCHEME: readonly AttachCategory[] = ["minion", "sideScheme"];

/** The printed card, its ability references dropped so a bare test game can load it. */
const printed = (name: string): UpgradeCard => {
  const card = FNE_CARDS.find((c: AnyCard) => c.name === name);
  if (card?.type !== "upgrade") throw new Error(`no fne upgrade named ${name}`);
  return { ...card, abilities: [] };
};
const LEGAL_TROUBLE = printed("Legal Trouble"); // Attach to a minion.
const CHANCE_ENCOUNTER = printed("Chance Encounter"); // Attach to a side scheme.
const STEALTH_TRAINING = printed("Stealth Training"); // No "attach to": your identity.
const HEIGHTENED_HEARING = printed("Heightened Hearing"); // A Sense upgrade: attach to an enemy.

describe("§3.11 `hostAllowsCategory` for minions and side schemes: the printed text alone", () => {
  const cases: readonly (readonly [string, AttachmentHost, boolean, boolean])[] = [
    // [label, host, allows a minion, allows a side scheme]
    ["minion", { kind: "minion" }, true, false],
    ["enemy (a minion is an enemy)", { kind: "enemy" }, true, false],
    ["minion with highest printed HP", { kind: "minionWithHighestPrintedHp" }, true, false],
    ["any character", { kind: "anyCharacter" }, true, false],
    ["qualified minion", { kind: "qualified", category: "minion", withoutTrait: "ELITE" as never }, true, false],
    ["qualified enemy", { kind: "qualified", category: "enemy", trait: "MERC" as never }, true, false],
    [
      "superlative enemy",
      { kind: "superlative", among: "enemy", order: "highest", measure: "printedAtk" },
      true,
      false,
    ],
    ["side scheme", { kind: "sideScheme" }, false, true],
    ["scheme", { kind: "scheme" }, false, true],
    ["villain's side scheme", { kind: "villainSideScheme", of: "activeVillain" }, false, true],
    [
      "non-permanent side scheme",
      { kind: "qualified", category: "sideScheme", withoutKeyword: "permanent" },
      false,
      true,
    ],
    ["encounter card", { kind: "encounterCard" }, true, true],
    ["any card", { kind: "anyCard" }, true, true],
    ["enemy or scheme", { kind: "anyOf", hosts: [{ kind: "enemy" }, { kind: "scheme" }] }, true, true],
    [
      "minion, else villain",
      { kind: "ifAble", preferred: { kind: "minion" }, otherwise: { kind: "villain" } },
      true,
      false,
    ],
    // Controls: never a minion or a side scheme by the text.
    ["villain", { kind: "villain" }, false, false],
    ["main scheme", { kind: "mainScheme" }, false, false],
    ["hero", { kind: "hero" }, false, false],
    ["your identity", { kind: "yourIdentity" }, false, false],
    ["ally", { kind: "ally" }, false, false],
    ["friendly character", { kind: "friendlyCharacter" }, false, false],
    ["named card", { kind: "namedCard", name: "Hand Ninja" }, false, false],
    [
      "superlative villain",
      { kind: "superlative", among: "villain", order: "lowest", measure: "printedHp" },
      false,
      false,
    ],
  ];
  it.each(cases)("%s", (_label, host, minion, sideScheme) => {
    expect(hostAllowsCategory(host, "minion")).toBe(minion);
    expect(hostAllowsCategory(host, "sideScheme")).toBe(sideScheme);
    expect(hostAllowsCategory(host, MINION_OR_SIDE_SCHEME)).toBe(minion || sideScheme);
  });

  it("the wave 8 ally reading is unchanged for its own hosts", () => {
    expect(hostAllowsCategory({ kind: "ally" }, "ally")).toBe(true);
    expect(hostAllowsCategory({ kind: "minion" }, "ally")).toBe(false);
    expect(hostAllowsCategory({ kind: "encounterCard" }, "ally")).toBe(false);
    // "Attach to a card." names no type (RRG 1.8 "Attach To", p. 8), so it allows an ally too.
    expect(hostAllowsCategory({ kind: "anyCard" }, "ally")).toBe(true);
    expect(hostAllowsCategory({ kind: "minion" }, ["ally", "minion"])).toBe(true);
  });
});

const QUERY: TargetQuery = { categories: ["upgrade"], canAttachToCategory: MINION_OR_SIDE_SCHEME };
/** Contingency Planning's choice, alone: "Choose 1 upgrade in your hand that can attach to a minion or side scheme." */
const CHOOSE = stubAbility("choose.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "chooseCards",
      slot: "chosen",
      from: { kind: "zone", zone: ["hand"], player: { kind: "controller" }, filter: QUERY },
      chooser: { kind: "controller" },
      min: 1,
      max: 1,
    } as never,
  ],
});
const CHOOSE_CARD = stubEvent({ id: "choose", cost: 0, abilities: [CHOOSE.ref] });
const deps = depsOf(CHOOSE);
const UPGRADES = [LEGAL_TROUBLE, CHANCE_ENCOUNTER, STEALTH_TRAINING, HEIGHTENED_HEARING];
const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };

function start(): GameState {
  // Heightened Hearing is loaded but in no player's deck or hand (it starts in the Sense deck in a real game).
  const inDeck = [LEGAL_TROUBLE, CHANCE_ENCOUNTER, STEALTH_TRAINING, CHOOSE_CARD];
  return gameAtFirstTurn({ cards: [...UPGRADES, CHOOSE_CARD], deps, deck: inDeck.map((card) => card.id) });
}

describe("§3.11 `TargetQuery.canAttachToCategory: ['minion', 'sideScheme']`", () => {
  it("Legal Trouble and Chance Encounter qualify with no minion or side scheme in play; Stealth Training does not", () => {
    let state = start();
    expect(selectTargets(state, { categories: ["minion", "sideScheme"] }, context)).toEqual([]);
    const ids: Record<string, string> = {};
    for (const card of [LEGAL_TROUBLE, CHANCE_ENCOUNTER, STEALTH_TRAINING]) {
      const given = giveCard(state, P1, card.id);
      state = given.state;
      ids[card.name] = given.id;
    }
    expect(explainQuery(state, ids["Legal Trouble"] as never, QUERY, context)).toBeNull();
    expect(explainQuery(state, ids["Chance Encounter"] as never, QUERY, context)).toBeNull();
    expect(explainQuery(state, ids["Stealth Training"] as never, QUERY, context)).toBe("cannotAttachTo");
    // One category at a time: each card matches only its own.
    expect(explainQuery(state, ids["Legal Trouble"] as never, { canAttachToCategory: "sideScheme" }, context)).toBe(
      "cannotAttachTo",
    );
    expect(explainQuery(state, ids["Chance Encounter"] as never, { canAttachToCategory: "minion" }, context)).toBe(
      "cannotAttachTo",
    );
  });

  it("the choice from hand offers exactly Legal Trouble and Chance Encounter; a Sense upgrade in no hand is not offered", () => {
    let state = start();
    for (const card of [LEGAL_TROUBLE, CHANCE_ENCOUNTER, STEALTH_TRAINING]) state = giveCard(state, P1, card.id).state;
    // Heightened Hearing's text allows a minion (an enemy), but it is not in the hand.
    expect(hostAllowsCategory(HEIGHTENED_HEARING.attachesTo!, MINION_OR_SIDE_SCHEME)).toBe(true);
    const play = giveCard(state, P1, CHOOSE_CARD.id);
    const result = runCommands(play.state, deps, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: play.id,
      payment: [],
      attachToInstanceId: null,
    });
    const asked = result.events.flatMap((e) =>
      e.type === "choiceRequested" && e.choice.prompt.kind === "chooseCards" ? [e.choice.options] : [],
    );
    expect(asked).toHaveLength(1);
    const offered = asked[0]!.map((o) => result.state.instances[o.optionId as never]!.cardId as string).sort();
    expect(offered).toEqual([CHANCE_ENCOUNTER.id, LEGAL_TROUBLE.id].sort());
  });
});
