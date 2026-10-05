import { expect, test, type Page } from "@playwright/test";
import { focusRect, handInstanceFor, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { boardText, boardUp, facts, playFromHand, startDevGame, waitForBoardText, payWith } from "./x-men-helpers.js";

/**
 * A tap is lost when a redraw lands inside it or in the frame just before it: every redraw destroys and recreates the
 * zones, and Phaser hit-tests a zone created this frame only from the next one (`ui/tap.ts`, the scene tap router).
 * These presses are the worst case, a whole tap (down and up) in the same JavaScript task as a forced redraw, so no
 * zone that exists when the press begins is hit-testable. Raw events on purpose, not the verified `press`: the first
 * press is what is under test. Outcomes are read from the game's own state.
 */

const UNCANNY = "36018";
const WOLVERINE = "p2";

/** Redraws every screen (the scale manager's resize), then taps `(x, y)` in the same task: touch on a phone, mouse on a desktop. */
async function redrawThenTap(page: Page, phone: boolean, x: number, y: number): Promise<void> {
  if (!phone) {
    await page.mouse.move(x, y);
    await page.evaluate(() => {
      const scale = (window as unknown as { __mcGame: { scale: { emit: (e: string, ...a: unknown[]) => void } } })
        .__mcGame.scale as unknown as {
        emit: (e: string, ...a: unknown[]) => void;
        gameSize: unknown;
        baseSize: unknown;
        displaySize: unknown;
        width: number;
        height: number;
      };
      scale.emit("resize", scale.gameSize, scale.baseSize, scale.displaySize, scale.width, scale.height);
    });
    await Promise.all([page.mouse.down(), page.mouse.up()]);
    return;
  }
  await page.evaluate(
    ([px, py]) => {
      const game = (
        window as unknown as {
          __mcGame: {
            canvas: HTMLCanvasElement;
            scale: {
              emit: (e: string, ...a: unknown[]) => void;
              gameSize: unknown;
              baseSize: unknown;
              displaySize: unknown;
              width: number;
              height: number;
            };
          };
        }
      ).__mcGame;
      const { scale, canvas } = game;
      scale.emit("resize", scale.gameSize, scale.baseSize, scale.displaySize, scale.width, scale.height);
      const touch = new Touch({ identifier: 41, target: canvas, clientX: px!, clientY: py!, pageX: px!, pageY: py! });
      const init = {
        bubbles: true,
        cancelable: true,
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch],
      };
      canvas.dispatchEvent(new TouchEvent("touchstart", init));
      canvas.dispatchEvent(
        new TouchEvent("touchend", { ...init, touches: [], targetTouches: [], changedTouches: [touch] }),
      );
    },
    [x, y] as const,
  );
}

test.describe("a tap beside a redraw still lands", () => {
  test("a target tile commits on a tap that is the same instant as a redraw", async ({ page }, info) => {
    test.setTimeout(240_000);
    const phone = info.project.name === "phone";
    await installWave6Helpers(page);
    await openApp(page);
    await startDevGame(page, "startUncannyDevGame");
    await boardUp(page);

    const id = (await handInstanceFor(page, UNCANNY))!;
    expect(id, "Uncanny X-Men is in Storm's hand").not.toBeNull();
    await playFromHand(page, phone, id, async () => (await boardText(page, /^Whose play area\?$/i)) !== undefined);
    await waitForBoardText(page, /^Whose play area\?$/i, "the controller question");
    await settle(page, { quietMs: 400, maxMs: 4000 });

    const wolverineIdentity = await facts(page, (game) => game.players[1].identity.instanceId as string);
    const tile = (await focusRect(page, `card:${wolverineIdentity}`))!;
    expect(tile, "Wolverine's tile is on the route").not.toBeNull();
    await redrawThenTap(page, phone, tile.x + tile.width / 2, tile.y + tile.height / 2);
    // The tile took the tap: the question is answered and payment is open.
    await waitFor(
      async () => ((await boardText(page, /^PAYING/i)) ? true : null),
      "payment opens after the seat is picked",
    );

    const hand = await facts(page, (game) => game.players[0].hand as string[]);
    await payWith(page, phone, hand.filter((card) => card !== id).slice(0, 3));
    const controller = (): Promise<string | null> =>
      page.evaluate(async (card) => {
        const { appSession } = (await import("/src/session.ts")) as unknown as {
          appSession: () => {
            store: { state: { game?: { instances: Record<string, { controllerId: string | null }> } } };
          };
        };
        return appSession().store.state.game!.instances[card]!.controllerId;
      }, id);
    await waitFor(
      async () => ((await controller()) === WOLVERINE ? true : null),
      "the card is in play under Wolverine",
    );
  });

  test("a phone tab takes a tap that is the same instant as a redraw", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "the tab rail is the phone board's");
    test.setTimeout(240_000);
    await installWave6Helpers(page);
    await openApp(page);
    await startDevGame(page, "startUncannyDevGame");
    await boardUp(page);

    const activeTab = (): Promise<string> =>
      page.evaluate(() =>
        (window as unknown as { __mcBoardDebug: { activeTab: () => string } }).__mcBoardDebug.activeTab(),
      );
    for (const want of ["enemies", "threat", "me"]) {
      const label = await waitForBoardText(page, new RegExp(`^${want}$`, "i"), `the ${want} tab`);
      expect(await activeTab()).not.toBe(want);
      await redrawThenTap(page, true, label.x, label.y);
      await waitFor(async () => ((await activeTab()) === want ? true : null), `the ${want} tab opened`);
      await settle(page, { quietMs: 200, maxMs: 1000 });
    }
  });
});
