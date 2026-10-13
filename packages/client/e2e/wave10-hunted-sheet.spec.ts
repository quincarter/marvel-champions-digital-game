import { expect, test, type Page } from "@playwright/test";
import { activeScenes, handInstanceFor, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { declineMulligans, openApp } from "./wave6-helpers-b.js";
import { SHOT, boardText, playFromHand, press, waitForBoardText } from "./x-men-helpers.js";

/**
 * Hunted (Tigra, 56007) puts a minion from the encounter deck or discard into play as part of its cost. The pick is a
 * sheet of the candidates' card faces, each with its area tag in words and an Inspect button, over the table; tapping a
 * face chooses it and Cancel backs out. Setup (Tigra flipped to hero form, Hunted on top of the deck) is sent through
 * the store; the sheet, its tags and the choice are real pointer input.
 */
const HUNTED = "56007";

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
          state: { legal?: { actions: { legal?: { action: { kind: string }; example: any }[] } } };
        };
      };
    };
    const { store } = appSession();
    const flip = store.state.legal?.actions.legal?.find((e) => e.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  });
  await settle(page);
}

test("Hunted: the minion pick is a sheet of card faces with area tags, Cancel backs out, a tap chooses", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await setup(page);
  const hunted = (await handInstanceFor(page, HUNTED))!;
  expect(hunted, "Hunted is in the hand").toBeTruthy();

  const sheetUp = async (): Promise<boolean> => (await boardText(page, /^ENCOUNTER (DECK|DISCARD)$/i)) !== undefined;
  await playFromHand(page, phone, hunted, sheetUp);
  const tag = await waitForBoardText(page, /^ENCOUNTER (DECK|DISCARD)$/i, "a candidate's area tag is on its face");
  expect(tag.text).toMatch(/ENCOUNTER (DECK|DISCARD)/);
  await waitForBoardText(page, /^Inspect$/i, "each face offers Inspect");
  await waitForBoardText(page, /^Minion/i, "the card type is on the face's caption");
  if (SHOT) await page.screenshot({ path: `${SHOT}/wave10-hunted-${info.project.name}.png` });

  // Cancel backs out to the table.
  const cancel = await waitForBoardText(page, /^Cancel$/i, "Cancel is on the sheet");
  await press(page, phone, cancel.x, cancel.y);
  await waitFor(async () => ((await sheetUp()) ? null : true), "the sheet closes on Cancel", 10000);

  // Again, and a tap on the first face chooses it: the sheet closes and the play carries on.
  await playFromHand(page, phone, hunted, sheetUp);
  const first = await waitForBoardText(page, /^ENCOUNTER (DECK|DISCARD)$/i, "the sheet is up again");
  await press(page, phone, first.x, first.y - 60);
  await waitFor(async () => ((await sheetUp()) ? null : true), "the sheet closes once a face is chosen", 10000);
  await settle(page);
});
