import {
  cardId,
  GMW_CARDS,
  GMW_STARTER_DECKS,
  WAVE3_CARDS,
  type CardId,
  type PlayModes,
  type SideSchemeCard,
} from "@mc/content";
import {
  campaignChoiceKey,
  createCampaignLog,
  createGame,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignLog,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { firstLegal, identityOf, instancesOf, inst, playerOf, settle, P1, P2 } from "../../testing/harness.js";
import { GMW_CAMPAIGN_DEFINITION } from "../../campaigns/gmw.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";
import { wave3Scenario } from "../setup.js";

/**
 * The Campaign Challenge side schemes (16178a/b–16182a/b, `gmw/campaign-challenge.ts`).
 *
 * The `*-constant` refs carry no behavior of their own (module docblock) — each face's Hinder/Victory keyword
 * values are asserted straight from `GMW_CARDS` below, one `it` per ref so every registered id is still named in a
 * test. The `When Defeated:` refs are exercised with a real card instance, put into play by adding both faces of
 * the relevant pair to a plain (non-campaign) `wave3Scenario` config's own `setAside` — `GameSetupConfig.setAside`
 * (`packages/engine/src/setup.ts`) creates real `encounterSetAside` instances for any listed `CardId` with no
 * campaign wiring required (`setup.ts` has no campaign-only gate on it), which is enough to reveal and defeat one
 * face directly without walking the whole campaign for every scenario. A single "real campaign game" test at the
 * bottom of this file separately proves `campaigns/gmw.ts`'s own reveal instructions pick the right face by mode.
 */

const cardById = new Map(GMW_CARDS.map((c) => [c.id as string, c]));
const sideScheme = (code: string): SideSchemeCard => {
  const card = cardById.get(code);
  if (!card || card.type !== "side_scheme") throw new Error(`${code} is not a side scheme`);
  return card;
};

// --- data: Hinder/Victory are keyword-driven, no behavior in the `-constant` refs ------------------------------

describe("Campaign Challenge side schemes: printed Hinder/Victory (data, no behavior)", () => {
  const cases: readonly [ref: string, code: string, hinderPerPlayer: number][] = [
    ["16178a.badoon-blitz-constant", "16178a", 3],
    ["16178b.badoon-blitz-constant", "16178b", 4],
    ["16179a.gallery-of-splendor-constant", "16179a", 3],
    ["16179b.gallery-of-splendor-constant", "16179b", 4],
    ["16180a.there-is-no-escape-constant", "16180a", 3],
    ["16180b.there-is-no-escape-constant", "16180b", 4],
    ["16181a.guerrilla-tactics-constant", "16181a", 3],
    ["16181b.guerrilla-tactics-constant", "16181b", 4],
    ["16182a.kree-supremacy-constant", "16182a", 3],
    ["16182b.kree-supremacy-constant", "16182b", 4],
  ];
  it.each(cases)("%s: %s prints Hinder %d[per_hero] and Victory 1", (_ref, code, hinderPerPlayer) => {
    const card = sideScheme(code);
    expect(card.keywords).toContainEqual({ name: "hinder", value: 0, perPlayer: hinderPerPlayer });
    expect(card.keywords).toContainEqual({ name: "victory", value: 1 });
  });
});

// --- when-defeated: one real instance per pair, surgery-placed from `encounterSetAside` ------------------------

const SEAT: readonly [{ readonly starterDeckId: string }, { readonly starterDeckId: string }] = [
  { starterDeckId: "groot-protection" },
  { starterDeckId: "rocket-raccoon-aggression" },
];

/** A plain (non-campaign) `nebula` game with both faces of `pairCodes` added to `setAside`, for `playerCount` seats. */
function gameWith(pairCodes: readonly [string, string], playerCount: 1 | 2): GameState {
  const config = wave3Scenario("nebula", {
    players: playerCount === 1 ? [SEAT[0]] : [SEAT[0], SEAT[1]],
    seed: 2026,
  });
  const withPair: GameSetupConfig = {
    ...config,
    setAside: [...config.setAside!, ...pairCodes.map((c) => cardId(c))],
  };
  return startWave3Game(withPair);
}

/** Moves an `encounterSetAside` instance of `code` straight into the villain area with a given threat — the same
 * "skip the noisy villain-phase machinery" surgery `gmw/galactic-artifacts.test.ts`'s own `putSideSchemeIntoPlay`
 * uses, pulling from `encounterSetAside` (where `GameSetupConfig.setAside` creates its instances) instead of the
 * encounter deck. */
function putSideSchemeIntoPlay(
  state: GameState,
  code: string,
  threat: number,
): { readonly state: GameState; readonly id: InstanceId } {
  const wanted = cardId(code);
  const id = state.encounterSetAside.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} set aside`);
  return {
    id,
    state: {
      ...state,
      encounterSetAside: state.encounterSetAside.filter((i) => i !== id),
      villainArea: [...state.villainArea, id],
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, threat } },
    },
  };
}

function defeat(state: GameState, playerId: typeof P1, scheme: InstanceId): GameState {
  const identity = identityOf(state, playerId);
  return settle(
    runWave3(state, { type: "basicThwart", playerId, thwarterInstanceId: identity, schemeInstanceId: scheme }),
    firstLegal,
    undefined,
    WAVE3_DEPS,
  );
}

describe("Badoon Blitz (16178a/16178b)", () => {
  it("standard (16178a.when-defeated): each player may draw 1 card", () => {
    const state = gameWith(["16178a", "16178b"], 2);
    const heroState = runWave3(state, { type: "changeForm", playerId: P1 });
    const { state: placed, id: scheme } = putSideSchemeIntoPlay(heroState, "16178a", 1);
    const before = { p1: playerOf(placed, P1).hand.length, p2: playerOf(placed, P2).hand.length };
    const after = defeat(placed, P1, scheme);
    // `firstLegal` takes the first-listed option of an optional choice (the affirmative branch, `gmw/galactic-
    // artifacts.test.ts`'s own 16127/16128/16129 pattern) — both players draw.
    expect(playerOf(after, P1).hand.length).toBe(before.p1 + 1);
    expect(playerOf(after, P2).hand.length).toBe(before.p2 + 1);
  });

  it("expert (16178b.when-defeated): each player must choose and discard 1 card from their hand", () => {
    const state = gameWith(["16178a", "16178b"], 2);
    const heroState = runWave3(state, { type: "changeForm", playerId: P1 });
    const { state: placed, id: scheme } = putSideSchemeIntoPlay(heroState, "16178b", 1);
    const before = { p1: playerOf(placed, P1).hand.length, p2: playerOf(placed, P2).hand.length };
    const after = defeat(placed, P1, scheme);
    expect(playerOf(after, P1).hand.length).toBe(before.p1 - 1);
    expect(playerOf(after, P2).hand.length).toBe(before.p2 - 1);
  });

  it("1-player game: badoon blitz's when-defeated still runs for the sole player (16178a.when-defeated)", () => {
    const state = gameWith(["16178a", "16178b"], 1);
    const heroState = runWave3(state, { type: "changeForm", playerId: P1 });
    const { state: placed, id: scheme } = putSideSchemeIntoPlay(heroState, "16178a", 1);
    const before = playerOf(placed, P1).hand.length;
    const after = defeat(placed, P1, scheme);
    expect(playerOf(after, P1).hand.length).toBe(before + 1);
  });
});

describe("Gallery of Splendor (16179a/16179b)", () => {
  it("standard (16179a.when-defeated): places the top card of each player's deck faceup into The Collection", () => {
    const state = gameWith(["16179a", "16179b"], 2);
    const heroState = runWave3(state, { type: "changeForm", playerId: P1 });
    const { state: placed, id: scheme } = putSideSchemeIntoPlay(heroState, "16179a", 1);
    const topP1 = playerOf(placed, P1).deck[0]!;
    const topP2 = playerOf(placed, P2).deck[0]!;
    const after = defeat(placed, P1, scheme);
    expect(after.scenarioAreas?.["The Collection"] ?? []).toEqual(expect.arrayContaining([topP1, topP2]));
    expect(inst(after, topP1).faceup).toBe(true);
    expect(inst(after, topP2).faceup).toBe(true);
  });

  it("expert (16179b.when-defeated): each player must place 1 random hand card faceup into The Collection", () => {
    const state = gameWith(["16179a", "16179b"], 2);
    const heroState = runWave3(state, { type: "changeForm", playerId: P1 });
    const { state: placed, id: scheme } = putSideSchemeIntoPlay(heroState, "16179b", 1);
    const before = { p1: playerOf(placed, P1).hand.length, p2: playerOf(placed, P2).hand.length };
    const after = defeat(placed, P1, scheme);
    expect(playerOf(after, P1).hand.length).toBe(before.p1 - 1);
    expect(playerOf(after, P2).hand.length).toBe(before.p2 - 1);
    expect((after.scenarioAreas?.["The Collection"] ?? []).length).toBe(2);
  });
});

describe('"There Is No Escape" (16180a/16180b)', () => {
  it("standard (16180a.when-defeated): deals 1 damage to each player", () => {
    const state = gameWith(["16180a", "16180b"], 2);
    const heroState = runWave3(state, { type: "changeForm", playerId: P1 });
    const { state: placed, id: scheme } = putSideSchemeIntoPlay(heroState, "16180a", 1);
    const ids = { p1: identityOf(placed, P1), p2: identityOf(placed, P2) };
    const before = { p1: inst(placed, ids.p1).damage, p2: inst(placed, ids.p2).damage };
    const after = defeat(placed, P1, scheme);
    expect(inst(after, ids.p1).damage).toBe(before.p1 + 1);
    expect(inst(after, ids.p2).damage).toBe(before.p2 + 1);
  });

  it("expert (16180b.when-defeated): deals 2 damage to each player", () => {
    const state = gameWith(["16180a", "16180b"], 2);
    const heroState = runWave3(state, { type: "changeForm", playerId: P1 });
    const { state: placed, id: scheme } = putSideSchemeIntoPlay(heroState, "16180b", 1);
    const ids = { p1: identityOf(placed, P1), p2: identityOf(placed, P2) };
    const before = { p1: inst(placed, ids.p1).damage, p2: inst(placed, ids.p2).damage };
    const after = defeat(placed, P1, scheme);
    expect(inst(after, ids.p1).damage).toBe(before.p1 + 2);
    expect(inst(after, ids.p2).damage).toBe(before.p2 + 2);
  });

  it("1-player game: deals 1 damage only to the sole player (16180a.when-defeated)", () => {
    const state = gameWith(["16180a", "16180b"], 1);
    const heroState = runWave3(state, { type: "changeForm", playerId: P1 });
    const { state: placed, id: scheme } = putSideSchemeIntoPlay(heroState, "16180a", 1);
    const identity = identityOf(placed, P1);
    const before = inst(placed, identity).damage;
    const after = defeat(placed, P1, scheme);
    expect(inst(after, identity).damage).toBe(before + 1);
  });
});

describe("Guerrilla Tactics (16181a/16181b)", () => {
  const evasionCounters = (state: GameState): number => {
    const [ship] = instancesOf(state, "16093");
    return ship ? (state.instances[ship]!.counters.evasion ?? 0) : 0;
  };

  it("standard (16181a.when-defeated): places 2 evasion counters on Nebula's Ship", () => {
    const state = gameWith(["16181a", "16181b"], 2);
    const heroState = runWave3(state, { type: "changeForm", playerId: P1 });
    // Villain phase step one (Nebula's Ship's own Forced Interrupt, `nebula.ts`'s 16093) can add its own evasion
    // counter, so this reads before/after around the defeat itself rather than assuming a 0 baseline.
    const { state: placed, id: scheme } = putSideSchemeIntoPlay(heroState, "16181a", 1);
    const before = evasionCounters(placed);
    const after = defeat(placed, P1, scheme);
    expect(evasionCounters(after)).toBe(before + 2);
  });

  it("expert (16181b.when-defeated): places 3 evasion counters on Nebula's Ship", () => {
    const state = gameWith(["16181a", "16181b"], 2);
    const heroState = runWave3(state, { type: "changeForm", playerId: P1 });
    const { state: placed, id: scheme } = putSideSchemeIntoPlay(heroState, "16181b", 1);
    const before = evasionCounters(placed);
    const after = defeat(placed, P1, scheme);
    expect(evasionCounters(after)).toBe(before + 3);
  });
});

describe("Kree Supremacy (16182a/16182b)", () => {
  it("standard and expert print no When Defeated: (16182a.kree-supremacy-constant, 16182b.kree-supremacy-constant)", () => {
    expect(sideScheme("16182a").abilities.map((a) => a.id as string)).toEqual(["16182a.kree-supremacy-constant"]);
    expect(sideScheme("16182b").abilities.map((a) => a.id as string)).toEqual(["16182b.kree-supremacy-constant"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A real campaign game: the right face is what's actually revealed, by mode
// ---------------------------------------------------------------------------------------------------------------

/** `campaigns/gmw.test.ts`'s own scripted-caller shape, duplicated here (not exported there) for one campaign
 * smoke test proving `campaigns/gmw.ts`'s `revealChallengeSideScheme` puts the right face of Badoon Blitz into
 * play at scenario 1's own setup, standard and expert. */
function settleCampaign<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  script: readonly CampaignChoiceAnswer[],
): T {
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 400; guard++) {
    const outcome = step(answers);
    if (outcome.kind === "done") return outcome.value;
    const found = script.find((entry) => campaignChoiceKey(entry) === campaignChoiceKey(outcome.choice));
    if (!found) {
      throw new Error(
        `no scripted answer for ${campaignChoiceKey(outcome.choice)} of [${outcome.choice.options.join(", ")}]`,
      );
    }
    answers.push(found);
  }
  throw new Error("the runner asked for more than 400 choices");
}

const CAMPAIGN_DEPS: CampaignDeps = { pool: WAVE3_CARDS };

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = GMW_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no gmw starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}
const CAMPAIGN_SEATS: readonly CampaignSeatSetup[] = [
  seatFor("groot-protection", 1),
  seatFor("rocket-raccoon-aggression", 2),
];

function cardsOfSets(setIds: readonly string[]): CardId[] {
  const out: CardId[] = [];
  for (const setId of setIds) {
    const members = WAVE3_CARDS.filter(
      (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId),
    );
    for (const card of members) for (let copy = 0; copy < card.quantityInSet; copy++) out.push(card.id);
  }
  return out;
}

/** Composes and creates scenario 1's real game from a fresh log for `modes`, returning the resulting `GameState`. */
function realGameAtScenario1(modes: PlayModes): GameState {
  const seedLog: CampaignLog = createCampaignLog(GMW_CAMPAIGN_DEFINITION, {
    id: `campaign-challenge-smoke-${modes.campaign?.expertCampaign ? "expert" : "standard"}`,
    seats: CAMPAIGN_SEATS,
    modes,
    poolVersion: "smoke-test",
    seed: 9003,
  });
  const composed = settleCampaign(
    (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, seedLog, CAMPAIGN_DEPS, modes, answers),
    [],
  );
  const start = startGameFromLog(GMW_CAMPAIGN_DEFINITION, composed);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const config: GameSetupConfig = wave3Scenario(start.scenarioId as string, {
    players: start.input.seats.map((seat) => ({
      identityCardId: seat.identityCardId,
      deck: seat.deck,
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes,
  });
  const withSetAside: GameSetupConfig = {
    ...config,
    setAside: [...config.setAside!, ...cardsOfSets(start.encounterSets.setAside)],
  };
  const created = createGame({ ...withSetAside, campaign: start.input }, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE3_DEPS);
}

/** The revealed face is in the villain area, faceup — `instancesOf` alone would also match the *other* face still
 * sitting unrevealed in `encounterSetAside` (both are composed there; only one is ever `revealCard`ed). */
const inPlay = (state: GameState, code: string): boolean =>
  instancesOf(state, code).some((id) => state.villainArea.includes(id) && state.instances[id]?.faceup);

describe("a real campaign game: the right face of Badoon Blitz is revealed", () => {
  it("standard campaign reveals 16178a, not 16178b (MC16 p. 8)", () => {
    const state = realGameAtScenario1({ campaign: { campaignId: GMW_CAMPAIGN_DEFINITION.campaignId } });
    expect(inPlay(state, "16178a")).toBe(true);
    expect(inPlay(state, "16178b")).toBe(false);
  });

  // `revealChallengeSideScheme`'s bullet reads "expert mode" (`ModePredicate.expert`, `PlayModes.expert`), a flag
  // independent of the campaign's own `expertCampaign` (`docs/campaign-mode-design.md` §12 Q1) — the client sets
  // both together, so this does too.
  it("expert campaign reveals 16178b, not 16178a (MC16 p. 8)", () => {
    const state = realGameAtScenario1({
      expert: true,
      campaign: { campaignId: GMW_CAMPAIGN_DEFINITION.campaignId, expertCampaign: true },
    });
    expect(inPlay(state, "16178b")).toBe(true);
    expect(inPlay(state, "16178a")).toBe(false);
  });
});
