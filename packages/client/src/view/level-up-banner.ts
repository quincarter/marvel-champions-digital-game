/**
 * The band for a progressing identity levelling up (Ironheart's Level Up!, docs/phase7-wave5.md §3.23): the identity
 * card swaps to its next version, which changes her stats and abilities between two frames. It is the phase/round band
 * that wipes across the table (`MotionController.announceLevelUp`), in its `levelUp` colors, so it respects reduced
 * motion the way that band does.
 */
import { getCard, type GameEvent, type GameState } from "@mc/engine";

/** One caption per identity swapped to its next version by the events of a command, in order. */
export function levelUpCaptions(events: readonly GameEvent[], state: GameState): readonly string[] {
  const captions: string[] = [];
  for (const event of events) {
    if (event.type !== "identitySwapped") continue;
    const card = getCard(state, event.toCardId);
    const versions = card?.type === "hero_identity" ? card.progressingIdentity?.versions : undefined;
    const at = versions?.indexOf(event.toCardId) ?? -1;
    const name = (card?.name ?? "Your hero").toUpperCase();
    captions.push(
      at >= 0 && versions ? `${name} LEVELS UP! · VERSION ${at + 1} OF ${versions.length}` : `${name} LEVELS UP!`,
    );
  }
  return captions;
}
