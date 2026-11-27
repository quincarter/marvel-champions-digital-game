/**
 * A panel button keeps its element, and a finger already down on it, across a redraw. When the same key now means
 * another command (Ask became Leave once the host granted the seat), the press was armed for the old one: its lift must
 * do nothing. `staleKeys` names the keys whose meaning changed between two draws.
 */
export function staleKeys(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): string[] {
  const stale: string[] = [];
  for (const [key, meaning] of after) {
    const was = before.get(key);
    if (was !== undefined && was !== meaning) stale.push(key);
  }
  return stale;
}

/** What a button means right now: its command and target, then how it looks (a look-alike for another target differs). */
export const commandMeaning = (target: string, look: string, label: string, enabled: boolean): string =>
  `${target}#${look}|${label}|${enabled}`;
