import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, handInstanceFor, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { answerChoice, declineMulligans, openApp } from "./wave6-helpers-b.js";
import {
  boardText,
  bringIntoView,
  facts,
  idsOf,
  playFromHand,
  press,
  pressCard,
  waitForBoardText,
} from "./x-men-helpers.js";

/**
 * Overpaying from the board (docs/phase7-wave10-client.md C14), with Wonder Man's starter deck (`wonder-man-justice`)
 * against Rhino. Two things the payment bar used to hide:
 * - Mr. Hollywood (58009) is a resource that can only overpay. He is tagged "overpay only" in the payment strip, held
 *   until the cost is covered by other cards, and what he adds is counted in "Overpaid by".
 * - Active Altruism (58003) costs 0, so it once played with no pay step and could never be overpaid. It now offers
 *   the pay step, whose plain default reads "Play without overpaying", and one [energy] overpaid removes 3 threat, not 1.
 * Setup (flip, Mr. Hollywood into play) is sent through the store; everything under test is real pointer input.
 */

const HOLLYWOOD = "58009";
const ALTRUISM = "58003"; // cost 0
const BLAST = "58004"; // cost 1
const ENERGY = "58023"; // 2 [energy]
const FILLER = "58016"; // Battlefield Benevolence: 1 [physical]

const threat = (page: Page): Promise<number> =>
  facts(page, (game) =>
    Object.values(game.instances as Record<string, { threat?: number }>).reduce((n, i) => n + (i.threat ?? 0), 0),
  );

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
      stack: {
        players: { 0: ["58009", "58003", "58023", "58004", "58016", "58017"] },
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
  // Flip to hero form, then put Mr. Hollywood into play paid with the filler: the same commands the buttons send.
  await page.evaluate(
    async ([hollywood, filler]) => {
      const { appSession } = (await import("/src/session.ts")) as unknown as {
        appSession: () => {
          store: {
            dispatch: (c: unknown) => Promise<void>;
            state: {
              game?: { players: { hand: string[] }[]; instances: Record<string, { cardId: string }> };
              legal?: { actions: { legal?: { action: { kind: string; instanceId?: string }; example: any }[] } };
            };
          };
        };
      };
      const { store } = appSession();
      const flip = store.state.legal?.actions.legal?.find((e) => e.action.kind === "changeForm");
      if (flip) await store.dispatch(flip.example);
      const game = store.state.game!;
      const of = (code: string) => game.players[0]!.hand.find((id) => game.instances[id]?.cardId === code)!;
      const play = store.state.legal?.actions.legal?.find(
        (e) => e.action.kind === "playCard" && e.action.instanceId === of(hollywood),
      );
      await store.dispatch({ ...play!.example, payment: [{ fromHand: of(filler) }] });
    },
    [HOLLYWOOD, FILLER] as const,
  );
  // End round 1 (answering whatever the villain phase asks) so Bomb Scare is out with threat to thwart in round 2.
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
    const end = store.state.legal?.actions.legal?.find((e) => e.action.kind === "endTurn");
    await store.dispatch(end!.example);
    await nextTurn(store);
  });
  await settle(page);
}

const sourcesNow = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __mcBoardDebug: { paymentView(): { sources: { instanceId: string; spent: boolean }[] } };
        }
      ).__mcBoardDebug.paymentView().sources,
  );

const choiceUp = async (page: Page): Promise<boolean> => {
  try {
    await waitFor(async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? true : null), "a choice", 4000);
    return true;
  } catch {
    return false;
  }
};

test("Wonder Man: Mr. Hollywood overpays only once the cost is covered, and Active Altruism can be overpaid at cost 0", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await setup(page);
  // The villain phase recap that ends round 1 comes up over the board; dismiss it.
  await waitFor(async () => ((await activeScenes(page)).includes("VillainPhaseOverlay") ? true : null), "recap", 15000);
  await settle(page);
  await clickText(page, "Continue", { sceneKey: "VillainPhaseOverlay" });
  await waitFor(
    async () => (!(await activeScenes(page)).includes("VillainPhaseOverlay") ? true : null),
    "recap closes",
  );
  await settle(page);
  const [hollywood] = await idsOf(page, HOLLYWOOD, "play");
  expect(hollywood, "Mr. Hollywood is in play").toBeDefined();

  // A card that costs 1: Mr. Hollywood is tagged, and held until the cost is covered.
  const blast = (await handInstanceFor(page, BLAST))!;
  await playFromHand(page, phone, blast, async () => (await boardText(page, /^PAYING/i)) !== undefined);
  await waitForBoardText(page, /^overpay only$/i, "Mr. Hollywood is tagged as an overpay-only source");
  await waitForBoardText(page, /Only to overpay/i, "the bar says why he is held");
  await pressCard(page, phone, hollywood!);
  expect((await sourcesNow(page)).find((s) => s.instanceId === hollywood)?.spent).toBe(false);

  // Cover the cost with Energy; now he can be picked, and the bar counts him as overpaid.
  const energy = (await handInstanceFor(page, ENERGY))!;
  await bringIntoView(page, `card:${energy}`);
  await pressCard(page, phone, energy);
  await pressCard(page, phone, hollywood!);
  expect((await sourcesNow(page)).find((s) => s.instanceId === hollywood)?.spent).toBe(true);
  await waitForBoardText(page, /Overpaid by 2/i, "Energy's extra and Mr. Hollywood's are both overpaid");
  const pay = await waitForBoardText(page, /^pay$/i, "Pay is offered");
  await press(page, phone, pay.x, pay.y);
  if (await choiceUp(page)) await answerChoice(page, 0);
  await settle(page);

  // A cost-0 card that reads overpaid.*: the pay step is offered with the plain default, and Mr. Hollywood overpays it.
  const before = await threat(page);
  expect(before, "a scheme holds enough threat to show 3 removed").toBeGreaterThanOrEqual(3);
  const altruism = (await handInstanceFor(page, ALTRUISM))!;
  await playFromHand(page, phone, altruism, async () => (await boardText(page, /^PAYING/i)) !== undefined);
  await waitForBoardText(page, /^Play without overpaying$/i, "the plain default is offered at cost 0");
  await pressCard(page, phone, hollywood!);
  await waitForBoardText(page, /Overpaid by 1/i, "Mr. Hollywood's energy is overpaid");
  const confirm = await waitForBoardText(page, /^pay$/i, "Pay replaces the plain default once something is picked");
  await press(page, phone, confirm.x, confirm.y);
  // The scheme to thwart: Bomb Scare (second), the one with enough threat to show the extra 2 removed.
  await answerChoice(page, 1);
  await settle(page);
  expect(before - (await threat(page)), "1 threat plus 2 for the [energy] overpaid").toBe(3);
});
