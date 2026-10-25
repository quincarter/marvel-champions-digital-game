import { expect, test, type Page } from "@playwright/test";
import { focusRect, handInstanceFor, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardText, playFromHand, press, waitForBoardText } from "./x-men-helpers.js";

/**
 * Make the Call (01071, #419 and #420): "Pay the printed cost of an ally in any player's discard pile." The pick is a
 * sheet of every ally in the discard piles, each tagged with whose pile it is in; a tap selects one and Confirm goes on
 * to the pay step. The `many` fixture puts every ally of the deck, and more, in the discard pile: more than the 360 px
 * phone the reporter used holds on one sheet, so the list pages: every face stays on the sheet, and Next shows the rest.
 */
const MAKE_THE_CALL = "01071";

const TITLE = /^Make the Call: choose the ally/i;
const sheetUp = async (page: Page): Promise<boolean> => (await boardText(page, TITLE)) !== undefined;

test("Make the Call: the ally sheet pages on a 360 px phone, and a selected ally goes on to Confirm", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  if (phone) await page.setViewportSize({ width: 360, height: 788 });
  await installWave6Helpers(page);
  await openApp(page, "screen=board&fixture=make-the-call&many=1&unlock=all", { landing: "Board" });
  await settle(page);
  const call = await waitFor(() => handInstanceFor(page, MAKE_THE_CALL), "Make the Call is in the hand", 60000);

  await playFromHand(page, phone, call, () => sheetUp(page));
  await waitForBoardText(page, TITLE, "the sheet's title names the pick");
  await waitForBoardText(page, /^CAPTAIN MAR/, "each ally's face is tagged with whose discard pile it is in");
  const viewport = page.viewportSize()!;
  if (SHOT) await page.screenshot({ path: `${SHOT}/make-the-call-${info.project.name}-page1.png` });

  const pageLabel = await boardText(page, /^Page 1 of \d+$/);
  if (phone) expect(pageLabel, "the phone's list is longer than one sheet").toBeTruthy();
  if (pageLabel) {
    const next = await waitForBoardText(page, /^Next$/i, "Next is under the list");
    expect(next.x).toBeLessThan(viewport.width);
    await press(page, phone, next.x, next.y);
    await waitForBoardText(page, /^Page 2 of \d+$/, "Next shows the second page");
    if (SHOT) await page.screenshot({ path: `${SHOT}/make-the-call-${info.project.name}-page2.png` });
  }

  // Select the first ally on the page shown, then Confirm goes on to the pay step. Each tile's focus rect is keyed by
  // its index in the whole list, so the page's first tile is the first key with a rect.
  const tile = await waitFor(
    async () => {
      for (let index = 0; index < 40; index++) {
        const rect = await focusRect(page, `searched:${index}`);
        if (rect) return rect;
      }
      return null;
    },
    "a tile of the page shown",
    10000,
  );
  expect(tile.x + tile.width).toBeLessThanOrEqual(viewport.width);
  await press(page, phone, tile.x + tile.width / 2, tile.y + tile.width / 2);
  await settle(page);
  if (SHOT) await page.screenshot({ path: `${SHOT}/make-the-call-${info.project.name}-selected.png` });
  const confirm = await waitForBoardText(page, /^Confirm$/i, "Confirm is in the sheet's header");
  await press(page, phone, confirm.x, confirm.y);
  await waitFor(async () => ((await sheetUp(page)) ? null : true), "Confirm closes the sheet for the pay step", 10000);
  await settle(page);
  if (SHOT) await page.screenshot({ path: `${SHOT}/make-the-call-${info.project.name}-pay.png` });
});
