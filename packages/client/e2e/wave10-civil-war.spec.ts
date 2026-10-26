import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, findText, settle, trackPageErrors, waitFor } from "./helpers.js";
import {
  assertNoRawText,
  boardRound,
  clickStop,
  driveToBoard,
  hasStop,
  installWave6Helpers,
  routeStops,
  scrollStopIntoView,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";
import { hook, openApp } from "./wave6-helpers-b.js";

/**
 * Wave 10 smoke (the Civil War box, docs/phase7-wave10-client.md section 11): the shelf Scenario select shows once the
 * box is open, a ready-made scenario played from the shelf with Tigra, "Customize" into the builder and on to a game with a
 * swapped set, "Build your own" opening at the side step, and a fresh profile finding the box locked. Driven through the
 * screens' own debug hooks (`__mcScenarioSelectDebug`, `__mcBuilderDebug`, `__mcTableSetupDebug`) and the live session.
 */

const SEED = "20261012";
const LEADERS = [
  { id: "registration-iron-man", title: "Iron Man" },
  { id: "registration-captain-marvel", title: "Captain Marvel" },
  { id: "resistance-captain-america", title: "Captain America" },
  { id: "resistance-spider-woman", title: "Spider-Woman" },
] as const;
const IRON_MAN = LEADERS[0].id;

const sizes = [
  { name: "phone", viewport: { width: 390, height: 844 } },
  { name: "desktop", viewport: { width: 1440, height: 900 } },
] as const;

interface BuilderTile {
  readonly id: string;
  readonly action: string;
  readonly selected: boolean;
  readonly enabled: boolean;
}
interface BuilderView {
  readonly step: number;
  readonly canStart: boolean;
  readonly modular: { readonly chosen: number; readonly sections: readonly { tiles: readonly BuilderTile[] }[] };
}
const builderView = (page: Page): Promise<BuilderView> =>
  page.evaluate(() => (window as unknown as { __mcBuilderDebug: { view: () => BuilderView } }).__mcBuilderDebug.view());
async function builderAct(page: Page, action: string): Promise<void> {
  await page.evaluate(
    (a) => (window as unknown as { __mcBuilderDebug: { act: (x: string) => void } }).__mcBuilderDebug.act(a),
    action,
  );
  await settle(page, { quietMs: 120, maxMs: 600 });
}

/** Title -> New game -> "No guide" -> Suit up, landing on Scenario select. */
async function startNewGameNoGuide(page: Page): Promise<void> {
  await waitForScene(page, "Title", 30000);
  await settle(page);
  await clickText(page, "NEW GAME", { sceneKey: "Title" });
  await waitForScene(page, "GuideChooser");
  await settle(page);
  await clickText(page, "No guide", { sceneKey: "GuideChooser" });
  await settle(page);
  await clickText(page, "SUIT UP", { sceneKey: "GuideChooser" });
  await waitForScene(page, "ScenarioSelect");
  await waitFor(async () => (await hasStop(page, "next", "ScenarioSelect")) || null, "scenario list", 15000);
}

/** The product chips are a sideways rail: on a phone the Civil War chip starts off screen, so the rail is wheeled to it. */
async function clickCivilWarChip(page: Page): Promise<void> {
  const size = page.viewportSize() ?? { width: 1440, height: 900 };
  const key = "scenario-chip:product:cw";
  // The chips sit behind the Filters button on a phone: open it first.
  if (!(await hasStop(page, key, "ScenarioSelect"))) {
    await clickStop(page, "filters-toggle", "ScenarioSelect");
    await settle(page);
  }
  for (let step = 0; step < 60; step++) {
    const stop = (await routeStops(page, "ScenarioSelect"))?.stops.find((s) => s.key === key);
    if (!stop) throw new Error(`no "${key}" control on ScenarioSelect`);
    const { x, y, width, height } = stop.rect;
    if (x >= 0 && x + width <= size.width) break;
    await page.mouse.move(size.width / 2, y + height / 2);
    await page.mouse.wheel(x < 0 ? -250 : 250, 0);
    await settle(page);
  }
  await clickStop(page, key, "ScenarioSelect");
  await settle(page);
}

/** Types into the scenario search; a phone keeps the field behind a toggle until it is opened. */
async function searchScenarios(page: Page, text: string): Promise<void> {
  if (!(await hasStop(page, "scenario-search", "ScenarioSelect"))) {
    await clickStop(page, "scenario-search-toggle", "ScenarioSelect");
    await settle(page);
  }
  await clickStop(page, "scenario-search", "ScenarioSelect");
  await page.keyboard.press("ControlOrMeta+A");
  if (text === "") await page.keyboard.press("Backspace");
  else await page.keyboard.type(text);
  await settle(page);
}

/** Narrows the shelf to one scenario by its name (a phone shows one tile at a time) and picks it. */
async function pickScenario(page: Page, search: string, id: string): Promise<void> {
  await searchScenarios(page, search);
  // The Build your own tile leads the shelf, so on a phone the scenario's tile starts off to the right.
  await scrollStopIntoView(page, `scenario:${id}`, "ScenarioSelect");
  await clickStop(page, `scenario:${id}`, "ScenarioSelect");
  await settle(page);
}

async function openScenarioSelect(page: Page): Promise<void> {
  await installWave6Helpers(page);
  await page.goto("/?unlock=all");
  await startNewGameNoGuide(page);
}

/** Seats with Tigra's precon, through Set the table and the deal, to the first player turn. */
async function seatTigraAndDeal(page: Page): Promise<void> {
  await waitForScene(page, "Seats");
  // A phone keeps the hero search behind a toggle.
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

async function dealIt(page: Page): Promise<void> {
  // On a phone the seed field sits below the fold of the Set the table scroll: bring it up, or the click misses it,
  // the typing goes nowhere and Enter (which deals, with nothing focused) starts the game before this clicks Deal it out.
  await scrollStopIntoView(page, "seed", "Setup");
  await clickStop(page, "seed", "Setup");
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(SEED);
  await page.keyboard.press("Enter");
  await settle(page);
  await assertNoRawText(page, "Civil War table setup");
  await clickStop(page, "deal-it-out", "Setup");
  await driveToBoard(page, { timeoutMs: 90000 });
}

const boardTexts = async (page: Page): Promise<string[]> =>
  (await visibleTexts(page)).filter((t) => t.scene === "Board").map((t) => t.text.trim());

/** The live session's game config, read the way `startGame` reaches the store. */
async function sessionConfig(
  page: Page,
): Promise<{ scenarioId: string; modularSetIds?: readonly string[]; mainSchemeStageIds?: readonly string[] }> {
  return page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { config: unknown } } };
    };
    return appSession().store.state.config as never;
  });
}

for (const size of sizes) {
  test.describe(`Civil War box at ${size.name} size`, () => {
    test.use({ viewport: size.viewport });

    test("the shelf shows four scenarios titled by their leader, and the Build your own tile", async ({ page }) => {
      test.setTimeout(240_000);
      const errors = trackPageErrors(page);
      await openScenarioSelect(page);
      expect(await hasStop(page, "scenario:civil-war-builder", "ScenarioSelect"), "the Build your own tile").toBe(true);
      // A phone draws one tile at a time, so each leader is found by its name and its tile's title read back.
      for (const leader of LEADERS) {
        await searchScenarios(page, leader.title);
        const tiles = await hook<{ id: string; title: string }[]>(page, "__mcScenarioSelectDebug", "tiles");
        expect(
          (tiles ?? []).filter((t) => t.id === leader.id).map((t) => t.title),
          `${leader.id} is titled by its leader`,
        ).toEqual([leader.title]);
      }
      await pickScenario(page, "Iron Man", IRON_MAN);
      expect(await hasStop(page, "customize", "ScenarioSelect"), "Customize on a ready-made scenario").toBe(true);
      // The box's own chip filters the shelf to its four scenarios and the Build your own tile.
      await searchScenarios(page, "");
      await clickCivilWarChip(page);
      for (const id of [...LEADERS.map((l) => l.id), "civil-war-builder"])
        expect(await hasStop(page, `scenario:${id}`, "ScenarioSelect"), `the shelf lists ${id}`).toBe(true);
      expect(await hasStop(page, "scenario:rhino", "ScenarioSelect"), "the chip filters Core out").toBe(false);
      expect(errors).toEqual([]);
    });

    test("a ready-made scenario starts with Tigra and reaches the first turn with the leader on the board", async ({
      page,
    }) => {
      test.setTimeout(240_000);
      const errors = trackPageErrors(page);
      await openScenarioSelect(page);
      await pickScenario(page, "Iron Man", IRON_MAN);
      await clickStop(page, "next", "ScenarioSelect");
      await seatTigraAndDeal(page);
      await dealIt(page);
      await assertNoRawText(page, "Civil War first turn");
      // A phone's board is tabbed: the leader is on the Enemies tab.
      if ((page.viewportSize()?.width ?? 1440) < 700) {
        await clickText(page, "ENEMIES", { sceneKey: "Board" });
        await settle(page);
      }
      const board = await boardTexts(page);
      expect(
        board.some((t) => /^leader\b/i.test(t)),
        `the board names the opposing card "Leader" (${JSON.stringify(board.slice(0, 40))})`,
      ).toBe(true);
      expect(board.some((t) => t.includes("Iron Man"))).toBe(true);
      expect(board.some((t) => t.includes("Greer Nelson") || t.includes("Tigra"))).toBe(true);
      expect(await boardRound(page), "round 1").toBe(1);
      expect(errors).toEqual([]);
    });

    test("Customize opens the builder on that scenario; a swapped set reaches Take your seats and the game", async ({
      page,
    }) => {
      test.setTimeout(300_000);
      const errors = trackPageErrors(page);
      await openScenarioSelect(page);
      await pickScenario(page, "Iron Man", IRON_MAN);
      await clickStop(page, "customize", "ScenarioSelect");
      await waitForScene(page, "CivilWarBuilder");
      await waitFor(
        async () => ((await page.evaluate(() => "__mcBuilderDebug" in window)) ? true : null),
        "the builder's debug hook",
        10000,
      );
      await settle(page);
      let view = await builderView(page);
      expect(view.step, "opens on the review step").toBe(5);

      await builderAct(page, "civil:step:4");
      view = await builderView(page);
      const tilesOf = (v: BuilderView): readonly BuilderTile[] => v.modular.sections.flatMap((s) => s.tiles);
      const out = tilesOf(view).find((t) => t.selected && t.enabled)!;
      // Four sets is the most, so one goes out before another can come in.
      await builderAct(page, out.action);
      const into = tilesOf(await builderView(page)).find((t) => !t.selected && t.enabled && t.id !== out.id)!;
      await builderAct(page, into.action);
      view = await builderView(page);
      const chosen = view.modular.sections
        .flatMap((s) => s.tiles)
        .filter((t) => t.selected)
        .map((t) => t.id)
        .sort();
      expect(chosen).toContain(into.id);
      expect(chosen).not.toContain(out.id);
      expect(view.canStart).toBe(true);

      await builderAct(page, "civil:step:5");
      await builderAct(page, "civil:start");
      await seatTigraAndDeal(page);
      const picks = await hook<string[]>(page, "__mcTableSetupDebug", "picks");
      expect([...(picks ?? [])].sort(), "Table setup carries the swapped sets").toEqual(chosen);

      await dealIt(page);
      const config = await sessionConfig(page);
      expect(config.scenarioId).toBe(IRON_MAN);
      expect([...(config.modularSetIds ?? [])].sort(), "the game started with the swapped sets").toEqual(chosen);
      expect(await boardRound(page), "round 1").toBe(1);
      expect(errors).toEqual([]);
    });

    test("Build your own opens the builder at the side step", async ({ page }) => {
      test.setTimeout(240_000);
      const errors = trackPageErrors(page);
      await openScenarioSelect(page);
      await scrollStopIntoView(page, "scenario:civil-war-builder", "ScenarioSelect");
      await clickStop(page, "scenario:civil-war-builder", "ScenarioSelect");
      await waitForScene(page, "CivilWarBuilder");
      await waitFor(
        async () => ((await page.evaluate(() => "__mcBuilderDebug" in window)) ? true : null),
        "the builder's debug hook",
        10000,
      );
      await settle(page);
      expect((await builderView(page)).step).toBe(1);
      expect(errors).toEqual([]);
    });

    test("on a fresh profile the box is locked with its hint and has no New in Civil War page", async ({ page }) => {
      test.setTimeout(240_000);
      const errors = trackPageErrors(page);
      await installWave6Helpers(page);
      await page.goto("/");
      await startNewGameNoGuide(page);
      await pickScenario(page, "Iron Man", IRON_MAN);
      expect(
        await findText(page, "Complete the Agents of S.H.I.E.L.D. campaign", "ScenarioSelect"),
        "the shelf says what opens the box",
      ).not.toHaveLength(0);

      // The How to play hub lists no box page for it.
      await page.goto("/");
      await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "title", 30000);
      await clickText(page, "How to play");
      await waitFor(async () => ((await activeScenes(page)).includes("HowToPlay") ? true : null), "the hub", 8000);
      await settle(page);
      const boxes = (await hook<{ title: string }[]>(page, "__mcHowToPlayDebug", "boxes")) ?? [];
      expect(boxes.map((b) => b.title)).not.toContain("New in Civil War");
      expect(errors).toEqual([]);
    });
  });
}

test("with everything open the How to play hub lists New in Civil War", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, "unlock=all");
  await clickText(page, "How to play");
  await waitFor(async () => ((await activeScenes(page)).includes("HowToPlay") ? true : null), "the hub", 8000);
  await settle(page);
  const boxes = (await hook<{ title: string }[]>(page, "__mcHowToPlayDebug", "boxes")) ?? [];
  expect(boxes.map((b) => b.title)).toContain("New in Civil War");
  expect(errors).toEqual([]);
});
