import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Deck builder (issue #920): the chosen identity sits under the title as one row with its picture, its name and a
 * "Read card" cue. A press on the row, or its pad stop, opens Inspect on the hero side, and Inspect's side toggle reads
 * the alter-ego, so a player can see what the hero does while building.
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
      ]?.().find((stop) => stop.key === k)?.rect ?? null,
    [scene, key],
  );

async function inspectTexts(page: Page): Promise<string> {
  return (await visibleTexts(page))
    .filter((t) => t.scene === "InspectOverlay")
    .map((t) => t.text)
    .join("\n");
}

async function waitForInspect(page: Page): Promise<void> {
  await waitFor(async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null), "Inspect opens");
  await settle(page);
}

test("the identity row opens the identity in Inspect, and its toggle reads the alter-ego", async ({ page }) => {
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  // The first precon is the Core Set's Spider-Man (Peter Parker).
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  await page.waitForTimeout(800);
  const button = await waitFor(() => stopRect(page, "DeckBuilder", "identity-card"), "the identity row", 15_000);
  await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
  await waitForInspect(page);
  const hero = await inspectTexts(page);
  expect(hero).toMatch(/spider-man/i);
  expect(hero).toMatch(/show alter-ego/i);

  const toggle = (await visibleTexts(page)).find(
    (t) => t.scene === "InspectOverlay" && /^show alter-ego$/i.test(t.text.trim()),
  );
  expect(toggle, "the side toggle").toBeTruthy();
  await page.mouse.click(toggle!.x, toggle!.y);
  await waitFor(
    async () =>
      /peter parker/i.test(await inspectTexts(page)) && /show hero/i.test(await inspectTexts(page)) ? true : null,
    "the alter-ego side",
  );
});

test("a press on the identity's name opens it too", async ({ page }) => {
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  await page.waitForTimeout(800);
  await waitFor(() => stopRect(page, "DeckBuilder", "identity-card"), "the identity row", 15_000);
  const name = await waitFor(
    async () =>
      (await visibleTexts(page)).find(
        (t) => t.scene === "DeckBuilder" && /^spider-man \(peter parker\)$/i.test(t.text.trim()),
      ) ?? null,
    "the identity's name",
  );
  await page.mouse.click(name.x, name.y);
  await waitForInspect(page);
  expect(await inspectTexts(page)).toMatch(/show alter-ego/i);
});
