/**
 * docs/phase7-wave6.md §3.24 (verification, "exists (verify)"): the Future Past deck across the MC32 campaign. Synthetic
 * cards (Future Past treacheries `fp-a` .. `fp-e` in the `future_past` encounter set) and the synthetic campaign
 * fixture; nothing here names a published card.
 *
 * Setup per §3.24: compose Future Past set aside (`composeEncounterSets { into: "setAside" }` ->
 * `GameSetupConfig.setAside`); move the recorded titles into the encounter deck (shuffle); build the "Future Past"
 * scenario deck from the rest; each campaign side scheme's "Shuffle the top card of the Future Past deck into the
 * encounter deck" moves the deck's top card; removals go through `removeFromCampaign`.
 *
 * Sources: RRG 1.8 "Set Aside" (p. 39), "Campaign Play" removal rules (p. 29), the Red Skull rulebook p. 5 (a scenario
 * deck's cards are encounter cards once in play); ruling June 2, 2026 (3) answers 3-4 (recorded titles can repeat).
 */

import { cardId, encounterSetId, flat, type CardId, type ScenarioSeparateDeck } from "@mc/content";
import { describe, expect, it } from "vitest";
import { DEFAULT_DEPS } from "./abilities.js";
import type { CampaignLogView, ResolvedInstruction } from "./campaign.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { syntheticCampaignInput, syntheticInstruction } from "./testing/campaign.js";
import { runCommands } from "./testing/drive.js";
import { stubMainScheme, stubTreachery } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, seatIdentities, VILLAIN } from "./testing/scenario.js";

const SET = "future_past";
const FUTURE_PAST = "Future Past";
const fp = (letter: string) => stubTreachery({ id: `fp-${letter}`, encounterSetIds: [SET], boostIcons: 0 });
const FP = ["a", "b", "c", "d", "e"].map(fp);
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const SCHEME = stubMainScheme({
  id: "fp-scheme",
  stages: [
    {
      startingThreat: flat(0),
      targetThreat: flat(99),
      acceleration: flat(0),
    },
  ],
});

const DECK: ScenarioSeparateDeck = {
  name: FUTURE_PAST,
  contents: { encounterSetIds: [encounterSetId(SET)] },
  discardPile: "encounter",
  whenEmpty: "remainsEmpty",
};

/** Titles the campaign log recorded for this game (MC32 "Future Past" log entries): fp-b and fp-c. */
const LOG: CampaignLogView = {
  shared: { recorded: { kind: "cardList", cardIds: [cardId("fp-b"), cardId("fp-c")] } },
  perSeat: [{ seatNumber: 1, fields: {} }],
};

const recordedInto = (to: "encounterDeckShuffle"): EffectSpec => ({
  kind: "moveCards",
  cards: { kind: "campaignLog", field: "recorded" },
  to,
});
const buildDeck: EffectSpec = { kind: "buildScenarioDeck", name: FUTURE_PAST };
const topIntoEncounterDeck: EffectSpec = {
  kind: "moveCards",
  cards: { kind: "scenarioDeck", name: FUTURE_PAST, top: { kind: "const", value: 1 } },
  to: "encounterDeckShuffle",
};

function play(options: {
  readonly instructions: readonly ResolvedInstruction[];
  readonly setAside?: readonly CardId[];
  readonly encounterDeck?: readonly CardId[];
}): GameState {
  const identities = seatIdentities(HERO, 1);
  const config: GameSetupConfig = {
    seed: 77,
    cards: [...DEFAULT_CARDS, ...identities, ...FP, FILLER, SCHEME],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: SCHEME.id,
    encounterDeck: options.encounterDeck ?? [],
    ...(options.setAside ? { setAside: options.setAside } : {}),
    scenarioDecks: [DECK],
    includeIdentitySets: false,
    players: identities.map((identity) => ({ identityCardId: identity.id, deck: DEFAULT_DECK })),
    campaign: syntheticCampaignInput({
      log: LOG,
      seats: [
        {
          seatNumber: 1,
          identityCardId: identities[0]!.id,
          deck: [],
          aspects: [],
          grantedCardIds: [],
        },
      ],
      instructions: options.instructions,
    }),
  };
  const created = createGame(config, DEFAULT_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return runCommands(created.state, DEFAULT_DEPS).state;
}

const titles = (state: GameState, ids: readonly string[]): readonly string[] =>
  ids.map((id) => state.instances[id as keyof typeof state.instances]!.cardId as string).sort();
const encounterTitles = (state: GameState): readonly string[] =>
  titles(
    state,
    Object.values(state.encounterDecks).flatMap((piles) => piles.deck),
  );
const setAsideTitles = (state: GameState): readonly string[] => titles(state, state.encounterSetAside);
const futurePastTitles = (state: GameState): readonly string[] =>
  titles(state, state.scenarioDecks[FUTURE_PAST]?.deck ?? []);

describe("§3.24 the Future Past deck across the campaign", () => {
  it("the campaignLog selector finds a recorded title among SET-ASIDE cards and moves it into the encounter deck", () => {
    const state = play({
      setAside: FP.map((card) => card.id),
      instructions: [syntheticInstruction("fp.recorded", "afterScenarioSetup", [recordedInto("encounterDeckShuffle")])],
    });
    expect(encounterTitles(state)).toEqual(["fp-b", "fp-c"]);
    expect(setAsideTitles(state)).toEqual(["fp-a", "fp-d", "fp-e"]);
  });

  // §3.24 "Verify that buildScenarioDeck runs from a campaign in-game instruction over set-aside cards."
  // GAP: `buildScenarioDeck` (resolve/cards.ts) scans only `encounterDecks[*].deck`; the composed set sits in
  // `GameState.encounterSetAside`, so only the recorded titles already shuffled into the encounter deck are gathered
  // (fp-b, fp-c: the wrong cards) and the set-aside fp-a, fp-d, fp-e never reach the deck.
  it.fails("buildScenarioDeck over the set-aside Future Past cards builds the deck from the rest (§3.24 gap)", () => {
    const state = play({
      setAside: FP.map((card) => card.id),
      instructions: [
        syntheticInstruction("fp.recorded", "afterScenarioSetup", [recordedInto("encounterDeckShuffle")]),
        syntheticInstruction("fp.build", "afterScenarioSetup", [buildDeck]),
      ],
    });
    expect(futurePastTitles(state)).toEqual(["fp-a", "fp-d", "fp-e"]);
    expect(setAsideTitles(state)).toEqual([]);
    expect(encounterTitles(state)).toEqual(["fp-b", "fp-c"]);
  });

  it("the deck can be built from cards in the encounter deck, and the recorded titles are not in it once moved out", () => {
    // The path that exists today: the composed cards are in the encounter deck when the build runs.
    const state = play({
      encounterDeck: [...FP.map((card) => card.id), FILLER.id],
      instructions: [syntheticInstruction("fp.build", "afterScenarioSetup", [buildDeck])],
    });
    expect(futurePastTitles(state)).toEqual(["fp-a", "fp-b", "fp-c", "fp-d", "fp-e"]);
    expect(encounterTitles(state)).toEqual(["filler"]);
  });

  it("'Shuffle the top card of the Future Past deck into the encounter deck' moves exactly the deck's top card", () => {
    const built = play({
      encounterDeck: [...FP.map((card) => card.id), FILLER.id],
      instructions: [syntheticInstruction("fp.build", "afterScenarioSetup", [buildDeck])],
    });
    const top = built.scenarioDecks[FUTURE_PAST]!.deck[0]!;
    const moved = play({
      encounterDeck: [...FP.map((card) => card.id), FILLER.id],
      instructions: [
        syntheticInstruction("fp.build", "afterScenarioSetup", [buildDeck]),
        syntheticInstruction("fp.top", "afterScenarioSetup", [topIntoEncounterDeck]),
      ],
    });
    // Same seed, so the same shuffled deck: the top card is the one that left it.
    expect(moved.scenarioDecks[FUTURE_PAST]!.deck).toEqual(built.scenarioDecks[FUTURE_PAST]!.deck.slice(1));
    expect(moved.encounterDecks[Object.keys(moved.encounterDecks)[0]!]!.deck).toContain(top);
    expect(encounterTitles(moved)).toHaveLength(2);
  });

  it("removeFromCampaign over the deck's cards records each card face for removal (RRG 1.8 p. 29)", () => {
    const state = play({
      encounterDeck: [...FP.map((card) => card.id), FILLER.id],
      instructions: [
        syntheticInstruction("fp.build", "afterScenarioSetup", [buildDeck]),
        syntheticInstruction("fp.remove", "afterScenarioSetup", [
          { kind: "removeFromCampaign", cards: { kind: "scenarioDeck", name: FUTURE_PAST } },
        ]),
      ],
    });
    const removed = (state.campaignWrites?.removedFromCampaign ?? []).map((face) => face.cardId as string).sort();
    expect(removed).toEqual(["fp-a", "fp-b", "fp-c", "fp-d", "fp-e"]);
  });
});
