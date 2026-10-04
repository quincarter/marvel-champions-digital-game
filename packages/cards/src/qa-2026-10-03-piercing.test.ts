/**
 * Rules-QA 2026-10-03, change 9 (commit 3c955206): a piercing attack discards the attacked character's tough status
 * cards even when its damage is then prevented, and does so before any "would deal/take damage" interrupt.
 *
 * - RRG 1.8 "Piercing" (p. 32): "An attack with the piercing keyword discards any tough status cards from the attacked
 *   character before dealing damage ... If an attack with the piercing keyword would deal no damage to the attacked
 *   character, it does not discard tough status cards from that character."
 * - Ruling January 17, 2026 (3) #1: "Effects that 'prevent damage' prevent damage taken, not dealt ... an attack with
 *   Piercing that still deals damage to her will remove that Tough status card."
 * - Ruling January 17, 2026 (3) #2: "Piercing triggers when the attack would deal damage (same window as Aerial
 *   Evacuation). However, keywords have timing priority over triggered abilities. Piercing removes the Tough status
 *   card before Aerial Evacuation triggers to prevent damage taken."
 *
 * The engine test (`engine/src/piercing-prevented-damage.test.ts`) is synthetic and the two cards the commit changed
 * tests for are Shadow and Steel and Bulletproof Belle. These are the other real preventing cards: five "would take
 * damage" interrupts (Backflip, Side Step, Cosmic Flight, Defensive Stance, Energy Barrier), Mockingbird's attack-time
 * "prevent all damage from this attack", Flora Colossus's forced interrupt on Groot, and Abjuration's rule on Ebony
 * Maw. The piercing attacker is the villain's boost card (Kree Commando 16132: "If this is an attack, this attack
 * gains piercing"), so the whole path (boost, keyword, interrupt window, damage step) is the real one.
 */
import { cardId } from "@mc/content";
import { activeEncounterDeck, activeVillain, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { endTurn, identityOf, inst, P1, patchInstance } from "./testing/harness.js";
import { conjure, drive, intoPlay, rhino, type Picks } from "./testing/qa-bench.js";
import { encounterCardInVillainArea } from "./testing/staging.js";

/** Top encounter card relabeled to `code` (the villain's boost card is drawn first). */
function boostWith(state: GameState, code: string): GameState {
  const top = activeEncounterDeck(state).deck[0]!;
  return patchInstance(state, top, { cardId: cardId(code) });
}
/** P1's hand is `keep` plus `fillers` other cards, so the end-of-turn discard takes none of the cards under test. */
function trimHand(state: GameState, keep: readonly InstanceId[], fillers: number): GameState {
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.playerId !== P1) return p;
      const rest = p.hand.filter((id) => !keep.includes(id));
      return { ...p, hand: [...keep, ...rest.slice(0, fillers)], deck: [...p.deck, ...rest.slice(fillers)] };
    }),
  };
}
const PIERCING_BOOST = "16132";

interface Setup {
  readonly state: GameState;
  readonly picks: Picks;
}
/** Hero with one tough card, a few tokens on the main scheme (so the phase does not end the game), the card staged. */
function base(): GameState {
  const state = rhino();
  const staged = patchInstance(state, state.mainScheme.instanceId, { threat: 0 });
  const hero = identityOf(staged);
  return patchInstance(staged, hero, { statuses: { ...inst(staged, hero).statuses, tough: 1 } });
}
/** `card` in hand (with `cost` to pay), or in play with counters. */
const inHand = (code: string, cost: number, ability: string): Setup => {
  const given = conjure(boostWith(base(), PIERCING_BOOST), code);
  return { state: trimHand(given.state, [given.id], 3), picks: { use: [ability], pay: cost } };
};
const inPlay = (code: string, ability: string, counters: Readonly<Record<string, number>> = {}): Setup => {
  const placed = intoPlay(boostWith(base(), PIERCING_BOOST), code, counters);
  return { state: trimHand(placed.state, [], 4), picks: { use: [ability], pay: 1 } };
};

/** The first index of an event the predicate matches, or -1. */
const at = (events: readonly GameEvent[], match: (e: GameEvent) => boolean): number => events.findIndex(match);

interface Case {
  readonly name: string;
  readonly setup: () => Setup;
}
const CASES: readonly Case[] = [
  { name: "Backflip (01003): prevent all of that damage", setup: () => inHand("01003", 0, "01003.backflip-interrupt") },
  { name: "Side Step (14015): prevent 3 of that damage", setup: () => inHand("14015", 1, "14015.side-step-interrupt") },
  {
    name: "Cosmic Flight (01017): discard it, prevent 3 of that damage",
    setup: () => inPlay("01017", "01017.cosmic-flight-interrupt"),
  },
  {
    name: "Defensive Stance (08032): discard it, prevent 3 of that damage",
    setup: () => inPlay("08032", "08032.defensive-stance-interrupt"),
  },
  {
    name: "Energy Barrier (05017): remove a reflection counter, prevent 1 of that damage",
    setup: () => inPlay("05017", "05017.energy-barrier-interrupt", { reflection: 3 }),
  },
  {
    name: "Mockingbird (04004): return her to hand, prevent all damage from this attack",
    setup: () => inPlay("04004", "04004.mockingbird-interrupt"),
  },
];

describe("a piercing attack discards the tough card first, whatever then prevents the damage (RRG p. 32; ruling Jan 17, 2026 (3))", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const { state, picks } = c.setup();
      const hero = identityOf(state);
      const done = drive(state, endTurn(P1), picks);
      expect(done.accepted).toBe(true);
      const pierced = at(
        done.events,
        (e) => e.type === "statusRemoved" && e.instanceId === hero && e.status === "tough" && e.reason === "piercing",
      );
      expect(pierced).toBeGreaterThanOrEqual(0);
      // Ruling #2: the keyword resolves ahead of the interrupt, so the prevention card is used after the tough card goes.
      const prevented = at(done.events, (e) => e.type === "damagePrevented" && e.targetInstanceId === hero);
      expect(prevented).toBeGreaterThan(pierced);
      expect(inst(done.state, hero).statuses.tough).toBe(0);
    });
  }
});

describe("Flora Colossus (16001a), Groot's forced interrupt: remove growth counters, prevent that much damage", () => {
  it("a piercing attack discards Groot's tough card before the counters prevent the damage", () => {
    const start = rhino(1, "groot-protection");
    const groot = identityOf(start);
    const staged = patchInstance(patchInstance(start, start.mainScheme.instanceId, { threat: 0 }), groot, {
      statuses: { ...inst(start, groot).statuses, tough: 1 },
      counters: { growth: 3 },
    });
    const state = trimHand(boostWith(staged, PIERCING_BOOST), [], 4);
    const done = drive(state, endTurn(P1), {});
    expect(done.accepted).toBe(true);
    const pierced = at(
      done.events,
      (e) => e.type === "statusRemoved" && e.instanceId === groot && e.status === "tough" && e.reason === "piercing",
    );
    expect(pierced).toBeGreaterThanOrEqual(0);
    const prevented = at(done.events, (e) => e.type === "damagePrevented" && e.targetInstanceId === groot);
    expect(prevented).toBeGreaterThan(pierced);
    expect(inst(done.state, groot).statuses.tough).toBe(0);
  });
});

describe("Abjuration (21082), 'Prevent all damage to Ebony Maw'", () => {
  it("a piercing attack on Ebony Maw discards his tough card; Abjuration then prevents the damage", () => {
    const start = rhino(10, "core-spider-man-justice", "ebony-maw");
    const maw = activeVillain(start).instanceId;
    const placed = encounterCardInVillainArea(start, "21082");
    const attached: GameState = {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...placed.state.instances[placed.id]!, attachedTo: maw, controllerId: null },
        [maw]: {
          ...placed.state.instances[maw]!,
          attachments: [...placed.state.instances[maw]!.attachments, placed.id],
          statuses: { ...placed.state.instances[maw]!.statuses, tough: 1 },
        },
      },
    };
    // Spider-Man's own basic attack gains piercing (an identity keyword, test surgery on this game's card pool).
    const hero = identityOf(attached);
    const printed = attached.instances[hero]!.cardId;
    const card = attached.cardPool[printed]!;
    if (card.type !== "hero_identity") throw new Error("not an identity");
    const piercer: GameState = {
      ...attached,
      cardPool: {
        ...attached.cardPool,
        [printed]: { ...card, hero: { ...card.hero, keywords: [...(card.hero.keywords ?? []), { name: "piercing" }] } },
      },
    };
    const done = drive(piercer, { type: "basicAttack", playerId: P1, attackerInstanceId: hero, targetInstanceId: maw });
    expect(done.accepted).toBe(true);
    const pierced = at(
      done.events,
      (e) => e.type === "statusRemoved" && e.instanceId === maw && e.status === "tough" && e.reason === "piercing",
    );
    expect(pierced).toBeGreaterThanOrEqual(0);
    const prevented = at(done.events, (e) => e.type === "damagePrevented" && e.targetInstanceId === maw);
    expect(prevented).toBeGreaterThan(pierced);
    expect(inst(done.state, maw).statuses.tough).toBe(0);
    expect(inst(done.state, maw).damage).toBe(0);
  });
});
