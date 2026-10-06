import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp, facts, press } from "./x-men-helpers.js";

/**
 * Morlock Siege's Routed (40081a: "Cards under here are not in play"): the villain defeated first is tucked under it.
 * The dev game (`store/dev-routed-game.ts`) plays a real solo game forward until that has happened. The environment
 * shows an "UNDER 1" badge and the tucked card faceup; the card opens in Inspect; and the villain row shows only the
 * villain in play.
 */

const texts = async (page: Page): Promise<string[]> =>
  (await visibleTexts(page)).filter((t) => t.scene === "Board").map((t) => t.text);

test("a villain tucked under Routed shows under the environment and is gone from the table", async ({ page }, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    const { startRoutedDevGame } = (await import(/* @vite-ignore */ "/src/store/dev-routed-game.ts")) as unknown as {
      startRoutedDevGame: (store: unknown) => Promise<void>;
    };
    await startRoutedDevGame(appSession().store);
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

  const tucked = await facts(page, (game) => {
    const host = game.villainArea.find((id: string) => game.instances[id].tucked.length > 0);
    const under = game.instances[host].tucked[0];
    const name = (id: string) => game.cardPool[game.instances[id].cardId].name;
    return { host, under, name: name(under), active: name(game.activeVillainId) };
  });
  expect(tucked.name).not.toBe(tucked.active);

  // On a phone the environment lives on the Enemies tab.
  if (phone) await clickText(page, "ENEMIES", { sceneKey: "Board", maxY: 100 });
  await settle(page, { quietMs: 400, maxMs: 3000 });
  await waitFor(
    async () => ((await texts(page)).some((t) => /^under 1$/i.test(t)) ? true : null),
    "the UNDER 1 badge on Routed",
    15000,
  );
  const boardTexts = await texts(page);
  expect(
    boardTexts.some((t) => t.includes(tucked.active)),
    "the villain in play is drawn",
  ).toBe(true);
  expect(
    boardTexts.some((t) => /defeated/i.test(t)),
    "the tucked villain is not a struck-out slot in a villain row",
  ).toBe(false);
  if (SHOT) await page.screenshot({ path: `${SHOT}/routed-${info.project.name}.png` });

  // The tucked card is its own tile and opens in Inspect.
  const rect = await waitFor(
    async () =>
      page.evaluate(
        (k) =>
          (window as unknown as { __mcBoardDebug?: { focusRect: (k: string) => unknown } }).__mcBoardDebug?.focusRect(
            k,
          ) ?? null,
        `card:${tucked.under}`,
      ) as Promise<{ x: number; y: number; width: number; height: number } | null>,
    "a tile for the tucked card",
    10000,
  );
  await press(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await waitFor(
    async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null),
    "Inspect opens on the tucked card",
    10000,
  );
  await settle(page, { quietMs: 500, maxMs: 3000 });
  if (SHOT) await page.screenshot({ path: `${SHOT}/routed-inspect-${info.project.name}.png` });
  expect((await visibleTexts(page)).some((t) => t.text.includes(tucked.name))).toBe(true);
});
