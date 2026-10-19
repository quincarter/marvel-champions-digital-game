import { CORE_CARDS, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  createGame,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  patchInstance,
  settle,
  stackEncounterDeck,
  use,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import {
  BLANK,
  CAPTAIN_MARVEL,
  FILLER_A,
  FILLER_B,
  SPIDER_MAN,
  codeOf,
  heroForm,
  heroThwarts,
  inDiscard,
  inPlayCard,
} from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS } from "../../testing.js";
import { SYNTHEZOID_MODULAR_ROYAL_GUARD, SYNTHEZOID_MODULAR_ROYAL_GUARD_SKIPPED } from "./royal-guard.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Royal Guard modular set (57069 Janus, 57070 Amir, 57071 Atlanteans, 57072 Blood Debt, 57073 The Royal Guard),
 * docs/phase7-synthezoid.md section 8.3. Tested in Core's Rhino scenario against Core starter decks with the set's
 * cards added to the encounter deck by hand (as the Deadly Duo tests do).
 */
const JANUS = "57069";
const AMIR = "57070";
const ATLANTEANS = "57071";
const DEBT = "57072";
const GUARD = "57073";
const BLANK_B = "01104"; // Core treachery with no boost icon
const REFS = [
  "57069.when-revealed",
  "57070.when-revealed",
  "57071.when-revealed",
  "57072.blood-debt-constant",
  "57072.blood-debt-action",
  "57073.when-defeated",
];
const deps = WAVE10_DEPS;

type Seat = typeof SPIDER_MAN | typeof CAPTAIN_MARVEL;
const coreOf = (code: string) => CORE_CARDS.find((c) => (c.id as string) === code)! as unknown as { type: string };
const typeOfCode = (code: string): string => coreOf(code).type;

function game(seats: readonly Seat[] = [SPIDER_MAN], extraDebt = 0): GameState {
  const config = coreScenario("rhino", {
    players: seats,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...WAVE10_CARDS],
  } as never);
  const copies = WAVE10_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("royal_guard")),
  ).flatMap((c) => Array.from({ length: c.quantityInSet + ((c.id as string) === DEBT ? extraDebt : 0) }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, deps);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", deps);
  return heroForm(settled, ...seats.map((_, i) => [P1, P2][i]!));
}
/** Every player ends the turn; the villain phase runs on the stacked deck (top first: Rhino boosts, then the rest). */
const villainPhase = (state: GameState, stack: readonly string[]) =>
  driveEventsPicking(
    deps,
    stackEncounterDeck(state, ...stack),
    firstLegal,
    ...state.players.map((p) => endTurn(p.playerId)),
  );
const deckOf = (s: GameState, player: PlayerId) => s.players.find((p) => p.playerId === player)!.deck;
const playAreaOf = (s: GameState, player: PlayerId) => s.players.find((p) => p.playerId === player)!.playArea;
const damageOn = (s: GameState, player: PlayerId) => inst(s, identityOf(s, player)).damage;
function deckTopTypes(state: GameState, player: PlayerId, ...wanted: readonly string[]): GameState {
  const owner = state.players.find((p) => p.playerId === player)!;
  const used: InstanceId[] = [];
  for (const type of wanted) {
    const id = owner.deck.find((i) => !used.includes(i) && typeOfCode(codeOf(state, i)) === type);
    if (!id) throw new Error(`no ${type} left in the deck`);
    used.push(id);
  }
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, deck: [...used, ...p.deck.filter((i) => !used.includes(i))] } : p,
    ),
  };
}

describe("registry", () => {
  it("registers the six refs, each valid, and skips nothing", () => {
    expect(Object.keys(SYNTHEZOID_MODULAR_ROYAL_GUARD).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(SYNTHEZOID_MODULAR_ROYAL_GUARD))
      expect(validateDefinition(def), id).toEqual([]);
    expect(SYNTHEZOID_MODULAR_ROYAL_GUARD_SKIPPED).toEqual({});
  });

  it("the card data names exactly these refs", () => {
    const refs = [JANUS, AMIR, ATLANTEANS, DEBT, GUARD].flatMap((code) =>
      abilityRefIds(WAVE10_CARDS.find((c) => (c.id as string) === code)!),
    );
    expect(refs.sort()).toEqual([...REFS].sort());
  });
});

const toAlterEgo = (state: GameState, player: PlayerId = P1) => withForm(state, "alterEgo", player);
const dealtCodes = (s: GameState, player: PlayerId) =>
  s.players.find((p) => p.playerId === player)!.dealtEncounter.map((i) => codeOf(s, i));
/** Surgery: a Blood Debt out of the encounter deck into `player`'s play area (what revealing it does). */
function withDebt(state: GameState, player: PlayerId): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck.find((i) => codeOf(state, i) === DEBT)!;
  const moved: GameState = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard },
    },
    players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
  };
  return patchInstance(moved, id, { controllerId: player, faceup: true });
}
const alterEgoWithDebt = (): GameState => toAlterEgo(withDebt(game(), P1));

/** Surgery: every Blood Debt out of play (to the encounter discard), as if it had never been dealt. */
function toNoDebt(state: GameState): GameState {
  const id = inPlayCard(state, DEBT);
  if (!id) return state;
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { deck: pile.deck, discard: [...pile.discard, id] } },
    players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== id) })),
  };
}

describe("Blood Debt (57072)", () => {
  it("ALTER-EGO ACTION: a deck of 7 cannot pay the full cost, so it is refused", () => {
    const placed = alterEgoWithDebt();
    const short = {
      ...placed,
      players: placed.players.map((p) => ({ ...p, deck: p.deck.slice(0, 7) })),
    } as GameState;
    const id = inPlayCard(short, DEBT)!;
    expect(applyCommand(short, use(P1, id, "57072.blood-debt-action"), deps).ok).toBe(false);
  });

  it("ALTER-EGO ACTION: P2 cannot trigger P1's Blood Debt (RRG 1.8 'Obligation', p. 30)", () => {
    const two = toAlterEgo(toAlterEgo(withDebt(game([SPIDER_MAN, CAPTAIN_MARVEL]), P1), P1), P2);
    const id = inPlayCard(two, DEBT)!;
    expect(applyCommand(two, use(P2, id, "57072.blood-debt-action"), deps).ok).toBe(false);
    expect(applyCommand(two, use(P1, id, "57072.blood-debt-action"), deps).ok).toBe(true); // control: the holder can
  });

  it("ALTER-EGO ACTION: discards the top 8 cards of the deck and discards Blood Debt", () => {
    const placed = alterEgoWithDebt();
    const id = inPlayCard(placed, DEBT)!;
    const before = deckOf(placed, P1).length;
    const run = driveEventsPicking(deps, placed, firstLegal, use(P1, id, "57072.blood-debt-action"));
    expect(deckOf(run.state, P1)).toHaveLength(before - 8);
    expect(inDiscard(run.state, DEBT)).toHaveLength(1);
    expect(inPlayCard(run.state, DEBT)).toBeUndefined();
  });

  it("ALTER-EGO ACTION is refused in hero form", () => {
    const placed = withDebt(game(), P1);
    const id = inPlayCard(placed, DEBT)!;
    const result = applyCommand(placed, use(P1, id, "57072.blood-debt-action"), deps);
    expect(result.ok).toBe(false);
  });

  it("Blood Debt revealed from the deck lands in the revealer's play area", () => {
    const run = villainPhase(game(), [BLANK, DEBT, FILLER_A]);
    expect(playAreaOf(run.state, P1)).toContain(inPlayCard(run.state, DEBT));
  });
});

describe("Janus (57069) and Amir (57070)", () => {
  // Hunted comes from a Blood Debt in the holder's play area, staged by surgery (one encounter card is revealed per
  // player, so a Debt revealed in the same phase would leave the minion unrevealed).
  it.each([JANUS, AMIR])("%s with Hunted: activates against the hero (extra damage), no cards discarded", (m) => {
    const start = game();
    const control = villainPhase(start, [BLANK, m, BLANK_B]);
    const hunted = villainPhase(withDebt(start, P1), [BLANK, m, BLANK_B]);
    expect(inPlayCard(hunted.state, m)).toBeDefined();
    // Blood Debt's amplify adds 1 to Rhino's boost and 1 to the minion's own; the attack itself adds its ATK.
    const atk = m === JANUS ? 3 : 2;
    expect(damageOn(hunted.state, P1)).toBeGreaterThanOrEqual(damageOn(control.state, P1) + 1 + atk);
    expect(deckOf(hunted.state, P1).length).toBeGreaterThan(deckOf(control.state, P1).length);
  });

  it("Amir with Hunted, in alter-ego form: schemes against the player (threat), no extra damage", () => {
    const start = toAlterEgo(game());
    const control = villainPhase(start, [BLANK, AMIR, BLANK_B]);
    const hunted = villainPhase(withDebt(start, P1), [BLANK, AMIR, BLANK_B]);
    expect(mainThreat(hunted.state)).toBeGreaterThanOrEqual(mainThreat(control.state) + 1 + 2); // amplify + SCH 2
    expect(damageOn(hunted.state, P1)).toBe(damageOn(control.state, P1));
  });

  it("real path: The Royal Guard deals Blood Debt, it is revealed, and a later Janus attacks", () => {
    const placed = encounterCardInVillainArea(game(), GUARD, 1);
    const defeated = heroThwarts(deps, placed.state, placed.id).state;
    expect(dealtCodes(defeated, P1)).toEqual([DEBT]);
    // The dealt Debt is revealed in the villain phase (no Janus yet): Hunted from then on.
    const revealed = villainPhase(defeated, [BLANK, FILLER_A]).state;
    expect(playAreaOf(revealed, P1)).toContain(inPlayCard(revealed, DEBT));
    const next = villainPhase(revealed, [BLANK, JANUS, BLANK_B]);
    const control = villainPhase(toNoDebt(revealed), [BLANK, JANUS, BLANK_B]);
    expect(damageOn(next.state, P1)).toBeGreaterThanOrEqual(damageOn(control.state, P1) + 1 + 3);
  });

  it.each([JANUS, AMIR])("%s without Hunted discards the top 2 cards of the revealer's deck", (m) => {
    const start = game();
    const base = villainPhase(start, [BLANK, FILLER_A, BLANK_B]);
    const run = villainPhase(start, [BLANK, m, BLANK_B]);
    expect(inPlayCard(run.state, m)).toBeDefined();
    expect(deckOf(run.state, P1)).toHaveLength(deckOf(base.state, P1).length - 2);
  });

  it("two players: Hunted is the revealer's own trait; P2's Blood Debt does not make P1's Janus activate", () => {
    const start = game([SPIDER_MAN, CAPTAIN_MARVEL]);
    // Two boost cards (one per Rhino activation), then P1 is dealt Janus.
    const stack = [BLANK, BLANK_B, JANUS, FILLER_B];
    const control = villainPhase(start, stack);
    const run = villainPhase(withDebt(start, P2), stack);
    expect(deckOf(run.state, P1)).toHaveLength(deckOf(control.state, P1).length);
    expect(deckOf(run.state, P1).length).toBeLessThan(deckOf(start, P1).length);
    // Blood Debt's amplify icon adds 1 to Rhino's boost on P1 (the only difference); a Janus attack would add 3 more.
    expect(damageOn(run.state, P1)).toBe(damageOn(control.state, P1) + 1);
    // Control: the same Janus does activate when P1 is the holder.
    const p1Holds = villainPhase(withDebt(start, P1), stack);
    expect(damageOn(p1Holds.state, P1)).toBeGreaterThanOrEqual(damageOn(control.state, P1) + 4);
  });
});

describe("Atlanteans (57071)", () => {
  it("in alter-ego form: 1 threat per different card type discarded", () => {
    const staged = deckTopTypes(toAlterEgo(game()), P1, "ally", "event", "upgrade");
    const control = villainPhase(staged, [BLANK, FILLER_A]);
    const run = villainPhase(staged, [BLANK, ATLANTEANS]);
    expect(mainThreat(run.state)).toBe(mainThreat(control.state) + 3);
    expect(damageOn(run.state, P1)).toBe(damageOn(control.state, P1));
    expect(deckOf(run.state, P1)).toHaveLength(deckOf(control.state, P1).length - 3);
  });

  it("in alter-ego form, three allies are one type: 1 threat", () => {
    const staged = deckTopTypes(toAlterEgo(game()), P1, "ally", "ally", "ally");
    const control = villainPhase(staged, [BLANK, FILLER_A]);
    const run = villainPhase(staged, [BLANK, ATLANTEANS]);
    expect(mainThreat(run.state)).toBe(mainThreat(control.state) + 1);
  });

  it("in hero form: indirect damage per different type, no threat", () => {
    const staged = deckTopTypes(game(), P1, "ally", "event", "upgrade");
    const control = villainPhase(staged, [BLANK, FILLER_A]);
    const run = villainPhase(staged, [BLANK, ATLANTEANS]);
    expect(damageOn(run.state, P1)).toBe(damageOn(control.state, P1) + 3);
    expect(mainThreat(run.state)).toBe(mainThreat(control.state));
  });

  it("two players: P1 (alter-ego) reveals it: threat, no damage to P2 the hero", () => {
    const start = deckTopTypes(toAlterEgo(game([SPIDER_MAN, CAPTAIN_MARVEL])), P1, "ally", "event", "upgrade");
    const control = villainPhase(start, [BLANK, BLANK_B, FILLER_A, FILLER_B]);
    const run = villainPhase(start, [BLANK, BLANK_B, ATLANTEANS, FILLER_B]);
    expect(mainThreat(run.state)).toBe(mainThreat(control.state) + 3);
    expect(damageOn(run.state, P2)).toBe(damageOn(control.state, P2));
  });

  it("two players: P2 (hero) reveals it while P1 is an alter-ego: indirect damage to P2, no threat", () => {
    const start = deckTopTypes(toAlterEgo(game([SPIDER_MAN, CAPTAIN_MARVEL])), P2, "ally", "event", "upgrade");
    const control = villainPhase(start, [BLANK, BLANK_B, FILLER_A, FILLER_B]);
    const run = villainPhase(start, [BLANK, BLANK_B, FILLER_A, ATLANTEANS]);
    expect(damageOn(run.state, P2)).toBe(damageOn(control.state, P2) + 3);
    expect(mainThreat(run.state)).toBe(mainThreat(control.state));
  });
});

describe("The Royal Guard (57073)", () => {
  it("is data: a crisis side scheme with 3 base threat, 2 boost icons and Hinder 1 per hero", () => {
    const card = WAVE10_CARDS.find((c) => (c.id as string) === GUARD)! as unknown as Record<string, unknown>;
    expect([card.startingThreat, card.boostIcons, card.icons, card.keywords]).toEqual([
      { base: 3, perPlayer: 0 },
      2,
      ["crisis"],
      [{ name: "hinder", value: 0, perPlayer: 1 }],
    ]);
  });

  it("WHEN DEFEATED: a Blood Debt from the encounter deck is dealt facedown to the defeating player", () => {
    const placed = encounterCardInVillainArea(game(), GUARD, 1);
    const run = heroThwarts(deps, placed.state, placed.id);
    expect(inDiscard(run.state, GUARD)).toHaveLength(1);
    expect(dealtCodes(run.state, P1)).toEqual([DEBT]);
  });

  it("finds the copy in the encounter discard pile too", () => {
    const placed = encounterCardInVillainArea(game(), GUARD, 1);
    const deckId = activeEncounterDeckId(placed.state);
    const pile = placed.state.encounterDecks[deckId]!;
    const debt = pile.deck.find((i) => codeOf(placed.state, i) === DEBT)!;
    const moved = {
      ...placed.state,
      encounterDecks: {
        ...placed.state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== debt), discard: [...pile.discard, debt] },
      },
    } as GameState;
    const run = heroThwarts(deps, moved, placed.id);
    expect(dealtCodes(run.state, P1)).toEqual([DEBT]);
  });

  it("no copy anywhere: nothing is dealt", () => {
    const placed = encounterCardInVillainArea(game(), GUARD, 1);
    const deckId = activeEncounterDeckId(placed.state);
    const pile = placed.state.encounterDecks[deckId]!;
    const keep = (i: InstanceId) => codeOf(placed.state, i) !== DEBT;
    const none = {
      ...placed.state,
      encounterDecks: {
        ...placed.state.encounterDecks,
        [deckId]: { deck: pile.deck.filter(keep), discard: pile.discard.filter(keep) },
      },
    } as GameState;
    const run = heroThwarts(deps, none, placed.id);
    expect(dealtCodes(run.state, P1)).toEqual([]);
  });

  it("two players: the defeating player (P2) is dealt it, P1 is not", () => {
    const placed = encounterCardInVillainArea(game([SPIDER_MAN, CAPTAIN_MARVEL]), GUARD, 1);
    const passed = driveEventsPicking(deps, placed.state, firstLegal, endTurn(P1)).state;
    const run = heroThwarts(deps, passed, placed.id, { player: P2 });
    expect(dealtCodes(run.state, P2)).toEqual([DEBT]);
    expect(dealtCodes(run.state, P1)).toEqual([]);
  });

  it("does nothing while it stands: a thwart that leaves threat deals nothing", () => {
    const placed = encounterCardInVillainArea(game(), GUARD, 3);
    const run = heroThwarts(deps, placed.state, placed.id);
    expect(dealtCodes(run.state, P1)).toEqual([]);
  });
});
