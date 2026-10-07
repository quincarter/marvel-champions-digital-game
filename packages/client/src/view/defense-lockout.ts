/**
 * The defense cards a player holds while another player's defense has closed the attack in progress (RRG 1.8 "Defend,
 * Defense", pp. 14-15). The engine owns the rule (`defenseBarFor`) and its wording (`DEFENSE_BAR_MESSAGE`); this reads
 * them and never decides who may defend. Wave 7 QA: the defend sheet read "Nothing playable in hand right now." for a
 * player holding Barely a Scratch, which looks like a lockout of nothing instead of one of that card.
 */
import {
  activeAbilityRefs,
  DEFENSE_BAR_MESSAGE,
  defenseBarFor,
  type DefenseBar,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import type { Highlights, IllegalReason } from "./highlights.js";

/** The short tag on a hand card. */
export const DEFENSE_LOCKOUT_TAG = "locked out";

const BAR_MESSAGES: ReadonlySet<string> = new Set(Object.values(DEFENSE_BAR_MESSAGE));

/** Whether an illegal-reason message is one of the engine's defense bars. */
export const isDefenseBarMessage = (message: string): boolean => BAR_MESSAGES.has(message);

/** The viewer's bar for the attack in progress, and the "(defense)"-labeled cards in their hand it closes. */
export function defenseLockoutOf(
  state: GameState,
  viewer: PlayerId | null,
  deps: EngineDeps,
): { readonly bar: DefenseBar; readonly cards: readonly InstanceId[] } | null {
  const bar = defenseBarFor(state, viewer);
  if (bar === null) return null;
  const player = state.players.find((candidate) => candidate.playerId === viewer);
  const cards = (player?.hand ?? []).filter((id) =>
    activeAbilityRefs(state, id, deps).some((ref) => deps.abilities[ref.id]?.label?.includes("defense") === true),
  );
  return cards.length > 0 ? { bar, cards } : null;
}

/** `marks` with each locked-out defense card in hand dimmed and carrying the engine's reason. */
export function withDefenseLockout(
  marks: Highlights,
  state: GameState,
  viewer: PlayerId | null,
  deps: EngineDeps,
): Highlights {
  const lockout = defenseLockoutOf(state, viewer, deps);
  if (!lockout) return marks;
  const unplayable = new Map(marks.unplayable);
  const reason: IllegalReason = { code: "choice_pending", message: DEFENSE_BAR_MESSAGE[lockout.bar] };
  for (const id of lockout.cards) if (!marks.playable.has(id)) unplayable.set(id, reason);
  return { ...marks, unplayable };
}
