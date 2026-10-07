import { expect, test } from "@playwright/test";
import { focusRect, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp, facts, press } from "./x-men-helpers.js";

/**
 * Angel (42001) has three faces: Warren Worthington III, Angel, Archangel. From alter-ego the engine offers one
 * change-form entry per hero face, so the Flip control opens "Which form?" instead of guessing. The dev game
 * (`store/dev-angel-game.ts`) stops on Warren's first turn.
 */
test("Angel: the flip control asks which face, and Archangel becomes the identity", async ({ page }, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    const { startAngelDevGame } = (await import(/* @vite-ignore */ "/src/store/dev-angel-game.ts")) as unknown as {
      startAngelDevGame: (store: unknown) => Promise<void>;
    };
    await startAngelDevGame(appSession().store);
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
  expect(await facts(page, (g) => g.players[0].identity.form)).toBe("alterEgo");

  const flip = await waitFor(() => focusRect(page, "basic:changeForm"), "the flip control", 15000);
  await press(page, phone, flip.x + flip.width / 2, flip.y + flip.height / 2);
  await settle(page, { quietMs: 150, maxMs: 800 });
  const board = async (): Promise<{ text: string; x: number; y: number }[]> =>
    (await visibleTexts(page)).filter((t) => t.scene === "Board");
  const archangel = await waitFor(
    async () => (await board()).find((t) => /^archangel$/i.test(t.text.trim())) ?? null,
    "the Archangel choice",
    10000,
  );
  const names = (await board()).map((t) => t.text.trim().toLowerCase());
  expect(names, "both hero faces are offered").toContain("angel");
  if (!phone) expect(names).toContain("which form?");
  if (SHOT) await page.screenshot({ path: `${SHOT}/angel-form-${info.project.name}.png` });

  await press(page, phone, archangel.x, archangel.y);
  await waitFor(
    async () => ((await facts(page, (g) => g.players[0].identity.heroFormIndex)) === 1 ? true : null),
    "the identity flips to Archangel",
    15000,
  );
  expect(await facts(page, (g) => g.players[0].identity.form)).toBe("hero");
});
