import { CORE_CARDS, encounterSetId, trait } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  createGame,
  hasKeyword,
  keywordsOf,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  settle,
  stackEncounterDeck,
  use,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../../testing/staging.js";
import {
  BLACK_CAT,
  BLANK,
  CAPTAIN_MARVEL,
  FILLER_A,
  ONE_ICON,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  heroAttacks,
  heroForm,
  heroThwarts,
  inDiscard,
  inPlayCard,
  schemesBy,
} from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS, stagedInPlay } from "../../testing.js";
import { SYNTHEZOID_MODULAR_TASKMASTER, SYNTHEZOID_MODULAR_TASKMASTER_SKIPPED } from "./taskmaster.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Taskmaster modular set (57022 Taskmaster, 57023 Taskmaster's Sword, 57024 Taskmaster's Shield, 57025 Mimicked
 * Move, 57026 Taskmaster's Academy), docs/phase7-synthezoid.md section 8.3, M9, M12 and M13. Tested in Core's Rhino
 * scenario against the Core Spider-Man starter deck with the set's cards added to the encounter deck by hand.
 */
const TASKMASTER = "57022";
const SWORD = "57023";
const SHIELD = "57024";
const MIMIC = "57025";
const ACADEMY = "57026";
const SET = [TASKMASTER, SWORD, SHIELD, MIMIC, ACADEMY];
const RHINO = "01094";
const REFS = [
  "57022.when-revealed",
  "57023.taskmasters-sword-constant",
  "57023.taskmasters-sword-action",
  "57024.taskmasters-shield-forced-interrupt",
  "57024.taskmasters-shield-action",
  "57025.when-revealed",
  "57025.boost",
  "57026.when-defeated",
];
// Core cards of the Spider-Man deck with one printed resource of a type, to pay a Hero Action with.
const ENERGY = "01002";
const ENERGY_2 = "01006";
const PHYSICAL = "01003";
const MENTAL = "01004";

const dataOf = (code: string) =>
  WAVE10_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;

function taskmasterGame(seats: readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[] = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players: seats,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...WAVE10_CARDS],
  } as never);
  const copies = WAVE10_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("taskmaster_modular")),
  ).flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return heroForm(
    settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS),
    ...seats.map((_, i) => [P1, P2][i]!),
  );
}
const alterEgoGame = (): GameState => {
  const s = taskmasterGame();
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const } })),
  } as GameState;
};

function villainPhase(state: GameState, stack: readonly string[]) {
  return driveEventsPicking(WAVE10_DEPS, stackEncounterDeck(state, ...stack), firstLegal, endTurn(P1));
}

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
/** Taskmaster put straight into play engaged with P1 (surgery, no reveal). */
function withTaskmaster(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const taken = takeFromEncounter(state, TASKMASTER);
  const id = taken.id;
  const placed: GameState = {
    ...taken.state,
    players: taken.state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
  };
  return { id, state: patchInstance(placed, id, { faceup: true, engagedWith: P1, controllerId: null }) };
}
function attachTo(state: GameState, code: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const taken = takeFromEncounter(state, code);
  const attached = patchInstance(taken.state, taken.id, { faceup: true, attachedTo: host });
  return {
    id: taken.id,
    state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, taken.id] }),
  };
}
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const attachedCodes = (s: GameState, host: InstanceId) => inst(s, host).attachments.map((a) => codeOf(s, a));
const hero = (s: GameState) => identityOf(s, P1);
const toughOn = (s: GameState, id: InstanceId) => inst(s, id).statuses.tough;
const withTough = (s: GameState, id: InstanceId): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, tough: 1 } });
const useCommand = (state: GameState, card: InstanceId, ref: string, codes: readonly string[], player = P1) => {
  const given = moveToHand(state, player, ...codes);
  const command = use(
    player,
    card,
    ref,
    given.ids.map((fromHand) => ({ fromHand })),
  );
  return { state: given.state, command };
};
const heroAction = (state: GameState, card: InstanceId, ref: string, ...codes: readonly string[]) => {
  const given = useCommand(state, card, ref, codes);
  return driveEventsPicking(WAVE10_DEPS, given.state, firstLegal, given.command);
};
const heroActionRefused = (state: GameState, card: InstanceId, ref: string, ...codes: readonly string[]) => {
  const given = useCommand(state, card, ref, codes);
  return applyCommand(given.state, given.command, WAVE10_DEPS);
};

describe("registry", () => {
  it("registers the eight refs of the five cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(SYNTHEZOID_MODULAR_TASKMASTER).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(SYNTHEZOID_MODULAR_TASKMASTER))
      expect(validateDefinition(def), id).toEqual([]);
    expect(SYNTHEZOID_MODULAR_TASKMASTER_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the five cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("carries the printed timing of each ability", () => {
    const r = SYNTHEZOID_MODULAR_TASKMASTER;
    expect(r["57022.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(r["57023.taskmasters-sword-constant"]!.trigger).toMatchObject({ kind: "constant" });
    expect(r["57023.taskmasters-sword-action"]!.trigger).toMatchObject({ kind: "action" });
    expect(r["57024.taskmasters-shield-action"]!.trigger).toMatchObject({ kind: "action" });
    expect(r["57025.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(r["57025.boost"]!.trigger).toMatchObject({ kind: "boost" });
    expect(r["57026.when-defeated"]!.trigger).toMatchObject({ kind: "whenDefeated" });
  });
});

describe("Taskmaster (57022)", () => {
  it("is data: an Elite Thunderbolt unique minion, ATK 1, SCH 1, 6 hit points, Retaliate 1, Toughness, Villainous", () => {
    const card = dataOf(TASKMASTER);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([
      "minion",
      1,
      1,
      6,
      3,
      true,
    ]);
    expect(card.traits).toEqual([trait("ELITE"), trait("THUNDERBOLT")]);
    expect(card.keywords).toEqual([{ name: "retaliate", value: 1 }, { name: "toughness" }, { name: "villainous" }]);
  });

  it("WHEN REVEALED (hero form): he engages the revealing player and attacks: ATK 1 + 1 boost icon = 2 damage", () => {
    const run = villainPhase(taskmasterGame(), [BLANK, TASKMASTER, ONE_ICON, FILLER_A]);
    expect(inst(run.state, inPlayCard(run.state, TASKMASTER)!).engagedWith).toBe(P1);
    expect(attacksBy(run.state, run.events, TASKMASTER)).toMatchObject([{ baseAtk: 1, boostIcons: 1, damageDealt: 2 }]);
    expect(schemesBy(run.state, run.events, TASKMASTER)).toEqual([]);
  });

  it("WHEN REVEALED (alter-ego form): he schemes against the revealing player: SCH 1 + 1 icon = 2 threat", () => {
    const run = villainPhase(alterEgoGame(), [BLANK, TASKMASTER, ONE_ICON, FILLER_A]);
    expect(schemesBy(run.state, run.events, TASKMASTER)).toMatchObject([
      { baseSch: 1, boostIcons: 1, threatPlaced: 2 },
    ]);
    expect(attacksBy(run.state, run.events, TASKMASTER)).toEqual([]);
  });

  it("has Retaliate 1, Toughness and Villainous: a basic attack on him is answered for 1, a tough status card stops the damage", () => {
    const placed = withTaskmaster(taskmasterGame());
    expect(keywordsOf(placed.state, placed.id, WAVE10_DEPS).map((k) => k.name)).toEqual(
      expect.arrayContaining(["retaliate", "toughness", "villainous"]),
    );
    expect(hasKeyword(placed.state, placed.id, "villainous", WAVE10_DEPS)).toBe(true);
    const control = heroAttacks(WAVE10_DEPS, placed.state, placed.id);
    expect(inst(control.state, placed.id).damage).toBe(2);
    expect(inst(control.state, hero(control.state)).damage).toBe(1);
    const run = heroAttacks(WAVE10_DEPS, withTough(placed.state, placed.id), placed.id);
    expect(toughOn(run.state, placed.id)).toBe(0);
    expect(inst(run.state, placed.id).damage).toBe(0);
  });
});

describe("Taskmaster's Sword (57023)", () => {
  it("is data: a Weapon attachment, +1 ATK, attaches to Taskmaster otherwise the enemy leader", () => {
    const card = dataOf(SWORD);
    expect([card.type, card.statModifiers, card.boostIcons, card.traits]).toEqual([
      "attachment",
      { atk: 1 },
      1,
      [trait("WEAPON")],
    ]);
    expect(card.attachesTo).toEqual({
      kind: "ifAble",
      preferred: { kind: "namedCard", name: "Taskmaster" },
      otherwise: { kind: "leader", of: "enemy" },
    });
  });

  it("REVEALED with Taskmaster in play it attaches to him; without him it attaches to the villain", () => {
    const placed = withTaskmaster(taskmasterGame());
    const withHim = villainPhase(placed.state, [BLANK, BLANK, SWORD]);
    expect(attachedCodes(withHim.state, placed.id)).toEqual([SWORD]);
    expect(attachedCodes(withHim.state, villainOf(withHim.state))).toEqual([]);
    const without = villainPhase(taskmasterGame(), [BLANK, SWORD, FILLER_A]);
    expect(attachedCodes(without.state, villainOf(without.state))).toEqual([SWORD]);
  });

  it("CONSTANT: the attached enemy's attacks gain piercing (control: without it a tough hero takes no damage)", () => {
    const start = taskmasterGame();
    const tough = withTough(start, hero(start));
    const control = villainPhase(tough, [BLANK, FILLER_A]);
    expect(toughOn(control.state, hero(control.state))).toBe(0);
    expect(inst(control.state, hero(control.state)).damage).toBe(0);
    const { state } = attachTo(tough, SWORD, villainOf(tough));
    const run = villainPhase(state, [BLANK, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 3, damageDealt: 3 }]);
    expect(toughOn(run.state, hero(run.state))).toBe(0);
    expect(inst(run.state, hero(run.state)).damage).toBe(3);
  });

  it("CONSTANT: only the attached enemy gains piercing (Sword on a stunned Rhino; Taskmaster cannot hurt a tough hero)", () => {
    const placed = withTaskmaster(taskmasterGame());
    const stunned = patchInstance(placed.state, villainOf(placed.state), {
      statuses: { ...inst(placed.state, villainOf(placed.state)).statuses, stunned: 1 },
    });
    const { state } = attachTo(withTough(stunned, hero(stunned)), SWORD, villainOf(stunned));
    const run = villainPhase(state, [BLANK, BLANK, FILLER_A]);
    expect(attacksBy(run.state, run.events, TASKMASTER)).toMatchObject([{ baseAtk: 1 }]);
    expect(inst(run.state, hero(run.state)).damage).toBe(0);
  });

  it("CONSTANT: on Taskmaster the Sword gives his own attack piercing: ATK 1 + 1 lands 2 on a tough hero", () => {
    const placed = withTaskmaster(taskmasterGame());
    const stunned = patchInstance(placed.state, villainOf(placed.state), {
      statuses: { ...inst(placed.state, villainOf(placed.state)).statuses, stunned: 1 },
    });
    const { state } = attachTo(withTough(stunned, hero(stunned)), SWORD, placed.id);
    const run = villainPhase(state, [BLANK, BLANK, FILLER_A]);
    expect(attacksBy(run.state, run.events, TASKMASTER)).toMatchObject([{ baseAtk: 2 }]);
    expect(inst(run.state, hero(run.state)).damage).toBe(2);
    expect(toughOn(run.state, hero(run.state))).toBe(0);
  });

  it("HERO ACTION: spend a mental and a physical resource, discard this card; two other resources do not pay", () => {
    const placed = withTaskmaster(taskmasterGame());
    const { state, id } = attachTo(placed.state, SWORD, placed.id);
    const refused = heroActionRefused(state, id, "57023.taskmasters-sword-action", ENERGY, ENERGY_2);
    expect(refused.ok).toBe(false);
    const run = heroAction(state, id, "57023.taskmasters-sword-action", MENTAL, PHYSICAL);
    expect(inPlayCard(run.state, SWORD)).toBeUndefined();
    expect(inDiscard(run.state, SWORD)).toEqual([id]);
    expect(attachedCodes(run.state, placed.id)).toEqual([]);
  });
});

/** P1's ready Black Cat (ATK 1) basic-attacks `target`: a one-damage instance. */
const allyAttack = (state: GameState, target: InstanceId) => {
  const staged = stagedInPlay(state, BLACK_CAT);
  return driveEventsPicking(WAVE10_DEPS, staged.state, firstLegal, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: staged.id,
    targetInstanceId: target,
  });
};

describe("Taskmaster's Shield (57024)", () => {
  it("is a Forced Interrupt, not a constant", () => {
    expect(SYNTHEZOID_MODULAR_TASKMASTER["57024.taskmasters-shield-forced-interrupt"]!.trigger).toMatchObject({
      kind: "interrupt",
      forced: true,
    });
  });

  it("FORCED INTERRUPT: a tough status card is used first (RRG Appendix III), so a 1-damage hit only discards it", () => {
    const placed = withTaskmaster(taskmasterGame());
    const control = allyAttack(placed.state, placed.id);
    expect(inst(control.state, placed.id).damage).toBe(1);
    const { state } = attachTo(withTough(placed.state, placed.id), SHIELD, placed.id);
    const run = allyAttack(state, placed.id);
    expect(toughOn(run.state, placed.id)).toBe(0);
    expect(inst(run.state, placed.id).damage).toBe(0);
    expect(attachedCodes(run.state, placed.id)).toEqual([SHIELD]);
  });

  it("FORCED INTERRUPT: without a tough status card a 1-damage hit is reduced to nothing", () => {
    const placed = withTaskmaster(taskmasterGame());
    const { state } = attachTo(placed.state, SHIELD, placed.id);
    const run = allyAttack(state, placed.id);
    expect(inst(run.state, placed.id).damage).toBe(0);
  });

  it("is data: an Armor attachment, +1 SCH, attaches to Taskmaster otherwise the enemy leader", () => {
    const card = dataOf(SHIELD);
    expect([card.type, card.statModifiers, card.traits]).toEqual(["attachment", { sch: 1 }, [trait("ARMOR")]]);
    expect(card.attachesTo).toEqual({
      kind: "ifAble",
      preferred: { kind: "namedCard", name: "Taskmaster" },
      otherwise: { kind: "leader", of: "enemy" },
    });
  });

  it("REVEALED with Taskmaster in play it attaches to him; without him it attaches to the villain", () => {
    const placed = withTaskmaster(taskmasterGame());
    const withHim = villainPhase(placed.state, [BLANK, BLANK, SHIELD]);
    expect(attachedCodes(withHim.state, placed.id)).toEqual([SHIELD]);
    const without = villainPhase(taskmasterGame(), [BLANK, SHIELD, FILLER_A]);
    expect(attachedCodes(without.state, villainOf(without.state))).toEqual([SHIELD]);
  });

  it("FORCED INTERRUPT: damage to the attached Taskmaster is reduced by 1 (control: 2 without it)", () => {
    const placed = withTaskmaster(taskmasterGame());
    const control = heroAttacks(WAVE10_DEPS, placed.state, placed.id);
    expect(inst(control.state, placed.id).damage).toBe(2);
    const { state } = attachTo(placed.state, SHIELD, placed.id);
    const run = heroAttacks(WAVE10_DEPS, state, placed.id);
    expect(inst(run.state, placed.id).damage).toBe(1);
  });

  it("FORCED INTERRUPT: on the villain it reduces the villain's damage, and only the attached character's", () => {
    const placed = withTaskmaster(taskmasterGame());
    const { state } = attachTo(placed.state, SHIELD, villainOf(placed.state));
    const villain = heroAttacks(WAVE10_DEPS, state, villainOf(state));
    const controlVillain = heroAttacks(WAVE10_DEPS, placed.state, villainOf(placed.state));
    const controlDamage = inst(controlVillain.state, villainOf(state)).damage;
    expect(controlDamage).toBeGreaterThan(0);
    expect(inst(villain.state, villainOf(state)).damage).toBe(controlDamage - 1);
    const other = heroAttacks(WAVE10_DEPS, state, placed.id);
    expect(inst(other.state, placed.id).damage).toBe(2);
  });

  it("HERO ACTION: spend a mental and a physical resource, discard this card; an energy and a physical do not pay", () => {
    const placed = withTaskmaster(taskmasterGame());
    const { state, id } = attachTo(placed.state, SHIELD, placed.id);
    expect(heroActionRefused(state, id, "57024.taskmasters-shield-action", ENERGY, PHYSICAL).ok).toBe(false);
    const run = heroAction(state, id, "57024.taskmasters-shield-action", MENTAL, PHYSICAL);
    expect(inDiscard(run.state, SHIELD)).toEqual([id]);
    expect(attachedCodes(run.state, placed.id)).toEqual([]);
  });
});

describe("Taskmaster's Sword, two players", () => {
  it("HERO ACTION: P2 may use it on the Sword attached to P1's Taskmaster, paying from P2's hand", () => {
    const two = taskmasterGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const placed = withTaskmaster(two);
    const { state, id } = attachTo(placed.state, SWORD, placed.id);
    const given = useCommand(state, id, "57023.taskmasters-sword-action", ["01089", "01090"], P2);
    const run = driveEventsPicking(WAVE10_DEPS, given.state, firstLegal, given.command);
    expect(inDiscard(run.state, SWORD)).toEqual([id]);
    expect(attachedCodes(run.state, placed.id)).toEqual([]);
  });
});

describe("Mimicked Move (57025)", () => {
  it("is data: a treachery with 1 boost icon and a star", () => {
    const card = dataOf(MIMIC);
    expect([card.type, card.boostIcons, card.starIcon, card.keywords]).toEqual(["treachery", 1, true, []]);
  });

  it("WHEN REVEALED without Taskmaster: the villain gets a tough status card and a facedown boost card", () => {
    const start = taskmasterGame();
    expect(toughOn(start, villainOf(start))).toBe(0);
    const run = villainPhase(start, [BLANK, MIMIC, FILLER_A]);
    expect(toughOn(run.state, villainOf(run.state))).toBe(1);
    expect(inst(run.state, villainOf(run.state)).boostCards.map((b) => codeOf(run.state, b))).toEqual([FILLER_A]);
    expect(inDiscard(run.state, MIMIC)).toHaveLength(1);
  });

  it("WHEN REVEALED with Taskmaster in play: co-op has no leader of yours to attack, so Otherwise resolves anyway", () => {
    const placed = withTaskmaster(taskmasterGame());
    const run = villainPhase(placed.state, [BLANK, BLANK, MIMIC, FILLER_A]);
    // Only his one ordinary activation: Mimicked Move added no attack.
    expect(attacksBy(run.state, run.events, TASKMASTER)).toHaveLength(1);
    expect(toughOn(run.state, villainOf(run.state))).toBe(1);
    expect(inst(run.state, villainOf(run.state)).boostCards.map((b) => codeOf(run.state, b))).toEqual([FILLER_A]);
  });

  it("BOOST: the activating enemy gets an additional boost card (Rhino turns two: 1 icon from this card, 1 from the next)", () => {
    const run = villainPhase(taskmasterGame(), [MIMIC, ONE_ICON, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 2, damageDealt: 4 }]);
  });
});

describe("Taskmaster's Academy (57026)", () => {
  it("is data: a side scheme with 3 threat (none per player), an amplify icon, 2 boost icons and Hinder 1 per hero", () => {
    const card = dataOf(ACADEMY);
    expect([card.type, card.startingThreat, card.amplifyIcons, card.boostIcons, card.keywords]).toEqual([
      "side_scheme",
      { base: 3, perPlayer: 0 },
      1,
      2,
      [{ name: "hinder", value: 0, perPlayer: 1 }],
    ]);
  });

  it("WHEN DEFEATED: the villain gets a tough status card and a facedown boost card", () => {
    const placed = encounterCardInVillainArea(taskmasterGame(), ACADEMY, 1);
    const run = heroThwarts(WAVE10_DEPS, placed.state, placed.id);
    expect(inDiscard(run.state, ACADEMY)).toHaveLength(1);
    expect(toughOn(run.state, villainOf(run.state))).toBe(1);
    expect(inst(run.state, villainOf(run.state)).boostCards).toHaveLength(1);
  });

  it("does nothing while it stands (control)", () => {
    const placed = encounterCardInVillainArea(taskmasterGame(), ACADEMY, 3);
    const run = heroThwarts(WAVE10_DEPS, placed.state, placed.id);
    expect(inPlayCard(run.state, ACADEMY)).toBeDefined();
    expect(toughOn(run.state, villainOf(run.state))).toBe(0);
    expect(inst(run.state, villainOf(run.state)).boostCards).toHaveLength(0);
  });
});
