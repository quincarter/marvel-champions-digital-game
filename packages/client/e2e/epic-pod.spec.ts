import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { test } from "./live-room-helpers.js";
import { waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts, waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";

/**
 * Epic Multiplayer screens (issue #882, docs/live-game-rooms.md section 10) over the dev fixtures
 * (`view/epic-room-fixture.ts`; `?screen=room-lobby&epic=organizer|player`, `?screen=board&fixture=epic`). Written for the
 * final PR of the stack, where the suite runs; not run in this one. A 2-table pod started through the real room server
 * (`live-room-helpers.ts`) needs two table hosts' dev jumps, which come with the netcode e2e; the connection side has its
 * own two-socket tests (`live/epic-room.test.ts`, `live/epic-pod.test.ts`).
 */

test("the organizer's lobby shows each table, its host and why Start is off", async ({ page }) => {
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.goto("/?screen=room-lobby&epic=organizer");
  await waitForScene(page, "RoomLobby", 30000);
  const texts = async (): Promise<string[]> => (await visibleTexts(page)).map((t) => t.text);
  await waitFor(async () => ((await texts()).includes("North Table") ? true : null), "the first table", 20000);
  const seen = await texts();
  expect(seen).toContain("Host: Ava");
  expect(seen.some((t) => /2 seats are still open/.test(t))).toBe(true);
});

test("a table's board carries the pod strip with Loki, Worlds Collide, the tables and the clock", async ({ page }) => {
  await installWave6Helpers(page);
  await quietGuide(page);
  await page.goto("/?screen=board&fixture=epic&mangog=1");
  await waitForScene(page, "Board", 30000);
  await waitFor(
    async () => ((await visibleTexts(page)).some((t) => t.text.startsWith("Loki, God of Lies")) ? true : null),
    "the pod strip",
    20000,
  );
  const lines = (await visibleTexts(page)).map((t) => t.text);
  expect(lines.some((t) => /Worlds Collide 3\/6/.test(t))).toBe(true);
  expect(lines.some((t) => /South Table · R4 · villain phase/.test(t))).toBe(true);
  expect(lines.some((t) => /Your pod can reach: The Mangog/.test(t))).toBe(true);
});

/**
 * A real two-host pod (issue #882): two browser contexts, one host per table, through the dev jumps `room-epic-host`
 * (`scenes/boot-dev-jump.ts`) and the real room server (`live-room-helpers.ts`). Damage to Loki dealt from t1 reaches t2's
 * pod strip through the coordinator on the organizer's device; a third context watches a table and switches to the other
 * in place. Written for the final PR of the stack, where the suite runs; not run in this one.
 */
async function openContext(
  browser: Browser,
  baseURL: string,
  url: string,
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
  await page.goto(url);
  return { context, page };
}

const lokiLine = async (page: Page): Promise<string | null> =>
  (await visibleTexts(page)).map((t) => t.text).find((t) => /^Loki, God of Lies \d+\/\d+ HP/.test(t)) ?? null;
const lokiLeft = (line: string | null): number | null => {
  const m = line ? /(\d+)\/(\d+) HP/.exec(line) : null;
  return m ? Number(m[1]) : null;
};
const roomEval = <T>(page: Page, expr: string): Promise<T> =>
  page.evaluate(`(() => { const s = globalThis.__mcRoomState(); return ${expr}; })()`) as Promise<T>;

test("two table hosts start a pod, Loki's damage on t1 shows on t2's strip, and a watcher switches tables", async ({
  browser,
  baseURL,
}, info) => {
  test.skip(info.project.name !== "desktop", "three desktop contexts");
  test.setTimeout(300_000);
  const north = await openContext(browser, baseURL!, "/?screen=room-epic-host&table=t1&name=Olga");
  const code = await waitFor(
    async () =>
      (await north.page.evaluate(() => (globalThis as { __mcRoomCode?: string | null }).__mcRoomCode)) ?? null,
    "the room code",
    60000,
  );
  const south = await openContext(browser, baseURL!, `/?screen=room-epic-host&table=t2&code=${code}&name=Theo`);
  let watcher: { context: BrowserContext; page: Page } | null = null;
  try {
    // Each host lands on its own group's board, with the pod strip.
    await waitForScene(north.page, "Board", 120000);
    await waitForScene(south.page, "Board", 120000);
    for (const page of [north.page, south.page]) {
      await waitFor(async () => ((await lokiLine(page)) ? true : null), "the pod strip", 60000);
    }
    expect(await roomEval<string | null>(north.page, "s.epic && s.epic.hostsTable")).toBe("t1");
    expect(await roomEval<string | null>(south.page, "s.epic && s.epic.hostsTable")).toBe("t2");
    const before = lokiLeft(await lokiLine(south.page));
    expect(before).not.toBeNull();

    // Damage to Loki from t1 goes through the organizer's coordinator and shows on t2's strip.
    await north.page.evaluate(() =>
      (globalThis as unknown as { __mcEpicDamageLoki(n: number): void }).__mcEpicDamageLoki(9),
    );
    await waitFor(
      async () => {
        const left = lokiLeft(await lokiLine(south.page));
        return left !== null && left === (before as number) - 9 ? true : null;
      },
      "t2's strip showing Loki's damage",
      60000,
    );
    expect(lokiLeft(await lokiLine(north.page))).toBe((before as number) - 9);

    // A watcher follows t1, then switches to t2 without leaving the room.
    watcher = await openContext(browser, baseURL!, `/?screen=room-epic-watch&code=${code}&table=t1&name=Wes`);
    await waitForScene(watcher.page, "Board", 120000);
    expect(await watcher.page.evaluate(() => (globalThis as { __mcWatching?: string }).__mcWatching)).toBe("t1");
    expect(await roomEval<unknown>(watcher.page, "s.epic && s.epic.following")).toEqual(["t1"]);
    const switched = await watcher.page.evaluate(() =>
      (globalThis as unknown as { __mcWatchTable(id: string): Promise<boolean> }).__mcWatchTable("t2"),
    );
    expect(switched).toBe(true);
    expect(await watcher.page.evaluate(() => (globalThis as { __mcWatching?: string }).__mcWatching)).toBe("t2");
    expect(await roomEval<unknown>(watcher.page, "s.epic && s.epic.following")).toEqual(["t2"]);
    expect(await roomEval<string>(watcher.page, "s.connection")).toBe("connected");
  } finally {
    await watcher?.context.close();
    await south.context.close();
    await north.context.close();
  }
});
