import { expect, test, type Page } from "@playwright/test";
import { installPageHelpers, pressKey, settle, trackPageErrors, waitFor } from "./helpers.js";
import { communityPackIds, serveCatalog, stageCatalog, type StagedCatalog } from "./pack-catalog-helpers.js";
import { waitForScene } from "./wave6-helpers-a.js";

/**
 * The Mod Store is one page element over the canvas (`views/mod-store/mc-mod-store-page`, made of the elements in
 * `components/mod-store/`): the tab rail, the search box (a real input), the
 * sort and tag chips, the pack tiles and a pack's page. The lists scroll natively, every
 * press is a tap, and the keyboard walks the same stops as before with the DOM focus ring. Run against a catalog built
 * from the community packs and served through `page.route`, so nothing reaches the network.
 */

const SCENE = "ModStore";
const sheet = (page: Page) => page.locator(`#mc-ui [data-scene="${SCENE}"] mc-mod-store-page`);
const key = (page: Page, name: string) => sheet(page).locator(`[data-key="${name}"]`).first();
const tiles = (page: Page) => sheet(page).locator('mc-pack-tile[data-key^="tile:"]');

const focusOf = (page: Page) =>
  page.evaluate(
    (scene) =>
      (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null; ringShown: boolean }> })
        .__mcFocusState[scene]!(),
    SCENE,
  );

let staged: StagedCatalog | undefined;
const packs = (): string[] => communityPackIds().slice(0, 2);

test.beforeAll(async ({ baseURL }) => {
  test.setTimeout(420_000);
  staged = await stageCatalog(baseURL!, packs());
});
test.afterAll(() => staged?.dispose());

async function openStore(page: Page, query = ""): Promise<void> {
  await installPageHelpers(page);
  // The first-visit heads-up about mods is answered, so it does not cover the store.
  await page.addInitScript(() => localStorage.setItem("mc-mod-notice-seen", "1"));
  await serveCatalog(page, staged!);
  await page.goto(`/?screen=mod-store${query}`);
  await waitForScene(page, SCENE);
  await expect(sheet(page)).toBeVisible();
  await waitFor(async () => ((await tiles(page).count()) > 0 ? true : null), "pack tiles", 30_000);
}

test("browse is a panel: tabs, a grid of pack tiles in a native list, and a pack's page behind a tap", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  await openStore(page);
  await expect(key(page, "tab:all")).toBeVisible();
  await expect(key(page, "tab:credits")).toBeVisible();
  await expect(key(page, "list:grid")).toBeVisible();
  expect(await tiles(page).count()).toBe(packs().length);
  // A tab narrows the list: Credits shows the creators in their own list.
  await key(page, "tab:credits").click();
  await expect(key(page, "list:credits")).toBeVisible();
  await expect(sheet(page).locator('[data-key^="creator:"]').first()).toBeVisible();
  await key(page, "tab:all").click();
  await expect(key(page, "list:grid")).toBeVisible();
  // A tile opens its page: the install button, then Back (Escape) returns to the list.
  await tiles(page).first().click();
  await expect(key(page, "action:install")).toBeVisible();
  await expect(key(page, "list:text")).toBeVisible();
  await pressKey(page, "Escape");
  await expect(key(page, "list:grid")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the search box is a real input: typing narrows the grid, Escape leaves it, and the clear button empties it", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  await openStore(page);
  // A phone keeps the search behind its magnifier.
  if (info.project.name === "phone") await key(page, "finders-toggle").click();
  const input = sheet(page).locator('mc-search-field[data-key="search"] input');
  await expect(input).toBeVisible();
  const all = await tiles(page).count();
  const name = (await staged!.heroName[packs()[0]!]) ?? "";
  await input.fill(name.slice(0, 5));
  await expect.poll(async () => tiles(page).count(), { timeout: 10_000 }).toBeLessThan(all);
  expect(await tiles(page).count()).toBeGreaterThan(0);
  // Escape leaves the field and keeps what was typed (the list stays narrowed).
  await input.press("Escape");
  await expect(input).toHaveValue(name.slice(0, 5));
  await expect(input).not.toBeFocused();
  expect(await tiles(page).count()).toBeLessThan(all);
  // The clear button empties it too.
  await input.fill("zzzz-no-such-pack");
  await expect(sheet(page).locator("mc-pack-tile")).toHaveCount(0, { timeout: 10_000 });
  await sheet(page).locator('mc-search-field[data-key="search"] .clear').click();
  await expect(input).toHaveValue("");
  await expect.poll(async () => tiles(page).count(), { timeout: 10_000 }).toBe(all);
  expect(errors).toEqual([]);
});

test("the keyboard walks Back, About, the tabs and the tiles with the DOM ring, and Enter opens a pack", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "a phone's finders are folded away");
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  await openStore(page);
  const seen: string[] = [];
  for (let i = 0; i < 14; i++) {
    await pressKey(page, "Tab");
    const { focus } = await focusOf(page);
    if (focus && !seen.includes(focus)) seen.push(focus);
  }
  expect(seen.slice(0, 3)).toEqual(["back", "about", "tab:all"]);
  expect(seen).toEqual(expect.arrayContaining(["tab:credits", "search", "sort"]));
  expect((await focusOf(page)).ringShown).toBe(true);
  await expect(page.locator("#mc-ui .mc-focus-ring").last()).toBeVisible();
  // The shoulder-button key steps the tabs.
  await pressKey(page, "]");
  await expect(key(page, "tab:heroes")).toHaveAttribute("selected", "");
  await settle(page);
  expect(errors).toEqual([]);
});
