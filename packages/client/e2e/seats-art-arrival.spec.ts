import { expect, test } from "@playwright/test";
import { pressHookStop, settle, trackPageErrors, waitFor } from "./helpers.js";
import { hook, openApp } from "./wave6-helpers-b.js";

/**
 * The hero picker draws seat thumbnails through `cardArt`, which asks for a scan and tells the scene when it arrives.
 * An arrival swaps the thumbnails in place; it must not rebuild the whole scene (a rebuild per arriving scan was a
 * long main-thread task on a phone). A hero seated here has never been drawn in this page, so its scan really does
 * arrive after the seat is drawn.
 */
interface Thumb {
  identityCardId: string;
  image: boolean;
  textureKey: string | null;
}

test("a scan arriving swaps the seat thumbnail in place and does not rebuild the hero picker", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, "screen=seats&players=2", { landing: "Seats" });
  await waitFor(
    async () => (((await hook<string[]>(page, "__mcSeatsDebug", "seats")) ?? []).length === 2 ? true : null),
    "two seats drawn",
    30_000,
  );
  await settle(page);
  const swapsBefore = (await hook<number>(page, "__mcSeatsDebug", "thumbSwaps")) ?? 0;

  // Seat a hero in an empty seat: its thumbnail is requested now, and arrives later.
  await pressHookStop(page, "__mcSeatsDebug", "hero-random");
  await waitFor(
    async () => {
      const thumbs = (await hook<Thumb[]>(page, "__mcSeatsDebug", "thumbs")) ?? [];
      return thumbs.length > 0 && thumbs.every((t) => t.image) ? thumbs : null;
    },
    "every filled seat's thumbnail holding a picture",
    30_000,
  );
  const rebuildsAfterSeating = (await hook<number>(page, "__mcSeatsDebug", "rebuilds")) ?? -1;
  await page.waitForTimeout(2000);

  const swaps = (await hook<number>(page, "__mcSeatsDebug", "thumbSwaps")) ?? 0;
  expect(swaps).toBeGreaterThan(swapsBefore);
  expect((await hook<number>(page, "__mcSeatsDebug", "rebuilds")) ?? -2).toBe(rebuildsAfterSeating);
  for (const t of (await hook<Thumb[]>(page, "__mcSeatsDebug", "thumbs")) ?? []) {
    expect(t.image).toBe(true);
    expect(t.textureKey).toBeTruthy();
  }
  expect(errors).toEqual([]);
});
