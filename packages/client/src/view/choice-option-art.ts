/**
 * The picture a text-row decision draws beside an option (the owner, 2026-10-29: "Choose a player" read as a list of
 * names): the hero's identity card for a player, the card itself for a villain, minion, scheme or any card in play, and
 * the card an ability belongs to. An option with nothing on the table to show (a number, "Let it resolve", a facedown
 * card) has none.
 *
 * Pure: `scenes/choice.ts` requests and draws the art.
 */
import { cardOf, type ChoiceRef, type GameState, type InstanceId } from "@mc/engine";
import { artFor, type ArtSource } from "../art/art-source.js";
import { faceOf } from "./board-model.js";

/** The card instance whose face stands for an option, or null for one with no card on the table. */
export function optionArtInstance(game: GameState, ref: ChoiceRef): InstanceId | null {
  switch (ref.kind) {
    case "player":
      return game.players.find((player) => player.playerId === ref.playerId)?.identity.instanceId ?? null;
    case "card":
    case "ability":
      return cardOf(game, ref.instanceId) ? ref.instanceId : null;
    default:
      return null;
  }
}

/** The option's picture, as the table shows that card now (its face up, the back of one that is facedown). */
export function optionArtOf(game: GameState, ref: ChoiceRef): ArtSource | null {
  const id = optionArtInstance(game, ref);
  return id === null ? null : artFor(cardOf(game, id), faceOf(game, id));
}
