import { PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  createGame,
  legalActions,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../wave9/falcon/testing.js";
import { WAVE10_ABILITIES } from "../../wave10/index.js";
import { WAVE11_CARDS } from "../cards.js";
import { WAVE11_DEPS } from "../index.js";
import { JJ_JUSTICE as REGISTRY } from "./justice.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `jj/justice` (docs/phase7-wave11-hero-packs.md H8.4): Captain Marvel 61015, Spider-Woman 61016, Squirrel
 * Girl 61017, Strategy Session 61019, Run Them to Ground 61020, Grapnel Launcher 61023 and Innate
 * Perception 61036. Aspect cards must work in any hero's deck, so the games seat the Core Spider-Man Justice starter
 * deck (not Jessica Jones) with cards relabelled by surgery. Two-player games add the Core Captain Marvel deck as seat 2.
 */
const CAPTAIN_R = "61015.captain-marvel-response";
const WOMAN_R = "61016.spider-woman-response";
const SQUIRREL_R = "61017.squirrel-girl-response";
const SQUIRREL_A = "61017.squirrel-girl-action";
const LAW_R = "61018.lay-down-the-law-response";
const SESSION_A = "61019.strategy-session-action";
const SESSION_H = "61019.strategy-session-hero-action";
const GROUND_D = "61020.when-defeated";
const TRAP_D = "61021.when-defeated";
const DETERMINATION_R = "61022.determination-response";
const GRAPNEL_A = "61023.grapnel-launcher-action";
const ENTRAPMENT_R = "61024.entrapment-response";
const PERCEPTION_C = "61036.innate-perception-constant";
const CAPTAIN = "61015";
const WOMAN = "61016";
const SQUIRREL = "61017";
const SESSION = "61019";
const GROUND = "61020";
const GRAPNEL = "61023";
const ENTRAPMENT = "61024";
const PERCEPTION = "61036";
const FAVORS = "61008";
const ALIAS = "61002";
const ENERGY = "01088"; // resource, two printed energy icons
const GENIUS = "01089"; // resource, two printed mental icons
const MARIA_HILL = "01067"; // ally, one printed mental icon
const WILD = "01020"; // ally, one printed wild icon
const PATROL_MINION = "45134"; // Genosha minion with patrol
const CROWD_CONTROL = "01108"; // Rhino side scheme with a crisis icon

const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** A Spider-Man game past setup (alter-ego form) in the wave 11 pool; with `duo`, Core Captain Marvel as seat 2. */
function jjGame(duo = false): GameState {
  const base = coreScenario("rhino", {
    players: duo
      ? [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }]
      : [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE11_CARDS,
  } as never);
  const created = createGame({ ...base, requireLegalDecks: false }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (x) => x.step.phase === "player", WAVE11_DEPS);
}

/** `code` takes the place of the first deck card of `player` that is not already one of `taken`. */
function relabel(state: GameState, code: string, player = P1, taken: readonly InstanceId[] = []) {
  const id = playerOf(state, player).deck.find((i) => !taken.includes(i))!;
  return { state: patchInstance(state, id, { cardId: cardId(code) }), id };
}

/** The first `codes.length` deck cards of P1 relabelled to these codes, top first. */
function stackTop(state: GameState, ...codes: readonly string[]): GameState {
  const deck = playerOf(state, P1).deck;
  return codes.reduce((s, code, i) => patchInstance(s, deck[i]!, { cardId: cardId(code) }), state);
}

/** `code` relabelled onto a deck card and moved into P1's hand. */
function handCard(state: GameState, code: string, player = P1) {
  const r = relabel(state, code, player);
  const given = moveToHand(r.state, player, code);
  return { state: given.state, id: given.ids[0]! };
}

function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, command, WAVE11_DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  session = first.session;
  events.push(...first.events);
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 100) throw new Error(`choices did not settle (${session.state.pendingChoice.prompt.kind})`);
    const choice = session.state.pendingChoice;
    const next = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      },
      WAVE11_DEPS,
    );
    if (!next.ok) throw new Error(`resolveChoice rejected: ${next.error.code}: ${next.error.message}`);
    session = next.session;
    events.push(...next.events);
  }
  const replayed = replay(session.log, WAVE11_DEPS);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}

const refused = (state: GameState, command: Command) => !sessionApply(startSession(state), command, WAVE11_DEPS).ok;

/** Takes the option on one of `cards` (or whose label contains `label`); anything else as `firstLegal`. */
const picks =
  (opts: { readonly label?: string; readonly cards?: readonly InstanceId[] }): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    const wanted = opts.cards ?? [];
    const hit = choice?.options.find(
      (o) =>
        (opts.label !== undefined && String((o as { label?: string }).label ?? "").includes(opts.label)) ||
        ((o.ref.kind === "card" || o.ref.kind === "ability") && wanted.includes(o.ref.instanceId)) ||
        wanted.includes(o.optionId as InstanceId),
    );
    return hit ? [hit.optionId] : firstLegal(state);
  };

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const thwartMain = (s: GameState): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: identityOf(s),
  schemeInstanceId: s.mainScheme.instanceId,
});

describe("wave 11 jj/justice", () => {
  it("registers only valid definitions, with the printed timing, and skips nothing", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(REGISTRY[CAPTAIN_R]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY[WOMAN_R]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY[SQUIRREL_R]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY[SQUIRREL_A]!.trigger).toMatchObject({ kind: "action" });
    expect(REGISTRY[SESSION_A]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(REGISTRY[SESSION_H]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(REGISTRY[GROUND_D]!.trigger).toMatchObject({ kind: "whenDefeated" });
    expect(REGISTRY[GRAPNEL_A]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [
        CAPTAIN_R,
        WOMAN_R,
        SQUIRREL_R,
        SQUIRREL_A,
        LAW_R,
        SESSION_A,
        SESSION_H,
        GROUND_D,
        TRAP_D,
        DETERMINATION_R,
        GRAPNEL_A,
        ENTRAPMENT_R,
        PERCEPTION_C,
      ].sort(),
    );
    expect(REGISTRY[ENTRAPMENT_R]).toMatchObject({
      trigger: { kind: "response", forced: false, form: "alterEgo" },
      cost: { changeForm: "hero", discardSelf: true },
    });
  });

  it("aliases each reprint to its original's script, and the printed text is the original's", () => {
    const ALIASES: readonly (readonly [string, string])[] = [
      ["61018.lay-down-the-law-response", "12031.lay-down-the-law-response"],
      ["61021.when-defeated", "41016.when-defeated"],
      ["61022.determination-response", "21052.determination-response"],
    ];
    const text = (code: string): string => {
      const card = PLAYABLE_CARDS.find((c) => (c.id as string) === code) as unknown as { text?: { current: string } };
      return (card.text?.current ?? "").replace(/\s+/g, " ").trim();
    };
    for (const [ref, source] of ALIASES) {
      expect(REGISTRY[ref], ref).toBe(WAVE10_ABILITIES[source]);
      expect(text(ref.split(".")[0]!), ref).not.toBe("");
      expect(text(ref.split(".")[0]!), ref).toBe(text(source.split(".")[0]!));
    }
  });
});

describe(`${CAPTAIN_R}: discard the top 4 cards; a printed energy resource removes 2 threat, more than one also confuses an enemy`, () => {
  /** Captain Marvel played from hand over a main scheme with 5 threat, the top 4 cards of the deck set to `top`. */
  const played = (...top: readonly string[]) => {
    const given = handCard(jjGame(), CAPTAIN);
    const s = patchInstance(stackTop(given.state, ...top), given.state.mainScheme.instanceId, { threat: 5 });
    return drive(s, play(P1, given.id, payWith(s, P1, 4, [given.id])), picks({ cards: [given.id] }));
  };

  it("no energy among the four: 4 cards discarded, nothing else", () => {
    const { state } = played(GENIUS, GENIUS, MARIA_HILL, GENIUS);
    expect(mainThreat(state)).toBe(5);
    expect(inst(state, villainOf(state)).statuses.confused).toBe(0);
    const discarded = playerOf(state, P1).discard.map((i) => inst(state, i).cardId);
    expect(discarded.filter((c) => c === cardId(GENIUS))).toHaveLength(3);
  });

  it("one printed energy icon: 2 threat removed from the scheme, no confusion", () => {
    const { state } = played(SESSION, GENIUS, MARIA_HILL, GENIUS);
    expect(mainThreat(state)).toBe(3);
    expect(inst(state, villainOf(state)).statuses.confused).toBe(0);
  });

  it("two printed energy icons: 2 threat removed and the villain confused", () => {
    const { state } = played(ENERGY, GENIUS, MARIA_HILL, GENIUS);
    expect(mainThreat(state)).toBe(3);
    expect(inst(state, villainOf(state)).statuses.confused).toBe(1);
  });

  it("a wild-only resource does not count as energy", () => {
    const { state } = played(WILD, WILD, MARIA_HILL, GENIUS);
    expect(mainThreat(state)).toBe(5);
    expect(inst(state, villainOf(state)).statuses.confused).toBe(0);
  });
});

describe(`${WOMAN_R}: after a character you control thwarts, place a limb counter (max 8); discard to deal damage per counter`, () => {
  const setup = (limbs: number) => {
    const s0 = withForm(jjGame(), { heroForm: 0 });
    const g = stagedInPlay(relabel(s0, WOMAN).state, WOMAN, { counters: { limb: limbs } });
    return { ...g, state: patchInstance(g.state, g.state.mainScheme.instanceId, { threat: 5 }) };
  };

  it("declining keeps her with one more counter", () => {
    const g = setup(2);
    const { state } = drive(g.state, thwartMain(g.state), picks({ cards: [g.id], label: "Keep" }));
    expect(inst(state, g.id).counters.limb).toBe(3);
    expect(playerOf(state, P1).playArea).toContain(g.id);
    expect(inst(state, villainOf(state)).damage).toBe(0);
  });

  it("discarding her deals 1 damage per limb counter, the new one included", () => {
    const g = setup(2);
    const { state } = drive(g.state, thwartMain(g.state), picks({ cards: [g.id], label: "Discard" }));
    expect(playerOf(state, P1).playArea).not.toContain(g.id);
    expect(inst(state, villainOf(state)).damage).toBe(3);
  });

  it("stops at 8 counters", () => {
    const g = setup(8);
    const { state } = drive(g.state, thwartMain(g.state), picks({ cards: [g.id], label: "Keep" }));
    expect(inst(state, g.id).counters.limb).toBe(8);
  });
});

describe(`${SQUIRREL_R} and ${SQUIRREL_A}: counters for the cards in hand after a play from hand; remove one to remove 1 threat`, () => {
  /** P1 holding Squirrel Girl and `others` other cards (the first deck cards are drawn or put away to make it so). */
  const withHandOf = (others: number) => {
    const given = handCard(jjGame(), SQUIRREL);
    const owner = playerOf(given.state, P1);
    const rest = owner.hand.filter((i) => i !== given.id);
    const keep =
      rest.length >= others ? rest.slice(0, others) : [...rest, ...owner.deck.slice(0, others - rest.length)];
    const state = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: [given.id, ...keep],
              deck: [...rest.slice(others), ...p.deck].filter((i) => !keep.includes(i) && i !== given.id),
            }
          : p,
      ),
    };
    return { state, id: given.id, paid: keep.slice(0, 2) };
  };

  it("played from the hand with 3 other cards left after paying 2: 3 squirrel counters", () => {
    const g = withHandOf(5);
    const { state } = drive(g.state, play(P1, g.id, g.paid), picks({ cards: [g.id] }));
    expect(playerOf(state, P1).hand).toHaveLength(3);
    expect(inst(state, g.id).counters.squirrel).toBe(3);
  });

  it("is capped at 4 counters", () => {
    const g = withHandOf(9);
    const { state } = drive(g.state, play(P1, g.id, g.paid), picks({ cards: [g.id] }));
    expect(playerOf(state, P1).hand).toHaveLength(7);
    expect(inst(state, g.id).counters.squirrel).toBe(4);
  });

  it("the action removes a counter for 1 threat, and is refused with none", () => {
    const g = stagedInPlay(relabel(jjGame(), SQUIRREL).state, SQUIRREL, { counters: { squirrel: 2 } });
    const s = patchInstance(g.state, g.state.mainScheme.instanceId, { threat: 4 });
    const { state } = drive(s, use(P1, g.id, SQUIRREL_A));
    expect(inst(state, g.id).counters.squirrel).toBe(1);
    expect(mainThreat(state)).toBe(3);
    expect(refused(patchInstance(s, g.id, { counters: {} }), use(P1, g.id, SQUIRREL_A))).toBe(true);
  });

  it("found and played by Calling in Favors, it counts as played from the hand (Q102 = A)", () => {
    const base = stagedInPlay(relabel(jjGame(), ALIAS).state, ALIAS, { counters: { evidence: 3 } });
    const withFavors = stagedInPlay(relabel(base.state, FAVORS, P1, [base.id]).state, FAVORS);
    const sq = relabel(withFavors.state, SQUIRREL, P1, [base.id, withFavors.id]);
    const hand = playerOf(sq.state, P1).hand.length;
    const { state } = drive(
      sq.state,
      use(P1, withFavors.id, "61008.calling-in-favors-action"),
      picks({ cards: [sq.id] }),
    );
    expect(playerOf(state, P1).playArea).toContain(sq.id);
    expect(inst(state, sq.id).counters.squirrel).toBe(Math.min(4, hand));
    expect(hand).toBe(6);
  });
});

/** `code` relabelled onto a deck card of `player` and put into the villain area as a player side scheme they control. */
function sideSchemeInPlay(state: GameState, code: string, threat: number, player = P1) {
  const r = relabel(state, code, player);
  const s = {
    ...r.state,
    villainArea: [...r.state.villainArea, r.id],
    players: r.state.players.map((p) => ({ ...p, deck: p.deck.filter((i) => i !== r.id) })),
  };
  return { state: patchInstance(s, r.id, { threat, faceup: true, controllerId: player, ownerId: player }), id: r.id };
}

describe(`${SESSION_A} and ${SESSION_H}`, () => {
  /** Picks the player `who` when asked to choose a player, else the card `card` when offered. */
  const searching =
    (who: typeof P1, card?: InstanceId): Picker =>
    (st) => {
      const choice = st.pendingChoice!;
      const player = choice.options.find((o) => o.ref.kind === "player" && o.ref.playerId === who);
      if (player) return [player.optionId];
      const found = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === card);
      return found ? [found.optionId] : firstLegal(st);
    };

  it("Alter-Ego Action: a chosen player searches their deck for a player side scheme and adds it to their hand", () => {
    const ps = relabel(jjGame(true), GROUND, P2);
    const withSession = handCard(ps.state, SESSION);
    const s = withSession.state;
    const handBefore = playerOf(s, P2).hand.length;
    const { state, events } = drive(
      s,
      play(P1, withSession.id, payWith(s, P1, 1, [withSession.id])),
      searching(P2, ps.id),
    );
    expect(playerOf(state, P2).hand).toContain(ps.id);
    expect(playerOf(state, P2).hand).toHaveLength(handBefore + 1);
    expect(playerOf(state, P2).deck).not.toContain(ps.id);
    expect(playerOf(state, P1).discard).toContain(withSession.id);
    expect(ofType(events, "deckShuffled").length).toBeGreaterThanOrEqual(1);
  });

  it("a search that finds no player side scheme resolves, shuffles and still discards the event", () => {
    const withSession = handCard(jjGame(true), SESSION);
    const s = withSession.state;
    const handBefore = playerOf(s, P2).hand.length;
    const { state, events } = drive(s, play(P1, withSession.id, payWith(s, P1, 1, [withSession.id])), searching(P2));
    expect(playerOf(state, P2).hand).toHaveLength(handBefore);
    expect(playerOf(state, P1).discard).toContain(withSession.id);
    expect(ofType(events, "deckShuffled").length).toBeGreaterThanOrEqual(1);
  });

  it("Hero Action (thwart): removes 3 threat from a player side scheme; an encounter side scheme is not a choice", () => {
    // The player side scheme limit is one in play (RRG 1.8 p. 34), so the only legal target is the single one.
    const only = sideSchemeInPlay(withForm(jjGame(), { heroForm: 0 }), GROUND, 5);
    const crowd = encounterCardInVillainArea(only.state, CROWD_CONTROL, 4);
    const given = handCard(crowd.state, SESSION);
    const s = given.state;
    const offered: string[] = [];
    const { state } = drive(s, play(P1, given.id, payWith(s, P1, 1, [given.id])), (st) => {
      for (const o of st.pendingChoice!.options) if (o.ref.kind === "card") offered.push(o.ref.instanceId);
      return firstLegal(st);
    });
    expect(offered.filter((id) => id !== only.id)).toEqual([]);
    expect(inst(state, only.id).threat).toBe(2);
    expect(inst(state, crowd.id).threat).toBe(4);
    expect(mainThreat(state)).toBe(mainThreat(s));
  });

  it("in hero form with no player side scheme in play, the refusal names the missing target, not the form (#378)", () => {
    // The Alter-Ego Action is in the wrong form and the Hero Action has nothing to thwart: the reason reported is
    // the hero half's, the one the player could otherwise use.
    const given = handCard(withForm(jjGame(), { heroForm: 0 }), SESSION);
    const s = given.state;
    const result = sessionApply(startSession(s), play(P1, given.id, payWith(s, P1, 1, [given.id])), WAVE11_DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
    const actions = legalActions(s, P1, WAVE11_DEPS);
    const entry = (actions.kind === "turn" ? actions.illegal : []).find(
      (e) => e.action.kind === "playCard" && e.action.instanceId === given.id,
    );
    expect(entry?.reason).toBe("no_valid_target");
  });
});

describe(`${GROUND_D}: skip the next villain phase, deal each player a facedown encounter card, the villain cannot take damage`, () => {
  const staged = () => {
    const g0 = withForm(jjGame(true), { heroForm: 0 });
    const ps = relabel(g0, GROUND);
    const inPlay = patchInstance(
      {
        ...ps.state,
        villainArea: [...ps.state.villainArea, ps.id],
        players: ps.state.players.map((p) => ({ ...p, deck: p.deck.filter((i) => i !== ps.id) })),
      },
      ps.id,
      { threat: 1, faceup: true, controllerId: P1, ownerId: P1 },
    );
    return { state: inPlay, id: ps.id };
  };

  it("defeating it by a thwart skips the phase, deals one card to each player and shields the villain", () => {
    const g = staged();
    const threatBefore = mainThreat(g.state);
    const { state, events } = drive(g.state, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(g.state),
      schemeInstanceId: g.id,
    });
    expect(state.villainPhasesToSkip).toBe(1);
    const dealt = [P1, P2].map((p) => playerOf(state, p).dealtEncounter.length);
    expect(dealt).toEqual([1, 1]);
    expect(ofType(events, "schemeDefeated")).toHaveLength(1);

    // The villain phase is skipped: no threat, no activation, the round still ends.
    const roundBefore = state.round;
    const over = drive(state, { type: "endTurn", playerId: P1 });
    const second = drive(over.state, { type: "endTurn", playerId: P2 });
    const all = [...over.events, ...second.events];
    expect(ofType(all, "villainPhaseSkipped")).toHaveLength(1);
    expect(second.state.round).toBe(roundBefore + 1);
    expect(mainThreat(second.state)).toBe(threatBefore);
    expect(second.state.villainPhasesToSkip).toBe(0);

    // Next player phase: the dealt cards still wait, and the villain still cannot take damage.
    expect([P1, P2].map((p) => playerOf(second.state, p).dealtEncounter.length)).toEqual([1, 1]);
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(second.state),
      targetInstanceId: villainOf(second.state),
    };
    expect(refused(second.state, attack)).toBe(true);
    expect(inst(second.state, villainOf(second.state)).damage).toBe(0);

    // The next villain phase played reveals the dealt cards and ends the shield: the villain can take damage after it.
    const p1 = drive(second.state, { type: "endTurn", playerId: P1 });
    const p2 = drive(p1.state, { type: "endTurn", playerId: P2 });
    const villainPhase = [...p1.events, ...p2.events];
    expect(ofType(villainPhase, "villainPhaseSkipped")).toHaveLength(0);
    expect(ofType(villainPhase, "encounterCardRevealed").length).toBeGreaterThanOrEqual(2);
    expect([P1, P2].map((p) => playerOf(p2.state, p).dealtEncounter.length)).toEqual([0, 0]);
    const who = (p2.state.step as { activePlayerId: typeof P1 }).activePlayerId;
    const later = withForm(p2.state, { heroForm: 0 }, who);
    const free = patchInstance(later, identityOf(later, who), { exhausted: false });
    const attackLater: Command = {
      type: "basicAttack",
      playerId: who,
      attackerInstanceId: identityOf(free, who),
      targetInstanceId: villainOf(free),
    };
    expect(refused(free, attackLater)).toBe(false);
  });
});

describe(`${GRAPNEL_A}: discard to make a basic thwart without exhausting, +1 THW, ignoring crisis`, () => {
  const setup = (exhausted: boolean) => {
    const s0 = withForm(jjGame(), { heroForm: 0 });
    const g = stagedInPlay(relabel(s0, GRAPNEL).state, GRAPNEL, { attach: true });
    const crowd = encounterCardInVillainArea(g.state, CROWD_CONTROL, 3);
    const s = patchInstance(crowd.state, crowd.state.mainScheme.instanceId, { threat: 5 });
    return { ...g, state: patchInstance(s, identityOf(s), { exhausted }) };
  };

  it("an exhausted hero removes 2 (THW 1 +1) from the main scheme despite the crisis, and stays exhausted", () => {
    const g = setup(true);
    expect(refused(g.state, thwartMain(g.state))).toBe(true);
    const { state } = drive(g.state, use(P1, g.id, GRAPNEL_A));
    expect(mainThreat(state)).toBe(3);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
    expect(playerOf(state, P1).discard).toContain(g.id);
  });

  it("a ready hero is not exhausted by it", () => {
    const g = setup(false);
    expect(refused(g.state, thwartMain(g.state))).toBe(true); // the crisis icon stops an ordinary thwart
    const { state } = drive(g.state, use(P1, g.id, GRAPNEL_A));
    expect(mainThreat(state)).toBe(3);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });

  it("with a patrol minion engaged: a basic thwart is refused, Grapnel Launcher removes THW+1, the next is refused again", () => {
    const g = setup(false);
    const s = engageMinion(g.state, PATROL_MINION, "patrol");
    expect(refused(s, thwartMain(s))).toBe(true);
    const { state } = drive(s, use(P1, g.id, GRAPNEL_A));
    expect(mainThreat(state)).toBe(3);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(refused(state, thwartMain(state))).toBe(true);
  });

  it("a confused hero loses the confused card instead: the card is discarded and no threat is removed", () => {
    const g = setup(false);
    const s = patchInstance(g.state, identityOf(g.state), {
      statuses: { ...inst(g.state, identityOf(g.state)).statuses, confused: 1 },
    });
    const { state } = drive(s, use(P1, g.id, GRAPNEL_A));
    expect(inst(state, identityOf(state)).statuses.confused).toBe(0);
    expect(mainThreat(state)).toBe(5);
    expect(playerOf(state, P1).discard).toContain(g.id);
  });

  it("is refused in alter-ego form", () => {
    const g = setup(false);
    expect(refused(withForm(g.state, "alterEgo"), use(P1, g.id, GRAPNEL_A))).toBe(true);
  });
});

describe(`${PERCEPTION_C}: your hero gets +1 THW`, () => {
  it("a basic thwart removes 2 threat instead of 1 with it attached", () => {
    const s0 = patchInstance(withForm(jjGame(), { heroForm: 0 }), jjGame().mainScheme.instanceId, { threat: 5 });
    const plain = drive(s0, thwartMain(s0));
    expect(mainThreat(plain.state)).toBe(4);
    const g = stagedInPlay(relabel(s0, PERCEPTION).state, PERCEPTION, { attach: true });
    const boosted = drive(g.state, thwartMain(g.state));
    expect(mainThreat(boosted.state)).toBe(3);
  });
});

describe(`${ENTRAPMENT_R}: after the villain schemes, change to hero form and discard this card to deal damage to the villain equal to the threat placed`, () => {
  /** Entrapment attached to the alter-ego, then the turn ends: the villain phase runs until the response is offered. */
  const staged = () => {
    const g = stagedInPlay(relabel(jjGame(), ENTRAPMENT).state, ENTRAPMENT, { attach: true });
    return { ...g, before: mainThreat(g.state) };
  };
  const isEntrapment = (state: GameState, id: InstanceId): Picker => picks({ cards: [id] });
  /** The threat the villain's scheme activation placed (the phase's acceleration threat is a separate placement). */
  const placed = (events: readonly GameEvent[]) =>
    ofType(events, "schemeResolved").reduce((sum, e) => sum + e.threatPlaced, 0);

  it("changes to hero form, discards itself and deals damage equal to the threat that activation placed", () => {
    const g = staged();
    const villain = villainOf(g.state);
    const { state, events } = drive(g.state, endTurn(P1), isEntrapment(g.state, g.id));
    const threat = placed(events);
    expect(threat).toBeGreaterThan(0);
    expect(playerOf(state, P1).identity.form).toBe("hero");
    expect(playerOf(state, P1).discard).toContain(g.id);
    expect(inst(state, villain).damage).toBe(threat);
  });

  it("control: declining leaves the form, the card and the villain untouched", () => {
    const g = staged();
    const { state } = drive(g.state, endTurn(P1), picks({ label: "Decline" }));
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    expect(playerOf(state, P1).discard).not.toContain(g.id);
    expect(inst(state, villainOf(state)).damage).toBe(0);
  });

  it("is not offered in hero form", () => {
    const g = stagedInPlay(relabel(withForm(jjGame(), { heroForm: 0 }), ENTRAPMENT).state, ENTRAPMENT, {
      attach: true,
    });
    const { state } = drive(g.state, endTurn(P1), isEntrapment(g.state, g.id));
    expect(playerOf(state, P1).discard).not.toContain(g.id);
    expect(inst(state, villainOf(state)).damage).toBe(0);
  });
});
