import type { Page } from "@playwright/test";
import { activeScenes, clickFocus, pressAt, settle, tapFocus, waitFor } from "./helpers.js";
import { answerChoiceSheet } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";

/** Shared driving code for the overlay specs (`overlay-input-block`, `overlay-controls`): the villain-phase recap. */

/** The host's command count and the hand size: a press that did something to the game moves one of them. */
export const gameMarks = (page: Page): Promise<{ version: number; hand: number; discard: number }> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          state: {
            version: number;
            perspectiveId: unknown;
            game?: { players: { playerId: unknown; hand: unknown[]; discard: unknown[] }[] };
          };
        };
      };
    };
    const s = appSession().store.state;
    const me = s.game?.players.find((p) => p.playerId === s.perspectiveId);
    return { version: s.version, hand: me?.hand.length ?? -1, discard: me?.discard.length ?? -1 };
  });

/** One of the villain phase's own control rects from its dev hook (`nextRect`, `resolveRect`, …), or null. */
export const villainDebugRect = (page: Page, name: string): Promise<Rect | null> =>
  page.evaluate(
    (n) =>
      (
        window as unknown as { __mcVillainPhaseDebug?: Record<string, (() => Rect | null) | undefined> }
      ).__mcVillainPhaseDebug?.[n]?.() ?? null,
    name,
  );

export const continueRect = (page: Page): Promise<Rect | null> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __mcVillainPhaseDebug?: { continueRect(): Rect | null } }
      ).__mcVillainPhaseDebug?.continueRect() ?? null,
  );

/**
 * The recap's own controls: CONTINUE, SKIP and the cards it shows (they open Inspect on purpose). A press on one of
 * these is the overlay answering; anything else must not be answered at all. Read from the scene's input list, minus
 * a zone that covers most of the screen (the shield that stops presses reaching the table).
 */
export const overlayControls = (page: Page): Promise<Rect[]> =>
  page.evaluate(() => {
    const game = (
      window as unknown as {
        __mcGame: {
          scene: {
            getScene: (k: string) => {
              sys: { input: { _list: { x: number; y: number; width: number; height: number }[] } };
            };
          };
          scale: { gameSize: { width: number; height: number } };
        };
      }
    ).__mcGame;
    const { width, height } = game.scale.gameSize;
    return game.scene
      .getScene("VillainPhaseOverlay")
      .sys.input._list.filter((o) => o.width * o.height < width * height * 0.5)
      .map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height }));
  });

/** Ends the turn and answers every prompt until the recap's last step (CONTINUE showing) is up. */
export async function reachVillainRecap(page: Page, phone: boolean): Promise<void> {
  const endTurn = (): Promise<unknown> => (phone ? tapFocus : clickFocus)(page, "basic:endTurn");
  const startVersion = (await gameMarks(page)).version;
  let pressedAt = Date.now();
  await endTurn();
  await waitFor(
    async () => {
      const scenes = await activeScenes(page);
      // A tap lost on a starved runner leaves the game exactly where it was: press End turn again, never twice once the
      // game has moved.
      if (scenes.length === 1 && Date.now() - pressedAt > 6000 && (await gameMarks(page)).version === startVersion) {
        pressedAt = Date.now();
        await endTurn();
        return null;
      }
      if (scenes.includes("EndTurnConfirmOverlay")) {
        const rect = await page.evaluate(
          () =>
            (
              window as unknown as { __mcEndTurnConfirmDebug?: { endRect(): Rect } }
            ).__mcEndTurnConfirmDebug?.endRect() ?? null,
        );
        if (rect) {
          if (phone) await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
          else await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
        }
        return null;
      }
      // The recap's last step comes first: a response that opened with the player phase is already pending behind it
      // (its sheet is running), and answering it here would skip the very thing under test.
      if (await continueRect(page)) return true;
      // Auto-advance off: the docked phase waits on START VILLAIN PHASE, then holds each decision behind ANSWER.
      for (const gate of ["startRect", "answerRect"]) {
        const rect = await villainDebugRect(page, gate);
        if (rect) {
          if (phone) await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
          else await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
          return null;
        }
      }
      // "Hold encounter cards" (motion on): the docked phase waits on Next card before it moves to the next card.
      const next = await villainDebugRect(page, "nextRect");
      if (next) {
        if (phone) await page.touchscreen.tap(next.x + next.width / 2, next.y + next.height / 2);
        else await pressAt(page, next.x + next.width / 2, next.y + next.height / 2);
        return null;
      }
      if (scenes.includes("ChoiceOverlay")) {
        await answerChoiceSheet(page);
        return null;
      }
      return null;
    },
    "the villain-phase recap's last step",
    90_000,
  );
  await settle(page);
}
