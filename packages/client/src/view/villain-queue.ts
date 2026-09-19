/**
 * "Queued this phase" (D11, P09, L02): the seats step 2 of the villain phase
 * hasn't reached yet, and what will happen to each once it does.
 *
 * RRG "Villain Phase" step 2 ("Enemy Activations", `packages/engine/src/
 * villain/phase.ts`'s `executeEnemyActivations`): in player order, the villain
 * activates once against *each* player in turn (attack in hero form, scheme
 * in alter-ego), then that player's own engaged minions activate. So a future
 * seat always has a villain activation still to come — `villainActivated`
 * only ever describes the *current* seat, because it resets to `false` the
 * moment the engine moves on to the next one.
 *
 * This reads that straight off `state.step` and the engine's own selectors
 * (`minionsEngagedWith`, `statusActive`) — nothing here decides who activates
 * next or whether a status actually cancels it; the engine already has.
 */
import { activeVillain, getPlayer, minionsEngagedWith, statusActive, type EngineDeps, type GameState, type InstanceId, type PlayerId } from "@mc/engine";

export interface QueuedActivation {
  readonly kind: "villain" | "minion";
  readonly instanceId: InstanceId;
  /**
   * Set when this activation's own status card will be discarded instead of
   * it resolving (RRG "Stun", "Confuse") — read from the engine's own
   * `statusActive`, which is the one that knows about "steady" needing two
   * counters rather than one, not a bare status count.
   */
  readonly cancelledBy: "stunned" | "confused" | null;
}

export interface QueuedSeat {
  readonly playerId: PlayerId;
  /** Still-pending activations for this seat, in the order the engine will run them. */
  readonly activations: readonly QueuedActivation[];
}

/**
 * Empty outside step 2 (`enemyActivations`), and never includes the seat
 * currently resolving — that seat's own remainder is what "happening now" is
 * already narrating, so listing it twice would just repeat the same fact in
 * two panels the player is looking at at once.
 */
export function queuedActivationsOf(state: GameState, deps: EngineDeps): readonly QueuedSeat[] {
  if (state.step.phase !== "villain" || state.step.kind !== "enemyActivations") return [];
  const { remainingPlayerIds } = state.step;
  const villainId = activeVillain(state).instanceId;

  // RRG "Stun"/"Confuse": the status is discarded instead of the activation it
  // would have cancelled resolving, so it only ever cancels the very *next*
  // one — once a queued villain entry has "spent" the villain's current
  // status, the villain's later entries in this same list run clean.
  let villainStatusSpent = false;

  const seats: QueuedSeat[] = [];
  for (const playerId of remainingPlayerIds) {
    const player = getPlayer(state, playerId);
    if (!player || player.eliminated) continue;
    const statusToCheck = player.identity.form === "hero" ? "stunned" : "confused";
    const activations: QueuedActivation[] = [];

    const villainCancelled = !villainStatusSpent && statusActive(state, villainId, statusToCheck, deps);
    if (villainCancelled) villainStatusSpent = true;
    activations.push({ kind: "villain", instanceId: villainId, cancelledBy: villainCancelled ? statusToCheck : null });

    for (const minionId of minionsEngagedWith(state, playerId)) {
      const cancelled = statusActive(state, minionId, statusToCheck, deps);
      activations.push({ kind: "minion", instanceId: minionId, cancelledBy: cancelled ? statusToCheck : null });
    }

    seats.push({ playerId, activations });
  }
  return seats;
}
