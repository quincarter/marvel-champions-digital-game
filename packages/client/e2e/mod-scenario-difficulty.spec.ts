import { expect, test, type Page } from "@playwright/test";
import {
  activeScenes,
  clickText,
  findText,
  hasText,
  installPageHelpers,
  isSceneUp,
  settle,
  waitFor,
} from "./helpers.js";
import { serveCatalog, stageCatalog } from "./pack-catalog-helpers.js";
import { clickStop, hasStop, routeStops, seatDeckThroughTile, waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";

/**
 * A Mod Store scenario pack's scenario offers the whole difficulty row a base scenario has (#786): Standard II and III
 * (Expert II on expert) beside the Standard set, and skirmish mode with the villain versions the difficulty uses. Before
 * the fix the row had only Standard / Expert and heroic. Set `SHOOT_786=<dir>` to also write the PR's screenshots.
 */
const PACK = "mephisto-nep";
const SCENARIO = "mephisto-nep-mephisto";

const stopKeys = async (page: Page): Promise<readonly string[]> =>
  ((await routeStops(page, "Setup"))?.stops ?? []).map((stop) => stop.key);

const SIZES: readonly (readonly [string, number, number])[] = [
  ["se", 375, 667],
  ["pixel", 412, 924],
  ["tablet-portrait", 820, 1180],
  ["tablet", 1180, 820],
  ["desktop", 1440, 980],
];

test(`a Mod Store scenario offers Standard II / III, Expert II and skirmish on Set the table`, async ({
  page,
  baseURL,
}) => {
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

  // Back to the title, then New game: the pack's scenario, a base precon, and on to Set the table.
  for (let i = 0; i < 10 && !(await activeScenes(page)).includes("Title"); i++) {
    await page.keyboard.press("Escape");
    await settle(page);
    await page.waitForTimeout(500);
  }
  await waitForScene(page, "Title");
  await settle(page);
  await clickText(page, "NEW GAME", { sceneKey: "Title" });
  await waitForScene(page, "ScenarioSelect");
  await waitFor(
    async () => (await hasStop(page, `scenario:${SCENARIO}`, "ScenarioSelect")) || null,
    "the pack scenario",
  );
  // The pack's shelf sits below the base ones: narrow the list to it first, as a player would.
  if (!(await hasStop(page, "scenario-search", "ScenarioSelect")))
    await clickStop(page, "scenario-search-toggle", "ScenarioSelect");
  await clickStop(page, "scenario-search", "ScenarioSelect");
  await page.keyboard.type("Mephisto");
  await settle(page);
  await clickStop(page, `scenario:${SCENARIO}`, "ScenarioSelect");
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
  expect(await hasText(page, "Mephisto", "Setup")).toBe(true);

  const standard = await waitFor(async () => {
    const keys = await stopKeys(page);
    return keys.includes("option:standardSet:standard_iii") ? keys : null;
  }, "the Standard set chips");
  for (const key of ["option:standardSet:standard_ii", "option:heroic:up", "option:skirmish:1", "option:skirmish:2"])
    expect(standard).toContain(key);
  await clickStop(page, "option:standardSet:standard_iii", "Setup");
  await settle(page);

  if (process.env.SHOOT_786) {
    for (const [name, width, height] of SIZES) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${process.env.SHOOT_786}/standard-${name}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);
  }

  // Expert: Expert II joins, and the versions move on to the expert stages (II and III).
  await clickStop(page, "difficulty:expert", "Setup");
  const expert = await waitFor(async () => {
    const keys = await stopKeys(page);
    return keys.includes("option:expertSet:expert_ii") && keys.includes("option:skirmish:3") ? keys : null;
  }, "the expert choices");
  expect(expert).not.toContain("option:skirmish:1");
  await clickStop(page, "option:skirmish:3", "Setup");
  await settle(page);
  if (process.env.SHOOT_786) await page.screenshot({ path: `${process.env.SHOOT_786}/expert-desktop.png` });

  await clickStop(page, "deal-it-out", "Setup");
  await waitFor(async () => !(await activeScenes(page)).includes("Setup"), "the game dealt", 60_000);
  staged.dispose();
});
