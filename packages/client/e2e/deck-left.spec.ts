import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressUntil, settle, waitFor } from "./helpers.js";
import { PAD, installPad, setButton } from "./pad-e2e-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, findVisibleText, openApp, startGame, type Rect } from "./wave6-helpers-b.js";
import { facts, press } from "./x-men-helpers.js";

/**
 * "Cards left" (`scenes/deck-left.ts`): a tap on a deck lists what is left of it, with counts and never in order, and
 * each of the three settings hides what it feeds. On a phone, a swipe of the list that lifts over a tab or Close must
 * press neither (`e2e/villain-review-handle.spec.ts`, issue #227).
 */

const R3 = 11;
const OVERLAY = "DeckLeftOverlay";

interface DeckLeftDebug {
  tab(): string;
  close(): Rect;
  tabRects(): readonly Rect[];
  list(): Rect;
  summary(): readonly string[];
  rows(): readonly { name: string; count: number }[];
  stages(): readonly { name: string; inPlay: boolean }[];
  cards(): readonly Rect[];
  hoverShown(): string | null;
}

const debugOf = <T>(page: Page, read: (debug: DeckLeftDebug) => T): Promise<T | null> =>
  page.evaluate(
    ([source]) => {
      const debug = (window as unknown as { __mcDeckLeftDebug?: DeckLeftDebug }).__mcDeckLeftDebug;
      return debug ? (new Function("debug", `return (${source})(debug)`)(debug) as never) : null;
    },
    [read.toString()] as const,
  );

const pileRect = (page: Page, prefix: string): Promise<Rect | null> =>
  page.evaluate((start) => {
    const debug = (window as unknown as { __mcBoardDebug: { allPileRects(): [string, Rect][] } }).__mcBoardDebug;
    return debug.allPileRects().find(([key]) => key.startsWith(start))?.[1] ?? null;
  }, prefix);

const center = (rect: Rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

async function tapPile(page: Page, phone: boolean, prefix: string): Promise<void> {
  // The phone board shows one tab at a time, and the encounter deck rides on Enemies.
  if (phone && prefix === "encounterDeck" && (await pileRect(page, prefix)) === null) {
    const tab = await waitFor(async () => (await findVisibleText(page, "ENEMIES"))[0] ?? null, "the Enemies tab");
    await press(page, phone, tab!.x, tab!.y);
    await settle(page, { quietMs: 300, maxMs: 3000 });
  }
  const rect = (await waitFor(() => pileRect(page, prefix), `the ${prefix} pile`))!;
  const { x, y } = center(rect);
  await press(page, phone, x, y);
}

const overlayUp = async (page: Page): Promise<boolean> => (await activeScenes(page)).includes(OVERLAY);

async function openPile(page: Page, phone: boolean, prefix: string): Promise<void> {
  await pressUntil(
    page,
    () => tapPile(page, phone, prefix),
    () => overlayUp(page),
    `${prefix} opens the list`,
  );
  await settle(page, { quietMs: 300, maxMs: 3000 });
}

async function closeOverlay(page: Page, phone: boolean): Promise<void> {
  const close = (await debugOf(page, (debug) => debug.close()))!;
  await pressUntil(
    page,
    () => press(page, phone, close.x + close.width / 2, close.y + close.height / 2),
    async () => !(await overlayUp(page)),
    "Close puts the table back",
  );
  await settle(page, { quietMs: 300, maxMs: 3000 });
}

/** The rest of the suite's settings, plus these. */
async function withSettings(page: Page, overrides: Record<string, boolean>): Promise<void> {
  await page.addInitScript((set) => {
    const stored = JSON.parse(localStorage.getItem("mc-settings") ?? '{"version":1}') as Record<string, unknown>;
    localStorage.setItem("mc-settings", JSON.stringify({ ...stored, ...set }));
  }, overrides);
}

async function boardReady(page: Page): Promise<void> {
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page);
}

test("the defaults: your deck lists, the encounter deck still opens Inspect", async ({ page }, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await boardReady(page);

  await openPile(page, phone, "deck");
  const deck = await facts(page, (game) => game.players[0].deck.length as number);
  const rows = (await debugOf(page, (debug) => debug.rows()))!;
  expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(deck);
  expect(rows.length).toBeLessThan(deck);
  expect(await debugOf(page, (debug) => debug.tabRects().length)).toBe(0);
  await page.screenshot({ path: info.outputPath(`deck-left-hero-${info.project.name}.png`) });
  await closeOverlay(page, phone);

  await tapPile(page, phone, "encounterDeck");
  await waitFor(async () => (await activeScenes(page)).includes("InspectOverlay") || null, "Inspect opens");
  expect(await overlayUp(page)).toBe(false);
  expect(errors).toEqual([]);
});

test("with every setting off a deck is only a deck", async ({ page }, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  await withSettings(page, { deckCountsHero: false, deckCountsEncounter: false, deckBoostAverage: false });
  await boardReady(page);
  await tapPile(page, phone, "deck");
  await page.waitForTimeout(800);
  expect(await overlayUp(page)).toBe(false);
});

test("a setting turned on during a game reaches the deck without a reload (#575)", async ({ page }, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  await withSettings(page, { deckCountsHero: true, deckCountsEncounter: false, deckBoostAverage: false });
  await boardReady(page);
  // Written the way Settings over Pause writes it (`appSession().settings`); nothing about the game changes.
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { settings: Record<string, unknown> };
    };
    appSession().settings = { ...appSession().settings, deckCountsEncounter: true };
  });
  await settle(page, { quietMs: 300, maxMs: 3000 });
  await openPile(page, phone, "encounterDeck");
  expect((await debugOf(page, (debug) => debug.rows()))!.length).toBeGreaterThan(0);
  expect((await debugOf(page, (debug) => debug.stages()))![0]).toEqual({ name: "Rhino I", inPlay: true });
  // Each stage is a real card tile: on a desktop the hover opens on it.
  if (!phone) {
    const tile = await waitFor(
      async () => (await debugOf(page, (debug) => debug.cards()))?.[0] ?? null,
      "a stage tile",
    );
    await page.mouse.move(tile!.x + tile!.width / 2, tile!.y + tile!.height / 2);
    await waitFor(() => debugOf(page, (debug) => debug.hoverShown()), "the stage's hover");
  }
});

test("the boost average alone: the encounter deck shows the line and no cards", async ({ page }, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  await withSettings(page, { deckCountsHero: false, deckCountsEncounter: false, deckBoostAverage: true });
  await boardReady(page);
  await openPile(page, phone, "encounterDeck");
  expect(await debugOf(page, (debug) => debug.rows().length)).toBe(0);
  expect((await debugOf(page, (debug) => debug.summary()))!.join(" ")).toMatch(/^Boost: \d\.\d icons per card/);
});

test("both decks: the tabs switch, and a swipe that lifts on a control presses nothing", async ({ page }, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  await withSettings(page, { deckCountsHero: true, deckCountsEncounter: true, deckBoostAverage: true });
  await boardReady(page);
  await openPile(page, phone, "encounterDeck");
  expect(await debugOf(page, (debug) => debug.tab())).toBe("encounter");
  expect((await debugOf(page, (debug) => debug.summary()))!.join(" ")).toContain("Boost:");

  const tabs = (await debugOf(page, (debug) => debug.tabRects()))!;
  expect(tabs).toHaveLength(2);

  if (phone) {
    // A finger that starts in the list and lifts over the Your deck tab: the list scrolls, the tab stays.
    const list = (await debugOf(page, (debug) => debug.list()))!;
    const from = { x: list.x + list.width / 2, y: list.y + list.height - 20 };
    const to = center(tabs[0]!);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
    for (let i = 1; i <= 10; i++) {
      const point = { x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, id: 1 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    await settle(page, { quietMs: 300, maxMs: 3000 });
    expect(await debugOf(page, (debug) => debug.tab())).toBe("encounter");
    expect(await overlayUp(page)).toBe(true);
  }

  await pressUntil(
    page,
    () => press(page, phone, center(tabs[0]!).x, center(tabs[0]!).y),
    async () => (await debugOf(page, (debug) => debug.tab())) === "hero",
    "the Your deck tab",
  );
  expect((await debugOf(page, (debug) => debug.summary()))!.join(" ")).not.toContain("Boost:");
});

test("a controller reaches it: R3 opens the list and steps the decks, B closes it", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "A pad on the desktop layout is enough; the phone has no R3 hint to check.");
  test.setTimeout(180_000);
  await installPad(page);
  await withSettings(page, { deckCountsHero: true, deckCountsEncounter: true, deckBoostAverage: false });
  await boardReady(page);

  const tapButton = async (index: number): Promise<void> => {
    await setButton(page, index, true);
    await page.waitForTimeout(120);
    await setButton(page, index, false);
    await page.waitForTimeout(120);
  };
  await pressUntil(
    page,
    () => tapButton(R3),
    () => overlayUp(page),
    "R3 opens the list",
  );
  expect(await debugOf(page, (debug) => debug.tab())).toBe("hero");
  await settle(page, { quietMs: 300, maxMs: 3000 });
  await pressUntil(
    page,
    () => tapButton(R3),
    async () => (await debugOf(page, (debug) => debug.tab())) === "encounter",
    "R3 steps to the encounter deck",
  );
  await pressUntil(
    page,
    () => tapButton(PAD.b),
    async () => !(await overlayUp(page)),
    "B closes the list",
  );
});

test("a keyboard reaches it: the deck key opens the list", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "A phone has no keys.");
  test.setTimeout(180_000);
  await boardReady(page);
  await pressUntil(
    page,
    () => page.keyboard.press("Digit6"),
    () => overlayUp(page),
    "6 opens the list",
  );
  expect(await debugOf(page, (debug) => debug.tab())).toBe("hero");
  await pressUntil(
    page,
    () => page.keyboard.press("Escape"),
    async () => !(await overlayUp(page)),
    "Escape closes it",
  );
});
