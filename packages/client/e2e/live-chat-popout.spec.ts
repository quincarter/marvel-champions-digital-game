import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { waitFor } from "./helpers.js";
import { clickStop, installWave6Helpers, routeStops, visibleTexts, waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";
import { test } from "./live-room-helpers.js";
import { POPOUT_TIMEOUT_MS } from "../src/live/chat-popout-protocol.js";

/**
 * The chat's pop-out window on the web (desktop only): the host pops the lobby's floating chat out into a second window,
 * lines go both ways over the room's BroadcastChannel, Bring back closes the window, and a window that dies without a
 * goodbye is noticed by its heartbeat. The room is a real one (`live-room-helpers.ts`), the guest a second browser
 * context. `src/live/chat-popout-protocol.test.ts` covers the protocol itself; this proves the pieces are wired.
 */

const HOST_NAME = "Hosty";
const GUEST_NAME = "Guesty";

/** The suite's settings (`playwright.config.ts`) plus the "Online name", so neither player is asked for one. */
const storageFor = (baseURL: string, name: string) => ({
  cookies: [],
  origins: [
    {
      origin: baseURL,
      localStorage: [
        {
          name: "mc-settings",
          value: JSON.stringify({
            version: 1,
            villainAutoAdvance: "on",
            flipEncounterCards: false,
            holdEncounterCards: false,
            onlineName: name,
          }),
        },
      ],
    },
  ],
});

interface Player {
  readonly context: BrowserContext;
  readonly page: Page;
}

async function newPlayer(browser: Browser, baseURL: string, name: string, width: number): Promise<Player> {
  const context = await browser.newContext({
    baseURL,
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { width, height: 980 },
    storageState: storageFor(baseURL, name),
  });
  const page = await context.newPage();
  await installWave6Helpers(page);
  await quietGuide(page);
  return { context, page };
}

const hasText = async (page: Page, pattern: RegExp): Promise<true | null> =>
  (await visibleTexts(page)).some((t) => pattern.test(t.text)) ? true : null;

const hasStop = async (page: Page, key: string): Promise<true | null> =>
  (await routeStops(page, "RoomLobby"))?.stops.some((s) => s.key === key) ? true : null;

/** The host hosts a room from Play online, wide enough for the floating chat; a guest joins by its link in a narrower window. */
async function openRoom(browser: Browser, baseURL: string): Promise<{ host: Player; guest: Player; code: string }> {
  const host = await newPlayer(browser, baseURL, HOST_NAME, 1440);
  await host.page.goto("/?screen=online");
  await waitForScene(host.page, "Online", 30000);
  await clickStop(host.page, "host", "Online");
  await waitForScene(host.page, "RoomLobby", 30000);
  // The code is drawn as "ABC DEF"; the link takes it without the space.
  const shown = await waitFor(
    async () => (await visibleTexts(host.page)).find((t) => /^[A-Z0-9]{3} [A-Z0-9]{3}$/.test(t.text.trim()))?.text,
    "the room code in the host's lobby",
    30000,
  );
  const code = shown.replace(/\s/g, "");

  // 1000 wide: the guest's chat is a panel on screen all the time, no pill to press.
  const guest = await newPlayer(browser, baseURL, GUEST_NAME, 1000);
  await guest.page.goto(`/#join=${code}`);
  await waitForScene(guest.page, "RoomLobby", 30000);
  await waitFor(() => hasStop(guest.page, "chat-field"), "the guest's chat field", 30000);
  return { host, guest, code };
}

/** Types into a DOM field the way a player does: a press first, then the text and Enter. */
async function say(page: Page, text: string): Promise<void> {
  const field = page.locator("input").filter({ visible: true }).first();
  await field.click();
  await field.fill(text);
  await field.press("Enter");
}

/** Opens the host's floating chat and presses Pop out; resolves with the popup page. */
async function popOut(host: Player): Promise<Page> {
  // The chat is closed (a pill) the first time, and open again after it came back from a window: open it if it is not.
  await waitFor(
    async () => (await hasStop(host.page, "chat-pill")) ?? (await hasStop(host.page, "chat-popout")),
    "the Chat pill or the open chat",
    30000,
  );
  if (await hasStop(host.page, "chat-pill")) await clickStop(host.page, "chat-pill", "RoomLobby");
  await waitFor(() => hasStop(host.page, "chat-popout"), "the Pop out button in the open chat", 15000);
  const [popup] = await Promise.all([
    host.context.waitForEvent("page"),
    clickStop(host.page, "chat-popout", "RoomLobby"),
  ]);
  await popup.waitForLoadState("domcontentloaded");
  return popup;
}

test("the chat pops out, lines go both ways, and Bring back closes the window", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "the pop-out is desktop only");
  test.setTimeout(240_000);
  const baseURL = info.project.use.baseURL ?? "http://localhost:5173";
  const { host, guest, code } = await openRoom(browser, baseURL);

  const popup = await popOut(host);
  await expect(popup.locator("#chat header b")).toHaveText(code, { timeout: 15000 });

  // A line from the pop-out reaches the guest's lobby.
  await popup.locator("input").click();
  await expect(popup.locator("input")).toBeEnabled({ timeout: 15000 });
  await say(popup, "hello from the pop-out");
  await waitFor(
    () => hasText(guest.page, new RegExp(`${HOST_NAME}: hello from the pop-out`)),
    "the pop-out's line in the guest's chat",
    20000,
  );

  // A line from the guest shows in the pop-out.
  await say(guest.page, "hello from the guest");
  await expect(popup.locator(".line").filter({ hasText: `${GUEST_NAME}: hello from the guest` })).toBeVisible({
    timeout: 20000,
  });

  // The host's lobby says where the chat went.
  await waitFor(() => hasText(host.page, /Chat is in its own window/), "the host's lobby notice", 15000);
  expect(await hasStop(host.page, "chat-field")).toBeNull();

  // Bring back closes the window and the floating chat returns.
  const closed = popup.waitForEvent("close", { timeout: 15000 });
  await clickStop(host.page, "chat-bring-back", "RoomLobby");
  await closed;
  // The chat comes back as it was when it left: the open floating panel, with its field.
  await waitFor(() => hasStop(host.page, "chat-field"), "the chat in the lobby after Bring back", 15000);
  expect(await hasText(host.page, /Chat is in its own window/)).toBeNull();

  await host.context.close();
  await guest.context.close();
});

test("a pop-out that closes, or dies without a goodbye, gives the chat back to the lobby", async ({
  browser,
}, info) => {
  test.skip(info.project.name !== "desktop", "the pop-out is desktop only");
  test.setTimeout(240_000);
  const baseURL = info.project.use.baseURL ?? "http://localhost:5173";
  const { host, guest } = await openRoom(browser, baseURL);

  // Closed normally: the window says bye on its way out.
  const first = await popOut(host);
  await waitFor(() => hasText(host.page, /Chat is in its own window/), "the lobby notice", 15000);
  await first.close();
  await waitFor(() => hasStop(host.page, "chat-field"), "the chat in the lobby after the window closed", 10000);

  // Dies without a word: nothing it posts reaches the room (no bye, no beats), as in a crash, so only the heartbeat
  // timeout can notice. Allow the timeout plus a beat's tick and a margin.
  const second = await popOut(host);
  await waitFor(() => hasText(host.page, /Chat is in its own window/), "the lobby notice again", 15000);
  await second.evaluate(() => {
    const post = BroadcastChannel.prototype.postMessage;
    BroadcastChannel.prototype.postMessage = function (message: unknown): void {
      const kind = (message as { kind?: string } | null)?.kind;
      if (kind === "bye" || kind === "beat") return;
      post.call(this, message);
    };
  });
  await waitFor(
    () => hasStop(host.page, "chat-field"),
    "the chat back in the lobby once the heartbeat stops",
    POPOUT_TIMEOUT_MS + 12_000,
  );
  expect(await hasText(host.page, /Chat is in its own window/)).toBeNull();

  await second.close();
  await host.context.close();
  await guest.context.close();
});
