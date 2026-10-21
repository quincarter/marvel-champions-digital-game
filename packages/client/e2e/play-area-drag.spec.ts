import { expect, test, type Page } from "@playwright/test";
import { pressAt, settle, waitFor, zoneRect } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, hook, openApp, startGame } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Reported from a phone: a sideways swipe of a crowded play area that lifted over the ‹ › arrows at its edges paged
 * the row as well, because the arrows fired on any release over them; and the row only scrolled when the finger
 * started on a card. Now an arrow takes only a real tap (a drag that starts on one scrolls like the rest of the row),
 * and a drag that starts anywhere in the zone scrolls it.
 */

type Point = { readonly x: number; readonly y: number };

const scrollOf = async (page: Page): Promise<{ scrollX: number; maxScroll: number }> =>
  (await hook<{ scrollX: number; maxScroll: number }>(page, "__mcBoardDebug", "playAreaScroll"))!;

/** A finger (phone) or mouse (desktop) drag from `from` to `to`, held still before the lift so the row does not coast. */
async function drag(page: Page, phone: boolean, from: Point, to: Point): Promise<void> {
  const steps = 12;
  const at = (i: number): Point => ({
    x: from.x + ((to.x - from.x) * i) / steps,
    y: from.y + ((to.y - from.y) * i) / steps,
  });
  if (!phone) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
    await page.waitForTimeout(200); // still before the lift: a placement, not a flick
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(i), id: 1 }] });
  await page.waitForTimeout(200); // still before the lift: a placement, not a flick
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("a swipe that lifts over the play area's arrow does not page the row; a drag from anywhere in the zone scrolls it", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page);
  await hook(page, "__mcBoardDebug", "setBoardPad", { playArea: 13 });
  await settle(page);

  const zone = await waitFor(async () => await zoneRect(page, "playArea"), "the play area is on screen", 15_000);
  const start = await scrollOf(page);
  expect(start.maxScroll, "the crowded row scrolls").toBeGreaterThan(0);
  expect(start.scrollX).toBe(0);
  // The right arrow's band: 28px wide inside the zone's 8px right margin, the full height of the card row.
  const arrow: Point = { x: zone.x + zone.width - 22, y: zone.y + zone.height / 2 + 8 };
  const page80 = (zone.width - 16) * 0.8;

  // A rightward swipe across the cards that lifts over the right arrow: the row is already at its start, and the
  // arrow must not page it on.
  await drag(page, phone, { x: zone.x + zone.width * 0.35, y: arrow.y }, arrow);
  await settle(page);
  expect((await scrollOf(page)).scrollX, "lifting over the arrow pressed nothing").toBe(0);

  // A drag that starts on the arrow scrolls the row by the drag, not by a page as well.
  await drag(page, phone, arrow, { x: arrow.x - 120, y: arrow.y });
  await settle(page);
  const fromArrow = (await scrollOf(page)).scrollX;
  expect(fromArrow, "a drag from the arrow scrolls the row").toBeGreaterThan(50);
  expect(fromArrow, "and does not page it as well").toBeLessThan(Math.min(180, page80));

  // A drag that starts above the cards, on the zone's caption band, scrolls the row too.
  const band = zone.y + 4;
  await drag(page, phone, { x: zone.x + zone.width * 0.7, y: band }, { x: zone.x + zone.width * 0.3, y: band });
  await settle(page);
  const fromBand = (await scrollOf(page)).scrollX;
  expect(fromBand, "a drag from outside any card scrolls the row").toBeGreaterThan(fromArrow + 50);
  if (SHOT) await page.screenshot({ path: `${SHOT}/play-area-drag-${info.project.name}.png` });

  // A real tap on the arrow still pages the row.
  if (phone) await page.touchscreen.tap(arrow.x, arrow.y);
  else await pressAt(page, arrow.x, arrow.y);
  await settle(page);
  const after = await scrollOf(page);
  expect(after.scrollX, "a tap on the arrow pages the row").toBeGreaterThan(
    Math.min(after.maxScroll - 1, fromBand + 100),
  );
  expect(errors).toEqual([]);
});
