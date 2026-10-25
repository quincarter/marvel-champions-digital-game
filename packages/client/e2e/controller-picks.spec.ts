import { expect, test, type Page } from "@playwright/test";
import { clickFocus, focusRect, pressKey, settle, waitFor } from "./helpers.js";
import { PAD, glyphCount, glyphIn, installPad, padHold, padRelease, padTap, padWake } from "./pad-e2e-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";

/**
 * Direct picks (`view/pick-assign.ts`, owner report 2026-10-24): while the table asks who attacks or which target, each
 * candidate wears the button that picks it (hold RT, then A / X / Y / B; the digits on a keyboard) and LB / RB under RT
 * turn the page. The glyphs are checked in place, then the press is made and the engine's own state read back.
 */

test.use({ viewport: { width: 1920, height: 1080 } });

const FACE = ["A", "X", "Y", "B"];

interface PickView {
  ids: string[];
  offset: number;
}

const pickView = (page: Page): Promise<PickView | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcBoardDebug?: { pickView(): PickView | null } }).__mcBoardDebug?.pickView() ?? null,
  );

/** A character's exhausted flag in the live game. */
const exhausted = (page: Page, id: string): Promise<boolean> =>
  page.evaluate(async (instanceId) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game?: { instances: Record<string, { exhausted: boolean }> } } } };
    };
    return appSession().store.state.game?.instances[instanceId]?.exhausted === true;
  }, id);

const version = (page: Page): Promise<number> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { version: number } } };
    };
    return appSession().store.state.version;
  });

async function openFixture(page: Page, query: string): Promise<void> {
  await installPad(page);
  await installWave6Helpers(page);
  await page.goto(`/?screen=board&${query}`);
  await waitFor(() => focusRect(page, "basic:attack"), "the action bar", 90_000);
  await settle(page, { quietMs: 600, maxMs: 6000 });
}

const rectOfSource = (page: Page, id: string): Promise<Rect | null> => focusRect(page, `source:${id}`);
const rectOfTile = (page: Page, id: string): Promise<Rect | null> => focusRect(page, `card:${id}`);

test("who attacks: each character wears RT + its button, and RT + X picks the second", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await openFixture(page, "fixture=attackers");
  await clickFocus(page, "basic:attack");
  const view = await waitFor(() => pickView(page), "the Who attacks bar", 15_000);
  expect(view.ids.length, "the hero and three allies can attack").toBe(4);
  await padWake(page);
  await settle(page, { quietMs: 300, maxMs: 2000 });

  // At rest every name wears the trigger and its button.
  for (const [slot, id] of view.ids.entries()) {
    const rect = (await rectOfSource(page, id))!;
    expect(rect, `a button for character ${slot}`).not.toBeNull();
    expect(await glyphIn(page, "Board", FACE[slot]!, rect), `${FACE[slot]} on character ${slot}`).toBe(true);
    expect(await glyphIn(page, "Board", "RT", rect), `RT on character ${slot}`).toBe(true);
  }
  await page.screenshot({ path: "../../artifacts/qa/pick-attackers-pad.png" });

  // Holding RT leaves the bare buttons.
  await padHold(page, PAD.rt);
  const second = (await rectOfSource(page, view.ids[1]!))!;
  expect(await glyphIn(page, "Board", "X", second)).toBe(true);
  expect(await glyphCount(page, "Board", "RT", second), "the trigger is held, not drawn again").toBe(0);
  await page.screenshot({ path: "../../artifacts/qa/pick-attackers-rt-held.png" });

  // RT + X picks the second character: it attacks, so it is spent, and the bar is gone.
  expect(await exhausted(page, view.ids[1]!)).toBe(false);
  await padTap(page, PAD.x);
  await padRelease(page, PAD.rt);
  await waitFor(async () => ((await pickView(page)) === null ? true : null), "the bar closed", 15_000);
  await waitFor(
    async () => ((await exhausted(page, view.ids[1]!)) ? true : null),
    "the second character attacked",
    15_000,
  );
  expect(await exhausted(page, view.ids[0]!), "the first character did not").toBe(false);
  expect(errors).toEqual([]);
});

test("who attacks: the digits pick on a keyboard and the names wear them", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await openFixture(page, "fixture=attackers");
  await clickFocus(page, "basic:attack");
  const view = await waitFor(() => pickView(page), "the Who attacks bar", 15_000);
  // A key press that does nothing else makes it a keyboard screen.
  await pressKey(page, "Shift");
  await settle(page, { quietMs: 300, maxMs: 2000 });
  for (const [slot, id] of view.ids.entries()) {
    const rect = (await rectOfSource(page, id))!;
    expect(await glyphIn(page, "Board", String(slot + 1), rect), `the key ${slot + 1} on character ${slot}`).toBe(true);
  }
  await page.screenshot({ path: "../../artifacts/qa/pick-attackers-keys.png" });
  await pressKey(page, "3");
  await waitFor(async () => ((await pickView(page)) === null ? true : null), "the bar closed", 15_000);
  await waitFor(
    async () => ((await exhausted(page, view.ids[2]!)) ? true : null),
    "the third character attacked",
    15_000,
  );
  expect(errors).toEqual([]);
});

test("which target: five tiles page four at a time, with a more hint, and RT + A on the second page picks the fifth", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await openFixture(page, "fixture=drones&seats=4");
  await clickFocus(page, "basic:attack");
  const view = await waitFor(() => pickView(page), "the target tiles", 15_000);
  expect(view.ids.length, "the villain and four drones").toBeGreaterThanOrEqual(5);
  expect(view.offset).toBe(0);
  await padWake(page);
  await settle(page, { quietMs: 300, maxMs: 2000 });

  // First page: the first four tiles wear RT + A / X / Y / B, the fifth wears nothing, and "more" is there to see.
  for (const [slot, id] of view.ids.slice(0, 4).entries()) {
    const rect = (await rectOfTile(page, id))!;
    expect(rect, `a tile for target ${slot}`).not.toBeNull();
    expect(await glyphIn(page, "Board", FACE[slot]!, rect), `${FACE[slot]} on target ${slot}`).toBe(true);
  }
  const fifth = (await rectOfTile(page, view.ids[4]!))!;
  for (const face of FACE) expect(await glyphIn(page, "Board", face, fifth), `${face} off the page`).toBe(false);
  await page.screenshot({ path: "../../artifacts/qa/pick-targets-page1.png" });

  // RT + RB turns the page: the fifth tile takes A, the first four lose theirs.
  await padHold(page, PAD.rt);
  await padTap(page, PAD.rb);
  const turned = await pickView(page);
  expect(turned?.offset, "the second page").toBe(4);
  const first = (await rectOfTile(page, view.ids[0]!))!;
  expect(await glyphIn(page, "Board", "A", first), "the first tile gave its glyph up").toBe(false);
  expect(await glyphIn(page, "Board", "A", fifth), "A on the fifth target").toBe(true);
  await page.screenshot({ path: "../../artifacts/qa/pick-targets-page2.png" });

  // RT + A picks the fifth target outright: the attack goes out and the panel closes.
  const before = await version(page);
  await padTap(page, PAD.a);
  await padRelease(page, PAD.rt);
  await waitFor(async () => ((await pickView(page)) === null ? true : null), "the panel closed", 15_000);
  expect(await version(page), "the attack reached the engine").toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test("which target: RT + RB on the last page comes back round to the first", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await openFixture(page, "fixture=drones&seats=4");
  await clickFocus(page, "basic:attack");
  const view = await waitFor(() => pickView(page), "the target tiles", 15_000);
  const pages = Math.ceil(view.ids.length / 4);
  await padHold(page, PAD.rt);
  for (let step = 0; step < pages; step++) await padTap(page, PAD.rb);
  expect((await pickView(page))?.offset, "a full turn of the pages").toBe(0);
  await padTap(page, PAD.lb);
  expect((await pickView(page))?.offset, "LB goes back a page, cycling").toBe((pages - 1) * 4);
  await padRelease(page, PAD.rt);
  expect(errors).toEqual([]);
});
