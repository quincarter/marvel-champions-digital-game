/**
 * QA: FFG rulings (marvel-champions-rulings-post-rrg-1-7.md, cited by date heading) and the owner's answers
 * (docs/phase7-wave8.md section 4.1, cited by question number) that name a wave 8 card or a mechanic this cycle
 * introduced, replayed with shipped cards in real games. This file holds only what no other test of the wave proves;
 * the survey of what is proven where is in the QA hand-off. A `// FINDING` comment marks a case where the game and the
 * ruling disagree: the expected behavior is an `it.fails` and a companion test pins today's.
 */
import {
  CORE_STARTER_DECKS,
  WAVE1_STARTER_DECKS,
  WAVE2_STARTER_DECKS,
  WAVE3_STARTER_DECKS,
  WAVE4_STARTER_DECKS,
  WAVE5_STARTER_DECKS,
  WAVE6_STARTER_DECKS,
  WAVE7_STARTER_DECKS,
  WAVE8_STARTER_DECKS,
  cardId,
  encounterSetId,
  PLAYABLE_CARDS,
  type DeckContents,
} from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  createGame,
  replay,
  sessionApply,
  startSession,
  validateDeck,
  type Command,
  type GameEvent,
  type GameSetupConfig,
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
  patchInstance,
  play,
  playerOf,
  putOnTopOfDeck,
  use,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../testing/harness.js";
import { stageNemesisCardForReveal, withForm } from "../testing/staging.js";
import { playableStarterDeckSetup } from "../playable/index.js";
import {
  attachEncounter,
  conjure,
  funded,
  inPlayArea,
  payers,
  picker,
  takes,
  withMinion,
  withScheme,
  type Prompt,
} from "../wave7/rulings-2026-10-06-harness.js";
import { wave6Scenario } from "../wave6/index.js";
import { WAVE8_DEPS, wave8Scenario, wave8StarterDeckSetup } from "./index.js";

vi.setConfig({ testTimeout: 120_000 });

const DEPS = WAVE8_DEPS;

// ---------------------------------------------------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------------------------------------------------

const seat = (starterDeckId: string) => {
  try {
    return wave8StarterDeckSetup(starterDeckId);
  } catch {
    return playableStarterDeckSetup(starterDeckId);
  }
};

/** The game's card pool widened to every card of every wave, so a conjured card from any pack is a known card. */
const widened = (config: GameSetupConfig): GameSetupConfig => ({ ...config, cards: PLAYABLE_CARDS });

function started(config: GameSetupConfig, seats?: readonly string[]): GameState {
  const base = widened(seats ? { ...config, players: seats.map(seat) } : config);
  const created = createGame({ ...base, requireLegalDecks: false }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (x) => x.step.phase === "player", DEPS);
  for (const p of s.players) s = withForm(s, { heroForm: 0 }, p.playerId);
  return s;
}

/** A wave 8 scenario past setup with these starter decks seated, every seat in hero form. */
const aoaGame = (scenario: string, seats: readonly string[], seed = 1): GameState =>
  started(wave8Scenario(scenario, { players: [{ starterDeckId: "core-spider-man-justice" }], seed }), seats);

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const refusal = (s: GameState, c: Command): string => {
  const r = applyCommand(s, c, DEPS);
  return r.ok ? "accepted" : r.error.code;
};
const inPlayCodes = (s: GameState): string[] => cardsInPlay(s).map((id) => codeOf(s, id));

/** Plays a conjured copy of `code` for `cost`, resolving prompts with `pick`; the log must replay to the same state. */
function playConjured(state: GameState, code: string, cost: number, pick: Picker = firstLegal, player: PlayerId = P1) {
  const given = conjure(funded(state, cost, player), player, code);
  const paid = payers(given.state, player, cost, [given.id]);
  const command = play(player, given.id, paid);
  return { before: given.state, id: given.id, command };
}

function drive(start: GameState, pick: Picker, ...commands: readonly Command[]) {
  let session = startSession(start);
  const events: GameEvent[] = [];
  const apply = (command: Command) => {
    const result = sessionApply(session, command, DEPS);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    events.push(...result.events);
  };
  const settleAll = () => {
    for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
      if (guard > 300) throw new Error(`stuck on ${session.state.pendingChoice.prompt.kind}`);
      const choice = session.state.pendingChoice;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      });
    }
  };
  settleAll();
  for (const command of commands) {
    apply(command);
    settleAll();
  }
  const replayed = replay(session.log, DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}

const ALL_STARTER_DECKS = [
  ...CORE_STARTER_DECKS,
  ...WAVE1_STARTER_DECKS,
  ...WAVE2_STARTER_DECKS,
  ...WAVE3_STARTER_DECKS,
  ...WAVE4_STARTER_DECKS,
  ...WAVE5_STARTER_DECKS,
  ...WAVE6_STARTER_DECKS,
  ...WAVE7_STARTER_DECKS,
  ...WAVE8_STARTER_DECKS,
];
const cardCost = (code: string): number => (PLAYABLE_CARDS.find((c) => c.id === code) as { cost: number }).cost;

// ---------------------------------------------------------------------------------------------------------------------
// 1. The unique match across packs (RRG 1.8 "Unique Icon", pp. 45-46; docs/phase7-wave8.md section 3.68)
// ---------------------------------------------------------------------------------------------------------------------

describe("January 26, 2026 - Ruling 4 (7) and March 19, 2026 - Ruling 4: an ally matches a hero by the hero's alter-ego title", () => {
  // The rulings: Valkyrie hero and Valkyrie ally do not match when the ally has no subtitle and the title is not an
  // alter-ego title; the converse is the rule here: an ally titled with the hero's alter-ego title and subtitle does
  // match (docs/phase7-wave8.md section 3.68 table).
  it("Iceman (alter-ego Bobby Drake): the ally Iceman, subtitle Bobby Drake (38010), cannot be played beside him", () => {
    const s = aoaGame("unus", ["iceman-aggression"]);
    const { before, command } = playConjured(s, "38010", cardCost("38010"));
    expect(refusal(before, command)).toBe("duplicate_unique_card");
  });
  it("control: beside Spider-Man the same ally is playable", () => {
    const s = aoaGame("unus", ["core-spider-man-justice"]);
    const { before, command } = playConjured(s, "38010", cardCost("38010"));
    expect(refusal(before, command)).toBe("accepted");
  });
  it("Jubilee (alter-ego Jubilation Lee): the ally Jubilee, subtitle Jubilation Lee (35003), cannot be played beside her", () => {
    const s = aoaGame("unus", ["jubilee-justice"]);
    const { before, command } = playConjured(s, "35003", cardCost("35003"));
    expect(refusal(before, command)).toBe("duplicate_unique_card");
  });
});

describe("RRG 1.8 'Unique Icon' (pp. 45-46), docs/phase7-wave8.md section 3.68: Pyro 46025 beside the minion Pyro 32075", () => {
  it("revealed beside Pyro (32075) it is discarded, its effects are ignored, and the revealing player is dealt a facedown card", () => {
    const start = aoaGame("unus", ["iceman-aggression"]);
    const staged0 = stageNemesisCardForReveal(start, "46025", P1, 1);
    const { state: staged } = withMinion(staged0, "32075");
    const minion = cardsInPlay(staged).find((id) => codeOf(staged, id) === "32075")!;
    const run = drive(staged, firstLegal, endTurn(P1));
    expect(inPlayCodes(run.state)).not.toContain("46025");
    expect(inPlayCodes(run.state)).toContain("32075");
    const blocked = run.events.filter((e) => e.type === "uniqueEntryBlocked");
    expect(blocked).toMatchObject([{ cardId: "46025", matchedInstanceId: minion, disposition: "discarded" }]);
    // The player who revealed it reveals one more encounter card in its place.
    const reveals = run.events.filter((e) => e.type === "encounterCardRevealed" && e.playerId === P1);
    expect(reveals.length).toBeGreaterThanOrEqual(2);
    expect(reveals.map((e) => (e as { cardId: string }).cardId)[0]).toBe("46025");
  });
  it("control: with no other Pyro in play it enters play", () => {
    const start = aoaGame("unus", ["iceman-aggression"]);
    const run = drive(stageNemesisCardForReveal(start, "46025", P1, 1), firstLegal, endTurn(P1));
    expect(inPlayCodes(run.state)).toContain("46025");
  });
});

describe("January 26, 2026 - Ruling 4 (7) and March 19, 2026 - Ruling 4 (RRG 1.8 'Unique Icon', p. 45) in deckbuilding", () => {
  const starter = (id: string) => ALL_STARTER_DECKS.find((d) => d.id === id)!;
  const withCard = (deckId: string, code: string) => {
    const d = starter(deckId);
    return {
      identityCardId: d.identityCardId,
      aspects: d.aspects,
      cards: [...d.cards, { cardId: cardId(code), quantity: 1 }],
    } as DeckContents;
  };
  const uniqueMatch = (deck: DeckContents) => {
    const verdict = validateDeck(deck, PLAYABLE_CARDS);
    return verdict.ok ? [] : verdict.problems.filter((p) => p.code === "unique_match");
  };
  it("the starter decks of Iceman, Jubilee, Nightcrawler and Magneto are legal (control)", () => {
    for (const id of ["iceman-aggression", "jubilee-justice", "nightcrawler-protection", "magneto-leadership"]) {
      const d = starter(id);
      expect(
        validateDeck({ identityCardId: d.identityCardId, aspects: d.aspects, cards: d.cards }, PLAYABLE_CARDS),
      ).toEqual({
        ok: true,
      });
    }
  });
  it.each([
    ["iceman-aggression", "38010", "the ally Iceman, subtitle Bobby Drake"],
    ["jubilee-justice", "32041", "the Aggression Wolverine"],
    ["nightcrawler-protection", "32011", "the ally Nightcrawler, subtitle Kurt Wagner"],
  ])("%s with %s (%s) is refused as a unique match", (deckId, code) => {
    const problems = uniqueMatch(withCard(deckId, code));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.flatMap((p) => p.cardIds)).toContain(cardId(code));
  });
  it("a Rogue deck and a Gambit deck cannot include Nightcrawler's Rogue 48012, and Gambit's deck cannot include 48021", () => {
    expect(uniqueMatch(withCard("rogue-protection", "48012")).flatMap((p) => p.cardIds)).toContain(cardId("48012"));
    expect(uniqueMatch(withCard("gambit-justice", "48012")).flatMap((p) => p.cardIds)).toContain(cardId("48012"));
    expect(uniqueMatch(withCard("gambit-justice", "48021")).flatMap((p) => p.cardIds)).toContain(cardId("48021"));
  });
  it("a Cyclops deck cannot include Phoenix 49014 or Cyclops 49015", () => {
    expect(uniqueMatch(withCard("cyclops-leadership", "49014")).flatMap((p) => p.cardIds)).toContain(cardId("49014"));
    expect(uniqueMatch(withCard("cyclops-leadership", "49015")).flatMap((p) => p.cardIds)).toContain(cardId("49015"));
  });
});

describe("RRG 1.8 'Unique Icon' (pp. 45-46) in the game, docs/phase7-wave8.md section 3.71", () => {
  it("beside the Rogue hero (38001a) Nightcrawler's ally Rogue 48012 is refused", () => {
    const s = aoaGame("unus", ["rogue-protection"]);
    const { before, command } = playConjured(s, "48012", cardCost("48012"));
    expect(refusal(before, command)).toBe("duplicate_unique_card");
  });
  it("beside Gambit's ally Rogue 37002, another player's Rogue 48012 is refused; with 37002 gone she can be played", () => {
    const s = aoaGame("unus", ["nightcrawler-protection"]);
    const ally = inPlayArea(s, "37002", P1);
    const blocked = playConjured(ally.state, "48012", cardCost("48012"));
    expect(refusal(blocked.before, blocked.command)).toBe("duplicate_unique_card");
    const gone = playConjured(s, "48012", cardCost("48012"));
    expect(refusal(gone.before, gone.command)).toBe("accepted");
  });
  it("Fabian Cortez 49030 revealed beside the minion Fabian Cortez 32159 is discarded and a facedown card is dealt", () => {
    const start = aoaGame("unus", ["magneto-leadership"]);
    const staged = withMinion(stageNemesisCardForReveal(start, "49030", P1, 2), "32159");
    const run = drive(staged.state, firstLegal, endTurn(P1));
    expect(inPlayCodes(run.state)).not.toContain("49030");
    expect(run.events.filter((e) => e.type === "uniqueEntryBlocked")).toMatchObject([
      { cardId: "49030", matchedInstanceId: staged.id, disposition: "discarded" },
    ]);
  });
  it("White Queen 49021 (ally, subtitle Emma Frost) is playable while the minion White Queen 32056 is in play: no match", () => {
    const start = aoaGame("unus", ["magneto-leadership"]);
    const staged = withMinion(start, "32056");
    const { before, command } = playConjured(staged.state, "49021", cardCost("49021"));
    expect(refusal(before, command)).toBe("accepted");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 2. Owner's Q39 and Q45: the unique rule keeps a campaign ally out of play beside the hero it matches
// ---------------------------------------------------------------------------------------------------------------------

describe("Q39 = A (RRG 1.8 'Unique Icon' p. 45; erratum Mutants at the Mall #88A, p. 68): no ally Jubilee beside a Jubilee hero", () => {
  const mallGame = (deckId: string): GameState =>
    started(wave6Scenario("project-wideawake", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 1 }), [
      deckId,
    ]);
  const thwartMall = (s: GameState) => {
    const mall = cardsInPlay(s).find((id) => codeOf(s, id) === "32088a")!;
    const near = patchInstance(s, mall, { threat: 1 });
    return {
      mall,
      run: drive(near, firstLegal, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(near, P1),
        schemeInstanceId: mall,
      }),
    };
  };
  it("control: with Spider-Man the Mall flips into the ally Jubilee, who enters play", () => {
    const { mall, run } = thwartMall(mallGame("core-spider-man-justice"));
    expect(inst(run.state, mall).cardId).toBe("32088b");
    expect(cardsInPlay(run.state)).toContain(mall);
  });
  // FINDING: the Mall's When Defeated flips the card into the ally in place, and that flip does not run the unique
  // check that a played or revealed card goes through (`uniqueEntryBlocked`), so the ally Jubilee (32088b) enters play
  // beside the hero Jubilee. Q39 = A and the plan's test 6 (docs/phase7-wave8.md section 3.68) expect no ally.
  it.fails("EXPECTED (Q39): with Jubilee (47001a) as the hero, the Mall is defeated and the Sentinel is revealed, but no Jubilee ally enters play", () => {
    const { mall, run } = thwartMall(mallGame("jubilee-justice"));
    expect(run.state.outcome).toBeNull();
    expect(inPlayCodes(run.state)).not.toContain("32088b");
    expect(cardsInPlay(run.state)).not.toContain(mall);
  });
  it("TODAY (companion to the finding): with Jubilee as the hero the ally Jubilee 32088b still enters play, beside her", () => {
    const { mall, run } = thwartMall(mallGame("jubilee-justice"));
    expect(inst(run.state, mall).cardId).toBe("32088b");
    expect(inPlayCodes(run.state)).toEqual(expect.arrayContaining(["32088b", "47001a"]));
    expect(run.events.some((e) => e.type === "uniqueEntryBlocked")).toBe(false);
  });
});

describe("Q45 = A (RRG 1.8 'Unique Icon' p. 45): the campaign ally Magneto (32172b) never enters play beside the Magneto hero", () => {
  const masterMold = (deckId: string): GameState =>
    started(
      wave6Scenario("master-mold", {
        players: [{ starterDeckId: "core-spider-man-justice" }],
        seed: 1,
        modularSetIds: [],
      }),
      [deckId],
    );
  it("control: against Spider-Man, Master Mold's Setup puts the ally Magneto 32172b into play", () => {
    expect(inPlayCodes(masterMold("core-spider-man-justice"))).toContain("32172b");
  });
  it("with the Magneto hero (49001a) seated, Master Mold's Setup does not put the ally Magneto into play", () => {
    const s = masterMold("magneto-leadership");
    expect(inPlayCodes(s)).toContain("49001a");
    expect(inPlayCodes(s)).not.toContain("32172b");
  });
  const defeatEnemyOfMyEnemy = () => {
    const placed = withScheme(masterMold("magneto-leadership"), "32172a", 1);
    return drive(placed.state, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(placed.state, P1),
      schemeInstanceId: placed.id,
    });
  };
  // FINDING: Setup's put-into-play is stopped by the unique rule, but the When Defeated "flip this card and put Magneto
  // into play" of Enemy of My Enemy (32172a, a fixture placed by surgery: the card is campaign-only) is not.
  // Q45 = A and the plan's test 8 (docs/phase7-wave8.md section 3.71) expect no ally Magneto.
  it.fails("EXPECTED (Q45): Enemy of My Enemy (32172a) defeated beside the Magneto hero: the ally does not enter play", () => {
    expect(inPlayCodes(defeatEnemyOfMyEnemy().state)).not.toContain("32172b");
  });
  it("TODAY (companion to the finding): the ally Magneto 32172b enters play beside the Magneto hero, with no uniqueEntryBlocked event", () => {
    const run = defeatEnemyOfMyEnemy();
    expect(inPlayCodes(run.state)).toEqual(expect.arrayContaining(["32172b", "49001a"]));
    expect(run.events.some((e) => e.type === "uniqueEntryBlocked")).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 3. Environments flip, they are not revealed (docs/phase7-wave8.md section 3.6)
// ---------------------------------------------------------------------------------------------------------------------

describe("June 25, 2026 - Ruling 4 (3) and January 26, 2026 - Ruling 4 (2) (RRG 1.8 'Environment', 'Flip'): Pursued by the Past flips and is not revealed", () => {
  const standardIII = (): GameState =>
    started(
      wave8Scenario("unus", {
        players: [{ starterDeckId: "core-spider-man-justice" }],
        seed: 1,
        difficultySets: { standard: encounterSetId("standard_iii") },
      }),
    );
  it("the flip to side B (and back) raises cardFlipped but no reveal event and no 'revealing' trigger for the environment", () => {
    const g = standardIII();
    const environment = g.villainArea.find((id) => codeOf(g, id) === "45075a")!;
    const near = patchInstance(stackEncounterDeck(g, "45076", "45076"), environment, { counters: { pursuit: 3 } });
    const run = drive(near, firstLegal, endTurn(P1));
    expect(run.events.filter((e) => e.type === "cardFlipped" && e.instanceId === environment)).toHaveLength(2);
    expect(
      run.events.filter(
        (e) =>
          (e.type === "encounterCardRevealed" && e.instanceId === environment) ||
          (e.type === "triggerEvent" &&
            e.event.kind === "encounterCardRevealing" &&
            e.event.instanceId === environment),
      ),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 4. Magik and "play a card from your hand" (RRG 1.8 FAQ "Age of Apocalypse Expansion", p. 64)
// ---------------------------------------------------------------------------------------------------------------------

describe("Q27 = A (RRG 1.8 p. 64 FAQ, Magik): her top card can be played through Team-Building Exercise (12024), and both reductions apply", () => {
  const COLOSSUS = "45031";
  const TBE = "12024.team-building-exercise-action";
  const magik = () => {
    const g = aoaGame("unus", ["magik-aggression"]);
    const exercise = inPlayArea(g, "12024", P1);
    return { ...exercise, state: putOnTopOfDeck(exercise.state, P1, COLOSSUS).state };
  };
  it("Colossus (cost 3) on top of the deck is offered by the exercise and played for 3 - 1 - 1 = 1 resource", () => {
    const { state, id } = magik();
    expect(cardCost(COLOSSUS)).toBe(3);
    const asked: number[] = [];
    const prompts: Prompt[] = [];
    const run = drive(
      funded(state, 2, P1),
      picker(
        {
          chooseCards: takes(COLOSSUS),
          spendResources: (s, options) => {
            const owed = (s.pendingChoice!.prompt as unknown as { requirement: { generic: number } }).requirement
              .generic;
            asked.push(owed);
            return options.slice(0, owed);
          },
        },
        prompts,
      ),
      use(P1, id, TBE),
    );
    // The top card of the deck is among the cards the exercise offers (RRG 1.8 p. 64 FAQ, Team-Building Exercise).
    expect(prompts.find((p) => p.kind === "chooseCards")!.options.map((o) => codeOf(state, o as InstanceId))).toContain(
      COLOSSUS,
    );
    // Both reductions apply: the exercise's 1 and Magik's 1 off the printed 3.
    expect(asked).toEqual([1]);
    expect(cardsInPlay(run.state).some((c) => codeOf(run.state, c) === COLOSSUS)).toBe(true);
    expect(playerOf(run.state, P1).deck).not.toContain(playerOf(state, P1).deck[0]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 5. A target that cannot take damage (No Longer Worthy, 45105b)
// ---------------------------------------------------------------------------------------------------------------------

describe("March 19, 2026 - Ruling 2 and April 30, 2026 - Ruling 1 (RRG 1.8 'Target', 'Cannot'): Apocalypse with No Longer Worthy and a Prelate in play", () => {
  const STRENGTH = "01090";
  const apocalypse = (): { state: GameState; boss: InstanceId } => {
    const g = aoaGame("apocalypse", ["cap-leadership"]);
    const boss = g.activeVillainId!;
    expect(cardsInPlay(g).filter((id) => codeOf(g, id).startsWith("4518")).length).toBeGreaterThan(0);
    return { state: attachEncounter(g, "45105b", boss).state, boss };
  };
  it("a basic attack on him is not offered (the target rule applies to basic powers)", () => {
    const { state, boss } = apocalypse();
    expect(
      refusal(withForm(state, { heroForm: 0 }, P1), {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(state, P1),
        targetInstanceId: boss,
      }),
    ).not.toBe("accepted");
  });
  it("Heroic Strike (6 damage; stun if paid with a [physical] resource) may still target him: 0 damage, and he is stunned", () => {
    const { state, boss } = apocalypse();
    const first = conjure(state, P1, STRENGTH);
    const second = conjure(first.state, P1, STRENGTH);
    const strike = conjure(second.state, P1, "03004");
    const run = drive(strike.state, picker({ chooseTarget: takes(boss) }), play(P1, strike.id, [first.id, second.id]));
    expect(inst(run.state, boss).damage).toBe(inst(strike.state, boss).damage);
    expect(inst(run.state, boss).statuses.stunned).toBe(1);
  });
});
