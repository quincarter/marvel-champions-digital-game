import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressAt, settle, waitFor } from "./helpers.js";
import { continueRect, villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, type Rect } from "./wave6-helpers-b.js";

/**
 * "Flip each encounter card" (#287): the docked villain phase stops on each encounter card a player was dealt
 * facedown, showing its back and a Flip Encounter Card button, and carries on with the card's face once it is pressed.
 * With the setting off nothing stops there. Ultron deals every hero a card each round, so one end turn is enough.
 */

async function startAndEndTurn(page: Page, settings: Record<string, unknown>): Promise<void> {
  await page.addInitScript((extra) => {
    localStorage.setItem("mc-settings", JSON.stringify({ version: 1, villainAutoAdvance: "off", ...extra }));
  }, settings);
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (cfg: unknown) => Promise<void> } };
    };
    await appSession().store.start({
      scenarioId: "ultron",
      difficulty: "standard",
      players: [{ starterDeckId: "core-captain-marvel-leadership" }],
      seed: 287,
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
    const end = store.state.legal?.actions.legal?.find((e) => e.action.kind === "endTurn");
    if (end) await store.dispatch(end.example);
  });
  await settle(page);
}

const press = async (page: Page, phone: boolean, rect: Rect): Promise<void> => {
  await settle(page);
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (phone) await page.touchscreen.tap(x, y);
  else await pressAt(page, x, y);
};

/** Presses START / ANSWER / Next card until the recap is up or `stopAtFlip` and a Flip button shows; returns whether Flip showed. */
async function playOn(page: Page, phone: boolean, stopAtFlip: boolean): Promise<boolean> {
  let sawFlip = false;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await continueRect(page)) return sawFlip;
    const flip = await villainDebugRect(page, "flipRect");
    if (flip) {
      sawFlip = true;
      if (stopAtFlip) return true;
    }
    for (const name of ["startRect", "answerRect", "nextRect"]) {
      const rect = await villainDebugRect(page, name);
      if (rect) {
        await press(page, phone, rect);
        break;
      }
    }
    await page.waitForTimeout(150);
  }
  throw new Error("the villain phase never reached its recap");
}

test("a facedown encounter card stops on Flip Encounter Card, and pressing it carries the reveal on", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await startAndEndTurn(page, {});

  expect(await playOn(page, phone, true), "Flip Encounter Card shows on the dealt card").toBe(true);
  const flip = (await villainDebugRect(page, "flipRect"))!;
  // Held: the reveal does not move on by itself.
  await page.waitForTimeout(2500);
  expect(await villainDebugRect(page, "flipRect"), "still waiting on the press").not.toBeNull();

  await press(page, phone, flip);
  // The turn takes about half a second; then the button is gone and the reveal goes on (Next card or the next beat).
  await waitFor(async () => ((await villainDebugRect(page, "flipRect")) === null ? true : null), "card flipped", 5000);
  await playOn(page, phone, false);
  expect(await continueRect(page), "the phase reaches its recap").not.toBeNull();
  expect(errors).toEqual([]);
});

test("the full-screen phase (docked table off) stops on Flip Encounter Card too", async ({ page }, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await startAndEndTurn(page, { villainDockTable: false });

  expect(await playOn(page, phone, true), "Flip Encounter Card shows on the dealt card").toBe(true);
  const flip = (await villainDebugRect(page, "flipRect"))!;
  // Held: the reveal does not move on by itself.
  await page.waitForTimeout(2500);
  expect(await villainDebugRect(page, "flipRect"), "still waiting on the press").not.toBeNull();

  await press(page, phone, flip);
  // The turn takes about half a second; then the button is gone and the reveal goes on (Next card or the next beat).
  await waitFor(async () => ((await villainDebugRect(page, "flipRect")) === null ? true : null), "card flipped", 5000);
  await playOn(page, phone, false);
  expect(await continueRect(page), "the phase reaches its recap").not.toBeNull();
  expect(errors).toEqual([]);
});

test("with Flip each encounter card off, no Flip button ever shows", async ({ page }, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await startAndEndTurn(page, { flipEncounterCards: false });

  expect(await playOn(page, phone, false), "no stop on a facedown card").toBe(false);
  expect(errors).toEqual([]);
});
