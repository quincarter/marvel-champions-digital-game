/**
 * A main scheme per player, each in its player's play area (docs/phase7-wave11-scenarios.md §S3.1).
 *
 * Protection Racket 1A, Setup: "Each player chooses a single Protection Racket main scheme (at random in expert mode),
 * places it in their play area, and flips it to its 1B side. Set each unused main scheme aside, out of play." Setup
 * makes each pick a `MainSchemeState` with `playArea` set (`GameSetupConfig.mainSchemeChoice`): the first seat's as
 * `GameState.mainScheme`, the others in `extraMainSchemes`, so every reader of "the main schemes in play" (step one's
 * threat, completion, basic thwart targets) already sees them all.
 *
 * MC60 p. 13, "Separate Main Schemes", says which one "the main scheme" is:
 * - "When a player plays an event or reveals a treachery that refers to 'the main scheme,' that card only applies to
 *   the main scheme in that player's play area. Cards in a player's play area (identities, allies, upgrades, minions,
 *   etc.) that refer to 'the main scheme' refer only to the main scheme in the same play area."
 * - "Cards that are not in any player's play area (the villain, side schemes, and environments) that refer to 'the
 *   main scheme' apply to **all** main schemes."
 * - "Cards and effects that refer to 'a scheme,' including basic thwarts, can affect any main scheme in play."
 * - "When an acceleration token would be placed on the main scheme … place that acceleration token near the villain.
 *   Each acceleration token adds 1 additional threat to **each** main scheme during step 1 of each villain phase."
 *
 * RRG 1.8 "Play Area" (p. 33): "A player's play area contains that player's identity, deck, hand, discard pile, any
 * cards in play under their control, and any faceup or facedown encounter cards in their play area (such as engaged
 * minions or encounter cards that have been dealt to them)"; "The villain's play area contains … any encounter cards
 * in play that have not entered a player's play area (such as side schemes or environments)."
 *
 * `mainSchemesFor` is the one reader of that rule. Every "the main scheme" reader in a game with per-player schemes
 * goes through it (`TargetRef mainScheme`, incite, the off-scheme acceleration tokens of step one).
 */

import type { InstanceId, PlayerId } from "./ids.js";
import { locateCard, sharedMainSchemes, villainOf } from "./query.js";
import type { GameState, MainSchemeState } from "./state.js";

/** Whether this game has a main scheme per player (`GameSetupConfig.mainSchemeChoice`). */
export const hasPerPlayerMainSchemes = (state: GameState): boolean =>
  sharedMainSchemes(state).some((scheme) => scheme.playArea !== undefined);

/** The main scheme in this player's play area, if the game has one there. */
export const mainSchemeInPlayAreaOf = (state: GameState, playerId: PlayerId): MainSchemeState | undefined =>
  sharedMainSchemes(state).find((scheme) => scheme.playArea === playerId);

/** The player whose play area this main scheme is in, or null for a scheme in no player's play area. */
export const mainSchemePlayAreaOf = (state: GameState, id: InstanceId): PlayerId | null =>
  sharedMainSchemes(state).find((scheme) => scheme.instanceId === id)?.playArea ?? null;

/**
 * Where a card is for "the main scheme" (RRG 1.8 "Play Area", p. 33): in a player's play area (that player), in play
 * outside every player's play area (`"noPlayArea"`: the villain, a side scheme or environment in the villain's area, a
 * scheme in no play area), or out of play (`"outOfPlay"`: an encounter deck or discard pile, the victory display, the
 * shared set-aside area). An attachment, a boost card or a tucked card is where its host is.
 *
 * A player's hand, deck, discard pile, set-aside cards and the cards they are resolving are in their play area too:
 * an event being played and a treachery being revealed are the "event played … by a player" and the "treachery
 * revealed by a player" of MC60 p. 13.
 */
export function playAreaHolding(state: GameState, id: InstanceId): PlayerId | "noPlayArea" | "outOfPlay" {
  const scheme = sharedMainSchemes(state).find((candidate) => candidate.instanceId === id);
  if (scheme) return scheme.playArea ?? "noPlayArea";
  const zone = locateCard(state, id);
  if (!zone) return villainOf(state, id) ? "noPlayArea" : "outOfPlay";
  switch (zone.kind) {
    case "attachment":
    case "boost":
    case "tucked":
      return zone.hostInstanceId === id ? "outOfPlay" : playAreaHolding(state, zone.hostInstanceId);
    case "identity":
    case "hand":
    case "deck":
    case "discard":
    case "playArea":
    case "dealtEncounter":
    case "resolving":
    case "setAside":
    case "separateDeck":
    case "separateDiscard":
      return zone.playerId;
    case "villainArea":
    case "scenarioPlayArea":
      return "noPlayArea";
    default:
      return "outOfPlay";
  }
}

/** Who reads "the main scheme": the card whose text it is, and the player resolving it (`EffectContext` fits). */
export interface MainSchemeSpeaker {
  readonly selfInstanceId: InstanceId | null;
  readonly controllerId: PlayerId | null;
  /** "That player" inside `forEachPlayer`, read before the controller for a card out of play. */
  readonly scopedPlayerId?: PlayerId | null;
}

/**
 * "The main scheme" for a speaker, in a game with a main scheme per player (MC60 p. 13): a card in a player's play
 * area means the scheme in that play area; a card in play outside every player's play area, and text with no card
 * (scenario and campaign instructions), mean every main scheme. A card out of play (an encounter card in the discard
 * pile whose ability still resolves) is read for the player resolving it, else for every scheme.
 *
 * A player whose play area holds no main scheme (none was ever placed there) gets none. In any other game this returns
 * every main scheme in the shared game area, which the callers read only once they know the game is a per-player one.
 */
export function mainSchemesFor(state: GameState, speaker: MainSchemeSpeaker): readonly InstanceId[] {
  const schemes = sharedMainSchemes(state);
  const all = schemes.map((scheme) => scheme.instanceId);
  if (!hasPerPlayerMainSchemes(state) || speaker.selfInstanceId === null) return all;
  const held = playAreaHolding(state, speaker.selfInstanceId);
  if (held === "noPlayArea") return all;
  const player = held === "outOfPlay" ? (speaker.scopedPlayerId ?? speaker.controllerId) : held;
  if (!player) return all;
  const own = schemes.find((scheme) => scheme.playArea === player);
  return own ? [own.instanceId] : [];
}
