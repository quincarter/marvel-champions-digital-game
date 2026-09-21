import { activeVillain } from "./query.js";
import { flat, trait, type AnyCard, type CardId } from "@mc/content";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, sessionApply, startSession, type GameSession } from "./engine.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { characterProfile, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import {
  stubAlly,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubResource,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import {
  ALLY,
  giveCards,
  newGame,
  newGameAtMulligan,
  resolvePending,
  RESOURCE,
  runWith,
  settle,
  settleUntil,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const def = (definition: AbilityDefinition) => definition;
const toHero = (player: PlayerId = p1): Command => ({ type: "changeForm", playerId: player });
const endTurn = (player: PlayerId = p1): Command => ({ type: "endTurn", playerId: player });
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const play = (id: InstanceId, extra: Partial<Extract<Command, { type: "playCard" }>> = {}): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
  ...extra,
});
const use = (id: InstanceId, abilityId: string, player: PlayerId = p1): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: id,
  abilityId: abilityId as never,
  payment: [],
});

const controller = { kind: "controller" } as const;
const BLACK_PANTHER = trait("Black Panther");
const TECH = trait("Tech");

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const ENERGY = stubResource({ id: "energy", icons: 0, produces: { energy: 2 } });
const MENTAL = stubResource({ id: "mental", icons: 0, produces: { mental: 1 } });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }],
});
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

interface Setup {
  readonly cards?: readonly AnyCard[];
  readonly abilities?: readonly StubAbility[];
  readonly players?: number;
  readonly encounter?: readonly CardId[];
  readonly identity?: ReturnType<typeof stubIdentity>;
}

function setup({ cards = [], abilities = [], players = 1, encounter, identity }: Setup) {
  const deps = depsOf(...abilities);
  const playerCards = cards.filter((c) => ["ally", "event", "support", "upgrade", "resource"].includes(c.type));
  const state = newGame({
    players,
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [BLANK, ENERGY, MENTAL, ...cards],
    deck: [
      ...playerCards.flatMap((c) => copies(c.id)),
      ...copies(ENERGY.id),
      ...copies(MENTAL.id),
      ...copies(RESOURCE.id, 8),
      ...copies(ALLY.id),
    ],
    encounterDeck: encounter ?? copies(BLANK.id, 20),
    ...(identity ? { identity } : {}),
    deps,
  });
  return { deps, state };
}

/** Test surgery: put these deck cards (by card id, first copies found) on top of the player's deck, in order. */
function stackDeck(
  state: GameState,
  player: PlayerId,
  ...cards: readonly CardId[]
): { state: GameState; ids: readonly InstanceId[] } {
  const deck = [...mustPlayer(state, player).deck];
  const top: InstanceId[] = [];
  for (const card of cards) {
    const index = deck.findIndex((id) => state.instances[id]?.cardId === card && !top.includes(id));
    if (index < 0) throw new Error(`no ${card} in deck`);
    top.push(deck[index] as InstanceId);
    deck.splice(index, 1);
  }
  return {
    ids: top,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === player ? { ...p, deck: [...top, ...deck] } : p)),
    },
  };
}
const rejected = (deps: EngineDeps, state: GameState, command: Command): string => {
  const result = applyCommand(state, command, deps);
  if (result.ok) throw new Error("expected rejection");
  return result.error.code;
};
const damageOn = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
const threat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;

describe("deck and discard manipulation", () => {
  it("'discard the top 2 cards of your deck; add each with a printed [mental] resource to your hand' (Black Cat)", () => {
    const cat = stubAbility(
      "black-cat",
      def({
        trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
        effects: [
          {
            kind: "moveCards",
            cards: { kind: "zone", zone: "deck", player: controller, top: { kind: "const", value: 2 } },
            to: "discard",
            bind: "d",
          },
          {
            kind: "moveCards",
            cards: { kind: "ref", ref: { kind: "slot", slot: "d" }, filter: { printedResource: "mental" } },
            to: "hand",
          },
        ],
      }),
    );
    const CAT = stubAlly({ id: "cat", cost: 0, atk: 1, thw: 1, hp: 2, abilities: [cat.ref] });
    const { deps, state } = setup({ cards: [CAT], abilities: [cat] });
    const given = giveCards(state, p1, "cat");
    const stacked = stackDeck(given.state, p1, MENTAL.id, ENERGY.id);
    const [mentalId, energyId] = stacked.ids as [InstanceId, InstanceId];
    const after = runWith(deps, stacked.state, play(given.ids[0] as InstanceId));
    expect(mustPlayer(after, p1).hand).toContain(mentalId);
    expect(mustPlayer(after, p1).discard).toContain(energyId);
  });

  it("'Deal 1 damage and discard the top 5; +2 damage for each printed [energy] resource' (Repulsor Blast)", () => {
    const blast = stubAbility(
      "repulsor",
      def({
        trigger: { kind: "action", form: "hero" },
        label: ["attack"],
        effects: [
          {
            kind: "moveCards",
            cards: { kind: "zone", zone: "deck", player: controller, top: { kind: "const", value: 5 } },
            to: "discard",
            bind: "d",
          },
          {
            kind: "attack",
            target: { kind: "villain" },
            amount: { kind: "scaled", value: { kind: "var", name: "d.energy" }, times: 2, plus: 1 },
          },
        ],
      }),
    );
    const BLAST = stubEvent({ id: "repulsor", cost: 0, abilities: [blast.ref] });
    const { deps, state } = setup({ cards: [BLAST], abilities: [blast] });
    const given = giveCards(state, p1, "repulsor");
    const stacked = stackDeck(given.state, p1, ENERGY.id, RESOURCE.id, RESOURCE.id, MENTAL.id, RESOURCE.id);
    const after = runWith(deps, stacked.state, toHero(), play(given.ids[0] as InstanceId));
    expect(damageOn(after, activeVillain(after).instanceId)).toBe(5); // 1 + 2 × (2 energy icons)
  });

  it("'Look at the top 3 cards of your deck. Add 1 to your hand and discard the others' (Tony Stark)", () => {
    const futurist = stubAbility(
      "futurist",
      def({
        trigger: { kind: "action" },
        effects: [
          {
            kind: "chooseCards",
            slot: "pick",
            chooser: controller,
            min: 1,
            max: 1,
            from: { kind: "zone", zone: "deck", player: controller, top: { kind: "const", value: 3 } },
          },
          { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "pick" } }, to: "hand" },
          {
            kind: "moveCards",
            cards: { kind: "zone", zone: "deck", player: controller, top: { kind: "const", value: 2 } },
            to: "discard",
          },
        ],
      }),
    );
    const DESK = stubSupport({ id: "desk", cost: 0, abilities: [futurist.ref] });
    const { deps, state } = setup({ cards: [DESK], abilities: [futurist] });
    const given = giveCards(state, p1, "desk");
    const stacked = stackDeck(given.state, p1, ENERGY.id, MENTAL.id, RESOURCE.id);
    const [a, b, c] = stacked.ids as [InstanceId, InstanceId, InstanceId];
    const atChoice = runWith(
      deps,
      stacked.state,
      play(given.ids[0] as InstanceId),
      use(given.ids[0] as InstanceId, "futurist"),
    );
    expect(atChoice.pendingChoice?.options.map((o) => o.optionId)).toEqual([a, b, c]);
    const after = resolvePending(atChoice, [b], deps);
    expect(mustPlayer(after, p1).hand).toContain(b);
    expect(mustPlayer(after, p1).discard).toEqual(expect.arrayContaining([a, c]));
  });

  it("'Search your deck for an upgrade and add it to your hand. Shuffle your deck.' (Shuri)", () => {
    const shuri = stubAbility(
      "shuri",
      def({
        trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
        effects: [
          {
            kind: "chooseCards",
            slot: "u",
            chooser: controller,
            min: 1,
            max: 1,
            from: { kind: "zone", zone: "deck", player: controller, filter: { categories: ["upgrade"] } },
          },
          { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "u" } }, to: "hand" },
          { kind: "shuffleDeck", player: controller },
        ],
      }),
    );
    const SHURI = stubAlly({ id: "shuri", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [shuri.ref] });
    const GEAR = stubUpgrade({ id: "gear", cost: 0 });
    const { deps, state } = setup({ cards: [SHURI, GEAR], abilities: [shuri] });
    const given = giveCards(state, p1, "shuri");
    const atChoice = runWith(deps, given.state, play(given.ids[0] as InstanceId));
    const options = atChoice.pendingChoice?.options ?? [];
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((o) => atChoice.instances[o.optionId]?.cardId === GEAR.id)).toBe(true);
    const result = applyCommand(
      atChoice,
      {
        type: "resolveChoice",
        playerId: p1,
        choiceId: atChoice.pendingChoice?.choiceId as never,
        selectedOptionIds: [options[0]?.optionId as string],
      },
      deps,
    );
    expect(result.ok && mustPlayer(result.state, p1).hand).toContain(options[0]?.optionId);
    expect(result.ok && result.events.some((e) => e.type === "deckShuffled")).toBe(true);
  });

  it("'Choose a player. That player returns the topmost Tech upgrade in their discard pile to their hand' (Stark Tower)", () => {
    const tower = stubAbility(
      "stark-tower",
      def({
        trigger: { kind: "action", form: "alterEgo" },
        effects: [
          { kind: "choosePlayer", slot: "pl", chooser: controller },
          {
            kind: "moveCards",
            cards: {
              kind: "zone",
              zone: "discard",
              player: { kind: "slot", slot: "pl" },
              filter: { categories: ["upgrade"], trait: TECH },
              topmostOnly: true,
            },
            to: "hand",
          },
        ],
      }),
    );
    const TOWER = stubSupport({ id: "tower", cost: 0, abilities: [tower.ref] });
    const GADGET = stubUpgrade({ id: "gadget", cost: 0, traits: [TECH] });
    const { deps, state } = setup({ cards: [TOWER, GADGET], abilities: [tower], players: 2 });
    const given = giveCards(state, p1, "tower");
    const p2Gadgets = mustPlayer(given.state, p2)
      .deck.filter((id) => given.state.instances[id]?.cardId === GADGET.id)
      .slice(0, 2) as [InstanceId, InstanceId];
    const withDiscard: GameState = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === p2
          ? { ...p, deck: p.deck.filter((id) => !p2Gadgets.includes(id)), discard: [...p2Gadgets, ...p.discard] }
          : p,
      ),
    };
    const atChoice = runWith(
      deps,
      withDiscard,
      play(given.ids[0] as InstanceId),
      use(given.ids[0] as InstanceId, "stark-tower"),
    );
    const after = resolvePending(atChoice, [p2], deps);
    expect(mustPlayer(after, p2).hand).toContain(p2Gadgets[0]);
    expect(mustPlayer(after, p2).discard).toContain(p2Gadgets[1]);
  });

  it("'Choose up to 3 different cards in your discard pile and shuffle them into your deck' (Ancestral Knowledge)", () => {
    const knowledge = stubAbility(
      "ancestral",
      def({
        trigger: { kind: "action", form: "alterEgo" },
        effects: [
          {
            kind: "chooseCards",
            slot: "c",
            chooser: controller,
            min: 0,
            max: 3,
            distinctNames: true,
            from: { kind: "zone", zone: "discard", player: controller },
          },
          { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "c" } }, to: "deckShuffle" },
        ],
      }),
    );
    const EVENT = stubEvent({ id: "ancestral", cost: 0, abilities: [knowledge.ref] });
    const { deps, state } = setup({ cards: [EVENT], abilities: [knowledge] });
    const given = giveCards(state, p1, "ancestral", ENERGY.id, ENERGY.id, MENTAL.id, RESOURCE.id);
    const [eventId, e1, e2, m1, r1] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    const discarded: GameState = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === p1
          ? { ...p, hand: p.hand.filter((id) => ![e1, e2, m1, r1].includes(id)), discard: [e1, e2, m1, r1] }
          : p,
      ),
    };
    const atChoice = runWith(deps, discarded, play(eventId));
    expect(atChoice.pendingChoice?.options).toHaveLength(3); // one Energy offered, not two
    const after = resolvePending(atChoice, [e1, m1, r1], deps);
    expect(mustPlayer(after, p1).deck).toEqual(expect.arrayContaining([e1, m1, r1]));
    expect(mustPlayer(after, p1).discard).toEqual(expect.arrayContaining([e2, eventId]));
  });

  it("'Return Hellcat to your hand' — a card leaving play to hand loses its damage", () => {
    const hellcat = stubAbility(
      "hellcat",
      def({
        trigger: { kind: "action" },
        effects: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "hand" }],
      }),
    );
    const HELLCAT = stubAlly({ id: "hellcat", cost: 0, atk: 1, thw: 2, hp: 3, abilities: [hellcat.ref] });
    const { deps, state } = setup({ cards: [HELLCAT], abilities: [hellcat] });
    const given = giveCards(state, p1, "hellcat");
    const id = given.ids[0] as InstanceId;
    const inPlay = runWith(deps, given.state, play(id));
    const hurt: GameState = {
      ...inPlay,
      instances: { ...inPlay.instances, [id]: { ...mustInstance(inPlay, id), damage: 2 } },
    };
    const after = runWith(deps, hurt, use(id, "hellcat"));
    expect(mustPlayer(after, p1).hand).toContain(id);
    expect(mustInstance(after, id).damage).toBe(0);
  });
});

describe("form, choices, players", () => {
  it("'Change your form. Then, draw up to your printed hand size' — doesn't use the round's form change; 'after you change to this form' fires", () => {
    const split = stubAbility(
      "split",
      def({
        trigger: { kind: "action" },
        effects: [
          { kind: "changeForm", player: controller },
          { kind: "drawUpTo", player: controller, amount: { kind: "handSize", player: controller, printed: true } },
        ],
      }),
    );
    const lift = stubAbility(
      "do-you-even-lift",
      def({
        trigger: { kind: "response", forced: false, form: "hero", on: { on: "formChanged", playerIs: "controller" } },
        effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 2 } }],
      }),
    );
    const identity = stubIdentity({
      id: "she-hulk",
      hp: 15,
      atk: 3,
      thw: 1,
      def: 2,
      rec: 5,
      heroHandSize: 8,
      alterEgoHandSize: 6,
      heroAbilities: [lift.ref],
    });
    const SPLIT = stubEvent({ id: "split", cost: 0, abilities: [split.ref] });
    const { deps, state } = setup({ cards: [SPLIT], abilities: [split, lift], identity });
    const given = giveCards(state, p1, "split");
    const offered = settleUntil(runWith(deps, given.state, play(given.ids[0] as InstanceId)), "chooseTriggers", deps);
    const after = settle(
      resolvePending(offered, [offered.pendingChoice?.options[0]?.optionId as string], deps),
      undefined,
      deps,
    );
    expect(mustPlayer(after, p1).identity.form).toBe("hero");
    expect(damageOn(after, activeVillain(after).instanceId)).toBe(2);
    expect(mustPlayer(after, p1).hand).toHaveLength(8);
    // The voluntary flip is still available this round.
    expect(mustPlayer(after, p1).identity.changedFormThisRound).toBe(false);
    expect(mustPlayer(runWith(deps, after, toHero()), p1).identity.form).toBe("alterEgo");
  });

  it("'choose one: remove 2 threat, draw 3 cards, or deal 4 damage to an enemy' (Nick Fury) offers only options that can happen", () => {
    const fury = stubAbility(
      "nick-fury",
      def({
        trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
        effects: [
          {
            kind: "chooseOne",
            chooser: controller,
            options: [
              {
                label: "Remove 2 threat from a scheme",
                condition: { kind: "exists", query: { categories: ["sideScheme"], hasThreat: true } },
                effects: [],
              },
              {
                label: "Draw 3 cards",
                effects: [{ kind: "draw", player: controller, amount: { kind: "const", value: 3 } }],
              },
              {
                label: "Deal 4 damage to an enemy",
                effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 4 } }],
              },
            ],
          },
        ],
      }),
    );
    const FURY = stubAlly({ id: "fury", cost: 0, atk: 2, thw: 2, hp: 3, abilities: [fury.ref] });
    const { deps, state } = setup({ cards: [FURY], abilities: [fury] });
    const given = giveCards(state, p1, "fury");
    const atChoice = runWith(deps, given.state, play(given.ids[0] as InstanceId));
    expect(atChoice.pendingChoice?.prompt.kind).toBe("chooseOption");
    expect(atChoice.pendingChoice?.options.map((o) => o.optionId)).toEqual(["1", "2"]);
    const handBefore = mustPlayer(atChoice, p1).hand.length;
    const after = resolvePending(atChoice, ["1"], deps);
    expect(mustPlayer(after, p1).hand.length).toBe(handBefore + 3);
  });

  it("'Choose a player to draw 1 card' (Carol Danvers)", () => {
    const commander = stubAbility(
      "commander",
      def({
        trigger: { kind: "action" },
        effects: [
          { kind: "choosePlayer", slot: "pl", chooser: controller },
          { kind: "draw", player: { kind: "slot", slot: "pl" }, amount: { kind: "const", value: 1 } },
        ],
      }),
    );
    const OFFICE = stubSupport({ id: "office", cost: 0, abilities: [commander.ref] });
    const { deps, state } = setup({ cards: [OFFICE], abilities: [commander], players: 2 });
    const given = giveCards(state, p1, "office");
    const atChoice = runWith(
      deps,
      given.state,
      play(given.ids[0] as InstanceId),
      use(given.ids[0] as InstanceId, "commander"),
    );
    expect(atChoice.pendingChoice?.options.map((o) => o.optionId)).toEqual([p1, p2]);
    const before = mustPlayer(atChoice, p2).hand.length;
    const after = resolvePending(atChoice, [p2], deps);
    expect(mustPlayer(after, p2).hand.length).toBe(before + 1);
  });

  it("'Each player discards the top 5 cards of their deck; for each printed [energy] resource, that player takes 1 damage'", () => {
    const backlash = stubAbility(
      "backlash",
      def({
        trigger: { kind: "action" },
        effects: [
          {
            kind: "forEachPlayer",
            players: { kind: "each" },
            effects: [
              {
                kind: "moveCards",
                cards: { kind: "zone", zone: "deck", player: { kind: "scoped" }, top: { kind: "const", value: 5 } },
                to: "discard",
                bind: "d",
              },
              {
                kind: "dealDamage",
                target: { kind: "identityOf", player: { kind: "scoped" } },
                amount: { kind: "var", name: "d.energy" },
              },
            ],
          },
        ],
      }),
    );
    const EVENT = stubEvent({ id: "backlash", cost: 0, abilities: [backlash.ref] });
    const { deps, state } = setup({ cards: [EVENT], abilities: [backlash], players: 2 });
    const given = giveCards(state, p1, "backlash");
    const s1 = stackDeck(given.state, p1, ENERGY.id, RESOURCE.id, RESOURCE.id, RESOURCE.id, RESOURCE.id);
    const s2 = stackDeck(s1.state, p2, RESOURCE.id, RESOURCE.id, RESOURCE.id, RESOURCE.id, MENTAL.id);
    const after = runWith(deps, s2.state, play(given.ids[0] as InstanceId));
    expect(damageOn(after, mustPlayer(after, p1).identity.instanceId)).toBe(2);
    expect(damageOn(after, mustPlayer(after, p2).identity.instanceId)).toBe(0);
  });

  it("'Deal 1 damage to each enemy' (Ground Stomp) — `each` targets", () => {
    const stomp = stubAbility(
      "stomp",
      def({
        trigger: { kind: "action", form: "hero" },
        effects: [
          {
            kind: "dealDamage",
            target: { kind: "each", query: { categories: ["enemy"] } },
            amount: { kind: "const", value: 1 },
          },
        ],
      }),
    );
    const STOMP = stubEvent({ id: "stomp", cost: 0, abilities: [stomp.ref] });
    const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 3, boostIcons: 0 });
    const { deps, state } = setup({ cards: [STOMP, THUG], abilities: [stomp], encounter: copies(THUG.id, 20) });
    const roundTwo = settle(runWith(deps, state, endTurn()), undefined, deps);
    const [thug] = mustPlayer(roundTwo, p1).playArea.filter((id) => roundTwo.instances[id]?.cardId === THUG.id) as [
      InstanceId,
    ];
    const given = giveCards(roundTwo, p1, "stomp");
    const after = runWith(deps, given.state, toHero(), play(given.ids[0] as InstanceId));
    expect(damageOn(after, activeVillain(after).instanceId)).toBe(1);
    expect(damageOn(after, thug)).toBe(1);
  });
});

describe("Special abilities in a sequence (Wakanda Forever!)", () => {
  const claws = stubAbility(
    "claws",
    def({
      trigger: { kind: "special" },
      label: ["attack"],
      effects: [
        {
          kind: "attack",
          target: { kind: "villain" },
          amount: {
            kind: "conditional",
            if: { kind: "varAtLeast", name: "sequence.final", amount: 1 },
            then: { kind: "const", value: 4 },
            else: { kind: "const", value: 2 },
          },
        },
      ],
    }),
  );
  const genius = stubAbility(
    "tactical",
    def({
      trigger: { kind: "special" },
      label: ["thwart"],
      effects: [
        {
          kind: "thwart",
          target: { kind: "mainScheme" },
          amount: {
            kind: "conditional",
            if: { kind: "varAtLeast", name: "sequence.final", amount: 1 },
            then: { kind: "const", value: 2 },
            else: { kind: "const", value: 1 },
          },
        },
      ],
    }),
  );
  const wakanda = stubAbility(
    "wakanda",
    def({
      trigger: { kind: "action", form: "hero" },
      effects: [
        { kind: "resolveSpecials", cards: { categories: ["upgrade"], controller: "you", trait: BLACK_PANTHER } },
      ],
    }),
  );
  const CLAWS = stubUpgrade({ id: "claws", cost: 0, traits: [BLACK_PANTHER], abilities: [claws.ref] });
  const GENIUS = stubUpgrade({ id: "genius", cost: 0, traits: [BLACK_PANTHER], abilities: [genius.ref] });
  const WAKANDA = stubEvent({ id: "wakanda", cost: 0, abilities: [wakanda.ref] });

  it("resolves each Special in the chosen order; only the last step is 'the final step of this sequence'", () => {
    const { deps, state } = setup({ cards: [CLAWS, GENIUS, WAKANDA], abilities: [claws, genius, wakanda] });
    const given = giveCards(state, p1, "claws", "genius", "wakanda");
    const [clawsId, geniusId, eventId] = given.ids as [InstanceId, InstanceId, InstanceId];
    const ready = runWith(deps, given.state, toHero(), play(clawsId), play(geniusId));
    expect(rejected(deps, ready, use(clawsId, "claws"))).toBe("wrong_phase"); // Specials only resolve when instructed
    const ordering = runWith(deps, ready, play(eventId));
    expect(ordering.pendingChoice?.prompt.kind).toBe("orderSpecials");
    const after = resolvePending(ordering, [`${geniusId}:tactical`, `${clawsId}:claws`], deps);
    expect(threat(after)).toBe(4); // tactical first: 1
    expect(damageOn(after, activeVillain(after).instanceId)).toBe(4); // claws last: 4
  });
});

describe("play restrictions and upgrade hosts (schema PlayRestrictions / AttachmentHost)", () => {
  it("'Hero form only', 'Max 1 per player', 'Attach to an ally. Max 1 per ally.'", () => {
    const HEROIC = stubEvent({ id: "heroic", cost: 0 });
    const heroic: AnyCard = { ...HEROIC, playRestrictions: { form: "hero" } };
    const MANSION: AnyCard = { ...stubSupport({ id: "mansion", cost: 0 }), playRestrictions: { maxPerPlayer: 1 } };
    const INSPIRED: AnyCard = {
      ...stubUpgrade({ id: "inspired", cost: 0 }),
      attachesTo: { kind: "ally" },
      playRestrictions: { maxPerHost: 1 },
    };
    const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 3 });
    const { deps, state } = setup({ cards: [heroic, MANSION, INSPIRED, PAL] });
    const given = giveCards(state, p1, "heroic", "mansion", "mansion", "inspired", "inspired", "pal");
    const [heroicId, m1, m2, i1, i2, palId] = given.ids as [
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
    ];
    expect(rejected(deps, given.state, play(heroicId))).toBe("wrong_form");
    const oneMansion = runWith(deps, given.state, play(m1));
    expect(rejected(deps, oneMansion, play(m2))).toBe("no_valid_target");
    const withPal = runWith(deps, oneMansion, play(palId));
    expect(rejected(deps, withPal, play(i1))).toBe("no_valid_target"); // no host given: must be an ally
    expect(rejected(deps, withPal, play(i1, { attachToInstanceId: mustPlayer(withPal, p1).identity.instanceId }))).toBe(
      "no_valid_target",
    );
    const inspired = runWith(deps, withPal, play(i1, { attachToInstanceId: palId }));
    expect(mustInstance(inspired, palId).attachments).toContain(i1);
    expect(rejected(deps, inspired, play(i2, { attachToInstanceId: palId }))).toBe("no_valid_target");
  });

  it("'Play under any player's control. Your hero gets +1 ATK.' (Combat Training)", () => {
    const training = stubAbility(
      "training",
      def({
        trigger: {
          kind: "constant",
          modifiers: [{ stat: "atk", amount: 1, target: { categories: ["hero"], controller: "you" } }],
        },
        effects: [],
      }),
    );
    const TRAINING: AnyCard = {
      ...stubUpgrade({ id: "training", cost: 0, abilities: [training.ref] }),
      playRestrictions: { anyPlayerControl: true, maxPerPlayer: 1 },
    };
    const OWN_ONLY = stubUpgrade({ id: "own-only", cost: 0 });
    const { deps, state } = setup({ cards: [TRAINING, OWN_ONLY], abilities: [training], players: 2 });
    // Round 1: p1 flips to hero and passes; on p2's turn, p2 plays the upgrade under p1's control.
    const given = giveCards(state, p2, "training", "own-only");
    const [trainingId, ownId] = given.ids as [InstanceId, InstanceId];
    const byP2 = (id: InstanceId, controllerId: PlayerId): Command => ({
      type: "playCard",
      playerId: p2,
      cardInstanceId: id,
      payment: [],
      attachToInstanceId: null,
      controllerId,
    });
    const p2Turn = runWith(deps, given.state, toHero(p1), endTurn(p1), toHero(p2));
    expect(rejected(deps, p2Turn, byP2(ownId, p1))).toBe("no_valid_target");
    const after = runWith(deps, p2Turn, byP2(trainingId, p1));
    const p1Identity = mustPlayer(after, p1).identity.instanceId;
    expect(mustInstance(after, p1Identity).attachments).toContain(trainingId);
    expect(characterProfile(after, p1Identity, deps)?.atk).toBe(3);
    expect(characterProfile(after, mustPlayer(after, p2).identity.instanceId, deps)?.atk).toBe(2);
  });

  it("an identity 'Setup:' ability resolves during setup (T'Challa: search for a Black Panther upgrade)", () => {
    const foresight = stubAbility(
      "foresight",
      def({
        trigger: { kind: "setup" },
        effects: [
          {
            kind: "chooseCards",
            slot: "u",
            chooser: controller,
            min: 1,
            max: 1,
            from: {
              kind: "zone",
              zone: "deck",
              player: controller,
              filter: { categories: ["upgrade"], trait: BLACK_PANTHER },
            },
          },
          { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "u" } }, to: "hand" },
          { kind: "shuffleDeck", player: controller },
        ],
      }),
    );
    const identity = stubIdentity({
      id: "tchalla",
      hp: 11,
      atk: 2,
      thw: 2,
      def: 2,
      rec: 4,
      heroHandSize: 5,
      alterEgoHandSize: 6,
      alterEgoAbilities: [foresight.ref],
    });
    const CLAWS = stubUpgrade({ id: "claws", cost: 0, traits: [BLACK_PANTHER] });
    const deps = depsOf(foresight);
    const start = newGameAtMulligan({
      identity,
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: [CLAWS],
      deck: [...copies(CLAWS.id, 2), ...copies(RESOURCE.id, 20)],
      deps,
    });
    // RRG 1.8 Appendix II (p. 51): the mulligan is step 15 and player "Setup:" abilities are step 16, so the search
    // happens after the opening hand is drawn and mulliganed (docs/phase7-wave1.md §3.15).
    expect(start.pendingChoice?.prompt.kind).toBe("mulligan");
    const atSetup = resolvePending(start, [], deps);
    expect(atSetup.pendingChoice?.prompt).toEqual({ kind: "chooseCards", slot: "u" });
    const picked = atSetup.pendingChoice?.options[0]?.optionId as InstanceId;
    const afterSetup = resolvePending(atSetup, [picked], deps);
    expect(mustPlayer(afterSetup, p1).hand).toContain(picked);
    expect(mustPlayer(afterSetup, p1).hand).toHaveLength(7);
  });
});

test("card manipulation, choices and sequences replay to an identical state", () => {
  const futurist = stubAbility(
    "futurist",
    def({
      trigger: { kind: "action" },
      effects: [
        {
          kind: "chooseCards",
          slot: "pick",
          chooser: controller,
          min: 1,
          max: 1,
          from: { kind: "zone", zone: "deck", player: controller, top: { kind: "const", value: 3 } },
        },
        { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "pick" } }, to: "hand" },
        {
          kind: "moveCards",
          cards: { kind: "zone", zone: "deck", player: controller, top: { kind: "const", value: 2 } },
          to: "discard",
          bind: "d",
        },
        {
          kind: "chooseOne",
          chooser: controller,
          options: [
            { label: "draw", effects: [{ kind: "draw", player: controller, amount: { kind: "const", value: 1 } }] },
            { label: "shuffle", effects: [{ kind: "shuffleDeck", player: controller }] },
          ],
        },
      ],
    }),
  );
  const DESK = stubSupport({ id: "desk", cost: 0, abilities: [futurist.ref] });
  const { deps, state } = setup({ cards: [DESK], abilities: [futurist] });
  const given = giveCards(state, p1, "desk");
  let session: GameSession = startSession(given.state);
  const apply = (command: Command) => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
  };
  apply(play(given.ids[0] as InstanceId));
  apply(use(given.ids[0] as InstanceId, "futurist"));
  while (session.state.pendingChoice) {
    const choice = session.state.pendingChoice;
    apply({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: [choice.options[choice.options.length - 1]?.optionId as string],
    });
  }
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
});
