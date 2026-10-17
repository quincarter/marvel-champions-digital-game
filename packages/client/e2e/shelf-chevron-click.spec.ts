import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressHookStop, settle, trackPageErrors, waitFor, type TextMatch } from "./helpers.js";
import { findVisibleText, hook, openApp, type Rect } from "./wave6-helpers-b.js";

/**
 * A shelf's scroll chevron on Take your seats (#218): pressing it scrolls the shelf and does nothing else. The card that
 * slides in under the chevron used to take the same click (the roster's own card tap ran after the chevron had
 * scrolled), opening its unlock prompt or seating it.
 *
 * `SHELF_CHEVRON_SHOTS=<dir>` also saves a screenshot before and after the press.
 */

interface Stop extends Rect {
  readonly key: string;
}

const heroStops = async (page: Page): Promise<string[]> =>
  ((await hook<Stop[]>(page, "__mcSeatsDebug", "stops")) ?? []).map((s) => s.key).filter((k) => k.startsWith("hero:"));

async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.SHELF_CHEVRON_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

/** The shelf chevrons drawn on screen, by their glyph. */
async function chevrons(page: Page, glyph: "‹" | "›"): Promise<TextMatch[]> {
  const height = page.viewportSize()!.height;
  return (await findVisibleText(page, glyph, "Seats")).filter((m) => m.text === glyph && m.y > 0 && m.y < height);
}

/** Everything the header and the seat cards say: which seats are filled, with whom, and which one is picking. */
async function seatTexts(page: Page): Promise<string[]> {
  return (await findVisibleText(page, "", "Seats"))
    .filter((m) => m.y < 210)
    .map((m) => m.text)
    .sort();
}

test.describe("Take your seats: shelf chevrons", () => {
  test("a chevron press scrolls its shelf and picks no card", async ({ page }) => {
    const errors = trackPageErrors(page);
    await openApp(page, "screen=seats", { landing: "Seats" });
    await waitFor(async () => ((await heroStops(page)).length > 0 ? true : null), "the hero list", 30000);
    await settle(page);
    // Only the tested community decks: shelves long enough that a chevron press never reaches the end, so a card
    // always slides in under the chevron.
    await pressHookStop(page, "__mcSeatsDebug", "hero-chip:source:tested");
    await settle(page);

    // Scroll the roster until a shelf shows its right chevron in the middle of the screen, clear of the header and
    // the bottom edge.
    const width = page.viewportSize()!.width;
    const height = page.viewportSize()!.height;
    const right = await waitFor(
      async () => {
        const found = (await chevrons(page, "›")).find((m) => m.y > height * 0.4 && m.y < height * 0.85);
        if (found) return found;
        await page.mouse.move(width * 0.3, height * 0.6);
        await page.mouse.wheel(0, 200);
        await settle(page, { quietMs: 150, maxMs: 600 });
        return null;
      },
      "a shelf's right chevron",
      30000,
    );
    await settle(page);
    const scenesBefore = await activeScenes(page);
    const seatsBefore = await seatTexts(page);
    const leftBefore = (await chevrons(page, "‹")).filter((m) => Math.abs(m.y - right.y) < 4).length;
    await shot(page, "01-before");

    await page.mouse.click(right.x, right.y);
    await settle(page);
    await shot(page, "02-after");

    // The shelf scrolled (its left chevron is now drawn) and has more to show (a card sits under the right one).
    const leftAfter = (await chevrons(page, "‹")).filter((m) => Math.abs(m.y - right.y) < 4).length;
    expect(leftAfter, "the shelf scrolled").toBeGreaterThan(leftBefore);
    const rightAfter = (await chevrons(page, "›")).filter((m) => Math.abs(m.y - right.y) < 4).length;
    expect(rightAfter, "the shelf has a card under its right chevron").toBe(1);
    // And nothing was picked: no prompt opened and no seat changed.
    expect(await activeScenes(page)).toEqual(scenesBefore);
    expect(await seatTexts(page)).toEqual(seatsBefore);
    expect(errors).toEqual([]);
  });
});
