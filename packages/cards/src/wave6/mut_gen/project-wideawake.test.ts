import {
  activeEncounterDeckId,
  activeVillain,
  cardsInPlay,
  characterProfile,
  isPermanent,
  keywordTotal,
  type GameState,
  type GameEvent,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  P2,
  patchInstance,
  picking,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  driveStepwise,
  encounterCardInVillainArea,
  playFromHand as playFromHandWith,
} from "../../testing/staging.js";
import { buildCrossHeroDeck, CORE_HERO_FOR_ASPECT } from "../../testing/cross-hero.js";
import { AS_DRONE } from "../../dsl/index.js";
import { WAVE6_CARDS } from "../cards.js";
import {
  inPlay,
  inPlayIds,
  attachToHost,
  engageMinion,
  handWith,
  putSetAsideAllyInPlay,
  tuckBySurgery,
  wideawakeGame,
} from "./project-wideawake-testing.js";

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const finish = (state: GameState, pick: Picker = firstLegal) => settle(state, pick, undefined, WAVE6_DEPS);
const deckOf = (state: GameState) => state.encounterDecks[activeEncounterDeckId(state)]!;
const countOf = (state: GameState, ids: readonly string[], code: string) =>
  ids.filter((id) => state.instances[id]!.cardId === code).length;
const villain = (state: GameState) => activeVillain(state).instanceId;
const TWO = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
] as const;
const playFromHand = (state: GameState, code: string, cost: number) => playFromHandWith(WAVE6_DEPS, state, code, cost);
const mainScheme = (state: GameState) => state.mainScheme.instanceId;
/** The first player (P2 when seated first) ends their turn, leaving the next player's turn to play. */
const endRound0 = (state: GameState) =>
  settle(run(state, { type: "endTurn", playerId: state.firstPlayerId }), firstLegal, undefined, WAVE6_DEPS);

describe("Sentinel (32084-32086)", () => {
  it("32084.when-revealed: reveals exactly one copy of Abduction Protocols, the other three stay in the deck", () => {
    const state = wideawakeGame();
    expect(inPlay(state, "32100")).toHaveLength(1);
    expect(countOf(state, deckOf(state).deck, "32100")).toBe(3);
    // Stage I deals nobody a card.
    expect(playerOf(state, P1).dealtEncounter).toHaveLength(0);
  });

  it("32085.when-revealed: Sentinel (II) reveals Abduction Protocols and deals each other player (not the first) one facedown card", () => {
    const state = wideawakeGame({ difficulty: "expert", players: TWO });
    expect(activeVillain(state).stageIndex).toBe(1);
    expect(inPlay(state, "32100")).toHaveLength(1);
    expect(playerOf(state, P1).dealtEncounter).toHaveLength(0);
    expect(playerOf(state, P2).dealtEncounter).toHaveLength(1);
  });

  it("32086.when-revealed: Sentinel (III) does the same on reaching stage 3", () => {
    const start = run(wideawakeGame({ difficulty: "expert", players: TWO }), toHero(P1));
    // Toughness would absorb the killing blow, so the tough status is taken off first.
    const bare = patchInstance(start, villain(start), {
      statuses: { ...inst(start, villain(start)).statuses, tough: 0 },
    });
    const after = defeatWithAttack(WAVE6_DEPS, bare, villain(start));
    expect(activeVillain(after).stageIndex).toBe(2);
    expect(inPlay(after, "32100")).toHaveLength(2);
    expect(playerOf(after, P2).dealtEncounter.length).toBe(playerOf(start, P2).dealtEncounter.length + 1);
  });
});

const CAPTIVES = ["32089", "32090", "32091", "32092"];
const endRound = (state: GameState, pick: Picker = firstLegal, player = P1) =>
  settle(run(state, { type: "endTurn", playerId: player }), pick, undefined, WAVE6_DEPS);
const threatOf = (state: GameState, id: InstanceId) => inst(state, id).threat;
const tuckedUnder = (state: GameState, id: InstanceId) => inst(state, id).tucked.map((i) => state.instances[i]!.cardId);

describe("Night of the Sentinels (32087)", () => {
  it("32087a.setup: reveals Operation Zero Tolerance then Mutants at the Mall, and sets every Captive ally aside", () => {
    const state = wideawakeGame();
    const ids = inPlayIds(state);
    expect(ids.filter((id) => id === "32104")).toHaveLength(1);
    expect(ids.filter((id) => id === "32088a")).toHaveLength(1);
    expect(ids.indexOf("32104")).toBeLessThan(ids.indexOf("32088a"));
    expect(countOf(state, deckOf(state).deck, "32104")).toBe(0);
    expect(countOf(state, deckOf(state).deck, "32088a")).toBe(0);
    expect(threatOf(state, inPlay(state, "32104")[0]!)).toBe(3);
    expect(threatOf(state, inPlay(state, "32088a")[0]!)).toBe(4);
    expect(state.encounterSetAside.map((i) => state.instances[i]!.cardId).sort()).toEqual(CAPTIVES);
    for (const code of CAPTIVES) {
      expect(countOf(state, deckOf(state).deck, code)).toBe(0);
      expect(ids).not.toContain(code);
    }
  });

  it("32087b.night-of-the-sentinels-constant: Operation Zero Tolerance is permanent, Mutants at the Mall is not", () => {
    const state = wideawakeGame();
    expect(isPermanent(state, inPlay(state, "32104")[0]!, WAVE6_DEPS)).toBe(true);
    expect(isPermanent(state, inPlay(state, "32088a")[0]!, WAVE6_DEPS)).toBe(false);
  });

  describe("32087b.night-of-the-sentinels-forced-response", () => {
    const heroState = () => run(wideawakeGame(), toHero(P1));
    it("below 5 threat nothing is placed under Operation Zero Tolerance", () => {
      const before = heroState();
      const after = endRound(before);
      const placed = threatOf(after, mainScheme(after)) - threatOf(before, mainScheme(before));
      expect(placed).toBeGreaterThan(0);
      expect(placed).toBeLessThan(5);
      expect(tuckedUnder(after, inPlay(after, "32104")[0]!)).toEqual([]);
    });

    it("at 5 or more it tucks the first player's top card facedown under OZT and removes 5 threat", () => {
      const base = heroState();
      const control = endRound(base);
      const placed = threatOf(control, mainScheme(control)) - threatOf(base, mainScheme(base));
      const staged = patchInstance(base, mainScheme(base), { threat: 5 - placed });
      const topCard = playerOf(staged, P1).deck[0]!;
      const after = endRound(staged);
      const ozt = inPlay(after, "32104")[0]!;
      expect(inst(after, ozt).tucked).toEqual([topCard]);
      expect(inst(after, topCard).faceup).toBe(false);
      expect(threatOf(after, mainScheme(after))).toBe(0);
    });

    it("with 2 players the threshold is 10 and the card is the first player's, not the seat order's", () => {
      const base = run(wideawakeGame({ players: TWO, firstPlayerIndex: 1 }), toHero(P2));
      expect(base.firstPlayerId).toBe(P2);
      // P2 (first player) ends their turn; P1 then changes to hero form and ends theirs; the villain phase follows.
      const round = (state: GameState) => endRound(run(endRound(state, firstLegal, P2), toHero(P1)), firstLegal, P1);
      const control = round(base);
      const placed = threatOf(control, mainScheme(control)) - threatOf(base, mainScheme(base));
      const below = round(patchInstance(base, mainScheme(base), { threat: 9 - placed }));
      expect(tuckedUnder(below, inPlay(below, "32104")[0]!)).toEqual([]);
      expect(threatOf(below, mainScheme(below))).toBe(9);
      const staged = patchInstance(base, mainScheme(base), { threat: 10 - placed });
      const topCard = playerOf(staged, P2).deck[0]!;
      const after = round(staged);
      expect(inst(after, inPlay(after, "32104")[0]!).tucked).toEqual([topCard]);
      expect(threatOf(after, mainScheme(after))).toBe(0);
    });
  });
});

/** The thwart that lands the killing blow on a side scheme: its threat is set to 1 first. */
const thwartOut = (state: GameState, scheme: InstanceId, player = P1) => {
  const staged = patchInstance(state, scheme, { threat: 1 });
  return settle(
    run(staged, {
      type: "basicThwart",
      playerId: player,
      thwarterInstanceId: identityOf(staged, player),
      schemeInstanceId: scheme,
    }),
    firstLegal,
    undefined,
    WAVE6_DEPS,
  );
};
/** Accepts the named optional response (by ability id) when it is offered; declines every other choice. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };
const printedCard = (state: GameState, id: InstanceId) => state.cardPool[state.instances[id]!.cardId]!;

describe("Mutants at the Mall (32088a) and Jubilee (32088b)", () => {
  const pickMarkIv =
    (id: InstanceId): Picker =>
    (state) =>
      state.pendingChoice?.prompt.kind === "chooseCards" ? [id] : firstLegal(state);

  it("32088a.when-defeated: the first player searches for a Sentinel minion and reveals it (engaged with them), and the deck is shuffled", () => {
    const hero = run(wideawakeGame(), toHero(P1));
    const mall = inPlay(hero, "32088a")[0]!;
    const markIv = deckOf(hero).deck.find((i) => hero.instances[i]!.cardId === "32093")!;
    const staged = patchInstance(hero, mall, { threat: 1 });
    const after = settle(
      run(staged, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(staged),
        schemeInstanceId: mall,
      }),
      pickMarkIv(markIv),
      undefined,
      WAVE6_DEPS,
    );
    expect(cardsInPlay(after)).toContain(markIv);
    expect(inst(after, markIv).engagedWith).toBe(P1);
    expect(deckOf(after).deck).not.toContain(markIv);
    expect(deckOf(after).deck).not.toEqual(deckOf(hero).deck.filter((i) => i !== markIv));
    expect([...deckOf(after).deck].sort()).toEqual([...deckOf(hero).deck.filter((i) => i !== markIv)].sort());
  });

  it("32088a.when-defeated: flips into Jubilee (ally 32088b) in play under the first player's control, not the defeating player's", () => {
    const hero = run(wideawakeGame({ players: TWO, firstPlayerIndex: 1 }), toHero(P2));
    // P2 (first) ends their turn; P1 changes to hero form and defeats the scheme.
    const p1Turn = run(endRound0(hero), toHero(P1));
    const mall = inPlay(p1Turn, "32088a")[0]!;
    const after = thwartOut(p1Turn, mall, P1);
    expect(inst(after, mall).cardId).toBe("32088b");
    expect(printedCard(after, mall).type).toBe("ally");
    expect(cardsInPlay(after)).toContain(mall);
    expect(inst(after, mall).controllerId).toBe(P2);
    expect(playerOf(after, P2).playArea).toContain(mall);
    expect(playerOf(after, P1).playArea).not.toContain(mall);
  });

  it("32088b.jubilee-constant: she does not count against the ally limit (a fourth ally stays in play, nothing is discarded)", () => {
    let hero = run(wideawakeGame(), toHero(P1));
    const allies: InstanceId[] = [];
    for (const code of ["32089", "32090", "32091"]) {
      const put = putSetAsideAllyInPlay(hero, code);
      hero = put.state;
      allies.push(put.id);
    }
    const mall = inPlay(hero, "32088a")[0]!;
    const after = thwartOut(hero, mall, P1);
    for (const id of [...allies, mall]) expect(cardsInPlay(after), id).toContain(id);
    expect(after.pendingChoice).toBeNull();
  });

  it("32088a.when-defeated: any other ally version of Jubilee is discarded from play", () => {
    const start = run(wideawakeGame({ players: [{ starterDeckId: "wolverine-aggression" }] }), toHero(P1));
    const { state: played, id: otherJubilee } = playFromHand(start, "35003", 2);
    expect(cardsInPlay(played)).toContain(otherJubilee);
    const mall = inPlay(played, "32088a")[0]!;
    const after = thwartOut(played, mall, P1);
    expect(cardsInPlay(after)).not.toContain(otherJubilee);
    expect(playerOf(after, P1).discard).toContain(otherJubilee);
    expect(cardsInPlay(after)).toContain(mall);
    expect(inst(after, mall).cardId).toBe("32088b");
    expect(inPlayIds(after).filter((code) => code === "35003" || code === "32088b")).toEqual(["32088b"]);
  });

  it("32088b.jubilee-action: exhausts her and spends an [energy] resource to deal 2 damage to an enemy", () => {
    const hero = run(wideawakeGame(), toHero(P1));
    const markIv = deckOf(hero).deck.find((i) => hero.instances[i]!.cardId === "32093")!;
    const mall = inPlay(hero, "32088a")[0]!;
    const staged = patchInstance(hero, mall, { threat: 1 });
    const flipped = settle(
      run(staged, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(staged),
        schemeInstanceId: mall,
      }),
      pickMarkIv(markIv),
      undefined,
      WAVE6_DEPS,
    );
    const payer = playerOf(flipped, P1).hand.find((id) => {
      const card = printedCard(flipped, id);
      return "resourceIcons" in card && ((card.resourceIcons?.energy ?? 0) > 0 || (card.resourceIcons?.wild ?? 0) > 0);
    })!;
    const used = settle(
      run(flipped, use(P1, mall, "32088b.jubilee-action", [{ fromHand: payer }])),
      picking(markIv),
      undefined,
      WAVE6_DEPS,
    );
    expect(inst(used, markIv).damage).toBe(2);
    expect(inst(used, mall).exhausted).toBe(true);
    expect(playerOf(used, P1).discard).toContain(payer);
  });
});

describe("Abduction Protocols (32100)", () => {
  it("32100.when-defeated: the player who defeated it takes 1 random set-aside Captive ally into play under their control", () => {
    // P1 is not the first player, so "their control" is told apart from "the first player's".
    const base = run(wideawakeGame({ players: TWO, firstPlayerIndex: 1 }), toHero(P2));
    const p1Turn = run(endRound0(base), toHero(P1));
    const protocols = inPlay(p1Turn, "32100")[0]!;
    const before = p1Turn.encounterSetAside;
    expect(before).toHaveLength(4);
    const after = thwartOut(p1Turn, protocols, P1);
    const taken = before.filter((id) => !after.encounterSetAside.includes(id));
    expect(taken).toHaveLength(1);
    expect(CAPTIVES).toContain(inst(after, taken[0]!).cardId);
    expect(cardsInPlay(after)).toContain(taken[0]);
    expect(inst(after, taken[0]!).controllerId).toBe(P1);
    expect(playerOf(after, P1).playArea).toContain(taken[0]);
    expect(after.encounterSetAside).toHaveLength(3);
  });
});

describe("Captive allies", () => {
  /** A hero-form P1, `ally` in play for them, and Sentinel Mark IVs engaged with `engagedWith`. */
  const stage = (ally: string, minions: readonly PlayerId[]) => {
    let state = run(wideawakeGame({ players: TWO }), toHero(P1));
    const allyPut = putSetAsideAllyInPlay(state, ally, P1);
    state = allyPut.state;
    const ids: InstanceId[] = [];
    for (const who of minions) {
      const put = engageMinion(state, "32093", who);
      state = put.state;
      ids.push(put.id);
    }
    // No tough status on the villain: a plain damage count.
    state = patchInstance(state, villain(state), { statuses: { ...inst(state, villain(state)).statuses, tough: 0 } });
    return { state, ally: allyPut.id, minions: ids };
  };

  it("32089.rictor-response: after Rictor attacks, 1 damage to the villain and to each minion engaged with you, not to one engaged with another player", () => {
    const { state, ally, minions } = stage("32089", [P1, P2]);
    const [mine, theirs] = minions as [InstanceId, InstanceId];
    const after = settle(
      run(state, { type: "basicAttack", playerId: P1, attackerInstanceId: ally, targetInstanceId: mine }),
      accepting("32089.rictor-response"),
      undefined,
      WAVE6_DEPS,
    );
    // The attack itself: 1 ATK; the response: 1 more to the attacked minion, 1 to the villain.
    expect(inst(after, mine).damage).toBe(2);
    expect(inst(after, villain(after)).damage).toBe(1);
    expect(inst(after, theirs).damage).toBe(0);
  });

  it("32092.wolfsbane-constant: Wolfsbane's attacks gain piercing (the tough status is discarded and the damage is dealt)", () => {
    const { state, ally, minions } = stage("32092", [P1]);
    const target = minions[0]!;
    const toughMinion = patchInstance(state, target, { statuses: { ...inst(state, target).statuses, tough: 1 } });
    const after = finish(
      run(toughMinion, { type: "basicAttack", playerId: P1, attackerInstanceId: ally, targetInstanceId: target }),
    );
    // Piercing discards the tough status before the damage is dealt (RRG 1.8 "Piercing", p. 32).
    expect(inst(after, target).damage).toBe(2);
    expect(inst(after, target).statuses.tough).toBe(0);
    // The control: a hero's basic attack (no piercing) has its damage prevented by the same tough status.
    const control = finish(
      run(toughMinion, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(toughMinion),
        targetInstanceId: target,
      }),
    );
    expect(inst(control, target).damage).toBe(0);
    expect(inst(control, target).statuses.tough).toBe(0);
  });
});

/** The next villain phase of a one-player game with `top` stacked on the encounter deck (the first is the villain's boost card). */
const villainPhase = (state: GameState, top: readonly string[], pick: Picker = firstLegal) =>
  driveEventsPicking(WAVE6_DEPS, stackEncounterDeck(state, ...top), pick, { type: "endTurn", playerId: P1 });
const FILLER = ["01186", "32100"] as const;
const exhaustedIdentity = (events: readonly GameEvent[], state: GameState) =>
  events.some((e) => e.type === "cardExhausted" && e.instanceId === identityOf(state));
const bare = (state: GameState, id: InstanceId) =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 0 } });

describe("Sentinel Mark IV (32093)", () => {
  it("32093.boost: as a boost card it is put into play engaged with the player the activation is against", () => {
    const state = wideawakeGame();
    const { state: after } = villainPhase(state, ["32093", "32100"]);
    const minions = inPlay(after, "32093");
    expect(minions).toHaveLength(1);
    expect(inst(after, minions[0]!).engagedWith).toBe(P1);
    expect(playerOf(after, P1).playArea).toContain(minions[0]);
  });
});

describe("Gauntlet Beam (32094)", () => {
  const panther = () =>
    run(wideawakeGame({ players: [{ starterDeckId: CORE_HERO_FOR_ASPECT.protection }] }), toHero(P1));
  const toughHero = (state: GameState) =>
    patchInstance(bare(state, villain(state)), identityOf(state), {
      statuses: { ...inst(state, identityOf(state)).statuses, tough: 1 },
    });

  it("32094.gauntlet-beam-constant: the villain's attacks gain piercing (tough is discarded, damage dealt) and ranged (no retaliate), and it has +1 ATK", () => {
    const base = toughHero(panther());
    // Control: Black Panther's tough status prevents the attack and his retaliate 1 hits the villain.
    const control = villainPhase(base, FILLER).state;
    expect(inst(control, identityOf(control)).damage).toBe(0);
    expect(inst(control, identityOf(control)).statuses.tough).toBe(0);
    expect(inst(control, villain(control)).damage).toBe(1);
    // With the beam: ATK 2 + 1, tough discarded first, and ranged ignores the retaliate.
    const { state: armed } = attachToHost(base, "32094", villain(base));
    const after = villainPhase(armed, FILLER).state;
    expect(inst(after, identityOf(after)).damage).toBe(3);
    expect(inst(after, identityOf(after)).statuses.tough).toBe(0);
    expect(inst(after, villain(after)).damage).toBe(0);
  });

  it("32094.gauntlet-beam-action: Hero Action, spend [physical][physical][physical] -> discard this card", () => {
    const { state: armed, id: beam } = attachToHost(panther(), "32094", villain(panther()));
    const { state: stocked, ids } = handWith(armed, P1, "physical", 3);
    const after = finish(
      run(
        stocked,
        use(
          P1,
          beam,
          "32094.gauntlet-beam-action",
          ids.map((fromHand) => ({ fromHand })),
        ),
      ),
    );
    expect(inst(after, villain(after)).attachments).not.toContain(beam);
    expect(deckOf(after).discard).toContain(beam);
    for (const id of ids) expect(playerOf(after, P1).discard).toContain(id);
  });

  it("32094.boost: as a boost card it exhausts the identity of the player it is against", () => {
    const base = run(wideawakeGame(), toHero(P1));
    expect(exhaustedIdentity(villainPhase(base, FILLER).events, base)).toBe(false);
    expect(exhaustedIdentity(villainPhase(base, ["32094", "32100"]).events, base)).toBe(true);
  });
});

describe("Learning A.I. (32095)", () => {
  const hero = () => bare(run(wideawakeGame(), toHero(P1)), villain(wideawakeGame()));

  it("32095.learning-ai-constant: the villain gains retaliate 1 (and +1 SCH)", () => {
    const base = run(wideawakeGame(), toHero(P1));
    const v = villain(base);
    expect(keywordTotal(base, v, "retaliate", WAVE6_DEPS)).toBe(0);
    const { state: armed } = attachToHost(base, "32095", v);
    expect(keywordTotal(armed, v, "retaliate", WAVE6_DEPS)).toBe(1);
    expect(characterProfile(armed, v, WAVE6_DEPS)!.sch).toBe(characterProfile(base, v, WAVE6_DEPS)!.sch + 1);
    // And it bites: a basic attack takes 1 retaliate damage.
    const attacked = (state: GameState) =>
      finish(
        run(bare(state, v), {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: identityOf(state),
          targetInstanceId: v,
        }),
      );
    expect(inst(attacked(armed), identityOf(armed)).damage).toBe(1);
    expect(inst(attacked(base), identityOf(base)).damage).toBe(0);
  });

  it("32095.learning-ai-action: Hero Action, spend [mental][mental][mental] -> discard this card", () => {
    const base = hero();
    const { state: armed, id: card } = attachToHost(base, "32095", villain(base));
    const { state: stocked, ids } = handWith(armed, P1, "mental", 3);
    const after = finish(
      run(
        stocked,
        use(
          P1,
          card,
          "32095.learning-ai-action",
          ids.map((fromHand) => ({ fromHand })),
        ),
      ),
    );
    expect(inst(after, villain(after)).attachments).not.toContain(card);
    expect(deckOf(after).discard).toContain(card);
  });

  it("32095.boost: as a boost card it is attached to the villain", () => {
    const base = run(wideawakeGame(), toHero(P1));
    const { state: after } = villainPhase(base, ["32095", "32100"]);
    const attached = inst(after, villain(after)).attachments.filter((i) => after.instances[i]!.cardId === "32095");
    expect(attached).toHaveLength(1);
    expect(inst(after, attached[0]!).attachedTo).toBe(villain(after));
  });
});

describe("Adaptive Armor (32096)", () => {
  it("32096.adaptive-armor-constant: the villain gets +8 hit points", () => {
    const base = run(wideawakeGame(), toHero(P1));
    const v = villain(base);
    const { state: armed } = attachToHost(base, "32096", v);
    expect(characterProfile(armed, v, WAVE6_DEPS)!.maxHp).toBe(characterProfile(base, v, WAVE6_DEPS)!.maxHp + 8);
  });

  it("32096.adaptive-armor-action: Hero Action, spend [energy][energy][energy] -> discard this card", () => {
    const base = run(wideawakeGame(), toHero(P1));
    const { state: armed, id: card } = attachToHost(base, "32096", villain(base));
    const { state: stocked, ids } = handWith(armed, P1, "energy", 3);
    const after = finish(
      run(
        stocked,
        use(
          P1,
          card,
          "32096.adaptive-armor-action",
          ids.map((fromHand) => ({ fromHand })),
        ),
      ),
    );
    expect(inst(after, villain(after)).attachments).not.toContain(card);
    expect(deckOf(after).discard).toContain(card);
  });

  it("32096.boost: as a boost card it is attached to the villain", () => {
    const base = run(wideawakeGame(), toHero(P1));
    const { state: after } = villainPhase(base, ["32096", "32100"]);
    const attached = inst(after, villain(after)).attachments.filter((i) => after.instances[i]!.cardId === "32096");
    expect(attached).toHaveLength(1);
  });
});

describe("Self-Repair (32097)", () => {
  /**
   * The villain phase with the villain's statuses and damage set at the moment its attack is declared, after its own
   * activation has checked for stun (a stunned villain would lose the status there) and before the reveal step.
   */
  const phaseWith = (top: readonly string[], statuses: { stunned: number; confused: number; tough: number }) => {
    const base = run(wideawakeGame(), toHero(P1));
    const v = villain(base);
    let patched = false;
    const staged = run(stackEncounterDeck(base, ...top), { type: "endTurn", playerId: P1 });
    return driveStepwise(WAVE6_DEPS, staged, firstLegal, (state) => {
      if (patched || state.pendingChoice?.prompt.kind !== "declareDefender") return state;
      patched = true;
      return patchInstance(state, v, { damage: 10, statuses });
    }).state;
  };

  it("32097.when-revealed: discards each status card from the villain, gives it a tough status card and heals 5 damage from it", () => {
    const marked = { stunned: 1, confused: 1, tough: 0 };
    const control = phaseWith(FILLER, marked);
    expect(inst(control, villain(control)).statuses).toEqual(marked);
    expect(inst(control, villain(control)).damage).toBe(10);
    const after = phaseWith(["01186", "32097"], marked);
    expect(inst(after, villain(after)).statuses).toEqual({ stunned: 0, confused: 0, tough: 1 });
    expect(inst(after, villain(after)).damage).toBe(5);
  });

  it("32097.when-revealed: a villain that already has a tough status card still ends with exactly one", () => {
    const after = phaseWith(["01186", "32097"], { stunned: 0, confused: 1, tough: 1 });
    expect(inst(after, villain(after)).statuses).toEqual({ stunned: 0, confused: 0, tough: 1 });
  });

  it("32097.boost: as a boost card it gives the villain a tough status card", () => {
    const base = bare(run(wideawakeGame(), toHero(P1)), villain(wideawakeGame()));
    expect(inst(base, villain(base)).statuses.tough).toBe(0);
    const { state: after } = villainPhase(base, ["32097", "32100"]);
    expect(inst(after, villain(after)).statuses.tough).toBe(1);
  });
});

describe("Mutant Detected (32098)", () => {
  const chooseOption =
    (option: "0" | "1"): Picker =>
    (state) =>
      state.pendingChoice?.prompt.kind === "chooseOption" ? [option] : firstLegal(state);
  const attacks = (events: readonly GameEvent[], enemy: InstanceId) =>
    events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === enemy);

  it("32098.when-revealed: choosing the first bullet places the top card of your deck facedown under Operation Zero Tolerance", () => {
    // Hero form: the villain attacks rather than schemes, so Night of the Sentinels' own threshold is not reached.
    const base = run(wideawakeGame(), toHero(P1));
    const top = playerOf(base, P1).deck[0]!;
    const { state: after, events } = villainPhase(base, ["01186", "32098"], chooseOption("0"));
    expect(inst(after, inPlay(after, "32104")[0]!).tucked).toEqual([top]);
    expect(inst(after, top).faceup).toBe(false);
    // Only its own activation attack: the second bullet's attacks did not happen.
    expect(attacks(events, villain(after))).toHaveLength(1);
  });

  it("32098.when-revealed: choosing the second bullet has the villain and each minion engaged with you attack you, in alter-ego form too, and nothing is tucked by it", () => {
    // Two players: the minion engaged with the other player does not attack. Both seats are in alter-ego form.
    let base = wideawakeGame({ players: TWO });
    const mine = engageMinion(base, "32093", P1);
    base = mine.state;
    const theirs = engageMinion(base, "32093", P2);
    base = theirs.state;
    // The villain activates against each player (two boost cards), then each player is dealt a card: P1 reveals Mutant Detected.
    const staged = stackEncounterDeck(base, "01186", "01186", "32098", "32100");
    const { state: after, events } = driveEventsPicking(
      WAVE6_DEPS,
      staged,
      chooseOption("1"),
      {
        type: "endTurn",
        playerId: P1,
      },
      { type: "endTurn", playerId: P2 },
    );
    expect(attacks(events, villain(after))).toHaveLength(1);
    expect(attacks(events, mine.id)).toHaveLength(1);
    expect(attacks(events, theirs.id)).toHaveLength(0);
    expect(attacks(events, villain(after))[0]).toMatchObject({ targetInstanceId: identityOf(after, P1) });
    // The one card under Operation Zero Tolerance is Night of the Sentinels' own (the schemes put 10 threat on it).
    expect(inst(after, inPlay(after, "32104")[0]!).tucked).toHaveLength(1);
  });
});

describe("Warn the Others (32099)", () => {
  // `32099` carries no encounter set in the card data, so no game builds it into the encounter deck (reported); the
  // two copies are added here to test the printed abilities.
  const withObligation = () => wideawakeGame({ extraEncounterCards: ["32099", "32099"] });

  it("32099.warn-the-others-forced-response: after your turn ends, it is placed facedown under Operation Zero Tolerance", () => {
    const base = run(withObligation(), toHero(P1));
    const { state: revealed } = villainPhase(base, ["01186", "32099"]);
    const obligation = inPlay(revealed, "32099")[0]!;
    expect(playerOf(revealed, P1).playArea).toContain(obligation);
    expect(inst(revealed, inPlay(revealed, "32104")[0]!).tucked).not.toContain(obligation);
    const after = endRound(revealed);
    // First under the scheme: it goes there when the turn ends, before the villain phase's own threat can tuck anything.
    expect(inst(after, inPlay(after, "32104")[0]!).tucked[0]).toBe(obligation);
    expect(inst(after, obligation).faceup).toBe(false);
    expect(cardsInPlay(after)).not.toContain(obligation);
  });

  it("32099.warn-the-others-action: Alter-Ego Action, exhaust your identity -> discard this card", () => {
    const { state: revealed } = villainPhase(withObligation(), ["01186", "32099"]);
    const obligation = inPlay(revealed, "32099")[0]!;
    const after = finish(run(revealed, use(P1, obligation, "32099.warn-the-others-action")));
    expect(inst(after, identityOf(after)).exhausted).toBe(true);
    expect(cardsInPlay(after)).not.toContain(obligation);
    expect(deckOf(after).discard).toContain(obligation);
    expect(inst(after, inPlay(after, "32104")[0]!).tucked).not.toContain(obligation);
  });
});

describe("Operation Zero Tolerance (32104)", () => {
  const ozt = (state: GameState) => inPlay(state, "32104")[0]!;
  /** Answers the defender prompt with `ally` and every other choice like `firstLegal` (or `accepting` the named abilities). */
  const defendingWith =
    (ally: InstanceId, ...accept: readonly string[]): Picker =>
    (state) =>
      state.pendingChoice?.prompt.kind === "declareDefender" ? [ally] : accepting(...accept)(state);
  /** Black Panther in hero form with `code`'s Captive ally one hit from defeat, and the villain's attack the only one coming. */
  const stage = (damage: number) => {
    const hero = run(wideawakeGame({ players: [{ starterDeckId: CORE_HERO_FOR_ASPECT.protection }] }), toHero(P1));
    const put = putSetAsideAllyInPlay(hero, "32090", P1);
    return { state: patchInstance(put.state, put.id, { damage }), ally: put.id };
  };

  it("32104.operation-zero-tolerance-forced-response: after an enemy attacks and defeats an ally, it is placed facedown under this scheme", () => {
    const { state, ally } = stage(2);
    const { state: after } = driveEventsPicking(WAVE6_DEPS, state, defendingWith(ally), {
      type: "endTurn",
      playerId: P1,
    });
    expect(inst(after, ozt(after)).tucked).toEqual([ally]);
    expect(inst(after, ally).faceup).toBe(false);
    expect(cardsInPlay(after)).not.toContain(ally);
    expect(deckOf(after).discard).not.toContain(ally);
  });

  it("32104.operation-zero-tolerance-forced-response: an ally that survives the attack is not placed under it", () => {
    const { state, ally } = stage(0);
    const { state: after } = driveEventsPicking(WAVE6_DEPS, state, defendingWith(ally), {
      type: "endTurn",
      playerId: P1,
    });
    expect(inst(after, ally).damage).toBeGreaterThan(0);
    expect(cardsInPlay(after)).toContain(ally);
    expect(inst(after, ozt(after)).tucked).toEqual([]);
  });

  it("FAQ Operation Zero Tolerance (#104), RRG 1.8 p. 63: an ally that is not discarded after being defeated (Regroup returns it to hand) still goes under it", () => {
    const regroup = buildCrossHeroDeck(WAVE6_CARDS, CORE_HERO_FOR_ASPECT.leadership, "19032");
    const hero = run(wideawakeGame({ players: [regroup] }), toHero(P1));
    const { state: withRegroup } = playFromHand(hero, "19032", 1);
    const { state: withAlly, id: ally } = playFromHand(withRegroup, "01011", 3); // Spider-Woman, hp 2
    expect(cardsInPlay(withAlly)).toContain(ally);
    const hurt = patchInstance(withAlly, ally, { damage: 1 });
    const regrouping: Picker = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseTriggers") {
        const hit = choice.options.find((o) => o.optionId.endsWith(":19032.regroup-interrupt"));
        if (hit) return [hit.optionId];
      }
      return defendingWith(ally)(state);
    };
    const { state: after } = driveEventsPicking(WAVE6_DEPS, hurt, regrouping, { type: "endTurn", playerId: P1 });
    // First under it: whatever else the villain phase's reveal step tucks (Mutant Detected) comes after.
    expect(inst(after, ozt(after)).tucked[0]).toBe(ally);
    expect(playerOf(after, P1).hand).not.toContain(ally);
    expect(playerOf(after, P1).discard).not.toContain(ally);
  });

  it("ruling Jan 26, 2026 (4) #5: no special interaction with a facedown Drone, a Drone minion that defeats an ally puts it under it", () => {
    const hero = run(
      wideawakeGame({ players: [{ starterDeckId: CORE_HERO_FOR_ASPECT.protection }], extraEncounterCards: ["01140"] }),
      toHero(P1),
    );
    // The Ultron Drones environment gives a Drone minion its ATK 1 / SCH 1 / HP 1.
    const withEnvironment = encounterCardInVillainArea(hero, "01140").state;
    const topCard = playerOf(withEnvironment, P1).deck[0]!;
    const drone = patchInstance(
      {
        ...withEnvironment,
        players: withEnvironment.players.map((p) =>
          p.playerId === P1
            ? { ...p, deck: p.deck.filter((i) => i !== topCard), playArea: [...p.playArea, topCard] }
            : p,
        ),
      },
      topCard,
      { faceup: false, controllerId: null, engagedWith: P1, facedownAs: AS_DRONE },
    );
    const put = putSetAsideAllyInPlay(drone, "32090", P1);
    // The villain is stunned so only the Drone attacks; the ally is one hit from defeat.
    const staged = patchInstance(patchInstance(put.state, put.id, { damage: 2 }), villain(put.state), {
      statuses: { ...inst(put.state, villain(put.state)).statuses, stunned: 1 },
    });
    const { state: after, events } = driveEventsPicking(WAVE6_DEPS, staged, defendingWith(put.id), {
      type: "endTurn",
      playerId: P1,
    });
    expect(events.some((e) => e.type === "attackResolved" && e.enemyInstanceId === topCard)).toBe(true);
    expect(inst(after, ozt(after)).tucked[0]).toBe(put.id);
  });

  it("32104.operation-zero-tolerance-constant: the players lose at 3 more facedown cards than players (4 with one player)", () => {
    const hero = wideawakeGame();
    const target = ozt(hero);
    const deck = playerOf(hero, P1).deck;
    const three = tuckBySurgery(hero, target, deck.slice(0, 3));
    expect(finish(run(three, toHero(P1))).outcome).toBeNull();
    const four = tuckBySurgery(hero, target, deck.slice(0, 4));
    expect(finish(run(four, toHero(P1))).outcome).toMatchObject({ result: "loss" });
  });

  it("32104.operation-zero-tolerance-constant: with 2 players the number is 5", () => {
    const base = wideawakeGame({ players: TWO });
    const target = ozt(base);
    const deck = playerOf(base, P1).deck;
    const four = tuckBySurgery(base, target, deck.slice(0, 4));
    expect(finish(run(four, toHero(P1))).outcome).toBeNull();
    const five = tuckBySurgery(base, target, deck.slice(0, 5));
    expect(finish(run(five, toHero(P1))).outcome).toMatchObject({ result: "loss" });
  });
});

describe("refs the engine already covers", () => {
  it.each([
    [
      "32098.mutant-detected-constant",
      "the data splits Mutant Detected's two bullets into constants; the choice is 32098.when-revealed",
    ],
    ["32098.mutant-detected-constant-2", "the second bullet, as above"],
    [
      "32099.obligation",
      "the whole-text catch-all every obligation carries; its two abilities are the forced response and the action",
    ],
  ])("%s prints no rule of its own (%s)", (id) => {
    expect(WAVE6_DEPS.abilities[id]).toEqual({ trigger: { kind: "constant" }, effects: [] });
  });
});
