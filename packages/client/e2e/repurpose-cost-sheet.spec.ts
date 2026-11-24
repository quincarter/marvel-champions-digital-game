import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, handInstanceFor, pressUntil, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { openApp, type Rect } from "./wave6-helpers-b.js";
import { SHOT, boardUp, playFromHand, press } from "./x-men-helpers.js";

/**
 * Issue #991 (GarethMagis on Discord, from an iPhone): Repurpose's "Discard a Tech upgrade you control" listed every
 * Tech upgrade in a column that ran off the screen, so the wanted one could not be reached. The cost is now asked on the
 * decision sheet, like any other decision: full card faces, the source card, Peek at table and Back out, and a grid that
 * scrolls. The dev game (`store/dev-repurpose-game.ts`) is a real game played forward to Iron Man in hero form with
 * seven Tech upgrades in play and Repurpose in hand. On an iPhone SE's 375x667 the grid scrolls with a finger, a swipe
 * that lifts over a card picks nothing (issue #227's rule), and the last card can then be picked; on the desktop a card
 * face shows the card hover popover. Confirm discards the picked card; Back out drops the play.
 */

const REPURPOSE = "31016";

type ChoiceDebug = {
  allRects(): [string, Rect | null][];
  scrollOffset(): number;
  hoverRects(): [string, Rect][];
  hoverShown(): string | null;
};

const choiceDebug = <T>(page: Page, read: string): Promise<T> =>
  page.evaluate(
    (body) =>
      new Function("d", `return d ? ${body} : null`)(
        (window as unknown as { __mcChoiceDebug?: ChoiceDebug }).__mcChoiceDebug,
      ),
    read,
  ) as Promise<T>;

const rects = async (page: Page): Promise<Map<string, Rect>> =>
  new Map(
    ((await choiceDebug<[string, Rect | null][]>(page, "d.allRects()")) ?? []).filter(([, r]) => r) as [string, Rect][],
  );

/** The cards the sheet offers, from the Board's own question (`view/local-choice.ts`). */
const offered = (page: Page): Promise<string[]> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __mcBoardDebug?: { localChoiceOptions(): string[] } }
      ).__mcBoardDebug?.localChoiceOptions() ?? [],
  );

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

const sheetUp = async (page: Page): Promise<boolean> => (await activeScenes(page)).includes("ChoiceOverlay");

/** Plays Repurpose and waits for its cost question on the sheet; returns the offered cards. */
async function openQuestion(page: Page, phone: boolean): Promise<string[]> {
  const card = (await handInstanceFor(page, REPURPOSE))!;
  expect(card, "Repurpose is in Iron Man's hand").not.toBeNull();
  await playFromHand(page, phone, card, () => sheetUp(page));
  const ids = await waitFor(async () => {
    const list = await offered(page);
    return list.length >= 7 ? list : null;
  }, "seven Tech upgrades offered on the sheet");
  await waitFor(async () => ((await rects(page)).has(`option:${ids[0]}`) ? true : null), "the sheet's cards drawn");
  await settle(page, { quietMs: 400, maxMs: 4000 });
  return ids;
}

const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

test("Repurpose asks which Tech upgrade on the decision sheet: every card can be reached and picked", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  // The smallest phone we check (an iPhone SE), where the reporter's list ran off the screen.
  if (phone) await page.setViewportSize({ width: 375, height: 667 });
  const size = page.viewportSize()!;
  const shot = (name: string) =>
    SHOT ? page.screenshot({ path: `${SHOT}/repurpose-sheet-${info.project.name}-${name}.png` }) : null;
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startRepurposeGame(page);
  await boardUp(page);

  // Back out drops the play: the sheet closes and nothing is discarded.
  let ids = await openQuestion(page, phone);
  await shot("1-question");
  const [backOut] = await findText(page, "BACK OUT", "ChoiceOverlay");
  expect(backOut, "the sheet offers Back out").toBeDefined();
  {
    await press(page, phone, backOut!.x + backOut!.w / 2, backOut!.y + backOut!.h / 2);
    await waitFor(async () => ((await sheetUp(page)) ? null : true), "Back out closes the sheet");
    for (const id of ids) expect(await discarded(page, id), "Back out discards nothing").toBe(false);
    await settle(page, { quietMs: 400, maxMs: 3000 });
    ids = await openQuestion(page, phone);
  }
  const last = ids[ids.length - 1]!;
  const confirmRect = async () => (await rects(page)).get("confirm") ?? null;

  if (phone) {
    // Swipe up over the grid and lift over a card: the grid scrolls when it has more below, and the lift picks nothing.
    const first = (await rects(page)).get(`option:${ids[0]}`)!;
    await swipe(
      page,
      { x: size.width / 2, y: Math.min(size.height - 160, first.y + first.height + 120) },
      centre(first),
    );
    await settle(page, { quietMs: 300, maxMs: 1500 });
    expect(await sheetUp(page), "the question is still open").toBe(true);
    const confirm = await confirmRect();
    // Nothing is picked, so Confirm waits: pressing it changes nothing.
    if (confirm) await press(page, true, centre(confirm).x, centre(confirm).y);
    await settle(page, { quietMs: 300, maxMs: 1500 });
    expect(await sheetUp(page), "a swipe that lifts over a card picks nothing, so Confirm sends nothing").toBe(true);
    for (const id of ids) expect(await discarded(page, id)).toBe(false);
    // Swipe on to the end of the grid, where the last card is whole on screen.
    const reached = await waitFor(async () => {
      const r = (await rects(page)).get(`option:${last}`);
      if (r && r.y >= 0 && r.y + r.height <= size.height - 60) return r;
      await swipe(page, { x: size.width / 2, y: size.height - 200 }, { x: size.width / 2, y: 200 });
      await settle(page, { quietMs: 300, maxMs: 1500 });
      return null;
    }, "the last Tech upgrade scrolled into view");
    await shot("2-scrolled");
    await press(page, true, centre(reached).x, centre(reached).y);
  } else {
    const hover = new Map((await choiceDebug<[string, Rect][]>(page, "d.hoverRects()")) ?? []);
    const face = hover.get(last) ?? (await rects(page)).get(`option:${last}`)!;
    await page.mouse.move(centre(face).x, centre(face).y, { steps: 6 });
    await page.mouse.move(centre(face).x + 3, centre(face).y + 3, { steps: 2 });
    await waitFor(
      async () => ((await choiceDebug<string | null>(page, "d.hoverShown()")) === last ? true : null),
      "the hover popover on the last card",
    );
    await shot("2-hover");
    const r = (await rects(page)).get(`option:${last}`)!;
    await press(page, false, centre(r).x, centre(r).y);
  }
  await settle(page, { quietMs: 300, maxMs: 1500 });
  await shot("3-picked");
  await pressUntil(
    page,
    async () => {
      const confirm = await confirmRect();
      if (confirm) await press(page, phone, centre(confirm).x, centre(confirm).y);
    },
    async () => (await offered(page)).length === 0,
    "Confirm sends the picked Tech upgrade",
    { minWaitMs: 2000 },
  );
  // The play goes on: the picked upgrade is discarded as the cost, and Repurpose's own "choose THW, ATK, or DEF" follows.
  await expect.poll(() => discarded(page, last), { timeout: 45_000 }).toBe(true);
  for (const id of ids.slice(0, -1)) expect(await discarded(page, id), "only the picked one is discarded").toBe(false);
  await waitFor(
    async () => ((await findText(page, "ATK", "ChoiceOverlay")).length > 0 ? true : null),
    "THW, ATK or DEF",
  );
  await shot("4-repurposed");
  expect(errors).toEqual([]);
});
