import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, settle, trackPageErrors, waitFor } from "./helpers.js";
import { PAD, installPad, padTap, padWake } from "./pad-e2e-helpers.js";
import { routeStops, waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Search on the Settings screen (#576): a magnifier in the title bar swaps the tab rail for a field, and what is typed
 * lists every setting and every page below Settings, best match first. A press goes to the spot it found; the search
 * is still there on the way back.
 */

async function openSettings(page: Page): Promise<void> {
  await openApp(page, "");
  await waitForScene(page, "Title", 30000);
  await settle(page);
  await clickText(page, "SETTINGS", { sceneKey: "Title" });
  await waitForScene(page, "SettingsOverlay");
  await settle(page);
}

async function stopRect(page: Page, key: string) {
  return waitFor(
    async () => (await routeStops(page, "SettingsOverlay"))?.stops.find((s) => s.key === key)?.rect ?? null,
    `the ${key} stop`,
    8000,
  );
}

async function pressStop(page: Page, key: string, phone: boolean): Promise<void> {
  const rect = await stopRect(page, key);
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (phone) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** The result stops, in order. */
async function results(page: Page): Promise<readonly string[]> {
  const stops = (await routeStops(page, "SettingsOverlay"))?.stops ?? [];
  return stops.filter((s) => s.key.startsWith("result:")).map((s) => s.key);
}

async function search(page: Page, phone: boolean, query: string): Promise<void> {
  await pressStop(page, "search-toggle", phone);
  await page.locator("input").first().pressSequentially(query, { delay: 20 });
  await waitFor(async () => ((await results(page)).length > 0 ? true : null), `results for ${query}`, 8000);
}

test("issue #576: search lists settings and nested pages, best first, and a press goes there", async ({
  page,
}, info) => {
  const phone = info.project.name === "phone";
  const errors = trackPageErrors(page);
  await openSettings(page);

  // A setting: back to its tab with the ring on it.
  await search(page, phone, "dark mode");
  expect((await results(page))[0]).toBe("result:setting:dark-mode");
  await pressStop(page, "result:setting:dark-mode", phone);
  await waitFor(
    async () =>
      (await routeStops(page, "SettingsOverlay"))?.stops.some((s) => s.key === "row:dark-mode") ? true : null,
    "the Dark mode row on its tab",
    8000,
  );
  expect((await routeStops(page, "SettingsOverlay"))?.stops.some((s) => s.key === "search-field")).toBe(false);

  // A typo finds How it works, in Unlocks; backing out comes back to the search.
  await search(page, phone, "earning champoin");
  expect((await results(page))[0]).toBe("result:unlocks-guide:3");
  await pressStop(page, "result:unlocks-guide:3", phone);
  await waitForScene(page, "UnlocksOverlay");
  await settle(page);
  await page.keyboard.press("Escape");
  await waitFor(
    async () => ((await activeScenes(page)).includes("UnlocksOverlay") ? null : true),
    "Unlocks closed",
    8000,
  );
  expect((await results(page))[0]).toBe("result:unlocks-guide:3");

  // Escape shuts the search before it shuts Settings, and the tabs come back.
  await page.keyboard.press("Escape");
  await stopRect(page, "tab:gameplay");
  expect(await activeScenes(page)).toContain("SettingsOverlay");
  expect(errors).toEqual([]);
});

test("issue #576: a swipe of the results that lifts on a row opens nothing", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "A finger's swipe.");
  await openSettings(page);
  await search(page, true, "card");
  const rect = await stopRect(page, (await results(page))[1]!);
  const x = rect.x + rect.width / 2;
  const from = rect.y + 200;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: from, id: 1 }] });
  for (let i = 1; i <= 10; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: from - i * 14, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await settle(page);
  expect((await results(page)).length).toBeGreaterThan(0);
  const scenes = await activeScenes(page);
  for (const page_ of ["UnlocksOverlay", "RulesOverlay", "SaveDataOverlay", "ControlsOverlay"])
    expect(scenes).not.toContain(page_);
});

test("issue #576: Y opens the search on a controller, B takes the caret out, and B again shuts it", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "A controller, on the desktop project.");
  await installPad(page);
  await openSettings(page);
  await padWake(page);
  await padTap(page, PAD.y);
  await stopRect(page, "search-field");
  const focused = () => page.evaluate(() => document.activeElement?.tagName === "INPUT");
  await waitFor(async () => ((await focused()) ? true : null), "the caret in the field", 8000);
  await padTap(page, PAD.b);
  await waitFor(async () => ((await focused()) ? null : true), "the caret out of the field", 8000);
  await padTap(page, PAD.b);
  await stopRect(page, "tab:gameplay");
  expect(await activeScenes(page)).toContain("SettingsOverlay");
});
