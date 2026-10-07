import { expect, type Page } from "@playwright/test";
import {
  activeScenes,
  clickText,
  findText,
  focusRect,
  handInstanceFor,
  pressAt,
  pressUntil,
  settle,
  tapAt,
  waitFor,
} from "./helpers.js";
import { visibleTexts } from "./wave6-helpers-a.js";
import { hook, openApp, type Rect } from "./wave6-helpers-b.js";
import { facts, press } from "./x-men-helpers.js";

/**
 * Shared driving code for `wave7-screens.spec.ts` and `wave7-full-game.spec.ts`: real pointer or touch input at 1440
 * (desktop) and 390 (phone), screenshots to `E2E_SHOTS` when set, and a few reads of the session store for what to aim
 * at (never to change anything).
 */

export const SHOTS = process.env.E2E_SHOTS ?? "";
export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
} as const;
export type Vp = keyof typeof VIEWPORTS;

export async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  const vp = page.viewportSize()!.width >= 1000 ? "d" : "p";
  await page.screenshot({ path: `${SHOTS}/${name}-${vp}.png` });
}

export const on = async (page: Page, scene: string): Promise<boolean> => (await activeScenes(page)).includes(scene);

/** Opens the app on Title (everything unlocked, the guide quiet) and returns the errors the page raises. */
export async function openTitle(page: Page, query = "unlock=all", landing = "Title"): Promise<void> {
  await openApp(page, query, { landing });
  await settle(page);
}

/** Starts a dev game fixture (`store/<file>`'s exported function) and jumps to the Board. */
export async function startFixture(page: Page, file: string, fn: string, ...args: unknown[]): Promise<void> {
  await page.evaluate(
    async ([f, name, a]) => {
      const { appSession } = (await import("/src/session.ts")) as unknown as { appSession: () => { store: unknown } };
      const mod = (await import(/* @vite-ignore */ `/src/store/${f as string}`)) as unknown as Record<
        string,
        (...x: unknown[]) => Promise<void>
      >;
      await mod[name as string]!(appSession().store, ...(a as unknown[]));
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
    [file, fn, args] as const,
  );
  await waitFor(async () => ((await on(page, "Board")) ? true : null), "Board is up", 30000);
  await settle(page, { quietMs: 1000, maxMs: 6000 });
}

/** The visible texts of one scene, trimmed. */
export const textsOf = async (page: Page, scene: string): Promise<string[]> =>
  (await visibleTexts(page)).filter((t) => t.scene === scene).map((t) => t.text.trim());

/** Every visible text on screen that looks like raw markup or an id: `[[term|label]]`, `undefined`, camelCase ids. */
export async function rawTextOnScreen(page: Page): Promise<string[]> {
  const bad = /\[\[|\]\]|\bundefined\b|\bnull\b|\[object|\bNaN\b|\b[a-z]+[A-Z][a-zA-Z]+\b(?=\s*$)/;
  return (await visibleTexts(page)).map((t) => t.text.trim()).filter((t) => bad.test(t));
}

/** Text objects whose box leaves the viewport (clipped): the screens' own copy should always fit. */
export async function clippedTexts(page: Page, scenes?: readonly string[]): Promise<string[]> {
  const size = page.viewportSize()!;
  return (await visibleTexts(page))
    .filter((t) => (scenes ? scenes.includes(t.scene) : true))
    .filter((t) => t.text.trim().length > 2 && (t.x - t.w / 2 < -2 || t.x + t.w / 2 > size.width + 2))
    .map((t) => `${t.scene}: ${t.text.slice(0, 50)}`);
}

export interface GuideRects {
  readonly anchor: Rect | null;
  readonly panels: unknown;
  readonly callouts: unknown;
}

export async function guideRects(page: Page): Promise<GuideRects> {
  return {
    anchor: await hook<Rect>(page, "__mcBoardDebug", "guideAnchorRect"),
    panels: await hook<unknown>(page, "__mcBoardDebug", "guidePanelRects"),
    callouts: await hook<unknown>(page, "__mcBoardDebug", "guideCalloutRects"),
  };
}

export const rectOnScreen = (page: Page, r: Rect | null): boolean => {
  if (!r) return false;
  const s = page.viewportSize()!;
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  return cx >= 0 && cx <= s.width && cy >= 0 && cy <= s.height;
};

/** The pending engine choice (a decision sheet), as the session store holds it. */
export const pendingChoice = (page: Page) =>
  facts(page, (g) =>
    g.pendingChoice ? { id: g.pendingChoice.id ?? null, n: g.pendingChoice.options?.length ?? 0 } : null,
  );

export { clickText, findText, focusRect, press, expect };

// ---------------------------------------------------------------------------------------------------------------
// Board driving shared by the lessons and the full game.
// ---------------------------------------------------------------------------------------------------------------

import { answerChoiceSheet, boardRound, screens, skipVillainPhase } from "./wave6-helpers-a.js";
import { payWith, playFromHand, pressCard } from "./x-men-helpers.js";

const BIG = { settle: { quietMs: 200, maxMs: 1000 } };

/** Presses a board control published as a focus rect (`basic:attack`, `basic:endTurn`...), as a click or a tap. */
export async function pressFocus(page: Page, phone: boolean, key: string): Promise<void> {
  const rect = await waitFor(() => focusRect(page, key), `a focus rect for ${key}`, 20000);
  await settle(page, BIG.settle);
  const now = (await focusRect(page, key)) ?? rect;
  await press(page, phone, now.x + now.width / 2, now.y + now.height / 2);
  await settle(page, { quietMs: 200, maxMs: 800 });
}

/** The first Board text matching `pattern`, pressed. */
export async function pressBoardText(page: Page, phone: boolean, pattern: RegExp, scene = "Board"): Promise<void> {
  const t = await waitFor(
    async () => (await visibleTexts(page)).find((x) => x.scene === scene && pattern.test(x.text.trim())) ?? null,
    `text ${pattern} on ${scene}`,
    15000,
  );
  await press(page, phone, t.x, t.y);
  await settle(page, { quietMs: 200, maxMs: 800 });
}

/** Instance ids by card code anywhere in the game: targets for a press. */
export async function instancesOf(page: Page, code: string): Promise<string[]> {
  return page.evaluate(async (c) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game?: { instances: Record<string, { cardId: string }> } } } };
    };
    const g = appSession().store.state.game!;
    return Object.entries(g.instances)
      .filter(([, i]) => i.cardId === c)
      .map(([id]) => id);
  }, code);
}

/** Presses a card on the table by instance id: its tile focus rect, else the board's hit map (a villain, a scheme). */
export async function pressInstance(page: Page, phone: boolean, id: string): Promise<void> {
  const rectOf = async (): Promise<Rect | null> =>
    (await focusRect(page, `card:${id}`)) ??
    (await page.evaluate(
      (i) =>
        (window as unknown as { __mcBoardDebug?: { hitRect(i: string): Rect | null } }).__mcBoardDebug?.hitRect(i) ??
        null,
      id,
    ));
  const rect = await waitFor(rectOf, `a rect for ${id}`, 15000);
  await settle(page, { quietMs: 200, maxMs: 800 });
  const now = (await rectOf()) ?? rect;
  await press(page, phone, now.x + now.width / 2, now.y + now.height / 2);
  await settle(page, { quietMs: 200, maxMs: 800 });
}

export async function villainId(page: Page): Promise<string> {
  return facts(page, (g) => g.villains[0].instanceId as string);
}

/** True while the board's payment bar is open (its own view of it, not a word that happens to read "pay"). */
export const paymentOpen = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => (window as unknown as { __mcBoardDebug?: { paymentView(): unknown } }).__mcBoardDebug?.paymentView() != null,
  );

/** Plays a hand card the way a player does (Inspect's Play on the phone), paying with the named hand cards. */
export async function playCard(
  page: Page,
  phone: boolean,
  code: string,
  payCodes: readonly string[] = [],
): Promise<void> {
  const id = await waitFor(() => handInstanceFor(page, code), `card ${code} in hand`, 15000);
  const hasPay = async (): Promise<boolean> =>
    (await paymentOpen(page)) ||
    (await visibleTexts(page)).some((t) => t.scene === "Board" && /^play it$/i.test(t.text.trim()));
  await playFromHand(page, phone, id, async () => (await hasPay()) || (await on(page, "ChoiceOverlay")));
  if (await on(page, "ChoiceOverlay")) return;
  if (await paymentOpen(page)) {
    const ids: string[] = [];
    for (const c of payCodes) {
      const h = await handInstanceFor(page, c);
      if (h) ids.push(h);
    }
    await payWith(page, phone, ids);
  } else {
    await pressBoardText(page, phone, /^play it$/i);
  }
  await settle(page, { quietMs: 400, maxMs: 2500 });
}

/** Answers the open decision sheet by real input with its first legal option (see wave6-helpers-a). */
export async function answerFirst(page: Page): Promise<void> {
  await answerChoiceSheet(page);
}

/** Words on a sheet's button that turn the offer down. */
const DECLINE_LABEL = /^(decline|don['’]t .+|no defender)$/i;

/**
 * Answers the open decision sheet by declining when it can be declined (an optional hero card, "Discard any cards?",
 * a defender pick), else with the first legal option: so a lesson's cards stay in hand while the villain phase runs.
 */
export async function answerPreferDecline(page: Page): Promise<void> {
  // The villain phase's own interrupt window (a defense card on offer) draws "Let it resolve" over the sheet.
  const walk = await textsOf(page, "VillainPhaseOverlay");
  const resolve = walk.find((t) => /^let it resolve$/i.test(t));
  if (resolve) {
    await clickText(page, resolve, { sceneKey: "VillainPhaseOverlay" });
    await settle(page, { quietMs: 200, maxMs: 1000 });
    return;
  }
  const texts = await textsOf(page, "ChoiceOverlay");
  const decline = texts.find((t) => DECLINE_LABEL.test(t));
  if (decline) await clickText(page, decline, { sceneKey: "ChoiceOverlay" });
  else await answerChoiceSheet(page);
  await settle(page, { quietMs: 200, maxMs: 1000 });
}

/**
 * Presses End turn, answers the confirm, and plays the villain phase through (every prompt the first legal way) until
 * round `fromRound + 1`'s player turn is on the Board, or the game ends. Returns the round then shown, or null at the end.
 */
export async function endTurnThrough(
  page: Page,
  phone: boolean,
  fromRound: number,
  timeoutMs = 120000,
): Promise<number | null> {
  await pressFocus(page, phone, "basic:endTurn");
  const start = Date.now();
  let lastSig = "";
  let same = 0;
  while (Date.now() - start < timeoutMs) {
    const scenes = await screens(page);
    if (scenes.includes("GameOver")) return null;
    if (scenes.includes("EndTurnConfirmOverlay")) {
      const rect = await page.evaluate(
        () =>
          (window as unknown as { __mcEndTurnConfirmDebug?: { endRect(): Rect } }).__mcEndTurnConfirmDebug?.endRect() ??
          null,
      );
      if (rect) await press(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2);
      else await pressBoardText(page, phone, /^end turn$/i, "EndTurnConfirmOverlay");
    } else if (scenes.includes("ChoiceOverlay")) {
      await answerPreferDecline(page);
    } else if (scenes.includes("VillainPhaseOverlay")) {
      await skipVillainPhase(page);
    } else if (scenes.includes("Board")) {
      const round = await boardRound(page);
      if (round !== null && round > fromRound && (await focusRect(page, "basic:endTurn"))) return round;
    }
    const sig = scenes.join(",");
    same = sig === lastSig ? same + 1 : 0;
    lastSig = sig;
    if (same > 120) throw new Error(`stuck on ${sig} in the villain phase`);
    await page.waitForTimeout(250); // loop pacing, not a blind wait
  }
  throw new Error(`round ${fromRound + 1} never started`);
}

export { pressCard, pressUntil, skipVillainPhase, boardRound };

/** The decision sheet's own controls by key (`option:<id>`, `confirm`, ...), as the sheet publishes them. */
export const choiceRects = (page: Page): Promise<[string, Rect][]> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcChoiceDebug?: { allRects(): [string, Rect][] } }).__mcChoiceDebug?.allRects() ?? [],
  );

/**
 * A "pay for this card" sheet (spend hand cards as resources): taps its options one at a time until the main button
 * stops saying "Pay N more", then presses it. The cards are tapped the way a player does, not read off the engine.
 */
export async function payOnSheet(page: Page, phone: boolean): Promise<void> {
  const label = async (): Promise<string> =>
    (await textsOf(page, "ChoiceOverlay")).find((t) => /^pay( \d+ more)?$/i.test(t)) ?? "";
  const options = ((await choiceRects(page)).filter(([key]) => key.startsWith("option:")) as [string, Rect][]).map(
    ([, rect]) => rect,
  );
  for (const rect of options) {
    if (/^pay$/i.test(await label())) break;
    await press(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2);
    await settle(page, { quietMs: 200, maxMs: 800 });
  }
  await pressBoardText(page, phone, /^pay$/i, "ChoiceOverlay");
  await settle(page, { quietMs: 300, maxMs: 1500 });
}

/** Hand cards of the first seat as `[instanceId, cardCode]`, in hand order. */
export const handCards = (page: Page): Promise<[string, string][]> =>
  facts(page, (g) => g.players[0].hand.map((id: string) => [id, g.instances[id].cardId]) as [string, string][]);

/**
 * Plays a hand card and pays with whichever other hand cards it takes: taps them one at a time until the board's own
 * payment bar says Pay would be accepted (a card prints one or two resources), then presses Pay.
 */
export async function playPayingWithOthers(
  page: Page,
  phone: boolean,
  code: string,
  keep: readonly string[],
): Promise<void> {
  const cards = await handCards(page);
  const target = cards.find(([, c]) => c === code)![0];
  await playFromHand(page, phone, target, async () => (await paymentOpen(page)) || (await on(page, "ChoiceOverlay")));
  const canPay = (): Promise<boolean> =>
    page.evaluate(
      () =>
        (
          window as unknown as { __mcBoardDebug?: { paymentView(): { command: unknown } | null } }
        ).__mcBoardDebug?.paymentView()?.command != null,
    );
  for (const [id, c] of cards) {
    if (id === target || keep.includes(c) || (await canPay())) continue;
    await pressCard(page, phone, id);
    await settle(page, { quietMs: 200, maxMs: 800 });
  }
  await waitFor(canPay, "the payment accepts Pay", 15000);
  await pressUntil(
    page,
    () => pressBoardText(page, phone, /^pay$/i),
    async () => !(await paymentOpen(page)),
    "Pay closes the payment",
  );
}

/**
 * The villain phase's "Declare your defender" panel: presses the option at `pick` (-1 for the last, which is the ally
 * when one is offered) and then Confirm, both through the controls the sheet publishes. False when it is not up.
 */
export async function declareDefender(page: Page, phone: boolean, pick: number): Promise<boolean> {
  const rects = await choiceRects(page);
  const options = rects.filter(([key]) => key.startsWith("option:"));
  const confirm = rects.find(([key]) => key === "confirm");
  if (options.length === 0 || !confirm) return false;
  const [, rect] = options.at(pick)!;
  await press(page, phone, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page, { quietMs: 300, maxMs: 1500 });
  const now = (await choiceRects(page)).find(([key]) => key === "confirm") ?? confirm;
  await press(page, phone, now[1].x + now[1].width / 2, now[1].y + now[1].height / 2);
  await settle(page, { quietMs: 300, maxMs: 1500 });
  return true;
}

/**
 * Taps `count` of the open sheet's options, one at a time and by identity: each tap re-reads where that option is now
 * (a sheet may lay chosen cards out apart from the rest), and an option already tapped is never tapped again. Options
 * for cards named in `avoidCodes` (the card being played, say) are skipped.
 */
export async function selectOptions(
  page: Page,
  phone: boolean,
  count: number,
  avoidCodes: readonly string[] = [],
): Promise<void> {
  await settle(page, { quietMs: 800, maxMs: 3000 });
  const avoid = new Set((await handCards(page)).filter(([, code]) => avoidCodes.includes(code)).map(([id]) => id));
  const tapped = new Set<string>();
  for (let i = 0; i < count; i++) {
    const options = (await choiceRects(page)).filter(
      ([key]) => key.startsWith("option:") && !avoid.has(key.slice(7)) && !tapped.has(key),
    );
    const next = options[0];
    if (!next) break;
    tapped.add(next[0]);
    const x = next[1].x + next[1].width / 2;
    const y = next[1].y + next[1].height / 2;
    if (phone) await tapAt(page, x, y);
    else await pressAt(page, x, y);
    await settle(page, { quietMs: 300, maxMs: 1000 });
  }
}

/**
 * A "spend N resources" sheet (Warpath's response, a payment by sheet): taps `count` options, then Confirm. A short
 * selection is accepted by the sheet as "do not pay", so the count is the caller's call from the price and the
 * resources each card prints.
 */
export async function spendOnSheet(
  page: Page,
  phone: boolean,
  count = 2,
  avoidCodes: readonly string[] = [],
): Promise<void> {
  await selectOptions(page, phone, count, avoidCodes);
  await shot(page, "e-warpath-selected");
  const confirm = (await choiceRects(page)).find(([key]) => key === "confirm");
  if (!confirm) return;
  await press(page, phone, confirm[1].x + confirm[1].width / 2, confirm[1].y + confirm[1].height / 2);
  await settle(page, { quietMs: 400, maxMs: 1500 });
}
