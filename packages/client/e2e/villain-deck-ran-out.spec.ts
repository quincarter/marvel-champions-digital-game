import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressAt, settle, waitFor } from "./helpers.js";
import { continueRect, villainDebugRect } from "./overlay-helpers.js";
import { answerChoiceSheet, installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { openApp, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #984: a player whose deck runs out at the end of the player phase is dealt a facedown encounter card (RRG 1.8
 * "Player Deck", p. 33), revealed in the villain phase ahead of step 3's card. The walkthrough used to say "1 card
 * each" and then reveal two with nothing to say why. Rhino with Spider-Man, the hand down to 1 card and the deck to 1,
 * so the draw up to hand size empties the deck: the strip lists that card first, marked DECK RAN OUT.
 */

test.use({ reducedMotion: "no-preference" });

interface PhaseDebug {
  readonly encounterStrip: readonly string[];
  readonly encounterMarks: readonly string[];
}

const phaseDebug = (page: Page): Promise<PhaseDebug> =>
  page.evaluate(() =>
    (
      (window as unknown as { __mcGame: { scene: { getScene(k: string): unknown } } }).__mcGame.scene.getScene(
        "VillainPhaseOverlay",
      ) as { debugState(): PhaseDebug }
    ).debugState(),
  );

async function startWithDeckAboutToRunOut(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false }),
    );
  });
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const session = (await import("/src/session.ts")) as any;
    const { DevStateHost } = (await import("/src/engine/dev-state-host.ts")) as any;
    const { POOL_DEPS } = (await import("/src/content/pool.ts")) as any;
    const config = {
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 7,
    };
    const { store } = session.appSession();
    await store.start(config);
    // Keep the opening hand (the mulligan), so the staged state is the first turn's.
    for (let guard = 0; guard < 10 && store.state.legal?.actions.kind === "choice"; guard++) {
      const choice = store.state.legal.actions.choice;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o: any) => o.optionId));
    }
    const game = store.state.game;
    const staged = {
      ...game,
      players: game.players.map((player: any) => ({
        ...player,
        hand: player.hand.slice(0, 1),
        deck: player.deck.slice(0, 1),
        discard: [...player.discard, ...player.hand.slice(1), ...player.deck.slice(1)],
      })),
    };
    session.useDevHost(new DevStateHost(staged, POOL_DEPS));
    await session.appSession().store.start(config);
    const scenes = (window as any).__mcGame.scene;
    for (const s of scenes.getScenes(true)) scenes.stop(s.sys.settings.key);
    scenes.start("Board");
  });
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "Board is up", 20000);
  await settle(page);
  await page.evaluate(async () => {
    const { store } = ((await import("/src/session.ts")) as any).appSession();
    const end = store.state.legal?.actions.legal?.find((e: any) => e.action.kind === "endTurn");
    // One command ends the turn, empties the deck in the draw up to hand size and runs the whole villain phase: any
    // choice after it is the next turn's, left to the walkthrough as a player would.
    if (end) await store.dispatch(end.example);
  });
  await settle(page);
}

const press = async (page: Page, phone: boolean, rect: Rect): Promise<void> => {
  await settle(page);
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (phone) await page.touchscreen.tap(x, y);
  else await pressAt(page, x, y);
};

test("the card a deck running out deals is listed first on the strip, marked DECK RAN OUT (#984)", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await startWithDeckAboutToRunOut(page);
  let shotDuringReveal = false;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline && !(await continueRect(page))) {
    if ((await activeScenes(page)).includes("VillainPhaseOverlay")) {
      const debug = await phaseDebug(page);
      if (!shotDuringReveal && debug.encounterStrip[0] === "now") {
        expect(debug.encounterMarks[0]).toBe("DECK RAN OUT");
        expect(debug.encounterStrip).toHaveLength(2);
        expect(debug.encounterMarks[1]).toBe("");
        if (SHOT) await page.screenshot({ path: `${SHOT}/984-strip-${info.project.name}.png` });
        shotDuringReveal = true;
      }
    }
    let pressed = false;
    for (const name of ["startRect", "answerRect", "nextRect", "flipRect"]) {
      const rect = await villainDebugRect(page, name);
      if (rect) {
        await press(page, phone, rect);
        pressed = true;
        break;
      }
    }
    if (!pressed && (await activeScenes(page)).includes("ChoiceOverlay")) await answerChoiceSheet(page);
    await page.waitForTimeout(150);
  }
  expect(shotDuringReveal, "the deck's card was revealed first, with its mark").toBe(true);
  expect(await continueRect(page), "the recap is up").not.toBeNull();
  await settle(page);
  if (SHOT) await page.screenshot({ path: `${SHOT}/984-recap-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
