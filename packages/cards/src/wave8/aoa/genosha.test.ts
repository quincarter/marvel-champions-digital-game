import { AOA_CARDS, CORE_CARDS, HOOD_CARDS, cardId, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  createGame,
  hasKeyword,
  legalActions,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, playFromHand, withForm } from "../../testing/staging.js";
import { attachToHost } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { GENOSHA, GENOSHA_SKIPPED } from "./genosha.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Genosha set (45133 Genosha, 45134 Magistrate, 45135 Armored Unibike, 45136 Genoshan Mech, 45137 Escaped Mutant,
 * 45138 Police State), docs/phase7-wave8.md §3.24, §3.25, §3.31, §4.1 Q15 and Q17. Rhino (Core, standard) built by
 * `coreScenario` with the Age of Apocalypse cards in the pool and the set's cards added to the encounter deck by hand.
 * Genosha has the setup keyword, so it starts in play. Cards are stacked on the encounter deck (the boost cards of the
 * round's activations first, then what each player is dealt) and revealed by real `endTurn` commands.
 */
const GENOSHA_ENV = "45133";
const MAGISTRATE = "45134";
const UNIBIKE = "45135";
const MECH = "45136";
const MUTANT = "45137";
const POLICE_STATE = "45138";
const SET = [GENOSHA_ENV, MAGISTRATE, UNIBIKE, MECH, MUTANT, POLICE_STATE];
const REFS = [
  "45133.genosha-constant",
  "45133.genosha-special",
  "45133.when-revealed",
  "45134.when-defeated",
  "45134.boost",
  "45135.armored-unibike-constant",
  "45135.armored-unibike-forced-response",
  "45136.genoshan-mech-forced-response",
  "45137.escaped-mutant-constant",
  "45137.escaped-mutant-action",
  "45138.when-defeated",
];
/** Core treachery of 1 and 2 boost icons with no boost ability; the Rhino attachment that does nothing. */
const BLANK = "01186";
const BLANK_2 = "01187";
const HARMLESS = "01098";
const FILLERS = ["01098", "01100"];
/** A player ally from Spider-Man's Justice deck: 3 hit points. */
const JESSICA_JONES = "01059";
/** The Hood's Secret Lair: a Setting environment. */
const LAIR = "24061";
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, GENOSHA) };

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

/** `env: false` leaves Genosha out of the encounter deck, so no Setting environment is in play. */
function setupGame(
  players: Seats = [SPIDER_MAN],
  opts: { env?: boolean; extra?: readonly string[]; deps?: EngineDeps } = {},
): GameState {
  const config = coreScenario("rhino", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS, ...HOOD_CARDS],
  });
  const cards = AOA_CARDS.filter(
    (c) =>
      "encounterSetIds" in c &&
      c.encounterSetIds.includes(encounterSetId("genosha")) &&
      (opts.env !== false || (c.id as string) !== GENOSHA_ENV),
  );
  const copies = cards.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const deps = opts.deps ?? DEPS;
  const created = createGame(
    { ...config, encounterDeck: [...config.encounterDeck, ...copies, ...(opts.extra ?? []).map(cardId)] },
    deps,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", deps);
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const piles = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
const inDeck = (s: GameState, code: string) => piles(s).deck.filter((id) => codeOf(s, id) === code);
const inDiscard = (s: GameState, code: string) => piles(s).discard.filter((id) => codeOf(s, id) === code);
const inPlayCards = (s: GameState, code: string) => cardsInPlay(s).filter((id) => codeOf(s, id) === code);
const minionOf = (s: GameState, code: string): InstanceId => inPlayCards(s, code)[0]!;
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const types = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const attacksBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "attackResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);
/** The threat the Special put on the main scheme in a run: placements whose source is the Genosha environment. */
const specialThreat = (run: Run, envId: InstanceId): number =>
  types(run.events, "threatPlaced")
    .filter((e) => e.schemeInstanceId === run.state.mainScheme.instanceId && e.sourceInstanceId === envId)
    .reduce((n, e) => n + e.amount, 0);
const mutantHolder = (s: GameState): PlayerId | undefined =>
  s.players.find((p) => inst(s, identityOf(s, p.playerId)).attachments.some((a) => codeOf(s, a) === MUTANT))?.playerId;

function turnOrder(state: GameState): readonly PlayerId[] {
  const ids = state.players.map((p) => p.playerId);
  const active = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : ids[0]!;
  const at = ids.indexOf(active);
  return [...ids.slice(at), ...ids.slice(0, at)];
}

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
/**
 * Every player ends their turn (those in `hero` first change to hero form) and the villain phase runs. `boosts` are the
 * boost cards of the activations (one each), `reveals` what the players are dealt. Rhino's main scheme is emptied and
 * each identity healed first, so rounds start the same way.
 */
function round(
  state: GameState,
  opts: { boosts?: readonly string[]; reveals?: readonly string[]; hero?: readonly PlayerId[]; pick?: Picker },
): Run {
  const players = state.players.length;
  const available = ["01188", "01189", "01186", "01187"].filter((code) =>
    piles(state).deck.some((id) => codeOf(state, id) === code),
  );
  const boosts = opts.boosts ?? available.slice(0, players);
  const calm = state.players.reduce(
    (acc, p) => patchInstance(acc, p.identity.instanceId, { damage: 0 }),
    patchInstance(state, state.mainScheme.instanceId, { threat: 0 }),
  );
  const named = opts.reveals ?? [];
  const spare = FILLERS.filter(
    (code) => !named.includes(code) && piles(calm).deck.some((id) => codeOf(calm, id) === code),
  );
  const reveals = [...named, ...spare.slice(0, Math.max(0, players - named.length))];
  const stacked = stackEncounterDeck(calm, ...boosts, ...reveals);
  const heroes = opts.hero ?? [];
  const commands = turnOrder(state).flatMap((id) => [
    ...(heroes.includes(id) && playerOf(state, id).identity.form !== "hero" ? [toHero(id)] : []),
    endTurn(id),
  ]);
  return driveEventsPicking(DEPS, stacked, opts.pick ?? firstLegal, ...commands);
}
const control = (state: GameState) => round(state, { reveals: [] });
const mainDelta = (a: Run, b: Run): number => mainThreat(a.state) - mainThreat(b.state);

describe("registry", () => {
  it("registers the eleven refs of the six cards, each a valid definition; nothing is skipped", () => {
    expect(Object.keys(GENOSHA).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(GENOSHA)) expect(validateDefinition(def), id).toEqual([]);
    expect(Object.keys(GENOSHA_SKIPPED)).toEqual([]);
  });

  it("the data names exactly these refs", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });
});

describe("setup", () => {
  it("Genosha starts in play, not in the deck; the other cards (two Magistrates, two Unibikes) are in the deck", () => {
    const s = setupGame();
    expect(inPlayCards(s, GENOSHA_ENV)).toHaveLength(1);
    expect(inDeck(s, GENOSHA_ENV)).toHaveLength(0);
    expect(inDeck(s, MAGISTRATE)).toHaveLength(2);
    expect(inDeck(s, UNIBIKE)).toHaveLength(2);
    for (const code of [MECH, MUTANT, POLICE_STATE]) expect(inDeck(s, code), code).toHaveLength(1);
  });
});

describe("Genosha (45133)", () => {
  it("is data: an environment, LOCATION and SETTING, setup, 3 boost icons", () => {
    const card = dataOf(GENOSHA_ENV);
    expect(card.type).toBe("environment");
    expect(card.traits).toEqual(["LOCATION", "SETTING"]);
    expect(card.keywords).toEqual([{ name: "setup" }]);
    expect(card.boostIcons).toBe(3);
  });

  it("the villain gains steady while it is in play, and not without it", () => {
    const withEnv = setupGame();
    expect(hasKeyword(withEnv, withEnv.activeVillainId!, "steady", DEPS)).toBe(true);
    const without = setupGame([SPIDER_MAN], { env: false });
    expect(hasKeyword(without, without.activeVillainId!, "steady", DEPS)).toBe(false);
  });

  it("WHEN REVEALED: discards each other Setting environment (the Secret Lair revealed first, then Genosha)", () => {
    const first = round(setupGame([SPIDER_MAN], { extra: [LAIR] }), { reveals: [LAIR, HARMLESS] });
    expect(inPlayCards(first.state, LAIR)).toHaveLength(1);
    expect(inPlayCards(first.state, GENOSHA_ENV)).toHaveLength(0);
    expect(inDiscard(first.state, GENOSHA_ENV)).toHaveLength(1);
    const second = round(first.state, { reveals: [GENOSHA_ENV] });
    expect(inPlayCards(second.state, GENOSHA_ENV)).toHaveLength(1);
    expect(inPlayCards(second.state, LAIR)).toHaveLength(0);
    expect(inDiscard(second.state, LAIR)).toHaveLength(1);
  });

  it("SPECIAL: never resolves on its own (0 extra threat in a round with nothing that instructs it)", () => {
    const s = setupGame();
    expect(mainDelta(round(s, { reveals: [HARMLESS] }), control(s))).toBe(0);
  });
});

/** Round 1: the card is dealt to player 1 (an alter-ego, so it does not attack). */
function withMinion(code: string, players: Seats = [SPIDER_MAN], opts: { env?: boolean } = {}): GameState {
  const s = setupGame(players, opts);
  return round(s, { reveals: players.length === 1 ? [code] : [code, HARMLESS] }).state;
}

describe("Armored Unibike (45135)", () => {
  it("is data: a Genosha Vehicle minion with 2 ATK, 1 SCH, 4 hit points and 1 boost icon", () => {
    const card = dataOf(UNIBIKE);
    expect([card.atk, card.sch, card.hp, card.boostIcons]).toEqual([2, 1, 4, 1]);
    expect(card.traits).toEqual(["GENOSHA", "VEHICLE"]);
  });

  it("with nobody holding Escaped Mutant, it engages the revealing player and has no quickstrike", () => {
    const s = withMinion(UNIBIKE, [SPIDER_MAN, CAPTAIN_MARVEL]);
    expect(inst(s, minionOf(s, UNIBIKE)).engagedWith).toBe(P1);
    expect(hasKeyword(s, minionOf(s, UNIBIKE), "quickstrike", DEPS)).toBe(false);
  });

  it("player 2 holds Escaped Mutant, player 1 reveals Unibike: it engages player 2 and has quickstrike", () => {
    const s0 = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const staged = attachToHost(s0, MUTANT, identityOf(s0, P2)).state;
    const s = round(staged, { reveals: [UNIBIKE, HARMLESS] }).state;
    expect(inst(s, minionOf(s, UNIBIKE)).engagedWith).toBe(P2);
    expect(hasKeyword(s, minionOf(s, UNIBIKE), "quickstrike", DEPS)).toBe(true);
  });

  it("FORCED RESPONSE: after it attacks, the attacked player resolves the Special: 1 threat on the main scheme", () => {
    const s = withMinion(UNIBIKE);
    const run = round(s, { reveals: [], hero: [P1], boosts: [BLANK, BLANK_2] });
    expect(attacksBy(run.state, run.events, UNIBIKE)).toHaveLength(1);
    expect(specialThreat(run, inPlayCards(s, GENOSHA_ENV)[0]!)).toBe(1);
  });

  it("[star] with Genosha not in play, the Special has nothing to resolve: no threat", () => {
    const s = withMinion(UNIBIKE, [SPIDER_MAN], { env: false });
    const run = round(s, { reveals: [], hero: [P1], boosts: [BLANK, BLANK_2] });
    expect(attacksBy(run.state, run.events, UNIBIKE)).toHaveLength(1);
    expect(types(run.events, "threatPlaced").filter((e) => e.sourceInstanceId !== null)).toEqual([]);
  });
});

describe("Escaped Mutant (45137)", () => {
  it("is data: an attachment to your identity with 3 boost icons", () => {
    const card = dataOf(MUTANT);
    expect(card.type).toBe("attachment");
    expect(card.attachesTo).toEqual({ kind: "yourIdentity" });
    expect(card.boostIcons).toBe(3);
  });

  it("each Genosha minion that engages the host's player has quickstrike; a minion engaged with another player does not", () => {
    const s0 = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const staged = attachToHost(s0, MUTANT, identityOf(s0, P2)).state;
    const s = round(staged, { reveals: [MAGISTRATE, MAGISTRATE] }).state;
    const [onP1, onP2] = [P1, P2].map((p) => inPlayCards(s, MAGISTRATE).find((id) => inst(s, id).engagedWith === p)!);
    expect(hasKeyword(s, onP2!, "quickstrike", DEPS)).toBe(true);
    expect(hasKeyword(s, onP1!, "quickstrike", DEPS)).toBe(false);
  });

  it("a non-Genosha minion engaged with the host's player does not gain quickstrike", () => {
    const s0 = setupGame([SPIDER_MAN]);
    const staged = attachToHost(s0, MUTANT, identityOf(s0, P1)).state;
    const s = round(staged, { reveals: ["01101"] }).state; // Hydra Mercenary
    expect(inst(s, minionOf(s, "01101")).engagedWith).toBe(P1);
    expect(hasKeyword(s, minionOf(s, "01101"), "quickstrike", DEPS)).toBe(false);
  });
});

describe("Escaped Mutant's Action (45137): the Setting environment's Special is its cost (§3.24)", () => {
  const ACTION = "45137.escaped-mutant-action";
  /** Escaped Mutant attached to player 1's identity, in `form`; `env: false` leaves no Setting environment in play. */
  const staged = (env: boolean, form: "alterEgo" | "hero" = "alterEgo") => {
    const s0 = setupGame([SPIDER_MAN], { env });
    const attached = attachToHost(s0, MUTANT, identityOf(s0, P1));
    const state = form === "hero" ? withForm(attached.state, { heroForm: 0 }) : withForm(attached.state, "alterEgo");
    return { state, mutant: attached.id };
  };
  const offered = (state: GameState): boolean => {
    const actions = legalActions(state, P1, DEPS);
    return (
      actions.kind === "turn" &&
      actions.legal.some((a) => a.action.kind === "useAbility" && (a.action.abilityId as string) === ACTION)
    );
  };

  it("with Genosha in play: 1 threat on the main scheme from the Special, then the card is discarded", () => {
    const { state, mutant } = staged(true);
    expect(offered(state)).toBe(true);
    const run = driveEventsPicking(DEPS, state, firstLegal, use(P1, mutant, ACTION));
    expect(mainThreat(run.state)).toBe(mainThreat(state) + 1);
    expect(specialThreat(run, inPlayCards(state, GENOSHA_ENV)[0]!)).toBe(1);
    expect(inPlayCards(run.state, MUTANT)).toHaveLength(0);
    expect(inDiscard(run.state, MUTANT)).toHaveLength(1);
    expect(types(run.events, "resolveAbilityCostSettled")).toMatchObject([{ trigger: "special", paid: true }]);
    // The cost resolves before the effect (RRG 1.8 "Cost Arrow Icon", p. 14).
    const settledAt = run.events.findIndex((e) => e.type === "resolveAbilityCostSettled");
    const discardedAt = run.events.findIndex((e) => e.type === "cardDiscardedFromPlay" && e.instanceId === mutant);
    expect(discardedAt).toBeGreaterThan(settledAt);
  });

  it("with no Setting environment in play the action is not offered and the command is refused", () => {
    const { state, mutant } = staged(false);
    expect(offered(state)).toBe(false);
    expect(() => driveEventsPicking(DEPS, state, firstLegal, use(P1, mutant, ACTION))).toThrow();
    expect(inPlayCards(state, MUTANT)).toHaveLength(1);
  });

  it("is an Alter-Ego Action: not offered in hero form", () => {
    expect(offered(staged(true, "hero").state)).toBe(false);
  });
});

/** A real basic attack by `who` that defeats `target`: the active player's, after the others have ended their turns. */
function defeatAs(state: GameState, target: InstanceId, who: PlayerId): GameState {
  const active = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : who;
  const lead = active === who ? state : driveEventsPicking(DEPS, state, firstLegal, endTurn(active)).state;
  return defeatWithAttack(DEPS, withForm(lead, { heroForm: 0 }, who), target, who);
}

describe("Magistrate (45134)", () => {
  it("is data: a Genosha minion with patrol, 2 ATK, 2 SCH, 3 hit points, 0 boost icons and a star", () => {
    const card = dataOf(MAGISTRATE);
    expect([card.atk, card.sch, card.hp, card.boostIcons, card.starIcon]).toEqual([2, 2, 3, 0, true]);
    expect(card.keywords).toEqual([{ name: "patrol" }]);
  });

  it("[star] BOOST: against the player holding Escaped Mutant it adds 3 icons (+3 scheme threat); otherwise 0", () => {
    const s0 = setupGame();
    const base = control(s0);
    const without = round(s0, { boosts: [MAGISTRATE], reveals: [] });
    expect(mainDelta(without, base)).toBe(-1);
    const held = attachToHost(s0, MUTANT, identityOf(s0, P1)).state;
    const withMutant = round(held, { boosts: [MAGISTRATE], reveals: [] });
    expect(mainDelta(withMutant, base)).toBe(2);
  });

  it("WHEN DEFEATED: the defeating player attaches Escaped Mutant to their identity, from the deck", () => {
    const s = withMinion(MAGISTRATE);
    expect(mutantHolder(s)).toBeUndefined();
    const done = defeatAs(s, minionOf(s, MAGISTRATE), P1);
    expect(mutantHolder(done)).toBe(P1);
    expect(inDeck(done, MUTANT)).toHaveLength(0);
  });

  it("WHEN DEFEATED: defeated by player 1 with the card on player 2, it moves to player 1", () => {
    const s0 = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const staged = attachToHost(s0, MUTANT, identityOf(s0, P2)).state;
    const s = round(staged, { reveals: [MAGISTRATE, HARMLESS] }).state;
    const done = defeatAs(s, minionOf(s, MAGISTRATE), P1);
    expect(mutantHolder(done)).toBe(P1);
  });
});

describe("Police State (45138)", () => {
  it("is data: a side scheme with 2 threat, hinder 1 per hero, hazard, 2 boost icons", () => {
    const card = dataOf(POLICE_STATE);
    expect(card.startingThreat).toEqual({ base: 2, perPlayer: 0 });
    expect(card.keywords).toEqual([{ name: "hinder", value: 0, perPlayer: 1 }]);
    expect(card.boostIcons).toBe(2);
  });

  it("WHEN DEFEATED: the defeating player finds Escaped Mutant in the deck and reveals it: attached to their identity", () => {
    const s = round(setupGame(), { reveals: [POLICE_STATE] }).state;
    const scheme = inPlayCards(s, POLICE_STATE)[0]!;
    expect(scheme).toBeDefined();
    const done = defeatThreat(s, scheme);
    expect(mutantHolder(done)).toBe(P1);
  });

  it("WHEN DEFEATED (Q17 = A): with Escaped Mutant already on player 2 it stays there", () => {
    const s0 = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const staged = attachToHost(s0, MUTANT, identityOf(s0, P2)).state;
    const s = round(staged, { reveals: [POLICE_STATE, HARMLESS] }).state;
    const done = defeatThreat(s, inPlayCards(s, POLICE_STATE)[0]!);
    expect(mutantHolder(done)).toBe(P2);
  });
});

/** Player 1 thwarts all of the side scheme's threat with a real basic thwart. */
function defeatThreat(state: GameState, scheme: InstanceId): GameState {
  const active = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : P1;
  const lead = active === P1 ? state : driveEventsPicking(DEPS, state, firstLegal, endTurn(active)).state;
  const hero = withForm(patchInstance(lead, scheme, { threat: 1 }), { heroForm: 0 });
  const done = driveEventsPicking(DEPS, hero, firstLegal, {
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: identityOf(hero, P1),
    schemeInstanceId: scheme,
  });
  return done.state;
}

describe("Genoshan Mech (45136)", () => {
  it("is data: a Genosha Vehicle minion with guard and toughness, 3 ATK, 2 SCH, 5 hit points", () => {
    const card = dataOf(MECH);
    expect([card.atk, card.sch, card.hp, card.boostIcons]).toEqual([3, 2, 5, 2]);
    expect(card.keywords).toEqual([{ name: "guard" }, { name: "toughness" }]);
  });

  /** The Mech attacks player 1, who defends with Jessica Jones (3 hit points) when `defend`. */
  function mechAttack(defend: boolean) {
    const s = withMinion(MECH);
    const staged = playFromHand(DEPS, s, JESSICA_JONES, 3, firstLegal).state;
    const ally = inPlayCards(staged, JESSICA_JONES)[0]!;
    // Rhino attacks first (nobody defends), then the Mech: the ally defends against it only.
    let declared = 0;
    const pick: Picker = (st) => {
      const choice = st.pendingChoice!;
      if (choice.prompt.kind === "declareDefender") {
        declared += 1;
        return declared === 2 && defend && choice.options.some((o) => o.optionId === ally) ? [ally] : ["decline"];
      }
      return firstLegal(st);
    };
    const run = round(staged, { reveals: [], hero: [P1], boosts: [BLANK, BLANK_2], pick });
    return { run, allyInPlay: cardsInPlay(run.state).includes(ally), env: inPlayCards(staged, GENOSHA_ENV)[0]! };
  }

  it("FORCED RESPONSE: attacks and defeats an ally: the Special is resolved twice, 2 threat on the main scheme", () => {
    const { run, allyInPlay, env } = mechAttack(true);
    expect(attacksBy(run.state, run.events, MECH)).toHaveLength(1);
    expect(allyInPlay).toBe(false);
    expect(specialThreat(run, env)).toBe(2);
  });

  it("attacks and does not defeat an ally (it attacks the hero): 0 threat", () => {
    const { run, allyInPlay, env } = mechAttack(false);
    expect(attacksBy(run.state, run.events, MECH)).toHaveLength(1);
    expect(allyInPlay).toBe(true);
    expect(specialThreat(run, env)).toBe(0);
  });
});
