import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { activeScenes, focusRect, pressAt, pressKey, settle, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, endTurnToNextRound, installWave6Helpers, routeStops, waitForScene } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, startGame } from "./wave6-helpers-b.js";

/**
 * A replay plays through the villain phase by itself at every speed: the walkthrough closes on its own and the replay
 * goes on into the next player phase, with no Start player phase press (BluefireF5ran, 2026-11-19).
 */

interface ReplayState {
  position: number;
  playing: boolean;
  speed: number;
}

const replayState = (page: Page): Promise<ReplayState | null> =>
  page.evaluate(
    () => (window as unknown as { __mcReplayDebug?: { state(): ReplayState } }).__mcReplayDebug?.state() ?? null,
  );

async function savedGames(page: Page): Promise<{ id: string; commandCount: number }[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mc-saves", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = await new Promise<{ id: string; commandCount: number; createdAt: number }[]>((resolve) => {
      const request = db.transaction("games").objectStore("games").getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return all.sort((a, b) => a.createdAt - b.createdAt).map(({ id, commandCount }) => ({ id, commandCount }));
  });
}

/** Ends a saved game as a win, as the engine's last write would, so the games list offers its replay. */
async function markWon(page: Page, id: string): Promise<void> {
  await page.evaluate(async (gameId) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mc-saves", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("games", "readwrite");
    const store = tx.objectStore("games");
    const game = await new Promise<Record<string, unknown>>((resolve) => {
      const request = store.get(gameId);
      request.onsuccess = () => resolve(request.result);
    });
    store.put({ ...game, status: "won", outcome: { result: "win", reason: "villainDefeated" } });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  }, id);
}

async function playsThrough(page: Page, info: TestInfo): Promise<void> {
  test.skip(info.project.name !== "desktop", "the replay transport's case; the phone shares its code");
  test.setTimeout(300_000);
  const errors = trackPageErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 43523 });
  await declineMulligans(page);
  await settle(page);
  await endTurnToNextRound(page, 1);
  await settle(page);
  // One more move after the phase, so the replay has to get past it, not just end on it.
  const flip = await waitFor(() => focusRect(page, "basic:changeForm"), "the change form control", 15000);
  await pressAt(page, flip.x + flip.width / 2, flip.y + flip.height / 2);
  await settle(page);
  const [game] = await savedGames(page);
  expect(game, "a game was saved").toBeTruthy();
  await markWon(page, game!.id);

  // Watched in the page, every frame, from the replay's first moment: at 4x the phase can open and close between two
  // polls from here, and the replay starts playing as it opens.
  await page.addInitScript(() => {
    const w = window as unknown as { __mcActiveScenes?: () => string[]; __sawVillainPhase?: boolean };
    const look = (): void => {
      if (w.__mcActiveScenes?.().includes("VillainPhaseOverlay")) w.__sawVillainPhase = true;
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title", 30000);
  await settle(page, { quietMs: 500, maxMs: 3000 });
  await clickStop(page, "past-games", "Title");
  await waitForScene(page, "PastGames");
  await waitFor(
    async () => ((await routeStops(page, "PastGames"))?.stops.some((s) => s.key === "action:watch") ? true : null),
    "the watch action",
  );
  await clickStop(page, "action:watch", "PastGames");
  await waitFor(() => replayState(page), "the replay opens on the board", 30000);
  await settle(page, { quietMs: 500, maxMs: 3000 });

  // S cycles the speed: 1x, 2x, 4x. Each press is waited on, so none lands before the last one took.
  for (let i = 0; i < 3 && (await replayState(page))!.speed !== 4; i += 1) {
    const before = (await replayState(page))!.speed;
    await pressKey(page, "s");
    await waitFor(async () => ((await replayState(page))!.speed !== before ? true : null), "the speed changes", 5000);
  }
  expect((await replayState(page))!.speed).toBe(4);
  // Play from the start, whether or not the replay was already playing when it opened.
  await page.evaluate(() =>
    (window as unknown as { __mcReplayDebug: { seek(n: number): Promise<unknown> } }).__mcReplayDebug.seek(0),
  );
  await settle(page, { quietMs: 300, maxMs: 2000 });
  if (!(await replayState(page))!.playing)
    await page.evaluate(() =>
      (window as unknown as { __mcReplayDebug: { togglePlay(): void } }).__mcReplayDebug.togglePlay(),
    );
  await waitFor(async () => ((await replayState(page))!.playing ? true : null), "the replay plays", 5000);
  await page.evaluate(() => {
    (window as unknown as { __sawVillainPhase?: boolean }).__sawVillainPhase = false;
  });

  // Play to the end with no input: the villain phase opens, closes itself, and the replay reaches its last command.
  let sawPhase = false;
  const start = Date.now();
  let last = "";
  while (Date.now() - start < 180_000) {
    const state = (await replayState(page))!;
    const scenes = await activeScenes(page);
    if (scenes.includes("VillainPhaseOverlay")) sawPhase = true;
    last = `${state.position} playing=${state.playing} ${scenes.join(",")}`;
    if (!state.playing && !scenes.includes("VillainPhaseOverlay")) break;
    await page.waitForTimeout(250); // loop pacing
  }
  sawPhase ||= await page.evaluate(
    () => (window as unknown as { __sawVillainPhase?: boolean }).__sawVillainPhase === true,
  );
  expect(sawPhase, `the replay showed the villain phase (last: ${last})`).toBe(true);
  expect(await activeScenes(page), `stuck: ${last}`).not.toContain("VillainPhaseOverlay");
  expect((await replayState(page))!.position, "the replay reached its end").toBe(game!.commandCount);
  expect(errors).toEqual([]);
}

test("a replay at 4x plays through the villain phase without a Start player phase press (reduced motion)", ({
  page,
}, info) => playsThrough(page, info));

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });
  test("a replay at 4x plays through the villain phase without a Start player phase press", ({ page }, info) =>
    playsThrough(page, info));
});
