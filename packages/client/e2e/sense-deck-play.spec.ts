import { expect, test } from "@playwright/test";
import { activeScenes, clickText, pressAt, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";

/**
 * Daredevil's "Action: Play the top card of the Sense deck as if it were in your hand (paying its cost)." (60001a,
 * Superhuman Senses) could only be reached from the identity's own sheet; the Sense deck's top card, where a player
 * reaches to play it, opened a sheet with no way to (issue #782). The top card's sheet now offers
 * "Play it", which runs the identity's Action: the Action's choice of the top card opens.
 */

test.use({ viewport: { width: 1440, height: 980 } });

type Rect = { x: number; y: number; width: number; height: number };

const storeState = (page: import("@playwright/test").Page) =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game?: any } } };
    };
    const game = appSession().store.state.game;
    const me = game.players[0];
    return {
      top: (me.separateDecks.Sense.deck[0] ?? null) as string | null,
      choice: game.pendingChoice
        ? {
            kind: game.pendingChoice.prompt.kind as string,
            ids: game.pendingChoice.options.map((o: any) => o.ref?.instanceId ?? null),
          }
        : null,
    };
  });

test("the Sense deck's top card offers Play it, which runs Superhuman Senses", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=sense-hero");
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "the board is up", 120_000);
  await settle(page, { quietMs: 600, maxMs: 5000 });

  const before = await storeState(page);
  expect(before.top, "the Sense deck has a top card").not.toBeNull();
  const pile = await waitFor(
    async () =>
      page.evaluate(() => {
        const debug = (window as unknown as { __mcBoardDebug: { allPileRects: () => [string, unknown][] } })
          .__mcBoardDebug;
        return (debug.allPileRects().find(([key]) => key.startsWith("separateDeck:") && key.endsWith(":Sense"))?.[1] ??
          null) as Rect | null;
      }),
    "the Sense pile",
    10_000,
  );
  await pressAt(page, pile.x + pile.width / 2, pile.y + pile.height / 2);
  await waitFor(async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null), "Inspect", 10_000);
  await settle(page, { quietMs: 300, maxMs: 1500 });
  await clickText(page, "Play it", { sceneKey: "InspectOverlay" });
  await settle(page, { quietMs: 500, maxMs: 4000 });

  const after = await waitFor(async () => {
    const state = await storeState(page);
    return state.choice ? state : null;
  }, "Superhuman Senses asks for the top card");
  expect(after.choice!.ids).toEqual([before.top]);
  expect(errors).toEqual([]);
});
