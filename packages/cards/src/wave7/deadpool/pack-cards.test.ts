import { NEXT_EVOL_CARDS } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  createGame,
  iconsInPlay,
  replay,
  sessionApply,
  startSession,
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
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../testing/staging.js";
import { NEXT_EVOL_PRECON_CABLE_DECK } from "../next_evol/precon-cable-deck.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { DEADPOOL_PACK_CARDS } from "./pack-cards.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The deadpool pack's other 'Pool and basic cards, docs/phase7-wave7.md §7.3: Frenemies 44031, Bob 44043, Negasonic
 * Teenage Warhead 44044, Pandapool 44045, Break Time 44046, Get in Front of Me! 44047, Mulligan 44048, Deadpool Corps
 * Ship 44049, Plot Convenience 44050, Ambush 44051, Bazooka 44052, Blackout 44053, Distraction 44054, Laser Swords
 * 44055, Rock, Paper, Scissors 44056, Tic-Tac-Toe 44057 and War 44058. None is in his starter deck (`deadpool-pool`), so
 * each is added by surgery (`conjure`) to a hand, or put into play. The stage is `wave7Scenario("stryfe")`, hero face
 * (9 hit points): Stryfe's Grasp (a permanent side scheme with a crisis icon) is in the villain area, so that icon is
 * the only encounter icon in play and no threat can be removed from the main scheme; Hope Summers is the one ally.
 * Crisis of Infinite Deadpools 44037 is in the encounter deck of any game seating this deck: no test reveals it.
 */
const FRENEMIES = "44031.frenemies-action";
const BOB = "44043.bob-agent-of-hydra-response";
const NEGASONIC = "44044.negasonic-teenage-warhead-interrupt";
const BREAK = "44046.break-time-action";
const FRONT = "44047.get-in-front-of-me-interrupt";
const MULLIGAN_CONSTANT = "44048.mulligan-constant";
const MULLIGAN = "44048.mulligan-action";
const SHIP = "44049.deadpool-corps-ship-action";
const PLOT = "44050.plot-convenience-action";
const PLOT_CONSTANT = "44050.plot-convenience-constant";
const AMBUSH = "44051.ambush-interrupt";
const BAZOOKA = "44052.bazooka-action";
const BLACKOUT = "44053.blackout-action";
const DISTRACTION = "44054.distraction-constant";
const SWORDS = "44055.laser-swords-constant";
const RPS = "44056.rock-paper-scissors-action";
const TIC_TAC_TOE = "44057.tic-tac-toe-action";
const WAR = "44058.war-action";
const ALL_REFS = [
  FRENEMIES,
  BOB,
  NEGASONIC,
  BREAK,
  FRONT,
  MULLIGAN_CONSTANT,
  MULLIGAN,
  SHIP,
  PLOT,
  PLOT_CONSTANT,
  AMBUSH,
  BAZOOKA,
  BLACKOUT,
  DISTRACTION,
  SWORDS,
  RPS,
  TIC_TAC_TOE,
  WAR,
];

const DEADPOOL = { starterDeckId: "deadpool-pool" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CABLE = { starterDeckId: "cable-leadership" } as const;
type Seat = typeof DEADPOOL | typeof SPIDER_MAN | typeof CABLE;

const DEPS = WAVE7_DEPS;
const MERCENARY = "01101"; // Hydra Mercenary: a minion, ATK 1, 3 hit points, Guard
const BREAKIN = "01107"; // side scheme, hazard icon, threat 3 when staged here
const BOMB_SCARE = "01109"; // side scheme, acceleration icon
const CROWD_CONTROL = "01108"; // side scheme, crisis icon
const ADVANCE = "01186"; // treachery, 0 boost icons: "When Revealed: The villain schemes."
const ASSAULT = "01187"; // treachery, 0 boost icons
const CAUGHT_OFF_GUARD = "01188"; // treachery, 1 boost icon
/** A card of Stryfe's encounter deck that is not a treachery (a minion): revealed, it triggers nothing of Negasonic's. */
const nonTreachery = (s: GameState): string => {
  const inDeck = new Set(
    Object.values(s.encounterDecks).flatMap((d) => d.deck.map((id) => s.instances[id]!.cardId as string)),
  );
  return (NEXT_EVOL_CARDS as readonly { id: string; type: string }[]).find(
    (c) => c.type === "minion" && inDeck.has(c.id),
  )!.id;
};

function setupGame(players: readonly Seat[] = [DEADPOOL], seed = 1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const heroGame = (players?: readonly Seat[], seed = 1): GameState => {
  let s = withForm(setupGame(players, seed), { heroForm: 0 }, P1);
  for (const p of s.players.slice(1)) s = withForm(s, { heroForm: 0 }, p.playerId);
  return s;
};
const alterEgoGame = (players?: readonly Seat[]): GameState => withForm(setupGame(players), "alterEgo");

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const discardCodes = (s: GameState, p = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const damageOn = (s: GameState, p = P1): number => inst(s, identityOf(s, p)).damage;
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const stryfe = (s: GameState): InstanceId => s.activeVillainId!;
const threatOf = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const rejected = (state: GameState, command: Command): boolean => !applyCommand(state, command, DEPS).ok;
const inPlayOf = (s: GameState, code: string): InstanceId[] =>
  Object.values(s.instances)
    .filter((i) => i.cardId === code && (i.home as { kind: string }).kind === "player" && handlessInPlay(s, i))
    .map((i) => i.instanceId);
const handlessInPlay = (s: GameState, i: CardInstance): boolean =>
  !s.players.some(
    (p) => p.hand.includes(i.instanceId) || p.deck.includes(i.instanceId) || p.discard.includes(i.instanceId),
  );

let conjured = 9100;
/** A copy of `code` (not in the starter deck) added to the player's hand by surgery, cloned from one of their own cards. */
function conjure(
  state: GameState,
  player: PlayerId,
  code: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, player);
  const template = inst(state, owner.deck[0]!);
  const id = `i${conjured++}` as InstanceId;
  const instance = {
    ...template,
    instanceId: id,
    cardId: code as never,
    exhausted: false,
    flipped: false,
    attachments: [],
    counters: {},
  };
  return {
    id,
    state: {
      ...state,
      instances: { ...state.instances, [id]: instance },
      players: state.players.map((p) => (p.playerId === player ? { ...p, hand: [...p.hand, id] } : p)),
    },
  };
}
const withoutFromHand = (s: GameState, player: PlayerId, id: InstanceId): GameState => ({
  ...s,
  players: s.players.map((p) => (p.playerId === player ? { ...p, hand: p.hand.filter((x) => x !== id) } : p)),
});
/** An ally or support of `player`'s in their play area, by surgery. */
function inPlayArea(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = conjure(state, player, code);
  const s = withoutFromHand(given.state, player, given.id);
  const placed = patchInstance(s, given.id, {
    home: { kind: "player" } as never,
    controllerId: player,
    ownerId: player,
    faceup: true,
  });
  return {
    id: given.id,
    state: {
      ...placed,
      players: placed.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, given.id] } : p)),
    },
  };
}
/** An upgrade of `player`'s attached to `host` (their identity by default), by surgery: no cost, no windows. */
function attached(
  state: GameState,
  code: string,
  player: PlayerId = P1,
  host?: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = conjure(state, player, code);
  const s = withoutFromHand(given.state, player, given.id);
  const target = host ?? identityOf(state, player);
  const withCard = patchInstance(s, given.id, {
    home: { kind: "player" } as never,
    attachedTo: target,
    controllerId: player,
    ownerId: player,
    faceup: true,
  });
  return {
    id: given.id,
    state: patchInstance(withCard, target, { attachments: [...inst(withCard, target).attachments, given.id] }),
  };
}
let serial = 0;
const blankInstance = (id: InstanceId, code: string, over: Partial<CardInstance>): CardInstance =>
  ({
    instanceId: id,
    cardId: code as never,
    ownerId: null,
    controllerId: null,
    home: { kind: "activeEncounterDeck" },
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
    engagedWith: null,
    flipped: false,
    ...over,
  }) as CardInstance;
/** A side scheme dropped into the villain area by surgery. */
function withScheme(state: GameState, code: string, threat = 3): { state: GameState; id: InstanceId } {
  const id = `i9${++serial}-${code}` as InstanceId;
  return {
    id,
    state: {
      ...state,
      villainArea: [...state.villainArea, id],
      instances: { ...state.instances, [id]: blankInstance(id, code, { threat }) },
    },
  };
}
/** A minion engaged with `player`, by surgery. */
function withMinion(
  state: GameState,
  code: string,
  opts: { player?: PlayerId; damage?: number } = {},
): { state: GameState; id: InstanceId } {
  const player = opts.player ?? P1;
  const id = `i9${++serial}-${code}` as InstanceId;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: blankInstance(id, code, {
          home: { kind: "playArea", playerId: player } as never,
          damage: opts.damage ?? 0,
          engagedWith: player,
        }),
      },
    },
  };
}
/** Takes every side scheme out of the villain area so the main scheme can be thwarted. */
const withoutSideSchemes = (s: GameState, mainThreat = 10): GameState =>
  patchInstance({ ...s, villainArea: [] }, mainOf(s), { threat: mainThreat });

interface Say {
  /** A `chooseOption` label substring, or several (each prompt takes the first listed one it offers). */
  readonly option?: string | readonly string[];
  /** A `chooseNumber` / `reportFact` answer. */
  readonly amount?: number;
  /** For a `chooseTarget` / `chooseCards` prompt by slot: an instance id or a card code, in order of preference. */
  readonly targets?: Readonly<Record<string, string>>;
  /** A trigger ref (substring) to accept at a `chooseTriggers` prompt; others are declined. */
  readonly accept?: string;
  /** How many `chooseTriggers` prompts `accept` is taken at (default: every one). */
  readonly acceptTimes?: number;
  /** Which `declareDefender` prompt (1-based) `defender` answers; the others are declined (default: every one). */
  readonly defenderAt?: number;
  /** At a `declareDefender` prompt, defend with this instance (an id or a code); otherwise decline. */
  readonly defender?: string;
  /** Cards paid at a `payForCard` / `payForAbility` prompt, and at a `spendResources` prompt (hand cards offered, in order). */
  readonly cost?: number;
  /** At a `spendResources` prompt, pay with the first offered card whose code is this. */
  readonly spendWith?: string;
  /** Where to record what each prompt offered. */
  readonly log?: { prompts: { kind: string; slot?: string; options: string[]; labels: string[] }[] };
}
/** A picker for these answers; anything unanswered takes `firstLegal`. */
const says = (say: Say): Picker => {
  let accepted = 0;
  let defenses = 0;
  return (s) => {
    const choice = s.pendingChoice;
    if (!choice) return [];
    const prompt = choice.prompt as { kind: string; slot?: string; cost?: number };
    say.log?.prompts.push({
      kind: prompt.kind,
      ...(prompt.slot ? { slot: prompt.slot } : {}),
      options: choice.options.map((o) => o.optionId),
      labels: choice.options.map((o) => o.label),
    });
    const match = (want: string) =>
      choice.options.find(
        (o) =>
          o.optionId === want ||
          s.instances[o.optionId.replace(/^hand:/, "") as InstanceId]?.cardId === want ||
          o.optionId.replace(/^hand:/, "") === want,
      );
    switch (prompt.kind) {
      case "chooseNumber":
      case "reportFact":
        return say.amount !== undefined ? [String(say.amount)] : firstLegal(s);
      case "chooseOption": {
        const wanted = say.option === undefined ? [] : typeof say.option === "string" ? [say.option] : say.option;
        for (const w of wanted) {
          const hit = choice.options.find((o) => o.label.includes(w));
          if (hit) return [hit.optionId];
        }
        return firstLegal(s);
      }
      case "chooseTarget":
      case "chooseCards": {
        const want = prompt.slot ? say.targets?.[prompt.slot] : undefined;
        const hit = want === undefined ? undefined : match(want);
        return hit ? [hit.optionId] : firstLegal(s);
      }
      case "declareDefender": {
        defenses += 1;
        const mine = say.defenderAt === undefined || say.defenderAt === defenses;
        const hit = say.defender === undefined || !mine ? undefined : match(say.defender);
        return hit ? [hit.optionId] : ["decline"];
      }
      case "payForCard":
      case "payForAbility":
        return choice.options.slice(0, say.cost ?? prompt.cost ?? 0).map((o) => o.optionId);
      case "spendResources": {
        const hit = say.spendWith === undefined ? undefined : match(say.spendWith);
        return hit ? [hit.optionId] : choice.options.slice(0, 1).map((o) => o.optionId);
      }
      case "chooseTriggers": {
        const hit =
          say.accept && accepted < (say.acceptTimes ?? Infinity)
            ? choice.options.find((o) => o.optionId.includes(say.accept!))
            : undefined;
        if (hit) accepted += 1;
        return hit ? [hit.optionId] : [];
      }
      default:
        return firstLegal(s);
    }
  };
};

/** Plays the card `code` (conjured into hand) for `cost` other hand cards, answering prompts with `say`. */
function playCard(state: GameState, code: string, cost: number, say: Say | Picker = {}, player: PlayerId = P1) {
  const pick = typeof say === "function" ? say : says(say);
  const given = conjure(funded(state, cost, player), player, code);
  const paid = payWith(given.state, player, cost, [given.id]);
  const run = driveEventsPicking(DEPS, given.state, pick, play(player, given.id, paid));
  return { ...run, id: given.id, before: given.state };
}
const playRefused = (state: GameState, code: string, cost: number, player: PlayerId = P1): boolean => {
  const given = conjure(funded(state, cost, player), player, code);
  return rejected(given.state, play(player, given.id, payWith(given.state, player, cost, [given.id])));
};
/** Gives `player` at least `n` hand cards (from their deck) that are not conjured. */
function funded(state: GameState, n: number, player: PlayerId = P1): GameState {
  let s = state;
  for (;;) {
    const owner = playerOf(s, player);
    if (owner.hand.length >= n) return s;
    const next = owner.deck.find((id) => !codeOf(s, id).startsWith("4403"));
    if (!next) throw new Error("no card left to pay with");
    s = moveToHand(s, player, codeOf(s, next)).state;
  }
}
/** An Action of an in-play card (or an Action event's own use), the cost paid by the picker where it asks. */
const useAbility = (state: GameState, id: InstanceId, ability: string, say: Say | Picker = {}, player: PlayerId = P1) =>
  driveEventsPicking(DEPS, state, typeof say === "function" ? say : says(say), use(player, id, ability));
const useRefused = (state: GameState, id: InstanceId, ability: string, player: PlayerId = P1): boolean =>
  rejected(state, use(player, id, ability));
/** Every player ends their turn (the villain phase follows), with these encounter cards stacked first. */
const endOfTurn = (state: GameState, pick: Picker, ...stack: readonly string[]) =>
  driveEventsPicking(
    DEPS,
    stack.length ? stackEncounterDeck(state, ...stack) : state,
    pick,
    ...state.players.map((p) => endTurn(p.playerId)),
  );

describe("deadpool pack-cards registry", () => {
  it.each(ALL_REFS)("%s validates", (id) => {
    expect(validateDefinition(DEADPOOL_PACK_CARDS[id]!)).toEqual([]);
  });
  it("holds exactly its eighteen refs; Pandapool 44045 prints Toughness and an icon only (no ref)", () => {
    expect(Object.keys(DEADPOOL_PACK_CARDS).sort()).toEqual([...ALL_REFS].sort());
  });
  it("the stage: one encounter icon in play (Stryfe's Grasp), Hope Summers the one ally", () => {
    const s = heroGame();
    expect(s.villainArea.map((id) => codeOf(s, id))).toContain("40168a");
    expect(damageOn(s)).toBe(0);
  });
});

describe("Frenemies (44031): the box's 40026, aliased", () => {
  it("is the same definition object as 40026's", () => {
    expect(DEADPOOL_PACK_CARDS[FRENEMIES]).toBe(NEXT_EVOL_PRECON_CABLE_DECK["40026.frenemies-action"]);
  });
});

const CABLE_ALLY = "44002";
describe("Frenemies (44031): Team-Up (Cable and Deadpool), from Deadpool's side", () => {
  /** Cable (the ally 44002) in play beside Deadpool's hero face; Grasp gone, one side scheme (3 threat), main 10. */
  function stage(players?: readonly Seat[]) {
    const base = withoutSideSchemes(heroGame(players), 10);
    const cable = inPlayArea(base, CABLE_ALLY);
    const scheme = withScheme(cable.state, BREAKIN, 3);
    return { state: scheme.state, cable: cable.id, scheme: scheme.id };
  }
  const targetsInOrder = (...ids: InstanceId[]): Picker => {
    let next = 0;
    return (s) => {
      const c = s.pendingChoice;
      if (
        c?.prompt.kind === "chooseTarget" &&
        ids[next] !== undefined &&
        c.options.some((o) => o.optionId === ids[next])
      )
        return [ids[next++]!];
      return firstLegal(s);
    };
  };
  it("cannot be played without Cable in play; can be with the Cable ally", () => {
    expect(playRefused(withoutSideSchemes(heroGame()), "44031", 1)).toBe(true);
    expect(playRefused(stage().state, "44031", 1)).toBe(false);
  });
  it("costs 1: 1 damage each to Cable and Deadpool, then 3 threat from a scheme and 3 from a different one", () => {
    const g = stage();
    const r = playCard(g.state, "44031", 1, targetsInOrder(mainOf(g.state), g.scheme));
    expect(damageOn(r.state)).toBe(1);
    expect(inst(r.state, g.cable).damage).toBe(1);
    expect(threatOf(r.state, mainOf(r.state))).toBe(7);
    expect(threatOf(r.state, g.scheme)).toBe(0);
    expect(discardCodes(r.state)).toContain("44031");
  });
  it("the second scheme is a different one: the first choice is not offered again", () => {
    const g = stage();
    const offers: InstanceId[][] = [];
    const spy: Picker = (s) => {
      const c = s.pendingChoice;
      if (c?.prompt.kind === "chooseTarget") offers.push(c.options.map((o) => o.optionId as InstanceId));
      return targetsInOrder(mainOf(g.state), g.scheme)(s);
    };
    playCard(g.state, "44031", 1, spy);
    expect(offers).toHaveLength(2);
    expect(offers[1]).not.toContain(mainOf(g.state));
    expect(offers[1]).toContain(g.scheme);
  });
  it("with Stryfe's Grasp (crisis) in play the main scheme loses nothing", () => {
    const base = heroGame();
    const cable = inPlayArea(base, CABLE_ALLY);
    const side = withScheme(cable.state, BREAKIN, 3);
    const before = threatOf(side.state, mainOf(side.state));
    const r = playCard(side.state, "44031", 1, targetsInOrder(mainOf(side.state), side.id));
    expect(threatOf(r.state, mainOf(r.state))).toBe(before);
    expect(threatOf(r.state, side.id)).toBe(0);
  });
  it("it can defeat Deadpool by its own damage: 8 damage on his hero face is replaced (1 hit point remains)", () => {
    const g = stage();
    const r = playCard(withDamage(g.state, identityOf(g.state), 8), "44031", 1);
    expect(playerOf(r.state, P1).identity.form).toBe("alterEgo");
  });
  it("two players: Deadpool's player plays it with Cable under the other player's control", () => {
    const base = withoutSideSchemes(heroGame([DEADPOOL, SPIDER_MAN]), 10);
    const cable = inPlayArea(base, CABLE_ALLY, P2);
    const r = playCard(cable.state, "44031", 1);
    expect(inst(r.state, cable.id).damage).toBe(1);
    expect(damageOn(r.state)).toBe(1);
    expect(damageOn(r.state, P2)).toBe(0);
  });
});

describe("Bob, Agent of Hydra (44043): Response after he enters play, 2 damage to an enemy or 1 threat off a scheme", () => {
  it("costs 2; accepting, the damage option puts 2 damage on the chosen enemy", () => {
    const base = withMinion(heroGame(), MERCENARY);
    const log: Say["log"] = { prompts: [] };
    const r = playCard(base.state, "44043", 2, { accept: "44043", option: "Deal 2", targets: { enemy: base.id }, log });
    expect(inst(r.state, base.id).damage).toBe(2);
    expect(inPlayOf(r.state, "44043")).toHaveLength(1);
    // Both options were offered.
    const offered = log.prompts.find((p) => p.kind === "chooseOption");
    expect(offered?.labels).toEqual(["Deal 2 damage to an enemy", "Remove 1 threat from a scheme"]);
  });
  it("the removal option takes 1 threat from the chosen scheme (not a thwart: no Bob THW needed)", () => {
    const base = withScheme(heroGame(), BREAKIN, 3);
    const r = playCard(base.state, "44043", 2, { accept: "44043", option: "Remove 1", targets: { scheme: base.id } });
    expect(threatOf(r.state, base.id)).toBe(2);
  });
  it("the removal cannot take threat off the main scheme while Stryfe's Grasp (crisis) is in play", () => {
    const base = heroGame();
    const before = threatOf(base, mainOf(base));
    const r = playCard(base, "44043", 2, { accept: "44043", option: "Remove 1", targets: { scheme: mainOf(base) } });
    expect(threatOf(r.state, mainOf(r.state))).toBe(before);
  });
  it("without the Grasp the main scheme loses 1", () => {
    const base = withoutSideSchemes(heroGame(), 10);
    const r = playCard(base, "44043", 2, { accept: "44043", option: "Remove 1", targets: { scheme: mainOf(base) } });
    expect(threatOf(r.state, mainOf(r.state))).toBe(9);
  });
  it("declined, nothing happens and Bob is in play anyway", () => {
    const base = withMinion(heroGame(), MERCENARY);
    const r = playCard(base.state, "44043", 2, {});
    expect(inst(r.state, base.id).damage).toBe(0);
    expect(inPlayOf(r.state, "44043")).toHaveLength(1);
  });
  it("prints an acceleration icon (data): it counts as one in play", () => {
    const base = heroGame();
    const placed = inPlayArea(base, "44043");
    expect(iconsInPlay(placed.state, DEPS, "acceleration")).toBe(iconsInPlay(base, DEPS, "acceleration") + 1);
  });
  it("two players: the damage may go to a minion engaged with the other player", () => {
    const base = withMinion(heroGame([DEADPOOL, SPIDER_MAN]), MERCENARY, { player: P2 });
    const r = playCard(base.state, "44043", 2, { accept: "44043", option: "Deal 2", targets: { enemy: base.id } });
    expect(inst(r.state, base.id).damage).toBe(2);
  });
});

describe("Negasonic Teenage Warhead (44044): Interrupt, 2 damage to her cancels a treachery's When Revealed", () => {
  // Her hazard icon (data) deals the player 1 more encounter card, so two are revealed: she is accepted for the first only.
  const reveal = (state: GameState, accept: boolean) =>
    endOfTurn(state, says(accept ? { accept: "44044", acceptTimes: 1 } : {}), ASSAULT, ADVANCE, ADVANCE);
  it("accepted: she takes 2 damage, the treachery is discarded and its effect (the villain schemes) does not resolve", () => {
    const g = inPlayArea(heroGame(), "44044");
    const yes = reveal(g.state, true);
    const no = reveal(g.state, false);
    expect(inst(yes.state, g.id).damage).toBe(2);
    expect(inst(no.state, g.id).damage).toBe(0);
    expect(threatOf(yes.state, mainOf(yes.state))).toBeLessThan(threatOf(no.state, mainOf(no.state)));
    const discarded = Object.values(yes.state.encounterDecks).flatMap((d) => d.discard);
    expect(discarded.some((id) => codeOf(yes.state, id) === ADVANCE)).toBe(true);
  });
  it("her hazard icon is data: it counts as one in play", () => {
    const base = heroGame();
    const g = inPlayArea(base, "44044");
    expect(iconsInPlay(g.state, DEPS, "hazard")).toBe(iconsInPlay(base, DEPS, "hazard") + 1);
  });
  it("paying the cost can defeat her: at 2 damage the other 2 defeat her (she goes to her owner's discard pile)", () => {
    const g = inPlayArea(heroGame(), "44044");
    const hurt = patchInstance(g.state, g.id, { damage: 2 });
    const r = reveal(hurt, true);
    expect(inPlayOf(r.state, "44044")).toHaveLength(0);
    expect(discardCodes(r.state)).toContain("44044");
  });
  it("is not offered when the revealed card is not a treachery", () => {
    const g = inPlayArea(heroGame(), "44044");
    const log: Say["log"] = { prompts: [] };
    endOfTurn(g.state, says({ accept: "44044", log }), ASSAULT, nonTreachery(g.state), ADVANCE);
    // Offered once: for the treachery (Advance), not for the minion revealed before it.
    expect(
      log.prompts.filter((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes("44044"))),
    ).toHaveLength(1);
  });
  it("two players: she cancels the treachery dealt to the other player", () => {
    const g = inPlayArea(heroGame([DEADPOOL, SPIDER_MAN]), "44044");
    let offered = 0;
    const picks = says({ accept: "44044" });
    const pick: Picker = (s) => {
      const c = s.pendingChoice;
      if (c?.prompt.kind === "chooseTriggers" && c.options.some((o) => o.optionId.includes("44044"))) {
        offered += 1;
        if (offered === 1) return [];
      }
      return picks(s);
    };
    const r = driveEventsPicking(
      DEPS,
      stackEncounterDeck(g.state, ASSAULT, ASSAULT, ADVANCE, ADVANCE),
      pick,
      endTurn(P1),
      endTurn(P2),
    );
    expect(offered).toBeGreaterThanOrEqual(2);
    expect(inst(r.state, g.id).damage).toBe(2);
  });
});

describe("Pandapool (44045): Toughness and a hazard icon, no ability ref", () => {
  it("has no ability in the registry and enters play with a tough status", () => {
    expect(Object.keys(DEADPOOL_PACK_CARDS).some((id) => id.startsWith("44045"))).toBe(false);
    const r = playCard(heroGame(), "44045", 4);
    const [id] = inPlayOf(r.state, "44045");
    expect(inst(r.state, id!).statuses.tough).toBe(1);
  });
});

describe("Break Time (44046): Alter-Ego Action, report the minutes away, heal each identity by that many", () => {
  const breakTime = (state: GameState, minutes: number, player: PlayerId = P1, cost = 3) =>
    playCard(state, "44046", cost, { amount: minutes }, player);
  const hurt = (s: GameState, p: PlayerId, n: number) => withDamage(s, identityOf(s, p), n);

  it("costs 3 per player: one player pays 3 (2 cards are refused)", () => {
    const base = alterEgoGame();
    expect(playRefused(base, "44046", 2)).toBe(true);
    expect(playRefused(base, "44046", 3)).toBe(false);
  });
  it("two players pay 6: 5 cards are refused", () => {
    const base = withForm(alterEgoGame([DEADPOOL, SPIDER_MAN]), "alterEgo", P2);
    expect(playRefused(base, "44046", 5)).toBe(true);
    expect(playRefused(base, "44046", 6)).toBe(false);
  });
  it("3 minutes heal 3 damage: 5 damage becomes 2, and the card is discarded", () => {
    const r = breakTime(hurt(alterEgoGame(), P1, 5), 3);
    expect(damageOn(r.state)).toBe(2);
    expect(discardCodes(r.state)).toContain("44046");
  });
  it("0 minutes heal nothing, and the card was still played (spent)", () => {
    const r = breakTime(hurt(alterEgoGame(), P1, 5), 0);
    expect(damageOn(r.state)).toBe(5);
    expect(discardCodes(r.state)).toContain("44046");
  });
  it("a large number (100000) heals every damage and no more: the healing stops at 0", () => {
    const r = breakTime(hurt(alterEgoGame(), P1, 5), 100000);
    expect(damageOn(r.state)).toBe(0);
  });
  it("it asks the player who played it, once, for a whole number: the prompt has no options", () => {
    const log: Say["log"] = { prompts: [] };
    playCard(hurt(alterEgoGame(), P1, 5), "44046", 3, { amount: 1, log });
    const asked = log.prompts.filter((p) => p.kind === "reportFact");
    expect(asked).toHaveLength(1);
    expect(asked[0]!.options).toEqual([]);
  });
  it("two players: each identity heals, the other player's included (P1 8 to 5, P2 4 to 1 for 3 minutes)", () => {
    const base = hurt(hurt(withForm(alterEgoGame([DEADPOOL, SPIDER_MAN]), "alterEgo", P2), P1, 8), P2, 4);
    const r = breakTime(base, 3, P1, 6);
    expect(damageOn(r.state, P1)).toBe(5);
    expect(damageOn(r.state, P2)).toBe(1);
  });
  it("two players: the player who plays it reports (P2 plays it in P1's turn: the prompt is P2's)", () => {
    const base = withForm(alterEgoGame([DEADPOOL, SPIDER_MAN]), "alterEgo", P2);
    const given = conjure(funded(base, 6, P2), P2, "44046");
    let asked: PlayerId | null = null;
    const pick: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "reportFact") {
        asked = s.pendingChoice.playerId;
        return ["2"];
      }
      return firstLegal(s);
    };
    driveEventsPicking(DEPS, given.state, pick, play(P2, given.id, payWith(given.state, P2, 6, [given.id])));
    expect(asked).toBe(P2);
  });
  it("it is an Alter-Ego Action: in hero form it cannot be played", () => {
    expect(playRefused(heroGame(), "44046", 3)).toBe(true);
  });
  it("the reported number is a recorded answer: replaying the log reproduces the game", () => {
    const base = hurt(alterEgoGame(), P1, 6);
    const given = conjure(funded(base, 3), P1, "44046");
    let session = startSession(given.state);
    const apply = (command: Command) => {
      const result = sessionApply(session, command, DEPS);
      if (!result.ok) throw new Error(result.error.message);
      session = result.session;
    };
    apply(play(P1, given.id, payWith(given.state, P1, 3, [given.id])));
    while (session.state.pendingChoice) {
      const choice = session.state.pendingChoice;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.prompt.kind === "reportFact" ? ["4"] : firstLegal(session.state),
      });
    }
    expect(damageOn(session.state)).toBe(2);
    const replayed = replay(session.log, DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(session.state);
    expect(JSON.stringify(session.log.commands)).toContain('"selectedOptionIds":["4"]');
  });
});

describe("Get in Front of Me! (44047): Hero Interrupt, cancel a treachery, the villain attacks you, draw if another defends", () => {
  /** P1's turn ends; the revealed treachery is the first card dealt (a filler is the boost of Stryfe's activation). */
  const reveal = (state: GameState, say: Say, revealed = ADVANCE, players = 1) =>
    endOfTurn(
      state,
      says({ accept: "44047", acceptTimes: 1, cost: 1, ...say }),
      ...Array.from({ length: players }, () => ASSAULT),
      revealed,
    );
  const attacksBy = (run: { events: readonly GameEvent[] }, who: InstanceId) =>
    run.events.filter(
      (e) =>
        e.type === "triggerEvent" &&
        e.phase === "initiated" &&
        e.event.kind === "enemyAttack" &&
        e.event.enemyInstanceId === who,
    ).length;
  const withCard = (state: GameState) => {
    const g = conjure(funded(state, 2), P1, "44047");
    return g;
  };

  it("cancels the treachery (the villain does not scheme) and Stryfe attacks the player instead; the card is discarded", () => {
    const g = withCard(heroGame());
    const yes = reveal(g.state, {});
    const no = endOfTurn(g.state, says({}), ASSAULT, ADVANCE);
    expect(discardCodes(yes.state)).toContain("44047");
    expect(threatOf(yes.state, mainOf(yes.state))).toBeLessThan(threatOf(no.state, mainOf(no.state)));
    expect(attacksBy(yes, stryfe(g.state))).toBe(attacksBy(no, stryfe(g.state)) + 1);
  });
  /** Cards `player` drew after the forced attack resolved, until the cancelled card's reveal ended: the interrupt's own draw. */
  const drawnBy = (run: { events: readonly GameEvent[] }, player: PlayerId) => {
    const cancelled = run.events.findIndex((e) => e.type === "revealCancelled");
    if (cancelled < 0) return 0;
    const rest = run.events.slice(cancelled);
    const from = rest.findIndex(
      (e) => e.type === "triggerEvent" && e.event.kind === "enemyAttack" && e.phase === "resolved",
    );
    const tail = rest.slice(from);
    const to = tail.findIndex(
      (e) => e.type === "triggerEvent" && e.event.kind === "cardRevealed" && e.phase === "resolved",
    );
    return tail.slice(0, to).filter((e) => e.type === "cardDrawn" && e.playerId === player).length;
  };
  it("undefended, no card is drawn for it: the same number as when the card is not played at all", () => {
    const g = withCard(heroGame());
    const yes = reveal(g.state, {});
    const no = endOfTurn(g.state, says({}), ASSAULT, ADVANCE);
    expect(drawnBy(yes, P1)).toBe(drawnBy(no, P1));
  });
  it("an ally defends: draw 1 card", () => {
    // Not Hope Summers: if she leaves play the players lose the game. Pandapool (4 hit points, Toughness) defends.
    const ally = inPlayArea(heroGame(), "44045");
    const g = withCard(ally.state);
    const undefended = reveal(g.state, {});
    const defended = reveal(g.state, { defender: ally.id, defenderAt: 2 });
    expect(drawnBy(defended, P1)).toBe(drawnBy(undefended, P1) + 1);
  });
  it("his own hero defending (a basic defense) draws nothing", () => {
    const g = withCard(heroGame());
    const undefended = reveal(g.state, {});
    const own = reveal(g.state, { defender: identityOf(g.state), defenderAt: 2 });
    expect(drawnBy(own, P1)).toBe(drawnBy(undefended, P1));
  });
  it("is a Hero Interrupt: as Wade Wilson it is not offered", () => {
    const g = withCard(alterEgoGame());
    const log: Say["log"] = { prompts: [] };
    endOfTurn(g.state, says({ accept: "44047", cost: 1, log }), ASSAULT, ADVANCE);
    expect(log.prompts.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes("44047")))).toBe(
      false,
    );
  });
  it("costs 1: played for nothing it is refused at the prompt (declined with no payment: not played)", () => {
    const g = withCard(heroGame());
    const r = reveal(g.state, { cost: 0 });
    expect(playerOf(r.state, P1).hand).toContain(g.id);
  });
  it("two players: another player's hero defends and Deadpool's player draws", () => {
    const g = withCard(heroGame([DEADPOOL, SPIDER_MAN]));
    const log: Say["log"] = { prompts: [] };
    // Stryfe attacks each player in turn (two prompts), then the interrupt's attack is the third.
    const base = reveal(g.state, { log }, ADVANCE, 2);
    const offered = log.prompts.find((p) => p.kind === "declareDefender");
    expect(offered).toBeDefined();
    const other = identityOf(g.state, P2);
    if (offered!.options.includes(other)) {
      const r = reveal(g.state, { defender: other, defenderAt: 3 }, ADVANCE, 2);
      expect(drawnBy(r, P1)).toBe(drawnBy(base, P1) + 1);
    } else {
      // The other hero is not a legal defender of this attack: only allies draw.
      expect(offered!.options).not.toContain(other);
    }
  });
});

describe("Mulligan (44048): cannot be played after another card this phase; Action: discard your hand, draw up to hand size", () => {
  it("costs 3; its Action discards the rest of the hand and draws up to hand size 5 (hero), the old hand all in the discard pile", () => {
    const base = funded(heroGame(), 6);
    const before = playerOf(base, P1).hand;
    const r = playCard(base, "44048", 3);
    const owner = playerOf(r.state, P1);
    expect(owner.hand).toHaveLength(5);
    // The 3 cards that paid and the remaining ones are all in the discard pile; none of the old hand is still held.
    for (const id of before) expect(owner.hand).not.toContain(id);
    for (const id of before) expect(owner.discard).toContain(id);
    expect(owner.discard).toContain(r.id);
  });
  it("hand size 6 as Wade Wilson: draws up to 6", () => {
    const r = playCard(funded(alterEgoGame(), 6), "44048", 3);
    expect(playerOf(r.state, P1).hand).toHaveLength(6);
  });
  it("cost 3: 2 cards are refused", () => {
    expect(playRefused(heroGame(), "44048", 2)).toBe(true);
  });
  it("refused after another card was played this turn (a 4-cost ally), allowed before", () => {
    const base = heroGame();
    expect(playRefused(base, "44048", 3)).toBe(false);
    const played = playCard(base, "44045", 4);
    expect(playRefused(played.state, "44048", 3)).toBe(true);
  });
  it("it is not another card when it is the first: playing Mulligan itself does not stop a second Mulligan this turn", () => {
    // Mulligan 44048 x3 per deck: the second sees the first as another card played this phase.
    const first = playCard(funded(heroGame(), 9), "44048", 3);
    expect(playRefused(first.state, "44048", 3)).toBe(true);
  });
  it("two players: a card the other player played does not stop it (P2 plays Mulligan in P1's turn, then P1 may too)", () => {
    const base = funded(funded(heroGame([DEADPOOL, SPIDER_MAN]), 6, P2), 6, P1);
    const p2 = playCard(withForm(base, "alterEgo", P2), "44048", 3, {}, P2);
    // P2 in alter-ego form draws up to 6, and the Action was playable off-turn.
    expect(playerOf(p2.state, P2).hand).toHaveLength(6);
    expect(playRefused(p2.state, "44048", 3, P1)).toBe(false);
  });
  it("two players: it is the player's own plays that count (P1 played a card, P2 may still play it)", () => {
    const base = heroGame([DEADPOOL, SPIDER_MAN]);
    const played = playCard(base, "44045", 4, {}, P1);
    expect(playRefused(played.state, "44048", 3, P2)).toBe(false);
    expect(playRefused(played.state, "44048", 3, P1)).toBe(true);
  });
  it("a card played in an earlier turn of the same player phase stops it (the phase outlasts the turn)", () => {
    const base = heroGame([DEADPOOL, SPIDER_MAN]);
    const played = playCard(base, "44045", 4, {}, P1);
    const turned = driveEventsPicking(DEPS, played.state, firstLegal, endTurn(P1));
    expect(turned.state.step.phase).toBe("player");
    expect(playRefused(turned.state, "44048", 3, P1)).toBe(true);
  });
});

describe("Deadpool Corps Ship (44049): Action, exhaust it and deal yourself 1 facedown encounter card to put a 'Pool ally into play", () => {
  const dealtOf = (s: GameState, p = P1) => playerOf(s, p).dealtEncounter.length;
  const stage = (players?: readonly Seat[], ally = "44045") => {
    const ship = inPlayArea(heroGame(players), "44049");
    const hand = conjure(ship.state, P1, ally);
    return { state: hand.state, ship: ship.id, ally: hand.id };
  };
  it("puts the 'Pool ally from hand into play without paying its cost (Pandapool, cost 4), exhausts the ship, deals 1 facedown card", () => {
    const g = stage();
    const r = useAbility(g.state, g.ship, SHIP);
    expect(playerOf(r.state, P1).playArea).toContain(g.ally);
    expect(playerOf(r.state, P1).hand).not.toContain(g.ally);
    expect(inst(r.state, g.ship).exhausted).toBe(true);
    expect(dealtOf(r.state)).toBe(dealtOf(g.state) + 1);
  });
  it("the ally is chosen among the 'Pool allies in hand only: with a basic ally and a 'Pool ally in hand, only the second is offered", () => {
    const g = stage();
    const basic = conjure(g.state, P1, "40204");
    const log: Say["log"] = { prompts: [] };
    useAbility(basic.state, g.ship, SHIP, { log });
    const offered = log.prompts.find((p) => p.kind === "chooseCards");
    expect(offered?.options).toEqual([g.ally]);
  });
  it("cannot be started with no 'Pool ally in hand (a basic ally only): nothing is exhausted and no card is dealt", () => {
    const ship = inPlayArea(heroGame(), "44049");
    const g = conjure(ship.state, P1, "40204");
    expect(useRefused(g.state, ship.id, SHIP)).toBe(true);
  });
  it("cannot be started while exhausted", () => {
    const g = stage();
    expect(useRefused(patchInstance(g.state, g.ship, { exhausted: true }), g.ship, SHIP)).toBe(true);
  });
  it("the ally's own Response happens as it enters play: Bob deals 2 damage to a minion", () => {
    const g = stage(undefined, "44043");
    const minion = withMinion(g.state, MERCENARY);
    const r = useAbility(minion.state, g.ship, SHIP, {
      accept: "44043",
      option: "Deal 2",
      targets: { enemy: minion.id },
    });
    expect(inst(r.state, minion.id).damage).toBe(2);
  });
  it("it works in alter-ego form (the Action has no form)", () => {
    const ship = inPlayArea(alterEgoGame(), "44049");
    const g = conjure(ship.state, P1, "44045");
    const r = useAbility(g.state, ship.id, SHIP);
    expect(playerOf(r.state, P1).playArea).toContain(g.id);
  });
  it("two players: the card is dealt to the controller of the ship, not to the other player", () => {
    const g = stage([DEADPOOL, SPIDER_MAN]);
    const r = useAbility(g.state, g.ship, SHIP);
    expect(dealtOf(r.state, P1)).toBe(dealtOf(g.state, P1) + 1);
    expect(dealtOf(r.state, P2)).toBe(dealtOf(g.state, P2));
  });
});

describe("Plot Convenience (44050): any player may attach an aspect card from hand facedown here (max 3) or take one into hand", () => {
  const POOL_EVENT = "44017"; // Barely a Scratch: a 'Pool card, so an aspect card (spec 3.73)
  const BASIC_EVENT = "44031"; // Frenemies: a basic card, not an aspect card
  const hereOf = (s: GameState, ship: InstanceId) => inst(s, ship).attachments;
  const stage = (players?: readonly Seat[]) => inPlayArea(heroGame(players), "44050");
  /** A card of `owner` (an event by code) attached facedown to the support by surgery. */
  function bank(state: GameState, ship: InstanceId, code: string, owner: PlayerId = P1) {
    const given = conjure(state, owner, code);
    const s = withoutFromHand(given.state, owner, given.id);
    const placed = patchInstance(s, given.id, {
      attachedTo: ship,
      faceup: false,
      facedownAs: { kind: "blank", traits: [] } as never,
      home: { kind: "player" } as never,
    });
    return {
      id: given.id,
      state: patchInstance(placed, ship, { attachments: [...inst(placed, ship).attachments, given.id] }),
    };
  }
  const attach = (state: GameState, ship: InstanceId, say: Say = {}, player: PlayerId = P1) =>
    useAbility(state, ship, PLOT, { option: "Attach", ...say }, player);
  const take = (state: GameState, ship: InstanceId, say: Say = {}, player: PlayerId = P1) =>
    useAbility(state, ship, PLOT, { option: "Add 1", ...say }, player);

  it("attaches the chosen aspect card from hand facedown and exhausts the support", () => {
    const g = stage();
    const card = conjure(g.state, P1, POOL_EVENT);
    const r = attach(card.state, g.id, { targets: { card: card.id } });
    expect(hereOf(r.state, g.id)).toContain(card.id);
    expect(inst(r.state, card.id).faceup).toBe(false);
    expect(playerOf(r.state, P1).hand).not.toContain(card.id);
    expect(inst(r.state, g.id).exhausted).toBe(true);
  });
  it("only aspect cards are offered: a basic card in hand (Frenemies) is not", () => {
    const g = stage();
    const a = conjure(g.state, P1, BASIC_EVENT);
    const b = conjure(a.state, P1, POOL_EVENT);
    const log: Say["log"] = { prompts: [] };
    attach(b.state, g.id, { log });
    const offered = log.prompts.find((p) => p.kind === "chooseCards");
    expect(offered?.options).toContain(b.id);
    expect(offered?.options).not.toContain(a.id);
  });
  it("to a maximum of 3: with 3 attached, only taking one is offered", () => {
    let s = stage();
    const ship = s.id;
    let state = s.state;
    for (let i = 0; i < 3; i++) state = bank(state, ship, POOL_EVENT).state;
    const hand = conjure(state, P1, POOL_EVENT);
    const log: Say["log"] = { prompts: [] };
    const r = useAbility(hand.state, ship, PLOT, { log });
    // The attach option is not offered (a lone option is taken without asking): one card came back, none went on.
    expect(log.prompts.some((p) => p.kind === "chooseOption" && p.labels.some((l) => l.startsWith("Attach")))).toBe(
      false,
    );
    expect(hereOf(r.state, ship)).toHaveLength(2);
    expect(playerOf(r.state, P1).hand).toHaveLength(playerOf(hand.state, P1).hand.length + 1);
  });
  it("two attached: a third may still be attached", () => {
    const s = stage();
    let state = s.state;
    for (let i = 0; i < 2; i++) state = bank(state, s.id, POOL_EVENT).state;
    const hand = conjure(state, P1, POOL_EVENT);
    const r = attach(hand.state, s.id, { targets: { card: hand.id } });
    expect(hereOf(r.state, s.id)).toHaveLength(3);
  });
  it("takes the chosen attached card into hand", () => {
    const s = stage();
    const b = bank(s.state, s.id, POOL_EVENT);
    const r = take(b.state, s.id, { targets: { banked: b.id } });
    expect(playerOf(r.state, P1).hand).toContain(b.id);
    expect(hereOf(r.state, s.id)).not.toContain(b.id);
    expect(inst(r.state, s.id).exhausted).toBe(true);
  });
  it("with nothing attached and no aspect card in hand the Action cannot be started", () => {
    const s = stage();
    const only = conjure(s.state, P1, BASIC_EVENT);
    const bare = {
      ...only.state,
      players: only.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [only.id] } : p)),
    };
    expect(useRefused(bare, s.id, PLOT)).toBe(true);
  });
  it("cannot be used while exhausted", () => {
    const s = stage();
    const b = bank(s.state, s.id, POOL_EVENT);
    expect(useRefused(patchInstance(b.state, s.id, { exhausted: true }), s.id, PLOT)).toBe(true);
  });
  it("its data constant ('Any player may trigger this ability.') is part of the Action: an empty constant", () => {
    expect(DEADPOOL_PACK_CARDS[PLOT_CONSTANT]).toEqual({ trigger: { kind: "constant" }, effects: [] });
  });

  it("two players: the other player attaches a card from their own hand, in the first player's turn", () => {
    const s = stage([DEADPOOL, SPIDER_MAN]);
    const card = conjure(s.state, P2, POOL_EVENT);
    const r = attach(card.state, s.id, { targets: { card: card.id } }, P2);
    expect(hereOf(r.state, s.id)).toContain(card.id);
    expect(playerOf(r.state, P2).hand).not.toContain(card.id);
  });
  it("two players: whether it can start is read for the player triggering it (P1 has no aspect card, P2 has one; and the reverse)", () => {
    const s = stage([DEADPOOL, SPIDER_MAN]);
    const emptied = (st: GameState, p: PlayerId): GameState => ({
      ...st,
      players: st.players.map((x) => (x.playerId === p ? { ...x, hand: [] } : x)),
    });
    const mine = conjure(emptied(emptied(s.state, P1), P2), P2, POOL_EVENT);
    expect(useRefused(mine.state, s.id, PLOT, P2)).toBe(false);
    expect(useRefused(mine.state, s.id, PLOT, P1)).toBe(true);
  });
  it("two players (Q53 = A): the other player takes a card the first player owns into their own hand", () => {
    const s = stage([DEADPOOL, SPIDER_MAN]);
    const b = bank(s.state, s.id, POOL_EVENT, P1);
    const r = take(b.state, s.id, { targets: { banked: b.id } }, P2);
    expect(playerOf(r.state, P2).hand).toContain(b.id);
    expect(playerOf(r.state, P1).hand).not.toContain(b.id);
    expect(hereOf(r.state, s.id)).not.toContain(b.id);
  });
  // RRG 1.8 "Ownership and Control" (p. 31): "That card is discarded from a player's hand, it is placed in its
  // owner's discard pile." The taker holds and may spend the card; it stays its owner's (`takeIntoHand.keepOwner`).
  it("two players (Q53 = A): a card taken that way goes to its owner's discard pile when it is used to pay", () => {
    const s = stage([DEADPOOL, SPIDER_MAN]);
    const b = bank(s.state, s.id, POOL_EVENT, P1);
    const took = take(b.state, s.id, { targets: { banked: b.id } }, P2).state;
    expect(inst(took, b.id).ownerId).toBe(P1);
    expect(inst(took, b.id).controllerId).toBe(P2);
    // P2 pays for their own Mulligan (an Action event, cost 3, playable off-turn) with the borrowed card first.
    const card = conjure(took, P2, "44048");
    const others = playerOf(card.state, P2)
      .hand.filter((id) => id !== card.id && id !== b.id)
      .slice(0, 2);
    const paid = driveEventsPicking(DEPS, card.state, firstLegal, play(P2, card.id, [b.id, ...others]));
    expect(playerOf(paid.state, P1).discard).toContain(b.id);
    expect(playerOf(paid.state, P2).discard).not.toContain(b.id);
    for (const id of others) expect(playerOf(paid.state, P2).discard).toContain(id);
  });
  it("the owner taking their own card back is unchanged: it is theirs, in their hand", () => {
    const s = stage([DEADPOOL, SPIDER_MAN]);
    const b = bank(s.state, s.id, POOL_EVENT, P1);
    const r = take(b.state, s.id, { targets: { banked: b.id } }, P1);
    expect(playerOf(r.state, P1).hand).toContain(b.id);
    expect(inst(r.state, b.id).ownerId).toBe(P1);
    expect(inst(r.state, b.id).controllerId).toBe(P1);
  });
  it("the controller may use it during the other player's turn", () => {
    const s = stage([DEADPOOL, SPIDER_MAN]);
    const card = conjure(s.state, P1, POOL_EVENT);
    const turned = driveEventsPicking(DEPS, card.state, firstLegal, endTurn(P1));
    expect(turned.state.step.phase).toBe("player");
    const r = attach(turned.state, s.id, { targets: { card: card.id } }, P1);
    expect(hereOf(r.state, s.id)).toContain(card.id);
  });
});

const basicThwart = (player: PlayerId, thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const basicAttack = (player: PlayerId, attacker: InstanceId, enemy: InstanceId): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: attacker,
  targetInstanceId: enemy,
});
const SANDMAN = "01102"; // an ELITE minion, 4 hit points, Toughness

describe("Ambush (44051): Interrupt, when the attached side scheme is defeated, discard a non-ELITE minion", () => {
  /** A side scheme with 1 threat and an Ambush attached, a Hydra Mercenary (non-ELITE) and Sandman (ELITE) in play. */
  function stage(players?: readonly Seat[]) {
    const scheme = withScheme(heroGame(players), BREAKIN, 1);
    const ambush = attached(scheme.state, "44051", P1, scheme.id);
    const mercenary = withMinion(ambush.state, MERCENARY);
    const sandman = withMinion(mercenary.state, SANDMAN);
    return { state: sandman.state, scheme: scheme.id, ambush: ambush.id, mercenary: mercenary.id, sandman: sandman.id };
  }
  const defeat = (g: { state: GameState; scheme: InstanceId }, say: Say | Picker, player: PlayerId = P1) =>
    driveEventsPicking(
      DEPS,
      g.state,
      typeof say === "function" ? say : says(say),
      basicThwart(player, identityOf(g.state, player), g.scheme),
    );
  const inPlay = (s: GameState, id: InstanceId): boolean => s.players.some((p) => p.playArea.includes(id));

  it("accepted: the chosen non-ELITE minion is discarded as the scheme is defeated", () => {
    const g = stage();
    const r = defeat(g, { accept: "44051" });
    expect(inPlay(r.state, g.mercenary)).toBe(false);
    expect(inPlay(r.state, g.sandman)).toBe(true);
    expect(g.state.villainArea).toContain(g.scheme);
    expect(r.state.villainArea).not.toContain(g.scheme);
  });
  it("only a non-ELITE minion is a candidate: Sandman (ELITE) is not offered", () => {
    const g = stage();
    const log: Say["log"] = { prompts: [] };
    defeat(g, { accept: "44051", log });
    const offered = log.prompts.find((p) => p.kind === "chooseTarget" && p.slot === "minion");
    expect(offered?.options).toEqual([g.mercenary]);
  });
  it("declined: every minion stays", () => {
    const g = stage();
    const r = defeat(g, {});
    expect(inPlay(r.state, g.mercenary)).toBe(true);
  });
  it("a scheme defeated without Ambush attached costs no minion", () => {
    const g = stage();
    const bare = withScheme(g.state, BOMB_SCARE, 1);
    const r = driveEventsPicking(
      DEPS,
      bare.state,
      says({ accept: "44051" }),
      basicThwart(P1, identityOf(bare.state), bare.id),
    );
    expect(inPlay(r.state, g.mercenary)).toBe(true);
  });
  it("with only an ELITE minion in play it is not offered", () => {
    const g = stage();
    const only = {
      ...g.state,
      players: g.state.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== g.mercenary) })),
    };
    const log: Say["log"] = { prompts: [] };
    defeat({ state: only, scheme: g.scheme }, { accept: "44051", log });
    expect(log.prompts.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes("44051")))).toBe(
      false,
    );
  });
  it("it does nothing while the scheme is not defeated: thwarting 0 of 2 threat leaves the minion", () => {
    const g = stage();
    const bigger = patchInstance(g.state, g.scheme, { threat: 5 });
    const r = driveEventsPicking(
      DEPS,
      bigger,
      says({ accept: "44051" }),
      basicThwart(P1, identityOf(bigger), g.scheme),
    );
    expect(inPlay(r.state, g.mercenary)).toBe(true);
  });
  it("two players: it may discard a minion engaged with the other player, thwarted by the other player", () => {
    const base = stage([DEADPOOL, SPIDER_MAN]);
    const other = withMinion(base.state, MERCENARY, { player: P2 });
    const r = driveEventsPicking(
      DEPS,
      other.state,
      says({ accept: "44051", targets: { minion: other.id } }),
      endTurn(P1),
      basicThwart(P2, identityOf(other.state, P2), base.scheme),
    );
    expect(inPlay(r.state, other.id)).toBe(false);
  });
  it("prints a crisis icon (data): it counts as one in play", () => {
    const base = withScheme(heroGame(), BREAKIN, 1);
    const withIt = attached(base.state, "44051", P1, base.id);
    expect(iconsInPlay(withIt.state, DEPS, "crisis")).toBe(iconsInPlay(base.state, DEPS, "crisis") + 1);
  });
  it("is played onto a side scheme (cost 1), max 1 per side scheme (data): a second copy is refused there", () => {
    const base = withScheme(heroGame(), BREAKIN, 3);
    const first = conjure(funded(base.state, 3), P1, "44051");
    const played = driveEventsPicking(
      DEPS,
      first.state,
      firstLegal,
      play(P1, first.id, payWith(first.state, P1, 1, [first.id]), { attachToInstanceId: base.id }),
    );
    expect(inst(played.state, base.id).attachments).toContain(first.id);
    const second = conjure(played.state, P1, "44051");
    expect(
      rejected(
        second.state,
        play(P1, second.id, payWith(second.state, P1, 1, [second.id]), { attachToInstanceId: base.id }),
      ),
    ).toBe(true);
    // And not onto a hero.
    const loose = conjure(base.state, P1, "44051");
    expect(
      rejected(
        loose.state,
        play(P1, loose.id, payWith(loose.state, P1, 1, [loose.id]), { attachToInstanceId: identityOf(loose.state) }),
      ),
    ).toBe(true);
  });
});

describe("Distraction (44054): the attached non-ELITE minion cannot activate", () => {
  /** Distraction on a Hydra Mercenary engaged with P1; Stryfe's own activation stays. */
  function stage(players?: readonly Seat[], on = MERCENARY) {
    const minion = withMinion(heroGame(players), on);
    const card = attached(minion.state, "44054", P1, minion.id);
    return { state: card.state, minion: minion.id, card: card.id };
  }
  const attacksBy = (run: { events: readonly GameEvent[] }, who: InstanceId) =>
    run.events.filter(
      (e) =>
        e.type === "triggerEvent" &&
        e.phase === "initiated" &&
        e.event.kind === "enemyAttack" &&
        e.event.enemyInstanceId === who,
    ).length;
  const blockedBy = (run: { events: readonly GameEvent[] }, who: InstanceId) =>
    events(run.events, "activationBlocked").filter((e) => e.enemyInstanceId === who).length;

  it("without it the minion attacks in the villain phase; with it, its activation does not begin", () => {
    const g = stage();
    const bare = withMinion(heroGame(), MERCENARY);
    const free = endOfTurn(bare.state, says({}), ASSAULT);
    const held = endOfTurn(g.state, says({}), ASSAULT);
    expect(attacksBy(free, bare.id)).toBe(1);
    expect(attacksBy(held, g.minion)).toBe(0);
    expect(blockedBy(held, g.minion)).toBe(1);
  });
  it("it stays engaged and takes damage as usual, and Stryfe still activates", () => {
    const g = stage();
    const run = driveEventsPicking(DEPS, g.state, says({}), basicAttack(P1, identityOf(g.state), g.minion));
    expect(inst(run.state, g.minion).damage).toBeGreaterThan(0);
    expect(inst(run.state, g.minion).engagedWith).toBe(P1);
    expect(attacksBy(endOfTurn(g.state, says({}), ASSAULT), stryfe(g.state))).toBeGreaterThanOrEqual(1);
  });
  it("another minion without Distraction still activates", () => {
    const g = stage();
    const other = withMinion(g.state, MERCENARY);
    const run = endOfTurn(other.state, says({}), ASSAULT);
    expect(attacksBy(run, other.id)).toBe(1);
    expect(attacksBy(run, g.minion)).toBe(0);
  });
  it("prints a crisis icon (data) and attaches to a non-ELITE minion only (Max 1 per minion)", () => {
    const base = withMinion(heroGame(), MERCENARY);
    const g = conjure(funded(base.state, 3), P1, "44054");
    const pay = (id: InstanceId, st: GameState) => payWith(st, P1, 0, [id]);
    const ok = driveEventsPicking(
      DEPS,
      g.state,
      firstLegal,
      play(P1, g.id, pay(g.id, g.state), { attachToInstanceId: base.id }),
    );
    expect(inst(ok.state, base.id).attachments).toContain(g.id);
    expect(iconsInPlay(ok.state, DEPS, "crisis")).toBe(iconsInPlay(base.state, DEPS, "crisis") + 1);
    const again = conjure(ok.state, P1, "44054");
    expect(rejected(again.state, play(P1, again.id, [], { attachToInstanceId: base.id }))).toBe(true);
    const elite = withMinion(base.state, SANDMAN);
    const e = conjure(elite.state, P1, "44054");
    expect(rejected(e.state, play(P1, e.id, [], { attachToInstanceId: elite.id }))).toBe(true);
  });
  it("two players: it holds back a minion engaged with the other player", () => {
    const minion = withMinion(heroGame([DEADPOOL, SPIDER_MAN]), MERCENARY, { player: P2 });
    const card = attached(minion.state, "44054", P1, minion.id);
    const run = endOfTurn(card.state, says({}), ASSAULT, ASSAULT);
    expect(attacksBy(run, minion.id)).toBe(0);
    expect(blockedBy(run, minion.id)).toBe(1);
  });
});

const NOT_MY_LUCKY_DAY = "40067"; // side scheme with an amplify icon
/** A game with `n` extra encounter icons in play (Stryfe's Grasp, one crisis, stays): hazard, acceleration, amplify, crisis. */
function withIcons(state: GameState, n: number): GameState {
  const schemes = [BREAKIN, BOMB_SCARE, NOT_MY_LUCKY_DAY, CROWD_CONTROL].slice(0, n);
  return schemes.reduce((s, code) => withScheme(s, code, 3).state, state);
}
const iconCount = (s: GameState): number =>
  (["crisis", "acceleration", "hazard"] as const).reduce((n, icon) => n + iconsInPlay(s, DEPS, icon), 0) +
  s.villainArea.filter((id) => codeOf(s, id) === NOT_MY_LUCKY_DAY).length;
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, DEPS)!;

describe("Bazooka (44052): Hero Action (attack), discard it, 1 damage per encounter icon in play, ranged", () => {
  const stage = (players?: readonly Seat[], icons = 0) => {
    const base = withIcons(heroGame(players), icons);
    const g = attached(base, "44052");
    const toughless = patchInstance(g.state, stryfe(g.state), { statuses: { stunned: 0, confused: 0, tough: 0 } });
    return { state: toughless, card: g.id };
  };
  it("with Stryfe's Grasp alone (1 icon) it deals 1 damage to Stryfe, and is discarded", () => {
    const g = stage();
    expect(iconCount(g.state)).toBe(1);
    const r = useAbility(g.state, g.card, BAZOOKA);
    expect(inst(r.state, stryfe(g.state)).damage).toBe(1);
    expect(discardCodes(r.state)).toContain("44052");
    expect(inst(r.state, identityOf(r.state)).attachments).not.toContain(g.card);
  });
  it("counts every kind: crisis, acceleration, amplify and hazard (4 extra + Grasp = 5 damage)", () => {
    const g = stage(undefined, 4);
    expect(iconCount(g.state)).toBe(5);
    const r = useAbility(g.state, g.card, BAZOOKA);
    expect(inst(r.state, stryfe(g.state)).damage).toBe(5);
  });
  it("with no encounter icon in play the attack deals 0 and Bazooka is still discarded", () => {
    const g = stage();
    const clear = { ...g.state, villainArea: [] };
    expect(iconCount(clear)).toBe(0);
    const r = useAbility(clear, g.card, BAZOOKA);
    expect(inst(r.state, stryfe(g.state)).damage).toBe(0);
    expect(discardCodes(r.state)).toContain("44052");
  });
  it("this attack gains ranged (the attack event is ranged)", () => {
    const g = stage();
    const r = useAbility(g.state, g.card, BAZOOKA);
    const attacks = r.events.filter(
      (e) => e.type === "triggerEvent" && e.event.kind === "attack" && e.phase === "initiated",
    );
    expect(attacks).toHaveLength(1);
    expect(
      attacks.every(
        (e) => e.type === "triggerEvent" && e.event.kind === "attack" && (e.event.keywords ?? []).includes("ranged"),
      ),
    ).toBe(true);
  });
  it("it is an attack: Guard applies (a Hydra Mercenary engaged with the hero must be the target)", () => {
    const g = stage();
    const guard = withMinion(g.state, MERCENARY);
    const log: Say["log"] = { prompts: [] };
    const r = useAbility(guard.state, g.card, BAZOOKA, { log });
    expect(inst(r.state, guard.id).damage).toBe(1);
    expect(inst(r.state, stryfe(g.state)).damage).toBe(0);
  });
  it("it is an attack: a stunned hero's attack is cancelled, the stun is spent and the cost (the discard) was paid", () => {
    const g = stage();
    const stunned = patchInstance(g.state, identityOf(g.state), { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const r = useAbility(stunned, g.card, BAZOOKA);
    expect(inst(r.state, stryfe(g.state)).damage).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
    expect(discardCodes(r.state)).toContain("44052");
  });
  it("is a Hero Action: as Wade Wilson it cannot be used", () => {
    const g = stage();
    expect(useRefused(withForm(g.state, "alterEgo"), g.card, BAZOOKA)).toBe(true);
  });
  it("two players: the other player's hero uses its own Bazooka and the icons of the whole table count", () => {
    const base = withIcons(heroGame([DEADPOOL, SPIDER_MAN]), 2);
    const g = attached(base, "44052", P2);
    const toughless = patchInstance(g.state, stryfe(g.state), { statuses: { stunned: 0, confused: 0, tough: 0 } });
    const r = useAbility(toughless, g.id, BAZOOKA, {}, P2);
    expect(inst(r.state, stryfe(g.state)).damage).toBe(3);
  });
  it("Restricted is data: two copies fit the limit of 2, a third is refused", () => {
    const base = heroGame();
    const a = attached(base, "44052");
    const b = attached(a.state, "44052");
    expect(playRefused(a.state, "44052", 2)).toBe(false);
    expect(playRefused(b.state, "44052", 2)).toBe(true);
  });
});

describe("Laser Swords (44055): +1 ATK per encounter icon in play (to +4); counts as 2 restricted cards", () => {
  const swords = (state: GameState, player: PlayerId = P1) => attached(state, "44055", player);
  it("Deadpool's ATK 2 with Grasp's 1 icon: 3", () => {
    const base = heroGame();
    const g = swords(base);
    expect(profile(base, identityOf(base)).atk).toBe(2);
    expect(profile(g.state, identityOf(g.state)).atk).toBe(3);
  });
  it("the amount is live: a second icon (a hazard side scheme) makes it 4, its defeat makes it 3 again", () => {
    const g = swords(heroGame());
    const more = withScheme(g.state, BREAKIN, 3);
    expect(profile(more.state, identityOf(more.state)).atk).toBe(4);
    const gone = { ...more.state, villainArea: more.state.villainArea.filter((id) => id !== more.id) };
    expect(profile(gone, identityOf(gone)).atk).toBe(3);
  });
  it("capped at +4: 5 icons in play give ATK 6, not 7", () => {
    const g = swords(withIcons(heroGame(), 4));
    expect(iconCount(g.state)).toBe(5);
    expect(profile(g.state, identityOf(g.state)).atk).toBe(6);
  });
  it("no icon in play: no bonus", () => {
    const g = swords({ ...heroGame(), villainArea: [] });
    expect(profile(g.state, identityOf(g.state)).atk).toBe(2);
  });
  it("it makes a basic attack deal that ATK: 3 damage to Stryfe with 1 icon", () => {
    const g = swords(heroGame());
    const toughless = patchInstance(g.state, stryfe(g.state), { statuses: { stunned: 0, confused: 0, tough: 0 } });
    const r = driveEventsPicking(DEPS, toughless, says({}), basicAttack(P1, identityOf(toughless), stryfe(toughless)));
    expect(inst(r.state, stryfe(g.state)).damage).toBe(3);
  });
  it("two players: it gives its bonus to its own hero only", () => {
    const g = swords(heroGame([DEADPOOL, SPIDER_MAN]), P2);
    expect(profile(g.state, identityOf(g.state, P1)).atk).toBe(2);
    expect(profile(g.state, identityOf(g.state, P2)).atk).toBe(
      profile(heroGame([DEADPOOL, SPIDER_MAN]), identityOf(g.state, P2)).atk + 1,
    );
  });

  describe("the restricted limit (it counts as 2, Q52 = B: it is not itself a restricted card)", () => {
    const inPlayUpgrade = (s: GameState, id: InstanceId) => inst(s, identityOf(s)).attachments.includes(id);
    it("beside no restricted card it is played and stays (2 of the limit 2)", () => {
      const r = playCard(heroGame(), "44055", 3);
      expect(inPlayUpgrade(r.state, r.id)).toBe(true);
      expect(profile(r.state, identityOf(r.state)).atk).toBe(3);
    });
    it("beside one restricted card (Bazooka) it would make 3 restricted cards: the play is refused, and the Bazooka stays", () => {
      const bazooka = attached(heroGame(), "44052");
      expect(playRefused(bazooka.state, "44055", 3)).toBe(true);
      expect(inPlayUpgrade(bazooka.state, bazooka.id)).toBe(true);
    });
    it("a Bazooka played after Laser Swords is refused: the Swords hold both restricted places", () => {
      const g = swords(heroGame());
      expect(playRefused(g.state, "44052", 2)).toBe(true);
    });
    it("beside a non-restricted upgrade (Blackout) it is played as usual", () => {
      const other = attached(heroGame(), "44053");
      expect(playRefused(other.state, "44055", 3)).toBe(false);
    });
  });
});

/** The hand of `player` is exactly these cards (conjured), so which resources can be spent is known. */
function handOnly(
  state: GameState,
  player: PlayerId,
  ...codes: readonly string[]
): { state: GameState; ids: InstanceId[] } {
  let s: GameState = { ...state, players: state.players.map((p) => (p.playerId === player ? { ...p, hand: [] } : p)) };
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const given = conjure(s, player, code);
    s = given.state;
    ids.push(given.id);
  }
  return { state: s, ids };
}
// Printed resources used: Break Time [energy], Negasonic [mental], Bob [physical], Frenemies [wild].
const ENERGY_CARD = "44046";
const MENTAL_CARD = "44044";
const PHYSICAL_CARD = "44043";
const WILD_CARD = "44031";
const countersOn = (s: GameState, id: InstanceId, type: string): number => inst(s, id).counters[type] ?? 0;

describe("Blackout (44053): Hero Action, spend 1 resource to move 1 threat to an empty space of that type", () => {
  /** Blackout on the hero, a Breakin side scheme with 3 threat; the hand is the given cards. */
  function stage(hand: readonly string[], players?: readonly Seat[], player: PlayerId = P1) {
    const base = withScheme(heroGame(players), BREAKIN, 3);
    const card = attached(base.state, "44053", player);
    const h = handOnly(card.state, player, ...hand);
    return { state: h.state, card: card.id, scheme: base.id, hand: h.ids };
  }
  const use1 = (g: { state: GameState; card: InstanceId; scheme: InstanceId }, say: Say = {}, player: PlayerId = P1) =>
    useAbility(g.state, g.card, BLACKOUT, { targets: { scheme: g.scheme }, ...say }, player);

  it.each([
    ["energy", ENERGY_CARD],
    ["mental", MENTAL_CARD],
    ["physical", PHYSICAL_CARD],
  ])("a %s resource: 1 threat moves from the scheme to the %s space, and the card paid is discarded", (type, code) => {
    const g = stage([code]);
    const r = use1(g, { option: `[${type}]` });
    expect(threatOf(r.state, g.scheme)).toBe(2);
    expect(countersOn(r.state, g.card, type)).toBe(1);
    expect(playerOf(r.state, P1).hand).toHaveLength(0);
    expect(discardCodes(r.state)).toContain(code);
  });
  it("only the types that can be paid are offered: with one [energy] card, only the energy option", () => {
    const g = stage([ENERGY_CARD]);
    const log: Say["log"] = { prompts: [] };
    use1(g, { log });
    expect(log.prompts.find((p) => p.kind === "chooseOption")).toBeUndefined();
    const g2 = stage([ENERGY_CARD, MENTAL_CARD]);
    const log2: Say["log"] = { prompts: [] };
    use1(g2, { log: log2 });
    expect(log2.prompts.find((p) => p.kind === "chooseOption")?.labels).toEqual([
      "Spend an [energy] resource",
      "Spend an [mental] resource",
    ]);
  });
  it("a wild resource is spent as the type its player declares (Q51 = A): the mental space, then the physical one", () => {
    const g = stage([WILD_CARD]);
    const log: Say["log"] = { prompts: [] };
    const asMental = use1(g, { option: "[mental]", log });
    expect(log.prompts.find((p) => p.kind === "chooseOption")?.labels).toHaveLength(3);
    expect(countersOn(asMental.state, g.card, "mental")).toBe(1);
    expect(countersOn(asMental.state, g.card, "energy")).toBe(0);
    const asPhysical = use1(g, { option: "[physical]" });
    expect(countersOn(asPhysical.state, g.card, "physical")).toBe(1);
  });
  it("two spaces per type: a third [energy] is not offered, though it could be paid", () => {
    const g = stage([ENERGY_CARD, MENTAL_CARD]);
    const full = patchInstance(g.state, g.card, { counters: { energy: 2 } });
    const log: Say["log"] = { prompts: [] };
    const r = use1({ ...g, state: full }, { log, spendWith: MENTAL_CARD });
    // Only the mental option was left: taken without asking.
    expect(log.prompts.find((p) => p.kind === "chooseOption")).toBeUndefined();
    expect(countersOn(r.state, g.card, "mental")).toBe(1);
    expect(countersOn(r.state, g.card, "energy")).toBe(2);
  });
  it("it cannot be used with no resource in hand, or with no scheme holding threat", () => {
    expect(useRefused(stage([]).state, stage([]).card, BLACKOUT)).toBe(true);
    const g = stage([ENERGY_CARD]);
    const none = {
      ...g.state,
      instances: Object.fromEntries(Object.entries(g.state.instances).map(([id, i]) => [id, { ...i, threat: 0 }])),
    } as GameState;
    expect(useRefused(none, g.card, BLACKOUT)).toBe(true);
  });
  it("the sixth token ends it: the card is discarded and the villain is confused", () => {
    const g = stage([PHYSICAL_CARD]);
    const nearly = patchInstance(g.state, g.card, { counters: { energy: 2, mental: 2, physical: 1 } });
    const r = use1({ ...g, state: nearly }, { option: "[physical]" });
    expect(discardCodes(r.state)).toContain("44053");
    expect(inst(r.state, identityOf(r.state)).attachments).not.toContain(g.card);
    expect(inst(r.state, stryfe(g.state)).statuses.confused).toBe(1);
    expect(threatOf(r.state, g.scheme)).toBe(2);
  });
  it("a fifth token does not end it", () => {
    const g = stage([PHYSICAL_CARD]);
    const four = patchInstance(g.state, g.card, { counters: { energy: 2, mental: 2 } });
    const r = use1({ ...g, state: four }, { option: "[physical]" });
    expect(inst(r.state, identityOf(r.state)).attachments).toContain(g.card);
    expect(inst(r.state, stryfe(g.state)).statuses.confused).toBe(0);
  });
  it("it is not a thwart: a confused hero can use it, and the threat still moves", () => {
    const g = stage([ENERGY_CARD]);
    const confused = patchInstance(g.state, identityOf(g.state), { statuses: { stunned: 0, confused: 1, tough: 0 } });
    const r = use1({ ...g, state: confused });
    expect(threatOf(r.state, g.scheme)).toBe(2);
    expect(inst(r.state, identityOf(r.state)).statuses.confused).toBe(1);
  });
  it("threat on the main scheme cannot be moved while Stryfe's Grasp (crisis) is in play: it is not offered as a source", () => {
    const g = stage([ENERGY_CARD]);
    const main = patchInstance(g.state, mainOf(g.state), { threat: 5 });
    const log: Say["log"] = { prompts: [] };
    useAbility(main, g.card, BLACKOUT, { log });
    const offered = log.prompts.find((p) => p.kind === "chooseTarget" && p.slot === "scheme");
    expect(offered?.options).not.toContain(mainOf(g.state));
    expect(offered?.options).toContain(g.scheme);
  });
  it("without the Grasp the main scheme is a source and loses the threat", () => {
    const g = stage([ENERGY_CARD]);
    const open = withoutSideSchemes(g.state, 5);
    const r = useAbility(open, g.card, BLACKOUT, { targets: { scheme: mainOf(open) } });
    expect(threatOf(r.state, mainOf(r.state))).toBe(4);
    expect(countersOn(r.state, g.card, "energy")).toBe(1);
  });
  // The opening choice is judged against the effects that follow it, but the spend (a choice) comes between them and
  // counts as a part of the Action of its own (`hasIndependentPart`), so with no valid scheme the Action still starts,
  // asks for the payment and then moves nothing: the resource is lost. No token is placed, and the scheme keeps its threat.
  it.fails("[engine gap] the only threat is on the main scheme under a crisis icon: no source exists, so the Action cannot be started", () => {
    const g = stage([ENERGY_CARD]);
    const quiet = patchInstance(patchInstance(g.state, g.scheme, { threat: 0 }), mainOf(g.state), { threat: 5 });
    const grasp = quiet.villainArea.find((id) => codeOf(quiet, id) === "40168a")!;
    const only = patchInstance(quiet, grasp, { threat: 0 });
    expect(threatOf(only, mainOf(only))).toBe(5);
    expect(useRefused(only, g.card, BLACKOUT)).toBe(true);
  });
  it("in that case nothing moves: no token, the main scheme keeps its threat (the resource is lost)", () => {
    const g = stage([ENERGY_CARD]);
    const quiet = patchInstance(patchInstance(g.state, g.scheme, { threat: 0 }), mainOf(g.state), { threat: 5 });
    const grasp = quiet.villainArea.find((id) => codeOf(quiet, id) === "40168a")!;
    const only = patchInstance(quiet, grasp, { threat: 0 });
    const r = driveEventsPicking(DEPS, only, says({}), use(P1, g.card, BLACKOUT));
    expect(threatOf(r.state, mainOf(r.state))).toBe(5);
    expect(countersOn(r.state, g.card, "energy")).toBe(0);
  });
  it("a scheme defeated by the move (1 threat) still gets its token", () => {
    const g = stage([ENERGY_CARD]);
    const one = patchInstance(g.state, g.scheme, { threat: 1 });
    const r = use1({ ...g, state: one }, {});
    expect(r.state.villainArea).not.toContain(g.scheme);
    expect(countersOn(r.state, g.card, "energy")).toBe(1);
  });
  it("is a Hero Action: as Wade Wilson it cannot be used", () => {
    const g = stage([ENERGY_CARD]);
    expect(useRefused(withForm(g.state, "alterEgo"), g.card, BLACKOUT)).toBe(true);
  });
  it("two players: P2's Blackout is paid from P2's hand and moves threat from a scheme", () => {
    const g = stage([ENERGY_CARD], [DEADPOOL, SPIDER_MAN], P2);
    const r = use1(g, {}, P2);
    expect(threatOf(r.state, g.scheme)).toBe(2);
    expect(countersOn(r.state, g.card, "energy")).toBe(1);
    expect(playerOf(r.state, P2).discard.map((id) => codeOf(r.state, id))).toContain(ENERGY_CARD);
  });
});

describe("Tic-Tac-Toe (44057): Hero Action, spend 1 resource to move 1 damage to an empty space of that row; 3 in a line deals them all", () => {
  const cells = (...names: string[]): Record<string, number> => Object.fromEntries(names.map((n) => [n, 1]));
  /** Tic-Tac-Toe on the hero; the hero has 3 damage; the hand is the given cards; Stryfe has no tough status. */
  function stage(
    hand: readonly string[],
    tokens: readonly string[] = [],
    players?: readonly Seat[],
    player: PlayerId = P1,
  ) {
    const base = heroGame(players);
    const hurt = withDamage(base, identityOf(base, player), 3);
    const card = attached(hurt, "44057", player);
    const marked = patchInstance(card.state, card.id, { counters: cells(...tokens) });
    const quiet = patchInstance(marked, stryfe(marked), { statuses: { stunned: 0, confused: 0, tough: 0 } });
    const h = handOnly(quiet, player, ...hand);
    return { state: h.state, card: card.id, source: identityOf(base, player) };
  }
  const cellsHeld = (s: GameState, id: InstanceId): string[] =>
    Object.entries(inst(s, id).counters)
      .filter(([, n]) => n > 0)
      .map(([k]) => k)
      .sort();
  const run = (
    g: { state: GameState; card: InstanceId; source: InstanceId },
    type: string,
    column: number,
    say: Say = {},
    player: PlayerId = P1,
  ) =>
    useAbility(
      g.state,
      g.card,
      TIC_TAC_TOE,
      { targets: { source: g.source }, option: [`[${type}]`, `Column ${column}`], ...say },
      player,
    );

  it.each([
    ["energy", ENERGY_CARD, "r1c2"],
    ["mental", MENTAL_CARD, "r2c2"],
    ["physical", PHYSICAL_CARD, "r3c2"],
  ])(
    "a %s resource: 1 damage moves off the hero to column 2 of its row (%s), and the card paid is discarded",
    (type, code, space) => {
      const g = stage([code]);
      const r = run(g, type, 2);
      expect(damageOn(r.state)).toBe(2);
      expect(cellsHeld(r.state, g.card)).toEqual([space]);
      expect(discardCodes(r.state)).toContain(code);
    },
  );
  it("the three spaces of a row are columns 1 to 3; a filled column is not offered", () => {
    const g = stage([ENERGY_CARD], ["r1c1"]);
    const log: Say["log"] = { prompts: [] };
    run(g, "energy", 3, { log });
    const columns = log.prompts
      .filter((p) => p.kind === "chooseOption")
      .flatMap((p) => p.labels)
      .filter((l) => l.startsWith("Column"));
    expect(columns).toEqual(["Column 2", "Column 3"]);
  });
  it("a wild resource is spent as the type its player declares (Q51 = A): the physical row", () => {
    const g = stage([WILD_CARD]);
    const r = run(g, "physical", 1);
    expect(cellsHeld(r.state, g.card)).toEqual(["r3c1"]);
  });
  it("it moves the damage: a damaged enemy may be the source (the Mercenary heals 1)", () => {
    const g = stage([MENTAL_CARD]);
    const m = withMinion(g.state, MERCENARY, { damage: 2 });
    const r = useAbility(m.state, g.card, TIC_TAC_TOE, { targets: { source: m.id }, option: ["[mental]", "Column 1"] });
    expect(inst(r.state, m.id).damage).toBe(1);
    expect(damageOn(r.state)).toBe(3);
    expect(cellsHeld(r.state, g.card)).toEqual(["r2c1"]);
  });
  it("it cannot be used with no damaged character, nor with no resource in hand", () => {
    const g = stage([ENERGY_CARD]);
    expect(useRefused(withDamage(g.state, g.source, 0), g.card, TIC_TAC_TOE)).toBe(true);
    expect(useRefused(stage([]).state, stage([]).card, TIC_TAC_TOE)).toBe(true);
  });
  it.each([
    ["a row", ["r1c1", "r1c2", "r2c1"], "energy", 3, ENERGY_CARD],
    ["a column", ["r1c2", "r2c2", "r1c1"], "physical", 2, PHYSICAL_CARD],
    ["the diagonal", ["r1c1", "r2c2", "r2c3"], "physical", 3, PHYSICAL_CARD],
    ["the other diagonal", ["r1c3", "r2c2", "r2c1"], "physical", 1, PHYSICAL_CARD],
  ] as const)(
    "%s completed: all 4 tokens are dealt as damage to the chosen enemy and it is discarded",
    (_name, held, type, column, code) => {
      const g = stage([code], held);
      const r = run(g, type, column, { targets: { source: g.source, enemy: stryfe(g.state) } });
      expect(inst(r.state, stryfe(g.state)).damage).toBe(4);
      expect(discardCodes(r.state)).toContain("44057");
      expect(inst(r.state, identityOf(r.state)).attachments).not.toContain(g.card);
      expect(damageOn(r.state)).toBe(2);
    },
  );
  it("no line yet (r1c1, r2c2 and r1c2 are not in a line): it stays, deals nothing, and keeps its three tokens", () => {
    const g = stage([ENERGY_CARD], ["r1c1", "r2c2"]);
    const r = run(g, "energy", 2);
    expect(inst(r.state, stryfe(g.state)).damage).toBe(0);
    expect(cellsHeld(r.state, g.card)).toEqual(["r1c1", "r1c2", "r2c2"]);
    expect(inst(r.state, identityOf(r.state)).attachments).toContain(g.card);
  });
  it("it can hold six tokens with no line (none of the eight lines is full): the next one then completes row 1", () => {
    const noLine = ["r1c1", "r1c2", "r2c1", "r2c3", "r3c2", "r3c3"];
    const g = stage([ENERGY_CARD], noLine);
    // r1c3 completes row 1 (r1c1, r1c2, r1c3): 7 tokens are dealt.
    const r = run(g, "energy", 3, { targets: { source: g.source, enemy: stryfe(g.state) } });
    expect(inst(r.state, stryfe(g.state)).damage).toBe(7);
  });
  it("it is an effect, not an attack: a stunned hero uses it and the stun stays", () => {
    const g = stage([ENERGY_CARD]);
    const stunned = patchInstance(g.state, g.source, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const r = run({ ...g, state: stunned }, "energy", 1);
    expect(cellsHeld(r.state, g.card)).toEqual(["r1c1"]);
    expect(inst(r.state, g.source).statuses.stunned).toBe(1);
  });
  it("is a Hero Action: as Wade Wilson it cannot be used", () => {
    const g = stage([ENERGY_CARD]);
    expect(useRefused(withForm(g.state, "alterEgo"), g.card, TIC_TAC_TOE)).toBe(true);
  });
  it("two players: P2's card, paid from P2's hand, moves damage off P1's hero", () => {
    const base = stage([ENERGY_CARD], [], [DEADPOOL, SPIDER_MAN], P2);
    const hurt = withDamage(base.state, identityOf(base.state, P1), 2);
    const r = useAbility(
      hurt,
      base.card,
      TIC_TAC_TOE,
      { targets: { source: identityOf(hurt, P1) }, option: ["[energy]", "Column 1"] },
      P2,
    );
    expect(damageOn(r.state, P1)).toBe(1);
    expect(cellsHeld(r.state, base.card)).toEqual(["r1c1"]);
    expect(playerOf(r.state, P2).discard.map((id) => codeOf(r.state, id))).toContain(ENERGY_CARD);
  });
});

/** A copy of `code` conjured onto the top of `player`'s deck. */
function onTopOfDeck(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const given = conjure(state, player, code);
  return {
    id: given.id,
    state: {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === player ? { ...p, hand: p.hand.filter((x) => x !== given.id), deck: [given.id, ...p.deck] } : p,
      ),
    },
  };
}
const JACKPOT = "40043"; // a resource with [energy][mental][physical] on it

describe("Rock, Paper, Scissors (44056): Hero Action, exhaust, choose a hand card, discard the top card; if its resource beats theirs, take it", () => {
  /** RPS on the hero; the hand is exactly `chosen`; `top` is on top of the deck. */
  function stage(chosen: string, top: string, players?: readonly Seat[], player: PlayerId = P1) {
    const base = heroGame(players);
    const card = attached(base, "44056", player);
    const hand = handOnly(card.state, player, chosen);
    const onTop = onTopOfDeck(hand.state, player, top);
    return { state: onTop.state, card: card.id, pick: hand.ids[0]!, top: onTop.id };
  }
  const play1 = (g: { state: GameState; card: InstanceId; pick: InstanceId }, player: PlayerId = P1) =>
    driveEventsPicking(DEPS, g.state, firstLegal, use(player, g.card, RPS, [], { pick: [g.pick] }));

  it.each([
    ["energy", ENERGY_CARD, "mental", MENTAL_CARD],
    ["mental", MENTAL_CARD, "physical", PHYSICAL_CARD],
    ["physical", PHYSICAL_CARD, "energy", ENERGY_CARD],
  ])("[%s] beats [%s]: the discarded card is added to the hand, the chosen one stays", (_a, chosen, _b, top) => {
    const g = stage(chosen, top);
    const r = play1(g);
    expect(playerOf(r.state, P1).hand).toContain(g.top);
    expect(playerOf(r.state, P1).hand).toContain(g.pick);
    expect(playerOf(r.state, P1).discard).not.toContain(g.top);
    expect(inst(r.state, g.card).exhausted).toBe(true);
  });
  it.each([
    ["mental", MENTAL_CARD, "energy", ENERGY_CARD],
    ["physical", PHYSICAL_CARD, "mental", MENTAL_CARD],
    ["energy", ENERGY_CARD, "physical", PHYSICAL_CARD],
  ])(
    "[%s] does not beat [%s] (it is beaten by it): the discarded card stays in the discard pile",
    (_a, chosen, _b, top) => {
      const g = stage(chosen, top);
      const r = play1(g);
      expect(playerOf(r.state, P1).discard).toContain(g.top);
      expect(playerOf(r.state, P1).hand).not.toContain(g.top);
      expect(playerOf(r.state, P1).hand).toEqual([g.pick]);
    },
  );
  it.each([
    ["energy", ENERGY_CARD],
    ["mental", MENTAL_CARD],
    ["physical", PHYSICAL_CARD],
  ])("a same-type tie ([%s] against [%s]) takes nothing", (_a, code) => {
    const g = stage(code, code);
    expect(playerOf(play1(g).state, P1).hand).toEqual([g.pick]);
  });
  it.each([
    ["energy", ENERGY_CARD],
    ["mental", MENTAL_CARD],
    ["physical", PHYSICAL_CARD],
  ])("[wild] beats [%s] (insert FAQ)", (_a, top) => {
    const g = stage(WILD_CARD, top);
    expect(playerOf(play1(g).state, P1).hand).toContain(g.top);
  });
  it.each([
    ["energy", ENERGY_CARD],
    ["mental", MENTAL_CARD],
    ["physical", PHYSICAL_CARD],
    ["wild", WILD_CARD],
  ])("nothing beats [wild]: [%s] against a [wild] card takes nothing", (_a, chosen) => {
    const g = stage(chosen, WILD_CARD);
    expect(playerOf(play1(g).state, P1).hand).toEqual([g.pick]);
  });
  it("a printed resource on the chosen card is enough: Jackpot! ([energy][mental][physical]) beats a lone [energy]", () => {
    const g = stage(JACKPOT, ENERGY_CARD);
    expect(playerOf(play1(g).state, P1).hand).toContain(g.top);
  });
  it("Jackpot! does not beat a [wild] card", () => {
    const g = stage(JACKPOT, WILD_CARD);
    expect(playerOf(play1(g).state, P1).hand).toEqual([g.pick]);
  });
  it("it needs a card in hand to choose: with an empty hand it cannot be used (and no card is discarded)", () => {
    const g = stage(ENERGY_CARD, MENTAL_CARD);
    const empty = { ...g.state, players: g.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [] } : p)) };
    expect(rejected(empty, use(P1, g.card, RPS, [], { pick: [] }))).toBe(true);
    expect(playerOf(empty, P1).deck[0]).toBe(g.top);
  });
  it("it cannot be used while exhausted", () => {
    const g = stage(ENERGY_CARD, MENTAL_CARD);
    const tired = patchInstance(g.state, g.card, { exhausted: true });
    expect(rejected(tired, use(P1, g.card, RPS, [], { pick: [g.pick] }))).toBe(true);
  });
  it("a card that is not in the hand cannot be the chosen card", () => {
    const g = stage(ENERGY_CARD, MENTAL_CARD);
    expect(rejected(g.state, use(P1, g.card, RPS, [], { pick: [g.top] }))).toBe(true);
  });
  it("is a Hero Action: as Wade Wilson it cannot be used", () => {
    const g = stage(ENERGY_CARD, MENTAL_CARD);
    expect(rejected(withForm(g.state, "alterEgo"), use(P1, g.card, RPS, [], { pick: [g.pick] }))).toBe(true);
  });
  it("two players: P2's card compares against P2's own deck and hand", () => {
    const g = stage(PHYSICAL_CARD, ENERGY_CARD, [DEADPOOL, SPIDER_MAN], P2);
    const r = play1(g, P2);
    expect(playerOf(r.state, P2).hand).toContain(g.top);
    expect(playerOf(r.state, P1).hand).not.toContain(g.top);
  });
});

describe("War (44058): Hero Action, exhaust it: discard the top encounter card and take 1 damage per star and boost icon; discard your top card and deal its cost to an enemy", () => {
  const PSYCHIC_OVERRIDE = "40178"; // 1 boost icon and a star icon
  const SHADOW_OF_THE_PAST = "01190"; // 2 boost icons
  /** War on the hero; `encounter` on top of the encounter deck, `top` on top of the hero's deck; Stryfe has no tough status. */
  function stage(encounter: string, top: string, players?: readonly Seat[], player: PlayerId = P1) {
    const base = heroGame(players);
    const card = attached(base, "44058", player);
    const onTop = onTopOfDeck(card.state, player, top);
    const quiet = patchInstance(onTop.state, stryfe(onTop.state), { statuses: { stunned: 0, confused: 0, tough: 0 } });
    return { state: stackEncounterDeck(quiet, encounter), card: card.id, top: onTop.id };
  }
  const war = (g: { state: GameState; card: InstanceId }, say: Say = {}, player: PlayerId = P1) =>
    useAbility(g.state, g.card, WAR, say, player);

  it("0 icons and a 2-cost card (Bob): no damage taken, 2 damage to the enemy; the card is exhausted, the cards discarded", () => {
    const g = stage(ADVANCE, "44043");
    const r = war(g);
    expect(damageOn(r.state)).toBe(0);
    expect(inst(r.state, stryfe(g.state)).damage).toBe(2);
    expect(inst(r.state, g.card).exhausted).toBe(true);
    expect(playerOf(r.state, P1).discard).toContain(g.top);
    const discarded = Object.values(r.state.encounterDecks).flatMap((d) => d.discard);
    expect(discarded.some((id) => codeOf(r.state, id) === ADVANCE)).toBe(true);
  });
  it("it is not a reveal: the discarded treachery's When Revealed does not resolve (Advance: the villain does not scheme)", () => {
    const g = stage(ADVANCE, "44043");
    const r = war(g);
    expect(threatOf(r.state, mainOf(r.state))).toBe(threatOf(g.state, mainOf(g.state)));
  });
  it.each([
    ["1 boost icon", CAUGHT_OFF_GUARD, 1],
    ["2 boost icons", SHADOW_OF_THE_PAST, 2],
    ["1 boost icon and a star icon", PSYCHIC_OVERRIDE, 2],
    ["no icon", ASSAULT, 0],
  ])("%s: the hero takes %i damage", (_name, code, taken) => {
    const g = stage(code, "44043");
    const r = war(g);
    expect(damageOn(r.state)).toBe(taken);
  });
  it.each([
    ["Bob", "44043", 2],
    ["Negasonic Teenage Warhead", "44044", 4],
    ["Frenemies", "44031", 1],
    ["Break Time (3 per player)", "44046", 3],
    ["a resource (no cost)", "44025", 0],
  ])("the top card of the deck is %s: %i damage to the enemy", (_name, code, dealt) => {
    const g = stage(ADVANCE, code);
    const r = war(g);
    expect(inst(r.state, stryfe(g.state)).damage).toBe(dealt);
  });
  it("the enemy is the player's choice: a minion takes the damage and Stryfe none", () => {
    const g = stage(ADVANCE, "44043");
    const m = withMinion(g.state, MERCENARY);
    const r = useAbility(m.state, g.card, WAR, { targets: { enemy: m.id } });
    expect(inst(r.state, m.id).damage).toBe(2);
    expect(inst(r.state, stryfe(g.state)).damage).toBe(0);
  });
  it("the damage the hero takes may defeat him: at 8 damage 1 icon is replaced (Wade Wilson), and the damage to the enemy is still dealt", () => {
    const g = stage(CAUGHT_OFF_GUARD, "44044");
    const dying = withDamage(g.state, identityOf(g.state), 8);
    const r = war({ ...g, state: dying });
    expect(playerOf(r.state, P1).identity.form).toBe("alterEgo");
    expect(inst(r.state, stryfe(g.state)).damage).toBe(4);
  });
  it("it cannot be used while exhausted, nor as Wade Wilson (Hero Action)", () => {
    const g = stage(ADVANCE, "44043");
    expect(useRefused(patchInstance(g.state, g.card, { exhausted: true }), g.card, WAR)).toBe(true);
    expect(useRefused(withForm(g.state, "alterEgo"), g.card, WAR)).toBe(true);
  });
  it("two players: P2's War discards the one encounter deck's top card and hurts P2, with P2's deck card", () => {
    const g = stage(CAUGHT_OFF_GUARD, "44043", [DEADPOOL, SPIDER_MAN], P2);
    const r = war(g, {}, P2);
    expect(damageOn(r.state, P2)).toBe(1);
    expect(damageOn(r.state, P1)).toBe(0);
    expect(inst(r.state, stryfe(g.state)).damage).toBe(2);
    expect(playerOf(r.state, P2).discard).toContain(g.top);
  });
});
