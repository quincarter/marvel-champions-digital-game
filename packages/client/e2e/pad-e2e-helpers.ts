import type { Page } from "@playwright/test";
import type { Rect } from "./wave6-helpers-b.js";

/**
 * A fake Xbox pad for the specs that play with a controller alone (`controller-picks.spec.ts`,
 * `villain-phase-pad.spec.ts`): the standard layout's buttons by index, a press held until the page has read it and the
 * game has stepped over it, and a probe for the glyph a scene draws near a control.
 */

export const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
export const PAD = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  view: 8,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
};

export async function installPad(page: Page): Promise<void> {
  await page.addInitScript((id) => {
    const pad = {
      connected: true,
      id,
      index: 0,
      mapping: "standard",
      timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    };
    (window as unknown as { __fakePad: unknown }).__fakePad = pad;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => {
        pad.timestamp = performance.now();
        return [pad];
      },
      configurable: true,
    });
  }, PAD_ID);
}

export async function setButton(page: Page, index: number, down: boolean): Promise<void> {
  await page.evaluate(
    ([i, on]) => {
      const pad = (window as unknown as { __fakePad: { buttons: unknown[] } }).__fakePad;
      pad.buttons[i as number] = { pressed: on as boolean, touched: on as boolean, value: on ? 1 : 0 };
    },
    [index, down] as const,
  );
}

/** Waits for `count` drawn frames, so the game has stepped over what the page just changed. */
export const frames = (page: Page, count: number): Promise<void> =>
  page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let seen = 0;
        const tick = (): void => {
          seen += 1;
          if (seen >= n) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    count,
  );

/** One press of a pad button: down until the page reads it and the game has stepped, then up and stepped again. */
export async function padTap(page: Page, index: number): Promise<void> {
  await setButton(page, index, true);
  await page.waitForFunction((i) => navigator.getGamepads()[0]?.buttons[i]?.pressed === true, index);
  await frames(page, 8);
  await setButton(page, index, false);
  await page.waitForFunction((i) => navigator.getGamepads()[0]?.buttons[i]?.pressed === false, index);
  await frames(page, 8);
}

/** Holds a trigger (RT or LT) until the game has stepped over it. */
export async function padHold(page: Page, index: number): Promise<void> {
  await setButton(page, index, true);
  await page.waitForFunction((i) => navigator.getGamepads()[0]?.buttons[i]?.pressed === true, index);
  await frames(page, 10);
}

export async function padRelease(page: Page, index: number): Promise<void> {
  await setButton(page, index, false);
  await page.waitForFunction((i) => navigator.getGamepads()[0]?.buttons[i]?.pressed === false, index);
  await frames(page, 10);
}

/**
 * A press that only tells the game a pad is in use (the glyphs open) and does nothing else: pulling and letting go of
 * RT, which no screen under test binds on its own.
 */
export async function padWake(page: Page): Promise<void> {
  await padHold(page, PAD.rt);
  await padRelease(page, PAD.rt);
}

/** Every drawn glyph or label reading `text` in `sceneKey` whose center lies by `rect` (visible through every parent). */
export async function glyphCount(page: Page, sceneKey: string, text: string, rect: Rect): Promise<number> {
  return page.evaluate(
    ([key, wanted, r]) => {
      const game = (
        window as unknown as { __mcGame: { scene: { getScene(k: string): { children: { list: unknown[] } } } } }
      ).__mcGame;
      type Node = {
        visible?: boolean;
        alpha?: number;
        text?: string;
        name?: string;
        list?: Node[];
        getBounds?: () => { x: number; y: number; width: number; height: number };
      };
      const box = r as Rect;
      let found = 0;
      const walk = (nodes: Node[], shown: boolean): void => {
        for (const node of nodes) {
          const vis = shown && node.visible !== false && (node.alpha ?? 1) > 0.05;
          if ((node.text === wanted || node.name === `glyph:${wanted}`) && vis && node.getBounds) {
            const b = node.getBounds();
            const cx = b.x + b.width / 2;
            const cy = b.y + b.height / 2;
            if (cx >= box.x - 4 && cx <= box.x + box.width + 4 && cy >= box.y - 24 && cy <= box.y + box.height + 24)
              found += 1;
          }
          if (node.list) walk(node.list, vis);
        }
      };
      walk(game.scene.getScene(key as string).children.list as Node[], true);
      return found;
    },
    [sceneKey, text, rect] as const,
  );
}

export const glyphIn = async (page: Page, sceneKey: string, text: string, rect: Rect): Promise<boolean> =>
  (await glyphCount(page, sceneKey, text, rect)) > 0;
