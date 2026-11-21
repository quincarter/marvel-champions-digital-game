import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, findText, installPageHelpers, isSceneUp, settle, waitFor } from "./helpers.js";
import { serveCatalog, stageCatalog } from "./pack-catalog-helpers.js";
import { clickStop, hasStop, routeStops, seatDeckThroughTile, waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";

/**
 * A Mod Store scenario that sets a modular set aside (The Rose's shape, #943) offers the choice on Set the table: a
 * "Set-aside modular set" stepper that starts on the authors' recommendedSetAsideModularSetIds and steps through the
 * modular picker's candidates. Before the fix there was nothing to pick and the game drew a set at random. The spec
 * stages the repo's sample scenario pack with the two fields added. Set `SHOOT_943=<dir>` to write the PR's screenshots.
 */
const PACK = "sample-scenario";
const SCENARIO = "sample-scenario-clockwork";
const SAMPLE = fileURLToPath(new URL("../../../content-packs/sample-scenario", import.meta.url));

const SIZES: readonly (readonly [string, number, number])[] = [
  ["se", 375, 667],
  ["pixel", 412, 924],
  ["tablet-portrait", 820, 1180],
  ["tablet", 1180, 820],
  ["desktop", 1440, 980],
];

const stopKeys = async (page: Page): Promise<readonly string[]> =>
  ((await routeStops(page, "Setup"))?.stops ?? []).map((stop) => stop.key);

/** A copy of the sample pack whose scenario sets one modular set aside, Masters of Evil by default. */
function changedSample(): string {
  const root = mkdtempSync(join(tmpdir(), "mc-e2e-set-aside-"));
  const dir = join(root, PACK);
  cpSync(SAMPLE, dir, { recursive: true });
  const scenarios = join(dir, "scenarios");
  for (const name of readdirSync(scenarios)) {
    const file = join(scenarios, name);
    const record = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    if (record.id !== SCENARIO) continue;
    writeFileSync(
      file,
      JSON.stringify({ ...record, setAsideModularSetCount: 1, recommendedSetAsideModularSetIds: ["masters_of_evil"] }),
    );
  }
  return dir;
}

test("a Mod Store scenario that sets a modular set aside offers it on Set the table (#943)", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const source = changedSample();
  const staged = await stageCatalog(baseURL!, [PACK], { [PACK]: source });
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
  if (!(await hasStop(page, "scenario-search", "ScenarioSelect")))
    await clickStop(page, "scenario-search-toggle", "ScenarioSelect");
  // A search typed while the installed pack's scenario is still joining the list can come up empty: type it again.
  // Always narrowed first: a tile far down the unfiltered list is a stop that a press may not reach.
  for (
    let attempt = 0;
    attempt === 0 || (attempt < 4 && !(await hasStop(page, `scenario:${SCENARIO}`, "ScenarioSelect")));
    attempt++
  ) {
    await clickStop(page, "scenario-search", "ScenarioSelect");
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("Clockmaker");
    await settle(page);
    await waitFor(
      async () => (await hasStop(page, `scenario:${SCENARIO}`, "ScenarioSelect")) || null,
      "the scenario",
      10_000,
    ).catch(() => null);
  }
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

  await waitFor(async () => (await stopKeys(page)).includes("option:setAside:0:next") || null, "the set-aside stepper");
  expect((await findText(page, "Masters of Evil", "Setup")).length).toBeGreaterThan(0);
  expect((await findText(page, "Set-aside modular set", "Setup")).length).toBeGreaterThan(0);

  if (process.env.SHOOT_943) {
    for (const [name, width, height] of SIZES) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${process.env.SHOOT_943}/set-aside-${name}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);
  }

  // A step moves off the recommendation to the table's own pick, and back.
  await clickStop(page, "option:setAside:0:next", "Setup");
  await settle(page);
  await waitFor(async () => (await findText(page, "YOUR PICK", "Setup")).length > 0 || null, "the table's pick");
  if (process.env.SHOOT_943) await page.screenshot({ path: `${process.env.SHOOT_943}/set-aside-stepped-desktop.png` });
  await clickStop(page, "option:setAside:0:prev", "Setup");
  await settle(page);
  expect((await findText(page, "Masters of Evil", "Setup")).length).toBeGreaterThan(0);

  await clickStop(page, "deal-it-out", "Setup");
  await waitFor(async () => !(await activeScenes(page)).includes("Setup"), "the game dealt", 60_000);
  staged.dispose();
  rmSync(join(source, ".."), { recursive: true, force: true });
});
