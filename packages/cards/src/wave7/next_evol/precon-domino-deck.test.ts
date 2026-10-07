import { cardId } from "@mc/content";
import {
  applyCommand,
  createGame,
  traitsOf,
  type CardInstance,
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
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  putOnTopOfDeck,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, moveToDiscard, withForm } from "../../testing/staging.js";
import { SPIDERHAM_EVENTS } from "../../wave5/spiderham/events.js";
import { SPIDERHAM_SUPPORT_UPGRADES } from "../../wave5/spiderham/support-upgrades.js";
import { WAVE7_DEPS, wave7Scenario, wave7StarterDeckSetup } from "../index.js";
import { NEXT_EVOL_PRECON_DOMINO_DECK } from "./precon-domino-deck.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The aspect and basic cards printed with Domino's precon (40050-40064) and the basic ally Hope Summers (40204),
 * docs/phase7-wave7.md §7.1, §3.1-§3.4, §3.55, §3.56, §3.59. Domino's real precon (`domino-justice`) against the
 * Morlock Siege scenario (no Hope Summers 40130 in play, no tough status, one encounter side scheme 40081a with no
 * threat) through `wave7Scenario` with the real registry; Juggernaut and Stryfe where the campaign's Hope Summers
 * (40130) must be in play. The deck is stacked so each discarded card is known: ENERGY 40052 (one energy icon), MENTAL
 * 40053, PHYSICAL 40055, WILD 40046 (one wild icon; Domino's hero face counts it twice), TRIO Jackpot! 40043 (three
 * produced icons). Hand cards pay costs; the hand is exactly the five PAYMENT cards unless a test says otherwise.
 */
const HOPE = "40204";
const FERAL = "40050";
const WOLFSBANE = "40051";
const EVEN_THE_ODDS = "40052";
const TEAM_INVESTIGATION = "40053";
const TAKE_OUT = "40054";
const OVERWATCH = "40055";
const ATLAS_BEAR = "40056";
const WHITE_FOX = "40057";
const THE_POSSE = "40058";
const TRAINING = "40059";
const DIGGING_DEEP = "40060";
const ENERGY_RES = "40061";
const GENIUS = "40062";
const STRENGTH = "40063";
const SHARPSHOOTER = "40064";

const FERAL_REF = "40050.feral-response";
const WOLFSBANE_REF = "40051.wolfsbane-response";
const ODDS_REF = "40052.even-the-odds-action";
const INVESTIGATION_REF = "40053.team-investigation-action";
const TAKE_OUT_REF = "40054.when-defeated";
const OVERWATCH_REF = "40055.overwatch-interrupt";
const BEAR_REF = "40056.atlas-bear-action";
const FOX_REF = "40057.white-fox-response";
const POSSE_CONSTANT = "40058.the-posse-constant";
const POSSE_ACTION = "40058.the-posse-action";
const TRAINING_REF = "40059.when-defeated";
const DEEP_REF = "40060.digging-deep-response";
const SHARPSHOOTER_REF = "40064.sharpshooter-interrupt";
const HOPE_CONSTANT = "40204.hope-summers-constant";
const HOPE_RESPONSE = "40204.hope-summers-response";
const ALL_REFS = [
  FERAL_REF,
  WOLFSBANE_REF,
  ODDS_REF,
  INVESTIGATION_REF,
  TAKE_OUT_REF,
  OVERWATCH_REF,
  BEAR_REF,
  FOX_REF,
  POSSE_CONSTANT,
  POSSE_ACTION,
  TRAINING_REF,
  DEEP_REF,
  SHARPSHOOTER_REF,
  HOPE_CONSTANT,
  HOPE_RESPONSE,
];

const DOMINO = { starterDeckId: "domino-justice" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
/** Domino's precon plus one Hope Summers (40204), which is in no precon. */
const DOMINO_PRECON = wave7StarterDeckSetup("domino-justice");
const DOMINO_HOPE = {
  identityCardId: DOMINO_PRECON.identityCardId as string,
  deck: [...DOMINO_PRECON.deck.map((c) => c as string), HOPE],
  ...(DOMINO_PRECON.aspects ? { aspects: DOMINO_PRECON.aspects } : {}),
} as const;
type Seat = typeof DOMINO | typeof SPIDER_MAN | typeof DOMINO_HOPE;

const ENERGY = "40052";
const MENTAL = "40053";
const PHYSICAL = "40055";
const WILD = "40046";
const TRIO = "40043";
const PISTOL = "40046";
const PAYMENT = ["40047", "40048", "40049", "40039", "40038"];
const SIDE_SCHEME = "40085"; // an encounter side scheme of the Morlock Siege scenario
const OTHER_SIDE_SCHEME = "40084";
const WHIPLASH = "01172"; // a non-ELITE minion
const ELITE_MINION = "01129"; // Radioactive Man, an ELITE minion
const HYDRA_SOLDIER = "03029"; // a non-ELITE minion

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const handCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).hand);
const deckCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).deck);
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).discard);
const playCodes = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).playArea);
const only = (s: GameState, code: string): InstanceId => {
  const found = instancesOf(s, code);
  if (found.length !== 1) throw new Error(`expected one ${code}, found ${found.length}`);
  return found[0]!;
};
const events = <T extends GameEvent["type"]>(log: readonly GameEvent[], type: T) =>
  log.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

function newGame(players: readonly Seat[], scenario = "morlock-siege", seed = 1): GameState {
  const config = wave7Scenario(scenario, { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
}
/** The first player in hero form (the game starts in alter-ego form with a hand of 6). */
const heroGame = (players: readonly Seat[] = [DOMINO], scenario = "morlock-siege"): GameState =>
  withForm(newGame(players, scenario), { heroForm: 0 });

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const threatOn = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const withMainThreat = (s: GameState, threat: number): GameState => patchInstance(s, mainOf(s), { threat });
const refused = (state: GameState, command: Command): boolean => !applyCommand(state, command, WAVE7_DEPS).ok;

/**
 * `p`'s deck is `deckTopFirst` over the rest of it, the hand exactly `hand`, the discard pile empty. Only the first
 * player's piles are rearranged unless `player` says otherwise.
 */
function stacked(
  state: GameState,
  deckTopFirst: readonly string[],
  hand: readonly string[] = PAYMENT,
  player: PlayerId = P1,
): GameState {
  const cleared = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, deck: [...p.hand, ...p.discard, ...p.deck], hand: [], discard: [] } : p,
    ),
  };
  const withHand = hand.length > 0 ? moveToHand(cleared, player, ...hand).state : cleared;
  return deckTopFirst.length > 0 ? putOnTopOfDeck(withHand, player, ...deckTopFirst).state : withHand;
}
/** `player`'s hand topped up from the deck to at least `n` cards. */
function fillHand(state: GameState, n: number, player: PlayerId): GameState {
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.playerId !== player || p.hand.length >= n) return p;
      const need = n - p.hand.length;
      return { ...p, hand: [...p.hand, ...p.deck.slice(0, need)], deck: p.deck.slice(need) };
    }),
  };
}

/** Answers prompts from a queue: each answer is an option id or a label; otherwise the first legal option. */
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
/** Takes every optional response whose id contains one of `wanted`; picks a card `choose` by code where offered. */
const accepting =
  (wanted: readonly string[], rest: Picker = firstLegal): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers")
      return choice.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
    return rest(state);
  };
/** Picks the card with `code` at a chooseCards prompt, and the target `targets` at a chooseTarget prompt. */
const choosing =
  (code: string | null, ...targets: readonly InstanceId[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseCards" && code !== null) {
      const hit = choice.options.find((o) => codeOf(state, o.optionId as InstanceId) === code);
      if (hit) return [hit.optionId];
    }
    if (choice?.prompt.kind === "chooseTarget") {
      const hit = choice.options.find((o) => targets.includes(o.optionId as InstanceId));
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };
/** Runs `commands`, recording the id of every response offered and the kind and labels of every prompt. */
function drive(
  state: GameState,
  pick: Picker,
  ...commands: Command[]
): { state: GameState; events: readonly GameEvent[]; offered: string[]; prompts: string[] } {
  const offered: string[] = [];
  const prompts: string[] = [];
  const spy: Picker = (s) => {
    const c = s.pendingChoice;
    if (c) prompts.push(`${c.prompt.kind}:${c.options.map((o) => o.label).join("|")}`);
    if (c?.prompt.kind === "chooseTriggers") for (const o of c.options) offered.push(o.optionId);
    return pick(s);
  };
  const result = driveEventsPicking(WAVE7_DEPS, state, spy, ...commands);
  return { ...result, offered, prompts };
}
const wasOffered = (offered: readonly string[], ref: string): boolean => offered.some((o) => o.includes(ref));

/** `code` played from hand (an upgrade onto `attach`), paying `cost` with other hand cards. */
function put(
  state: GameState,
  code: string,
  cost: number,
  opts: { attach?: InstanceId; player?: PlayerId; pick?: Picker } = {},
): { state: GameState; id: InstanceId; before: GameState; events: readonly GameEvent[] } {
  const player = opts.player ?? P1;
  const filled = fillHand(state, cost + 1, player);
  const given = moveToHand(filled, player, code);
  const [id] = given.ids as [InstanceId];
  const driven = driveEventsPicking(
    WAVE7_DEPS,
    given.state,
    opts.pick ?? firstLegal,
    play(player, id, payWith(given.state, player, cost, [id]), opts.attach ? { attachToInstanceId: opts.attach } : {}),
  );
  return { state: driven.state, id, before: given.state, events: driven.events };
}
const playRefused = (state: GameState, code: string, payment: readonly string[], player: PlayerId = P1): boolean => {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const card = id;
  const hand = playerOf(given.state, player).hand;
  const used: InstanceId[] = [];
  for (const c of payment) {
    const hit = hand.find((id) => codeOf(given.state, id) === c && !used.includes(id) && id !== card);
    if (!hit) throw new Error(`no ${c} in hand`);
    used.push(hit);
  }
  const paying = used;
  return refused(given.state, play(player, id, paying));
};

const basicThwart = (player: PlayerId, thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const basicAttack = (player: PlayerId, attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});

/** A minion (`code`) engaged with `player`, put in by surgery. */
function withMinion(state: GameState, code: string, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const id = `i9${Object.keys(state.instances).length}` as InstanceId;
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
/** Puts a copy of `code` from `player`'s deck, hand or discard pile straight into their play area (no cost, no trigger). */
function surge(state: GameState, code: string, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, player);
  const id = [...owner.hand, ...owner.deck, ...owner.discard].find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`${player} has no ${code}`);
  const moved = {
    ...state,
    instances: {
      ...state.instances,
      [id]: { ...inst(state, id), home: { kind: "playArea", playerId: player }, controllerId: player, faceup: true },
    },
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            hand: p.hand.filter((i) => i !== id),
            deck: p.deck.filter((i) => i !== id),
            discard: p.discard.filter((i) => i !== id),
            playArea: [...p.playArea, id],
          }
        : p,
    ),
  } as GameState;
  return { state: moved, id };
}
/** A new copy of `code` owned and controlled by `player`, already in their play area (a card their deck does not hold). */
function conjure(state: GameState, code: string, player: PlayerId): { state: GameState; id: InstanceId } {
  const id = `i8${Object.keys(state.instances).length}` as InstanceId;
  const instance = {
    ...inst(state, playerOf(state, player).identity.instanceId),
    instanceId: id,
    cardId: cardId(code),
    ownerId: player,
    controllerId: player,
    home: { kind: "playArea", playerId: player },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    attachedTo: null,
    attachments: [],
    counters: {},
    flipped: false,
  } as unknown as CardInstance;
  return {
    id,
    state: {
      ...state,
      instances: { ...state.instances, [id]: instance },
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
    },
  };
}
const inPlayAreaOf = (s: GameState, id: InstanceId): boolean => s.players.some((p) => p.playArea.includes(id));

describe("Domino precon deck registry", () => {
  it.each(ALL_REFS)("%s validates", (id) => {
    expect(validateDefinition(NEXT_EVOL_PRECON_DOMINO_DECK[id]!)).toEqual([]);
  });
  it("holds exactly the printed refs of 40050-40060, 40064 and 40204 (Energy, Genius and Strength print none)", () => {
    expect(Object.keys(NEXT_EVOL_PRECON_DOMINO_DECK).sort()).toEqual([...ALL_REFS].sort());
  });
  it("Even the Odds and Overwatch are the same definitions as their reprinted originals 30014 and 30019", () => {
    expect(NEXT_EVOL_PRECON_DOMINO_DECK[ODDS_REF]).toBe(SPIDERHAM_EVENTS["30014.even-the-odds-action"]);
    expect(NEXT_EVOL_PRECON_DOMINO_DECK[OVERWATCH_REF]).toBe(SPIDERHAM_SUPPORT_UPGRADES["30019.overwatch-interrupt"]);
  });
});

describe("Feral (40050): after she thwarts, discard the top card; 1 damage to the villain per icon", () => {
  /** Feral in play, a main scheme of 20 threat, the deck stacked. */
  function ready(top: readonly string[], players: readonly Seat[] = [DOMINO]): { state: GameState; feral: InstanceId } {
    const base = stacked(withMainThreat(heroGame(players), 20), top);
    const { state, id } = put(base, FERAL, 4);
    return { state, feral: id };
  }
  const thwart = (s: GameState, feral: InstanceId, pick: Picker = accepting([FERAL_REF])) =>
    drive(s, pick, basicThwart(P1, feral, mainOf(s)));

  it("costs 4: refused with three other cards in hand, enters play with five", () => {
    const base = stacked(heroGame(), [], PAYMENT);
    expect(playRefused(base, FERAL, PAYMENT.slice(0, 3))).toBe(true);
    const { state, id } = put(base, FERAL, 4);
    expect(playCodes(state)).toContain(FERAL);
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(base, P1).hand.length - 4);
    expect(inst(state, id).damage).toBe(0);
  });

  it.each([
    [ENERGY, 1],
    [MENTAL, 1],
    [PHYSICAL, 1],
    [WILD, 2],
  ])("discarding %s deals %i to the villain (Domino counts a printed wild twice)", (top, damage) => {
    const { state: staged, feral } = ready([top, PHYSICAL]);
    const { state } = thwart(staged, feral);
    expect(damageOn(state, villainOf(state))).toBe(damage);
    expect(discardCodes(state)).toContain(top);
    expect(deckCodes(state)[0]).toBe(PHYSICAL);
    // The thwart itself: THW 2 off the main scheme, 1 consequential damage to Feral.
    expect(threatOn(state, mainOf(state))).toBe(18);
    expect(damageOn(state, feral)).toBe(1);
  });

  it("is a response: declining it discards nothing and deals nothing", () => {
    const { state: staged, feral } = ready([ENERGY]);
    const { state, offered } = thwart(staged, feral, firstLegal);
    expect(wasOffered(offered, FERAL_REF)).toBe(true);
    expect(discardCodes(state)).not.toContain(ENERGY);
    expect(damageOn(state, villainOf(state))).toBe(0);
  });

  it("Jackpot! discarded counts its three icons when declined, and nothing when it shuffles itself back", () => {
    const { state: staged, feral } = ready([TRIO, PHYSICAL]);
    const declined = thwart(staged, feral, accepting([FERAL_REF]));
    expect(damageOn(declined.state, villainOf(declined.state))).toBe(3);
    const answered = thwart(staged, feral, accepting([FERAL_REF, "40043.jackpot-response"]));
    expect(damageOn(answered.state, villainOf(answered.state))).toBe(0);
    expect(deckCodes(answered.state)).toContain(TRIO);
  });

  it("the damage is not an attack: no attack event, so it ignores nothing and triggers no retaliate", () => {
    const { state: staged, feral } = ready([ENERGY]);
    const { events: log } = thwart(staged, feral);
    expect(events(log, "damageDealt").length).toBeGreaterThan(0);
    expect(log.some((e) => e.type === "attackResolved")).toBe(false);
  });

  it("two players: only her controller's deck is discarded from", () => {
    const { state: staged, feral } = ready([WILD], [DOMINO, SPIDER_MAN]);
    const otherDeck = playerOf(staged, P2).deck;
    const { state } = thwart(staged, feral);
    expect(damageOn(state, villainOf(state))).toBe(2);
    expect(playerOf(state, P2).deck).toEqual(otherDeck);
    expect(playerOf(state, P2).discard).toEqual(playerOf(staged, P2).discard);
  });
});

describe("Wolfsbane (40051): name a card type, discard the top card, may add it if it matches", () => {
  function ready(top: readonly string[], players: readonly Seat[] = [DOMINO]): { state: GameState; wolf: InstanceId } {
    const base = stacked(withMainThreat(heroGame(players), 20), top);
    const { state, id } = put(base, WOLFSBANE, 3);
    return { state, wolf: id };
  }
  const thwart = (s: GameState, wolf: InstanceId, pick: Picker, also: readonly string[] = []) =>
    drive(s, accepting([WOLFSBANE_REF, ...also], pick), basicThwart(P1, wolf, mainOf(s)));

  it("costs 3 and thwarts for 2 with 1 consequential damage", () => {
    const { state, wolf } = ready([ENERGY]);
    const { state: after } = thwart(state, wolf, answering("Event", "Leave it in your discard pile"));
    expect(threatOn(after, mainOf(after))).toBe(18);
    expect(damageOn(after, wolf)).toBe(1);
  });

  it("offers all six card types, player side scheme included, before anything is discarded", () => {
    const { state, wolf } = ready([ENERGY]);
    const { prompts } = thwart(state, wolf, answering("Event", "Leave it in your discard pile"));
    expect(prompts).toContain("chooseOption:Ally|Event|Upgrade|Support|Resource|Player side scheme");
  });

  it("naming the type of the discarded card offers to add it: accepted, it goes to hand", () => {
    const { state, wolf } = ready([ENERGY, PHYSICAL]);
    const { state: after } = thwart(state, wolf, answering("Event", "Add it to your hand"));
    expect(handCodes(after)).toContain(ENERGY);
    expect(discardCodes(after)).not.toContain(ENERGY);
    expect(deckCodes(after)[0]).toBe(PHYSICAL);
  });

  it("declined, the card stays in the discard pile", () => {
    const { state, wolf } = ready([ENERGY]);
    const { state: after } = thwart(state, wolf, answering("Event", "Leave it in your discard pile"));
    expect(discardCodes(after)).toContain(ENERGY);
    expect(handCodes(after)).not.toContain(ENERGY);
  });

  it("naming another type discards the card and offers nothing", () => {
    const { state, wolf } = ready([ENERGY]);
    const { state: after, prompts } = thwart(state, wolf, answering("Ally"));
    expect(discardCodes(after)).toContain(ENERGY);
    expect(handCodes(after)).not.toContain(ENERGY);
    expect(prompts.some((p) => p.includes("Add it to your hand"))).toBe(false);
  });

  it.each([
    ["Upgrade", PHYSICAL],
    ["Resource", "40061"],
    ["Player side scheme", TAKE_OUT],
    ["Ally", "40038"],
  ])("naming %s adds a matching card (%s)", (type, code) => {
    const { state, wolf } = ready([code]);
    const { state: after } = thwart(state, wolf, answering(type, "Add it to your hand"));
    expect(handCodes(after)).toContain(code);
  });

  it("a card another response took (Digging Deep, taken to hand) is not offered again", () => {
    const { state, wolf } = ready([DIGGING_DEEP, PHYSICAL]);
    const { state: after, prompts } = thwart(state, wolf, answering("Resource"), [DEEP_REF]);
    expect(handCodes(after).filter((c) => c === DIGGING_DEEP)).toHaveLength(1);
    expect(discardCodes(after)).not.toContain(DIGGING_DEEP);
    expect(prompts.some((p) => p.includes("Add it to your hand"))).toBe(false);
  });

  it("two players: her controller's deck only", () => {
    const { state, wolf } = ready([ENERGY], [DOMINO, SPIDER_MAN]);
    const otherDeck = playerOf(state, P2).deck;
    const { state: after } = thwart(state, wolf, answering("Event", "Add it to your hand"));
    expect(handCodes(after)).toContain(ENERGY);
    expect(playerOf(after, P2).deck).toEqual(otherDeck);
  });
});

describe("Even the Odds (40052): 1 per hero off each side scheme, 1 damage per scheme defeated", () => {
  /** Two encounter side schemes in the villain area with `a` and `b` threat; the villain has taken no damage. */
  function withSchemes(players: readonly Seat[], a: number, b: number): { state: GameState; ids: InstanceId[] } {
    let s = stacked(heroGame(players), [], [ENERGY_RES, MENTAL, PHYSICAL, "40047", "40048"]);
    const first = encounterCardInVillainArea(s, SIDE_SCHEME, a);
    s = first.state;
    const second = encounterCardInVillainArea(s, OTHER_SIDE_SCHEME, b);
    return { state: second.state, ids: [first.id, second.id] };
  }

  it("removes 1 threat from each side scheme (not the main scheme) and deals 1 damage per scheme defeated", () => {
    const { state: staged, ids } = withSchemes([DOMINO], 1, 4);
    const main = threatOn(staged, mainOf(staged));
    const { state } = put(staged, EVEN_THE_ODDS, 2);
    expect(threatOn(state, ids[1]!)).toBe(3);
    expect(state.villainArea).not.toContain(ids[0]);
    expect(threatOn(state, mainOf(state))).toBe(main);
    expect(damageOn(state, villainOf(state))).toBe(1);
    expect(discardCodes(state)).toContain(EVEN_THE_ODDS);
  });

  it("two players: 2 threat from each side scheme, and two schemes defeated deal 2", () => {
    const { state: staged, ids } = withSchemes([DOMINO, SPIDER_MAN], 2, 5);
    const { state } = put(staged, EVEN_THE_ODDS, 2);
    expect(state.villainArea).not.toContain(ids[0]);
    expect(threatOn(state, ids[1]!)).toBe(3);
    expect(damageOn(state, villainOf(state))).toBe(1);
  });

  it("Requirement ([energy]): refused when no paid card shows an energy icon, allowed with one", () => {
    const base = stacked(heroGame(), [], [MENTAL, PHYSICAL, "40047"]);
    expect(playRefused(base, EVEN_THE_ODDS, [MENTAL, PHYSICAL])).toBe(true);
    const withEnergy = stacked(heroGame(), [], [ENERGY_RES, PHYSICAL, "40047"]);
    expect(playRefused(withEnergy, EVEN_THE_ODDS, [ENERGY_RES, PHYSICAL])).toBe(false);
  });

  it("is a Hero Action: refused in alter-ego form", () => {
    const base = withForm(stacked(heroGame(), [], [ENERGY_RES, MENTAL]), "alterEgo");
    expect(playRefused(base, EVEN_THE_ODDS, [ENERGY_RES, MENTAL])).toBe(true);
  });
});

describe("Team Investigation (40053): 3 per hero threat off a side scheme, cost 2 per hero", () => {
  const SCHEME = (s: GameState, threat: number) => encounterCardInVillainArea(s, SIDE_SCHEME, threat);

  it("one player pays 2 and removes 3 threat from a side scheme", () => {
    const staged = SCHEME(stacked(heroGame(), []), 8);
    const { state } = put(staged.state, TEAM_INVESTIGATION, 2);
    expect(threatOn(state, staged.id)).toBe(5);
    expect(discardCodes(state)).toContain(TEAM_INVESTIGATION);
  });

  it("one player: the cost is 2, not 1", () => {
    const staged = SCHEME(stacked(heroGame(), [], ["40047", "40048"]), 8).state;
    expect(playRefused(staged, TEAM_INVESTIGATION, ["40047"])).toBe(true);
    expect(playRefused(staged, TEAM_INVESTIGATION, ["40047", "40048"])).toBe(false);
  });

  it("two players: the printed cost is 4 (an alliance card, paid by both hands) and 6 threat comes off", () => {
    const base = stacked(heroGame([DOMINO, SPIDER_MAN]), [], ["40047", "40048"]);
    const staged = SCHEME(base, 9);
    const given = moveToHand(staged.state, P1, TEAM_INVESTIGATION);
    const [card] = given.ids as [InstanceId];
    const own = payWith(given.state, P1, 2, [card]);
    const theirs = playerOf(given.state, P2).hand;
    // The printed cost 2 scales to 4 with two players: two cards, or three across both hands, are not enough.
    expect(refused(given.state, play(P1, card, own))).toBe(true);
    expect(refused(given.state, play(P1, card, [...own, theirs[0]!]))).toBe(true);
    const group = [...own, theirs[0]!, theirs[1]!];
    const done = driveEventsPicking(WAVE7_DEPS, given.state, firstLegal, play(P1, card, group)).state;
    expect(threatOn(done, staged.id)).toBe(3);
    expect(discardCodes(done, P1)).toContain(TEAM_INVESTIGATION);
    expect(playerOf(done, P2).discard).toEqual(expect.arrayContaining([theirs[0]!, theirs[1]!]));
  });

  it("only a side scheme: the main scheme is not a target", () => {
    const staged = SCHEME(withMainThreat(stacked(heroGame(), []), 12), 5);
    const { state } = put(staged.state, TEAM_INVESTIGATION, 2, { pick: choosing(null, mainOf(staged.state)) });
    expect(threatOn(state, mainOf(state))).toBe(12);
    expect(threatOn(state, staged.id)).toBe(2);
  });

  it("Genius (two [mental] icons) alone pays the cost of 2", () => {
    const staged = SCHEME(stacked(heroGame(), [], [GENIUS]), 8).state;
    expect(playRefused(staged, TEAM_INVESTIGATION, [GENIUS])).toBe(false);
  });
});

describe("Take Out the Guards (40054): a player side scheme; When Defeated each player may discard a non-ELITE minion", () => {
  /** Take Out the Guards in play with `threat` left, the minions engaged with P1 by surgery. */
  function inPlay(players: readonly Seat[] = [DOMINO], threat = 1): { state: GameState; scheme: InstanceId } {
    const { state, id } = put(stacked(heroGame(players), []), TAKE_OUT, 0);
    return { state: patchInstance(state, id, { threat }), scheme: id };
  }
  const defeat = (s: GameState, scheme: InstanceId, pick: Picker = firstLegal) =>
    drive(s, pick, basicThwart(P1, identityOf(s, P1), scheme));

  it("is played for 0 and enters the villain area with 4 threat per player (4 at one player, 8 at two)", () => {
    const one = put(stacked(heroGame(), []), TAKE_OUT, 0);
    expect(one.state.villainArea).toContain(one.id);
    expect(threatOn(one.state, one.id)).toBe(4);
    expect(playerOf(one.state, P1).hand).not.toContain(one.id);
    const two = put(stacked(heroGame([DOMINO, SPIDER_MAN]), []), TAKE_OUT, 0);
    expect(threatOn(two.state, two.id)).toBe(8);
  });

  it("the player side scheme limit is one: playing Superpower Training chooses one of the two to discard, not defeated", () => {
    const first = put(stacked(heroGame(), []), TAKE_OUT, 0);
    const next = put(first.state, TRAINING, 1, { pick: choosing(null, first.id) });
    expect(next.state.villainArea).not.toContain(first.id);
    expect(next.state.villainArea).toContain(next.id);
    expect(discardCodes(next.state)).toContain(TAKE_OUT);
    // Discarded by the limit, not defeated: nothing in the victory display, no When Defeated prompt.
    expect(next.state.victoryDisplay).toEqual([]);
  });

  it("thwarted to 0 it is defeated: Victory 0 puts it in the victory display", () => {
    const { state: staged, scheme } = inPlay();
    const { state } = defeat(staged, scheme);
    expect(state.victoryDisplay).toContain(scheme);
    expect(state.villainArea).not.toContain(scheme);
  });

  it("When Defeated: the player may discard a non-ELITE minion in play (a discard, not a defeat)", () => {
    const { state: staged, scheme } = inPlay();
    const minion = withMinion(staged, WHIPLASH);
    const { state, events: log } = defeat(minion.state, scheme, choosing(null, minion.id));
    expect(inPlayAreaOf(state, minion.id)).toBe(false);
    expect(events(log, "characterDefeated")).toHaveLength(0);
  });

  it("an ELITE minion is not a legal choice; with only an ELITE minion in play nothing is asked", () => {
    const { state: staged, scheme } = inPlay();
    const elite = withMinion(staged, ELITE_MINION);
    const { state, prompts } = defeat(elite.state, scheme);
    expect(inPlayAreaOf(state, elite.id)).toBe(true);
    expect(prompts.some((p) => p.includes("Radioactive Man"))).toBe(false);
    // Offered both, the ELITE one is missing from the options.
    const both = withMinion(elite.state, HYDRA_SOLDIER);
    const offered: string[] = [];
    const picked = defeat(both.state, scheme, (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseTarget")
        offered.push(...s.pendingChoice.options.map((o) => o.optionId));
      return choosing(null, both.id)(s);
    });
    expect(offered).toEqual([both.id]);
    expect(inPlayAreaOf(picked.state, elite.id)).toBe(true);
    expect(inPlayAreaOf(picked.state, both.id)).toBe(false);
  });

  it("the player may decline: the minion stays", () => {
    const { state: staged, scheme } = inPlay();
    const minion = withMinion(staged, WHIPLASH);
    const declining: Picker = (s) =>
      s.pendingChoice?.prompt.kind === "chooseTarget" && s.pendingChoice.minSelections === 0 ? [] : firstLegal(s);
    const { state } = defeat(minion.state, scheme, declining);
    expect(inPlayAreaOf(state, minion.id)).toBe(true);
  });

  it("two players: each player chooses their own, so a minion engaged with either may be discarded", () => {
    const { state: staged, scheme } = inPlay([DOMINO, SPIDER_MAN]);
    const mine = withMinion(staged, WHIPLASH, P1);
    const theirs = withMinion(mine.state, HYDRA_SOLDIER, P2);
    const answered: string[] = [];
    const pick: Picker = (s) => {
      const c = s.pendingChoice;
      if (c?.prompt.kind === "chooseTarget") {
        answered.push(c.options.map((o) => o.optionId).join(","));
        const hit = c.options.find((o) => o.optionId === mine.id || o.optionId === theirs.id);
        if (hit) return [hit.optionId];
      }
      return firstLegal(s);
    };
    const { state } = defeat(theirs.state, scheme, pick);
    // Two prompts (one per player); the first took one of the two minions, the second the other.
    expect(answered.length).toBe(2);
    expect(inPlayAreaOf(state, mine.id)).toBe(false);
    expect(inPlayAreaOf(state, theirs.id)).toBe(false);
  });
});

describe("Superpower Training (40059): When Defeated each player may fetch an identity-specific upgrade", () => {
  /** Superpower Training in play with 1 threat left; Domino's Pistol and Probability Field are in the deck. */
  function inPlay(players: readonly Seat[] = [DOMINO]): { state: GameState; scheme: InstanceId } {
    const { state, id } = put(stacked(heroGame(players), []), TRAINING, 1);
    return { state: patchInstance(state, id, { threat: 1 }), scheme: id };
  }
  const defeat = (s: GameState, scheme: InstanceId, pick: Picker) =>
    drive(s, pick, basicThwart(P1, identityOf(s, P1), scheme));

  it("costs 1 and enters with 3 threat per player", () => {
    const one = put(stacked(heroGame(), []), TRAINING, 1);
    expect(threatOn(one.state, one.id)).toBe(3);
    const two = put(stacked(heroGame([DOMINO, SPIDER_MAN]), []), TRAINING, 1);
    expect(threatOn(two.state, two.id)).toBe(6);
    expect(playRefused(stacked(heroGame(), [], ["40047"]), TRAINING, [])).toBe(true);
  });

  it("the player searches the deck for an upgrade of their identity set, attaches it to their identity and shuffles", () => {
    const { state: staged, scheme } = inPlay();
    const host = identityOf(staged);
    const { state, events: log } = defeat(staged, scheme, choosing(PISTOL, host));
    const attached = instancesOf(state, PISTOL).filter((i) => inst(state, i).attachedTo === host);
    expect(attached).toHaveLength(1);
    expect(deckCodes(state).filter((c) => c === PISTOL)).toHaveLength(1);
    expect(events(log, "deckShuffled").some((e) => e.zone.kind === "deck")).toBe(true);
    expect(state.victoryDisplay).toContain(scheme);
  });
});

describe("Overwatch (40055): discard it when a thwart removes threat from the attached scheme", () => {
  /** A main scheme of 20 and a side scheme of 5, Overwatch attached to `host` (main by default). */
  function ready(
    players: readonly Seat[] = [DOMINO],
    onSide = false,
  ): { state: GameState; overwatch: InstanceId; main: InstanceId; side: InstanceId } {
    const withSide = encounterCardInVillainArea(withMainThreat(stacked(heroGame(players), []), 20), SIDE_SCHEME, 5);
    const host = onSide ? withSide.id : mainOf(withSide.state);
    const { state, id } = put(withSide.state, OVERWATCH, 0, { attach: host });
    return { state, overwatch: id, main: mainOf(state), side: withSide.id };
  }
  const thwartMain = (s: GameState, main: InstanceId, pick: Picker) =>
    drive(s, pick, basicThwart(P1, identityOf(s, P1), main));

  it("costs 0 and attaches to a scheme", () => {
    const { state, overwatch, main } = ready();
    expect(inst(state, overwatch).attachedTo).toBe(main);
  });

  it("an equal amount of threat comes off a different scheme, and Overwatch is discarded", () => {
    const { state: staged, overwatch, main, side } = ready();
    const { state, offered } = thwartMain(staged, main, accepting([OVERWATCH_REF], choosing(null, side)));
    expect(wasOffered(offered, OVERWATCH_REF)).toBe(true);
    const removed = 20 - threatOn(state, main);
    expect(removed).toBeGreaterThan(0);
    expect(threatOn(state, side)).toBe(5 - removed);
    expect(discardCodes(state)).toContain(OVERWATCH);
    expect(inst(state, overwatch).attachedTo).toBe(null);
  });

  it("is an interrupt: declining leaves it attached and the other scheme alone", () => {
    const { state: staged, overwatch, main, side } = ready();
    const { state } = thwartMain(staged, main, firstLegal);
    expect(inst(state, overwatch).attachedTo).toBe(main);
    expect(threatOn(state, side)).toBe(5);
  });

  it("is not offered for a thwart of another scheme", () => {
    const { state: staged, side } = ready();
    const { offered } = drive(staged, accepting([OVERWATCH_REF]), basicThwart(P1, identityOf(staged), side));
    expect(wasOffered(offered, OVERWATCH_REF)).toBe(false);
  });

  it("the removal is capped by the threat the attached scheme had", () => {
    const { state: staged, main, side } = ready();
    const nearly = patchInstance(staged, main, { threat: 1 });
    const { state } = thwartMain(nearly, main, accepting([OVERWATCH_REF], choosing(null, side)));
    expect(threatOn(state, side)).toBe(4);
  });

  it("Max 1 per scheme: a second Overwatch cannot attach to the same scheme, but can to another", () => {
    const { state, main, side } = ready();
    const given = moveToHand(state, P1, OVERWATCH);
    const [second] = given.ids as [InstanceId];
    expect(refused(given.state, play(P1, second, [], { attachToInstanceId: main }))).toBe(true);
    expect(refused(given.state, play(P1, second, [], { attachToInstanceId: side }))).toBe(false);
  });

  it("two players: another hero's thwart of the scheme is a thwart too, and offers it to Overwatch's controller", () => {
    const { state: staged, main, side } = ready([DOMINO, SPIDER_MAN]);
    const turn2 = withForm(
      driveEventsPicking(WAVE7_DEPS, staged, firstLegal, { type: "endTurn", playerId: P1 }).state,
      { heroForm: 0 },
      P2,
    );
    const { offered, state } = drive(
      turn2,
      accepting([OVERWATCH_REF], choosing(null, side)),
      basicThwart(P2, identityOf(turn2, P2), main),
    );
    const removed = 20 - threatOn(state, main);
    expect(removed).toBeGreaterThan(0);
    expect(wasOffered(offered, OVERWATCH_REF)).toBe(true);
    expect(threatOn(state, side)).toBe(5 - removed);
  });
});

describe("Atlas Bear (40056): look at the top card of a player deck; an event may be taken for 1 damage", () => {
  function ready(top: readonly string[], players: readonly Seat[] = [DOMINO], p2Top: readonly string[] = []) {
    let base = stacked(heroGame(players), top);
    if (p2Top.length > 0) base = stacked(base, p2Top, [], P2);
    const { state, id } = put(base, ATLAS_BEAR, 3);
    return { state, bear: id };
  }
  const TAKE = "Deal 1 damage to Atlas Bear to add it to its owner's hand";
  const LEAVE = "Leave it on the deck";

  it("costs 3; the Action exhausts her", () => {
    const base = stacked(heroGame(), [ENERGY]);
    expect(playRefused(base, ATLAS_BEAR, PAYMENT.slice(0, 2))).toBe(true);
    const { state, bear } = ready([ENERGY]);
    expect(playCodes(state)).toContain(ATLAS_BEAR);
    const used = drive(state, answering(TAKE), use(P1, bear, BEAR_REF)).state;
    expect(inst(used, bear).exhausted).toBe(true);
    expect(refused(used, use(P1, bear, BEAR_REF))).toBe(true);
  });

  it("an event on top: taking it deals 1 damage to Atlas Bear and adds it to the hand (not a draw)", () => {
    const { state: staged, bear } = ready([ENERGY, PHYSICAL]);
    const before = playerOf(staged, P1).hand.length;
    const { state, events: log } = drive(staged, answering(TAKE), use(P1, bear, BEAR_REF));
    expect(damageOn(state, bear)).toBe(1);
    expect(handCodes(state)).toContain(ENERGY);
    expect(playerOf(state, P1).hand).toHaveLength(before + 1);
    expect(deckCodes(state)[0]).toBe(PHYSICAL);
    expect(events(log, "cardDrawn")).toHaveLength(0);
  });

  it("the player may leave it: no damage, the card stays on top", () => {
    const { state: staged, bear } = ready([ENERGY, PHYSICAL]);
    const { state } = drive(staged, answering(LEAVE), use(P1, bear, BEAR_REF));
    expect(damageOn(state, bear)).toBe(0);
    expect(deckCodes(state)[0]).toBe(ENERGY);
    expect(handCodes(state)).not.toContain(ENERGY);
  });

  it("a card that is not an event is only looked at: no choice is offered", () => {
    const { state: staged, bear } = ready([PHYSICAL, ENERGY]);
    const { state, prompts } = drive(staged, firstLegal, use(P1, bear, BEAR_REF));
    expect(prompts.some((p) => p.includes(TAKE))).toBe(false);
    expect(deckCodes(state)[0]).toBe(PHYSICAL);
    expect(damageOn(state, bear)).toBe(0);
  });

  it("with one player the deck is hers: no player is asked for", () => {
    const { state: staged, bear } = ready([ENERGY]);
    const { prompts } = drive(staged, answering(LEAVE), use(P1, bear, BEAR_REF));
    expect(prompts.some((p) => p.startsWith("choosePlayer"))).toBe(false);
  });

  it("two players: she may look at the other player's deck, and an event there goes to its owner's hand", () => {
    const { state: staged, bear } = ready([PHYSICAL], [DOMINO, SPIDER_MAN], ["01003"]);
    const p2Hand = playerOf(staged, P2).hand.length;
    const pickP2: Picker = (s) => {
      const c = s.pendingChoice;
      if (c && c.options.some((o) => o.label === TAKE)) return [c.options.find((o) => o.label === TAKE)!.optionId];
      if (c && c.prompt.kind !== "chooseTriggers") {
        const p2 = c.options.find(
          (o) => o.optionId === P2 || o.optionId === identityOf(s, P2) || o.label === "Spider-Man",
        );
        if (p2 && c.options.length > 1) return [p2.optionId];
      }
      return firstLegal(s);
    };
    const { state, prompts } = drive(staged, pickP2, use(P1, bear, BEAR_REF));
    expect(prompts.some((p) => p.startsWith("choosePlayer"))).toBe(true);
    expect(handCodes(state, P2)).toContain("01003");
    expect(playerOf(state, P2).hand).toHaveLength(p2Hand + 1);
    expect(handCodes(state, P1)).not.toContain("01003");
    expect(damageOn(state, bear)).toBe(1);
  });

  it("at 2 damage the 1 damage defeats her and the event is still added", () => {
    const { state: staged, bear } = ready([ENERGY]);
    const { state } = drive(patchInstance(staged, bear, { damage: 2 }), answering(TAKE), use(P1, bear, BEAR_REF));
    expect(playCodes(state)).not.toContain(ATLAS_BEAR);
    expect(handCodes(state)).toContain(ENERGY);
  });
});

describe("White Fox (40057) and Digging Deep (40060): after being discarded from the top of the deck", () => {
  /** A Good Workout (it discards the top card) played with the deck stacked. */
  function workout(top: readonly string[], pick: Picker, setup: (s: GameState) => GameState = (s) => s) {
    const base = setup(stacked(heroGame(), top));
    return put(base, "40040", 2, { pick });
  }

  it("White Fox enters play under her owner's control when the response is taken", () => {
    const { state } = workout([WHITE_FOX, PHYSICAL], accepting([FOX_REF]));
    expect(playCodes(state)).toContain(WHITE_FOX);
    expect(discardCodes(state)).not.toContain(WHITE_FOX);
    const fox = only(state, WHITE_FOX);
    expect(inst(state, fox).controllerId).toBe(P1);
    expect(inst(state, fox).exhausted).toBe(false);
    expect(damageOn(state, villainOf(state))).toBe(4);
  });

  it("declined, she stays in the discard pile and her icon counts (energy: 1 more damage)", () => {
    const { state } = workout([WHITE_FOX, PHYSICAL], firstLegal);
    expect(discardCodes(state)).toContain(WHITE_FOX);
    expect(playCodes(state)).not.toContain(WHITE_FOX);
    expect(damageOn(state, villainOf(state))).toBe(5);
  });

  it("she is not offered from the discard pile otherwise (a hand discard)", () => {
    const base = stacked(heroGame(), []);
    const moved = moveToDiscard(base, P1, WHITE_FOX);
    const { offered } = drive(
      moved.state,
      accepting([FOX_REF]),
      basicThwart(P1, identityOf(moved.state), mainOf(moved.state)),
    );
    expect(wasOffered(offered, FOX_REF)).toBe(false);
  });

  it("at the ally limit (three) entering play makes the player discard an ally", () => {
    const base = stacked(heroGame(), [WHITE_FOX, PHYSICAL]);
    let s = surge(base, "40050").state;
    s = surge(s, "40051").state;
    s = surge(s, "40038").state;
    const prompts: string[] = [];
    const pick: Picker = (st) => {
      if (st.pendingChoice) prompts.push(st.pendingChoice.prompt.kind);
      return accepting([FOX_REF])(st);
    };
    const { state } = put(s, "40040", 2, { pick });
    const allies = playCodes(state).filter((c) => ["40050", "40051", "40038", WHITE_FOX].includes(c));
    expect(allies).toHaveLength(3);
    expect(prompts).toContain("discardOverAllyLimit");
  });

  it("Digging Deep returns to hand when the response is taken, and its icon does not count (Q32 B, April 30, 2026 Ruling 4)", () => {
    const { state } = workout([DIGGING_DEEP, PHYSICAL], accepting([DEEP_REF]));
    expect(handCodes(state)).toContain(DIGGING_DEEP);
    expect(discardCodes(state)).not.toContain(DIGGING_DEEP);
    expect(damageOn(state, villainOf(state))).toBe(4);
  });

  it("declined, Digging Deep stays in the discard pile and counts as a wild twice (6 damage)", () => {
    const { state } = workout([DIGGING_DEEP, PHYSICAL], firstLegal);
    expect(discardCodes(state)).toContain(DIGGING_DEEP);
    expect(damageOn(state, villainOf(state))).toBe(6);
  });

  it("two players: only the owner's deck discards offer it, and only the owner gets it", () => {
    const base = stacked(heroGame([DOMINO, SPIDER_MAN]), [DIGGING_DEEP, PHYSICAL]);
    const p2Hand = playerOf(base, P2).hand;
    const { state } = put(base, "40040", 2, { pick: accepting([DEEP_REF]) });
    expect(handCodes(state)).toContain(DIGGING_DEEP);
    expect(playerOf(state, P2).hand).toEqual(p2Hand);
  });
});

describe("The Posse (40058): play only with three POSSE characters; heal 1 from each and ready them", () => {
  /** Domino (POSSE in hero form) with Atlas Bear and White Fox in play, damaged and exhausted. */
  function ready(): { state: GameState; bear: InstanceId; fox: InstanceId; feral: InstanceId } {
    let s = stacked(heroGame(), [], ["40047", "40048", "40049"]);
    const bear = surge(s, ATLAS_BEAR);
    s = bear.state;
    const fox = surge(s, WHITE_FOX);
    s = fox.state;
    const feral = surge(s, FERAL);
    s = feral.state;
    for (const [id, damage] of [
      [bear.id, 2],
      [fox.id, 1],
      [feral.id, 2],
      [identityOf(s), 3],
    ] as const)
      s = patchInstance(s, id, { damage, exhausted: true });
    return { state: s, bear: bear.id, fox: fox.id, feral: feral.id };
  }

  it("heals 1 damage from each POSSE character and readies them; a non-POSSE ally is untouched", () => {
    const { state: staged, bear, fox, feral } = ready();
    const { state } = put(staged, THE_POSSE, 2);
    const domino = identityOf(state);
    expect([damageOn(state, bear), damageOn(state, fox), damageOn(state, domino)]).toEqual([1, 0, 2]);
    expect([inst(state, bear).exhausted, inst(state, fox).exhausted, inst(state, domino).exhausted]).toEqual([
      false,
      false,
      false,
    ]);
    expect(damageOn(state, feral)).toBe(2);
    expect(inst(state, feral).exhausted).toBe(true);
    expect(discardCodes(state)).toContain(THE_POSSE);
  });

  it("with only two POSSE characters (Domino and Atlas Bear) it cannot be played", () => {
    const { state: staged, fox } = ready();
    const noFox = {
      ...staged,
      players: staged.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== fox) })),
    } as GameState;
    expect(playRefused(noFox, THE_POSSE, ["40047", "40048"])).toBe(true);
    expect(playRefused(staged, THE_POSSE, ["40047", "40048"])).toBe(false);
  });

  it("only characters you control count: another player's POSSE ally does not make three", () => {
    const base = stacked(heroGame([DOMINO, SPIDER_MAN]), [], ["40047", "40048"]);
    const bear = surge(base, ATLAS_BEAR).state;
    const theirs = conjure(bear, "40038", P2);
    expect(playRefused(theirs.state, THE_POSSE, ["40047", "40048"])).toBe(true);
    // With a third POSSE character of her own she may play it, and it heals and readies the other player's too.
    const third = surge(theirs.state, WHITE_FOX).state;
    const hurt = patchInstance(third, theirs.id, { damage: 2, exhausted: true });
    const { state } = put(hurt, THE_POSSE, 2);
    expect(damageOn(state, theirs.id)).toBe(1);
    expect(inst(state, theirs.id).exhausted).toBe(false);
  });

  it("is a Hero Action: refused in alter-ego form", () => {
    const { state: staged } = ready();
    expect(playRefused(withForm(staged, "alterEgo"), THE_POSSE, ["40047", "40048"])).toBe(true);
  });
});

describe("Energy (40061), Genius (40062) and Strength (40063): reprints with no ability", () => {
  it("each is two icons of its type: one card pays a cost of 2", () => {
    const energy = stacked(heroGame(), [], [ENERGY_RES]);
    expect(playRefused(energy, EVEN_THE_ODDS, [ENERGY_RES])).toBe(false);
    const genius = encounterCardInVillainArea(stacked(heroGame(), [], [GENIUS]), SIDE_SCHEME, 5).state;
    expect(playRefused(genius, TEAM_INVESTIGATION, [GENIUS])).toBe(false);
    const strength = stacked(heroGame(), [], [STRENGTH]);
    expect(playRefused(strength, "40042", [STRENGTH])).toBe(false);
  });

  it("one of them is not enough for a cost of 3", () => {
    expect(playRefused(stacked(heroGame(), [], [ENERGY_RES]), WOLFSBANE, [ENERGY_RES])).toBe(true);
  });

  it("they define no ability of their own", () => {
    for (const code of [ENERGY_RES, GENIUS, STRENGTH])
      expect(Object.keys(NEXT_EVOL_PRECON_DOMINO_DECK).filter((id) => id.startsWith(`${code}.`))).toEqual([]);
  });
});

describe("Sharpshooter (40064): discard the top card when you make a ranged attack, +1 damage per icon", () => {
  /** Domino's Pistol (a ranged attack) and Sharpshooter on her identity, then the deck stacked. */
  function ready(top: readonly string[], players: readonly Seat[] = [DOMINO]) {
    const base = heroGame(players);
    const host = identityOf(base);
    const pistol = put(stacked(base, [], PAYMENT), PISTOL, 2, { attach: host });
    const sharp = put(pistol.state, SHARPSHOOTER, 2, { attach: host });
    return { state: stacked(sharp.state, top), pistol: pistol.id, sharp: sharp.id };
  }
  const PISTOL_REF = "40046.dominos-pistol-action";
  const shoot = (s: GameState, pistol: InstanceId, pick: Picker) => drive(s, pick, use(P1, pistol, PISTOL_REF));

  it("costs 2 and attaches to Domino", () => {
    const { state, sharp } = ready([]);
    expect(inst(state, sharp).attachedTo).toBe(identityOf(state));
  });

  it("a ranged attack offers it: the discarded card's icons are extra damage on top of the Pistol's", () => {
    const { state: staged, pistol } = ready([ENERGY, MENTAL, PHYSICAL]);
    const { state, offered } = shoot(staged, pistol, accepting([SHARPSHOOTER_REF]));
    expect(wasOffered(offered, SHARPSHOOTER_REF)).toBe(true);
    // Pistol cost discards ENERGY (1), Sharpshooter discards MENTAL (1 more).
    expect(damageOn(state, villainOf(state))).toBe(2);
    expect(discardCodes(state)).toEqual(expect.arrayContaining([ENERGY, MENTAL]));
    expect(deckCodes(state)[0]).toBe(PHYSICAL);
  });

  it("a printed wild counts twice for Domino: +2", () => {
    const { state: staged, pistol } = ready([ENERGY, WILD, PHYSICAL]);
    const { state } = shoot(staged, pistol, accepting([SHARPSHOOTER_REF]));
    expect(damageOn(state, villainOf(state))).toBe(3);
  });

  it("is an interrupt you may decline: the Pistol's damage alone, one card discarded", () => {
    const { state: staged, pistol } = ready([ENERGY, MENTAL]);
    const { state } = shoot(staged, pistol, firstLegal);
    expect(damageOn(state, villainOf(state))).toBe(1);
    expect(deckCodes(state)[0]).toBe(MENTAL);
  });

  it("a basic attack is not ranged: it is not offered", () => {
    const { state: staged } = ready([ENERGY, MENTAL]);
    const { offered, state } = drive(
      staged,
      accepting([SHARPSHOOTER_REF]),
      basicAttack(P1, identityOf(staged), villainOf(staged)),
    );
    expect(wasOffered(offered, SHARPSHOOTER_REF)).toBe(false);
    expect(deckCodes(state)[0]).toBe(ENERGY);
  });

  it("Max 1 per player: a second Sharpshooter is refused", () => {
    const { state } = ready([]);
    const given = moveToHand(state, P1, SHARPSHOOTER);
    const [second] = given.ids as [InstanceId];
    expect(
      refused(
        given.state,
        play(P1, second, payWith(given.state, P1, 2, [second]), { attachToInstanceId: identityOf(state) }),
      ),
    ).toBe(true);
  });

  it("two players: only her own deck is discarded from", () => {
    const { state: staged, pistol } = ready([ENERGY, MENTAL], [DOMINO, SPIDER_MAN]);
    const otherDeck = playerOf(staged, P2).deck;
    const { state } = shoot(staged, pistol, accepting([SHARPSHOOTER_REF]));
    expect(damageOn(state, villainOf(state))).toBe(2);
    expect(playerOf(state, P2).deck).toEqual(otherDeck);
  });
});

describe("Hope Summers (40204): gains the traits of your identity; fetches a SUPERPOWER card", () => {
  const traitSet = (s: GameState, id: InstanceId) => new Set(traitsOf(s, id, WAVE7_DEPS) as readonly string[]);

  it("costs 4; the response searches the deck for a SUPERPOWER card, adds it to hand and shuffles", () => {
    const base = stacked(heroGame([DOMINO_HOPE]), []);
    expect(playRefused(base, HOPE, PAYMENT.slice(0, 3))).toBe(true);
    const picked: string[] = [];
    const pick: Picker = (s) => {
      const c = s.pendingChoice;
      if (c?.prompt.kind === "chooseCards") picked.push(...c.options.map((o) => codeOf(s, o.optionId as InstanceId)));
      return accepting([HOPE_RESPONSE], choosing("40041"))(s);
    };
    const { state, events: log } = put(base, HOPE, 4, { pick });
    expect(playCodes(state)).toContain(HOPE);
    expect(handCodes(state)).toContain("40041");
    expect(deckCodes(state)).not.toContain("40041");
    expect(events(log, "deckShuffled").some((e) => e.zone.kind === "deck")).toBe(true);
    // Only SUPERPOWER cards were offered: not Even the Odds (40052) or Domino's Pistol (WEAPON).
    expect(picked.length).toBeGreaterThan(0);
    expect(picked).not.toContain("40052");
    expect(picked).not.toContain(PISTOL);
  });

  it("the response may be declined", () => {
    const base = stacked(heroGame([DOMINO_HOPE]), []);
    const { state } = put(base, HOPE, 4, { pick: firstLegal });
    expect(handCodes(state)).not.toContain("40041");
  });

  it("she gains each trait on Domino's identity (hero form: POSSE and X-FORCE)", () => {
    const { state } = put(stacked(heroGame([DOMINO_HOPE]), []), HOPE, 4);
    const hope = only(state, HOPE);
    const identity = traitSet(state, identityOf(state));
    expect(identity.has("POSSE")).toBe(true);
    expect(traitSet(state, hope).has("POSSE")).toBe(true);
    for (const t of identity) expect(traitSet(state, hope).has(t)).toBe(true);
    // Alter-ego form: she gains the traits of that face instead.
    const alterEgo = withForm(state, "alterEgo");
    for (const t of traitSet(alterEgo, identityOf(alterEgo))) expect(traitSet(alterEgo, hope).has(t)).toBe(true);
  });

  it("as a POSSE character she counts toward The Posse's three", () => {
    const base = stacked(heroGame([DOMINO_HOPE]), [], ["40047", "40048", "40049", "40039", "40038"]);
    const withHope = put(base, HOPE, 4).state;
    const withBear = surge(withHope, ATLAS_BEAR).state;
    expect(playRefused(stacked(withBear, [], ["40047", "40048"]), THE_POSSE, ["40047", "40048"])).toBe(false);
  });

  it("two players: she takes her controller's traits, not the other player's", () => {
    const { state } = put(stacked(heroGame([DOMINO_HOPE, SPIDER_MAN]), []), HOPE, 4);
    const hope = only(state, HOPE);
    for (const t of traitSet(state, identityOf(state, P2))) {
      if (!traitSet(state, identityOf(state, P1)).has(t)) expect(traitSet(state, hope).has(t)).toBe(false);
    }
    expect(traitSet(state, hope).has("POSSE")).toBe(true);
  });

  it("the campaign's Hope Summers 40130 is in play under the first player in a Stryfe game: 40204 cannot enter play (unique, same title)", () => {
    const base = stacked(heroGame([DOMINO_HOPE], "stryfe"), []);
    expect(playCodes(base)).toContain("40130");
    expect(playRefused(stacked(base, [], PAYMENT), HOPE, PAYMENT.slice(0, 4))).toBe(true);
  });

  it("without the campaign's Hope Summers in play (Morlock Siege) 40204 can be played", () => {
    const base = stacked(heroGame([DOMINO_HOPE], "morlock-siege"), []);
    expect(playCodes(base)).not.toContain("40130");
    expect(playRefused(stacked(base, [], PAYMENT), HOPE, PAYMENT.slice(0, 4))).toBe(false);
  });
});
