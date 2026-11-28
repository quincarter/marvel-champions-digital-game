import { expect, test, type Page } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import {
  clickStop,
  installWave6Helpers,
  openSaga,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";
import { hook, quietGuide, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #272: a row of the campaign roster's deck picker drew its hero's name, source note and reason line blank after a
 * finger or the mouse left it (the Phaser row tracked its button's hover by hand). The picker is now a panel whose rows are
 * plain parts: every row keeps its words wherever the pointer has been, and a finger sliding across a row, sideways or up,
 * is a swipe and never a tap, so no hero is seated by one.
 */

interface RowBox {
  name: string;
  rect: Rect;
}

const rows = async (page: Page): Promise<RowBox[]> =>
  (await hook<RowBox[]>(page, "__mcRosterPickerDebug", "rowTexts")) ?? [];

/** Every drawn row's hero name is on screen, in the roster's panel. */
const expectRowsReadable = async (page: Page, when: string): Promise<void> => {
  const shown = (await visibleTexts(page)).filter((t) => t.scene === "CampaignRoster").map((t) => t.text.toUpperCase());
  for (const row of await rows(page)) {
    if (row.rect.y < 0) continue;
    expect(
      shown.some((text) => text.includes(row.name.toUpperCase())),
      `${row.name}'s name is drawn ${when}`,
    ).toBe(true);
  }
};

async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 10; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10, id: 1 }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("issue #272: a picker row keeps its words after a finger or the mouse leaves it, and a swipe seats nobody", async ({
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
  await waitFor(async () => ((await rows(page)).length >= 2 ? true : null), "the deck picker draws its rows");
  await expectRowsReadable(page, "when the picker opens");

  const panel = (await hook<Rect>(page, "__mcRosterPickerDebug", "panel"))!;
  const inside = (): Promise<RowBox> =>
    waitFor(async () => {
      const found = (await rows(page)).find(
        (row) => row.rect.y >= panel.y && row.rect.y + row.rect.height <= panel.y + panel.height,
      );
      return found ?? null;
    }, "a row inside the panel");
  const target = await inside();
  const at = { x: target.rect.x + target.rect.width / 2, y: target.rect.y + target.rect.height / 2 };
  if (phone) {
    // A finger lands on the row and drags the list up past the tap slop.
    await swipe(page, at, { x: at.x, y: at.y - 40 });
  } else {
    await page.mouse.move(at.x, at.y);
    await settle(page);
    await expectRowsReadable(page, "while the mouse is over a row");
    await page.mouse.move(4, 4);
  }
  await settle(page);
  expect(await hook<boolean>(page, "__mcRosterPickerDebug", "open"), "the swipe left the picker open").toBe(true);
  await expectRowsReadable(page, "after the pointer leaves");
  if (SHOT) await page.screenshot({ path: `${SHOT}/roster-picker-row-text-${info.project.name}.png` });

  if (phone) {
    // A finger sliding sideways across a row never scrolls the list; lifted over the row, it is a swipe, not a tap, so the
    // picker stays open and the seat keeps its hero.
    const row = await inside();
    const from = { x: row.rect.x + 40, y: row.rect.y + row.rect.height / 2 };
    await swipe(page, from, { x: from.x + 160, y: from.y });
    await settle(page);
    expect(await hook<boolean>(page, "__mcRosterPickerDebug", "open"), "a sideways swipe picks no hero").toBe(true);
    await expectRowsReadable(page, "after a sideways swipe");
  }
  expect(errors).toEqual([]);
});
