import { expect, test } from "@playwright/test";
import { activeScenes, clickText, hasText, pressKey, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { PAD, glyphIn, installPad, padTap, padWake } from "./pad-e2e-helpers.js";
import type { Rect } from "./wave6-helpers-b.js";

/**
 * An interrupt that matched but could not be used says why (#431): Hulkling's Iron Lad attacks with no other Avenger ally
 * on the table, so "exhaust another Avenger ally you control →" cannot be paid, nothing is asked, and the board opens
 * the notice over the attack, naming the missing ally. OK closes it.
 */

test.use({ viewport: { width: 1280, height: 800 } });

const NOTICE = "OptionNoticeOverlay";

test("Iron Lad attacks alone: the board says his interrupt was not offered, and why", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=iron-lad");
  await waitFor(
    async () => ((await activeScenes(page)).includes(NOTICE) ? true : null),
    "the not-offered notice opens",
    120_000,
  );
  await settle(page, { quietMs: 500, maxMs: 4000 });

  expect(await hasText(page, "Iron Lad: interrupt not offered", NOTICE)).toBe(true);
  expect(await hasText(page, "you control no other ready Avenger ally", NOTICE)).toBe(true);
  await page.screenshot({ path: "../../artifacts/qa/431/iron-lad-not-offered.png" });

  await clickText(page, "OK", { sceneKey: NOTICE });
  await waitFor(
    async () => ((await activeScenes(page)).includes(NOTICE) ? null : true),
    "OK closes the notice",
    10_000,
  );
  expect(errors).toEqual([]);
});

test("Iron Lad's Inspect sheet says his interrupt has no other ready Avenger ally to exhaust", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=inspect&fixture=iron-lad");
  await waitFor(
    async () => ((await hasText(page, "can't be used right now")) ? true : null),
    "Inspect's Right now note",
    120_000,
  );
  await settle(page, { quietMs: 500, maxMs: 4000 });
  expect(await hasText(page, "Interrupt can't be used right now: you control no other ready Avenger ally")).toBe(true);
  await page.screenshot({ path: "../../artifacts/qa/431/iron-lad-inspect.png" });
  expect(errors).toEqual([]);
});

for (const [fixture, name, why, kind] of [
  ["aneka", "Aneka", "there is no other Dora Milaje ally in play", "response"],
] as const) {
  test(`${name}: the board's notice and Inspect both say why the ${kind} was not offered`, async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await installWave6Helpers(page);
    await page.goto(`/?screen=board&fixture=${fixture}`);
    await waitFor(
      async () => ((await activeScenes(page)).includes(NOTICE) ? true : null),
      "the not-offered notice opens",
      120_000,
    );
    await settle(page, { quietMs: 500, maxMs: 4000 });
    expect(await hasText(page, `${name}: ${kind} not offered`, NOTICE)).toBe(true);
    expect(await hasText(page, why, NOTICE)).toBe(true);
    await page.screenshot({ path: `../../artifacts/qa/431/${fixture}-not-offered.png` });

    await page.goto(`/?screen=inspect&fixture=${fixture}`);
    await waitFor(async () => ((await hasText(page, why)) ? true : null), "Inspect's Right now note", 120_000);
    await settle(page, { quietMs: 500, maxMs: 4000 });
    await page.screenshot({ path: `../../artifacts/qa/431/${fixture}-inspect.png` });
    expect(errors).toEqual([]);
  });
}

/** The setting, and whether the last command's events said Iron Lad's (or Aneka's) ability was not offered. */
const engineSays = (page: import("@playwright/test").Page) =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        settings: { notOfferedNotices: boolean };
        store: { state: { lastEvents: readonly { readonly type: string }[] } };
      };
    };
    const session = appSession();
    return {
      setting: session.settings.notOfferedNotices,
      notOffered: session.store.state.lastEvents.some((e) => e.type === "abilityNotOffered"),
    };
  });

test("Don't show again closes the notice and turns the setting off", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=iron-lad");
  await waitFor(
    async () => ((await activeScenes(page)).includes(NOTICE) ? true : null),
    "the not-offered notice opens",
    120_000,
  );
  await settle(page, { quietMs: 500, maxMs: 4000 });
  expect((await engineSays(page)).setting).toBe(true);
  await clickText(page, "Don't show again", { sceneKey: NOTICE });
  await waitFor(
    async () => ((await activeScenes(page)).includes(NOTICE) ? null : true),
    "Don't show again closes the notice",
    10_000,
  );
  expect((await engineSays(page)).setting).toBe(false);
  // Kept between launches: a fresh load of the same moment opens no notice.
  await page.goto("/?screen=board&fixture=aneka");
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "the board opens", 120_000);
  await settle(page, { quietMs: 1500, maxMs: 6000 });
  expect(await activeScenes(page)).not.toContain(NOTICE);
  expect(await engineSays(page)).toEqual({ setting: false, notOffered: true });
  expect(errors).toEqual([]);
});

test("with the setting off, Iron Lad attacking alone opens no notice, and the log still says why", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem("mc-settings", JSON.stringify({ version: 1, notOfferedNotices: false }));
  });
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=iron-lad");
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "the board opens", 120_000);
  await settle(page, { quietMs: 1500, maxMs: 6000 });
  expect(await activeScenes(page)).not.toContain(NOTICE);
  // It was meant to show: the game said the interrupt was not offered (the log has the line), only the notice is off.
  expect(await engineSays(page)).toEqual({ setting: false, notOffered: true });
  await page.screenshot({ path: "../../artifacts/qa/431/setting-off-no-notice.png" });
  expect(errors).toEqual([]);
});

test("Settings lists the not-offered notices under Game, on by default", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=settings");
  await waitFor(
    async () => ((await hasText(page, "Explain abilities not offered")) ? true : null),
    "the setting's row",
    60_000,
  );
  await settle(page, { quietMs: 500, maxMs: 3000 });
  await page.screenshot({ path: "../../artifacts/qa/431/settings-row.png" });
  expect((await engineSays(page)).setting).toBe(true);
  expect(errors).toEqual([]);
});

test("on a pad, Don't show again wears X and X presses it; OK keeps A", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installPad(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=iron-lad");
  await waitFor(
    async () => ((await activeScenes(page)).includes(NOTICE) ? true : null),
    "the not-offered notice opens",
    120_000,
  );
  await settle(page, { quietMs: 500, maxMs: 4000 });
  await padWake(page);
  await settle(page, { quietMs: 300, maxMs: 2000 });
  const rectOf = (key: string): Promise<Rect | null> =>
    page.evaluate(
      ({ scene, stop }) =>
        (
          window as unknown as { __mcFocusRoutes?: Record<string, () => { key: string; rect: Rect }[]> }
        ).__mcFocusRoutes?.[scene]?.().find((each) => each.key === stop)?.rect ?? null,
      { scene: NOTICE, stop: key },
    );
  const never = (await rectOf("never"))!;
  const ok = (await rectOf("ok"))!;
  expect(await glyphIn(page, NOTICE, "X", never), "X on Don't show again").toBe(true);
  expect(await glyphIn(page, NOTICE, "A", ok), "A on OK").toBe(true);
  await page.screenshot({ path: "../../artifacts/qa/431/notice-pad-glyphs.png" });
  await padTap(page, PAD.x);
  await waitFor(async () => ((await activeScenes(page)).includes(NOTICE) ? null : true), "X closes the notice", 10_000);
  expect((await engineSays(page)).setting).toBe(false);
  expect(errors).toEqual([]);
});

/** A stop's rect from a scene's own focus route. */
const stopRect = (page: import("@playwright/test").Page, scene: string, key: string): Promise<Rect | null> =>
  page.evaluate(
    ({ scene, stop }) =>
      (
        window as unknown as { __mcFocusRoutes?: Record<string, () => { key: string; rect: Rect }[]> }
      ).__mcFocusRoutes?.[scene]?.().find((each) => each.key === stop)?.rect ?? null,
    { scene, stop: key },
  );

test("on a keyboard, Don't show again wears G and G presses it; OK wears Space", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=iron-lad");
  await waitFor(
    async () => ((await activeScenes(page)).includes(NOTICE) ? true : null),
    "the not-offered notice opens",
    120_000,
  );
  await settle(page, { quietMs: 500, maxMs: 4000 });
  // A key press that does nothing else makes it a keyboard screen.
  await pressKey(page, "Shift");
  await settle(page, { quietMs: 300, maxMs: 2000 });
  const never = (await stopRect(page, NOTICE, "never"))!;
  const ok = (await stopRect(page, NOTICE, "ok"))!;
  expect(await glyphIn(page, NOTICE, "G", never), "G on Don't show again").toBe(true);
  expect(await glyphIn(page, NOTICE, "Space", ok), "Space on OK").toBe(true);
  await page.screenshot({ path: "../../artifacts/qa/431/notice-keyboard-glyphs.png" });
  await pressKey(page, "g");
  await waitFor(async () => ((await activeScenes(page)).includes(NOTICE) ? null : true), "G closes the notice", 10_000);
  expect((await engineSays(page)).setting).toBe(false);
  expect(errors).toEqual([]);
});

for (const input of ["pad", "keyboard"] as const) {
  test(`Iron Lad's Inspect sheet on a ${input}: the note, and Close wearing its ${input === "pad" ? "B" : "Esc"}`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    if (input === "pad") await installPad(page);
    await installWave6Helpers(page);
    await page.goto("/?screen=inspect&fixture=iron-lad");
    await waitFor(
      async () => ((await hasText(page, "can't be used right now")) ? true : null),
      "Inspect's Right now note",
      120_000,
    );
    await settle(page, { quietMs: 500, maxMs: 4000 });
    if (input === "pad") await padWake(page);
    else await pressKey(page, "Shift");
    await settle(page, { quietMs: 300, maxMs: 2000 });
    await page.screenshot({ path: `../../artifacts/qa/431/iron-lad-inspect-${input}.png` });
    expect(errors).toEqual([]);
  });
}
