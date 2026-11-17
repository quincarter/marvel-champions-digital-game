/**
 * The stats printed with a star beside them on the face of a card that is up (issue #766): a star by ATK or SCH marks
 * an ability tied to that activation (a Forced Interrupt when the villain attacks, a Forced Response after it schemes).
 * Read from the card data's `statStars` (MarvelCDB's `*_star` flags), per face: a villain's current stage, an identity's
 * hero or alter-ego face, a flipped card's back. A facedown card shows no stars, as it shows no printed numbers.
 */

import type { StatStar } from "@mc/content";
import {
  cardOf,
  getInstance,
  identityFace,
  looseVillainStage,
  villainStageOf,
  type GameState,
  type InstanceId,
} from "@mc/engine";

const NONE: readonly StatStar[] = [];

export function statStarsOf(state: GameState, id: InstanceId): readonly StatStar[] {
  const instance = getInstance(state, id);
  const card = cardOf(state, id);
  if (!instance || !card || instance.facedownAs || instance.faceup === false) return NONE;
  if (card.type === "villain") {
    const stage = state.villains.some((villain) => villain.instanceId === id)
      ? villainStageOf(state, id)
      : looseVillainStage(state, id);
    return stage?.statStars ?? NONE;
  }
  if (card.type === "hero_identity") {
    const player = state.players.find((candidate) => candidate.identity.instanceId === id);
    return (player ? identityFace(state, player).face.statStars : undefined) ?? NONE;
  }
  const flipSide = "flipSide" in card ? card.flipSide : undefined;
  if (instance.flipped && flipSide) return ("statStars" in flipSide ? flipSide.statStars : undefined) ?? NONE;
  return ("statStars" in card ? card.statStars : undefined) ?? NONE;
}
