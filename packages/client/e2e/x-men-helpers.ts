import { expect, type Page } from "@playwright/test";
import { activeScenes, focusRect, pressUntil, settle, waitFor } from "./helpers.js";
import { visibleTexts } from "./wave6-helpers-a.js";

/**
 * Driving code for the specs that play `store/dev-x-men-games.ts`'s games: a real game played forward to a hand where
 * the board must ask a question, then the question and its answer by real pointer or touch input. The press has a
 * ~90 ms down-to-up gap, since a press on a tile that lands as it redraws under its own hover is lost.
 */

export const SHOT = process.env.E2E_SHOTS ?? "";

type DevGame = "startUncannyDevGame" | "startPeacekeepersDevGame";

const MODULE: Record<DevGame, string> = {
  startUncannyDevGame: "/src/store/dev-uncanny-game.ts",
  startPeacekeepersDevGame: "/src/store/dev-in-play-cost-games.ts",
};

/** Starts one of the dev games through the store and jumps to the Board. */
export const startDevGame = (page: Page, which: DevGame): Promise<void> =>
  page.evaluate(
    async ([name, module]) => {
      const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
      const games = (await import(/* @vite-ignore */ module)) as unknown as Record<
        string,
        (store: unknown) => Promise<void>
      >;
      await games[name]!(appSession().store);
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
    },
    [which, MODULE[which]] as const,
  );

export async function boardUp(page: Page): Promise<void> {
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "Board is up", 20000);
  // The opening "round N" band crosses the table once; a press that lands under it is lost, so let it clear first.
  await settle(page, { quietMs: 1000, maxMs: 6000 });
}

/** A real press at a point: a mouse click on the desktop, a touch tap on the phone, held ~90 ms. */
export async function press(page: Page, phone: boolean, x: number, y: number): Promise<void> {
  if (phone) {
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await new Promise((r) => setTimeout(r, 90));
    await page.mouse.up();
  }
  await new Promise((r) => setTimeout(r, 90));
}

/** Instance ids matching a card code, in a zone of the first seat ("hand") or in play. */
export const idsOf = (page: Page, code: string, where: "hand" | "play"): Promise<string[]> =>
  page.evaluate(
    async ([code, where]) => {
      const { appSession } = (await import("/src/session.ts")) as unknown as {
        appSession: () => {
          store: {
            state: {
              game?: {
                players: { hand: string[]; deck: string[]; discard: string[] }[];
                instances: Record<string, { cardId: string; attachedTo: string | null }>;
              };
            };
          };
        };
      };
      const game = appSession().store.state.game!;
      const seat = game.players[0]!;
      const away = new Set(game.players.flatMap((p) => [...p.hand, ...p.deck, ...p.discard]));
      return Object.entries(game.instances)
        .filter(([id, i]) => i.cardId === code && (where === "hand" ? seat.hand.includes(id) : !away.has(id)))
        .map(([id]) => id);
    },
    [code, where] as const,
  );

/** The state facts a spec asserts on. */
export const facts = <T>(page: Page, read: (game: any) => T): Promise<T> =>
  page.evaluate(async (source) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game?: unknown } } };
    };
    return new Function("game", `return (${source})(game)`)(appSession().store.state.game);
  }, read.toString()) as Promise<T>;

/** Scrolls the phone's sideways hand until the card is on screen. */
export async function bringIntoView(page: Page, key: string): Promise<void> {
  const size = page.viewportSize()!;
  for (let i = 0; i < 14; i++) {
    const r = await focusRect(page, key);
    if (r && r.x >= 0 && r.x + r.width / 2 < size.width - 30) break;
    await page.mouse.move(size.width / 2, size.height - 120);
    await page.mouse.wheel(150, 0);
    await settle(page);
  }
  await settle(page, { quietMs: 200, maxMs: 800 });
}

/** Plays a hand card the way the player does: a click on the desktop, a tap then Inspect's Play on the phone. */
export async function playFromHand(
  page: Page,
  phone: boolean,
  id: string,
  /** The question the play should put up; on the desktop a press lost to a redraw is repeated until it does. */
  reached: () => Promise<boolean>,
): Promise<void> {
  await bringIntoView(page, `card:${id}`);
  const rect = (await focusRect(page, `card:${id}`))!;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  if (!phone) {
    await pressUntil(page, () => press(page, false, cx, cy), reached, "the hand card's play question");
    return;
  }
  // Not a verified tap: Inspect can take over a second to open under load, and a repeat then lands on its backdrop.
  const inspectOpen = async (): Promise<boolean> => (await activeScenes(page)).includes("InspectOverlay");
  await pressUntil(page, () => page.touchscreen.tap(cx, cy), inspectOpen, "Inspect opens", { minWaitMs: 3000 });
  await settle(page, { quietMs: 300, maxMs: 1500 });
  const play = (await visibleTexts(page)).find((t) => t.scene === "InspectOverlay" && /^play( it)?$/i.test(t.text));
  expect(play, "Inspect offers Play").toBeDefined();
  await pressUntil(page, () => page.touchscreen.tap(play!.x, play!.y), reached, "Inspect's Play asks the question", {
    minWaitMs: 3000,
  });
}

export const boardTexts = async (page: Page): Promise<string[]> =>
  (await visibleTexts(page)).filter((t) => t.scene === "Board").map((t) => t.text);

export const boardText = async (page: Page, pattern: RegExp) =>
  (await visibleTexts(page)).find((t) => t.scene === "Board" && pattern.test(t.text));

/** Presses a card's focus rect (a tile in the panel, or a hand card). */
export async function pressCard(page: Page, phone: boolean, id: string): Promise<void> {
  const rect = (await focusRect(page, `card:${id}`))!;
  expect(rect, `a tile for ${id}`).not.toBeNull();
  await press(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page, { quietMs: 200, maxMs: 800 });
}

/** Waits for a Board text to appear and returns it. */
export const waitForBoardText = (page: Page, pattern: RegExp, label: string) =>
  waitFor(async () => (await boardText(page, pattern)) ?? null, label, 15000);

/** The open payment, from the board's own view of it: which sources are spent, and whether Pay would be accepted. */
async function paymentState(page: Page): Promise<{ spent: string[]; canPay: boolean } | null> {
  return page.evaluate(() => {
    const v = (
      window as unknown as {
        __mcBoardDebug?: {
          paymentView(): { command: unknown; sources: { instanceId: string | null; spent: boolean }[] } | null;
        };
      }
    ).__mcBoardDebug?.paymentView();
    if (!v) return null;
    return {
      spent: v.sources.filter((s) => s.spent && s.instanceId).map((s) => s.instanceId!),
      canPay: v.command !== null,
    };
  });
}

/**
 * Spends the given hand cards, then presses Pay. Each press is read back from the payment's own state (the card is
 * spent; the payment is closed) and repeated if a slow runner lost it, rather than assumed: a lost press on a card
 * leaves "PAY" drawn but disabled, and the text alone cannot tell the two apart.
 */
export async function payWith(page: Page, phone: boolean, hand: readonly string[]): Promise<void> {
  for (const id of hand) {
    await bringIntoView(page, `card:${id}`);
    await pressUntil(
      page,
      () => pressCard(page, phone, id),
      async () => (await paymentState(page))?.spent.includes(id),
      `${id} is spent on the payment`,
      { minWaitMs: 2000 },
    );
  }
  await waitFor(
    async () => (await paymentState(page))?.canPay,
    "the payment accepts Pay once the hand covers the cost",
  );
  const pay = await waitForBoardText(page, /^pay$/i, "Pay is offered once the hand covers the cost");
  await pressUntil(
    page,
    () => press(page, phone, pay.x, pay.y),
    async () => (await paymentState(page)) === null,
    "Pay closes the payment",
    { minWaitMs: 2000 },
  );
}
