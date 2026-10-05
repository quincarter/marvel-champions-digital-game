import {
  applyCommand,
  createGame,
  iconsInPlay,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, stackSetAside, withForm } from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { ANGEL_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Angel's obligation and nemesis set (42024-42028), docs/phase7-wave7.md §7.2, §3.62, §3.63, §3.70. His real precon
 * (`angel-protection`) against Stryfe through `wave7Scenario` with the real registry. Nemesis cards sit in the
 * set-aside area until revealed; the obligation sits in the encounter deck. Faces: Warren (`alterEgo`), Angel
 * (`heroForm: 0`), Archangel (`heroForm: 1`). Fixtures from his deck: events Taunt 42016 (cost 1, not AERIAL), Razor
 * Dive 42007 (cost 3, AERIAL), Adaptive Plumage 42003 (cost 3, AERIAL), Metamorphosis 42005 (cost 2, AERIAL), Aerial
 * Intervention 42014 (cost 0, AERIAL); non-events The Power of Flight 42022 and Containment Strategy 42019 (non-events), Siryn 42012 (AERIAL ally), Elixir 42011
 * (not AERIAL).
 */
const OBLIGATION = "42024";
const HARPOON = "42025";
const HOOK = "42026";
const HARPOONS_HARPOON = "42027";
const SPEAR = "42028";
const TAUNT = "42016";
const DIVE = "42007";
const METAMORPHOSIS = "42005";
const INTERVENTION = "42014";
const NON_EVENT = "42022";
const NON_EVENT_2 = "42019";
const WHEN_REVEALED = "42024.when-revealed";
const ACTION = "42024.apocalyptic-influence-action";

const ANGEL_SEAT = { starterDeckId: "angel-protection" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof ANGEL_SEAT | typeof SPIDER_MAN;
type Face = "alterEgo" | { readonly heroForm: number };
const WARREN: Face = "alterEgo";
const ANGEL: Face = { heroForm: 0 };
const ARCHANGEL: Face = { heroForm: 1 };

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const stryfe = (s: GameState): InstanceId => s.activeVillainId!;
/** Every identity starts at -20 damage (surgery, as the main scheme's threat): attack volleys cannot defeat them. */
const HEADROOM = 20;
const damageOf = (s: GameState, p: PlayerId = P1): number => inst(s, identityOf(s, p)).damage + HEADROOM;
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((i) => codeOf(s, i));
const encounterDiscard = (s: GameState): InstanceId[] => Object.values(s.encounterDecks).flatMap((d) => d.discard);
const isIn = (list: readonly InstanceId[], id: InstanceId): boolean => list.includes(id);
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const surged = (run: readonly GameEvent[], id: InstanceId): boolean =>
  run.some((e) => e.type === "surgeTriggered" && e.instanceId === id);
const run = (state: GameState, pick: Picker, ...commands: Command[]) =>
  driveEventsPicking(WAVE7_DEPS, state, pick, ...commands);
const refused = (state: GameState, command: Command): boolean => !applyCommand(state, command, WAVE7_DEPS).ok;

/** Angel's player at seat 1 (alter-ego) in a fresh Stryfe game; headroom on the main scheme, Stryfe without tough. */
function baseGame(players: readonly Seat[] = [ANGEL_SEAT], seed = 1): GameState {
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
/** `face` for the player at `seat`; every other seat in a hero form so no one is in alter-ego unless asked. */
function inFace(state: GameState, face: Face, seat: PlayerId = P1): GameState {
  return face === "alterEgo" ? state : withForm(state, face, seat);
}

const PAD = ["42023", "42023", "42023", "42008", "42008"];
const HAND_PAD = ["42022", "42022", "42019", "42019", "42002", "42009"];
/**
 * Test-only surgery: `player`'s hand, deck (top first) and discard pile become exactly these cards (padded at the
 * bottom of the deck with non-events so the end-of-turn draw never empties it).
 */
function arrange(
  state: GameState,
  zones: { hand?: readonly string[]; deck?: readonly string[]; discard?: readonly string[] },
  player: PlayerId = P1,
  pad = true,
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
  // A hand of at most the hand size, so the end-of-turn draw (and discard) leaves the arranged deck alone.
  const handSize = owner.identity.form === "alterEgo" ? 6 : 5;
  const hand = (zones.hand ?? HAND_PAD.slice(0, handSize)).map(take);
  const deck = [...(zones.deck ?? []), ...(pad ? PAD : [])].map(take);
  const discard = (zones.discard ?? []).map(take);
  return { ...state, players: state.players.map((p) => (p.playerId === player ? { ...p, hand, deck, discard } : p)) };
}

/** Puts the encounter card `id` behind the `n` cards now on top of the active encounter deck. */
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
/**
 * Moves Harpoon from `owner`'s set-aside area into the encounter deck, `depth` cards down (past the villain's boost and
 * the cards dealt before the staged card), or onto the encounter discard pile: out of play and findable by a search.
 */
function harpoonOutOfPlay(
  state: GameState,
  where: "deck" | "discard",
  owner: PlayerId = P1,
): { state: GameState; id: InstanceId } {
  const id = playerOf(state, owner).setAside.find((i) => codeOf(state, i) === HARPOON)!;
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const deck = where === "deck" ? [...pile.deck.slice(0, 6), id, ...pile.deck.slice(6)] : pile.deck;
  const discard = where === "discard" ? [id, ...pile.discard] : pile.discard;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck, discard } },
    },
  };
}
/** Ends the turn of whoever is active, `players` times: the rest of the player phase and the villain phase. */
function endRound(state: GameState, pick: Picker = firstLegal) {
  let current = state;
  const log: GameEvent[] = [];
  for (let i = 0; i < state.players.length; i++) {
    const step = current.step;
    if (step.phase !== "player" || step.kind !== "turn") break;
    const driven = run(current, pick, endTurn(step.activePlayerId));
    current = driven.state;
    log.push(...driven.events);
  }
  return { state: current, events: log as readonly GameEvent[] };
}
/** A copy of `code` from `owner`'s hand or deck put into `player`'s play area, ready, under `player`'s control. */
function allyInPlay(
  state: GameState,
  code: string,
  player: PlayerId,
  owner: PlayerId,
): { state: GameState; id: InstanceId } {
  const from = playerOf(state, owner);
  const id = [...from.hand, ...from.deck].find((i) => codeOf(state, i) === code)!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        hand: p.hand.filter((i) => i !== id),
        deck: p.deck.filter((i) => i !== id),
        playArea: p.playerId === player ? [...p.playArea, id] : p.playArea,
      })),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, controllerId: player, exhausted: false },
      },
    },
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
/** Picks `id` when a prompt offers it, else `inner`. */
const picking =
  (id: InstanceId, inner: Picker = firstLegal): Picker =>
  (state) => {
    const offered = state.pendingChoice?.options.map((o) => o.optionId) ?? [];
    return offered.includes(id) ? [id] : inner(state);
  };

describe("Angel obligation and nemesis registry", () => {
  const REFS = [
    "42024.obligation",
    WHEN_REVEALED,
    ACTION,
    "42025.harpoon-constant",
    "42025.when-revealed",
    "42026.hook-line-and-sinker-constant",
    "42026.hook-line-and-sinker-forced-response",
    "42027.harpoons-harpoon-constant",
    "42027.harpoons-harpoon-forced-response",
    "42028.when-revealed",
    "42028.boost",
  ];
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(ANGEL_OBLIGATION_NEMESIS[id]!)).toEqual([]);
  });
  it("holds exactly the ten refs (Hook, Line, and Sinker's Forced Response is not scripted)", () => {
    expect(Object.keys(ANGEL_OBLIGATION_NEMESIS).sort()).toEqual([...REFS].sort());
  });
});

describe("Apocalyptic Influence (42024)", () => {
  it("is Warren's own obligation: revealed, it stays in his play area (not discarded)", () => {
    const { state, id } = revealObligation(baseGame());
    expect(isIn(playerOf(state, P1).playArea, id)).toBe(true);
    expect(isIn(encounterDiscard(state), id)).toBe(false);
  });

  it.each([
    ["Warren Worthington III (alter-ego)", WARREN],
    ["Angel", ANGEL],
  ] as const)("When Revealed in %s form: changes to Archangel form and places no threat", (_label, face) => {
    const base = inFace(baseGame(), face);
    const { state, id, events: log } = revealObligation(base);
    expect(playerOf(state, P1).identity).toMatchObject({ form: "hero", heroFormIndex: 1 });
    expect(events(log, "formChanged")).toContainEqual(expect.objectContaining({ playerId: P1, heroFormIndex: 1 }));
    expect(events(log, "threatPlaced").filter((e) => e.sourceInstanceId === id)).toEqual([]);
  });

  it("When Revealed in Archangel form: 2 threat on the main scheme and the face stays Archangel", () => {
    const base = inFace(baseGame(), ARCHANGEL);
    const { state, id, events: log } = revealObligation(base);
    expect(playerOf(state, P1).identity).toMatchObject({ form: "hero", heroFormIndex: 1 });
    const placed = events(log, "threatPlaced").filter((e) => e.sourceInstanceId === id);
    expect(placed).toEqual([expect.objectContaining({ schemeInstanceId: base.mainScheme.instanceId, amount: 2 })]);
    expect(events(log, "formChanged").filter((e) => e.playerId === P1)).toEqual([]);
  });

  it("prints a hazard icon: it adds 1 hazard icon in play while it is in his play area", () => {
    const { state, id } = revealObligation(inFace(baseGame(), ARCHANGEL));
    const without: GameState = {
      ...state,
      players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== id) })),
    };
    expect(iconsInPlay(state, WAVE7_DEPS, "hazard") - iconsInPlay(without, WAVE7_DEPS, "hazard")).toBe(1);
  });

  describe("Alter-Ego Action: deal the first player 1 encounter card, then discard this card", () => {
    /** The obligation in play (revealed in Archangel form), Warren then back in alter-ego form. */
    function inPlay(players: readonly Seat[] = [ANGEL_SEAT], seat: PlayerId = P1) {
      const base = inFace(baseGame(players), ARCHANGEL, seat);
      const revealed = revealObligation(base, firstLegal, players.length);
      return { state: revealed.state, id: revealed.id };
    }
    it("one player: Warren is dealt the facedown card and the obligation goes to the encounter discard pile", () => {
      const { state, id } = inPlay();
      const alterEgo = withForm(state, "alterEgo");
      const before = playerOf(alterEgo, P1).dealtEncounter.length;
      const { state: after } = run(alterEgo, firstLegal, use(P1, id, ACTION));
      expect(playerOf(after, P1).dealtEncounter.length).toBe(before + 1);
      expect(isIn(playerOf(after, P1).playArea, id)).toBe(false);
      expect(isIn(encounterDiscard(after), id)).toBe(true);
    });
    it("is an Alter-Ego Action: refused in Archangel form and in Angel form", () => {
      const { state, id } = inPlay();
      expect(refused(state, use(P1, id, ACTION))).toBe(true);
      expect(refused(withForm(state, ANGEL), use(P1, id, ACTION))).toBe(true);
    });
    it("two players, Warren is seat 2: the first player (seat 1, Spider-Man) is dealt the card, not Warren", () => {
      const { state, id } = inPlay([SPIDER_MAN, ANGEL_SEAT], P2);
      expect(isIn(playerOf(state, P2).playArea, id)).toBe(true);
      const ready = asActive({ ...withForm(state, "alterEgo", P2), firstPlayerId: P1 }, P2);
      const before = [P1, P2].map((p) => playerOf(ready, p).dealtEncounter.length);
      const { state: after } = run(ready, firstLegal, use(P2, id, ACTION));
      expect(playerOf(after, P1).dealtEncounter.length).toBe(before[0]! + 1);
      expect(playerOf(after, P2).dealtEncounter.length).toBe(before[1]);
      expect(isIn(encounterDiscard(after), id)).toBe(true);
    });
    it("two players: only the Warren Worthington III player may use it", () => {
      const { state, id } = inPlay([SPIDER_MAN, ANGEL_SEAT], P2);
      const ready = asActive(withForm(state, "alterEgo", P2), P2);
      expect(refused(ready, use(P1, id, ACTION))).toBe(true);
      expect(refused(ready, use(P2, id, ACTION))).toBe(false);
    });
  });

  it("two players, Warren is seat 2: it is given to his play area and changes his face, not the first player's", () => {
    const base = withForm(baseGame([SPIDER_MAN, ANGEL_SEAT]), ANGEL, P2);
    const { state, id } = revealObligation(withForm(base, { heroForm: 0 }, P1), firstLegal, 2);
    expect(isIn(playerOf(state, P2).playArea, id)).toBe(true);
    expect(isIn(playerOf(state, P1).playArea, id)).toBe(false);
    expect(playerOf(state, P2).identity).toMatchObject({ form: "hero", heroFormIndex: 1 });
    expect(playerOf(state, P1).identity).toMatchObject({ form: "hero", heroFormIndex: 0 });
  });

  it("Boost: its 2 boost icons add 2 to the villain's attack", () => {
    const base = inFace(baseGame(), ANGEL);
    const id = instancesOf(base, OBLIGATION)[0]!;
    const staged = behind(base, id, 0);
    const driven = run(staged, firstLegal, ...endPhase(staged));
    expect(events(driven.events, "attackResolved")[0]).toMatchObject({ boostIcons: 2 });
  });
});

describe("Harpoon (42025)", () => {
  const dealt = (zones: Parameters<typeof arrange>[1]) => {
    const revealed = reveal(arrange(baseGame(), zones), HARPOON);
    return { ...revealed, taken: damageOf(revealed.state) };
  };

  it("is revealed into play engaged with the Angel player", () => {
    const { state, id } = dealt({ deck: [TAUNT] });
    expect(inst(state, id).engagedWith).toBe(P1);
  });

  it.each([
    ["Aerial Intervention, printed cost 0", INTERVENTION, 0],
    ["Taunt, printed cost 1", TAUNT, 1],
    ["Metamorphosis, printed cost 2", METAMORPHOSIS, 2],
    ["Razor Dive, printed cost 3", DIVE, 3],
  ] as const)(
    "When Revealed discards from the top until %s and takes that much indirect damage",
    (_label, event, cost) => {
      const { state, taken } = dealt({ deck: [NON_EVENT, NON_EVENT_2, event, TAUNT] });
      expect(taken).toBe(cost);
      // The two non-events and the first event are discarded; the second event stays on top of the deck.
      expect(discardCodes(state).slice(0, 3).sort()).toEqual([event, NON_EVENT, NON_EVENT_2].sort());
      expect(codeOf(state, playerOf(state, P1).deck[0]!)).toBe(TAUNT);
    },
  );

  it("the discarded event is the first event, even with a pricier one right behind it", () => {
    const { taken, state } = dealt({ deck: [TAUNT, DIVE] });
    expect(taken).toBe(1);
    expect(codeOf(state, playerOf(state, P1).deck[0]!)).toBe(DIVE);
  });

  it("an AERIAL event does not give Harpoon surge (only Spear Shot does)", () => {
    const { events: log, id } = dealt({ deck: [DIVE] });
    expect(surged(log, id)).toBe(false);
  });

  it("with no event in his deck the whole deck is discarded and no indirect damage is taken", () => {
    const base = arrange(baseGame(), { deck: [NON_EVENT, NON_EVENT_2] }, P1, false);
    const stripped: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, hand: [...p.hand, ...p.deck.slice(2)], deck: p.deck.slice(0, 2) })),
    };
    const { state } = reveal(stripped, HARPOON);
    expect(damageOf(state)).toBe(0);
  });

  it("two players: only the player dealt Harpoon discards and takes damage; the other deck is untouched", () => {
    const base = arrange(baseGame([SPIDER_MAN, ANGEL_SEAT]), { deck: [DIVE] }, P2);
    const deckBefore = playerOf(base, P1).deck;
    const { state, id } = reveal(base, HARPOON, firstLegal, 3, P2);
    expect(inst(state, id).engagedWith).toBe(P2);
    expect(damageOf(state, P2)).toBe(3);
    expect(damageOf(state, P1)).toBe(0);
    expect(playerOf(state, P1).deck).toEqual(deckBefore.filter((i) => playerOf(state, P1).deck.includes(i)));
    expect(discardCodes(state, P1)).toEqual([]);
  });

  describe("[star] +1 ATK while attacking a character with the AERIAL trait", () => {
    /** Harpoon (from `owner`'s set-aside area) engaged with `player`; the villain phase runs; Harpoon's attack. */
    const attackOf = (state: GameState, player: PlayerId, owner: PlayerId = player, pick: Picker = firstLegal) => {
      const engaged = minionEngaged(state, HARPOON, player, owner);
      // Stryfe is stunned so that he does not attack first (a defending ally would be exhausted before Harpoon's turn).
      const staged = patchInstance(engaged.state, stryfe(state), {
        statuses: { ...inst(state, stryfe(state)).statuses, stunned: 1 },
      });
      const driven = run(staged, pick, ...endPhase(staged));
      return events(driven.events, "attackResolved").find((e) => e.enemyInstanceId === engaged.id);
    };
    const twoSeats = () => withForm(withForm(baseGame([SPIDER_MAN, ANGEL_SEAT]), { heroForm: 0 }, P1), ANGEL, P2);
    it("attacking Angel (AERIAL): 2 ATK", () => {
      expect(attackOf(inFace(baseGame(), ANGEL), P1)).toMatchObject({ baseAtk: 2 });
    });
    it("attacking Archangel (AERIAL): 2 ATK", () => {
      expect(attackOf(inFace(baseGame(), ARCHANGEL), P1)).toMatchObject({ baseAtk: 2 });
    });
    it("attacking a non-AERIAL hero (Spider-Man, seat 1): 1 ATK; engaged with the Angel seat: 2", () => {
      expect(attackOf(twoSeats(), P1, P2)).toMatchObject({ baseAtk: 1 });
      expect(attackOf(twoSeats(), P2, P2)).toMatchObject({ baseAtk: 2 });
    });
    it("an AERIAL ally defending (Siryn) takes 2 ATK; a non-AERIAL ally defending (Elixir) takes 1", () => {
      const siryn = allyInPlay(twoSeats(), "42012", P1, P2);
      expect(attackOf(siryn.state, P1, P2, picking(siryn.id))).toMatchObject({
        baseAtk: 2,
        targetInstanceId: siryn.id,
      });
      const elixir = allyInPlay(twoSeats(), "42011", P1, P2);
      expect(attackOf(elixir.state, P1, P2, picking(elixir.id))).toMatchObject({
        baseAtk: 1,
        targetInstanceId: elixir.id,
      });
    });
  });

  it("Boost: its 2 boost icons add 2 to the villain's attack", () => {
    const base = inFace(baseGame(), ANGEL);
    const staged = stackSetAside(base, HARPOON);
    const driven = run(staged, firstLegal, ...endPhase(staged));
    expect(events(driven.events, "attackResolved")[0]).toMatchObject({ boostIcons: 2 });
  });
});

describe("Hook, Line, and Sinker (42026)", () => {
  it("enters with 2 threat per player (1 player: 2; 2 players: 4)", () => {
    const one = reveal(baseGame(), HOOK);
    expect(inst(one.state, one.id).threat).toBe(2);
    const two = reveal(baseGame([ANGEL_SEAT, SPIDER_MAN]), HOOK);
    expect(inst(two.state, two.id).threat).toBe(4);
  });

  describe("each attack from a BRUTE enemy deals indirect damage", () => {
    /** Hook in play, then Harpoon (a BRUTE) engaged with Angel's seat attacks in the villain phase. */
    function brutesAttack(extra: (s: GameState) => GameState = (s) => s) {
      const hook = reveal(inFace(baseGame(), ANGEL), HOOK);
      const { state, id } = minionEngaged(extra(hook.state), HARPOON);
      const driven = run(state, firstLegal, ...endPhase(state));
      return { ...driven, harpoon: id, hook: hook.id };
    }
    it("Harpoon's attack (a BRUTE) is dealt as indirect damage: Angel alone takes the whole of it", () => {
      const { events: log, harpoon, state } = brutesAttack();
      const hit = events(log, "attackResolved").find((e) => e.enemyInstanceId === harpoon)!;
      expect(hit.damageDealt).toBeGreaterThan(0);
      expect(damageOf(state)).toBeGreaterThanOrEqual(hit.damageDealt);
    });
    it("with an ally in play the player divides the indirect damage: an assignment prompt is offered", () => {
      let sawAssignment = false;
      const hook = reveal(inFace(baseGame(), ANGEL), HOOK);
      const withAlly = allyInPlay(hook.state, "42012", P1, P1).state;
      const { state } = minionEngaged(withAlly, HARPOON);
      const spy: Picker = (s) => {
        if (s.pendingChoice?.prompt.kind === "assignIndirectDamage") sawAssignment = true;
        return firstLegal(s);
      };
      run(state, spy, ...endPhase(state));
      expect(sawAssignment).toBe(true);
    });
    it("a non-BRUTE enemy (Stryfe) attacks as normal: even with an ally in play no indirect assignment is asked", () => {
      let sawAssignment = false;
      const hook = reveal(inFace(baseGame(), ANGEL), HOOK);
      const staged = allyInPlay(hook.state, "42012", P1, P1).state;
      const spy: Picker = (s) => {
        if (s.pendingChoice?.prompt.kind === "assignIndirectDamage") sawAssignment = true;
        return firstLegal(s);
      };
      const driven = run(staged, spy, ...endPhase(staged));
      const attack = events(driven.events, "attackResolved").find((e) => e.enemyInstanceId === stryfe(staged));
      expect(attack?.damageDealt).toBeGreaterThan(0);
      expect(sawAssignment).toBe(false);
    });
  });

  describe("Forced Response: after a friendly character takes any amount of indirect damage, exhaust it", () => {
    /** Answers an indirect damage assignment with `points` per character (in order), else `firstLegal`. */
    const assigning =
      (shares: readonly (readonly [InstanceId, number])[]): Picker =>
      (s) =>
        s.pendingChoice?.prompt.kind === "assignIndirectDamage"
          ? shares.flatMap(([id, points]) => Array.from({ length: points }, (_, n) => `${id}#${n + 1}`))
          : firstLegal(s);
    /** The damage `target` took from `source`, by the log. */
    const tookFrom = (log: readonly GameEvent[], target: InstanceId, source: InstanceId): number =>
      events(log, "damageDealt")
        .filter((e) => e.targetInstanceId === target && e.sourceInstanceId === source)
        .reduce((sum, e) => sum + e.amount, 0);
    /** A fresh game, every identity ready and in hero form (Angel's face), with Hook in play unless `hookIn` is false. */
    function staged(players: readonly Seat[], hookIn = true) {
      const base = inFace(baseGame(players), ANGEL);
      const hook = hookIn ? reveal(base, HOOK).state : base;
      // The villain phase that revealed Hook left characters as the attacks left them: start from everyone ready.
      return hook.players.reduce(
        (acc, p) =>
          patchInstance(
            p.playerId === P1 ? acc : withForm(acc, { heroForm: 0 }, p.playerId),
            identityOf(acc, p.playerId),
            {
              exhausted: false,
            },
          ),
        hook,
      );
    }
    /** The rest of the player phase and the villain phase, whoever is first player by now. */
    const villainPhase = (state: GameState, pick: Picker = firstLegal) => endRound(state, pick);

    it("Harpoon's undefended attack: Angel takes all 2 of it (1 ATK, +1 against AERIAL) and is exhausted", () => {
      const { state, id: harpoon } = minionEngaged(staged([ANGEL_SEAT]), HARPOON);
      const hero = identityOf(state);
      const driven = villainPhase(state);
      expect(events(driven.events, "attackResolved").find((e) => e.enemyInstanceId === harpoon)?.damageDealt).toBe(2);
      expect(tookFrom(driven.events, hero, harpoon)).toBe(2);
      expect(inst(driven.state, hero).exhausted).toBe(true);
    });
    it("the hero and an ally each assigned some are each exhausted; an ally assigned none is not", () => {
      const one = allyInPlay(staged([ANGEL_SEAT]), "42012", P1, P1);
      const two = allyInPlay(one.state, "42011", P1, P1);
      const { state, id: harpoon } = minionEngaged(two.state, HARPOON);
      const hero = identityOf(state);
      const driven = villainPhase(
        state,
        assigning([
          [hero, 1],
          [one.id, 1],
        ]),
      );
      expect(tookFrom(driven.events, hero, harpoon)).toBe(1);
      expect(tookFrom(driven.events, one.id, harpoon)).toBe(1);
      expect(inst(driven.state, one.id).damage).toBe(1);
      expect(inst(driven.state, two.id).damage).toBe(0);
      expect(inst(driven.state, hero).exhausted).toBe(true);
      expect(inst(driven.state, one.id).exhausted).toBe(true);
      expect(inst(driven.state, two.id).exhausted).toBe(false);
    });
    it("an assigned share a tough status card absorbs was not taken: that ally is not exhausted", () => {
      const one = allyInPlay(staged([ANGEL_SEAT]), "42012", P1, P1);
      const tough = patchInstance(one.state, one.id, { statuses: { ...inst(one.state, one.id).statuses, tough: 1 } });
      const { state, id: harpoon } = minionEngaged(tough, HARPOON);
      const hero = identityOf(state);
      const driven = villainPhase(
        state,
        assigning([
          [hero, 1],
          [one.id, 1],
        ]),
      );
      expect(tookFrom(driven.events, hero, harpoon)).toBe(1);
      expect(tookFrom(driven.events, one.id, harpoon)).toBe(0);
      expect(inst(driven.state, one.id).damage).toBe(0);
      expect(inst(driven.state, one.id).statuses.tough).toBe(0);
      expect(inst(driven.state, hero).exhausted).toBe(true);
      expect(inst(driven.state, one.id).exhausted).toBe(false);
    });
    it("direct damage does not trigger it: Stryfe's undefended attack (not a BRUTE) leaves Angel ready", () => {
      const state = staged([ANGEL_SEAT]);
      const hero = identityOf(state);
      const driven = villainPhase(state);
      expect(tookFrom(driven.events, hero, stryfe(state))).toBeGreaterThan(0);
      expect(inst(driven.state, hero).exhausted).toBe(false);
    });
    it("without Hook in play Harpoon's attack is direct damage: 2 to Angel, who stays ready", () => {
      const { state, id: harpoon } = minionEngaged(staged([ANGEL_SEAT], false), HARPOON);
      const hero = identityOf(state);
      const driven = villainPhase(state);
      expect(tookFrom(driven.events, hero, harpoon)).toBe(2);
      expect(inst(driven.state, hero).exhausted).toBe(false);
    });
    it("two players: another player's ally assigned a BRUTE's indirect damage is exhausted; the heroes are not", () => {
      const base = staged([ANGEL_SEAT, SPIDER_MAN]);
      const ally = allyInPlay(base, "01084", P2, P2);
      const { state, id: harpoon } = minionEngaged(ally.state, HARPOON, P2);
      const spidey = identityOf(state, P2);
      const driven = villainPhase(state, assigning([[ally.id, 1]]));
      // Spider-Man is not AERIAL: Harpoon attacks for his printed 1, which P2 assigns to Nick Fury.
      expect(events(driven.events, "attackResolved").find((e) => e.enemyInstanceId === harpoon)?.damageDealt).toBe(1);
      expect(tookFrom(driven.events, ally.id, harpoon)).toBe(1);
      expect(tookFrom(driven.events, spidey, harpoon)).toBe(0);
      expect(inst(driven.state, ally.id).exhausted).toBe(true);
      expect(inst(driven.state, spidey).exhausted).toBe(false);
      expect(inst(driven.state, identityOf(driven.state, P1)).exhausted).toBe(false);
    });
    it("two players: Angel's ally assigned his share is exhausted while the other player's characters stay ready", () => {
      const base = staged([ANGEL_SEAT, SPIDER_MAN]);
      const mine = allyInPlay(base, "42012", P1, P1);
      const theirs = allyInPlay(mine.state, "01084", P2, P2);
      const { state, id: harpoon } = minionEngaged(theirs.state, HARPOON, P1);
      const hero = identityOf(state, P1);
      const driven = villainPhase(
        state,
        assigning([
          [hero, 1],
          [mine.id, 1],
        ]),
      );
      expect(tookFrom(driven.events, hero, harpoon)).toBe(1);
      expect(tookFrom(driven.events, mine.id, harpoon)).toBe(1);
      expect(inst(driven.state, hero).exhausted).toBe(true);
      expect(inst(driven.state, mine.id).exhausted).toBe(true);
      expect(inst(driven.state, theirs.id).exhausted).toBe(false);
      expect(inst(driven.state, identityOf(driven.state, P2)).exhausted).toBe(false);
    });
  });

  it("Boost: its 3 boost icons add 3 to the villain's attack", () => {
    const staged = stackSetAside(inFace(baseGame(), ANGEL), HOOK);
    const driven = run(staged, firstLegal, ...endPhase(staged));
    expect(events(driven.events, "attackResolved")[0]).toMatchObject({ boostIcons: 3 });
  });
});

describe("Harpoon's Harpoon (42027)", () => {
  it("with Harpoon in play: attaches to him and gives +1 ATK (data), no search", () => {
    const base = inFace(baseGame(), ANGEL);
    const { state: engaged, id: harpoon } = minionEngaged(base, HARPOON);
    const { state, id, events: log } = reveal(engaged, HARPOONS_HARPOON);
    expect(inst(state, id).attachedTo).toBe(harpoon);
    expect(surged(log, id)).toBe(false);
  });

  it("with Harpoon in the encounter deck: searches for him, reveals him (When Revealed resolves) and attaches", () => {
    const base = arrange(baseGame(), { deck: [DIVE] });
    const { state: staged, id: harpoon } = harpoonOutOfPlay(base, "deck");
    const { state, id, events: log } = reveal(staged, HARPOONS_HARPOON, firstLegal, 1);
    expect(
      isIn(
        events(log, "encounterCardRevealed").map((e) => e.instanceId),
        harpoon,
      ),
    ).toBe(true);
    expect(inst(state, harpoon).engagedWith).toBe(P1);
    expect(inst(state, id).attachedTo).toBe(harpoon);
    // Harpoon's own When Revealed ran: Razor Dive (printed cost 3) discarded and 3 indirect damage taken.
    expect(discardCodes(state)).toContain(DIVE);
    expect(damageOf(state)).toBe(3);
    expect(surged(log, id)).toBe(false);
  });

  it("with Harpoon in the encounter discard pile: found there as well", () => {
    const base = arrange(baseGame(), { deck: [TAUNT] });
    const { state: moved, id: harpoon } = harpoonOutOfPlay(base, "discard");
    const { state, id } = reveal(moved, HARPOONS_HARPOON, firstLegal, 1);
    expect(inst(state, id).attachedTo).toBe(harpoon);
    expect(damageOf(state)).toBe(1);
  });

  it("with Harpoon out of reach (still set aside): it cannot attach, gains surge and is discarded", () => {
    const { state, id, events: log } = reveal(baseGame(), HARPOONS_HARPOON);
    expect(surged(log, id)).toBe(true);
    expect(isIn(encounterDiscard(state), id)).toBe(true);
    expect(inst(state, id).attachedTo ?? null).toBeNull();
  });

  describe("[star] Forced Response: after Harpoon attacks you, take 2 indirect damage", () => {
    /** Harpoon (the Angel seat's) engaged with `player`, the attachment on him; then the next villain phase. */
    function attacked(base: GameState, player: PlayerId, owner: PlayerId) {
      const { state: engaged, id: harpoon } = minionEngaged(base, HARPOON, player, owner);
      const revealed = reveal(engaged, HARPOONS_HARPOON, firstLegal, base.players.length, owner);
      const driven = endRound(revealed.state);
      const indirect = events(driven.events, "damageDealt").filter((e) => e.sourceInstanceId === revealed.id);
      return { revealed, driven, harpoon, indirect };
    }
    it("one player: Angel takes the attack (ATK 1 + 1 AERIAL + 1 attachment = 3) and then 2 indirect damage", () => {
      const { revealed, driven, harpoon, indirect } = attacked(inFace(baseGame(), ANGEL), P1, P1);
      expect(inst(revealed.state, revealed.id).attachedTo).toBe(harpoon);
      const hit = events(driven.events, "attackResolved").find((e) => e.enemyInstanceId === harpoon)!;
      expect(hit.baseAtk).toBe(3);
      expect(indirect).toEqual([expect.objectContaining({ targetInstanceId: identityOf(driven.state), amount: 2 })]);
    });
    it("two players: Harpoon attacks seat 1 (Spider-Man): only seat 1 takes the 2 indirect damage", () => {
      const { driven, harpoon, indirect } = attacked(
        withForm(withForm(baseGame([SPIDER_MAN, ANGEL_SEAT]), { heroForm: 0 }, P1), ANGEL, P2),
        P1,
        P2,
      );
      const hit = events(driven.events, "attackResolved").find((e) => e.enemyInstanceId === harpoon)!;
      expect(hit.targetInstanceId).toBe(identityOf(driven.state, P1));
      expect(indirect).toEqual([
        expect.objectContaining({ targetInstanceId: identityOf(driven.state, P1), amount: 2 }),
      ]);
    });
    it("two players: Harpoon attacks the Angel seat: only that seat takes it", () => {
      const { driven, indirect } = attacked(
        withForm(withForm(baseGame([SPIDER_MAN, ANGEL_SEAT]), { heroForm: 0 }, P1), ANGEL, P2),
        P2,
        P2,
      );
      expect(indirect).toEqual([
        expect.objectContaining({ targetInstanceId: identityOf(driven.state, P2), amount: 2 }),
      ]);
    });
  });

  it("Boost: its 2 boost icons add 2 to the villain's attack", () => {
    const staged = stackSetAside(inFace(baseGame(), ANGEL), HARPOONS_HARPOON);
    const driven = run(staged, firstLegal, ...endPhase(staged));
    expect(events(driven.events, "attackResolved")[0]).toMatchObject({ boostIcons: 2 });
  });
});

describe("Spear Shot (42028)", () => {
  const spear = (zones: Parameters<typeof arrange>[1]) => {
    const revealed = reveal(arrange(baseGame(), zones), SPEAR);
    return { ...revealed, taken: damageOf(revealed.state) };
  };

  it("there are two copies in the set", () => {
    expect(playerOf(baseGame(), P1).setAside.filter((i) => codeOf(baseGame(), i) === SPEAR)).toHaveLength(2);
  });

  it.each([
    ["Taunt (TACTIC, cost 1)", TAUNT, 1, false],
    ["Razor Dive (AERIAL, cost 3)", DIVE, 3, true],
    ["Aerial Intervention (AERIAL, cost 0)", INTERVENTION, 0, true],
    ["Metamorphosis (AERIAL, cost 2)", METAMORPHOSIS, 2, true],
  ] as const)(
    "When Revealed, event %s: indirect damage is its printed cost; surge only when it is AERIAL",
    (_label, event, cost, surge) => {
      const { taken, events: log, id, state } = spear({ deck: [NON_EVENT, event, TAUNT] });
      expect(taken).toBe(cost);
      expect(surged(log, id)).toBe(surge);
      expect(discardCodes(state).slice(0, 2).sort()).toEqual([event, NON_EVENT].sort());
      // Surge reveals the next encounter card as well.
      expect(events(log, "encounterCardRevealed").length).toBeGreaterThanOrEqual(surge ? 2 : 1);
    },
  );

  it("with no event in the deck: nothing is taken and no surge", () => {
    const base = arrange(baseGame(), { deck: [NON_EVENT, NON_EVENT_2] }, P1, false);
    const stripped: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, hand: [...p.hand, ...p.deck.slice(2)], deck: p.deck.slice(0, 2) })),
    };
    const { state, events: log, id } = reveal(stripped, SPEAR);
    expect(damageOf(state)).toBe(0);
    expect(surged(log, id)).toBe(false);
  });

  it("two players: the player dealt Spear Shot (seat 2) discards from their own deck and takes the damage", () => {
    const base = arrange(baseGame([SPIDER_MAN, ANGEL_SEAT]), { deck: [DIVE] }, P2);
    const { state } = reveal(base, SPEAR, firstLegal, 3, P2);
    expect(damageOf(state, P2)).toBe(3);
    expect(damageOf(state, P1)).toBe(0);
  });

  describe("[star] Boost: take 2 indirect damage", () => {
    it("the player the villain attacks takes 2 (boost icons 0, so the attack adds nothing)", () => {
      const base = inFace(baseGame(), ANGEL);
      const staged = stackSetAside(base, SPEAR);
      const driven = run(staged, firstLegal, ...endPhase(staged));
      const attack = events(driven.events, "attackResolved")[0]!;
      expect(attack.boostIcons).toBe(0);
      const damage = events(driven.events, "damageDealt").filter(
        (e) => e.targetInstanceId === identityOf(driven.state),
      );
      expect(damage.map((e) => e.amount)).toContain(2);
    });
    it("two players: only the player the villain attacks takes it", () => {
      const base = withForm(withForm(baseGame([ANGEL_SEAT, SPIDER_MAN]), ANGEL, P1), { heroForm: 0 }, P2);
      const staged = stackSetAside(base, SPEAR);
      const driven = run(staged, firstLegal, ...endPhase(staged));
      const attack = events(driven.events, "attackResolved")[0]!;
      const others = [P1, P2].filter((p) => identityOf(driven.state, p) !== attack.targetInstanceId);
      expect(
        events(driven.events, "damageDealt").filter(
          (e) => e.targetInstanceId === identityOf(driven.state, others[0]!) && e.amount === 2,
        ),
      ).toEqual([]);
    });
  });
});
