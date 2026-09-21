/**
 * docs/phase7-wave1.md §3.3 (villain stage cards with two faces) and §3.4 (double-sided encounter cards that flip, and
 * condition-triggered forced abilities), proven with synthetic cards shaped like Risky Business: a Norman / Goblin
 * villain whose "—" stats differ per face, and an Enterprise / Madness environment that flips it.
 *
 * Sources: Green Goblin insert, Risky Business "New Rules"; RRG 1.8 "Flip" (p. 20), "Dash (Value)" (p. 15), "Double-Sided
 * Card" (p. 17), "Uses (X 'Type')" (p. 46), "Villain Defeat" (p. 47); FAQ "Norman Osborn (#1A)" (p. 58), "Green Goblin
 * (#1B)" and "I See You (#30)" (p. 59); rulings Jan 26, 2026 (4) answer 2, Apr 30, 2026 (3) answer 3, Jun 25, 2026 (4)
 * answer 3 ("Environments flip, they are not revealed").
 */

import { cardId, flat, trait, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { keywordsOf } from "./keywords.js";
import { activeVillain, characterProfile, currentName, mustInstance, mustPlayer } from "./query.js";
import { evaluate, resolveRef } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { CardInstance, GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import {
  stubAttachment,
  stubEnvironment,
  stubEvent,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCard, HERO, MAIN_SCHEME } from "./testing/scenario.js";

const p1 = playerId("p1");
const one = { kind: "const", value: 1 } as const;
const two = { kind: "const", value: 2 } as const;
const self: TargetRef = { kind: "self" };
const theVillain: TargetRef = { kind: "villain" };
const theEnvironment: TargetRef = { kind: "each", query: { categories: ["environment"] } };
const noCounters = (counterType: string) =>
  ({ kind: "not", of: { kind: "counterAtLeast", of: self, counterType, amount: 1 } }) as const;

// --- The villain: Norman (side A, "—" ATK) and Goblin (side B, "—" SCH) ------------------------------------------

/** "Forced Interrupt: When Norman would attack, place 1 infamy counter on Enterprise instead." */
const NORMAN_WOULD_ATTACK = stubAbility("norman.would-attack", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [
        { kind: "addCounters", target: { kind: "named", name: "Enterprise" }, counterType: "infamy", amount: one },
      ],
    },
  ],
});
/** Goblin I's When Revealed, observable as a counter. */
const GOBLIN_REVEALED = stubAbility("goblin.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "addCounters", target: self, counterType: "goblinRevealed", amount: one }],
});
const GOBLIN = stubVillain({
  id: "goblin-card",
  name: "Norman",
  stages: [
    { hp: flat(10), atk: 0, sch: 1, dashedStats: ["atk"], abilities: [NORMAN_WOULD_ATTACK.ref] },
    { hp: flat(12), atk: 0, sch: 2, dashedStats: ["atk"], abilities: [NORMAN_WOULD_ATTACK.ref] },
  ],
  back: {
    name: "Goblin",
    stages: [
      { hp: flat(10), atk: 2, sch: 0, dashedStats: ["sch"], abilities: [GOBLIN_REVEALED.ref] },
      { hp: flat(12), atk: 3, sch: 0, dashedStats: ["sch"] },
    ],
  },
});
/** A villain with a "—" ATK and nothing that replaces its attack (docs/phase7-wave1.md §4.4). */
const PLAIN_NORMAN = stubVillain({
  id: "plain-norman",
  stages: [{ hp: flat(10), atk: 0, sch: 1, dashedStats: ["atk"] }],
});

// --- The environment: Enterprise / Madness ---------------------------------------------------------------------

const flipBoth: readonly EffectSpec[] = [
  { kind: "flipCard", target: theVillain },
  { kind: "flipCard", target: self },
];
/** "If there are no infamy counters here, flip Norman and Enterprise." */
const ENTERPRISE_FLIPS = stubAbility("enterprise.state", {
  trigger: { kind: "stateCheck", when: noCounters("infamy") },
  effects: flipBoth,
});
/** "Enterprise enters play with 2 infamy counters", applied on a flip to this face too (§4.1's proposed reading, as a script). */
const ENTERPRISE_COUNTERS = stubAbility("enterprise.counters", {
  trigger: { kind: "response", forced: true, on: { on: ["cardEntersPlay", "cardFlipped"], selfIs: "target" } },
  effects: [{ kind: "addCounters", target: self, counterType: "infamy", amount: two }],
});
const MADNESS_FLIPS = stubAbility("madness.state", {
  trigger: { kind: "stateCheck", when: noCounters("madness") },
  effects: flipBoth,
});
const MADNESS_COUNTERS = stubAbility("madness.counters", {
  trigger: { kind: "response", forced: true, on: { on: "cardFlipped", selfIs: "target" } },
  effects: [{ kind: "addCounters", target: self, counterType: "madness", amount: two }],
});
/** A When Revealed on the back face: a flip must never resolve it. */
const MADNESS_REVEALED = stubAbility("madness.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "addCounters", target: self, counterType: "revealed", amount: one }],
});
const ENTERPRISE = stubEnvironment({
  id: "enterprise",
  name: "Enterprise",
  traits: [trait("Criminal")],
  keywords: [{ name: "setup" }],
  abilities: [ENTERPRISE_FLIPS.ref, ENTERPRISE_COUNTERS.ref],
  flipSide: {
    name: "Madness",
    traits: [trait("Madness")],
    abilities: [MADNESS_FLIPS.ref, MADNESS_COUNTERS.ref, MADNESS_REVEALED.ref],
  },
});

// --- Encounter cards -------------------------------------------------------------------------------------------

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const CHAIN = stubAttachment({ id: "chain", attachesTo: { kind: "villain" } });
/** A boost card whose "Boost" removes a madness counter (FAQ #1B's situation). */
const MADNESS_BOOST_ABILITY = stubAbility("madness-boost.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "removeCounters", target: theEnvironment, counterType: "madness", amount: one }],
});
const MADNESS_BOOST = stubTreachery({ id: "madness-boost", boostIcons: 2, abilities: [MADNESS_BOOST_ABILITY.ref] });
/** I See You's shape: "When Revealed: The villain attacks you." */
const I_SEE_YOU_REVEALED = stubAbility("i-see-you.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "controller" } }],
});
const I_SEE_YOU = stubTreachery({ id: "i-see-you", boostIcons: 0, abilities: [I_SEE_YOU_REVEALED.ref] });
/** "When Revealed (Norman): …" — resolves only while the Norman face is up. */
const NORMAN_ONLY_REVEALED = stubAbility("norman-only.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    {
      kind: "if",
      condition: { kind: "faceNamed", of: theVillain, name: "Norman" },
      then: [{ kind: "addCounters", target: theVillain, counterType: "normanOnly", amount: one }],
    },
  ],
});
const NORMAN_ONLY = stubTreachery({ id: "norman-only", boostIcons: 0, abilities: [NORMAN_ONLY_REVEALED.ref] });

// --- Player cards that apply one effect when played ------------------------------------------------------------

const actionEvent = (
  id: string,
  effects: readonly EffectSpec[],
): { readonly card: AnyCard; readonly ability: StubAbility } => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const FLIP_VILLAIN = actionEvent("flip-villain", [{ kind: "flipCard", target: theVillain }]);
const FLIP_ENVIRONMENT = actionEvent("flip-environment", [{ kind: "flipCard", target: theEnvironment }]);
const DROP_INFAMY = actionEvent("drop-infamy", [
  { kind: "removeCounters", target: theEnvironment, counterType: "infamy", amount: one },
]);
const DROP_MADNESS = actionEvent("drop-madness", [
  { kind: "removeCounters", target: theEnvironment, counterType: "madness", amount: one },
]);
const DISCARD_ENVIRONMENT = actionEvent("discard-environment", [{ kind: "discardFromPlay", target: theEnvironment }]);
const supports = { kind: "each", query: { categories: ["support"] } } as const;
const CHARGE = actionEvent("charge", [{ kind: "addCounters", target: supports, counterType: "charge", amount: one }]);
const DRAIN = actionEvent("drain", [{ kind: "removeCounters", target: supports, counterType: "charge", amount: one }]);
const EVENTS = [FLIP_VILLAIN, FLIP_ENVIRONMENT, DROP_INFAMY, DROP_MADNESS, DISCARD_ENVIRONMENT, CHARGE, DRAIN];

/** "If there are no charge counters here, place a 'fired' counter here": its condition outlives its own effect. */
const WATCHER_CHECK = stubAbility("watcher.state", {
  trigger: { kind: "stateCheck", when: noCounters("charge") },
  effects: [{ kind: "addCounters", target: self, counterType: "fired", amount: one }],
});
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [WATCHER_CHECK.ref] });
/** Forced reveal interrupt and response, each leaving a counter: a flip must trigger neither. */
const SPY_INTERRUPT = stubAbility("spy.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "encounterCardRevealing" } },
  effects: [{ kind: "addCounters", target: self, counterType: "sawRevealing", amount: one }],
});
const SPY_RESPONSE = stubAbility("spy.response", {
  trigger: { kind: "response", forced: true, on: { on: "cardRevealed" } },
  effects: [{ kind: "addCounters", target: self, counterType: "sawRevealed", amount: one }],
});
const SPY = stubSupport({ id: "spy", cost: 0, abilities: [SPY_INTERRUPT.ref, SPY_RESPONSE.ref] });

const ALL_ABILITIES: readonly StubAbility[] = [
  NORMAN_WOULD_ATTACK,
  GOBLIN_REVEALED,
  ENTERPRISE_FLIPS,
  ENTERPRISE_COUNTERS,
  MADNESS_FLIPS,
  MADNESS_COUNTERS,
  MADNESS_REVEALED,
  MADNESS_BOOST_ABILITY,
  I_SEE_YOU_REVEALED,
  NORMAN_ONLY_REVEALED,
  WATCHER_CHECK,
  SPY_INTERRUPT,
  SPY_RESPONSE,
  ...EVENTS.map((event) => event.ability),
];

const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

interface GameOptions {
  readonly side?: "A" | "B";
  readonly villain?: typeof GOBLIN;
  /** Put Enterprise into play at setup (default true). */
  readonly environment?: boolean;
  /** The rest of the encounter deck (default blanks). */
  readonly encounter?: readonly CardId[];
}

const deps: EngineDeps = depsOf(...ALL_ABILITIES);

/** A game at p1's first turn. */
function game(options: GameOptions = {}): GameState {
  const villain = options.villain ?? GOBLIN;
  const result = createGame(
    {
      seed: 7,
      cards: [
        ...DEFAULT_CARDS,
        GOBLIN,
        PLAIN_NORMAN,
        ENTERPRISE,
        BLANK,
        CHAIN,
        MADNESS_BOOST,
        I_SEE_YOU,
        NORMAN_ONLY,
        WATCHER,
        SPY,
        ...EVENTS.map((e) => e.card),
      ],
      villainCardId: villain.id,
      ...(options.side ? { villainSide: options.side } : {}),
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [
        ...(options.environment === false ? [] : [ENTERPRISE.id]),
        CHAIN.id,
        ...(options.encounter ?? copies(BLANK.id, 12)),
      ],
      players: [
        {
          identityCardId: HERO.id,
          deck: [...DEFAULT_DECK, ...EVENTS.flatMap((e) => copies(e.card.id, 3)), WATCHER.id, SPY.id],
        },
      ],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return run(result.state).state;
}

/** Applies commands through a session, answering every choice with `defaultPick`; returns the session and its events. */
function drive(
  session: GameSession,
  commands: readonly Command[] = [],
): { readonly session: GameSession; readonly events: readonly GameEvent[] } {
  let current = session;
  const events: GameEvent[] = [];
  const apply = (command: Command): void => {
    const result = sessionApply(current, command, deps);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
    current = result.session;
    events.push(...result.events);
  };
  const answer = (): void => {
    for (let guard = 0; current.state.pendingChoice && !current.state.outcome; guard++) {
      if (guard > 100) throw new Error("choices did not settle");
      const choice = current.state.pendingChoice;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: defaultPick(current.state),
      });
    }
  };
  answer();
  for (const command of commands) {
    apply(command);
    answer();
  }
  return { session: current, events };
}

const run = (state: GameState, ...commands: readonly Command[]) => {
  const { session, events } = drive(startSession(state), commands);
  return { state: session.state, events };
};

/** Puts a copy of `card` in p1's hand and plays it for 0. */
function play(state: GameState, card: AnyCard) {
  const given = giveCard(state, p1, card.id);
  return run(given.state, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };

const villainId = (state: GameState): InstanceId => activeVillain(state).instanceId;
const environmentId = (state: GameState): InstanceId => {
  const id = [...state.villainArea, ...state.removedFromGame].find(
    (candidate) => state.instances[candidate]?.cardId === ENTERPRISE.id,
  );
  if (!id) throw new Error("no environment");
  return id;
};
const inPlayCopy = (state: GameState, card: AnyCard): InstanceId => {
  const id = mustPlayer(state, p1).playArea.find((candidate) => state.instances[candidate]?.cardId === card.id);
  if (!id) throw new Error(`no ${card.id} in play`);
  return id;
};
const counters = (state: GameState, id: InstanceId) => mustInstance(state, id).counters;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const identity = (state: GameState) => mustInstance(state, mustPlayer(state, p1).identity.instanceId);

/** Test surgery on one instance. */
const patch = (
  state: GameState,
  id: InstanceId,
  change: (instance: CardInstance) => Partial<CardInstance>,
): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change(mustInstance(state, id)) } },
});

/** Test surgery: takes the first copy of `card` out of the encounter deck. */
function pull(state: GameState, card: AnyCard): { readonly state: GameState; readonly id: InstanceId } {
  const [deckId] = state.encounterDeckOrder;
  const piles = deckId ? state.encounterDecks[deckId] : undefined;
  const id = piles?.deck.find((candidate) => state.instances[candidate]?.cardId === card.id);
  if (!deckId || !piles || !id) throw new Error(`no ${card.id} in the encounter deck`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
    },
  };
}

/** Test surgery: `card` from the encounter deck attached faceup to `host`. */
function attach(
  state: GameState,
  host: InstanceId,
  card: AnyCard,
): { readonly state: GameState; readonly id: InstanceId } {
  const pulled = pull(state, card);
  const withHost = patch(pulled.state, host, (h) => ({ attachments: [...h.attachments, pulled.id] }));
  return { id: pulled.id, state: patch(withHost, pulled.id, () => ({ attachedTo: host, faceup: true })) };
}

describe("§3.3 villain stage cards with two faces", () => {
  it("setup puts the chosen face up; the face's title, abilities and '—' stats are the ones read", () => {
    const norman = game();
    expect(currentName(norman, villainId(norman))).toBe("Norman");
    expect(characterProfile(norman, villainId(norman), deps)).toMatchObject({ atk: 0, sch: 1, missing: ["atk"] });
    const goblin = game({ side: "B" });
    expect(currentName(goblin, villainId(goblin))).toBe("Goblin");
    expect(characterProfile(goblin, villainId(goblin), deps)).toMatchObject({ atk: 2, sch: 0, missing: ["sch"] });
    // RRG 1.8 Appendix II: the starting stage is revealed during setup, so the face's When Revealed resolved.
    expect(counters(goblin, villainId(goblin)).goblinRevealed).toBe(1);
    expect(counters(norman, villainId(norman)).goblinRevealed).toBeUndefined();
  });

  it("a flip keeps damage, statuses, counters, attachments and boost cards, and resolves the new face's When Revealed", () => {
    const start = game();
    const villain = villainId(start);
    const attached = attach(start, villain, CHAIN);
    const boost = pull(attached.state, BLANK);
    const primed = patch(boost.state, villain, (_v) => ({
      damage: 4,
      statuses: { stunned: 1, confused: 0, tough: 1 },
      counters: { marker: 2 },
      boostCards: [boost.id],
    }));

    const { state, events } = play(primed, FLIP_VILLAIN.card);

    expect(activeVillain(state).side).toBe("B");
    expect(currentName(state, villain)).toBe("Goblin");
    expect(mustInstance(state, villain)).toMatchObject({
      damage: 4,
      statuses: { stunned: 1, confused: 0, tough: 1 },
      attachments: [attached.id],
      boostCards: [boost.id],
      counters: { marker: 2, goblinRevealed: 1 },
    });
    expect(activeVillain(state).stageIndex).toBe(0);
    expect(ofType(events, "villainFlipped")).toEqual([
      { type: "villainFlipped", instanceId: villain, from: "A", to: "B" },
    ]);
    expect(characterProfile(state, villain, deps)).toMatchObject({ atk: 2, missing: ["sch"] });
  });

  it("a flip is not a reveal of the encounter deck: a one-sided villain is not flipped and nothing happens", () => {
    const state = game({ villain: PLAIN_NORMAN, environment: false });
    const { state: after, events } = play(state, FLIP_VILLAIN.card);
    expect(activeVillain(after).side).toBe("A");
    expect(ofType(events, "villainFlipped")).toEqual([]);
  });

  it.each([
    { side: "A" as const, first: "Norman", atk: 0, missing: ["atk"] },
    { side: "B" as const, first: "Goblin", atk: 3, missing: ["sch"] },
  ])("defeating $first I enters $first II on the same side", ({ side, first, atk, missing }) => {
    const start = run(game({ side, environment: false }), toHero).state;
    const villain = villainId(start);
    const primed = patch(start, villain, () => ({ damage: 8 }));
    const { state } = run(primed, {
      type: "basicAttack",
      playerId: p1,
      attackerInstanceId: identity(primed).instanceId,
      targetInstanceId: villain,
    });
    expect(activeVillain(state)).toMatchObject({ side, stageIndex: 1, defeated: false });
    expect(currentName(state, villain)).toBe(first);
    expect(characterProfile(state, villain, deps)).toMatchObject({ atk, maxHp: 12, missing });
  });

  it("FAQ Norman Osborn (#1A): a stun is used first, so the activation and its 'would attack' replacement do not happen", () => {
    const start = run(game(), toHero).state;
    const villain = villainId(start);
    const environment = environmentId(start);
    expect(counters(start, environment).infamy).toBe(2);

    const stunned = run(
      patch(start, villain, () => ({ statuses: { stunned: 1, confused: 0, tough: 0 } })),
      endTurn,
    );
    expect(ofType(stunned.events, "statusRemoved")).toContainEqual({
      type: "statusRemoved",
      instanceId: villain,
      status: "stunned",
      reason: "cancelledAttack",
    });
    expect(counters(stunned.state, environment).infamy).toBe(2);
    expect(stunned.events.some((e) => e.type === "triggerEvent" && e.event.kind === "enemyAttack")).toBe(false);

    // Without the stun the replacement fires: 1 infamy counter instead of an attack, and so no boost card.
    const replaced = run(start, endTurn);
    expect(counters(replaced.state, environment).infamy).toBe(3);
    expect(ofType(replaced.events, "boostCardDealt").filter((e) => e.enemyInstanceId === villain)).toEqual([]);
    expect(ofType(replaced.events, "activationSkipped")).toEqual([]);
    expect(identity(replaced.state).damage).toBe(0);
  });

  it("a '—' ATK villain nothing replaces does not attack and gets no boost card (docs/phase7-wave1.md §4.4 reading)", () => {
    const start = run(game({ villain: PLAIN_NORMAN, environment: false }), toHero).state;
    const villain = villainId(start);
    const { state, events } = run(start, endTurn);
    expect(ofType(events, "activationSkipped")).toEqual([
      { type: "activationSkipped", enemyInstanceId: villain, activation: "attack", reason: "dashedStat" },
    ]);
    expect(ofType(events, "boostCardDealt").filter((e) => e.enemyInstanceId === villain)).toEqual([]);
    expect(identity(state).damage).toBe(0);
  });

  it("FAQ Green Goblin (#1B): a boost that removes the last madness counter flips him mid-attack for 0 plus boost icons, and the would-attack interrupt does not fire", () => {
    const { state, events } = midAttackFlip();
    const villain = villainId(state);
    const environment = environmentId(state);

    expect(activeVillain(state).side).toBe("A");
    expect(currentName(state, environment)).toBe("Enterprise");
    // Enterprise's own 2 counters from its flip, and no third from Norman's "would attack" interrupt.
    expect(counters(state, environment).infamy).toBe(2);
    const resolved = ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === villain);
    expect(resolved).toEqual([expect.objectContaining({ baseAtk: 0, boostIcons: 2, damageDealt: 2 })]);
    expect(identity(state).damage).toBe(2);
    // The flip happens between the boost card turning over and the damage.
    const index = (predicate: (e: GameEvent) => boolean) => events.findIndex(predicate);
    const boostFlipped = index((e) => e.type === "boostCardFlipped" && e.enemyInstanceId === villain);
    const flipped = index((e) => e.type === "villainFlipped");
    const damage = index((e) => e.type === "attackResolved" && e.enemyInstanceId === villain);
    expect(boostFlipped).toBeGreaterThanOrEqual(0);
    expect(boostFlipped).toBeLessThan(flipped);
    expect(flipped).toBeLessThan(damage);
  });

  it("FAQ I See You (#30): 'the villain attacks you' on an encounter card attacks a player in alter-ego form", () => {
    const start = game({ side: "B", environment: false, encounter: copies(I_SEE_YOU.id, 12) });
    const villain = villainId(start);
    const { state, events } = run(start, endTurn);
    expect(mustPlayer(state, p1).identity.form).toBe("alterEgo");
    // Goblin's "—" SCH skips his own scheme activation; the treachery's attack still hits.
    expect(ofType(events, "activationSkipped")).toContainEqual({
      type: "activationSkipped",
      enemyInstanceId: villain,
      activation: "scheme",
      reason: "dashedStat",
    });
    expect(ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === villain)).toEqual([
      expect.objectContaining({ baseAtk: 2, damageDealt: 2 }),
    ]);
    expect(identity(state).damage).toBe(2);
  });

  it("'When Revealed (Norman)' resolves only while the Norman face is up", () => {
    const normanUp = run(game({ environment: false, encounter: copies(NORMAN_ONLY.id, 12) }), endTurn).state;
    expect(counters(normanUp, villainId(normanUp)).normanOnly).toBe(1);
    const goblinUp = run(game({ side: "B", environment: false, encounter: copies(NORMAN_ONLY.id, 12) }), endTurn).state;
    expect(counters(goblinUp, villainId(goblinUp)).normanOnly).toBeUndefined();
  });
});

/** FAQ #1B's setup: Goblin up, Madness showing with its last counter, and a boost card that removes it. */
function midAttackFlip(): {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly session: GameSession;
} {
  const start = game({ side: "B", encounter: copies(MADNESS_BOOST.id, 12) });
  const primed = patch(start, environmentId(start), () => ({ flipped: true, counters: { madness: 1 } }));
  const { session, events } = drive(startSession(primed), [toHero, endTurn]);
  return { state: session.state, events, session };
}

describe("§3.4 double-sided encounter cards that flip, and state checks", () => {
  it("the state check fires once when the last counter is removed, flipping both cards, and again only after it re-arms", () => {
    const start = game();
    const environment = environmentId(start);
    const oneLeft = play(start, DROP_INFAMY.card);
    expect(counters(oneLeft.state, environment).infamy).toBe(1);
    expect(ofType(oneLeft.events, "cardFlipped")).toEqual([]);

    const flipped = play(oneLeft.state, DROP_INFAMY.card);
    expect(ofType(flipped.events, "villainFlipped")).toHaveLength(1);
    expect(ofType(flipped.events, "cardFlipped")).toEqual([
      { type: "cardFlipped", instanceId: environment, flipped: true },
    ]);
    expect(currentName(flipped.state, environment)).toBe("Madness");
    expect(activeVillain(flipped.state).side).toBe("B");
    // "Enters play with 2 madness counters" applied on the flip (docs/phase7-wave1.md §4.1, proposed), so the Madness
    // face's own check, first seen true before its counters arrived, did not fire.
    expect(counters(flipped.state, environment)).toMatchObject({ infamy: 0, madness: 2 });
    expect(counters(flipped.state, villainId(flipped.state)).goblinRevealed).toBe(1);

    const back = play(play(flipped.state, DROP_MADNESS.card).state, DROP_MADNESS.card);
    expect(ofType(back.events, "villainFlipped")).toEqual([expect.objectContaining({ from: "B", to: "A" })]);
    expect(currentName(back.state, environment)).toBe("Enterprise");
    expect(counters(back.state, environment)).toMatchObject({ infamy: 2, madness: 0 });
  });

  it("a state check is edge-triggered: it does not repeat while its condition stays true", () => {
    const withWatcher = play(game({ environment: false }), WATCHER).state;
    const watcher = inPlayCopy(withWatcher, WATCHER);
    // Its first observation (no charge counters) only records the value.
    expect(counters(withWatcher, watcher).fired).toBeUndefined();

    const fired = play(play(withWatcher, CHARGE.card).state, DRAIN.card).state;
    expect(counters(fired, watcher).fired).toBe(1);
    // The condition stays true through a whole round of frames: no second firing.
    const nextRound = run(fired, endTurn).state;
    expect(nextRound.round).toBe(2);
    expect(counters(nextRound, watcher).fired).toBe(1);
    // False, then true again: it fires again.
    const again = play(play(nextRound, CHARGE.card).state, DRAIN.card).state;
    expect(counters(again, watcher).fired).toBe(2);
  });

  it("flipping is not revealing: no reveal interrupts, no reveal responses, and no When Revealed on the new face", () => {
    const withSpy = play(game(), SPY).state;
    const spy = inPlayCopy(withSpy, SPY);
    const { state, events } = play(withSpy, FLIP_ENVIRONMENT.card);
    const environment = environmentId(state);
    expect(currentName(state, environment)).toBe("Madness");
    expect(counters(state, spy)).toEqual({});
    expect(counters(state, environment).revealed).toBeUndefined();
    expect(events.some((e) => e.type === "encounterCardRevealed")).toBe(false);
  });

  it("a flipped card keeps its attachments and tokens; `named`, traits and keywords read the face that is up", () => {
    const start = game();
    const environment = environmentId(start);
    const attached = attach(start, environment, CHAIN);
    const context = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps };

    const { state } = play(attached.state, FLIP_ENVIRONMENT.card);
    expect(mustInstance(state, environment)).toMatchObject({
      flipped: true,
      attachments: [attached.id],
      counters: { infamy: 2, madness: 2 },
    });
    expect(resolveRef(state, { kind: "named", name: "Enterprise" }, context)).toEqual([]);
    expect(resolveRef(state, { kind: "named", name: "Madness" }, context)).toEqual([environment]);
    const ref: TargetRef = { kind: "slot", slot: "env" };
    const withSlot = { ...context, bindings: { env: [environment] } };
    expect(evaluate(state, { kind: "hasTrait", of: ref, trait: trait("Madness") }, withSlot)).toBe(true);
    expect(evaluate(state, { kind: "hasTrait", of: ref, trait: trait("Criminal") }, withSlot)).toBe(false);
    expect(evaluate(state, { kind: "faceNamed", of: ref, name: "Madness" }, withSlot)).toBe(true);
    expect(keywordsOf(start, environment, deps)).toEqual([{ name: "setup" }]);
    expect(keywordsOf(state, environment, deps)).toEqual([]);
  });

  it("a double-sided card leaving play is removed from the game (RRG 1.8 'Double-Sided Card', p. 17)", () => {
    const start = game();
    const environment = environmentId(start);
    const attached = attach(start, environment, CHAIN);
    const flipped = play(attached.state, FLIP_ENVIRONMENT.card).state;
    const { state } = play(flipped, DISCARD_ENVIRONMENT.card);
    expect(state.removedFromGame).toContain(environment);
    expect(state.encounterDecks[state.encounterDeckOrder[0] ?? ""]?.discard).not.toContain(environment);
    expect(mustInstance(state, environment)).toMatchObject({ flipped: false, counters: {}, attachments: [] });
    // Its single-sided attachment is discarded as usual.
    expect(state.encounterDecks[state.encounterDeckOrder[0] ?? ""]?.discard).toContain(attached.id);
    expect(cardId(ENTERPRISE.id)).toBe(ENTERPRISE.id);
  });

  it("replaying a mid-attack flip reproduces the same state", () => {
    const { session } = midAttackFlip();
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
