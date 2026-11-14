/**
 * Shared builders for the hand-transcribed hero packs MarvelCDB does not carry yet (Elektra MC63, Iron Fist MC64:
 * `elektra.ts`, `iron_fist.ts`). The conventions are Shadowland's (`shadowland-encounter/common.ts`): every record is a
 * MarvelCDB-shaped raw record, so the ordinary normalizer reads it, and no art is wired (`imagesrc` is filled from the
 * gitignored local scan folder by `withLocalArt`, never stored here).
 *
 * - The code is "<pack number>" + the three-digit collector number printed in the footer; the identity is 63001a / 63001b.
 * - `text` is MarvelCDB markup: `[star]` for the printed star before a line, `<hr />` before the boost line, `[[Trait]]`
 *   for a bold-italic trait reference, `<i>` for reminder text, `[boost]` / `[amplify]` for the icons.
 * - A hero kit card carries the pack's set code, `card_set_type_name_code: "hero"` and its footer position; an aspect or
 *   basic card carries neither (as MarvelCDB's `luke_cage` records).
 */
import type { RawCard } from "../raw-types.ts";
import type { AddedRecord } from "./types.ts";

export type Fields = Record<string, unknown>;

export interface HeroPackInfo {
  /** Two-digit pack number ("63"). */
  readonly num: string;
  readonly packCode: string;
  readonly packName: string;
  /** Source description used in each record's `reason` and the evidence prefix. */
  readonly productCode: string;
}

const TYPE_NAMES: Readonly<Record<string, string>> = {
  hero: "Hero",
  alter_ego: "Alter-Ego",
  ally: "Ally",
  event: "Event",
  support: "Support",
  upgrade: "Upgrade",
  resource: "Resource",
  obligation: "Obligation",
  minion: "Minion",
  treachery: "Treachery",
  attachment: "Attachment",
  side_scheme: "Side Scheme",
  player_side_scheme: "Player Side Scheme",
};

const FACTION_NAMES: Readonly<Record<string, string>> = {
  hero: "Hero",
  basic: "Basic",
  aggression: "Aggression",
  justice: "Justice",
  leadership: "Leadership",
  protection: "Protection",
  encounter: "Encounter",
};

/** The separator before a boost line. */
export const HR = "\n<hr />\n";

export function packBuilders(pack: HeroPackInfo) {
  const face = (type: string, faction: string, code: string, name: string, over: Fields): Fields => {
    const text = (over.text as string | undefined) ?? undefined;
    const traits = (over.traits as string | undefined) ?? undefined;
    return {
      pack_code: pack.packCode,
      pack_name: pack.packName,
      pack_legacy: false,
      type_code: type,
      type_name: TYPE_NAMES[type],
      faction_code: faction,
      faction_name: FACTION_NAMES[faction],
      position: Number.parseInt(code.slice(2, 5), 10),
      code,
      name,
      real_name: name,
      cost_per_hero: false,
      cost_star: false,
      ...(text !== undefined ? { text, real_text: text } : {}),
      ...(traits !== undefined ? { real_traits: traits } : {}),
      quantity: 1,
      health_per_group: false,
      health_per_hero: false,
      base_threat_fixed: false,
      base_threat_per_group: false,
      base_threat_star: false,
      escalation_threat_fixed: false,
      threat_fixed: false,
      threat_per_group: false,
      is_unique: false,
      hidden: false,
      permanent: false,
      double_sided: false,
      attack_star: false,
      thwart_star: false,
      defense_star: false,
      health_star: false,
      recover_star: false,
      scheme_star: false,
      boost_star: false,
      threat_star: false,
      escalation_threat_star: false,
      ...over,
    };
  };

  /** A hero kit card: the pack's own set, with its footer position. */
  const kit = (type: string, code: string, name: string, setPosition: number, over: Fields): RawCard =>
    face(type, "hero", code, name, {
      card_set_code: pack.packCode,
      card_set_name: pack.packName,
      card_set_type_name_code: "hero",
      set_position: setPosition,
      deck_limit: over.quantity ?? 1,
      ...over,
    }) as unknown as RawCard;

  /** An aspect or basic card (no set, no footer position). */
  const aspect = (type: string, faction: string, code: string, name: string, over: Fields): RawCard =>
    face(type, faction, code, name, { deck_limit: 3, ...over }) as unknown as RawCard;

  /** The identity: a hero front with the alter-ego as its nested `linked_card`. */
  const identity = (hero: Fields, alterEgo: Fields): RawCard => {
    const heroName = hero.name as string;
    const egoName = alterEgo.name as string;
    const common = { card_set_code: pack.packCode, card_set_name: pack.packName, card_set_type_name_code: "hero" };
    const back = face("alter_ego", "hero", `${pack.num}001b`, egoName, {
      ...common,
      linked_to_code: `${pack.num}001a`,
      linked_to_name: heroName,
      position: 1,
      is_unique: true,
      hidden: true,
      ...alterEgo,
    });
    return face("hero", "hero", `${pack.num}001a`, heroName, {
      ...common,
      linked_to_code: `${pack.num}001b`,
      linked_to_name: egoName,
      position: 1,
      is_unique: true,
      linked_card: back,
      ...hero,
    }) as unknown as RawCard;
  };

  /** An encounter card of the hero's own obligation or nemesis set (`faction: encounter`). */
  const encounter = (type: string, code: string, name: string, over: Fields): RawCard =>
    face(type, "encounter", code, name, { spoiler: 1, ...over }) as unknown as RawCard;

  /**
   * An encounter-shaped card a player card brings in by its Linked keyword (Elektra's Backstab, Misdirect and Sabotage,
   * "Linked (Double-Cross)"): `faction: encounter`, filed under the pack's own hero set, which the normalizer reads as
   * "belongs to no encounter set" (it is never part of a scenario's deck until its linking card shuffles it in).
   *
   * Why the hero set and not a null `card_set_code`: the footers print JUSTICE (Backstab and Sabotage; the aspect of
   * their linking card Double-Cross), and MarvelCDB's precedent for a Linked player-side card is a null set code
   * (Magneto 49033, Black Panther 51036), but those are player-faction upgrades. These three are encounter-backed
   * treacheries, and `normalizeEncounterCard` derives an encounter card's set from its `card_set_code`; a null code
   * would make an empty set id. Filing them under the hero set reuses the hero-kit branch (as an obligation), gated on
   * the Linked keyword so no other encounter card under a hero set is dropped from its set. The engine's Linked setup
   * (`engine/src/setup.ts`, `linkedCardGroups`) reads the Linked keyword from the card pool and never a set code, so
   * either filing finds them.
   */
  const linked = (code: string, name: string, over: Fields): RawCard =>
    face("treachery", "encounter", code, name, {
      card_set_code: pack.packCode,
      card_set_name: pack.packName,
      card_set_type_name_code: "hero",
      spoiler: 1,
      ...over,
    }) as unknown as RawCard;

  /** One `AddedRecord` with the standard reason line. */
  const added = (record: RawCard, evidence: string): AddedRecord => {
    const name = (record as unknown as { name: string }).name;
    return {
      record,
      reason: `MarvelCDB has no ${pack.productCode} pack: ${record.code} ${name} is transcribed by hand.`,
      evidence,
    };
  };
  return { kit, aspect, identity, encounter, linked, added };
}
