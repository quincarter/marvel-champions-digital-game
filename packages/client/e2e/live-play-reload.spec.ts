import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { clickText, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts, waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";
import { test } from "./live-room-helpers.js";

/**
 * Reloading in the middle of a room's game: the address keeps `?room=<CODE>`, so the host (whose game is a local save
 * with the room attached) and a seated guest (whose seat game lives in its own worker) each refresh, come back to the
 * board on their own seat, and a move after the reload still works. The room is the real one (`live-room-helpers.ts`),
 * the two players two browser contexts started through the dev jumps of `live-play.spec.ts`. A dev jump wins over the
 * link on a reload, so its `?screen=` and friends are taken out of the address first, as a player's address has none.
 */

const HOST_NAME = "Mara";
const GUEST_NAME = "Ava";

async function open(
  browser: Browser,
  baseURL: string,
  url: string,
  name: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL,
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await installWave6Helpers(page);
  await quietGuide(page);
  // The online name is set, so a reload's rejoin is never asked for one.
  await page.addInitScript(
    (online) =>
      localStorage.setItem(
        "mc-settings",
        JSON.stringify({
          version: 1,
          villainAutoAdvance: "on",
          flipEncounterCards: false,
          holdEncounterCards: false,
          onlineName: online,
        }),
      ),
    name,
  );
  await page.goto(url);
  return { context, page };
}

const hasLine = async (page: Page, line: RegExp): Promise<boolean> =>
  (await visibleTexts(page)).some((t) => t.scene === "Board" && line.test(t.text.replace(/^[^\w]+/, "").trim()));

const waitForLine = (page: Page, line: RegExp, label: string): Promise<true> =>
  waitFor(async () => ((await hasLine(page, line)) ? true : null), label, 45000);

const roomParam = (page: Page): Promise<string | null> =>
  page.evaluate(() => new URLSearchParams(location.search).get("room"));

/** What a player's address looks like: the dev jump's parameters gone, the room's kept. */
async function dropDevJump(page: Page): Promise<void> {
  await page.evaluate(() => {
    const params = new URLSearchParams(location.search);
    for (const key of ["screen", "name", "setup", "code"]) params.delete(key);
    history.replaceState(null, "", `${location.pathname}?${params}`);
  });
}

test("host and guest each reload mid-game, come back on their seat, and play on", async ({
  browser,
  baseURL,
}, info) => {
  test.skip(info.project.name !== "desktop", "two desktop contexts");
  test.setTimeout(300_000);
  const host = await open(browser, baseURL!, `/?screen=room-play-host&name=${HOST_NAME}&setup=1`, HOST_NAME);
  const code = await waitFor(
    async () => (await host.page.evaluate(() => (globalThis as { __mcRoomCode?: string | null }).__mcRoomCode)) ?? null,
    "the room code",
    60000,
  );
  const guest = await open(browser, baseURL!, `/?screen=room-play-guest&code=${code}&name=${GUEST_NAME}`, GUEST_NAME);
  try {
    await waitForScene(host.page, "SetupDeal", 60000);
    await waitForScene(guest.page, "SetupDeal", 60000);
    await clickText(host.page, "Keep all", { sceneKey: "SetupDeal" });
    await clickText(guest.page, "Keep all", { sceneKey: "SetupDeal", timeoutMs: 45000 });
    await waitForScene(guest.page, "Board", 60000);
    await waitForScene(host.page, "Board", 60000);
    await waitForLine(host.page, /^Your turn/, "the host's turn");
    await waitForLine(
      guest.page,
      new RegExp(`^${HOST_NAME}'s turn \\(Spider-Man\\)`),
      "the guest seeing the host's turn",
    );

    // Both addresses carry the room.
    await waitFor(async () => ((await roomParam(host.page)) === code ? true : null), "?room= on the host", 15000);
    await waitFor(async () => ((await roomParam(guest.page)) === code ? true : null), "?room= on the guest", 15000);

    // The host refreshes: straight back to its board and its turn (no Title, no Continue), the room unchanged, and the
    // guest's board is still there, showing the host's turn.
    await dropDevJump(host.page);
    await host.page.reload();
    await waitForScene(host.page, "Board", 90000);
    await waitForLine(host.page, /^Your turn/, "the host's turn after its reload");
    expect(await roomParam(host.page)).toBe(code);
    expect(await hasLine(guest.page, new RegExp(`^${HOST_NAME}'s turn`))).toBe(true);
    // A move after the reload goes through to the guest.
    await clickText(host.page, "End turn", { sceneKey: "Board" });
    await settle(host.page);
    await waitForLine(guest.page, /^Your turn/, "the guest's turn after the host's move");

    // The guest refreshes: back on its seat, at the same turn, and its move reaches the host.
    await dropDevJump(guest.page);
    await guest.page.reload();
    await waitForScene(guest.page, "Board", 90000);
    await waitForLine(guest.page, /^Your turn/, "the guest's turn after its reload");
    expect(await roomParam(guest.page)).toBe(code);
    await clickText(guest.page, "End turn", { sceneKey: "Board" });
    await settle(guest.page);
    await clickText(host.page, "Decline", { sceneKey: "ChoiceOverlay", timeoutMs: 45000 });
    await clickText(guest.page, "Decline", { sceneKey: "ChoiceOverlay", timeoutMs: 45000 });
    await waitForLine(guest.page, /^Your turn/, "round 2 on the guest's turn");
    await waitForLine(host.page, new RegExp(`^${GUEST_NAME}'s turn \\(Captain Marvel\\)`), "the host seeing round 2");
  } finally {
    await guest.context.close();
    await host.context.close();
  }
});
