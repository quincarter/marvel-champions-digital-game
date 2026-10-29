import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, findText, settle, waitFor } from "./helpers.js";
import { openApp, type Rect } from "./wave6-helpers-b.js";

/**
 * Your stats: a tabbed dashboard reached from the Title, Decks & Collection and the Trophy Room (as a screen) and from
 * Settings and Pause (as an overlay). Tabs switch with a tap or LB / RB; on a phone a swipe of the dashboard that lifts
 * over a tab switches nothing.
 */

interface Stop {
  readonly key: string;
  readonly rect: Rect;
}

const stopsOf = (page: Page): Promise<Stop[]> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcFocusRoutes?: Record<string, () => Stop[]> }).__mcFocusRoutes?.PlayerStats?.() ?? [],
  );

const keys = async (page: Page): Promise<string[]> => (await stopsOf(page)).map((s) => s.key);

const isActive = (page: Page, scene: string) => async () => ((await activeScenes(page)).includes(scene) ? true : null);

/** Six finished games: four Spider-Man wins over Rhino, two losses, every one with the summary the stats read. */
async function seedGames(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { IdbGameStorage } = (await import("/src/engine/idb-game-storage.ts")) as never as {
      IdbGameStorage: new () => { create(meta: unknown, state: unknown): Promise<void> };
    };
    const { SAVE_SCHEMA } = (await import("/src/engine/game-storage.ts")) as never as { SAVE_SCHEMA: number };
    const store = new IdbGameStorage();
    for (let i = 0; i < 6; i++) {
      const won = i < 4;
      await store.create(
        {
          id: `e2e-stats-${i}`,
          schema: SAVE_SCHEMA,
          config: {
            scenarioId: "rhino",
            difficulty: "standard",
            players: [{ starterDeckId: "core-spider-man-justice" }],
            seed: i,
          },
          createdAt: i,
          updatedAt: 100 + i,
          status: won ? "won" : "lost",
          round: 5 + i,
          commandCount: 50,
          outcome: won
            ? { result: "win", reason: "villainDefeated" }
            : { result: "loss", reason: "mainSchemeCompleted" },
          campaignId: null,
          campaignNodeId: null,
          lastPlayedOn: { platform: "windows" },
          summary: {
            lossReason: won ? null : "schemeCompleted",
            heroesDefeated: 0,
            winners: [],
            alliesPlayed: 0,
            seats: [
              {
                identityCardId: "01001a",
                aspects: ["justice"],
                deck: ["01002", "01008"],
                plays: { "01008": 2 },
                activations: { "01008": 1 },
                entered: {},
                damage: 8,
                thwart: 4,
                defeated: false,
              },
            ],
            villains: ["Rhino"],
            sideSchemes: { seen: {}, defeated: {} },
          },
        },
        {},
      );
    }
  });
}

async function press(page: Page, phone: boolean, rect: Rect): Promise<void> {
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (phone) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** A finger drag from `from` to `to`, lifted at `to` (a real touch sequence over CDP). */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const steps = 10;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    const at = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at, id: 1 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** Seeds the games, then lands on `screen`. */
async function seeded(page: Page, screen: string, landing: string): Promise<void> {
  await openApp(page, "unlock=all");
  await seedGames(page);
  await page.goto(`/?screen=${screen}&unlock=all`);
  await waitFor(isActive(page, landing), landing, 30_000);
  await settle(page);
}

const overviewUp = (page: Page) => async () => ((await keys(page)).includes("tile:record") ? true : null);

test("from the Trophy Room: the record, then a tab with a tap and the next with RB", async ({ page }, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  await seeded(page, "trophies", "TrophyRoom");
  await clickText(page, phone ? "Stats" : "Your stats", {
    sceneKey: "TrophyRoom",
    until: isActive(page, "PlayerStats"),
    untilLabel: "the Stats screen",
  });
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  expect((await findText(page, "4–2", "PlayerStats")).length, "the record").toBeGreaterThan(0);

  // Once the screen has settled (art arriving redraws it, and a tap that straddles a redraw is dropped by design).
  await settle(page);
  const heroes = (await stopsOf(page)).find((s) => s.key === "tab:heroes")!;
  await press(page, phone, heroes.rect);
  await waitFor(async () => ((await keys(page)).includes("row:hero:favorite") ? true : null), "Heroes opens", 10_000);

  if (!phone) {
    // RB (] on the keyboard): Villains, the tab after Heroes.
    await page.keyboard.press("]");
    await waitFor(async () => ((await keys(page)).includes("row:villain:favorite") ? true : null), "RB", 10_000);
    // Cards by hero shows the hero's card pictures.
    const cards = (await stopsOf(page)).find((s) => s.key === "tab:cards")!;
    await press(page, phone, cards.rect);
    await waitFor(
      async () => ((await keys(page)).some((k) => k.startsWith("card:")) ? true : null),
      "card pictures",
      10_000,
    );
  }
});

test("from the Title, Back returns to the Title", async ({ page }) => {
  test.setTimeout(120_000);
  await seeded(page, "title", "Title");
  await clickText(page, "Your stats", {
    sceneKey: "Title",
    until: isActive(page, "PlayerStats"),
    untilLabel: "the Stats screen",
  });
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  await page.keyboard.press("Escape");
  await waitFor(isActive(page, "Title"), "back on the Title", 15_000);
});

test("over Settings: Your stats opens as an overlay, and Back closes it with Settings still open", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "the same overlay on every size");
  test.setTimeout(120_000);
  await seeded(page, "settings", "SettingsOverlay");
  const settingsStops = (): Promise<Stop[]> =>
    page.evaluate(() =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => Stop[]> }).__mcFocusRoutes.SettingsOverlay!(),
    );
  const more = (await settingsStops()).find((s) => s.key === "tab:more")!;
  await press(page, false, more.rect);
  const stats = await waitFor(
    async () => (await settingsStops()).find((s) => s.key === "row:stats") ?? null,
    "the Your stats row",
    10_000,
  );
  // Its Open button, at the row's right end.
  await page.mouse.click(stats.rect.x + stats.rect.width - 40, stats.rect.y + stats.rect.height / 2);
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  expect(await activeScenes(page)).toContain("SettingsOverlay");
  await page.keyboard.press("Escape");
  await waitFor(async () => ((await activeScenes(page)).includes("PlayerStats") ? null : true), "closed", 10_000);
  expect(await activeScenes(page)).toContain("SettingsOverlay");
});

test("a swipe of the dashboard that lifts over a tab switches nothing", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a touch swipe");
  test.setTimeout(120_000);
  await seeded(page, "stats", "PlayerStats");
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  const before = await keys(page);
  const tab = (await stopsOf(page)).find((s) => s.key === "tab:villains")!;
  const record = (await stopsOf(page)).find((s) => s.key === "tile:record")!;
  await swipe(
    page,
    { x: tab.rect.x + tab.rect.width / 2, y: record.rect.y + 240 },
    { x: tab.rect.x + tab.rect.width / 2, y: tab.rect.y + tab.rect.height / 2 },
  );
  await settle(page);
  expect(await keys(page), "still on the Overview").toEqual(before);
  // A tap on it still switches.
  await page.touchscreen.tap(tab.rect.x + tab.rect.width / 2, tab.rect.y + tab.rect.height / 2);
  await waitFor(async () => ((await keys(page)).includes("row:villain:favorite") ? true : null), "Villains", 10_000);
});

test("over Pause: a press on empty stats space reaches nothing underneath, and Back returns to Pause", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "the wide Pause menu");
  test.setTimeout(120_000);
  await seeded(page, "pause", "PauseOverlay");
  const pauseStops = (): Promise<Stop[]> =>
    page.evaluate(() =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => Stop[]> }).__mcFocusRoutes.PauseOverlay!(),
    );
  const stats = await waitFor(
    async () => (await pauseStops()).find((s) => s.key === "stats") ?? null,
    "Your stats on the Pause menu",
    15_000,
  );
  await press(page, false, stats.rect);
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  // Count every press the scenes under the stats hear from here on.
  await page.evaluate(() => {
    const game = (
      window as unknown as {
        __mcGame: { scene: { getScene(key: string): { input: { on(event: string, fn: () => void): void } } } };
      }
    ).__mcGame;
    const heard = { n: 0 };
    (window as unknown as { __heard: typeof heard }).__heard = heard;
    for (const key of ["Board", "PauseOverlay"]) game.scene.getScene(key).input.on("pointerdown", () => heard.n++);
  });
  const tabs = (await stopsOf(page)).filter((s) => s.key.startsWith("tab:"));
  const last = tabs.at(-1)!;
  // The top bar's title, the space right of the tabs, and the bottom of the screen: none of them is a control.
  for (const [x, y] of [
    [400, 30],
    [last.rect.x + last.rect.width + 60, last.rect.y + last.rect.height / 2],
    [640, 880],
  ] as const) {
    await page.mouse.click(x, y);
  }
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as { __heard: { n: number } }).__heard.n)).toBe(0);
  expect(await activeScenes(page)).toContain("PlayerStats");

  // Card hover works over Pause too: rest the mouse on a card picture on Cards by hero.
  const cardsTab = (await stopsOf(page)).find((s) => s.key === "tab:cards")!;
  await press(page, false, cardsTab.rect);
  const card = await waitFor(
    async () => (await stopsOf(page)).find((s) => s.key.startsWith("card:")) ?? null,
    "a card picture",
    10_000,
  );
  await page.mouse.move(card.rect.x + card.rect.width / 2, card.rect.y + card.rect.height / 2);
  await page.mouse.move(card.rect.x + card.rect.width / 2 + 2, card.rect.y + card.rect.height / 2 + 2);
  await waitFor(
    () =>
      page.evaluate(
        () =>
          (window as unknown as { __mcStatsDebug?: { hoverShown(): string | null } }).__mcStatsDebug?.hoverShown() ??
          null,
      ),
    "the card hover popover",
    10_000,
  );
  await page.keyboard.press("Escape");
  await waitFor(async () => ((await activeScenes(page)).includes("PlayerStats") ? null : true), "closed", 10_000);
  expect(await activeScenes(page)).toContain("PauseOverlay");
});
