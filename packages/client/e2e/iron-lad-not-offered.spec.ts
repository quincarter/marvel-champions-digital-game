import { expect, test } from "@playwright/test";
import { activeScenes, clickText, hasText, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";

/**
 * An interrupt that matched but could not be used says why (#431): Hulkling's Iron Lad attacks with no other Avenger ally
 * on the table, so "exhaust another Avenger ally you control →" cannot be paid, nothing is asked, and the board opens
 * the notice over the attack, naming the missing ally. OK closes it.
 */

test.use({ viewport: { width: 1280, height: 800 } });

const NOTICE = "OptionNoticeOverlay";

test("Iron Lad attacks alone: the board says his interrupt was not offered, and why", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=iron-lad");
  await waitFor(
    async () => ((await activeScenes(page)).includes(NOTICE) ? true : null),
    "the not-offered notice opens",
    120_000,
  );
  await settle(page, { quietMs: 500, maxMs: 4000 });

  expect(await hasText(page, "Iron Lad: interrupt not offered", NOTICE)).toBe(true);
  expect(await hasText(page, "you control no other ready Avenger ally", NOTICE)).toBe(true);
  await page.screenshot({ path: "../../artifacts/qa/iron-lad-not-offered.png" });

  await clickText(page, "OK", { sceneKey: NOTICE });
  await waitFor(
    async () => ((await activeScenes(page)).includes(NOTICE) ? null : true),
    "OK closes the notice",
    10_000,
  );
  expect(errors).toEqual([]);
});
