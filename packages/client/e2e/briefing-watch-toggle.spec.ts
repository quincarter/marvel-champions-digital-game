import { expect, test } from "@playwright/test";
import { settle } from "./helpers.js";
import { installWave6Helpers, routeStops, trackErrors, waitForScene } from "./wave6-helpers-a.js";

/**
 * The Briefing's "Let people watch this game" toggle (issue #876) on a phone: a swipe of the briefing that lifts over
 * it must not flip it, and the strip sits clear of the scrolling briefing (the no-tap-on-lift rule, issue #227;
 * `onTap`). Only a tap flips it. The check mark is read off the pixels of the toggle's box, so the spec needs no hook.
 */
test("a touch that lifts on the Briefing watch toggle leaves it alone; a tap flips it", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "touch only");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?unlock=all&screen=campaign-briefing&campaign=trors");
  await waitForScene(page, "CampaignBriefing");
  await settle(page);
  const stops = (await routeStops(page, "CampaignBriefing"))?.stops ?? [];
  const toggle = stops.find((stop) => stop.key === "watch");
  expect(toggle, "the watch toggle").toBeTruthy();
  const target = { x: toggle!.rect.x + toggle!.rect.width / 2, y: toggle!.rect.y + toggle!.rect.height / 2 };
  // No other stop (a deck row, a card) lies over the toggle's strip.
  const overlapping = stops.filter(
    (stop) =>
      !["watch", "open", "edit-decks"].includes(stop.key) &&
      stop.rect.y < toggle!.rect.y + toggle!.rect.height &&
      stop.rect.y + stop.rect.height > toggle!.rect.y &&
      stop.rect.x < toggle!.rect.x + toggle!.rect.width &&
      stop.rect.x + stop.rect.width > toggle!.rect.x,
  );
  expect(overlapping.map((stop) => stop.key)).toEqual([]);

  const box = { x: toggle!.rect.x, y: toggle!.rect.y, width: 44, height: toggle!.rect.height };
  const look = () => page.screenshot({ clip: box });
  const before = await look();

  const cdp = await page.context().newCDPSession(page);
  const from = { x: target.x, y: Math.max(80, target.y - 160) };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 10; i++) {
    const y = from.y + ((target.y - from.y) * i) / 10;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: target.x, y, id: 1 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await settle(page);
  expect((await look()).equals(before), "the swipe's lift flipped the toggle").toBe(true);

  await page.touchscreen.tap(target.x, target.y);
  await settle(page);
  expect((await look()).equals(before), "a tap flips the toggle").toBe(false);
  expect(errors).toEqual([]);
});
