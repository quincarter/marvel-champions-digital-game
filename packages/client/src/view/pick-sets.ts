/**
 * Building an "any number" pick one card at a time (issue #966, Enhanced Combat Sense) out of the sets the engine
 * offers. Up to six candidates the engine offers every set; past that it caps the list, so the set a tap asks for may
 * not be one of them. Then the tap lands on the nearest offered set instead of doing nothing: adding a card takes the
 * smallest offered set holding everything asked for, and taking one out takes the largest offered set inside what is
 * left (the empty set, no pick, at worst), so every tile can always be picked and unpicked. Shared by the pay bar
 * (`payment-model.ts`) and the payment sheet (`spend-choice.ts`).
 */

const keyOf = (ids: Iterable<string>): string => [...ids].sort().join(",");

/**
 * The offered set a tap on `card` lands on, from `current` (what is picked now), or undefined when no offered set holds
 * the card with the cards already picked. `[]` is no pick.
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
  if (removing) {
    const inside = offered.filter((set) => set.length > 0 && set.every((id) => target.includes(id)));
    return inside.reduce<readonly T[]>((best, set) => (set.length > best.length ? set : best), []);
  }
  const around = offered.filter((set) => target.every((id) => set.includes(id)));
  return around.reduce<readonly T[] | undefined>(
    (best, set) => (!best || set.length < best.length ? set : best),
    undefined,
  );
}
