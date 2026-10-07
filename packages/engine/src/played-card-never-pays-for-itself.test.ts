/**
 * A card being played does not pay for itself. RRG 1.8 "Cost" (p. 13): a card's cost is paid by spending resources
 * "from other cards"; the card stays in hand until its cost is paid and is never one of its own payers
 * (`paymentOptions`' `excludeInstanceId`, `priceOf`).
 *
 * Pinned for every way a card is played and paid for: a play an effect makes in the villain phase (`playFromHand`
 * with `ignoreActionTiming`, the shape of Warpath `angel` 42013), a play an effect makes on the player's own turn (the
 * shape of Team-Building Exercise), and an ordinary `playCard`. Candidates are hand cards by instance, so a second copy
 * of the card being played is a payer like any other (docs/phase7-wave7-qa-screens.md, item E).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession, type GameSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSupport } from "./testing/fixtures.js";
import { defaultPick, RESOURCE } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const playAnEvent = (ignoreActionTiming: boolean): EffectSpec => ({
  kind: "playFromHand",
  player: you,
  costReduction: { kind: "const", value: 0 },
  filter: { categories: ["event"] },
  ...(ignoreActionTiming ? { ignoreActionTiming: true as const } : {}),
});
/** "Response: After this defends against an attack, play an event from your hand (paying its cost)." */
const GUARDIAN_RESPONSE = stubAbility("pays-guardian.response", {
  trigger: { kind: "response", forced: false, on: { on: "defended", targetIs: { self: true } } },
  effects: [playAnEvent(true)],
} satisfies AbilityDefinition);
const GUARDIAN = stubAlly({ id: "pays-guardian", cost: 0, atk: 1, thw: 1, hp: 9, abilities: [GUARDIAN_RESPONSE.ref] });
/** "Action: Play an event from your hand (paying its cost)." */
const DRILL_ACTION = stubAbility("pays-drill.action", { trigger: { kind: "action" }, effects: [playAnEvent(false)] });
const DRILL = stubSupport({ id: "pays-drill", cost: 0, abilities: [DRILL_ACTION.ref] });
/** "Hero Action: Deal 2 damage to the villain." Cost 2, and worth one resource as a payer. */
const STRIKE_ACTION = stubAbility("pays-strike.action", {
  trigger: { kind: "action", form: "hero" },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 2 } }],
});
const STRIKE = stubEvent({ id: "pays-strike", cost: 2, resources: 1, abilities: [STRIKE_ACTION.ref] });

const deps: EngineDeps = depsOf(GUARDIAN_RESPONSE, DRILL_ACTION, STRIKE_ACTION);

interface Table {
  readonly state: GameState;
  readonly guardian: InstanceId;
  readonly drill: InstanceId;
  /** The hand, in order: the Strikes first, then the resource cards. */
  readonly strikes: readonly InstanceId[];
  readonly resources: readonly InstanceId[];
}

/** p1 in hero form with both cards in play, holding exactly `strikes` Strikes and `resources` resource cards. */
function table(strikes: number, resources: number): Table {
  const start = gameAtFirstTurn({
    deps,
    cards: [GUARDIAN, DRILL, STRIKE],
    deck: [GUARDIAN.id, DRILL.id, STRIKE.id, STRIKE.id, STRIKE.id],
  });
  const guardian = playerCardIntoPlay(start, GUARDIAN.id);
  const drill = playerCardIntoPlay(guardian.state, DRILL.id);
  const state = drill.state;
  const seat = mustPlayer(state, P1);
  const pool = [...seat.hand, ...seat.deck];
  const of = (card: string) => pool.filter((id) => state.instances[id]?.cardId === card);
  const strikeIds = of(STRIKE.id).slice(0, strikes);
  const resourceIds = of(RESOURCE.id).slice(0, resources);
  if (strikeIds.length < strikes || resourceIds.length < resources) throw new Error("not enough cards to hand out");
  const hand = [...strikeIds, ...resourceIds];
  // Every other Strike leaves the deck, so none is drawn at the end of the player phase.
  const spare = of(STRIKE.id).filter((id) => !hand.includes(id));
  return {
    guardian: guardian.id,
    drill: drill.id,
    strikes: strikeIds,
    resources: resourceIds,
    state: {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        identity: { ...p.identity, form: "hero" as const },
        hand,
        deck: pool.filter((id) => !hand.includes(id) && !spare.includes(id)),
        discard: [...p.discard, ...spare],
      })),
    },
  };
}

interface Seen {
  /** The cards offered to play. */
  readonly offered: readonly (readonly string[])[];
  /** Each payment prompt: its options, and the hand as it stood. */
  readonly spend: readonly { readonly options: readonly string[]; readonly hand: readonly InstanceId[] }[];
  readonly session: GameSession;
  readonly state: GameState;
}

/** Drives `command`; the effect's play picks `playing`, and its payment is `paying` (hand cards). */
function drive(t: Table, command: Command, playing: InstanceId, paying: readonly InstanceId[]): Seen {
  const offered: string[][] = [];
  const spend: { options: readonly string[]; hand: readonly InstanceId[] }[] = [];
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const prompt = choice.prompt;
    if (prompt.kind === "declareDefender") return [t.guardian];
    if (prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
    if (prompt.kind === "chooseCards" && prompt.slot === "playFromHand") {
      offered.push(choice.options.map((o) => o.optionId));
      return [playing];
    }
    if (prompt.kind === "spendResources") {
      spend.push({ options: choice.options.map((o) => o.optionId), hand: mustPlayer(state, P1).hand });
      return paying.map((id) => `hand:${id}`);
    }
    return defaultPick(state);
  };
  const { session } = driveSession(startSession(t.state), deps, [command], pick);
  return { offered, spend, session, state: session.state };
}

const hand = (state: GameState): readonly InstanceId[] => mustPlayer(state, P1).hand;
const discard = (state: GameState): readonly InstanceId[] => mustPlayer(state, P1).discard;
const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;
const handOptions = (ids: readonly InstanceId[]): string[] => ids.map((id) => `hand:${id}`);
const endTurn: Command = { type: "endTurn", playerId: P1 };
const useDrill = (t: Table): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: t.drill,
  abilityId: DRILL_ACTION.ref.id,
  payment: [],
});

describe("the card being played is never among its own payment candidates (RRG 1.8 'Cost', p. 13)", () => {
  it("a play an effect makes in the villain phase: every other hand card is offered, the played one is not", () => {
    const t = table(1, 3);
    const [strike] = t.strikes as [InstanceId];
    const [r1, r2, r3] = t.resources as [InstanceId, InstanceId, InstanceId];
    const run = drive(t, endTurn, strike, [r1, r3]);
    expect(run.offered).toEqual([[strike]]);
    expect(run.spend).toHaveLength(1);
    // Still in hand while its cost is paid, and not a payer.
    expect(run.spend[0]!.hand).toContain(strike);
    expect(run.spend[0]!.options).not.toContain(`hand:${strike}`);
    expect(run.spend[0]!.options).toEqual(handOptions(run.spend[0]!.hand.filter((id) => id !== strike)));
    // Exactly the two cards paid and the event left the hand.
    expect(hand(run.state)).toEqual(run.spend[0]!.hand.filter((id) => ![strike, r1, r3].includes(id)));
    expect(hand(run.state)).toContain(r2);
    expect(discard(run.state)).toEqual(expect.arrayContaining([strike, r1, r3]));
    expect(villainDamage(run.state)).toBe(2);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });

  it("a second copy of the played card is a payer like any other: candidates are instances, not names", () => {
    const t = table(2, 1);
    const [first, second] = t.strikes as [InstanceId, InstanceId];
    const [resource] = t.resources as [InstanceId];
    const run = drive(t, endTurn, second, [first, resource]);
    expect(run.spend).toHaveLength(1);
    expect(run.spend[0]!.options).toContain(`hand:${first}`);
    expect(run.spend[0]!.options).not.toContain(`hand:${second}`);
    expect(discard(run.state)).toEqual(expect.arrayContaining([first, second, resource]));
    expect(hand(run.state)).not.toContain(first);
    expect(villainDamage(run.state)).toBe(2);
  });

  it("a play an effect makes on the player's own turn: the same", () => {
    const t = table(1, 3);
    const [strike] = t.strikes as [InstanceId];
    const [r1, r2, r3] = t.resources as [InstanceId, InstanceId, InstanceId];
    const use = useDrill(t);
    const run = drive(t, use, strike, [r2, r3]);
    expect(run.offered).toEqual([[strike]]);
    expect(run.spend).toHaveLength(1);
    expect(run.spend[0]!.options).toEqual(handOptions([r1, r2, r3]));
    expect(hand(run.state)).toEqual([r1]);
    expect(discard(run.state)).toEqual(expect.arrayContaining([strike, r2, r3]));
    expect(villainDamage(run.state)).toBe(2);
  });

  it("a payment answer that names the played card is refused", () => {
    const t = table(1, 3);
    const [strike] = t.strikes as [InstanceId];
    const [r1] = t.resources as [InstanceId];
    // Stop at the payment prompt: drive the turn's action by hand.
    let state = t.state;
    const apply = (command: Command) => {
      const result = applyCommand(state, command, deps);
      if (!result.ok) throw new Error(result.error.message);
      state = result.state;
    };
    apply(useDrill(t));
    for (let guard = 0; state.pendingChoice && state.pendingChoice.prompt.kind !== "spendResources"; guard++) {
      if (guard > 20) throw new Error("no payment prompt");
      const choice = state.pendingChoice;
      const selected = choice.prompt.kind === "chooseCards" ? [strike] : defaultPick(state);
      apply({ type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: selected });
    }
    const choice = state.pendingChoice!;
    expect(choice.prompt.kind).toBe("spendResources");
    const refused = applyCommand(
      state,
      {
        type: "resolveChoice",
        playerId: P1,
        choiceId: choice.choiceId,
        selectedOptionIds: [`hand:${strike}`, `hand:${r1}`],
      },
      deps,
    );
    expect(refused.ok).toBe(false);
  });

  it("a hand holding only that card cannot pay a cost above zero: no effect offers it, in either phase", () => {
    const t = table(1, 0);
    const [strike] = t.strikes as [InstanceId];
    const use = useDrill(t);
    const turn = drive(t, use, strike, []);
    expect(turn.offered).toEqual([]);
    expect(turn.spend).toEqual([]);
    expect(hand(turn.state)).toEqual([strike]);
    expect(villainDamage(turn.state)).toBe(0);
    // The villain phase: with no deck and no discard pile nothing is drawn at the end of the player phase.
    const alone: Table = {
      ...t,
      state: { ...t.state, players: t.state.players.map((p) => ({ ...p, deck: [], discard: [] })) },
    };
    const villain = drive(alone, endTurn, strike, []);
    expect(villain.offered).toEqual([]);
    expect(villain.spend).toEqual([]);
    expect(hand(villain.state)).toEqual([strike]);
    expect(villainDamage(villain.state)).toBe(0);
  });

  it("an ordinary play: the card is not legal with only itself in hand, and a payment naming it is rejected", () => {
    const alone = table(1, 0);
    const [strike] = alone.strikes as [InstanceId];
    const legal = legalActions(alone.state, P1, deps);
    if (legal.kind !== "turn") throw new Error("not a turn");
    expect(legal.legal.some((entry) => entry.action.kind === "playCard" && entry.action.instanceId === strike)).toBe(
      false,
    );
    const play = (state: GameState, payment: readonly InstanceId[]) =>
      applyCommand(
        state,
        {
          type: "playCard",
          playerId: P1,
          cardInstanceId: strike,
          payment: payment.map((id) => ({ fromHand: id })),
          attachToInstanceId: null,
        },
        deps,
      );
    expect(play(alone.state, [strike]).ok).toBe(false);

    const t = table(1, 3);
    const [card] = t.strikes as [InstanceId];
    const [r1, r2, r3] = t.resources as [InstanceId, InstanceId, InstanceId];
    expect(card).toBe(strike);
    const entry = legalActions(t.state, P1, deps);
    if (entry.kind !== "turn") throw new Error("not a turn");
    const offer = entry.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId === strike);
    expect(offer).toBeDefined();
    // The engine's own example payment for it never names the card.
    if (offer?.example.type !== "playCard") throw new Error("no example play");
    expect(offer.example.payment).not.toContainEqual({ fromHand: strike });
    // Itself plus one resource does not pay 2; two resources do, and leave exactly the third.
    expect(play(t.state, [strike, r1]).ok).toBe(false);
    const paid = play(t.state, [r1, r2]);
    if (!paid.ok) throw new Error(paid.error.message);
    expect(hand(paid.state)).toEqual([r3]);
    expect(discard(paid.state)).toEqual(expect.arrayContaining([strike, r1, r2]));
    expect(villainDamage(paid.state)).toBe(2);
  });
});
