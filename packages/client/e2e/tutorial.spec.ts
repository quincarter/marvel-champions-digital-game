import { expect, test } from "@playwright/test";
import {
  BLACK_CAT_CODE,
  INTERROGATION_ROOM_CODE,
  activeScenes,
  clickFocus,
  clickHandCard,
  clickText,
  findText,
  guideStepId,
  guideStopped,
  installPageHelpers,
  pressAt,
  pressEndTurn,
  pressUntil,
  settle,
  startTutorialFromTitle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";

/**
 * The tutorial's happy path, end to end (`docs/guided-mode.md` §4 G11, §5.1): New Game → chooser → Learn as you
 * play → How to win → Start the fight → all five lessons → "Tutorial complete". Ported from the scratchpad
 * `reorder/run.mjs` QA script that verified the lesson reorder (`8fad90dc`) — this is that script's spine, kept
 * lean per the brief (state assertions via the debug hooks, not pixel screenshots).
 */
test("plays the tutorial to completion", async ({ page }) => {
  // A full guided run clicks through many real steps; on a software-rendered CI runner that takes minutes, not seconds.
  test.setTimeout(240_000);
  const errors = trackPageErrors(page);
  await installPageHelpers(page);
  await page.goto("/");
  await startTutorialFromTitle(page);
  expect(await guideStepId(page)).not.toBeNull();

  // === Lesson 2: Paying for cards (still Peter Parker) — play Black Cat ===
  await waitFor(async () => (await guideStepId(page)) === "play-black-cat" || null, "lesson2 play-black-cat step");
  await settle(page);

  const form0 = await page.evaluate(async () => {
    const mod = await import("/src/session.ts");
    const state = (mod as unknown as { appSession: () => { store: { state: unknown } } }).appSession().store.state as {
      game?: { players: { playerId: unknown; identity: { form: string } }[] };
      perspectiveId: unknown;
    };
    const me = state.game!.players.find((p) => p.playerId === state.perspectiveId)!;
    return me.identity.form;
  });
  expect(form0, "still Peter Parker (alter-ego) when lesson 2 opens").toBe("alterEgo");

  await clickHandCard(page, BLACK_CAT_CODE);
  await settle(page);

  const identityId = await page.evaluate(async () => {
    const mod = await import("/src/session.ts");
    const state = (mod as unknown as { appSession: () => { store: { state: unknown } } }).appSession().store.state as {
      game?: { players: { playerId: unknown; identity: { instanceId: string } }[] };
      perspectiveId: unknown;
    };
    const me = state.game!.players.find((p) => p.playerId === state.perspectiveId)!;
    return me.identity.instanceId;
  });
  expect(identityId, "identity instance id resolved").toBeTruthy();
  await clickFocus(page, `card:${identityId}`);
  await settle(page);

  await clickHandCard(page, INTERROGATION_ROOM_CODE);
  await settle(page);
  await clickFocus(page, "payment:pay");
  await settle(page);

  await waitFor(async () => {
    const step = await guideStepId(page);
    return step !== "play-black-cat" ? "advanced" : null;
  }, "lesson2 complete");

  // === Lesson 3: Hero & alter-ego — flip ===
  await waitFor(async () => (await guideStepId(page)) === "flip" || null, "lesson3 flip step");
  const formNow = () =>
    page.evaluate(async () => {
      const mod = await import("/src/session.ts");
      const state = (mod as unknown as { appSession: () => { store: { state: unknown } } }).appSession().store
        .state as {
        game?: { players: { playerId: unknown; identity: { form: string } }[] };
        perspectiveId: unknown;
      };
      const me = state.game!.players.find((p) => p.playerId === state.perspectiveId)!;
      return me.identity.form;
    });
  await pressUntil(
    page,
    () => clickFocus(page, "basic:changeForm"),
    async () => (await formNow()) === "hero",
    "the flip turns Peter Parker into Spider-Man",
  );
  expect(await formNow(), "flipped to Spider-Man").toBe("hero");

  // === Lesson 3's own "Attack Rhino" steps: Black Cat, then Spider-Man ===
  await waitFor(
    async () => (await guideStepId(page)) === "attack-with-black-cat" || null,
    "lesson3 attack-with-black-cat step",
  );
  await clickFocus(page, "basic:attack");
  await settle(page);
  // Both Spider-Man and Black Cat can attack right now, so the "Attack with" picker opens, and the guide's
  // TRY THIS moves onto Black Cat's own button (`view/guide-source-override.ts`).
  const sources = await waitFor(async () => {
    const rects = await page.evaluate(() =>
      (window as unknown as { __mcBoardDebug: { allFocusRects: () => [string, unknown][] } }).__mcBoardDebug
        .allFocusRects()
        .filter(([key]) => key.startsWith("source:")),
    );
    return rects.length === 2 ? rects : null;
  }, "attack-with picker");
  const anchor = await page.evaluate(() =>
    (window as unknown as { __mcBoardDebug: { guideAnchorRect: () => unknown } }).__mcBoardDebug.guideAnchorRect(),
  );
  const suggested = sources.find(([, rect]) => JSON.stringify(rect) === JSON.stringify(anchor));
  expect(suggested, "TRY THIS rings one of the picker's buttons").toBeTruthy();
  await clickFocus(page, suggested![0]);
  await settle(page);

  await waitFor(
    async () => (await guideStepId(page)) === "attack-with-spidey" || null,
    "lesson3 attack-with-spidey step",
  );
  // Only Spider-Man can attack now (Black Cat is exhausted), so this dispatches straight away — no picker.
  await clickFocus(page, "basic:attack");
  await settle(page);

  await waitFor(async () => {
    const step = await guideStepId(page);
    return step !== "attack-with-spidey" ? "advanced" : null;
  }, "lesson3 complete");

  // === End turn -> villain phase (lesson 4) ===
  await pressEndTurn(page);
  await settle(page);
  let scenes = await activeScenes(page);
  if (scenes.includes("ChoiceOverlay")) {
    const headline = await findText(page, "DISCARD TO HAND SIZE", "ChoiceOverlay");
    if (headline.length > 0) {
      try {
        await clickText(page, "DECLINE", { sceneKey: "ChoiceOverlay" });
      } catch {
        await clickText(page, "CONFIRM", { sceneKey: "ChoiceOverlay" });
      }
      await settle(page);
    }
  }

  let guidePickSeen = false;
  let defendClicked = false;
  for (let i = 0; i < 25; i++) {
    scenes = await activeScenes(page);
    if (!scenes.includes("VillainPhaseOverlay")) break;
    const guidePick = defendClicked ? [] : await findText(page, "GUIDE PICK");
    if (guidePick.length > 0) {
      guidePickSeen = true;
      await clickText(page, "Black Cat defends");
      await settle(page);
      await clickText(page, "CONFIRM");
      defendClicked = true;
      await settle(page);
      continue;
    }
    const letResolve = await findText(page, "LET IT RESOLVE", "VillainPhaseOverlay");
    if (letResolve.length > 0) {
      await pressAt(page, letResolve[0].x, letResolve[0].y);
      await settle(page);
      continue;
    }
    await settle(page);
  }
  expect(guidePickSeen, "GUIDE PICK shown on lesson 4's defend choice").toBe(true);
  scenes = await activeScenes(page);
  expect(scenes, "villain phase walkthrough closes").not.toContain("VillainPhaseOverlay");

  // === Round debrief after round 1 ===
  scenes = await activeScenes(page);
  if (!scenes.includes("RoundDebriefOverlay")) {
    await waitFor(async () => {
      const s = await activeScenes(page);
      return s.includes("RoundDebriefOverlay") ? s : null;
    }, "round debrief opens").catch(() => null);
  }
  scenes = await activeScenes(page);
  if (scenes.includes("RoundDebriefOverlay")) {
    const content = await page.evaluate(
      () =>
        (
          window as unknown as { __mcRoundDebriefDebug?: { content?: () => { lessons: { status: string }[] } | null } }
        ).__mcRoundDebriefDebug?.content?.() ?? null,
    );
    const doneCount = (content?.lessons ?? []).filter((l) => l.status === "done").length;
    expect(doneCount, "round-1 debrief shows 4 lessons done").toBe(4);

    const layout = await page.evaluate(
      () =>
        (
          window as unknown as {
            __mcRoundDebriefDebug?: {
              layout?: () => { nextRound?: { x: number; y: number; width: number; height: number } } | null;
            };
          }
        ).__mcRoundDebriefDebug?.layout?.() ?? null,
    );
    if (layout?.nextRound) {
      const r = layout.nextRound;
      await pressAt(page, r.x + r.width / 2, r.y + r.height / 2);
    }
    await settle(page);
  }

  // === Round 2: lesson 5, threat & thwarting ===
  await waitFor(
    async () => (await guideStepId(page)) === "spotlight-scheme" || null,
    "lesson5 spotlight-scheme step",
    10000,
  );
  try {
    await clickText(page, "Got it", { sceneKey: "Board" });
  } catch {
    // Some layouts acknowledge the step by other means; the thwart-step wait below still holds it accountable.
  }
  await settle(page);
  await waitFor(async () => (await guideStepId(page)) === "thwart" || null, "lesson5 thwart step", 8000);
  await clickFocus(page, "basic:thwart");
  await settle(page);

  const tutorialComplete = await waitFor(
    async () => {
      const stopped = await guideStopped(page);
      const matches = await findText(page, "Tutorial complete");
      return stopped || matches.length > 0 ? true : null;
    },
    "tutorial complete",
    10000,
  );
  expect(tutorialComplete, "Tutorial reaches complete state").toBe(true);

  expect(errors, `no page errors during the tutorial (${JSON.stringify(errors)})`).toEqual([]);
});
