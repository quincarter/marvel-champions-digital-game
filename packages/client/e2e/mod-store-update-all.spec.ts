import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import {
  activeScenes,
  clickText,
  hasText,
  installPageHelpers,
  isSceneUp,
  settle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";
import { communityHeroPackIds, serveCatalog, stageCatalog, type StagedCatalog } from "./pack-catalog-helpers.js";
import { waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";

/**
 * Update all (issue #957), from the Mod Store's browse view. Each test installs two community hero packs, then serves a
 * catalog listing a newer version of both (built from copies of their sources with the version bumped, since an
 * install checks the version inside the zip). The packs are taken in the order Update all takes them (by name), and
 * each one's zip downloads are recorded, so the order and what was never fetched can be checked.
 */

const COMMUNITY = fileURLToPath(new URL("../../../content-packs/community", import.meta.url));
const NEXT = "99.0.0";

function bumpedCopy(packId: string): string {
  const dir = mkdtempSync(join(tmpdir(), `mc-e2e-bump-${packId}-`));
  cpSync(join(COMMUNITY, packId), dir, { recursive: true });
  const manifestPath = join(dir, "pack.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version: string };
  manifest.version = NEXT;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return dir;
}

const has = (page: Page, text: string): Promise<boolean> => hasText(page, text, "ModStore");

const waitForTextIn = (page: Page, text: string, timeoutMs = 30_000): Promise<true> =>
  waitFor(async () => ((await has(page, text)) ? true : null), `"${text}" in the store`, timeoutMs);

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
  // Text matching ignores case, and a pack's description may say "remove": wait for the Install button to go instead,
  // so the next page load never cuts an install short.
  await waitFor(
    async () => (!(await has(page, "INSTALL (")) && (await has(page, "REMOVE")) ? true : null),
    `${packId} installs`,
    90_000,
  );
}

interface Setup {
  /** The two packs in the order Update all takes them. */
  readonly ids: readonly [string, string];
  readonly names: Readonly<Record<string, string>>;
  /** Every request for a pack's new zip, by pack id, in the order made. */
  readonly zipRequests: string[];
  dispose(): void;
}

/** Installs two packs at their own versions, then serves a catalog with `NEXT` of both and opens the store. */
async function setUp(page: Page, baseURL: string): Promise<Setup> {
  const picked = communityHeroPackIds().slice(0, 2);
  expect(picked.length, "two community hero packs (pnpm packs:fetch)").toBe(2);
  const before = await stageCatalog(baseURL, picked);
  const copies = picked.map(bumpedCopy);
  let after: StagedCatalog | undefined;
  const dispose = (): void => {
    before.dispose();
    after?.dispose();
    for (const dir of copies) rmSync(dir, { recursive: true, force: true });
  };
  try {
    after = await stageCatalog(baseURL, picked, Object.fromEntries(picked.map((id, i) => [id, copies[i]!])));
    const names = after.heroName;
    const ids = [...picked].sort((a, b) => names[a]!.localeCompare(names[b]!)) as [string, string];
    await serveCatalog(page, before);
    await installPageHelpers(page);
    await quietGuide(page);
    for (const id of ids) await installFromPage(page, id);

    await page.unrouteAll({ behavior: "ignoreErrors" });
    await serveCatalog(page, after);
    const zipRequests: string[] = [];
    page.on("request", (request) => {
      const match = new RegExp(`/e2e-packs/([^/]+)/${NEXT.replace(/\./g, "\\.")}/[^/]+\\.zip`).exec(request.url());
      if (match) zipRequests.push(match[1]!);
    });
    await page.goto("/?screen=mod-store");
    await waitForScene(page, "ModStore");
    await waitForTextIn(page, "2 installed packs have updates.");
    return { ids, names, zipRequests, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

/** The zip requests with repeats of one pack in a row folded (a download may be tried again). */
const order = (requests: readonly string[]): string[] => requests.filter((id, i) => id !== requests[i - 1]);

test("Update all goes on past a pack that fails, leads to it from any tab, and forgets it once it is retried", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(600_000);
  const errors = trackPageErrors(page);
  const setup = await setUp(page, baseURL!);
  try {
    const [failing, other] = setup.ids;
    // The first pack in the run cannot be downloaded until the retry, so the run must go on to the second.
    let reachable = false;
    await page.route(new RegExp(`/e2e-packs/${failing}/${NEXT.replace(/\./g, "\\.")}/[^/]+\\.zip`), (route) =>
      reachable ? route.fallback() : route.abort("failed"),
    );

    // Run from Scenarios, which lists neither hero pack: the bar is over every tab.
    await clickText(page, "SCENARIOS", { sceneKey: "ModStore" });
    await waitForTextIn(page, "2 installed packs have updates.");
    await clickText(page, "UPDATE ALL", { sceneKey: "ModStore" });
    await waitForTextIn(page, "1 pack updated.", 180_000);
    expect(order(setup.zipRequests)).toEqual([failing, other]);
    expect(await has(page, "1 pack could not update")).toBe(true);
    // Its tile is not on this tab: Show them opens Installed, where the tile says so.
    expect(await has(page, "Retry update")).toBe(false);
    await clickText(page, "SHOW THEM", { sceneKey: "ModStore" });
    await waitForTextIn(page, "Retry update");
    expect(await has(page, "SHOW THEM")).toBe(false);
    // Update all is still offered for it.
    expect(await has(page, "UPDATE ALL")).toBe(true);

    // Retried from its own page in the same visit: it updates, and the bar no longer reports it.
    await clickText(page, setup.names[failing]!, { sceneKey: "ModStore" });
    // Its page still says why, though another pack's update ran after it.
    await waitForTextIn(page, "The download failed");
    reachable = true;
    await clickText(page, `UPDATE TO ${NEXT}`, { sceneKey: "ModStore", timeoutMs: 30_000 });
    await waitFor(
      async () => ((await has(page, "REMOVE")) && !(await has(page, "UPDATE TO")) ? true : null),
      `${failing} updates from its page`,
      120_000,
    );
    await page.keyboard.press("Escape");
    await waitForTextIn(page, "1 pack updated.");
    expect(await has(page, "could not update")).toBe(false);
    expect(await has(page, "Retry update")).toBe(false);
    expect(await has(page, "UPDATE ALL")).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    setup.dispose();
  }
});

test("Update all keeps going when the player leaves the store, and Stop ends it after the current pack", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(600_000);
  const errors = trackPageErrors(page);
  const setup = await setUp(page, baseURL!);
  try {
    const [first, second] = setup.ids;
    // The first pack's download is held until the test lets it through.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(new RegExp(`/e2e-packs/${first}/${NEXT.replace(/\./g, "\\.")}/[^/]+\\.zip`), async (route) => {
      await held;
      await route.fallback();
    });

    await clickText(page, "UPDATE ALL", { sceneKey: "ModStore" });
    await waitForTextIn(page, "Updating 1 of 2");

    // Out to the Title and back while the first pack downloads: the run is still going.
    await page.keyboard.press("Escape");
    await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "the Title");
    await settle(page);
    await clickText(page, "Mod Store", { sceneKey: "Title" });
    await waitForScene(page, "ModStore");
    await waitForTextIn(page, "Updating 1 of 2");

    await clickText(page, "STOP", { sceneKey: "ModStore" });
    await waitForTextIn(page, "STOPPING AFTER THIS ONE");
    release();
    await waitForTextIn(page, "Stopped. The rest can still update.", 120_000);
    expect(await has(page, "1 pack updated.")).toBe(true);
    // The pack after Stop was never downloaded, and still has its update.
    expect(setup.zipRequests).not.toContain(second);
    expect((await has(page, "1 installed pack")) || (await has(page, "UPDATE ALL"))).toBe(true);

    // Update all again takes what is left.
    await clickText(page, "UPDATE ALL", { sceneKey: "ModStore" });
    await waitFor(
      async () =>
        (await has(page, "1 pack updated.")) && !(await has(page, "Stopped")) && !(await has(page, "UPDATE ALL"))
          ? true
          : null,
      "the second run finishes",
      180_000,
    );
    expect(order(setup.zipRequests)).toEqual([first, second]);
    expect(errors).toEqual([]);
  } finally {
    setup.dispose();
  }
});

test("an update that lands while the store reloads its catalog is not undone by the older list", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(600_000);
  const errors = trackPageErrors(page);
  const setup = await setUp(page, baseURL!);
  try {
    const [first, second] = setup.ids;
    let releaseZip: () => void = () => {};
    const zipHeld = new Promise<void>((resolve) => (releaseZip = resolve));
    await page.route(new RegExp(`/e2e-packs/${first}/${NEXT.replace(/\./g, "\\.")}/[^/]+\\.zip`), async (route) => {
      await zipHeld;
      await route.fallback();
    });
    await clickText(page, "UPDATE ALL", { sceneKey: "ModStore" });
    await waitForTextIn(page, "Updating 1 of 2");

    // Out to the Title, then back in with the catalog held: the store reads the installed packs (both old) at once.
    await page.keyboard.press("Escape");
    await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "the Title");
    await settle(page);
    let catalogHeld = true;
    let releaseCatalog: () => void = () => {};
    const catalogGate = new Promise<void>((resolve) => (releaseCatalog = resolve));
    await page.route(/\/packs\/index\.json(\?.*)?$/, async (route) => {
      if (catalogHeld) await catalogGate;
      await route.fallback();
    });
    await clickText(page, "Mod Store", { sceneKey: "Title" });
    await waitForScene(page, "ModStore");

    // Both updates land while the catalog is still held...
    const secondDone = page.waitForResponse(
      (response) => response.url().includes(`/e2e-packs/${second}/${NEXT}/`) && response.url().endsWith(".zip"),
    );
    releaseZip();
    await secondDone;
    await page.waitForTimeout(8000);
    // ...and only then does the catalog answer: the store must not offer either update again.
    catalogHeld = false;
    releaseCatalog();
    await waitForTextIn(page, "2 packs updated.", 120_000);
    expect(await has(page, "UPDATE ALL")).toBe(false);
    expect(await has(page, "have updates")).toBe(false);
    expect(await has(page, "has an update")).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    setup.dispose();
  }
});
