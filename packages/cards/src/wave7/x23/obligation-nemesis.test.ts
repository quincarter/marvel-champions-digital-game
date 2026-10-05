import {
  applyCommand,
  createGame,
  hasKeyword,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { cardId } from "@mc/content";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, stackSetAside, withForm } from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { X23_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * X-23's obligation and nemesis set (43028-43033), docs/phase7-wave7.md §7.3, §3.86. Her real precon
 * (`x-23-aggression`) against Stryfe through `wave7Scenario` with the real registry. Nemesis cards sit in the
 * set-aside area until revealed; the obligation sits in the encounter deck. Hero form is `heroForm: 0`. Every card
 * of hers used as hand fodder prints exactly 1 resource (Critical Hit 43016 and Moment of Triumph 43017 one each);
 * the basic resource cards Energy 43022 and Genius 43023 print 2 icons.
 */
const OBLIGATION = "43028";
const DEATHSTRIKE = "43029";
const VENGEANCE = "43030";
const CYBERMODS = "43031";
const WOUND = "43032";
const HACK = "43033";
const HONEY_BADGER = "43003";
const CRITICAL_HIT = "43016";
const MOMENT = "43017";
const ENERGY = "43022";
const GENIUS = "43023";
const REVEAL = "43028.self-isolation-constant";
const RESPONSE = "43028.self-isolation-response";

const X23 = { starterDeckId: "x-23-aggression" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof X23 | typeof SPIDER_MAN;

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const stryfe = (s: GameState): InstanceId => s.activeVillainId!;
/** Every identity starts at -20 damage (surgery, as the main scheme's threat): attack volleys cannot defeat them. */
const HEADROOM = 20;
const damageOf = (s: GameState, p: PlayerId = P1): number => inst(s, identityOf(s, p)).damage + HEADROOM;
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((i) => codeOf(s, i));
const handCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).hand.map((i) => codeOf(s, i));
const encounterDeckOf = (s: GameState) => s.encounterDecks[Object.keys(s.encounterDecks)[0]!]!;
const encounterDiscard = (s: GameState): InstanceId[] => Object.values(s.encounterDecks).flatMap((d) => d.discard);
const encounterDeckIds = (s: GameState): InstanceId[] => Object.values(s.encounterDecks).flatMap((d) => d.deck);
const isIn = (list: readonly InstanceId[], id: InstanceId): boolean => list.includes(id);
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const run = (state: GameState, pick: Picker, ...commands: Command[]) =>
  driveEventsPicking(WAVE7_DEPS, state, pick, ...commands);

/** X-23's player at seat 1 (alter-ego) in a fresh Stryfe game; headroom on the main scheme, Stryfe without tough. */
function baseGame(players: readonly Seat[] = [X23], seed = 1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
  const roomy = settled.players.reduce(
    (acc, p) => patchInstance(acc, identityOf(acc, p.playerId), { damage: -HEADROOM }),
    settled,
  );
  const lowered = patchInstance(roomy, roomy.mainScheme.instanceId, { threat: -30 });
  return patchInstance(lowered, stryfe(lowered), {
    statuses: { ...inst(lowered, stryfe(lowered)).statuses, tough: 0 },
  });
}
const HERO = { heroForm: 0 } as const;

const PAD = ["43019", "43019", "43019", "43020", "43020"];
const HAND_PAD = ["43016", "43016", "43016", "43017", "43017", "43017"];
/**
 * Test-only surgery: `player`'s hand, deck (top first) and discard pile become exactly these cards (padded at the
 * bottom of the deck so the end-of-turn draw never empties it). Cards come from the player's own pool.
 */
function arrange(
  state: GameState,
  zones: { hand?: readonly string[]; deck?: readonly string[]; discard?: readonly string[] },
  player: PlayerId = P1,
): GameState {
  const owner = playerOf(state, player);
  const pool = [...owner.hand, ...owner.deck, ...owner.discard];
  const taken = new Set<InstanceId>();
  const take = (code: string): InstanceId => {
    const id = pool.find((i) => !taken.has(i) && codeOf(state, i) === code);
    if (!id) throw new Error(`no ${code} left for ${player}`);
    taken.add(id);
    return id;
  };
  const handSize = owner.identity.form === "alterEgo" ? 6 : 5;
  const hand = (zones.hand ?? HAND_PAD.slice(0, handSize)).map(take);
  const deck = [...(zones.deck ?? []), ...PAD].map(take);
  const discard = (zones.discard ?? []).map(take);
  return { ...state, players: state.players.map((p) => (p.playerId === player ? { ...p, hand, deck, discard } : p)) };
}
/** `code`'s instance on top of every other card in the encounter deck, `n` cards down. */
function behind(state: GameState, id: InstanceId, n: number): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const rest = pile.deck.filter((x) => x !== id);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...pile, deck: [...rest.slice(0, n), id, ...rest.slice(n)] },
    },
  };
}
/** The encounter deck becomes exactly these instances on top (in order) of what remains. */
function deckTop(state: GameState, ...ids: InstanceId[]): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: {
        deck: [...ids, ...pile.deck.filter((x) => !ids.includes(x))],
        discard: pile.discard.filter((x) => !ids.includes(x)),
      },
    },
  };
}
const endPhase = (state: GameState): Command[] => state.players.map((p) => endTurn(p.playerId));

type Revealed = { state: GameState; events: readonly GameEvent[]; id: InstanceId };
/** Reveals set-aside nemesis `code` of `owner` in the villain phase, `fillers` cards ahead of it (boosts, earlier deals). */
function reveal(
  state: GameState,
  code: string,
  pick: Picker = firstLegal,
  fillers = state.players.length,
  owner: PlayerId = P1,
): Revealed {
  const id = playerOf(state, owner).setAside.find((i) => codeOf(state, i) === code)!;
  const set = stackSetAside(state, code, owner);
  const driven = driveEventsPicking(WAVE7_DEPS, behind(set, id, fillers), pick, ...endPhase(set));
  return { ...driven, id };
}
/** Reveals the obligation, which sits in the encounter deck. */
function revealObligation(state: GameState, pick: Picker = firstLegal, fillers = state.players.length): Revealed {
  const id = instancesOf(state, OBLIGATION)[0]!;
  const driven = driveEventsPicking(WAVE7_DEPS, behind(state, id, fillers), pick, ...endPhase(state));
  return { ...driven, id };
}
/** Puts nemesis minion `code` (from `owner`'s set-aside area) into play engaged with `player`. */
function minionEngaged(
  state: GameState,
  code: string,
  player: PlayerId = P1,
  owner: PlayerId = P1,
): { state: GameState; id: InstanceId } {
  const id = playerOf(state, owner).setAside.find((i) => codeOf(state, i) === code)!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        setAside: p.setAside.filter((i) => i !== id),
        playArea: p.playerId === player ? [...p.playArea, id] : p.playArea,
      })),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, controllerId: null, engagedWith: player, exhausted: false },
      },
    },
  };
}
/** Honey Badger played from `player`'s hand for 2 (hero form), as a real play. */
function badgerInPlay(state: GameState, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const given = moveToHand(state, player, HONEY_BADGER);
  const id = given.ids[0]!;
  const { state: after } = driveEventsPicking(
    WAVE7_DEPS,
    given.state,
    firstLegal,
    play(player, id, payWith(given.state, player, 2, [id])),
  );
  return { state: after, id };
}
/** Takes `id` out of every zone of its owner (it is "in the victory display or removed from the game"). */
function removeFromGame(state: GameState, id: InstanceId): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      hand: p.hand.filter((i) => i !== id),
      deck: p.deck.filter((i) => i !== id),
      discard: p.discard.filter((i) => i !== id),
      playArea: p.playArea.filter((i) => i !== id),
    })),
  };
}
/** Ends the turns of the players ahead of `player`. */
function asActive(state: GameState, player: PlayerId): GameState {
  let current = state;
  for (;;) {
    const step = current.step;
    if (step.phase !== "player" || step.kind !== "turn" || step.activePlayerId === player) break;
    const result = applyCommand(current, endTurn(step.activePlayerId), WAVE7_DEPS);
    if (!result.ok) throw new Error(result.error.message);
    current = settle(result.state, firstLegal, undefined, WAVE7_DEPS);
  }
  return current;
}
/** Accepts Self-Isolation's Response when offered, declines every other trigger prompt. */
const acceptingResponse =
  (accept: boolean): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      const hit = choice.options.find((o) => o.optionId.includes(RESPONSE));
      return hit && accept ? [hit.optionId] : [];
    }
    return firstLegal(state);
  };
const twoSeats = (): GameState => baseGame([SPIDER_MAN, X23]);

describe("X-23 obligation and nemesis registry", () => {
  const REFS = [
    REVEAL,
    RESPONSE,
    "43029.when-defeated",
    "43030.in-the-name-of-vengeance-constant",
    "43031.cybermods-constant",
    "43031.cybermods-forced-interrupt",
    "43032.critical-wound-forced-interrupt",
    "43033.when-revealed",
    "43033.boost",
  ];
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(X23_OBLIGATION_NEMESIS[id]!)).toEqual([]);
  });
  it("holds exactly the nine refs", () => {
    expect(Object.keys(X23_OBLIGATION_NEMESIS).sort()).toEqual([...REFS].sort());
  });
});

/** Stryfe is stunned: he attacks nobody in the villain phase, so an ally in play is not hurt before the reveal. */
const stunStryfe = (s: GameState): GameState =>
  patchInstance(s, stryfe(s), { statuses: { ...inst(s, stryfe(s)).statuses, stunned: 1 } });
const BADGER_HAND = [HONEY_BADGER, CRITICAL_HIT, CRITICAL_HIT, MOMENT, MOMENT, MOMENT];

describe("Self-Isolation (43028)", () => {
  it("is Laura's own obligation: revealed, it stays in her play area (not discarded)", () => {
    const { state, id } = revealObligation(baseGame());
    expect(isIn(playerOf(state, P1).playArea, id)).toBe(true);
    expect(isIn(encounterDiscard(state), id)).toBe(false);
  });

  describe("When Revealed: Honey Badger goes facedown under it, from wherever she is", () => {
    const tucked = (state: GameState, id: InstanceId, badger: InstanceId): void => {
      expect(inst(state, id).tucked).toEqual([badger]);
      expect(inst(state, badger).faceup).toBe(false);
      const owner = playerOf(state, P1);
      for (const zone of [owner.hand, owner.deck, owner.discard, owner.playArea])
        expect(isIn(zone, badger)).toBe(false);
    };
    it("from her hand", () => {
      const base = arrange(baseGame(), { hand: BADGER_HAND });
      const badger = playerOf(base, P1).hand.find((i) => codeOf(base, i) === HONEY_BADGER)!;
      const { state, id } = revealObligation(base);
      tucked(state, id, badger);
      expect(handCodes(state)).toHaveLength(5);
      expect(handCodes(state)).not.toContain(HONEY_BADGER);
      expect(playerOf(state, P1).dealtEncounter).toEqual([]);
    });
    it("from her deck: she is the only card lost, and the deck is shuffled", () => {
      const base = arrange(baseGame(), { deck: ["43005", HONEY_BADGER, "43012", "43005"] });
      const badger = playerOf(base, P1).deck.find((i) => codeOf(base, i) === HONEY_BADGER)!;
      const before = playerOf(base, P1).deck.filter((i) => i !== badger);
      const { state, id } = revealObligation(base);
      tucked(state, id, badger);
      expect([...playerOf(state, P1).deck].sort()).toEqual([...before].sort());
      expect(playerOf(state, P1).deck).not.toEqual(before);
    });
    it("from her discard pile", () => {
      const base = arrange(baseGame(), { discard: ["43005", HONEY_BADGER] });
      const badger = playerOf(base, P1).discard.find((i) => codeOf(base, i) === HONEY_BADGER)!;
      const { state, id } = revealObligation(base);
      tucked(state, id, badger);
      expect(discardCodes(state)).toEqual(["43005"]);
    });
    it("from her play area: she leaves play with her damage, and is not defeated", () => {
      const played = badgerInPlay(withForm(arrange(baseGame(), { hand: BADGER_HAND }), HERO));
      const hurt = stunStryfe(patchInstance(played.state, played.id, { damage: 1 }));
      expect(isIn(playerOf(hurt, P1).playArea, played.id)).toBe(true);
      const { state, id, events: log } = revealObligation(hurt, firstLegal, 0);
      tucked(state, id, played.id);
      expect(inst(state, played.id).damage).toBe(0);
      expect(events(log, "characterDefeated").filter((e) => e.instanceId === played.id)).toEqual([]);
      expect(discardCodes(state)).not.toContain(HONEY_BADGER);
    });
    it("she is tucked once even when she is the only match in several places", () => {
      const base = arrange(baseGame(), { hand: BADGER_HAND, discard: ["43005"] });
      const { state, id } = revealObligation(base);
      expect(inst(state, id).tucked).toHaveLength(1);
    });
  });

  describe("When Revealed, if she cannot be found: discard this card and deal yourself 1 facedown encounter card", () => {
    /** Honey Badger is in none of the four searched places (she sits in the victory display or is removed). */
    const stranded = () => {
      const base = arrange(baseGame(), {});
      const badger = [...playerOf(base, P1).hand, ...playerOf(base, P1).deck].find(
        (i) => codeOf(base, i) === HONEY_BADGER,
      );
      return badger ? removeFromGame(base, badger) : base;
    };
    it("the obligation goes to the encounter discard pile and tucks nothing", () => {
      const { state, id } = revealObligation(stranded());
      expect(isIn(encounterDiscard(state), id)).toBe(true);
      expect(isIn(playerOf(state, P1).playArea, id)).toBe(false);
      expect(inst(state, id).tucked).toEqual([]);
    });
    it("and the player is dealt 1 more facedown encounter card, the next one down, which is revealed in the same step", () => {
      const base = stranded();
      const id = instancesOf(base, OBLIGATION)[0]!;
      const staged = behind(base, id, 1);
      const next = encounterDeckOf(staged).deck[2]!;
      const { events: log } = driveEventsPicking(WAVE7_DEPS, staged, firstLegal, ...endPhase(staged));
      const revealed = events(log, "encounterCardRevealed").map((e) => e.instanceId);
      expect(revealed.slice(0, 2)).toEqual([id, next]);
    });
    it("two players: the Laura player's is the one dealt, whoever's card was revealed first", () => {
      const base = arrange(twoSeats(), {}, P2);
      const badger = [...playerOf(base, P2).hand, ...playerOf(base, P2).deck].find(
        (i) => codeOf(base, i) === HONEY_BADGER,
      );
      const gone = badger ? removeFromGame(base, badger) : base;
      const id = instancesOf(gone, OBLIGATION)[0]!;
      const { state, events: log } = driveEventsPicking(WAVE7_DEPS, behind(gone, id, 2), firstLegal, ...endPhase(gone));
      expect(isIn(encounterDiscard(state), id)).toBe(true);
      expect(events(log, "encounterCardRevealed").length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Response: after you make a basic recovery, discard this obligation and Honey Badger", () => {
    /** The obligation in play with Honey Badger under it; the Laura player (seat `seat`) is in alter-ego with 3 damage. */
    function inPlay(players: readonly Seat[] = [X23], seat: PlayerId = P1) {
      const staged = arrange(baseGame(players), { hand: BADGER_HAND }, seat);
      const badger = playerOf(staged, seat).hand.find((i) => codeOf(staged, i) === HONEY_BADGER)!;
      const id = instancesOf(staged, OBLIGATION)[0]!;
      const revealed = driveEventsPicking(
        WAVE7_DEPS,
        behind(staged, id, players.length),
        firstLegal,
        ...endPhase(staged),
      );
      const hurt = patchInstance(revealed.state, identityOf(revealed.state, seat), { damage: 3 });
      return { state: asActive(hurt, seat), id, badger };
    }
    it("one player: accepting discards the obligation and Honey Badger (to her owner's discard pile) and heals", () => {
      const { state, id, badger } = inPlay();
      expect(inst(state, id).tucked).toEqual([badger]);
      expect(isIn(playerOf(state, P1).playArea, id)).toBe(true);
      const { state: after } = run(state, acceptingResponse(true), { type: "basicRecover", playerId: P1 });
      expect(isIn(encounterDiscard(after), id)).toBe(true);
      expect(isIn(playerOf(after, P1).playArea, id)).toBe(false);
      expect(isIn(playerOf(after, P1).discard, badger)).toBe(true);
      expect(inst(after, id).tucked).toEqual([]);
      expect(inst(after, identityOf(after)).damage).toBe(0);
    });
    it("declining keeps both: Honey Badger stays under the obligation", () => {
      const { state, id, badger } = inPlay();
      const { state: after } = run(state, acceptingResponse(false), { type: "basicRecover", playerId: P1 });
      expect(isIn(playerOf(after, P1).playArea, id)).toBe(true);
      expect(inst(after, id).tucked).toEqual([badger]);
      expect(isIn(playerOf(after, P1).discard, badger)).toBe(false);
      expect(inst(after, identityOf(after)).damage).toBe(0);
    });
    it("is not offered by anything but a basic recovery", () => {
      const { state, id, badger } = inPlay();
      const { state: after } = run(state, acceptingResponse(true), endTurn(P1));
      expect(inst(after, id).tucked).toEqual([badger]);
      expect(isIn(playerOf(after, P1).playArea, id)).toBe(true);
    });
    it("two players: the other player's basic recovery does not offer it; the Laura player's does", () => {
      const { state, id, badger } = inPlay([SPIDER_MAN, X23], P2);
      expect(isIn(playerOf(state, P2).playArea, id)).toBe(true);
      expect(isIn(playerOf(state, P1).playArea, id)).toBe(false);
      const spiderHurt = patchInstance(withForm(state, "alterEgo", P1), identityOf(state, P1), { damage: 3 });
      const { state: other } = run(asActive(spiderHurt, P1), acceptingResponse(true), {
        type: "basicRecover",
        playerId: P1,
      });
      expect(inst(other, id).tucked).toEqual([badger]);
      expect(isIn(playerOf(other, P2).playArea, id)).toBe(true);
      const { state: after } = run(asActive(state, P2), acceptingResponse(true), {
        type: "basicRecover",
        playerId: P2,
      });
      expect(isIn(encounterDiscard(after), id)).toBe(true);
      expect(isIn(playerOf(after, P2).discard, badger)).toBe(true);
    });
  });

  it("two players, Laura is seat 2: it is given to her play area and tucks her Honey Badger, not another player's cards", () => {
    const base = arrange(twoSeats(), { hand: BADGER_HAND }, P2);
    const badger = playerOf(base, P2).hand.find((i) => codeOf(base, i) === HONEY_BADGER)!;
    const { state, id } = revealObligation(base, firstLegal, 2);
    expect(isIn(playerOf(state, P2).playArea, id)).toBe(true);
    expect(isIn(playerOf(state, P1).playArea, id)).toBe(false);
    expect(inst(state, id).tucked).toEqual([badger]);
    expect(isIn(playerOf(state, P2).hand, badger)).toBe(false);
    expect(discardCodes(state, P1)).toEqual([]);
  });

  it("Boost: its 2 boost icons add 2 to the villain's attack", () => {
    const base = withForm(baseGame(), HERO);
    const id = instancesOf(base, OBLIGATION)[0]!;
    const staged = behind(base, id, 0);
    const driven = run(staged, firstLegal, ...endPhase(staged));
    expect(events(driven.events, "attackResolved")[0]).toMatchObject({ boostIcons: 2 });
  });
});

describe("Lady Deathstrike (43029): the nemesis minion", () => {
  it("has the printed stats ATK 2, SCH 2, 5 hit points and is revealed engaged with the X-23 player", () => {
    const { state, id } = reveal(baseGame(), DEATHSTRIKE);
    expect(inst(state, id).engagedWith).toBe(P1);
    expect(state.instances[id]!.cardId).toBe(DEATHSTRIKE);
  });

  describe("When Defeated: the defeating player discards the top encounter card and takes 1 indirect damage per boost icon", () => {
    /** Lady engaged with `player`; `top` (a set-aside nemesis card) stacked on the encounter deck; `by` defeats her. */
    function defeated(top: string, by: PlayerId = P1, base: GameState = withForm(baseGame(), HERO)) {
      const staged = withForm(base, HERO, by);
      const lady = minionEngaged(staged, DEATHSTRIKE, by, P1);
      const topCard = stackSetAside(lady.state, top, P1);
      const pile = encounterDeckOf(topCard);
      const topId = pile.deck[0]!;
      const ready = asActive(patchInstance(topCard, lady.id, { damage: 4 }), by);
      const { state, events: log } = run(ready, firstLegal, {
        type: "basicAttack",
        playerId: by,
        attackerInstanceId: identityOf(ready, by),
        targetInstanceId: lady.id,
      });
      return { state, log, lady: lady.id, topId };
    }
    it.each([
      ["In the Name of Vengeance (3 boost icons)", VENGEANCE, 3],
      ["Cybermods (2 boost icons)", CYBERMODS, 2],
      ["Hack 'n' Slash (0 boost icons)", HACK, 0],
    ] as const)("top card %s: discarded, and %i indirect damage", (_label, top, icons) => {
      const { state, topId, lady, log } = defeated(top);
      expect(isIn(encounterDiscard(state), topId)).toBe(true);
      expect(isIn(encounterDiscard(state), lady)).toBe(true);
      const indirect = events(log, "damageDealt").filter((e) => e.targetInstanceId === identityOf(state));
      expect(damageOf(state)).toBe(icons);
      expect(indirect.reduce((n, e) => n + e.amount, 0)).toBe(icons);
    });
    it("two players: the player who defeated her takes it, whoever she was engaged with", () => {
      const base = withForm(withForm(twoSeats(), HERO, P1), HERO, P2);
      const staged = { ...base };
      const lady = minionEngaged(staged, DEATHSTRIKE, P1, P2);
      const topCard = stackSetAside(lady.state, VENGEANCE, P2);
      const ready = asActive(patchInstance(topCard, lady.id, { damage: 4 }), P2);
      const { state } = run(ready, firstLegal, {
        type: "basicAttack",
        playerId: P2,
        attackerInstanceId: identityOf(ready, P2),
        targetInstanceId: lady.id,
      });
      expect(damageOf(state, P2)).toBe(3);
      expect(damageOf(state, P1)).toBe(0);
    });
  });

  it("Boost: its 3 boost icons add 3 to the villain's attack", () => {
    const staged = stackSetAside(withForm(baseGame(), HERO), DEATHSTRIKE);
    const driven = run(staged, firstLegal, ...endPhase(staged));
    expect(events(driven.events, "attackResolved")[0]).toMatchObject({ boostIcons: 3 });
  });
});

describe("In the Name of Vengeance (43030): each enemy gains retaliate 1", () => {
  it("is a side scheme with 6 threat, in one and in two player games", () => {
    const one = reveal(baseGame(), VENGEANCE);
    expect(inst(one.state, one.id).threat).toBe(6);
    const two = reveal(twoSeats(), VENGEANCE, firstLegal, 2, P2);
    expect(inst(two.state, two.id).threat).toBe(6);
  });
  it("the villain and a minion gain retaliate 1; before it is revealed neither has it", () => {
    const base = withForm(baseGame(), HERO);
    const lady = minionEngaged(base, DEATHSTRIKE);
    expect(hasKeyword(lady.state, stryfe(lady.state), "retaliate", WAVE7_DEPS)).toBe(false);
    expect(hasKeyword(lady.state, lady.id, "retaliate", WAVE7_DEPS)).toBe(false);
    const { state } = reveal(lady.state, VENGEANCE);
    expect(hasKeyword(state, stryfe(state), "retaliate", WAVE7_DEPS)).toBe(true);
    expect(hasKeyword(state, lady.id, "retaliate", WAVE7_DEPS)).toBe(true);
  });
  it("attacking the villain now costs X-23 1 damage (retaliate 1 is dealt back)", () => {
    const base = withForm(baseGame(), HERO);
    const { state } = reveal(base, VENGEANCE);
    const ready = asActive({ ...state, step: state.step }, P1);
    const before = damageOf(ready);
    const { events: log } = run(ready, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(ready),
      targetInstanceId: stryfe(ready),
    });
    const retaliated = events(log, "damageDealt").filter(
      (e) => e.targetInstanceId === identityOf(ready) && e.sourceInstanceId === stryfe(ready),
    );
    expect(before).toBe(damageOf(ready));
    expect(retaliated.reduce((n, e) => n + e.amount, 0)).toBe(1);
  });
  it("Boost: its 3 boost icons add 3 to the villain's attack", () => {
    const staged = stackSetAside(withForm(baseGame(), HERO), VENGEANCE);
    const driven = run(staged, firstLegal, ...endPhase(staged));
    expect(events(driven.events, "attackResolved")[0]).toMatchObject({ boostIcons: 3 });
  });
});

/** A basic attack by `by`'s identity on `target` (already damaged to the brink by the caller). */
const hit = (state: GameState, target: InstanceId, by: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: by,
  attackerInstanceId: identityOf(state, by),
  targetInstanceId: target,
});
const ZERO = "40174"; // the one minion of Stryfe's encounter deck
const NO_TOUGH = (s: GameState, id: InstanceId) => ({ ...inst(s, id).statuses, tough: 0 });
const instanceOfCode = (s: GameState, code: string): InstanceId => instancesOf(s, code)[0]!;

describe("Cybermods (43031)", () => {
  /** Cybermods revealed with Lady Deathstrike still set aside: [boost, Cybermods, two non-minions, Zero] on top. */
  function fallback(owner: PlayerId = P1, base: GameState = withForm(baseGame(), HERO)) {
    const id = playerOf(base, owner).setAside.find((i) => codeOf(base, i) === CYBERMODS)!;
    const set = stackSetAside(base, CYBERMODS, owner);
    const pile = encounterDeckOf(set).deck;
    const zero = instanceOfCode(set, ZERO);
    const fillers = owner === P1 ? 1 : 3;
    const skipped = [instanceOfCode(set, "40179"), instanceOfCode(set, "40173")];
    const rest = pile.filter((i) => i !== id && i !== zero && !skipped.includes(i));
    const order = [...rest.slice(0, fillers), id, ...skipped, zero];
    const driven = driveEventsPicking(WAVE7_DEPS, deckTop(set, ...order), firstLegal, ...endPhase(set));
    return { ...driven, id, zero, skipped };
  }
  it("with Lady Deathstrike in play it attaches to her; no minion is discarded or put into play", () => {
    const base = withForm(baseGame(), HERO);
    const lady = minionEngaged(base, DEATHSTRIKE);
    const { state, id } = reveal(lady.state, CYBERMODS);
    expect(inst(state, id).attachedTo).toBe(lady.id);
    expect(inst(state, lady.id).attachments).toContain(id);
    expect(isIn(encounterDiscard(state), id)).toBe(false);
    expect(inst(state, instanceOfCode(state, ZERO)).engagedWith ?? null).toBeNull();
  });
  it("without her in play: discards from the top until a minion, puts that minion into play engaged with you, attaches", () => {
    const { state, id, zero, skipped } = fallback();
    expect(isIn(encounterDiscard(state), skipped[0]!)).toBe(true);
    expect(isIn(encounterDiscard(state), skipped[1]!)).toBe(true);
    expect(inst(state, zero).engagedWith).toBe(P1);
    expect(isIn(playerOf(state, P1).playArea, zero)).toBe(true);
    expect(isIn(encounterDiscard(state), zero)).toBe(false);
    expect(inst(state, id).attachedTo).toBe(zero);
    expect(isIn(encounterDiscard(state), id)).toBe(false);
  });
  it("two players: the minion is engaged with the player the card was dealt to", () => {
    const { state, zero, id } = fallback(P2, withForm(withForm(twoSeats(), HERO, P1), HERO, P2));
    expect(inst(state, id).attachedTo).toBe(zero);
    expect(inst(state, zero).engagedWith).toBe(P2);
  });

  describe("Forced Interrupt: the attached minion is shuffled into the encounter deck instead of being discarded", () => {
    it("a minion it was attached to by the fallback: defeated, it is back in the deck, not the discard pile", () => {
      const { state: fresh, zero, id } = fallback();
      const ready = asActive(patchInstance(fresh, zero, { damage: 99, statuses: NO_TOUGH(fresh, zero) }), P1);
      const { state } = run(ready, firstLegal, hit(ready, zero));
      expect(isIn(encounterDeckIds(state), zero)).toBe(true);
      expect(isIn(encounterDiscard(state), zero)).toBe(false);
      expect(isIn(playerOf(state, P1).playArea, zero)).toBe(false);
      // Cybermods itself is discarded with the minion that left play.
      expect(isIn(encounterDiscard(state), id)).toBe(true);
      expect(inst(state, zero).attachments ?? []).toEqual([]);
    });
    it("Lady Deathstrike: her When Defeated resolves first, then she is shuffled into the deck", () => {
      const base = withForm(baseGame(), HERO);
      const lady = minionEngaged(base, DEATHSTRIKE);
      const { state: carrying, id } = reveal(lady.state, CYBERMODS);
      const topped = stackSetAside(carrying, VENGEANCE, P1);
      const topId = encounterDeckOf(topped).deck[0]!;
      const ready = asActive(patchInstance(topped, lady.id, { damage: 4 }), P1);
      const before = damageOf(ready);
      const { state, events: log } = run(ready, firstLegal, hit(ready, lady.id));
      expect(events(log, "characterDefeated").map((e) => e.instanceId)).toContain(lady.id);
      expect(isIn(encounterDiscard(state), topId)).toBe(true);
      expect(damageOf(state) - before).toBe(3);
      expect(isIn(encounterDeckIds(state), lady.id)).toBe(true);
      expect(isIn(encounterDiscard(state), lady.id)).toBe(false);
      expect(isIn(encounterDiscard(state), id)).toBe(true);
    });
    it("a minion without Cybermods is discarded as usual (Zero engaged, defeated)", () => {
      const base = withForm(baseGame(), HERO);
      const zero = instanceOfCode(base, ZERO);
      const engaged: GameState = {
        ...base,
        encounterDecks: Object.fromEntries(
          Object.entries(base.encounterDecks).map(([k, v]) => [k, { ...v, deck: v.deck.filter((i) => i !== zero) }]),
        ),
        players: base.players.map((p) => ({ ...p, playArea: [...p.playArea, zero] })),
        instances: {
          ...base.instances,
          [zero]: { ...base.instances[zero]!, faceup: true, controllerId: null, engagedWith: P1 },
        },
      };
      const ready = asActive(patchInstance(engaged, zero, { damage: 99, statuses: NO_TOUGH(engaged, zero) }), P1);
      const { state } = run(ready, firstLegal, hit(ready, zero));
      expect(isIn(encounterDiscard(state), zero)).toBe(true);
      expect(isIn(encounterDeckIds(state), zero)).toBe(false);
    });
  });

  it("Boost: its 2 boost icons add 2 to the villain's attack", () => {
    const staged = stackSetAside(withForm(baseGame(), HERO), CYBERMODS);
    const driven = run(staged, firstLegal, ...endPhase(staged));
    expect(events(driven.events, "attackResolved")[0]).toMatchObject({ boostIcons: 2 });
  });
});

describe("Critical Wound (43032)", () => {
  /** Damage events of 4 that Critical Wound dealt (its source) to `target`. */
  const woundDamage = (log: readonly GameEvent[], wound: InstanceId, target: InstanceId) =>
    events(log, "damageDealt").filter((e) => e.sourceInstanceId === wound && e.targetInstanceId === target);
  it("attaches to the identity of the player it is dealt to", () => {
    const { state, id } = reveal(withForm(baseGame(), HERO), WOUND);
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
    expect(inst(state, identityOf(state)).attachments).toContain(id);
  });
  it.each([
    ["hero form", HERO],
    ["alter-ego form", "alterEgo"],
  ] as const)("when the turn ends in %s: it is discarded and the player takes 4 damage", (_label, face) => {
    const { state: carrying, id } = reveal(withForm(baseGame(), face), WOUND);
    const ready = asActive(carrying, P1);
    expect(isIn(encounterDiscard(ready), id)).toBe(false);
    const { state, events: log } = run(ready, firstLegal, endTurn(P1));
    expect(isIn(encounterDiscard(state), id)).toBe(true);
    expect(inst(state, id).attachedTo ?? null).toBeNull();
    const taken = woundDamage(log, id, identityOf(state));
    expect(taken.map((e) => e.amount)).toEqual([4]);
  });
  it("does nothing before the turn ends: still attached while the player acts", () => {
    const { state, id } = reveal(withForm(baseGame(), HERO), WOUND);
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
    expect(isIn(encounterDiscard(state), id)).toBe(false);
  });
  it("two players: it is dealt to seat 2 and the end of seat 1's turn does nothing; seat 2's turn takes 4", () => {
    const base = withForm(withForm(twoSeats(), HERO, P1), HERO, P2);
    const { state: carrying, id } = reveal(base, WOUND, firstLegal, 3, P2);
    expect(inst(carrying, id).attachedTo).toBe(identityOf(carrying, P2));
    // The first player token has passed on: seat 1 takes its turn first again (surgery on the turn order).
    const ready: GameState = {
      ...carrying,
      firstPlayerId: P1,
      step: { phase: "player", kind: "turn", activePlayerId: P1, remainingPlayerIds: [P2] },
    };
    const first = run(ready, firstLegal, endTurn(P1));
    expect(inst(first.state, id).attachedTo).toBe(identityOf(first.state, P2));
    expect(woundDamage(first.events, id, identityOf(first.state, P2))).toEqual([]);
    const second = run(first.state, firstLegal, endTurn(P2));
    expect(woundDamage(second.events, id, identityOf(second.state, P2)).map((e) => e.amount)).toEqual([4]);
    expect(woundDamage(second.events, id, identityOf(second.state, P1))).toEqual([]);
    expect(isIn(encounterDiscard(second.state), id)).toBe(true);
  });
  it("Boost: its 2 boost icons add 2 to the villain's attack", () => {
    const staged = stackSetAside(withForm(baseGame(), HERO), WOUND);
    const driven = run(staged, firstLegal, ...endPhase(staged));
    expect(events(driven.events, "attackResolved")[0]).toMatchObject({ boostIcons: 2 });
  });
});

/** Every card of `player`'s hand is made a copy of `code` (surgery on the instances: the hand is full, so nothing is drawn). */
function handOf(state: GameState, code: string, player: PlayerId = P1): GameState {
  return playerOf(state, player).hand.reduce(
    (acc, id) => ({ ...acc, instances: { ...acc.instances, [id]: { ...acc.instances[id]!, cardId: cardId(code) } } }),
    state,
  );
}
/** Hero form, a full hand of 5 (hero hand size) of exactly `hand`, so the end-of-turn draw adds nothing. */
const heroWithHand = (hand: readonly string[], seed = 1, player: PlayerId = P1): GameState =>
  withForm(arrange(baseGame([X23], seed), { hand }, player), HERO, player);
const ONE_ICON = [CRITICAL_HIT, CRITICAL_HIT, CRITICAL_HIT, MOMENT, MOMENT];

describe("Hack 'n' Slash (43033)", () => {
  function hacked(base: GameState, fillers?: number) {
    const handBefore = [...playerOf(base, P1).hand];
    const revealed = reveal(base, HACK, firstLegal, fillers);
    const taken = events(revealed.events, "damageDealt").filter((e) => e.sourceInstanceId === revealed.id);
    return { ...revealed, handBefore, taken };
  }
  it("a hand of 1-resource cards: one is discarded and the player takes 1", () => {
    const { state, handBefore, taken } = hacked(heroWithHand(ONE_ICON));
    expect(handBefore.filter((i) => isIn(playerOf(state, P1).discard, i))).toHaveLength(1);
    expect(handCodes(state)).toHaveLength(4);
    expect(taken.map((e) => e.amount)).toEqual([1]);
  });
  it.each([
    ["Energy", ENERGY],
    ["Genius", GENIUS],
  ] as const)("a hand of %s (2 printed resources each): damage is 2", (_label, code) => {
    const { state, handBefore, taken } = hacked(handOf(heroWithHand(ONE_ICON), code));
    expect(handBefore.filter((i) => isIn(playerOf(state, P1).discard, i))).toHaveLength(1);
    expect(discardCodes(state)).toEqual([code]);
    expect(taken.map((e) => e.amount)).toEqual([2]);
  });
  it("a hand of Honey Badger (a wild icon): damage is 1", () => {
    const { taken, state } = hacked(handOf(heroWithHand(ONE_ICON), HONEY_BADGER));
    expect(discardCodes(state)).toEqual([HONEY_BADGER]);
    expect(taken.map((e) => e.amount)).toEqual([1]);
  });
  it("a mixed hand: the card is picked at random, and the damage is that card's resources", () => {
    const seen = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      // Stryfe is stunned and draws no boost card, so Hack 'n' Slash is the only card that can discard here.
      const base = stunStryfe(heroWithHand([ENERGY, GENIUS, CRITICAL_HIT, CRITICAL_HIT, CRITICAL_HIT], seed));
      const { state, handBefore, taken } = hacked(base, 0);
      const gone = handBefore.filter((i) => isIn(playerOf(state, P1).discard, i));
      expect(gone).toHaveLength(1);
      const icons = [ENERGY, GENIUS].includes(codeOf(state, gone[0]!)) ? 2 : 1;
      expect(taken.map((e) => e.amount)).toEqual([icons]);
      seen.add(icons);
    }
    expect([...seen].sort()).toEqual([1, 2]);
  });
  it("an empty hand and nothing to draw: nothing is discarded and no damage is taken", () => {
    const base = withForm(arrange(baseGame(), { hand: [] }), HERO);
    const bare: GameState = {
      ...base,
      players: base.players.map((p) => (p.playerId === P1 ? { ...p, deck: [], discard: [] } : p)),
    };
    const { state, taken } = hacked(bare);
    expect(taken).toEqual([]);
    expect(discardCodes(state)).toEqual([]);
  });
  it("two players: the player it was dealt to (seat 2) discards from their own hand and takes the damage", () => {
    const base = withForm(withForm(arrange(twoSeats(), { hand: ONE_ICON }, P2), HERO, P1), HERO, P2);
    const mine = [...playerOf(base, P2).hand];
    const { state, id, events: log } = reveal(base, HACK, firstLegal, 3, P2);
    const taken = (p: PlayerId) =>
      events(log, "damageDealt").filter(
        (e) => e.sourceInstanceId === id && e.targetInstanceId === identityOf(state, p),
      );
    expect(taken(P2).map((e) => e.amount)).toEqual([1]);
    expect(taken(P1)).toEqual([]);
    expect(mine.filter((i) => isIn(playerOf(state, P2).discard, i))).toHaveLength(1);
  });

  describe("[star] Boost: the same, for the player the villain attacks", () => {
    /** Hack 'n' Slash as Stryfe's boost card; `base` has the attacked player in hero form. */
    function boosted(base: GameState, owner: PlayerId = P1) {
      const staged = stackSetAside(base, HACK, owner);
      const id = encounterDeckOf(staged).deck[0]!;
      const driven = run(staged, firstLegal, ...endPhase(staged));
      const taken = events(driven.events, "damageDealt").filter((e) => e.sourceInstanceId === id);
      return { ...driven, id, taken };
    }
    it("printed 0 boost icons: it adds nothing to the attack", () => {
      const { events: log } = boosted(heroWithHand(ONE_ICON));
      expect(events(log, "attackResolved")[0]).toMatchObject({ boostIcons: 0 });
    });
    it("a hand of 1-resource cards: one card is discarded and the attacked player takes 1", () => {
      const { taken, state } = boosted(heroWithHand(ONE_ICON));
      expect(taken.map((e) => e.amount)).toEqual([1]);
      expect(discardCodes(state)).toHaveLength(1);
    });
    it("a hand of Energy (2 printed resources each): 2 damage", () => {
      const { taken, state } = boosted(handOf(heroWithHand(ONE_ICON), ENERGY));
      expect(taken.map((e) => e.amount)).toEqual([2]);
      expect(discardCodes(state)).toEqual([ENERGY]);
    });
    it("an empty hand and nothing to draw: no damage from it", () => {
      const base = withForm(arrange(baseGame(), { hand: [] }), HERO);
      const bare: GameState = {
        ...base,
        players: base.players.map((p) => (p.playerId === P1 ? { ...p, deck: [], discard: [] } : p)),
      };
      expect(boosted(bare).taken).toEqual([]);
    });
    it("two players: only the attacked player's hand is used and only they take it", () => {
      // Seat 1's hand is 5 Energy (2 resources each), seat 2's is 5 one-resource cards: the damage says whose hand it was.
      const arranged = arrange(twoSeats(), { hand: ONE_ICON }, P2);
      const spider = playerOf(arranged, P1);
      const trimmed: GameState = {
        ...arranged,
        players: arranged.players.map((p) =>
          p.playerId === P1
            ? { ...p, hand: spider.hand.slice(0, 5), deck: [...spider.hand.slice(5), ...spider.deck] }
            : p,
        ),
      };
      const base = withForm(withForm(handOf(trimmed, ENERGY, P1), HERO, P1), HERO, P2);
      const { taken, state, events: log } = boosted(base, P2);
      const victim = events(log, "attackResolved")[0]!.targetInstanceId;
      const owner = victim === identityOf(state, P1) ? P1 : P2;
      expect(taken.map((e) => [e.targetInstanceId, e.amount])).toEqual([[victim, owner === P1 ? 2 : 1]]);
      expect(discardCodes(state, owner)).toHaveLength(1);
      expect(discardCodes(state, owner === P1 ? P2 : P1)).toEqual([]);
    });
  });
});
