import { CW_CARDS, trait } from "@mc/content";
import {
  createGame,
  hasKeyword,
  keywordTotal,
  mainSchemeValue,
  maxHitPoints,
  traitsOf,
  type GameEvent,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { competitiveOnlyTexts, validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  P3,
  P4,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  patchInstance,
  playerOf,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, playFromHand, withForm } from "../../../testing/staging.js";
import { codeOf, inPlayCard, piles, types } from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { wave10Scenario } from "../../setup.js";
import {
  CORE_SPIDER_MAN,
  HULKLING_DECK,
  IRON_MAN_SCENARIO,
  TIGRA_DECK,
  WAVE10_DEPS,
  cardOption,
  isEnemyTeamChoice,
} from "../../testing.js";
import { MAIN_SCHEMES_REGISTRATION, MAIN_SCHEMES_REGISTRATION_SKIPPED } from "./registration.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * The Civil War registration main scheme (56063a, eight stages), docs/phase7-wave10.md sections 1.2, 2.6, 7.5, in real
 * `registration-iron-man` games (Iron Man's leader and the Maria Hill, Initiative, Martial Law and Dangerous Recruits
 * sets are scripted; Captain Marvel is not and is not used), seated with Core Spider-Man and the two Civil War precons.
 * A pair of stages is chosen by the `printedCardId` of its B faces (`mainSchemeStageIds`). Where a test needs a stage 2
 * and is not about reaching it, it is placed by the same surgery as the DSL tests (the stage index set, the threat
 * cleared). Iron Man is confused (his scheme is cancelled) wherever a test counts threat; a stage 1's threshold is
 * reached by the villain phase's own step 1.
 */
const DEPS = WAVE10_DEPS;
const SEATS = [
  { starterDeckId: CORE_SPIDER_MAN },
  { starterDeckId: TIGRA_DECK },
  { starterDeckId: HULKLING_DECK },
  { starterDeckId: "core-she-hulk-aggression" },
] as const;
const PLAYERS: readonly PlayerId[] = [P1, P2, P3, P4];
const UNREGISTERED = trait("UNREGISTERED");

const CUT_OFF_SUPPORT = "56063b";
const NEGATIVE_ZONE_PRISON = "56064b";
const SHIELD_RECRUITS = "56096b";
const HUNTING_REBEL_HEROES = "56097b";
const HOMELAND_SECURITY = "56121b";
const PUBLIC_OUTRAGE = "56122b";
const THE_INITIATIVE = "56123b";
const NO_GOING_BACK = "56124b";
const STARK_TOWER = "56072";
const BLACK_CAT = "01002";
const CONTRACTOR = "56120";
/** A stack entry standing for an Iron Man attachment still in the deck: revealed, it attaches to him and touches no player. */
const FILL = "fill";
const IRON_MAN_ATTACHMENTS = ["56065", "56066", "56067", "56068", "56069"];
const REPULSOR_BLAST = "56070";
/** Mighty Avengers, Initiative, Maria Hill and Dangerous Recruits minions and side schemes. */
const MINIONS = ["56073", "56074", "56075", "56078"];
/** Government Contractor (56120) is in the Paladin set: Iron Man's scenario with it in place of Mighty Avengers. */
const WITH_PALADIN = ["paladin", "the_initiative", "maria_hill_modular", "dangerous_recruits"];
const SIDE_SCHEMES = { fifty: "56082", helicarrier: "56086" };

const REFS = [
  "56063a.setup",
  "56096a.setup",
  "56121a.setup",
  "56122a.setup",
  "56063b.cut-off-support-constant",
  "56063b.cut-off-support-forced-interrupt",
  "56064b.negative-zone-prison-constant",
  "56064b.negative-zone-prison-forced-response",
  "56096b.shield-recruits-constant",
  "56096b.when-revealed",
  "56097b.hunting-rebel-heroes-constant",
  "56097b.hunting-rebel-heroes-forced-response",
  "56121b.homeland-security-constant",
  "56121b.homeland-security-constant-2",
  "56122b.public-outrage-constant",
  "56122b.public-outrage-forced-response",
  "56123b.when-revealed",
  "56124b.no-going-back-constant",
];
/** The four stage 1 B sides, each with the stage 2 it is played with in these tests, and its A-side Setup ref. */
const STAGE_ONES = [
  { code: CUT_OFF_SUPPORT, name: "Cut Off Support", two: HUNTING_REBEL_HEROES, setup: "56063a.setup" },
  { code: SHIELD_RECRUITS, name: "S.H.I.E.L.D. Recruits", two: NO_GOING_BACK, setup: "56096a.setup" },
  { code: HOMELAND_SECURITY, name: "Homeland Security", two: NEGATIVE_ZONE_PRISON, setup: "56121a.setup" },
  { code: PUBLIC_OUTRAGE, name: "Public Outrage", two: THE_INITIATIVE, setup: "56122a.setup" },
] as const;

const mainSchemeCard = () => {
  const card = WAVE10_CARDS.find((c) => (c.id as string) === "56063a");
  if (card?.type !== "main_scheme") throw new Error("no main scheme card");
  return card;
};
const stageIndexOf = (code: string): number => {
  const index = mainSchemeCard().stages.findIndex((stage) => (stage.printedCardId as string | undefined) === code);
  if (index < 0) throw new Error(`no stage ${code}`);
  return index;
};

type Pair = readonly [string, string];
interface Started {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

function config(players: 1 | 2 | 3 | 4, pair: Pair, seed = 7, modularSetIds?: readonly string[]): GameSetupConfig {
  return wave10Scenario(IRON_MAN_SCENARIO, {
    players: SEATS.slice(0, players),
    seed,
    mainSchemeStageIds: [pair[0], pair[1]] as never,
    ...(modularSetIds ? { modularSetIds: modularSetIds as never } : {}),
  });
}

/** A game from `createGame` to the first player's turn, the events of the whole setup, `pick` answering its choices. */
function start(
  players: 1 | 2 | 3 | 4,
  pair: Pair,
  pick: Picker = firstLegal,
  seed = 7,
  modularSetIds?: readonly string[],
): Started {
  const created = createGame(config(players, pair, seed, modularSetIds), DEPS);
  if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
  const run = driveEventsPicking(DEPS, created.state, pick);
  return { state: run.state, events: [...created.events, ...run.events] };
}
const game = (
  players: 1 | 2 | 3 | 4,
  pair: Pair,
  pick: Picker = firstLegal,
  seed = 7,
  modularSetIds?: readonly string[],
): GameState => start(players, pair, pick, seed, modularSetIds).state;

/** Surgery: the scheme on the stage whose B face is `code`, with no threat on it. */
function onStage(state: GameState, code: string): GameState {
  const moved = { ...state, mainScheme: { ...state.mainScheme, stageIndex: stageIndexOf(code) } };
  return patchInstance(moved, state.mainScheme.instanceId, { threat: 0 });
}
const target = (state: GameState): number => mainSchemeValue(state, "targetThreat", DEPS);
const hinder = (state: GameState): number => keywordTotal(state, state.mainScheme.instanceId, "hinder", DEPS);
const abilitiesResolved = (events: readonly GameEvent[]): string[] =>
  types(events, "abilityResolved").map((e) => e.abilityId as string);
const hero = (state: GameState, ...players: PlayerId[]): GameState =>
  players.reduce((s, p) => withForm(s, { heroForm: 0 }, p), state);
const everyone = (state: GameState): PlayerId[] => state.players.map((p) => p.playerId);
/**
 * Iron Man's activations cancelled, so the villain phase adds no threat and no boost card of its own: confused cancels
 * his scheme against an alter-ego, stunned his attack against a hero. With two players the first stays in alter-ego
 * form and the second goes to hero form, so each of the two activations meets the status that cancels it.
 */
const idle = (state: GameState): GameState => {
  const villain = state.activeVillainId!;
  const statuses = { ...inst(state, villain).statuses, confused: 1, stunned: state.players.length > 1 ? 1 : 0 };
  const cancelled = patchInstance(state, villain, { statuses });
  return state.players.length > 1 ? hero(cancelled, P2) : cancelled;
};
/**
 * Every player ends the turn: the villain phase runs on the stacked encounter deck (top first). `FILL` is a card that
 * touches no player: an Iron Man attachment still in the deck.
 */
const villainPhase = (state: GameState, pick: Picker = firstLegal, ...stack: string[]) => {
  const free = IRON_MAN_ATTACHMENTS.filter((code) => deckCodes(state).includes(code));
  const codes = stack.map((code) => (code === FILL ? free.shift()! : code));
  return driveEventsPicking(
    DEPS,
    codes.length > 0 ? stackEncounterDeck(state, ...codes) : state,
    pick,
    ...everyone(state).map((p) => endTurn(p)),
  );
};

/** Answers the enemy team's choices with these card codes in turn (a code not on offer: the first option), the rest first legal. */
const enemyTeamTakes = (...codes: string[]): Picker => {
  let next = 0;
  return (s) => {
    if (!isEnemyTeamChoice(s)) return firstLegal(s);
    const option = cardOption(s, codes[next] ?? "");
    next += 1;
    return option ? [option.optionId] : firstLegal(s);
  };
};
const enemyTeamPrompts = (events: readonly GameEvent[]) =>
  types(events, "choiceRequested").filter((e) => e.choice.authority === "enemyTeam");
const dealtCodes = (s: GameState, player: PlayerId): string[] =>
  playerOf(s, player).dealtEncounter.map((i) => codeOf(s, i));
const deckCodes = (s: GameState): string[] => piles(s).deck.map((i) => codeOf(s, i));
const offeredCodes = (s: GameState): string[] =>
  s.pendingChoice!.options.map((o) => codeOf(s, (o.ref as { instanceId: InstanceId }).instanceId));

describe("registry", () => {
  it("registers every ref of the card (none skipped), each a valid definition", () => {
    expect(Object.keys(MAIN_SCHEMES_REGISTRATION).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(MAIN_SCHEMES_REGISTRATION)) expect(validateDefinition(def), id).toEqual([]);
    expect(MAIN_SCHEMES_REGISTRATION_SKIPPED).toEqual({});
  });

  it("the data names exactly these 18 refs on the eight stages and their A sides", () => {
    const refs = abilityRefIds(mainSchemeCard());
    expect(refs).toHaveLength(18);
    expect([...refs].sort()).toEqual([...REFS].sort());
    expect(mainSchemeCard().stages.map((s) => [s.printedCardId, s.stageNumber, s.completionLoses ?? false])).toEqual([
      ["56063b", 1, false],
      ["56064b", 2, true],
      ["56096b", 1, false],
      ["56097b", 2, true],
      ["56121b", 1, false],
      ["56122b", 1, false],
      ["56123b", 2, true],
      ["56124b", 2, true],
    ]);
    expect(CW_CARDS.some((c) => (c.id as string) === "56063a")).toBe(true);
  });
});

describe("1A Setup: 'In competitive mode, the enemy team finds the Choosing Sides side scheme ... In cooperative mode, find the chosen leader's side scheme and reveal it.'", () => {
  it.each(STAGE_ONES)(
    "$setup scripts the competitive sentence (no marker left): Choosing Sides found and revealed (competitive plan M1)",
    ({ setup }) => {
      const definition = MAIN_SCHEMES_REGISTRATION[setup]!;
      expect(competitiveOnlyTexts(definition)).toEqual([]);
      expect(JSON.stringify(definition)).toContain('"names":["Choosing Sides"]');
    },
  );

  it.each(STAGE_ONES)(
    "$name chosen: its own 1A Setup runs, finds Stark Tower in Iron Man's set and reveals it (3 threat per player); the deck loses only that card",
    ({ code, two, setup }) => {
      for (const players of [1, 2] as const) {
        const { state, events } = start(players, [code, two]);
        expect(abilitiesResolved(events).filter((id) => id.endsWith("a.setup"))).toEqual([setup]);
        const tower = inPlayCard(state, STARK_TOWER)!;
        expect(tower).toBeDefined();
        expect(inst(state, tower).threat).toBe(3 * players);
        expect(deckCodes(state)).not.toContain(STARK_TOWER);
        expect(deckCodes(state)).toContain("56071");
      }
    },
  );

  it("the stage 1 B side's When Revealed follows the 1A Setup", () => {
    const order = abilitiesResolved(start(1, [SHIELD_RECRUITS, NO_GOING_BACK]).events);
    expect(order.indexOf("56096a.setup")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("56096b.when-revealed")).toBeGreaterThan(order.indexOf("56096a.setup"));
  });
});

describe("stage 1: 'If there is more than 1 player on your team, this stage gains hinder 2[per_hero]'", () => {
  it.each(STAGE_ONES)(
    "$name: 1, 2 and 4 players open with 0, 4 and 8 threat (hinder), target 7 per player",
    ({ code, two }) => {
      for (const [players, threat] of [
        [1, 0],
        [2, 4],
        [4, 8],
      ] as const) {
        const state = game(players, [code, two]);
        expect(state.mainScheme.stageIndex, `${code} at ${players}`).toBe(stageIndexOf(code));
        expect(hinder(state), `${code} at ${players}`).toBe(threat);
        expect(mainThreat(state), `${code} at ${players}`).toBe(threat);
        expect(target(state), `${code} at ${players}`).toBe(7 * players);
      }
    },
  );

  it("three players: hinder 2 per player is 6 threat", () => {
    expect(mainThreat(game(3, [PUBLIC_OUTRAGE, NO_GOING_BACK]))).toBe(6);
  });

  it("the stage 2 it advances to has no hinder", () => {
    const state = onStage(game(4, [CUT_OFF_SUPPORT, NEGATIVE_ZONE_PRISON]), NEGATIVE_ZONE_PRISON);
    expect(hinder(state)).toBe(0);
    expect(target(state)).toBe(36);
  });

  it.each(STAGE_ONES)(
    "$name advances to its stage 2 at exactly the target threat (two players, target 14)",
    ({ code, two }) => {
      // Villain phase step 1 places 2 (acceleration 1 per player); the confused villain adds nothing. Cut Off Support
      // also places 1 for each treachery a player reveals (two dealt Repulsor Blasts: +2).
      const own = code === CUT_OFF_SUPPORT ? 2 : 0;
      const fresh = idle(game(2, [code, two]));
      const short = patchInstance(fresh, fresh.mainScheme.instanceId, { threat: 14 - 2 - own - 1 });
      const stays = villainPhase(short, enemyTeamTakes(), REPULSOR_BLAST, REPULSOR_BLAST).state;
      expect(stays.mainScheme.stageIndex).toBe(stageIndexOf(code));
      expect(mainThreat(stays)).toBe(13);
      const exact = patchInstance(fresh, fresh.mainScheme.instanceId, { threat: 14 - 2 - own });
      const advanced = villainPhase(exact, enemyTeamTakes(), REPULSOR_BLAST, REPULSOR_BLAST).state;
      expect(advanced.mainScheme.stageIndex).toBe(stageIndexOf(two));
      expect(hinder(advanced)).toBe(0);
      expect(target(advanced)).toBe(18);
    },
  );
});

describe("Cut Off Support 56063b: Forced Interrupt, a player reveals a treachery, 1 threat here (limit once per phase per player)", () => {
  it("two players each reveal a treachery in the villain phase: the stage places 1 threat for each", () => {
    const state = idle(game(2, [CUT_OFF_SUPPORT, NEGATIVE_ZONE_PRISON]));
    const before = mainThreat(state);
    const { state: after, events } = villainPhase(state, firstLegal, REPULSOR_BLAST, REPULSOR_BLAST);
    expect(abilitiesResolved(events).filter((id) => id === "56063b.cut-off-support-forced-interrupt")).toHaveLength(2);
    // Step 1: 2 threat (acceleration 1 per player); the stage: 1 each for two treacheries.
    expect(mainThreat(after)).toBe(before + 2 + 2);
  });

  it("a card that is not a treachery places none (two attachments are revealed)", () => {
    const state = idle(game(2, [CUT_OFF_SUPPORT, NEGATIVE_ZONE_PRISON]));
    const before = mainThreat(state);
    const { state: after, events } = villainPhase(state, firstLegal, FILL, FILL);
    expect(abilitiesResolved(events)).not.toContain("56063b.cut-off-support-forced-interrupt");
    expect(mainThreat(after)).toBe(before + 2);
  });

  it("one player: the stage has no hinder and still places 1 threat for the treachery revealed", () => {
    const state = idle(game(1, [CUT_OFF_SUPPORT, NEGATIVE_ZONE_PRISON]));
    expect(mainThreat(state)).toBe(0);
    const { state: after } = villainPhase(state, firstLegal, REPULSOR_BLAST);
    expect(mainThreat(after)).toBe(1 + 1);
  });

  it("limit once per phase per player: a surge gives one player a second treachery, and only the first places a threat", () => {
    // Caught Off Guard (01188, alter-ego, no gear to discard) gains surge: the same player reveals Repulsor Blast next.
    const state = idle(game(1, [CUT_OFF_SUPPORT, NEGATIVE_ZONE_PRISON]));
    const { state: after, events } = villainPhase(state, firstLegal, "01188", REPULSOR_BLAST);
    expect(abilitiesResolved(events).filter((id) => id === "56063b.cut-off-support-forced-interrupt")).toHaveLength(1);
    expect(mainThreat(after)).toBe(1 + 1);
  });
});

describe("S.H.I.E.L.D. Recruits 56096b: When Revealed, the enemy team deals one minion to each player on your team", () => {
  it.each([1, 2, 4] as const)(
    "%i players: one enemy-team prompt for each, each player is dealt the minion picked for them, facedown",
    (players) => {
      const names = MINIONS.slice(0, players);
      const { state, events } = start(players, [SHIELD_RECRUITS, NO_GOING_BACK], enemyTeamTakes(...names));
      // One prompt per player for the minions; Iron Man's own Setup adds one more enemy-team prompt (the attachment).
      expect(enemyTeamPrompts(events)).toHaveLength(players + 1);
      PLAYERS.slice(0, players).forEach((player, seat) => {
        expect(dealtCodes(state, player), `${player}`).toEqual([names[seat]]);
        expect(inst(state, playerOf(state, player).dealtEncounter[0]!).faceup).toBe(false);
      });
      for (const name of names) expect(deckCodes(state)).not.toContain(name);
    },
  );

  it("the first prompt offers the minions of the encounter deck and nothing else", () => {
    let offered: string[] | undefined;
    const picker: Picker = (s) => {
      if (isEnemyTeamChoice(s) && !offered) offered = offeredCodes(s);
      return firstLegal(s);
    };
    start(1, [SHIELD_RECRUITS, NO_GOING_BACK], picker);
    const minions = new Set(WAVE10_CARDS.filter((c) => c.type === "minion").map((c) => c.id as string));
    expect(offered).toBeDefined();
    expect(offered!.length).toBeGreaterThan(1);
    expect(offered!.every((code) => minions.has(code))).toBe(true);
  });
});

describe("Homeland Security 56121b: each minion gains guard", () => {
  it("a minion in play has guard on this stage and has none on another stage 1", () => {
    const here = idle(game(1, [HOMELAND_SECURITY, THE_INITIATIVE]));
    const revealed = villainPhase(here, firstLegal, "56088").state;
    expect(hasKeyword(revealed, inPlayCard(revealed, "56088")!, "guard", DEPS)).toBe(true);
    const other = villainPhase(idle(game(1, [PUBLIC_OUTRAGE, THE_INITIATIVE])), firstLegal, "56088").state;
    expect(hasKeyword(other, inPlayCard(other, "56088")!, "guard", DEPS)).toBe(false);
  });
});

describe("Public Outrage 56122b: [star] Forced Response, after step 1 of the villain phase each player discards the top 3 cards of their deck", () => {
  it("two players: each discards their own top 3, after the threat is placed", () => {
    const state = idle(game(2, [PUBLIC_OUTRAGE, NO_GOING_BACK]));
    const tops = PLAYERS.slice(0, 2).map((p) => playerOf(state, p).deck.slice(0, 3));
    const { state: after, events } = villainPhase(state, firstLegal, FILL, FILL);
    PLAYERS.slice(0, 2).forEach((player, seat) => {
      for (const id of tops[seat]!) expect(playerOf(after, player).discard, `${player} ${id}`).toContain(id);
    });
    const threatAt = events.findIndex((e) => e.type === "threatPlaced");
    const discardAt = events.findIndex(
      (e) => e.type === "abilityResolved" && e.abilityId === "56122b.public-outrage-forced-response",
    );
    expect(threatAt).toBeGreaterThanOrEqual(0);
    expect(discardAt).toBeGreaterThan(threatAt);
    expect(abilitiesResolved(events).filter((id) => id === "56122b.public-outrage-forced-response")).toHaveLength(1);
  });

  it("one player: exactly 3 cards go from the deck to the discard pile", () => {
    const state = idle(game(1, [PUBLIC_OUTRAGE, NO_GOING_BACK]));
    const deck = playerOf(state, P1).deck.length;
    const discard = playerOf(state, P1).discard.length;
    const after = villainPhase(state, firstLegal, FILL).state;
    // The hand is full already, so the round's refresh draws nothing: the deck loses exactly the 3.
    expect(playerOf(after, P1).deck.length).toBe(deck - 3);
    expect(playerOf(after, P1).discard.length).toBe(discard + 3);
  });
});

describe("Negative Zone Prison 56064b: target threat lowered for each facedown card under it; a defeated ally goes under it", () => {
  const defendWith =
    (ally: InstanceId): Picker =>
    (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "declareDefender") {
        const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === ally);
        return option ? [option.optionId] : ["decline"];
      }
      return firstLegal(s);
    };
  /** One player in hero form on the stage with Black Cat one point short of defeat. */
  function staged(threat: number) {
    const base = onStage(hero(game(1, [CUT_OFF_SUPPORT, NEGATIVE_ZONE_PRISON]), P1), NEGATIVE_ZONE_PRISON);
    const given = playFromHand(DEPS, base, BLACK_CAT, 2);
    const cat = given.id;
    const hurt = patchInstance(given.state, cat, { damage: (maxHitPoints(given.state, cat, DEPS) ?? 1) - 1 });
    return { state: patchInstance(hurt, hurt.mainScheme.instanceId, { threat }), cat };
  }

  it("target is 9 per player with nothing under it", () => {
    expect(target(onStage(game(1, [CUT_OFF_SUPPORT, NEGATIVE_ZONE_PRISON]), NEGATIVE_ZONE_PRISON))).toBe(9);
    expect(target(onStage(game(2, [CUT_OFF_SUPPORT, NEGATIVE_ZONE_PRISON]), NEGATIVE_ZONE_PRISON))).toBe(18);
  });

  it("an ally defeated by the villain's attack is placed facedown under the scheme: target 8, the ally not in the discard pile", () => {
    const { state, cat } = staged(0);
    const { state: after } = villainPhase(state, defendWith(cat), "01186", FILL);
    expect(inst(after, after.mainScheme.instanceId).tucked).toEqual([cat]);
    expect(inst(after, cat).faceup).toBe(false);
    expect(playerOf(after, P1).playArea).not.toContain(cat);
    expect(playerOf(after, P1).discard).not.toContain(cat);
    expect(target(after)).toBe(8);
    expect(after.outcome).toBeNull();
  });

  // Spec section 3.15: "the scheme completes at once when the lowered target meets the threat on it (a state check, not
  // only when threat is placed)". This was pinned with `it.fails` while the engine checked completion only as threat
  // was placed; the engine now checks it after the target changes, so it is a plain test.
  it("the lowered target is met at once: the players lose when the defeat brings it down to the threat on the scheme", () => {
    // Step 1 places 1 threat: 7 + 1 = 8; the ally's defeat lowers the target 9 to 8.
    const { state, cat } = staged(7);
    const { state: after } = villainPhase(state, defendWith(cat), "01186", FILL);
    expect(target(after)).toBe(8);
    expect(after.outcome).toMatchObject({ result: "loss" });
  });

  it("an ally that is not defeated is not placed under it", () => {
    const { state, cat } = staged(0);
    const healthy = patchInstance(state, cat, { damage: 0 });
    const { state: after } = villainPhase(healthy, defendWith(cat), "01186", FILL);
    expect(inst(after, after.mainScheme.instanceId).tucked).toEqual([]);
    expect(target(after)).toBe(9);
  });
});

describe("Hunting Rebel Heroes 56097b (owner's answer to question 12 = A, provisional)", () => {
  const unregistered = (s: GameState, player: PlayerId): boolean =>
    traitsOf(s, identityOf(s, player), DEPS).includes(UNREGISTERED);
  const schemeDamage = (state: GameState, events: readonly GameEvent[]) =>
    types(events, "damageDealt")
      .filter((e) => e.sourceInstanceId === state.mainScheme.instanceId)
      .map((e) => [e.targetInstanceId, e.amount] as const)
      .sort(([a], [b]) => a.localeCompare(b));

  it("each hero gains the Unregistered trait; an identity in alter-ego form does not", () => {
    const base = onStage(game(2, [HOMELAND_SECURITY, HUNTING_REBEL_HEROES]), HUNTING_REBEL_HEROES);
    const mixed = withForm(hero(base, P1), "alterEgo", P2);
    expect([unregistered(mixed, P1), unregistered(mixed, P2)]).toEqual([true, false]);
    expect(unregistered(withForm(base, "alterEgo", P1), P1)).toBe(false);
  });

  it.each([
    ["both heroes", "hero", "hero"],
    ["one hero, one alter-ego", "hero", "alterEgo"],
    ["both alter-ego", "alterEgo", "alterEgo"],
  ] as const)(
    "question 12 = A, %s: Government Contractor revealed deals 2 damage to each hero (already Unregistered from this stage) and none to an alter-ego",
    (_label, first, second) => {
      let state = onStage(
        game(2, [HOMELAND_SECURITY, HUNTING_REBEL_HEROES], firstLegal, 7, WITH_PALADIN),
        HUNTING_REBEL_HEROES,
      );
      [first, second].forEach((form, seat) => {
        state = withForm(state, form === "hero" ? { heroForm: 0 } : "alterEgo", PLAYERS[seat]!);
      });
      // Both activations are cancelled (stunned for the hero's attack, confused for the alter-ego's scheme) wherever one can be.
      state = patchInstance(state, state.activeVillainId!, {
        statuses: { ...inst(state, state.activeVillainId!).statuses, confused: 1, stunned: 1 },
      });
      const { state: after, events } = villainPhase(state, firstLegal, FILL, CONTRACTOR, FILL);
      expect(inPlayCard(after, CONTRACTOR)).toBeDefined();
      const heroes = [first, second].flatMap((form, seat) =>
        form === "hero" ? [identityOf(after, PLAYERS[seat]!)] : [],
      );
      expect(schemeDamage(after, events)).toEqual(
        heroes.map((id) => [id, 2] as const).sort(([a], [b]) => a.localeCompare(b)),
      );
      const resolved = abilitiesResolved(events).filter((id) => id === "56097b.hunting-rebel-heroes-forced-response");
      expect(resolved).toHaveLength(heroes.length > 0 ? 1 : 0);
    },
  );
});

describe("The Initiative 56123b: When Revealed, the enemy team deals one side scheme from the deck and discard pile to each player", () => {
  /** `players` seats on Public Outrage, advanced by the real threshold: step 1 places the threat that completes it. */
  function advanced(players: 1 | 2, pick: Picker, prepare: (s: GameState) => GameState = (s) => s) {
    const fresh = idle(prepare(game(players, [PUBLIC_OUTRAGE, THE_INITIATIVE])));
    const exact = patchInstance(fresh, fresh.mainScheme.instanceId, { threat: 7 * players - players });
    return villainPhase(exact, pick, REPULSOR_BLAST, REPULSOR_BLAST);
  }

  it("advancing from Public Outrage: one enemy-team prompt for each of two players, and the side schemes picked reach them", () => {
    const { state, events } = advanced(2, enemyTeamTakes(SIDE_SCHEMES.fifty, SIDE_SCHEMES.helicarrier));
    expect(state.mainScheme.stageIndex).toBe(stageIndexOf(THE_INITIATIVE));
    expect(abilitiesResolved(events)).toContain("56123b.when-revealed");
    expect(enemyTeamPrompts(events)).toHaveLength(2);
    // Dealt facedown, then revealed in step 4 of the same phase, first player's first.
    expect(inPlayCard(state, SIDE_SCHEMES.fifty)).toBeDefined();
    expect(inPlayCard(state, SIDE_SCHEMES.helicarrier)).toBeDefined();
    expect(deckCodes(state)).not.toContain(SIDE_SCHEMES.fifty);
    expect(deckCodes(state)).not.toContain(SIDE_SCHEMES.helicarrier);
  });

  it("the discard pile is searched too: a side scheme there is on offer and can be the one dealt", () => {
    let offered: string[] = [];
    const { state } = advanced(
      1,
      (s) => {
        if (isEnemyTeamChoice(s)) {
          offered = offeredCodes(s);
          const option = cardOption(s, SIDE_SCHEMES.helicarrier);
          if (option) return [option.optionId];
        }
        return firstLegal(s);
      },
      (s) => {
        const id = piles(s).deck.find((i) => codeOf(s, i) === SIDE_SCHEMES.helicarrier)!;
        const deckId = Object.keys(s.encounterDecks)[0]!;
        const pile = s.encounterDecks[deckId]!;
        return {
          ...s,
          encounterDecks: {
            ...s.encounterDecks,
            [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: [id, ...pile.discard] },
          },
        };
      },
    );
    expect(offered).toContain(SIDE_SCHEMES.helicarrier);
    expect(offered).toContain(SIDE_SCHEMES.fifty);
    expect(state.mainScheme.stageIndex).toBe(stageIndexOf(THE_INITIATIVE));
    expect(inPlayCard(state, SIDE_SCHEMES.helicarrier)).toBeDefined();
    expect(piles(state).discard.map((i) => codeOf(state, i))).not.toContain(SIDE_SCHEMES.helicarrier);
  });
});

describe("No Going Back 56124b: allies enter play exhausted", () => {
  it("Black Cat played on this stage enters exhausted; on another stage 2 she enters ready", () => {
    const here = onStage(hero(game(1, [PUBLIC_OUTRAGE, NO_GOING_BACK]), P1), NO_GOING_BACK);
    const played = playFromHand(DEPS, here, BLACK_CAT, 2);
    expect(inst(played.state, played.id).exhausted).toBe(true);
    const elsewhere = onStage(hero(game(1, [PUBLIC_OUTRAGE, NO_GOING_BACK]), P1), NEGATIVE_ZONE_PRISON);
    const readyCat = playFromHand(DEPS, elsewhere, BLACK_CAT, 2);
    expect(inst(readyCat.state, readyCat.id).exhausted).toBe(false);
  });
});

describe("every stage 2: 'If this stage is completed, the players lose the game.'", () => {
  it.each([HUNTING_REBEL_HEROES, NEGATIVE_ZONE_PRISON, THE_INITIATIVE, NO_GOING_BACK])(
    "%s: target 9 per player; completed by the villain phase's threat, the players lose",
    (code) => {
      for (const players of [1, 2] as const) {
        const state = idle(onStage(game(players, [CUT_OFF_SUPPORT, code]), code));
        expect(target(state)).toBe(9 * players);
        const nearly = patchInstance(state, state.mainScheme.instanceId, { threat: 9 * players - players - 1 });
        expect(villainPhase(nearly, enemyTeamTakes(), FILL, FILL).state.outcome).toBeNull();
        const exact = patchInstance(state, state.mainScheme.instanceId, { threat: 9 * players - players });
        expect(villainPhase(exact, enemyTeamTakes(), FILL, FILL).state.outcome).toMatchObject({
          result: "loss",
        });
      }
    },
  );
});

describe("a custom pair is not the ready-made one", () => {
  it("Public Outrage with The Initiative plays with neither Cut Off Support's nor Negative Zone Prison's abilities", () => {
    const state = idle(game(2, [PUBLIC_OUTRAGE, THE_INITIATIVE]));
    expect(state.mainScheme.stageIndex).toBe(stageIndexOf(PUBLIC_OUTRAGE));
    const { events } = villainPhase(state, firstLegal, REPULSOR_BLAST, REPULSOR_BLAST);
    expect(abilitiesResolved(events)).not.toContain("56063b.cut-off-support-forced-interrupt");
    expect(abilitiesResolved(events)).toContain("56122b.public-outrage-forced-response");
  });
});
