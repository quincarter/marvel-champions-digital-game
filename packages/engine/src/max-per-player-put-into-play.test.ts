/**
 * "Max 1 per player" and an effect that puts the card into play (owner decision, docs/phase7-wave9.md §4.1 Q37 = A):
 * a player cannot take control of another copy of a "Max 1 per player" card they already control, by any route.
 *
 * RRG 1.8 "Max, Maximum" (p. 28): "'Max 1 per player' is player specific, and restricts the number of copies of that
 * card that each player may control in play at a given time. A player cannot take control of another copy of a 'Max 1
 * per player' card they already control." It is a limit on control, so "Play, Put into Play" (p. 32: "it bypasses …
 * any restrictions or prohibitions regarding playing that card") does not lift it. The second copy does not enter
 * play: it stays where it was and the rest of the effect resolves. "Ownership and Control" (p. 31): an upgrade on a
 * card another player controls is that player's.
 *
 * "Choose a PREPARATION upgrade from your discard pile → put that card into play" (Winter, Widow, Soldier, Spy,
 * `winter` 54023) with Aggressive Stance (54017, "Max 1 per player"). Synthetic cards throughout.
 */

import type { AnyCard, AttachmentHost, SupportCard, UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { putIntoPlayHostCandidates, upgradeHostCandidates } from "./attachment-hosts.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import { maxPerPlayerReached } from "./rules.js";
import { matchesQuery } from "./select.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const MAX_ONE = { playRestrictions: { maxPerPlayer: 1 } } as const;
const upgrade = (id: string, attachesTo?: AttachmentHost): UpgradeCard => ({
  ...stubUpgrade({ id, cost: 1 }),
  ...(attachesTo ? { attachesTo } : {}),
  ...MAX_ONE,
});

/** "Max 1 per player.", no "attach to" text: by its controller's identity (Aggressive Stance's shape). */
const STANCE = upgrade("stance");
/** "Attach to an ally. Max 1 per player." */
const BADGE = upgrade("badge", { kind: "ally" });
/** A support, "Max 1 per player." */
const DEN: SupportCard = { ...stubSupport({ id: "den", cost: 1 }), ...MAX_ONE };
/** An upgrade with no maximum. */
const GEAR = stubUpgrade({ id: "gear", cost: 1 });
const SCOUT = stubAlly({ id: "scout", cost: 0, atk: 1, thw: 1, hp: 3 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects: [...effects] });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const yours = (filter: TargetQuery) =>
  ({ kind: "zone", zone: ["deck", "discard", "hand"], player: you, filter }) as const;
const find = (name: string, card: AnyCard): EffectSpec => ({
  kind: "chooseCards",
  slot: name,
  from: yours({ name: card.name }),
  chooser: you,
  min: 1,
  max: 1,
});
/** "Search your deck, discard pile and hand for [name] and put it into play." */
const fetch = (card: AnyCard) =>
  event(`fetch-${card.id}`, [find("found", card), { kind: "putIntoPlay", card: slot("found"), controller: you }]);
const FETCH_STANCE = fetch(STANCE);
const FETCH_BADGE = fetch(BADGE);
const FETCH_DEN = fetch(DEN);
/** The same, then a second card: the rest of the effect after a copy that could not enter play. */
const FETCH_STANCE_AND_GEAR = event("fetch-both", [
  find("found", STANCE),
  { kind: "putIntoPlay", card: slot("found"), controller: you },
  find("other", GEAR),
  { kind: "putIntoPlay", card: slot("other"), controller: you },
]);
/** "… and put it into play, facedown." */
const HIDE_STANCE = event("hide-stance", [
  find("found", STANCE),
  { kind: "putIntoPlay", card: slot("found"), controller: you, facedown: true },
  { kind: "turnFacedown", target: slot("found") },
]);
const EVENTS = [FETCH_STANCE, FETCH_BADGE, FETCH_DEN, FETCH_STANCE_AND_GEAR, HIDE_STANCE];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));
const PLAYER_CARDS: readonly AnyCard[] = [STANCE, BADGE, DEN, GEAR, SCOUT, ...EVENTS.map((e) => e.card)];

/** Each seat's deck holds three copies of every "Max 1 per player" card. */
function start(players: 1 | 2 = 1): GameState {
  return gameAtFirstTurn({
    players,
    cards: PLAYER_CARDS,
    deps,
    deck: [...PLAYER_CARDS.map((card) => card.id), STANCE.id, STANCE.id, BADGE.id, BADGE.id, DEN.id, DEN.id, SCOUT.id],
  });
}
const identityOf = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).identity.instanceId;
const copyOf = (state: GameState, card: AnyCard, player: PlayerId = P1): InstanceId => {
  const seat = mustPlayer(state, player);
  const id = [...seat.deck, ...seat.discard, ...seat.hand].find((i) => state.instances[i]?.cardId === card.id);
  if (!id) throw new Error(`no ${card.id} out of play`);
  return id;
};
/** `player` plays `card` for 0; a prompt offering one of `prefer` picks it. The log must replay exactly. */
function play(state: GameState, card: AnyCard, prefer: readonly InstanceId[] = [], player: PlayerId = P1) {
  const given = giveCard(state, player, card.id);
  const pick = (current: GameState): readonly string[] => {
    const options = current.pendingChoice?.options.map((option) => option.optionId) ?? [];
    const wanted = prefer.find((id) => options.includes(id));
    return wanted ? [wanted] : defaultPick(current);
  };
  const command: Command = {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const { session, events } = driveSession(startSession(given.state), deps, [command], pick);
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
  return { state: session.state, events: events as readonly GameEvent[] };
}
const refusals = (events: readonly GameEvent[]) => events.filter((e) => e.type === "putIntoPlayRefused");
const copiesOn = (state: GameState, host: InstanceId, card: AnyCard): readonly InstanceId[] =>
  mustInstance(state, host).attachments.filter((id) => state.instances[id]?.cardId === card.id);

describe("'Max 1 per player' limits control: a second copy an effect puts into play does not enter play", () => {
  it("the first copy enters play; the second stays where it was and is logged as refused", () => {
    const base = start();
    const first = copyOf(base, STANCE);
    const one = play(base, FETCH_STANCE.card, [first]);
    expect(copiesOn(one.state, identityOf(one.state), STANCE)).toEqual([first]);
    expect(refusals(one.events)).toEqual([]);

    const second = copyOf(one.state, STANCE);
    const before = locateCard(one.state, second);
    expect(maxPerPlayerReached(one.state, second, P1)).toBe(1);
    // The card in play never counts against itself.
    expect(maxPerPlayerReached(one.state, first, P1)).toBeNull();
    const two = play(one.state, FETCH_STANCE.card, [second]);
    expect(copiesOn(two.state, identityOf(two.state), STANCE)).toEqual([first]);
    expect(locateCard(two.state, second)).toEqual(before);
    expect(mustInstance(two.state, second).attachedTo).toBeNull();
    expect(refusals(two.events)).toEqual([
      { type: "putIntoPlayRefused", instanceId: second, playerId: P1, reason: "maxPerPlayer" },
    ]);
    expect(two.events.filter((e) => e.type === "cardMoved" && e.instanceId === second)).toEqual([]);
  });

  it("the rest of the effect still resolves", () => {
    const one = play(start(), FETCH_STANCE.card);
    const second = copyOf(one.state, STANCE);
    const gear = copyOf(one.state, GEAR);
    const two = play(one.state, FETCH_STANCE_AND_GEAR.card, [second, gear]);
    expect(copiesOn(two.state, identityOf(two.state), STANCE)).toHaveLength(1);
    expect(mustInstance(two.state, gear).attachedTo).toBe(identityOf(two.state));
    expect(refusals(two.events).map((e) => e.instanceId)).toEqual([second]);
  });

  it("a support: the second copy is not put into the play area", () => {
    const one = play(start(), FETCH_DEN.card);
    const inPlay = mustPlayer(one.state, P1).playArea.filter((id) => one.state.instances[id]?.cardId === DEN.id);
    expect(inPlay).toHaveLength(1);
    const second = copyOf(one.state, DEN);
    const before = locateCard(one.state, second);
    const two = play(one.state, FETCH_DEN.card, [second]);
    expect(mustPlayer(two.state, P1).playArea.filter((id) => two.state.instances[id]?.cardId === DEN.id)).toEqual(
      inPlay,
    );
    expect(locateCard(two.state, second)).toEqual(before);
    expect(refusals(two.events)).toEqual([
      { type: "putIntoPlayRefused", instanceId: second, playerId: P1, reason: "maxPerPlayer" },
    ]);
  });

  it("is player specific: another player puts their own copy into play", () => {
    const one = play(start(2), FETCH_DEN.card);
    const theirs = copyOf(one.state, DEN, P2);
    expect(maxPerPlayerReached(one.state, theirs, P2)).toBeNull();
    const two = play(one.state, FETCH_DEN.card, [theirs], P2);
    expect(mustPlayer(two.state, P2).playArea).toContain(theirs);
    expect(mustInstance(two.state, theirs).controllerId).toBe(P2);
    expect(refusals(two.events)).toEqual([]);
  });

  it("an upgrade goes by who would control it: not onto the player's own ally, but onto another player's", () => {
    const scout = playerCardIntoPlay(start(2), SCOUT.id);
    const one = play(scout.state, FETCH_BADGE.card);
    expect(copiesOn(one.state, scout.id, BADGE)).toHaveLength(1);

    // Only the player's own ally in play: the second copy has a host by its text and none under the maximum.
    const second = copyOf(one.state, BADGE);
    expect(upgradeHostCandidates(one.state, deps, second, P1)).toEqual([scout.id]);
    expect(putIntoPlayHostCandidates(one.state, deps, second, P1)).toEqual([]);
    const refused = play(one.state, FETCH_BADGE.card, [second]);
    expect(copiesOn(refused.state, scout.id, BADGE)).toHaveLength(1);
    expect(refusals(refused.events)).toEqual([
      { type: "putIntoPlayRefused", instanceId: second, playerId: P1, reason: "maxPerPlayer" },
    ]);

    // Another player's ally in play: that player would control the copy (p. 31) and controls none, so it goes there,
    // with no question asked since it is the only host left.
    const other = playerCardIntoPlay(one.state, SCOUT.id, P2);
    expect(putIntoPlayHostCandidates(other.state, deps, second, P1)).toEqual([other.id]);
    const placed = play(other.state, FETCH_BADGE.card, [second]);
    expect(mustInstance(placed.state, second)).toMatchObject({ attachedTo: other.id, controllerId: P2 });
    expect(copiesOn(placed.state, scout.id, BADGE)).toHaveLength(1);
    expect(refusals(placed.events)).toEqual([]);
  });

  it("a copy put into play facedown has no title to count", () => {
    const one = play(start(), FETCH_STANCE.card);
    const second = copyOf(one.state, STANCE);
    const two = play(one.state, HIDE_STANCE.card, [second]);
    expect(refusals(two.events)).toEqual([]);
    expect(mustPlayer(two.state, P1).playArea).toContain(second);
    expect(mustInstance(two.state, second).faceup).toBe(false);
  });

  it("`TargetQuery.canEnterPlay` does not offer the second copy to that player, and offers it to another", () => {
    const one = play(start(2), FETCH_DEN.card);
    const second = copyOf(one.state, DEN);
    const context = (controllerId: PlayerId) => ({
      selfInstanceId: null,
      controllerId,
      event: null,
      bindings: {},
      deps,
    });
    const query: TargetQuery = { categories: ["support"], canEnterPlay: you };
    expect(matchesQuery(one.state, second, query, context(P1))).toBe(false);
    expect(matchesQuery(one.state, copyOf(one.state, DEN, P2), query, context(P2))).toBe(true);
    const stance = play(one.state, FETCH_STANCE.card);
    const upgradeQuery: TargetQuery = { categories: ["upgrade"], canEnterPlay: you };
    expect(matchesQuery(stance.state, copyOf(stance.state, STANCE), upgradeQuery, context(P1))).toBe(false);
    expect(matchesQuery(stance.state, copyOf(stance.state, GEAR), upgradeQuery, context(P1))).toBe(true);
  });

  it("playing the second copy is refused as before", () => {
    const one = play(start(), FETCH_DEN.card);
    const given = giveCard(one.state, P1, DEN.id);
    const result = applyCommand(
      given.state,
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("max 1 per player");
  });
});
