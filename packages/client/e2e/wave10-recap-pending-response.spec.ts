import { expect, test, type Page } from "@playwright/test";
import { activeScenes, handInstanceFor, pressAt, settle, waitFor } from "./helpers.js";
import { continueRect, reachVillainRecap } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, openApp } from "./wave6-helpers-b.js";
import { SHOT, boardText, playFromHand, press, waitForBoardText } from "./x-men-helpers.js";

/**
 * Wave 10 click-through F1: the villain-phase recap's last step has CONTINUE, and a response that opens as the player
 * phase begins (Tigra's On the Hunt, "After the player phase begins") is already pending behind it. CONTINUE must
 * close the recap and show that prompt; it used to do nothing, and only SKIP got the player out.
 * Setup (Tigra in hero form, Hunted in the opening hand) goes through the store; Hunted puts a minion into play to
 * engage her, and the Hunted pick, End turn and the CONTINUE press are real input.
 */
const HUNTED = "56007";

// The click-through ran with motion on: the reveal and close timers are part of the bug.
test.use({ reducedMotion: "no-preference" });

async function setup(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (cfg: unknown) => Promise<void> } };
    };
    await appSession().store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "tigra-aggression" }],
      seed: 5607,
      stack: { players: { 0: ["56007"] } },
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
          state: { legal?: { actions: { legal?: { action: { kind: string }; example: unknown }[] } } };
        };
      };
    };
    const { store } = appSession();
    const flip = store.state.legal?.actions.legal?.find((e) => e.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  });
  await settle(page);
}

test("the recap's CONTINUE closes it and shows the response that opened with the player phase", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await setup(page);

  // Hunted puts a minion from the encounter deck into play, engaged with Tigra.
  const hunted = (await handInstanceFor(page, HUNTED))!;
  expect(hunted, "Hunted is in the hand").toBeTruthy();
  const sheetUp = async (): Promise<boolean> => (await boardText(page, /^ENCOUNTER (DECK|DISCARD)$/i)) !== undefined;
  await playFromHand(page, phone, hunted, sheetUp);
  const first = await waitForBoardText(page, /^ENCOUNTER (DECK|DISCARD)$/i, "the Hunted sheet is up");
  await press(page, phone, first.x, first.y - 60);
  await waitFor(async () => ((await sheetUp()) ? null : true), "the sheet closes once a face is chosen", 10000);
  await settle(page);

  await reachVillainRecap(page, phone);
  expect(await activeScenes(page)).toContain("VillainPhaseOverlay");
  const pending = await page.evaluate(async () => {
    const mod = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game?: { pendingChoice?: { prompt: { kind: string } } } } } };
    };
    return mod.appSession().store.state.game?.pendingChoice?.prompt.kind ?? null;
  });
  expect(pending, "On the Hunt is already pending behind the recap").not.toBeNull();
  if (SHOT) await page.screenshot({ path: `${SHOT}/wave10-fix-f1-before-${info.project.name}.png` });

  const rect = (await continueRect(page))!;
  if (phone) await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
  else await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await waitFor(
    async () => ((await activeScenes(page)).includes("VillainPhaseOverlay") ? null : true),
    "CONTINUE closes the recap",
    8000,
  );
  await waitFor(
    async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? true : null),
    "the pending response is shown",
    8000,
  );
  if (SHOT) await page.screenshot({ path: `${SHOT}/wave10-fix-f1-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
