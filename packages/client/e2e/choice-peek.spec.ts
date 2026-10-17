import { expect, test, type Page } from "@playwright/test";
import { pressAt, settle, waitFor } from "./helpers.js";
import { answerChoiceSheet, installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #231, the owner's follow-up: a decision in the player's own turn (She-Hulk's "Do You Even Lift?" target, here
 * Crimson Bands of Cyttorak's) covered the table, so the player could not look it over before choosing. PEEK AT TABLE
 * steps the sheet aside for a banner at the foot of the screen; BACK TO DECISION brings it back. Played from the
 * `?screen=choice` jump: a real Doctor Strange game paused on Crimson Bands' "choose a target".
 */

interface PeekDebug {
  peeking(): boolean;
  peekRect(): Rect | null;
  backRect(): Rect | null;
  bannerRect(): Rect | null;
}

const peekDebug = <K extends keyof PeekDebug>(page: Page, name: K): Promise<ReturnType<PeekDebug[K]> | null> =>
  page.evaluate(
    (n) =>
      ((window as unknown as { __mcChoicePeekDebug?: Record<string, () => unknown> }).__mcChoicePeekDebug?.[n]?.() ??
        null) as never,
    name,
  );

const sheetOptionCount = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const dbg = (window as unknown as { __mcChoiceDebug?: { allRects(): (readonly [string, unknown])[] } })
      .__mcChoiceDebug;
    return (dbg?.allRects() ?? []).filter(([key]) => key.startsWith("option:")).length;
  });

const press = async (page: Page, phone: boolean, rect: Rect): Promise<void> => {
  await settle(page);
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (phone) await page.touchscreen.tap(x, y);
  else await pressAt(page, x, y);
  await settle(page);
};

async function openSheet(page: Page): Promise<Rect> {
  await installWave6Helpers(page);
  await page.goto("/?screen=choice");
  const peek = await waitFor(() => peekDebug(page, "peekRect"), "PEEK AT TABLE on the sheet", 30_000);
  await waitFor(async () => ((await sheetOptionCount(page)) > 0 ? true : null), "the sheet's options", 10_000);
  return peek;
}

test("PEEK AT TABLE steps the decision sheet aside for a banner, and BACK TO DECISION brings it back to answer", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  const peek = await openSheet(page);
  if (SHOT) await page.screenshot({ path: `${SHOT}/choice-peek-sheet-${info.project.name}.png` });

  await press(page, phone, peek);
  await waitFor(async () => ((await peekDebug(page, "peeking")) ? true : null), "peeking at the table", 10_000);
  expect(await sheetOptionCount(page), "the sheet's options are gone with it").toBe(0);
  const banner = (await peekDebug(page, "bannerRect"))!;
  const size = page.viewportSize()!;
  expect(banner.y + banner.height, "the banner sits at the foot of the screen").toBeGreaterThan(size.height - 120);
  if (SHOT) await page.screenshot({ path: `${SHOT}/choice-peek-peeking-${info.project.name}.png` });

  await press(page, phone, (await peekDebug(page, "backRect"))!);
  await waitFor(async () => ((await peekDebug(page, "peeking")) ? null : true), "back to the decision", 10_000);
  await waitFor(async () => ((await sheetOptionCount(page)) > 0 ? true : null), "the sheet's options back", 10_000);
  await answerChoiceSheet(page);
  expect(errors).toEqual([]);
});

test("a swipe that lifts on PEEK AT TABLE leaves the sheet up", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a finger's swipe is a phone's");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  const peek = await openSheet(page);
  const y = peek.y + peek.height / 2;
  const from = { x: peek.x + peek.width / 2, y: y - 220 };
  const to = { x: peek.x + peek.width / 2, y };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 10; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x, y: from.y + ((to.y - from.y) * i) / 10, id: 1 }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await settle(page);
  expect(await peekDebug(page, "peeking"), "a swipe that lifted on PEEK AT TABLE peeked at nothing").toBe(false);
  expect(errors).toEqual([]);
});

test("peeking on desktop, the table's cards open their hover popover", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "hover is a mouse's");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await press(page, false, await openSheet(page));
  await waitFor(async () => ((await peekDebug(page, "peeking")) ? true : null), "peeking at the table", 10_000);
  const target = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game?: { players: { hand: string[] }[] } } } };
    };
    const hand = appSession().store.state.game?.players[0]?.hand ?? [];
    const dbg = (window as unknown as { __mcBoardDebug?: { hitRect(id: string): Rect | null } }).__mcBoardDebug;
    for (const id of hand) {
      const rect = dbg?.hitRect(id) ?? null;
      if (rect) return { id, rect };
    }
    return null;
  });
  expect(target, "a hand card on the table").not.toBeNull();
  const x = target!.rect.x + target!.rect.width / 2;
  const y = target!.rect.y + 30;
  await page.mouse.move(x, y);
  await page.mouse.move(x + 4, y + 4, { steps: 4 });
  const shown = await waitFor(
    () =>
      page.evaluate(
        () =>
          (window as unknown as { __mcBoardDebug?: { hoverShown(): string | null } }).__mcBoardDebug?.hoverShown() ??
          null,
      ),
    "the table's hover popover",
    10_000,
  );
  expect(shown).toContain(target!.id);
  if (SHOT) await page.screenshot({ path: `${SHOT}/choice-peek-hover-desktop.png` });
  expect(errors).toEqual([]);
});
