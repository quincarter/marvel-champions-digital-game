import { expect, test, type Page } from "@playwright/test";
import {
  activeScenes,
  clickText,
  findText,
  guideStepId,
  installPageHelpers,
  isSceneUp,
  pressAt,
  pressEndTurn,
  pressUntil,
  settle,
  waitFor,
} from "./helpers.js";

type Band = { caption: string; deferred: boolean; elapsedMs: number } | null;

/** The round/phase band's own state (`__mcBoardDebug.phaseBand`): asserting on this rather than on pixels keeps the
 * test independent of how fast the runner draws — CI's software renderer is far slower than a laptop. */
async function phaseBand(page: Page): Promise<Band> {
  return page.evaluate(() =>
    (window as unknown as { __mcBoardDebug: { phaseBand: () => Band } }).__mcBoardDebug.phaseBand(),
  );
}

/** The durable record of every band queued (`__mcBoardDebug.phaseBandLog`). */
async function phaseBandLog(page: Page): Promise<{ caption: string; wasDeferred: boolean; played: boolean }[]> {
  return page.evaluate(() =>
    (
      window as unknown as {
        __mcBoardDebug: { phaseBandLog: () => { caption: string; wasDeferred: boolean; played: boolean }[] };
      }
    ).__mcBoardDebug.phaseBandLog(),
  );
}

/**
 * Every round after the first, the ROUND N · PLAYER PHASE band used to play behind the villain phase walkthrough,
 * which stays up into the next player phase until the player presses Continue (owner report, 2026-09-29). It now
 * waits for the walkthrough to close. Driven with the Justice Try it game, whose round-1 villain phase has no
 * decision in it, so ending the turn also runs straight into round 2 in one batch.
 */
test("the round 2 player phase band plays after the villain phase walkthrough, not behind it", async ({ page }) => {
  test.setTimeout(120_000);
  await installPageHelpers(page);
  await page.goto("/?screen=aspect&aspect=justice");
  // Reduced motion keeps the walkthrough up until Continue (it never auto-closes then), so a slow runner can't
  // miss the moment this test is about.
  await page.evaluate(async () => {
    const mod = (await import("/src/session.ts")) as unknown as {
      appSession: () => { settings: { reducedMotion: boolean } };
    };
    mod.appSession().settings.reducedMotion = true;
  });
  const tryItRect = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            __mcAspectLessonDebug?: {
              tryItRect: () => { x: number; y: number; width: number; height: number } | null;
            };
          }
        ).__mcAspectLessonDebug?.tryItRect() ?? null,
    );
  await pressUntil(
    page,
    async () => {
      await waitFor(tryItRect, "Try it button");
      await settle(page, { quietMs: 200, maxMs: 1500 });
      const tryIt = await waitFor(tryItRect, "Try it button");
      await pressAt(page, tryIt.x + tryIt.width / 2, tryIt.y + tryIt.height / 2);
    },
    async () => (await guideStepId(page)) === "intro",
    "Try it starts the Justice game",
  );
  // Round 1's own band has played out (scene time, so a slow runner waits as long as it needs to).
  await waitFor(async () => {
    const band = await phaseBand(page);
    return band === null || (!band.deferred && band.elapsedMs >= 3500) ? true : null;
  }, "round 1's band has played out");

  await pressEndTurn(page);

  let continueButton: { x: number; y: number } | null = null;
  for (let i = 0; i < 60 && !continueButton; i++) {
    const scenes = await activeScenes(page);
    if (scenes.includes("ChoiceOverlay")) {
      try {
        await clickText(page, "DECLINE", { sceneKey: "ChoiceOverlay", timeoutMs: 800 });
      } catch {
        await clickText(page, "CONFIRM", { sceneKey: "ChoiceOverlay", timeoutMs: 800 });
      }
      await settle(page);
      continue;
    }
    if (scenes.includes("VillainPhaseOverlay")) {
      const found = await findText(page, "Continue", "VillainPhaseOverlay");
      if (found.length > 0) continueButton = found[0]!;
    }
    if (!continueButton) await page.waitForTimeout(300); // loop pacing
  }
  expect(continueButton, "the walkthrough reached its Continue with round 2 begun").not.toBeNull();
  expect(
    await page.evaluate(async () => {
      const mod = (await import("/src/session.ts")) as unknown as {
        appSession: () => { store: { state: { game: { round: number; step: { phase: string } } } } };
      };
      const { game } = mod.appSession().store.state;
      return `${game.round}:${game.step.phase}`;
    }),
  ).toBe("2:player");

  // Held while the walkthrough covers the table...
  const held = await phaseBand(page);
  expect(held?.caption).toBe("ROUND 2 · PLAYER PHASE");
  expect(held?.deferred, "band held behind the walkthrough").toBe(true);
  await pressUntil(
    page,
    () => pressAt(page, continueButton!.x, continueButton!.y),
    async () => !(await isSceneUp(page, "VillainPhaseOverlay")),
    "Continue closes the walkthrough",
  );
  // ...then plays from its start once it's gone.
  // The band is on screen only for a moment, so read its record: it was held behind the walkthrough, and has played.
  await waitFor(
    async () => {
      const log = await phaseBandLog(page);
      return log.some((e) => e.caption === "ROUND 2 · PLAYER PHASE" && e.wasDeferred && e.played) ? true : null;
    },
    "ROUND 2 · PLAYER PHASE band played after being held",
    20_000,
  );
  expect(await activeScenes(page)).not.toContain("VillainPhaseOverlay");
});
