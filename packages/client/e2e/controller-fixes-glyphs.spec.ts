import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Pad fixes from the Bazzite report (2026-10-24):
 * - Settings > Display > Resolution: an open list owns the d-pad (up / down move through the sizes, A picks and closes, B
 *   closes unchanged), never the controls behind it.
 * - The Trophy Room's back button holds its B glyph inside it, and Set the table has B on Back and Start on Deal it out.
 * - Set the table: Y opens a modular set's cards, holding Y enlarges its picture (the desktop hover), as on the Board.
 * Screenshots go to artifacts/qa (untracked).
 */

const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const A = 0;
const B = 1;
const Y = 3;
const LT = 6;
const DOWN = 13;
const SHOT = "../../artifacts/qa";

type StopRect = { x: number; y: number; width: number; height: number };

async function installPad(page: Page): Promise<void> {
  await page.addInitScript((id) => {
    const button = () => ({ pressed: false, touched: false, value: 0 });
    const pad = {
      connected: true,
      id,
      index: 0,
      mapping: "standard",
      timestamp: 0,
      buttons: Array.from({ length: 17 }, button),
      axes: [0, 0, 0, 0],
    };
    (window as unknown as { __fakePad: unknown }).__fakePad = pad;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => {
        pad.timestamp = performance.now();
        return [pad];
      },
      configurable: true,
    });
  }, PAD_ID);
}

async function setButton(page: Page, index: number, on: boolean): Promise<void> {
  await page.evaluate(
    ([i, down]) => {
      const pad = (window as unknown as { __fakePad: { buttons: unknown[] } }).__fakePad;
      pad.buttons[i as number] = { pressed: down, touched: down, value: down ? 1 : 0 };
    },
    [index, on] as const,
  );
}

/** Holds a button until `done` (a press the plugin missed is released and sent again). */
async function press(page: Page, index: number, done?: () => Promise<boolean>): Promise<void> {
  if (!done) {
    await setButton(page, index, true);
    await page.waitForTimeout(400);
    await setButton(page, index, false);
    await page.waitForTimeout(300);
    return;
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await setButton(page, index, true);
    for (let i = 0; i < 10; i += 1) {
      await page.waitForTimeout(100);
      if (await done()) break;
    }
    await setButton(page, index, false);
    await page.waitForTimeout(300);
    if (await done()) return;
  }
}

async function wakePad(page: Page): Promise<void> {
  await press(page, LT);
  await page.waitForTimeout(1000);
}

const focusOf = (page: Page, scene: string): Promise<string | null> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null }> }).__mcFocusState[key]!()
        .focus,
    scene,
  );

const stopsOf = (page: Page, scene: string): Promise<{ key: string; rect: StopRect }[]> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string; rect: StopRect }[]> })
        .__mcFocusRoutes[key]!(),
    scene,
  );

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT}/${name}.png` });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
});

test("Settings Resolution list: d-pad moves through the sizes, A picks, B closes unchanged", async ({ page }) => {
  test.setTimeout(120_000);
  await installPad(page);
  // A desktop shell answering with a 4K monitor, so the Resolution row is drawn in the browser.
  await page.addInitScript(() => {
    const monitor = {
      name: "mock",
      scaleFactor: 1,
      position: { x: 0, y: 0 },
      size: { width: 3840, height: 2160 },
      workArea: { position: { x: 0, y: 0 }, size: { width: 3840, height: 2160 } },
    };
    (window as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__: unknown }).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: () => {},
    };
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
      transformCallback: () => 0,
      invoke: async (cmd: string) => (cmd.endsWith("current_monitor") ? monitor : null),
    };
  });
  await openApp(page, "screen=settings&unlock=all", { landing: "SettingsOverlay" });
  await wakePad(page);
  const tab = (await stopsOf(page, "SettingsOverlay")).find((s) => s.key === "tab:display")!;
  await page.mouse.click(tab.rect.x + tab.rect.width / 2, tab.rect.y + tab.rect.height / 2);
  await page.waitForTimeout(800);
  await waitFor(
    async () => ((await stopsOf(page, "SettingsOverlay")).some((s) => s.key === "row:resolution:field") ? true : null),
    "the Resolution row is drawn",
    20_000,
  );
  // Tab walks the route to the Resolution field (the pad takes over again for everything after it).
  for (let i = 0; i < 60 && (await focusOf(page, "SettingsOverlay")) !== "row:resolution:field"; i += 1) {
    await page.keyboard.press("Tab");
  }
  expect(await focusOf(page, "SettingsOverlay")).toBe("row:resolution:field");
  const own = async () => (await stopsOf(page, "SettingsOverlay")).filter((s) => !s.key.startsWith("chrome:"));
  const listOpen = async (): Promise<boolean> => (await own()).every((s) => s.key.startsWith("list:"));
  await press(page, A, listOpen);
  // Only the list's sizes are stops while it is open: nothing behind it can take the ring.
  const open = await own();
  expect(open.length).toBeGreaterThan(2);
  expect(open.every((s) => s.key.startsWith("list:"))).toBe(true);
  const first = await focusOf(page, "SettingsOverlay");
  expect(first).toMatch(/^list:/);
  await shot(page, "dropdown-list-open-pad-1280");
  await press(page, DOWN);
  const second = await focusOf(page, "SettingsOverlay");
  expect(second).toMatch(/^list:/);
  expect(second).not.toBe(first);
  // B closes without changing anything: the ring returns to the field, and the settings scene is still up.
  await press(page, B, async () => (await focusOf(page, "SettingsOverlay")) === "row:resolution:field");
  expect(await focusOf(page, "SettingsOverlay")).toBe("row:resolution:field");
  expect(await activeScenes(page)).toContain("SettingsOverlay");
  expect(await findText(page, "Native · 3840 × 2160", "SettingsOverlay")).not.toHaveLength(0);
  // Open again, move down, A picks it: the list closes and Apply goes live (the field now shows the pick).
  await press(page, A, listOpen);
  await press(page, DOWN);
  await press(page, A, async () => (await focusOf(page, "SettingsOverlay")) === "row:resolution:field");
  expect(await focusOf(page, "SettingsOverlay")).toBe("row:resolution:field");
  expect(await findText(page, "Native · 3840 × 2160", "SettingsOverlay")).toHaveLength(0);
  await shot(page, "dropdown-picked-pad-1280");
});

test("Trophy Room: the back button holds the B glyph inside it, text to the right", async ({ page }) => {
  test.setTimeout(120_000);
  await installPad(page);
  await openApp(page, "screen=trophies&unlock=all", { landing: "TrophyRoom" });
  await wakePad(page);
  await page.waitForTimeout(1200);
  const back = (await stopsOf(page, "TrophyRoom")).find((s) => s.key === "back")!;
  // Room for the glyph and the word: the Decks screen's button is 100 wide for the same label.
  expect(back.rect.width).toBeGreaterThanOrEqual(120);
  await shot(page, "trophy-back-pad-1280");
});

test("Set the table: glyphs on Back and Deal it out, Y opens a set's cards, hold Y zooms its picture", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await installPad(page);
  await openApp(page, "screen=table-setup&unlock=all", { landing: "Setup" });
  await wakePad(page);
  await shot(page, "setup-glyphs-pad-1280");
  // Walk to a modular set's tile that offers a picture (an optional one, not a random tile).
  let tile: string | null = null;
  for (let i = 0; i < 60 && tile === null; i += 1) {
    await press(page, DOWN);
    const focus = await focusOf(page, "Setup");
    if (focus?.startsWith("modular:") && focus !== "modular:random") tile = focus;
  }
  expect(tile).not.toBeNull();
  const shown = (): Promise<string | null> =>
    page.evaluate(() =>
      (window as unknown as { __mcTableSetupDebug: { hoverShown(): string | null } }).__mcTableSetupDebug.hoverShown(),
    );
  expect(await shown()).toBeNull();
  // Hold Y: the picture is enlarged beside the tile; releasing it closes the zoom and does not open the cards.
  await setButton(page, Y, true);
  await waitFor(async () => (await shown()) ?? null, "holding Y enlarges the focused set's picture", 10_000);
  await shot(page, "setup-hold-y-zoom-pad-1280");
  await setButton(page, Y, false);
  await waitFor(async () => ((await shown()) === null ? true : null), "releasing Y closes the zoom", 10_000);
  expect(await activeScenes(page)).not.toContain("SetCardsOverlay");
  // A tap of Y opens the set's cards.
  for (let attempt = 0; attempt < 4 && !(await activeScenes(page)).includes("SetCardsOverlay"); attempt += 1) {
    await setButton(page, Y, true);
    await page.waitForTimeout(80);
    await setButton(page, Y, false);
    await page.waitForTimeout(600);
  }
  expect(await activeScenes(page)).toContain("SetCardsOverlay");
});
