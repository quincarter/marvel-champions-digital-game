import { expect, test, type Page } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import { clickStop, installWave6Helpers, openSaga, trackErrors, waitForScene } from "./wave6-helpers-a.js";
import { hook, quietGuide, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #272: a row of the campaign roster's deck picker drew its hero's name, source note and reason line blank. The
 * row tracked its button's hover through the zone's own `pointerover`/`pointerout`, but a finger's hover ends without a
 * `pointerout`: the button went back to its rest fill while the row's text kept the hover colors, light on light. Now
 * the row follows the button's own hover, so after a finger lands on a row and swipes off, every row's text is in the
 * colors of the state its button shows. On a phone, a sideways swipe across a row also no longer seats its hero.
 */

interface RowText {
  name: string;
  rect: Rect;
  state: string;
  expected: string;
  title: string;
}

const rowTexts = async (page: Page): Promise<RowText[]> =>
  (await hook<RowText[]>(page, "__mcRosterPickerDebug", "rowTexts")) ?? [];

const expectRowsReadable = async (page: Page, when: string): Promise<void> => {
  for (const row of await rowTexts(page)) {
    expect(row.title, `${row.name}'s name is drawn in its ${row.state} colors ${when}`).toBe(row.expected);
  }
};

test("issue #272: a picker row's name keeps its button's colors after a finger or mouse leaves it", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.goto("/?unlock=all");
  await openSaga(page);
  await clickStop(page, "vol-1", "CampaignSaga");
  await settle(page);
  await clickStop(page, "cta", "CampaignSaga");
  await waitForScene(page, "CampaignCover");
  await settle(page);
  await clickStop(page, "cta", "CampaignCover");
  await waitForScene(page, "CampaignRoster");
  await settle(page);
  await clickStop(page, "seat-2", "CampaignRoster");
  await settle(page);
  const rows = await waitFor(async () => {
    const drawn = await rowTexts(page);
    return drawn.length >= 2 ? drawn : null;
  }, "the deck picker draws its rows");
  await expectRowsReadable(page, "when the picker opens");

  // The first row drawn wholly inside the picker's panel (the list draws a row past its foot ready to scroll in).
  const panel = (await hook<Rect>(page, "__mcRosterPickerDebug", "panel"))!;
  const target = rows.find((row) => row.rect.y >= panel.y && row.rect.y + row.rect.height <= panel.y + panel.height)!;
  expect(target, "a row sits inside the panel").toBeTruthy();
  const at = { x: target.rect.x + target.rect.width / 2, y: target.rect.y + target.rect.height / 2 };
  if (phone) {
    // A finger lands on the row (its button shows the press highlight) and drags the list up past the tap slop.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...at, id: 1 }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: at.x, y: at.y - i * 4, id: 1 }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(at.x, at.y);
    await settle(page);
    const hovered = (await rowTexts(page)).find((row) => row.name === target.name)!;
    expect(hovered.state).toBe("hover");
    await expectRowsReadable(page, "while the mouse is over a row");
    await page.mouse.move(4, 4);
  }
  await settle(page);
  expect(await hook<boolean>(page, "__mcRosterPickerDebug", "open"), "the swipe left the picker open").toBe(true);
  const after = (await rowTexts(page)).find((row) => row.name === target.name)!;
  expect(after.state, "the row's button is back at rest").toBe("rest");
  await expectRowsReadable(page, "after the pointer leaves");
  if (SHOT) await page.screenshot({ path: `${SHOT}/roster-picker-row-text-${info.project.name}.png` });

  if (phone) {
    // A finger sliding sideways across a row never scrolls the list; lifted over the row, it is a swipe, not a tap,
    // so the picker stays open and the seat keeps its hero (the list once read any swipe that didn't scroll as a tap).
    const row = (await rowTexts(page)).find(
      (r) => r.rect.y >= panel.y && r.rect.y + r.rect.height <= panel.y + panel.height,
    )!;
    const from = { x: row.rect.x + 40, y: row.rect.y + row.rect.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: from.x + i * 20, y: from.y, id: 1 }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    await settle(page);
    expect(await hook<boolean>(page, "__mcRosterPickerDebug", "open"), "a sideways swipe picks no hero").toBe(true);
    await expectRowsReadable(page, "after a sideways swipe");
  }
  expect(errors).toEqual([]);
});
