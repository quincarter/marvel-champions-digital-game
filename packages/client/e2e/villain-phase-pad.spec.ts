import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { continueRect, gameMarks, villainDebugRect } from "./overlay-helpers.js";
import { PAD, glyphIn, installPad, padTap, padWake } from "./pad-e2e-helpers.js";
import { answerChoiceSheet, installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, type Rect } from "./wave6-helpers-b.js";

/**
 * A pad alone plays the whole docked villain phase (owner report, 2026-10-24): every step's forward control wears a
 * glyph and answers A with nothing focused (Start from anywhere), the interrupt window's other answer wears X, and the
 * recap's big red button wears A. The glyphs are checked in place on the 1920 x 1080 table, then pressed.
 */

test.use({ viewport: { width: 1920, height: 1080 }, reducedMotion: "no-preference" });

const SCENE = "VillainPhaseOverlay";

async function openVillainInterrupt(page: Page): Promise<Rect> {
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  await installPad(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=villain-interrupt");
  const start = await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
  await padWake(page);
  return start;
}

/** A pad press that is "A with nothing focused": the primary of whatever the panel is waiting on. */
const pressA = (page: Page): Promise<void> => padTap(page, PAD.a);

/** The docked defend panel by pad: the D-pad to a defender, A to pick it, Start to confirm. */
async function defendWithPad(page: Page): Promise<void> {
  await settle(page, { quietMs: 300, maxMs: 2000 });
  await padTap(page, PAD.right);
  await padTap(page, PAD.a);
  await settle(page, { quietMs: 300, maxMs: 2000 });
  await padTap(page, PAD.start);
  await settle(page, { quietMs: 300, maxMs: 2000 });
}

/**
 * One move of the phase for a player with a pad: A on whatever control the panel is waiting on (START, ANSWER, Next card,
 * Flip, an interrupt's Use), the defend panel by D-pad, and the mouse for a choice sheet this spec is not about.
 */
async function stepPhase(page: Page): Promise<void> {
  if (await villainDebugRect(page, "confirmRect")) {
    await defendWithPad(page);
    return;
  }
  for (const name of ["startRect", "answerRect", "nextRect", "flipRect", "resolveRect"]) {
    if (await villainDebugRect(page, name)) {
      await pressA(page);
      return;
    }
  }
  if ((await activeScenes(page)).includes("ChoiceOverlay")) await answerChoiceSheet(page);
  await page.waitForTimeout(200);
}

/** Plays the phase on with the pad (and the mouse for sheets this spec is not about) until the recap's button shows. */
async function toRecap(page: Page): Promise<Rect> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const done = await continueRect(page);
    if (done) return done;
    await stepPhase(page);
  }
  throw new Error("the villain phase never reached its recap");
}

test("the interrupt window: A uses the card, and both answers wear a glyph", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  const start = await openVillainInterrupt(page);
  expect(await glyphIn(page, SCENE, "A", start), "the A glyph on START").toBe(true);
  await pressA(page);

  const resolve = await waitFor(() => villainDebugRect(page, "resolveRect"), "the interrupt window", 30_000);
  const use = (await villainDebugRect(page, "useRect"))!;
  await padWake(page);
  await settle(page, { quietMs: 300, maxMs: 2000 });
  expect(await glyphIn(page, SCENE, "A", use), "A on the card's Use").toBe(true);
  expect(await glyphIn(page, SCENE, "X", resolve), "X on Let it resolve").toBe(true);
  await page.screenshot({ path: "../../artifacts/qa/vp-interrupt-pad.png" });

  // A with nothing focused plays Spider-Sense: it draws a card, which the hand shows.
  const before = await gameMarks(page);
  await pressA(page);
  await waitFor(
    async () => ((await villainDebugRect(page, "resolveRect")) === null ? true : null),
    "the window closed",
    15_000,
  );
  await waitFor(
    async () => ((await gameMarks(page)).hand > before.hand ? true : null),
    "Spider-Sense drew a card",
    15_000,
  );
  expect(errors).toEqual([]);
});

test("the interrupt window: X lets it resolve and leaves the hand alone", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await openVillainInterrupt(page);
  await pressA(page);
  await waitFor(() => villainDebugRect(page, "resolveRect"), "the interrupt window", 30_000);
  await padWake(page);
  await settle(page, { quietMs: 300, maxMs: 2000 });
  const before = await gameMarks(page);
  await padTap(page, PAD.x);
  await waitFor(
    async () => ((await villainDebugRect(page, "resolveRect")) === null ? true : null),
    "the window closed",
    15_000,
  );
  expect((await gameMarks(page)).hand, "nothing was drawn").toBeLessThanOrEqual(before.hand);
  expect(errors).toEqual([]);
});

test("the recap's red button wears A, A closes the phase, and Full log wears X", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  await openVillainInterrupt(page);
  await pressA(page);
  // Let it resolve (X), answer the rest of the phase, and stop at the recap.
  await waitFor(() => villainDebugRect(page, "resolveRect"), "the interrupt window", 30_000);
  await padWake(page);
  await settle(page, { quietMs: 300, maxMs: 2000 });
  await padTap(page, PAD.x);
  await toRecap(page);
  await padWake(page);
  await settle(page, { quietMs: 600, maxMs: 4000 });
  // Read again once the panel has stopped sliding in: the rect the loop saw may be a frame of the slide.
  const cta = (await continueRect(page))!;
  expect(await glyphIn(page, SCENE, "A", cta), "the A glyph on Start player phase").toBe(true);
  await page.screenshot({ path: "../../artifacts/qa/vp-recap-pad.png" });

  await pressA(page);
  await waitFor(async () => ((await continueRect(page)) === null ? true : null), "A closed the phase", 15_000);
  await waitFor(
    async () => (!(await activeScenes(page)).includes(SCENE) ? true : null),
    "the villain phase screen is gone",
    15_000,
  );
  expect(errors).toEqual([]);
});

/** Ultron deals each hero an encounter card a round: with Flip and Hold on, the reveal stops on Flip and Next card. */
async function startAndEndTurn(page: Page): Promise<void> {
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: true, holdEncounterCards: true }),
    ),
  );
  await installPad(page);
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (cfg: unknown) => Promise<void> } };
    };
    await appSession().store.start({
      scenarioId: "ultron",
      difficulty: "standard",
      players: [{ starterDeckId: "core-captain-marvel-leadership" }],
      seed: 287,
    });
    const scenes = (
      window as unknown as {
        __mcGame: {
          scene: {
            getScenes: (a: boolean) => { sys: { settings: { key: string } } }[];
            stop: (k: string) => void;
            start: (k: string) => void;
          };
        };
      }
    ).__mcGame.scene;
    for (const s of scenes.getScenes(true)) scenes.stop(s.sys.settings.key);
    scenes.start("Board");
  });
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "Board is up", 20_000);
  await settle(page);
  await declineMulligans(page);
  await settle(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          dispatch: (c: unknown) => Promise<void>;
          state: { legal?: { actions: { legal?: { action: { kind: string }; example: unknown }[] } } };
        };
      };
    };
    const { store } = appSession();
    const end = store.state.legal?.actions.legal?.find((e) => e.action.kind === "endTurn");
    if (end) await store.dispatch(end.example);
  });
  await settle(page);
}

test("Flip Encounter Card and Next card each wear A, and A presses them", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  await startAndEndTurn(page);
  await padWake(page);

  let flipShot = false;
  let nextShot = false;
  let sawFlip = false;
  let sawNext = false;
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    if (await continueRect(page)) break;
    const flip = await villainDebugRect(page, "flipRect");
    const next = await villainDebugRect(page, "nextRect");
    if (flip) {
      sawFlip = true;
      // The mouse or the keys answered a sheet on the way here: a pad press says a pad is in use again.
      await padWake(page);
      await settle(page, { quietMs: 300, maxMs: 1500 });
      expect(await glyphIn(page, SCENE, "A", flip), "A on Flip Encounter Card").toBe(true);
      if (!flipShot) {
        flipShot = true;
        await page.screenshot({ path: "../../artifacts/qa/vp-flip-pad.png" });
      }
    } else if (next) {
      sawNext = true;
      await padWake(page);
      await settle(page, { quietMs: 300, maxMs: 1500 });
      expect(await glyphIn(page, SCENE, "A", next), "A on Next card").toBe(true);
      if (!nextShot) {
        nextShot = true;
        await page.screenshot({ path: "../../artifacts/qa/vp-next-pad.png" });
      }
    }
    await stepPhase(page);
  }
  expect(sawFlip, "the reveal stopped on a facedown card").toBe(true);
  expect(sawNext, "the reveal held on a card").toBe(true);
  expect(await continueRect(page), "the phase reaches its recap").not.toBeNull();
  expect(errors).toEqual([]);
});
