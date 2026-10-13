import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { answerChoice, declineMulligans, openApp, useIdentityAbility } from "./wave6-helpers-b.js";
import { SHOT, boardText, waitForBoardText } from "./x-men-helpers.js";

/**
 * Hercules on the board (docs/phase7-wave10-client.md 5.3): the Gift count where the cards that read it can be understood,
 * and the reason a refused action gives. Hercules (`hercules-leadership`) against Rhino, The Gift of Battle (59009) and
 * Ancient Rivalry (59026) stacked into the opening hand.
 * - His identity carries "Gift cards counted: 0", and The Gift of Battle in the hand carries "Gift cards: 0" along its foot.
 * - After New Labors of Hercules reveals a Labor card, the same action on his identity reads "Can't use: a Labor card
 *   is in play": the engine's refusal, with the clause of its condition that failed.
 * - Flipped to hero, Ancient Rivalry, which needs Thor in play, is tagged "needs partner" in the hand.
 * Setup goes through the store; the action is used by real pointer input on the identity's Inspect sheet.
 */
async function setup(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (cfg: unknown) => Promise<void> } };
    };
    await appSession().store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      modularSetIds: ["bomb_scare"],
      players: [{ starterDeckId: "hercules-leadership" }],
      seed: 5901,
      stack: { players: { 0: ["59009", "59026"] }, encounter: ["01098", "01186"] },
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
  await settle(page, { quietMs: 1000, maxMs: 6000 });
}

test("Hercules: the Gift count is on his identity and on the cards that read it, and a refused action says why", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  await installWave6Helpers(page);
  await openApp(page);
  await setup(page);

  await waitForBoardText(page, /Gift cards counted: 0/i, "the identity carries the Gift count");
  await waitForBoardText(page, /^Gift cards: 0$/i, "The Gift of Battle carries the count along its foot");
  expect(await boardText(page, /can't use:/i), "nothing is refused yet").toBeUndefined();

  // New Labors of Hercules: a Labor card is revealed and stays in play, so the same action is refused.
  await useIdentityAbility(page, "New Labors of Hercules");
  // Embody Pathos asks which side scheme it attaches to; the first will do.
  await answerChoice(page, 0);
  await settle(page, { quietMs: 600, maxMs: 4000 });
  await waitForBoardText(page, /Can't use: a Labor card is in play/i, "the refused action gives its reason");
  if (SHOT) await page.screenshot({ path: `${SHOT}/wave10-hercules-${info.project.name}.png` });

  // In hero form Ancient Rivalry is playable by form, and the engine refuses it for want of Thor: the tag says so.
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
  await waitForBoardText(page, /^needs partner$/i, "Ancient Rivalry is tagged as needing its partner");
});
