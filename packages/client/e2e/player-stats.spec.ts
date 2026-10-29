import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, findText, settle, waitFor } from "./helpers.js";
import { openApp, type Rect } from "./wave6-helpers-b.js";

/**
 * Your stats, reached from the Trophy Room: the record, and sections that fold and open with a tap. On a phone a swipe
 * of the list that lifts over Expand all (just above it) opens nothing.
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
          summary: {
            lossReason: won ? null : "schemeCompleted",
            heroesDefeated: 0,
            winners: [],
            alliesPlayed: 0,
            seats: [
              {
                identityCardId: "01001a",
                aspects: ["justice"],
                deck: ["01002", "01005"],
                plays: { "01002": 2 },
                activations: { "01002": 1 },
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

test("Your stats opens from the Trophy Room, shows the record, and its sections open with a tap", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  await openApp(page, "unlock=all");
  await seedGames(page);
  await page.goto("/?screen=trophies&unlock=all");
  await waitFor(
    async () => ((await activeScenes(page)).includes("TrophyRoom") ? true : null),
    "the Trophy Room",
    30_000,
  );
  await settle(page);
  await clickText(page, phone ? "Stats" : "Your stats", {
    sceneKey: "TrophyRoom",
    until: async () => ((await activeScenes(page)).includes("PlayerStats") ? true : null),
    untilLabel: "the Stats screen",
  });
  await waitFor(async () => ((await keys(page)).includes("row:ov:played") ? true : null), "the Overview rows", 30_000);
  expect((await findText(page, "4–2", "PlayerStats")).length, "the record").toBeGreaterThan(0);
  expect(await keys(page), "Heroes starts folded").not.toContain("row:hero:favorite");

  // Fold the Overview first, so the Heroes heading is on screen on a phone too.
  const overview = (await stopsOf(page)).find((s) => s.key === "sec:overview")!;
  await press(page, phone, overview.rect);
  await waitFor(async () => ((await keys(page)).includes("row:ov:played") ? null : true), "Overview folds", 10_000);
  await settle(page);
  const heroes = (await stopsOf(page)).find((s) => s.key === "sec:heroes")!;
  await press(page, phone, heroes.rect);
  await waitFor(async () => ((await keys(page)).includes("row:hero:favorite") ? true : null), "Heroes opens", 10_000);

  // RB (] on the keyboard) jumps to the next heading.
  if (!phone) {
    await page.keyboard.press("]");
    await page.keyboard.press("]");
    const focused = await page.evaluate(
      () =>
        (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null }> }).__mcFocusState
          .PlayerStats!().focus,
    );
    expect(focused).toMatch(/^sec:/);
  }
});

test("a swipe of the stats list that lifts over Expand all opens nothing", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a touch swipe");
  test.setTimeout(120_000);
  await openApp(page, "unlock=all");
  await seedGames(page);
  await page.goto("/?screen=stats&unlock=all");
  await waitFor(async () => ((await keys(page)).includes("row:ov:played") ? true : null), "the Overview rows", 30_000);
  await settle(page);
  const before = await keys(page);
  const expand = (await stopsOf(page)).find((s) => s.key === "expand-all")!;
  const first = (await stopsOf(page)).find((s) => s.key === "row:ov:played")!;
  await swipe(
    page,
    { x: expand.rect.x + expand.rect.width / 2, y: first.rect.y + 200 },
    { x: expand.rect.x + expand.rect.width / 2, y: expand.rect.y + expand.rect.height / 2 },
  );
  await settle(page);
  expect(await keys(page), "no section opened").toEqual(before);
  // A tap on it still opens every section.
  await page.touchscreen.tap(expand.rect.x + expand.rect.width / 2, expand.rect.y + expand.rect.height / 2);
  await waitFor(async () => ((await keys(page)).includes("row:hero:favorite") ? true : null), "Expand all", 10_000);
});
