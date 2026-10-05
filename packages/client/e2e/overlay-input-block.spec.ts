import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressAt, settle } from "./helpers.js";
import { gameMarks, overlayControls, reachVillainRecap } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
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

test.describe("Villain-phase recap blocks the table", () => {
  test("a press on a board card behind the last step does nothing", async ({ page }, info) => {
    test.setTimeout(150_000);
    const phone = info.project.name === "phone";
    const errors = trackErrors(page);
    await installWave6Helpers(page);
    await openApp(page);
    await startGame(page, { scenarioId: "rhino", decks: [DECK], seed: 3 });
    await declineMulligans(page);
    await settle(page);

    // Five named spots on the table, read before the recap covers it: End turn, a hand card, a board card, a top-bar
    // control and (on a phone) the tab strip's corner. A press on any of them behind the recap must go nowhere.
    const size = page.viewportSize()!;
    const rects = await page.evaluate(() =>
      (
        (
          window as unknown as { __mcBoardDebug?: { allFocusRects(): [string, Rect][] } }
        ).__mcBoardDebug?.allFocusRects() ?? []
      ).map(([key, r]) => ({ key, x: r.x + r.width / 2, y: r.y + r.height / 2 })),
    );
    const cards = rects.filter((r) => r.key.startsWith("card:") && r.x > 0 && r.x < size.width && r.y > 0);
    const handCard = cards.reduce<(typeof cards)[number] | null>((best, c) => (!best || c.y > best.y ? c : best), null);
    const boardCard = cards.reduce<(typeof cards)[number] | null>(
      (best, c) => (c.y > size.height * 0.15 && (!best || c.y < best.y) ? c : best),
      null,
    );
    const endTurn = rects.find((r) => r.key === "basic:endTurn") ?? null;
    expect(handCard, "the table has a hand card to press").not.toBeNull();
    expect(boardCard, "the table has a board card to press").not.toBeNull();
    const named: { name: string; x: number; y: number }[] = [
      { name: "hand card", x: handCard!.x, y: handCard!.y },
      { name: "board card", x: boardCard!.x, y: boardCard!.y },
      { name: "top bar", x: size.width - 35, y: 22 },
      { name: phone ? "tab strip corner" : "table corner", x: phone ? 60 : 420, y: phone ? 57 : 300 },
    ];
    if (endTurn) named.push({ name: "End turn", x: endTurn.x, y: endTurn.y });

    await reachVillainRecap(page, phone);
    expect(await activeScenes(page)).toContain("VillainPhaseOverlay");

    const scenesBefore = await activeScenes(page);
    const tabBefore = await tabOf(page);
    const marksBefore = await gameMarks(page);
    const controls = await overlayControls(page);
    for (const { name, x, y } of named) {
      // The recap's own controls may answer a press; nothing else.
      if (controls.some((c) => x >= c.x && x <= c.x + c.width && y >= c.y && y <= c.y + c.height)) continue;
      if (phone) await page.touchscreen.tap(x, y);
      else await pressAt(page, x, y, { verify: false });
      await settle(page, { quietMs: 200, maxMs: 800 });
      expect(await activeScenes(page), `no Inspect, confirm or sheet after a press on the ${name}`).toEqual(
        scenesBefore,
      );
      expect(await tabOf(page), `the tab did not change after the ${name}`).toBe(tabBefore);
      expect(await gameMarks(page), `the game did not move after the ${name}`).toEqual(marksBefore);
    }
    expect(errors).toEqual([]);
  });
});
