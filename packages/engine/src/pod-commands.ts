/**
 * The two commands of Epic Multiplayer (docs/epic-multiplayer-plan.md §4 items 1 to 3; docs/phase7-wave9.md §3.68), and
 * what every command of a group with a remote coordinator tells it at its end (`reportPodBoundary`).
 *
 * MC55 p. 11 and 55028b: one Loki, God of Lies and one Worlds Collide per game; pods only scope "your pod" abilities
 * (MC55 pp. 4, 13). A `GameState` is one group; the coordinator (`pod-coordinator.ts`) is outside every group.
 */

import { requireActivePlayer, usableCharacter } from "./actions.js";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { emit, type Ctx } from "./ctx.js";
import { discardStatusCards, exhaustCard } from "./effects.js";
import { engineError, type EngineError } from "./errors.js";
import type { GameEvent } from "./events.js";
import { attackKeywordsOf, statusActive } from "./keywords.js";
import { podGroupIds, type GroupStatus, type PodInboundEvent, type PodOutbound, type PodState } from "./pod.js";
import { characterProfile } from "./query.js";
import {
  concludeFromCoordinator,
  emitPodEvent,
  haltGroup,
  reachableCardsOf,
  replaceSharedCopy,
} from "./resolve/pod.js";
import { announceStatusDiscarded } from "./resolve/status-discarded.js";
import { attackerForbiddenEveryAttack } from "./select.js";
import type { GameState } from "./state.js";

const remotePod = (state: GameState): PodState | null => (state.pod?.coordinator === "remote" ? state.pod : null);

/** The `externalEvent` command a host applies for inbound event `sequence` (recorded under the first player). */
export const inboundCommand = (state: GameState, sequence: number, event: PodInboundEvent): Command => ({
  type: "externalEvent",
  playerId: state.firstPlayerId,
  sequence,
  event,
});

/** Commands a halted group refuses: every action. A choice still resolves, and conceding and inbound events go on. */
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
 * resolving still finishes (a choice is answered), and the coordinator's verdict still arrives.
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
 * sequence. Then:
 * - `sharedStateChanged` replaces this group's copy of the shared record at once (bookkeeping, no draw);
 * - `gameWon` / `gameLost` end the game at once, whatever is resolving (Q6: groups stop at their next command boundary);
 * - `stopAfterPhase` in setup or a mulligan stops the group at once (owner question 1, option A pending; plan §1.8);
 * - everything else waits in `PodState.pendingInbound` for the resolution in progress to finish (MC55 p. 20; M3).
 */
export function externalEvent(ctx: Ctx, command: Command & { type: "externalEvent" }): EngineError | null {
  const pod = remotePod(ctx.state);
  if (!pod) return engineError("no_remote_coordinator", "this game has no remote pod coordinator", command);
  if (command.playerId !== ctx.state.firstPlayerId)
    return engineError("unknown_player", "an inbound pod event is recorded under the first player", command);
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
 * `Command remotePower` (plan §1.8 M6): a basic attack or thwart on another group's reachable card. Checked and paid
 * here as a basic power is (RRG 1.8 "Basic Powers"): the active player's turn; a hero (not an alter-ego) or an ally they
 * control, ready; exhausted as the cost. A stunned attacker or a confused thwarter only discards the status card (RRG
 * 1.8 "Stun, Stunned", p. 41; "Confuse, Confused", p. 13), and nothing is sent. Otherwise the power is measured (ATK or
 * THW as it stands, Overkill from the attacker's basic attack keywords) and sent as `remotePowerUsed`.
 *
 * The owning group judges the card when the event reaches it (`remoteTargetFault`), so a card that left play in the
 * meantime is refused there, after this group paid (engine reading, flagged; a host can ask the owning group's
 * `remoteTargetFault` first). Engine reading, flagged for the owner: the power is made here with no attack or thwart
 * event, so this group's "when a character attacks / thwarts" abilities (Domineering Force, Mounting Resistance) and
 * the power's additional costs do not apply to it.
 */
export function remotePower(ctx: Ctx, command: Command & { type: "remotePower" }): EngineError | null {
  const pod = remotePod(ctx.state);
  if (!pod) return engineError("no_remote_coordinator", "this game has no remote pod coordinator", command);
  if (command.toGroupId === pod.groupId || !podGroupIds(ctx.state).includes(command.toGroupId))
    return engineError("no_valid_target", "that is not another group of your pod", command);
  const inactive = requireActivePlayer(ctx.state, command.playerId, command);
  if (inactive) return inactive;
  const id = command.characterInstanceId;
  const unusable = usableCharacter(ctx, command.playerId, id, command);
  if (unusable) return unusable;
  const stat = command.power === "attack" ? "atk" : "thw";
  const profile = characterProfile(ctx.state, id, ctx.deps);
  if (!profile || profile.missing.includes(stat))
    return engineError(
      "no_valid_target",
      `a character with a printed '—' ${stat.toUpperCase()} cannot do that`,
      command,
    );
  if (command.power === "attack" && attackerForbiddenEveryAttack(ctx.state, id, ctx.deps, true))
    return engineError("no_valid_target", "this character cannot make basic attacks", command);

  exhaustCard(ctx, id);
  const status = command.power === "attack" ? "stunned" : "confused";
  if (statusActive(ctx.state, id, status, ctx.deps)) {
    const cause = command.power === "attack" ? "cancelledAttack" : "cancelledSchemeOrThwart";
    announceStatusDiscarded(ctx, discardStatusCards(ctx, id, status, cause));
    return null;
  }
  const overkill =
    command.power === "attack" &&
    attackKeywordsOf(ctx.state, ctx.deps, { attackerInstanceId: id, basic: true }).includes("overkill");
  emitPodEvent(ctx, {
    type: "remotePowerUsed",
    groupId: pod.groupId,
    playerId: command.playerId,
    toGroupId: command.toGroupId,
    targetInstanceId: command.targetInstanceId,
    power: command.power,
    amount: Math.max(0, profile[stat]),
    overkill,
  });
  return null;
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
    emitPodEvent(ctx, { type: "reachableCards", groupId: ctx.state.pod?.groupId ?? pod.groupId, cards });
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
