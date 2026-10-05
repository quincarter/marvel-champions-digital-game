import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickFocus, pressAt, settle, waitFor } from "./helpers.js";
import { answerChoiceSheet, installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, startGame, type Rect } from "./wave6-helpers-b.js";

/**
 * While the villain-phase recap is up, the table behind it takes no pointer input (found by browser QA, 2026-10-04:
 * a click on the last step ("Villain phase complete.") opened Inspect on a board card, played a card, or on the phone
 * switched the tab). The recap is reached by real input (End turn), and the press lands where a board card sits.
 */

const DECK = "core-spider-man-justice";

interface BoardHooks {
  activeTab?: () => string;
  hitRect(id: string): Rect | null;
}

const tabOf = (page: Page): Promise<string | null> =>
  page.evaluate(() => (window as unknown as { __mcBoardDebug?: BoardHooks }).__mcBoardDebug?.activeTab?.() ?? null);

/** The host's command count and the hand size: a press that did something to the game moves one of them. */
const gameMarks = (page: Page): Promise<{ version: number; hand: number; discard: number }> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          state: {
            version: number;
            perspectiveId: unknown;
            game?: { players: { playerId: unknown; hand: unknown[]; discard: unknown[] }[] };
          };
        };
      };
    };
    const s = appSession().store.state;
    const me = s.game?.players.find((p) => p.playerId === s.perspectiveId);
    return { version: s.version, hand: me?.hand.length ?? -1, discard: me?.discard.length ?? -1 };
  });

const continueRect = (page: Page): Promise<Rect | null> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __mcVillainPhaseDebug?: { continueRect(): Rect | null } }
      ).__mcVillainPhaseDebug?.continueRect() ?? null,
  );

/**
 * The recap's own controls: CONTINUE, SKIP and the cards it shows (they open Inspect on purpose). A press on one of
 * these is the overlay answering; anything else must not be answered at all. Read from the scene's input list, minus
 * a zone that covers most of the screen (the shield that stops presses reaching the table).
 */
const overlayControls = (page: Page): Promise<Rect[]> =>
  page.evaluate(() => {
    const game = (
      window as unknown as {
        __mcGame: {
          scene: {
            getScene: (k: string) => {
              sys: { input: { _list: { x: number; y: number; width: number; height: number }[] } };
            };
          };
          scale: { gameSize: { width: number; height: number } };
        };
      }
    ).__mcGame;
    const { width, height } = game.scale.gameSize;
    return game.scene
      .getScene("VillainPhaseOverlay")
      .sys.input._list.filter((o) => o.width * o.height < width * height * 0.5)
      .map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height }));
  });

/** Ends the turn and answers every prompt until the recap's last step (CONTINUE showing) is up. */
async function reachVillainRecap(page: Page): Promise<void> {
  await clickFocus(page, "basic:endTurn");
  await waitFor(
    async () => {
      const scenes = await activeScenes(page);
      if (scenes.includes("EndTurnConfirmOverlay")) {
        const rect = await page.evaluate(
          () =>
            (
              window as unknown as { __mcEndTurnConfirmDebug?: { endRect(): Rect } }
            ).__mcEndTurnConfirmDebug?.endRect() ?? null,
        );
        if (rect) await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
        return null;
      }
      if (scenes.includes("ChoiceOverlay")) {
        await answerChoiceSheet(page);
        return null;
      }
      return (await continueRect(page)) ? true : null;
    },
    "the villain-phase recap's last step",
    90_000,
  );
  await settle(page);
}

test.describe("Villain-phase recap blocks the table", () => {
  test("a press on a board card behind the last step does nothing", async ({ page }, info) => {
    test.setTimeout(240_000);
    const phone = info.project.name === "phone";
    const errors = trackErrors(page);
    await installWave6Helpers(page);
    await openApp(page);
    await startGame(page, { scenarioId: "rhino", decks: [DECK], seed: 3 });
    await declineMulligans(page);
    await settle(page);

    // Every control the table draws (cards, End turn, piles, tabs), read before the recap covers it: a press on any of
    // them behind the recap must go nowhere.
    const table = await page.evaluate(() =>
      (
        (
          window as unknown as { __mcBoardDebug?: { allFocusRects(): [string, Rect][] } }
        ).__mcBoardDebug?.allFocusRects() ?? []
      ).map(([key, r]) => ({ key, x: r.x + r.width / 2, y: r.y + r.height / 2 })),
    );
    expect(table.length, "the table has controls to press").toBeGreaterThan(5);

    await reachVillainRecap(page);
    expect(await activeScenes(page)).toContain("VillainPhaseOverlay");

    const size = page.viewportSize()!;
    const scenesBefore = await activeScenes(page);
    const tabBefore = await tabOf(page);
    const marksBefore = await gameMarks(page);
    // The table's own controls, the phone's tab strip corner QA hit, and a sweep of the rest of the table.
    const seen = new Set<string>();
    const spots: [number, number][] = [];
    for (const t of [...table, { x: phone ? 60 : 420, y: phone ? 57 : 300 }]) {
      const key = `${Math.round(t.x / 6)},${Math.round(t.y / 6)}`;
      if (seen.has(key) || t.x < 0 || t.y < 0 || t.x > size.width || t.y > size.height) continue;
      seen.add(key);
      spots.push([t.x, t.y]);
    }
    for (const fx of [0.12, 0.3, 0.48, 0.66, 0.84]) {
      for (const fy of [0.2, 0.4, 0.6, 0.8]) spots.push([size.width * fx, size.height * fy]);
    }
    const controls = await overlayControls(page);
    for (const [x, y] of spots) {
      // The recap's own controls may answer a press; nothing else.
      if (controls.some((c) => x >= c.x && x <= c.x + c.width && y >= c.y && y <= c.y + c.height)) continue;
      if (phone) await page.touchscreen.tap(x, y);
      else await pressAt(page, x, y, { verify: false });
      await settle(page, { quietMs: 200, maxMs: 800 });
      const scenes = await activeScenes(page);
      expect(scenes, `no Inspect, confirm or sheet after a press at ${Math.round(x)},${Math.round(y)}`).toEqual(
        scenesBefore,
      );
      expect(await tabOf(page), "the tab did not change").toBe(tabBefore);
      expect(await gameMarks(page), "the game did not move").toEqual(marksBefore);
    }
    expect(errors).toEqual([]);
  });
});
