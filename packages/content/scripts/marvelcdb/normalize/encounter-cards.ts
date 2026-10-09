/** Encounter-side cards: minion, attachment, treachery, obligation, environment, side scheme and evidence. */
import type {
  AttachmentCard,
  EncounterCardFlipSide,
  EvidenceCard,
  EvidenceKind,
  MinionCard,
  PrintedStatModifiers,
  SideSchemeCard,
} from "../../../src/schema/index.ts";
import { brand } from "./brand.ts";
import {
  checkNoSchemeFields,
  expectNoAttach,
  expectNoPlayerData,
  record,
  type NormalizeContext,
  type SingleRecord,
} from "./context.ts";
import type { Prepared } from "./prepare.ts";
import { scalingOf, schemeIcons } from "./values.ts";

/** MarvelCDB's three evidence type codes, keyed to the schema's `EvidenceKind` (docs/phase7-wave2.md §6.4). */
const EVIDENCE_KIND_OF: Readonly<Record<string, EvidenceKind>> = {
  evidence_means: "means",
  evidence_motive: "motive",
  evidence_opportunity: "opportunity",
};

export function normalizeEncounterCard(
  ctx: NormalizeContext,
  rec: SingleRecord,
  flipSide: EncounterCardFlipSide | undefined,
  flipParts: readonly Prepared[],
): void {
  const { errors, curation } = ctx;
  const { r, p, parsed, set, common, abilities } = rec;
  // A campaign-specific encounter card (wave 2, docs/phase7-wave2.md §1.4/§5.1 — The Rise of Red Skull's Hydra
  // Campaign story obligations, e.g. Zola's Algorithm 04163; later packs' campaign-specific minions, side
  // schemes, treacheries, environments and attachments, e.g. Sinister Motives' Bad Publicity/Community
  // Service/Snitches get Stitches sets) is faction "campaign", not "encounter": every such card belongs to its
  // own `campaignSpecific` `EncounterSet` instead of the pack's ordinary encounter sets.
  const isCampaignCard = r.faction_code === "campaign";
  if (r.faction_code !== "encounter" && !isCampaignCard)
    errors.push(`${r.code}: ${r.type_code} with faction ${r.faction_code}`);
  expectNoPlayerData(ctx, p, parsed);
  const encounterCommon = {
    // A hero-kit obligation belongs to a hero kit, not an encounter set; it reaches the encounter deck through
    // HeroIdentityCard.obligationCardId. A campaign-specific obligation has no hero kit and belongs to its own
    // (campaign-specific) encounter set instead, like any other encounter card.
    // Wave 6 fix: only a hero-kit obligation (its set code is some hero's identity set) is empty. A scenario or
    // modular set's own obligation (Project Wideawake's Warn the Others 32099, Mojo Mania's sitcom set) is an
    // ordinary member of its encounter set, so the encounter deck builder can shuffle it in.
    encounterSetIds:
      r.type_code === "obligation" && !isCampaignCard && ctx.heroBySet.has(set) ? [] : [brand("encounterSet", set)],
    boostIcons: p.boost,
    // RRG 1.8 "Boost, Boost Icon" (p. 11): the star in the boost area marks "the card has a 'Boost' ability", so the
    // flag follows the parsed text (docs/phase7-wave2-data.md "starIcon?: boolean"). `parse()` has already
    // rejected any record whose MarvelCDB `boost_star` disagrees with that text, so the two never diverge here.
    // Emitted only when true — absent reads as false, and the committed data carries no `starIcon: false`.
    ...(parsed.abilities.some((a) => a.kind === "boost") ? { starIcon: true } : {}),
    traits: p.traits,
    keywords: parsed.keywords,
    text: p.text,
    ...(p.flavor ? { flavor: p.flavor } : {}),
    abilities,
    ...(flipSide ? { flipSide } : {}),
    ...(parsed.modeOnly ? { modeOnly: parsed.modeOnly } : {}),
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
        errors.push(
          `${r.code}: minion ATK is absent (printed "0" with a reminder star, or "—"?) — needs a cardNotes entry`,
        );
      }
      if (rawAtk === null || (rawAtk !== undefined && rawAtk < -1))
        errors.push(`${r.code}: minion ATK ${String(rawAtk)} invalid`);
      if ((p.scheme ?? r.scheme) == null && !curation.cardNotes[r.code]) {
        errors.push(`${r.code}: minion has no scheme value (printed "0", or "—"?) — needs a cardNotes entry`);
      }
      // "Per group" hit points have no schema field yet; never emit such a minion with a flat value.
      if (r.health_per_group) errors.push(`${r.code}: minion health_per_group is not supported`);
      const minion: MinionCard = {
        ...common,
        type: "minion",
        // MarvelCDB -1 = printed "X" (defined by the card's own ability: Titania).
        atk: p.dashedMinionStats?.includes("atk") ? null : rawAtk === -1 ? "X" : (rawAtk ?? 0),
        sch: p.dashedMinionStats?.includes("sch") ? null : (p.scheme ?? r.scheme ?? 0),
        hp: r.health ?? 0,
        // A per player icon beside the hit points (raw `health_per_hero`): `hp` keeps the printed numeral and the
        // engine multiplies it by the players who started the scenario (RRG 1.8 "Per Player Icon", p. 32).
        ...(r.health_per_hero ? { hpPerPlayer: true as const } : {}),
        ...encounterCommon,
        ...(parsed.nemesisMinion ? { nemesisMinion: true } : {}),
      };
      record(ctx, minion, set, [p, ...flipParts]);
      return;
    }
    case "attachment": {
      // docs/phase7-wave4.md §1.13: a card with no printed "Attach to X." sentence at all, whose host is
      // established by another card's own effect (`Correction.impliedAttachHost` — Focused Defense, Fallen
      // Warrior). Never inferred automatically; only a cited curation entry supplies it.
      // `"ownWhenRevealed"` (docs/phase7-wave5.md §1.9, Old Grudge): no "attach to" text at all — the card attaches
      // itself from its own When Revealed (RRG 1.8 "Reveal", p. 38 step 2; ruling, Feb 20, 2026 (4)), so it carries no
      // `attachesTo`.
      const ownWhenRevealed = p.impliedAttachHost === "ownWhenRevealed";
      const attachesTo =
        parsed.attachesTo ??
        (typeof p.impliedAttachHost === "object"
          ? p.impliedAttachHost
          : p.impliedAttachHost && p.impliedAttachHost !== "ownWhenRevealed"
            ? { kind: p.impliedAttachHost }
            : undefined);
      if (!attachesTo && !ownWhenRevealed) {
        errors.push(`${r.code}: attachment without an attach rule`);
        return;
      }
      if (parsed.attachesToVillainNamed) {
        // Leader records normalize the same way villains do (docs/phase7-wave2.md §6.3), so a card that attaches
        // to a leader by name ("Attach to Iron Man.") is checked against the pack's leader set the same way.
        // A shared-deck scenario (Tower Defense, docs/phase7-wave4.md §1.6) files more than one villain's stages
        // under the same `card_set_code` — "Attach to Corvus Glaive." (21104) must match against every one of
        // them, not just whichever comes first, so this checks membership rather than taking a single `.find()`.
        const sameSetVillains = ctx.topLevel.filter(
          (x) => (x.type_code === "villain" || x.type_code === "leader") && x.card_set_code === r.card_set_code,
        );
        // A campaign-specific attachment naming a villain from a different scenario in the same pack (Jormungand,
        // `mts` 21189b, "Attach to Loki." — the campaign set has no villain of its own; the villain lives in the
        // `loki` scenario's set, docs/phase7-wave4.md §1.13): falls back to every villain in the pack.
        const matches =
          sameSetVillains.length > 0
            ? sameSetVillains
            : isCampaignCard
              ? ctx.topLevel.filter((x) => x.type_code === "villain" || x.type_code === "leader")
              : [];
        if (!matches.some((v) => v.name === parsed.attachesToVillainNamed)) {
          errors.push(`${r.code}: "Attach to ${parsed.attachesToVillainNamed}." is not this set's villain`);
        }
      }
      const mods: { -readonly [K in keyof PrintedStatModifiers]: number } = {};
      // MarvelCDB's -1 is its printed-X encoding (the same sentinel the minion branch above reads), but
      // `PrintedStatModifiers.atk` is a fixed number with no "X" — a dynamic stat-box bonus is a scripted ability's
      // job instead (`ability-scripting-engineer`), so it is omitted here rather than emitted as a literal -1.
      // Requires a `cardNotes` entry the same way a minion's `-1` does (Heightened Morale, `sm` 27103,
      // docs/phase7-wave5.md §1.9).
      // A printed "-1 ATK" badge (Inhibitor Collar, `next_evol` 40092) is the same raw value: a `Correction.attack`
      // of -1, confirmed on the scan, says it is the literal number.
      const printedX = p.attack === -1 && !p.attackIsCurated;
      if (printedX && !curation.cardNotes[r.code]) {
        errors.push(`${r.code}: attachment ATK is X (MarvelCDB -1) — needs a cardNotes entry or a Correction.attack`);
      } else if (p.attack !== null && p.attack !== undefined && !printedX) {
        mods.atk = p.attack;
      }
      // MarvelCDB has no THW field for an attachment and files a printed "-1 THW" badge under `scheme` (Psychic
      // Inertia, `next_evol` 40173, which attaches to an identity). `Correction.thwart` emits it as THW instead.
      if (p.thwart !== undefined) mods.thw = p.thwart;
      else if (r.scheme !== null && r.scheme !== undefined) mods.sch = r.scheme;
      const attachment: AttachmentCard = {
        ...common,
        type: "attachment",
        ...(attachesTo ? { attachesTo } : {}),
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
      // A printed dash threat (docs/phase7-wave8.md §1.24: the mission b faces, "Finished.") is emitted as a fixed 0
      // and recorded in a `cardNotes` entry, the way a minion's absent ATK is.
      if ((r.base_threat === null || r.base_threat === undefined) && !curation.cardNotes[r.code])
        errors.push(`${r.code}: side scheme without starting threat`);
      const { encounterSetIds, boostIcons, starIcon, traits, keywords, text, abilities: abs } = encounterCommon;
      const scheme: SideSchemeCard = {
        ...common,
        type: "side_scheme",
        encounterSetIds,
        startingThreat: scalingOf(r.base_threat ?? 0, p.startingThreatPerPlayer ?? !r.base_threat_fixed),
        icons: schemeIcons(
          p.schemeIcons
            ? {
                ...r,
                scheme_crisis: p.schemeIcons.crisis ?? 0,
                scheme_acceleration: p.schemeIcons.acceleration ?? 0,
                scheme_hazard: p.schemeIcons.hazard ?? 0,
              }
            : r,
        ),
        boostIcons,
        ...(starIcon ? { starIcon } : {}),
        traits,
        keywords,
        text,
        ...(p.flavor ? { flavor: p.flavor } : {}),
        abilities: abs,
        ...(parsed.signatureOf ? { signatureOf: parsed.signatureOf } : {}),
        ...(parsed.modeOnly ? { modeOnly: parsed.modeOnly } : {}),
      };
      record(ctx, scheme, set, [p, ...flipParts]);
      return;
    }
    case "evidence_means":
    case "evidence_motive":
    case "evidence_opportunity": {
      // Wave 2 (docs/phase7-wave2.md §6.4): the Agents of S.H.I.E.L.D. Executive Board Evidence set. Neither a
      // player nor an encounter card — never enters a deck or the encounter deck; `expectNoAttach` doesn't apply
      // (no evidence card prints an attach rule) and `evidenceIcon` is left unset (MarvelCDB doesn't record it).
      const evidence: EvidenceCard = {
        ...common,
        type: "evidence",
        evidence: EVIDENCE_KIND_OF[r.type_code] as EvidenceKind,
        encounterSetIds: [brand("encounterSet", set)],
        traits: p.traits,
        text: p.text,
        abilities,
      };
      record(ctx, evidence, set, [p, ...flipParts]);
      return;
    }
    default:
      errors.push(`${r.code}: unhandled type ${r.type_code}`);
  }
}
