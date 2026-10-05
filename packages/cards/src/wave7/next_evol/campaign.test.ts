import { cardId } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  createGame,
  handSize,
  hasKeyword,
  playCostOf,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { action, chosen, encounterCards, putIntoPlay, selectCards, you } from "../../dsl/index.js";
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
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { round, heroed, type Plan } from "./superpower-testing.js";
import { WAVE7_ABILITIES, wave7Scenario } from "../index.js";
import { NEXT_EVOL_CAMPAIGN_CARDS } from "./campaign.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The campaign cards 40190-40203 (docs/phase7-wave7.md §3.43-§3.48), in an ordinary Morlock Siege game: the campaign
 * definition does not exist yet, so each card is staged where the campaign would have it. A player side scheme is put
 * into play the way a campaign instruction does it, from a card nobody owns (`putIntoPlay` on an encounter-side card,
 * so no player controls it, §4.1 Q24); an environment by flipping that scheme; Pouches and Safehouse are copies in the
 * campaign's set-aside pool (`encounterSetAside`); a minion, side scheme or treachery is stacked on the encounter deck.
 * Spider-Man (Core Justice) is the hero unless a test needs the ally or upgrade cards of Cable's or Domino's deck.
 */
const SCHEMES = [
  ["40190a", "40190b", "Assemble the Team", "Team Assembled", "assembly", "40190a.assemble-the-team-constant"],
  [
    "40191a",
    "40191b",
    "Establish Safehouse",
    "Safehouse Established",
    "safehouse",
    "40191a.establish-safehouse-constant",
  ],
  ["40192a", "40192b", "Gear Up", "Geared Up", "pouch", "40192a.gear-up-constant"],
  ["40193a", "40193b", "Mission Prep", "Mission Prepped", "prep", "40193a.mission-prep-constant"],
  ["40194a", "40194b", "Practice Maneuvers", "Practiced Maneuvers", null, "40194a.practice-maneuvers-constant"],
  ["40195a", "40195b", "Prepare Defenses", "Prepared Defenses", null, "40195a.prepare-defenses-constant"],
] as const;
const REFS = [
  "40190a.assemble-the-team-constant",
  "40190a.when-defeated",
  "40190b.team-assembled-constant",
  "40190b.team-assembled-action",
  "40191a.establish-safehouse-constant",
  "40191a.when-defeated",
  "40191b.safehouse-established-constant",
  "40191b.safehouse-established-action",
  "40192a.gear-up-constant",
  "40192a.when-defeated",
  "40192b.geared-up-constant",
  "40192b.geared-up-action",
  "40193a.mission-prep-constant",
  "40193a.when-defeated",
  "40193b.mission-prepped-constant",
  "40193b.mission-prepped-action",
  "40194a.practice-maneuvers-constant",
  "40194a.when-defeated",
  "40194b.practiced-maneuvers-constant",
  "40195a.prepare-defenses-constant",
  "40195a.when-defeated",
  "40195b.prepared-defenses-constant",
  "40197.safehouse-action",
  "40197.safehouse-constant",
  "40198.when-revealed",
  "40198.boost",
  "40199.when-defeated",
  "40199.malice-constant",
  "40200.when-revealed",
  "40201.when-revealed",
  "40201.boost",
  "40202.boost",
  "40203.when-revealed",
  "40203.boost",
];

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CABLE = { starterDeckId: "cable-leadership" } as const;
const DOMINO = { starterDeckId: "domino-justice" } as const;
type Seat = typeof SPIDER_MAN | typeof CABLE | typeof DOMINO;

const TAKE_OUT = "40054"; // a player side scheme (Domino's)
const TRAINING = "40059"; // another
const CARRIER = "40008"; // Cable's Professor: its Action is replaced by the campaign instruction below
const CARRIER_REF = "40008.professor-action";
const SAFEHOUSE = "40197";
const POUCHES = "40196";
const MALICE = "40199";

/**
 * The campaign's "put [the scheme] into play": the top card of the encounter deck, put into play under no one's control.
 * It is carried by an Action of a support in play, replaced here for the test only.
 */
const DEPS: EngineDeps = {
  abilities: {
    ...WAVE7_ABILITIES,
    [CARRIER_REF]: action(
      selectCards("staged", encounterCards(["deck"], undefined, 1)),
      putIntoPlay(chosen("staged"), you),
    ),
  },
};

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const handCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).hand);
const deckCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).deck);
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).discard);
const playCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).playArea);
const villainAreaCodes = (s: GameState): string[] => codes(s, s.villainArea);
const nameOf = (s: GameState, id: InstanceId): string => s.cardPool[s.instances[id]!.cardId]!.name;
const events = <T extends GameEvent["type"]>(log: readonly GameEvent[], type: T) =>
  log.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const only = (s: GameState, code: string): InstanceId => {
  const found = instancesOf(s, code);
  if (found.length !== 1) throw new Error(`expected one ${code}, found ${found.length}`);
  return found[0]!;
};
const refused = (s: GameState, command: Command): boolean => !applyCommand(s, command, DEPS).ok;

function newGame(players: readonly Seat[] = [SPIDER_MAN], seed = 1, scenario = "morlock-siege"): GameState {
  const config = wave7Scenario(scenario, { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
/** Every player in hero form, the first player's turn. */
function heroGame(players: readonly Seat[] = [SPIDER_MAN]): GameState {
  let s = newGame(players);
  for (const p of s.players) s = withForm(s, { heroForm: 0 }, p.playerId);
  return s;
}

/** A copy of `code` in `player`'s hand, replacing the card that was there (the discarded card is simply not in play). */
function inHand(state: GameState, code: string, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const id = playerOf(state, player).hand[0]!;
  return { state: patchInstance(state, id, { cardId: cardId(code) }), id };
}
/** The top card of the encounter deck is a copy of `code` (relabeled: the deck holds nothing of the campaign set). */
function stackEncounter(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const deckId = state.activeVillainId ? Object.keys(state.encounterDecks)[0]! : "";
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck[0]!;
  return { state: patchInstance(state, id, { cardId: cardId(code) }), id };
}
/** A campaign card in the campaign's set-aside pool: a copy of the card no one owns, outside every zone. */
function setAside(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck[pile.deck.length - 1]!;
  return {
    id,
    state: {
      ...patchInstance(state, id, { cardId: cardId(code) }),
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== id) } },
      encounterSetAside: [...state.encounterSetAside, id],
    },
  };
}

/** A support of Cable's in P1's play area, standing in for the campaign instruction that puts a scheme into play. */
function withCarrier(state: GameState): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, P1);
  const id = owner.deck[owner.deck.length - 1]!;
  const patched = patchInstance(state, id, {
    cardId: cardId(CARRIER),
    faceup: true,
    exhausted: false,
    controllerId: P1,
  });
  return {
    id,
    state: {
      ...patched,
      players: patched.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}

/** The campaign puts `code` (a player side scheme) into play: stacked on the encounter deck, put into play by the carrier. */
function putScheme(state: GameState, code: string): { state: GameState; id: InstanceId; log: readonly GameEvent[] } {
  const carrier = withCarrier(stackEncounter(state, code).state);
  const driven = driveEventsPicking(DEPS, carrier.state, firstLegal, use(P1, carrier.id, CARRIER_REF));
  const id = driven.state.villainArea.find((i) => codeOf(driven.state, i) === code)!;
  return { state: driven.state, id, log: driven.events };
}

const basicThwart = (player: PlayerId, thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const threatOn = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const countersOn = (s: GameState, id: InstanceId, type: string): number => inst(s, id).counters[type] ?? 0;

/** Answers prompts from a queue (an option id or label), else the first legal option. */
const answering = (...answers: readonly string[]): Picker => {
  const queue = [...answers];
  return (state) => {
    const options = state.pendingChoice?.options ?? [];
    const hit = options.find((o) => o.optionId === queue[0] || o.label === queue[0]);
    if (hit) {
      queue.shift();
      return [hit.optionId];
    }
    return firstLegal(state);
  };
};
/** Picks the card whose code is `code` at a card prompt, the label `label` at an option prompt, else the first option. */
const choosing =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    for (const w of wanted) {
      const hit = choice?.options.find(
        (o) =>
          o.label === w ||
          o.optionId === w ||
          (state.instances[o.optionId as InstanceId] && codeOf(state, o.optionId as InstanceId) === w),
      );
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };

describe("campaign card registry", () => {
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(NEXT_EVOL_CAMPAIGN_CARDS[id]!)).toEqual([]);
  });
  it("holds exactly the refs of 40190-40203", () => {
    expect(Object.keys(NEXT_EVOL_CAMPAIGN_CARDS).sort()).toEqual([...REFS].sort());
  });
});

describe.each(SCHEMES)(
  "%s %s: the player side scheme the campaign puts into play",
  (front, back, title, envTitle, counter, constantRef) => {
    it(`${constantRef} and its When Defeated are registered on the front`, () => {
      expect(NEXT_EVOL_CAMPAIGN_CARDS[constantRef]).toBeDefined();
      expect(NEXT_EVOL_CAMPAIGN_CARDS[`${front}.when-defeated`]).toBeDefined();
    });

    it("enters play with 4 threat per player, in the villain's area, under no one's control (1 player: 4)", () => {
      const { state, id } = putScheme(heroGame(), front);
      expect(nameOf(state, id)).toBe(title);
      expect(threatOn(state, id)).toBe(4);
      expect(inst(state, id).controllerId).toBeNull();
      expect(villainAreaCodes(state)).toContain(front);
    });

    it("enters play with 8 threat at two players", () => {
      const { state, id } = putScheme(heroGame([SPIDER_MAN, DOMINO]), front);
      expect(threatOn(state, id)).toBe(8);
    });

    it("is thwarted to 0 and flips: the environment is in play, with the front nowhere, and the scheme is not discarded", () => {
      const staged = putScheme(heroGame(), front);
      const hero = patchInstance(staged.state, staged.id, { threat: 1 });
      const driven = driveEventsPicking(DEPS, hero, firstLegal, basicThwart(P1, identityOf(hero), staged.id));
      const after = driven.state;
      expect(codeOf(after, staged.id)).toBe(back);
      expect(nameOf(after, staged.id)).toBe(envTitle);
      expect(villainAreaCodes(after)).toContain(back);
      expect(villainAreaCodes(after)).not.toContain(front);
      expect(instancesOf(after, front)).toEqual([]);
      expect(events(driven.events, "cardFlippedToOtherFace")).toMatchObject([
        { from: front, to: back, typeChanged: true },
      ]);
      expect(threatOn(after, staged.id)).toBe(0);
      if (counter) expect(countersOn(after, staged.id, counter)).toBe(1);
    });

    it("is not defeated by a thwart that leaves threat on it", () => {
      const staged = putScheme(heroGame(), front);
      const driven = driveEventsPicking(
        DEPS,
        staged.state,
        firstLegal,
        basicThwart(P1, identityOf(staged.state), staged.id),
      );
      expect(codeOf(driven.state, staged.id)).toBe(front);
      expect(threatOn(driven.state, staged.id)).toBe(3);
    });

    it("does not count against the player side scheme limit: a player's own scheme is played beside it, nothing is discarded", () => {
      const staged = putScheme(heroGame([DOMINO]), front);
      const given = inHand(staged.state, TAKE_OUT);
      const driven = driveEventsPicking(DEPS, given.state, firstLegal, play(P1, given.id, []));
      expect(driven.state.pendingChoice).toBeNull();
      expect(villainAreaCodes(driven.state)).toEqual(expect.arrayContaining([front, TAKE_OUT]));
      expect(discardCodes(driven.state)).not.toContain(TAKE_OUT);
      expect(codeOf(driven.state, staged.id)).toBe(front);
    });

    it("is never the scheme the limit discards: with a second player scheme played, the choice is between the player's own two", () => {
      const staged = putScheme(heroGame([DOMINO]), front);
      const first = inHand(staged.state, TAKE_OUT);
      const one = driveEventsPicking(DEPS, first.state, firstLegal, play(P1, first.id, [])).state;
      const second = inHand(one, TRAINING);
      const paid = moveToHand(second.state, P1, "40047", "40048").state;
      const prompts: string[][] = [];
      const spy: Picker = (s) => {
        if (s.pendingChoice)
          prompts.push(
            s.pendingChoice.options.map((o) =>
              s.instances[o.optionId as InstanceId] ? codeOf(s, o.optionId as InstanceId) : o.label,
            ),
          );
        return firstLegal(s);
      };
      const driven = driveEventsPicking(DEPS, paid, spy, play(P1, second.id, payWith(paid, P1, 1, [second.id])));
      expect(prompts.flat()).toEqual(expect.arrayContaining([TAKE_OUT, TRAINING]));
      expect(prompts.flat()).not.toContain(front);
      expect(discardCodes(driven.state)).toContain(TAKE_OUT);
      expect(playCodes(driven.state)).not.toContain(front);
      expect(villainAreaCodes(driven.state)).toContain(front);
      expect(codeOf(driven.state, staged.id)).toBe(front);
    });
  },
);

describe("a campaign scheme and a player's own scheme, either order", () => {
  it("a scheme already in play does not stop the campaign putting a campaign scheme into play: both stay", () => {
    const first = inHand(heroGame([DOMINO]), TAKE_OUT);
    const own = driveEventsPicking(DEPS, first.state, firstLegal, play(P1, first.id, [])).state;
    const staged = putScheme(own, "40190a");
    expect(villainAreaCodes(staged.state)).toEqual(expect.arrayContaining(["40190a", TAKE_OUT]));
    expect(discardCodes(staged.state)).toEqual([]);
    expect(threatOn(staged.state, staged.id)).toBe(4);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Fixtures for the environments
// ---------------------------------------------------------------------------------------------------------------

const FILLER = "01003"; // an event, which no environment search offers
/**
 * `player`'s deck is exactly `deckCodes` (top first) over filler events, their discard pile exactly `discardCodes`:
 * every card relabeled, so a search offers only what the test names.
 */
function stock(
  state: GameState,
  player: PlayerId,
  deckCodes: readonly string[],
  discardCodes: readonly string[] = [],
): GameState {
  const owner = playerOf(state, player);
  const ids = [...owner.deck, ...owner.discard];
  const wanted = [...deckCodes, ...discardCodes];
  let s = state;
  ids.forEach((id, i) => {
    s = patchInstance(s, id, { cardId: cardId(wanted[i] ?? FILLER) });
  });
  const need = wanted.length;
  const deckIds = [...ids.slice(0, deckCodes.length), ...ids.slice(need)];
  return {
    ...s,
    players: s.players.map((p) =>
      p.playerId === player ? { ...p, deck: deckIds, discard: ids.slice(deckCodes.length, need) } : p,
    ),
  };
}
/** A copy of `code` in `player`'s play area, ready and faceup (a card their deck does not hold). */
function inPlayAs(state: GameState, code: string, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, player);
  const id = owner.deck[owner.deck.length - 1]!;
  const patched = patchInstance(state, id, {
    cardId: cardId(code),
    faceup: true,
    exhausted: false,
    controllerId: player,
  });
  return {
    id,
    state: {
      ...patched,
      players: patched.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}
/** The scheme `front` put into play and thwarted to 0: its environment in play. */
function envGame(front: string, players: readonly Seat[] = [SPIDER_MAN]): { state: GameState; id: InstanceId } {
  const staged = putScheme(heroGame(players), front);
  const hero = patchInstance(staged.state, staged.id, { threat: 1 });
  const flipped = driveEventsPicking(DEPS, hero, firstLegal, basicThwart(P1, identityOf(hero), staged.id));
  return { state: flipped.state, id: staged.id };
}
/** Answers a card search: `wanted[player]` is the code to take, `null` to take nothing; records the codes offered. */
function searching(wanted: Readonly<Record<string, string | null>>, offered: string[][] = []): Picker {
  return (state) => {
    const choice = state.pendingChoice!;
    if (choice.prompt.kind !== "chooseCards") return firstLegal(state);
    offered.push(choice.options.map((o) => codeOf(state, o.optionId as InstanceId)).sort());
    const want = wanted[choice.playerId];
    if (want === null) return [];
    const hit = choice.options.find((o) => codeOf(state, o.optionId as InstanceId) === want);
    return hit ? [hit.optionId] : firstLegal(state);
  };
}

describe("Team Assembled (40190b): Action, remove 1 assembly counter -> each player may find an ally of cost 3 or less", () => {
  const ACTION = "40190b.team-assembled-action";
  const SPIDER_WOMAN = "01011"; // 3
  const BLACK_CAT = "01002"; // 2
  const WAR_MACHINE = "01030"; // 4
  const HELLCAT = "01020"; // 3

  it("one player: searches deck and discard pile (cost 3 and 2 offered, cost 4 not) and puts the ally into play", () => {
    const env = envGame("40190a");
    const stocked = stock(env.state, P1, [WAR_MACHINE, SPIDER_WOMAN], [BLACK_CAT]);
    const offered: string[][] = [];
    const driven = driveEventsPicking(DEPS, stocked, searching({ p1: SPIDER_WOMAN }, offered), use(P1, env.id, ACTION));
    expect(offered).toEqual([[BLACK_CAT, SPIDER_WOMAN]]);
    expect(playCodes(driven.state)).toContain(SPIDER_WOMAN);
    expect(deckCodes(driven.state)).not.toContain(SPIDER_WOMAN);
    expect(deckCodes(driven.state)).toContain(WAR_MACHINE);
    expect(discardCodes(driven.state)).toContain(BLACK_CAT);
    expect(countersOn(driven.state, env.id, "assembly")).toBe(0);
  });

  it("an ally from the discard pile is put into play as well", () => {
    const env = envGame("40190a");
    const stocked = stock(env.state, P1, [WAR_MACHINE], [BLACK_CAT]);
    const driven = driveEventsPicking(DEPS, stocked, searching({ p1: BLACK_CAT }), use(P1, env.id, ACTION));
    expect(playCodes(driven.state)).toContain(BLACK_CAT);
    expect(discardCodes(driven.state)).not.toContain(BLACK_CAT);
  });

  it("'may': a player takes nothing, and the counter is spent all the same", () => {
    const env = envGame("40190a");
    const stocked = stock(env.state, P1, [SPIDER_WOMAN]);
    const driven = driveEventsPicking(DEPS, stocked, searching({ p1: null }), use(P1, env.id, ACTION));
    expect(playCodes(driven.state)).not.toContain(SPIDER_WOMAN);
    expect(deckCodes(driven.state)).toContain(SPIDER_WOMAN);
    expect(countersOn(driven.state, env.id, "assembly")).toBe(0);
  });

  it("with no ally of cost 3 or less in the deck or discard pile nothing is put into play", () => {
    const env = envGame("40190a");
    const stocked = stock(env.state, P1, [WAR_MACHINE]);
    const before = playCodes(stocked);
    const driven = driveEventsPicking(DEPS, stocked, searching({ p1: WAR_MACHINE }), use(P1, env.id, ACTION));
    expect(playCodes(driven.state)).toEqual(before);
    expect(countersOn(driven.state, env.id, "assembly")).toBe(0);
  });

  it("two players: each searches their own deck, in player order, and one declines", () => {
    const env = envGame("40190a", [SPIDER_MAN, DOMINO]);
    const stocked = stock(stock(env.state, P1, [SPIDER_WOMAN]), P2, [HELLCAT]);
    const both = driveEventsPicking(
      DEPS,
      stocked,
      searching({ p1: SPIDER_WOMAN, p2: HELLCAT }),
      use(P1, env.id, ACTION),
    );
    expect(playCodes(both.state, P1)).toContain(SPIDER_WOMAN);
    expect(playCodes(both.state, P2)).toContain(HELLCAT);
    const one = driveEventsPicking(DEPS, stocked, searching({ p1: SPIDER_WOMAN, p2: null }), use(P1, env.id, ACTION));
    expect(playCodes(one.state, P1)).toContain(SPIDER_WOMAN);
    expect(playCodes(one.state, P2)).not.toContain(HELLCAT);
  });

  it("any player can do this: the second player uses it, and the one counter is spent once", () => {
    const env = envGame("40190a", [SPIDER_MAN, DOMINO]);
    const stocked = stock(stock(env.state, P1, [SPIDER_WOMAN]), P2, [HELLCAT]);
    const driven = driveEventsPicking(
      DEPS,
      stocked,
      searching({ p1: SPIDER_WOMAN, p2: HELLCAT }),
      endTurn(P1),
      use(P2, env.id, ACTION),
    );
    expect(playCodes(driven.state, P1)).toContain(SPIDER_WOMAN);
    expect(playCodes(driven.state, P2)).toContain(HELLCAT);
    expect(countersOn(driven.state, env.id, "assembly")).toBe(0);
    expect(refused(driven.state, use(P1, env.id, ACTION))).toBe(true);
  });
});

describe("Safehouse Established (40191b): Action, remove 1 safehouse counter -> the first player puts Safehouse into play", () => {
  const ACTION = "40191b.safehouse-established-action";
  const staged = (players: readonly Seat[] = [SPIDER_MAN]) => {
    const env = envGame("40191a", players);
    const aside = setAside(env.state, SAFEHOUSE);
    return { ...env, state: aside.state, safehouse: aside.id };
  };

  it("one player: Safehouse leaves the campaign pool and enters play under their control, as their card", () => {
    const { state, id, safehouse } = staged();
    expect(countersOn(state, id, "safehouse")).toBe(1);
    const driven = driveEventsPicking(DEPS, state, firstLegal, use(P1, id, ACTION));
    expect(playerOf(driven.state, P1).playArea).toContain(safehouse);
    expect(inst(driven.state, safehouse).controllerId).toBe(P1);
    expect(inst(driven.state, safehouse).ownerId).toBe(P1);
    expect(driven.state.encounterSetAside).not.toContain(safehouse);
    expect(countersOn(driven.state, id, "safehouse")).toBe(0);
    expect(refused(driven.state, use(P1, id, ACTION))).toBe(true);
  });

  it("two players: whoever uses it, the first player gets Safehouse, the other nothing", () => {
    const { state, id, safehouse } = staged([SPIDER_MAN, DOMINO]);
    const driven = driveEventsPicking(DEPS, state, firstLegal, endTurn(P1), use(P2, id, ACTION));
    expect(playerOf(driven.state, P1).playArea).toContain(safehouse);
    expect(inst(driven.state, safehouse).controllerId).toBe(P1);
    expect(playCodes(driven.state, P2)).not.toContain(SAFEHOUSE);
  });
});

describe("Geared Up (40192b): Action, remove 1 pouch counter -> each player shuffles 1 Pouches into their deck", () => {
  const ACTION = "40192b.geared-up-action";
  const staged = (players: readonly Seat[] = [SPIDER_MAN]) => {
    let { state, id } = envGame("40192a", players);
    for (let i = 0; i < 4; i++) state = setAside(state, POUCHES).state;
    return { state, id };
  };
  const pouchesIn = (s: GameState) => s.encounterSetAside.filter((i) => codeOf(s, i) === POUCHES).length;

  it("one player: 1 of the 4 copies is shuffled into their deck, and is theirs", () => {
    const { state, id } = staged();
    const driven = driveEventsPicking(DEPS, state, firstLegal, use(P1, id, ACTION));
    expect(pouchesIn(state)).toBe(4);
    expect(pouchesIn(driven.state)).toBe(3);
    expect(deckCodes(driven.state).filter((c) => c === POUCHES)).toHaveLength(1);
    expect(deckCodes(driven.state)).toHaveLength(deckCodes(state).length + 1);
    const pouches = playerOf(driven.state, P1).deck.find((i) => codeOf(driven.state, i) === POUCHES)!;
    expect(inst(driven.state, pouches).ownerId).toBe(P1);
    expect(countersOn(driven.state, id, "pouch")).toBe(0);
    expect(refused(driven.state, use(P1, id, ACTION))).toBe(true);
  });

  it("two players: each gets exactly one, and it is theirs", () => {
    const { state, id } = staged([SPIDER_MAN, DOMINO]);
    const driven = driveEventsPicking(DEPS, state, firstLegal, use(P1, id, ACTION));
    expect(pouchesIn(driven.state)).toBe(2);
    for (const p of [P1, P2]) {
      expect(deckCodes(driven.state, p).filter((c) => c === POUCHES)).toHaveLength(1);
      const own = playerOf(driven.state, p).deck.find((i) => codeOf(driven.state, i) === POUCHES)!;
      expect(inst(driven.state, own).ownerId).toBe(p);
    }
  });

  it("Pouches (40196) is data only: a resource producing two wild icons, with no ability", () => {
    const { state } = staged();
    const card = state.cardPool[cardId(POUCHES)]!;
    expect(card.type).toBe("resource");
    expect((card as { producesIcons?: unknown }).producesIcons).toEqual({ wild: 2 });
    expect((card as { abilities?: unknown }).abilities).toEqual([]);
  });
});

describe("Mission Prepped (40193b): Action, remove 1 prep counter -> each player puts an upgrade of cost 2 or less into play", () => {
  const ACTION = "40193b.mission-prepped-action";
  const VEST = "01081"; // 1
  const TENACITY = "01093"; // 2
  const ARMOR = "01036"; // 3

  /** The upgrade codes each search offered. */
  const run = (state: GameState, id: InstanceId, wanted: Readonly<Record<string, string | null>>, player = P1) => {
    const offered: string[][] = [];
    const driven = driveEventsPicking(
      DEPS,
      state,
      searching(wanted, offered),
      ...(player === P1 ? [] : [endTurn(P1)]),
      use(player, id, ACTION),
    );
    return { ...driven, offered };
  };

  it("one player: the deck and the discard pile are searched for cost 2 or less (3 is not offered), and it is attached", () => {
    const env = envGame("40193a");
    const stocked = stock(env.state, P1, [VEST, ARMOR], [TENACITY]);
    const driven = run(stocked, env.id, { p1: TENACITY });
    expect(driven.offered).toEqual([[VEST, TENACITY]]);
    const upgrade = only(driven.state, TENACITY);
    expect(inst(driven.state, upgrade).attachedTo).toBe(identityOf(driven.state));
    expect(inst(driven.state, identityOf(driven.state)).attachments).toContain(upgrade);
    expect(discardCodes(driven.state)).not.toContain(TENACITY);
    expect(deckCodes(driven.state)).toEqual(expect.arrayContaining([VEST, ARMOR]));
    expect(countersOn(driven.state, env.id, "prep")).toBe(0);
  });

  it("a deck and discard pile with only a cost 3 upgrade give none, and nothing else is put into play", () => {
    const env = envGame("40193a");
    const none = run(stock(env.state, P1, [ARMOR]), env.id, { p1: ARMOR });
    expect(none.offered).toEqual([]);
    expect(playCodes(none.state)).not.toContain(ARMOR);
    expect(countersOn(none.state, env.id, "prep")).toBe(0);
  });

  it("two players: each puts one of their own into play", () => {
    const env = envGame("40193a", [SPIDER_MAN, DOMINO]);
    const stocked = stock(stock(env.state, P1, [VEST]), P2, [], [TENACITY]);
    const driven = run(stocked, env.id, { p1: VEST, p2: TENACITY }, P2);
    expect(driven.offered).toEqual([[VEST], [TENACITY]]);
    expect(inst(driven.state, only(driven.state, VEST)).attachedTo).toBe(identityOf(driven.state, P1));
    expect(inst(driven.state, only(driven.state, TENACITY)).attachedTo).toBe(identityOf(driven.state, P2));
  });
});

describe("Practiced Maneuvers (40194b): events with a printed cost of 3 or more cost 1 less, for every player", () => {
  const costOf = (state: GameState, code: string, player: PlayerId = P1): number => {
    const given = inHand(state, code, player);
    return playCostOf(given.state, player, given.id, DEPS)!.current;
  };
  const WEB_KICK = "01005"; // 3
  const GAMMA_SLAM = "01021"; // 4
  const HAYMAKER = "01087"; // 2
  const TEAM_INVESTIGATION = "40053"; // 2 per hero

  it.each([
    [WEB_KICK, 3, 2],
    [GAMMA_SLAM, 4, 3],
    [HAYMAKER, 2, 2],
    ["01004", 1, 1],
    ["01003", 0, 0],
  ])("event %s costs %i before and %i with the environment", (code, before, after) => {
    expect(costOf(heroGame(), code)).toBe(before);
    expect(costOf(envGame("40194a").state, code)).toBe(after);
  });

  it("it applies to the second player as well, and not to an upgrade of cost 3", () => {
    const env = envGame("40194a", [SPIDER_MAN, DOMINO]).state;
    expect(costOf(env, WEB_KICK, P2)).toBe(2);
    expect(costOf(env, "01036")).toBe(3);
  });

  it("'printed cost': Team Investigation (2 per hero) is 2 in a solo game, not reduced, and 4 with two heroes, reduced to 3", () => {
    expect(costOf(heroGame([DOMINO]), TEAM_INVESTIGATION)).toBe(2);
    expect(costOf(envGame("40194a", [DOMINO]).state, TEAM_INVESTIGATION)).toBe(2);
    expect(costOf(heroGame([DOMINO, SPIDER_MAN]), TEAM_INVESTIGATION)).toBe(4);
    expect(costOf(envGame("40194a", [DOMINO, SPIDER_MAN]).state, TEAM_INVESTIGATION)).toBe(3);
  });

  it("the reduced cost is what is paid: a cost-3 event is played with 2 resources, and refused with 2 before", () => {
    const base = inHand(heroGame(), WEB_KICK);
    expect(refused(base.state, play(P1, base.id, payWith(base.state, P1, 2, [base.id])))).toBe(true);
    const env = inHand(envGame("40194a").state, WEB_KICK);
    expect(refused(env.state, play(P1, env.id, payWith(env.state, P1, 2, [env.id])))).toBe(false);
  });
});

describe("Prepared Defenses (40195b): each hero gets +1 DEF and gains retaliate 1", () => {
  const defOf = (s: GameState, p: PlayerId = P1): number => characterProfile(s, identityOf(s, p), DEPS)!.def;
  const retaliates = (s: GameState, p: PlayerId = P1): boolean => hasKeyword(s, identityOf(s, p), "retaliate", DEPS);

  it("a hero has +1 DEF and retaliate 1: DEF 1 -> 2 (Spider-Man) and no retaliate before", () => {
    const base = heroGame();
    const env = envGame("40195a").state;
    expect(defOf(base)).toBe(defOf(env) - 1);
    expect(defOf(env)).toBe(defOf(base) + 1);
    expect(retaliates(base)).toBe(false);
    expect(retaliates(env)).toBe(true);
  });

  it("an alter-ego is not a hero: neither bonus applies to it", () => {
    const env = envGame("40195a", [SPIDER_MAN, DOMINO]).state;
    const alter = withForm(env, "alterEgo", P2);
    const heroDef = defOf(env, P2);
    expect(defOf(alter, P2)).toBeLessThan(heroDef);
    expect(retaliates(alter, P2)).toBe(false);
    expect(retaliates(env, P2)).toBe(true);
  });

  it("retaliate 1 deals 1 damage to the villain when it attacks (1 player: 1), and 2 with two heroes", () => {
    const villainDamage = (s: GameState) => inst(s, s.activeVillainId!).damage;
    const attacked = (s: GameState) => round(heroed(s), { boosts: s.players.length });
    const baseOne = heroGame();
    expect(villainDamage(attacked(baseOne).state)).toBe(0);
    expect(villainDamage(attacked(envGame("40195a").state).state)).toBe(1);
    const two = envGame("40195a", [SPIDER_MAN, DOMINO]).state;
    expect(villainDamage(attacked(two).state)).toBe(2);
  });
});

describe("Safehouse (40197): Alter-Ego Action, any player may trigger it, once per round per player", () => {
  const ACTION = "40197.safehouse-action";
  const HEAL = "Heal 2 damage from your identity";
  const DRAW = "Draw 1 card";
  const damageOn = (s: GameState, p: PlayerId = P1): number => inst(s, identityOf(s, p)).damage;
  /** Safehouse in the first player's play area, every player in alter-ego form with `damage` on their identity. */
  function staged(players: readonly Seat[], damage = 3): { state: GameState; id: InstanceId } {
    let s = heroGame(players);
    for (const p of s.players) {
      s = withForm(s, "alterEgo", p.playerId);
      s = patchInstance(s, identityOf(s, p.playerId), { damage });
    }
    return inPlayAs(s, SAFEHOUSE, P1);
  }

  it("heal option: 2 damage from your identity (3 -> 1)", () => {
    const { state, id } = staged([SPIDER_MAN]);
    const driven = driveEventsPicking(DEPS, state, answering(HEAL), use(P1, id, ACTION));
    expect(damageOn(driven.state)).toBe(1);
    expect(handCodes(driven.state)).toEqual(handCodes(state));
  });

  it("heal option cannot heal below 0 (1 damage -> 0)", () => {
    const { state, id } = staged([SPIDER_MAN], 1);
    expect(damageOn(driveEventsPicking(DEPS, state, answering(HEAL), use(P1, id, ACTION)).state)).toBe(0);
  });

  it("draw option: 1 card, and the identity is not healed", () => {
    const { state, id } = staged([SPIDER_MAN]);
    const driven = driveEventsPicking(DEPS, state, answering(DRAW), use(P1, id, ACTION));
    expect(playerOf(driven.state, P1).hand).toHaveLength(playerOf(state, P1).hand.length + 1);
    expect(damageOn(driven.state)).toBe(3);
  });

  it("limit once per round per player: a second use by the same player is refused", () => {
    const { state, id } = staged([SPIDER_MAN]);
    const driven = driveEventsPicking(DEPS, state, answering(HEAL), use(P1, id, ACTION));
    expect(refused(driven.state, use(P1, id, ACTION))).toBe(true);
  });

  it("hero form: an Alter-Ego Action is not available", () => {
    const { state, id } = staged([SPIDER_MAN]);
    expect(refused(withForm(state, { heroForm: 0 }), use(P1, id, ACTION))).toBe(true);
  });

  it("any player may trigger it: the second player uses their turn's use on their own identity, and 'you' is them", () => {
    const { state, id } = staged([SPIDER_MAN, DOMINO]);
    const first = driveEventsPicking(DEPS, state, answering(HEAL), use(P1, id, ACTION));
    expect(damageOn(first.state, P1)).toBe(1);
    expect(damageOn(first.state, P2)).toBe(3);
    // P1's use does not spend P2's: the limit is per player.
    const second = driveEventsPicking(DEPS, first.state, answering(HEAL), endTurn(P1), use(P2, id, ACTION));
    expect(damageOn(second.state, P2)).toBe(1);
    expect(damageOn(second.state, P1)).toBe(1);
    expect(refused(second.state, use(P2, id, ACTION))).toBe(true);
  });

  it("40197.safehouse-constant is the same sentence, covered by the action's own options", () => {
    expect(NEXT_EVOL_CAMPAIGN_CARDS["40197.safehouse-constant"]).toEqual({
      trigger: { kind: "constant" },
      effects: [],
    });
    expect(NEXT_EVOL_CAMPAIGN_CARDS[ACTION]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The encounter set: minions, a side scheme and a treachery
// ---------------------------------------------------------------------------------------------------------------

const ADVANCE = "01186";

/** The last cards of the encounter deck become copies of `codes` (the deck holds none of this set), ready to be stacked. */
function withEncounterCards(state: GameState, ...codesWanted: readonly string[]): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  let s = state;
  codesWanted.forEach((code, i) => {
    s = patchInstance(s, pile.deck[pile.deck.length - 1 - i]!, { cardId: cardId(code) });
  });
  return s;
}
/** `player`'s hand is exactly these cards (relabeled), the rest of the hand goes to the deck. */
function handOf(state: GameState, codesWanted: readonly string[], player: PlayerId = P1): GameState {
  const owner = playerOf(state, player);
  const pool = [...owner.hand, ...owner.deck];
  const ids = codesWanted.map((_, i) => pool[i]!);
  let s = state;
  codesWanted.forEach((code, i) => {
    s = patchInstance(s, ids[i]!, { cardId: cardId(code) });
  });
  return {
    ...s,
    players: s.players.map((p) =>
      p.playerId === player ? { ...p, hand: ids, deck: pool.filter((i) => !ids.includes(i)) } : p,
    ),
  };
}
const alterEgoGame = (players: readonly Seat[] = [SPIDER_MAN]): GameState => newGame(players);
const damageOf = (s: GameState, p: PlayerId = P1): number => inst(s, identityOf(s, p)).damage;
const inPlayNames = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).playArea.map((i) => nameOf(s, i));
const labelsOf = (run: { prompts: readonly { kind: string; labels: readonly string[] }[] }): string[][] =>
  run.prompts.filter((p) => p.kind === "chooseOption").map((p) => [...p.labels]);

/**
 * Every player's hand is topped up to their hand size with resource cards, so the end of the player phase draws nothing:
 * what a card in a hand reads is exactly what the test set.
 */
function filledHands(state: GameState, pad = "01090"): GameState {
  let s = state;
  for (const p of state.players) {
    const owner = playerOf(s, p.playerId);
    const need = handSize(s, p.playerId, DEPS) - owner.hand.length;
    if (need <= 0) continue;
    const take = owner.deck.slice(0, need);
    for (const id of take) s = patchInstance(s, id, { cardId: cardId(pad) });
    s = {
      ...s,
      players: s.players.map((q) =>
        q.playerId === p.playerId ? { ...q, hand: [...q.hand, ...take], deck: q.deck.slice(need) } : q,
      ),
    };
  }
  return s;
}

/**
 * A villain phase for every player (each ends their turn), the encounter deck stacked: the villain's `boostCards`, then
 * the `reveals` dealt to the players in player order. The Morlock Siege deck holds none of the standard Advance, so
 * every stacked card is relabeled first.
 */
function stackedRound(
  state: GameState,
  opts: { boostCards: readonly string[]; reveals: readonly string[]; plan?: Plan; hero?: boolean; pad?: string },
) {
  const staged = withEncounterCards(state, ...opts.boostCards, ...opts.reveals);
  const formed = opts.hero ? heroed(staged) : staged;
  return round(filledHands(formed, opts.pad), {
    boostCards: opts.boostCards,
    reveals: opts.reveals,
    plan: opts.plan ?? {},
  });
}
/** One round in alter-ego form: `code` is dealt to `player`; the others get, and a surge reveals, Advance. */
function revealRound(state: GameState, code: string, opts: { plan?: Plan; player?: PlayerId; pad?: string } = {}) {
  const seat = state.players.findIndex((p) => p.playerId === (opts.player ?? P1));
  const dealt = state.players.map((_, i) => (i === seat ? code : ADVANCE));
  return stackedRound(state, {
    boostCards: state.players.map(() => ADVANCE),
    reveals: [...dealt, ADVANCE, ADVANCE],
    ...(opts.plan ? { plan: opts.plan } : {}),
    ...(opts.pad ? { pad: opts.pad } : {}),
  });
}
/** One round in hero form: `boostCard` is the first boost card of the villain's attack on the first player. */
function boostRound(state: GameState, boostCard: string, plan: Plan = {}, pad?: string) {
  return stackedRound(state, {
    boostCards: [boostCard, ...state.players.slice(1).map(() => ADVANCE)],
    reveals: state.players.map(() => ADVANCE),
    plan,
    hero: true,
    ...(pad ? { pad } : {}),
  });
}

describe("Lady Mastermind (40198): Surge. When Revealed: take damage equal to the highest printed cost of an event in your hand", () => {
  const HAND_WEB_KICK = ["01005", "01087", "01003", "01088", "01089"]; // 3, 2, 0
  it("takes 3 (the Swinging Web Kick, printed cost 3, over Haymaker 2 and Backflip 0)", () => {
    const run = revealRound(handOf(alterEgoGame(), HAND_WEB_KICK), "40198");
    expect(damageOf(run.state)).toBe(3);
  });
  it("takes 4 with an event of cost 4 and 2 with only a cost 2 event", () => {
    expect(damageOf(revealRound(handOf(alterEgoGame(), ["01021", "01087", "01088"]), "40198").state)).toBe(4);
    expect(damageOf(revealRound(handOf(alterEgoGame(), ["01087", "01088", "01089"]), "40198").state)).toBe(2);
  });
  it("takes 0 damage with no event in hand (resources and an ally only)", () => {
    const run = revealRound(handOf(alterEgoGame(), ["01088", "01089", "01002"]), "40198");
    expect(damageOf(run.state)).toBe(0);
  });
  it("is engaged with the player and surges: Advance is revealed after her", () => {
    const run = revealRound(handOf(alterEgoGame(), HAND_WEB_KICK), "40198");
    expect(inPlayNames(run.state)).toContain("Lady Mastermind");
    expect(events(run.events, "encounterCardRevealed").map((e) => nameOf(run.state, e.instanceId))).toEqual(
      expect.arrayContaining(["Lady Mastermind", "Advance"]),
    );
  });
  it("two players: only the revealing player's hand is read and only they take the damage", () => {
    const base = handOf(handOf(alterEgoGame([SPIDER_MAN, DOMINO]), ["01021", "01088"], P1), ["01005", "01088"], P2);
    const run = revealRound(base, "40198", { player: P2 });
    expect(damageOf(run.state, P2)).toBe(3);
    expect(damageOf(run.state, P1)).toBe(0);
    expect(inPlayNames(run.state, P2)).toContain("Lady Mastermind");
  });
  it("Boost: discard an event from your hand (the attacked player's), the player picking which", () => {
    const state = handOf(alterEgoGame(), ["01005", "01087", "01088"]);
    const run = boostRound(state, "40198", { pick: ["Haymaker"] });
    expect(discardCodes(run.state)).toEqual(["01087"]);
    expect(handCodes(run.state)).toContain("01005");
  });
  it("Boost with no event in hand discards nothing", () => {
    const run = boostRound(handOf(alterEgoGame(), ["01088", "01089"]), "40198");
    expect(discardCodes(run.state)).toEqual([]);
  });
  it("Boost, two players: only the attacked player's hand is touched", () => {
    const state = handOf(handOf(alterEgoGame([SPIDER_MAN, DOMINO]), ["01005", "01088"], P1), ["01087", "01088"], P2);
    const run = boostRound(state, "40198");
    expect(discardCodes(run.state, P1)).toEqual(["01005"]);
    expect(discardCodes(run.state, P2)).toEqual([]);
  });
});

/** `code` played from a hand of it and resources, paying `cost`, from the hero-form game (an upgrade onto `host`). */
function played(state: GameState, code: string, cost: number, host?: InstanceId): { state: GameState; id: InstanceId } {
  const given = handOf(state, [code, "01088", "01089", "01090"]);
  const id = playerOf(given, P1).hand[0]!;
  const driven = driveEventsPicking(
    DEPS,
    given,
    firstLegal,
    play(P1, id, payWith(given, P1, cost, [id]), host ? { attachToInstanceId: host } : {}),
  );
  return { state: driven.state, id };
}
const VEST = "01081"; // upgrade, 1
const TENACITY = "01093"; // upgrade, 2
const AUNT_MAY = "01006"; // support, 1
const HELICARRIER = "01092"; // support, 3
const MED_TEAM = "01080"; // support, 3

describe("Scrambler (40200): Surge. When Revealed: discard an upgrade you control", () => {
  /** P1 with Armored Vest and Tenacity attached to their identity, back in alter-ego form. */
  function upgraded(players: readonly Seat[] = [SPIDER_MAN], both = true): GameState {
    let s = heroGame(players);
    s = played(s, VEST, 1, identityOf(s)).state;
    if (both) s = played(s, TENACITY, 2, identityOf(s)).state;
    for (const p of s.players) s = withForm(s, "alterEgo", p.playerId);
    return s;
  }
  const upgradesOf = (s: GameState): string[] =>
    inst(s, identityOf(s))
      .attachments.map((a) => codeOf(s, a))
      .sort();

  it("with two upgrades the player picks: Tenacity is discarded, the Vest stays attached", () => {
    const state = upgraded();
    expect(upgradesOf(state)).toEqual([VEST, TENACITY]);
    const run = revealRound(state, "40200", { plan: { pick: ["Tenacity"] } });
    expect(upgradesOf(run.state)).toEqual([VEST]);
    expect(discardCodes(run.state)).toContain(TENACITY);
  });

  it("with one upgrade it is discarded", () => {
    const run = revealRound(upgraded([SPIDER_MAN], false), "40200");
    expect(upgradesOf(run.state)).toEqual([]);
    expect(discardCodes(run.state)).toContain(VEST);
  });

  it("with none nothing is discarded, and she is engaged and surges", () => {
    const state = heroGame();
    const run = revealRound(withForm(state, "alterEgo"), "40200");
    expect(discardCodes(run.state)).toEqual([]);
    expect(inPlayNames(run.state)).toContain("Scrambler");
    expect(events(run.events, "encounterCardRevealed").map((e) => nameOf(run.state, e.instanceId))).toContain(
      "Advance",
    );
  });

  it("two players: another player's upgrades are not 'an upgrade you control'", () => {
    const run = revealRound(upgraded([SPIDER_MAN, DOMINO]), "40200", { player: P2 });
    expect(upgradesOf(run.state)).toEqual([VEST, TENACITY]);
    expect(inPlayNames(run.state, P2)).toContain("Scrambler");
  });
});

describe("Vanisher (40201): Surge. When Revealed and Boost: return the support you control with the highest cost to your hand", () => {
  /** P1 with Aunt May (1) and Helicarrier (3) in play, in alter-ego form; `tie` adds Med Team (3). */
  function supported(players: readonly Seat[] = [SPIDER_MAN], tie = false): GameState {
    let s = heroGame(players);
    s = played(s, AUNT_MAY, 1).state;
    s = played(s, HELICARRIER, 3).state;
    if (tie) s = played(s, MED_TEAM, 3).state;
    for (const p of s.players) s = withForm(s, "alterEgo", p.playerId);
    return s;
  }

  it("When Revealed: the Helicarrier (3) goes to the hand, Aunt May (1) stays", () => {
    const run = revealRound(supported(), "40201");
    expect(handCodes(run.state)).toContain(HELICARRIER);
    expect(playCodes(run.state)).not.toContain(HELICARRIER);
    expect(playCodes(run.state)).toContain(AUNT_MAY);
    expect(inPlayNames(run.state)).toContain("Vanisher");
  });

  it("a tie for the highest cost is the player's choice", () => {
    const state = supported([SPIDER_MAN], true);
    const run = revealRound(state, "40201", { plan: { pick: ["Med Team"] } });
    expect(handCodes(run.state)).toContain(MED_TEAM);
    expect(playCodes(run.state)).toEqual(expect.arrayContaining([HELICARRIER, AUNT_MAY]));
    const other = revealRound(state, "40201", { plan: { pick: ["Helicarrier"] } });
    expect(handCodes(other.state)).toContain(HELICARRIER);
    expect(playCodes(other.state)).toContain(MED_TEAM);
  });

  it("with no support in play nothing is returned", () => {
    const run = revealRound(handOf(withForm(heroGame(), "alterEgo"), ["01088"]), "40201");
    expect(playCodes(run.state)).not.toContain(HELICARRIER);
    expect(handCodes(run.state).filter((c) => c === AUNT_MAY || c === HELICARRIER)).toEqual([]);
  });

  it("two players: only a support the revealing player controls, the first player's Aunt May is returned for P1 only", () => {
    let s = supported([SPIDER_MAN, DOMINO]);
    s = inPlayAs(s, MED_TEAM, P2).state;
    const run = revealRound(s, "40201", { player: P2 });
    expect(handCodes(run.state, P2)).toContain(MED_TEAM);
    expect(playCodes(run.state, P1)).toEqual(expect.arrayContaining([HELICARRIER, AUNT_MAY]));
  });

  it("Boost: the attacked player's highest cost support is returned", () => {
    const run = boostRound(supported(), "40201");
    expect(handCodes(run.state)).toContain(HELICARRIER);
    expect(playCodes(run.state)).not.toContain(HELICARRIER);
    expect(playCodes(run.state)).toContain(AUNT_MAY);
  });

  it("Boost with no support does nothing", () => {
    const run = boostRound(handOf(heroGame(), ["01088"]), "40201");
    expect(handCodes(run.state).filter((c) => c === AUNT_MAY || c === HELICARRIER)).toEqual([]);
  });
});

describe("Overburdened (40203): Surge. When Revealed and Boost: choose to discard 1 resource card from your hand or take 2 damage", () => {
  const DISCARD = "Discard 1 resource card from your hand";
  const DAMAGE = "Take 2 damage";
  const HAND = ["01088", "01005", "01087"]; // a resource and two events, topped up with resources

  it("When Revealed, discard option: a resource card goes to the discard pile, no damage", () => {
    const run = revealRound(handOf(alterEgoGame(), HAND), "40203", { plan: { choose: "Discard" } });

    expect(damageOf(run.state)).toBe(0);
    expect(discardCodes(run.state)).toHaveLength(1);
    expect(codes(run.state, playerOf(run.state, P1).discard)[0]).toMatch(/^010(88|90)$/);
    expect(labelsOf(run)[0]).toEqual([DISCARD, DAMAGE]);
  });

  it("When Revealed, damage option: 2 damage and the hand is untouched", () => {
    const state = handOf(alterEgoGame(), HAND);
    const run = revealRound(state, "40203", { plan: { choose: "Take" } });
    expect(damageOf(run.state)).toBe(2);
    expect(discardCodes(run.state)).toEqual([]);
  });

  it("with no resource card in hand the damage is forced: no choice to discard is offered", () => {
    const state = handOf(alterEgoGame(), ["01005", "01087"]);
    const run = revealRound(state, "40203", { pad: VEST, plan: { choose: "Discard" } });
    expect(damageOf(run.state)).toBe(2);
    expect(labelsOf(run).flat()).not.toContain(DISCARD);
    expect(discardCodes(run.state)).toEqual([]);
  });

  it("two players: the revealing player's own hand and choice", () => {
    const state = handOf(handOf(alterEgoGame([SPIDER_MAN, DOMINO]), ["01005"], P1), ["01088", "01005"], P2);
    const run = revealRound(state, "40203", { player: P2, plan: { choose: "Discard" } });
    expect(damageOf(run.state, P2)).toBe(0);
    expect(discardCodes(run.state, P2)).toHaveLength(1);
    expect(damageOf(run.state, P1)).toBe(0);
  });

  it("Boost: the attacked player chooses the same two options", () => {
    const state = handOf(heroGame(), HAND);
    const damage = boostRound(state, "40203", { choose: "Take" });
    expect(damageOf(damage.state)).toBeGreaterThanOrEqual(2);
    const discarded = boostRound(state, "40203", { choose: "Discard" });
    expect(discardCodes(discarded.state)).toHaveLength(1);
    expect(labelsOf(discarded)).toContainEqual([DISCARD, DAMAGE]);
    // The damage option is the only difference: the discarding player takes the villain's attack alone.
    expect(damageOf(damage.state) - damageOf(discarded.state)).toBe(2);
  });

  it("Boost with no resource in hand: the 2 damage is forced", () => {
    const state = handOf(heroGame(), ["01005", "01087"]);
    const run = boostRound(state, "40203", { choose: "Discard" }, VEST);
    expect(labelsOf(run).flat()).not.toContain(DISCARD);
    expect(discardCodes(run.state)).toEqual([]);
  });
});

describe("Under Pressure (40202): Surge. Boost: give the villain 1 additional boost card for this activation", () => {
  /** The boost cards turned faceup for `enemy`'s first activation, before its attack or scheme resolves. */
  const dealtTo = (run: { state: GameState; events: readonly GameEvent[] }, enemy: InstanceId): number => {
    const log = run.events;
    const resolved = log.findIndex(
      (e) => (e.type === "attackResolved" || e.type === "schemeResolved") && e.enemyInstanceId === enemy,
    );
    return events(log.slice(0, resolved < 0 ? log.length : resolved), "boostCardFlipped").filter(
      (e) => e.enemyInstanceId === enemy,
    ).length;
  };

  it("enters play as a side scheme with 6 threat, at one and at two players, and surges", () => {
    for (const players of [[SPIDER_MAN], [SPIDER_MAN, DOMINO]] as const) {
      const run = revealRound(alterEgoGame(players), "40202");
      const scheme = run.state.villainArea.find((i) => codeOf(run.state, i) === "40202")!;
      expect(threatOn(run.state, scheme)).toBe(6);
      expect(events(run.events, "encounterCardRevealed").map((e) => nameOf(run.state, e.instanceId))).toContain(
        "Advance",
      );
    }
  });

  it("Boost on the villain's attack: the villain is dealt 2 boost cards instead of 1", () => {
    const base = heroGame();
    const plain = boostRound(base, ADVANCE);
    const pressured = boostRound(base, "40202");
    const villain = base.activeVillainId!;
    expect(dealtTo(plain, villain)).toBe(1);
    expect(dealtTo(pressured, villain)).toBe(2);
  });

  it("Boost on the villain's scheme (an alter-ego player): 2 boost cards as well, and 2 extra threat from its own icons", () => {
    const base = alterEgoGame();
    const run = stackedRound(base, { boostCards: ["40202"], reveals: [ADVANCE, ADVANCE] });
    expect(dealtTo(run, base.activeVillainId!)).toBe(2);
    const plain = stackedRound(base, { boostCards: [ADVANCE], reveals: [ADVANCE, ADVANCE] });
    expect(dealtTo(plain, base.activeVillainId!)).toBe(1);
  });
});

describe("Malice (40199): Surge. When Defeated: attach to the highest cost non-PSIONIC ally, which becomes a POSSESSED minion", () => {
  const FANTOMEX = "40015"; // an ally of cost 4 with the PSIONIC trait
  const WAR_MACHINE = "01030"; // 4
  const HELLCAT = "01020"; // 3
  const LUKE_CAGE = "01076"; // 4

  /** `allies` in play (P1's, then P2's), Malice engaged with P1. */
  function table(allies: readonly (readonly [string, PlayerId])[]): {
    state: GameState;
    malice: InstanceId;
    ally: (code: string) => InstanceId;
  } {
    let s = heroGame([SPIDER_MAN, DOMINO]);
    for (const [code, player] of allies) s = inPlayAs(s, code, player).state;
    const staged = withEncounterCards(s, MALICE);
    const deckId = Object.keys(staged.encounterDecks)[0]!;
    const id = staged.encounterDecks[deckId]!.deck.find((i) => codeOf(staged, i) === MALICE)!;
    const engaged = {
      ...staged,
      encounterDecks: {
        ...staged.encounterDecks,
        [deckId]: {
          ...staged.encounterDecks[deckId]!,
          deck: staged.encounterDecks[deckId]!.deck.filter((i) => i !== id),
        },
      },
      players: staged.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
    };
    return {
      state: patchInstance(engaged, id, { faceup: true, engagedWith: P1 }),
      malice: id,
      ally: (code) => only(engaged, code),
    };
  }
  const defeat = (state: GameState, malice: InstanceId, pick: Picker = firstLegal): GameState => {
    const near = patchInstance(state, malice, { damage: 0 });
    return driveEventsPicking(DEPS, near, pick, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(near, P1),
      targetInstanceId: malice,
    }).state;
  };

  it("is the printed Malice: 1 ATK, 1 SCH, 1 hit point, MARAUDER, Surge (data)", () => {
    const card = table([]).state.cardPool[cardId(MALICE)] as unknown as {
      atk: number;
      sch: number;
      hp: number;
      keywords: { name: string }[];
    };
    expect([card.atk, card.sch, card.hp]).toEqual([1, 1, 1]);
    expect(card.keywords.map((k) => k.name)).toEqual(["surge"]);
  });

  it("attaches to the non-PSIONIC ally with the highest cost: War Machine (4) over Fantomex (4, PSIONIC) and Hellcat (3)", () => {
    const t = table([
      [FANTOMEX, P1],
      [HELLCAT, P1],
      [WAR_MACHINE, P1],
    ]);
    const after = defeat(t.state, t.malice);
    expect(inst(after, t.malice).attachedTo).toBe(t.ally(WAR_MACHINE));
    expect(inst(after, t.ally(WAR_MACHINE)).attachments).toContain(t.malice);
    // She keeps the 2 damage of the attack that defeated her (Spider-Man's ATK 2 against 1 hit point).
    expect(inst(after, t.malice).damage).toBe(2);
  });

  it("the host is a POSSESSED minion engaged with its controller; Malice stays in play and is not discarded", () => {
    const t = table([[WAR_MACHINE, P1]]);
    const after = defeat(t.state, t.malice);
    const host = inst(after, t.ally(WAR_MACHINE));
    expect(host.treatedAs?.kind).toBe("minion");
    expect(host.engagedWith).toBe(P1);
    expect(after.encounterDecks[Object.keys(after.encounterDecks)[0]!]!.discard).not.toContain(t.malice);
  });

  it("every player's allies are candidates, and the host engages ITS controller (P2's War Machine engages P2)", () => {
    const t = table([
      [HELLCAT, P1],
      [WAR_MACHINE, P2],
    ]);
    const after = defeat(t.state, t.malice);
    expect(inst(after, t.malice).attachedTo).toBe(t.ally(WAR_MACHINE));
    expect(inst(after, t.ally(WAR_MACHINE)).engagedWith).toBe(P2);
  });

  it("a tie for the highest cost is the first player's choice", () => {
    const t = table([
      [WAR_MACHINE, P1],
      [LUKE_CAGE, P2],
    ]);
    const second = defeat(t.state, t.malice, choosing(LUKE_CAGE));
    expect(inst(second, t.malice).attachedTo).toBe(t.ally(LUKE_CAGE));
    const first = defeat(t.state, t.malice, choosing(WAR_MACHINE));
    expect(inst(first, t.malice).attachedTo).toBe(t.ally(WAR_MACHINE));
  });

  it("with no non-PSIONIC ally she is simply defeated and discarded", () => {
    const t = table([[FANTOMEX, P1]]);
    const after = defeat(t.state, t.malice);
    expect(inst(after, t.malice).attachedTo).toBeNull();
    expect(after.players.flatMap((p) => p.playArea)).not.toContain(t.malice);
  });
});
