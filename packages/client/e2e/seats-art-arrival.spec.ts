import { expect, test } from "@playwright/test";
import { settle, trackPageErrors, waitFor } from "./helpers.js";
import { hook, openApp } from "./wave6-helpers-b.js";

/**
 * The hero picker draws seat thumbnails through `cardArt`, which asks for a scan and tells the scene when it arrives.
 * An arrival swaps the thumbnails in place; it must not rebuild the whole scene (a rebuild per arriving scan was a
 * long main-thread task on a phone). Once the screen has settled, further arrivals leave the rebuild count alone.
 */
test("a scan arriving does not rebuild the hero picker", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, "screen=seats&players=2", { landing: "Seats" });
  await waitFor(
    async () => (((await hook<string[]>(page, "__mcSeatsDebug", "seats")) ?? []).length === 2 ? true : null),
    "two seats drawn",
    30_000,
  );
  await settle(page);
  const before = (await hook<number>(page, "__mcSeatsDebug", "rebuilds")) ?? -1;
  // Let any pictures still in flight arrive (the arrival window is a few hundred ms).
  await page.waitForTimeout(3000);
  const after = (await hook<number>(page, "__mcSeatsDebug", "rebuilds")) ?? -2;
  expect(after).toBe(before);
  expect(errors).toEqual([]);
});
