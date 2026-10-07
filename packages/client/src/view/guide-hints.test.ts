/**
 * Guided mode's four hint heuristics (G9a, docs/guided-mode.md §5.2), against a real Core Set game (Rhino, solo
 * Spider-Man) — patched the same way `end-turn-confirm.test.ts` and `board-model.test.ts` patch state directly for
 * an edge case, so each test only has to change the one fact the heuristic cares about.
 */
import { beforeEach, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { cardId, cycleId, encounterSetId, setCode, unerrataedText, type MinionCard } from "@mc/content";
import {
  activeVillain,
  characterProfile,
  iconsInPlay,
  instanceId,
  mainSchemeValue,
  type ActionRef,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { beginPayment, paymentView, togglePayment } from "./payment-model.js";
import { schemePanel } from "./board-model.js";
import { defaultGuidePrefs, type GuidePrefs } from "../guide/guide-prefs.js";
import {
  flipDangerHint,
  hintsFor,
  lethalHint,
  schemeCloseHint,
  schemeFinishHint,
  wastedPayHint,
} from "./guide-hints.js";

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

function withVillainStunned(state: GameState): GameState {
  const villainId = activeVillain(state).instanceId;
  const villainInstance = state.instances[villainId]!;
  return {
    ...state,
    instances: {
      ...state.instances,
      [villainId]: { ...villainInstance, statuses: { ...villainInstance.statuses, stunned: 1 } },
    },
  };
}

/** A ready Daredevil (01058: ATK 2, HP 3) dropped into `playerId`'s play area, for `lethalHint`'s best-block math. */
function withAllyInPlay(state: GameState, playerId: PlayerId, damage = 0): GameState {
  const id = instanceId(`ally-test-${playerId}`);
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === playerId ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: {
      ...state.instances,
      [id]: {
        instanceId: id,
        cardId: cardId("01058"),
        ownerId: playerId,
        controllerId: playerId,
        home: { kind: "player" },
        faceup: true,
        exhausted: false,
        damage,
        threat: 0,
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

/** A fabricated minion (own `cardPool` entry, so a test can give it Overkill without any real card printing it). */
function withMinionEngaged(
  state: GameState,
  playerId: PlayerId,
  opts: { readonly atk: number; readonly overkill?: boolean; readonly stunned?: boolean },
): GameState {
  const cid = cardId(`guide-hints-test-minion-${opts.atk}-${opts.overkill ? "ok" : "plain"}`);
  const minion: MinionCard = {
    id: cid,
    type: "minion",
    name: "Test Minion",
    setCode: setCode("core"),
    cycleId: cycleId("core"),
    collectorNumber: "test",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("guide-hints-test")],
    boostIcons: 0,
    traits: [],
    keywords: opts.overkill ? [{ name: "overkill" }] : [],
    atk: opts.atk,
    sch: 0,
    hp: 5,
    text: unerrataedText(""),
    abilities: [],
  };
  const id = instanceId(`minion-test-${playerId}-${opts.atk}`);
  return {
    ...state,
    cardPool: { ...state.cardPool, [cid]: minion },
    players: state.players.map((p) => (p.playerId === playerId ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: {
      ...state.instances,
      [id]: {
        instanceId: id,
        cardId: cid,
        ownerId: null,
        controllerId: playerId,
        home: { kind: "activeEncounterDeck" },
        faceup: true,
        exhausted: false,
        damage: 0,
        threat: 0,
        statuses: { stunned: opts.stunned ? 1 : 0, confused: 0, tough: 0 },
        counters: {},
        attachedTo: null,
        attachments: [],
        boostCards: [],
        tucked: [],
        facedownAs: null,
        engagedWith: playerId,
        flipped: false,
      },
    },
  };
}

/** Threat exactly `margin` short of the main scheme's own scaled target (`schemePanel`'s own number, not re-derived). */
function threatShortOfTarget(state: GameState, margin: number): number {
  const target = schemePanel(state, state.mainScheme.instanceId, CORE_DEPS, true).target!;
  return target - margin;
}

/** Surgically moves each `codes` card (already in the deck or already drawn) into `playerId`'s hand, so a test can
 * pose a specific hand without depending on the seed's own draw order. */
function moveToHand(
  state: GameState,
  playerId: PlayerId,
  codes: readonly string[],
): { state: GameState; ids: readonly InstanceId[] } {
  const player = state.players.find((p) => p.playerId === playerId)!;
  const ids: InstanceId[] = [];
  const takenFromDeck = new Set<InstanceId>();
  for (const code of codes) {
    const inHand = player.hand.find((id) => state.instances[id]?.cardId === cardId(code));
    if (inHand) {
      ids.push(inHand);
      continue;
    }
    const inDeck = player.deck.find((id) => state.instances[id]?.cardId === cardId(code));
    if (!inDeck) throw new Error(`${code} not found in ${playerId}'s deck or hand`);
    takenFromDeck.add(inDeck);
    ids.push(inDeck);
  }
  return {
    ids,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === playerId
          ? { ...p, deck: p.deck.filter((id) => !takenFromDeck.has(id)), hand: [...p.hand, ...takenFromDeck] }
          : p,
      ),
    },
  };
}

describe("schemeFinishHint", () => {
  beforeEach(() => intoTurn(true));

  test("'Thwart first' reads ATK against an assault main scheme and THW otherwise (RRG 1.8 p. 8)", () => {
    const hero = base.players[0]!.identity.instanceId;
    const profile = characterProfile(base, hero, POOL_DEPS)!;
    expect(profile.atk).not.toBe(profile.thw);
    const ready = withMainSchemeThreat(base, threatShortOfTarget(base, stepOneThreatOf(base)));
    expect(schemeFinishHint(ready, POOL_DEPS, me)!.safeAction?.label).toBe(`Thwart first −${profile.thw}`);
    // Keep Them Busy (43018), a real assault scheme without crisis (Territorial Control has it), stands in as the main scheme's card.
    const id = ready.mainScheme.instanceId;
    const assault = {
      ...ready,
      instances: { ...ready.instances, [id]: { ...ready.instances[id]!, cardId: cardId("43018") } },
    };
    expect(schemeFinishHint(assault, POOL_DEPS, me)!.safeAction?.label).toBe(`Thwart first −${profile.atk}`);
  });

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

  /** The hero's damage such that exactly `remaining` HP is left, un-exhausted (everyone readies by end of turn). */
  function withHeroHpRemaining(state: GameState, remaining: number): GameState {
    const profile = characterProfile(state, state.players[0]!.identity.instanceId, CORE_DEPS)!;
    return withHeroDamage(state, me, Math.max(0, profile.maxHp - remaining), false);
  }

  /** The villain's ATK after the hero's own best (DEF-reduced) block of it — what `lethalHint` actually compares. */
  function bestBlockedVillainAtk(state: GameState): number {
    const heroId = state.players.find((p) => p.playerId === me)!.identity.instanceId;
    const heroDef = characterProfile(state, heroId, CORE_DEPS)!.def;
    const villainAtk = characterProfile(state, activeVillain(state).instanceId, CORE_DEPS)!.atk;
    return Math.max(0, villainAtk - heroDef);
  }

  test("one big attack, no allies, low HP: fires", () => {
    const reduced = bestBlockedVillainAtk(base);
    if (reduced <= 0) return; // this hero's DEF already zeroes the villain's ATK; nothing to pose.
    const state = withHeroHpRemaining(base, reduced);
    const hint = lethalHint(state, CORE_DEPS, me);
    expect(hint).not.toBeNull();
    expect(hint!.key).toBe("lethal");
    expect(hint!.facts.bestCaseDamage).toBeGreaterThanOrEqual(hint!.facts.currentHp as number);
  });

  test("the same attack, but an ally that can absorb it: does not fire", () => {
    const reduced = bestBlockedVillainAtk(base);
    if (reduced <= 0) return;
    const lowHp = withHeroHpRemaining(base, reduced);
    const state = withAllyInPlay(lowHp, me);
    expect(lethalHint(state, CORE_DEPS, me)).toBeNull();
  });

  test("the hero's DEF is enough to survive: does not fire", () => {
    const heroId = base.players.find((p) => p.playerId === me)!.identity.instanceId;
    const heroDef = characterProfile(base, heroId, CORE_DEPS)!.def;
    const villainAtk = characterProfile(base, activeVillain(base).instanceId, CORE_DEPS)!.atk;
    if (villainAtk - heroDef <= 0) return; // this hero's DEF already zeroes the villain's ATK; nothing to pose.
    // Exactly enough HP to survive the DEF-reduced hit, not the raw ATK.
    const state = withHeroHpRemaining(base, villainAtk - heroDef);
    expect(lethalHint(state, CORE_DEPS, me)).toBeNull();
  });

  test("an Overkill attacker blocked by an ally: fires when the excess is lethal", () => {
    // Daredevil (01058) has 3 HP; a 9 ATK Overkill attacker leaves 6 excess after he's blocked it and fallen.
    const withMinion = withMinionEngaged(base, me, { atk: 9, overkill: true });
    const villainId = activeVillain(withMinion).instanceId;
    const withVillainDown = {
      ...withMinion,
      villains: withMinion.villains.map((v) => (v.instanceId === villainId ? { ...v, defeated: true } : v)),
    };
    const withAlly = withAllyInPlay(withVillainDown, me);
    const state = withHeroHpRemaining(withAlly, 5); // less than the 6 excess.
    const hint = lethalHint(state, CORE_DEPS, me);
    expect(hint).not.toBeNull();
    expect(hint!.facts.bestCaseDamage).toBe(6);
  });

  test("a stunned attacker is ignored", () => {
    const villainAtk = characterProfile(base, activeVillain(base).instanceId, CORE_DEPS)!.atk;
    const lowHp = withHeroHpRemaining(base, villainAtk);
    const state = withVillainStunned(lowHp);
    expect(lethalHint(state, CORE_DEPS, me)).toBeNull();
  });

  test("does not fire at full health", () => {
    const state = withHeroDamage(base, me, 0, false);
    expect(lethalHint(state, CORE_DEPS, me)).toBeNull();
  });

  test("alter-ego: never fires", async () => {
    await intoTurn(false); // in alter-ego form.
    const villainAtk = characterProfile(base, activeVillain(base).instanceId, CORE_DEPS)!.atk;
    const state = withHeroHpRemaining(base, villainAtk);
    expect(lethalHint(state, CORE_DEPS, me)).toBeNull();
  });

  test("a boost range that isn't revealed never changes the total: facedown boost cards on the villain don't count", () => {
    const reduced = bestBlockedVillainAtk(base);
    if (reduced <= 0) return;
    const plain = withHeroHpRemaining(base, reduced);
    const boosted = withFacedownBoost(plain, [instanceId("boost-test-1"), instanceId("boost-test-2")]);
    const plainHint = lethalHint(plain, CORE_DEPS, me);
    const boostedHint = lethalHint(boosted, CORE_DEPS, me);
    expect(plainHint).not.toBeNull();
    expect(boostedHint).not.toBeNull();
    expect(boostedHint!.facts.totalAtk).toBe(plainHint!.facts.totalAtk);
  });
});

describe("schemeCloseHint", () => {
  beforeEach(() => intoTurn(true));

  test("fires 1 threat away (after the visible add)", () => {
    const step1 = stepOneThreatOf(base);
    const state = withMainSchemeThreat(base, threatShortOfTarget(base, step1 + 1));
    const hint = schemeCloseHint(state, CORE_DEPS, me);
    expect(hint).not.toBeNull();
    expect(hint!.key).toBe("schemeClose");
    expect(hint!.facts.away).toBe(1);
    expect(schemeFinishHint(state, CORE_DEPS, me)).toBeNull(); // the two never both fire for the same state.
  });

  test("fires 2 threat away (after the visible add)", () => {
    const step1 = stepOneThreatOf(base);
    const state = withMainSchemeThreat(base, threatShortOfTarget(base, step1 + 2));
    const hint = schemeCloseHint(state, CORE_DEPS, me);
    expect(hint).not.toBeNull();
    expect(hint!.facts.away).toBe(2);
  });

  test("does not fire 3 threat away", () => {
    const step1 = stepOneThreatOf(base);
    const state = withMainSchemeThreat(base, threatShortOfTarget(base, step1 + 3));
    expect(schemeCloseHint(state, CORE_DEPS, me)).toBeNull();
  });

  test("a completion fires schemeFinish only, never schemeClose", () => {
    const step1 = stepOneThreatOf(base);
    const state = withMainSchemeThreat(base, threatShortOfTarget(base, step1));
    expect(schemeFinishHint(state, CORE_DEPS, me)).not.toBeNull();
    expect(schemeCloseHint(state, CORE_DEPS, me)).toBeNull();
  });

  test("does not fire while there's plenty of room left", () => {
    const state = withMainSchemeThreat(base, 0);
    expect(schemeCloseHint(state, CORE_DEPS, me)).toBeNull();
  });

  test("crisis in play: the safe action never offers 'Thwart first' against the main scheme", () => {
    const step1 = stepOneThreatOf(base);
    let state = withMainSchemeThreat(base, threatShortOfTarget(base, step1 + 1));
    state = withCrisisSideScheme(state);
    const hint = schemeCloseHint(state, CORE_DEPS, me);
    expect(hint).not.toBeNull();
    expect(hint!.safeAction).toBeNull();
    expect(hint!.anywayAction.label).toBe("End turn anyway");
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
    const hint = wastedPayHint(base, CORE_DEPS, me, view);
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
    expect(wastedPayHint(base, CORE_DEPS, me, view)).toBeNull();
  });

  // Reported 2026-09-29: playing Aunt May (cost 1) paid with Spider-Tracer warned "For Justice! alone could cover
  // the cost"; switching to pay with For Justice! warned the reverse, suggesting Spider-Tracer — the hint
  // ping-ponged between the two payment choices. Spider-Tracer ("Attach to a minion") has no legal target this
  // early (no minion in play yet), so it is not a card actually worth keeping right now; For Justice! (a "Hero
  // Action (thwart)") always has the main scheme to thwart, so it is.
  test("Aunt May paid with Spider-Tracer vs. For Justice! does not ping-pong", () => {
    const staged = moveToHand(base, me, ["01006", "01007", "01060"]);
    // Isolate the hand to exactly these three cards — otherwise another already-drawn hand card (e.g. Backflip,
    // an Interrupt with nothing to interrupt right now) is just as "not genuinely playable" as Spider-Tracer and
    // may be picked as the alternative first, making the assertions below depend on draw order rather than on
    // Spider-Tracer's own lack of a target.
    const state: GameState = {
      ...staged.state,
      players: staged.state.players.map((p) => (p.playerId === me ? { ...p, hand: staged.ids } : p)),
    };
    const [auntMayId, spiderTracerId, forJusticeId] = staged.ids;
    const action: ActionRef = { kind: "playCard", instanceId: auntMayId! };

    const openedForSpiderTracer = beginPayment(state, me, action, null, CORE_DEPS)!;
    const spiderTracerSource = openedForSpiderTracer.query.sources.find((s) => s.instanceId === spiderTracerId)!;
    const paidWithSpiderTracer = togglePayment(openedForSpiderTracer, spiderTracerSource.optionId);
    const viewSpiderTracer = paymentView(state, me, paidWithSpiderTracer, "test", CORE_DEPS);
    expect(viewSpiderTracer.paid).toBe(viewSpiderTracer.required);
    // Spider-Tracer has no minion to attach to yet — not a card genuinely worth keeping right now, so spending it
    // must not warn.
    expect(wastedPayHint(state, CORE_DEPS, me, viewSpiderTracer)).toBeNull();

    const openedForForJustice = beginPayment(state, me, action, null, CORE_DEPS)!;
    const forJusticeSource = openedForForJustice.query.sources.find((s) => s.instanceId === forJusticeId)!;
    const paidWithForJustice = togglePayment(openedForForJustice, forJusticeSource.optionId);
    const viewForJustice = paymentView(state, me, paidWithForJustice, "test", CORE_DEPS);
    expect(viewForJustice.paid).toBe(viewForJustice.required);
    // For Justice! is a legal thwart right now — genuinely worth keeping — and Spider-Tracer (not itself worth
    // keeping) alone covers the cost, so this direction still warns.
    const hint = wastedPayHint(state, CORE_DEPS, me, viewForJustice);
    expect(hint).not.toBeNull();
    expect(hint!.body).toContain("Spider-Tracer");

    // The suggested alternative must never itself trigger the warning when paid with alone (the ping-pong check).
    expect(wastedPayHint(state, CORE_DEPS, me, viewSpiderTracer)).toBeNull();
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

  test("schemeClose fires and can be silenced on its own", () => {
    const step1 = stepOneThreatOf(base);
    const state = withMainSchemeThreat(base, threatShortOfTarget(base, step1 + 1));
    const fired = hintsFor({ state, deps: CORE_DEPS, playerId: me, trigger: { kind: "endTurn" } }, defaultGuidePrefs);
    expect(fired.some((h) => h.key === "schemeClose")).toBe(true);

    const silenced: GuidePrefs = { ...defaultGuidePrefs, silencedWarnings: ["schemeClose"] };
    const stillFired = hintsFor({ state, deps: CORE_DEPS, playerId: me, trigger: { kind: "endTurn" } }, silenced);
    expect(stillFired.some((h) => h.key === "schemeClose")).toBe(false);
  });

  test("returns nothing for schemeClose at guide level 'off'", () => {
    const step1 = stepOneThreatOf(base);
    const state = withMainSchemeThreat(base, threatShortOfTarget(base, step1 + 1));
    const off: GuidePrefs = { ...defaultGuidePrefs, level: "off" };
    expect(hintsFor({ state, deps: CORE_DEPS, playerId: me, trigger: { kind: "endTurn" } }, off)).toEqual([]);
  });
});
