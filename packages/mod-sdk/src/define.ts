import { validateDefinition } from "@mc/cards";
import type { AbilityDefinition } from "@mc/engine";

/** A pack ability id: `x.<pack-id>.<card number>.<slug>`, e.g. `x.fan-moon-knight.01a.moonlight-action`. */
export const PACK_ABILITY_ID = /^x\.[a-z0-9]+(?:-[a-z0-9]+)*\.\d+[a-z]?\.[a-z0-9-]+$/;

/**
 * `defineAbilities` for a pack. The base game's `defineAbilities` accepts only `<5-digit code>.<slug>` ids, which a
 * custom card code (`x.<pack-id>.<nn>`) can never be, so a pack keys its abilities as `<card code>.<slug>` through this
 * instead. It runs the same `validateDefinition` and throws on the first problem, so a broken ability fails loudly
 * the first time the pack's `abilities/index.ts` is loaded.
 */
export function definePackAbilities<const T extends Readonly<Record<string, AbilityDefinition>>>(definitions: T): T {
  const problems: string[] = [];
  for (const [id, definition] of Object.entries(definitions)) {
    if (!PACK_ABILITY_ID.test(id)) problems.push(`${id}: not an x.<pack-id>.<card number>.<slug> ability id`);
    for (const problem of validateDefinition(definition)) problems.push(`${id}: ${problem}`);
  }
  if (problems.length > 0) throw new Error(`invalid pack ability definitions:\n  ${problems.join("\n  ")}`);
  return definitions;
}
