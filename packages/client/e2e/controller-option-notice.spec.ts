import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { PAD, glyphIn, installPad, padTap, padWake } from "./pad-e2e-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";

/**
 * The "only one option" notice (#412) answers a pad: its OK wears A and, on a pad, Start; the ring is on OK the moment it
 * opens; A, Start and B each close it (Esc too, on the keyboard); and the press that closes it reaches nothing under
 * it (no Pause from Start, no choice taken or Board action from A, B or Esc). Closing hands focus back to what was
 * under it. The fixture is Work-Life Balance used with an ally while Jessica is stalwart: the confuse option is
 * barred, the ally option taken on its own, and the pick of which ally waits on the choice sheet under the notice.
 */

test.use({ viewport: { width: 1280, height: 800 } });

const NOTICE = "OptionNoticeOverlay";

const noticeUp = async (page: Page): Promise<boolean> => (await activeScenes(page)).includes(NOTICE);

/** The OK stop's rect, from the notice's own focus route. */
const okRect = (page: Page): Promise<Rect | null> =>
  page.evaluate(
    (key) =>
      (
        window as unknown as { __mcFocusRoutes?: Record<string, () => { key: string; rect: Rect }[]> }
      ).__mcFocusRoutes?.[key]?.().find((stop) => stop.key === "ok")?.rect ?? null,
    NOTICE,
  );

const noticeFocus = (page: Page): Promise<string | null> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusState?: Record<string, () => { focus: string | null }> }).__mcFocusState?.[
        key
      ]?.().focus ?? null,
    NOTICE,
  );

const sheetFocus = (page: Page): Promise<string | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcChoiceDebug?: { focusKey(): string | null } }).__mcChoiceDebug?.focusKey() ?? null,
  );

const boardFocus = (page: Page): Promise<string | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcBoardDebug?: { focusedKey(): string | null } }).__mcBoardDebug?.focusedKey() ?? null,
  );

/** The engine's own record: the state version and the pending choice, so "nothing underneath fired" is read back. */
const engine = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { version: number; game?: { pendingChoice?: unknown } } } };
    };
    const state = appSession().store.state;
    return JSON.stringify({ version: state.version, pending: state.game?.pendingChoice ?? null });
  });

async function openFixture(page: Page): Promise<void> {
  await installPad(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&fixture=work-life-ally");
  await waitFor(async () => ((await noticeUp(page)) ? true : null), "the only-option notice opens", 120_000);
  await settle(page, { quietMs: 500, maxMs: 4000 });
  await padWake(page);
  await settle(page, { quietMs: 300, maxMs: 2000 });
}

for (const [name, press] of [
  ["A", (page: Page) => padTap(page, PAD.a)],
  ["B", (page: Page) => padTap(page, PAD.b)],
  ["Start", (page: Page) => padTap(page, PAD.start)],
  ["Esc", (page: Page) => page.keyboard.press("Escape")],
] as const) {
  test(`over the choice sheet: ${name} closes the notice, the sheet keeps focus and nothing under it fires`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await openFixture(page);

    // OK has the ring at once and wears A and Start (a pad is in use).
    expect(await noticeFocus(page), "OK is focused on open").toBe("ok");
    const rect = (await okRect(page))!;
    expect(rect).not.toBeNull();
    expect(await glyphIn(page, NOTICE, "A", rect), "A on OK").toBe(true);
    expect(await glyphIn(page, NOTICE, "Menu", rect), "Start (Menu on an Xbox pad) on OK").toBe(true);
    await page.screenshot({ path: "../../artifacts/qa/notice-pad-glyphs.png" });

    const before = await engine(page);
    const focusBefore = await sheetFocus(page);
    await press(page);
    await waitFor(async () => ((await noticeUp(page)) ? null : true), `${name} closes the notice`, 10_000);
    await settle(page, { quietMs: 400, maxMs: 2000 });

    const scenes = await activeScenes(page);
    expect(scenes, `${name} left the choice sheet up`).toContain("ChoiceOverlay");
    expect(scenes, `${name} opened Pause`).not.toContain("PauseOverlay");
    expect(scenes, `${name} opened Inspect`).not.toContain("InspectOverlay");
    expect(await engine(page), `${name} reached the game under the notice`).toBe(before);
    expect(await sheetFocus(page), `${name} left the sheet's focus alone`).toBe(focusBefore);

    // Focus is back with the sheet: its own pad step now answers, where the notice owned it a moment ago.
    await padTap(page, PAD.down);
    expect(await sheetFocus(page), "the sheet moves again").not.toBeNull();
    expect(await engine(page)).toBe(before);
    expect(errors).toEqual([]);
  });
}

test("over the Board: A, B and Start close the notice, the Board keeps its focus and takes none of the presses", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await openFixture(page);
  // Take the waiting ally pick off the table, so the Board is bare under the notice.
  await padTap(page, PAD.b);
  await waitFor(async () => ((await noticeUp(page)) ? null : true), "the first notice closes", 10_000);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          state: { game?: { pendingChoice?: { options: { optionId: string }[] } } };
          resolveChoice: (ids: string[]) => Promise<void>;
        };
      };
    };
    const store = appSession().store;
    const options = store.state.game?.pendingChoice?.options ?? [];
    if (options[0]) await store.resolveChoice([options[0].optionId]);
  });
  await waitFor(
    async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? null : true),
    "the sheet closes",
    15_000,
  );
  await settle(page, { quietMs: 500, maxMs: 4000 });

  for (const [name, button] of [
    ["A", PAD.a],
    ["B", PAD.b],
    ["Start", PAD.start],
  ] as const) {
    // A step puts the ring on a Board stop; the notice is then launched over it.
    await padTap(page, PAD.right);
    const focus = await boardFocus(page);
    expect(focus, "the Board has a focused stop").not.toBeNull();
    const before = await engine(page);
    await page.evaluate((key) => {
      const game = (window as unknown as { __mcGame: { scene: { run: (k: string, d: unknown) => void } } }).__mcGame;
      game.scene.run(key, {
        notices: [
          {
            title: "Test notice",
            rows: [
              { kind: "taken", label: "Take this" },
              { kind: "unavailable", label: "Not this", why: "no reason" },
            ],
          },
        ],
      });
    }, NOTICE);
    await waitFor(async () => ((await noticeUp(page)) ? true : null), "the notice opens", 10_000);
    await settle(page, { quietMs: 400, maxMs: 2000 });
    expect(await noticeFocus(page)).toBe("ok");
    await padTap(page, button);
    await waitFor(async () => ((await noticeUp(page)) ? null : true), `${name} closes the notice`, 10_000);
    await settle(page, { quietMs: 400, maxMs: 2000 });
    const scenes = await activeScenes(page);
    expect(scenes, `${name} opened Pause`).not.toContain("PauseOverlay");
    expect(scenes, `${name} opened Inspect`).not.toContain("InspectOverlay");
    expect(await engine(page), `${name} reached the game under the notice`).toBe(before);
    expect(await boardFocus(page), `${name}: the Board keeps its focus`).toBe(focus);
    // The Board answers the pad again.
    await padTap(page, PAD.left);
    expect(await engine(page)).toBe(before);
  }
  expect(errors).toEqual([]);
});
