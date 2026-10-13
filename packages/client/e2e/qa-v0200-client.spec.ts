import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, focusRect, handInstanceFor, rectsOverlap, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { declineMulligans, openApp } from "./wave6-helpers-b.js";
import { boardText, boardUp, facts, playFromHand } from "./x-men-helpers.js";

/**
 * Two findings from the v0.20.0 client QA (docs/qa-v0.20.0-client.md), each pinned with `test.fail()`: delete the
 * marker when the finding is fixed.
 * - The pay step's X stepper has its "+" under the Pay button on a 390 px phone, so X cannot be raised there.
 * - Z (and the Undo button) while a payment is open cancels the payment and also takes back the move before it.
 * Wonder Man's starter deck against Rhino, as `x-cost.spec.ts` and `wonder-man-overpay.spec.ts` set it up.
 */

async function start(
  page: Page,
  hand: readonly string[] = ["58017", "58023", "58016", "58004", "58003", "58018", "58009"],
): Promise<void> {
  await installWave6Helpers(page);
  await openApp(page);
  await page.evaluate(async (stackCodes) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (cfg: unknown) => Promise<void> } };
    };
    await appSession().store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "wonder-man-justice" }],
      seed: 5802,
      stack: {
        players: { 0: [...stackCodes] },
        encounter: ["01098", "01109"],
      },
    });
    const game = (window as unknown as { __mcGame: { scene: any } }).__mcGame;
    for (const s of game.scene.getScenes(true)) game.scene.stop(s.sys.settings.key);
    game.scene.start("Board");
  }, hand);
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "Board is up", 20000);
  await settle(page);
  await declineMulligans(page);
  await boardUp(page);
}

const dispatchKind = (page: Page, kind: string): Promise<boolean> =>
  page.evaluate(async (k) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: any; dispatch: (c: unknown) => Promise<unknown> } };
    };
    const { store } = appSession();
    const entry = store.state.legal?.actions.legal?.find((e: any) => e.action.kind === k);
    if (entry) await store.dispatch(entry.example);
    return Boolean(entry);
  }, kind);

test.describe("v0.20.0 client QA findings", () => {
  test.describe("phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    test("the X stepper's plus is clear of the Pay button on a phone", async ({ page }) => {
      test.fail();
      test.setTimeout(240_000);
      await start(page);
      await dispatchKind(page, "changeForm");
      await page.evaluate(async () => {
        const { appSession } = (await import("/src/session.ts")) as any;
        const { nextTurn } = (await import("/src/store/dev-game-steps.ts")) as any;
        const { store } = appSession();
        for (let round = 0; round < 2; round++) {
          const end = store.state.legal?.actions.legal?.find((e: any) => e.action.kind === "endTurn");
          await store.dispatch(end.example);
          await nextTurn(store);
        }
      });
      for (let i = 0; i < 6 && (await activeScenes(page)).includes("VillainPhaseOverlay"); i++) {
        await clickText(page, "Continue", { sceneKey: "VillainPhaseOverlay" });
        await settle(page);
      }
      const everywhere = (await handInstanceFor(page, "58018"))!;
      await playFromHand(page, true, everywhere, async () => (await boardText(page, /^PAYING/i)) !== undefined);
      await settle(page);
      const more = await focusRect(page, "xMore");
      const pay = await focusRect(page, "payment:pay");
      expect(more, "the X stepper is on the bar").not.toBeNull();
      expect(pay, "Pay is on the bar").not.toBeNull();
      expect(rectsOverlap(more, pay), "the stepper's plus is covered by Pay").toBe(false);
    });
  });

  test("Z with a payment open does not also take back the move before it", async ({ page }) => {
    test.fail();
    test.setTimeout(240_000);
    await start(page, ["58009", "58003", "58023", "58004", "58016", "58017"]);
    await dispatchKind(page, "changeForm");
    await settle(page);
    const blast = (await handInstanceFor(page, "58004"))!;
    const filler = (await handInstanceFor(page, "58016"))!;
    await page.evaluate(
      async ([hollywood, pay]) => {
        const { appSession } = (await import("/src/session.ts")) as any;
        const { store } = appSession();
        const g = store.state.game;
        const id = g.players[0].hand.find((x: string) => g.instances[x].cardId === hollywood);
        const entry = store.state.legal.actions.legal.find(
          (e: any) => e.action.kind === "playCard" && e.action.instanceId === id,
        );
        await store.dispatch({ ...entry.example, payment: [{ fromHand: pay }] });
      },
      ["58009", filler] as const,
    );
    await settle(page);
    await playFromHand(page, false, blast, async () => (await boardText(page, /^PAYING/i)) !== undefined);
    const inPlay = () =>
      facts(
        page,
        (g) =>
          Object.values(g.instances as Record<string, { cardId: string }>).filter((i) => i.cardId === "58009").length,
      );
    const hollywoodPlayed = await facts(page, (g) =>
      g.players[0].hand.every((id: string) => g.instances[id].cardId !== "58009"),
    );
    expect(hollywoodPlayed, "Mr. Hollywood was played before the payment").toBe(true);
    await page.keyboard.press("z");
    await settle(page, { quietMs: 500, maxMs: 3000 });
    expect(
      await facts(page, (g) => g.players[0].hand.some((id: string) => g.instances[id].cardId === "58009")),
      "Mr. Hollywood is back in hand: Z took back a move the player did not ask about",
    ).toBe(false);
    expect(await inPlay()).toBeGreaterThan(0);
  });

  test("a greyed Undo tells the player why, on hover or press", async ({ page }) => {
    test.fail();
    test.setTimeout(240_000);
    await start(page);
    const undo = (await focusRect(page, "undo"))!;
    expect(undo, "Undo is on the bar").not.toBeNull();
    await page.mouse.move(undo.x + undo.width / 2, undo.y + undo.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await settle(page, { quietMs: 800, maxMs: 3000 });
    expect(
      await boardText(page, /nothing to undo/i),
      "the reason (view/undo.ts UNDO_REASONS) is never drawn",
    ).toBeDefined();
  });
});
