import { PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  characterProfile,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario, encounterCardsOf } from "../../../core/index.js";
import { attacksGainKeywords, constant, query } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, playFromHand, withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_VILLAINS_BULLSEYE as REGISTRY, FNE_VILLAINS_BULLSEYE_SKIPPED as SKIPPED } from "./bullseye.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * The Bullseye villain set (60065-60067 Bullseye, 60068a/b Adamantium-Laced Spine, 60069 Raise the Stakes, 60070 Deadly
 * Sai, 60071 Incessant Pursuit, 60072 Lady Bullseye, 60073 Deranged Bloodlust, 60074 Everything is a Weapon, 60075
 * Unerring Desire), docs/phase7-wave11-scenarios.md section S6. Each game is Core's Spider-Man (Justice) in hero form
 * against Bullseye (stage chosen per test, ATK 1 / 2 / 3) with the Bullseye set in the encounter deck, so Advance
 * (01186) and Assault (01187), cards with no boost icon and no boost ability, are the blank fillers. The hero takes the
 * hits undefended ("decline") unless a test says otherwise.
 */
const BULLSEYE = ["60065"];
const SPINE = "60068a";
const STAKES = "60069";
const SAI = "60070";
const PURSUIT = "60071";
const LADY = "60072";
const BLOODLUST = "60073";
const WEAPON = "60074";
const DESIRE = "60075";
const ADVANCE = "01186";
const ASSAULT = "01187";
const REFS = [
  "60065.when-revealed",
  "60065.bullseye-forced-interrupt",
  "60066.when-revealed",
  "60066.bullseye-forced-interrupt",
  "60067.when-revealed",
  "60067.bullseye-forced-interrupt",
  "60068a.adamantium-laced-spine-forced-interrupt",
  "60068b.damaged-spine-forced-response",
  "60069.raise-the-stakes-forced-interrupt",
  "60070.deadly-sai-constant",
  "60070.deadly-sai-response",
  "60071.incessant-pursuit-constant",
  "60071.incessant-pursuit-forced-interrupt",
  "60072.lady-bullseye-forced-interrupt",
  "60073.when-revealed",
  "60073.boost",
  "60074.when-revealed-alter-ego",
  "60074.when-revealed-hero",
  "60074.boost",
  "60075.when-revealed",
  "60075.boost",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState): InstanceId => identityOf(s);
const damageOf = (s: GameState, id: InstanceId = hero(s)): number => inst(s, id).damage;
const encounterDiscard = (s: GameState): string[] => activeEncounterDeck(s).discard.map((i) => codeOf(s, i));
const encounterDeckCodes = (s: GameState): string[] => activeEncounterDeck(s).deck.map((i) => codeOf(s, i));
const idOf = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;
const attacksBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  ofType(events, "attackResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);
/** The boost icons each boost card flipped for `enemy` counted, in the order flipped. */
const flipsOf = (events: readonly GameEvent[], enemy: InstanceId): number[] =>
  ofType(events, "boostCardFlipped")
    .filter((e) => e.enemyInstanceId === enemy)
    .map((e) => e.boostIcons);

/** Whether each character attack in the events was made with ranged (the engine stamps it on the `characterAttacked` trigger). */
const rangedFlags = (events: readonly GameEvent[]): boolean[] =>
  events.flatMap((e: any) =>
    e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "characterAttacked"
      ? [e.event.ranged === true]
      : [],
  );

/** Core Spider-Man (or another Core starter) in hero form against Bullseye at `stage` (1 to 3), the set in the encounter deck. */
function newGame(stage = 1, starterDeckId = "core-spider-man-justice", second?: string): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId }, ...(second ? [{ starterDeckId: second }] : [])],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    {
      ...base,
      villainCardId: cardId("60065"),
      villainSide: "A",
      villainStartStageIndex: stage - 1,
      villainLastStageIndex: 2,
      encounterDeck: [...base.encounterDeck, ...encounterCardsOf(["bullseye"], PLAYABLE_CARDS)],
    },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  const first = withForm(settled, { heroForm: 0 });
  return second ? withForm(first, { heroForm: 0 }, P2) : first;
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
/** Answers a choice with the option whose label starts with `label`; a defender prompt is declined. */
const labeled =
  (label: string): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    const option = choice.options.find((o) => o.label.startsWith(label));
    return option ? [option.optionId] : firstLegal(s);
  };
const CROWD = "01108";
/** Core ally, 2 hit points: Bullseye's ATK 1 plus one icon defeats it. */
const BLACK_CAT = "01002";
/** The activation's boost card is a blank Advance; the card dealt to the hero is Crowd Control, a side scheme that does nothing to the hero. */
const QUIET = [ADVANCE, CROWD];
/** Bullseye's boost, Lady Bullseye's boost, a possible additional boost card for her, then the card dealt to the hero. */
const LADY_STACK = [ADVANCE, ASSAULT, ADVANCE, CROWD];
/** P1 ends the turn; the villain phase runs on the encounter deck stacked as `stack`. */
function villainPhase(state: GameState, stack: readonly string[], pick: Picker = declines) {
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
/** Surgery: the first copy of `code` attached to `host` (default the villain), faceup. */
function attachedTo(state: GameState, code: string, host: InstanceId = villainOf(state)) {
  const taken = takeFromEncounter(state, code);
  const placed = patchInstance(taken.state, taken.id, { faceup: true, attachedTo: host, controllerId: null });
  return {
    id: taken.id,
    state: patchInstance(placed, host, { attachments: [...inst(placed, host).attachments, taken.id] }),
  };
}

/** Surgery: P1's hand is exactly `count` cards, each printing one resource of a different type (the deck refills it at turn end). */
function withResources(state: GameState, count: number, player = P1): GameState {
  const owner = playerOf(state, player);
  const icons = (id: InstanceId): Record<string, number> =>
    ((PLAYABLE_CARDS.find((c) => c.id === inst(state, id).cardId) as any)?.resourceIcons ?? {}) as Record<
      string,
      number
    >;
  const single = (id: InstanceId): string | undefined => {
    const found = Object.entries(icons(id)).filter(([, n]) => n > 0);
    return found.length === 1 && found[0]![1] === 1 ? found[0]![0] : undefined;
  };
  const picked: InstanceId[] = [];
  const types = new Set<string>();
  for (const id of [...owner.hand, ...owner.deck]) {
    const type = single(id);
    if (type === undefined || types.has(type)) continue;
    types.add(type);
    picked.push(id);
    if (picked.length === count) break;
  }
  if (picked.length < count) throw new Error("not enough different resource types in P1's cards");
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? { ...p, hand: picked, deck: [...p.hand, ...p.deck].filter((i) => !picked.includes(i)) }
        : p,
    ),
  };
}

describe("registry", () => {
  it("registers every printed ref of the cards; nothing is skipped", () => {
    const printed = [...BULLSEYE, SPINE, STAKES, SAI, PURSUIT, LADY, BLOODLUST, WEAPON, DESIRE].flatMap((c) =>
      abilityRefIds(data(c)),
    );
    expect([...printed].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
  it("carries the printed timing", () => {
    expect(REGISTRY["60065.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    for (const ref of ["60065", "60066", "60067"]) {
      expect(REGISTRY[`${ref}.bullseye-forced-interrupt`]!.trigger).toMatchObject({ kind: "interrupt", forced: true });
    }
    expect(REGISTRY["60068a.adamantium-laced-spine-forced-interrupt"]!.trigger).toMatchObject({
      kind: "interrupt",
      forced: true,
    });
    expect(REGISTRY["60068b.damaged-spine-forced-response"]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY["60070.deadly-sai-response"]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY["60073.boost"]!.trigger).toMatchObject({ kind: "boost" });
    expect(REGISTRY["60074.when-revealed-hero"]!.trigger).toMatchObject({ kind: "whenRevealed" });
  });
});

describe("Bullseye 60065 / 60066 / 60067", () => {
  it("is the villain at the chosen stage (ATK 1, 2, 3)", () => {
    for (const stage of [1, 2, 3]) {
      const s = newGame(stage);
      expect(codeOf(s, villainOf(s))).toBe("60065");
      expect(characterProfile(s, villainOf(s), WAVE11_DEPS)!.atk).toBe(stage);
    }
  });

  it("60065.when-revealed: stage I sets Adamantium-Laced Spine aside, out of the encounter deck", () => {
    const s = newGame(1);
    expect(s.encounterSetAside.map((i) => codeOf(s, i))).toContain(SPINE);
    expect(encounterDeckCodes(s)).not.toContain(SPINE);
    expect(inst(s, villainOf(s)).attachments).toEqual([]);
  });

  it("60066.when-revealed: stage II finds the Spine and attaches it to Bullseye", () => {
    const s = newGame(2);
    expect(inst(s, villainOf(s)).attachments.map((i) => codeOf(s, i))).toEqual([SPINE]);
    expect(encounterDeckCodes(s)).not.toContain(SPINE);
  });

  it("60067.when-revealed: stage III finds Deranged Bloodlust and reveals it", () => {
    const s = newGame(3);
    expect(s.villainArea.map((i) => codeOf(s, i))).toContain(BLOODLUST);
    expect(encounterDeckCodes(s)).not.toContain(BLOODLUST);
  });

  it("60067.when-revealed: a Deranged Bloodlust already in play is the one found; no second copy is revealed", () => {
    const base = newGame(2);
    const taken = takeFromEncounter(base, BLOODLUST);
    const inPlay = patchInstance({ ...taken.state, villainArea: [...taken.state.villainArea, taken.id] }, taken.id, {
      faceup: true,
      threat: 4,
    });
    const advanced = defeatWithAttack(WAVE11_DEPS, inPlay, villainOf(inPlay));
    expect(advanced.villainArea.filter((i) => codeOf(advanced, i) === BLOODLUST)).toEqual([taken.id]);
    // A card found in play is still revealed where it is (RRG 1.8 "Find", p. 19): its When Revealed adds 3 more threat.
    expect(inst(advanced, taken.id).threat).toBe(7);
  });

  it("60065.bullseye-forced-interrupt: his boost card gains a boost icon (blank card: 1 icon, ATK 1 + 1 damage)", () => {
    const run = villainPhase(newGame(1), QUIET);
    expect(flipsOf(run.events, villainOf(run.state))).toEqual([1]);
    expect(attacksBy(run.state, run.events, "60065")).toMatchObject([{ baseAtk: 1, boostIcons: 1, damageDealt: 2 }]);
    expect(damageOf(run.state)).toBe(2);
  });

  it("60066.bullseye-forced-interrupt / 60067.bullseye-forced-interrupt: the same at stages II and III", () => {
    for (const [stage, atk] of [
      [2, 2],
      [3, 3],
    ] as const) {
      const run = villainPhase(newGame(stage), QUIET);
      expect(attacksBy(run.state, run.events, "60065")).toMatchObject([
        // Stage III has Deranged Bloodlust in play (revealed by its When Revealed): its amplify icon is one more icon.
        { baseAtk: atk, boostIcons: atk === 3 ? 2 : 1 },
      ]);
    }
  });

  it("60065.bullseye-forced-interrupt: a scheme activation counts the extra icon too (alter-ego, SCH 0 + 1)", () => {
    const state = withForm(newGame(1), "alterEgo");
    const run = villainPhase(state, QUIET);
    expect(flipsOf(run.events, villainOf(run.state))).toEqual([1]);
    // Step one of the villain phase places 1; the scheme places its SCH 0 plus the one icon.
    expect(
      ofType(run.events, "threatPlaced")
        .map((e) => e.amount)
        .slice(0, 2),
    ).toEqual([1, 1]);
  });

  it("60065.bullseye-forced-interrupt: the attack gains ranged, so a retaliating Black Panther does not hurt him", () => {
    const withRanged = villainPhase(newGame(1, "core-black-panther-protection"), QUIET);
    expect(attacksBy(withRanged.state, withRanged.events, "60065")).toHaveLength(1);
    expect(rangedFlags(withRanged.events)).toEqual([true]);
    expect(damageOf(withRanged.state, villainOf(withRanged.state))).toBe(0);
  });

  it("60065.bullseye-forced-interrupt: Deadly Sai takes the ranged away, so the retaliate hurts him (and piercing is gained)", () => {
    const base = newGame(1, "core-black-panther-protection");
    const { state } = attachedTo(base, SAI);
    const run = villainPhase(state, QUIET);
    expect(attacksBy(run.state, run.events, "60065")).toHaveLength(1);
    expect(rangedFlags(run.events)).toEqual([false]);
    expect(damageOf(run.state, villainOf(run.state))).toBe(1);
  });

  it("60065.bullseye-forced-interrupt: every boost card he holds gains the icon, a facedown Unerring Desire included", () => {
    // Round one: Unerring Desire is revealed and given to him; round two: it and the new card are both flipped.
    const first = villainPhase(newGame(1), [ADVANCE, DESIRE], labeled("Give"));
    expect(inst(first.state, villainOf(first.state)).boostCards).toHaveLength(1);
    const second = driveEventsPicking(WAVE11_DEPS, stackEncounterDeck(first.state, ...QUIET), declines, endTurn(P1));
    // Desire prints 3 boost icons: 3 + 1; the blank card 0 + 1.
    expect(flipsOf(second.events, villainOf(second.state)).sort()).toEqual([1, 4]);
  });
});

describe("Adamantium-Laced Spine 60068a / Damaged Spine 60068b", () => {
  it("is data: a Permanent attachment for the villain", () => {
    expect([data(SPINE).type, data(SPINE).keywords]).toEqual(["attachment", [{ name: "permanent" }]]);
  });

  it("60068a.adamantium-laced-spine-forced-interrupt: all but 3 of the damage is prevented and kept on the Spine", () => {
    const placed = playFromHand(WAVE11_DEPS, newGame(2), "01005", 3);
    const spine = inst(placed.state, villainOf(placed.state)).attachments[0]!;
    expect(inst(placed.state, villainOf(placed.state)).damage).toBe(3);
    expect(inst(placed.state, spine).damage).toBe(5);
    expect(inst(placed.state, spine).flipped).toBe(false);
  });

  it("60068a.adamantium-laced-spine-forced-interrupt: damage of 3 or less is taken in full and nothing is kept", () => {
    const state = newGame(2);
    const spine = inst(state, villainOf(state)).attachments[0]!;
    const run = driveEventsPicking(WAVE11_DEPS, state, declines, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(state),
      targetInstanceId: villainOf(state),
    } as never);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(2);
    expect(inst(run.state, spine).damage).toBe(0);
  });

  it("60068a.adamantium-laced-spine-forced-interrupt: then, with 6 or more damage on it, the Spine flips", () => {
    const state = newGame(2);
    const spine = inst(state, villainOf(state)).attachments[0]!;
    const primed = patchInstance(state, spine, { damage: 2 });
    const placed = playFromHand(WAVE11_DEPS, primed, "01005", 3);
    expect(inst(placed.state, spine).damage).toBe(7);
    expect(inst(placed.state, spine).flipped).toBe(true);
  });

  it("60068b.damaged-spine-forced-response: after Bullseye schemes, 3 damage is removed from the Damaged Spine", () => {
    const state = newGame(2);
    const spine = inst(state, villainOf(state)).attachments[0]!;
    const damaged = patchInstance(state, spine, { damage: 7, flipped: true });
    const run = villainPhase(withForm(damaged, "alterEgo"), QUIET);
    expect(inst(run.state, spine).damage).toBe(4);
    expect(inst(run.state, spine).flipped).toBe(true);
  });

  it("60068b.damaged-spine-forced-response: then, with no damage left, it flips back to the Spine", () => {
    const state = newGame(2);
    const spine = inst(state, villainOf(state)).attachments[0]!;
    const damaged = patchInstance(state, spine, { damage: 3, flipped: true });
    const run = villainPhase(withForm(damaged, "alterEgo"), QUIET);
    expect(inst(run.state, spine).damage).toBe(0);
    expect(inst(run.state, spine).flipped).toBe(false);
  });
});

describe("Damaged Spine 60068b, no longer a cap", () => {
  it("60068a.adamantium-laced-spine-forced-interrupt: flipped, it prevents nothing: all 8 damage is taken", () => {
    const state = newGame(2);
    const spine = inst(state, villainOf(state)).attachments[0]!;
    const flipped = patchInstance(state, spine, { damage: 7, flipped: true });
    const placed = playFromHand(WAVE11_DEPS, flipped, "01005", 3);
    expect(inst(placed.state, villainOf(placed.state)).damage).toBe(8);
    expect(inst(placed.state, spine).damage).toBe(7);
  });
});

describe("Raise the Stakes 60069", () => {
  it("is data: an attachment for the villain", () => {
    expect(data(STAKES).attachesTo).toEqual({ kind: "villain" });
  });

  it("60069.raise-the-stakes-forced-interrupt: he gets one additional boost card; an attack that defeats nobody shuffles the card into the encounter deck", () => {
    const { state, id } = attachedTo(newGame(1), STAKES);
    const run = villainPhase(state, [ADVANCE, ASSAULT, CROWD]);
    // Both flipped cards (his own and the additional one) are blank and each gains Bullseye's icon.
    expect(flipsOf(run.events, villainOf(run.state))).toEqual([1, 1]);
    expect(inst(run.state, id).attachedTo).toBeNull();
    expect([...encounterDeckCodes(run.state), ...encounterDiscard(run.state)]).toContain(STAKES);
    expect(run.state.removedFromGame).not.toContain(id);
  });

  it("60069.raise-the-stakes-forced-interrupt: an attack that defeats a friendly ally removes the ally and this card from the game", () => {
    const placed = stagedInPlay(newGame(1), BLACK_CAT);
    const ally = placed.id;
    const { state, id } = attachedTo(placed.state, STAKES);
    const defends: Picker = (s) =>
      s.pendingChoice!.prompt.kind === "declareDefender" ? [ally as string] : firstLegal(s);
    const run = villainPhase(state, QUIET, defends);
    expect(run.state.removedFromGame).toContain(ally);
    expect(run.state.removedFromGame).toContain(id);
  });
});

describe("Deadly Sai 60070", () => {
  it("is data: +2 ATK on the attached Bullseye", () => {
    expect(data(SAI).statModifiers).toEqual({ atk: 2 });
  });

  it("60070.deadly-sai-constant: his attack gains piercing, so a tough status card is discarded and the damage taken", () => {
    const bare = newGame(1);
    const toughHero = (s: GameState) =>
      patchInstance(s, hero(s), { statuses: { ...inst(s, hero(s)).statuses, tough: 1 } });
    const without = villainPhase(toughHero(bare), QUIET);
    expect(damageOf(without.state)).toBe(0);
    expect(inst(without.state, hero(without.state)).statuses.tough).toBe(0);
    const { state } = attachedTo(bare, SAI);
    const run = villainPhase(toughHero(state), QUIET);
    // ATK 1 + 2, one blank boost card gaining 1 icon.
    expect(damageOf(run.state)).toBe(4);
  });

  /** The hero defends; the response is taken (or not) and paid with the two resource cards in hand. */
  function saiGame(take: boolean) {
    const base = attachedTo(newGame(1), SAI);
    const state = withResources(base.state, 2);
    const hand = playerOf(state, P1).hand;
    const picker: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "declareDefender") return [hero(s) as string];
      if (choice.prompt.kind === "chooseTriggers") {
        const offered = choice.options.find((o) => (o.optionId as string).endsWith(".deadly-sai-response"));
        return take && offered ? [offered.optionId as string] : [];
      }
      if (choice.prompt.kind === "payForAbility") return hand.map((c) => `hand:${c}`);
      return firstLegal(s);
    };
    return { run: villainPhase(state, QUIET, picker), id: base.id, hand };
  }

  it("60070.deadly-sai-response: after your hero defends against Bullseye, spending 2 different resources discards it", () => {
    const { run, id, hand } = saiGame(true);
    expect(attacksBy(run.state, run.events, "60065")).toHaveLength(1);
    expect(inst(run.state, id).attachedTo).toBeNull();
    expect(encounterDiscard(run.state)).toContain(SAI);
    for (const card of hand) expect(playerOf(run.state, P1).discard).toContain(card);
  });

  it("60070.deadly-sai-response: left unused it stays attached and nothing is spent", () => {
    const { run, id, hand } = saiGame(false);
    expect(inst(run.state, id).attachedTo).toBe(villainOf(run.state));
    for (const card of hand) expect(playerOf(run.state, P1).hand).toContain(card);
  });
});

describe("Deadly Sai 60070 with another ranged grant and with two players", () => {
  // Out Front (60129a) and any other "attacks gain ranged" source lose to the Sai. Staged with a constant in place of
  // Raise the Stakes' ability (Out Front's shape).
  it("60065.bullseye-forced-interrupt: Deadly Sai takes ranged away even when another card grants it (RRG 1.8 Lose, p. 27)", () => {
    const granting = {
      ...WAVE11_DEPS,
      abilities: {
        ...WAVE11_DEPS.abilities,
        "60069.raise-the-stakes-forced-interrupt": constant(
          attacksGainKeywords(["ranged"], { attacker: query("villain") }),
        ),
      },
    };
    const sai = attachedTo(newGame(1, "core-black-panther-protection"), SAI);
    const both = attachedTo(sai.state, STAKES);
    const run = driveEventsPicking(granting, stackEncounterDeck(both.state, ...QUIET), declines, endTurn(P1));
    expect(rangedFlags(run.events)).toEqual([false]);
  });

  it("60070.deadly-sai-response: another player's hero defending is offered the response, and only that player", () => {
    const base = attachedTo(newGame(1, "core-spider-man-justice", "core-black-panther-protection"), SAI);
    const state = withResources(base.state, 2, P2);
    const offeredTo: string[] = [];
    const picker: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "declareDefender") {
        const p2 = identityOf(s, P2) as string;
        return choice.options.some((o) => o.optionId === p2) ? [p2] : ["decline"];
      }
      if (choice.prompt.kind === "chooseTriggers") {
        const sai = choice.options.find((o) => (o.optionId as string).endsWith(".deadly-sai-response"));
        if (sai) offeredTo.push(choice.playerId as string);
        return [];
      }
      return firstLegal(s);
    };
    driveEventsPicking(WAVE11_DEPS, stackEncounterDeck(state, ...QUIET), picker, endTurn(P1), endTurn(P2));
    expect(offeredTo).not.toContain("p1");
    expect(offeredTo).toContain("p2");
  });
});

describe("Incessant Pursuit 60071", () => {
  it("is data: attaches to an ally without Incessant Pursuit attached", () => {
    expect(data(PURSUIT).attachesTo).toMatchObject({ kind: "qualified", category: "ally" });
  });

  it("60071.incessant-pursuit-constant: with no ally to attach to, the card gains surge", () => {
    const run = villainPhase(newGame(1), [ADVANCE, PURSUIT, ASSAULT, ASSAULT]);
    const revealed = ofType(run.events, "encounterCardRevealed" as never).map((e: any) =>
      codeOf(run.state, e.instanceId),
    );
    expect(revealed.slice(0, 2)).toEqual([PURSUIT, ASSAULT]);
  });

  it("60071.incessant-pursuit-forced-interrupt: the villain attacks the attached ally instead, with overkill", () => {
    // Stage II: ATK 2 + 1 icon = 3 against a 2 hit point ally; the 1 point of excess spills to the hero (overkill).
    const placed = stagedInPlay(newGame(2), BLACK_CAT);
    const ally = placed.id;
    const { state } = attachedTo(placed.state, PURSUIT, ally);
    const run = villainPhase(state, QUIET);
    const attacks = attacksBy(run.state, run.events, "60065");
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.targetInstanceId).toBe(ally);
    expect(damageOf(run.state)).toBe(1);
  });

  it("60071.incessant-pursuit-forced-interrupt: the villain attacking another player is not redirected to the attached ally", () => {
    const placed = stagedInPlay(newGame(1, "core-spider-man-justice", "core-black-panther-protection"), BLACK_CAT);
    const { state } = attachedTo(placed.state, PURSUIT, placed.id);
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck({ ...state, firstPlayerId: P2 }, ...QUIET),
      declines,
      endTurn(P1),
      endTurn(P2),
    );
    // His own activation (the first attack) is against the first player, P2; P1 is only attacked by cards dealt after it.
    const targets = attacksBy(run.state, run.events, "60065").map((a) => a.targetInstanceId);
    expect(targets[0]).toBe(identityOf(run.state, P2));
  });

  it("60071.incessant-pursuit-forced-interrupt: revealed for real it attaches to the ally, and the next attack goes to that ally", () => {
    const placed = stagedInPlay(newGame(1), BLACK_CAT);
    const ally = placed.id;
    const first = villainPhase(placed.state, [ADVANCE, PURSUIT, CROWD]);
    expect(inst(first.state, ally).attachments.map((i) => codeOf(first.state, i))).toEqual([PURSUIT]);
    expect(attacksBy(first.state, first.events, "60065").map((a) => a.targetInstanceId)).toEqual([hero(first.state)]);
    const second = villainPhase(first.state, [ADVANCE, CROWD]);
    expect(attacksBy(second.state, second.events, "60065").map((a) => a.targetInstanceId)).toEqual([ally]);
  });

  it("60071.incessant-pursuit-forced-interrupt: if the attack defeats the ally, it is removed from the game", () => {
    const placed = stagedInPlay(newGame(1), BLACK_CAT);
    const ally = placed.id;
    const { state } = attachedTo(placed.state, PURSUIT, ally);
    const run = villainPhase(state, QUIET);
    expect(run.state.removedFromGame).toContain(ally);
    expect(encounterDiscard(run.state)).not.toContain(BLACK_CAT);
  });
});

describe("Lady Bullseye 60072", () => {
  it("is data: Villainous", () => {
    expect(data(LADY).keywords).toEqual([{ name: "villainous" }]);
  });

  it("60072.lady-bullseye-forced-interrupt: an undefended attack gets one additional boost card", () => {
    const lady = engaged(newGame(1), LADY, "lady");
    const run = villainPhase(lady.state, LADY_STACK);
    expect(attacksBy(run.state, run.events, LADY)).toHaveLength(1);
    expect(flipsOf(run.events, lady.id)).toHaveLength(2);
    expect(inst(run.state, lady.id).counters["extra"] ?? 0).toBe(0);
  });

  it("60072.lady-bullseye-forced-interrupt: a defended attack gets only her own boost card", () => {
    const lady = engaged(newGame(1), LADY, "lady");
    // Bullseye's own attack is declined; the hero defends Lady Bullseye's.
    const defendsLady: Picker = (s) => {
      const prompt = s.pendingChoice!.prompt as { kind: string; attack?: { enemyInstanceId: InstanceId } };
      if (prompt.kind !== "declareDefender") return firstLegal(s);
      return prompt.attack?.enemyInstanceId === lady.id ? [hero(s) as string] : ["decline"];
    };
    const run = villainPhase(lady.state, LADY_STACK, defendsLady);
    expect(attacksBy(run.state, run.events, LADY)).toHaveLength(1);
    expect(flipsOf(run.events, lady.id)).toHaveLength(1);
  });
});

describe("Deranged Bloodlust 60073", () => {
  it("60073.when-revealed: places additional threat equal to Bullseye's stage number", () => {
    for (const stage of [1, 2]) {
      const run = villainPhase(newGame(stage), [ADVANCE, BLOODLUST, ASSAULT, ASSAULT]);
      const scheme = idOf(run.state, BLOODLUST);
      expect(inst(run.state, scheme).threat).toBe(4 + stage);
    }
  });

  it("60073.boost: after the activation, the card is revealed", () => {
    const run = villainPhase(newGame(1), [BLOODLUST, CROWD]);
    const scheme = idOf(run.state, BLOODLUST);
    expect(run.state.villainArea).toContain(scheme);
    expect(inst(run.state, scheme).threat).toBe(5);
  });
});

describe("Everything is a Weapon 60074", () => {
  it("60074.when-revealed-alter-ego: you take 2 indirect damage", () => {
    const state = withForm(newGame(1), "alterEgo");
    const run = villainPhase(state, [ADVANCE, WEAPON, ASSAULT, ASSAULT]);
    expect(damageOf(run.state)).toBe(2);
  });

  it("60074.when-revealed-hero: choosing Bullseye activates against you makes him attack again", () => {
    const run = villainPhase(newGame(1), [ADVANCE, WEAPON, ASSAULT, ASSAULT], labeled("Bullseye activates"));
    expect(attacksBy(run.state, run.events, "60065")).toHaveLength(2);
  });

  it("60074.when-revealed-hero: choosing to remove an ally removes the ally you control from the game", () => {
    const placed = stagedInPlay(newGame(1), BLACK_CAT);
    const run = villainPhase(placed.state, [ADVANCE, WEAPON, ASSAULT, ASSAULT], labeled("Remove an ally"));
    expect(run.state.removedFromGame).toContain(placed.id);
    expect(attacksBy(run.state, run.events, "60065")).toHaveLength(1);
  });

  it("60074.boost: during Bullseye's attack he gets an additional boost card and the attack gains piercing", () => {
    const toughHero = (s: GameState) =>
      patchInstance(s, hero(s), { statuses: { ...inst(s, hero(s)).statuses, tough: 1 } });
    const run = villainPhase(toughHero(newGame(1)), [WEAPON, ADVANCE, CROWD]);
    expect(flipsOf(run.events, villainOf(run.state))).toHaveLength(2);
    // Piercing discards the tough card: ATK 1 + 1 (Weapon) + 1 (Advance) icons, all taken.
    expect(inst(run.state, hero(run.state)).statuses.tough).toBe(0);
    expect(damageOf(run.state)).toBe(4);
  });
});

describe("Unerring Desire 60075", () => {
  it("60075.when-revealed: the first option gives this card to the villain as a facedown boost card", () => {
    const run = villainPhase(newGame(1), [ADVANCE, DESIRE, ASSAULT, ASSAULT], labeled("Give"));
    const desire = idOf(run.state, DESIRE);
    expect(inst(run.state, villainOf(run.state)).boostCards).toContain(desire);
  });

  it("60075.when-revealed: only the first option is offered to a player with no Persona support", () => {
    const run = villainPhase(newGame(1), [ADVANCE, DESIRE, ASSAULT, ASSAULT], labeled("Remove"));
    const desire = idOf(run.state, DESIRE);
    expect(inst(run.state, villainOf(run.state)).boostCards).toContain(desire);
  });

  it("60075.when-revealed: the second option removes a Persona support you control from the game", () => {
    const persona = PLAYABLE_CARDS.find(
      (c: any) => c.type === "support" && (c.traits ?? []).some((t: unknown) => String(t).toUpperCase() === "PERSONA"),
    );
    expect(persona).toBeDefined();
    const placed = stagedInPlay(newGame(1), persona!.id as string);
    const run = villainPhase(placed.state, [ADVANCE, DESIRE, ASSAULT, ASSAULT], labeled("Remove"));
    expect(run.state.removedFromGame).toContain(placed.id);
    expect(playerOf(run.state, P1).playArea).not.toContain(placed.id);
  });

  it("60075.boost: during an attack, the attack gains overkill", () => {
    const placed = stagedInPlay(newGame(1), BLACK_CAT);
    const ally = placed.id;
    const defends: Picker = (s) =>
      s.pendingChoice!.prompt.kind === "declareDefender" ? [ally as string] : firstLegal(s);
    const run = villainPhase(placed.state, [DESIRE, CROWD], defends);
    // Desire prints 3 icons (+1 from Bullseye): ATK 1 + 4 = 5 against the ally; any excess over its hit points spills to the hero.
    expect(attacksBy(run.state, run.events, "60065")).toMatchObject([{ boostIcons: 4 }]);
    // The excess over its hit points (5 - 2) spills to the hero.
    expect(damageOf(run.state)).toBe(3);
    expect(playerOf(run.state, P1).playArea).not.toContain(ally);
  });
});
