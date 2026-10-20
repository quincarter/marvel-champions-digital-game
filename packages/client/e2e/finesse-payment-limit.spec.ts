import { expect, test, type Page } from "@playwright/test";
import { activeScenes, hasText, pressUntil, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOTS, startOnBoard } from "./qa-wave10-recheck-helpers.js";
import { bringIntoView, facts, playFromHand, press } from "./x-men-helpers.js";
import { focusRect } from "./helpers.js";

/**
 * Issue #292: Finesse ("Hero Resource: Exhaust Finesse → generate a [wild] resource for an aspect card") can't pay for
 * Self-Propelled Glide, a Spider-Woman hero card that shows no aspect. The payment strip still shows Finesse, washed out
 * and tagged "can't pay", the bar says what it pays for, and a tap on it opens Inspect, which explains; nothing is
 * spent. The pause menu's table rules list "Aspect card". Phone first, then desktop.
 */
const SIZES = [
  { name: "phone-390x844", width: 390, height: 844, touch: true },
  { name: "desktop-1440x900", width: 1440, height: 900, touch: false },
] as const;

const FINESSE = "04033";
const GLIDE = "04039";
// Energy and Genius pay for Finesse; Strength and Interrogation Room stay to pay for Glide.
const HAND = [FINESSE, GLIDE, "04050", "04051", "04052", "04048"];

interface BoardDebug {
  paymentView(): {
    tableSources: {
      instanceId: string;
      notFor?: true;
      spent: boolean;
      lockedReason: string | null;
      optionId: string;
    }[];
    lockedNote: string | null;
  } | null;
}
const paymentView = (page: Page) =>
  page.evaluate(() => (window as unknown as { __mcBoardDebug?: BoardDebug }).__mcBoardDebug?.paymentView() ?? null);

/** Spider-Woman in hero form with Finesse in play, paid with Energy and Genius, and Glide in hand. */
async function stage(page: Page): Promise<{ finesse: string; glide: string }> {
  await installWave6Helpers(page);
  await openApp(page);
  await startOnBoard(page, {
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "spider-woman-aggression-justice" }],
    seed: 292,
    stack: { players: { 0: HAND } },
  });
  await page.evaluate(async () => {
    type Legal = { action: { kind: string; instanceId?: string }; example: Record<string, unknown> };
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          dispatch: (c: unknown) => Promise<void>;
          state: {
            game?: { players: { hand: string[] }[]; instances: Record<string, { cardId: string }> };
            legal?: { actions: { legal?: Legal[] } };
          };
        };
      };
    };
    const { store } = appSession();
    const flip = store.state.legal?.actions.legal?.find((e) => e.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
    const game = store.state.game!;
    const of = (code: string) => game.players[0]!.hand.find((id) => game.instances[id]?.cardId === code)!;
    const play = store.state.legal?.actions.legal?.find(
      (e) => e.action.kind === "playCard" && e.action.instanceId === of("04033"),
    );
    await store.dispatch({ ...play!.example, payment: [{ fromHand: of("04050") }, { fromHand: of("04051") }] });
  });
  await settle(page, { quietMs: 800, maxMs: 4000 });
  const ids = await facts(page, (game) => {
    const find = (code: string, list: string[]) => list.find((id) => game.instances[id]?.cardId === code)!;
    const all = Object.keys(game.instances) as string[];
    return { finesse: find("04033", all), glide: find("04039", game.players[0].hand as string[]) };
  });
  return ids;
}

for (const size of SIZES) {
  test.describe(`Finesse's payment limit at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.touch });

    test("the strip shows Finesse as unable to pay for Glide, and Inspect and the rules say why", async ({ page }) => {
      test.setTimeout(240_000);
      const { finesse, glide } = await stage(page);

      await playFromHand(page, size.touch, glide, async () => (await paymentView(page)) !== null);
      await settle(page, { quietMs: 400, maxMs: 2000 });
      const view = (await paymentView(page))!;
      const tile = view.tableSources.find((source) => source.instanceId === finesse);
      expect(tile, "Finesse is in the strip").toBeDefined();
      expect(tile!.notFor).toBe(true);
      expect(tile!.lockedReason).toMatch(/^Pays only for an aspect card/);
      expect(view.lockedNote).toMatch(/^Finesse: Pays only for an aspect card/);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/finesse-strip-${size.name}.png` });

      // A tap on the tile opens Finesse's card instead of spending it.
      await bringIntoView(page, `payment:${tile!.optionId}`);
      const rect = (await focusRect(page, `payment:${tile!.optionId}`))!;
      await pressUntil(
        page,
        () => press(page, size.touch, rect.x + rect.width / 2, rect.y + rect.height / 2),
        async () => (await activeScenes(page)).includes("InspectOverlay"),
        "a tap on Finesse's tile opens Inspect",
      );
      await settle(page, { quietMs: 400, maxMs: 2000 });
      expect(await hasText(page, "It pays only for an aspect card", "InspectOverlay")).toBe(true);
      expect(await hasText(page, "It can't pay for Self-Propelled Glide", "InspectOverlay")).toBe(true);
      expect((await paymentView(page))?.tableSources.find((s) => s.instanceId === finesse)?.spent).toBe(false);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/finesse-inspect-${size.name}.png` });

      await page.keyboard.press("Escape");
      await waitFor(
        async () => (!(await activeScenes(page)).includes("InspectOverlay") ? true : null),
        "Inspect closes",
      );
      await settle(page);

      // The glossary the pause menu shows for this table lists "Aspect card".
      const names = await page.evaluate(async () => {
        const { appSession } = (await import("/src/session.ts")) as unknown as {
          appSession: () => { store: { state: { game: unknown } } };
        };
        const { rulesGlossaryOf } = (await import("/src/view/rules-reference.ts")) as unknown as {
          rulesGlossaryOf: (game: unknown, deps: unknown) => { displayName: string }[];
        };
        const { POOL_DEPS } = (await import("/src/content/pool.ts")) as unknown as { POOL_DEPS: unknown };
        return rulesGlossaryOf(appSession().store.state.game, POOL_DEPS).map((entry) => entry.displayName);
      });
      expect(names).toContain("Aspect card");

      // The desktop's pause menu draws that glossary beside its buttons.
      if (!size.touch) {
        await page.keyboard.press("Escape"); // leave the payment
        await settle(page);
        await pressUntil(
          page,
          () => page.mouse.click(size.width - 35, 22),
          async () => (await activeScenes(page)).includes("PauseOverlay"),
          "the menu control opens Pause",
        );
        await settle(page, { quietMs: 400, maxMs: 2000 });
        expect(await hasText(page, "Aspect card", "PauseOverlay")).toBe(true);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/finesse-pause-rules-${size.name}.png` });
      }
    });
  });
}
