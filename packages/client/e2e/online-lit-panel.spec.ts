import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressKey, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Play online draws its controls (name, Host, the join code and Join, "Live now") as a Lit panel over the canvas, and
 * its name prompt as a pop-up panel above it (`dom/sheet-builder.ts`, `dom/popup-sheet.ts`): the keyboard walks the
 * same stops with the DOM focus ring, Enter presses the focused one, Escape backs out of the prompt and then the screen.
 */

const sheet = (page: Page, scene: string) => page.locator(`#mc-ui [data-scene="${scene}"] mc-sheet`);

const focusOf = (page: Page, scene: string) =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null; ringShown: boolean }> })
        .__mcFocusState[key]!(),
    scene,
  );

test("Play online is a panel the keyboard walks, the name prompt stacks above it, and Escape backs out", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  await openApp(page, "screen=online", { landing: "Online" });
  await waitForText(page, "Host a room", { sceneKey: "Online" });
  const online = sheet(page, "Online");
  await expect(online).toBeVisible();
  await expect(online.locator('[data-key="host"]')).toBeVisible();
  await expect(online.locator('[data-key="join"]')).toBeVisible();

  // The keyboard walks the stops in order (Tab); the ring is drawn in the DOM, over the panel.
  const seen: string[] = [];
  let focus: string | null = null;
  for (let i = 0; i < 8; i++) {
    await pressKey(page, "Tab");
    const state = await focusOf(page, "Online");
    focus = state.focus;
    if (focus && !seen.includes(focus)) seen.push(focus);
    if (focus === "name" && seen.includes("join")) break;
  }
  expect(seen).toEqual(expect.arrayContaining(["name", "host", "code", "join"]));
  expect((await focusOf(page, "Online")).ringShown).toBe(true);
  await expect(page.locator("#mc-ui .mc-focus-ring").last()).toBeVisible();

  // The name stop opens the prompt (no name is set yet): its panel sits above Play online's, which stays shown.
  expect(focus).toBe("name");
  await pressKey(page, "Enter");
  const prompt = sheet(page, "OnlineNameOverlay");
  await expect(prompt).toBeVisible();
  await expect(prompt.locator('[data-key="continue"]')).toBeVisible();
  await expect(online).toBeVisible();

  // The prompt opens with the caret in its name field: the first Escape only leaves the field, the second closes the
  // prompt. The next one leaves for the Title and the panel goes with the screen.
  await expect(page.locator("input").filter({ visible: true }).first()).toBeFocused();
  await pressKey(page, "Escape");
  await expect(page.locator("input").filter({ visible: true }).first()).not.toBeFocused();
  await expect(prompt).toBeVisible();
  await pressKey(page, "Escape");
  await expect(prompt).toHaveCount(0, { timeout: 10000 });
  await expect(online).toBeVisible();
  await pressKey(page, "Escape");
  await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "back on the Title", 10000);
  await expect(page.locator('#mc-ui [data-scene="Online"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the name prompt's Continue on the panel needs a name", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page, "screen=online", { landing: "Online" });
  await waitForText(page, "Set a name", { sceneKey: "Online" });
  await sheet(page, "Online").locator('[data-key="name"]').click();
  const prompt = sheet(page, "OnlineNameOverlay");
  await expect(prompt).toBeVisible();
  await prompt.locator('[data-key="continue"]').click();
  await waitForText(page, "Type a name", { sceneKey: "OnlineNameOverlay" });
  await prompt.locator('[data-key="cancel"]').click();
  await expect(prompt).toHaveCount(0, { timeout: 10000 });
  expect(errors).toEqual([]);
});
