import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, trackPageErrors, waitFor } from "./helpers.js";
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
const Y = 3;
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

/** A short press: down for a few frames, up before the pad's hold-repeat starts (so one press is one press). */
async function tap(page: Page, index: number): Promise<void> {
  await setButton(page, index, true);
  await page.waitForTimeout(160);
  await setButton(page, index, false);
  await page.waitForTimeout(250);
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
  // The first pad press wakes the pad and lands the ring somewhere: wait for that, not a fixed hold.
  await press(page, DPAD_DOWN, async () => (await focusOf(page, landing)) !== null);
}

/** Arrow-keys (one press each, so it never overshoots) until the focus key starts with `prefix`. */
async function walkTo(page: Page, scene: string, prefix: string, arrow = "ArrowDown"): Promise<string> {
  // The wake press may have landed past the target: after 25 steps one way, walk back the other (up for the default).
  const back = arrow === "ArrowDown" ? "ArrowUp" : "ArrowLeft";
  for (let i = 0; i < 120; i += 1) {
    const focus = await focusOf(page, scene);
    if (focus?.startsWith(prefix)) return focus;
    await page.keyboard.press(i < 25 ? arrow : back);
    await page.waitForTimeout(60);
  }
  throw new Error(`never reached ${prefix}, at ${await focusOf(page, scene)}`);
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
  for (let i = 0; i < 40 && !(await onOtherDeck()); i += 1) {
    const was = await focusOf(page, "Decks");
    await press(page, DPAD_DOWN, async () => (await focusOf(page, "Decks")) !== was);
  }
  await page.waitForTimeout(500);
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
  await walkTo(page, "Decks", "deck-search");
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

test("Deck builder: B with unsaved changes asks to Leave, and a second B leaves", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "deck-builder", "DeckBuilder");
  // Rename the deck (A on the name field, type, B out of the field) so there is something unsaved.
  const typing = (): Promise<boolean> => page.evaluate(() => document.activeElement?.tagName === "INPUT");
  for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowUp");
  for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowUp");
  await walkTo(page, "DeckBuilder", "name");
  await press(page, A, typing);
  await page.keyboard.type(" x");
  await press(page, B, async () => !(await typing()));
  await page.waitForTimeout(400);
  // The first B arms Leave, in pad words, and stays (held only until the line shows, so it cannot repeat into a second).
  await press(page, B, async () => (await findText(page, "You have unsaved", "DeckBuilder")).length > 0);
  expect((await findText(page, "You have unsaved", "DeckBuilder")).length).toBeGreaterThan(0);
  expect(await activeScenes(page)).toContain("DeckBuilder");
  expect(await activeScenes(page)).not.toContain("Decks");
  await press(page, B, async () => !(await activeScenes(page)).includes("DeckBuilder"));
  await waitFor(
    async () => ((await activeScenes(page)).includes("Decks") ? true : null),
    "the second B leaves",
    15_000,
  ).catch(async (error) => {
    throw new Error(`${String(error)} scenes=${(await activeScenes(page)).join(",")} errors=${errors.join("|")}`);
  });
  expect(errors).toEqual([]);
});

test("Decks: Y on a pool card opens the inspect view", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "decks", "Decks");
  await walkTo(page, "Decks", "deck:");
  await walkTo(page, "Decks", "pool-card:", "ArrowRight");
  await press(page, Y, async () => (await activeScenes(page)).includes("InspectOverlay"));
  expect(await activeScenes(page)).toContain("InspectOverlay");
  expect(errors).toEqual([]);
});
