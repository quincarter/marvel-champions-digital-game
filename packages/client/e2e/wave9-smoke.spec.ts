import { expect, test, type Page } from "@playwright/test";
import { clickText, waitFor, settle } from "./helpers.js";
import {
  assertNoRawText,
  boardRound,
  clickStop,
  driveToBoard,
  hasStop,
  scrollStopIntoView,
  installWave6Helpers,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";

/**
 * Wave 9 smoke (Agents of S.H.I.E.L.D. and Tricks and Treats): every scenario the pool gained, started the way a player
 * starts a game (No guide, a fixed seed, Scenario select, Take your seats, Set the table, Deal it out), through the
 * opening hands and any setup decision to round 1's first player turn. Each scenario gets a different wave 9 hero, and
 * the board must show the scenario's signature piece (its villain and a label only that scenario draws).
 */

const SEED = "20261011";

interface Case {
  readonly scenario: string;
  /** What to type in the scenario search to narrow the shelf to it. */
  readonly search: string;
  /** The chip on Scenario select that filters to the box (`scenario-chip:product:<code>`). */
  readonly box: string;
  /** The hero's precon deck id on Take your seats (`hero:precon:<id>`) and the name typed in its search. */
  readonly heroDeck: string;
  readonly heroSearch: string;
  /** The hero's alter-ego name, which the first turn's board must name ("Your turn — ..." or the identity card). */
  readonly alterEgo: string;
  /** Text the first turn's board must draw for this scenario (case-insensitive substring of some Board text). */
  readonly signature: readonly string[];
}

const CASES: readonly Case[] = [
  {
    scenario: "black-widow",
    search: "Black Widow",
    box: "aos",
    heroDeck: "maria-hill-leadership",
    heroSearch: "Maria Hill",
    alterEgo: "Maria Hill",
    signature: ["Black Widow", "The Widow's Web"],
  },
  {
    scenario: "batroc",
    search: "Batroc",
    box: "aos",
    heroDeck: "nick-fury-justice",
    heroSearch: "Nick Fury",
    alterEgo: "Nick Fury",
    signature: ["Batroc", "Alert Level", "Infiltrate A.I.M. Island Embassy"],
  },
  {
    scenario: "modok",
    search: "M.O.D.O.K.",
    box: "aos",
    heroDeck: "bp-justice",
    heroSearch: "Black Panther",
    alterEgo: "Shuri",
    signature: ["M.O.D.O.K.", "Holding Cell", "CELL DECK", "Upgrading Adaptoids"],
  },
  {
    scenario: "thunderbolts",
    search: "Thunderbolts",
    box: "aos",
    heroDeck: "silk-protection",
    heroSearch: "Silk",
    alterEgo: "Cindy Moon",
    signature: ["Citizen V", "Thunderbolt Backup", "HELD"],
  },
  {
    scenario: "baron-zemo",
    search: "Zemo",
    box: "aos",
    heroDeck: "winter-aggression",
    heroSearch: "Winter",
    alterEgo: "Bucky Barnes",
    signature: ["Baron Zemo", "EVIDENCE", "Chief Surveillance Officer", "SECRET"],
  },
  {
    scenario: "enchantress",
    search: "Enchantress",
    box: "tt",
    heroDeck: "falcon-leadership",
    heroSearch: "Falcon",
    alterEgo: "Sam Wilson",
    signature: ["Enchantress", "Hypnotic Gaze"],
  },
  {
    scenario: "god-of-lies",
    search: "God of Lies",
    box: "tt",
    heroDeck: "maria-hill-leadership",
    heroSearch: "Maria Hill",
    alterEgo: "Maria Hill",
    signature: ["Loki", "NEUTRAL AREA", "Worlds Collide", "SYNERGY"],
  },
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

/** QA aid: with E2E_SHOTS=<dir>, saves a screenshot of the moment (never set in CI). */
async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.E2E_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}-${page.viewportSize()?.width ?? 0}.png` });
}

for (const c of CASES) {
  test(`${c.scenario}: ${c.heroSearch} reaches round 1's first turn with the scenario's pieces`, async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await installWave6Helpers(page);
    await page.goto("/?unlock=all");
    await startNewGameNoGuide(page);

    await clickStop(page, `scenario-chip:product:${c.box}`, "ScenarioSelect");
    await settle(page);
    await clickStop(page, "scenario-search", "ScenarioSelect");
    await page.keyboard.type(c.search);
    await settle(page);
    await clickStop(page, `scenario:${c.scenario}`, "ScenarioSelect");
    await settle(page);
    await shot(page, `${c.scenario}-0-scenario-select`);
    await clickStop(page, "next", "ScenarioSelect");

    await waitForScene(page, "Seats");
    await waitFor(async () => (await hasStop(page, "hero-search", "Seats")) || null, "hero search", 10000);
    await clickStop(page, "hero-search", "Seats");
    await settle(page);
    await page.keyboard.type(c.heroSearch);
    await settle(page);
    await scrollStopIntoView(page, `hero:precon:${c.heroDeck}`, "Seats");
    await clickStop(page, `hero:precon:${c.heroDeck}`, "Seats");
    await settle(page);
    await shot(page, `${c.scenario}-1-seats`);
    await clickStop(page, "play", "Seats");

    await waitForScene(page, "Setup");
    await settle(page);
    await clickStop(page, "seed", "Setup");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(SEED);
    await page.keyboard.press("Enter");
    await settle(page);
    await assertNoRawText(page, `${c.scenario} table setup`);
    await shot(page, `${c.scenario}-2-setup`);
    await clickStop(page, "deal-it-out", "Setup");

    await driveToBoard(page, { timeoutMs: 90000 });
    await assertNoRawText(page, `${c.scenario} first turn`);
    const board = (await visibleTexts(page)).filter((t) => t.scene === "Board").map((t) => t.text.trim());
    if (process.env.E2E_DUMP) console.log(`BOARD ${c.scenario}: ${JSON.stringify(board)}`);
    for (const sig of c.signature)
      expect(
        board.some((t) => t.toLowerCase().includes(sig.toLowerCase())),
        `the board draws "${sig}"`,
      ).toBe(true);
    expect(
      board.some((t) => t.includes(c.alterEgo)),
      `the board names ${c.alterEgo}`,
    ).toBe(true);
    const hand = board.map((t) => /^HAND (\d+) · SIZE \d+$/.exec(t)).find((m) => m !== null);
    expect(hand, "the board shows the hand count").toBeTruthy();
    expect(Number(hand![1]), "the opening hand is not empty").toBeGreaterThan(0);
    expect(await boardRound(page), "round 1").toBe(1);
    await shot(page, `${c.scenario}-3-turn1`);
    expect(errors, `no page or console errors (${JSON.stringify(errors)})`).toEqual([]);
  });
}
