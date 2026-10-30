import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, hasText, settle, waitFor } from "./helpers.js";
import { waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import {
  fakeWorker,
  globalRequests,
  hasStop,
  isPhone,
  openSaveData,
  press,
  seedFinishedGames,
  stopRect,
  stored,
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
  await openApp(page, "unlock=all");
  await seedFinishedGames(page);
  // Answered already (the ask has its own test), so it is not over the Title.
  await page.evaluate(() => localStorage.setItem("global-stats-consent", "off"));
  await page.goto("/?unlock=all");
  await openSaveData(page);

  expect(await hasText(page, "Share anonymous game results", "SaveDataOverlay")).toBe(true);
  await waitFor(textUp(page, "Off.", "SaveDataOverlay"), "the row says Off", 10_000);
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

test("the ask: Share turns sharing on and marks the finished games sent", async ({ page }) => {
  test.setTimeout(120_000);
  await fakeWorker(page);
  await openApp(page, "unlock=all");
  await seedFinishedGames(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, PROMPT, 30_000);
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
  // The choice is kept across tabs; Overview has no Everyone.
  await press(page, STATS, "tab:overview");
  await waitFor(async () => ((await hasStop(page, STATS, "source:you")) ? null : true), "Overview", 10_000);
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
  // Still usable: another tab, and back to your own numbers.
  await press(page, STATS, "tab:heroes");
  await press(page, STATS, "source:you");
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
  await waitFor(textUp(page, "Not enough games against this villain yet.", BUILDER), "the none note", 15_000);
  expect(globalRequests(worker)).toContain("GET /global/cards?villain=Klaw");

  // Back to your own decks: the stepper, Klaw's own numbers and no request.
  const before = globalRequests(worker).length;
  await press(page, BUILDER, "games:source:yours");
  await waitFor(
    async () => ((await hasText(page, "Not enough games against", BUILDER)) ? null : true),
    "yours",
    10_000,
  );
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
