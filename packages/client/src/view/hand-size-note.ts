/**
 * "Are you sure?" before ending a turn on a small hand size (issue #150). Iron Man's hero side prints a hand size of
 * 1 and gets +1 for each Tech upgrade he controls, so with none out a hand of 1 is already full and the end-of-phase
 * draw (RRG 1.8 "End of Player Phase", p. 18, step 2) adds nothing. That read as a missed draw, so a player ending a
 * turn on a hand size under `SMALL_HAND_SIZE` is told the number and what makes it: the printed value on the face that
 * is up, every modifier in play (with the sentence of the card's text that grants it, at what it gives now) and the
 * other face's printed value when it differs.
 *
 * Every number is the engine's own (`handSize`, `modifiersFor`, `handCountTowardHandSize`); nothing is re-derived.
 * This confirm is not behind Settings ▸ "Confirm before ending turn": the owner asked for it on every such turn.
 */
import {
  cardOf,
  getPlayer,
  handCountTowardHandSize,
  handSize,
  heroFacesOf,
  identityFace,
  modifiersFor,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardTextDisplay } from "./card-text-display.js";
import { faceUpName, seatFormName } from "./names.js";

/** A hand size below this asks before the turn ends ("less than like 3 or 4 cards", the owner, 2026-10-15). */
export const SMALL_HAND_SIZE = 4;

export interface HandSizeNote {
  readonly handSize: number;
  /** Cards held that count toward hand size. */
  readonly held: number;
  /** What the end-of-phase draw would add now (it may still change: a discard, a card played by someone else). */
  readonly willDraw: number;
  /** "Printed hand size 1 (Iron Man).", then one line per modifier, then the other face's printed value. */
  readonly why: readonly string[];
}

export function handSizeNoteOf(state: GameState, playerId: PlayerId, deps: EngineDeps): HandSizeNote | null {
  const player = getPlayer(state, playerId);
  if (!player) return null;
  const size = handSize(state, playerId, deps);
  const held = handCountTowardHandSize(state, playerId, deps);
  const { form, face } = identityFace(state, player);
  const identityId = player.identity.instanceId;
  const why = [`Printed hand size ${face.handSize} (${seatFormName(state, playerId)}).`];
  for (const modifier of modifiersFor(state, deps, identityId, "handSize")) {
    const source = modifier.sourceInstanceId;
    const name = source ? faceUpName(state, source) : "A lasting effect";
    const amount = modifier.setBase ? `sets it to ${modifier.amount}` : `${signed(modifier.amount)} now`;
    const sentence = source ? handSizeSentence(state, source, identityId, face.text.current) : null;
    why.push(sentence ? `${name}: ${amount}. "${sentence}"` : `${name}: ${amount}.`);
  }
  why.push(...otherFaces(state, identityId, form, face.handSize));
  return { handSize: size, held, willDraw: Math.max(0, size - held), why };
}

/** The confirm's body, or null when the hand size is `SMALL_HAND_SIZE` or more. */
export function smallHandSizeConfirmOf(state: GameState, playerId: PlayerId, deps: EngineDeps): string | null {
  const note = handSizeNoteOf(state, playerId, deps);
  if (!note || note.handSize >= SMALL_HAND_SIZE) return null;
  const name = seatFormName(state, playerId);
  // RRG 1.8 "End of Player Phase" (p. 18) step 1 comes first: a hand over its size is discarded down to it.
  const draws =
    note.held > note.handSize
      ? `you hold ${note.held}, so you will discard down to ${note.handSize} and draw nothing`
      : note.willDraw === 0
        ? `you hold ${note.held}, so the end-of-turn draw adds nothing`
        : `you hold ${note.held}, so the end-of-turn draw adds ${note.willDraw}`;
  return `${name}'s hand size is only ${note.handSize}: ${draws}.\n${note.why.join("\n")}`;
}

/** The sentence of a modifier's source text that mentions hand size, as a reader sees it. */
function handSizeSentence(
  state: GameState,
  source: InstanceId,
  identityId: InstanceId,
  identityText: string,
): string | null {
  const card = cardOf(state, source);
  const text = source === identityId ? identityText : card && "text" in card ? card.text.current : "";
  const sentence = text
    .split(/(?<=[.!?])\s+/)
    .find((part) => /hand size/i.test(part))
    ?.trim();
  return sentence ? cardTextDisplay(sentence) : null;
}

/** "Tony Stark (alter-ego): printed hand size 6." for each other face whose printed value differs. */
function otherFaces(state: GameState, identityId: InstanceId, form: "hero" | "alterEgo", printed: number): string[] {
  const card = cardOf(state, identityId);
  if (card?.type !== "hero_identity") return [];
  const faces = [
    ...(form === "hero" ? [] : heroFacesOf(card).map((f) => ({ name: f.faceName, side: "hero", size: f.handSize }))),
    ...(form === "alterEgo" ? [] : [{ name: card.alterEgo.faceName, side: "alter-ego", size: card.alterEgo.handSize }]),
  ];
  return faces.filter((f) => f.size !== printed).map((f) => `${f.name} (${f.side}): printed hand size ${f.size}.`);
}

const signed = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);
