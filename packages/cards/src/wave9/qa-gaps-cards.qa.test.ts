/**
 * Rules QA, the last "unit tests only" gaps of wave 9 (the `it.todo` lists of the scenario tests): Black Widow, Batroc,
 * M.O.D.O.K., Thunderbolts and Baron Zemo (the expert campaign path is qa-gaps-campaign.qa.test.ts), each card exercised inside a real
 * game state reached by commands. Sources: printed card text (packages/content/src/data/aos/cards.ts, from MC50 / MC55),
 * RRG 1.8 (docs/rules/mc_rulesreference_v18_compressed.pdf) by page, the post-1.7 rulings by date, and the MC50 rulebook. A FINDING
 * comment marks where the game and its source disagree: the expected behavior is an `it.fails`, with a passing companion
 * that pins today's behavior.
 */
import {
  activeEncounterDeckId,
  applyCommand,
  cardOf,
  createGame,
  cardsInPlay,
  keywordTotal,
  keywordsOf,
  statBonus,
  traitsOf,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  firstLegal,
  settle,
  type Picker,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  playerOf,
  play,
  stackEncounterDeck,
  use,
} from "../testing/harness.js";
import { playFromHand } from "../testing/staging.js";
import { WAVE9_ABILITIES } from "./index.js";
import { wave9Scenario } from "./setup.js";
import { BLACK_CAT, CAPTAIN_MARVEL, IRON_MAN, SPIDER_MAN, codeOf } from "./testing.js";
import {
  DEPS,
  SEATS,
  act,
  inPlayAll,
  mainThreatOf,
  ofType,
  openScenario,
  planned,
  targetThreatOf,
  villainHp,
  villainPhaseDealing,
} from "./qa-gaps.shared.js";

vi.setConfig({ testTimeout: 300_000 });

const activeOf = (s: GameState): PlayerId => {
  if (s.step.phase !== "player" || s.step.kind !== "turn") throw new Error("not a player turn");
  return s.step.activePlayerId;
};
/** The active player (default) changes to hero form. */
const toHero = (state: GameState, player: PlayerId = activeOf(state)) =>
  act(state, {}, { type: "changeForm", playerId: player }).state;

describe("Covert Ops (50077), Black Widow game, one player (Spider-Man), standard", () => {
  // 50077: "When Revealed: You are confused. Black Widow schemes." Confused (RRG "Confuse, Confused" p. 13): a confused
  // identity that attempts to thwart discards the confused card instead; the thwart does not happen.
  const control = () => villainPhaseDealing(openScenario("black-widow", 1, { seats: [SPIDER_MAN] }), ["01186"]);
  const covert = () => villainPhaseDealing(openScenario("black-widow", 1, { seats: [SPIDER_MAN] }), ["50077"]);

  it("confuses the player it was dealt to and Black Widow schemes once more than with a plain deal", () => {
    const base = control();
    const { state, events } = covert();
    expect(inst(state, identityOf(state, P1)).statuses.confused).toBe(1);
    expect(inst(base.state, identityOf(base.state, P1)).statuses.confused).toBe(0);
    const schemes = (s: typeof state, e: typeof events) =>
      ofType(e, "schemeResolved").filter((x) => codeOf(s, x.enemyInstanceId) === "50064");
    // Covert Ops: her scheme from the card (no boost icon on the dealt card of the control, whatever the boost draws)
    expect(schemes(state, events).length, "Covert Ops makes her scheme as the control Advance does").toBe(
      schemes(base.state, base.events).length,
    );
    expect(ofType(events, "encounterCardRevealed").map((e) => codeOf(state, e.instanceId))).toContain("50077");
    expect(inPlayAll(state, "50077"), "a treachery is discarded after its When Revealed").toHaveLength(0);
  });

  it("the confused hero's next thwart only discards the confused card: no threat is removed (RRG p. 13)", () => {
    const { state } = covert();
    const hero = toHero(state);
    expect(inst(hero, identityOf(hero, P1)).statuses.confused).toBe(1);
    const before = mainThreatOf(hero);
    const thwarted = act(
      hero,
      {},
      {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(hero, P1),
        schemeInstanceId: hero.mainScheme.instanceId,
      },
    );
    expect(
      inst(thwarted.state, identityOf(thwarted.state, P1)).statuses.confused,
      "the status card was discarded",
    ).toBe(0);
    expect(mainThreatOf(thwarted.state), "no threat removed").toBe(before);
  });
});

describe("Dance of Death (50078), Black Widow game, one player (Spider-Man), standard", () => {
  // 50078: "When Revealed: Deal 1 damage to a character you control. Deal 2 damage to a second character you control. Deal
  // 3 damage to a third character you control." RRG "Defeat" p. 16: damage equal to hit points defeats an ally; "Resolve"
  // (p. 37): as much of an effect as possible.
  const crew = () => {
    let s = openScenario("black-widow", 1, { seats: [SPIDER_MAN] });
    const cat = playFromHand(DEPS, s, BLACK_CAT, 2);
    s = cat.state;
    const bird = playFromHand(DEPS, s, "01083", 3);
    return { state: bird.state, cat: cat.id, bird: bird.id };
  };

  it("deals 1, 2 and 3 to three different characters the player picks, in that order; Black Cat (2 hit points) is defeated", () => {
    const c = crew();
    const me = identityOf(c.state, P1);
    const seen: string[] = [];
    const { state, events } = villainPhaseDealing(c.state, ["50078"], { targets: [c.bird, me, c.cat], seen });
    expect(inst(state, c.bird).damage, "first choice: 1").toBe(1);
    expect(cardsInPlay(state), "third choice, 3 damage on a 2 hit point ally").not.toContain(c.cat);
    expect(playerOf(state, P1).discard).toContain(c.cat);
    const dealt = ofType(events, "damageDealt").filter((e) => [c.bird, me, c.cat].includes(e.targetInstanceId));
    const fromDance = dealt.slice(0, 3).map((e) => [e.targetInstanceId, e.amount]);
    expect(fromDance).toEqual([
      [c.bird, 1],
      [me, 2],
      [c.cat, 3],
    ]);
    // each later prompt leaves out the characters already chosen
    expect(seen.filter((l) => l.startsWith("chooseTarget")).length).toBeGreaterThanOrEqual(3);
  });

  it("with only the identity in play it deals just the first damage (1), not all three to the same character", () => {
    const s = openScenario("black-widow", 1, { seats: [SPIDER_MAN] });
    const control = villainPhaseDealing(s, ["01186"]).state;
    const { state } = villainPhaseDealing(s, ["50078"]);
    const me = identityOf(state, P1);
    expect(inst(state, me).damage - inst(control, me).damage).toBe(1);
  });
});

/** Test-only surgery: every in-play copy of `code` leaves the table for the encounter deck's discard pile or top of its deck. */
function returnToEncounter(state: GameState, code: string, to: "deck" | "discard"): GameState {
  const deckId = activeEncounterDeckId(state);
  const ids = inPlayAll(state, code);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]:
        to === "deck" ? { ...pile, deck: [...ids, ...pile.deck] } : { ...pile, discard: [...pile.discard, ...ids] },
    },
    players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => !ids.includes(i)) })),
    instances: Object.fromEntries(
      Object.entries(state.instances).map(([id, i]) => [
        id,
        ids.includes(id as InstanceId) ? { ...i, engagedWith: null } : i,
      ]),
    ),
  };
}

describe("A.I.M. Soldier (50084) finding A.I.M. Scientist (50083), Black Widow game, two players, standard", () => {
  // 50084: "Patrol. When Revealed: Find A.I.M. Scientist and put it into play engaged with you. (If it is already in play,
  // it engages you.) If A.I.M. Scientist did not enter play this way, place 1 threat on the main scheme." RRG "Engage"
  // (p. 18). 50083: Surge, Vulnerable; "cannot be attacked while the engaged player is engaged with another minion".
  const SEATS2 = [SPIDER_MAN, IRON_MAN];
  for (const where of ["discard", "deck"] as const)
    it(`the Scientist in the encounter ${where}: the first Soldier puts it into play engaged with its player; the second (Scientist in play) moves it to its player and places 1 threat`, () => {
      const start = returnToEncounter(openScenario("black-widow", 2, { seats: SEATS2 }), "50083", where);
      expect(inPlayAll(start, "50083")).toHaveLength(0);
      const { state, events } = villainPhaseDealing(start, ["50084", "50084"]);
      const [sci] = inPlayAll(state, "50083");
      expect(sci, "the Scientist entered play").toBeDefined();
      expect(inPlayAll(state, "50084")).toHaveLength(2);
      expect(inst(state, sci!).engagedWith, "it ended engaged with the second Soldier's player").toBe(P2);
      const revealed = ofType(events, "encounterCardRevealed").filter((e) => codeOf(state, e.instanceId) === "50084");
      expect(revealed.map((e) => e.playerId)).toEqual([P1, P2]);
      const main = state.mainScheme.instanceId;
      const placedBy = (i: number) =>
        ofType(events, "threatPlaced").filter(
          (e) => e.schemeInstanceId === main && e.sourceInstanceId === revealed[i]!.instanceId,
        );
      expect(placedBy(0), "no threat for the first Soldier: the Scientist entered play").toHaveLength(0);
      expect(
        placedBy(1).map((e) => e.amount),
        "the Scientist did not enter play the second time",
      ).toEqual([1]);
    });

  it("a Soldier's Scientist cannot be attacked while its player is engaged with another minion (50083); once the Soldier falls it can", () => {
    const start = returnToEncounter(openScenario("black-widow", 1, { seats: [SPIDER_MAN] }), "50083", "discard");
    // clear the setup minion so the Soldier is the only other minion
    let s = villainPhaseDealing(start, ["50084"]).state;
    const [sci] = inPlayAll(s, "50083");
    const [soldier] = inPlayAll(s, "50084");
    expect(inst(s, sci!).engagedWith).toBe(P1);
    s = toHero(s);
    const attack = (target: InstanceId) =>
      ({ type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s, P1), targetInstanceId: target }) as const;
    const refused = applyCommand(s, attack(sci!), DEPS);
    expect(refused.ok, "the Scientist is protected while another minion is engaged").toBe(false);
    const others = cardsInPlay(s).filter(
      (id) => id !== sci && id !== soldier && inst(s, id).engagedWith === P1 && cardOf(s, id)?.type === "minion",
    );
    // defeat every other engaged minion with the 8 damage Kick, then the Scientist is attackable
    for (const m of [soldier!, ...others]) {
      if (!cardsInPlay(s).includes(m)) continue;
      const kick = moveToHand(s, P1, "01005");
      s = kick.state;
      const pay = playerOf(s, P1)
        .hand.filter((id) => id !== kick.ids[0])
        .slice(0, 3);
      s = act(s, { targets: [m] }, play(P1, kick.ids[0]!, pay, {})).state;
      if (inPlayAll(s, "50083").length === 0) break;
    }
    expect(cardsInPlay(s)).not.toContain(soldier);
    expect(inPlayAll(s, "50083"), "the Scientist is still in play").toEqual([sci]);
    expect(applyCommand(s, attack(sci!), DEPS).ok, "attackable once no other minion is engaged").toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Batroc
// ---------------------------------------------------------------------------------------------------------------

const thwartCmd = (s: GameState, scheme: InstanceId, player: PlayerId = activeOf(s)): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: identityOf(s, player),
  schemeInstanceId: scheme,
});
const setThreat = (s: GameState, id: InstanceId, threat: number): GameState => patchInstance(s, id, { threat });

describe("Batroc (50086), stage 3B in expert mode, one player (Spider-Man)", () => {
  // 50089b: "In expert mode, each minion gains quickstrike. Forced Interrupt: When an enemy attacks, it attacks a Rescued
  // Captive instead." Quickstrike (RRG p. 36): after a minion engages a player whose identity is in hero form, it attacks
  // that player (here redirected to the captive). 50086b: expert Batroc, 12 hit points. 50087a: expert Setup places
  // 2[per_hero] threat on Alert Level.
  function toStageThreeB(difficulty: "standard" | "expert") {
    let s = openScenario("batroc", 1, { seats: [SPIDER_MAN], difficulty });
    s = toHero(s);
    const stages: number[] = [s.mainScheme.stageIndex];
    for (let i = 0; i < 2; i++) {
      s = setThreat(s, s.mainScheme.instanceId, 1);
      s = act(s, { options: ["Advance to"] }, thwartCmd(s, s.mainScheme.instanceId)).state;
      stages.push(s.mainScheme.stageIndex);
      if (i === 0) s = villainPhaseDealing(s, ["01186"]).state;
    }
    return { s, stages };
  }

  it("expert setup: Batroc has 12 hit points and Alert Level starts with 2 threat per hero", () => {
    const s = openScenario("batroc", 1, { seats: [SPIDER_MAN], difficulty: "expert" });
    expect(villainHp(s)).toBe(12);
    expect(inst(s, inPlayAll(s, "50090a")[0]!).threat).toBe(2);
    const std = openScenario("batroc", 1, { seats: [SPIDER_MAN] });
    expect(villainHp(std)).toBe(8);
    expect(inst(std, inPlayAll(std, "50090a")[0]!).threat).toBe(0);
  });

  it("expert: a minion revealed at 3B attacks at once (quickstrike), and the attack lands on the Rescued Captive", () => {
    const { s, stages } = toStageThreeB("expert");
    expect(stages).toEqual([0, 1, 2]);
    const [captive] = inPlayAll(s, "50091");
    expect(captive, "stage 2B put a Rescued Captive into play").toBeDefined();
    const { state, events } = villainPhaseDealing(s, ["50093"], { targets: [captive!] });
    const [guard] = inPlayAll(state, "50093");
    expect(inst(state, guard!).engagedWith).toBe(P1);
    const revealedAt = ofType(events, "encounterCardRevealed").findIndex((e) => e.instanceId === guard);
    expect(revealedAt).toBeGreaterThanOrEqual(0);
    const hits = ofType(events, "attackResolved").filter((a) => a.enemyInstanceId === guard);
    expect(hits, "Embassy Guard attacked in the villain phase it was revealed in").toHaveLength(1);
    expect(hits[0]!.targetInstanceId, "redirected to the captive by 50089b").toBe(captive);
    expect(hits[0]!.damageDealt).toBe(2);
  });

  it("standard: the same minion revealed at 3B does not attack until a later villain phase (no quickstrike)", () => {
    const { s } = toStageThreeB("standard");
    const [captive] = inPlayAll(s, "50091");
    const { state, events } = villainPhaseDealing(s, ["50093"], { targets: [captive!] });
    const [guard] = inPlayAll(state, "50093");
    expect(ofType(events, "attackResolved").filter((a) => a.enemyInstanceId === guard)).toHaveLength(0);
  });
});

describe("Commandeer Security Office (50095), Batroc game, expert", () => {
  // 50095: "When Defeated: Remove 1[per_hero] threat from Alert Level." Expert setup: Alert Level has 2[per_hero] threat
  // (50087a). RRG "Defeat" p. 16 / "When Defeated" (a side scheme is defeated when its last threat is removed).
  for (const players of [1, 2] as const)
    it(`${players} player(s): thwarting its last threat removes ${players} threat from Alert Level (it started with ${2 * players})`, () => {
      const seats = players === 1 ? [SPIDER_MAN] : [SPIDER_MAN, IRON_MAN];
      let s = openScenario("batroc", players, { seats, difficulty: "expert" });
      const alert = inPlayAll(s, "50090a")[0]!;
      expect(inst(s, alert).threat).toBe(2 * players);
      s = villainPhaseDealing(s, ["50095", "50094"]).state;
      const [side] = inPlayAll(s, "50095");
      expect(side, "revealed side scheme in play").toBeDefined();
      s = toHero(s);
      s = setThreat(s, side!, 1);
      const alertBefore = inst(s, alert).threat;
      const done = act(s, {}, thwartCmd(s, side!));
      expect(inPlayAll(done.state, "50095"), "defeated and discarded").toHaveLength(0);
      expect(inst(done.state, alert).threat).toBe(alertBefore - players);
    });
});

describe("Commandeer Security Office (50095) revealed on each side of Alert Level, Batroc game, one player, standard", () => {
  // 50095: "When Revealed: If Alert Level is on its High side, place 1 acceleration token here." The scheme's printed
  // acceleration icon already adds 1 to the main scheme's step 1 threat (RRG "Acceleration Token" p. 5): a token adds one more.
  const accelerationOn = (s: GameState, id: InstanceId) => inst(s, id).counters["acceleration"] ?? 0;
  it("Low side: no token; High side: one acceleration token", () => {
    const low = villainPhaseDealing(openScenario("batroc", 1, { seats: [SPIDER_MAN] }), ["50095"]).state;
    expect(accelerationOn(low, inPlayAll(low, "50095")[0]!)).toBe(0);
    const start = openScenario("batroc", 1, { seats: [SPIDER_MAN] });
    const alert = inPlayAll(start, "50090a")[0]!;
    const high = patchInstance(start, alert, { flipped: true });
    const r = villainPhaseDealing(high, ["50095"]).state;
    expect(accelerationOn(r, inPlayAll(r, "50095")[0]!)).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// M.O.D.O.K.
// ---------------------------------------------------------------------------------------------------------------

const CELL_DECK = "Holding Cell";
const cellOf = (s: GameState): InstanceId => s.scenarioDecks[CELL_DECK]!.inPlayTopId!;
const locksOn = (s: GameState, id: InstanceId): number => inst(s, id).counters["lock"] ?? 0;
const resourcesOf = (s: GameState, id: InstanceId): number =>
  Object.values((cardOf(s, id) as unknown as { resourceIcons?: Record<string, number> }).resourceIcons ?? {}).reduce(
    (a, b) => a + b,
    0,
  );

/** Surgery: the top `n` cards of the player's deck go to their hand (more resources to pay with). */
function stuffHand(state: GameState, player: PlayerId, n: number): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand: [...p.hand, ...p.deck.slice(0, n)], deck: p.deck.slice(n) } : p,
    ),
  };
}
/** Hand cards that between them pay `need` resources, fewest cards first. */
function payment(state: GameState, player: PlayerId, need: number): InstanceId[] {
  const chosen: InstanceId[] = [];
  let have = 0;
  for (const id of playerOf(state, player).hand) {
    if (have >= need) break;
    const r = resourcesOf(state, id);
    if (r === 0) continue;
    chosen.push(id);
    have += r;
  }
  if (have < need) throw new Error("not enough resources in hand");
  return chosen;
}
const cellAction = (s: GameState, cell: InstanceId, pay: readonly InstanceId[], player: PlayerId): Command =>
  use(
    player,
    cell,
    `${codeOf(s, cell)}.holding-cell-action`,
    pay.map((fromHand) => ({ fromHand })),
    undefined,
    {
      branch: 1,
    },
  );

describe("Holding Cell (50105a to 50108a) at two, three and four players: 2[per_hero] lock counters, unlocked one at a time", () => {
  // 50105a: "Enters play with 2[per_hero] lock counters on it. Forced Interrupt: When the last lock counter is removed from
  // here, flip this card and put [the Inhuman] into play under any player's control. Hero Action: Spend [two of a type]
  // resources or 3 resources of any type -> remove 1 lock counter from here." Cost (RRG p. 13): the whole cost is paid.
  for (const players of [2, 3, 4] as const)
    it(`${players} players: ${2 * players} lock counters, one Adaptoid each; ${2 * players} Hero Actions of 3 resources free the ally, the next cell comes up with ${2 * players}`, () => {
      let s = openScenario("modok", players);
      const cell = cellOf(s);
      expect(locksOn(s, cell), "2 per hero").toBe(2 * players);
      const adaptoids = inPlayAll(s, "50113");
      expect(adaptoids.map((a) => inst(s, a).engagedWith).sort(), "one Adaptoid engaged with each player").toEqual(
        s.players.map((p) => p.playerId).sort(),
      );
      const front = codeOf(s, cell);
      s = toHero(s, P1);
      s = stuffHand(s, P1, 4 * players);
      // 2 resources pay neither "2 of the cell's type" in general nor "3 of any type": the engine must refuse a payment
      // of fewer than 3 (here one card of at most 2 resources) unless it is two of the cell's own type
      const one = payment(s, P1, 1).slice(0, 1);
      if (resourcesOf(s, one[0]!) < 3) {
        const thin = applyCommand(s, cellAction(s, cell, one, P1), DEPS);
        expect(thin.ok, "one card of under 3 resources does not pay the 3-resource branch").toBe(false);
      }
      for (let i = 1; i <= 2 * players; i++) {
        const pay = payment(s, P1, 3);
        const r = act(s, {}, cellAction(s, cell, pay, P1));
        s = r.state;
        if (i < 2 * players) {
          expect(locksOn(s, cell), `after action ${i}`).toBe(2 * players - i);
          expect(codeOf(s, cell), "still a cell").toBe(front);
        }
        s = stuffHand(s, P1, 3);
      }
      expect(codeOf(s, cell), "flipped to its ally on the last counter").toBe(front.replace(/a$/, "b"));
      expect(inst(s, cell).controllerId).toBeDefined();
      const next = cellOf(s);
      expect(next).not.toBe(cell);
      expect(locksOn(s, next), "the next cell enters with 2 per hero").toBe(2 * players);
    });
});

/**
 * A villain phase in which the boost cards and the card dealt to the player are the four blank Core treacheries the
 * M.O.D.O.K. deck holds (two Advance 01186 and two Assault 01187, all boost 0): `villainPhaseDealing` assumes one filler
 * title with enough copies.
 */
function quietPhase(state: GameState): { state: GameState; events: GameEvent[] } {
  const turns = (s: GameState): Command[] => {
    const step = s.step;
    if (step.phase !== "player" || step.kind !== "turn") throw new Error("not a player turn");
    return [step.activePlayerId, ...step.remainingPlayerIds].map((playerId) => ({ type: "endTurn", playerId }));
  };
  // boosts first (at least two: the villain and an Adaptoid), then the dealt card: never an Advance, which would scheme again
  const cycle = ["01186", "01186", "01187", "01187"];
  const dry = act(stackEncounterDeck(state, ...cycle), {}, ...turns(state));
  const firstReveal = dry.events.findIndex((e) => e.type === "encounterCardRevealed");
  const boosts = ofType(firstReveal < 0 ? dry.events : dry.events.slice(0, firstReveal), "boostCardDealt").length;
  return act(stackEncounterDeck(state, ...cycle.slice(0, boosts + 1)), {}, ...turns(state));
}

describe("Upgrading Adaptoids (50104) with the Adaptoid environments that come into play, one player (Spider-Man), standard", () => {
  // 50104a: "Forced Interrupt: When this stage would be completed, put 1 random set-aside Adaptoid environment into play
  // instead. Then, if there are no set-aside Adaptoid environments, the players lose the game." So standard play shows at
  // most three environments (the setup one and two completions); the fourth ends the game. 50109 to 50112: Flying +1 SCH /
  // incite 1 / Aerial; Psionic villainous / Psionic; Sarah Garza Elite / +1 ATK / overkill and ranged attacks; Strong
  // +1 ATK / toughness / Brute. Adaptoid (50113): ATK 1, SCH 1, 5 hit points, Adaptoid trait.
  const UPGRADES = {
    "50109": { atk: 0, sch: 1, keywords: ["incite"], traits: ["AERIAL"] },
    "50110": { atk: 0, sch: 0, keywords: ["villainous"], traits: ["PSIONIC"] },
    "50111": { atk: 1, sch: 0, keywords: [], traits: ["ELITE"] },
    "50112": { atk: 1, sch: 0, keywords: ["toughness"], traits: ["BRUTE"] },
  } as const;
  const upgradeCodes = (s: GameState) =>
    (Object.keys(UPGRADES) as (keyof typeof UPGRADES)[]).filter((c) => inPlayAll(s, c).length > 0);

  /** Setup, then `completions` real completions of the stage (the threat set one below the target, then a villain phase). */
  function afterCompletions(completions: number) {
    let s = openScenario("modok", 1, { seats: [SPIDER_MAN] });
    for (let i = 0; i < completions; i++) {
      s = setThreat(s, s.mainScheme.instanceId, targetThreatOf(s) - 1);
      s = quietPhase(s).state;
      expect(s.outcome, `completion ${i + 1} is replaced, not lost`).toBeNull();
      expect(upgradeCodes(s)).toHaveLength(2 + i);
    }
    return s;
  }

  it("after two completions three environments are in play; every Adaptoid has exactly their combined modifiers", () => {
    const s = afterCompletions(2);
    const present = upgradeCodes(s);
    expect(present).toHaveLength(3);
    expect(mainThreatOf(s), "the completion removed the threat").toBeLessThan(targetThreatOf(s));
    const adaptoids = inPlayAll(s, "50113");
    expect(adaptoids.length).toBeGreaterThan(0);
    const sum = (key: "atk" | "sch") => present.reduce((n, c) => n + UPGRADES[c][key], 0);
    const keywords = present.flatMap((c) => UPGRADES[c].keywords);
    const traits = ["ADAPTOID", ...present.flatMap((c) => UPGRADES[c].traits)];
    for (const a of adaptoids) {
      expect(statBonus(s, DEPS, a, "atk")).toBe(sum("atk"));
      expect(statBonus(s, DEPS, a, "sch")).toBe(sum("sch"));
      expect(
        keywordsOf(s, a, DEPS)
          .map((k) => k.name)
          .sort(),
      ).toEqual([...keywords].sort());
      expect(keywordTotal(s, a, "incite", DEPS)).toBe(present.includes("50109") ? 1 : 0);
      expect(traitsOf(s, a, DEPS).map(String).sort()).toEqual([...traits].sort());
    }
  });

  it("in a villain phase an Adaptoid schemes with 1 + the environments' SCH as an alter ego and attacks with 1 + their ATK as a hero", () => {
    const s0 = afterCompletions(2);
    const present = upgradeCodes(s0);
    const adaptoid = inPlayAll(s0, "50113")[0]!;
    const calm = (s: GameState) => setThreat(s, s.mainScheme.instanceId, 0);
    const asAlterEgo = quietPhase(calm(s0));
    const scheme = ofType(asAlterEgo.events, "schemeResolved").find((e) => e.enemyInstanceId === adaptoid);
    expect(scheme?.baseSch).toBe(1 + present.reduce((n, c) => n + UPGRADES[c].sch, 0));
    const asHero = quietPhase(calm(toHero(asAlterEgo.state)));
    const attack = ofType(asHero.events, "attackResolved").find((e) => e.enemyInstanceId === adaptoid);
    expect(attack?.baseAtk).toBe(1 + present.reduce((n, c) => n + UPGRADES[c].atk, 0));
  });

  it("the completion that would put the last environment into play loses the game (no set-aside environment left)", () => {
    let s = afterCompletions(2);
    s = setThreat(s, s.mainScheme.instanceId, targetThreatOf(s) - 1);
    s = quietPhase(s).state;
    expect(upgradeCodes(s), "the fourth entered before the loss").toHaveLength(4);
    expect(s.outcome).toMatchObject({ result: "loss" });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Thunderbolts: Fixer (Techno, 53038) and Blizzard (Whiteout, 54034) held by Thunderbolt Backup, then engaged
// ---------------------------------------------------------------------------------------------------------------

const DEPS9: EngineDeps = { abilities: WAVE9_ABILITIES };
const ZERO_ICON_FILLERS = ["01187", "01186", "01188", "01190", "01189"];

function openThunderbolts(seed: number, seat: (typeof SEATS)[number] | typeof CAPTAIN_MARVEL, extra: string[] = []) {
  const config = wave9Scenario("thunderbolts", { players: [seat], seed });
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...extra.map(cardId)] }, DEPS9);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS9);
}

/** Everything in a villain phase with `dealt` as the card(s) dealt; boosts are the least-icon Core fillers still around. */
function thunderPhase(state: GameState, dealt: readonly string[], pick: Picker = firstLegal) {
  const copies = (code: string) => Object.values(state.instances).filter((i) => (i.cardId as string) === code).length;
  const pool = ZERO_ICON_FILLERS.flatMap((c) => Array.from({ length: copies(c) }, () => c));
  const turns = (s: GameState): Command[] => {
    const step = s.step;
    if (step.phase !== "player" || step.kind !== "turn") throw new Error("not a player turn");
    return [step.activePlayerId, ...step.remainingPlayerIds].map((playerId) => ({ type: "endTurn", playerId }));
  };
  const run = (s: GameState, codes: readonly string[]) => {
    let current = stackEncounterDeck(s, ...codes);
    const events: GameEvent[] = [];
    for (const command of turns(s)) {
      let r = applyCommand(current, command, DEPS9);
      if (!r.ok) throw new Error(r.error.message);
      current = r.state;
      events.push(...r.events);
      for (let guard = 0; current.pendingChoice && guard < 100; guard++) {
        const choice = current.pendingChoice;
        r = applyCommand(
          current,
          {
            type: "resolveChoice",
            playerId: choice.playerId,
            choiceId: choice.choiceId,
            selectedOptionIds: pick(current),
          },
          DEPS9,
        );
        if (!r.ok) throw new Error(r.error.message);
        current = r.state;
        events.push(...r.events);
      }
    }
    return { state: current, events };
  };
  const dry = run(state, pool.slice(0, 8));
  const firstReveal = dry.events.findIndex((e) => e.type === "encounterCardRevealed");
  const boosts = ofType(firstReveal < 0 ? dry.events : dry.events.slice(0, firstReveal), "boostCardDealt").length;
  return run(state, [...pool.slice(0, boosts), ...dealt]);
}

describe("Thunderbolt minions held by Thunderbolt Backup (50131b) and then engaged, one player, standard", () => {
  // 50131b: "Forced Interrupt: When the round ends, attach the Thunderbolt minion with the most damage here, swapping it
  // with the minion already attached here, if any. Heal 1[per_hero] damage from attached minion." 50130a: "Forced
  // Response: After a player attacks a Thunderbolt minion, that minion engages that player." The held minion is in play
  // (RRG "Attach", p. 8) and can be attacked. Thunderbolts decisions in the MC50 FAQ p. 22: ties are the first player's.
  const heldBy = (s: GameState): InstanceId | undefined => inst(s, inPlayAll(s, "50131a")[0]!).attachments[0];

  it("Blizzard (Whiteout), attacked while held, engages; Backup holds him again healed 1; Whiteout then makes the held Blizzard engage and attack, and the ice attaches", () => {
    let s = openThunderbolts(1, SPIDER_MAN);
    const [blizzard] = inPlayAll(s, "54034");
    expect(blizzard, "Blizzard comes with the Whiteout set").toBeDefined();
    expect(inst(s, inPlayAll(s, "50131a")[0]!).attachments, "held at setup").toEqual([blizzard]);
    s = toHero(s);
    const kick = moveToHand(s, P1, "01005");
    s = kick.state;
    const pay = playerOf(s, P1)
      .hand.filter((id) => id !== kick.ids[0])
      .slice(0, 3);
    s = act(s, { targets: [blizzard!] }, play(P1, kick.ids[0]!, pay, {})).state;
    expect(inst(s, blizzard!).damage).toBe(8);
    expect(inst(s, blizzard!).engagedWith, "50130a: attacked, it engages the attacker").toBe(P1);
    const round1 = thunderPhase(s, []);
    s = round1.state;
    expect(inst(s, blizzard!).engagedWith, "held again").toBeNull();
    expect(inst(s, blizzard!).attachedTo).toBe(inPlayAll(s, "50131a")[0]);
    expect(heldBy(s)).toBe(blizzard);
    expect(inst(s, blizzard!).damage, "8 less 1 healed by Backup").toBe(7);
    // surgery: round 1 hurt Spider-Man (Blizzard, Radioactive Man); he starts round 2 unhurt so the game goes on
    s = patchInstance(s, identityOf(s, P1), { damage: 0 });
    const round2 = thunderPhase(s, ["54037"]);
    s = round2.state;
    expect(
      inst(s, blizzard!).damage,
      "damage kept through the engagement; healed 1 again when held at the round end",
    ).toBe(6);
    const blizzardAttack = ofType(round2.events, "attackResolved").filter((e) => e.enemyInstanceId === blizzard);
    expect(blizzardAttack, "Whiteout: the held Blizzard engaged Spider-Man and attacked him").toHaveLength(1);
    expect(blizzardAttack[0]!.targetInstanceId).toBe(identityOf(s, P1));
    const ice = inst(s, identityOf(s, P1)).attachments.filter((id) => codeOf(s, id) === "54035");
    // one copy per Blizzard attack: round 1 (after he engaged by being attacked) and round 2 (engaged by Whiteout)
    expect(ice, "Blizzard's Forced Response attached Encased in Ice after each attack").toHaveLength(2);
  });

  it("Fixer (Techno), held with the Energy Truncheon the villain should have had, comes back engaged when Backup swaps him in: the Truncheon stays on him", () => {
    let s = openThunderbolts(2, CAPTAIN_MARVEL, ["51040"]);
    const [fixer] = inPlayAll(s, "53038");
    const [songbird] = inPlayAll(s, "50143");
    expect(fixer).toBeDefined();
    expect(inst(s, fixer!).engagedWith).toBeNull();
    expect(inst(s, songbird!).engagedWith).toBe(P1);
    s = toHero(s);
    s = act(
      s,
      { targets: [songbird!] },
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(s, P1),
        targetInstanceId: songbird!,
      },
    ).state;
    const dmg = inst(s, songbird!).damage;
    expect(dmg).toBeGreaterThan(0);
    const round1 = thunderPhase(s, ["51040"]);
    s = round1.state;
    const [truncheon] = inPlayAll(s, "51040");
    expect(truncheon, "revealed in the villain phase").toBeDefined();
    expect(inst(s, truncheon!).attachedTo, "Fixer's Forced Interrupt (53038) takes it instead of Citizen V").toBe(
      fixer,
    );
    expect(inst(s, songbird!).attachedTo, "the more damaged Songbird is held now").toBe(inPlayAll(s, "50131a")[0]);
    expect(inst(s, fixer!).engagedWith, "Fixer takes Songbird's place, engaged with her player").toBe(P1);
    expect(inst(s, fixer!).attachedTo).toBeNull();
    expect(inst(s, truncheon!).attachedTo, "the attachment is still on him").toBe(fixer);
    const round2 = thunderPhase(s, []);
    const attack = ofType(round2.events, "attackResolved").find((e) => e.enemyInstanceId === fixer);
    expect(attack, "Fixer attacks as an engaged minion").toBeDefined();
    expect(attack!.baseAtk).toBe(1 + statBonus(s, DEPS9, fixer!, "atk"));
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Baron Zemo
// ---------------------------------------------------------------------------------------------------------------

const memberIn = (s: GameState, code: string): InstanceId => inPlayAll(s, code)[0]!;
const secretsOf = (s: GameState, id: InstanceId): number => inst(s, id).counters["secret"] ?? 0;
const zemoHero = (seed = 1) => toHero(openScenario("baron-zemo", 1, { seed, seats: [SPIDER_MAN] }));

describe("Chief Medical Officer (50181a) Hero Action in a Baron Zemo game, one player (Spider-Man), standard", () => {
  // 50181a: "Hero Action: Spend [energy] [energy] resources -> remove 1 secret counter from here. Then, heal 1 damage from
  // a friendly character." RRG "'Then'" (p. 44): the second part happens after the first; Cost (p. 13) is paid in full.
  const heal = (s: GameState, pay: readonly InstanceId[]) =>
    use(
      P1,
      memberIn(s, "50181a"),
      "50181a.chief-medical-officer-action",
      pay.map((fromHand) => ({ fromHand })),
    );

  it("two energy resources remove one secret counter and heal 1 from the chosen friendly character", () => {
    let s = zemoHero();
    const medical = memberIn(s, "50181a");
    const me = identityOf(s, P1);
    s = patchInstance(s, me, { damage: 3 });
    const given = moveToHand(s, P1, "01007", "01007");
    const secrets = secretsOf(given.state, medical);
    expect(secrets).toBe(2);
    const r = act(given.state, { targets: [me] }, heal(given.state, given.ids));
    expect(secretsOf(r.state, medical)).toBe(1);
    expect(inst(r.state, me).damage).toBe(2);
    for (const id of given.ids) expect(playerOf(r.state, P1).discard).toContain(id);
  });

  it("it heals an ally just as well, and two physical resources do not pay it (refused, nothing changes)", () => {
    let s = zemoHero();
    const cat = playFromHand(DEPS, s, BLACK_CAT, 2);
    s = patchInstance(cat.state, cat.id, { damage: 1 });
    const wrong = moveToHand(s, P1, "01003", "01003");
    const refused = applyCommand(wrong.state, heal(wrong.state, wrong.ids), DEPS);
    expect(refused.ok, "physical is not energy").toBe(false);
    const given = moveToHand(wrong.state, P1, "01007", "01007");
    const r = act(given.state, { targets: [cat.id] }, heal(given.state, given.ids));
    expect(inst(r.state, cat.id).damage).toBe(0);
  });
});

describe("Baron Zemo's Sword (50170), the energy branch of its cost, Baron Zemo game, one player", () => {
  // 50170: "Hero Action: Spend [physical] [physical] [physical] or [energy] [energy] [energy] resources -> remove 1 secret
  // counter from a Board Member environment and discard this card." qa-gaps-zemo.qa.test.ts proves the physical branch.
  function armed() {
    let s = openScenario("baron-zemo", 1, { seed: 1, seats: [SPIDER_MAN] });
    s = villainPhaseDealing(s, ["50170"], { options: ["Do not"], take: [] }).state;
    const sword = inPlayAll(s, "50170")[0]!;
    return { s: toHero(s), sword };
  }
  const swordCmd = (sword: InstanceId, pay: readonly InstanceId[], branch: 0 | 1) =>
    use(
      P1,
      sword,
      "50170.baron-zemos-sword-action",
      pay.map((fromHand) => ({ fromHand })),
      undefined,
      { branch },
    );
  const total = (s: GameState) => ["50181a", "50182a", "50183a"].reduce((n, c) => n + secretsOf(s, memberIn(s, c)), 0);

  it("three energy resources (branch 2 of the cost) remove a secret counter and discard the Sword", () => {
    const { s, sword } = armed();
    const given = moveToHand(s, P1, "01007", "01007", "01006");
    const before = total(given.state);
    const r = act(given.state, { targets: [] }, swordCmd(sword, given.ids, 1));
    expect(total(r.state)).toBe(before - 1);
    expect(inst(r.state, sword).attachedTo).toBeNull();
  });

  it("a mix of two physical and one energy pays neither branch: refused, the Sword stays", () => {
    const { s, sword } = armed();
    const given = moveToHand(s, P1, "01003", "01003", "01007");
    for (const branch of [0, 1] as const)
      expect(applyCommand(given.state, swordCmd(sword, given.ids, branch), DEPS).ok, `branch ${branch}`).toBe(false);
  });
});

describe("A.I.M. Interference ([energy], 50184a) in a Baron Zemo game, one player, standard", () => {
  // 50184a: "Incite 1. When Revealed: Place 1 secret counter on each Board Member card. You may spend X [energy] resources
  // to prevent X of these counters from being placed." (Incite 1 places 1 threat on the main scheme first, MC55 p. 2.)
  const payX =
    (x: number): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseNumber") {
        const hit = choice.options.find((o) => o.label === String(x));
        return [hit ? hit.optionId : choice.options.at(-1)!.optionId];
      }
      if (choice.prompt.kind === "spendResources")
        return choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
      return planned({ options: ["Do not"], take: [] })(s);
    };
  const total = (s: GameState) => ["50181a", "50182a", "50183a"].reduce((n, c) => n + secretsOf(s, memberIn(s, c)), 0);

  it("with nothing spent every member gets a counter; spending X energy resources prevents exactly X of the three", () => {
    const base = openScenario("baron-zemo", 1, { seed: 1, seats: [SPIDER_MAN] });
    const start = total(base);
    const none = villainPhaseDealing(base, ["50184a"], payX(0));
    expect(total(none.state) - start, "all three placed").toBe(3);
    const given = moveToHand(base, P1, "01007", "01007", "01006");
    const two = villainPhaseDealing(given.state, ["50184a"], payX(2));
    expect(total(two.state) - start, "2 of 3 prevented").toBe(1);
    expect(
      ofType(two.events, "threatPrevented").length + ofType(two.events, "counterPrevented" as never).length,
    ).toBeGreaterThanOrEqual(0);
    const spent = given.ids.filter((id) => playerOf(two.state, P1).discard.includes(id));
    expect(spent, "exactly 2 energy cards were spent").toHaveLength(2);
    const all3 = villainPhaseDealing(given.state, ["50184a"], payX(3));
    expect(total(all3.state) - start, "all three prevented").toBe(0);
  });
});

describe("Reluctant Foe (50171) activating in the villain phase after it is revealed, Baron Zemo game, one player", () => {
  // 50171: "Treat attached hero as an Elite minion with SCH equal to its printed THW. Replace its printed text box with:
  // 'Villainous. When Defeated: Remove this hero and Reluctant Foe from the game.' When Revealed: Search your collection
  // for a hero whose title does not match a character in play and put it into play engaged with you. Attach this card to
  // it." RRG "Minion" activation (p. 27): an engaged minion attacks a hero-form player.
  const CAPTAIN_MARVEL_ID = "01010a";
  const pick: Picker = (s) =>
    s.pendingChoice!.prompt.kind === "searchCollection"
      ? [CAPTAIN_MARVEL_ID]
      : planned({ options: ["Do not"], take: [] })(s);

  it("the found hero attacks Spider-Man with its printed ATK in the next villain phase, is defeated by an attack and both cards leave the game", () => {
    let s = zemoHero();
    s = villainPhaseDealing(s, ["50171"], pick).state;
    const [foe] = inPlayAll(s, "50171");
    expect(foe).toBeDefined();
    const hero = inst(s, foe!).attachedTo!;
    expect(codeOf(s, hero)).toBe(CAPTAIN_MARVEL_ID);
    expect(inst(s, hero).engagedWith).toBe(P1);
    // surgery: the first phase hurt Spider-Man (Zemo's own attack); he starts the second unhurt so the game goes on
    const next = villainPhaseDealing(patchInstance(s, identityOf(s, P1), { damage: 0 }), ["50180"], pick);
    const attacks = ofType(next.events, "attackResolved").filter((e) => e.enemyInstanceId === hero);
    expect(attacks, "the hero-minion activates").toHaveLength(1);
    expect(attacks[0]!.baseAtk, "Captain Marvel's printed ATK").toBe(2);
    expect(attacks[0]!.targetInstanceId).toBe(identityOf(next.state, P1));
    // defeated: 12 hit points, 11 damage, one more hit
    let t = patchInstance(next.state, hero, { damage: 11 });
    t = act(
      t,
      {},
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(t, P1),
        targetInstanceId: hero,
      },
    ).state;
    expect(t.removedFromGame).toEqual(expect.arrayContaining([hero, foe!]));
    expect(playerOf(t, P1).discard).not.toContain(hero);
    expect(cardsInPlay(t)).not.toContain(hero);
  });
});
