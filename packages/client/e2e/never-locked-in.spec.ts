import { expect, test } from "@playwright/test";
import {
  activeScenes,
  clickFocus,
  clickText,
  guideStepId,
  guideStopped,
  installPageHelpers,
  isSceneUp,
  pressKey,
  pressUntil,
  settle,
  startTutorialFromTitle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";
import { hook } from "./wave6-helpers-b.js";

/**
 * §3.10 "never locked in" (`docs/guided-mode.md`): every guide surface always offers "Skip this step" and Escape,
 * and Pause always offers "Stop tutorial" whenever a guided run is active — regressions here would trap a player
 * inside the tutorial with no way out, so this gets its own spec rather than folding into the happy-path run.
 */
test("clicks outside the guide never land, however many there are, and the guide points at Skip (#554)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await installPageHelpers(page);
  await page.goto("/");
  await startTutorialFromTitle(page);
  await waitFor(async () => (await guideStepId(page)) === "play-aunt-may" || null, "lesson2 play-aunt-may step");
  await settle(page);

  for (let press = 0; press < 4; press++) await clickFocus(page, "basic:changeForm");
  await settle(page);

  const form = await page.evaluate(async () => {
    const mod = await import("/src/session.ts");
    const state = (mod as unknown as { appSession: () => { store: { state: unknown } } }).appSession().store.state as {
      game?: { players: { identity: { form: string } }[] };
    };
    return state.game!.players[0]!.identity.form;
  });
  expect(form, "Flip never landed").toBe("alterEgo");
  expect(await guideStepId(page), "the guide stays on its step").toBe("play-aunt-may");
  expect(await hook<string>(page, "__mcBoardDebug", "guideNudge"), "the guide points at Skip").toContain("Skip");
  expect(errors).toEqual([]);
});

test("Skip this step, Escape and Stop tutorial all release the player, and the game stays playable", async ({
  page,
}) => {
  // A full guided run clicks through many real steps; on a software-rendered CI runner that takes minutes, not seconds.
  test.setTimeout(240_000);
  const errors = trackPageErrors(page);
  await installPageHelpers(page);
  await page.goto("/");
  await startTutorialFromTitle(page);

  // "Skip this step" advances past the current lesson step without completing it.
  await waitFor(async () => (await guideStepId(page)) === "play-aunt-may" || null, "lesson2 play-aunt-may step");
  const beforeSkip = await guideStepId(page);
  await pressUntil(
    page,
    () => clickText(page, "Skip this step"),
    async () => (await guideStepId(page)) !== beforeSkip,
    "Skip this step leaves its step",
  );
  const afterSkip = await guideStepId(page);
  expect(afterSkip, `Skip this step advances past "${beforeSkip}"`).not.toBe(beforeSkip);

  // Escape releases the current gate the same way (guide/guide-controller.ts: onGateReleased -> skip()).
  await waitFor(
    async () => {
      const step = await guideStepId(page);
      return step && step !== afterSkip ? step : null;
    },
    "a fresh guide step is showing",
    8000,
  ).catch(() => {
    // If the run is already past scripted steps (e.g. only the waiting/complete state remains), Escape still must
    // not throw or lock anything — the assertions below just have nothing to advance.
  });
  const beforeEscape = await guideStepId(page);
  if (beforeEscape !== null) {
    await pressUntil(
      page,
      () => pressKey(page, "Escape"),
      async () => (await guideStepId(page)) !== beforeEscape,
      "Escape leaves its step",
    );
  } else {
    await pressKey(page, "Escape");
    await settle(page);
  }
  const afterEscape = await guideStepId(page);
  if (beforeEscape !== null) {
    expect(afterEscape, `Escape advances past "${beforeEscape}"`).not.toBe(beforeEscape);
  }

  // Stop tutorial (from Pause) ends guidance outright, and the game is still playable underneath it.
  await pressUntil(
    page,
    () => clickText(page, "MENU"),
    () => isSceneUp(page, "PauseOverlay"),
    "MENU opens Pause",
  );
  let scenes = await activeScenes(page);
  expect(scenes, "MENU opens Pause").toContain("PauseOverlay");
  await pressUntil(
    page,
    () => clickText(page, "Stop tutorial", { sceneKey: "PauseOverlay" }),
    () => guideStopped(page),
    "Stop tutorial stops the guide",
  );
  await pressUntil(
    page,
    () => clickText(page, "Resume", { sceneKey: "PauseOverlay" }),
    async () => !(await isSceneUp(page, "PauseOverlay")),
    "Resume closes Pause",
  );
  scenes = await activeScenes(page);
  expect(scenes, "Pause closes after Resume").not.toContain("PauseOverlay");
  expect(await guideStopped(page), "guide reports stopped").toBe(true);

  // The board is still a real, playable game: the end-turn control still has a live focus rect.
  const endTurnRect = await clickFocus(page, "basic:endTurn").catch(() => null);
  expect(endTurnRect, "End turn is still a live, clickable control after Stop tutorial").not.toBeNull();

  expect(errors, `no page errors (${JSON.stringify(errors)})`).toEqual([]);
});
