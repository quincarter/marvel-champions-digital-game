/**
 * An activation initiated indirectly while an enemy activation resolves waits for it (PR #410 owner review of e8ade787d).
 *
 * Sources: RRG 1.8 "Activation" (p. 6): "If an effect initiates an activation during the resolution of another
 * activation, the newly initiated activation resolves after the current activation has finished resolving."; FFG
 * ruling Jun 13, 2024 (#214, docs/rulings/post-rrg-1-5/09-2024-part-4.md): "a new activation cannot interrupt an
 * activation currently resolving."; RRG 1.8 "Boost" (p. 11); ruling Feb 28, 2026 (1) answer 2 (Retaliate and responses
 * resolve before the queued activation).
 *
 * The engine decides this in `resolve/apply-effect.ts` (`case "enemyAttack" | "enemyScheme" | "enemyActivation"`) from
 * the stack: an enemy attack or scheme in progress (`currentActivationFrameId`) holds the new activation in its
 * `endEffects`, whatever ability initiated it. These tests start the activation from an ability that is not a Boost
 * ability.
 */

import { flat, type AbilityReference, type CardId, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { GameEvent } from "./events.js";
import { playerId } from "./ids.js";
import { activeEncounterDeck, activeVillain } from "./query.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import {
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCard, withEncounterPiles } from "./testing/scenario.js";
import { minionEngagedWith } from "./testing/wave3.js";
import type { PendingChoice } from "./choices.js";

const p1 = playerId("p1");
const one = { kind: "const", value: 1 } as const;
const self = { kind: "self" } as const;
const theVillain = { kind: "villain" } as const;

/** The scenario's setup puts the villain's signature side scheme into play. */
const PUT_SCHEMES = stubAbility("scenario.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "signature", cards: { kind: "encounterSetAside" } },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "signature" }, controller: { kind: "firstPlayer" } },
  ],
});
const SCENARIO = stubMainScheme({
  id: "scenario",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [PUT_SCHEMES.ref] },
  ],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

/** "Forced Response: After threat is placed here, the villain attacks you." Not a Boost ability. */
const ATTACK_ON_THREAT = stubAbility("side.attack-on-threat", {
  trigger: { kind: "response", forced: true, on: { on: "placeThreat", selfIs: "target" } },
  effects: [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "firstPlayer" } }],
});
const SIDE = stubSideScheme({ id: "side", startingThreat: 1, boostIcons: 0, abilities: [ATTACK_ON_THREAT.ref] });
/** "Boost: Place 1 threat on the villain's side scheme." The attack comes from the side scheme's response to it. */
const BOOST_THREAT = stubAbility("threat.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "placeThreat", target: { kind: "signatureSideSchemeOf", villain: theVillain }, amount: one }],
});
const THREAT_BOOST = stubTreachery({ id: "threat-boost", boostIcons: 0, abilities: [BOOST_THREAT.ref] });

/** "Forced Response: After the villain's attack deals damage to you, the villain schemes." (no Boost ability anywhere) */
const SCHEME_AFTER_DAMAGE = stubAbility("punisher.scheme-after-damage", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "dealDamage", fromAttack: true, requireResults: { amount: 1 } },
  },
  effects: [{ kind: "enemyScheme", enemies: theVillain }],
});
/** "After the villain attacks, …": a response of the activation that the queued one must follow. */
const WATCHER_RESPONSE = stubAbility("watcher.response", {
  trigger: { kind: "response", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
  effects: [{ kind: "addCounters", target: self, counterType: "sawAttack", amount: one }],
});
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [WATCHER_RESPONSE.ref] });
const PUNISHER = stubSupport({ id: "punisher", cost: 0, abilities: [SCHEME_AFTER_DAMAGE.ref] });

/** "Forced Interrupt: When [this villain] would attack, it schemes instead." A replacement, not a new activation. */
const SCHEMES_INSTEAD = stubAbility("boss.schemes-instead", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
  effects: [{ kind: "replaceTriggeringEvent", with: [{ kind: "enemyScheme", enemies: self }] }],
});
/** "Forced Response: After the villain attacks, your hero attacks the villain for 1. Discard this card." */
const HERO_STRIKES = stubAbility("striker.response", {
  trigger: { kind: "response", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
  effects: [
    { kind: "attack", target: theVillain, amount: one },
    { kind: "discardFromPlay", target: self },
  ],
});
/** "Forced Response: After you attack, the villain attacks you." (the shape of a leader's punishing response) */
const STRIKE_BACK = stubAbility("striker.strike-back", {
  trigger: { kind: "response", forced: true, on: { on: "attack", playerIs: "controller" } },
  effects: [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "firstPlayer" } }],
});
const STRIKER = stubSupport({ id: "striker", cost: 0, abilities: [HERO_STRIKES.ref] });
const PUNISHING_LEADER = stubSupport({ id: "punishing-leader", cost: 0, abilities: [STRIKE_BACK.ref] });
/**
 * "Forced Response: After the villain's attack deals damage to you, the villain attacks you. If no attack was made this
 * way, place 1 counter here. Discard this card." (Tail Sweep's shape, 02040, answering mid-activation.)
 */
const ATTACK_OR_COUNTER = stubAbility("sweeper.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "dealDamage", fromAttack: true, requireResults: { amount: 1 } },
  },
  effects: [
    { kind: "enemyAttack", enemies: theVillain, against: { kind: "firstPlayer" }, bind: "sweep" },
    {
      kind: "if",
      condition: { kind: "not", of: { kind: "varAtLeast", name: "sweep.made", amount: 1 } },
      then: [{ kind: "addCounters", target: self, counterType: "noAttack", amount: one }],
    },
    { kind: "discardFromPlay", target: self },
  ],
});
const SWEEPER = stubSupport({ id: "sweeper", cost: 0, abilities: [ATTACK_OR_COUNTER.ref] });
const AFTER_DAMAGE_ONCE = {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "dealDamage", fromAttack: true, requireResults: { amount: 1 } },
  },
  // These fixtures are about the frames that wait, not about the card answering its own attack's damage.
  limit: { count: 1, period: "round" },
} as const;
/** The Sweeper's ability with its attack one sentence deep, and a counter after the sentence. */
const NESTED_ATTACK_OR_COUNTER = stubAbility("nested-sweeper.response", {
  ...AFTER_DAMAGE_ONCE,
  effects: [
    {
      kind: "sentence",
      effects: [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "firstPlayer" }, bind: "sweep" }],
    },
    {
      kind: "if",
      condition: { kind: "not", of: { kind: "varAtLeast", name: "sweep.made", amount: 1 } },
      then: [{ kind: "addCounters", target: self, counterType: "noAttack", amount: one }],
    },
    { kind: "addCounters", target: self, counterType: "afterSentence", amount: one },
  ],
});
const NESTED_SWEEPER = stubSupport({ id: "nested-sweeper", cost: 0, abilities: [NESTED_ATTACK_OR_COUNTER.ref] });
/** "For each player, if [always true], the villain attacks that player." Then a counter: the attack two frames deep. */
const BRANCH_ATTACK = stubAbility("branch-sweeper.response", {
  ...AFTER_DAMAGE_ONCE,
  effects: [
    {
      kind: "forEachPlayer",
      players: { kind: "each" },
      effects: [
        {
          kind: "if",
          condition: { kind: "not", of: { kind: "varAtLeast", name: "never", amount: 1 } },
          then: [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "scoped" } }],
        },
      ],
    },
    { kind: "addCounters", target: self, counterType: "afterBranch", amount: one },
  ],
});
const BRANCH_SWEEPER = stubSupport({ id: "branch-sweeper", cost: 0, abilities: [BRANCH_ATTACK.ref] });
/** "When Revealed: The villain attacks you. Place 1 threat on the main scheme." */
const AMBUSH_REVEALED = stubAbility("ambush.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "enemyAttack", enemies: theVillain, against: { kind: "firstPlayer" } },
    { kind: "placeThreat", target: { kind: "mainScheme" }, amount: one },
  ],
});
const AMBUSH = stubTreachery({ id: "ambush", boostIcons: 0, abilities: [AMBUSH_REVEALED.ref] });
/** "Forced Response: After the villain's attack deals damage to you, reveal an Ambush from the encounter deck." */
const REVEAL_AMBUSH = stubAbility("revealer.response", {
  ...AFTER_DAMAGE_ONCE,
  effects: [
    {
      kind: "selectCards",
      slot: "ambush",
      cards: { kind: "encounter", zones: ["deck"], filter: { printedId: AMBUSH.id }, topmostOnly: true },
    },
    {
      kind: "revealCard",
      cards: { kind: "slot", slot: "ambush" },
      player: { kind: "firstPlayer" },
      fromEncounterDeck: true,
    },
  ],
});
const REVEALER = stubSupport({ id: "revealer", cost: 0, abilities: [REVEAL_AMBUSH.ref] });
/** "Forced Response: After the villain's attack deals damage to you, each minion attacks you." With no minion. */
const MINIONS_ATTACK = stubAbility("void.response", {
  ...AFTER_DAMAGE_ONCE,
  effects: [
    {
      kind: "enemyAttack",
      enemies: { kind: "each", query: { categories: ["minion"] } },
      against: { kind: "firstPlayer" },
    },
  ],
});
const VOID = stubSupport({ id: "void", cost: 0, abilities: [MINIONS_ATTACK.ref] });
/** "Forced Response: After the Void's ability resolves, place 1 counter here." (RRG 1.8 "Resolve", p. 37) */
const HEARS_VOID = stubAbility("void-watcher.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "abilityResolved", eventIs: { abilityId: MINIONS_ATTACK.ref.id } },
  },
  effects: [{ kind: "addCounters", target: self, counterType: "heard", amount: one }],
});
const VOID_WATCHER = stubSupport({ id: "void-watcher", cost: 0, abilities: [HEARS_VOID.ref] });
/** "Action: The villain attacks you." written as one sentence, the ability's last instruction. */
const PROVOKE = stubAbility("provoker.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "sentence", effects: [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "firstPlayer" } }] },
  ],
});
const PROVOKER = stubSupport({ id: "provoker", cost: 0, abilities: [PROVOKE.ref] });
/** "Forced Response: After the villain takes damage, place 1 counter here." Its window is held by the sentence. */
const VILLAIN_HURT = stubAbility("hurt-noter.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "dealDamage", targetIs: { categories: ["villain"] }, requireResults: { amount: 1 } },
  },
  effects: [{ kind: "addCounters", target: self, counterType: "held", amount: one }],
});
const HURT_NOTER = stubSupport({ id: "hurt-noter", cost: 0, abilities: [VILLAIN_HURT.ref] });
/** "Forced Response: After the villain attacks, it schemes." It waits behind that attack. */
const SCHEME_AFTER_ATTACK = stubAbility("after-attack-schemer.response", {
  trigger: { kind: "response", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
  effects: [{ kind: "enemyScheme", enemies: theVillain }],
});
const AFTER_ATTACK_SCHEMER = stubSupport({ id: "after-attack-schemer", cost: 0, abilities: [SCHEME_AFTER_ATTACK.ref] });
const GRUNT_A = stubMinion({ id: "grunt-a", atk: 1, sch: 1, hp: 9, boostIcons: 0 });
const GRUNT_B = stubMinion({ id: "grunt-b", atk: 2, sch: 1, hp: 9, boostIcons: 0 });
/** "Forced Response: After the villain's attack deals damage to you, each enemy attacks you." One effect. */
const EACH_ENEMY_ATTACKS = stubAbility("swarm.response", {
  ...AFTER_DAMAGE_ONCE,
  effects: [
    {
      kind: "enemyAttack",
      enemies: { kind: "each", query: { categories: ["enemy"] } },
      against: { kind: "firstPlayer" },
    },
  ],
});
const SWARM = stubSupport({ id: "swarm", cost: 0, abilities: [EACH_ENEMY_ATTACKS.ref] });
/** "Forced Response: After the villain's attack deals damage to you, [that grunt] attacks you." Two separate cards. */
const gruntStrikes = (grunt: typeof GRUNT_A) =>
  stubAbility(`${grunt.id}-caller.response`, {
    ...AFTER_DAMAGE_ONCE,
    effects: [
      {
        kind: "enemyAttack",
        enemies: { kind: "each", query: { printedId: grunt.id } },
        against: { kind: "firstPlayer" },
      },
    ],
  });
const CALL_A = gruntStrikes(GRUNT_A);
const CALL_B = gruntStrikes(GRUNT_B);
const CALLER_A = stubSupport({ id: "caller-a", cost: 0, abilities: [CALL_A.ref] });
const CALLER_B = stubSupport({ id: "caller-b", cost: 0, abilities: [CALL_B.ref] });

/** "Forced Response: After the villain schemes, the villain attacks you twice. Discard this card." */
const TWO_ATTACKS = stubAbility("doubler.response", {
  trigger: { kind: "response", forced: true, on: { on: "enemyScheme", sourceIs: { categories: ["villain"] } } },
  effects: [
    { kind: "enemyAttack", enemies: theVillain, against: { kind: "firstPlayer" } },
    { kind: "enemyAttack", enemies: theVillain, against: { kind: "firstPlayer" } },
    { kind: "discardFromPlay", target: self },
  ],
});
/** "Forced Interrupt: When the villain would attack, it schemes instead. Discard this card." */
const SCHEME_INSTEAD_ONCE = stubAbility("diverter.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [
        { kind: "enemyScheme", enemies: theVillain },
        { kind: "discardFromPlay", target: self },
      ],
    },
  ],
});
/** "Forced Response: After the villain schemes, it attacks each player. Discard this card." */
const ATTACK_EACH = stubAbility("rampage.response", {
  trigger: { kind: "response", forced: true, on: { on: "enemyScheme", sourceIs: { categories: ["villain"] } } },
  effects: [
    {
      kind: "forEachPlayer",
      players: { kind: "each" },
      effects: [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "scoped" } }],
    },
    { kind: "discardFromPlay", target: self },
  ],
});
const DOUBLER = stubSupport({ id: "doubler", cost: 0, abilities: [TWO_ATTACKS.ref] });
const DIVERTER = stubSupport({ id: "diverter", cost: 0, abilities: [SCHEME_INSTEAD_ONCE.ref] });
const RAMPAGE = stubSupport({ id: "rampage", cost: 0, abilities: [ATTACK_EACH.ref] });

const SPIKY: HeroIdentityCard = stubIdentity({
  id: "spiky",
  hp: 20,
  atk: 2,
  thw: 2,
  def: 0,
  rec: 3,
  heroHandSize: 6,
  alterEgoHandSize: 6,
  heroKeywords: [{ name: "retaliate", value: 1 }],
});

/** The second player's hero: the same stats, another card (a group may have one copy of each hero in play). */
const SPIKY_TWO: HeroIdentityCard = stubIdentity({
  id: "spiky-two",
  hp: 20,
  atk: 2,
  thw: 2,
  def: 0,
  rec: 3,
  heroHandSize: 6,
  alterEgoHandSize: 6,
});

const deps: EngineDeps = depsOf(
  PUT_SCHEMES,
  ATTACK_ON_THREAT,
  BOOST_THREAT,
  SCHEME_AFTER_DAMAGE,
  WATCHER_RESPONSE,
  SCHEMES_INSTEAD,
  HERO_STRIKES,
  STRIKE_BACK,
  ATTACK_OR_COUNTER,
  NESTED_ATTACK_OR_COUNTER,
  BRANCH_ATTACK,
  AMBUSH_REVEALED,
  REVEAL_AMBUSH,
  MINIONS_ATTACK,
  HEARS_VOID,
  PROVOKE,
  VILLAIN_HURT,
  SCHEME_AFTER_ATTACK,
  EACH_ENEMY_ATTACKS,
  CALL_A,
  CALL_B,
  TWO_ATTACKS,
  SCHEME_INSTEAD_ONCE,
  ATTACK_EACH,
);
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

function game(
  encounter: readonly CardId[],
  bossAbilities: readonly AbilityReference[] = [],
  playerCount: 1 | 2 = 1,
): GameState {
  const boss = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 1, sch: 2, abilities: [...bossAbilities] }] });
  const result = createGame(
    {
      seed: 5,
      cards: [
        ...DEFAULT_CARDS,
        SPIKY,
        SPIKY_TWO,
        boss,
        SCENARIO,
        SIDE,
        BLANK,
        THREAT_BOOST,
        WATCHER,
        PUNISHER,
        STRIKER,
        PUNISHING_LEADER,
        SWEEPER,
        NESTED_SWEEPER,
        BRANCH_SWEEPER,
        AMBUSH,
        REVEALER,
        VOID,
        VOID_WATCHER,
        PROVOKER,
        HURT_NOTER,
        AFTER_ATTACK_SCHEMER,
        GRUNT_A,
        GRUNT_B,
        SWARM,
        CALLER_A,
        CALLER_B,
        DOUBLER,
        DIVERTER,
        RAMPAGE,
      ],
      villainCardId: boss.id,
      villains: [{ villainCardId: boss.id, encounterDeck: encounter, signatureSideSchemeCardId: SIDE.id }],
      mainSchemeCardId: SCENARIO.id,
      encounterDeck: [],
      players: Array.from({ length: playerCount }, (_, i) => ({
        identityCardId: i === 0 ? SPIKY.id : SPIKY_TWO.id,
        deck: [
          ...DEFAULT_DECK,
          WATCHER.id,
          PUNISHER.id,
          STRIKER.id,
          PUNISHING_LEADER.id,
          SWEEPER.id,
          NESTED_SWEEPER.id,
          BRANCH_SWEEPER.id,
          REVEALER.id,
          VOID.id,
          VOID_WATCHER.id,
          PROVOKER.id,
          HURT_NOTER.id,
          AFTER_ATTACK_SCHEMER.id,
          SWARM.id,
          CALLER_A.id,
          CALLER_B.id,
          DOUBLER.id,
          DIVERTER.id,
          RAMPAGE.id,
        ],
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const indexOf = (events: readonly GameEvent[], predicate: (e: GameEvent) => boolean, from = 0) =>
  events.findIndex((e, i) => i >= from && predicate(e));

function playFree(state: GameState, cardId: CardId): GameState {
  const given = giveCard(state, p1, cardId);
  return runCommands(given.state, deps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  }).state;
}

const initiatedIndexes = (events: readonly GameEvent[], kind: "enemyAttack" | "enemyScheme", villain: string) =>
  events.flatMap((e, i) =>
    e.type === "triggerEvent" &&
    e.phase === "initiated" &&
    e.event.kind === kind &&
    "enemyInstanceId" in e.event &&
    e.event.enemyInstanceId === villain
      ? [i]
      : [],
  );

describe("RRG 1.8 'Activation' (p. 6); ruling 214 (Jun 13, 2024): an activation started mid-activation waits", () => {
  // The boost's placeThreat is answered by the side scheme's response, not a Boost ability: its attack still waits for
  // the boosted attack's Retaliate and responses (PR #410 owner review; it ran inside the boosted attack before).
  it("a Boost effect that another card's forced response answers with an attack: the new attack follows the boosted one's Retaliate and responses", () => {
    const start = runCommands(
      playFree(game([THREAT_BOOST.id, ...copies(BLANK.id, 11)]), WATCHER.id),
      deps,
      toHero,
    ).state;
    // Put the boost card on top: it is the first attack's boost card.
    const deck = activeEncounterDeck(start).deck;
    const boost = deck.find((id) => start.instances[id]?.cardId === THREAT_BOOST.id);
    if (!boost) throw new Error("no boost card");
    const topped = withEncounterPiles(start, { deck: [boost, ...deck.filter((id) => id !== boost)] });

    const { state, events } = runCommands(topped, deps, endTurn);
    const villain = activeVillain(state).instanceId;
    const attacks = initiatedIndexes(events, "enemyAttack", villain);
    expect(attacks).toHaveLength(2);
    const [first, second] = attacks as [number, number];
    const retaliate = indexOf(events, (e) => e.type === "damageDealt" && e.targetInstanceId === villain, first);
    const responded = indexOf(events, (e) => e.type === "counterAdded" && e.counterType === "sawAttack", first);
    const firstResolved = indexOf(events, (e) => e.type === "attackResolved" && e.enemyInstanceId === villain, first);
    expect(retaliate).toBeGreaterThan(first);
    expect(retaliate).toBeLessThan(second);
    expect(responded).toBeGreaterThan(first);
    expect(responded).toBeLessThan(second);
    expect(firstResolved).toBeGreaterThan(first);
    expect(firstResolved).toBeLessThan(second);
  });

  describe("a forced response (no Boost ability) that makes the villain scheme mid-attack", () => {
    const run = () => {
      const start = runCommands(
        playFree(playFree(game(copies(BLANK.id, 12)), WATCHER.id), PUNISHER.id),
        deps,
        toHero,
      ).state;
      const { state, events } = runCommands(start, deps, endTurn);
      const villain = activeVillain(state).instanceId;
      const attack = initiatedIndexes(events, "enemyAttack", villain)[0];
      if (attack === undefined) throw new Error("the villain did not attack");
      const scheme = initiatedIndexes(events, "enemyScheme", villain).find((i) => i > attack);
      if (scheme === undefined) throw new Error("the response did not make the villain scheme");
      return { events, villain, attack, scheme };
    };

    it("the scheme follows the attack's damage resolution and Retaliate", () => {
      const { events, villain, attack, scheme } = run();
      const retaliate = indexOf(events, (e) => e.type === "damageDealt" && e.targetInstanceId === villain, attack);
      const resolved = indexOf(events, (e) => e.type === "attackResolved" && e.enemyInstanceId === villain, attack);
      expect(resolved).toBeGreaterThan(attack);
      expect(resolved).toBeLessThan(scheme);
      expect(retaliate).toBeGreaterThan(attack);
      expect(retaliate).toBeLessThan(scheme);
    });

    // The scheme is initiated from the attack's response window: ruling Feb 28, 2026 (1) answer 2 puts an activation's
    // responses inside the activation, and RRG 1.8 p. 6 makes a newly initiated one wait for it to finish, so it
    // follows the attack's other forced response (the Watcher's). PR #410 owner review; it ran before it.
    it("the scheme follows the attack's other responses too (RRG 1.8 p. 6; ruling Feb 28, 2026 (1))", () => {
      const { events, attack, scheme } = run();
      const responded = indexOf(events, (e) => e.type === "counterAdded" && e.counterType === "sawAttack", attack);
      expect(responded).toBeGreaterThan(attack);
      expect(responded).toBeLessThan(scheme);
    });
  });
  // RRG 1.8 "Replacement Effect" (p. 36): the replaced attack never resolves, so there is no activation for the
  // scheme to wait behind (p. 6); a replaced activation also drops what it held (`pushEndEffects`).
  it("an activation that replaces the attack resolves now: the villain schemes instead of attacking", () => {
    const start = runCommands(game(copies(BLANK.id, 12), [SCHEMES_INSTEAD.ref]), deps, toHero).state;
    const { state, events } = runCommands(start, deps, endTurn);
    const villain = activeVillain(state).instanceId;
    expect(events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === villain)).toHaveLength(0);
    // The player is a hero, so the villain phase's one activation is an attack: this scheme is the one replacing it.
    expect(events.filter((e) => e.type === "schemeResolved" && e.enemyInstanceId === villain)).toHaveLength(1);
  });

  // A hero's attack made during the villain's attack sits above it on the stack; the villain's attack is still
  // resolving beneath it (its responses are part of it: ruling Feb 28, 2026 (1) answer 2), so an activation the hero's
  // attack sets off waits for the villain's attack to finish, not just for the hero's.
  it("an activation started from a hero's attack made during the villain's attack waits for the villain's attack", () => {
    const start = runCommands(
      playFree(playFree(game(copies(BLANK.id, 12)), STRIKER.id), PUNISHING_LEADER.id),
      deps,
      toHero,
    ).state;
    const { state, events } = runCommands(start, deps, endTurn);
    const villain = activeVillain(state).instanceId;
    const attacks = initiatedIndexes(events, "enemyAttack", villain);
    expect(attacks.length).toBeGreaterThanOrEqual(2);
    const [first, second] = attacks as [number, number];
    // The villain attack's response (the Striker's) finishes, its "Discard this card" included, before the new attack:
    // run at once, the new attack began inside the hero's attack's response window, before that discard.
    const strikerDone = indexOf(events, (e) => e.type === "cardDiscardedFromPlay", first);
    expect(strikerDone).toBeGreaterThan(first);
    expect(strikerDone).toBeLessThan(second);
    const heroAttack = indexOf(events, (e) => e.type === "triggerEvent" && e.event.kind === "attack", first);
    expect(heroAttack).toBeGreaterThan(first);
    expect(heroAttack).toBeLessThan(second);
  });

  // RRG 1.8 "Activation" (p. 6): "An effect that initiates an enemy activation is considered resolved after that
  // activation has fully resolved." The ability waits with its attack (`apply-effect.ts`, `suspendBehindActivation`), so
  // its later instructions read `sweep.made` once the attack is made (PR #410 owner review; they ran at once before and
  // placed the counter although the attack followed).
  //
  // Its attack deals damage too, so the Sweeper, still in play, answers it again: that second use waits behind the
  // second attack, and is handed back to the first attack's end once it ends, so the first use's "Discard this card"
  // resolves before the third attack (owner decision, 2026-10-28, reading A; `resolve/event.ts` `handBackSuspended`).
  it("the rest of the initiating ability waits for the queued activation: its bind reads the attack", () => {
    const start = runCommands(playFree(game(copies(BLANK.id, 12)), SWEEPER.id), deps, toHero).state;
    const { state, events } = runCommands(start, deps, endTurn);
    const villain = activeVillain(state).instanceId;
    const attacks = initiatedIndexes(events, "enemyAttack", villain);
    expect(attacks).toHaveLength(3);
    expect(events.some((e) => e.type === "counterAdded" && e.counterType === "noAttack")).toBe(false);
    // "Discard this card" is the ability's last instruction: after the attack it made has resolved, before the attack
    // its second use made.
    const secondResolved = indexOf(
      events,
      (e) => e.type === "attackResolved" && e.enemyInstanceId === villain,
      attacks[1],
    );
    const discarded = indexOf(events, (e) => e.type === "cardDiscardedFromPlay", attacks[0]);
    expect(secondResolved).toBeGreaterThan(attacks[1]!);
    expect(discarded).toBeGreaterThan(secondResolved);
    expect(discarded).toBeLessThan(attacks[2]!);
  });

  // The same, with the attack one sentence deep: the frames the initiating effect is nested in wait too, so the outer
  // list's later instructions (an `if` reading the bind the sentence handed back, then a counter) follow the attack.
  it("an attack initiated inside a sentence: the outer instructions after the sentence wait for it", () => {
    const start = runCommands(playFree(game(copies(BLANK.id, 12)), NESTED_SWEEPER.id), deps, toHero).state;
    const { state, events } = runCommands(start, deps, endTurn);
    const villain = activeVillain(state).instanceId;
    const attacks = initiatedIndexes(events, "enemyAttack", villain);
    expect(attacks).toHaveLength(2);
    expect(events.some((e) => e.type === "counterAdded" && e.counterType === "noAttack")).toBe(false);
    const secondResolved = indexOf(
      events,
      (e) => e.type === "attackResolved" && e.enemyInstanceId === villain,
      attacks[1],
    );
    const after = indexOf(events, (e) => e.type === "counterAdded" && e.counterType === "afterSentence");
    expect(secondResolved).toBeGreaterThan(attacks[1]!);
    expect(after).toBeGreaterThan(secondResolved);
  });

  // Nested in an `if` branch inside a `forEachPlayer` pass: the branch, the pass and the root all wait.
  it("an attack initiated inside an if inside a forEachPlayer pass: the root's later instruction waits for it", () => {
    const start = runCommands(playFree(game(copies(BLANK.id, 12)), BRANCH_SWEEPER.id), deps, toHero).state;
    const { state, events } = runCommands(start, deps, endTurn);
    const villain = activeVillain(state).instanceId;
    const attacks = initiatedIndexes(events, "enemyAttack", villain);
    expect(attacks).toHaveLength(2);
    const secondResolved = indexOf(
      events,
      (e) => e.type === "attackResolved" && e.enemyInstanceId === villain,
      attacks[1],
    );
    const after = indexOf(events, (e) => e.type === "counterAdded" && e.counterType === "afterBranch");
    expect(secondResolved).toBeGreaterThan(attacks[1]!);
    expect(after).toBeGreaterThan(secondResolved);
  });
  // A When Revealed that makes the villain attack mid-attack: the reveal waits with it (RRG 1.8 "Reveal", p. 38: the
  // card is discarded once its When Revealed abilities have resolved; p. 6: they resolve after that attack). So the
  // ability's later sentence follows the attack, and the treachery leaves the revealing player's area after that.
  it("a When Revealed initiating an attack mid-attack: its later sentence and the reveal's discard follow the attack", () => {
    const setUp = runCommands(playFree(game([...copies(BLANK.id, 12), AMBUSH.id]), REVEALER.id), deps, toHero).state;
    // The Ambush at the bottom of the deck, so no attack takes it as its boost card.
    const deck = activeEncounterDeck(setUp).deck;
    const ambush = deck.find((id) => setUp.instances[id]?.cardId === AMBUSH.id);
    if (!ambush) throw new Error("no ambush");
    const start = withEncounterPiles(setUp, { deck: [...deck.filter((id) => id !== ambush), ambush] });
    const { state, events } = runCommands(start, deps, endTurn);
    const villain = activeVillain(state).instanceId;
    const attacks = initiatedIndexes(events, "enemyAttack", villain);
    expect(attacks).toHaveLength(2);
    const secondResolved = indexOf(
      events,
      (e) => e.type === "attackResolved" && e.enemyInstanceId === villain,
      attacks[1],
    );
    const placed = indexOf(events, (e) => e.type === "threatPlaced" && e.sourceInstanceId === ambush);
    const discarded = indexOf(
      events,
      (e) => e.type === "cardMoved" && e.instanceId === ambush && e.from.kind === "dealtEncounter",
    );
    expect(secondResolved).toBeGreaterThan(attacks[1]!);
    expect(placed).toBeGreaterThan(secondResolved);
    expect(discarded).toBeGreaterThan(placed);
  });

  // RRG 1.8 "Resolve" (p. 37): an ability resolved only if its effects changed the game. One that waited behind the
  // attack and whose activation then found no enemy changed nothing, though the frames beneath it changed meanwhile.
  it("an ability that waited behind an attack and then changed nothing has not resolved", () => {
    const start = runCommands(
      playFree(playFree(game(copies(BLANK.id, 12)), VOID.id), VOID_WATCHER.id),
      deps,
      toHero,
    ).state;
    const { state, events } = runCommands(start, deps, endTurn);
    const villain = activeVillain(state).instanceId;
    expect(initiatedIndexes(events, "enemyAttack", villain)).toHaveLength(1);
    expect(events.some((e) => e.type === "abilityUseRecorded" && e.abilityId === MINIONS_ATTACK.ref.id)).toBe(true);
    expect(events.some((e) => e.type === "counterAdded" && e.counterType === "heard")).toBe(false);
  });

  // The initiating ability's activation is its last instruction, inside a sentence: what waited behind that attack
  // still waits for the ability to finish (owner decision, 2026-10-28, reading A; `resolve/suspend.ts`
  // `releaseWaitingAbilities`), so the responses the sentence held (to the Retaliate damage the villain took) resolve
  // first, as they do when the ability has more to resolve.
  it("an attack that is the ability's last instruction: the sentence's held responses resolve before what waited", () => {
    const ready = runCommands(
      playFree(playFree(game(copies(BLANK.id, 12)), HURT_NOTER.id), AFTER_ATTACK_SCHEMER.id),
      deps,
      toHero,
    ).state;
    const given = giveCard(ready, p1, PROVOKER.id);
    const placed = runCommands(given.state, deps, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    }).state;
    const { state, events } = runCommands(placed, deps, {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: given.id,
      abilityId: PROVOKE.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
      payment: [],
    });
    const villain = activeVillain(state).instanceId;
    const attack = initiatedIndexes(events, "enemyAttack", villain)[0];
    if (attack === undefined) throw new Error("the villain did not attack");
    const attackResolved = indexOf(events, (e) => e.type === "attackResolved" && e.enemyInstanceId === villain, attack);
    const held = indexOf(events, (e) => e.type === "counterAdded" && e.counterType === "held", attack);
    const scheme = initiatedIndexes(events, "enemyScheme", villain).find((i) => i > attack);
    expect(attackResolved).toBeGreaterThan(attack);
    expect(held).toBeGreaterThan(attackResolved);
    expect(scheme).toBeGreaterThan(held);
  });

  // RRG 1.8 "Activation" (p. 6): "If multiple enemies activate against you simultaneously, resolve the villain's
  // activation first (if any) in the order of your choice, followed by minion activations in the order of your choice";
  // ruling June 4, 2024 #202. One effect making every enemy attack mid-attack: it waits behind the attack, the villain
  // attacks first, then the two minions in the order chosen as the effect is initiated, by the first player (the
  // owner's design, docs/phase3-encounter-ai.md; whether p. 6's "you" makes it the attacked player's is open).
  describe("one effect makes the villain and two minions attack mid-attack: the first player orders the minions", () => {
    const run = (wanted: (a: string, b: string) => readonly string[]) => {
      let state = playFree(game([...copies(BLANK.id, 12), GRUNT_A.id, GRUNT_B.id]), SWARM.id);
      const a = minionEngagedWith(state, GRUNT_A.id, p1);
      const b = minionEngagedWith(a.state, GRUNT_B.id, p1);
      state = runCommands(b.state, deps, toHero).state;
      const asked: PendingChoice[] = [];
      const pick = (s: GameState): readonly string[] => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind !== "orderEnemies") return defaultPick(s);
        asked.push(choice);
        return wanted(a.id, b.id);
      };
      const { state: after, events } = runCommandsPicking(state, deps, pick, endTurn);
      const villain = activeVillain(after).instanceId;
      const attackers = events.flatMap((e, i) =>
        e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "enemyAttack"
          ? [{ i, enemy: e.event.enemyInstanceId }]
          : [],
      );
      const firstResolved = indexOf(events, (e) => e.type === "attackResolved" && e.enemyInstanceId === villain);
      return { a: a.id, b: b.id, villain, asked, attackers, firstResolved };
    };

    it.each([
      ["A then B", (a: string, b: string) => [a, b]],
      ["B then A", (a: string, b: string) => [b, a]],
    ])("%s: the villain first, then the minions in the chosen order", (_, wanted) => {
      const { a, b, villain, asked, attackers, firstResolved } = run(wanted);
      // Asked once, of the first player, among the minions only.
      expect(asked).toHaveLength(1);
      expect(asked[0]!.playerId).toBe(p1);
      expect(asked[0]!.authority).toBe("firstPlayerOrders");
      expect([...asked[0]!.options.map((o) => o.optionId)].sort()).toEqual([a, b].sort());
      // The phase's attack, then (after it has resolved) the villain's, then the two minions as chosen.
      const order = wanted(a, b);
      expect(attackers.slice(0, 4).map((x) => x.enemy)).toEqual([villain, villain, ...order]);
      expect(firstResolved).toBeLessThan(attackers[1]!.i);
    });
  });

  // Two cards each making one enemy attack in answer to the same damage are two effects: sequential, not
  // simultaneous, so no enemy order is asked (the first player orders the two responses, RRG 1.8 p. 19).
  it("two responses each making a minion attack mid-attack: sequential, no enemy-ordering choice", () => {
    let state = playFree(playFree(game([...copies(BLANK.id, 12), GRUNT_A.id, GRUNT_B.id]), CALLER_A.id), CALLER_B.id);
    const a = minionEngagedWith(state, GRUNT_A.id, p1);
    const b = minionEngagedWith(a.state, GRUNT_B.id, p1);
    state = runCommands(b.state, deps, toHero).state;
    const prompts: string[] = [];
    const pick = (s: GameState): readonly string[] => {
      prompts.push(s.pendingChoice!.prompt.kind);
      return defaultPick(s);
    };
    const { state: after, events } = runCommandsPicking(state, deps, pick, endTurn);
    const villain = activeVillain(after).instanceId;
    expect(prompts).not.toContain("orderEnemies");
    const attackers = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "enemyAttack"
        ? [e.event.enemyInstanceId]
        : [],
    );
    // The phase's attack, then each response's minion, one after the other.
    expect(attackers[0]).toBe(villain);
    expect([...attackers.slice(1, 3)].sort()).toEqual([a.id, b.id].sort());
  });

  // RRG 1.8 "Replacement Effect" (p. 36), nested: an attack that was itself queued behind an activation and is then
  // replaced resolves its replacement in its place, before the next queued attack, not behind the outer activation.
  it("a queued attack that is replaced: its replacement scheme resolves in its place, before the next queued attack", () => {
    const start = playFree(playFree(game(copies(BLANK.id, 12)), DOUBLER.id), DIVERTER.id);
    // In alter-ego form the villain phase's activation is a scheme: the Doubler queues two attacks behind it.
    const { state, events } = runCommands(start, deps, endTurn);
    const villain = activeVillain(state).instanceId;
    const schemes = events.flatMap((e, i) => (e.type === "schemeResolved" && e.enemyInstanceId === villain ? [i] : []));
    const attacks = events.flatMap((e, i) => (e.type === "attackResolved" && e.enemyInstanceId === villain ? [i] : []));
    // The phase's scheme, then the one replacing the first queued attack; the second queued attack is made. The Doubler
    // is still in play as the replacing scheme resolves (its ability has not finished, RRG 1.8 p. 6), so it answers that
    // scheme too: its two attacks follow the first use's second one (reading A, `handBackSuspended`).
    expect(schemes).toHaveLength(2);
    expect(attacks).toHaveLength(3);
    expect(schemes[1]).toBeLessThan(attacks[0]!);
  });

  // The queued activation keeps the scope of the effect that initiated it (`DeferredEffects` scopedPlayerId / event):
  // "it attacks each player" queued behind the scheme still names each player as "that player" (Juggernaut 40121b).
  it("an 'attacks each player' started during a scheme waits for it and still attacks each player", () => {
    const p2 = playerId("p2");
    const start = playFree(game(copies(BLANK.id, 12), [], 2), RAMPAGE.id);
    const { state, events } = runCommands(start, deps, endTurn, { type: "endTurn", playerId: p2 });
    const villain = activeVillain(state).instanceId;
    const attacked = events.flatMap((e) =>
      e.type === "triggerEvent" &&
      e.phase === "initiated" &&
      e.event.kind === "enemyAttack" &&
      e.event.enemyInstanceId === villain
        ? [e.event.attackedPlayerId]
        : [],
    );
    expect(attacked).toEqual([p1, p2]);
    // Both wait for the first scheme (against p1) to finish, and the Rampage's "Discard this card" waits for both
    // (RRG 1.8 p. 6: the ability resolves after the activations it initiated).
    const [firstAttack, secondAttack] = initiatedIndexes(events, "enemyAttack", villain) as [number, number];
    const firstScheme = indexOf(events, (e) => e.type === "schemeResolved" && e.enemyInstanceId === villain);
    expect(firstScheme).toBeGreaterThan(0);
    expect(firstScheme).toBeLessThan(firstAttack);
    const secondResolved = indexOf(
      events,
      (e) => e.type === "attackResolved" && e.enemyInstanceId === villain,
      secondAttack,
    );
    const discarded = indexOf(events, (e) => e.type === "cardDiscardedFromPlay");
    expect(secondResolved).toBeGreaterThan(secondAttack);
    expect(discarded).toBeGreaterThan(secondResolved);
  });
});
