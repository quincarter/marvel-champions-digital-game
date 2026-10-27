import { expect, test, type Page } from "@playwright/test";
import {
  activeScenes,
  clickFocus,
  clickText,
  focusRect,
  hasText,
  pressAt,
  pressEndTurn,
  settle,
  waitFor,
} from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, startGame } from "./wave6-helpers-b.js";
import { boardUp, facts, press } from "./x-men-helpers.js";

/**
 * Nevermind after End turn (`view/end-turn-takeback.ts`). The last hero's End turn asks "Discard any cards?", then waits
 * at the docked villain phase's START gate; both offer "Nevermind" (a press, or B on a pad), which rewinds to just
 * before End turn, hand and all. A hero's End turn that only passes the turn is taken back from the Undo button on the
 * next hero's turn. Once START is pressed the window is gone.
 */

const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const B = 1;
const RIGHT = 15;

async function installPad(page: Page): Promise<void> {
  await page.addInitScript((id) => {
    const pad = {
      connected: true,
      id,
      index: 0,
      mapping: "standard",
      timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    };
    (window as unknown as { __fakePad: unknown }).__fakePad = pad;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => {
        pad.timestamp = performance.now();
        return [pad];
      },
      configurable: true,
    });
  }, PAD_ID);
}

const frames = (page: Page, count: number): Promise<void> =>
  page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let seen = 0;
        const tick = (): void => {
          seen += 1;
          if (seen >= n) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    count,
  );

async function padTap(page: Page, index: number): Promise<void> {
  const set = (down: boolean): Promise<void> =>
    page.evaluate(
      ([i, on]) => {
        const pad = (window as unknown as { __fakePad: { buttons: unknown[] } }).__fakePad;
        pad.buttons[i as number] = { pressed: on as boolean, touched: on as boolean, value: on ? 1 : 0 };
      },
      [index, down] as const,
    );
  await set(true);
  await page.waitForFunction((i) => navigator.getGamepads()[0]?.buttons[i]?.pressed === true, index);
  await frames(page, 8);
  await set(false);
  await page.waitForFunction((i) => navigator.getGamepads()[0]?.buttons[i]?.pressed === false, index);
  await frames(page, 8);
}

const store = <T>(page: Page, read: (s: any) => T): Promise<T> =>
  page.evaluate(async (source) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    return new Function("s", `return (${source})(s)`)(appSession().store.state);
  }, read.toString()) as Promise<T>;

/** The whole game state (resources, counters, decks, hands), the log Pause and the report read, and the RNG position. */
const snapshot = (page: Page): Promise<{ game: string; log: string }> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game: unknown } }; gameLog: unknown };
    };
    const session = appSession();
    return { game: JSON.stringify(session.store.state.game), log: JSON.stringify(session.gameLog) };
  });

const onHeroTurn = (page: Page): Promise<boolean> =>
  store(page, (s) => s.game?.step?.phase === "player" && s.game?.step?.kind === "turn");

const handOf = (page: Page): Promise<string[]> => facts(page, (game) => [...game.players[0].hand] as string[]);

async function offAutoAdvance(page: Page): Promise<void> {
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
}

async function startSolo(page: Page): Promise<void> {
  await offAutoAdvance(page);
  await installPad(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page, { quietMs: 600, maxMs: 5000 });
}

/** Ends the turn and waits for the end-of-phase "Discard any cards?" sheet with Nevermind on it. */
async function endTurnToSheet(page: Page): Promise<void> {
  await pressEndTurn(page);
  await waitFor(
    async () => ((await hasText(page, "Nevermind", "ChoiceOverlay")) ? true : null),
    "Nevermind on the discard sheet",
    15_000,
  );
  await settle(page, { quietMs: 600, maxMs: 4000 });
}

/** Ends the turn, declines the discard and waits for the villain phase's START gate with Nevermind on it. */
async function endTurnToGate(page: Page): Promise<void> {
  await endTurnToSheet(page);
  await clickText(page, "Decline", { sceneKey: "ChoiceOverlay" });
  await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
  await waitFor(() => villainDebugRect(page, "nevermindRect"), "Nevermind on the gate", 5000);
  await settle(page, { quietMs: 500, maxMs: 4000 });
}

async function expectBackOnHeroTurn(
  page: Page,
  hand: readonly string[],
  version: number,
  before: { game: string; log: string },
): Promise<void> {
  await waitFor(
    async () => {
      const up = await activeScenes(page);
      return up.includes("VillainPhaseOverlay") || up.includes("ChoiceOverlay") ? null : true;
    },
    "the sheet and the villain phase are gone",
    15_000,
  );
  await settle(page, { quietMs: 500, maxMs: 4000 });
  expect(await onHeroTurn(page), "back on the hero turn").toBe(true);
  expect(await handOf(page), "the same hand").toEqual(hand);
  expect(await store(page, (s) => s.version as number), "as if End turn was never pressed").toBe(version);
  const after = await snapshot(page);
  expect(after.game === before.game, "every counter, resource and card is where it was").toBe(true);
  expect(after.log === before.log, "no log line from the undone End turn or villain phase survives").toBe(true);
  expect(await hasText(page, "VILLAIN PHASE", "Board"), "no phase band or banner from the undone phase").toBe(false);
}

test("Nevermind on the discard sheet and the START gate (mouse) puts the hero back on their turn with the same hand", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  await startSolo(page);
  const hand = await handOf(page);
  const version = await store(page, (s) => s.version as number);
  const before = await snapshot(page);

  // The discard sheet End turn opens.
  await endTurnToSheet(page);
  await page.screenshot({ path: "../../artifacts/qa/nevermind-discard-sheet.png" });
  await clickText(page, "Nevermind", { sceneKey: "ChoiceOverlay" });
  await expectBackOnHeroTurn(page, hand, version, before);
  await page.screenshot({ path: "../../artifacts/qa/nevermind-back-on-turn.png" });

  // The gate, after the discard was declined.
  await endTurnToGate(page);
  const back = (await villainDebugRect(page, "nevermindRect"))!;
  const firstGate = await snapshot(page);
  expect(firstGate.log, "Pause and the report show nothing of the phase before START").not.toMatch(/Rhino|reveal/i);
  await page.screenshot({ path: "../../artifacts/qa/nevermind-gate.png" });
  await settle(page);
  await pressAt(page, back.x + back.width / 2, back.y + back.height / 2);
  await expectBackOnHeroTurn(page, hand, version, before);

  // And End turn works again afterwards: the window comes back, and START closes it for good.
  await endTurnToGate(page);
  expect((await snapshot(page)).game === firstGate.game, "End turn again deals the same villain phase").toBe(true);
  const start = (await villainDebugRect(page, "startRect"))!;
  await settle(page);
  await pressAt(page, start.x + start.width / 2, start.y + start.height / 2);
  await waitFor(
    async () => ((await villainDebugRect(page, "nevermindRect")) === null ? true : null),
    "Nevermind gone once the phase has started",
    15_000,
  );
  expect(errors).toEqual([]);
});

test("B on a pad is Nevermind on the discard sheet and the START gate, with its glyph on the gate button", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  await startSolo(page);
  const hand = await handOf(page);
  const version = await store(page, (s) => s.version as number);
  const before = await snapshot(page);

  await endTurnToSheet(page);
  await padTap(page, B);
  await expectBackOnHeroTurn(page, hand, version, before);

  await endTurnToGate(page);
  await padTap(page, RIGHT);
  const back = (await villainDebugRect(page, "nevermindRect"))!;
  const glyph = await page.evaluate(
    ([r]) => {
      const game = (
        window as unknown as { __mcGame: { scene: { getScene(k: string): { children: { list: unknown[] } } } } }
      ).__mcGame;
      type Node = {
        visible?: boolean;
        text?: string;
        name?: string;
        list?: Node[];
        getBounds?: () => { x: number; y: number; width: number; height: number };
      };
      let found = false;
      const walk = (nodes: Node[]): void => {
        for (const node of nodes) {
          if ((node.text === "B" || node.name === "glyph:B") && node.visible !== false && node.getBounds) {
            const b = node.getBounds();
            const cx = b.x + b.width / 2;
            const cy = b.y + b.height / 2;
            if (cx >= r!.x - 4 && cx <= r!.x + r!.width + 4 && cy >= r!.y - 24 && cy <= r!.y + r!.height + 24)
              found = true;
          }
          if (node.list) walk(node.list);
        }
      };
      walk(game.scene.getScene("VillainPhaseOverlay").children.list as Node[]);
      return found;
    },
    [back] as const,
  );
  expect(glyph, "the B glyph sits on Nevermind").toBe(true);
  await page.screenshot({ path: "../../artifacts/qa/nevermind-gate-pad.png" });

  await padTap(page, B);
  await expectBackOnHeroTurn(page, hand, version, before);
  expect(errors).toEqual([]);
});

test("a hero's End turn that passes to the next hero is taken back with the bar's Nevermind", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
    const { startOffTurnDevGame } = (await import(/* @vite-ignore */ "/src/store/dev-off-turn-game.ts")) as unknown as {
      startOffTurnDevGame: (store: unknown) => Promise<void>;
    };
    await startOffTurnDevGame(appSession().store);
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
  await boardUp(page);

  // The dev game opens on Spider-Man's turn, straight after Deadpool's End turn passed it on.
  const spiderMan = await store(page, (s) => s.perspectiveId as string);
  const version = await store(page, (s) => s.version as number);
  const undo = await waitFor(() => focusRect(page, "undo"), "Nevermind on Spider-Man's turn", 10_000);
  expect(await hasText(page, "Nevermind", "Board"), "the bar's button reads Nevermind").toBe(true);
  await page.screenshot({ path: "../../artifacts/qa/nevermind-handover-undo.png" });
  await press(page, phone, undo.x + undo.width / 2, undo.y + undo.height / 2);
  await waitFor(
    async () => ((await store(page, (s) => s.perspectiveId as string)) !== spiderMan ? true : null),
    "back on Deadpool's turn",
    15_000,
  );
  await settle(page, { quietMs: 500, maxMs: 4000 });
  expect(await store(page, (s) => s.version as number), "before Deadpool's End turn").toBe(version - 1);
  expect(await onHeroTurn(page)).toBe(true);

  // Ending it again hands the turn on exactly as before.
  await clickFocus(page, "basic:endTurn");
  await waitFor(
    async () => {
      if ((await store(page, (s) => s.perspectiveId as string)) === spiderMan) return true;
      if ((await activeScenes(page)).includes("EndTurnConfirmOverlay")) {
        await clickText(page, "End turn", { sceneKey: "EndTurnConfirmOverlay" });
      }
      return null;
    },
    "Spider-Man's turn again",
    20_000,
  );
  expect(await store(page, (s) => s.version as number)).toBe(version);
  expect(errors).toEqual([]);
});
