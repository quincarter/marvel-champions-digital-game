/**
 * The Galaxy's Most Wanted, Balanced (issue #609, Balanced house rule, Gideon's Gaming): every change driven through the
 * real campaign runner and a real game built from the composed log, the way the client builds one, with the hidden
 * flags seeded at campaign start. Every assertion has a Normal-run twin that shows the printed behavior unchanged.
 */
import { describe, expect, it } from "vitest";
import { WAVE3_CARDS } from "@mc/content";
import { activeEncounterDeck, createCampaignLog, type GameState, type InstanceId } from "@mc/engine";
import {
  firstLegal,
  inst,
  instancesOf,
  P1,
  P2,
  P3,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
} from "../testing/harness.js";
import { defeatWithAttack } from "../testing/staging.js";
import { playFromHand, runWave3, WAVE3_DEPS } from "../wave3/testing.js";
import { GMW_CAMPAIGN_DEFINITION } from "./gmw.js";
import {
  BALANCED_MODS_FIELD,
  GMW_BALANCED_FIELD,
  GMW_BALANCED_TOGGLES,
  gmwBalancedHiddenFields,
} from "./gmw-balanced.js";
import { GMW_ABILITIES } from "../wave3/gmw/index.js";
import { buildGame, logAt, modesOf, seats, type BuiltGame, type RunChoice } from "./gmw-balanced-testing.js";

const NORMAL: RunChoice = { balanced: false };
const BALANCED: RunChoice = { balanced: true };
const withToggles = (...toggles: NonNullable<RunChoice["toggles"]>): RunChoice => ({ balanced: true, toggles });

const MUSEUM = "infiltrate-the-museum";
const NEBULA = "nebula";
const RONAN = "ronan-the-accuser";
const COLLECTION = "The Collection";

const collection = (state: GameState): readonly InstanceId[] => state.scenarioAreas?.[COLLECTION] ?? [];
const cardIdOf = (state: GameState, id: InstanceId): string => state.instances[id]!.cardId as string;
const deckCards = (state: GameState): readonly string[] =>
  activeEncounterDeck(state).deck.map((id) => cardIdOf(state, id));
const countOf = (cards: readonly string[], code: string): number => cards.filter((c) => c === code).length;
const heroForm = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
});
const museum = (choice: RunChoice, seatCount = 1, script = []): BuiltGame =>
  buildGame(logAt(MUSEUM, choice, seatCount), choice, seatCount, script);

// ---------------------------------------------------------------------------------------------------------------
// The log fields and the helper the client calls
// ---------------------------------------------------------------------------------------------------------------

describe("the Balanced log fields and gmwBalancedHiddenFields", () => {
  const FLAG = { kind: "flag", value: true };

  it("off: no hidden value at all, and the log is byte for byte the one a run without the helper makes", () => {
    expect(gmwBalancedHiddenFields({ enabled: false })).toEqual({});
    expect(gmwBalancedHiddenFields({ enabled: false, toggles: ["spacePirates"] })).toEqual({});
    const plain = createCampaignLog(GMW_CAMPAIGN_DEFINITION, {
      id: "x",
      seats: seats(2),
      modes: modesOf(NORMAL),
      poolVersion: "t",
      seed: 1,
    });
    expect(plain.hidden).toEqual({});
    expect(logAt(RONAN, NORMAL, 2).hidden).toEqual({});
    expect(JSON.stringify(logAt(RONAN, NORMAL, 2).seats)).toBe(JSON.stringify(plain.seats));
  });

  it("on: the balanced flag, plus exactly the toggles asked for", () => {
    expect(gmwBalancedHiddenFields({ enabled: true })).toEqual({ balanced: FLAG });
    expect(gmwBalancedHiddenFields({ enabled: true, toggles: ["spacePirates", "milanoExhausted"] })).toEqual({
      balanced: FLAG,
      balancedSpacePirates: FLAG,
      balancedMilanoExhausted: FLAG,
    });
    expect(GMW_BALANCED_TOGGLES.map((toggle) => toggle.field)).toEqual([
      "balancedSpacePirates",
      "balancedExpertGallery",
      "balancedTrimStandard",
      "balancedMilanoExhausted",
      "balancedKreeSupremacy",
    ]);
    expect(GMW_BALANCED_FIELD).toBe("balanced");
  });

  it("declares every field hidden and shared, with balancedMods a card list", () => {
    const fields = GMW_CAMPAIGN_DEFINITION.logFields.filter(
      (field) => field.id === "balanced" || field.id.startsWith("balanced"),
    );
    expect(fields.map((field) => field.id).sort()).toEqual(
      [
        "balanced",
        "balancedExpertGallery",
        "balancedKreeSupremacy",
        "balancedMilanoExhausted",
        "balancedMods",
        "balancedSpacePirates",
        "balancedTrimStandard",
      ].sort(),
    );
    for (const field of fields) {
      expect(field.hidden, field.id).toBe(true);
      expect(field.scope, field.id).toBe("shared");
    }
    expect(fields.find((field) => field.id === BALANCED_MODS_FIELD)?.type).toEqual({ kind: "cardList" });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 1. Infiltrate the Museum: Collector's redirect catches player cards only
// ---------------------------------------------------------------------------------------------------------------

/** Reveal `code` from the encounter deck, past the villain's own boost draw: stack a filler ahead of it. */
const reveal = (state: GameState, code: string): GameState =>
  settle(
    runWave3(stackEncounterDeck(state, "01186", code), { type: "endTurn", playerId: P1 }),
    firstLegal,
    undefined,
    WAVE3_DEPS,
  );

const atVillainStage = (state: GameState, stageIndex: number): GameState => {
  const id = state.villains[0]!.instanceId;
  return patchInstance(
    { ...state, villains: state.villains.map((v) => (v.instanceId === id ? { ...v, stageIndex } : v)) },
    id,
    { damage: 0 },
  );
};

/** An encounter minion in play, defeated by the hero: where does it go, and what happened to the main scheme's threat? */
function minionDefeatedAt(choice: RunChoice, stageIndex: number) {
  const { state } = museum(choice);
  const staged = stageIndex === 0 ? state : atVillainStage(state, stageIndex);
  const revealed = reveal(staged, "16135");
  const ghost = instancesOf(revealed, "16135").find((id) => inst(revealed, id).engagedWith === P1)!;
  const ready = heroForm(revealed);
  const threatBefore = inst(ready, ready.mainScheme.instanceId).threat;
  const defeated = defeatWithAttack(WAVE3_DEPS, ready, ghost, P1);
  return {
    ghost,
    inCollection: collection(defeated).includes(ghost),
    inEncounterDiscard: activeEncounterDeck(defeated).discard.includes(ghost),
    threatPlaced: inst(defeated, defeated.mainScheme.instanceId).threat - threatBefore,
  };
}

/** A hero's ally dies to the villain's attack. `threatPlaced` is against a control where nobody dies. */
function allyDefeatedAt(choice: RunChoice, stageIndex: number) {
  const { state } = museum(choice);
  const staged = stageIndex === 0 ? state : atVillainStage(state, stageIndex);
  const { state: played, id } = playFromHand(staged, "16012", 2);
  const run = (damage: number, defend: boolean) => {
    const ready = heroForm(patchInstance(played, id, { damage }));
    const pick = (st: GameState): readonly string[] => {
      const c = st.pendingChoice;
      if (!c) return [];
      if (c.prompt.kind === "declareDefender") return [defend ? String(id) : "decline"];
      return c.options.slice(0, c.minSelections).map((o) => o.optionId);
    };
    const before = inst(ready, ready.mainScheme.instanceId).threat;
    const after = settle(runWave3(ready, { type: "endTurn", playerId: P1 }), pick, undefined, WAVE3_DEPS);
    return { after, threat: inst(after, after.mainScheme.instanceId).threat - before };
  };
  const died = run(2, true);
  const control = run(0, false);
  return {
    inCollection: collection(died.after).includes(id),
    inDiscard: playerOf(died.after, P1).discard.includes(id),
    extraThreat: died.threat - control.threat,
  };
}

describe("1. Collector's Forced Interrupt catches player cards only (Balanced)", () => {
  it("Normal (printed): an encounter minion that would be discarded goes faceup into The Collection", () => {
    const result = minionDefeatedAt(NORMAL, 0);
    expect(result.inCollection).toBe(true);
    expect(result.inEncounterDiscard).toBe(false);
  });

  it("Balanced: an encounter minion is discarded normally, Collector I", () => {
    const result = minionDefeatedAt(BALANCED, 0);
    expect(result.inCollection).toBe(false);
    expect(result.inEncounterDiscard).toBe(true);
    expect(result.threatPlaced).toBe(0);
  });

  it("Balanced: Collector II keeps the same text", () => {
    const result = minionDefeatedAt(BALANCED, 1);
    expect(result).toMatchObject({ inCollection: false, inEncounterDiscard: true });
  });

  it("Collector III, Normal: the redirected encounter card places 1 threat on the main scheme", () => {
    const result = minionDefeatedAt(NORMAL, 2);
    expect(result.inCollection).toBe(true);
    expect(result.threatPlaced).toBe(1);
  });

  it("Collector III, Balanced: an encounter card places no threat", () => {
    const result = minionDefeatedAt(BALANCED, 2);
    expect(result.inCollection).toBe(false);
    expect(result.inEncounterDiscard).toBe(true);
    expect(result.threatPlaced).toBe(0);
  });

  it.each([NORMAL, BALANCED])("a player ally is still caught, Collector I (balanced=$balanced)", (choice) => {
    const result = allyDefeatedAt(choice, 0);
    expect(result.inCollection).toBe(true);
    expect(result.inDiscard).toBe(false);
  });

  it.each([NORMAL, BALANCED])(
    "Collector III still places 1 threat for a player ally (balanced=$balanced)",
    (choice) => {
      const result = allyDefeatedAt(choice, 2);
      expect(result.inCollection).toBe(true);
      expect(result.extraThreat).toBe(1);
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// 7-9. Infiltrate the Museum toggles
// ---------------------------------------------------------------------------------------------------------------

const pool = (id: string) => WAVE3_CARDS.find((card) => card.id === id);
const setCopies = (setId: string): number =>
  WAVE3_CARDS.filter((card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId))
    .map((card) => card.quantityInSet)
    .reduce((a, b) => a + b, 0);
const PIRATES = ["16138", "16139", "16140", "16141"];

describe("1b. Collector's Balanced redirect also catches player side schemes, as the printed one does", () => {
  it("the Balanced rules cover them, with Collector III's threat; no player side scheme is in the GMW pool to play", () => {
    for (const [id, threat] of [
      ["16070", undefined],
      ["16071", undefined],
      ["16072", 1],
    ] as const) {
      const trigger = GMW_ABILITIES[`${id}.collector-forced-interrupt`]!.trigger as { rules?: readonly any[] };
      const rules = trigger.rules ?? [];
      const side = rules.find((r: any) => r.kind === "discardFromPlayDestination" && r.cards.playerSideScheme === true);
      expect(side, id).toMatchObject({
        cards: { categories: ["sideScheme"] },
        ...(threat ? { thenPlaceThreat: threat } : {}),
      });
    }
  });
});

describe("7. Space Pirates toggle", () => {
  const piratesIn = (state: GameState) => deckCards(state).filter((code) => PIRATES.includes(code)).length;

  it("off, with and without Balanced: no Space Pirates in Infiltrate the Museum's deck", () => {
    expect(piratesIn(museum(NORMAL).state)).toBe(0);
    expect(piratesIn(museum(BALANCED).state)).toBe(0);
  });

  it("on: every Space Pirates card is shuffled in on top of the printed modular", () => {
    const base = deckCards(museum(BALANCED).state).length;
    const withPirates = museum(withToggles("spacePirates")).state;
    expect(piratesIn(withPirates)).toBe(setCopies("space_pirates"));
    expect(setCopies("space_pirates")).toBeGreaterThan(0);
    expect(deckCards(withPirates).length).toBe(base + setCopies("space_pirates"));
  });

  it("the toggle does nothing without Balanced (the helper never writes it)", () => {
    expect(gmwBalancedHiddenFields({ enabled: false, toggles: ["spacePirates"] })).toEqual({});
  });

  /** Pirate Lackey engaged to the hero attacks and damages; where does the top card of the deck go? */
  function lackeyAttacks(nodeId: string, choice: RunChoice, code = "16139") {
    const { state } = buildGame(logAt(nodeId, choice, 1), choice, 1);
    const deckId = Object.keys(state.encounterDecks)[0]!;
    // The Lackey is in the deck when the toggle (or Nebula's printed modular) put it there.
    const pile = state.encounterDecks[deckId]!;
    const id = pile.deck.find((i) => cardIdOf(state, i) === code);
    if (!id) throw new Error(`no pirate ${code} in ${nodeId}'s deck`);
    const engaged: GameState = {
      ...heroForm(state),
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard },
      },
      players: state.players.map((p) => ({
        ...p,
        identity: { ...p.identity, form: "hero" as const },
        playArea: [...p.playArea, id],
      })),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, engagedWith: P1, controllerId: null },
      },
    };
    const handBefore = playerOf(engaged, P1).hand;
    const after = settle(runWave3(engaged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE3_DEPS);
    // Lackey: the top card of the deck. Commander: a random card of the hand, the one that is now out of its zones.
    const topBefore =
      code === "16139"
        ? playerOf(engaged, P1).deck[0]!
        : handBefore.find((c) => collection(after).includes(c) || after.removedFromGame.includes(c))!;
    return {
      // Nebula's node names the toggle too, so the Collection check (not a missing field) is what keeps the printed text.
      flagVisible: state.campaign?.log.shared.balancedSpacePirates !== undefined,
      topBefore,
      inCollection: collection(after).includes(topBefore),
      removed: after.removedFromGame.includes(topBefore),
      faceup: inst(after, topBefore).faceup,
    };
  }

  it("Museum, on: the card Pirate Lackey would remove goes faceup into The Collection instead", () => {
    const result = lackeyAttacks(MUSEUM, withToggles("spacePirates"));
    expect(result.flagVisible).toBe(true);
    expect(result.inCollection).toBe(true);
    expect(result.removed).toBe(false);
    expect(result.faceup).toBe(true);
  });

  it("Nebula, on: the scenario has no Collection and keeps the printed removal from the game", () => {
    const result = lackeyAttacks(NEBULA, withToggles("spacePirates"));
    expect(result.flagVisible).toBe(true);
    expect(result.removed).toBe(true);
    expect(result.inCollection).toBe(false);
  });

  it("Pirate Commander (16138): a random hand card goes into The Collection at the Museum, and out of the game at Nebula", () => {
    const museumRun = lackeyAttacks(MUSEUM, withToggles("spacePirates"), "16138");
    expect(museumRun.inCollection).toBe(true);
    expect(museumRun.removed).toBe(false);
    const nebulaOn = lackeyAttacks(NEBULA, withToggles("spacePirates"), "16138");
    expect(nebulaOn.removed).toBe(true);
    expect(nebulaOn.inCollection).toBe(false);
    expect(lackeyAttacks(NEBULA, NORMAL, "16138").removed).toBe(true);
  });

  it("Nebula, Normal: the printed removal from the game", () => {
    const result = lackeyAttacks(NEBULA, NORMAL);
    expect(result.removed).toBe(true);
  });
});

describe("8. Expert Gallery of Splendor toggle", () => {
  const GALLERY_EXPERT = "16179b";
  const inDeck = (state: GameState) => countOf(deckCards(state), GALLERY_EXPERT);
  const instancesOfGallery = (state: GameState) => instancesOf(state, GALLERY_EXPERT);

  it("3 players, standard mode, on: the expert face is shuffled into the encounter deck", () => {
    const { state } = museum(withToggles("expertGallery"), 3);
    expect(inDeck(state)).toBe(1);
  });

  it("2 players, or Balanced without the toggle, or Normal with 3 players: not in the deck", () => {
    expect(inDeck(museum(withToggles("expertGallery"), 2).state)).toBe(0);
    expect(inDeck(museum(BALANCED, 3).state)).toBe(0);
    expect(inDeck(museum(NORMAL, 3).state)).toBe(0);
  });

  it("expert mode, on: a no-op, the face is the revealed side scheme and nothing is shuffled in", () => {
    const choice: RunChoice = { balanced: true, toggles: ["expertGallery"], expert: true };
    const { state } = museum(choice, 3);
    expect(inDeck(state)).toBe(0);
    const [face] = instancesOfGallery(state);
    expect(instancesOfGallery(state)).toHaveLength(1);
    expect(state.villainArea).toContain(face);
  });

  it("the modeOnly handling neither refuses nor flips it: it reveals as itself in standard mode", () => {
    const { state } = museum(withToggles("expertGallery"), 3);
    const [face] = instancesOfGallery(state);
    expect(state.instances[face!]!.flipped).toBeFalsy();
    // Put it on top and let the villain phase reveal it: the card enters the villain area, faceup, not flipped.
    const revealed = settle(
      // Three players: each one's turn ends the player phase, then three activations draw a boost card each, and the
      // fourth card is the first player's facedown encounter card.
      runWave3(
        stackEncounterDeck(state, "01186", "01187", "01190", GALLERY_EXPERT),
        { type: "endTurn", playerId: P1 },
        { type: "endTurn", playerId: P2 },
        { type: "endTurn", playerId: P3 },
      ),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(revealed.villainArea).toContain(face);
    expect(inst(revealed, face!).faceup).toBe(true);
    expect(inst(revealed, face!).flipped).toBeFalsy();
  });
});

describe("9. Trim the Standard set toggle", () => {
  const TRIMMED = ["01186", "01187", "01188", "01189"];
  const standardCopies = TRIMMED.map((code) => pool(code)!.quantityInSet).reduce((a, b) => a + b, 0);

  it("off: the whole Standard set is in the deck", () => {
    const deck = deckCards(museum(BALANCED).state);
    for (const code of [...TRIMMED, "01190"]) expect(countOf(deck, code), code).toBe(pool(code)!.quantityInSet);
  });

  it("on: Advance, Assault, Caught Off Guard and Gang-Up are gone, Shadow of the Past stays", () => {
    const before = deckCards(museum(BALANCED).state);
    const state = museum(withToggles("trimStandard")).state;
    const deck = deckCards(state);
    for (const code of TRIMMED) expect(countOf(deck, code), code).toBe(0);
    expect(countOf(deck, "01190")).toBe(1);
    expect(standardCopies).toBe(6);
    expect(deck.length).toBe(before.length - standardCopies);
    // The Museum set's own Caught Off Guard (16079) is a different printed card and stays.
    expect(countOf(deck, "16079")).toBe(countOf(before, "16079"));
    expect(countOf(deck, "16079")).toBeGreaterThan(0);
    expect(state.removedFromGame.map((id) => cardIdOf(state, id)).sort()).toEqual(
      TRIMMED.flatMap((code) => Array.from({ length: pool(code)!.quantityInSet }, () => code)).sort(),
    );
  });

  it("on, expert mode: the Expert set is left in the deck", () => {
    const expertTrimmed = museum({ balanced: true, toggles: ["trimStandard"], expert: true }).state;
    const expertPlain = museum({ balanced: true, expert: true }).state;
    expect(deckCards(expertTrimmed).length).toBe(deckCards(expertPlain).length - standardCopies);
    for (const code of ["01191", "01192", "01193"]) {
      expect(countOf(deckCards(expertTrimmed), code), code).toBe(countOf(deckCards(expertPlain), code));
    }
  });
});
