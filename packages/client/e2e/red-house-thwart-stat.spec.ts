import { expect, test, type Page } from "@playwright/test";
import { clickFocus, settle } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { boardUp, facts, press } from "./x-men-helpers.js";

/**
 * Issue #365: The Red House (04139) says "When a character thwarts this side scheme, they may use their ATK instead of
 * their THW". Pressing Thwart with it the scheme to thwart asks "THW n / ATK n" over the hand, and the ATK answer
 * removes ATK's worth of threat. The fixture is `store/dev-red-house-game.ts`.
 */

const SHOTS = process.env.E2E_SHOTS ?? "";

const shot = async (page: Page, name: string): Promise<void> => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

const boardTexts = async (page: Page) => (await visibleTexts(page)).filter((t) => t.scene === "Board");

test("thwarting The Red House asks THW or ATK, and ATK removes the ATK number", async ({ page }, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: unknown };
    };
    const mod = (await import(/* @vite-ignore */ "/src/store/dev-red-house-game.ts")) as unknown as {
      startRedHouseGame: (store: unknown) => Promise<void>;
    };
    await mod.startRedHouseGame(appSession().store);
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
  const cont = (await visibleTexts(page)).find(
    (t) => t.scene === "VillainPhaseOverlay" && /^(continue|start player phase( ▸)?)$/i.test(t.text.trim()),
  );
  if (cont) await press(page, phone, cont.x, cont.y);
  await settle(page, { quietMs: 600, maxMs: 3000 });

  const before = await facts(page, (g) => {
    const found = Object.values<any>(g.instances).find((i) => i.cardId === "04139");
    return found ? (found.threat as number) : -1;
  });
  expect(before, "The Red House is in play with threat").toBeGreaterThan(0);

  await clickFocus(page, "basic:thwart");
  await settle(page, { quietMs: 500, maxMs: 3000 });
  const texts = await boardTexts(page);
  const thw = texts.find((t) => /(^|\s)THW \d+$/.test(t.text.trim()));
  const atk = texts.find((t) => /(^|\s)ATK \d+$/.test(t.text.trim()));
  expect(thw, `a THW button (saw ${JSON.stringify(texts.map((t) => t.text).slice(0, 60))})`).toBeDefined();
  expect(atk, "an ATK button").toBeDefined();
  await shot(page, `red-house-thwart-with-${phone ? "390" : "1440"}`);

  const atkValue = Number(/ATK (\d+)$/.exec(atk!.text.trim())![1]);
  await press(page, phone, atk!.x, atk!.y);
  await settle(page, { quietMs: 800, maxMs: 4000 });
  const after = await facts(page, (g) => {
    const found = Object.values<any>(g.instances).find((i) => i.cardId === "04139");
    return found ? (found.threat as number) : 0;
  });
  expect(before - after, "the threat removed is the ATK number").toBe(Math.min(atkValue, before));
  await shot(page, `red-house-thwarted-${phone ? "390" : "1440"}`);
});
