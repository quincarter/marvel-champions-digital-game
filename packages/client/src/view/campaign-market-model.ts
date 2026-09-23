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
 * The runner only ever hands back the *current* tier's remaining options (`CampaignPendingChoice.options` —
 * `resolveChoiceSource`'s `campaignSet`/`unitCostExactly` narrowing, `packages/engine/src/campaign/ops.ts`); this
 * view widens that to the whole known catalog (every pool card with a `unitCost`) so the shelf reads like the
 * physical stall — taken cards and not-yet-reached tiers included — while only the engine's own live options are
 * ever clickable. `marketViewOf` never invents a legal move: `shelf[].state.kind === "live"` is exactly
 * `pending.options`, nothing guessed.
 *
 * **One purchase at a time.** Each `choose` in `marketShoppingSetup` offers a single pick (`count: 1`) over one
 * price tier's remaining cards; buying one re-enters the runner immediately (`campaign-service.ts`'s own doc
 * comment: "the runner asks one choice at a time and re-runs from the top on every answer"). There is no
 * multi-select "cart" the runner holds — the screen calling this model answers one `choose` per click, and
 * "Done shopping" (`scenes/campaign/market.ts`) declines the *current* one rather than closing every remaining
 * tier at once, so a seat can skip a cheap tier to reach a pricier item without losing the chance to come back to
 * something in between (MC16 p. 5's own "repeat this process as many times as you wish").
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

export type MarketCardState =
  /** One of the engine's own current options — clickable. */
  | { readonly kind: "live" }
  /** Bought by the active seat this same visit (this session's own answers), not a purchase from a prior issue. */
  | { readonly kind: "inCart" }
  /** Already granted to some seat — a prior visit's purchase, or another seat's pick just now. */
  | { readonly kind: "taken"; readonly heroName: string }
  /** Priced above the active seat's current running balance. `need` is the card's own price. */
  | { readonly kind: "unaffordable"; readonly need: number };

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
}

export interface MarketView {
  readonly activeSeatNumber: number;
  readonly wallets: readonly MarketWalletRow[];
  /** Up to `pageSize` cards: the live options first, then the rest of the catalog cheapest-first. */
  readonly shelf: readonly MarketShelfCard[];
  /** How many more catalog cards exist beyond `shelf` ("See the full stall"). */
  readonly overflowCount: number;
  /** Every purchase made so far this visit, across every seat, in the order they were bought. */
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
 * Builds the whole screen's data from the pending choice and the answers submitted so far this visit — nothing
 * here re-derives a legality check the engine already made; `shelf` just labels what `pending.options`,
 * `record.seats[].grants` and this visit's own purchases already say.
 */
export function marketViewOf(
  seats: readonly MarketSeatSource[],
  pending: CampaignPendingChoice,
  answersThisVisit: readonly CampaignChoiceAnswer[],
  catalog: readonly AnyCard[],
  cardOf: CardOf,
  heroNameOf: (seatNumber: number) => string,
  pageSize = 5,
): MarketView {
  const activeSeatNumber = pending.seatNumber ?? seats[0]?.seatNumber ?? 1;
  const purchases = purchasesFromAnswers(answersThisVisit, cardOf);

  const wallets: MarketWalletRow[] = seats.map((seat) => {
    const before = numberField(seat.fields.units);
    const spent = purchases
      .filter((purchase) => purchase.seatNumber === seat.seatNumber)
      .reduce((sum, purchase) => sum + purchase.price, 0);
    return {
      seatNumber: seat.seatNumber,
      heroName: heroNameOf(seat.seatNumber),
      before,
      after: before - spent,
      active: seat.seatNumber === activeSeatNumber,
    };
  });
  // Who owns what: pre-existing campaign grants (a prior issue's Market, or another seat's earlier turn this same
  // node) first, then this visit's own purchases layered on top (a card just bought this visit is never stale).
  const ownedBy = new Map<string, number>();
  for (const seat of seats) for (const grant of seat.grants) ownedBy.set(grant.cardId as string, seat.seatNumber);
  for (const purchase of purchases) ownedBy.set(purchase.cardId, purchase.seatNumber);

  const liveIds = new Set(pending.options);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of [...pending.options, ...catalog.map((card) => card.id as string)]) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  const pageIds = ordered.slice(0, pageSize);
  const overflowCount = Math.max(0, ordered.length - pageIds.length);

  const boughtThisVisitByActive = new Set(
    purchases.filter((purchase) => purchase.seatNumber === activeSeatNumber).map((purchase) => purchase.cardId),
  );

  const shelf: MarketShelfCard[] = pageIds.map((id) => {
    const card = cardOf(id);
    const price = unitCostOf(card) ?? 0;
    const owner = ownedBy.get(id);
    const state: MarketCardState =
      owner !== undefined
        ? owner === activeSeatNumber && boughtThisVisitByActive.has(id)
          ? { kind: "inCart" }
          : { kind: "taken", heroName: heroNameOf(owner) }
        : liveIds.has(id)
          ? { kind: "live" }
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

  const receipt: MarketReceiptLine[] = purchases.map((purchase) => ({
    heroName: heroNameOf(purchase.seatNumber),
    cardName: cardOf(purchase.cardId)?.name ?? purchase.cardId,
    price: purchase.price,
  }));

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
