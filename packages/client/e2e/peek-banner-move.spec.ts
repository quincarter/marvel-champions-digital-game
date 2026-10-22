import { expect, test, type Page } from "@playwright/test";
import { pressAt, settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";

/**
 * Issue #329: on a phone the peek banner covered the main scheme or the first enemy. It is now one compact line with
 * MOVE (top or bottom of the screen, remembered) and BACK. Played on the choice sheet's peek (`?screen=choice`) and
 * the villain phase's own peek (`?screen=villain-decision`, phone only: the other form factors hide the rail instead).
 */

const peekDebug = <T>(page: Page, name: string): Promise<T | null> =>
  page.evaluate(
    (n) =>
      ((window as unknown as { __mcChoicePeekDebug?: Record<string, () => unknown> }).__mcChoicePeekDebug?.[n]?.() ??
        null) as never,
    name,
  );

const press = async (page: Page, phone: boolean, rect: Rect): Promise<void> => {
  await settle(page);
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (phone) await page.touchscreen.tap(x, y);
  else await pressAt(page, x, y);
  await settle(page);
};

test("issue #329: the choice sheet's peek banner is compact, MOVE flips it to the top, and BACK still returns", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=choice");
  await press(page, phone, (await waitFor(() => peekDebug<Rect>(page, "peekRect"), "PEEK AT TABLE", 30_000))!);
  await waitFor(async () => ((await peekDebug<boolean>(page, "peeking")) ? true : null), "peeking", 10_000);

  const size = page.viewportSize()!;
  const low = (await peekDebug<Rect>(page, "bannerRect"))!;
  expect(low.height, "a compact banner").toBeLessThan(60);
  expect(low.y + low.height, "at the foot by default").toBeGreaterThan(size.height - 20);

  await press(page, phone, (await peekDebug<Rect>(page, "moveRect"))!);
  await waitFor(async () => ((await peekDebug<string>(page, "edge")) === "top" ? true : null), "banner at top", 10_000);
  const high = (await peekDebug<Rect>(page, "bannerRect"))!;
  expect(high.y, "moved up, clear of the title bar").toBeLessThan(low.y);
  expect(high.y).toBeGreaterThanOrEqual(36);
  expect(high.y + high.height).toBeLessThan(size.height / 3);

  await press(page, phone, (await peekDebug<Rect>(page, "backRect"))!);
  await waitFor(
    async () => ((await peekDebug<boolean>(page, "peeking")) ? null : true),
    "back to the decision",
    10_000,
  );
  expect(errors).toEqual([]);
});

test("issue #329: the villain phase's peek banner moves between the bottom and the top of the table, BACK still returns", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the villain phase peeks at the table on a phone's tabbed board");
  test.setTimeout(150_000);
  const errors = trackErrors(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  await installWave6Helpers(page);
  await page.goto("/?screen=villain-decision");
  await press(page, true, (await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000))!);
  await press(page, true, (await waitFor(() => villainDebugRect(page, "peekRect"), "PEEK AT TABLE", 30_000))!);
  const rect = (name: string) => waitFor(() => villainDebugRect(page, name), name, 10_000);
  const low = (await rect("bannerRect"))!;
  expect(low.height, "a compact banner").toBeLessThan(60);

  await press(page, true, (await rect("moveRect"))!);
  await waitFor(async () => ((await rect("bannerRect"))!.y < low.y ? true : null), "banner moved up", 10_000);
  const high = (await rect("bannerRect"))!;
  expect(high.y, "under the tab rail").toBeGreaterThanOrEqual(80);

  await press(page, true, (await rect("moveRect"))!);
  await waitFor(async () => ((await rect("bannerRect"))!.y === low.y ? true : null), "banner back at the foot", 10_000);

  await press(page, true, (await rect("backRect"))!);
  await waitFor(
    async () =>
      (await page.evaluate(
        () =>
          (
            window as unknown as { __mcVillainPhaseDebug?: { presentation?: () => string } }
          ).__mcVillainPhaseDebug?.presentation?.() ?? null,
      )) === "peek"
        ? null
        : true,
    "back to the phase",
    10_000,
  );
  expect(errors).toEqual([]);
});
