import { expect, test, type Page } from "@playwright/test";
import { handInstanceFor, pressUntil, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { openApp, type Rect } from "./wave6-helpers-b.js";
import { SHOT, boardText, boardUp, playFromHand, press, waitForBoardText } from "./x-men-helpers.js";

/**
 * A pick panel with more cards than the screen holds scrolls (reported on Discord from an iPhone: Repurpose's "Discard
 * a Tech upgrade you control" listed every Tech upgrade in one column that ran off the bottom, so the wanted one could
 * not be reached). The dev game (`store/dev-repurpose-game.ts`) is a real game played forward to Iron Man in hero form
 * with seven Tech upgrades in play and Repurpose in hand. On a phone (an iPhone SE's 375x667) the list scrolls with a
 * finger, a swipe that lifts over a tile picks nothing (issue #227's rule), and the last card can then be picked; on
 * the desktop the seven fit in one row, and a tile shows the card hover popover.
 */

const REPURPOSE = "31016";

type Debug = {
  hitRect(id: string): Rect | null;
  hoverShown(): string | null;
};

const hitRect = (page: Page, id: string): Promise<Rect | null> =>
  page.evaluate((card) => (window as unknown as { __mcBoardDebug?: Debug }).__mcBoardDebug?.hitRect(card) ?? null, id);

const hoverShown = (page: Page): Promise<string | null> =>
  page.evaluate(() => (window as unknown as { __mcBoardDebug?: Debug }).__mcBoardDebug?.hoverShown() ?? null);

/** The cards the open pick offers, in the order the panel lists them. */
const offered = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const debug = (window as unknown as { __mcBoardDebug?: { pickView?: () => { ids: string[] } | null } })
      .__mcBoardDebug;
    return debug?.pickView?.()?.ids ?? [];
  });

/** Whether a card is in Iron Man's discard pile. */
const discarded = (page: Page, id: string): Promise<boolean> =>
  page.evaluate(async (card) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game?: { players: { discard: string[] }[] } } } };
    };
    return appSession().store.state.game?.players[0]?.discard.includes(card) ?? false;
  }, id);

/** A real finger drag over CDP (touchStart, moves, touchEnd), lifted at `to`. */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const steps = 12;
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(i), id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

async function startRepurposeGame(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    const games = (await import(/* @vite-ignore */ "/src/store/dev-repurpose-game.ts")) as unknown as {
      startRepurposeGame: (store: unknown) => Promise<void>;
    };
    await games.startRepurposeGame(appSession().store);
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
}

const QUESTION = /^Choose cards to discard$/i;
const PICKED_ONE = /^PICKED 1 /i;

test("Repurpose's pick of seven Tech upgrades: every card can be reached and picked", async ({ page }, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  // The smallest phone we check (an iPhone SE), where the reporter's list ran off the screen.
  if (phone) await page.setViewportSize({ width: 375, height: 667 });
  const size = page.viewportSize()!;
  const shot = (name: string) =>
    SHOT ? page.screenshot({ path: `${SHOT}/pick-panel-scroll-${info.project.name}-${name}.png` }) : null;
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startRepurposeGame(page);
  await boardUp(page);

  const card = (await handInstanceFor(page, REPURPOSE))!;
  expect(card, "Repurpose is in Iron Man's hand").not.toBeNull();
  await playFromHand(page, phone, card, async () => (await boardText(page, QUESTION)) !== undefined);
  await waitForBoardText(page, QUESTION, "the which-Tech-upgrade question");
  await settle(page, { quietMs: 400, maxMs: 4000 });
  const ids = await waitFor(async () => {
    const list = await offered(page);
    return list.length >= 7 ? list : null;
  }, "seven Tech upgrades offered");
  await shot("1-question");
  const last = ids[ids.length - 1]!;

  if (phone) {
    // The last card starts below the list's bottom edge: no part of it on screen, so it takes no tap there.
    expect(await hitRect(page, last), "the last Tech upgrade is scrolled out of the list").toBeNull();
    const first = (await hitRect(page, ids[0]!))!;
    // Swipe the list up and lift over a tile: it scrolls, and the lift picks nothing.
    await swipe(page, { x: size.width / 2, y: size.height - 120 }, { x: size.width / 2, y: first.y + 20 });
    await settle(page, { quietMs: 300, maxMs: 1500 });
    expect(await boardText(page, QUESTION), "the question is still open").toBeDefined();
    expect(await boardText(page, /^PICKED 0 /i), "a swipe that lifts over a tile picks nothing").toBeDefined();
    for (const id of ids) expect(await discarded(page, id), "nothing is discarded by the swipe").toBe(false);
    // Swiping again reaches the end of the list, where the last card is whole on screen.
    await swipe(page, { x: size.width / 2, y: size.height - 140 }, { x: size.width / 2, y: 200 });
    await settle(page, { quietMs: 300, maxMs: 1500 });
    const reached = await waitFor(async () => {
      const rect = await hitRect(page, last);
      return rect && rect.height > 60 && rect.y + rect.height <= size.height ? rect : null;
    }, "the last Tech upgrade scrolled into view");
    await shot("2-scrolled");
    await pressUntil(
      page,
      () => press(page, true, reached.x + reached.width / 2, reached.y + reached.height / 2),
      async () => (await boardText(page, PICKED_ONE)) !== undefined,
      "the last Tech upgrade is picked",
    );
  } else {
    // Seven fit in one row on the desktop: each is whole on screen, and a tile shows the card hover popover.
    for (const id of ids) {
      const rect = (await hitRect(page, id))!;
      expect(rect, `a tile for ${id}`).not.toBeNull();
      expect(rect.y + rect.height).toBeLessThanOrEqual(size.height);
      expect(rect.x + rect.width).toBeLessThanOrEqual(size.width);
    }
    const rect = (await hitRect(page, last))!;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 3, { steps: 6 });
    await page.mouse.move(rect.x + rect.width / 2 + 3, rect.y + rect.height / 3 + 3, { steps: 2 });
    await waitFor(async () => ((await hoverShown(page)) === last ? true : null), "the popover on the last tile");
    await shot("2-hover");
    await pressUntil(
      page,
      () => press(page, false, rect.x + rect.width / 2, rect.y + rect.height / 2),
      async () => (await boardText(page, PICKED_ONE)) !== undefined,
      "the last Tech upgrade is picked",
    );
  }
  await shot("3-picked");
  await pressUntil(
    page,
    async () => {
      const confirm = await boardText(page, /^confirm$/i);
      if (confirm) await press(page, phone, confirm.x, confirm.y);
    },
    async () => (await boardText(page, QUESTION)) === undefined,
    "Confirm discards the picked Tech upgrade",
    { minWaitMs: 2000 },
  );
  await expect.poll(() => discarded(page, last), { timeout: 45_000 }).toBe(true);
  for (const id of ids.slice(0, -1)) expect(await discarded(page, id), "only the picked one is discarded").toBe(false);
  await shot("4-repurposed");
  expect(errors).toEqual([]);
});
