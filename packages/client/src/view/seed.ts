/**
 * The Title screen's seed field's input rule.
 *
 * A seed is the engine's shuffle key (PLAN.md Phase 1: `GameLog` + `replay()`
 * make a game reproducible from it), so typing one in has to be validated
 * before it ever reaches `store.start` — an unparsable value must not silently
 * fall back to some other number and start a game the player can't reproduce.
 */

/**
 * Parses a seed field's text. `null` means "not a legal seed yet", which is
 * a different answer from `0` — a field the player is still typing into (or
 * has cleared) must not be read as the seed zero.
 */
export function parseSeed(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  // Digits only: no sign, no decimal point, no exponent. `McTextInput`'s
  // numeric filter already keeps keystrokes to this shape, so this is the
  // second, authoritative check — the one thing that must never be skipped.
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}
