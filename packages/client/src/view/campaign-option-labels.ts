/**
 * Labels for a briefing choice's options: a card's own name, plus what tells it apart when two options share a name
 * (role-building lists the same card from more than one product): its aspect ("Into the Fray · Justice") when the
 * aspects differ, else the product it was printed in ("Armored Vest · Core Set"), since reprints share an aspect.
 */
import type { AnyCard } from "@mc/content";

const titleCase = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

function aspectOf(card: AnyCard): string | null {
  const aspect = (card as { aspect?: string }).aspect;
  if (!aspect || aspect === "none") return null;
  return aspect.startsWith("hero:") ? "Signature" : titleCase(aspect);
}

export function optionLabelsOf(
  options: readonly string[],
  cardOf: (id: string) => AnyCard | undefined,
  packNameOf: (setCode: string) => string = (code) => code,
): ReadonlyMap<string, string> {
  const nameOf = (id: string): string => cardOf(id)?.name ?? id;
  const groups = new Map<string, string[]>();
  for (const id of options) groups.set(nameOf(id), [...(groups.get(nameOf(id)) ?? []), id]);
  const labels = new Map<string, string>();
  for (const id of options) {
    const group = groups.get(nameOf(id))!;
    const card = cardOf(id);
    if (!card || group.length < 2) {
      labels.set(id, nameOf(id));
      continue;
    }
    const aspects = group.map((other) => aspectOf(cardOf(other)!));
    const aspect = aspectOf(card);
    const distinguishes = aspect !== null && new Set(aspects).size === group.length;
    const suffix = distinguishes ? aspect : packNameOf(card.setCode as string);
    labels.set(id, `${nameOf(id)} · ${suffix}`);
  }
  return labels;
}
