import { expect, test, type Page } from "@playwright/test";
import { activeScenes, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Scenario select and Take your seats while a controller is in use (owner report, Steam Deck):
 * - the filter chips are folded away, the search field stays, and the list moves up into their space;
 * - Y (or the Filters button) shows and hides them; the keyboard's own Inspect key and a mouse keep the chips as ever;
 * - View inspects the focused tile, since Y is the filters' now;
 * - LT / RT page the focused shelf row, like its ‹ / › chevrons;
 * - the Inspect sheet words its close controls for a pad (B, not Esc / click).
 */

const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const B = 1;
const Y = 3;
const LT = 6;
const RT = 7;
const VIEW = 8;
const DPAD_DOWN = 13;

type StopRect = { key: string; x: number; y: number; width: number; height: number };

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

/** Holds a button until `done` holds (the pad is read once a frame); releases and presses again if a press was missed. */
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

const stopsOf = (page: Page, scene: string): Promise<StopRect[]> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string; rect: Omit<StopRect, "key"> }[]> })
        .__mcFocusRoutes[key]!().map((stop) => ({ key: stop.key, ...stop.rect })),
    scene,
  );

const focusOf = (page: Page, scene: string): Promise<string | null> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null }> }).__mcFocusState[key]!()
        .focus,
    scene,
  );

const hasKey = async (page: Page, scene: string, prefix: string): Promise<boolean> =>
  (await stopsOf(page, scene)).some((stop) => stop.key.startsWith(prefix));

/** Texts on `scene` containing `substr` that are actually drawn (visible, not faded out), at any depth. */
const visibleTexts = (page: Page, scene: string, substr: string): Promise<string[]> =>
  page.evaluate(
    ([sceneKey, wanted]) => {
      const game = (
        window as unknown as {
          __mcGame: {
            scene: {
              scenes: { sys: { settings: { key: string }; isActive(): boolean }; children: { list: unknown[] } }[];
            };
          };
        }
      ).__mcGame;
      const found: string[] = [];
      const walk = (obj: unknown, shown: boolean): void => {
        const o = obj as { type?: string; text?: unknown; visible?: boolean; alpha?: number; list?: unknown[] } | null;
        if (!o) return;
        const here = shown && o.visible !== false && (o.alpha ?? 1) > 0.05;
        if (
          o.type === "Text" &&
          typeof o.text === "string" &&
          here &&
          o.text.toLowerCase().includes(wanted!.toLowerCase())
        )
          found.push(o.text);
        for (const child of o.list ?? []) walk(child, here);
      };
      const scene = game.scene.scenes.find((s) => s.sys.settings.key === sceneKey && s.sys.isActive());
      for (const child of scene?.children.list ?? []) walk(child, true);
      return found;
    },
    [scene, substr],
  );

const SCREENS = [
  { name: "Take your seats", query: "seats", scene: "Seats", tile: "hero:", chips: "hero-chip:" },
  {
    name: "Scenario select",
    query: "scenario-select",
    scene: "ScenarioSelect",
    tile: "scenario:",
    chips: "scenario-chip:",
  },
] as const;

async function openWithPad(page: Page, query: string, scene: string): Promise<void> {
  await installPad(page);
  await openApp(page, `screen=${query}&unlock=all`, { landing: scene });
  // The first pad press wakes the plugin and puts the screen in pad mode (the left trigger does nothing alone).
  await press(page, LT);
  await page.waitForTimeout(1000);
}

for (const screen of SCREENS) {
  test.describe(screen.name, () => {
    test("a pad folds the chips away and keeps the search; Y shows and hides them", async ({ page }) => {
      test.setTimeout(180_000);
      const errors = trackPageErrors(page);
      await installPad(page);
      await openApp(page, `screen=${screen.query}&unlock=all`, { landing: screen.scene });
      // Mouse and keyboard: the chips are there as ever, and there is no Filters button.
      expect(await hasKey(page, screen.scene, screen.chips)).toBe(true);
      expect(await hasKey(page, screen.scene, "filters-toggle")).toBe(false);
      const firstTile = async (): Promise<StopRect> => {
        const tile = (await stopsOf(page, screen.scene)).find((stop) => stop.key.startsWith(screen.tile));
        expect(tile, "a tile").toBeDefined();
        return tile!;
      };
      const withChips = await firstTile();

      await press(page, LT);
      await waitFor(
        async () => ((await hasKey(page, screen.scene, screen.chips)) ? null : true),
        "the chips fold away once a pad is in use",
        15_000,
      );
      expect(await hasKey(page, screen.scene, "filters-toggle")).toBe(true);
      expect((await stopsOf(page, screen.scene)).map((s) => s.key)).toContain(
        screen.scene === "Seats" ? "hero-search" : "scenario-search",
      );
      // The list took the chips' space.
      expect((await firstTile()).y).toBeLessThan(withChips.y);
      // A trackpad or mouse move does not bring them back.
      await page.mouse.move(600, 500);
      await page.mouse.move(640, 520);
      await page.waitForTimeout(900);
      expect(await hasKey(page, screen.scene, screen.chips)).toBe(false);

      // Y opens them and lands on the first chip; Y again folds them.
      await press(page, Y, async () => hasKey(page, screen.scene, screen.chips));
      expect(await hasKey(page, screen.scene, screen.chips)).toBe(true);
      expect(((await focusOf(page, screen.scene)) ?? "").startsWith(screen.chips)).toBe(true);
      expect((await firstTile()).y).toBeGreaterThan(
        (await stopsOf(page, screen.scene)).find((s) => s.key === "filters-toggle")!.y,
      );
      await press(page, Y, async () => !(await hasKey(page, screen.scene, screen.chips)));
      expect(await hasKey(page, screen.scene, screen.chips)).toBe(false);

      // The Filters button does the same for a mouse.
      const button = (await stopsOf(page, screen.scene)).find((stop) => stop.key === "filters-toggle")!;
      await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
      await waitFor(
        async () => ((await hasKey(page, screen.scene, screen.chips)) ? true : null),
        "the button opens them",
        10_000,
      );

      // A key press hands the screen back to the keyboard: chips shown, no button.
      await page.keyboard.press("Tab");
      await waitFor(
        async () => ((await hasKey(page, screen.scene, "filters-toggle")) ? null : true),
        "a key press ends pad mode",
        10_000,
      );
      expect(await hasKey(page, screen.scene, screen.chips)).toBe(true);
      expect(errors).toEqual([]);
    });

    test("B from a tile opens the folded chips; Y on a tile folds or opens them, View inspects it", async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await openWithPad(page, screen.query, screen.scene);
      expect(await hasKey(page, screen.scene, screen.chips)).toBe(false);
      // The D-pad walks to a tile.
      for (let i = 0; i < 60 && !((await focusOf(page, screen.scene)) ?? "").startsWith(screen.tile); i += 1)
        await press(page, DPAD_DOWN);
      const tile = await focusOf(page, screen.scene);
      expect(tile ?? "").toMatch(new RegExp(`^${screen.tile}`));

      // View opens the Inspect sheet for the tile (Y is the filters' fold here); it words its close for a pad.
      await press(page, VIEW, async () => (await activeScenes(page)).includes("InspectOverlay"));
      await waitFor(
        async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null),
        "View inspects the tile",
        10_000,
      );
      await page.waitForTimeout(600);
      expect(await visibleTexts(page, "InspectOverlay", "click anywhere")).toEqual([]);
      expect((await visibleTexts(page, "InspectOverlay", "to close")).length).toBeGreaterThan(0);
      expect(await visibleTexts(page, "InspectOverlay", "Esc")).toEqual([]);
      await press(page, B, async () => !(await activeScenes(page)).includes("InspectOverlay"));
      await waitFor(
        async () => ((await activeScenes(page)).includes("InspectOverlay") ? null : true),
        "B closes the sheet",
        10_000,
      );

      // Y on the tile opens the chips instead of an Inspect sheet.
      await press(page, Y, async () => hasKey(page, screen.scene, screen.chips));
      expect(await hasKey(page, screen.scene, screen.chips)).toBe(true);
      expect(await activeScenes(page)).not.toContain("InspectOverlay");
      // Y on a chip folds them again and returns to the tile it left.
      await press(page, Y, async () => !(await hasKey(page, screen.scene, screen.chips)));
      expect(await hasKey(page, screen.scene, screen.chips)).toBe(false);
      expect(await focusOf(page, screen.scene)).toBe(tile);
      // B from the tile opens the chips again and lands on the first one.
      await press(page, B, async () => ((await focusOf(page, screen.scene)) ?? "").startsWith(screen.chips));
      expect(((await focusOf(page, screen.scene)) ?? "").startsWith(screen.chips)).toBe(true);
    });
  });
}

test("Take your seats: LT and RT page the focused hero row, and the keyboard's Inspect key still inspects", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  // A narrower window, so a pack row runs past the roster and has a page to turn.
  await page.setViewportSize({ width: 1100, height: 800 });
  await openWithPad(page, "seats", "Seats");
  // Walk to a tile of the first pack row (the Recommended shelf, if any, sits above it with its own tiles).
  for (let i = 0; i < 60 && !((await focusOf(page, "Seats")) ?? "").startsWith("hero:"); i += 1)
    await press(page, DPAD_DOWN);
  const start = await focusOf(page, "Seats");
  expect(start ?? "").toMatch(/^hero:/);
  const rectOf = async (key: string): Promise<StopRect> =>
    (await stopsOf(page, "Seats")).find((stop) => stop.key === key)!;
  const before = await rectOf(start!);

  // RT pages the row sideways: focus moves to a later card and the row has scrolled.
  await press(page, RT, async () => (await focusOf(page, "Seats")) !== start);
  const forward = await focusOf(page, "Seats");
  expect(forward).not.toBe(start);
  expect(forward ?? "").toMatch(/^hero:/);
  // It lands on the first card fully in view, at the row's left edge, inside the roster.
  const forwardRect = await rectOf(forward!);
  expect(forwardRect.y).toBe(before.y);
  expect(forwardRect.x).toBeGreaterThanOrEqual(60);
  expect(forwardRect.x + forwardRect.width).toBeLessThanOrEqual(1100);
  // LT pages back along the same row.
  await press(page, LT, async () => (await focusOf(page, "Seats")) !== forward);
  const back = await focusOf(page, "Seats");
  expect(back).not.toBe(forward);
  expect(back ?? "").toMatch(/^hero:/);
  expect((await rectOf(back!)).y).toBe(before.y);

  // The keyboard's E still inspects a tile (only the pad's Y became the filters' fold).
  await page.keyboard.press("e");
  await waitFor(
    async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null),
    "E inspects the tile",
    10_000,
  );
  expect(await visibleTexts(page, "InspectOverlay", "click anywhere")).not.toEqual([]);
  expect(errors).toEqual([]);
});

test("Scenario select: LT and RT do nothing off a tile, and a pad's Start still goes on", async ({ page }) => {
  test.setTimeout(180_000);
  await openWithPad(page, "scenario-select", "ScenarioSelect");
  await press(page, RT);
  expect(await activeScenes(page)).toContain("ScenarioSelect");
  await press(page, 9, async () => (await activeScenes(page)).includes("Seats"));
  await waitFor(
    async () => ((await activeScenes(page)).includes("Seats") ? true : null),
    "Start chooses heroes",
    15_000,
  );
});

/**
 * Below the width breakpoint (1000) the chips are behind the Filters button for every input, no pad needed: a narrowed
 * window with a mouse, and a phone with a finger. The button counts the filters set.
 */
for (const view of [
  { name: "a narrowed window with a mouse", size: { width: 900, height: 700 }, touch: false },
  { name: "a phone with a finger", size: { width: 390, height: 844 }, touch: true },
]) {
  for (const screen of SCREENS) {
    test.describe(`${screen.name}, ${view.name}`, () => {
      test.use({ viewport: view.size, hasTouch: view.touch, isMobile: view.touch });

      test("the chips are behind a Filters button that opens them, counts what is set, and shuts them", async ({
        page,
      }) => {
        test.setTimeout(120_000);
        const errors = trackPageErrors(page);
        await openApp(page, `screen=${screen.query}&unlock=all`, { landing: screen.scene });
        const tapStop = async (key: string): Promise<void> => {
          const stop = (await stopsOf(page, screen.scene)).find((one) => one.key === key);
          expect(stop, key).toBeDefined();
          const x = stop!.x + stop!.width / 2;
          const y = stop!.y + stop!.height / 2;
          if (view.touch) await page.touchscreen.tap(x, y);
          else await page.mouse.click(x, y);
        };
        // Shut by default: the button, and no chips; the search field (or its toggle on a phone) stays.
        expect(await hasKey(page, screen.scene, "filters-toggle")).toBe(true);
        expect(await hasKey(page, screen.scene, screen.chips)).toBe(false);
        expect((await visibleTexts(page, screen.scene, "Filters ▸")).length).toBeGreaterThan(0);
        const shutTile = (await stopsOf(page, screen.scene)).find((s) => s.key.startsWith(screen.tile))!;

        await tapStop("filters-toggle");
        await waitFor(
          async () => ((await hasKey(page, screen.scene, screen.chips)) ? true : null),
          "the button opens the chips",
          10_000,
        );
        expect((await visibleTexts(page, screen.scene, "Filters ▾")).length).toBeGreaterThan(0);
        const openTile = (await stopsOf(page, screen.scene)).find((s) => s.key.startsWith(screen.tile))!;
        expect(openTile.y, "the list gives room to the chips while they are open").toBeGreaterThan(shutTile.y);

        // Set a filter, shut the chips: the button carries the count.
        const chip = (await stopsOf(page, screen.scene)).find((s) => s.key.startsWith(screen.chips))!;
        await tapStop(chip.key);
        await page.waitForTimeout(500);
        await tapStop("filters-toggle");
        await waitFor(
          async () => ((await hasKey(page, screen.scene, screen.chips)) ? null : true),
          "the button shuts the chips",
          10_000,
        );
        expect((await visibleTexts(page, screen.scene, "Filters (1)")).length).toBeGreaterThan(0);
        expect(errors).toEqual([]);
      });
    });
  }
}
