/**
 * docs/phase7-wave1.md §3.11: new trigger events and rules, one test each, proven with synthetic cards.
 *
 * Sources: RRG 1.8 "Engage" (p. 18), "Surge" (p. 42), "Resolve" (p. 37), "Activation" (p. 6), "'Cannot'" (p. 11);
 * rulings Jan 17, 2026 (3) answer 2 (keywords before triggered abilities), Feb 28, 2026 (2), Aug 3, 2026 (3),
 * Apr 30, 2026 (3) answer 4; FAQ "Nova (#12)" (p. 59).
 */

import { flat, trait, type AbilityReference, type AnyCard, type CardId, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, AbilityTriggerSpec, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { keywordsOf } from "./keywords.js";
import { activeEncounterDeck, activeVillain, characterProfile, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAttachment, stubEvent, stubIdentity, stubMainScheme, stubMinion, stubSideScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_DECK, giveCard, HERO, newGame, withEncounterPiles } from "./testing/scenario.js";

const p1 = playerId("p1");
const one = { kind: "const", value: 1 } as const;
const self = { kind: "self" } as const;
const PREPARATION = trait("Preparation");
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const abilities: StubAbility[] = [];
const ability = (id: string, definition: AbilityDefinition): AbilityReference => {
  const stub = stubAbility(id, definition);
  abilities.push(stub);
  return stub.ref;
};
const mark = (counterType: string, target: EffectSpec extends { target: infer T } ? T : never = self as never): EffectSpec =>
  ({ kind: "addCounters", target, counterType, amount: one }) as EffectSpec;
const rules = (id: string, ...list: readonly RuleSpec[]): AbilityReference => ability(id, { trigger: { kind: "constant", rules: list }, effects: [] });
const forced = (id: string, kind: "interrupt" | "response", on: Extract<AbilityTriggerSpec, { kind: "response" }>["on"], effects: readonly EffectSpec[]): AbilityReference =>
  ability(id, { trigger: { kind, forced: true, on }, effects });

const VILLAIN = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({ id: "calm", stages: [{ startingThreat: flat(3), targetThreat: flat(50), acceleration: flat(0) }] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

// Trigger events.
const ENGAGE_WATCH = stubSupport({ id: "engage-watch", cost: 0, abilities: [forced("engage-watch.response", "response", { on: "minionEngaged", playerIs: "controller" }, [mark("engaged")])] });
const QUICK = stubMinion({ id: "quick", atk: 1, sch: 0, hp: 3, boostIcons: 0, keywords: [{ name: "quickstrike" }] });
const HULK: HeroIdentityCard = stubIdentity({
  id: "hulk",
  hp: 15,
  atk: 2,
  thw: 1,
  def: 1,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 5,
  heroAbilities: [
    forced("hulk.enraged", "interrupt", { on: "turnEnding", playerIs: "controller" }, [
      { kind: "discardFromHand", player: { kind: "controller" }, amount: { kind: "handCount", player: { kind: "controller" } }, random: true },
    ]),
  ],
});
const SURGER = stubTreachery({ id: "surger", boostIcons: 0, keywords: [{ name: "surge" }] });
const SURGE_DRAW = stubSupport({ id: "surge-draw", cost: 0, abilities: [forced("surge-draw.interrupt", "interrupt", { on: "surgeResolving", playerIs: "controller" }, [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 2 } }])] });
const SURGE_STOP = stubSupport({ id: "surge-stop", cost: 0, abilities: [forced("surge-stop.interrupt", "interrupt", { on: "surgeResolving" }, [{ kind: "cancelTriggeringEvent" }])] });
const identityMark = (counterType: string): EffectSpec => ({ kind: "addCounters", target: { kind: "identityOf", player: { kind: "controller" } }, counterType, amount: one });
const PREP: AnyCard = { ...stubEvent({ id: "prep", cost: 0, abilities: [ability("prep.action", { trigger: { kind: "action" }, effects: [identityMark("prep")] })] }), traits: [PREPARATION] };
const PLAIN = stubEvent({ id: "plain", cost: 0, abilities: [ability("plain.action", { trigger: { kind: "action" }, effects: [identityMark("plain")] })] });
const RESOLVE_WATCH = stubSupport({
  id: "resolve-watch",
  cost: 0,
  abilities: [forced("resolve-watch.response", "response", { on: "abilityResolved", playerIs: "controller", sourceIs: { trait: PREPARATION } }, [mark("resolvedPrep")])],
});
const NOVA = stubSupport({
  id: "nova",
  cost: 0,
  abilities: [
    forced("nova.interrupt", "interrupt", { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true, sourceIs: { categories: ["minion"] } }, [
      { kind: "dealDamage", target: { kind: "eventSource" }, amount: { kind: "const", value: 5 } },
    ]),
  ],
});
const GRUNT = stubMinion({ id: "grunt", atk: 2, sch: 0, hp: 3, boostIcons: 0 });

// Rules.
const ZEMO = stubMinion({ id: "zemo", atk: 0, sch: 0, hp: 5, boostIcons: 0, abilities: [rules("zemo.rule", { kind: "cannotThwart", player: { kind: "engagedWith", of: self } })] });
const BOUND = stubSupport({ id: "bound", cost: 0, abilities: [rules("bound.rule", { kind: "cannotReady", target: { categories: ["identity"], controller: "you" } })] });
const TIED = stubSupport({ id: "tied", cost: 0, abilities: [rules("tied.rule", { kind: "cannotChangeForm", player: { kind: "controller" } })] });
const TAUNT = stubSupport({ id: "taunt", cost: 0, abilities: [rules("taunt.rule", { kind: "cannotAttack", target: { categories: ["minion"] } })] });
const HOSTAGE = stubSideScheme({ id: "hostage", startingThreat: 3, boostIcons: 0, abilities: [rules("hostage.rule", { kind: "threatCannotBeRemoved", target: { self: true }, by: "thwart" })] });
const REMOVE_ONE = stubEvent({
  id: "remove-one",
  cost: 0,
  abilities: [ability("remove-one.action", { trigger: { kind: "action" }, effects: [{ kind: "removeThreat", target: { kind: "each", query: { categories: ["sideScheme"] } }, amount: one }] })],
});
const ROBOT = stubMinion({
  id: "robot",
  atk: 0,
  sch: 0,
  hp: 6,
  boostIcons: 0,
  keywords: [{ name: "retaliate", value: 1 }],
  abilities: [rules("robot.rule", { kind: "cannotTakeDamage", target: { self: true } })],
});
const PLATING = stubAttachment({ id: "plating", attachesTo: { kind: "minion" }, statModifiers: { hp: 2 } });
const BLANK_IT = stubEvent({
  id: "blank-it",
  cost: 0,
  abilities: [ability("blank-it.action", { trigger: { kind: "action" }, effects: [{ kind: "blankTextBox", target: { kind: "each", query: { categories: ["minion"] } }, until: "endOfPhase" }] })],
});
const COVERAGE = stubAttachment({ id: "coverage", attachesTo: { kind: "hero" }, abilities: [rules("coverage.rule", { kind: "repeatWhenRevealed", player: { kind: "controller" }, times: 1 })] });
const REVEALED = stubTreachery({ id: "revealed", boostIcons: 0, abilities: [ability("revealed.when-revealed", { trigger: { kind: "whenRevealed" }, effects: [identityMark("seen")] })] });

const PLAYER_CARDS: readonly AnyCard[] = [ENGAGE_WATCH, SURGE_DRAW, SURGE_STOP, PREP, PLAIN, RESOLVE_WATCH, NOVA, BOUND, TIED, TAUNT, REMOVE_ONE, BLANK_IT];
const ENCOUNTER_CARDS: readonly AnyCard[] = [BLANK, QUICK, SURGER, GRUNT, ZEMO, HOSTAGE, ROBOT, PLATING, COVERAGE, REVEALED];
const deps: EngineDeps = depsOf(...abilities);

function game(options: { readonly identity?: HeroIdentityCard; readonly top?: readonly AnyCard[] } = {}): GameState {
  const start = newGame({
    identity: options.identity ?? HERO,
    villain: VILLAIN,
    mainScheme: SCHEME,
    deps,
    extraCards: [HULK, ...PLAYER_CARDS, ...ENCOUNTER_CARDS],
    encounterDeck: [...ENCOUNTER_CARDS.map((card) => card.id), ...copies(BLANK.id, 10)],
    deck: [...DEFAULT_DECK, ...PLAYER_CARDS.flatMap((card) => copies(card.id, 2))],
  });
  if (!options.top) return start;
  // Test surgery: these cards on top of the encounter deck, in order.
  const deck = activeEncounterDeck(start).deck;
  const taken: InstanceId[] = [];
  for (const card of options.top) {
    const id = deck.find((candidate) => start.instances[candidate]?.cardId === card.id && !taken.includes(candidate));
    if (!id) throw new Error(`no ${card.id} in the encounter deck`);
    taken.push(id);
  }
  return withEncounterPiles(start, { deck: [...taken, ...deck.filter((id) => !taken.includes(id))] });
}

/** Test surgery: an encounter card from the deck into p1's area (a minion engaged, a scheme in the villain area). */
function encounterInPlay(state: GameState, card: AnyCard, threat = 0): { readonly state: GameState; readonly id: InstanceId } {
  const [deckId] = state.encounterDeckOrder;
  const piles = state.encounterDecks[deckId ?? ""];
  const id = piles?.deck.find((candidate) => state.instances[candidate]?.cardId === card.id);
  if (!deckId || !piles || !id) throw new Error(`no ${card.id}`);
  const scheme = card.type === "side_scheme";
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
      villainArea: scheme ? [...state.villainArea, id] : state.villainArea,
      players: state.players.map((p) => (!scheme && p.playerId === p1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: { ...mustInstance(state, id), faceup: true, threat, engagedWith: scheme ? null : p1 } },
    },
  };
}

/** Test surgery: `attachment` from the encounter deck attached to `host`. */
function attachTo(state: GameState, attachment: AnyCard, host: InstanceId): GameState {
  const pulled = encounterInPlay(state, attachment);
  const s = { ...pulled.state, players: pulled.state.players.map((p) => ({ ...p, playArea: p.playArea.filter((x) => x !== pulled.id) })) };
  return {
    ...s,
    instances: {
      ...s.instances,
      [host]: { ...mustInstance(s, host), attachments: [...mustInstance(s, host).attachments, pulled.id] },
      [pulled.id]: { ...mustInstance(s, pulled.id), attachedTo: host, engagedWith: null },
    },
  };
}

function play(state: GameState, card: AnyCard, player: PlayerId = p1) {
  const given = giveCard(state, player, card.id);
  return runCommands(given.state, deps, { type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null });
}
const inPlay = (state: GameState, card: AnyCard): InstanceId => mustPlayer(state, p1).playArea.find((id) => state.instances[id]?.cardId === card.id) as InstanceId;
const identity = (state: GameState) => mustInstance(state, mustPlayer(state, p1).identity.instanceId);
const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const indexOf = (events: readonly GameEvent[], predicate: (e: GameEvent) => boolean, from = 0) => events.findIndex((e, i) => i >= from && predicate(e));

describe("§3.11 new trigger events", () => {
  it("'After you engage a minion' resolves after the minion's quickstrike (keywords first)", () => {
    const watching = play(game({ top: [BLANK, QUICK] }), ENGAGE_WATCH).state;
    const { state, events } = runCommands(runCommands(watching, deps, toHero).state, deps, endTurn);
    const quick = indexOf(events, (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "enemyAttack" && state.instances[e.event.enemyInstanceId]?.cardId === QUICK.id);
    const engaged = indexOf(events, (e) => e.type === "counterAdded" && e.counterType === "engaged");
    expect(quick).toBeGreaterThanOrEqual(0);
    expect(engaged).toBeGreaterThan(quick);
    expect(mustInstance(state, inPlay(state, ENGAGE_WATCH)).counters.engaged).toBe(1);
  });

  it("'When your turn ends' interrupts the end of the turn", () => {
    const hero = runCommands(game({ identity: HULK }), deps, toHero).state;
    const handSize = mustPlayer(hero, p1).hand.length;
    const { events } = runCommands(hero, deps, endTurn);
    const ended = indexOf(events, (e) => e.type === "turnEnded");
    const discards = events.flatMap((e, i) => (e.type === "cardDiscardedFromHand" && i < ended ? [i] : []));
    expect(handSize).toBeGreaterThan(0);
    expect(discards).toHaveLength(handSize);
  });

  it("'When the surge keyword … would be resolved' gets a window before the extra card, and can cancel it", () => {
    const drawing = play(game({ top: [BLANK, SURGER] }), SURGE_DRAW).state;
    const { events } = runCommands(drawing, deps, endTurn);
    const first = indexOf(events, (e) => e.type === "encounterCardRevealed");
    const second = indexOf(events, (e) => e.type === "encounterCardRevealed", first + 1);
    const draws = events.flatMap((e, i) => (e.type === "cardDrawn" && i > first && i < second ? [i] : []));
    expect(draws).toHaveLength(2);
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(true);

    const cancelled = runCommands(play(game({ top: [BLANK, SURGER] }), SURGE_STOP).state, deps, endTurn).events;
    expect(cancelled.some((e) => e.type === "surgeTriggered")).toBe(false);
    expect(cancelled.filter((e) => e.type === "encounterCardRevealed")).toHaveLength(1);
  });

  it("'After you resolve the ability of a Preparation card' follows that ability's effects", () => {
    const watching = play(game(), RESOLVE_WATCH).state;
    const { state, events } = play(watching, PREP);
    const watch = inPlay(state, RESOLVE_WATCH);
    expect(mustInstance(state, watch).counters.resolvedPrep).toBe(1);
    expect(indexOf(events, (e) => e.type === "counterAdded" && e.counterType === "prep")).toBeLessThan(indexOf(events, (e) => e.type === "counterAdded" && e.counterType === "resolvedPrep"));
    expect(mustInstance(play(state, PLAIN).state, watch).counters.resolvedPrep).toBe(1);
  });

  it("FAQ 'Nova (#12)': defeating the attacker when it initiates an attack against you ends that attack", () => {
    const withNova = play(game(), NOVA).state;
    const grunt = encounterInPlay(withNova, GRUNT);
    const { state, events } = runCommands(runCommands(grunt.state, deps, toHero).state, deps, endTurn);
    expect(events).toContainEqual({ type: "activationSkipped", enemyInstanceId: grunt.id, activation: "attack", reason: "leftPlay" });
    expect(events.some((e) => e.type === "attackResolved" && e.enemyInstanceId === grunt.id)).toBe(false);
    expect(mustPlayer(state, p1).playArea).not.toContain(grunt.id);
  });
});

describe("§3.11 rules", () => {
  it("'While Baron Zemo is engaged with you, you cannot thwart'", () => {
    const hero = runCommands(game(), deps, toHero).state;
    const thwart: Command = { type: "basicThwart", playerId: p1, thwarterInstanceId: identity(hero).instanceId, schemeInstanceId: hero.mainScheme.instanceId };
    expect(applyCommand(hero, thwart, deps).ok).toBe(true);
    expect(applyCommand(encounterInPlay(hero, ZEMO).state, thwart, deps)).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
  });

  it("'cannot ready': the identity stays exhausted through the end of the player phase", () => {
    const bound = play(game(), BOUND).state;
    const exhausted = runCommands(runCommands(bound, deps, toHero).state, deps, { type: "basicAttack", playerId: p1, attackerInstanceId: identity(bound).instanceId, targetInstanceId: activeVillain(bound).instanceId }).state;
    expect(identity(exhausted).exhausted).toBe(true);
    expect(identity(runCommands(exhausted, deps, endTurn).state).exhausted).toBe(true);
  });

  it("'You cannot change form'", () => {
    const tied = play(game(), TIED).state;
    expect(applyCommand(tied, toHero, deps)).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
  });

  it("'Players cannot attack [matching cards]'", () => {
    const taunted = play(game(), TAUNT).state;
    const grunt = encounterInPlay(taunted, GRUNT);
    const hero = runCommands(grunt.state, deps, toHero).state;
    const attack = (target: InstanceId): Command => ({ type: "basicAttack", playerId: p1, attackerInstanceId: identity(hero).instanceId, targetInstanceId: target });
    expect(applyCommand(hero, attack(grunt.id), deps).ok).toBe(false);
    expect(applyCommand(hero, attack(activeVillain(hero).instanceId), deps).ok).toBe(true);
  });

  it("'Threat cannot be removed from attached scheme by thwarting': a thwart is blocked, other removal is not", () => {
    const hostage = encounterInPlay(game(), HOSTAGE, 3);
    const hero = runCommands(hostage.state, deps, toHero).state;
    const thwarted = runCommands(hero, deps, { type: "basicThwart", playerId: p1, thwarterInstanceId: identity(hero).instanceId, schemeInstanceId: hostage.id });
    expect(mustInstance(thwarted.state, hostage.id).threat).toBe(3);
    expect(thwarted.events).toContainEqual({ type: "threatRemovalBlocked", schemeInstanceId: hostage.id, reason: "rule" });
    expect(mustInstance(play(hero, REMOVE_ONE).state, hostage.id).threat).toBe(2);
  });

  it("a blank text box loses its abilities and keywords until the end of the phase, but keeps an attachment's stat modifier", () => {
    const robot = encounterInPlay(game(), ROBOT);
    const plated = attachTo(robot.state, PLATING, robot.id);
    const hero = runCommands(plated, deps, toHero).state;
    expect(keywordsOf(hero, robot.id, deps)).toEqual([{ name: "retaliate", value: 1 }]);

    const blanked = play(hero, BLANK_IT).state;
    expect(keywordsOf(blanked, robot.id, deps)).toEqual([]);
    // Ruling, Apr 30, 2026 (3) answer 4: the attachment's stat modifier is outside the text box.
    expect(characterProfile(blanked, robot.id, deps)?.maxHp).toBe(8);
    const attacked = runCommands(blanked, deps, { type: "basicAttack", playerId: p1, attackerInstanceId: identity(blanked).instanceId, targetInstanceId: robot.id }).state;
    expect(mustInstance(attacked, robot.id).damage).toBe(2);
    expect(identity(attacked).damage).toBe(0);

    const nextPhase = runCommands(attacked, deps, endTurn).state;
    expect(keywordsOf(nextPhase, robot.id, deps)).toEqual([{ name: "retaliate", value: 1 }]);
  });

  it("'Resolve each When Revealed ability that you reveal 1 additional time'", () => {
    const start = game({ top: [BLANK, REVEALED] });
    const covered = attachTo(start, COVERAGE, identity(start).instanceId);
    const { state } = runCommands(covered, deps, endTurn);
    expect(identity(state).counters.seen).toBe(2);
  });
});
