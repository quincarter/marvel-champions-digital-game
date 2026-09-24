/**
 * The Market (MC16 p. 5, `packages/cards/src/campaigns/gmw.ts`'s `marketShoppingSetup`): a between-games shopping
 * trip built from `choose`/`spend`/`grantCard` triples, one price tier's remaining cards at a time.
 *
 * **Detected by shape, not by `campaignId`.** `isMarketPendingChoice` calls a `CampaignPendingChoice` a Market
 * purchase when every option it offers prices in the campaign's currency field (`PlayerCardCommon.unitCost`) — a
 * spend/grant purchase over a currency field, exactly the shape CLAUDE.md asks this screen to key off. A later
 * campaign that reuses the same `choose`/`spend`/`grantCard`-over-`unitCost` shape gets this screen for free,
 * without this file ever naming GMW.
 *
 * **The runner only ever asks one price tier at a time, but the shelf sells the whole stall.** `marketShoppingSetup`
 * asks tier 1's up-to-4 slots before it ever asks tier 2's, so `CampaignPendingChoice.options` — narrowed by
 * `resolveChoiceSource`'s `campaignSet`/`unitCostExactly`, `packages/engine/src/campaign/ops.ts` — only ever shows
 * the current tier. A player standing in front of a real market stall with 5 units in their pocket does not need to
 * be told "come back later" for a 2-unit card just because the shopkeeper is working through the 1-unit bin first —
 * so this view widens "clickable" to every catalog card the active seat can currently afford, not just
 * `pending.options`. `marketViewOf` still never invents a legal move: affordability is the same running-balance
 * arithmetic the engine itself would apply (`fieldAtLeast units tier`, checked against `before` minus every
 * committed purchase this visit minus the seat's own uncommitted cart), and nothing is ever granted client-side —
 * see "Checkout" below.
 *
 * **The cart, and checkout.** Because the engine only ever asks for the *current* tier, a seat's shopping list has
 * to be held somewhere until the runner is ready to hear about each item — that somewhere is a client-side cart
 * (`MarketCartItem[]`, held by `scenes/campaign/market.ts`, never persisted, never sent to the engine as one of its
 * own concepts). Adding or removing a card from the cart calls this model's `canAddToCart`/`cartTotalOf` and never
 * touches `CampaignChoiceAnswer` at all. "Done shopping" is what turns the cart into engine answers: the scene
 * drives the runner's own tier-by-tier questions, and for each one it offers, answers with a cart card of that
 * exact price if the cart still holds one (removing it from the cart), or declines otherwise. Because the cart never
 * lets its running total exceed the seat's `before` balance (`canAddToCart`), every tier-ascending prefix of the
 * cart's total is provably affordable at the point the runner asks for it — the engine's own `fieldAtLeast` guard
 * cannot fail partway through a checkout. `marketShoppingSetup`'s 4-slots-per-tier cap is enforced here too
 * (`MARKET_TIER_CAP`), so the cart can never ask the runner for a 5th card of the same price.
 *
 * A seat's cart only exists while that seat is the runner's active `eachSeat` chooser; once checkout empties it (or
 * moves the runner on to the next seat), a fresh empty cart starts for whoever the runner asks next — the physical
 * stall closes out one shopper's whole basket before ringing up the next (MC16 p. 5's own "repeat this process as
 * many times as you wish").
 */
import type { AnyCard, CardId } from "@mc/content";
import type { CampaignChoiceAnswer, CampaignPendingChoice, LogValue } from "@mc/engine";

export type CardOf = (cardId: string) => AnyCard | undefined;

/**
 * `unitCost` lives on `PlayerCardCommon` only — most of `AnyCard`'s union (every encounter card type) has no such
 * field at all, so a plain `card.unitCost` does not typecheck across the union. This is the one safe read.
 */
const unitCostOf = (card: AnyCard | undefined): number | undefined =>
  (card as { readonly unitCost?: number } | undefined)?.unitCost;

/** A campaign seat, read generically — only the fields this view needs from `CampaignRecord.seats`. */
export interface MarketSeatSource {
  readonly seatNumber: number;
  readonly grants: readonly { readonly cardId: CardId }[];
  readonly fields: Readonly<Record<string, LogValue>>;
}

const numberField = (value: LogValue | undefined): number => (value?.kind === "number" ? value.value : 0);

/**
 * A spend/grant purchase over a currency field: every option this choice offers prices in `unitCost`. `random`
 * (a yes/no draw, not a card pick), a `group`/`firstPlayer` chooser (a Market ask is always `eachSeat`), and an
 * empty options list (nothing left to show) are never Market-shaped.
 */
export function isMarketPendingChoice(pending: CampaignPendingChoice, cardOf: CardOf): boolean {
  if (pending.random || pending.chooser !== "eachSeat" || pending.seatNumber === null) return false;
  if (pending.options.length === 0) return false;
  return pending.options.every((id) => unitCostOf(cardOf(id)) !== undefined);
}

/** Every pool card priced in the campaign's currency field, cheapest first (ties broken by id — print order). */
export function marketCatalogOf(cards: readonly AnyCard[]): readonly AnyCard[] {
  return cards
    .filter((card) => unitCostOf(card) !== undefined)
    .slice()
    .sort((a, b) => (unitCostOf(a) as number) - (unitCostOf(b) as number) || String(a.id).localeCompare(String(b.id)));
}

export interface MarketWalletRow {
  readonly seatNumber: number;
  readonly heroName: string;
  /** Units this seat held when this Market visit began (the log's own value — nothing has been spent yet). */
  readonly before: number;
  /** `before` minus every purchase this seat has made so far this visit. */
  readonly after: number;
  /** Whether the runner is asking *this* seat's next question right now. */
  readonly active: boolean;
}

/** `marketShoppingSetup`'s own printed cap: 4 physical copies per price tier (16150–16177, 4 cards × 7 tiers). */
export const MARKET_TIER_CAP = 4;

/** One card the active seat has put in their basket, not yet turned into an engine answer. */
export interface MarketCartItem {
  readonly cardId: string;
  readonly price: number;
}

/** The active seat's cart, summed. */
export function cartTotalOf(cart: readonly MarketCartItem[]): number {
  return cart.reduce((sum, item) => sum + item.price, 0);
}

/** How many of the cart's cards already sit at this price tier — the 4-per-tier cap this checks against. */
export function cartTierCountOf(cart: readonly MarketCartItem[], price: number): number {
  return cart.filter((item) => item.price === price).length;
}

/**
 * Whether the active seat could add one more `price`-unit card to `cart` right now: the same running-balance
 * arithmetic `marketShoppingSetup`'s own `fieldAtLeast` guard applies, plus the 4-per-tier cap no single `choose`
 * slot can exceed.
 */
export function canAddToCart(price: number, cart: readonly MarketCartItem[], remainingBalance: number): boolean {
  return price <= remainingBalance - cartTotalOf(cart) && cartTierCountOf(cart, price) < MARKET_TIER_CAP;
}

/** `market-<tier>-<copy>` (`marketShoppingSetup`, `packages/cards/src/campaigns/gmw.ts`) → the tier, or `null`. */
export function marketSlotTier(slot: string): number | null {
  const match = /^market-(\d+)-\d+$/.exec(slot);
  return match ? Number(match[1]) : null;
}

export interface MarketCheckoutStep {
  readonly answer: CampaignChoiceAnswer;
  readonly remainingCart: readonly MarketCartItem[];
}

/**
 * Turns one of the runner's own tier-by-tier asks into an answer: a cart card of that exact price if the cart still
 * holds one (removed from `remainingCart`), or a decline otherwise. This is the whole of checkout — see the file
 * header's "The cart, and checkout" — and is deliberately the one function both the scene and this file's own tests
 * drive the real runner with, so a test that exercises it is exercising exactly what the scene does.
 */
export function answerMarketAsk(pending: CampaignPendingChoice, cart: readonly MarketCartItem[]): MarketCheckoutStep {
  const tier = marketSlotTier(pending.slot);
  const index = tier === null ? -1 : cart.findIndex((item) => item.price === tier);
  const picked = index >= 0 ? [cart[index]!.cardId] : [];
  const remainingCart = index >= 0 ? [...cart.slice(0, index), ...cart.slice(index + 1)] : cart;
  return {
    answer: { instructionId: pending.instructionId, slot: pending.slot, seatNumber: pending.seatNumber, picked },
    remainingCart,
  };
}

export type MarketCardState =
  /** Affordable right now — clicking adds it to the active seat's cart. */
  | { readonly kind: "live" }
  /** In the active seat's own cart this visit, not yet checked out — clicking removes it. */
  | { readonly kind: "inCart" }
  /** Already granted to some seat — a prior visit's purchase, or a purchase checked out just now. */
  | { readonly kind: "taken"; readonly heroName: string }
  /** Priced above the active seat's remaining balance (after the cart's own running total). `need` is the price. */
  | { readonly kind: "unaffordable"; readonly need: number }
  /** Affordable, but this price tier's 4 physical copies are already spoken for by the active seat's own cart. */
  | { readonly kind: "capped" };

export interface MarketShelfCard {
  readonly cardId: CardId;
  readonly name: string;
  readonly typeLabel: string;
  readonly price: number;
  readonly detail: string;
  readonly state: MarketCardState;
}

export interface MarketReceiptLine {
  readonly heroName: string;
  readonly cardName: string;
  readonly price: number;
  /** Still in the active seat's cart — "Done shopping" hasn't turned it into a real grant yet. */
  readonly inCart: boolean;
}

export interface MarketView {
  readonly activeSeatNumber: number;
  readonly wallets: readonly MarketWalletRow[];
  /** Up to `pageSize` cards: the live options first, then the rest of the catalog cheapest-first. */
  readonly shelf: readonly MarketShelfCard[];
  /** How many more catalog cards exist beyond `shelf` ("See the full stall"). */
  readonly overflowCount: number;
  /** Every purchase checked out so far this visit, across every seat, plus the active seat's own pending cart. */
  readonly receipt: readonly MarketReceiptLine[];
  readonly leftoverBySeat: readonly { readonly heroName: string; readonly units: number }[];
  /** The printed sentence's own citation (MC16 p. 5) — read off the pending choice, never hardcoded here. */
  readonly citation: string;
  readonly promptText: string;
}

interface SessionPurchase {
  readonly seatNumber: number;
  readonly cardId: string;
  readonly price: number;
}

/** This visit's own answers so far, decoded back into (seat, card, price) — the running math the log hasn't seen yet. */
function purchasesFromAnswers(
  answersThisVisit: readonly CampaignChoiceAnswer[],
  cardOf: CardOf,
): readonly SessionPurchase[] {
  const purchases: SessionPurchase[] = [];
  for (const answer of answersThisVisit) {
    if (!answer.slot.startsWith("market-") || answer.picked.length === 0 || answer.seatNumber === null) continue;
    const card = cardOf(answer.picked[0] as string);
    const price = unitCostOf(card);
    if (price === undefined) continue;
    purchases.push({ seatNumber: answer.seatNumber, cardId: answer.picked[0] as string, price });
  }
  return purchases;
}

/**
 * Builds the whole screen's data from the pending choice, the answers submitted so far this visit, and the active
 * seat's own uncommitted cart — nothing here re-derives a legality check the engine already made for a *committed*
 * purchase (`record.seats[].grants`, `answersThisVisit`); the cart's own affordability is this file's
 * `canAddToCart`, applied identically here and by the scene before it ever lets a card be added.
 */
export function marketViewOf(
  seats: readonly MarketSeatSource[],
  pending: CampaignPendingChoice,
  answersThisVisit: readonly CampaignChoiceAnswer[],
  cart: readonly MarketCartItem[],
  catalog: readonly AnyCard[],
  cardOf: CardOf,
  heroNameOf: (seatNumber: number) => string,
  pageSize = 5,
): MarketView {
  const activeSeatNumber = pending.seatNumber ?? seats[0]?.seatNumber ?? 1;
  const purchases = purchasesFromAnswers(answersThisVisit, cardOf);
  const cartInIds = new Set(cart.map((item) => item.cardId));
  const cartTotal = cartTotalOf(cart);

  const wallets: MarketWalletRow[] = seats.map((seat) => {
    const before = numberField(seat.fields.units);
    const spent = purchases
      .filter((purchase) => purchase.seatNumber === seat.seatNumber)
      .reduce((sum, purchase) => sum + purchase.price, 0);
    const cartSpend = seat.seatNumber === activeSeatNumber ? cartTotal : 0;
    return {
      seatNumber: seat.seatNumber,
      heroName: heroNameOf(seat.seatNumber),
      before,
      after: before - spent - cartSpend,
      active: seat.seatNumber === activeSeatNumber,
    };
  });
  const activeSpent = purchases
    .filter((purchase) => purchase.seatNumber === activeSeatNumber)
    .reduce((sum, purchase) => sum + purchase.price, 0);
  const activeBeforeCart = (wallets.find((wallet) => wallet.active)?.before ?? 0) - activeSpent;
  // Who owns what: pre-existing campaign grants (a prior issue's Market, or another seat's earlier turn this same
  // node) first, then this visit's own committed purchases layered on top. The active seat's *cart* is deliberately
  // not folded in here — it is not owned by anyone until checkout turns it into a real answer.
  const ownedBy = new Map<string, number>();
  for (const seat of seats) for (const grant of seat.grants) ownedBy.set(grant.cardId as string, seat.seatNumber);
  for (const purchase of purchases) ownedBy.set(purchase.cardId, purchase.seatNumber);

  // The whole catalog, cheapest first (`marketCatalogOf`'s own order) — the shelf sells every tier at once, not
  // just the runner's current ask (see the file header).
  const ordered = catalog.map((card) => card.id as string);
  const pageIds = ordered.slice(0, pageSize);
  const overflowCount = Math.max(0, ordered.length - pageIds.length);

  const shelf: MarketShelfCard[] = pageIds.map((id) => {
    const card = cardOf(id);
    const price = unitCostOf(card) ?? 0;
    const owner = ownedBy.get(id);
    const state: MarketCardState =
      owner !== undefined
        ? { kind: "taken", heroName: heroNameOf(owner) }
        : cartInIds.has(id)
          ? { kind: "inCart" }
          : canAddToCart(price, cart, activeBeforeCart)
            ? { kind: "live" }
            : cartTierCountOf(cart, price) >= MARKET_TIER_CAP && price <= activeBeforeCart - cartTotal
              ? { kind: "capped" }
              : { kind: "unaffordable", need: price };
    return {
      cardId: id as CardId,
      name: card?.name ?? id,
      typeLabel: (card?.type ?? "card").toUpperCase(),
      price,
      detail: detailOf(card),
      state,
    };
  });

  const receipt: MarketReceiptLine[] = [
    ...purchases.map((purchase) => ({
      heroName: heroNameOf(purchase.seatNumber),
      cardName: cardOf(purchase.cardId)?.name ?? purchase.cardId,
      price: purchase.price,
      inCart: false,
    })),
    ...cart.map((item) => ({
      heroName: heroNameOf(activeSeatNumber),
      cardName: cardOf(item.cardId)?.name ?? item.cardId,
      price: item.price,
      inCart: true,
    })),
  ];

  return {
    activeSeatNumber,
    wallets,
    shelf,
    overflowCount,
    receipt,
    leftoverBySeat: wallets.map((wallet) => ({ heroName: wallet.heroName, units: wallet.after })),
    citation: pending.citation,
    promptText: pending.text,
  };
}

/** A card's one-line shelf blurb: the printed text, minus its own "Unit Cost N." sentence (that's the price tag). */
function detailOf(card: AnyCard | undefined): string {
  if (!card || !("text" in card)) return "";
  const text = (card as { readonly text?: { readonly current?: string } }).text?.current ?? "";
  return text.replace(/^unit cost \d+\.\s*/i, "").trim();
}
