import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { clickText, findText, installPageHelpers, settle, waitFor } from "./helpers.js";
import { serveCatalog, stageCatalog } from "./pack-catalog-helpers.js";
import { clickStop, hasStop, waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";

/**
 * Scenario select's product chips follow the shelves (issue #966). An installed scenario pack that names its wave sits on
 * that wave's last shelf when custom content is mixed in (Settings, issue #734), so its scenario is under that shelf's
 * chip and the pack gets no chip of its own; with custom content on a shelf of its own, every pack shares one "Custom
 * packs" chip. Mephisto names wave 9 (Trickster Takeover's); the copy here says so, whatever the fetched pack carries.
 */

const PACK = "mephisto-nep";
const MEPHISTO = "mephisto-nep-mephisto";

interface Stop {
  readonly key: string;
}

const stops = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    (window as unknown as { __mcScenarioSelectDebug: { stops: () => Stop[] } }).__mcScenarioSelectDebug
      .stops()
      .map((stop) => stop.key),
  );

const chips = async (page: Page): Promise<string[]> =>
  (await stops(page)).filter((key) => key.startsWith("scenario-chip:product:")).map((key) => key.slice(22));

const shownScenarios = async (page: Page): Promise<string[]> =>
  (await stops(page)).filter((key) => key.startsWith("scenario:")).map((key) => key.slice("scenario:".length));

/** A copy of the community pack that names wave 9, so a mixed placement shelves it beside Trickster Takeover. */
function waveNamingCopy(): string {
  const source = fileURLToPath(new URL(`../../../content-packs/community/${PACK}`, import.meta.url));
  const dir = join(mkdtempSync(join(tmpdir(), "mc-966-")), PACK);
  cpSync(source, dir, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(dir, "pack.json"), "utf8")) as Record<string, unknown>;
  writeFileSync(join(dir, "pack.json"), JSON.stringify({ ...manifest, wave: "cycle9" }, null, 2));
  return dir;
}

async function installAndOpen(page: Page, baseURL: string, placement: "mixed" | "bottom"): Promise<void> {
  const staged = await stageCatalog(baseURL, [PACK], { [PACK]: waveNamingCopy() });
  await serveCatalog(page, staged);
  await installPageHelpers(page);
  await quietGuide(page);
  await page.addInitScript((placement) => {
    const settings = JSON.parse(localStorage.getItem("mc-settings") ?? "{}");
    localStorage.setItem("mc-settings", JSON.stringify({ ...settings, customPlacement: placement }));
  }, placement);
  await page.goto(`/?screen=mod-store&pack=${PACK}&unlock=all`);
  await waitForScene(page, "ModStore");
  await waitForScene(page, "ModNoticeOverlay");
  await clickText(page, "Got it", { sceneKey: "ModNoticeOverlay" });
  await settle(page);
  await clickText(page, "INSTALL (", { sceneKey: "ModStore", timeoutMs: 30_000 });
  await waitFor(async () => ((await findText(page, "REMOVE", "ModStore")).length > 0 ? true : null), "install", 90_000);
  await page.goto("/?screen=scenario-select&unlock=all");
  await waitForScene(page, "ScenarioSelect");
  await waitFor(async () => (await hasStop(page, "next", "ScenarioSelect")) || null, "scenario list", 30_000);
  await settle(page);
}

test.beforeEach(({ page }) => {
  test.skip(page.viewportSize()!.width < 1024, "the chips are behind the Filters button on a phone");
});

test("a scenario pack mixed in beside its wave is under that wave's chip, with no chip of its own", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(240_000);
  await installAndOpen(page, baseURL!, "mixed");
  const products = await chips(page);
  expect(products).not.toContain(PACK);
  expect(products).not.toContain("custom-packs");
  // The chip of the shelf the pack's scenario sits on: wave 9's last shelf (a filtered shelf is short, so every tile is drawn).
  let holder: string | null = null;
  for (const code of products) {
    await clickStop(page, `scenario-chip:product:${code}`, "ScenarioSelect");
    await settle(page);
    const shown = await shownScenarios(page);
    if (shown.includes(MEPHISTO)) holder = code;
    await clickStop(page, `scenario-chip:product:${code}`, "ScenarioSelect");
    await settle(page);
    if (holder) break;
  }
  expect(holder).not.toBeNull();
  expect(["tt", "aos", "bp", "falcon", "silk", "winter", "elektra", "shadowland"]).toContain(holder);
});

test("with custom content on its own shelf, the packs share one Custom packs chip", async ({ page, baseURL }) => {
  test.setTimeout(240_000);
  await installAndOpen(page, baseURL!, "bottom");
  const products = await chips(page);
  expect(products).not.toContain(PACK);
  expect(products.at(-1)).toBe("custom-packs");
  await clickStop(page, "scenario-chip:product:custom-packs", "ScenarioSelect");
  await settle(page);
  const shown = await shownScenarios(page);
  expect(shown).toEqual([MEPHISTO]);
});
