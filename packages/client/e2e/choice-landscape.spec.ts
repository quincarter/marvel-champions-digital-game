import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickFocus, findText, pressAt, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { answerChoice, declineMulligans, openApp, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * A decision sheet on a phone held sideways (844x390, 997x448; portrait 390x844 as the control): the options area scrolls when the cards do not fit, the
 * sheet never says "resize to see them", and the last option can be reached and picked. The end-of-turn discard sheet
 * (Tigra flipped to hero form with seven cards, as in `wave10-discard-sheet.spec.ts`) is the multi-select; for the
 * scrolling case the page pads its options to twelve (the choice object is plain data, and only the picking is under
 * test), then a resize redraws the sheet.
 */
async function setup(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (cfg: unknown) => Promise<void> } };
    };
    await appSession().store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "tigra-aggression" }],
      seed: 5607,
    });
    const scenes = (
      window as unknown as {
        __mcGame: {
          scene: {
            getScenes: (a: boolean) => { sys: { settings: { key: string } } }[];
            stop: (k: string) => void;
            start: (k: string) => void;
          };
        };
      }
    ).__mcGame.scene;
    for (const s of scenes.getScenes(true)) scenes.stop(s.sys.settings.key);
    scenes.start("Board");
  });
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "Board is up", 20000);
  await settle(page);
  await declineMulligans(page);
  await settle(page);
  // Undercover Work (alter-ego) adds Hunted to the 6-card hand: seven cards, then the flip to a hand size of 5.
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          dispatch: (c: unknown) => Promise<void>;
          state: {
            legal?: { actions: { legal?: { action: { kind: string; abilityId?: string }; example: unknown }[] } };
          };
        };
      };
    };
    const { store } = appSession();
    const work = store.state.legal?.actions.legal?.find(
      (e) => e.action.kind === "useAbility" && e.action.abilityId?.includes("undercover-work"),
    );
    if (work) await store.dispatch(work.example);
  });
  await answerChoice(page, 0);
  await settle(page);
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          dispatch: (c: unknown) => Promise<void>;
          state: { legal?: { actions: { legal?: { action: { kind: string }; example: unknown }[] } } };
        };
      };
    };
    const { store } = appSession();
    const flip = store.state.legal?.actions.legal?.find((e) => e.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  });
  await settle(page);
}

const optionRects = (page: Page): Promise<[string, Rect | null][]> =>
  page.evaluate(() =>
    (
      (
        window as unknown as { __mcChoiceDebug?: { allRects(): [string, Rect | null][] } }
      ).__mcChoiceDebug?.allRects() ?? []
    ).filter(([key]) => key.startsWith("option:")),
  );

async function openDiscardSheet(page: Page): Promise<void> {
  await installWave6Helpers(page);
  await openApp(page);
  await setup(page);
  await clickFocus(page, "basic:endTurn");
  await waitFor(
    async () => {
      const scenes = await activeScenes(page);
      if (scenes.includes("EndTurnConfirmOverlay")) {
        const rect = await page.evaluate(
          () =>
            (
              window as unknown as { __mcEndTurnConfirmDebug?: { endRect(): Rect } }
            ).__mcEndTurnConfirmDebug?.endRect() ?? null,
        );
        if (rect) await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
        return null;
      }
      return scenes.includes("ChoiceOverlay") ? true : null;
    },
    "the discard sheet",
    30000,
  );
  await settle(page);
}

for (const [width, height] of [
  [844, 390],
  [997, 448],
  [390, 844],
] as const) {
  test.describe(`${width}x${height}`, () => {
    test.use({ viewport: { width, height } });

    test("seven cards: all whole inside the screen, nothing says resize", async ({ page }) => {
      test.setTimeout(240_000);
      const errors = trackErrors(page);
      await openDiscardSheet(page);
      expect((await findText(page, "resize to see", "ChoiceOverlay")).length).toBe(0);
      const rects = (await optionRects(page)).filter((r): r is [string, Rect] => r[1] !== null);
      expect(rects).toHaveLength(7);
      for (const [key, r] of rects) {
        expect(r.width, `${key} is wide enough to tap`).toBeGreaterThanOrEqual(44);
        expect(r.height, `${key} is tall enough to tap`).toBeGreaterThanOrEqual(44);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(width);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.y + r.height, `${key} is on screen`).toBeLessThanOrEqual(height);
      }
      if (SHOT) await page.screenshot({ path: `${SHOT}/choice-landscape-${width}x${height}-7.png` });
      expect(errors).toEqual([]);
    });

    test("twelve cards scroll, and the last can be scrolled to and picked", async ({ page }) => {
      test.setTimeout(240_000);
      const errors = trackErrors(page);
      await openDiscardSheet(page);
      await page.evaluate(async () => {
        const { appSession } = (await import("/src/session.ts")) as unknown as {
          appSession: () => { store: { state: { game?: { pendingChoice?: { options: Record<string, unknown>[] } } } } };
        };
        const choice = appSession().store.state.game!.pendingChoice!;
        const base = choice.options.length;
        for (let i = 0; base + i < 12; i++) {
          const from = choice.options[i % base]!;
          choice.options.push({ ...from, optionId: `${String(from.optionId)}-extra${i}` });
        }
        window.dispatchEvent(new Event("resize"));
      });
      await settle(page);
      expect((await findText(page, "resize to see", "ChoiceOverlay")).length).toBe(0);
      const all = await optionRects(page);
      expect(all).toHaveLength(12);
      const lastKey = all.at(-1)![0];
      const area = { top: 0, bottom: height };
      // Scrolled to the top, the last card is below the screen or under the buttons; the wheel brings it into view.
      const first = all[0]![1]!;
      await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
      if (SHOT) await page.screenshot({ path: `${SHOT}/choice-landscape-${width}x${height}-12-top.png` });
      let last: Rect | null = null;
      for (let i = 0; i < 12 && !last; i++) {
        await page.mouse.wheel(0, 200);
        await settle(page);
        const now = (await optionRects(page)).find(([key]) => key === lastKey)![1]!;
        if (now.y >= area.top && now.y + now.height <= height - 60) last = now;
      }
      expect(last, "the last card scrolled into view").not.toBeNull();
      expect(last!.width).toBeGreaterThanOrEqual(44);
      if (SHOT) await page.screenshot({ path: `${SHOT}/choice-landscape-${width}x${height}-12-end.png` });
      await pressAt(page, last!.x + last!.width / 2, last!.y + last!.height / 2, { verify: false });
      await waitFor(
        async () => ((await findText(page, "selected 1", "ChoiceOverlay")).length > 0 ? true : null),
        "the last card is picked",
        5000,
      );
      expect(errors).toEqual([]);
    });
  });
}
