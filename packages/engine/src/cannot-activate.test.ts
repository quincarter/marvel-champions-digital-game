/**
 * docs/phase7-wave6.md §3.34 and §4.1 Q19: `RuleSpec cannotActivate`, proven with synthetic cards shaped like Mental
 * Paralysis (`phoenix` 34008: "Attached minion cannot activate."), here a support whose rule names DAZED minions.
 *
 * RRG 1.8 "Activation" (p. 6): "Whenever an enemy attacks or schemes, it is considered to have activated", and "Some
 * card abilities can also cause enemies to attack or scheme. These are also considered activations." Q19 (user
 * default): every attack and scheme by the minion is stopped, those an effect initiates included, quickstrike and
 * teamwork too; its other abilities still work; it stays engaged. Engine reading: a stun or confuse on it is not spent,
 * since it never would attack or scheme.
 */

import { flat, trait, type AbilityReference, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_DECK, giveCard, newGame, withEncounterPiles } from "./testing/scenario.js";

const p1 = playerId("p1");
const DAZED_TRAIT = trait("DAZED");
const ACOLYTE = trait("ACOLYTE");
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const abilities: StubAbility[] = [];
const ability = (id: string, definition: AbilityDefinition): AbilityReference => {
  const stub = stubAbility(id, definition);
  abilities.push(stub);
  return stub.ref;
};
const mark: EffectSpec = {
  kind: "addCounters",
  target: { kind: "each", query: { categories: ["mainScheme"] } },
  counterType: "revealed",
  amount: { kind: "const", value: 1 },
};

const VILLAIN = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
/** The paralyzed minion: villainous (so a blocked activation would have dealt it a boost card); "The villain gets +1 ATK." */
const DAZED = stubMinion({
  id: "dazed",
  traits: [DAZED_TRAIT],
  atk: 2,
  sch: 2,
  hp: 5,
  boostIcons: 0,
  keywords: [{ name: "villainous" }],
  abilities: [
    ability("dazed.constant", {
      trigger: { kind: "constant", modifiers: [{ stat: "atk", amount: 1, target: { categories: ["villain"] } }] },
      effects: [],
    }),
  ],
});
/** Quickstrike, with a When Revealed that leaves a mark. */
const DAZED_QS = stubMinion({
  id: "dazed-qs",
  traits: [DAZED_TRAIT],
  atk: 2,
  sch: 2,
  hp: 5,
  boostIcons: 0,
  keywords: [{ name: "quickstrike" }],
  abilities: [ability("dazed-qs.when-revealed", { trigger: { kind: "whenRevealed" }, effects: [mark] })],
});
/** Teamwork (ACOLYTE). */
const DAZED_TW = stubMinion({
  id: "dazed-tw",
  traits: [DAZED_TRAIT, ACOLYTE],
  atk: 2,
  sch: 2,
  hp: 5,
  boostIcons: 0,
  keywords: [{ name: "teamwork", sharedTrait: ACOLYTE }],
});
const PARTNER = stubMinion({ id: "partner", traits: [ACOLYTE], atk: 0, sch: 0, hp: 5, boostIcons: 0 });
/** An unaffected minion: ATK 1, SCH 1. */
const CONTROL = stubMinion({ id: "control", atk: 1, sch: 1, hp: 5, boostIcons: 0 });
/** Mental Paralysis's rule, on a support so the test needs no attachment. */
const PARALYSIS = stubSupport({
  id: "paralysis",
  cost: 0,
  abilities: [
    ability("paralysis.constant", {
      trigger: {
        kind: "constant",
        rules: [{ kind: "cannotActivate", target: { categories: ["minion"], trait: DAZED_TRAIT } }],
      },
      effects: [],
    }),
  ],
});
/** "Each minion attacks you." / "Each minion schemes." */
const eachMinion = { kind: "each", query: { categories: ["minion"] } } as const;
const PROVOKE = stubEvent({
  id: "provoke",
  cost: 0,
  abilities: [
    ability("provoke.action", {
      trigger: { kind: "action" },
      effects: [{ kind: "enemyAttack", enemies: eachMinion, against: { kind: "controller" } }],
    }),
  ],
});
const PLOT = stubEvent({
  id: "plot",
  cost: 0,
  abilities: [
    ability("plot.action", {
      trigger: { kind: "action" },
      effects: [{ kind: "enemyScheme", enemies: eachMinion, against: { kind: "controller" } }],
    }),
  ],
});

const deps: EngineDeps = depsOf(...abilities);
const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const ENCOUNTER: readonly AnyCard[] = [BLANK, DAZED, DAZED_QS, DAZED_TW, PARTNER, CONTROL];

/** The encounter deck is `top` then blanks; `inPlay` is faceup in p1's play area engaged with p1 (test surgery). */
function game(top: readonly AnyCard[], inPlay: readonly AnyCard[] = []): GameState {
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    deps,
    extraCards: [...ENCOUNTER, PARALYSIS, PROVOKE, PLOT],
    encounterDeck: [...[...top, ...inPlay].map((card) => card.id), ...copies(BLANK.id, 15)],
    deck: [...DEFAULT_DECK, PARALYSIS.id, PROVOKE.id, PLOT.id],
  });
  let deck = [...activeEncounterDeck(start).deck];
  const take = (card: AnyCard): InstanceId => {
    const id = deck.find((i) => start.instances[i]?.cardId === card.id) as InstanceId;
    deck = deck.filter((i) => i !== id);
    return id;
  };
  const topIds = top.map(take);
  const inPlayIds = inPlay.map(take);
  const surgery = withEncounterPiles(start, { deck: [...topIds, ...deck] });
  return {
    ...surgery,
    players: surgery.players.map((p) => (p.playerId === p1 ? { ...p, playArea: [...p.playArea, ...inPlayIds] } : p)),
    instances: {
      ...surgery.instances,
      ...Object.fromEntries(
        inPlayIds.map((id) => [
          id,
          { ...mustInstance(surgery, id), faceup: true, engagedWith: p1, controllerId: null },
        ]),
      ),
    },
  };
}

const play = (state: GameState, card: AnyCard): Command => {
  const id = mustPlayer(state, p1).hand.find((i) => state.instances[i]?.cardId === card.id);
  if (!id) throw new Error(`${card.id} not in hand`);
  return { type: "playCard", playerId: p1, cardInstanceId: id, payment: [], attachToInstanceId: null };
};
/** Hands p1 every card in `cards` (test surgery). */
const withInHand = (state: GameState, ...cards: readonly AnyCard[]): GameState =>
  cards.reduce((s, card) => giveCard(s, p1, card.id).state, state);
/** The paralysis support played. */
const paralyzed = (state: GameState): GameState => {
  const given = withInHand(state, PARALYSIS);
  return runCommands(given, deps, play(given, PARALYSIS)).state;
};

const idOf = (state: GameState, card: AnyCard): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === card.id)?.instanceId as InstanceId;
const identityDamage = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, p1).identity.instanceId).damage;
const threat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const blocked = (events: readonly GameEvent[]) => events.filter((e) => e.type === "activationBlocked");
/**
 * Its activations that began. An activation event pushed before the rule is read (quickstrike's attack) is logged
 * "cancelled" as it is stopped, the engine's line for an event that did not occur; it never reaches "initiated".
 */
const activated = (events: readonly GameEvent[], id: InstanceId) =>
  events.filter(
    (e) =>
      (e.type === "enemyActivated" && e.enemyInstanceId === id) ||
      (e.type === "triggerEvent" &&
        e.phase !== "cancelled" &&
        (e.event.kind === "enemyAttack" || e.event.kind === "enemyScheme") &&
        e.event.enemyInstanceId === id),
  );
const boostsFor = (events: readonly GameEvent[], id: InstanceId) =>
  events.filter((e) => e.type === "boostCardDealt" && e.enemyInstanceId === id);
const expectReplays = (session: ReturnType<typeof runCommands>["session"]) => {
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
};

describe("§3.34 'cannot activate'", () => {
  it("villain phase, hero form: it does not attack, gets no boost card, keeps its stun; its constant still works", () => {
    const start = paralyzed(game([BLANK], [DAZED, CONTROL]));
    const dazed = idOf(start, DAZED);
    const stunned: GameState = {
      ...start,
      instances: {
        ...start.instances,
        [dazed]: { ...mustInstance(start, dazed), statuses: { stunned: 1, confused: 0, tough: 0 } },
      },
    };
    const { state, events, session } = runCommands(runCommands(stunned, deps, toHero).state, deps, endTurn);
    expect(blocked(events)).toEqual([
      { type: "activationBlocked", enemyInstanceId: dazed, activation: "attack", playerId: p1 },
    ]);
    expect(activated(events, dazed)).toEqual([]);
    expect(boostsFor(events, dazed)).toEqual([]);
    expect(mustInstance(state, dazed).statuses.stunned).toBe(1);
    // The villain (ATK 0 + 1 from the dazed minion's constant) and the control minion (ATK 1) attacked.
    expect(identityDamage(state)).toBe(2);
    expect(mustInstance(state, dazed).engagedWith).toBe(p1);
    expect(mustPlayer(state, p1).playArea).toContain(dazed);
    expectReplays(session);
  });

  it("villain phase, alter-ego form: it does not scheme, and a confuse on it is not spent", () => {
    const start = paralyzed(game([BLANK], [DAZED, CONTROL]));
    const dazed = idOf(start, DAZED);
    const confused: GameState = {
      ...start,
      instances: {
        ...start.instances,
        [dazed]: { ...mustInstance(start, dazed), statuses: { stunned: 0, confused: 1, tough: 0 } },
      },
    };
    const { state, events, session } = runCommands(confused, deps, endTurn);
    expect(blocked(events)).toEqual([
      { type: "activationBlocked", enemyInstanceId: dazed, activation: "scheme", playerId: p1 },
    ]);
    expect(threat(state)).toBe(1);
    expect(mustInstance(state, dazed).statuses.confused).toBe(1);
    expectReplays(session);
  });

  it("'each minion attacks you' / 'each minion schemes': it is skipped, the others activate", () => {
    const start = withInHand(paralyzed(game([BLANK], [DAZED, CONTROL])), PROVOKE, PLOT);
    const dazed = idOf(start, DAZED);
    const hero = runCommands(start, deps, toHero).state;
    const attacked = runCommands(hero, deps, play(hero, PROVOKE));
    expect(blocked(attacked.events)).toEqual([
      { type: "activationBlocked", enemyInstanceId: dazed, activation: "attack", playerId: p1 },
    ]);
    expect(activated(attacked.events, dazed)).toEqual([]);
    expect(identityDamage(attacked.state)).toBe(1);
    expectReplays(attacked.session);

    const schemed = runCommands(start, deps, play(start, PLOT));
    expect(blocked(schemed.events)).toEqual([
      { type: "activationBlocked", enemyInstanceId: dazed, activation: "scheme", playerId: p1 },
    ]);
    expect(threat(schemed.state)).toBe(1);
    expectReplays(schemed.session);
  });

  it("quickstrike: revealed while the rule is active, it engages and does not attack; its When Revealed resolves", () => {
    const start = runCommands(paralyzed(game([BLANK, DAZED_QS])), deps, toHero).state;
    const { state, events, session } = runCommands(start, deps, endTurn);
    const minion = idOf(state, DAZED_QS);
    expect(blocked(events)).toEqual([
      { type: "activationBlocked", enemyInstanceId: minion, activation: "attack", playerId: p1 },
    ]);
    expect(activated(events, minion)).toEqual([]);
    expect(identityDamage(state)).toBe(0);
    expect(mustInstance(state, minion).engagedWith).toBe(p1);
    expect(mustInstance(state, state.mainScheme.instanceId).counters.revealed).toBe(1);
    expectReplays(session);
  });

  it("teamwork: the keyword resolves but the minion does not activate", () => {
    const start = runCommands(paralyzed(game([BLANK, DAZED_TW], [PARTNER])), deps, toHero).state;
    const { state, events, session } = runCommands(start, deps, endTurn);
    const minion = idOf(state, DAZED_TW);
    expect(events.filter((e) => e.type === "keywordResolved")).toHaveLength(1);
    expect(blocked(events)).toEqual([
      { type: "activationBlocked", enemyInstanceId: minion, activation: "attack", playerId: p1 },
    ]);
    expect(activated(events, minion)).toEqual([]);
    expect(identityDamage(state)).toBe(0);
    expect(mustInstance(state, minion).engagedWith).toBe(p1);
    expectReplays(session);
  });

  it("the rule ending restores activation", () => {
    const start = paralyzed(game([BLANK], [DAZED]));
    const support = idOf(start, PARALYSIS);
    // The rule's card leaves play (test surgery: into its owner's discard pile).
    const ended: GameState = {
      ...start,
      players: start.players.map((p) =>
        p.playerId === p1
          ? { ...p, playArea: p.playArea.filter((id) => id !== support), discard: [...p.discard, support] }
          : p,
      ),
    };
    const dazed = idOf(ended, DAZED);
    const { state, events, session } = runCommands(runCommands(ended, deps, toHero).state, deps, endTurn);
    expect(blocked(events)).toEqual([]);
    expect(events).toContainEqual({
      type: "enemyActivated",
      enemyInstanceId: dazed,
      activation: "attack",
      playerId: p1,
    });
    expect(boostsFor(events, dazed)).toHaveLength(1);
    // Villain 0 + 1, the dazed minion 2 (blank boost cards).
    expect(identityDamage(state)).toBe(3);
    expectReplays(session);
  });
});
