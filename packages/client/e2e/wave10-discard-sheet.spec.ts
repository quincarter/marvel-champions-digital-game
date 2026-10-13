import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickFocus, findText, pressAt, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { answerChoice, declineMulligans, openApp, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Wave 10 click-through F2 and F3: Tigra's alter-ego holds 7 cards, so flipping to hero form (hand size 5) and ending
 * the turn raises "discard to hand size" over seven cards. The sheet lays every card out whole and tappable on a phone,
 * and says plainly that two is the least to discard (RRG 1.8 "End of Player Phase", p. 18: any number, then down to
 * hand size). Setup goes through the store; the taps and Confirm are real input.
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

const optionRects = (page: Page): Promise<[string, Rect][]> =>
  page.evaluate(() =>
    (
      (window as unknown as { __mcChoiceDebug?: { allRects(): [string, Rect][] } }).__mcChoiceDebug?.allRects() ?? []
    ).filter(([key]) => key.startsWith("option:")),
  );

test("discard to hand size with seven cards: every card whole and tappable, and the count says 'at least'", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
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

  const shown = async (text: string): Promise<boolean> => (await findText(page, text, "ChoiceOverlay")).length > 0;
  expect(await shown("Discard at least 2 (hand size 5)"), "the title names the floor and the hand size").toBe(true);
  expect(await shown("select at least 2 · you may discard more"), "the count says more may go").toBe(true);

  const rects = await optionRects(page);
  expect(rects).toHaveLength(7);
  const size = page.viewportSize()!;
  for (const [key, r] of rects) {
    expect(r.width, `${key} is wide enough to tap`).toBeGreaterThanOrEqual(44);
    expect(r.x, `${key} is on screen`).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width, `${key} is on screen`).toBeLessThanOrEqual(size.width);
    expect(r.y + r.height, `${key} is on screen`).toBeLessThanOrEqual(size.height);
  }
  if (SHOT) await page.screenshot({ path: `${SHOT}/wave10-fix-f2-${info.project.name}.png` });

  // Two taps, and the count line follows. The sheet re-lays its cards after a pick, so the next card's rect is read fresh.
  const ids = rects.slice(0, 2).map(([key]) => key);
  for (const [i, id] of ids.entries()) {
    await settle(page);
    const r = (await optionRects(page)).find(([key]) => key === id)?.[1];
    if (!r) throw new Error(`no rect for ${id}`);
    await pressAt(page, r.x + r.width / 2, r.y + r.height / 2, { verify: false });
    await waitFor(async () => ((await shown(`selected ${i + 1}`)) ? true : null), `pick ${i + 1} registers`, 5000);
  }
  expect(errors).toEqual([]);
});
