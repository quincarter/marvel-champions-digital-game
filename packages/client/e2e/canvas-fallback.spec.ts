import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, findText, hasText, settle, trackPageErrors, waitFor } from "./helpers.js";
import { boardRound, driveToBoard, endTurnToNextRound, waitForScene } from "./wave6-helpers-a.js";
import { handRectFor, inspectAt, openApp, startGame } from "./wave6-helpers-b.js";

/**
 * A browser with WebGL switched off (a Discord report: Firefox 157 on Windows, "Cannot create WebGL context,
 * aborting.") plays on the Canvas renderer instead (`platform/renderer-options.ts`), and Title says once how to turn
 * WebGL back on (`scenes/renderer-notice.ts`). Every `webgl` context request fails here, as `webgl.disabled` does.
 */

const NOTICE = "RendererNoticeOverlay";

async function switchWebglOff(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (/webgl/.test(kind)) return null;
      return (getContext as (k: string, ...r: unknown[]) => RenderingContext | null).call(this, kind, ...rest);
    } as typeof getContext;
  });
}

const rendererType = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __mcGame: { renderer: { type: number } } }).__mcGame.renderer.type);

test("without WebGL the game starts on Canvas and says once how to turn WebGL back on", async ({ page }) => {
  const errors = trackPageErrors(page);
  await switchWebglOff(page);
  await openApp(page);
  // Phaser.CANVAS is 1, Phaser.WEBGL 2.
  expect(await rendererType(page)).toBe(1);
  await waitForScene(page, NOTICE);
  expect(await hasText(page, "To turn WebGL back on", NOTICE)).toBe(true);
  // No failure panel over the game.
  expect(await page.evaluate(() => document.getElementById("mc-startup-failure") === null)).toBe(true);

  await clickText(page, "GOT IT", {
    sceneKey: NOTICE,
    until: async () => ((await activeScenes(page)).includes(NOTICE) ? null : true),
    untilLabel: "the notice closes",
  });
  expect(await page.evaluate(() => localStorage.getItem("mc-canvas-fallback-seen"))).toBe("1");

  // Closed once is closed on this device: the next launch goes straight to Title.
  await page.reload();
  await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "Title after reload", 30000);
  await settle(page);
  expect(await activeScenes(page)).not.toContain(NOTICE);
  expect(await rendererType(page)).toBe(1);
  expect(errors).toEqual([]);
});

test("Enter closes the notice and presses nothing on Title underneath", async ({ page }) => {
  await switchWebglOff(page);
  await openApp(page);
  await waitForScene(page, NOTICE);
  await settle(page);
  const before = await activeScenes(page);
  await page.keyboard.press("Enter");
  await waitFor(async () => ((await activeScenes(page)).includes(NOTICE) ? null : true), "the notice closes", 10000);
  await settle(page);
  // Title is still the screen: no New game, no other screen opened by the same press.
  expect((await activeScenes(page)).filter((key) => !before.includes(key))).toEqual([]);
});

test("on a short landscape phone the notice still fits, Got it included, in Spanish too", async ({ page }) => {
  await switchWebglOff(page);
  await page.setViewportSize({ width: 667, height: 375 });
  await openApp(page);
  await waitForScene(page, NOTICE);
  await settle(page);
  const fits = async (label: string): Promise<void> => {
    const [button] = await findText(page, label, NOTICE);
    expect(button, label).toBeDefined();
    expect(button!.y).toBeGreaterThan(0);
    expect(button!.y).toBeLessThan(375);
  };
  await fits("GOT IT");
  // The language switch redraws the notice in the new language, and it still fits.
  await page.evaluate(async () => {
    const { setArtLanguage } = (await import("/src/art/art-source.ts")) as unknown as {
      setArtLanguage: (lang: string) => void;
    };
    const { announceLanguageChange } = (await import("/src/language-change.ts")) as unknown as {
      announceLanguageChange: () => void;
    };
    setArtLanguage("es");
    announceLanguageChange();
  });
  await waitFor(
    async () => ((await findText(page, "Entendido", NOTICE)).length > 0 ? true : null),
    "the notice in Spanish",
  );
  await fits("Entendido");
});

/** The first card in the perspective player's hand, by code. */
const firstHandCode = (page: Page): Promise<string | null> =>
  page.evaluate(async () => {
    const mod = await import("/src/session.ts");
    const state = (mod as unknown as { appSession: () => { store: { state: unknown } } }).appSession().store.state as {
      game?: { players: { playerId: unknown; hand: string[] }[]; instances: Record<string, { cardId: string }> };
      perspectiveId: unknown;
    };
    const me = state.game?.players.find((p) => p.playerId === state.perspectiveId);
    const id = me?.hand[0];
    return id ? (state.game?.instances[id]?.cardId ?? null) : null;
  });

test("without WebGL a game is played on Canvas: setup screens, the board, Inspect and a full round", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = trackPageErrors(page);
  await switchWebglOff(page);
  // The notice has its own test: this one is about playing.
  await page.addInitScript(() => localStorage.setItem("mc-canvas-fallback-seen", "1"));
  await openApp(page);
  expect(await rendererType(page)).toBe(1);

  // New game's scenario list draws its scrolling shelves (masks and clips) under Canvas.
  await clickText(page, "New game", {
    sceneKey: "Title",
    until: async () => ((await activeScenes(page)).includes("ScenarioSelect") ? true : null),
    untilLabel: "Scenario select opens",
  });
  await waitFor(
    async () => ((await hasText(page, "Rhino", "ScenarioSelect")) ? true : null),
    "the Core Set shelf shows Rhino",
    30000,
  );

  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 43523 });
  await driveToBoard(page, { timeoutMs: 120_000 });
  expect(await rendererType(page)).toBe(1);

  // A card in the hand opens Inspect, and it closes again.
  const code = await firstHandCode(page);
  expect(code).not.toBeNull();
  await inspectAt(page, await handRectFor(page, code!), "right");
  await page.keyboard.press("Escape");
  await waitFor(
    async () => ((await activeScenes(page)).includes("InspectOverlay") ? null : true),
    "Inspect closes",
    10000,
  );

  // End the turn, through the villain phase, to the next round's turn.
  const round = (await boardRound(page)) ?? 1;
  expect(await endTurnToNextRound(page, round)).toBe(round + 1);
  expect(errors).toEqual([]);
});

test("a browser with WebGL never sees the notice", async ({ page }) => {
  await openApp(page);
  await settle(page);
  expect(await rendererType(page)).toBe(2);
  expect(await activeScenes(page)).not.toContain(NOTICE);
});
