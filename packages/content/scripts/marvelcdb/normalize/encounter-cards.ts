/** Encounter-side cards: minion, attachment, treachery, obligation, environment and side scheme. */
import type { AttachmentCard, EncounterCardFlipSide, MinionCard, PrintedStatModifiers, SideSchemeCard } from "../../../src/schema/index.ts";
import { brand } from "./brand.ts";
import { checkNoSchemeFields, expectNoAttach, expectNoPlayerData, record, type NormalizeContext, type SingleRecord } from "./context.ts";
import type { Prepared } from "./prepare.ts";
import { scalingOf, schemeIcons } from "./values.ts";

export function normalizeEncounterCard(
  ctx: NormalizeContext,
  rec: SingleRecord,
  flipSide: EncounterCardFlipSide | undefined,
  flipParts: readonly Prepared[],
): void {
  const { errors, curation } = ctx;
  const { r, p, parsed, set, common, abilities } = rec;
  // A campaign-specific obligation (wave 2, docs/phase7-wave2.md §1.4/§5.1 — The Rise of Red Skull's Hydra
  // Campaign story obligations, e.g. Zola's Algorithm 04163) is faction "campaign", not "encounter": it belongs
  // to no hero kit, but to a `campaignSpecific` `EncounterSet` (`expcamp`) instead.
  const isCampaignObligation = r.type_code === "obligation" && r.faction_code === "campaign";
  if (r.faction_code !== "encounter" && !isCampaignObligation) errors.push(`${r.code}: ${r.type_code} with faction ${r.faction_code}`);
  expectNoPlayerData(ctx, p, parsed);
  const encounterCommon = {
    // An ordinary obligation belongs to a hero kit, not an encounter set; it reaches the encounter deck through
    // HeroIdentityCard.obligationCardId. A campaign-specific obligation has no hero kit and belongs to its own
    // (campaign-specific) encounter set instead, like any other encounter card.
    encounterSetIds: r.type_code === "obligation" && !isCampaignObligation ? [] : [brand("encounterSet", set)],
    boostIcons: p.boost,
    traits: p.traits,
    keywords: parsed.keywords,
    text: p.text,
    ...(p.flavor ? { flavor: p.flavor } : {}),
    abilities,
    ...(flipSide ? { flipSide } : {}),
  };
  switch (r.type_code) {
    case "minion": {
      checkNoSchemeFields(ctx, p);
      expectNoAttach(ctx, p, parsed);
      const rawAtk = p.attack;
      if (rawAtk === -1 && !curation.cardNotes[r.code]) {
        errors.push(`${r.code}: printed ATK is X (MarvelCDB -1) — needs a cardNotes entry`);
      }
      // An absent ATK is ambiguous between a printed "0★" (Taskmaster) and a printed "—"; a human must look at
      // the card and record which in a cardNotes entry (docs/phase7-wave1.md §1.12).
      if (rawAtk === undefined && !curation.cardNotes[r.code]) {
        errors.push(`${r.code}: minion ATK is absent (printed "0" with a reminder star, or "—"?) — needs a cardNotes entry`);
      }
      if (rawAtk === null || (rawAtk !== undefined && rawAtk < -1)) errors.push(`${r.code}: minion ATK ${String(rawAtk)} invalid`);
      if ((r.scheme === null || r.scheme === undefined) && !curation.cardNotes[r.code]) {
        errors.push(`${r.code}: minion has no scheme value (printed "0", or "—"?) — needs a cardNotes entry`);
      }
      const minion: MinionCard = {
        ...common,
        type: "minion",
        // MarvelCDB -1 = printed "X" (defined by the card's own ability: Titania).
        atk: rawAtk === -1 ? "X" : (rawAtk ?? 0),
        sch: r.scheme ?? 0,
        hp: r.health ?? 0,
        ...encounterCommon,
        ...(parsed.nemesisMinion ? { nemesisMinion: true } : {}),
      };
      record(ctx, minion, set, [p, ...flipParts]);
      return;
    }
    case "attachment": {
      if (!parsed.attachesTo) {
        errors.push(`${r.code}: attachment without an attach rule`);
        return;
      }
      if (parsed.attachesToVillainNamed) {
        const villain = ctx.topLevel.find((x) => x.type_code === "villain" && x.card_set_code === r.card_set_code);
        if (villain?.name !== parsed.attachesToVillainNamed) {
          errors.push(`${r.code}: "Attach to ${parsed.attachesToVillainNamed}." is not this set's villain`);
        }
      }
      const mods: { -readonly [K in keyof PrintedStatModifiers]: number } = {};
      if (p.attack !== null && p.attack !== undefined) mods.atk = p.attack;
      if (r.scheme !== null && r.scheme !== undefined) mods.sch = r.scheme;
      const attachment: AttachmentCard = {
        ...common,
        type: "attachment",
        attachesTo: parsed.attachesTo,
        ...(Object.keys(mods).length > 0 ? { statModifiers: mods } : {}),
        ...encounterCommon,
      };
      record(ctx, attachment, set, [p, ...flipParts]);
      return;
    }
    case "treachery":
      expectNoAttach(ctx, p, parsed);
      record(ctx, { ...common, type: "treachery", ...encounterCommon }, set, [p, ...flipParts]);
      return;
    case "obligation":
      record(ctx, { ...common, type: "obligation", ...encounterCommon }, set, [p, ...flipParts]);
      return;
    case "environment":
      expectNoAttach(ctx, p, parsed);
      record(ctx, { ...common, type: "environment", ...encounterCommon }, set, [p, ...flipParts]);
      return;
    case "side_scheme": {
      expectNoAttach(ctx, p, parsed);
      if (r.base_threat === null || r.base_threat === undefined) errors.push(`${r.code}: side scheme without starting threat`);
      const { encounterSetIds, boostIcons, traits, keywords, text, abilities: abs } = encounterCommon;
      const scheme: SideSchemeCard = {
        ...common,
        type: "side_scheme",
        encounterSetIds,
        startingThreat: scalingOf(r.base_threat ?? 0, !r.base_threat_fixed),
        icons: schemeIcons(r),
        boostIcons,
        traits,
        keywords,
        text,
        ...(p.flavor ? { flavor: p.flavor } : {}),
        abilities: abs,
        ...(parsed.signatureOf ? { signatureOf: parsed.signatureOf } : {}),
      };
      record(ctx, scheme, set, [p, ...flipParts]);
      return;
    }
    default:
      errors.push(`${r.code}: unhandled type ${r.type_code}`);
  }
}
