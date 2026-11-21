import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #911 (Quin, 2026-11-20): a choose-a-player question shows the minions engaged with each player, and resting the
 * mouse on one opens its card hover (hit points, damage, statuses). The `multi-gun` dev fixture stops on Multi-Gun's
 * "Choose a player" with a minion engaged with each of its two seats (`store/dev-multi-gun-game.ts`).
 */
test.use({ viewport: { width: 1600, height: 900 } });

interface ChoiceHoverDebug {
  hoverRects(): [string, Rect][];
  hoverShown(): string | null;
}

const hoverRects = (page: Page): Promise<[string, Rect][]> =>
  page.evaluate(
    () => (window as unknown as { __mcChoiceDebug?: ChoiceHoverDebug }).__mcChoiceDebug?.hoverRects() ?? [],
  );

const hoverShown = (page: Page): Promise<string | null> =>
  page.evaluate(
    () => (window as unknown as { __mcChoiceDebug?: ChoiceHoverDebug }).__mcChoiceDebug?.hoverShown() ?? null,
  );

/** The minions engaged with any seat in the live game. */
const engagedMinions = (page: Page): Promise<string[]> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          state: {
            game?: {
              players: { playArea: string[] }[];
              instances: Record<string, { cardId: string }>;
              cardPool: Record<string, { type?: string }>;
            };
          };
        };
      };
    };
    const game = appSession().store.state.game;
    if (!game) return [];
    return game.players.flatMap((p) =>
      p.playArea.filter((id) => game.cardPool[game.instances[id]!.cardId]?.type === "minion"),
    );
  });

test("Multi-Gun's choose-a-player shows each seat's engaged minions, each with the card hover", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=multi-gun");
  await waitFor(
    async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? true : null),
    "Multi-Gun's choose-a-player sheet",
    120_000,
  );
  await settle(page, { quietMs: 600, maxMs: 6000 });

  const minions = await engagedMinions(page);
  expect(minions.length, "a minion is engaged with each seat").toBeGreaterThanOrEqual(2);
  const rects = new Map(await hoverRects(page));
  for (const id of minions) expect(rects.has(id), `minion ${id} is pictured on its seat's row`).toBe(true);

  const [first] = minions;
  const rect = rects.get(first!)!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2, { steps: 6 });
  await page.mouse.move(rect.x + rect.width / 2 + 3, rect.y + rect.height / 2 + 3, { steps: 2 });
  await waitFor(async () => ((await hoverShown(page)) === first ? true : null), "the popover on an engaged minion");
  await page.screenshot({ path: info.outputPath("choose-player-minion-hover.png") });
  if (SHOT) await page.screenshot({ path: `${SHOT}/choose-player-minion-hover.png` });

  await page.mouse.move(8, 8, { steps: 4 });
  await waitFor(async () => ((await hoverShown(page)) === null ? true : null), "the popover closes off the minion");
  expect(errors).toEqual([]);
});
