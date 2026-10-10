import { SILK_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  characterProfile,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { cards, defineAbilities, tuckCards, whenRevealed, yourIdentity } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, playFromHand, withForm } from "../../../testing/staging.js";
import { SILK_DEPS, silkGame, silkHeroGame, tuckEncounterCard } from "../testing.js";
import {
  SILK_OBLIGATION_NEMESIS as REGISTRY,
  SILK_OBLIGATION_NEMESIS_SKIPPED as SKIPPED,
} from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * Silk's obligation and nemesis set (52028 Silk Sense Overload; 52029 Morlun, 52030 The Great Hunt, 52031 Hunting the
 * Spider-Bride), docs/phase7-wave9.md section 8.4, 3.39, 3.40. The printed precon `silk-protection` against Rhino (ATK
 * 2, SCH 1). The obligation is in the encounter deck and is revealed through a real villain phase; the nemesis set is
 * set aside, so its cards are moved by surgery. Core cards stand in for the rest: Hydra Mercenary 01101, Sandman 01102,
 * Shocker 01103 (minions), Hard to Keep Down 01104 and "I'm Tough!" 01105 (treacheries), Advance 01186 (0 boost icons).
 *
 * Owner decision Q7 = A (provisional): a discard a player card causes (cost, effect, the four-card cap) deals the
 * Spider-Bride's 2 damage; an encounter card's discard does not. The tests that rest on it carry "Q7" in their names.
 */
const OVERLOAD = "52028";
const MORLUN = "52029";
const HUNT = "52030";
const BRIDE = "52031";
const INTERRUPT = "52028.silk-sense-overload-forced-interrupt";
const BRIDE_RESPONSE = "52031.hunting-the-spider-bride-forced-response";
const REFS = [
  "52028.silk-sense-overload-constant",
  INTERRUPT,
  "52029.morlun-constant",
  "52029.when-defeated",
  "52030.when-revealed",
  BRIDE_RESPONSE,
];
const MERC = "01101";
const SANDMAN = "01102";
const SHOCKER = "01103";
const HARD = "01104";
const TOUGH = "01105";
const ADVANCE = "01186";
const CINDY_ACTION = "52001b.cindy-moon-action";

const data = (code: string) => SILK_CARDS.find((c) => (c.id as string) === code)! as any;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const tuckedUnder = (s: GameState, host: InstanceId): readonly InstanceId[] => inst(s, host).tucked;
const tuckedOf = (s: GameState, player = P1): readonly InstanceId[] => tuckedUnder(s, identityOf(s, player));
const encounterPiles = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
const encounterDiscard = (s: GameState): readonly InstanceId[] => encounterPiles(s).discard;
const damageOf = (s: GameState, id: InstanceId = identityOf(s)): number => inst(s, id).damage;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const inPlayArea = (s: GameState, id: InstanceId): boolean => playerOf(s, P1).playArea.includes(id);
const profile = (s: GameState, id: InstanceId, deps: EngineDeps = SILK_DEPS) => characterProfile(s, id, deps)!;

/** Declines to defend; otherwise the first legal answer. */
const picker =
  (choose?: (s: GameState) => readonly string[] | undefined): Picker =>
  (s) => {
    if (s.pendingChoice!.prompt.kind === "declareDefender") return ["decline"];
    return choose?.(s) ?? firstLegal(s);
  };
const pickLabel = (label: string) =>
  picker((s) => {
    const hit = s.pendingChoice!.options.find((o) => o.label.startsWith(label));
    return hit ? [hit.optionId] : undefined;
  });
const run = (s: GameState, pick: Picker, ...commands: readonly Command[]) =>
  driveEventsPicking(SILK_DEPS, s, pick, ...commands);
const endRound = (s: GameState, pick: Picker = picker()) => run(s, pick, endTurn(P1));

/** The first set-aside copy of `code` of P1's, removed from the set-aside cards. */
function fromSetAside(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const id = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no set-aside ${code}`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p,
      ),
    },
  };
}
/** A set-aside copy of `code` tucked faceup under `host` (default P1's identity). */
function tuckSetAside(state: GameState, code: string, host?: InstanceId): { state: GameState; id: InstanceId } {
  const found = fromSetAside(state, code);
  const under = host ?? identityOf(found.state);
  return {
    id: found.id,
    state: {
      ...patchInstance(found.state, found.id, { faceup: true }),
      instances: {
        ...patchInstance(found.state, found.id, { faceup: true }).instances,
        [under]: { ...found.state.instances[under]!, tucked: [...found.state.instances[under]!.tucked, found.id] },
      },
      stateChecks: {
        ...found.state.stateChecks,
        [`${under}:52001a.silk-constant`]: false,
        [`${under}:52001b.cindy-moon-constant`]: false,
      },
    },
  };
}
/** A set-aside copy of `code` on top of the encounter deck, after the cards of `stackEncounterDeck` already there. */
function setAsideToDeckTop(state: GameState, code: string, behind = 0): { state: GameState; id: InstanceId } {
  const found = fromSetAside(state, code);
  const deckId = activeEncounterDeckId(found.state);
  const pile = found.state.encounterDecks[deckId]!;
  return {
    id: found.id,
    state: {
      ...found.state,
      encounterDecks: {
        ...found.state.encounterDecks,
        [deckId]: { ...pile, deck: [...pile.deck.slice(0, behind), found.id, ...pile.deck.slice(behind)] },
      },
    },
  };
}
/** A set-aside minion engaged with P1, faceup, as if revealed earlier. */
function engagedMorlun(state: GameState, damage = 0): { state: GameState; id: InstanceId } {
  const found = fromSetAside(state, MORLUN);
  return {
    id: found.id,
    state: {
      ...found.state,
      players: found.state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, found.id] } : p)),
      instances: {
        ...found.state.instances,
        [found.id]: { ...found.state.instances[found.id]!, faceup: true, controllerId: null, engagedWith: P1, damage },
      },
    },
  };
}
/** The set-aside side scheme `code` in the villain area with `threat`. */
function sideSchemeIn(state: GameState, code: string, threat: number): { state: GameState; id: InstanceId } {
  const found = fromSetAside(state, code);
  return {
    id: found.id,
    state: {
      ...found.state,
      villainArea: [...found.state.villainArea, found.id],
      instances: {
        ...found.state.instances,
        [found.id]: { ...found.state.instances[found.id]!, faceup: true, threat },
      },
    },
  };
}
/** The state at the start of the next player phase after the obligation is revealed to P1 (Advance is Rhino's boost card). */
function withOverload(start: GameState = silkGame()): { state: GameState; id: InstanceId } {
  const { state } = endRound(stackEncounterDeck(start, ADVANCE, OVERLOAD));
  return { state, id: instancesOf(state, OVERLOAD)[0]! };
}
/** A card kept calm: the main scheme emptied so a long test cannot end the game. */
const calm = (s: GameState): GameState => patchInstance(s, s.mainScheme.instanceId, { threat: 0 });
/** The top of the encounter deck made into `codes` (stack order), so what a tuck from it takes is known. */
const stacked = (s: GameState, ...codes: string[]): GameState => stackEncounterDeck(s, ...codes);

const kinds = (events: readonly GameEvent[], ref: string): number =>
  events.filter((e) => e.type === "abilityResolved" && (e as { abilityId?: string }).abilityId === ref).length;

describe("registry", () => {
  it("registers every printed ref but the Spider-Bride's When Revealed, which is skipped with its reason", () => {
    const printed = [OVERLOAD, MORLUN, HUNT, BRIDE].flatMap((c) => abilityRefIds(data(c)));
    expect([...printed].sort()).toEqual([...REFS, "52031.when-revealed"].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual(["52031.when-revealed"]);
    expect(SKIPPED["52031.when-revealed"]).toContain("random");
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!)).toEqual([]);
  });
  it("timing: Overload is a forced `would` interrupt, Morlun's and the Hunt's are When Defeated / When Revealed, the Bride answers from under a card", () => {
    expect(REGISTRY[INTERRUPT]!.trigger).toMatchObject({ kind: "interrupt", forced: true, would: true });
    expect(REGISTRY["52029.when-defeated"]!.trigger).toMatchObject({ kind: "whenDefeated" });
    expect(REGISTRY["52030.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(REGISTRY[BRIDE_RESPONSE]!).toMatchObject({
      activeIn: "tucked",
      trigger: { kind: "response", forced: true },
    });
  });
});

describe("the printed cards", () => {
  it("Silk Sense Overload: an obligation, 2 boost icons, in no encounter set, given to the Cindy Moon player", () => {
    expect(data(OVERLOAD)).toMatchObject({ type: "obligation", boostIcons: 2, encounterSetIds: [] });
    expect(data(OVERLOAD).text.current).toContain("Give to the Cindy Moon player.");
  });
  it("Morlun: unique elite Inheritor minion, ATK 1, SCH 1, 5 hit points, 3 boost icons, no keywords", () => {
    expect(data(MORLUN)).toMatchObject({ type: "minion", atk: 1, sch: 1, hp: 5, boostIcons: 3, unique: true });
    expect(data(MORLUN).traits).toEqual(["ELITE", "INHERITOR"]);
    expect(data(MORLUN).keywords).toEqual([]);
    expect(data(MORLUN).text.current).not.toContain("</b>");
  });
  it("The Great Hunt: a side scheme with 2 threat flat (nothing per player), a hazard icon, 2 boost icons", () => {
    expect(data(HUNT)).toMatchObject({ type: "side_scheme", startingThreat: { base: 2, perPlayer: 0 }, boostIcons: 2 });
    expect(data(HUNT).icons).toEqual(["hazard"]);
  });
  it("Hunting the Spider-Bride: 3 copies, Surge, 1 boost icon; no card has boost text of its own", () => {
    expect(data(BRIDE)).toMatchObject({ type: "treachery", quantityInSet: 3, boostIcons: 1 });
    expect(data(BRIDE).keywords).toEqual([{ name: "surge" }]);
    for (const code of [OVERLOAD, MORLUN, HUNT, BRIDE]) expect(data(code).text.current).not.toMatch(/Boost:/);
  });
  it("setup: the obligation is in the encounter deck once; Morlun, the Hunt and three Brides are set aside", () => {
    const s = silkGame();
    expect(encounterPiles(s).deck.filter((i) => codeOf(s, i) === OVERLOAD)).toHaveLength(1);
    expect(playerOf(s, P1).setAside.map((i) => codeOf(s, i))).toEqual([MORLUN, HUNT, BRIDE, BRIDE, BRIDE]);
  });
});

describe("52028 Silk Sense Overload: given to the Cindy Moon player, it stays in play", () => {
  it("revealed in the villain phase it is in P1's play area (not discarded), with nothing tucked under it or Cindy", () => {
    const { state, id } = withOverload();
    expect(inPlayArea(state, id)).toBe(true);
    expect(encounterDiscard(state)).not.toContain(id);
    expect(tuckedUnder(state, id)).toEqual([]);
    expect(tuckedOf(state)).toEqual([]);
    expect(state.pendingChoice).toBeNull();
  });
});

describe(`${INTERRUPT}: a card a player card would tuck under Silk goes under the obligation instead`, () => {
  /** Albert Moon (cost 2) in play in alter-ego form; the tuck mode takes the top card of the encounter deck. */
  function albert(state: GameState) {
    return playFromHand(SILK_DEPS, state, "52006", 2);
  }
  const tuckWithAlbert = (s: GameState, albertId: InstanceId, pick: Picker) =>
    run(s, pick, use(P1, albertId, "52006.albert-moon-action"));
  const tuckMode = pickLabel("Tuck");

  it("Albert Moon's tuck is a player card's: Sandman goes under Overload (1), Silk has none, no prompt", () => {
    const base = withOverload();
    const a = albert(stacked(base.state, SANDMAN));
    const top = encounterPiles(a.state).deck[0]!;
    const { state } = tuckWithAlbert(a.state, a.id, tuckMode);
    expect(codeOf(state, top)).toBe(SANDMAN);
    expect(tuckedUnder(state, base.id)).toEqual([top]);
    expect(tuckedOf(state)).toEqual([]);
    expect(inPlayArea(state, base.id)).toBe(true);
    expect(state.pendingChoice).toBeNull();
    expect(inst(state, a.id).exhausted).toBe(true);
  });

  it("Smooth as Silk's tuck from the encounter discard pile is a player card's: Sandman goes under Overload", () => {
    const base = withOverload(silkHeroGame());
    const hero = withForm(base.state, { heroForm: 0 });
    const s = stacked(hero, ADVANCE, SANDMAN);
    const sandman = encounterPiles(s).deck[1]!;
    const given = moveToHand(s, P1, "52002");
    const event = given.ids[0]!;
    const { state } = run(
      given.state,
      picker((x) => (x.pendingChoice!.options.some((o) => o.optionId === villainOf(x)) ? [villainOf(x)] : undefined)),
      play(P1, event, payWith(given.state, P1, 0, [event])),
    );
    expect(tuckedUnder(state, base.id)).toEqual([sandman]);
    expect(tuckedOf(state)).toEqual([]);
    expect(encounterDiscard(state)).toContain(encounterPiles(state).discard.find((i) => codeOf(state, i) === ADVANCE));
  });

  it("Silk Sense (the identity's own response) is a player card's too: the defeated minion goes under Overload", () => {
    const base = withOverload(silkHeroGame());
    const hero = withForm(base.state, { heroForm: 0 });
    // Hydra Mercenary (3 hit points) engaged with 2 damage on it: Silk's basic attack (ATK 2) defeats it.
    const id = encounterPiles(hero).deck.find((i) => codeOf(hero, i) === MERC)!;
    const placed = {
      ...hero,
      encounterDecks: {
        ...hero.encounterDecks,
        [activeEncounterDeckId(hero)]: {
          deck: encounterPiles(hero).deck.filter((i) => i !== id),
          discard: encounterPiles(hero).discard,
        },
      },
      players: hero.players.map((p) => ({ ...p, playArea: [...p.playArea, id] })),
    };
    const wounded = patchInstance(placed, id, { faceup: true, controllerId: null, engagedWith: P1, damage: 2 });
    const takeSense = picker((x) => {
      const mine = x.pendingChoice!.options.find((o) => o.optionId.endsWith("52001a.silk-sense"));
      return mine ? [mine.optionId] : undefined;
    });
    const { state } = run(wounded, takeSense, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(wounded),
      targetInstanceId: id,
    });
    expect(tuckedUnder(state, base.id)).toEqual([id]);
    expect(tuckedOf(state)).toEqual([]);
  });

  it("Get the Scoop's When Defeated tuck (a player side scheme) is a player card's: it goes under Overload", () => {
    const base = withOverload();
    const given = moveToHand(stacked(base.state, SANDMAN, SHOCKER), P1, "52005");
    const scoop = given.ids[0]!;
    const played = run(given.state, picker(), play(P1, scoop, [])).state;
    const almost = patchInstance(played, scoop, { threat: 2 });
    const second = encounterPiles(almost).deck[1]!;
    const { state } = run(
      almost,
      picker((x) =>
        x.pendingChoice!.prompt.kind === "chooseCards" && x.pendingChoice!.options.some((o) => o.optionId === second)
          ? [second]
          : undefined,
      ),
      use(P1, scoop, "52005.get-the-scoop-action"),
    );
    expect(codeOf(state, second)).toBe(SHOCKER);
    expect(tuckedUnder(state, base.id)).toEqual([second]);
    expect(tuckedOf(state)).toEqual([]);
  });

  /** "I'm Tough!" (01105) borrowed: when revealed it also tucks itself under its player, an encounter card's tuck. */
  const SELF_TUCK = "01105.test-self-tuck";
  const borrowedDeps: EngineDeps = {
    abilities: {
      ...SILK_DEPS.abilities,
      ...defineAbilities({ [SELF_TUCK]: whenRevealed(tuckCards(cards({ kind: "self" }), yourIdentity)) }),
    },
  };
  it("an encounter card's own tuck is not redirected: a treachery tucking itself lands under Silk, Overload stays empty", () => {
    const base = withOverload();
    const id = cardId(TOUGH);
    const card = base.state.cardPool[id]!;
    if (!("abilities" in card)) throw new Error("no abilities list");
    const pooled = {
      ...base.state,
      cardPool: { ...base.state.cardPool, [id]: { ...card, abilities: [...card.abilities, { id: SELF_TUCK }] } },
    } as GameState;
    const staged = calm(stacked(pooled, ADVANCE, TOUGH));
    const tough = encounterPiles(staged).deck[1]!;
    const { state } = driveEventsPicking(borrowedDeps, staged, picker(), endTurn(P1));
    expect(tuckedOf(state)).toEqual([tough]);
    expect(tuckedUnder(state, base.id)).toEqual([]);
  });

  it("a swap with a tucked card (Eidetic Memory) is no tuck: the obligation gets nothing and the count under Silk is unchanged", () => {
    const base = withOverload(silkHeroGame());
    const hero = withForm(base.state, { heroForm: 0 });
    const memory = playFromHand(SILK_DEPS, hero, "52008", 1);
    const under = tuckEncounterCard(memory.state, HARD);
    const dealt = encounterPiles(stacked(under.state, ADVANCE, SHOCKER)).deck;
    const s = stacked(under.state, ADVANCE, SHOCKER);
    const shocker = encounterPiles(s).deck[1]!;
    expect(dealt.length).toBeGreaterThan(0);
    const { state } = run(
      s,
      picker((x) => {
        const mine = x.pendingChoice!.options.find((o) => o.optionId.endsWith("52008.eidetic-memory-interrupt"));
        return mine ? [mine.optionId] : undefined;
      }),
      endTurn(P1),
    );
    expect(tuckedOf(state)).toEqual([shocker]);
    expect(tuckedUnder(state, base.id)).toEqual([]);
  });

  describe('the count after the redirected tuck (the "Then" reads it): 1 stays, 2 offers a discard, 3 removes it', () => {
    /** Overload with `n` cards already under it by surgery, Albert in play and Sandman on top of the encounter deck. */
    function holding(n: number) {
      const base = withOverload();
      let s = base.state;
      const under: InstanceId[] = [];
      for (const code of [MERC, SHOCKER].slice(0, n)) {
        const t = tuckEncounterCard(s, code, base.id);
        s = t.state;
        under.push(t.id);
      }
      const a = albert(stacked(s, SANDMAN));
      return { ...base, state: a.state, albert: a.id, under, sandman: encounterPiles(a.state).deck[0]! };
    }
    it("the first (1 under it): nothing is asked and the obligation stays in play", () => {
      const h = holding(0);
      const rec: string[] = [];
      const { state } = tuckWithAlbert(h.state, h.albert, (s) => {
        rec.push(s.pendingChoice!.prompt.kind);
        return tuckMode(s);
      });
      expect(tuckedUnder(state, h.id)).toEqual([h.sandman]);
      expect(inPlayArea(state, h.id)).toBe(true);
      expect(rec).toEqual(["chooseOption"]); // Albert's own mode choice, and nothing from Overload
    });
    it("the second (2 under it): the player is asked; discarding it sends it and the 2 cards under it to the encounter discard pile", () => {
      const h = holding(1);
      const rec: string[] = [];
      const { state, events } = tuckWithAlbert(h.state, h.albert, (s) => {
        rec.push(s.pendingChoice!.options.map((o) => o.label).join("|"));
        return pickLabel("Discard")(s);
      });
      expect(rec).toHaveLength(2); // Albert's mode, then "discard it?"
      expect(rec[1]).toContain("Keep Silk Sense Overload");
      expect(inPlayArea(state, h.id)).toBe(false);
      expect(encounterDiscard(state)).toEqual(expect.arrayContaining([h.id, h.under[0]!, h.sandman]));
      expect(state.removedFromGame).not.toContain(h.id);
      expect(tuckedOf(state)).toEqual([]);
      // The game discards the cards under a card that leaves play: no player card is the cause.
      expect(ofType(events, "cardMoved").length).toBeGreaterThan(0);
    });
    it("the second, declined: it stays with 2 under it (Silk has none)", () => {
      const h = holding(1);
      const { state } = tuckWithAlbert(h.state, h.albert, pickLabel("Keep"));
      expect(inPlayArea(state, h.id)).toBe(true);
      expect(tuckedUnder(state, h.id)).toEqual([h.under[0], h.sandman]);
      expect(tuckedOf(state)).toEqual([]);
    });
    it("the third (3 under it): no prompt; it is removed from the game and the 3 cards go to the encounter discard pile", () => {
      const h = holding(2);
      const rec: string[] = [];
      const { state } = tuckWithAlbert(h.state, h.albert, (s) => {
        rec.push(s.pendingChoice!.prompt.kind);
        return tuckMode(s);
      });
      expect(rec).toEqual(["chooseOption"]); // Albert's own mode choice, and nothing from Overload
      expect(state.removedFromGame).toContain(h.id);
      expect(inPlayArea(state, h.id)).toBe(false);
      expect(encounterDiscard(state)).toEqual(expect.arrayContaining([...h.under, h.sandman]));
      expect(encounterDiscard(state)).not.toContain(h.id);
      expect(tuckedOf(state)).toEqual([]);
    });
  });

  it("cards under it when it leaves are discarded by the game, not by a player card: a Spider-Bride under it deals no damage", () => {
    const base = withOverload();
    const withBride = tuckSetAside(base.state, BRIDE, base.id);
    const second = tuckEncounterCard(withBride.state, SHOCKER, base.id);
    const a = albert(stacked(second.state, SANDMAN));
    const { state } = tuckWithAlbert(a.state, a.id, pickLabel("Tuck"));
    // Three under it: removed from the game; the Bride is discarded from under an obligation, not an identity.
    expect(state.removedFromGame).toContain(base.id);
    expect(encounterDiscard(state)).toContain(withBride.id);
    expect(damageOf(state)).toBe(0);
  });
});

/** The top `n` cards of the encounter deck turned into Advance (0 boost icons, a harmless reveal). */
function fillers(state: GameState, n: number): GameState {
  const top = encounterPiles(state).deck.slice(0, n);
  return top.reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(ADVANCE) }), state);
}
const declineSense: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
const attackOn = (s: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s),
  targetInstanceId: target,
});
/** A card of P1's hand tucked under `host` by surgery (a player card among the tucked cards). */
function tuckFromHand(state: GameState, host: InstanceId): { state: GameState; id: InstanceId } {
  const id = playerOf(state, P1).hand[0]!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true },
        [host]: { ...state.instances[host]!, tucked: [...state.instances[host]!.tucked, id] },
      },
    },
  };
}

describe("52029 Morlun: +1 SCH and +1 ATK for each encounter card tucked under each identity", () => {
  it("with nothing tucked he is ATK 1, SCH 1 with 5 hit points", () => {
    const m = engagedMorlun(silkGame());
    expect([profile(m.state, m.id).atk, profile(m.state, m.id).sch, profile(m.state, m.id).maxHp]).toEqual([1, 1, 5]);
  });
  it("2 tucked under Silk: ATK 3, SCH 3; with 1 more under another player's identity: ATK 4, SCH 4", () => {
    let s = silkGame({ twoPlayers: true });
    const m = engagedMorlun(s);
    s = m.state;
    s = tuckEncounterCard(tuckEncounterCard(s, MERC).state, SANDMAN).state;
    expect([profile(s, m.id).atk, profile(s, m.id).sch]).toEqual([3, 3]);
    s = tuckEncounterCard(s, SHOCKER, identityOf(s, P2)).state;
    expect([profile(s, m.id).atk, profile(s, m.id).sch]).toEqual([4, 4]);
  });
  it("a player card tucked under an identity is not an encounter card, and a card under Overload is not under an identity", () => {
    const base = withOverload();
    const m = engagedMorlun(base.state);
    let s = tuckFromHand(m.state, identityOf(m.state)).state;
    expect(tuckedOf(s)).toHaveLength(1);
    s = tuckEncounterCard(s, MERC, base.id).state;
    expect([profile(s, m.id).atk, profile(s, m.id).sch]).toEqual([1, 1]);
    s = tuckEncounterCard(s, SANDMAN).state;
    expect([profile(s, m.id).atk, profile(s, m.id).sch]).toEqual([2, 2]);
  });
  it("revealed in a villain phase he engages Silk with his printed stats; the next villain phase he schemes for 3 with 2 tucked", () => {
    let s = fillers(silkGame(), 6);
    const placed = setAsideToDeckTop(s, MORLUN, 1);
    const morlun = placed.id;
    s = tuckEncounterCard(tuckEncounterCard(placed.state, MERC).state, SANDMAN).state;
    const revealed = endRound(calm(s));
    expect(inst(revealed.state, morlun).engagedWith).toBe(P1);
    expect(inPlayArea(revealed.state, morlun)).toBe(true);
    expect(profile(revealed.state, morlun).sch).toBe(3);
  });
  it("hero form, 2 tucked, engaged: Rhino's attack (2) and Morlun's (ATK 3) leave Silk 5 damage when she does not defend", () => {
    let s = withForm(silkHeroGame(), { heroForm: 0 });
    s = tuckEncounterCard(tuckEncounterCard(s, MERC).state, SANDMAN).state;
    const m = engagedMorlun(s);
    const staged = fillers(m.state, 6);
    const { state } = endRound(calm(staged));
    expect(damageOf(state)).toBe(5);
  });
  it("alter-ego form, 2 tucked: Morlun's scheme puts 3 threat on the main scheme (SCH 1 + 2)", () => {
    const base = silkGame();
    const tucked = tuckEncounterCard(tuckEncounterCard(base, MERC).state, SANDMAN).state;
    const control = endRound(calm(fillers(tucked, 6))).state;
    const withMorlun = endRound(calm(fillers(engagedMorlun(tucked).state, 6))).state;
    expect(mainThreat(withMorlun) - mainThreat(control)).toBe(3);
  });

  describe("When Defeated: discard each copy of Hunting the Spider-Bride tucked under each identity (an encounter card's discard)", () => {
    it("2 Brides and Sandman under Silk and a Bride under another identity: both Brides and the third go, Sandman stays, no damage", () => {
      let s = withForm(silkGame({ twoPlayers: true }), { heroForm: 0 });
      const b1 = tuckSetAside(s, BRIDE);
      const b2 = tuckSetAside(b1.state, BRIDE);
      const b3 = tuckSetAside(b2.state, BRIDE, identityOf(b2.state, P2));
      const sandman = tuckEncounterCard(b3.state, SANDMAN);
      s = sandman.state;
      const m = engagedMorlun(s, 4);
      const { state } = run(m.state, declineSense, attackOn(m.state, m.id));
      expect(inPlayArea(state, m.id)).toBe(false);
      expect(encounterDiscard(state)).toEqual(expect.arrayContaining([b1.id, b2.id, b3.id]));
      expect(tuckedOf(state)).toEqual([sandman.id]);
      expect(tuckedOf(state, P2)).toEqual([]);
      expect(damageOf(state)).toBe(0);
      expect(damageOf(state, identityOf(state, P2))).toBe(0);
    });
    it("nothing tucked: nothing is discarded and he is simply defeated", () => {
      const m = engagedMorlun(withForm(silkGame(), { heroForm: 0 }), 4);
      const { state } = run(m.state, declineSense, attackOn(m.state, m.id));
      expect(inPlayArea(state, m.id)).toBe(false);
      expect(damageOf(state)).toBe(0);
    });
  });
});

describe("52030 The Great Hunt: 2 threat, and 1 additional for each card tucked under each identity", () => {
  /** The Hunt revealed to P1 in the villain phase: behind Rhino's boost card, with fillers around it. */
  function reveal(state: GameState, players: 1 | 2 = 1) {
    const staged = setAsideToDeckTop(fillers(state, 6), HUNT, players); // one boost card per player: Rhino activates against each;
    const commands = players === 1 ? [endTurn(P1)] : [endTurn(P1), endTurn(P2)];
    return { ...run(calm(staged.state), picker(), ...commands), id: staged.id };
  }
  it("with nothing tucked it enters the villain area with its printed 2 threat", () => {
    const r = reveal(silkGame());
    expect(r.state.villainArea).toContain(r.id);
    expect(inst(r.state, r.id).threat).toBe(2);
  });
  it("3 tucked under Silk: 2 + 3 = 5 threat", () => {
    let s = silkGame();
    for (const code of [MERC, SANDMAN, SHOCKER]) s = tuckEncounterCard(s, code).state;
    const r = reveal(s);
    expect(inst(r.state, r.id).threat).toBe(5);
  });
  it("any card counts, a player card too (1 player card + 1 encounter card under Silk), but not a card under Overload: 2 + 2 = 4", () => {
    const base = withOverload();
    let s = tuckFromHand(base.state, identityOf(base.state)).state;
    s = tuckEncounterCard(s, MERC).state;
    s = tuckEncounterCard(s, SHOCKER, base.id).state;
    const r = reveal(s);
    expect(inst(r.state, r.id).threat).toBe(4);
  });
  it("two players, 1 card under each identity: 2 + 2 = 4 (the 2 is flat, not per player)", () => {
    let s = silkGame({ twoPlayers: true });
    s = tuckEncounterCard(s, MERC).state;
    s = tuckEncounterCard(s, SANDMAN, identityOf(s, P2)).state;
    const r = reveal(s, 2);
    expect(inst(r.state, r.id).threat).toBe(4);
  });
});

describe(`52031 Hunting the Spider-Bride: ${BRIDE_RESPONSE}`, () => {
  /** Answers with the first of `wanted` that the prompt offers (targets, tucked cards, tucked-card choices), else as `picker`. */
  const choosing = (...wanted: readonly InstanceId[]): Picker =>
    picker((s) => {
      const ids = s.pendingChoice!.options.map((o) => o.optionId as string);
      const hit = wanted.find((w) => ids.includes(w));
      return hit ? [hit] : undefined;
    });

  it("Q7: Cindy Moon's action pays with it (a cost): Cindy takes 2 damage, she draws 2, the card goes to the encounter discard pile", () => {
    const t = tuckSetAside(silkGame(), BRIDE);
    const hand = playerOf(t.state, P1).hand.length;
    const { state, events } = run(
      t.state,
      picker(),
      use(P1, identityOf(t.state), CINDY_ACTION, [], { discarded: [t.id] }),
    );
    expect(tuckedOf(state)).toEqual([]);
    expect(encounterDiscard(state)).toContain(t.id);
    expect(kinds(events, BRIDE_RESPONSE)).toBe(1);
    expect(damageOf(state)).toBe(2);
    expect(playerOf(state, P1).hand).toHaveLength(hand + 2);
  });
  it("control: the same action paying with Sandman instead deals no damage", () => {
    const t = tuckEncounterCard(silkGame(), SANDMAN);
    const { state } = run(t.state, picker(), use(P1, identityOf(t.state), CINDY_ACTION, [], { discarded: [t.id] }));
    expect(damageOf(state)).toBe(0);
  });

  it("Q7: Swinging Silk Kick (an effect) against Morlun, discarding it: 9 damage with overkill, and Silk takes 2", () => {
    const hero = withForm(silkHeroGame(), { heroForm: 0 });
    const t = tuckSetAside(hero, BRIDE);
    const m = engagedMorlun(t.state);
    const given = moveToHand(m.state, P1, "52003");
    const event = given.ids[0]!;
    const { state, events } = run(
      given.state,
      choosing(m.id, t.id),
      play(P1, event, payWith(given.state, P1, 3, [event])),
    );
    const attacks = events.filter(
      (e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack",
    );
    expect(attacks).toMatchObject([{ event: { amount: 9 } }]);
    expect(inPlayArea(state, m.id)).toBe(false); // Morlun has 5 hit points
    expect(damageOf(state, villainOf(state))).toBe(4); // overkill: the 4 beyond his hit points
    expect(encounterDiscard(state)).toContain(t.id);
    expect(kinds(events, BRIDE_RESPONSE)).toBe(1);
    expect(damageOf(state)).toBe(2);
  });
  it("Swinging Silk Kick declining the discard: 7 damage still defeats Morlun, and his When Defeated discards the Bride: Silk takes nothing", () => {
    const hero = withForm(silkHeroGame(), { heroForm: 0 });
    const t = tuckSetAside(hero, BRIDE);
    const m = engagedMorlun(t.state);
    const given = moveToHand(m.state, P1, "52003");
    const event = given.ids[0]!;
    const { state } = run(given.state, choosing(m.id), play(P1, event, payWith(given.state, P1, 3, [event])));
    expect(inPlayArea(state, m.id)).toBe(false);
    expect(tuckedOf(state)).toEqual([]);
    expect(encounterDiscard(state)).toContain(t.id);
    expect(damageOf(state, villainOf(state))).toBe(0); // no overkill without the discard
    expect(damageOf(state)).toBe(0);
  });

  it("Q7: Wallcrawl (an effect) discarding it for the 3 additional threat from The Great Hunt (6 -> 4 -> 1): Silk takes 2", () => {
    const hero = withForm(silkHeroGame(), { heroForm: 0 });
    const t = tuckSetAside(hero, BRIDE);
    const hunt = sideSchemeIn(t.state, HUNT, 6);
    const given = moveToHand(hunt.state, P1, "52004");
    const event = given.ids[0]!;
    const { state, events } = run(
      given.state,
      choosing(hunt.id, t.id),
      play(P1, event, payWith(given.state, P1, 1, [event])),
    );
    expect(inst(state, hunt.id).threat).toBe(1);
    expect(encounterDiscard(state)).toContain(t.id);
    expect(kinds(events, BRIDE_RESPONSE)).toBe(1);
    expect(damageOf(state)).toBe(2);
  });

  it("Q7: the identity's four-card cap discarding it as the fifth card is a player card's discard: Cindy takes 2", () => {
    let s = silkGame();
    const kept: InstanceId[] = [];
    for (const code of [MERC, SANDMAN, SHOCKER]) {
      const t = tuckEncounterCard(s, code);
      s = t.state;
      kept.push(t.id);
    }
    const bride = tuckSetAside(s, BRIDE);
    const albert = playFromHand(SILK_DEPS, stacked(bride.state, HARD), "52006", 2);
    // Albert's tuck makes 5; the cap asks which 4 stay and the player keeps everything but the Bride.
    const { state, events } = run(
      albert.state,
      (x) => {
        const ids = x.pendingChoice!.options.map((o) => o.optionId as string);
        if (x.pendingChoice!.prompt.kind === "chooseCards" && ids.includes(bride.id))
          return ids.filter((id) => id !== bride.id).slice(0, 4);
        return pickLabel("Tuck")(x);
      },
      use(P1, albert.id, "52006.albert-moon-action"),
    );
    expect(tuckedOf(state)).toHaveLength(4);
    expect(tuckedOf(state)).not.toContain(bride.id);
    expect(encounterDiscard(state)).toContain(bride.id);
    expect(kinds(events, BRIDE_RESPONSE)).toBe(1);
    expect(damageOf(state)).toBe(2);
  });
  it("control: the cap discarding another card (the Bride kept) deals no damage", () => {
    let s = silkGame();
    const others: InstanceId[] = [];
    for (const code of [MERC, SANDMAN, SHOCKER]) {
      const t = tuckEncounterCard(s, code);
      s = t.state;
      others.push(t.id);
    }
    const bride = tuckSetAside(s, BRIDE);
    const albert = playFromHand(SILK_DEPS, stacked(bride.state, HARD), "52006", 2);
    const { state } = run(
      albert.state,
      (x) => {
        const ids = x.pendingChoice!.options.map((o) => o.optionId as string);
        if (x.pendingChoice!.prompt.kind === "chooseCards" && ids.includes(others[0]!))
          return ids.filter((id) => id !== others[0]).slice(0, 4);
        return pickLabel("Tuck")(x);
      },
      use(P1, albert.id, "52006.albert-moon-action"),
    );
    expect(tuckedOf(state)).toContain(bride.id);
    expect(damageOf(state)).toBe(0);
  });

  it("an encounter card's discard of it (Morlun's When Defeated, above) and the game's discard (Overload leaving, above) deal nothing: the response hears a player card's discard only", () => {
    expect(REGISTRY[BRIDE_RESPONSE]!.trigger).toMatchObject({
      on: { on: "tuckedCardDiscarded", selfIs: "target", eventIs: { under: "identity", by: "playerCard" } },
    });
  });

  it("a swap with Eidetic Memory is not a discard: Silk takes only Rhino's 2, and the Hunt is tucked in the Bride's place", () => {
    const hero = withForm(silkHeroGame(), { heroForm: 0 });
    const memory = playFromHand(SILK_DEPS, hero, "52008", 1);
    const t = tuckSetAside(memory.state, BRIDE);
    // Rhino's boost card (Advance), then the Hunt revealed to Silk (the Bride's own set), then fillers for the surge.
    const base = setAsideToDeckTop(fillers(t.state, 6), HUNT, 1);
    const { state, events } = run(
      calm(base.state),
      picker((x) => {
        const mine = x.pendingChoice!.options.find((o) => o.optionId.endsWith("52008.eidetic-memory-interrupt"));
        return mine ? [mine.optionId] : undefined;
      }),
      endTurn(P1),
    );
    expect(tuckedOf(state)).toEqual([base.id]);
    expect(kinds(events, BRIDE_RESPONSE)).toBe(0);
    expect(encounterDiscard(state)).toContain(t.id); // the Bride was revealed instead and discarded from play, not from under Silk
    expect(damageOf(state)).toBe(2);
  });

  it("its When Revealed is skipped for want of a random tucked-card pick: revealed, it only Surges (nothing tucked, nothing discarded)", () => {
    // Pins the gap (SILK_OBLIGATION_NEMESIS_SKIPPED): when "discard 1 of those cards at random" and the self-tuck are
    // scripted this test is replaced by the 0, 3 and 4 tucked cases.
    const staged = setAsideToDeckTop(fillers(silkGame(), 6), BRIDE, 1);
    const { state } = run(calm(staged.state), picker(), endTurn(P1));
    expect(tuckedOf(state)).toEqual([]);
    expect(encounterDiscard(state)).toContain(staged.id);
  });
});
