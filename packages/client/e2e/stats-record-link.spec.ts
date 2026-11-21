import { expect, test, type Page } from "@playwright/test";
import { findText, settle, trackPageErrors, waitFor } from "./helpers.js";
import { routeStops, waitForScene } from "./wave6-helpers-a.js";
import { activeScenes as activeScenesOf } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Stats records link to the game that set them (#911): "Fastest win" came from one game, so its row carries a "View game"
 * link that opens Past games with that game selected and its details up; Back returns to the Stats Records tab.
 * A record that adds up many games ("Rounds played") has no link. Desktop clicks the row, a phone taps it.
 */

const STATS = "PlayerStats";

/** Two finished wins with the summary the stats read: the quick one (round 3, the older) sets the fastest-win record. */
async function seedGames(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { IdbGameStorage } = (await import("/src/engine/idb-game-storage.ts")) as never as {
      IdbGameStorage: new () => { create(meta: unknown, state: unknown): Promise<void> };
    };
    const { SAVE_SCHEMA } = (await import("/src/engine/game-storage.ts")) as never as { SAVE_SCHEMA: number };
    const store = new IdbGameStorage();
    for (const [id, round, at] of [
      ["e2e-record-quick", 3, 100],
      ["e2e-record-slow", 9, 200],
    ] as const) {
      await store.create(
        {
          id,
          schema: SAVE_SCHEMA,
          config: {
            scenarioId: "rhino",
            difficulty: "standard",
            players: [{ starterDeckId: "core-spider-man-justice" }],
            seed: round,
          },
          createdAt: at,
          updatedAt: at,
          status: "won",
          round,
          commandCount: 50,
          outcome: { result: "win", reason: "villainDefeated" },
          campaignId: null,
          campaignNodeId: null,
          lastPlayedOn: { platform: "windows" },
          summary: {
            lossReason: null,
            heroesDefeated: 0,
            winners: [],
            alliesPlayed: 0,
            seats: [
              {
                identityCardId: "01001a",
                aspects: ["justice"],
                deck: ["01002", "01008", "01093"],
                plays: { "01008": 2 },
                activations: { "01008": 1 },
                entered: {},
                damage: 8,
                thwart: 4,
                defeated: false,
              },
            ],
            villains: ["Rhino"],
            version: 2,
            sideSchemes: { seen: {}, defeated: {} },
          },
        },
        {},
      );
    }
  });
}

async function stopRect(page: Page, scene: string, key: string) {
  return waitFor(
    async () => (await routeStops(page, scene))?.stops.find((s) => s.key === key)?.rect ?? null,
    `${key} on ${scene}`,
  );
}

async function press(page: Page, rect: { x: number; y: number; width: number; height: number }): Promise<void> {
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (page.viewportSize()!.width < 700) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test("a record from one game opens that game in Past games, and Back returns to the Records tab (#911)", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  if (info.project.name === "phone") await page.setViewportSize({ width: 375, height: 667 });
  const errors = trackPageErrors(page);
  await openApp(page, "unlock=all");
  await seedGames(page);
  await page.goto("/?screen=stats&tab=records&unlock=all");
  await waitForScene(page, STATS, 30_000);
  await settle(page);

  // The mouse above and below the short Records list asks about no row that isn't there (Codex on #917: an index of -1
  // or past the end used to throw on every move).
  if (info.project.name !== "phone") {
    const size = page.viewportSize()!;
    for (const y of [4, 70, size.height - 6, size.height / 2]) await page.mouse.move(size.width / 2, y, { steps: 3 });
    await settle(page);
    expect(errors, "no error moving over and around the list").toEqual([]);
  }

  // A record that adds up games is not a link: pressing it stays on Stats.
  await press(page, await stopRect(page, STATS, "row:fun:rounds"));
  await settle(page);
  expect(await activeScenesOf(page)).not.toContain("PastGames");

  // The fastest win is one: the older game, so the list's default (the newest) cannot be what shows.
  await press(page, await stopRect(page, STATS, "row:rec:fastest"));
  await waitForScene(page, "PastGames", 30_000);
  await stopRect(page, "PastGames", "action:watch");
  if (info.project.name === "phone") {
    // A phone selects nothing by default, so its popup is the linked game; the popup routes only close and actions.
    await stopRect(page, "PastGames", "close");
  } else {
    await stopRect(page, "PastGames", "game:e2e-record-quick");
    // "3 rounds" shows in the quick game's row and again in the details; the slow game's "9 rounds" only in its row.
    await waitFor(
      async () => ((await findText(page, "3 rounds", "PastGames")).length >= 2 ? true : null),
      "its details",
    );
    expect((await findText(page, "9 rounds", "PastGames")).length).toBe(1);
  }

  // Back (a phone's B first closes the popup) returns to Stats.
  if (info.project.name === "phone") await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await waitForScene(page, STATS, 30_000);
  await stopRect(page, STATS, "row:rec:fastest");
  expect(errors).toEqual([]);
});

test("a later visit to Past games that does not come from Stats goes back to the Title (#917 review)", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "the back label is an arrow on a phone; the reset is the same code");
  test.setTimeout(240_000);
  const errors = trackPageErrors(page);
  await openApp(page, "unlock=all");
  await seedGames(page);
  await page.goto("/?screen=stats&tab=records&unlock=all");
  await waitForScene(page, STATS, 30_000);
  await settle(page);
  await press(page, await stopRect(page, STATS, "row:rec:fastest"));
  await waitForScene(page, "PastGames", 30_000);
  await settle(page);
  expect((await findText(page, "STATS", "PastGames")).length, "opened from Stats: Back says Stats").toBeGreaterThan(0);

  // Leave and come back the way a replay's Exit or the Title does: the same kept scene, started with no `from`.
  await page.evaluate(() => {
    const game = (window as unknown as { __mcGame: { scene: { start: (key: string, data?: object) => void } } })
      .__mcGame;
    game.scene.start("PastGames", {});
  });
  await waitForScene(page, "PastGames", 30_000);
  await settle(page);
  await waitFor(
    async () => ((await findText(page, "TITLE", "PastGames")).length > 0 ? true : null),
    "Back says Title",
    15_000,
  );
  expect((await findText(page, "STATS", "PastGames")).length).toBe(0);
  expect(errors).toEqual([]);
});
