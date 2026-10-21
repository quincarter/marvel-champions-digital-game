import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressAt, settle, waitFor, zoneRect } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, gameFacts, hook, openApp, startGame, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #308: Spectrum's three energy form upgrades sat facedown in the play row, and the form picker showed their
 * backs. They now sit faceup, stacked, in an "Energy forms" column beside the play area: the desktop hover popover
 * opens on the front card and a tap fans all three out in the pile view. The column is next to the play row, which
 * scrolls sideways, so a swipe of the row that lifts over the stack must not press it (issue #227).
 */

const FORM_CODES = ["21002", "21003", "21004"];

const hitRect = (page: Page, id: string): Promise<Rect | null> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcBoardDebug?: { hitRect(id: string): Rect | null } }).__mcBoardDebug?.hitRect(key) ??
      null,
    id,
  );

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

test("issue #308: Spectrum's energy forms sit faceup beside the play area; stacked beside the play area; a swipe that lifts on the stack opens nothing, a tap fans them out", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["spectrum-leadership"], seed: 3 });
  await declineMulligans(page);
  await settle(page);

  const forms = await gameFacts<string[]>(
    page,
    `(s) => s.game.players[0].playArea.filter((id) => ${JSON.stringify(FORM_CODES)}.includes(s.game.instances[id].cardId))`,
  );
  expect(forms).toHaveLength(3);
  // The forms are a stack: the front card is the one on the table (in alter-ego form, the first printed, Gamma).
  const front = await waitFor(async () => {
    for (const id of forms) {
      const rect = await hitRect(page, id);
      if (rect) return { id, rect };
    }
    return null;
  }, "the energy form stack on the table");
  const play = (await zoneRect(page, "playArea"))!;
  expect(front.rect.x, "the stack sits in the play area's right-hand column").toBeGreaterThan(play.x + play.width / 2);
  expect(front.rect.x + front.rect.width).toBeLessThanOrEqual(play.x + play.width + 0.5);

  if (!phone) {
    // The desktop hover popover opens on the front card.
    await page.mouse.move(front.rect.x + front.rect.width / 2, front.rect.y + front.rect.height / 2);
    await waitFor(
      async () => ((await hook<string>(page, "__mcBoardDebug", "hoverShown")) ? true : null),
      "the hover popover on an energy form",
    );
    if (SHOT) await page.screenshot({ path: `${SHOT}/spectrum-energy-forms-hover-${info.project.name}.png` });
    await page.mouse.move(5, 5);
  }

  // A crowded play row scrolls sideways, as in issue #227: swipe it and lift on the stack.
  await hook(page, "__mcBoardDebug", "setBoardPad", { playArea: 8 });
  await settle(page);
  const target = (await hitRect(page, front.id))!;
  const y = target.y + target.height / 2;
  if (SHOT) await page.screenshot({ path: `${SHOT}/spectrum-energy-forms-${info.project.name}.png` });
  await drag(page, phone, { x: play.x + 30, y }, { x: target.x + target.width / 2, y });
  await settle(page);
  const opened = await activeScenes(page);
  expect(opened, "a swipe that lifted on the stack opens nothing").not.toContain("PileViewOverlay");
  expect(opened).not.toContain("InspectOverlay");

  // A tap on the stack fans every form out, faceup.
  if (phone) await page.touchscreen.tap(target.x + target.width / 2, y);
  else await pressAt(page, target.x + target.width / 2, y);
  await waitFor(
    async () => ((await activeScenes(page)).includes("PileViewOverlay") ? true : null),
    "the forms fan out on a tap of the stack",
    15_000,
  );
  if (SHOT) {
    await settle(page);
    await page.screenshot({ path: `${SHOT}/spectrum-energy-forms-fanned-${info.project.name}.png` });
  }
  expect(errors).toEqual([]);
});
