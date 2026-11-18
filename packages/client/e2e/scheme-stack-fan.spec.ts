import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, findText, pressAt, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, startGame, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #808, Stack schemes: the table stacks the schemes like a deck, and Fan out spreads them over the table. A tap on
 * a fanned card brings it to the front of the stack. On a phone the fan is a list that scrolls, and a swipe of it that
 * lifts over a card must never pick that card (the no-tap-on-lift rule, #227).
 */

const fanCards = (page: Page): Promise<(Rect | null)[]> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcSchemeFanDebug?: { cards(): (Rect | null)[] } }).__mcSchemeFanDebug?.cards() ?? [],
  );

const fanList = (page: Page): Promise<Rect | null> =>
  page.evaluate(
    () => (window as unknown as { __mcSchemeFanDebug?: { list(): Rect } }).__mcSchemeFanDebug?.list() ?? null,
  );

/** A finger drag from `from` to `to`, lifted at `to`, as real touch events. */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const steps = 12;
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(i), id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const fanOpen = async (page: Page): Promise<boolean> => (await activeScenes(page)).includes("SchemeFanOverlay");

test("issue #808: the scheme stack fans out, a fanned card comes to the front, and a swipe of the fan picks nothing", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem("mc-settings", JSON.stringify({ version: 1, schemeStack: true }));
  });
  await installWave6Helpers(page);
  await openApp(page);
  // Project Wideawake starts with three side schemes beside its main scheme.
  await startGame(page, { scenarioId: "project-wideawake", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page);
  if (phone) await clickText(page, "THREAT", { sceneKey: "Board" });
  await settle(page);
  expect((await findText(page, "SCHEMES · 1 OF", "Board")).length, "the stack's header shows the front card").toBe(1);

  await clickText(page, "FAN OUT", { sceneKey: "Board" });
  await waitFor(async () => ((await fanOpen(page)) ? true : null), "the fan opens", 10_000);
  await settle(page);
  if (SHOT) await page.screenshot({ path: `${SHOT}/scheme-fan-${info.project.name}.png` });

  if (phone) {
    // A swipe up the list that starts on one card and lifts on another scrolls it, and picks neither.
    const view = (await fanList(page))!;
    const x = view.x + view.width / 2;
    await swipe(page, { x, y: view.y + view.height - 30 }, { x, y: view.y + 60 });
    await settle(page);
    expect(await fanOpen(page), "a swipe that lifted on a card leaves the fan open").toBe(true);
  }

  // A tap on a card past the front one that is wholly in view brings it to the front and closes the fan. The fan lists
  // the stack front first, and the front is the main scheme, so card k is the scheme the header counts as k + 1.
  const list = (await fanList(page))!;
  const whole = (rect: Rect | null): rect is Rect =>
    rect !== null && rect.y >= list.y - 1 && rect.y + rect.height <= list.y + list.height + 1;
  const picked = await waitFor(
    async () => {
      const cards = await fanCards(page);
      const index = cards.findIndex((rect, at) => at > 0 && whole(rect));
      return index > 0 ? { index, rect: cards[index]! } : null;
    },
    "a card past the front one is wholly on screen",
    10_000,
  );
  const at = { x: picked.rect.x + picked.rect.width / 2, y: picked.rect.y + picked.rect.height / 2 };
  if (phone) await page.touchscreen.tap(at.x, at.y);
  else await pressAt(page, at.x, at.y);
  await waitFor(async () => ((await fanOpen(page)) ? null : true), "the fan closes on a pick", 10_000);
  await settle(page);
  expect(
    (await findText(page, `SCHEMES · ${picked.index + 1} OF`, "Board")).length,
    "the picked scheme is at the front",
  ).toBe(1);
  expect(errors).toEqual([]);
});
