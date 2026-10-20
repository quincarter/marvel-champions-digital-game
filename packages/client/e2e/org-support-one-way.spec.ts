import { expect, test, type Page } from "@playwright/test";
import { focusRect, pressUntil, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardText, boardUp, bringIntoView, idsOf, payWith, playFromHand, press } from "./x-men-helpers.js";

/**
 * Issue #279: Organizational Support (50014) pays plainly or through its interrupt, one tile per set of cards it can
 * exhaust, and the strip let the player pick several of those at once for the one card; the engine then refused Pay
 * with nothing said. Now a second way of spending the card replaces the first. The dev game
 * (`store/dev-org-support-game.ts`) stops with Grant Ward and Command Team ready and Victoria Hand (3) to pay for.
 */

interface Way {
  readonly optionId: string;
  readonly kind: string;
  readonly instanceId: string | null;
  readonly spent: boolean;
  readonly pool: Record<string, number>;
}

const ways = (page: Page, org: string): Promise<Way[]> =>
  page.evaluate((id) => {
    const view = (
      window as unknown as { __mcBoardDebug?: { paymentView(): { sources: Way[] } | null } }
    ).__mcBoardDebug?.paymentView();
    return (view?.sources ?? []).filter((source) => source.instanceId === id);
  }, org);

const spentWays = async (page: Page, org: string): Promise<string[]> =>
  (await ways(page, org)).filter((way) => way.spent).map((way) => way.optionId);

test("Organizational Support: picking a second way to spend it replaces the first, and Pay goes through", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    const { startOrgSupportDevGame } = (await import(
      /* @vite-ignore */ "/src/store/dev-org-support-game.ts"
    )) as unknown as { startOrgSupportDevGame: (store: unknown) => Promise<void> };
    await startOrgSupportDevGame(appSession().store);
    const scenes = (
      window as unknown as {
        __mcGame: {
          scene: {
            getScenes: (a: boolean) => { sys: { settings: { key: string } } }[];
            stop: (k: string) => void;
            start: (k: string) => void;
          };
        };
      }
    ).__mcGame.scene;
    for (const s of scenes.getScenes(true)) scenes.stop(s.sys.settings.key);
    scenes.start("Board");
  });
  await boardUp(page);

  const [org] = await idsOf(page, "50014", "hand");
  const [victoria] = await idsOf(page, "50012", "hand");
  expect(org, "Organizational Support in hand").toBeDefined();
  expect(victoria, "Victoria Hand in hand").toBeDefined();
  await playFromHand(page, phone, victoria!, async () => (await boardText(page, /^PAYING/i)) !== undefined);
  await settle(page, { quietMs: 400, maxMs: 3000 });

  const offered = await ways(page, org!);
  const plain = offered.find((way) => way.kind === "handCard")!;
  const total = (way: Way) => Object.values(way.pool).reduce((a, b) => a + b, 0);
  const richest = offered.filter((way) => way.kind !== "handCard").sort((a, b) => total(b) - total(a))[0]!;
  expect(plain, "the plain resource").toBeDefined();
  expect(richest, "an exhaust mode").toBeDefined();

  // The card in hand, plainly.
  await bringIntoView(page, `card:${org}`);
  await pressUntil(
    page,
    async () => {
      const rect = (await focusRect(page, `card:${org}`))!;
      await press(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2);
    },
    async () => (await spentWays(page, org!)).length > 0,
    "Organizational Support is spent plainly",
    { minWaitMs: 2000 },
  );
  expect(await spentWays(page, org!)).toEqual([plain.optionId]);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  if (SHOT) await page.screenshot({ path: `${SHOT}/org-support-plain-${info.project.name}.png` });

  // Then the exhaust mode's own tile in the strip: it takes the plain pick's place.
  const tile = await waitFor(() => focusRect(page, `payment:${richest.optionId}`), "the exhaust mode's tile");
  await pressUntil(
    page,
    () => press(page, phone, tile.x + tile.width / 2, tile.y + tile.height / 2),
    async () => (await spentWays(page, org!)).includes(richest.optionId),
    "the exhaust mode is picked",
    { minWaitMs: 2000 },
  );
  expect(await spentWays(page, org!)).toEqual([richest.optionId]);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  if (SHOT) await page.screenshot({ path: `${SHOT}/org-support-one-way-${info.project.name}.png` });

  // Pay goes through: Victoria Hand enters play, Organizational Support is discarded.
  await payWith(page, phone, []);
  await waitFor(async () => ((await idsOf(page, "50012", "play")).length > 0 ? true : null), "Victoria Hand in play");
  expect(await idsOf(page, "50014", "hand")).not.toContain(org);
});
