/**
 * Rules audit chunk 40 (FFG rulings post-RRG 1.5, Jan 25 - May 10, 2024), engine-level proofs. Each `it.fails` marks a
 * place the engine does something an official source forbids, and flips to a failure when it is fixed.
 */
import {
  abilityId,
  flat,
  type AbilityReference,
  type AnyCard,
  type CoreAspect,
  type DeckContents,
  type EventCard,
  type HeroIdentityCard,
} from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import type { Command } from "../commands.js";
import { validateDeck } from "../deck.js";
import { playerId } from "../ids.js";
import { activeEncounterDeck, activeVillain } from "../query.js";
import type { EffectSpec } from "../spec.js";
import type { GameEvent } from "../events.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { runCommands } from "../testing/drive.js";
import {
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "../testing/fixtures.js";
import { DEFAULT_DECK, giveCard, newGame, withEncounterPiles } from "../testing/scenario.js";

const _ref = (id: string): AbilityReference => ({ id: abilityId(id) });
void _ref;

// ---- Ruling 153, Mar 22, 2024: Spider-Woman's identity-specific cards count toward their printed aspect -----------

const SW = "sw";
const spiderWoman: HeroIdentityCard = {
  ...stubIdentity({
    id: SW,
    name: "Spider-Woman",
    hp: 11,
    atk: 1,
    thw: 1,
    def: 1,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
  }),
  deckbuilding: { aspectCount: 2, equalCardsPerAspect: true },
};
const signature = (id: string, quantity: number, printedAspect?: CoreAspect): EventCard => ({
  ...stubEvent({ id, cost: 1, aspect: `hero:${SW}` }),
  quantityInSet: quantity,
  ...(printedAspect ? { printedAspect } : {}),
});
/** Her set as printed for Leadership only: Pheromones (Leadership) x2 plus 13 plain signature cards. */
const SIGNATURE: readonly EventCard[] = [
  signature("pheromones", 2, "leadership"),
  signature("glide", 3),
  signature("finesse", 2),
  signature("apartment", 1),
  signature("a", 3),
  signature("b", 3),
  signature("c", 1),
];
const aspectCards = (aspect: CoreAspect, n: number): readonly EventCard[] =>
  Array.from({ length: n }, (_, i) => stubEvent({ id: `${aspect}-${i}`, cost: 1, aspect }));
const LEADERSHIP = aspectCards("leadership", 5);
const POOL = aspectCards("pool", 5);
const BASIC = stubEvent({ id: "basic-0", cost: 1, aspect: "basic" });
const SW_POOL: readonly AnyCard[] = [spiderWoman, ...SIGNATURE, ...LEADERSHIP, ...POOL, BASIC];
const take = (cards: readonly EventCard[], n: number) =>
  cards.flatMap((card, i) => {
    const quantity = Math.max(0, Math.min(3, n - 3 * i));
    return quantity > 0 ? [{ cardId: card.id, quantity }] : [];
  });

describe("Ruling 153, Mar 22, 2024: with 'Pool, Spider-Woman's Pheromones counts as a Leadership card in the equal split", () => {
  const deck = (leadership: number, pool: number): DeckContents => ({
    identityCardId: spiderWoman.id,
    aspects: ["leadership", "pool"],
    cards: [
      ...SIGNATURE.map((card) => ({ cardId: card.id, quantity: card.quantityInSet })),
      ...take(LEADERSHIP, leadership),
      ...take(POOL, pool),
      { cardId: BASIC.id, quantity: 3 },
    ],
  });
  it("10 Leadership (plus the 2 Pheromones) and 12 'Pool cards is a legal deck", () => {
    const verdict = validateDeck(deck(10, 12), SW_POOL);
    // Pheromones counts toward Leadership, so 10 + 2 Leadership vs 12 'Pool is equal (ruling 153, Mar 22, 2024).
    const codes = verdict.ok ? [] : verdict.problems.map((p) => p.code);
    expect(codes).toEqual([]);
  });
});

// ---- Ruling 173, May 10, 2024: canceling boost icons does not cancel icons a Boost ability adds --------------------

const p1 = playerId("p1");

const VILLAIN = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(50), acceleration: flat(0) }],
});
/** Time-Travel Tactics' shape: 1 printed boost icon and "[star] Boost: this card gains 2 boost icons". */
const GAIN_BOOST = stubAbility("gain.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "adjustBoostCount", delta: { kind: "const", value: 2 } } as EffectSpec],
});
const GAIN = stubTreachery({ id: "gain", boostIcons: 1, abilities: [GAIN_BOOST.ref] });
const ZERO = stubTreachery({ id: "zero", boostIcons: 0 });
/** Attacrobatics' shape. */
const ACRO_INTERRUPT = stubAbility("acro.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "boostCardTurnedFaceup", activation: "attack", eventAtLeast: { boostIcons: 1 } },
  },
  effects: [{ kind: "cancelBoostIcons", bind: "cancelled" }],
});
const ACRO = stubSupport({ id: "acro", cost: 0, abilities: [ACRO_INTERRUPT.ref] });
const deps: EngineDeps = depsOf(GAIN_BOOST, ACRO_INTERRUPT);

function boostGame(): GameState {
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [GAIN, ZERO, ACRO],
    encounterDeck: [GAIN.id, ...Array.from({ length: 12 }, () => ZERO.id)],
    deck: [...DEFAULT_DECK, ACRO.id],
    deps,
  });
  const deck = activeEncounterDeck(start).deck;
  const top = deck.find((id) => start.instances[id]?.cardId === GAIN.id)!;
  let state = withEncounterPiles(start, { deck: [top, ...deck.filter((id) => id !== top)] });
  const given = giveCard(state, p1, ACRO.id);
  state = runCommands(given.state, deps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  }).state;
  return state;
}

describe("Ruling 173, May 10, 2024: boost icons added by a Boost ability (step 3b) are not canceled by a step 3a cancel", () => {
  it.fails("Attacrobatics cancels the printed icon; the 2 icons its Boost ability adds still count", () => {
    const toHero: Command = { type: "changeForm", playerId: p1 };
    const endTurn: Command = { type: "endTurn", playerId: p1 };
    const { state, events } = runCommands(boostGame(), deps, toHero, endTurn);
    const attacks = events.filter(
      (e): e is Extract<GameEvent, { type: "attackResolved" }> =>
        e.type === "attackResolved" && e.enemyInstanceId === activeVillain(state).instanceId,
    );
    expect(events.some((e) => e.type === "boostCancelled" && e.scope === "icons")).toBe(true);
    // Actual: boostIcons 0 (the Boost ability's +2 is zeroed with the printed icon).
    expect(attacks[0]).toEqual(expect.objectContaining({ boostIcons: 2 }));
  });
});
