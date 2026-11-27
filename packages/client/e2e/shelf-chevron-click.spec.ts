import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, trackPageErrors, waitFor } from "./helpers.js";
import { hook, openApp } from "./wave6-helpers-b.js";

/**
 * A shelf's scroll chevron on Take your seats (#218): pressing it scrolls its row and does nothing else. The card that
 * slides in under the pointer used to take the same click (opening its unlock prompt or seating it). The chevrons are
 * buttons in the shelf header of the roster panel (`mc-shelf-roster`) and the rows scroll natively.
 */

const seats = async (page: Page): Promise<string[]> => (await hook<string[]>(page, "__mcSeatsDebug", "seats")) ?? [];

test.describe("Take your seats: shelf chevrons", () => {
  test("a chevron press scrolls its shelf and picks no card", async ({ page }) => {
    const errors = trackPageErrors(page);
    // A tablet-wide window: each pack shelf (one tile per hero, #219) is then long enough that a chevron press never
    // reaches its end.
    await page.setViewportSize({ width: 1024, height: 900 });
    await openApp(page, "screen=seats", { landing: "Seats" });
    await waitFor(async () => ((await seats(page)).length > 0 ? true : null), "seats drawn", 30000);
    await settle(page);

    const roster = page.locator('#mc-ui [data-scene="Seats"] mc-shelf-roster').first();
    const row = roster.locator("[data-row]").first();
    const next = roster.locator(".chevrons mc-button").nth(1);
    await next.scrollIntoViewIfNeeded();
    const scenesBefore = await activeScenes(page);
    const seatsBefore = await seats(page);
    const leftBefore = await row.evaluate((el) => el.scrollLeft);
    await next.click();
    await waitFor(
      async () => ((await row.evaluate((el) => el.scrollLeft)) > leftBefore ? true : null),
      "the shelf scrolled",
      10000,
    );
    await settle(page);
    // And nothing was picked: no prompt opened and no seat changed.
    expect(await activeScenes(page)).toEqual(scenesBefore);
    expect(await seats(page)).toEqual(seatsBefore);
    expect(errors).toEqual([]);
  });
});
