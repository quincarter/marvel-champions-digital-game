/**
 * docs/phase7-wave1.md §3.10: play, cost and resource restrictions, one test each, proven with synthetic cards.
 *
 * Sources: RRG 1.8 "Max, Maximum" (p. 28), "Play Restrictions and Permissions" (p. 33), "In Play and Out of Play"
 * (p. 23), "'Gains'" (p. 21); FAQ "Crushing Blow (#2)", "Unstoppable Force (#6)" (p. 60), "Steve Rogers (#1B)" (p. 59).
 */

import {
  trait,
  type AbilityReference,
  type AnyCard,
  type CardId,
  type HeroIdentityCard,
  type UpgradeCard,
} from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityTriggerSpec, EngineDeps } from "./abilities.js";
import { playRequirement } from "./actions.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import { requirementOf } from "./resources.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubIdentity,
  stubMinion,
  stubObligation,
  stubResource,
  stubSupport,
  stubUpgrade,
} from "./testing/fixtures.js";
import { ALLY, DEFAULT_DECK, fromHand, giveCard, HERO, newGame, RESOURCE } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const one = { kind: "const", value: 1 } as const;
const AVENGER = trait("Avenger");
const SPY = trait("Spy");
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const identityOf = { kind: "identityOf", player: { kind: "controller" } } as const;

const abilities: StubAbility[] = [];
const register = (ability: StubAbility): AbilityReference => {
  abilities.push(ability);
  return ability.ref;
};
const constant = (
  id: string,
  spec: Omit<Extract<AbilityTriggerSpec, { kind: "constant" }>, "kind">,
): AbilityReference => register(stubAbility(id, { trigger: { kind: "constant", ...spec }, effects: [] }));
const action = (id: string, effects: readonly EffectSpec[] = []): AbilityReference =>
  register(stubAbility(id, { trigger: { kind: "action" }, effects }));

// Resources by type.
const PHYS = stubResource({ id: "phys", icons: 0, produces: { physical: 1 } });
const MENT = stubResource({ id: "ment", icons: 0, produces: { mental: 1 } });
const LIMITLESS = stubResource({
  id: "limitless",
  icons: 2,
  abilities: [constant("limitless.constant", { spendableIn: "hero" })],
});

// Play restrictions (§1.8).
const ONCE: AnyCard = {
  ...stubEvent({ id: "once", cost: 0, abilities: [action("once.action")] }),
  playRestrictions: { maxPerRound: 1 },
};
const ASSEMBLE: AnyCard = {
  ...stubEvent({ id: "assemble", cost: 0, abilities: [action("assemble.action")] }),
  playRestrictions: { requiresIdentityTrait: AVENGER },
};
const SPYCRAFT: AnyCard = {
  ...stubEvent({ id: "spycraft", cost: 0, abilities: [action("spycraft.action")] }),
  playRestrictions: { requiresControlledCharacterTrait: SPY },
};
const BADGE = stubSupport({
  id: "badge",
  cost: 0,
  abilities: [
    constant("badge.constant", {
      traitGrants: [{ trait: AVENGER, target: { categories: ["identity"], controller: "you" } }],
    }),
  ],
});
const SPY_ALLY = stubAlly({ id: "spy-ally", cost: 0, atk: 1, thw: 1, hp: 3, traits: [SPY] });

// Payment restrictions.
const ONLY_PHYSICAL = constant("only-physical.constant", { paymentOnly: ["physical"] });
const CRUSH = stubEvent({ id: "crush", cost: 2, abilities: [action("crush.action"), ONLY_PHYSICAL] });
const DISCOUNT = stubEvent({
  id: "discount",
  cost: 0,
  abilities: [
    action("discount.action", [
      {
        kind: "reduceNextCardCost",
        player: { kind: "controller" },
        amount: { kind: "const", value: 2 },
        duration: "phase",
      },
    ]),
  ],
});
const SMASH_ACTION = action("smash.action", [
  {
    kind: "if",
    condition: { kind: "paidWithOnly", resource: "physical" },
    then: [{ kind: "addCounters", target: identityOf, counterType: "smashed", amount: one }],
  },
]);
const SMASH = stubEvent({ id: "smash", cost: 1, abilities: [SMASH_ACTION] });
const FREE_SMASH = stubEvent({ id: "free-smash", cost: 0, abilities: [SMASH_ACTION] });
const GAUNTLET_RESOURCE = register(
  stubAbility("gauntlet.resource", {
    trigger: { kind: "resource" },
    effects: [],
    generates: 1,
    generatesFor: { categories: ["event"] },
  }),
);
const GAUNTLET = stubSupport({ id: "gauntlet", cost: 0, abilities: [GAUNTLET_RESOURCE] });

// Cost modifiers.
const HERCULES = stubAlly({
  id: "hercules",
  cost: 4,
  atk: 2,
  thw: 1,
  hp: 5,
  abilities: [
    constant("hercules.constant", {
      costModifiers: [
        {
          delta: {
            kind: "scaled",
            value: { kind: "count", query: { categories: ["minion"], engagedWith: "you" } },
            times: -1,
          },
          appliesTo: { self: true },
          activeIn: "hand",
        },
      ],
    }),
  ],
});
const IRON = stubAlly({
  id: "iron",
  cost: 0,
  atk: 1,
  thw: 1,
  hp: 4,
  abilities: [
    constant("iron.constant", {
      costModifiers: [{ delta: -1, appliesTo: { categories: ["upgrade"] }, host: { self: true } }],
    }),
  ],
});
const ARMOR: UpgradeCard = { ...stubUpgrade({ id: "armor", cost: 2 }), attachesTo: { kind: "ally" } };
const STEVE_CONSTANT = constant("steve.constant", {
  costModifiers: [
    {
      delta: -1,
      appliesTo: { categories: ["ally"], controller: "you" },
      while: { kind: "playedThisRound", player: { kind: "controller" }, cardType: "ally", atMost: 0 },
    },
  ],
});
const STEVE: HeroIdentityCard = stubIdentity({
  id: "steve",
  hp: 12,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 8,
  alterEgoHandSize: 8,
  heroAbilities: [STEVE_CONSTANT],
  alterEgoAbilities: [STEVE_CONSTANT],
});
const FREEBIE = stubEvent({ id: "freebie", cost: 0, abilities: [action("freebie.action")] });
const TOLL = stubObligation({
  id: "toll",
  abilities: [
    constant("toll.constant", { costModifiers: [{ delta: 3, appliesTo: { categories: ["event"], owner: "you" } }] }),
    register(
      stubAbility("toll.response", {
        trigger: { kind: "response", forced: true, on: { on: "cardPlayed", sourceIs: { categories: ["event"] } } },
        effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
      }),
    ),
  ],
});
const MINION = stubMinion({ id: "grunt", atk: 0, sch: 0, hp: 5, boostIcons: 0 });

// Costs and permissions on characters.
const WONDER = stubAlly({
  id: "wonder",
  cost: 0,
  atk: 2,
  thw: 1,
  hp: 4,
  abilities: [
    constant("wonder.constant", {
      basicPowerCosts: [{ power: "attack", cost: { discardFromHand: { min: 1, max: 1 } } }],
    }),
  ],
});
const LOCKJAW = stubAlly({
  id: "lockjaw",
  cost: 0,
  atk: 1,
  thw: 1,
  hp: 3,
  abilities: [constant("lockjaw.constant", { playableFrom: ["discard"] })],
});
const DAGGER_ACTION = register(
  stubAbility("dagger.action", {
    trigger: { kind: "action" },
    cost: { resources: 2, distinctResourceTypes: 2 },
    effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "used", amount: one }],
  }),
);
const DAGGER = stubSupport({ id: "dagger", cost: 0, abilities: [DAGGER_ACTION] });

const PLAYER_CARDS: readonly AnyCard[] = [
  PHYS,
  MENT,
  LIMITLESS,
  ONCE,
  ASSEMBLE,
  SPYCRAFT,
  BADGE,
  SPY_ALLY,
  CRUSH,
  DISCOUNT,
  SMASH,
  FREE_SMASH,
  GAUNTLET,
  HERCULES,
  IRON,
  ARMOR,
  FREEBIE,
  WONDER,
  LOCKJAW,
  DAGGER,
];
const deps: EngineDeps = depsOf(...abilities);

function game(options: { readonly players?: number; readonly identity?: HeroIdentityCard } = {}): GameState {
  return newGame({
    players: options.players ?? 1,
    identity: options.identity ?? HERO,
    deps,
    extraCards: [...PLAYER_CARDS, STEVE, TOLL, MINION],
    encounterDeck: [TOLL.id, ...copies(MINION.id, 4), ...copies(RESOURCE.id, 0)],
    deck: [...DEFAULT_DECK, ...PLAYER_CARDS.flatMap((card) => copies(card.id, 3))],
  });
}

/** Test surgery: a copy of `card` from `player`'s deck moves to their play area (or discard pile). */
function place(
  state: GameState,
  player: PlayerId,
  card: CardId,
  zone: "playArea" | "discard" = "playArea",
): { readonly state: GameState; readonly id: InstanceId } {
  const given = giveCard(state, player, card);
  const s = given.state;
  return {
    id: given.id,
    state: {
      ...s,
      players: s.players.map((p) =>
        p.playerId === player
          ? { ...p, hand: p.hand.filter((x) => x !== given.id), [zone]: [...p[zone], given.id] }
          : p,
      ),
      instances: { ...s.instances, [given.id]: { ...mustInstance(s, given.id), faceup: true, controllerId: player } },
    },
  };
}

/** Test surgery: an encounter card from the deck into `player`'s play area (engaged if a minion). */
function encounterInPlay(
  state: GameState,
  player: PlayerId,
  card: CardId,
): { readonly state: GameState; readonly id: InstanceId } {
  const [deckId] = state.encounterDeckOrder;
  const piles = state.encounterDecks[deckId ?? ""];
  const id = piles?.deck.find((candidate) => state.instances[candidate]?.cardId === card);
  if (!deckId || !piles || !id) throw new Error(`no ${card} in the encounter deck`);
  const minion = state.cardPool[card]?.type === "minion";
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: { ...mustInstance(state, id), faceup: true, engagedWith: minion ? player : null },
      },
    },
  };
}

/** Fresh copies of these cards in `player`'s hand. */
function hand(
  state: GameState,
  player: PlayerId,
  ...cards: readonly CardId[]
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  let current = state;
  const ids: InstanceId[] = [];
  for (const card of cards) {
    const given = giveCard(current, player, card, ids);
    current = given.state;
    ids.push(given.id);
  }
  return { state: current, ids };
}

const playCmd = (
  player: PlayerId,
  id: InstanceId,
  payment: readonly Payment[] = [],
  attachTo: InstanceId | null = null,
): Command => ({
  type: "playCard",
  playerId: player,
  cardInstanceId: id,
  payment,
  attachToInstanceId: attachTo,
});
const attempt = (state: GameState, command: Command) => applyCommand(state, command, deps);
const accept = (state: GameState, command: Command): GameState => runCommands(state, deps, command).state;

describe("§3.10 play restrictions", () => {
  it("'Max 1 per round' counts every copy by title for all players, and resets when the round ends", () => {
    const start = game({ players: 2 });
    const a = hand(start, p1, ONCE.id);
    const afterP1 = accept(a.state, playCmd(p1, a.ids[0] as InstanceId));
    const again = hand(afterP1, p1, ONCE.id);
    expect(attempt(again.state, playCmd(p1, again.ids[0] as InstanceId))).toMatchObject({
      ok: false,
      error: { code: "limit_reached" },
    });

    const p2Turn = runCommands(afterP1, deps, { type: "endTurn", playerId: p1 }).state;
    const b = hand(p2Turn, p2, ONCE.id);
    expect(attempt(b.state, playCmd(p2, b.ids[0] as InstanceId))).toMatchObject({
      ok: false,
      error: { code: "limit_reached" },
    });

    const nextRound = runCommands(p2Turn, deps, { type: "endTurn", playerId: p2 }).state;
    expect(nextRound.round).toBe(2);
    const active = nextRound.step.kind === "turn" ? nextRound.step.activePlayerId : p1;
    const c = hand(nextRound, active, ONCE.id);
    expect(attempt(c.state, playCmd(active, c.ids[0] as InstanceId)).ok).toBe(true);
  });

  it("'Play only if your identity has the Avenger trait' accepts a gained trait", () => {
    const start = hand(game(), p1, ASSEMBLE.id);
    const card = start.ids[0] as InstanceId;
    expect(attempt(start.state, playCmd(p1, card))).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    const badged = place(start.state, p1, BADGE.id).state;
    expect(attempt(badged, playCmd(p1, card)).ok).toBe(true);
  });

  it("'Play only if you control a Spy character'", () => {
    const start = hand(game(), p1, SPYCRAFT.id);
    const card = start.ids[0] as InstanceId;
    expect(attempt(start.state, playCmd(p1, card)).ok).toBe(false);
    expect(attempt(place(start.state, p1, SPY_ALLY.id).state, playCmd(p1, card)).ok).toBe(true);
  });
});

describe("§3.10 resource restrictions", () => {
  it("'You can only spend [physical] resources to pay for this card': a wild counts, a mental does not", () => {
    const start = hand(game(), p1, CRUSH.id, MENT.id, MENT.id, PHYS.id, PHYS.id, RESOURCE.id);
    const [crush, m1, m2, ph1, ph2, wild] = start.ids as [
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
    ];
    expect(attempt(start.state, playCmd(p1, crush, fromHand(m1, m2)))).toMatchObject({
      ok: false,
      error: { code: "insufficient_resources" },
    });
    expect(attempt(start.state, playCmd(p1, crush, fromHand(ph1, ph2))).ok).toBe(true);
    expect(attempt(start.state, playCmd(p1, crush, fromHand(ph1, wild))).ok).toBe(true);
  });

  it("FAQ 'Crushing Blow (#2)': reduced to 0, it needs no resources", () => {
    const start = hand(game(), p1, DISCOUNT.id, CRUSH.id);
    const [discount, crush] = start.ids as [InstanceId, InstanceId];
    const reduced = accept(start.state, playCmd(p1, discount));
    expect(attempt(reduced, playCmd(p1, crush)).ok).toBe(true);
  });

  it("'If you paid for this card using only [physical] resources' — and FAQ 'Unstoppable Force (#6)': not at cost 0", () => {
    const identity = (state: GameState) => mustInstance(state, mustPlayer(state, p1).identity.instanceId);
    const physical = hand(game(), p1, SMASH.id, PHYS.id);
    expect(
      identity(
        accept(physical.state, playCmd(p1, physical.ids[0] as InstanceId, fromHand(physical.ids[1] as InstanceId))),
      ).counters.smashed,
    ).toBe(1);
    const mental = hand(game(), p1, SMASH.id, MENT.id);
    expect(
      identity(accept(mental.state, playCmd(p1, mental.ids[0] as InstanceId, fromHand(mental.ids[1] as InstanceId))))
        .counters.smashed,
    ).toBeUndefined();
    const free = hand(game(), p1, FREE_SMASH.id);
    expect(identity(accept(free.state, playCmd(p1, free.ids[0] as InstanceId))).counters.smashed).toBeUndefined();
  });

  it("'generate a [wild] resource for an event' only while paying for an event", () => {
    const withGauntlet = place(game(), p1, GAUNTLET.id);
    const start = hand(withGauntlet.state, p1, SMASH.id, ALLY.id, RESOURCE.id);
    const [smash, ally, wild] = start.ids as [InstanceId, InstanceId, InstanceId];
    const gauntlet: Payment = { ability: { instanceId: withGauntlet.id, abilityId: GAUNTLET_RESOURCE.id } };
    expect(attempt(start.state, playCmd(p1, smash, [gauntlet])).ok).toBe(true);
    expect(attempt(start.state, playCmd(p1, ally, [gauntlet, { fromHand: wild }]))).toMatchObject({
      ok: false,
      error: { code: "no_valid_target" },
    });
  });

  it("'Spend this card only in hero form'", () => {
    const start = hand(game(), p1, ALLY.id, LIMITLESS.id);
    const [ally, limitless] = start.ids as [InstanceId, InstanceId];
    expect(attempt(start.state, playCmd(p1, ally, fromHand(limitless)))).toMatchObject({
      ok: false,
      error: { code: "wrong_form" },
    });
    const hero = accept(start.state, { type: "changeForm", playerId: p1 });
    expect(attempt(hero, playCmd(p1, ally, fromHand(limitless))).ok).toBe(true);
  });

  it("'spend 2 resources of different types'", () => {
    const withDagger = place(game(), p1, DAGGER.id);
    const start = hand(withDagger.state, p1, PHYS.id, PHYS.id, MENT.id);
    const [ph1, ph2, m1] = start.ids as [InstanceId, InstanceId, InstanceId];
    const use = (payment: readonly InstanceId[]): Command => ({
      type: "useAbility",
      playerId: p1,
      cardInstanceId: withDagger.id,
      abilityId: DAGGER_ACTION.id,
      payment: fromHand(...payment),
    });
    expect(attempt(start.state, use([ph1, ph2]))).toMatchObject({
      ok: false,
      error: { code: "insufficient_resources" },
    });
    expect(attempt(start.state, use([ph1, m1])).ok).toBe(true);
  });
});

describe("§3.10 cost modifiers", () => {
  it("a cost reduction active from hand: 'Reduce the cost to play Hercules by 1 for each minion engaged with you'", () => {
    let state = game();
    state = encounterInPlay(state, p1, MINION.id).state;
    state = encounterInPlay(state, p1, MINION.id).state;
    const start = hand(state, p1, HERCULES.id, RESOURCE.id, RESOURCE.id);
    const [herc, r1, r2] = start.ids as [InstanceId, InstanceId, InstanceId];
    expect(playRequirement(start.state, p1, herc, requirementOf(0), deps).generic).toBe(2);
    expect(attempt(start.state, playCmd(p1, herc, fromHand(r1))).ok).toBe(false);
    expect(attempt(start.state, playCmd(p1, herc, fromHand(r1, r2))).ok).toBe(true);
  });

  it("a reduction for upgrades on one ally: 'Reduce the cost to play each upgrade on Iron Man by 1'", () => {
    const iron = place(game(), p1, IRON.id);
    const other = place(iron.state, p1, ALLY.id);
    const start = hand(other.state, p1, ARMOR.id, RESOURCE.id);
    const [armor, r1] = start.ids as [InstanceId, InstanceId];
    expect(attempt(start.state, playCmd(p1, armor, fromHand(r1), iron.id)).ok).toBe(true);
    expect(attempt(start.state, playCmd(p1, armor, fromHand(r1), other.id))).toMatchObject({
      ok: false,
      error: { code: "insufficient_resources" },
    });
  });

  it("FAQ 'Steve Rogers (#1B)': only the very first ally played each round is reduced, whatever the form", () => {
    const start = hand(game({ identity: STEVE }), p1, ALLY.id, ALLY.id, RESOURCE.id, RESOURCE.id, RESOURCE.id);
    const [first, second, r1, r2, r3] = start.ids as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    const afterFirst = accept(start.state, playCmd(p1, first, fromHand(r1)));
    const flipped = accept(afterFirst, { type: "changeForm", playerId: p1 });
    expect(attempt(flipped, playCmd(p1, second, fromHand(r2)))).toMatchObject({
      ok: false,
      error: { code: "insufficient_resources" },
    });
    expect(attempt(flipped, playCmd(p1, second, fromHand(r2, r3))).ok).toBe(true);
  });

  it("an additional cost from an obligation in play: 'The next event you play costs 3 additional resources. Discard this obligation after you play an event.'", () => {
    const toll = encounterInPlay(game(), p1, TOLL.id);
    const start = hand(toll.state, p1, FREEBIE.id, FREEBIE.id, RESOURCE.id, RESOURCE.id, RESOURCE.id);
    const [event, nextEvent, r1, r2, r3] = start.ids as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    expect(attempt(start.state, playCmd(p1, event))).toMatchObject({
      ok: false,
      error: { code: "insufficient_resources" },
    });
    const paid = accept(start.state, playCmd(p1, event, fromHand(r1, r2, r3)));
    expect(mustPlayer(paid, p1).playArea).not.toContain(toll.id);
    expect(attempt(paid, playCmd(p1, nextEvent)).ok).toBe(true);
  });
});

describe("§3.10 costs on basic powers, and permissions", () => {
  it("'As an additional cost for Wonder Man to attack, you must discard 1 card', and legalActions fills the pick in", () => {
    const wonder = place(game(), p1, WONDER.id);
    const start = hand(wonder.state, p1, RESOURCE.id);
    const discard = start.ids[0] as InstanceId;
    const villain = activeVillain(start.state).instanceId;
    const attack: Command = {
      type: "basicAttack",
      playerId: p1,
      attackerInstanceId: wonder.id,
      targetInstanceId: villain,
    };
    expect(attempt(start.state, attack)).toMatchObject({ ok: false, error: { code: "invalid_choice" } });
    const paid = accept(start.state, { ...attack, costChoices: { discard: [discard] } });
    expect(mustPlayer(paid, p1).discard).toContain(discard);
    expect(mustInstance(paid, wonder.id).exhausted).toBe(true);

    const legal = legalActions(start.state, p1, deps);
    expect(
      legal.kind === "turn" &&
        legal.legal.some((a) => a.action.kind === "basicAttack" && a.action.instanceId === wonder.id),
    ).toBe(true);
  });

  it("'You may play Lockjaw from your discard pile during your turn' — and only a card with that permission", () => {
    const lockjaw = place(game(), p1, LOCKJAW.id, "discard");
    const ally = place(lockjaw.state, p1, ALLY.id, "discard");
    expect(attempt(ally.state, playCmd(p1, ally.id))).toMatchObject({ ok: false, error: { code: "card_not_in_zone" } });
    const played = accept(ally.state, playCmd(p1, lockjaw.id));
    expect(mustPlayer(played, p1).playArea).toContain(lockjaw.id);

    const legal = legalActions(ally.state, p1, deps);
    expect(
      legal.kind === "turn" &&
        legal.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === lockjaw.id),
    ).toBe(true);
  });
});
