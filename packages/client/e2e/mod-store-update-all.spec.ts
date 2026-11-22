import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { clickText, hasText, installPageHelpers, isSceneUp, settle, trackPageErrors, waitFor } from "./helpers.js";
import { communityPackIds, serveCatalog, stageCatalog } from "./pack-catalog-helpers.js";
import { waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";

const COMMUNITY = fileURLToPath(new URL("../../../content-packs/community", import.meta.url));
const NEXT = "99.0.0";

/** A copy of a community pack's source with its version bumped to `NEXT`: the store's "newer version". */
function bumpedCopy(packId: string): string {
  const dir = mkdtempSync(join(tmpdir(), `mc-e2e-bump-${packId}-`));
  cpSync(join(COMMUNITY, packId), dir, { recursive: true });
  const manifestPath = join(dir, "pack.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version: string };
  manifest.version = NEXT;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return dir;
}

const waitForTextIn = (page: Page, text: string, timeoutMs = 30_000): Promise<true> =>
  waitFor(async () => ((await hasText(page, text, "ModStore")) ? true : null), `"${text}" in the store`, timeoutMs);

async function installFromPage(page: Page, packId: string): Promise<void> {
  await page.goto(`/?screen=mod-store&pack=${packId}`);
  await waitForScene(page, "ModStore");
  await settle(page);
  if (await isSceneUp(page, "ModNoticeOverlay")) {
    await clickText(page, "Got it", { sceneKey: "ModNoticeOverlay" });
    await waitFor(async () => (!(await isSceneUp(page, "ModNoticeOverlay")) ? true : null), "the notice closes");
    await settle(page);
  }
  await clickText(page, "INSTALL (", { sceneKey: "ModStore", timeoutMs: 30_000 });
  await waitForTextIn(page, "REMOVE", 90_000);
}

/**
 * Update all (issue #957): two installed packs the store has a newer version of. The browse view's bar counts them and
 * its Update all button updates them one after another; one whose download is broken keeps its old version and is
 * named on the bar, while the other is updated.
 */
test("Update all updates every installed pack with an update, and names one that fails", async ({ page, baseURL }) => {
  test.setTimeout(360_000);
  const [first, second] = communityPackIds();
  expect(second, "two community packs (pnpm packs:fetch)").toBeTruthy();
  const errors = trackPageErrors(page);
  const before = await stageCatalog(baseURL!, [first!, second!]);
  const copies = [bumpedCopy(first!), bumpedCopy(second!)];
  const after = await stageCatalog(baseURL!, [first!, second!], { [first!]: copies[0]!, [second!]: copies[1]! });
  try {
    await serveCatalog(page, before);
    await installPageHelpers(page);
    await quietGuide(page);
    await installFromPage(page, first!);
    await installFromPage(page, second!);

    // The store now lists a newer version of both; the second's download is not the size the store lists.
    const index = after.index as { packs: { id: string; versions: Record<string, { zipBytes: number }> }[] };
    index.packs.find((pack) => pack.id === second)!.versions[NEXT]!.zipBytes += 1;
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await serveCatalog(page, after);
    await page.goto("/?screen=mod-store");
    await waitForScene(page, "ModStore");
    await waitForTextIn(page, "2 installed packs have updates.");

    await clickText(page, "UPDATE ALL", { sceneKey: "ModStore" });
    await waitForTextIn(page, "1 pack updated.", 180_000);
    expect(await hasText(page, `Could not update: ${after.heroName[second!]}`, "ModStore")).toBe(true);
    // The failed one can still update, so the button stays.
    expect(await hasText(page, "UPDATE ALL", "ModStore")).toBe(true);

    // The first is on the new version; the second still offers its update.
    await page.goto(`/?screen=mod-store&pack=${first}`);
    await waitForScene(page, "ModStore");
    await waitForTextIn(page, "REMOVE");
    expect(await hasText(page, "UPDATE TO", "ModStore")).toBe(false);
    await page.goto(`/?screen=mod-store&pack=${second}`);
    await waitForScene(page, "ModStore");
    await waitForTextIn(page, `UPDATE TO ${NEXT}`);
    expect(errors).toEqual([]);
  } finally {
    before.dispose();
    after.dispose();
    for (const dir of copies) rmSync(dir, { recursive: true, force: true });
  }
});
