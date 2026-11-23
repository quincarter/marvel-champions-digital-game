import { expect, test } from "@playwright/test";
import { pressHookStop, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors, waitForScene } from "./wave6-helpers-a.js";
import { dealToFirstTurn, gameFacts, quietGuide } from "./wave6-helpers-b.js";

/**
 * A reload in a single-player game (the address keeps `#game=<saveId>`): the page comes back into the same game at the
 * same state, straight from the local save, not to Title. No room worker or socket is involved. Unit tests:
 * `platform/game-address.test.ts`.
 */
test("reloading in a single-player game resumes the same game from its save, not Title", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.addInitScript(() => {
    const seen = { workers: [] as string[], sockets: 0 };
    (window as unknown as { __mcSeen: typeof seen }).__mcSeen = seen;
    const RealWorker = window.Worker;
    window.Worker = class extends RealWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        seen.workers.push(options?.name ?? String(url));
      }
    } as typeof Worker;
  });
  await page.goto("/?screen=table-setup");
  await waitForScene(page, "Setup", 30000);
  await settle(page);
  await pressHookStop(page, "__mcTableSetupDebug", "deal-it-out");
  await dealToFirstTurn(page);

  // The deal is saved as it goes; the address names the save.
  const hash = await waitFor(
    async () =>
      (await page.evaluate(() => location.hash)).startsWith("#game=") ? await page.evaluate(() => location.hash) : null,
    "#game=<saveId> in the address",
    15000,
  );
  const before = await gameFacts<{ id: string; round: number; version: number }>(
    page,
    "(s) => ({ id: s.gameId, round: s.game.round, version: s.version })",
  );
  expect(hash).toBe(`#game=${before.id}`);

  // The dev `?screen=` jump would win over the link on a reload; a player's address has none.
  await page.evaluate(() => history.replaceState(null, "", location.pathname + location.hash));
  await page.reload();

  // Straight into the board, the same game at the same state, the address unchanged.
  await waitForScene(page, "Board", 60000);
  const after = await waitFor(
    async () => {
      const facts = await gameFacts<{ id: string | null; round: number; version: number; status: string }>(
        page,
        "(s) => ({ id: s.gameId, round: s.game ? s.game.round : 0, version: s.version, status: s.status })",
      );
      return facts.status === "playing" && facts.id ? facts : null;
    },
    "the game to resume from its save",
    60000,
  );
  expect(after.id).toBe(before.id);
  expect(after.round).toBe(before.round);
  expect(after.version).toBe(before.version);
  expect(await page.evaluate(() => location.hash)).toBe(hash);
  // No room was involved.
  const seen = await page.evaluate(() => (window as unknown as { __mcSeen: { workers: string[] } }).__mcSeen);
  expect(seen.workers).not.toContain("mc-live-room");
  expect(errors.filter((e) => e.startsWith("pageerror"))).toEqual([]);
});

test("a save that is gone sends a reload to Title and clears the address", async ({ page }) => {
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.goto("/#game=00000000-0000-4000-8000-000000000000");
  await waitForScene(page, "Title", 60000);
  await waitFor(
    async () => ((await page.evaluate(() => location.hash)) === "" ? true : null),
    "the hash cleared",
    15000,
  );
});
