/**
 * docs/phase7-wave11.md §3.2: `EffectSpec playFromHand.from { separateDeck, position }`, proven with a synthetic
 * "Sightless" identity shaped like Daredevil (a fixed-order Sense deck of upgrades that attach to an enemy or a scheme)
 * who also brings a Gadget deck without `fixedOrder` as the control.
 *
 * Sources: 60001a "Action: Play the top card of the Sense deck as if it were in your hand (paying its cost)."; 60009 and
 * 60018 "choose any upgrade from the Sense deck and play it, ignoring its resource cost. (Do not shuffle.)"; RRG 1.8
 * "Play, Put Into Play" (p. 32: a play, so cost and play restrictions apply and it counts as played); "Initiating
 * Abilities" (p. 24, steps 2–3: an ability that plays a named card checks that it can be played and paid for); "Search"
 * (p. 39: a searched deck is shuffled afterwards) and "Target" (p. 43: a search needs only a searchable area); MC60
 * p. 26 ("you cannot change the order", §3.1).
 */

import type { AnyCard, CardId, HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer, separateDeckOf } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubIdentity, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  defaultPick,
  giveCard,
  MAIN_SCHEME,
  RESOURCE,
  VILLAIN,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const SENSE = "Sense";
const GADGET = "Gadget";
const you = { kind: "controller" } as const;

/** Cost-1 upgrades of a separate deck: "Attach to an enemy or scheme." (Acute Tactility 60002). */
const deckCards = (deck: string, names: readonly string[]): readonly AnyCard[] =>
  names.map((name) => ({
    ...stubUpgrade({ id: `${deck}-${name}`, cost: 1 }),
    deckLimit: 0,
    separateDeck: deck,
    attachesTo: { kind: "anyOf", hosts: [{ kind: "enemy" }, { kind: "scheme" }] },
  }));
const SENSES = deckCards(SENSE, ["a", "b", "c", "d", "e"]);
const GADGETS = deckCards(GADGET, ["w", "x", "y", "z"]);

/** "Play the top card of the Sense deck as if it were in your hand (paying its cost)." (60001a). */
const PLAY_TOP = stubAbility("sightless.senses", {
  trigger: { kind: "action" },
  effects: [{ kind: "playFromHand", player: you, from: { separateDeck: SENSE, position: "top", asIfInHand: true } }],
});
/** "You may choose any upgrade from the deck and play it, ignoring its resource cost." (60009, 60018). */
const anyUpgrade = (deck: string): readonly EffectSpec[] => [
  {
    kind: "playFromHand",
    player: you,
    from: { separateDeck: deck, position: "any" },
    ignoreCost: true,
    filter: { categories: ["upgrade"] },
    optional: true,
  },
];
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }) };
};
const ANY_SENSE = event("any-sense", anyUpgrade(SENSE));
const ANY_GADGET = event("any-gadget", anyUpgrade(GADGET));
/** The top card of a deck without `fixedOrder`, ignoring its cost: no search, so no shuffle. */
const TOP_GADGET = event("top-gadget", [
  { kind: "playFromHand", player: you, from: { separateDeck: GADGET, position: "top" }, ignoreCost: true },
]);
const EVENTS = [ANY_SENSE, ANY_GADGET, TOP_GADGET];

const SIGHTLESS: HeroIdentityCard = {
  ...stubIdentity({
    id: "sightless",
    hp: 10,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    heroAbilities: [PLAY_TOP.ref],
    alterEgoAbilities: [PLAY_TOP.ref],
  }),
  separateDecks: [
    {
      name: SENSE,
      cards: SENSES.map((card) => ({ cardId: card.id, quantity: 1 })),
      topCardFaceup: true,
      discardPile: "none",
      whenEmpty: "stayEmpty",
      fixedOrder: true,
      ownerMayLookThrough: true,
    },
    {
      name: GADGET,
      cards: GADGETS.map((card) => ({ cardId: card.id, quantity: 1 })),
      topCardFaceup: false,
      discardPile: "none",
      whenEmpty: "stayEmpty",
    },
  ],
};

const BLANK = stubTreachery({ id: "blank-separate-play", boostIcons: 0 });
const deps: EngineDeps = depsOf(PLAY_TOP, ...EVENTS.map((e) => e.ability));

function started(): GameState {
  const result = createGame(
    {
      seed: 47,
      cards: [...DEFAULT_CARDS, SIGHTLESS, ...SENSES, ...GADGETS, ...EVENTS.map((e) => e.card), BLANK],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: Array.from({ length: 12 }, (): CardId => BLANK.id),
      players: [{ identityCardId: SIGHTLESS.id, deck: [...DEFAULT_DECK, ...EVENTS.map((e) => e.card.id)] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const sense = (state: GameState) => separateDeckOf(state, p1, SENSE).deck;
const gadget = (state: GameState) => separateDeckOf(state, p1, GADGET).deck;
const villainOf = (state: GameState) =>
  Object.values(state.instances).find((i) => i.cardId === VILLAIN.id)!.instanceId as InstanceId;
const shuffled = (name: string) => (e: GameEvent) =>
  e.type === "deckShuffled" && e.zone.kind === "separateDeck" && e.zone.name === name;
const plays = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "cardPlayed"
      ? [{ instanceId: e.instanceId, paid: e.resourcesPaid, from: e.from, countsAsFrom: e.countsAsFrom }]
      : [],
  );

/**
 * Answers: the `wanted` card at a card choice, the `host` at a host choice, the first payment option, else the default.
 */
const picker =
  (wanted: InstanceId | undefined, host: (state: GameState) => InstanceId) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    const option = (id: InstanceId) =>
      choice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === id)?.optionId;
    if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === "playFromHand" && wanted) {
      const picked = option(wanted);
      if (picked) return [picked];
    }
    if (choice?.prompt.kind === "chooseTarget" && choice.prompt.slot === "playFromHandHost") {
      const picked = option(host(state));
      if (picked) return [picked];
    }
    if (choice?.prompt.kind === "spendResources" && choice.options[0]) return [choice.options[0].optionId];
    return defaultPick(state);
  };

/** Only the given cards in p1's hand (test surgery). */
const handOnly = (state: GameState, ids: readonly InstanceId[]): GameState => ({
  ...state,
  players: state.players.map((p) => (p.playerId === p1 ? { ...p, hand: ids } : p)),
});

const useTop = (state: GameState): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: mustPlayer(state, p1).identity.instanceId,
  abilityId: PLAY_TOP.ref.id,
  payment: [],
});

function playEvent(start: GameState, fx: (typeof EVENTS)[number], wanted: InstanceId | undefined, host = villainOf) {
  const given = giveCard(start, p1, fx.card.id);
  const command: Command = {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  return runCommandsPicking(given.state, deps, picker(wanted, host), command);
}

describe("§3.2 play a card from a separate deck", () => {
  it("'top', paying its cost: the top card goes onto the enemy for 1 resource and the next card is the top, faceup", () => {
    const resource = giveCard(started(), p1, RESOURCE.id);
    const start = handOnly(resource.state, [resource.id]);
    const before = sense(start);
    const top = before[0] as InstanceId;
    const { state, events } = runCommandsPicking(start, deps, picker(undefined, villainOf), useTop(start));
    expect(mustInstance(state, villainOf(state)).attachments).toContain(top);
    expect(mustPlayer(state, p1).discard).toContain(resource.id);
    expect(sense(state)).toEqual(before.slice(1));
    expect(mustInstance(state, sense(state)[0]!).faceup).toBe(true);
    // A play (RRG 1.8 p. 32), logged as from the separate deck and, "as if it were in your hand" (`asIfInHand`), as
    // played from the hand (RRG 1.8 FAQ "Magik (#30A)", p. 64). Playing the top card is no search, so no shuffle.
    expect(plays(events)).toEqual([{ instanceId: top, paid: 1, from: "separateDeck", countsAsFrom: "hand" }]);
    expect(events.some(shuffled(SENSE))).toBe(false);
  });

  it("'top' with no resource to pay: the ability is not offered (RRG 1.8 'Initiating Abilities', p. 24)", () => {
    const start = handOnly(started(), []);
    const result = applyCommand(start, useTop(start), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
    expect(sense(start)).toHaveLength(5);
  });

  it("'any', ignoring its cost: the fourth card goes where the player chooses for 0, and the rest keep their order", () => {
    const start = started();
    const before = sense(start);
    const fourth = before[3] as InstanceId;
    const { state, events } = playEvent(start, ANY_SENSE, fourth, (s) => s.mainScheme.instanceId);
    expect(mustInstance(state, state.mainScheme.instanceId).attachments).toContain(fourth);
    // Deposition's "play it" has no "as if it were in your hand": not counted as from the hand.
    expect(plays(events)).toContainEqual({
      instanceId: fourth,
      paid: 0,
      from: "separateDeck",
      countsAsFrom: undefined,
    });
    // A fixed-order deck is searched without a shuffle (§3.1: "(Do not shuffle.)").
    expect(sense(state)).toEqual(before.filter((id) => id !== fourth));
    expect(events.some(shuffled(SENSE))).toBe(false);
  });

  it("'any' from a deck without fixed order is a search: shuffled once the play is done (RRG 1.8 'Search', p. 39)", () => {
    const start = started();
    const wanted = gadget(start)[2] as InstanceId;
    const { state, events } = playEvent(start, ANY_GADGET, wanted);
    expect(mustInstance(state, villainOf(state)).attachments).toContain(wanted);
    const after = events.filter(shuffled(GADGET));
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ order: gadget(state) });
    const playedAt = events.findIndex((e) => e.type === "cardPlayed" && e.instanceId === wanted);
    expect(events.findIndex(shuffled(GADGET))).toBeGreaterThan(playedAt);
  });

  it("'top' from a deck without fixed order plays its top card and does not shuffle it (RRG 1.8 'Search', p. 39)", () => {
    const start = started();
    const before = gadget(start);
    const { state, events } = playEvent(start, TOP_GADGET, undefined);
    expect(mustInstance(state, villainOf(state)).attachments).toContain(before[0]);
    expect(gadget(state)).toEqual(before.slice(1));
    expect(events.some(shuffled(GADGET))).toBe(false);
  });

  it("an optional 'any' play declined plays nothing; a fixed-order deck keeps its order, another is still shuffled", () => {
    const start = started();
    const fixed = playEvent(start, ANY_SENSE, undefined);
    expect(plays(fixed.events).filter((p) => p.from === "separateDeck")).toEqual([]);
    expect(sense(fixed.state)).toEqual(sense(start));
    expect(fixed.events.some(shuffled(SENSE))).toBe(false);
    // The search happened even though nothing was played (RRG 1.8 "Search", p. 39), as for `from: "deck"`.
    const other = playEvent(start, ANY_GADGET, undefined);
    expect(plays(other.events).filter((p) => p.from === "separateDeck")).toEqual([]);
    expect(gadget(other.state)).toHaveLength(4);
    expect(other.events.filter(shuffled(GADGET))).toHaveLength(1);
  });
});
