/**
 * Hidden piles (`GameState.hiddenPiles`, docs/phase7-wave9.md §3.29 (a)): cards no player may look at, kept by card id
 * outside every zone, and the cards that have come out of them faceup (`GameState.revealedPileCards`).
 *
 * The Agents of S.H.I.E.L.D. evidence envelopes. MC50 p. 5, "Preparing the Evidence": "1. Separate the nine evidence
 * cards (185–193) by their card backs into three sets of three cards. 2. Shuffle each set of three cards separately and
 * put one card from each set into the A.I.M. envelope **without looking at them**. 3. Shuffle the six remaining evidence
 * cards together and put them in the S.H.I.E.L.D. envelope **without looking at them**." MC50 p. 18: a standalone Baron
 * Zemo game follows those steps at setup, and "When the players gain an evidence card, they turn it faceup". MC50 p. 19,
 * "The Accusation": "the players take the evidence cards from the A.I.M. envelope".
 *
 * Three moves, each logged, none naming a card by title:
 * - `dealHiddenPiles` puts the piles together at random (`EffectSpec dealHiddenPiles`);
 * - `gainFromHiddenPile` turns some of a pile's cards faceup at random (`EffectSpec gainFromHiddenPile`);
 * - `revealHiddenPile` turns a whole pile faceup (`EffectSpec revealHiddenPile`, and the accusation of §3.29 (b)).
 *
 * Every random step is a draw on the game's seeded RNG (`GameState.rng`), as a deck shuffle is, so a replay of the
 * command log deals and gains the same cards.
 *
 * **One writer.** `placeHiddenPiles` is the only code that writes either field. A game whose envelopes come from
 * outside it (campaign mode, where they were filled when the campaign began and some cards were gained in earlier
 * scenarios) places them through the same function, before the scenario's own "prepare the evidence" resolves, which
 * then deals nothing (`GameEvent hiddenPilesDealt.kept`).
 */

import { EVIDENCE_KINDS, type CardId } from "@mc/content";
import { type Ctx, emit } from "../ctx.js";
import { nextInt, shuffle } from "../rng.js";
import type { EffectSpec } from "../spec.js";
import type { GameState } from "../state.js";

type DealHiddenPiles = Extract<EffectSpec, { kind: "dealHiddenPiles" }>;

/** The cards in a hidden pile, in the pile's order; none for a pile that was never prepared. Engine eyes only. */
export const hiddenPileOf = (state: GameState, pile: string): readonly CardId[] => state.hiddenPiles?.[pile] ?? [];

/** Whether a pile of this name has been prepared, empty or not. */
export const hiddenPileExists = (state: GameState, pile: string): boolean => state.hiddenPiles?.[pile] !== undefined;

/**
 * The cards that have come out of hidden piles faceup: out of `pile`, or out of every pile (in pile order, then the
 * order revealed) when none is named. Open information.
 */
export const revealedPileCardsOf = (state: GameState, pile?: string): readonly CardId[] =>
  pile === undefined ? Object.values(state.revealedPileCards ?? {}).flat() : (state.revealedPileCards?.[pile] ?? []);

/**
 * Sets hidden piles, and the cards already revealed out of them, exactly as given: each named pile is replaced, every
 * other pile is left alone. The single writer of `GameState.hiddenPiles` and `GameState.revealedPileCards`; emits
 * nothing, so its caller logs what it did in its own terms (sizes for a deal, card ids for a reveal).
 *
 * The seam for piles that are not dealt by the game itself: a campaign's envelopes are handed over as plain card ids
 * (`piles`) with the evidence gained so far (`revealed`).
 */
export function placeHiddenPiles(
  ctx: Ctx,
  piles: Readonly<Record<string, readonly CardId[]>>,
  revealed: Readonly<Record<string, readonly CardId[]>> = {},
): void {
  ctx.state = { ...ctx.state, hiddenPiles: { ...ctx.state.hiddenPiles, ...piles } };
  if (Object.keys(revealed).length > 0)
    ctx.state = { ...ctx.state, revealedPileCards: { ...ctx.state.revealedPileCards, ...revealed } };
}

/**
 * `EffectSpec dealHiddenPiles`: MC50 p. 5's three steps over the evidence cards of the encounter set `effect.from` in
 * the game's card pool. The cards are taken in card id order and the groups in the order the three kinds are listed
 * (`EVIDENCE_KINDS`), so the deal depends on the seed alone and not on the order a scenario listed its cards in.
 */
export function dealHiddenPiles(ctx: Ctx, effect: DealHiddenPiles): void {
  const names = [effect.onePerGroupTo, effect.restTo];
  const sizes = () => names.map((pile) => ({ pile, size: hiddenPileOf(ctx.state, pile).length }));
  if (names.some((pile) => hiddenPileExists(ctx.state, pile))) {
    emit(ctx, { type: "hiddenPilesDealt", from: effect.from, piles: sizes(), kept: true });
    return;
  }
  const cards = Object.values(ctx.state.cardPool)
    .flatMap((card) =>
      card.type === "evidence" && (card.encounterSetIds as readonly string[]).includes(effect.from) ? [card] : [],
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const one: CardId[] = [];
  const left: CardId[] = [];
  let rng = ctx.state.rng;
  for (const kind of EVIDENCE_KINDS) {
    const group = cards.filter((card) => card.evidence === kind).map((card) => card.id);
    const [shuffled, next] = shuffle(group, rng);
    rng = next;
    one.push(...shuffled.slice(0, 1));
    left.push(...shuffled.slice(1));
  }
  const [rest, next] = shuffle(left, rng);
  ctx.state = { ...ctx.state, rng: next };
  placeHiddenPiles(ctx, { [effect.onePerGroupTo]: one, [effect.restTo]: rest });
  emit(ctx, { type: "hiddenPilesDealt", from: effect.from, piles: sizes(), kept: false });
}

/** Moves `cardIds` out of `pile` and onto the end of the cards revealed out of it. */
function turnFaceup(ctx: Ctx, pile: string, cardIds: readonly CardId[]): void {
  const taken = new Set<CardId>(cardIds);
  placeHiddenPiles(
    ctx,
    { [pile]: hiddenPileOf(ctx.state, pile).filter((id) => !taken.has(id)) },
    cardIds.length > 0 ? { [pile]: [...revealedPileCardsOf(ctx.state, pile), ...cardIds] } : {},
  );
}

/**
 * `EffectSpec gainFromHiddenPile`: `count` cards of `pile` at random, without replacement, in the order drawn, or
 * every card left when fewer are there; they are faceup from here on. One draw on the seeded RNG per card (none for a
 * pile's last card, which is not a choice). Returns the cards gained.
 */
export function gainFromHiddenPile(ctx: Ctx, pile: string, count: number): readonly CardId[] {
  const left = [...hiddenPileOf(ctx.state, pile)];
  const gained: CardId[] = [];
  let rng = ctx.state.rng;
  for (let i = 0; i < count && left.length > 0; i++) {
    const [index, next] = nextInt(rng, left.length);
    rng = next;
    gained.push(left[index] as CardId);
    left.splice(index, 1);
  }
  ctx.state = { ...ctx.state, rng };
  // A pile nobody prepared stays unprepared: gaining from it is a no-op the log records.
  if (hiddenPileExists(ctx.state, pile)) turnFaceup(ctx, pile, gained);
  emit(ctx, {
    type: "hiddenPileCardsGained",
    pile,
    cardIds: gained,
    requested: Math.max(0, count),
    remaining: left.length,
  });
  return gained;
}

/**
 * `EffectSpec revealHiddenPile`: every card left in `pile` is turned faceup, in the pile's order. Returns them. The
 * accusation (docs/phase7-wave9.md §3.29 (b)) reveals the pile it reads through this.
 */
export function revealHiddenPile(ctx: Ctx, pile: string): readonly CardId[] {
  const cardIds = hiddenPileOf(ctx.state, pile);
  if (hiddenPileExists(ctx.state, pile)) turnFaceup(ctx, pile, cardIds);
  emit(ctx, { type: "hiddenPileRevealed", pile, cardIds });
  return cardIds;
}
