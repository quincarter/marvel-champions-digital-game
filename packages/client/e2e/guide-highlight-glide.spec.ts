import { expect, test, type Page } from "@playwright/test";
import {
  activeScenes,
  clickFocus,
  clickHandCard,
  clickText,
  focusRect,
  guideStepId,
  installPageHelpers,
  pressAt,
  pressKey,
  pressUntil,
  settle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";
import { answerChoice, hook, openApp, startMechanicLesson, type Rect } from "./wave6-helpers-b.js";

/**
 * The guide's highlight glides to each new target (#552): the ring passes through the space between the old target and
 * the new one instead of jumping, lands exactly on the new one, and Reduced motion keeps the jump. The Inspect sheet's
 * own stamp flies in from the highlight, every time the sheet opens.
 */

const highlight = (page: Page): Promise<Rect | null> => hook<Rect>(page, "__mcBoardDebug", "guideHighlightRect");
const anchor = (page: Page): Promise<Rect | null> => hook<Rect>(page, "__mcBoardDebug", "guideAnchorRect");

/** Records the highlight's x every animation frame, until `stopSampling`. */
const startSampling = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const w = window as unknown as {
      __mcBoardDebug: { guideHighlightRect(): { x: number } | null };
      __glideXs: number[];
      __glideOn: boolean;
    };
    w.__glideXs = [];
    w.__glideOn = true;
    const sample = (): void => {
      const rect = w.__mcBoardDebug.guideHighlightRect();
      if (rect) w.__glideXs.push(rect.x);
      if (w.__glideOn) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

const stopSampling = (page: Page): Promise<number[]> =>
  page.evaluate(() => {
    const w = window as unknown as { __glideXs: number[]; __glideOn: boolean };
    w.__glideOn = false;
    return w.__glideXs;
  });

/** Opens Rogue's Try it on its flip step, ring on the Flip button, then flips and records the ring moving on. */
async function flipAndSample(page: Page): Promise<{ from: number; to: number; xs: number[] }> {
  await openApp(page);
  await startMechanicLesson(page, "rogue");
  await clickText(page, "Got it", { sceneKey: "Board" });
  const flip = await waitFor(
    async () => {
      const button = await focusRect(page, "basic:changeForm");
      const ring = await highlight(page);
      return (await guideStepId(page)) === "flip" && button && ring?.x === button.x ? ring : null;
    },
    "the highlight lands on the Flip button",
    20000,
  );
  await settle(page);
  await startSampling(page);
  await clickFocus(page, "basic:changeForm");
  await waitFor(
    async () => {
      if ((await activeScenes(page)).includes("ChoiceOverlay")) await answerChoice(page, 0);
      return (await guideStepId(page)) !== "flip" ? true : null;
    },
    "the step after flip",
    30000,
  );
  const landed = await waitFor(
    async () => {
      const ring = await highlight(page);
      const target = await anchor(page);
      return ring && target && ring.x === target.x ? ring : null;
    },
    "the highlight lands on the next target",
    20000,
  );
  return { from: flip.x, to: landed.x, xs: await stopSampling(page) };
}

const between = (xs: number[], from: number, to: number): number[] => {
  const [low, high] = [Math.min(from, to) + 1, Math.max(from, to) - 1];
  return [...new Set(xs.filter((x) => x > low && x < high))];
};

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the ring glides from the Flip button to the next target", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    const { from, to, xs } = await flipAndSample(page);
    expect(from, "the two targets are apart").not.toBe(to);
    expect(between(xs, from, to).length, "several frames between the targets").toBeGreaterThan(3);
    expect(xs.at(-1), "it lands exactly").toBe(to);
    expect(errors).toEqual([]);
  });
});

/** Justice's Try it on a phone, ring on Daredevil in the hand. */
async function startJusticeOnPhone(page: Page): Promise<void> {
  await installPageHelpers(page);
  await page.goto("/?screen=aspect&aspect=justice");
  const tryIt = (): Promise<Rect | null | undefined> =>
    page.evaluate(() =>
      (
        window as unknown as { __mcAspectLessonDebug?: { tryItRect: () => Rect | null } }
      ).__mcAspectLessonDebug?.tryItRect(),
    );
  await pressUntil(
    page,
    async () => {
      await waitFor(tryIt, "Try it button");
      await settle(page, { quietMs: 200, maxMs: 1500 });
      const rect = await waitFor(tryIt, "Try it button");
      await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
    },
    async () => (await guideStepId(page)) === "intro",
    "Try it starts the game",
  );
  await pressUntil(
    page,
    () => clickText(page, "Got it", { sceneKey: "Board", timeoutMs: 2000 }).catch(() => undefined),
    async () => (await guideStepId(page)) === "play-signature",
    "Got it moves on",
  );
  await waitFor(() => highlight(page), "the ring is up", 20000);
  await settle(page);
}

/** Opens Inspect on Daredevil and records the stamp's x every frame until it lands. */
async function openAndSampleStamp(page: Page): Promise<number[]> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __mcInspectDebug?: { guideStampRect(): { x: number } | null };
      __stampXs: number[];
      __stampOn: boolean;
    };
    w.__stampXs = [];
    w.__stampOn = true;
    const sample = (): void => {
      const rect = w.__mcInspectDebug?.guideStampRect();
      if (rect) w.__stampXs.push(rect.x);
      if (w.__stampOn) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await clickHandCard(page, "01058");
  await waitFor(
    async () => ((await hook<Rect>(page, "__mcInspectDebug", "playRect")) ? true : null),
    "the sheet's Play button",
    8000,
  );
  await page.waitForTimeout(1000);
  return page.evaluate(() => {
    const w = window as unknown as { __stampXs: number[]; __stampOn: boolean };
    w.__stampOn = false;
    return w.__stampXs;
  });
}

test.describe("Inspect's stamp, on a phone, with motion", () => {
  test.use({ reducedMotion: "no-preference", viewport: { width: 390, height: 844 } });

  test("flies in from the hand card each time the sheet opens", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    await startJusticeOnPhone(page);
    for (const opening of ["first", "second"]) {
      const xs = await openAndSampleStamp(page);
      expect(new Set(xs).size, `the ${opening} opening moves through several frames`).toBeGreaterThan(3);
      await pressKey(page, "Escape");
      await waitFor(
        async () => ((await activeScenes(page)).includes("InspectOverlay") ? null : true),
        "Inspect closes",
      );
      await settle(page);
    }
    expect(errors).toEqual([]);
  });
});

test.describe("with Reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the ring goes straight to the next target", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    const { from, to, xs } = await flipAndSample(page);
    expect(between(xs, from, to), "nothing between the targets").toEqual([]);
    expect(errors).toEqual([]);
  });
});
