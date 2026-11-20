/**
 * The commands of Epic Multiplayer (docs/epic-multiplayer-plan.md §4 items 1 to 3; docs/phase7-wave9.md §3.68), and
 * what every command of a group with a remote coordinator tells it at its end (`reportPodBoundary`).
 *
 * MC55 p. 11 and 55028b: one Loki, God of Lies and one Worlds Collide per game; pods only scope "your pod" abilities
 * (MC55 pp. 4, 13). A `GameState` is one group; the coordinator (`pod-coordinator.ts`) is outside every group.
 */

import { basicAttack, basicThwart } from "./actions.js";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { emit, type Ctx } from "./ctx.js";
import { engineError, type EngineError } from "./errors.js";
import type { GameEvent } from "./events.js";
import { podGroupIds, type GroupStatus, type PodInboundEvent, type PodOutbound, type PodState } from "./pod.js";
import {
  concludeFromCoordinator,
  emitPodEvent,
  haltGroup,
  placeStandIn,
  reachableCardsOf,
  recordPodReachable,
  replaceSharedCopy,
} from "./resolve/pod.js";
import type { GameState } from "./state.js";

const remotePod = (state: GameState): PodState | null => (state.pod?.coordinator === "remote" ? state.pod : null);

/** The `externalEvent` command a host applies for inbound event `sequence` (recorded under the first player). */
export const inboundCommand = (state: GameState, sequence: number, event: PodInboundEvent): Command => ({
  type: "externalEvent",
  playerId: state.firstPlayerId,
  sequence,
  event,
});

/** Commands a halted or waiting group refuses: every action. A choice still resolves; conceding and inbound go on. */
const ACTIONS: ReadonlySet<Command["type"]> = new Set([
  "changeForm",
  "playCard",
  "useAbility",
  "basicAttack",
  "basicThwart",
  "basicRecover",
  "endTurn",
  "remotePower",
]);

/**
 * MC55 p. 21: a group that has stopped play after the shared scheme's completion takes no more actions; what was
 * resolving still finishes (a choice is answered), and the coordinator's verdict still arrives. A group waiting for the
 * coordinator's answer to its shared event (`PodState.awaiting`) takes none until it comes.
 */
export function haltedFault(state: GameState, command: Command): EngineError | null {
  if (!ACTIONS.has(command.type)) return null;
  if (state.pod?.halted)
    return engineError("pod_halted", "this group has stopped play: the shared scheme was completed", command);
  if (state.pod?.awaiting !== undefined)
    return engineError("pod_waiting", "waiting for the pod coordinator to answer this group's shared event", command);
  return null;
}

/**
 * `Command externalEvent`. Accepted only with a remote coordinator, from the first player's seat, with the next
 * sequence (one already applied is `external_event_already_applied`, which a host drops; a gap is
 * `external_event_out_of_order`, which it fills). Then:
 * - `sharedStateChanged` and `podReachable` take effect at once (bookkeeping, no draw);
 * - `gameWon` / `gameLost` end the game at once, whatever is resolving (Q6: groups stop at their next command boundary);
 * - `stopAfterPhase` in setup or a mulligan stops the group at once (owner question 1, option A pending; plan §1.8);
 * - everything else waits in `PodState.pendingInbound` for the resolution in progress to finish (MC55 p. 20; M3).
 */
export function externalEvent(ctx: Ctx, command: Command & { type: "externalEvent" }): EngineError | null {
  const pod = remotePod(ctx.state);
  if (!pod) return engineError("no_remote_coordinator", "this game has no remote pod coordinator", command);
  if (command.playerId !== ctx.state.firstPlayerId)
    return engineError("unknown_player", "an inbound pod event is recorded under the first player", command);
  if (command.sequence <= pod.inboundSeq)
    return engineError(
      "external_event_already_applied",
      `inbound event ${command.sequence} was applied already (last ${pod.inboundSeq})`,
      command,
    );
  if (command.sequence !== pod.inboundSeq + 1)
    return engineError(
      "external_event_out_of_order",
      `inbound event ${command.sequence} is not the next one (${pod.inboundSeq + 1})`,
      command,
    );
  const { event } = command;
  ctx.state = { ...ctx.state, pod: { ...pod, inboundSeq: command.sequence } };
  emit(ctx, { type: "podInboundReceived", sequence: command.sequence, kind: event.kind });
  switch (event.kind) {
    case "sharedStateChanged":
      replaceSharedCopy(ctx, event.shared);
      return null;
    case "podReachable":
      recordPodReachable(ctx, event);
      return null;
    case "gameWon":
    case "gameLost":
      concludeFromCoordinator(ctx, event.kind);
      return null;
    case "stopAfterPhase":
      if (ctx.state.step.phase === "setup") {
        haltGroup(ctx);
        return null;
      }
      break;
    default:
      break;
  }
  const current = ctx.state.pod as PodState;
  ctx.state = { ...ctx.state, pod: { ...current, pendingInbound: [...(current.pendingInbound ?? []), event] } };
  return null;
}

/**
 * `Command podRelease`: the group's authority ends a wait for the coordinator's answer (`PodState.awaiting`) after a
 * timeout, when the coordinator is gone and cannot be restored (docs/live-game-rooms.md §10). The group plays on; its
 * unanswered shared event keeps its number and is re-sent when a coordinator returns, whose late `sharedAck` then
 * changes nothing. Refused with nothing to release.
 */
export function podRelease(ctx: Ctx, command: Command & { type: "podRelease" }): EngineError | null {
  const pod = remotePod(ctx.state);
  if (!pod) return engineError("no_remote_coordinator", "this game has no remote pod coordinator", command);
  if (command.playerId !== ctx.state.firstPlayerId)
    return engineError("unknown_player", "a pod release is recorded under the first player", command);
  if (pod.awaiting === undefined)
    return engineError("no_valid_target", "this group is not waiting for the coordinator", command);
  const { awaiting, ...kept } = pod;
  ctx.state = { ...ctx.state, pod: kept };
  emit(ctx, { type: "podWaitReleased", seq: awaiting });
  return null;
}

/**
 * `Command remotePower` (plan §1.8 M6): a basic attack or thwart on another group's reachable card.
 *
 * 55041/55046 "as if it were in their game area": a real attack/thwart by the remote character (MC55 insert p.12
 * exception; RRG Attack (Player Ability Type) p.10, Thwart p.44). A stand-in for the card is placed in this group's
 * villain area (`placeStandIn`, no text box here) and the ordinary basic power is made against it: its checks ("cannot
 * attack", "cannot thwart", stunned, confused), its costs, ATK or THW and their modifiers, this group's "when/after a
 * character attacks/thwarts" abilities (Domineering Force 55052, Mounting Resistance 55054, "after you attack a
 * minion"), and an ally's consequential damage. Only the damage or the threat removal aimed at the stand-in is sent,
 * with the attack's keywords (`divertToRemote`); the card's own keywords and statuses apply where it is.
 *
 * Cross-group attack/thwart (55041/55046) is initiated when the owning group's engine accepts it (engine reading: no
 * source orders events across groups, MC55 p.12). No valid target then = not initiated, no cost paid (RRG v1.8
 * Initiating Abilities p.24 step 2; Target p.42; Cost p.13). Target leaves play after that = exhausts, no consequential
 * damage, not considered to have attacked (Consequential Damage p.13).
 *
 * So a refusal from the owning group refunds the exhaust, the consequential damage and the hand cards spent
 * (`PodState.inFlight`), and a stunned attacker or a confused thwarter, whose attempt never reaches the card, keeps the
 * status discard and the exhaust (RRG 1.8 "Stun, Stunned", p. 41; owner answer 2026-11-20). Checked first against this
 * group's copy of the owning group's last report (`PodState.reachable`), so a card known to be gone is refused before
 * anything is paid.
 */
export function remotePower(ctx: Ctx, command: Command & { type: "remotePower" }): EngineError | null {
  const pod = remotePod(ctx.state);
  if (!pod) return engineError("no_remote_coordinator", "this game has no remote pod coordinator", command);
  if (command.toGroupId === pod.groupId || !podGroupIds(ctx.state).includes(command.toGroupId))
    return engineError("no_valid_target", "that is not another group of your pod", command);
  const card = pod.reachable?.[command.toGroupId]?.find(
    (c) => c.instanceId === command.targetInstanceId && c.by === command.power,
  );
  if (!card)
    return engineError(
      "no_valid_target",
      `that card cannot be ${command.power === "attack" ? "attacked" : "thwarted"} from your pod (as last reported)`,
      command,
    );
  const standIn = placeStandIn(ctx, command.toGroupId, card);
  // The hand cards the power's costs may spend, under any cost key: refunded if the owning group refuses it.
  const hand = ctx.state.players.find((p) => p.playerId === command.playerId)?.hand ?? [];
  const spent = [
    ...(command.payment ?? []).flatMap((p) => ("fromHand" in p ? [p.fromHand] : [])),
    ...Object.values(command.costChoices ?? {}).flat(),
  ].filter((id, i, all) => hand.includes(id) && all.indexOf(id) === i);
  const withFlight = ctx.state.pod as PodState;
  ctx.state = {
    ...ctx.state,
    pod: {
      ...withFlight,
      inFlight: [
        ...(withFlight.inFlight ?? []),
        {
          ref: standIn,
          characterInstanceId: command.characterInstanceId,
          playerId: command.playerId,
          toGroupId: command.toGroupId,
          consequential: 0,
          spent,
          sent: false,
        },
      ],
    },
  };
  const paid = {
    ...(command.payment ? { payment: command.payment } : {}),
    ...(command.costChoices ? { costChoices: command.costChoices } : {}),
  };
  const error =
    command.power === "attack"
      ? basicAttack(ctx, {
          type: "basicAttack",
          playerId: command.playerId,
          attackerInstanceId: command.characterInstanceId,
          targetInstanceId: standIn,
          ...paid,
        })
      : basicThwart(ctx, {
          type: "basicThwart",
          playerId: command.playerId,
          thwarterInstanceId: command.characterInstanceId,
          schemeInstanceId: standIn,
          ...paid,
        });
  // Refused: `applyCommand` drops this command's state, the stand-in with it.
  return error;
}

/** This group's status for its coordinator (MC55 p. 21; M4). */
export function groupStatusOf(state: GameState): GroupStatus {
  const phase = state.outcome || state.step.phase === "gameOver" ? "over" : state.step.phase;
  return { phase, round: state.round, halted: state.pod?.halted === true };
}

const sameStatus = (a: GroupStatus, b: GroupStatus): boolean =>
  a.phase === b.phase && a.round === b.round && a.halted === b.halted;

/**
 * At the end of every command of a group with a remote coordinator: its status (phase, round, halt) and its reachable
 * cards (The Mangog, Door Between Worlds: entered, left, damage or threat), each told once when it changed over the
 * command. Read as a difference of the states before and after, so no step of the engine has to remember to report.
 */
export function reportPodBoundary(ctx: Ctx, before: GameState, deps: EngineDeps): void {
  const pod = remotePod(ctx.state);
  if (!pod) return;
  const status = groupStatusOf(ctx.state);
  if (!sameStatus(groupStatusOf(before), status))
    emitPodEvent(ctx, { type: "groupStatus", groupId: pod.groupId, status });
  const cards = reachableCardsOf(ctx.state, deps);
  if (JSON.stringify(reachableCardsOf(before, deps)) !== JSON.stringify(cards))
    emitPodEvent(ctx, { type: "reachableCards", groupId: pod.groupId, cards });
}

/**
 * The outbound events of a command, in order, as a host forwards them to the coordinator: every
 * `sharedEventEmitted`, `podEffectRequested` and `podEventEmitted`, numbered by this group.
 */
export function podOutboundOf(state: GameState, events: readonly GameEvent[]): readonly PodOutbound[] {
  const groupId = state.pod?.groupId;
  if (groupId === undefined) return [];
  return events.flatMap((event): PodOutbound[] => {
    if (event.type === "sharedEventEmitted" || event.type === "podEventEmitted")
      return [{ seq: event.seq, event: event.event }];
    if (event.type === "podEffectRequested")
      return [
        {
          seq: event.seq,
          event: {
            type: "podEffectRequested",
            groupId,
            toGroupId: event.toGroupId,
            sourceCardId: event.sourceCardId,
            abilityId: event.abilityId,
            block: event.block,
          },
        },
      ];
    return [];
  });
}
