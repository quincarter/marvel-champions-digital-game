import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, focusRect, settle, waitFor } from "./helpers.js";
import {
  installWave6Helpers,
  screens,
  skipVillainPhase,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";
import { declineMulligans, openApp, startGame } from "./wave6-helpers-b.js";
import {
  SHOTS,
  VIEWPORTS,
  answerPreferDecline,
  choiceRects,
  declareDefender,
  handCards,
  on,
  payOnSheet,
  pressBoardText,
  pressFocus,
  pressInstance,
  selectOptions,
  spendOnSheet,
  shot,
  textsOf,
  type Vp,
} from "./wave7-screens-helpers.js";
import { boardUp, facts, payWith, playFromHand, press } from "./x-men-helpers.js";

/**
 * A full solo game of NeXt Evolution played in the browser through the real board, at 1440 and at 390: Deadpool's 'Pool
 * precon against Morlock Siege (standard, seed 6, the pairing `docs/phase7-wave7-qa-built-deck-games.md` found a win
 * for with a headless driver). The policy is deliberately simple: flip to hero form when healthy, play what the hand can
 * afford, thwart when the main scheme is close and attack otherwise, end the turn; every prompt is answered the first
 * legal way (an optional ability is declined, a mandatory pick takes its first option). It plays to the Game Over
 * screen, win or lose, and asserts the outcome shown matches the game's, the track played is the outcome's, and Back
 * to title returns to Title, with no console error and no stall.
 *
 * Slow (the first run of this took several minutes), so it only runs when `E2E_FULL_GAME=1` is set:
 *   E2E_FULL_GAME=1 E2E_PORT=5344 pnpm exec playwright test e2e/wave7-full-game.spec.ts --workers=1
 * Findings: `docs/phase7-wave7-qa-screens.md`.
 */

const STALL_MS = 120_000;
const GAME_BUDGET_MS = 14 * 60_000;

interface LegalView {
  readonly kind: string;
  readonly instanceId: string | null;
  readonly code: string | null;
  readonly targets: string[];
  readonly needsPayment: boolean;
  /** Hand cards the example payment spends, or null when it pays another way (a resource ability). */
  readonly payWith: string[] | null;
  readonly to: string | null;
}

interface TurnView {
  readonly round: number;
  readonly form: string;
  readonly damage: number;
  readonly mainThreat: number;
  readonly mainTarget: number;
  readonly legal: LegalView[];
  readonly commands: number;
  readonly outcome: string | null;
  readonly pending: boolean;
}

/** One plain-data read of what the board is waiting on: the store's own legal list for the seat that must act. */
const readTurn = (page: Page): Promise<TurnView | null> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: any } };
    };
    const state = appSession().store.state;
    const game = state.game;
    if (!game) return null;
    const actions = state.legal?.actions;
    const me = game.players[0];
    const identity = game.instances[me.identity.instanceId];
    const main = game.instances[game.mainScheme.instanceId];
    const legal =
      actions?.kind === "turn"
        ? actions.legal.map((entry: any) => {
            const a = entry.action;
            const payment = entry.example?.payment;
            return {
              kind: a.kind,
              instanceId: a.instanceId ?? null,
              code: a.instanceId ? (game.instances[a.instanceId]?.cardId ?? null) : null,
              targets: entry.targets ?? [],
              needsPayment: !!entry.needsPayment,
              payWith: payment
                ? payment.every((p: any) => "fromHand" in p)
                  ? payment.map((p: any) => p.fromHand)
                  : null
                : [],
              to: a.to ? JSON.stringify(a.to) : null,
            };
          })
        : [];
    return {
      round: game.round,
      form: me.identity.form,
      damage: identity?.damage ?? 0,
      mainThreat: main?.threat ?? 0,
      mainTarget: game.mainScheme.targetThreat ?? 0,
      legal,
      commands: state.commandTrail.length,
      outcome: game.outcome ? game.outcome.result : null,
      pending: !!game.pendingChoice,
    };
  });

const commandCount = async (page: Page): Promise<number> => (await readTurn(page))?.commands ?? -1;

/** Answers whatever is up, the first legal way. True when something was answered. */
async function answerWhatIsUp(page: Page, phone: boolean, log: string[]): Promise<boolean> {
  const scenes = await screens(page);
  if (scenes.includes("EndTurnConfirmOverlay")) {
    await pressBoardText(page, phone, /^end turn$/i, "EndTurnConfirmOverlay");
    return true;
  }
  if (scenes.includes("ScenarioIntro")) {
    await clickText(page, "Skip", { sceneKey: "ScenarioIntro", timeoutMs: 5000 }).catch(() => undefined);
    return true;
  }
  // A decision can sit under the villain phase's own panel (the scene list is the draw order): the panel's Continue
  // is then the only live control, and pressing it uncovers the sheet.
  if (scenes.includes("ChoiceOverlay") && scenes.includes("VillainPhaseOverlay")) {
    const order = await activeScenes(page);
    const walk = await textsOf(page, "VillainPhaseOverlay");
    if (
      order.indexOf("VillainPhaseOverlay") > order.indexOf("ChoiceOverlay") &&
      walk.some((t) => /^continue$/i.test(t))
    ) {
      log.push("sheet under the villain-phase panel: pressed Continue");
      await skipVillainPhase(page);
      await settle(page, { quietMs: 300, maxMs: 1500 });
      return true;
    }
  }
  if (scenes.includes("ChoiceOverlay") || scenes.includes("VillainPhaseOverlay")) {
    await settle(page, { quietMs: 400, maxMs: 2000 });
    const sheet = await textsOf(page, "ChoiceOverlay");
    const walk = await textsOf(page, "VillainPhaseOverlay");
    const title =
      sheet.find((t) => /^.+: (.+\?|choose .+)$/i.test(t) || /^(discard|mulligan|choose|pick|declare) /i.test(t)) ??
      sheet[0] ??
      "";
    log.push(`${walk.length ? "villain-phase " : ""}${title}`);
    const sel = sheet.map((t) => /^select (\d+)(?:\s*[–-]\s*(\d+))?\b/i.exec(t)).find((m) => m !== null);
    const min = sel ? Number(sel[1]) : 0;
    if (/pay for this card/i.test(title)) await payOnSheet(page, phone);
    else if (/spend (\d+) resources\?/i.test(title))
      await spendOnSheet(page, phone, Number(/spend (\d+)/i.exec(title)![1]));
    else if (sheet.some((t) => /declare your defender/i.test(t)) && (await declareDefender(page, phone, 0)))
      log.push("declared the first defender");
    else if (/mulligan/i.test(title) || sheet.some((t) => /^decline$/i.test(t))) await answerPreferDecline(page);
    else if (walk.some((t) => /^let it resolve$/i.test(t))) await answerPreferDecline(page);
    else if (scenes.includes("ChoiceOverlay")) {
      // A mandatory pick (or an ordering): tap as many options as it needs, the first ones, then Confirm.
      const preselected = sheet.some((t) => /^selected [1-9]/i.test(t));
      const need = preselected ? 0 : Math.max(min, 1);
      await selectOptions(page, phone, need);
      const now = (await choiceRects(page)).find(([key]) => key === "confirm");
      if (now) await press(page, phone, now[1].x + now[1].width / 2, now[1].y + now[1].height / 2);
    } else {
      const skip = walk.find((t) => /^(continue|skip)$/i.test(t));
      if (skip) await clickText(page, skip, { sceneKey: "VillainPhaseOverlay" });
    }
    await settle(page, { quietMs: 300, maxMs: 1500 });
    return true;
  }
  return false;
}

/** Plays a hand card the way the player does: tap it (Inspect's Play on the phone), then tap the cards that pay. */
async function playEntry(page: Page, phone: boolean, entry: LegalView, hand: [string, string][]): Promise<void> {
  const id = entry.instanceId!;
  const spentOrPrompt = async (): Promise<boolean> =>
    (await on(page, "ChoiceOverlay")) ||
    (await page.evaluate(
      () =>
        (window as unknown as { __mcBoardDebug?: { paymentView(): unknown } }).__mcBoardDebug?.paymentView() != null,
    )) ||
    (await textsOf(page, "Board")).some((t) => /^play it$/i.test(t));
  await playFromHand(page, phone, id, spentOrPrompt);
  if (await on(page, "ChoiceOverlay")) return;
  const paying = await page.evaluate(
    () => (window as unknown as { __mcBoardDebug?: { paymentView(): unknown } }).__mcBoardDebug?.paymentView() != null,
  );
  if (paying) await payWith(page, phone, entry.payWith ?? []);
  else await pressBoardText(page, phone, /^play it$/i);
  void hand;
}

async function playOneGame(
  page: Page,
  phone: boolean,
  notes: string[],
): Promise<{ result: string | null; rounds: number; commands: number; log: string[] }> {
  const started = Date.now();
  let lastProgress = Date.now();
  let lastSig = "";
  let last: TurnView | null = null;
  const blocked = new Set<string>();
  let blockedRound = 0;
  const log: string[] = [];
  while (Date.now() - started < GAME_BUDGET_MS) {
    const scenes = await screens(page);
    if (scenes.includes("GameOver")) break;
    const turn = await readTurn(page);
    if (turn) last = turn;
    const sig = `${scenes.join(",")}|${turn?.commands}|${turn?.round}`;
    if (sig !== lastSig) {
      lastSig = sig;
      lastProgress = Date.now();
    } else if (Date.now() - lastProgress > STALL_MS) {
      await shot(page, "full-stall");
      throw new Error(`stalled ${STALL_MS / 1000}s on ${sig}; last prompts: ${log.slice(-6).join(" / ")}`);
    }
    if (await answerWhatIsUp(page, phone, log)) continue;
    if (!scenes.includes("Board") || !turn || turn.legal.length === 0) {
      await page.waitForTimeout(300); // loop pacing, not a blind wait
      continue;
    }
    if (turn.round !== blockedRound) {
      blocked.clear();
      blockedRound = turn.round;
    }
    if (turn.pending) {
      await page.waitForTimeout(300); // loop pacing, not a blind wait
      continue;
    }
    const hand = await handCards(page);
    const has = (kind: string) =>
      turn.legal.find((e) => e.kind === kind && !blocked.has(`${kind}:${e.instanceId}:${e.to}`));
    const attempt = async (key: string, run: () => Promise<void>): Promise<void> => {
      const before = turn.commands;
      try {
        await run();
        await waitFor(
          async () => ((await commandCount(page)) > before || (await on(page, "ChoiceOverlay")) ? true : null),
          `${key} takes`,
          20000,
        );
      } catch {
        blocked.add(key);
        notes.push(`blocked ${key} in round ${turn.round}`);
        for (let i = 0; i < 3 && (await on(page, "InspectOverlay")); i++) await page.keyboard.press("Escape");
      }
    };
    const flip = has("changeForm");
    if (turn.form === "alterEgo" && flip) {
      const recover = has("basicRecover");
      if (turn.damage >= 6 && recover) await attempt("recover", () => pressFocus(page, phone, "basic:recover"));
      else await attempt(`changeForm:null:${flip.to}`, () => pressFocus(page, phone, "basic:changeForm"));
      continue;
    }
    const play = turn.legal.find(
      (e) =>
        e.kind === "playCard" &&
        e.payWith !== null &&
        !blocked.has(`playCard:${e.instanceId}:${e.to}`) &&
        hand.some(([id]) => id === e.instanceId),
    );
    if (play) {
      await attempt(`playCard:${play.instanceId}:${play.to}`, () => playEntry(page, phone, play, hand));
      continue;
    }
    const thwart = has("basicThwart");
    const attack = has("basicAttack");
    const urgent = turn.mainThreat >= Math.max(2, turn.mainTarget - 3);
    const pick = urgent && thwart ? thwart : (attack ?? thwart);
    if (pick) {
      const key = `${pick.kind}:${pick.instanceId}:${pick.to}`;
      await attempt(key, async () => {
        const before = await commandCount(page);
        await pressFocus(page, phone, pick.kind === "basicAttack" ? "basic:attack" : "basic:thwart");
        await settle(page, { quietMs: 500, maxMs: 2500 });
        if ((await commandCount(page)) === before && !(await on(page, "ChoiceOverlay")) && pick.targets[0])
          await pressInstance(page, phone, pick.targets[0]);
      });
      continue;
    }
    const end = has("endTurn");
    if (end) {
      await attempt("endTurn", () => pressFocus(page, phone, "basic:endTurn"));
      continue;
    }
    await page.waitForTimeout(300); // loop pacing, not a blind wait
  }
  notes.push(`prompts answered: ${log.length}; first 12: ${log.slice(0, 12).join(" / ")}`);
  return { result: last?.outcome ?? null, rounds: last?.round ?? 0, commands: last?.commands ?? 0, log };
}

test.describe("full game in the browser", () => {
  test.skip(!process.env.E2E_FULL_GAME, "slow: set E2E_FULL_GAME=1 to play the full game");

  for (const vp of Object.keys(VIEWPORTS) as Vp[]) {
    test(`Deadpool 'Pool vs Morlock Siege (seed 6) at ${VIEWPORTS[vp].width}: played to Game Over and back to Title`, async ({
      browser,
    }) => {
      test.slow();
      test.setTimeout(18 * 60_000);
      const phone = vp === "phone";
      const context = await browser.newContext({
        viewport: VIEWPORTS[vp],
        reducedMotion: "reduce",
        ...(phone ? { hasTouch: true, isMobile: true } : {}),
      });
      const page = await context.newPage();
      const errors = trackErrors(page);
      const requested: string[] = [];
      page.on("request", (r) => {
        if (/\.mp3(\?|$)/.test(r.url())) requested.push(r.url());
      });
      await installWave6Helpers(page);
      await openApp(page, "unlock=all");
      await startGame(page, { scenarioId: "morlock-siege", decks: ["deadpool-pool"], seed: 6 });
      await boardUp(page);
      await declineMulligans(page);
      await settle(page, { quietMs: 800, maxMs: 4000 });
      await shot(page, "full-start");
      expect(
        requested.some((u) => u.includes("/morlock-siege/battle")),
        "the Board asked for Morlock Siege's battle track",
      ).toBe(true);

      const notes: string[] = [];
      const t0 = Date.now();
      const game = await playOneGame(page, phone, notes);
      console.log(
        `LOG full game ${vp}: result=${game.result} rounds=${game.rounds} commands=${game.commands} in ${Math.round((Date.now() - t0) / 1000)} s; ${notes.join(" | ")}`,
      );
      await waitForScene(page, "GameOver", 30000);
      await settle(page, { quietMs: 1000, maxMs: 5000 });
      await shot(page, "full-gameover");
      const texts = (await visibleTexts(page)).filter((t) => t.scene === "GameOver").map((t) => t.text.trim());
      const shown = texts.join(" | ");
      console.log("LOG gameover", shown.slice(0, 400));
      // The store clears the game as the screen changes, so the outcome is read from the screen's own headline: a
      // loss reads "<VILLAIN> WINS THIS ONE" or "THE SCHEME WINS" (the final-blow box says how), a win says victory.
      const shownLoss =
        /wins this one|the scheme wins|villain wins|heroes down|conceded|defeated/i.test(texts[0] ?? "") ||
        /wins this one|the scheme wins/i.test(shown);
      const shownWin = /victory|heroes win|you won|villain defeated/i.test(shown) && !shownLoss;
      expect(shownLoss || shownWin, `Game Over shows an outcome (saw: ${shown.slice(0, 200)})`).toBe(true);
      if (game.result !== null) expect(game.result === "win", "the screen matches the game's outcome").toBe(shownWin);
      const outcomeTrack = shownWin ? "villain-loses" : "villain-wins";
      await waitFor(
        async () => (requested.some((u) => u.includes(`/morlock-siege/${outcomeTrack}`)) ? true : null),
        `the ${outcomeTrack} track was requested`,
        15000,
      );
      await pressUntilTitle(page, phone);
      expect(errors, "no console or page errors").toEqual([]);
      void SHOTS;
      void focusRect;
      void activeScenes;
      void facts;
      await context.close();
    });
  }
});

async function pressUntilTitle(page: Page, phone: boolean): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 30000) {
    if (await on(page, "Title")) return;
    const back = (await visibleTexts(page)).find(
      (t) => t.scene === "GameOver" && /^back to title$/i.test(t.text.trim()),
    );
    if (back) await press(page, phone, back.x, back.y);
    await page.waitForTimeout(800); // loop pacing, not a blind wait
  }
  throw new Error("Back to title never reached Title");
}

/**
 * Pinned defect (fixme, so it does not run): seen in a first desktop run of this game (round 2, before the driver
 * pressed Continue on such a panel), a hero decision ("Healing Factor:
 * trigger an ability?") opens beneath the villain phase's own "Villain phase complete" panel. The panel is drawn above
 * the sheet, so the sheet's Decline is under it and presses on it do nothing until the panel's Continue is pressed.
 * Owner: the scene order of `scenes/villain-phase-overlay.ts` and `scenes/choice.ts` (the choice should be brought to
 * the top, or the panel should not offer to complete while a decision is pending).
 */
test.fixme("a decision never opens beneath the villain phase's panel", async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop, reducedMotion: "reduce" });
  const page = await context.newPage();
  await installWave6Helpers(page);
  await openApp(page, "unlock=all");
  await startGame(page, { scenarioId: "morlock-siege", decks: ["deadpool-pool"], seed: 6 });
  await boardUp(page);
  await declineMulligans(page);
  const game = await playOneGame(page, false, []);
  expect(game.log.filter((entry) => /under the villain-phase panel/.test(entry))).toEqual([]);
  await context.close();
});
