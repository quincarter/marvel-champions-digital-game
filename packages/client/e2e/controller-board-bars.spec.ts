import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickFocus, focusRect, pressAt, settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, startGame, type Rect } from "./wave6-helpers-b.js";

/**
 * A pad alone can pay, cancel, start the villain phase and confirm a defender (the owner's Bazzite report,
 * 2026-10-24): the mode bar's buttons are focus stops (`scenes/board/bar-stops.ts`), Start presses the bar's forward
 * button, B backs out, and the villain phase starts on A. The glyphs on those buttons are checked in place.
 */

const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const A = 0;
const B = 1;
const START = 9;
const VIEW = 8;
const UP = 12;
const RIGHT = 15;

async function installPad(page: Page): Promise<void> {
  await page.addInitScript((id) => {
    const pad = {
      connected: true,
      id,
      index: 0,
      mapping: "standard",
      timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
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

async function setButton(page: Page, index: number, down: boolean): Promise<void> {
  await page.evaluate(
    ([i, on]) => {
      const pad = (window as unknown as { __fakePad: { buttons: unknown[] } }).__fakePad;
      pad.buttons[i as number] = { pressed: on as boolean, touched: on as boolean, value: on ? 1 : 0 };
    },
    [index, down] as const,
  );
}

/** Waits for `count` drawn frames, so the game has stepped over what the page just changed. */
const frames = (page: Page, count: number): Promise<void> =>
  page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let seen = 0;
        const tick = (): void => {
          seen += 1;
          if (seen >= n) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    count,
  );

/** One press of a pad button: down until the page reads it and the game has stepped, then up and stepped again. */
async function padTap(page: Page, index: number): Promise<void> {
  await setButton(page, index, true);
  await page.waitForFunction((i) => navigator.getGamepads()[0]?.buttons[i]?.pressed === true, index);
  await frames(page, 8);
  await setButton(page, index, false);
  await page.waitForFunction((i) => navigator.getGamepads()[0]?.buttons[i]?.pressed === false, index);
  await frames(page, 8);
}

const focusedKey = (page: Page): Promise<string | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcBoardDebug?: { focusedKey(): string | null } }).__mcBoardDebug?.focusedKey() ?? null,
  );

const paymentOpen = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => (window as unknown as { __mcBoardDebug?: { paymentView(): unknown } }).__mcBoardDebug?.paymentView() != null,
  );

const paymentReady = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const v = (
      window as unknown as { __mcBoardDebug?: { paymentView(): { command: unknown } | null } }
    ).__mcBoardDebug?.paymentView();
    return v != null && v.command !== null;
  });

/** True when a glyph cell reading `text` is drawn near `rect` in `sceneKey` (visible, through every parent). */
async function glyphIn(page: Page, sceneKey: string, text: string, rect: Rect): Promise<boolean> {
  return page.evaluate(
    ([key, wanted, r]) => {
      const game = (
        window as unknown as { __mcGame: { scene: { getScene(k: string): { children: { list: unknown[] } } } } }
      ).__mcGame;
      type Node = {
        visible?: boolean;
        alpha?: number;
        text?: string;
        list?: Node[];
        getBounds?: () => { x: number; y: number; width: number; height: number };
      };
      const box = r as Rect;
      let found = false;
      const walk = (nodes: Node[], shown: boolean): void => {
        for (const node of nodes) {
          const vis = shown && node.visible !== false && (node.alpha ?? 1) > 0.05;
          if (node.text === wanted && vis && node.getBounds) {
            const b = node.getBounds();
            const cx = b.x + b.width / 2;
            const cy = b.y + b.height / 2;
            if (cx >= box.x - 4 && cx <= box.x + box.width + 4 && cy >= box.y - 24 && cy <= box.y + box.height + 24)
              found = true;
          }
          if (node.list) walk(node.list, vis);
        }
      };
      walk(game.scene.getScene(key as string).children.list as Node[], true);
      return found;
    },
    [sceneKey, text, rect] as const,
  );
}

async function startBoard(page: Page): Promise<void> {
  await installPad(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page, { quietMs: 600, maxMs: 5000 });
}

/** Taps a playable hand card with the mouse until its payment bar is up. */
async function openPayment(page: Page): Promise<void> {
  const card = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: { state: { legal?: { actions: { legal?: { action: { kind: string; instanceId?: string } }[] } } } };
      };
    };
    const legal = appSession().store.state.legal?.actions.legal ?? [];
    return legal.find((entry) => entry.action.kind === "playCard")?.action.instanceId ?? null;
  });
  expect(card, "a playable hand card").not.toBeNull();
  await clickFocus(page, `card:${card}`);
  await waitFor(async () => ((await paymentOpen(page)) ? true : null), "the payment bar", 15_000);
  await settle(page, { quietMs: 300, maxMs: 2000 });
}

/** Spends hand cards with the mouse until the engine would take the payment. */
async function fillPayment(page: Page): Promise<void> {
  for (let step = 0; step < 8 && !(await paymentReady(page)); step++) {
    const free = await page.evaluate(() => {
      const v = (
        window as unknown as {
          __mcBoardDebug?: { paymentView(): { sources: { instanceId: string | null; spent: boolean }[] } | null };
        }
      ).__mcBoardDebug?.paymentView();
      return (v?.sources ?? []).filter((s) => !s.spent && s.instanceId).map((s) => s.instanceId!);
    });
    const rect = free.length > 0 ? await focusRect(page, `card:${free[0]}`) : null;
    if (!rect) throw new Error("no payable source to tap");
    await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2, { verify: false });
    await settle(page, { quietMs: 250, maxMs: 1500 });
  }
}

test("a pad reaches Pay and Cancel by D-pad, sees their glyphs, and Start pays", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await startBoard(page);
  await openPayment(page);
  await fillPayment(page);

  // Pay is the bar's first button stop; Cancel is the route's own cancel stop. Walk the D-pad to Pay.
  const pay = await waitFor(() => focusRect(page, "bar:0"), "Pay is a focus stop", 8000);
  const cancel = await waitFor(() => focusRect(page, "cancel"), "Cancel is a focus stop", 8000);
  for (let i = 0; i < 24 && (await focusedKey(page)) !== "bar:0"; i++) await padTap(page, i % 2 === 0 ? UP : RIGHT);
  expect(await focusedKey(page), "the D-pad reaches Pay").toBe("bar:0");
  // The glyphs: Start on Pay (forward), B on Cancel (back).
  await waitFor(
    async () => ((await glyphIn(page, "Board", "Menu", pay)) ? true : null),
    "the Start glyph on Pay",
    8000,
  );
  expect(await glyphIn(page, "Board", "B", cancel), "the B glyph on Cancel").toBe(true);
  await page.screenshot({ path: "../../artifacts/qa/board-tv-payment-pad.png" });

  // Start pays (A on the focused Pay would too).
  await padTap(page, START);
  await waitFor(async () => ((await paymentOpen(page)) ? null : true), "Start paid", 10_000);
  expect(errors).toEqual([]);
});

test("B cancels a payment, and A on the focused Cancel does too", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await startBoard(page);
  await openPayment(page);
  await padTap(page, B);
  await waitFor(async () => ((await paymentOpen(page)) ? null : true), "B backed out of the payment", 10_000);
  expect(await activeScenes(page), "B backed out, it did not open Pause").not.toContain("PauseOverlay");

  await openPayment(page);
  for (let i = 0; i < 30 && (await focusedKey(page)) !== "cancel"; i++) await padTap(page, i % 3 === 2 ? UP : RIGHT);
  expect(await focusedKey(page), "the D-pad reaches Cancel").toBe("cancel");
  await padTap(page, A);
  await waitFor(async () => ((await paymentOpen(page)) ? null : true), "A on Cancel backed out", 10_000);
  expect(errors).toEqual([]);
});

test("the D-pad reaches the music note and A opens the player", async ({ page }) => {
  test.setTimeout(150_000);
  const errors = trackErrors(page);
  await startBoard(page);
  for (let i = 0; i < 40 && (await focusedKey(page)) !== "music"; i++) await padTap(page, i % 4 === 3 ? UP : RIGHT);
  expect(await focusedKey(page), "the D-pad reaches the music note").toBe("music");
  await padTap(page, A);
  await waitFor(
    async () => ((await activeScenes(page)).includes("MusicPlayerOverlay") ? true : null),
    "the music player opens",
    10_000,
  );
  await padTap(page, B);
  await waitFor(
    async () => ((await activeScenes(page)).includes("MusicPlayerOverlay") ? null : true),
    "B closes the music player",
    10_000,
  );
  expect(errors).toEqual([]);
});

test("A starts the villain phase, and the defend panel's Confirm wears its glyph and Start answers it", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors = trackErrors(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  await installPad(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=villain-interrupt");
  const start = await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
  // A pad press makes it a pad screen; the glyph then sits on START. A press in the first frames after the overlay held
  // input is dropped on purpose (`view/pad-press-guard.ts`), so under a loaded suite press again rather than wait.
  const aOnStart = async () => ((await glyphIn(page, "VillainPhaseOverlay", "A", start)) ? true : null);
  for (let attempt = 0; attempt < 3 && !(await aOnStart()); attempt += 1) {
    await padTap(page, RIGHT);
    await page.waitForTimeout(800);
  }
  await waitFor(aOnStart, "the A glyph on START", 8000);

  // A starts it.
  await padTap(page, A);
  const resolve = await waitFor(() => villainDebugRect(page, "resolveRect"), "A started the phase", 15_000);
  // Reach the defend panel: the interrupt and the notice are answered with the mouse (they have their own specs).
  await settle(page);
  await pressAt(page, resolve.x + resolve.width / 2, resolve.y + resolve.height / 2);
  const answer = await waitFor(() => villainDebugRect(page, "answerRect"), "the defend notice", 15_000);
  // As above: the notice's first frames still hold input, so a press that lands there is pressed again.
  for (let attempt = 0; attempt < 3 && !(await villainDebugRect(page, "confirmRect")); attempt += 1) {
    await settle(page, { quietMs: 300, maxMs: 2000 });
    await padTap(page, A);
    await page.waitForTimeout(800);
  }
  const confirm = await waitFor(() => villainDebugRect(page, "confirmRect"), "the docked defend panel", 15_000);
  expect(answer).not.toBeNull();

  // Pick a defender with the pad: the D-pad focuses an option and A picks it.
  await padTap(page, RIGHT);
  await padTap(page, A);
  await settle(page, { quietMs: 300, maxMs: 2000 });
  await page.screenshot({ path: "../../artifacts/qa/board-tv-defend-pad.png" });
  // With an option focused, A presses it, so Confirm's glyph is Start.
  await waitFor(
    async () => ((await glyphIn(page, "VillainPhaseOverlay", "Menu", confirm)) ? true : null),
    "the Start glyph on Confirm",
    8000,
  );
  await padTap(page, START);
  await waitFor(
    async () => ((await villainDebugRect(page, "confirmRect")) ? null : true),
    "Start confirmed the defender",
    15_000,
  );
  expect(errors).toEqual([]);
});

test("Start with Pay greyed opens Pause instead of swallowing the press", async ({ page }) => {
  test.setTimeout(150_000);
  const errors = trackErrors(page);
  await startBoard(page);
  await openPayment(page);
  expect(await paymentReady(page)).toBe(false);
  await padTap(page, START);
  await waitFor(
    async () => ((await activeScenes(page)).includes("PauseOverlay") ? true : null),
    "Start opened Pause over the unpayable payment",
    10_000,
  );
  expect(errors).toEqual([]);
});

test("View hides the villain phase's rail and the same button brings it back, its glyph on the handle", async ({
  page,
}) => {
  test.setTimeout(100_000);
  const errors = trackErrors(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  await installPad(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=villain-interrupt");
  await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
  const presentation = (): Promise<string | null> =>
    page.evaluate(
      () =>
        (
          window as unknown as { __mcVillainPhaseDebug?: { presentation(): string } }
        ).__mcVillainPhaseDebug?.presentation() ?? null,
    );
  await padTap(page, RIGHT);
  await padTap(page, VIEW);
  await waitFor(async () => ((await presentation()) === "hidden" ? true : null), "View hid the rail", 8000);
  const handle = await waitFor(() => villainDebugRect(page, "showRect"), "the handle", 8000);
  await waitFor(
    async () => ((await glyphIn(page, "VillainPhaseOverlay", "View", handle)) ? true : null),
    "the View glyph on the handle",
    8000,
  );
  await padTap(page, VIEW);
  await waitFor(async () => ((await presentation()) === "rail" ? true : null), "View brought the rail back", 8000);
  expect(errors).toEqual([]);
});
