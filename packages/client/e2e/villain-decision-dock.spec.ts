import { expect, test, type Page } from "@playwright/test";
import { pressAt, settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { answerChoiceSheet, installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #231: a revealed encounter card that makes the player choose (Hydra Bomber's "take 2 damage or place 1 threat",
 * here Eviction Notice's "flip or stay") put a full-screen sheet over the table, so the player could not look at the
 * battlefield before choosing. Now the decision docks in the villain phase's own panel beside the table, with HIDE ▸ on
 * desktop and tablet and PEEK AT TABLE ▾ on a phone to see the whole table, and EXPAND for the old full-screen sheet.
 * Played from the `?screen=villain-decision` jump: a real Rhino/Spider-Man game whose round-one villain phase reveals
 * Eviction Notice.
 */

const sheetShown = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const game = (
      window as unknown as {
        __mcGame: { scene: { getScene(k: string): { sys: { isActive(): boolean; settings: { visible: boolean } } } } };
      }
    ).__mcGame;
    const sheet = game.scene.getScene("ChoiceOverlay");
    return sheet.sys.isActive() && sheet.sys.settings.visible;
  });

const presentation = (page: Page): Promise<string | null> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __mcVillainPhaseDebug?: { presentation?: () => string } }
      ).__mcVillainPhaseDebug?.presentation?.() ?? null,
  );

/** The choice sheet's own option rects, on screen. */
const sheetOptionRects = (page: Page): Promise<Rect[]> =>
  page.evaluate(() => {
    const dbg = (window as unknown as { __mcChoiceDebug?: { allRects(): (readonly [string, Rect | null])[] } })
      .__mcChoiceDebug;
    return (dbg?.allRects() ?? [])
      .filter(([key, rect]) => key.startsWith("option:") && rect !== null)
      .map(([, rect]) => rect as Rect);
  });

const pendingChoiceId = (page: Page): Promise<string | null> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __mcBoardDebug?: { pendingChoice(): { choiceId: string } | null } }
      ).__mcBoardDebug?.pendingChoice()?.choiceId ?? null,
  );

const press = async (page: Page, phone: boolean, rect: Rect): Promise<void> => {
  // A control drawn this frame takes presses from the next one: let the screen settle first.
  await settle(page);
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (phone) await page.touchscreen.tap(x, y);
  else await pressAt(page, x, y);
  await settle(page);
};

/** A finger (phone) or mouse (desktop) drag from `from` to `to`, lifted at `to`. */
async function drag(page: Page, phone: boolean, from: { x: number; y: number }, to: { x: number; y: number }) {
  const steps = 10;
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  if (!phone) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(i), id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x - 1 &&
  inner.y >= outer.y - 1 &&
  inner.x + inner.width <= outer.x + outer.width + 1 &&
  inner.y + inner.height <= outer.y + outer.height + 1;

/** Opens the jump with Auto-advance off (the game's default), starts the phase, and presses ANSWER on the decision. */
async function reachDockedDecision(page: Page, phone: boolean): Promise<Rect> {
  await page.addInitScript(() =>
    localStorage.setItem("mc-settings", JSON.stringify({ version: 1, villainAutoAdvance: "off" })),
  );
  await installWave6Helpers(page);
  await page.goto("/?screen=villain-decision");
  const start = await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
  await press(page, phone, start);
  const answer = await waitFor(() => villainDebugRect(page, "answerRect"), "the revealed card's notice", 30_000);
  expect(await sheetShown(page), "the decision waits behind ANSWER").toBe(false);
  await press(page, phone, answer);
  const dock = await waitFor(() => villainDebugRect(page, "decisionDockRect"), "the docked decision", 15_000);
  await waitFor(async () => ((await sheetShown(page)) ? true : null), "the sheet in the dock", 10_000);
  return dock;
}

test("issue #231: a revealed card's decision docks beside the table, tucks away to show it all, and is answered there", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  const dock = await reachDockedDecision(page, phone);

  // The sheet sits in the dock, its options with it: nothing of it covers the table beside the phase.
  expect(await presentation(page)).toBe(phone ? "tab" : "rail");
  const options = await waitFor(
    async () => {
      const rects = await sheetOptionRects(page);
      return rects.length >= 2 ? rects : null;
    },
    "the decision's options",
    10_000,
  );
  for (const rect of options) expect(inside(rect, dock), "an option inside the dock").toBe(true);
  if (SHOT) await page.screenshot({ path: `${SHOT}/villain-decision-dock-${info.project.name}.png` });

  // HIDE ▸ (desktop) or PEEK AT TABLE ▾ (phone): the whole table, the sheet hidden, a way back.
  const tuck = (await villainDebugRect(page, "tuckRect"))!;
  await press(page, phone, tuck);
  await waitFor(
    async () => ((await presentation(page)) === (phone ? "peek" : "hidden") ? true : null),
    "the decision tucked away",
    10_000,
  );
  expect(await sheetShown(page), "the sheet hides with the phase").toBe(false);
  if (SHOT) await page.screenshot({ path: `${SHOT}/villain-decision-tucked-${info.project.name}.png` });
  const back = await waitFor(
    () => villainDebugRect(page, phone ? "answerRect" : "showRect"),
    phone ? "ANSWER on the peek banner" : "the villain phase handle",
    10_000,
  );
  await press(page, phone, back);
  await waitFor(() => villainDebugRect(page, "decisionDockRect"), "the decision back in the dock", 10_000);
  await waitFor(async () => ((await sheetShown(page)) ? true : null), "the sheet back in the dock", 10_000);

  // Answered in the dock: the decision leaves the state and the phase goes on.
  const before = await pendingChoiceId(page);
  await answerChoiceSheet(page);
  await waitFor(async () => ((await pendingChoiceId(page)) !== before ? true : null), "the decision answered", 15_000);
  expect(errors).toEqual([]);
});

test("issue #231: EXPAND on a docked decision brings the full-screen sheet", async ({ page }, info) => {
  test.setTimeout(150_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await reachDockedDecision(page, phone);
  await press(page, phone, (await villainDebugRect(page, "expandRect"))!);
  await waitFor(
    async () => ((await villainDebugRect(page, "decisionDockRect")) ? null : true),
    "the dock handed back",
    10_000,
  );
  expect(await sheetShown(page), "the full-screen sheet").toBe(true);
  // Full screen: the sheet's options are no longer confined to the phase's panel.
  const options = await sheetOptionRects(page);
  expect(options.length).toBeGreaterThanOrEqual(2);
  await answerChoiceSheet(page);
  expect(errors).toEqual([]);
});

test("issue #231: a swipe that lifts on PEEK AT TABLE or EXPAND presses neither", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a finger's swipe is a phone's");
  test.setTimeout(150_000);
  const errors = trackErrors(page);
  const dock = await reachDockedDecision(page, true);
  for (const name of ["tuckRect", "expandRect"]) {
    const control = (await villainDebugRect(page, name))!;
    const y = control.y + control.height / 2;
    // From inside the docked sheet, up and across onto the control.
    await drag(page, true, { x: dock.x + 40, y: dock.y + dock.height / 2 }, { x: control.x + control.width / 2, y });
    await settle(page);
    expect(await presentation(page), `a swipe that lifted on ${name} changed nothing`).toBe("tab");
    expect(await villainDebugRect(page, "decisionDockRect"), "still docked").not.toBeNull();
  }
  expect(errors).toEqual([]);
});

test("issue #231: on desktop the table beside a docked decision keeps its card hover", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "hover is a mouse's");
  test.setTimeout(150_000);
  const errors = trackErrors(page);
  const dock = await reachDockedDecision(page, false);
  // A card in the hand, left of the dock: the table's own popover opens over it.
  const target = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game?: { players: { hand: string[] }[] } } } };
    };
    const hand = appSession().store.state.game?.players[0]?.hand ?? [];
    const dbg = (window as unknown as { __mcBoardDebug?: { hitRect(id: string): Rect | null } }).__mcBoardDebug;
    for (const id of hand) {
      const rect = dbg?.hitRect(id) ?? null;
      if (rect) return { id, rect };
    }
    return null;
  });
  expect(target, "a hand card on the table").not.toBeNull();
  expect(target!.rect.x + target!.rect.width).toBeLessThan(dock.x);
  await settle(page);
  const x = target!.rect.x + target!.rect.width / 2;
  const y = target!.rect.y + target!.rect.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.move(x + 4, y + 4, { steps: 4 });
  const shown = await waitFor(
    () =>
      page.evaluate(
        () =>
          (window as unknown as { __mcBoardDebug?: { hoverShown(): string | null } }).__mcBoardDebug?.hoverShown() ??
          null,
      ),
    "the table's hover popover",
    10_000,
  );
  expect(shown).toContain(target!.id);
  if (SHOT) await page.screenshot({ path: `${SHOT}/villain-decision-hover-desktop.png` });
  expect(errors).toEqual([]);
});
