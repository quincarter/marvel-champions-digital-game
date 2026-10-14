import { expect, test, type Page } from "@playwright/test";
import { focusRect, isSceneUp, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, routeStops } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT, boardUp, facts, press } from "./x-men-helpers.js";

/**
 * Pause's "Jump to a moment" (`scenes/pause.ts`'s `#drawUndoMoment`): the log lines Undo could get back to this turn
 * are tap targets, and a tap rewinds there, as pressing Undo that many times would. A finger that scrolls across
 * one and lifts on it is a scroll, not a tap. Same dev game as `undo.spec.ts`: Spider-Man's turn, nothing done yet.
 */

const PAUSE = "PauseOverlay";

const version = (page: Page): Promise<number> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { version: number } } };
    };
    return appSession().store.state.version;
  });

async function pressFocus(page: Page, phone: boolean, key: string): Promise<void> {
  const rect = await waitFor(() => focusRect(page, key), `the ${key} control`, 10000);
  await press(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page, { quietMs: 400, maxMs: 4000 });
}

const momentStops = async (page: Page) =>
  ((await routeStops(page, PAUSE))?.stops ?? []).filter((s) => s.key.startsWith("moment:"));

/** One finger pressed at (x, fromY), dragged straight to toY in small steps, and lifted there. */
async function touchSwipe(page: Page, x: number, fromY: number, toY: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: fromY }] });
  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(16);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: fromY + ((toY - fromY) * i) / 10 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("a log moment in Pause rewinds like Undo, and a swipe across one doesn't", async ({ page }, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    const { startOffTurnDevGame } = (await import(/* @vite-ignore */ "/src/store/dev-off-turn-game.ts")) as unknown as {
      startOffTurnDevGame: (store: unknown) => Promise<void>;
    };
    await startOffTurnDevGame(appSession().store);
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
  await boardUp(page);

  const formOf = () => facts(page, (game) => game.players[0].identity.form as string);
  const start = await version(page);
  const startForm = await formOf();

  // Two moves this turn: change form, then a basic power with its first answers.
  await pressFocus(page, phone, "basic:changeForm");
  await waitFor(async () => ((await formOf()) !== startForm ? true : null), "Spider-Man changes form", 10000);
  const basic = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: any; dispatch: (c: unknown) => Promise<boolean> } };
    };
    const { store } = appSession();
    const kinds = ["basicRecover", "basicThwart", "basicAttack"];
    const entry = store.state.legal.actions.legal.find((e: any) => kinds.includes(e.action.kind));
    if (!entry) return `none of ${JSON.stringify(store.state.legal.actions.legal.map((e: any) => e.action.kind))}`;
    let ok = await store.dispatch(entry.example);
    for (let guard = 0; ok && store.state.game.pendingChoice && guard < 10; guard++) {
      const choice = store.state.game.pendingChoice;
      ok = await store.dispatch({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.options.slice(0, choice.minSelections).map((o: any) => o.optionId),
      });
    }
    return ok ? "done" : "refused";
  });
  expect(basic, "a basic power after the change of form").toBe("done");
  await settle(page, { quietMs: 400, maxMs: 4000 });
  const twoMoves = await version(page);
  expect(twoMoves).toBeGreaterThanOrEqual(start + 2);

  const width = page.viewportSize()!.width;
  await waitFor(
    async () => {
      if (!(await isSceneUp(page, PAUSE))) await press(page, phone, width - 35, 22);
      return (await isSceneUp(page, PAUSE)) ? true : null;
    },
    "the menu control opens Pause",
    20000,
  );
  await settle(page);
  if (phone) {
    // The phone shows the log in place of Table once its Game log row is open.
    await waitFor(
      async () => {
        if ((await momentStops(page)).length > 0) return true;
        const row = (await routeStops(page, PAUSE))?.stops.find((s) => s.key === "quick:jumpLog");
        if (row) await press(page, true, row.rect.x + row.rect.width / 2, row.rect.y + row.rect.height / 2);
        await settle(page, { quietMs: 300, maxMs: 2000 });
        return (await momentStops(page)).length > 0 ? true : null;
      },
      "the Game log row shows the log",
      20000,
    );
  }

  // The two points Undo could reach: after the first move, and the start of the turn (drawn newest first).
  const moments = await waitFor(
    async () => {
      const found = await momentStops(page);
      return found.length === 2 ? found : null;
    },
    "two undoable moments in the log",
    10000,
  );
  if (SHOT) await page.screenshot({ path: `${SHOT}/pause-undo-moment-${info.project.name}.png` });

  if (phone) {
    // A finger pressed on a moment, scrolled past the tap slop and lifted on the other is a scroll: nothing rewinds.
    const [a, b] = moments;
    await touchSwipe(
      page,
      a!.rect.x + a!.rect.width / 2,
      a!.rect.y + a!.rect.height / 2,
      b!.rect.y + b!.rect.height / 2 + 20,
    );
    await settle(page, { quietMs: 400, maxMs: 3000 });
    expect(await version(page), "a swipe rewinds nothing").toBe(twoMoves);
    expect(await isSceneUp(page, PAUSE), "and Pause stays open").toBe(true);
  }

  // Tapping the oldest moment takes back both moves (and their answers) and returns to the table.
  const oldest = moments[1]!;
  await press(page, phone, oldest.rect.x + oldest.rect.width / 2, oldest.rect.y + oldest.rect.height / 2);
  await waitFor(
    async () => ((await version(page)) === start ? true : null),
    "the game is back at the turn's start",
    15000,
  );
  await waitFor(async () => ((await isSceneUp(page, PAUSE)) ? null : true), "Pause closes", 10000);
  expect(await formOf()).toBe(startForm);
});
