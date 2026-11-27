import { expect, test, type Page } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import {
  clickStop,
  installWave6Helpers,
  routeStops,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";

/**
 * The lobby's seat list and chat list scroll, and the end of a swipe must never press whatever control the finger
 * lifts over (issue #227, the no-tap-on-lift rule; issue #880). Run against the dev preview of the lobby
 * (`?screen=room-lobby&as=host`, `view/room-lobby-fixture.ts`), whose presses are recorded in `__mcRoomCalls` rather
 * than sent: after a swipe that lifts on a button the record is empty, and a tap on the same button is in it.
 */

const calls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (globalThis as unknown as { __mcRoomCalls?: string[] }).__mcRoomCalls ?? []);

async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 10; i++) {
    const x = from.x + ((to.x - from.x) * i) / 10;
    const y = from.y + ((to.y - from.y) * i) / 10;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y, id: 1 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await settle(page);
}

test("a swipe of the seat list that lifts on a seat button presses nothing; a tap does", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "touch only");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=room-lobby&as=host");
  await waitForScene(page, "RoomLobby");
  await settle(page);
  const stops = (await routeStops(page, "RoomLobby"))?.stops ?? [];
  const button = stops.find((stop) => stop.key === "seat:s1");
  expect(button, "the first seat's button").toBeTruthy();
  const target = { x: button!.rect.x + button!.rect.width / 2, y: button!.rect.y + button!.rect.height / 2 };
  // Down onto the button from above it, inside the list (the list sits at its top, so it does not move).
  await swipe(page, { x: target.x - 60, y: target.y - 80 }, target);
  expect(await calls(page), "the swipe's lift pressed a seat button").toEqual([]);
  // The swipe scrolled the list: the button is where the list now has it.
  const now = ((await routeStops(page, "RoomLobby"))?.stops ?? []).find((stop) => stop.key === "seat:s1")!;
  await page.touchscreen.tap(now.rect.x + now.rect.width / 2, now.rect.y + now.rect.height / 2);
  await settle(page);
  expect(await calls(page)).toEqual(["denySeat(s1,p1)"]);
  expect(errors).toEqual([]);
});

test("a swipe of the chat list that lifts on Send sends nothing; a tap sends", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "touch only");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=room-lobby&as=guest");
  await waitForScene(page, "RoomLobby");
  await settle(page);
  await clickStop(page, "tab:chat", "RoomLobby");
  await settle(page);
  await page.locator("input").first().fill("hello there");
  const stops = (await routeStops(page, "RoomLobby"))?.stops ?? [];
  const send = stops.find((stop) => stop.key === "chat-send");
  expect(send, "the Send button").toBeTruthy();
  const target = { x: send!.rect.x + send!.rect.width / 2, y: send!.rect.y + send!.rect.height / 2 };
  await swipe(page, { x: target.x - 40, y: target.y - 200 }, target);
  expect(await calls(page), "the swipe's lift on Send sent a line").toEqual([]);
  await page.touchscreen.tap(target.x, target.y);
  await settle(page);
  expect(await calls(page)).toEqual(["say(hello there)"]);
  expect(errors).toEqual([]);
});

test("a swipe of the seat list that lifts on Set deck opens nothing; a tap opens the picker", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "touch only");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=room-lobby&as=host&v=open");
  await waitForScene(page, "RoomLobby");
  await settle(page);
  const button = ((await routeStops(page, "RoomLobby"))?.stops ?? []).find((stop) => stop.key === "deck:s1");
  expect(button, "the first seat's Set deck button").toBeTruthy();
  const target = { x: button!.rect.x + button!.rect.width / 2, y: button!.rect.y + button!.rect.height / 2 };
  await swipe(page, { x: target.x - 60, y: target.y - 80 }, target);
  await waitForScene(page, "RoomLobby");
  const now = ((await routeStops(page, "RoomLobby"))?.stops ?? []).find((stop) => stop.key === "deck:s1")!;
  await page.touchscreen.tap(now.rect.x + now.rect.width / 2, now.rect.y + now.rect.height / 2);
  await settle(page);
  await waitForScene(page, "RoomDeckPicker");
  expect(errors).toEqual([]);
});

test("a swipe of the deck picker that lifts on Pick chooses nothing; a tap chooses", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "touch only");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=room-deck-picker&as=guest");
  await waitForScene(page, "RoomDeckPicker");
  await settle(page);
  // The decks are judged by a worker and the ones that cannot be seated sink to the end of the list: wait for the
  // verdicts, or the deck tapped below may be one that turns out to be unusable.
  await waitFor(
    async () =>
      (await visibleTexts(page)).some((t) => t.scene === "RoomDeckPicker" && /checking/i.test(t.text)) ? null : true,
    "the decks are judged",
    30_000,
  );
  await settle(page);
  const pick = ((await routeStops(page, "RoomDeckPicker"))?.stops ?? []).find((stop) => stop.key.startsWith("deck:"));
  expect(pick, "a Pick button").toBeTruthy();
  const target = { x: pick!.rect.x + pick!.rect.width / 2, y: pick!.rect.y + pick!.rect.height / 2 };
  await swipe(page, { x: target.x - 60, y: target.y + 90 }, target);
  expect(await calls(page), "the swipe's lift chose a deck").toEqual([]);
  // The swipe scrolled the list, so the first row's button is now under the header: tap a Pick that is on screen.
  const height = page.viewportSize()?.height ?? 844;
  const now = ((await routeStops(page, "RoomDeckPicker"))?.stops ?? []).find(
    (stop) => stop.key.startsWith("deck:") && stop.rect.y > 200 && stop.rect.y + stop.rect.height < height - 100,
  );
  expect(now, "a Pick button in view after the swipe").toBeTruthy();
  // A deck row opens its details sheet (the grid picker, b2c88a2dd); "Use this deck" in it is what chooses.
  await page.touchscreen.tap(now!.rect.x + now!.rect.width / 2, now!.rect.y + now!.rect.height / 2);
  await settle(page);
  const use = await waitFor(
    async () => ((await routeStops(page, "RoomDeckPicker"))?.stops ?? []).find((stop) => stop.key === "panel:use"),
    "the details sheet's Use this deck",
    15000,
  );
  await page.touchscreen.tap(use.rect.x + use.rect.width / 2, use.rect.y + use.rect.height / 2);
  await settle(page);
  expect((await calls(page))[0]).toMatch(/^chooseDeck\(s1,/);
  expect(errors).toEqual([]);
});
