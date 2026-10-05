/**
 * docs/phase7-wave7.md §3.49: the victory display as a place cards are sent to and taken from. `CardDestination
 * "victoryDisplay"` (`moveCards`), `CardSelector victoryDisplay` (`chooseCards`, `selectCards`, a part of `anyOf`) and
 * `putIntoPlay` for a card that is in the victory display.
 *
 * Synthetic cards: an encounter side scheme with "3 per player" starting threat, Hinder 2, Incite 1, Surge, a When
 * Revealed and a When Defeated; a Victory 2 minion; a player side scheme with "2 per player" starting threat and
 * Hinder 1, and a second one for the limit; an upgrade that is searched for by name; a support with "Forced Response:
 * After a side scheme is defeated, take 4 damage"; events for each instruction.
 *
 * What the engine holds: one `GameState.victoryDisplay`, an ordered list of instance ids shared by every player and
 * every game area (RRG 1.8 "Victory Display", p. 46: "an out-of-play game area shared by all players"). Cards reach it
 * by the Victory X keyword on a defeat, as a main scheme stage (`addMainSchemeStageToVictoryDisplay`), and now by an
 * effect. Nothing records how a card arrived, so every reader of the pile (`victoryDisplayCount`, the campaign's
 * `cardsInVictoryDisplay` and `keywordValueSum`) counts a card an effect sent there exactly as one a defeat did.
 *
 * Sources: RRG 1.8 "Leaves Play" (p. 27): "placing a card in the victory display" is one of the ways a card leaves
 * play, and a card leaving play returns its tokens to the supply and has "no memory of its previous state"; a card
 * moved there was not defeated, so nothing that answers a defeat resolves (the Victory X keyword is itself a When
 * Defeated, "Victory X", p. 46). "Side Scheme" (p. 40) and "Player Side Scheme" (p. 34): a scheme "enters play with an
 * amount of threat on it equal to [its] starting threat value". "When Revealed Abilities" (p. 48): "If an encounter card
 * with a 'When Revealed' ability is put into play without being revealed, the 'When Revealed' ability does not
 * trigger"; "Incite X" (p. 24) and "Surge" (p. 42) resolve on a reveal. "Play, Put into Play" (p. 32). "Search" (p. 39):
 * a deck any part of which was searched is shuffled.
 *
 * Owner decision §4.1 Q30 = A: a side scheme an effect brings back from the victory display enters play with its
 * starting threat and is not revealed, "(no When Revealed, hinder or surge)"; the effect may then move threat onto
 * it. The hinder part is that decision: RRG 1.8 "Hinder X" (p. 22) reads hinder as "enters play with X threat on it",
 * which every other entry honors (the control test below; `SCHEME_FROM_VICTORY_DISPLAY`, `resolve/enter-play.ts`).
 */

import { flat, perPlayerOnly, type AnyCard, type PlayerSideSchemeCard, type ScalingValue } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { ChoicePrompt, PendingChoice } from "./choices.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeck, locateCard, mustInstance, mustPlayer } from "./query.js";
import { resolveValue, type EffectContext } from "./select.js";
import type { CardDestination, CardSelector, EffectSpec, TargetQuery, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSideScheme, stubSupport, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const you = { kind: "controller" } as const;
const yourIdentity: TargetRef = { kind: "identityOf", player: you };
const firstPlayerIdentity: TargetRef = { kind: "identityOf", player: { kind: "firstPlayer" } };
const each = (query: TargetQuery): TargetRef => ({ kind: "each", query });
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const SIDE_SCHEME: TargetQuery = { categories: ["sideScheme"] };

/** "When Revealed: The first player takes 1 damage." */
const PLOT_REVEALED = stubAbility("plot.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "dealDamage", target: firstPlayerIdentity, amount: n(1) }],
});
/** "When Defeated: The first player takes 2 damage." */
const PLOT_DEFEATED = stubAbility("plot.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "dealDamage", target: firstPlayerIdentity, amount: n(2) }],
});
/** Starting threat "3 per player". Hinder 2. Incite 1. Surge. */
const PLOT = {
  ...stubSideScheme({
    id: "plot",
    startingThreat: 0,
    keywords: [{ name: "hinder", value: 2 }, { name: "incite", value: 1 }, { name: "surge" }],
    abilities: [PLOT_REVEALED.ref, PLOT_DEFEATED.ref],
  }),
  startingThreat: perPlayerOnly(3),
};
const HUNTER = stubMinion({ id: "hunter", atk: 1, sch: 1, hp: 5, keywords: [{ name: "victory", value: 2 }] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

function playerSideScheme(id: string, startingThreat: ScalingValue, hinder = 0): PlayerSideSchemeCard {
  return {
    ...stubSupport({ id, cost: 0 }),
    type: "player_side_scheme",
    startingThreat,
    keywords: hinder > 0 ? [{ name: "hinder", value: hinder }] : [],
  };
}
/** Starting threat "2 per player". Hinder 1. */
const MISSION = playerSideScheme("mission", perPlayerOnly(2), 1);
const ALPHA = playerSideScheme("alpha", flat(3));
const RELIC = stubUpgrade({ id: "relic", cost: 3 });
/** "Forced Response: After a side scheme is defeated, take 4 damage." */
const WATCHER_DEFEATED = stubAbility("watcher.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "schemeDefeated" } },
  effects: [{ kind: "dealDamage", target: yourIdentity, amount: n(4) }],
});
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [WATCHER_DEFEATED.ref] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects: [...effects] });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const TO_DISPLAY: CardDestination = "victoryDisplay";
const inDisplay = (filter?: TargetQuery): CardSelector => ({ kind: "victoryDisplay", ...(filter ? { filter } : {}) });
const inPlay = (query: TargetQuery): CardSelector => ({ kind: "ref", ref: each(query) });

/** "Add each side scheme to the victory display." */
const BURY_SCHEMES = event("bury-schemes", [{ kind: "moveCards", cards: inPlay(SIDE_SCHEME), to: TO_DISPLAY }]);
/** "Add each minion to the victory display." */
const BURY_MINIONS = event("bury-minions", [
  { kind: "moveCards", cards: inPlay({ categories: ["minion"] }), to: TO_DISPLAY },
]);
/** "Add each upgrade to the victory display." */
const BURY_UPGRADES = event("bury-upgrades", [
  { kind: "moveCards", cards: inPlay({ categories: ["upgrade"] }), to: TO_DISPLAY },
]);
/** "Add each side scheme in the encounter discard pile to the victory display." */
const BURY_DISCARDED = event("bury-discarded", [
  { kind: "moveCards", cards: { kind: "encounter", zones: ["discard"], filter: SIDE_SCHEME }, to: TO_DISPLAY },
]);
/** "Remove 20 threat from each side scheme." */
const THWART = event("thwart", [{ kind: "removeThreat", target: each(SIDE_SCHEME), amount: n(20) }]);
/** "Put a side scheme from the victory display into play → move 4 threat from the main scheme to that side scheme." */
const RETURN_SCHEME = event("return-scheme", [
  { kind: "chooseCards", slot: "back", from: inDisplay(SIDE_SCHEME), chooser: you, min: 1, max: 1 },
  { kind: "putIntoPlay", card: slot("back"), controller: you },
  { kind: "moveThreat", from: { kind: "mainScheme" }, to: slot("back"), amount: n(4) },
]);
/** "Put each [name] in the victory display into play." No deck is searched, so none is shuffled. */
const returnNamed = (id: string, name: string) =>
  event(id, [
    { kind: "selectCards", slot: "back", cards: inDisplay({ name }) },
    { kind: "putIntoPlay", card: slot("back"), controller: you },
  ]);
const RETURN_HUNTER = returnNamed("return-hunter", HUNTER.name);
const RETURN_RELIC = returnNamed("return-relic", RELIC.name);
/** "Put the [plot] in the encounter discard pile into play": a put into play from any other zone, for the control. */
const PLOT_FROM_DISCARD = event("plot-from-discard", [
  { kind: "selectCards", slot: "back", cards: { kind: "encounter", zones: ["discard"], filter: { name: PLOT.name } } },
  { kind: "putIntoPlay", card: slot("back"), controller: you },
]);
/** "Search your deck, discard pile, hand, and victory display for [relic] and put it into play. (Shuffle.)" */
const SEARCH_EVERYWHERE = event("search-everywhere", [
  {
    kind: "chooseCards",
    slot: "found",
    from: {
      kind: "anyOf",
      of: [
        { kind: "zone", zone: ["deck", "discard", "hand"], player: you, filter: { name: RELIC.name } },
        inDisplay({ name: RELIC.name }),
      ],
    },
    chooser: you,
    min: 1,
    max: 1,
  },
  { kind: "putIntoPlay", card: slot("found"), controller: you },
  { kind: "shuffleDeck", player: you },
]);
/** "Discard each side scheme in the victory display." */
const EMPTY_DISPLAY = event("empty-display", [{ kind: "moveCards", cards: inDisplay(SIDE_SCHEME), to: "discard" }]);
const EVENTS = [
  BURY_SCHEMES,
  BURY_MINIONS,
  BURY_UPGRADES,
  BURY_DISCARDED,
  THWART,
  RETURN_SCHEME,
  RETURN_HUNTER,
  RETURN_RELIC,
  PLOT_FROM_DISCARD,
  SEARCH_EVERYWHERE,
  EMPTY_DISPLAY,
];

const deps: EngineDeps = depsOf(PLOT_REVEALED, PLOT_DEFEATED, WATCHER_DEFEATED, ...EVENTS.map((e) => e.ability));
const PLAYER_CARDS: readonly AnyCard[] = [MISSION, ALPHA, RELIC, RELIC, WATCHER, ...EVENTS.map((e) => e.card)];

/** Each player in hero form at the first player's first turn, with `mainThreat` threat on the main scheme. */
function start(players: 1 | 2 = 1, mainThreat = 10): GameState {
  const base = gameAtFirstTurn({
    players,
    cards: [...new Set(PLAYER_CARDS), PLOT, HUNTER, FILLER],
    deps,
    deck: PLAYER_CARDS.map((card) => card.id),
    encounter: [PLOT.id, HUNTER.id, ...copiesOf(FILLER.id, 30)],
  });
  expect(base.firstPlayerId).toBe(P1);
  const main = base.mainScheme.instanceId;
  return {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    instances: { ...base.instances, [main]: { ...mustInstance(base, main), threat: mainThreat } },
  };
}

type LimitPrompt = Extract<ChoicePrompt, { kind: "discardOverPlayerSideSchemeLimit" }>;
const isLimitChoice = (choice: PendingChoice | null): choice is PendingChoice & { prompt: LimitPrompt } =>
  choice?.prompt.kind === "discardOverPlayerSideSchemeLimit";
interface Step {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** Who was asked to discard for the player side scheme limit, and what they were offered. */
  readonly asked: readonly { readonly playerId: PlayerId; readonly options: readonly string[] }[];
}
/**
 * Drives `commands`, answering a limit choice with `discard` and any other choice with the default pick, and checks
 * that the log replays to the same state.
 */
function run(state: GameState, commands: readonly Command[], discard?: InstanceId): Step {
  const asked: { playerId: PlayerId; options: readonly string[] }[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (!isLimitChoice(choice)) return defaultPick(current);
    asked.push({ playerId: choice.playerId, options: choice.options.map((option) => option.optionId) });
    return discard ? [discard] : defaultPick(current);
  };
  const { session, events } = driveSession(startSession(state), deps, commands, pick);
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
  return { state: session.state, events, asked };
}
/** `player` plays `card` from hand for 0. The step's `id` is the played card. */
function play(
  state: GameState,
  card: AnyCard,
  player: PlayerId = P1,
  discard?: InstanceId,
): Step & { readonly id: InstanceId } {
  const given = giveCard(state, player, card.id);
  const command: Command = {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  return { ...run(given.state, [command], discard), id: given.id };
}
const endTurn = (state: GameState, player: PlayerId = P1) => run(state, [{ type: "endTurn", playerId: player }]).state;

const threat = (state: GameState, id: InstanceId) => mustInstance(state, id).threat;
const mainThreat = (state: GameState) => threat(state, state.mainScheme.instanceId);
const heroDamage = (state: GameState, player: PlayerId = P1) =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).damage;
const threatPlacedOn = (events: readonly GameEvent[], id: InstanceId) =>
  events.filter((e) => e.type === "threatPlaced" && e.schemeInstanceId === id);
const movesOf = (events: readonly GameEvent[], id: InstanceId) =>
  events.flatMap((e) => (e.type === "cardMoved" && e.instanceId === id ? [[e.from.kind, e.to.kind]] : []));
const deckShuffles = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "deckShuffled" && e.zone.kind === "deck");
/** `victoryDisplayCount(filter)` as a card ability would read it. */
function displayCount(state: GameState, filter?: TargetQuery): number {
  const context: EffectContext = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
  const value: ValueSpec = { kind: "victoryDisplayCount", ...(filter ? { filter } : {}) };
  return resolveValue(state, value, context, deps);
}

/** The encounter side scheme in play with `threat` on it, and the watcher support in play. */
function plotInPlay(players: 1 | 2 = 1, withThreat = 5) {
  const watched = playerCardIntoPlay(start(players), WATCHER.id, P1).state;
  const plot = encounterCardInVillainArea(watched, PLOT.id, withThreat);
  return { state: plot.state, plot: plot.id };
}
/** The encounter side scheme in the victory display, sent there from play by an effect. */
function plotInDisplay(players: 1 | 2 = 1) {
  const { state, plot } = plotInPlay(players);
  return { state: play(state, BURY_SCHEMES.card).state, plot };
}

describe("an effect adds a card in play to the victory display (RRG 1.8 'Leaves Play', p. 27)", () => {
  it("an encounter side scheme leaves play for the one shared display, faceup, with its threat gone", () => {
    const { state, plot } = plotInPlay();
    const after = play(state, BURY_SCHEMES.card);
    expect(after.state.victoryDisplay).toEqual([plot]);
    expect(after.state.villainArea).not.toContain(plot);
    expect(locateCard(after.state, plot)).toEqual({ kind: "victoryDisplay" });
    expect(mustInstance(after.state, plot)).toMatchObject({ threat: 0, faceup: true, controllerId: null });
    expect(movesOf(after.events, plot)).toEqual([["villainArea", "victoryDisplay"]]);
  });

  it("it was not defeated: no When Defeated and no 'after a side scheme is defeated' response", () => {
    const { state } = plotInPlay();
    const moved = play(state, BURY_SCHEMES.card);
    expect(moved.events.some((e) => e.type === "schemeDefeated")).toBe(false);
    expect(heroDamage(moved.state)).toBe(0);
    // The same scheme defeated: its When Defeated (2) and the response (4), and it has no Victory X to keep it.
    const defeated = play(state, THWART.card);
    expect(defeated.events.some((e) => e.type === "schemeDefeated")).toBe(true);
    expect(heroDamage(defeated.state)).toBe(6);
    expect(defeated.state.victoryDisplay).toEqual([]);
  });

  it("it is counted by 'side schemes in the victory display' from then on", () => {
    const { state } = plotInPlay();
    expect(displayCount(state, SIDE_SCHEME)).toBe(0);
    const after = play(state, BURY_SCHEMES.card);
    expect(displayCount(after.state, SIDE_SCHEME)).toBe(1);
    expect(displayCount(after.state)).toBe(1);
    expect(displayCount(after.state, { categories: ["minion"] })).toBe(0);
  });

  it("a player side scheme and a player's upgrade go there the same way, in the order they arrived", () => {
    const mission = play(start(), MISSION);
    expect(threat(mission.state, mission.id)).toBe(3);
    const relic = playerCardIntoPlay(mission.state, RELIC.id, P1);
    const schemes = play(relic.state, BURY_SCHEMES.card);
    const after = play(schemes.state, BURY_UPGRADES.card);
    expect(after.state.victoryDisplay).toEqual([mission.id, relic.id]);
    expect(schemes.events.some((e) => e.type === "schemeDefeated")).toBe(false);
    expect(mustInstance(after.state, mission.id)).toMatchObject({ threat: 0, faceup: true, ownerId: P1 });
    expect(mustPlayer(after.state, P1).playArea).not.toContain(relic.id);
    expect(mustPlayer(after.state, P1).discard).not.toContain(relic.id);
    // An upgrade there is not a side scheme: "each side scheme in the victory display" does not count it.
    expect(displayCount(after.state, SIDE_SCHEME)).toBe(1);
    expect(displayCount(after.state)).toBe(2);
  });

  it("a Victory 2 minion an effect sent there sits in the same pile a defeated one would, with nothing kept", () => {
    const hunter = minionEngagedWith(start(), HUNTER.id, P1);
    const damaged: GameState = {
      ...hunter.state,
      instances: { ...hunter.state.instances, [hunter.id]: { ...mustInstance(hunter.state, hunter.id), damage: 3 } },
    };
    const after = play(damaged, BURY_MINIONS.card);
    expect(after.state.victoryDisplay).toEqual([hunter.id]);
    expect(mustInstance(after.state, hunter.id)).toMatchObject({ damage: 0, engagedWith: null, faceup: true });
    expect(displayCount(after.state, { categories: ["minion"] })).toBe(1);
  });

  it("a defeated side scheme in the encounter discard pile is simply moved there, and one already there stays", () => {
    const { state, plot } = plotInPlay();
    const defeated = play(state, THWART.card);
    expect(activeEncounterDeck(defeated.state).discard).toContain(plot);
    const after = play(defeated.state, BURY_DISCARDED.card);
    expect(after.state.victoryDisplay).toEqual([plot]);
    expect(activeEncounterDeck(after.state).discard).not.toContain(plot);
    expect(mustInstance(after.state, plot).faceup).toBe(true);
    expect(movesOf(after.events, plot)).toEqual([["encounterDiscard", "victoryDisplay"]]);
    expect(displayCount(after.state, SIDE_SCHEME)).toBe(1);
  });
});

describe("an encounter side scheme put into play from the victory display (§4.1 Q30 = A)", () => {
  it.each([
    [1, 3],
    [2, 6],
  ] as const)(
    "%i player(s): it enters with its per-player starting threat, %i, in one placement",
    (players, starting) => {
      const { state, plot } = plotInDisplay(players);
      const after = play(state, RETURN_SCHEME.card);
      expect(after.state.villainArea).toContain(plot);
      expect(after.state.victoryDisplay).toEqual([]);
      expect(threatPlacedOn(after.events, plot)[0]).toMatchObject({ amount: starting, sourceInstanceId: null });
      // Then the effect moves 4 threat from the main scheme onto it.
      expect(threat(after.state, plot)).toBe(starting + 4);
      expect(mainThreat(after.state)).toBe(6);
      expect(movesOf(after.events, plot)).toEqual([["victoryDisplay", "villainArea"]]);
    },
  );

  it("it is not revealed: no When Revealed, no hinder, no incite, no surge", () => {
    const { state, plot } = plotInDisplay();
    const after = play(state, RETURN_SCHEME.card);
    // When Revealed would deal 1 damage; Hinder 2 would make the placement 5; Incite 1 would leave 7 on the main scheme.
    expect(heroDamage(after.state)).toBe(0);
    expect(threatPlacedOn(after.events, plot)[0]).toMatchObject({ amount: 3 });
    expect(mainThreat(after.state)).toBe(6);
    expect(after.events.some((e) => e.type === "surgeTriggered")).toBe(false);
    expect(after.events.some((e) => e.type === "encounterCardRevealed")).toBe(false);
  });

  it("control: the same scheme put into play from the encounter discard pile does get its hinder (RRG p. 22)", () => {
    const { state, plot } = plotInPlay();
    const defeated = play(state, THWART.card);
    const before = heroDamage(defeated.state);
    const after = play(defeated.state, PLOT_FROM_DISCARD.card);
    expect(after.state.villainArea).toContain(plot);
    expect(threat(after.state, plot)).toBe(5);
    // Still no reveal: no When Revealed damage.
    expect(heroDamage(after.state)).toBe(before);
  });

  it("it no longer counts as a side scheme in the victory display", () => {
    const { state } = plotInDisplay();
    expect(displayCount(state, SIDE_SCHEME)).toBe(1);
    const after = play(state, RETURN_SCHEME.card);
    expect(displayCount(after.state, SIDE_SCHEME)).toBe(0);
  });

  it("with no side scheme in the victory display there is nothing to choose, so the card cannot be played", () => {
    const given = giveCard(start(), P1, RETURN_SCHEME.card.id);
    const refused = sessionApply(
      startSession(given.state),
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    expect(refused.ok).toBe(false);
  });
});

describe("a player side scheme put into play from the victory display", () => {
  /** The mission in the victory display (played, then sent there by an effect). */
  function missionInDisplay(players: 1 | 2) {
    const mission = play(start(players), MISSION);
    return { state: play(mission.state, BURY_SCHEMES.card).state, mission: mission.id };
  }

  it.each([
    [1, 2],
    [2, 4],
  ] as const)(
    "%i player(s): the villain's play area, your control, starting threat %i, no hinder",
    (players, starting) => {
      const { state, mission } = missionInDisplay(players);
      const after = play(state, RETURN_SCHEME.card);
      expect(after.state.villainArea).toContain(mission);
      expect(after.state.victoryDisplay).toEqual([]);
      expect(mustInstance(after.state, mission)).toMatchObject({ controllerId: P1, ownerId: P1, faceup: true });
      expect(threatPlacedOn(after.events, mission)[0]).toMatchObject({ amount: starting, sourceInstanceId: null });
      expect(threat(after.state, mission)).toBe(starting + 4);
      expect(mainThreat(after.state)).toBe(6);
      expect(after.asked).toEqual([]);
    },
  );

  it("over the limit, the first player chooses the discard, whoever's effect it was", () => {
    const { state, mission } = missionInDisplay(2);
    const alpha = play(state, ALPHA);
    const put = play(endTurn(alpha.state), RETURN_SCHEME.card, P2, alpha.id);
    expect(put.asked).toEqual([{ playerId: P1, options: [alpha.id, mission] }]);
    expect(put.events).toContainEqual({ type: "playerSideSchemeLimitDiscard", instanceId: alpha.id, chosenBy: P1 });
    expect(mustPlayer(put.state, P1).discard).toContain(alpha.id);
    expect(put.state.villainArea).toContain(mission);
    expect(mustInstance(put.state, mission).controllerId).toBe(P2);
    expect(threat(put.state, mission)).toBe(8);
  });

  it("the first player may discard the scheme that just came back: it is not defeated and takes no threat", () => {
    const { state, mission } = missionInDisplay(2);
    const alpha = play(state, ALPHA);
    const put = play(endTurn(alpha.state), RETURN_SCHEME.card, P2, mission);
    expect(put.asked.map((ask) => ask.playerId)).toEqual([P1]);
    expect(put.state.villainArea).toContain(alpha.id);
    expect(put.state.villainArea).not.toContain(mission);
    expect(mustPlayer(put.state, P1).discard).toContain(mission);
    expect(put.events.some((e) => e.type === "schemeDefeated")).toBe(false);
    expect(threat(put.state, mission)).toBe(0);
    expect(mainThreat(put.state)).toBe(10);
  });
});

describe("a card that is not a scheme put into play from the victory display", () => {
  it("a minion enters play engaged with the player the effect names", () => {
    const hunter = minionEngagedWith(start(), HUNTER.id, P1);
    const buried = play(hunter.state, BURY_MINIONS.card);
    const after = play(buried.state, RETURN_HUNTER.card);
    expect(after.state.victoryDisplay).toEqual([]);
    expect(mustPlayer(after.state, P1).playArea).toContain(hunter.id);
    expect(mustInstance(after.state, hunter.id)).toMatchObject({ engagedWith: P1, controllerId: null, damage: 0 });
  });

  it("an upgrade enters its controller's play area, with no cost paid and without being played", () => {
    const relic = playerCardIntoPlay(start(), RELIC.id, P1);
    const buried = play(relic.state, BURY_UPGRADES.card);
    const after = play(buried.state, RETURN_RELIC.card);
    expect(after.state.victoryDisplay).toEqual([]);
    expect(mustPlayer(after.state, P1).playArea).toContain(relic.id);
    expect(mustInstance(after.state, relic.id)).toMatchObject({ controllerId: P1, faceup: true });
    expect(after.events.some((e) => e.type === "cardPlayed" && e.instanceId === relic.id)).toBe(false);
    expect(deckShuffles(after.events)).toEqual([]);
  });
});

describe("a search of deck, discard pile, hand and victory display for a named card", () => {
  /** Both relics out of the player's own zones: one in the victory display, one removed from the test's way. */
  function relicOnlyInDisplay() {
    const first = playerCardIntoPlay(start(), RELIC.id, P1);
    const buried = play(first.state, BURY_UPGRADES.card).state;
    const second = giveCard(buried, P1, RELIC.id);
    const state: GameState = {
      ...second.state,
      players: second.state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((id) => id !== second.id) } : p,
      ),
      removedFromGame: [...second.state.removedFromGame, second.id],
    };
    return { state, relic: first.id };
  }

  it("finds the card in the victory display and puts it into play; the searched deck is shuffled", () => {
    const { state, relic } = relicOnlyInDisplay();
    const after = play(state, SEARCH_EVERYWHERE.card);
    expect(after.state.victoryDisplay).toEqual([]);
    expect(mustPlayer(after.state, P1).playArea).toContain(relic);
    expect(mustInstance(after.state, relic).controllerId).toBe(P1);
    expect(deckShuffles(after.events)).toHaveLength(1);
  });

  it("one pool over the four areas: the chooser is offered the copy in the deck and the copy in the display", () => {
    const first = playerCardIntoPlay(start(), RELIC.id, P1);
    const buried = play(first.state, BURY_UPGRADES.card).state;
    const given = giveCard(buried, P1, SEARCH_EVERYWHERE.card.id);
    let offered: readonly string[] = [];
    const pick = (current: GameState): readonly string[] => {
      const choice = current.pendingChoice;
      if (choice?.prompt.kind !== "chooseCards") return defaultPick(current);
      offered = choice.options.map((option) => option.optionId);
      return [first.id];
    };
    const command: Command = {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    };
    const { session, events } = driveSession(startSession(given.state), deps, [command], pick);
    const other = offered.find((id) => id !== first.id) as InstanceId;
    expect(offered).toEqual([other, first.id]);
    expect(mustInstance(session.state, other).cardId).toBe(RELIC.id);
    expect(mustPlayer(session.state, P1).playArea).toContain(first.id);
    expect(mustPlayer(session.state, P1).playArea).not.toContain(other);
    expect(deckShuffles(events)).toHaveLength(1);
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });

  it("a selector over the victory display alone names only the matching card, and searches no deck", () => {
    const hunter = minionEngagedWith(start(), HUNTER.id, P1);
    const relic = playerCardIntoPlay(hunter.state, RELIC.id, P1);
    const buried = play(play(relic.state, BURY_MINIONS.card).state, BURY_UPGRADES.card);
    expect(buried.state.victoryDisplay).toEqual([hunter.id, relic.id]);
    const after = play(buried.state, RETURN_RELIC.card);
    // The deck is as it was, less the event that was taken from it to be played.
    const deckBefore = mustPlayer(buried.state, P1).deck.filter((id) => id !== after.id);
    expect(after.state.victoryDisplay).toEqual([hunter.id]);
    expect(mustPlayer(after.state, P1).playArea).toContain(relic.id);
    expect(deckShuffles(after.events)).toEqual([]);
    expect(mustPlayer(after.state, P1).deck).toEqual(deckBefore);
  });
});

describe("a card leaving the victory display for a discard pile", () => {
  it("goes to its own discard pile and is no longer counted", () => {
    const { state, plot } = plotInDisplay();
    const mission = play(state, MISSION);
    const both = play(mission.state, BURY_SCHEMES.card);
    expect(displayCount(both.state, SIDE_SCHEME)).toBe(2);
    const after = play(both.state, EMPTY_DISPLAY.card);
    expect(after.state.victoryDisplay).toEqual([]);
    expect(displayCount(after.state, SIDE_SCHEME)).toBe(0);
    expect(activeEncounterDeck(after.state).discard).toContain(plot);
    expect(mustPlayer(after.state, P1).discard).toContain(mission.id);
    expect(after.events.some((e) => e.type === "schemeDefeated")).toBe(false);
  });
});

describe("replay", () => {
  it("the same commands on the same seed give the same state and the same log, twice", () => {
    const once = () => {
      const { state } = plotInDisplay(2);
      const back = play(state, RETURN_SCHEME.card);
      const again = play(back.state, BURY_SCHEMES.card);
      return play(again.state, SEARCH_EVERYWHERE.card);
    };
    const first = once();
    const second = once();
    expect(second.state).toEqual(first.state);
    expect(second.events).toEqual(first.events);
  });
});
