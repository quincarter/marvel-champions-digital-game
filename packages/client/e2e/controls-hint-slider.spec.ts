import { expect, test, type Page } from "@playwright/test";
import { settle, tapAt, trackPageErrors, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp, type Rect } from "./wave6-helpers-b.js";

/**
 * The Hint size slider sits inside Controls' scroll region (no tap on finger lift, issue #227 rule). On a phone a swipe
 * that starts elsewhere and lifts over the slider's track, its "-" or its "+" must change nothing; a tap on "+" steps
 * the size by 5.
 */

interface SliderRects {
  track: Rect;
  down: Rect;
  up: Rect;
  percent: Rect;
  viewport: Rect;
}

const sliderRects = (page: Page): Promise<SliderRects | null> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __mcControlsDebug?: { hintSlider(): SliderRects | null } }
      ).__mcControlsDebug?.hintSlider() ?? null,
  );

const glyphSize = (page: Page): Promise<number> =>
  page.evaluate(async () => {
    const mod = (await import("/src/session.ts")) as unknown as {
      appSession: () => { settings: { glyphSize: number } };
    };
    return mod.appSession().settings.glyphSize;
  });

const centre = (r: Rect): { x: number; y: number } => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** A real touch path (CDP), lifted at the last point. */
async function touchPath(page: Page, points: readonly { x: number; y: number }[]): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const [first, ...rest] = points;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...first!, id: 1 }] });
  for (const p of rest)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...p, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** A sideways swipe at one height, in `steps` moves, from `from` to `to`. */
function across(from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  return Array.from({ length: steps + 1 }, (_, i) => ({
    x: from.x + ((to.x - from.x) * i) / steps,
    y: from.y + ((to.y - from.y) * i) / steps,
  }));
}

test("a phone swipe that lifts over the Hint size slider changes nothing; a tap on + steps it", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the finger-lift rule is a phone rule");
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await installWave6Helpers(page);
  await openApp(page, "unlock=all&screen=controls", { landing: "ControlsOverlay" });
  await waitFor(() => sliderRects(page), "the Hint size slider is drawn", 15_000);
  await page.evaluate(() =>
    (window as unknown as { __mcControlsDebug: { revealHintSlider(): void } }).__mcControlsDebug.revealHintSlider(),
  );
  await settle(page, { quietMs: 300, maxMs: 2000 });

  const rects = (await sliderRects(page))!;
  const { viewport } = rects;
  for (const part of [rects.track, rects.down, rects.up]) {
    expect(part.y, "the slider is inside the scroll region").toBeGreaterThanOrEqual(viewport.y);
    expect(part.y + part.height).toBeLessThanOrEqual(viewport.y + viewport.height);
  }
  const before = await glyphSize(page);

  // Start on the percent label (inside the region, on no control) and swipe sideways, at the slider's own height,
  // to lift over the track, the "-" and the "+". The content cannot move up or down, so the lift is truly over them.
  const start = centre(rects.percent);
  for (const [name, target] of [
    ["track", centre(rects.track)],
    ["-", centre(rects.down)],
    ["+", centre(rects.up)],
  ] as const) {
    await touchPath(page, across(start, target));
    await settle(page, { quietMs: 200, maxMs: 1000 });
    expect(await glyphSize(page), `a swipe that lifted on the ${name} changes nothing`).toBe(before);
  }

  // A vertical drag that begins on the track is the list's scroll: back where it began, it changes nothing either.
  const mid = centre((await sliderRects(page))!.track);
  await touchPath(page, [
    mid,
    { x: mid.x, y: mid.y - 10 },
    { x: mid.x, y: mid.y - 20 },
    { x: mid.x, y: mid.y - 10 },
    mid,
  ]);
  await settle(page, { quietMs: 200, maxMs: 1000 });
  expect(await glyphSize(page), "a scroll that lifts back on the track changes nothing").toBe(before);

  // A real tap on "+" steps the size by 5.
  const plus = centre((await sliderRects(page))!.up);
  await tapAt(page, plus.x, plus.y);
  await waitFor(async () => ((await glyphSize(page)) !== before ? true : null), "a tap on + changes the size", 10_000);
  expect(await glyphSize(page)).toBe(before + 5);
  expect(errors).toEqual([]);
});
