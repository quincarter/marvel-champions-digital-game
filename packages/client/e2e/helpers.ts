import { test, type Page } from "@playwright/test";

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

/**
 * Local slow-runner stand-in: `E2E_CPU_THROTTLE=4` slows the page's CPU 4x through CDP (the GitHub runner is a slow
 * Linux box with software WebGL). Unset, this does nothing. A new spec must pass a throttled run before it lands
 * (`packages/client/README.md`, "End-to-end suite"). The CDP session stays attached so the rate holds.
 */
async function throttleCpuIfAsked(page: Page): Promise<void> {
  const rate = Number(process.env.E2E_CPU_THROTTLE ?? "1");
  if (!(rate > 1)) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
}

/** Installs `window.__mcFindText` / `window.__mcActiveScenes` before the client's own script runs, so they're in
 * place the moment `main.ts` sets `window.__mcGame`. Mirrors the scratchpad's `page-helpers.js`. */
export async function installPageHelpers(page: Page): Promise<void> {
  await throttleCpuIfAsked(page);
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
 * appear rather than assuming the caller already waited exactly long enough (scene transitions/animations vary).
 *
 * The screen is let settle before the press (a press that lands while the screen redraws under it, as it does when
 * a card scan arrives, is lost on a slow runner). Pass `until` and the press repeats, on a still screen, until that
 * state is reached: use it for every press whose effect can be read (a screen that comes up, a counter that moves);
 * leave it off for a press whose second firing would be a second action (a toggle). */
export async function clickText(
  page: Page,
  substr: string,
  opts: {
    sceneKey?: string;
    minY?: number;
    maxY?: number;
    minX?: number;
    index?: number;
    timeoutMs?: number;
    /** The state this press produces; when given, the press is repeated until it holds. */
    until?: () => Promise<unknown>;
    untilLabel?: string;
  } = {},
): Promise<TextMatch> {
  const pick = (all: TextMatch[]): TextMatch[] => {
    let matches = all;
    if (opts.minY !== undefined) matches = matches.filter((m) => m.y >= opts.minY!);
    if (opts.maxY !== undefined) matches = matches.filter((m) => m.y <= opts.maxY!);
    if (opts.minX !== undefined) matches = matches.filter((m) => m.x >= opts.minX!);
    const short = matches.filter((m) => m.text.trim().split(/\s+/).length <= 3 && m.h < 30);
    return short.length > 0 ? short.sort((a, b) => a.text.length - b.text.length) : matches;
  };
  const pressOnce = async (): Promise<TextMatch> => {
    const matches = await waitFor(
      async () => {
        const found = pick(await findText(page, substr, opts.sceneKey));
        return found.length > 0 ? found : null;
      },
      `text match for "${substr}" in scene ${opts.sceneKey ?? "any"}`,
      opts.timeoutMs ?? 10000,
    );
    await settle(page, { quietMs: 200, maxMs: 1500 });
    // The screen may have redrawn while it settled: aim at where the text is now.
    const now = pick(await findText(page, substr, opts.sceneKey));
    const m = (now.length > 0 ? now : matches)[opts.index ?? 0] ?? matches[0]!;
    await pressAt(page, m.x, m.y);
    return m;
  };
  if (!opts.until) return pressOnce();
  let pressed: TextMatch | null = null;
  await pressUntil(
    page,
    async () => {
      pressed = await pressOnce();
    },
    opts.until,
    opts.untilLabel ?? `clicking "${substr}"`,
    { timeoutMs: Math.max(opts.timeoutMs ?? 10000, WAIT_FLOOR_MS) },
  );
  return pressed!;
}

/** True while the named scene is running (a screen or overlay is up). */
export async function isSceneUp(page: Page, scene: string): Promise<boolean> {
  return (await activeScenes(page)).includes(scene);
}

/** True once any active scene draws text containing `substr` (a screen is up, a label has appeared). */
export async function hasText(page: Page, substr: string, sceneKey?: string): Promise<boolean> {
  return (await findText(page, substr, sceneKey)).length > 0;
}

/** Waits for text containing `substr` to be drawn. */
export async function waitForText(page: Page, substr: string, opts: { sceneKey?: string; timeoutMs?: number } = {}) {
  return waitFor(
    async () => {
      const found = await findText(page, substr, opts.sceneKey);
      return found.length > 0 ? found : null;
    },
    `text "${substr}" on screen`,
    opts.timeoutMs ?? 15000,
  );
}

/** A cheap fingerprint of what the active scenes are drawing: object types, positions, sizes, text and texture keys
 * (not alpha or scale, so a pulsing highlight still reads as still). Equal twice in a row means the screen is at rest. */
async function screenFingerprint(page: Page): Promise<string> {
  return page.evaluate(() => {
    interface Obj {
      type?: string;
      text?: unknown;
      visible?: boolean;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      texture?: { key?: string };
      list?: Obj[];
    }
    const game = (
      window as unknown as {
        __mcGame?: {
          scene: {
            scenes: { sys: { isActive: () => boolean; settings: { key: string } }; children: { list: Obj[] } }[];
          };
        };
      }
    ).__mcGame;
    if (!game) return "no-game";
    let out = "";
    for (const scene of game.scene.scenes) {
      if (!scene.sys.isActive()) continue;
      out += `#${scene.sys.settings.key}`;
      const walk = (o: Obj | null): void => {
        if (!o) return;
        out += `|${o.type}${o.visible === false ? "~" : ""}:${Math.round(o.x ?? 0)},${Math.round(o.y ?? 0)},${Math.round(o.width ?? 0)}x${Math.round(o.height ?? 0)}`;
        if (typeof o.text === "string") out += `"${o.text}"`;
        if (o.texture?.key) out += `@${o.texture.key}`;
        if (o.list) for (const child of o.list) walk(child);
      };
      for (const child of scene.children.list) walk(child);
    }
    return out;
  });
}

/**
 * Waits until the screen has stopped changing (same drawn objects for `quietMs`), capped at `maxMs`: the state-based
 * stand-in for a fixed `waitForTimeout` after a press. It never throws; the next read or press is what asserts.
 * `quietMs` is a floor, and the cap keeps a screen that never rests (a ticking animation) from stalling a run.
 */
export async function settle(page: Page, opts: { quietMs?: number; maxMs?: number } = {}): Promise<void> {
  const quietMs = opts.quietMs ?? 350;
  const maxMs = opts.maxMs ?? 8000;
  const start = Date.now();
  let last = await screenFingerprint(page);
  let since = Date.now();
  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 75));
    const now = await screenFingerprint(page);
    if (now !== last) {
      last = now;
      since = Date.now();
    } else if (Date.now() - since >= quietMs) return;
  }
}

/** Polls the screen fingerprint until it differs from `before`, for at most `windowMs`. */
async function screenChangedWithin(page: Page, before: string, windowMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < windowMs) {
    if ((await screenFingerprint(page)) !== before) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return (await screenFingerprint(page)) !== before;
}

/** Every press repeated because it changed nothing, so a flaky run says so in the report (and in CI's log). */
export const repeatedPresses: string[] = [];

/**
 * One real input, verified: a press that leaves the screen exactly as it was, after the screen has had time to react
 * and has come to rest, was lost (it landed mid-redraw, or on a control that was not live yet), so it is made once
 * more, as a player would. A press that did something is never repeated, however late it showed. The repeat is
 * recorded in `repeatedPresses` and as a test annotation: a lost press is not a failure, but it is not hidden either.
 */
async function verifiedPress(page: Page, label: string, press: () => Promise<void>): Promise<void> {
  const before = await screenFingerprint(page);
  await press();
  if (await screenChangedWithin(page, before, 1500)) return;
  await settle(page, { quietMs: 300, maxMs: 3000 });
  if ((await screenFingerprint(page)) !== before) return;
  repeatedPresses.push(label);
  console.warn(`e2e: press repeated, the first changed nothing: ${label}`);
  try {
    test.info().annotations.push({ type: "press repeated", description: label });
  } catch {
    // Outside a running test.
  }
  await press();
}

/** A real mouse click at a point, verified (see `verifiedPress`). */
export async function pressAt(
  page: Page,
  x: number,
  y: number,
  opts: { button?: "left" | "right" | "middle"; verify?: boolean } = {},
): Promise<void> {
  const { verify = true, ...mouse } = opts;
  if (!verify) {
    await page.mouse.click(x, y, mouse);
    return;
  }
  await verifiedPress(page, `click at ${Math.round(x)},${Math.round(y)}`, () => page.mouse.click(x, y, mouse));
}

/** Controls that take focus and draw nothing new when pressed (a text field), so a press on them is not verified. */
export const FOCUS_ONLY_STOP = /search|seed|field/i;

/**
 * Presses a control published by a scene's `stops()` debug hook (`window[hookName].stops()`, rects with a `key`):
 * waits for it to be drawn, lets the screen settle, aims at where it is now, and presses with a verified click.
 */
export async function pressHookStop(page: Page, hookName: string, key: string, timeoutMs = 15000): Promise<void> {
  type Stop = { key: string; x: number; y: number; width: number; height: number };
  const read = async (): Promise<Stop | null> =>
    page.evaluate(
      ([n, k]) => {
        const hook = (window as unknown as Record<string, { stops?: () => Stop[] } | undefined>)[n!];
        return hook?.stops?.().find((s) => s.key === k) ?? null;
      },
      [hookName, key] as const,
    );
  await waitFor(read, `control "${key}" on ${hookName}`, timeoutMs);
  await settle(page, { quietMs: 150, maxMs: 1000 });
  const stop = (await read()) ?? (await waitFor(read, `control "${key}" on ${hookName}`, timeoutMs));
  await pressAt(page, stop.x + stop.width / 2, stop.y + stop.height / 2, { verify: !FOCUS_ONLY_STOP.test(key) });
}

/** A real touch tap at a point, verified (see `verifiedPress`). */
export async function tapAt(page: Page, x: number, y: number): Promise<void> {
  await verifiedPress(page, `tap at ${Math.round(x)},${Math.round(y)}`, () => page.touchscreen.tap(x, y));
}

/** A real key press, verified (see `verifiedPress`): for keys that change the screen (Escape closing a sheet). */
export async function pressKey(page: Page, key: string): Promise<void> {
  await verifiedPress(page, `key ${key}`, () => page.keyboard.press(key));
}

/**
 * Presses, then waits for `reached()`; if the state has not arrived and the screen is at rest again, presses once
 * more, until it does or the budget runs out. This is the primitive for "click, then expect the next screen": a
 * single press can be lost on a slow runner (the screen redraws between pointer-down and pointer-up, or the control
 * is not live yet), and a spec must wait on the state rather than hope one press landed. Only for presses that are
 * safe to repeat while the state is not reached (a navigation button, an unspent control).
 */
export async function pressUntil(
  page: Page,
  press: () => Promise<unknown>,
  reached: () => Promise<unknown>,
  label: string,
  opts: { timeoutMs?: number; minWaitMs?: number } = {},
): Promise<void> {
  const budget = Math.max(opts.timeoutMs ?? 15000, WAIT_FLOOR_MS);
  const minWaitMs = opts.minWaitMs ?? 1500;
  const start = Date.now();
  while (Date.now() - start < budget) {
    if (await reached()) return;
    await press();
    const pressedAt = Date.now();
    // Give the press its time; only a state that is still not reached on a still screen counts as a lost press.
    while (Date.now() - pressedAt < minWaitMs) {
      if (await reached()) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    await settle(page, { quietMs: 300, maxMs: 4000 });
    if (await reached()) return;
  }
  throw new Error(`pressUntil timed out (${label})`);
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

/** The focus rect for `key`, once the board has drawn it (a slow runner can be a few seconds behind a state change). */
async function focusRectWhenDrawn(page: Page, key: string): Promise<Rect> {
  return waitFor(() => focusRect(page, key), `a focus rect for "${key}"`, WAIT_FLOOR_MS);
}

export async function clickFocus(page: Page, key: string): Promise<Rect> {
  await focusRectWhenDrawn(page, key);
  // Let the board finish redrawing before the press: a press that straddles a redraw is lost on a slow runner.
  await settle(page, { quietMs: 150, maxMs: 1000 });
  const rect = await focusRectWhenDrawn(page, key);
  await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
  return rect;
}

export async function tapFocus(page: Page, key: string): Promise<Rect> {
  await focusRectWhenDrawn(page, key);
  await settle(page, { quietMs: 150, maxMs: 1000 });
  const rect = await focusRectWhenDrawn(page, key);
  await tapAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
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

const WAIT_FLOOR_MS = 30_000;

/** Polls until `fn()` resolves to a truthy value, or throws with `label` on timeout. Playwright's own
 * `expect.poll` covers the assertion half of this; this plain helper is for driving flow (e.g. waiting on a step
 * id before clicking) rather than asserting one. */
export async function waitFor<T>(
  fn: () => Promise<T | null | undefined | false>,
  label: string,
  timeoutMs = 15000,
): Promise<T> {
  const start = Date.now();
  // A budget only matters when something is wrong, so it never undercuts what a slow CI runner needs (a state that
  // arrives in 2 s here took 10+ s there): callers' small numbers are floors for local runs, not CI limits.
  const budget = Math.max(timeoutMs, WAIT_FLOOR_MS);
  let last: T | null | undefined | false;
  while (Date.now() - start < budget) {
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

/**
 * Presses End turn on the board until the game has reacted (the end-turn confirm, a decision sheet or the villain
 * phase is up), then answers the end-turn confirm if one came. Waits on those states, so a hint that does or does not
 * raise a confirm this run does not matter, and a press lost on a slow runner is made again.
 */
export async function pressEndTurn(page: Page): Promise<void> {
  const reacted = async (): Promise<boolean> => {
    const scenes = await activeScenes(page);
    return ["EndTurnConfirmOverlay", "ChoiceOverlay", "VillainPhaseOverlay"].some((s) => scenes.includes(s));
  };
  await pressUntil(page, () => clickFocus(page, "basic:endTurn"), reacted, "End turn is pressed");
  if (await isSceneUp(page, "EndTurnConfirmOverlay")) {
    await pressUntil(
      page,
      () => clickText(page, "End turn", { sceneKey: "EndTurnConfirmOverlay" }),
      async () => !(await isSceneUp(page, "EndTurnConfirmOverlay")),
      "the end-turn confirm is answered",
    );
  }
}

/** Walks New Game → chooser → Learn as you play → How to win → Start the fight, landing on the tutorial board.
 * The one entry point every guided-mode spec that plays a live tutorial shares. Each press repeats until the next
 * screen is up, so a press lost while a screen settles does not strand the walk. */
export async function startTutorialFromTitle(page: Page): Promise<void> {
  await waitFor(
    async () => {
      const scenes = await activeScenes(page);
      return scenes.includes("Title") ? scenes : null;
    },
    "boot lands on Title",
    20000,
  );

  await clickText(page, "NEW GAME", {
    until: () => hasText(page, "Learn as you play"),
    untilLabel: "New game opens the chooser",
  });
  await clickText(page, "Learn as you play", {
    until: () => hasText(page, "Suit up"),
    untilLabel: "Learn as you play opens the lesson",
  });
  await clickText(page, "Suit up", {
    until: () => hasText(page, "Start the fight"),
    untilLabel: "Suit up opens How to win",
  });
  await clickText(page, "Start the fight", {
    until: async () => (await activeScenes(page)).includes("Board"),
    untilLabel: "Start the fight reaches Board",
  });
}
