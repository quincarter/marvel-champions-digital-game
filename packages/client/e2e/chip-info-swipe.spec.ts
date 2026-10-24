import { expect, test, type Page } from "@playwright/test";
import { findText, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Take your seats, phone: the aspect chips scroll sideways in a rail and each carries an (i). A swipe of the rail that
 * lifts the finger over an (i) opens no tip; a tap on the (i) opens it, and a tap elsewhere shuts it
 * (`docs/controller-support.md`; the no-tap-on-finger-lift rule).
 */

const TIP_LINK = "Aspects ▸";

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
        "Seats"
      ]!().find((stop) => stop.key === k)?.rect ?? null,
    key,
  );

async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const steps = 10;
  const cdp = await page.context().newCDPSession(page);
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(i), id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("a swipe of the aspect chip rail that lifts over an (i) opens nothing; a tap opens it", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the finger-lift rule is a phone rule");
  test.setTimeout(120_000);
  await openApp(page, "screen=seats&unlock=all", { landing: "Seats" });
  await page.waitForTimeout(800);
  const info = await waitFor(() => stopRect(page, "hero-chip-info:aggression"), "the first aspect's (i)", 15_000);
  const y = info.y + info.height / 2;
  const centre = info.x + info.width / 2;
  // The rail moves under the finger; wherever it lifts, no tip opens.
  await swipe(page, { x: centre + 150, y }, { x: centre, y });
  await page.waitForTimeout(500);
  expect(await findText(page, TIP_LINK, "Seats")).toHaveLength(0);
  // Back to the start, then a tap on the (i).
  await swipe(page, { x: centre - 60, y }, { x: centre + 260, y });
  await page.waitForTimeout(500);
  const again = (await stopRect(page, "hero-chip-info:aggression"))!;
  await page.touchscreen.tap(again.x + again.width / 2, again.y + again.height / 2);
  await waitFor(
    async () => ((await findText(page, TIP_LINK, "Seats")).length > 0 ? true : null),
    "a tap on the (i) opens the tip",
    10_000,
  );
  // A press anywhere else shuts it.
  await page.touchscreen.tap(200, 700);
  await waitFor(
    async () => ((await findText(page, TIP_LINK, "Seats")).length === 0 ? true : null),
    "a press elsewhere shuts the tip",
    10_000,
  );
});
