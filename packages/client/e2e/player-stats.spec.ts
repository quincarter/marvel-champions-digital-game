import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, findText, settle, waitFor } from "./helpers.js";
import { openApp, type Rect } from "./wave6-helpers-b.js";

/**
 * Your stats: a tabbed dashboard reached from the Title, Decks & Collection and the Trophy Room (as a screen) and from
 * Settings and Pause (as an overlay). Tabs switch with a tap or LB / RB; on a phone a swipe of the dashboard that lifts
 * over a tab switches nothing.
 */

interface Stop {
  readonly key: string;
  readonly rect: Rect;
}

const stopsOf = (page: Page): Promise<Stop[]> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcFocusRoutes?: Record<string, () => Stop[]> }).__mcFocusRoutes?.PlayerStats?.() ?? [],
  );

const keys = async (page: Page): Promise<string[]> => (await stopsOf(page)).map((s) => s.key);

const isActive = (page: Page, scene: string) => async () => ((await activeScenes(page)).includes(scene) ? true : null);

/**
 * Six finished games: four Spider-Man wins over Rhino, two losses (the last to Klaw), every one with the summary the
 * stats read (version 2, so the launch's backfill leaves them alone).
 */
async function seedGames(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { IdbGameStorage } = (await import("/src/engine/idb-game-storage.ts")) as never as {
      IdbGameStorage: new () => { create(meta: unknown, state: unknown): Promise<void> };
    };
    const { SAVE_SCHEMA } = (await import("/src/engine/game-storage.ts")) as never as { SAVE_SCHEMA: number };
    const store = new IdbGameStorage();
    for (let i = 0; i < 6; i++) {
      const won = i < 4;
      await store.create(
        {
          id: `e2e-stats-${i}`,
          schema: SAVE_SCHEMA,
          config: {
            scenarioId: i === 5 ? "klaw" : "rhino",
            difficulty: "standard",
            players: [{ starterDeckId: "core-spider-man-justice" }],
            seed: i,
          },
          createdAt: i,
          updatedAt: 100 + i,
          status: won ? "won" : "lost",
          round: 5 + i,
          commandCount: 50,
          outcome: won
            ? { result: "win", reason: "villainDefeated" }
            : { result: "loss", reason: "mainSchemeCompleted" },
          campaignId: null,
          campaignNodeId: null,
          lastPlayedOn: { platform: "windows" },
          summary: {
            lossReason: won ? null : "schemeCompleted",
            heroesDefeated: 0,
            winners: [],
            alliesPlayed: 0,
            seats: [
              {
                identityCardId: "01001a",
                aspects: ["justice"],
                deck: ["01002", "01008", "01093"],
                plays: { "01008": 2 },
                activations: { "01008": 1 },
                entered: {},
                damage: 8,
                thwart: 4,
                defeated: false,
              },
            ],
            villains: [i === 5 ? "Klaw" : "Rhino"],
            version: 2,
            sideSchemes: { seen: {}, defeated: {} },
          },
        },
        {},
      );
    }
  });
}

async function press(page: Page, phone: boolean, rect: Rect): Promise<void> {
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (phone) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** A tab's stop, wheeled into view first: a phone's tabs are one sideways-scrolling row. */
async function tabStop(page: Page, key: string): Promise<{ key: string; rect: Rect }> {
  const room = page.viewportSize()!.width;
  for (let i = 0; i < 12; i++) {
    const stop = (await stopsOf(page)).find((s) => s.key === key)!;
    if (stop.rect.x >= 0 && stop.rect.x + stop.rect.width <= room - 8) return stop;
    await page.mouse.move(room / 2, stop.rect.y + stop.rect.height / 2);
    await page.mouse.wheel(stop.rect.x > 0 ? 120 : -120, 0);
    await page.waitForTimeout(200);
  }
  return (await stopsOf(page)).find((s) => s.key === key)!;
}

/** A finger drag from `from` to `to`, lifted at `to` (a real touch sequence over CDP). */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const steps = 10;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    const at = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at, id: 1 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** Seeds the games, then lands on `screen`. */
async function seeded(page: Page, screen: string, landing: string): Promise<void> {
  await openApp(page, "unlock=all");
  await seedGames(page);
  await page.goto(`/?screen=${screen}&unlock=all`);
  await waitFor(isActive(page, landing), landing, 30_000);
  await settle(page);
}

const overviewUp = (page: Page) => async () => ((await keys(page)).includes("tile:record") ? true : null);

test("from the Trophy Room: the record, then a tab with a tap and the next with RB", async ({ page }, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  await seeded(page, "trophies", "TrophyRoom");
  await clickText(page, phone ? "Stats" : "Your stats", {
    sceneKey: "TrophyRoom",
    until: isActive(page, "PlayerStats"),
    untilLabel: "the Stats screen",
  });
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  expect((await findText(page, "4–2", "PlayerStats")).length, "the record").toBeGreaterThan(0);

  // Once the screen has settled (art arriving redraws it, and a tap that straddles a redraw is dropped by design).
  await settle(page);
  const heroes = await tabStop(page, "tab:heroes");
  await press(page, phone, heroes.rect);
  await waitFor(async () => ((await keys(page)).includes("row:hero:favorite") ? true : null), "Heroes opens", 10_000);

  if (!phone) {
    // RB (] on the keyboard): Villains, the tab after Heroes.
    await page.keyboard.press("]");
    await waitFor(async () => ((await keys(page)).includes("row:villain:favorite") ? true : null), "RB", 10_000);
    // Cards by hero shows the hero's card pictures.
    const cards = await tabStop(page, "tab:cards");
    await press(page, phone, cards.rect);
    await waitFor(
      async () => ((await keys(page)).some((k) => k.startsWith("card:")) ? true : null),
      "card pictures",
      10_000,
    );
  }
});

test("the filter chips narrow every tab: Rhino only is 4–1", async ({ page }, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  await seeded(page, "stats", "PlayerStats");
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  expect((await findText(page, "4–2", "PlayerStats")).length, "every game").toBeGreaterThan(0);
  await settle(page);
  if (phone) {
    // On a phone the chips fold behind one Filters chip.
    const toggle = (await stopsOf(page)).find((s) => s.key === "filter:toggle")!;
    await press(page, phone, toggle.rect);
  }
  const villain = await waitFor(
    async () => (await stopsOf(page)).find((s) => s.key === "filter:villain") ?? null,
    "the villain chip",
    10_000,
  );
  await settle(page);
  await press(page, phone, villain.rect);
  // The most faced villain first.
  await waitFor(
    async () => ((await findText(page, "4–1", "PlayerStats")).length > 0 ? true : null),
    "Rhino's games only",
    15_000,
  );
  expect((await findText(page, "RHINO", "PlayerStats")).length, "the chip names it").toBeGreaterThan(0);
  const clear = await waitFor(
    async () => (await stopsOf(page)).find((s) => s.key === "filter:clear") ?? null,
    "Clear",
    10_000,
  );
  await settle(page);
  await press(page, phone, clear.rect);
  await waitFor(
    async () => ((await findText(page, "4–2", "PlayerStats")).length > 0 ? true : null),
    "all again",
    15_000,
  );
});

test("on the keyboard or a pad: X jumps to the filters, and A on a card opens it in Inspect", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "keyboard");
  test.setTimeout(120_000);
  await seeded(page, "stats", "PlayerStats");
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  const focused = () =>
    page.evaluate(
      () =>
        (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null }> }).__mcFocusState
          .PlayerStats!().focus,
    );
  await settle(page);
  // G is X on the left-handed keyboard.
  await page.keyboard.press("g");
  await waitFor(async () => ((await focused()) === "filter:hero" ? true : null), "X on the hero filter", 10_000);
  const cards = await tabStop(page, "tab:all-cards");
  await press(page, false, cards.rect);
  const card = await waitFor(
    async () => (await stopsOf(page)).find((s) => s.key.startsWith("card:all:played:")) ?? null,
    "a card picture",
    10_000,
  );
  // Walk the ring onto the card with the arrows from the tab, then A (Enter).
  // From the filter chips (X again), down the strip of cards.
  await page.keyboard.press("g");
  const seen: (string | null)[] = [];
  for (let i = 0; i < 12 && (await focused()) !== card.key; i++) {
    await page.keyboard.press("ArrowDown");
    seen.push(await focused());
  }
  expect(await focused(), seen.join(" > ")).toBe(card.key);
  await page.keyboard.press("Enter");
  await waitFor(isActive(page, "InspectOverlay"), "Inspect", 10_000);
});

test("two filter chips pressed back to back both hold, whichever fold answers last", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "the chips in a row");
  test.setTimeout(120_000);
  await seeded(page, "stats", "PlayerStats");
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  await settle(page);
  const hero = (await stopsOf(page)).find((s) => s.key === "filter:hero")!;
  const villain = (await stopsOf(page)).find((s) => s.key === "filter:villain")!;
  // No wait between them: the second press lands before the first fold answers.
  await press(page, false, hero.rect);
  await press(page, false, villain.rect);
  await waitFor(
    async () => ((await findText(page, "4–1", "PlayerStats")).length > 0 ? true : null),
    "Spider-Man against Rhino",
    15_000,
  );
  await settle(page);
  expect((await findText(page, "SPIDER-MAN", "PlayerStats")).length, "the hero chip kept").toBeGreaterThan(0);
  expect((await findText(page, "4–1", "PlayerStats")).length, "still both").toBeGreaterThan(0);
});

test("Aspects, Encounter and Records: the donut and their rows", async ({ page }, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  await seeded(page, "stats", "PlayerStats");
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  for (const [tab, row] of [
    ["aspects", "row:aspect:favorite"],
    ["encounter", "row:enc:modular"],
    ["records", "row:rec:fastest"],
  ] as const) {
    await settle(page);
    const stop = await tabStop(page, `tab:${tab}`);
    await press(page, phone, stop.rect);
    await waitFor(async () => ((await keys(page)).includes(row) ? true : null), `${tab} opens`, 10_000);
  }
});

test("from the Title, Back returns to the Title", async ({ page }) => {
  test.setTimeout(120_000);
  await seeded(page, "title", "Title");
  await clickText(page, "Your stats", {
    sceneKey: "Title",
    until: isActive(page, "PlayerStats"),
    untilLabel: "the Stats screen",
  });
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  await page.keyboard.press("Escape");
  await waitFor(isActive(page, "Title"), "back on the Title", 15_000);
});

test("over Settings: Your stats opens as an overlay, and Back closes it with Settings still open", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "the same overlay on every size");
  test.setTimeout(120_000);
  await seeded(page, "settings", "SettingsOverlay");
  const settingsStops = (): Promise<Stop[]> =>
    page.evaluate(() =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => Stop[]> }).__mcFocusRoutes.SettingsOverlay!(),
    );
  const more = (await settingsStops()).find((s) => s.key === "tab:more")!;
  await press(page, false, more.rect);
  const stats = await waitFor(
    async () => (await settingsStops()).find((s) => s.key === "row:stats") ?? null,
    "the Your stats row",
    10_000,
  );
  // Its Open button, at the row's right end.
  await page.mouse.click(stats.rect.x + stats.rect.width - 40, stats.rect.y + stats.rect.height / 2);
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  expect(await activeScenes(page)).toContain("SettingsOverlay");
  await page.keyboard.press("Escape");
  await waitFor(async () => ((await activeScenes(page)).includes("PlayerStats") ? null : true), "closed", 10_000);
  expect(await activeScenes(page)).toContain("SettingsOverlay");
});

test("a swipe of the dashboard that lifts over a tab switches nothing", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a touch swipe");
  test.setTimeout(120_000);
  await seeded(page, "stats", "PlayerStats");
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  const before = await keys(page);
  const tab = await tabStop(page, "tab:villains");
  const record = (await stopsOf(page)).find((s) => s.key === "tile:record")!;
  await swipe(
    page,
    { x: tab.rect.x + tab.rect.width / 2, y: record.rect.y + 240 },
    { x: tab.rect.x + tab.rect.width / 2, y: tab.rect.y + tab.rect.height / 2 },
  );
  await settle(page);
  expect(await keys(page), "still on the Overview").toEqual(before);
  // A tap on it still switches.
  await page.touchscreen.tap(tab.rect.x + tab.rect.width / 2, tab.rect.y + tab.rect.height / 2);
  await waitFor(async () => ((await keys(page)).includes("row:villain:favorite") ? true : null), "Villains", 10_000);
});

test("over Pause: a press on empty stats space reaches nothing underneath, and Back returns to Pause", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "the wide Pause menu");
  test.setTimeout(120_000);
  await seeded(page, "pause", "PauseOverlay");
  const pauseStops = (): Promise<Stop[]> =>
    page.evaluate(() =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => Stop[]> }).__mcFocusRoutes.PauseOverlay!(),
    );
  const stats = await waitFor(
    async () => (await pauseStops()).find((s) => s.key === "stats") ?? null,
    "Your stats on the Pause menu",
    15_000,
  );
  await press(page, false, stats.rect);
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  // Count every press the scenes under the stats hear from here on.
  await page.evaluate(() => {
    const game = (
      window as unknown as {
        __mcGame: { scene: { getScene(key: string): { input: { on(event: string, fn: () => void): void } } } };
      }
    ).__mcGame;
    const heard = { n: 0 };
    (window as unknown as { __heard: typeof heard }).__heard = heard;
    for (const key of ["Board", "PauseOverlay"]) game.scene.getScene(key).input.on("pointerdown", () => heard.n++);
  });
  const tabs = (await stopsOf(page)).filter((s) => s.key.startsWith("tab:"));
  const last = tabs.at(-1)!;
  // The top bar's title, the space right of the tabs, and the bottom of the screen: none of them is a control.
  for (const [x, y] of [
    [400, 30],
    [last.rect.x + last.rect.width + 60, last.rect.y + last.rect.height / 2],
    [640, 880],
  ] as const) {
    await page.mouse.click(x, y);
  }
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as { __heard: { n: number } }).__heard.n)).toBe(0);
  expect(await activeScenes(page)).toContain("PlayerStats");

  // Card hover works over Pause too: rest the mouse on a card picture on Cards by hero.
  const cardsTab = await tabStop(page, "tab:cards");
  await press(page, false, cardsTab.rect);
  const card = await waitFor(
    async () => (await stopsOf(page)).find((s) => s.key.startsWith("card:")) ?? null,
    "a card picture",
    10_000,
  );
  await page.mouse.move(card.rect.x + card.rect.width / 2, card.rect.y + card.rect.height / 2);
  await page.mouse.move(card.rect.x + card.rect.width / 2 + 2, card.rect.y + card.rect.height / 2 + 2);
  await waitFor(
    () =>
      page.evaluate(
        () =>
          (window as unknown as { __mcStatsDebug?: { hoverShown(): string | null } }).__mcStatsDebug?.hoverShown() ??
          null,
      ),
    "the card hover popover",
    10_000,
  );
  await page.keyboard.press("Escape");
  await waitFor(async () => ((await activeScenes(page)).includes("PlayerStats") ? null : true), "closed", 10_000);
  expect(await activeScenes(page)).toContain("PauseOverlay");
});

test("a stat row's card hover opens on its picture, at a card's size beside the pointer", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "a mouse hover");
  test.setTimeout(120_000);
  await seeded(page, "stats", "PlayerStats");
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  await settle(page);
  await press(page, false, (await tabStop(page, "tab:heroes")).rect);
  const row = await waitFor(
    async () => (await stopsOf(page)).find((s) => s.key === "row:hero:01001a") ?? null,
    "Spider-Man's row",
    10_000,
  );
  const debug = () =>
    page.evaluate(() => {
      const stats = (window as unknown as { __mcStatsDebug: { hoverShown(): string | null; hoverRect(): Rect | null } })
        .__mcStatsDebug;
      return { shown: stats.hoverShown(), rect: stats.hoverRect() };
    });
  const rest = async (x: number, y: number): Promise<void> => {
    await page.mouse.move(x, y);
    await page.mouse.move(x + 2, y + 1);
  };
  const middle = row.rect.y + row.rect.height / 2;

  // Resting on the row's words opens nothing: they stay readable.
  await rest(row.rect.x + row.rect.width / 2, middle);
  await page.waitForTimeout(800);
  expect((await debug()).shown).toBeNull();

  // Its picture does, and the card is the size of any other popover, not one grown from the row's width.
  await rest(row.rect.x + 20, middle);
  const open = await waitFor(async () => (await debug()).rect, "the card hover popover");
  const screen = page.viewportSize()!;
  expect(open.height).toBeLessThan(screen.height * 0.6);
  expect(open.width).toBeLessThan(screen.width * 0.4);
  expect(open.x, "beside the pointer").toBeGreaterThan(row.rect.x + 20);
});

const stopsIn = (page: Page, scene: string): Promise<Stop[]> =>
  page.evaluate(
    (key) => (window as unknown as { __mcFocusRoutes?: Record<string, () => Stop[]> }).__mcFocusRoutes?.[key]?.() ?? [],
    scene,
  );

const pressStop = async (page: Page, scene: string, key: string, label: string): Promise<void> => {
  const stop = await waitFor(
    async () => (await stopsIn(page, scene)).find((s) => s.key === key) ?? null,
    label,
    30_000,
  );
  await press(page, false, stop.rect);
};

test("Decks & Collection: From your games on a precon builds a deck of your own from it", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "the wide stats pane");
  test.setTimeout(120_000);
  await seeded(page, "decks", "Decks");
  // This deck first: the resource curve and Check, with no Cut anywhere on a precon.
  await waitFor(
    async () => ((await stopsIn(page, "Decks")).some((s) => s.key === "stats-check") ? true : null),
    "This deck's Check",
    30_000,
  );
  await settle(page);
  await pressStop(page, "Decks", "pane:games", "the From your games tab");
  await waitFor(
    async () => ((await findText(page, "Build my own from this", "Decks")).length > 0 ? true : null),
    "Build my own from this",
    10_000,
  );
  // A precon is never cut in place: Tenacity, never played, is under a note, not a Cut.
  await waitFor(
    async () => ((await findText(page, "RARELY COMES OUT", "Decks")).length > 0 ? true : null),
    "the precon's Rarely comes out",
    10_000,
  );
  expect((await findText(page, "CUT?", "Decks")).length, "no Cut on a precon").toBe(0);
  await settle(page);
  await pressStop(page, "Decks", "games-open", "Build my own from this");
  await waitFor(isActive(page, "DeckBuilder"), "the deck builder", 30_000);
  // It opens on the builder's From your games, where the hero's suggestions are.
  await waitFor(
    async () => ((await stopsIn(page, "DeckBuilder")).some((s) => s.key.startsWith("games:")) ? true : null),
    "From your games in the builder",
    30_000,
  );
});

test("Decks & Collection: a pool card opens in the stats pane, Inspect shows Your play, and B goes back", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "the wide stats pane");
  test.setTimeout(150_000);
  await seeded(page, "decks", "Decks");
  // The pool's search field (a text field over the canvas).
  await page.getByPlaceholder("Search cards: name, trait, text").fill("Tenacity");
  // Tenacity (01093) sat in every seeded Spider-Man deck.
  // Once the search has narrowed the pool (it answers from a worker), Tenacity sits in the first row.
  const tenacity = () =>
    waitFor(
      async () => (await stopsIn(page, "Decks")).find((s) => s.key === "pool-card:01093" && s.rect.y < 400) ?? null,
      "Tenacity at the top of the pool",
      15_000,
    );
  // The first press may only take the focus off the search field, and a press that straddles a redraw (a scan
  // arriving) is dropped by design: press again until the card is in the pane.
  const inPane = async () => ((await stopsIn(page, "Decks")).some((s) => s.key === "card-back") ? true : null);
  for (let attempt = 0; attempt < 3 && !(await inPane()); attempt++) {
    await settle(page);
    await press(page, false, (await tenacity()).rect);
    await page.waitForTimeout(800);
  }
  await waitFor(inPane, "the card in the stats pane", 10_000);
  await waitFor(
    async () => ((await findText(page, "In your deck", "Decks")).length > 0 ? true : null),
    "what your games say about it",
    15_000,
  );
  // The pane reads your games in a worker, so its numbers can land a moment after the card shows.
  await waitFor(
    async () => ((await findText(page, "WITH SPIDER-MAN", "Decks")).length > 0 ? true : null),
    "the selected deck's hero",
    15_000,
  );

  // Inspect from the pane: the overlay has the same numbers in its Your play section.
  await settle(page);
  await pressStop(page, "Decks", "card-inspect", "Inspect");
  await waitFor(isActive(page, "InspectOverlay"), "Inspect", 15_000);
  await waitFor(
    async () => ((await findText(page, "YOUR PLAY", "InspectOverlay")).length > 0 ? true : null),
    "Your play in Inspect",
    15_000,
  );
  expect((await findText(page, "6 games", "InspectOverlay")).length, "in the deck all six games").toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await waitFor(async () => ((await activeScenes(page)).includes("InspectOverlay") ? null : true), "closed", 10_000);

  // B (Escape) goes back to the deck's stats.
  await settle(page);
  await page.keyboard.press("Escape");
  await waitFor(
    async () => ((await stopsIn(page, "Decks")).some((s) => s.key === "pane:deck") ? true : null),
    "the deck's stats again",
    10_000,
  );
  expect(await activeScenes(page)).toContain("Decks");
});

test("on a phone, a pool card tapped into the stats pane and back leaves no focus ring", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a touch screen");
  test.setTimeout(120_000);
  await seeded(page, "decks", "Decks");
  const ring = () =>
    page.evaluate(
      () =>
        (window as unknown as { __mcFocusState: Record<string, () => { ringShown: boolean }> }).__mcFocusState.Decks!()
          .ringShown,
    );
  await pressStop(page, "Decks", "tab:cards", "the Cards tab");
  const card = await waitFor(
    async () => (await stopsIn(page, "Decks")).find((s) => s.key.startsWith("pool-card:")) ?? null,
    "a pool card",
    15_000,
  );
  await settle(page);
  await page.touchscreen.tap(card.rect.x + card.rect.width / 2, card.rect.y + card.rect.height / 3);
  const back = await waitFor(
    async () => (await stopsIn(page, "Decks")).find((s) => s.key === "card-back") ?? null,
    "the card in the stats pane",
    15_000,
  );
  expect(await ring(), "no ring after a tap").toBe(false);
  await settle(page);
  await page.touchscreen.tap(back.rect.x + back.rect.width / 2, back.rect.y + back.rect.height / 2);
  await waitFor(
    async () => ((await stopsIn(page, "Decks")).some((s) => s.key.startsWith("pool-card:")) ? true : null),
    "back on the Cards tab",
    15_000,
  );
  expect(await ring(), "no ring after going back").toBe(false);
});

test("Hide hero cards takes a hero's own cards off the Cards tab; on a phone a tab tap shows no ring", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  await seeded(page, "stats", "PlayerStats");
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  await settle(page);
  const tab = await tabStop(page, "tab:all-cards");
  await press(page, phone, tab.rect);
  // The seeded games played Web-Shooter (01008), Spider-Man's own card.
  const own = "card:all:played:strip:0:01008";
  await waitFor(async () => ((await keys(page)).includes(own) ? true : null), "Spider-Man's own card", 10_000);
  if (phone) {
    const ring = await page.evaluate(
      () =>
        (window as unknown as { __mcFocusState: Record<string, () => { ringShown: boolean }> }).__mcFocusState
          .PlayerStats!().ringShown,
    );
    expect(ring, "no ring after a tap").toBe(false);
  }
  await settle(page);
  const hide = (await stopsOf(page)).find((s) => s.key === "hide-signature")!;
  await press(page, phone, hide.rect);
  await waitFor(async () => ((await keys(page)).includes(own) ? null : true), "hero cards hidden", 10_000);
});

test("Your stats' Cards tab: every hero's cards together", async ({ page }, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  await seeded(page, "stats", "PlayerStats");
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  await settle(page);
  const tab = await tabStop(page, "tab:all-cards");
  await press(page, phone, tab.rect);
  await waitFor(
    async () => ((await keys(page)).some((k) => k.startsWith("card:all:played:")) ? true : null),
    "the most played cards",
    10_000,
  );
});

/** Starts a backfill run of three games over a stand-in store; each game waits for `__releaseBackfill()`. */
async function startHeldBackfill(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { runStatsBackfill } = (await import("/src/progression/stats-backfill.ts")) as never as {
      runStatsBackfill(store: unknown, storage: null): Promise<void>;
    };
    const { SAVE_SCHEMA } = (await import("/src/engine/game-storage.ts")) as never as { SAVE_SCHEMA: number };
    const waiting: (() => void)[] = [];
    const w = window as unknown as { __releaseBackfill: () => boolean; __backfillDone: boolean };
    w.__releaseBackfill = () => {
      const next = waiting.shift();
      next?.();
      return next !== undefined;
    };
    w.__backfillDone = false;
    const saves = [0, 1, 2].map((i) => ({ id: `e2e-backfill-${i}`, schema: SAVE_SCHEMA, status: "won" }));
    void runStatsBackfill(
      {
        listSaves: async () => saves,
        backfillSummaries: () => new Promise<number>((resolve) => waiting.push(() => resolve(1))),
      },
      null,
    ).then(() => (w.__backfillDone = true));
  });
}

/** Lets the held run's next game finish, once it has asked for it. */
const release = async (page: Page): Promise<void> => {
  await waitFor(
    () =>
      page.evaluate(() => {
        const w = window as unknown as { __releaseBackfill: () => boolean };
        return w.__releaseBackfill() ? true : null;
      }),
    "the run asks for the next game",
    10_000,
  );
};

test("the Building your stats toast: shows on the Title, hides off it, and closing it keeps the run going", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  await openApp(page, "unlock=all");
  await waitFor(isActive(page, "Title"), "the Title", 30_000);
  await startHeldBackfill(page);
  await release(page);
  await waitFor(isActive(page, "BackfillToast"), "the toast", 15_000);
  await waitFor(
    async () => ((await findText(page, "1 of 3", "BackfillToast")).length > 0 ? true : null),
    "1 of 3 games",
    10_000,
  );
  expect((await findText(page, "keeps going in the background", "BackfillToast")).length).toBeGreaterThan(0);

  if (!phone) {
    // Off the Title it hides (it would sit on another screen's controls), and back on the Title it shows again.
    await settle(page);
    const decks = (await stopsIn(page, "Title")).find((s) => s.key === "decks")!;
    await press(page, false, decks.rect);
    await waitFor(isActive(page, "Decks"), "Decks & Collection", 30_000);
    expect(await activeScenes(page)).not.toContain("BackfillToast");
    await settle(page);
    await page.keyboard.press("Escape");
    await waitFor(isActive(page, "Title"), "the Title again", 30_000);
    await waitFor(isActive(page, "BackfillToast"), "the toast again", 15_000);
  }

  // ✕ closes it; the run goes on to the end without it.
  await settle(page);
  const close = await waitFor(
    async () => (await findText(page, "✕", "BackfillToast"))[0] ?? null,
    "the toast's close button",
    10_000,
  );
  await press(page, phone, { x: close.x - 10, y: close.y - 10, width: 20, height: 20 });
  await waitFor(async () => ((await activeScenes(page)).includes("BackfillToast") ? null : true), "closed", 10_000);
  await release(page);
  await release(page);
  await waitFor(
    () => page.evaluate(() => ((window as unknown as { __backfillDone: boolean }).__backfillDone ? true : null)),
    "the run finishes",
    10_000,
  );
  expect(await activeScenes(page)).not.toContain("BackfillToast");
});

test("the Villains tab says why you lose, and the deck builder reads your decks against each villain", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  await seeded(page, "deck-builder", "DeckBuilder");
  if (!phone) {
    const tab = await waitFor(
      async () => (await stopsIn(page, "DeckBuilder")).find((s) => s.key === "rail:games") ?? null,
      "the From your games tab",
      30_000,
    );
    await press(page, false, tab.rect);
    // Rhino is the most faced of the two villains the seeded games hold, and the stepper walks to Klaw.
    const stepper = await waitFor(
      async () => (await stopsIn(page, "DeckBuilder")).find((s) => s.key === "games:against") ?? null,
      "the Against stepper",
      30_000,
    );
    expect((await findText(page, "Against Rhino", "DeckBuilder")).length).toBeGreaterThan(0);
    const onKlaw = async () => ((await findText(page, "Against Klaw", "DeckBuilder")).length > 0 ? true : null);
    for (let attempt = 0; attempt < 3 && !(await onKlaw()); attempt++) {
      await settle(page);
      await press(page, false, stepper.rect);
      await page.waitForTimeout(800);
    }
    await waitFor(onKlaw, "the stepper reaches Klaw", 10_000);
  }

  await page.goto("/?screen=trophies&unlock=all");
  await waitFor(isActive(page, "TrophyRoom"), "the Trophy Room", 30_000);
  await settle(page);
  await clickText(page, phone ? "Stats" : "Your stats", {
    sceneKey: "TrophyRoom",
    until: isActive(page, "PlayerStats"),
    untilLabel: "the Stats screen",
  });
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  await settle(page);
  const villains = await tabStop(page, "tab:villains");
  await press(page, phone, villains.rect);
  await waitFor(async () => ((await keys(page)).includes("row:villain:why") ? true : null), "Why you lose", 10_000);
  // Both seeded losses were to the main scheme.
  expect((await findText(page, "Scheme 2", "PlayerStats")).length).toBeGreaterThan(0);
});

test("the deck builder's From your games: Cut takes a copy of a card that never comes out of the deck", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "the wide deck rail");
  test.setTimeout(120_000);
  await seeded(page, "deck-builder", "DeckBuilder");
  const tab = await waitFor(
    async () => (await stopsIn(page, "DeckBuilder")).find((s) => s.key === "rail:games") ?? null,
    "the From your games tab",
    30_000,
  );
  await press(page, false, tab.rect);
  // Tenacity (01093, basic) sat in every seeded game's deck and was never played. Black Cat (01002) never came out
  // either, but it is Spider-Man's own card, which the deck must keep (RRG 1.8 p. 50): it is never offered.
  await waitFor(
    async () =>
      (await stopsIn(page, "DeckBuilder")).find((s) => s.key.startsWith("games:") && s.key.endsWith(":01093")) ?? null,
    "Cut on Tenacity",
    30_000,
  );
  // Cut takes one copy, the same as the deck list's −: the deck drops from 40 cards to 39.
  expect((await findText(page, "40 cards", "DeckBuilder")).length).toBeGreaterThan(0);
  // Card scans arriving redraw the rail, and a press that straddles a redraw is dropped by design: settle first, and
  // press again if one was.
  const cutDown = async () => ((await findText(page, "39 cards", "DeckBuilder")).length > 0 ? true : null);
  for (let attempt = 0; attempt < 3 && !(await cutDown()); attempt++) {
    await settle(page);
    const now = (await stopsIn(page, "DeckBuilder")).find(
      (s) => s.key.startsWith("games:") && s.key.endsWith(":01093"),
    );
    if (now) await press(page, false, now.rect);
    await page.waitForTimeout(800);
  }
  await waitFor(cutDown, "the deck is one card smaller", 10_000);
  expect(
    (await stopsIn(page, "DeckBuilder")).some((s) => s.key.startsWith("games:") && s.key.endsWith(":01002")),
    "no Cut on Black Cat",
  ).toBe(false);
});

test("a swipe of a phone's tab row scrolls it and opens no tab; a tap does", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a phone's tabs are one sideways row");
  test.setTimeout(120_000);
  await seeded(page, "stats", "PlayerStats");
  await waitFor(overviewUp(page), "the Overview tiles", 30_000);
  await settle(page);
  const heroes = (await stopsOf(page)).find((s) => s.key === "tab:heroes")!;
  const y = heroes.rect.y + heroes.rect.height / 2;
  // Starts on a tab and lifts on another: the row moves, and Overview stays open.
  await swipe(page, { x: 340, y }, { x: 90, y });
  await page.waitForTimeout(500);
  expect(await keys(page)).toContain("tile:record");
  const moved = (await stopsOf(page)).find((s) => s.key === "tab:heroes")!;
  expect(moved.rect.x, "the row scrolled").toBeLessThan(heroes.rect.x);
  // The flick's momentum has to die away, or the tab moves out from under the tap.
  await page.waitForTimeout(1500);
  await tabStop(page, "tab:records");
  await page.waitForTimeout(800);
  await press(page, true, (await tabStop(page, "tab:records")).rect);
  await waitFor(
    async () => ((await keys(page)).includes("row:rec:fastest") ? true : null),
    "a tap opens Records",
    10_000,
  );
});
