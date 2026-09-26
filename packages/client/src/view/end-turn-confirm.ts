/**
 * "End your turn? You can still: …" — the confirm the action bar and its keyboard/gamepad route show before
 * `endTurn` actually goes out, so a player doesn't hand the villain a free turn by fat-fingering it (Settings ▸
 * "Confirm before ending turn", `view/settings-rows.ts`).
 *
 * What counts as "something left" is read straight off the engine's own `legalActions` for the turn — never
 * re-derived here: a basic attack, basic thwart or basic recover for the player's own identity, or a basic
 * attack/thwart for any ally they control. Deliberately *not* counted: a playable card in hand, or a usable
 * optional ability — `legalActions` says yes to those almost every turn (a resource ability, a card that costs
 * nothing), which would make the prompt fire on every single turn and train the player to click through it
 * without reading it.
 */
import {
  getPlayer,
  type GameState,
  type InstanceId,
  type LegalAction,
  type LegalActions,
  type PlayerId,
} from "@mc/engine";
import { cardName } from "./names.js";

export interface EndTurnConfirm {
  /** One line per thing still open, in the engine's own action order: "Attack", "Thwart (Spectrum)", … */
  readonly items: readonly string[];
  /** The full sentence the confirm dialog shows. */
  readonly sentence: string;
}

/**
 * `null` when there is nothing meaningful left (or `legal` isn't a live turn for `playerId`), which the caller
 * reads as "end the turn immediately, the old way".
 */
export function endTurnConfirmOf(state: GameState, legal: LegalActions, playerId: PlayerId): EndTurnConfirm | null {
  if (legal.kind !== "turn") return null;
  const identityId = getPlayer(state, playerId)?.identity.instanceId;
  const items = legal.legal
    .map((entry) => itemLabel(state, entry, identityId))
    .filter((label): label is string => label !== null);
  if (items.length === 0) return null;
  return { items, sentence: `End your turn? You can still: ${items.join(", ")}.` };
}

function itemLabel(state: GameState, entry: LegalAction, identityId: InstanceId | undefined): string | null {
  const ref = entry.action;
  if (ref.kind === "basicRecover") return "Recover";
  if (ref.kind === "basicAttack") return powerLabel(state, "Attack", ref.instanceId, identityId);
  if (ref.kind === "basicThwart") return powerLabel(state, "Thwart", ref.instanceId, identityId);
  return null;
}

function powerLabel(
  state: GameState,
  verb: "Attack" | "Thwart",
  instanceId: InstanceId,
  identityId: InstanceId | undefined,
): string {
  return instanceId === identityId ? verb : `${verb} (${cardName(state, instanceId)})`;
}
