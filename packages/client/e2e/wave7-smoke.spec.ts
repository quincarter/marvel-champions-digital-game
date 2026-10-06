import { expect, test, type Page } from "@playwright/test";
import { clickText, waitFor, settle } from "./helpers.js";
import {
  assertNoRawText,
  boardRound,
  clickStop,
  driveToBoard,
  hasStop,
  installWave6Helpers,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";

/**
 * Wave 7 smoke (NeXt Evolution): every scenario the pool gained, started the way a player starts a game (No guide,
 * a fixed seed, Scenario select, Take your seats, Set the table, Deal it out), through the opening hands and any
 * setup decision to round 1's first player turn. Each scenario gets a different new hero (Psylocke, Angel, X-23,
 * Cable, Domino), and Deadpool plays an older scenario (Rhino) to see the Dreadpool set join by itself.
 * Table setup is checked for the sets the box prints: Mister Sinister and Stryfe fix Hope Summers.
 */

const SEED = "20261003";

interface Case {
  readonly scenario: string;
  /** What to type in the scenario search to narrow the shelf to it. */
  readonly search: string;
  /** The chip on Scenario select that filters to the box (`scenario-chip:product:<code>`). */
  readonly box: string;
  /** The hero's precon deck id on Take your seats (`hero:precon:<id>`) and the name typed in its search. */
  readonly heroDeck: string;
  readonly heroSearch: string;
  /** Encounter set names Table setup must show for the scenario (fixed sets). */
  readonly setsShown: readonly string[];
}

const CASES: readonly Case[] = [
  {
    scenario: "morlock-siege",
    search: "Morlock",
    box: "next_evol",
    heroDeck: "psylocke-justice",
    heroSearch: "Psylocke",
    setsShown: ["Marauders", "Mutant Slayers"],
  },
  {
    scenario: "on-the-run",
    search: "On the Run",
    box: "next_evol",
    heroDeck: "angel-protection",
    heroSearch: "Angel",
    setsShown: ["Marauders", "Mutant Slayers"],
  },
  {
    scenario: "juggernaut",
    search: "Juggernaut",
    box: "next_evol",
    heroDeck: "x-23-aggression",
    heroSearch: "X-23",
    setsShown: ["Hope Summers"],
  },
  {
    scenario: "mister-sinister",
    search: "Sinister",
    box: "next_evol",
    heroDeck: "cable-leadership",
    heroSearch: "Cable",
    setsShown: ["Hope Summers", "Flight", "Super Strength", "Telepathy"],
  },
  {
    scenario: "stryfe",
    search: "Stryfe",
    box: "next_evol",
    heroDeck: "domino-justice",
    heroSearch: "Domino",
    setsShown: ["Hope Summers"],
  },
  // Deadpool's 'Pool aspect brings the Dreadpool set to any scenario (the engine adds it; Table setup does not preview it).
  { scenario: "rhino", search: "Rhino", box: "core", heroDeck: "deadpool-pool", heroSearch: "Deadpool", setsShown: [] },
];

/** Title → New game → "No guide" → Suit up, landing on Scenario select. */
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

/** The villain's name from Table setup's "The game you'll get" panel ("Mojo I · 34 HP ..." beside VILLAIN). */
async function villainNameOnSetup(page: Page): Promise<string> {
  const texts = await visibleTexts(page);
  const label = texts.find((t) => t.scene === "Setup" && /^villain$/i.test(t.text.trim()));
  if (!label) throw new Error("Table setup shows no VILLAIN line");
  const value = texts
    .filter((t) => t.scene === "Setup" && Math.abs(t.y - label.y) < 6 && t.x > label.x + 10)
    .sort((a, b) => a.x - b.x)[0];
  if (!value) throw new Error("Table setup's VILLAIN line has no value");
  // "Mojo I · 34 HP across both stages" -> "Mojo"; a villain's own roman numeral is its stage.
  const name = value.text
    .split("·")[0]!
    .replace(/\s+(I{1,3}|IV|V)\s*$/, "")
    .trim();
  if (name.length === 0) throw new Error(`could not read a villain name from "${value.text}"`);
  return name;
}

/** QA aid: with E2E_SHOTS=<dir>, saves a screenshot of the moment (never set in CI). */
async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.E2E_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}-${page.viewportSize()?.width ?? 0}.png` });
}

for (const c of CASES) {
  test(`${c.scenario}: ${c.heroSearch} reaches round 1's first turn`, async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await installWave6Helpers(page);
    await page.goto("/?unlock=all");
    await startNewGameNoGuide(page);

    // Scenario select: filter to the box, pick the scenario, on to the seats.
    await clickStop(page, `scenario-chip:product:${c.box}`, "ScenarioSelect");
    await settle(page);
    await shot(page, `${c.scenario}-0-scenario-select`);
    // The shelf scrolls sideways (the fourth and fifth tiles start off screen), so find the tile by search.
    await clickStop(page, "scenario-search", "ScenarioSelect");
    await page.keyboard.type(c.search);
    await settle(page);
    await clickStop(page, `scenario:${c.scenario}`, "ScenarioSelect");
    await settle(page);
    await clickStop(page, "next", "ScenarioSelect");

    // Take your seats: search the hero by name, take its precon into seat 1.
    await waitForScene(page, "Seats");
    await waitFor(async () => (await hasStop(page, "hero-search", "Seats")) || null, "hero search", 10000);
    await clickStop(page, "hero-search", "Seats");
    await settle(page);
    await page.keyboard.type(c.heroSearch);
    await settle(page);
    await shot(page, `${c.scenario}-1-seats`);
    await clickStop(page, `hero:precon:${c.heroDeck}`, "Seats");
    await settle(page);
    await clickStop(page, "play", "Seats");

    // Set the table: the fixed seed, then deal.
    await waitForScene(page, "Setup");
    await settle(page);
    await clickStop(page, "seed", "Setup");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(SEED);
    await page.keyboard.press("Enter");
    await settle(page);
    // Morlock Siege and On the Run start against a random Marauder: Table setup names a placeholder villain.
    const randomStart = c.scenario === "morlock-siege" || c.scenario === "on-the-run";
    const villain = randomStart ? null : await villainNameOnSetup(page);
    const shown = (await visibleTexts(page)).filter((t) => t.scene === "Setup").map((t) => t.text);
    for (const set of c.setsShown)
      expect(
        shown.some((t) => t.includes(set)),
        `Table setup names the ${set} set`,
      ).toBe(true);
    await assertNoRawText(page, `${c.scenario} table setup`);
    await shot(page, `${c.scenario}-2-setup`);
    await clickStop(page, "deal-it-out", "Setup");

    // The deal, the mulligan (keep), any setup decision and intro, then the first player turn.
    await driveToBoard(page, { timeoutMs: 90000 });
    await assertNoRawText(page, `${c.scenario} first turn`);
    const board = await visibleTexts(page);
    if (villain !== null)
      expect(
        board.some((t) => t.scene === "Board" && t.text.trim().toLowerCase() === villain.toLowerCase()),
        `the villain "${villain}" is named on the board`,
      ).toBe(true);
    const hand = board.map((t) => /^HAND (\d+)$/.exec(t.text.trim())).find((m) => m !== null);
    expect(hand, "the board shows the hand count").toBeTruthy();
    expect(Number(hand![1]), "the opening hand is not empty").toBeGreaterThan(0);
    expect(await boardRound(page), "round 1").toBe(1);
    await shot(page, `${c.scenario}-3-turn1`);
    expect(errors, `no page or console errors (${JSON.stringify(errors)})`).toEqual([]);
  });
}

test("Scenario select offers NeXt Evolution's five scenarios", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 2400, height: 900 });
  await installWave6Helpers(page);
  await page.goto("/?unlock=all");
  await startNewGameNoGuide(page);
  await clickStop(page, "scenario-chip:product:next_evol", "ScenarioSelect");
  await settle(page);
  for (const id of ["morlock-siege", "on-the-run", "juggernaut", "mister-sinister", "stryfe"])
    expect(await hasStop(page, `scenario:${id}`, "ScenarioSelect"), `${id} is offered`).toBe(true);
  await shot(page, "all-five-scenario-select");
  expect(errors, `no page or console errors (${JSON.stringify(errors)})`).toEqual([]);
});
