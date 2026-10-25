import { expect, test, type Page } from "@playwright/test";
import { trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Y opens the Filters fold with the list scrolled far down (owner report, Linux AppImage: "froze at the villain
 * screen ... had Nebula selected and pushed Y"). The page must keep rendering, the first chip must be focused and
 * inside the screen.
 */

const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const Y = 3;
const LT = 6;
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
    // A frame heartbeat: a hung main thread stops it.
    (window as unknown as { __beat: number }).__beat = 0;
    const tick = (): void => {
      (window as unknown as { __beat: number }).__beat += 1;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, PAD_ID);
}

const setButton = (page: Page, index: number, on: boolean): Promise<void> =>
  page.evaluate(
    ([i, down]) => {
      const pad = (window as unknown as { __fakePad: { buttons: unknown[] } }).__fakePad;
      pad.buttons[i as number] = { pressed: down, touched: down, value: down ? 1 : 0 };
    },
    [index, on] as const,
  );

async function tap(page: Page, index: number): Promise<void> {
  await setButton(page, index, true);
  await page.waitForTimeout(250);
  await setButton(page, index, false);
  await page.waitForTimeout(250);
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

const beat = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __beat: number }).__beat);

const SCREENS = [
  {
    name: "Scenario select",
    query: "scenario-select",
    scene: "ScenarioSelect",
    tile: "scenario:",
    chips: "scenario-chip:",
  },
  { name: "Take your seats", query: "seats", scene: "Seats", tile: "hero:", chips: "hero-chip:" },
] as const;

const VIEWS = [
  { name: "desktop", size: { width: 1280, height: 720 }, scale: 1, unlock: "&unlock=all" },
  { name: "4K TV, locked tiles", size: { width: 1920, height: 1080 }, scale: 2, unlock: "" },
  { name: "3840 wide, locked tiles", size: { width: 3840, height: 2160 }, scale: 1, unlock: "" },
  { name: "1440p, locked tiles", size: { width: 2560, height: 1440 }, scale: 1.5, unlock: "" },
] as const;

/** WebKitGTK paints card faces on the main thread (no usable worker): make the baker's worker refuse to start. */
async function refuseCardFaceWorker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const Real = window.Worker;
    window.Worker = class extends Real {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (options?.name === "mc-card-faces") throw new Error("no worker (test)");
        super(url, options);
      }
    } as typeof Worker;
  });
}

for (const inline of [false, true])
  for (const view of VIEWS)
    for (const screen of SCREENS) {
      if (inline && view.name === "1440p, locked tiles") continue;
      test.describe(`${view.name}${inline ? ", card faces painted on the main thread" : ""}`, () => {
        test.use({ viewport: view.size, deviceScaleFactor: view.scale });
        test(`${screen.name}: Y with the list scrolled far down opens the Filters and the page keeps rendering`, async ({
          page,
        }) => {
          test.setTimeout(240_000);
          const errors = trackPageErrors(page);
          await installPad(page);
          const inlineNotices: string[] = [];
          page.on("console", (message) => {
            if (message.text().includes("Card faces: painting on the main thread")) inlineNotices.push(message.text());
          });
          if (inline) await refuseCardFaceWorker(page);
          await openApp(page, `screen=${screen.query}${view.unlock}`, { landing: screen.scene });
          await tap(page, LT);
          await page.waitForTimeout(1000);
          // D-pad down until the focused tile is the last one (as far down the list as it goes).
          let last = "";
          for (let i = 0; i < 120; i += 1) {
            await tap(page, DPAD_DOWN);
            const now = (await focusOf(page, screen.scene)) ?? "";
            if (now === last && now.startsWith(screen.tile)) break;
            last = now;
          }
          if (screen.scene === "ScenarioSelect") {
            // The owner's report had Nebula focused: back up the list to its row and across to the tile.
            for (let i = 0; i < 80; i += 1) {
              const stops = await stopsOf(page, screen.scene);
              const nebula = stops.find((s) => s.key === "scenario:nebula");
              const at = stops.find((s) => s.key === last);
              if (last === "scenario:nebula") break;
              if (!nebula || !at) {
                await tap(page, 12);
              } else if (Math.abs(at.y - nebula.y) < 20) {
                await tap(page, at.x < nebula.x ? 15 : 14);
              } else {
                await tap(page, at.y > nebula.y ? 12 : DPAD_DOWN);
              }
              last = (await focusOf(page, screen.scene)) ?? "";
            }
            expect(last).toBe("scenario:nebula");
          }
          expect(last.startsWith(screen.tile), `focus is on a tile (${last})`).toBe(true);
          const stops = await stopsOf(page, screen.scene);
          const size = await page.evaluate(() => ({ h: window.innerHeight }));
          expect(
            stops.some((s) => s.key.startsWith(screen.tile) && s.y + s.height < 0),
            "the list is scrolled down: a tile has gone off the top",
          ).toBe(true);
          await setButton(page, Y, true);
          await page.waitForTimeout(120);
          await setButton(page, Y, false);
          const before = await beat(page);
          await page.waitForTimeout(800);
          expect(await beat(page), "frames keep coming").toBeGreaterThan(before + 5);
          await waitFor(
            async () => (((await focusOf(page, screen.scene)) ?? "").startsWith(screen.chips) ? true : null),
            "a chip is focused",
            10_000,
          );
          const focused = (await focusOf(page, screen.scene))!;
          const rect = (await stopsOf(page, screen.scene)).find((s) => s.key === focused)!;
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.y + rect.height).toBeLessThanOrEqual(size.h);
          expect(errors).toEqual([]);
          // The variant really did paint faces on the main thread; the ordinary run did not.
          expect(inlineNotices.length > 0).toBe(inline);
        });
      });
    }

/**
 * The owner's Linux build reported the physical Y as standard index 2 (X): X is the guide toggle, which neither screen
 * uses (Seats clears a seat with it). Every way of pressing X and Y on a scrolled list keeps the page rendering.
 */
const X = 2;

for (const screen of SCREENS) {
  test(`${screen.name}: X and Y, tapped, held and together, on a scrolled list keep the page rendering`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const errors = trackPageErrors(page);
    await installPad(page);
    await openApp(page, `screen=${screen.query}`, { landing: screen.scene });
    await tap(page, LT);
    await page.waitForTimeout(1000);
    let last = "";
    for (let i = 0; i < 120; i += 1) {
      await tap(page, DPAD_DOWN);
      const now = (await focusOf(page, screen.scene)) ?? "";
      if (now === last && now.startsWith(screen.tile)) break;
      last = now;
    }
    expect(last.startsWith(screen.tile)).toBe(true);
    const alive = async (what: string): Promise<void> => {
      const before = await beat(page);
      await page.waitForTimeout(700);
      expect(await beat(page), `frames keep coming after ${what}`).toBeGreaterThan(before + 5);
    };
    const hold = async (buttons: number[], ms: number): Promise<void> => {
      for (const b of buttons) await setButton(page, b, true);
      await page.waitForTimeout(ms);
      for (const b of buttons) await setButton(page, b, false);
    };
    const chipsShown = async (): Promise<boolean> =>
      (await stopsOf(page, screen.scene)).some((s) => s.key.startsWith(screen.chips));

    await hold([X], 120);
    await alive("X tapped");
    expect(await chipsShown(), "X does not open the filters").toBe(false);
    await hold([X], 600);
    await alive("X held");
    expect(await chipsShown()).toBe(false);
    await hold([X, Y], 150);
    await alive("X and Y together");
    // Back to folded (the pair may or may not have opened them), then a held Y opens them once.
    for (let i = 0; i < 4 && (await chipsShown()); i += 1) {
      await hold([Y], 150);
      await page.waitForTimeout(500);
    }
    expect(await chipsShown()).toBe(false);
    await hold([Y], 600);
    await alive("Y held");
    await waitFor(async () => ((await chipsShown()) ? true : null), "a held Y opens the filters", 10_000);
    expect(errors).toEqual([]);
  });
}
