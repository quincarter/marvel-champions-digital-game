/**
 * The game-over story, checked against a real game played to a real loss — so
 * every sentence is tested against the events and sources the engine actually
 * produces, not a fixture that agrees with the model by construction.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { cardId } from "@mc/content";
import { activeVillain, cardOf, type GameState, type InstanceId } from "@mc/engine";
import { CARDS_BY_ID, POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { emptyRecord, type GameRecord } from "../engine/game-record.js";
import { gameOverModel, newsParts, turningPoints } from "./game-over-model.js";
import { cardName } from "./names.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 43523,
};

/** A table that only ever ends its turn loses to the scheme; that loss is the fixture. */
async function passiveLoss(): Promise<SessionStore> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  for (let step = 0; step < 1500 && !store.state.game!.outcome; step++) {
    const { legal } = store.state;
    if (!legal) break;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
      continue;
    }
    if (legal.actions.kind !== "turn") break;
    const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) break;
    await store.dispatch(end.example);
  }
  return store;
}

/** The active villain's card re-printed as a leader (the pool has no Civil War data yet). */
function asLeader(game: GameState): GameState {
  const card = cardOf(game, activeVillain(game).instanceId)!;
  return {
    ...game,
    cardPool: { ...game.cardPool, [card.id]: { ...card, printedType: "leader" } },
  } as unknown as GameState;
}

describe("game over model", () => {
  let store: SessionStore;

  beforeAll(async () => {
    store = await passiveLoss();
  }, 120_000);

  test("a lost game reads as a loss, for the reason the engine gave", () => {
    const { game, record, config } = store.state;
    expect(game!.outcome).not.toBeNull();
    const model = gameOverModel(game!, record, config, CORE_DEPS);

    expect(model.tone).toBe("loss");
    if (game!.outcome!.reason === "mainSchemeCompleted") {
      expect(model.kicker).toBe("The scheme succeeded");
      expect(model.headline).toBe("The scheme wins");
      // The final blow names the scheme and the threshold it reached.
      expect(model.finalBlow).not.toBeNull();
      expect(model.finalBlow!.title).toMatch(/hit \d+ threat$/);
    } else {
      expect(model.kicker).toBe("Every hero is defeated");
    }
  });

  // Issue #518: Change of Venue swapped Battle in the Bodega out for A Slice of the Pizza Dough, which then won; the
  // screen named the Pizza Dough with no word of the swap, so it read as the wrong scheme.
  describe("a main scheme swapped in mid-game (Protection Racket's Change of Venue)", () => {
    const BODEGA = cardId("60134a");
    const PIZZA = cardId("60138a");
    const titleOf = (id: string): string => {
      const card = CARDS_BY_ID.get(id)!;
      return (card.type === "main_scheme" ? card.stages[0]!.name : undefined) ?? card.name;
    };
    /** The fixture's loss, with the central scheme now `PIZZA`, swapped in for `BODEGA` in round 2. */
    function swappedLoss() {
      const { game, record, config } = store.state;
      const pool = { ...game!.cardPool, [BODEGA]: CARDS_BY_ID.get(BODEGA)!, [PIZZA]: CARDS_BY_ID.get(PIZZA)! };
      const central = { ...game!.mainScheme, cardId: PIZZA, stageIndex: 0, completed: true };
      const lost = {
        ...game!,
        cardPool: pool,
        mainScheme: central,
        outcome: { result: "loss", reason: "mainSchemeCompleted" } as const,
      } as unknown as GameState;
      const swapped = {
        ...record,
        schemeSwaps: [
          { outgoing: "old" as InstanceId, incoming: central.instanceId, outgoingCardId: BODEGA, round: 2 },
        ],
      } satisfies GameRecord;
      return { lost, swapped, config };
    }

    test("the loss names the scheme that won and the one it replaced", () => {
      const { lost, swapped, config } = swappedLoss();
      const model = gameOverModel(lost, swapped, config, CORE_DEPS);

      expect(model.headline).toBe("The scheme wins");
      expect(model.summary).toContain(`${titleOf(PIZZA)} reached`);
      expect(model.summary).toContain(`It replaced ${titleOf(BODEGA)} in round 2.`);
      // The desktop layout shows the final blow, not the summary.
      expect(model.finalBlow?.body).toContain(`It replaced ${titleOf(BODEGA)} in round 2.`);
    });

    test("after two swaps it names the scheme it directly replaced, in that swap's round", () => {
      const { lost, swapped, config } = swappedLoss();
      const chain = {
        ...swapped,
        schemeSwaps: [
          { outgoing: "first" as InstanceId, incoming: "old" as InstanceId, outgoingCardId: BODEGA, round: 1 },
          { ...swapped.schemeSwaps[0]!, outgoingCardId: cardId("60135a"), round: 4 },
        ],
      } satisfies GameRecord;
      const model = gameOverModel(lost, chain, config, CORE_DEPS);

      expect(model.summary).toContain(`It replaced ${titleOf("60135a")} in round 4.`);
    });

    test("a scheme swapped back in names the scheme it replaced, never itself", () => {
      const { lost, swapped, config } = swappedLoss();
      const winner = lost.mainScheme.instanceId;
      const back = {
        ...swapped,
        schemeSwaps: [
          { outgoing: winner, incoming: "other" as InstanceId, outgoingCardId: PIZZA, round: 2 },
          { outgoing: "other" as InstanceId, incoming: winner, outgoingCardId: BODEGA, round: 4 },
        ],
      } satisfies GameRecord;
      const model = gameOverModel(lost, back, config, CORE_DEPS);

      expect(model.summary).toContain(`It replaced ${titleOf(BODEGA)} in round 4.`);
      expect(model.summary).not.toContain(`It replaced ${titleOf(PIZZA)}`);
    });

    test("a scheme never swapped says nothing of a swap", () => {
      const { game, record, config } = store.state;
      const lost = { ...game!, outcome: { result: "loss", reason: "mainSchemeCompleted" } as const };
      expect(gameOverModel(lost, record, config, CORE_DEPS).summary).not.toContain("replaced");
    });

    test("with a main scheme per player, the completed one is named, not the first seat's", () => {
      const { game, record, config } = store.state;
      const other = { instanceId: "p2-scheme" as InstanceId, cardId: PIZZA, stageIndex: 0, completed: true };
      const lost = {
        ...game!,
        cardPool: { ...game!.cardPool, [PIZZA]: CARDS_BY_ID.get(PIZZA)! },
        mainScheme: { ...game!.mainScheme, completed: false },
        extraMainSchemes: [{ ...other, accelerationTokens: 0 }],
        outcome: { result: "loss", reason: "mainSchemeCompleted" } as const,
      } as unknown as GameState;
      const model = gameOverModel(lost, record, config, CORE_DEPS);

      expect(model.summary).toContain(`${titleOf(PIZZA)} reached`);
    });
  });

  test("a game lost to an empty encounter deck and discard pile says so (RRG 1.8 p. 17), not that the scheme won", () => {
    const { game, record, config } = store.state;
    const exhausted = { ...game!, outcome: { result: "loss", reason: "encounterDeckExhausted" } as const };
    const model = gameOverModel(exhausted, record, config, CORE_DEPS);

    expect(model.tone).toBe("loss");
    expect(model.kicker).toBe("The encounter deck ran dry");
    expect(model.summary).toContain("The encounter deck and its discard pile were both empty");
    expect(model.finalBlow).toBeNull();
  });

  test("a game saved before every card-caused loss named its card still reads as one, without a cause", () => {
    const { game, record, config } = store.state;
    // The engine's type no longer allows this; a stored game from before it can still hold it.
    const lost = { ...game!, outcome: { result: "loss", reason: "cardAbility" } } as unknown as GameState;
    const model = gameOverModel(lost, record, config, CORE_DEPS);

    expect(model.tone).toBe("loss");
    expect(model.kicker).toBe("A card ended the game");
    expect(model.headline).not.toBe("The scheme wins");
    expect(model.summary).toContain("A card's own text ended the game");
    expect(model.finalBlow).toBeNull();
    expect(model.cause).toBeNull();
  });

  test("a card that scripts the loss is named as the cause, not the main scheme (QA C3: MojoMania's Champion)", () => {
    const { game, record, config } = store.state;
    // Any card in play stands in for the source; the engine names the card whose `endGame` ended it.
    const source = game!.mainScheme.instanceId;
    const sourceName = cardName(game!, source);
    const lost = { ...game!, outcome: { result: "loss", reason: "cardAbility", sourceInstanceId: source } as const };
    const model = gameOverModel(lost, record, config, CORE_DEPS);

    expect(model.kicker).toBe("A card ended the game");
    expect(model.headline).not.toBe("The scheme wins");
    expect(model.summary).toContain(`${sourceName} ended the game in round`);
    expect(model.finalBlow?.title).toBe(`${sourceName} ended the game`);
    expect(model.finalBlow?.body).not.toMatch(/threat/);
    // The card itself goes in the final blow slot.
    expect(model.finalBlow?.cardInstanceId).toBe(source);
  });

  test("the enemy's stat note says villain, and leader for a leader", () => {
    const { game, record, config } = store.state;
    const name = cardName(game!, activeVillain(game!).instanceId);
    const note = (state: GameState) => gameOverModel(state, record, config, CORE_DEPS).stats[0]!.note;
    expect(note(game!)).toBe(`${record.damageToVillain} damage dealt to ${name}`);
    const lost = { ...asLeader(game!), outcome: { result: "loss", reason: "encounterDeckExhausted" } as const };
    const leader = gameOverModel(lost, record, config, CORE_DEPS);
    expect(leader.headline).toBe(`${name} wins this one`);
    expect(leader.stats[0]!.label).toBe(name);
  });

  test("a won game's summary calls the damage dealt to the villain, or to the leader", () => {
    const { game, record, config } = store.state;
    const won = (state: GameState) => ({
      ...state,
      outcome: { result: "win", reason: "allVillainsDefeated" } as const,
    });
    const summary = (state: GameState) => gameOverModel(won(state), record, config, CORE_DEPS).summary;
    expect(summary(game!)).toContain("damage dealt to the villain across the game");
    expect(summary(asLeader(game!))).toContain("damage dealt to the leader across the game");
  });

  test("a win a card's text called (the villain still standing) reads as the players winning, not a villain falling", () => {
    const { game, record, config } = store.state;
    const won = { ...game!, outcome: { result: "win", reason: "villainDefeated" } as const };
    const model = gameOverModel(won, record, config, CORE_DEPS);

    expect(model.tone).toBe("win");
    expect(model.headline).toBe("The players win");
    expect(model.headline).not.toMatch(/defeated/);
    expect(model.summary).toContain("The scenario's own text ended the game");
    expect(model.stats[0]!.value).not.toMatch(/cleared/);
  });

  test("a lost game leads its debrief with the engine's reason and drops the threat count when the scheme did not win", () => {
    const { game, record, config } = store.state;
    const exhausted = { ...game!, outcome: { result: "loss", reason: "encounterDeckExhausted" } as const };
    const model = gameOverModel(exhausted, record, config, CORE_DEPS);
    expect(model.beats[0]?.text).toBe("The encounter deck and its discard pile both ran out.");

    const rounds = [
      {
        round: 2,
        threatPlaced: 5,
        threatRemoved: 0,
        damageToVillain: 0,
        crisisBlocks: 0,
        heroesDefeated: [],
        villainStageAdvanced: false,
      },
    ];
    const withThreat = { ...emptyRecord(), rounds };
    expect(turningPoints(game!, withThreat, "loss", "Rhino", "cardAbility", "A card ended it.")).toEqual([
      { round: game!.round, text: "A card ended it." },
    ]);
    expect(turningPoints(game!, withThreat, "loss", "Rhino", "mainSchemeCompleted")).toEqual([
      { round: 2, text: "The heaviest round for threat: 5 placed, 0 removed." },
    ]);
  });

  test("a lost game lists its rounds in order and closes with the reason it ended", () => {
    const { game } = store.state;
    const round = (n: number, crisisBlocks: number) => ({
      round: n,
      threatPlaced: 0,
      threatRemoved: 0,
      damageToVillain: 0,
      crisisBlocks,
      heroesDefeated: [],
      villainStageAdvanced: false,
    });
    const record = { ...emptyRecord(), rounds: [round(1, 1), round(2, 2), round(3, 1)] };
    const late = { ...game!, round: 3 };
    const beats = turningPoints(late, record, "loss", "Rhino", "cardAbility", "A card ended it.");
    expect(beats.map((beat) => beat.round)).toEqual([1, 2, 3, 3]);
    expect(beats.at(-1)?.text).toBe("A card ended it.");
  });

  test("the meta line and stats describe this game, not a template", () => {
    const { game, record, config } = store.state;
    const model = gameOverModel(game!, record, config, CORE_DEPS);

    expect(model.meta).toBe(`Round ${game!.round} · Standard · 1 hero`);
    expect(model.stats).toHaveLength(3);
    expect(model.stats[0]!.label).toBe("Rhino");
    expect(model.stats[1]!.value).toBe(`${record.threatRemoved} total`);
    expect(model.quickStats.map((stat) => stat.label)).toEqual(["Rounds", "Dmg dealt", "Thwart"]);
    expect(model.seats).toHaveLength(1);
    expect(model.mvp).toBeNull();
  });

  test("turning points are in round order, capped, and never past the last round", () => {
    const { game, record, config } = store.state;
    const { beats } = gameOverModel(game!, record, config, CORE_DEPS);

    expect(beats.length).toBeLessThanOrEqual(4);
    expect(beats.map((beat) => beat.round)).toEqual([...beats.map((beat) => beat.round)].sort((a, b) => a - b));
    for (const beat of beats) expect(beat.round).toBeLessThanOrEqual(game!.round);
  });

  test("each turning point comes from a count the record holds, and nothing else", () => {
    const { game } = store.state;
    const record = {
      ...emptyRecord(),
      rounds: [
        {
          round: 2,
          threatPlaced: 3,
          threatRemoved: 1,
          damageToVillain: 0,
          crisisBlocks: 2,
          heroesDefeated: [],
          villainStageAdvanced: false,
        },
        {
          round: 4,
          threatPlaced: 9,
          threatRemoved: 0,
          damageToVillain: 0,
          crisisBlocks: 0,
          heroesDefeated: [],
          villainStageAdvanced: true,
        },
      ],
    };

    const loss = turningPoints(game!, record, "loss", "Rhino");
    expect(loss).toEqual([
      { round: 2, text: "Crisis blocked 2 threat removals from the main scheme." },
      { round: 4, text: "The heaviest round for threat: 9 placed, 0 removed." },
    ]);
    // A stage advance is part of how a game was won, not of how one was lost.
    expect(turningPoints(game!, record, "win", "Rhino").some((beat) => beat.text.includes("next stage"))).toBe(true);
    expect(turningPoints(game!, emptyRecord(), "loss", "Rhino")).toEqual([]);
  });

  test("a resumed game ends with the same story as one never interrupted", async () => {
    // The store kept `config` through the whole game, including across the start.
    expect(store.state.config).toEqual(RHINO_SOLO);
  });
});

/**
 * The three losses of wave 6 that a card's own text causes, each on its own scenario's real table: the screen names
 * the card, shows it, and says why in a few words taken from it. The outcome is set by hand here, in the shape the
 * engine records it (`@mc/cards`' sabretooth, project-wideawake and magog tests assert that shape on a played loss).
 */
describe("game over: a loss a card's text caused names the card and why", () => {
  const start = async (scenarioId: string): Promise<SessionStore> => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({ ...RHINO_SOLO, scenarioId, seed: 5 });
    expect(store.state.game).not.toBeNull();
    return store;
  };
  const named = (game: GameState, name: string): InstanceId =>
    Object.values(game.instances).find((instance) => cardName(game, instance.instanceId) === name)!.instanceId;
  const patch = (game: GameState, id: InstanceId, change: Partial<GameState["instances"][InstanceId]>): GameState => ({
    ...game,
    instances: { ...game.instances, [id]: { ...game.instances[id]!, ...change } },
  });
  /** No line on this screen is cut short: it wraps instead. */
  const whole = (text: string | null | undefined) => expect(text).not.toMatch(/…|\.\.\.$/);

  test("Sabretooth: Robert Kelly left play, and Stalked by Sabretooth ends the game", async () => {
    const { game, record, config } = (await start("sabretooth")).state;
    const scheme = game!.mainScheme.instanceId;
    const kelly = named(game!, "Robert Kelly");
    const lost: GameState = {
      ...game!,
      outcome: { result: "loss", reason: "cardAbility", sourceInstanceId: scheme, causeInstanceId: kelly },
    };
    const model = gameOverModel(lost, record, config, POOL_DEPS);

    expect(model.tone).toBe("loss");
    expect(model.kicker).toBe("A card ended the game");
    expect(model.headline).toBe("Sabretooth wins this one");
    expect(model.finalBlow).toEqual({
      title: "Robert Kelly left play",
      body: "Stalked by Sabretooth ends the game.",
      cardInstanceId: scheme,
    });
    expect(model.cause).toBe("Robert Kelly left play. Stalked by Sabretooth ends the game.");
    // "Where it went wrong" leads with that cause, never with a threat count that did not end this game.
    expect(model.beats[0]).toEqual({ round: lost.round, text: model.cause });
    expect(model.beats.some((beat) => /heaviest round/.test(beat.text))).toBe(false);
    expect(model.summary).toContain("Stalked by Sabretooth ended the game in round");
    whole(model.cause);

    // At stage 2 the same instance is The Injured Senator, whose own text says the same.
    const later: GameState = { ...lost, mainScheme: { ...lost.mainScheme, stageIndex: 1 } };
    expect(gameOverModel(later, record, config, POOL_DEPS).cause).toBe(
      "Robert Kelly left play. The Injured Senator ends the game.",
    );
  }, 120_000);

  test("Project Wideawake: Operation Zero Tolerance, by the facedown cards under it", async () => {
    const { game, record, config } = (await start("project-wideawake")).state;
    const ozt = named(game!, "Operation Zero Tolerance");
    // Four allies taken, as the scheme tucks them: facedown under it (3 more than the 1 player).
    const taken = game!.players[0]!.deck.slice(0, 4);
    let lost = patch(game!, ozt, { tucked: taken });
    for (const id of taken) lost = patch(lost, id, { faceup: false });
    lost = { ...lost, outcome: { result: "loss", reason: "cardAbility", sourceInstanceId: ozt } };
    const model = gameOverModel(lost, record, config, POOL_DEPS);

    expect(model.kicker).toBe("A card ended the game");
    expect(model.finalBlow).toEqual({
      title: "Operation Zero Tolerance ended the game",
      body: "4 facedown cards under it. The players lose the game.",
      cardInstanceId: ozt,
    });
    expect(model.cause).toBe("Operation Zero Tolerance: 4 facedown cards under it. The players lose the game.");
    expect(model.summary).toContain("Operation Zero Tolerance ended the game in round");
    whole(model.cause);
  }, 120_000);

  test("MaGog: The Champion, by its ratings counters", async () => {
    const { game, record, config } = (await start("magog")).state;
    const champion = named(game!, "The Champion");
    // Its ROARING CROWD side, at 10 ratings counters with one hero.
    const lost: GameState = {
      ...patch(game!, champion, { flipped: true, counters: { ratings: 10 } }),
      outcome: { result: "loss", reason: "cardAbility", sourceInstanceId: champion },
    };
    const model = gameOverModel(lost, record, config, POOL_DEPS);

    expect(model.kicker).toBe("A card ended the game");
    expect(model.headline).toBe("MaGog wins this one");
    expect(model.finalBlow).toEqual({
      title: "The Champion ended the game",
      body: "10 ratings counters on it. MaGog wins again and the players lose the game.",
      cardInstanceId: champion,
    });
    expect(model.cause).toBe(
      "The Champion: 10 ratings counters on it. MaGog wins again and the players lose the game.",
    );
    whole(model.cause);
  }, 120_000);
});

describe("newsParts", () => {
  test("lists points, unlocks and Extras news in order, and nothing when there is none", () => {
    expect(newsParts({ points: 100, unlocked: ["Wave 1", "Captain America"] }, 2)).toEqual([
      "+100 champion points",
      "Unlocked: Wave 1, Captain America",
      "2 new in Extras",
    ]);
    expect(newsParts({ points: 0, unlocked: [] }, 0)).toEqual([]);
    expect(newsParts(null, 0)).toEqual([]);
  });
});
