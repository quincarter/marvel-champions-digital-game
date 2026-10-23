import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressAt, settle, waitFor } from "./helpers.js";
import { continueRect, villainDebugRect } from "./overlay-helpers.js";
import { answerChoiceSheet, installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #386: revealing encounter cards one at a time must not give away what comes next. Rhino with Spider-Man on
 * seed 2 is dealt one encounter card whose surge deals a second, whose own surge deals a third. While the first card
 * waits facedown on Flip Encounter Card, the strip counts one card (not "1 OF 3"), nothing is "waiting", and the table
 * has neither surge card on it yet.
 */

test.use({ reducedMotion: "no-preference" });

interface PhaseDebug {
  readonly encounterStrip: readonly string[];
  readonly waiting: number | null;
}

interface TableGame {
  readonly villainArea: readonly string[];
  readonly players: readonly { readonly dealtEncounter: readonly string[]; readonly playArea: readonly string[] }[];
}

const phaseDebug = (page: Page): Promise<PhaseDebug> =>
  page.evaluate(() =>
    (
      (window as unknown as { __mcGame: { scene: { getScene(k: string): unknown } } }).__mcGame.scene.getScene(
        "VillainPhaseOverlay",
      ) as { debugState(): PhaseDebug }
    ).debugState(),
  );

const tableGame = (page: Page): Promise<TableGame> =>
  page.evaluate(() => (window as unknown as { __mcBoardDebug: { tableGame(): TableGame } }).__mcBoardDebug.tableGame());

/** The encounter cards revealed so far this game, in order. */
const revealedIds = (page: Page): Promise<string[]> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: { state: { commandTrail: readonly { events: readonly { type: string; instanceId?: string }[] }[] } };
      };
    };
    return appSession()
      .store.state.commandTrail.flatMap((entry) => entry.events)
      .filter((event) => event.type === "encounterCardRevealed")
      .map((event) => event.instanceId!);
  });

async function startAndEndTurn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: true }),
    );
  });
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (cfg: unknown) => Promise<void> } };
    };
    await appSession().store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 2,
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
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "Board is up", 20000);
  await settle(page);
  await declineMulligans(page);
  await settle(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          dispatch: (c: unknown) => Promise<void>;
          resolveChoice: (ids: string[]) => Promise<void>;
          state: {
            legal?: {
              actions: {
                kind: string;
                legal?: { action: { kind: string }; example: unknown }[];
                choice?: { minSelections: number; options: { optionId: string }[] };
              };
            };
          };
        };
      };
    };
    const { store } = appSession();
    const end = store.state.legal?.actions.legal?.find((e) => e.action.kind === "endTurn");
    if (end) await store.dispatch(end.example);
    // Answered here rather than on the sheet (the end-of-turn discard keeps nothing back), so the whole phase is run.
    for (let guard = 0; guard < 20 && store.state.legal?.actions.kind === "choice"; guard++) {
      const choice = store.state.legal.actions.choice!;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
    }
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

/** Presses START / ANSWER / Next card until a Flip Encounter Card button shows (true) or the recap is up (false). */
async function untilFlip(page: Page, phone: boolean): Promise<boolean> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await continueRect(page)) return false;
    if (await villainDebugRect(page, "flipRect")) return true;
    let pressed = false;
    for (const name of ["startRect", "answerRect", "nextRect"]) {
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
  throw new Error("the villain phase never reached a flip or its recap");
}

test("the first facedown card gives away neither surge: one card on the strip, none on the table (#386)", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await startAndEndTurn(page);

  expect(await untilFlip(page, phone), "the dealt card waits facedown").toBe(true);
  // The engine has run the whole phase already (the end-of-turn discard answered on the way).
  const revealed = await revealedIds(page);
  expect(revealed.length, "seed 2 reveals the dealt card and two surge cards").toBe(3);
  const first = await phaseDebug(page);
  expect(first.encounterStrip, "the strip counts only the card dealt").toHaveLength(1);
  expect(first.waiting, "nothing else is waiting").toBe(0);
  const table = await tableGame(page);
  for (const id of revealed.slice(1)) {
    expect(table.villainArea, `${id} is not in the villain area yet`).not.toContain(id);
    for (const seat of table.players) {
      expect(seat.dealtEncounter, `${id} has not been dealt yet`).not.toContain(id);
      expect(seat.playArea, `${id} is not in play yet`).not.toContain(id);
    }
  }
  if (SHOT) await page.screenshot({ path: `${SHOT}/386-first-card-${info.project.name}.png` });

  // Flip it: the surge deals the second card, and the strip grows to two only then.
  await press(page, phone, (await villainDebugRect(page, "flipRect"))!);
  await waitFor(async () => ((await villainDebugRect(page, "flipRect")) === null ? true : null), "card flipped", 5000);
  expect(await untilFlip(page, phone), "the surge's card waits facedown").toBe(true);
  const second = await phaseDebug(page);
  expect(second.encounterStrip).toHaveLength(2);
  expect(second.waiting).toBe(0);
  if (SHOT) await page.screenshot({ path: `${SHOT}/386-second-card-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
