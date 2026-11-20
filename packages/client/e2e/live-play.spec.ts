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
  const host = await open(browser, baseURL!, "/?screen=room-play-host&name=Mara");
  const code = await waitFor(
    async () => (await host.page.evaluate(() => (globalThis as { __mcRoomCode?: string | null }).__mcRoomCode)) ?? null,
    "the room code",
    60000,
  );
  const guest = await open(browser, baseURL!, `/?screen=room-play-guest&code=${code}&name=Ava`);
  try {
    await waitForScene(host.page, "Board", 60000);
    await waitForScene(guest.page, "Board", 60000);
    // The mulligan is each hero's own choice: the host's first, then the guest's, each named on both boards.
    await waitForLine(host.page, /^Your choice/, "the host's own mulligan");
    await waitForLine(guest.page, /^Waiting for Mara \(Spider-Man\)/, "the guest waiting for the host");
    await declineMulligans(host.page);
    await waitForLine(guest.page, /^Your choice/, "the guest's own mulligan");
    await waitForLine(host.page, /^Waiting for Ava \(Captain Marvel\)/, "the host waiting for the guest");
    await declineMulligans(guest.page);
    // The host's turn.
    await waitForLine(host.page, /^Your turn/, "the host's turn");
    await waitForLine(guest.page, /^Mara's turn \(Spider-Man\)/, "the guest seeing whose turn it is");
    // The guest has no actions while it is the host's turn: Undo asks the host instead of rewinding.
    expect((await visibleTexts(guest.page)).some((t) => /ask host to undo/i.test(t.text))).toBe(true);
    await clickText(host.page, "End turn", { sceneKey: "Board" });
    await settle(host.page);
    // The guest's turn, played from the guest's own device.
    await waitForLine(guest.page, /^Your turn/, "the guest's turn");
    await waitForLine(host.page, /^Ava's turn \(Captain Marvel\)/, "the host seeing the guest's turn");
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
