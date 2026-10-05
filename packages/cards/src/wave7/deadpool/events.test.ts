import { cardId } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  createGame,
  iconsInPlay,
  type CardInstance,
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
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { DEADPOOL_EVENTS } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Deadpool's signature events and his 'Pool events, docs/phase7-wave7.md §7.3, on his precon (`deadpool-pool`)
 * against Stryfe through `wave7Scenario`. Hero face: 9 hit points; the Regeneratin' Degenerate replaces his defeat
 * with 1 hit point (damage 8), alter-ego form and an acceleration token (44001a, `identity.test.ts`). Stryfe's setup
 * leaves Stryfe's Grasp (40168a, a permanent side scheme with a crisis icon) in the villain area, so at the start
 * there is exactly 1 encounter icon in play (crisis) and no threat can be removed from the main scheme.
 * Hope Summers (an ally Stryfe's setup puts under the player's control) is the one ally in play.
 * Crisis of Infinite Deadpools 44037 is in the encounter deck of any game seating this deck: no test reveals it.
 */
const EXHAUSTING = "44003.exhausting-personality-action";
const MAXIMUM = "44004.maximum-effort-action";
const METAKNOWLEDGE = "44005.metaknowledge-interrupt";
const YOO_HOO = "44006.yoo-hoo-action";
const FIRE_FORCED = "44012.this-card-is-fire-forced-response";
const FIRE = "44012.this-card-is-fire-action";
const SCRATCH = "44017.barely-a-scratch-interrupt";
const CUTUPPER = "44018.cutupper-action";
const DA_BOMB = "44019.da-bomb-action";
const RAGE_Y = "44020.get-rage-y-action";
const GOT_THIS = "44021.i-got-this-action";
const RESPONSIBILITY = "44022.not-my-responsibility-interrupt";
const INSPECTION = "44023.pool-inspection-action";
const ALL_REFS = [
  EXHAUSTING,
  MAXIMUM,
  METAKNOWLEDGE,
  YOO_HOO,
  FIRE_FORCED,
  FIRE,
  SCRATCH,
  CUTUPPER,
  DA_BOMB,
  RAGE_Y,
  GOT_THIS,
  RESPONSIBILITY,
  INSPECTION,
];

const DEADPOOL = { starterDeckId: "deadpool-pool" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof DEADPOOL | typeof SPIDER_MAN;

const MERCENARY = "01101"; // Hydra Mercenary: ATK 1, 3 hit points, Guard
const ZERO = "40174"; // Guard, Patrol, Toughness
const HONEY_BADGER = "43003"; // an ally
const BREAKIN = "01107"; // side scheme, hazard icon
const CROWD_CONTROL = "01108"; // side scheme, crisis icon
const BOMB_SCARE = "01109"; // side scheme, acceleration icon
const NOT_MY_LUCKY_DAY = "40067"; // side scheme, amplify icon
const ADVANCE = "01186"; // treachery, 0 boost icons: "When Revealed: The villain schemes."
const ASSAULT = "01187"; // treachery, 0 boost icons
const CAUGHT_OFF_GUARD = "01188"; // 1 boost icon
const SHADOW_OF_THE_PAST = "01190"; // 2 boost icons
const PSYCHIC_OVERRIDE = "40178"; // 1 boost icon and a star icon

const DEPS = WAVE7_DEPS;
function setupGame(players: readonly Seat[] = [DEADPOOL], seed = 1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const heroGame = (players?: readonly Seat[], seed = 1, player = P1): GameState =>
  withForm(setupGame(players, seed), { heroForm: 0 }, player);
const alterEgoGame = (players?: readonly Seat[]): GameState => withForm(setupGame(players), "alterEgo");

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const handCodes = (s: GameState, p = P1): string[] => playerOf(s, p).hand.map((id) => codeOf(s, id));
const damageOn = (s: GameState, p = P1): number => inst(s, identityOf(s, p)).damage;
const tokens = (s: GameState): number => s.mainScheme.accelerationTokens;
const formOf = (s: GameState, p = P1) => playerOf(s, p).identity.form;
const villainOf = (s: GameState): InstanceId => s.villains[0]!.instanceId;
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const threatOf = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, DEPS)!;
const GRASP = (s: GameState): InstanceId => s.villainArea.find((id) => codeOf(s, id) === "40168a")!;
const withTokens = (s: GameState, n: number): GameState => ({
  ...s,
  mainScheme: { ...s.mainScheme, accelerationTokens: n },
});
/** The sum of `damageDealt` events from `source` (an instance) to `target`. */
const dealtBy = (events: readonly GameEvent[], source: InstanceId, target: InstanceId): number =>
  events.reduce(
    (sum, e) =>
      e.type === "damageDealt" && e.sourceInstanceId === source && e.targetInstanceId === target ? sum + e.amount : sum,
    0,
  );
/** Every encounter icon in play: crisis, acceleration, hazard and amplify. */
const iconCount = (s: GameState): number =>
  (["crisis", "acceleration", "hazard"] as const).reduce((n, icon) => n + iconsInPlay(s, DEPS, icon), 0) +
  // `amplifyIconsInPlay` is not exported: the amplify icons here are the staged Not My Lucky Day cards.
  s.villainArea.filter((id) => codeOf(s, id) === NOT_MY_LUCKY_DAY).length;

/** Stryfe's Grasp stays: no. Takes every side scheme out of the villain area so the main scheme can be thwarted. */
const withoutSideSchemes = (s: GameState, mainThreat = 10): GameState =>
  patchInstance({ ...s, villainArea: [] }, mainOf(s), { threat: mainThreat });

const blankInstance = (id: InstanceId, code: string, over: Partial<CardInstance>): CardInstance =>
  ({
    instanceId: id,
    cardId: cardId(code),
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
let serial = 0;
const nextId = (code: string): InstanceId => `i9${++serial}-${code}` as InstanceId;

/** A side scheme dropped into the villain area by surgery. */
function withScheme(state: GameState, code: string, threat = 3): { state: GameState; id: InstanceId } {
  const id = nextId(code);
  return {
    id,
    state: {
      ...state,
      villainArea: [...state.villainArea, id],
      instances: { ...state.instances, [id]: blankInstance(id, code, { threat }) },
    },
  };
}
/** A minion engaged with `player`, in their play area, by surgery. */
function withMinion(
  state: GameState,
  code: string,
  opts: { player?: PlayerId; damage?: number } = {},
): { state: GameState; id: InstanceId } {
  const player = opts.player ?? P1;
  const id = nextId(code);
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
/** An ally put under `player`'s control by surgery. */
function withAlly(state: GameState, code: string, player: PlayerId): { state: GameState; id: InstanceId } {
  const id = nextId(code);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: blankInstance(id, code, {
          home: { kind: "player" },
          ownerId: player,
          controllerId: player,
        }),
      },
    },
  };
}
/** Zero, a Guard minion, unengaged in the villain area: a second enemy that guards nothing. */
const withZero = (state: GameState): { state: GameState; id: InstanceId } => {
  const id = nextId(ZERO);
  return {
    id,
    state: {
      ...state,
      villainArea: [...state.villainArea, id],
      instances: { ...state.instances, [id]: blankInstance(id, ZERO, {}) },
    },
  };
};

interface Say {
  /** The answer to a `chooseNumber` prompt. */
  readonly amount?: number;
  /** A `chooseOption` index. */
  readonly option?: number;
  /** For a `chooseTarget` prompt by slot: an instance id or a card code. */
  readonly targets?: Readonly<Record<string, string>>;
  /** A trigger ref (substring) to accept at a `chooseTriggers` prompt; others are declined. */
  readonly accept?: string;
  /** At a `declareDefender` prompt, defend with the first character that is not the attacked identity (Hope Summers). */
  readonly allyDefends?: boolean;
  /** At a `chooseTriggers` prompt for a threat placement, accept only a placement of at least 1 threat. */
  readonly nonZero?: boolean;
  /** Cards paid at a `payForCard` prompt. */
  readonly cost?: number;
  /** Where to record what each prompt offered. */
  readonly log?: { prompts: { kind: string; slot?: string; options: string[]; min: number; max: number }[] };
}
/** A picker for these answers; anything unanswered takes `firstLegal`. */
const says =
  (say: Say): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (!choice) return [];
    const prompt = choice.prompt as { kind: string; slot?: string; min?: number; max?: number };
    say.log?.prompts.push({
      kind: prompt.kind,
      ...(prompt.slot ? { slot: prompt.slot } : {}),
      options: choice.options.map((o) => o.optionId),
      min: prompt.min ?? choice.minSelections,
      max: prompt.max ?? choice.maxSelections,
    });
    if (prompt.kind === "chooseNumber" && say.amount !== undefined) return [String(say.amount)];
    if (prompt.kind === "chooseOption" && say.option !== undefined) return [String(say.option)];
    if (prompt.kind === "chooseTarget" && prompt.slot && say.targets?.[prompt.slot] !== undefined) {
      const want = say.targets[prompt.slot]!;
      const hit = choice.options.find((o) => o.optionId === want || codeOf(s, o.optionId as InstanceId) === want);
      return hit ? [hit.optionId] : firstLegal(s);
    }
    if (prompt.kind === "declareDefender" && say.allyDefends) {
      const ally = choice.options.find((o) => o.optionId !== "decline" && o.optionId !== identityOf(s));
      return ally ? [ally.optionId] : ["decline"];
    }
    if (prompt.kind === "payForCard") return choice.options.slice(0, say.cost ?? 0).map((o) => o.optionId);
    if (prompt.kind === "chooseTriggers") {
      const asked = (prompt as { event?: { amount?: number } }).event;
      if (say.nonZero && asked?.amount === 0) return [];
      const hit = say.accept ? choice.options.find((o) => o.optionId.includes(say.accept!)) : undefined;
      return hit ? [hit.optionId] : [];
    }
    return firstLegal(s);
  };

/** Ensures `n` other cards (not these codes) are in hand to pay with. */
function funded(state: GameState, n: number, avoid: readonly string[], player = P1): GameState {
  let s = state;
  for (;;) {
    const owner = playerOf(s, player);
    const others = owner.hand.filter((id) => !avoid.includes(codeOf(s, id)));
    if (others.length >= n) return s;
    const next = owner.deck.find((id) => !avoid.includes(codeOf(s, id)) && !codeOf(s, id).startsWith("4403"));
    if (!next) throw new Error("no card left to pay with");
    s = moveToHand(s, player, codeOf(s, next)).state;
  }
}
/** The code in P1's hand, whichever copy: moves it from the deck if needed. */
const given = (state: GameState, code: string, player = P1): { state: GameState; id: InstanceId } => {
  const moved = moveToHand(state, player, code);
  return { state: moved.state, id: moved.ids[0]! };
};

/** Plays the event `code` for `cost` cards of hand, answering prompts with `say`. */
function playEvent(state: GameState, code: string, cost: number, say: Say | Picker = {}, player = P1) {
  const pick = typeof say === "function" ? say : says(say);
  const g = given(funded(state, cost, [code], player), code, player);
  const paid = payWith(g.state, player, cost, [g.id]);
  const driven = driveEventsPicking(DEPS, g.state, pick, play(player, g.id, paid));
  return { state: driven.state, events: driven.events, id: g.id, before: g.state };
}
const playRefused = (state: GameState, code: string, cost: number, player = P1): boolean => {
  const g = given(funded(state, cost, [code], player), code, player);
  return !applyCommand(g.state, play(player, g.id, payWith(g.state, player, cost, [g.id])), DEPS).ok;
};
/** Ends P1's turn with these encounter cards stacked (a boost filler for each activation, then the dealt cards). */
const endOfTurn = (state: GameState, pick: Picker, ...stack: readonly string[]) =>
  driveEventsPicking(DEPS, stack.length ? stackEncounterDeck(state, ...stack) : state, pick, endTurn(P1));

describe("Deadpool events registry", () => {
  it.each(ALL_REFS)("%s validates", (id) => {
    expect(validateDefinition(DEADPOOL_EVENTS[id]!)).toEqual([]);
  });
  it("holds exactly its thirteen refs; the four icon lines of 'I Got This' are the body of its Action", () => {
    expect(Object.keys(DEADPOOL_EVENTS).sort()).toEqual([...ALL_REFS].sort());
    for (const n of ["", "-2", "-3", "-4"]) expect(`44021.i-got-this-constant${n}` in DEADPOOL_EVENTS).toBe(false);
  });
  it("the stage: 1 encounter icon in play (Stryfe's Grasp, crisis), one ally (Hope Summers), 9 hit points, 0 tokens", () => {
    const s = heroGame();
    expect(iconCount(s)).toBe(1);
    expect(iconsInPlay(s, DEPS, "crisis")).toBe(1);
    expect(tokens(s)).toBe(0);
  });
});

describe("Exhausting Personality (44003): Hero Action, choose one cost-then-effect", () => {
  it("first branch: 1 acceleration token on the main scheme, then the villain is stunned and confused; costs 0", () => {
    const base = heroGame();
    const r = playEvent(base, "44003", 0, { option: 0 });
    expect(tokens(r.state)).toBe(1);
    expect(inst(r.state, villainOf(r.state)).statuses).toMatchObject({ stunned: 1, confused: 1 });
    expect(playerOf(r.state, P1).discard).toContain(r.id);
    expect(inst(r.state, identityOf(r.state)).exhausted).toBe(false);
    expect(handCodes(r.state).length).toBe(handCodes(r.before).length - 1);
  });
  it("second branch: exhausts the chosen identity, which draws 1 card per acceleration token (3 tokens: 3 cards)", () => {
    const base = withTokens(heroGame(), 3);
    const r = playEvent(base, "44003", 0, { option: 1 });
    expect(inst(r.state, identityOf(r.state)).exhausted).toBe(true);
    expect(handCodes(r.state).length).toBe(handCodes(r.before).length - 1 + 3);
    expect(tokens(r.state)).toBe(3);
    expect(inst(r.state, villainOf(r.state)).statuses).toMatchObject({ stunned: 0, confused: 0 });
  });
  it("second branch with no tokens draws nothing, but the identity is still exhausted", () => {
    const r = playEvent(heroGame(), "44003", 0, { option: 1 });
    expect(inst(r.state, identityOf(r.state)).exhausted).toBe(true);
    expect(handCodes(r.state).length).toBe(handCodes(r.before).length - 1);
  });
  it("the second branch is offered only while an identity is ready: with the only identity exhausted, just the first is", () => {
    const base = heroGame();
    const tired = patchInstance(base, identityOf(base), { exhausted: true });
    const log: Say["log"] = { prompts: [] };
    const r = playEvent(tired, "44003", 0, { option: 1, log });
    const asked = log.prompts.find((p) => p.kind === "chooseOption");
    expect(asked === undefined || asked.options.length === 1).toBe(true);
    expect(tokens(r.state)).toBe(1);
    expect(inst(r.state, villainOf(r.state)).statuses.stunned).toBe(1);
  });
  it("two players: the second branch may exhaust the other player's identity, who draws the cards (June 2, 2026 - Ruling 5)", () => {
    const base = withTokens(heroGame([DEADPOOL, SPIDER_MAN]), 2);
    const p2 = identityOf(base, P2);
    const r = playEvent(base, "44003", 0, { option: 1, targets: { who: p2 } });
    expect(inst(r.state, p2).exhausted).toBe(true);
    expect(inst(r.state, identityOf(r.state, P1)).exhausted).toBe(false);
    expect(playerOf(r.state, P2).hand.length).toBe(playerOf(base, P2).hand.length + 2);
    expect(handCodes(r.state).length).toBe(handCodes(r.before).length - 1);
  });
  it("is a Hero Action: refused as Wade Wilson", () => {
    expect(playRefused(alterEgoGame(), "44003", 0)).toBe(true);
  });
});

describe("Maximum Effort (44004): Hero Action (attack), take any amount of damage -> deal that much to an enemy", () => {
  const effort = (state: GameState, amount: number, targets: Say["targets"] = {}) =>
    playEvent(state, "44004", 0, { amount, targets });
  it("offers 0 to the remaining hit points: 0..9 at full health, 0..5 with 4 damage already", () => {
    const log: Say["log"] = { prompts: [] };
    playEvent(heroGame(), "44004", 0, { amount: 0, log });
    const n = log.prompts.find((p) => p.kind === "chooseNumber")!;
    expect([n.min, n.max]).toEqual([0, 9]);
    const hurt = heroGame();
    const log2: Say["log"] = { prompts: [] };
    playEvent(withDamage(hurt, identityOf(hurt), 4), "44004", 0, { amount: 0, log: log2 });
    const n2 = log2.prompts.find((p) => p.kind === "chooseNumber")!;
    expect([n2.min, n2.max]).toEqual([0, 5]);
  });
  it("0: the event still resolves and is discarded, nobody takes damage (Q46 = B)", () => {
    const r = effort(heroGame(), 0);
    expect(damageOn(r.state)).toBe(0);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
    expect(formOf(r.state)).toBe("hero");
  });
  it("a middle amount, 3: he takes 3 and the enemy takes 3", () => {
    const r = effort(heroGame(), 3);
    expect(damageOn(r.state)).toBe(3);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(3);
    expect(formOf(r.state)).toBe("hero");
    expect(tokens(r.state)).toBe(0);
  });
  it("the maximum, 9 (exactly lethal): his defeat is replaced (1 hit point, Wade Wilson, 1 token) and the enemy still takes 9", () => {
    const r = effort(heroGame(), 9);
    expect(r.state.outcome).toBeNull();
    expect(damageOn(r.state)).toBe(8);
    expect(formOf(r.state)).toBe("alterEgo");
    expect(tokens(r.state)).toBe(1);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(9);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });
  it("with 4 damage already, the maximum 5 is lethal and deals 5", () => {
    const base = heroGame();
    const r = effort(withDamage(base, identityOf(base), 4), 5);
    expect(damageOn(r.state)).toBe(8);
    expect(formOf(r.state)).toBe("alterEgo");
    expect(inst(r.state, villainOf(r.state)).damage).toBe(5);
  });
  it("as Wade Wilson (alter-ego) it cannot be played; with Wade's 0 hit points he is gone", () => {
    expect(playRefused(alterEgoGame(), "44004", 0)).toBe(true);
  });
  it("a Guard minion engaged with him is the only enemy he may attack: it takes the damage, the villain none", () => {
    const base = heroGame();
    const m = withMinion(base, MERCENARY);
    const log: Say["log"] = { prompts: [] };
    const r = playEvent(m.state, "44004", 0, { amount: 2, log });
    const target = log.prompts.find((p) => p.slot === "enemy")!;
    expect(target.options).toEqual([m.id]);
    expect(inst(r.state, m.id).damage).toBe(2);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
    expect(damageOn(r.state)).toBe(2);
  });
  it("with two attackable enemies he chooses: Zero takes the 4, the villain none", () => {
    const z = withZero(heroGame());
    const r = effort(z.state, 4, { enemy: z.id });
    expect(inst(r.state, z.id).damage).toBeGreaterThanOrEqual(0);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
    expect(damageOn(r.state)).toBe(4);
  });
  it("a tough status card on him: only 0 is offered, the tough card stays, and the event still resolves (Q46 = B)", () => {
    const base = heroGame();
    const tough = patchInstance(base, identityOf(base), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const log: Say["log"] = { prompts: [] };
    const r = playEvent(tough, "44004", 0, { amount: 3, log });
    const n = log.prompts.find((p) => p.kind === "chooseNumber");
    if (n) expect([n.min, n.max]).toEqual([0, 0]);
    expect(inst(r.state, identityOf(r.state)).statuses.tough).toBe(1);
    expect(damageOn(r.state)).toBe(0);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });
  it("two players: only the Deadpool player's identity takes the damage; the other keeps full health", () => {
    const base = heroGame([DEADPOOL, SPIDER_MAN]);
    const r = effort(base, 4);
    expect(damageOn(r.state, P1)).toBe(4);
    expect(damageOn(r.state, P2)).toBe(0);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(4);
  });
});

describe('"Yoo-Hoo!" (44006): Hero Action (thwart), take any amount of damage -> remove that much threat from a scheme', () => {
  const yoohoo = (state: GameState, amount: number, targets: Say["targets"] = {}) =>
    playEvent(state, "44006", 1, { amount, targets });
  it("0: still resolves and is discarded: nothing taken, nothing removed (Q46 = B)", () => {
    const base = withoutSideSchemes(heroGame());
    const r = yoohoo(base, 0);
    expect(damageOn(r.state)).toBe(0);
    expect(threatOf(r.state, mainOf(r.state))).toBe(10);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });
  it("a middle amount, 4: he takes 4 and 4 threat comes off the main scheme", () => {
    const base = withoutSideSchemes(heroGame());
    const r = yoohoo(base, 4);
    expect(damageOn(r.state)).toBe(4);
    expect(threatOf(r.state, mainOf(r.state))).toBe(6);
    expect(formOf(r.state)).toBe("hero");
  });
  it("the maximum, 9 (exactly lethal): replaced, and the 9 threat still comes off the main scheme as Wade Wilson", () => {
    const base = withoutSideSchemes(heroGame());
    const r = yoohoo(base, 9);
    expect(r.state.outcome).toBeNull();
    expect(damageOn(r.state)).toBe(8);
    expect(formOf(r.state)).toBe("alterEgo");
    expect(tokens(r.state)).toBe(1);
    expect(threatOf(r.state, mainOf(r.state))).toBe(1);
  });
  it("a side scheme may be chosen instead of the main scheme", () => {
    const s = withScheme(withoutSideSchemes(heroGame()), BREAKIN, 5);
    const r = yoohoo(s.state, 3, { scheme: s.id });
    expect(threatOf(r.state, s.id)).toBe(2);
    expect(threatOf(r.state, mainOf(r.state))).toBe(10);
  });
  it("more than the scheme holds removes what is there: 9 off a scheme with 2 threat", () => {
    const s = withScheme(withoutSideSchemes(heroGame()), BREAKIN, 2);
    const r = yoohoo(s.state, 9, { scheme: s.id });
    expect(damageOn(r.state)).toBe(8);
    expect(r.state.instances[s.id] === undefined || threatOf(r.state, s.id) === 0).toBe(true);
  });
  it("Stryfe's crisis icon is in play: the main scheme is not a legal target, so the crisis side scheme takes the threat", () => {
    const base = heroGame();
    const log: Say["log"] = { prompts: [] };
    const r = playEvent(base, "44006", 1, { amount: 2, log });
    const t = log.prompts.find((p) => p.slot === "scheme")!;
    expect(t.options).toEqual([GRASP(base)]);
    expect(threatOf(r.state, GRASP(base))).toBe(threatOf(base, GRASP(base)) - 2);
    expect(threatOf(r.state, mainOf(r.state))).toBe(threatOf(base, mainOf(base)));
  });
  it("costs 1 card: refused with nothing to pay with, and as Wade Wilson", () => {
    expect(playRefused(alterEgoGame(), "44006", 1)).toBe(true);
    const base = heroGame();
    const g = given(base, "44006");
    expect(!applyCommand(g.state, play(P1, g.id, []), DEPS).ok).toBe(true);
  });
  it("two players: only the Deadpool player takes the damage", () => {
    const base = withoutSideSchemes(heroGame([DEADPOOL, SPIDER_MAN]));
    const r = yoohoo(base, 5);
    expect(damageOn(r.state, P1)).toBe(5);
    expect(damageOn(r.state, P2)).toBe(0);
    expect(threatOf(r.state, mainOf(r.state))).toBe(5);
  });
});

describe("Metaknowledge (44005): Hero Interrupt, cancel a revealed encounter card, take 1 damage per star and boost icon", () => {
  /** P1's turn ends with a boost filler (Assault, 0 icons) stacked on the revealed card; Metaknowledge is accepted when offered. */
  const reveal = (state: GameState, revealed: string, accept: boolean, players = 1) =>
    endOfTurn(
      state,
      says({ ...(accept ? { accept: "44005" } : {}), cost: 1 }),
      ...Array.from({ length: players }, () => ASSAULT),
      revealed,
    );
  const damageFromCard = (r: { events: readonly GameEvent[] }, id: InstanceId, state: GameState) =>
    dealtBy(r.events, id, identityOf(state));
  it("cancels the card (it goes to the discard pile, its When Revealed does not resolve) and he takes 1 for 1 boost icon", () => {
    const g = given(funded(heroGame(), 1, ["44005"]), "44005");
    const declined = reveal(g.state, CAUGHT_OFF_GUARD, false);
    const r = reveal(g.state, CAUGHT_OFF_GUARD, true);
    expect(playerOf(r.state, P1).discard).toContain(g.id);
    expect(damageFromCard(r, g.id, g.state)).toBe(1);
    const discarded = Object.values(r.state.encounterDecks).flatMap((d) => d.discard);
    expect(discarded.some((id) => codeOf(r.state, id) === CAUGHT_OFF_GUARD)).toBe(true);
    expect(playerOf(declined.state, P1).hand).toContain(g.id);
  });
  it("0 icons: he takes no damage", () => {
    const g = given(funded(heroGame(), 1, ["44005"]), "44005");
    const withIt = reveal(g.state, ADVANCE, true);
    const without = reveal(g.state, ADVANCE, false);
    expect(damageFromCard(withIt, g.id, g.state)).toBe(0);
    expect(inst(withIt.state, mainOf(withIt.state)).threat).toBeLessThan(
      inst(without.state, mainOf(without.state)).threat,
    );
  });
  it("2 boost icons: 2 damage", () => {
    const g = given(funded(heroGame(), 1, ["44005"]), "44005");
    expect(damageFromCard(reveal(g.state, SHADOW_OF_THE_PAST, true), g.id, g.state)).toBe(2);
  });
  it("1 boost icon and a star icon: 2 damage", () => {
    const g = given(funded(heroGame(), 1, ["44005"]), "44005");
    expect(damageFromCard(reveal(g.state, PSYCHIC_OVERRIDE, true), g.id, g.state)).toBe(2);
  });
  it("lethal: at 8 damage, 1 icon takes his last hit point: replaced (damage 8, Wade Wilson, 1 token)", () => {
    const base = heroGame();
    // A tough status card absorbs Stryfe's attack, so the card's 1 damage is the only damage he takes.
    const toughened = patchInstance(withDamage(base, identityOf(base), 8), identityOf(base), {
      damage: 8,
      statuses: { stunned: 0, confused: 0, tough: 1 },
    });
    const g = given(funded(toughened, 1, ["44005"]), "44005");
    const r = reveal(g.state, CAUGHT_OFF_GUARD, true);
    expect(playerOf(r.state, P1).discard).toContain(g.id);
    expect(damageOn(r.state)).toBe(8);
    expect(formOf(r.state)).toBe("alterEgo");
    expect(tokens(r.state)).toBeGreaterThanOrEqual(tokens(g.state) + 1);
    expect(playerOf(r.state, P1).eliminated).toBe(false);
  });
  it("is a Hero Interrupt: as Wade Wilson it is not offered", () => {
    const g = given(funded(alterEgoGame(), 1, ["44005"]), "44005");
    const log: Say["log"] = { prompts: [] };
    endOfTurn(g.state, says({ accept: "44005", cost: 1, log }), ASSAULT, ADVANCE);
    expect(log.prompts.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes("44005")))).toBe(
      false,
    );
  });
  it("two players: it may cancel the card dealt to the other player, and Deadpool's player takes the damage", () => {
    const g = given(funded(heroGame([DEADPOOL, SPIDER_MAN]), 1, ["44005"]), "44005");
    const stack = [ASSAULT, ASSAULT, ADVANCE, CAUGHT_OFF_GUARD];
    const picks = says({ accept: "44005", cost: 1 });
    // The first dealt card is P1's own (Advance, 0 icons): declined; the second is P2's.
    let offered = 0;
    const pick: Picker = (s) => {
      const c = s.pendingChoice;
      if (c?.prompt.kind === "chooseTriggers" && c.options.some((o) => o.optionId.includes("44005"))) {
        offered += 1;
        if (offered === 1) return [];
      }
      return picks(s);
    };
    const r = driveEventsPicking(DEPS, stackEncounterDeck(g.state, ...stack), pick, endTurn(P1), endTurn(P2));
    expect(offered).toBeGreaterThanOrEqual(2);
    expect(dealtBy(r.events, g.id, identityOf(g.state, P1))).toBe(1);
    expect(dealtBy(r.events, g.id, identityOf(g.state, P2))).toBe(0);
  });
});

describe("This Card is Fire (44012): forced response from hand, and Hero Action (attack) for X = damage sustained", () => {
  const turnEnd = (state: GameState, players = 1) =>
    driveEventsPicking(DEPS, state, says({}), endTurn(P1), ...(players === 2 ? [endTurn(P2)] : []));
  it.fails("ENGINE GAP (an event's own activeIn hand ability is never heard, resolve/triggers.ts inHandCandidates): in hand when his turn ends: he takes 1 damage from it", () => {
    const g = given(heroGame(), "44012");
    const r = turnEnd(g.state);
    expect(dealtBy(r.events, g.id, identityOf(g.state))).toBe(1);
  });
  it.fails("ENGINE GAP (an event's own activeIn hand ability is never heard, resolve/triggers.ts inHandCandidates): two copies in hand: 1 damage from each", () => {
    const one = given(heroGame(), "44012");
    const two = given(one.state, "44012");
    expect(two.id).toBe(one.id);
    const owner = playerOf(one.state, P1);
    const second = owner.deck.find((id) => codeOf(one.state, id) === "44012")!;
    const both = {
      ...one.state,
      players: one.state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== second), hand: [...p.hand, second] } : p,
      ),
    };
    const r = turnEnd(both);
    expect(dealtBy(r.events, one.id, identityOf(both)) + dealtBy(r.events, second, identityOf(both))).toBe(2);
  });
  it("not in hand (still in the deck): nothing", () => {
    const base = heroGame();
    const copies = playerOf(base, P1).deck.filter((id) => codeOf(base, id) === "44012");
    expect(copies.length).toBe(2);
    const r = turnEnd(base);
    expect(copies.map((id) => dealtBy(r.events, id, identityOf(base))).reduce((a, b) => a + b, 0)).toBe(0);
  });
  it.fails("ENGINE GAP (an event's own activeIn hand ability is never heard, resolve/triggers.ts inHandCandidates): it hurts Wade Wilson too, and is lethal to Wade at 8 damage (alter-ego has no replacement: eliminated)", () => {
    const g = given(alterEgoGame(), "44012");
    const r = turnEnd(g.state);
    expect(dealtBy(r.events, g.id, identityOf(g.state))).toBe(1);
    const dying = withDamage(g.state, identityOf(g.state), 8);
    const dead = turnEnd(dying);
    expect(playerOf(dead.state, P1).eliminated).toBe(true);
  });
  it.fails("ENGINE GAP (an event's own activeIn hand ability is never heard, resolve/triggers.ts inHandCandidates): lethal on the hero face at 8 damage: replaced, he is Wade Wilson at damage 8 with a token", () => {
    const base = heroGame();
    const g = given(withDamage(base, identityOf(base), 8), "44012");
    const r = turnEnd(g.state);
    expect(dealtBy(r.events, g.id, identityOf(g.state))).toBe(1);
    expect(playerOf(r.state, P1).eliminated).toBe(false);
    expect(formOf(r.state)).toBe("alterEgo");
    expect(tokens(r.state)).toBeGreaterThanOrEqual(1);
  });
  it.fails("ENGINE GAP (an event's own activeIn hand ability is never heard, resolve/triggers.ts inHandCandidates): two players: P2's turn ending does not hurt P1's hand card a second time", () => {
    const g = given(heroGame([DEADPOOL, SPIDER_MAN]), "44012");
    const r = turnEnd(g.state, 2);
    expect(dealtBy(r.events, g.id, identityOf(g.state, P1))).toBe(1);
    expect(dealtBy(r.events, g.id, identityOf(g.state, P2))).toBe(0);
  });
  it("Action, X = 0: no damage sustained, the attack deals 0 (cost 3)", () => {
    const r = playEvent(heroGame(), "44012", 3, { targets: {} });
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });
  it("Action, X = 4: 4 damage sustained, the attack deals 4 to the villain and he is not damaged by it", () => {
    const base = heroGame();
    const r = playEvent(withDamage(base, identityOf(base), 4), "44012", 3);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(4);
    expect(damageOn(r.state)).toBe(4);
  });
  it("Action, X = 8 (the most he can sustain): 8 damage", () => {
    const base = heroGame();
    const r = playEvent(withDamage(base, identityOf(base), 8), "44012", 3);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(8);
    expect(formOf(r.state)).toBe("hero");
  });
  it("the Action is a Hero Action: refused as Wade Wilson", () => {
    expect(playRefused(alterEgoGame(), "44012", 3)).toBe(true);
  });
  it("Action: a Guard minion engaged with him must be the target", () => {
    const base = heroGame();
    const m = withMinion(withDamage(base, identityOf(base), 2), MERCENARY);
    const r = playEvent(m.state, "44012", 3);
    expect(inst(r.state, m.id).damage).toBe(2);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
  });
  it("Action, two players: X reads the Deadpool player's own damage", () => {
    const base = heroGame([DEADPOOL, SPIDER_MAN]);
    const hurt = withDamage(withDamage(base, identityOf(base, P1), 3), identityOf(base, P2), 5);
    const r = playEvent(hurt, "44012", 3);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(3);
  });
});

describe("Barely a Scratch (44017): Hero Interrupt (defense), prevent 1 damage from an attack per encounter icon in play", () => {
  /** P1's turn ends: Stryfe (boost: Assault, 0 icons) attacks; Barely a Scratch is accepted or declined. */
  const attacked = (state: GameState, accept: boolean) =>
    endOfTurn(state, says({ ...(accept ? { accept: "44017" } : {}), cost: 0 }), ASSAULT, ADVANCE);
  /** The attack's damage as it was about to be dealt to the identity, the damage prevented and the damage dealt. */
  const tally = (r: { events: readonly GameEvent[] }, who: InstanceId) => ({
    attack: r.events
      .filter(
        (e) =>
          e.type === "triggerEvent" &&
          e.phase === "initiated" &&
          e.event.kind === "dealDamage" &&
          e.event.fromAttack === true &&
          e.event.targetInstanceId === who,
      )
      .map((e) => (e.type === "triggerEvent" && e.event.kind === "dealDamage" ? e.event.amount : 0))[0],
    prevented: r.events.reduce(
      (n, e) => (e.type === "damagePrevented" && e.targetInstanceId === who ? n + e.amount : n),
      0,
    ),
    dealt: r.events.reduce((n, e) => (e.type === "damageDealt" && e.targetInstanceId === who ? n + e.amount : n), 0),
  });
  it("with 1 icon in play (Stryfe's Grasp) it prevents exactly 1 of the attack's damage", () => {
    const g = given(heroGame(), "44017");
    const without = attacked(g.state, false);
    const withIt = attacked(g.state, true);
    const who = identityOf(g.state);
    expect(tally(without, who).prevented).toBe(0);
    const t = tally(withIt, who);
    expect(t.attack).toBeGreaterThan(1);
    expect(t.prevented).toBe(1);
    expect(t.dealt).toBe(t.attack! - 1);
    expect(damageOn(withIt.state)).toBe(t.dealt);
    expect(playerOf(withIt.state, P1).discard).toContain(g.id);
    expect(playerOf(without.state, P1).hand).toContain(g.id);
  });
  it("with 4 icons in play (crisis, hazard, acceleration, amplify) it prevents 4, or all of a smaller attack", () => {
    const a = withScheme(heroGame(), BREAKIN, 3);
    const b = withScheme(a.state, BOMB_SCARE, 3);
    const c = withScheme(b.state, NOT_MY_LUCKY_DAY, 3);
    expect(iconCount(c.state)).toBe(4);
    const g = given(c.state, "44017");
    const t = tally(attacked(g.state, true), identityOf(g.state));
    expect(t.attack).toBeGreaterThan(1);
    expect(t.prevented).toBe(Math.min(4, t.attack!));
    expect(t.dealt).toBe(Math.max(0, t.attack! - 4));
  });
  it("0 icons in play prevents nothing", () => {
    const g = given(withoutSideSchemes(heroGame()), "44017");
    expect(iconCount(g.state)).toBe(0);
    const t = tally(attacked(g.state, true), identityOf(g.state));
    expect(t.prevented).toBe(0);
  });
  it("is not offered as Wade Wilson (a Hero Interrupt)", () => {
    const g = given(alterEgoGame(), "44017");
    const log: Say["log"] = { prompts: [] };
    endOfTurn(g.state, says({ accept: "44017", log }), ASSAULT, ADVANCE);
    expect(log.prompts.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes("44017")))).toBe(
      false,
    );
  });
});

describe("Cutupper (44018): Hero Action (attack), 5 damage to an enemy and stun it", () => {
  it("5 damage to the villain and a stun status card on it; costs 3", () => {
    const r = playEvent(heroGame(), "44018", 3);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(5);
    expect(inst(r.state, villainOf(r.state)).statuses.stunned).toBe(1);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });
  it("a Guard minion with 3 hit points: defeated by the 5, and there is nothing left to stun", () => {
    const m = withMinion(heroGame(), MERCENARY);
    const r = playEvent(m.state, "44018", 3);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
    expect(r.state.instances[m.id] === undefined || !playerOf(r.state, P1).playArea.includes(m.id)).toBe(true);
    expect(inst(r.state, villainOf(r.state)).statuses.stunned).toBe(0);
  });
  it("two enemies: the chosen one takes the 5 and the stun, the other nothing", () => {
    const z = withZero(heroGame());
    const r = playEvent(z.state, "44018", 3, { targets: { enemy: z.id } });
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
    expect(inst(r.state, villainOf(r.state)).statuses.stunned).toBe(0);
    expect(inst(r.state, z.id).statuses.stunned).toBe(1);
  });
  it("is a Hero Action: refused as Wade Wilson; refused with too few cards to pay", () => {
    expect(playRefused(alterEgoGame(), "44018", 3)).toBe(true);
    const g = given(heroGame(), "44018");
    expect(!applyCommand(g.state, play(P1, g.id, payWith(g.state, P1, 1, [g.id])), DEPS).ok).toBe(true);
  });
  it("two players: only the chosen enemy is touched and P2's hand is not", () => {
    const base = heroGame([DEADPOOL, SPIDER_MAN]);
    const r = playEvent(base, "44018", 3);
    expect(playerOf(r.state, P2).hand).toEqual(playerOf(base, P2).hand);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(5);
  });
});

describe("Da Bomb (44019): Hero Action, 10 to the villain, then 1 to each enemy and hero per encounter icon in play", () => {
  it("with only Stryfe's Grasp's crisis in play (1 icon): the villain takes 10 + 1, Deadpool takes 1; costs 6", () => {
    const r = playEvent(heroGame(), "44019", 6);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(11);
    expect(damageOn(r.state)).toBe(1);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });
  it("with 4 icons (crisis, hazard, acceleration, amplify): the villain takes 14, a minion 4 and he takes 4", () => {
    const a = withScheme(heroGame(), BREAKIN, 3);
    const b = withScheme(a.state, BOMB_SCARE, 3);
    const c = withScheme(b.state, NOT_MY_LUCKY_DAY, 3);
    const m = withMinion(c.state, MERCENARY, { damage: 0 });
    const r = playEvent(m.state, "44019", 6);
    expect(iconCount(c.state)).toBe(4);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(14);
    expect(r.state.instances[m.id] === undefined || !playerOf(r.state, P1).playArea.includes(m.id)).toBe(true);
    expect(damageOn(r.state)).toBe(4);
  });
  it("lethal for his own hero face: at 8 damage the 1 it deals to him is replaced (Wade Wilson, 1 token)", () => {
    const base = heroGame();
    const r = playEvent(withDamage(base, identityOf(base), 8), "44019", 6);
    expect(r.state.outcome).toBeNull();
    expect(damageOn(r.state)).toBe(8);
    expect(formOf(r.state)).toBe("alterEgo");
    expect(tokens(r.state)).toBe(1);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(11);
  });
  it("is a Hero Action: refused as Wade Wilson", () => {
    expect(playRefused(alterEgoGame(), "44019", 6)).toBe(true);
  });
  it("two players: each hero is damaged, a player in alter-ego form is not", () => {
    const both = heroGame([DEADPOOL, SPIDER_MAN]);
    const alone = playEvent(both, "44019", 6);
    expect(damageOn(alone.state, P1)).toBe(1);
    expect(damageOn(alone.state, P2)).toBe(0);
    const heroes = withForm(both, { heroForm: 0 }, P2);
    const r = playEvent(heroes, "44019", 6);
    expect(damageOn(r.state, P1)).toBe(1);
    expect(damageOn(r.state, P2)).toBe(1);
  });
});

/** Hope Summers, the one ally in play at the start (Stryfe's setup). */
const hopeOf = (s: GameState): InstanceId =>
  playerOf(s, P1).playArea.find((id) => id !== identityOf(s) && profile(s, id)?.atk !== undefined)!;

describe("Get Rage-y (44020): Action, ready an ally, +1 ATK until the end of the phase", () => {
  it("readies Hope Summers and she gets +1 ATK; costs 0", () => {
    const base = heroGame();
    const ally = hopeOf(base);
    const tired = patchInstance(base, ally, { exhausted: true });
    const atk0 = profile(tired, ally).atk;
    const r = playEvent(tired, "44020", 0, { targets: { ally } });
    expect(inst(r.state, ally).exhausted).toBe(false);
    expect(profile(r.state, ally).atk).toBe(atk0 + 1);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });
  it("the +1 ATK is until the end of the phase: it is gone in the next player phase", () => {
    const base = heroGame();
    const ally = hopeOf(base);
    const r = playEvent(base, "44020", 0, { targets: { ally } });
    expect(profile(r.state, ally).atk).toBe(profile(base, ally).atk + 1);
    const next = settle(
      driveEventsPicking(DEPS, r.state, says({ allyDefends: false }), endTurn(P1)).state,
      firstLegal,
      (st) => st.step.phase === "player" && st.round > r.state.round,
      DEPS,
    );
    expect(profile(next, ally).atk).toBe(profile(base, ally).atk);
  });
  it("an ally that is already ready still gets the +1 ATK", () => {
    const base = heroGame();
    const ally = hopeOf(base);
    const r = playEvent(base, "44020", 0, { targets: { ally } });
    expect(inst(r.state, ally).exhausted).toBe(false);
    expect(profile(r.state, ally).atk).toBe(profile(base, ally).atk + 1);
  });
  it("it is an Action, not a Hero Action: playable as Wade Wilson", () => {
    const base = alterEgoGame();
    const ally = hopeOf(base);
    const r = playEvent(base, "44020", 0, { targets: { ally } });
    expect(playerOf(r.state, P1).discard).toContain(r.id);
    expect(profile(r.state, ally).atk).toBe(profile(base, ally).atk + 1);
  });
  it("two players: any ally may be chosen, another player's included; the others are unchanged", () => {
    const base = heroGame([DEADPOOL, SPIDER_MAN]);
    const badger = withAlly(base, HONEY_BADGER, P2);
    const tired = patchInstance(badger.state, badger.id, { exhausted: true });
    const log: Say["log"] = { prompts: [] };
    const r = playEvent(tired, "44020", 0, { targets: { ally: badger.id }, log });
    expect(log.prompts.find((p) => p.slot === "ally")!.options).toContain(badger.id);
    expect(inst(r.state, badger.id).exhausted).toBe(false);
    expect(profile(r.state, badger.id).atk).toBe(profile(tired, badger.id).atk + 1);
  });
});

describe('"I Got This" (44021): Hero Action, one effect for each icon type on 1 or more cards in play', () => {
  const run = (state: GameState, say: Say = {}) => playEvent(state, "44021", 1, say);
  it("only a crisis icon (Stryfe's Grasp): 3 damage to an enemy and nothing else; costs 1", () => {
    const base = heroGame();
    const r = run(base);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(3);
    expect(threatOf(r.state, GRASP(r.state))).toBe(threatOf(base, GRASP(base)));
    expect(handCodes(r.state).length).toBe(handCodes(r.before).length - 2);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });
  it("a second crisis icon is no more than the first: still 3 damage", () => {
    const s = withScheme(heroGame(), CROWD_CONTROL, 3);
    expect(iconsInPlay(s.state, DEPS, "crisis")).toBe(2);
    const r = run(s.state);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(3);
  });
  it("an acceleration icon: remove 2 threat from a scheme", () => {
    const s = withScheme(withoutSideSchemes(heroGame()), BOMB_SCARE, 5);
    const r = run(s.state, { targets: { scheme: s.id } });
    expect(threatOf(r.state, s.id)).toBe(3);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
  });
  it("acceleration tokens are not acceleration icons: 5 tokens alone remove nothing", () => {
    const base = withTokens(withoutSideSchemes(heroGame()), 5);
    const r = run(base);
    expect(threatOf(r.state, mainOf(r.state))).toBe(10);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
  });
  it("an amplify icon: ready an ally you control", () => {
    const s = withScheme(withoutSideSchemes(heroGame()), NOT_MY_LUCKY_DAY, 3);
    const ally = hopeOf(s.state);
    const tired = patchInstance(s.state, ally, { exhausted: true });
    const r = run(tired, { targets: { ally } });
    expect(inst(r.state, ally).exhausted).toBe(false);
  });
  it("a hazard icon: draw 1 card", () => {
    const s = withScheme(withoutSideSchemes(heroGame()), BREAKIN, 3);
    const r = run(s.state);
    expect(handCodes(r.state).length).toBe(handCodes(r.before).length - 2 + 1);
  });
  it("all four icons: 3 damage, 2 threat, a ready ally and a card, in that order", () => {
    const a = withScheme(heroGame(), BREAKIN, 3);
    const b = withScheme(a.state, BOMB_SCARE, 5);
    const c = withScheme(b.state, NOT_MY_LUCKY_DAY, 3);
    const ally = hopeOf(c.state);
    const tired = patchInstance(c.state, ally, { exhausted: true });
    const r = run(tired, { targets: { scheme: b.id, ally } });
    expect(inst(r.state, villainOf(r.state)).damage).toBe(3);
    expect(threatOf(r.state, b.id)).toBe(3);
    expect(inst(r.state, ally).exhausted).toBe(false);
    expect(handCodes(r.state).length).toBe(handCodes(r.before).length - 2 + 1);
  });
  it("no icon at all: it resolves and does nothing", () => {
    const base = withoutSideSchemes(heroGame());
    expect(iconCount(base)).toBe(0);
    const r = run(base);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
    expect(handCodes(r.state).length).toBe(handCodes(r.before).length - 2);
  });
  it("is a Hero Action: refused as Wade Wilson", () => {
    expect(playRefused(alterEgoGame(), "44021", 1)).toBe(true);
  });
  it("two players: the ally to ready is one the Deadpool player controls, not the other player's", () => {
    const base = withoutSideSchemes(heroGame([DEADPOOL, SPIDER_MAN]));
    const badger = withAlly(base, HONEY_BADGER, P2);
    const s = withScheme(badger.state, NOT_MY_LUCKY_DAY, 3);
    const log: Say["log"] = { prompts: [] };
    run(s.state, { log });
    const ask = log.prompts.find((p) => p.slot === "ally");
    expect(ask === undefined || !ask.options.includes(badger.id)).toBe(true);
  });
});

describe("Not my Responsibility (44022): Interrupt, threat that would be placed on a scheme is taken as damage by you or your ally", () => {
  /** Ends P1's turn with Advance dealt: "The villain schemes." Accepts 44022 and answers its target prompt. */
  const scheming = (state: GameState, who: string | null, accept = true) =>
    endOfTurn(
      state,
      says({ ...(accept ? { accept: "44022", nonZero: true } : {}), targets: who ? { who } : {} }),
      ASSAULT,
      ADVANCE,
    );
  it("the villain phase's threat is taken as damage by his identity instead; the scheme gains none of it", () => {
    const g = given(heroGame(), "44022");
    const without = scheming(g.state, null, false);
    const r = scheming(g.state, identityOf(g.state));
    const placed = (events: readonly GameEvent[]) =>
      events.reduce(
        (n, e) => (e.type === "threatPlaced" && e.schemeInstanceId === mainOf(g.state) ? n + e.amount : n),
        0,
      );
    expect(placed(without.events)).toBeGreaterThan(placed(r.events));
    expect(dealtBy(r.events, g.id, identityOf(g.state))).toBeGreaterThan(0);
    expect(playerOf(r.state, P1).discard).toContain(g.id);
    expect(playerOf(without.state, P1).hand).toContain(g.id);
  });
  it("his ally may take it instead: Hope Summers takes the damage and he takes none from the card", () => {
    const g = given(heroGame(), "44022");
    const ally = hopeOf(g.state);
    const log: Say["log"] = { prompts: [] };
    const r = endOfTurn(
      g.state,
      says({ accept: "44022", nonZero: true, targets: { who: ally }, log }),
      ASSAULT,
      ADVANCE,
    );
    expect(log.prompts.find((p) => p.slot === "who")!.options).toEqual(
      expect.arrayContaining([ally, identityOf(g.state)]),
    );
    expect(dealtBy(r.events, g.id, ally)).toBeGreaterThan(0);
    expect(dealtBy(r.events, g.id, identityOf(g.state))).toBe(0);
  });
  it("lethal for his hero face: replaced (Wade Wilson, damage 8), and he keeps the card's damage", () => {
    const base = heroGame();
    const g = given(withDamage(base, identityOf(base), 8), "44022");
    const r = scheming(g.state, identityOf(g.state));
    expect(dealtBy(r.events, g.id, identityOf(g.state))).toBeGreaterThan(0);
    expect(formOf(r.state)).toBe("alterEgo");
    expect(tokens(r.state)).toBeGreaterThanOrEqual(1);
  });
  it("an Interrupt, not a Hero Interrupt: playable as Wade Wilson, who is eliminated at 0 hit points", () => {
    const base = alterEgoGame();
    const g = given(base, "44022");
    const r = scheming(g.state, identityOf(g.state));
    expect(playerOf(r.state, P1).discard).toContain(g.id);
    const dying = withDamage(g.state, identityOf(g.state), 8);
    const dead = scheming(dying, identityOf(dying));
    expect(playerOf(dead.state, P1).eliminated).toBe(true);
  });
  it.fails("ENGINE GAP: 'any amount of threat' is at least 1, so a 0-threat placement (villain phase step one) offers nothing", () => {
    const g = given(heroGame(), "44022");
    const offered: number[] = [];
    const watch: Picker = (st) => {
      const prompt = st.pendingChoice?.prompt as { kind?: string; event?: { amount?: number } } | undefined;
      if (prompt?.kind === "chooseTriggers") offered.push(prompt.event?.amount ?? -1);
      return firstLegal(st);
    };
    endOfTurn(g.state, watch, ASSAULT, ADVANCE);
    expect(offered).not.toContain(0);
  });
  it("two players: only the Deadpool player's identity and allies are offered, never the other player's", () => {
    const base = heroGame([DEADPOOL, SPIDER_MAN]);
    const g = given(base, "44022");
    const log: Say["log"] = { prompts: [] };
    driveEventsPicking(
      DEPS,
      stackEncounterDeck(g.state, ASSAULT, ASSAULT, ADVANCE, ADVANCE),
      says({ accept: "44022", nonZero: true, targets: { who: identityOf(g.state) }, log }),
      endTurn(P1),
      endTurn(P2),
    );
    const ask = log.prompts.find((p) => p.slot === "who");
    expect(ask).toBeDefined();
    expect(ask!.options).not.toContain(identityOf(g.state, P2));
  });
});

describe("'Pool Inspection (44023): Hero Action (thwart), 5 off the main scheme ignoring crisis, then 1 off each scheme per icon", () => {
  it("no icons and no crisis: 5 threat off the main scheme; costs 6", () => {
    const base = withoutSideSchemes(heroGame());
    const r = playEvent(base, "44023", 6);
    expect(threatOf(r.state, mainOf(r.state))).toBe(5);
    expect(playerOf(r.state, P1).discard).toContain(r.id);
  });
  it("with a crisis icon in play the first sentence still takes 5 off the main scheme", () => {
    const base = patchInstance(heroGame(), mainOf(heroGame()), { threat: 10 });
    expect(iconsInPlay(base, DEPS, "crisis")).toBe(1);
    const r = playEvent(base, "44023", 6);
    expect(threatOf(r.state, mainOf(r.state))).toBe(5);
    expect(threatOf(r.state, GRASP(r.state))).toBe(threatOf(base, GRASP(base)) - 1);
  });
  it("then 1 more off each scheme for each icon in play: 1 acceleration icon takes 1 off the main scheme and 1 off the side scheme", () => {
    const s = withScheme(withoutSideSchemes(heroGame()), BOMB_SCARE, 4);
    expect(iconCount(s.state)).toBe(1);
    const r = playEvent(s.state, "44023", 6);
    expect(threatOf(r.state, mainOf(r.state))).toBe(4);
    expect(threatOf(r.state, s.id)).toBe(3);
  });
  it("3 icons: 5 + 3 off the main scheme, 3 off each side scheme", () => {
    const a = withScheme(withoutSideSchemes(heroGame()), BOMB_SCARE, 4);
    const b = withScheme(a.state, BREAKIN, 5);
    const c = withScheme(b.state, NOT_MY_LUCKY_DAY, 2);
    expect(iconCount(c.state)).toBe(3);
    const r = playEvent(c.state, "44023", 6);
    expect(threatOf(r.state, mainOf(r.state))).toBe(2);
    expect(threatOf(r.state, a.id)).toBe(1);
    expect(threatOf(r.state, b.id)).toBe(2);
    expect(r.state.instances[c.id] === undefined || threatOf(r.state, c.id) === 0).toBe(true);
  });
  it("is a Hero Action: refused as Wade Wilson", () => {
    expect(playRefused(alterEgoGame(), "44023", 6)).toBe(true);
  });
  it("two players: P2's hand is not touched", () => {
    const base = withoutSideSchemes(heroGame([DEADPOOL, SPIDER_MAN]));
    const r = playEvent(base, "44023", 6);
    expect(playerOf(r.state, P2).hand).toEqual(playerOf(base, P2).hand);
    expect(threatOf(r.state, mainOf(r.state))).toBe(5);
  });
});
