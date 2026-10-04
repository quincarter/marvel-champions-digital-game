import { expect, test, type Page } from "@playwright/test";
import { clickText, waitFor } from "./helpers.js";
import {
  assertNoRawText,
  boardRound,
  clickStop,
  driveToBoard,
  endTurnToNextRound,
  hasStop,
  installWave6Helpers,
  screens,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";

/**
 * Scenario smoke (wave 6 QA): every one-off scenario the playable pool gained in wave 6, started the way a player
 * starts a game (No guide, a fixed seed, Scenario select, Take your seats, Set the table, Deal it out), through the
 * opening hands and any setup decision to the first player turn, then End turn and the villain phase to round 2.
 *
 * Each scenario gets a different wave 6 hero (Colossus, Shadowcat, Cyclops, Phoenix, Wolverine, Storm, Gambit,
 * Rogue: each used once), so the eight heroes' setup, identity and first turn are all driven too. The MojoMania
 * scenarios also make their genre-set picks on Table setup.
 *
 * CI cost: the whole file is meant to run on every PR. Round 2 is part of every scenario's test (the villain phase
 * is where a scenario's own cards first fire, so it is the half that finds engine and content failures); each
 * test stays well under a minute on a slow machine.
 */

const SEED = "20261003";

interface Case {
  readonly scenario: string;
  /** The chip on Scenario select that filters to the box (`scenario-chip:product:<code>`). */
  readonly box: string;
  /** The hero's precon deck id on Take your seats (`hero:precon:<id>`) and the name typed in its search. */
  readonly heroDeck: string;
  readonly heroSearch: string;
  /** True for the MojoMania scenarios: Table setup asks for genre sets. */
  readonly genreSets: boolean;
}

const CASES: readonly Case[] = [
  { scenario: "sabretooth", box: "mut_gen", heroDeck: "colossus-protection", heroSearch: "Colossus", genreSets: false },
  {
    scenario: "project-wideawake",
    box: "mut_gen",
    heroDeck: "shadowcat-aggression",
    heroSearch: "Shadowcat",
    genreSets: false,
  },
  { scenario: "master-mold", box: "mut_gen", heroDeck: "cyclops-leadership", heroSearch: "Cyclops", genreSets: false },
  { scenario: "mansion-attack", box: "mut_gen", heroDeck: "phoenix-justice", heroSearch: "Phoenix", genreSets: false },
  { scenario: "magneto", box: "mut_gen", heroDeck: "wolverine-aggression", heroSearch: "Wolverine", genreSets: false },
  { scenario: "magog", box: "mojo", heroDeck: "storm-leadership", heroSearch: "Storm", genreSets: true },
  { scenario: "spiral", box: "mojo", heroDeck: "gambit-justice", heroSearch: "Gambit", genreSets: true },
  { scenario: "mojo", box: "mojo", heroDeck: "rogue-protection", heroSearch: "Rogue", genreSets: true },
];

/** Title → New game → "No guide" → Suit up, landing on Scenario select. */
async function startNewGameNoGuide(page: Page): Promise<void> {
  await waitForScene(page, "Title", 30000);
  await page.waitForTimeout(600);
  await clickText(page, "NEW GAME", { sceneKey: "Title" });
  await waitForScene(page, "GuideChooser");
  await page.waitForTimeout(500);
  await clickText(page, "No guide", { sceneKey: "GuideChooser" });
  await page.waitForTimeout(300);
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
  test(`${c.scenario}: ${c.heroSearch} reaches the first turn and round 2`, async ({ page }) => {
    test.setTimeout(150_000);
    const errors = trackErrors(page);
    await installWave6Helpers(page);
    await page.goto("/?unlock=all");
    await startNewGameNoGuide(page);

    // Scenario select: filter to the box, pick the scenario, on to the seats.
    await clickStop(page, `scenario-chip:product:${c.box}`, "ScenarioSelect");
    await page.waitForTimeout(400);
    await clickStop(page, `scenario:${c.scenario}`, "ScenarioSelect");
    await page.waitForTimeout(300);
    await clickStop(page, "next", "ScenarioSelect");

    // Take your seats: search the hero by name, take its precon into seat 1.
    await waitForScene(page, "Seats");
    await waitFor(async () => (await hasStop(page, "hero-search", "Seats")) || null, "hero search", 10000);
    await clickStop(page, "hero-search", "Seats");
    await page.waitForTimeout(250);
    await page.keyboard.type(c.heroSearch);
    await clickStop(page, `hero:precon:${c.heroDeck}`, "Seats");
    await page.waitForTimeout(400);
    await clickStop(page, "play", "Seats");

    // Set the table: the fixed seed, the genre sets a MojoMania scenario asks for, then deal.
    await waitForScene(page, "Setup");
    await page.waitForTimeout(600);
    await clickStop(page, "seed", "Setup");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(SEED);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    if (c.genreSets) {
      await clickStop(page, "modular:crime", "Setup");
      await page.waitForTimeout(250);
      await clickStop(page, "modular:horror", "Setup");
      await page.waitForTimeout(250);
    }
    const villain = await villainNameOnSetup(page);
    await assertNoRawText(page, `${c.scenario} table setup`);
    await clickStop(page, "deal-it-out", "Setup");

    // The deal, the mulligan (keep), any setup decision and intro, then the first player turn.
    await driveToBoard(page, { timeoutMs: 90000 });
    await assertNoRawText(page, `${c.scenario} first turn`);
    const board = await visibleTexts(page);
    expect(
      board.some((t) => t.scene === "Board" && t.text.trim().toLowerCase() === villain.toLowerCase()),
      `the villain "${villain}" is named on the board`,
    ).toBe(true);
    const hand = board.map((t) => /^HAND (\d+)$/.exec(t.text.trim())).find((m) => m !== null);
    expect(hand, "the board shows the hand count").toBeTruthy();
    expect(Number(hand![1]), "the opening hand is not empty").toBeGreaterThan(0);
    expect(await boardRound(page), "round 1").toBe(1);
    await shot(page, `${c.scenario}-turn1`);

    // End turn and let the villain phase run to round 2.
    expect(await endTurnToNextRound(page, 1, { timeoutMs: 90000 }), "round 2 begins").toBe(2);
    expect(await screens(page), "back on the board with nothing open").toContain("Board");
    await shot(page, `${c.scenario}-round2`);
    await assertNoRawText(page, `${c.scenario} round 2`);
    expect(errors, `no page or console errors (${JSON.stringify(errors)})`).toEqual([]);
  });
}
