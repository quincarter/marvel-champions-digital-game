import { expect, test, type Page } from "@playwright/test";
import { pressKey, trackPageErrors } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The four small room scenes (the game mode picker, "Give <hero> to...", "Rejoining room...", and the generic notice
 * such as "Room closed" / "Only one option") are Lit panels over the canvas. Each shows its panel, the keyboard walks
 * its own stops with the DOM focus ring, and Escape backs out. Launched over Pause, which has no room.
 */

const MODE = "RoomModePickerOverlay";
const GIVE = "RoomGiveOverlay";
const REJOIN = "RejoinOverlay";
const NOTICE = "OptionNoticeOverlay";

const sheet = (page: Page, scene: string) => page.locator(`#mc-ui [data-scene="${scene}"] mc-sheet`);

const focusOf = (page: Page, scene: string) =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null }> }).__mcFocusState[key]!()
        .focus,
    scene,
  );

/** Presses `key` until the scene's ring is on `stop` (at most `tries` presses). */
async function walkTo(page: Page, scene: string, stop: string, key = "ArrowRight", tries = 8): Promise<void> {
  for (let i = 0; i < tries && (await focusOf(page, scene)) !== stop; i++) await pressKey(page, key);
  expect(await focusOf(page, scene)).toBe(stop);
}

/** Launches `scene` over Pause with `data` (functions in `data` are given by name from `window.__room`). */
async function launch(page: Page, scene: string, data: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    ([key, payload]) => {
      const w = window as unknown as {
        __mcGame: { scene: { getScene(k: string): { scene: { launch(k: string, d: unknown): void } } } };
        __room: Record<string, unknown>;
      };
      w.__room = { calls: [] as string[] };
      const calls = w.__room.calls as string[];
      const given = payload as Record<string, unknown>;
      const resolved: Record<string, unknown> = {};
      for (const [name, value] of Object.entries(given)) {
        resolved[name] = value === "$fn" ? (...args: unknown[]) => calls.push(`${name}:${args.join(",")}`) : value;
      }
      w.__mcGame.scene.getScene("PauseOverlay").scene.launch(key as string, resolved);
    },
    [scene, data] as const,
  );
}

const calls = (page: Page) => page.evaluate(() => (window as unknown as { __room: { calls: string[] } }).__room.calls);

test.beforeEach(async ({ page }) => {
  await openApp(page, "screen=pause", { landing: "PauseOverlay" });
});

test("the game mode picker is a panel: three boxes, the info follows the ring, Enter picks, Play hands it back", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  await launch(page, MODE, { current: "standard", onChoose: "$fn" });
  const panel = sheet(page, MODE);
  await expect(panel).toBeVisible();
  for (const mode of ["standard", "epic", "competitive"]) {
    await expect(panel.locator(`[data-key="mode:${mode}"]`)).toBeVisible();
  }
  await expect(panel.locator('mc-button[data-key="play"]')).toHaveAttribute("disabled", "");

  // The ring on the Epic box shows its info; Enter picks it, which turns Play on.
  await walkTo(page, MODE, "mode:epic");
  await expect(page.locator("#mc-ui .mc-focus-ring").last()).toBeVisible();
  await expect(panel).toContainText("Many tables. One Loki.");
  await pressKey(page, "Enter");
  await expect(panel.locator('mc-button[data-key="play"]')).not.toHaveAttribute("disabled", "");
  await walkTo(page, MODE, "play", "ArrowRight", 12);
  await pressKey(page, "Enter");
  await expect(panel).toHaveCount(0, { timeout: 10000 });
  expect(await calls(page)).toEqual(["onChoose:epic"]);
  expect(errors).toEqual([]);
});

test("the game mode picker: a mouse over a box shows its info first, and Escape closes it", async ({ page }) => {
  const errors = trackPageErrors(page);
  await launch(page, MODE, { current: "standard", onChoose: "$fn" });
  const panel = sheet(page, MODE);
  await expect(panel).toBeVisible();
  await panel.locator('[data-key="mode:competitive"]').hover();
  await expect(panel).toContainText("Registration against Resistance.");
  await pressKey(page, "Escape");
  await expect(panel).toHaveCount(0, { timeout: 10000 });
  expect(await calls(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("Give <hero> to... is a panel: it says nobody is free, Cancel is the one stop, Enter and Escape close it", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  await launch(page, GIVE, { seat: "seat-1", hero: "Spider-Man" });
  const panel = sheet(page, GIVE);
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Give Spider-Man to");
  await expect(panel).toContainText("Nobody is free to take it");
  await walkTo(page, GIVE, "cancel");
  await expect(page.locator("#mc-ui .mc-focus-ring").last()).toBeVisible();
  await pressKey(page, "Enter");
  await expect(panel).toHaveCount(0, { timeout: 10000 });

  await launch(page, GIVE, { seat: "seat-1", hero: "Spider-Man" });
  await expect(panel).toBeVisible();
  await pressKey(page, "Escape");
  await expect(panel).toHaveCount(0, { timeout: 10000 });
  expect(errors).toEqual([]);
});

test("Rejoining room is a panel: it names the room, Cancel and Escape both cancel", async ({ page }) => {
  const errors = trackPageErrors(page);
  await launch(page, REJOIN, { kind: "room", code: "ABC123", onCancel: "$fn" });
  const panel = sheet(page, REJOIN);
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Rejoining room ABC123");
  await walkTo(page, REJOIN, "cancel");
  await expect(page.locator("#mc-ui .mc-focus-ring").last()).toBeVisible();
  await pressKey(page, "Escape");
  await expect(panel).toHaveCount(0, { timeout: 10000 });
  expect(await calls(page)).toEqual(["onCancel:"]);
  expect(errors).toEqual([]);
});

test("the notice is a panel: the ring is on OK at once, two notices show Next, Enter and Escape dismiss", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  const notice = (title: string, extra: Record<string, unknown> = {}) => ({
    title,
    rows: [
      { kind: "taken", label: "Take this" },
      { kind: "unavailable", label: "Not this", why: "no reason" },
    ],
    ...extra,
  });
  await launch(page, NOTICE, { notices: [notice("First notice"), notice("Second notice", { optOut: true })] });
  const panel = sheet(page, NOTICE);
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("First notice");
  await expect(panel).toContainText("Not available: no reason.");
  expect(await focusOf(page, NOTICE)).toBe("ok");
  await expect(page.locator("#mc-ui .mc-focus-ring").last()).toBeVisible();
  await expect(panel.locator('mc-button[data-key^="ok:"]')).toContainText(/next/i);

  await pressKey(page, "Enter");
  await expect(panel).toContainText("Second notice");
  await expect(panel.locator('mc-button[data-key^="ok:"]')).toHaveText(/^ok$/i);
  // The second one offers "Don't show again" beside OK; the ring walks to it.
  await expect(panel.locator('mc-button[data-key^="never:"]')).toBeVisible();
  await walkTo(page, NOTICE, "never", "ArrowLeft", 4);
  await walkTo(page, NOTICE, "ok", "ArrowRight", 4);
  await pressKey(page, "Escape");
  await expect(panel).toHaveCount(0, { timeout: 10000 });
  expect(errors).toEqual([]);
});

test("pressing the notice's OK on the panel dismisses it", async ({ page }) => {
  const errors = trackPageErrors(page);
  await launch(page, NOTICE, {
    notices: [{ title: "Room closed", lead: "The host closed the room.", okLabel: "OK", rows: [] }],
  });
  const panel = sheet(page, NOTICE);
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("The host closed the room.");
  await panel.locator('mc-button[data-key^="ok:"]').click();
  await expect(panel).toHaveCount(0, { timeout: 10000 });
  expect(errors).toEqual([]);
});

test("Give <hero> to... with a full room keeps Cancel on screen and scrolls the recipients, on a phone", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  for (const size of [
    { width: 375, height: 667 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(size);
    await page.evaluate(async () => {
      const room = (await import("/src/platform/room.ts")) as unknown as {
        previewRoomState(state: unknown): void;
      };
      const { roomLobbyFixture } = (await import("/src/view/room-lobby-fixture.ts")) as unknown as {
        roomLobbyFixture(as: string, variant: string, extras: object): { participants: Record<string, unknown>[] };
      };
      const fixture = roomLobbyFixture("host", "open", {});
      const host = fixture.participants.find((p) => p.role === "host") ?? fixture.participants[0]!;
      const guests = Array.from({ length: 24 }, (_, i) => ({
        ...host,
        id: `p${i}`,
        name: `Guest ${i + 1}`,
        role: "guest",
        seats: [],
        buildMatches: true,
      }));
      room.previewRoomState({ ...fixture, participants: [host, ...guests] });
    });
    await launch(page, GIVE, { seat: "seat-1", hero: "Spider-Man" });
    const panel = sheet(page, GIVE);
    await expect(panel).toBeVisible();
    const viewport = page.viewportSize()!;
    const cancel = panel.locator('mc-button[data-key="cancel"]');
    const box = (await cancel.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    // The recipients sit above Cancel, not over it.
    const last = panel.locator('mc-button[data-key="give:p23"]');
    await walkTo(page, GIVE, "give:p23", "ArrowDown", 30);
    const lastBox = (await last.boundingBox())!;
    expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(box.y + 1);
    expect(lastBox.y).toBeGreaterThanOrEqual(0);
    await walkTo(page, GIVE, "cancel", "ArrowDown", 3);
    await pressKey(page, "Escape");
    await expect(panel).toHaveCount(0, { timeout: 10000 });
  }
  expect(errors).toEqual([]);
});

test("a notice with long reasons on a short phone scrolls its text and both buttons stay reachable", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  await page.setViewportSize({ width: 375, height: 500 });
  const why =
    "Jessica Jones es estoica y no puede quedar confundida mientras tenga la mejora Firmeza en juego, asi que no se ofrecio";
  await launch(page, NOTICE, {
    notices: [
      {
        title: "Work-Life Balance",
        optOut: true,
        rows: [
          { kind: "taken", label: "Remove an ally" },
          ...[2, 3, 4, 5].map((n) => ({ kind: "unavailable", label: `Option ${n}`, why })),
        ],
      },
    ],
  });
  const panel = sheet(page, NOTICE);
  await expect(panel).toBeVisible();
  for (const key of ["ok", "never"]) {
    const box = (await panel.locator(`mc-button[data-key^="${key}:"]`).boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(500);
  }
  await walkTo(page, NOTICE, "never", "ArrowLeft", 3);
  await walkTo(page, NOTICE, "ok", "ArrowRight", 3);
  expect(errors).toEqual([]);
});

test("a press begun on one notice's button and finished after another input dismissed it does not act on the next", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  await page.evaluate(() => {
    const w = window as unknown as {
      __mcGame: { scene: { getScene(k: string): { scene: { launch(k: string, d: unknown): void } } } };
      __room: { calls: string[] };
    };
    w.__room = { calls: [] };
    const action = (name: string) => ({ label: `Continue ${name}`, run: () => w.__room.calls.push(name) });
    const notice = (title: string, name: string) => ({ title, rows: [], action: action(name) });
    w.__mcGame.scene
      .getScene("PauseOverlay")
      .scene.launch("OptionNoticeOverlay", { notices: [notice("Notice A", "A"), notice("Notice B", "B")] });
  });
  const panel = sheet(page, NOTICE);
  await expect(panel).toContainText("Notice A");
  const side = panel.locator('mc-button[data-key^="never:"]');
  const box = (await side.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await pressKey(page, "Enter");
  await expect(panel).toContainText("Notice B");
  await page.mouse.up();
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Notice B");
  expect(await calls(page)).toEqual([]);
  expect(errors).toEqual([]);
});
