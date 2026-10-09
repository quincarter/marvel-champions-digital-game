/**
 * Guided mode's opportunistic-tip pacing (G10e part 2, `docs/guided-mode.md` §4 G10e), against a real Core Set
 * game (Rhino, solo Spider-Man) — the same fixture `guide-tips.test.ts` uses, so `tipsFor` actually has real
 * candidates to schedule.
 */
import { beforeEach, describe, expect, test } from "vitest";
import { instanceId, type GameEvent, type GameState, type PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { defaultGuidePrefs, type GuidePrefs } from "../guide/guide-prefs.js";
import type { LessonObservation } from "./lesson-model.js";
import { advance, initialTipScheduleState } from "./tip-schedule.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 4,
};

let store: SessionStore;
let base: GameState;
let me: PlayerId;

async function intoTurn(): Promise<void> {
  store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  base = store.state.game!;
  me = store.state.perspectiveId!;
}

beforeEach(intoTurn);

function observationOf(state: GameState, lastEvents: readonly GameEvent[] = []): LessonObservation {
  return { game: state, lastEvents, perspectiveId: me };
}

const OPEN: { readonly blocked: false; readonly suppress: readonly string[] } = { blocked: false, suppress: [] };
const BLOCKED: { readonly blocked: true; readonly suppress: readonly string[] } = { blocked: true, suppress: [] };

/** A "the player did something" batch — any real event works for `hasActionEvent` (it only reads `event.type`);
 * `cardExhausted` is a plain, harmless stand-in that isn't itself gated on anything else being true first. */
const ACTION_EVENTS: readonly GameEvent[] = [{ type: "cardExhausted", instanceId: instanceId("probe-instance") }];

/**
 * `advance`'s own transition-call rule (its header's "found in browser verification" comment): the call that
 * first establishes a turn key never counts that same call's events as the player's action, even a real one — a
 * mulligan decline's own batch, in a real game, also draws the opening hand. So every test below that wants a
 * *lifted* hold first spends one neutral call establishing the turn, then a second supplying `ACTION_EVENTS`.
 */
function intoActingTurn(state: GameState = base) {
  const opening = advance(initialTipScheduleState, observationOf(state), POOL_DEPS, defaultGuidePrefs, OPEN);
  return advance(opening.state, observationOf(state, ACTION_EVENTS), POOL_DEPS, defaultGuidePrefs, OPEN);
}

describe("advance: opening-turn hold", () => {
  test("round 1's first turn shows nothing before any action", () => {
    const result = advance(initialTipScheduleState, observationOf(base), POOL_DEPS, defaultGuidePrefs, OPEN);
    expect(result.tip).toBeNull();
  });

  test("a non-bookkeeping event lifts the hold and a tip appears", () => {
    const first = advance(initialTipScheduleState, observationOf(base), POOL_DEPS, defaultGuidePrefs, OPEN);
    expect(first.tip).toBeNull();
    const second = advance(first.state, observationOf(base, ACTION_EVENTS), POOL_DEPS, defaultGuidePrefs, OPEN);
    expect(second.tip).not.toBeNull();
  });

  test("bookkeeping-only events (turnStarted) never count as the action", () => {
    const events: readonly GameEvent[] = [{ type: "turnStarted", playerId: me }];
    const result = advance(initialTipScheduleState, observationOf(base, events), POOL_DEPS, defaultGuidePrefs, OPEN);
    expect(result.tip).toBeNull();
  });

  test("a later turn is never held back by the opening-turn rule", () => {
    const opening = advance(initialTipScheduleState, observationOf(base), POOL_DEPS, defaultGuidePrefs, OPEN);
    const laterTurn: GameState = { ...base, round: base.round + 1 };
    const result = advance(opening.state, observationOf(laterTurn), POOL_DEPS, defaultGuidePrefs, OPEN);
    expect(result.tip).not.toBeNull();
  });
});

describe("advance: one tip per turn", () => {
  test("a second candidate on the same turn does not show once one already has", () => {
    const first = intoActingTurn();
    expect(first.tip).not.toBeNull();
    const second = advance(first.state, observationOf(base, ACTION_EVENTS), POOL_DEPS, defaultGuidePrefs, OPEN);
    expect(second.tip).toBeNull();
  });

  test("a new turn resets the one-per-turn cap", () => {
    const first = intoActingTurn();
    expect(first.tip).not.toBeNull();
    const shownId = first.tip!.id;
    // A second, distinct candidate for the new turn to surface — an acceleration token on the main scheme
    // (`situation:acceleration` now needs *extra* acceleration, not just the scheme's own printed rate, so `base`
    // alone doesn't supply one).
    const nextTurn: GameState = {
      ...base,
      round: base.round + 1,
      mainScheme: { ...base.mainScheme, accelerationTokens: base.mainScheme.accelerationTokens + 1 },
    };
    const prefs: GuidePrefs = { ...defaultGuidePrefs, seenTips: [shownId] };
    // Unlike the opening turn, a later turn's own transition call is never held back (`turnKey !== firstTurnKey`
    // once the opening turn has passed), so this fires on the very first call for it — no second "acting" call
    // needed the way `intoActingTurn` needs one for round 1's own first turn.
    const result = advance(first.state, observationOf(nextTurn, ACTION_EVENTS), POOL_DEPS, prefs, OPEN);
    expect(result.tip).not.toBeNull();
    expect(result.tip!.id).not.toBe(shownId);
  });
});

describe("advance: blocked", () => {
  test("blocked never shows a tip, even past the opening hold", () => {
    const opening = advance(initialTipScheduleState, observationOf(base), POOL_DEPS, defaultGuidePrefs, BLOCKED);
    const result = advance(opening.state, observationOf(base, ACTION_EVENTS), POOL_DEPS, defaultGuidePrefs, BLOCKED);
    expect(result.tip).toBeNull();
  });

  test("turn/action tracking still advances while blocked, so unblocking mid-turn shows a tip immediately", () => {
    const openingHeld = advance(initialTipScheduleState, observationOf(base), POOL_DEPS, defaultGuidePrefs, BLOCKED);
    expect(openingHeld.tip).toBeNull();
    const actedWhileBlocked = advance(
      openingHeld.state,
      observationOf(base, ACTION_EVENTS),
      POOL_DEPS,
      defaultGuidePrefs,
      BLOCKED,
    );
    expect(actedWhileBlocked.tip).toBeNull();
    const unblocked = advance(actedWhileBlocked.state, observationOf(base), POOL_DEPS, defaultGuidePrefs, OPEN);
    expect(unblocked.tip).not.toBeNull();
  });
});

describe("advance: tips that fire under the overlay", () => {
  test("a candidate seen while blocked is held and shown on the first open call, even with no candidate then", () => {
    const opening = advance(initialTipScheduleState, observationOf(base), POOL_DEPS, defaultGuidePrefs, OPEN);
    const blocked = advance(opening.state, observationOf(base, ACTION_EVENTS), POOL_DEPS, defaultGuidePrefs, BLOCKED);
    expect(blocked.tip).toBeNull();
    expect(blocked.state.pending).toHaveLength(1);
    const heldId = blocked.state.pending[0]!.id;
    // The event batch is gone and every other candidate is marked seen: only the held tip can surface.
    const prefs: GuidePrefs = { ...defaultGuidePrefs, seenTips: [] };
    const open = advance(blocked.state, observationOf(base), POOL_DEPS, prefs, OPEN);
    expect(open.tip?.id).toBe(heldId);
    expect(open.state.pending).toHaveLength(0);
  });

  test("a held tip the player has since seen is dropped", () => {
    const opening = advance(initialTipScheduleState, observationOf(base), POOL_DEPS, defaultGuidePrefs, OPEN);
    const blocked = advance(opening.state, observationOf(base, ACTION_EVENTS), POOL_DEPS, defaultGuidePrefs, BLOCKED);
    const heldId = blocked.state.pending[0]!.id;
    const prefs: GuidePrefs = { ...defaultGuidePrefs, seenTips: [heldId] };
    const open = advance(blocked.state, observationOf(base), POOL_DEPS, prefs, OPEN);
    expect(open.tip?.id).not.toBe(heldId);
    expect(open.state.pending.map((tip) => tip.id)).not.toContain(heldId);
  });
});

describe("advance: suppress", () => {
  test("suppressing the winning candidate's own id keeps it from firing", () => {
    const baseline = intoActingTurn();
    expect(baseline.tip).not.toBeNull();
    const opening = advance(initialTipScheduleState, observationOf(base), POOL_DEPS, defaultGuidePrefs, OPEN);
    const suppressed = advance(opening.state, observationOf(base, ACTION_EVENTS), POOL_DEPS, defaultGuidePrefs, {
      blocked: false,
      suppress: [baseline.tip!.id],
    });
    expect(suppressed.tip?.id).not.toBe(baseline.tip!.id);
  });
});
