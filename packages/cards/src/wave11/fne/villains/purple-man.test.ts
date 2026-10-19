import { PLAYABLE_CARDS, cardId, trait } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  categoriesOf,
  characterProfile,
  createGame,
  hasKeyword,
  traitsOf,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario, encounterCardsOf } from "../../../core/index.js";
import { constant, gets, query } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  encounterCardInVillainArea,
  withForm,
} from "../../../testing/staging.js";
import { engageMinion } from "../../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_VILLAINS_PURPLE_MAN as REGISTRY, FNE_VILLAINS_PURPLE_MAN_SKIPPED as SKIPPED } from "./purple-man.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * The Purple Man villain set (60097-60099 Purple Man I-III, 60100 Converted, 60101 Firefighter, 60102 Judge,
 * 60103 Security Guard, 60104 Skater Punk, 60105-60107 "Fight."/"Protect."/"Serve.", 60108 Power of Suggestion, 60109
 * Sway the Masses), docs/phase7-wave11-scenarios.md section S6, S3.6, S3.9. Each game is Core's Spider-Man (Justice)
 * (and Captain Marvel with `players: 2`) against Purple Man at a stage, with the set added to the Core encounter deck.
 * Core's Assault (01187) prints no boost icon and no boost ability: the blank boost card.
 */
const GRANTED = "60097.granted-boost";
const REFS = [
  "60097.purple-man-constant",
  "60097.purple-man-constant-2",
  "60098.purple-man-constant",
  "60098.purple-man-constant-2",
  "60099.purple-man-constant",
  "60099.purple-man-constant-2",
  "60100.converted-constant",
  "60100.when-revealed",
  "60101.firefighter-constant",
  "60101.when-defeated",
  "60102.when-defeated",
  "60103.when-defeated",
  "60104.when-defeated",
  "60105.fight-constant",
  "60105.fight-forced-action",
  "60106.protect-constant",
  "60106.protect-forced-action",
  "60107.serve-constant",
  "60107.serve-forced-action",
  "60108.power-of-suggestion-constant",
  "60109.when-revealed",
];
const CODES = ["60097", "60100", "60101", "60102", "60103", "60104", "60105", "60106", "60107", "60108", "60109"];
const INFLUENCED = trait("INFLUENCED");
const ASSAULT = "01187";
const BLACK_CAT = "01002"; // ally, cost 2, ATK 1, THW 1
const SPIDER_WOMAN = "01011"; // ally, cost 3, ATK 2, THW 2
const NICK_FURY = "01084"; // ally, cost 4, ATK 2, THW 2
const AUNT_MAY = "01006"; // support, cost 1
const MANSION = "01091"; // support, cost 4
const WEBBED_UP = "01009"; // upgrade, cost 4
const GAMMA = "21002"; // Permanent upgrade, cost 0
const ENERGY_CHANNEL = "01018"; // upgrade, cost 0
const FIREFIGHTER = "60101";
const JUDGE = "60102";
const GUARD = "60103";
const SKATER = "60104";
const FIGHT = "60105";
const PROTECT = "60106";
const SERVE = "60107";
const SUGGESTION = "60108";
const SWAY = "60109";
const CONVERTED = "60100";
/** Harmless dealt cards (minions that only engage) for the phases where a test is about something else. */
const FILLERS = [JUDGE, GUARD];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState, p: PlayerId = P1): InstanceId => identityOf(s, p);
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const mainScheme = (s: GameState): InstanceId => s.mainScheme.instanceId;
const mainThreat = (s: GameState): number => inst(s, mainScheme(s)).threat;
const encounterDiscard = (s: GameState): string[] => activeEncounterDeck(s).discard.map((i) => codeOf(s, i));
const idOf = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;
const tough = (s: GameState, id: InstanceId): number => inst(s, id).statuses.tough ?? 0;
const engagedWith = (s: GameState, id: InstanceId) => inst(s, id).engagedWith;

/** Core Spider-Man (hero form), plus Captain Marvel with `players: 2`, against Purple Man at `stage` (1 to 3). */
function newGame(opts: { stage?: 1 | 2 | 3; players?: number; seed?: number } = {}): GameState {
  const { stage = 1, players = 1, seed = 1 } = opts;
  const seats = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
  const base = coreScenario("rhino", {
    players: seats.slice(0, players),
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    {
      ...base,
      villainCardId: cardId("60097"),
      villainSide: "A",
      villainStartStageIndex: stage - 1,
      villainLastStageIndex: 2,
      encounterDeck: [...base.encounterDeck, ...encounterCardsOf(["purple_man"], PLAYABLE_CARDS)],
    },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS);
  let s = withForm(settled, { heroForm: 0 });
  if (players > 1) s = withForm(s, { heroForm: 0 }, P2);
  return s;
}

describe("registry", () => {
  it("registers every printed ref of the cards plus the granted Boost; nothing is skipped", () => {
    const printed = CODES.flatMap((c) => abilityRefIds(data(c))).sort();
    expect(printed).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS, GRANTED].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS, GRANTED])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------------------------------------------

/**
 * Surgery: a copy of `code` put into `player`'s play area under their control (one of their deck cards relabeled),
 * attached to their identity when it is an upgrade.
 */
function put(
  state: GameState,
  player: PlayerId,
  code: string,
  opts: { readonly attach?: boolean; readonly counters?: Readonly<Record<string, number>> } = {},
): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, player);
  const id = owner.deck.find(
    (i) => !Object.values(state.instances).some((o) => o.cardId === code && o === inst(state, i)),
  )!;
  const host = identityOf(state, player);
  let s: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            deck: p.deck.filter((i) => i !== id),
            playArea: opts.attach ? p.playArea : [...p.playArea, id],
          }
        : p,
    ),
  };
  s = patchInstance(s, id, {
    cardId: cardId(code),
    faceup: true,
    controllerId: player,
    counters: { ...opts.counters },
    ...(opts.attach ? { attachedTo: host } : {}),
  } as never);
  if (opts.attach) s = patchInstance(s, host, { attachments: [...inst(s, host).attachments, id] });
  return { state: s, id };
}

/** The encounter card `code` moved out of the deck into `player`'s play area, ready, holding `counters`. */
function encounterInPlay(state: GameState, player: PlayerId, code: string, counters: Record<string, number> = {}) {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code)!;
  const s: GameState = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
    },
    players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
  };
  return {
    id,
    state: patchInstance(s, id, { faceup: true, controllerId: player, counters, exhausted: false } as never),
  };
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
const endAll = (s: GameState) => s.players.map((p) => endTurn(p.playerId));
/** The villain phase on a stacked encounter deck: `boosts` on top, then `dealt` (default one filler per player). */
const phase = (s: GameState, boosts: readonly string[] = [], dealt?: readonly string[], pick: Picker = declines) =>
  driveEventsPicking(
    WAVE11_DEPS,
    stackEncounterDeck(s, ...boosts, ...(dealt ?? FILLERS.slice(0, s.players.length))),
    pick,
    ...endAll(s),
  );
/** The villain stunned (confused) so its activation only discards that status: no attack, scheme or boost card. */
const hobbled = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, stunned: 1, confused: 1 } });
/** Villain hobbled, every player in alter-ego form (nothing attacks them) or as they are: only the dealt cards act. */
const quiet = (s: GameState, dealt?: readonly string[], pick: Picker = declines) => phase(hobbled(s), [], dealt, pick);
const moves = (events: readonly GameEvent[]) => ofType(events, "cardMoved");
const dealtMoves = (events: readonly GameEvent[]) => moves(events).filter((e) => e.to.kind === "dealtEncounter");

/**
 * A picker that takes `take` when a prompt offers every card of `tied` (a tie decided by choice), recording who was
 * asked and which options were on offer; any other prompt gets the fewest selections.
 */
function tiePicker(tied: readonly InstanceId[], take: InstanceId) {
  const seen: { chooser: PlayerId; options: string[] }[] = [];
  const pick: Picker = (st) => {
    const choice = st.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId);
    if (tied.every((t) => ids.includes(t))) {
      seen.push({ chooser: choice.playerId, options: ids });
      return [take];
    }
    return firstLegal(st);
  };
  return { seen, pick };
}
/** Surgery: the first encounter-deck copy of `from` becomes a copy of `to` (the set prints one Converted). */
function relabelEncounter(state: GameState, from: string, to: string): GameState {
  const pile = state.encounterDecks[activeEncounterDeckId(state)]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === from)!;
  return patchInstance(state, id, { cardId: cardId(to) } as never);
}

const hasKw = (s: GameState, id: InstanceId, name: string) => hasKeyword(s, id, name as never, WAVE11_DEPS);

/** A Core minion (a card of no Purple Man set) engaged with P1. */
const CORE_MINION = (PLAYABLE_CARDS as readonly any[]).find(
  (c) => c.type === "minion" && String(c.id).startsWith("01") && c.keywords.length === 0,
)!.id as string;

// ---------------------------------------------------------------------------------------------------------------
// The villain
// ---------------------------------------------------------------------------------------------------------------

describe("Purple Man I-III: Influenced minions gain keywords (60097-60099 constant)", () => {
  const KEYWORDS = ["guard", "patrol", "villainous"] as const;
  // [stage, keywords an Influenced minion has that it does not print]
  it.each([
    [1, ["guard"]],
    [2, ["guard", "villainous"]],
    [3, ["guard", "patrol", "villainous"]],
  ] as const)("stage %i gives an Influenced minion exactly %j", (stage, gained) => {
    const s = engageMinion(newGame({ stage }), JUDGE, "pm-judge");
    const judge = "pm-judge" as InstanceId;
    expect(traitsOf(s, judge, WAVE11_DEPS)).toContain(INFLUENCED);
    for (const k of KEYWORDS)
      expect(hasKw(s, judge, k), `${k} at stage ${stage}`).toBe((gained as readonly string[]).includes(k));
  });

  it("a minion that is not Influenced gains nothing", () => {
    const s = engageMinion(newGame({ stage: 3 }), CORE_MINION, "pm-core");
    const core = "pm-core" as InstanceId;
    expect(traitsOf(s, core, WAVE11_DEPS)).not.toContain(INFLUENCED);
    for (const k of ["guard", "villainous"]) expect(hasKw(s, core, k)).toBe(false);
  });

  it("without Purple Man in play an Influenced minion has no guard (control)", () => {
    // Control: the same Judge in a game against a villain that is not Purple Man has no guard.
    const plain = coreScenario("rhino", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
      difficulty: "standard",
      modularSetIds: [],
      cardPool: PLAYABLE_CARDS,
    } as never);
    const created = createGame(plain, WAVE11_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const s = engageMinion(created.state, JUDGE, "pm-judge");
    expect(hasKw(s, "pm-judge" as InstanceId, "guard")).toBe(false);
  });
});

describe("Purple Man I-III: the granted Boost (60097-60099 constant-2)", () => {
  const skaterIn = (events: readonly GameEvent[], s: GameState) =>
    dealtMoves(events).filter((e) => codeOf(s, e.instanceId) === SKATER);

  it.each([1, 2, 3] as const)(
    "stage %i: a Purple Man boost card is dealt to the activated player as a facedown encounter card after the activation",
    (stage) => {
      const s = withForm(newGame({ stage }), "alterEgo");
      const run = phase(s, [SKATER], [JUDGE]);
      const dealt = skaterIn(run.events, s);
      expect(dealt).toHaveLength(1);
      expect(dealt[0]!.to).toEqual({ kind: "dealtEncounter", playerId: P1 });
      // It is revealed from there: the Skater Punk ends the phase in play, engaged with the player, not in the discard.
      expect(encounterDiscard(run.state)).not.toContain(SKATER);
      expect(engagedWith(run.state, idOf(run.state, SKATER))).toBe(P1);
    },
  );

  it("a boost card of another set is discarded as usual: nothing extra is dealt", () => {
    const s = withForm(newGame(), "alterEgo");
    const run = phase(s, [ASSAULT], [JUDGE]);
    expect(dealtMoves(run.events)).toHaveLength(1);
    expect(encounterDiscard(run.state)).toContain(ASSAULT);
  });

  it("'yourself' is the player the activation is against: P2's boost card is dealt to P2, P1's to P1", () => {
    const s = withForm(withForm(newGame({ players: 2 }), "alterEgo"), "alterEgo", P2);
    const second = phase(s, [ASSAULT, SKATER], [JUDGE, GUARD]);
    const dealtSkater = skaterIn(second.events, s);
    expect(dealtSkater).toHaveLength(1);
    expect(dealtSkater[0]!.to).toEqual({ kind: "dealtEncounter", playerId: P2 });
    const first = phase(s, [SKATER, ASSAULT], [JUDGE, GUARD]);
    expect(skaterIn(first.events, s)[0]!.to).toEqual({ kind: "dealtEncounter", playerId: P1 });
  });

  it("the boost card is turned over and discarded first; it is dealt only after the activation", () => {
    const s = withForm(newGame(), "alterEgo");
    const run = phase(s, [SKATER], [JUDGE]);
    const id = idOf(run.state, SKATER);
    const trail = moves(run.events)
      .filter((e) => e.instanceId === id)
      .map((e) => e.to.kind);
    expect(trail.indexOf("boost")).toBeLessThan(trail.indexOf("dealtEncounter"));
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Converted
// ---------------------------------------------------------------------------------------------------------------

describe("Converted 60100", () => {
  it("60100.when-revealed: attaches to the highest-cost ally you control and engages it", () => {
    let s = withForm(newGame(), "alterEgo");
    const cat = put(s, P1, BLACK_CAT);
    const woman = put(cat.state, P1, SPIDER_WOMAN);
    s = woman.state;
    const run = quiet(s, [CONVERTED]);
    const converted = idOf(run.state, CONVERTED);
    expect(inst(run.state, converted).attachedTo).toBe(woman.id);
    expect(inst(run.state, cat.id).attachments).toEqual([]);
    expect(engagedWith(run.state, woman.id)).toBe(P1);
  });

  it("60100.converted-constant: the ally is an Influenced minion (not an ally) whose SCH is its base THW", () => {
    const s = withForm(newGame(), "alterEgo");
    const woman = put(s, P1, SPIDER_WOMAN);
    const run = quiet(woman.state, [CONVERTED]);
    const id = woman.id;
    expect(categoriesOf(run.state, id)).toContain("minion");
    expect(categoriesOf(run.state, id)).not.toContain("ally");
    expect(traitsOf(run.state, id, WAVE11_DEPS)).toContain(INFLUENCED);
    // Spider-Woman prints THW 2 and no SCH.
    expect(characterProfile(run.state, id, WAVE11_DEPS)!.sch).toBe(2);
    // The Influenced minion gains the villain's guard.
    expect(hasKw(run.state, id, "guard")).toBe(true);
  });

  /** Round 1 reveals the Converted; round 2 (fresh hobbling) reveals `dealt`. */
  const twoRounds = (s: GameState, second: readonly string[]) => {
    const first = quiet(s, [CONVERTED]);
    return quiet(first.state, second);
  };

  it("60100.when-revealed: a second Converted takes the other ally, not the minion the first made", () => {
    const base = relabelEncounter(withForm(newGame(), "alterEgo"), ASSAULT, CONVERTED);
    const cat = put(base, P1, BLACK_CAT);
    const woman = put(cat.state, P1, SPIDER_WOMAN);
    const run = twoRounds(woman.state, [CONVERTED]);
    const converteds = Object.keys(run.state.instances).filter((i) => codeOf(run.state, i as InstanceId) === CONVERTED);
    expect(converteds).toHaveLength(2);
    const hosts = converteds.map((c) => inst(run.state, c as InstanceId).attachedTo).sort();
    expect(hosts).toEqual([cat.id, woman.id].sort());
    expect(engagedWith(run.state, cat.id)).toBe(P1);
  });

  it("60100.when-revealed: a second Converted with only the converted ally in play finds no ally and surges", () => {
    const base = relabelEncounter(withForm(newGame(), "alterEgo"), ASSAULT, CONVERTED);
    const woman = put(base, P1, SPIDER_WOMAN);
    const first = quiet(woman.state, [CONVERTED]);
    const run = quiet(first.state, [CONVERTED, SKATER]);
    expect(engagedWith(run.state, idOf(run.state, SKATER))).toBe(P1);
    const attachedToWoman = Object.keys(run.state.instances).filter(
      (i) =>
        codeOf(run.state, i as InstanceId) === CONVERTED && inst(run.state, i as InstanceId).attachedTo === woman.id,
    );
    expect(attachedToWoman).toHaveLength(1);
  });

  it("60103.when-defeated: Security Guard passes over a Converted ally (a minion, not an ally)", () => {
    const base = withForm(newGame(), "alterEgo");
    const cat = put(base, P1, BLACK_CAT);
    const woman = put(cat.state, P1, SPIDER_WOMAN);
    const run = quiet(woman.state, [CONVERTED]);
    const ready = patchInstance(
      withForm(engageMinion(run.state, GUARD, "pm-guard"), { heroForm: 0 }),
      hero(run.state),
      {
        exhausted: false,
      },
    );
    const after = defeatWithAttack(WAVE11_DEPS, ready, "pm-guard" as InstanceId);
    // Spider-Woman (ATK 2) is the stronger, but she is Converted: Black Cat (ATK 1) is the ally discarded.
    expect(playerOf(after, P1).discard).toContain(cat.id);
    expect(inst(after, woman.id).attachedTo ?? null).toBeNull();
    expect(playerOf(after, P1).playArea).toContain(woman.id);
  });

  it("60105.fight-forced-action: a Converted ally is a minion, so Fight does not offer it", () => {
    const base = withForm(newGame(), "alterEgo");
    const cat = put(base, P1, BLACK_CAT);
    const woman = put(cat.state, P1, SPIDER_WOMAN);
    const run = quiet(woman.state, [CONVERTED]);
    const fight = encounterInPlay(withForm(run.state, { heroForm: 0 }), P1, FIGHT, { command: 3 });
    const offered: string[] = [];
    driveEventsPicking(
      WAVE11_DEPS,
      fight.state,
      (st) => {
        offered.push(...st.pendingChoice!.options.map((o) => o.optionId));
        return firstLegal(st);
      },
      use(P1, fight.id, "60105.fight-forced-action"),
    );
    expect(offered.sort()).toEqual([cat.id, hero(fight.state)].sort());
  });

  it("60100.converted-constant: SCH is the base THW: a base another card sets is read, a +2 on top is not (RRG 1.8 Base Value, p. 10)", () => {
    const base = withForm(newGame(), "alterEgo");
    const woman = put(base, P1, SPIDER_WOMAN);
    const run = quiet(woman.state, [CONVERTED]);
    const sch = (ability: ReturnType<typeof constant>) => {
      const deps = { abilities: { ...WAVE11_DEPS.abilities, "test.thw": ability } } as typeof WAVE11_DEPS;
      const card = run.state.cardPool[inst(run.state, hero(run.state)).cardId]! as any;
      const withRef = {
        ...run.state,
        cardPool: {
          ...run.state.cardPool,
          [card.id]: {
            ...card,
            hero: { ...card.hero, abilities: [...card.hero.abilities, { id: "test.thw" }] },
            alterEgo: { ...card.alterEgo, abilities: [...card.alterEgo.abilities, { id: "test.thw" }] },
          },
        },
      } as GameState;
      return characterProfile(withRef, woman.id, deps)!.sch;
    };
    const influenced = query("minion", { trait: INFLUENCED });
    expect(sch(constant(gets("thw", 3, influenced, { setBase: true })))).toBe(3);
    expect(sch(constant(gets("thw", 2, influenced)))).toBe(2);
  });

  it("60100.converted-constant: its text box is blank: none of its printed keywords", () => {
    const keyworded = (PLAYABLE_CARDS as readonly any[]).find(
      (c) => c.type === "ally" && String(c.id).startsWith("01") && (c.keywords ?? []).length > 0,
    )!;
    const base = withForm(newGame(), "alterEgo");
    const ally = put(base, P1, keyworded.id as string);
    expect(keyworded.keywords.some((k: any) => hasKw(ally.state, ally.id, k.name))).toBe(true);
    const run = quiet(ally.state, [CONVERTED]);
    for (const k of keyworded.keywords) {
      // Guard, patrol and villainous are the villain's grant, not the ally's own text.
      if (["guard", "patrol", "villainous"].includes(k.name)) continue;
      expect(hasKw(run.state, ally.id, k.name), k.name).toBe(false);
    }
  });

  it("60100.when-revealed: in a two-player game it takes the revealing player's own highest-cost ally, not P2's", () => {
    let s = withForm(withForm(newGame({ players: 2 }), "alterEgo"), "alterEgo", P2);
    const cat = put(s, P1, BLACK_CAT);
    const fury = put(cat.state, P2, NICK_FURY);
    s = fury.state;
    // Dealt in turn order: P1 reveals Converted.
    // Cards are dealt from the top to the last player first, so P1 is dealt the second card.
    const run = quiet(s, [JUDGE, CONVERTED]);
    const converted = idOf(run.state, CONVERTED);
    expect(dealtMoves(run.events).find((e) => e.instanceId === converted)!.to).toEqual({
      kind: "dealtEncounter",
      playerId: P1,
    });
    expect(inst(run.state, converted).attachedTo).toBe(cat.id);
    expect(engagedWith(run.state, cat.id)).toBe(P1);
    expect(inst(run.state, fury.id).attachments).toEqual([]);
  });

  it("60100.when-revealed: with no ally to attach to it gains surge: the next card is revealed", () => {
    const s = withForm(newGame(), "alterEgo");
    const run = quiet(s, [CONVERTED, JUDGE]);
    expect(ofType(run.events, "surgeTriggered").length + ofType(run.events, "surgeGranted").length).toBeGreaterThan(0);
    expect(engagedWith(run.state, idOf(run.state, JUDGE))).toBe(P1);
    expect(encounterDiscard(run.state)).toContain(CONVERTED);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The civilians
// ---------------------------------------------------------------------------------------------------------------

describe("Firefighter 60101", () => {
  /** A hero-form P1 holding a tough status card, `code` engaged and the villain hobbled: the minion's one attack. */
  const attackedBy = (code: string) => {
    const s0 = newGame();
    const s = patchInstance(engageMinion(hobbled(s0), code, "pm-attacker"), hero(s0), {
      statuses: { stunned: 0, confused: 0, tough: 1 },
    });
    return phase(s, [ASSAULT], [GUARD]);
  };

  /** What the minion's own attack did to P1's identity: damage dealt by it, and whether tough prevented any. */
  const outcome = (code: string) => {
    const run = attackedBy(code);
    const dealt = ofType(run.events, "damageDealt").filter((e) => e.sourceInstanceId === ("pm-attacker" as InstanceId));
    const prevented = ofType(run.events, "damagePrevented").filter((e) => e.reason === "tough");
    return { run, dealt: dealt.reduce((n, e) => n + e.amount, 0), prevented: prevented.length };
  };

  it("60101.firefighter-constant: its attacks gain piercing: the tough status card is discarded and the damage is dealt", () => {
    const { dealt, prevented, run } = outcome(FIREFIGHTER);
    expect(prevented).toBe(0);
    expect(dealt).toBe(1);
    expect(tough(run.state, hero(run.state))).toBe(0);
  });

  it("60101.firefighter-constant: another minion's attack is stopped by the tough status card (control)", () => {
    const { dealt, prevented } = outcome(SKATER);
    expect(prevented).toBe(1);
    expect(dealt).toBe(0);
  });

  const withFirefighter = (s: GameState) => engageMinion(s, FIREFIGHTER, "pm-firefighter");
  const kill = (s: GameState, picker: Picker = firstLegal) => {
    const near = patchInstance(s, "pm-firefighter" as InstanceId, { damage: 999 });
    return driveEventsPicking(WAVE11_DEPS, near, picker, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(near),
      targetInstanceId: "pm-firefighter" as InstanceId,
    } as never);
  };

  it("60101.when-defeated: discards the highest-cost support or upgrade from play, whoever controls it", () => {
    let s = withFirefighter(newGame({ players: 2 }));
    const may = put(s, P1, AUNT_MAY);
    const webbed = put(may.state, P2, WEBBED_UP, { attach: true });
    s = webbed.state;
    const after = kill(s).state;
    expect(inst(after, webbed.id).attachedTo).toBeNull();
    expect(playerOf(after, P2).discard).toContain(webbed.id);
    expect(playerOf(after, P1).playArea).toContain(may.id);
  });

  it("60101.when-defeated: a support can be the highest; an ally or the identity never is", () => {
    let s = withFirefighter(newGame());
    const may = put(s, P1, AUNT_MAY);
    const mansion = put(may.state, P1, MANSION);
    const fury = put(mansion.state, P1, NICK_FURY);
    s = fury.state;
    const after = kill(s).state;
    expect(playerOf(after, P1).playArea).not.toContain(mansion.id);
    expect(playerOf(after, P1).playArea).toEqual(expect.arrayContaining([may.id, fury.id]));
  });

  it("60101.when-defeated: a tie for highest is decided by the first player, from exactly the two tied cards", () => {
    for (const first of [P1, P2]) {
      let s = withFirefighter(newGame({ players: 2 }));
      s = { ...s, firstPlayerId: first };
      const mansion = put(s, P1, MANSION);
      const webbed = put(mansion.state, P2, WEBBED_UP, { attach: true });
      const may = put(webbed.state, P1, AUNT_MAY);
      const { seen, pick } = tiePicker([mansion.id, webbed.id], webbed.id);
      const after = kill(may.state, pick).state;
      expect(seen).toHaveLength(1);
      expect(seen[0]!.chooser).toBe(first);
      expect([...seen[0]!.options].sort()).toEqual([mansion.id, webbed.id].sort());
      expect(inst(after, webbed.id).attachedTo).toBeNull();
      expect(playerOf(after, P1).playArea).toEqual(expect.arrayContaining([mansion.id, may.id]));
    }
  });

  it("60101.when-defeated: a Permanent upgrade is not a target (RRG 1.8 Permanent, p. 32): the other 0-cost card goes, unasked", () => {
    const base = withFirefighter(newGame());
    const gamma = put(base, P1, GAMMA, { attach: true });
    const channel = put(gamma.state, P1, ENERGY_CHANNEL, { attach: true });
    const offered: string[] = [];
    const after = kill(channel.state, (st) => {
      offered.push(...st.pendingChoice!.options.map((o) => o.optionId));
      return firstLegal(st);
    }).state;
    expect(inst(after, channel.id).attachedTo).toBeNull();
    expect(inst(after, gamma.id).attachedTo).toBe(hero(after));
    // Gamma is never offered, even though it ties Energy Channel at cost 0.
    expect(offered.filter((id) => id === gamma.id)).toEqual([]);
  });

  it("60101.when-defeated: a Permanent card is passed over for a dearer non-Permanent one too", () => {
    const base = withFirefighter(newGame());
    // Gamma (Permanent, cost 0) is passed over for Aunt May (cost 1); with Gamma alone nothing would go.
    const gamma = put(base, P1, GAMMA, { attach: true });
    const may = put(gamma.state, P1, AUNT_MAY);
    const after = kill(may.state).state;
    expect(playerOf(after, P1).playArea).not.toContain(may.id);
    expect(inst(after, gamma.id).attachedTo).toBe(hero(after));
  });

  it("60101.when-defeated: with no support or upgrade in play nothing happens", () => {
    const s = withFirefighter(newGame());
    const may = put(s, P1, AUNT_MAY);
    const ally = put(may.state, P1, NICK_FURY);
    // An ally is in play, but no support or upgrade: nothing is discarded.
    const bare = {
      ...ally.state,
      players: ally.state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== may.id) })),
    };
    const after = kill(bare).state;
    expect(playerOf(after, P1).playArea).toEqual(
      playerOf(bare, P1).playArea.filter((i) => i !== ("pm-firefighter" as InstanceId)),
    );
    expect(after.outcome).toBeNull();
  });
});

describe("Judge 60102", () => {
  it("60102.when-defeated: places 3 threat on the main scheme", () => {
    const s = engageMinion(newGame(), JUDGE, "pm-judge");
    const before = mainThreat(s);
    const after = defeatWithAttack(WAVE11_DEPS, s, "pm-judge" as InstanceId);
    expect(mainThreat(after)).toBe(before + 3);
  });
});

describe("Security Guard 60103", () => {
  const guard = (s: GameState) => engageMinion(s, GUARD, "pm-guard");
  const defeat = (s: GameState) => defeatWithAttack(WAVE11_DEPS, s, "pm-guard" as InstanceId);

  it("60103.when-defeated: discards the ally with the highest ATK in play", () => {
    const cat = put(guard(newGame()), P1, BLACK_CAT);
    const woman = put(cat.state, P1, SPIDER_WOMAN);
    const after = defeat(woman.state);
    expect(playerOf(after, P1).playArea).not.toContain(woman.id);
    expect(playerOf(after, P1).discard).toContain(woman.id);
    expect(playerOf(after, P1).playArea).toContain(cat.id);
  });

  it("60103.when-defeated: any player's ally counts: P2's stronger ally goes, in a two-player game", () => {
    const cat = put(guard(newGame({ players: 2 })), P1, BLACK_CAT);
    const fury = put(cat.state, P2, NICK_FURY);
    const after = defeat(fury.state);
    expect(playerOf(after, P2).playArea).not.toContain(fury.id);
    expect(playerOf(after, P1).playArea).toContain(cat.id);
  });

  it("60103.when-defeated: a tie is decided by the first player, from exactly the two tied allies", () => {
    for (const first of [P1, P2]) {
      const base = { ...guard(newGame({ players: 2 })), firstPlayerId: first };
      const woman = put(base, P1, SPIDER_WOMAN);
      const fury = put(woman.state, P2, NICK_FURY);
      const cat = put(fury.state, P1, BLACK_CAT);
      const { seen, pick } = tiePicker([woman.id, fury.id], fury.id);
      const near = patchInstance(cat.state, "pm-guard" as InstanceId, { damage: 999 });
      const after = driveEventsPicking(WAVE11_DEPS, near, pick, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: hero(near),
        targetInstanceId: "pm-guard" as InstanceId,
      } as never).state;
      expect(seen).toHaveLength(1);
      expect(seen[0]!.chooser).toBe(first);
      expect([...seen[0]!.options].sort()).toEqual([woman.id, fury.id].sort());
      expect(playerOf(after, P2).playArea).not.toContain(fury.id);
      expect(playerOf(after, P1).playArea).toEqual(expect.arrayContaining([woman.id, cat.id]));
    }
  });

  it("60103.when-defeated: with no ally in play nothing happens", () => {
    const after = defeat(guard(newGame()));
    expect(after.outcome).toBeNull();
  });
});

describe("Skater Punk 60104", () => {
  it("60104.when-defeated: deals 3 damage to the defeating player's identity, not another player's", () => {
    for (const [attacker, other] of [
      [P1, P2],
      [P2, P1],
    ] as const) {
      // Engaged with the other player, so the defeating player is neither the engaged player nor always the first.
      const s = engageMinion(newGame({ players: 2 }), SKATER, "pm-skater", other);
      const after = defeatWithAttack(
        WAVE11_DEPS,
        { ...s, step: { ...s.step, activePlayerId: attacker } } as GameState,
        "pm-skater" as InstanceId,
        attacker,
      );
      expect(damageOf(after, hero(after, attacker))).toBe(3);
      expect(damageOf(after, hero(after, other))).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The obligations
// ---------------------------------------------------------------------------------------------------------------

describe('"Fight." / "Protect." / "Serve." (60105-60107)', () => {
  const REF = {
    [FIGHT]: "60105.fight-forced-action",
    [PROTECT]: "60106.protect-forced-action",
    [SERVE]: "60107.serve-forced-action",
  } as const;
  const play = (code: keyof typeof REF, counters = 3, players = 1) => {
    const placed = encounterInPlay(newGame({ players }), P1, code, { command: counters });
    return { ...placed, ref: REF[code] };
  };
  const fire = (s: GameState, id: InstanceId, ref: string, pick: Picker = firstLegal) =>
    driveEventsPicking(WAVE11_DEPS, s, pick, use(P1, id, ref));

  it("revealed from the encounter deck each holds 3 command counters (Uses)", () => {
    const s = withForm(newGame(), "alterEgo");
    for (const code of [FIGHT, PROTECT, SERVE]) {
      const run = quiet(s, [code]);
      expect(inst(run.state, idOf(run.state, code)).counters.command).toBe(3);
    }
  });

  it("60106.protect-forced-action: exhausts the card, removes a counter, gives the villain a tough status card", () => {
    const p = play(PROTECT);
    const run = fire(p.state, p.id, p.ref);
    expect(tough(run.state, villainOf(run.state))).toBe(1);
    expect(inst(run.state, p.id).exhausted).toBe(true);
    expect(inst(run.state, p.id).counters.command).toBe(2);
  });

  it("60107.serve-forced-action: places 2 threat on the main scheme", () => {
    const p = play(SERVE);
    const before = mainThreat(p.state);
    const run = fire(p.state, p.id, p.ref);
    expect(mainThreat(run.state)).toBe(before + 2);
    expect(inst(run.state, p.id).exhausted).toBe(true);
    expect(inst(run.state, p.id).counters.command).toBe(2);
  });

  it("60105.fight-forced-action: deals 2 damage to a hero or ally and pays its cost", () => {
    const p = play(FIGHT);
    const run = fire(p.state, p.id, p.ref);
    expect(damageOf(run.state, hero(run.state))).toBe(2);
    expect(inst(run.state, p.id).exhausted).toBe(true);
    expect(inst(run.state, p.id).counters.command).toBe(2);
  });

  it("60105.fight-forced-action: an ally is a legal target", () => {
    const p = play(FIGHT);
    // Nick Fury has 3 hit points, so 2 damage leaves him in play.
    const cat = put(p.state, P1, NICK_FURY);
    const offered: string[] = [];
    const run = fire(cat.state, p.id, p.ref, (st) => {
      for (const o of st.pendingChoice!.options) offered.push(`${o.optionId} ${(o as any).label ?? ""}`);
      const pick = st.pendingChoice!.options.find((o) => JSON.stringify(o).includes(cat.id));
      return pick ? [pick.optionId] : firstLegal(st);
    });
    expect(offered.length).toBeGreaterThan(1);
    expect(damageOf(run.state, cat.id)).toBe(2);
    expect(damageOf(run.state, hero(run.state))).toBe(0);
  });

  it("each is unavailable with no command counter left or while exhausted", () => {
    for (const code of [FIGHT, PROTECT, SERVE] as const) {
      const spent = play(code, 0);
      expect(() => fire(spent.state, spent.id, spent.ref), `${code} with no counters`).toThrow();
      const tired = play(code);
      const exhausted = patchInstance(tired.state, tired.id, { exhausted: true });
      expect(() => fire(exhausted, tired.id, tired.ref), `${code} exhausted`).toThrow();
    }
  });

  it("the last command counter: the ability still resolves, then the card is discarded (RRG 1.8 Uses, p. 46)", () => {
    const p = play(SERVE, 1);
    const before = mainThreat(p.state);
    const once = fire(p.state, p.id, p.ref);
    expect(mainThreat(once.state)).toBe(before + 2);
    expect(playerOf(once.state, P1).playArea).not.toContain(p.id);
    expect(encounterDiscard(once.state)).toContain(SERVE);
  });

  it("an obligation lands in the play area of the player it was dealt to, with 3 command counters", () => {
    const s = withForm(withForm(newGame({ players: 2 }), "alterEgo"), "alterEgo", P2);
    // The top card is dealt to the last player.
    const run = quiet(s, [FIGHT, JUDGE]);
    const fight = idOf(run.state, FIGHT);
    expect(playerOf(run.state, P2).playArea).toContain(fight);
    expect(playerOf(run.state, P1).playArea).not.toContain(fight);
    expect(inst(run.state, fight).counters.command).toBe(3);
  });

  it("60105.fight-forced-action: its holder chooses among every hero and ally, P2's included", () => {
    // RRG 1.8 "Obligation" (p. 30) and "Choose" (p. 12): the player the card is with makes the choice; "First Player"
    // (p. 19) decides only ties and ambiguity, so the first player being P2 changes nothing here.
    const base = { ...newGame({ players: 2 }), firstPlayerId: P2 };
    const own = put(base, P1, BLACK_CAT);
    const fury = put(own.state, P2, NICK_FURY);
    const p = encounterInPlay(fury.state, P1, FIGHT, { command: 3 });
    const prompts: { chooser: PlayerId; options: string[] }[] = [];
    const run = driveEventsPicking(
      WAVE11_DEPS,
      p.state,
      (st) => {
        prompts.push({
          chooser: st.pendingChoice!.playerId,
          options: st.pendingChoice!.options.map((o) => o.optionId),
        });
        return [fury.id];
      },
      use(P1, p.id, "60105.fight-forced-action"),
    );
    expect(prompts).toHaveLength(1);
    expect(prompts[0]!.chooser).toBe(P1);
    expect([...prompts[0]!.options].sort()).toEqual([hero(p.state, P1), hero(p.state, P2), own.id, fury.id].sort());
    expect(damageOf(run.state, fury.id)).toBe(2);
    expect(damageOf(run.state, hero(run.state, P2))).toBe(0);
  });

  it("the three constant refs carry no effect of their own (Uses is data)", () => {
    for (const ref of ["60105.fight-constant", "60106.protect-constant", "60107.serve-constant"]) {
      expect(REGISTRY[ref]!.trigger.kind).toBe("constant");
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Power of Suggestion and Sway the Masses
// ---------------------------------------------------------------------------------------------------------------

describe("Power of Suggestion 60108", () => {
  const withScheme = (s: GameState) => encounterCardInVillainArea(s, SUGGESTION, 2).state;

  it("60108.power-of-suggestion-constant: each minion gains the Influenced trait while it is in play", () => {
    const base = engageMinion(newGame(), CORE_MINION, "pm-core");
    const core = "pm-core" as InstanceId;
    expect(traitsOf(base, core, WAVE11_DEPS)).not.toContain(INFLUENCED);
    const staged = withScheme(base);
    expect(traitsOf(staged, core, WAVE11_DEPS)).toContain(INFLUENCED);
  });

  it("60108.power-of-suggestion-constant: with Purple Man in play the new Influenced minion gains his guard", () => {
    const base = engageMinion(newGame(), CORE_MINION, "pm-core");
    const core = "pm-core" as InstanceId;
    expect(hasKw(base, core, "guard")).toBe(false);
    expect(hasKw(withScheme(base), core, "guard")).toBe(true);
  });

  it("60108.power-of-suggestion-constant: it does not touch non-minions", () => {
    const s = withScheme(newGame());
    expect(traitsOf(s, hero(s), WAVE11_DEPS)).not.toContain(INFLUENCED);
  });
});

describe("Sway the Masses 60109", () => {
  /** The encounter discard pile holding exactly these cards. */
  const discardHolding = (s: GameState, ...codes: string[]): GameState => {
    const deckId = activeEncounterDeckId(s);
    const pile = s.encounterDecks[deckId]!;
    const ids = codes.map((c) => [...pile.deck, ...pile.discard].find((i) => codeOf(s, i) === c)!);
    return {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]: {
          deck: pile.deck.filter((i) => !ids.includes(i)),
          discard: [...pile.discard.filter((i) => !ids.includes(i)), ...ids],
        },
      },
    };
  };

  it("60109.when-revealed: reveals the chosen Influenced minion from the encounter discard pile", () => {
    const s = discardHolding(withForm(newGame(), "alterEgo"), FIREFIGHTER, JUDGE);
    const wanted = idOf(s, JUDGE);
    const pick: Picker = (st) => {
      const choice = st.pendingChoice!;
      const hit = choice.options.find((o) => JSON.stringify(o).includes(wanted));
      return hit ? [hit.optionId] : firstLegal(st);
    };
    const run = quiet(s, [SWAY], pick);
    expect(engagedWith(run.state, wanted)).toBe(P1);
    expect(engagedWith(run.state, idOf(run.state, FIREFIGHTER))).toBeNull();
    expect(encounterDiscard(run.state)).toContain(FIREFIGHTER);
  });

  it("60109.when-revealed: a minion that is not Influenced in the discard pile is not offered", () => {
    const s = discardHolding(withForm(newGame(), "alterEgo"), CORE_MINION);
    const run = quiet(s, [SWAY, GUARD]);
    // Nothing to reveal: Sway gains surge and the Security Guard behind it is revealed instead.
    expect(engagedWith(run.state, idOf(run.state, GUARD))).toBe(P1);
    expect(encounterDiscard(run.state)).toContain(CORE_MINION);
  });

  it("60109.when-revealed: with no Influenced minion in the discard pile it gains surge", () => {
    const s = withForm(newGame(), "alterEgo");
    const run = quiet(s, [SWAY, JUDGE]);
    expect(engagedWith(run.state, idOf(run.state, JUDGE))).toBe(P1);
  });

  it("60109.when-revealed: the revealing player chooses and the minion engages them (two players)", () => {
    const s = discardHolding(withForm(withForm(newGame({ players: 2 }), "alterEgo"), "alterEgo", P2), FIREFIGHTER);
    const run = quiet(s, [SWAY, JUDGE]);
    // P2 is dealt Sway the Masses (the top card goes to the last player): the Firefighter comes out to P2.
    expect(engagedWith(run.state, idOf(run.state, FIREFIGHTER))).toBe(P2);
  });
});
