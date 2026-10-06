/**
 * Restricted is a limit on what a player controls in play, not a play restriction (docs/phase7-wave7.md §4.1, owner
 * ruling 2026-10-06). RRG 1.8 "Restricted" (p. 38): "A player can play or put into play a restricted card even if they
 * already control two restricted cards. However, if a player ever controls more than two restricted cards in play, they
 * must immediately choose and discard from play restricted cards they control until they have only two in play."
 *
 * Synthetic cards: ordinary restricted upgrades ("Gadget", and a Weapon "Rifle"), a plain Weapon ("Club"), a
 * permanent restricted upgrade shaped like a Psi-Katana ("Katana"; RRG 1.8 "Permanent", p. 32), a support shaped
 * like Armed to the Teeth ("Cache": a Weapon attached facedown, swapped with a Weapon upgrade you control), a support
 * another player's restricted upgrade sits on ("Rack"), and events that put a card into play or take control of one.
 *
 * Sources: RRG 1.8 "Restricted" (p. 38), "Facedown Cards" (p. 23), "Permanent" (p. 32), "'Swap'" (p. 42), "Ownership
 * and Control" (p. 31).
 */
import { trait, type AbilityId, type CardId, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { restrictedStanding } from "./rules.js";
import { cardsInPlay, controllerOf, restrictedCardsOf, restrictedLoadOf } from "./select.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard, resolvePending } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const WEAPON = trait("Weapon");
const self: TargetRef = { kind: "self" };
const you = { kind: "controller" } as const;
const restricted = [{ name: "restricted" as const }];

const GADGET = stubUpgrade({ id: "gadget", cost: 0, keywords: restricted });
const RIFLE = stubUpgrade({ id: "rifle", cost: 0, traits: [WEAPON], keywords: restricted });
const CLUB = stubUpgrade({ id: "club", cost: 0, traits: [WEAPON] });
/** Restricted and permanent: it counts toward the limit and cannot be discarded for it. */
const KATANA = stubUpgrade({ id: "katana", cost: 0, keywords: [{ name: "restricted" }, { name: "permanent" }] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Put a [card] from your hand into play." */
const call = (card: UpgradeCard) =>
  event(`call-${card.id}`, [
    {
      kind: "selectCards",
      slot: "called",
      cards: { kind: "zone", zone: "hand", player: you, filter: { name: card.name }, topmostOnly: true },
    },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "called" }, controller: you },
  ]);
const CALL_GADGET = call(GADGET);
const CALL_KATANA = call(KATANA);

const FACEDOWN_HERE: TargetQuery = { host: self, facedown: true };
/** "Attach 1 Weapon upgrade from your hand facedown here." */
const STASH = stubAbility("cache.stash", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "chooseCards",
      slot: "stashed",
      from: { kind: "zone", zone: "hand", player: you, filter: { categories: ["upgrade"], trait: WEAPON } },
      chooser: you,
      min: 1,
      max: 1,
    },
    { kind: "attach", card: { kind: "slot", slot: "stashed" }, to: self, facedown: true },
  ],
});
/** "Swap the facedown card attached here with a Weapon upgrade you control." */
const SWAP = stubAbility("cache.swap", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "swapCards",
      a: { kind: "each", query: FACEDOWN_HERE },
      b: { kind: "each", query: { categories: ["upgrade"], controller: "you", trait: WEAPON } },
    },
  ],
});
const CACHE = stubSupport({ id: "cache", cost: 0, abilities: [STASH.ref, SWAP.ref] });

const RACK = stubSupport({ id: "rack", cost: 0 });
/** "Detach each upgrade from a Rack and take control of it." */
const SEIZE = event("seize", [
  {
    kind: "detach",
    card: { kind: "each", query: { categories: ["upgrade"], host: { kind: "each", query: { name: RACK.name } } } },
    controller: you,
  },
]);

const deps: EngineDeps = depsOf(CALL_GADGET.ability, CALL_KATANA.ability, STASH, SWAP, SEIZE.ability);
const CARDS = [GADGET, RIFLE, CLUB, KATANA, CACHE, RACK, CALL_GADGET.card, CALL_KATANA.card, SEIZE.card];
const DECK: readonly CardId[] = [
  ...copiesOf(GADGET.id, 4),
  ...copiesOf(RIFLE.id, 2),
  ...copiesOf(KATANA.id, 2),
  CLUB.id,
  CACHE.id,
  RACK.id,
  CALL_GADGET.card.id,
  CALL_KATANA.card.id,
  SEIZE.card.id,
];

/** A game at p1's first turn with `inPlay` already in play under p1, placed without the enter-play checks. */
function start(
  inPlay: readonly CardId[],
  players: 1 | 2 = 1,
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  let state = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK, players });
  const ids: InstanceId[] = [];
  for (const card of inPlay) {
    const placed = playerCardIntoPlay(state, card);
    state = placed.state;
    ids.push(placed.id);
  }
  return { state, ids };
}
const playOf = (id: InstanceId, playerId: PlayerId = P1): Command => ({
  type: "playCard",
  playerId,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const use = (id: InstanceId, abilityId: AbilityId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: id,
  abilityId,
  payment: [],
});
/** Applies one command with no choice answered, so a test reads the prompt it left. */
function apply(
  state: GameState,
  command: Command,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const result = applyCommand(state, command, deps);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return { state: result.state, events: result.events };
}
/** Hands p1 a copy of `card` and plays it. */
function play(state: GameState, card: CardId) {
  const given = giveCard(state, P1, card);
  return { ...apply(given.state, playOf(given.id)), id: given.id };
}
const inPlay = (state: GameState, id: InstanceId): boolean => cardsInPlay(state).includes(id);
/** Sorted: the cards are compared as sets, since a card attached to the identity is listed ahead of the play area. */
const sorted = (ids: readonly (string | undefined)[]): readonly (string | undefined)[] => [...ids].sort();
const offered = (state: GameState): readonly (string | undefined)[] =>
  sorted(state.pendingChoice?.options.map((option) => option.optionId) ?? []);
const restrictedOf = (state: GameState, playerId: PlayerId = P1): readonly (string | undefined)[] =>
  sorted(restrictedCardsOf(state, playerId, deps));

describe("playing a restricted card over the limit", () => {
  it("is a legal action: legalActions lists the play, with no refusal for the limit", () => {
    const { state } = start([GADGET.id, GADGET.id]);
    const given = giveCard(state, P1, RIFLE.id);
    const actions = legalActions(given.state, P1, deps);
    if (actions.kind !== "turn") throw new Error(`expected the player's turn, got ${actions.kind}`);
    const isThePlay = (entry: { readonly action: { readonly kind: string } }) =>
      entry.action.kind === "playCard" && "instanceId" in entry.action && entry.action.instanceId === given.id;
    expect(actions.legal.filter(isThePlay)).toHaveLength(1);
    expect(actions.illegal.filter(isThePlay)).toEqual([]);
  });

  it("the play resolves, then the player chooses one of all three restricted cards, the new one included", () => {
    const { state, ids } = start([GADGET.id, GADGET.id]);
    const played = play(state, RIFLE.id);
    expect(inPlay(played.state, played.id)).toBe(true);
    const choice = played.state.pendingChoice;
    expect(choice?.playerId).toBe(P1);
    expect(choice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
    expect(offered(played.state)).toEqual(sorted([...ids, played.id]));
    expect([choice?.minSelections, choice?.maxSelections]).toEqual([1, 1]);
  });

  it("the chosen card is discarded and the other two stay", () => {
    const { state, ids } = start([GADGET.id, GADGET.id]);
    const played = play(state, RIFLE.id);
    const after = resolvePending(played.state, [ids[0] as string], deps);
    expect([ids[0], ids[1], played.id].map((id) => inPlay(after, id as InstanceId))).toEqual([false, true, true]);
    expect(mustPlayer(after, P1).discard).toContain(ids[0]);
    expect(restrictedOf(after, P1)).toEqual(sorted([ids[1], played.id]));
    expect(after.pendingChoice).toBeNull();
  });

  it("the card just played may be the one chosen", () => {
    const { state, ids } = start([GADGET.id, GADGET.id]);
    const played = play(state, RIFLE.id);
    const after = resolvePending(played.state, [played.id], deps);
    expect(inPlay(after, played.id)).toBe(false);
    expect(mustPlayer(after, P1).discard).toContain(played.id);
    expect(restrictedOf(after, P1)).toEqual(sorted(ids));
    expect(after.pendingChoice).toBeNull();
  });

  it("choosing too few or a card that was not offered is refused, and the choice stays open", () => {
    const { state } = start([GADGET.id, GADGET.id]);
    const played = play(state, RIFLE.id);
    const choice = played.state.pendingChoice!;
    const answer = (selectedOptionIds: readonly string[]) =>
      applyCommand(
        played.state,
        { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds },
        deps,
      );
    expect(answer([]).ok).toBe(false);
    expect(answer([mustPlayer(played.state, P1).identity.instanceId]).ok).toBe(false);
  });

  it("at the limit or under it, nobody is asked", () => {
    const one = play(start([GADGET.id]).state, RIFLE.id);
    expect(one.state.pendingChoice).toBeNull();
    expect(restrictedLoadOf(one.state, P1, deps)).toBe(2);
    const none = play(start([]).state, RIFLE.id);
    expect(none.state.pendingChoice).toBeNull();
  });
});

describe("put into play by an effect", () => {
  it("a third restricted card put into play asks for the same choice", () => {
    const { state, ids } = start([GADGET.id, RIFLE.id]);
    const held = giveCard(state, P1, GADGET.id);
    const put = play(held.state, CALL_GADGET.card.id);
    expect(inPlay(put.state, held.id)).toBe(true);
    expect(put.state.pendingChoice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
    expect(offered(put.state)).toEqual(sorted([...ids, held.id]));
    const after = resolvePending(put.state, [ids[1] as string], deps);
    expect(restrictedOf(after, P1)).toEqual(sorted([ids[0], held.id]));
    expect(mustPlayer(after, P1).discard).toContain(ids[1]);
  });
});

describe("a permanent restricted card (the second Psi-Katana, §4.1 Q38)", () => {
  it("a second Katana beside a restricted upgrade: only the upgrade is offered, and it is discarded", () => {
    const { state, ids } = start([KATANA.id, GADGET.id]);
    const [katana, gadget] = ids as [InstanceId, InstanceId];
    const second = giveCard(state, P1, KATANA.id, [katana]);
    const put = play(second.state, CALL_KATANA.card.id);
    const choice = put.state.pendingChoice;
    expect(choice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
    expect(offered(put.state)).toEqual(sorted([gadget]));
    expect([choice?.minSelections, choice?.maxSelections]).toEqual([1, 1]);
    const after = resolvePending(put.state, [gadget], deps);
    expect(restrictedOf(after, P1)).toEqual(sorted([katana, second.id]));
    expect(inPlay(after, gadget)).toBe(false);
  });

  it("a restricted upgrade played beside two Katanas is the only card offered: it is discarded at once", () => {
    const { state, ids } = start([KATANA.id, KATANA.id]);
    const played = play(state, GADGET.id);
    expect(offered(played.state)).toEqual(sorted([played.id]));
    const after = resolvePending(played.state, [played.id], deps);
    expect(restrictedOf(after, P1)).toEqual(sorted(ids));
    expect(mustPlayer(after, P1).discard).toContain(played.id);
  });

  it("a Katana cannot be picked for the discard even by a hand-written answer", () => {
    const { state, ids } = start([KATANA.id, KATANA.id]);
    const played = play(state, GADGET.id);
    const choice = played.state.pendingChoice!;
    const forged = applyCommand(
      played.state,
      { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: [ids[0] as string] },
      deps,
    );
    expect(forged.ok).toBe(false);
  });
});

describe("the swap that turns up a restricted Weapon (Armed to the Teeth's shape)", () => {
  /** The Cache with a Rifle stashed facedown, a Club and two Gadgets in play. */
  function armed() {
    const { state, ids } = start([CACHE.id, CLUB.id, GADGET.id, GADGET.id]);
    const [cache, club, ...gadgets] = ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const rifle = giveCard(state, P1, RIFLE.id);
    const stashed = apply(rifle.state, use(cache, STASH.ref.id));
    const afterStash = resolvePending(stashed.state, [rifle.id], deps);
    return { state: afterStash, cache, club, gadgets, rifle: rifle.id };
  }

  it("the facedown Rifle is out of play and does not count: two restricted cards, nobody asked", () => {
    const g = armed();
    expect(mustInstance(g.state, g.rifle)).toMatchObject({ attachedTo: g.cache, faceup: false });
    expect(inPlay(g.state, g.rifle)).toBe(false);
    expect(g.state.pendingChoice).toBeNull();
    expect(restrictedStanding(g.state, deps, P1)).toEqual({ load: 2, limit: 2, held: g.gadgets });
  });

  it("the swap resolves, then the limit is enforced: the Rifle is in play and one of the three is discarded", () => {
    const g = armed();
    const swapped = apply(g.state, use(g.cache, SWAP.ref.id));
    expect(swapped.events.filter((e) => e.type === "cardsSwapped")).toHaveLength(1);
    expect(swapped.events.filter((e) => e.type === "swapRefused")).toEqual([]);
    expect(inPlay(swapped.state, g.rifle)).toBe(true);
    expect(mustInstance(swapped.state, g.club)).toMatchObject({ attachedTo: g.cache, faceup: false });
    const choice = swapped.state.pendingChoice;
    expect(choice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
    expect(offered(swapped.state)).toEqual(sorted([...g.gadgets, g.rifle]));
    expect([choice?.minSelections, choice?.maxSelections]).toEqual([1, 1]);

    const after = resolvePending(swapped.state, [g.gadgets[0]], deps);
    expect(inPlay(after, g.rifle)).toBe(true);
    expect(restrictedOf(after, P1)).toEqual(sorted([g.gadgets[1], g.rifle]));
    expect(mustPlayer(after, P1).discard).toContain(g.gadgets[0]);
    // The Club the swap turned facedown stays where the swap put it.
    expect(mustInstance(after, g.club)).toMatchObject({ attachedTo: g.cache, faceup: false });
  });

  it("with room under the limit the swap asks nothing", () => {
    const { state, ids } = start([CACHE.id, CLUB.id, GADGET.id]);
    const cache = ids[0] as InstanceId;
    const rifle = giveCard(state, P1, RIFLE.id);
    const stashed = resolvePending(apply(rifle.state, use(cache, STASH.ref.id)).state, [rifle.id], deps);
    const swapped = apply(stashed, use(cache, SWAP.ref.id));
    expect(inPlay(swapped.state, rifle.id)).toBe(true);
    expect(swapped.state.pendingChoice).toBeNull();
    expect(restrictedLoadOf(swapped.state, P1, deps)).toBe(2);
  });
});

describe("two players", () => {
  /** p1 with two Gadgets; p2 with a Rack holding a restricted Rifle, and one more Gadget. */
  function table() {
    const { state, ids } = start([GADGET.id, GADGET.id], 2);
    const rack = playerCardIntoPlay(state, RACK.id, P2);
    const rifle = playerCardIntoPlay(rack.state, RIFLE.id, P2);
    const gadget = playerCardIntoPlay(rifle.state, GADGET.id, P2);
    const seat = mustPlayer(gadget.state, P2);
    // The Rifle sits on the Rack, faceup, under p2's control.
    const attached: GameState = {
      ...gadget.state,
      players: gadget.state.players.map((p) =>
        p.playerId === P2 ? { ...p, playArea: seat.playArea.filter((id) => id !== rifle.id) } : p,
      ),
      instances: {
        ...gadget.state.instances,
        [rifle.id]: { ...mustInstance(gadget.state, rifle.id), attachedTo: rack.id },
        [rack.id]: { ...mustInstance(gadget.state, rack.id), attachments: [rifle.id] },
      },
    };
    return { state: attached, mine: ids, rack: rack.id, rifle: rifle.id, theirs: gadget.id };
  }

  it("do not share a limit: two restricted cards each is four in play and nobody is asked", () => {
    const t = table();
    expect(restrictedLoadOf(t.state, P1, deps)).toBe(2);
    expect(restrictedLoadOf(t.state, P2, deps)).toBe(2);
    const played = play(t.state, CLUB.id);
    expect(played.state.pendingChoice).toBeNull();
    expect(restrictedCardsOf(played.state, P2, deps)).toHaveLength(2);
  });

  it("a third restricted card for p1 offers only p1's cards, and p2's are untouched", () => {
    const t = table();
    const played = play(t.state, RIFLE.id);
    expect(played.state.pendingChoice?.playerId).toBe(P1);
    expect(offered(played.state)).toEqual(sorted([...t.mine, played.id]));
    const after = resolvePending(played.state, [played.id], deps);
    expect(restrictedOf(after, P1)).toEqual(sorted(t.mine));
    expect(restrictedOf(after, P2)).toEqual(sorted([t.rifle, t.theirs]));
  });

  it("taking control of a restricted card already in play enforces the taker's limit", () => {
    const t = table();
    const seized = play(t.state, SEIZE.card.id);
    expect(controllerOf(seized.state, t.rifle)).toBe(P1);
    expect(seized.events.filter((e) => e.type === "controllerChanged")).toEqual([
      { type: "controllerChanged", instanceId: t.rifle, from: P2, to: P1, reason: "effect" },
    ]);
    // It never left or entered play, so no enter-play check ran: the standing rule asks.
    const choice = seized.state.pendingChoice;
    expect(choice?.playerId).toBe(P1);
    expect(choice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
    expect(offered(seized.state)).toEqual(sorted([...t.mine, t.rifle]));
    expect([choice?.minSelections, choice?.maxSelections]).toEqual([1, 1]);

    const after = resolvePending(seized.state, [t.mine[0] as string], deps);
    expect(restrictedOf(after, P1)).toEqual(sorted([t.mine[1], t.rifle]));
    expect(restrictedOf(after, P2)).toEqual(sorted([t.theirs]));
    expect(after.pendingChoice).toBeNull();
  });
});

describe("replay", () => {
  it("a game with the discard choice replays to the same state from its log", () => {
    const { state, ids } = start([GADGET.id, GADGET.id]);
    const given = giveCard(state, P1, RIFLE.id);
    // Not the default answer: the second card offered.
    const pick = (s: GameState): readonly string[] =>
      s.pendingChoice?.prompt.kind === "discardRestricted" ? [ids[1] as string] : defaultPick(s);
    const { session, events } = driveSession(startSession(given.state), deps, [playOf(given.id)], pick);
    expect(restrictedOf(session.state)).toEqual(sorted([ids[0], given.id]));
    expect(session.log.commands.filter((command) => command.type === "resolveChoice")).toHaveLength(1);

    const replayed = replay(session.log, deps);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.state).toEqual(session.state);
    expect(replayed.events).toEqual(events);
    const again = replay(session.log, deps);
    expect(again.ok && again.state).toEqual(session.state);
  });
});
