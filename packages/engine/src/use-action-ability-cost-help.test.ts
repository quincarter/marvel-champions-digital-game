/**
 * `EffectSpec useActionAbility` (#890 item 6) on a card whose costs any player may help pay (`RuleSpec
 * costsPayableByAnyPlayer`, docs/phase7-wave10-hero-packs.md H3.19), PR #903 review 7: the effect offers an Action
 * exactly when a regular use could be made (`abilityUsableAsTheirMoment`), and a regular use may hand a delegable part
 * of the cost to a teammate (`CostSelection.paidBy`) and discard a teammate's hand card. So the effect does both: it
 * asks who pays each delegable part (no question when one player can), and offers the other players' hand cards for a
 * hand discard.
 *
 * Two players; P1 plays an event "Action: use an Action ability of a card you control" on their own turn.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubResource, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const counter = (type: string) =>
  ({ kind: "addCounters", target: { kind: "self" }, counterType: type, amount: { kind: "const", value: 1 } }) as const;
const action = (id: string, cost: AbilityCost) =>
  stubAbility(`shared.${id}`, {
    trigger: { kind: "action" },
    cost,
    effects: [counter(id)],
  } satisfies AbilityDefinition);

/** "Action: use an Action ability of a card you control" (War Machine Armor's effect, played as an event). */
const TACTICS_ACTION = stubAbility("tactics.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "useActionAbility", player: { kind: "controller" } }],
} satisfies AbilityDefinition);
const TACTICS = stubEvent({ id: "tactics", cost: 0, abilities: [TACTICS_ACTION.ref] });

/** "While paying costs on this card, any player may help pay those costs." */
const SHARED_RULE = stubAbility("shared.constant", {
  trigger: { kind: "constant", rules: [{ kind: "costsPayableByAnyPlayer", card: { self: true } }] },
  effects: [],
} satisfies AbilityDefinition);
const PAIN = action("pain", { damageSelf: 2 });
const DIG = action("dig", { discardFromDeck: 1 });
const TOSS = action("toss", { discardFromHand: { min: 1, max: 1 } });
const SHARED = stubSupport({ id: "shared", cost: 0, abilities: [SHARED_RULE.ref, PAIN.ref, DIG.ref, TOSS.ref] });
const PLAIN = stubResource({ id: "plain", icons: 1 });

const CARDS = [TACTICS, SHARED, PLAIN];
const deps: EngineDeps = depsOf(TACTICS_ACTION, SHARED_RULE, PAIN, DIG, TOSS);
const DECK: readonly CardId[] = [TACTICS.id, SHARED.id, ...Array.from({ length: 6 }, () => PLAIN.id)];

/** Two players in hero form, P1 with the shared support in play and the event in hand. */
function start(): { state: GameState; shared: InstanceId; tactics: InstanceId } {
  const base = gameAtFirstTurn({ cards: CARDS, deps, players: 2, deck: DECK });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const placed = playerCardIntoPlay(heroes, SHARED.id, P1);
  const given = mustPlayer(placed.state, P1).hand.find(
    (id) => (mustInstance(placed.state, id).cardId as string) === TACTICS.id,
  );
  if (given) return { state: placed.state, shared: placed.id, tactics: given };
  const drawn = giveCard(placed.state, P1, TACTICS.id);
  return { state: drawn.state, shared: placed.id, tactics: drawn.id };
}

const surgery = (
  state: GameState,
  player: PlayerId,
  change: (p: GameState["players"][number]) => object,
): GameState => ({
  ...state,
  players: state.players.map((p) => (p.playerId === player ? { ...p, ...change(p) } : p)),
});
const identityOf = (state: GameState, player: PlayerId) =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId);

/** P1 plays the event, picks the shared card's `ability`, and answers the rest with `answer` (by prompt kind). */
function play(
  state: GameState,
  tactics: InstanceId,
  ability: string,
  answer: (kind: string, options: readonly string[]) => readonly string[] | null = () => null,
) {
  const asked: { kind: string; options: readonly string[] }[] = [];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId);
    if (choice.prompt.kind === "chooseOption" && ids.some((id) => id.includes("|"))) {
      return [ids.find((id) => id.endsWith(`|shared.${ability}`))!];
    }
    asked.push({ kind: choice.prompt.kind, options: ids });
    return answer(choice.prompt.kind, ids) ?? defaultPick(s);
  };
  const driven = driveSession(
    startSession(state),
    deps,
    [{ type: "playCard", playerId: P1, cardInstanceId: tactics, payment: [], attachToInstanceId: null }],
    pick,
  );
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, asked };
}

describe("useActionAbility on a card any player may help pay for (PR #903 review 7)", () => {
  it("'take 2 damage' only a teammate can pay: offered, the teammate takes it with no question, and it resolves", () => {
    const { state, shared, tactics } = start();
    const mine = identityOf(state, P1);
    const tough: GameState = {
      ...state,
      instances: { ...state.instances, [mine.instanceId]: { ...mine, statuses: { ...mine.statuses, tough: 1 } } },
    };
    const after = play(tough, tactics, "pain");
    expect(mustInstance(after.state, shared).counters.pain).toBe(1);
    expect(identityOf(after.state, P2).damage).toBe(2);
    expect(identityOf(after.state, P1).damage).toBe(0);
    expect(after.asked.some((q) => q.kind === "choosePlayer")).toBe(false);
  });

  it("when either player could pay, the user is asked who, and the teammate chosen pays", () => {
    const { state, shared, tactics } = start();
    const after = play(state, tactics, "pain", (kind) => (kind === "choosePlayer" ? [P2] : null));
    expect(after.asked.find((q) => q.kind === "choosePlayer")?.options).toEqual([P1, P2]);
    expect(mustInstance(after.state, shared).counters.pain).toBe(1);
    expect(identityOf(after.state, P2).damage).toBe(2);
    expect(identityOf(after.state, P1).damage).toBe(0);
  });

  it("'discard the top card of your deck' with the user's deck and discard empty: the teammate's top card goes", () => {
    const { state, shared, tactics } = start();
    const empty = surgery(state, P1, () => ({ deck: [], discard: [] }));
    const top = mustPlayer(empty, P2).deck[0]!;
    const after = play(empty, tactics, "dig");
    expect(mustInstance(after.state, shared).counters.dig).toBe(1);
    expect(mustPlayer(after.state, P2).discard).toContain(top);
  });

  it("'discard 1 card from your hand' with the user's hand empty: the teammate's hand is offered and the chosen card goes", () => {
    const { state, shared, tactics } = start();
    // P1 keeps only the event, which leaves the hand as it is played.
    const onlyEvent = surgery(state, P1, (p) => ({
      hand: [tactics],
      deck: [...p.deck, ...p.hand.filter((id) => id !== tactics)],
    }));
    const theirs = mustPlayer(onlyEvent, P2).hand;
    const chosen = theirs[theirs.length - 1]!;
    const after = play(onlyEvent, tactics, "toss", (kind) => (kind === "chooseCards" ? [chosen] : null));
    expect(after.asked.find((q) => q.kind === "chooseCards")?.options).toEqual(theirs);
    expect(mustInstance(after.state, shared).counters.toss).toBe(1);
    expect(mustPlayer(after.state, P2).discard).toContain(chosen);
    expect(mustPlayer(after.state, P2).hand).not.toContain(chosen);
  });
});
