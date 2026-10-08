/**
 * docs/phase7-wave8.md §3.33 part (b): a closed in-play scenario area. MC45 p. 5: "Cards in the mission area are in
 * play but under no player's control. They cannot be affected by card abilities unless the ability refers to the
 * mission area."
 *
 * - No query, selector or "each" of an ability that does not refer to the area picks or changes a card there
 *   (`closedScenarioPlayArea`). `TargetQuery.inScenarioPlayArea` is the query that names it ("an ally at the mission",
 *   "the [MISSION] side scheme").
 * - An attachment does not open it (§4.1 Q19 = B): an upgrade on an ally there finds no "attached ally".
 *   `AbilityDefinition.reaches` is how a whole ability refers to the area.
 * - Reads still see the card (§4.1 Q18 = A): a count, a condition, an event pattern.
 * - A card is never closed to its own abilities.
 *
 * The table of the section's tests: 2 players; a side scheme at 10 threat and a minion of 10 hit points in the area;
 * player 1's ally (3 hit points) at the mission with 1 damage. Synthetic cards only.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { maxHitPoints, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay, matchesQuery, resolveRef, type EffectContext } from "./select.js";
import type { EffectSpec, Predicate, TargetQuery, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { ALLY, defaultPick, giveCard } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const AREA = "mission";
const THERE = { inScenarioPlayArea: AREA } as const;
const INTO = { scenarioPlayArea: AREA } as const;
const n = (value: number): ValueSpec => ({ kind: "const", value });
const you = { kind: "controller" } as const;
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const each = (query: TargetQuery): TargetRef => ({ kind: "each", query });
const find = (name: string, mine = false): TargetRef => ({
  kind: "find",
  query: { name },
  ...(mine ? { owner: you } : {}),
});
const HOST = { hostOfSelf: true } as const;

/** The side scheme of the area: 5 threat per player. */
const ERRAND = {
  ...stubSideScheme({ id: "errand", startingThreat: 0, boostIcons: 0 }),
  startingThreat: { base: 0, perPlayer: 5 },
};
const PLOT = stubSideScheme({ id: "plot", startingThreat: 3, boostIcons: 0 });
/** "Cannot take damage while another minion is at the mission." Its own card, named by `self`; the condition is a read. */
const anotherMinionThere: Predicate = {
  kind: "exists",
  query: { categories: ["minion"], inScenarioPlayArea: AREA, self: false },
};
const WARDEN_CONSTANT = stubAbility("warden.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "cannotTakeDamage", target: { self: true }, while: anotherMinionThere }],
    modifiers: [{ stat: "hp", amount: 4, target: { self: true } }],
  },
  effects: [],
});
/** 6 printed hit points and +4 from its own text: 10. */
const WARDEN = stubMinion({ id: "warden", atk: 2, sch: 1, hp: 6, boostIcons: 0, abilities: [WARDEN_CONSTANT.ref] });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 3, boostIcons: 0 });
const SQUIRE = stubAlly({ id: "squire", cost: 0, atk: 1, thw: 1, hp: 3 });
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });

/** "Attach to an ally. Attached ally gets +2 hit points." An ordinary upgrade. */
const SUIT_CONSTANT = stubAbility("suit.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "hp", amount: 2, target: HOST }] },
  effects: [],
});
const SUIT = stubUpgrade({ id: "suit", cost: 0, abilities: [SUIT_CONSTANT.ref] });
/** The same text on an ability that refers to the area. */
const BANNER_CONSTANT = stubAbility("banner.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "hp", amount: 2, target: HOST }] },
  reaches: INTO,
  effects: [],
});
const BANNER = stubUpgrade({ id: "banner", cost: 0, abilities: [BANNER_CONSTANT.ref] });
/** "Forced Response: After an ally is defeated, deal 1 damage to the villain." A watcher outside the area. */
const VIGIL_RESPONSE = stubAbility("vigil.response", {
  trigger: { kind: "response", forced: true, on: { on: "characterDefeated", targetIs: { categories: ["ally"] } } },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: n(1) }],
});
const VIGIL = stubSupport({ id: "vigil", cost: 0, abilities: [VIGIL_RESPONSE.ref] });

const action = (id: string, effects: readonly EffectSpec[], reaches?: typeof INTO) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects,
    ...(reaches ? { reaches } : {}),
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const choose = (query: TargetQuery): EffectSpec => ({ kind: "chooseTarget", slot: "t", query, chooser: you });
const T = slot("t");
const OPEN = action("open", [{ kind: "createScenarioPlayArea", name: AREA, closed: true }]);
const OPEN_WIDE = action("open-wide", [{ kind: "createScenarioPlayArea", name: AREA, closed: false }]);
const send = (id: string, card: TargetRef) => action(id, [{ kind: "putIntoPlay", card, controller: you, into: INTO }]);
const SEND_ERRAND = send("send-errand", find(ERRAND.name));
const SEND_WARDEN = send("send-warden", find(WARDEN.name));
const SEND_GRUNT = send("send-grunt", find(GRUNT.name));
const SEND_SQUIRE = send("send-squire", find(SQUIRE.name, true));

const HEAL = action("heal", [choose({ categories: ["ally"] }), { kind: "heal", target: T, amount: n(1) }]);
const READY = action("ready", [choose({ categories: ["ally"] }), { kind: "ready", target: T }]);
const THWART = action("thwart", [
  choose({ categories: ["sideScheme"] }),
  { kind: "removeThreat", target: T, amount: n(2) },
]);
const STRIKE = action("strike", [
  choose({ categories: ["villain", "minion"] }),
  { kind: "dealDamage", target: T, amount: n(1) },
]);
const STORM = action("storm", [{ kind: "dealDamage", target: each({ categories: ["ally"] }), amount: n(1) }]);
const QUAKE = action("quake", [
  { kind: "dealDamage", target: each({ categories: ["identity", "ally", "minion"] }), amount: n(1) },
]);
const SWELL = action("swell", [{ kind: "placeThreat", target: each({ categories: ["sideScheme"] }), amount: n(1) }]);
/** "Place 3 threat on the [MISSION] side scheme." The query names the area. */
const CRISIS = action("crisis", [
  { kind: "placeThreat", target: each({ categories: ["sideScheme"], ...THERE }), amount: n(3) },
]);
/** "Deal 1 damage to an ally at the mission." */
const SNIPE = action("snipe", [
  choose({ categories: ["ally"], ...THERE }),
  { kind: "dealDamage", target: T, amount: n(1) },
]);
/** "Deal 3 damage to each minion at the mission." */
const VOLLEY = action("volley", [
  { kind: "dealDamage", target: each({ categories: ["minion"], ...THERE }), amount: n(3) },
]);
/** "Deal damage to the villain equal to the number of side schemes in play." A count. */
const TALLY = action("tally", [
  { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "count", query: { categories: ["sideScheme"] } } },
]);
/** "Deal 1 damage to [the ally, by name]." A ref with no query. */
const CALL_OUT = action("call-out", [
  { kind: "dealDamage", target: { kind: "named", name: SQUIRE.name }, amount: n(1) },
]);
/** The same words on an ability that refers to the area as a whole. */
const CALL_IN = action(
  "call-in",
  [{ kind: "dealDamage", target: { kind: "named", name: SQUIRE.name }, amount: n(1) }],
  INTO,
);
const EVENTS = [
  OPEN,
  OPEN_WIDE,
  SEND_ERRAND,
  SEND_WARDEN,
  SEND_GRUNT,
  SEND_SQUIRE,
  HEAL,
  READY,
  THWART,
  STRIKE,
  STORM,
  QUAKE,
  SWELL,
  CRISIS,
  SNIPE,
  VOLLEY,
  TALLY,
  CALL_OUT,
  CALL_IN,
];

const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const TYRANT = stubVillain({ id: "tyrant", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const deps: EngineDeps = depsOf(
  WARDEN_CONSTANT,
  SUIT_CONSTANT,
  BANNER_CONSTANT,
  VIGIL_RESPONSE,
  ...EVENTS.map((e) => e.ability),
);

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const idOf = (state: GameState, cardId: string, owner?: string): InstanceId => {
  const id = (Object.keys(state.instances) as InstanceId[]).find(
    (key) =>
      state.instances[key]?.cardId === cardId && (owner === undefined || state.instances[key]?.ownerId === owner),
  );
  if (!id) throw new Error(`no ${cardId}`);
  return id;
};
const patch = (state: GameState, id: InstanceId, change: Partial<GameState["instances"][string]>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } },
});

/**
 * Plays one 0-cost event and answers its choices with the first option, recording the cards each target choice
 * offered. Returns the state, the events and the offers.
 */
function play(state: GameState, card: { card: { id: CardId } }, player: PlayerId = P1) {
  const given = giveCard(state, player, card.card.id);
  const offered: InstanceId[][] = [];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseTarget")
      offered.push(choice.options.flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId] : [])));
    return defaultPick(s);
  };
  const { session, events } = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    pick,
  );
  return { state: session.state, events, offered };
}
const playAll = (state: GameState, ...cards: readonly { card: { id: CardId } }[]): GameState =>
  cards.reduce((current, card) => play(current, card).state, state);

/** Attaches P1's copy of an upgrade to `host` (surgery: playing one to the area is §3.34). */
function attach(state: GameState, card: CardId, host: InstanceId): { state: GameState; id: InstanceId } {
  const given = giveCard(state, P1, card);
  return {
    id: given.id,
    state: {
      ...given.state,
      players: given.state.players.map((p) => ({ ...p, hand: p.hand.filter((id) => id !== given.id) })),
      instances: {
        ...given.state.instances,
        [given.id]: { ...mustInstance(given.state, given.id), faceup: true, attachedTo: host, controllerId: null },
        [host]: {
          ...mustInstance(given.state, host),
          attachments: [...mustInstance(given.state, host).attachments, given.id],
        },
      },
    },
  };
}

interface Table {
  readonly state: GameState;
  readonly errand: InstanceId;
  readonly warden: InstanceId;
  readonly squire: InstanceId;
  /** P1's ally in their own play area, with 1 damage. */
  readonly ally: InstanceId;
  /** A side scheme in the villain's area, at 3 threat. */
  readonly plot: InstanceId;
  /** A minion engaged with P1. */
  readonly grunt: InstanceId;
}

function table(open: typeof OPEN = OPEN): Table {
  const base = gameAtFirstTurn({
    cards: [ERRAND, PLOT, WARDEN, GRUNT, SQUIRE, SUIT, BANNER, VIGIL, NOISE, ...EVENTS.map((e) => e.card)],
    deps,
    villain: TYRANT,
    mainScheme: SCHEME,
    players: 2,
    encounter: [ERRAND.id, PLOT.id, WARDEN.id, GRUNT.id, GRUNT.id, ...copiesOf(NOISE.id, 14)],
    deck: [SQUIRE.id, SUIT.id, BANNER.id, VIGIL.id, ...EVENTS.map((e) => e.card.id)],
  });
  const staged = playAll(base, open, SEND_ERRAND, SEND_WARDEN, SEND_SQUIRE);
  const squire = idOf(staged, SQUIRE.id, P1);
  const ally = playerCardIntoPlay(staged, ALLY.id);
  const plot = encounterCardInVillainArea(ally.state, PLOT.id, 3);
  const grunt = minionEngagedWith(plot.state, GRUNT.id);
  const state = patch(patch(grunt.state, squire, { damage: 1 }), ally.id, { damage: 1 });
  return {
    state,
    errand: idOf(state, ERRAND.id),
    warden: idOf(state, WARDEN.id),
    squire,
    ally: ally.id,
    plot: plot.id,
    grunt: grunt.id,
  };
}
const threat = (state: GameState, id: InstanceId) => mustInstance(state, id).threat;
const damage = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
const villain = (state: GameState) => state.villains[0]!.instanceId;

describe("§3.33 (b) a closed area: abilities that do not refer to it", () => {
  it("the table: the scheme at 10 threat, the minion at 10 hit points, the ally at 1 damage of 3", () => {
    const t = table();
    expect(threat(t.state, t.errand)).toBe(10);
    // The minion's "+4 hit points" is its own text about itself: a card is not closed to its own abilities.
    expect(maxHitPoints(t.state, t.warden, deps)).toBe(10);
    expect(damage(t.state, t.squire)).toBe(1);
    expect(t.state.scenarioPlayAreas?.[AREA]?.cards).toEqual([t.errand, t.warden, t.squire]);
  });

  it("test 1: a heal and a ready of 'an ally' and a removal of 2 from 'a side scheme' do not offer the cards there; an attack offers the villain and not the minion", () => {
    const t = table();
    const tired = patch(patch(t.state, t.squire, { exhausted: true }), t.ally, { exhausted: true });
    const heal = play(tired, HEAL);
    expect(heal.offered).toEqual([[t.ally]]);
    expect(damage(heal.state, t.squire)).toBe(1);
    expect(damage(heal.state, t.ally)).toBe(0);
    const ready = play(tired, READY);
    expect(ready.offered).toEqual([[t.ally]]);
    expect(mustInstance(ready.state, t.squire).exhausted).toBe(true);
    const thwart = play(t.state, THWART);
    expect(thwart.offered).toEqual([[t.plot]]);
    expect(threat(thwart.state, t.errand)).toBe(10);
    expect(threat(thwart.state, t.plot)).toBe(1);
    const strike = play(t.state, STRIKE);
    expect(strike.offered).toEqual([[villain(t.state), t.grunt]]);
    expect(damage(strike.state, t.warden)).toBe(0);
  });

  it("test 2: 1 damage to 'each ally' or to each character leaves the ally there at 1 damage; 1 threat on 'each side scheme' leaves the mission at 10", () => {
    const t = table();
    const storm = play(t.state, STORM);
    expect(damage(storm.state, t.squire)).toBe(1);
    expect(damage(storm.state, t.ally)).toBe(2);
    const quake = play(t.state, QUAKE);
    expect(damage(quake.state, t.squire)).toBe(1);
    expect(damage(quake.state, t.warden)).toBe(0);
    expect(damage(quake.state, t.grunt)).toBe(1);
    const swell = play(t.state, SWELL);
    expect(threat(swell.state, t.errand)).toBe(10);
    expect(threat(swell.state, t.plot)).toBe(4);
  });

  it("a ref with no query does not reach in either: a card named by title is not found there", () => {
    const t = table();
    expect(damage(play(t.state, CALL_OUT).state, t.squire)).toBe(1);
  });

  it("a basic attack does not reach an enemy there: it is not among the legal targets, and the command is refused", () => {
    const t = table();
    const hero = mustPlayer(t.state, P1).identity.instanceId;
    const ready: GameState = {
      ...t.state,
      players: t.state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const listed = JSON.stringify(legalActions(ready, P1, deps));
    expect(listed).toContain(`"${t.grunt}"`);
    expect(listed).not.toContain(`"${t.warden}"`);
    const refused = sessionApply(
      startSession(ready),
      { type: "basicAttack", playerId: P1, attackerInstanceId: hero, targetInstanceId: t.warden },
      deps,
    );
    expect(refused.ok).toBe(false);
    // Nor a basic thwart the side scheme there.
    expect(listed).not.toContain(`"${t.errand}"`);
    expect(listed).toContain(`"${t.plot}"`);
  });
});

describe("§3.33 (b) abilities that refer to the area", () => {
  it("test 3: 'place 3 threat on the [MISSION] side scheme' takes it from 10 to 13 and touches no other scheme", () => {
    const t = table();
    const run = play(t.state, CRISIS);
    expect(threat(run.state, t.errand)).toBe(13);
    expect(threat(run.state, t.plot)).toBe(3);
  });

  it("'an ally at the mission' offers the ally there and no other", () => {
    const t = table();
    const run = play(t.state, SNIPE);
    expect(run.offered).toEqual([[t.squire]]);
    expect(damage(run.state, t.squire)).toBe(2);
    expect(damage(run.state, t.ally)).toBe(1);
  });

  it("`reaches` on the ability: the same 'named' ref finds the card there", () => {
    const t = table();
    expect(damage(play(t.state, CALL_IN).state, t.squire)).toBe(2);
  });

  it("a query that names an area matches nothing in a game that has none", () => {
    const base = gameAtFirstTurn({ cards: [], deps, villain: TYRANT, mainScheme: SCHEME });
    const context: EffectContext = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
    expect(cardsInPlay(base).some((id) => matchesQuery(base, id, THERE, context))).toBe(false);
  });

  it("the minion's own 'cannot take damage while another minion is at the mission': 3 damage lands on it alone, none while a second minion is there", () => {
    const t = table();
    expect(damage(play(t.state, VOLLEY).state, t.warden)).toBe(3);
    const crowded = play(t.state, SEND_GRUNT).state;
    const second = crowded.scenarioPlayAreas![AREA]!.cards.at(-1)!;
    const run = play(crowded, VOLLEY);
    expect(damage(run.state, t.warden)).toBe(0);
    // The second minion took its 3 and was defeated: the encounter discard pile, by its home.
    expect(cardsInPlay(run.state)).not.toContain(second);
    // The shield is gone with it.
    expect(damage(play(run.state, VOLLEY).state, t.warden)).toBe(3);
  });
});

describe("§3.33 (b) Q18 = A: reads see the cards there", () => {
  it("test 5: a count of 'side schemes in play' counts the mission (2 with the one in the villain's area)", () => {
    const t = table();
    const run = play(t.state, TALLY);
    expect(damage(run.state, villain(run.state))).toBe(2);
  });

  it("an event pattern hears a defeat there: 'after an ally is defeated' answers the ally at the mission", () => {
    const t = table();
    const vigil = playerCardIntoPlay(t.state, VIGIL.id);
    // 2 damage of 3 on the ally, then 1 from an ability that names the mission: defeated.
    const run = play(patch(vigil.state, t.squire, { damage: 2 }), SNIPE);
    expect(of(run.events, "characterDefeated").map((e) => e.instanceId)).toEqual([t.squire]);
    expect(mustPlayer(run.state, P1).discard).toContain(t.squire);
    expect(damage(run.state, villain(run.state))).toBe(1);
  });
});

describe("§3.33 (b) Q19 = B: an attachment does not open the area", () => {
  it("test 6: an ordinary '+2 hit points' upgrade on the ally there changes nothing (3 hit points, 2 remaining); she is defeated at 3 damage and both cards go to their owner's discard pile", () => {
    const t = table();
    const suited = attach(t.state, SUIT.id, t.squire);
    expect(maxHitPoints(suited.state, t.squire, deps)).toBe(3);
    expect(cardsInPlay(suited.state)).toContain(suited.id);
    // "Attached ally" names nobody for an ability with no reach.
    const context: EffectContext = { selfInstanceId: suited.id, controllerId: null, event: null, bindings: {}, deps };
    expect(resolveRef(suited.state, { kind: "host" }, context)).toEqual([]);
    // Two more damage, 1 at a time, from an ability that names the mission.
    const once = play(suited.state, SNIPE);
    expect(damage(once.state, t.squire)).toBe(2);
    expect(cardsInPlay(once.state)).toContain(t.squire);
    const twice = play(once.state, SNIPE);
    expect(cardsInPlay(twice.state)).not.toContain(t.squire);
    expect(mustPlayer(twice.state, P1).discard).toEqual(expect.arrayContaining([t.squire, suited.id]));
  });

  it("test 6, the fixture: the same text on an ability that declares `reaches` gives her 5 hit points", () => {
    const t = table();
    const bannered = attach(t.state, BANNER.id, t.squire);
    expect(maxHitPoints(bannered.state, t.squire, deps)).toBe(5);
    const context: EffectContext = {
      selfInstanceId: bannered.id,
      controllerId: null,
      event: null,
      bindings: {},
      deps,
      reaches: INTO,
    };
    expect(resolveRef(bannered.state, { kind: "host" }, context)).toEqual([t.squire]);
    // And outside the area both upgrades work as printed.
    expect(maxHitPoints(attach(t.state, SUIT.id, t.ally).state, t.ally, deps)).toBe(5);
  });
});

describe("§3.33 (b) an area that is not closed", () => {
  it("is in play and uncontrolled, and any ability reaches it: a heal of 'an ally' offers the ally there", () => {
    const t = table(OPEN_WIDE);
    expect(t.state.scenarioPlayAreas?.[AREA]?.closed).toBe(false);
    const heal = play(t.state, HEAL);
    expect(heal.offered).toEqual([[t.ally, t.squire]]);
    expect(play(t.state, SWELL, P2).state.instances[t.errand]?.threat).toBe(11);
  });
});
