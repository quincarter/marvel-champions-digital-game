import { describe, expect, it } from "vitest";
import type { RawCard } from "./raw-types.ts";
import { bareCuration } from "./curation/empty.ts";
import type { Correction } from "./curation/types.ts";
import { createContext } from "./normalize/context.ts";
import { normalizeEncounterSets } from "./normalize/encounter-sets.ts";
import { normalizeSingleCards } from "./normalize/single-cards.ts";

/** The real MarvelCDB records (`aoa`), copied verbatim: Velociraptor omits SCH; Mister Sinister nests a Prelates face. */
const VELOCIRAPTOR = {
  pack_code: "aoa",
  pack_name: "Age of Apocalypse",
  pack_legacy: false,
  pack_wave: 8,
  type_code: "minion",
  type_name: "Minion",
  faction_code: "encounter",
  faction_name: "Encounter",
  card_set_code: "savage_land",
  card_set_name: "Savage Land",
  card_set_type_name_code: "modular",
  position: 129,
  set_position: 3,
  code: "45129",
  name: "Velociraptor",
  real_name: "Velociraptor",
  cost_per_hero: false,
  cost_star: false,
  text: "Quickstrike.\n[star] <b>Forced Interrupt</b>: When Velociraptor attacks you, discard the top card of your deck. Velociraptor gets +1 ATK for this attack for each resource icon discarded this way.",
  real_text:
    "Quickstrike.\n[star] <b>Forced Interrupt</b>: When Velociraptor attacks you, discard the top card of your deck. Velociraptor gets +1 ATK for this attack for each resource icon discarded this way.",
  boost: 1,
  quantity: 2,
  health: 3,
  health_per_group: false,
  health_per_hero: false,
  attack: 1,
  base_threat_fixed: false,
  base_threat_per_group: false,
  base_threat_star: false,
  escalation_threat_fixed: false,
  threat_fixed: false,
  threat_per_group: false,
  traits: "Creature.",
  real_traits: "Creature.",
  is_unique: false,
  hidden: false,
  permanent: false,
  double_sided: false,
  octgn_id: "1ab538aa-6ad1-4d9d-83a6-3ebc3a045129",
  attack_star: true,
  thwart_star: false,
  defense_star: false,
  health_star: false,
  recover_star: false,
  scheme_star: false,
  boost_star: false,
  threat_star: false,
  escalation_threat_star: false,
  url: "https://marvelcdb.com/card/45129",
  imagesrc: "/bundles/cards/45129.jpg",
  spoiler: 1,
} as unknown as RawCard;
const MISTER_SINISTER = {
  pack_code: "aoa",
  pack_name: "Age of Apocalypse",
  pack_legacy: false,
  pack_wave: 8,
  type_code: "minion",
  type_name: "Minion",
  faction_code: "encounter",
  faction_name: "Encounter",
  card_set_code: "overseer",
  card_set_name: "Overseer",
  card_set_type_name_code: "modular",
  linked_to_code: "45179b",
  linked_to_name: "Mister Sinister",
  position: 179,
  set_position: 1,
  code: "45179a",
  name: "Mister Sinister",
  real_name: "Mister Sinister",
  cost_per_hero: false,
  cost_star: false,
  text: "Victory 5.\nCannot take damage while another minion is at the mission.\nPlayers cannot assign cards with the same resource icon ([energy], [mental], [physical], or [wild]) to more than one ally each mission attempt.",
  real_text:
    "Victory 5.\nCannot take damage while another minion is at the mission.\nPlayers cannot assign cards with the same resource icon ([energy], [mental], [physical], or [wild]) to more than one ally each mission attempt.",
  quantity: 1,
  health: 5,
  health_per_group: false,
  health_per_hero: true,
  base_threat_fixed: false,
  base_threat_per_group: false,
  base_threat_star: false,
  escalation_threat_fixed: false,
  threat_fixed: false,
  threat_per_group: false,
  traits: "Elite. Overseer.",
  real_traits: "Elite. Overseer.",
  illustrator: "Eduardo Mello",
  is_unique: true,
  hidden: false,
  permanent: false,
  double_sided: false,
  octgn_id: "1ab538aa-6ad1-4d9d-83a6-3ebc3a045179",
  attack_star: false,
  thwart_star: false,
  defense_star: false,
  health_star: false,
  recover_star: false,
  scheme_star: false,
  boost_star: false,
  threat_star: false,
  escalation_threat_star: false,
  url: "https://marvelcdb.com/card/45179a",
  spoiler: 1,
  linked_card: {
    pack_code: "aoa",
    pack_name: "Age of Apocalypse",
    pack_legacy: false,
    pack_wave: 8,
    type_code: "minion",
    type_name: "Minion",
    faction_code: "encounter",
    faction_name: "Encounter",
    card_set_code: "prelates",
    card_set_name: "Prelates",
    card_set_type_name_code: "modular",
    card_set_parent_code: null,
    id: 3144,
    position: 179,
    set_position: 1,
    code: "45179b",
    name: "Mister Sinister",
    real_name: "Mister Sinister",
    subname: null,
    cost: null,
    cost_per_hero: false,
    cost_star: false,
    text: "<p>Retaliate 1. Toughness. Villainous. Victory 3.</p><p>Mister Sinister engages the first player.</p>",
    real_text: "Retaliate 1. Toughness. Villainous. Victory 3.\nMister Sinister engages the first player.",
    boost: 3,
    quantity: 1,
    resource_energy: null,
    resource_physical: null,
    resource_mental: null,
    resource_wild: null,
    hand_size: null,
    health: 5,
    health_per_group: false,
    health_per_hero: true,
    thwart: null,
    thwart_cost: null,
    scheme: 1,
    attack: 1,
    attack_cost: null,
    defense: null,
    defense_cost: null,
    recover: null,
    recover_cost: null,
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
    traits: "Elite. Prelate.",
    real_traits: "Elite. Prelate.",
    meta: null,
    deck_requirements: null,
    deck_options: null,
    restrictions: null,
    flavor: "",
    illustrator: "Eduardo Mello",
    is_unique: true,
    hidden: true,
    permanent: false,
    double_sided: false,
    back_text: null,
    back_flavor: null,
    back_name: null,
    octgn_id: "1ab538aa-6ad1-4d9d-83a6-3ebc3a045179",
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
    url: "https://marvelcdb.com/card/45179b",
    imagesrc: null,
    spoiler: 1,
    backimagesrc: null,
  },
} as unknown as RawCard;

const schemeCorrection: Correction = {
  code: "45129",
  scheme: 1,
  reason: "MarvelCDB omits the minion SCH",
  evidence: "scan: assets/card-art/bundles/cards/45129.jpg prints SCH 1",
};

function run(raw: readonly RawCard[], corrections: readonly Correction[] = []) {
  const curation = {
    ...bareCuration("aoa", raw[0]),
    corrections,
    cardNotes: { "45179a": "Overseer a face prints dashes for ATK and SCH (mission area only)." },
  };
  const ctx = createContext(raw, curation);
  normalizeSingleCards(ctx, new Map());
  const sets = normalizeEncounterSets(ctx);
  return { ctx, ...sets };
}

describe("Correction.scheme (minion SCH MarvelCDB omits)", () => {
  it("emits the corrected SCH and no error", () => {
    const { ctx } = run([VELOCIRAPTOR], [schemeCorrection]);
    expect(ctx.errors).toEqual([]);
    const card = ctx.cards.find((c) => c.id === "45129");
    expect(card?.type).toBe("minion");
    expect(card?.type === "minion" && card.sch).toBe(1);
    expect(card?.type === "minion" && card.atk).toBe(1);
    expect(card?.type === "minion" && card.hp).toBe(3);
    expect([...ctx.usedCorrections]).toEqual([0]);
  });

  it("without the correction the record still needs a cardNotes entry", () => {
    const { ctx } = run([VELOCIRAPTOR]);
    expect(ctx.errors).toEqual(['45129: minion has no scheme value (printed "0", or "—"?) — needs a cardNotes entry']);
  });
});

describe("a back face in a different encounter set (Overseer / Prelates)", () => {
  it("creates the set only back faces belong to, named from the face, and puts the card in it", () => {
    const { ctx, encounterSets } = run([VELOCIRAPTOR, MISTER_SINISTER], [schemeCorrection]);
    expect(ctx.errors).toEqual([]);
    expect(encounterSets.map((s) => [s.id, s.name])).toEqual([
      ["overseer", "Overseer"],
      ["prelates", "Prelates"],
      ["savage_land", "Savage Land"],
    ]);
    const inSet = (id: string) =>
      ctx.cards.flatMap((c) => ("encounterSetIds" in c && c.encounterSetIds.includes(id as never) ? [c.id] : []));
    expect(inSet("prelates")).toEqual(["45179a"]);
    expect(inSet("overseer")).toEqual(["45179a"]);
    expect(inSet("savage_land")).toEqual(["45129"]);
  });

  it("leaves a card whose two faces share a set alone", () => {
    const same = {
      ...MISTER_SINISTER,
      linked_card: { ...MISTER_SINISTER.linked_card, card_set_code: "overseer", card_set_name: "Overseer" },
    } as RawCard;
    const { ctx, encounterSets } = run([same]);
    expect(encounterSets.map((s) => s.id)).toEqual(["overseer"]);
    const card = ctx.cards[0];
    expect(card && "encounterSetIds" in card && card.encounterSetIds).toEqual(["overseer"]);
  });
});
