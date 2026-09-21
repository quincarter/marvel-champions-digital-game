/**
 * docs/phase7-wave1.md §3.8: scheme values, When Completed, signature side schemes and moving threat, proven with
 * synthetic cards.
 *
 * Sources: RRG 1.8 "Non-Numerical Variable" (p. 30), "When Completed Abilities" (p. 48), "Move" (p. 30), "'Cannot'"
 * (p. 11), "Defeat" (p. 15); The Wrecking Crew insert, "Signature Side Schemes".
 */

import { flat, trait, type AnyCard, type CardId, type MainSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, characterProfile, mainSchemeValue, mustInstance, mustPlayer } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, HERO } from "./testing/scenario.js";
import { auditVillainPhases } from "./villain/audit.js";

const p1 = playerId("p1");
const one = { kind: "const", value: 1 } as const;
const self = { kind: "self" } as const;
const mainScheme = { kind: "mainScheme" } as const;
const GOBLIN = trait("Goblin");
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};

// X acceleration: "X is equal to the number of Goblin enemies (including Green Goblin) in play."
const X_ACCELERATION = stubAbility("cloud.x", {
  trigger: {
    kind: "constant",
    modifiers: [
      {
        stat: "acceleration",
        amount: { kind: "count", query: { categories: ["enemy"], trait: GOBLIN } },
        target: { self: true },
        setBase: true,
      },
    ],
  },
  effects: [],
});
const cloudBase = stubMainScheme({
  id: "cloud",
  stages: [{ startingThreat: flat(0), targetThreat: flat(50), acceleration: flat(0), abilities: [X_ACCELERATION.ref] }],
});
const CLOUD: MainSchemeCard = { ...cloudBase, stages: [{ ...cloudBase.stages[0], printedX: ["acceleration"] }] };
const GOBLIN_VILLAIN = stubVillain({
  id: "goblin-villain",
  stages: [{ hp: flat(30), atk: 0, sch: 0, traits: [GOBLIN] }],
});
const GOBLIN_MINION = stubMinion({ id: "goblin-minion", traits: [GOBLIN], atk: 0, sch: 0, hp: 3, boostIcons: 0 });

// Target threat: "Increase the target threat value of attached scheme by 4."
const TARGET_UP = stubAbility("surveillance.constant", {
  trigger: {
    kind: "constant",
    modifiers: [{ stat: "targetThreat", amount: 4, target: { categories: ["mainScheme"] } }],
  },
  effects: [],
});
const SURVEILLANCE = stubSupport({ id: "surveillance", cost: 0, abilities: [TARGET_UP.ref] });
const PLACE_TWO = actionEvent("place-two", [
  { kind: "placeThreat", target: mainScheme, amount: { kind: "const", value: 2 } },
]);
const SHORT = stubMainScheme({
  id: "short",
  stages: [{ startingThreat: flat(0), targetThreat: flat(5), acceleration: flat(0) }],
});
const PLAIN_VILLAIN = stubVillain({ id: "plain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

// When Completed on a non-final stage, and on the final one.
const WHEN_COMPLETED = stubAbility("takeover.when-completed", {
  trigger: { kind: "whenCompleted" },
  effects: [
    { kind: "addCounters", target: { kind: "villain" }, counterType: "completed", amount: one },
    // More threat while completing must not complete the stage a second time.
    { kind: "placeThreat", target: mainScheme, amount: { kind: "const", value: 5 } },
  ],
});
const TAKEOVER = stubMainScheme({
  id: "takeover",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(5), acceleration: flat(0), abilities: [WHEN_COMPLETED.ref] },
    { startingThreat: flat(3), targetThreat: flat(20), acceleration: flat(0), abilities: [WHEN_COMPLETED.ref] },
  ],
});

// "Remove all but 3 threat from the main scheme."
const ALL_BUT_THREE = actionEvent("all-but-three", [
  {
    kind: "removeThreat",
    target: mainScheme,
    amount: { kind: "scaled", value: { kind: "threat", of: mainScheme }, plus: -3 },
  },
]);

// Moving threat.
const PLACED_HERE = stubAbility("watched.placed-here", {
  trigger: { kind: "response", forced: true, on: { on: "placeThreat", selfIs: "target" } },
  effects: [{ kind: "addCounters", target: self, counterType: "placedHere", amount: one }],
});
const LOW = stubSideScheme({ id: "low", startingThreat: 1, boostIcons: 0 });
const WATCHED = stubSideScheme({ id: "watched", startingThreat: 3, boostIcons: 0, abilities: [PLACED_HERE.ref] });
const PLAIN = stubSideScheme({ id: "plain-scheme", startingThreat: 3, boostIcons: 0 });
const moveAll = (id: string, to: string) =>
  actionEvent(id, [
    { kind: "moveThreat", from: { kind: "named", name: LOW.name }, to: { kind: "named", name: to }, bind: "moved" },
    {
      kind: "if",
      condition: { kind: "varAtLeast", name: "moved.forcedResponses", amount: 1 },
      then: [
        {
          kind: "addCounters",
          target: { kind: "identityOf", player: { kind: "controller" } },
          counterType: "triggered",
          amount: one,
        },
      ],
      otherwise: [
        {
          kind: "addCounters",
          target: { kind: "identityOf", player: { kind: "controller" } },
          counterType: "notTriggered",
          amount: one,
        },
      ],
    },
  ]);
const MOVE_TO_WATCHED = moveAll("move-to-watched", WATCHED.name);
const MOVE_TO_PLAIN = moveAll("move-to-plain", PLAIN.name);

const EVENTS = [PLACE_TWO, ALL_BUT_THREE, MOVE_TO_WATCHED, MOVE_TO_PLAIN];
const ABILITIES: readonly StubAbility[] = [
  X_ACCELERATION,
  TARGET_UP,
  WHEN_COMPLETED,
  PLACED_HERE,
  ...EVENTS.map((e) => e.ability),
];
const deps: EngineDeps = depsOf(...ABILITIES);

function game(
  options: {
    readonly villain?: AnyCard;
    readonly scheme?: MainSchemeCard;
    readonly encounter?: readonly CardId[];
  } = {},
): GameState {
  const villain = options.villain ?? PLAIN_VILLAIN;
  const scheme = options.scheme ?? SHORT;
  const result = createGame(
    {
      seed: 3,
      cards: [
        ...DEFAULT_CARDS,
        GOBLIN_VILLAIN,
        PLAIN_VILLAIN,
        CLOUD,
        SHORT,
        TAKEOVER,
        GOBLIN_MINION,
        SURVEILLANCE,
        BLANK,
        LOW,
        WATCHED,
        PLAIN,
        ...EVENTS.map((e) => e.card),
      ],
      villainCardId: villain.id,
      mainSchemeCardId: scheme.id,
      encounterDeck: options.encounter ?? copies(BLANK.id, 12),
      players: [
        {
          identityCardId: HERO.id,
          deck: [...DEFAULT_DECK, SURVEILLANCE.id, ...EVENTS.flatMap((e) => copies(e.card.id, 2))],
        },
      ],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

function play(state: GameState, card: AnyCard) {
  const given = giveCard(state, p1, card.id);
  return runCommands(given.state, deps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

const withThreat = (state: GameState, id: InstanceId, threat: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), threat } },
});

/** Test surgery: the first copy of `card` in the encounter deck moves into play (engaged with p1, or in the villain area). */
function intoPlay(state: GameState, card: AnyCard, threat = 0): { readonly state: GameState; readonly id: InstanceId } {
  const deck = activeEncounterDeck(state).deck;
  const id = deck.find((candidate) => state.instances[candidate]?.cardId === card.id);
  if (!id) throw new Error(`no ${card.id} in the encounter deck`);
  const [deckId] = state.encounterDeckOrder;
  const piles = state.encounterDecks[deckId ?? ""];
  if (!deckId || !piles) throw new Error("no encounter deck");
  const minion = card.type === "minion";
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
      villainArea: minion ? state.villainArea : [...state.villainArea, id],
      players: state.players.map((p) => (minion && p.playerId === p1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: { ...mustInstance(state, id), faceup: true, threat, engagedWith: minion ? p1 : null },
      },
    },
  };
}

const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const endTurn: Command = { type: "endTurn", playerId: p1 };

describe("§3.8 scheme values, When Completed, signature side schemes, moving threat", () => {
  it("an X acceleration follows the Goblin enemies in play, and step one places it", () => {
    const start = game({
      villain: GOBLIN_VILLAIN,
      scheme: CLOUD,
      encounter: [...copies(GOBLIN_MINION.id, 2), ...copies(BLANK.id, 10)],
    });
    expect(mainSchemeValue(start, "acceleration", deps)).toBe(1);
    const withMinion = intoPlay(start, GOBLIN_MINION);
    expect(mainSchemeValue(withMinion.state, "acceleration", deps)).toBe(2);

    const { state, session } = runCommands(withMinion.state, deps, endTurn);
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(2);
    expect(auditVillainPhases(session.log, deps).violations).toEqual([]);

    const gone: GameState = {
      ...state,
      players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== withMinion.id) })),
    };
    expect(mainSchemeValue(gone, "acceleration", deps)).toBe(1);
  });

  it("+4 target threat delays completion", () => {
    const start = game();
    const scheme = start.mainScheme.instanceId;
    const nearlyDone = withThreat(start, scheme, 4);

    const watched = play(nearlyDone, SURVEILLANCE).state;
    expect(mainSchemeValue(watched, "targetThreat", deps)).toBe(9);
    const delayed = play(watched, PLACE_TWO.card).state;
    expect(delayed.outcome).toBeNull();
    expect(mustInstance(delayed, scheme).threat).toBe(6);

    const lost = play(nearlyDone, PLACE_TWO.card).state;
    expect(lost.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
  });

  it("a non-final stage's When Completed resolves once, then the scheme advances; a final stage's completion just loses", () => {
    const start = game({ scheme: TAKEOVER });
    const scheme = start.mainScheme.instanceId;
    const { state, events } = play(withThreat(start, scheme, 4), PLACE_TWO.card);
    const villain = state.villains[0]?.instanceId as InstanceId;

    expect(mustInstance(state, villain).counters.completed).toBe(1);
    expect(ofType(events, "mainSchemeCompleted")).toHaveLength(1);
    expect(state.mainScheme.stageIndex).toBe(1);
    // Excess threat does not carry over; the new stage's starting threat is placed.
    expect(mustInstance(state, scheme).threat).toBe(3);
    const completedAt = events.findIndex((e) => e.type === "counterAdded" && e.counterType === "completed");
    const advancedAt = events.findIndex((e) => e.type === "mainSchemeAdvanced");
    expect(completedAt).toBeGreaterThanOrEqual(0);
    expect(completedAt).toBeLessThan(advancedAt);

    const final = play(withThreat(state, scheme, 19), PLACE_TWO.card).state;
    expect(final.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
    expect(mustInstance(final, villain).counters.completed).toBe(1);
  });

  it("'remove all but 3 threat' leaves exactly 3, and removes nothing from a scheme with 3 or less", () => {
    const start = game();
    const scheme = start.mainScheme.instanceId;
    expect(mustInstance(play(withThreat(start, scheme, 7), ALL_BUT_THREE.card).state, scheme).threat).toBe(3);
    expect(mustInstance(play(withThreat(start, scheme, 2), ALL_BUT_THREE.card).state, scheme).threat).toBe(2);
  });

  it.each([
    { event: MOVE_TO_WATCHED, destination: WATCHED, counter: "triggered", placedHere: 1 },
    { event: MOVE_TO_PLAIN, destination: PLAIN, counter: "notTriggered", placedHere: undefined },
  ])(
    "moved threat is removed from its source and placed on $destination.id (RRG 1.8 'Move', p. 30)",
    ({ event, destination, counter, placedHere }) => {
      const start = game({ encounter: [LOW.id, WATCHED.id, PLAIN.id, ...copies(BLANK.id, 9)] });
      const low = intoPlay(start, LOW, 1);
      const target = intoPlay(low.state, destination, 3);
      const { state, events } = play(target.state, event.card);
      expect(mustInstance(state, target.id).threat).toBe(4);
      expect(mustInstance(state, target.id).counters.placedHere).toBe(placedHere);
      // The source reached 0 threat by removal, so it is defeated.
      expect(ofType(events, "schemeDefeated").map((e) => e.instanceId)).toEqual([low.id]);
      expect(state.villainArea).not.toContain(low.id);
      expect(mustInstance(state, mustPlayer(state, p1).identity.instanceId).counters[counter]).toBe(1);
    },
  );
});

// --- Signature side schemes (two villains, so defeating one does not win) --------------------------------------

const PUT_SCHEMES = stubAbility("crew.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "signature", cards: { kind: "encounterSetAside" } },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "signature" }, controller: { kind: "firstPlayer" } },
  ],
});
const SIGNATURE_RULE = stubAbility("crew.signature-rule", {
  trigger: { kind: "constant", rules: [{ kind: "notDefeatedWithoutThreat", target: { signatureSideScheme: true } }] },
  effects: [],
});
const CREW_SCHEME = stubMainScheme({
  id: "crew-scheme",
  stages: [
    {
      startingThreat: flat(0),
      targetThreat: flat(99),
      acceleration: flat(0),
      aSideAbilities: [PUT_SCHEMES.ref],
      abilities: [SIGNATURE_RULE.ref],
    },
  ],
});
/** "This card cannot leave play while [its villain] is in play." */
const STAYS = stubAbility("signature.stays", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "cannotLeavePlay",
        target: { self: true },
        while: { kind: "refMatches", ref: { kind: "villainOfSideScheme", scheme: self }, query: {} },
      },
    ],
  },
  effects: [],
});
const SIGNATURE_DEFEATED = stubAbility("signature.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "each", query: { categories: ["villain"] } },
      counterType: "signatureDefeated",
      amount: one,
    },
  ],
});
const SIGNATURE = stubSideScheme({
  id: "signature",
  startingThreat: 1,
  boostIcons: 0,
  abilities: [STAYS.ref, SIGNATURE_DEFEATED.ref],
});
const FIRST = stubVillain({ id: "first", stages: [{ hp: flat(10), atk: 0, sch: 0 }] });
const SECOND = stubVillain({ id: "second", stages: [{ hp: flat(10), atk: 0, sch: 0 }] });
const CLEAR_SIDE = actionEvent("clear-side", [
  {
    kind: "removeThreat",
    target: { kind: "each", query: { categories: ["sideScheme"] } },
    amount: { kind: "const", value: 10 },
  },
]);
const DISCARD_SIDE = actionEvent("discard-side", [
  { kind: "discardFromPlay", target: { kind: "each", query: { categories: ["sideScheme"] } } },
]);
const crewDeps: EngineDeps = depsOf(
  PUT_SCHEMES,
  SIGNATURE_RULE,
  STAYS,
  SIGNATURE_DEFEATED,
  CLEAR_SIDE.ability,
  DISCARD_SIDE.ability,
);

function crew(): GameState {
  const result = createGame(
    {
      seed: 9,
      cards: [...DEFAULT_CARDS, FIRST, SECOND, CREW_SCHEME, SIGNATURE, BLANK, CLEAR_SIDE.card, DISCARD_SIDE.card],
      villainCardId: FIRST.id,
      villains: [
        { villainCardId: FIRST.id, encounterDeck: copies(BLANK.id, 8), signatureSideSchemeCardId: SIGNATURE.id },
        { villainCardId: SECOND.id, encounterDeck: copies(BLANK.id, 8) },
      ],
      mainSchemeCardId: CREW_SCHEME.id,
      encounterDeck: [],
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, CLEAR_SIDE.card.id, DISCARD_SIDE.card.id] }],
    },
    crewDeps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, crewDeps).state;
}

function crewPlay(state: GameState, card: AnyCard) {
  const given = giveCard(state, p1, card.id);
  return runCommands(given.state, crewDeps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

describe("§3.8 signature side schemes", () => {
  it("stays in play at 0 threat and cannot leave play while its villain is in play; leaves, not defeated, when that villain is", () => {
    const start = crew();
    const [first, second] = start.villains as [(typeof start.villains)[number], (typeof start.villains)[number]];
    const scheme = first.signatureSideSchemeId as InstanceId;
    expect(start.villainArea).toContain(scheme);

    const cleared = crewPlay(start, CLEAR_SIDE.card);
    expect(mustInstance(cleared.state, scheme).threat).toBe(0);
    expect(cleared.state.villainArea).toContain(scheme);
    expect(ofType(cleared.events, "schemeDefeated")).toEqual([]);

    const kept = crewPlay(cleared.state, DISCARD_SIDE.card);
    expect(kept.state.villainArea).toContain(scheme);
    expect(ofType(kept.events, "leavePlayBlocked")).toEqual([
      { type: "leavePlayBlocked", instanceId: scheme, reason: "cannotLeavePlay" },
    ]);

    // Defeat the first villain with a basic attack from 2 hit points left.
    const hero = runCommands(kept.state, crewDeps, { type: "changeForm", playerId: p1 }).state;
    const identity = mustPlayer(hero, p1).identity.instanceId;
    const maxHp = characterProfile(hero, first.instanceId, crewDeps)?.maxHp ?? 0;
    const primed: GameState = {
      ...hero,
      instances: {
        ...hero.instances,
        [first.instanceId]: { ...mustInstance(hero, first.instanceId), damage: maxHp - 2 },
      },
    };
    const result = applyCommand(
      primed,
      { type: "basicAttack", playerId: p1, attackerInstanceId: identity, targetInstanceId: first.instanceId },
      crewDeps,
    );
    if (!result.ok) throw new Error(result.error.message);
    const after = runCommands(result.state, crewDeps).state;
    expect(after.outcome).toBeNull();
    expect(after.removedFromGame).toContain(scheme);
    expect(mustInstance(after, second.instanceId).counters.signatureDefeated).toBeUndefined();
  });
});
