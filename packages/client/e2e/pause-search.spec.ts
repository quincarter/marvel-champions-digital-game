import { expect, test, type Page } from "@playwright/test";
import { findText, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, routeStops, screens, waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { boardUp, press } from "./x-men-helpers.js";

/**
 * Pause's search (#800): with something typed, grouped results take the sheet (phone) or the right panel (wide),
 * Settings first, changed in place; clearing the field, or opening the log, puts the sheet back.
 */

const PAUSE = "PauseOverlay";

const stopKeys = async (page: Page): Promise<readonly string[]> =>
  ((await routeStops(page, PAUSE))?.stops ?? []).map((s) => s.key);

async function pressStop(page: Page, phone: boolean, key: string): Promise<void> {
  const rect = await waitFor(
    async () => (await routeStops(page, PAUSE))?.stops.find((s) => s.key === key)?.rect ?? null,
    `the ${key} stop`,
    10000,
  );
  await press(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page, { quietMs: 400, maxMs: 4000 });
}

const undoPastTurn = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { settings: { undoPastTurn: string } };
    };
    return appSession().settings.undoPastTurn;
  });

async function typeQuery(page: Page, phone: boolean, query: string): Promise<void> {
  await pressStop(page, phone, "search");
  const field = page.locator("input").first();
  await field.fill("");
  await field.pressSequentially(query, { delay: 20 });
  await field.press("Enter");
}

test("issue #800: Pause's search puts settings first, changes them in place, and gives the sheet back", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    const { startOffTurnDevGame } = (await import(/* @vite-ignore */ "/src/store/dev-off-turn-game.ts")) as unknown as {
      startOffTurnDevGame: (store: unknown) => Promise<void>;
    };
    await startOffTurnDevGame(appSession().store);
    const scenes = (
      window as unknown as {
        __mcGame: {
          scene: {
            getScenes: (a: boolean) => { sys: { settings: { key: string } } }[];
            stop: (k: string) => void;
            start: (k: string) => void;
          };
        };
      }
    ).__mcGame.scene;
    for (const s of scenes.getScenes(true)) scenes.stop(s.sys.settings.key);
    scenes.start("Board");
  });
  await boardUp(page);
  // As the Board's MENU button does.
  await page.evaluate(
    (key) =>
      (
        window as unknown as {
          __mcGame: { scene: { getScene: (k: string) => { scene: { launch: (k: string) => void } } } };
        }
      ).__mcGame.scene
        .getScene("Board")
        .scene.launch(key),
    PAUSE,
  );
  await waitFor(async () => ((await stopKeys(page)).includes("search") ? true : null), "Pause's search", 15000);

  // "undo": Undo past your turn first, its three choices right there.
  await typeQuery(page, phone, "undo");
  await waitFor(
    async () => ((await stopKeys(page)).some((k) => k.startsWith("result:undo-past-turn:")) ? true : null),
    "Undo past your turn in the results",
    10000,
  );
  const keys = await stopKeys(page);
  const firstResult = keys.find((k) => k.startsWith("result:"));
  expect(firstResult).toMatch(/^result:undo-past-turn:/);
  // The results have the sheet: none of its usual rows or cards are there to press.
  expect(keys.some((k) => k.startsWith("quick:") || k.startsWith("table:") || k.startsWith("keyword:"))).toBe(false);

  // Off by default (2026-11-19). Turning it on warns that it blocks progression, and only Turn it on changes it.
  expect(await undoPastTurn(page)).toBe("off");
  await pressStop(page, phone, "result:undo-past-turn:warn");
  await waitForScene(page, "EndTurnConfirmOverlay");
  expect((await findText(page, "This blocks progression", "EndTurnConfirmOverlay")).length).toBeGreaterThan(0);
  if (process.env.SHOT_DIR)
    await page.screenshot({ path: `${process.env.SHOT_DIR}/undo-warning-${phone ? "phone" : "desktop"}.png` });
  const confirm = await page.evaluate(
    () =>
      (
        window as unknown as {
          __mcEndTurnConfirmDebug?: { endRect(): { x: number; y: number; width: number; height: number } };
        }
      ).__mcEndTurnConfirmDebug?.endRect() ?? null,
  );
  expect(confirm, "the warning's Turn it on").not.toBeNull();
  await press(page, phone, confirm!.x + confirm!.width / 2, confirm!.y + confirm!.height / 2);
  await waitFor(async () => ((await undoPastTurn(page)) === "warn" ? true : null), "Undo past your turn is Warn", 8000);
  // Back to Off asks nothing.
  await typeQuery(page, phone, "undo");
  await waitFor(
    async () => ((await stopKeys(page)).some((k) => k === "result:undo-past-turn:off") ? true : null),
    "the Off choice again",
    10000,
  );
  await pressStop(page, phone, "result:undo-past-turn:off");
  await waitFor(async () => ((await undoPastTurn(page)) === "off" ? true : null), "Undo past your turn is Off", 8000);
  expect(await screens(page)).not.toContain("EndTurnConfirmOverlay");

  // A typo'd shorthand still finds Card size.
  await typeQuery(page, phone, "crd siz");
  await waitFor(
    async () => ((await stopKeys(page)).some((k) => k.startsWith("result:card-size:")) ? true : null),
    "Card size from a shorthand",
    10000,
  );

  // Clearing the field gives the sheet back.
  await typeQuery(page, phone, "");
  await waitFor(
    async () => ((await stopKeys(page)).some((k) => k.startsWith("result:")) ? null : true),
    "the results gone",
    8000,
  );
  expect((await stopKeys(page)).some((k) => k === "quick-toggle" || k === "full-game-log")).toBe(true);

  // Wide: Full game log from a search leaves the search for the log.
  if (!phone) {
    await typeQuery(page, phone, "undo");
    await waitFor(
      async () => ((await stopKeys(page)).some((k) => k.startsWith("result:")) ? true : null),
      "results again",
      10000,
    );
    await pressStop(page, phone, "full-game-log");
    expect((await stopKeys(page)).some((k) => k.startsWith("result:"))).toBe(false);
    expect(await page.locator("input").first().inputValue()).toBe("");
  }
});
