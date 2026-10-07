/**
 * "You" in a constant ability, read through the one resolver (`speakerOf` / `constantYouOf`) by every constant reader:
 * docs/you-reader-audit.md, owner ruling 2026-10-06 (docs/phase7-wave7.md §4.1).
 *
 * - RRG 1.8 "Attachment" (p. 8): "When an attachment attached to a player card uses the word 'you' or 'your,' it
 *   refers to the attached player card's controller."
 * - RRG 1.8 "Obligation" (p. 30): "Abilities on obligations that use the words 'you' or 'your' apply only to the
 *   player whose play area the obligation is in."
 * - An engaged minion's constant speaks to its engaged player.
 * - A boost card's own text speaks to the player its activation resolves against, as its "Boost" ability does.
 *
 * Two players throughout, the card speaking to P2 only, so a wrong "you" shows on P1's ally. Synthetic cards.
 * `uncontrolled-you-constants.test.ts` covers the cost modifier, `cannotReady` and `entersPlayExhausted` readers.
 */

import { flat, trait, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { boostIconsFor, statBonus } from "./modifiers.js";
import { activeEncounterDeck, activeVillain, mustInstance, mustPlayer } from "./query.js";
import {
  canDivideBasicPower,
  canHaveAttached,
  cannotBeDefeated,
  cannotBeHealed,
  cannotHaveStatus,
  cannotLeavePlay,
  cannotTakeDamage,
  cannotTriggerAction,
  damageTakenAfterConstants,
  defeatDestinationRule,
  excludedFromAllyLimit,
  grantedAttackKeywords,
} from "./rules.js";
import { countsAsExtras, speakerOf, traitsOf } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubAlly,
  stubAttachment,
  stubMainScheme,
  stubMinion,
  stubObligation,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { TREACHERY, withEncounterPiles } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const MARKED = trait("Marked");
const YOUR_ALLIES: TargetQuery = { categories: ["ally"], controller: "you" };
type Constant = Omit<Extract<AbilityDefinition["trigger"], { kind: "constant" }>, "kind">;
const constant = (id: string, trigger: Constant) =>
  stubAbility(id, { trigger: { kind: "constant", ...trigger }, effects: [] });

const RULES: readonly RuleSpec[] = [
  { kind: "cannotBeHealed", target: YOUR_ALLIES },
  { kind: "cannotTakeDamage", target: YOUR_ALLIES },
  { kind: "excludedFromAllyLimit", target: YOUR_ALLIES },
  { kind: "cannotLeavePlay", target: YOUR_ALLIES },
  { kind: "cannotTriggerActions", on: YOUR_ALLIES },
  { kind: "divideBasicPower", power: "attack", target: YOUR_ALLIES },
  { kind: "defeatDestination", target: YOUR_ALLIES, to: "removedFromGame" },
  { kind: "cannotBeDefeated", target: YOUR_ALLIES },
  { kind: "cannotHaveStatus", target: YOUR_ALLIES, statuses: ["tough"] },
  { kind: "cannotHaveAttachments", target: YOUR_ALLIES },
  { kind: "attackKeywords", keywords: ["piercing"], attacker: YOUR_ALLIES },
  { kind: "countsAs", target: YOUR_ALLIES, categories: ["support"] },
];
/** "Reduce damage your allies take by 1", apart from `RULES` so `cannotTakeDamage` and it are read one at a time. */
const SOFTENS = constant("yours.softens", { rules: [{ kind: "reduceDamageTaken", target: YOUR_ALLIES, amount: 1 }] });
const SPEAKS = constant("yours.speaks", {
  rules: RULES,
  modifiers: [{ stat: "atk", amount: -1, target: YOUR_ALLIES }],
  keywordGrants: [{ keyword: { name: "guard" }, target: YOUR_ALLIES }],
  traitGrants: [{ trait: MARKED, target: YOUR_ALLIES }],
});
const refs = [SPEAKS.ref, SOFTENS.ref];

const SNARE = stubAttachment({ id: "snare", abilities: refs });
const DUTY = stubObligation({ id: "duty", abilities: refs });
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 3, abilities: refs });
const BYSTANDER = stubMinion({ id: "bystander", atk: 1, sch: 1, hp: 3 });
const FRIEND = stubAlly({ id: "friend", cost: 1, atk: 2, thw: 1, hp: 3 });
const deps: EngineDeps = depsOf(SPEAKS, SOFTENS);

interface Table {
  readonly state: GameState;
  /** The card that says "you". */
  readonly source: InstanceId;
  readonly ally: Readonly<Record<"p1" | "p2", InstanceId>>;
}

/** The card off the encounter deck, faceup and controlled by nobody, not yet anywhere on the table. */
function taken(state: GameState, card: CardId): { readonly state: GameState; readonly id: InstanceId } {
  const deck = activeEncounterDeck(state).deck;
  const id = deck.find((c) => state.instances[c]?.cardId === card)!;
  const without = withEncounterPiles(state, { deck: deck.filter((c) => c !== id) });
  return {
    id,
    state: {
      ...without,
      instances: { ...without.instances, [id]: { ...mustInstance(without, id), faceup: true, controllerId: null } },
    },
  };
}

function attached(state: GameState, id: InstanceId, host: InstanceId): GameState {
  return {
    ...state,
    instances: {
      ...state.instances,
      [id]: { ...mustInstance(state, id), attachedTo: host },
      [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, id] },
    },
  };
}

type Placement = (state: GameState, allies: Table["ally"]) => { readonly state: GameState; readonly id: InstanceId };

/** Two players, each with one ally in play; `place` puts the speaking card on the table. */
function table(place: Placement): Table {
  const base = gameAtFirstTurn({
    cards: [SNARE, DUTY, THUG, BYSTANDER, FRIEND],
    deps,
    players: 2,
    encounter: [SNARE.id, DUTY.id, THUG.id, BYSTANDER.id, ...copiesOf(TREACHERY.id, 30)],
    deck: [FRIEND.id],
  });
  const one = playerCardIntoPlay(base, FRIEND.id, P1);
  const two = playerCardIntoPlay(one.state, FRIEND.id, P2);
  const ally = { p1: one.id, p2: two.id };
  const placed = place(two.state, ally);
  return { state: placed.state, source: placed.id, ally };
}

const onIdentity: Placement = (state) => {
  const card = taken(state, SNARE.id);
  return { id: card.id, state: attached(card.state, card.id, mustPlayer(card.state, P2).identity.instanceId) };
};
const onAlly: Placement = (state, ally) => {
  const card = taken(state, SNARE.id);
  return { id: card.id, state: attached(card.state, card.id, ally.p2) };
};
const obligationInPlayArea: Placement = (state) => {
  const card = taken(state, DUTY.id);
  return {
    id: card.id,
    state: {
      ...card.state,
      players: card.state.players.map((p) => (p.playerId === P2 ? { ...p, playArea: [...p.playArea, card.id] } : p)),
    },
  };
};
const engagedMinion: Placement = (state) => minionEngagedWith(state, THUG.id, P2);
const onEngagedMinion: Placement = (state) => {
  const minion = minionEngagedWith(state, BYSTANDER.id, P2);
  const card = taken(minion.state, SNARE.id);
  return { id: card.id, state: attached(card.state, card.id, minion.id) };
};
const onVillain: Placement = (state) => {
  const card = taken(state, SNARE.id);
  return { id: card.id, state: attached(card.state, card.id, activeVillain(card.state).instanceId) };
};

/** Every reader, as one record per ally: what the speaking card's text does to it. */
function read(t: Table, seat: "p1" | "p2") {
  const id = t.ally[seat];
  return {
    cannotBeHealed: cannotBeHealed(t.state, deps, id),
    cannotTakeDamage: cannotTakeDamage(t.state, deps, id, [null]),
    excludedFromAllyLimit: excludedFromAllyLimit(t.state, deps, id),
    cannotLeavePlay: cannotLeavePlay(t.state, deps, id),
    cannotTriggerAction: cannotTriggerAction(t.state, deps, id, undefined),
    divideBasicPower: canDivideBasicPower(t.state, deps, id, "attack"),
    defeatDestination: defeatDestinationRule(t.state, deps, id),
    cannotBeDefeated: cannotBeDefeated(t.state, deps, id),
    cannotHaveTough: cannotHaveStatus(t.state, deps, id, "tough"),
    canHaveAttached: canHaveAttached(t.state, deps, id, null),
    attackKeywords: grantedAttackKeywords(t.state, deps, id, null),
    countsAs: countsAsExtras(t.state, deps).get(id)?.categories ?? [],
    damageOfThree: damageTakenAfterConstants(t.state, deps, id, 3, false),
    atkBonus: statBonus(t.state, deps, id, "atk"),
    guard: hasKeyword(t.state, id, "guard", deps),
    traits: traitsOf(t.state, id, deps),
  };
}

const SPOKEN_TO = {
  cannotBeHealed: true,
  cannotTakeDamage: true,
  excludedFromAllyLimit: true,
  cannotLeavePlay: true,
  cannotTriggerAction: true,
  divideBasicPower: true,
  defeatDestination: "removedFromGame",
  cannotBeDefeated: true,
  cannotHaveTough: true,
  canHaveAttached: false,
  attackKeywords: ["piercing"],
  countsAs: ["support"],
  damageOfThree: 2,
  atkBonus: -1,
  guard: true,
  traits: [MARKED],
};
const UNTOUCHED = {
  cannotBeHealed: false,
  cannotTakeDamage: false,
  excludedFromAllyLimit: false,
  cannotLeavePlay: false,
  cannotTriggerAction: false,
  divideBasicPower: false,
  defeatDestination: null,
  cannotBeDefeated: false,
  cannotHaveTough: false,
  canHaveAttached: true,
  attackKeywords: [],
  countsAs: [],
  damageOfThree: 3,
  atkBonus: 0,
  guard: false,
  traits: [],
};

describe.each([
  ["an attachment on a player's identity (RRG p. 8)", onIdentity],
  ["an encounter attachment on a player's ally (RRG p. 8)", onAlly],
  ["an obligation in a player's play area (RRG p. 30)", obligationInPlayArea],
  ["a minion engaged with a player", engagedMinion],
] as const)("'you' on %s is that player, for every constant reader", (_name, place) => {
  it("nobody controls the card, and it speaks to P2", () => {
    const t = table(place);
    expect(mustInstance(t.state, t.source).controllerId).toBeNull();
    expect(speakerOf(t.state, t.source)).toBe(P2);
  });

  it("P2's ally is reached by every rule, the stat modifier, the keyword grant and the trait grant", () => {
    expect(read(table(place), "p2")).toEqual(SPOKEN_TO);
  });

  it("P1's ally is reached by none of them", () => {
    expect(read(table(place), "p1")).toEqual(UNTOUCHED);
  });
});

describe.each([
  ["an attachment on a minion engaged with a player", onEngagedMinion],
  ["an attachment on the villain", onVillain],
] as const)("'you' on %s names no one from the card's state", (_name, place) => {
  it("neither player's ally is reached by any reader", () => {
    const t = table(place);
    expect(speakerOf(t.state, t.source)).toBeNull();
    expect(read(t, "p1")).toEqual(UNTOUCHED);
    expect(read(t, "p2")).toEqual(UNTOUCHED);
  });
});

describe("a boost card's own 'you' is the player its activation resolves against", () => {
  /** I See You's shape: "This card gets +1 boost icon if at least one minion is engaged with you." */
  const WATCHES = constant("watcher.constant", {
    modifiers: [
      {
        stat: "boostIcons",
        amount: 1,
        target: { self: true },
        while: { kind: "exists", query: { categories: ["minion"], engagedWith: "you" } },
      },
    ],
  });
  const WATCHER = stubTreachery({ id: "watcher", boostIcons: 1, abilities: [WATCHES.ref] });
  /** A minion that never activates: no ATK and no SCH. */
  const LURKER = stubMinion({ id: "lurker", atk: null, sch: null, hp: 3 });
  const BOSS = stubVillain({ id: "boss", stages: [{ hp: flat(40), atk: 1, sch: 1 }] });
  const CALM = stubMainScheme({
    id: "calm",
    stages: [{ startingThreat: flat(0), targetThreat: flat(50), acceleration: flat(0) }],
  });
  const watcherDeps = depsOf(WATCHES);
  const cards: readonly AnyCard[] = [WATCHER, LURKER];

  /** Two players; a minion engaged with P2 only; every card left in the encounter deck is the watcher. */
  function watched(): GameState {
    const base = gameAtFirstTurn({
      cards,
      deps: watcherDeps,
      players: 2,
      villain: BOSS,
      mainScheme: CALM,
      encounter: [LURKER.id, ...copiesOf(WATCHER.id, 30)],
    });
    return minionEngagedWith(base, LURKER.id, P2).state;
  }
  const aWatcher = (state: GameState): InstanceId => activeEncounterDeck(state).deck[0]!;

  it("read for P2, who has a minion engaged: 2 icons; for P1, who has none: 1; outside an activation: 1", () => {
    const state = watched();
    const id = aWatcher(state);
    expect(boostIconsFor(state, watcherDeps, id, P2)).toBe(2);
    expect(boostIconsFor(state, watcherDeps, id, P1)).toBe(1);
    expect(boostIconsFor(state, watcherDeps, id)).toBe(1);
  });

  it("the villain's attack on P1 counts 1 boost icon, its attack on P2 counts 2", () => {
    const state = watched();
    const identityOf = (player: PlayerId) => mustPlayer(state, player).identity.instanceId;
    const { events } = runCommands(
      state,
      watcherDeps,
      { type: "changeForm", playerId: P1 },
      { type: "endTurn", playerId: P1 },
      { type: "changeForm", playerId: P2 },
      { type: "endTurn", playerId: P2 },
    );
    const villain = activeVillain(state).instanceId;
    const attacks = events
      .filter((e): e is Extract<GameEvent, { type: "attackResolved" }> => e.type === "attackResolved")
      .filter((e) => e.enemyInstanceId === villain)
      .map((e) => [e.targetInstanceId, e.baseAtk, e.boostIcons]);
    expect(attacks).toEqual([
      [identityOf(P1), 1, 1],
      [identityOf(P2), 1, 2],
    ]);
  });
});
