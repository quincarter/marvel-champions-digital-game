import { expect, test } from "@playwright/test";
import {
  activeScenes,
  clickFocus,
  clickHandCard,
  clickText,
  findText,
  focusRect,
  guideStepId,
  installPageHelpers,
  isSceneUp,
  pressAt,
  pressUntil,
  settle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";

const PAUSE = "PauseOverlay";

/** Presses Try it until `reached` (the game, or its first step) is up: one press can be lost while the lesson draws. */
async function clickTryIt(page: import("@playwright/test").Page, reached: () => Promise<unknown>): Promise<void> {
  const tryItRect = () =>
    page.evaluate(
      () =>
        (
          window as unknown as { __mcAspectLessonDebug?: { tryItRect: () => unknown } }
        ).__mcAspectLessonDebug?.tryItRect() as {
          x: number;
          y: number;
          width: number;
          height: number;
        } | null,
    );
  await pressUntil(
    page,
    async () => {
      await waitFor(tryItRect, "Try it button");
      await settle(page, { quietMs: 200, maxMs: 1500 });
      const rect = await waitFor(tryItRect, "Try it button");
      await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
    },
    reached,
    "Try it starts the game",
  );
}

/**
 * An aspect lesson's "Try it" still starts a game after the player concedes the last one and comes back (owner
 * report, 2026-09-29): Phaser reuses the scene object, so the lesson's own double-tap guard has to reset per visit.
 */
test("Try it works again after conceding a Try it game", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackPageErrors(page);
  await installPageHelpers(page);
  await page.goto("/?screen=aspect&aspect=aggression");

  const onBoard = () => isSceneUp(page, "Board");
  await clickTryIt(page, onBoard);
  await settle(page);

  await pressUntil(
    page,
    () => clickText(page, "Menu", { sceneKey: "Board" }),
    () => isSceneUp(page, PAUSE),
    "Menu opens Pause",
  );
  // The Pause sheet is still sliding in when its buttons first exist, and a click then is swallowed: tap Concede
  // until the confirmation is really up (a retry is what a player does too), then confirm.
  await pressUntil(
    page,
    () => clickText(page, "Concede", { sceneKey: PAUSE }),
    async () => (await findText(page, "Yes, concede", PAUSE)).length > 0,
    "the concede confirmation",
  );
  await pressUntil(
    page,
    () => clickText(page, "Yes, concede", { sceneKey: PAUSE }),
    async () => !(await onBoard()),
    "conceding leaves the board",
  );

  // Back to the same aspect's lesson page, the way How to play opens it.
  await page.evaluate(() => {
    const game = (
      window as unknown as {
        __mcGame: {
          scene: { getScenes: (active: boolean) => { scene: { start: (key: string, data: unknown) => void } }[] };
        };
      }
    ).__mcGame;
    game.scene.getScenes(true)[0]!.scene.start("AspectLesson", { aspect: "aggression", backTo: "howToPlay" });
  });
  await waitFor(async () => (await activeScenes(page)).includes("AspectLesson") || null, "lesson page again");

  await clickTryIt(page, onBoard);
  expect(errors).toEqual([]);
});

async function guideAnchor(page: import("@playwright/test").Page): Promise<unknown> {
  return page.evaluate(() =>
    (window as unknown as { __mcBoardDebug: { guideAnchorRect: () => unknown } }).__mcBoardDebug.guideAnchorRect(),
  );
}

async function handIdFor(page: import("@playwright/test").Page, code: string): Promise<string> {
  return page.evaluate(async (c) => {
    const mod = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: { state: { game: { players: { hand: string[] }[]; instances: Record<string, { cardId: string }> } } };
      };
    };
    const { game } = mod.appSession().store.state;
    return game.players[0]!.hand.find((id) => game.instances[id]!.cardId === c)!;
  }, code);
}

/**
 * Justice's Daredevil costs 4, paid with Strength then Genius: once his payment opens, TRY THIS walks each payer
 * and then Pay, the same way the tutorial's Black Cat walk does (owner report, 2026-09-29: the spotlight stayed on
 * Daredevil and darkened the cards that pay for him).
 */
test("Justice Try it: TRY THIS walks Daredevil's payment, Strength then Genius then Pay", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackPageErrors(page);
  await installPageHelpers(page);
  await page.goto("/?screen=aspect&aspect=justice");
  await clickTryIt(page, async () => (await guideStepId(page)) === "intro");
  // The button can still be sliding in when the text exists, and a click on it then is lost: click until the step moves.
  await pressUntil(
    page,
    () => clickText(page, "Got it", { sceneKey: "Board", timeoutMs: 2000 }).catch(() => undefined),
    async () => (await guideStepId(page)) === "play-signature",
    "Got it moves to the play Daredevil step",
  );
  // The round banner holds the spotlight back until it clears: wait for the ring itself, not a guessed delay.
  await waitFor(async () => (await guideAnchor(page)) ?? null, "the spotlight is up");

  const strength = await handIdFor(page, "01090");
  const genius = await handIdFor(page, "01089");
  await pressUntil(
    page,
    () => clickHandCard(page, "01058"),
    () => focusRect(page, "payment:pay"),
    "Daredevil's payment opens",
  );
  for (const key of [`card:${strength}`, `card:${genius}`, "payment:pay"]) {
    await waitFor(async () => {
      const expected = await focusRect(page, key);
      return expected && JSON.stringify(await guideAnchor(page)) === JSON.stringify(expected) ? true : null;
    }, `TRY THIS on ${key}`);
    // The press has landed once TRY THIS has moved off this control.
    await pressUntil(
      page,
      () => clickFocus(page, key),
      async () => {
        const rect = await focusRect(page, key);
        return !rect || JSON.stringify(await guideAnchor(page)) !== JSON.stringify(rect);
      },
      `${key} is pressed`,
    );
  }
  await waitFor(async () => (await guideStepId(page)) === "daredevil-does-both" || null, "Daredevil played");
  expect(errors).toEqual([]);
});
