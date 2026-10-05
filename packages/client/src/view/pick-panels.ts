/**
 * The two picks a play can ask on the table that are answered with cards or seats rather than a target
 * (`view/targeting-panel.ts`'s tiles, reused so every question of this kind looks and works the same on the desktop
 * and the phone): which cards in play pay a cost that has a range, and whose play area a "play under any player's
 * control" card goes to. Both only word what the engine already listed; neither decides what is legal.
 */

import { cardOf, type EngineDeps, type GameState, type InstanceId, type LegalAction, type PlayerId } from "@mc/engine";
import { characterPanel } from "./board-model.js";
import type { InPlayCostChoiceView } from "./in-play-cost-choice.js";
import { cardName } from "./names.js";
import { artOf, type TargetingPanel, type TargetOption } from "./targeting-panel.js";

/** "ATK 2 · THW 2": the stats worth weighing a pick by, for a character; nothing for a card with none. */
function statsLine(state: GameState, id: InstanceId, deps: EngineDeps): string | null {
  const type = cardOf(state, id)?.type;
  if (type !== "ally" && type !== "minion" && type !== "hero_identity") return null;
  try {
    const stats = characterPanel(state, id, deps)
      .stats.filter((stat) => ["ATK", "THW", "DEF"].includes(stat.label) && stat.value !== "—")
      .map((stat) => `${stat.label} ${stat.value}`);
    return stats.length > 0 ? stats.join(" · ") : null;
  } catch {
    return null;
  }
}

/** The cards that could pay the cost, as tiles to pick and unpick, with the running count and preview. */
export function inPlayCostPanelOf(state: GameState, deps: EngineDeps, view: InPlayCostChoiceView): TargetingPanel {
  const options = view.offered.map((instanceId): TargetOption => {
    const stats = statsLine(state, instanceId, deps);
    const picked = view.picked.has(instanceId);
    return {
      instanceId,
      name: cardName(state, instanceId),
      lines: stats ? [stats] : [],
      confirmLine: picked ? "Tap to put back" : "Tap to pick",
      art: artOf(state, instanceId),
    };
  });
  const steps = view.step.total > 1 ? ` (${view.step.index + 1} of ${view.step.total})` : "";
  return {
    title: `Choose cards to ${view.verb}`,
    heading: `${options.length} CARD${options.length === 1 ? "" : "S"} TO CHOOSE FROM`,
    source: {
      label: `${view.subject}${steps}`,
      name: view.subject,
      instanceId: view.source,
      art: artOf(state, view.source),
    },
    options,
    excluded: [],
    hideExcluded: true,
    multi: {
      picked: view.picked,
      summary: view.summary,
      preview: view.preview,
      canConfirm: view.canConfirm,
      reason: view.reason,
      confirmLabel: view.confirmLabel,
    },
  };
}

/** One seat a card could be played under: its identity card is the tile. */
export interface SeatOption {
  readonly playerId: PlayerId;
  readonly identityId: InstanceId;
  /** The hero's name. */
  readonly name: string;
  /** The other face, so a seat is known by either name. */
  readonly alterEgo: string | null;
  /** The seat asking, whose own area is the default answer. */
  readonly you: boolean;
}

/** Every seat the engine listed (`LegalAction.controllers`), the asking seat first. */
export function seatOptionsOf(
  state: GameState,
  controllers: readonly PlayerId[],
  perspectiveId: PlayerId | null,
): readonly SeatOption[] {
  const seats = controllers.flatMap((playerId): SeatOption[] => {
    const player = state.players.find((seat) => seat.playerId === playerId);
    if (!player) return [];
    const card = cardOf(state, player.identity.instanceId);
    const hero = card?.type === "hero_identity" ? card : null;
    return [
      {
        playerId,
        identityId: player.identity.instanceId,
        name: hero?.hero.faceName ?? cardName(state, player.identity.instanceId),
        alterEgo: hero?.alterEgo.faceName ?? null,
        you: playerId === perspectiveId,
      },
    ];
  });
  return [...seats.filter((seat) => seat.you), ...seats.filter((seat) => !seat.you)];
}

/** "Whose play area?": one tile per seat the card may go to, the asking seat first and highlighted. */
export function seatPanelOf(state: GameState, entry: LegalAction, seats: readonly SeatOption[]): TargetingPanel {
  const played = entry.action.kind === "playCard" ? entry.action.instanceId : null;
  const subject = played ? cardName(state, played) : "This card";
  const options = seats.map((seat): TargetOption => ({
    instanceId: seat.identityId,
    name: seat.name,
    lines: [seat.you ? "You" : (seat.alterEgo ?? "")].filter((line) => line !== ""),
    confirmLine: `Play it in ${seat.name}'s area`,
    art: artOf(state, seat.identityId),
  }));
  const first = seats[0];
  return {
    title: "Whose play area?",
    heading: `${options.length} SEATS`,
    source: {
      label: subject,
      name: subject,
      instanceId: played ?? seats[0]!.identityId,
      art: played ? artOf(state, played) : null,
    },
    options,
    excluded: [],
    hideExcluded: true,
    ...(first ? { defaultId: first.identityId } : {}),
  };
}
