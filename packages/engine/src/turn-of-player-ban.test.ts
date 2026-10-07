/**
 * docs/phase7-wave7.md §4.1 (The Merc with the Mouth 44032): "Other players cannot resolve player card abilities during
 * your turn." `Predicate turnOf { player }` and `RuleSpec cannotResolveTriggeredAbilities` scoped to players (`player`)
 * and to player cards (`playerCards`), with `cannotPlay` over the other players' events. Synthetic cards: the rule sits
 * on an attachment on p1's identity, so "you" is p1 (RRG 1.8 "Attachment", p. 8).
 *
 * Sources: RRG 1.8 "Active Player" (p. 6): "The player taking their turn during the player phase is the active
 * player." "Action" (p. 6): "Players are permitted to trigger action abilities during their turn, or by request during
 * other players' turns." "'Cannot'" (p. 11): "The word 'cannot' is absolute … If two rules conflict, the rule with
 * 'cannot' takes precedence." "Forced" (p. 20): a forced ability's initiation is mandatory, which the cannot overrides.
 * "Player Card" (p. 33): the seven player card types.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { evaluate } from "./select.js";
import type { PlayerRef, Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAttachment, stubEvent, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const you: PlayerRef = { kind: "controller" };
const others: PlayerRef = { kind: "others", of: you };
const yourTurn: Predicate = { kind: "turnOf", player: you };
const self = { kind: "self" } as const;
const mark = (type: string) =>
  ({ kind: "addCounters", target: self, counterType: type, amount: { kind: "const", value: 1 } }) as const;
const def = (d: AbilityDefinition) => d;

const BAN: readonly RuleSpec[] = [
  { kind: "cannotResolveTriggeredAbilities", on: {}, player: others, playerCards: true, while: yourTurn },
  { kind: "cannotPlay", player: others, cards: { categories: ["event"] }, while: yourTurn },
];
const HUSH_RULE = stubAbility("hush.constant", def({ trigger: { kind: "constant", rules: BAN }, effects: [] }));
const HUSH = stubAttachment({ id: "hush", attachesTo: { kind: "yourIdentity" }, abilities: [HUSH_RULE.ref] });

/** A support with an Action, a Response and a Forced Response to an event being played, and a Resource. */
const onPlay = { on: "cardPlayed" } as const;
const RIG_ACTION = stubAbility("rig.action", def({ trigger: { kind: "action" }, effects: [mark("action")] }));
const RIG_RESPONSE = stubAbility(
  "rig.response",
  def({ trigger: { kind: "response", forced: false, on: onPlay }, effects: [mark("response")] }),
);
const RIG_FORCED = stubAbility(
  "rig.forced",
  def({ trigger: { kind: "response", forced: true, on: onPlay }, effects: [mark("forced")] }),
);
const RIG_RESOURCE = stubAbility(
  "rig.resource",
  def({ trigger: { kind: "resource", forAnyPlayer: true }, cost: { exhaustSelf: true }, generates: 1, effects: [] }),
);
const RIG = stubSupport({
  id: "rig",
  cost: 0,
  abilities: [RIG_ACTION.ref, RIG_RESPONSE.ref, RIG_FORCED.ref, RIG_RESOURCE.ref],
});
/** "Any player may trigger this ability." */
const OPEN_ACTION = stubAbility(
  "open.action",
  def({ trigger: { kind: "action", triggerableBy: { kind: "each" } }, effects: [mark("open")] }),
);
const OPEN = stubSupport({ id: "open", cost: 0, abilities: [OPEN_ACTION.ref] });
/** An Action event (cost 0) and a 1-cost one to pay for. */
const JAB_ACTION = stubAbility("jab.action", def({ trigger: { kind: "action" }, effects: [] }));
const JAB = stubEvent({ id: "jab", cost: 0, abilities: [JAB_ACTION.ref] });
const HOOK_ACTION = stubAbility("hook.action", def({ trigger: { kind: "action" }, effects: [] }));
const HOOK = stubEvent({ id: "hook", cost: 1, abilities: [HOOK_ACTION.ref] });
/** An encounter card with an Action any player may use, and a forced response of the scenario's. */
const PLOT_ACTION = stubAbility("plot.action", def({ trigger: { kind: "action" }, effects: [mark("action")] }));
const PLOT_FORCED = stubAbility(
  "plot.forced",
  def({ trigger: { kind: "response", forced: true, on: onPlay }, effects: [mark("forced")] }),
);
const PLOT = stubSideScheme({ id: "plot", startingThreat: 3, abilities: [PLOT_ACTION.ref, PLOT_FORCED.ref] });

const ABILITIES = [
  HUSH_RULE,
  RIG_ACTION,
  RIG_RESPONSE,
  RIG_FORCED,
  RIG_RESOURCE,
  OPEN_ACTION,
  JAB_ACTION,
  HOOK_ACTION,
  PLOT_ACTION,
  PLOT_FORCED,
];
const deps: EngineDeps = depsOf(...ABILITIES);

/** Two players at p1's turn, each with a Rig in play; the Hush on p1's identity when `hush`. */
function table(hush: boolean): { state: GameState; rig1: InstanceId; rig2: InstanceId; open: InstanceId } {
  let state = gameAtFirstTurn({
    cards: [HUSH, RIG, OPEN, JAB, HOOK, PLOT],
    deps,
    players: 2,
    deck: [RIG.id, OPEN.id, ...copiesOf(JAB.id, 2), HOOK.id],
    encounter: [...copiesOf(TREACHERY.id, 28), HUSH.id, PLOT.id],
  });
  const rig1 = playerCardIntoPlay(state, RIG.id, P1);
  const rig2 = playerCardIntoPlay(rig1.state, RIG.id, P2);
  const open = playerCardIntoPlay(rig2.state, OPEN.id, P1);
  state = open.state;
  if (hush) {
    const placed = encounterCardInVillainArea(state, HUSH.id);
    const identity = mustPlayer(placed.state, P1).identity.instanceId;
    state = {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...mustInstance(placed.state, placed.id), attachedTo: identity },
        [identity]: {
          ...mustInstance(placed.state, identity),
          attachments: [...mustInstance(placed.state, identity).attachments, placed.id],
        },
      },
    };
  }
  return { state, rig1: rig1.id, rig2: rig2.id, open: open.id };
}

const use = (playerId: PlayerId, cardInstanceId: InstanceId, abilityId: string): Command => ({
  type: "useAbility",
  playerId,
  cardInstanceId,
  abilityId: abilityId as never,
  payment: [],
});
const play = (playerId: PlayerId, id: InstanceId, payment: readonly Payment[] = []): Command => ({
  type: "playCard",
  playerId,
  cardInstanceId: id,
  payment,
  attachToInstanceId: null,
});
const ok = (state: GameState, command: Command): boolean => applyCommand(state, command, deps).ok;
const counters = (state: GameState, id: InstanceId, type: string): number =>
  mustInstance(state, id).counters?.[type] ?? 0;
/** The state after `commands`, every prompt answered with its first option. */
/** Takes every optional ability offered: the first option that is not a pass. */
const eager = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (!choice) return [];
  if (choice.minSelections > 0) return choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
  const wanted = choice.options.find((o) => o.optionId !== "pass") ?? choice.options[0];
  return wanted ? [wanted.optionId] : [];
};
const after = (state: GameState, ...commands: Command[]): GameState =>
  driveSession(startSession(state), deps, commands, eager).session.state;
const legalIds = (state: GameState, player: PlayerId): readonly string[] => {
  const actions = legalActions(state, player, deps);
  return actions.kind === "turn" || actions.kind === "notYourTurn"
    ? actions.legal.flatMap((a) => (a.action.kind === "useAbility" ? [String(a.action.abilityId)] : []))
    : [];
};

describe("Predicate turnOf", () => {
  const holds = (state: GameState, controllerId: PlayerId, player: PlayerRef = you): boolean =>
    evaluate(
      state,
      { kind: "turnOf", player },
      {
        selfInstanceId: mustPlayer(state, controllerId).identity.instanceId,
        controllerId,
        event: null,
        bindings: {},
        deps,
      },
    );
  it("is true for the active player and false for the other, and follows the turn", () => {
    const { state } = table(false);
    expect(holds(state, P1)).toBe(true);
    expect(holds(state, P2)).toBe(false);
    expect(holds(state, P2, others)).toBe(true);
    const next = after(state, { type: "endTurn", playerId: P1 });
    expect(next.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: P2 });
    expect(holds(next, P1)).toBe(false);
    expect(holds(next, P2)).toBe(true);
  });
  it("is false outside a player turn", () => {
    const { state } = table(false);
    const villain: GameState = { ...state, step: { phase: "villain", kind: "placeThreat" } as GameState["step"] };
    expect(holds(villain, P1)).toBe(false);
    expect(holds(villain, P1, { kind: "each" })).toBe(false);
  });
});

describe("other players cannot resolve player card abilities during your turn", () => {
  it("control: without the rule p2 may use an Action on their card during p1's turn", () => {
    const t = table(false);
    expect(ok(t.state, use(P2, t.rig2, "rig.action"))).toBe(true);
    expect(legalIds(t.state, P2)).toContain("rig.action");
  });

  it("p2's Action on their own player card is refused and not offered; p1's is untouched", () => {
    const t = table(true);
    expect(ok(t.state, use(P2, t.rig2, "rig.action"))).toBe(false);
    expect(legalIds(t.state, P2)).not.toContain("rig.action");
    expect(ok(t.state, use(P1, t.rig1, "rig.action"))).toBe(true);
    expect(legalIds(t.state, P1)).toContain("rig.action");
  });

  it("p2's Action event is refused; p1's is played", () => {
    const t = table(true);
    const theirs = giveCard(t.state, P2, JAB.id);
    expect(ok(theirs.state, play(P2, theirs.id))).toBe(false);
    expect(ok(giveCard(table(false).state, P2, JAB.id).state, play(P2, theirs.id))).toBe(true);
    const mine = giveCard(t.state, P1, JAB.id);
    expect(ok(mine.state, play(P1, mine.id))).toBe(true);
  });

  it("p1 plays an event: p2's Response and Forced Response on a player card do not resolve, p1's do", () => {
    const run = (hush: boolean) => {
      const t = table(hush);
      const mine = giveCard(t.state, P1, JAB.id);
      return { t, state: after(mine.state, play(P1, mine.id)) };
    };
    const free = run(false);
    expect(counters(free.state, free.t.rig2, "response")).toBe(1);
    expect(counters(free.state, free.t.rig2, "forced")).toBe(1);
    const hushed = run(true);
    expect(counters(hushed.state, hushed.t.rig1, "response")).toBe(1);
    expect(counters(hushed.state, hushed.t.rig1, "forced")).toBe(1);
    expect(counters(hushed.state, hushed.t.rig2, "response")).toBe(0);
    // RRG 1.8 "'Cannot'" (p. 11) over "Forced" (p. 20): a forced ability on another player's player card is not initiated.
    expect(counters(hushed.state, hushed.t.rig2, "forced")).toBe(0);
  });

  it("a Resource ability on p2's player card cannot pay, even 'for any player'; p1's own pays", () => {
    const pay = (hush: boolean, rig: "rig1" | "rig2") => {
      const t = table(hush);
      const hook = giveCard(t.state, P1, HOOK.id);
      return ok(
        hook.state,
        play(P1, hook.id, [{ ability: { instanceId: t[rig], abilityId: "rig.resource" as never } }]),
      );
    };
    expect(pay(false, "rig2")).toBe(true);
    expect(pay(true, "rig2")).toBe(false);
    expect(pay(true, "rig1")).toBe(true);
  });

  it("an 'any player may trigger this' Action on p1's card is refused to p2 and open to p1", () => {
    const free = table(false);
    expect(ok(free.state, use(P2, free.open, "open.action"))).toBe(true);
    const t = table(true);
    expect(ok(t.state, use(P2, t.open, "open.action"))).toBe(false);
    expect(ok(t.state, use(P1, t.open, "open.action"))).toBe(true);
  });

  it("an encounter card's abilities are left alone: its Action for p2, its forced response", () => {
    const t = table(true);
    const plot = encounterCardInVillainArea(t.state, PLOT.id);
    expect(ok(plot.state, use(P2, plot.id, "plot.action"))).toBe(true);
    const mine = giveCard(plot.state, P1, JAB.id);
    expect(counters(after(mine.state, play(P1, mine.id)), plot.id, "forced")).toBe(1);
  });

  it("outside that player's turn nothing is stopped: in p2's turn both players' Actions and events work", () => {
    const t = table(true);
    const next = after(t.state, { type: "endTurn", playerId: P1 });
    expect(next.step).toMatchObject({ kind: "turn", activePlayerId: P2 });
    expect(ok(next, use(P2, t.rig2, "rig.action"))).toBe(true);
    expect(ok(next, use(P1, t.rig1, "rig.action"))).toBe(true);
    const theirs = giveCard(next, P2, JAB.id);
    expect(ok(theirs.state, play(P2, theirs.id))).toBe(true);
    const played = after(theirs.state, play(P2, theirs.id));
    expect(counters(played, t.rig2, "response")).toBe(1);
    expect(counters(played, t.rig1, "forced")).toBe(1);
  });
});
