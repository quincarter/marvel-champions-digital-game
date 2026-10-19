import { PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  characterProfile,
  createGame,
  hasKeyword,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario, encounterCardsOf } from "../../../core/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_VILLAINS_HAMMERHEAD as REGISTRY, FNE_VILLAINS_HAMMERHEAD_SKIPPED as SKIPPED } from "./hammerhead.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * The Hammerhead villain set (60086-60088 Hammerhead, 60089 Energy Gatling Gun, 60090 Hardheaded, 60091 Chameleon,
 * 60092 Maggia Enforcers, 60093 Maggia Underboss, 60094 Consolidate Power, 60095 Power Struggle, 60096 "Head First!"),
 * docs/phase7-wave11-scenarios.md section S6. Each game is Core's Spider-Man (Justice) in hero form against Hammerhead
 * as the villain (stage chosen per test, ATK 1 / 2 / 3), with the Hammerhead set added to the Core encounter deck, so
 * Advance (01186) and Assault (01187), cards with no boost icon and no boost ability, are the blank fillers. The hero
 * takes the hits undefended ("decline").
 */
const HAMMERHEAD = ["60086"];
const GUN = "60089";
const HARDHEADED = "60090";
const CHAMELEON = "60091";
const ENFORCERS = "60092";
const UNDERBOSS = "60093";
const CONSOLIDATE = "60094";
const STRUGGLE = "60095";
const HEAD_FIRST = "60096";
const ADVANCE = "01186";
const ASSAULT = "01187";
const REFS = [
  "60086.hammerhead-forced-response",
  "60087.hammerhead-forced-response",
  "60088.hammerhead-forced-response",
  "60089.energy-gatling-gun-forced-response",
  "60090.hardheaded-constant",
  "60090.hardheaded-action",
  "60090.boost",
  "60091.chameleon-constant",
  "60091.when-revealed",
  "60092.maggia-enforcers-constant",
  "60093.maggia-underboss-forced-interrupt",
  "60094.consolidate-power-forced-response",
  "60095.when-revealed",
  "60096.when-revealed-alter-ego",
  "60096.when-revealed-hero",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState): InstanceId => identityOf(s);
const damageOf = (s: GameState, id: InstanceId = hero(s)): number => inst(s, id).damage;
const stunnedOf = (s: GameState, id: InstanceId = hero(s)): number => inst(s, id).statuses.stunned;
/** Black Cat (01002) in P1 play area as an ally: the staging helper puts upgrades there, so her home is set here. */
function allyInPlay(state: GameState) {
  const placed = stagedInPlay(state, "01002");
  return {
    id: placed.id,
    state: patchInstance(placed.state, placed.id, { home: { kind: "playArea", playerId: P1 } } as never),
  };
}
const stunned = (s: GameState, id: InstanceId = hero(s)): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, stunned: 1 } });
/** The villain stunned: his activation does nothing, so he neither attacks nor draws a boost card. */
const villainStunned = (s: GameState): GameState => stunned(s, villainOf(s));
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, WAVE11_DEPS)!;
const encounterDiscard = (s: GameState): string[] => activeEncounterDeck(s).discard.map((i) => codeOf(s, i));
const idOf = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;
const attacksBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  ofType(events, "attackResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);

/** Core Spider-Man in hero form against Hammerhead at `stage` (1 to 3), the Hammerhead set in the encounter deck. */
function newGame(stage = 1): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    {
      ...base,
      villainCardId: cardId("60086"),
      villainSide: "A",
      villainStartStageIndex: stage - 1,
      villainLastStageIndex: 2,
      encounterDeck: [...base.encounterDeck, ...encounterCardsOf(["hammerhead"], PLAYABLE_CARDS)],
    },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  return withForm(settled, { heroForm: 0 });
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
const BOOSTS = [ADVANCE, ASSAULT, ADVANCE, ASSAULT];
/**
 * P1 ends the turn and the villain phase runs on the encounter deck stacked with `boosts` blank boost cards (Advance and
 * Assault print no boost icon and no boost ability; their When Revealed never runs as a boost), then `dealt`, a card for
 * P1. The default dealt card, Maggia Enforcers, is a minion with no When Revealed, so it adds no activation or effect.
 */
function villainPhase(
  state: GameState,
  boosts: number,
  dealt: readonly string[] = [ENFORCERS],
  pick: Picker = declines,
) {
  const stack = [...BOOSTS.slice(0, boosts), ...dealt];
  return driveEventsPicking(WAVE11_DEPS, stackEncounterDeck(state, ...stack), pick, endTurn(P1));
}

/** Surgery: the first deck/discard copy of `code` taken out of the encounter deck. */
function takeFromEncounter(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck`);
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
/** Surgery: the first copy of the minion `code` engaged with P1, in play, no reveal. */
function engaged(state: GameState, code: string, slot: string): { state: GameState; id: InstanceId } {
  const taken = takeFromEncounter(state, code);
  return { state: engageMinion(taken.state, code, slot), id: slot as InstanceId };
}
/** Surgery: the first copy of `code` attached to the villain, faceup. */
function attachedToVillain(state: GameState, code: string) {
  const taken = takeFromEncounter(state, code);
  const villain = villainOf(state);
  const placed = patchInstance(taken.state, taken.id, { faceup: true, attachedTo: villain, controllerId: null });
  return {
    id: taken.id,
    state: patchInstance(placed, villain, { attachments: [...inst(placed, villain).attachments, taken.id] }),
  };
}

describe("registry", () => {
  it("registers every printed ref of the nine cards; nothing is skipped", () => {
    const printed = [
      ...HAMMERHEAD,
      GUN,
      HARDHEADED,
      CHAMELEON,
      ENFORCERS,
      UNDERBOSS,
      CONSOLIDATE,
      STRUGGLE,
      HEAD_FIRST,
    ].flatMap((c) => abilityRefIds(data(c)));
    expect([...printed].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
  it("carries the printed timing", () => {
    expect(REGISTRY["60086.hammerhead-forced-response"]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY["60090.hardheaded-action"]!.trigger).toMatchObject({ kind: "action" });
    expect(REGISTRY["60093.maggia-underboss-forced-interrupt"]!.trigger).toMatchObject({
      kind: "interrupt",
      forced: true,
    });
    expect(REGISTRY["60094.consolidate-power-forced-response"]!.trigger).toMatchObject({
      kind: "response",
      forced: true,
    });
    expect(REGISTRY["60096.when-revealed-hero"]!.trigger).toMatchObject({ kind: "whenRevealed" });
  });
});

describe("Hammerhead 60086 / 60087 / 60088", () => {
  it("is the villain at the chosen stage (ATK 1, 2, 3)", () => {
    for (const [stage, atk] of [
      [1, 1],
      [2, 2],
      [3, 3],
    ] as const) {
      const s = newGame(stage);
      expect(codeOf(s, villainOf(s))).toBe("60086");
      expect(profile(s, villainOf(s)).atk).toBe(atk);
    }
  });

  it("60086.hammerhead-forced-response: damaging an unstunned hero stuns it and deals nothing more", () => {
    const run = villainPhase(newGame(1), 1);
    expect(attacksBy(run.state, run.events, "60086")).toMatchObject([{ damageDealt: 1 }]);
    expect(damageOf(run.state)).toBe(1);
    expect(stunnedOf(run.state)).toBe(1);
  });

  it("60086.hammerhead-forced-response: a hero already stunned takes 1 more damage", () => {
    const run = villainPhase(stunned(newGame(1)), 1);
    expect(damageOf(run.state)).toBe(1 + 1);
    expect(stunnedOf(run.state)).toBe(1);
  });

  it("60087.hammerhead-forced-response: stage 2 deals 1 more (ATK 2 + 1)", () => {
    const run = villainPhase(stunned(newGame(2)), 1);
    expect(damageOf(run.state)).toBe(2 + 1);
  });

  it("60088.hammerhead-forced-response: stage 3 deals 2 more (ATK 3 + 2)", () => {
    const run = villainPhase(stunned(newGame(3)), 1);
    expect(damageOf(run.state)).toBe(3 + 2);
  });

  it("a tough status card absorbs the damage: nothing was damaged, so no one is stunned", () => {
    const s = newGame(1);
    const toughHero = patchInstance(s, hero(s), { statuses: { ...inst(s, hero(s)).statuses, tough: 1 } });
    const run = villainPhase(toughHero, 1);
    expect(damageOf(run.state)).toBe(0);
    expect(stunnedOf(run.state)).toBe(0);
  });

  it("a defending ally is the attacked character: it is stunned and the hero is not", () => {
    const placed = allyInPlay(newGame(1));
    const ally = placed.id;
    const defends: Picker = (s) =>
      s.pendingChoice!.prompt.kind === "declareDefender" ? [ally as string] : firstLegal(s);
    const run = villainPhase(placed.state, 1, [ENFORCERS], defends);
    expect(stunnedOf(run.state, ally)).toBe(1);
    expect(stunnedOf(run.state)).toBe(0);
  });
});

describe("Energy Gatling Gun 60089", () => {
  it("is data: an attachment for Hammerhead with +1 ATK", () => {
    expect([data(GUN).type, data(GUN).statModifiers]).toEqual(["attachment", { atk: 1 }]);
  });

  it("60089.energy-gatling-gun-forced-response: discarded after his attack, he attacks the same character again", () => {
    const { state, id } = attachedToVillain(newGame(1), GUN);
    expect(profile(state, villainOf(state)).atk).toBe(2);
    const run = villainPhase(state, 2, [ADVANCE]);
    expect(attacksBy(run.state, run.events, "60086")).toHaveLength(2);
    expect(encounterDiscard(run.state)).toContain(GUN);
    expect(inst(run.state, id).attachedTo).toBeNull();
    // First attack: ATK 1 + 1 for the gun = 2, stunning the hero. Second, the gun gone: ATK 1, then 1 more (stunned).
    expect(damageOf(run.state)).toBe(2 + 1 + 1);
  });

  /** A defending Black Cat (2 hit points) takes the gun's first attack (ATK 2): the ally defends whenever she can. */
  const allyDefends =
    (ally: InstanceId): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "declareDefender") return firstLegal(s);
      return choice.options.some((o) => (o.optionId as string) === (ally as string)) ? [ally as string] : ["decline"];
    };

  // `boosts`: one per attack expected (a second boost card left in the deck is dealt instead, and Assault attacks).
  const gunVsAlly = (statuses: { stunned: number; confused: number; tough: number }, damage: number, boosts = 2) => {
    const gun = attachedToVillain(newGame(1), GUN);
    const placed = allyInPlay(gun.state);
    const staged = patchInstance(placed.state, placed.id, { damage, statuses });
    const run = villainPhase(staged, boosts, [ADVANCE], allyDefends(placed.id));
    return { run, gun, ally: placed.id };
  };

  it("60089.energy-gatling-gun-forced-response: a defending ally that survives is attacked again and the gun is discarded", () => {
    // A tough status card absorbs the first attack (ATK 2), so she survives.
    const { run, gun, ally } = gunVsAlly({ stunned: 0, confused: 0, tough: 1 }, 0);
    expect(attacksBy(run.state, run.events, "60086").map((a) => a.targetInstanceId)).toEqual([ally, ally]);
    expect(inst(run.state, gun.id).attachedTo).toBeNull();
  });

  it("60089.energy-gatling-gun-forced-response: not used when the defending ally was defeated", () => {
    const { run, gun } = gunVsAlly({ stunned: 0, confused: 0, tough: 0 }, 1, 1);
    expect(attacksBy(run.state, run.events, "60086")).toHaveLength(1);
    expect(inst(run.state, gun.id).attachedTo).toBe(villainOf(run.state));
  });
});

describe("Hardheaded 60090", () => {
  it("60090.hardheaded-constant: the attached Hammerhead has stalwart (and +1 SCH); without it he does not", () => {
    const bare = newGame(1);
    expect(hasKeyword(bare, villainOf(bare), "stalwart", WAVE11_DEPS)).toBe(false);
    const { state } = attachedToVillain(bare, HARDHEADED);
    expect(hasKeyword(state, villainOf(state), "stalwart", WAVE11_DEPS)).toBe(true);
    expect(profile(state, villainOf(state)).sch).toBe(profile(bare, villainOf(bare)).sch + 1);
  });

  it("60090.hardheaded-action: spending one energy, one mental and one physical resource discards it", () => {
    const { state, id } = attachedToVillain(newGame(1), HARDHEADED);
    const icons = (code: string) => (PLAYABLE_CARDS.find((c) => c.id === cardId(code)) as any).resourceIcons ?? {};
    const mine = [...playerOf(state, P1).hand, ...playerOf(state, P1).deck].map((i) => codeOf(state, i));
    const only = (type: string) =>
      mine.find((c) => {
        const found = icons(c);
        return (found[type] ?? 0) === 1 && Object.entries(found).every(([k, n]) => k === type || !n);
      });
    const codes = ["energy", "mental", "physical"].map(only);
    expect(codes.every((c) => c !== undefined)).toBe(true);
    const given = moveToHand(state, P1, ...(codes as string[]));
    const run = driveEventsPicking(
      WAVE11_DEPS,
      given.state,
      firstLegal,
      use(
        P1,
        id,
        "60090.hardheaded-action",
        given.ids.map((fromHand) => ({ fromHand })),
      ),
    );
    expect(encounterDiscard(run.state)).toContain(HARDHEADED);
    expect(inst(run.state, id).attachedTo).toBeNull();
  });

  it("60090.boost: turned up as a boost card, the activating enemy gets a tough status card", () => {
    const run = villainPhase(newGame(1), 0, [HARDHEADED, ENFORCERS]);
    expect(inst(run.state, villainOf(run.state)).statuses.tough).toBe(1);
    expect(attacksBy(run.state, run.events, "60086")).toMatchObject([{ boostIcons: 1 }]);
  });
});

describe("Chameleon 60091", () => {
  it("60091.chameleon-constant: +X SCH, X the highest THW among the characters in play", () => {
    const { state, id } = engaged(newGame(1), CHAMELEON, "cham");
    const heroThw = profile(state, hero(state)).thw;
    expect(heroThw).toBeGreaterThan(0);
    expect(profile(state, id).sch).toBe(1 + heroThw);
    const withAlly = allyInPlay(state);
    const best = Math.max(heroThw, profile(withAlly.state, withAlly.id).thw);
    expect(profile(withAlly.state, id).sch).toBe(1 + best);
  });

  it("60091.when-revealed: Chameleon schemes, placing threat on the main scheme", () => {
    const state = newGame(1);
    const run = villainPhase(state, 1, [CHAMELEON]);
    const cham = idOf(run.state, CHAMELEON);
    expect(inst(run.state, cham).engagedWith).toBe(P1);
    const byCham = ofType(run.events, "schemeResolved" as never).filter((e: any) => e.enemyInstanceId === cham);
    expect(byCham).toHaveLength(1);
  });
});

describe("Maggia Enforcers 60092", () => {
  it("60092.maggia-enforcers-constant: SCH equals the number of Maggia enemies in play, itself included", () => {
    const one = engaged(newGame(1), ENFORCERS, "enf1");
    // Hammerhead is a Maggia enemy too.
    expect(profile(one.state, one.id).sch).toBe(2);
    const two = engaged(one.state, ENFORCERS, "enf2");
    expect(profile(two.state, two.id).sch).toBe(3);
    expect(profile(two.state, one.id).sch).toBe(3);
  });
});

describe("Maggia Underboss 60093", () => {
  it("60093.maggia-underboss-forced-interrupt: activating against a stunned hero, it is given one additional boost card", () => {
    const base = engaged(villainStunned(newGame(1)), UNDERBOSS, "boss");
    const flips = (r: { events: readonly GameEvent[] }) =>
      ofType(r.events, "boostCardFlipped").filter((e) => (e as any).enemyInstanceId === base.id).length;
    expect(flips(villainPhase(stunned(base.state), 2))).toBe(2);
    expect(flips(villainPhase(base.state, 1))).toBe(1);
  });

  it("60093.maggia-underboss-forced-interrupt: also for a scheme activation against a stunned alter-ego", () => {
    const base = engaged(villainStunned(withForm(newGame(1), "alterEgo")), UNDERBOSS, "boss");
    const flips = (r: { events: readonly GameEvent[] }) =>
      ofType(r.events, "boostCardFlipped").filter((e) => (e as any).enemyInstanceId === base.id).length;
    expect(flips(villainPhase(stunned(base.state), 3))).toBe(2);
    expect(flips(villainPhase(base.state, 3))).toBe(1);
  });
});

describe("Consolidate Power 60094", () => {
  it("60094.consolidate-power-forced-response: a defeated minion is given to the villain as a facedown boost card", () => {
    const taken = takeFromEncounter(newGame(1), CONSOLIDATE);
    const withScheme = patchInstance(
      { ...taken.state, villainArea: [...taken.state.villainArea, taken.id] },
      taken.id,
      { faceup: true, threat: 6 },
    );
    const minion = engaged(withScheme, ENFORCERS, "enf");
    const weak = patchInstance(minion.state, minion.id, { damage: 2 });
    const run = driveEventsPicking(WAVE11_DEPS, weak, declines, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(weak),
      targetInstanceId: minion.id,
    } as never);
    expect(inst(run.state, villainOf(run.state)).boostCards).toContain(minion.id);
    expect(encounterDiscard(run.state)).not.toContain(ENFORCERS);
  });
});

describe("Power Struggle 60095", () => {
  it("60095.when-revealed: defeats the minion with the fewest hit points, then reveals the next minion discarded", () => {
    const a = engaged(newGame(1), ENFORCERS, "enf");
    const b = engaged(a.state, UNDERBOSS, "boss");
    const run = villainPhase(villainStunned(b.state), 1, [STRUGGLE, ASSAULT, CHAMELEON]);
    // Maggia Enforcers (3 hit points) have fewer than Maggia Underboss (4): they are defeated.
    expect(playerOf(run.state, P1).playArea).not.toContain(a.id);
    expect(playerOf(run.state, P1).playArea).toContain(b.id);
    // The non-minion is discarded, the minion found is revealed: engaged with P1 (its When Revealed ran).
    expect(encounterDiscard(run.state)).toContain(ASSAULT);
    expect(inst(run.state, idOf(run.state, CHAMELEON)).engagedWith).toBe(P1);
    expect(run.state.villainArea.map((i) => codeOf(run.state, i))).toContain(STRUGGLE);
  });
});

describe("Power Struggle 60095 tie", () => {
  it("60095.when-revealed: minions tied for fewest hit points are chosen between by the first player", () => {
    const a = engaged(newGame(1), ENFORCERS, "enf1");
    const b = engaged(a.state, ENFORCERS, "enf2");
    const asked: { player: string; options: number }[] = [];
    const pick: Picker = (s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "chooseTarget") asked.push({ player: c.playerId as string, options: c.options.length });
      return c.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s);
    };
    const run = villainPhase(villainStunned(b.state), 0, [STRUGGLE, ASSAULT, CHAMELEON], pick);
    expect(asked).toContainEqual({ player: run.state.firstPlayerId as string, options: 2 });
    const left = [a.id, b.id].filter((i) => playerOf(run.state, P1).playArea.includes(i));
    expect(left).toHaveLength(1);
  });
});

describe('"Head First!" 60096', () => {
  it("60096.when-revealed-alter-ego: gains surge", () => {
    const state = withForm(newGame(1), "alterEgo");
    const run = villainPhase(state, 1, [HEAD_FIRST, ENFORCERS]);
    const revealed = ofType(run.events, "encounterCardRevealed" as never).map((e: any) =>
      codeOf(run.state, e.instanceId),
    );
    expect(revealed.slice(0, 2)).toEqual([HEAD_FIRST, ENFORCERS]);
  });

  it("60096.when-revealed-hero: Hammerhead attacks you", () => {
    const run = villainPhase(newGame(1), 1, [HEAD_FIRST, ASSAULT]);
    expect(attacksBy(run.state, run.events, "60086")).toHaveLength(2);
  });

  it("60096.when-revealed-hero: if you are stunned the attack gets +2 ATK; if not, it does not", () => {
    // The villain is stunned, so Head First is the only attack (his own would stun the hero first).
    const calm = villainPhase(villainStunned(newGame(1)), 0, [HEAD_FIRST, ASSAULT]);
    expect(attacksBy(calm.state, calm.events, "60086").map((a) => [a.baseAtk, a.damageDealt])).toEqual([[1, 1]]);
    const hit = villainPhase(stunned(villainStunned(newGame(1))), 0, [HEAD_FIRST, ASSAULT]);
    expect(attacksBy(hit.state, hit.events, "60086").map((a) => [a.baseAtk, a.damageDealt])).toEqual([[3, 3]]);
  });

  it("60096.when-revealed-hero: if you are stunned the attack gains overkill: damage beyond the defending ally falls on the hero", () => {
    const ally = allyInPlay(stunned(villainStunned(newGame(1))));
    const hp = profile(ally.state, ally.id).maxHp;
    const defends: Picker = (s) =>
      s.pendingChoice!.prompt.kind === "declareDefender" ? [ally.id as string] : firstLegal(s);
    const run = villainPhase(ally.state, 0, [HEAD_FIRST, ASSAULT], defends);
    expect(hp).toBeLessThan(3);
    expect(playerOf(run.state, P1).playArea).not.toContain(ally.id);
    expect(damageOf(run.state)).toBe(3 - hp);
  });
});
