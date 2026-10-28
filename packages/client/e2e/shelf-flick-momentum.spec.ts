import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, trackPageErrors, waitFor } from "./helpers.js";
import { hook, openApp, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #478: a sideways flick of a hero or scenario shelf stopped dead the moment the finger lifted, while a flick up
 * or down the column of shelves kept coasting. Now a sideways flick coasts along the shelf it flicked, on a phone and
 * with a mouse alike, and the release picks no card.
 */

interface Stop extends Rect {
  readonly key: string;
}

const SCREENS = [
  {
    scene: "ScenarioSelect",
    query: "screen=scenario-select&unlock=all",
    hook: "__mcScenarioSelectDebug",
    prefix: "scenario:",
  },
  { scene: "Seats", query: "screen=seats&unlock=all", hook: "__mcSeatsDebug", prefix: "hero:" },
] as const;

const cardStops = async (page: Page, debug: string, prefix: string): Promise<Stop[]> =>
  ((await hook<Stop[]>(page, debug, "stops")) ?? []).filter((s) => s.key.startsWith(prefix));

/** A finger (phone) or mouse (desktop) flick from `from` to `to`, lifted at `to` without pausing. */
async function flick(page: Page, phone: boolean, from: { x: number; y: number }, to: { x: number; y: number }) {
  const steps = 6;
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

for (const screen of SCREENS) {
  test(`issue #478: a sideways flick of a ${screen.scene} shelf keeps coasting after the lift`, async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    const phone = info.project.name === "phone";
    const errors = trackPageErrors(page);
    // A narrower desktop window than the project's 1440: a pack shelf there runs far enough past its edge for a flick.
    if (!phone) await page.setViewportSize({ width: 1024, height: 900 });
    await openApp(page, screen.query, { landing: screen.scene });
    await waitFor(
      async () => ((await cardStops(page, screen.hook, screen.prefix)).length > 0 ? true : null),
      "the shelves",
      30_000,
    );
    await settle(page);
    const { width, height } = page.viewportSize()!;

    // A shelf, its card row across the middle of the screen, whose cards run well past its right edge: room for the flick and for
    // the coast after it. Scroll the column down until one shows.
    const flickPx = Math.round(Math.min(width * 0.3, 200));
    const row = await waitFor(
      async () => {
        const stops = await cardStops(page, screen.hook, screen.prefix);
        const rows = new Map<number, Stop[]>();
        for (const s of stops) rows.set(Math.round(s.y), [...(rows.get(Math.round(s.y)) ?? []), s]);
        const found = [...rows.values()].find((cards) => {
          const middle = cards[0]!.y + cards[0]!.height / 2;
          const overflow = Math.max(...cards.map((c) => c.x + c.width)) - width;
          return middle > height * 0.3 && middle < height * 0.85 && overflow > flickPx + 100;
        });
        if (found) return found;
        await page.mouse.move(width / 2, height * 0.6);
        await page.mouse.wheel(0, 150);
        await settle(page, { quietMs: 150, maxMs: 600 });
        return null;
      },
      "a shelf that overflows its width",
      30_000,
    );
    await settle(page);
    const tracked = row[0]!.key;
    const xOf = async (): Promise<number> =>
      (await cardStops(page, screen.hook, screen.prefix)).find((s) => s.key === tracked)!.x;
    const scenesBefore = await activeScenes(page);
    const y = row[0]!.y + row[0]!.height / 2;
    const startX = await xOf();
    const name = `shelf-flick-${screen.scene}-${info.project.name}`;
    if (SHOT) await page.screenshot({ path: `${SHOT}/${name}-1-before.png` });

    // From the second card of the row (inside the roster, clear of the desktop's detail panel on the right).
    const fromX = Math.min(width * 0.7, row[0]!.x + row[0]!.width * 1.5);
    await flick(page, phone, { x: fromX, y }, { x: fromX - flickPx, y });
    await page.waitForTimeout(1000);
    const afterCoast = await xOf();
    if (SHOT) await page.screenshot({ path: `${SHOT}/${name}-2-after.png` });

    // The drag alone moves the shelf exactly as far as the finger went; momentum carries it on past that (it used to
    // stop dead, at startX - flickPx). Measured against the drag rather than the moment of the lift, so a fast coast
    // that is already over by the first read still counts.
    expect(afterCoast, "the shelf coasted on past where the finger lifted").toBeLessThan(startX - flickPx - 20);
    // And the release picked nothing.
    expect(await activeScenes(page)).toEqual(scenesBefore);
    expect(errors).toEqual([]);
  });
}
