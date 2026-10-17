/**
 * "Forced Response: After any number of cards are discarded from the top of a player's deck, place those cards
 * facedown under this scheme." (Skrull Business, `cw` 56056; docs/phase7-wave10-box-heroes.md B3.3): a
 * `cardDiscardedFromDeck` pattern with no player, answered once for the discard (`together`), and
 * `AbilityDefinition.discardsStayCounted`. Synthetic cards: a side scheme with that sentence (the Vault), the same
 * scheme without the mark (the Pit), and cards that discard from a deck and read what they discarded.
 *
 * Owner decision, 2026-10-11, box-heroes question 14 = A (provisional): the discarding ability still counts the cards
 * it discarded and reads their printed icons, though the scheme has taken them. Wave 7's question 32 = A (owner, 2026-10-17,
 * issue #222; a card a response took away still counts for the ability that discarded it, but leaves its set) is the
 * rule for a response without the mark. RRG 1.8 "Triggering Condition" (p. 45: one occurrence, one window), "Tuck" (p. 45: tucked cards are not in
 * play, and are discarded to their owners' piles when the host leaves play), "Player Deck" (p. 33).
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay, TOGETHER_TARGETS_SLOT } from "./select.js";
import type { CardSelector, EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import {
  stubEvent,
  stubMainScheme,
  stubResource,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const you = { kind: "controller" } as const;
const n = (value: number): ValueSpec => ({ kind: "const", value });
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const topOfDeck = (count: number): CardSelector => ({ kind: "zone", zone: "deck", player: you, top: n(count) });

const underThis = (definition: Partial<AbilityDefinition> = {}) =>
  ({
    trigger: { kind: "response", forced: true, on: { on: "cardDiscardedFromDeck", together: true } },
    effects: [
      { kind: "tuckCards", cards: { kind: "ref", ref: slot(TOGETHER_TARGETS_SLOT) }, under: self, facedown: true },
    ],
    ...definition,
  }) satisfies AbilityDefinition;
/** "… place those cards facedown under this scheme", the discarding ability still counting them. */
const VAULT_RESPONSE = stubAbility("vault.response", underThis({ discardsStayCounted: true }));
const VAULT = stubSideScheme({ id: "vault", startingThreat: 5, boostIcons: 0, abilities: [VAULT_RESPONSE.ref] });
/** The same sentence without the mark: wave 7's question 32 = A. */
const PIT_RESPONSE = stubAbility("pit.response", underThis());
const PIT = stubSideScheme({ id: "pit", startingThreat: 5, boostIcons: 0, abilities: [PIT_RESPONSE.ref] });

/** "Response: After this card is discarded from the top of your deck, add it to your hand." */
const KEEPSAKE_RESPONSE = stubAbility("keepsake.response", {
  trigger: { kind: "response", forced: false, on: { on: "cardDiscardedFromDeck", selfIs: "target" } },
  effects: [{ kind: "moveCards", cards: { kind: "ref", ref: self }, to: "hand" }],
  activeIn: "discard",
});
const ENERGY = stubResource({ id: "energy", icons: 0, produces: { energy: 1 } });
const MENTAL = stubResource({ id: "mental", icons: 0, produces: { mental: 1 } });
const DOUBLE = stubResource({ id: "double", icons: 0, produces: { energy: 2 } });
const KEEPSAKE = stubResource({
  id: "keepsake",
  icons: 0,
  produces: { physical: 1 },
  abilities: [KEEPSAKE_RESPONSE.ref],
});
const BLANK = stubEvent({ id: "blank", cost: 0 });
const METER = stubSupport({ id: "meter", cost: 0 });

const meter: TargetRef = { kind: "named", name: METER.name };
const measure = (counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: meter,
  counterType,
  amount,
});
/** What the discarding ability reads of the cards it discarded, after the responses: count, energy icons, types. */
const read = (bind: string): readonly EffectSpec[] => [
  measure("count", { kind: "var", name: `${bind}.count` }),
  measure("energy", { kind: "var", name: `${bind}.energy` }),
  measure("types", { kind: "resourceTypes", cards: slot(bind) }),
];
const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Discard the top 3 cards of your deck." and what it reads of them. */
const MILL = action("mill", [
  { kind: "moveCards", cards: topOfDeck(3), to: "discard", bind: "milled" },
  ...read("milled"),
]);
/** "Discard a card from your hand." */
const TOSS = action("toss", [
  {
    kind: "moveCards",
    cards: { kind: "zone", zone: "hand", player: you, filter: { name: BLANK.name } },
    to: "discard",
  },
]);
const REVEAL = action("reveal", [{ kind: "revealEncounterCard", player: you }]);
/** "When Revealed: Discard the top 3 cards of your deck. Take 1 damage for each different resource icon on them." */
const GRAB_REVEALED = stubAbility("grab.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "moveCards", cards: topOfDeck(3), to: "discard", bind: "grabbed" },
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: you },
      amount: { kind: "resourceTypes", cards: slot("grabbed") },
    },
  ],
});
const GRAB = stubTreachery({ id: "grab", boostIcons: 0, abilities: [GRAB_REVEALED.ref] });
/** "Action: Discard the top 2 cards of your deck → …", counting what paid. */
const COSTLY_ACTION = stubAbility("costly.action", {
  trigger: { kind: "action" },
  cost: { discardFromDeck: 2, discardFromDeckSlot: "paid" },
  effects: [measure("count", { kind: "refCount", of: slot("paid") })],
});
const COSTLY = stubUpgrade({ id: "costly", cost: 0, abilities: [COSTLY_ACTION.ref] });
const EVENTS = [MILL, TOSS, REVEAL];

const TYRANT = stubVillain({ id: "tyrant", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });

const deps: EngineDeps = depsOf(
  VAULT_RESPONSE,
  PIT_RESPONSE,
  KEEPSAKE_RESPONSE,
  GRAB_REVEALED,
  COSTLY_ACTION,
  ...EVENTS.map((e) => e.ability),
);

type Top = "energy" | "mental" | "double" | "keepsake" | "blank";
interface Table {
  readonly state: GameState;
  readonly scheme: InstanceId | null;
  readonly meter: InstanceId;
  /** The top of player 1's deck, in order. */
  readonly top: readonly InstanceId[];
}

/** Puts copies of `cards` on top of `player`'s deck in order, from wherever that player holds them (surgery). */
function stackDeck(state: GameState, player: PlayerId, cards: readonly string[], rest?: number) {
  const seat = mustPlayer(state, player);
  const pool = [...seat.deck, ...seat.hand, ...seat.discard];
  const taken: InstanceId[] = [];
  for (const card of cards) {
    const id = pool.find((candidate) => !taken.includes(candidate) && state.instances[candidate]?.cardId === card);
    if (!id) throw new Error(`${player} has no ${card} left`);
    taken.push(id);
  }
  const under = seat.deck.filter((id) => !taken.includes(id));
  const next: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            hand: p.hand.filter((id) => !taken.includes(id)),
            discard: p.discard.filter((id) => !taken.includes(id)),
            deck: [...taken, ...(rest === undefined ? under : under.slice(0, rest))],
          }
        : p,
    ),
  };
  return { state: next, top: taken };
}

/** Player 1 in hero form with the Meter in play, `scheme` in play with 5 threat, and `top` on top of their deck. */
function start(
  top: readonly Top[],
  options: { scheme?: { readonly id: CardId } | null; players?: 1 | 2; rest?: number } = {},
): Table {
  let state = gameAtFirstTurn({
    cards: [
      VAULT,
      PIT,
      ENERGY,
      MENTAL,
      DOUBLE,
      KEEPSAKE,
      BLANK,
      METER,
      GRAB,
      COSTLY,
      NOISE,
      ...EVENTS.map((e) => e.card),
    ],
    deps,
    villain: TYRANT,
    mainScheme: SCHEME,
    players: options.players ?? 1,
    encounter: [VAULT.id, PIT.id, GRAB.id, ...copiesOf(NOISE.id, 14)],
    deck: [
      ...copiesOf(ENERGY.id, 3),
      ...copiesOf(MENTAL.id, 3),
      ...copiesOf(DOUBLE.id, 3),
      ...copiesOf(KEEPSAKE.id, 2),
      ...copiesOf(BLANK.id, 6),
      METER.id,
      COSTLY.id,
      ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
    ],
  });
  const placed = playerCardIntoPlay(state, METER.id);
  state = runCommandsPicking(placed.state, deps, defaultPick, { type: "changeForm", playerId: P1 }).state;
  const scheme = options.scheme === null ? null : encounterCardInVillainArea(state, (options.scheme ?? VAULT).id, 5);
  const stacked = stackDeck(scheme?.state ?? state, P1, top, options.rest);
  return { state: stacked.state, scheme: scheme?.id ?? null, meter: placed.id, top: stacked.top };
}
const playCommand = (state: GameState, card: { readonly card: { readonly id: CardId } }, player: PlayerId = P1) => {
  const given = giveCard(state, player, card.card.id);
  const command: Command = {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  return { state: given.state, command };
};
function play(state: GameState, card: { readonly card: { readonly id: CardId } }, player: PlayerId = P1) {
  const staged = playCommand(state, card, player);
  return runCommandsPicking(staged.state, deps, defaultPick, staged.command);
}
const under = (state: GameState, id: InstanceId | null) => (id ? mustInstance(state, id).tucked : []);
const counters = (state: GameState, id: InstanceId) => mustInstance(state, id).counters;
const discardOf = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).discard;
const resolved = (events: readonly GameEvent[], abilityId: string) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === abilityId).length;
const stillCounted = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "deckDiscardStillCounted" ? [e.instanceId] : []));
const notCounted = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "deckDiscardNotCounted" ? [e.instanceId] : []));

describe("box-heroes B3.3: cards discarded from the top of any player's deck go facedown under the scheme", () => {
  it("three cards discarded by one effect: one forced response, all three facedown under it, none in the discard pile", () => {
    const table = start(["energy", "mental", "blank"]);
    const run = play(table.state, MILL);
    expect(resolved(run.events, VAULT_RESPONSE.ref.id)).toBe(1);
    expect(under(run.state, table.scheme)).toEqual(table.top);
    expect(table.top.map((id) => mustInstance(run.state, id).faceup)).toEqual([false, false, false]);
    expect(discardOf(run.state).filter((id) => table.top.includes(id))).toEqual([]);
    expect(table.top.filter((id) => cardsInPlay(run.state).includes(id))).toEqual([]);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);
  });

  it("question 14 = A: the effect that discarded them still counts all three and reads their printed icons", () => {
    const table = start(["energy", "mental", "double"]);
    const run = play(table.state, MILL);
    // Energy 1 + 2 on two cards, one mental: 3 cards, 3 energy icons, 2 different types.
    expect(counters(run.state, table.meter)).toEqual({ count: 3, energy: 3, types: 2 });
    expect(stillCounted(run.events)).toEqual(table.top);
    expect(notCounted(run.events)).toEqual([]);
  });

  it("the same sentence without the mark is wave 7's question 32 = A: under the scheme, and all of them still counted", () => {
    const table = start(["energy", "mental", "double"], { scheme: PIT });
    const run = play(table.state, MILL);
    expect(under(run.state, table.scheme)).toEqual(table.top);
    // Out of the set, still counted: the vars, totalPrintedResources and resourceTypes read the away cards too.
    expect(counters(run.state, table.meter)).toEqual({ count: 3, energy: 3, types: 2 });
    expect(notCounted(run.events)).toEqual([]);
    expect(stillCounted(run.events)).toEqual(table.top);
  });

  it("with no scheme in play the cards stay in the discard pile and are counted as always", () => {
    const table = start(["energy", "mental", "double"], { scheme: null });
    const run = play(table.state, MILL);
    expect(discardOf(run.state).filter((id) => table.top.includes(id))).toHaveLength(3);
    expect(counters(run.state, table.meter)).toEqual({ count: 3, energy: 3, types: 2 });
    expect(stillCounted(run.events)).toEqual([]);
  });

  it("question 14 = A: an encounter card's discard of three (energy, mental, energy) still deals 2 damage", () => {
    const table = start(["energy", "mental", "double"]);
    const staged = playCommand(onTopOfEncounterDeck(table.state, GRAB.id), REVEAL);
    const hero = mustPlayer(staged.state, P1).identity.instanceId;
    const run = runCommandsPicking(staged.state, deps, defaultPick, staged.command);
    expect(under(run.state, table.scheme)).toEqual(table.top);
    expect(mustInstance(run.state, hero).damage).toBe(2);
  });

  it("question 14 = A: a cost's discard of two goes under the scheme and the ability it paid for counts both", () => {
    const table = start(["blank", "energy"]);
    const costly = playerCardIntoPlay(table.state, COSTLY.id);
    const run = runCommandsPicking(costly.state, deps, defaultPick, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: costly.id,
      abilityId: COSTLY_ACTION.ref.id,
      payment: [],
    });
    expect(under(run.state, table.scheme)).toEqual(table.top);
    expect(counters(run.state, table.meter)).toEqual({ count: 2 });
  });

  it("a card with its own response to the discard is taken first by the forced response, and is still counted", () => {
    const table = start(["keepsake", "energy", "mental"]);
    const run = play(table.state, MILL);
    expect(under(run.state, table.scheme)).toEqual(table.top);
    expect(resolved(run.events, KEEPSAKE_RESPONSE.ref.id)).toBe(0);
    expect(mustPlayer(run.state, P1).hand).not.toContain(table.top[0]);
    expect(counters(run.state, table.meter)).toEqual({ count: 3, energy: 1, types: 3 });
  });

  it("a card discarded from a hand is untouched", () => {
    const table = start(["energy"]);
    const blank = giveCard(table.state, P1, BLANK.id);
    const run = play(blank.state, TOSS);
    expect(under(run.state, table.scheme)).toEqual([]);
    expect(discardOf(run.state)).toContain(blank.id);
    expect(resolved(run.events, VAULT_RESPONSE.ref.id)).toBe(0);
  });

  it("the discard that empties the deck: the card that emptied it is taken from the new deck the reset made", () => {
    const table = start(["energy", "mental", "double"], { rest: 0 });
    const run = play(table.state, MILL);
    // The reset shuffled the discard pile into the new deck, the first two cards with it: a player deck's earlier
    // discards are not answered there (docs/phase7-wave7.md §4.1 Q33 speaks of the deck's last card).
    expect(under(run.state, table.scheme)).toEqual([table.top[2]]);
    expect(mustPlayer(run.state, P1).deck).toEqual(expect.arrayContaining([table.top[0], table.top[1]]));
    expect(mustPlayer(run.state, P1).deck).not.toContain(table.top[2]);
    expect(counters(run.state, table.meter)).toEqual({ count: 3, energy: 3, types: 2 });
  });

  it("a second player's discard goes under it too, and the scheme thwarted to 0 returns each card to its owner", () => {
    const table = start(["energy", "mental", "blank"], { players: 2 });
    const first = play(table.state, MILL);
    const second = stackDeck(first.state, P2, [DOUBLE.id, BLANK.id, BLANK.id]);
    const turn = runCommandsPicking(second.state, deps, defaultPick, { type: "endTurn", playerId: P1 }).state;
    const theirs = play(turn, MILL, P2);
    expect(under(theirs.state, table.scheme)).toEqual([...table.top, ...second.top]);
    expect(discardOf(theirs.state, P2).filter((id) => second.top.includes(id))).toEqual([]);
    // Player 2's hero (2 THW) removes the last 2 threat.
    const low: GameState = {
      ...theirs.state,
      instances: {
        ...theirs.state.instances,
        [table.scheme!]: { ...mustInstance(theirs.state, table.scheme!), threat: 2 },
      },
    };
    const hero = mustPlayer(low, P2).identity.instanceId;
    const done = runCommandsPicking(
      low,
      deps,
      defaultPick,
      { type: "changeForm", playerId: P2 },
      { type: "basicThwart", playerId: P2, thwarterInstanceId: hero, schemeInstanceId: table.scheme! },
    );
    expect(cardsInPlay(done.state)).not.toContain(table.scheme);
    expect(discardOf(done.state, P1)).toEqual(expect.arrayContaining([...table.top]));
    expect(discardOf(done.state, P2)).toEqual(expect.arrayContaining([...second.top]));
    expect([...table.top, ...second.top].map((id) => mustInstance(done.state, id).faceup)).toEqual(
      Array.from({ length: 6 }, () => true),
    );
  });
});
