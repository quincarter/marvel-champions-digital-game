/**
 * Shared builders for the Shadowland (MC65) scan transcriptions (`shadowland-encounter/*.ts`). MarvelCDB has no
 * Shadowland pack (docs/phase7-shadowland.md section 0), so every record is a hand transcription from the Hall of
 * Heroes preview scans (https://hallofheroeslcg.com/shadowland/, 300 x 426 px), read at 3x with an unsharp mask, once by
 * the transcriber and a second time, independently, by the D3 pass (docs/phase7-shadowland.md section 6).
 *
 * Conventions (the Fear No Evil ones, `fne-encounter/scenarios.ts` header, plus the Shadowland-specific reads):
 * - The code is "65" + the three-digit collector number printed in the footer, with a lowercase face letter for a
 *   double-sided card ("65003a" for footer "3A"). A single-sided card with no printed letter has none ("65005").
 * - The footer "SET (N/M)" counts copies: `set_position` is the first copy's N, `quantity` the copies. A card the
 *   preview does not show a second copy of but whose footer numbering skips (Chaos in Hell's Kitchen is collector 10,
 *   "10/13", and the next card, collector 11, is "12/13") has the skipped numbers as its extra copies.
 * - Two-sided cards are a top-level `a` record with the `b` face nested as `linked_card` (`hidden: true`). A face whose
 *   other side has no preview scan is a lone record and is listed in the pack's missing list, never guessed.
 * - A row of N red boost icons is `boost: N`; the red star icon is `boost_star: true` (it counts as the star in
 *   `boost_star`, not as a number). A numeral beside a star ("1*") keeps the numeral and sets the matching `*_star`.
 * - Threat: a person icon beside a number means per hero (`*_fixed: false`); a bare number is fixed. On a main scheme B
 *   face the top-left circle is the threat threshold (`threat`), the lower box at the bottom right is the starting
 *   threat (`base_threat`) and the upper box the escalation (checked against the Fear No Evil scan 60161b).
 * - Resource icons in text, checked against the scans of Tenacity 01093 ("Spend a [physical] resource") and Media
 *   Coverage 02049 ("Spend a [mental] resource"): lightning bolt is [energy], the fist-like blob [physical], the
 *   node-and-link cluster [mental], the burst [wild].
 * - `text` is MarvelCDB markup: `[star]` for the printed star before a line, `<hr />` before the boost line,
 *   `[acceleration]`/`[hazard]`/`[boost]`/`[per_hero]`/resource tokens, `[[Trait]]` for a bold-italic trait reference,
 *   `<i>` for the printed italic reminder text and flavor, straight quotes, "-3" with an ASCII hyphen (MarvelCDB's form
 *   of the printed en dash).
 * - No art is wired: `imagesrc` is null everywhere (the scans are gitignored, non-redistributed).
 */
import type { RawCard } from "../../raw-types.ts";
import type { AddedRecord } from "../types.ts";

export type Fields = Record<string, unknown>;

export interface SetInfo {
  readonly code: string;
  readonly name: string;
  readonly kind: "villain" | "modular";
}

export const SHADOWS_IN_THE_NIGHT: SetInfo = {
  code: "shadows_in_the_night",
  name: "Shadows in the Night",
  kind: "villain",
};
export const DARK_PROTEGE: SetInfo = { code: "dark_protege", name: "Dark Protégé", kind: "villain" };
export const NINJA_SWARM: SetInfo = { code: "ninja_swarm", name: "Ninja Swarm", kind: "modular" };
export const SHADOW_LABYRINTH: SetInfo = { code: "shadow_labyrinth", name: "Shadow Labyrinth", kind: "villain" };
export const DEADLY_CONTRAPTIONS: SetInfo = {
  code: "deadly_contraptions",
  name: "Deadly Contraptions",
  kind: "modular",
};
export const HEART_OF_SHADOW: SetInfo = { code: "heart_of_shadow", name: "Heart of Shadow", kind: "villain" };
export const BLACK_FLOWER: SetInfo = { code: "black_flower", name: "Black Flower", kind: "modular" };

const TYPE_NAMES: Readonly<Record<string, string>> = {
  villain: "Villain",
  main_scheme: "Main Scheme",
  side_scheme: "Side Scheme",
  attachment: "Attachment",
  minion: "Minion",
  treachery: "Treachery",
  upgrade: "Upgrade",
  environment: "Environment",
};

/** The separator before a boost line. */
export const HR = "\n<hr />\n";

/** A full MarvelCDB-shaped record (nulls included, as `scenarios.ts`); `over` wins. */
function face(set: SetInfo, type: string, code: string, name: string, over: Fields): Fields {
  const text = (over.text as string | null | undefined) ?? null;
  const traits = (over.traits as string | null | undefined) ?? null;
  const base: Fields = {
    pack_code: "shadowland",
    pack_name: "Shadowland",
    pack_legacy: false,
    type_code: type,
    type_name: TYPE_NAMES[type],
    faction_code: "encounter",
    faction_name: "Encounter",
    card_set_code: set.code,
    card_set_name: set.name,
    card_set_type_name_code: set.kind,
    card_set_parent_code: null,
    position: Number.parseInt(code.slice(2, 5), 10),
    set_position: null,
    code,
    name,
    real_name: name,
    subname: null,
    cost: null,
    cost_per_hero: false,
    cost_star: false,
    text,
    real_text: text,
    boost: null,
    quantity: 1,
    resource_energy: null,
    resource_mental: null,
    resource_physical: null,
    resource_wild: null,
    health: null,
    health_per_group: false,
    health_per_hero: false,
    thwart: null,
    thwart_cost: null,
    scheme: null,
    attack: null,
    attack_cost: null,
    base_threat: null,
    base_threat_fixed: false,
    base_threat_per_group: false,
    base_threat_star: false,
    escalation_threat: null,
    escalation_threat_fixed: false,
    scheme_crisis: null,
    scheme_acceleration: null,
    scheme_amplify: null,
    scheme_hazard: null,
    threat: null,
    threat_fixed: false,
    threat_per_group: false,
    deck_limit: null,
    stage: null,
    traits,
    real_traits: traits,
    flavor: "",
    illustrator: null,
    is_unique: false,
    hidden: false,
    permanent: false,
    double_sided: false,
    back_text: null,
    back_flavor: null,
    back_name: null,
    attack_star: false,
    thwart_star: false,
    defense_star: false,
    health_star: false,
    recover_star: false,
    scheme_star: false,
    boost_star: false,
    threat_star: false,
    escalation_threat_star: false,
    errata: null,
    imagesrc: null,
    spoiler: 1,
    backimagesrc: null,
  };
  return { ...base, ...over };
}

/** A one-sided card (or a lone face whose other side has no scan). */
export function single(
  set: SetInfo,
  type: string,
  code: string,
  name: string,
  setPosition: number,
  over: Fields,
): RawCard {
  return face(set, type, code, name, { set_position: setPosition, ...over }) as unknown as RawCard;
}

/** A two-sided card: the `a` record carries the `b` face as `linked_card`; `code` is the bare number ("65003"). */
export function twoSided(
  set: SetInfo,
  type: string,
  code: string,
  setPosition: number,
  a: { readonly name: string; readonly over: Fields },
  b: { readonly name: string; readonly over: Fields },
): RawCard {
  const bCode = `${code}b`;
  const back = face(set, type, bCode, b.name, { set_position: setPosition, hidden: true, ...b.over });
  const front = face(set, type, `${code}a`, a.name, {
    set_position: setPosition,
    linked_to_code: bCode,
    linked_to_name: b.name,
    linked_card: back,
    ...a.over,
  });
  return front as unknown as RawCard;
}

/** One `AddedRecord` with the standard reason line. */
export function added(record: RawCard, evidence: string): AddedRecord {
  const name = (record as unknown as { name: string }).name;
  return {
    record,
    reason: `MarvelCDB has no Shadowland (MC65) pack: ${record.code} ${name} is transcribed from the Hall of Heroes preview scan.`,
    evidence,
  };
}
