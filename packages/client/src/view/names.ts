/**
 * Human names for the things the engine refers to by id.
 *
 * Every name comes from `@mc/content` through the state's card pool — the
 * design canvases' card text is placeholder, so nothing here invents a label
 * (PLAN.md Phase 4, "the client must render every name, stat and rules text
 * from `@mc/content`").
 */

import type { HeroIdentityCard } from "@mc/content";
import {
  cardOf,
  currentName,
  getInstance,
  getPlayer,
  identityFace,
  type Form,
  type GameState,
  type InstanceId,
  type PlayerId,
  type ViewerContext,
} from "@mc/engine";
import { cardDisplayName, heroFaceDisplayName, qualifiedHeroName } from "./hero-names.js";
import { faceVisible } from "./visibility.js";

/**
 * A card's name. A card whose face this table can't see is named for what it is
 * treated as ("Drone"), because that is all the players can see; one that is
 * nothing in particular reads as "a facedown card". What counts as unseeable is
 * `faceVisible`'s call, so the log and the Inspect sheet agree — a card in your
 * own hand is not a mystery to you just because the engine doesn't call it
 * faceup.
 */
export function cardName(state: GameState, id: InstanceId, view?: ViewerContext): string {
  const instance = getInstance(state, id);
  if (!instance) return "something";
  if (!faceVisible(state, id, view)) {
    if (instance.facedownAs) return instance.facedownAs.traits.join(" ") || "facedown minion";
    return "a facedown card";
  }
  return identityNameOf(state, id) ?? cardOf(state, id)?.name ?? "a card";
}

/**
 * THE helper for "which face of this identity is showing", by name: the name printed on the face of a hero
 * identity instance that is up right now, straight from the engine's own `identityFace` (so the alter-ego side,
 * the hero side and every additional hero form — Spectrum's energy/density/mass, Ant-Man's Giant — are the live
 * one, never a client guess). Null when `id` is not a seated player's identity card. The hero side is qualified
 * ("Spider-Man (Peter Parker)") the way every other hero name is. Art goes through `board-model`'s `faceOf`, which
 * reads the same `form`/`heroFormIndex`. `cardName` answers with this for an identity, so the engine's own option
 * labels (`card.name`, always the hero side) are not what a log line, a prompt or a thumbnail prints.
 */
export function identityNameOf(state: GameState, id: InstanceId): string | null {
  const player = state.players.find((seat) => seat.identity.instanceId === id);
  const card = player ? cardOf(state, id) : undefined;
  if (!player || card?.type !== "hero_identity") return null;
  const { form, face } = identityFace(state, player);
  return form === "hero" ? qualifiedHeroName(card, face.faceName) : face.faceName;
}

/**
 * What to print for a pending choice's option. The engine labels every card option with `card.name` (`resolve/
 * window.ts`'s `candidateOption`, the target and card pickers), which for a hero identity is always the hero side —
 * "She-Hulk" for Jennifer Walters' "I Object!" while she is in alter-ego form. A card or ability option names the
 * card the way `cardName` does (the face in play); a seat is named by `playerOptionLabel`'s own callers; everything
 * else keeps the engine's own label ("Remove 1 threat counter", a branch).
 */
export function optionLabelOf(
  state: GameState | null | undefined,
  option: { readonly label: string; readonly ref: { readonly kind: string; readonly instanceId?: InstanceId } },
): string {
  if (!state || (option.ref.kind !== "card" && option.ref.kind !== "ability") || !option.ref.instanceId) {
    return option.label;
  }
  return identityNameOf(state, option.ref.instanceId) ?? option.label;
}

/** The name printed on one face of a hero identity: the (qualified) hero name, or the alter-ego's. */
export function identityFaceName(card: HeroIdentityCard, form: Form): string {
  return form === "hero" ? heroFaceDisplayName(card) : card.alterEgo.faceName;
}

/**
 * The name printed on the face that is currently up.
 *
 * For every card but a hero identity this is just the card's name. For an identity it is the live side — "Steve
 * Rogers", not "Captain America" — which matters wherever the client attributes something to that card's text:
 * Living Legend is printed on the alter-ego side, so a player told "Captain America made this cheaper" would go
 * looking at the wrong face for the wrong reason. The engine's `currentName` answers with the card's name and
 * has no way to say this.
 */
export function faceUpName(state: GameState, id: InstanceId): string {
  const identityName = identityNameOf(state, id);
  if (identityName) return identityName;
  // `currentName` covers the other double-sided cards — a villain's active side, a flipped encounter card.
  return (faceVisible(state, id) ? currentName(state, id) : undefined) ?? cardName(state, id);
}

/** A seat's name: the identity's card name ("Captain Marvel", "Spider-Man (Miles Morales)"), not "player 2". */
export function playerName(state: GameState, id: PlayerId): string {
  const player = getPlayer(state, id);
  if (!player) return id;
  const card = cardOf(state, player.identity.instanceId);
  return card ? cardDisplayName(card) : id;
}

/**
 * A seat named by both faces of its identity — "Spider-Man / Peter Parker" —
 * for a decision that picks a seat. The identity card's own name alone reads
 * the same whichever face is up, and "p2" means nothing at the table.
 */
export function seatIdentityName(state: GameState, id: PlayerId): string {
  const player = getPlayer(state, id);
  if (!player) return id;
  const card = cardOf(state, player.identity.instanceId);
  if (!card || card.type !== "hero_identity") return playerName(state, id);
  return `${card.hero.faceName} / ${card.alterEgo.faceName}`;
}

/**
 * A seat's name from the reader's side of the table: their own seat is "you",
 * everyone else is named. The design canvas's log reads "You played Stun",
 * so the perspective seat has to be addressed in the second person.
 */
export function seatName(state: GameState, id: PlayerId, perspectiveId: PlayerId | null): string {
  return id === perspectiveId ? "You" : playerName(state, id);
}
