import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { settle, trackPageErrors } from "./helpers.js";
import { routeStops, waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Game Over for a Civil War game the builder's Random button made offers three rematch buttons ("Play again", "New
 * random scenario", "Same seed, same hands") and "Back to title" (owner, wave 10). At every size the screen draws, none
 * of those controls may leave the screen or overlap another. Staged through the store (a Civil War config with
 * `randomScenario`) and a concede, the way the Pause menu's own confirm does.
 */

const OFFER = resolve(import.meta.dirname, "../../cards/src/playable/scenario-options.ts");
const SHOTS = process.env.GAME_OVER_SHOTS ?? "";

const sizes = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "tablet", viewport: { width: 1024, height: 768 } },
  { name: "phone", viewport: { width: 390, height: 844 } },
  { name: "short-phone", viewport: { width: 360, height: 740 } },
  { name: "tiny-phone", viewport: { width: 360, height: 560 } },
] as const;

async function concededRandomCivilWar(page: Page): Promise<void> {
  await page.evaluate(
    async (offerModule) => {
      const { appSession } = (await import("/src/session.ts")) as unknown as {
        appSession: () => {
          store: { start: (cfg: unknown) => Promise<void>; dispatch: (c: unknown) => Promise<boolean>; state: any };
        };
      };
      const offer = (await import(/* @vite-ignore */ `/@fs/${offerModule}`)) as {
        playableScenarioOffer: (id: string) => { mainSchemeStages: { recommended: readonly string[] } };
      };
      const scenarioId = "registration-iron-man";
      const { store } = appSession();
      await store.start({
        scenarioId,
        difficulty: "standard",
        players: [{ starterDeckId: "deadpool-pool" }],
        seed: 21,
        mainSchemeStageIds: offer.playableScenarioOffer(scenarioId).mainSchemeStages.recommended,
        randomScenario: true,
      });
      await store.dispatch({ type: "concede", playerId: store.state.perspectiveId });
      const game = (window as any).__mcGame;
      for (const s of game.scene.getScenes(true)) game.scene.stop(s.sys.settings.key);
      game.scene.start("GameOver");
    },
    OFFER.replaceAll("\\", "/"),
  );
  await waitForScene(page, "GameOver", 30000);
  await settle(page, { quietMs: 600, maxMs: 4000 });
}

for (const size of sizes) {
  test(`Game Over with three rematch buttons keeps every control on screen and apart at ${size.name}`, async ({
    page,
  }) => {
    const errors = trackPageErrors(page);
    await page.setViewportSize(size.viewport);
    await openApp(page, "unlock=all");
    await concededRandomCivilWar(page);
    const route = await routeStops(page, "GameOver");
    const stops = route?.stops ?? [];
    expect(stops.length).toBeGreaterThanOrEqual(4);
    for (const stop of stops) {
      const r = stop.rect;
      expect(r.x, `${stop.key} left`).toBeGreaterThanOrEqual(0);
      expect(r.y, `${stop.key} top`).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width, `${stop.key} right`).toBeLessThanOrEqual(size.viewport.width);
      expect(r.y + r.height, `${stop.key} bottom`).toBeLessThanOrEqual(size.viewport.height);
    }
    for (let i = 0; i < stops.length; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        const a = stops[i]!.rect;
        const b = stops[j]!.rect;
        const overlap = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        expect(overlap, `${stops[i]!.key} and ${stops[j]!.key} overlap`).toBe(false);
      }
    }
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/wave10-game-over-random-${size.name}${process.env.GAME_OVER_SUFFIX ?? ""}.png`,
      });
    expect(errors).toEqual([]);
  });
}
