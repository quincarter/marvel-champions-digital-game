import { expect, test, type Page } from "@playwright/test";
import { activeScenes, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";
import { boardUp, facts, startDevGame } from "./x-men-helpers.js";

/**
 * Controller and keyboard on the last screens of the pass:
 * - The opening hand ("Setting up the table"): Down from ANY hand card reaches Mulligan / Keep (they sit under only
 *   the left cards), Up returns to the card it came from, Y and E inspect the focused card and B closes the sheet, A
 *   marks a card for the mulligan, Start keeps the hand.
 * - The discard pile fan: the D-pad walks the cards, Y inspects, B closes Inspect and then the pile.
 * - The Rules reference: every glossary term is a stop, LB / RB step the tabs.
 */

const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const A = 0;
const B = 1;
const Y = 3;
const LB = 4;
const RB = 5;
const START = 9;
const UP = 12;
const DOWN = 13;
const LEFT = 14;
const RIGHT = 15;

async function installPad(page: Page): Promise<void> {
  await page.addInitScript((id) => {
    const button = () => ({ pressed: false, touched: false, value: 0 });
    const pad = {
      connected: true,
      id,
      index: 0,
      mapping: "standard",
      timestamp: 0,
      buttons: Array.from({ length: 17 }, button),
      axes: [0, 0, 0, 0],
    };
    (window as unknown as { __fakePad: unknown }).__fakePad = pad;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => {
        pad.timestamp = performance.now();
        return [pad];
      },
      configurable: true,
    });
  }, PAD_ID);
}

async function setButton(page: Page, index: number, on: boolean): Promise<void> {
  await page.evaluate(
    ([i, down]) => {
      const pad = (window as unknown as { __fakePad: { buttons: unknown[] } }).__fakePad;
      pad.buttons[i as number] = { pressed: down, touched: down, value: down ? 1 : 0 };
    },
    [index, on] as const,
  );
}

/** Holds a button until `done` (the pad is read once a frame, and a short hold can fall between two reads). */
async function press(page: Page, index: number, done?: () => Promise<boolean>): Promise<void> {
  await setButton(page, index, true);
  if (!done) await page.waitForTimeout(450);
  else {
    for (let i = 0; i < 40; i += 1) {
      await page.waitForTimeout(100);
      if (await done()) break;
    }
  }
  await setButton(page, index, false);
  await page.waitForTimeout(300);
}

const sceneIs = (page: Page, key: string) => async () => (await activeScenes(page)).includes(key);
const sceneGone = (page: Page, key: string) => async () => !(await activeScenes(page)).includes(key);

const focusOf = (page: Page, scene: string): Promise<string | null> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusState?: Record<string, () => { focus: string | null }> }).__mcFocusState?.[
        key
      ]?.().focus ?? null,
    scene,
  );

const stopsOf = (page: Page, scene: string): Promise<string[]> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusRoutes?: Record<string, () => { key: string }[]> }).__mcFocusRoutes?.[
        key
      ]?.().map((stop) => stop.key) ?? [],
    scene,
  );

interface SetupDebug {
  focus(): string | null;
  route(): string[];
  selected(): string[];
}
const setup = <T>(page: Page, read: (debug: SetupDebug) => T): Promise<T | null> =>
  page.evaluate(
    ([source]) => {
      const debug = (window as unknown as { __mcSetupDealDebug?: SetupDebug }).__mcSetupDealDebug;
      return debug ? (new Function("debug", `return (${source})(debug)`)(debug) as never) : null;
    },
    [read.toString()] as const,
  );

async function wake(page: Page): Promise<void> {
  // The left trigger does nothing alone: it wakes the pad plugin without moving focus.
  await press(page, 6);
  await waitFor(sceneGone(page, "PadToast"), "the pad note is gone", 30_000);
}

test.describe("the opening hand with a controller", () => {
  for (const size of [
    { name: "desktop", width: 1280, height: 800 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    test(`${size.name}: Down from any card reaches Mulligan or Keep, Up returns, Y / E inspect, A selects, Start keeps`, async ({
      page,
    }) => {
      test.setTimeout(240_000);
      const errors = trackPageErrors(page);
      await page.setViewportSize({ width: size.width, height: size.height });
      await installPad(page);
      await openApp(page, "screen=setup-deal", { landing: "SetupDeal" });
      await waitFor(async () => ((await setup(page, (d) => d.route().length)) ?? 0) > 3, "the hand is dealt", 60_000);
      await wake(page);
      const cards = (await setup(page, (d) => d.route().filter((key) => key.startsWith("option:"))))!;
      expect(cards.length).toBeGreaterThanOrEqual(5);

      // Walk right to the LAST card (past the third), whatever the scroll of a strip.
      const last = cards.at(-1)!;
      for (let i = 0; i < cards.length + 3 && (await setup(page, (d) => d.focus())) !== last; i += 1) {
        const before = await setup(page, (d) => d.focus());
        await press(page, RIGHT, async () => (await setup(page, (d) => d.focus())) !== before);
      }
      expect(await setup(page, (d) => d.focus())).toBe(last);

      // Down reaches the commit row from the last card; Up comes back to it.
      await press(page, DOWN, async () => ["confirm", "decline"].includes((await setup(page, (d) => d.focus())) ?? ""));
      expect(["confirm", "decline"]).toContain(await setup(page, (d) => d.focus()));
      await press(page, UP, async () => (await setup(page, (d) => d.focus())) === last);
      expect(await setup(page, (d) => d.focus())).toBe(last);

      // Y inspects the card, B closes the sheet and leaves the hand up; E and Escape do the same.
      await press(page, Y, sceneIs(page, "InspectOverlay"));
      expect(await sceneIs(page, "InspectOverlay")()).toBe(true);
      await press(page, B);
      await waitFor(sceneGone(page, "InspectOverlay"), "B closes Inspect", 10_000);
      expect(await sceneIs(page, "SetupDeal")()).toBe(true);
      await page.keyboard.press("e");
      await waitFor(sceneIs(page, "InspectOverlay"), "E inspects", 10_000);
      await page.keyboard.press("Escape");
      await waitFor(sceneGone(page, "InspectOverlay"), "Escape closes Inspect", 10_000);
      await waitFor(sceneGone(page, "PadToast"), "the pad note is gone", 30_000);

      // A marks the focused card for the mulligan.
      await press(page, A, async () => ((await setup(page, (d) => d.selected().length)) ?? 0) === 1);
      expect(await setup(page, (d) => d.selected())).toContain(last.slice("option:".length));

      // Start keeps the hand as dealt: the card marked above is dropped and the step moves on (the next seat's hand,
      // or past setup), so nothing stays marked.
      await press(page, START);
      await waitFor(
        async () => !(await sceneIs(page, "SetupDeal")()) || (await setup(page, (d) => d.selected().length)) === 0,
        "Start keeps the hand",
        30_000,
      );
      expect(errors).toEqual([]);
    });
  }
});

test("the discard pile fan: the D-pad walks the cards, Y inspects, B closes Inspect and then the pile", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = trackPageErrors(page);
  await installPad(page);
  await openApp(page);
  await startDevGame(page, "startUncannyDevGame");
  await boardUp(page);
  const hand = await facts(page, (game) => game.players[0].hand as string[]);
  await page.evaluate(
    (ids) =>
      (
        window as unknown as { __mcGame: { scene: { start: (key: string, data: unknown) => void } } }
      ).__mcGame.scene.start("PileViewOverlay", { from: "Board", name: "Discard pile", ids }),
    hand,
  );
  await waitFor(sceneIs(page, "PileViewOverlay"), "the pile is up", 30_000);
  await waitFor(async () => (await stopsOf(page, "PileViewOverlay")).length > 3, "cards are stops", 30_000);
  const stops = await stopsOf(page, "PileViewOverlay");
  expect(stops[0]).toBe("close");
  expect(stops.filter((key) => key.startsWith("card:")).length).toBe(hand.length);
  await wake(page);

  // Down reaches the cards (the nearest to Close first), Left walks along the row, Right goes back out to Close.
  await press(page, DOWN, async () => (await focusOf(page, "PileViewOverlay")) !== null);
  if ((await focusOf(page, "PileViewOverlay")) === "close")
    await press(page, DOWN, async () => ((await focusOf(page, "PileViewOverlay")) ?? "").startsWith("card:"));
  const first = await focusOf(page, "PileViewOverlay");
  expect(first).toMatch(/^card:/);
  await press(page, LEFT, async () => (await focusOf(page, "PileViewOverlay")) !== first);
  const second = await focusOf(page, "PileViewOverlay");
  expect(second).toMatch(/^card:/);
  expect(second).not.toBe(first);
  await press(page, Y, sceneIs(page, "InspectOverlay"));
  expect(await sceneIs(page, "InspectOverlay")()).toBe(true);
  await press(page, B);
  await waitFor(sceneGone(page, "InspectOverlay"), "B closes Inspect", 10_000);
  expect(await sceneIs(page, "PileViewOverlay")()).toBe(true);
  await press(page, B);
  await waitFor(sceneGone(page, "PileViewOverlay"), "B closes the pile", 15_000);
  expect(errors).toEqual([]);
});

test("the Rules reference: the glossary's terms are stops and LB / RB step the tabs", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackPageErrors(page);
  await installPad(page);
  await openApp(page, "screen=rules&unlock=all", { landing: "RulesOverlay" });
  await waitFor(async () => (await stopsOf(page, "RulesOverlay")).length > 5, "stops are up", 60_000);
  const stops = await stopsOf(page, "RulesOverlay");
  expect(stops.filter((key) => key.startsWith("row:entry:")).length).toBeGreaterThan(3);
  await wake(page);
  await press(page, RB, async () => (await focusOf(page, "RulesOverlay")) === "tab:villainPhase");
  expect(await focusOf(page, "RulesOverlay")).toBe("tab:villainPhase");
  await waitFor(
    async () => (await stopsOf(page, "RulesOverlay")).some((key) => key.startsWith("row:step:")),
    "the steps are stops",
    15_000,
  );
  await press(page, LB, async () => (await focusOf(page, "RulesOverlay")) === "tab:glossary");
  expect(await focusOf(page, "RulesOverlay")).toBe("tab:glossary");
  await press(page, B, sceneGone(page, "RulesOverlay"));
  await waitFor(sceneGone(page, "RulesOverlay"), "B leaves the Rules reference", 30_000);
  expect(errors).toEqual([]);
});
