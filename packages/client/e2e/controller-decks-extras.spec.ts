import { expect, test, type Page } from "@playwright/test";
import { activeScenes, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Decks & Collection and Extras answer a controller (owner report):
 * - Extras: RB / LB step the tabs along the top, and B goes back to Title.
 * - Decks: the D-pad walks to a deck row and A selects it (its stats pane follows); on a phone RB / LB step the
 *   Decks / Cards / Stats tabs.
 */

const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const A = 0;
const B = 1;
const LB = 4;
const RB = 5;
const DPAD_DOWN = 13;

type Routes = Record<string, () => { key: string }[]>;
type States = Record<string, () => { focus: string | null }>;

async function installPad(page: Page): Promise<void> {
  await page.addInitScript((id) => {
    const button = () => ({ pressed: false, touched: false, value: 0 });
    const pad = {
      connected: true,
      id,
      index: 0,
      mapping: "standard",
      timestamp: 0,
      buttons: Array.from({ length: 17 }, button),
      axes: [0, 0, 0, 0],
    };
    (window as unknown as { __fakePad: unknown }).__fakePad = pad;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => {
        pad.timestamp = performance.now();
        return [pad];
      },
      configurable: true,
    });
  }, PAD_ID);
}

async function setButton(page: Page, index: number, on: boolean): Promise<void> {
  await page.evaluate(
    ([i, down]) => {
      const pad = (window as unknown as { __fakePad: { buttons: unknown[] } }).__fakePad;
      pad.buttons[i as number] = { pressed: down, touched: down, value: down ? 1 : 0 };
    },
    [index, on] as const,
  );
}

/** Holds a button until `done` holds (the pad is read once a frame; a loaded runner can run none in a short press). */
async function press(page: Page, index: number, done?: () => Promise<boolean>): Promise<void> {
  await setButton(page, index, true);
  if (!done) await page.waitForTimeout(400);
  else
    for (let i = 0; i < 30; i += 1) {
      await page.waitForTimeout(100);
      if (await done()) break;
    }
  await setButton(page, index, false);
  await page.waitForTimeout(300);
}

const stopKeys = (page: Page, scene: string): Promise<string[]> =>
  page.evaluate(
    (key) => (window as unknown as { __mcFocusRoutes: Routes }).__mcFocusRoutes[key]!().map((s) => s.key),
    scene,
  );

const focusOf = (page: Page, scene: string): Promise<string | null> =>
  page.evaluate(
    (key) => (window as unknown as { __mcFocusState?: States }).__mcFocusState?.[key]?.().focus ?? null,
    scene,
  );

const tileKeys = async (page: Page): Promise<string> =>
  (await stopKeys(page, "Extras")).filter((key) => key.startsWith("tile:")).join(",");

async function open(page: Page, screen: string, landing: string): Promise<void> {
  await installPad(page);
  await openApp(page, `screen=${screen}&unlock=all`, { landing });
  await press(page, DPAD_DOWN);
}

for (const size of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`Extras: RB and LB switch the tabs, B goes back (${size.width}x${size.height})`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = trackPageErrors(page);
    await page.setViewportSize(size);
    await open(page, "extras", "Extras");
    const first = await tileKeys(page);
    expect(first).not.toBe("");
    await press(page, RB, async () => (await tileKeys(page)) !== first);
    const second = await tileKeys(page);
    expect(second).not.toBe(first);
    await press(page, LB, async () => (await tileKeys(page)) !== second);
    expect(await tileKeys(page)).toBe(first);
    await press(page, B, async () => !(await activeScenes(page)).includes("Extras"));
    await waitFor(
      async () => ((await activeScenes(page)).includes("Title") ? true : null),
      "B returns to Title",
      15_000,
    );
    expect(errors).toEqual([]);
  });
}

test("Decks: the D-pad reaches a deck and A selects it", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "decks", "Decks");
  const selected = (): Promise<string | null> =>
    page.evaluate(
      () =>
        (window as unknown as { __mcDecksDebug: { decks(): { id: string; selected: boolean }[] } }).__mcDecksDebug
          .decks()
          .find((d) => d.selected)?.id ?? null,
    );
  const before = await selected();
  expect(before).not.toBeNull();
  // Walk down until the ring sits on a deck row other than the selected one.
  const onOtherDeck = async (): Promise<boolean> => {
    const focus = await focusOf(page, "Decks");
    return focus !== null && focus.startsWith("deck:") && focus !== `deck:${before}`;
  };
  for (let i = 0; i < 40 && !(await onOtherDeck()); i += 1) await press(page, DPAD_DOWN, async () => false);
  const target = await focusOf(page, "Decks");
  expect(target).toMatch(/^deck:/);
  await press(page, A, async () => (await selected()) !== before);
  expect(`deck:${await selected()}`).toBe(target);
  expect(errors).toEqual([]);
});

test("Decks on a phone: RB and LB step Decks, Cards and Stats", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "decks", "Decks");
  const has = async (prefix: string): Promise<boolean> =>
    (await stopKeys(page, "Decks")).some((k) => k.startsWith(prefix));
  expect(await has("deck:")).toBe(true);
  await press(page, RB, async () => await has("pool-card:"));
  expect(await has("pool-card:")).toBe(true);
  await press(page, RB, async () => await has("stats-"));
  expect(await has("stats-")).toBe(true);
  await press(page, LB, async () => await has("pool-card:"));
  expect(await has("pool-card:")).toBe(true);
  await press(page, B, async () => !(await activeScenes(page)).includes("Decks"));
  await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "B returns to Title", 15_000);
  expect(errors).toEqual([]);
});

test("Decks: A on the search field puts the caret in, B takes it out, and the D-pad moves again", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "decks", "Decks");
  const typing = (): Promise<boolean> => page.evaluate(() => document.activeElement?.tagName === "INPUT");
  for (let i = 0; i < 10 && (await focusOf(page, "Decks")) !== "deck-search"; i += 1) {
    const was = await focusOf(page, "Decks");
    await press(page, DPAD_DOWN, async () => (await focusOf(page, "Decks")) !== was);
  }
  expect(await focusOf(page, "Decks")).toBe("deck-search");
  await press(page, A, typing);
  expect(await typing()).toBe(true);
  await press(page, B, async () => !(await typing()));
  expect(await typing()).toBe(false);
  // Still on Decks (the B that left the field did not also go back), and the D-pad moves the ring again.
  expect(await activeScenes(page)).toContain("Decks");
  const here = await focusOf(page, "Decks");
  await press(page, DPAD_DOWN, async () => (await focusOf(page, "Decks")) !== here);
  expect(await focusOf(page, "Decks")).not.toBe(here);
  expect(errors).toEqual([]);
});
