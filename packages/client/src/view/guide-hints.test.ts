/**
 * Guided mode's four hint heuristics (G9a, docs/guided-mode.md §5.2), against a real Core Set game (Rhino, solo
 * Spider-Man) — patched the same way `end-turn-confirm.test.ts` and `board-model.test.ts` patch state directly for
 * an edge case, so each test only has to change the one fact the heuristic cares about.
 */
import { beforeEach, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { cardId } from "@mc/content";
import {
  activeVillain,
  characterProfile,
  iconsInPlay,
  instanceId,
  mainSchemeValue,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { beginPayment, paymentView, togglePayment } from "./payment-model.js";
import { schemePanel } from "./board-model.js";
import { defaultGuidePrefs, type GuidePrefs } from "../guide/guide-prefs.js";
import { flipDangerHint, hintsFor, lethalHint, schemeFinishHint, wastedPayHint } from "./guide-hints.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 4,
};

let store: SessionStore;
let base: GameState;
let me: PlayerId;

/** Plays past setup, flipping to hero when asked, the same fixture `end-turn-confirm.test.ts` uses. */
async function intoTurn(flip: boolean): Promise<void> {
  store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  const legal = store.state.legal?.actions;
  if (flip && legal?.kind === "turn") {
    const flipEntry = legal.legal.find((entry) => entry.action.kind === "changeForm");
    if (flipEntry) await store.dispatch(flipEntry.example);
  }
  base = store.state.game!;
  me = store.state.perspectiveId!;
}

function withMainSchemeThreat(state: GameState, threat: number): GameState {
  const id = state.mainScheme.instanceId;
  return { ...state, instances: { ...state.instances, [id]: { ...state.instances[id]!, threat } } };
}

/** The exact step-1 threat this game would add next villain phase (acceleration + tokens + icons in play). */
function stepOneThreatOf(state: GameState): number {
  return (
    mainSchemeValue(state, "acceleration", CORE_DEPS) +
    state.mainScheme.accelerationTokens +
    iconsInPlay(state, CORE_DEPS, "acceleration")
  );
}

/** Crowd Control (01108): a real Core side scheme with the crisis icon, dropped straight into the villain area. */
function withCrisisSideScheme(state: GameState): GameState {
  const id = instanceId("crisis-test");
  return {
    ...state,
    villainArea: [...state.villainArea, id],
    instances: {
      ...state.instances,
      [id]: {
        instanceId: id,
        cardId: cardId("01108"),
        ownerId: null,
        controllerId: null,
        home: { kind: "encounterDeck", deckId: activeVillain(state).encounterDeckId },
        faceup: true,
        exhausted: false,
        damage: 0,
        threat: 1,
        statuses: { stunned: 0, confused: 0, tough: 0 },
        counters: {},
        attachedTo: null,
        attachments: [],
        boostCards: [],
        tucked: [],
        facedownAs: null,
        engagedWith: null,
        flipped: false,
      },
    },
  };
}

function withHeroDamage(state: GameState, playerId: PlayerId, damage: number, exhausted: boolean): GameState {
  const player = state.players.find((p) => p.playerId === playerId)!;
  const heroId = player.identity.instanceId;
  return { ...state, instances: { ...state.instances, [heroId]: { ...state.instances[heroId]!, damage, exhausted } } };
}

/** Gives the villain facedown boost cards, without flipping them — proving a hint never reads what they are. */
function withFacedownBoost(state: GameState, boostCards: readonly InstanceId[]): GameState {
  const villainId = activeVillain(state).instanceId;
  return {
    ...state,
    instances: { ...state.instances, [villainId]: { ...state.instances[villainId]!, boostCards } },
  };
}

/** Threat exactly `margin` short of the main scheme's own scaled target (`schemePanel`'s own number, not re-derived). */
function threatShortOfTarget(state: GameState, margin: number): number {
  const target = schemePanel(state, state.mainScheme.instanceId, CORE_DEPS, true).target!;
  return target - margin;
}

describe("schemeFinishHint", () => {
  beforeEach(() => intoTurn(true));

  test("fires when threat plus next villain phase's step-1 threat reaches the target", () => {
    const step1 = stepOneThreatOf(base);
    const state = withMainSchemeThreat(base, threatShortOfTarget(base, step1));
    const hint = schemeFinishHint(state, CORE_DEPS, me);
    expect(hint).not.toBeNull();
    expect(hint!.key).toBe("schemeFinish");
    expect(hint!.facts.projected).toBeGreaterThanOrEqual(hint!.facts.remaining as number);
  });

  test("does not fire while there's plenty of room left", () => {
    const state = withMainSchemeThreat(base, 0);
    expect(schemeFinishHint(state, CORE_DEPS, me)).toBeNull();
  });

  test("crisis in play: the safe action never offers 'Thwart first' against the main scheme", () => {
    const step1 = stepOneThreatOf(base);
    let state = withMainSchemeThreat(base, threatShortOfTarget(base, step1));
    state = withCrisisSideScheme(state);
    const hint = schemeFinishHint(state, CORE_DEPS, me);
    expect(hint).not.toBeNull();
    expect(hint!.safeAction).toBeNull();
    expect(hint!.anywayAction.label).toBe("End turn anyway");
  });
});

describe("lethalHint", () => {
  beforeEach(() => intoTurn(true));

  test("fires when the hero is exhausted, has no ready ally, and the villain's ATK reaches current HP", () => {
    const profile = characterProfile(base, base.players[0]!.identity.instanceId, CORE_DEPS)!;
    const villainAtk = characterProfile(base, activeVillain(base).instanceId, CORE_DEPS)!.atk;
    const damage = Math.max(0, profile.maxHp - villainAtk);
    const state = withHeroDamage(base, me, damage, true);
    const hint = lethalHint(state, CORE_DEPS, me);
    expect(hint).not.toBeNull();
    expect(hint!.key).toBe("lethal");
    expect(hint!.facts.totalAtk).toBeGreaterThanOrEqual(hint!.facts.currentHp as number);
  });

  test("does not fire at full health", () => {
    const state = withHeroDamage(base, me, 0, true);
    expect(lethalHint(state, CORE_DEPS, me)).toBeNull();
  });

  test("a boost range that isn't revealed never changes the total: facedown boost cards on the villain don't count", () => {
    const profile = characterProfile(base, base.players[0]!.identity.instanceId, CORE_DEPS)!;
    const villainAtk = characterProfile(base, activeVillain(base).instanceId, CORE_DEPS)!.atk;
    const damage = Math.max(0, profile.maxHp - villainAtk);
    const plain = withHeroDamage(base, me, damage, true);
    const boosted = withFacedownBoost(plain, [instanceId("boost-test-1"), instanceId("boost-test-2")]);
    const plainHint = lethalHint(plain, CORE_DEPS, me);
    const boostedHint = lethalHint(boosted, CORE_DEPS, me);
    expect(plainHint).not.toBeNull();
    expect(boostedHint).not.toBeNull();
    expect(boostedHint!.facts.totalAtk).toBe(plainHint!.facts.totalAtk);
  });
});

describe("flipDangerHint", () => {
  // Hero form: the "flip" trigger fires *before* the flip that would take the player to alter-ego.
  beforeEach(() => intoTurn(true));

  test("fires when flipping would let the villain's SCH plus step-1 threat complete the scheme", () => {
    const step1 = stepOneThreatOf(base);
    const villainSch = characterProfile(base, activeVillain(base).instanceId, CORE_DEPS)!.sch;
    const state = withMainSchemeThreat(base, threatShortOfTarget(base, step1 + villainSch));
    const hint = flipDangerHint(state, CORE_DEPS, me, "flip");
    expect(hint).not.toBeNull();
    expect(hint!.key).toBe("flipDanger");
    expect(hint!.safeAction?.label).toBe("Stay in hero form");
  });

  test("does not fire while there's plenty of room left", () => {
    const state = withMainSchemeThreat(base, 0);
    expect(flipDangerHint(state, CORE_DEPS, me, "flip")).toBeNull();
  });

  test("does not fire for the 'endTurn' trigger while still in hero form", () => {
    expect(flipDangerHint(base, CORE_DEPS, me, "endTurn")).toBeNull();
  });
});

describe("wastedPayHint", () => {
  beforeEach(() => intoTurn(true));

  test("fires on an overpay", () => {
    const legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const entry = legal.legal.find((candidate) => candidate.action.kind === "playCard" && candidate.needsPayment);
    if (!entry) return; // Nothing costed this seed; the case can't be posed.
    const opened = beginPayment(base, me, entry.action, null, CORE_DEPS)!;
    const picked = { ...opened, picked: opened.query.suggested };
    const extra = picked.query.sources.find((source) => !picked.picked.includes(source.optionId));
    if (!extra) return; // Nothing spare in hand this seed.
    const overpaid = togglePayment(picked, extra.optionId);
    const view = paymentView(base, me, overpaid, "test", CORE_DEPS);
    const hint = wastedPayHint(base, view);
    expect(hint).not.toBeNull();
    expect(hint!.key).toBe("wastedPay");
    expect(hint!.facts.paid).toBeGreaterThan(hint!.facts.required as number);
  });

  test("does not fire on the engine's own suggested payment", () => {
    const legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const entry = legal.legal.find((candidate) => candidate.action.kind === "playCard" && candidate.needsPayment);
    if (!entry) return;
    const opened = beginPayment(base, me, entry.action, null, CORE_DEPS)!;
    const view = paymentView(base, me, { ...opened, picked: opened.query.suggested }, "test", CORE_DEPS);
    expect(wastedPayHint(base, view)).toBeNull();
  });
});

describe("hintsFor", () => {
  beforeEach(() => intoTurn(true));

  test("drops a silenced key", () => {
    const step1 = stepOneThreatOf(base);
    const state = withMainSchemeThreat(base, threatShortOfTarget(base, step1));
    const fired = hintsFor({ state, deps: CORE_DEPS, playerId: me, trigger: { kind: "endTurn" } }, defaultGuidePrefs);
    expect(fired.some((h) => h.key === "schemeFinish")).toBe(true);

    const silenced: GuidePrefs = { ...defaultGuidePrefs, silencedWarnings: ["schemeFinish"] };
    const stillFired = hintsFor({ state, deps: CORE_DEPS, playerId: me, trigger: { kind: "endTurn" } }, silenced);
    expect(stillFired.some((h) => h.key === "schemeFinish")).toBe(false);
  });

  test("returns nothing at guide level 'off'", () => {
    const step1 = stepOneThreatOf(base);
    const state = withMainSchemeThreat(base, threatShortOfTarget(base, step1));
    const off: GuidePrefs = { ...defaultGuidePrefs, level: "off" };
    expect(hintsFor({ state, deps: CORE_DEPS, playerId: me, trigger: { kind: "endTurn" } }, off)).toEqual([]);
  });
});
