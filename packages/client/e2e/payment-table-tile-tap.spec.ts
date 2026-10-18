import { expect, test, type Page } from "@playwright/test";
import { focusRect, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, startGame } from "./wave6-helpers-b.js";
import { SHOT, boardText, facts, playFromHand } from "./x-men-helpers.js";

/**
 * On a phone the hand scrolls sideways inside a clipped strip, and a payment pins the table's resource cards (Peter
 * Parker's Scientist) at its head. The clip hid a scrolled card but not its tap area, so a tap on Peter Parker's tile
 * picked the hand card scrolled under it (the owner's report, paying for Web-Shooter). Now a hand card takes presses
 * only inside the strip.
 */

interface PaymentSource {
  readonly instanceId: string | null;
  readonly spent: boolean;
}

const spentSources = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const view = (
      window as unknown as { __mcBoardDebug?: { paymentView(): { sources: PaymentSource[] } | null } }
    ).__mcBoardDebug?.paymentView();
    return (view?.sources ?? []).filter((s) => s.spent && s.instanceId).map((s) => s.instanceId!);
  });

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const contains = (rect: Rect, x: number, y: number): boolean =>
  x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;

test("a tap on a payment's pinned table card spends that card, not the hand card scrolled under it", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the hand scrolls under the pinned tiles on a phone");
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page);

  // Peter Parker, in alter-ego form, with a card in hand that costs something to play.
  const identity = await facts(page, (game) => game.players[0].identity.instanceId as string);
  const card = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: { state: { legal?: { actions: { legal?: { action: { kind: string; instanceId?: string } }[] } } } };
      };
    };
    const legal = appSession().store.state.legal?.actions.legal ?? [];
    return legal.find((entry) => entry.action.kind === "playCard")?.action.instanceId ?? null;
  });
  expect(card, "a playable hand card").not.toBeNull();
  await playFromHand(page, true, card!, async () => (await boardText(page, /^PAYING/i)) !== undefined);
  await settle(page, { quietMs: 400, maxMs: 3000 });

  // Scroll the hand until one of its cards sits under the pinned Peter Parker tile.
  const tile = await waitFor(() => focusRect(page, `card:${identity}`), "Peter Parker's tile in the payment strip");
  const cx = tile.x + tile.width / 2;
  const cy = tile.y + tile.height / 2;
  const hand = await facts(page, (game) => game.players[0].hand as string[]);
  const under = async (): Promise<string | null> => {
    for (const id of hand) {
      const rect = await focusRect(page, `card:${id}`);
      if (id !== card && rect && contains(rect, cx, cy)) return id;
    }
    return null;
  };
  const size = page.viewportSize()!;
  for (let i = 0; i < 12 && (await under()) === null; i++) {
    await page.mouse.move(size.width / 2, cy);
    await page.mouse.wheel(60, 0);
    await settle(page, { quietMs: 150, maxMs: 600 });
  }
  const behind = await under();
  expect(behind, "a hand card scrolled under the pinned tile").not.toBeNull();
  if (SHOT) await page.screenshot({ path: `${SHOT}/payment-tile-tap-before.png` });

  await page.touchscreen.tap(cx, cy);
  await waitFor(
    async () => ((await spentSources(page)).includes(identity) ? true : null),
    "Peter Parker's resource spent",
    10_000,
  );
  expect(await spentSources(page), "the hand card under the tile stays unpicked").not.toContain(behind);
  if (SHOT) await page.screenshot({ path: `${SHOT}/payment-tile-tap-after.png` });
  expect(errors).toEqual([]);
});
