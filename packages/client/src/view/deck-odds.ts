/**
 * The deck builder's odds (issue #531): for a group of cards in the deck (one title, the resources, a type, a trait,
 * the cards that give a resource icon), how likely a draw of N cards holds 0, 1, 2 ... of them. Black Cat's "discard
 * the top 2 cards of your deck, add each resource to your hand" is "Resources, 2 cards"; a Requirement's chance of
 * being paid from hand is "gives [physical], N cards". Plain hypergeometric odds over the deck as built, before any
 * card is drawn or shuffled away. Pure: the scene draws what this returns.
 */
import type { AnyCard, Deck, ResourceIconType } from "@mc/content";
import { resourceIconsOf, traitLabelOf } from "./deck-builder-model.js";

export interface OddsGroup {
  readonly id: string;
  readonly label: string;
  /** Copies in the deck that belong to the group. */
  readonly count: number;
}

const ICONS: readonly ResourceIconType[] = ["physical", "mental", "energy", "wild"];
const TYPE_LABELS: Readonly<Record<string, string>> = {
  ally: "Allies",
  event: "Events",
  support: "Supports",
  upgrade: "Upgrades",
  resource: "Resource cards",
  player_side_scheme: "Side schemes",
};
const capitalized = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** The deck's drawable cards, one entry per copy; a line whose card the pool lacks, or a Permanent or Setup card, is left out. */
export function deckCopiesOf(deck: Deck, cardOf: (id: string) => AnyCard | undefined): readonly AnyCard[] {
  return deck.cards.flatMap((line) => {
    const card = cardOf(line.cardId as string);
    // A Permanent card is set aside before setup (RRG 1.8 "Permanent", p. 32) and a Setup card starts in play
    // (Appendix II, step 11, before the draw at step 14): neither is ever drawn.
    if (!card || ("keywords" in card && card.keywords.some((k) => k.name === "setup" || k.name === "permanent")))
      return [];
    return Array.from({ length: line.quantity }, () => card);
  });
}

/**
 * The groups worth asking about, in this order: each resource icon a card gives (a wild icon pays any, so it counts
 * toward every icon), each card type, each trait, then each title. Empty groups are left out.
 */
export function oddsGroupsOf(copies: readonly AnyCard[]): readonly OddsGroup[] {
  const groups: OddsGroup[] = [];
  const add = (id: string, label: string, test: (card: AnyCard) => boolean): void => {
    const count = copies.filter(test).length;
    if (count > 0) groups.push({ id, label, count });
  };
  for (const icon of ICONS) {
    const gives = (card: AnyCard): boolean => {
      const icons = resourceIconsOf(card);
      return (icons[icon] ?? 0) > 0 || (icon !== "wild" && (icons.wild ?? 0) > 0);
    };
    add(`icon:${icon}`, icon === "wild" ? "Wild icon" : `${capitalized(icon)} +wild`, gives);
  }
  for (const type of Object.keys(TYPE_LABELS)) add(`type:${type}`, TYPE_LABELS[type]!, (card) => card.type === type);
  const traits = [...new Set(copies.flatMap((card) => ("traits" in card ? (card.traits as readonly string[]) : [])))];
  for (const trait of traits.sort((a, b) => a.localeCompare(b)))
    add(`trait:${trait}`, capitalized(traitLabelOf(trait).toLowerCase()), (card) =>
      "traits" in card ? (card.traits as readonly string[]).includes(trait) : false,
    );
  const titles = [...new Set(copies.map((card) => card.name))].sort((a, b) => a.localeCompare(b));
  for (const title of titles) add(`title:${title}`, title, (card) => card.name === title);
  return groups;
}

/** n choose k, exactly for the small numbers a deck has (k ≤ 60). */
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++) result = (result * (n - i + 1)) / i;
  return result;
}

/**
 * The chance a draw of `draws` cards from a deck of `deckSize`, `hits` of which are in the group, holds exactly 0, 1,
 * ... `min(draws, hits)` of them. Draws past the deck's size draw the whole deck.
 */
export function drawOdds(deckSize: number, hits: number, draws: number): readonly number[] {
  const n = Math.max(0, Math.min(draws, deckSize));
  const total = choose(deckSize, n);
  if (total === 0) return [1];
  return Array.from(
    { length: Math.min(n, hits) + 1 },
    (_, k) => (choose(hits, k) * choose(deckSize - hits, n - k)) / total,
  );
}

/** "41%", or "<1%" / ">99%" at the edges so a near-certainty never reads as a certainty. */
export function percentText(p: number): string {
  if (p <= 0) return "0%";
  if (p >= 1) return "100%";
  const rounded = Math.round(p * 100);
  if (rounded === 0) return "<1%";
  if (rounded === 100) return ">99%";
  return `${rounded}%`;
}

/** The odds as display rows: "0", "1", "2", then "3+" folding the rest; and the chance of at least one. */
export function oddsRowsOf(odds: readonly number[]): {
  readonly rows: readonly { readonly label: string; readonly p: number }[];
  readonly atLeastOne: number;
} {
  const shown = odds.slice(0, 3).map((p, k) => ({ label: `${k}`, p }));
  const rest = odds.slice(3).reduce((sum, p) => sum + p, 0);
  return {
    rows: odds.length > 3 ? [...shown, { label: "3+", p: rest }] : shown,
    atLeastOne: 1 - (odds[0] ?? 1),
  };
}
