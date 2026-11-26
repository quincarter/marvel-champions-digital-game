import { expect, test } from "@playwright/test";
import { settle } from "./helpers.js";
import { trackErrors, waitForScene } from "./wave6-helpers-a.js";

/**
 * A line arriving in the room chat sheet, or a resize, redraws the sheet but must keep the same text field: a rebuilt
 * field loses the caret and selection, an IME composition and a phone's keyboard session. Run against the dev preview
 * (`?screen=room-chat`, `scenes/boot-dev-jump.ts`), whose `__mcChatArrives(text)` delivers a line from another player.
 */

test("a chat line arriving keeps the draft, its selection and the field's focus", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await page.goto("/?screen=room-chat");
  await waitForScene(page, "RoomChatOverlay", 30000);
  const input = page.locator("input, textarea").last();
  await expect(input).toBeFocused();
  await page.keyboard.type("hello brave world");
  await expect(input).toHaveValue("hello brave world");
  // Select "brave" (characters 6 to 11), as a player editing the middle of a draft would.
  await input.evaluate((el) => (el as HTMLInputElement).setSelectionRange(6, 11));
  const handle = await input.elementHandle();

  await page.evaluate(() =>
    (window as unknown as { __mcChatArrives: (t: string) => void }).__mcChatArrives("Over here!"),
  );
  await settle(page, { quietMs: 400, maxMs: 2000 });
  // A resize (the keyboard opening) redraws too.
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width, height: Math.round(size.height * 0.8) });
  await settle(page, { quietMs: 400, maxMs: 2000 });

  await expect(input).toBeFocused();
  await expect(input).toHaveValue("hello brave world");
  expect(
    await input.evaluate((el) => [(el as HTMLInputElement).selectionStart, (el as HTMLInputElement).selectionEnd]),
  ).toEqual([6, 11]);
  // The very same element, not a rebuilt one.
  expect(await handle!.evaluate((el) => el.isConnected)).toBe(true);
  expect(errors).toEqual([]);
});
