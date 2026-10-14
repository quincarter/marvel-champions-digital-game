import { expect, test, type Page } from "@playwright/test";
import { clickText, settle, waitFor } from "./helpers.js";
import { clickStop, hasStop, installWave6Helpers, trackErrors, waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Issue 141: Scenario select's "Your record" line follows the selected scenario. It used to be looked up once, for the
 * scenario selected on entry, so moving from a played Rhino to an unplayed Klaw kept showing Rhino's record.
 */

const debug = (page: Page): Promise<{ selectedId: string; recordText: string }> =>
  page.evaluate(() => {
    const hook = (
      window as unknown as { __mcScenarioSelectDebug: { selectedId: () => string; recordText: () => string } }
    ).__mcScenarioSelectDebug;
    return { selectedId: hook.selectedId(), recordText: hook.recordText() };
  });

async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.E2E_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

test("the record line updates as the selection moves between scenarios", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page);
  // One finished win against Rhino in the player's saves.
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: { start: (c: unknown) => Promise<void>; listSaves: () => Promise<{ id: string }[]> };
      };
    };
    const { IdbGameStorage } = (await import(/* @vite-ignore */ "/src/engine/idb-game-storage.ts")) as unknown as {
      IdbGameStorage: new () => { setStatus: (id: string, status: string) => Promise<void> };
    };
    await appSession().store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
    });
    const saved = (await appSession().store.listSaves())[0]!;
    await new IdbGameStorage().setStatus(saved.id, "won");
  });

  await waitForScene(page, "Title", 30000);
  await settle(page);
  await clickText(page, "NEW GAME", { sceneKey: "Title" });
  await waitForScene(page, "ScenarioSelect");
  await waitFor(async () => (await hasStop(page, "next", "ScenarioSelect")) || null, "scenario list", 15000);

  await clickStop(page, "scenario:rhino", "ScenarioSelect");
  await settle(page);
  await waitFor(
    async () => ((await debug(page)).recordText.startsWith("Your record: 1 win") ? true : null),
    "Rhino's record",
    15000,
  );
  await shot(page, "issue141-rhino-record");

  await clickStop(page, "scenario:klaw", "ScenarioSelect");
  await settle(page);
  expect(await debug(page)).toEqual({ selectedId: "klaw", recordText: "Not played yet." });
  await shot(page, "issue141-klaw-not-played");

  await clickStop(page, "scenario:rhino", "ScenarioSelect");
  await settle(page);
  expect((await debug(page)).recordText).toMatch(/^Your record: 1 win · 0 losses\./);
  expect(errors).toEqual([]);
});
