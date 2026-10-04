import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, pressHookStop, pressUntil, settle, trackPageErrors, waitFor } from "./helpers.js";
import {
  clickStop as clickRouteStop,
  installWave6Helpers,
  openSaga,
  trackErrors,
  waitForScene,
} from "./wave6-helpers-a.js";
import {
  answerChoice,
  declineMulligans,
  findVisibleText,
  hook,
  openApp,
  quietGuide,
  startGame,
  useIdentityAbility,
} from "./wave6-helpers-b.js";

/**
 * Smaller wave 6 checks that share no setup: the private look-at cover, and Scenario select's wave 6 tiles. (Not covered
 * here: the Game Over line for an exhausted encounter deck has no `?screen=` jump to reach it by, `view/game-over-model`'s
 * own tests hold its wording.)
 */

/** Presses a control by name once the screen has drawn it (a slow runner can be a moment behind a scene change). */
async function clickStop(page: Page, hookName: string, key: string): Promise<void> {
  await pressHookStop(page, hookName, key);
  await settle(page);
}

/** Images the decision sheet has drawn: a face-up card is one image. */
const sheetImages = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const game = (
      window as unknown as {
        __mcGame: { scene: { getScene: (k: string) => { children: { list: { type: string }[] } } } };
      }
    ).__mcGame;
    let count = 0;
    const walk = (list: { type: string; list?: unknown[] }[]): void => {
      for (const o of list) {
        if (o.type === "Image") count++;
        if (o.list) walk(o.list as { type: string; list?: unknown[] }[]);
      }
    };
    walk(game.scene.getScene("ChoiceOverlay").children.list);
    return count;
  });

/** Jessica Drew's "look at the top card of any deck": flip not needed, her action is on the alter-ego side. */
async function startLook(page: Page, decks: string[]): Promise<void> {
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks, seed: 3 });
  await declineMulligans(page);
  await useIdentityAbility(page, "Jessica Drew");
  await answerChoice(page, 0); // "The encounter deck"
  await waitFor(
    async () => ((await findVisibleText(page, "look at", "ChoiceOverlay")).length > 0 ? true : null),
    "the look sheet",
    8000,
  );
  await settle(page);
}

test.describe("Look at (Jessica Drew)", () => {
  test("two seats: the faces wait behind a cover naming the looker, and no card is drawn until it is tapped", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = trackPageErrors(page);
    await startLook(page, ["spider-woman-aggression-justice", "core-spider-man-justice"]);
    const cover = await findVisibleText(page, "may look", "ChoiceOverlay");
    expect(cover, "the cover is up").toHaveLength(1);
    expect(cover[0]!.text).toMatch(/^Only .+ may look\. Tap to reveal$/);
    // The source card's picture and the seat's portrait are on the sheet either way; the looked-at card is the third.
    const covered = await sheetImages(page);

    await pressUntil(
      page,
      () => clickText(page, "Tap to reveal", { sceneKey: "ChoiceOverlay" }),
      async () => (await findVisibleText(page, "Tap to reveal", "ChoiceOverlay")).length === 0,
      "the cover is lifted",
    );
    expect(await findVisibleText(page, "Tap to reveal", "ChoiceOverlay"), "the cover is gone").toEqual([]);
    // The pictures are drawn a beat after the cover lifts: wait for them rather than read once.
    await waitFor(async () => ((await sheetImages(page)) > covered ? true : null), "the looked-at card is drawn");
    expect(await sheetImages(page), "the looked-at card is drawn only now").toBeGreaterThan(covered);
    expect(errors).toEqual([]);
  });

  test("one seat: nobody to hide it from, so there is no cover", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = trackPageErrors(page);
    await startLook(page, ["spider-woman-aggression-justice"]);
    expect(await findVisibleText(page, "may look", "ChoiceOverlay")).toEqual([]);
    expect(await findVisibleText(page, "tap to read it", "ChoiceOverlay"), "the card can be read now").not.toHaveLength(
      0,
    );
    expect(await sheetImages(page), "the card is drawn straight away (the source card and the looked-at card)").toBe(2);
    expect(errors).toEqual([]);
  });
});

/**
 * Thief Extraordinaire (Gambit's alter-ego action, a look-and-discard cost) shows two encounter cards on a plain
 * card-choice sheet, not a `lookAt` prompt: the cover has to cover every choice that shows one player hidden cards.
 */
async function startThief(page: Page, decks: string[]): Promise<void> {
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks, seed: 3 });
  await declineMulligans(page);
  await declineMulligans(page);
  await useIdentityAbility(page, "Thief");
  await waitFor(
    async () => ((await findVisibleText(page, "Choose cards", "ChoiceOverlay")).length > 0 ? true : null),
    "the Thief sheet",
    8000,
  );
  await settle(page);
}

test.describe("Look and discard (Gambit's Thief Extraordinaire)", () => {
  test("two seats: the two encounter cards wait behind a cover naming Gambit, drawn only once it is tapped", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = trackPageErrors(page);
    await startThief(page, ["gambit-justice", "core-spider-man-justice"]);
    const cover = await findVisibleText(page, "may look", "ChoiceOverlay");
    expect(cover, "the cover is up").toHaveLength(1);
    expect(cover[0]!.text).toMatch(/^Only .+ may look\. Tap to reveal$/);
    const covered = await sheetImages(page);

    await pressUntil(
      page,
      () => clickText(page, "Tap to reveal", { sceneKey: "ChoiceOverlay" }),
      async () => (await findVisibleText(page, "Tap to reveal", "ChoiceOverlay")).length === 0,
      "the cover is lifted",
    );
    expect(await findVisibleText(page, "Tap to reveal", "ChoiceOverlay"), "the cover is gone").toEqual([]);
    await waitFor(async () => ((await sheetImages(page)) >= covered + 2 ? true : null), "the two cards are drawn");
    expect(await sheetImages(page), "the two cards are drawn only now").toBeGreaterThanOrEqual(covered + 2);
    expect(errors).toEqual([]);
  });

  test("one seat: nobody to hide them from, so the cards are there straight away", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = trackPageErrors(page);
    await startThief(page, ["gambit-justice"]);
    expect(await findVisibleText(page, "may look", "ChoiceOverlay")).toEqual([]);
    expect(await sheetImages(page), "the source card and the two looked-at cards").toBeGreaterThanOrEqual(3);
    expect(errors).toEqual([]);
  });
});

/**
 * Sabretooth's one-off intro: four beats. Sabretooth's lines are his own; Wolverine's two are speech bubbles when he is
 * seated and the scene's narration when he is not.
 */
for (const seat of [
  { deck: "precon:wolverine-aggression", wolverine: true },
  { deck: "precon:core-spider-man-justice", wolverine: false },
] as const) {
  test(`Sabretooth's intro, ${seat.wolverine ? "with" : "without"} Wolverine seated: four beats, his lines ${seat.wolverine ? "are bubbles" : "are narration"}`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = trackPageErrors(page);
    await openApp(page, `unlock=all&screen=table-setup&scenario=sabretooth&deck=${seat.deck}`, { landing: "Setup" });
    await waitFor(
      async () => (await hook<unknown[]>(page, "__mcTableSetupDebug", "options")) ?? null,
      "setup hook",
      8000,
    );
    await settle(page);
    await clickStop(page, "__mcTableSetupDebug", "deal-it-out");
    await waitFor(async () => ((await activeScenes(page)).includes("ScenarioIntro") ? true : null), "the intro", 20000);
    await waitFor(
      async () => (await hook<number>(page, "__mcScenarioIntroDebug", "beats")) ?? null,
      "intro hook",
      8000,
    );

    expect(await hook<number>(page, "__mcScenarioIntroDebug", "beats"), "four beats").toBe(4);
    const speakers: string[] = [];
    for (let beat = 0; beat < 4; beat++) {
      await waitFor(
        async () => ((await hook<number>(page, "__mcScenarioIntroDebug", "beat")) === beat ? true : null),
        `beat ${beat + 1}`,
        8000,
      );
      const lines = (await hook<{ speaker: string; text: string }[]>(page, "__mcScenarioIntroDebug", "lines"))!;
      expect(lines, `beat ${beat + 1} has one line`).toHaveLength(1);
      speakers.push(lines[0]!.speaker);
      await settle(page);
      if (beat < 3) await clickText(page, "Next", { sceneKey: "ScenarioIntro" });
    }
    expect(speakers, "who speaks in each beat").toEqual([
      "npc",
      seat.wolverine ? "hero" : "narrator",
      "npc",
      seat.wolverine ? "hero" : "narrator",
    ]);
    await clickText(page, "Suit up", { sceneKey: "ScenarioIntro" });
    await waitFor(
      async () => ((await activeScenes(page)).includes("SetupDeal") ? true : null),
      "the deal after the last beat",
      15000,
    );
    expect(errors).toEqual([]);
  });
}

test("Campaign roster: the deck picker's rows each show a hero picture and colored aspect badges with their names", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.goto("/?unlock=all");
  await openSaga(page);
  await clickRouteStop(page, "vol-1", "CampaignSaga");
  await settle(page);
  await clickRouteStop(page, "cta", "CampaignSaga");
  await waitForScene(page, "CampaignCover");
  await settle(page);
  await clickRouteStop(page, "cta", "CampaignCover");
  await waitForScene(page, "CampaignRoster");
  await settle(page);
  await clickRouteStop(page, "seat-1", "CampaignRoster");
  await settle(page);

  const rows = (await hook<{ name: string; picture: boolean; badges: { label: string; fill: number }[] }[]>(
    page,
    "__mcRosterPickerDebug",
    "rows",
  ))!;
  expect(rows.length, "the picker draws rows").toBeGreaterThanOrEqual(3);
  for (const row of rows) {
    expect(row.picture, `${row.name} has a picture`).toBe(true);
    expect(row.badges.length, `${row.name} has an aspect badge`).toBeGreaterThan(0);
    for (const badge of row.badges) expect(badge.label.trim(), `${row.name}'s badge is named`).not.toBe("");
  }
  const fills = new Set(rows.flatMap((r) => r.badges.map((b) => b.fill)));
  expect(fills.size, "the aspects are told apart by color as well as by name").toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test("Scenario select: Mansion Attack is titled so, and all eight wave 6 tiles have their villain art", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = trackPageErrors(page);
  await openApp(page);
  await clickText(page, "NEW GAME");
  await waitFor(
    async () => ((await activeScenes(page)).includes("ScenarioSelect") ? true : null),
    "Scenario select",
    8000,
  );
  await settle(page);
  for (const pack of ["mut_gen", "mojo"]) {
    await clickStop(page, "__mcScenarioSelectDebug", `scenario-chip:product:${pack}`);
    await settle(page);
  }
  const tiles = (await hook<{ id: string; title: string; villainArt: boolean; baked: boolean }[]>(
    page,
    "__mcScenarioSelectDebug",
    "tiles",
  ))!;
  const WAVE6 = [
    "sabretooth",
    "project-wideawake",
    "master-mold",
    "mansion-attack",
    "magneto",
    "magog",
    "spiral",
    "mojo",
  ];
  for (const id of WAVE6) {
    const tile = tiles.find((t) => t.id === id);
    expect(tile, `${id} has a tile`).toBeDefined();
    expect(tile!.villainArt, `${id} has villain art of its own`).toBe(true);
    expect(tile!.baked, `${id}'s art has loaded and been drawn`).toBe(true);
  }
  expect(tiles.find((t) => t.id === "mansion-attack")!.title).toBe("Mansion Attack");
  expect(errors).toEqual([]);
});
