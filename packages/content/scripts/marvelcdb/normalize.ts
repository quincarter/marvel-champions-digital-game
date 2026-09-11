/**
 * MarvelCDB records → `@mc/content` schema records.
 *
 * Pure function of (raw records, pack curation). Every inconsistency it can
 * detect is collected and thrown together at the end — ingestion never emits
 * a partially-trusted pack.
 *
 * Mapping decisions (verified against printed cards, see curation/core.ts):
 * - Scaling: `health_per_hero`, and a *false* `*_fixed` flag on
 *   base_threat/threat/escalation_threat, mean "per player"
 *   (The Break-In! 1B: threat 7 / escalation 1, both unfixed → 7 and 1 per
 *   player; Breakin' & Takin': base 2 fixed → flat 2). No Core card mixes a
 *   flat and a per-player part, so `base` and `perPlayer` are never both set.
 * - MarvelCDB aggregate records (a bare code like `01097` or `01144` whose
 *   suffixed variants `01097a`/`01144a…` also exist) are dropped: they
 *   duplicate the real cards and would double-count copies.
 * - `real_text` (not `text`) is the text source; both are *current* wording.
 *   Printed wording only differs where curated errata says so.
 * - A null cost on an event/upgrade/support means 0 (MarvelCDB sends 0; null
 *   would be an error). Resources have no cost.
 */
import type {
  AbilityReference,
  AllyCard,
  AnyCard,
  AttachmentCard,
  CardText,
  CoreAspect,
  Cycle,
  EncounterSet,
  ErrataStatus,
  HeroIdentityCard,
  KeywordInstance,
  MainSchemeCard,
  MainSchemeStage,
  MinionCard,
  Pack,
  PlayRestrictions,
  PrintedStatModifiers,
  ResourceIconCounts,
  ScalingValue,
  Scenario,
  SchemeIcon,
  SideSchemeCard,
  StarterDeck,
  Trait,
  VillainCard,
  VillainStage,
} from "../../src/schema/index.ts";
import type { CardProvenance, DroppedSourceRecord } from "../../src/data/types.ts";
import type { RawCard } from "./raw-types.ts";
import type { Errata, PackCuration } from "./curation/types.ts";
import { parseTraits, toPlainText, unknownTokens } from "./text.ts";
import { assignAbilityIds, parseCardText, type ParsedAbility, type ParsedText } from "./parse-text.ts";

// Brand casts. The schema's helper functions can't be imported at runtime
// under Node type-stripping (schema files use `.js` specifiers), and these are
// the same zero-cost casts.
type Branded<K extends keyof BrandMap> = BrandMap[K];
interface BrandMap {
  card: AnyCard["id"];
  ability: AbilityReference["id"];
  set: AnyCard["setCode"];
  cycle: AnyCard["cycleId"];
  encounterSet: EncounterSet["id"];
  scenario: Scenario["id"];
  deck: StarterDeck["id"];
}
const brand = <K extends keyof BrandMap>(_k: K, v: string): Branded<K> => v as unknown as Branded<K>;
const traitOf = (v: string): Trait => v.trim().toUpperCase() as Trait;

export interface NormalizedPack {
  readonly cycle: Cycle;
  readonly pack: Pack;
  readonly cards: AnyCard[];
  readonly encounterSets: EncounterSet[];
  readonly scenarios: Scenario[];
  readonly starterDecks: StarterDeck[];
  readonly provenance: CardProvenance[];
  readonly dropped: DroppedSourceRecord[];
}

interface Prepared {
  readonly raw: RawCard;
  readonly name: string;
  readonly traits: Trait[];
  readonly boost: number;
  readonly attack: number | null | undefined;
  readonly text: CardText;
  readonly flavor?: string;
  readonly errata?: Errata;
  readonly notes: string[];
  readonly ignored: ReadonlySet<string>;
}

const ROMAN: Readonly<Record<string, number>> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
const CORE_ASPECTS: readonly CoreAspect[] = ["aggression", "justice", "leadership", "protection", "basic", "pool"];
const PLAYER_TYPES = new Set(["ally", "event", "support", "upgrade", "resource"]);

const scalingOf = (value: number, perPlayer: boolean): ScalingValue =>
  perPlayer ? { base: 0, perPlayer: value } : { base: value, perPlayer: 0 };

const stripQuotes = (s: string): string => s.replace(/^["“](.*)["”]$/, "$1");

function collector(codes: readonly string[]): string {
  return codes.map((c) => c.slice(2).replace(/^0+/, "").toUpperCase()).join("/");
}

function resourceIcons(r: RawCard): ResourceIconCounts {
  const out: { -readonly [K in keyof ResourceIconCounts]: number } = {};
  if (r.resource_energy) out.energy = r.resource_energy;
  if (r.resource_mental) out.mental = r.resource_mental;
  if (r.resource_physical) out.physical = r.resource_physical;
  if (r.resource_wild) out.wild = r.resource_wild;
  return out;
}

/** An ally stat: absent = printed "—" (null), MarvelCDB -1 = printed "X". */
function printedStat(value: number | null | undefined): number | "X" | null {
  if (value === null || value === undefined) return null;
  return value === -1 ? "X" : value;
}

function schemeIcons(r: RawCard): SchemeIcon[] {
  const icons: SchemeIcon[] = [];
  for (let i = 0; i < (r.scheme_crisis ?? 0); i++) icons.push("crisis");
  for (let i = 0; i < (r.scheme_acceleration ?? 0); i++) icons.push("acceleration");
  for (let i = 0; i < (r.scheme_hazard ?? 0); i++) icons.push("hazard");
  return icons;
}

function errataStatus(e: Errata): ErrataStatus {
  return { currentVersion: e.version, history: [{ version: e.version, changedFields: [...e.changedFields], note: e.note }] };
}

export function normalizePack(raw: readonly RawCard[], curation: PackCuration): NormalizedPack {
  const errors: string[] = [];
  const packCode = curation.packCode;
  const setCode = brand("set", packCode);
  const cycleId = brand("cycle", curation.cycle.id);

  // ---- Flatten, detect aggregates ------------------------------------------------
  const byCode = new Map<string, RawCard>();
  for (const r of raw) {
    if (byCode.has(r.code)) errors.push(`duplicate MarvelCDB code ${r.code}`);
    byCode.set(r.code, r);
    if (r.linked_card) byCode.set(r.linked_card.code, r.linked_card);
  }
  const dropped: DroppedSourceRecord[] = [];
  const isAggregate = (code: string) => /\d$/.test(code) && byCode.has(`${code}a`);
  const topLevel: RawCard[] = [];
  for (const r of raw) {
    if (!isAggregate(r.code)) {
      topLevel.push(r);
      continue;
    }
    const variants = [...byCode.values()].filter((v) => new RegExp(`^${r.code}[a-z]$`).test(v.code));
    if (r.type_code === "main_scheme") {
      const b = byCode.get(`${r.code}b`);
      if (!b || b.threat !== r.threat || b.escalation_threat !== r.escalation_threat) {
        errors.push(`aggregate ${r.code} does not match its B side — inspect before dropping`);
      }
      dropped.push({
        marvelcdbCode: r.code,
        reason: `MarvelCDB aggregate record duplicating main scheme stage ${r.code}a/${r.code}b.`,
      });
    } else {
      const sum = variants.reduce((n, v) => n + v.quantity, 0);
      if (sum !== r.quantity) errors.push(`aggregate ${r.code} quantity ${r.quantity} != variants' total ${sum}`);
      dropped.push({
        marvelcdbCode: r.code,
        reason: `MarvelCDB aggregate record for the printed variants ${variants.map((v) => v.code).join(", ")} (quantity ${r.quantity} = their total).`,
      });
    }
  }

  // ---- Corrections, errata, text ------------------------------------------------
  const usedCorrections = new Set<number>();
  const usedErrata = new Set<string>();
  const prepared = new Map<string, Prepared>();
  const prepare = (r: RawCard): Prepared => {
    const cached = prepared.get(r.code);
    if (cached) return cached;
    let text = toPlainText(r.real_text ?? r.text);
    let name = r.name;
    let traits = parseTraits(r.real_traits ?? r.traits);
    let boost = r.boost ?? 0;
    let attack = r.attack;
    const notes: string[] = [];
    const ignored = new Set<string>();
    curation.corrections.forEach((c, i) => {
      if (c.code !== r.code) return;
      usedCorrections.add(i);
      if (c.textReplace) {
        const count = text.split(c.textReplace.find).length - 1;
        if (count !== 1) errors.push(`${r.code}: correction text "${c.textReplace.find}" found ${count} times (expected 1)`);
        else text = text.replace(c.textReplace.find, c.textReplace.replace);
      }
      if (c.name !== undefined) name = c.name;
      if (c.traits !== undefined) traits = c.traits.map((t) => t.toUpperCase());
      if (c.boost !== undefined) boost = c.boost;
      if (c.attack !== undefined) attack = c.attack;
      for (const f of c.ignoreFields ?? []) ignored.add(f);
      notes.push(`${r.code}: ${c.reason} [evidence: ${c.evidence}]`);
    });
    for (const t of unknownTokens(text)) errors.push(`${r.code}: unknown text token ${t}`);
    const errata = curation.errata.find((e) => e.code === r.code);
    let printed = text;
    if (errata) {
      usedErrata.add(errata.code);
      if (errata.printedReplace) {
        printed = text.split(errata.printedReplace.find).join(errata.printedReplace.replace);
        if (printed === text) errors.push(`${r.code}: errata printedReplace "${errata.printedReplace.find}" not found`);
      }
      notes.push(`${r.code}: errata ${errata.version} — ${errata.note} [evidence: ${errata.evidence}]`);
    }
    const flavor = toPlainText(r.flavor);
    const p: Prepared = {
      raw: r,
      name,
      traits: traits.map(traitOf),
      boost,
      attack,
      text: { printed, current: text },
      ...(flavor ? { flavor } : {}),
      ...(errata ? { errata } : {}),
      notes,
      ignored,
    };
    prepared.set(r.code, p);
    return p;
  };

  // Fields that have no printed counterpart on villains/minions: if MarvelCDB
  // sets them, a human must look at the card and record an `ignoreFields` correction.
  const checkNoSchemeFields = (p: Prepared) => {
    for (const f of ["base_threat", "scheme_crisis", "scheme_acceleration", "scheme_hazard"] as const) {
      const v = p.raw[f];
      if (v !== null && v !== undefined && !p.ignored.has(f)) {
        errors.push(`${p.raw.code} (${p.raw.type_code}) has ${f}=${String(v)} — not a printed field on this card type; verify and add an ignoreFields correction`);
      }
    }
  };

  // ---- Pack-wide lookups ----------------------------------------------------------
  const villainNames = new Set(topLevel.filter((r) => r.type_code === "villain").map((r) => r.name));
  const heroBySet = new Map<string, RawCard>();
  for (const r of topLevel) if (r.type_code === "hero" && r.card_set_code) heroBySet.set(r.card_set_code, r);

  const usedAbilityIds = new Set<string>();
  const usedNotes = new Set<string>();
  let abilityCount = 0;
  const abilityRefs = (code: string, cardName: string, abilities: readonly ParsedAbility[]): AbilityReference[] =>
    assignAbilityIds(code, cardName, abilities, usedAbilityIds).map(({ id, ability }) => {
      abilityCount++;
      const note = curation.scriptingNotes[id];
      if (note !== undefined) usedNotes.add(id);
      return {
        id: brand("ability", id),
        ...(ability.name ? { label: stripQuotes(ability.name) } : {}),
        ...(note !== undefined ? { notesForScripting: note } : {}),
      };
    });

  const parse = (p: Prepared): ParsedText => {
    const parsed = parseCardText(p.text.current, { obligation: p.raw.type_code === "obligation", villainNames });
    for (const u of parsed.unclassified) errors.push(`${p.raw.code}: ${u}`);
    const hasBoostAbility = parsed.abilities.some((a) => a.kind === "boost");
    if (Boolean(p.raw.boost_star) !== hasBoostAbility) {
      errors.push(`${p.raw.code}: boost_star=${String(p.raw.boost_star)} but text ${hasBoostAbility ? "has" : "has no"} a Boost ability`);
    }
    return parsed;
  };

  const expectNoPlayerData = (p: Prepared, parsed: ParsedText) => {
    if (Object.keys(parsed.restrictions).length > 0 || parsed.maxPerDeckText !== undefined) {
      errors.push(`${p.raw.code}: play/deck restriction on a non-player card`);
    }
  };
  const expectNoAttach = (p: Prepared, parsed: ParsedText) => {
    if (parsed.attachesTo) errors.push(`${p.raw.code}: attach rule on a ${p.raw.type_code}`);
  };

  const cards: AnyCard[] = [];
  const provenance: CardProvenance[] = [];
  const record = (card: AnyCard, cardSetCode: string, parts: readonly Prepared[]) => {
    cards.push(card);
    const note = curation.cardNotes[card.id];
    provenance.push({
      cardId: card.id,
      cardSetCode,
      marvelcdbCodes: parts.map((p) => p.raw.code),
      corrections: [...parts.flatMap((p) => p.notes), ...(note ? [`data decision: ${note}`] : [])],
    });
  };

  const baseFields = (p: Prepared, id: string, codes: readonly string[]) => ({
    id: brand("card", id),
    name: p.name,
    ...(p.raw.subname ? { subtitle: p.raw.subname } : {}),
    setCode,
    cycleId,
    collectorNumber: collector(codes),
    quantityInSet: p.raw.quantity,
    unique: Boolean(p.raw.is_unique),
    ...(p.errata ? { errata: errataStatus(p.errata) } : {}),
  });

  const handled = new Set<string>();

  // ---- Hero identities ------------------------------------------------------------
  for (const r of topLevel.filter((x) => x.type_code === "hero")) {
    const ae = r.linked_card;
    if (!ae || ae.type_code !== "alter_ego") {
      errors.push(`${r.code}: hero without a linked alter-ego`);
      continue;
    }
    const h = prepare(r);
    const a = prepare(ae);
    const hp = parse(h);
    const ap = parse(a);
    for (const [p, parsed] of [[h, hp], [a, ap]] as const) {
      expectNoPlayerData(p, parsed);
      expectNoAttach(p, parsed);
    }
    if (r.health !== ae.health) errors.push(`${r.code}: hero/alter-ego hit points differ`);
    const set = r.card_set_code ?? "";
    const obligations = topLevel.filter((x) => x.type_code === "obligation" && x.card_set_code === set);
    const nemesisSet = `${set}_nemesis`;
    if (obligations.length !== 1) errors.push(`${r.code}: expected exactly one obligation in set ${set}, found ${obligations.length}`);
    if (!topLevel.some((x) => x.card_set_code === nemesisSet)) errors.push(`${r.code}: no nemesis set ${nemesisSet}`);
    const card: HeroIdentityCard = {
      ...baseFields(h, r.code, [r.code, ae.code]),
      type: "hero_identity",
      hp: r.health ?? 0,
      hero: {
        faceName: h.name,
        traits: h.traits,
        atk: r.attack ?? 0,
        thw: r.thwart ?? 0,
        def: r.defense ?? 0,
        handSize: r.hand_size ?? 0,
        keywords: hp.keywords,
        text: h.text,
        ...(h.flavor ? { flavor: h.flavor } : {}),
        abilities: abilityRefs(r.code, h.name, hp.abilities),
      },
      alterEgo: {
        faceName: a.name,
        traits: a.traits,
        rec: ae.recover ?? 0,
        handSize: ae.hand_size ?? 0,
        keywords: ap.keywords,
        text: a.text,
        ...(a.flavor ? { flavor: a.flavor } : {}),
        abilities: abilityRefs(ae.code, a.name, ap.abilities),
      },
      obligationCardId: brand("card", obligations[0]?.code ?? ""),
      nemesisEncounterSetId: brand("encounterSet", nemesisSet),
    };
    handled.add(r.code).add(ae.code);
    record(card, set, [h, a]);
  }

  // ---- Villains: one card per villain set, stages I/II/III --------------------------
  const villainSets = [...new Set(topLevel.filter((r) => r.type_code === "villain").map((r) => r.card_set_code ?? ""))];
  const villainIdBySet = new Map<string, string>();
  for (const set of villainSets) {
    const stageRecords = topLevel
      .filter((r) => r.type_code === "villain" && r.card_set_code === set)
      .sort((x, y) => (ROMAN[x.stage ?? ""] ?? 0) - (ROMAN[y.stage ?? ""] ?? 0));
    const stages: VillainStage[] = [];
    const parts: Prepared[] = [];
    for (const r of stageRecords) {
      const p = prepare(r);
      parts.push(p);
      checkNoSchemeFields(p);
      const parsed = parse(p);
      expectNoPlayerData(p, parsed);
      expectNoAttach(p, parsed);
      const stageNumber = ROMAN[r.stage ?? ""];
      if (stageNumber === undefined) errors.push(`${r.code}: villain stage "${String(r.stage)}" is not a roman numeral`);
      if (r.health === null || r.health === undefined) errors.push(`${r.code}: villain without hit points`);
      stages.push({
        stageNumber: stageNumber ?? 0,
        hp: scalingOf(r.health ?? 0, Boolean(r.health_per_hero)),
        atk: r.attack ?? 0,
        sch: r.scheme ?? 0,
        text: p.text,
        traits: p.traits,
        keywords: parsed.keywords,
        abilities: abilityRefs(r.code, p.name, parsed.abilities),
      });
      handled.add(r.code);
    }
    const first = parts[0];
    const firstStage = stages[0];
    if (!first || !firstStage) continue;
    if (new Set(parts.map((p) => p.name)).size !== 1) errors.push(`villain set ${set}: stage names differ`);
    const card: VillainCard = {
      ...baseFields(first, first.raw.code, parts.map((p) => p.raw.code)),
      type: "villain",
      encounterSetIds: [brand("encounterSet", set)],
      sides: [{ side: "A", name: first.name, stages: [firstStage, ...stages.slice(1)] }],
    };
    villainIdBySet.set(set, card.id);
    record(card, set, parts);
  }

  // ---- Main schemes: one card per scenario set, one stage per A/B pair ---------------
  const mainSchemeIdBySet = new Map<string, string>();
  const schemeSets = [...new Set(topLevel.filter((r) => r.type_code === "main_scheme").map((r) => r.card_set_code ?? ""))];
  for (const set of schemeSets) {
    const aSides = topLevel
      .filter((r) => r.type_code === "main_scheme" && r.card_set_code === set)
      .sort((x, y) => x.code.localeCompare(y.code));
    const stages: MainSchemeStage[] = [];
    const parts: Prepared[] = [];
    for (const ra of aSides) {
      const rb = ra.linked_card;
      if (!ra.code.endsWith("a") || !rb || !rb.code.endsWith("b")) {
        errors.push(`${ra.code}: main scheme record is not an A side linked to a B side`);
        continue;
      }
      const a = prepare(ra);
      const b = prepare(rb);
      parts.push(a, b);
      const pa = parse(a);
      const pb = parse(b);
      for (const [p, parsed] of [[a, pa], [b, pb]] as const) {
        expectNoPlayerData(p, parsed);
        expectNoAttach(p, parsed);
      }
      if (pa.keywords.length > 0) errors.push(`${ra.code}: keywords on a main scheme A side`);
      const stageNumber = Number.parseInt(rb.stage ?? "", 10);
      if (!Number.isInteger(stageNumber) || `${stageNumber}A` !== ra.stage) {
        errors.push(`${ra.code}: stage "${String(ra.stage)}"/"${String(rb.stage)}" not an NA/NB pair`);
      }
      if (rb.base_threat === null || rb.base_threat === undefined) errors.push(`${rb.code}: missing starting threat`);
      if (rb.threat === null || rb.threat === undefined) errors.push(`${rb.code}: missing target threat`);
      if (rb.escalation_threat === null || rb.escalation_threat === undefined) errors.push(`${rb.code}: missing acceleration`);
      // A later stage with its own title (Klaw's stage 2 is "Secret Rendezvous") keeps it.
      const firstName = parts[0]?.name;
      stages.push({
        stageNumber,
        ...(firstName !== undefined && b.name !== firstName ? { name: b.name } : {}),
        startingThreat: scalingOf(rb.base_threat ?? 0, !rb.base_threat_fixed),
        targetThreat: scalingOf(rb.threat ?? 0, !rb.threat_fixed),
        acceleration: scalingOf(rb.escalation_threat ?? 0, !rb.escalation_threat_fixed),
        icons: schemeIcons(rb),
        text: b.text,
        traits: b.traits,
        keywords: pb.keywords,
        abilities: abilityRefs(rb.code, b.name, pb.abilities),
        aSide: { text: a.text, abilities: abilityRefs(ra.code, a.name, pa.abilities) },
      });
      handled.add(ra.code).add(rb.code);
    }
    const first = parts[0];
    const firstStage = stages[0];
    if (!first || !firstStage) continue;
    const card: MainSchemeCard = {
      ...baseFields(first, first.raw.code, parts.map((p) => p.raw.code)),
      type: "main_scheme",
      encounterSetIds: [brand("encounterSet", set)],
      stages: [firstStage, ...stages.slice(1)],
    };
    mainSchemeIdBySet.set(set, card.id);
    record(card, set, parts);
  }

  // ---- Everything else: one card per record ----------------------------------------
  for (const r of topLevel) {
    if (handled.has(r.code)) continue;
    if (r.linked_card) errors.push(`${r.code}: unexpected linked card ${r.linked_card.code} on a ${r.type_code}`);
    const p = prepare(r);
    const parsed = parse(p);
    const set = r.card_set_code ?? r.faction_code;
    const common = baseFields(p, r.code, [r.code]);
    const abilities = abilityRefs(r.code, p.name, parsed.abilities);

    if (PLAYER_TYPES.has(r.type_code)) {
      let aspect: string;
      if (r.faction_code === "hero") {
        const hero = heroBySet.get(r.card_set_code ?? "");
        if (!hero) errors.push(`${r.code}: hero card in set ${String(r.card_set_code)} with no identity`);
        aspect = `hero:${hero?.code ?? "?"}`;
      } else if ((CORE_ASPECTS as readonly string[]).includes(r.faction_code)) {
        aspect = r.faction_code;
      } else {
        errors.push(`${r.code}: unknown faction ${r.faction_code}`);
        aspect = r.faction_code;
      }
      const deckLimit = r.deck_limit ?? 0;
      if (!Number.isInteger(deckLimit) || deckLimit < 1) errors.push(`${r.code}: deck_limit ${String(r.deck_limit)} invalid`);
      if (parsed.maxPerDeckText !== undefined && parsed.maxPerDeckText !== deckLimit) {
        errors.push(`${r.code}: text says Max ${parsed.maxPerDeckText} per deck but deck_limit=${deckLimit}`);
      }
      const restrictions: PlayRestrictions = parsed.restrictions;
      if (parsed.attachesToVillainNamed) errors.push(`${r.code}: player card attaches to a villain by name`);
      if (parsed.attachesTo && r.type_code !== "upgrade") errors.push(`${r.code}: attach rule on a ${r.type_code}`);
      const playerCommon = {
        aspect: aspect as AllyCard["aspect"],
        traits: p.traits,
        keywords: parsed.keywords,
        deckLimit,
        ...(Object.keys(restrictions).length > 0 ? { playRestrictions: restrictions } : {}),
        text: p.text,
        ...(p.flavor ? { flavor: p.flavor } : {}),
        abilities,
      };
      const cost = r.cost ?? null;
      const needCost = (): number => {
        if (cost === null) {
          errors.push(`${r.code}: ${r.type_code} without a cost`);
          return 0;
        }
        return cost;
      };
      switch (r.type_code) {
        case "ally": {
          for (const [field, value] of [["attack", r.attack], ["thwart", r.thwart]] as const) {
            if ((value === null || value === undefined) && !curation.cardNotes[r.code]) {
              errors.push(`${r.code}: ally has no ${field} (printed "—"?) — needs a cardNotes entry explaining the data`);
            }
          }
          const ally: AllyCard = {
            ...common,
            type: "ally",
            cost: needCost(),
            resourceIcons: resourceIcons(r),
            // Absent = printed "—" (cannot attack/thwart; Hulk's THW); MarvelCDB -1 = printed "X".
            atk: printedStat(r.attack),
            thw: printedStat(r.thwart),
            hp: r.health ?? 0,
            consequentialDamage: { attack: r.attack_cost ?? 0, thwart: r.thwart_cost ?? 0 },
            ...playerCommon,
          };
          record(ally, set, [p]);
          break;
        }
        case "event":
          record({ ...common, type: "event", cost: needCost(), resourceIcons: resourceIcons(r), ...playerCommon }, set, [p]);
          break;
        case "support":
          record({ ...common, type: "support", cost: needCost(), resourceIcons: resourceIcons(r), ...playerCommon }, set, [p]);
          break;
        case "upgrade":
          record(
            {
              ...common,
              type: "upgrade",
              cost: needCost(),
              resourceIcons: resourceIcons(r),
              ...(parsed.attachesTo ? { attachesTo: parsed.attachesTo } : {}),
              ...playerCommon,
            },
            set,
            [p],
          );
          break;
        case "resource":
          if (cost !== null) errors.push(`${r.code}: resource with a cost`);
          record({ ...common, type: "resource", producesIcons: resourceIcons(r), ...playerCommon }, set, [p]);
          break;
      }
      continue;
    }

    // Encounter-side cards.
    if (r.faction_code !== "encounter") errors.push(`${r.code}: ${r.type_code} with faction ${r.faction_code}`);
    expectNoPlayerData(p, parsed);
    const encounterCommon = {
      // Obligations belong to a hero kit, not an encounter set; they reach the
      // encounter deck through HeroIdentityCard.obligationCardId.
      encounterSetIds: r.type_code === "obligation" ? [] : [brand("encounterSet", set)],
      boostIcons: p.boost,
      traits: p.traits,
      keywords: parsed.keywords,
      text: p.text,
      ...(p.flavor ? { flavor: p.flavor } : {}),
      abilities,
    };
    switch (r.type_code) {
      case "minion": {
        checkNoSchemeFields(p);
        expectNoAttach(p, parsed);
        const rawAtk = p.attack;
        if (rawAtk === -1 && !curation.cardNotes[r.code]) {
          errors.push(`${r.code}: printed ATK is X (MarvelCDB -1) — needs a cardNotes entry`);
        }
        if (rawAtk === null || rawAtk === undefined || rawAtk < -1) errors.push(`${r.code}: minion ATK ${String(rawAtk)} invalid`);
        const minion: MinionCard = {
          ...common,
          type: "minion",
          // MarvelCDB -1 = printed "X" (defined by the card's own ability: Titania).
          atk: rawAtk === -1 ? "X" : (rawAtk ?? 0),
          sch: r.scheme ?? 0,
          hp: r.health ?? 0,
          ...encounterCommon,
        };
        record(minion, set, [p]);
        break;
      }
      case "attachment": {
        if (!parsed.attachesTo) {
          errors.push(`${r.code}: attachment without an attach rule`);
          break;
        }
        if (parsed.attachesToVillainNamed) {
          const villain = topLevel.find((x) => x.type_code === "villain" && x.card_set_code === r.card_set_code);
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
        record(attachment, set, [p]);
        break;
      }
      case "treachery":
        expectNoAttach(p, parsed);
        record({ ...common, type: "treachery", ...encounterCommon }, set, [p]);
        break;
      case "obligation":
        record({ ...common, type: "obligation", ...encounterCommon }, set, [p]);
        break;
      case "environment":
        expectNoAttach(p, parsed);
        record({ ...common, type: "environment", ...encounterCommon }, set, [p]);
        break;
      case "side_scheme": {
        expectNoAttach(p, parsed);
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
        };
        record(scheme, set, [p]);
        break;
      }
      default:
        errors.push(`${r.code}: unhandled type ${r.type_code}`);
    }
  }

  // ---- Stale curation ---------------------------------------------------------------
  curation.corrections.forEach((c, i) => {
    if (!usedCorrections.has(i)) errors.push(`curation correction for ${c.code} matched no record`);
  });
  for (const e of curation.errata) if (!usedErrata.has(e.code)) errors.push(`curation errata for ${e.code} matched no record`);
  for (const id of Object.keys(curation.scriptingNotes)) {
    if (!usedNotes.has(id)) errors.push(`scripting note for ${id} matches no emitted ability id`);
  }
  const cardIds = new Set(cards.map((c) => c.id as string));
  for (const id of Object.keys(curation.cardNotes)) if (!cardIds.has(id)) errors.push(`cardNotes entry ${id} matches no card`);

  // ---- Encounter sets ---------------------------------------------------------------
  const setNames = new Map<string, string>();
  for (const r of topLevel) {
    if (r.faction_code !== "encounter" || r.type_code === "obligation" || !r.card_set_code) continue;
    const prev = setNames.get(r.card_set_code);
    const name = r.card_set_name ?? r.card_set_code;
    if (prev !== undefined && prev !== name) errors.push(`set ${r.card_set_code} has two names: ${prev} / ${name}`);
    setNames.set(r.card_set_code, name);
  }
  const encounterSets: EncounterSet[] = [...setNames.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, name]) => {
      const hero = id.endsWith("_nemesis") ? heroBySet.get(id.slice(0, -"_nemesis".length)) : undefined;
      return {
        id: brand("encounterSet", id),
        name,
        packCodes: [setCode],
        ...(hero ? { nemesisOfIdentityId: brand("card", hero.code) } : {}),
      };
    });

  // ---- Scenarios --------------------------------------------------------------------
  const scenarios: Scenario[] = curation.scenarios.map((s) => {
    for (const code of [s.villainSetCode, ...s.recommendedModularSetCodes, ...s.standardSetCodes, ...s.expertSetCodes]) {
      if (!setNames.has(code)) errors.push(`scenario ${s.id}: unknown encounter set ${code}`);
    }
    const villainId = villainIdBySet.get(s.villainSetCode);
    const schemeId = mainSchemeIdBySet.get(s.villainSetCode);
    if (!villainId || !schemeId) errors.push(`scenario ${s.id}: no villain/main scheme in set ${s.villainSetCode}`);
    return {
      id: brand("scenario", s.id),
      name: s.name,
      packCode: setCode,
      villainCardId: brand("card", villainId ?? ""),
      mainSchemeCardId: brand("card", schemeId ?? ""),
      encounterSetIds: [brand("encounterSet", s.villainSetCode)],
      recommendedModularSetIds: s.recommendedModularSetCodes.map((c) => brand("encounterSet", c)),
      standardEncounterSetIds: s.standardSetCodes.map((c) => brand("encounterSet", c)),
      expertEncounterSetIds: s.expertSetCodes.map((c) => brand("encounterSet", c)),
      villainStages: { standard: s.villainStages.standard, expert: s.villainStages.expert },
    };
  });

  // ---- Starter decks ----------------------------------------------------------------
  const byId = new Map(cards.map((c) => [c.id as string, c]));
  const starterDecks: StarterDeck[] = curation.starterDecks.map((d) => {
    const identity = byId.get(d.identityCode);
    if (!identity || identity.type !== "hero_identity") errors.push(`deck ${d.id}: ${d.identityCode} is not an identity`);
    let total = 0;
    for (const [code, qty] of Object.entries(d.cards)) {
      total += qty;
      const card = byId.get(code);
      if (!card) {
        errors.push(`deck ${d.id}: unknown card ${code}`);
        continue;
      }
      if (!("aspect" in card)) {
        errors.push(`deck ${d.id}: ${code} is not a player card`);
        continue;
      }
      if (qty > card.quantityInSet) errors.push(`deck ${d.id}: ${qty}× ${code} but one box has ${card.quantityInSet}`);
      if (qty > card.deckLimit) errors.push(`deck ${d.id}: ${qty}× ${code} exceeds deck limit ${card.deckLimit}`);
      const ok = card.aspect === `hero:${d.identityCode}` || card.aspect === d.aspect || card.aspect === "basic";
      if (!ok) errors.push(`deck ${d.id}: ${code} has aspect ${card.aspect}`);
    }
    if (total !== 40) errors.push(`deck ${d.id}: ${total} cards, expected 40`);
    // Deckbuilding rule (L2P p.22): every hero-kit card, at its exact kit quantity.
    for (const card of cards) {
      if ("aspect" in card && card.aspect === `hero:${d.identityCode}` && d.cards[card.id] !== card.quantityInSet) {
        errors.push(`deck ${d.id}: hero card ${card.id} must be included ×${card.quantityInSet}`);
      }
    }
    if (identity?.type === "hero_identity") {
      if (identity.obligationCardId !== d.obligationCode) {
        errors.push(`deck ${d.id}: source lists obligation ${d.obligationCode}, identity links ${identity.obligationCardId}`);
      }
      const nemesis = cards
        .filter((c) => "encounterSetIds" in c && (c.encounterSetIds as readonly string[]).includes(identity.nemesisEncounterSetId))
        .map((c) => c.id as string)
        .sort();
      if (nemesis.join() !== [...d.nemesisCodes].sort().join()) {
        errors.push(`deck ${d.id}: source nemesis set [${d.nemesisCodes.join()}] != data [${nemesis.join()}]`);
      }
    }
    return {
      id: brand("deck", d.id),
      name: d.name,
      packCode: setCode,
      identityCardId: brand("card", d.identityCode),
      aspects: [d.aspect],
      cards: Object.entries(d.cards)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cardId, quantity]) => ({ cardId: brand("card", cardId), quantity })),
      provenance: { verified: d.verified, sources: [...d.sources], ...(d.note ? { note: d.note } : {}) },
    };
  });

  // ---- Global checks ----------------------------------------------------------------
  const allCodes = [...byCode.keys()].filter((c) => !isAggregate(c));
  const covered = new Set(provenance.flatMap((p) => p.marvelcdbCodes));
  for (const c of allCodes) if (!covered.has(c)) errors.push(`MarvelCDB record ${c} was not turned into any card`);
  void abilityCount;

  if (errors.length > 0) {
    throw new Error(`Normalization of pack "${packCode}" failed:\n  - ${errors.join("\n  - ")}`);
  }

  const order = (a: { id: string } | { cardId: string }, b: { id: string } | { cardId: string }) => {
    const ka = "id" in a ? a.id : a.cardId;
    const kb = "id" in b ? b.id : b.cardId;
    return ka.localeCompare(kb);
  };
  return {
    cycle: { id: cycleId, name: curation.cycle.name, order: curation.cycle.order },
    pack: { code: setCode, name: curation.pack.name, cycleId, releaseDate: curation.pack.releaseDate },
    cards: cards.sort(order),
    encounterSets,
    scenarios,
    starterDecks,
    provenance: provenance.sort(order),
    dropped: dropped.sort((a, b) => a.marvelcdbCode.localeCompare(b.marvelcdbCode)),
  };
}

/** Keywords helper for tests/diagnostics. */
export type { KeywordInstance };
