import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { settle, trackPageErrors } from "./helpers.js";
import { waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Game Over for a Civil War leader shows that leader's own scene on a win (`villain-loses`) as well as on a loss
 * (`villain-wins`); a win used to read as a flat green field (wave 10 client QA F11). Staged the way that QA did: a
 * real game, then a dev host that plays the same state with the outcome set, so the screen is the one a finished game
 * reaches. Set `GAME_OVER_SHOTS` to a folder to keep screenshots.
 */

const ENGINE = resolve(import.meta.dirname, "../../engine/src/index.ts").replaceAll("\\", "/");
const SHOTS = process.env.GAME_OVER_SHOTS ?? "";
const SCENARIO = "registration-iron-man";

async function finishedGame(page: Page, result: "win" | "loss"): Promise<void> {
  await page.evaluate(
    async ([scenarioId, outcome, engineModule]) => {
      const session = (await import("/src/session.ts")) as any;
      const { DevStateHost } = (await import("/src/engine/dev-state-host.ts")) as any;
      const { POOL_DEPS } = (await import("/src/content/pool.ts")) as any;
      const { applyCommands } = (await import(/* @vite-ignore */ `/@fs/${engineModule}`)) as any;
      const config = {
        scenarioId,
        difficulty: "standard",
        players: [{ starterDeckId: "deadpool-pool" }],
        seed: 21,
      };
      await session.appSession().store.start(config);
      const saved = await session.appSession().store.save();
      const replayed = applyCommands(saved.initialState, saved.commands, POOL_DEPS);
      if (!replayed.ok) throw new Error("replay failed");
      const state = {
        ...replayed.state,
        outcome:
          outcome === "win"
            ? { result: "win", reason: "villainDefeated" }
            : { result: "loss", reason: "mainSchemeCompleted" },
      };
      session.useDevHost(new DevStateHost(state, POOL_DEPS));
      await session.appSession().store.start(config);
      const game = (window as any).__mcGame;
      for (const s of game.scene.getScenes(true)) game.scene.stop(s.sys.settings.key);
      game.scene.start("GameOver");
    },
    [SCENARIO, result, ENGINE] as const,
  );
  await waitForScene(page, "GameOver", 30000);
  await settle(page, { quietMs: 800, maxMs: 5000 });
}

/** The scene's own cache: the leader's picture is loaded as a texture named for its file. */
async function sceneArtLoaded(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const game = (window as any).__mcGame;
    return game.textures.getTextureKeys().filter((key: string) => key.startsWith("scene-art:scenarios/"));
  });
}

for (const size of [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "phone", viewport: { width: 390, height: 844 } },
]) {
  for (const result of ["win", "loss"] as const) {
    test(`Game Over after a ${result} against the Iron Man leader draws its own picture at ${size.name}`, async ({
      page,
    }) => {
      const errors = trackPageErrors(page);
      await page.setViewportSize(size.viewport);
      await openApp(page, "unlock=all");
      await finishedGame(page, result);
      const slot = result === "win" ? "villain-loses" : "villain-wins";
      expect(await sceneArtLoaded(page)).toEqual([expect.stringContaining(`${SCENARIO}/${slot}`)]);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/qa-fix-screens-game-over-${result}-${size.name}.png` });
      expect(errors).toEqual([]);
    });
  }
}
