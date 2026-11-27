import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, pressKey, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { hook, openApp, type Rect } from "./wave6-helpers-b.js";
import { clickStop } from "./wave6-helpers-a.js";

/**
 * Scenario select draws as Lit panels over the canvas (`mc-sheet` for the bar, search, chips, Random buttons and the
 * stages panel; `mc-shelf-roster` for the shelves): text is found under its scene, the tiles draw the build-time
 * roster-size WebP copy of a villain's picture (never the original), a tap picks, a hold or a right-click inspects, a
 * swipe of a shelf row that lifts over a tile picks nothing (#227), the keyboard walks the same stops with the ring drawn
 * in the DOM, and the screen reads in Spanish.
 */

const DEBUG = "__mcScenarioSelectDebug";
const panel = `#mc-ui [data-scene="ScenarioSelect"]`;
const URL = "screen=scenario-select&unlock=all";

interface Stop extends Rect {
  readonly key: string;
}

const stops = async (page: Page): Promise<Stop[]> => (await hook<Stop[]>(page, DEBUG, "stops")) ?? [];
const stopOf = async (page: Page, key: string): Promise<Stop | undefined> =>
  (await stops(page)).find((stop) => stop.key === key);
const selected = (page: Page): Promise<string | null> => hook<string | null>(page, DEBUG, "selectedId");

async function openScreen(page: Page, query = URL): Promise<void> {
  await openApp(page, query, { landing: "ScenarioSelect" });
  await waitFor(async () => ((await stopOf(page, "scenario:rhino")) ? true : null), "the Rhino tile is up", 20_000);
}

test("the screen is Lit panels: its words are found, and a tile draws the small WebP copy of its picture, lazily", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openScreen(page);
  await waitForText(page, "Choose a scenario", { sceneKey: "ScenarioSelect" });
  expect(await findText(page, "Rhino", "ScenarioSelect")).not.toHaveLength(0);
  expect(await findText(page, "Core Set", "ScenarioSelect")).not.toHaveLength(0);
  expect(await findText(page, "Choose heroes", "ScenarioSelect")).not.toHaveLength(0);
  // Nothing is drawn in the canvas for it any more: the panels carry the screen.
  await expect(page.locator(`${panel} mc-shelf-roster`)).toHaveCount(1);

  const pictures = page.locator(`${panel} mc-shelf-roster mc-picture-tile img`);
  await expect(pictures.first()).toHaveAttribute("loading", "lazy");
  const sources = await pictures.evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src));
  expect(sources.length).toBeGreaterThan(0);
  // A villain's scene art is the roster-size copy, never the full-bleed original under art/scenarios/.
  const scenes = sources.filter((src) => /\/scenarios\//.test(src));
  expect(scenes.length).toBeGreaterThan(0);
  for (const src of scenes) expect(src).toMatch(/(@art-copy\/roster\/|\.webp)/);
  expect(errors).toEqual([]);
});

test("a tap picks a villain, SELECTED says so, and Choose heroes goes on to Take your seats", async ({ page }) => {
  test.setTimeout(120_000);
  await openScreen(page);
  expect(await selected(page)).not.toBe("klaw");
  // On a phone the second tile of the row starts past the screen edge: bring it in, as a swipe would.
  await page.locator(`${panel} [data-key="entry:klaw"]`).first().scrollIntoViewIfNeeded();
  await clickStop(page, "scenario:klaw", "ScenarioSelect");
  await waitFor(async () => ((await selected(page)) === "klaw" ? true : null), "Klaw is picked", 10_000);
  expect(await findText(page, "Selected", "ScenarioSelect")).not.toHaveLength(0);
  await clickStop(page, "next", "ScenarioSelect");
  await waitFor(async () => ((await activeScenes(page)).includes("Seats") ? true : null), "on Take your seats", 20_000);
});

test("a shelf header folds its shelf, See all opens the box as a grid and All packs returns", async ({ page }) => {
  test.setTimeout(120_000);
  await openScreen(page);
  await clickStop(page, "scenario-shelf:core", "ScenarioSelect");
  await waitFor(
    async () => (((await hook<string[]>(page, DEBUG, "folded")) ?? []).includes("core") ? true : null),
    "the Core Set shelf is folded",
    10_000,
  );
  expect(await stopOf(page, "scenario:rhino")).toBeUndefined();
  await clickStop(page, "scenario-shelf:core", "ScenarioSelect");
  await waitFor(async () => ((await stopOf(page, "scenario:rhino")) ? true : null), "the shelf is open again", 10_000);

  // "See all" on the header: the box is a grid, "All packs" comes back.
  await page.locator(`${panel} mc-shelf-roster [data-key="all:core"]`).first().click();
  await waitFor(
    async () => ((await hook<string | null>(page, DEBUG, "drilledPack")) === "core" ? true : null),
    "the Core Set is open as a grid",
    10_000,
  );
  expect(await stopOf(page, "drill-back")).toBeDefined();
  expect(await stopOf(page, "scenario:klaw")).toBeDefined();
  await clickStop(page, "drill-back", "ScenarioSelect");
  await waitFor(
    async () => ((await hook<string | null>(page, DEBUG, "drilledPack")) === null ? true : null),
    "back on every pack",
    10_000,
  );
});

test("a search narrows the shelves, and Clear brings them back", async ({ page }) => {
  test.setTimeout(120_000);
  await openScreen(page);
  const all = (await stops(page)).filter((stop) => stop.key.startsWith("scenario:")).length;
  if (await stopOf(page, "scenario-search-toggle")) await clickStop(page, "scenario-search-toggle", "ScenarioSelect");
  const field = page.locator(`${panel} [data-key="scenario-search"] input`).first();
  await field.click();
  await field.fill("zzzz nothing matches this");
  await waitFor(
    async () => ((await stopOf(page, "scenario-clear")) ? true : null),
    "the empty state's Clear is up",
    15_000,
  );
  expect(await findText(page, "No matches", "ScenarioSelect")).not.toHaveLength(0);
  await field.fill("rhino");
  await waitFor(
    async () => {
      const shown = (await stops(page)).filter((stop) => stop.key.startsWith("scenario:"));
      return shown.length > 0 && shown.length < all && shown.some((stop) => stop.key === "scenario:rhino")
        ? true
        : null;
    },
    "only the Rhino match shows",
    15_000,
  );
});

test("the keyboard walks the stops with the ring in the DOM, and Escape goes back to Title", async ({ page }) => {
  test.setTimeout(120_000);
  await openScreen(page);
  await pressKey(page, "ArrowDown");
  await waitFor(
    async () => ((await page.locator("#mc-ui .mc-focus-ring").isVisible()) ? true : null),
    "the ring shows",
    8000,
  );
  await pressKey(page, "Escape");
  await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "back on Title", 15_000);
});

test("a right-click inspects a tile and a hover shows the card popover (desktop)", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "a mouse feature");
  test.setTimeout(120_000);
  await openScreen(page);
  const tile = (await stopOf(page, "scenario:rhino"))!;
  const x = tile.x + tile.width / 2;
  const y = tile.y + tile.height / 3;
  await page.mouse.move(x - 5, y);
  await page.mouse.move(x, y);
  await waitFor(
    async () => ((await hook<string | null>(page, DEBUG, "hoverKey")) ? true : null),
    "the hover popover shows",
    10_000,
  );
  await page.mouse.click(x, y, { button: "right" });
  await waitFor(
    async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null),
    "Inspect opens",
    10_000,
  );
});

test("a swipe along a shelf that lifts over a tile picks nothing (phone)", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a touch feature");
  test.setTimeout(120_000);
  await openScreen(page);
  const before = await selected(page);
  const tile = (await stopOf(page, "scenario:klaw"))!;
  const y = tile.y + tile.height / 2;
  const from = { x: Math.min(tile.x + tile.width - 20, 360), y };
  const cdp = await page.context().newCDPSession(page);
  const send = (type: string, point?: { x: number; y: number }) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: point ? [{ ...point, id: 1 }] : [] });
  // Left and back to where it started: a press and a release on the same tile, but a swipe, not a tap.
  await send("touchStart", from);
  for (let i = 1; i <= 6; i++) await send("touchMove", { x: from.x - 24 * i, y });
  for (let i = 5; i >= 0; i--) await send("touchMove", { x: from.x - 24 * i, y });
  await page.waitForTimeout(150);
  await send("touchEnd");
  await cdp.detach();
  await page.waitForTimeout(400);
  expect(await selected(page)).toBe(before);
  expect(await activeScenes(page)).not.toContain("InspectOverlay");
});

test("the screen reads in Spanish", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mc-settings", '{"cardLanguage":"es"}'));
  await openScreen(page);
  await waitForText(page, "Elige un escenario", { sceneKey: "ScenarioSelect" });
  await waitForText(page, "VER TODO", { sceneKey: "ScenarioSelect" });
  await waitForText(page, "Elegir Héroes", { sceneKey: "ScenarioSelect" });
});
