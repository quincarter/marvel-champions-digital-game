import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The pre-game screens answer a controller (owner report from a Steam Deck):
 * - Start / Menu moves forward on Scenario select, Take your seats and Set the table, and never leaves a screen deaf
 *   (the report: Start on Set the Table went back to Take your seats and froze).
 * - A pad that put the caret in the seed field can take it out again with B (it used to hold every button for good).
 * - On Take your seats, RB / LB pick the seat being edited and X clears a seat; an aspect's (i) opens only on a press.
 * - View / Back on the Title opens the Trophy Room.
 */

const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const B = 1;
const X = 2;
const RB = 5;
const VIEW = 8;
const START = 9;
const LT = 6;
const Y = 3;

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

/** Holds a button until `done` (the pad is read once a frame, and a loaded runner can run none in a short press). */
async function press(page: Page, index: number, done?: () => Promise<boolean>): Promise<void> {
  if (!done) {
    await setButton(page, index, true);
    await page.waitForTimeout(400);
    await setButton(page, index, false);
    await page.waitForTimeout(300);
    return;
  }
  // A press the plugin missed is not re-sent while the button stays down, so release and press again.
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

/** The first pad press wakes the plugin; the left trigger does nothing alone, so focus stays where it was. */
async function wakePad(page: Page): Promise<void> {
  await press(page, LT);
  // The plugin reports face buttons only a moment after its first poll.
  await page.waitForTimeout(1000);
}

async function openScreen(page: Page, screen: string, landing: string): Promise<void> {
  await installPad(page);
  await openApp(page, `screen=${screen}&unlock=all`, { landing });
  await wakePad(page);
}

const sceneIs = (page: Page, key: string) => async () => (await activeScenes(page)).includes(key);

test("Start on Set the Table deals, and Back and Start never leave the screen deaf", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openScreen(page, "table-setup", "Setup");
  // Start does one thing: the next screen. It is never "back".
  await press(page, START, async () => !(await sceneIs(page, "Setup")()));
  const scenes = await waitFor(
    async () => {
      const active = await activeScenes(page);
      return active.includes("Setup") ? null : active;
    },
    "Start leaves Set the Table",
    15_000,
  );
  expect(scenes).not.toContain("Seats");
  expect(scenes.some((key) => key === "SetupDeal" || key === "ScenarioIntro" || key === "Decks")).toBe(true);
  expect(errors).toEqual([]);
});

test("B on Set the Table goes back to Take your seats, which then answers the pad, the keyboard and the mouse", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openScreen(page, "table-setup", "Setup");
  await press(page, B, sceneIs(page, "Seats"));
  await waitFor(sceneIs(page, "Seats"), "Back reaches Take your seats", 15_000);
  await page.waitForTimeout(600);
  // RB steps to seat 2: the seat row says it is being picked.
  await press(page, RB, async () => (await findText(page, "SEAT 2 · PICKING", "Seats")).length > 0);
  expect((await findText(page, "SEAT 2 · PICKING", "Seats")).length).toBeGreaterThan(0);
  // The keyboard: Tab moves the focus ring.
  const before = await focusOf(page, "Seats");
  await page.keyboard.press("Tab");
  await waitFor(async () => ((await focusOf(page, "Seats")) !== before ? true : null), "Tab moves focus", 10_000);
  // The mouse: a click on Back reaches Scenario select.
  const back = await stopRectOf(page, "Seats", "back");
  await page.mouse.click(back.x + back.width / 2, back.y + back.height / 2);
  await waitFor(sceneIs(page, "ScenarioSelect"), "a click on Back reaches Scenario select", 15_000);
  expect(errors).toEqual([]);
});

// Motion on: the race is about the screen fade, which the suite default skips.
test.describe("inside the fade", () => {
  test.use({ reducedMotion: "no-preference" });

  test("Back and then Start inside the fade lands on Take your seats and deals nothing", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = trackPageErrors(page);
    await openScreen(page, "table-setup", "Setup");
    // The pad plugin takes a moment to report buttons: step the D-pad until it does, so B lands first time below.
    for (let i = 0; i < 20 && (await focusOf(page, "Setup")) === null; i += 1) await press(page, 13);
    await page.waitForTimeout(300);
    await setButton(page, B, true);
    // Start goes in while the screen is fading out, not before or after.
    await waitFor(
      () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __mcGame: {
                  scene: { getScene(k: string): { cameras: { main: { fadeEffect: { isRunning: boolean } } } } };
                };
              }
            ).__mcGame.scene.getScene("Setup").cameras.main.fadeEffect.isRunning || null,
        ),
      "Back starts the fade",
      10_000,
    );
    await setButton(page, B, false);
    await setButton(page, START, true);
    await page.waitForTimeout(120);
    await setButton(page, START, false);
    await waitFor(sceneIs(page, "Seats"), "Back wins the race", 15_000);
    await page.waitForTimeout(1500);
    const scenes = await activeScenes(page);
    expect(scenes).toContain("Seats");
    expect(scenes).not.toContain("SetupDeal");
    const before = await focusOf(page, "Seats");
    await page.keyboard.press("Tab");
    await waitFor(async () => ((await focusOf(page, "Seats")) !== before ? true : null), "Tab moves focus", 10_000);
    const back = await stopRectOf(page, "Seats", "back");
    await page.mouse.click(back.x + back.width / 2, back.y + back.height / 2);
    await waitFor(sceneIs(page, "ScenarioSelect"), "a click on Back still works", 15_000);
    expect(errors).toEqual([]);
  });
});

test("B takes the pad out of the seed field instead of holding every button", async ({ page }) => {
  test.setTimeout(120_000);
  await openScreen(page, "table-setup", "Setup");
  const seed = await page.evaluate(() => {
    const rect = (
      window as unknown as {
        __mcFocusRoutes: Record<
          string,
          () => { key: string; rect: { x: number; y: number; width: number; height: number } }[]
        >;
      }
    ).__mcFocusRoutes["Setup"]!().find((stop) => stop.key === "seed");
    return rect?.rect ?? null;
  });
  expect(seed).not.toBeNull();
  await page.mouse.click(seed!.x + 20, seed!.y + seed!.height / 2);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("INPUT");
  await press(page, B, async () => (await page.evaluate(() => document.activeElement?.tagName)) !== "INPUT");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("INPUT");
  // Still on Set the Table: the B that left the field did not also go back.
  expect(await activeScenes(page)).toContain("Setup");
});

test("Start on Take your seats plays, and on Scenario select it chooses heroes", async ({ page }) => {
  test.setTimeout(120_000);
  await openScreen(page, "scenario-select", "ScenarioSelect");
  await press(page, START, sceneIs(page, "Seats"));
  await waitFor(sceneIs(page, "Seats"), "Start on Scenario select reaches Take your seats", 15_000);
  await page.waitForTimeout(600);
  await press(page, START, sceneIs(page, "Setup"));
  await waitFor(sceneIs(page, "Setup"), "Start on Take your seats reaches Set the Table", 15_000);
});

test("X clears a seat, and an aspect's (i) opens only on a press", async ({ page }) => {
  test.setTimeout(120_000);
  await installPad(page);
  await openApp(page, "screen=seats&players=2&unlock=all", { landing: "Seats" });
  await wakePad(page);
  expect(await focusOf(page, "Seats"), "nothing is focused, so X takes the active seat").toBeNull();
  const filled = async (text: string) => (await findText(page, text, "Seats")).length > 0;
  expect(await filled("2 SEATS FILLED")).toBe(true);
  // X clears the active seat (nothing is focused): the header counts one seat now.
  await press(page, X, () => filled("1 SEAT FILLED"));
  expect(await filled("1 SEAT FILLED")).toBe(true);
  // A pad folds the filter chips away (the Filters button and Y bring them back): open them for the (i).
  const hasInfo = (): Promise<boolean> =>
    page.evaluate(() =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string }[]> }).__mcFocusRoutes[
        "Seats"
      ]!().some((one) => one.key === "hero-chip-info:justice"),
    );
  await press(page, Y, hasInfo);
  expect(await hasInfo()).toBe(true);
  // The tip's text for Justice; the pointer resting on the (i) opens nothing.
  const info = await page.evaluate(() => {
    const stop = (
      window as unknown as {
        __mcFocusRoutes: Record<
          string,
          () => { key: string; rect: { x: number; y: number; width: number; height: number } }[]
        >;
      }
    ).__mcFocusRoutes["Seats"]!().find((one) => one.key === "hero-chip-info:justice");
    return stop?.rect ?? null;
  });
  expect(info).not.toBeNull();
  const at = { x: info!.x + info!.width / 2, y: info!.y + info!.height / 2 };
  await page.mouse.move(at.x, at.y);
  await page.waitForTimeout(500);
  expect(await findText(page, "steady first choice", "Seats")).toHaveLength(0);
  await page.mouse.click(at.x, at.y);
  await waitFor(
    async () => ((await findText(page, "steady first choice", "Seats")).length > 0 ? true : null),
    "a press of the (i) opens the tip",
    10_000,
  );
  await page.mouse.move(at.x + 400, at.y + 300);
  await waitFor(
    async () => ((await findText(page, "steady first choice", "Seats")).length === 0 ? true : null),
    "the pointer leaving shuts the tip",
    10_000,
  );
});

test("View on the Title opens the Trophy Room", async ({ page }) => {
  test.setTimeout(120_000);
  await installPad(page);
  await openApp(page, "unlock=all");
  await wakePad(page);
  await press(page, VIEW, sceneIs(page, "TrophyRoom"));
  await waitFor(sceneIs(page, "TrophyRoom"), "View opens the Trophy Room", 15_000);
});

type StopRect = { x: number; y: number; width: number; height: number };

async function stopRectOf(page: Page, scene: string, key: string): Promise<StopRect> {
  const rect = await page.evaluate(
    ([sceneKey, stopKey]) =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string; rect: StopRect }[]> })
        .__mcFocusRoutes[sceneKey!]!().find((stop) => stop.key === stopKey)?.rect ?? null,
    [scene, key],
  );
  expect(rect, `${key} is a stop on ${scene}`).not.toBeNull();
  return rect!;
}

// Y toggles focus between the filters and the list, and B from the list returns to the filters before it backs out.
const focusOf = (page: Page, scene: string): Promise<string | null> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null }> }).__mcFocusState[key]!()
        .focus,
    scene,
  );

for (const screen of [
  {
    name: "Take your seats",
    query: "seats",
    scene: "Seats",
    tile: "hero:",
    chips: "hero-chip:",
    back: "ScenarioSelect",
  },
  {
    name: "Scenario select",
    query: "scenario-select",
    scene: "ScenarioSelect",
    tile: "scenario:",
    chips: "scenario-chip:",
    back: "Title",
  },
]) {
  test(`${screen.name}: B from the list goes to the filters, Y goes back to the row, B there backs out`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await installPad(page);
    await openApp(page, `screen=${screen.query}&unlock=all`, { landing: screen.scene });
    // Tab to the first tile of the list.
    let tile: string | null = null;
    for (let i = 0; i < 80 && tile === null; i += 1) {
      await page.keyboard.press("Tab");
      const focus = await focusOf(page, screen.scene);
      if (focus?.startsWith(screen.tile)) tile = focus;
    }
    expect(tile).not.toBeNull();
    await page.keyboard.press("Escape");
    await waitFor(
      async () => ((await focusOf(page, screen.scene))?.startsWith(screen.chips) ? true : null),
      "B from the list lands on the first filter chip",
      10_000,
    );
    expect(await activeScenes(page)).toContain(screen.scene);
    await page.keyboard.press("e");
    await waitFor(
      async () => ((await focusOf(page, screen.scene)) === tile ? true : null),
      "Y goes back to the row it left",
      10_000,
    );
    // Back in the list, B goes to the filters again; only a B there backs out.
    await page.keyboard.press("Escape");
    await waitFor(
      async () => ((await focusOf(page, screen.scene))?.startsWith(screen.chips) ? true : null),
      "B from the list lands on the filters again",
      10_000,
    );
    await page.keyboard.press("Escape");
    await waitFor(sceneIs(page, screen.back), "B from the filters backs out", 15_000);
  });
}

test("Take your seats: the pad's B and Y make the same jump", async ({ page }) => {
  test.setTimeout(120_000);
  await openScreen(page, "seats", "Seats");
  let tile: string | null = null;
  for (let i = 0; i < 80 && tile === null; i += 1) {
    await page.keyboard.press("Tab");
    const focus = await focusOf(page, "Seats");
    if (focus?.startsWith("hero:")) tile = focus;
  }
  expect(tile).not.toBeNull();
  // The Tab presses were the keyboard's; a pad press puts the screen back in pad mode (chips folded), and B opens them.
  await press(page, LT);
  await page.waitForTimeout(800);
  await press(page, B, async () => ((await focusOf(page, "Seats")) ?? "").startsWith("hero-chip:"));
  expect(((await focusOf(page, "Seats")) ?? "").startsWith("hero-chip:")).toBe(true);
  await press(page, Y, async () => (await focusOf(page, "Seats")) === tile);
  expect(await focusOf(page, "Seats")).toBe(tile);
  expect(await activeScenes(page)).toContain("Seats");
});
