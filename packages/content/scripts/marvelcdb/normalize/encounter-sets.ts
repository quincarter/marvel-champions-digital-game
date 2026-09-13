/** Step 8: encounter sets, named from the records that belong to them. */
import type { EncounterSet } from "../../../src/schema/index.ts";
import { brand } from "./brand.ts";
import type { NormalizeContext } from "./context.ts";

export function normalizeEncounterSets(ctx: NormalizeContext): { encounterSets: EncounterSet[]; setNames: Map<string, string> } {
  const setNames = new Map<string, string>();
  for (const r of ctx.topLevel) {
    if (r.faction_code !== "encounter" || r.type_code === "obligation" || !r.card_set_code) continue;
    const prev = setNames.get(r.card_set_code);
    const name = r.card_set_name ?? r.card_set_code;
    if (prev !== undefined && prev !== name) ctx.errors.push(`set ${r.card_set_code} has two names: ${prev} / ${name}`);
    setNames.set(r.card_set_code, name);
  }
  const encounterSets: EncounterSet[] = [...setNames.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, name]) => {
      const hero = id.endsWith("_nemesis") ? ctx.heroBySet.get(id.slice(0, -"_nemesis".length)) : undefined;
      return {
        id: brand("encounterSet", id),
        name,
        packCodes: [ctx.setCode],
        ...(hero ? { nemesisOfIdentityId: brand("card", hero.code) } : {}),
      };
    });
  return { encounterSets, setNames };
}
