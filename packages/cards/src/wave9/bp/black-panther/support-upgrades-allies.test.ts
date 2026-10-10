import { BP_CARDS, cardId, type AllyCard, type UpgradeCard } from "@mc/content";
import { activeEncounterDeck, applyCommand, legalActions, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../../testing/staging.js";
import { BP_DEPS, attachUpgrade, bpGame, bpHeroGame, putInPlay } from "../testing.js";
import {
  BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES as REGISTRY,
  BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES_SKIPPED as SKIPPED,
} from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Black Panther's ally, supports and upgrades (51002, 51007 to 51013), docs/phase7-wave9.md section 3.36. The real
 * precon `bp-justice` against Rhino; the upgrades' Specials are resolved through the cards that name them (the hero's
 * response, T'Challa's, Wakanda Forever!, Clawed Strike, On the Prowl), exactly as in a game.
 */
const TCHALLA = "51002";
const TRUNK = "51007";
const RAMONDA = "51008";
const AJA = "51009";
const KIMOYO = "51010";
const CLAWS = "51011";
const BITES = "51012";
const SUIT = "51013";
const REFS = {
  [TCHALLA]: "51002.tchalla-response",
  [TRUNK]: "51007.the-elephants-trunk-action",
  [RAMONDA]: "51008.queen-ramonda-action",
  [AJA]: "51009.aja-adanna-action",
  [KIMOYO]: "51010.kimoyo-beads-special",
  [CLAWS]: "51011.panther-claws-special",
  [BITES]: "51012.spider-bites-special",
  [SUIT]: "51013.vibranium-suit-special",
} as const;
const HERO_RESPONSE = "51001a.black-panther-response";
const SCHEME_THREAT = 5;

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const threat = (s: GameState): number => inst(s, schemeOf(s)).threat;
const damage = (s: GameState): number => inst(s, villainOf(s)).damage;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const inDiscard = (s: GameState, id: InstanceId): boolean => playerOf(s, P1).discard.includes(id);
const card = <T>(code: string): T => BP_CARDS.find((c) => c.id === cardId(code)) as T;

/** Hero form, the main scheme at 5 threat, these upgrades attached (surgery, any number). */
function stage(...codes: readonly string[]): { state: GameState; ids: Record<string, InstanceId> } {
  const hero = bpHeroGame();
  let state = patchInstance(hero, schemeOf(hero), { threat: SCHEME_THREAT });
  const ids: Record<string, InstanceId> = {};
  for (const code of codes) {
    const put = attachUpgrade(state, code);
    state = put.state;
    ids[code] = put.id;
  }
  return { state, ids };
}

interface Picks {
  /** Accept an optional response whose id ends with this. */
  readonly respond?: string;
  /** Take the "Discard ..." option of a "you may discard" choice. */
  readonly discard?: boolean;
  /** The upgrade (by code) a "which Special" prompt takes. */
  readonly upgrade?: string;
  /** The order (codes) of an `orderSpecials` prompt. */
  readonly order?: readonly string[];
  /** The target card (instance) a `chooseTarget` takes when offered. */
  readonly target?: InstanceId;
}
const picker =
  (p: Picks = {}): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const kind = choice.prompt.kind;
    if (kind === "chooseTriggers") {
      const mine = p.respond ? choice.options.find((o) => o.optionId.endsWith(p.respond!)) : undefined;
      return mine ? [mine.optionId] : firstLegal(s);
    }
    if (kind === "chooseTarget") {
      const byId = p.target ? choice.options.find((o) => o.optionId === p.target) : undefined;
      const byCode = p.upgrade
        ? choice.options.find((o) => codeOf(s, o.optionId as InstanceId) === p.upgrade)
        : undefined;
      const hit = byId ?? byCode;
      return hit ? [hit.optionId] : firstLegal(s);
    }
    if (kind === "chooseOption") {
      const hit = choice.options.find((o) => o.label.startsWith(p.discard ? "Discard" : "Do not"));
      return hit ? [hit.optionId] : firstLegal(s);
    }
    if (kind === "orderSpecials" && p.order) {
      return p.order.map(
        (code) => choice.options.find((o) => codeOf(s, o.optionId.split(":")[0] as InstanceId) === code)!.optionId,
      );
    }
    if (kind === "declareDefender") return [identityOf(s)];
    return firstLegal(s);
  };

const thwart = (s: GameState): Parameters<typeof runWith>[2] => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: identityOf(s),
  schemeInstanceId: schemeOf(s),
});
const attack = (s: GameState): Parameters<typeof runWith>[2] => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s),
  targetInstanceId: villainOf(s),
});

/** Plays the event `code` from hand paying `cost` other cards, answering prompts with `pick`. */
function playEvent(state: GameState, code: string, cost: number, pick: Picker) {
  const given = moveToHand(state, P1, code);
  const event = given.ids[0]!;
  return driveEventsPicking(BP_DEPS, given.state, pick, play(P1, event, payWith(given.state, P1, cost, [event])));
}

/** One Sentinel Mark IV (a patrol-less minion) from the encounter deck, engaged with P1. */
function withMinion(state: GameState): { state: GameState; id: InstanceId } {
  const id = activeEncounterDeck(state).deck[0]!;
  const pile = activeEncounterDeck(state);
  const sentinel = cardId("32093");
  const patched = patchInstance(state, id, { cardId: sentinel, faceup: true, engagedWith: P1 });
  const cardDef = state.cardPool[sentinel];
  if (!cardDef) throw new Error("Sentinel Mark IV is not in the pool");
  return {
    id,
    state: {
      ...patched,
      encounterDecks: {
        ...patched.encounterDecks,
        [patched.activeVillainId!]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard },
      },
      players: patched.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
    },
  };
}

describe("support-upgrades-allies registry", () => {
  const registered = Object.values(REFS);
  it("the eight registered refs validate", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([...registered].sort());
    for (const ref of registered) expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
  it("nothing is skipped; every printed ability id is registered", () => {
    expect(SKIPPED).toEqual({});
    for (const code of [TCHALLA, TRUNK, RAMONDA, AJA, KIMOYO, CLAWS, BITES, SUIT]) {
      const ids = card<AllyCard>(code).abilities.map((a) => a.id as string);
      expect(ids, code).toHaveLength(1);
      expect(ids[0]! in REGISTRY || ids[0]! in SKIPPED, code).toBe(true);
    }
  });
  it("the Specials and T'Challa have the right timing: three labels, Spider Bites none, T'Challa a hero response", () => {
    const label = (ref: string) => (REGISTRY[ref]! as unknown as { label?: readonly string[] }).label?.[0];
    expect(REGISTRY[REFS[KIMOYO]]!.trigger.kind).toBe("special");
    expect(label(REFS[KIMOYO])).toBe("thwart");
    expect(label(REFS[CLAWS])).toBe("attack");
    expect(label(REFS[SUIT])).toBe("attack");
    expect(label(REFS[BITES])).toBeUndefined();
    expect(REGISTRY[REFS[TCHALLA]]!.trigger).toMatchObject({ kind: "response", forced: false, form: "hero" });
  });
});

describe(`${REFS[KIMOYO]} (Kimoyo Beads 51010): Special (thwart) remove 1 threat; may discard to confuse an enemy`, () => {
  it("prints cost 2, upgrade, Black Panther and Tech", () => {
    const c = card<UpgradeCard>(KIMOYO);
    expect(c.cost).toBe(2);
    expect(c.traits.map(String)).toEqual(expect.arrayContaining(["BLACK PANTHER", "TECH"]));
  });
  it("after a basic thwart (5 to 3) the Special removes 1 more (2); declining the discard keeps the upgrade, no confusion", () => {
    const { state: s, ids } = stage(KIMOYO);
    const { state } = driveEventsPicking(BP_DEPS, s, picker({ respond: HERO_RESPONSE }), thwart(s));
    expect(threat(state)).toBe(2);
    expect(inst(state, ids[KIMOYO]!).attachedTo).toBe(identityOf(state));
    expect(inst(state, villainOf(state)).statuses.confused).toBe(0);
  });
  it("discarding it confuses the villain and puts the upgrade in the discard pile", () => {
    const { state: s, ids } = stage(KIMOYO);
    const { state } = driveEventsPicking(BP_DEPS, s, picker({ respond: HERO_RESPONSE, discard: true }), thwart(s));
    expect(threat(state)).toBe(2);
    expect(inst(state, villainOf(state)).statuses.confused).toBe(1);
    expect(inDiscard(state, ids[KIMOYO]!)).toBe(true);
    expect(inst(state, identityOf(state)).attachments).not.toContain(ids[KIMOYO]);
  });
});

describe(`${REFS[CLAWS]} (Panther Claws 51011): Special (attack) 2 damage; may discard for 3 additional with piercing`, () => {
  it("after a basic attack (1) the Special deals 2: 3 on the villain, the upgrade stays", () => {
    const { state: s, ids } = stage(CLAWS);
    const { state } = driveEventsPicking(BP_DEPS, s, picker({ respond: HERO_RESPONSE }), attack(s));
    expect(damage(state)).toBe(3);
    expect(inst(state, ids[CLAWS]!).attachedTo).toBe(identityOf(state));
  });
  it("discarding it makes the Special's attack 5 in one instance: 1 + 5 = 6, upgrade in the discard pile", () => {
    const { state: s, ids } = stage(CLAWS);
    const { state } = driveEventsPicking(BP_DEPS, s, picker({ respond: HERO_RESPONSE, discard: true }), attack(s));
    expect(damage(state)).toBe(6);
    expect(inDiscard(state, ids[CLAWS]!)).toBe(true);
  });
  it("piercing reaches all 5: through a tough status card the villain takes 5, while the plain 2 is stopped by it", () => {
    const { state: s } = stage(CLAWS);
    const toughVillain = patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, tough: 1 } });
    const pierced = playEvent(toughVillain, "51005", 1, picker({ discard: true })).state;
    expect(damage(pierced)).toBe(5);
    const plain = playEvent(toughVillain, "51005", 1, picker()).state;
    expect(damage(plain)).toBe(0);
    expect(inst(plain, villainOf(plain)).statuses.tough).toBe(0);
  });
});

describe(`${REFS[BITES]} (Spider Bites 51012): Special, 1 damage to the villain and each minion engaged with a player; may discard to stun them`, () => {
  it("with a minion engaged: 1 damage to the villain and 1 to the minion, upgrade kept, nobody stunned", () => {
    const { state: s, ids } = stage(BITES);
    const m = withMinion(s);
    const { state } = playEvent(m.state, "51005", 1, picker());
    expect(damage(state)).toBe(1);
    expect(inst(state, m.id).damage).toBe(1);
    expect(inst(state, villainOf(state)).statuses.stunned).toBe(0);
    expect(inst(state, m.id).statuses.stunned).toBe(0);
    expect(inst(state, ids[BITES]!).attachedTo).toBe(identityOf(state));
  });
  it("discarding it stuns the villain and the minion, and the upgrade goes to the discard pile", () => {
    const { state: s, ids } = stage(BITES);
    const m = withMinion(s);
    const { state } = playEvent(m.state, "51005", 1, picker({ discard: true }));
    expect(damage(state)).toBe(1);
    expect(inst(state, m.id).damage).toBe(1);
    expect(inst(state, villainOf(state)).statuses.stunned).toBe(1);
    expect(inst(state, m.id).statuses.stunned).toBe(1);
    expect(inDiscard(state, ids[BITES]!)).toBe(true);
  });
  it("is not an attack: it resolves while the hero is stunned (a labeled attack would be canceled)", () => {
    const { state: s } = stage(BITES);
    const stunned = patchInstance(s, identityOf(s), { statuses: { ...inst(s, identityOf(s)).statuses, stunned: 1 } });
    const { state } = playEvent(stunned, "51005", 1, picker());
    expect(damage(state)).toBe(1);
  });
});

describe(`${REFS[SUIT]} (Vibranium Suit 51013): Special (attack) move 1 damage from your hero to an enemy; may discard for a tough status card`, () => {
  it("a hero with 3 damage: it moves to the villain (hero 2, villain 1), upgrade kept", () => {
    const { state: s, ids } = stage(SUIT);
    const hurt = withDamage(s, identityOf(s), 3);
    const { state } = playEvent(hurt, "51005", 1, picker());
    expect(inst(state, identityOf(state)).damage).toBe(2);
    expect(damage(state)).toBe(1);
    expect(inst(state, ids[SUIT]!).attachedTo).toBe(identityOf(state));
    expect(inst(state, identityOf(state)).statuses.tough).toBe(0);
  });
  it("with 0 damage nothing moves; discarding still gives the hero a tough status card", () => {
    const { state: s, ids } = stage(SUIT);
    const { state } = playEvent(s, "51005", 1, picker({ discard: true }));
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(damage(state)).toBe(0);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(1);
    expect(inDiscard(state, ids[SUIT]!)).toBe(true);
  });
});

describe(`${REFS[TCHALLA]} (T'Challa 51002): Hero Response, after he uses a basic power resolve a Black Panther upgrade's Special`, () => {
  it("prints cost 4, ATK 2, THW 2, 3 hit points, unique", () => {
    const c = card<AllyCard>(TCHALLA);
    expect([c.cost, c.atk, c.thw, c.hp, c.unique]).toEqual([4, 2, 2, 3, true]);
  });
  it("his basic thwart removes 2 (5 to 3), takes 1 consequential damage, then Kimoyo Beads' Special removes 1 more: 2", () => {
    const { state: s } = stage(KIMOYO);
    const t = putInPlay(s, TCHALLA);
    const cmd = { type: "basicThwart", playerId: P1, thwarterInstanceId: t.id, schemeInstanceId: schemeOf(s) } as const;
    const { state } = driveEventsPicking(BP_DEPS, t.state, picker({ respond: REFS[TCHALLA] }), cmd);
    expect(threat(state)).toBe(2);
    expect(inst(state, t.id).damage).toBe(1);
  });
  it("his basic attack deals 2 and Panther Claws' Special 2 more: 4 on the villain", () => {
    const { state: s } = stage(CLAWS);
    const t = putInPlay(s, TCHALLA);
    const cmd = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: t.id,
      targetInstanceId: villainOf(s),
    } as const;
    const { state } = driveEventsPicking(BP_DEPS, t.state, picker({ respond: REFS[TCHALLA] }), cmd);
    expect(damage(state)).toBe(4);
  });
  it("in alter-ego form there is no response: only his own basic thwart's 2 comes off", () => {
    const { state: s } = stage(KIMOYO);
    const t = putInPlay(withForm(s, "alterEgo"), TCHALLA);
    const cmd = { type: "basicThwart", playerId: P1, thwarterInstanceId: t.id, schemeInstanceId: schemeOf(s) } as const;
    const { state } = driveEventsPicking(BP_DEPS, t.state, picker({ respond: REFS[TCHALLA] }), cmd);
    expect(threat(state)).toBe(3);
  });
});

describe(`${REFS[TRUNK]} (The Elephant's Trunk 51007): Alter-Ego Action, exhaust it and up to 2 other Wakanda allies and/or supports, draw 1 card for each card exhausted`, () => {
  const MANIFOLD = "51014";
  /** Shuri (alter-ego) with the Trunk and these others (by code) in play; hand and deck sizes read before the action. */
  function council(...codes: readonly string[]) {
    const trunk = putInPlay(bpGame(), TRUNK);
    let state = trunk.state;
    const others: InstanceId[] = [];
    for (const code of codes) {
      const put = putInPlay(state, code);
      state = put.state;
      others.push(put.id);
    }
    return { state, trunk: trunk.id, others };
  }
  const hand = (s: GameState): number => playerOf(s, P1).hand.length;
  const deck = (s: GameState): number => playerOf(s, P1).deck.length;
  const exhausted = (s: GameState, ...ids: readonly InstanceId[]) => ids.map((id) => inst(s, id).exhausted);
  const act = (s: GameState, trunk: InstanceId, picks?: readonly InstanceId[]) =>
    driveEventsPicking(BP_DEPS, s, picker(), use(P1, trunk, REFS[TRUNK], [], picks ? { exhausted: picks } : undefined));
  const refusal = (s: GameState, trunk: InstanceId, picks?: readonly InstanceId[]) => {
    const result = applyCommand(s, use(P1, trunk, REFS[TRUNK], [], picks ? { exhausted: picks } : undefined), BP_DEPS);
    return result.ok ? "accepted" : result.error.code;
  };

  it("prints cost 2, unique, Persona and Wakanda, and the cost validates as one pick of 1 to 3 that holds the card", () => {
    const c = card<AllyCard>(TRUNK);
    expect([c.type, c.cost, c.unique]).toEqual(["support", 2, true]);
    expect(c.traits.map(String)).toEqual(["PERSONA", "WAKANDA"]);
    expect(REGISTRY[REFS[TRUNK]]!.cost).toMatchObject({
      exhaustCards: { min: 1, max: 3, includesSelf: true, bind: "exhausted" },
    });
    expect(REGISTRY[REFS[TRUNK]]!.cost!.exhaustSelf).toBeUndefined();
  });
  it("alone (RRG 1.8 FAQ p. 65): exhausting only the Trunk pays, 1 card exhausted, 1 card drawn", () => {
    const t = council();
    const { state } = act(t.state, t.trunk);
    expect(exhausted(state, t.trunk)).toEqual([true]);
    expect([hand(state) - hand(t.state), deck(t.state) - deck(state)]).toEqual([1, 1]);
  });
  it("with 1 other (Queen Ramonda, a Wakanda support): 2 exhausted, 2 cards drawn", () => {
    const t = council(RAMONDA);
    const { state } = act(t.state, t.trunk, [t.trunk, t.others[0]!]);
    expect(exhausted(state, t.trunk, ...t.others)).toEqual([true, true]);
    expect([hand(state) - hand(t.state), deck(t.state) - deck(state)]).toEqual([2, 2]);
  });
  it("with 2 others (Queen Ramonda and the ally T'Challa): 3 exhausted, 3 cards drawn", () => {
    const t = council(RAMONDA, TCHALLA);
    const { state } = act(t.state, t.trunk, [t.trunk, ...t.others]);
    expect(exhausted(state, t.trunk, ...t.others)).toEqual([true, true, true]);
    expect([hand(state) - hand(t.state), deck(t.state) - deck(state)]).toEqual([3, 3]);
  });
  it("'up to 2 other': a third other (Manifold) is refused, and so are picks that leave the Trunk out", () => {
    const t = council(RAMONDA, TCHALLA, MANIFOLD);
    expect(refusal(t.state, t.trunk, [t.trunk, ...t.others])).toBe("invalid_choice");
    expect(refusal(t.state, t.trunk, [t.others[0]!, t.others[1]!])).toBe("invalid_choice");
    expect(exhausted(t.state, t.trunk, ...t.others)).toEqual([false, false, false, false]);
  });
  it("only Wakanda allies and supports count: Aja-Adanna (an upgrade) and Shuri herself (a Wakanda identity) are no picks", () => {
    const base = council(RAMONDA);
    const aja = attachUpgrade(base.state, AJA);
    expect(refusal(aja.state, base.trunk, [base.trunk, aja.id])).toBe("no_valid_target");
    expect(refusal(aja.state, base.trunk, [base.trunk, identityOf(aja.state)])).toBe("no_valid_target");
  });
  it("an already-exhausted Trunk cannot pay, even with two ready Wakanda cards named: not offered, refused, nothing drawn", () => {
    const t = council(RAMONDA, TCHALLA);
    const tired = patchInstance(t.state, t.trunk, { exhausted: true });
    const legal = legalActions(tired, P1, BP_DEPS);
    if (legal.kind !== "turn") throw new Error(legal.kind);
    expect(legal.legal.some((a) => a.action.kind === "useAbility" && a.action.instanceId === t.trunk)).toBe(false);
    expect(refusal(tired, t.trunk)).toBe("already_exhausted");
    expect(refusal(tired, t.trunk, [...t.others])).toBe("already_exhausted");
    expect(refusal(tired, t.trunk, [t.trunk, ...t.others])).toBe("already_exhausted");
    expect(exhausted(tired, ...t.others)).toEqual([false, false]);
  });
  it("an exhausted other is no pick, and the Trunk still pays alone: 1 card drawn", () => {
    const t = council(RAMONDA);
    const tired = patchInstance(t.state, t.others[0]!, { exhausted: true });
    expect(refusal(tired, t.trunk, [t.trunk, t.others[0]!])).toBe("already_exhausted");
    const { state } = act(tired, t.trunk);
    expect(hand(state) - hand(tired)).toBe(1);
  });
  it("legalActions' default pick is the Trunk alone with others ready, and that command draws 1 and exhausts only it", () => {
    const t = council(RAMONDA, TCHALLA);
    const legal = legalActions(t.state, P1, BP_DEPS);
    if (legal.kind !== "turn") throw new Error(legal.kind);
    const entry = legal.legal.find((a) => a.action.kind === "useAbility" && a.action.instanceId === t.trunk)!;
    expect(entry.example).toMatchObject({ type: "useAbility", costChoices: { exhausted: [t.trunk] } });
    const { state } = driveEventsPicking(BP_DEPS, t.state, picker(), entry.example);
    expect(exhausted(state, t.trunk, ...t.others)).toEqual([true, false, false]);
    expect(hand(state) - hand(t.state)).toBe(1);
    // With others able to pay the choice is the player's: a command naming no picks is not guessed at.
    expect(refusal(t.state, t.trunk)).toBe("invalid_choice");
  });
  it("it is an alter-ego action: refused in hero form", () => {
    const trunk = putInPlay(bpHeroGame(), TRUNK);
    expect(refusal(trunk.state, trunk.id)).not.toBe("accepted");
  });
});

describe(`${REFS[RAMONDA]} (Queen Ramonda 51008): Alter-Ego Action, exhaust, heal an alter-ego with Wakanda equal to its REC`, () => {
  it("prints cost 1, unique, Persona and Wakanda", () => {
    const c = card<AllyCard>(RAMONDA);
    expect([c.cost, c.unique]).toEqual([1, true]);
    expect(c.traits.map(String)).toEqual(expect.arrayContaining(["PERSONA", "WAKANDA"]));
  });
  it("Shuri (REC 4) with 6 damage is healed 4: 2 left, Ramonda exhausted", () => {
    const s = bpGame();
    const r = putInPlay(s, RAMONDA);
    const hurt = withDamage(r.state, identityOf(r.state), 6);
    const { state } = driveEventsPicking(BP_DEPS, hurt, picker(), use(P1, r.id, REFS[RAMONDA]));
    expect(inst(state, identityOf(state)).damage).toBe(2);
    expect(inst(state, r.id).exhausted).toBe(true);
  });
  it("with 3 damage it heals only what is there: 0 left", () => {
    const r = putInPlay(bpGame(), RAMONDA);
    const hurt = withDamage(r.state, identityOf(r.state), 3);
    const { state } = driveEventsPicking(BP_DEPS, hurt, picker(), use(P1, r.id, REFS[RAMONDA]));
    expect(inst(state, identityOf(state)).damage).toBe(0);
  });
  it("it is an alter-ego action: refused in hero form", () => {
    const r = putInPlay(bpHeroGame(), RAMONDA);
    const hurt = withDamage(r.state, identityOf(r.state), 3);
    expect(applyCommand(hurt, use(P1, r.id, REFS[RAMONDA]), BP_DEPS).ok).toBe(false);
  });
});

describe(`${REFS[AJA]} (Aja-Adanna 51009): Action, exhaust, shuffle 1 identity-specific card from your discard pile into your deck`, () => {
  it("only identity-specific cards are offered: Clawed Strike 51003 goes back into the 34-card deck, the aspect card does not", () => {
    const { state: s, ids } = stage(AJA);
    const given = moveToHand(s, P1, "51003", "51015");
    const [strike, aspect] = given.ids as [InstanceId, InstanceId];
    const discarded = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((i) => i !== strike && i !== aspect), discard: [...p.discard, strike, aspect] }
          : p,
      ),
    };
    const deckBefore = playerOf(discarded, P1).deck.length;
    const offered: string[] = [];
    const watch: Picker = (st) => {
      if (st.pendingChoice!.prompt.kind === "chooseCards")
        offered.push(...st.pendingChoice!.options.map((o) => o.optionId));
      return picker({ target: strike })(st);
    };
    const { state } = driveEventsPicking(BP_DEPS, discarded, watch, use(P1, ids[AJA]!, REFS[AJA]));
    expect(offered).toContain(strike);
    expect(offered).not.toContain(aspect);
    expect(playerOf(state, P1).deck).toHaveLength(deckBefore + 1);
    expect(playerOf(state, P1).discard).toContain(aspect);
    expect(playerOf(state, P1).discard).not.toContain(strike);
    expect(inst(state, ids[AJA]!).exhausted).toBe(true);
  });
});

describe("the identity response, the three events and the real Specials", () => {
  it("the hero response: a basic attack, then Panther Claws or Vibranium Suit as the player chooses", () => {
    const { state: s } = stage(CLAWS, KIMOYO);
    const claws = driveEventsPicking(BP_DEPS, s, picker({ respond: HERO_RESPONSE, upgrade: CLAWS }), attack(s)).state;
    expect([damage(claws), threat(claws)]).toEqual([3, SCHEME_THREAT]);
    const kimoyo = driveEventsPicking(BP_DEPS, s, picker({ respond: HERO_RESPONSE, upgrade: KIMOYO }), attack(s)).state;
    expect([damage(kimoyo), threat(kimoyo)]).toEqual([1, SCHEME_THREAT - 1]);
  });
  it("Clawed Strike deals 4, then Kimoyo Beads removes 1 threat and confuses when discarded", () => {
    const { state: s, ids } = stage(KIMOYO);
    const { state } = playEvent(s, "51003", 2, picker({ discard: true }));
    expect(damage(state)).toBe(4);
    expect(threat(state)).toBe(SCHEME_THREAT - 1);
    expect(inst(state, villainOf(state)).statuses.confused).toBe(1);
    expect(inDiscard(state, ids[KIMOYO]!)).toBe(true);
  });
  it("Clawed Strike with Panther Claws discarded: 4 + 5 = 9 on the villain", () => {
    const { state: s } = stage(CLAWS);
    expect(damage(playEvent(s, "51003", 2, picker({ discard: true })).state)).toBe(9);
    expect(damage(playEvent(s, "51003", 2, picker()).state)).toBe(6);
  });
  it("On the Prowl removes 3 (5 to 2), then Vibranium Suit moves 1 damage from the hero to Rhino", () => {
    const { state: s } = stage(SUIT);
    const hurt = withDamage(s, identityOf(s), 2);
    const { state } = playEvent(hurt, "51004", 2, picker());
    expect(threat(state)).toBe(SCHEME_THREAT - 3);
    expect(inst(state, identityOf(state)).damage).toBe(1);
    expect(damage(state)).toBe(1);
  });
  it("Wakanda Forever! resolves all four Specials in the chosen order: Suit, Bites, Claws, Kimoyo", () => {
    const { state: s } = stage(KIMOYO, CLAWS, BITES, SUIT);
    const hurt = withDamage(s, identityOf(s), 2);
    const { state } = playEvent(hurt, "51005", 1, picker({ order: [SUIT, BITES, CLAWS, KIMOYO] }));
    // Suit moves 1 (hero 1, villain 1), Bites 1 more (2), Claws 2 more (4), Kimoyo removes 1 threat.
    expect(inst(state, identityOf(state)).damage).toBe(1);
    expect(damage(state)).toBe(4);
    expect(threat(state)).toBe(SCHEME_THREAT - 1);
    expect(state.pendingChoice).toBeNull();
  });
});
