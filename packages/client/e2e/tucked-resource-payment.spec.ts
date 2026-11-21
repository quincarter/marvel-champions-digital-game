import { expect, test, type Page } from "@playwright/test";
import { activeScenes, focusRect, hasText, pressUntil, settle, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { inspectAt, openApp } from "./wave6-helpers-b.js";
import { SHOTS, startOnBoard } from "./qa-wave10-recheck-helpers.js";
import { bringIntoView, facts, playFromHand, press } from "./x-men-helpers.js";

/**
 * Issue #922: a card tucked under a card that lets any player spend it "as if it were in their hand" (Falcon's Resource
 * Reserve, 53021; a Mod Store pack's host) is offered by the engine as a payment source, but in payment mode the client
 * drew it nowhere: it is in no hand, and Inspect showed "Use as resource" only for a hand card. Now the payment strip
 * beside the hand shows it, tagged "tucked", a tap spends it, and Inspect offers "Use as resource" / "Pay with" for it.
 */
/** Phone and desktop; with `E2E_SHOTS` set, also the PR's screenshot sizes (iPhone SE, Pixel 10, tablets). */
const SIZES = [
  { name: "phone-390x844", width: 390, height: 844, touch: true },
  { name: "desktop-1440x900", width: 1440, height: 900, touch: false },
  ...(SHOTS
    ? [
        { name: "se-375x667", width: 375, height: 667, touch: true },
        { name: "pixel-412x924", width: 412, height: 924, touch: true },
        { name: "tablet-820x1180", width: 820, height: 1180, touch: true },
        { name: "tablet-1180x820", width: 1180, height: 820, touch: true },
      ]
    : []),
] as const;

const RESERVE = "53021";
const STRENGTH = "53027"; // a [physical] resource card, tucked under the Reserve
const REDWING = "53002"; // an ally, cost 2
const ENERGY = "53025"; // pays for the Reserve
const HAND = [RESERVE, STRENGTH, REDWING, ENERGY, "53026", "53024"];

interface TableSource {
  readonly instanceId: string;
  readonly optionId: string;
  readonly spent: boolean;
}
interface BoardDebug {
  paymentView(): { tableSources: TableSource[] } | null;
}
const paymentView = (page: Page) =>
  page.evaluate(() => (window as unknown as { __mcBoardDebug?: BoardDebug }).__mcBoardDebug?.paymentView() ?? null);

/** Falcon with Resource Reserve in play and Strength tucked under it by its Action; Redwing in hand. */
async function stage(page: Page): Promise<{ strength: string; redwing: string }> {
  await installWave6Helpers(page);
  await openApp(page);
  await startOnBoard(page, {
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "falcon-leadership" }],
    seed: 922,
    stack: { players: { 0: HAND } },
  });
  const ids = await page.evaluate(
    async ({ reserve, strength, energy, redwing }) => {
      type Legal = {
        action: { kind: string; instanceId?: string; abilityId?: string };
        example: Record<string, unknown>;
      };
      type Game = {
        players: { hand: string[]; playArea: string[] }[];
        instances: Record<string, { cardId: string }>;
        pendingChoice?: { options: { optionId: string }[] } | null;
      };
      const { appSession } = (await import("/src/session.ts")) as unknown as {
        appSession: () => {
          store: {
            dispatch: (c: unknown) => Promise<void>;
            resolveChoice: (ids: string[]) => Promise<void>;
            state: { game?: Game; legal?: { actions: { legal?: Legal[] } } };
          };
        };
      };
      const { store } = appSession();
      const game = () => store.state.game!;
      const inHand = (code: string) => game().players[0]!.hand.find((id) => game().instances[id]?.cardId === code)!;
      const strengthId = inHand(strength);
      const redwingId = inHand(redwing);
      const reserveId = inHand(reserve);
      const play = store.state.legal?.actions.legal?.find(
        (e) => e.action.kind === "playCard" && e.action.instanceId === reserveId,
      );
      await store.dispatch({ ...play!.example, payment: [{ fromHand: inHand(energy) }] });
      const use = store.state.legal?.actions.legal?.find(
        (e) => e.action.kind === "useAbility" && e.action.instanceId === reserveId,
      );
      await store.dispatch(use!.example);
      const option = game().pendingChoice?.options.find((o) => o.optionId.includes(strengthId));
      if (option) await store.resolveChoice([option.optionId]);
      return { strength: strengthId, redwing: redwingId };
    },
    { reserve: RESERVE, strength: STRENGTH, energy: ENERGY, redwing: REDWING },
  );
  await settle(page, { quietMs: 800, maxMs: 4000 });
  const tucked = await facts(page, (game) => {
    const host = Object.keys(game.instances).find((id) => game.instances[id].cardId === "53021");
    return host ? (game.instances[host].tucked as string[]) : [];
  });
  expect(tucked, "Strength is tucked under Resource Reserve").toEqual([ids.strength]);
  return ids;
}

for (const size of SIZES) {
  test.describe(`a tucked resource card in payment mode at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.touch });

    test("the strip shows the card tucked under Resource Reserve, Inspect offers to pay with it, and a tap spends it", async ({
      page,
    }) => {
      test.setTimeout(240_000);
      const { strength, redwing } = await stage(page);
      // The phone layout below 768 wide (a tap opens Inspect); a tablet plays and spends on a press, as the desktop does.
      const phone = size.width < 768;

      // A tap on a hand card opens Inspect (its Play it starts the play) on a phone and a portrait tablet.
      await playFromHand(
        page,
        phone || (size.touch && size.width < size.height),
        redwing,
        async () => (await paymentView(page)) !== null,
      );
      await settle(page, { quietMs: 400, maxMs: 2000 });
      const tile = (await paymentView(page))?.tableSources.find((source) => source.instanceId === strength);
      expect(tile, "the tucked Strength is in the payment strip").toBeDefined();
      expect(tile!.spent).toBe(false);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/tucked-payment-strip-${size.name}.png` });

      // Inspect on the tile offers to spend it (it is in no hand).
      await bringIntoView(page, `payment:${tile!.optionId}`);
      const rect = (await focusRect(page, `payment:${tile!.optionId}`))!;
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      // A hold on a phone, a right-click elsewhere: a tap would spend it.
      await inspectAt(page, rect, phone ? "hold" : "right");
      expect(
        (await hasText(page, "Use as resource", "InspectOverlay")) ||
          (await hasText(page, "Pay with", "InspectOverlay")),
        "Inspect offers to pay with the tucked card",
      ).toBe(true);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/tucked-payment-inspect-${size.name}.png` });
      await page.keyboard.press("Escape");
      await waitFor(
        async () => (!(await activeScenes(page)).includes("InspectOverlay") ? true : null),
        "Inspect closes",
      );
      await settle(page);

      // A tap on the tile spends it.
      await pressUntil(
        page,
        () => press(page, phone, cx, cy),
        async () =>
          (await paymentView(page))?.tableSources.find((source) => source.instanceId === strength)?.spent === true,
        "a tap on the tucked card's tile spends it",
      );
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/tucked-payment-spent-${size.name}.png` });
    });
  });
}
