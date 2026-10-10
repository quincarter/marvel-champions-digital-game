import { SILK_CARDS, WAVE9_CARDS, WAVE9_STARTER_DECKS, cardId, type HeroIdentityCard } from "@mc/content";
import {
  activeEncounterDeckId,
  handSize,
  maxHitPoints,
  applyCommand,
  legalActions,
  requiredIdentitySet,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withDamage, withForm } from "../../../testing/staging.js";
import { SILK_DEPS, engageMinion, silkGame, silkHeroGame, tuckEncounterCard } from "../testing.js";
import { SILK_IDENTITY, SILK_IDENTITY_SKIPPED } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Silk / Cindy Moon (52001a/b), docs/phase7-wave9.md section 8.4, 3.39, 3.40. The printed precon `silk-protection` (40
 * cards) against Rhino. Hero face: THW 1, ATK 2, DEF 3, hand size 5, 10 hit points; alter-ego face: REC 3, hand size 6.
 *
 * The cards tucked here are Core Rhino-set encounter cards staged by surgery: Hydra Mercenary 01101 (3 hit points),
 * Sandman 01102, Shocker 01103 (minions), Breakin' & Takin' 01107 (a side scheme) and "I'm Tough!" 01105 (a treachery).
 */
const CAP = "52001a.silk-constant";
const SENSE = "52001a.silk-sense";
const CINDY_CAP = "52001b.cindy-moon-constant";
const CINDY_ACTION = "52001b.cindy-moon-action";

const MERC = "01101";
const SANDMAN = "01102";
const SHOCKER = "01103";
const SIDE = "01107";
const TOUGH = "01105";

const PRECON = WAVE9_STARTER_DECKS.find((d) => d.id === "silk-protection")!;
const IDENTITY = SILK_CARDS.find((c) => c.id === cardId("52001a")) as HeroIdentityCard;

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const tuckedOf = (s: GameState): readonly InstanceId[] => inst(s, identityOf(s)).tucked;
const tuckedCodes = (s: GameState): string[] =>
  tuckedOf(s)
    .map((id) => codeOf(s, id))
    .sort();
const encounterDiscard = (s: GameState): readonly InstanceId[] => s.encounterDecks[activeEncounterDeckId(s)]!.discard;
const offered = (s: GameState, ref: string): boolean =>
  s.pendingChoice?.prompt.kind === "chooseTriggers" && s.pendingChoice.options.some((o) => o.optionId.endsWith(ref));

/** Takes Silk Sense when offered; when asked which 4 stay (the cap), keeps every card but `discard`; otherwise as `firstLegal`. */
const takeSense =
  (discard?: InstanceId): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseTriggers") {
      const mine = choice.options.find((o) => o.optionId.endsWith(SENSE));
      return mine ? [mine.optionId] : firstLegal(s);
    }
    if (discard && choice.options.some((o) => o.optionId === discard))
      return choice.options
        .map((o) => o.optionId)
        .filter((id) => id !== discard)
        .slice(0, 4);
    if (choice.prompt.kind === "declareDefender") return [identityOf(s)];
    return firstLegal(s);
  };
const declineSense: Picker = (s) =>
  s.pendingChoice?.prompt.kind === "declareDefender" ? [identityOf(s)] : firstLegal(s);

const attack = (s: GameState): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s),
  targetInstanceId: villainOf(s),
});
const attackOn = (s: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s),
  targetInstanceId: target,
});
const thwartOn = (s: GameState, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: identityOf(s),
  schemeInstanceId: scheme,
});

/** Hero form with Hydra Mercenary engaged and one point from defeat (3 hit points, 2 damage: Silk's ATK 2 ends it). */
function withWoundedMinion(code = MERC, damage = 1): { readonly state: GameState; readonly id: InstanceId } {
  const placed = engageMinion(silkHeroGame(), code);
  return { state: patchInstance(placed.state, placed.id, { damage }), id: placed.id };
}

describe("Silk identity registry", () => {
  for (const ref of [CAP, SENSE, CINDY_CAP, CINDY_ACTION]) {
    it(`${ref} validates`, () => {
      expect(validateDefinition(SILK_IDENTITY[ref]!)).toEqual([]);
    });
  }
  it(`${CAP} and ${CINDY_CAP} are state checks, one on each face; ${SENSE} is an optional response`, () => {
    expect(SILK_IDENTITY[CAP]!.trigger).toMatchObject({ kind: "stateCheck" });
    expect(SILK_IDENTITY[CINDY_CAP]!.trigger).toMatchObject({ kind: "stateCheck" });
    expect(SILK_IDENTITY[SENSE]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(Object.keys(SILK_IDENTITY).sort()).toEqual([CAP, CINDY_ACTION, CINDY_CAP, SENSE].sort());
  });
  it(`${CINDY_ACTION} is an action with a tucked-card cost, once per round; nothing is skipped and every printed ref is registered`, () => {
    expect(SILK_IDENTITY_SKIPPED).toEqual({});
    expect(SILK_IDENTITY[CINDY_ACTION]).toMatchObject({
      trigger: { kind: "action" },
      cost: { discardTucked: { under: { kind: "self" }, min: 1, max: 1 } },
      limit: { count: 1, period: "round" },
    });
    const printed = [...IDENTITY.hero.abilities, ...IDENTITY.alterEgo.abilities].map((a) => a.id as string);
    expect(printed.sort()).toEqual([CAP, CINDY_ACTION, CINDY_CAP, SENSE].sort());
    expect(IDENTITY.hero.abilities.map((a) => a.id as string)).toContain(SENSE);
    expect(IDENTITY.alterEgo.abilities.map((a) => a.id as string)).not.toContain(SENSE);
  });
});

describe("deck builder start state", () => {
  it("requiredIdentitySet is exactly the precon's 15 Silk hero cards with their printed quantities", () => {
    const required = requiredIdentitySet(IDENTITY, SILK_CARDS);
    const asPairs = required.map((r) => [r.cardId as string, r.quantity] as const);
    expect(required.reduce((n, r) => n + r.quantity, 0)).toBe(15);
    const inPrecon = PRECON.cards.filter(
      (l) => (SILK_CARDS.find((c) => c.id === l.cardId) as { aspect?: string }).aspect === "hero:52001a",
    );
    expect(asPairs).toEqual(inPrecon.map((l) => [l.cardId as string, l.quantity] as const));
    expect(asPairs).toEqual([
      ["52002", 2],
      ["52003", 3],
      ["52004", 2],
      ["52005", 1],
      ["52006", 1],
      ["52007", 1],
      ["52008", 1],
      ["52009", 1],
      ["52010", 1],
      ["52011", 1],
      ["52012", 1],
    ]);
  });
});

describe("setup and printed stats, read from the game", () => {
  it("the precon is 40 cards: Cindy Moon starts with a hand of 6, a 34-card deck, hand size 6 and 10 hit points", () => {
    expect(PRECON.cards.reduce((n, l) => n + l.quantity, 0)).toBe(40);
    const s = silkGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    expect(playerOf(s, P1).hand).toHaveLength(6);
    expect(playerOf(s, P1).deck).toHaveLength(34);
    expect(handSize(s, P1, SILK_DEPS)).toBe(6);
    expect(maxHitPoints(s, identityOf(s), SILK_DEPS)).toBe(10);
    expect(tuckedOf(s)).toEqual([]);
  });
  it("Cindy Moon REC 3: recovering from 5 damage leaves 2", () => {
    const hurt = withDamage(silkGame(), identityOf(silkGame()), 5);
    const after = settle(
      runWith(SILK_DEPS, hurt, { type: "basicRecover", playerId: P1 }),
      firstLegal,
      undefined,
      SILK_DEPS,
    );
    expect(inst(after, identityOf(after)).damage).toBe(2);
  });
  it("Silk: hand size 5, 10 hit points, ATK 2 (2 damage on Rhino) and THW 1 (5 threat to 4)", () => {
    const s = patchInstance(silkHeroGame(), silkHeroGame().mainScheme.instanceId, { threat: 5 });
    expect(playerOf(s, P1).identity.form).toBe("hero");
    expect(handSize(s, P1, SILK_DEPS)).toBe(5);
    expect(maxHitPoints(s, identityOf(s), SILK_DEPS)).toBe(10);
    const hit = driveEventsPicking(SILK_DEPS, s, declineSense, attack(s)).state;
    expect(inst(hit, villainOf(hit)).damage).toBe(2);
    const thwarted = driveEventsPicking(SILK_DEPS, s, declineSense, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s),
      schemeInstanceId: s.mainScheme.instanceId,
    }).state;
    expect(inst(thwarted, s.mainScheme.instanceId).threat).toBe(4);
  });
});

describe(`${SENSE}: after you defeat a minion or side scheme, or resolve a treachery, tuck that card from the encounter discard pile`, () => {
  it("after Silk's basic attack defeats Hydra Mercenary (3 hit points) the response tucks it: 1 tucked, not in the discard pile", () => {
    const { state: s, id } = withWoundedMinion();
    const asked = settle(runWith(SILK_DEPS, s, attackOn(s, id)), firstLegal, (x) => offered(x, SENSE), SILK_DEPS);
    expect(offered(asked, SENSE)).toBe(true);
    const { state } = driveEventsPicking(SILK_DEPS, s, takeSense(), attackOn(s, id));
    expect(tuckedOf(state)).toEqual([id]);
    expect(encounterDiscard(state)).not.toContain(id);
    expect(state.pendingChoice).toBeNull();
  });
  it("declining leaves the minion in the encounter discard pile with nothing tucked", () => {
    const { state: s, id } = withWoundedMinion();
    const { state } = driveEventsPicking(SILK_DEPS, s, declineSense, attackOn(s, id));
    expect(tuckedOf(state)).toEqual([]);
    expect(encounterDiscard(state)).toContain(id);
  });
  it("a minion that survives the attack (2 damage on 3 hit points left at 1) is not tucked and no response is offered", () => {
    const { state: s, id } = withWoundedMinion(MERC, 0);
    const { state } = driveEventsPicking(SILK_DEPS, s, takeSense(), attackOn(s, id));
    expect(inst(state, id).damage).toBe(2);
    expect(tuckedOf(state)).toEqual([]);
  });
  it("after Silk's basic thwart removes the last threat from Breakin' & Takin', it is tucked: 1 tucked", () => {
    const placed = encounterCardInVillainArea(silkHeroGame(), SIDE, 1);
    const { state } = driveEventsPicking(SILK_DEPS, placed.state, takeSense(), thwartOn(placed.state, placed.id));
    expect(tuckedOf(state)).toEqual([placed.id]);
    expect(state.villainArea).not.toContain(placed.id);
    expect(encounterDiscard(state)).not.toContain(placed.id);
  });
  it("a side scheme that keeps threat (2 threat, THW 1) is not defeated: nothing is tucked", () => {
    const placed = encounterCardInVillainArea(silkHeroGame(), SIDE, 2);
    const { state } = driveEventsPicking(SILK_DEPS, placed.state, takeSense(), thwartOn(placed.state, placed.id));
    expect(inst(state, placed.id).threat).toBe(1);
    expect(tuckedOf(state)).toEqual([]);
  });
  it("after she resolves a treachery (I'm Tough!), she may tuck it from the encounter discard pile", () => {
    const stacked = stackEncounterDeck(silkHeroGame(), "01186", TOUGH);
    const { state } = driveEventsPicking(SILK_DEPS, stacked, takeSense(), { type: "endTurn", playerId: P1 });
    expect(tuckedCodes(state)).toEqual([TOUGH]);
    expect(encounterDiscard(state).map((id) => codeOf(state, id))).not.toContain(TOUGH);
  });
  it("declining the treachery response leaves it in the encounter discard pile", () => {
    const stacked = stackEncounterDeck(silkHeroGame(), "01186", TOUGH);
    const { state } = driveEventsPicking(SILK_DEPS, stacked, declineSense, { type: "endTurn", playerId: P1 });
    expect(tuckedOf(state)).toEqual([]);
    expect(encounterDiscard(state).map((id) => codeOf(state, id))).toContain(TOUGH);
  });
  it("a defeated minion with Victory 1 goes to the victory display, so nothing is tucked", () => {
    const victory = WAVE9_CARDS.find(
      (c) => c.type === "minion" && c.keywords.some((k) => k.name === "victory" && (k.value ?? 0) >= 1),
    );
    expect(victory, "a minion printing Victory 1 or more").toBeDefined();
    const placed = engageMinion(silkHeroGame(), MERC);
    const relabeled = patchInstance(placed.state, placed.id, { cardId: victory!.id, damage: 0 });
    const hurt = {
      ...relabeled,
      cardPool: { ...relabeled.cardPool, [victory!.id]: victory! },
    };
    const lethal = patchInstance(hurt, placed.id, { damage: 99 });
    const { state } = driveEventsPicking(SILK_DEPS, lethal, takeSense(), attackOn(lethal, placed.id));
    expect(state.victoryDisplay).toContain(placed.id);
    expect(tuckedOf(state)).toEqual([]);
  });
  it("in alter-ego form there is no Silk Sense: Cindy Moon's recover offers nothing", () => {
    const s = withForm(patchInstance(silkHeroGame(), identityOf(silkHeroGame()), { damage: 3 }), "alterEgo");
    const after = driveEventsPicking(SILK_DEPS, s, takeSense(), { type: "basicRecover", playerId: P1 }).state;
    expect(inst(after, identityOf(after)).damage).toBe(0);
    expect(after.pendingChoice).toBeNull();
    expect(tuckedOf(after)).toEqual([]);
  });
});

describe(`${CAP}: more than 4 tucked cards here, discard all but 4`, () => {
  /** Hero form with four encounter cards tucked: Mercenary, Sandman, Shocker and Breakin' & Takin'. */
  function withFourTucked(): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
    let state = silkHeroGame();
    const ids: InstanceId[] = [];
    for (const code of [MERC, SANDMAN, SHOCKER, SIDE]) {
      const tucked = tuckEncounterCard(state, code);
      state = tucked.state;
      ids.push(tucked.id);
    }
    return { state, ids };
  }

  it("four tucked cards stay: the limit is 'more than 4'", () => {
    const { state, ids } = withFourTucked();
    const { state: after } = driveEventsPicking(SILK_DEPS, state, takeSense(), attack(state));
    expect(tuckedOf(after)).toEqual(ids);
  });
  it("with four tucked, Silk Sense tucks a fifth and the player discards one of the five: 4 remain", () => {
    const { state: held, ids } = withFourTucked();
    const placed = engageMinion(held, "01101");
    const { state: s, id } = { state: patchInstance(placed.state, placed.id, { damage: 1 }), id: placed.id };
    const { state } = driveEventsPicking(SILK_DEPS, s, takeSense(ids[1]), attackOn(s, id));
    expect(tuckedOf(state)).toHaveLength(4);
    expect(tuckedOf(state)).toContain(id);
    expect(tuckedOf(state)).not.toContain(ids[1]);
    expect(encounterDiscard(state)).toContain(ids[1]);
    expect(state.pendingChoice).toBeNull();
  });
  it("the player chooses which: discarding the card just tucked leaves the original four", () => {
    const { state: held, ids } = withFourTucked();
    const placed = engageMinion(held, "01101");
    const s = patchInstance(placed.state, placed.id, { damage: 1 });
    const { state } = driveEventsPicking(SILK_DEPS, s, takeSense(placed.id), attackOn(s, placed.id));
    expect(tuckedOf(state)).toEqual(ids);
    expect(encounterDiscard(state)).toContain(placed.id);
  });
  it("six tucked at once are cut to 4: two go to the encounter discard pile", () => {
    const { state: held } = withFourTucked();
    const extra = tuckEncounterCard(tuckEncounterCard(held, "01104").state, "01106");
    expect(tuckedOf(extra.state)).toHaveLength(6);
    const { state } = driveEventsPicking(SILK_DEPS, extra.state, takeSense(), attack(extra.state));
    expect(tuckedOf(state)).toHaveLength(4);
    expect(encounterDiscard(state).length).toBe(encounterDiscard(extra.state).length + 2);
  });
  it(`${CINDY_CAP}: the same limit on the alter-ego face (five tucked, one recover: 4 remain)`, () => {
    const { state: held } = withFourTucked();
    const five = tuckEncounterCard(held, "01104").state;
    const s = withForm(patchInstance(five, identityOf(five), { damage: 1 }), "alterEgo");
    const { state } = driveEventsPicking(SILK_DEPS, s, firstLegal, { type: "basicRecover", playerId: P1 });
    expect(tuckedOf(state)).toHaveLength(4);
  });
});

describe(`${CINDY_ACTION}: Action: Discard a card tucked here → draw 2 cards. (Limit once per round.)`, () => {
  /** Cindy Moon (alter-ego form, hand of 6) with these Rhino-set cards tucked, in this order. */
  function cindyWith(...codes: readonly string[]): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
    let state = silkGame();
    const ids: InstanceId[] = [];
    for (const code of codes) {
      const tucked = tuckEncounterCard(state, code);
      state = tucked.state;
      ids.push(tucked.id);
    }
    return { state, ids };
  }
  const cindy = (s: GameState, pick?: InstanceId): Command =>
    use(P1, identityOf(s), CINDY_ACTION, [], pick ? { discarded: [pick] } : undefined);
  const handOf = (s: GameState): number => playerOf(s, P1).hand.length;
  /** How `legalActions` lists the action: "legal", or the engine's reason for refusing it; null when not listed. */
  function listed(s: GameState): string | null {
    const actions = legalActions(s, P1, SILK_DEPS);
    if (actions.kind !== "turn") return null;
    const mine = (a: { readonly action: unknown }) => JSON.stringify(a.action).includes(`"${CINDY_ACTION}"`);
    if (actions.legal.some(mine)) return "legal";
    return actions.illegal.find(mine)?.reason ?? null;
  }

  it("0 tucked: the cost cannot be paid, so the action is not legal and the command is refused with nothing drawn", () => {
    const { state } = cindyWith();
    expect(listed(state)).toBe("no_valid_target");
    const result = applyCommand(state, cindy(state), SILK_DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("not enough tucked cards to discard for this cost");
  });

  it("1 tucked (Hydra Mercenary): it goes to the encounter discard pile, nothing stays tucked, hand 6 to 8, deck 34 to 32", () => {
    const { state, ids } = cindyWith(MERC);
    expect(listed(state)).toBe("legal");
    expect([handOf(state), playerOf(state, P1).deck.length]).toEqual([6, 34]);
    const { state: after, events } = driveEventsPicking(SILK_DEPS, state, firstLegal, cindy(state));
    expect(tuckedOf(after)).toEqual([]);
    expect(encounterDiscard(after)).toEqual([...encounterDiscard(state), ids[0]]);
    expect([handOf(after), playerOf(after, P1).deck.length]).toEqual([8, 32]);
    // The move owner question 7 turns on: out of the tucked zone, under the identity, into the encounter discard pile.
    expect(events.filter((e) => e.type === "cardMoved" && e.from.kind === "tucked")).toEqual([
      {
        type: "cardMoved",
        instanceId: ids[0],
        cardId: MERC,
        from: { kind: "tucked", hostInstanceId: identityOf(state) },
        to: { kind: "encounterDiscard", deckId: activeEncounterDeckId(state) },
      },
    ]);
  });

  it("4 tucked: the player must name one; naming the third (Shocker) discards only it, the other 3 stay in order, hand 6 to 8", () => {
    const { state, ids } = cindyWith(MERC, SANDMAN, SHOCKER, SIDE);
    expect(listed(state)).toBe("legal");
    const bare = applyCommand(state, cindy(state), SILK_DEPS);
    expect(bare.ok).toBe(false);
    if (!bare.ok) expect(bare.error.code).toBe("invalid_choice");
    const { state: after } = driveEventsPicking(SILK_DEPS, state, firstLegal, cindy(state, ids[2]));
    expect(tuckedOf(after)).toEqual([ids[0], ids[1], ids[3]]);
    expect(tuckedCodes(after)).toEqual([MERC, SANDMAN, SIDE].sort());
    expect(encounterDiscard(after)).toContain(ids[2]);
    expect(handOf(after)).toBe(8);
  });

  it("a treachery and a side scheme tucked here pay it just as a minion does", () => {
    for (const code of [TOUGH, SIDE]) {
      const { state, ids } = cindyWith(code);
      const { state: after } = driveEventsPicking(SILK_DEPS, state, firstLegal, cindy(state));
      expect(encounterDiscard(after), code).toContain(ids[0]);
      expect(handOf(after), code).toBe(8);
    }
  });

  it("a card that is not tucked here cannot pay: naming a card in hand is refused", () => {
    const { state } = cindyWith(MERC);
    const result = applyCommand(state, cindy(state, playerOf(state, P1).hand[0]), SILK_DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
  });

  it("limit once per round: with 2 tucked the second use this round is refused; 1 stays tucked and the hand stays at 8", () => {
    const { state, ids } = cindyWith(MERC, SANDMAN);
    const { state: once } = driveEventsPicking(SILK_DEPS, state, firstLegal, cindy(state, ids[0]));
    expect(tuckedOf(once)).toEqual([ids[1]]);
    expect(listed(once)).not.toBe("legal");
    expect(applyCommand(once, cindy(once), SILK_DEPS).ok).toBe(false);
    expect([tuckedOf(once).length, handOf(once)]).toEqual([1, 8]);
  });

  it("the limit is per round: after the villain phase, back in alter-ego form on her next turn, the second tucked card pays it", () => {
    const { state, ids } = cindyWith(MERC, SANDMAN);
    const { state: once } = driveEventsPicking(SILK_DEPS, state, firstLegal, cindy(state, ids[0]));
    const { state: next } = driveEventsPicking(SILK_DEPS, once, firstLegal, { type: "endTurn", playerId: P1 });
    expect(next.outcome).toBeNull();
    expect(playerOf(next, P1).identity.form).toBe("alterEgo");
    expect(tuckedOf(next)).toEqual([ids[1]]);
    expect(listed(next)).toBe("legal");
    const before = handOf(next);
    const { state: twice } = driveEventsPicking(SILK_DEPS, next, firstLegal, cindy(next));
    expect(tuckedOf(twice)).toEqual([]);
    expect(encounterDiscard(twice)).toContain(ids[1]);
    expect(handOf(twice)).toBe(before + 2);
  });

  it("alter-ego face only: in hero form (Silk) the action is not available, with a card tucked", () => {
    const { state } = cindyWith(MERC);
    const silk = withForm(state, { heroForm: 0 });
    expect(listed(silk)).not.toBe("legal");
    expect(applyCommand(silk, cindy(silk), SILK_DEPS).ok).toBe(false);
    expect(tuckedOf(silk)).toHaveLength(1);
  });
});
