import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { activeScenes, clickText, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { answerChoice, quietGuide } from "./wave6-helpers-b.js";
import { test } from "./live-room-helpers.js";

/**
 * Civil War Competitive (issue #883, plan M8/M9; docs/live-game-rooms.md section 11): a 1v1 room started through the
 * real room server (`live-room-helpers.ts`) from two browser contexts and the dev jumps `?screen=room-competitive-host`
 * and `?screen=room-competitive-guest` (`scenes/boot-dev-jump.ts`). Each side seals a scenario for the other and readies,
 * the host's Start builds the two-team game, and both boards open with the whose-turn line naming the active side: the
 * registration side's line says it is their turn, the resistance side's says its side is inactive.
 *
 * Each player picks their own deck on their own device (the dev jumps choose a precon for their seat, as the deck picker
 * does); the host's Start judges both decks like any room's before building the two-team game.
 *
 * Written for the PR's local gate; not run by CI.
 */

async function open(browser: Browser, baseURL: string, url: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL,
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.goto(url);
  return { context, page };
}

const hasLine = async (page: Page, line: RegExp): Promise<boolean> =>
  (await visibleTexts(page)).some((t) => line.test(t.text.replace(/^[^\w]+/, "").trim()));

const waitForLine = (page: Page, line: RegExp, label: string): Promise<true> =>
  waitFor(async () => ((await hasLine(page, line)) ? true : null), label, 60000);

test("a 1v1 competitive room starts from two sealed scenarios and each board names the active side", async ({
  browser,
  baseURL,
}, info) => {
  test.skip(info.project.name !== "desktop", "two desktop contexts");
  test.setTimeout(300_000);
  const host = await open(browser, baseURL!, "/?screen=room-competitive-host&name=Mara");
  const code = await waitFor(
    async () => (await host.page.evaluate(() => (globalThis as { __mcRoomCode?: string | null }).__mcRoomCode)) ?? null,
    "the room code",
    60000,
  );
  const guest = await open(browser, baseURL!, `/?screen=room-competitive-guest&code=${code}&name=Ava`);
  try {
    await settle(host.page);

    // Registration goes first: its board says it is their turn, the other side's says its side is inactive.
    // Each leader's Setup and main scheme open with a decision for the enemy team's first player (a seat on the other
    // side): each player answers theirs as a player would, and the game starts when both are answered.
    await waitFor(
      async () => {
        for (const page of [host.page, guest.page]) {
          // A seat in a room mulligans on the Setup deal screen (d4f3ec27c), not in a ChoiceOverlay.
          if ((await visibleTexts(page)).some((t) => /^keep all/i.test(t.text))) {
            await clickText(page, "Keep all", { sceneKey: "SetupDeal" });
            return null;
          }
          if ((await activeScenes(page)).includes("ChoiceOverlay")) {
            await answerChoice(page, 0);
            return null;
          }
        }
        const guestOnBoard = (await activeScenes(guest.page)).includes("Board");
        return guestOnBoard && (await hasLine(host.page, /^Registration's hero phase: your turn/)) ? true : null;
      },
      "the registration side's turn line",
      90000,
    );
    await waitForLine(
      guest.page,
      /^Registration's hero phase: your side is inactive/,
      "the resistance side's inactive line",
    );
    // The other side's table is on the board in brief, as counts.
    expect(await hasLine(host.page, /^Resistance table: Leader:/)).toBe(true);
    expect(await hasLine(guest.page, /^Registration table: Leader:/)).toBe(true);
    // Neither board shows the other's hand or the scenario it was handed: the strip reads only counts.
    for (const page of [host.page, guest.page]) {
      const texts = (await visibleTexts(page)).map((t) => t.text);
      expect(texts.some((text) => /in hand\)/.test(text))).toBe(true);
    }
  } finally {
    await guest.context.close();
    await host.context.close();
  }
});
