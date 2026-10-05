/**
 * docs/phase7-wave7.md §3.36 gap 2: a per-phase record of which characters attacked and which thwarted
 * (`GameState.characterActsThisPhase`), and `Predicate characterDidThisPhase` over it. Synthetic cards shaped like
 * "Attach to your identity. Hero Action: If your hero attacked and thwarted this phase → discard this card."
 *
 * - **Which attacks and thwarts** (owner decision §4.1 Q23 = A): any made by the hero, its basic powers and every
 *   ability labeled "(attack)" or "(thwart)" its player resolves (RRG 1.8 "Labeled Ability", p. 26: "that ability is
 *   considered to be an attack/a thwart made by that player's identity"; FAQ "Jarnbjorn (#19)", RRG 1.8 p. 59: "A
 *   hero is considered to make an attack both through their basic attack power and actions with the (attack)
 *   label"). An ally's are the ally's. Unlabeled damage and unlabeled threat removal are neither.
 * - **"This phase"** is read literally: the player phase is one phase holding every player's turn and its end-of-phase
 *   steps (RRG 1.8 "Player Phase", p. 34), so the record outlasts a turn and is emptied only when the phase changes.
 *   What a hero does in the villain phase counts for that villain phase.
 * - **A 0 result** follows what "after you attack" / "after you thwart" hear: an attack into a tough status card was
 *   made; a stunned attack and a confused thwart are canceled (RRG 1.8 "Stunned", p. 41; "Confused", p. 13) and a
 *   thwart patrol or a crisis icon forbids is never made (RRG 1.8 "Patrol", p. 32; "Crisis Icon", p. 14).
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { evaluate, type EffectContext } from "./select.js";
import type { EffectSpec, Predicate, TargetQuery } from "./spec.js";
import type { CardInstance, GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubAttachment,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { ALLY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const yourIdentity: TargetQuery = { categories: ["identity"], controller: "you" };
const did = (what: "attack" | "thwart"): Predicate => ({
  kind: "characterDidThisPhase",
  character: yourIdentity,
  did: what,
});
const BOTH: Predicate = { kind: "and", of: [did("attack"), did("thwart")] };

/** "Hero Action: If your hero attacked and thwarted this phase → discard this card." */
const INERTIA_ACTION = stubAbility("inertia.action", {
  trigger: { kind: "action", form: "hero", while: BOTH },
  effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
});
const INERTIA = stubAttachment({ id: "inertia", abilities: [INERTIA_ACTION.ref] });

const event = (id: string, label: "attack" | "thwart" | null, ...effects: EffectSpec[]) => {
  const definition: AbilityDefinition = {
    trigger: { kind: "action" },
    ...(label ? { label: [label] as const } : {}),
    effects,
  };
  const ability = stubAbility(`${id}.action`, definition);
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Hero Action (attack): Deal 1 damage to the villain." */
const STRIKE = event("strike", "attack", { kind: "attack", target: { kind: "villain" }, amount: n(1) });
/** "Hero Action (thwart): Remove 2 threat from the main scheme." */
const FOIL = event("foil", "thwart", { kind: "removeThreat", target: { kind: "mainScheme" }, amount: n(2) });
/** "Action: Deal 1 damage to the villain." No label: not an attack. */
const ZAP = event("zap", null, { kind: "dealDamage", target: { kind: "villain" }, amount: n(1) });
/** "Action: Remove 2 threat from the main scheme." No label: not a thwart. */
const EASE = event("ease", null, { kind: "removeThreat", target: { kind: "mainScheme" }, amount: n(2) });

const mark = (counterType: string, condition: Predicate): EffectSpec => ({
  kind: "if",
  condition,
  then: [{ kind: "addCounters", target: { kind: "villain" }, counterType, amount: n(1) }],
});
/** "When Revealed: Your hero attacks the villain." Then it notes on the villain what the record says. */
const AMBUSH_REVEALED = stubAbility("ambush.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "attack", target: { kind: "villain" }, amount: n(1) },
    mark("sawAttack", did("attack")),
    mark("sawThwart", did("thwart")),
  ],
});
const AMBUSH = stubTreachery({ id: "ambush", boostIcons: 0, abilities: [AMBUSH_REVEALED.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SENTRY = stubMinion({ id: "sentry", atk: 0, sch: 0, hp: 6, boostIcons: 0, keywords: [{ name: "patrol" }] });
const CRISIS = stubSideScheme({ id: "crisis-side", startingThreat: 2, icons: ["crisis"] });
const BOSS = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const PLOT = stubMainScheme({
  id: "plot",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
});

const EVENTS = [STRIKE, FOIL, ZAP, EASE];
const deps: EngineDeps = depsOf(INERTIA_ACTION, AMBUSH_REVEALED, ...EVENTS.map((e) => e.ability));
const ENCOUNTER: readonly CardId[] = [INERTIA.id, SENTRY.id, CRISIS.id, AMBUSH.id, ...copiesOf(BLANK.id, 24)];

const patch = (state: GameState, id: InstanceId, change: Partial<CardInstance>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } },
});
const heroOf = (state: GameState, player: PlayerId = P1): InstanceId => mustPlayer(state, player).identity.instanceId;
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const mainOf = (state: GameState): InstanceId => state.mainScheme.instanceId;
/** A basic power exhausts the hero; this stands it back up so one test can use both (surgery). */
const readied = (state: GameState, player: PlayerId = P1): GameState =>
  patch(state, heroOf(state, player), { exhausted: false });

/** Every identity in hero form, 10 threat on the main scheme, and the attachment on p1's identity (surgery). */
function start(players: 1 | 2 = 1): { readonly state: GameState; readonly inertia: InstanceId } {
  let state = gameAtFirstTurn({
    cards: [INERTIA, SENTRY, CRISIS, AMBUSH, BLANK, ...EVENTS.map((e) => e.card)],
    deps,
    villain: BOSS,
    mainScheme: PLOT,
    encounter: ENCOUNTER,
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
    players,
  });
  state = { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
  state = patch(state, mainOf(state), { threat: 10 });
  const deckId = state.encounterDeckOrder[0]!;
  const piles = state.encounterDecks[deckId]!;
  const inertia = piles.deck.find((id) => state.instances[id]?.cardId === INERTIA.id)!;
  const hero = heroOf(state);
  state = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...piles, deck: piles.deck.filter((id) => id !== inertia) },
    },
  };
  state = patch(state, hero, { attachments: [...mustInstance(state, hero).attachments, inertia] });
  state = patch(state, inertia, { attachedTo: hero, faceup: true });
  return { state, inertia };
}

const basicAttack = (state: GameState, attacker = heroOf(state), player: PlayerId = P1): GameState =>
  runCommands(state, deps, {
    type: "basicAttack",
    playerId: player,
    attackerInstanceId: attacker,
    targetInstanceId: villainOf(state),
  }).state;
const thwartCommand = (state: GameState, thwarter: InstanceId, player: PlayerId): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: thwarter,
  schemeInstanceId: mainOf(state),
});
const basicThwart = (state: GameState, thwarter = heroOf(state), player: PlayerId = P1): GameState =>
  runCommands(state, deps, thwartCommand(state, thwarter, player)).state;
const play = (state: GameState, card: (typeof EVENTS)[number], player: PlayerId = P1): GameState =>
  playFree(state, deps, card.card.id, player).state;

const acts = (state: GameState) => state.characterActsThisPhase ?? [];
const asPlayer = (player: PlayerId): EffectContext => ({
  selfInstanceId: null,
  controllerId: player,
  event: null,
  bindings: {},
  deps,
});
const holds = (state: GameState, player: PlayerId = P1): boolean => evaluate(state, BOTH, asPlayer(player));
const use = (inertia: InstanceId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: inertia,
  abilityId: INERTIA_ACTION.ref.id,
  payment: [],
});
/** Whether the attachment's Hero Action is among p1's legal actions. */
function offered(state: GameState, inertia: InstanceId): boolean {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`expected the player's turn, got ${actions.kind}`);
  return actions.legal.some(
    (a) => a.action.kind === "useAbility" && "instanceId" in a.action && a.action.instanceId === inertia,
  );
}
const refused = (state: GameState, command: Command): boolean => !applyCommand(state, command, deps).ok;

describe("§3.36 'if your hero attacked and thwarted this phase'", () => {
  it("neither: nothing recorded, the condition is false, and the Hero Action is not offered", () => {
    const { state, inertia } = start();
    expect(state.characterActsThisPhase).toBeUndefined();
    expect(holds(state)).toBe(false);
    expect(offered(state, inertia)).toBe(false);
    expect(refused(state, use(inertia))).toBe(true);
  });

  it("only a basic attack, or only a basic thwart: recorded for the hero, and the condition is still false", () => {
    const { state, inertia } = start();
    const attacked = basicAttack(state);
    expect(acts(attacked)).toEqual([{ characterInstanceId: heroOf(state), did: "attack" }]);
    expect(evaluate(attacked, did("attack"), asPlayer(P1))).toBe(true);
    expect(evaluate(attacked, did("thwart"), asPlayer(P1))).toBe(false);
    expect(offered(attacked, inertia)).toBe(false);

    const thwarted = basicThwart(state);
    expect(mustInstance(thwarted, mainOf(state)).threat).toBe(8);
    expect(acts(thwarted)).toEqual([{ characterInstanceId: heroOf(state), did: "thwart" }]);
    expect(offered(thwarted, inertia)).toBe(false);
  });

  it("both basic powers: the Hero Action is offered, and resolving it discards the card; replay deep-equal", () => {
    const { state, inertia } = start();
    const both = basicThwart(readied(basicAttack(state)));
    expect(acts(both)).toEqual([
      { characterInstanceId: heroOf(state), did: "attack" },
      { characterInstanceId: heroOf(state), did: "thwart" },
    ]);
    expect(offered(both, inertia)).toBe(true);
    const used = runCommands(both, deps, use(inertia));
    expect(mustInstance(used.state, heroOf(state)).attachments).not.toContain(inertia);
    expect(mustInstance(used.state, inertia).attachedTo).toBeNull();
    expect(Object.values(used.state.encounterDecks).flatMap((piles) => piles.discard)).toContain(inertia);
    const replayed = replay(used.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(used.state);
  });

  it("both by labeled events: an '(attack)' and a '(thwart)' event are the hero's attack and thwart", () => {
    const { state, inertia } = start();
    const struck = play(state, STRIKE);
    expect(acts(struck)).toEqual([{ characterInstanceId: heroOf(state), did: "attack" }]);
    const both = play(struck, FOIL);
    expect(mustInstance(both, mainOf(state)).threat).toBe(8);
    expect(acts(both)).toEqual([
      { characterInstanceId: heroOf(state), did: "attack" },
      { characterInstanceId: heroOf(state), did: "thwart" },
    ]);
    // The hero never exhausted: the labeled abilities are not its basic powers.
    expect(mustInstance(both, heroOf(state)).exhausted).toBe(false);
    expect(offered(both, inertia)).toBe(true);
  });

  it("one basic and one labeled, either way round", () => {
    const { state, inertia } = start();
    expect(offered(play(basicAttack(state), FOIL), inertia)).toBe(true);
    expect(offered(play(basicThwart(state), STRIKE), inertia)).toBe(true);
  });

  it("a second attack or thwart by the same character adds nothing: the record is a set", () => {
    const { state } = start();
    const twice = play(play(play(play(state, STRIKE), STRIKE), FOIL), FOIL);
    expect(acts(twice)).toHaveLength(2);
  });

  it("unlabeled damage and unlabeled threat removal are neither an attack nor a thwart", () => {
    const { state, inertia } = start();
    const after = play(play(state, ZAP), EASE);
    expect(mustInstance(after, villainOf(state)).damage).toBe(1);
    expect(mustInstance(after, mainOf(state)).threat).toBe(8);
    expect(after.characterActsThisPhase).toBeUndefined();
    expect(offered(after, inertia)).toBe(false);
  });

  it("an ally's attack and thwart are the ally's, not your hero's", () => {
    const { state, inertia } = start();
    const first = playerCardIntoPlay(state, ALLY.id);
    const second = playerCardIntoPlay(first.state, ALLY.id);
    const after = basicThwart(basicAttack(second.state, first.id), second.id);
    expect(acts(after)).toEqual([
      { characterInstanceId: first.id, did: "attack" },
      { characterInstanceId: second.id, did: "thwart" },
    ]);
    expect(holds(after)).toBe(false);
    expect(offered(after, inertia)).toBe(false);
    // The hero thwarting too is still only half: the ally's attack is not the hero's.
    expect(offered(basicThwart(after), inertia)).toBe(false);
    // …and a query over allies does read them.
    const yourAlly: TargetQuery = { categories: ["ally"], controller: "you" };
    expect(evaluate(after, { kind: "characterDidThisPhase", character: yourAlly, did: "attack" }, asPlayer(P1))).toBe(
      true,
    );
  });

  it("another player's hero does not count for you, and the record outlasts a turn within the player phase", () => {
    const { state } = start(2);
    // p1 attacks on their own turn, then the turn passes: still the player phase, so the attack is still recorded.
    const p2Turn = runCommands(basicAttack(state), deps, { type: "endTurn", playerId: P1 }).state;
    expect(p2Turn.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: P2 });
    expect(p2Turn.attacksThisTurn ?? []).toEqual([]);
    expect(acts(p2Turn)).toEqual([{ characterInstanceId: heroOf(state), did: "attack" }]);
    // p2's hero attacks and thwarts: true for p2, and p1's hero has still only attacked.
    const p2Both = play(play(p2Turn, STRIKE, P2), FOIL, P2);
    expect(acts(p2Both)).toEqual([
      { characterInstanceId: heroOf(state), did: "attack" },
      { characterInstanceId: heroOf(state, P2), did: "attack" },
      { characterInstanceId: heroOf(state, P2), did: "thwart" },
    ]);
    expect(holds(p2Both, P2)).toBe(true);
    expect(holds(p2Both, P1)).toBe(false);
  });

  it("attacked and thwarted on your own turn: still true during the next player's turn of the same phase", () => {
    const { state } = start(2);
    const both = play(basicAttack(state), FOIL);
    const p2Turn = runCommands(both, deps, { type: "endTurn", playerId: P1 }).state;
    expect(p2Turn.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: P2 });
    expect(holds(p2Turn, P1)).toBe(true);
    expect(holds(p2Turn, P2)).toBe(false);
  });

  it("the record is emptied when the player phase ends, and what a hero does in the villain phase is that phase's", () => {
    const { state } = start();
    // The hero thwarts in the player phase; in the villain phase a treachery makes it attack.
    // The villain's attack takes the top card as its boost card, so the treachery goes second.
    const thwarted = onTopOfEncounterDeck(onTopOfEncounterDeck(basicThwart(state), AMBUSH.id), BLANK.id);
    expect(acts(thwarted)).toHaveLength(1);
    const next = runCommands(thwarted, deps, { type: "endTurn", playerId: P1 }).state;
    expect(next.step).toMatchObject({ phase: "player", kind: "turn" });
    expect(next.round).toBe(state.round + 1);
    // Read during the villain phase: the attack made there, and not the player phase's thwart.
    expect(mustInstance(next, villainOf(state)).counters).toEqual({ sawAttack: 1 });
    expect(mustInstance(next, villainOf(state)).damage).toBe(1);
    // …and the villain phase's attack is gone by the next player phase.
    expect(next.characterActsThisPhase).toBeUndefined();
    expect(evaluate(next, did("attack"), asPlayer(P1))).toBe(false);
  });

  it("an attack into a tough status card was made: 0 damage, and the hero attacked", () => {
    const { state } = start();
    const tough = patch(state, villainOf(state), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const after = basicAttack(tough);
    expect(mustInstance(after, villainOf(state)).damage).toBe(0);
    expect(mustInstance(after, villainOf(state)).statuses.tough).toBe(0);
    expect(acts(after)).toEqual([{ characterInstanceId: heroOf(state), did: "attack" }]);
  });

  it("a stunned hero's attack and a confused hero's thwart are canceled: neither was made", () => {
    const { state } = start();
    const hero = heroOf(state);
    const stunned = patch(state, hero, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const afterAttack = play(stunned, STRIKE);
    expect(mustInstance(afterAttack, hero).statuses.stunned).toBe(0);
    expect(mustInstance(afterAttack, villainOf(state)).damage).toBe(0);
    expect(afterAttack.characterActsThisPhase).toBeUndefined();

    const confused = patch(state, hero, { statuses: { stunned: 0, confused: 1, tough: 0 } });
    const afterThwart = play(confused, FOIL);
    expect(mustInstance(afterThwart, hero).statuses.confused).toBe(0);
    expect(mustInstance(afterThwart, mainOf(state)).threat).toBe(10);
    expect(afterThwart.characterActsThisPhase).toBeUndefined();
  });

  it("a thwart patrol or a crisis icon forbids is never made", () => {
    const { state } = start();
    const patrolled = minionEngagedWith(state, SENTRY.id).state;
    expect(refused(patrolled, thwartCommand(patrolled, heroOf(state), P1))).toBe(true);
    const crisis = encounterCardInVillainArea(state, CRISIS.id, 2).state;
    expect(refused(crisis, thwartCommand(crisis, heroOf(state), P1))).toBe(true);
    // Nothing was thwarted, so nothing was recorded; an attack beside it still counts on its own.
    const after = basicAttack(crisis);
    expect(acts(after)).toEqual([{ characterInstanceId: heroOf(state), did: "attack" }]);
    expect(holds(after)).toBe(false);
  });

  it("a thwart that resolves against a scheme with no threat left on it is a thwart, as 'after you thwart' hears it", () => {
    const { state, inertia } = start();
    const empty = patch(state, mainOf(state), { threat: 0 });
    const after = play(basicAttack(empty), FOIL);
    expect(mustInstance(after, mainOf(state)).threat).toBe(0);
    expect(acts(after)).toContainEqual({ characterInstanceId: heroOf(state), did: "thwart" });
    expect(offered(after, inertia)).toBe(true);
  });

  it("the record survives a serialization round trip", () => {
    const { state, inertia } = start();
    const both = play(play(state, STRIKE), FOIL);
    const loaded = JSON.parse(JSON.stringify(both)) as GameState;
    expect(loaded).toEqual(both);
    expect(loaded.characterActsThisPhase).toEqual(both.characterActsThisPhase);
    expect(offered(loaded, inertia)).toBe(true);
  });

  it("a state without the field reads as nothing recorded, and records from there", () => {
    const { state, inertia } = start();
    const both = play(play(state, STRIKE), FOIL);
    const { characterActsThisPhase: _acts, ...older } = both;
    expect(holds(older)).toBe(false);
    expect(offered(older, inertia)).toBe(false);
    expect(acts(play(older, STRIKE))).toEqual([{ characterInstanceId: heroOf(state), did: "attack" }]);
  });
});
