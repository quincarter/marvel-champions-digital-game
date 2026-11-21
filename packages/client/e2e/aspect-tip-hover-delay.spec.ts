import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { texts } from "./wave7-deck-builder-helpers.js";

/**
 * Issue #911: the deck builder's aspect "i" tip opened on every chip a fast mouse sweep crossed. It now opens only once
 * the mouse rests on the segment (`ASPECT_TIP_HOVER_DELAY_MS`), and still closes when the mouse leaves.
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const stopRect = (page: Page, key: string): Promise<Rect | null> =>
  page.evaluate(
    (k) =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string; rect: Rect }[]> }).__mcFocusRoutes[
        "DeckBuilder"
      ]!().find((stop) => stop.key === k)?.rect ?? null,
    key,
  );

/** True while an aspect tip (its "Aspects ▸" link) is on screen. */
const tipOpen = async (page: Page): Promise<boolean> =>
  (await texts(page, "DeckBuilder")).some((t) => /^aspects\s*▸$/i.test(t.trim()));

test("the aspect tip ignores a mouse sweeping past and opens when the mouse rests", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "phone", "hover is a desktop affordance");
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  const chip = await waitFor(() => stopRect(page, "aspect:justice"), "the Justice chip", 30_000);
  // The "i" segment sits at the chip's right end, just past its filter half.
  const info = { x: chip.x + chip.width + 12, y: chip.y + chip.height / 2 };
  await page.mouse.move(8, info.y);
  expect(await tipOpen(page)).toBe(false);

  // A sweep straight across the segment and on: no tip.
  await page.mouse.move(info.x, info.y, { steps: 3 });
  await page.mouse.move(info.x + 300, info.y + 200, { steps: 3 });
  await page.waitForTimeout(600);
  expect(await tipOpen(page), "a sweep across the segment opens nothing").toBe(false);

  // Resting on it: the tip opens.
  await page.mouse.move(info.x, info.y, { steps: 4 });
  await waitFor(async () => ((await tipOpen(page)) ? true : null), "the tip after resting on the segment", 5_000);

  // Leaving: it closes.
  await page.mouse.move(8, 8, { steps: 4 });
  await waitFor(async () => ((await tipOpen(page)) ? null : true), "the tip closing", 5_000);
});

// Code review on #916: the segment, the gap and the tip panel are one hover region, so the mouse can reach the
// lesson link.
test("a tip opened by hover stays open while the mouse travels onto its lesson link, which opens the lesson", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "phone", "hover is a desktop affordance");
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  const chip = await waitFor(() => stopRect(page, "aspect:justice"), "the Justice chip", 30_000);
  const info = { x: chip.x + chip.width + 12, y: chip.y + chip.height / 2 };
  await page.mouse.move(info.x, info.y, { steps: 4 });
  await waitFor(async () => ((await tipOpen(page)) ? true : null), "the tip after resting on the segment", 5_000);

  const link = await waitFor(async () => {
    const found = (await findText(page, "Aspects", "DeckBuilder")).find((m) => /▸/.test(m.text));
    return found ?? null;
  }, "the tip's lesson link");
  // Across the gap and onto the panel in small steps: the tip stays up the whole way.
  await page.mouse.move(link.x, link.y, { steps: 12 });
  expect(await tipOpen(page), "still open over its own panel").toBe(true);
  await page.mouse.click(link.x, link.y);
  await waitFor(
    async () => ((await activeScenes(page)).includes("AspectLesson") ? true : null),
    "the aspect lesson",
    15_000,
  );
});
