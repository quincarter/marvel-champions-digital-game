import {
  activeEncounterDeckId,
  activeVillain,
  cardsInPlay,
  characterProfile,
  hasKeyword,
  printedResources,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { BROTHERHOOD_ABILITIES } from "./brotherhood.js";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  patchInstance,
  playerOf,
  putOnTopOfDeck,
  runWith,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, playFromHand } from "../../testing/staging.js";
import { engageMinion } from "./project-wideawake-testing.js";
import { putOtherAllyInPlay } from "./mansion-attack-testing.js";
import { brotherhoodGame, inEncounterPiles, inPlay } from "./brotherhood-testing.js";

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const LEADERSHIP = [{ starterDeckId: "core-captain-marvel-leadership" }] as const;
/** Sabretooth's own forced response (it discards an encounter card) is out of the way of what these tests count. */
const deps: EngineDeps = {
  ...WAVE6_DEPS,
  abilities: Object.fromEntries(
    Object.entries(WAVE6_DEPS.abilities).filter(([id]) => !id.startsWith("32060.sabretooth")),
  ),
};
/** One villain phase from the end of P1's turn: the stacked cards are drawn in order (the villain's boost card first). */
const phase = (state: GameState, top: readonly string[], pick: Picker = firstLegal) =>
  driveEventsPicking(deps, stackEncounterDeck(state, ...top), pick, { type: "endTurn", playerId: P1 });
/** Hero form, a Brotherhood minion engaged with P1 (taken from the encounter deck the set's data put it in). */
const withMinion = (code: string, options: Parameters<typeof brotherhoodGame>[0] = {}, hero = true) => {
  const game = brotherhoodGame(options);
  return engageMinion(hero ? run(game, toHero(P1)) : game, code, P1);
};
const iconCount = (state: GameState, id: InstanceId): number => {
  const pool = printedResources(state.cardPool[codeOf(state, id)]!);
  return pool.physical + pool.mental + pool.energy + pool.wild;
};
/** The events after the first time `suffix`'s ability resolved. */
const afterAbility = (events: readonly GameEvent[], suffix: string): GameEvent[] => {
  const at = events.findIndex((e) => e.type === "abilityResolved" && e.abilityId.endsWith(suffix));
  expect(at, `${suffix} resolved`).toBeGreaterThan(-1);
  return events.slice(at);
};
const attacksBy = (events: readonly GameEvent[], id: InstanceId) =>
  of(events, "attackResolved").filter((e) => e.enemyInstanceId === id);
const FILLER = "01186";
const NO_BOOST = "01187";

describe("registry", () => {
  it("registers every ability ref of the Brotherhood set", () => {
    expect(Object.keys(BROTHERHOOD_ABILITIES).sort()).toEqual(
      [
        "32073.avalanche-forced-response",
        "32073.boost",
        "32074.blob-forced-response",
        "32075.pyro-forced-response",
        "32076.toad-forced-response",
        "32076.boost",
        "32077.homo-superior-constant",
        "32077.homo-superior-constant-2",
        "32077.boost",
        "32078.when-revealed",
        "32079.the-brotherhood-constant",
      ].sort(),
    );
  });

  it("the set's cards are in the game from data: all four minions, Homo Superior (x2), Mutant Terrorists and the side scheme", () => {
    const state = brotherhoodGame();
    for (const code of ["32073", "32074", "32075", "32076", "32078", "32079"])
      expect(inEncounterPiles(state, code), code).toHaveLength(1);
    expect(inEncounterPiles(state, "32077")).toHaveLength(2);
  });
});

describe("Avalanche (32073)", () => {
  it("Forced Response: after he attacks you, exhaust a character you control (the one you choose)", () => {
    const { state: engaged, id: minion } = withMinion("32073", { players: LEADERSHIP });
    const { state: staged, id: ally } = playFromHand(deps, engaged, "01011", 3);
    expect(inst(staged, ally).exhausted).toBe(false);
    const { events } = phase(staged, [FILLER, NO_BOOST], (s) =>
      s.pendingChoice?.prompt.kind === "chooseTarget" && s.pendingChoice.options.some((o) => o.optionId === ally)
        ? [ally]
        : firstLegal(s),
    );
    expect(attacksBy(events, minion)).toHaveLength(1);
    const exhausted = of(afterAbility(events, "32073.avalanche-forced-response"), "cardExhausted");
    expect(exhausted.map((e) => e.instanceId)).toEqual([ally]);
  });

  it("Boost: exhaust a character you control (Sabretooth's boost card)", () => {
    const base = run(brotherhoodGame(), toHero(P1));
    const hero = identityOf(base, P1);
    expect(inst(base, hero).exhausted).toBe(false);
    const { events } = phase(base, ["32073", NO_BOOST]);
    expect(of(events, "abilityResolved").map((e) => e.abilityId)).toContain("32073.boost");
    expect(of(afterAbility(events, "32073.boost"), "cardExhausted").map((e) => e.instanceId)).toContain(hero);
  });
});

describe("Blob (32074)", () => {
  it("Forced Response: after he attacks and damages a character, that character is stunned (Guard is data)", () => {
    const { state: engaged, id: minion } = withMinion("32074");
    expect(hasKeyword(engaged, minion, "guard", WAVE6_DEPS)).toBe(true);
    const { state, events } = phase(engaged, [FILLER, NO_BOOST]);
    const after = afterAbility(events, "32074.blob-forced-response");
    expect(attacksBy(events, minion)).toHaveLength(1);
    // Blob's own attack (ATK 2) damaged the hero; stunned status follows it.
    expect(of(events, "damageDealt").some((e) => e.sourceInstanceId === minion)).toBe(true);
    expect(inst(state, identityOf(state, P1)).statuses.stunned).toBe(1);
    expect(after.length).toBeGreaterThan(0);
  });

  describe("with an ally defending", () => {
    const setup = () => {
      const { state: engaged, id: minion } = withMinion("32074", { players: LEADERSHIP });
      // The deck's sturdiest ally survives Blob's 2 ATK: a defeated ally would leave nothing to stun.
      const { state, id: ally } = putOtherAllyInPlay(engaged, P1, "none");
      const defend: Picker = (s) => {
        const prompt = s.pendingChoice?.prompt;
        return prompt?.kind === "declareDefender" && prompt.attack.enemyInstanceId === minion ? [ally] : firstLegal(s);
      };
      return { state, ally, minion, defend };
    };

    it("stuns the ally that took the damage, not the hero", () => {
      const { state: staged, ally, minion, defend } = setup();
      const { state, events } = phase(staged, [FILLER, NO_BOOST], defend);
      expect(of(events, "damageDealt").some((e) => e.targetInstanceId === ally && e.sourceInstanceId === minion)).toBe(
        true,
      );
      expect(cardsInPlay(state)).toContain(ally);
      expect(inst(state, ally).statuses.stunned).toBe(1);
      expect(inst(state, identityOf(state, P1)).statuses.stunned).toBe(0);
    });

    it("stuns nobody when the attack deals no damage (a tough status card absorbs it)", () => {
      const { state: staged, ally, minion, defend } = setup();
      const tough = patchInstance(staged, ally, { statuses: { ...inst(staged, ally).statuses, tough: 1 } });
      const { state, events } = phase(tough, [FILLER, NO_BOOST], defend);
      expect(attacksBy(events, minion)).toHaveLength(1);
      expect(of(events, "damagePrevented").map((e) => e.targetInstanceId)).toEqual([ally]);
      expect(inst(state, ally).damage).toBe(0);
      expect(inst(state, ally).statuses.stunned).toBe(0);
      expect(inst(state, identityOf(state, P1)).statuses.stunned).toBe(0);
    });
  });
});

describe("Pyro (32075)", () => {
  it("Forced Response: after he attacks you, discard the top 2 cards of your deck and take 1 indirect damage per printed resource icon", () => {
    const { state: engaged, id: minion } = withMinion("32075");
    const deck = playerOf(engaged, P1).deck;
    // One card printing two icons and one printing one: 3 icons, which "1 per card" (2) would get wrong.
    const two = deck.find((id) => iconCount(engaged, id) === 2);
    const one = deck.find((id) => iconCount(engaged, id) === 1);
    expect(two && one).toBeTruthy();
    const { state: staged, ids } = putOnTopOfDeck(engaged, P1, codeOf(engaged, two!), codeOf(engaged, one!));
    const { events } = phase(staged, [FILLER, NO_BOOST]);
    expect(attacksBy(events, minion)).toHaveLength(1);
    const after = afterAbility(events, "32075.pyro-forced-response");
    const discarded = of(after, "cardMoved").filter((e) => e.to.kind === "discard" && ids.includes(e.instanceId));
    expect(discarded).toHaveLength(2);
    const taken = of(after, "damageDealt")
      .filter((e) => e.targetInstanceId === identityOf(staged, P1) && e.sourceInstanceId === minion)
      .reduce((sum, e) => sum + e.amount, 0);
    expect(taken).toBe(3);
  });

  it("Forced Response: only two cards are discarded and it resolves once per attack", () => {
    const { state: engaged } = withMinion("32075");
    const [a, b, c] = playerOf(engaged, P1).deck;
    const { events } = phase(engaged, [FILLER, NO_BOOST]);
    expect(of(events, "abilityResolved").filter((e) => e.abilityId.endsWith("pyro-forced-response"))).toHaveLength(1);
    const gone = of(afterAbility(events, "32075.pyro-forced-response"), "cardMoved")
      .filter((e) => e.from.kind === "deck" && e.to.kind === "discard")
      .map((e) => e.instanceId);
    expect(gone).toEqual([a, b]);
    expect(gone).not.toContain(c);
  });
});

describe("Toad (32076)", () => {
  it("Forced Response: after he attacks and damages a character you control, discard 1 random card from your hand", () => {
    const { state: engaged, id: minion } = withMinion("32076");
    const { events } = phase(engaged, [FILLER, NO_BOOST]);
    expect(attacksBy(events, minion)).toHaveLength(1);
    const discards = afterAbility(events, "32076.toad-forced-response").filter(
      (e) => e.type === "cardMoved" && e.from.kind === "hand" && e.to.kind === "discard",
    );
    expect(discards).toHaveLength(1);
  });

  it("Boost: discard 1 random card from your hand (Sabretooth's boost card)", () => {
    const base = run(brotherhoodGame(), toHero(P1));
    const { events } = phase(base, ["32076", NO_BOOST]);
    const discards = afterAbility(events, "32076.boost").filter(
      (e) => e.type === "cardMoved" && e.from.kind === "hand" && e.to.kind === "discard",
    );
    expect(discards).toHaveLength(1);
  });
});

describe("Homo Superior (32077)", () => {
  /** Alter-ego form: Sabretooth schemes (boost card first), then Homo Superior is the card dealt. */
  const reveal = (state: GameState) => phase(state, [FILLER, "32077"]);

  it("attaches to a minion, gives it a tough status card and +5 hit points", () => {
    const { state: engaged, id: minion } = withMinion("32074", {}, false);
    const before = characterProfile(engaged, minion, WAVE6_DEPS)!.maxHp;
    const { state, events } = reveal(engaged);
    const [homo] = inPlay(state, "32077");
    expect(homo).toBeDefined();
    expect(inst(state, minion).attachments).toContain(homo);
    expect(inst(state, minion).statuses.tough).toBe(1);
    expect(characterProfile(state, minion, WAVE6_DEPS)!.maxHp).toBe(before + 5);
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(["32077"]);
  });

  it("with no minion in play, this card gains surge: it is discarded and the next card is revealed", () => {
    const { events, state } = phase(brotherhoodGame(), [FILLER, "32077", "32079"]);
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(["32077", "32079"]);
    expect(inPlay(state, "32077")).toEqual([]);
  });

  it("Boost: attach this card to a minion and give it a tough status card", () => {
    const { state: engaged, id: minion } = withMinion("32074");
    const { state } = phase(engaged, ["32077", NO_BOOST]);
    // Sabretooth's boost was Homo Superior: the only minion is the one it attached to.
    const [homo] = [...(inst(state, minion).attachments ?? [])].filter((a) => codeOf(state, a) === "32077");
    expect(homo).toBeDefined();
    expect(inst(state, minion).statuses.tough).toBe(1);
    expect(characterProfile(state, minion, WAVE6_DEPS)!.maxHp).toBe(
      characterProfile(engaged, minion, WAVE6_DEPS)!.maxHp + 5,
    );
  });
});

describe("Mutant Terrorists (32078)", () => {
  const reveal = (state: GameState, ...rest: string[]) => phase(state, [FILLER, "32078", ...rest]);

  it("searches the encounter deck for The Brotherhood and reveals it (a minion is not revealed)", () => {
    const base = brotherhoodGame();
    expect(inEncounterPiles(base, "32079")).toHaveLength(1);
    const { state, events } = reveal(base);
    expect(inPlay(state, "32079")).toHaveLength(1);
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(["32078", "32079"]);
  });

  it("also searches the discard pile", () => {
    const base = brotherhoodGame();
    const deckId = activeEncounterDeckId(base);
    const [scheme] = inEncounterPiles(base, "32079");
    const pile = base.encounterDecks[deckId]!;
    const moved: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== scheme), discard: [...pile.discard, scheme!] },
      },
    };
    const { state } = reveal(moved);
    expect(inPlay(state, "32079")).toEqual([scheme]);
  });

  it("if The Brotherhood did not enter play, discards until a Brotherhood of Mutants minion and reveals it (engaged with you)", () => {
    const { state: held } = encounterCardInVillainArea(brotherhoodGame(), "32079");
    // 32076 on top of the deck after Mutant Terrorists, the cards above it are discarded without being revealed.
    const { state, events } = reveal(held, "01188", "32076");
    const [toad] = inPlay(state, "32076");
    expect(toad).toBeDefined();
    expect(inst(state, toad!).engagedWith).toBe(P1);
    expect(inPlay(state, "32079")).toHaveLength(1);
    // (The side scheme's hazard icon deals a second card, so more is revealed after the minion.)
    expect(
      of(events, "encounterCardRevealed")
        .map((e) => e.cardId)
        .slice(0, 2),
    ).toEqual(["32078", "32076"]);
    // Cards above the minion were discarded, not revealed.
    expect(
      of(events, "cardMoved").some((e) => e.to.kind === "encounterDiscard" && e.from.kind === "encounterDeck"),
    ).toBe(true);
  });
});

describe("The Brotherhood (32079)", () => {
  it("each Brotherhood of Mutants minion gains quickstrike (Hinder 2[per_hero] is data)", () => {
    const { state: engaged, id: minion } = withMinion("32074");
    expect(hasKeyword(engaged, minion, "quickstrike", WAVE6_DEPS)).toBe(false);
    const { state } = encounterCardInVillainArea(engaged, "32079");
    expect(hasKeyword(state, minion, "quickstrike", WAVE6_DEPS)).toBe(true);
  });

  it("a minion that is not a Brotherhood of Mutants minion does not", () => {
    const base = brotherhoodGame();
    const { state } = encounterCardInVillainArea(base, "32079");
    const sabretooth = activeVillain(state).instanceId;
    expect(hasKeyword(state, sabretooth, "quickstrike", WAVE6_DEPS)).toBe(false);
  });
});
