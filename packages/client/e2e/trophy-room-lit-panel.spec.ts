import { expect, test, type Page } from "@playwright/test";
import { findText, pressKey, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The Trophy Room draws its list and an achievement's sheet as a Lit panel over the canvas (`mc-sheet`,
 * `scenes/trophy-room.ts`): the family headings and achievement cards are in the panel, the keyboard walks the same
 * stops with the ring drawn in the DOM, Enter opens a family or an achievement's sheet, Escape closes the sheet and then
 * leaves; on a phone the lift that ends a swipe over a card presses nothing. Its words follow the app's language.
 */

type FocusStates = Record<string, () => { focus: string | null; ringShown: boolean }>;

const focusOf = (page: Page): Promise<{ focus: string | null; ringShown: boolean }> =>
  page.evaluate(() => (window as unknown as { __mcFocusState: FocusStates }).__mcFocusState.TrophyRoom!());

const panel = '#mc-ui [data-scene="TrophyRoom"]';
const SHOTS = process.env.SHOT_DIR ?? "";

/** Opens the Trophy Room with the demo games written, so some achievements are earned. */
async function openRoom(page: Page): Promise<void> {
  await openApp(page, "screen=stats&fixture=demo&unlock=all", { landing: "PlayerStats" });
  await page.goto("/?screen=trophies&unlock=all");
  await waitFor(
    async () => ((await page.locator(`${panel} [data-key="sec:wins"]`).count()) > 0 ? true : null),
    "the headings",
    30_000,
  );
}

async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(16);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10, id: 1 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("the Trophy Room is a Lit panel: headings fold, the keyboard opens an achievement's sheet, Escape closes then leaves", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the keyboard walk is the desktop's case");
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openRoom(page);
  await expect(page.locator(`${panel} [data-key="list"]`)).toHaveCount(1);
  expect(await findText(page, "BATTLES WON", "TrophyRoom"), "the headings are in the panel").not.toHaveLength(0);
  await expect(page.locator(`${panel} [data-key^="row:"]`), "every family starts folded").toHaveCount(0);

  // A tap on a heading opens it, and its achievement cards come into the panel.
  await page.locator(`${panel} [data-key="sec:wins"]`).click();
  await expect(page.locator(`${panel} [data-key^="row:"]`).first()).toBeAttached();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/trophy-lit-desktop.png` });

  // The keyboard: the first arrow takes the first stop, the ring is drawn in the DOM, Down walks to the first card.
  await pressKey(page, "ArrowDown");
  await waitFor(async () => ((await focusOf(page)).focus ? true : null), "something has focus", 5000);
  expect((await focusOf(page)).ringShown).toBe(true);
  expect(await page.locator("#mc-ui .mc-focus-ring").isVisible()).toBe(true);
  let focus = (await focusOf(page)).focus;
  for (let step = 0; step < 14 && !focus?.startsWith("row:"); step++) {
    await pressKey(page, "ArrowDown");
    await page.waitForTimeout(60);
    focus = (await focusOf(page)).focus;
  }
  expect(focus?.startsWith("row:")).toBe(true);
  await pressKey(page, "Enter");
  await expect(page.locator(`${panel} [data-key="close"]`)).toHaveCount(1);
  expect((await focusOf(page)).focus).toBe("close");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/trophy-lit-desktop-sheet.png` });

  // Escape closes the sheet and gives the card its focus back; a second Escape leaves.
  await pressKey(page, "Escape");
  await expect(page.locator(`${panel} [data-key="close"]`)).toHaveCount(0);
  await waitFor(async () => ((await focusOf(page)).focus === focus ? true : null), "focus returns to the card", 5000);
  await pressKey(page, "Escape");
  await waitFor(async () => ((await page.locator(panel).count()) === 0 ? true : null), "the panel goes", 10_000);
  expect(errors).toEqual([]);
});

test.describe("in Spanish", () => {
  test.use({ locale: "es-ES" });

  test("the room's words are Spanish: heading, filter bar, state, family names", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one size is enough for the words");
    test.setTimeout(120_000);
    await openRoom(page);
    expect(await findText(page, "BATALLAS GANADAS", "TrophyRoom"), "a Spanish family heading").not.toHaveLength(0);
    expect(await findText(page, "Orden:", "TrophyRoom"), "the Filters button").not.toHaveLength(0);
    expect(await findText(page, "Desplegar todo", "TrophyRoom"), "Expand all").not.toHaveLength(0);
    await page.locator(`${panel} [data-key="sec:wins"]`).click();
    await expect(
      page
        .locator(panel)
        .getByText(/LOGRADO|BLOQUEADO/)
        .first(),
    ).toBeAttached();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/trophy-lit-desktop-es.png` });
  });
});

test("on a phone the lift that ends a swipe over an achievement presses nothing; a tap opens its sheet", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the touch release is the phone's case");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 375, height: 667 });
  const errors = trackPageErrors(page);
  await openRoom(page);
  await page.locator(`${panel} [data-key="sec:wins"]`).tap();
  const card = page.locator(`${panel} [data-key^="row:"]`).first();
  await expect(card).toBeAttached();
  const box = (await card.boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await swipe(page, { x: at.x, y: Math.min(640, at.y + 150) }, at);
  await page.waitForTimeout(400);
  await expect(page.locator(`${panel} [data-key="close"]`), "a swipe opened nothing").toHaveCount(0);
  await page.touchscreen.tap(at.x, at.y);
  await expect(page.locator(`${panel} [data-key="close"]`)).toHaveCount(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/trophy-lit-phone-sheet.png` });
  await pressKey(page, "Escape");
  await expect(page.locator(`${panel} [data-key="close"]`)).toHaveCount(0);
  expect(errors).toEqual([]);
});
