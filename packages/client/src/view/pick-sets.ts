/**
 * Building an "any number" pick one card at a time (issue #966, Enhanced Combat Sense) out of the sets the engine
 * offers. Up to eight candidates the engine offers every set, so every tap changes only the card tapped. Past eight it
 * caps the list, and a tap never picks a card the player did not tap: adding a card that makes a set the engine does
 * not list changes nothing (its tile says so), and taking a card out of such a set clears the whole pick, so a picked
 * card can always be put back and no card is exhausted by surprise. Shared by the pay bar (`payment-model.ts`) and the
 * payment sheet (`spend-choice.ts`).
 */

const keyOf = (ids: Iterable<string>): string => [...ids].sort().join(",");

/**
 * The offered set a tap on `card` lands on, from `current` (what is picked now), or undefined when adding it makes a
 * set the engine does not list. `[]` is no pick.
 */
export function nextPickSet<T extends string>(
  offered: readonly (readonly T[])[],
  current: readonly T[],
  card: T,
): readonly T[] | undefined {
  const removing = current.includes(card);
  const target = removing ? current.filter((id) => id !== card) : [...current, card];
  if (target.length === 0) return [];
  const key = keyOf(target);
  const exact = offered.find((set) => keyOf(set) === key);
  if (exact) return exact;
  return removing ? [] : undefined;
}
