import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, focusRect, handInstanceFor, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { declineMulligans, hook, openApp, type Rect } from "./wave6-helpers-b.js";
import {
  SHOT,
  boardText,
  bringIntoView,
  facts,
  playFromHand,
  press,
  pressCard,
  waitForBoardText,
} from "./x-men-helpers.js";

/**
 * Naming X for a card printed with an X cost, with Wonder Man's starter deck (`wonder-man-justice`) against Rhino.
 * Everywhere All at Once (58018, "Choose X schemes. Remove 2 threat from each"; X is at least 1) used to be playable
 * only at its least X, because the board never sent one. The pay step now carries an X stepper (minus, "X 2", plus):
 * the requirement follows it, the command carries it, and two schemes each lose 2 threat at X = 2.
 * Setup (flip to hero, round 2 so Bomb Scare is out) goes through the store; everything under test is real pointer input.
 */

const EVERYWHERE = "58018";
const ENERGY = "58023"; // 2 resources

/** Every scheme (the main scheme and each side scheme) holding threat, by instance id. */
const schemeThreat = (page: Page): Promise<Record<string, number>> =>
  facts(page, (game) => {
    const out: Record<string, number> = {};
    for (const [id, i] of Object.entries(game.instances as Record<string, { threat?: number }>))
      if ((i.threat ?? 0) > 0) out[id] = i.threat!;
    return out;
  });

async function setup(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (cfg: unknown) => Promise<void> } };
    };
    await appSession().store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "wonder-man-justice" }],
      seed: 5802,
      stack: {
        players: { 0: ["58017", "58023", "58016", "58004", "58003", "58018"] },
        // Round 1: Armored Rhino Suit is the boost card, Bomb Scare the encounter card (3 threat with one hero).
        encounter: ["01098", "01109"],
      },
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
    // Flip to hero form in round 1, then end the round so Bomb Scare is out with threat to thwart in round 2.
    const flip = store.state.legal?.actions.legal?.find((e) => e.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
    // Two rounds, so the main scheme holds at least the 2 threat that is removed from it.
    for (let round = 0; round < 2; round++) {
      const end = store.state.legal?.actions.legal?.find((e) => e.action.kind === "endTurn");
      await store.dispatch(end!.example);
      await nextTurn(store);
    }
  });
  await settle(page);
}

const paymentNow = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as {
        __mcBoardDebug: {
          paymentView(): {
            required: number;
            xPicker: { value: number; min: number; max: number } | null;
            command: { x?: number } | null;
          };
        };
      }
    ).__mcBoardDebug.paymentView(),
  );

const pressControl = async (page: Page, phone: boolean, key: string): Promise<void> => {
  const rect = (await focusRect(page, key))!;
  expect(rect, `${key} is on the bar`).not.toBeNull();
  await press(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page, { quietMs: 200, maxMs: 800 });
};

test("Everywhere All at Once: raise X to 2 in the pay step, pay, choose two schemes, both lose 2 threat", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await setup(page);
  await waitFor(async () => ((await activeScenes(page)).includes("VillainPhaseOverlay") ? true : null), "recap", 15000);
  await settle(page);
  await clickText(page, "Start player phase", { sceneKey: "VillainPhaseOverlay" });
  await waitFor(
    async () => (!(await activeScenes(page)).includes("VillainPhaseOverlay") ? true : null),
    "recap closes",
  );
  await settle(page);

  const before = await schemeThreat(page);
  expect(Object.keys(before).length, "the main scheme and Bomb Scare both hold threat").toBeGreaterThanOrEqual(2);
  expect(Math.min(...Object.values(before)), `each scheme can lose 2 ${JSON.stringify(before)}`).toBeGreaterThanOrEqual(
    2,
  );

  const card = (await handInstanceFor(page, EVERYWHERE))!;
  await playFromHand(page, phone, card, async () => (await boardText(page, /^PAYING/i)) !== undefined);
  // Opens at the engine's least X: 1, so one resource is owed.
  expect((await paymentNow(page)).xPicker).toMatchObject({ value: 1, min: 1 });
  await waitForBoardText(page, /^PAYING 0 \/ 1$/i, "the requirement at X = 1");
  await waitForBoardText(page, /^X 1$/i, "the stepper reads X 1");
  // The minus stops at the least.
  await pressControl(page, phone, "xLess");
  expect((await paymentNow(page)).xPicker?.value).toBe(1);

  await pressControl(page, phone, "xMore");
  expect((await paymentNow(page)).xPicker?.value).toBe(2);
  await waitForBoardText(page, /^PAYING 0 \/ 2$/i, "the requirement follows X");
  await waitForBoardText(page, /^X 2$/i, "the stepper reads X 2");
  if (SHOT) await page.screenshot({ path: `${SHOT}/x-cost-${info.project.name}.png` });

  // Spend the 2-resource card; it covers X = 2 and the command carries the X.
  const energy = (await handInstanceFor(page, ENERGY))!;
  await bringIntoView(page, `card:${energy}`);
  await pressCard(page, phone, energy);
  await waitForBoardText(page, /^PAYING 2 \/ 2$/i, "the pick pays for X = 2");
  expect((await paymentNow(page)).command).toMatchObject({ x: 2 });
  const pay = await waitForBoardText(page, /^pay$/i, "Pay is offered");
  await press(page, phone, pay.x, pay.y);

  // Choose the two schemes (X = 2): both lose 2.
  await waitFor(async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? true : null), "a choice", 8000);
  await settle(page);
  // "Select 2": X = 2 asks for two schemes, so both are picked before Confirm opens.
  // The sheet moves a picked card to the top, so each press reads the cards again and takes the next one down.
  const optionRects = async (): Promise<Rect[]> =>
    ((await hook<[string, Rect][]>(page, "__mcChoiceDebug", "allRects")) ?? [])
      .filter(([key]) => key.startsWith("option:"))
      .map(([, r]) => r)
      .sort((p, q) => p.y - q.y);
  expect((await optionRects()).length, "both schemes are offered").toBe(2);
  for (const place of [0, 1]) {
    const r = (await optionRects())[place]!;
    await press(page, phone, r.x + r.width / 2, r.y + r.height / 2);
    await settle(page);
  }
  await waitFor(
    async () =>
      (await visibleTexts(page)).some((t) => t.scene === "ChoiceOverlay" && /^selected 2$/i.test(t.text)) ? true : null,
    "both schemes are selected",
  );
  await clickText(page, "Confirm", { sceneKey: "ChoiceOverlay" });
  await settle(page);
  const after = await schemeThreat(page);
  const lost = Object.keys(before).filter((id) => (before[id] ?? 0) - (after[id] ?? 0) === 2);
  expect(lost.length, `two schemes each lost 2 threat ${JSON.stringify([before, after])}`).toBe(2);
  const total = (m: Record<string, number>) => Object.values(m).reduce((n, v) => n + v, 0);
  expect(total(before) - total(after)).toBe(4);
});
