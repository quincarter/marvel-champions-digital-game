import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, settle, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, hasStop, installWave6Helpers, routeStops, waitForScene } from "./wave6-helpers-a.js";
import { hook, openApp } from "./wave6-helpers-b.js";
import { PAD, installPad, padTap, padWake } from "./pad-e2e-helpers.js";

/**
 * A New game picks nothing for the player (owner, 2026-10-26): Scenario select opens with focus on the topmost villain
 * and no scenario selected, Take your seats with focus on the topmost hero and every seat blank, and the forward button
 * waits for a pick. A pick leaves the cursor where it is. Saved by `E2E_SHOTS=<dir>` as the owner's review shots.
 */

test.use({ viewport: { width: 1920, height: 1080 } });

const focusOf = (page: Page, scene: string): Promise<string | null> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null }> }).__mcFocusState[key]!()
        .focus,
    scene,
  );

/** A direction and back: the mouse hides the ring until a pad press, and a shot should show where focus is. */
async function showRing(page: Page, scene: string): Promise<void> {
  const before = await focusOf(page, scene);
  await padTap(page, PAD.right);
  // The first press only brings a hidden ring back; a press that also moved focus is undone.
  if ((await focusOf(page, scene)) !== before) await padTap(page, PAD.left);
}

async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.E2E_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

const buttonEnabled = (page: Page, scene: string, key: string): Promise<boolean> =>
  page.evaluate(
    ([sceneKey, stopKey]) => {
      const win = window as unknown as {
        __mcFocusRoutes?: Record<string, () => { key: string }[]>;
      };
      return (win.__mcFocusRoutes?.[sceneKey!]?.() ?? []).some((s) => s.key === stopKey);
    },
    [scene, key] as const,
  );

test("Scenario select and Take your seats start empty, focused on the topmost tile, and a pick keeps the cursor", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await installPad(page);
  await installWave6Helpers(page);
  await openApp(page, "unlock=all", { landing: "Title" });
  await waitForScene(page, "Title", 30000);
  await settle(page);
  // The ring on arrival is for a pad (or key) player: wake the pad before the New game press.
  await padWake(page);
  await clickText(page, "NEW GAME", { sceneKey: "Title" });
  await waitForScene(page, "ScenarioSelect");
  await waitFor(async () => (await hasStop(page, "scenario:rhino", "ScenarioSelect")) || null, "scenario list", 15000);
  await settle(page);

  // Villain screen on arrival: Rhino has focus, nothing is selected, Choose heroes waits.
  expect(await focusOf(page, "ScenarioSelect")).toBe("scenario:rhino");
  expect(await hook(page, "__mcScenarioSelectDebug", "selectedId")).toBeNull();
  await showRing(page, "ScenarioSelect");
  expect(await focusOf(page, "ScenarioSelect")).toBe("scenario:rhino");
  await shot(page, "villain-arrival");
  await padTap(page, PAD.start);
  expect(await activeScenes(page), "Start does nothing with no pick").toContain("ScenarioSelect");

  // One pick (the second tile): focus stays on it, it is selected, and Choose heroes works.
  await padTap(page, PAD.right);
  const second = await focusOf(page, "ScenarioSelect");
  expect(second).not.toBe("scenario:rhino");
  await padTap(page, PAD.a);
  await settle(page);
  expect(await focusOf(page, "ScenarioSelect")).toBe(second);
  expect(await hook(page, "__mcScenarioSelectDebug", "selectedId")).toBe(second!.replace("scenario:", ""));
  await shot(page, "villain-after-pick");
  await clickStop(page, "next", "ScenarioSelect");

  // Hero screen on arrival: the topmost hero has focus, every seat is blank, Play waits.
  await waitForScene(page, "Seats");
  await waitFor(async () => (await hasStop(page, "seat:0", "Seats")) || null, "the seats", 10000);
  await settle(page);
  const first = await focusOf(page, "Seats");
  expect(first).toMatch(/^hero(-rec)?:/);
  expect(await buttonEnabled(page, "Seats", "play")).toBe(false);
  await showRing(page, "Seats");
  expect(await focusOf(page, "Seats")).toBe(first);
  await shot(page, "hero-arrival");

  // One pick (two tiles right): the cursor stays on that tile, the seat is filled and Play opens.
  await padTap(page, PAD.right);
  await padTap(page, PAD.right);
  const picked = await focusOf(page, "Seats");
  expect(picked).not.toBe(first);
  await padTap(page, PAD.a);
  await settle(page);
  // A hero with several decks asks which one first ("Pick a deck"): the first row seats.
  if ((await activeScenes(page)).includes("HeroDecksSheet")) {
    await padTap(page, PAD.down);
    await padTap(page, PAD.a);
    await settle(page);
  }
  expect(await focusOf(page, "Seats")).toBe(picked);
  expect(await buttonEnabled(page, "Seats", "play")).toBe(true);
  await shot(page, "hero-after-pick");
  expect(errors).toEqual([]);
});

test("Spider-Man (Pick a deck) as the first pick: focus returns to his tile after the sheet closes and the seats redraw", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await installPad(page);
  await installWave6Helpers(page);
  await openApp(page, "unlock=all", { landing: "Title" });
  await waitForScene(page, "Title", 30000);
  await settle(page);
  await padWake(page);
  await clickText(page, "NEW GAME", { sceneKey: "Title" });
  await waitForScene(page, "ScenarioSelect");
  await waitFor(async () => (await hasStop(page, "scenario:rhino", "ScenarioSelect")) || null, "scenario list", 15000);
  await clickStop(page, "scenario:rhino", "ScenarioSelect");
  await settle(page);
  await clickStop(page, "next", "ScenarioSelect");
  await waitForScene(page, "Seats");
  await waitFor(async () => (await hasStop(page, "seat:0", "Seats")) || null, "the seats", 15000);
  await settle(page);
  const first = await focusOf(page, "Seats");
  expect(first).toMatch(/^hero(-rec)?:/);
  await showRing(page, "Seats");
  await padTap(page, PAD.a);
  await settle(page);
  expect(await activeScenes(page)).toContain("HeroDecksSheet");
  await padTap(page, PAD.down);
  await padTap(page, PAD.a);
  await settle(page);
  expect(await activeScenes(page)).not.toContain("HeroDecksSheet");
  expect(await buttonEnabled(page, "Seats", "play"), "the seat is filled").toBe(true);
  expect(await focusOf(page, "Seats"), "focus stays on the picked hero's tile").toBe(first);
  expect(errors).toEqual([]);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("the placeholder reads on a phone", async ({ page }) => {
    test.setTimeout(60_000);
    await openApp(page, "screen=scenario-select&blank=1&unlock=all", { landing: "ScenarioSelect" });
    await settle(page);
    await shot(page, "villain-arrival-phone");
  });
});

test("Back from Seats returns focus to the picked villain, not the top tile", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await installPad(page);
  await installWave6Helpers(page);
  await openApp(page, "unlock=all", { landing: "Title" });
  await waitForScene(page, "Title", 30000);
  await settle(page);
  await padWake(page);
  await clickText(page, "NEW GAME", { sceneKey: "Title" });
  await waitForScene(page, "ScenarioSelect");
  await waitFor(async () => (await hasStop(page, "scenario:rhino", "ScenarioSelect")) || null, "scenario list", 15000);
  await settle(page);
  await showRing(page, "ScenarioSelect");
  await padTap(page, PAD.right);
  const picked = await focusOf(page, "ScenarioSelect");
  expect(picked).not.toBe("scenario:rhino");
  await padTap(page, PAD.a);
  await settle(page);
  await clickStop(page, "next", "ScenarioSelect");
  await waitForScene(page, "Seats");
  await waitFor(async () => (await hasStop(page, "seat:0", "Seats")) || null, "the seats", 15000);
  await clickStop(page, "back", "Seats");
  await waitForScene(page, "ScenarioSelect");
  await waitFor(async () => (await hasStop(page, picked!, "ScenarioSelect")) || null, "scenario list", 15000);
  await settle(page);
  expect(await focusOf(page, "ScenarioSelect")).toBe(picked);
  expect(errors).toEqual([]);
});

test.describe("phone, second visit", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("a stages panel left open on a past visit does not cover a blank New game", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = trackPageErrors(page);
    await installWave6Helpers(page);
    await openApp(page, "unlock=all", { landing: "Title" });
    await waitForScene(page, "Title", 30000);
    await settle(page);
    const visit = async (): Promise<void> => {
      await clickText(page, "NEW GAME", { sceneKey: "Title" });
      await waitForScene(page, "ScenarioSelect");
      await waitFor(
        async () => (await hasStop(page, "scenario:rhino", "ScenarioSelect")) || null,
        "scenario list",
        15000,
      );
      await settle(page);
    };
    await visit();
    const rect = async () =>
      (await routeStops(page, "ScenarioSelect"))!.stops.find((s) => s.key === "scenario:rhino")!.rect;
    const before = await rect();
    await clickStop(page, "scenario:rhino", "ScenarioSelect");
    await settle(page);
    await clickStop(page, "stages-toggle", "ScenarioSelect");
    await settle(page);
    await clickStop(page, "back", "ScenarioSelect");
    await waitForScene(page, "Title");
    await settle(page);
    await visit();
    expect(await hasStop(page, "stages-toggle", "ScenarioSelect"), "no stages toggle with nothing picked").toBe(false);
    expect(await rect(), "the roster has its full room").toEqual(before);
    await shot(page, "villain-second-visit-phone");
    expect(errors).toEqual([]);
  });
});
