import { describe, expect, test } from "vitest";
import type { CardId } from "@mc/content";
import type { CampaignChoiceAnswer, CampaignPendingChoice } from "@mc/engine";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedGmwRun } from "../campaign/dev-fixtures.js";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { isMarketPendingChoice, marketCatalogOf, marketViewOf, type CardOf } from "./campaign-market-model.js";

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
    const view = marketViewOf(record.seats, pending, [], catalog, cardOf, heroNameOf(record));
    expect(view.activeSeatNumber).toBe(pending.seatNumber);
    const active = view.wallets.find((wallet) => wallet.active);
    expect(active?.seatNumber).toBe(pending.seatNumber);
    for (const wallet of view.wallets) {
      expect(wallet.before).toBeGreaterThan(0);
      expect(wallet.after).toBe(wallet.before);
    }
  });

  test("the live options are exactly the shelf's clickable cards, and everything else is priced context", async () => {
    const { record, pending } = await firstMarketChoice();
    const view = marketViewOf(record.seats, pending, [], catalog, cardOf, heroNameOf(record));
    const live = view.shelf.filter((row) => row.state.kind === "live").map((row) => row.cardId as string);
    expect(live).toEqual(pending.options);
    expect(view.shelf.length + view.overflowCount).toBe(catalog.length);
  });

  test("a purchase this visit shows as `inCart` for the buyer and drops the running balance; a card afforded by no one shows `unaffordable`", async () => {
    const { record, pending } = await firstMarketChoice();
    const bought = pending.options[0] as string;
    const price = (cardOf(bought) as { readonly unitCost: number }).unitCost;
    const answers: CampaignChoiceAnswer[] = [
      { instructionId: pending.instructionId, slot: pending.slot, seatNumber: pending.seatNumber, picked: [bought] },
    ];
    const view = marketViewOf(record.seats, pending, answers, catalog, cardOf, heroNameOf(record));
    const row = view.shelf.find((candidate) => candidate.cardId === bought);
    expect(row?.state).toEqual({ kind: "inCart" });
    const active = view.wallets.find((wallet) => wallet.active)!;
    expect(active.after).toBe(active.before - price);
    expect(view.receipt).toEqual([{ heroName: active.heroName, cardName: cardOf(bought)!.name, price }]);
    const pricey = view.shelf.find((candidate) => candidate.price > active.after && candidate.state.kind !== "taken");
    if (pricey) expect(pricey.state).toEqual({ kind: "unaffordable", need: pricey.price });
  });

  test("a card bought by a teammate reads as taken with their name, never as this seat's own cart", async () => {
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
    // Either the same seat is offered again (another slot at the same tier) or it's the next seat's turn — either
    // way the card seat 1 already took must never show as seat 2's own cart.
    const view = marketViewOf(record0.seats, composed2.choice, answers, catalog, cardOf, heroNameOf(record0));
    const row = view.shelf.find((candidate) => candidate.cardId === boughtBySeat1);
    if (composed2.choice.seatNumber !== seat1) {
      expect(row?.state.kind).toBe("taken");
    }
  });
});
