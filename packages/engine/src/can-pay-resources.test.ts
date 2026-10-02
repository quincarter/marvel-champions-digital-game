/**
 * The `canPayResources` predicate (`canPaySpend`): whether a player could pay a `spendResources` effect now, priced as
 * the spend prices it. Its use: Director's Directions (`mojo` 39033), "When Revealed: Choose one: • Spend 2 different
 * resources. • …", offers the spend only to a player who can pay it (docs/phase7-wave6.md §3.69, pending default Q51).
 *
 * Sources: RRG 1.8 "Choose (Option)" (p. 12): a player card's option with "a cost the player cannot pay" cannot be
 * chosen (an encounter card's rule names only options without targets; Q51 extends the gate to this spend). "Wild
 * Resource" (p. 48): a wild is used as any one type. "Cost" (p. 13): overpaying is legal.
 */
import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { canPaySpend } from "./payable.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { ResourceRequirement } from "./resources.js";
import { evaluate, type EffectContext } from "./select.js";
import type { Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubResource, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCards } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;

const PHYS = stubResource({ id: "phys", icons: 0, produces: { physical: 1 } });
const MENT = stubResource({ id: "ment", icons: 0, produces: { mental: 1 } });
const WILD = stubResource({ id: "wild", icons: 1 });
const DOUBLE_PHYS = stubResource({ id: "double-phys", icons: 0, produces: { physical: 2 } });
const PHYS_MENT = stubResource({ id: "phys-ment", icons: 0, produces: { physical: 1, mental: 1 } });

/** "Resource: Exhaust this card → generate an [energy] resource." */
const GENERATOR_RESOURCE = stubAbility(
  "generator.resource",
  def({ trigger: { kind: "resource" }, cost: { exhaustSelf: true }, generates: { energy: 1 }, effects: [] }),
);
const GENERATOR = stubSupport({ id: "generator", cost: 0, abilities: [GENERATOR_RESOURCE.ref] });

/**
 * "Resource: Exhaust an upgrade you control → generate a [mental] resource. (Limit once per round.)" With two ready
 * upgrades the spend offers one option per pick, and the two cannot be spent together (the limit).
 */
const RELAY_RESOURCE = stubAbility(
  "relay.resource",
  def({
    trigger: { kind: "resource" },
    cost: { exhaustCards: { slot: "exhausted", query: { categories: ["upgrade"] }, min: 1, max: 1 } },
    limit: { count: 1, period: "round" },
    generates: { mental: 1 },
    effects: [],
  }),
);
const RELAY = stubSupport({ id: "relay", cost: 0, abilities: [RELAY_RESOURCE.ref] });
const GIZMO = stubUpgrade({ id: "gizmo", cost: 0 });

const SPEND_TWO_DIFFERENT: Predicate = {
  kind: "canPayResources",
  player: { kind: "controller" },
  resources: { generic: 2 },
  distinctTypes: 2,
};

/** "Choose one: • Spend 2 different resources. • Draw 1 card." on a 0-cost event, the spend gated by the predicate. */
const DIRECTIONS_ACTION = stubAbility(
  "directions.action",
  def({
    trigger: { kind: "action" },
    effects: [
      {
        kind: "chooseOne",
        chooser: { kind: "controller" },
        options: [
          {
            label: "Spend 2 different resources",
            condition: SPEND_TWO_DIFFERENT,
            effects: [
              {
                kind: "spendResources",
                player: { kind: "controller" },
                resources: { generic: 2 },
                bind: "spent",
                distinctTypes: 2,
              },
            ],
          },
          {
            label: "Draw 1 card",
            effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
          },
        ],
      },
    ],
  }),
);
const DIRECTIONS = stubEvent({ id: "directions", cost: 0, abilities: [DIRECTIONS_ACTION.ref] });

const CARDS = [PHYS, MENT, WILD, DOUBLE_PHYS, PHYS_MENT, GENERATOR, RELAY, GIZMO, DIRECTIONS];
const deps = depsOf(GENERATOR_RESOURCE, RELAY_RESOURCE, DIRECTIONS_ACTION);
const DECK: readonly CardId[] = CARDS.flatMap((card) => [card.id, card.id, card.id]);

const start = (players: 1 | 2 = 1): GameState => gameAtFirstTurn({ cards: CARDS, deps, players, deck: DECK });

/** `player`'s hand is exactly these cards (the rest go to the bottom of their deck): test surgery. */
function withHand(state: GameState, cards: readonly string[], player: PlayerId = P1): GameState {
  const given = giveCards(state, player, ...cards);
  return {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            hand: [...given.ids],
            deck: [...p.deck, ...p.hand.filter((id) => !given.ids.includes(id))],
          }
        : p,
    ),
  };
}
const canPay = (state: GameState, resources: ResourceRequirement, distinctTypes = 0, player: PlayerId = P1) =>
  canPaySpend(state, deps, player, resources, distinctTypes);
const twoDifferent = (state: GameState, player: PlayerId = P1) => canPay(state, { generic: 2 }, 2, player);

describe("canPaySpend: 'spend 2 different resources' (generic 2, two types)", () => {
  it("an empty hand and nothing in play cannot pay", () => {
    expect(twoDifferent(withHand(start(), []))).toBe(false);
  });

  it("exactly payable: a physical and a mental card", () => {
    expect(twoDifferent(withHand(start(), [PHYS.id, MENT.id]))).toBe(true);
  });

  it("one short: a single physical card", () => {
    expect(twoDifferent(withHand(start(), [PHYS.id]))).toBe(false);
  });

  it("two resources of one type are not two different resources", () => {
    expect(twoDifferent(withHand(start(), [PHYS.id, PHYS.id]))).toBe(false);
    // A double-physical card is two resources of one type too, but pays a plain "spend 2 resources".
    const doubled = withHand(start(), [DOUBLE_PHYS.id]);
    expect(twoDifferent(doubled)).toBe(false);
    expect(canPay(doubled, { generic: 2 })).toBe(true);
  });

  it("a double-resource card of two types pays it alone", () => {
    expect(twoDifferent(withHand(start(), [PHYS_MENT.id]))).toBe(true);
  });

  it("wilds: a wild is any type not otherwise present (RRG 1.8 p. 48), but one wild is one resource", () => {
    expect(twoDifferent(withHand(start(), [WILD.id, PHYS.id]))).toBe(true);
    expect(twoDifferent(withHand(start(), [WILD.id, WILD.id]))).toBe(true);
    expect(twoDifferent(withHand(start(), [WILD.id]))).toBe(false);
    expect(canPay(withHand(start(), [WILD.id]), { mental: 1 })).toBe(true);
    expect(canPay(withHand(start(), [PHYS.id]), { mental: 1 })).toBe(false);
  });

  it("a resource generator in play counts, while it is ready", () => {
    const hand = withHand(start(), [PHYS.id]);
    const generator = playerCardIntoPlay(hand, GENERATOR.id);
    expect(twoDifferent(generator.state)).toBe(true);
    const tired = {
      ...generator.state,
      instances: {
        ...generator.state.instances,
        [generator.id]: { ...mustInstance(generator.state, generator.id), exhausted: true },
      },
    };
    expect(twoDifferent(tired)).toBe(false);
  });

  it("options that cannot be spent together are tried apart: one use of a limited generator still pays", () => {
    const hand = withHand(start(), [PHYS.id]);
    const relay = playerCardIntoPlay(hand, RELAY.id);
    const first = playerCardIntoPlay(relay.state, GIZMO.id);
    const second = playerCardIntoPlay(first.state, GIZMO.id);
    expect(twoDifferent(second.state)).toBe(true);
    // Without the physical card, the relay's one use is one resource.
    expect(twoDifferent(withHand(second.state, []))).toBe(false);
  });

  it("only the choosing player's own hand counts: another player's cards are not theirs to spend", () => {
    const state = withHand(withHand(start(2), [PHYS.id]), [MENT.id, WILD.id], P2);
    expect(twoDifferent(state, P1)).toBe(false);
    expect(twoDifferent(state, P2)).toBe(true);
  });

  it("asking for nothing is always payable", () => {
    expect(canPay(withHand(start(), []), {})).toBe(true);
  });
});

describe("the canPayResources predicate gates a 'Choose one' option", () => {
  const context: EffectContext = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };

  it("reads the player its PlayerRef names", () => {
    const payable = withHand(start(), [PHYS.id, MENT.id]);
    expect(evaluate(payable, SPEND_TWO_DIFFERENT, context)).toBe(true);
    const short = withHand(start(), [PHYS.id]);
    expect(evaluate(short, SPEND_TWO_DIFFERENT, context)).toBe(false);
  });

  /** Plays Directions from P1's hand (the other cards in it are the payment options); returns the options offered. */
  function playDirections(hand: readonly string[]): { offered: readonly string[]; state: GameState } {
    const staged = withHand(start(), [DIRECTIONS.id, ...hand]);
    const event = mustPlayer(staged, P1).hand[0] as InstanceId;
    let offered: readonly string[] = [];
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseOption") {
        offered = choice.options.map((o) => o.label);
        return [choice.options.find((o) => o.label === "Spend 2 different resources")!.optionId];
      }
      if (choice?.prompt.kind === "spendResources") return choice.options.map((o) => o.optionId);
      return defaultPick(state);
    };
    const driven = driveSession(
      startSession(staged),
      deps,
      [{ type: "playCard", playerId: P1, cardInstanceId: event, payment: [], attachToInstanceId: null }],
      pick,
    );
    return { offered, state: driven.session.state };
  }

  it("offered, chosen and paid by a player who can pay it", () => {
    const { offered, state } = playDirections([PHYS.id, MENT.id]);
    expect(offered).toEqual(["Spend 2 different resources", "Draw 1 card"]);
    expect(mustPlayer(state, P1).hand).toEqual([]);
  });

  it("not offered to a player who cannot: the other option resolves with no choice", () => {
    const { offered, state } = playDirections([PHYS.id, PHYS.id]);
    expect(offered).toEqual([]);
    // Drew 1 card; both physical cards are still in hand.
    expect(mustPlayer(state, P1).hand).toHaveLength(3);
  });
});
