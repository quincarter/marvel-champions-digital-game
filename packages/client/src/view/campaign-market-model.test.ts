import { describe, expect, test } from "vitest";
import type { CardId } from "@mc/content";
import type { CampaignChoiceAnswer, CampaignPendingChoice } from "@mc/engine";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedGmwRun } from "../campaign/dev-fixtures.js";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import {
  answerMarketAsk,
  canAddToCart,
  cartTierCountOf,
  cartTotalOf,
  isMarketPendingChoice,
  MARKET_TIER_CAP,
  marketCatalogOf,
  marketViewOf,
  type CardOf,
  type MarketCartItem,
} from "./campaign-market-model.js";

const service = () =>
  new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });

const cardOf: CardOf = (id) => CARDS_BY_ID.get(id);
const catalog = marketCatalogOf(POOL_CARDS);
const heroNameOf =
  (record: { readonly seats: readonly { readonly seatNumber: number; readonly identityCardId: CardId }[] }) =>
  (seatNumber: number) =>
    CARDS_BY_ID.get(record.seats.find((seat) => seat.seatNumber === seatNumber)?.identityCardId as string)?.name ??
    `Seat ${seatNumber}`;

/** Composes issue #2 for a real `afterIssue1` GMW run, returning the first pending choice (the Market's own). */
async function firstMarketChoice(): Promise<{
  readonly record: Awaited<ReturnType<typeof seedGmwRun>>;
  readonly pending: CampaignPendingChoice;
}> {
  const svc = service();
  const record = await seedGmwRun(svc, "afterIssue1");
  const result = await svc.compose(record);
  if (result.kind !== "pending") throw new Error("expected issue #2's Market to ask a question immediately");
  return { record, pending: result.choice };
}

/**
 * A test-only log edit (CLAUDE.md never lets a real game boost units, but a checkout test needs a seat that can
 * actually reach tiers 1, 2 and 3): overwrites seat 1's `units` field on an in-memory record. `CampaignService`
 * never reads storage inside `compose`, so this is safe to hand straight back in.
 */
function withUnits(record: CampaignRecord, seatNumber: number, units: number): CampaignRecord {
  return {
    ...record,
    seats: record.seats.map((seat) =>
      seat.seatNumber === seatNumber
        ? { ...seat, fields: { ...seat.fields, units: { kind: "number" as const, value: units } } }
        : seat,
    ),
  } as CampaignRecord;
}

/** Every card price exactly `price` and never already granted to a seat this record already has. */
function cheapestUngranted(record: CampaignRecord, price: number): string {
  const granted = new Set(record.seats.flatMap((seat) => seat.grants.map((grant) => grant.cardId as string)));
  const card = catalog.find(
    (candidate) =>
      (candidate as { readonly unitCost?: number }).unitCost === price && !granted.has(candidate.id as string),
  );
  if (!card) throw new Error(`no ungranted ${price}-unit Market card in this build's catalog`);
  return card.id as string;
}

describe("isMarketPendingChoice", () => {
  test("a real GMW Market choice is Market-shaped", async () => {
    const { pending } = await firstMarketChoice();
    expect(isMarketPendingChoice(pending, cardOf)).toBe(true);
  });

  test("a random draw, a group choice, or a choice with no priced options is not Market-shaped", () => {
    const base = {
      instructionId: "x",
      slot: "x",
      seatNumber: 1 as number | null,
      text: "",
      citation: "",
      count: 1,
      optional: true,
    };
    expect(isMarketPendingChoice({ ...base, chooser: "eachSeat", options: ["04157"], random: true }, cardOf)).toBe(
      false,
    );
    expect(isMarketPendingChoice({ ...base, chooser: "group", seatNumber: null, options: ["16150"] }, cardOf)).toBe(
      false,
    );
    // 04157 is a real TECH upgrade with no `unitCost` — Market-shaped requires every option to price in units.
    expect(isMarketPendingChoice({ ...base, chooser: "eachSeat", options: ["04157"] }, cardOf)).toBe(false);
    expect(isMarketPendingChoice({ ...base, chooser: "eachSeat", options: [] }, cardOf)).toBe(false);
  });
});

describe("marketViewOf", () => {
  test("wallets read the seat's own units as `before`, seat 1 is `active` for the very first slot", async () => {
    const { record, pending } = await firstMarketChoice();
    const view = marketViewOf(record.seats, pending, [], [], catalog, cardOf, heroNameOf(record));
    expect(view.activeSeatNumber).toBe(pending.seatNumber);
    const active = view.wallets.find((wallet) => wallet.active);
    expect(active?.seatNumber).toBe(pending.seatNumber);
    for (const wallet of view.wallets) {
      expect(wallet.before).toBeGreaterThan(0);
      expect(wallet.after).toBe(wallet.before);
    }
  });

  test("the shelf sells the whole catalog, not just the runner's current tier: every card the active seat can afford is live", async () => {
    const { record, pending } = await firstMarketChoice();
    const view = marketViewOf(record.seats, pending, [], [], catalog, cardOf, heroNameOf(record), catalog.length);
    const active = view.wallets.find((wallet) => wallet.active)!;
    for (const row of view.shelf) {
      if (row.price <= active.before) expect(row.state.kind).toBe("live");
      else expect(row.state.kind).toBe("unaffordable");
    }
    // `pending.options` (tier 1 only) is a strict subset of what the shelf now offers, once the seat can afford more.
    expect(view.shelf.filter((row) => row.state.kind === "live").length).toBeGreaterThanOrEqual(pending.options.length);
  });

  test("adding a card to the cart drops the running balance and marks the card `inCart`, without touching the engine", async () => {
    const { record, pending } = await firstMarketChoice();
    const active = record.seats.find((seat) => seat.seatNumber === pending.seatNumber)!;
    const before = (active.fields.units as { readonly kind: "number"; readonly value: number }).value;
    const oneUnit = pending.options[0] as string;
    const price = (cardOf(oneUnit) as { readonly unitCost: number }).unitCost;
    const cart: MarketCartItem[] = [{ cardId: oneUnit, price }];
    const view = marketViewOf(record.seats, pending, [], cart, catalog, cardOf, heroNameOf(record));
    const row = view.shelf.find((candidate) => candidate.cardId === oneUnit);
    expect(row?.state).toEqual({ kind: "inCart" });
    const wallet = view.wallets.find((candidate) => candidate.active)!;
    expect(wallet.after).toBe(before - price);
    expect(view.receipt).toEqual([{ heroName: wallet.heroName, cardName: cardOf(oneUnit)!.name, price, inCart: true }]);
  });

  test("a card priced above the running balance (before minus the cart) reads `unaffordable` with `need` its price", async () => {
    const { record, pending } = await firstMarketChoice();
    const view = marketViewOf(record.seats, pending, [], [], catalog, cardOf, heroNameOf(record), catalog.length);
    const active = view.wallets.find((wallet) => wallet.active)!;
    const pricey = view.shelf.find((row) => row.price > active.after && row.state.kind !== "taken");
    if (pricey) expect(pricey.state).toEqual({ kind: "unaffordable", need: pricey.price });
  });

  test("a card bought by a teammate (a committed answer) reads as `taken` with their name, never as this seat's own cart", async () => {
    const svc = service();
    const record0 = await seedGmwRun(svc, "afterIssue1");
    const composed1 = await svc.compose(record0);
    if (composed1.kind !== "pending") throw new Error("expected a Market pending choice");
    const seat1 = composed1.choice.seatNumber!;
    const boughtBySeat1 = composed1.choice.options[0] as string;
    const answers: CampaignChoiceAnswer[] = [
      {
        instructionId: composed1.choice.instructionId,
        slot: composed1.choice.slot,
        seatNumber: seat1,
        picked: [boughtBySeat1],
      },
    ];
    const composed2 = await svc.compose(record0, answers);
    if (composed2.kind !== "pending") throw new Error("expected another Market pending choice");
    const view = marketViewOf(record0.seats, composed2.choice, answers, [], catalog, cardOf, heroNameOf(record0));
    const row = view.shelf.find((candidate) => candidate.cardId === boughtBySeat1);
    expect(row?.state.kind).toBe("taken");
    if (row?.state.kind === "taken") expect(row.state.heroName).toBe(heroNameOf(record0)(seat1));
  });
});

describe("cart affordability and the 4-per-tier cap", () => {
  test("canAddToCart tracks the running total, not just the seat's original balance", () => {
    const cart: MarketCartItem[] = [{ cardId: "a", price: 3 }];
    expect(cartTotalOf(cart)).toBe(3);
    // Balance 5, cart already spends 3 → 2 left: a 2-unit card fits, a 3-unit card does not.
    expect(canAddToCart(2, cart, 5)).toBe(true);
    expect(canAddToCart(3, cart, 5)).toBe(false);
  });

  test("a 5th card at the same price tier is refused even with units to spare", () => {
    let cart: MarketCartItem[] = [];
    for (let copy = 0; copy < MARKET_TIER_CAP; copy++) {
      expect(canAddToCart(1, cart, 100)).toBe(true);
      cart = [...cart, { cardId: `card-${copy}`, price: 1 }];
    }
    expect(cartTierCountOf(cart, 1)).toBe(MARKET_TIER_CAP);
    expect(canAddToCart(1, cart, 100)).toBe(false);
  });
});

describe("checkout: a cart spanning tiers 1, 2 and 3 against the real runner", () => {
  test("answerMarketAsk drives the runner to grant every cart card and decline the rest, at the right balance", async () => {
    const svc = service();
    const seeded = await seedGmwRun(svc, "afterIssue1");
    const seatNumber = seeded.seats[0]!.seatNumber;
    const otherSeatNumber = seeded.seats[1]!.seatNumber;
    const boosted = withUnits(seeded, seatNumber, 6);
    const first = await svc.compose(boosted);
    if (first.kind !== "pending") throw new Error("expected the Market's first tier-1 ask");
    expect(first.choice.seatNumber).toBe(seatNumber);

    const oneUnit = cheapestUngranted(boosted, 1);
    const twoUnit = cheapestUngranted(boosted, 2);
    const threeUnit = cheapestUngranted(boosted, 3);
    let cart: readonly MarketCartItem[] = [
      { cardId: oneUnit, price: 1 },
      { cardId: twoUnit, price: 2 },
      { cardId: threeUnit, price: 3 },
    ];
    const answers: CampaignChoiceAnswer[] = [];
    let pending: CampaignPendingChoice | null = first.choice;
    let guard = 0;
    // Seat 1's whole checkout: every ask this seat sees is answered from the cart or declined.
    while (pending && pending.seatNumber === seatNumber && isMarketPendingChoice(pending, cardOf)) {
      if (++guard > 64) throw new Error("seat 1's checkout looped more than 64 times");
      const step = answerMarketAsk(pending, cart);
      cart = step.remainingCart;
      answers.push(step.answer);
      const result = await svc.compose(boosted, answers);
      pending = result.kind === "pending" ? result.choice : null;
    }
    expect(cart).toEqual([]); // every cart card was matched to an ask, none left stranded

    // Seat 2 declines everything (an empty cart), so the issue finishes composing and persists.
    while (pending) {
      if (++guard > 128) throw new Error("seat 2's decline-everything pass looped too long");
      if (pending.seatNumber !== otherSeatNumber || !isMarketPendingChoice(pending, cardOf)) break;
      const step = answerMarketAsk(pending, []);
      answers.push(step.answer);
      const result = await svc.compose(boosted, answers);
      pending = result.kind === "pending" ? result.choice : null;
    }
    const done = await svc.compose(boosted, answers);
    if (done.kind !== "done") throw new Error("expected the whole issue #2 setup to finish composing");

    const finalSeat = done.record.seats.find((seat) => seat.seatNumber === seatNumber)!;
    const grantedIds = finalSeat.grants.map((grant) => grant.cardId as string);
    expect(grantedIds).toEqual(expect.arrayContaining([oneUnit, twoUnit, threeUnit]));
    expect((finalSeat.fields.units as { readonly kind: "number"; readonly value: number }).value).toBe(0); // 6 - (1+2+3)
  });
});
