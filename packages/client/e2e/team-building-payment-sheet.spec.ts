import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";

/**
 * Issue #569's own game (`store/dev-team-building-pay-game.ts`): Team-Building Exercise's payment with Organizational
 * Support in hand. Each card to exhaust is a tile of its own, Confirm waits for a payment the engine takes, and the
 * payment plays the card. Real clicks on the sheet's tiles.
 */
test.use({ viewport: { width: 1600, height: 900 } });

interface ChoiceDebug {
  optionRect(optionId: string): Rect | null;
  allRects(): (readonly [string, Rect | null])[];
}

const optionKeys = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    ((window as unknown as { __mcChoiceDebug?: ChoiceDebug }).__mcChoiceDebug?.allRects() ?? [])
      .map(([key]) => key)
      .filter((key) => key.startsWith("option:"))
      .map((key) => key.slice("option:".length)),
  );

async function press(page: Page, optionId: string): Promise<void> {
  const rect = await page.evaluate(
    (id) => (window as unknown as { __mcChoiceDebug?: ChoiceDebug }).__mcChoiceDebug?.optionRect(id) ?? null,
    optionId,
  );
  expect(rect, optionId).not.toBeNull();
  await page.mouse.click(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await settle(page);
}

test("each card to exhaust is its own tile, and the picks pay for the card", async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=team-building-pay");
  await waitFor(
    async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? true : null),
    "the payment sheet",
    60000,
  );
  await settle(page);

  const keys = await optionKeys(page);
  expect(keys.filter((key) => key.startsWith("exhaust:"))).toHaveLength(3);
  expect(keys.some((key) => key.includes("@"))).toBe(false);
  await page.screenshot({ path: info.outputPath("team-building-sheet.png") });

  for (const tile of keys.filter((key) => key.startsWith("exhaust:"))) await press(page, tile);
  await page.screenshot({ path: info.outputPath("team-building-exhausting.png") });

  const handSize = (): Promise<number> =>
    page.evaluate(async () => {
      const { appSession } = (await import("/src/session.ts")) as unknown as {
        appSession: () => { store: { state: { game: { players: { hand: unknown[] }[] } | null } } };
      };
      return appSession().store.state.game?.players[0]?.hand.length ?? -1;
    });
  const before = await handSize();
  await page.keyboard.press("Enter");
  await waitFor(
    async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? null : true),
    "the payment accepted",
    20000,
  );
  // The card and Organizational Support left the hand: a refused payment closes the sheet too, and leaves them there.
  expect(await handSize()).toBe(before - 2);
  expect(errors).toEqual([]);
});
