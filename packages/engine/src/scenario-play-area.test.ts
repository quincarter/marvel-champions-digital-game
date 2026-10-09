/**
 * docs/phase7-wave8.md §3.33 part (a): an in-play scenario area that no player controls (`ZoneId scenarioPlayArea`,
 * `GameState.scenarioPlayAreas`, `EffectSpec createScenarioPlayArea`, `putIntoPlay.into`).
 *
 * MC45 p. 5: "[MISSION] side schemes begin the game in a separate game area called the 'mission area.'" / "Cards in
 * the mission area are in play but under no player's control." / "When a card in the mission area leaves play, place
 * it in its owner's discard pile." Game steps are not card abilities, so they apply to a card there as to any card in
 * play: the end-of-phase ready (RRG 1.8 "End of Player Phase", p. 18), the defeat check ("Defeat", p. 15), the unique
 * rule ("Unique Icon", pp. 45–46) and player elimination ("Player Elimination", p. 34, step 4). Nothing there
 * activates: a minion in the area is engaged with no player ("Activation", p. 6). Synthetic cards only.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance, mustPlayer, scenarioPlayAreaOf } from "./query.js";
import { cardsInPlay, controllerOf } from "./select.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubAlly,
  stubAttachment,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { ALLY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay, playFree } from "./testing/wave3.js";
import { faceVisible } from "./visibility.js";

const AREA = "mission";
const INTO = { scenarioPlayArea: AREA } as const;
const n = (value: number): ValueSpec => ({ kind: "const", value });
const you = { kind: "controller" } as const;
const find = (name: string): TargetRef => ({ kind: "find", query: { name } });
/** The acting player's own copy (every seat's deck holds one). */
const findYours = (name: string): TargetRef => ({ kind: "find", query: { name }, owner: you });

/** A side scheme of 5 threat per player, with hinder 1. */
const ERRAND = {
  ...stubSideScheme({ id: "errand", startingThreat: 0, boostIcons: 0, keywords: [{ name: "hinder", value: 1 }] }),
  startingThreat: { base: 0, perPlayer: 5 },
};
/** A minion that would attack for 2 or scheme for 1 if it were ever engaged, with toughness. */
const WARDEN = stubMinion({ id: "warden", atk: 2, sch: 1, hp: 10, boostIcons: 0, keywords: [{ name: "toughness" }] });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 3, boostIcons: 0 });
const CHAIN = stubAttachment({ id: "chain", statModifiers: { atk: 1 } });
const SQUIRE = stubAlly({ id: "squire", cost: 0, atk: 1, thw: 1, hp: 3 });
/** Two cards that are one unique character. */
const PALADIN = { ...stubAlly({ id: "paladin", cost: 0, atk: 1, thw: 1, hp: 3 }), unique: true };
const PALADIN_TWIN = {
  ...stubAlly({ id: "paladin-twin", cost: 0, atk: 1, thw: 1, hp: 3 }),
  name: PALADIN.name,
  unique: true,
};
const BADGE = stubUpgrade({ id: "badge", cost: 0 });
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });

const action = (id: string, ...effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const OPEN = action("open", { kind: "createScenarioPlayArea", name: AREA, closed: true });
const send = (id: string, card: TargetRef) => action(id, { kind: "putIntoPlay", card, controller: you, into: INTO });
const SEND_ERRAND = send("send-errand", find(ERRAND.name));
const SEND_WARDEN = send("send-warden", find(WARDEN.name));
const SEND_SQUIRE = send("send-squire", findYours(SQUIRE.name));
const SEND_PALADIN = send("send-paladin", { kind: "find", query: { printedId: PALADIN.id }, owner: you });
const SEND_BADGE = send("send-badge", findYours(BADGE.name));
const SEND_NOISE = send("send-noise", find(NOISE.name));
/** "Add each minion engaged with you to the area": a card already in play. */
const BANISH = send("banish", { kind: "each", query: { categories: ["minion"], engagedWith: "you" } });
/** "Put your [the same unique character, another card] into play." */
const TWIN = action("twin", {
  kind: "putIntoPlay",
  card: { kind: "find", query: { printedId: PALADIN_TWIN.id }, owner: you },
  controller: you,
});
const POKE = action("poke", { kind: "dealDamage", target: { kind: "villain" }, amount: n(1) });
const HURT_SELF = action("hurt-self", {
  kind: "dealDamage",
  target: { kind: "identityOf", player: you },
  amount: n(1),
});
const EVENTS = [
  OPEN,
  SEND_ERRAND,
  SEND_WARDEN,
  SEND_SQUIRE,
  SEND_PALADIN,
  SEND_BADGE,
  SEND_NOISE,
  BANISH,
  TWIN,
  POKE,
  HURT_SELF,
];

const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const TYRANT = stubVillain({ id: "tyrant", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

function start(players: 1 | 2 = 2): GameState {
  return gameAtFirstTurn({
    cards: [ERRAND, WARDEN, GRUNT, CHAIN, SQUIRE, PALADIN, PALADIN_TWIN, BADGE, NOISE, ...EVENTS.map((e) => e.card)],
    deps,
    villain: TYRANT,
    mainScheme: SCHEME,
    players,
    encounter: [ERRAND.id, WARDEN.id, GRUNT.id, CHAIN.id, ...copiesOf(NOISE.id, 14)],
    deck: [SQUIRE.id, PALADIN.id, PALADIN_TWIN.id, BADGE.id, ...EVENTS.map((e) => e.card.id)],
  });
}

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
const areaCards = (state: GameState) => state.scenarioPlayAreas?.[AREA]?.cards ?? [];
const patch = (state: GameState, id: InstanceId, change: Partial<GameState["instances"][string]>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } },
});
/** Plays the 0-cost events in order, each through its own session. */
const play = (state: GameState, ...cards: readonly { card: { id: CardId } }[]) => {
  let current = state;
  const events: GameEvent[] = [];
  for (const { card } of cards) {
    const run = playFree(current, deps, card.id);
    current = run.state;
    events.push(...run.events);
  }
  return { state: current, events };
};
const endTurn = (playerId: typeof P1): Command => ({ type: "endTurn", playerId });

describe("§3.33 (a) an in-play scenario area that no player controls", () => {
  it("is created empty and logged once; creating it again changes nothing", () => {
    const run = play(start(), OPEN, OPEN);
    expect(run.state.scenarioPlayAreas).toEqual({ [AREA]: { cards: [], closed: true } });
    expect(of(run.events, "scenarioPlayAreaCreated")).toEqual([
      { type: "scenarioPlayAreaCreated", name: AREA, closed: true },
    ]);
    // A game that never creates one has no such field at all.
    expect("scenarioPlayAreas" in start()).toBe(false);
  });

  it("a side scheme enters play there with its threat (5 per player and hinder 1 in a 2-player game), under nobody's control", () => {
    const run = play(start(), OPEN, SEND_ERRAND);
    const errand = idOf(run.state, ERRAND.id);
    expect(locateCard(run.state, errand)).toEqual({ kind: "scenarioPlayArea", name: AREA });
    expect(areaCards(run.state)).toEqual([errand]);
    expect(cardsInPlay(run.state)).toContain(errand);
    expect(scenarioPlayAreaOf(run.state, errand)).toBe(AREA);
    expect(mustInstance(run.state, errand)).toMatchObject({ threat: 11, faceup: true, controllerId: null });
    expect(faceVisible(run.state, errand)).toBe(true);
    expect(run.state.villainArea).not.toContain(errand);
    // The log: the move names the area, and the entry says what it is.
    const moved = of(run.events, "cardMoved").filter((e) => e.instanceId === errand);
    expect(moved.at(-1)?.to).toEqual({ kind: "scenarioPlayArea", name: AREA });
    expect(of(run.events, "scenarioPlayAreaEntered")).toEqual([
      {
        type: "scenarioPlayAreaEntered",
        name: AREA,
        instanceId: errand,
        cardId: ERRAND.id,
        from: "outOfPlay",
        controllerBefore: null,
        engagedBefore: null,
      },
    ]);
  });

  it("a minion enters play there engaged with nobody, with its toughness card, and never activates in a villain phase", () => {
    const staged = play(start(), OPEN, SEND_WARDEN);
    const warden = idOf(staged.state, WARDEN.id);
    expect(mustInstance(staged.state, warden)).toMatchObject({ engagedWith: null, controllerId: null, damage: 0 });
    expect(mustInstance(staged.state, warden).statuses.tough).toBe(1);
    expect(staged.state.players.every((p) => !p.playArea.includes(warden))).toBe(true);
    // Both players in hero form, a whole round: the villain activates, the minion in the area does not.
    const heroes: GameState = {
      ...staged.state,
      players: staged.state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const round = runCommands(heroes, deps, endTurn(P1), endTurn(P2));
    expect(round.state.round).toBe(heroes.round + 1);
    const activated = round.events.filter(
      (e) => (e.type === "attackResolved" || e.type === "schemeResolved") && e.enemyInstanceId === warden,
    );
    expect(activated).toHaveLength(0);
    expect(cardsInPlay(round.state)).toContain(warden);
    const replayed = replay(round.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(round.state);
  });

  it("a minion already in play is moved there without leaving play: its damage and attachment stay, and it is no longer engaged", () => {
    const engaged = minionEngagedWith(play(start(), OPEN).state, GRUNT.id);
    const chain = idOf(engaged.state, CHAIN.id);
    const chained: GameState = {
      ...engaged.state,
      encounterDecks: Object.fromEntries(
        Object.entries(engaged.state.encounterDecks).map(([deckId, piles]) => [
          deckId,
          { ...piles, deck: piles.deck.filter((id) => id !== chain) },
        ]),
      ),
      instances: {
        ...engaged.state.instances,
        [chain]: { ...mustInstance(engaged.state, chain), faceup: true, attachedTo: engaged.id },
        [engaged.id]: { ...mustInstance(engaged.state, engaged.id), damage: 2, attachments: [chain] },
      },
    };
    const run = play(chained, BANISH);
    expect(areaCards(run.state)).toEqual([engaged.id]);
    expect(mustInstance(run.state, engaged.id)).toMatchObject({ damage: 2, engagedWith: null, attachments: [chain] });
    expect(mustPlayer(run.state, P1).playArea).not.toContain(engaged.id);
    // The attachment is in the area with its host.
    expect(scenarioPlayAreaOf(run.state, chain)).toBe(AREA);
    expect(cardsInPlay(run.state)).toContain(chain);
    expect(of(run.events, "scenarioPlayAreaEntered")).toMatchObject([{ from: "inPlay", engagedBefore: P1 }]);
    // One move, play area to area: it was never out of play, so nothing was discarded from it.
    expect(of(run.events, "cardMoved").filter((e) => e.instanceId === engaged.id)).toMatchObject([
      { from: { kind: "playArea", playerId: P1 }, to: { kind: "scenarioPlayArea", name: AREA } },
    ]);
    expect(of(run.events, "cardMoved").filter((e) => e.instanceId === chain)).toHaveLength(0);
  });

  it("a player's ally there keeps its owner and has no controller; the ally limit does not count it", () => {
    let state = play(start(), OPEN).state;
    for (let i = 0; i < 3; i++) state = playerCardIntoPlay(state, ALLY.id).state;
    const run = play(state, SEND_SQUIRE);
    const squire = idOf(run.state, SQUIRE.id, P1);
    expect(areaCards(run.state)).toEqual([squire]);
    expect(mustInstance(run.state, squire)).toMatchObject({ ownerId: P1, controllerId: null, faceup: true });
    expect(controllerOf(run.state, squire)).toBeNull();
    // Three allies under P1's control and one in the area: nobody is asked to discard.
    expect(run.state.pendingChoice).toBeNull();
    expect(mustPlayer(run.state, P1).playArea.filter((id) => run.state.instances[id]?.cardId === ALLY.id)).toHaveLength(
      3,
    );
  });

  it("the end-of-phase ready step readies a card there", () => {
    const staged = play(start(), OPEN, SEND_SQUIRE);
    const squire = idOf(staged.state, SQUIRE.id, P1);
    const tired = patch(staged.state, squire, { exhausted: true });
    const round = runCommands(tired, deps, endTurn(P1), endTurn(P2));
    expect(mustInstance(round.state, squire).exhausted).toBe(false);
  });

  it("the defeat check reaches it: an ally there at 3 damage of 3 is defeated by the next sweep and goes to its owner's discard pile", () => {
    const staged = play(start(), OPEN, SEND_SQUIRE, SEND_WARDEN);
    const squire = idOf(staged.state, SQUIRE.id, P1);
    const warden = idOf(staged.state, WARDEN.id);
    const hurt = patch(patch(staged.state, squire, { damage: 3 }), warden, { damage: 10 });
    // P2 plays the card that causes the sweep: whose turn or card it is makes no difference to where each goes.
    const run = playFree(hurt, deps, POKE.card.id, P2);
    expect(
      of(run.events, "characterDefeated")
        .map((e) => e.instanceId)
        .sort(),
    ).toEqual([squire, warden].sort());
    expect(mustPlayer(run.state, P1).discard).toContain(squire);
    expect(locateCard(run.state, warden)?.kind).toBe("encounterDiscard");
    expect(areaCards(run.state)).toEqual([]);
    const left = of(run.events, "cardMoved").filter((e) => e.instanceId === squire);
    expect(left.at(-1)?.from).toEqual({ kind: "scenarioPlayArea", name: AREA });
  });

  it("player elimination takes the eliminated player's card out of the area, into their discard pile", () => {
    const staged = play(start(), OPEN, SEND_SQUIRE, SEND_WARDEN);
    const squire = idOf(staged.state, SQUIRE.id, P1);
    const hero = mustPlayer(staged.state, P1).identity.instanceId;
    const run = play(patch(staged.state, hero, { damage: 9 }), HURT_SELF);
    expect(mustPlayer(run.state, P1).eliminated).toBe(true);
    expect(mustPlayer(run.state, P1).discard).toContain(squire);
    // The encounter card there is nobody's and stays.
    expect(areaCards(run.state)).toEqual([idOf(run.state, WARDEN.id)]);
    expect(run.state.outcome).toBeNull();
  });

  it("the unique rule sees it: with a unique ally there, a second card of that character cannot be put into play anywhere", () => {
    const staged = play(start(), OPEN, SEND_PALADIN);
    const paladin = idOf(staged.state, PALADIN.id, P1);
    expect(areaCards(staged.state)).toEqual([paladin]);
    const twin = idOf(staged.state, PALADIN_TWIN.id, P2);
    // P2 puts their own card of that character into play by an effect: it has no effect, and the card stays put.
    const before = locateCard(staged.state, twin);
    const tried = playFree(staged.state, deps, TWIN.card.id, P2);
    expect(of(tried.events, "uniqueEntryBlocked")).toMatchObject([
      { instanceId: twin, matchedInstanceId: paladin, disposition: "noEffect" },
    ]);
    expect(locateCard(tried.state, twin)).toEqual(before);
  });

  it("refuses what has no place there: an area the game does not have, an upgrade with no host, a treachery", () => {
    const none = play(start(), SEND_SQUIRE);
    expect(of(none.events, "putIntoPlayRefused")).toMatchObject([{ reason: "noSuchArea" }]);
    expect(none.state.scenarioPlayAreas).toBeUndefined();
    const run = play(start(), OPEN, SEND_BADGE, SEND_NOISE);
    const refused = of(run.events, "putIntoPlayRefused");
    expect(refused.length).toBeGreaterThan(1);
    expect(refused.every((e) => e.reason === "cardType")).toBe(true);
    expect(new Set(refused.map((e) => run.state.instances[e.instanceId]?.cardId))).toEqual(
      new Set([BADGE.id, NOISE.id]),
    );
    expect(areaCards(run.state)).toEqual([]);
  });
});
