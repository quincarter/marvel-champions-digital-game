import { expect, test, type Page } from "@playwright/test";
import { activeScenes, handInstanceFor, pressUntil, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardText, boardUp, facts, payWith, playFromHand, press, startDevGame } from "./x-men-helpers.js";
import { focusRect } from "./helpers.js";

/**
 * A tap on your discard pile fans it out (`scenes/pile-view.ts`): every card in it at once, most recent first. A tap on
 * one of them opens Inspect on it; Close (and Escape) put the table back. Storm pays three hand cards for Uncanny X-Men
 * (`store/dev-uncanny-game.ts`), which leaves exactly those three in the discard pile.
 */

const UNCANNY = "36018";

interface PileDebug {
  count(): number;
  close(): { x: number; y: number; width: number; height: number };
  cards(): { id: string; rect: { x: number; y: number; width: number; height: number } }[];
}

const pileDebug = <T>(page: Page, read: (debug: PileDebug) => T): Promise<T | null> =>
  page.evaluate(
    ([source]) => {
      const debug = (window as unknown as { __mcPileViewDebug?: PileDebug }).__mcPileViewDebug;
      return debug ? (new Function("debug", `return (${source})(debug)`)(debug) as never) : null;
    },
    [read.toString()] as const,
  );

test.describe("the discard pile fans out", () => {
  test("a tap lists every card, a tap on one inspects it, Close returns to the table", async ({ page }, info) => {
    test.setTimeout(240_000);
    const phone = info.project.name === "phone";
    await installWave6Helpers(page);
    await openApp(page);
    await startDevGame(page, "startUncannyDevGame");
    await boardUp(page);

    // Three hand cards paid for Uncanny X-Men end up in the discard pile.
    const id = (await handInstanceFor(page, UNCANNY))!;
    await playFromHand(page, phone, id, async () => (await boardText(page, /^Whose play area\?$/i)) !== undefined);
    await settle(page, { quietMs: 400, maxMs: 4000 });
    const wolverine = await facts(page, (game) => game.players[1].identity.instanceId as string);
    const tile = (await focusRect(page, `card:${wolverine}`))!;
    await pressUntil(
      page,
      () => press(page, phone, tile.x + tile.width / 2, tile.y + tile.height / 2),
      async () => (await boardText(page, /^PAYING/i)) !== undefined,
      "payment opens after the seat is picked",
    );
    const hand = await facts(page, (game) => game.players[0].hand as string[]);
    await payWith(page, phone, hand.filter((card) => card !== id).slice(0, 3));
    const discarded = await waitFor(async () => {
      const list = await facts(page, (game) => game.players[0].discard as string[]);
      return list.length >= 3 ? list : null;
    }, "the paid cards are in the discard pile");
    await settle(page, { quietMs: 600, maxMs: 4000 });

    const pile = async (): Promise<{ x: number; y: number; width: number; height: number } | null> =>
      page.evaluate(() => {
        const debug = (
          window as unknown as {
            __mcBoardDebug: { allPileRects(): [string, { x: number; y: number; width: number; height: number }][] };
          }
        ).__mcBoardDebug;
        return debug.allPileRects().find(([key]) => key.startsWith("discard"))?.[1] ?? null;
      });
    const rect = (await waitFor(pile, "the discard pile is drawn"))!;
    await pressUntil(
      page,
      () => press(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2),
      async () => (await activeScenes(page)).includes("PileViewOverlay"),
      "a tap on the discard pile fans it out",
      { minWaitMs: 2000 },
    );
    await settle(page, { quietMs: 500, maxMs: 3000 });
    if (SHOT) await page.screenshot({ path: `${SHOT}/discard-pile-view-${info.project.name}.png` });

    expect(await pileDebug(page, (d) => d.count())).toBe(discarded.length);
    const cards = (await pileDebug(page, (d) => d.cards()))!;
    expect(
      cards.map((c) => c.id),
      "every card, most recent first",
    ).toEqual(discarded);

    const first = cards[0]!.rect;
    await pressUntil(
      page,
      () => press(page, phone, first.x + first.width / 2, first.y + first.height / 2),
      async () => (await activeScenes(page)).includes("InspectOverlay"),
      "a tap on a card opens Inspect",
      { minWaitMs: 2000 },
    );
    await page.keyboard.press("Escape");
    await waitFor(async () => (!(await activeScenes(page)).includes("InspectOverlay") ? true : null), "Inspect closes");
    expect(await activeScenes(page), "the pile is still up under Inspect").toContain("PileViewOverlay");

    const close = (await pileDebug(page, (d) => d.close()))!;
    await pressUntil(
      page,
      () => press(page, phone, close.x + close.width / 2, close.y + close.height / 2),
      async () => !(await activeScenes(page)).includes("PileViewOverlay"),
      "Close puts the table back",
      { minWaitMs: 2000 },
    );
  });
});
