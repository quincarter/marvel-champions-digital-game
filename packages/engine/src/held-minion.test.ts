/**
 * docs/phase7-wave9.md §3.21: a minion an environment holds (`EffectSpec attach` with `as: "heldMinion"`,
 * `isHeldMinion`). Synthetic cards shaped like the Thunderbolts scenario (`aos` 50130b, 50131a/b):
 * - Thunderbolt Backup: "(The minion attached here is in play and can be targeted by attacks and abilities.) Forced
 *   Interrupt: When the round ends, attach the Thunderbolt minion with the most damage here, swapping it with the minion
 *   already attached here, if any. Heal 1[per_hero] damage from attached minion. In expert mode, heal 1[per_hero]
 *   additional damage from that minion and give it a tough status card."
 * - Apprehending Rogue Agents 1B: "Each Thunderbolt minion gains guard. Forced Response: After a player attacks a
 *   Thunderbolt minion, that minion engages that player."
 *
 * Sources: MC50 p. 15 ("The attached minion is considered to be in play, retains all tokens, status cards, and
 * attachments on it, and can be targeted by attacks and player card abilities. The attached minion does not activate
 * because it is not engaged with any player."; "If the most damaged minion is already attached, it remains attached and
 * heals. If an unattached minion has the most damage, it attaches to the environment and any minion already attached
 * to the environment engages the player with whom the most-damaged minion was previously engaged."); MC50 p. 22 (a tie,
 * "including no damage", is the first player's choice); RRG 1.8 "Engage" (p. 18), "Guard" (p. 21), "Patrol" (p. 32),
 * "Retaliate X" (p. 38), "Attach To" (p. 8), "Minion" (p. 28).
 */

import { flat, trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { locateCard, minionsEngagedWith, mustInstance } from "./query.js";
import { cannotActivate } from "./rules.js";
import { cardsInPlay, categoriesOf, isHeldMinion, matchesQuery, resolveValue, type EffectContext } from "./select.js";
import type { EffectSpec, TargetQuery, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubMainScheme, stubMinion, stubUpgrade } from "./testing/fixtures.js";
import { ALLY, defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const THUNDERBOLT = trait("THUNDERBOLT");
const self: TargetRef = { kind: "self" };
const mainScheme: TargetRef = { kind: "mainScheme" };
const named = (name: string): TargetRef => ({ kind: "named", name });
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const n = (value: number): ValueSpec => ({ kind: "const", value });
const THUNDERBOLTS: TargetQuery = { categories: ["minion"], trait: THUNDERBOLT };
const MINIONS: TargetQuery = { categories: ["minion"] };

/** The minion attached here. */
const HELD_HERE: TargetRef = { kind: "attachmentsOf", of: self, filter: MINIONS };

const BACKUP_ROUND_END = stubAbility("backup.round-end", {
  trigger: { kind: "interrupt", forced: true, on: { on: "phaseEnding", eventIs: { phase: "villain" } } },
  effects: [
    {
      kind: "bindTargets",
      slot: "tied",
      target: {
        kind: "superlative",
        among: { kind: "each", query: THUNDERBOLTS },
        order: "highest",
        measure: { kind: "damage", of: slot("candidate") },
      },
    },
    // MC50 p. 22: a tie, "including no damage", is the first player's choice.
    { kind: "chooseTarget", slot: "most", query: { inSlot: "tied" }, chooser: { kind: "firstPlayer" } },
    // "Swapping it with the minion already attached here": that minion engages the player the other was engaged with.
    {
      kind: "engage",
      minion: { kind: "attachmentsOf", of: self, filter: { ...MINIONS, excluding: slot("most") } },
      player: { kind: "engagedWith", of: slot("most") },
    },
    { kind: "attach", card: slot("most"), to: self, as: "heldMinion" },
    { kind: "heal", target: HELD_HERE, amount: { kind: "perPlayer", base: 0, perPlayer: 1 } },
    {
      kind: "if",
      condition: { kind: "inMode", mode: "expert" },
      then: [
        { kind: "heal", target: HELD_HERE, amount: { kind: "perPlayer", base: 0, perPlayer: 1 } },
        { kind: "giveStatus", target: HELD_HERE, status: "tough" },
      ],
    },
  ],
});
const BACKUP = stubEnvironment({
  id: "backup-front",
  name: "Justice",
  flipSide: { name: "Backup", abilities: [BACKUP_ROUND_END.ref] },
});
/** A second environment with no text, to move a held minion between hosts. */
const ANNEX = stubEnvironment({ id: "annex", name: "Annex" });

const ROGUE_AGENTS_GUARD = stubAbility("rogue-agents.guard", {
  trigger: { kind: "constant", keywordGrants: [{ keyword: { name: "guard" }, target: THUNDERBOLTS }] },
  effects: [],
});
const ROGUE_AGENTS_RESPONSE = stubAbility("rogue-agents.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "characterAttacked", targetIs: THUNDERBOLTS },
  },
  effects: [{ kind: "engage", minion: { kind: "eventTarget" }, player: { kind: "eventPlayer" } }],
});
/** Threat the main scheme starts with, so it can be thwarted. */
const START = 5;
const scheme = (id: string, abilities: readonly (typeof ROGUE_AGENTS_GUARD)[]) =>
  stubMainScheme({
    id,
    stages: [
      {
        startingThreat: flat(START),
        targetThreat: flat(99),
        acceleration: flat(0),
        abilities: abilities.map((a) => a.ref),
      },
    ],
  });
/** A main scheme with no text: the held minion's own keywords, without the scenario's grant and response. */
const PLAIN_SCHEME = scheme("plain-scheme", []);
const ROGUE_AGENTS = scheme("rogue-agents", [ROGUE_AGENTS_GUARD, ROGUE_AGENTS_RESPONSE]);

const SONGBIRD_DEFEATED = stubAbility("songbird.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "placeThreat", target: mainScheme, amount: n(3) }],
});
/** "Guard. Patrol. Retaliate 1. When Defeated: Place 3 threat on the main scheme." */
const SONGBIRD = {
  ...stubMinion({
    id: "songbird",
    atk: 2,
    sch: 1,
    hp: 8,
    traits: [THUNDERBOLT],
    keywords: [{ name: "guard" }, { name: "patrol" }, { name: "retaliate", value: 1 }],
    abilities: [SONGBIRD_DEFEATED.ref],
  }),
  name: "Songbird",
};
const MOONSTONE = {
  ...stubMinion({ id: "moonstone", atk: 2, sch: 1, hp: 12, traits: [THUNDERBOLT] }),
  name: "Moonstone",
};
/** "Toughness. Quickstrike. Victory 2." */
const FIXER = {
  ...stubMinion({
    id: "fixer",
    atk: 1,
    sch: 1,
    hp: 3,
    traits: [THUNDERBOLT],
    keywords: [{ name: "toughness" }, { name: "quickstrike" }, { name: "victory", value: 2 }],
  }),
  name: "Fixer",
};
/** "Forced Interrupt: When [a minion] engages you, place 1 threat on the main scheme." (the shape of Batroc 50161) */
const WATCHER_ENGAGED = stubAbility("watcher.engaged", {
  trigger: { kind: "interrupt", forced: true, on: { on: "minionEngaged" } },
  effects: [{ kind: "placeThreat", target: mainScheme, amount: n(1) }],
});
const WATCHER = stubEnvironment({ id: "watcher", name: "Watcher", abilities: [WATCHER_ENGAGED.ref] });
/** A player upgrade: "Attach to a minion." */
const SNARE = { ...stubUpgrade({ id: "snare", cost: 0 }), attachesTo: { kind: "minion" as const } };

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const hold = (name: string, host = "Justice"): EffectSpec => ({
  kind: "attach",
  card: named(name),
  to: named(host),
  as: "heldMinion",
});
const HOLD_SONGBIRD = event("hold-songbird", [hold("Songbird")]);
const HOLD_MOONSTONE = event("hold-moonstone", [hold("Moonstone")]);
const MOVE_SONGBIRD = event("move-songbird", [hold("Songbird", "Annex")]);
/** "Reveal and attach the remaining set-aside Thunderbolt minion faceup here": from out of play. */
const HOLD_FIXER = event("hold-fixer", [
  { kind: "attach", card: { kind: "find", query: { name: "Fixer" } }, to: named("Justice"), as: "heldMinion" },
]);
const ENGAGE_SONGBIRD = event("engage-songbird", [
  { kind: "engage", minion: named("Songbird"), player: { kind: "controller" } },
]);
const HIT_SONGBIRD = event("hit-songbird", [{ kind: "dealDamage", target: named("Songbird"), amount: n(8) }]);
const SLAY_FIXER = event("slay-fixer", [{ kind: "defeat", target: named("Fixer") }]);
const TOUGHEN = event("toughen", [{ kind: "giveStatus", target: named("Songbird"), status: "tough" }]);
const RALLY = event("rally", [{ kind: "enemyActivation", enemies: { kind: "each", query: MINIONS }, boost: false }]);
const RAZE = event("raze", [{ kind: "discardFromPlay", target: named("Justice") }]);
const FLIP = event("flip", [{ kind: "flipCard", target: { kind: "each", query: { categories: ["environment"] } } }]);
const EVENTS = [
  HOLD_SONGBIRD,
  HOLD_MOONSTONE,
  MOVE_SONGBIRD,
  HOLD_FIXER,
  ENGAGE_SONGBIRD,
  HIT_SONGBIRD,
  SLAY_FIXER,
  TOUGHEN,
  RALLY,
  RAZE,
  FLIP,
];

const deps: EngineDeps = depsOf(
  BACKUP_ROUND_END,
  ROGUE_AGENTS_GUARD,
  ROGUE_AGENTS_RESPONSE,
  SONGBIRD_DEFEATED,
  WATCHER_ENGAGED,
  ...EVENTS.map((e) => e.ability),
);

const contextFor = (playerId: PlayerId): EffectContext => ({
  selfInstanceId: null,
  controllerId: playerId,
  event: null,
  bindings: {},
  deps,
});
const instanceOf = (state: GameState, cardId: string): InstanceId => {
  const found = cardsInPlay(state).find((id) => mustInstance(state, id).cardId === cardId);
  if (!found) throw new Error(`${cardId} is not in play`);
  return found;
};
const withDamage = (state: GameState, id: InstanceId, damage: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), damage } },
});
const expert = (state: GameState): GameState => ({
  ...state,
  scenarioRules: { ...state.scenarioRules, difficulty: "expert" },
});
const play = (state: GameState, card: (typeof EVENTS)[number], player: PlayerId = P1) =>
  playFree(state, deps, card.card.id, player);
const typesOf = (events: readonly GameEvent[], ...types: readonly GameEvent["type"][]) =>
  events.filter((e) => types.includes(e.type));
/** The trigger events announced, by kind (`GameEvent triggerEvent`, as each is initiated). */
const announcedIn = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "triggerEvent" && e.phase === "initiated" ? [e.event.kind] : []));
const expectReplays = (session: GameSession): void => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};
const END_ROUND: readonly Command[] = [
  { type: "endTurn", playerId: P1 },
  { type: "endTurn", playerId: P2 },
];

interface Table {
  readonly state: GameState;
  readonly backup: InstanceId;
  readonly songbird: InstanceId;
  readonly moonstone: InstanceId;
}

/**
 * Two players, the environment in the villain's area on its front face, Songbird engaged with player 1 and Moonstone
 * with player 2. `scenario`: Apprehending Rogue Agents 1B is the main scheme.
 */
function table(options: { readonly scenario?: boolean } = {}): Table {
  let state = gameAtFirstTurn({
    cards: [BACKUP, ANNEX, WATCHER, SONGBIRD, MOONSTONE, FIXER, SNARE, PLAIN_SCHEME, ...EVENTS.map((e) => e.card)],
    deps,
    players: 2,
    mainScheme: options.scenario ? ROGUE_AGENTS : PLAIN_SCHEME,
    encounter: [BACKUP.id, ANNEX.id, WATCHER.id, SONGBIRD.id, MOONSTONE.id, FIXER.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [SNARE.id, ...EVENTS.map((e) => e.card.id)],
  });
  const environment = encounterCardInVillainArea(state, BACKUP.id);
  state = environment.state;
  const songbird = minionEngagedWith(state, SONGBIRD.id, P1);
  const moonstone = minionEngagedWith(songbird.state, MOONSTONE.id, P2);
  return { state: moonstone.state, backup: environment.id, songbird: songbird.id, moonstone: moonstone.id };
}

const flippedOver = (state: GameState, id: InstanceId): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), flipped: true } },
});

/** `table` with Songbird held by the environment; `flipped`: then showing its Thunderbolt Backup side. */
function held(options: { readonly scenario?: boolean; readonly flipped?: boolean } = {}): Table {
  const before = table(options);
  const state = play(before.state, HOLD_SONGBIRD).state;
  return { ...before, state: options.flipped ? flippedOver(state, before.backup) : state };
}

describe("§3.21 a minion an environment holds is in play and engaged with nobody", () => {
  it("holding an engaged minion: one move and one `minionHeld`, with no entering of play", () => {
    const before = table();
    const { state, events, session } = play(before.state, HOLD_SONGBIRD);
    const { songbird, backup } = before;
    expect(mustInstance(state, songbird)).toMatchObject({ attachedTo: backup, engagedWith: null, heldMinion: true });
    expect(locateCard(state, songbird)).toEqual({ kind: "attachment", hostInstanceId: backup });
    expect(mustInstance(state, backup).attachments).toEqual([songbird]);
    expect(isHeldMinion(state, songbird)).toBe(true);
    expect(cardsInPlay(state)).toContain(songbird);
    const trail = events.filter((e) => "instanceId" in e && e.instanceId === songbird);
    expect(trail.map((e) => e.type)).toEqual(["cardMoved", "minionHeld"]);
    expect(typesOf(events, "minionHeld")).toEqual([
      { type: "minionHeld", instanceId: songbird, hostInstanceId: backup, engagedBefore: P1 },
    ]);
    expect(announcedIn(events)).not.toContain("cardEntersPlay");
    expectReplays(session);
  });

  it('"minions in play" counts it, "minions engaged with you" and "an attachment" do not', () => {
    const { state, songbird, backup } = held();
    expect(categoriesOf(state, songbird)).toEqual(["minion", "enemy", "character"]);
    for (const player of [P1, P2]) {
      const context = contextFor(player);
      expect(matchesQuery(state, songbird, MINIONS, context)).toBe(true);
      expect(matchesQuery(state, songbird, { ...MINIONS, engagedWith: "you" }, context)).toBe(false);
      expect(matchesQuery(state, songbird, { ...MINIONS, engagedWith: "any" }, context)).toBe(false);
      expect(matchesQuery(state, songbird, { ...MINIONS, engagedWithPlayer: { kind: "each" } }, context)).toBe(false);
      expect(matchesQuery(state, songbird, { categories: ["attachment"] }, context)).toBe(false);
      expect(minionsEngagedWith(state, player)).not.toContain(songbird);
    }
    const count = (query: TargetQuery): number => resolveValue(state, { kind: "count", query }, contextFor(P1));
    expect(count(MINIONS)).toBe(2);
    expect(count({ ...MINIONS, engagedWith: "any" })).toBe(1);
    expect(count({ ...MINIONS, engagedWith: "you" })).toBe(0);
    // The environment has no attachment a card could count or discard.
    expect(matchesQuery(state, backup, { hasAttachment: { categories: ["attachment"] } }, contextFor(P1))).toBe(false);
  });

  it("it keeps its damage, its status cards and its attachments, held and released", () => {
    const before = table();
    const given = giveCard(before.state, P1, SNARE.id);
    const snared = runCommands(given.state, deps, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: before.songbird,
    }).state;
    const marked = play(withDamage(snared, before.songbird, 4), TOUGHEN).state;
    const kept = { damage: 4, statuses: { tough: 1 }, attachments: [given.id] };
    const holding = play(marked, HOLD_SONGBIRD).state;
    expect(mustInstance(holding, before.songbird)).toMatchObject({ ...kept, heldMinion: true });
    const released = play(holding, ENGAGE_SONGBIRD, P1).state;
    expect(mustInstance(released, before.songbird)).toMatchObject({ ...kept, engagedWith: P1, attachedTo: null });
  });

  it("a minion attached from out of play enters play held: its keywords resolve, quickstrike has nobody to attack", () => {
    const before = table();
    const { state, events, session } = play(before.state, HOLD_FIXER);
    const fixer = instanceOf(state, FIXER.id);
    expect(mustInstance(state, fixer)).toMatchObject({
      attachedTo: before.backup,
      engagedWith: null,
      heldMinion: true,
    });
    expect(mustInstance(state, fixer).statuses.tough).toBe(1);
    expect(typesOf(events, "minionHeld")).toEqual([
      { type: "minionHeld", instanceId: fixer, hostInstanceId: before.backup, engagedBefore: null },
    ]);
    expect(announcedIn(events).filter((kind) => kind === "cardEntersPlay")).toHaveLength(1);
    expect(typesOf(events, "enemyActivated")).toEqual([]);
    expectReplays(session);
  });

  it("moved to another host that holds it, it is still held there", () => {
    const before = held();
    const annex = encounterCardInVillainArea(before.state, ANNEX.id);
    const moved = play(annex.state, MOVE_SONGBIRD).state;
    expect(mustInstance(moved, before.songbird)).toMatchObject({ attachedTo: annex.id, heldMinion: true });
    expect(mustInstance(moved, before.backup).attachments).toEqual([]);
  });
});

describe("§3.21 attacks, keywords and activation while held", () => {
  it("every player may attack it, on their own turn", () => {
    const { state, songbird } = held();
    const mine = playerCardIntoPlay(state, ALLY.id, P1);
    const struck = runCommands(mine.state, deps, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: mine.id,
      targetInstanceId: songbird,
    }).state;
    expect(mustInstance(struck, songbird).damage).toBe(2);
    // Retaliate 1 (RRG 1.8 p. 38: "After a character with the retaliate X keyword is attacked"): engaged or not.
    expect(mustInstance(struck, mine.id).damage).toBe(1 + 1);
    expect(mustInstance(struck, songbird).engagedWith).toBeNull();

    const theirs = playerCardIntoPlay(state, ALLY.id, P2);
    const second = runCommands(
      theirs.state,
      deps,
      { type: "endTurn", playerId: P1 },
      { type: "basicAttack", playerId: P2, attackerInstanceId: theirs.id, targetInstanceId: songbird },
    ).state;
    expect(mustInstance(second, songbird).damage).toBe(2);
  });

  it("its guard and patrol stop no player until it is engaged with one (RRG 1.8 pp. 21, 32)", () => {
    const { state, songbird } = held();
    const villain = state.villains[0]!.instanceId;
    const ally = playerCardIntoPlay(state, ALLY.id, P1);
    const offered = (s: GameState) => {
      const actions = legalActions(s, P1, deps);
      if (actions.kind !== "turn") throw new Error("not player 1's turn");
      const of = (kind: "basicAttack" | "basicThwart", target: InstanceId): boolean =>
        actions.legal.some(
          (a) => a.action.kind === kind && a.action.instanceId === ally.id && a.targets.includes(target),
        );
      return {
        villain: of("basicAttack", villain),
        minion: of("basicAttack", songbird),
        mainScheme: of("basicThwart", s.mainScheme.instanceId),
      };
    };
    expect(offered(ally.state)).toEqual({ villain: true, minion: true, mainScheme: true });
    const engaged = play(ally.state, ENGAGE_SONGBIRD).state;
    expect(offered(engaged)).toEqual({ villain: false, minion: true, mainScheme: false });
  });

  it("it does not activate: not in step two of the villain phase, not when an effect activates each minion", () => {
    const { state, songbird, moonstone } = held();
    expect(cannotActivate(state, deps, songbird)).toBe(true);
    const round = runCommands(state, deps, ...END_ROUND);
    const activated = round.events.flatMap((e) => (e.type === "enemyActivated" ? [e.enemyInstanceId] : []));
    expect(activated).toContain(moonstone);
    expect(activated).not.toContain(songbird);
    const rallied = play(state, RALLY).events;
    expect(rallied.flatMap((e) => (e.type === "activationBlocked" ? [e.enemyInstanceId] : []))).toEqual([songbird]);
  });
});

describe("§3.21 `engage` takes a held minion off its host", () => {
  it("one move into the engaging player's play area; it engaged them, and did not enter play", () => {
    const before = held();
    const watcher = encounterCardInVillainArea(before.state, WATCHER.id);
    const { state, events, session } = play(watcher.state, ENGAGE_SONGBIRD, P1);
    const { songbird, backup } = before;
    const after = mustInstance(state, songbird);
    expect(after).toMatchObject({ attachedTo: null, engagedWith: P1 });
    expect(after.heldMinion).toBeUndefined();
    expect(isHeldMinion(state, songbird)).toBe(false);
    expect(locateCard(state, songbird)).toEqual({ kind: "playArea", playerId: P1 });
    expect(mustInstance(state, backup).attachments).toEqual([]);
    expect(events.filter((e) => e.type === "cardMoved" && e.instanceId === songbird)).toEqual([
      expect.objectContaining({
        from: { kind: "attachment", hostInstanceId: backup },
        to: { kind: "playArea", playerId: P1 },
      }),
    ]);
    // RRG 1.8 "Engage" (p. 18): "that minion is also considered to have engaged that player".
    const announced = announcedIn(events);
    expect(announced.filter((kind) => kind === "minionEngaged")).toHaveLength(1);
    expect(announced).not.toContain("cardEntersPlay");
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(START + 1);
    expectReplays(session);
  });

  it("Apprehending Rogue Agents: a player attacks the held minion, and after the attack it is engaged with them", () => {
    const { state, songbird, backup } = held({ scenario: true });
    const ally = playerCardIntoPlay(state, ALLY.id, P1);
    const { state: after, session } = runCommands(ally.state, deps, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: ally.id,
      targetInstanceId: songbird,
    });
    expect(mustInstance(after, songbird)).toMatchObject({ damage: 2, engagedWith: P1, attachedTo: null });
    // Nothing is held until the round ends.
    expect(mustInstance(after, backup).attachments).toEqual([]);
    expectReplays(session);
  });
});

describe("§3.21 the host flips or leaves play; the held minion is defeated", () => {
  it("the environment flipping to its other side keeps the minion it holds", () => {
    const { state, songbird, backup } = held();
    const flipped = play(state, FLIP).state;
    expect(mustInstance(flipped, backup).flipped).toBe(true);
    expect(mustInstance(flipped, songbird)).toMatchObject({ attachedTo: backup, heldMinion: true });
  });

  it("the environment leaving play discards it, undefeated (RRG 1.8 'Attach To', p. 8)", () => {
    const before = held();
    const { state, events } = play(withDamage(before.state, before.songbird, 4), RAZE);
    expect(locateCard(state, before.songbird)?.kind).toBe("encounterDiscard");
    expect(mustInstance(state, before.songbird).heldMinion).toBeUndefined();
    expect(mustInstance(state, before.songbird).damage).toBe(0);
    expect(typesOf(events, "characterDefeated")).toEqual([]);
    // Its When Defeated did not resolve.
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(START);
  });

  it("at zero hit points it is defeated as any minion: its When Defeated resolves and it is discarded", () => {
    const before = held();
    const { state, events, session } = play(before.state, HIT_SONGBIRD);
    expect(typesOf(events, "characterDefeated").map((e) => "instanceId" in e && e.instanceId)).toEqual([
      before.songbird,
    ]);
    expect(locateCard(state, before.songbird)?.kind).toBe("encounterDiscard");
    expect(mustInstance(state, before.songbird).heldMinion).toBeUndefined();
    expect(mustInstance(state, before.backup).attachments).toEqual([]);
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(START + 3);
    expectReplays(session);
  });

  it("an effect that says 'defeat' defeats it, and Victory X sends it to the victory display", () => {
    const before = table();
    const holding = play(before.state, HOLD_FIXER).state;
    const fixer = instanceOf(holding, FIXER.id);
    const { state, events } = play(holding, SLAY_FIXER);
    expect(typesOf(events, "characterDefeated")).toHaveLength(1);
    expect(state.victoryDisplay).toContain(fixer);
    expect(mustInstance(state, before.backup).attachments).toEqual([]);
  });
});

describe("§3.21 Thunderbolt Backup's Forced Interrupt, scripted over `attach` and `engage` (two players)", () => {
  /** Songbird held with `songbirdDamage`, Moonstone engaged with player 2 with `moonstoneDamage`. */
  const before = (songbirdDamage: number, moonstoneDamage: number): Table => {
    const t = held({ flipped: true });
    return { ...t, state: withDamage(withDamage(t.state, t.songbird, songbirdDamage), t.moonstone, moonstoneDamage) };
  };

  it("Moonstone (9 damage, engaged with player 2) is held with 7; Songbird (4, held) engages player 2", () => {
    const t = before(4, 9);
    const { state, events, session } = runCommands(t.state, deps, ...END_ROUND);
    expect(mustInstance(state, t.moonstone)).toMatchObject({
      attachedTo: t.backup,
      engagedWith: null,
      heldMinion: true,
      damage: 7,
    });
    expect(mustInstance(state, t.songbird)).toMatchObject({ attachedTo: null, engagedWith: P2, damage: 4 });
    expect(mustInstance(state, t.backup).attachments).toEqual([t.moonstone]);
    expect(typesOf(events, "minionHeld")).toEqual([
      { type: "minionHeld", instanceId: t.moonstone, hostInstanceId: t.backup, engagedBefore: P2 },
    ]);
    expectReplays(session);
  });

  it("expert mode: Moonstone is held with 5 damage and a tough status card", () => {
    const t = before(4, 9);
    const { state } = runCommands(expert(t.state), deps, ...END_ROUND);
    expect(mustInstance(state, t.moonstone)).toMatchObject({ attachedTo: t.backup, damage: 5 });
    expect(mustInstance(state, t.moonstone).statuses.tough).toBe(1);
    expect(mustInstance(state, t.songbird).engagedWith).toBe(P2);
  });

  it("both at 3 damage: the first player chooses (MC50 p. 22)", () => {
    const t = before(3, 3);
    const asked: { readonly playerId: PlayerId; readonly options: number }[] = [];
    const picking = (pickLast: boolean) =>
      runCommandsPicking(
        t.state,
        deps,
        (state) => {
          const choice = state.pendingChoice!;
          const ids = choice.options.map((o) => o.optionId);
          if (!ids.includes(t.moonstone) || !ids.includes(t.songbird)) return defaultPick(state);
          asked.push({ playerId: choice.playerId, options: ids.length });
          return [pickLast ? t.moonstone : t.songbird];
        },
        ...END_ROUND,
      ).state;
    const swapped = picking(true);
    // RRG 1.8 "Villain Phase" (p. 47): the first player token passes in step five, before the round ends in step six.
    expect(asked).toEqual([{ playerId: P2, options: 2 }]);
    expect(mustInstance(swapped, t.moonstone)).toMatchObject({ attachedTo: t.backup, damage: 1 });
    expect(mustInstance(swapped, t.songbird)).toMatchObject({ engagedWith: P2, damage: 3 });
    const stayed = picking(false);
    expect(mustInstance(stayed, t.songbird)).toMatchObject({ attachedTo: t.backup, damage: 1 });
    expect(mustInstance(stayed, t.moonstone)).toMatchObject({ engagedWith: P2, damage: 3 });
  });

  it("the held minion has the most damage: it stays and heals 2", () => {
    const t = before(5, 1);
    const { state, events } = runCommands(t.state, deps, ...END_ROUND);
    expect(mustInstance(state, t.songbird)).toMatchObject({ attachedTo: t.backup, heldMinion: true, damage: 3 });
    expect(mustInstance(state, t.moonstone)).toMatchObject({ engagedWith: P2, damage: 1 });
    expect(typesOf(events, "minionHeld")).toEqual([]);
  });

  it("nothing held (player 1 attacked the held minion): the most damaged minion is held as the round ends", () => {
    const t = held({ scenario: true, flipped: true });
    const ally = playerCardIntoPlay(t.state, ALLY.id, P1);
    const { state } = runCommands(
      ally.state,
      deps,
      { type: "basicAttack", playerId: P1, attackerInstanceId: ally.id, targetInstanceId: t.songbird },
      ...END_ROUND,
    );
    // Songbird: 2 damage from the attack, engaged with player 1, then held again and healed 2.
    expect(mustInstance(state, t.songbird)).toMatchObject({ attachedTo: t.backup, heldMinion: true, damage: 0 });
    expect(mustInstance(state, t.moonstone)).toMatchObject({ engagedWith: P2, attachedTo: null });
  });

  it("no Thunderbolt minion in play: nothing happens", () => {
    let state = gameAtFirstTurn({
      cards: [BACKUP, PLAIN_SCHEME, ...EVENTS.map((e) => e.card)],
      deps,
      players: 2,
      mainScheme: PLAIN_SCHEME,
      encounter: [BACKUP.id, ...copiesOf(TREACHERY.id, 20)],
    });
    const environment = encounterCardInVillainArea(state, BACKUP.id);
    state = flippedOver(environment.state, environment.id);
    const { state: after, events } = runCommands(state, deps, ...END_ROUND);
    expect(mustInstance(after, environment.id).attachments).toEqual([]);
    expect(typesOf(events, "minionHeld", "damageHealed")).toEqual([]);
    expect(after.round).toBe(state.round + 1);
  });
});
