import { expect, test, type Page } from "@playwright/test";
import { waitFor } from "./helpers.js";
import { installWave6Helpers, screens, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Deck builder (issues #594, #595): the deck list's Sort steps and is remembered, and Review opens Deck check on the
 * deck as edited, with Back returning to the builder. Pressed through the screen's own controls, by route key.
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const stopRect = (page: Page, scene: string, key: string): Promise<Rect | null> =>
  page.evaluate(
    ([s, k]) =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string; rect: Rect }[]> }).__mcFocusRoutes[
        s!
      ]?.()?.find((stop) => stop.key === k)?.rect ?? null,
    [scene, key],
  );

async function press(page: Page, scene: string, key: string): Promise<void> {
  // The phone Deck tab scrolls between the tabs and Save: wheel the control clear of Save first.
  const size = page.viewportSize()!;
  let r = await waitFor(() => stopRect(page, scene, key), `${scene} ${key}`, 15_000);
  for (let i = 0; i < 12 && r.y + r.height > size.height - 110; i++) {
    await page.mouse.move(size.width / 2, size.height / 2);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(300);
    r = (await stopRect(page, scene, key)) ?? r;
  }
  const x = r.x + r.width / 2;
  const y = r.y + r.height / 2;
  if (page.viewportSize()!.width < 768) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await page.waitForTimeout(400);
}

const sees = async (page: Page, scene: string, text: string): Promise<boolean> =>
  (await visibleTexts(page)).some((t) => t.scene === scene && t.text.toLowerCase() === text.toLowerCase());

const deckName = (page: Page): Promise<string[]> =>
  page.locator("input").evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));

test("the deck list's sort is kept, and Review goes to Deck check and back", async ({ page }) => {
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  await page.waitForTimeout(800);
  if (page.viewportSize()!.width < 1100) await press(page, "DeckBuilder", "tab:deck");

  // A name typed just before Review draws nothing, and must still come back.
  await press(page, "DeckBuilder", "name");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Round trip");
  await page.waitForTimeout(300);

  await press(page, "DeckBuilder", "deck-sort");
  await waitFor(async () => ((await sees(page, "DeckBuilder", "Sort: Type")) ? true : null), "the sort stepped");

  await press(page, "DeckBuilder", "deck-review");
  await waitFor(async () => ((await screens(page)).includes("DeckCheck") ? true : null), "Deck check opens");
  await page.waitForTimeout(800);
  if (page.viewportSize()!.width < 1100) await press(page, "DeckCheck", "tab:cards");
  await waitFor(async () => ((await sees(page, "DeckCheck", "Sort: Type")) ? true : null), "Deck check keeps the sort");

  await press(page, "DeckCheck", "back");
  await waitFor(async () => ((await screens(page)).includes("DeckBuilder") ? true : null), "back in the builder");
  await page.waitForTimeout(800);
  await waitFor(async () => ((await sees(page, "DeckBuilder", "Sort: Type")) ? true : null), "the sort is still kept");
  expect(await stopRect(page, "DeckBuilder", "deck-review")).not.toBeNull();
  await waitFor(async () => ((await deckName(page)).includes("Round trip") ? true : null), "the typed name came back");

  await press(page, "DeckBuilder", "deck-review");
  await waitFor(async () => ((await screens(page)).includes("DeckCheck") ? true : null), "Deck check again");
  await page.waitForTimeout(800);
  await press(page, "DeckCheck", "edit-deck");
  await waitFor(async () => ((await screens(page)).includes("DeckBuilder") ? true : null), "Edit deck comes back");
  await page.waitForTimeout(800);
  await waitFor(async () => ((await deckName(page)).includes("Round trip") ? true : null), "the name is still there");
});

test("a swipe of Deck check's cards that lifts over Sort presses nothing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the finger-lift rule is a phone rule");
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  await openApp(page, "screen=deck-check", { landing: "DeckCheck" });
  await page.waitForTimeout(800);
  await press(page, "DeckCheck", "tab:cards");
  const sort = await waitFor(() => stopRect(page, "DeckCheck", "deck-sort"), "the sort control", 15_000);
  const before = await sees(page, "DeckCheck", "Sort: Aspect");
  const lift = { x: sort.x + sort.width / 2, y: sort.y + sort.height / 2 };
  const from = { x: lift.x, y: lift.y + 240 };
  const steps = 10;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: lift.x, y: from.y + ((lift.y - from.y) * i) / steps, id: 1 }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(500);
  expect(before).toBe(true);
  expect(await sees(page, "DeckCheck", "Sort: Aspect")).toBe(true);
});
