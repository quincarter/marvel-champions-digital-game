import { expect, test, type Page } from "@playwright/test";
import { campaignSagaRows } from "../src/view/campaign-saga-model.js";
import { settle, waitFor } from "./helpers.js";
import {
  clickStop,
  hasStop,
  installWave6Helpers,
  openSaga,
  routeStops,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";

/**
 * Issue #609: starting a Galaxy's Most Wanted campaign asks "Play as normal" or "Rebalance the campaign" before the
 * Roster. Normal is the default; Rebalance shows the toggles (all off); Continue carries the choice to the Roster.
 * On a phone, a swipe that lifts over a toggle or the credit must press nothing (the no-tap-on-finger-lift rule).
 */

const GMW = campaignSagaRows([]).find((row) => row.volume.campaignId === "gmw")!.volume;
const TOGGLES = ["spacePirates", "expertGallery", "trimStandard", "milanoExhausted", "kreeSupremacy"].map(
  (id) => `toggle-${id}`,
);

const texts = async (page: Page): Promise<string[]> =>
  (await visibleTexts(page)).filter((t) => t.scene === "CampaignBalanced").map((t) => t.text.trim());

const count = (all: readonly string[], wanted: string): number => all.filter((t) => t === wanted).length;

/** A finger (phone) or mouse (desktop) drag from `from` to `to`, lifted at `to`. */
async function drag(page: Page, phone: boolean, from: { x: number; y: number }, to: { x: number; y: number }) {
  const steps = 10;
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  if (!phone) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(i), id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** Scrolls the body (a swipe on a phone, the wheel elsewhere) until the control is wholly on screen, then presses it. */
async function revealAndPress(page: Page, key: string): Promise<void> {
  const size = page.viewportSize()!;
  const phone = size.width < 600;
  for (let i = 0; i < 16; i++) {
    const stop = (await routeStops(page, "CampaignBalanced"))?.stops.find((s) => s.key === key);
    if (stop && stop.rect.y > 60 && stop.rect.y + stop.rect.height < size.height - 90) break;
    // Above the body: scroll back up; below it: scroll down.
    const up = !!stop && stop.rect.y <= 60;
    if (phone) {
      const from = { x: size.width / 2, y: up ? 140 : size.height - 140 };
      await drag(page, true, from, { x: size.width / 2, y: up ? size.height - 140 : 140 });
    } else {
      await page.mouse.move(size.width / 2, size.height / 2);
      await page.mouse.wheel(0, up ? -300 : 300);
    }
    await settle(page);
  }
  await clickStop(page, key, "CampaignBalanced");
}

test("issue #609: Normal is the default; Rebalance and a toggle carry to the Roster", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await quietGuide(page);
  // The credit opens a link: record it rather than leave the app.
  await page.addInitScript(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
    window.open = (url?: string | URL) => {
      (window as unknown as { __opened: string[] }).__opened.push(String(url));
      return null;
    };
  });
  await page.goto("/?unlock=all");
  await openSaga(page);
  await clickStop(page, `vol-${GMW.number}`, "CampaignSaga");
  await settle(page);
  await clickStop(page, "cta", "CampaignSaga");
  await waitForScene(page, "CampaignCover");
  await settle(page);
  await clickStop(page, "cta", "CampaignCover");

  // The prompt: Play as normal chosen, no toggles to see until Rebalance is picked.
  await waitForScene(page, "CampaignBalanced");
  await settle(page);
  const normal = await texts(page);
  expect(normal.some((t) => /^PLAY AS NORMAL$/i.test(t))).toBe(true);
  expect(count(normal, "✓ SELECTED"), "exactly one mode is marked selected").toBe(1);
  expect(normal.some((t) => /full points and achievements/.test(t))).toBe(true);
  expect(await hasStop(page, "mode-normal", "CampaignBalanced")).toBe(true);
  for (const key of TOGGLES) expect(await hasStop(page, key, "CampaignBalanced"), `${key} hidden`).toBe(false);

  // Rebalance: the toggles appear, all off.
  await revealAndPress(page, "mode-rebalance");
  await waitFor(async () => ((await hasStop(page, TOGGLES[0]!, "CampaignBalanced")) ? true : null), "the toggles");
  await settle(page);
  for (const key of TOGGLES) expect(await hasStop(page, key, "CampaignBalanced"), key).toBe(true);
  const off = await texts(page);
  expect(count(off, "OFF")).toBe(TOGGLES.length);
  expect(count(off, "ON")).toBe(0);

  // A toggle turns on with a press.
  await revealAndPress(page, "toggle-milanoExhausted");
  await waitFor(async () => (count(await texts(page), "ON") === 1 ? true : null), "the toggle reads ON");

  // The credit opens its link.
  await revealAndPress(page, "credit");
  await waitFor(async () => {
    const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
    return opened.includes("https://gideonsgaming.com/marvel-champions-fixing-galaxys-most-wanted/") ? true : null;
  }, "the credit link opened");

  // Continue carries the choice to the Roster, whose title wears the marker.
  await clickStop(page, "cta", "CampaignBalanced");
  await waitForScene(page, "CampaignRoster");
  await settle(page);
  const roster = (await visibleTexts(page)).filter((t) => t.scene === "CampaignRoster").map((t) => t.text);
  expect(
    roster.some((t) => /BALANCED/i.test(t)),
    "the roster says Balanced",
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("issue #609: Back returns to the Cover, and Continue without Rebalance signs Normal", async ({ page }) => {
  test.setTimeout(180_000);
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.goto("/?unlock=all&screen=campaign-balanced");
  await waitForScene(page, "CampaignBalanced");
  await settle(page);
  await clickStop(page, "back", "CampaignBalanced");
  await waitForScene(page, "CampaignCover");

  await page.goto("/?unlock=all&screen=campaign-balanced");
  await waitForScene(page, "CampaignBalanced");
  await settle(page);
  await clickStop(page, "cta", "CampaignBalanced");
  await waitForScene(page, "CampaignRoster");
  await settle(page);
  const roster = (await visibleTexts(page)).filter((t) => t.scene === "CampaignRoster").map((t) => t.text);
  expect(
    roster.some((t) => /BALANCED/i.test(t)),
    "a Normal signing carries no marker",
  ).toBe(false);
});

test("issue #609: on a phone, a swipe that lifts over a toggle or the credit presses nothing", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the finger-lift rule is a phone rule");
  test.setTimeout(180_000);
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.addInitScript(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
    window.open = (url?: string | URL) => {
      (window as unknown as { __opened: string[] }).__opened.push(String(url));
      return null;
    };
  });
  await page.goto("/?unlock=all&screen=campaign-balanced");
  await waitForScene(page, "CampaignBalanced");
  await settle(page);
  await clickStop(page, "mode-rebalance", "CampaignBalanced");
  await waitFor(async () => ((await hasStop(page, TOGGLES[0]!, "CampaignBalanced")) ? true : null), "the toggles");
  await settle(page);

  const size = page.viewportSize()!;
  const visible = async (key: string) => {
    const stop = (await routeStops(page, "CampaignBalanced"))?.stops.find((s) => s.key === key);
    // Wholly inside the body: below the 52px top bar, above the 80px action bar.
    return stop && stop.rect.y > 60 && stop.rect.y + stop.rect.height < size.height - 90 ? stop.rect : null;
  };
  // Scroll so a toggle is on screen (the intro is long on a phone).
  for (let i = 0; i < 6 && !(await visible(TOGGLES[1]!)); i++) {
    await drag(page, true, { x: size.width / 2, y: size.height - 140 }, { x: size.width / 2, y: 120 });
    await settle(page);
  }
  const rect = (await visible(TOGGLES[1]!))!;
  expect(rect, "a toggle row is on screen after scrolling").not.toBeNull();

  // Swipe up from below the row so the finger lifts over it.
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  await drag(page, true, { x: cx, y: Math.min(size.height - 100, cy + 50) }, { x: cx, y: cy });
  await settle(page);
  expect(count(await texts(page), "ON"), "no toggle flipped by the lift").toBe(0);
  const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
  expect(opened, "no link opened by the lift").toEqual([]);

  // A real tap still works.
  await clickStop(page, TOGGLES[1]!, "CampaignBalanced");
  await waitFor(async () => (count(await texts(page), "ON") === 1 ? true : null), "a tap flips the toggle");
});

test("issue #609: the pane fills the right side and, on a big screen, Rebalance needs no scroll", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "a desktop layout");
  test.setTimeout(180_000);
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.goto("/?unlock=all&screen=campaign-balanced");
  await waitForScene(page, "CampaignBalanced");
  await settle(page);
  const heading = (await visibleTexts(page)).filter((t) => t.scene === "CampaignBalanced");
  expect(
    heading.some((t) => /^PLAY AS NORMAL$/i.test(t.text.trim()) && t.x > 608),
    "the pane names the option",
  ).toBe(true);
  await clickStop(page, "mode-rebalance", "CampaignBalanced");
  await waitFor(
    async () => ((await hasStop(page, TOGGLES[TOGGLES.length - 1]!, "CampaignBalanced")) ? true : null),
    "the toggles",
  );
  await settle(page);
  const stops = (await routeStops(page, "CampaignBalanced"))!.stops;
  const last = stops.find((s) => s.key === TOGGLES[TOGGLES.length - 1])!;
  expect(last.rect.x, "the toggles sit in the pane").toBeGreaterThan(608);
  expect(last.rect.y + last.rect.height, "the last toggle is above the action bar").toBeLessThanOrEqual(980 - 88);
  const panes = (await visibleTexts(page)).filter(
    (t) => t.scene === "CampaignBalanced" && /^WHAT CHANGES$/i.test(t.text.trim()),
  );
  expect(panes.length).toBe(1);
});
