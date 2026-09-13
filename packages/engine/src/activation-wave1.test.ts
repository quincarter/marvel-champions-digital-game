/**
 * docs/phase7-wave1.md §3.6: enemy activations — replacement, redirected threat, boost suppression, queued attacks,
 * excess damage and attacks against a chosen character — proven with synthetic cards.
 *
 * Sources: Green Goblin insert ("no attack activation was performed"); RRG 1.8 "Activation" (p. 6), "Attack (Enemy
 * Activation)" (pp. 8–9), "Scheme (Enemy Activation)" (p. 38), "Replacement Effect" (p. 37), "Excess Damage" (p. 19);
 * rulings Feb 28, 2026 (1) answer 2 and (6); Jan 26, 2026 (3); FAQ "Clash of Titans (#28)" (p. 60).
 */

import { flat, type AbilityReference, type CardId, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, activeVillain, mustInstance, mustPlayer } from "./query.js";
import { resolveRef } from "./select.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import { stubIdentity, stubMainScheme, stubSideScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { ALLY, DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCard, giveCards, HERO, payFor, RESOURCE, withEncounterPiles } from "./testing/scenario.js";
import { auditVillainPhases } from "./villain/audit.js";

const p1 = playerId("p1");
const one = { kind: "const", value: 1 } as const;
const self = { kind: "self" } as const;
const theVillain = { kind: "villain" } as const;
const you = { kind: "controller" } as const;

// A scenario whose setup puts the villain's signature side scheme into play (Breakout 1A's shape).
const PUT_SCHEMES = stubAbility("scenario.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "signature", cards: { kind: "encounterSetAside" } },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "signature" }, controller: { kind: "firstPlayer" } },
  ],
});
const SCENARIO = stubMainScheme({
  id: "scenario",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [PUT_SCHEMES.ref] }],
});
/** "Forced Response: After threat is placed here, …", observable as a counter. */
const PLACED_HERE = stubAbility("signature.placed-here", {
  trigger: { kind: "response", forced: true, on: { on: "placeThreat", selfIs: "target" } },
  effects: [{ kind: "addCounters", target: self, counterType: "placedHere", amount: one }],
});
const SIGNATURE = stubSideScheme({ id: "signature", startingThreat: 1, boostIcons: 0, abilities: [PLACED_HERE.ref] });

/** "When Wrecker schemes, place the threat on his side scheme instead of the main scheme." (constant) */
const OWN_SCHEME = stubAbility("boss.own-scheme", {
  trigger: { kind: "constant", rules: [{ kind: "schemeThreatDestination", enemy: { self: true }, scheme: "ownSignatureSideScheme" }] },
  effects: [],
});
/** "Forced Interrupt: When [this villain] would attack, … instead." */
const REPLACE_ATTACK = stubAbility("boss.replace-attack", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
  effects: [{ kind: "replaceTriggeringEvent", with: [{ kind: "addCounters", target: self, counterType: "replaced", amount: one }] }],
});
/** "Excess damage dealt by [this villain] is placed as threat on his corresponding side scheme." (Radioactive Buildup's shape) */
const EXCESS_AS_THREAT = stubAbility("boss.excess-as-threat", {
  trigger: { kind: "response", forced: true, on: { on: "enemyAttack", selfIs: "source", requireResults: { excessDealt: 1 } } },
  effects: [{ kind: "placeThreat", target: { kind: "signatureSideSchemeOf", villain: self }, amount: { kind: "eventResult", key: "excessDealt" } }],
});

/** "After the villain attacks, …": a response that a replaced attack must not see. */
const WATCHER_RESPONSE = stubAbility("watcher.response", {
  trigger: { kind: "response", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
  effects: [{ kind: "addCounters", target: self, counterType: "sawAttack", amount: one }],
});
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [WATCHER_RESPONSE.ref] });

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
/** I See You's shape: "When Revealed: The villain attacks you. Do not give the villain a boost card for this activation." */
const NO_BOOST_ATTACK = stubAbility("no-boost.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "enemyAttack", enemies: theVillain, against: you, boost: false }],
});
const NO_BOOST = stubTreachery({ id: "no-boost", boostIcons: 0, abilities: [NO_BOOST_ATTACK.ref] });
/** Escaped Convict's boost shape: "Boost: The villain attacks you after this attack." */
const QUEUE_ATTACK = stubAbility("queue.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "enemyAttack", enemies: theVillain, against: you, after: "currentActivation" }],
});
const QUEUE = stubTreachery({ id: "queue", boostIcons: 0, abilities: [QUEUE_ATTACK.ref] });
/** Clash of the Titans' shape: "The villain attacks the ally with …" (an ally, chosen by the ref). */
const AT_ALLY_ATTACK = stubAbility("at-ally.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "enemyAttack", enemies: theVillain, targetCharacter: { kind: "each", query: { categories: ["ally"] } } }],
});
const AT_ALLY = stubTreachery({ id: "at-ally", boostIcons: 0, abilities: [AT_ALLY_ATTACK.ref] });

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

const deps: EngineDeps = depsOf(PUT_SCHEMES, PLACED_HERE, OWN_SCHEME, REPLACE_ATTACK, EXCESS_AS_THREAT, WATCHER_RESPONSE, NO_BOOST_ATTACK, QUEUE_ATTACK, AT_ALLY_ATTACK);
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

interface Options {
  readonly atk?: number;
  readonly sch?: number;
  readonly abilities?: readonly AbilityReference[];
  readonly encounter?: readonly CardId[];
  readonly identity?: HeroIdentityCard;
}

/** p1's first turn in a one-villain game with a signature side scheme in play. */
function game(options: Options = {}): GameState {
  const boss = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: options.atk ?? 2, sch: options.sch ?? 2, abilities: [...(options.abilities ?? [])] }] });
  const identity = options.identity ?? HERO;
  const encounter = options.encounter ?? copies(BLANK.id, 12);
  const result = createGame(
    {
      seed: 5,
      cards: [...DEFAULT_CARDS, SPIKY, boss, SCENARIO, SIGNATURE, BLANK, NO_BOOST, QUEUE, AT_ALLY, WATCHER],
      villainCardId: boss.id,
      villains: [{ villainCardId: boss.id, encounterDeck: encounter, signatureSideSchemeCardId: SIGNATURE.id }],
      mainSchemeCardId: SCENARIO.id,
      encounterDeck: [],
      players: [{ identityCardId: identity.id, deck: [...DEFAULT_DECK, WATCHER.id] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const villainId = (state: GameState) => activeVillain(state).instanceId;
const signatureId = (state: GameState) => activeVillain(state).signatureSideSchemeId as InstanceId;
const identity = (state: GameState) => mustInstance(state, mustPlayer(state, p1).identity.instanceId);
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) => events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const indexOf = (events: readonly GameEvent[], predicate: (e: GameEvent) => boolean, from = 0) => events.findIndex((e, i) => i >= from && predicate(e));

function playFree(state: GameState, cardId: CardId) {
  const given = giveCard(state, p1, cardId);
  return runCommands(given.state, deps, { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null });
}

function withAllyInPlay(state: GameState): { readonly state: GameState; readonly ally: InstanceId } {
  const given = giveCards(state, p1, ALLY.id, RESOURCE.id, RESOURCE.id);
  const [ally] = given.ids as [InstanceId];
  const played = runCommands(given.state, deps, { type: "playCard", playerId: p1, cardInstanceId: ally, payment: payFor(given.state, p1, 2), attachToInstanceId: null });
  return { state: played.state, ally };
}

describe("§3.6 enemy activations", () => {
  it("a 'would attack … instead' replacement: the attack is not performed, so no boost card and nothing responds to it", () => {
    const watching = runCommands(playFree(game({ abilities: [REPLACE_ATTACK.ref] }), WATCHER.id).state, deps, toHero).state;
    const watcher = mustPlayer(watching, p1).playArea.find((id) => watching.instances[id]?.cardId === WATCHER.id) as InstanceId;
    const { state, events } = runCommands(watching, deps, endTurn);
    expect(mustInstance(state, villainId(state)).counters.replaced).toBe(1);
    expect(mustInstance(state, watcher).counters.sawAttack).toBeUndefined();
    expect(ofType(events, "boostCardDealt").filter((e) => e.enemyInstanceId === villainId(state))).toEqual([]);
    expect(identity(state).damage).toBe(0);
    // The stun-first half is FAQ "Norman Osborn (#1A)" in flip.test.ts.

    // Control: without the replacement the same response sees the attack.
    const control = runCommands(runCommands(playFree(game(), WATCHER.id).state, deps, toHero).state, deps, endTurn).state;
    const controlWatcher = mustPlayer(control, p1).playArea.find((id) => control.instances[id]?.cardId === WATCHER.id) as InstanceId;
    expect(mustInstance(control, controlWatcher).counters.sawAttack).toBe(1);
  });

  it("a villain whose constant redirects its threat schemes onto its signature side scheme, and 'after threat is placed here' fires there", () => {
    const start = game({ abilities: [OWN_SCHEME.ref], sch: 2 });
    const scheme = signatureId(start);
    const before = mustInstance(start, scheme);
    const { state } = runCommands(start, deps, endTurn);
    expect(mustInstance(state, scheme).threat).toBe(before.threat + 2);
    expect(mustInstance(state, scheme).counters.placedHere).toBe((before.counters.placedHere ?? 0) + 1);
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(0);

    const context = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps };
    expect(resolveRef(state, { kind: "villainOfSideScheme", scheme: { kind: "named", name: SIGNATURE.name } }, context)).toEqual([villainId(state)]);
    expect(resolveRef(state, { kind: "signatureSideSchemeOf", villain: theVillain }, context)).toEqual([scheme]);
  });

  it("an attack that 'does not get a boost card' deals none, and the villain audit accepts it", () => {
    const { state, events, session } = runCommands(game({ encounter: copies(NO_BOOST.id, 12) }), deps, endTurn);
    const villain = villainId(state);
    // Step 2 is a scheme (alter-ego) with its boost card; step 4's treachery attack gets none.
    expect(ofType(events, "boostCardDealt").filter((e) => e.enemyInstanceId === villain)).toHaveLength(1);
    expect(ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === villain)).toEqual([expect.objectContaining({ boostIcons: 0, damageDealt: 2 })]);
    expect(identity(state).damage).toBe(2);
    expect(auditVillainPhases(session.log, deps).violations).toEqual([]);
  });

  it("an attack queued 'after this attack' starts only after the first attack's Retaliate and responses", () => {
    const start = runCommands(playFree(game({ identity: SPIKY, atk: 1, encounter: [QUEUE.id, ...copies(BLANK.id, 11)] }), WATCHER.id).state, deps, toHero).state;
    const deck = activeEncounterDeck(start).deck;
    const queue = deck.find((id) => start.instances[id]?.cardId === QUEUE.id);
    if (!queue) throw new Error("no queue card");
    // The Escaped-Convict-shaped card on top is the first attack's boost card.
    const primed = withEncounterPiles(start, { deck: [queue, ...deck.filter((id) => id !== queue)] });

    const { state, events, session } = runCommands(primed, deps, endTurn);
    const villain = villainId(state);
    const initiated = events.flatMap((e, i) =>
      e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "enemyAttack" && e.event.enemyInstanceId === villain ? [i] : [],
    );
    expect(initiated).toHaveLength(2);
    const [first, second] = initiated as [number, number];
    const retaliate = indexOf(events, (e) => e.type === "damageDealt" && e.targetInstanceId === villain, first);
    const responded = indexOf(events, (e) => e.type === "counterAdded" && e.counterType === "sawAttack", first);
    expect(retaliate).toBeGreaterThan(first);
    expect(retaliate).toBeLessThan(second);
    expect(responded).toBeGreaterThan(first);
    expect(responded).toBeLessThan(second);
    expect(ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === villain)).toHaveLength(2);
    expect(mustInstance(state, villain).damage).toBe(2);
    expect(identity(state).damage).toBe(2);
    expect(auditVillainPhases(session.log, deps).violations).toEqual([]);
  });

  it("excess damage dealt to a defending ally is reported as `excessDealt` and becomes threat on the villain's side scheme", () => {
    const hero = runCommands(game({ atk: 5, abilities: [EXCESS_AS_THREAT.ref] }), deps, toHero).state;
    const { state: withAlly, ally } = withAllyInPlay(hero);
    const scheme = signatureId(withAlly);
    const threatBefore = mustInstance(withAlly, scheme).threat;
    const pickAlly = (s: GameState): readonly string[] => (s.pendingChoice?.prompt.kind === "declareDefender" ? [ally] : defaultPick(s));

    const { state, events } = runCommandsPicking(withAlly, deps, pickAlly, endTurn);
    const villain = villainId(state);
    expect(ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === villain)).toEqual([expect.objectContaining({ targetInstanceId: ally, damageDealt: 5 })]);
    expect(mustPlayer(state, p1).playArea).not.toContain(ally);
    // 5 damage against 3 remaining hit points: 2 excess.
    expect(mustInstance(state, scheme).threat).toBe(threatBefore + 2);
    // RRG 1.8 "Attack (Enemy Activation)" step 5: a defeated ally's extra damage does not carry over to the identity.
    expect(identity(state).damage).toBe(0);
  });

  it("FAQ Clash of Titans (#28): an undefended attack against an ally deals all of its damage to the ally", () => {
    const { state: withAlly, ally } = withAllyInPlay(game({ encounter: copies(AT_ALLY.id, 12) }));
    const { state, events } = runCommands(withAlly, deps, endTurn);
    const villain = villainId(state);
    expect(ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === villain)).toEqual([expect.objectContaining({ targetInstanceId: ally, damageDealt: 2 })]);
    expect(mustInstance(state, ally).damage).toBe(2);
    expect(identity(state).damage).toBe(0);
  });
});
