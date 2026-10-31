import { expect, test, type Page } from "@playwright/test";
import { findText, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { routeStops } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * A game the Install for Steam script installed (`platform/steam-install.ts`): the Title says so, and a newer release is
 * offered through the script, with its progress on screen, instead of a download. The page is made to look like the
 * desktop app with a stubbed shell, whose update steps are set by each test, and GitHub's answer is stubbed.
 */

const REPO = "https://github.com/quincarter/marvel-champions-digital-game";
/** For the PR's screenshots: a folder, and a `WIDTHxHEIGHT` to take them at. */
const SHOTS = process.env.STEAM_UPDATE_SHOTS;
const SHOT_SIZE = process.env.STEAM_UPDATE_SIZE?.split("x").map(Number);

test.use({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36" });

interface Shell {
  install: { canUpdate: boolean } | null;
  status: { running: boolean; exitCode: number | null; log: string };
  calls: string[];
}

async function openAsSteamInstall(page: Page, install: Shell["install"], query = ""): Promise<void> {
  if (SHOT_SIZE) await page.setViewportSize({ width: SHOT_SIZE[0]!, height: SHOT_SIZE[1]! });
  await page.addInitScript((record) => {
    const shell: Shell = { install: record, status: { running: false, exitCode: null, log: "" }, calls: [] };
    const page = window as unknown as Record<string, unknown>;
    page.__steamShell = shell;
    page.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    page.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
      transformCallback: () => 0,
      invoke: async (command: string, args?: Record<string, unknown>) => {
        if (command.startsWith("steam_")) shell.calls.push(`${command} ${JSON.stringify(args ?? {})}`);
        if (command === "installer_kind") return "nsis";
        if (command === "steam_install_info") return shell.install;
        if (command === "steam_update_status") return shell.status;
        return null;
      },
    };
  }, install);
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({
      json: {
        tag_name: "v999.0.0",
        html_url: `${REPO}/releases/tag/v999.0.0`,
        draft: false,
        prerelease: false,
        assets: [
          {
            name: "MarvelChampions-999.0.0-EN-Windows-x64-Setup.exe",
            browser_download_url: `${REPO}/releases/download/v999.0.0/MarvelChampions-999.0.0-EN-Windows-x64-Setup.exe`,
          },
        ],
      },
    }),
  );
  await openApp(page, query);
}

const setStatus = (page: Page, status: Shell["status"]): Promise<void> =>
  page.evaluate((next) => {
    (window as unknown as { __steamShell: Shell }).__steamShell.status = next;
  }, status);

const shellCalls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __steamShell: Shell }).__steamShell.calls);

const stopKeys = async (page: Page, scene: string): Promise<string[]> =>
  ((await routeStops(page, scene))?.stops ?? []).map((stop) => stop.key);

const waitForStop = (page: Page, key: string): Promise<boolean> =>
  waitFor(async () => (await stopKeys(page, "Title")).includes(key), `the ${key} stop on Title`);

async function pressStop(page: Page, scene: string, key: string): Promise<void> {
  const stop = await waitFor(
    async () => (await routeStops(page, scene))?.stops.find((s) => s.key === key) ?? null,
    `the ${key} stop on ${scene}`,
  );
  await page.mouse.click(stop.rect.x + stop.rect.width / 2, stop.rect.y + stop.rect.height / 2);
}

/** The panel's phase, or null when it isn't up. */
const panelPhase = (page: Page): Promise<string | null> =>
  page.evaluate(() => {
    const game = (window as unknown as { __mcGame: { scene: { getScene(key: string): unknown } } }).__mcGame;
    const panel = game.scene.getScene("SteamUpdateOverlay") as {
      sys: { isActive(): boolean };
      debugState(): { phase: string };
    } | null;
    return panel?.sys.isActive() ? panel.debugState().phase : null;
  });

async function waitForPhase(page: Page, phase: string | null): Promise<void> {
  await waitFor(async () => (await panelPhase(page)) === phase, `the panel at ${phase}`);
}

async function shoot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()!.width}.png` });
}

test("a script install says so, and updates through the script from download to quit", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openAsSteamInstall(page, { canUpdate: true });
  await waitForText(page, "Update available", { sceneKey: "Title" });
  expect(await findText(page, "Steam script", "Title")).toHaveLength(1);
  const titleStops = await waitFor(async () => {
    const keys = await stopKeys(page, "Title");
    return keys.includes("update-steam") ? keys : null;
  }, "the banner's Update button");
  expect(titleStops).not.toContain("update-download");
  await shoot(page, "title");

  await pressStop(page, "Title", "update-steam");
  await waitForPhase(page, "ask");
  expect(await stopKeys(page, "SteamUpdateOverlay")).toEqual(["start", "close"]);
  await shoot(page, "ask");

  await setStatus(page, { running: true, exitCode: null, log: "Downloading version 999.0.0...\n\r####  42.0%" });
  await pressStop(page, "SteamUpdateOverlay", "start");
  await waitForPhase(page, "working");
  await waitForText(page, "Downloading version 999.0.0", { sceneKey: "SteamUpdateOverlay" });
  expect(await shellCalls(page)).toContain('steam_update_start {"language":"en"}');
  await shoot(page, "working");

  await setStatus(page, { running: true, exitCode: null, log: "MC_UPDATE ready 999.0.0\n" });
  await waitForPhase(page, "ready");
  expect(await stopKeys(page, "SteamUpdateOverlay")).toEqual(["quit", "close"]);
  await shoot(page, "ready");
  await pressStop(page, "SteamUpdateOverlay", "quit");
  await waitFor(
    async () => (await shellCalls(page)).some((call) => call.startsWith("steam_update_quit")),
    "the game asked to quit",
  );
  expect(errors).toEqual([]);
});

test("closing the panel leaves the update running, and opening it again picks it up", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openAsSteamInstall(page, { canUpdate: true });
  await pressStop(page, "Title", "update-steam");
  await waitForPhase(page, "ask");
  await setStatus(page, { running: true, exitCode: null, log: "" });
  await pressStop(page, "SteamUpdateOverlay", "start");
  await waitForPhase(page, "working");
  await pressStop(page, "SteamUpdateOverlay", "close");
  await waitForPhase(page, null);

  await pressStop(page, "Title", "update-steam");
  await waitForPhase(page, "working");
  expect((await shellCalls(page)).filter((call) => call.startsWith("steam_update_start"))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("a failed update says why and offers the download", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openAsSteamInstall(page, { canUpdate: true });
  await pressStop(page, "Title", "update-steam");
  await waitForPhase(page, "ask");
  await setStatus(page, { running: false, exitCode: 1, log: "Error: the download failed.\n" });
  await pressStop(page, "SteamUpdateOverlay", "start");
  await waitForPhase(page, "failed");
  await waitForText(page, "The download failed.", { sceneKey: "SteamUpdateOverlay" });
  expect(await stopKeys(page, "SteamUpdateOverlay")).toEqual(["download", "close"]);
  await shoot(page, "failed");
  expect(errors).toEqual([]);
});

test("the panel works from the keyboard and a controller's route, and shows the cancel glyph", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openAsSteamInstall(page, { canUpdate: true });
  await pressStop(page, "Title", "update-steam");
  await waitForPhase(page, "ask");
  await page.waitForTimeout(400);
  await setStatus(page, { running: true, exitCode: null, log: "" });
  await page.keyboard.press("Enter");
  await waitForPhase(page, "working");
  // A new step takes no pad or key press for a moment, so a stray one can't land on its buttons.
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  await waitForPhase(page, null);
  expect(errors).toEqual([]);
});

test("a game with no record keeps the plain download", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openAsSteamInstall(page, null);
  await waitForText(page, "Update available", { sceneKey: "Title" });
  await waitForStop(page, "update-download");
  expect(await findText(page, "Steam script", "Title")).toEqual([]);
  expect(errors).toEqual([]);
});

test("a record with no saved script says how it was installed, but can only offer the download", async ({ page }) => {
  await openAsSteamInstall(page, { canUpdate: false });
  await waitForText(page, "Update available", { sceneKey: "Title" });
  await waitForText(page, "Steam script", { sceneKey: "Title" });
  await waitForStop(page, "update-download");
});

test("Settings ▸ More opens the same panel, which asks the script what's latest", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openAsSteamInstall(page, { canUpdate: true });
  await waitForText(page, "Update available", { sceneKey: "Title" });
  await pressStop(page, "Title", "settings");
  await pressStop(page, "SettingsOverlay", "tab:more");
  // The row's Open button, at its right end: the stop covers the whole row.
  const row = await waitFor(
    async () => (await routeStops(page, "SettingsOverlay"))?.stops.find((s) => s.key === "row:steam-install") ?? null,
    "the Steam install row",
  );
  await page.mouse.click(row.rect.x + row.rect.width - 30, row.rect.y + row.rect.height / 2);
  await waitForPhase(page, "ask");
  await waitForText(page, "the latest version", { sceneKey: "SteamUpdateOverlay" });
  await shoot(page, "settings-ask");
  await setStatus(page, { running: false, exitCode: 0, log: "MC_UPDATE current 0.40.0\n" });
  await pressStop(page, "SteamUpdateOverlay", "start");
  await waitForPhase(page, "current");
  expect(await stopKeys(page, "SteamUpdateOverlay")).toEqual(["close"]);
  expect(errors).toEqual([]);
});
