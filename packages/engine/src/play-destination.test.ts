/**
 * docs/phase7-wave8.md §3.34: an ally played into an in-play scenario area (`RuleSpec playDestination`, the `playCard`
 * command's `into`, `LegalAction.destinations`).
 *
 * MC45 p. 5: "While a [MISSION] side scheme is in play, when a player plays an ally, they must choose: either play
 * that ally into their game area per the normal rules of the game, or play it into the mission area." / "Allies in the
 * mission area … do not count towards your ally limit." / "Treat the printed text box of each ally in the mission area
 * as blank, except for [TRAITS]." / "Players may attach upgrades to allies in the mission area." RRG 1.8 "Play, Put
 * into Play" (p. 32); "Ally Limit" (p. 7); "Unique Icon" (pp. 45–46); "Ownership and Control" (p. 31).
 *
 * The rules are the scenario's (`GameSetupConfig.scenarioRuleSpecs`), as a campaign passes them: the engine names no
 * card. Synthetic cards only.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { characterStat, locateCard, maxHitPoints, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay, controllerOf } from "./select.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { ALLY, giveCard, RESOURCE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const AREA = "mission";
const INTO = { scenarioPlayArea: AREA } as const;
const THERE = { inScenarioPlayArea: AREA } as const;
const n = (value: number): ValueSpec => ({ kind: "const", value });
const you = { kind: "controller" } as const;
const HOST = { hostOfSelf: true } as const;

/** The scheme whose presence in the area is the rule's condition. */
const ERRAND = stubSideScheme({ id: "errand", startingThreat: 5, boostIcons: 0 });
const schemeThere: Predicate = { kind: "exists", query: { categories: ["sideScheme"], ...THERE } };
const RULES: readonly RuleSpec[] = [
  {
    kind: "playDestination",
    cards: { categories: ["ally"] },
    area: AREA,
    attachments: { categories: ["upgrade"] },
    while: schemeThere,
  },
  { kind: "blankTextBox", target: { categories: ["ally"], ...THERE } },
];

/** "Response: After this ally enters play, deal 2 damage to the villain." Cost 3, hero form only. */
const SCOUT_RESPONSE = stubAbility("scout.response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: n(2) }],
});
const SCOUT = {
  ...stubAlly({ id: "scout", cost: 3, atk: 2, thw: 1, hp: 2, abilities: [SCOUT_RESPONSE.ref] }),
  playRestrictions: { form: "hero" as const },
};
const TANK = stubAlly({ id: "tank", cost: 0, atk: 1, thw: 1, hp: 3, keywords: [{ name: "toughness" }] });
const PALADIN = { ...stubAlly({ id: "paladin", cost: 0, atk: 1, thw: 1, hp: 3 }), unique: true };
/** "Attach to an ally. Max 1 per ally. Attached ally gets +2 hit points." Cost 1. An ordinary upgrade. */
const SUIT_CONSTANT = stubAbility("suit.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "hp", amount: 2, target: HOST }] },
  effects: [],
});
const SUIT = {
  ...stubUpgrade({ id: "suit", cost: 1, abilities: [SUIT_CONSTANT.ref] }),
  attachesTo: { kind: "ally" as const },
  playRestrictions: { maxPerHost: 1 },
};
/** "Attach to an ally. Limit 1 per ally. Attached ally gets +1 THW, +1 ATK and +1 hit point." An ability that reaches. */
const ORDERS_CONSTANT = stubAbility("orders.constant", {
  trigger: {
    kind: "constant",
    modifiers: [
      { stat: "thw", amount: 1, target: HOST },
      { stat: "atk", amount: 1, target: HOST },
      { stat: "hp", amount: 1, target: HOST },
    ],
  },
  reaches: INTO,
  effects: [],
});
const ORDERS = {
  ...stubUpgrade({ id: "orders", cost: 1, abilities: [ORDERS_CONSTANT.ref] }),
  attachesTo: { kind: "ally" as const },
  playRestrictions: { maxPerHost: 1 },
};
/** "Forced Response: After you play an ally, deal 1 damage to the villain." Proof that it is a play. */
const DRUM_RESPONSE = stubAbility("drum.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "cardPlayed", playerIs: "controller", targetIs: { categories: ["ally"] } },
  },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: n(1) }],
});
const DRUM = stubSupport({ id: "drum", cost: 0, abilities: [DRUM_RESPONSE.ref] });

const action = (id: string, ...effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const find = (name: string): TargetRef => ({ kind: "find", query: { name } });
const OPEN = action(
  "open",
  { kind: "createScenarioPlayArea", name: AREA, closed: true },
  { kind: "putIntoPlay", card: find(ERRAND.name), controller: you, into: INTO },
);
/** "Deal 1 damage to each ally at the mission." */
const SHELL = action("shell", {
  kind: "dealDamage",
  target: { kind: "each", query: { categories: ["ally"], ...THERE } },
  amount: n(1),
});
/** "Remove the side scheme at the mission from the game": the rule's condition ends. */
const CLOSE = action("close", {
  kind: "moveCards",
  cards: { kind: "ref", ref: { kind: "each", query: { categories: ["sideScheme"], ...THERE } } },
  to: "removedFromGame",
});
/** "Put a tank from your hand into play": an effect, not a play. */
const MUSTER = action("muster", {
  kind: "putIntoPlay",
  card: { kind: "find", query: { name: TANK.name }, owner: you },
  controller: you,
});
const EVENTS = [OPEN, SHELL, CLOSE, MUSTER];

const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const TYRANT = stubVillain({ id: "tyrant", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });
const deps: EngineDeps = depsOf(
  SCOUT_RESPONSE,
  SUIT_CONSTANT,
  ORDERS_CONSTANT,
  DRUM_RESPONSE,
  ...EVENTS.map((e) => e.ability),
);

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const areaCards = (state: GameState) => state.scenarioPlayAreas?.[AREA]?.cards ?? [];
const villainDamage = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).damage;
const heroForm = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
});
const apply = (state: GameState, ...commands: readonly Command[]) => {
  const { session, events } = driveSession(startSession(state), deps, commands);
  return { state: session.state, events, session };
};
const playFree = (state: GameState, card: { card: { id: CardId } }) => {
  const given = giveCard(state, P1, card.card.id);
  return apply(given.state, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  }).state;
};

/** P1 in hero form at their turn, the area open with its scheme in it. */
function start(withScheme = true): GameState {
  const base = gameAtFirstTurn({
    cards: [ERRAND, SCOUT, TANK, PALADIN, SUIT, ORDERS, DRUM, NOISE, ...EVENTS.map((e) => e.card)],
    deps,
    villain: TYRANT,
    mainScheme: SCHEME,
    players: 2,
    encounter: [ERRAND.id, ...copiesOf(NOISE.id, 14)],
    deck: [
      SCOUT.id,
      TANK.id,
      PALADIN.id,
      SUIT.id,
      SUIT.id,
      ORDERS.id,
      ORDERS.id,
      DRUM.id,
      ...EVENTS.map((e) => e.card.id),
    ],
    scenarioRuleSpecs: RULES,
  });
  const opened = heroForm(playFree(base, OPEN));
  return withScheme ? opened : heroForm(playFree(opened, CLOSE));
}

/** Plays `card` from P1's hand, paying its cost with resource cards, optionally into the area or onto a host. */
function play(
  state: GameState,
  card: CardId,
  opts: { into?: boolean; host?: InstanceId; cost?: number; player?: PlayerId } = {},
) {
  const player = opts.player ?? P1;
  const given = giveCard(state, player, card);
  let current = given.state;
  const payment: Payment[] = [];
  const used: InstanceId[] = [];
  for (let i = 0; i < (opts.cost ?? 0); i++) {
    const resource = giveCard(current, player, RESOURCE.id, used);
    current = resource.state;
    used.push(resource.id);
    payment.push({ fromHand: resource.id });
  }
  const command: Command = {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment,
    attachToInstanceId: opts.host ?? null,
    ...(opts.into ? { into: INTO } : {}),
  };
  const result = sessionApply(startSession(current), command, deps);
  if (!result.ok) return { ok: false as const, error: result.error, id: given.id, before: current, paid: used };
  const driven = driveSession(result.session, deps);
  return {
    ok: true as const,
    id: given.id,
    state: driven.session.state,
    events: [...result.events, ...driven.events],
    session: driven.session,
    paid: used,
  };
}
const mustPlay = (...args: Parameters<typeof play>) => {
  const result = play(...args);
  if (!result.ok) throw new Error(result.error.message);
  return result;
};

describe("§3.34 an ally played into the area", () => {
  it("test 1: with three allies under their control, a cost-3 ally played to the area is paid for in full, makes four allies in play and three controlled, and nobody discards; a fourth to their own area makes them discard", () => {
    let state = start();
    for (let i = 0; i < 3; i++) state = playerCardIntoPlay(state, ALLY.id).state;
    const run = mustPlay(state, SCOUT.id, { into: true, cost: 3 });
    expect(areaCards(run.state)).toContain(run.id);
    expect(locateCard(run.state, run.id)).toEqual({ kind: "scenarioPlayArea", name: AREA });
    // Three resources paid: the three cards are in the discard pile.
    for (const id of run.paid) expect(mustPlayer(run.state, P1).discard).toContain(id);
    expect(mustInstance(run.state, run.id)).toMatchObject({ ownerId: P1, controllerId: null, engagedWith: null });
    const allies = cardsInPlay(run.state).filter(
      (id) => run.state.cardPool[run.state.instances[id]!.cardId]?.type === "ally",
    );
    expect(allies).toHaveLength(4);
    expect(allies.filter((id) => controllerOf(run.state, id) === P1)).toHaveLength(3);
    expect(run.state.pendingChoice).toBeNull();
    expect(of(run.events, "cardDiscardedFromPlay")).toHaveLength(0);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);

    // A fourth ally to their own area: the ally limit applies as ever, and one of the four they control goes.
    const fourth = mustPlay(run.state, TANK.id);
    const mine = cardsInPlay(fourth.state).filter(
      (id) =>
        fourth.state.cardPool[fourth.state.instances[id]!.cardId]?.type === "ally" &&
        controllerOf(fourth.state, id) === P1,
    );
    expect(mine).toHaveLength(3);
    expect(areaCards(fourth.state)).toContain(run.id);
  });

  it("legal actions list the destination beside the ordinary play, and the play to the player's own area is unchanged", () => {
    const given = giveCard(start(), P1, TANK.id);
    const listed = legalActions(given.state, P1, deps);
    if (listed.kind !== "turn") throw new Error(listed.kind);
    const entry = listed.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === given.id);
    expect(entry?.destinations).toEqual([AREA]);
    expect(entry?.example).not.toHaveProperty("into");
    const own = mustPlay(given.state, TANK.id);
    expect(mustPlayer(own.state, P1).playArea).toContain(own.id);
    expect(controllerOf(own.state, own.id)).toBe(P1);
    // Toughness works as printed in the player's own area.
    expect(mustInstance(own.state, own.id).statuses.tough).toBe(1);
  });

  it("test 2: its text box is blank there: the 'enters play' response does not resolve; the same ally in the player's own area deals its 2 damage", () => {
    const there = mustPlay(start(), SCOUT.id, { into: true, cost: 3 });
    expect(villainDamage(there.state)).toBe(0);
    const here = mustPlay(start(), SCOUT.id, { cost: 3 });
    expect(villainDamage(here.state)).toBe(2);
    // Printed stats and hit points are not text box: they stay.
    expect(characterStat(there.state, there.id, "atk", deps)).toBe(2);
    expect(maxHitPoints(there.state, there.id, deps)).toBe(2);
  });

  it("test 2: a play restriction is checked before the destination matters: in the wrong form the play is refused for either", () => {
    const alterEgo: GameState = {
      ...start(),
      players: start().players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const } })),
    };
    const own = play(alterEgo, SCOUT.id, { cost: 3 });
    const there = play(alterEgo, SCOUT.id, { into: true, cost: 3 });
    expect(own.ok).toBe(false);
    expect(there.ok).toBe(false);
    if (!own.ok && !there.ok) expect(there.error.code).toBe(own.error.code);
  });

  it("test 3: a unique ally there stops every player from playing that character to either place", () => {
    const first = mustPlay(start(), PALADIN.id, { into: true });
    // The next player's turn: their own card of that character.
    const theirs = heroForm(apply(first.state, { type: "endTurn", playerId: P1 }).state);
    for (const into of [false, true]) {
      const again = play(theirs, PALADIN.id, { into, player: P2 });
      expect(again.ok, `into ${into}`).toBe(false);
      if (!again.ok) expect(again.error.code).toBe("duplicate_unique_card");
    }
  });

  it("test 5: an ally with toughness played there gets no tough status card", () => {
    const run = mustPlay(start(), TANK.id, { into: true });
    expect(mustInstance(run.state, run.id).statuses.tough).toBe(0);
  });

  it("test 6: with the rule's condition ended (no scheme in the area) there is no destination: none listed, and `into` is refused", () => {
    const state = start(false);
    const given = giveCard(state, P1, TANK.id);
    const listed = legalActions(given.state, P1, deps);
    if (listed.kind !== "turn") throw new Error(listed.kind);
    const entry = listed.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === given.id);
    expect(entry).toBeDefined();
    expect(entry?.destinations).toBeUndefined();
    const refused = play(state, TANK.id, { into: true });
    expect(refused.ok).toBe(false);
    // Nothing was paid or moved by the refused command.
    if (!refused.ok) expect(mustPlayer(refused.before, P1).hand).toContain(refused.id);
  });

  it("it is a play, and only a play has the choice: 'after you play an ally' answers it; an ally an effect puts into play goes to the player's own area", () => {
    const drum = playerCardIntoPlay(start(), DRUM.id);
    const run = mustPlay(drum.state, TANK.id, { into: true });
    expect(villainDamage(run.state)).toBe(1);
    const given = giveCard(start(), P1, TANK.id);
    const mustered = playFree(given.state, MUSTER);
    expect(mustPlayer(mustered, P1).playArea).toContain(given.id);
    expect(areaCards(mustered)).not.toContain(given.id);
  });

  it("no player can use it: it is not among any player's characters, and a basic attack with it is refused", () => {
    const run = mustPlay(start(), TANK.id, { into: true });
    const listed = JSON.stringify(legalActions(run.state, P1, deps));
    expect(listed).not.toContain(`"attackerInstanceId":"${run.id}"`);
    expect(listed).not.toContain(`"thwarterInstanceId":"${run.id}"`);
    const refused = sessionApply(
      startSession(run.state),
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: run.id,
        targetInstanceId: run.state.villains[0]!.instanceId,
      },
      deps,
    );
    expect(refused.ok).toBe(false);
  });

  it("a card the rule does not name has no such destination: a support played with `into` is refused", () => {
    expect(play(start(), DRUM.id, { into: true }).ok).toBe(false);
  });
});

describe("§3.34 upgrades on an ally in the area", () => {
  it("test 7: an ordinary upgrade (cost 1) may be played on her: the resource is paid, it is attached and uncontrolled, and she is unchanged; in her controller's own area the same upgrade gives +2 hit points", () => {
    const ally = mustPlay(start(), SCOUT.id, { into: true, cost: 3 });
    const suit = mustPlay(ally.state, SUIT.id, { host: ally.id, cost: 1 });
    expect(mustInstance(suit.state, suit.id)).toMatchObject({ attachedTo: ally.id, controllerId: null, ownerId: P1 });
    for (const id of suit.paid) expect(mustPlayer(suit.state, P1).discard).toContain(id);
    expect(maxHitPoints(suit.state, ally.id, deps)).toBe(2);
    expect(characterStat(suit.state, ally.id, "thw", deps)).toBe(1);
    expect(characterStat(suit.state, ally.id, "atk", deps)).toBe(2);

    const own = mustPlay(start(), SCOUT.id, { cost: 3 });
    const suited = mustPlay(own.state, SUIT.id, { host: own.id, cost: 1 });
    expect(maxHitPoints(suited.state, own.id, deps)).toBe(4);
  });

  it("tests 4 and 7: an upgrade whose ability reaches the area applies beside it (THW 2, ATK 3, 3 hit points); a second copy on her is refused; defeated, all three cards are in their owner's discard pile", () => {
    const ally = mustPlay(start(), SCOUT.id, { into: true, cost: 3 });
    const suit = mustPlay(ally.state, SUIT.id, { host: ally.id, cost: 1 });
    const orders = mustPlay(suit.state, ORDERS.id, { host: ally.id, cost: 1 });
    expect(characterStat(orders.state, ally.id, "thw", deps)).toBe(2);
    expect(characterStat(orders.state, ally.id, "atk", deps)).toBe(3);
    expect(maxHitPoints(orders.state, ally.id, deps)).toBe(3);
    const second = play(orders.state, ORDERS.id, { host: ally.id, cost: 1 });
    expect(second.ok).toBe(false);
    // 3 damage, 1 at a time, from an ability that names the area.
    let state = orders.state;
    for (let i = 0; i < 3; i++) state = playFree(state, SHELL);
    expect(cardsInPlay(state)).not.toContain(ally.id);
    expect(mustPlayer(state, P1).discard).toEqual(expect.arrayContaining([ally.id, suit.id, orders.id]));
    expect(areaCards(state)).toHaveLength(1);
  });

  it("the host choice lists an ally there only while the rule is in effect", () => {
    const ally = mustPlay(start(), TANK.id, { into: true });
    const given = giveCard(ally.state, P1, SUIT.id);
    const listed = legalActions(given.state, P1, deps);
    if (listed.kind !== "turn") throw new Error(listed.kind);
    const entry = listed.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === given.id);
    expect(entry?.targets).toContain(ally.id);
    // The scheme gone, the rule is off: the ally there is no host, and a play naming her is refused.
    const off = heroForm(playFree(ally.state, CLOSE));
    expect(play(off, SUIT.id, { host: ally.id, cost: 1 }).ok).toBe(false);
  });
});
