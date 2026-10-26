import { expect, test } from "@playwright/test";
import { activeScenes, clickFocus, clickText, settle, waitFor } from "./helpers.js";
import { PAD, installPad, padTap, padWake } from "./pad-e2e-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";

/**
 * Start on the "End your turn?" sheet confirms it and does nothing else: one press, one thing. The press used to reach
 * the sheet and then, once the sheet had closed, the Board's own Start as well, which opened Pause over the new phase.
 */

test.use({ viewport: { width: 1280, height: 800 } });

test("Start on the End turn confirm ends the turn and does not also open Pause", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installPad(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=abilities");
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "the board is up", 120_000);
  await settle(page, { quietMs: 600, maxMs: 5000 });
  await padWake(page);

  await clickFocus(page, "basic:endTurn");
  // The fixture's guide also says "Hold on!" first: End turn anyway lets the confirm ask.
  await waitFor(
    async () => ((await activeScenes(page)).includes("HoldOnOverlay") ? true : null),
    "Hold on! opens",
    15_000,
  );
  await clickText(page, "End turn anyway", { sceneKey: "HoldOnOverlay" });
  await waitFor(
    async () => ((await activeScenes(page)).includes("EndTurnConfirmOverlay") ? true : null),
    "the End turn confirm opens",
    15_000,
  );
  await settle(page, { quietMs: 400, maxMs: 3000 });

  // Any attempt to launch Pause over the Board, even one a decision sheet would hide again.
  await page.evaluate(() => {
    const board = (window as any).__mcGame.scene.getScene("Board");
    const launch = board.scene.launch.bind(board.scene);
    (window as any).__launched = [];
    board.scene.launch = (key: string, data?: unknown) => {
      (window as any).__launched.push(key);
      return launch(key, data);
    };
  });
  await padTap(page, PAD.start);
  await waitFor(
    async () => ((await activeScenes(page)).includes("EndTurnConfirmOverlay") ? null : true),
    "Start answers the confirm",
    10_000,
  );
  await settle(page, { quietMs: 600, maxMs: 4000 });

  const scenes = await activeScenes(page);
  expect(scenes, "the same Start also opened Pause").not.toContain("PauseOverlay");
  const launched = await page.evaluate(() => (window as any).__launched as string[]);
  expect(launched, "the Board launched Pause for the press the sheet took").not.toContain("PauseOverlay");
  expect(errors).toEqual([]);
});

test("Start on a confirm that opens nothing after it leaves the Board idle, with no Pause", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installPad(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=abilities");
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "the board is up", 120_000);
  await settle(page, { quietMs: 600, maxMs: 5000 });
  await padWake(page);

  // The confirm with an answer that starts no phase and opens no sheet, so nothing else keeps the Board blocked after it.
  await page.evaluate(() => {
    const game = (window as any).__mcGame;
    (window as any).__confirmed = 0;
    game.scene.getScene("Board").scene.launch("EndTurnConfirmOverlay", {
      sentence: "You can still: nothing.",
      from: "Board",
      onConfirm: () => ((window as any).__confirmed += 1),
    });
  });
  await waitFor(
    async () => ((await activeScenes(page)).includes("EndTurnConfirmOverlay") ? true : null),
    "the confirm opens",
    15_000,
  );
  await settle(page, { quietMs: 400, maxMs: 3000 });

  await padTap(page, PAD.start);
  await waitFor(
    async () => ((await activeScenes(page)).includes("EndTurnConfirmOverlay") ? null : true),
    "Start answers the confirm",
    10_000,
  );
  await settle(page, { quietMs: 600, maxMs: 4000 });

  expect(await page.evaluate(() => (window as any).__confirmed as number), "Start confirmed once").toBe(1);
  expect(await activeScenes(page), "the same Start also opened Pause").not.toContain("PauseOverlay");

  // The Board takes the next press as it always did: Start on an idle table opens Pause.
  await padTap(page, PAD.start);
  await waitFor(
    async () => ((await activeScenes(page)).includes("PauseOverlay") ? true : null),
    "a later Start opens Pause",
    10_000,
  );
  expect(errors).toEqual([]);
});
