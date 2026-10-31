import { readdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { trackPageErrors } from "./helpers.js";

/**
 * The release history page (`public/releases/index.html`, issue #588): every release is listed, a click swaps the
 * release in without loading a page, and a report keeps its own look inside it.
 */

const RELEASES = readdirSync(new URL("../../../.changes/", import.meta.url)).filter((f) => /^v[\d.]+\.md$/.test(f));
const PAGE = "/releases/index.html";

const LATEST_RELEASE = "https://api.github.com/**/releases/latest";

test.beforeEach(async ({ page }) => {
  await page.route(LATEST_RELEASE, (route) => route.abort());
});

/** Marks the document, so a test can see that nothing reloaded it. */
const markDocument = (page: Page) =>
  page.evaluate(() => void ((window as unknown as { __same: boolean }).__same = true));
const sameDocument = (page: Page) => page.evaluate(() => (window as unknown as { __same?: boolean }).__same === true);

const openList = async (page: Page, phone: boolean): Promise<void> => {
  if (phone) await page.locator("#bar-open").click();
};

test.describe("language", () => {
  const SPANISH_TITLE = "Historial de versiones";

  test("the toggle swaps the page and remembers, staying on the release", async ({ page }) => {
    await page.goto(`${PAGE}#v0.33.0`);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    const english = await page.locator("h2.title").textContent();
    await markDocument(page);

    await page.locator('.language button[data-language="es"]').click();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.locator("h2.title")).not.toHaveText(english ?? "");
    await expect(page.locator(".notes-title")).toHaveText("Notas de la versión");
    await expect(page).toHaveTitle(new RegExp(SPANISH_TITLE));
    await expect(page).toHaveURL(/lang=es.*#v0\.33\.0$/);
    expect(await sameDocument(page)).toBe(true);

    await page.goto(PAGE);
    await expect(page.locator(".language button[data-language='es']")).toHaveAttribute("aria-pressed", "true");
  });

  test("Spanish on in the game opens the page in Spanish, and ?lang= beats it", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("mc-settings", '{"cardLanguage":"es"}'));
    await page.goto(`${PAGE}#v0.33.0`);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await page.goto(`${PAGE}?lang=en#v0.33.0`);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("a report opens in Spanish inside the history", async ({ page }) => {
    await page.goto(`${PAGE}?lang=es#v0.40.0`);
    await expect(page.locator("#report")).toBeAttached();
    const lang = await page.locator("#report").evaluate((host) => host.shadowRoot?.querySelector(".wrap")?.textContent);
    expect(lang).toContain("Informe de la versión");
  });
});

test("every release is listed, and a click swaps it in with no reload", async ({ page }, info) => {
  const phone = info.project.name === "phone";
  const errors = trackPageErrors(page);
  await page.goto(PAGE);
  // The newest release has a report.
  await expect(page.locator("#report")).toBeAttached();
  await expect(page.locator(".rail .list a[data-version^='v']")).toHaveCount(10);
  await markDocument(page);

  // Older releases are one step further, as a list of their own.
  await openList(page, phone);
  await page.locator('.rail a[data-version="older"]').click();
  await expect(page.locator("h2.title")).toHaveText("Older releases");
  await expect(page.locator(".archive .list a")).toHaveCount(RELEASES.length - 10);
  await page.locator('.archive a[data-version="v0.33.0"]').click();
  await expect(page.locator("h2.title")).toHaveText("Five reporters. Six fixes.");
  await expect(page.locator(".tile.Fixed div")).toHaveText("7");
  await expect(page.locator('.shots img[alt*="part 1"]')).toBeAttached();
  await expect(page).toHaveURL(/#v0\.33\.0$/);
  await expect(page).toHaveTitle(/v0\.33\.0/);

  // Back returns to where we came from, still in the same document.
  await page.goBack();
  await expect(page.locator("h2.title")).toHaveText("Older releases");
  await page.goForward();
  await expect(page.locator("h2.title")).toHaveText("Five reporters. Six fixes.");

  // The pager walks on through the older releases.
  await page.locator(".pager a.older").click();
  await expect(page).toHaveURL(/#v0\.32\.1$/);
  expect(await sameDocument(page)).toBe(true);
  expect(errors).toEqual([]);
});

test("a link to one release opens it, and a release from the first day has a page", async ({ page }) => {
  await page.goto(`${PAGE}#v0.1.0`);
  await expect(page.locator("h2.title")).toHaveText("First playable");
  await expect(page.locator(".pager a.older")).toHaveCount(0);
  await expect(page.locator('.rail a[aria-current="page"]')).toHaveAttribute("data-version", "v0.1.0");
  await page.locator(".strip a", { hasText: "Older releases" }).click();
  await expect(page.locator("h2.title")).toHaveText("Older releases");
});

test("a hash that is no release still lands on one", async ({ page }) => {
  await page.goto(`${PAGE}#content`);
  await expect(page.locator("#report")).toBeAttached();
});

test("a slow release does not land over the one picked after it", async ({ page }) => {
  await page.goto(`${PAGE}#v0.33.0`);
  await expect(page.locator("h2.title")).toHaveText("Five reporters. Six fixes.");
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/history/v0.32.1.json", async (route) => {
    await held;
    await route.continue();
  });
  await page.evaluate(() => (location.hash = "#v0.32.0"));
  await page.evaluate(() => (location.hash = "#v0.32.1"));
  await page.evaluate(() => (location.hash = "#v0.1.0"));
  await expect(page.locator("h2.title")).toHaveText("First playable");
  release();
  await page.waitForTimeout(200);
  await expect(page.locator("h2.title")).toHaveText("First playable");
});

test("the list stops at GitHub's latest release, and a newer one opens by its link", async ({ page }) => {
  await page.route(LATEST_RELEASE, (route) => route.fulfill({ json: { tag_name: "v0.39.0" } }));
  await page.goto(PAGE);
  await expect(page.locator("#report h1")).toContainText("Lights down");
  await expect(page.locator('.rail a[data-version="v0.40.0"]')).toHaveCount(0);
  await expect(page.locator(".pager a.newer")).toHaveCount(0);
  await page.evaluate(() => (location.hash = "#v0.40.0"));
  await expect(page.locator("#report h1")).toContainText("Every game counts");
  await expect(page.locator('.rail a[data-version="v0.40.0"]')).toHaveCount(0);
});

test("a release GitHub knows that this build does not links to GitHub", async ({ page }) => {
  await page.route(LATEST_RELEASE, (route) => route.fulfill({ json: { tag_name: "v9.9.9" } }));
  await page.goto(`${PAGE}#v9.9.9`);
  const link = page.locator("main a");
  await expect(link).toHaveAttribute("href", /\/releases\/tag\/v9\.9\.9$/);
  await expect(page.locator("main")).toContainText("v9.9.9 isn't in this page yet");
  await expect(page.locator(".rail a[data-version='v0.40.0']")).toHaveCount(1);
  await expect(page.locator(".pager")).toHaveCount(0);
});

test("a version nobody knows opens the newest release", async ({ page }) => {
  await page.goto(`${PAGE}#v0.40.9`);
  await expect(page.locator("#report h1")).toContainText("Every game counts");
});

test("a hash change while GitHub answers lands once the list is here", async ({ page }) => {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(LATEST_RELEASE, async (route) => {
    await held;
    await route.abort();
  });
  await page.goto(PAGE);
  await page.evaluate(() => (location.hash = "#older"));
  release();
  await expect(page.locator("h2.title")).toHaveText("Older releases");
  await expect(page.locator('.rail a[data-version="older"]')).toBeAttached();
});

test("a report keeps its own look and its pictures load", async ({ page }) => {
  await page.goto(`${PAGE}#v0.40.0`);
  await expect(page.locator("#report h1")).toContainText("Every game counts");
  const report = await page.locator("#report").evaluate((host) => {
    const root = host.shadowRoot!;
    const heading = getComputedStyle(root.querySelector("h1")!);
    const image = root.querySelector("img")!;
    return {
      font: heading.fontFamily,
      image: image.src,
      background: getComputedStyle(host).backgroundColor,
      historyLinks: root.querySelectorAll("[data-history-link]").length,
    };
  });
  expect(report.font).toContain("Bangers");
  expect(report.image).toContain("/releases/v0.40.0/img/");
  expect(report.background).toBe("rgb(21, 17, 14)");
  expect(report.historyLinks, "the link back here is left out of the embedded report").toBe(0);
  // The release notes follow the announcement.
  await expect(page.locator(".notes .notes-title")).toHaveText("Release notes");
  await expect(page.locator(".notes details").first()).toContainText("Your stats");
  const noSideways = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(noSideways).toBe(true);
});

test("a report links back to the history", async ({ page }) => {
  await page.goto("/releases/v0.40.0/index.html");
  await page.locator("a[href*='index.html#v0.40.0']").first().click();
  await expect(page).toHaveURL(/releases\/index\.html#v0\.40\.0$/);
  await expect(page.locator('.list a[aria-current="page"]')).toHaveAttribute("data-version", "v0.40.0");
});

test("a phone swipes the list without opening a release", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the phone's sheet");
  await page.goto(`${PAGE}#v0.33.0`);
  await page.locator("#bar-open").click();
  const list = page.locator(".list");
  await expect(list).toBeVisible();
  const box = (await list.boundingBox())!;
  const x = box.x + box.width / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: box.y + box.height - 40, id: 1 }],
  });
  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(16);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: box.y + box.height - 40 - i * 30, id: 1 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/#v0\.33\.0$/);
  await expect(list).toBeVisible();
  await page.locator("#rail-close").click();
  await expect(list).toBeHidden();
});

const [A, Y, LB, RB, UP, DOWN, RIGHT, LEFT] = [0, 3, 4, 5, 12, 13, 15, 14];
/** The right face button, where a Nintendo pad prints A. */
const A_NINTENDO = 1;

async function installPad(page: Page, id: string): Promise<void> {
  await page.addInitScript((padId) => {
    const pad = {
      id: padId,
      index: 0,
      connected: true,
      mapping: "standard",
      timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    };
    (window as unknown as { __fakePad: unknown }).__fakePad = pad;
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad], configurable: true });
  }, id);
}

/** Holds a button for a few frames, so the page's poll sees one press. */
async function press(page: Page, index: number): Promise<void> {
  const set = (down: boolean) =>
    page.evaluate(
      ([i, on]) =>
        new Promise<void>((resolve) => {
          const pad = (window as unknown as { __fakePad: { buttons: { pressed: boolean }[] } }).__fakePad;
          pad.buttons[i as number]!.pressed = on as boolean;
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
      [index, down] as const,
    );
  await set(true);
  await set(false);
}

const focusedText = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement;
    return (active?.shadowRoot?.activeElement ?? active)?.textContent ?? "";
  });

test("a controller walks the releases, with its own glyphs", async ({ page }, info) => {
  const phone = info.project.name === "phone";
  await installPad(page, "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)");
  await page.goto(`${PAGE}#v0.33.0`);
  await expect(page.locator("h2.title")).toBeVisible();
  await expect(page.locator("#hints")).toBeHidden();

  await press(page, RB);
  await expect(page).toHaveURL(/#v0\.32\.1$/);
  await expect(page.locator("#hints")).toContainText("Newer / older");
  await expect(page.locator("#hints")).toContainText("R1");
  await press(page, LB);
  await expect(page).toHaveURL(/#v0\.33\.0$/);

  if (phone) {
    await press(page, Y);
    await expect(page.locator(".list")).toBeVisible();
    expect(await focusedText(page)).toContain("v0.33.0");
  } else await press(page, LEFT);

  await press(page, DOWN);
  expect(await focusedText(page)).toContain("v0.32.1");
  await press(page, A);
  await expect(page).toHaveURL(/#v0\.32\.1$/);
  await expect(page.locator("h2.title")).toHaveText("Wasp divides her attack");

  // Right reaches what is on the page: its links and folded sections.
  await press(page, RIGHT);
  expect(await page.evaluate(() => document.querySelector("main")!.contains(document.activeElement))).toBe(true);
});

test("a controller reaches a report's links, and a pager press keeps it on the page", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "the same stops as desktop, in one column");
  await installPad(page, "Xbox 360 Controller (XInput STANDARD GAMEPAD)");
  await page.goto(`${PAGE}#v0.40.0`);
  await expect(page.locator("#report h1")).toBeVisible();
  await press(page, RIGHT);
  expect(await focusedText(page)).toContain("Open on its own page");
  // The language toggle is one step above it.
  await press(page, UP);
  expect(await focusedText(page)).toContain("Español");
  await press(page, DOWN);
  await press(page, DOWN);
  const inReport = await page.evaluate(() => document.activeElement?.id === "report");
  expect(inReport, "the next stop is inside the report").toBe(true);
  // A press on the pager replaces the page; the next press stays in it.
  await page.locator(".pager a.older").focus();
  await press(page, A);
  await expect(page).toHaveURL(/#v0\.39\.0$/);
  await expect(page.locator("main")).toBeFocused();
  await press(page, DOWN);
  expect(await page.evaluate(() => document.querySelector("main")!.contains(document.activeElement))).toBe(true);
});

test("the phone bar's arrow goes nowhere at the oldest release", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the phone's bar");
  await page.goto(`${PAGE}#v0.1.1`);
  await expect(page.locator("h2.title")).toBeVisible();
  await page.locator("#bar-older").click();
  await expect(page).toHaveURL(/#v0\.1\.0$/);
  await page.locator("#bar-older").evaluate((el: HTMLElement) => el.click());
  await expect(page).toHaveURL(/#v0\.1\.0$/);
  await expect(page.locator("h2.title")).toHaveText("First playable");
});

test("a press on a Nintendo pad goes by its printed A", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "the list is a sheet there, walked in the test above");
  await installPad(page, "Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)");
  await page.goto(`${PAGE}#v0.33.0`);
  await expect(page.locator("h2.title")).toBeVisible();
  await page.locator('.list a[data-version="v0.32.1"]').focus();
  await press(page, A_NINTENDO);
  await expect(page).toHaveURL(/#v0\.32\.1$/);
});
