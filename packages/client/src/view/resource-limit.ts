/**
 * "Generate a [wild] resource for an aspect card" (Finesse 04033) and the other resource abilities that pay for only one
 * kind of card (`generatesFor` in the engine), in words a player reads: the payment strip's tag on such a card when it
 * can't pay for the card being played, the inspect panel's note, and the rules glossary's "Aspect card" entry (issue
 * #292). The kind of card is read from the printed text, the same words the player sees on the card.
 */

/**
 * What an "aspect card" is (RRG 1.8 "Aspect Card", p. 8). A hero's own cards are not aspect cards unless they print an
 * aspect too: Spider-Woman's Venom Blast prints Aggression, her Self-Propelled Glide prints none. The aspects are named
 * by example, not listed: RRG 1.8 counts four in one sentence and five ('Pool) in the next (docs/phase7-wave7.md).
 */
export const ASPECT_CARD_DEFINITION =
  "A player card that shows an aspect, such as Aggression, Justice, Leadership or Protection. Basic cards and a " +
  "hero's own cards are not aspect cards, unless a hero card also prints an aspect (Spider-Woman's Venom Blast " +
  "shows Aggression; her Self-Propelled Glide shows none). A resource made only for an aspect card, such as " +
  "Finesse's, can't pay for anything else.";

/** The kind of card a resource ability's text pays for: "an aspect card", "an Attack event"; null when it names none. */
export function resourceLimitOf(text: string): string | null {
  const match = /resources? for (an? [^.,;]+?)(?: and |[.,;]|$)/i.exec(text.replace(/\[([^\]]+)\]/g, "$1"));
  return match ? match[1]!.trim() : null;
}

/** Why a resource can't pay for the card being paid for: "Pays only for an aspect card". */
export function notForReason(text: string): string {
  const limit = resourceLimitOf(text);
  if (!limit) return "Can't pay for this card";
  const aspect = /\baspect card\b/i.test(limit) ? ": one that shows an aspect, such as Aggression or Justice" : "";
  return `Pays only for ${limit}${aspect}`;
}
