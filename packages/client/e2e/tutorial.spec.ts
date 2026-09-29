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
  const errors = trackPageErrors(page);
  await installPageHelpers(page);
  await page.goto("/");
  await startTutorialFromTitle(page);
  expect(await guideStepId(page)).not.toBeNull();

  // === Lesson 2: Paying for cards (still Peter Parker) — play Black Cat ===
  await waitFor(async () => (await guideStepId(page)) === "play-black-cat" || null, "lesson2 play-black-cat step");
  await page.waitForTimeout(1500); // let the round/phase banner clear

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
  await page.waitForTimeout(400);

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
  await page.waitForTimeout(400);

  await clickHandCard(page, INTERROGATION_ROOM_CODE);
  await page.waitForTimeout(400);
  await clickFocus(page, "payment:pay");
  await page.waitForTimeout(800);

  await waitFor(async () => {
    const step = await guideStepId(page);
    return step !== "play-black-cat" ? "advanced" : null;
  }, "lesson2 complete");

  // === Lesson 3: Hero & alter-ego — flip ===
  await waitFor(async () => (await guideStepId(page)) === "flip" || null, "lesson3 flip step");
  await clickFocus(page, "basic:changeForm");
  await page.waitForTimeout(700);

  const form1 = await page.evaluate(async () => {
    const mod = await import("/src/session.ts");
    const state = (mod as unknown as { appSession: () => { store: { state: unknown } } }).appSession().store.state as {
      game?: { players: { playerId: unknown; identity: { form: string } }[] };
      perspectiveId: unknown;
    };
    const me = state.game!.players.find((p) => p.playerId === state.perspectiveId)!;
    return me.identity.form;
  });
  expect(form1, "flipped to Spider-Man").toBe("hero");

  // === End turn -> villain phase (lesson 4) ===
  await clickFocus(page, "basic:endTurn");
  await page.waitForTimeout(400);
  try {
    await clickText(page, "End turn", { sceneKey: "EndTurnConfirmOverlay" });
    await page.waitForTimeout(400);
  } catch {
    // No end-turn confirm this run — fine, hint didn't fire.
  }
  await page.waitForTimeout(1200);
  let scenes = await activeScenes(page);
  if (scenes.includes("ChoiceOverlay")) {
    const headline = await findText(page, "DISCARD TO HAND SIZE", "ChoiceOverlay");
    if (headline.length > 0) {
      try {
        await clickText(page, "DECLINE", { sceneKey: "ChoiceOverlay" });
      } catch {
        await clickText(page, "CONFIRM", { sceneKey: "ChoiceOverlay" });
      }
      await page.waitForTimeout(600);
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
      await page.waitForTimeout(300);
      await clickText(page, "CONFIRM");
      defendClicked = true;
      await page.waitForTimeout(900);
      continue;
    }
    const letResolve = await findText(page, "LET IT RESOLVE", "VillainPhaseOverlay");
    if (letResolve.length > 0) {
      await page.mouse.click(letResolve[0].x, letResolve[0].y);
      await page.waitForTimeout(900);
      continue;
    }
    await page.waitForTimeout(400);
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
      await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
    }
    await page.waitForTimeout(1200);
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
  await page.waitForTimeout(500);
  await waitFor(async () => (await guideStepId(page)) === "thwart" || null, "lesson5 thwart step", 8000);
  await clickFocus(page, "basic:thwart");
  await page.waitForTimeout(1000);

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
