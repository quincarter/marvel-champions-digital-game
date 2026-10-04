import type { Page } from "@playwright/test";
import { activeScenes, clickText, focusRect, installPageHelpers, waitFor } from "./helpers.js";

/**
 * Driving code for the wave 6 campaign and scenario smoke specs (`campaign-smoke.spec.ts`,
 * `scenario-smoke.spec.ts`). Same rules as `helpers.ts`: real pointer clicks on real coordinates, and state read
 * back only through what the player can also see on screen (the Phaser text that is drawn) or through the dev
 * hooks the scenes already publish (`__mcBoardDebug`, `__mcChoiceDebug`, and the `__mcFocusRoutes` hook the shared
 * `FocusRoute` publishes: a screen's controls by name, with their on-screen rects).
 */

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface VisibleText {
  readonly scene: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Stop {
  readonly key: string;
  readonly rect: Rect;
}

/** Scenes that run beside every screen and own no controls. */
const BACKGROUND_SCENES = new Set(["MusicScene"]);

/** Text that must never reach a player: a missing-string placeholder, a stringified object, a rules gap note. */
export const RAW_TEXT = /\(Not printed|\bundefined\b|\[object|\bNaN\b/i;

/** Installs the shared text helpers plus this file's visible-text walker, before the client's own script runs. */
export async function installWave6Helpers(page: Page): Promise<void> {
  await installPageHelpers(page);
  await page.addInitScript(() => {
    interface Obj {
      type?: string;
      text?: unknown;
      visible?: boolean;
      alpha?: number;
      getBounds?: () => { x: number; y: number; width: number; height: number };
      list?: Obj[];
    }
    interface SceneLike {
      sys: { isActive: () => boolean; settings: { key: string } };
      children: { list: Obj[] };
    }
    (window as unknown as { __mcVisibleTexts: () => unknown[] }).__mcVisibleTexts = () => {
      const game = (window as unknown as { __mcGame?: { scene: { scenes: SceneLike[] } } }).__mcGame;
      if (!game) return [];
      const out: unknown[] = [];
      for (const scene of game.scene.scenes.filter((s) => s.sys.isActive())) {
        const walk = (o: Obj | null): void => {
          if (!o || o.visible === false || (o.alpha ?? 1) < 0.05) return;
          if (o.type === "Text" && typeof o.text === "string" && o.text.trim() !== "") {
            const b = o.getBounds!();
            out.push({
              scene: scene.sys.settings.key,
              text: o.text,
              x: b.x + b.width / 2,
              y: b.y + b.height / 2,
              w: b.width,
              h: b.height,
            });
          }
          if (o.list) for (const child of o.list) walk(child);
        };
        for (const child of scene.children.list) walk(child);
      }
      return out;
    };
  });
}

/** Every drawn, visible, non-empty Phaser text in the running scenes (what the player can read right now). */
export async function visibleTexts(page: Page): Promise<VisibleText[]> {
  return page.evaluate(() => (window as unknown as { __mcVisibleTexts: () => VisibleText[] }).__mcVisibleTexts());
}

/** Throws when any visible text is raw: "(Not printed", "undefined", "[object ...", "NaN". */
export async function assertNoRawText(page: Page, where: string): Promise<void> {
  const bad = (await visibleTexts(page)).filter((t) => RAW_TEXT.test(t.text));
  if (bad.length > 0) {
    throw new Error(
      `raw text on screen at ${where}: ${bad.map((t) => `${t.scene}: ${JSON.stringify(t.text)}`).join(" | ")}`,
    );
  }
}

/** The foreground screens (everything running except the music scene). */
export async function screens(page: Page): Promise<string[]> {
  return (await activeScenes(page)).filter((s) => !BACKGROUND_SCENES.has(s));
}

/** A screen's named controls (`FocusRoute` stops), for the first active scene that has any. */
export async function routeStops(page: Page, sceneKey?: string): Promise<{ scene: string; stops: Stop[] } | null> {
  return page.evaluate((wanted) => {
    const w = window as unknown as {
      __mcFocusRoutes?: Record<string, () => { key: string; rect: Rect }[]>;
      __mcGame?: { scene: { scenes: { sys: { isActive: () => boolean; settings: { key: string } } }[] } };
    };
    const routes = w.__mcFocusRoutes;
    if (!routes || !w.__mcGame) return null;
    for (const s of w.__mcGame.scene.scenes) {
      const key = s.sys.settings.key;
      if (!s.sys.isActive() || key === "MusicScene" || !routes[key]) continue;
      if (wanted && key !== wanted) continue;
      return { scene: key, stops: routes[key]!() };
    }
    return null;
  }, sceneKey ?? null);
}

export async function hasStop(page: Page, key: string, sceneKey?: string): Promise<boolean> {
  const r = await routeStops(page, sceneKey);
  return !!r?.stops.some((s) => s.key === key);
}

/** Clicks the center of a named control, with a real pointer click. Waits briefly for it to exist. */
export async function clickStop(page: Page, key: string, sceneKey?: string, timeoutMs = 10000): Promise<void> {
  const stop = await waitFor(
    async () => (await routeStops(page, sceneKey))?.stops.find((s) => s.key === key) ?? null,
    `control "${key}" on ${sceneKey ?? "the current screen"}`,
    timeoutMs,
  );
  await page.mouse.click(stop.rect.x + stop.rect.width / 2, stop.rect.y + stop.rect.height / 2);
}

export async function waitForScene(page: Page, scene: string, timeoutMs = 20000): Promise<void> {
  await waitFor(async () => ((await activeScenes(page)).includes(scene) ? true : null), `scene ${scene}`, timeoutMs);
}

/** Console errors and page errors for the whole test. Failed resource loads are skipped: a missing card scan is a
 * supported outcome (the card draws its generated frame), so a 404 for art is not a defect. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/Failed to load resource/i.test(text)) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

/** Waits for the title screen, then opens Campaign from it (real click on the Title menu). */
export async function openSaga(page: Page): Promise<void> {
  await waitForScene(page, "Title", 30000);
  await page.waitForTimeout(600);
  await clickText(page, "Campaign", { sceneKey: "Title" });
  await waitForScene(page, "CampaignSaga");
  await waitFor(
    async () => ((await routeStops(page, "CampaignSaga"))?.stops.length ? true : null),
    "saga stops",
    15000,
  );
}

/** The shown round number on the board's top bar ("RD 2"), or null. */
export async function boardRound(page: Page): Promise<number | null> {
  const texts = await visibleTexts(page);
  for (const t of texts) {
    if (t.scene !== "Board") continue;
    const m = /^RD (\d+)$/.exec(t.text.trim());
    if (m) return Number(m[1]);
  }
  return null;
}

interface PendingChoiceView {
  readonly minSelections: number;
  readonly maxSelections: number;
  readonly options: readonly { optionId: string }[];
}

/**
 * Answers the open pending-choice sheet with the first legal option(s): the options the sheet itself offers (read
 * from the same pending choice it draws), clicked with real pointer events, then Confirm. A lone option starts
 * picked (`initialChoiceSelection`), so only Confirm is pressed then.
 */
export async function answerChoiceSheet(page: Page): Promise<void> {
  // The pending decision the sheet is drawing, from the same session store the sheet reads (the Board's own debug
  // hook does not exist yet while Setup deal is up, and a setup decision can open there).
  const choice = (await page.evaluate(async () => {
    const mod = await import("/src/session.ts");
    const state = (
      mod as unknown as { appSession: () => { store: { state: { game?: { pendingChoice?: unknown } } } } }
    ).appSession().store.state;
    return state.game?.pendingChoice ?? null;
  })) as PendingChoiceView | null;
  const rects = await page.evaluate(
    () =>
      (window as unknown as { __mcChoiceDebug?: { allRects(): [string, Rect][] } }).__mcChoiceDebug?.allRects() ?? [],
  );
  const rectOf = (key: string): Rect | undefined => rects.find(([k]) => k === key)?.[1];
  const click = async (r: Rect): Promise<void> => {
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
    await page.waitForTimeout(120);
  };
  if (choice && choice.options.length > 1 && choice.maxSelections > 0) {
    const need = Math.max(choice.minSelections, 1);
    for (const option of choice.options.slice(0, need)) {
      const r = rectOf(`option:${option.optionId}`);
      if (r) await click(r);
    }
  }
  const confirm = rectOf("confirm");
  if (confirm) await click(confirm);
  else {
    // A card-style sheet whose rects are not in this map (defend options): fall back to the lone Confirm button text.
    await clickText(page, "Confirm", { sceneKey: "ChoiceOverlay", timeoutMs: 3000 });
  }
}

/**
 * Walks Setup deal and the board's first beats to "the first player turn on the Board": keeps every opening hand
 * (the real "Keep all" button), answers any setup decision with its first legal option, and skips a scenario intro.
 */
export async function driveToBoard(page: Page, opts: { timeoutMs?: number } = {}): Promise<void> {
  const start = Date.now();
  const limit = opts.timeoutMs ?? 60000;
  let lastSig = "";
  let same = 0;
  while (Date.now() - start < limit) {
    const scenes = await screens(page);
    if (scenes.includes("ChoiceOverlay")) {
      await answerChoiceSheet(page);
    } else if (scenes.includes("Board") && !scenes.some((s) => s.endsWith("Overlay") || s === "VillainPhaseOverlay")) {
      if (await focusRect(page, "basic:endTurn")) return;
    } else if (scenes.includes("SetupDeal")) {
      const keep = (await visibleTexts(page)).find((t) => t.scene === "SetupDeal" && /^KEEP ALL/i.test(t.text));
      if (keep) await page.mouse.click(keep.x, keep.y);
    } else if (scenes.includes("ScenarioIntro")) {
      await skipIntro(page);
    } else if (scenes.includes("VillainPhaseOverlay")) {
      await skipVillainPhase(page);
    }
    const sig = scenes.join(",");
    same = sig === lastSig ? same + 1 : 0;
    lastSig = sig;
    if (same > 40) throw new Error(`stuck on ${sig} while walking to the board`);
    await page.waitForTimeout(250);
  }
  throw new Error(`never reached the first player turn (last screens: ${lastSig})`);
}

/** Skips a scenario intro by whatever skip/continue control it shows (real click on its text). */
export async function skipIntro(page: Page): Promise<void> {
  const texts = await visibleTexts(page);
  const control = texts.find(
    (t) => t.scene === "ScenarioIntro" && /^(skip|continue|begin|start|tap|deal)/i.test(t.text.trim()),
  );
  if (control) await page.mouse.click(control.x, control.y);
  else await page.keyboard.press("Escape");
}

/** Skips the villain-phase walkthrough overlay with its own Skip (or Continue) button. */
export async function skipVillainPhase(page: Page): Promise<void> {
  const rect = await page.evaluate(() => {
    const dbg = (
      window as unknown as { __mcVillainPhaseDebug?: { continueRect(): Rect | null; skipRect(): Rect | null } }
    ).__mcVillainPhaseDebug;
    return dbg?.continueRect() ?? dbg?.skipRect() ?? null;
  });
  if (rect) await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  else await page.keyboard.press("Escape");
}

/**
 * Presses End turn on the board and lets the villain phase run, answering every prompt it raises with the first
 * legal option, until the next round's player turn is on the Board. Returns the round number then shown.
 */
export async function endTurnToNextRound(
  page: Page,
  fromRound: number,
  opts: { timeoutMs?: number } = {},
): Promise<number> {
  const end = await focusRect(page, "basic:endTurn");
  if (!end) throw new Error("End turn has no live control on the board");
  await page.mouse.click(end.x + end.width / 2, end.y + end.height / 2);
  const start = Date.now();
  const limit = opts.timeoutMs ?? 90000;
  let lastSig = "";
  let same = 0;
  while (Date.now() - start < limit) {
    const scenes = await screens(page);
    if (scenes.includes("EndTurnConfirmOverlay") || scenes.includes("EndTurnConfirm")) {
      const rect = await page.evaluate(
        () =>
          (window as unknown as { __mcEndTurnConfirmDebug?: { endRect(): Rect } }).__mcEndTurnConfirmDebug?.endRect() ??
          null,
      );
      if (rect) await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    } else if (scenes.includes("ChoiceOverlay")) {
      await answerChoiceSheet(page);
    } else if (scenes.includes("VillainPhaseOverlay")) {
      await skipVillainPhase(page);
    } else if (scenes.includes("GameOver")) {
      throw new Error("the game ended before round 2");
    } else if (scenes.includes("Board")) {
      const round = await boardRound(page);
      const live = await focusRect(page, "basic:endTurn");
      if (round !== null && round > fromRound && live) return round;
    }
    const sig = scenes.join(",");
    same = sig === lastSig ? same + 1 : 0;
    lastSig = sig;
    if (same > 80) throw new Error(`stuck on ${sig} during the villain phase`);
    await page.waitForTimeout(250);
  }
  throw new Error(`round ${fromRound + 1} never started (last screens: ${lastSig})`);
}
