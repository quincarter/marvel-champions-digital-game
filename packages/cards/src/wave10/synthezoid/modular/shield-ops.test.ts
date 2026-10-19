import { CORE_CARDS, encounterSetId } from "@mc/content";
import { activeEncounterDeckId, createGame, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import { P1, P2, endTurn, firstLegal, inst, mainThreat, settle, stackEncounterDeck } from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import {
  BLANK,
  FILLER_A,
  CAPTAIN_MARVEL,
  FILLER_B,
  SPIDER_MAN,
  codeOf,
  inDiscard,
  inPlayCard,
  revealedCodes,
  tough,
} from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS } from "../../testing.js";
import { SYNTHEZOID_MODULAR_SHIELD_OPS, SYNTHEZOID_MODULAR_SHIELD_OPS_SKIPPED } from "./shield-ops.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The S.H.I.E.L.D. Ops modular set (57013 Operator x2, 57014 Strategic Overwatch, 57015 Rapid Response, 57016 Homeland
 * Security; docs/phase7-synthezoid.md section 8.3). Tested in Core's Rhino scenario against a Core starter deck with
 * the set's cards added to the encounter deck: there "the enemy leader" is Rhino (FFG ruling July 9, 2026 R3, M13).
 */
const OPERATOR = "57013";
const OVERWATCH = "57014";
const RAPID = "57015";
const HOMELAND = "57016";
const SHOCKER = "01103"; // Core minion, ATK 2, SCH 1
const BLANK_B = "01104"; // Core treachery with no boost icons: the second boost of a two-player Rhino phase
const REFS = [
  "57013.when-revealed",
  "57014.when-revealed",
  "57014.boost",
  "57015.when-revealed",
  "57016.homeland-security-constant",
];

function game(
  alterEgo = false,
  seats: readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[] = [SPIDER_MAN],
): GameState {
  const config = coreScenario("rhino", {
    players: seats,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...WAVE10_CARDS],
  } as never);
  const set = WAVE10_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("shield_ops")),
  ).flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const shocker = CORE_CARDS.find((c) => (c.id as string) === SHOCKER)!.id;
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...set, shocker] }, WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS);
  return withForm(settled, alterEgo ? "alterEgo" : { heroForm: 0 }, P1);
}
const villainPhase = (state: GameState, ...stack: readonly string[]) =>
  driveEventsPicking(WAVE10_DEPS, stackEncounterDeck(state, ...stack), firstLegal, endTurn(P1));
const villainOf = (s: GameState) => s.activeVillainId!;
const CARD_TYPES = new Map<string, string>([...CORE_CARDS, ...WAVE10_CARDS].map((c) => [c.id as string, c.type]));
/** `state` with every minion out of the encounter deck and discard pile (surgery). */
function withoutMinions(state: GameState): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const keep = (id: InstanceId) => CARD_TYPES.get(codeOf(state, id)) !== "minion";
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter(keep), discard: pile.discard.filter(keep) },
    },
  };
}
const identityId = (s: GameState, p: typeof P1 | typeof P2) =>
  s.players.find((x) => x.playerId === p)!.identity.instanceId;
const twoPlayers = (p1AlterEgo: boolean): GameState => {
  const s = game(p1AlterEgo, [SPIDER_MAN, CAPTAIN_MARVEL]);
  return withForm(s, p1AlterEgo ? { heroForm: 0 } : "alterEgo", P2);
};
const villainPhase2 = (state: GameState, ...stack: readonly string[]) => {
  const step = state.step as unknown as { activePlayerId: PlayerId; remainingPlayerIds: PlayerId[] };
  const order = [step.activePlayerId, ...step.remainingPlayerIds];
  return driveEventsPicking(
    WAVE10_DEPS,
    stackEncounterDeck(state, ...stack),
    firstLegal,
    ...order.map((p) => endTurn(p)),
  );
};

describe("registry", () => {
  it("registers the five refs, each valid, and skips nothing", () => {
    expect(Object.keys(SYNTHEZOID_MODULAR_SHIELD_OPS).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(SYNTHEZOID_MODULAR_SHIELD_OPS))
      expect(validateDefinition(def), id).toEqual([]);
    expect(SYNTHEZOID_MODULAR_SHIELD_OPS_SKIPPED).toEqual({});
  });

  it("the card data names exactly these refs", () => {
    const refs = [OPERATOR, OVERWATCH, RAPID, HOMELAND].flatMap((code) =>
      (
        (WAVE10_CARDS.find((c) => (c.id as string) === code) as unknown as { abilities: { id: string }[] }).abilities ??
        []
      ).map((a) => a.id),
    );
    expect(refs.sort()).toEqual([...REFS].sort());
  });
});

describe("S.H.I.E.L.D. Operator (57013)", () => {
  it("WHEN REVEALED: 2 threat on the main scheme", () => {
    const start = game();
    const base = villainPhase(start, BLANK, FILLER_A);
    const run = villainPhase(start, BLANK, OPERATOR);
    expect(inPlayCard(run.state, OPERATOR)).toBeDefined();
    expect(mainThreat(run.state)).toBe(mainThreat(base.state) + 2);
  });
});

describe("Strategic Overwatch (57014)", () => {
  it("WHEN REVEALED: a tough status on the villain and on each minion, none on the hero", () => {
    const start = game();
    const placed = villainPhase(start, BLANK, OPERATOR).state; // Operator in play
    const run = driveEventsPicking(WAVE10_DEPS, stackEncounterDeck(placed, BLANK, OVERWATCH), firstLegal, endTurn(P1));
    const op = inPlayCard(run.state, OPERATOR)!;
    expect(tough(run.state, villainOf(run.state))).toBe(1);
    expect(tough(run.state, op)).toBe(1);
    expect(tough(run.state, inst(run.state, run.state.players[0]!.identity.instanceId).instanceId)).toBe(0);
    expect(inDiscard(run.state, OVERWATCH)).toHaveLength(1);
  });

  it("WHEN REVEALED: each of two minions in play gets one tough status", () => {
    const placed = villainPhase2(twoPlayers(false), BLANK, BLANK_B, OPERATOR, OPERATOR).state;
    const ops = Object.keys(placed.instances).filter(
      (i) => codeOf(placed, i as InstanceId) === OPERATOR && inst(placed, i as InstanceId).engagedWith,
    ) as InstanceId[];
    expect(ops).toHaveLength(2);
    const run = villainPhase2(placed, BLANK, BLANK_B, OVERWATCH);
    for (const op of ops) expect(tough(run.state, op)).toBe(1);
  });

  it("BOOST: the activating enemy (Rhino attacking) gets a tough status", () => {
    const run = villainPhase(game(), OVERWATCH, FILLER_A);
    expect(tough(run.state, villainOf(run.state))).toBe(1);
  });
});

describe("Rapid Response (57015)", () => {
  it("WHEN REVEALED in alter-ego form: threat equal to the found minion's SCH (Shocker: 1), minion stays discarded", () => {
    const start = game(true);
    const base = villainPhase(start, BLANK, FILLER_A);
    const run = villainPhase(start, BLANK, RAPID, FILLER_A, SHOCKER);
    expect(inDiscard(run.state, SHOCKER)).toHaveLength(1);
    expect(inPlayCard(run.state, SHOCKER)).toBeUndefined();
    expect(mainThreat(run.state)).toBe(mainThreat(base.state) + 1);
    expect(inst(run.state, run.state.players[0]!.identity.instanceId).damage).toBe(
      inst(base.state, base.state.players[0]!.identity.instanceId).damage,
    );
  });

  it("WHEN REVEALED in hero form: damage to the hero equal to the minion's ATK (Shocker: 2), no threat", () => {
    const start = game();
    const base = villainPhase(start, BLANK, FILLER_A);
    const run = villainPhase(start, BLANK, RAPID, FILLER_A, SHOCKER);
    const id = (s: GameState) => s.players[0]!.identity.instanceId;
    expect(inst(run.state, id(run.state)).damage).toBe(inst(base.state, id(base.state)).damage + 2);
    expect(mainThreat(run.state)).toBe(mainThreat(base.state));
    expect(codeOf(run.state, inDiscard(run.state, SHOCKER)[0]!)).toBe(SHOCKER);
  });

  it("WHEN REVEALED with no minion in the encounter deck: the discard stops at the empty deck (RRG p. 17), no effect", () => {
    for (const alterEgo of [true, false]) {
      const start = withoutMinions(game(alterEgo));
      const base = villainPhase(start, BLANK, FILLER_A);
      const run = villainPhase(start, BLANK, RAPID, FILLER_A);
      expect(inDiscard(run.state, RAPID)).toHaveLength(1);
      expect(mainThreat(run.state)).toBe(mainThreat(base.state));
      expect(inst(run.state, identityId(run.state, P1)).damage).toBe(
        inst(base.state, identityId(base.state, P1)).damage,
      );
    }
  });

  it("two players: P2 (alter-ego) reveals it while P1 is a hero: threat for the SCH, no damage to P1", () => {
    const start = twoPlayers(false);
    const base = villainPhase2(start, BLANK, BLANK_B, FILLER_A, FILLER_B);
    const run = villainPhase2(start, BLANK, BLANK_B, FILLER_A, RAPID, SHOCKER);
    expect(mainThreat(run.state)).toBe(mainThreat(base.state) + 1);
    expect(inst(run.state, identityId(run.state, P1)).damage).toBe(inst(base.state, identityId(base.state, P1)).damage);
  });

  it("two players: P2 (hero) reveals it while P1 is in alter-ego form: damage to P2's hero for the ATK, no threat", () => {
    const start = twoPlayers(true);
    const base = villainPhase2(start, BLANK, BLANK_B, FILLER_A, FILLER_B);
    const run = villainPhase2(start, BLANK, BLANK_B, FILLER_A, RAPID, SHOCKER);
    expect(inst(run.state, identityId(run.state, P2)).damage).toBe(
      inst(base.state, identityId(base.state, P2)).damage + 2,
    );
    expect(mainThreat(run.state)).toBe(mainThreat(base.state));
  });
});

describe("Homeland Security (57016)", () => {
  it("the first minion revealed each round gains surge; the second does not", () => {
    const placed = villainPhase(game(), BLANK, HOMELAND).state;
    expect(inPlayCard(placed, HOMELAND)).toBeDefined();
    const run = villainPhase(placed, BLANK, OPERATOR, OPERATOR, FILLER_A);
    expect(revealedCodes(run.state, run.events)).toEqual([OPERATOR, OPERATOR]);
  });

  it("without it the first minion draws no surge", () => {
    const run = villainPhase(game(), BLANK, OPERATOR, OPERATOR, FILLER_A);
    expect(revealedCodes(run.state, run.events)).toEqual([OPERATOR]);
  });
});
