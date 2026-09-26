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
      // docs/phase7-wave4.md §1.10: `PackCuration.encounterSets` — the Infinity Gauntlet set's own separate deck
      // (the six Infinity Stones) and its single-villain restriction. Marked used so a stale entry is caught the
      // same way a stale correction/errata is (`checkStaleCuration`).
      const override = ctx.curation.encounterSets?.[id];
      if (override) ctx.usedEncounterSetOverrides.add(id);
      const separateDecks = override?.separateDecks?.map((d) => ({
        name: d.name,
        contents: {
          ...(d.contents.encounterSetCodes
            ? { encounterSetIds: d.contents.encounterSetCodes.map((c) => brand("encounterSet", c)) }
            : {}),
          ...(d.contents.cardType ? { cardType: d.contents.cardType } : {}),
          ...(d.contents.trait ? { trait: d.contents.trait } : {}),
        },
        discardPile: d.discardPile,
        whenEmpty: d.whenEmpty,
      }));
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
        // docs/phase7-wave4.md §1.9: RRG 1.8 "Standard Set" (p. 40) / "Expert Set" (p. 19) — a set in this
        // classification is never a modular choice. Standard II / Expert II (`hood`) print "Standard II" /
        // "Expert II" at the bottom of the card, so they're the same classification as Core's own Standard/Expert.
        ...(id === "standard" || id === "standard_ii" ? { classification: "standard" as const } : {}),
        ...(id === "expert" || id === "expert_ii" ? { classification: "expert" as const } : {}),
        ...(separateDecks ? { separateDecks } : {}),
        ...(override?.singleVillainOnly ? { singleVillainOnly: true as const } : {}),
      };
    });
  return { encounterSets, setNames };
}
