import { CORE_CARDS, CW_CARDS, encounterSetId, trait } from "@mc/content";
import { activeEncounterDeckId, createGame, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { competitiveOnlyTexts, validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  patchInstance,
  settle,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withDamage } from "../../../testing/staging.js";
import {
  BLANK,
  FILLER_A,
  FILLER_B,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  heroForm,
  heroThwarts,
  inDiscard,
  inPlayCard,
  picking,
  schemesBy,
} from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS, engageMinion } from "../../testing.js";
import { MODULAR_CLOAK_AND_DAGGER, MODULAR_CLOAK_AND_DAGGER_SKIPPED } from "./cloak-and-dagger.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Cloak & Dagger modular set (56194 Cloak, 56195 Dagger, 56196 Darkforce, 56197 Lightforce, 56198 Cloak and Dagger),
 * docs/phase7-wave10.md sections 3.4, 3.6 and 3.23. The Civil War scenario builder does not exist yet, so the set is
 * tested inside Core's Rhino scenario against the Core Spider-Man starter deck with the set's cards added to the
 * encounter deck by hand. Outside Civil War "the enemy leader" is the villain, Rhino (FFG ruling July 9, 2026), and a
 * cooperative game has no "your leader".
 */
const CLOAK = "56194";
const DAGGER = "56195";
const DARKFORCE = "56196";
const LIGHTFORCE = "56197";
const SCHEME = "56198";
const SET = [CLOAK, DAGGER, DARKFORCE, LIGHTFORCE, SCHEME];
const RHINO = "01094";
const SHOCKER = "01103"; // Core minion: ATK 2, SCH 1
const REFS = [
  "56194.when-revealed",
  "56194.boost",
  "56195.when-revealed",
  "56195.boost",
  "56196.darkforce-constant",
  "56196.darkforce-forced-response",
  "56197.when-revealed",
  "56198.when-defeated",
];

const dataOf = (code: string) => CW_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;

/** Rhino's game against Spider-Man (hero form) with one copy of each of the set's cards in the encounter deck. */
function game(): GameState {
  const config = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...WAVE10_CARDS],
  } as never);
  const copies = CW_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("cloak_and_dagger_modular")),
  ).flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return heroForm(settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS));
}
const alterEgoGame = (): GameState => {
  const s = game();
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const } })),
  } as GameState;
};

/** Every player ends the turn and the villain phase runs on the stacked deck (top first: Rhino's boost, then the rest). */
function villainPhase(
  state: GameState,
  stack: readonly string[],
  pick: Parameters<typeof driveEventsPicking>[2] = firstLegal,
) {
  return driveEventsPicking(WAVE10_DEPS, stackEncounterDeck(state, ...stack), pick, endTurn(P1));
}

/** The first copy of `code` in the encounter deck or discard pile removed from it (by surgery). */
function takeFromEncounter(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
    },
  };
}
/** The set's `code` attached faceup to `host` (surgery: no reveal). */
function attachTo(state: GameState, code: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const taken = takeFromEncounter(state, code);
  const attached = patchInstance(taken.state, taken.id, { faceup: true, attachedTo: host });
  return {
    id: taken.id,
    state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, taken.id] }),
  };
}
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState) => identityOf(s, P1);
const mainScheme = (s: GameState): InstanceId => s.mainScheme.instanceId;
const attachedCodes = (s: GameState, host: InstanceId) => inst(s, host).attachments.map((a) => codeOf(s, a));
const toughOn = (s: GameState, id: InstanceId) => inst(s, id).statuses.tough;
const withStatus = (s: GameState, id: InstanceId, status: "stunned" | "confused" | "tough"): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [status]: 1 } });

describe("registry", () => {
  it("registers the eight refs of the five cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(MODULAR_CLOAK_AND_DAGGER).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(MODULAR_CLOAK_AND_DAGGER)) expect(validateDefinition(def), id).toEqual([]);
    expect(MODULAR_CLOAK_AND_DAGGER_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the five cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("carries the printed timing of each ability", () => {
    const r = MODULAR_CLOAK_AND_DAGGER;
    expect(r["56194.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(r["56194.boost"]!.trigger).toMatchObject({ kind: "boost" });
    expect(r["56195.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(r["56195.boost"]!.trigger).toMatchObject({ kind: "boost" });
    expect(r["56196.darkforce-constant"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(r["56196.darkforce-forced-response"]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(r["56197.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(r["56198.when-defeated"]!.trigger).toMatchObject({ kind: "whenDefeated" });
  });

  it("the two competitive sentences are scripted against your leader's main scheme (M3), no marker left", () => {
    for (const ref of ["56194.when-revealed", "56196.darkforce-forced-response"]) {
      expect(competitiveOnlyTexts(MODULAR_CLOAK_AND_DAGGER[ref]!)).toEqual([]);
      expect(JSON.stringify(MODULAR_CLOAK_AND_DAGGER[ref])).toContain('"of":"yourLeader"');
    }
  });

  it("setup: the encounter deck holds one copy of each card", () => {
    const s = game();
    const all = Object.keys(s.instances).map((i) => codeOf(s, i as InstanceId));
    expect(SET.map((code) => all.filter((c) => c === code).length)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("Cloak (56194)", () => {
  it("is data: a unique Defender minion, ATK 1, SCH 2, 4 hit points, no boost icon and a star icon", () => {
    const card = dataOf(CLOAK);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.starIcon, card.unique]).toEqual([
      "minion",
      1,
      2,
      4,
      0,
      true,
      true,
    ]);
    expect(card.traits).toEqual([trait("DEFENDER")]);
  });

  it("WHEN REVEALED (cooperative): 2 threat on the main scheme, the only scheme; Cloak engages you", () => {
    const control = villainPhase(game(), [BLANK, FILLER_B, FILLER_A]);
    const run = villainPhase(game(), [BLANK, CLOAK, FILLER_A]);
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(2);
    expect(inst(run.state, inPlayCard(run.state, CLOAK)!).engagedWith).toBe(P1);
    // Nothing is removed from anywhere: the competitive sentence has no cooperative reading.
    expect(inst(run.state, hero(run.state)).damage).toBe(inst(control.state, hero(control.state)).damage);
  });

  it("WHEN REVEALED: you choose the scheme, and a side scheme takes the 2 threat instead of the main scheme", () => {
    const staged = encounterCardInVillainArea(game(), SCHEME, 3);
    const control = villainPhase(staged.state, [BLANK, FILLER_B, FILLER_A]);
    const run = villainPhase(staged.state, [BLANK, CLOAK, FILLER_A], picking(staged.id));
    expect(inst(run.state, staged.id).threat).toBe(5);
    expect(mainThreat(run.state)).toBe(mainThreat(control.state));
  });

  it("WHEN REVEALED: choosing the main scheme leaves the side scheme alone", () => {
    const staged = encounterCardInVillainArea(game(), SCHEME, 3);
    const control = villainPhase(staged.state, [BLANK, FILLER_B, FILLER_A]);
    const run = villainPhase(staged.state, [BLANK, CLOAK, FILLER_A], picking(mainScheme(staged.state)));
    expect(inst(run.state, staged.id).threat).toBe(3);
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(2);
  });

  it("BOOST with Dagger not in play: 1 threat on the main scheme and Cloak is not revealed", () => {
    const control = villainPhase(game(), [BLANK, FILLER_A]);
    const run = villainPhase(game(), [CLOAK, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(1);
    expect(inPlayCard(run.state, CLOAK)).toBeUndefined();
  });

  it("BOOST with Dagger in play: Cloak is revealed (2 threat from its When Revealed, none from the boost) and engages you", () => {
    const withDagger = engageMinion(game(), DAGGER, "dagger");
    const control = villainPhase(withDagger, [BLANK, FILLER_A]);
    const run = villainPhase(withDagger, [CLOAK, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(inst(run.state, inPlayCard(run.state, CLOAK)!).engagedWith).toBe(P1);
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(2);
  });
});

describe("Dagger (56195)", () => {
  it("is data: a unique Defender minion, ATK 2, SCH 1, 3 hit points, no boost icon and a star icon", () => {
    const card = dataOf(DAGGER);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.starIcon, card.unique]).toEqual([
      "minion",
      2,
      1,
      3,
      0,
      true,
      true,
    ]);
    expect(card.traits).toEqual([trait("DEFENDER")]);
  });

  it("WHEN REVEALED: the enemy leader (Rhino) heals 2 damage and you deal 2 damage to your hero; Dagger engages you", () => {
    const start = game();
    const hurt = withDamage(start, villainOf(start), 5);
    const run = villainPhase(hurt, [BLANK, DAGGER, FILLER_A]);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(3);
    // Rhino's own attack (2), then Dagger's 2 damage to the only character you control.
    expect(inst(run.state, hero(run.state)).damage).toBe(4);
    expect(inst(run.state, inPlayCard(run.state, DAGGER)!).engagedWith).toBe(P1);
  });

  it("WHEN REVEALED: healing stops at no damage (1 damage on Rhino heals 1)", () => {
    const start = game();
    const run = villainPhase(withDamage(start, villainOf(start), 1), [BLANK, DAGGER, FILLER_A]);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(0);
  });

  it("BOOST with Cloak not in play: 1 damage to your hero (Rhino ATK 2 + 1) and Dagger is not revealed", () => {
    const start = game();
    const hurt = withDamage(start, villainOf(start), 5);
    const run = villainPhase(hurt, [DAGGER, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(inst(run.state, hero(run.state)).damage).toBe(3);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(5);
    expect(inPlayCard(run.state, DAGGER)).toBeUndefined();
  });

  it("BOOST with Cloak in play: Dagger is revealed (heals Rhino 2, 2 damage to your hero; no damage from the boost itself)", () => {
    const start = engageMinion(game(), CLOAK, "cloak");
    const hurt = withDamage(start, villainOf(start), 5);
    const run = villainPhase(hurt, [DAGGER, FILLER_A]);
    expect(inst(run.state, inPlayCard(run.state, DAGGER)!).engagedWith).toBe(P1);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(3);
    // Rhino 2, Dagger's When Revealed 2, then the two minions engaged with you activate: Cloak (ATK 1), Dagger (ATK 2).
    expect(attacksBy(run.state, run.events, DAGGER)).toMatchObject([{ baseAtk: 2, damageDealt: 2 }]);
    expect(attacksBy(run.state, run.events, CLOAK)).toMatchObject([{ baseAtk: 1, damageDealt: 1 }]);
    expect(inst(run.state, hero(run.state)).damage).toBe(7);
  });
});

describe("Darkforce (56196)", () => {
  it("is data: an attachment that attaches to the enemy leader, +1 SCH, 1 boost icon, and a star on the response", () => {
    const card = dataOf(DARKFORCE);
    expect([card.type, card.statModifiers, card.boostIcons, card.attachesTo]).toEqual([
      "attachment",
      { sch: 1 },
      1,
      { kind: "leader", of: "enemy" },
    ]);
  });

  it("REVEALED it attaches to the enemy leader (Rhino) and he is given a tough status card; you are not", () => {
    const start = game();
    expect(toughOn(start, villainOf(start))).toBe(0);
    const run = villainPhase(start, [BLANK, DARKFORCE, FILLER_A]);
    expect(attachedCodes(run.state, villainOf(run.state))).toEqual([DARKFORCE]);
    expect(toughOn(run.state, villainOf(run.state))).toBe(1);
    expect(toughOn(run.state, hero(run.state))).toBe(0);
  });

  it("REVEALED: a leader who was already tough still has one tough status card", () => {
    const start = game();
    const run = villainPhase(withStatus(start, villainOf(start), "tough"), [BLANK, DARKFORCE, FILLER_A]);
    expect(toughOn(run.state, villainOf(run.state))).toBe(1);
    expect(attachedCodes(run.state, villainOf(run.state))).toEqual([DARKFORCE]);
  });

  it(
    "FORCED RESPONSE (owner's question 11 = A, provisional): the attached leader schemes and places threat, nothing " +
      "is removed (no 'your leader's main scheme' in a cooperative game) and Darkforce is discarded",
    () => {
      const start = alterEgoGame();
      const control = villainPhase(start, [BLANK, FILLER_A]);
      const { state, id } = attachTo(start, DARKFORCE, villainOf(start));
      const run = villainPhase(state, [BLANK, FILLER_A]);
      // SCH 1 + 1 from Darkforce, no icons: 2 more threat than the control's 1, and nothing taken back off.
      expect(schemesBy(run.state, run.events, RHINO)).toMatchObject([{ baseSch: 2, boostIcons: 0, threatPlaced: 2 }]);
      expect(schemesBy(control.state, control.events, RHINO)).toMatchObject([{ baseSch: 1, threatPlaced: 1 }]);
      expect(mainThreat(run.state) - mainThreat(control.state)).toBe(1);
      expect(inDiscard(run.state, DARKFORCE)).toEqual([id]);
      expect(attachedCodes(run.state, villainOf(run.state))).not.toContain(DARKFORCE);
    },
  );

  it("FORCED RESPONSE: not when the attached leader attacks; Darkforce stays", () => {
    const start = game();
    const { state } = attachTo(start, DARKFORCE, villainOf(start));
    const run = villainPhase(state, [BLANK, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toHaveLength(1);
    expect(attachedCodes(run.state, villainOf(run.state))).toContain(DARKFORCE);
    expect(inDiscard(run.state, DARKFORCE)).toEqual([]);
  });

  it("FORCED RESPONSE: not when a minion schemes instead of the attached leader (a confused Rhino's scheme is canceled)", () => {
    const start = engageMinion(withStatus(alterEgoGame(), villainOf(alterEgoGame()), "confused"), SHOCKER, "shocker");
    const { state } = attachTo(start, DARKFORCE, villainOf(start));
    // The confused Rhino is given no boost card (his scheme is replaced), so the first card is dealt to the player.
    const run = villainPhase(state, [FILLER_A, FILLER_B]);
    expect(schemesBy(run.state, run.events, RHINO)).toEqual([]);
    expect(schemesBy(run.state, run.events, SHOCKER)).toMatchObject([{ threatPlaced: 1 }]);
    expect(toughOn(run.state, villainOf(run.state))).toBe(0);
    expect(attachedCodes(run.state, villainOf(run.state))).toContain(DARKFORCE);
    expect(inDiscard(run.state, DARKFORCE)).toEqual([]);
  });

  it("BOOST: 1 icon on the activating enemy's attack (Rhino ATK 2 + 1)", () => {
    const run = villainPhase(game(), [DARKFORCE, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 1, damageDealt: 3 }]);
  });
});

describe("Lightforce (56197)", () => {
  it("is data: a treachery with 2 boost icons", () => {
    const card = dataOf(LIGHTFORCE);
    expect([card.type, card.boostIcons, card.keywords]).toEqual(["treachery", 2, []]);
  });

  it("WHEN REVEALED: the enemy leader heals 3 damage and you take 3 indirect damage", () => {
    const start = game();
    const run = villainPhase(withDamage(start, villainOf(start), 5), [BLANK, LIGHTFORCE, FILLER_A]);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(2);
    // Rhino's attack (2), then the 3 indirect damage on the only character you control.
    expect(inst(run.state, hero(run.state)).damage).toBe(5);
  });

  it("WHEN REVEALED: healing stops at no damage (2 damage on Rhino heals 2)", () => {
    const start = game();
    const run = villainPhase(withDamage(start, villainOf(start), 2), [BLANK, LIGHTFORCE, FILLER_A]);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(0);
    expect(inst(run.state, hero(run.state)).damage).toBe(5);
  });

  it("BOOST: 2 icons on the activating enemy's attack (Rhino ATK 2 + 2), no healing and no indirect damage", () => {
    const start = game();
    const run = villainPhase(withDamage(start, villainOf(start), 5), [LIGHTFORCE, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 2, damageDealt: 4 }]);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(5);
    expect(inst(run.state, hero(run.state)).damage).toBe(4);
  });
});

describe("Cloak and Dagger (56198)", () => {
  it("is data: a side scheme with 3 threat (none per player), 3 boost icons, a crisis icon and Hinder 1 per hero", () => {
    const card = dataOf(SCHEME);
    expect([card.type, card.startingThreat, card.boostIcons, card.icons, card.keywords]).toEqual([
      "side_scheme",
      { base: 3, perPlayer: 0 },
      3,
      ["crisis"],
      [{ name: "hinder", value: 0, perPlayer: 1 }],
    ]);
  });

  it("REVEALED it enters play with 3 threat plus 1 for Hinder (one hero)", () => {
    const run = villainPhase(game(), [BLANK, SCHEME, FILLER_A]);
    expect(inst(run.state, inPlayCard(run.state, SCHEME)!).threat).toBe(4);
  });

  it("WHEN DEFEATED: the enemy leader heals 3 damage and is given a tough status card", () => {
    const start = game();
    const staged = encounterCardInVillainArea(withDamage(start, villainOf(start), 5), SCHEME, 1);
    const run = heroThwarts(WAVE10_DEPS, staged.state, staged.id);
    expect(inst(run.state, staged.id).threat).toBe(0);
    expect(inPlayCard(run.state, SCHEME)).toBeUndefined();
    expect(inst(run.state, villainOf(run.state)).damage).toBe(2);
    expect(toughOn(run.state, villainOf(run.state))).toBe(1);
  });

  it("WHEN DEFEATED: not while it still has threat (a thwart that does not defeat it heals nothing)", () => {
    const start = game();
    const staged = encounterCardInVillainArea(withDamage(start, villainOf(start), 5), SCHEME, 3);
    const run = heroThwarts(WAVE10_DEPS, staged.state, staged.id);
    expect(inst(run.state, staged.id).threat).toBe(2);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(5);
    expect(toughOn(run.state, villainOf(run.state))).toBe(0);
  });

  it("BOOST: 3 icons on the activating enemy's attack (Rhino ATK 2 + 3)", () => {
    const run = villainPhase(game(), [SCHEME, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 3, damageDealt: 5 }]);
  });
});
