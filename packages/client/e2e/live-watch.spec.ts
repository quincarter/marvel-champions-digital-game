import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { activeScenes, clickText, pressAt, settle, waitFor, waitForText } from "./helpers.js";
import {
  boardRound,
  endTurnToNextRound,
  installWave6Helpers,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";
import { dealToFirstTurn, declineMulligans, quietGuide } from "./wave6-helpers-b.js";
import { ROOM_PORT, test, type RoomServer } from "./live-room-helpers.js";

/**
 * Watching a live game from its link (issue #876): `#watch=<roomId>` joins the room, rebuilds the game from the log the
 * room sends, follows each new command, labels the log line LIVE (or HOST AWAY), and "Go live" returns to the newest
 * move after stepping back. The room is a real one (`live-room-helpers.ts`) and the host is a real game played in a
 * second browser context, so the log a watcher gets is what a host really streams.
 */

interface HostGame {
  readonly context: BrowserContext;
  readonly page: Page;
}

/** Plays a watchable dev game's mulligans in its own context (own saves), so the room exists and holds commands. */
async function startHost(browser: Browser, baseURL: string, room: RoomServer): Promise<HostGame> {
  const context = await browser.newContext({
    baseURL,
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.goto("/?screen=board&scenario=rhino&deck=drs-protection&seed=3&watch=1");
  await waitForScene(page, "Board", 30000);
  await declineMulligans(page);
  await waitFor(
    async () => ((room.room()?.logLength() ?? 0) > 0 ? true : null),
    "the room holds the first commands",
    30000,
  );
  return { context, page };
}

const hasWord = async (page: Page, word: RegExp): Promise<boolean> =>
  (await visibleTexts(page)).some((t) => word.test(t.text.trim()));

async function openWatch(page: Page, hash: string): Promise<void> {
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.goto(`/?unlock=all#watch=${hash}`);
}

/** The game's versus screen may hold the board back; a press ends it. Returns when the board is up. */
async function reachBoard(page: Page): Promise<void> {
  await waitFor(
    async () => {
      const scenes = await activeScenes(page);
      if (scenes.includes("Board") && scenes.includes("ReplayTransportOverlay")) return true;
      if (scenes.includes("ReplayVersus")) await page.keyboard.press("Space");
      return null;
    },
    "the watched board",
    45000,
  );
  await settle(page);
}

/** The marker's words (with their dot) sit inside the log line's box, so a narrow bar does not cut them. */
async function markerFits(page: Page, word: RegExp): Promise<void> {
  const ticker = await page.evaluate(
    () =>
      (window as unknown as { __mcBoardDebug?: { logTickerRect: () => Box | null } }).__mcBoardDebug?.logTickerRect() ??
      null,
  );
  expect(ticker, "the log line is drawn").not.toBeNull();
  const text = (await visibleTexts(page)).find((t) => word.test(t.text.trim()));
  expect(text, "the marker is drawn").toBeTruthy();
  expect(text!.x - text!.w / 2, "starts inside the log line").toBeGreaterThanOrEqual(ticker!.x);
  expect(text!.x + text!.w / 2, "ends inside the log line").toBeLessThanOrEqual(ticker!.x + ticker!.width);
}

type Box = { x: number; y: number; width: number; height: number };

const position = (page: Page): Promise<number | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcReplayDebug?: { state: () => { position: number } } }).__mcReplayDebug?.state()
        .position ?? null,
  );
const transportRect = (page: Page, id: string): Promise<Box | null> =>
  page.evaluate(
    (control) =>
      (window as unknown as { __mcReplayDebug?: { rect: (id: string) => Box | null } }).__mcReplayDebug?.rect(
        control,
      ) ?? null,
    id,
  );

async function pressTransport(page: Page, id: string): Promise<void> {
  const rect = await waitFor(() => transportRect(page, id), `the ${id} control`, 15000);
  await settle(page, { quietMs: 150, maxMs: 500 });
  const now = (await transportRect(page, id)) ?? rect;
  await pressAt(page, now.x + now.width / 2, now.y + now.height / 2);
}

const positionIs = (page: Page, n: () => number) => async (): Promise<true | null> =>
  (await position(page)) === n() ? true : null;

test("the board follows the host, the log reads LIVE, and Go live returns to the newest move", async ({
  page,
  browser,
  baseURL,
  room,
}) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  const host = await startHost(browser, baseURL!, room);
  try {
    const live = room.room()!;
    await openWatch(page, live.id);
    await reachBoard(page);

    // A watcher is a plain member of the room: hello without a token, and nothing else goes out.
    const mine = room.sent.filter((m) => !m.host);
    expect(mine.map((m) => m.kind)).toEqual(["hello"]);
    expect(mine[0]).not.toHaveProperty("token");

    await waitFor(async () => ((await hasWord(page, /^LIVE$/)) ? true : null), "the LIVE label", 15000);
    expect(await hasWord(page, /^LOG$/)).toBe(false);
    await markerFits(page, /^LIVE$/);
    await waitFor(
      positionIs(page, () => live.logLength()),
      "at the host's newest move",
      20000,
    );

    // The host plays on (a whole round): the board follows to the newest move.
    const held = live.logLength();
    await dealToFirstTurn(host.page);
    await endTurnToNextRound(host.page, (await boardRound(host.page)) ?? 1);
    await waitFor(async () => (live.logLength() > held ? true : null), "the host's later commands", 30000);
    await waitFor(
      positionIs(page, () => live.logLength()),
      "following the newest move",
      30000,
    );
    expect(live.logLength()).toBeGreaterThan(held);

    // Stepping back leaves the newest move; Go live comes back to it, and the label still says LIVE.
    const newest = live.logLength();
    await pressTransport(page, "back");
    await waitFor(
      positionIs(page, () => newest - 1),
      "one step back",
      15000,
    );
    expect(await hasWord(page, /go live/i)).toBe(true);
    await pressTransport(page, "live");
    await waitFor(
      positionIs(page, () => newest),
      "back at the newest move",
      15000,
    );
    expect(await hasWord(page, /^LIVE$/)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await host.context.close();
  }
});

test("HOST AWAY shows when the host leaves the room, and a closed room ends the marker", async ({
  page,
  browser,
  baseURL,
  room,
}) => {
  test.setTimeout(200_000);
  const errors = trackErrors(page);
  const host = await startHost(browser, baseURL!, room);
  const live = room.room()!;
  try {
    await openWatch(page, live.id);
    await reachBoard(page);
    await waitFor(async () => ((await hasWord(page, /^LIVE$/)) ? true : null), "the LIVE label", 15000);

    // The host closes the game: the room says its host is gone.
    await host.context.close();
    await waitFor(async () => ((await hasWord(page, /^HOST AWAY$/)) ? true : null), "HOST AWAY", 20000);
    expect(await hasWord(page, /^LIVE$/)).toBe(false);
    await markerFits(page, /^HOST AWAY$/);

    // The room closes: no more moves come, so the marker goes and the game stays as a replay.
    await live.shutdown("ended");
    await waitFor(async () => (!(await hasWord(page, /^HOST AWAY$/)) ? true : null), "the marker gone", 15000);
    expect(await hasWord(page, /^LIVE$/)).toBe(false);
    expect(await activeScenes(page)).toContain("ReplayTransportOverlay");
    expect(errors).toEqual([]);
  } finally {
    await host.context.close().catch(() => undefined);
  }
});

test("a room that is gone says the link is not open any more", async ({ page, room }) => {
  test.setTimeout(120_000);
  await openWatch(page, "AbCdEfGhIjKl");
  await waitForText(page, "isn't open any more", { timeoutMs: 60000 });
  expect(await activeScenes(page)).not.toContain("Board");
  expect(room.sockets()).toBeGreaterThan(0);
});

test.describe("a room of one", () => {
  // The fixture's server holds the dev sync port for every test, so this one asks it for a room of one.
  test.use({ roomOptions: { maxParticipants: 1 } });

  test("a full room says so", async ({ page, room }) => {
    test.setTimeout(120_000);
    const created = await fetch(`http://localhost:${ROOM_PORT}/room`, { method: "POST", body: "{}" });
    const { roomId } = (await created.json()) as { roomId: string };
    await room.joinWatcher(roomId);
    await openWatch(page, roomId);
    await waitForText(page, "as many watchers as it allows", { timeoutMs: 60000 });
  });
});

/** A browser context of its own (own saves) on the suite's settings: the villain phase advances by itself. */
async function newPlayer(browser: Browser, baseURL: string, url: string): Promise<HostGame> {
  const context = await browser.newContext({
    baseURL,
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "on", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  await page.goto(url);
  return { context, page };
}

/** A watch link's own socket: it asks for `watch` alone (a room's guests ask for chat and seats too). */
const watchLinkHello = (room: RoomServer) =>
  room.sent.find((m) => !m.host && m.kind === "hello" && JSON.stringify(m.caps) === JSON.stringify(["watch"]));

test("a room game's watch link opens the game and follows it, for a viewer with no online name (#1021)", async ({
  page,
  browser,
  baseURL,
  room,
}, info) => {
  test.skip(info.project.name !== "desktop", "two host-side desktop contexts and a watcher");
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  // A real room game (`scenes/boot-dev-jump.ts`): the host makes a lobby room, seats a guest and starts the game.
  const host = await newPlayer(browser, baseURL!, "/?screen=room-play-host&name=Mara");
  let guest: HostGame | null = null;
  try {
    const code = await waitFor(
      async () =>
        (await host.page.evaluate(() => (globalThis as { __mcRoomCode?: string | null }).__mcRoomCode)) ?? null,
      "the room code",
      60000,
    );
    guest = await newPlayer(browser, baseURL!, `/?screen=room-play-guest&code=${code}&name=Ava`);
    await waitForScene(host.page, "Board", 90000);
    const live = room.room()!;
    await waitFor(async () => (live.logLength() > 0 ? true : null), "the room holds the game", 30000);
    // The link the host's game shares (the Discord Watch live button's), as the host's own status says it.
    const url = await waitFor(
      () =>
        host.page.evaluate(async () => {
          const mod = (await import("/src/platform/live-watch.ts")) as unknown as {
            liveStatus: () => { watchUrl: string | null };
          };
          return mod.liveStatus().watchUrl;
        }),
      "the host's watch link",
      30000,
    );
    expect(url).toContain(`#watch=${live.id}`);

    await installWave6Helpers(page);
    await quietGuide(page);
    await page.goto(`/?unlock=all${url.slice(url.indexOf("#"))}`);
    await reachBoard(page);
    // What builds up to 1.0.0 always sent: no name. The room lets it watch, under a stand-in name.
    expect(watchLinkHello(room)).not.toHaveProperty("name");
    expect(await hasWord(page, /isn't open any more/i)).toBe(false);
    await waitFor(async () => ((await hasWord(page, /^LIVE$/)) ? true : null), "the LIVE label", 15000);
    await waitFor(
      positionIs(page, () => live.logLength()),
      "at the host's newest move",
      30000,
    );

    // The host plays on: the watcher follows to the newest move.
    const held = live.logLength();
    await clickText(host.page, "End turn", { sceneKey: "Board", timeoutMs: 45000 });
    await waitFor(async () => (live.logLength() > held ? true : null), "the host's next move", 30000);
    await waitFor(
      positionIs(page, () => live.logLength()),
      "following the newest move",
      30000,
    );
    expect(errors).toEqual([]);
  } finally {
    await guest?.context.close();
    await host.context.close();
  }
});

test("a viewer's watch link says their online name (#1021)", async ({ page, room }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() =>
    localStorage.setItem("mc-settings", JSON.stringify({ version: 1, onlineName: "Gareth" })),
  );
  const created = await fetch(`http://localhost:${ROOM_PORT}/room`, { method: "POST", body: "{}" });
  const { roomId } = (await created.json()) as { roomId: string };
  await openWatch(page, roomId);
  const hello = await waitFor(async () => watchLinkHello(room) ?? null, "the watcher's hello", 60000);
  expect(hello.name).toBe("Gareth");
});

test("a link that names no room says it isn't valid", async ({ page, room }) => {
  test.setTimeout(120_000);
  await openWatch(page, "bad!");
  await waitForText(page, "isn't valid", { timeoutMs: 60000 });
  expect(room.sockets()).toBe(0);
});
