import {
  activeVillain,
  cardsInPlay,
  printedResources,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { WAVE6_DEPS } from "../index.js";
import {
  driveEventsPicking,
  encounterCardInVillainArea,
  playFromHand as playFromHandWith,
} from "../../testing/staging.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  P2,
  patchInstance,
  playerOf,
  putOnTopOfDeck,
  runWith,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { engageMinion as engageMinionBySurgery } from "./project-wideawake-testing.js";
import {
  mansionAttackGame as shuffledGame,
  putOtherAllyInPlay,
  withoutDealtCards,
  type BrotherhoodTitle,
} from "./mansion-attack-testing.js";

/**
 * A game past setup whose main scheme sits at 1B (stage 0), which has no constant ability: the shuffled stage 2 the seed
 * would have revealed (steady, retaliate, toughness or +1 ATK for every character, `mansion-attack.test.ts`) would
 * change what these tests count.
 */
const mansionAttackGame = (options: Parameters<typeof shuffledGame>[0] = {}): GameState => {
  const state = shuffledGame(options);
  return { ...state, mainScheme: { ...state.mainScheme, stageIndex: 0 } };
};
/** A minion engaged with a player by surgery, taken from the deck or (the 1B-dealt facedown card included) the discard pile. */
const engageMinion = (state: GameState, code: string, player: PlayerId = P1) =>
  engageMinionBySurgery(withoutDealtCards(state), code, player);
const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const villain = (state: GameState) => activeVillain(state).instanceId;
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const LEADERSHIP = [{ starterDeckId: "core-captain-marvel-leadership" }] as const;
const TWO = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
] as const;
const DIFFICULTIES = ["standard", "expert"] as const;
const inPlayOf = (state: GameState, code: string) => cardsInPlay(state).filter((id) => codeOf(state, id) === code);
const hand = (state: GameState, player: PlayerId = P1) => playerOf(state, player).hand;
const cardOf = (state: GameState, id: InstanceId) => state.cardPool[codeOf(state, id)]!;

/**
 * Boost card 01186 (no boost icons), then `rest`; nothing dealt at setup is left to reveal. A card that must not do
 * anything when revealed is Protect the Students (32136), a side scheme with no When Revealed.
 */
const phase = (state: GameState, top: readonly string[], pick: Picker = firstLegal, ...ends: PlayerId[]) =>
  driveEventsPicking(
    WAVE6_DEPS,
    stackEncounterDeck(withoutDealtCards(state), ...top),
    pick,
    ...(ends.length ? ends : [P1]).map((playerId) => ({ type: "endTurn" as const, playerId })),
  );
/** The villain phase in hero form: the villain attacks the player (it is dealt the first stacked card as its boost card). */
const heroGame = (title: BrotherhoodTitle, options: Parameters<typeof mansionAttackGame>[0] = {}) =>
  run(mansionAttackGame({ villain: title, ...options }), toHero(P1));
const schemesBy = (events: readonly GameEvent[], enemy: InstanceId) =>
  of(events, "schemeResolved").filter((e) => e.enemyInstanceId === enemy).length;
const iconCount = (state: GameState, id: InstanceId): number => {
  const pool = printedResources(cardOf(state, id));
  return pool.physical + pool.mental + pool.energy + pool.wild;
};

describe("the four villains' forced responses (32121-32124, standard and expert)", () => {
  describe.each(DIFFICULTIES)("%s", (difficulty) => {
    it("Avalanche: after he attacks you, an ally you control is exhausted", () => {
      const base = heroGame("Avalanche", { players: LEADERSHIP, difficulty });
      const { state: withAlly, id: ally } = playFromHandWith(WAVE6_DEPS, base, "01011", 3);
      expect(inst(withAlly, ally).exhausted).toBe(false);
      const { state, events } = phase(withAlly, ["01186", "32136"]);
      expect(of(events, "attackResolved").filter((e) => e.enemyInstanceId === villain(base))).toHaveLength(1);
      expect(of(events, "abilityResolved").map((e) => e.abilityId)).toContain(
        `3212${"1"}${difficulty === "expert" ? "b" : "a"}.avalanche-forced-response`,
      );
      expect(of(events, "cardExhausted").map((e) => e.instanceId)).toContain(ally);
      // The ally stays exhausted until the next ready step: the hero phase has begun, and the round's ready step ran first.
      void state;
    });

    it("Avalanche: only a ready ally is a valid target (an ally that just defended is exhausted already)", () => {
      const base = heroGame("Avalanche", { players: LEADERSHIP, difficulty });
      const { state: withAlly, id: defender } = playFromHandWith(WAVE6_DEPS, base, "01011", 3);
      const other = putOtherAllyInPlay(withAlly, P1, "01011");
      // A tough status card keeps the defender alive through the attack.
      const staged = patchInstance(other.state, defender, {
        statuses: { ...inst(other.state, defender).statuses, tough: 1 },
      });
      const offered: string[][] = [];
      const { state, events } = phase(staged, ["01186", "32136"], (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind === "declareDefender") return [defender];
        if (choice?.prompt.kind === "chooseTarget" && choice.prompt.slot === "ally")
          offered.push(choice.options.map((o) => o.optionId));
        return firstLegal(s);
      });
      expect(cardsInPlay(state)).toContain(defender);
      // The defender exhausted to defend; Avalanche's response offered only the other, ready ally and exhausted it.
      expect(offered).toEqual([[other.id]]);
      expect(of(events, "cardExhausted").map((e) => e.instanceId)).toEqual([defender, other.id]);
    });

    it("Avalanche: with no ally to exhaust nothing happens", () => {
      const base = heroGame("Avalanche", { difficulty });
      const { events } = phase(base, ["01186", "32136"]);
      expect(of(events, "attackResolved").filter((e) => e.enemyInstanceId === villain(base))).toHaveLength(1);
      expect(of(events, "cardExhausted").filter((e) => cardOf(base, e.instanceId).type === "ally")).toEqual([]);
    });

    it("Blob: after he attacks and damages a character, that character is stunned", () => {
      const base = heroGame("Blob", { difficulty });
      const { state } = phase(base, ["01186", "32136"]);
      expect(inst(state, identityOf(state, P1)).damage).toBeGreaterThan(0);
      expect(inst(state, identityOf(state, P1)).statuses.stunned).toBe(1);
    });

    describe("Blob with an ally defending", () => {
      const withDefender = () => {
        const base = heroGame("Blob", { players: LEADERSHIP, difficulty });
        const { state, id } = putOtherAllyInPlay(base, P1, "none");
        return { state, ally: id };
      };
      const defend =
        (ally: InstanceId): Picker =>
        (s) =>
          s.pendingChoice?.prompt.kind === "declareDefender" ? [ally] : firstLegal(s);

      it("stuns the ally that was damaged, not the hero", () => {
        const { state: staged, ally } = withDefender();
        // The deck's sturdiest ally survives Blob's 2 ATK: a defeated ally would leave nothing to stun.
        const { state } = phase(staged, ["01186", "32136"], defend(ally));
        expect(cardsInPlay(state)).toContain(ally);
        expect(inst(state, ally).damage).toBeGreaterThan(0);
        expect(inst(state, ally).statuses.stunned).toBe(1);
        expect(inst(state, identityOf(state, P1)).statuses.stunned).toBe(0);
      });

      it("stuns nobody when the attack deals no damage (a tough status card absorbs it)", () => {
        const { state: staged, ally } = withDefender();
        const tough = patchInstance(staged, ally, { statuses: { ...inst(staged, ally).statuses, tough: 1 } });
        const { state } = phase(tough, ["01186", "32136"], defend(ally));
        expect(inst(state, ally).damage).toBe(0);
        expect(inst(state, ally).statuses.stunned).toBe(0);
        expect(inst(state, identityOf(state, P1)).statuses.stunned).toBe(0);
      });
    });

    it("Pyro: after he attacks you, discard the top 2 cards of your deck and take 1 indirect damage per printed resource icon", () => {
      const base = heroGame("Pyro", { difficulty });
      const deck = playerOf(base, P1).deck;
      // One card printing two icons and one printing one: 3 icons, which "1 per card" (2) would get wrong.
      const two = deck.find((id) => iconCount(base, id) === 2);
      const one = deck.find((id) => iconCount(base, id) === 1);
      expect(two && one).toBeTruthy();
      const { state: staged, ids } = putOnTopOfDeck(base, P1, codeOf(base, two!), codeOf(base, one!));
      expect(ids.reduce((sum, id) => sum + iconCount(staged, id), 0)).toBe(3);
      const { state, events } = phase(staged, ["01186", "32136"]);
      const discarded = of(events, "cardMoved").filter((e) => e.to.kind === "discard" && ids.includes(e.instanceId));
      expect(discarded).toHaveLength(2);
      // Pyro's own attack deals ATK (0 standard, 1 expert; 01186 has no boost icons) on top of the 3 indirect damage.
      expect(inst(state, identityOf(state, P1)).damage).toBe(3 + (difficulty === "expert" ? 1 : 0));
    });

    it("Pyro: only the two top cards are discarded (the third is not), and the response resolves once per attack", () => {
      const base = heroGame("Pyro", { difficulty });
      const [a, b, c] = playerOf(base, P1).deck;
      const { events } = phase(base, ["01186", "32136"]);
      const resolved = of(events, "abilityResolved").filter((e) => e.abilityId.endsWith("pyro-forced-response"));
      expect(resolved).toHaveLength(1);
      const gone = of(events, "cardMoved")
        .filter((e) => e.from.kind === "deck" && e.to.kind === "discard")
        .map((e) => e.instanceId);
      expect(gone).toEqual([a, b]);
      expect(gone).not.toContain(c);
    });

    it("Toad: after he attacks and damages a character you control, discard 1 random card from your hand", () => {
      const base = heroGame("Toad", { difficulty });
      const { state, events } = phase(base, ["01186", "32136"]);
      // Only what moves after Toad's own ability resolved (the end of the hero turn may discard down to hand size first).
      const at = events.findIndex((e) => e.type === "abilityResolved" && e.abilityId.endsWith("toad-forced-response"));
      expect(at).toBeGreaterThan(-1);
      const discards = events
        .slice(at)
        .filter((e) => e.type === "cardMoved" && e.from.kind === "hand" && e.to.kind === "discard");
      expect(discards).toHaveLength(1);
      expect(inst(state, identityOf(state, P1)).damage).toBeGreaterThan(0);
    });
  });
});

describe("Brotherhood Beatdown (32131)", () => {
  /** Alter-ego form: the villain schemes, then 32131 is revealed. */
  const reveal = (state: GameState) => phase(state, ["01186", "32131"]);
  const exhausted = (events: readonly GameEvent[], state: GameState) =>
    of(events, "cardExhausted").some((e) => e.instanceId === identityOf(state, P1));

  it("with Avalanche in play: exhaust your identity", () => {
    const base = mansionAttackGame({ villain: "Avalanche" });
    const { events, state } = reveal(base);
    expect(exhausted(events, state)).toBe(true);
  });

  it("with Blob in play: you are stunned", () => {
    const base = mansionAttackGame({ villain: "Blob" });
    const { state, events } = reveal(base);
    expect(inst(state, identityOf(state, P1)).statuses.stunned).toBe(1);
    expect(exhausted(events, base)).toBe(false);
  });

  it("with Pyro in play: take 2 indirect damage", () => {
    const base = mansionAttackGame({ villain: "Pyro" });
    const { state } = reveal(base);
    expect(inst(state, identityOf(state, P1)).damage).toBe(2);
  });

  it("with Toad in play: discard 1 random card from your hand", () => {
    const base = mansionAttackGame({ villain: "Toad" });
    const { events } = reveal(base);
    const at = events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === "32131.when-revealed");
    expect(at).toBeGreaterThan(-1);
    const discards = events
      .slice(at)
      .filter((e) => e.type === "cardMoved" && e.from.kind === "hand" && e.to.kind === "discard");
    expect(discards).toHaveLength(1);
  });

  it("each enemy named counts, villain or minion: Avalanche the villain and a Blob minion exhaust and stun", () => {
    const { state: withMinion } = engageMinion(mansionAttackGame({ villain: "Avalanche" }), "32074");
    const { state, events } = reveal(withMinion);
    expect(exhausted(events, state)).toBe(true);
    expect(inst(state, identityOf(state, P1)).statuses.stunned).toBe(1);
    expect(inst(state, identityOf(state, P1)).damage).toBe(0);
  });
});

describe("Ground Swell, Immovable, Pyromaniac and Hopping Mad (32132-32135)", () => {
  const TREACHERIES = [
    ["32132", "Avalanche", "32073"],
    ["32133", "Blob", "32074"],
    ["32134", "Pyro", "32075"],
    ["32135", "Toad", "32076"],
  ] as const;
  describe.each(TREACHERIES)("%s (%s)", (code, title, minionCode) => {
    const other: BrotherhoodTitle = title === "Blob" ? "Avalanche" : "Blob";

    it("When Revealed: the villain of that title activates against you again (alter-ego: it schemes)", () => {
      const base = mansionAttackGame({ villain: title });
      const { events } = phase(base, ["01186", code, "01187"]);
      // Once in the villain phase, once for the treachery.
      expect(schemesBy(events, villain(base))).toBe(2);
    });

    it("When Revealed: in hero form it attacks you instead", () => {
      const base = heroGame(title);
      const { events } = phase(base, ["01186", code, "01187"]);
      expect(of(events, "attackResolved").filter((e) => e.enemyInstanceId === villain(base))).toHaveLength(2);
    });

    it("When Revealed: the minion of that title in play activates, and nobody is searched for", () => {
      const { state: withMinion, id: minion } = engageMinion(mansionAttackGame({ villain: other }), minionCode);
      const { state, events } = phase(withMinion, ["01186", code, "01187"]);
      // The villain phase activates it once, the treachery once more.
      expect(schemesBy(events, minion)).toBe(2);
      expect(inPlayOf(state, minionCode)).toEqual([minion]);
    });

    it("When Revealed: if he is not in play, the minion is searched out of the encounter deck and discard pile and revealed engaged with you", () => {
      const base = mansionAttackGame({ villain: other });
      expect(inPlayOf(base, minionCode)).toEqual([]);
      const { state, events } = phase(base, ["01186", code, "01187"]);
      const [minion] = inPlayOf(state, minionCode);
      expect(minion).toBeDefined();
      expect(inst(state, minion!).engagedWith).toBe(P1);
      // Not the villain: nobody activated for the treachery (the minion arrives after the activations).
      expect(schemesBy(events, minion!)).toBe(0);
      expect(schemesBy(events, villain(base))).toBe(1);
    });

    it("When Revealed: the minion is found in the encounter discard pile too", () => {
      const base = mansionAttackGame({ villain: other });
      const minionId = state0(base, minionCode);
      const inDiscard = discardFromDeck(base, minionId);
      const { state } = phase(inDiscard, ["01186", code, "01187"]);
      expect(inPlayOf(state, minionCode)).toEqual([minionId]);
    });

    it("[star] Boost: if the villain is that title, he is given an additional boost card for this activation", () => {
      const base = heroGame(title);
      const { events } = phase(base, [code, "01186", "32136"]);
      expect(of(events, "boostCardDealt").filter((e) => e.enemyInstanceId === villain(base))).toHaveLength(2);
    });

    it("[star] Boost: if the villain is another title, there is no additional boost card", () => {
      const base = heroGame(other);
      const { events } = phase(base, [code, "32136"]);
      expect(of(events, "boostCardDealt").filter((e) => e.enemyInstanceId === villain(base))).toHaveLength(1);
    });

    it("[star] Boost: the villain of that title scheming (alter-ego) is given an additional boost card too", () => {
      const base = mansionAttackGame({ villain: title });
      const { events } = phase(base, [code, "01186", "32136"]);
      expect(schemesBy(events, villain(base))).toBe(1);
      expect(of(events, "boostCardDealt").filter((e) => e.enemyInstanceId === villain(base))).toHaveLength(2);
    });

    it("[star] Boost: turned over by a villainous minion's activation (Bastion), nobody gets an additional card", () => {
      // Pending default Q82: ruling, February 28, 2026 (6), by analogy: "Because the villain is not activating, do not
      // give it a boost card." The villain (dealt 01186) attacks first, then Bastion (32167, villainous) with this card.
      const hero = heroGame(title, { modularSetIds: ["future_past"] });
      const { state: withBastion, id: bastion } = engageMinion(hero, "32167");
      const { events } = phase(withBastion, ["01186", code, "32136"]);
      expect(of(events, "boostCardFlipped").some((e) => e.enemyInstanceId === bastion)).toBe(true);
      expect(of(events, "boostCardDealt").filter((e) => e.enemyInstanceId === bastion)).toHaveLength(1);
      expect(of(events, "boostCardDealt").filter((e) => e.enemyInstanceId === villain(hero))).toHaveLength(1);
    });
  });
});

/** The first `code` instance in the active encounter deck. */
function state0(state: GameState, code: string): InstanceId {
  const pile = state.encounterDecks[Object.keys(state.encounterDecks)[0]!]!;
  const id = pile.deck.find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  return id;
}
/** Moves one encounter deck card to the encounter discard pile. */
function discardFromDeck(state: GameState, id: InstanceId): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: [...pile.discard, id] },
    },
  };
}

describe("Protect the Students (32136)", () => {
  /** Protect the Students in play with 1 threat, thwarted away by a hero: the thwarting player is the defeating player. */
  const defeated = (players: Parameters<typeof mansionAttackGame>[0], by: PlayerId, firstPlayerIndex?: number) => {
    const base = mansionAttackGame({
      villain: "Blob",
      ...players,
      ...(firstPlayerIndex !== undefined ? { firstPlayerIndex } : {}),
    });
    const { state: placed, id } = encounterCardInVillainArea(base, "32136", 1);
    const hero = run(placed, toHero(by));
    return {
      before: hero,
      after: driveEventsPicking(WAVE6_DEPS, hero, firstLegal, {
        type: "basicThwart",
        playerId: by,
        thwarterInstanceId: identityOf(hero, by),
        schemeInstanceId: id,
      }).state,
    };
  };
  const alliesIn = (state: GameState, ids: readonly InstanceId[]) =>
    ids.filter((id) => cardOf(state, id).type === "ally");

  it("When Defeated: the player who defeated it searches their deck for an ally and adds it to their hand", () => {
    const { before, after } = defeated({ players: LEADERSHIP }, P1);
    const allyInDeck = playerOf(before, P1).deck.filter((id) => cardOf(before, id).type === "ally");
    expect(allyInDeck.length).toBeGreaterThan(0);
    const gained = hand(after).filter((id) => !hand(before).includes(id));
    expect(alliesIn(after, gained)).toHaveLength(1);
    expect(playerOf(after, P1).deck).not.toContain(gained[0]);
  });

  it("When Defeated: with two players only the defeating player searches", () => {
    const { before, after } = defeated({ players: TWO }, P2, 1);
    const gained = hand(after, P2).filter((id) => !hand(before, P2).includes(id));
    expect(alliesIn(after, gained)).toHaveLength(1);
    expect(hand(after, P1)).toEqual(hand(before, P1));
  });

  it("When Defeated: the discard pile is searched too", () => {
    const base = mansionAttackGame({ villain: "Blob", players: LEADERSHIP });
    const allies = playerOf(base, P1).deck.filter((id) => cardOf(base, id).type === "ally");
    const emptied: GameState = {
      ...base,
      players: base.players.map((p) => ({
        ...p,
        deck: p.deck.filter((id) => !allies.includes(id)),
        discard: [...p.discard, ...allies.slice(0, 1)],
      })),
    };
    const { state: placed, id } = encounterCardInVillainArea(emptied, "32136", 1);
    const hero = run(placed, toHero(P1));
    const after = driveEventsPicking(WAVE6_DEPS, hero, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(hero, P1),
      schemeInstanceId: id,
    }).state;
    expect(hand(after)).toContain(allies[0]);
    expect(playerOf(after, P1).discard).not.toContain(allies[0]);
  });
});

describe("Under Siege (32137)", () => {
  const reveal = (state: GameState) => {
    const { state: after } = phase(state, ["01186", "32137"]);
    const [scheme] = inPlayOf(after, "32137");
    return scheme ? inst(after, scheme).threat : null;
  };

  it("When Revealed: places 3 threat on this scheme for each Brotherhood of Mutants character in play", () => {
    expect(reveal(mansionAttackGame({ villain: "Pyro" }))).toBe(3);
  });

  it("minions with the Brotherhood of Mutants trait count too, and a character of another trait does not", () => {
    const { state: one } = engageMinion(mansionAttackGame({ villain: "Pyro" }), "32074");
    expect(reveal(one)).toBe(6);
    const { state: two } = engageMinion(one, "32076");
    expect(reveal(two)).toBe(9);
  });

  it("in play it is a side scheme, not a Brotherhood character", () => {
    expect(cardOf(mansionAttackGame(), state0(mansionAttackGame(), "32137")).type).toBe("side_scheme");
  });
});
