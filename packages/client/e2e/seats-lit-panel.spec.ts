import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, pressHookStop, settle, trackPageErrors, waitFor } from "./helpers.js";
import { hook, openApp } from "./wave6-helpers-b.js";

/**
 * Take your seats as one page element over the canvas (`mc-seats-page`, its sections in `components/seats/`),
 * hero tiles that show the small copy of each picture, taps that seat a hero, a drag that ends over a tile seating
 * nothing (the "no tap on finger lift" rule, issue #227), the search field narrowing the tiles, and "See all" opening a
 * pack as a full grid. Runs on the desktop and phone projects.
 */

const seats = async (page: Page): Promise<string[]> => (await hook<string[]>(page, "__mcSeatsDebug", "seats")) ?? [];

interface HeroPicture {
  readonly src: string | null;
  readonly loaded: boolean;
  readonly width: number;
}

const pictures = async (page: Page): Promise<HeroPicture[]> =>
  (await hook<HeroPicture[]>(page, "__mcSeatsDebug", "heroPictures")) ?? [];

async function open(page: Page): Promise<void> {
  await openApp(page, "screen=seats&players=1", { landing: "Seats" });
  await waitFor(async () => ((await pictures(page)).length > 0 ? true : null), "the hero tiles", 30_000);
  await settle(page);
}

test.describe("Take your seats panels", () => {
  test("the screen is panels, and the tiles load the small copy of each hero picture", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = trackPageErrors(page);
    await open(page);
    const regions = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#mc-ui > [data-scene="Seats"]')).map(
        (wrap) => wrap.firstElementChild?.tagName,
      ),
    );
    expect(regions).toEqual(["MC-SEATS-PAGE"]);
    // Pictures load lazily: wait for the ones in view, then check none is a full-size 4000 px picture.
    await waitFor(async () => ((await pictures(page)).some((p) => p.loaded) ? true : null), "a loaded picture", 30_000);
    const loaded = (await pictures(page)).filter((p) => p.loaded);
    expect(loaded.length).toBeGreaterThan(0);
    for (const picture of loaded) expect(picture.width, picture.src ?? "").toBeLessThanOrEqual(1400);
    expect(errors).toEqual([]);
  });

  test("a tap on a hero tile seats it, and a drag that ends over a tile seats nothing", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = trackPageErrors(page);
    await open(page);
    const before = await seats(page);
    const stops = (await hook<{ key: string; x: number; y: number; width: number; height: number }[]>(
      page,
      "__mcSeatsDebug",
      "stops",
    ))!;
    const list = (await hook<{ x: number; y: number; width: number; height: number }>(
      page,
      "__mcSeatsDebug",
      "listRect",
    ))!;
    const tile = stops.find(
      (s) =>
        s.key.startsWith("hero:") &&
        s.x >= list.x &&
        s.x + s.width <= list.x + list.width &&
        s.y > list.y &&
        s.y + s.height < list.y + list.height,
    );
    expect(tile, "a hero tile fully in view").toBeTruthy();
    // A press that wanders well past the tap slop and lifts over the tile presses nothing.
    const cx = tile!.x + tile!.width / 2;
    const cy = tile!.y + tile!.height / 2;
    await page.mouse.move(cx - 60, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy, { steps: 6 });
    await page.mouse.up();
    await settle(page);
    expect(await seats(page)).toEqual(before);
    // A tap seats it (a hero with several decks opens the deck submenu instead; it is then picked there).
    await pressHookStop(page, "__mcSeatsDebug", "hero-random");
    await waitFor(
      async () => ((await seats(page)).length > before.length || (await seats(page))[0] !== before[0] ? true : null),
      "a hero seated",
      15_000,
    );
    expect(errors).toEqual([]);
  });

  test("the search field narrows the tiles", async ({ page }, info) => {
    test.setTimeout(120_000);
    test.skip(
      info.project.name === "phone",
      "the phone's search field is behind its toggle (covered by the e2e filter specs)",
    );
    const errors = trackPageErrors(page);
    await open(page);
    const count = async (): Promise<number> => (await pictures(page)).length;
    const all = await count();
    const field = page.locator('#mc-ui [data-scene="Seats"] mc-search-field input').first();
    await field.click();
    await field.fill("spider");
    await waitFor(async () => ((await count()) < all ? true : null), "fewer tiles", 15_000);
    expect(await count()).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("See all opens a pack as a grid, and Back to all packs returns", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = trackPageErrors(page);
    await open(page);
    const link = page.locator('#mc-ui [data-scene="Seats"] mc-hero-shelf button[data-action="all"]').first();
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await waitFor(
      async () => ((await hook<string | null>(page, "__mcSeatsDebug", "drilledPack")) ? true : null),
      "a pack open",
      15_000,
    );
    await pressHookStop(page, "__mcSeatsDebug", "drill-back");
    await waitFor(
      async () => ((await hook<string | null>(page, "__mcSeatsDebug", "drilledPack")) === null ? true : null),
      "all packs",
      15_000,
    );
    expect(errors).toEqual([]);
  });

  test("the first press on a hero tile after a search, and on Play, is never lost", async ({ page }, info) => {
    test.setTimeout(120_000);
    test.skip(info.project.name === "phone", "mouse presses");
    const errors = trackPageErrors(page);
    await openApp(page, "screen=seats&unlock=all", { landing: "Seats" });
    await waitFor(async () => ((await pictures(page)).length > 0 ? true : null), "the hero tiles", 30_000);
    const field = page.locator('#mc-ui [data-scene="Seats"] mc-search-field input').first();
    await field.click();
    await field.fill("Maria Hill");
    await settle(page);
    type Stop = { key: string; x: number; y: number; width: number; height: number };
    const stopOf = async (prefix: string): Promise<Stop> =>
      (await hook<Stop[]>(page, "__mcSeatsDebug", "stops"))!.find((s) => s.key.startsWith(prefix))!;
    // One real click, no repeat: the tile seats its hero, or opens its deck list when the hero has several decks.
    const tile = await stopOf("hero:");
    await page.mouse.click(tile.x + tile.width / 2, tile.y + tile.height / 2);
    await waitFor(
      async () => ((await seats(page)).length > 0 || (await hook<boolean>(page, "__mcSeatsDebug", "decksOpen")) ? true : null),
      "the first press on the tile did something",
      5000,
    );
    // Play: seat someone, then one real click on Play goes on to Table setup.
    if ((await hook<boolean>(page, "__mcSeatsDebug", "decksOpen"))) await page.keyboard.press("Escape");
    if ((await seats(page)).length === 0) await pressHookStop(page, "__mcSeatsDebug", "hero-random");
    await waitFor(async () => ((await stopOf("play")) ? true : null), "Play", 10_000);
    await settle(page);
    const play = await stopOf("play");
    await page.mouse.click(play.x + play.width / 2, play.y + play.height / 2);
    await waitFor(
      async () => ((await activeScenes(page)).includes("Setup") ? true : null),
      "the first press on Play went on",
      5000,
    );
    expect(errors).toEqual([]);
  });

  test("a tile's native button and the screen's keyboard route are one: Enter acts on the focused tile only", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = trackPageErrors(page);
    await open(page);
    const focusKey = (): Promise<string | null> =>
      page.evaluate(
        () =>
          (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null }> }).__mcFocusState[
            "Seats"
          ]!().focus,
      );
    // The second tile of the roster takes native focus (what a screen reader's focus or a click does).
    const key = await page.evaluate(() => {
      // Through the open shadow roots: every hero tile's native button, in document order.
      const found: HTMLButtonElement[] = [];
      const visit = (root: ParentNode): void => {
        for (const node of root.querySelectorAll<HTMLElement>("*")) {
          if (node instanceof HTMLButtonElement && /^hero(-rec)?:/.test(node.dataset.stop ?? "")) found.push(node);
          if (node.shadowRoot) visit(node.shadowRoot);
        }
      };
      visit(document.querySelector('#mc-ui > [data-scene="Seats"] mc-seats-page')!);
      const button = found[1]!;
      button.focus();
      return button.dataset.stop ?? "";
    });
    expect(key.startsWith("hero")).toBe(true);
    await waitFor(async () => ((await focusKey()) === key ? true : null), "the route follows the native focus", 5000);
    // Enter presses that tile once (a hero seated, or its decks opened): never the tile the route had before.
    const before = await seats(page);
    await page.keyboard.press("Enter");
    await waitFor(
      async () =>
        (await seats(page)).join() !== before.join() ||
        (await findText(page, "Pick the one this seat plays")).length > 0
          ? true
          : null,
      "Enter pressed the focused tile",
      5000,
    );
    expect(await focusKey()).toBe(key);
    expect(errors).toEqual([]);
  });
});
