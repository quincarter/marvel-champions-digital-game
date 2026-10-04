import {
  cardsInPlay,
  characterProfile,
  createGame,
  replay,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { FUTURE_PAST_ABILITIES } from "./future-past.js";
import { WAVE6_DEPS, wave6Scenario } from "../index.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  P1,
  P2,
  patchInstance,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { playToOutcome } from "../../testing/driver.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { campaignGame } from "./campaign-cards-testing.js";
import { futurePastGame, inEncounterPile } from "./future-past-testing.js";
import { engageMinion } from "./project-wideawake-testing.js";

const run = (state: GameState, ...commands: Command[]) => runWith(WAVE6_DEPS, state, ...commands);
const settled = (state: GameState) => settle(state, firstLegal, undefined, WAVE6_DEPS);
const hero = (state: GameState, player = P1) => withForm(state, { heroForm: 0 }, player);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;
const inPlayOf = (state: GameState, code: string) => cardsInPlay(state).filter((id) => codeOf(state, id) === code);
const revealed = (events: readonly GameEvent[]) => of(events, "encounterCardRevealed").map((e) => e.cardId as string);
const boostIcons = (state: GameState, code: string) =>
  (state.cardPool[code as never] as { boostIcons?: number }).boostIcons ?? 0;
/** One villain phase from the end of every player's turn: the stacked cards are drawn in order (boost card first). */
const phase = (state: GameState, ...top: string[]) =>
  driveEventsPicking(
    WAVE6_DEPS,
    stackEncounterDeck(state, ...top),
    firstLegal,
    ...state.players.map((p): Command => ({ type: "endTurn", playerId: p.playerId })),
  );
const FILLER = "01186";
const NO_BOOST = "01187";
const NIMROD = "32166";
const BASTION = "32167";
const PORTAL = "32168";
const MACHINATIONS = "32169";
const NANO = "32170";
/** Two players: the villain activates against each, so two boost cards and two Sabretooth discards precede the reveal. */
const PAD_TWO = [FILLER, NO_BOOST, "01188", "01189"];
const anywhere = (state: GameState, code: string) =>
  Object.keys(state.instances).filter((i) => codeOf(state, i as InstanceId) === code) as InstanceId[];

describe("registry", () => {
  it("registers every ability ref of the set's cards, and the set's cards are in the game from data", () => {
    expect(Object.keys(FUTURE_PAST_ABILITIES).sort()).toEqual([
      "32166.nimrod-constant",
      "32167.boost",
      "32168.when-defeated",
      "32169.when-revealed",
      "32170.nano-sentinel-tech-constant",
      "32170.when-revealed",
    ]);
    const state = futurePastGame();
    for (const code of [NIMROD, BASTION, PORTAL, MACHINATIONS, NANO])
      expect(inEncounterPile(state, code), code).toHaveLength(1);
  });
});

describe("Nimrod (32166)", () => {
  /** Hero form on P1's turn with Nimrod engaged, `damage` on him and `taken` of it counted as taken this phase. */
  const setup = (damage: number, taken?: number) => {
    const { state, id } = engageMinion(hero(futurePastGame()), NIMROD);
    return {
      id,
      state: patchInstance(state, id, { damage, ...(taken === undefined ? {} : { damageTakenThisPhase: taken }) }),
    };
  };
  const attack = (state: GameState, id: InstanceId) =>
    run(state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state),
      targetInstanceId: id,
    });
  const atk = (state: GameState) => characterProfile(state, identityOf(state), WAVE6_DEPS)!.atk;

  it("takes damage up to 3 in a phase, then the rest of an attack is capped (neither taken nor prevented)", () => {
    const { state, id } = setup(0, 2);
    expect(atk(state)).toBeGreaterThanOrEqual(2);
    const after = attack(state, id);
    expect(inst(after, id)).toMatchObject({ damage: 1, damageTakenThisPhase: 3 });
  });

  it("at the cap an attack deals nothing: no damage, no defeat at 8 of 9 hit points (no excess or overkill past the cap)", () => {
    const { state, id } = setup(8, 3);
    const after = attack(state, id);
    expect(inst(after, id).damage).toBe(8);
    expect(cardsInPlay(after)).toContain(id);
    expect(inst(after, id).home.kind).not.toBe("encounterDiscard");
  });

  it("a fresh phase starts a fresh tally: the villain phase allows 3 more", () => {
    const { state, id } = setup(0, 3);
    const after = settled(run(state, endTurn(P1)));
    expect("damageTakenThisPhase" in inst(after, id)).toBe(false);
  });
});

describe("Bastion (32167)", () => {
  it("[star] Boost: is dealt to the attacked player as a facedown encounter card, revealed in the same villain phase", () => {
    const { state, events } = phase(hero(futurePastGame()), BASTION, NO_BOOST);
    expect(of(events, "abilityResolved").map((e) => e.abilityId)).toContain("32167.boost");
    const moves = of(events, "cardMoved").filter((e) => codeOf(state, e.instanceId) === BASTION);
    expect(moves.map((e) => e.to.kind)).toEqual(["boost", "dealtEncounter", "playArea"]);
    expect(revealed(events)).toContain(BASTION);
    const [bastion] = inPlayOf(state, BASTION);
    expect(bastion).toBeDefined();
    expect(inst(state, bastion!).engagedWith).toBe(P1);
    // Toughness enters play with a tough status card.
    expect(inst(state, bastion!).statuses.tough).toBe(1);
  });

  it("revealed from the encounter deck, he is an ordinary villainous minion (the boost does not fire)", () => {
    const { state, events } = phase(hero(futurePastGame()), FILLER, FILLER, BASTION);
    expect(of(events, "abilityResolved").map((e) => e.abilityId)).not.toContain("32167.boost");
    expect(inPlayOf(state, BASTION)).toHaveLength(1);
  });
});

describe("Nimrod's Portal (32168)", () => {
  /** The Portal in play with 1 threat, defeated by a real basic thwart with the encounter deck stacked. */
  const defeat = (state: GameState, ...top: string[]) => {
    const { state: held, id } = encounterCardInVillainArea(hero(state), PORTAL, 1);
    return driveEventsPicking(WAVE6_DEPS, stackEncounterDeck(held, ...top), firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(held),
      schemeInstanceId: id,
    });
  };

  it("When Defeated: the player discards the top 2 encounter cards and takes indirect damage equal to their boost icons", () => {
    const base = futurePastGame();
    expect(boostIcons(base, NIMROD) + boostIcons(base, NANO)).toBe(5);
    const { state, events } = defeat(base, NIMROD, NANO);
    expect(
      of(events, "cardMoved")
        .filter((e) => e.to.kind === "encounterDiscard")
        .map((e) => codeOf(state, e.instanceId)),
    ).toEqual([NIMROD, NANO]);
    expect(inst(state, identityOf(state)).damage).toBe(5);
  });

  it("with no boost icons discarded, no indirect damage is taken", () => {
    const base = futurePastGame();
    expect(boostIcons(base, NO_BOOST) + boostIcons(base, FILLER)).toBe(0);
    const { state } = defeat(base, NO_BOOST, FILLER);
    expect(inst(state, identityOf(state)).damage).toBe(0);
  });

  it("each player in turn discards 2 and takes damage from their own discards", () => {
    const two = futurePastGame({
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
    });
    const { state, events } = defeat(two, NIMROD, NO_BOOST, NANO, FILLER);
    expect(
      of(events, "cardMoved")
        .filter((e) => e.to.kind === "encounterDiscard")
        .map((e) => codeOf(state, e.instanceId)),
    ).toEqual([NIMROD, NO_BOOST, NANO, FILLER]);
    expect(inst(state, identityOf(state, P1)).damage).toBe(3);
    expect(inst(state, identityOf(state, P2)).damage).toBe(2);
  });
});

describe("Bastion's Machinations (32169)", () => {
  it("When Revealed: each player places the top 9 cards of their deck facedown under it", () => {
    const two = futurePastGame({
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
    });
    const deckSize = (s: GameState, p: typeof P1) => s.players.find((pl) => pl.playerId === p)!.deck.length;
    const before = [deckSize(two, P1), deckSize(two, P2)];
    const { state } = phase(two, ...PAD_TWO, MACHINATIONS);
    const [scheme] = anywhere(state, MACHINATIONS);
    expect(state.villainArea).toContain(scheme);
    expect(scheme).toBeDefined();
    const under = inst(state, scheme!).tucked;
    expect(under).toHaveLength(18);
    expect(under.filter((i) => inst(state, i).ownerId === P1)).toHaveLength(9);
    expect(under.filter((i) => inst(state, i).ownerId === P2)).toHaveLength(9);
    expect(under.every((i) => !inst(state, i).faceup)).toBe(true);
    // Both decks are 9 shorter (the villain phase's own draws happen after the player phase).
    expect(before[0]! - deckSize(state, P1)).toBeGreaterThanOrEqual(9);
    expect(before[1]! - deckSize(state, P2)).toBeGreaterThanOrEqual(9);
  });
});

describe("Nano-Sentinel Tech (32170)", () => {
  const nemesisOf = (state: GameState) =>
    state.players[0]!.setAside.find((i) => state.cardPool[codeOf(state, i) as never]!.type === "minion");

  it("When Revealed: finds the player's nemesis minion, puts it into play engaged with them and attaches itself: +4 hit points, Sentinel trait", () => {
    const base = futurePastGame();
    const nemesis = nemesisOf(base);
    expect(nemesis).toBeDefined();
    const printed = state0hp(base, nemesis!);
    const { state } = phase(base, FILLER, FILLER, NANO);
    expect(cardsInPlay(state)).toContain(nemesis);
    expect(inst(state, nemesis!).engagedWith).toBe(P1);
    const [nano] = inPlayOf(state, NANO);
    expect(inst(state, nano!).attachedTo).toBe(nemesis);
    expect(inst(state, nemesis!).attachments).toContain(nano);
    expect(characterProfile(state, nemesis!, WAVE6_DEPS)!.maxHp).toBe(printed + 4);
    expect(WAVE6_DEPS.abilities["32170.nano-sentinel-tech-constant"]).toBeDefined();
  });

  it("with no nemesis minion to find, it attaches to nothing and is discarded", () => {
    const base = futurePastGame();
    const nemesis = nemesisOf(base)!;
    const without = {
      ...base,
      players: base.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== nemesis) })),
    };
    const { state } = phase(without, FILLER, FILLER, NANO);
    expect(inPlayOf(state, NANO)).toEqual([]);
    expect(cardsInPlay(state)).not.toContain(nemesis);
  });
});

function state0hp(state: GameState, id: InstanceId): number {
  return characterProfile(state, id, WAVE6_DEPS)?.maxHp ?? 0;
}

describe("in a campaign game, shuffled in from the Future Past deck by a 171-175 When Defeated", () => {
  const FUTURE_PAST = [NIMROD, BASTION, PORTAL, MACHINATIONS, NANO];
  const defeatPolice = (state: GameState) => {
    const police = inPlayOf(state, "32171a")[0]!;
    const near = patchInstance(settled(run(state, toHero(P1))), police, { threat: 1 });
    return settled(
      run(near, { type: "basicThwart", playerId: P1, thwarterInstanceId: identityOf(near), schemeInstanceId: police }),
    );
  };

  it("the deck holds exactly this set, and Frightened Police moves its top card into the encounter deck", () => {
    const start = campaignGame(0);
    const deck = start.scenarioDecks["Future Past"]!.deck;
    expect(deck.map((i) => codeOf(start, i)).sort()).toEqual([...FUTURE_PAST].sort());
    const top = deck[0]!;
    const after = defeatPolice(start);
    expect(after.scenarioDecks["Future Past"]!.deck).not.toContain(top);
    const inDeck = Object.values(after.encounterDecks).flatMap((pile) => pile.deck);
    expect(inDeck).toContain(top);
  });

  it("the shuffled-in card works as printed when revealed: Bastion's Machinations tucks 9 cards from each deck", () => {
    const start = campaignGame(0);
    const target = start.scenarioDecks["Future Past"]!.deck.find((i) => codeOf(start, i) === MACHINATIONS)!;
    const reordered: GameState = {
      ...start,
      scenarioDecks: {
        ...start.scenarioDecks,
        "Future Past": {
          ...start.scenarioDecks["Future Past"]!,
          deck: [target, ...start.scenarioDecks["Future Past"]!.deck.filter((i) => i !== target)],
        },
      },
    };
    const after = defeatPolice(reordered);
    const deckId = Object.keys(after.encounterDecks).find((d) => after.encounterDecks[d]!.deck.includes(target))!;
    const pile = after.encounterDecks[deckId]!;
    const others = pile.deck.filter((i) => i !== target);
    // Bring it to the top (behind a boost filler) and let the villain phase reveal it.
    const pads = others.slice(0, 4);
    const staged: GameState = {
      ...after,
      encounterDecks: {
        ...after.encounterDecks,
        [deckId]: { ...pile, deck: [...pads, target, ...others.slice(4)] },
      },
    };
    const { state } = driveEventsPicking(
      WAVE6_DEPS,
      staged,
      firstLegal,
      ...staged.players.map((p): Command => ({ type: "endTurn", playerId: p.playerId })),
    );
    expect(state.villainArea).toContain(target);
    expect(inst(state, target).tucked).toHaveLength(9 * state.players.length);
  });
});

describe("as a plain modular set in a standalone game", () => {
  it("plays a Sabretooth game with Future Past to an outcome and replays deep-equal (standard, Core hero)", () => {
    const config = wave6Scenario("sabretooth", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 2026,
      difficulty: "standard",
      modularSetIds: ["future_past"],
    });
    const created = createGame(config, WAVE6_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    for (const code of [NIMROD, BASTION, PORTAL, MACHINATIONS, NANO])
      expect(inEncounterPile(created.state, code), code).toHaveLength(1);
    const result = playToOutcome(created.state, WAVE6_DEPS);
    expect(result.outcome).not.toBeNull();
    const replayed = replay(result.session.log, WAVE6_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
