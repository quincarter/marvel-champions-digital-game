import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressKey, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * A room's lobby is a Lit panel over the canvas (`scenes/room-lobby.ts`): the code header, the tab strip, the seat list,
 * the table settings, the chat and the Start strip are parts of one `mc-sheet`, built at the lobby layout's rects. The
 * three lists scroll natively and keep their place across a redraw, every press is a tap, the chat field stays a Phaser
 * text field seen through a hole, and the keyboard walks the same stops as before with the DOM focus ring. Run against
 * the dev preview (`?screen=room-lobby`, `view/room-lobby-fixture.ts`): presses are recorded in `__mcRoomCalls`.
 */

const SCENE = "RoomLobby";
const sheet = (page: Page) => page.locator(`#mc-ui [data-scene="${SCENE}"] mc-sheet`);
const key = (page: Page, name: string) => sheet(page).locator(`[data-key="${name}"]`).first();

const calls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (globalThis as unknown as { __mcRoomCalls?: string[] }).__mcRoomCalls ?? []);

const focusOf = (page: Page) =>
  page.evaluate(
    (scene) =>
      (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null; ringShown: boolean }> })
        .__mcFocusState[scene]!(),
    SCENE,
  );

const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1440) < 700;

async function openLobby(page: Page, query: string): Promise<void> {
  await openApp(page, `screen=room-lobby&${query}`, { landing: SCENE });
  await expect(sheet(page)).toBeVisible();
}

test("the host's lobby is a panel: header, seats, settings, and a Start that waits for the table", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openLobby(page, "as=host&v=open");
  const lobby = sheet(page);
  await waitForText(page, "Copy link", { sceneKey: SCENE });
  await expect(key(page, "copy")).toBeVisible();
  await expect(key(page, "setup")).toBeVisible();
  // The seat list and the settings (a wide screen shows both) are their own scrolling regions.
  if (!isPhone(page)) {
    await expect(key(page, "list:seats")).toBeVisible();
    await expect(key(page, "list:settings")).toBeVisible();
    await expect(key(page, "listed")).toBeVisible();
  } else {
    await expect(key(page, "tab:seats")).toBeVisible();
    await expect(key(page, "tab:settings")).toBeVisible();
    await expect(key(page, "tab:chat")).toBeVisible();
  }
  // No table is set up yet: Start is off and the strip says why; a press on it says the same and sends nothing.
  await expect(lobby.locator('mc-button[data-key="start"]')).toHaveAttribute("disabled", "");
  await expect(lobby.locator('[data-key="footer-words"]')).toContainText("Set up the table first");
  await lobby.locator('mc-button[data-key="start"]').click({ force: true });
  expect(await calls(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("a guest's lobby has no Start, and says the host sets the table", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openLobby(page, "as=guest&v=decks");
  await expect(key(page, "start")).toHaveCount(0);
  await expect(sheet(page).locator('[data-key="footer-words"]')).toBeVisible();
  // A seat button is a real, enabled button for a guest with a seat to take or leave.
  await expect(sheet(page).locator("mc-button[data-key^='seat:']").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("a phone's tabs swap the lists, a tab remembers where its list was, and ] steps to the next tab", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the tab strip is the narrow layouts'");
  const errors = trackPageErrors(page);
  await openLobby(page, "as=host&v=decks");
  await expect(key(page, "list:seats")).toBeVisible();
  await expect(key(page, "list:settings")).toHaveCount(0);
  // Scroll the seats list, go to Settings and back: it comes back where it was.
  await key(page, "list:seats").evaluate((el) => (el.scrollTop = 220));
  await key(page, "tab:settings").click();
  await expect(key(page, "list:settings")).toBeVisible();
  await expect(key(page, "list:seats")).toHaveCount(0);
  await key(page, "tab:seats").click();
  await expect(key(page, "list:seats")).toBeVisible();
  await expect.poll(() => key(page, "list:seats").evaluate((el) => el.scrollTop)).toBe(220);
  // The shoulder-button key steps on: Seats to Settings to Chat.
  await pressKey(page, "]");
  await expect(key(page, "list:settings")).toBeVisible();
  await pressKey(page, "]");
  await expect(key(page, "list:chat")).toBeVisible();
  await expect(key(page, "chat-send")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a redraw keeps each list where the reader scrolled it, and a toggle sends its change", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "a wide screen shows the lists side by side");
  const errors = trackPageErrors(page);
  await openLobby(page, "as=host&v=decks");
  const settings = key(page, "list:settings");
  await expect(settings).toBeVisible();
  await key(page, "multi").evaluate((el) => el.scrollIntoView({ block: "center" }));
  const before = await settings.evaluate((el) => el.scrollTop);
  expect(before).toBeGreaterThan(100);
  await key(page, "multi").click();
  expect((await calls(page)).some((call) => call.startsWith("setLobby("))).toBe(true);
  // A new layout redraws the whole panel; the list is the same element, so the reader keeps their place.
  await page.setViewportSize({ width: 1430, height: 880 });
  await waitFor(async () => (await settings.evaluate((el) => el.scrollTop)) > 0, "the list still scrolled", 5000);
  expect(Math.abs((await settings.evaluate((el) => el.scrollTop)) - before)).toBeLessThan(60);
  expect(errors).toEqual([]);
});

test("the chat sends a typed line from the Phaser field seen through the panel", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openLobby(page, "as=guest&v=decks");
  // A phone and a portrait tablet have the Chat tab; a desktop has the Chat pill that opens the floating chat.
  if (isPhone(page)) await key(page, "tab:chat").click();
  else if ((page.viewportSize()?.width ?? 0) >= 1200) await key(page, "chat-pill").click();
  await expect(key(page, "list:chat")).toBeVisible();
  const field = page.locator("input").filter({ visible: true }).first();
  await expect(field).toBeVisible();
  await field.fill("hello there");
  await key(page, "chat-send").click();
  await expect.poll(() => calls(page)).toContain("say(hello there)");
  await field.fill("and again");
  await field.press("Enter");
  await expect.poll(() => calls(page)).toContain("say(and again)");
  expect(errors).toEqual([]);
});

test("the keyboard walks the lobby's stops with the DOM ring, and Escape asks before closing a room", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  await openLobby(page, "as=host&v=open");
  const seen: string[] = [];
  for (let i = 0; i < 6; i++) {
    await pressKey(page, "Tab");
    const { focus } = await focusOf(page);
    if (focus && !seen.includes(focus)) seen.push(focus);
  }
  expect(seen.slice(0, 2)).toEqual(["back", "copy"]);
  expect(seen).toContain("setup");
  expect((await focusOf(page)).ringShown).toBe(true);
  await expect(page.locator("#mc-ui .mc-focus-ring").last()).toBeVisible();
  // Escape (B) on a host's lobby asks first: the strip offers Stay and Close room; Stay keeps the lobby.
  await pressKey(page, "Escape");
  await expect(key(page, "stay")).toBeVisible();
  await expect(key(page, "close")).toBeVisible();
  await key(page, "stay").click();
  await expect(key(page, "stay")).toHaveCount(0);
  expect(await activeScenes(page)).toContain(SCENE);
  expect(errors).toEqual([]);
});

test("a seat's button on the panel sends its call, and a kept table changes what Start waits for", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openLobby(page, "as=host&v=open");
  await key(page, "seat:s1").scrollIntoViewIfNeeded();
  await key(page, "seat:s1").click();
  await expect.poll(() => calls(page)).toEqual(["denySeat(s1,p1)"]);
  // With a table set up the strip stops asking for one and names the next thing Start waits for (open seats here).
  await expect(sheet(page).locator('[data-key="footer-words"]')).toContainText("Set up the table first");
  await page.evaluate(async () => {
    const setup = (await import("/src/view/room-table-setup.ts")) as unknown as {
      keepRoomDraft(draft: unknown): void;
    };
    const title = (await import("/src/scenes/title.ts")) as unknown as { newGameDraft(): unknown };
    setup.keepRoomDraft(title.newGameDraft());
  });
  // A new layout redraws the panel with the kept table.
  await page.setViewportSize({
    width: (page.viewportSize()?.width ?? 1440) - 10,
    height: page.viewportSize()?.height ?? 900,
  });
  await expect(sheet(page).locator('[data-key="footer-words"]')).toContainText("open", { timeout: 10000 });
  await expect(sheet(page).locator('mc-button[data-key="start"]')).toHaveAttribute("disabled", "");
  expect(errors).toEqual([]);
});
