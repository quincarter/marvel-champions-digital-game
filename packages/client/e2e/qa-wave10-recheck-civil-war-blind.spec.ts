import { expect, test, type Page } from "@playwright/test";
import { playableScenarioOffer } from "@mc/cards";
import { activeScenes, clickText, pressKey, settle, trackPageErrors, waitFor } from "./helpers.js";
import {
  clickStop,
  driveToBoard,
  hasStop,
  installWave6Helpers,
  scrollStopIntoView,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOTS } from "./qa-wave10-recheck-helpers.js";

/**
 * Re-check, area 2: a "Random and blind" Civil War build played, saved ("Save & quit" leaves; saves are continuous),
 * left, and resumed from the Title's Continue row, with nothing hidden shown anywhere the player can look. The hidden
 * pieces are stage 2 of the main scheme and the modular sets (MC56 rules insert p. 5, via docs/phase7-wave10-client.md 2.6;
 * `view/civil-war-blind.ts`). A set counts as turned up once one of its cards has left the encounter deck, so only sets
 * with no card out are checked. The names come from the cards package's offer, not from the screens under test.
 */

const SEED = "20261013";

interface Config {
  scenarioId: string;
  blind?: boolean;
  modularSetIds?: string[];
  mainSchemeStageIds?: string[];
}

const builder = <T>(page: Page, method: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(
    ([m, a]) =>
      (window as unknown as { __mcBuilderDebug: Record<string, (...x: unknown[]) => unknown> }).__mcBuilderDebug[
        m as string
      ]!(...(a as unknown[])) as never,
    [method, args] as const,
  );

async function sessionConfig(page: Page): Promise<Config> {
  return page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { config: unknown } } };
    };
    return appSession().store.state.config as never;
  });
}

/** Modular set ids with no card out of the encounter deck and set-aside pile: still hidden by the client's own rule. */
async function stillHiddenSets(page: Page, ids: readonly string[]): Promise<string[]> {
  return page.evaluate(
    async (ids) => {
      const { appSession } = (await import("/src/session.ts")) as unknown as {
        appSession: () => { store: { state: { game?: any } } };
      };
      const game = appSession().store.state.game;
      const waiting = new Set<string>(game.encounterSetAside);
      for (const deck of Object.values<any>(game.encounterDecks)) for (const id of deck.deck) waiting.add(id);
      const out = new Set<string>();
      for (const inst of Object.values<any>(game.instances)) {
        if (waiting.has(inst.instanceId)) continue;
        const card = game.cardPool[inst.cardId];
        for (const id of card?.encounterSetIds ?? []) out.add(id);
      }
      return ids.filter((id) => !out.has(id));
    },
    [...ids],
  );
}

const allTexts = async (page: Page): Promise<string> =>
  (await visibleTexts(page))
    .map((t) => `${t.scene}: ${t.text}`)
    .join("\n")
    .toLowerCase();

/** Fails with the screen and the leaked name when any hidden name is on screen. */
async function expectNothingHidden(page: Page, where: string, hidden: readonly string[]): Promise<void> {
  const text = await allTexts(page);
  for (const name of hidden) {
    // Pause's tutorial row names Spider-Man whatever the game ("a short scripted first game against Rhino with
    // Spider-Man"), and a hidden set can be the one called Spider-Man: that fixed line gives nothing away.
    const line = text
      .split("\n")
      .filter((l) => !l.includes("a short scripted first game against rhino"))
      .find((l) => l.includes(name.toLowerCase()));
    expect(line, `${where}: "${name}" is on screen`).toBeUndefined();
  }
}

async function seatTigraAndDeal(page: Page): Promise<void> {
  await waitForScene(page, "Seats");
  await waitFor(
    async () =>
      (await hasStop(page, "hero-search", "Seats")) || (await hasStop(page, "hero-search-toggle", "Seats")) || null,
    "hero search",
    10000,
  );
  if (!(await hasStop(page, "hero-search", "Seats"))) {
    await clickStop(page, "hero-search-toggle", "Seats");
    await settle(page);
  }
  await clickStop(page, "hero-search", "Seats");
  await settle(page);
  await page.keyboard.type("Tigra");
  await settle(page);
  await scrollStopIntoView(page, "hero:precon:tigra-aggression", "Seats");
  await clickStop(page, "hero:precon:tigra-aggression", "Seats");
  await settle(page);
  await clickStop(page, "play", "Seats");
  await waitForScene(page, "Setup");
  await settle(page);
}

type Size = { name: string; width: number; height: number };

async function playBlindAndResume(page: Page, size: Size, pauseAfterResume: boolean): Promise<void> {
  {
    {
      test.setTimeout(300_000);
      const errors = trackPageErrors(page);
      await installWave6Helpers(page);
      await openApp(page, "unlock=all&screen=civil-war-builder", { landing: "CivilWarBuilder" });
      await waitFor(
        async () => ((await page.evaluate(() => "__mcBuilderDebug" in window)) ? true : null),
        "the builder's debug hook",
        10000,
      );
      await builder<void>(page, "act", "civil:random-blind");
      await builder<void>(page, "act", "civil:step:5");
      await settle(page);
      await builder<void>(page, "act", "civil:start");
      await seatTigraAndDeal(page);
      // Table setup lists the modular sets it will shuffle in: they must not be named here either.
      const setupText = await allTexts(page);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/wave10-recheck-blind-${size.name}-setup.png` });

      await clickStop(page, "seed", "Setup");
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.type(SEED);
      await page.keyboard.press("Enter");
      await settle(page);
      await clickStop(page, "deal-it-out", "Setup");
      await driveToBoard(page, { timeoutMs: 90000 });
      await settle(page, { quietMs: 800, maxMs: 5000 });

      const config = await sessionConfig(page);
      expect(config.blind, "the game was started blind").toBe(true);
      const offer = playableScenarioOffer(config.scenarioId) as any;
      const stage2 = offer.mainSchemeStages.stages
        .find((s: any) => s.stageNumber === 2)
        .options.find((o: any) => o.printedCardId === config.mainSchemeStageIds![1])?.name as string;
      const setName = (id: string): string => offer.modularSets.find((s: any) => s.id === id).name;
      const hiddenIds = await stillHiddenSets(page, config.modularSetIds ?? []);
      expect(config.modularSetIds?.length).toBe(4);
      let hidden = [stage2, ...hiddenIds.map(setName)];
      // A set turns up as the game goes on, so the list is read again at each check made with a game on the table.
      const nothingHiddenNow = async (where: string): Promise<void> => {
        hidden = [stage2, ...(await stillHiddenSets(page, config.modularSetIds ?? [])).map(setName)];
        await expectNothingHidden(page, where, hidden);
      };
      expect(hidden.length).toBeGreaterThanOrEqual(2);

      // Table setup (read before the deal): nothing hidden.
      for (const name of hidden) {
        expect(setupText.includes(name.toLowerCase()), `Table setup names "${name}"`).toBe(false);
      }
      await expectNothingHidden(page, "Board, round 1", hidden);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/wave10-recheck-blind-${size.name}-board.png` });

      // Pause: the scenario sheet and the full game log (the log holds every pick, the client masks it).
      await pressKey(page, "Escape");
      await waitFor(
        async () => ((await activeScenes(page)).includes("PauseOverlay") ? true : null),
        "Pause opens",
        8000,
      );
      await settle(page);
      await nothingHiddenNow("Pause");
      expect(await allTexts(page), "Pause carries the hidden words").toMatch(/hidden/);
      if (size.width > 600) {
        await clickText(page, "Full game log", { sceneKey: "PauseOverlay" });
        await settle(page);
        await nothingHiddenNow("Pause, Full game log");
      }
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/wave10-recheck-blind-${size.name}-pause.png` });

      // Save & quit, then the Title's Continue row names the game without the hidden pieces.
      await clickStop(page, "save-quit", "PauseOverlay");
      await waitForScene(page, "Title");
      await settle(page);
      await expectNothingHidden(page, "Title after Save & quit", hidden);
      const titleText = (await visibleTexts(page))
        .filter((t) => t.scene === "Title")
        .map((t) => t.text)
        .join(" | ");
      expect(titleText, "the Continue row names the Civil War game and says its pieces are hidden").toMatch(
        /Continue/i,
      );
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/wave10-recheck-blind-${size.name}-title.png` });
      expect(titleText).toMatch(/hidden/i);

      // Reload (a closed tab), then resume.
      await page.goto("/?unlock=all");
      await waitForScene(page, "Title");
      await settle(page);
      await expectNothingHidden(page, "Title after reload", hidden);
      await clickStop(page, "continue", "Title");
      await driveToBoard(page, { timeoutMs: 60000 });
      await settle(page, { quietMs: 800, maxMs: 5000 });
      const resumed = await sessionConfig(page);
      expect(resumed.blind, "blind survives the resume").toBe(true);
      expect(resumed.modularSetIds).toEqual(config.modularSetIds);
      await nothingHiddenNow("Board after resume");
      await pressKey(page, "Escape");
      await waitFor(
        async () => ((await activeScenes(page)).includes("PauseOverlay") ? true : null),
        "Pause opens",
        8000,
      );
      await settle(page);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/wave10-recheck-blind-${size.name}-resumed.png` });
      if (pauseAfterResume) {
        await nothingHiddenNow("Pause after resume");
        if (size.width < 600) {
          // On a phone the log is the Board's own LOG tab.
          await pressKey(page, "Escape");
          await settle(page);
          await clickText(page, "LOG", { sceneKey: "Board" });
          await settle(page);
          if (SHOTS) await page.screenshot({ path: `${SHOTS}/wave10-recheck-blind-${size.name}-logtab.png` });
          await nothingHiddenNow("Log tab after resume");
        }
      }
      expect(errors).toEqual([]);
    }
  }
}

const SIZES = [
  { name: "390x844", width: 390, height: 844 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

for (const size of SIZES) {
  test.describe(`Random and blind Civil War at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.width < 600 });

    test("built blind, played, saved, left, resumed: stage 2 and the unturned sets stay hidden on the Table setup, Board, Pause and Title", async ({
      page,
    }) => {
      await playBlindAndResume(page, size, false);
    });
  });
}

for (const size of SIZES) {
  test.describe(`Random and blind Civil War, Pause after a resume at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.width < 600 });
    // FINDING (should-fix): after Save & quit and Continue, Pause's "Jump to a moment" log prints the line "Main scheme
    // stages for this game: <stage 1>, then <stage 2>" for a blind game, naming the hidden stage 2. Before the resume
    // the same panel does not show it. A player sees it by opening Pause on the resumed game.
    test("the resumed game's Pause does not name the hidden stage 2", async ({ page }) => {
      await playBlindAndResume(page, size, true);
    });
  });
}
