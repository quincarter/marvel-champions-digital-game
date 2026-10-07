import {
  activeVillain,
  applyCommand,
  characterProfile,
  createGame,
  type CardInstance,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withDamage, withForm } from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario, wave7StarterDeckSetup } from "../index.js";
import { X23_PACK_CARDS } from "./pack-cards.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The x23 pack's player side schemes (43018 Keep Them Busy, 43021 Specialized Training, 43039 Rally the Troops), the
 * four linked Specialists (43034-43037) and the basic resource reprints (43022-43024), docs/phase7-wave7.md §3.75,
 * on X-23's precon (`x-23-aggression`, which holds Keep Them Busy, Specialized Training, Energy, Genius and Strength)
 * against Stryfe through `wave7Scenario` with the real registry. The Specialists are set aside by the real setup.
 * X-23: THW 2, ATK 1, DEF 2, 10 hit points, hand size 5.
 */
const KEEP_THEM_BUSY = "43018.when-defeated";
const SPECIALIZED_TRAINING = "43021.when-defeated";
const RALLY = "43039.when-defeated";
const COMBAT_CONSTANT = "43034.combat-specialist-constant";
const COMBAT_RESPONSE = "43034.combat-specialist-response";
const DEFENSE_CONSTANT = "43035.defense-specialist-constant";
const DEFENSE_RESPONSE = "43035.defense-specialist-response";
const FRONT_LINE_CONSTANT = "43036.front-line-specialist-constant";
const FRONT_LINE_RESPONSE = "43036.front-line-specialist-response";
const SURVEILLANCE_CONSTANT = "43037.surveillance-specialist-constant";
const SURVEILLANCE_RESPONSE = "43037.surveillance-specialist-response";
const ALL_REFS = [
  KEEP_THEM_BUSY,
  SPECIALIZED_TRAINING,
  RALLY,
  COMBAT_CONSTANT,
  COMBAT_RESPONSE,
  DEFENSE_CONSTANT,
  DEFENSE_RESPONSE,
  FRONT_LINE_CONSTANT,
  FRONT_LINE_RESPONSE,
  SURVEILLANCE_CONSTANT,
  SURVEILLANCE_RESPONSE,
];

const X23 = { starterDeckId: "x-23-aggression" } as const;
/** Spider-Man's precon with and without a Specialized Training in it. */
const SPIDER_MAN_PRECON = wave7StarterDeckSetup("core-spider-man-justice");
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const SPIDER_MAN_TRAINING = {
  identityCardId: SPIDER_MAN_PRECON.identityCardId as string,
  deck: [...SPIDER_MAN_PRECON.deck.map((c) => c as string), "43021"],
  ...(SPIDER_MAN_PRECON.aspects ? { aspects: SPIDER_MAN_PRECON.aspects } : {}),
} as const;
const X23_PRECON = wave7StarterDeckSetup("x-23-aggression");
/** Captain Marvel's Leadership precon plus Rally the Troops (43039, Leadership), which is in no precon. */
const CAPTAIN_MARVEL_PRECON = wave7StarterDeckSetup("core-captain-marvel-leadership");
const CAPTAIN_MARVEL_RALLY = {
  identityCardId: CAPTAIN_MARVEL_PRECON.identityCardId as string,
  deck: [...CAPTAIN_MARVEL_PRECON.deck.map((c) => c as string), "43039"],
  ...(CAPTAIN_MARVEL_PRECON.aspects ? { aspects: CAPTAIN_MARVEL_PRECON.aspects } : {}),
} as const;
type Seat = typeof X23 | typeof SPIDER_MAN | typeof SPIDER_MAN_TRAINING | typeof CAPTAIN_MARVEL_RALLY;

const KEEP_THEM_BUSY_CARD = "43018";
const TRAINING = "43021";
const RALLY_CARD = "43039";
const ENERGY = "43022";
const GENIUS = "43023";
const STRENGTH = "43024";
const COMBAT = "43034";
const DEFENSE = "43035";
const FRONT_LINE = "43036";
const SURVEILLANCE = "43037";
const SPECIALISTS = [COMBAT, DEFENSE, FRONT_LINE, SURVEILLANCE];
const HONEY_BADGER = "43003"; // ally, 3 hit points
const HYDRA_MERCENARY = "01101"; // ATK 1, 3 hit points
const NO_ICONS = "01186"; // Advance, 0 boost icons
const CAPTIVE_HOPE_CARD = "40131"; // an encounter side scheme (3 threat per player)

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
function heroGame(players: readonly Seat[] = [X23], seed = 1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const s = settle(created.state, firstLegal, (x) => x.step.phase === "player", WAVE7_DEPS);
  return withForm(s, { heroForm: 0 }, P1);
}
const handOf = (s: GameState, p: PlayerId = P1) => playerOf(s, p).hand;
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const profileOf = (s: GameState, id: InstanceId = identityOf(s)) => characterProfile(s, id, WAVE7_DEPS)!;
const threatOf = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const stryfe = (s: GameState): InstanceId => activeVillain(s).instanceId;
const rejected = (state: GameState, command: Command): boolean => !applyCommand(state, command, WAVE7_DEPS).ok;
const setAsideCodes = (s: GameState): string[] => s.encounterSetAside.map((id) => codeOf(s, id));
const mainThreat = (s: GameState): number => inst(s, s.mainScheme.instanceId).threat;

const basicThwart = (scheme: InstanceId, p: PlayerId = P1, s?: GameState): Command => ({
  type: "basicThwart",
  playerId: p,
  thwarterInstanceId: identityOf(s ?? current, p),
  schemeInstanceId: scheme,
});
let current: GameState;
const thwart = (s: GameState, scheme: InstanceId, pick: Picker = firstLegal, p: PlayerId = P1) => {
  current = s;
  return driveEventsPicking(WAVE7_DEPS, s, pick, basicThwart(scheme, p, s));
};
const basicAttack = (s: GameState, target: InstanceId, p: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: p,
  attackerInstanceId: identityOf(s, p),
  targetInstanceId: target,
});

/** Picks `ids` when a prompt offers them, otherwise the first option. */
const choosing =
  (...ids: readonly string[]): Picker =>
  (state) => {
    const offered = state.pendingChoice?.options.map((o) => o.optionId) ?? [];
    const hit = ids.find((id) => offered.includes(id));
    return hit ? [hit] : firstLegal(state);
  };
/** Accepts every optional response whose id contains one of `wanted`; other prompts take the first option. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers")
      return choice.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
    return firstLegal(state);
  };

/** Plays `code` from hand for `cost`, paying with other hand cards. */
function put(
  state: GameState,
  code: string,
  cost: number,
  opts: { player?: PlayerId; pick?: Picker; pay?: readonly InstanceId[] } = {},
): { state: GameState; id: InstanceId; events: readonly GameEvent[] } {
  const player = opts.player ?? P1;
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const driven = driveEventsPicking(
    WAVE7_DEPS,
    given.state,
    opts.pick ?? firstLegal,
    play(player, id, opts.pay ?? payWith(given.state, player, cost, [id])),
  );
  return { state: driven.state, id, events: driven.events };
}
/** No side scheme in play (Stryfe's setup leaves a permanent crisis one), the main scheme at `threat`. */
const cleared = (s: GameState, threat = 20): GameState =>
  patchInstance({ ...s, villainArea: [] }, s.mainScheme.instanceId, { threat });
/** `code` played into a cleared table, then its threat set to `threat`. */
function schemeInPlay(state: GameState, code: string, cost: number, threat?: number, mainThreatAt = 20) {
  const put_ = put(cleared(state, mainThreatAt), code, cost);
  return {
    state: threat === undefined ? put_.state : patchInstance(put_.state, put_.id, { threat }),
    id: put_.id,
  };
}
/** The set-aside copy of `code` (the first), by instance id. */
const setAside = (s: GameState, code: string): InstanceId => s.encounterSetAside.find((id) => codeOf(s, id) === code)!;
/** The Specialists a player controls. */
const specialistsOf = (s: GameState, p: PlayerId = P1): string[] =>
  Object.values(s.instances)
    .filter((i) => i.controllerId === p && SPECIALISTS.includes(i.cardId as string))
    .map((i) => i.cardId as string);
/** Specialized Training defeated by P1's basic thwart; each prompt takes the next `wanted` code (else the first offered). */
function trainingDefeated(state: GameState, ...wanted: readonly string[]) {
  const { state: staged, id } = schemeInPlay(state, TRAINING, 1, 1);
  const queue = [...wanted];
  const offered: string[][] = [];
  const spy: Picker = (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind !== "chooseCards") return firstLegal(s);
    offered.push(choice.options.map((o) => `${choice.playerId}:${o.label}`));
    const code = queue.shift();
    const hit = code && choice.options.find((o) => codeOf(s, o.optionId as InstanceId) === code);
    return hit ? [hit.optionId] : firstLegal(s);
  };
  const { state: after, events } = thwart(staged, id, spy);
  return { state: after, scheme: id, events, offered };
}
/** A player's Specialist taken by Training, with P1 holding `code`. */
const withSpecialist = (code: string, players: readonly Seat[] = [X23]) => {
  const taken = trainingDefeated(heroGame(players), code).state;
  return patchInstance(taken, identityOf(taken), { exhausted: false }); // the thwart that defeated Training exhausted her
};
const specialistOf = (s: GameState, code: string): InstanceId =>
  Object.values(s.instances).find((i) => i.cardId === cardId(code) && i.ownerId === P1)!.instanceId;

/** It is `player`'s turn (the others have not taken theirs). */
const turnOf = (s: GameState, player: PlayerId): GameState => ({
  ...s,
  step: { phase: "player", kind: "turn", activePlayerId: player, remainingPlayerIds: [] } as GameState["step"],
});
/** A minion engaged with `player`. */
function withMinion(state: GameState, code: string, player: PlayerId = P1) {
  const id = `i9${300 + Object.keys(state.instances).length}` as InstanceId;
  const instance = {
    instanceId: id,
    cardId: cardId(code),
    ownerId: null,
    controllerId: null,
    home: { kind: "playArea", playerId: player },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: player,
    flipped: false,
  } as unknown as CardInstance;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: instance },
    },
  };
}
/** An ally of `player`'s in play by surgery. */
function allyInPlay(state: GameState, code: string, player: PlayerId = P1) {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const s = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === player ? { ...p, hand: p.hand.filter((x) => x !== id), playArea: [...p.playArea, id] } : p,
    ),
  };
  return { state: patchInstance(s, id, { home: { kind: "player" }, controllerId: player, faceup: true }), id };
}
/** The hand cut to exactly `n` cards (the rest go to the bottom of the deck). */
function handOfSize(state: GameState, n: number, player: PlayerId = P1): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand: p.hand.slice(0, n), deck: [...p.deck, ...p.hand.slice(n)] } : p,
    ),
  };
}
/** The villain phase from this state with Stryfe stunned and a 0-icon card on the encounter deck. */
function villainPhase(state: GameState, pick: Picker) {
  const calm = patchInstance(state, state.mainScheme.instanceId, { threat: 1 });
  const quiet = patchInstance(stackEncounterDeck(calm, NO_ICONS), stryfe(state), {
    statuses: { ...inst(state, stryfe(state)).statuses, stunned: 1 },
  });
  const offered = new Set<string>();
  const spy: Picker = (s) => {
    if (s.pendingChoice?.prompt.kind === "chooseTriggers")
      for (const o of s.pendingChoice.options) offered.add(o.optionId);
    return pick(s);
  };
  const result = driveEventsPicking(WAVE7_DEPS, quiet, spy, ...quiet.players.map((pl) => endTurn(pl.playerId)));
  return { ...result, offered };
}
const defending =
  (defender: InstanceId | null, then: Picker): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "declareDefender") {
      const hit = defender && choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === defender);
      return hit ? [hit.optionId] : ["decline"];
    }
    return then(state);
  };
/** Every response id offered while `commands` run, the first option answering any other prompt. */
function offersDuring(state: GameState, ...commands: Command[]): Set<string> {
  const offered = new Set<string>();
  driveEventsPicking(
    WAVE7_DEPS,
    state,
    (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseTriggers")
        for (const o of s.pendingChoice.options) offered.add(o.optionId);
      return firstLegal(s);
    },
    ...commands,
  );
  return offered;
}
const offeredAny = (offered: Set<string>, ref: string): boolean => [...offered].some((o) => o.includes(ref));

describe("x23 pack cards registry", () => {
  it.each(ALL_REFS)("%s validates", (id) => {
    expect(validateDefinition(X23_PACK_CARDS[id]!)).toEqual([]);
  });
  it("holds exactly the printed refs: Energy, Genius and Strength (43022-43024) print none", () => {
    expect(Object.keys(X23_PACK_CARDS).sort()).toEqual([...ALL_REFS].sort());
  });
});

describe("Keep Them Busy (43018): a player side scheme with Assault", () => {
  it("costs 1 and enters the villain area with 3 threat per player (3 at one player, 6 at two)", () => {
    const one = put(cleared(heroGame()), KEEP_THEM_BUSY_CARD, 1);
    expect(one.state.villainArea).toContain(one.id);
    expect(threatOf(one.state, one.id)).toBe(3);
    expect(handOf(one.state)).not.toContain(one.id);
    const two = put(cleared(heroGame([X23, SPIDER_MAN])), KEEP_THEM_BUSY_CARD, 1);
    expect(threatOf(two.state, two.id)).toBe(6);
  });
  it("cannot be played for 0", () => {
    const s = cleared(heroGame());
    const given = moveToHand(s, P1, KEEP_THEM_BUSY_CARD);
    expect(rejected(given.state, play(P1, given.ids[0]!, []))).toBe(true);
  });
  it("Assault: a basic thwart uses ATK (1), not THW (2): 3 threat becomes 2", () => {
    const { state, id } = schemeInPlay(heroGame(), KEEP_THEM_BUSY_CARD, 1);
    expect(threatOf(thwart(state, id).state, id)).toBe(2);
  });
  it("the limit is one player side scheme: playing Specialized Training discards it, not defeated", () => {
    const first = schemeInPlay(heroGame(), KEEP_THEM_BUSY_CARD, 1);
    const next = put(first.state, TRAINING, 1, { pick: choosing(first.id) });
    expect(next.state.villainArea).not.toContain(first.id);
    expect(next.state.villainArea).toContain(next.id);
    expect(discardCodes(next.state)).toContain(KEEP_THEM_BUSY_CARD);
    expect(next.state.victoryDisplay).toEqual([]);
    expect(mainThreat(next.state)).toBe(20);
  });
  it("thwarted to 0 it is defeated: Victory 0 puts it in the victory display, and 5 threat leaves the main scheme", () => {
    const { state: staged, id } = schemeInPlay(heroGame(), KEEP_THEM_BUSY_CARD, 1, 1);
    const { state } = thwart(staged, id);
    expect(state.victoryDisplay).toContain(id);
    expect(state.villainArea).not.toContain(id);
    expect(mainThreat(state)).toBe(15);
  });
  it("a scheme left with threat does not remove any from the main scheme", () => {
    const { state: staged, id } = schemeInPlay(heroGame(), KEEP_THEM_BUSY_CARD, 1, 3);
    const { state } = thwart(staged, id);
    expect(threatOf(state, id)).toBe(2);
    expect(mainThreat(state)).toBe(20);
  });
  it("two players: 5 per hero is 10 threat, removed by the player who defeated it (Spider-Man's thwart)", () => {
    const base = heroGame([X23, SPIDER_MAN]);
    const both = withForm(base, { heroForm: 0 }, P2);
    const { state: staged, id } = schemeInPlay(both, KEEP_THEM_BUSY_CARD, 1, 1);
    const { state, events } = thwart(turnOf(staged, P2), id, firstLegal, P2);
    expect(state.victoryDisplay).toContain(id);
    expect(mainThreat(state)).toBe(10);
    const removed = events.filter(
      (e) => e.type === "threatRemoved" && e.schemeInstanceId === state.mainScheme.instanceId,
    );
    expect(removed).toEqual([expect.objectContaining({ amount: 10 })]);
  });
  it("the main scheme's own crisis side scheme blocks the removal: with Stryfe's permanent one in play nothing is removed", () => {
    const base = patchInstance(heroGame(), heroGame().mainScheme.instanceId, { threat: 20 });
    const put_ = put(base, KEEP_THEM_BUSY_CARD, 1);
    const staged = patchInstance(put_.state, put_.id, { threat: 1 });
    const { state } = thwart(staged, put_.id);
    expect(state.victoryDisplay).toContain(put_.id);
    expect(mainThreat(state)).toBe(20);
  });
});

describe("Specialized Training (43021): a player side scheme that sets out the linked Specialists", () => {
  it("costs 1 and enters with 5 threat per player (5 at one player, 10 at two)", () => {
    const one = put(cleared(heroGame()), TRAINING, 1);
    expect(one.state.villainArea).toContain(one.id);
    expect(threatOf(one.state, one.id)).toBe(5);
    const two = put(cleared(heroGame([X23, SPIDER_MAN_TRAINING])), TRAINING, 1);
    expect(threatOf(two.state, two.id)).toBe(10);
  });
  it("at setup the four Specialists are set aside with no owner, one set for a deck holding Training", () => {
    const s = heroGame();
    expect(setAsideCodes(s)).toEqual(SPECIALISTS);
    expect(s.encounterSetAside.every((id) => s.instances[id]!.ownerId === null)).toBe(true);
    expect(
      Object.values(s.instances).filter((i) => SPECIALISTS.includes(i.cardId as string) && i.ownerId !== null),
    ).toEqual([]);
  });
  it("two decks holding it: two sets, in one shared pool", () => {
    const s = heroGame([X23, SPIDER_MAN_TRAINING]);
    expect(setAsideCodes(s)).toEqual([...SPECIALISTS, ...SPECIALISTS]);
  });
  it("one deck with Training and one without: one set", () => {
    expect(setAsideCodes(heroGame([X23, SPIDER_MAN]))).toEqual(SPECIALISTS);
  });
  it("a deck without Training sets none aside", () => {
    expect(setAsideCodes(heroGame([SPIDER_MAN]))).toEqual([]);
  });
  it("a Specialist is refused in a deck", () => {
    const created = createGame(
      wave7Scenario("stryfe", {
        players: [
          {
            ...X23_PRECON,
            identityCardId: X23_PRECON.identityCardId as string,
            deck: [...X23_PRECON.deck.map((c) => c as string), COMBAT],
          },
        ],
        seed: 1,
        difficulty: "standard",
        modularSetIds: [],
      }),
      WAVE7_DEPS,
    );
    expect(created.ok).toBe(false);
  });
  it("thwarted to 0: Victory 0 sends it to the victory display", () => {
    const { state, scheme } = trainingDefeated(heroGame());
    expect(state.victoryDisplay).toContain(scheme);
    expect(state.villainArea).not.toContain(scheme);
  });
  it("When Defeated: the player chooses one of the four set-aside Specialists, takes control and ownership", () => {
    const { state, offered } = trainingDefeated(heroGame(), DEFENSE);
    expect(offered).toEqual([
      ["p1:Combat Specialist", "p1:Defense Specialist", "p1:Front Line Specialist", "p1:Surveillance Specialist"],
    ]);
    expect(specialistsOf(state)).toEqual([DEFENSE]);
    const taken = specialistOf(state, DEFENSE);
    expect(inst(state, taken)).toMatchObject({ controllerId: P1, ownerId: P1, faceup: true });
    expect(setAsideCodes(state)).toEqual([COMBAT, FRONT_LINE, SURVEILLANCE]);
  });
  it("the taken Specialist is the taker's card: owned by them, so it is discarded to their discard pile", () => {
    const state = withSpecialist(COMBAT);
    const id = specialistOf(state, COMBAT);
    expect(inst(state, id).ownerId).toBe(P1);
    expect(inst(state, id).home).toEqual({ kind: "player" });
  });
  it("an upgrade put into play is attached to the host a play would give it: her identity", () => {
    const state = withSpecialist(COMBAT);
    expect(inst(state, specialistOf(state, COMBAT)).attachedTo).toBe(identityOf(state));
  });
  it("two players, both decks with Training: each chooses one, in player order, and each is theirs", () => {
    const base = heroGame([X23, SPIDER_MAN_TRAINING]);
    const { state, offered } = trainingDefeated(base, COMBAT, DEFENSE);
    expect(offered).toHaveLength(2);
    expect(offered[0]![0]).toBe("p1:Combat Specialist");
    expect(offered[1]![0]!.startsWith("p2:")).toBe(true);
    expect(specialistsOf(state, P1)).toEqual([COMBAT]);
    expect(specialistsOf(state, P2)).toEqual([DEFENSE]);
    expect(setAsideCodes(state)).toHaveLength(6);
  });
  it("one deck with Training, one without: both players still take one of the four", () => {
    const { state, offered } = trainingDefeated(heroGame([X23, SPIDER_MAN]), COMBAT, SURVEILLANCE);
    expect(offered).toHaveLength(2);
    expect(specialistsOf(state, P1)).toEqual([COMBAT]);
    expect(specialistsOf(state, P2)).toEqual([SURVEILLANCE]);
    expect(setAsideCodes(state)).toEqual([DEFENSE, FRONT_LINE]);
  });
  it("a player who already controls a Specialist is skipped: only the other player chooses", () => {
    const { state: staged, id } = schemeInPlay(heroGame([X23, SPIDER_MAN]), TRAINING, 1, 1);
    const combat = setAside(staged, COMBAT);
    const given = patchInstance(
      { ...staged, encounterSetAside: staged.encounterSetAside.filter((i) => i !== combat) },
      combat,
      { ownerId: P1, controllerId: P1, home: { kind: "player" }, faceup: true },
    );
    const inPlayOfP1 = {
      ...given,
      players: given.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, combat] } : p)),
    };
    const offered: string[] = [];
    const { state } = thwart(inPlayOfP1, id, (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseCards") offered.push(s.pendingChoice.playerId);
      return firstLegal(s);
    });
    expect(offered).toEqual([P2]);
    expect(specialistsOf(state, P2)).toHaveLength(1);
  });
  it("a title already in play is not offered to the next player (two sets, unique Specialists)", () => {
    const { offered } = trainingDefeated(heroGame([X23, SPIDER_MAN_TRAINING]), COMBAT, DEFENSE);
    expect(offered[1]).not.toContain("p2:Combat Specialist");
  });
  it("a player with no Specialist left to choose gets nothing", () => {
    const base = heroGame([X23, SPIDER_MAN]);
    const { state: staged, id } = schemeInPlay(base, TRAINING, 1, 1);
    const emptied = { ...staged, encounterSetAside: staged.encounterSetAside.slice(2) };
    const { state } = thwart(emptied, id);
    expect(specialistsOf(state, P1)).toHaveLength(1);
    expect(specialistsOf(state, P2)).toHaveLength(1);
    expect(state.encounterSetAside).toHaveLength(0);
  });
});

describe("Rally the Troops (43039): a player side scheme that heals every ally", () => {
  const HAWKEYE = "01066"; // 3 hit points
  const VISION = "01068"; // 3 hit points
  const MARIA_HILL = "01067"; // 2 hit points
  const rally = (players: readonly Seat[] = [CAPTAIN_MARVEL_RALLY], threat?: number) =>
    schemeInPlay(heroGame(players), RALLY_CARD, 0, threat);
  it("costs 0 and enters with 3 threat per player (3 at one player, 6 at two)", () => {
    const one = rally();
    expect(one.state.villainArea).toContain(one.id);
    expect(threatOf(one.state, one.id)).toBe(3);
    const two = put(cleared(heroGame([CAPTAIN_MARVEL_RALLY, SPIDER_MAN])), RALLY_CARD, 0);
    expect(threatOf(two.state, two.id)).toBe(6);
  });
  it("thwarted to 0 it is defeated: Victory 0 puts it in the victory display", () => {
    const { state: staged, id } = rally([CAPTAIN_MARVEL_RALLY], 1);
    const { state } = thwart(staged, id);
    expect(state.victoryDisplay).toContain(id);
    expect(state.villainArea).not.toContain(id);
  });
  it("while it is not defeated nothing is healed", () => {
    const { state: staged, id } = rally([CAPTAIN_MARVEL_RALLY], 6);
    const ally = allyInPlay(staged, HAWKEYE);
    const { state } = thwart(withDamage(ally.state, ally.id, 2), id);
    expect(threatOf(state, id)).toBe(6 - profileOf(staged).thw);
    expect(inst(state, ally.id).damage).toBe(2);
  });
  it("When Defeated: heals 2 damage from each ally (damaged ones to 0, an undamaged one stays 0), not from heroes", () => {
    const { state: staged, id } = rally([CAPTAIN_MARVEL_RALLY], 1);
    const a = allyInPlay(withDamage(allyInPlay(staged, HAWKEYE).state, allyInPlay(staged, HAWKEYE).id, 0), VISION);
    const hawkeye = Object.values(a.state.instances).find((i) => i.cardId === cardId(HAWKEYE))!.instanceId;
    const hurt = withDamage(withDamage(a.state, hawkeye, 2), a.id, 1);
    const maria = allyInPlay(hurt, MARIA_HILL);
    const hero = withDamage(maria.state, identityOf(maria.state), 3);
    const { state } = thwart(hero, id);
    expect(inst(state, hawkeye).damage).toBe(0);
    expect(inst(state, a.id).damage).toBe(0);
    expect(inst(state, maria.id).damage).toBe(0);
    expect(inst(state, identityOf(state)).damage).toBe(3);
  });
  it("two players: every player's allies are healed, not just the one who defeated it", () => {
    const { state: staged, id } = rally([CAPTAIN_MARVEL_RALLY, X23], 1);
    const mine = allyInPlay(staged, HAWKEYE, P1);
    const theirs = allyInPlay(withDamage(mine.state, mine.id, 2), HONEY_BADGER, P2);
    const { state } = thwart(withDamage(theirs.state, theirs.id, 1), id);
    expect(inst(state, mine.id).damage).toBe(0);
    expect(inst(state, theirs.id).damage).toBe(0);
  });
});

describe("The Specialists (43034-43037): linked Specialization upgrades", () => {
  it.each([
    [COMBAT, "atk", 1, 2],
    [DEFENSE, "def", 2, 3],
    [SURVEILLANCE, "thw", 2, 3],
  ] as const)("%s taken: your hero gets +1 %s (X-23's %i becomes %i), and only that stat", (code, stat, from, to) => {
    const base = profileOf(heroGame());
    const taken = profileOf(withSpecialist(code));
    expect(base[stat]).toBe(from);
    expect(taken[stat]).toBe(to);
    expect({ ...taken, [stat]: base[stat] }).toEqual(base);
  });
  it("Combat Specialist is a hero bonus: in alter-ego form Laura Kinney's stats do not change", () => {
    const plain = withForm(heroGame(), "alterEgo");
    const taken = withForm(withSpecialist(COMBAT), "alterEgo");
    expect(specialistsOf(taken)).toEqual([COMBAT]);
    expect(profileOf(taken)).toEqual(profileOf(plain));
  });
  it("Front Line Specialist: +4 hit points on her identity (10 becomes 14)", () => {
    expect(profileOf(withSpecialist(FRONT_LINE)).maxHp).toBe(14);
  });
  it("Front Line Specialist: the erratum says identity, so the +4 holds in alter-ego form (RRG 1.8 p. 69)", () => {
    const plain = profileOf(withForm(heroGame(), "alterEgo"));
    const taken = profileOf(withForm(withSpecialist(FRONT_LINE), "alterEgo"));
    expect(taken.maxHp).toBe(plain.maxHp + 4);
  });
  it("two players: each Specialist raises only its own controller's hero", () => {
    const base = withForm(heroGame([X23, SPIDER_MAN_TRAINING]), { heroForm: 0 }, P2);
    const { state } = trainingDefeated(base, COMBAT, DEFENSE);
    expect(profileOf(state, identityOf(state, P1))).toEqual({ ...profileOf(base, identityOf(base, P1)), atk: 2 });
    const spider = profileOf(base, identityOf(base, P2));
    expect(profileOf(state, identityOf(state, P2))).toEqual({ ...spider, def: spider.def + 1 });
  });

  describe("Hero Responses draw 1 card, exhausting the Specialist", () => {
    const hydra = (state: GameState) => withMinion(state, HYDRA_MERCENARY);
    it("Combat Specialist: after her basic attack, offered; accepted: draws 1 and exhausts; she deals 2 (1 ATK plus 1)", () => {
      const taken = withSpecialist(COMBAT);
      const target = hydra(taken);
      const handBefore = handOf(taken).length;
      const { state, events } = driveEventsPicking(
        WAVE7_DEPS,
        target.state,
        accepting(COMBAT_RESPONSE),
        basicAttack(target.state, target.id),
      );
      expect(inst(state, target.id).damage).toBe(2);
      expect(handOf(state)).toHaveLength(handBefore + 1);
      expect(inst(state, specialistOf(state, COMBAT)).exhausted).toBe(true);
      expect(events.filter((e) => e.type === "cardDrawn")).toHaveLength(1);
    });
    it("Combat Specialist: optional, declined it draws nothing and stays ready", () => {
      const taken = withSpecialist(COMBAT);
      const target = hydra(taken);
      const handBefore = handOf(taken).length;
      const { state } = driveEventsPicking(WAVE7_DEPS, target.state, accepting(), basicAttack(target.state, target.id));
      expect(handOf(state)).toHaveLength(handBefore);
      expect(inst(state, specialistOf(state, COMBAT)).exhausted).toBe(false);
    });
    it("Combat Specialist: exhausted, it is not offered", () => {
      const taken = withSpecialist(COMBAT);
      const exhausted = patchInstance(taken, specialistOf(taken, COMBAT), { exhausted: true });
      const target = hydra(exhausted);
      const offered = offersDuring(target.state, basicAttack(target.state, target.id));
      expect(offeredAny(offered, COMBAT_RESPONSE)).toBe(false);
    });
    it("Combat Specialist: a basic thwart does not trigger it", () => {
      const taken = withSpecialist(COMBAT);
      const staged = encounterCardInVillainArea(taken, CAPTIVE_HOPE_CARD, 6);
      current = staged.state;
      const offered = offersDuring(staged.state, basicThwart(staged.id, P1, staged.state));
      expect(offeredAny(offered, COMBAT_RESPONSE)).toBe(false);
    });
    it("Surveillance Specialist: her basic thwart removes 3 (THW 2 plus 1) and offers the draw", () => {
      const taken = withSpecialist(SURVEILLANCE);
      const staged = encounterCardInVillainArea(taken, CAPTIVE_HOPE_CARD, 6);
      const handBefore = handOf(taken).length;
      const { state } = thwart(staged.state, staged.id, accepting(SURVEILLANCE_RESPONSE));
      expect(threatOf(state, staged.id)).toBe(3);
      expect(handOf(state)).toHaveLength(handBefore + 1);
      expect(inst(state, specialistOf(state, SURVEILLANCE)).exhausted).toBe(true);
    });
    it("Surveillance Specialist: a basic attack does not trigger it", () => {
      const taken = withSpecialist(SURVEILLANCE);
      const target = hydra(taken);
      const offered = offersDuring(target.state, basicAttack(target.state, target.id));
      expect(offeredAny(offered, SURVEILLANCE_RESPONSE)).toBe(false);
    });
    it("Defense Specialist: after her basic defense, offered; accepted: draws 1 and exhausts", () => {
      const taken = handOfSize(withSpecialist(DEFENSE), 5);
      const minion = hydra(taken);
      const { state, offered } = villainPhase(
        minion.state,
        defending(identityOf(minion.state), accepting(DEFENSE_RESPONSE)),
      );
      expect(offeredAny(offered, DEFENSE_RESPONSE)).toBe(true);
      expect(handOf(state)).toHaveLength(6);
      expect(inst(state, identityOf(state)).damage).toBe(0);
    });
    it("Defense Specialist: no defense, no offer", () => {
      const taken = handOfSize(withSpecialist(DEFENSE), 5);
      const minion = hydra(taken);
      const { offered } = villainPhase(minion.state, defending(null, accepting(DEFENSE_RESPONSE)));
      expect(offeredAny(offered, DEFENSE_RESPONSE)).toBe(false);
    });
    it("Front Line Specialist: after her identity takes damage from an enemy attack, offered; accepted: draws 1", () => {
      const taken = handOfSize(withSpecialist(FRONT_LINE), 5);
      const minion = hydra(taken);
      const { state, offered } = villainPhase(minion.state, defending(null, accepting(FRONT_LINE_RESPONSE)));
      expect(inst(state, identityOf(state)).damage).toBe(1);
      expect(offeredAny(offered, FRONT_LINE_RESPONSE)).toBe(true);
      expect(handOf(state)).toHaveLength(6);
    });
    it("Front Line Specialist: an attack she defends without taking damage does not offer it", () => {
      const taken = handOfSize(withSpecialist(FRONT_LINE), 5);
      const minion = hydra(taken);
      const { offered } = villainPhase(
        minion.state,
        defending(identityOf(minion.state), accepting(FRONT_LINE_RESPONSE)),
      );
      expect(offeredAny(offered, FRONT_LINE_RESPONSE)).toBe(false);
    });
  });

  describe("replaying one", () => {
    /** The taken Specialist sent to its owner's discard pile by surgery. */
    function discarded(code: string) {
      const taken = withSpecialist(code);
      const id = specialistOf(taken, code);
      const host = inst(taken, id).attachedTo;
      const s = {
        ...taken,
        players: taken.players.map((p) =>
          p.playerId === P1 ? { ...p, playArea: p.playArea.filter((x) => x !== id), discard: [...p.discard, id] } : p,
        ),
      };
      return patchInstance(
        host ? patchInstance(s, host, { attachments: inst(s, host).attachments.filter((x) => x !== id) }) : s,
        id,
        { attachedTo: null, controllerId: null, exhausted: false },
      );
    }
    it("costs 2 and goes back on her identity: refused for 1, played for 2", () => {
      const s = discarded(COMBAT);
      const given = moveToHand(s, P1, COMBAT);
      const id = given.ids[0]!;
      expect(rejected(given.state, play(P1, id, payWith(given.state, P1, 1, [id])))).toBe(true);
      const { state } = put(s, COMBAT, 2);
      expect(inst(state, id).attachedTo).toBe(identityOf(state));
      expect(profileOf(state).atk).toBe(2);
    });
    it("unique: a second copy of a title in play is not a choice for the next player, and stays set aside", () => {
      const base = heroGame([X23, SPIDER_MAN_TRAINING]);
      const { state, offered } = trainingDefeated(base, COMBAT, COMBAT);
      expect(offered[1]).toEqual([
        "p2:Defense Specialist",
        "p2:Front Line Specialist",
        "p2:Surveillance Specialist",
        "p2:Defense Specialist",
        "p2:Front Line Specialist",
        "p2:Surveillance Specialist",
      ]);
      expect(specialistsOf(state, P1)).toEqual([COMBAT]);
      expect(specialistsOf(state, P2)).toEqual([DEFENSE]);
      expect(setAsideCodes(state).filter((c) => c === COMBAT)).toHaveLength(1);
    });
  });
});

describe("Energy (43022), Genius (43023) and Strength (43024): reprints with no ability", () => {
  const pay = (state: GameState, play_: string, cost: number, ...resources: readonly string[]) => {
    const given = moveToHand(state, P1, play_, ...resources);
    const [card, ...paid] = given.ids as [InstanceId, ...InstanceId[]];
    return { state: given.state, card, paid, cost };
  };
  it.each([ENERGY, GENIUS, STRENGTH])(
    "%s is two icons: one card pays a cost of 2 (Pain Tolerance, 43011)",
    (resource) => {
      const { state, card, paid } = pay(heroGame(), "43011", 2, resource);
      expect(rejected(state, play(P1, card, paid))).toBe(false);
    },
  );
  it("one of them is not enough for a cost of 3 (Rictor, 43014)", () => {
    const { state, card, paid } = pay(heroGame(), "43014", 3, ENERGY);
    expect(rejected(state, play(P1, card, paid))).toBe(true);
  });
  it("they define no ability of their own", () => {
    for (const code of [ENERGY, GENIUS, STRENGTH])
      expect(Object.keys(X23_PACK_CARDS).filter((id) => id.startsWith(`${code}.`))).toEqual([]);
  });
});
