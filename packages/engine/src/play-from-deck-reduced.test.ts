/**
 * docs/phase7-wave9.md §3.37: a card searched for in the deck and played at a reduced cost (`EffectSpec playFromHand
 * { from: "deck", costReduction }`). Synthetic cards shaped like Shuri's Inventor (`bp` 51001b): "Action: Exhaust
 * [this card] → search your deck for a [Gizmo] upgrade and play it, reducing its resource cost by 2. (Limit once per
 * round.)"
 *
 * Sources: RRG 1.8 "Search" (p. 39): the player looks at each card of the searched area, and "if any portion of a deck
 * is searched, upon completion of that game step, game function, or card ability, shuffle that entire deck"; "Target"
 * (p. 43): "An ability with a search effect requires only a searchable game area in order to initiate"; "Initiating
 * Abilities" (p. 24), steps 3 and 5: a card whose cost cannot be paid is not played; "Play, Put Into Play" (p. 32).
 */

import { trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const GIZMO = trait("GIZMO");

const INVENT_ACTION = stubAbility("workshop.action", {
  trigger: { kind: "action" },
  cost: { exhaustSelf: true },
  limit: { count: 1, period: "round" },
  effects: [
    {
      kind: "playFromHand",
      player: { kind: "controller" },
      from: "deck",
      costReduction: { kind: "const", value: 2 },
      filter: { categories: ["upgrade"], trait: GIZMO },
    },
  ],
});
const WORKSHOP = stubSupport({ id: "workshop", cost: 0, abilities: [INVENT_ACTION.ref] });
/** Counts each card its controller plays after it is in play: proof the searched card was *played*. */
const TALLY_RESPONSE = stubAbility("tally.response", {
  trigger: { kind: "response", forced: true, on: { on: "cardPlayed", playerIs: "controller" } },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "played", amount: { kind: "const", value: 1 } },
  ],
});
const TALLY = stubSupport({ id: "tally", cost: 0, abilities: [TALLY_RESPONSE.ref] });
const BEADS = stubUpgrade({ id: "beads", cost: 2, traits: [GIZMO] });
const RIFLE = stubUpgrade({ id: "rifle", cost: 3, traits: [GIZMO] });
/** An upgrade the filter does not match. */
const TRINKET = stubUpgrade({ id: "trinket", cost: 0 });
/** A card worth 1 resource in hand. */
const FUEL = stubEvent({ id: "fuel", cost: 0, resources: 1 });

const deps: EngineDeps = depsOf(INVENT_ACTION, TALLY_RESPONSE);
const CARDS = [WORKSHOP, TALLY, BEADS, RIFLE, TRINKET, FUEL];

/** The workshop and the tally in play, exactly `fuel` Fuel cards in hand, and a deck of the rest plus `inDeck`. */
function start(fuel: number, inDeck: readonly (typeof BEADS)[]) {
  const deck: readonly CardId[] = [
    ...copiesOf(WORKSHOP.id, 1),
    ...copiesOf(TALLY.id, 1),
    ...copiesOf(TRINKET.id, 2),
    ...copiesOf(FUEL.id, 8),
    ...inDeck.map((card) => card.id),
  ];
  const base = gameAtFirstTurn({ cards: CARDS, deps, deck });
  const workshop = playerCardIntoPlay(base, WORKSHOP.id);
  const tally = playerCardIntoPlay(workshop.state, TALLY.id);
  const owner = mustPlayer(tally.state, P1);
  const all = [...owner.hand, ...owner.deck];
  const isFuel = (id: InstanceId) => mustInstance(tally.state, id).cardId === FUEL.id;
  const hand = all.filter(isFuel).slice(0, fuel);
  const state: GameState = {
    ...tally.state,
    players: tally.state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand, deck: all.filter((id) => !hand.includes(id)) } : p,
    ),
  };
  return { state, workshop: workshop.id, tally: tally.id };
}

const invent = (workshop: InstanceId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: workshop,
  abilityId: INVENT_ACTION.ref.id,
  payment: [],
});

interface Seen {
  /** The card ids offered by each search prompt. */
  readonly offered: string[][];
  /** The generic resources each payment prompt asked for, and how many payment options it gave. */
  readonly asked: { generic: number; options: number }[];
}
/** Uses the workshop, picking `want` from the search and paying with the first `pay` options (default: what is asked). */
function run(t: ReturnType<typeof start>, want: string | null, pay?: number) {
  const seen: Seen = { offered: [], asked: [] };
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === "playFromHand") {
      seen.offered.push(choice.options.map((o) => String(mustInstance(state, o.optionId as InstanceId).cardId)));
      const option = choice.options.find((o) => mustInstance(state, o.optionId as InstanceId).cardId === want);
      return option ? [option.optionId] : defaultPick(state);
    }
    if (choice?.prompt.kind === "spendResources") {
      const generic = choice.prompt.requirement.generic;
      seen.asked.push({ generic, options: choice.options.length });
      return choice.options.slice(0, pay ?? generic).map((o) => o.optionId);
    }
    return defaultPick(state);
  };
  const { session, events } = driveSession(startSession(t.state), deps, [invent(t.workshop)], pick);
  return { state: session.state, events, seen };
}

const codes = (state: GameState, ids: readonly InstanceId[]) => ids.map((id) => String(mustInstance(state, id).cardId));
const shuffles = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "deckShuffled" && e.zone.kind === "deck" && e.zone.playerId === P1);
const played = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "cardPlayed" ? [{ card: String(e.cardId), paid: e.resourcesPaid }] : []));
const attachedToIdentity = (state: GameState) =>
  codes(state, mustInstance(state, mustPlayer(state, P1).identity.instanceId).attachments);

describe("§3.37 a card searched for in the deck and played at a reduced cost", () => {
  it("a cost-2 upgrade is played for 0: nothing is asked for, no card leaves the hand, and it counts as played", () => {
    const t = start(3, [BEADS, RIFLE]);
    const { state, events, seen } = run(t, BEADS.id);
    // The whole deck is searched; only what the filter matches and the player can pay for is offered.
    expect(seen.offered.map((cards) => [...cards].sort())).toEqual([[BEADS.id, RIFLE.id]]);
    expect(seen.asked).toEqual([]);
    expect(played(events)).toEqual([{ card: BEADS.id, paid: 0 }]);
    expect(attachedToIdentity(state)).toEqual([BEADS.id]);
    expect(mustPlayer(state, P1).hand).toHaveLength(3);
    expect(codes(state, mustPlayer(state, P1).deck)).not.toContain(BEADS.id);
    expect(mustInstance(state, t.workshop).exhausted).toBe(true);
    expect(mustInstance(state, t.tally).counters["played"]).toBe(1);
  });

  it("the deck is shuffled once, after the played card has entered play", () => {
    const t = start(3, [BEADS, RIFLE]);
    const { events } = run(t, BEADS.id);
    expect(shuffles(events)).toHaveLength(1);
    const entered = events.findIndex((e) => e.type === "cardPlayed");
    expect(events.indexOf(shuffles(events)[0]!)).toBeGreaterThan(entered);
  });

  it("a cost-3 upgrade with one card in hand: 1 resource is asked for and paid, the hand is empty", () => {
    const t = start(1, [RIFLE]);
    const { state, events, seen } = run(t, RIFLE.id);
    expect(seen.offered).toEqual([[RIFLE.id]]);
    expect(seen.asked).toEqual([{ generic: 1, options: 1 }]);
    expect(played(events)).toEqual([{ card: RIFLE.id, paid: 1 }]);
    expect(attachedToIdentity(state)).toEqual([RIFLE.id]);
    expect(mustPlayer(state, P1).hand).toEqual([]);
    expect(shuffles(events)).toHaveLength(1);
  });

  it("a cost-3 upgrade with an empty hand cannot be paid for: it is not offered, the cost is still paid and the deck shuffled", () => {
    const t = start(0, [RIFLE]);
    // RRG 1.8 "Target" (p. 43): a search needs only a searchable area to initiate.
    const legal = legalActions(t.state, P1, deps);
    if (legal.kind !== "turn") throw new Error(legal.kind);
    expect(legal.legal.some((a) => a.action.kind === "useAbility" && a.action.instanceId === t.workshop)).toBe(true);
    const { state, events, seen } = run(t, RIFLE.id);
    expect(seen).toEqual({ offered: [], asked: [] });
    expect(played(events)).toEqual([]);
    expect(mustInstance(state, t.workshop).exhausted).toBe(true);
    expect(codes(state, mustPlayer(state, P1).deck)).toContain(RIFLE.id);
    expect(shuffles(events)).toHaveLength(1);
  });

  it("with an empty hand only the upgrade the reduction makes free is offered", () => {
    const t = start(0, [BEADS, RIFLE]);
    const { events, seen } = run(t, RIFLE.id);
    expect(seen.offered).toEqual([[BEADS.id]]);
    expect(played(events)).toEqual([{ card: BEADS.id, paid: 0 }]);
  });

  it("nothing the filter matches in the deck: nothing is offered or played, and the deck is shuffled once", () => {
    const t = start(3, []);
    const { state, events, seen } = run(t, null);
    expect(seen).toEqual({ offered: [], asked: [] });
    expect(played(events)).toEqual([]);
    expect(mustInstance(state, t.workshop).exhausted).toBe(true);
    expect(shuffles(events)).toHaveLength(1);
  });

  it("a payment that does not cover the reduced cost plays nothing: the card stays in the deck, which is shuffled (p. 24, step 5)", () => {
    const t = start(2, [RIFLE]);
    const { state, events, seen } = run(t, RIFLE.id, 0);
    expect(seen.asked).toEqual([{ generic: 1, options: 2 }]);
    expect(played(events)).toEqual([]);
    expect(mustPlayer(state, P1).hand).toHaveLength(2);
    expect(codes(state, mustPlayer(state, P1).deck)).toContain(RIFLE.id);
    expect(shuffles(events)).toHaveLength(1);
  });

  it("a second use in the round is refused (limit once per round), even with the card readied", () => {
    const t = start(3, [BEADS, RIFLE]);
    const { state } = run(t, BEADS.id);
    const readied: GameState = {
      ...state,
      instances: { ...state.instances, [t.workshop]: { ...mustInstance(state, t.workshop), exhausted: false } },
    };
    const again = applyCommand(readied, invent(t.workshop), deps);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe("limit_reached");
  });
});
