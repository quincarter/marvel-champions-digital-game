/**
 * An upgrade an effect puts into play enters play as playing it would, and `TargetQuery.canAttachTo` asks the same
 * question of a card out of play. Both read `upgradeHostCandidates` (`attachment-hosts.ts`), the decision a play makes.
 *
 * RRG 1.8 "Play, Put into Play" (p. 32): "Unless otherwise stated by the 'put into play' effect, cards that are put into
 * play must do so in a play area or state that matches the rules of playing the card", and "A card that is put into
 * play is not considered to have been played". "Attach To" (p. 8): the card "must be attached to … the specified game
 * element as it enters play"; "If the initial 'attach to' check does not pass, the card is not able to be attached, so
 * it remains in its prior state or game area." "Upgrade" (p. 46): "Most upgrade cards enter play near a player's
 * identity card"; "Ownership and Control" (p. 31): an upgrade on a card another player controls is that player's.
 *
 * "When Defeated: Each player may search their deck and discard pile for a WEAPON upgrade … and put it into play" (Lock
 * and Load, `next_evol` 40019); "choose an upgrade in any player's discard pile with a cost of 1 or less that can be
 * attached to Deathlok. Attach that upgrade to Deathlok." (40025). Synthetic cards throughout.
 */

import type { AnyCard, AttachmentHost, UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { upgradeHostCandidates } from "./attachment-hosts.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import { matchesQuery } from "./select.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const upgrade = (id: string, attachesTo?: AttachmentHost, extra: Partial<UpgradeCard> = {}): UpgradeCard => ({
  ...stubUpgrade({ id, cost: 1 }),
  ...(attachesTo ? { attachesTo } : {}),
  ...extra,
});

/** No "attach to" text: by its controller's identity. */
const GEAR = upgrade("gear");
/** "Attach to an ally." */
const BADGE = upgrade("badge", { kind: "ally" });
/** "Attach to an ally. Max 1 per ally." */
const CREST = upgrade("crest", { kind: "ally" }, { playRestrictions: { maxPerHost: 1 } });
/** "Attach to a minion." */
const LEASH = upgrade("leash", { kind: "minion" });
/** "Attach to an ally you control." */
const OWN_BADGE = upgrade("own-badge", { kind: "qualified", category: "ally", controlledBy: "you" });
const SCOUT = stubAlly({ id: "scout", cost: 0, atk: 1, thw: 1, hp: 3 });
const GUARD = stubAlly({ id: "guard", cost: 0, atk: 1, thw: 1, hp: 3 });
const BRUTE = stubMinion({ id: "brute", atk: 0, sch: 0, hp: 9 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects: [...effects] });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const yours = (filter: TargetQuery) =>
  ({ kind: "zone", zone: ["deck", "discard", "hand"], player: you, filter }) as const;
/** "Search your deck, discard pile and hand for [name] and put it into play." */
const fetch = (card: AnyCard) =>
  event(`fetch-${card.id}`, [
    { kind: "chooseCards", slot: "found", from: yours({ name: card.name }), chooser: you, min: 1, max: 1 },
    { kind: "putIntoPlay", card: slot("found"), controller: you },
  ]);
const UPGRADES = [GEAR, BADGE, CREST, LEASH, OWN_BADGE];
const FETCH = Object.fromEntries(UPGRADES.map((card) => [card.id, fetch(card)]));
/** "Search your deck, discard pile and hand for [name] and put it into play, facedown." */
const fetchFacedown = (card: AnyCard) =>
  event(`hide-${card.id}`, [
    { kind: "chooseCards", slot: "found", from: yours({ name: card.name }), chooser: you, min: 1, max: 1 },
    { kind: "putIntoPlay", card: slot("found"), controller: you, facedown: true },
    { kind: "turnFacedown", target: slot("found") },
  ]);
const HIDE_GEAR = fetchFacedown(GEAR);
const HIDE_BADGE = fetchFacedown(BADGE);
/** "Search … for an upgrade that can be attached to an ally you control and attach it to that ally." */
const OUTFIT = event("outfit", [
  { kind: "chooseTarget", slot: "ally", query: { categories: ["ally"] }, chooser: you },
  {
    kind: "chooseCards",
    slot: "found",
    from: yours({ categories: ["upgrade"], canAttachTo: slot("ally") }),
    chooser: you,
    min: 0,
    max: 1,
  },
  { kind: "attach", card: slot("found"), to: slot("ally") },
]);
const EVENTS = [...Object.values(FETCH), OUTFIT, HIDE_GEAR, HIDE_BADGE];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));
const PLAYER_CARDS: readonly AnyCard[] = [...UPGRADES, SCOUT, GUARD, ...EVENTS.map((e) => e.card)];

function start(players: 1 | 2 = 1): GameState {
  return gameAtFirstTurn({
    players,
    cards: [...PLAYER_CARDS, BRUTE],
    deps,
    // Two copies of Crest, for its 'Max 1 per ally'.
    deck: [...PLAYER_CARDS.map((card) => card.id), CREST.id],
    encounter: [BRUTE.id],
  });
}
const identityOf = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).identity.instanceId;
const hostOf = (state: GameState, id: InstanceId) => mustInstance(state, id).attachedTo;
const copyOf = (state: GameState, card: AnyCard, player: PlayerId = P1): InstanceId => {
  const seat = mustPlayer(state, player);
  const id = [...seat.deck, ...seat.discard, ...seat.hand].find((i) => state.instances[i]?.cardId === card.id);
  if (!id) throw new Error(`no ${card.id} out of play`);
  return id;
};

interface Step {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** Each host question asked: who was asked and the hosts offered. */
  readonly asked: readonly {
    readonly playerId: PlayerId;
    readonly slot: string;
    readonly options: readonly string[];
  }[];
}
/** `player` plays `card` for 0; a target prompt offering one of `prefer` picks it. The log must replay exactly. */
function play(state: GameState, card: AnyCard, prefer: readonly InstanceId[] = [], player: PlayerId = P1): Step {
  const given = giveCard(state, player, card.id);
  const asked: { playerId: PlayerId; slot: string; options: readonly string[] }[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (!choice) return [];
    const options = choice.options.map((option) => option.optionId);
    if (choice.prompt.kind === "chooseTarget")
      asked.push({ playerId: choice.playerId, slot: choice.prompt.slot, options });
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
  return { state: session.state, events, asked };
}

describe("putIntoPlay: an upgrade enters play as playing it would (RRG 1.8 p. 32)", () => {
  it("an upgrade with no 'attach to' text goes on its controller's identity, and is not played", () => {
    const base = start();
    const gear = copyOf(base, GEAR);
    const { state, events, asked } = play(base, FETCH.gear!.card, [gear]);
    expect(hostOf(state, gear)).toBe(identityOf(state));
    expect(mustInstance(state, identityOf(state)).attachments).toEqual([gear]);
    expect(mustPlayer(state, P1).playArea).not.toContain(gear);
    expect(mustInstance(state, gear)).toMatchObject({ controllerId: P1, faceup: true });
    expect(events.filter((e) => e.type === "cardPlayed" && e.instanceId === gear)).toEqual([]);
    expect(asked.filter((ask) => ask.slot === "putIntoPlayHost")).toEqual([]);
  });

  it("'attach to an ally' with one ally in play: attached to it with no question", () => {
    const scout = playerCardIntoPlay(start(), SCOUT.id);
    const badge = copyOf(scout.state, BADGE);
    const { state, asked } = play(scout.state, FETCH.badge!.card, [badge]);
    expect(hostOf(state, badge)).toBe(scout.id);
    expect(mustInstance(state, scout.id).attachments).toEqual([badge]);
    expect(asked.filter((ask) => ask.slot === "putIntoPlayHost")).toEqual([]);
  });

  it("'attach to an ally' with two allies in play: its controller chooses between exactly those 2", () => {
    const scout = playerCardIntoPlay(start(), SCOUT.id);
    const guard = playerCardIntoPlay(scout.state, GUARD.id);
    const badge = copyOf(guard.state, BADGE);
    const { state, asked } = play(guard.state, FETCH.badge!.card, [badge, guard.id]);
    expect(asked.filter((ask) => ask.slot === "putIntoPlayHost")).toEqual([
      { playerId: P1, slot: "putIntoPlayHost", options: [scout.id, guard.id] },
    ]);
    expect(hostOf(state, badge)).toBe(guard.id);
    expect(mustInstance(state, scout.id).attachments).toEqual([]);
  });

  it("no legal host: it stays where it was (RRG 1.8 'Attach To', p. 8), logged as refused, and nothing enters play", () => {
    const base = start();
    const badge = copyOf(base, BADGE);
    const before = locateCard(base, badge)?.kind;
    const { state, events } = play(base, FETCH.badge!.card, [badge]);
    expect(hostOf(state, badge)).toBeNull();
    expect(locateCard(state, badge)?.kind).toBe(before);
    expect(mustPlayer(state, P1).playArea).not.toContain(badge);
    expect(events).toContainEqual({
      type: "putIntoPlayRefused",
      instanceId: badge,
      playerId: P1,
      reason: "noLegalHost",
    });
    expect(events.filter((e) => e.type === "cardMoved" && e.instanceId === badge)).toEqual([]);
  });

  it("'attach to a minion': an enemy host, and the upgrade stays under its owner's control", () => {
    const brute = minionEngagedWith(start(), BRUTE.id);
    const leash = copyOf(brute.state, LEASH);
    const { state } = play(brute.state, FETCH.leash!.card, [leash]);
    expect(hostOf(state, leash)).toBe(brute.id);
    expect(mustInstance(state, leash).controllerId).toBe(P1);
  });

  it("'Max 1 per ally': an ally already holding a copy is not a host, so the second copy stays out of play", () => {
    const scout = playerCardIntoPlay(start(), SCOUT.id);
    const first = play(scout.state, FETCH.crest!.card);
    const held = mustInstance(first.state, scout.id).attachments;
    expect(held).toHaveLength(1);
    const again = play(first.state, FETCH.crest!.card);
    expect(mustInstance(again.state, scout.id).attachments).toEqual(held);
    expect(again.events.filter((e) => e.type === "putIntoPlayRefused")).toHaveLength(1);
  });

  it("on another player's ally the upgrade is that player's from the moment it is attached (RRG 1.8 p. 31)", () => {
    const guard = playerCardIntoPlay(start(2), GUARD.id, P2);
    const badge = copyOf(guard.state, BADGE);
    const { state, events } = play(guard.state, FETCH.badge!.card, [badge]);
    expect(hostOf(state, badge)).toBe(guard.id);
    expect(mustInstance(state, badge)).toMatchObject({ ownerId: P1, controllerId: P2 });
    expect(events).toContainEqual(
      expect.objectContaining({ type: "controllerChanged", instanceId: badge, to: P2, reason: "attachedTo" }),
    );
  });
});

describe("putIntoPlay facedown: no host is read, the card stays loose in its controller's play area", () => {
  it("the same identity upgrade: faceup it is on the identity, facedown it is loose, unattached and facedown", () => {
    const base = start();
    const gear = copyOf(base, GEAR);
    const faceup = play(base, FETCH.gear!.card, [gear]).state;
    expect(hostOf(faceup, gear)).toBe(identityOf(faceup));
    expect(mustPlayer(faceup, P1).playArea).not.toContain(gear);

    const { state, events } = play(base, HIDE_GEAR.card, [gear]);
    expect(hostOf(state, gear)).toBeNull();
    expect(mustPlayer(state, P1).playArea).toContain(gear);
    expect(mustInstance(state, identityOf(state)).attachments).toEqual([]);
    expect(mustInstance(state, gear)).toMatchObject({ controllerId: P1, faceup: false });
    expect(events.filter((e) => e.type === "putIntoPlayRefused")).toEqual([]);
  });

  it("an 'attach to an ally' upgrade put into play facedown: loose with 2 allies in play, and nobody is asked", () => {
    const scout = playerCardIntoPlay(start(), SCOUT.id);
    const guard = playerCardIntoPlay(scout.state, GUARD.id);
    const badge = copyOf(guard.state, BADGE);
    const { state, asked } = play(guard.state, HIDE_BADGE.card, [badge]);
    expect(hostOf(state, badge)).toBeNull();
    expect(mustPlayer(state, P1).playArea).toContain(badge);
    expect(mustInstance(state, scout.id).attachments).toEqual([]);
    expect(mustInstance(state, guard.id).attachments).toEqual([]);
    expect(asked.filter((ask) => ask.slot === "putIntoPlayHost")).toEqual([]);
  });
});

describe("upgradeHostCandidates: one decision for a play, a put into play and a query", () => {
  it("no 'attach to' text: the controller's identity only; 'attach to an ally': every ally in play", () => {
    const scout = playerCardIntoPlay(start(2), SCOUT.id);
    const guard = playerCardIntoPlay(scout.state, GUARD.id, P2);
    const state = guard.state;
    expect(upgradeHostCandidates(state, deps, copyOf(state, GEAR), P1)).toEqual([identityOf(state, P1)]);
    expect(upgradeHostCandidates(state, deps, copyOf(state, GEAR), P2)).toEqual([identityOf(state, P2)]);
    expect(upgradeHostCandidates(state, deps, copyOf(state, BADGE), P1)).toEqual([scout.id, guard.id]);
    expect(upgradeHostCandidates(state, deps, copyOf(state, OWN_BADGE), P1)).toEqual([scout.id]);
    expect(upgradeHostCandidates(state, deps, copyOf(state, OWN_BADGE), P2)).toEqual([guard.id]);
    expect(upgradeHostCandidates(state, deps, copyOf(state, LEASH), P1)).toEqual([]);
    expect(upgradeHostCandidates(state, deps, scout.id, P1)).toEqual([]);
  });
});

describe("TargetQuery canAttachTo: 'an upgrade that can be attached to [that card]'", () => {
  const context = {
    selfInstanceId: null,
    controllerId: P1,
    event: null,
    bindings: {} as Record<string, readonly InstanceId[]>,
    deps,
  };
  const canAttach = (state: GameState, card: AnyCard, host: InstanceId, owner: PlayerId = P1): boolean =>
    matchesQuery(
      state,
      copyOf(state, card, owner),
      { categories: ["upgrade"], canAttachTo: slot("host") },
      { ...context, bindings: { host: [host] } },
    );

  it("reads the upgrade's printed host: 2 of the 5 upgrades can go on an ally, 1 on the identity, 1 on a minion", () => {
    const scout = playerCardIntoPlay(start(), SCOUT.id);
    const brute = minionEngagedWith(scout.state, BRUTE.id);
    const state = brute.state;
    const onto = (host: InstanceId) => UPGRADES.filter((card) => canAttach(state, card, host)).map((card) => card.id);
    expect(onto(scout.id)).toEqual(["badge", "crest", "own-badge"]);
    expect(onto(identityOf(state))).toEqual(["gear"]);
    expect(onto(brute.id)).toEqual(["leash"]);
  });

  it("'you' is the player who would control it there: another player's 'ally you control' upgrade fits your ally", () => {
    const scout = playerCardIntoPlay(start(2), SCOUT.id);
    const state = scout.state;
    expect(canAttach(state, OWN_BADGE, scout.id, P2)).toBe(true);
    // An upgrade with no "attach to" text goes by its controller's identity, never another card.
    expect(canAttach(state, GEAR, identityOf(state, P1), P2)).toBe(true);
    expect(canAttach(state, GEAR, scout.id, P2)).toBe(false);
  });

  it("a host at its 'Max 1 per ally' is not one, and nothing named matches nothing", () => {
    const scout = playerCardIntoPlay(start(), SCOUT.id);
    const first = play(scout.state, FETCH.crest!.card).state;
    expect(mustInstance(first, scout.id).attachments).toHaveLength(1);
    expect(canAttach(first, CREST, scout.id)).toBe(false);
    expect(canAttach(first, BADGE, scout.id)).toBe(true);
    expect(matchesQuery(first, copyOf(first, BADGE), { canAttachTo: slot("nobody") }, context)).toBe(false);
  });

  it("a choice narrowed by it offers only the 4 ally upgrade cards of 6, and the one picked is attached to the ally", () => {
    const scout = playerCardIntoPlay(start(), SCOUT.id);
    const given = giveCard(scout.state, P1, OUTFIT.card.id);
    const offered: string[][] = [];
    const badge = copyOf(given.state, BADGE);
    const pick = (current: GameState): readonly string[] => {
      const choice = current.pendingChoice;
      if (choice?.prompt.kind !== "chooseCards") return defaultPick(current);
      offered.push(
        choice.options.map((option) => mustInstance(current, option.optionId as InstanceId).cardId as string),
      );
      return [badge];
    };
    const { session } = driveSession(
      startSession(given.state),
      deps,
      [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
      pick,
    );
    // Gear (identity) and Leash (a minion) are not offered; both copies of Crest are.
    expect(offered.map((ids) => [...ids].sort())).toEqual([["badge", "crest", "crest", "own-badge"]]);
    expect(hostOf(session.state, badge)).toBe(scout.id);
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });
});
