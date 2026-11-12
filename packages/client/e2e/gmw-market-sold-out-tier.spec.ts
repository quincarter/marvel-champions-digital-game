import { expect, test, type Page } from "@playwright/test";
import { settle } from "./helpers.js";
import {
  clickStop,
  installWave6Helpers,
  routeStops,
  screens,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";

/**
 * Issue #679: a Market price tier whose four cards were all bought in earlier issues still asked its leftover slots,
 * with no cards in them. The Market screen cannot show an empty ask, so checkout bounced to the Briefing's "Your
 * call" with only Decline on it, and the rest of the hero's cart was dropped on the way.
 *
 * `?screen=campaign-gmw-balanced-ronan` is a Balanced Galaxy's Most Wanted run at Ronan whose earlier issues bought
 * the whole 1-unit tier (and much of the rest). Groot buys a pricier card that is still on the shelf; the checkout
 * must carry on to Rocket's own Market visit, every Briefing call after it must offer something to pick, and the
 * composed issue must hold the purchase.
 */

/** Market card ids by price (16150-16177, four per price). */
const TIER: Readonly<Record<number, readonly string[]>> = {
  1: ["16150", "16151", "16152", "16153"],
  2: ["16154", "16155", "16156", "16157"],
  3: ["16158", "16159", "16160", "16161"],
  4: ["16162", "16163", "16164", "16165"],
};

interface StoredSeat {
  readonly seatNumber: number;
  readonly grants: readonly { readonly cardId: string }[];
  readonly fields: Readonly<Record<string, { readonly kind: string; readonly value?: number }>>;
}
interface StoredRun {
  readonly id: string;
  readonly campaignId: string;
  readonly updatedAt?: number;
  readonly createdAt?: number;
  readonly attempt?: { readonly nodeId: string };
  readonly seats: readonly StoredSeat[];
}

/** The campaign run this visit's fixture just made: the newest Galaxy's Most Wanted record in `mc-campaigns`. */
async function newestGmwRun(page: Page): Promise<StoredRun | null> {
  const runs = await page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const request = indexedDB.open("mc-campaigns", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const all = db.transaction("campaigns", "readonly").objectStore("campaigns").getAll();
          all.onsuccess = () => {
            resolve(all.result as unknown[]);
            db.close();
          };
          all.onerror = () => reject(all.error);
        };
      }),
  );
  const gmw = (runs as StoredRun[]).filter((run) => run.campaignId === "gmw");
  const stamp = (run: StoredRun): number => run.updatedAt ?? run.createdAt ?? 0;
  return gmw.sort((a, b) => stamp(b) - stamp(a))[0] ?? null;
}

const marketTexts = async (page: Page): Promise<string[]> =>
  (await visibleTexts(page)).filter((text) => text.scene === "CampaignMarket").map((text) => text.text);

/** A finger drag from (x, y0) to (x, y1), as a real touch sequence that rests before it lifts. */
async function swipe(page: Page, x: number, y0: number, y1: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const point = (y: number): { x: number; y: number; id: number } => ({ x, y, id: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(y0)] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(y0 + ((y1 - y0) * i) / 8)] });
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(150);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** Scrolls the shelf until `key` sits wholly between the top bar and the action bar: only then does it take a tap. */
async function scrollIntoShelf(page: Page, isMobile: boolean, key: string): Promise<void> {
  const size = page.viewportSize()!;
  for (let attempt = 0; attempt < 40; attempt++) {
    const stops = (await routeStops(page, "CampaignMarket"))?.stops ?? [];
    const card = stops.find((stop) => stop.key === key)?.rect;
    const back = stops.find((stop) => stop.key === "back")?.rect;
    const done = stops.find((stop) => stop.key === "done")?.rect;
    const receipt = stops.find((stop) => stop.key === "receipt")?.rect;
    if (!card || !back || !done) throw new Error(`no "${key}" on the Market`);
    const top = back.y + back.height + 16;
    const bottom = Math.min(done.y, receipt?.y ?? done.y) - 24;
    if (card.y >= top && card.y + card.height <= bottom) return;
    const wanted = card.y < top ? card.y - top - 8 : card.y + card.height - bottom + 8;
    const step = Math.sign(wanted) * Math.min(size.height * 0.3, Math.max(30, Math.abs(wanted)));
    const x = card.x + card.width / 2;
    if (isMobile) await swipe(page, x, size.height / 2 + step / 2, size.height / 2 - step / 2);
    else {
      await page.mouse.move(x, size.height / 2);
      await page.mouse.wheel(0, step);
    }
    await settle(page, { quietMs: 200, maxMs: 1200 });
  }
  throw new Error(`the Market never scrolled "${key}" into view`);
}

const units = (seat: StoredSeat | undefined): number => seat?.fields.units?.value ?? 0;

test("a sold-out price neither stops the Market nor drops a cart (#679)", async ({ page, isMobile }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=campaign-gmw-balanced-ronan");
  // Before the fix this run opened on the Briefing's empty, Decline-only call for the sold-out 1-unit tier.
  await waitForScene(page, "CampaignMarket", 90_000);
  await expect
    .poll(async () => (await routeStops(page, "CampaignMarket"))?.stops.some((stop) => stop.key === "done"), {
      timeout: 60_000,
    })
    .toBe(true);
  await settle(page, { quietMs: 400, maxMs: 3000 });

  const before = await newestGmwRun(page);
  expect(before, "the fixture saved its run").toBeTruthy();
  const granted = new Set(before!.seats.flatMap((seat) => seat.grants.map((grant) => grant.cardId)));
  expect(
    TIER[1]!.every((id) => granted.has(id)),
    "the 1-unit tier was sold out in earlier issues",
  ).toBe(true);
  const groot = before!.seats.find((seat) => seat.seatNumber === 1);
  // The cheapest card Groot can still buy, above the sold-out tier.
  const price = [2, 3, 4].find((tier) => tier <= units(groot) && TIER[tier]!.some((id) => !granted.has(id)));
  expect(price, "Groot can afford a card still on the shelf").toBeDefined();
  const bought = TIER[price!]!.find((id) => !granted.has(id))!;

  await clickStop(page, `price:${price}`, "CampaignMarket");
  await settle(page, { quietMs: 400, maxMs: 2000 });
  await scrollIntoShelf(page, isMobile, `cart:${bought}`);
  await clickStop(page, `cart:${bought}`, "CampaignMarket");
  await settle(page, { quietMs: 300, maxMs: 1500 });
  expect(await marketTexts(page), "the card went into Groot's cart").toContain("IN YOUR CART");
  await clickStop(page, "done", "CampaignMarket");

  // Groot's checkout carries on to Rocket's own visit: the Market stays up, and the Briefing never comes in between.
  const seen = new Set<string>();
  const until = Date.now() + 6000;
  while (Date.now() < until) {
    for (const screen of await screens(page)) seen.add(screen);
    await page.waitForTimeout(100);
  }
  expect([...seen], "no Briefing call between the two heroes' visits").not.toContain("CampaignBriefing");
  expect(await screens(page)).toContain("CampaignMarket");

  // Rocket buys nothing. Then every call the Briefing asks offers something to pick; each is declined.
  await clickStop(page, "done", "CampaignMarket");
  await waitForScene(page, "CampaignBriefing", 60_000);
  for (let call = 0; call < 8; call++) {
    const decline = await expect
      .poll(
        async () => {
          const stops = (await routeStops(page, "CampaignBriefing"))?.stops ?? [];
          if (stops.some((stop) => stop.key === "call-decline")) return "call";
          return stops.some((stop) => stop.key === "open") ? "composed" : "waiting";
        },
        { timeout: 30_000 },
      )
      .not.toBe("waiting")
      .then(async () => (await routeStops(page, "CampaignBriefing"))?.stops ?? []);
    if (!decline.some((stop) => stop.key === "call-decline")) break;
    expect(
      decline.some((stop) => stop.key.startsWith("call-option:") || stop.key === "call-accept"),
      "the call offers something besides Decline",
    ).toBe(true);
    await clickStop(page, "call-decline", "CampaignBriefing");
    await settle(page, { quietMs: 400, maxMs: 3000 });
  }

  // The composed issue holds Groot's purchase, paid for, and nothing for Rocket.
  await expect
    .poll(async () => (await newestGmwRun(page))?.attempt?.nodeId ?? null, { timeout: 30_000 })
    .toBe("ronan-the-accuser");
  const after = (await newestGmwRun(page))!;
  const grootAfter = after.seats.find((seat) => seat.seatNumber === 1);
  const rocketBefore = before!.seats.find((seat) => seat.seatNumber === 2);
  const rocketAfter = after.seats.find((seat) => seat.seatNumber === 2);
  expect(grootAfter?.grants.map((grant) => grant.cardId)).toContain(bought);
  expect(units(grootAfter)).toBe(units(groot) - price!);
  expect(rocketAfter?.grants.length).toBe(rocketBefore?.grants.length);
  expect(errors).toEqual([]);
});
