/**
 * docs/phase7-wave1.md §3.12: the selection and value vocabulary — superlatives with tie authority, the identity-set
 * filter, the new `ValueSpec`s, discarding from the encounter deck, dealing several cards to each player, and
 * "X enemies" / "up to 3 different enemies". Proven with synthetic cards.
 *
 * Sources: RRG 1.8 "Encounter Deck" (p. 17), "Each Player" (p. 17), "First Player" (p. 19), "Identity-Specific Card"
 * (p. 23), "Printed" (p. 35); FAQ "Melee (#30)" (p. 59); ruling, Jan 26, 2026 (4) answer 3.
 */

import { flat, type Aspect, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { createCtx } from "./ctx.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, activeEncounterDeckId, encounterDeckOf, mustInstance, mustPlayer } from "./query.js";
import { selectCards } from "./resolve/cards.js";
import { resolveRef, resolveValue, type EffectContext } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  giveCard,
  HERO,
  seatIdentities,
  settleUntil,
  withEncounterPiles,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");

const you = { kind: "controller" } as const;
const candidate: TargetRef = { kind: "slot", slot: "candidate" };
const one: ValueSpec = { kind: "const", value: 1 };
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const num = (value: number): ValueSpec => ({ kind: "const", value });

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const GOON = stubMinion({ id: "goon", atk: 0, sch: 0, hp: 3, boostIcons: 0 });
const OTHER = stubMinion({ id: "other", atk: 0, sch: 0, hp: 3, boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({
  id: "quiet",
  stages: [
    { hp: flat(30), atk: 0, sch: 0 },
    { hp: flat(30), atk: 0, sch: 0 },
  ],
});
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

/** A card of HERO's identity set: the set icon is the card's `aspect` (RRG 1.8 "Identity-Specific Card", p. 23). */
const SIGNATURE_ALLY = stubAlly({
  id: "signature-ally",
  cost: 1,
  atk: 1,
  thw: 1,
  hp: 2,
  aspect: `hero:${HERO.id}` as Aspect,
});
const BASIC_ALLY = stubAlly({ id: "basic-ally", cost: 3, atk: 1, thw: 1, hp: 2 });

// --- §3.12 superlatives, as a ref anyone can resolve ------------------------------------------------------------

const actionEvent = (id: string, effects: readonly EffectSpec[], cost = 0) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost, abilities: [ability.ref] }), ability };
};

/** "Discard the top N cards of the encounter deck", with the discarded cards bound. */
const DISCARD_THREE = actionEvent("discard-three", [
  { kind: "discardEncounterCards", count: num(3), bind: "dumped" },
  {
    kind: "addCounters",
    target: { kind: "identityOf", player: you },
    counterType: "dumped",
    amount: { kind: "var", name: "dumped.count" },
  },
]);
/** "Each time a [goon] is discarded this way, place 1 counter." */
const DISCARD_EACH = actionEvent("discard-each", [
  {
    kind: "discardEncounterCards",
    count: num(4),
    forEachDiscarded: {
      slot: "card",
      effects: [
        {
          kind: "if",
          // The card is in a discard pile by now, so the question is about the card wherever it is.
          condition: {
            kind: "refMatches",
            ref: { kind: "slot", slot: "card" },
            query: { name: GOON.name },
            anywhere: true,
          },
          then: [
            { kind: "addCounters", target: { kind: "identityOf", player: you }, counterType: "goons", amount: one },
          ],
        },
      ],
    },
  },
]);
/** RRG 1.8 "Each Player" (p. 17): each player discards 2; the deck resets between them when one empties it. */
const DISCARD_EACH_PLAYER = actionEvent("discard-each-player", [
  { kind: "forEachPlayer", players: { kind: "each" }, effects: [{ kind: "discardEncounterCards", count: num(2) }] },
]);
/** "Deal 2 encounter cards to each player." */
const DEAL_TWO_EACH = actionEvent("deal-two-each", [
  { kind: "dealEncounterCard", player: { kind: "each" }, count: num(2) },
]);
const DEAL_ONE_YOU = actionEvent("deal-one-you", [{ kind: "dealEncounterCard", player: you }]);
/** "Deal 1 damage to X enemies", X being the number of minions in play. */
const X_ENEMIES = actionEvent("x-enemies", [
  {
    kind: "chooseTarget",
    slot: "enemies",
    query: { categories: ["enemy"] },
    chooser: you,
    count: { kind: "count", query: { categories: ["minion"] } },
  },
  { kind: "dealDamage", target: { kind: "slot", slot: "enemies" }, amount: one },
]);
/** "Deal 1 damage to up to 3 different enemies." */
const UP_TO_THREE = actionEvent("up-to-three", [
  { kind: "chooseTarget", slot: "enemies", query: { categories: ["enemy"] }, chooser: you, count: 3, optional: true },
  { kind: "dealDamage", target: { kind: "slot", slot: "enemies" }, amount: one },
]);

const EVENTS = [DISCARD_THREE, DISCARD_EACH, DISCARD_EACH_PLAYER, DEAL_TWO_EACH, DEAL_ONE_YOU, X_ENEMIES, UP_TO_THREE];

/** An encounter card that hits "the hero with the fewest hit points remaining", ties chosen by the first player. */
const FEWEST_HP = stubAbility("mad-genius.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    {
      kind: "bindTargets",
      slot: "tied",
      target: {
        kind: "superlative",
        among: { kind: "each", query: { categories: ["identity"] } },
        order: "lowest",
        measure: { kind: "remainingHp", of: candidate },
      },
    },
    {
      kind: "chooseTarget",
      slot: "hurt",
      query: { categories: ["identity"], inSlot: "tied" },
      chooser: { kind: "firstPlayer" },
    },
    { kind: "dealDamage", target: { kind: "slot", slot: "hurt" }, amount: num(2) },
  ],
});
const MAD_GENIUS = stubTreachery({ id: "mad-genius", boostIcons: 0, abilities: [FEWEST_HP.ref] });

const ABILITIES: readonly StubAbility[] = [FEWEST_HP, ...EVENTS.map((e) => e.ability)];
const deps: EngineDeps = depsOf(...ABILITIES);

const CARDS = [
  ...DEFAULT_CARDS,
  QUIET_VILLAIN,
  LONG_SCHEME,
  BLANK,
  GOON,
  OTHER,
  MAD_GENIUS,
  SIGNATURE_ALLY,
  BASIC_ALLY,
  ...EVENTS.map((e) => e.card),
];

function game(
  options: {
    readonly players?: number;
    readonly encounter?: readonly CardId[];
    readonly startStageIndex?: number;
  } = {},
): GameState {
  const identities = seatIdentities(HERO, options.players ?? 1);
  const config: GameSetupConfig = {
    seed: 5,
    cards: [...CARDS, ...identities],
    villainCardId: QUIET_VILLAIN.id,
    mainSchemeCardId: LONG_SCHEME.id,
    ...(options.startStageIndex !== undefined ? { villainStartStageIndex: options.startStageIndex } : {}),
    encounterDeck: options.encounter ?? copies(BLANK.id, 16),
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, SIGNATURE_ALLY.id, BASIC_ALLY.id, ...EVENTS.map((e) => e.card.id)],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const context = (state: GameState, bindings: Record<string, readonly InstanceId[]> = {}): EffectContext => ({
  selfInstanceId: null,
  controllerId: p1,
  event: null,
  bindings,
  deps,
});

function play(state: GameState, card: { readonly id: CardId }, player = p1) {
  const given = giveCard(state, player, card.id);
  return runCommands(given.state, deps, {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

/** Test surgery: the first copy of `card` in the active encounter deck enters play engaged with p1. */
function engage(state: GameState, cardId: CardId, player = p1): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const piles = encounterDeckOf(state, deckId);
  const id = piles.deck.find((candidateId) => state.instances[candidateId]?.cardId === cardId);
  if (!id) throw new Error(`no ${cardId} in the encounter deck`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: { ...mustInstance(state, id), faceup: true, engagedWith: player, controllerId: null },
      },
    },
  };
}

const damaged = (state: GameState, id: InstanceId, damage: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), damage } },
});

const endTurn = (player = p1): Command => ({ type: "endTurn", playerId: player });

describe("§3.12 superlatives", () => {
  const superlative = (
    order: "highest" | "lowest",
    measure: ValueSpec,
    among: TargetRef,
    extra: { readonly ties?: "all" | "first" } = {},
  ): TargetRef => ({
    kind: "superlative",
    among,
    order,
    measure,
    ...(extra.ties ? { ties: extra.ties } : {}),
  });

  it("'the hero with the fewest hit points remaining' picks the one hurt most, and a tie names every tied card", () => {
    const start = game({ players: 2 });
    const [first, second] = start.players.map((p) => p.identity.instanceId) as [InstanceId, InstanceId];
    const ref = superlative(
      "lowest",
      { kind: "remainingHp", of: candidate },
      { kind: "each", query: { categories: ["identity"] } },
    );

    // Untouched heroes are tied: the ref names both, and the effect that needs one breaks the tie.
    expect(resolveRef(start, ref, context(start))).toEqual([first, second]);
    expect(resolveRef(damaged(start, second, 4), ref, context(start))).toEqual([second]);
    // `ties: "first"` takes the first in the pool's stable order for a card the choice cannot matter to.
    expect(
      resolveRef(
        start,
        superlative(
          "lowest",
          { kind: "remainingHp", of: candidate },
          { kind: "each", query: { categories: ["identity"] } },
          { ties: "first" },
        ),
        context(start),
      ),
    ).toEqual([first]);
  });

  it("measures a value read off another card: 'the villain whose side scheme has the most threat'", () => {
    const state = crewGame();
    const [wrecker, thunderball] = state.villains.map((v) => v.instanceId) as [InstanceId, InstanceId];
    const ref = superlative(
      "highest",
      { kind: "threat", of: { kind: "signatureSideSchemeOf", villain: candidate } },
      { kind: "each", query: { categories: ["villain"] } },
    );
    // Signature side schemes entered play with 1 and 3 threat.
    expect(resolveRef(state, ref, context(state))).toEqual([thunderball]);
    const lowest = superlative(
      "lowest",
      { kind: "threat", of: { kind: "signatureSideSchemeOf", villain: candidate } },
      { kind: "each", query: { categories: ["villain"] } },
    );
    expect(resolveRef(state, lowest, context(state))).toEqual([wrecker]);
  });

  it("ranks the highest ATK among enemies, and the highest printed cost among cards out of play", () => {
    const start = game({ encounter: [GOON.id, ...copies(BLANK.id, 15)] });
    const withGoon = engage(start, GOON.id);
    const villain = withGoon.state.villains[0]?.instanceId as InstanceId;
    const byAtk = superlative(
      "highest",
      { kind: "stat", of: candidate, stat: "atk" },
      { kind: "each", query: { categories: ["enemy"] } },
    );
    // The villain's stage ATK is 0 and the goon's is 0, so both tie; give the goon an edge through damage-free surgery.
    expect(resolveRef(withGoon.state, byAtk, context(withGoon.state))).toEqual([villain, withGoon.id]);

    // Cards in hand: the pool is a slot an earlier `selectCards` bound, so the same ref works out of play.
    const handed = giveCard(giveCard(start, p1, SIGNATURE_ALLY.id).state, p1, BASIC_ALLY.id);
    const hand = mustPlayer(handed.state, p1).hand;
    const byCost = superlative("highest", { kind: "printedCost", of: candidate }, { kind: "slot", slot: "hand" });
    const dearest = resolveRef(handed.state, byCost, context(handed.state, { hand }));
    expect(dearest).toHaveLength(1);
    expect(mustInstance(handed.state, dearest[0] as InstanceId).cardId).toBe(BASIC_ALLY.id);
  });

  it("a tie on an encounter card is a first-player choice (firstPlayerTargets); one candidate offers only itself", () => {
    // Two players in alter-ego form: the villain takes one boost card per scheme activation, then step 3 deals one
    // card to each player in player order, so the fourth card of the deck is the one p2 reveals.
    const base = game({ players: 2, encounter: [MAD_GENIUS.id, ...copies(BLANK.id, 15)] });
    const deck = activeEncounterDeck(base).deck;
    const genius = deck.find((id) => mustInstance(base, id).cardId === MAD_GENIUS.id) as InstanceId;
    const rest = deck.filter((id) => id !== genius);
    const start = withEncounterPiles(base, { deck: [...rest.slice(0, 3), genius, ...rest.slice(3)] });
    const [firstIdentity, secondIdentity] = start.players.map((p) => p.identity.instanceId) as [InstanceId, InstanceId];

    const tied = settleUntil(ok(ok(start, endTurn(p1)), endTurn(p2)), "chooseTarget", deps);
    const choice = tied.pendingChoice;
    expect(choice?.prompt).toEqual({ kind: "chooseTarget", slot: "hurt", abilityId: null });
    expect(choice?.authority).toBe("firstPlayerTargets");
    expect(choice?.playerId).toBe(tied.firstPlayerId);
    expect(choice?.options.map((option) => option.optionId)).toEqual([firstIdentity, secondIdentity]);

    const chosen = ok(tied, {
      type: "resolveChoice",
      playerId: choice!.playerId,
      choiceId: choice!.choiceId,
      selectedOptionIds: [secondIdentity],
    });
    expect(mustInstance(chosen, secondIdentity).damage).toBe(2);
    expect(mustInstance(chosen, firstIdentity).damage).toBe(0);

    // No tie: only the hurt hero is eligible, so the choice has one option.
    const hurt = settleUntil(ok(ok(damaged(start, firstIdentity, 3), endTurn(p1)), endTurn(p2)), "chooseTarget", deps);
    expect(hurt.pendingChoice?.options.map((option) => option.optionId)).toEqual([firstIdentity]);
  });
});

describe("§3.12 the identity-set filter and the new values", () => {
  it("identitySetOf matches that identity's set cards, in play or in a deck, and nothing else", () => {
    const start = game();
    const ctx = createCtx(start, deps);
    const query = { identitySetOf: you } as const;
    const inDeck = selectCards(ctx, { kind: "zone", zone: "deck", player: you, filter: query }, context(start));
    const cardIds = inDeck.map((id) => mustInstance(start, id).cardId);
    expect(cardIds).toEqual([SIGNATURE_ALLY.id]);
    // The identity card itself is not a card of its set, and a basic card is not either.
    const everything = selectCards(ctx, { kind: "zone", zone: "deck", player: you }, context(start));
    expect(everything.length).toBeGreaterThan(inDeck.length);
  });

  it("printedCost, distinctCardTypes and villainStageNumber read what is printed", () => {
    const start = game({ encounter: [GOON.id, ...copies(BLANK.id, 15)] });
    const handed = giveCard(start, p1, BASIC_ALLY.id);
    const ally = handed.state.players[0]?.hand.find(
      (id) => mustInstance(handed.state, id).cardId === BASIC_ALLY.id,
    ) as InstanceId;
    expect(
      resolveValue(
        handed.state,
        { kind: "printedCost", of: { kind: "slot", slot: "c" } },
        context(handed.state, { c: [ally] }),
      ),
    ).toBe(BASIC_ALLY.cost);
    // A card with no printed cost (a minion) is 0.
    const goon = engage(start, GOON.id);
    expect(
      resolveValue(
        goon.state,
        { kind: "printedCost", of: { kind: "slot", slot: "c" } },
        context(goon.state, { c: [goon.id] }),
      ),
    ).toBe(0);

    const mixed = [ally, goon.id];
    expect(
      resolveValue(
        goon.state,
        { kind: "distinctCardTypes", cards: { kind: "slot", slot: "c" } },
        context(goon.state, { c: mixed }),
      ),
    ).toBe(2);
    expect(
      resolveValue(
        goon.state,
        { kind: "distinctCardTypes", cards: { kind: "slot", slot: "c" } },
        context(goon.state, { c: [goon.id] }),
      ),
    ).toBe(1);

    // The printed numeral, not the index: expert play starts on stage II.
    expect(resolveValue(start, { kind: "villainStageNumber" }, context(start))).toBe(1);
    const expert = game({ startStageIndex: 1 });
    expect(resolveValue(expert, { kind: "villainStageNumber" }, context(expert))).toBe(2);
  });
});

describe("§3.12 discarding from the encounter deck", () => {
  it("discards from the top of the active deck, faceup, and reports how many", () => {
    const start = game({ encounter: copies(BLANK.id, 16) });
    const top = activeEncounterDeck(start).deck.slice(0, 3);
    const { state } = play(start, DISCARD_THREE.card);
    expect(activeEncounterDeck(state).discard.slice(0, 3)).toEqual([...top].reverse());
    expect(top.every((id) => mustInstance(state, id).faceup)).toBe(true);
    expect(mustInstance(state, mustPlayer(state, p1).identity.instanceId).counters.dumped).toBe(3);
  });

  it("stops when this effect empties the deck and does not continue with the reshuffled deck (RRG 1.8 p. 17)", () => {
    const start = game({ encounter: copies(BLANK.id, 16) });
    const deck = activeEncounterDeck(start).deck;
    // Two cards left in the deck and plenty in the discard pile: discarding 3 stops at 2.
    const short = withEncounterPiles(start, { deck: deck.slice(0, 2), discard: deck.slice(2) });
    const { state } = play(short, DISCARD_THREE.card);
    expect(mustInstance(state, mustPlayer(state, p1).identity.instanceId).counters.dumped).toBe(2);
    expect(activeEncounterDeck(state).deck).toEqual([]);
    expect(state.mainScheme.accelerationTokens).toBe(0);
  });

  it("'each player discards 2' resumes from the reset deck for the remaining players (RRG 1.8 'Each Player')", () => {
    const start = game({ players: 2, encounter: copies(BLANK.id, 16) });
    const deck = activeEncounterDeck(start).deck;
    const short = withEncounterPiles(start, { deck: deck.slice(0, 2), discard: deck.slice(2, 6) });
    const { state } = play(short, DISCARD_EACH_PLAYER.card);
    // p1 empties the deck and stops; p2 finds it empty, so it is reset (one acceleration token) and p2 discards 2.
    // The reset shuffled the whole discard pile (the 4 seeded cards and p1's 2) back in, so only p2's 2 are left in it.
    expect(state.mainScheme.accelerationTokens).toBe(1);
    expect(activeEncounterDeck(state).discard).toHaveLength(2);
    expect(activeEncounterDeck(state).deck).toHaveLength(4);
  });

  it("forEachDiscarded runs once per discarded card, in discard order", () => {
    const start = game({ encounter: [GOON.id, OTHER.id, GOON.id, OTHER.id, ...copies(BLANK.id, 12)] });
    const stacked = withEncounterPiles(start, {
      deck: [...activeEncounterDeck(start).deck].sort(
        (a, b) => Number(mustInstance(start, b).cardId === GOON.id) - Number(mustInstance(start, a).cardId === GOON.id),
      ),
    });
    const { state } = play(stacked, DISCARD_EACH.card);
    expect(mustInstance(state, mustPlayer(state, p1).identity.instanceId).counters.goons).toBe(2);
  });
});

describe("§3.12 dealing several cards to each player", () => {
  it("deals one player's whole share before the next player's, in an order the first player picks (AABB or BBAA)", () => {
    const start = game({ players: 2, encounter: copies(BLANK.id, 16) });
    const [a, b, c, d] = activeEncounterDeck(start).deck as [InstanceId, InstanceId, InstanceId, InstanceId];
    const given = giveCard(start, p1, DEAL_TWO_EACH.card.id);
    const atOrder = ok(given.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });

    const choice = atOrder.pendingChoice;
    expect(choice?.prompt).toEqual({ kind: "orderPlayers", reason: "dealEncounterCards" });
    expect(choice?.authority).toBe("firstPlayerOrders");
    expect(choice?.playerId).toBe(atOrder.firstPlayerId);
    expect(choice?.ordered).toBe(true);

    // BBAA: the first player sends both of p2's cards first.
    const dealt = ok(atOrder, {
      type: "resolveChoice",
      playerId: choice!.playerId,
      choiceId: choice!.choiceId,
      selectedOptionIds: [p2, p1],
    });
    expect(mustPlayer(dealt, p2).dealtEncounter).toEqual([a, b]);
    expect(mustPlayer(dealt, p1).dealtEncounter).toEqual([c, d]);
  });

  it("one player receiving cards is dealt to without asking (every Core use is unchanged)", () => {
    const start = game({ encounter: copies(BLANK.id, 16) });
    const [top] = activeEncounterDeck(start).deck as [InstanceId];
    const { state } = play(start, DEAL_ONE_YOU.card);
    expect(state.pendingChoice).toBeNull();
    expect(mustPlayer(state, p1).dealtEncounter).toEqual([top]);
  });
});

describe("§3.12 'X enemies' and 'up to 3 different enemies'", () => {
  it("a ValueSpec count asks for exactly that many, and a villain counts once however many stages it has (FAQ Melee #30)", () => {
    const start = game({ encounter: [GOON.id, OTHER.id, ...copies(BLANK.id, 14)] });
    const first = engage(start, GOON.id);
    const second = engage(first.state, OTHER.id);
    const villain = second.state.villains[0]?.instanceId as InstanceId;
    const given = giveCard(second.state, p1, X_ENEMIES.card.id);
    const atChoice = ok(given.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });

    const choice = atChoice.pendingChoice;
    // Two minions in play, so X is 2.
    expect(choice?.minSelections).toBe(2);
    expect(choice?.maxSelections).toBe(2);
    // The villain deck has two stages but is one enemy, offered once.
    expect(choice?.options.filter((option) => option.optionId === villain)).toHaveLength(1);

    const hit = ok(atChoice, {
      type: "resolveChoice",
      playerId: p1,
      choiceId: choice!.choiceId,
      selectedOptionIds: [first.id, second.id],
    });
    expect(mustInstance(hit, first.id).damage).toBe(1);
    expect(mustInstance(hit, second.id).damage).toBe(1);
  });

  it("'up to 3' lets the player take fewer, and the targets are distinct cards", () => {
    const start = game({ encounter: [GOON.id, OTHER.id, ...copies(BLANK.id, 14)] });
    const first = engage(start, GOON.id);
    const given = giveCard(first.state, p1, UP_TO_THREE.card.id);
    const atChoice = ok(given.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });

    const choice = atChoice.pendingChoice;
    expect(choice?.minSelections).toBe(0);
    // One villain and one minion in play, so at most two of the three may be taken.
    expect(choice?.maxSelections).toBe(2);
    const none = ok(atChoice, {
      type: "resolveChoice",
      playerId: p1,
      choiceId: choice!.choiceId,
      selectedOptionIds: [],
    });
    expect(mustInstance(none, first.id).damage).toBe(0);
  });
});

// --- helpers ----------------------------------------------------------------------------------------------------

function ok(state: GameState, command: Command): GameState {
  const result = applyCommand(state, command, deps);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
}

/** Two villains with signature side schemes at 1 and 3 threat, for a superlative measured off another card. */
function crewGame(): GameState {
  const wrecker = stubVillain({ id: "wrecker", stages: [{ hp: flat(10), atk: 0, sch: 0 }] });
  const thunderball = stubVillain({ id: "thunderball", stages: [{ hp: flat(10), atk: 0, sch: 0 }] });
  const low = stubSideScheme({ id: "low-scheme", startingThreat: 1, boostIcons: 0 });
  const high = stubSideScheme({ id: "high-scheme", startingThreat: 3, boostIcons: 0 });
  const setup = stubAbility("crew.setup", {
    trigger: { kind: "setup" },
    effects: [
      { kind: "selectCards", slot: "signature", cards: { kind: "encounterSetAside" } },
      { kind: "putIntoPlay", card: { kind: "slot", slot: "signature" }, controller: { kind: "firstPlayer" } },
    ],
  });
  const scheme = stubMainScheme({
    id: "crew-scheme",
    stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [setup.ref] }],
  });
  const crewDeps = depsOf(setup);
  const result = createGame(
    {
      seed: 11,
      cards: [...DEFAULT_CARDS, wrecker, thunderball, low, high, scheme, BLANK],
      villainCardId: wrecker.id,
      villains: [
        { villainCardId: wrecker.id, encounterDeck: copies(BLANK.id, 6), signatureSideSchemeCardId: low.id },
        { villainCardId: thunderball.id, encounterDeck: copies(BLANK.id, 6), signatureSideSchemeCardId: high.id },
      ],
      mainSchemeCardId: scheme.id,
      encounterDeck: [],
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
    },
    crewDeps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, crewDeps).state;
}
