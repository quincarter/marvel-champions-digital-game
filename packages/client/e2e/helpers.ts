import type { Page } from "@playwright/test";

/**
 * Shared driving code for the guided-mode e2e suite (`docs/guided-mode.md` §4 G11). Ported from the scratchpad
 * click-through scripts (`page-helpers.js` + `run.mjs`, used for the G11/G11b QA passes and the lesson reorder
 * re-run) into a small typed helper set, ` playwright test`-native rather than raw `playwright` + a manual
 * `chromium.launch`.
 *
 * Everything here drives the client through real pointer/touch events and reads state back only through the
 * `__mc*Debug` hooks the client already exposes for dev/QA (`scenes/board.ts`, `scenes/round-debrief.ts`) — never by
 * reaching into engine/session internals to assert something the player couldn't also see on screen.
 */

export interface TextMatch {
  readonly scene: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The tiny slice of `window.__mcGame` (a real `Phaser.Game`) this file reads — kept as a plain structural type
 * rather than importing Phaser's own types, since this file runs inside `page.addInitScript`/`page.evaluate`
 * closures serialized into the browser, not against this package's own Phaser install. */
interface MinimalGame {
  scene: {
    scenes: { sys: { isActive: () => boolean; settings: { key: string } } }[];
  };
}

/** Installs `window.__mcFindText` / `window.__mcActiveScenes` before the client's own script runs, so they're in
 * place the moment `main.ts` sets `window.__mcGame`. Mirrors the scratchpad's `page-helpers.js`. */
export async function installPageHelpers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (
      window as unknown as { __mcFindText: (substr: string, opts?: { sceneKey?: string }) => TextMatch[] }
    ).__mcFindText = (substr, opts) => {
      const o = opts ?? {};
      const game = (window as unknown as { __mcGame?: MinimalGame }).__mcGame;
      if (!game) return [];
      const results: TextMatch[] = [];
      const scenes = game.scene.scenes.filter((s) => s.sys.isActive());
      const wanted = o.sceneKey ? scenes.filter((s) => s.sys.settings.key === o.sceneKey) : scenes;
      for (const scene of wanted) {
        const walk = (obj: unknown): void => {
          const o2 = obj as { type?: string; text?: unknown; getBounds?: () => Rect; list?: unknown[] } | null;
          if (!o2) return;
          if (
            o2.type === "Text" &&
            typeof o2.text === "string" &&
            o2.text.toLowerCase().includes(substr.toLowerCase())
          ) {
            const b = o2.getBounds!();
            results.push({
              scene: scene.sys.settings.key,
              text: o2.text,
              x: b.x + b.width / 2,
              y: b.y + b.height / 2,
              w: b.width,
              h: b.height,
            });
          }
          if (o2.list) for (const child of o2.list) walk(child);
        };
        for (const child of (scene as unknown as { children: { list: unknown[] } }).children.list) walk(child);
      }
      return results;
    };
    (window as unknown as { __mcActiveScenes: () => string[] }).__mcActiveScenes = () => {
      const game = (window as unknown as { __mcGame?: MinimalGame }).__mcGame;
      if (!game) return [];
      return game.scene.scenes.filter((s) => s.sys.isActive()).map((s) => s.sys.settings.key);
    };
  });
}

export async function activeScenes(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __mcActiveScenes: () => string[] }).__mcActiveScenes());
}

export async function findText(page: Page, substr: string, sceneKey?: string): Promise<TextMatch[]> {
  return page.evaluate(
    ({ substr, sceneKey }) =>
      (window as unknown as { __mcFindText: (s: string, o?: { sceneKey?: string }) => TextMatch[] }).__mcFindText(
        substr,
        {
          sceneKey,
        },
      ),
    { substr, sceneKey },
  );
}

/** Clicks a text match, preferring short exact-ish button labels over long incidental copy that happens to
 * contain the substring — the same heuristic the scratchpad `clickText` used. Polls briefly for the text to
 * appear rather than assuming the caller already waited exactly long enough (scene transitions/animations vary). */
export async function clickText(
  page: Page,
  substr: string,
  opts: { sceneKey?: string; minY?: number; maxY?: number; minX?: number; index?: number; timeoutMs?: number } = {},
): Promise<TextMatch> {
  const pick = (all: TextMatch[]): TextMatch[] => {
    let matches = all;
    if (opts.minY !== undefined) matches = matches.filter((m) => m.y >= opts.minY!);
    if (opts.maxY !== undefined) matches = matches.filter((m) => m.y <= opts.maxY!);
    if (opts.minX !== undefined) matches = matches.filter((m) => m.x >= opts.minX!);
    const short = matches.filter((m) => m.text.trim().split(/\s+/).length <= 3 && m.h < 30);
    return short.length > 0 ? short.sort((a, b) => a.text.length - b.text.length) : matches;
  };
  const matches = await waitFor(
    async () => {
      const found = pick(await findText(page, substr, opts.sceneKey));
      return found.length > 0 ? found : null;
    },
    `text match for "${substr}" in scene ${opts.sceneKey ?? "any"}`,
    opts.timeoutMs ?? 10000,
  );
  const m = matches[opts.index ?? 0];
  await page.mouse.click(m.x, m.y);
  return m;
}

/** Shape of `window.__mcBoardDebug` (`scenes/board.ts`) relevant to this suite. Kept intentionally partial —
 * only the fields this suite reads. */
export interface BoardDebug {
  focusRect(key: string): Rect | null;
  guideStepId(): string | null;
  guideStopped(): boolean;
  tipDisplayed(): string | null;
  tipRects(): { focusables: Rect[] } | null;
  zoneRect(name: string): Rect | null;
  activeTab?: () => string;
}

export async function getBoardDebug(page: Page): Promise<BoardDebug | null> {
  return page.evaluate(
    () => (window as unknown as { __mcBoardDebug?: BoardDebug }).__mcBoardDebug ?? null,
  ) as Promise<BoardDebug | null>;
}

export async function guideStepId(page: Page): Promise<string | null> {
  return page.evaluate(
    () => (window as unknown as { __mcBoardDebug?: BoardDebug }).__mcBoardDebug?.guideStepId() ?? null,
  );
}

export async function guideStopped(page: Page): Promise<boolean> {
  return page.evaluate(
    () => (window as unknown as { __mcBoardDebug?: BoardDebug }).__mcBoardDebug?.guideStopped() ?? false,
  );
}

export async function focusRect(page: Page, key: string): Promise<Rect | null> {
  return page.evaluate(
    (k) => (window as unknown as { __mcBoardDebug?: BoardDebug }).__mcBoardDebug?.focusRect(k) ?? null,
    key,
  );
}

export async function clickFocus(page: Page, key: string): Promise<Rect> {
  const rect = await focusRect(page, key);
  if (!rect) throw new Error(`No focusRect for "${key}"`);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  return rect;
}

export async function tapFocus(page: Page, key: string): Promise<Rect> {
  const rect = await focusRect(page, key);
  if (!rect) throw new Error(`No focusRect for "${key}"`);
  await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
  return rect;
}

export async function zoneRect(page: Page, name: string): Promise<Rect | null> {
  return page.evaluate(
    (n) => (window as unknown as { __mcBoardDebug?: BoardDebug }).__mcBoardDebug?.zoneRect(n) ?? null,
    name,
  );
}

export function rectsOverlap(a: Rect | null, b: Rect | null): boolean {
  if (!a || !b) return false;
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Polls until `fn()` resolves to a truthy value, or throws with `label` on timeout. Playwright's own
 * `expect.poll` covers the assertion half of this; this plain helper is for driving flow (e.g. waiting on a step
 * id before clicking) rather than asserting one. */
export async function waitFor<T>(
  fn: () => Promise<T | null | undefined | false>,
  label: string,
  timeoutMs = 15000,
): Promise<T> {
  const start = Date.now();
  let last: T | null | undefined | false;
  while (Date.now() - start < timeoutMs) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`waitFor timed out (${label}), last=${JSON.stringify(last)}`);
}

/** Collects `pageerror`s for the duration of a test — zero of these is part of every spec's assertions. */
export function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

export const BLACK_CAT_CODE = "01002";
export const INTERROGATION_ROOM_CODE = "01063";

export async function handInstanceFor(page: Page, code: string): Promise<string | null> {
  return page.evaluate(async (code) => {
    const mod = await import("/src/session.ts");
    const state = (mod as unknown as { appSession: () => { store: { state: unknown } } }).appSession().store.state as {
      game?: { players: { playerId: unknown; hand: string[] }[]; instances: Record<string, { cardId: string }> };
      perspectiveId: unknown;
    };
    const game = state.game;
    if (!game || state.perspectiveId === null) return null;
    const me = game.players.find((p) => p.playerId === state.perspectiveId);
    if (!me) return null;
    for (const id of me.hand) {
      if (game.instances[id]?.cardId === code) return id;
    }
    return null;
  }, code);
}

export async function clickHandCard(page: Page, code: string): Promise<Rect> {
  const id = await handInstanceFor(page, code);
  if (!id) throw new Error(`Card ${code} not found in hand`);
  return clickFocus(page, `card:${id}`);
}

/** Walks New Game → chooser → Learn as you play → How to win → Start the fight, landing on the tutorial board.
 * The one entry point every guided-mode spec that plays a live tutorial shares. */
export async function startTutorialFromTitle(page: Page): Promise<void> {
  await waitFor(
    async () => {
      const scenes = await activeScenes(page);
      return scenes.includes("Title") ? scenes : null;
    },
    "boot lands on Title",
    20000,
  );

  await clickText(page, "NEW GAME");
  await page.waitForTimeout(500);
  await clickText(page, "Learn as you play");
  await page.waitForTimeout(200);
  await clickText(page, "Suit up");
  await page.waitForTimeout(600);
  await clickText(page, "Start the fight");
  await waitFor(
    async () => {
      const s = await activeScenes(page);
      return s.includes("Board") ? s : null;
    },
    "Start the fight reaches Board",
    20000,
  );
}
