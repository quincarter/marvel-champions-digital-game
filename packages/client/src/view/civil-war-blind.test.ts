/**
 * Playing a Civil War scenario blind (docs/phase7-wave10-client.md 2.6, task C9): what each screen prints before stage 2
 * is reached, after it, and after a set's first card turns up. A real Iron Man game built by `wave10Scenario` (the wave is
 * not in the client pool yet, so the cards package's data is passed in).
 */
import { WAVE10_DEPS, playableScenarioOffer, randomCivilWarScenario, wave10Scenario } from "@mc/cards";
import { WAVE10_CARDS, WAVE10_ENCOUNTER_SETS, type EncounterSet } from "@mc/content";
import { createGame, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import type { SessionConfig } from "../engine/host.js";
import {
  HIDDEN_SET_NAME,
  HIDDEN_STAGE_NAME,
  HIDDEN_STAGE_TEXT,
  blindRevealOf,
  blindSheetLines,
  eventsForBlindLog,
  maskSetRows,
} from "./civil-war-blind.js";
import { encounterDeckPreviewOf } from "./encounter-preview.js";
import { cardInspectModel } from "./inspect-model.js";
import { pauseStatusOf } from "./pause-model.js";

const LEADER = "registration-iron-man";
const offer = playableScenarioOffer(LEADER);
const STAGES = offer.mainSchemeStages!.recommended;
const SETS = offer.modularSets!.filter((s) => s.recommended).map((s) => s.id);
const stageName = (id: string): string =>
  offer.mainSchemeStages!.stages.flatMap((r) => r.options).find((o) => o.printedCardId === id)!.name;
const names = { stage: stageName, set: (id: string) => offer.modularSets!.find((s) => s.id === id)!.name };
const SET_RECORDS = [
  ...WAVE10_ENCOUNTER_SETS,
  ...offer.modularSets!.map((s) => ({ id: s.id, name: s.name }) as unknown as EncounterSet),
];

const config = (blind: boolean): SessionConfig =>
  ({
    scenarioId: LEADER,
    difficulty: "standard",
    modularSetIds: SETS,
    mainSchemeStageIds: STAGES,
    players: [],
    seed: 1,
    ...(blind ? { blind: true } : {}),
  }) as unknown as SessionConfig;

const setup = () =>
  wave10Scenario(LEADER, {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: SETS,
    mainSchemeStageIds: STAGES,
  });

let game: GameState;
beforeAll(() => {
  const created = createGame(setup(), WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  game = created.state;
}, 120_000);

/** The game with its first card of `setId` moved from the encounter deck to the discard pile, as a reveal leaves it. */
function revealOneOf(state: GameState, setId: string): GameState {
  const deckId = state.encounterDeckOrder[0]!;
  const pile = state.encounterDecks[deckId]!;
  const hit = pile.deck.find((id) => {
    const card = state.cardPool[state.instances[id]!.cardId as string];
    return card && "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId);
  });
  if (!hit) throw new Error(`no ${setId} card in the deck`);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((id) => id !== hit), discard: [...pile.discard, hit as InstanceId] },
    },
  };
}

/** The game with its main scheme advanced to its second stage. */
function atStage2(state: GameState): GameState {
  const order = state.mainScheme.stageOrder!;
  return { ...state, mainScheme: { ...state.mainScheme, stageIndex: order[1]! } };
}

describe("when a game was not started blind", () => {
  test("nothing is hidden and nothing is added", () => {
    expect(blindRevealOf(config(false), game)).toBeNull();
    expect(blindRevealOf(null, null)).toBeNull();
    expect(pauseStatusOf(game, game.players[0]!.playerId, config(false), [], names).blindSheet).toBeUndefined();
  });
});

describe("the Pause sheet of a blind game", () => {
  const sheet = (state: GameState) =>
    pauseStatusOf(state, state.players[0]!.playerId, config(true), [], names).blindSheet;
  const real = SETS.map((id) => names.set(id));

  test("before stage 2 and before any set turns up", () => {
    expect(sheet(game)).toEqual([`Stage 1: ${stageName(STAGES[0]!)}`, "Stage 2: hidden", "Modular sets: 4 hidden"]);
  });

  test("a set is named once a card of it has been revealed, and the others stay counted", () => {
    expect(sheet(revealOneOf(game, SETS[1]!))).toEqual([
      `Stage 1: ${stageName(STAGES[0]!)}`,
      "Stage 2: hidden",
      `Modular sets: ${real[1]}, 3 hidden`,
    ]);
  });

  test("stage 2 is named once the main scheme has advanced to it", () => {
    expect(sheet(atStage2(game))).toEqual([
      `Stage 1: ${stageName(STAGES[0]!)}`,
      `Stage 2: ${stageName(STAGES[1]!)}`,
      "Modular sets: 4 hidden",
    ]);
  });

  test("all four revealed reads like an open game", () => {
    let state = atStage2(game);
    for (const id of SETS) state = revealOneOf(state, id);
    expect(sheet(state)).toEqual([
      `Stage 1: ${stageName(STAGES[0]!)}`,
      `Stage 2: ${stageName(STAGES[1]!)}`,
      `Modular sets: ${real.join(", ")}`,
    ]);
  });

  test("without a game yet (Table setup) everything is hidden", () => {
    const reveal = blindRevealOf(config(true), null)!;
    expect(blindSheetLines(reveal, names, null)).toEqual(["Stage 2: hidden", "Modular sets: 4 hidden"]);
  });
});

describe("the encounter deck preview of a blind game", () => {
  const preview = (reveal: ReturnType<typeof blindRevealOf>) =>
    encounterDeckPreviewOf(setup(), WAVE10_CARDS, SET_RECORDS, reveal);
  const rows = (p: ReturnType<typeof preview>) => p.decks[0]!.bySet.filter((r) => SETS.includes(r.setId));

  test("an open game names every set", () => {
    expect(
      rows(preview(null))
        .map((r) => r.setName)
        .sort(),
    ).toEqual(SETS.map(names.set).sort());
  });

  test("a blind game hides the names, keeps the counts, and names a set that turned up", () => {
    const open = rows(preview(null));
    const before = rows(preview(blindRevealOf(config(true), game)));
    expect(before.map((r) => r.setName)).toEqual(open.map(() => HIDDEN_SET_NAME));
    expect(before.map((r) => r.cardCount)).toEqual(open.map((r) => r.cardCount));
    const after = rows(preview(blindRevealOf(config(true), revealOneOf(game, SETS[0]!))));
    expect(after.find((r) => r.setId === SETS[0])!.setName).toBe(names.set(SETS[0]!));
    expect(after.filter((r) => r.setId !== SETS[0]).every((r) => r.setName === HIDDEN_SET_NAME)).toBe(true);
  });

  test("maskSetRows leaves rows that are not modular sets alone", () => {
    const reveal = blindRevealOf(config(true), game);
    expect(maskSetRows([{ setId: "elsewhere", setName: "Standard", cardCount: 5 }], reveal)).toEqual([
      { setId: "elsewhere", setName: "Standard", cardCount: 5 },
    ]);
  });
});

describe("Inspect on the main scheme card", () => {
  const card = WAVE10_CARDS.find((c) => c.type === "main_scheme" && c.stages.some((s) => s.stageNumber === 2))!;
  const stage2Index = card.type === "main_scheme" ? card.stages.findIndex((s) => s.stageNumber === 2) : -1;
  const face = (stageIndex: number) => ({ kind: "mainSchemeStage" as const, stageIndex, side: "A" as const });

  test("stage 2 is masked until the game reaches it; stage 1 never is", () => {
    const before = blindRevealOf(config(true), game);
    const masked = cardInspectModel(card, face(stage2Index), before);
    expect(masked.name).toBe(HIDDEN_STAGE_NAME);
    expect(masked.rulesText).toBe(HIDDEN_STAGE_TEXT);
    expect(masked.art).toBeNull();
    expect(cardInspectModel(card, face(0), before)).toEqual(cardInspectModel(card, face(0)));
    const after = blindRevealOf(config(true), atStage2(game));
    expect(cardInspectModel(card, face(stage2Index), after)).toEqual(cardInspectModel(card, face(stage2Index)));
    expect(cardInspectModel(card, face(stage2Index), null)).toEqual(cardInspectModel(card, face(stage2Index)));
  });
});

describe("a game started from a random blind pick", () => {
  test("its config's picks drive the same masking", () => {
    const r = randomCivilWarScenario(4);
    const reveal = blindRevealOf(
      { blind: true, modularSetIds: r.modularSetIds, mainSchemeStageIds: r.mainSchemeStageIds },
      null,
    )!;
    expect(reveal.stage2Reached).toBe(false);
    expect(reveal.stage2Id).toBe(r.mainSchemeStageIds[1]);
    expect(reveal.modularSetIds).toEqual(r.modularSetIds);
    expect(reveal.revealedSetIds.size).toBe(0);
  });
});

describe("the log of a blind game", () => {
  const chosen = { type: "mainSchemeStagesChosen", schemeInstanceId: "s", order: [0, 1] } as unknown as GameEvent;
  const other = { type: "roundStarted", round: 1 } as unknown as GameEvent;
  const reveal = (stage2Reached: boolean) => ({
    stage2Reached,
    stage2Id: "x",
    modularSetIds: [],
    revealedSetIds: new Set<string>(),
  });

  test("drops the stages-chosen line (it names stage 2) until stage 2 is reached", () => {
    expect(eventsForBlindLog([chosen, other], reveal(false))).toEqual([other]);
    expect(eventsForBlindLog([chosen, other], reveal(true))).toEqual([chosen, other]);
  });

  test("a game that is not blind keeps it", () => {
    expect(eventsForBlindLog([chosen, other], null)).toEqual([chosen, other]);
  });
});
