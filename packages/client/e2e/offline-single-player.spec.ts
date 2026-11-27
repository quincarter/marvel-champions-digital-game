import { expect, test } from "@playwright/test";
import { activeScenes, pressEndTurn, pressHookStop, settle, waitFor } from "./helpers.js";
import { answerChoiceSheet, installWave6Helpers, trackErrors, waitForScene } from "./wave6-helpers-a.js";
import { dealToFirstTurn, findVisibleText, gameFacts, quietGuide } from "./wave6-helpers-b.js";
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
    // The worker card pictures are decoded in: an installed app has its script on disk, a dev server only online.
    const bake = (await import("/src/art/picture-bake-client.ts")) as unknown as {
      decodedBakedPicture: (url: string, slot: { width: number; height: number }, gray: boolean) => Promise<unknown>;
    };
    await bake.decodedBakedPicture("/card-art/bundles/cards/marvel-player-back.webp", { width: 1, height: 64 }, false);
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
      if ((await activeScenes(page)).includes("ChoiceOverlay")) await answerChoiceSheet(page);
      return (await gameFacts<number>(page, "(state) => state.version")) > before + 1 ? true : null;
    },
    "the end turn and the villain phase to run offline",
    90000,
  );
  // A villain-phase trigger prompt (a card's Interrupt) can still be open: it would cover the Play online screen, so the
  // round runs to the next hero phase with every prompt answered first.
  await waitFor(
    async () => {
      if ((await activeScenes(page)).includes("ChoiceOverlay")) {
        await answerChoiceSheet(page);
        return null;
      }
      const facts = await gameFacts<{ round: number; phase: string }>(
        page,
        "(s) => ({ round: s.game.round, phase: s.game.step.phase })",
      );
      return facts.round >= 2 && facts.phase === "player" ? true : null;
    },
    "the next hero phase offline",
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
  // Leave the table as a player does (the Title menu stops the board): a board left running under the screen would
  // take a phone press that misses the panel.
  await page.evaluate(async () => {
    const scenes = (
      window as unknown as { __mcGame: { scene: { start: (key: string) => void; stop: (key: string) => void } } }
    ).__mcGame.scene;
    scenes.stop("Board");
    scenes.start("Online");
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

/**
 * Before the player chooses Host or Join, nothing online exists: the Title and the Play online screen start no room
 * worker and open no WebSocket (the room worker is spawned by Host/Join or by a watchable game, never by a visit).
 */
test("the Title and Play online start no room worker and open no socket", async ({ page }) => {
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.addInitScript(() => {
    const seen = { workers: [] as string[], sockets: 0 };
    (window as unknown as { __mcOnlineSeen: typeof seen }).__mcOnlineSeen = seen;
    const RealWorker = window.Worker;
    window.Worker = class extends RealWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        seen.workers.push(options?.name ?? String(url));
      }
    } as typeof Worker;
    const RealSocket = window.WebSocket;
    window.WebSocket = class extends RealSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        // The dev server's own hot-reload channel (Vite's client, protocol "vite-hmr") is not the game going online.
        if (![protocols].flat().includes("vite-hmr")) seen.sockets++;
      }
    } as typeof WebSocket;
  });
  const roomWorkers = (): Promise<{ rooms: number; sockets: number }> =>
    page.evaluate(() => {
      const seen = (window as unknown as { __mcOnlineSeen: { workers: string[]; sockets: number } }).__mcOnlineSeen;
      return { rooms: seen.workers.filter((name) => name.includes("live-room")).length, sockets: seen.sockets };
    });
  await page.goto("/");
  await waitForScene(page, "Title", 30000);
  await settle(page);
  expect(await roomWorkers()).toEqual({ rooms: 0, sockets: 0 });
  await page.evaluate(() => {
    (window as unknown as { __mcGame: { scene: { start: (key: string) => void } } }).__mcGame.scene.start("Online");
  });
  await waitForScene(page, "Online");
  await settle(page);
  expect(await roomWorkers()).toEqual({ rooms: 0, sockets: 0 });
});
