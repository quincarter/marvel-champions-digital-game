import { expect, test } from "@playwright/test";
import { focusRect, handInstanceFor, pressUntil, settle } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import {
  SHOT,
  boardText,
  boardUp,
  facts,
  playFromHand,
  press,
  pressCard,
  startDevGame,
  waitForBoardText,
} from "./x-men-helpers.js";

/**
 * A payment's hand cards are discarded in the order they are picked, so the last one ends on top of the discard pile
 * (RRG 1.8 "Discard", p. 16), which is what Pepper Potts reads next. The board numbers each picked card in that order,
 * tags the last "on top", and a mouse over that card explains why it matters. Real pointer or touch input on the
 * Uncanny X-Men dev game (`store/dev-x-men-games.ts`), paid for into Storm's own play area.
 */

const UNCANNY = "36018";

test.describe("payment order", () => {
  test("picked cards are numbered in discard order and the last is on top", async ({ page }, info) => {
    test.setTimeout(240_000);
    const phone = info.project.name === "phone";
    const shot = (name: string) =>
      SHOT ? page.screenshot({ path: `${SHOT}/payment-order-${info.project.name}-${name}.png` }) : null;
    await installWave6Helpers(page);
    await openApp(page);
    await startDevGame(page, "startUncannyDevGame");
    await boardUp(page);

    const id = (await handInstanceFor(page, UNCANNY))!;
    expect(id, "Uncanny X-Men is in Storm's hand").not.toBeNull();
    await playFromHand(page, phone, id, async () => (await boardText(page, /^Whose play area\?$/i)) !== undefined);
    await settle(page, { quietMs: 400, maxMs: 4000 });
    const stormIdentity = await facts(page, (game) => game.players[0].identity.instanceId as string);
    const tile = (await focusRect(page, `card:${stormIdentity}`))!;
    await pressUntil(
      page,
      () => press(page, phone, tile.x + tile.width / 2, tile.y + tile.height / 2),
      async () => (await boardText(page, /^PAYING/i)) !== undefined,
      "payment opens after the seat is picked",
    );

    const hand = await facts(page, (game) => game.players[0].hand as string[]);
    const [first, second] = hand.filter((card) => card !== id);
    await pressCard(page, phone, first!);
    // A phone's narrow tile carries the compact tag: the number, and a marker for the top card.
    await waitForBoardText(page, phone ? /^1▲$/ : /^spent 1 · on top$/i, "the only picked card is on top");
    await pressCard(page, phone, second!);
    await waitForBoardText(page, phone ? /^2▲$/ : /^spent 2 · on top$/i, "the second pick is on top");
    await waitForBoardText(page, phone ? /^1$/ : /^spent 1$/i, "the first pick is numbered 1 and no longer on top");
    // Where there is no hover, the bar says what the order means while an "on top" card is picked.
    if (phone) await waitForBoardText(page, /^Picked last, so it ends up on top/, "the bar's note on the on-top card");
    await shot("1-picked");

    if (!phone) {
      const rect = (await focusRect(page, `card:${second}`))!;
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await waitForBoardText(page, /^Picked last, so it ends up on top/, "the hover note on the on-top card");
      await shot("2-hover");
      await page.mouse.move(1, 1);
      await expect.poll(async () => (await boardText(page, /^Picked last/)) === undefined).toBe(true);
    }
  });
});
