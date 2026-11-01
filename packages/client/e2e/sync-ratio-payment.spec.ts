import { expect, test, type Page } from "@playwright/test";
import { focusRect, isPhonePage, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * SP//dr's Sync Ratio (issue #601): paying with two Interfaces ready offers one tile per Interface, each the Interface
 * it exhausts and not the Suit, and pressing a tile spends that Interface and no other.
 */

interface PaymentDebug {
  tableSources: { label: string; pickedCard?: string; spent: boolean }[];
}

const payment = (page: Page): Promise<PaymentDebug | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcBoardDebug: { paymentView(): PaymentDebug | null } }).__mcBoardDebug.paymentView() ??
      null,
  );

test("each Sync Ratio tile is its own Interface, and a press spends that one", async ({ page }) => {
  test.skip(isPhonePage(page), "the tiles are the same on a phone; the desktop press is enough");
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  await openApp(page, "screen=board&fixture=sync-ratio", { landing: "Board" });
  const hand = await waitFor(
    () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __mcBoardDebug?: { tableGame(): { round: number; players: { hand: string[] }[] } | null };
            }
          ).__mcBoardDebug?.tableGame()?.players[0]?.hand ?? null,
      ),
    "the hand",
    30_000,
  );
  // Energy Barrier, the card in hand that costs something the Interfaces can pay.
  const card = hand.at(-1)!;
  const rect = await waitFor(() => focusRect(page, `card:${card}`), "the hand card");
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  const opened = await waitFor(async () => {
    const view = await payment(page);
    return view && view.tableSources.length === 2 ? view : null;
  }, "the payment with both Interfaces");
  const picks = opened.tableSources.map((source) => source.pickedCard);
  expect(new Set(picks).size).toBe(2);
  expect(picks.every((pick) => pick !== undefined)).toBe(true);

  const tile = await waitFor(() => focusRect(page, `card:${picks[1]}`), "the second tile");
  await page.mouse.click(tile.x + tile.width / 2, tile.y + tile.height / 2);
  await waitFor(async () => {
    const view = await payment(page);
    return view?.tableSources[1]?.spent ? true : null;
  }, "the second Interface is spent");
  expect((await payment(page))?.tableSources[0]?.spent).toBe(false);
});
