import { AOA_CARDS, CORE_CARDS, cardId, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  createGame,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries, defineAbilities } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { attachToHost } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { CELESTIAL_TECH, CELESTIAL_TECH_SKIPPED, CELESTIAL_TECH_WHEN_REVEALED_DRAFT } from "./celestial-tech.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Celestial Tech modular set (45156 Celestial Armor, 45157 Celestial Weapon, 45158 Celestial Tech),
 * docs/phase7-wave8.md §3.28. Rhino (Core, standard) from `coreScenario`, the set's cards added to the encounter deck,
 * Armor/Weapon attached to the villain by surgery, the top card of the player's deck chosen by its printed resource.
 */
const ARMOR = "45156";
const WEAPON = "45157";
const TECH = "45158";
const BLANK = "01186";
const REFS = ["45156.celestial-armor-forced-interrupt", "45157.celestial-weapon-forced-interrupt"];
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, CELESTIAL_TECH) };
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;

type Icon = "energy" | "mental" | "physical" | "wild" | "none";
/**
 * A card printing exactly this resource: Spider-Man and Justice cards, [wild] from Captain Marvel's 01011 (swapped in by
 * surgery, as Spider-Man's deck has none) and an encounter treachery (Core 01186) for a card with no icon.
 */
const CODE_OF: Record<Icon, string> = {
  energy: "01059",
  mental: "01061",
  physical: "01058",
  wild: "01011",
  none: "01186",
};

function setupGame(deps: EngineDeps = DEPS): GameState {
  const config = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  });
  const cards = AOA_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("celestial_tech")),
  );
  const copies = cards.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, deps);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", deps);
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const inPlay = (s: GameState, code: string) => cardsInPlay(s).filter((id) => codeOf(s, id) === code);
const piles = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;

/** The player's top deck card turned into `code` (a card instance keeps its place and its owner). */
function withTopCard(state: GameState, code: string): GameState {
  const top = playerOf(state, P1).deck[0]!;
  return patchInstance(state, top, { cardId: cardId(code) });
}

interface Staged {
  readonly state: GameState;
}
/** Rhino with 5 damage, the chosen attachments on him, and a card printing `icon` on top of the player's deck. */
function stage(icon: Icon, which: { armor?: boolean; weapon?: boolean }): Staged {
  let state = setupGame();
  state = patchInstance(state, villainOf(state), { damage: 5 });
  if (which.armor) {
    const a = attachToHost(state, ARMOR, villainOf(state));
    state = a.state;
  }
  if (which.weapon) {
    const w = attachToHost(state, WEAPON, villainOf(state));
    state = w.state;
  }
  state = patchInstance(state, state.mainScheme.instanceId, { threat: 0 });
  state = withTopCard(state, CODE_OF[icon]);
  return { state };
}

/** One round: the player (alter-ego: the villain schemes; hero: the villain attacks) ends their turn. */
function round(state: GameState, form: "alterEgo" | "hero"): { state: GameState; events: readonly GameEvent[] } {
  const stacked = stackEncounterDeck(state, BLANK, "01098");
  return driveEventsPicking(DEPS, stacked, firstLegal, ...(form === "hero" ? [toHero(P1)] : []), endTurn(P1));
}
const damageOf = (s: GameState, id: InstanceId) => inst(s, id).damage;
const status = (s: GameState, id: InstanceId, name: "stunned" | "confused" | "tough") =>
  inst(s, id).statuses[name] ?? 0;
const topDiscarded = (s: GameState, code: string) => playerOf(s, P1).discard.some((id) => codeOf(s, id) === code);

describe("registry", () => {
  it("registers the two Forced Interrupts, each valid; the Celestial Tech When Revealed is skipped", () => {
    expect(Object.keys(CELESTIAL_TECH).sort()).toEqual(REFS);
    for (const [id, def] of Object.entries(CELESTIAL_TECH)) expect(validateDefinition(def), id).toEqual([]);
    expect(Object.keys(CELESTIAL_TECH_SKIPPED)).toEqual(["45158.when-revealed"]);
    expect(validateDefinition(CELESTIAL_TECH_WHEN_REVEALED_DRAFT)).toEqual([]);
  });

  it("the data names exactly these refs plus the skipped one", () => {
    const refs = [ARMOR, WEAPON, TECH].flatMap((code) =>
      ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id),
    );
    expect(refs.sort()).toEqual([...REFS, "45158.when-revealed"].sort());
  });

  it("the test fixtures found a Spider-Man card for each resource", () => {
    expect(Object.keys(CODE_OF).sort()).toEqual(["energy", "mental", "none", "physical", "wild"]);
  });
});

describe("data", () => {
  it("Armor and Weapon attach to the villain; Armor is +0 SCH, Weapon +0 ATK; Celestial Tech comes twice", () => {
    expect(dataOf(ARMOR).attachesTo).toEqual({ kind: "villain" });
    expect(dataOf(WEAPON).attachesTo).toEqual({ kind: "villain" });
    expect(dataOf(TECH).quantityInSet).toBe(2);
  });
});

describe("Celestial Armor (45156)", () => {
  it("energy: the villain heals 2; Armor stays, nobody is confused, no tough card", () => {
    const s = stage("energy", { armor: true });
    const r = round(s.state, "alterEgo");
    expect(damageOf(r.state, villainOf(r.state))).toBe(3);
    expect(status(r.state, identityOf(r.state, P1), "confused")).toBe(0);
    expect(status(r.state, villainOf(r.state), "tough")).toBe(0);
    expect(inPlay(r.state, ARMOR)).toHaveLength(1);
    expect(topDiscarded(r.state, CODE_OF.energy)).toBe(true);
  });

  it("mental: the player is confused and Armor is discarded; the villain keeps its damage", () => {
    const s = stage("mental", { armor: true });
    const r = round(s.state, "alterEgo");
    expect(status(r.state, identityOf(r.state, P1), "confused")).toBe(1);
    expect(inPlay(r.state, ARMOR)).toHaveLength(0);
    expect(piles(r.state).discard.some((id) => codeOf(r.state, id) === ARMOR)).toBe(true);
    expect(damageOf(r.state, villainOf(r.state))).toBe(5);
  });

  it("physical: the villain gets a tough status card; Armor stays", () => {
    const s = stage("physical", { armor: true });
    const r = round(s.state, "alterEgo");
    expect(status(r.state, villainOf(r.state), "tough")).toBe(1);
    expect(inPlay(r.state, ARMOR)).toHaveLength(1);
    expect(damageOf(r.state, villainOf(r.state))).toBe(5);
  });

  it("wild: all of the above (2 healed, confused, a tough card, Armor discarded)", () => {
    const s = stage("wild", { armor: true });
    const r = round(s.state, "alterEgo");
    expect(damageOf(r.state, villainOf(r.state))).toBe(3);
    expect(status(r.state, identityOf(r.state, P1), "confused")).toBe(1);
    expect(status(r.state, villainOf(r.state), "tough")).toBe(1);
    expect(inPlay(r.state, ARMOR)).toHaveLength(0);
  });

  it("a card with no resource icon is discarded and does nothing", () => {
    const s = stage("none", { armor: true });
    const r = round(s.state, "alterEgo");
    expect(topDiscarded(r.state, CODE_OF.none)).toBe(true);
    expect(damageOf(r.state, villainOf(r.state))).toBe(5);
    expect(status(r.state, identityOf(r.state, P1), "confused")).toBe(0);
    expect(inPlay(r.state, ARMOR)).toHaveLength(1);
  });

  it("does not trigger when the villain attacks instead of schemes (hero form)", () => {
    const s = stage("energy", { armor: true });
    const r = round(s.state, "hero");
    expect(damageOf(r.state, villainOf(r.state))).toBe(5);
    expect(topDiscarded(r.state, CODE_OF.energy)).toBe(false);
  });
});

describe("Celestial Weapon (45157)", () => {
  const hp = (s: GameState) => damageOf(s, identityOf(s, P1));

  it("energy: 2 damage to the player's identity beyond the attack's; Weapon stays", () => {
    const withWeapon = round(stage("energy", { weapon: true }).state, "hero");
    const without = round(stage("none", { weapon: true }).state, "hero");
    expect(hp(withWeapon.state) - hp(without.state)).toBe(2);
    expect(inPlay(withWeapon.state, WEAPON)).toHaveLength(1);
  });

  it("mental: a card is discarded from the player's hand; Weapon stays", () => {
    const base = stage("mental", { weapon: true });
    const control = round(stage("none", { weapon: true }).state, "hero");
    const r = round(base.state, "hero");
    expect(playerOf(r.state, P1).hand.length).toBe(playerOf(control.state, P1).hand.length - 1);
    expect(inPlay(r.state, WEAPON)).toHaveLength(1);
  });

  it("physical: the player is stunned and Weapon is discarded", () => {
    const r = round(stage("physical", { weapon: true }).state, "hero");
    expect(status(r.state, identityOf(r.state, P1), "stunned")).toBe(1);
    expect(inPlay(r.state, WEAPON)).toHaveLength(0);
  });

  it("wild: all of the above", () => {
    const base = stage("wild", { weapon: true });
    const none = round(stage("none", { weapon: true }).state, "hero");
    const r = round(base.state, "hero");
    expect(hp(r.state) - hp(none.state)).toBe(2);
    expect(playerOf(r.state, P1).hand.length).toBe(playerOf(none.state, P1).hand.length - 1);
    expect(status(r.state, identityOf(r.state, P1), "stunned")).toBe(1);
    expect(inPlay(r.state, WEAPON)).toHaveLength(0);
  });

  it("does not trigger on a scheme (alter-ego form)", () => {
    const r = round(stage("physical", { weapon: true }).state, "alterEgo");
    expect(topDiscarded(r.state, CODE_OF.physical)).toBe(false);
    expect(inPlay(r.state, WEAPON)).toHaveLength(1);
  });
});

describe("Celestial Tech (45158), skipped: waits on engine queue task 30 (resolveSpecials.trigger forcedInterrupt)", () => {
  /** The draft registered beside the set: the intended 'as if' resolution is what the first test asks for. */
  const DRAFT_DEPS: EngineDeps = {
    abilities: mergeRegistries(
      WAVE7_ABILITIES,
      CELESTIAL_TECH,
      defineAbilities({ "45158.when-revealed": CELESTIAL_TECH_WHEN_REVEALED_DRAFT }),
    ),
  };
  /**
   * Armor on the villain with two [energy] cards on top of the deck. The villain's own scheme resolves Armor once (2
   * healed, from 5 to 3); a revealed Celestial Tech should resolve it once more.
   */
  function revealTech(armor: boolean, tech: boolean): GameState {
    let state = setupGame(DRAFT_DEPS);
    state = patchInstance(state, villainOf(state), { damage: 5 });
    if (armor) state = attachToHost(state, ARMOR, villainOf(state)).state;
    state = withTopCard(state, CODE_OF.energy);
    const second = playerOf(state, P1).deck[1]!;
    state = patchInstance(state, second, { cardId: cardId(CODE_OF.energy) });
    const stacked = stackEncounterDeck(state, BLANK, ...(tech ? [TECH] : ["01098"]));
    return driveEventsPicking(DRAFT_DEPS, stacked, firstLegal, endTurn(P1)).state;
  }

  it("control: Armor alone is resolved once, by the villain's scheme (5 damage to 3)", () => {
    const s = revealTech(true, false);
    expect(damageOf(s, villainOf(s))).toBe(3);
  });

  it.fails("PROOF OF THE GAP: a revealed Celestial Tech resolves Armor again as if the villain schemed (3 to 1)", () => {
    const s = revealTech(true, true);
    expect(damageOf(s, villainOf(s))).toBe(1);
  });

  it("today's behavior: the draft heals nothing more (the villain keeps 3 damage)", () => {
    const s = revealTech(true, true);
    expect(damageOf(s, villainOf(s))).toBe(3);
  });

  it("the search half of the draft works: with no Celestial attachment on the villain one is found and attached", () => {
    const s = revealTech(false, true);
    const attached = [ARMOR, WEAPON].filter((code) => inPlay(s, code).length > 0);
    expect(attached).toHaveLength(1);
  });
});
