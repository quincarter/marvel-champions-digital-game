import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, settle, waitFor } from "./helpers.js";
import { clickStop, installWave6Helpers, routeStops, screens, trackErrors, waitForScene } from "./wave6-helpers-a.js";

/**
 * Issue #791 (a Codex finding on PR #793): a Manual adjust that ends the game (the villain's last hit points) closes
 * Manual adjust and Pause, so Game Over is never left under them.
 */

const SCENE = "ManualAdjustOverlay";

const outcomeOf = (page: Page) =>
  page.evaluate(async () => {
    const mod = await import("/src/session.ts");
    const state = (
      mod as unknown as { appSession: () => { store: { state: { game?: { outcome?: unknown } } } } }
    ).appSession().store.state;
    return state.game?.outcome ?? null;
  });

const villainId = (page: Page) =>
  page.evaluate(async () => {
    const mod = await import("/src/session.ts");
    const state = (
      mod as unknown as { appSession: () => { store: { state: { game?: { activeVillainId?: string } } } } }
    ).appSession().store.state;
    return state.game?.activeVillainId ?? null;
  });

test("issue #791: a Manual adjust that defeats the villain leaves an unobstructed Game Over", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "one form factor is enough for the scene handoff");
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=crowded");
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "the board", 90_000);
  await settle(page, { quietMs: 600, maxMs: 6000 });
  for (let attempt = 0; attempt < 10 && !(await screens(page)).includes("PauseOverlay"); attempt++) {
    await clickText(page, "MENU", { sceneKey: "Board" }).catch(() => undefined);
    await page.waitForTimeout(1200);
  }
  await waitForScene(page, "PauseOverlay");
  await clickStop(page, "manual-adjust", "PauseOverlay");
  await waitForScene(page, SCENE);

  for (let press = 0; press < 120 && (await outcomeOf(page)) === null; press++) {
    if ((await screens(page)).includes("EndTurnConfirmOverlay")) {
      await clickStop(page, "ok", "EndTurnConfirmOverlay");
      await settle(page, { quietMs: 200, maxMs: 1500 });
      continue;
    }
    const keys = ((await routeStops(page, SCENE))?.stops ?? []).map((s) => s.key);
    if (!keys.some((k) => k.startsWith("choice:"))) {
      // On the list (or back on it after a stage flipped): open the villain's page.
      const villain = await villainId(page);
      await clickStop(page, `target:${villain}`, SCENE);
      await settle(page, { quietMs: 200, maxMs: 1500 });
      continue;
    }
    // A character's page lists "+1 damage" first.
    await clickStop(page, "choice:0", SCENE);
    await settle(page, { quietMs: 150, maxMs: 1500 });
  }
  expect(await outcomeOf(page), "the adjustments defeated the villain").not.toBeNull();
  await waitFor(
    async () => {
      const scenes = await activeScenes(page);
      return !scenes.includes(SCENE) && !scenes.includes("PauseOverlay") ? true : null;
    },
    "Manual adjust and Pause close when the game ends",
    20_000,
  );
  expect(errors).toEqual([]);
});
