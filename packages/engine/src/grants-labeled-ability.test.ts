/**
 * `RuleSpec grantsLabeledAbility` (docs/phase7-wave9.md §3.3). Synthetic cards shaped like Night Vision Goggles and
 * Automated Defenses of Black Widow's set: "Each encounter card without a printed 'Preparation' ability gains
 * 'Preparation: …'".
 *
 * RRG 1.8 "'Gains'" (p. 21): "If a card gains a characteristic (such as a trait, keyword, or ability text), the card
 * functions as if it possesses the gained characteristic. Gained characteristics are not considered to be printed on
 * the card." RRG 1.8 "Encounter Card" (p. 17): "There are eight encounter card types: attachment cards, environment
 * cards, minion cards, main scheme cards, obligation cards, side scheme cards, treachery cards, and villain cards."
 */

import { abilityId, flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import { GRANTED_BY_SLOT, type EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, activeEncounterDeckId, locateCard, mustInstance, mustPlayer } from "./query.js";
import { grantedLabeledAbilities } from "./rules.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import {
  stubAlly,
  stubAttachment,
  stubEnvironment,
  stubMainScheme,
  stubSideScheme,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, TREACHERY } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, onTopOfEncounterDeck, P1 } from "./testing/wave3.js";

const mainScheme: TargetRef = { kind: "mainScheme" };
const grantingCard: TargetRef = { kind: "slot", slot: GRANTED_BY_SLOT };
const amount = (value: number) => ({ kind: "const", value }) as const;

// Goggles: "Attach to [villain]. Each encounter card without a printed 'Preparation' ability gains 'Preparation:
// [place 3 threat on the main scheme]. Then, discard Goggles.'" (The printed effect, all of a player attack's damage
// prevented, is §3.4's; the threat stands in for it so the order and the named card can be read.)
const GOGGLES_GRANTED = stubAbility("goggles.granted-preparation", {
  trigger: { kind: "preparation" },
  effects: [
    { kind: "placeThreat", target: mainScheme, amount: amount(3) },
    { kind: "discardFromPlay", target: grantingCard },
  ],
});
const GOGGLES_CONSTANT = stubAbility("goggles.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "grantsLabeledAbility",
        label: "preparation",
        to: "encounterCardsWithoutPrinted",
        abilityId: GOGGLES_GRANTED.ref.id,
      },
    ],
  },
  effects: [],
});
const GOGGLES = stubAttachment({
  id: "goggles",
  name: "Goggles",
  attachesTo: { kind: "villain" },
  abilities: [GOGGLES_CONSTANT.ref],
});

// Defenses: "Each encounter card without a printed 'Preparation' ability gains 'Preparation: Deal 1 damage to the
// attacking character.'"
const DEFENSES_GRANTED = stubAbility("defenses.granted-preparation", {
  trigger: { kind: "preparation" },
  effects: [{ kind: "dealDamage", target: { kind: "eventSource" }, amount: amount(1) }],
});
const DEFENSES_CONSTANT = stubAbility("defenses.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "grantsLabeledAbility",
        label: "preparation",
        to: "encounterCardsWithoutPrinted",
        abilityId: DEFENSES_GRANTED.ref.id,
      },
    ],
  },
  effects: [],
});
const DEFENSES = stubEnvironment({ id: "defenses", name: "Defenses", abilities: [DEFENSES_CONSTANT.ref] });

// A card that prints its own: "Preparation: Place 1 threat on the main scheme."
const OPS_PREPARATION = stubAbility("ops.preparation", {
  trigger: { kind: "preparation" },
  effects: [{ kind: "placeThreat", target: mainScheme, amount: amount(1) }],
});
const OPS = stubTreachery({ id: "ops", abilities: [OPS_PREPARATION.ref] });
// A side scheme of the granting cards' own set that prints no Preparation.
const SIDE = stubSideScheme({ id: "side", startingThreat: 0 });
// A player card type with no owner, discarded from the encounter deck.
const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 2 });

/**
 * "Forced Interrupt: When a character you control attacks [this villain], discard the top card of the encounter deck
 * and resolve each 'Preparation' ability on that card." Then, to read `<bind>.count` from outside: the main scheme
 * takes 10 threat for each one resolved.
 */
const PREPARE: readonly EffectSpec[] = [
  { kind: "discardEncounterCards", count: amount(1), bind: "top" },
  { kind: "resolveSpecials", of: { kind: "slot", slot: "top" }, trigger: "preparation", bind: "prep" },
  {
    kind: "placeThreat",
    target: mainScheme,
    amount: { kind: "product", values: [{ kind: "var", name: "prep.count" }, amount(10)] },
  },
];
const WIDOW_INTERRUPT = stubAbility("widow.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", selfIs: "target" } },
  effects: PREPARE,
});
const WIDOW = stubVillain({
  id: "widow",
  stages: [{ hp: flat(20), atk: 2, sch: 1, abilities: [WIDOW_INTERRUPT.ref] }],
});
const WEB = stubMainScheme({
  id: "web",
  stages: [{ startingThreat: flat(0), targetThreat: flat(90), acceleration: flat(1) }],
});

const deps: EngineDeps = depsOf(
  GOGGLES_GRANTED,
  GOGGLES_CONSTANT,
  DEFENSES_GRANTED,
  DEFENSES_CONSTANT,
  OPS_PREPARATION,
  WIDOW_INTERRUPT,
);

/** `id` moved from the villain area onto `host` as its attachment (surgery). */
function attach(state: GameState, id: InstanceId, host: InstanceId): GameState {
  return {
    ...state,
    villainArea: state.villainArea.filter((other) => other !== id),
    instances: {
      ...state.instances,
      [id]: { ...mustInstance(state, id), attachedTo: host },
      [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, id] },
    },
  };
}

type Top = typeof OPS | typeof SIDE | typeof RECRUIT | typeof GOGGLES | typeof TREACHERY;

/**
 * A game in the first player's turn, in hero form, with `top` on top of the encounter deck; with `granting`, Goggles
 * attached to the villain and Defenses in the villain area.
 */
function table(top: Top, granting = true) {
  let state = gameAtFirstTurn({
    cards: [GOGGLES, DEFENSES, OPS, SIDE, RECRUIT],
    deps,
    villain: WIDOW,
    mainScheme: WEB,
    encounter: [top.id, GOGGLES.id, DEFENSES.id, ...Array.from({ length: 12 }, () => TREACHERY.id)],
  });
  const villain = state.activeVillainId!;
  let goggles: InstanceId | null = null;
  let defenses: InstanceId | null = null;
  // The top card first, so a Goggles on top is not the copy taken for play.
  state = onTopOfEncounterDeck(state, top.id);
  const topId = activeEncounterDeck(state).deck[0]!;
  if (granting) {
    const deck = activeEncounterDeck(state).deck;
    // Surgery takes the first copy in the deck: hold the top card aside while the granting cards are taken.
    const deckId = activeEncounterDeckId(state);
    const held: GameState = {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...activeEncounterDeck(state), deck: deck.slice(1) } },
    };
    const placedGoggles = encounterCardInVillainArea(held, GOGGLES.id);
    goggles = placedGoggles.id;
    const placedDefenses = encounterCardInVillainArea(attach(placedGoggles.state, goggles, villain), DEFENSES.id);
    defenses = placedDefenses.id;
    const rest = activeEncounterDeck(placedDefenses.state);
    state = {
      ...placedDefenses.state,
      encounterDecks: { ...placedDefenses.state.encounterDecks, [deckId]: { ...rest, deck: [topId, ...rest.deck] } },
    };
  }
  state = runCommands(state, deps, { type: "changeForm", playerId: P1 }).state;
  return { state, top: topId, villain, goggles, defenses, main: state.mainScheme.instanceId };
}

const identityOf = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const attackVillain = (state: GameState): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(state),
  targetInstanceId: state.activeVillainId!,
});
const threatOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;
const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;
const resolved = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "abilityResolved" && e.abilityId.includes("preparation") ? [e] : []));
const resolvedIds = (events: readonly GameEvent[]): readonly string[] => resolved(events).map((e) => e.abilityId);

/** Attacks the villain; an `orderSpecials` choice is recorded and answered in `order` (as offered, or reversed). */
function attack(t: ReturnType<typeof table>, order: "asOffered" | "reversed" = "asOffered") {
  const offered: { optionId: string; label: string; instanceId: InstanceId | null }[][] = [];
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice!;
    if (choice.prompt.kind !== "orderSpecials") return defaultPick(state);
    expect(choice.playerId).toBe(P1);
    offered.push(
      choice.options.map((o) => ({
        optionId: o.optionId,
        label: o.label,
        instanceId: o.ref.kind === "ability" ? o.ref.instanceId : null,
      })),
    );
    const ids = choice.options.map((o) => o.optionId);
    return order === "reversed" ? ids.reverse() : ids;
  };
  return { ...runCommandsPicking(t.state, deps, pick, attackVillain(t.state)), offered };
}

describe("`grantedLabeledAbilities`: who gains a Preparation", () => {
  it("an encounter card that prints none gains one from each granting card in play, named by its granting card", () => {
    const t = table(TREACHERY);
    expect(grantedLabeledAbilities(t.state, deps, t.top, "preparation")).toEqual([
      { abilityId: abilityId("goggles.granted-preparation"), grantedBy: t.goggles },
      { abilityId: abilityId("defenses.granted-preparation"), grantedBy: t.defenses },
    ]);
  });

  it("a card that prints one gains none; a player card type gains none; the granting cards gain theirs too", () => {
    expect(grantedLabeledAbilities(table(OPS).state, deps, table(OPS).top, "preparation")).toEqual([]);
    expect(grantedLabeledAbilities(table(RECRUIT).state, deps, table(RECRUIT).top, "preparation")).toEqual([]);
    const t = table(SIDE);
    expect(grantedLabeledAbilities(t.state, deps, t.top, "preparation")).toHaveLength(2);
    // Its constant is not a printed Preparation, so the card in play gains what it and its neighbor give.
    expect(grantedLabeledAbilities(t.state, deps, t.goggles!, "preparation")).toHaveLength(2);
  });

  it("with neither rule in play nothing is gained", () => {
    const t = table(TREACHERY, false);
    expect(grantedLabeledAbilities(t.state, deps, t.top, "preparation")).toEqual([]);
  });
});

describe("`resolveSpecials` joins the granted Preparation abilities to the printed ones", () => {
  it("both granting cards in play, the top card prints none: both resolve, count 2, the granting card is discarded", () => {
    const t = table(TREACHERY);
    const { state, events, offered } = attack(t);

    // The attacking player orders them; each is offered under its granting card.
    expect(offered).toEqual([
      [
        {
          optionId: `${t.top}:goggles.granted-preparation@${t.goggles}`,
          label: "Goggles",
          instanceId: t.goggles,
        },
        {
          optionId: `${t.top}:defenses.granted-preparation@${t.defenses}`,
          label: "Defenses",
          instanceId: t.defenses,
        },
      ],
    ]);
    // Each is the discarded card's ability, resolved by the attacking player, and the log names its granting card.
    expect(resolved(events)).toEqual([
      {
        type: "abilityResolved",
        instanceId: t.top,
        abilityId: "goggles.granted-preparation",
        controllerId: P1,
        grantedByInstanceId: t.goggles,
      },
      {
        type: "abilityResolved",
        instanceId: t.top,
        abilityId: "defenses.granted-preparation",
        controllerId: P1,
        grantedByInstanceId: t.defenses,
      },
    ]);
    // 3 from the Goggles' Preparation, then 10 x `prep.count` (2).
    expect(threatOn(state, t.main)).toBe(3 + 20);
    // "The attacking character" is the attack in progress's: the hero takes 1.
    expect(damageOn(state, identityOf(state))).toBe(1);
    // "Discard Goggles" discards the granting card in play, not the card that gained the ability.
    expect(mustInstance(state, t.villain).attachments).toEqual([]);
    expect(mustInstance(state, t.goggles!).attachedTo).toBeNull();
    expect(locateCard(state, t.goggles!)?.kind).toBe("encounterDiscard");
    expect(locateCard(state, t.top)?.kind).toBe("encounterDiscard");
    // Defenses names no card to discard and stays; the attack then resolves: ATK 2 on the villain.
    expect(state.villainArea).toContain(t.defenses);
    expect(damageOn(state, t.villain)).toBe(2);
  });

  it("the attacking player's order is the order they resolve in", () => {
    const t = table(TREACHERY);
    const { state, events } = attack(t, "reversed");

    expect(resolvedIds(events)).toEqual(["defenses.granted-preparation", "goggles.granted-preparation"]);
    expect(threatOn(state, t.main)).toBe(3 + 20);
    expect(damageOn(state, identityOf(state))).toBe(1);
    expect(locateCard(state, t.goggles!)?.kind).toBe("encounterDiscard");
  });

  it("the top card prints its own Preparation: only its own resolves and the granting cards stay", () => {
    const t = table(OPS);
    const { state, events, offered } = attack(t);

    expect(offered).toEqual([]);
    expect(resolved(events)).toEqual([
      { type: "abilityResolved", instanceId: t.top, abilityId: "ops.preparation", controllerId: P1 },
    ]);
    // 1 from its own Preparation, then 10 x `prep.count` (1).
    expect(threatOn(state, t.main)).toBe(1 + 10);
    expect(damageOn(state, identityOf(state))).toBe(0);
    expect(mustInstance(state, t.villain).attachments).toEqual([t.goggles]);
    expect(state.villainArea).toContain(t.defenses);
  });

  it("neither rule in play and a card that prints none on top: 0 resolved", () => {
    const t = table(TREACHERY, false);
    const { state, events, offered } = attack(t);

    expect(offered).toEqual([]);
    expect(resolved(events)).toEqual([]);
    expect(threatOn(state, t.main)).toBe(0);
    expect(damageOn(state, identityOf(state))).toBe(0);
    expect(damageOn(state, t.villain)).toBe(2);
  });

  it("a side scheme of the granting cards' set that prints none gains both as the discarded card", () => {
    const t = table(SIDE);
    const { state, events } = attack(t);

    expect(resolvedIds(events)).toEqual(["goggles.granted-preparation", "defenses.granted-preparation"]);
    expect(threatOn(state, t.main)).toBe(3 + 20);
    expect(damageOn(state, identityOf(state))).toBe(1);
    expect(locateCard(state, t.goggles!)?.kind).toBe("encounterDiscard");
    // Discarded, not revealed: the side scheme did not enter play.
    expect(locateCard(state, t.top)?.kind).toBe("encounterDiscard");
  });

  it("a second copy of the granting card on top gains both, and the copy in play is the one discarded", () => {
    const t = table(GOGGLES);
    expect(t.top).not.toBe(t.goggles);
    const { state, events } = attack(t);

    expect(resolved(events).map((e) => [e.instanceId, e.abilityId, e.grantedByInstanceId])).toEqual([
      [t.top, "goggles.granted-preparation", t.goggles],
      [t.top, "defenses.granted-preparation", t.defenses],
    ]);
    expect(threatOn(state, t.main)).toBe(3 + 20);
    expect(mustInstance(state, t.villain).attachments).toEqual([]);
    expect(activeEncounterDeck(state).discard).toEqual(expect.arrayContaining([t.top, t.goggles]));
  });

  it("a player card type discarded from the encounter deck is not an encounter card: it gains nothing", () => {
    const t = table(RECRUIT);
    const { state, events, offered } = attack(t);

    expect(offered).toEqual([]);
    expect(resolved(events)).toEqual([]);
    expect(threatOn(state, t.main)).toBe(0);
    expect(damageOn(state, identityOf(state))).toBe(0);
    expect(mustInstance(state, t.villain).attachments).toEqual([t.goggles]);
  });

  it("a granting card that has left play grants nothing to the next discarded card", () => {
    const t = table(TREACHERY);
    const first = attack(t);
    // Goggles discarded itself; Defenses is still in play. The identity is exhausted: ready it for a second attack.
    const hero = identityOf(first.state);
    const again: GameState = {
      ...first.state,
      instances: { ...first.state.instances, [hero]: { ...mustInstance(first.state, hero), exhausted: false } },
    };
    const next = activeEncounterDeck(again).deck[0]!;
    expect(grantedLabeledAbilities(again, deps, next, "preparation")).toEqual([
      { abilityId: abilityId("defenses.granted-preparation"), grantedBy: t.defenses },
    ]);
    const second = runCommands(again, deps, attackVillain(again));
    expect(resolvedIds(second.events)).toEqual(["defenses.granted-preparation"]);
    // 23 before; then 10 x `prep.count` (1), and 1 more damage to the attacking hero.
    expect(threatOn(second.state, t.main)).toBe(23 + 10);
    expect(damageOn(second.state, hero)).toBe(2);
  });
});
