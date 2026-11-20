import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { clickText, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts, waitForScene } from "./wave6-helpers-a.js";
import { declineMulligans, quietGuide } from "./wave6-helpers-b.js";
import { test } from "./live-room-helpers.js";

/**
 * Playing together (issue #881, docs/live-game-rooms.md section 9): a host and a seated guest in one real room, played
 * from two browser contexts through the dev jumps `?screen=room-play-host` and `?screen=room-play-guest`
 * (`scenes/boot-dev-jump.ts`). The whose-turn line sits in the same place on both boards and says "Your turn" on the one
 * whose turn it is and "<Name>'s turn (<Hero>)" on the other; the guest acts from its own device and the line flips.
 * The room is the real one (`live-room-helpers.ts`). Written for the final PR of the stack, where the suite runs.
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
  (await visibleTexts(page)).some((t) => t.scene === "Board" && line.test(t.text.replace(/^[^\w]+/, "").trim()));

const waitForLine = (page: Page, line: RegExp, label: string): Promise<true> =>
  waitFor(async () => ((await hasLine(page, line)) ? true : null), label, 45000);

test("a seated guest acts from their own device and the whose-turn line follows on both boards", async ({
  browser,
  baseURL,
}, info) => {
  test.skip(info.project.name !== "desktop", "two desktop contexts");
  test.setTimeout(240_000);
  const host = await open(browser, baseURL!, "/?screen=room-play-host&name=Mara&setup=1");
  const code = await waitFor(
    async () => (await host.page.evaluate(() => (globalThis as { __mcRoomCode?: string | null }).__mcRoomCode)) ?? null,
    "the room code",
    60000,
  );
  const guest = await open(browser, baseURL!, `/?screen=room-play-guest&code=${code}&name=Ava`);
  try {
    // Setup deal: the host answers its own mulligan only. The guest's mulligan is the guest's: the host's setup screen
    // shows no controls for it and says who it waits for (the store refuses a host answer for that hero too).
    await waitForScene(host.page, "SetupDeal", 60000);
    await waitForScene(guest.page, "Board", 60000);
    await waitForLine(guest.page, /^Waiting for Mara \(Spider-Man\)/, "the guest waiting for the host");
    await clickText(host.page, /^Keep all/, { sceneKey: "SetupDeal" });
    await waitFor(
      async () =>
        (await visibleTexts(host.page)).some((t) => /^Waiting for Ava \(Captain Marvel\)/.test(t.text)) ? true : null,
      "the host waiting for the guest's mulligan",
      45000,
    );
    expect((await visibleTexts(host.page)).some((t) => /^(Keep all|Mulligan)/.test(t.text))).toBe(false);
    await waitForLine(guest.page, /^Your choice/, "the guest's own mulligan");
    await declineMulligans(guest.page);
    await waitForScene(host.page, "Board", 60000);
    // The host's turn.
    await waitForLine(host.page, /^Your turn/, "the host's turn");
    await waitForLine(guest.page, /^Mara's turn \(Spider-Man\)/, "the guest seeing whose turn it is");
    // Not the guest's hero: no Undo, not even a request, until its own turn.
    expect((await visibleTexts(guest.page)).some((t) => /ask host to undo/i.test(t.text))).toBe(false);
    await clickText(host.page, "End turn", { sceneKey: "Board" });
    await settle(host.page);
    // The guest's turn, played from the guest's own device.
    await waitForLine(guest.page, /^Your turn/, "the guest's turn");
    await waitForLine(host.page, /^Ava's turn \(Captain Marvel\)/, "the host seeing the guest's turn");
    // Its own hero: Undo is a request to the host, not a rewind.
    expect((await visibleTexts(guest.page)).some((t) => /ask host to undo/i.test(t.text))).toBe(true);
    await clickText(guest.page, "End turn", { sceneKey: "Board" });
    await settle(guest.page);
    // The proposal reached the host's engine and came back: the turn passed on both boards.
    await waitForLine(host.page, /^Your turn/, "the turn back with the host");
    await waitForLine(guest.page, /^Mara's turn \(Spider-Man\)/, "the guest seeing it back with the host");
  } finally {
    await guest.context.close();
    await host.context.close();
  }
});
