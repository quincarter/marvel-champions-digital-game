/**
 * Rules QA, wave 10 part 1: the registration side of Civil War (the Iron Man and Captain Marvel leaders, the
 * registration main schemes, the eight registration modular sets). Each test cites the printed card, MC56, the RRG 1.8
 * or an FFG ruling. `it.fails` records a bug found (the test states the printed behavior and fails today; flip it to
 * `it` when the script is fixed); a plain `it` pins behavior the audit confirmed, or one the owner has left open.
 * Findings and the full audit: docs/phase7-wave10-qa-registration.md.
 */
import { PLAYABLE_CARDS, CW_CARDS } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  cardsMatch,
  statBonus,
  traitsOf,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  stackEncounterDeck,
  type Picker,
} from "../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../testing/staging.js";
import { attachToHost } from "../wave6/mut_gen/project-wideawake-testing.js";
import { codeOf, heroAttacks, heroForm, heroThwarts, piles, types } from "../wave9/testing.js";
import {
  CAPTAIN_MARVEL_SCENARIO,
  IRON_MAN_SCENARIO,
  WAVE10_DEPS,
  civilWarGame,
  engageMinion,
  stagedInPlay,
  type CivilWarGameOptions,
} from "./testing.js";
import { UNREGISTERED } from "./cw/modular/cape-killer.js";

vi.setConfig({ testTimeout: 180_000 });

const DEPS = WAVE10_DEPS;
const ADVANCE = "01186"; // a Core treachery with no boost icon and no boost ability
const ASSAULT = "01187";
const HOMELAND_SECURITY = "56121b";
const NO_GOING_BACK = "56124b";
const REG_SETS = ["cape_killer", "heroes_for_hire", "paladin"];

const leaderOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState, p: PlayerId = P1): InstanceId => identityOf(s, p);
const playArea = (s: GameState, p: PlayerId = P1) => s.players.find((x) => x.playerId === p)!.playArea;
const seats = (s: GameState): PlayerId[] => {
  const at = s.players.findIndex((p) => p.playerId === s.firstPlayerId);
  return [...s.players.slice(at), ...s.players.slice(0, at)].map((p) => p.playerId);
};

/** A quiet board: stage pair Homeland Security / No Going Back, the leader's side scheme back in the deck. */
const quiet = (scenario: string, o: CivilWarGameOptions = {}): GameState =>
  civilWarGame(scenario, {
    mainSchemeStageIds: [HOMELAND_SECURITY, NO_GOING_BACK] as never,
    leaderSideScheme: "discarded",
    ...o,
  });

/** Iron Man's board with no attachments and no tough card on him (so his activation is ATK 1, SCH 1). */
function bareIronMan(o: CivilWarGameOptions = {}): GameState {
  const start = quiet(IRON_MAN_SCENARIO, { modularSetIds: REG_SETS, ...o });
  const iron = leaderOf(start);
  const old = inst(start, iron).attachments;
  let cur = patchInstance(start, iron, { attachments: [], statuses: { ...inst(start, iron).statuses, tough: 0 } });
  for (const id of old) cur = patchInstance(cur, id, { attachedTo: null });
  const deckId = activeEncounterDeckId(cur);
  const pile = cur.encounterDecks[deckId]!;
  return {
    ...cur,
    encounterDecks: { ...cur.encounterDecks, [deckId]: { deck: pile.deck, discard: [...old, ...pile.discard] } },
  };
}

/** `code`'s first copy in the encounter deck or discard pile moved into `player`'s play area, faceup. */
function inPlayAreaOf(state: GameState, code: string, player: PlayerId = P1): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code)!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
    },
    players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true } },
  };
}

/** The villain phase on a stacked deck: top first, the leader's boost card for each player, then the dealt cards. */
const villainPhase = (state: GameState, pick: Picker, ...stack: string[]) =>
  driveEventsPicking(
    DEPS,
    stack.length > 0 ? stackEncounterDeck(state, ...stack) : state,
    pick,
    ...seats(state).map((p) => endTurn(p)),
  );

const attackDamage = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.event.kind === "dealDamage" && e.phase === "resolved" && e.event.fromAttack
      ? [e.event]
      : [],
  );

describe("56107 Bring Them In", () => {
  const BRING = "56107";
  const SUPER = "56106";
  const supersIn = (s: GameState, p: PlayerId = P1) =>
    playArea(s, p).filter((i) => ["56106", "56114"].includes(codeOf(s, i)));

  it("56107 Bring Them In: the only Unregistered identity is already exhausted, so 'Exhaust each Unregistered identity' cannot resolve and 'Otherwise' deals a copy of Unregistered Super (RRG 1.8 'Otherwise' p. 31; FAQ She-Hulk / Superhuman Strength: an effect that cannot affect its target cannot resolve)", () => {
    let s = heroForm(bareIronMan());
    s = inPlayAreaOf(s, SUPER);
    expect(traitsOf(s, hero(s), DEPS)).toContain(UNREGISTERED);
    // The identity defends Iron Man's attack and so is exhausted when the card is revealed. (Exhausting it by surgery
    // before the turn ends does not stage this: everything readies at the end of the player phase, RRG "Ready" p. 36.)
    const defending: Picker = (state) =>
      state.pendingChoice!.prompt.kind === "declareDefender" ? [hero(state) as string] : firstLegal(state);
    const run = villainPhase(s, defending, ADVANCE, BRING);
    expect(types(run.events, "cardExhausted").map((e) => e.instanceId)).toEqual([hero(s)]);
    expect(supersIn(run.state)).toHaveLength(2);
  });

  it("control: with a ready Unregistered identity the identity is exhausted and no copy is dealt", () => {
    let s = heroForm(bareIronMan());
    s = inPlayAreaOf(s, SUPER);
    const run = villainPhase(s, firstLegal, ADVANCE, BRING);
    expect(supersIn(run.state)).toHaveLength(1);
    expect(inst(run.state, hero(run.state)).exhausted).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Captain Marvel
// ---------------------------------------------------------------------------------------------------------------
const CHANNEL = "56098";
const FLIGHT = "56100";
const MOON_KNIGHT = "56002";
const HAYMAKER = "01087";
const UPPERCUT = "01054";
const GANG_UP = "01189";

const cmGame = (o: CivilWarGameOptions = {}): GameState =>
  heroForm(quiet(CAPTAIN_MARVEL_SCENARIO, { swap: { "56012": HAYMAKER, "56013": UPPERCUT }, ...o }));
const ready = (s: GameState, p: PlayerId = P1): GameState => patchInstance(s, hero(s, p), { exhausted: false });
const channelOf = (s: GameState): InstanceId => instancesOf(s, CHANNEL)[0]!;
const energyOn = (s: GameState): number => inst(s, channelOf(s)).counters["energy"] ?? 0;
const withEnergy = (s: GameState, n: number): GameState =>
  patchInstance(s, channelOf(s), { counters: { ...inst(s, channelOf(s)).counters, energy: n } });
const attachedCodes = (s: GameState): string[] => inst(s, leaderOf(s)).attachments.map((a) => codeOf(s, a));
const playEvent = (
  state: GameState,
  code: string,
  cost: number,
): { state: GameState; events: readonly GameEvent[] } => {
  const given = moveToHand(state, P1, code);
  return driveEventsPicking(
    DEPS,
    given.state,
    firstLegal,
    play(P1, given.ids[0]!, payWith(given.state, P1, cost, given.ids)),
  );
};

describe("56098 Energy Channel (RRG 1.8 p. 70 erratum; FFG rulings Jan 26 2026 R5, Jun 2 2026 R4)", () => {
  it("an attack EVENT is an attack (RRG 'Attack (Player Ability Type)' p. 10: an ability labeled as an attack is considered to attack the target): Uppercut on Captain Marvel places a counter", () => {
    const after = playEvent(ready(cmGame()), UPPERCUT, 3);
    expect(energyOn(after.state)).toBe(1);
  });

  it("a STUNNED hero's basic attack is replaced by removing the stun card and 'is not considered to have attacked' (RRG 'Stun, Stunned' p. 41; ruling Aug 13 2026 R1): no counter", () => {
    const base = ready(cmGame());
    const stunned = patchInstance(base, hero(base), { statuses: { ...inst(base, hero(base)).statuses, stunned: 1 } });
    const run = heroAttacks(DEPS, stunned, leaderOf(stunned));
    expect(inst(run.state, hero(run.state)).statuses.stunned).toBe(0);
    expect(energyOn(run.state)).toBe(0);
  });

  it("an ally that would die to its own consequential damage is still in play when the response resolves (RRG 'Consequential Damage' p. 13, 'Attack (Player Ability Type)' p. 10 step 9; FAQ Tigra p. 58): the fourth counter empties the card and she attacks the ally", () => {
    const ally = stagedInPlay(withEnergy(cmGame(), 3), MOON_KNIGHT);
    const hurt = patchInstance(ally.state, ally.id, { damage: 2 }); // 1 hit point left; consequential damage is 1
    const run = driveEventsPicking(DEPS, stackEncounterDeck(hurt, GANG_UP), firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: ally.id,
      targetInstanceId: leaderOf(hurt),
    });
    const attacks = types(run.events, "attackResolved").filter((a) => codeOf(run.state, a.enemyInstanceId) === "56092");
    expect(attacks).toHaveLength(1);
    // The channel was emptied and refilled once by the ally she defeated.
    expect(energyOn(run.state)).toBe(1);
    expect(run.state.players[0]!.discard).toContain(ally.id);
  });
});

describe("56100 Cosmic Flight, two copies (owner question 29 = B, 2026-10-12: an interpretation of RRG 1.8 'Interrupt' p. 25 and 'Replacement Effect' p. 37, not an FFG ruling on the card)", () => {
  it("two copies on the same 5 damage: the first copy reduces it to 3, the second's 'more than 3' is no longer met: 3 taken, one copy discarded, one still attached", () => {
    let s = ready(cmGame());
    for (let i = 0; i < 2; i++) s = attachToHost(s, FLIGHT, leaderOf(s)).state;
    const run = playEvent(s, UPPERCUT, 3);
    const after = run.state;
    expect(inst(after, leaderOf(after)).damage).toBe(3);
    expect(attachedCodes(after)).toEqual([CHANNEL, FLIGHT]);
    expect(piles(after).discard.filter((i) => codeOf(after, i) === FLIGHT)).toHaveLength(1);
    expect(types(run.events, "interruptConditionLapsed").map((e) => e.abilityId as string)).toEqual([
      "56100.cosmic-flight-forced-interrupt",
    ]);
  });
});

describe("56073 Yellowjacket (minion) against the ally 56019 (RRG 1.8 'Unique Icon' pp. 45-46; p. 70 erratum)", () => {
  const cards = [...PLAYABLE_CARDS, ...(CW_CARDS as never[])] as never as readonly import("@mc/content").AnyCard[];
  const byId = (id: string) => cards.find((c) => (c.id as string) === id)!;

  it("the RRG predicate: the minion has no subtitle and the ally's subtitle is Hank Pym, so the first bullet (both bare) fails and the second (a subtitle or alter-ego title matching the other's title or subtitle) fails: they do not match, in either direction", () => {
    const minion = byId("56073");
    const ally = byId("56019");
    expect(cardsMatch(minion, ally)).toBe(false);
    expect(cardsMatch(ally, minion)).toBe(false);
  });

  it("pool scan: the only other card the minion matches is the Ant-Man nemesis minion 12027 (also titled Yellowjacket, no subtitle: both bare), and the ally matches only the Ant-Man ally 12011 (subtitle Hank Pym on both)", () => {
    const minion = byId("56073");
    const ally = byId("56019");
    expect(cards.filter((c) => c !== minion && cardsMatch(minion, c)).map((c) => c.id as string)).toEqual(["12027"]);
    expect(cards.filter((c) => c !== ally && cardsMatch(ally, c)).map((c) => c.id as string)).toEqual(["12011"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Iron Man and the Avengers sets
// ---------------------------------------------------------------------------------------------------------------
const IRON_SETS = ["mighty_avengers", "the_initiative", "maria_hill_modular", "dangerous_recruits"];
const ARMOR = "56069";
const WASP = "56074";
const US_AGENT = "56075";
const EMH = "56077";

describe("56077 Earth's Mightiest Heroes (the printed keywords of each other Avenger minion; RRG 'Teamwork (Trait)' p. 43)", () => {
  const board = (withScheme: boolean) => {
    let s = heroForm(bareIronMan({ modularSetIds: IRON_SETS }));
    s = engageMinion(s, WASP, "qa-wasp", P1);
    if (withScheme) s = encounterCardInVillainArea(s, EMH, 3).state;
    return s;
  };

  it("control: without the scheme, U.S. Agent (no Teamwork of his own) revealed beside Wasp does not attack", () => {
    const run = villainPhase(board(false), firstLegal, ADVANCE, US_AGENT);
    expect(
      types(run.events, "attackResolved").filter((a) => codeOf(run.state, a.enemyInstanceId) === US_AGENT),
    ).toEqual([]);
  });

  it("56077 Earth's Mightiest Heroes: U.S. Agent revealed while Wasp (Teamwork (Avenger)) is in play gains Teamwork as he enters, so he activates against the player he engages (Teamwork resolves after his When Revealed; RRG p. 43)", () => {
    const run = villainPhase(board(true), firstLegal, ADVANCE, US_AGENT);
    expect(
      types(run.events, "attackResolved").filter((a) => codeOf(run.state, a.enemyInstanceId) === US_AGENT),
    ).toHaveLength(1);
  });
});

describe("56069 Mark V Armor against 'cannot take damage this phase' (56060 Iron Man II When Revealed)", () => {
  it("pin: with stage II just revealed the engine refuses an attack on him outright (no valid target), so nothing can reach the armor", () => {
    let s = heroForm(bareIronMan({ modularSetIds: IRON_SETS }));
    const ally = stagedInPlay(s, MOON_KNIGHT);
    s = ally.state;
    const staged = patchInstance(s, leaderOf(s), { damage: 11 });
    const defeated = heroAttacks(DEPS, staged, leaderOf(staged)).state;
    expect(codeOf(defeated, leaderOf(defeated))).toBe("56059");
    const armed = attachToHost(defeated, ARMOR, leaderOf(defeated));
    const refused = applyCommand(
      armed.state,
      { type: "basicAttack", playerId: P1, attackerInstanceId: ally.id, targetInstanceId: leaderOf(armed.state) },
      DEPS,
    );
    expect(refused.ok).toBe(false);
    expect(inst(armed.state, armed.id).damage).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// "The enemy team" choices with a single candidate (RRG 1.8 'Search' p. 39: a player chooses only "if a player finds
// multiple cards that satisfy the criteria"; docs/phase7-wave10.md section 3.5: "Where there is one candidate there is
// no prompt")
// ---------------------------------------------------------------------------------------------------------------
type Asked = { readonly authority: string | undefined; readonly kind: string; readonly options: number };
const recording = (asked: Asked[]): Picker => {
  return (s) => {
    const c = s.pendingChoice!;
    asked.push({ authority: c.authority, kind: c.prompt.kind, options: c.options.length });
    return firstLegal(s);
  };
};
const enemyTeamPrompts = (asked: readonly Asked[]) => asked.filter((a) => a.authority === "enemyTeam");

describe("one-candidate enemy-team choices", () => {
  it("56123b The Initiative: the encounter deck and discard pile hold a single side scheme, so the enemy team's search has nothing to decide and the first player is not asked", () => {
    const base = bareIronMan({ modularSetIds: IRON_SETS, mainSchemeStageIds: [HOMELAND_SECURITY, "56123b"] as never });
    const deckId = activeEncounterDeckId(base);
    const pile = base.encounterDecks[deckId]!;
    const isSide = (id: InstanceId) => base.cardPool[base.instances[id]!.cardId]?.type === "side_scheme";
    const only = pile.deck.find(isSide)!;
    const keep = (id: InstanceId) => !isSide(id) || id === only;
    const pruned: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { deck: pile.deck.filter(keep), discard: pile.discard.filter(keep) },
      },
    };
    const near = patchInstance(pruned, pruned.mainScheme.instanceId, { threat: 6 });
    const asked: Asked[] = [];
    const run = villainPhase(near, recording(asked), ADVANCE);
    expect(run.state.mainScheme.stageIndex).toBeGreaterThan(pruned.mainScheme.stageIndex);
    expect(JSON.stringify(enemyTeamPrompts(asked))).toBe("[]");
  });

  it("56112 Colleen Wing: an Unregistered player controls exactly one ally, so the enemy team's choice is forced and the first player is not asked", () => {
    let s = heroForm(bareIronMan());
    s = stagedInPlay(s, MOON_KNIGHT).state;
    s = inPlayAreaOf(s, "56106");
    const asked: Asked[] = [];
    const run = villainPhase(s, recording(asked), ADVANCE, "56112");
    expect(types(run.events, "cardDiscardedFromPlay")).toHaveLength(1);
    expect(JSON.stringify(enemyTeamPrompts(asked))).toBe("[]");
  });
});

describe("56072 Stark Tower: a single Iron Man attachment left is found without a prompt", () => {
  it("56072 Stark Tower: only Powered Gauntlets is left in the deck and discard pile, so the enemy team's search has nothing to decide and the first player is not asked (the module test of the same name settles every prompt with firstLegal, so it cannot see one)", () => {
    const base = heroForm(bareIronMan({ modularSetIds: IRON_SETS }));
    const deckId = activeEncounterDeckId(base);
    const pile = base.encounterDecks[deckId]!;
    const spare = (id: InstanceId) => ["56066", "56067", "56068", "56069"].includes(codeOf(base, id));
    const pruned: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => !spare(i)), discard: pile.discard.filter((i) => !spare(i)) },
      },
    };
    const tower = encounterCardInVillainArea(pruned, "56072", 1);
    const asked: Asked[] = [];
    const run = heroThwarts(DEPS, tower.state, tower.id, { pick: recording(asked) });
    expect(attachedCodes(run.state)).toEqual(["56065"]);
    expect(JSON.stringify(enemyTeamPrompts(asked))).toBe("[]");
  });
});

describe("Iron Man's 'Tech attachment' counts what is attached to him, whatever its set (56059 constant, 56071 Supersonic Punch)", () => {
  it("a Life Model Decoy 56084 (trait Tech, Q13 = A: it may go on the enemy leader) on Iron Man gives +1 SCH, and makes Supersonic Punch (alter-ego) confuse the player", () => {
    let s = bareIronMan({ modularSetIds: IRON_SETS });
    s = attachToHost(s, "56084", leaderOf(s)).state;
    expect(statBonus(s, DEPS, leaderOf(s), "sch")).toBe(1);
    const run = villainPhase(s, firstLegal, ADVANCE, "56071");
    expect(inst(run.state, hero(run.state)).statuses.confused).toBe(1);
  });
});

describe("56080 Drafted with no minion anywhere in the encounter deck or discard pile", () => {
  it("terminates: nothing is revealed, Drafted has nothing to attach to and is discarded (RRG 'Attach To' p. 8)", () => {
    const base = heroForm(bareIronMan({ modularSetIds: IRON_SETS }));
    const deckId = activeEncounterDeckId(base);
    const pile = base.encounterDecks[deckId]!;
    const isMinion = (id: InstanceId) => base.cardPool[base.instances[id]!.cardId]?.type === "minion";
    const stripped: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => !isMinion(i)), discard: pile.discard.filter((i) => !isMinion(i)) },
      },
    };
    const run = villainPhase(stripped, firstLegal, ADVANCE, "56080");
    const drafted = instancesOf(run.state, "56080")[0]!;
    expect(inst(run.state, drafted).attachedTo).toBeNull();
    expect(piles(run.state).discard).toContain(drafted);
  });
});

describe("56118 Paladin's Pistol: 'this attack gains ranged and overkill' (RRG 'Ranged' p. 36)", () => {
  const PISTOL = "56118";
  const PALADIN = "56117";
  const paladinHit = (withPistol: boolean) => {
    let s = engageMinion(heroForm(bareIronMan()), PALADIN, "qa-paladin", P1);
    if (withPistol) s = attachToHost(s, PISTOL, "qa-paladin" as InstanceId).state;
    const run = villainPhase(s, firstLegal, ADVANCE, ASSAULT);
    return attackDamage(run.events).find((d) => d.sourceInstanceId === ("qa-paladin" as InstanceId));
  };

  it("with the Pistol his attack deals damage that carries ranged (it ignores Retaliate)", () => {
    const hit = paladinHit(true);
    expect(hit).toBeDefined();
    expect(Boolean(hit!.ranged)).toBe(true);
  });

  it("control: without the Pistol the same attack is not ranged", () => {
    const hit = paladinHit(false);
    expect(hit).toBeDefined();
    expect(Boolean(hit!.ranged)).toBe(false);
  });
});

/*
 * QA finding F3 is retired: RRG 1.8 "Simultaneous Timing Priority" (p. 5) resolves status-card Forced Interrupts (2a)
 * before other Forced Interrupts (2b), and "Damage" (p. 14) takes tough status cards (step 2) before "would take any
 * amount of damage" abilities (step 3). The first player orders only forced abilities of equal priority ("Forced",
 * p. 20), so no order is offered here.
 */
describe("56069 Mark V Armor with a tough status card on Iron Man (RRG 1.8 'Simultaneous Timing Priority' p. 5, 'Damage' p. 14: the tough card resolves first)", () => {
  it("the tough card resolves first, with no order asked: it is discarded, nothing is placed on the Armor and Iron Man takes nothing", () => {
    const base = heroForm(bareIronMan({ modularSetIds: IRON_SETS }));
    const armed = attachToHost(base, ARMOR, leaderOf(base));
    const s = patchInstance(armed.state, leaderOf(base), {
      statuses: { ...inst(armed.state, leaderOf(base)).statuses, tough: 1 },
    });
    const run = heroAttacks(DEPS, s, leaderOf(s));
    expect(inst(run.state, leaderOf(run.state)).statuses.tough).toBe(0);
    expect(inst(run.state, armed.id).damage).toBe(0);
    expect(inst(run.state, leaderOf(run.state)).damage).toBe(0);
  });
});

describe("56079 Hellcat: Quickstrike resolves after her When Revealed (RRG 'Quickstrike' p. 36)", () => {
  it("56079 Hellcat: 'if a minion with the quickstrike keyword is being revealed, the quickstrike keyword resolves after any When Revealed abilities on that minion' - her When Revealed (the stun) resolves before her attack, as Wasp's Teamwork waits for her threat", () => {
    const s = heroForm(bareIronMan({ modularSetIds: IRON_SETS }));
    const run = villainPhase(s, firstLegal, ADVANCE, "56079");
    const revealedAt = run.events.findIndex(
      (e) => e.type === "abilityResolved" && e.abilityId === "56079.when-revealed",
    );
    const attackAt = run.events.findIndex(
      (e) => e.type === "attackResolved" && codeOf(run.state, e.enemyInstanceId) === "56079",
    );
    expect(revealedAt).toBeGreaterThanOrEqual(0);
    expect(attackAt).toBeGreaterThanOrEqual(0);
    expect(revealedAt).toBeLessThan(attackAt);
  });
});

describe("56117 Paladin: Quickstrike resolves after his When Revealed (RRG 'Quickstrike' p. 36)", () => {
  it("56117 Paladin: his When Revealed discards a card from your hand before his Quickstrike attack, so a card in that hand cannot be played into the attack's windows", () => {
    const s = heroForm(bareIronMan({ modularSetIds: ["paladin", ...IRON_SETS.slice(1)] }));
    const run = villainPhase(s, firstLegal, ADVANCE, "56117");
    const revealedAt = run.events.findIndex(
      (e) => e.type === "abilityResolved" && e.abilityId === "56117.when-revealed",
    );
    const attackAt = run.events.findIndex(
      (e) => e.type === "attackResolved" && codeOf(run.state, e.enemyInstanceId) === "56117",
    );
    expect(attackAt).toBeGreaterThanOrEqual(0);
    expect(revealedAt).toBeGreaterThanOrEqual(0);
    expect(revealedAt).toBeLessThan(attackAt);
  });
});
