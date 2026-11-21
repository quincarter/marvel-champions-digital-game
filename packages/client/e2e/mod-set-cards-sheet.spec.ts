import { expect, test } from "@playwright/test";
import { activeScenes, clickText, findText, installPageHelpers, isSceneUp, settle, waitFor } from "./helpers.js";
import { serveCatalog, stageCatalog } from "./pack-catalog-helpers.js";
import {
  clickStop,
  hasStop,
  routeStops,
  scrollStopIntoView,
  seatDeckThroughTile,
  waitForScene,
} from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";

/**
 * A Mod Store pack's modular set opens its cards on Set the table (#951): the set's Cards sheet read the base game's
 * cards and sets alone, so a pack set (Mephisto's Blackheart) showed its id and "0 cards". Set `SHOOT_951=<dir>` to
 * write the PR's screenshots.
 */
const PACK = "mephisto-nep";
const SET = "mephisto-nep-blackheart";

const SIZES: readonly (readonly [string, number, number])[] = [
  ["se", 375, 667],
  ["pixel", 412, 924],
  ["tablet-portrait", 820, 1180],
  ["tablet", 1180, 820],
  ["desktop", 1440, 980],
];

test("a Mod Store modular set shows its cards on Set the table (#951)", async ({ page, baseURL }) => {
  test.setTimeout(300_000);
  const staged = await stageCatalog(baseURL!, [PACK]);
  await serveCatalog(page, staged);
  await installPageHelpers(page);
  await quietGuide(page);

  await page.goto(`/?screen=mod-store&pack=${PACK}`);
  await waitForScene(page, "ModStore");
  await waitForScene(page, "ModNoticeOverlay");
  await clickText(page, "Got it", { sceneKey: "ModNoticeOverlay" });
  await waitFor(async () => (!(await isSceneUp(page, "ModNoticeOverlay")) ? true : null), "the notice closes");
  await settle(page);
  await clickText(page, "INSTALL (", { sceneKey: "ModStore", timeoutMs: 30_000 });
  await waitFor(
    async () => ((await findText(page, "REMOVE", "ModStore")).length > 0 ? true : null),
    `${PACK} installs`,
    90_000,
  );

  for (let i = 0; i < 10 && !(await activeScenes(page)).includes("Title"); i++) {
    await page.keyboard.press("Escape");
    await settle(page);
    await page.waitForTimeout(500);
  }
  await waitForScene(page, "Title");
  await settle(page);
  await clickText(page, "NEW GAME", { sceneKey: "Title" });
  await waitForScene(page, "ScenarioSelect");
  await waitFor(async () => (await hasStop(page, "scenario:rhino", "ScenarioSelect")) || null, "Rhino");
  await clickStop(page, "scenario:rhino", "ScenarioSelect");
  await settle(page);
  await clickStop(page, "next", "ScenarioSelect");
  await waitForScene(page, "Seats");
  await waitFor(
    async () =>
      (await hasStop(page, "hero-search", "Seats")) || (await hasStop(page, "hero-search-toggle", "Seats"))
        ? true
        : null,
    "hero search",
    10_000,
  );
  if (!(await hasStop(page, "hero-search", "Seats"))) await clickStop(page, "hero-search-toggle", "Seats");
  await seatDeckThroughTile(page, "precon:core-spider-man-justice", { search: "Spider-Man" });
  await settle(page);
  await clickStop(page, "play", "Seats");
  await waitForScene(page, "Setup");
  await settle(page);

  // A tall window lays the whole modular grid out unscrolled, so the pack set's "Cards" tab (the tile's right end) is
  // pressed where it is drawn.
  await page.setViewportSize({ width: 1440, height: 2400 });
  await page.waitForTimeout(1500);
  await waitFor(async () => (await hasStop(page, `modular:${SET}`, "Setup")) || null, "the pack's modular set");
  await scrollStopIntoView(page, `modular:${SET}`, "Setup");
  const stop = (await routeStops(page, "Setup"))!.stops.find((s) => s.key === `modular:${SET}`)!;
  await page.mouse.click(stop.rect.x + stop.rect.width - 24, stop.rect.y + stop.rect.height - 12);
  await waitForScene(page, "SetCardsOverlay");
  await settle(page);
  await page.waitForTimeout(1500);

  expect((await findText(page, "Blackheart", "SetCardsOverlay")).length).toBeGreaterThan(0);
  expect((await findText(page, SET, "SetCardsOverlay")).length).toBe(0);
  expect((await findText(page, "0 cards", "SetCardsOverlay")).length).toBe(0);

  if (process.env.SHOOT_951) {
    for (const [name, width, height] of SIZES) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${process.env.SHOOT_951}/set-cards-${name}.png` });
    }
  }
  staged.dispose();
});
