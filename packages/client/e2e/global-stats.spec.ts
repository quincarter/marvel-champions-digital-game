import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, hasText, settle, waitFor } from "./helpers.js";
import { waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import {
  fakeWorker,
  fewGames,
  globalRequests,
  hasStop,
  isPhone,
  openSaveData,
  press,
  seedFinishedGames,
  stopKeys,
  stopRect,
  stored,
  swipeOver,
} from "./global-stats-helpers.js";

/**
 * Opt-in global win rates, on screen: the ask-once question on the Title, the Settings row, the You / Everyone chips on
 * Your stats and the deck builder's Against block. The Worker is faked with `page.route`; the game must work with it
 * down. Nothing is requested before Everyone is pressed.
 */

const PROMPT = "GlobalStatsPromptOverlay";
const STATS = "PlayerStats";
const BUILDER = "DeckBuilder";

const textUp = (page: Page, text: string, scene: string) => async () =>
  (await hasText(page, text, scene)) ? true : null;

/** Seeds the games, then loads `url` and waits for `scene`. */
async function seededAt(page: Page, url: string, scene: string): Promise<void> {
  await openApp(page, "unlock=all");
  await seedFinishedGames(page);
  await page.goto(url);
  await waitForScene(page, scene, 30_000);
  await settle(page);
}

test("Settings > More > Save data: the share row turns on and off, with games already finished marked sent", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const worker = await fakeWorker(page);
  // The shortest screens the menu must fit: a short laptop window, and a short phone.
  await page.setViewportSize(isPhone(page) ? { width: 375, height: 667 } : { width: 1280, height: 720 });
  await openApp(page, "unlock=all");
  await seedFinishedGames(page);
  // Answered already (the ask has its own test), so it is not over the Title.
  await page.evaluate(() => localStorage.setItem("global-stats-consent", "off"));
  await page.goto("/?unlock=all");
  await openSaveData(page);

  expect(await hasText(page, "Share anonymous game results", "SaveDataOverlay")).toBe(true);
  await waitFor(textUp(page, "Off.", "SaveDataOverlay"), "the row says Off", 10_000);
  // The way back out of sharing must be fully on screen: the menu does not scroll.
  const view = page.viewportSize()!;
  const row = await stopRect(page, "SaveDataOverlay", "row:global");
  expect(row.y, "row top").toBeGreaterThan(0);
  expect(row.y + row.height, "row bottom").toBeLessThanOrEqual(view.height - 16);
  expect(row.x + row.width, "row right").toBeLessThanOrEqual(view.width);
  await press(page, "SaveDataOverlay", "row:global");
  await waitFor(textUp(page, "On.", "SaveDataOverlay"), "the row says On", 10_000);
  expect(await stored(page, "global-stats-consent")).toBe("on");
  // The games finished before opting in are in the sent set, so none of them is ever sent.
  const sent = JSON.parse((await stored(page, "global-stats-sent")) ?? "[]") as string[];
  expect(sent).toEqual(expect.arrayContaining(["e2e-global-0", "e2e-global-4"]));

  await press(page, "SaveDataOverlay", "row:global");
  await waitFor(textUp(page, "Off.", "SaveDataOverlay"), "the row says Off again", 10_000);
  expect(await stored(page, "global-stats-consent")).toBe("off");
  // Reading and changing it needed no network.
  expect(globalRequests(worker)).toEqual([]);
});

test("the ask comes once, after a finished game: No thanks records off and it never returns", async ({ page }) => {
  test.setTimeout(120_000);
  const worker = await fakeWorker(page);
  // A device with no finished game is not asked.
  await openApp(page, "unlock=all");
  await settle(page);
  await page.waitForTimeout(1500);
  expect(await activeScenes(page)).not.toContain(PROMPT);

  await seedFinishedGames(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, PROMPT, 30_000);
  await page.waitForTimeout(700);
  expect((await findText(page, "Share your finished games to build win rates for everyone?", PROMPT)).length).toBe(1);
  expect(await hasText(page, "It sends no name, account or device", PROMPT)).toBe(true);
  // Two buttons, side by side in rank: the same size, neither the forward action.
  const share = await stopRect(page, PROMPT, "share");
  const decline = await stopRect(page, PROMPT, "decline");
  expect(share.width).toBe(decline.width);
  expect(share.height).toBe(decline.height);
  expect(await stored(page, "global-stats-consent")).toBeNull();

  await press(page, PROMPT, "decline");
  await waitFor(async () => ((await activeScenes(page)).includes(PROMPT) ? null : true), "the question closes", 10_000);
  expect(await stored(page, "global-stats-consent")).toBe("off");
  // Declining sent and requested nothing, and a later visit does not ask again.
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title", 30_000);
  await settle(page);
  await page.waitForTimeout(1500);
  expect(await activeScenes(page)).not.toContain(PROMPT);
  expect(globalRequests(worker)).toEqual([]);
});

test("the ask ignores a tap in its first moments, then answers", async ({ page }) => {
  test.setTimeout(120_000);
  await fakeWorker(page);
  await openApp(page, "unlock=all");
  await seedFinishedGames(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, PROMPT, 30_000);
  const t0 = Date.now();
  const rect = await stopRect(page, PROMPT, "share");
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (isPhone(page)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  // The scene was seen within one poll (150 ms) of opening: a tap this soon is inside the 400 ms window.
  if (Date.now() - t0 < 150) {
    await page.waitForTimeout(100);
    expect(await stored(page, "global-stats-consent")).toBeNull();
    expect(await activeScenes(page)).toContain(PROMPT);
  }
  await page.waitForTimeout(700);
  await press(page, PROMPT, "decline");
  await waitFor(async () => ((await activeScenes(page)).includes(PROMPT) ? null : true), "closes", 10_000);
  expect(await stored(page, "global-stats-consent")).toBe("off");
});

test("the ask: Share turns sharing on and marks the finished games sent", async ({ page }) => {
  test.setTimeout(120_000);
  await fakeWorker(page);
  await openApp(page, "unlock=all");
  await seedFinishedGames(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, PROMPT, 30_000);
  await page.waitForTimeout(700);
  await press(page, PROMPT, "share");
  await waitFor(async () => ((await activeScenes(page)).includes(PROMPT) ? null : true), "the question closes", 10_000);
  expect(await stored(page, "global-stats-consent")).toBe("on");
  expect(JSON.parse((await stored(page, "global-stats-sent")) ?? "[]")).toContain("e2e-global-2");
});

test("Your stats: Everyone reads the Worker on first use and shows its rows; the filters are not offered", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const worker = await fakeWorker(page);
  await seededAt(page, "/?screen=stats&unlock=all", STATS);
  await press(page, STATS, "tab:heroes");
  await waitFor(async () => ((await hasStop(page, STATS, "row:hero:favorite")) ? true : null), "Heroes opens", 10_000);
  // Showing your own games asks the Worker nothing.
  expect(globalRequests(worker)).toEqual([]);
  expect(await hasStop(page, STATS, "source:everyone")).toBe(true);
  expect(await hasStop(page, STATS, "source:you")).toBe(true);

  await press(page, STATS, "source:everyone");
  await waitFor(
    async () => ((await hasStop(page, STATS, "row:global:hero:01001a")) ? true : null),
    "Everyone's hero rows",
    15_000,
  );
  expect(globalRequests(worker)).toEqual(["GET /global/stats"]);
  // The hero / villain / difficulty chips fold your games only: gone on Everyone, back on You.
  expect(await hasStop(page, STATS, "filter:hero")).toBe(false);
  expect(await hasStop(page, STATS, "filter:toggle")).toBe(false);
  // Villains and Encounter have Everyone too, without another request.
  await press(page, STATS, "tab:villains");
  await waitFor(
    async () => ((await hasStop(page, STATS, "row:global:villain:Rhino")) ? true : null),
    "Everyone's villain rows",
    10_000,
  );
  expect(globalRequests(worker)).toEqual(["GET /global/stats"]);
  // The choice is kept across Everyone's tabs, and You goes back to the tab Everyone was chosen from (Heroes).
  await press(page, STATS, "tab:heroes");
  await press(page, STATS, "source:you");
  await waitFor(async () => ((await hasStop(page, STATS, "row:hero:favorite")) ? true : null), "back to You", 10_000);
});

test("Your stats: with the Worker down, Everyone says so and the screen still works", async ({ page }) => {
  test.setTimeout(120_000);
  const worker = await fakeWorker(page);
  worker.down = true;
  await seededAt(page, "/?screen=stats&unlock=all", STATS);
  await press(page, STATS, "tab:villains");
  await press(page, STATS, "source:everyone");
  await waitFor(textUp(page, "Everyone's numbers aren't available right now.", STATS), "the unavailable note", 15_000);
  // Still usable: another tab, and back to your own numbers (You returns to Villains, where Everyone was chosen).
  await press(page, STATS, "tab:heroes");
  await press(page, STATS, "source:you");
  await press(page, STATS, "tab:heroes");
  await waitFor(async () => ((await hasStop(page, STATS, "row:hero:favorite")) ? true : null), "your rows", 10_000);
  // The Worker comes back: choosing Everyone again tries again.
  worker.down = false;
  await press(page, STATS, "source:everyone");
  await waitFor(
    async () => ((await hasStop(page, STATS, "row:global:hero:01001a")) ? true : null),
    "Everyone's rows after a retry",
    15_000,
  );
});

test("phone: a swipe of the list that lifts over the You / Everyone chips presses neither", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a finger");
  test.setTimeout(120_000);
  const worker = await fakeWorker(page);
  await seededAt(page, "/?screen=stats&unlock=all", STATS);
  await press(page, STATS, "tab:heroes");
  await waitFor(async () => ((await hasStop(page, STATS, "source:everyone")) ? true : null), "the chips", 10_000);
  await settle(page);
  const chip = await stopRect(page, STATS, "source:everyone");
  const row = await stopRect(page, STATS, "row:hero:favorite");
  // A finger that goes down on the list and lifts over the Everyone chip.
  const from = { x: row.x + row.width / 2, y: row.y + row.height / 2 };
  const to = { x: chip.x + chip.width / 2, y: chip.y + chip.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 10; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10, id: 1 }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await settle(page);
  expect(await hasStop(page, STATS, "row:hero:favorite")).toBe(true);
  expect(globalRequests(worker)).toEqual([]);
});

test("the deck builder: Everyone swaps the Against block to everyone's decks, read on the press", async ({
  page,
}, info) => {
  test.skip(isPhone(page) || info.project.name === "phone", "the wide deck rail");
  test.setTimeout(120_000);
  const worker = await fakeWorker(page);
  worker.cards["Rhino"] = {
    villain: "Rhino",
    wins: 12,
    losses: 8,
    inWins: { "01008": 11 },
    inLosses: { "01008": 1 },
  };
  await seededAt(page, "/?screen=deck-builder&unlock=all", BUILDER);
  await press(page, BUILDER, "rail:games");
  await waitFor(async () => ((await hasStop(page, BUILDER, "games:against")) ? true : null), "the stepper", 30_000);
  await waitFor(textUp(page, "Against Rhino", BUILDER), "Against Rhino (yours)", 10_000);
  expect(await hasStop(page, BUILDER, "games:source:everyone")).toBe(true);
  expect(globalRequests(worker)).toEqual([]);

  await press(page, BUILDER, "games:source:everyone");
  await waitFor(textUp(page, "12 wins, 8 losses", BUILDER), "everyone's Rhino decks", 15_000);
  expect(globalRequests(worker)).toEqual(["GET /global/cards?villain=Rhino"]);

  // The stepper still walks your own faced villains; Everyone has nothing for Klaw (404), and says so.
  await press(page, BUILDER, "games:against");
  await waitFor(textUp(page, "Rows appear once this villain has 20 shared games.", BUILDER), "the none note", 15_000);
  expect(globalRequests(worker)).toContain("GET /global/cards?villain=Klaw");

  // Back to your own decks: the stepper, Klaw's own numbers and no request.
  const before = globalRequests(worker).length;
  await press(page, BUILDER, "games:source:yours");
  await waitFor(async () => ((await hasText(page, "Rows appear once", BUILDER)) ? null : true), "yours", 10_000);
  expect(globalRequests(worker).length).toBe(before);
});

test("the deck builder with the Worker down: a note, and the builder keeps working", async ({ page }, info) => {
  test.skip(isPhone(page) || info.project.name === "phone", "the wide deck rail");
  test.setTimeout(120_000);
  const worker = await fakeWorker(page);
  worker.down = true;
  await seededAt(page, "/?screen=deck-builder&unlock=all", BUILDER);
  await press(page, BUILDER, "rail:games");
  await waitFor(async () => ((await hasStop(page, BUILDER, "games:against")) ? true : null), "the stepper", 30_000);
  await press(page, BUILDER, "games:source:everyone");
  await waitFor(
    textUp(page, "Everyone's numbers aren't available right now.", BUILDER),
    "the unavailable note",
    15_000,
  );
  await press(page, BUILDER, "rail:deck");
  await waitFor(async () => ((await hasStop(page, BUILDER, "games:against")) ? null : true), "the deck tab", 10_000);
});

const tabsOf = async (page: Page): Promise<string[]> =>
  (await stopKeys(page, STATS)).filter((k) => k.startsWith("tab:"));

/** Loads Your stats with no finished game at all. */
async function emptyStats(page: Page): Promise<void> {
  await openApp(page, "unlock=all");
  await page.goto("/?screen=stats&unlock=all");
  await waitForScene(page, STATS, 30_000);
  await settle(page);
}

test("Your stats: the You / Everyone switch is on every tab, Everyone narrows the tabs and lands on Villains", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const worker = await fakeWorker(page);
  worker.stats = fewGames(4);
  await seededAt(page, "/?screen=stats&unlock=all", STATS);
  await waitFor(async () => ((await hasStop(page, STATS, "source:everyone")) ? true : null), "the switch", 15_000);
  // On Overview, first in the route after Back, with games.
  const keys = await stopKeys(page, STATS);
  expect(keys.slice(0, 3)).toEqual(["back", "source:you", "source:everyone"]);
  expect(await tabsOf(page)).toContain("tab:overview");
  const you = await stopRect(page, STATS, "source:you");
  const first = await stopRect(page, STATS, "tab:overview");
  expect(you.y + you.height).toBeLessThanOrEqual(first.y);
  expect(globalRequests(worker)).toEqual([]);

  await press(page, STATS, "source:everyone");
  await waitFor(textUp(page, "4 games shared so far.", STATS), "the empty note with the count", 15_000);
  expect(await hasText(page, "Rows appear once a villain, hero or set has 20 shared games.", STATS)).toBe(true);
  // Only the tabs Everyone has, filters hidden, and the switch still in its place.
  expect(await tabsOf(page)).toEqual(["tab:heroes", "tab:villains", "tab:encounter"]);
  expect(await hasStop(page, STATS, "filter:hero")).toBe(false);
  expect(await hasStop(page, STATS, "filter:toggle")).toBe(false);
  expect(await stopRect(page, STATS, "source:you")).toEqual(you);
  expect(globalRequests(worker)).toEqual(["GET /global/stats"]);

  // You returns to the tab Everyone was chosen from: Overview.
  await press(page, STATS, "source:you");
  await waitFor(async () => ((await tabsOf(page)).includes("tab:overview") ? true : null), "Overview again", 10_000);
  expect((await stopKeys(page, STATS)).some((k) => k.startsWith("tile:"))).toBe(true);
});

test("Your stats: with no finished game the switch is still there and Everyone has its three tabs", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const worker = await fakeWorker(page);
  worker.stats = fewGames(0);
  await emptyStats(page);
  await waitFor(async () => ((await hasStop(page, STATS, "source:everyone")) ? true : null), "the switch", 15_000);
  expect(await tabsOf(page)).toEqual(["tab:overview"]);
  expect((await stopKeys(page, STATS)).slice(0, 3)).toEqual(["back", "source:you", "source:everyone"]);
  expect(globalRequests(worker)).toEqual([]);
  await press(page, STATS, "source:everyone");
  await waitFor(textUp(page, "0 games shared so far.", STATS), "the empty note", 15_000);
  expect(await tabsOf(page)).toEqual(["tab:heroes", "tab:villains", "tab:encounter"]);
  await press(page, STATS, "source:you");
  await waitFor(async () => ((await tabsOf(page)).length === 1 ? true : null), "back to Overview", 10_000);
});

test("Your stats: Share my games turns sharing on with one press, marks finished games sent, then goes", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const worker = await fakeWorker(page);
  worker.stats = fewGames(4);
  await seededAt(page, "/?screen=stats&unlock=all", STATS);
  // Not on You, and choosing Everyone turns nothing on by itself.
  expect(await hasStop(page, STATS, "share:global")).toBe(false);
  await press(page, STATS, "source:everyone");
  await waitFor(async () => ((await hasStop(page, STATS, "share:global")) ? true : null), "Share my games", 15_000);
  expect(await hasText(page, "Shares each game you finish from now on", STATS)).toBe(true);
  await page.waitForTimeout(500);
  expect(await stored(page, "global-stats-consent")).toBeNull();

  await press(page, STATS, "share:global");
  await waitFor(async () => ((await hasStop(page, STATS, "share:global")) ? null : true), "the button goes", 10_000);
  expect(await stored(page, "global-stats-consent")).toBe("on");
  const sent = JSON.parse((await stored(page, "global-stats-sent")) ?? "[]") as string[];
  expect(sent).toEqual(expect.arrayContaining(["e2e-global-0", "e2e-global-4"]));
  expect(await hasText(page, "SHARING ON", STATS)).toBe(true);
});

test("Your stats: already sharing, there is no Share my games", async ({ page }) => {
  test.setTimeout(120_000);
  const worker = await fakeWorker(page);
  worker.stats = fewGames(4);
  await openApp(page, "unlock=all");
  await seedFinishedGames(page);
  await page.evaluate(() => localStorage.setItem("global-stats-consent", "on"));
  await page.goto("/?screen=stats&unlock=all");
  await waitForScene(page, STATS, 30_000);
  await settle(page);
  await press(page, STATS, "source:everyone");
  await waitFor(textUp(page, "4 games shared so far.", STATS), "the empty note", 15_000);
  expect(await hasStop(page, STATS, "share:global")).toBe(false);
  expect(await hasText(page, "SHARING ON", STATS)).toBe(true);
});

test("phone: a swipe of the list that lifts over Share my games does not turn sharing on", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a finger");
  test.setTimeout(120_000);
  await fakeWorker(page);
  await seededAt(page, "/?screen=stats&unlock=all", STATS);
  await press(page, STATS, "source:everyone");
  await waitFor(async () => ((await hasStop(page, STATS, "row:global:villain:Rhino")) ? true : null), "rows", 15_000);
  await settle(page);
  const share = await stopRect(page, STATS, "share:global");
  const row = await stopRect(page, STATS, "row:global:villain:Rhino");
  await swipeOver(page, row, share);
  await settle(page);
  expect(await hasStop(page, STATS, "share:global")).toBe(true);
  expect(await stored(page, "global-stats-consent")).toBeNull();
});

test("the deck builder with no games: the switch is there and Everyone walks the pool's villains", async ({
  page,
}, info) => {
  test.skip(isPhone(page) || info.project.name === "phone", "the wide deck rail");
  test.setTimeout(120_000);
  const worker = await fakeWorker(page);
  await openApp(page, "unlock=all");
  await page.goto("/?screen=deck-builder&unlock=all");
  await waitForScene(page, BUILDER, 30_000);
  await settle(page);
  await press(page, BUILDER, "rail:games");
  await waitFor(
    async () => ((await hasStop(page, BUILDER, "games:source:everyone")) ? true : null),
    "the pair",
    30_000,
  );
  expect(await hasStop(page, BUILDER, "games:source:yours")).toBe(true);
  expect(await hasStop(page, BUILDER, "games:against")).toBe(false);
  expect(await hasText(page, "Finish a game to see your decks here. Everyone works now.", BUILDER)).toBe(true);
  expect(globalRequests(worker)).toEqual([]);

  await press(page, BUILDER, "games:source:everyone");
  await waitFor(async () => ((await hasStop(page, BUILDER, "games:against")) ? true : null), "the stepper", 15_000);
  await waitFor(async () => (globalRequests(worker).length > 0 ? true : null), "the first villain's read", 15_000);
  const first = globalRequests(worker)[0]!;
  expect(first).toMatch(/^GET \/global\/cards\?villain=/);
  // Sharing is off: nothing turns it on by itself.
  expect(await stored(page, "global-stats-consent")).toBeNull();
  await press(page, BUILDER, "games:against");
  await waitFor(async () => (globalRequests(worker).length > 1 ? true : null), "the next villain's read", 15_000);
  expect(globalRequests(worker)[1]).not.toBe(first);
});

test("Your stats: View on a pad and Shift+B on a keyboard switch You / Everyone", async ({ page }) => {
  test.setTimeout(120_000);
  await fakeWorker(page);
  await seededAt(page, "/?screen=stats&unlock=all", STATS);
  await waitFor(async () => ((await hasStop(page, STATS, "source:everyone")) ? true : null), "the switch", 15_000);
  await page.keyboard.press("Shift+B");
  await waitFor(
    async () => ((await tabsOf(page)).join() === "tab:heroes,tab:villains,tab:encounter" ? true : null),
    "Everyone's tabs",
    10_000,
  );
  await page.keyboard.press("Shift+B");
  await waitFor(async () => ((await tabsOf(page)).includes("tab:overview") ? true : null), "You again", 10_000);
});

test("Your stats: a named tab opens on You even when Everyone was kept from before", async ({ page }) => {
  test.setTimeout(120_000);
  await fakeWorker(page);
  await seededAt(page, "/?screen=stats&unlock=all", STATS);
  await press(page, STATS, "source:everyone");
  await waitFor(async () => ((await tabsOf(page)).length === 3 ? true : null), "Everyone", 10_000);
  // Reopen the screen the way a deck\x27s "Open in Your stats" does, on a named tab.
  await page.evaluate(() => {
    const game = (
      window as unknown as { __mcGame: { scene: { stop(k: string): void; start(k: string, d: object): void } } }
    ).__mcGame;
    game.scene.stop("PlayerStats");
    game.scene.start("PlayerStats", { tab: "overview" });
  });
  await waitFor(async () => ((await tabsOf(page)).includes("tab:overview") ? true : null), "You on Overview", 15_000);
  expect(await hasStop(page, STATS, "share:global")).toBe(false);
});

test("the deck builder: Share my games turns sharing on with one press and marks finished games sent", async ({
  page,
}, info) => {
  test.skip(isPhone(page) || info.project.name === "phone", "the wide deck rail");
  test.setTimeout(120_000);
  const worker = await fakeWorker(page);
  await seededAt(page, "/?screen=deck-builder&unlock=all", BUILDER);
  await press(page, BUILDER, "rail:games");
  await press(page, BUILDER, "games:source:everyone");
  await waitFor(async () => ((await hasStop(page, BUILDER, "games:share")) ? true : null), "Share my games", 15_000);
  expect(await stored(page, "global-stats-consent")).toBeNull();
  await press(page, BUILDER, "games:share");
  await waitFor(async () => ((await hasStop(page, BUILDER, "games:share")) ? null : true), "the button goes", 10_000);
  expect(await stored(page, "global-stats-consent")).toBe("on");
  const sent = JSON.parse((await stored(page, "global-stats-sent")) ?? "[]") as string[];
  expect(sent).toEqual(expect.arrayContaining(["e2e-global-0", "e2e-global-4"]));
  expect(globalRequests(worker).every((r) => r.startsWith("GET /global/cards"))).toBe(true);
});

test("phone, the deck builder\x27s From your games tab: Share my games works, and a swipe lifted over it fires nothing", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "a finger");
  test.setTimeout(120_000);
  await fakeWorker(page);
  await seededAt(page, "/?screen=deck-builder&unlock=all", BUILDER);
  await press(page, BUILDER, "tab:games");
  await press(page, BUILDER, "games:source:everyone");
  await waitFor(async () => ((await hasStop(page, BUILDER, "games:share")) ? true : null), "Share my games", 15_000);
  await settle(page);
  const share = await stopRect(page, BUILDER, "games:share");
  const view = page.viewportSize()!;
  const start = {
    x: share.x + share.width / 2,
    y: Math.min(view.height - 20, share.y + share.height + 140),
    width: 0,
    height: 0,
  };
  await swipeOver(page, start, share);
  await settle(page);
  expect(await hasStop(page, BUILDER, "games:share")).toBe(true);
  expect(await stored(page, "global-stats-consent")).toBeNull();
  await press(page, BUILDER, "games:share");
  await waitFor(async () => ((await hasStop(page, BUILDER, "games:share")) ? null : true), "the button goes", 10_000);
  expect(await stored(page, "global-stats-consent")).toBe("on");
});

for (const size of [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "320 wide", width: 320, height: 568 },
  { name: "Pixel 10", width: 412, height: 924 },
]) {
  test(`phone ${size.name}: the You / Everyone switch is in the top bar and the list starts no lower than without it`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await fakeWorker(page);
    await page.setViewportSize({ width: size.width, height: size.height });
    await seededAt(page, "/?screen=stats&unlock=all", STATS);
    await waitFor(async () => ((await hasStop(page, STATS, "source:everyone")) ? true : null), "the switch", 15_000);
    await settle(page);
    const barHeight = 52;
    const back = await stopRect(page, STATS, "back");
    const you = await stopRect(page, STATS, "source:you");
    const everyone = await stopRect(page, STATS, "source:everyone");
    for (const rect of [you, everyone]) {
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(barHeight);
      expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(rect.x + rect.width).toBeLessThanOrEqual(size.width);
    }
    expect(you.x).toBeGreaterThanOrEqual(back.x + back.width);
    // Clear of the dark mode tab hanging from the top centre.
    expect(you.x).toBeGreaterThanOrEqual(size.width / 2 + 17);
    // Main's You view with no chips: bar 52 + 12, tab row 44, 12 to the list.
    const tile = (await stopKeys(page, STATS)).find((k) => k.startsWith("tile:"))!;
    const first = await stopRect(page, STATS, tile);
    expect(first.y).toBeLessThanOrEqual(barHeight + 12 + 44 + 12);
    // Share stays below the tab row.
    await press(page, STATS, "source:everyone");
    await waitFor(async () => ((await hasStop(page, STATS, "share:global")) ? true : null), "Share", 15_000);
    const tab = await stopRect(page, STATS, "tab:villains");
    const share = await stopRect(page, STATS, "share:global");
    expect(share.y).toBeGreaterThanOrEqual(tab.y + tab.height);
  });
}
