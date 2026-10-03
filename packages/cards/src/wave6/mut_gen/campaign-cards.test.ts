/**
 * The Mutant Genesis campaign cards 171A/B-175A/B (`mut_gen_campaign`, `campaign-cards.ts`), each played in a real
 * campaign game: the definition composes the node's setup and reveals the side scheme (`campaign-cards-testing.ts`).
 * Standalone, the set is not composed: a deck cannot hold the player-side faces, no scenario deals the cards, and only
 * Master Mold's Setup puts Magneto (172B) into play.
 */
import { cardId, MUT_GEN_STARTER_DECKS, type DeckContents } from "@mc/content";
import {
  cardsInPlay,
  validateDeck,
  type DeckContext,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  P2,
  patchInstance,
  picking,
  playerOf,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { WAVE6_CARDS, WAVE6_DEPS, wave6Scenario } from "../index.js";
import { campaignGame } from "./campaign-cards-testing.js";
import { MUT_GEN_CAMPAIGN_CARDS } from "./campaign-cards.js";
import { masterMoldGame } from "./master-mold-testing.js";
import { putSetAsideAllyInPlay } from "./project-wideawake-testing.js";

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const settled = (state: GameState, pick: Picker = firstLegal) => settle(state, pick, undefined, WAVE6_DEPS);
const futurePast = (state: GameState) => state.scenarioDecks["Future Past"]!;
const encounterDeckOf = (state: GameState) => Object.values(state.encounterDecks).flatMap((pile) => pile.deck);
const inPlayOf = (state: GameState, code: string) =>
  instancesOf(state, code).filter((id) => cardsInPlay(state).includes(id));
const only = (ids: readonly InstanceId[]): InstanceId => {
  expect(ids).toHaveLength(1);
  return ids[0]!;
};

/** Thwarts `id` to 0 with a real basic thwart, so its When Defeated runs through the engine's own defeat pipeline. */
function defeatScheme(state: GameState, id: InstanceId, player: PlayerId = P1): GameState {
  const turn = player === P1 ? state : settled(run(state, endTurn(P1)));
  const hero = settled(run(turn, toHero(player)));
  const near = patchInstance(hero, id, { threat: 1 });
  return settled(
    run(near, {
      type: "basicThwart",
      playerId: player,
      thwarterInstanceId: identityOf(near, player),
      schemeInstanceId: id,
    }),
  );
}

/** A side scheme defeated: one card of the Future Past deck now sits in the encounter deck, and the deck is one shorter. */
function expectFuturePastShuffledIn(before: GameState, after: GameState): void {
  const top = futurePast(before).deck[0]!;
  expect(futurePast(after).deck).toHaveLength(futurePast(before).deck.length - 1);
  expect(futurePast(after).deck).not.toContain(top);
  expect(encounterDeckOf(after)).toContain(top);
  expect(encounterDeckOf(before)).not.toContain(top);
}

describe("campaign card refs", () => {
  it("scripts every ability ref of 171A/B-175A/B", () => {
    expect(Object.keys(MUT_GEN_CAMPAIGN_CARDS).sort()).toEqual(
      [
        "32171a.when-defeated",
        "32171b.metro-pd-constant",
        "32171b.metro-pd-action",
        "32172a.when-defeated",
        "32172b.magneto-constant",
        "32172b.magneto-response",
        "32173a.when-revealed",
        "32173a.when-defeated",
        "32173b.rescue-captives-response",
        "32174a.when-defeated",
        "32174b.obligation",
        "32175a.when-defeated",
      ].sort(),
    );
  });
});

describe("Frightened Police (171A) / Metro P.D. (171B), scenario 1", () => {
  const game = () => campaignGame(0);

  it("32171a.when-defeated: shuffles the top Future Past card into the encounter deck and flips into Metro P.D., under the first player's control (even when the other player defeats it)", () => {
    const start = game();
    const police = only(inPlayOf(start, "32171a"));
    const after = defeatScheme(start, police, P2);
    expectFuturePastShuffledIn(start, after);
    expect(inst(after, police).cardId).toBe("32171b");
    expect(cardsInPlay(after)).toContain(police);
    expect(inst(after, police).controllerId).toBe(P1);
    expect(playerOf(after, P1).playArea).toContain(police);
  });

  it("32171b.metro-pd-constant: the first player controls Metro P.D., and control follows the first player token", () => {
    const start = game();
    const police = only(inPlayOf(start, "32171a"));
    const metro = defeatScheme(start, police);
    expect(inst(metro, police).controllerId).toBe(P1);
    // The round passes: the first player token goes to the next player, and with it Metro P.D.
    const next = settled(run(settled(run(metro, endTurn(P1))), endTurn(P2)));
    expect(next.firstPlayerId).toBe(P2);
    expect(inst(next, police).controllerId).toBe(P2);
  });

  const chooseLabel =
    (label: RegExp, target?: InstanceId): Picker =>
    (state) => {
      const options = state.pendingChoice?.options ?? [];
      const labelled = options.find((o) => label.test(o.label));
      if (labelled) return [labelled.optionId];
      const wanted = target === undefined ? undefined : options.find((o) => o.optionId === target);
      return wanted ? [wanted.optionId] : firstLegal(state);
    };

  it("32171b.metro-pd-action: exhausts Metro P.D. to deal 1 damage to an enemy", () => {
    const start = game();
    const metro = defeatScheme(start, only(inPlayOf(start, "32171a")));
    const police = only(inPlayOf(metro, "32171b"));
    const used = settled(run(metro, use(P1, police, "32171b.metro-pd-action")), chooseLabel(/damage/i));
    expect(inst(used, police).exhausted).toBe(true);
    const damaged = cardsInPlay(used).filter(
      (id) => used.instances[id]!.damage === (metro.instances[id]?.damage ?? 0) + 1,
    );
    expect(damaged).toHaveLength(1);
    expect(["villain", "minion"]).toContain(used.cardPool[used.instances[damaged[0]!]!.cardId]?.type);
  });

  it("32171b.metro-pd-action: or removes 1 threat from a scheme", () => {
    const start = game();
    const metro = defeatScheme(start, only(inPlayOf(start, "32171a")));
    const police = only(inPlayOf(metro, "32171b"));
    // Scenario 1's other side scheme, Find the Senator, is a scheme with threat that a crisis icon does not protect.
    const senator = only(inPlayOf(metro, "32065a"));
    const staged = patchInstance(metro, senator, { threat: 5 });
    const used = settled(run(staged, use(P1, police, "32171b.metro-pd-action")), chooseLabel(/threat/i, senator));
    expect(inst(used, police).exhausted).toBe(true);
    expect(inst(used, senator).threat).toBe(4);
  });
});

describe("Enemy of My Enemy (172A) / Magneto (172B), scenario 2 and Master Mold", () => {
  it("32172a.when-defeated: shuffles the top Future Past card into the encounter deck and flips into Magneto, an ally under the first player's control", () => {
    const start = campaignGame(1);
    const scheme = only(inPlayOf(start, "32172a"));
    const after = defeatScheme(start, scheme, P2);
    expectFuturePastShuffledIn(start, after);
    expect(inst(after, scheme).cardId).toBe("32172b");
    expect(inst(after, scheme).controllerId).toBe(P1);
    expect(playerOf(after, P1).playArea).toContain(scheme);
  });

  it("32172b.magneto-constant: Magneto does not count against the ally limit", () => {
    let state = campaignGame(1);
    const allies: InstanceId[] = [];
    for (const code of ["32089", "32090", "32091"]) {
      const put = putSetAsideAllyInPlay(state, code);
      state = put.state;
      allies.push(put.id);
    }
    const scheme = only(inPlayOf(state, "32172a"));
    const after = defeatScheme(state, scheme);
    for (const id of [...allies, scheme]) expect(cardsInPlay(after), id).toContain(id);
    expect(after.pendingChoice).toBeNull();
  });

  const sentinelEngaged = (state: GameState) =>
    cardsInPlay(state).find(
      (id) => state.instances[id]!.engagedWith === P1 && state.cardPool[state.instances[id]!.cardId]?.type === "minion",
    )!;

  it("32172b.magneto-response: after Magneto attacks and defeats a Sentinel minion, heals 1 damage from him (Master Mold's Setup puts him in play)", () => {
    const start = campaignGame(2);
    const magneto = only(inPlayOf(start, "32172b"));
    const sentinel = sentinelEngaged(start);
    const staged = patchInstance(patchInstance(start, sentinel, { damage: 999 }), magneto, { damage: 3 });
    const attacked = settled(
      run(staged, { type: "basicAttack", playerId: P1, attackerInstanceId: magneto, targetInstanceId: sentinel }),
      picking(`${magneto}:32172b.magneto-response`),
    );
    expect(cardsInPlay(attacked)).not.toContain(sentinel);
    // Declined, the same attack leaves Magneto with 1 more damage (his consequential damage): the heal took it back.
    const declined = settled(
      run(staged, { type: "basicAttack", playerId: P1, attackerInstanceId: magneto, targetInstanceId: sentinel }),
    );
    expect(inst(declined, magneto).damage - inst(attacked, magneto).damage).toBe(1);
  });

  it("32172b.magneto-response: a Sentinel minion that survives the attack heals nothing", () => {
    const start = campaignGame(2);
    const magneto = only(inPlayOf(start, "32172b"));
    const sentinel = sentinelEngaged(start);
    const staged = patchInstance(start, magneto, { damage: 3 });
    const attacked = settled(
      run(staged, { type: "basicAttack", playerId: P1, attackerInstanceId: magneto, targetInstanceId: sentinel }),
    );
    expect(cardsInPlay(attacked)).toContain(sentinel);
    expect(inst(attacked, magneto).damage).toBeGreaterThanOrEqual(3);
  });

  it("Master Mold standalone: Setup puts Magneto (172B) into play under the first player's control, with his text scripted", () => {
    const state = masterMoldGame();
    const magneto = only(inPlayOf(state, "32172b"));
    expect(inst(state, magneto).controllerId).toBe(P1);
    expect(instancesOf(state, "32172b")).toHaveLength(1);
  });
});

describe("Find the Prisoners (173A) / Rescue Captives (173B), scenario 3", () => {
  const game = () => campaignGame(2);

  it("32173a.when-revealed: each player searches their deck for an ally and places it facedown under the scheme", () => {
    const state = game();
    const scheme = only(inPlayOf(state, "32173a"));
    const tucked = inst(state, scheme).tucked;
    expect(tucked).toHaveLength(2);
    expect(tucked.map((id) => state.instances[id]!.ownerId).sort()).toEqual([P1, P2]);
    for (const id of tucked) {
      expect(state.cardPool[state.instances[id]!.cardId]?.type).toBe("ally");
      expect(state.instances[id]!.faceup).toBe(false);
      expect(playerOf(state, state.instances[id]!.ownerId!).deck).not.toContain(id);
    }
  });

  it("32173a.when-defeated: shuffles a Future Past card in and flips into Rescue Captives, keeping the facedown allies under it", () => {
    const start = game();
    const scheme = only(inPlayOf(start, "32173a"));
    const held = [...inst(start, scheme).tucked];
    const after = defeatScheme(start, scheme);
    expectFuturePastShuffledIn(start, after);
    expect(inst(after, scheme).cardId).toBe("32173b");
    expect(cardsInPlay(after)).toContain(scheme);
    expect([...inst(after, scheme).tucked].sort()).toEqual(held.sort());
    for (const id of held) expect(after.instances[id]!.faceup).toBe(false);
  });

  /** Rescue Captives in play, with the Sentinel minion engaged with the first player about to be defeated by `player`. */
  function rescueStage(player: PlayerId) {
    const start = game();
    const scheme = only(inPlayOf(start, "32173a"));
    const flipped = defeatScheme(start, scheme, player);
    const sentinel = cardsInPlay(flipped).find(
      (id) =>
        flipped.instances[id]!.engagedWith === P1 && flipped.cardPool[flipped.instances[id]!.cardId]?.type === "minion",
    )!;
    const identity = identityOf(flipped, player);
    const staged = patchInstance(patchInstance(flipped, identity, { exhausted: false }), sentinel, { damage: 999 });
    const attack = {
      type: "basicAttack" as const,
      playerId: player,
      attackerInstanceId: identity,
      targetInstanceId: sentinel,
    };
    return { flipped, scheme, sentinel, staged, attack };
  }

  const rescuePicker =
    (scheme: InstanceId, ally: InstanceId): Picker =>
    (state) => {
      const options = state.pendingChoice?.options ?? [];
      const response = options.find((o) => o.optionId.endsWith("32173b.rescue-captives-response"));
      if (response) return [response.optionId];
      const kind = state.pendingChoice?.prompt.kind;
      if (kind === "chooseCards") return [ally];
      // "Spend 1 resource of any type": pay with the first card in hand.
      if (kind === "payForAbility") return [options[0]!.optionId];
      return firstLegal(state);
    };

  it.each([
    ["the player who defeats it", P1],
    ["any player: the other player, who does not control Magneto's side of the table", P2],
  ] as const)(
    "32173b.rescue-captives-response: after %s defeats a Sentinel minion, they spend 1 resource and the chosen facedown ally enters play under their control",
    (_who, player) => {
      const { flipped, scheme, staged, attack, sentinel } = rescueStage(player);
      const ally = inst(flipped, scheme).tucked[0]!;
      const handBefore = playerOf(staged, player).hand.length;
      const afterAttack = run(staged, attack);
      expect(afterAttack.pendingChoice?.prompt.kind).toBe("chooseTriggers");
      const offered = afterAttack.pendingChoice!.options.map((o) => o.optionId);
      expect(offered).toContain(`${scheme}:32173b.rescue-captives-response`);
      const done = settled(afterAttack, rescuePicker(scheme, ally));
      expect(cardsInPlay(done)).not.toContain(sentinel);
      expect(cardsInPlay(done)).toContain(ally);
      expect(inst(done, ally).controllerId).toBe(player);
      expect(inst(done, scheme).tucked).not.toContain(ally);
      expect(handBefore - playerOf(done, player).hand.length).toBeGreaterThanOrEqual(1);
    },
  );
});

describe("Surprise Attack (174A) / Reactivate Defenses (174B), scenario 4", () => {
  const game = () => campaignGame(3);

  it("32174a.when-defeated: shuffles a Future Past card in and flips into Reactivate Defenses in the defeating player's play area", () => {
    const start = game();
    const scheme = only(inPlayOf(start, "32174a"));
    const after = defeatScheme(start, scheme, P2);
    expectFuturePastShuffledIn(start, after);
    expect(inst(after, scheme).cardId).toBe("32174b");
    expect(inst(after, scheme).controllerId).toBe(P2);
    expect(playerOf(after, P2).playArea).toContain(scheme);
    expect(playerOf(after, P1).playArea).not.toContain(scheme);
    expect(after.villainArea).not.toContain(scheme);
    // And when the first player defeats it, it is theirs.
    const byFirst = defeatScheme(start, only(inPlayOf(start, "32174a")), P1);
    expect(playerOf(byFirst, P1).playArea).toContain(only(inPlayOf(byFirst, "32174b")));
  });

  /** Three hand cards that between them pay one [energy], one [mental] and one [physical] (wild covers any). */
  function payingCards(state: GameState, player: PlayerId): InstanceId[] {
    const hand = playerOf(state, player).hand;
    const icons = (id: InstanceId) => {
      const card = state.cardPool[state.instances[id]!.cardId];
      return card && "resourceIcons" in card ? (card.resourceIcons ?? {}) : {};
    };
    const gives = (id: InstanceId, type: "energy" | "mental" | "physical") =>
      ((icons(id) as Record<string, number | undefined>)[type] ?? 0) +
        ((icons(id) as Record<string, number | undefined>).wild ?? 0) >
      0;
    for (const a of hand)
      for (const b of hand)
        for (const c of hand) {
          if (new Set([a, b, c]).size === 3 && gives(a, "energy") && gives(b, "mental") && gives(c, "physical"))
            return [a, b, c];
        }
    throw new Error("no hand covers energy, mental and physical");
  }

  /** `player`'s alter-ego form, with Reactivate Defenses in their play area (they defeated the scheme this round). */
  function withObligation(player: PlayerId) {
    const start = game();
    const defeated = defeatScheme(start, only(inPlayOf(start, "32174a")), player);
    const obligation = only(inPlayOf(defeated, "32174b"));
    const reset = {
      ...defeated,
      players: defeated.players.map((p) =>
        p.playerId === player ? { ...p, identity: { ...p.identity, changedFormThisRound: false } } : p,
      ),
    };
    const alterEgo = settled(run(reset, toHero(player)));
    return { alterEgo, hero: defeated, obligation };
  }

  it("32174b.obligation: Alter-Ego Action, spend [energy][mental][physical]: 5 damage to each enemy in play, then the card is removed from the game", () => {
    const withObl = withObligation(P2);
    const { obligation } = withObl;
    // A minion engaged with the first player, by surgery, so more than the villain takes the damage.
    const deckId = Object.keys(withObl.alterEgo.encounterDecks)[0]!;
    const pile = withObl.alterEgo.encounterDecks[deckId]!;
    const minion = pile.deck.find(
      (id) => withObl.alterEgo.cardPool[withObl.alterEgo.instances[id]!.cardId]?.type === "minion",
    )!;
    const alterEgo: GameState = {
      ...withObl.alterEgo,
      encounterDecks: {
        ...withObl.alterEgo.encounterDecks,
        [deckId]: { ...pile, deck: pile.deck.filter((id) => id !== minion) },
      },
      players: withObl.alterEgo.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: [...p.playArea, minion] } : p,
      ),
      instances: {
        ...withObl.alterEgo.instances,
        [minion]: { ...withObl.alterEgo.instances[minion]!, faceup: true, engagedWith: P1 },
      },
    };
    const enemies = cardsInPlay(alterEgo).filter((id) =>
      ["villain", "minion"].includes(alterEgo.cardPool[alterEgo.instances[id]!.cardId]?.type ?? ""),
    );
    expect(enemies.length).toBeGreaterThanOrEqual(2);
    const payment = payingCards(alterEgo, P2).map((fromHand) => ({ fromHand }));
    const used = settled(run(alterEgo, use(P2, obligation, "32174b.obligation", payment)));
    for (const id of enemies) {
      const stillThere = cardsInPlay(used).includes(id);
      if (!stillThere) continue;
      // A tough status card takes the 5 damage instead (RRG 1.8 "Toughness"): the card is discarded, no damage lands.
      if (inst(alterEgo, id).statuses.tough > 0)
        expect(inst(used, id).statuses.tough, id).toBe(inst(alterEgo, id).statuses.tough - 1);
      else expect(inst(used, id).damage, id).toBe(inst(alterEgo, id).damage + 5);
    }
    expect(enemies.some((id) => !cardsInPlay(used).includes(id) || inst(used, id).damage >= 5)).toBe(true); // the minion
    expect(used.removedFromGame).toContain(obligation);
    expect(cardsInPlay(used)).not.toContain(obligation);
  });

  it("32174b.obligation: cannot be used in hero form", () => {
    const { hero, obligation } = withObligation(P2);
    const payment = payingCards(hero, P2).map((fromHand) => ({ fromHand }));
    expect(() => run(hero, use(P2, obligation, "32174b.obligation", payment))).toThrow();
  });
});

describe("Magneto's Fortress (175A) / Magneto's Power (175B), scenario 5", () => {
  it("32175a.when-defeated: shuffles a Future Past card in and flips into Magneto's Power, attached to Magneto (+1 SCH and +1 ATK, permanent: data)", () => {
    const start = campaignGame(4);
    const fortress = only(inPlayOf(start, "32175a"));
    const after = defeatScheme(start, fortress);
    expectFuturePastShuffledIn(start, after);
    expect(inst(after, fortress).cardId).toBe("32175b");
    const host = inst(after, fortress).attachedTo;
    expect(host).not.toBeNull();
    expect(after.cardPool[after.instances[host!]!.cardId]?.name).toBe("Magneto");
    expect(after.cardPool[after.instances[host!]!.cardId]?.type).toBe("villain");
  });
});

describe("standalone play", () => {
  const SCENARIOS = ["sabretooth", "project-wideawake", "master-mold", "mansion-attack", "magneto"] as const;
  const CAMPAIGN_CARDS = [
    "32171a",
    "32171b",
    "32172a",
    "32172b",
    "32173a",
    "32173b",
    "32174a",
    "32174b",
    "32175a",
    "32175b",
  ];

  it.each(SCENARIOS)(
    "%s deals none of the campaign cards, but Master Mold sets Magneto (172B) aside for its Setup",
    (scenario) => {
      const config = wave6Scenario(scenario, { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 1 });
      const dealt = [...config.encounterDeck, ...(config.setAside ?? [])].map((id) => id as string);
      expect(dealt.filter((id) => CAMPAIGN_CARDS.includes(id))).toEqual(scenario === "master-mold" ? ["32172b"] : []);
    },
  );

  it("a standalone deck cannot include the player-side campaign faces (Metro P.D., Magneto)", () => {
    const starter = MUT_GEN_STARTER_DECKS.find((deck) => (deck.id as string) === "colossus-protection")!;
    const base: DeckContents = {
      identityCardId: starter.identityCardId,
      aspects: starter.aspects,
      cards: starter.cards,
    };
    const context: DeckContext | undefined = undefined;
    for (const code of ["32171b", "32172b"]) {
      const deck = { ...base, cards: [...base.cards, { cardId: cardId(code), quantity: 1 }] };
      const verdict = validateDeck(deck, WAVE6_CARDS, context);
      expect(verdict.ok, code).toBe(false);
      expect(verdict.ok ? [] : verdict.problems.map((p) => p.code), code).toContain("campaign_card");
    }
  });
});
