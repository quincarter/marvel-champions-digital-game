import type { Page } from "@playwright/test";
import {
  type TextMatch,
  activeScenes,
  clickFocus,
  clickHandCard,
  clickText,
  findText,
  focusRect,
  handInstanceFor,
  installPageHelpers,
  pressAt,
  settle,
  waitFor,
} from "./helpers.js";

/**
 * Shared driving code for the wave 6 e2e specs (`teamup`, `how-to-play`, `mojo-setup`, `deck-import`,
 * `wave6-misc`). Imports from `helpers.ts` and never changes it. Same rules as the guided-mode suite: real pointer
 * events, state read back only through the dev `__mc*Debug` hooks and the text on screen, fixed seeds.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Guide off and the chooser marked seen, set before the app's own script runs and only when nothing is saved yet (so a
 * reload keeps what the app wrote). Without it the first-run tip toasts sit over the table and cover the rings.
 */
export async function quietGuide(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!localStorage.getItem("mc-guide")) {
      localStorage.setItem("mc-guide", JSON.stringify({ version: 1, level: "off", chooserSeen: true }));
    }
  });
}

/**
 * Opens the app and waits for `landing` (Title by default; a `?screen=` dev jump lands elsewhere). `query` is the URL
 * query without the `?` (for example `unlock=all`).
 */
export async function openApp(
  page: Page,
  query = "unlock=all",
  options: { quiet?: boolean; landing?: string } = {},
): Promise<void> {
  await installPageHelpers(page);
  if (options.quiet !== false) await quietGuide(page);
  await page.goto(query ? `/?${query}` : "/");
  const landing = options.landing ?? "Title";
  await waitFor(
    async () => ((await activeScenes(page)).includes(landing) ? true : null),
    `boot lands on ${landing}`,
    30000,
  );
}

/**
 * Starts a real game through the store (the same `store.start` call Table setup makes) and jumps to the Board, the
 * way the `?screen=board` dev jump does. Returns once the Board is up. The mulligan sheet, if any, is left open.
 */
export async function startGame(
  page: Page,
  config: { scenarioId: string; decks: readonly string[]; seed: number; difficulty?: string },
): Promise<void> {
  await page.evaluate(async (c) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { start: (cfg: unknown) => Promise<void> } };
    };
    await appSession().store.start({
      scenarioId: c.scenarioId,
      difficulty: c.difficulty ?? "standard",
      players: c.decks.map((starterDeckId) => ({ starterDeckId })),
      seed: c.seed,
    });
    const game = (
      window as unknown as {
        __mcGame: {
          scene: {
            getScenes: (a: boolean) => { sys: { settings: { key: string } } }[];
            stop: (k: string) => void;
            start: (k: string) => void;
          };
        };
      }
    ).__mcGame;
    for (const s of game.scene.getScenes(true)) game.scene.stop(s.sys.settings.key);
    game.scene.start("Board");
  }, config);
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "Board is up", 20000);
  await settle(page);
}

/** Declines every mulligan sheet that is open (one per seat) by real clicks on "Decline". */
export async function declineMulligans(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const open = (await activeScenes(page)).includes("ChoiceOverlay");
    if (!open) return;
    const sheet = await findText(page, "Mulligan", "ChoiceOverlay");
    if (sheet.length === 0) return;
    await settle(page);
    await clickText(page, "Decline", { sceneKey: "ChoiceOverlay" });
    await settle(page);
  }
}

/** Text objects that are really showing: the shared `findText` also matches hidden ones (a hover label, say). */
export async function findVisibleText(page: Page, substr: string, sceneKey?: string): Promise<TextMatch[]> {
  return page.evaluate(
    ({ substr, sceneKey }) => {
      const game = (window as unknown as { __mcGame?: { scene: { scenes: unknown[] } } }).__mcGame;
      type Obj = {
        type?: string;
        text?: unknown;
        visible?: boolean;
        alpha?: number;
        list?: Obj[];
        getBounds?: () => { x: number; y: number; width: number; height: number };
      };
      const out: TextMatch[] = [];
      const scenes = (game?.scene.scenes ?? []) as {
        sys: { isActive: () => boolean; settings: { key: string } };
        children: { list: Obj[] };
      }[];
      for (const scene of scenes) {
        if (!scene.sys.isActive() || (sceneKey && scene.sys.settings.key !== sceneKey)) continue;
        const walk = (o: Obj, shown: boolean): void => {
          const visible = shown && o.visible !== false && (o.alpha ?? 1) > 0;
          if (
            o.type === "Text" &&
            visible &&
            typeof o.text === "string" &&
            o.text.toLowerCase().includes(substr.toLowerCase())
          ) {
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
          for (const child of o.list ?? []) walk(child, visible);
        };
        for (const child of scene.children.list) walk(child, true);
      }
      return out;
    },
    { substr, sceneKey },
  );
}

/** Shape of the `__mcBoardDebug` hooks this suite adds on top of `helpers.ts`'s `BoardDebug`. */
export interface BoardDebugB {
  hitRect(id: string): Rect | null;
  teamUpRings(): { key: string; x: number; y: number; width: number; height: number; labelShown: boolean }[];
}

export async function teamUpRings(page: Page): Promise<ReturnType<BoardDebugB["teamUpRings"]>> {
  return page.evaluate(
    () => (window as unknown as { __mcBoardDebug?: BoardDebugB }).__mcBoardDebug?.teamUpRings() ?? [],
  );
}

/** One seat's game facts, read from the session store (the same state the screen draws from). */
export async function gameFacts<T>(page: Page, read: string): Promise<T> {
  return page.evaluate(async (body) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: unknown } };
    };
    // eslint-disable-next-line no-new-func
    return new Function("state", `return (${body})(state)`)(appSession().store.state);
  }, read) as Promise<T>;
}

export { clickFocus };

/** Taps the card in the hand, then taps hand cards as payment until the engine accepts, then taps Pay. */
export async function playHandCardByClicks(page: Page, code: string): Promise<void> {
  await clickHandCard(page, code);
  for (let step = 0; step < 8; step++) {
    await settle(page);
    // A paid card's own interrupt (Molecular Acceleration, say) asks first: decline it and carry on.
    if ((await activeScenes(page)).includes("ChoiceOverlay")) {
      await clickText(page, "Decline", { sceneKey: "ChoiceOverlay" });
      await settle(page);
    }
    const view = await page.evaluate(() => {
      const v = (
        window as unknown as {
          __mcBoardDebug?: {
            paymentView(): { command: unknown; sources: { instanceId: string | null; spent: boolean }[] } | null;
          };
        }
      ).__mcBoardDebug?.paymentView();
      if (!v) return null;
      return {
        canPay: v.command !== null,
        free: v.sources.filter((s) => !s.spent && s.instanceId).map((s) => s.instanceId!),
      };
    });
    if (!view) return; // payment closed: the card was played
    if (view.canPay) {
      await clickFocus(page, "payment:pay");
      continue;
    }
    let tapped = false;
    for (const id of view.free) {
      const rect = await focusRect(page, `card:${id}`);
      if (!rect) continue;
      await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
      tapped = true;
      break;
    }
    if (!tapped) throw new Error("payment is open, not payable, and no hand source can be tapped");
  }
  throw new Error("payment never closed");
}

/** A hand card's rect from the board's hit map, by card code. */
export async function handRectFor(page: Page, code: string): Promise<Rect> {
  const id = await handInstanceFor(page, code);
  if (!id) throw new Error(`Card ${code} not in the perspective hand`);
  const rect = await page.evaluate(
    (i) => (window as unknown as { __mcBoardDebug?: BoardDebugB }).__mcBoardDebug?.hitRect(i) ?? null,
    id,
  );
  if (!rect) throw new Error(`No hit rect for ${code}`);
  return rect;
}

/** Opens Inspect on a rect by right-click, or by press-and-hold (a held left button, as a finger does). */
export async function inspectAt(page: Page, rect: Rect, how: "right" | "hold"): Promise<void> {
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await page.mouse.move(x, y);
  if (how === "right") await pressAt(page, x, y, { button: "right" });
  else {
    await page.mouse.down();
    await settle(page);
    await page.mouse.up();
  }
  await waitFor(
    async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null),
    "Inspect opens",
    8000,
  );
  await settle(page);
}

/** Calls a dev debug hook on `window` (an `__mc*Debug` object's method) and returns its plain-data result. */
export async function hook<T>(page: Page, name: string, method: string, ...args: unknown[]): Promise<T | null> {
  return page.evaluate(
    ([n, m, a]) => {
      const target = (window as unknown as Record<string, Record<string, (...x: unknown[]) => unknown> | undefined>)[
        n as string
      ];
      const fn = target?.[m as string];
      return fn ? (fn(...(a as unknown[])) as T) : null;
    },
    [name, method, args] as const,
  );
}

/**
 * Scrolls the mouse wheel over `viewport` until `rectOf()` is fully inside it, then returns that rect. For a row of a
 * scrolled list (the How to play hub, a New in box page).
 */
export async function scrollRectIntoView(
  page: Page,
  viewport: Rect,
  rectOf: () => Promise<Rect | null>,
  label: string,
): Promise<Rect> {
  for (let i = 0; i < 30; i++) {
    const rect = await rectOf();
    if (!rect) throw new Error(`no rect for ${label}`);
    const inside = rect.y >= viewport.y + 4 && rect.y + rect.height <= viewport.y + viewport.height - 4;
    if (inside) return rect;
    await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2);
    await page.mouse.wheel(0, rect.y < viewport.y ? -300 : 300);
    await settle(page, { quietMs: 200 });
  }
  throw new Error(`could not scroll ${label} into view`);
}

export interface HubRow extends Rect {
  readonly id: string;
  readonly title?: string;
}

/** Opens a New in box page from the How to play hub by its row title, by real clicks (scrolling to the row first). */
export async function openBoxPage(page: Page, rowTitle: string): Promise<void> {
  const viewport = (await hook<Rect>(page, "__mcHowToPlayDebug", "viewport"))!;
  const find = async (): Promise<HubRow | null> =>
    ((await hook<HubRow[]>(page, "__mcHowToPlayDebug", "boxes")) ?? []).find((b) => b.title === rowTitle) ?? null;
  const rect = await scrollRectIntoView(page, viewport, find, `hub row "${rowTitle}"`);
  await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await waitFor(async () => ((await activeScenes(page)).includes("NewInBox") ? true : null), `${rowTitle} opens`, 8000);
  await settle(page);
}

export interface BoxPageRow {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly link: string | null;
  readonly row: Rect;
  readonly linkRect: Rect | null;
}

export const boxPageRows = async (page: Page): Promise<BoxPageRow[]> =>
  (await hook<BoxPageRow[]>(page, "__mcNewInBoxDebug", "rows")) ?? [];

/** Clicks a New in box page row (or its link line) by id, scrolling it into view first. */
export async function clickBoxPageRow(page: Page, id: string, part: "row" | "link" = "row"): Promise<void> {
  const viewport = (await hook<Rect>(page, "__mcNewInBoxDebug", "viewport"))!;
  const find = async (): Promise<Rect | null> => {
    const row = (await boxPageRows(page)).find((r) => r.id === id);
    return (part === "link" ? row?.linkRect : row?.row) ?? null;
  };
  const rect = await scrollRectIntoView(page, viewport, find, `${part} ${id}`);
  await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page);
}

/** From the Title screen: How to play → New in Mutant Genesis → the named Try-it lesson, ending on the Board. */
export async function startMechanicLesson(page: Page, lessonId: string): Promise<void> {
  await clickText(page, "How to play");
  await waitFor(
    async () => ((await activeScenes(page)).includes("HowToPlay") ? true : null),
    "How to play opens",
    8000,
  );
  await settle(page);
  await openBoxPage(page, "New in Mutant Genesis");
  await clickBoxPageRow(page, lessonId);
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "the lesson's Board", 20000);
  await waitFor(async () => (await boardGuideStep(page)) ?? null, "the lesson's first step", 20000);
  await settle(page);
}

export const boardGuideStep = async (page: Page): Promise<string | null> =>
  hook<string>(page, "__mcBoardDebug", "guideStepId");

/** Answers the open decision sheet: picks option `index` unless one is already selected, then taps Confirm. */
export async function answerChoice(page: Page, index = 0): Promise<void> {
  await waitFor(
    async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? true : null),
    "a decision opens",
    8000,
  );
  await settle(page);
  // Cards from a deck wait behind the privacy cover in a game with more than one seat: tapped, as that player would.
  const cover = (await findVisibleText(page, "Tap to reveal", "ChoiceOverlay"))[0];
  if (cover) {
    await pressAt(page, cover.x, cover.y);
    await settle(page);
  }
  const preselected = (await findVisibleText(page, "selected ", "ChoiceOverlay")).some((t) =>
    /^selected \d/i.test(t.text),
  );
  if (!preselected) {
    const rects = (await hook<[string, Rect][]>(page, "__mcChoiceDebug", "allRects")) ?? [];
    const options = rects.filter(([key]) => key.startsWith("option:"));
    const target = options[index]?.[1];
    if (!target) throw new Error("the decision sheet offers no option to pick");
    await pressAt(page, target.x + target.width / 2, target.y + target.height / 2);
    await settle(page);
  }
  await clickText(page, "Confirm", { sceneKey: "ChoiceOverlay" });
  await settle(page);
}

/**
 * Uses the perspective hero's identity ability by real clicks: taps the identity card (Inspect opens on it), then taps
 * the red action button at the foot of the Inspect sheet that names the ability.
 */
export async function useIdentityAbility(page: Page, abilityWords: string): Promise<void> {
  const rect = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game: { players: { identity: { instanceId: string } }[] } } } };
    };
    const id = appSession().store.state.game.players[0]!.identity.instanceId;
    return (window as unknown as { __mcBoardDebug: { hitRect(i: string): Rect | null } }).__mcBoardDebug.hitRect(id);
  });
  if (!rect) throw new Error("no identity rect");
  await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await waitFor(
    async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null),
    "Inspect opens",
    6000,
  );
  await settle(page);
  await clickText(page, abilityWords, { sceneKey: "InspectOverlay", minY: 700 });
  await settle(page);
}

/**
 * From the moment Deal it out is pressed to the first player turn, answering whatever each real state asks: the
 * scenario's one-shot intro (Skip), every opening hand (Keep all, re-pressed until the deal screen is gone, since a
 * press that lands while the hand is still being laid out does nothing), and every hero setup choice until none is
 * pending. Done only when the Board has been up with no decision open for several polls in a row. No fixed sleeps:
 * it polls the scene list, and the budget is generous for the slow CI runner.
 */
export async function dealToFirstTurn(page: Page, opts: { budgetMs?: number } = {}): Promise<void> {
  const budget = opts.budgetMs ?? 90000;
  const start = Date.now();
  let lastKeep = 0;
  let calm = 0;
  let last: string[] = [];
  while (Date.now() - start < budget) {
    last = await activeScenes(page);
    if (last.includes("ChoiceOverlay")) {
      calm = 0;
      await answerChoice(page, 0);
    } else if (last.includes("ScenarioIntro")) {
      calm = 0;
      await clickText(page, "Skip", { sceneKey: "ScenarioIntro", timeoutMs: 5000 }).catch(() => undefined);
    } else if (last.includes("SetupDeal")) {
      calm = 0;
      if (Date.now() - lastKeep > 1500) {
        const keep = (await findVisibleText(page, "Keep all", "SetupDeal"))[0];
        if (keep) {
          await pressAt(page, keep.x, keep.y);
          lastKeep = Date.now();
        }
      }
    } else if (last.includes("Board")) {
      if (++calm >= 8) return;
    } else {
      calm = 0;
    }
    await page.waitForTimeout(150); // loop pacing, not a blind wait
  }
  throw new Error(`dealToFirstTurn: never reached a calm first player turn in ${budget} ms (last scenes: ${last})`);
}
