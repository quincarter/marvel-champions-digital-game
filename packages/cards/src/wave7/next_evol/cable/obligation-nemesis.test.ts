import {
  applyCommand,
  createGame,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
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
  picking,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, stackSetAside, withForm } from "../../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../../index.js";
import { CABLE_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Cable's obligation and nemesis set (40031-40036), docs/phase7-wave7.md §7.1. Cable's real precon against Juggernaut,
 * through `wave7Scenario` with the real registry. Nemesis cards sit in the set-aside area until revealed; a reveal is
 * staged with `stageNemesisCardForReveal` (a filler for the villain's boost card, then the card dealt to the player).
 */
const RESURGENCE = "40031";
const STRYFE = "40032";
const BTTF = "40033";
const FIELD = "40034";
const SCAN = "40035";
const BLAST = "40036";
const PURGE = "40006";
const ADVANCE = "01186";
const CABLE = { starterDeckId: "cable-leadership" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const BREAKIN = "40131"; // Captive Hope: an encounter side scheme, staged
const PLAYER_SCHEMES = ["40018", "40019", "40020", "40027"]; // more side schemes of Cable's deck, for the display

type Seat = typeof CABLE | typeof SPIDER_MAN;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;

/** Soldier X's setup search picks Technovirus Purge. */
const choosingPurge: Picker = (state) => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseCards") {
    const hit = choice.options.find((o) => codeOf(state, o.optionId as InstanceId) === PURGE);
    if (hit) return [hit.optionId];
  }
  return firstLegal(state);
};

/** Cable in hero form with Technovirus Purge in play (5 threat), the main scheme at 3 (a villain phase must not complete it). */
function heroGame(players: readonly Seat[] = [CABLE], seed = 1): GameState {
  const config = wave7Scenario("juggernaut", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, choosingPurge, (s) => s.step.phase === "player", WAVE7_DEPS);
  const hero = withForm(settled, { heroForm: 0 });
  const patched = patchInstance(hero, hero.mainScheme.instanceId, { threat: 3 });
  return players.length > 1 ? withForm(patched, { heroForm: 0 }, P2) : patched;
}
const purgeOf = (s: GameState): InstanceId => instancesOf(s, PURGE)[0]!;
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const withoutTough = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, tough: 0 } });
const threat = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const isIn = (list: readonly InstanceId[], id: InstanceId): boolean => list.includes(id);

/** Moves a side scheme (wherever it is: in play, a deck, a hand, a discard pile) into the victory display. */
function toVictory(state: GameState, id: InstanceId): GameState {
  return {
    ...state,
    villainArea: state.villainArea.filter((x) => x !== id),
    victoryDisplay: [...state.victoryDisplay, id],
    players: state.players.map((p) => ({
      ...p,
      deck: p.deck.filter((x) => x !== id),
      hand: p.hand.filter((x) => x !== id),
      discard: p.discard.filter((x) => x !== id),
    })),
  };
}
/** `n` side schemes in the victory display: Purge (from play), Captive Hope (an encounter scheme), then Cable's own. */
function withVictory(state: GameState, n: number): GameState {
  let s = state;
  const sources: InstanceId[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) sources.push(purgeOf(s));
    else if (i === 1) {
      const staged = encounterCardInVillainArea(s, BREAKIN, 2);
      s = staged.state;
      sources.push(staged.id);
    } else sources.push(instancesOf(s, PLAYER_SCHEMES[i - 2]!)[0]!);
  }
  for (const id of sources) s = toVictory(s, id);
  return s;
}

/** Takes a card out of every zone it can be in (surgery), with the instance left as it is. */
function detach(state: GameState, id: InstanceId): GameState {
  return {
    ...state,
    villainArea: state.villainArea.filter((x) => x !== id),
    victoryDisplay: state.victoryDisplay.filter((x) => x !== id),
    players: state.players.map((p) => ({
      ...p,
      deck: p.deck.filter((x) => x !== id),
      hand: p.hand.filter((x) => x !== id),
      discard: p.discard.filter((x) => x !== id),
      playArea: p.playArea.filter((x) => x !== id),
    })),
  };
}
type Where = "deck" | "hand" | "discard" | "victory" | "gone";
/** Moves Technovirus Purge out of play into one zone of Cable's (P1), or out of every zone. */
function purgeTo(state: GameState, where: Where): GameState {
  const id = purgeOf(state);
  const out = detach(state, id);
  const reset = patchInstance(out, id, { threat: 0, controllerId: null });
  if (where === "victory") return { ...reset, victoryDisplay: [...reset.victoryDisplay, id] };
  if (where === "gone") return reset;
  return {
    ...reset,
    players: reset.players.map((p) => (p.playerId === P1 ? { ...p, [where]: [...p[where], id] } : p)),
  };
}

const cardCount = (events: readonly GameEvent[], type: GameEvent["type"]): number =>
  events.filter((e) => e.type === type).length;
/** Damage dealt by `source` to `target`. */
const damageFrom = (events: readonly GameEvent[], source: InstanceId, target: InstanceId): number[] =>
  events.flatMap((e) =>
    e.type === "damageDealt" && e.sourceInstanceId === source && e.targetInstanceId === target ? [e.amount] : [],
  );
const threatFrom = (events: readonly GameEvent[], source: InstanceId, scheme: InstanceId): number[] =>
  events.flatMap((e) =>
    e.type === "threatPlaced" && e.sourceInstanceId === source && e.schemeInstanceId === scheme ? [e.amount] : [],
  );

/**
 * Puts the encounter card `id` behind the `n` cards now on top of the active encounter deck (they are drawn first, as
 * the villain's boost cards and the cards dealt to earlier players). Juggernaut's deck holds only two Advance (01186),
 * so the fillers are whatever is on top.
 */
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

/** Every player ends their turn, which ends the player phase and runs the villain phase. */
const endPhase = (state: GameState): Command[] => state.players.map((p) => endTurn(p.playerId));

/** Reveals set-aside nemesis `code` to `player` in the villain phase, with `fillers` cards for the boosts ahead of it. */
function reveal(
  state: GameState,
  code: string,
  pick: Picker = firstLegal,
  fillers = 1,
  player: PlayerId = P1,
): { state: GameState; events: readonly GameEvent[]; id: InstanceId } {
  const set = stackSetAside(state, code, player);
  const id = instancesOf(set, code)[0]!;
  const staged = behind(set, id, fillers);
  const driven = driveEventsPicking(WAVE7_DEPS, staged, pick, ...endPhase(staged));
  return { ...driven, id };
}
/**
 * Reveals the obligation, which sits in the encounter deck: one filler per player for the villain's activations'
 * boost cards (it activates against each player), `dealtBefore` more for the players dealt ahead of Cable's.
 */
function revealObligation(state: GameState, pick: Picker = firstLegal, dealtBefore = 0) {
  const id = instancesOf(state, RESURGENCE)[0]!;
  const stacked = behind(state, id, state.players.length + dealtBefore);
  const driven = driveEventsPicking(WAVE7_DEPS, stacked, pick, ...endPhase(stacked));
  return { ...driven, id };
}

/** Puts nemesis `code` (a minion or an attachment) into play by surgery, engaged with `player`. */
function minionEngaged(state: GameState, code: string, player: PlayerId): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, P1);
  const id = owner.setAside.find((i) => codeOf(state, i) === code)!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p,
      ),
      villainArea: [...state.villainArea],
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, controllerId: null, engagedWith: player, exhausted: false },
      },
    },
  };
}
/** The minion sits in the engaged player's play area, as an engaged minion does. */
function stryfeEngaged(state: GameState, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const staged = minionEngaged(state, STRYFE, player);
  return {
    id: staged.id,
    state: {
      ...staged.state,
      players: staged.state.players.map((p) =>
        p.playerId === player ? { ...p, playArea: [...p.playArea, staged.id] } : p,
      ),
    },
  };
}

const rejected = (state: GameState, command: Command): boolean => !applyCommand(state, command, WAVE7_DEPS).ok;
const basicAttack = (state: GameState, player: PlayerId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: identityOf(state, player),
  targetInstanceId: target,
});
const basicThwart = (state: GameState, player: PlayerId, target: InstanceId): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: identityOf(state, player),
  schemeInstanceId: target,
});

describe("Cable obligation and nemesis registry", () => {
  const REFS = [
    "40031.technovirus-resurgence-constant",
    "40031.when-revealed",
    "40032.stryfe-forced-interrupt",
    "40033.back-to-the-future-constant",
    "40033.back-to-the-future-constant-2",
    "40034.telekinetic-force-field-forced-interrupt",
    "40034.boost",
    "40035.when-revealed",
    "40035.boost",
    "40036.when-revealed",
    "40036.boost",
  ];
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(CABLE_OBLIGATION_NEMESIS[id]!)).toEqual([]);
  });
  it("holds exactly the eleven refs of 40031-40036", () => {
    expect(Object.keys(CABLE_OBLIGATION_NEMESIS).sort()).toEqual([...REFS].sort());
  });
});

describe("Technovirus Resurgence (40031)", () => {
  it("is Cable's own obligation, dealt to the Nathan Summers player", () => {
    const base = heroGame();
    expect(instancesOf(base, RESURGENCE)).toHaveLength(1);
    const { state, id } = revealObligation(base);
    expect(inst(state, id).attachedTo).not.toBeNull();
  });

  it("with Technovirus Purge already in play: nothing is searched for, the obligation attaches to it", () => {
    const base = heroGame();
    const purge = purgeOf(base);
    expect(isIn(base.villainArea, purge)).toBe(true);
    const { state, id } = revealObligation(base);
    expect(purgeOf(state)).toBe(purge);
    expect(instancesOf(state, PURGE)).toHaveLength(1);
    expect(inst(state, id).attachedTo).toBe(purge);
    expect(inst(state, purge).attachments).toContain(id);
    expect(threat(state, purge)).toBe(5);
  });

  it.each(["deck", "hand", "discard", "victory"] as const)(
    "Purge in your %s: it is put into play with 5 threat and the obligation attaches to it",
    (where) => {
      const base = purgeTo(heroGame(), where);
      const purge = purgeOf(base);
      expect(isIn(base.villainArea, purge)).toBe(false);
      const { state, id } = revealObligation(base);
      expect(isIn(state.villainArea, purge) || isIn(playerOf(state, P1).playArea, purge)).toBe(true);
      expect(isIn(state.victoryDisplay, purge)).toBe(false);
      expect(playerOf(state, P1).hand).not.toContain(purge);
      expect(playerOf(state, P1).discard).not.toContain(purge);
      expect(playerOf(state, P1).deck).not.toContain(purge);
      expect(threat(state, purge)).toBe(5);
      expect(inst(state, purge).controllerId).toBe(P1);
      expect(inst(state, id).attachedTo).toBe(purge);
    },
  );

  it("taking Purge out of the victory display ends the display count: the display is empty after", () => {
    const base = withVictory(heroGame(), 2);
    expect(base.victoryDisplay).toHaveLength(2);
    const { state } = revealObligation(base);
    expect(state.victoryDisplay).toHaveLength(1);
    expect(isIn(state.victoryDisplay, purgeOf(state))).toBe(false);
  });

  const shuffles = (events: readonly GameEvent[], state: GameState): number =>
    events.filter((e) => e.type === "deckShuffled" && JSON.stringify(e.zone).includes(String(P1)) && state).length;

  it("the deck is shuffled when it was searched (Purge found in the deck or not found at all), and not when Purge was already in play", () => {
    // The villain phase itself shuffles nothing of Cable's, so the count is the obligation's.
    const inPlay = revealObligation(heroGame());
    expect(shuffles(inPlay.events, inPlay.state)).toBe(0);
    const fromDeck = revealObligation(purgeTo(heroGame(), "deck"));
    expect(shuffles(fromDeck.events, fromDeck.state)).toBe(1);
    const nowhere = revealObligation(purgeTo(heroGame(), "gone"));
    expect(shuffles(nowhere.events, nowhere.state)).toBe(1);
  });

  it("Purge nowhere to be found: the obligation is discarded and Cable's player is dealt a facedown encounter card", () => {
    const base = purgeTo(heroGame(), "gone");
    const { state, events, id } = revealObligation(base);
    expect(inst(state, id).attachedTo).toBeNull();
    expect(inst(state, id).attachedTo).toBeNull();
    const discards = Object.values(state.encounterDecks).flatMap((d) => d.discard);
    expect(isIn(discards, id)).toBe(true);
    expect(isIn(state.villainArea, purgeOf(state))).toBe(false);
    // The obligation was the one card dealt; the facedown card it deals is revealed after it.
    expect(cardCount(events, "encounterCardRevealed")).toBe(2);
  });

  /** Puts one of Cable's other player side schemes into play (surgery), as a scheme already at the limit. */
  function withOtherScheme(state: GameState): { state: GameState; id: InstanceId } {
    const id = instancesOf(state, "40018")[0]!;
    const out = detach(state, id);
    return {
      id,
      state: {
        ...out,
        villainArea: [...out.villainArea, id],
        instances: { ...out.instances, [id]: { ...out.instances[id]!, faceup: true, threat: 2, controllerId: P1 } },
      },
    };
  }
  /** Answers the limit's discard prompt with `which`, everything else by default. */
  const discardingForLimit =
    (which: InstanceId): Picker =>
    (s) =>
      s.pendingChoice?.prompt.kind === "discardOverPlayerSideSchemeLimit" ? [which] : firstLegal(s);

  it("at the player side scheme limit (MC40 p. 21): the first player discards the other scheme, Purge stays and the obligation attaches", () => {
    const staged = withOtherScheme(purgeTo(heroGame(), "discard"));
    const purge = purgeOf(staged.state);
    const { state, id } = revealObligation(staged.state, discardingForLimit(staged.id));
    expect(isIn(state.villainArea, staged.id)).toBe(false);
    expect(isIn(state.villainArea, purge)).toBe(true);
    expect(inst(state, id).attachedTo).toBe(purge);
  });

  it("at the limit, choosing Purge itself to discard: the obligation cannot attach, so it is discarded and a facedown card is dealt", () => {
    const staged = withOtherScheme(purgeTo(heroGame(), "discard"));
    const purge = purgeOf(staged.state);
    const { state, events, id } = revealObligation(staged.state, discardingForLimit(purge));
    expect(isIn(state.villainArea, purge)).toBe(false);
    expect(isIn(state.villainArea, staged.id)).toBe(true);
    expect(inst(state, id).attachedTo).toBeNull();
    const discards = Object.values(state.encounterDecks).flatMap((d) => d.discard);
    expect(isIn(discards, id)).toBe(true);
    expect(cardCount(events, "encounterCardRevealed")).toBe(2);
  });

  it("two players: Purge comes from Cable's zones and Cable's player controls it", () => {
    const base = purgeTo(heroGame([CABLE, SPIDER_MAN]), "discard");
    const purge = purgeOf(base);
    const { state, id } = revealObligation(base);
    expect(inst(state, purge).controllerId).toBe(P1);
    expect(inst(state, id).attachedTo).toBe(purge);
    expect(threat(state, purge)).toBe(5);
    expect(playerOf(state, P2).discard).not.toContain(purge);
  });

  it("two players: the first player (not Cable's) chooses what goes at the limit", () => {
    const withTwo = heroGame([CABLE, SPIDER_MAN]);
    const staged = withOtherScheme(purgeTo(withTwo, "discard"));
    const secondFirst = { ...staged.state, firstPlayerId: P2 } as GameState;
    let asked: PlayerId | null = null;
    const pick: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "discardOverPlayerSideSchemeLimit") {
        asked = s.pendingChoice.playerId;
        return [staged.id];
      }
      return firstLegal(s);
    };
    // Limit for two players is 1, so the second scheme forces the prompt.
    // Spider-Man, the first player, is dealt a filler ahead of Cable's obligation.
    const { state, id } = revealObligation(secondFirst, pick, 1);
    expect(asked).toBe(P2);
    expect(inst(state, id).attachedTo).toBe(purgeOf(state));
  });

  it("the obligation leaves with the scheme: Purge defeated goes to the victory display, the obligation to the encounter discard pile", () => {
    const base = heroGame();
    const { state: attached, id } = revealObligation(base);
    const purge = purgeOf(attached);
    const low = patchInstance(attached, purge, { threat: 1 });
    const driven = driveEventsPicking(WAVE7_DEPS, low, firstLegal, basicThwart(low, P1, purge));
    expect(isIn(driven.state.victoryDisplay, purge)).toBe(true);
    const discards = Object.values(driven.state.encounterDecks).flatMap((d) => d.discard);
    expect(isIn(discards, id)).toBe(true);
  });
});

describe("Stryfe (40032)", () => {
  it("cancels a PSIONIC event a player plays and takes 1 damage; the event is still played and discarded", () => {
    const base = stryfeEngaged(heroGame());
    const given = moveToHand(base.state, P1, "40003");
    const [event] = given.ids as [InstanceId];
    const scheme = mainOf(given.state);
    const driven = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      firstLegal,
      play(P1, event, payWith(given.state, P1, 2, [event])),
    );
    expect(inst(driven.state, base.id).damage).toBe(1);
    expect(threat(driven.state, scheme)).toBe(3);
    expect(playerOf(driven.state, P1).discard).toContain(event);
  });

  it("a non-PSIONIC event (Bodyslide) is not cancelled and Stryfe takes no damage", () => {
    const base = stryfeEngaged(heroGame());
    const given = moveToHand(base.state, P1, "40002");
    const [event] = given.ids as [InstanceId];
    const driven = driveEventsPicking(WAVE7_DEPS, given.state, firstLegal, play(P1, event, []));
    expect(inst(driven.state, base.id).damage).toBe(0);
    expect(playerOf(driven.state, P1).identity.form).toBe("alterEgo");
  });

  it("two players: hears another player's PSIONIC event too (Spider-Man plays Mind Scan: cancelled, 1 damage)", () => {
    const secondTurn = runWith(WAVE7_DEPS, heroGame([CABLE, SPIDER_MAN]), endTurn(P1));
    const base = stryfeEngaged(secondTurn, P1);
    // Mind Scan is Cable's own card: borrow a copy for the second player's hand (surgery).
    const copy = instancesOf(base.state, "40003")[0]!;
    const owner = playerOf(base.state, P1);
    const moved = patchInstance(
      {
        ...base.state,
        players: base.state.players.map((p) =>
          p.playerId === P1
            ? { ...p, deck: p.deck.filter((x) => x !== copy), hand: p.hand.filter((x) => x !== copy) }
            : { ...p, hand: [...p.hand, copy] },
        ),
      },
      copy,
      { ownerId: P2, controllerId: P2 },
    );
    expect(owner.identity.form).toBe("hero");
    const driven = driveEventsPicking(WAVE7_DEPS, moved, firstLegal, play(P2, copy, payWith(moved, P2, 2, [copy])));
    expect(inst(driven.state, base.id).damage).toBe(1);
    expect(threat(driven.state, mainOf(driven.state))).toBe(3);
    expect(playerOf(driven.state, P2).discard).toContain(copy);
  });

  it("is villainous (data): a revealed Stryfe enters play engaged with the player", () => {
    const { state, id } = reveal(heroGame(), STRYFE);
    expect(inst(state, id).engagedWith).toBe(P1);
  });
});

describe("Back to the Future (40033)", () => {
  /** The side scheme in play with 4 threat (surgery), in a fresh game. */
  function withScheme(players: readonly Seat[] = [CABLE]): { state: GameState; id: InstanceId } {
    const hero = heroGame(players);
    const staged = stackSetAside(hero, BTTF);
    const id = instancesOf(staged, BTTF)[0]!;
    const removed = {
      ...staged,
      encounterDecks: Object.fromEntries(
        Object.entries(staged.encounterDecks).map(([k, d]) => [k, { ...d, deck: d.deck.filter((x) => x !== id) }]),
      ),
      villainArea: [...staged.villainArea, id],
      instances: { ...staged.instances, [id]: { ...staged.instances[id]!, faceup: true, threat: 4 } },
    } as GameState;
    return { state: removed, id };
  }

  it("enters play with 4 threat when revealed", () => {
    const { state, id } = reveal(heroGame(), BTTF);
    expect(isIn(state.villainArea, id)).toBe(true);
    expect(threat(state, id)).toBe(4);
  });

  /** The threat a basic thwart by `player` removes from `scheme` (0 when the removal is barred). */
  function thwartRemoves(state: GameState, player: PlayerId, scheme: InstanceId): number {
    const after = driveEventsPicking(WAVE7_DEPS, state, firstLegal, basicThwart(state, player, scheme)).state;
    return threat(state, scheme) - threat(after, scheme);
  }

  it("the Cable player cannot remove threat from the main scheme or Technovirus Purge, but can from Back to the Future (THW 2)", () => {
    const { state, id } = withScheme();
    expect(thwartRemoves(state, P1, mainOf(state))).toBe(0);
    expect(thwartRemoves(state, P1, purgeOf(state))).toBe(0);
    expect(thwartRemoves(state, P1, id)).toBe(2);
  });

  it("without it the Cable player removes 2 threat from the main scheme (the line is the card's)", () => {
    const base = heroGame();
    expect(thwartRemoves(base, P1, mainOf(base))).toBe(2);
  });

  it("two players: another player cannot remove threat from Back to the Future but removes 1 (THW 1) from the main scheme", () => {
    const { state, id } = withScheme([CABLE, SPIDER_MAN]);
    const turn = runWith(WAVE7_DEPS, state, endTurn(P1));
    expect(thwartRemoves(turn, P2, id)).toBe(0);
    expect(thwartRemoves(turn, P2, mainOf(turn))).toBe(1); // Spider-Man THW 1
    // The Cable player still cannot touch the main scheme in a two player game.
    expect(thwartRemoves(state, P1, mainOf(state))).toBe(0);
  });

  it("the Cable player cannot damage the villain (it is engaged with nobody, Q36); with the card gone he can", () => {
    const { state } = withScheme();
    const villain = villainOf(state);
    expect(rejected(state, basicAttack(state, P1, villain))).toBe(true);
    expect(rejected(heroGame(), basicAttack(heroGame(), P1, villainOf(heroGame())))).toBe(false);
  });

  it("the Cable player can damage a minion engaged with them, and cannot damage one engaged with another player", () => {
    const base = withScheme([CABLE, SPIDER_MAN]);
    const mine = stryfeEngaged(base.state, P1);
    expect(rejected(mine.state, basicAttack(mine.state, P1, mine.id))).toBe(false);
    const theirs = stryfeEngaged(base.state, P2);
    expect(rejected(theirs.state, basicAttack(theirs.state, P1, theirs.id))).toBe(true);
  });

  it("other players cannot damage a minion engaged with the Cable player; they can damage the villain and their own minions", () => {
    const base = withScheme([CABLE, SPIDER_MAN]);
    const turn = runWith(WAVE7_DEPS, base.state, endTurn(P1));
    const mine = stryfeEngaged(turn, P1);
    expect(rejected(mine.state, basicAttack(mine.state, P2, mine.id))).toBe(true);
    expect(rejected(mine.state, basicAttack(mine.state, P2, villainOf(mine.state)))).toBe(false);
    const theirs = stryfeEngaged(turn, P2);
    expect(rejected(theirs.state, basicAttack(theirs.state, P2, theirs.id))).toBe(false);
  });

  it("an event of the Cable player is bound too: Telekinetic Blast cannot target the villain", () => {
    const { state } = withScheme();
    const given = moveToHand(withoutTough(state), P1, "40005");
    const [event] = given.ids as [InstanceId];
    const driven = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      (s) => (s.pendingChoice?.prompt.kind === "chooseTarget" ? picking(villainOf(state))(s) : firstLegal(s)),
      play(P1, event, payWith(given.state, P1, 3, [event])),
    );
    expect(inst(driven.state, villainOf(driven.state)).damage).toBe(inst(state, villainOf(state)).damage);
    // Control: the same blast without the card deals its 6.
    const free = withoutTough(heroGame());
    const loose = moveToHand(free, P1, "40005");
    const [freeEvent] = loose.ids as [InstanceId];
    const struck = driveEventsPicking(
      WAVE7_DEPS,
      loose.state,
      (s) => (s.pendingChoice?.prompt.kind === "chooseTarget" ? picking(villainOf(free))(s) : firstLegal(s)),
      play(P1, freeEvent, payWith(loose.state, P1, 3, [freeEvent])),
    );
    expect(inst(struck.state, villainOf(free)).damage).toBe(inst(free, villainOf(free)).damage + 6);
  });
});

describe("Telekinetic Force Field (40034)", () => {
  it("attaches to the villain when Stryfe is not in play", () => {
    const { state, id } = reveal(heroGame(), FIELD);
    expect(inst(state, id).attachedTo).toBe(villainOf(state));
  });

  it("attaches to Stryfe when he is in play", () => {
    const base = stryfeEngaged(heroGame());
    const { state, id } = reveal(base.state, FIELD, firstLegal, 2);
    expect(inst(state, id).attachedTo).toBe(base.id);
  });

  it("prevents damage to the villain; 2 or more prevented discards it", () => {
    const { state: attached, id } = reveal(withoutTough(heroGame()), FIELD);
    const villain = villainOf(attached);
    const hurt = withoutTough(attached);
    const driven = driveEventsPicking(WAVE7_DEPS, hurt, firstLegal, basicAttack(hurt, P1, villain));
    expect(inst(driven.state, villain).damage).toBe(inst(hurt, villain).damage);
    expect(inst(driven.state, id).attachedTo).toBeNull();
    const discards = Object.values(driven.state.encounterDecks).flatMap((d) => d.discard);
    expect(isIn(discards, id)).toBe(true);
  });

  it("1 damage prevented keeps it: Stryfe's own 1 damage to himself is prevented and the card stays on him", () => {
    const base = stryfeEngaged(heroGame());
    const { state: attached, id } = reveal(base.state, FIELD, firstLegal, 2);
    expect(inst(attached, id).attachedTo).toBe(base.id);
    const given = moveToHand(attached, P1, "40003");
    const [event] = given.ids as [InstanceId];
    const driven = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      firstLegal,
      play(P1, event, payWith(given.state, P1, 2, [event])),
    );
    expect(inst(driven.state, base.id).damage).toBe(0);
    expect(inst(driven.state, id).attachedTo).toBe(base.id);
  });

  it("Boost: after the villain activates with it as the boost card, it attaches to the activating enemy", () => {
    const hero = heroGame();
    const staged = stackSetAside(hero, FIELD);
    const id = instancesOf(staged, FIELD)[0]!;
    const driven = driveEventsPicking(WAVE7_DEPS, staged, firstLegal, ...endPhase(staged));
    expect(inst(driven.state, id).attachedTo).toBe(villainOf(driven.state));
  });

  it("Boost on a minion's activation: it attaches to that minion, not the villain", () => {
    const base = stryfeEngaged(heroGame());
    // The villain activates first and draws Advance; Stryfe draws Force Field next.
    const staged = stackEncounterDeck(stackSetAside(base.state, FIELD), ADVANCE);
    const id = instancesOf(staged, FIELD)[0]!;
    const driven = driveEventsPicking(WAVE7_DEPS, staged, firstLegal, ...endPhase(staged));
    expect(inst(driven.state, id).attachedTo).toBe(base.id);
  });

  it("Boost: its 1 boost icon counts toward the attack (Juggernaut ATK 3 + 1)", () => {
    const staged = stackSetAside(heroGame(), FIELD);
    const driven = driveEventsPicking(WAVE7_DEPS, staged, firstLegal, ...endPhase(staged));
    const attack = driven.events.find((e) => e.type === "attackResolved");
    expect(attack).toMatchObject({ baseAtk: 3, boostIcons: 1, damageDealt: 4 });
  });
});

describe("Mind Scan (40035)", () => {
  it.each([
    [0, 2],
    [1, 3],
    [2, 4],
    [3, 5],
  ])("with %i side schemes in the victory display places %i threat on the main scheme", (n, placed) => {
    const base = withVictory(heroGame(), n);
    expect(base.victoryDisplay).toHaveLength(n);
    const { events, id, state } = reveal(base, SCAN);
    expect(threatFrom(events, id, mainOf(state))).toEqual([placed]);
  });

  it("Boost: the player the villain activates against is confused", () => {
    const staged = stackSetAside(heroGame(), SCAN);
    const driven = driveEventsPicking(WAVE7_DEPS, staged, firstLegal, ...endPhase(staged));
    expect(playerOf(driven.state, P1).identity.form).toBe("hero");
    expect(inst(driven.state, identityOf(driven.state, P1)).statuses.confused).toBe(1);
    // No boost icons: Juggernaut ATK 3 and nothing more.
    expect(driven.events.find((e) => e.type === "attackResolved")).toMatchObject({ baseAtk: 3, boostIcons: 0 });
  });

  it("two players: Boost on Stryfe's attack against the second player confuses that player only", () => {
    const base = stryfeEngaged(heroGame([CABLE, SPIDER_MAN]), P2);
    const staged = stackEncounterDeck(stackSetAside(base.state, SCAN), ADVANCE, ADVANCE);
    const driven = driveEventsPicking(WAVE7_DEPS, staged, firstLegal, ...endPhase(staged));
    expect(inst(driven.state, identityOf(driven.state, P2)).statuses.confused).toBe(1);
    expect(inst(driven.state, identityOf(driven.state, P1)).statuses.confused).toBe(0);
  });

  it("two players: the revealing player's side does not matter, the victory display is shared", () => {
    const base = withVictory(heroGame([CABLE, SPIDER_MAN]), 2);
    const { events, id, state } = reveal(base, SCAN, firstLegal, 2, P1);
    expect(threatFrom(events, id, mainOf(state))).toEqual([4]);
  });
});

describe("Telekinetic Blast (40036)", () => {
  it.each([
    [0, 2],
    [1, 3],
    [2, 4],
    [3, 5],
  ])("with %i side schemes in the victory display the revealing player takes %i damage", (n, taken) => {
    const base = withVictory(heroGame(), n);
    const { events, id, state } = reveal(base, BLAST);
    expect(damageFrom(events, id, identityOf(state, P1))).toEqual([taken]);
  });

  it("Boost: the player the villain activates against is stunned", () => {
    const staged = stackSetAside(heroGame(), BLAST);
    const driven = driveEventsPicking(WAVE7_DEPS, staged, firstLegal, ...endPhase(staged));
    expect(inst(driven.state, identityOf(driven.state, P1)).statuses.stunned).toBe(1);
    expect(driven.events.find((e) => e.type === "attackResolved")).toMatchObject({ baseAtk: 3, boostIcons: 0 });
  });

  it("two players: Boost on Stryfe's attack against the second player stuns that player only", () => {
    const base = stryfeEngaged(heroGame([CABLE, SPIDER_MAN]), P2);
    const staged = stackEncounterDeck(stackSetAside(base.state, BLAST), ADVANCE, ADVANCE);
    const driven = driveEventsPicking(WAVE7_DEPS, staged, firstLegal, ...endPhase(staged));
    expect(inst(driven.state, identityOf(driven.state, P2)).statuses.stunned).toBe(1);
    expect(inst(driven.state, identityOf(driven.state, P1)).statuses.stunned).toBe(0);
  });

  it("two players: a Blast dealt to the second player is taken by that player, not by Cable's", () => {
    const base = withVictory(heroGame([CABLE, SPIDER_MAN]), 1);
    // Two boosts for the villain's activations, one filler dealt to Cable's player, then the Blast for Spider-Man.
    const { events, id, state } = reveal(base, BLAST, firstLegal, 3, P1);
    expect(damageFrom(events, id, identityOf(state, P2))).toEqual([3]);
    expect(damageFrom(events, id, identityOf(state, P1))).toEqual([]);
  });
});
