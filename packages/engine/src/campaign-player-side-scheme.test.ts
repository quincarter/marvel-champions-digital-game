/**
 * docs/phase7-wave7.md §3.43 items 2–5, §4.1 Q24: a campaign's player side scheme, end to end. A double-sided card
 * whose front is a player side scheme the players as a group put into play ("Put the chosen player side scheme into
 * play", MC40 rulebook p. 7), so nobody played it and nobody controls it, and whose back is an environment it flips to
 * when defeated ("When Defeated: Flip this card and put [the environment] into play.").
 *
 * Synthetic cards: three such fronts with "4 per player" starting threat, each reading "This scheme does not count
 * against the player side scheme limit."; their environments ("Enters play with 1 supply counter on it. Action: Remove
 * 1 supply counter from here → each player draws 1 card and you take 1 damage. (Any player can do this.)", "Each hero
 * gets +1 DEF.", and one with no text); a fourth front without the limit text; one whose When Defeated removes threat
 * from the main scheme.
 *
 * Sources: RRG 1.8 "Player Side Scheme" (p. 34: starting threat, "Heroes and allies can remove threat from a player
 * side scheme by performing a basic thwart", defeated with no threat on it), "Player Elimination" (p. 33: only the
 * eliminated player's own cards and the cards in their play area leave), "Flip" (p. 20: a different card type discards
 * tokens; the card stays in play), "Double-Sided Card" (p. 17: removed from the game instead of entering a discard
 * pile), "When Defeated Abilities" (p. 48: the card leaves play after its When Defeated), "Crisis Icon" (p. 14: "by
 * player cards"); MC40 rulebook p. 3 ("All rules that apply to player cards apply to player side schemes").
 *
 * Readings pinned here:
 * - "Put [the environment] into play" is an entry into play and not a reveal: the back's "Enters play with 1 counter"
 *   applies (docs/phase7-wave4.md §4 Q17: a new face is treated as entering play) and nothing is revealed.
 * - An Action on a card nobody controls is offered to the active player, whoever that is ("Any player can do this"),
 *   and "you" in it is the player who used it.
 * - A front with Victory would not reach the victory display: its When Defeated resolves first and turns it into a
 *   card that is not the defeated scheme, so it stays in play. The printed fronts have no Victory keyword.
 */

import { flat, perPlayerOnly, type AnyCard, type CardId, type PlayerSideSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { characterProfile, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { ALLY, giveCard } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const you = { kind: "controller" } as const;
const self = { kind: "self" } as const;
const MAIN = { kind: "mainScheme" } as const;
const eachSideScheme = { kind: "each", query: { categories: ["sideScheme"] } } as const;

/** "This scheme does not count against the player side scheme limit." */
const EXEMPT = stubAbility("front.constant", {
  trigger: { kind: "constant", rules: [{ kind: "excludedFromPlayerSideSchemeLimit", target: { self: true } }] },
  effects: [],
});
/** "When Defeated: Flip this card and put [its environment] into play." */
const FLIP = stubAbility("front.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "flipCard", target: self }],
});
/** "When Defeated: Remove 3 threat from the main scheme." (No player is named.) */
const RELIEF_DEFEATED = stubAbility("relief.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "removeThreat", target: MAIN, amount: n(3) }],
});

/** "Enters play with 1 supply counter on it." */
const DEPOT_ENTERS = stubAbility(
  "depot.enters-play",
  def({
    trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
    effects: [{ kind: "addCounters", target: self, counterType: "supply", amount: n(1) }],
  }),
);
/** "Action: Remove 1 supply counter from here → each player draws 1 card and you take 1 damage." */
const DEPOT_ACTION = stubAbility(
  "depot.action",
  def({
    trigger: { kind: "action" },
    cost: { spendCounters: { counterType: "supply", amount: 1 } },
    effects: [
      {
        kind: "forEachPlayer",
        players: { kind: "each" },
        effects: [{ kind: "draw", player: { kind: "scoped" }, amount: n(1) }],
      },
      { kind: "dealDamage", target: { kind: "identityOf", player: you }, amount: n(1) },
    ],
  }),
);
/** "Each hero gets +1 DEF." */
const BULWARK_CONSTANT = stubAbility("bulwark.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "def", amount: 1, target: { categories: ["hero"] } }] },
  effects: [],
});

function front(id: string, extra: Partial<PlayerSideSchemeCard> = {}): PlayerSideSchemeCard {
  return {
    ...stubSupport({ id, cost: 0 }),
    type: "player_side_scheme",
    startingThreat: perPlayerOnly(4),
    abilities: [EXEMPT.ref, FLIP.ref],
    ...extra,
  };
}
const faces = <A extends AnyCard, B extends AnyCard>(a: A, b: B): readonly [A, B] => [
  { ...a, otherFaceId: b.id as CardId },
  { ...b, otherFaceId: a.id as CardId },
];
const [STOCK_UP, DEPOT] = faces(
  front("stock-up"),
  stubEnvironment({ id: "depot", abilities: [DEPOT_ENTERS.ref, DEPOT_ACTION.ref] }),
);
const [DIG_IN, BULWARK] = faces(front("dig-in"), stubEnvironment({ id: "bulwark", abilities: [BULWARK_CONSTANT.ref] }));
/** The same front with Victory 1. */
const [TROPHY, SHELF] = faces(
  front("trophy", { keywords: [{ name: "victory", value: 1 }] }),
  stubEnvironment({ id: "shelf" }),
);
/** A front with no text about the limit: it counts toward it. */
const [COUNTED, TALLY] = faces(front("counted", { abilities: [FLIP.ref] }), stubEnvironment({ id: "tally" }));
/** Single-faced, nobody's: "When Defeated: Remove 3 threat from the main scheme." */
const RELIEF = front("relief", { abilities: [RELIEF_DEFEATED.ref] });
/** A player's own player side scheme, 1 threat. */
const ERRAND: PlayerSideSchemeCard = {
  ...stubSupport({ id: "errand", cost: 0 }),
  type: "player_side_scheme",
  startingThreat: flat(1),
};
const CAMPAIGN_CARDS = [STOCK_UP, DEPOT, DIG_IN, BULWARK, TROPHY, SHELF, COUNTED, TALLY, RELIEF];

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects: [...effects] });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** The scenario's "put [the chosen player side scheme] into play", from the cards nobody owns. */
const putIntoPlay = (card: AnyCard) =>
  event(`put-${card.id}`, [
    { kind: "selectCards", slot: "found", cards: { kind: "encounter", zones: ["deck"], filter: { name: card.name } } },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: you },
  ]);
const PUT = {
  [STOCK_UP.id]: putIntoPlay(STOCK_UP),
  [DIG_IN.id]: putIntoPlay(DIG_IN),
  [TROPHY.id]: putIntoPlay(TROPHY),
  [COUNTED.id]: putIntoPlay(COUNTED),
  [RELIEF.id]: putIntoPlay(RELIEF),
};
/** "Place 1 threat on the main scheme." */
const CUE = event("cue", [{ kind: "placeThreat", target: MAIN, amount: n(1) }]);
/** "Discard each side scheme." */
const SCRAP = event("scrap", [{ kind: "discardFromPlay", target: eachSideScheme }]);
/** Defeats the identity of the player who plays it. */
const DOOM = event("doom", [{ kind: "dealDamage", target: { kind: "identityOf", player: you }, amount: n(50) }]);
/** "Deal 1 damage to the villain for each side scheme in play." */
const TALLY_UP = event("tally-up", [
  { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "count", query: { categories: ["sideScheme"] } } },
]);
const EVENTS = [...Object.values(PUT), CUE, SCRAP, DOOM, TALLY_UP];

/**
 * An environment: "Forced Response: After threat is placed on the main scheme, remove 9 threat from each side scheme."
 * An encounter card's forced ability, so no player removes that threat.
 */
const SABOTAGE_FORCED = stubAbility(
  "sabotage.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "placeThreat", targetIs: { categories: ["mainScheme"] } } },
    effects: [{ kind: "removeThreat", target: eachSideScheme, amount: n(9) }],
  }),
);
const SABOTAGE = stubEnvironment({ id: "sabotage", abilities: [SABOTAGE_FORCED.ref] });
/** A side scheme with a crisis icon. */
const SIEGE = stubSideScheme({ id: "siege", startingThreat: 30, icons: ["crisis"] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(
  EXEMPT,
  FLIP,
  RELIEF_DEFEATED,
  DEPOT_ENTERS,
  DEPOT_ACTION,
  BULWARK_CONSTANT,
  SABOTAGE_FORCED,
  ...EVENTS.map((e) => e.ability),
);
const PLAYER_CARDS: readonly AnyCard[] = [ERRAND, ...EVENTS.map((e) => e.card)];

/** Each player in hero form at the first player's first turn, the main scheme at 10 threat. */
function start(players: 1 | 2 = 2): GameState {
  const base = gameAtFirstTurn({
    players,
    cards: [...PLAYER_CARDS, ...CAMPAIGN_CARDS, SABOTAGE, SIEGE, FILLER],
    deps,
    deck: PLAYER_CARDS.map((card) => card.id),
    encounter: [
      STOCK_UP.id,
      DIG_IN.id,
      TROPHY.id,
      COUNTED.id,
      RELIEF.id,
      SABOTAGE.id,
      SIEGE.id,
      ...copiesOf(FILLER.id, 30),
    ],
  });
  const main = base.mainScheme.instanceId;
  return {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    instances: { ...base.instances, [main]: { ...mustInstance(base, main), threat: 10 } },
  };
}

interface Step {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
function run(state: GameState, ...commands: readonly Command[]): Step {
  const { session, events } = driveSession(startSession(state), deps, commands);
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
/** `player` plays `card` from hand for 0; the step's `id` is the played card. */
function play(state: GameState, card: AnyCard, player: PlayerId = P1): Step & { readonly id: InstanceId } {
  const given = giveCard(state, player, card.id);
  const step = run(given.state, {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
  return { ...step, id: given.id };
}
/** `scheme` put into play by the scenario; the step's `id` is the scheme. */
function inPlay(state: GameState, scheme: PlayerSideSchemeCard): Step & { readonly id: InstanceId } {
  const put = PUT[scheme.id];
  if (!put) throw new Error(`no put-into-play event for ${scheme.id}`);
  const step = play(state, put.card);
  const id = step.state.villainArea.find((card) => mustInstance(step.state, card).cardId === scheme.id);
  if (!id) throw new Error(`${scheme.id} did not enter play`);
  return { ...step, id };
}
const endTurn = (state: GameState, player: PlayerId = P1) => run(state, { type: "endTurn", playerId: player }).state;
const hero = (state: GameState, player: PlayerId) => mustPlayer(state, player).identity.instanceId;
const heroDamage = (state: GameState, player: PlayerId) => mustInstance(state, hero(state, player)).damage;
const villainDamage = (state: GameState) => mustInstance(state, state.activeVillainId).damage;
const mainThreat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const threat = (state: GameState, id: InstanceId) => mustInstance(state, id).threat;
const handSize = (state: GameState, player: PlayerId) => mustPlayer(state, player).hand.length;
const withThreat = (state: GameState, id: InstanceId, value: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), threat: value } },
});
const thwart = (player: PlayerId, thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
/** P1's hero (THW 2) removes the scheme's last 2 threat. */
const defeatedByPlayer = (state: GameState, scheme: InstanceId) =>
  run(withThreat(state, scheme, 2), thwart(P1, hero(state, P1), scheme));
/** P1's event places 1 threat on the main scheme; the sabotage answers and removes every side scheme's threat. */
const defeatedByEncounter = (state: GameState) => play(encounterCardInVillainArea(state, SABOTAGE.id).state, CUE.card);
const everyPile = (state: GameState) => [
  ...state.players.flatMap((p) => [...p.discard, ...p.hand, ...p.deck, ...p.playArea]),
  ...Object.values(state.encounterDecks).flatMap((piles) => [...piles.deck, ...piles.discard]),
  ...state.victoryDisplay,
];
const useDepot = (player: PlayerId, depot: InstanceId): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: depot,
  abilityId: DEPOT_ACTION.ref.id,
  payment: [],
});
/** Whether the depot's Action is among `player`'s legal actions right now. */
function offered(state: GameState, player: PlayerId, depot: InstanceId): boolean {
  const actions = legalActions(state, player, deps);
  return (
    actions.kind === "turn" &&
    actions.legal.some((entry) => entry.action.kind === "useAbility" && entry.action.instanceId === depot)
  );
}

describe("put into play by the scenario: nobody's card", () => {
  it.each([
    [1, 4],
    [2, 8],
  ] as const)(
    "in a %i-player game it enters the villain's area with %i threat, owned and controlled by no player",
    (players, expected) => {
      const put = inPlay(start(players), STOCK_UP);
      expect(mustInstance(put.state, put.id)).toMatchObject({
        cardId: STOCK_UP.id,
        ownerId: null,
        controllerId: null,
        faceup: true,
        threat: expected,
      });
      expect(put.events.filter((e) => e.type === "threatPlaced" && e.schemeInstanceId === put.id)).toEqual([
        expect.objectContaining({ amount: expected, sourceInstanceId: null }),
      ]);
      for (const seat of put.state.players) expect(seat.playArea).not.toContain(put.id);
    },
  );

  it("its own text keeps it out of the limit: a scheme played beside it asks nothing and both stay", () => {
    const put = inPlay(start(2), STOCK_UP);
    const errand = play(put.state, ERRAND);
    expect(errand.events.filter((e) => e.type === "playerSideSchemeLimitDiscard")).toEqual([]);
    expect(errand.state.villainArea).toEqual(expect.arrayContaining([put.id, errand.id]));
  });
});

describe("any player's hero and allies may thwart it (RRG 1.8 p. 34)", () => {
  it("each player's hero removes its THW on that player's turn", () => {
    const put = inPlay(start(2), STOCK_UP);
    const first = run(put.state, thwart(P1, hero(put.state, P1), put.id));
    expect(threat(first.state, put.id)).toBe(6);
    const second = run(endTurn(first.state), thwart(P2, hero(first.state, P2), put.id));
    expect(threat(second.state, put.id)).toBe(4);
    expect(second.events).toContainEqual(
      expect.objectContaining({ type: "threatRemoved", schemeInstanceId: put.id, amount: 2 }),
    );
  });

  it("an ally of either player removes its THW", () => {
    const put = inPlay(start(2), STOCK_UP);
    const mine = playerCardIntoPlay(put.state, ALLY.id, P1);
    const theirs = playerCardIntoPlay(mine.state, ALLY.id, P2);
    const first = run(theirs.state, thwart(P1, mine.id, put.id));
    expect(threat(first.state, put.id)).toBe(7);
    const second = run(endTurn(first.state), thwart(P2, theirs.id, put.id));
    expect(threat(second.state, put.id)).toBe(6);
  });

  it("is among both players' basic thwart targets", () => {
    const put = inPlay(start(2), STOCK_UP);
    for (const [player, state] of [
      [P1, put.state],
      [P2, endTurn(put.state)],
    ] as const) {
      const actions = legalActions(state, player, deps);
      const entry =
        actions.kind === "turn"
          ? actions.legal.find((a) => a.action.kind === "basicThwart" && a.action.instanceId === hero(state, player))
          : undefined;
      expect(entry?.targets).toContain(put.id);
    }
  });
});

describe("a player is eliminated (RRG 1.8 'Player Elimination', p. 33): it stays", () => {
  it.each([
    ["the first player", P1],
    ["the other player", P2],
  ] as const)("%s is eliminated: in play, with its threat, still nobody's", (_, gone) => {
    const put = inPlay(start(2), STOCK_UP);
    const turn = gone === P1 ? put.state : endTurn(put.state);
    const after = play(turn, DOOM.card, gone);
    expect(mustPlayer(after.state, gone).eliminated).toBe(true);
    expect(after.state.outcome).toBeNull();
    expect(locateCard(after.state, put.id)).toEqual({ kind: "villainArea" });
    expect(mustInstance(after.state, put.id)).toMatchObject({ cardId: STOCK_UP.id, threat: 8, controllerId: null });
  });

  it("the remaining player still thwarts and defeats it, and its environment enters play", () => {
    const put = inPlay(start(2), STOCK_UP);
    const alone = play(put.state, DOOM.card, P1);
    const turn = withThreat(endTurn(alone.state), put.id, 2);
    const after = run(turn, thwart(P2, hero(turn, P2), put.id));
    expect(mustInstance(after.state, put.id)).toMatchObject({ cardId: DEPOT.id, counters: { supply: 1 } });
  });
});

describe("an effect discards it: removed from the game (RRG 1.8 'Double-Sided Card', p. 17)", () => {
  it("is in no discard pile, hand, deck or play area, and does not flip", () => {
    const put = inPlay(start(2), STOCK_UP);
    const after = play(put.state, SCRAP.card);
    expect(locateCard(after.state, put.id)).toEqual({ kind: "removedFromGame" });
    expect(after.state.removedFromGame).toContain(put.id);
    expect(everyPile(after.state)).not.toContain(put.id);
    expect(after.state.villainArea).not.toContain(put.id);
    // Discarded, not defeated: its When Defeated does not resolve.
    expect(mustInstance(after.state, put.id).cardId).toBe(STOCK_UP.id);
    expect(after.events.some((e) => e.type === "schemeDefeated" || e.type === "cardFlippedToOtherFace")).toBe(false);
  });
});

describe("defeated: it flips to its environment, which is put into play", () => {
  it.each([
    ["a player's thwart", (state: GameState, id: InstanceId) => defeatedByPlayer(state, id)],
    ["an encounter card's ability", (state: GameState) => defeatedByEncounter(state)],
  ] as const)(
    "by %s: the environment is in the villain's area, nobody's, with its 1 counter and no threat",
    (_, defeat) => {
      const put = inPlay(start(2), STOCK_UP);
      const after = defeat(put.state, put.id);
      expect(locateCard(after.state, put.id)).toEqual({ kind: "villainArea" });
      expect(mustInstance(after.state, put.id)).toMatchObject({
        cardId: DEPOT.id,
        ownerId: null,
        controllerId: null,
        faceup: true,
        threat: 0,
        counters: { supply: 1 },
      });
      expect(everyPile(after.state)).not.toContain(put.id);
      expect(after.state.removedFromGame).not.toContain(put.id);
    },
  );

  it("the log has the defeat, then the flip, and no reveal of the environment", () => {
    const put = inPlay(start(2), STOCK_UP);
    const after = defeatedByPlayer(put.state, put.id);
    const order = after.events.flatMap((e) =>
      e.type === "schemeDefeated" || e.type === "cardFlippedToOtherFace" || e.type === "counterAdded" ? [e.type] : [],
    );
    expect(order).toEqual(["schemeDefeated", "cardFlippedToOtherFace", "counterAdded"]);
    expect(after.events).toContainEqual({
      type: "cardFlippedToOtherFace",
      instanceId: put.id,
      from: STOCK_UP.id,
      to: DEPOT.id,
      typeChanged: true,
    });
    expect(after.events.some((e) => e.type === "encounterCardRevealed" && e.instanceId === put.id)).toBe(false);
  });

  it("a front with Victory 1 does not go to the victory display: its When Defeated flips it first", () => {
    const put = inPlay(start(2), TROPHY);
    const after = defeatedByPlayer(put.state, put.id);
    expect(after.state.victoryDisplay).not.toContain(put.id);
    expect(locateCard(after.state, put.id)).toEqual({ kind: "villainArea" });
    expect(mustInstance(after.state, put.id).cardId).toBe(SHELF.id);
  });
});

describe("the environment's Action on a card nobody controls", () => {
  const depotInPlay = () => {
    const put = inPlay(start(2), STOCK_UP);
    return { id: put.id, state: defeatedByPlayer(put.state, put.id).state };
  };

  it("is offered to the active player, whichever player that is, and to nobody else", () => {
    const { id, state } = depotInPlay();
    expect([offered(state, P1, id), offered(state, P2, id)]).toEqual([true, false]);
    const next = endTurn(state);
    expect([offered(next, P1, id), offered(next, P2, id)]).toEqual([false, true]);
  });

  it.each([
    ["the first player", P1],
    ["the other player", P2],
  ] as const)("%s uses it: the counter is spent, each player draws 1, and 'you' is that player", (_, user) => {
    const { id, state } = depotInPlay();
    const turn = user === P1 ? state : endTurn(state);
    const before = [handSize(turn, P1), handSize(turn, P2)];
    const after = run(turn, useDepot(user, id));
    expect(mustInstance(after.state, id).counters.supply ?? 0).toBe(0);
    expect([handSize(after.state, P1), handSize(after.state, P2)]).toEqual([before[0]! + 1, before[1]! + 1]);
    expect([heroDamage(after.state, P1), heroDamage(after.state, P2)]).toEqual(user === P1 ? [1, 0] : [0, 1]);
    // It stays in play with no counter, and cannot be used again.
    expect(locateCard(after.state, id)).toEqual({ kind: "villainArea" });
    expect(offered(after.state, user, id)).toBe(false);
  });
});

describe("the environment's constant applies while it is in play", () => {
  it("'each hero gets +1 DEF' reaches every player's hero once the scheme has flipped, not before", () => {
    const put = inPlay(start(2), DIG_IN);
    const def0 = (state: GameState, player: PlayerId) => characterProfile(state, hero(state, player), deps)?.def;
    expect([def0(put.state, P1), def0(put.state, P2)]).toEqual([2, 2]);
    const after = defeatedByPlayer(put.state, put.id);
    expect(mustInstance(after.state, put.id).cardId).toBe(BULWARK.id);
    expect([def0(after.state, P1), def0(after.state, P2)]).toEqual([3, 3]);
  });
});

describe("the flipped card is no longer a player side scheme", () => {
  it("'for each side scheme in play' counts the front and not the environment", () => {
    const put = inPlay(start(2), STOCK_UP);
    expect(villainDamage(play(put.state, TALLY_UP.card).state)).toBe(1);
    const flipped = defeatedByPlayer(put.state, put.id);
    expect(villainDamage(play(flipped.state, TALLY_UP.card).state)).toBe(0);
  });

  it("a front that counts toward the limit frees its slot when it flips", () => {
    const put = inPlay(start(2), COUNTED);
    // While it is a player side scheme, a second one is over the two-player limit of one.
    const over = play(put.state, ERRAND);
    expect(over.events.filter((e) => e.type === "playerSideSchemeLimitDiscard")).toHaveLength(1);
    const flipped = defeatedByPlayer(put.state, put.id);
    expect(mustInstance(flipped.state, put.id).cardId).toBe(TALLY.id);
    const errand = play(flipped.state, ERRAND);
    expect(errand.events.filter((e) => e.type === "playerSideSchemeLimitDiscard")).toEqual([]);
    expect(errand.state.villainArea).toEqual(expect.arrayContaining([put.id, errand.id]));
  });

  it("cannot be thwarted: it is not among a hero's basic thwart targets", () => {
    const put = inPlay(start(2), STOCK_UP);
    const flipped = defeatedByPlayer(put.state, put.id);
    const actions = legalActions(endTurn(flipped.state), P2, deps);
    const targets =
      actions.kind === "turn" ? actions.legal.flatMap((a) => (a.action.kind === "basicThwart" ? a.targets : [])) : [];
    expect(targets).not.toContain(put.id);
    expect(targets).toContain(flipped.state.mainScheme.instanceId);
  });
});

describe("a crisis icon and a player side scheme nobody controls (RRG 1.8 'Crisis Icon', p. 14)", () => {
  it("its When Defeated cannot remove threat from the main scheme: it is a player card", () => {
    const put = inPlay(start(2), RELIEF);
    const siege = encounterCardInVillainArea(put.state, SIEGE.id, 30);
    const after = defeatedByEncounter(siege.state);
    // 10, and the 1 the cue placed.
    expect(mainThreat(after.state)).toBe(11);
    expect(after.events).toContainEqual({
      type: "threatRemovalBlocked",
      schemeInstanceId: after.state.mainScheme.instanceId,
      reason: "crisis",
    });
  });

  it("with no crisis icon in play the same When Defeated removes the threat", () => {
    const put = inPlay(start(2), RELIEF);
    const after = defeatedByEncounter(put.state);
    expect(mainThreat(after.state)).toBe(8);
  });

  it("the crisis icon does not stop a hero thwarting the scheme itself", () => {
    const put = inPlay(start(2), STOCK_UP);
    const siege = encounterCardInVillainArea(put.state, SIEGE.id, 30);
    const after = run(siege.state, thwart(P1, hero(siege.state, P1), put.id));
    expect(threat(after.state, put.id)).toBe(6);
  });
});
