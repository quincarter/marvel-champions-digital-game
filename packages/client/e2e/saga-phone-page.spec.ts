import { expect, test, type Page } from "@playwright/test";
import { findText, pressKey, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, routeStops, screens, waitForScene } from "./wave6-helpers-a.js";

/**
 * The phone Saga is one page that scrolls as a whole (Quin's design call, 2026-11-27): the featured volume's art
 * collapses as the page scrolls, while the selected volume's title, status line, issue bar and its two buttons stay
 * pinned under the top bar; the one big button stays pinned at the bottom. A swipe that lifts over a pinned button
 * must not press it (the phone rule, issue #227), and focus moving into the list scrolls the page so the focused row
 * is seen below the pinned card.
 */

interface PartBox {
  readonly y: number;
  readonly height: number;
  readonly opacity: number;
}

/** A panel part's box and opacity by its key, found through the panels' shadow roots. */
async function part(page: Page, key: string): Promise<PartBox | null> {
  return page.evaluate((wanted) => {
    const walk = (root: ParentNode): Element | null => {
      for (const el of Array.from(root.querySelectorAll("*"))) {
        if (
          (el as HTMLElement).dataset?.key === wanted &&
          (el.classList.contains("group") || el.classList.contains("scroller"))
        )
          return el;
        if (el.shadowRoot) {
          const found = walk(el.shadowRoot);
          if (found) return found;
        }
      }
      return null;
    };
    const el = walk(document);
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return { y: box.y, height: box.height, opacity: Number(getComputedStyle(el).opacity) };
  }, key);
}

async function scrollPage(page: Page, top: number): Promise<void> {
  await page.evaluate((to) => {
    const walk = (root: ParentNode): HTMLElement | null => {
      for (const el of Array.from(root.querySelectorAll("*"))) {
        if (el.classList.contains("scroller") && (el as HTMLElement).dataset.key === "saga-volumes")
          return el as HTMLElement;
        if (el.shadowRoot) {
          const found = walk(el.shadowRoot);
          if (found) return found;
        }
      }
      return null;
    };
    const scroller = walk(document);
    if (scroller) scroller.scrollTop = to;
  }, top);
  await settle(page, { quietMs: 200, maxMs: 1500 });
}

async function openLiveSaga(page: Page): Promise<void> {
  await installWave6Helpers(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title", 30_000);
  // An active run of The Rise of Red Skull (issue 3 next): the shelf's featured volume then has its issue bar and buttons.
  await page.evaluate(async () => {
    const handle = (window as unknown as { __mcCampaign: { seed(stop: string): Promise<unknown> } }).__mcCampaign;
    await handle.seed("afterIssue2");
  });
  await page.goto("/?unlock=all&screen=saga");
  await waitForScene(page, "CampaignSaga");
  await waitFor(
    async () => ((await routeStops(page, "CampaignSaga"))?.stops.some((s) => s.key === "alt-0") ? true : null),
    "the pinned buttons are drawn",
    20_000,
  );
  await settle(page);
}

test("the phone Saga scrolls as one page: the art collapses, the title, issue bar and buttons stay pinned", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "a phone");
  test.setTimeout(120_000);
  await openLiveSaga(page);

  const page0 = await part(page, "saga-volumes");
  const art0 = await part(page, "saga-art");
  const pinned0 = await part(page, "saga-pinned");
  expect(page0, "the page scroller").toBeTruthy();
  expect(art0!.height, "the art is whole at the top").toBeGreaterThan(100);
  expect(art0!.opacity).toBe(1);
  expect(pinned0!.y, "the pinned card sits under the art").toBeGreaterThan(art0!.y + art0!.height - 2);

  await scrollPage(page, 100000);
  const art1 = await part(page, "saga-art");
  const pinned1 = await part(page, "saga-pinned");
  const top = page0!.y;
  expect(art1!.y + art1!.height, "the art has scrolled away under the top bar").toBeLessThanOrEqual(top + 1);
  // Where the browser links animations to scroll, the art has also faded out.
  if (await page.evaluate(() => CSS.supports("animation-timeline", "scroll()"))) expect(art1!.opacity).toBe(0);
  expect(Math.abs(pinned1!.y - top), "the pinned card is held at the top of the page").toBeLessThanOrEqual(1);

  // The title, the issue line and both buttons are still on screen and pressable.
  expect((await findText(page, "THE RISE OF RED SKULL", "CampaignSaga")).length).toBeGreaterThan(0);
  expect((await findText(page, "ISSUE 3 OF 5", "CampaignSaga")).length).toBeGreaterThan(0);
  const stops = (await routeStops(page, "CampaignSaga"))!.stops;
  for (const key of ["alt-0", "alt-1", "cta"]) {
    const stop = stops.find((s) => s.key === key)!;
    expect(stop, key).toBeTruthy();
    expect(stop.rect.y, `${key} is on screen`).toBeGreaterThanOrEqual(top - 1);
    expect(stop.rect.y + stop.rect.height).toBeLessThanOrEqual(info.project.use.viewport!.height + 1);
  }

  // A swipe that lifts over DOSSIER presses nothing (the phone rule).
  const dossier = stops.find((s) => s.key === "alt-0")!;
  const x = dossier.rect.x + dossier.rect.width / 2;
  const endY = dossier.rect.y + dossier.rect.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: endY + 220, id: 1 }] });
  for (let step = 1; step <= 12; step++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: endY + 220 - (220 * step) / 12, id: 1 }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await settle(page);
  expect(await screens(page)).not.toContain("CampaignDossier");
  await waitForScene(page, "CampaignSaga", 3000);

  // A real tap on it does press it.
  const again = (await routeStops(page, "CampaignSaga"))!.stops.find((s) => s.key === "alt-0")!;
  await page.touchscreen.tap(again.rect.x + again.rect.width / 2, again.rect.y + again.rect.height / 2);
  await waitForScene(page, "CampaignDossier", 20_000);
});

test("scrolling back to the top restores the whole card", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a phone");
  test.setTimeout(120_000);
  await openLiveSaga(page);
  const top = (await part(page, "saga-volumes"))!.y;
  await scrollPage(page, 100000);
  await scrollPage(page, 0);
  const art = await part(page, "saga-art");
  expect(art!.opacity).toBe(1);
  expect(art!.y, "the art is back at the top").toBeGreaterThanOrEqual(top);
  expect(art!.height).toBeGreaterThan(100);
});

test("keyboard focus moving down the list scrolls the page so the focused row is seen below the pinned card", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "a phone");
  test.setTimeout(120_000);
  await openLiveSaga(page);
  const scroller = (await part(page, "saga-volumes"))!;
  const pinnedHeight = (await part(page, "saga-pinned"))!.height;
  // Tab through the stops until the last volume has the ring.
  const focused = async (): Promise<string | null> =>
    page.evaluate(() => {
      const w = window as unknown as { __mcFocusState?: Record<string, () => { focus: string | null }> };
      return w.__mcFocusState?.CampaignSaga?.().focus ?? null;
    });
  for (let presses = 0; presses < 40 && (await focused()) !== "vol-11"; presses++) {
    await pressKey(page, "Tab");
  }
  expect(await focused(), "the last volume has focus").toBe("vol-11");
  await settle(page);
  const row = (await routeStops(page, "CampaignSaga"))!.stops.find((s) => s.key === "vol-11")!;
  expect(row.rect.y, "below the pinned card").toBeGreaterThanOrEqual(scroller.y + pinnedHeight - 2);
  expect(row.rect.y + row.rect.height, "inside the page").toBeLessThanOrEqual(scroller.y + scroller.height + 1);
});
