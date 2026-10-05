/**
 * docs/phase7-wave7.md §3.43 item 1: a player side scheme put into play by an effect enters play as a played one does.
 * Synthetic cards: a 2-cost mission with "3 per player" starting threat, a unique one, one with Hinder 1, one nobody
 * owns (in the encounter deck, as a scenario's own card is), events reading "put [it] into play" from each zone, and a
 * support with "Forced Response: After you play a side scheme, take 1 damage" (the marker for a play).
 *
 * Sources: RRG 1.8 "Player Side Scheme" (p. 34): "When a player side scheme enters play, it is placed next to the main
 * scheme in the villain's play area", "enters play with an amount of threat on it equal to its starting threat value";
 * "Play, Put into Play" (p. 32): a card put into play pays no cost and is not played; "Unique Icon" (p. 45): an effect that
 * would bring a second copy into play has no effect; "Hinder X" (p. 22). §4.1 Q24: one the scenario put into play is
 * controlled by nobody.
 */

import { flat, perPlayerOnly, type AnyCard, type PlayerSideSchemeCard, type ScalingValue } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { CardSelector, EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const you = { kind: "controller" } as const;

function playerSideScheme(spec: {
  readonly id: string;
  readonly cost: number;
  readonly startingThreat: ScalingValue;
  readonly extra?: Partial<PlayerSideSchemeCard>;
}): PlayerSideSchemeCard {
  return {
    ...stubSupport({ id: spec.id, cost: spec.cost }),
    type: "player_side_scheme",
    startingThreat: spec.startingThreat,
    ...spec.extra,
  };
}

/** "3 per player" starting threat, cost 2. */
const MISSION = playerSideScheme({ id: "mission", cost: 2, startingThreat: perPlayerOnly(3) });
const BEACON = playerSideScheme({ id: "beacon", cost: 0, startingThreat: flat(1), extra: { unique: true } });
const SNARE = playerSideScheme({
  id: "snare",
  cost: 0,
  startingThreat: flat(2),
  extra: { keywords: [{ name: "hinder", value: 1 }] },
});
/** Nobody's deck holds it: it starts in the encounter deck, with no owner. */
const ORPHAN = playerSideScheme({ id: "orphan", cost: 0, startingThreat: perPlayerOnly(4) });

/** "Put [the cards `from` names] into play." */
const putIntoPlayEvent = (id: string, from: CardSelector) => {
  const effects: readonly EffectSpec[] = [
    { kind: "selectCards", slot: "found", cards: from },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: you },
  ];
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects: [...effects] });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const ZONES = ["hand", "deck", "discard", "setAside"] as const;
type Zone = (typeof ZONES)[number];
const fromZone = (zone: Zone, name: string, player: "you" | "other" = "you"): CardSelector => {
  const of = player === "you" ? you : ({ kind: "others", of: you } as const);
  return zone === "setAside"
    ? { kind: "setAside", player: of, filter: { name } }
    : { kind: "zone", zone, player: of, filter: { name } };
};
const MISSION_FROM = {
  hand: putIntoPlayEvent("mission-from-hand", fromZone("hand", MISSION.name)),
  deck: putIntoPlayEvent("mission-from-deck", fromZone("deck", MISSION.name)),
  discard: putIntoPlayEvent("mission-from-discard", fromZone("discard", MISSION.name)),
  setAside: putIntoPlayEvent("mission-from-set-aside", fromZone("setAside", MISSION.name)),
};
const MISSION_FROM_OTHER = putIntoPlayEvent("mission-from-other", fromZone("discard", MISSION.name, "other"));
const BEACON_FROM_HAND = putIntoPlayEvent("beacon-from-hand", fromZone("hand", BEACON.name));
const SNARE_FROM_HAND = putIntoPlayEvent("snare-from-hand", fromZone("hand", SNARE.name));
const ORPHAN_FROM_ENCOUNTER = putIntoPlayEvent("orphan-from-encounter", {
  kind: "encounter",
  zones: ["deck"],
  filter: { name: ORPHAN.name },
});
const EVENTS = [
  ...Object.values(MISSION_FROM),
  MISSION_FROM_OTHER,
  BEACON_FROM_HAND,
  SNARE_FROM_HAND,
  ORPHAN_FROM_ENCOUNTER,
];

/** "Forced Response: After you play a side scheme, take 1 damage." */
const WATCHER_PLAYED = stubAbility(
  "watcher.forced-response",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "cardPlayed", playerIs: "controller", targetIs: { categories: ["sideScheme"] } },
    },
    effects: [{ kind: "dealDamage", target: { kind: "identityOf", player: you }, amount: { kind: "const", value: 1 } }],
  }),
);
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [WATCHER_PLAYED.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(WATCHER_PLAYED, ...EVENTS.map((e) => e.ability));
const PLAYER_CARDS: readonly AnyCard[] = [MISSION, BEACON, BEACON, SNARE, WATCHER, ...EVENTS.map((e) => e.card)];

/** Each player in hero form at the first player's first turn. */
function start(players: 1 | 2 = 2): GameState {
  const base = gameAtFirstTurn({
    players,
    cards: [...new Set(PLAYER_CARDS), ORPHAN, FILLER],
    deps,
    deck: PLAYER_CARDS.map((card) => card.id),
    encounter: [ORPHAN.id, ...copiesOf(FILLER.id, 30)],
  });
  return {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
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
const playCommand = (player: PlayerId, id: InstanceId): Command => ({
  type: "playCard",
  playerId: player,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
/** `player` plays `card` from hand for 0; the step's `id` is the played card. */
function play(state: GameState, card: AnyCard, player: PlayerId = P1): Step & { readonly id: InstanceId } {
  const given = giveCard(state, player, card.id);
  return { ...run(given.state, playCommand(player, given.id)), id: given.id };
}
/** One of `player`'s copies of `card`, moved to `zone` from wherever it was out of play. */
function inZone(state: GameState, player: PlayerId, card: AnyCard, zone: Zone): { state: GameState; id: InstanceId } {
  const given = giveCard(state, player, card.id);
  const without = (ids: readonly InstanceId[]) => ids.filter((id) => id !== given.id);
  return {
    id: given.id,
    state: {
      ...given.state,
      players: given.state.players.map((p) => {
        if (p.playerId !== player) return p;
        const cleared = { ...p, hand: without(p.hand), deck: without(p.deck), discard: without(p.discard) };
        return { ...cleared, [zone]: [given.id, ...cleared[zone]] };
      }),
    },
  };
}
const threat = (state: GameState, id: InstanceId) => mustInstance(state, id).threat;
const heroDamage = (state: GameState, player: PlayerId) =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).damage;
const threatPlacedOn = (events: readonly GameEvent[], id: InstanceId) =>
  events.filter((event) => event.type === "threatPlaced" && event.schemeInstanceId === id);
const outOfPlayZonesOf = (state: GameState, player: PlayerId) => {
  const seat = mustPlayer(state, player);
  return [...seat.hand, ...seat.deck, ...seat.discard, ...seat.setAside, ...seat.playArea];
};

describe("a player side scheme put into play by an effect (RRG 1.8 p. 34)", () => {
  it.each(ZONES)("from your %s: the villain's play area, your control, its per-player starting threat", (zone) => {
    const placed = inZone(start(), P1, MISSION, zone);
    const after = play(placed.state, MISSION_FROM[zone].card);
    expect(after.state.villainArea).toContain(placed.id);
    expect(outOfPlayZonesOf(after.state, P1)).not.toContain(placed.id);
    const scheme = mustInstance(after.state, placed.id);
    expect(scheme.controllerId).toBe(P1);
    expect(scheme.ownerId).toBe(P1);
    expect(scheme.faceup).toBe(true);
    // "3 per player" with two players, in one placement that no card is the source of.
    expect(scheme.threat).toBe(6);
    expect(threatPlacedOn(after.events, placed.id)).toEqual([
      expect.objectContaining({ amount: 6, sourceInstanceId: null }),
    ]);
  });

  it("in a one-player game the per-player starting threat is counted once, put into play or played", () => {
    const placed = inZone(start(1), P1, MISSION, "discard");
    const put = play(placed.state, MISSION_FROM.discard.card);
    expect(threat(put.state, placed.id)).toBe(3);
    const played = play(start(1), BEACON);
    expect(threat(played.state, played.id)).toBe(1);
  });

  it("is controlled by the player the effect names, and stays its owner's card", () => {
    const placed = inZone(start(), P2, MISSION, "discard");
    const after = play(placed.state, MISSION_FROM_OTHER.card);
    expect(after.state.villainArea).toContain(placed.id);
    expect(mustInstance(after.state, placed.id).controllerId).toBe(P1);
    expect(mustInstance(after.state, placed.id).ownerId).toBe(P2);
    expect(threat(after.state, placed.id)).toBe(6);
  });

  it("Hinder 1 is added to the starting threat in the same placement, put into play or played", () => {
    const placed = inZone(start(), P1, SNARE, "hand");
    const put = play(placed.state, SNARE_FROM_HAND.card);
    expect(threatPlacedOn(put.events, placed.id)).toEqual([expect.objectContaining({ amount: 3 })]);
    expect(threat(put.state, placed.id)).toBe(3);
    const played = play(start(), SNARE);
    expect(threatPlacedOn(played.events, played.id)).toEqual([expect.objectContaining({ amount: 3 })]);
    expect(threat(played.state, played.id)).toBe(3);
  });
});

describe("putting a player side scheme into play is not playing it (RRG 1.8 'Play, Put into Play')", () => {
  it("its cost is not paid: a 2-cost one enters play with nothing spent, where playing it for nothing is refused", () => {
    const placed = inZone(start(), P1, MISSION, "hand");
    const refused = sessionApply(startSession(placed.state), playCommand(P1, placed.id), deps);
    expect(refused.ok).toBe(false);
    const given = giveCard(placed.state, P1, MISSION_FROM.hand.card.id);
    const after = run(given.state, playCommand(P1, given.id));
    expect(after.state.villainArea).toContain(placed.id);
    // Only the event and the scheme left the hand.
    const handBefore = mustPlayer(given.state, P1).hand;
    expect(mustPlayer(after.state, P1).hand).toEqual(handBefore.filter((id) => id !== given.id && id !== placed.id));
    expect(after.events.some((event) => event.type === "cardPlayed" && event.instanceId === placed.id)).toBe(false);
  });

  it("'after you play a side scheme' answers a play and not a put into play", () => {
    const watched = playerCardIntoPlay(start(), WATCHER.id, P1).state;
    const placed = inZone(watched, P1, BEACON, "hand");
    const put = play(placed.state, BEACON_FROM_HAND.card);
    expect(put.state.villainArea).toContain(placed.id);
    expect(heroDamage(put.state, P1)).toBe(0);
    const played = run(placed.state, playCommand(P1, placed.id));
    expect(played.state.villainArea).toContain(placed.id);
    expect(heroDamage(played.state, P1)).toBe(1);
  });
});

describe("the unique rule (RRG 1.8 'Unique Icon', p. 45)", () => {
  it("a second copy an effect would put into play stays where it was", () => {
    const first = play(start(), BEACON);
    const second = giveCard(first.state, P1, BEACON.id, [first.id]);
    const after = play(second.state, BEACON_FROM_HAND.card);
    expect(after.state.villainArea).toContain(first.id);
    expect(after.state.villainArea).not.toContain(second.id);
    expect(mustPlayer(after.state, P1).hand).toContain(second.id);
    expect(threat(after.state, second.id)).toBe(0);
    expect(after.events).toContainEqual(
      expect.objectContaining({ type: "uniqueEntryBlocked", instanceId: second.id, disposition: "noEffect" }),
    );
  });
});

describe("§4.1 Q24: a player side scheme nobody owns, put into play by the scenario", () => {
  it("enters the villain's play area with its starting threat, controlled by no player", () => {
    const before = start();
    const after = play(before, ORPHAN_FROM_ENCOUNTER.card);
    const id = after.state.villainArea.find((card) => mustInstance(after.state, card).cardId === ORPHAN.id);
    expect(id).toBeDefined();
    const scheme = mustInstance(after.state, id as InstanceId);
    expect(scheme.controllerId).toBeNull();
    expect(scheme.ownerId).toBeNull();
    // "4 per player" with two players.
    expect(scheme.threat).toBe(8);
    for (const player of [P1, P2]) expect(mustPlayer(after.state, player).playArea).not.toContain(id);
  });
});
