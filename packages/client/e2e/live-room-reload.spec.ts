import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { waitFor } from "./helpers.js";
import { clickStop, installWave6Helpers, routeStops, visibleTexts, waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";
import { test } from "./live-room-helpers.js";

/**
 * Reloading inside a room (the address keeps `?room=<CODE>`): a host or a guest who refreshes, on purpose or by accident,
 * comes back to the same lobby and the same seat without being asked anything. The room is a real one
 * (`live-room-helpers.ts`), the guest a second browser context. Unit tests: `platform/room-address.test.ts`,
 * `platform/room-entry-address.test.ts`, `live/room-controller.test.ts`.
 */

const HOST_NAME = "Hosty";
const GUEST_NAME = "Guesty";

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

async function newPlayer(browser: Browser, baseURL: string, name: string): Promise<Player> {
  const context = await browser.newContext({
    baseURL,
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { width: 1200, height: 900 },
    storageState: storageFor(baseURL, name),
  });
  const page = await context.newPage();
  await installWave6Helpers(page);
  await quietGuide(page);
  return { context, page };
}

const hasText = async (page: Page, pattern: RegExp): Promise<true | null> =>
  (await visibleTexts(page)).some((t) => pattern.test(t.text)) ? true : null;

/** The room in the address: the value of ?room=, or an empty string. */
const roomHash = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const code = new URLSearchParams(location.search).get("room");
    return code ? `?room=${code}` : "";
  });

/** The code the lobby shows ("ABC DEF"), without its space. */
async function lobbyCode(page: Page): Promise<string> {
  const shown = await waitFor(
    async () => (await visibleTexts(page)).find((t) => /^[A-Z0-9]{3} [A-Z0-9]{3}$/.test(t.text.trim()))?.text,
    "the room code in the lobby",
    30000,
  );
  return shown.replace(/\s/g, "");
}

const seatStops = async (page: Page): Promise<string[]> =>
  (await routeStops(page, "RoomLobby"))?.stops.map((s) => s.key) ?? [];

test("a host who reloads in the lobby is back in the same room as its host", async ({ browser, room }, info) => {
  test.setTimeout(180_000);
  const baseURL = info.project.use.baseURL ?? "http://localhost:5173";
  const host = await newPlayer(browser, baseURL, HOST_NAME);
  await host.page.goto("/?screen=online");
  await waitForScene(host.page, "Online", 30000);
  await clickStop(host.page, "host", "Online");
  await waitForScene(host.page, "RoomLobby", 30000);
  const code = await lobbyCode(host.page);
  await waitFor(
    async () => ((await roomHash(host.page)) === `?room=${code}` ? true : null),
    "?room= in the address",
    15000,
  );

  // A guest joins by the room's link; its address carries the room too.
  const guest = await newPlayer(browser, baseURL, GUEST_NAME);
  await guest.page.goto(`/#join=${code}`);
  await waitForScene(guest.page, "RoomLobby", 30000);
  await waitFor(
    async () => ((await roomHash(guest.page)) === `?room=${code}` ? true : null),
    "the guest's ?room=",
    15000,
  );
  await waitFor(() => hasText(host.page, new RegExp(GUEST_NAME)), "the guest in the host's lobby", 30000);

  // The host refreshes: straight back to the same lobby, as the host, in the same room (no second room made).
  const creates = room.creates();
  await host.page.reload();
  await waitForScene(host.page, "RoomLobby", 30000);
  expect(await lobbyCode(host.page)).toBe(code);
  expect(await roomHash(host.page)).toBe(`?room=${code}`);
  expect(room.creates()).toBe(creates);
  // Still the host: the host-only controls are there, and the guest still sees it.
  await waitFor(
    async () => ((await seatStops(host.page)).length > 0 ? true : null),
    "the host's lobby controls",
    15000,
  );
  await waitFor(() => hasText(host.page, new RegExp(GUEST_NAME)), "the guest in the reloaded lobby", 30000);

  // The guest refreshes: same lobby, still in the room.
  await guest.page.reload();
  await waitForScene(guest.page, "RoomLobby", 30000);
  expect(await roomHash(guest.page)).toBe(`?room=${code}`);
  await waitFor(() => hasText(guest.page, new RegExp(HOST_NAME)), "the host in the reloaded guest's lobby", 30000);
  await waitFor(() => hasText(host.page, new RegExp(GUEST_NAME)), "the host still sees one guest", 30000);

  await host.context.close();
  await guest.context.close();
});

test("a guest keeps its seat across a reload, and a room that is gone sends it to Play online", async ({
  browser,
  room,
}, info) => {
  test.setTimeout(180_000);
  const baseURL = info.project.use.baseURL ?? "http://localhost:5173";
  const host = await newPlayer(browser, baseURL, HOST_NAME);
  await host.page.goto("/?screen=online");
  await waitForScene(host.page, "Online", 30000);
  await clickStop(host.page, "host", "Online");
  await waitForScene(host.page, "RoomLobby", 30000);
  const code = await lobbyCode(host.page);

  const guest = await newPlayer(browser, baseURL, GUEST_NAME);
  await guest.page.goto(`/#join=${code}`);
  await waitForScene(guest.page, "RoomLobby", 30000);
  const seat = await waitFor(
    async () => (await seatStops(guest.page)).find((k) => k.startsWith("seat")),
    "a seat in the guest's lobby",
    30000,
  );
  await clickStop(guest.page, seat, "RoomLobby");
  await waitFor(
    () => hasText(host.page, new RegExp(`${GUEST_NAME}`)),
    "the guest's seat request in the host's lobby",
    30000,
  );

  await guest.page.reload();
  await waitForScene(guest.page, "RoomLobby", 30000);
  expect(await roomHash(guest.page)).toBe(`?room=${code}`);
  await waitFor(
    () => hasText(host.page, new RegExp(GUEST_NAME)),
    "the guest still in the room after its reload",
    30000,
  );

  // The room closes; the guest's next reload finds it gone: Play online, the address cleaned.
  await room.room()?.shutdown("ended");
  await guest.page.reload();
  await waitForScene(guest.page, "Online", 30000);
  await waitFor(async () => ((await roomHash(guest.page)) === "" ? true : null), "?room= cleared", 15000);

  await host.context.close();
  await guest.context.close();
});
