import { expect, test } from "@playwright/test";
import { activeScenes, pressEndTurn, pressHookStop, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors, waitForScene } from "./wave6-helpers-a.js";
import { answerChoice, dealToFirstTurn, findVisibleText, gameFacts, quietGuide } from "./wave6-helpers-b.js";
import { clickStop } from "./wave6-helpers-a.js";

/**
 * The hard rule for online play (issue #880): nothing online may touch single player, and the game works with no
 * connection at all. With the network blocked and "Always allow watchers" on (so Table setup's watch toggle is ticked),
 * a single-player game starts from Table setup, takes moves, saves and resumes, and "Play online" says it needs a
 * connection in a line on its own screen. The screens are loaded first (a dev server serves them as they are
 * asked for), then the network goes: what follows is what a player on a plane has.
 */
test("offline: a single-player game with watching on starts, plays, saves and resumes; Play online says so", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({
        version: 1,
        villainAutoAdvance: "on",
        flipEncounterCards: false,
        holdEncounterCards: false,
        liveWatch: true,
      }),
    );
  });
  await page.goto("/?screen=table-setup");
  await waitForScene(page, "Setup", 30000);
  await settle(page);

  // Everything a game and the Play online screen need, loaded while the network is still there: every screen's code (a
  // dev server serves them as they are asked for) and the room worker, which a watchable game would start.
  await page.evaluate(async () => {
    const { SCENE_LOADERS } = (await import("/src/scenes/scene-table.ts")) as unknown as {
      SCENE_LOADERS: Record<string, () => Promise<unknown>>;
    };
    for (const load of Object.values(SCENE_LOADERS)) await load().catch(() => undefined);
    const live = (await import("/src/platform/live-watch.ts")) as unknown as {
      postRoomCommand: (message: { kind: string }) => boolean;
    };
    live.postRoomCommand({ kind: "room-leave" });
  });

  await context.setOffline(true);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);

  // Deal it out with the watch toggle on (the setting pre-ticks it) and no way to reach a room.
  await pressHookStop(page, "__mcTableSetupDebug", "deal-it-out");
  await dealToFirstTurn(page);
  const before = await gameFacts<number>(page, "(state) => state.version");
  await pressEndTurn(page);
  // The end-of-turn choices (discard any cards) are answered as a player would; the villain phase then runs by itself.
  await waitFor(
    async () => {
      if ((await activeScenes(page)).includes("ChoiceOverlay")) await answerChoice(page, 0);
      return (await gameFacts<number>(page, "(state) => state.version")) > before + 1 ? true : null;
    },
    "the end turn and the villain phase to run offline",
    90000,
  );

  // The game saved as it went, and resumes.
  const resumed = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          listSaves: () => Promise<readonly { id: string; commandCount: number }[]>;
          resume: (id: string) => Promise<unknown>;
          state: { status: string; game: unknown };
        };
      };
    };
    const { store } = appSession();
    const saves = await store.listSaves();
    const save = saves.find((s) => s.commandCount > 0);
    if (!save) return { saved: false, status: "none" };
    await store.resume(save.id);
    return { saved: true, status: store.state.status, hasGame: store.state.game !== null };
  });
  expect(resumed.saved).toBe(true);
  expect(resumed.status).not.toBe("failed");

  // Play online, offline: a line on its own screen, and nothing connects.
  await page.evaluate(async () => {
    (window as unknown as { __mcGame: { scene: { start: (key: string) => void } } }).__mcGame.scene.start("Online");
  });
  await waitForScene(page, "Online");
  await settle(page);
  await clickStop(page, "host", "Online");
  await waitFor(
    async () => ((await findVisibleText(page, "offline", "Online")).length > 0 ? true : null),
    "the offline message on Play online",
    15000,
  );
  expect(errors.filter((e) => e.startsWith("pageerror"))).toEqual([]);
});
