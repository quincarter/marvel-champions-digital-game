/**
 * docs/phase7-wave2.md §24: the three engine reads of the printed star icon (★), now that `@mc/content` records
 * `starIcon` on encounter-side cards. Synthetic cards throughout — engine code never names a card, and the card names
 * in the test titles only say which printed text each shape was checked against.
 *
 * Sources: RRG 1.8 "Boost, Boost Icon" (p. 11) — "If the boost field has a star icon, it indicates that the card has
 * a 'Boost' ability … A star icon is not itself considered a boost icon, and does not contribute to the villain's ATK
 * or SCH value"; "Star Icon" (p. 40); "Encounter Deck" (p. 17, the discard/reshuffle rule).
 */

import { flat, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import type { EffectSpec, ValueSpec } from "./spec.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import { matchesQuery } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubEvent, stubMainScheme, stubSideScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCards, newGame, RESOURCE, runWith, settle, withEncounterPiles } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const num = (value: number): ValueSpec => ({ kind: "const", value });
const bound = (name: string): ValueSpec => ({ kind: "var", name });
const play = (id: InstanceId, payment: readonly Payment[] = []): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment,
  attachToInstanceId: null,
});

const SCHEME = stubMainScheme({ id: "scheme", stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }] });
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0 }] });

// The four combinations of "prints boost pips" × "prints a star", which is the whole point: the two are independent
// printed facts (RRG 1.8 "Boost, Boost Icon", p. 11). 43 of the pool's 159 starred cards print both, and 116 print a
// star with no pips — so both combinations are real and neither number implies the other (docs/phase7-wave2.md §24).
const PIPS_AND_STAR = stubTreachery({ id: "pips-and-star", boostIcons: 2, starIcon: true });
const STAR_ONLY = stubTreachery({ id: "star-only", boostIcons: 0, starIcon: true });
const PIPS_ONLY = stubTreachery({ id: "pips-only", boostIcons: 2 });
const PLAIN = stubTreachery({ id: "plain", boostIcons: 0 });
/** The same field on the other schema carrier: `SideSchemeCard.starIcon` rather than `EncounterCardCommon.starIcon`. */
const STARRED_SIDE_SCHEME = stubSideScheme({ id: "starred-side-scheme", startingThreat: 3, boostIcons: 1, starIcon: true });
const STAR_CARDS: readonly AnyCard[] = [PIPS_AND_STAR, STAR_ONLY, PIPS_ONLY, PLAIN, STARRED_SIDE_SCHEME];

/** The encounter deck ordered exactly as listed, by instance, whatever the setup shuffle did. */
function arrange(state: GameState, order: readonly CardId[]): GameState {
  const deck = activeEncounterDeck(state).deck;
  const taken = new Set<InstanceId>();
  const ordered = order.map((card) => {
    const id = deck.find((candidate) => state.instances[candidate]?.cardId === card && !taken.has(candidate));
    if (!id) throw new Error(`fixture: no spare ${card} in the encounter deck`);
    taken.add(id);
    return id;
  });
  return withEncounterPiles(state, { deck: [...ordered, ...deck.filter((id) => !taken.has(id))] });
}

interface Trial {
  /** The effects the event under test resolves. */
  readonly effects: readonly EffectSpec[];
  /** The encounter deck's top cards, in order. */
  readonly top: readonly CardId[];
  /** Extra abilities to register (beyond the event's own). */
  readonly abilities?: readonly StubAbility[];
  /** Cards to add to the pool that are not in `STAR_CARDS`. */
  readonly extra?: readonly AnyCard[];
  /** The encounter deck's whole contents; defaults to `top` padded with plain cards. */
  readonly encounterDeck?: readonly CardId[];
  /** Leave only this many cards in the encounter deck, with the rest moved to its discard pile. */
  readonly split?: number;
}

/** Plays a 0-cost event carrying `effects` on the first player's turn and returns the settled state. */
function resolve({ effects, top, abilities = [], extra = [], encounterDeck, split }: Trial): GameState {
  const ability = stubAbility("trial.action", def({ trigger: { kind: "action" }, effects }));
  const EVENT = stubEvent({ id: "trial", cost: 0, abilities: [ability.ref] });
  const deps = depsOf(ability, ...abilities);
  const state = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [PLAIN, ...STAR_CARDS, ...extra, EVENT],
    deck: [...copies(EVENT.id, 4), ...copies(RESOURCE.id, 14)],
    encounterDeck: encounterDeck ?? [...top, ...copies(PLAIN.id, 20)],
    deps,
  });
  const arranged = arrange(state, top);
  const ordered = activeEncounterDeck(arranged).deck;
  const stacked =
    split === undefined ? arranged : withEncounterPiles(arranged, { deck: ordered.slice(0, split), discard: ordered.slice(split) });
  const given = giveCards(stacked, p1, EVENT.id);
  const [event] = given.ids;
  if (!event) throw new Error("fixture: the event was not dealt");
  return settle(runWith(deps, given.state, play(event)), undefined, deps);
}

const threat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const counter = (state: GameState, name: string): number =>
  mustInstance(state, mustPlayer(state, p1).identity.instanceId).counters[name] ?? 0;

// ---- §24.1 `<bind>.starIcons`: Slipping Sanity, end to end -----------------------------------------------------------

/**
 * "Discard the top 5 cards of the encounter deck. For each star icon (★) in the boost area discarded this way, place
 * 1 threat on the main scheme." (Slipping Sanity 15023, `scw`.)
 *
 * The whole sentence, driven as one effect list: a real discard of five off the top of the real encounter deck, and a
 * threat placement counting stars among exactly those five.
 */
const SANITY: readonly EffectSpec[] = [
  { kind: "discardEncounterCards", count: num(5), bind: "sanity" },
  { kind: "placeThreat", target: { kind: "mainScheme" }, amount: bound("sanity.starIcons") },
  // Not part of the card: the sibling total, recorded on the identity so each test can see both numbers at once.
  { kind: "addCounters", target: { kind: "identityOf", player: { kind: "controller" } }, counterType: "pips", amount: bound("sanity.boostIcons") },
];

describe("§24.1 `<bind>.starIcons` on `discardEncounterCards`", () => {
  it("places 1 threat per star among exactly the five cards discarded", () => {
    // Three starred cards in the top five; the sixth card is starred too and must not be counted.
    const state = resolve({ effects: SANITY, top: [PIPS_AND_STAR.id, STAR_ONLY.id, PIPS_ONLY.id, PLAIN.id, PIPS_AND_STAR.id, STAR_ONLY.id] });
    expect(threat(state)).toBe(3);
    expect(activeEncounterDeck(state).discard).toHaveLength(5);
  });

  it("reads the same field on a side scheme", () => {
    const state = resolve({ effects: SANITY, top: [STARRED_SIDE_SCHEME.id, PLAIN.id, PLAIN.id, PLAIN.id, PLAIN.id] });
    expect(threat(state)).toBe(1);
  });

  it("places nothing when no discarded card prints a star, however many boost icons they print", () => {
    const state = resolve({ effects: SANITY, top: copies(PIPS_ONLY.id, 5) });
    expect(threat(state)).toBe(0);
    expect(counter(state, "pips")).toBe(10);
  });

  it("counts only the cards it reached when the deck empties mid-discard (RRG 1.8 'Encounter Deck', p. 17)", () => {
    // Two cards left in the deck, both starred, and a discard pile behind them holding two more starred cards: the
    // effect stops at two rather than continuing into the newly shuffled deck, so it counts two stars, not four.
    const state = resolve({
      effects: SANITY,
      top: [PIPS_AND_STAR.id, STAR_ONLY.id, PIPS_AND_STAR.id, STAR_ONLY.id],
      encounterDeck: [...copies(PIPS_AND_STAR.id, 2), ...copies(STAR_ONLY.id, 2)],
      split: 2,
    });
    expect(threat(state)).toBe(2);
    expect(activeEncounterDeck(state).deck).toEqual([]);
  });
});

// ---- §24.2 a star is not a boost icon --------------------------------------------------------------------------------

/**
 * RRG 1.8 "Boost, Boost Icon" (p. 11): "A star icon is not itself considered a boost icon, and does not contribute to
 * the villain's ATK or SCH value." The two totals are independent counts over the same pile, and a card printing both
 * pips and a star contributes to both — the case 134 of the pool's 159 starred cards are in.
 */
describe("§24.2 `<bind>.starIcons` and `<bind>.boostIcons` are independent over the same pile", () => {
  // The both-pips-and-a-star case: 43 cards in the pool (e.g. Hired Gun 02007, 2 pips + a star).
  it("counts a card with both pips and a star in both totals", () => {
    const state = resolve({ effects: SANITY, top: copies(PIPS_AND_STAR.id, 5) });
    // Five cards, each printing two pips and one star.
    expect(counter(state, "pips")).toBe(10);
    expect(threat(state)).toBe(5);
  });

  it("counts a star with no pips as 1 star and 0 boost icons, and pips with no star as the reverse", () => {
    const stars = resolve({ effects: SANITY, top: copies(STAR_ONLY.id, 5) });
    expect(threat(stars)).toBe(5);
    expect(counter(stars, "pips")).toBe(0);

    const pips = resolve({ effects: SANITY, top: copies(PIPS_ONLY.id, 5) });
    expect(threat(pips)).toBe(0);
    expect(counter(pips, "pips")).toBe(10);
  });

  it("keeps the two totals apart over a mixed pile", () => {
    const state = resolve({ effects: SANITY, top: [PIPS_AND_STAR.id, STAR_ONLY.id, PIPS_ONLY.id, PLAIN.id, PIPS_AND_STAR.id] });
    // Stars: pips-and-star ×2, star-only ×1 → 3. Pips: 2 + 0 + 2 + 0 + 2 → 6. Neither number is derivable from the
    // other, which is exactly why `starIcons` is its own total.
    expect(threat(state)).toBe(3);
    expect(counter(state, "pips")).toBe(6);
  });
});

// ---- §24.3 `ValueSpec starIcons` over any ref ------------------------------------------------------------------------

/**
 * The same fact as a `ValueSpec` rather than a bind total, so it can be read over a slot a *different* effect filled
 * — and read wherever the cards now are, which for a discard pile is out of play. The sibling of
 * `totalPrintedResources`.
 */
describe("§24.3 `ValueSpec starIcons` counts a ref's cards wherever they are", () => {
  it("counts the stars on cards a bind names, from the discard pile", () => {
    const state = resolve({
      effects: [
        { kind: "discardEncounterCards", count: num(3), bind: "pile" },
        { kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "starIcons", cards: { kind: "slot", slot: "pile" } } },
      ],
      top: [PIPS_AND_STAR.id, PLAIN.id, STAR_ONLY.id],
    });
    expect(threat(state)).toBe(2);
  });

  it("is 0 over an empty ref, and over cards that print no star", () => {
    const empty = resolve({
      effects: [
        { kind: "discardEncounterCards", count: num(0), bind: "pile" },
        { kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "starIcons", cards: { kind: "slot", slot: "pile" } } },
      ],
      top: [PIPS_AND_STAR.id],
    });
    expect(threat(empty)).toBe(0);

    const plain = resolve({
      effects: [
        { kind: "discardEncounterCards", count: num(3), bind: "pile" },
        { kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "starIcons", cards: { kind: "slot", slot: "pile" } } },
      ],
      top: copies(PLAIN.id, 3),
    });
    expect(threat(plain)).toBe(0);
  });
});

// ---- §24.4 `TargetQuery.starIcon` -------------------------------------------------------------------------------------

/**
 * "Response: After Longshot attacks a non-ELITE minion, discard the top card of the encounter deck. If that card has
 * a star icon (★) in the boost area, defeat the attacked minion." (Longshot 35033, `wolv`.)
 *
 * The same printed fact as a yes/no. The consequence here is a counter rather than the printed "defeat the attacked
 * minion", which is ordinary `defeatCharacter` and not what this section is about; what is pinned is that
 * `refMatches` + `{ starIcon: true }` reads the discarded card correctly from the discard pile.
 */
describe("§24.4 `TargetQuery.starIcon` as a yes/no on one card", () => {
  const longshot = (): readonly EffectSpec[] => [
    { kind: "discardEncounterCards", count: num(1), bind: "flip" },
    {
      kind: "if",
      condition: { kind: "refMatches", ref: { kind: "slot", slot: "flip" }, query: { starIcon: true }, anywhere: true },
      then: [{ kind: "addCounters", target: { kind: "identityOf", player: { kind: "controller" } }, counterType: "defeated", amount: num(1) }],
    },
  ];

  it("fires on a starred card, whether or not it prints boost icons", () => {
    expect(counter(resolve({ effects: longshot(), top: [PIPS_AND_STAR.id] }), "defeated")).toBe(1);
    expect(counter(resolve({ effects: longshot(), top: [STAR_ONLY.id] }), "defeated")).toBe(1);
  });

  it("does not fire on a card that prints boost icons but no star", () => {
    expect(counter(resolve({ effects: longshot(), top: [PIPS_ONLY.id] }), "defeated")).toBe(0);
    expect(counter(resolve({ effects: longshot(), top: [PLAIN.id] }), "defeated")).toBe(0);
  });

  it("matches as a plain query clause, in either direction, on cards still in the encounter deck", () => {
    const state = resolve({ effects: [], top: [PIPS_AND_STAR.id, PIPS_ONLY.id, PLAIN.id] });
    const deps = depsOf();
    const context = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps };
    const instanceOf = (card: CardId): InstanceId => {
      const found = Object.values(state.instances).find((i) => i.cardId === card);
      if (!found) throw new Error(`no ${card}`);
      return found.instanceId;
    };
    expect(matchesQuery(state, instanceOf(PIPS_AND_STAR.id), { starIcon: true }, context)).toBe(true);
    expect(matchesQuery(state, instanceOf(PIPS_AND_STAR.id), { starIcon: false }, context)).toBe(false);
    expect(matchesQuery(state, instanceOf(PIPS_ONLY.id), { starIcon: true }, context)).toBe(false);
    // A card with no boost area at all — any player card — has no star, so it never matches `true`.
    const hand = mustPlayer(state, p1).hand[0];
    if (!hand) throw new Error("fixture: empty hand");
    expect(matchesQuery(state, hand, { starIcon: true }, context)).toBe(false);
  });
});

// ---- §24.5 printed data, never the ability registry -------------------------------------------------------------------

/**
 * The reason §18.6 refused to derive this from "does the card carry a `boost`-triggered ability?": that derivation
 * reads `deps.abilities`, so an unscripted Boost ability would count zero stars and a scripter un-skipping an
 * unrelated card would silently change how much threat Slipping Sanity places. Both halves are pinned here.
 */
describe("§24.5 the star is read from printed data, not from what has been scripted", () => {
  /** Printed with a star; its Boost ability is not in the registry at all, as an unscripted card's would not be. */
  const UNSCRIPTED = stubTreachery({ id: "unscripted-star", boostIcons: 1, starIcon: true });
  /** The inverse: a scripted `boost` ability on a card whose printed boost area has no star. */
  const boostAbility = stubAbility("miscounted.boost", def({ trigger: { kind: "boost" }, effects: [{ kind: "gainSurge" }] }));
  const MISCOUNTED = stubTreachery({ id: "miscounted", boostIcons: 1, abilities: [boostAbility.ref] });

  it("counts a starred card whose Boost ability is unscripted", () => {
    const state = resolve({ effects: SANITY, top: copies(UNSCRIPTED.id, 5), extra: [UNSCRIPTED] });
    expect(threat(state)).toBe(5);
  });

  it("does not count a card that carries a scripted Boost ability but prints no star", () => {
    const state = resolve({ effects: SANITY, top: copies(MISCOUNTED.id, 5), extra: [MISCOUNTED], abilities: [boostAbility] });
    expect(threat(state)).toBe(0);
    expect(counter(state, "pips")).toBe(5);
  });
});
