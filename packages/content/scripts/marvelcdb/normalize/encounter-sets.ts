/** Step 8: encounter sets, named from the records that belong to them. */
import type { EncounterSet } from "../../../src/schema/index.ts";
import { brand } from "./brand.ts";
import type { NormalizeContext } from "./context.ts";

/**
 * Wave 2 (docs/phase7-wave2.md §1.4/§5.1): a campaign-specific card's set is still an `EncounterSet` — the Hydra
 * Campaign upgrades' `hydra_camp` and the campaign obligations' `expcamp` — just marked `campaignSpecific`, and
 * built from records this function otherwise skips (a player-side `faction_code`, or `type_code: "obligation"`).
 */
function campaignSetCode(r: {
  readonly faction_code: string;
  readonly type_code: string;
  readonly card_set_code?: string | null;
}): string | undefined {
  return r.faction_code === "campaign" && r.card_set_code ? r.card_set_code : undefined;
}

export function normalizeEncounterSets(ctx: NormalizeContext): {
  encounterSets: EncounterSet[];
  setNames: Map<string, string>;
} {
  const setNames = new Map<string, string>();
  const campaignSets = new Set<string>();
  for (const r of ctx.topLevel) {
    const campaignSet = campaignSetCode(r);
    if (campaignSet) campaignSets.add(campaignSet);
    else if (r.faction_code !== "encounter" || r.type_code === "obligation" || !r.card_set_code) continue;
    const code = campaignSet ?? r.card_set_code;
    if (!code) continue;
    const prev = setNames.get(code);
    const name = r.card_set_name ?? code;
    if (prev !== undefined && prev !== name) ctx.errors.push(`set ${code} has two names: ${prev} / ${name}`);
    setNames.set(code, name);
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
        ...(campaignSets.has(id) ? { campaignSpecific: true } : {}),
        // Wave 2 (docs/phase7-wave2.md §6.3): the Civil War rulebook, "Custom Scenario Expansion" (p. 3) — Standard
        // PvP "replaces the standard encounter set when playing in competitive mode". Competitive mode is not
        // built; `validateScenarioEncounterSets` refuses a standalone scenario that names this set.
        ...(id === "standard_pvp" ? { competitiveOnly: true } : {}),
      };
    });
  return { encounterSets, setNames };
}
