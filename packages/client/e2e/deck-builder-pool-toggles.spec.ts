import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { openDecks, press, shot, startNewDeck, stopsOf, texts } from "./wave7-deck-builder-helpers.js";

/**
 * Deck builder updates (issue #977, benpap24), on the desktop: the Hero and Basic toggles beside the aspect buttons
 * hide those cards from the pool (so Aggression with both off lists aggression cards alone), and a press on the pack
 * name or the wave button opens a picker where several are chosen at once.
 */

/** The pool's card count, from its "N cards" label. */
async function poolCount(page: Page): Promise<number> {
  const label = (await texts(page, "DeckBuilder")).find((t) => /^((card\s+)?pool\s+—\s+)?\d+\s+cards?$/i.test(t));
  return Number(/(\d+)/.exec(label ?? "")?.[1] ?? NaN);
}

/** The picker's choice stops (`pick:<id>`), in list order; `pick:all` is the All row. */
async function pickKeys(page: Page): Promise<string[]> {
  return (await stopsOf(page, "PoolPickSheet"))
    .map((s) => s.key)
    .filter((k) => k.startsWith("pick:") && k !== "pick:all");
}

async function openPicker(page: Page, key: string): Promise<void> {
  await press(page, "DeckBuilder", key);
  await waitFor(async () => ((await activeScenes(page)).includes("PoolPickSheet") ? true : null), "the picker", 10_000);
  await settle(page);
}

test("Hero and Basic toggles hide those cards; packs and waves are picked several at once", async ({ page }) => {
  test.setTimeout(240_000);
  await openDecks(page);
  await startNewDeck(page, "01001a");
  await press(page, "DeckBuilder", "aspect:aggression");
  const all = await poolCount(page);
  expect(all).toBeGreaterThan(0);
  expect(await texts(page, "DeckBuilder")).toEqual(expect.arrayContaining(["✓ HERO", "✓ BASIC"]));

  await press(page, "DeckBuilder", "type:show-hero");
  const noHero = await poolCount(page);
  expect(noHero).toBeLessThan(all);
  await press(page, "DeckBuilder", "type:show-basic");
  const aspectOnly = await poolCount(page);
  expect(aspectOnly).toBeGreaterThan(0);
  expect(aspectOnly).toBeLessThan(noHero);
  await shot(page, "977-aggression-only");
  // Back on, the pool is whole again.
  await press(page, "DeckBuilder", "type:show-hero");
  await press(page, "DeckBuilder", "type:show-basic");
  expect(await poolCount(page)).toBe(all);

  // Packs: two picked at once, then All clears them.
  await openPicker(page, "pack:name");
  const packs = await pickKeys(page);
  expect(packs.length).toBeGreaterThan(2);
  await press(page, "PoolPickSheet", packs[0]!);
  await press(page, "PoolPickSheet", packs[1]!);
  await shot(page, "977-pack-picker");
  await press(page, "PoolPickSheet", "done");
  await waitFor(async () => (!(await activeScenes(page)).includes("PoolPickSheet") ? true : null), "picker closes");
  expect(await texts(page, "DeckBuilder")).toContain("2 PACKS ▾");
  const twoPacks = await poolCount(page);
  expect(twoPacks).toBeGreaterThan(0);
  expect(twoPacks).toBeLessThan(all);
  await openPicker(page, "pack:name");
  await press(page, "PoolPickSheet", "pick:all");
  await page.keyboard.press("Escape");
  await waitFor(async () => (!(await activeScenes(page)).includes("PoolPickSheet") ? true : null), "picker closes");
  expect(await texts(page, "DeckBuilder")).toContain("ALL PACKS ▾");
  expect(await poolCount(page)).toBe(all);

  // Waves: two picked at once.
  await openPicker(page, "pack:cycle");
  const waves = await pickKeys(page);
  expect(waves.length).toBeGreaterThan(2);
  await press(page, "PoolPickSheet", waves[0]!);
  await press(page, "PoolPickSheet", waves[1]!);
  await shot(page, "977-wave-picker");
  await press(page, "PoolPickSheet", "done");
  await waitFor(async () => (!(await activeScenes(page)).includes("PoolPickSheet") ? true : null), "picker closes");
  expect(await texts(page, "DeckBuilder")).toContain("2 WAVES ▾");
  expect(await poolCount(page)).toBeLessThan(all);
});
