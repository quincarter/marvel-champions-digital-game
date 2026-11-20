/**
 * `EffectSpec useActionAbility` (#890 item 6), the PR #903 review's cases. Out of turn: a forced response to the
 * end-of-player-phase ready step (`endPhaseCardsReadied`), with the player in hero form.
 *
 * - The payment is an ability's: a resource "for an upgrade ability" (`generatesForAbility`, #890 item 3, With Great
 *   Firepower's shape) pays an upgrade's Action when it is the only resource there is.
 * - The Action's own cost picks are the player's: with two allies to discard one is asked for, and a cost of "up to 2"
 *   takes what the player picks, not its minimum.
 * - Only printed Actions: one another card grants (`RuleSpec gainsAbility`) is not offered.
 * - "Action", "Hero Action" and "Alter-Ego Action" may all be picked, each only in its own form (the designer, PR #903).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubResource, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const counter = (type: string) =>
  ({ kind: "addCounters", target: { kind: "self" }, counterType: type, amount: { kind: "const", value: 1 } }) as const;

const ARMOR = stubAbility("armor.response", {
  trigger: { kind: "response", forced: true, on: { on: "endPhaseCardsReadied", playerIs: "controller" } },
  effects: [{ kind: "useActionAbility", player: { kind: "controller" } }],
} satisfies AbilityDefinition);
const ARMOR_CARD = stubSupport({ id: "armor", cost: 0, abilities: [ARMOR.ref] });

/** With Great Firepower's shape: "Resource: exhaust this → [wild] for an upgrade ability". */
const FIREPOWER_RESOURCE = stubAbility("firepower.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { wild: 1 },
  generatesFor: { categories: ["upgrade"] },
  generatesForAbility: true,
  effects: [],
} satisfies AbilityDefinition);
const FIREPOWER = stubSupport({ id: "firepower", cost: 0, abilities: [FIREPOWER_RESOURCE.ref] });
/** "Action: Spend 1 resource → place 1 counter here." */
const GUN_ACTION = stubAbility("gun.action", {
  trigger: { kind: "action" },
  cost: { resources: 1 },
  effects: [counter("shot")],
} satisfies AbilityDefinition);
const GUN = stubUpgrade({ id: "gun", cost: 0, abilities: [GUN_ACTION.ref] });

/** "Action: Discard an ally you control → place 1 counter here." */
const RECRUIT_ACTION = stubAbility("recruit.action", {
  trigger: { kind: "action" },
  cost: { discardCards: { slot: "discarded", query: { categories: ["ally"], controller: "you" }, min: 1, max: 1 } },
  effects: [counter("recruited")],
} satisfies AbilityDefinition);
const RECRUIT = stubSupport({ id: "recruit", cost: 0, abilities: [RECRUIT_ACTION.ref] });
/** "Action: Exhaust up to 2 allies you control → place 1 counter here." */
const VOLLEY_ACTION = stubAbility("volley.action", {
  trigger: { kind: "action" },
  cost: { exhaustCards: { slot: "exhausted", query: { categories: ["ally"], controller: "you" }, min: 1, max: 2 } },
  effects: [counter("volley")],
} satisfies AbilityDefinition);
const VOLLEY = stubSupport({ id: "volley", cost: 0, abilities: [VOLLEY_ACTION.ref] });
const ALLY = stubAlly({ id: "ally", cost: 0, atk: 1, thw: 1, hp: 3 });

/** "Alter-Ego Action: place 1 counter here." */
const NAP_ACTION = stubAbility("nap.action", {
  trigger: { kind: "action", form: "alterEgo" },
  effects: [counter("nap")],
} satisfies AbilityDefinition);
const NAP = stubSupport({ id: "nap", cost: 0, abilities: [NAP_ACTION.ref] });
/** "Hero Action: place 1 counter here." */
const PUNCH_ACTION = stubAbility("punch.action", {
  trigger: { kind: "action", form: "hero" },
  effects: [counter("punch")],
} satisfies AbilityDefinition);
const PUNCH = stubSupport({ id: "punch", cost: 0, abilities: [PUNCH_ACTION.ref] });
/** A support granting the plain gun Action to the punch support: gained, not printed there. */
const GIFT_CONSTANT = stubAbility("gift.constant", {
  trigger: { kind: "constant", rules: [{ kind: "gainsAbility", abilityId: GUN_ACTION.ref.id, to: { name: "punch" } }] },
  effects: [],
} satisfies AbilityDefinition);
const GIFT = stubSupport({ id: "gift", cost: 0, abilities: [GIFT_CONSTANT.ref] });

/** A support with two "Resource: exhaust this support → generate 1" abilities: either pays, both cannot. */
const TWIN_A = stubAbility("twin.resource-a", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { wild: 1 },
  effects: [],
} satisfies AbilityDefinition);
const TWIN_B = stubAbility("twin.resource-b", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { wild: 1 },
  effects: [],
} satisfies AbilityDefinition);
const TWIN = stubSupport({ id: "twin", cost: 0, abilities: [TWIN_A.ref, TWIN_B.ref] });
/** Power Man's shape (21012): "Action: Remove up to 2 chi counters from this card → …". */
const CHI_ACTION = stubAbility("chi.action", {
  trigger: { kind: "action" },
  cost: { spendCounters: { counterType: "chi", amount: 2, upTo: true, bind: "n" } },
  effects: [counter("focus")],
} satisfies AbilityDefinition);
const CHI = stubSupport({ id: "chi", cost: 0, abilities: [CHI_ACTION.ref] });

/** A support with one "Resource: exhaust this support → generate 1". */
const SOLO_RESOURCE = stubAbility("solo.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { wild: 1 },
  effects: [],
} satisfies AbilityDefinition);
const SOLO = stubSupport({ id: "solo", cost: 0, abilities: [SOLO_RESOURCE.ref] });
/** "Action: Spend 2 resources → place 1 counter here." */
const CANNON_ACTION = stubAbility("cannon.action", {
  trigger: { kind: "action" },
  cost: { resources: 2 },
  effects: [counter("blast")],
} satisfies AbilityDefinition);
const CANNON = stubUpgrade({ id: "cannon", cost: 0, abilities: [CANNON_ACTION.ref] });
/** Captain America's shape (03001a): "Action: Discard 1 card from your hand → …". */
const SHIELD_ACTION = stubAbility("shield.action", {
  trigger: { kind: "action" },
  cost: { discardFromHand: { min: 1 } },
  effects: [counter("ready")],
} satisfies AbilityDefinition);
const SHIELD = stubSupport({ id: "shield", cost: 0, abilities: [SHIELD_ACTION.ref] });
/** The Elephant's Trunk's shape (51007): "Exhaust this and up to 2 other supports you control → …". */
const TRUNK_ACTION = stubAbility("trunk.action", {
  trigger: { kind: "action" },
  cost: {
    exhaustCards: {
      slot: "exhausted",
      query: { categories: ["support"], controller: "you" },
      min: 1,
      max: 3,
      includesSelf: true,
    },
  },
  effects: [counter("trunk")],
} satisfies AbilityDefinition);
const TRUNK = stubSupport({ id: "trunk", cost: 0, abilities: [TRUNK_ACTION.ref] });

/** A resource card with "Interrupt: When you spend this card → generate 1 more" (Organizational Support's form). */
const BOOST_SPENT = stubAbility("boost.spent", {
  trigger: { kind: "resource", whenSpent: true },
  generates: { wild: 1 },
  effects: [],
} satisfies AbilityDefinition);
const BOOST = stubResource({ id: "boost", icons: 1, abilities: [BOOST_SPENT.ref] });
/** "Action: Spend 8 resources → place 1 counter here." */
const VOLCANO_ACTION = stubAbility("volcano.action", {
  trigger: { kind: "action" },
  cost: { resources: 8 },
  effects: [counter("erupt")],
} satisfies AbilityDefinition);
const VOLCANO = stubUpgrade({ id: "volcano", cost: 0, abilities: [VOLCANO_ACTION.ref] });
/** "Action: Remove 1 charge counter from this card **or** discard 1 card from your hand → …". */
const SWITCH_ACTION = stubAbility("switch.action", {
  trigger: { kind: "action" },
  cost: { either: [{ spendCounters: { counterType: "charge", amount: 1 } }, { discardFromHand: { min: 1, max: 1 } }] },
  effects: [counter("switched")],
} satisfies AbilityDefinition);
const SWITCH = stubSupport({ id: "switch", cost: 0, abilities: [SWITCH_ACTION.ref] });
/** "Action: Discard X cards from your hand → …" (`min` 0, no `max`). */
const PURGE_ACTION = stubAbility("purge.action", {
  trigger: { kind: "action" },
  cost: { discardFromHand: { min: 0, bind: "x" } },
  effects: [counter("purged")],
} satisfies AbilityDefinition);
const PURGE = stubSupport({ id: "purge", cost: 0, abilities: [PURGE_ACTION.ref] });
/** "Action: Discard 1 or more cards from your hand → …" (`min` 1, no `max`). */
const SHED_ACTION = stubAbility("shed.action", {
  trigger: { kind: "action" },
  cost: { discardFromHand: { min: 1, bind: "x" } },
  effects: [counter("shed")],
} satisfies AbilityDefinition);
const SHED = stubSupport({ id: "shed", cost: 0, abilities: [SHED_ACTION.ref] });

/** Energy Siphon's shape (58006): "When you spend this card, take up to 3 damage → 1 additional [energy] for each". */
const SIPHON_SPENT = stubAbility("siphon.spent", {
  trigger: { kind: "resource", whenSpent: true },
  cost: { damageSelf: { choose: { min: { kind: "const", value: 1 }, max: { kind: "const", value: 3 } } } },
  generates: { kind: "amount", resource: "energy", amount: { kind: "var", name: "cost.damageSelf" } },
  effects: [],
} satisfies AbilityDefinition);
const SIPHON = stubResource({ id: "siphon", icons: 1, produces: { energy: 1 }, abilities: [SIPHON_SPENT.ref] });
/** "Action: Spend 3 resources → place 1 counter here." */
const LANCE_ACTION = stubAbility("lance.action", {
  trigger: { kind: "action" },
  cost: { resources: 3 },
  effects: [counter("lanced")],
} satisfies AbilityDefinition);
const LANCE = stubUpgrade({ id: "lance", cost: 0, abilities: [LANCE_ACTION.ref] });
/** Advanced Glider's shape (27136): "Discard any number of events from your hand with a combined cost of 3 or more →". */
const GLIDER_ACTION = stubAbility("glider.action", {
  trigger: { kind: "action" },
  cost: {
    discardFromHand: { min: 1, filter: { categories: ["event"] }, combined: { measure: "printedCost", atLeast: 3 } },
  },
  effects: [counter("glided")],
} satisfies AbilityDefinition);
const GLIDER = stubSupport({ id: "glider", cost: 0, abilities: [GLIDER_ACTION.ref] });
const EVENT_1 = stubEvent({ id: "event-1", cost: 1 });
const EVENT_2 = stubEvent({ id: "event-2", cost: 2 });
const EVENT_3 = stubEvent({ id: "event-3", cost: 3 });

/** "Resource: Take 1 to 3 damage → generate 1 [energy] for each damage taken" (an in-play support). */
const DYNAMO_RESOURCE = stubAbility("dynamo.resource", {
  trigger: { kind: "resource" },
  cost: { damageSelf: { choose: { min: { kind: "const", value: 1 }, max: { kind: "const", value: 3 } } } },
  generates: { kind: "amount", resource: "energy", amount: { kind: "var", name: "cost.damageSelf" } },
  effects: [],
} satisfies AbilityDefinition);
const DYNAMO = stubSupport({ id: "dynamo", cost: 0, abilities: [DYNAMO_RESOURCE.ref] });
/** "Action: Spend 3 [energy] → place 1 counter here." */
const SPARK_ACTION = stubAbility("spark.action", {
  trigger: { kind: "action" },
  cost: { resources: { energy: 3 } },
  effects: [counter("sparked")],
} satisfies AbilityDefinition);
const SPARK = stubUpgrade({ id: "spark", cost: 0, abilities: [SPARK_ACTION.ref] });
/** "Action: Spend 9 resources → place 1 counter here." */
const NOVA_ACTION = stubAbility("nova.action", {
  trigger: { kind: "action" },
  cost: { resources: 9 },
  effects: [counter("nova")],
} satisfies AbilityDefinition);
const NOVA = stubUpgrade({ id: "nova", cost: 0, abilities: [NOVA_ACTION.ref] });
/** A support with seven "Resource: exhaust this → [physical]" abilities, each excluding the others. */
const SEVEN = Array.from({ length: 7 }, (_, i) =>
  stubAbility(`seven.resource-${i}`, {
    trigger: { kind: "resource" },
    cost: { exhaustSelf: true },
    generates: { physical: 1 },
    effects: [],
  } satisfies AbilityDefinition),
);
const SEVENFOLD = stubSupport({ id: "sevenfold", cost: 0, abilities: SEVEN.map((a) => a.ref) });
/** "Resource: exhaust this → [energy]". */
const CELL_RESOURCE = stubAbility("cell.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { energy: 1 },
  effects: [],
} satisfies AbilityDefinition);
const CELL = stubSupport({ id: "cell", cost: 0, abilities: [CELL_RESOURCE.ref] });
/** "Action: Spend 2 [energy] → place 1 counter here." */
const ARC_ACTION = stubAbility("arc.action", {
  trigger: { kind: "action" },
  cost: { resources: { energy: 2 } },
  effects: [counter("arc")],
} satisfies AbilityDefinition);
const ARC = stubUpgrade({ id: "arc", cost: 0, abilities: [ARC_ACTION.ref] });
/** "Action: Discard 1 card from your hand and spend 1 resource → place 1 counter here." */
const TRADE_ACTION = stubAbility("trade.action", {
  trigger: { kind: "action" },
  cost: { discardFromHand: { min: 1, max: 1 }, resources: 1 },
  effects: [counter("traded")],
} satisfies AbilityDefinition);
const TRADE = stubSupport({ id: "trade", cost: 0, abilities: [TRADE_ACTION.ref] });
/** "Resource: Exhaust 8 or more upgrades you control → generate 1" (the pick list `resourcePickChoices` builds). */
const RACK_RESOURCE = stubAbility("rack.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustCards: { slot: "racked", query: { categories: ["upgrade"], controller: "you" }, min: 8, max: 40 } },
  generates: { wild: 1 },
  effects: [],
} satisfies AbilityDefinition);
const RACK = stubSupport({ id: "rack", cost: 0, abilities: [RACK_RESOURCE.ref] });
const PLATE = stubUpgrade({ id: "plate", cost: 0 });

const CARDS = [
  ARMOR_CARD,
  FIREPOWER,
  GUN,
  RECRUIT,
  VOLLEY,
  ALLY,
  NAP,
  PUNCH,
  GIFT,
  TWIN,
  CHI,
  SOLO,
  CANNON,
  SHIELD,
  TRUNK,
  BOOST,
  VOLCANO,
  SWITCH,
  PURGE,
  SHED,
  SIPHON,
  LANCE,
  GLIDER,
  EVENT_1,
  EVENT_2,
  EVENT_3,
  DYNAMO,
  SPARK,
  NOVA,
  SEVENFOLD,
  CELL,
  ARC,
  TRADE,
  RACK,
  PLATE,
];
const deps: EngineDeps = depsOf(
  ARMOR,
  FIREPOWER_RESOURCE,
  GUN_ACTION,
  RECRUIT_ACTION,
  VOLLEY_ACTION,
  NAP_ACTION,
  PUNCH_ACTION,
  GIFT_CONSTANT,
  TWIN_A,
  TWIN_B,
  CHI_ACTION,
  SOLO_RESOURCE,
  CANNON_ACTION,
  SHIELD_ACTION,
  TRUNK_ACTION,
  BOOST_SPENT,
  VOLCANO_ACTION,
  SWITCH_ACTION,
  PURGE_ACTION,
  SHED_ACTION,
  SIPHON_SPENT,
  LANCE_ACTION,
  GLIDER_ACTION,
  DYNAMO_RESOURCE,
  SPARK_ACTION,
  NOVA_ACTION,
  ...SEVEN,
  CELL_RESOURCE,
  ARC_ACTION,
  TRADE_ACTION,
  RACK_RESOURCE,
);

/** P1 in hero form with Armor and `cards` in play, the hand and deck emptied when `noHand`. */
function start(
  cards: readonly string[],
  noHand = false,
  deck: readonly string[] = CARDS.flatMap((c) => [c.id, c.id, c.id]),
): { state: GameState; ids: Record<string, InstanceId[]> } {
  const base = gameAtFirstTurn({ cards: CARDS, deps, deck: deck as never });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const ids: Record<string, InstanceId[]> = {};
  for (const id of ["armor", ...cards]) {
    const put = playerCardIntoPlay(state, id as never, P1);
    state = put.state;
    (ids[id] ??= []).push(put.id);
  }
  if (noHand)
    state = { ...state, players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], deck: [] } : p)) };
  return { state, ids };
}

/** Plays the turn's end, picking the Action named `ability`, then answering with `answers` by prompt kind. */
function endTurnUsing(
  state: GameState,
  ability: string,
  answers: {
    cards?: (options: readonly string[]) => readonly string[];
    number?: (options: readonly string[]) => readonly string[];
    pay?: (options: readonly string[]) => readonly string[];
  } = {},
) {
  const offered: string[][] = [];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId);
    if (choice.prompt.kind === "chooseOption" && ids.some((id) => id.includes("|"))) {
      offered.push(ids);
      const wanted = ids.find((id) => id.endsWith(`|${ability}`));
      return wanted ? [wanted] : [];
    }
    if (choice.prompt.kind === "chooseCards" && answers.cards) return answers.cards(ids);
    if (choice.prompt.kind === "chooseNumber" && answers.number) return answers.number(ids);
    if (choice.prompt.kind === "spendResources") return answers.pay ? answers.pay(ids) : [ids[0]!];
    return defaultPick(s);
  };
  const driven = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], pick);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  return { state: driven.session.state, offered };
}

describe("useActionAbility: the PR #903 review's cases (#890 item 6)", () => {
  it("a resource for an upgrade ability is the only way to pay, and it pays the upgrade's Action", () => {
    const { state, ids } = start(["firepower", "gun"], true);
    expect(mustPlayer(state, P1).hand).toEqual([]);
    const after = endTurnUsing(state, GUN_ACTION.ref.id);
    expect(after.offered[0]?.some((id) => id.endsWith(`|${GUN_ACTION.ref.id}`))).toBe(true);
    expect(mustInstance(after.state, ids.gun![0]!).counters.shot).toBe(1);
  });

  it("with two allies to discard, the player is asked which, and that one goes", () => {
    const { state, ids } = start(["recruit", "ally", "ally"]);
    const [first, second] = ids.ally!;
    const after = endTurnUsing(state, RECRUIT_ACTION.ref.id, {
      cards: (options) => options.filter((o) => o === second),
    });
    expect(mustInstance(after.state, ids.recruit![0]!).counters.recruited).toBe(1);
    expect(mustPlayer(after.state, P1).discard).toContain(second);
    expect(mustPlayer(after.state, P1).playArea).toContain(first);
  });

  it("a cost of up to 2 takes what the player picks, not its minimum", () => {
    const { state, ids } = start(["volley", "ally", "ally"]);
    const after = endTurnUsing(state, VOLLEY_ACTION.ref.id, { cards: (options) => options.slice(0, 2) });
    expect(mustInstance(after.state, ids.volley![0]!).counters.volley).toBe(1);
    for (const ally of ids.ally!) expect(mustInstance(after.state, ally).exhausted).toBe(true);
  });

  it("a Hero Action is offered in hero form, an Alter-Ego Action is not, and a granted Action is not", () => {
    const { state } = start(["punch", "nap", "gift"]);
    const after = endTurnUsing(state, PUNCH_ACTION.ref.id);
    const offered = after.offered[0] ?? [];
    expect(offered.some((id) => id.endsWith(`|${PUNCH_ACTION.ref.id}`))).toBe(true);
    expect(offered.some((id) => id.endsWith(`|${NAP_ACTION.ref.id}`))).toBe(false);
    expect(offered.some((id) => id.endsWith(`|${GUN_ACTION.ref.id}`))).toBe(false);
  });

  it("an Alter-Ego Action is offered in alter-ego form", () => {
    const { state, ids } = start(["nap"]);
    const alterEgo: GameState = {
      ...state,
      players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const } })),
    };
    const after = endTurnUsing(alterEgo, NAP_ACTION.ref.id);
    expect(mustInstance(after.state, ids.nap![0]!).counters.nap).toBe(1);
  });

  it("two resources that cannot pay together still offer the Action, and one of them pays it", () => {
    const { state, ids } = start(["twin", "gun"], true);
    const after = endTurnUsing(state, GUN_ACTION.ref.id);
    expect(after.offered[0]?.some((id) => id.endsWith(`|${GUN_ACTION.ref.id}`))).toBe(true);
    expect(mustInstance(after.state, ids.gun![0]!).counters.shot).toBe(1);
    expect(mustInstance(after.state, ids.twin![0]!).exhausted).toBe(true);
  });

  it("an 'up to 2' counter cost asks how many: choosing 1 keeps the second counter", () => {
    const { state, ids } = start(["chi"]);
    const chi = ids.chi![0]!;
    const charged: GameState = {
      ...state,
      instances: { ...state.instances, [chi]: { ...mustInstance(state, chi), counters: { chi: 2 } } },
    };
    const after = endTurnUsing(charged, CHI_ACTION.ref.id, { number: (options) => options.filter((o) => o === "1") });
    expect(mustInstance(after.state, chi).counters.focus).toBe(1);
    expect(mustInstance(after.state, chi).counters.chi).toBe(1);
  });

  it("two resource abilities on one card and a third elsewhere: one of the two with the third pays 2", () => {
    const { state, ids } = start(["twin", "solo", "cannon"], true);
    const twin = ids.twin![0]!;
    const solo = ids.solo![0]!;
    const after = endTurnUsing(state, CANNON_ACTION.ref.id, {
      pay: (options) => [
        options.find((o) => o.startsWith(`ability:${twin}:${TWIN_A.ref.id}`))!,
        options.find((o) => o.startsWith(`ability:${solo}:`))!,
      ],
    });
    expect(after.offered[0]?.some((id) => id.endsWith(`|${CANNON_ACTION.ref.id}`))).toBe(true);
    expect(mustInstance(after.state, ids.cannon![0]!).counters.blast).toBe(1);
    expect(mustInstance(after.state, twin).exhausted).toBe(true);
    expect(mustInstance(after.state, solo).exhausted).toBe(true);
  });

  it("a hand discard in the cost (Captain America's Action) is offered and the chosen card is discarded", () => {
    const { state, ids } = start(["shield"]);
    const hand = mustPlayer(state, P1).hand;
    expect(hand.length).toBeGreaterThan(1);
    const chosen = hand[hand.length - 1]!;
    const after = endTurnUsing(state, SHIELD_ACTION.ref.id, {
      cards: (options) => options.filter((o) => o === chosen),
    });
    expect(after.offered[0]?.some((id) => id.endsWith(`|${SHIELD_ACTION.ref.id}`))).toBe(true);
    expect(mustInstance(after.state, ids.shield![0]!).counters.ready).toBe(1);
    expect(mustPlayer(after.state, P1).discard).toContain(chosen);
  });

  it("'this and up to 2 others' (The Elephant's Trunk): the card is kept in the pick, the player chooses the others", () => {
    const { state, ids } = start(["trunk", "solo"]);
    const trunk = ids.trunk![0]!;
    const solo = ids.solo![0]!;
    let asked: readonly string[] = [];
    const after = endTurnUsing(state, TRUNK_ACTION.ref.id, {
      cards: (options) => {
        asked = options;
        return [solo];
      },
    });
    expect(asked).not.toContain(trunk);
    expect(mustInstance(after.state, trunk).counters.trunk).toBe(1);
    expect(mustInstance(after.state, trunk).exhausted).toBe(true);
    expect(mustInstance(after.state, solo).exhausted).toBe(true);
  });

  it("a hand card that may be spent with its 'when spent' ability is spent once: the Action is offered and paid", () => {
    const begun = start(["gun"]);
    const given = giveCard(begun.state, P1, BOOST.id);
    const state: GameState = {
      ...given.state,
      players: given.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [given.id], deck: [] } : p)),
    };
    const after = endTurnUsing(state, GUN_ACTION.ref.id, {
      pay: (options) => [options.find((o) => o === `hand:${given.id}`)!],
    });
    expect(after.offered[0]?.some((id) => id.endsWith(`|${GUN_ACTION.ref.id}`))).toBe(true);
    expect(mustInstance(after.state, begun.ids.gun![0]!).counters.shot).toBe(1);
    // Spent (its deck empty, the discard pile is shuffled back in as the round ends): not in hand any more.
    expect(mustPlayer(after.state, P1).hand).not.toContain(given.id);
  });

  it("forty resource abilities and an Action costing 8: the probe stays bounded (not C(40,8) = 76,904,685 subsets), and the Action is used", () => {
    const forty = Array.from({ length: 40 }, () => "solo");
    const { state, ids } = start([...forty, "volcano"], true, [ARMOR_CARD.id, ...forty, VOLCANO.id]);
    const began = performance.now();
    const after = endTurnUsing(state, VOLCANO_ACTION.ref.id, {
      pay: (options) => options.filter((o) => o.startsWith("ability:")).slice(0, 8),
    });
    expect(performance.now() - began).toBeLessThan(3000);
    expect(mustInstance(after.state, ids.volcano![0]!).counters.erupt).toBe(1);
    expect(ids.solo!.filter((id) => mustInstance(after.state, id).exhausted)).toHaveLength(8);
  });

  it("an either/or whose only payable branch discards from hand is offered, and the chosen card goes", () => {
    const { state, ids } = start(["switch"]);
    let chosen = "";
    const after = endTurnUsing(state, SWITCH_ACTION.ref.id, {
      cards: (options) => {
        chosen = options[options.length - 1]!;
        return [chosen];
      },
    });
    expect(after.offered[0]?.some((id) => id.endsWith(`|${SWITCH_ACTION.ref.id}`))).toBe(true);
    expect(mustInstance(after.state, ids.switch![0]!).counters.switched).toBe(1);
    expect(mustPlayer(after.state, P1).discard).toContain(chosen as InstanceId);
  });

  it("'discard X cards' (no maximum) lets the player discard 2", () => {
    const { state, ids } = start(["purge"]);
    let chosen: readonly string[] = [];
    let offered = 0;
    const after = endTurnUsing(state, PURGE_ACTION.ref.id, {
      cards: (options) => {
        offered = options.length;
        chosen = options.slice(0, 2);
        return chosen;
      },
    });
    expect(chosen).toHaveLength(2);
    expect(offered).toBeGreaterThan(2);
    expect(mustInstance(after.state, ids.purge![0]!).counters.purged).toBe(1);
    for (const id of chosen) expect(mustPlayer(after.state, P1).discard).toContain(id as InstanceId);
  });

  it("'discard 1 or more' (no maximum) lets the player discard more than 1", () => {
    const { state, ids } = start(["shed"]);
    let chosen: readonly string[] = [];
    const after = endTurnUsing(state, SHED_ACTION.ref.id, {
      cards: (options) => {
        chosen = options.slice(0, 3);
        return chosen;
      },
    });
    expect(chosen).toHaveLength(3);
    expect(mustInstance(after.state, ids.shed![0]!).counters.shed).toBe(1);
    for (const id of chosen) expect(mustPlayer(after.state, P1).discard).toContain(id as InstanceId);
  });

  it("Energy Siphon taking 2 damage pays a 3-resource Action: the probe tries each amount it may take", () => {
    const begun = start(["lance"]);
    const given = giveCard(begun.state, P1, SIPHON.id);
    const state: GameState = {
      ...given.state,
      players: given.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [given.id], deck: [] } : p)),
    };
    const after = endTurnUsing(state, LANCE_ACTION.ref.id, {
      pay: (options) => [options.find((o) => o.startsWith(`hand:${given.id}:`) && o.endsWith("#damageSelf=2"))!],
    });
    expect(after.offered[0]?.some((id) => id.endsWith(`|${LANCE_ACTION.ref.id}`))).toBe(true);
    expect(mustInstance(after.state, begun.ids.lance![0]!).counters.lanced).toBe(1);
  });

  it("a combined-cost discard (Advanced Glider) asks which cards: the chosen 1 + 2 go, the 3 stays", () => {
    const begun = start(["glider"]);
    let state = begun.state;
    const events: InstanceId[] = [];
    for (const card of [EVENT_1, EVENT_2, EVENT_3]) {
      const given = giveCard(state, P1, card.id);
      state = given.state;
      events.push(given.id);
    }
    state = { ...state, players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand: events } : p)) };
    const [one, two, three] = events;
    const after = endTurnUsing(state, GLIDER_ACTION.ref.id, {
      cards: (options) => options.filter((o) => o === one || o === two),
    });
    expect(mustInstance(after.state, begun.ids.glider![0]!).counters.glided).toBe(1);
    expect(mustPlayer(after.state, P1).discard).toEqual(expect.arrayContaining([one, two]));
    expect(mustPlayer(after.state, P1).discard).not.toContain(three);
  });
  it("an in-play resource taking 3 damage pays a 3 [energy] Action: every amount it may take is judged", () => {
    const { state, ids } = start(["dynamo", "spark"], true);
    const after = endTurnUsing(state, SPARK_ACTION.ref.id, {
      pay: (options) => [
        options.find((o) => o.startsWith(`ability:${ids.dynamo![0]!}:`) && o.endsWith("#damageSelf=3"))!,
      ],
    });
    expect(after.offered[0]?.some((id) => id.endsWith(`|${SPARK_ACTION.ref.id}`))).toBe(true);
    expect(mustInstance(after.state, ids.spark![0]!).counters.sparked).toBe(1);
  });

  it("three Energy Siphons pay 9: two taking 3 damage and one spent plainly", () => {
    const begun = start(["nova"]);
    let state = begun.state;
    const siphons: InstanceId[] = [];
    for (let i = 0; i < 3; i++) {
      const given = giveCard(state, P1, SIPHON.id, siphons);
      state = given.state;
      siphons.push(given.id);
    }
    state = {
      ...state,
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand: siphons, deck: [] } : p)),
    };
    const after = endTurnUsing(state, NOVA_ACTION.ref.id, {
      pay: (options) => [
        options.find((o) => o.startsWith(`hand:${siphons[0]!}:`) && o.endsWith("#damageSelf=3"))!,
        options.find((o) => o.startsWith(`hand:${siphons[1]!}:`) && o.endsWith("#damageSelf=3"))!,
        `hand:${siphons[2]!}`,
      ],
    });
    expect(after.offered[0]?.some((id) => id.endsWith(`|${NOVA_ACTION.ref.id}`))).toBe(true);
    expect(mustInstance(after.state, begun.ids.nova![0]!).counters.nova).toBe(1);
  });

  it("seven excluding [physical] abilities on one card and two [energy] supports: the late pair pays 2 [energy]", () => {
    const { state, ids } = start(["sevenfold", "cell", "cell", "arc"], true);
    const cells = ids.cell!;
    const after = endTurnUsing(state, ARC_ACTION.ref.id, {
      pay: (options) => cells.map((cell) => options.find((o) => o.startsWith(`ability:${cell}:`))!),
    });
    expect(after.offered[0]?.some((id) => id.endsWith(`|${ARC_ACTION.ref.id}`))).toBe(true);
    expect(mustInstance(after.state, ids.arc![0]!).counters.arc).toBe(1);
    for (const cell of cells) expect(mustInstance(after.state, cell).exhausted).toBe(true);
  });

  it("a hand card the cost discards is not offered to pay, in any of its ways", () => {
    const begun = start(["trade", "solo"]);
    let state = begun.state;
    const boost = giveCard(state, P1, BOOST.id);
    state = boost.state;
    const other = mustPlayer(state, P1).hand.find((id) => id !== boost.id)!;
    state = {
      ...state,
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [boost.id, other] } : p)),
    };
    let payWith: readonly string[] = [];
    const after = endTurnUsing(state, TRADE_ACTION.ref.id, {
      cards: (options) => options.filter((o) => o === boost.id),
      pay: (options) => {
        payWith = options;
        return [options.find((o) => o.startsWith(`ability:${begun.ids.solo![0]!}:`))!];
      },
    });
    expect(payWith.some((o) => o.startsWith(`hand:${boost.id}`))).toBe(false);
    expect(mustInstance(after.state, begun.ids.trade![0]!).counters.traded).toBe(1);
  });

  it("a resource picking 8 of 40 upgrades lists its choices without building every subset", () => {
    const forty = Array.from({ length: 40 }, () => "plate");
    const { state, ids } = start(["rack", ...forty, "gun"], true, [ARMOR_CARD.id, RACK.id, ...forty, GUN.id]);
    const after = endTurnUsing(state, GUN_ACTION.ref.id, {
      pay: (options) => [options.find((o) => o.startsWith(`ability:${ids.rack![0]!}:`))!],
    });
    expect(mustInstance(after.state, ids.gun![0]!).counters.shot).toBe(1);
  });
});
