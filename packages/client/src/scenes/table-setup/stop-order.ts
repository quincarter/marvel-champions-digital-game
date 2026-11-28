/**
 * The pad and keyboard route's order through Set up the table's focus stops: the page's stops in document order (Back,
 * the difficulties, the option cards, Tower Defense, the modular sets, The Hood's, the seats, the seed, Reroll, the watch
 * toggle, Deal it out), except that "Random" for the first player comes after the last seat, as the route always had it.
 */
const FIRST_PLAYER = "first-player:";
const RANDOM = `${FIRST_PLAYER}random`;

export function stopOrderOf(keys: readonly string[]): readonly string[] {
  const without = keys.filter((key) => key !== RANDOM);
  if (without.length === keys.length) return keys;
  let at = -1;
  without.forEach((key, i) => {
    if (key.startsWith(FIRST_PLAYER)) at = i;
  });
  // No seat in the page (a room's note): Random has nothing to follow.
  if (at < 0) return keys;
  return [...without.slice(0, at + 1), RANDOM, ...without.slice(at + 1)];
}
