/**
 * docs/phase7-wave2.md §3.5 onward: the cycle 1 primitives many cards share, one test each, with synthetic cards.
 *
 * Sources: RRG 1.8 "Team-Up" (p. 43), "Max, Maximum" (p. 28), "Ally Limit" (p. 7), "Friendly" (p. 21), "Boost" (p. 11),
 * "Choose (Option)" (p. 12), "Cost" (p. 13), "Dash (Value)" (p. 15), "Ignore" (p. 23), "Non-Numerical Variable" (p. 30),
 * "Requirement (Resources)" (p. 37); FAQ "Wasp (#1C)" (p. 61); the Ant-Man insert ("(hero or ally)").
 */

import { encounterSetId, trait, type AnyCard, type CardId, type PlayerCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityTriggerSpec, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { createCtx } from "./ctx.js";
import { selectCards } from "./resolve/cards.js";
import { createGame } from "./setup.js";
import { traitsOf } from "./select.js";
import {
  stubAlly,
  stubEnvironment,
  stubEvent,
  stubIdentity,
  stubMinion,
  stubResource,
  stubSideScheme,
  stubSupport,
  stubTreachery,
} from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  defaultPick,
  giveCard,
  giveCards,
  MAIN_SCHEME,
  newGame,
  settle,
  TREACHERY,
  VILLAIN,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const abilities: StubAbility[] = [];
const ability = (id: string, trigger: AbilityTriggerSpec, effects: readonly EffectSpec[] = []) => {
  const made = stubAbility(id, { trigger, effects });
  abilities.push(made);
  return made.ref;
};
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

// ---- §3.5 --------------------------------------------------------------------------------------------------------

const QS_BASE = stubIdentity({
  id: "qs",
  name: "Quicksilver",
  hp: 10,
  atk: 1,
  thw: 1,
  def: 1,
  rec: 1,
  heroHandSize: 5,
  alterEgoHandSize: 5,
});
const QUICKSILVER = { ...QS_BASE, hero: { ...QS_BASE.hero, faceName: "Quicksilver" } };
const WITCH = { ...stubAlly({ id: "Scarlet Witch", cost: 0, atk: 1, thw: 1, hp: 3 }) };
const ORDER: PlayerCard = {
  ...stubEvent({ id: "order-and-chaos", cost: 0, abilities: [ability("order.action", { kind: "action" })] }),
  keywords: [{ name: "teamUp", names: ["Quicksilver", "Scarlet Witch"] }],
};
const VELOCITY: PlayerCard = {
  ...stubEvent({ id: "maximum-velocity", cost: 0, abilities: [ability("velocity.action", { kind: "action" })] }),
  playRestrictions: { maxPerPhase: 1 },
};
const GRUNT = stubAlly({ id: "grunt", cost: 0, atk: 1, thw: 1, hp: 3 });
const STINGER = stubAlly({
  id: "stinger",
  cost: 0,
  atk: 1,
  thw: 1,
  hp: 3,
  abilities: [
    ability("stinger.constant", {
      kind: "constant",
      rules: [{ kind: "excludedFromAllyLimit", target: { self: true } }],
    }),
  ],
});
const CARDS: readonly AnyCard[] = [QUICKSILVER, WITCH, ORDER, VELOCITY, GRUNT, STINGER];
const deps: EngineDeps = depsOf(...abilities);

function game(): GameState {
  const state = newGame({
    identity: QUICKSILVER,
    deps,
    extraCards: CARDS,
    deck: [
      ...DEFAULT_DECK,
      WITCH.id,
      ...copies(ORDER.id, 2),
      ...copies(VELOCITY.id, 2),
      ...copies(GRUNT.id, 4),
      STINGER.id,
    ],
  });
  const hero = applyCommand(state, { type: "changeForm", playerId: p1 }, deps);
  if (!hero.ok) throw new Error(hero.error.message);
  return settle(hero.state, defaultPick, deps);
}
const play = (state: GameState, card: string, exclude: readonly InstanceId[] = []) => {
  const given = giveCard(state, p1, card, exclude);
  const command: Command = {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  return { id: given.id, result: applyCommand(given.state, command, deps) };
};
const ok = (result: ReturnType<typeof applyCommand>): GameState => {
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
};

describe("§3.5 play restrictions", () => {
  it("Team-Up can be played only with both named characters in play, hero or ally (RRG 1.8 'Team-Up', p. 43)", () => {
    const alone = play(game(), ORDER.id);
    expect(alone.result.ok ? null : alone.result.error.message).toBe("Team-Up needs Scarlet Witch in play");
    const withWitch = ok(play(game(), WITCH.id).result);
    expect(play(withWitch, ORDER.id).result.ok).toBe(true);
  });

  it("'Max 1 per phase.' counts copies by title across the phase (RRG 1.8 'Max, Maximum', p. 28)", () => {
    const first = play(game(), VELOCITY.id);
    const after = ok(first.result);
    const second = play(after, VELOCITY.id, [first.id]);
    expect(second.result.ok ? null : second.result.error.code).toBe("limit_reached");
  });

  it("an ally that does not count against the ally limit stays with three others (RRG 1.8 'Ally Limit', p. 7)", () => {
    let state = game();
    const played: InstanceId[] = [];
    for (let i = 0; i < 3; i++) {
      const next = play(state, GRUNT.id, played);
      played.push(next.id);
      state = ok(next.result);
    }
    const stinger = play(state, STINGER.id);
    state = ok(stinger.result);
    expect(state.pendingChoice).toBeNull();
    expect(mustPlayer(state, p1).playArea).toHaveLength(4);
    const fourth = play(state, GRUNT.id, played);
    const over = ok(fourth.result);
    expect(over.pendingChoice?.prompt).toEqual({ kind: "discardOverAllyLimit", limit: 3 });
    // Stinger is not among the allies to discard.
    expect(over.pendingChoice?.options.map((o) => o.optionId)).not.toContain(stinger.id);
  });
});

// ---- §3.6 --------------------------------------------------------------------------------------------------------

describe("§3.6 counting boost icons (docs/phase7-wave2.md §3.6)", () => {
  const counting = (id: string, effects: readonly EffectSpec[]) =>
    stubAbility(id, { trigger: { kind: "interrupt", forced: true, on: { on: "boostIconsCounting" } }, effects });
  // "Increase … the number of boost icons on that card by 1 for this count" (Scarlet Witch's Crest).
  const CREST = counting("crest.interrupt", [{ kind: "adjustBoostCount", delta: { kind: "const", value: 1 } }]);
  // "… count the number of boost icons on that card instead" (Chaos Control), here a card with none: the identity.
  const CHAOS = counting("chaos.interrupt", [
    { kind: "replaceBoostCount", card: { kind: "identityOf", player: { kind: "controller" } } },
  ]);
  const ONE_ICON = stubTreachery({ id: "one-icon", boostIcons: 1 });
  const withAbility = (ref: StubAbility) =>
    stubIdentity({
      id: `wanda-${ref.ref.id}`,
      hp: 30,
      atk: 1,
      thw: 1,
      def: 1,
      rec: 1,
      heroHandSize: 5,
      alterEgoHandSize: 5,
      alterEgoAbilities: [ref.ref],
      heroAbilities: [ref.ref],
    });

  function schemeBoost(ability: StubAbility | null): Extract<GameEvent, { type: "schemeResolved" }> | undefined {
    const identity = ability ? withAbility(ability) : withAbility(CREST);
    const localDeps = depsOf(...(ability ? [ability] : []));
    const state = newGame({
      identity,
      deps: localDeps,
      extraCards: [ONE_ICON],
      encounterDeck: Array.from({ length: 12 }, () => ONE_ICON.id),
    });
    // Alter-ego form: the villain schemes and gets one boost card with 1 icon.
    let result = applyCommand(state, { type: "endTurn", playerId: p1 }, localDeps);
    const events: GameEvent[] = [];
    let guard = 0;
    while (result.ok && guard++ < 50) {
      events.push(...result.events);
      const found = events.find(
        (e): e is Extract<GameEvent, { type: "schemeResolved" }> => e.type === "schemeResolved",
      );
      const choice = result.state.pendingChoice;
      if (found || !choice) return found;
      result = applyCommand(
        result.state,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: defaultPick(result.state),
        },
        localDeps,
      );
    }
    if (!result.ok) throw new Error(result.error.message);
    return undefined;
  }

  it("without a listener the count is the card's icons, as before", () => {
    expect(schemeBoost(null)?.boostIcons).toBe(1);
  });

  it("an interrupt to the count changes it for this count only", () => {
    expect(schemeBoost(CREST)?.boostIcons).toBe(2);
  });

  it("a replacement counts another card's icons instead", () => {
    expect(schemeBoost(CHAOS)?.boostIcons).toBe(0);
  });
});

// ---- §3.7 --------------------------------------------------------------------------------------------------------

describe("§3.7 division and repeated options (docs/phase7-wave2.md §3.7)", () => {
  const HALF = { kind: "const", value: 1 } as const;
  const RETALIATOR = stubMinion({
    id: "retaliator",
    atk: 0,
    sch: 0,
    hp: 9,
    boostIcons: 0,
    keywords: [{ name: "retaliate", value: 1 }],
  });
  const PLAIN = stubMinion({ id: "plain-minion", atk: 0, sch: 0, hp: 9, boostIcons: 0 });
  const STING = stubAbility("sting.action", {
    trigger: { kind: "action" },
    effects: [
      {
        kind: "divide",
        what: "damage",
        amount: { kind: "const", value: 4 },
        among: { categories: ["minion"] },
        chooser: { kind: "controller" },
      },
    ],
  });
  const TWICE = stubAbility("twice.action", {
    trigger: { kind: "action" },
    effects: [
      {
        kind: "chooseOne",
        chooser: { kind: "controller" },
        count: 2,
        allowRepeat: true,
        options: [
          {
            label: "A counter",
            effects: [
              {
                kind: "addCounters",
                target: { kind: "identityOf", player: { kind: "controller" } },
                counterType: "a",
                amount: HALF,
              },
            ],
          },
          {
            label: "B counter",
            effects: [
              {
                kind: "addCounters",
                target: { kind: "identityOf", player: { kind: "controller" } },
                counterType: "b",
                amount: HALF,
              },
            ],
          },
        ],
      },
    ],
  });
  const GIANT_RULE = stubAbility("giant.constant", {
    trigger: {
      kind: "constant",
      rules: [{ kind: "divideBasicPower", power: "attack", target: { categories: ["identity"], controller: "you" } }],
    },
    effects: [],
  });
  const refs = [STING.ref, TWICE.ref, GIANT_RULE.ref];
  const WASP = stubIdentity({
    id: "wasp",
    hp: 20,
    atk: 3,
    thw: 1,
    def: 1,
    rec: 1,
    heroHandSize: 5,
    alterEgoHandSize: 5,
    heroAbilities: refs,
    alterEgoAbilities: refs,
  });
  const localDeps = depsOf(STING, TWICE, GIANT_RULE);

  /** A hero-form Wasp with the two minions engaged (test surgery moves them out of the encounter deck). */
  function waspGame(): { readonly state: GameState; readonly minions: readonly InstanceId[] } {
    const start = newGame({
      identity: WASP,
      deps: localDeps,
      extraCards: [RETALIATOR, PLAIN],
      encounterDeck: [RETALIATOR.id, PLAIN.id, ...Array.from({ length: 10 }, () => PLAIN.id)],
    });
    const hero = applyCommand(start, { type: "changeForm", playerId: p1 }, localDeps);
    if (!hero.ok) throw new Error(hero.error.message);
    const state = settle(hero.state, defaultPick, localDeps);
    const [deckId] = state.encounterDeckOrder;
    const piles = state.encounterDecks[deckId as string]!;
    const retaliator = piles.deck.find((id) => state.instances[id]?.cardId === RETALIATOR.id)!;
    const plain = piles.deck.find((id) => state.instances[id]?.cardId === PLAIN.id)!;
    const minions = [retaliator, plain];
    return {
      minions,
      state: {
        ...state,
        encounterDecks: {
          ...state.encounterDecks,
          [deckId as string]: { ...piles, deck: piles.deck.filter((id) => !minions.includes(id)) },
        },
        players: state.players.map((p) => ({ ...p, playArea: [...p.playArea, ...minions] })),
        instances: {
          ...state.instances,
          [retaliator]: { ...state.instances[retaliator]!, faceup: true, engagedWith: p1 },
          [plain]: { ...state.instances[plain]!, faceup: true, engagedWith: p1 },
        },
      },
    };
  }
  const use = (state: GameState, ability: StubAbility): GameState => {
    const result = applyCommand(
      state,
      {
        type: "useAbility",
        playerId: p1,
        cardInstanceId: state.players[0]!.identity.instanceId,
        abilityId: ability.ref.id,
        payment: [],
      },
      localDeps,
    );
    if (!result.ok) throw new Error(result.error.message);
    return result.state;
  };
  const answer = (state: GameState, ids: readonly string[]): GameState => {
    const choice = state.pendingChoice!;
    const result = applyCommand(
      state,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: ids },
      localDeps,
    );
    if (!result.ok) throw new Error(result.error.message);
    return result.state;
  };

  it("'deal a total of 4 damage divided among enemies you choose' asks once and deals each share", () => {
    const { state, minions } = waspGame();
    const [a, b] = minions as [InstanceId, InstanceId];
    const asked = use(state, STING);
    expect(asked.pendingChoice?.prompt).toEqual({ kind: "divide", what: "damage", amount: 4 });
    const done = answer(asked, [`${a}#1`, `${a}#2`, `${a}#3`, `${b}#1`]);
    expect([mustInstance(done, a).damage, mustInstance(done, b).damage]).toEqual([3, 1]);
  });

  it("'choose two (you may choose the same option twice)' resolves the same option twice (RRG 1.8 'Choose (Option)', p. 12)", () => {
    const { state } = waspGame();
    const asked = use(state, TWICE);
    expect(asked.pendingChoice?.minSelections).toBe(2);
    const done = answer(asked, ["0#1", "0#2"]);
    expect(mustInstance(done, done.players[0]!.identity.instanceId).counters).toEqual({ a: 2 });
  });

  it("a divided basic attack attacks each target, and each retaliate hits the attacker (FAQ 'Wasp (#1C)', p. 61)", () => {
    const { state, minions } = waspGame();
    const [a, b] = minions as [InstanceId, InstanceId];
    const hero = state.players[0]!.identity.instanceId;
    const bad = applyCommand(
      state,
      {
        type: "basicAttack",
        playerId: p1,
        attackerInstanceId: hero,
        targetInstanceId: a,
        divide: [
          { targetInstanceId: a, amount: 1 },
          { targetInstanceId: b, amount: 1 },
        ],
      },
      localDeps,
    );
    expect(bad.ok ? null : bad.error.message).toBe("the shares must total 3");
    const result = applyCommand(
      state,
      {
        type: "basicAttack",
        playerId: p1,
        attackerInstanceId: hero,
        targetInstanceId: a,
        divide: [
          { targetInstanceId: a, amount: 2 },
          { targetInstanceId: b, amount: 1 },
        ],
      },
      localDeps,
    );
    if (!result.ok) throw new Error(result.error.message);
    const after = settle(result.state, defaultPick, localDeps);
    expect([mustInstance(after, a).damage, mustInstance(after, b).damage]).toEqual([2, 1]);
    // Retaliate 1 from the one retaliating minion it attacked.
    expect(mustInstance(after, hero).damage).toBe(1);
  });

  it("a basic attack is not divided without the rule", () => {
    const { state, minions } = waspGame();
    const [a, b] = minions as [InstanceId, InstanceId];
    const plainDeps = depsOf(STING, TWICE);
    const hero = state.players[0]!.identity.instanceId;
    const result = applyCommand(
      state,
      {
        type: "basicAttack",
        playerId: p1,
        attackerInstanceId: hero,
        targetInstanceId: a,
        divide: [
          { targetInstanceId: a, amount: 2 },
          { targetInstanceId: b, amount: 1 },
        ],
      },
      plainDeps,
    );
    expect(result.ok ? null : result.error.message).toBe("this attack cannot be divided");
  });
});

// ---- §3.8 --------------------------------------------------------------------------------------------------------

describe("§3.8 payment: X, dash, overpaying, playing ignoring cost (docs/phase7-wave2.md §3.8)", () => {
  const identityCounters = (effects: string) => ({
    kind: "addCounters" as const,
    target: { kind: "identityOf" as const, player: { kind: "controller" as const } },
    counterType: effects,
    amount: { kind: "var" as const, name: effects },
  });
  const CYCLONE_ACTION = stubAbility("cyclone.action", {
    trigger: { kind: "action" },
    effects: [identityCounters("x")],
  });
  const CYCLONE: PlayerCard = {
    ...stubEvent({ id: "speed-cyclone", cost: 0, abilities: [CYCLONE_ACTION.ref] }),
    specialCost: "X",
  };
  const DASHED: PlayerCard = { ...stubEvent({ id: "basic-condition", cost: 0 }), specialCost: "dash" };
  const OVERPAY_ACTION = stubAbility("overpay.action", {
    trigger: { kind: "action" },
    effects: [
      {
        kind: "addCounters",
        target: { kind: "identityOf", player: { kind: "controller" } },
        counterType: "over",
        amount: { kind: "var", name: "overpaid.total" },
      },
      {
        kind: "addCounters",
        target: { kind: "identityOf", player: { kind: "controller" } },
        counterType: "overEnergy",
        amount: { kind: "var", name: "overpaid.energy" },
      },
    ],
  });
  const OVERPAY = stubEvent({ id: "overpay", cost: 1, abilities: [OVERPAY_ACTION.ref] });
  const MAGIC_ACTION = stubAbility("chaos-magic.action", {
    trigger: { kind: "action" },
    effects: [{ kind: "playFromHand", player: { kind: "controller" }, ignoreCost: true }],
  });
  const MAGIC = stubEvent({ id: "chaos-magic", cost: 0, abilities: [MAGIC_ACTION.ref] });
  const PRICEY = stubAlly({ id: "pricey", cost: 5, atk: 1, thw: 1, hp: 3 });
  const REQUIRED: PlayerCard = {
    ...stubAlly({ id: "required", cost: 5, atk: 1, thw: 1, hp: 3 }),
    keywords: [{ name: "requirement", resources: { mental: 1 } }],
  };
  const ENERGY = stubResource({ id: "energy", icons: 0, produces: { energy: 1 } });
  const payDeps = depsOf(CYCLONE_ACTION, OVERPAY_ACTION, MAGIC_ACTION);
  const cards = [CYCLONE, DASHED, OVERPAY, MAGIC, PRICEY, REQUIRED, ENERGY];
  const payGame = (): GameState =>
    newGame({
      deps: payDeps,
      extraCards: cards,
      deck: [...DEFAULT_DECK, ...cards.flatMap((card) => copies(card.id, 3))],
    });
  const counters = (state: GameState) => mustInstance(state, state.players[0]!.identity.instanceId).counters;
  const playWith = (
    state: GameState,
    card: string,
    payWith: readonly string[],
    extra: Partial<Extract<Command, { type: "playCard" }>> = {},
  ) => {
    let current = state;
    const paid: InstanceId[] = [];
    for (const resource of payWith) {
      const given = giveCard(current, p1, resource, paid);
      current = given.state;
      paid.push(given.id);
    }
    const given = giveCard(current, p1, card, paid);
    const command: Command = {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: paid.map((id) => ({ fromHand: id })),
      attachToInstanceId: null,
      ...extra,
    };
    const result = applyCommand(given.state, command, payDeps);
    return result.ok ? { ok: true as const, state: settle(result.state, defaultPick, payDeps) } : result;
  };

  it("a cost printed X costs the X chosen, and the ability reads it (RRG 1.8 'Non-Numerical Variable', p. 30)", () => {
    const tooLittle = playWith(payGame(), CYCLONE.id, ["res"], { x: 2 });
    expect(tooLittle.ok).toBe(false);
    const played = playWith(payGame(), CYCLONE.id, ["res", "res"], { x: 2 });
    expect(played.ok && counters(played.state)).toEqual({ x: 2 });
    const notX = playWith(payGame(), OVERPAY.id, ["res"], { x: 1 });
    expect(notX.ok ? null : notX.error.code).toBe("invalid_choice");
  });

  it("a cost printed '—' cannot be played (RRG 1.8 'Dash (Value)', p. 15)", () => {
    const result = playWith(payGame(), DASHED.id, []);
    expect(result.ok ? null : result.error.code).toBe("card_type_not_playable");
  });

  it("resources beyond the cost are overpaid, by type (RRG 1.8 'Cost', p. 13)", () => {
    const played = playWith(payGame(), OVERPAY.id, ["res", "energy", "energy"]);
    expect(played.ok && counters(played.state)).toEqual({ over: 2, overEnergy: 2 });
  });

  it("'Play a card from your hand, ignoring its resource cost' plays it with nothing paid, but never a Requirement card (RRG 1.8 'Ignore', p. 23)", () => {
    const {
      state: withCards,
      ids: [pricey, required],
    } = giveCards(payGame(), p1, PRICEY.id, REQUIRED.id);
    const magic = giveCard(withCards, p1, MAGIC.id);
    const cast = applyCommand(
      magic.state,
      { type: "playCard", playerId: p1, cardInstanceId: magic.id, payment: [], attachToInstanceId: null },
      payDeps,
    );
    if (!cast.ok) throw new Error(cast.error.message);
    const choice = cast.state.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId);
    expect(offered).toContain(pricey);
    expect(offered).not.toContain(required);
    const resolved = applyCommand(
      cast.state,
      { type: "resolveChoice", playerId: p1, choiceId: choice.choiceId, selectedOptionIds: [pricey!] },
      payDeps,
    );
    if (!resolved.ok) throw new Error(resolved.error.message);
    const state = settle(resolved.state, defaultPick, payDeps);
    expect(mustPlayer(state, p1).playArea).toContain(pricey);
    expect(resolved.events).toContainEqual(
      expect.objectContaining({ type: "cardPlayed", instanceId: pricey, resourcesPaid: 0 }),
    );
  });
});

// ---- §3.9 --------------------------------------------------------------------------------------------------------

describe("§3.9 allies printed with 0 hit points (docs/phase7-wave2.md §3.9)", () => {
  // "+1 hit point for each pym counter" and "When Ant-Man enters play, place 1 pym counter on him for each resource you
  // overpaid" (Ant-Man ally 12011), scripted as a constant and a forced response to entering play.
  const PYM_HP = stubAbility("pym.constant", {
    trigger: {
      kind: "constant",
      modifiers: [
        { stat: "hp", amount: { kind: "counters", of: { kind: "self" }, counterType: "pym" }, target: { self: true } },
      ],
    },
    effects: [],
  });
  const PYM_ENTERS = stubAbility("pym.enters", {
    trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "source" } },
    effects: [
      {
        kind: "addCounters",
        target: { kind: "self" },
        counterType: "pym",
        amount: { kind: "var", name: "overpaid.total" },
      },
    ],
  });
  const ANT_ALLY = stubAlly({
    id: "ant-ally",
    cost: 1,
    atk: 1,
    thw: 1,
    hp: 0,
    abilities: [PYM_HP.ref, PYM_ENTERS.ref],
  });
  const antDeps = depsOf(PYM_HP, PYM_ENTERS);
  const antGame = (): GameState =>
    newGame({ deps: antDeps, extraCards: [ANT_ALLY], deck: [...DEFAULT_DECK, ANT_ALLY.id] });
  const playAnt = (resources: number) => {
    let state = antGame();
    const paid: InstanceId[] = [];
    for (let i = 0; i < resources; i++) {
      const given = giveCard(state, p1, "res", paid);
      state = given.state;
      paid.push(given.id);
    }
    const ant = giveCard(state, p1, ANT_ALLY.id);
    const result = applyCommand(
      ant.state,
      {
        type: "playCard",
        playerId: p1,
        cardInstanceId: ant.id,
        payment: paid.map((id) => ({ fromHand: id })),
        attachToInstanceId: null,
      },
      antDeps,
    );
    if (!result.ok) throw new Error(result.error.message);
    return { id: ant.id, state: settle(result.state, defaultPick, antDeps) };
  };

  it("overpaid resources become counters before the defeat check, so the ally survives", () => {
    const { id, state } = playAnt(3);
    expect(mustPlayer(state, p1).playArea).toContain(id);
    expect(mustInstance(state, id).counters).toEqual({ pym: 2 });
  });

  it("with nothing overpaid it has 0 hit points once its entering play resolves, and is defeated (RRG 1.8 'Damage', p. 14)", () => {
    const { id, state } = playAnt(1);
    expect(mustPlayer(state, p1).playArea).not.toContain(id);
    expect(mustPlayer(state, p1).discard).toContain(id);
  });
});

// ---- §3.10 -------------------------------------------------------------------------------------------------------

describe("§3.10 cards under and on other cards; owning a scenario card (docs/phase7-wave2.md §3.10)", () => {
  const ALLY_UNDER: AnyCard = stubAlly({ id: "mockingbird", cost: 0, atk: 1, thw: 1, hp: 3 });
  const ARROW = stubEvent({
    id: "arrow",
    cost: 0,
    abilities: [
      ability("arrow.action", { kind: "action" }, [
        {
          kind: "addCounters",
          target: { kind: "identityOf", player: { kind: "controller" } },
          counterType: "arrow",
          amount: { kind: "const", value: 1 },
        },
      ]),
    ],
  });
  const QUIVER = stubSupport({
    id: "quiver",
    cost: 0,
    abilities: [ability("quiver.constant", { kind: "constant", playableAttachments: { categories: ["event"] } })],
  });
  const CAPTIVE_ALLY: AnyCard = {
    ...stubAlly({ id: "captive-ally", cost: 0, atk: 1, thw: 1, hp: 3 }),
    aspect: "none",
    specificTo: { kind: "scenario", encounterSetId: encounterSetId("taskmaster") },
  };
  // Test tools on the identity: tuck the ally in play under the villain, return it, arm the quiver, take the captive.
  const TUCK = ability("tuck.action", { kind: "action" }, [
    {
      kind: "tuckCards",
      cards: { kind: "ref", ref: { kind: "each", query: { categories: ["ally"] } } },
      under: { kind: "villain" },
    },
  ]);
  const RETURN = ability("return.action", { kind: "action" }, [
    { kind: "moveCards", cards: { kind: "tucked", under: { kind: "villain" } }, to: "hand" },
  ]);
  const ARM = ability("arm.action", { kind: "action" }, [
    {
      kind: "chooseCards",
      slot: "arrow",
      from: { kind: "zone", zone: "deck", player: { kind: "controller" }, filter: { name: "arrow" } },
      chooser: { kind: "controller" },
      min: 1,
      max: 1,
    },
    { kind: "attach", card: { kind: "slot", slot: "arrow" }, to: { kind: "each", query: { name: "quiver" } } },
  ]);
  const TAKE = ability("take.action", { kind: "action" }, [
    {
      kind: "takeIntoHand",
      cards: { kind: "encounterSetAside", filter: { name: "captive-ally" } },
      player: { kind: "controller" },
    },
  ]);
  const tools = [TUCK, RETURN, ARM, TAKE];
  const HAWK = stubIdentity({
    id: "hawk",
    hp: 30,
    atk: 1,
    thw: 1,
    def: 1,
    rec: 1,
    heroHandSize: 5,
    alterEgoHandSize: 5,
    heroAbilities: tools,
    alterEgoAbilities: tools,
  });
  const hawkDeps = depsOf(...abilities);
  const hawkGame = (): GameState => {
    const result = createGame(
      {
        seed: 9,
        cards: [...DEFAULT_CARDS, HAWK, ALLY_UNDER, ARROW, QUIVER, CAPTIVE_ALLY],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: MAIN_SCHEME.id,
        encounterDeck: Array.from({ length: 10 }, () => TREACHERY.id),
        setAside: [CAPTIVE_ALLY.id],
        includeIdentitySets: false,
        players: [{ identityCardId: HAWK.id, deck: [...DEFAULT_DECK, ALLY_UNDER.id, ARROW.id, ARROW.id, QUIVER.id] }],
      },
      hawkDeps,
    );
    if (!result.ok) throw new Error(result.error.message);
    return settle(result.state, defaultPick, hawkDeps);
  };
  const run = (state: GameState, command: Command): GameState => {
    const result = applyCommand(state, command, hawkDeps);
    if (!result.ok) throw new Error(result.error.message);
    return settle(result.state, defaultPick, hawkDeps);
  };
  const tool = (state: GameState, ref: { readonly id: string }): GameState =>
    run(state, {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: state.players[0]!.identity.instanceId,
      abilityId: ref.id as never,
      payment: [],
    });
  const playFromHand = (state: GameState, card: string): { readonly state: GameState; readonly id: InstanceId } => {
    const given = giveCard(state, p1, card);
    return {
      id: given.id,
      state: run(given.state, {
        type: "playCard",
        playerId: p1,
        cardInstanceId: given.id,
        payment: [],
        attachToInstanceId: null,
      }),
    };
  };

  it("a player card in play tucked under an encounter card leaves play, and returns to its owner's hand", () => {
    const { state, id } = playFromHand(hawkGame(), ALLY_UNDER.id);
    const tucked = tool(state, TUCK);
    const villain = tucked.activeVillainId;
    expect(mustInstance(tucked, villain).tucked).toEqual([id]);
    expect(mustPlayer(tucked, p1).playArea).not.toContain(id);
    const back = tool(tucked, RETURN);
    expect(mustPlayer(back, p1).hand).toContain(id);
  });

  it("an event attached to Hawkeye's Quiver can be played from there, as if from hand", () => {
    const { state } = playFromHand(hawkGame(), QUIVER.id);
    const armed = tool(state, ARM);
    const arrow = Object.values(armed.instances).find((i) => i.cardId === ARROW.id && i.attachedTo !== null)!;
    expect(arrow.faceup).toBe(true);
    const shot = run(armed, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: arrow.instanceId,
      payment: [],
      attachToInstanceId: null,
    });
    expect(mustInstance(shot, shot.players[0]!.identity.instanceId).counters).toEqual({ arrow: 1 });
    expect(mustPlayer(shot, p1).discard).toContain(arrow.instanceId);
  });

  it("a scenario card taken into a player's hand becomes theirs, so it is discarded to their pile (RRG 1.8 'Ownership and Control', p. 31)", () => {
    const taken = tool(hawkGame(), TAKE);
    const captive = mustPlayer(taken, p1).hand.find((id) => taken.instances[id]?.cardId === CAPTIVE_ALLY.id)!;
    expect(mustInstance(taken, captive)).toMatchObject({ ownerId: p1, home: { kind: "player" } });
    const played = run(taken, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: captive,
      payment: [],
      attachToInstanceId: null,
    });
    expect(mustPlayer(played, p1).playArea).toContain(captive);
  });
});

// ---- §3.11 -------------------------------------------------------------------------------------------------------

describe("§3.11 new trigger events and rules (docs/phase7-wave2.md §3.11)", () => {
  const counter = (type: string): EffectSpec => ({
    kind: "addCounters",
    target: { kind: "identityOf", player: { kind: "controller" } },
    counterType: type,
    amount: { kind: "const", value: 1 },
  });
  const USED = stubAbility("used.response", {
    trigger: { kind: "response", forced: true, on: { on: "basicPowerUsed", playerIs: "controller" } },
    effects: [counter("used")],
  });
  const MIMIC = stubAbility("mimic.constant", {
    trigger: { kind: "constant", traitGrants: [{ traitsOf: { categories: ["environment"] }, target: { self: true } }] },
    effects: [],
  });
  const FROZEN = stubAbility("frozen.interrupt", {
    trigger: { kind: "interrupt", forced: true, on: { on: "cardReadying", targetIs: { categories: ["ally"] } } },
    effects: [{ kind: "replaceTriggeringEvent", with: [counter("frozen")] }],
  });
  const tools = [USED.ref, MIMIC.ref, FROZEN.ref];
  const PIETRO = stubIdentity({
    id: "pietro",
    hp: 30,
    atk: 3,
    thw: 1,
    def: 1,
    rec: 1,
    heroHandSize: 5,
    alterEgoHandSize: 5,
    heroAbilities: tools,
    alterEgoAbilities: tools,
  });
  const ASSAULT_SCHEME = { ...stubSideScheme({ id: "assaulted", startingThreat: 5, keywords: [{ name: "assault" }] }) };
  const RED_HOUSE = stubSideScheme({
    id: "red-house",
    startingThreat: 5,
    abilities: [
      ability("red-house.constant", { kind: "constant", rules: [{ kind: "thwartWithAtk", scheme: { self: true } }] }),
    ],
  });
  const PORTAL = stubSideScheme({
    id: "portal",
    startingThreat: 1,
    abilities: [
      ability("portal.constant", {
        kind: "constant",
        rules: [{ kind: "defeatedIntoEncounterDeck", target: { self: true } }],
      }),
    ],
  });
  const LAB = stubEnvironment({ id: "lab", traits: [trait("Laboratory")] });
  const DEPOWER = stubSupport({
    id: "depower",
    cost: 0,
    abilities: [
      ability("depower.constant", {
        kind: "constant",
        rules: [{ kind: "cannotPlay", player: { kind: "controller" }, cards: { categories: ["ally"] } }],
      }),
    ],
  });
  const LOCKED = stubSupport({
    id: "locked",
    cost: 0,
    abilities: [
      ability("locked.constant", { kind: "constant", rules: [{ kind: "cannotTriggerActions", on: { self: true } }] }),
      ability("locked.action", { kind: "action" }, [counter("locked")]),
    ],
  });
  const HELPER = stubAlly({ id: "helper", cost: 0, atk: 1, thw: 1, hp: 3 });
  const ruleDeps = depsOf(USED, MIMIC, FROZEN, ...abilities);
  const encounter = [ASSAULT_SCHEME, RED_HOUSE, PORTAL, LAB];

  /** Pietro in hero form with the given encounter cards in play (test surgery out of the encounter deck). */
  function ruleGame(inPlay: readonly AnyCard[]): GameState {
    const start = newGame({
      identity: PIETRO,
      deps: ruleDeps,
      extraCards: [...encounter, DEPOWER, LOCKED, HELPER],
      encounterDeck: [...encounter.map((c) => c.id), ...copies(TREACHERY.id, 10)],
      deck: [...DEFAULT_DECK, DEPOWER.id, LOCKED.id, HELPER.id, HELPER.id],
    });
    const hero = applyCommand(start, { type: "changeForm", playerId: p1 }, ruleDeps);
    if (!hero.ok) throw new Error(hero.error.message);
    let state = settle(hero.state, defaultPick, ruleDeps);
    const [deckId] = state.encounterDeckOrder;
    for (const card of inPlay) {
      const piles = state.encounterDecks[deckId as string]!;
      const id = piles.deck.find((candidate) => state.instances[candidate]?.cardId === card.id)!;
      const threat = card.type === "side_scheme" ? card.startingThreat.base : 0;
      state = {
        ...state,
        encounterDecks: {
          ...state.encounterDecks,
          [deckId as string]: { ...piles, deck: piles.deck.filter((x) => x !== id) },
        },
        villainArea: [...state.villainArea, id],
        instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, threat } },
      };
    }
    return state;
  }
  const idOf = (state: GameState, card: AnyCard): InstanceId =>
    Object.values(state.instances).find((i) => i.cardId === card.id && state.villainArea.includes(i.instanceId))!
      .instanceId;
  const hero = (state: GameState) => state.players[0]!.identity.instanceId;
  const run = (state: GameState, command: Command) => {
    const result = applyCommand(state, command, ruleDeps);
    return result.ok ? { ok: true as const, state: settle(result.state, defaultPick, ruleDeps) } : result;
  };

  it("'after you use a basic power' follows a basic thwart, and the Assault keyword thwarts with ATK (RRG 1.8 'Assault', p. 8)", () => {
    const state = ruleGame([ASSAULT_SCHEME]);
    const scheme = idOf(state, ASSAULT_SCHEME);
    const done = run(state, {
      type: "basicThwart",
      playerId: p1,
      thwarterInstanceId: hero(state),
      schemeInstanceId: scheme,
    });
    if (!done.ok) throw new Error(done.error.message);
    expect(mustInstance(done.state, scheme).threat).toBe(2);
    expect(mustInstance(done.state, hero(done.state)).counters).toEqual({ used: 1 });
  });

  it("a confused thwart is not a basic power used (FAQ 'Quicksilver (#1A)', p. 61)", () => {
    const start = ruleGame([ASSAULT_SCHEME]);
    const id = hero(start);
    const confused: GameState = {
      ...start,
      instances: {
        ...start.instances,
        [id]: { ...mustInstance(start, id), statuses: { stunned: 0, confused: 1, tough: 0 } },
      },
    };
    const done = run(confused, {
      type: "basicThwart",
      playerId: p1,
      thwarterInstanceId: id,
      schemeInstanceId: idOf(confused, ASSAULT_SCHEME),
    });
    expect(done.ok && mustInstance(done.state, id).counters).toEqual({});
  });

  it("'they may use their ATK instead of their THW' is the player's choice; without the rule it is refused", () => {
    const state = ruleGame([RED_HOUSE, PORTAL]);
    const house = idOf(state, RED_HOUSE);
    const withAtk = run(state, {
      type: "basicThwart",
      playerId: p1,
      thwarterInstanceId: hero(state),
      schemeInstanceId: house,
      useAtk: true,
    });
    expect(withAtk.ok && mustInstance(withAtk.state, house).threat).toBe(2);
    const refused = run(state, {
      type: "basicThwart",
      playerId: p1,
      thwarterInstanceId: hero(state),
      schemeInstanceId: idOf(state, PORTAL),
      useAtk: true,
    });
    expect(refused.ok ? null : refused.error.message).toBe("this thwart cannot use ATK");
  });

  it("a defeated side scheme with the rule is shuffled into the encounter deck instead of discarded (Time Portal)", () => {
    const state = ruleGame([PORTAL]);
    const portal = idOf(state, PORTAL);
    const done = run(state, {
      type: "basicThwart",
      playerId: p1,
      thwarterInstanceId: hero(state),
      schemeInstanceId: portal,
    });
    if (!done.ok) throw new Error(done.error.message);
    const piles = done.state.encounterDecks[done.state.encounterDeckOrder[0] as string]!;
    expect(piles.deck).toContain(portal);
    expect(piles.discard).not.toContain(portal);
  });

  it("gaining the traits of each environment in play (Absorbing Man)", () => {
    const state = ruleGame([LAB]);
    expect(traitsOf(state, hero(state), ruleDeps)).toContain(trait("Laboratory"));
    expect(traitsOf(ruleGame([]), hero(ruleGame([])), ruleDeps)).not.toContain(trait("Laboratory"));
  });

  it("'You cannot play …' and 'cannot trigger … Action abilities' block the play and the action", () => {
    let state = ruleGame([]);
    const depower = giveCard(state, p1, DEPOWER.id);
    const played = run(depower.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: depower.id,
      payment: [],
      attachToInstanceId: null,
    });
    if (!played.ok) throw new Error(played.error.message);
    state = played.state;
    const helper = giveCard(state, p1, HELPER.id);
    const blocked = run(helper.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: helper.id,
      payment: [],
      attachToInstanceId: null,
    });
    expect(blocked.ok ? null : blocked.error.message).toBe("you cannot play that card right now");
    const locked = giveCard(ruleGame([]), p1, LOCKED.id);
    const lockedIn = run(locked.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: locked.id,
      payment: [],
      attachToInstanceId: null,
    });
    if (!lockedIn.ok) throw new Error(lockedIn.error.message);
    const tried = run(lockedIn.state, {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: locked.id,
      abilityId: "locked.action" as never,
      payment: [],
    });
    expect(tried.ok ? null : tried.error.message).toBe("that ability cannot be triggered right now");
  });

  it("'When attached character would ready, … instead' replaces the ready (Frozen in Time)", () => {
    const helper = giveCard(ruleGame([]), p1, HELPER.id);
    const played = run(helper.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: helper.id,
      payment: [],
      attachToInstanceId: null,
    });
    if (!played.ok) throw new Error(played.error.message);
    const exhausted: GameState = {
      ...played.state,
      instances: {
        ...played.state.instances,
        [helper.id]: { ...mustInstance(played.state, helper.id), exhausted: true },
      },
    };
    const ended = run(exhausted, { type: "endTurn", playerId: p1 });
    if (!ended.ok) throw new Error(ended.error.message);
    expect(mustInstance(ended.state, helper.id).exhausted).toBe(true);
    expect(mustInstance(ended.state, hero(ended.state)).counters.frozen).toBeGreaterThanOrEqual(1);
  });
});

// ---- §3.12 -------------------------------------------------------------------------------------------------------

describe("§3.12 selection vocabulary (docs/phase7-wave2.md §3.12)", () => {
  it("'1 random set-aside Captive ally' picks one of the matching set-aside cards from the seeded RNG", () => {
    const A = { ...stubAlly({ id: "captive-a", cost: 0, atk: 1, thw: 1, hp: 3 }), traits: [trait("Captive")] };
    const B = { ...stubAlly({ id: "captive-b", cost: 0, atk: 1, thw: 1, hp: 3 }), traits: [trait("Captive")] };
    const pick = (seed: number) => {
      const result = createGame({
        seed,
        cards: [...DEFAULT_CARDS, A, B],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: MAIN_SCHEME.id,
        encounterDeck: copies(TREACHERY.id, 5),
        setAside: [A.id, B.id],
        includeIdentitySets: false,
        players: [{ identityCardId: DEFAULT_CARDS[0]!.id, deck: DEFAULT_DECK }],
      });
      if (!result.ok) throw new Error(result.error.message);
      const ctx = createCtx(result.state, { abilities: {} });
      const context = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps: { abilities: {} } };
      const picked = selectCards(
        ctx,
        { kind: "encounterSetAside", filter: { trait: trait("Captive") }, random: { kind: "const", value: 1 } },
        context,
      );
      return { picked, rngMoved: ctx.state.rng !== result.state.rng };
    };
    const first = pick(1);
    expect(first.picked).toHaveLength(1);
    expect(first.rngMoved).toBe(true);
    expect(pick(1).picked).toEqual(first.picked);
  });
});
