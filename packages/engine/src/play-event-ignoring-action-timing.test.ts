/**
 * Owner ruling 2026-10-06 (docs/phase7-wave7.md §4.1, Warpath `angel` 42013: "Hero Response: After Warpath defends
 * against an attack, play an event with a 'Hero Action' ability from your hand (paying its costs)"): "His Response
 * overrides normal Hero Action timing for that event. His printed ability specifically tells you to play an event with
 * a Hero Action ability."
 *
 * As built: `EffectSpec playFromHand.ignoreActionTiming`. An effect carrying it may play an event through its Action
 * ability outside a player's turn (RRG 1.8 "Action", p. 6) and while its own ability resolves. Nothing else is lifted:
 * the Action's form, its targets, the cost and payment, and the card's play restrictions apply as on a turn. Default
 * off (docs/phase7-wave6.md §3.70, `play-from-deck.test.ts`).
 *
 * Synthetic cards: two allies with "Response: After this defends, play an event with a 'Hero Action' ability from your
 * hand", one carrying the flag and one not, and events of each timing.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { playIgnoringCostFault, playWithPaymentFault } from "./actions.js";
import { createCtx } from "./ctx.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubVillain } from "./testing/fixtures.js";
import { defaultPick, RESOURCE } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const you = { kind: "controller" } as const;
const HERO_ACTION_EVENT: TargetQuery = { categories: ["event"], abilityTiming: ["heroAction"] };

/** "Response: After this defends against an attack, play an event with a 'Hero Action' ability from your hand." */
const afterDefending = (id: string, ignoreActionTiming: boolean) =>
  stubAbility(
    id,
    def({
      trigger: { kind: "response", forced: false, on: { on: "defended", targetIs: { self: true } } },
      effects: [
        {
          kind: "playFromHand",
          player: you,
          costReduction: { kind: "const", value: 0 },
          filter: HERO_ACTION_EVENT,
          ...(ignoreActionTiming ? { ignoreActionTiming: true as const } : {}),
        },
      ],
    }),
  );
const GUARDIAN_RESPONSE = afterDefending("guardian.response", true);
const USHER_RESPONSE = afterDefending("usher.response", false);
const GUARDIAN = stubAlly({ id: "guardian", cost: 0, atk: 1, thw: 1, hp: 9, abilities: [GUARDIAN_RESPONSE.ref] });
const USHER = stubAlly({ id: "usher", cost: 0, atk: 1, thw: 1, hp: 9, abilities: [USHER_RESPONSE.ref] });

const hitVillain = (amount: number): EffectSpec => ({
  kind: "dealDamage",
  target: { kind: "villain" },
  amount: { kind: "const", value: amount },
});
const event = (id: string, cost: number, ...abilities: readonly AbilityDefinition[]) => {
  const stubs = abilities.map((definition, index) => stubAbility(`${id}.ability-${index}`, definition));
  return { card: stubEvent({ id, cost, abilities: stubs.map((s) => s.ref) }), stubs };
};
const heroAction = (...effects: readonly EffectSpec[]): AbilityDefinition => ({
  trigger: { kind: "action", form: "hero" },
  effects,
});
/** "Hero Action: Deal 2 damage to the villain." Cost 2. */
const STRIKE = event("strike", 2, heroAction(hitVillain(2)));
/** Cost 9: more than a hand can pay. */
const COSTLY = event("costly", 9, heroAction(hitVillain(9)));
/** A plain "Action": not a "Hero Action" event. */
const PLAIN = event("plain", 0, { trigger: { kind: "action" }, effects: [hitVillain(1)] });
/** "Alter-Ego Action". */
const REST = event("rest", 0, { trigger: { kind: "action", form: "alterEgo" }, effects: [hitVillain(1)] });
/** "Hero Interrupt: When the villain attacks, deal 1 damage to it.": no Action ability at all. */
const DODGE = event("dodge", 0, {
  trigger: { kind: "interrupt", forced: false, form: "hero", on: { on: "enemyAttack" } },
  effects: [hitVillain(1)],
});
/** Two Hero Actions: the player chooses one (RRG 1.8 "Event", p. 18). */
const TWIN = event("twin", 0, heroAction(hitVillain(1)), heroAction(hitVillain(4)));
/** "Hero Action: Deal 3 damage to the attacking enemy.": it needs the attack this response answers. */
const COUNTER = event(
  "counter",
  0,
  heroAction({ kind: "dealDamage", target: { kind: "attackingEnemy" }, amount: { kind: "const", value: 3 } }),
);
const EVENTS = [STRIKE, COSTLY, PLAIN, REST, DODGE, TWIN, COUNTER];

const VILLAIN = stubVillain({ id: "brute", stages: [{ hp: flat(30), atk: 1, sch: 1 }] });
const deps: EngineDeps = depsOf(GUARDIAN_RESPONSE, USHER_RESPONSE, ...EVENTS.flatMap((e) => e.stubs));

interface Table {
  readonly state: GameState;
  readonly guardian: InstanceId;
  readonly usher: InstanceId;
}

/** p1 in hero form with both allies in play, holding exactly `hand` (card ids) and nothing else of the test's. */
function table(hand: readonly string[], form: "hero" | "alterEgo" = "hero"): Table {
  const start = gameAtFirstTurn({
    deps,
    villain: VILLAIN,
    cards: [GUARDIAN, USHER, VILLAIN, ...EVENTS.map((e) => e.card)],
    deck: [GUARDIAN.id, USHER.id, ...EVENTS.flatMap((e) => [e.card.id, e.card.id])],
  });
  const guardian = playerCardIntoPlay(start, GUARDIAN.id);
  const usher = playerCardIntoPlay(guardian.state, USHER.id);
  const state = usher.state;
  const seat = mustPlayer(state, P1);
  // Surgery: the hand is exactly `hand`; every other event of the test leaves the deck, so none is drawn later.
  const eventIds = new Set<string>(EVENTS.map((e) => e.card.id));
  const pool = [...seat.hand, ...seat.deck];
  const taken: InstanceId[] = [];
  for (const wanted of hand) {
    const id = pool.find((candidate) => state.instances[candidate]?.cardId === wanted && !taken.includes(candidate));
    if (!id) throw new Error(`no ${wanted} to hand out`);
    taken.push(id);
  }
  const isEvent = (id: InstanceId) => eventIds.has(String(state.instances[id]?.cardId));
  return {
    guardian: guardian.id,
    usher: usher.id,
    state: {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        identity: { ...p.identity, form },
        hand: taken,
        deck: pool.filter((id) => !taken.includes(id) && !isEvent(id)),
        discard: [...p.discard, ...pool.filter((id) => !taken.includes(id) && isEvent(id))],
      })),
    },
  };
}

const code = (state: GameState, id: string): string => String(state.instances[id as InstanceId]?.cardId);

/** Ends the turn: the villain attacks, `defender` defends, its response is accepted and `want` is played and paid. */
function villainPhase(t: Table, defender: InstanceId, want: string | null = null, ability = 0) {
  const offered: string[][] = [];
  const responses: string[] = [];
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const prompt = choice.prompt;
    if (prompt.kind === "declareDefender") return [defender];
    if (prompt.kind === "chooseTriggers") {
      responses.push(...choice.options.map((o) => o.optionId));
      return choice.options.map((o) => o.optionId);
    }
    if (prompt.kind === "chooseCards" && prompt.slot === "playFromHand") {
      offered.push(choice.options.map((o) => code(state, o.optionId)));
      const option = choice.options.find((o) => code(state, o.optionId) === want);
      return option ? [option.optionId] : [choice.options[0]!.optionId];
    }
    if (prompt.kind === "chooseOption") return [choice.options[ability]!.optionId];
    if (prompt.kind === "spendResources") return choice.options.map((o) => o.optionId);
    return defaultPick(state);
  };
  const { session, events } = driveSession(startSession(t.state), deps, [{ type: "endTurn", playerId: P1 }], pick);
  return { session, state: session.state, events, offered, responses };
}

const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;
const discarded = (state: GameState): readonly string[] => mustPlayer(state, P1).discard.map((id) => code(state, id));
const played = (run: ReturnType<typeof villainPhase>): readonly string[] =>
  run.events.flatMap((e) => (e.type === "cardPlayed" ? [code(run.state, e.instanceId)] : []));

/** `state` as it stands while the villain activates (surgery on the step alone), for the fault functions. */
const inVillainPhase = (state: GameState): GameState => ({
  ...state,
  step: {
    phase: "villain",
    kind: "enemyActivations",
    currentPlayerId: P1,
    remainingPlayerIds: [],
    villainActivated: true,
    activatedMinionIds: [],
  } as GameState["step"],
});
const inHand = (state: GameState, card: string): InstanceId =>
  mustPlayer(state, P1).hand.find((id) => code(state, id) === card)!;

describe("an effect that instructs the play of an event with an Action ability (ignoreActionTiming)", () => {
  it("villain phase: the Hero Action event is played and paid for, and resolves; replay deep-equal", () => {
    const t = table([STRIKE.card.id, RESOURCE.id, RESOURCE.id]);
    const run = villainPhase(t, t.guardian, STRIKE.card.id);
    expect(run.responses).toContain(`${t.guardian}:${GUARDIAN_RESPONSE.ref.id}`);
    expect(run.offered).toEqual([[STRIKE.card.id]]);
    expect(played(run)).toEqual([STRIKE.card.id]);
    expect(villainDamage(run.state)).toBe(2);
    expect(discarded(run.state)).toContain(STRIKE.card.id);
    // It was paid for: the two resource cards were spent.
    expect(discarded(run.state).filter((card) => card === RESOURCE.id)).toHaveLength(2);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });

  it("default off: the same response without the flag offers no Action event in the villain phase", () => {
    const t = table([STRIKE.card.id, RESOURCE.id, RESOURCE.id]);
    const run = villainPhase(t, t.usher, STRIKE.card.id);
    expect(run.responses).toContain(`${t.usher}:${USHER_RESPONSE.ref.id}`);
    expect(run.offered).toEqual([]);
    expect(played(run)).toEqual([]);
    expect(villainDamage(run.state)).toBe(0);
  });

  it("only events with a Hero Action are offered: a plain Action, an Alter-Ego Action and an Interrupt are not", () => {
    const t = table([PLAIN.card.id, DODGE.card.id, STRIKE.card.id, RESOURCE.id, RESOURCE.id]);
    const run = villainPhase(t, t.guardian, STRIKE.card.id);
    expect(run.offered).toEqual([[STRIKE.card.id]]);
    const none = table([PLAIN.card.id, REST.card.id, DODGE.card.id]);
    expect(villainPhase(none, none.guardian).offered).toEqual([]);
  });

  it("an Interrupt event has no Action ability to play, whatever the timing", () => {
    const t = table([DODGE.card.id]);
    const state = inVillainPhase(t.state);
    const ctx = createCtx(state, deps);
    expect(playWithPaymentFault(ctx, P1, inHand(state, DODGE.card.id), 0, "hand", undefined, "any")).toBe(
      "an event with no action ability",
    );
  });

  it("no affordable event: the response is offered and resolves with nothing", () => {
    const t = table([COSTLY.card.id, RESOURCE.id]);
    const run = villainPhase(t, t.guardian, COSTLY.card.id);
    expect(run.responses).toContain(`${t.guardian}:${GUARDIAN_RESPONSE.ref.id}`);
    expect(run.offered).toEqual([]);
    expect(played(run)).toEqual([]);
    expect(mustPlayer(run.state, P1).hand.map((id) => code(run.state, id))).toContain(COSTLY.card.id);
    expect(villainDamage(run.state)).toBe(0);
  });

  it("two Hero Action abilities: the player chooses one, as on a turn", () => {
    const t = table([TWIN.card.id]);
    const run = villainPhase(t, t.guardian, TWIN.card.id, 1);
    expect(played(run)).toEqual([TWIN.card.id]);
    expect(villainDamage(run.state)).toBe(4);
  });

  // "After … defends against an attack" is answered once the attack has dealt its damage (the `defended` event's
  // response window), with the attack still the current one: the played event's effects can name its attacker.
  it("the played event can name the attack it answers: 'the attacking enemy' is the one defended against", () => {
    const t = table([COUNTER.card.id]);
    const run = villainPhase(t, t.guardian, COUNTER.card.id);
    expect(played(run)).toEqual([COUNTER.card.id]);
    expect(villainDamage(run.state)).toBe(3);
  });

  it("only the Action's timing is lifted: the fault functions, in the villain phase", () => {
    const t = table([STRIKE.card.id, COSTLY.card.id, RESOURCE.id, RESOURCE.id]);
    const state = inVillainPhase(t.state);
    const ctx = createCtx(state, deps);
    const strike = inHand(state, STRIKE.card.id);
    expect(playWithPaymentFault(ctx, P1, strike, 0)).toBe("an Action event outside its player's turn");
    expect(playWithPaymentFault(ctx, P1, strike, 0, "hand", undefined, "any")).toBeNull();
    expect(playIgnoringCostFault(ctx, P1, strike)).toBe("an Action event outside its player's turn");
    expect(playIgnoringCostFault(ctx, P1, strike, "hand", undefined, "any")).toBeNull();
    // Cost and payment still apply.
    expect(playWithPaymentFault(ctx, P1, inHand(state, COSTLY.card.id), 0, "hand", undefined, "any")).toBe(
      "not enough resources to pay for it",
    );
  });

  it("alter-ego form: a Hero Action is still refused for its form", () => {
    const t = table([STRIKE.card.id, RESOURCE.id, RESOURCE.id], "alterEgo");
    const state = inVillainPhase(t.state);
    const ctx = createCtx(state, deps);
    const strike = inHand(state, STRIKE.card.id);
    expect(playWithPaymentFault(ctx, P1, strike, 0, "hand", undefined, "any")).toBe("wrong form");
    expect(playIgnoringCostFault(ctx, P1, strike, "hand", undefined, "any")).toBe("wrong form");
  });
});
