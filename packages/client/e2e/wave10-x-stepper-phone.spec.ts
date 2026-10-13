import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, focusRect, handInstanceFor, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { declineMulligans, openApp } from "./wave6-helpers-b.js";
import { boardText, playFromHand } from "./x-men-helpers.js";

/**
 * QA finding (docs/qa-wave10-client.md, "X stepper at phone width"): at 390x844 and 360x740 the pay bar's X stepper
 * "+" control is drawn under the PAY button, so a tap on it does not raise X. Everywhere All at Once (58018) can then
 * only be played at its least X on a phone. Fixed: the bar stacks (`view/payment-bar-layout.ts`) and the stepper has
 * its own row.
 */
const EVERYWHERE = "58018";

for (const size of [
  { name: "390x844", width: 390, height: 844 },
  { name: "360x740", width: 360, height: 740 },
] as const) {
  test.describe(`Everywhere All at Once on a phone, ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true, isMobile: true });

    test("tapping the X stepper's plus raises X to 2", async ({ page }) => {
      test.setTimeout(180_000);
      await installWave6Helpers(page);
      await openApp(page);
      await setup(page);
      const card = (await handInstanceFor(page, EVERYWHERE))!;
      await playFromHand(page, true, card, async () => (await boardText(page, /^PAYING/i)) !== undefined);
      await settle(page, { quietMs: 400, maxMs: 2000 });
      const more = (await focusRect(page, "xMore"))!;
      await page.touchscreen.tap(more.x + more.width / 2, more.y + more.height / 2);
      await settle(page, { quietMs: 300, maxMs: 1000 });
      const picker = await page.evaluate(
        () =>
          (
            window as unknown as { __mcBoardDebug: { paymentView(): { xPicker: { value: number } | null } } }
          ).__mcBoardDebug.paymentView().xPicker,
      );
      expect(picker?.value).toBe(2);
    });
  });
}

async function setup(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (cfg: unknown) => Promise<void> } };
    };
    await appSession().store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "wonder-man-justice" }],
      seed: 5801,
      stack: { players: { 0: ["58009", "58003", "58023", "58004", "58016", "58018"] }, encounter: ["01098", "01109"] },
    });
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
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "Board is up", 20000);
  await settle(page);
  await declineMulligans(page);
  await settle(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          dispatch: (c: unknown) => Promise<void>;
          state: { legal?: { actions: { legal?: { action: { kind: string }; example: any }[] } } };
        };
      };
    };
    const { nextTurn } = (await import("/src/store/dev-game-steps.ts")) as unknown as {
      nextTurn: (store: unknown) => Promise<unknown>;
    };
    const { store } = appSession();
    const flip = store.state.legal?.actions.legal?.find((e) => e.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
    const end = store.state.legal?.actions.legal?.find((e) => e.action.kind === "endTurn");
    await store.dispatch(end!.example);
    await nextTurn(store);
  });
  await waitFor(async () => ((await activeScenes(page)).includes("VillainPhaseOverlay") ? true : null), "recap", 15000);
  await settle(page);
  await clickText(page, "Continue", { sceneKey: "VillainPhaseOverlay" });
  await waitFor(async () => (!(await activeScenes(page)).includes("VillainPhaseOverlay") ? true : null), "closes");
  await settle(page);
}
