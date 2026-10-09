import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RawCard } from "./raw-types.ts";
import { bareCuration } from "./curation/empty.ts";
import type { AddedRecord, Correction, LinkOverride, PackCuration } from "./curation/types.ts";
import { AOA_CURATION } from "./curation/aoa.ts";
import { TT_CURATION } from "./curation/tt.ts";
import { normalizePack } from "./normalize.ts";
import { withLocalArt } from "./normalize/art.ts";
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

/** The real MarvelCDB record for Scarab (`aoa` 45160): `is_unique: false`, though the scan prints the unique marker. */
const SCARAB = {
  pack_code: "aoa",
  pack_name: "Age of Apocalypse",
  pack_legacy: false,
  pack_wave: 8,
  type_code: "minion",
  type_name: "Minion",
  faction_code: "encounter",
  faction_name: "Encounter",
  card_set_code: "clan_akkaba",
  card_set_name: "Clan Akkaba",
  card_set_type_name_code: "modular",
  position: 160,
  set_position: 2,
  code: "45160",
  name: "Scarab",
  real_name: "Scarab",
  cost_per_hero: false,
  cost_star: false,
  text: "Quickstrike.\n[star] <b>Forced Response</b>: After Scarab attacks, place 1 threat on Ancient Ritual (3 threat instead if the attack defeated an ally).",
  real_text:
    "Quickstrike.\n[star] <b>Forced Response</b>: After Scarab attacks, place 1 threat on Ancient Ritual (3 threat instead if the attack defeated an ally).",
  boost: 3,
  quantity: 1,
  health: 5,
  health_per_group: false,
  health_per_hero: false,
  scheme: 1,
  attack: 3,
  base_threat_fixed: false,
  base_threat_per_group: false,
  base_threat_star: false,
  escalation_threat_fixed: false,
  threat_fixed: false,
  threat_per_group: false,
  traits: "Clan Akkaba.",
  real_traits: "Clan Akkaba.",
  illustrator: "Simone Buonfantino",
  is_unique: false,
  hidden: false,
  permanent: false,
  double_sided: false,
  octgn_id: "1ab538aa-6ad1-4d9d-83a6-3ebc3a045160",
  attack_star: true,
  thwart_star: false,
  defense_star: false,
  health_star: false,
  recover_star: false,
  scheme_star: false,
  boost_star: false,
  threat_star: false,
  escalation_threat_star: false,
  url: "https://marvelcdb.com/card/45160",
  imagesrc: "/bundles/cards/45160.jpg",
  spoiler: 1,
} as unknown as RawCard;

const uniqueCorrection: Correction = {
  code: "45160",
  unique: true,
  reason: "MarvelCDB's is_unique is false but the card prints the unique marker",
  evidence: "scan: assets/card-art/bundles/cards/45160.png, star before the title",
};

describe("Correction.unique (printed unique marker MarvelCDB lacks)", () => {
  it("emits unique: true with the correction", () => {
    const { ctx } = run([SCARAB], [uniqueCorrection]);
    expect(ctx.errors).toEqual([]);
    expect(ctx.cards.find((c) => c.id === "45160")?.unique).toBe(true);
    expect([...ctx.usedCorrections]).toEqual([0]);
  });

  it("without the correction MarvelCDB's is_unique: false is emitted", () => {
    const { ctx } = run([SCARAB]);
    expect(ctx.errors).toEqual([]);
    expect(ctx.cards.find((c) => c.id === "45160")?.unique).toBe(false);
  });
});

const dashCorrection: Correction = {
  code: "45179a",
  dashedMinionStats: ["atk", "sch"],
  reason: "MarvelCDB sends neither ATK nor SCH for a printed dash",
  evidence: "scan: assets/card-art/bundles/cards/45179a.png, both stat badges empty",
};

describe("a nested minion face in another encounter set is its own card (Overseer / Prelates, spec §1.25)", () => {
  it("emits two minions, each in the set its own record names, naming each other by otherFaceId", () => {
    const { ctx, encounterSets } = run([VELOCIRAPTOR, MISTER_SINISTER], [schemeCorrection, dashCorrection]);
    expect(ctx.errors).toEqual([]);
    expect(encounterSets.map((s) => [s.id, s.name])).toEqual([
      ["overseer", "Overseer"],
      ["prelates", "Prelates"],
      ["savage_land", "Savage Land"],
    ]);
    const inSet = (id: string) =>
      ctx.cards.flatMap((c) => ("encounterSetIds" in c && c.encounterSetIds.includes(id as never) ? [c.id] : []));
    expect(inSet("overseer")).toEqual(["45179a"]);
    expect(inSet("prelates")).toEqual(["45179b"]);
    expect(inSet("savage_land")).toEqual(["45129"]);
    const a = ctx.cards.find((c) => c.id === "45179a");
    const b = ctx.cards.find((c) => c.id === "45179b");
    expect(a?.type === "minion" && a.otherFaceId).toBe("45179b");
    expect(b?.type === "minion" && b.otherFaceId).toBe("45179a");
    expect(a?.type === "minion" && a.flipSide).toBeUndefined();
    expect(b?.type === "minion" && b.flipSide).toBeUndefined();
  });

  it("carries the per player icon beside the hit points (raw health_per_hero) on each face; a flat value has no flag", () => {
    const { ctx } = run([VELOCIRAPTOR, MISTER_SINISTER], [schemeCorrection, dashCorrection]);
    const hp = (id: string) => {
      const card = ctx.cards.find((c) => c.id === id);
      return card?.type === "minion" ? [card.hp, card.hpPerPlayer] : undefined;
    };
    expect(hp("45179a")).toEqual([5, true]);
    expect(hp("45179b")).toEqual([5, true]);
    expect(hp("45129")).toEqual([3, undefined]);
  });

  it("reads a minion's per group hit points (raw health_per_group) as hpPerGroup, never as a flat or per player value", () => {
    const { ctx } = run([{ ...VELOCIRAPTOR, health_per_group: true }], [schemeCorrection]);
    expect(ctx.errors).toEqual([]);
    const card = ctx.cards.find((c) => c.id === "45129");
    expect(card?.type === "minion" && [card.hp, card.hpPerGroup, card.hpPerPlayer]).toEqual([3, true, undefined]);
  });

  it("gives the Prelate face its own ATK, SCH, hit points, boost icons and Victory", () => {
    const { ctx } = run([MISTER_SINISTER], [dashCorrection]);
    const b = ctx.cards.find((c) => c.id === "45179b");
    expect(b?.type).toBe("minion");
    if (b?.type !== "minion") return;
    expect([b.atk, b.sch, b.hp, b.boostIcons]).toEqual([1, 1, 5, 3]);
    expect(b.traits).toEqual(["ELITE", "PRELATE"]);
    expect(b.keywords.map((k) => k.name)).toEqual(["retaliate", "toughness", "villainous", "victory"]);
    expect(b.keywords.find((k) => k.name === "victory")).toMatchObject({ value: 3 });
  });

  it("dashes are null: Correction.dashedMinionStats emits atk and sch as null, not 0", () => {
    const { ctx } = run([MISTER_SINISTER], [dashCorrection]);
    const a = ctx.cards.find((c) => c.id === "45179a");
    expect(a?.type === "minion" && [a.atk, a.sch, a.hp]).toEqual([null, null, 5]);
    expect(a?.type === "minion" && a.encounterSetIds).toEqual(["overseer"]);
  });

  it("splits a nested minion face even when both faces share a set", () => {
    const same = {
      ...MISTER_SINISTER,
      linked_card: { ...MISTER_SINISTER.linked_card, card_set_code: "overseer", card_set_name: "Overseer" },
    } as RawCard;
    const { ctx, encounterSets } = run([same], [dashCorrection]);
    expect(encounterSets.map((s) => s.id)).toEqual(["overseer"]);
    expect(ctx.cards.map((c) => [c.id, "encounterSetIds" in c && c.encounterSetIds])).toEqual([
      ["45179a", ["overseer"]],
      ["45179b", ["overseer"]],
    ]);
  });
});

/** The real MarvelCDB records for the first mission (`aoa`): the b face prints a dash threat. */
const LIBERATE_THE_SEATTLE_CORE = {
  pack_code: "aoa",
  pack_name: "Age of Apocalypse",
  pack_wave: 8,
  type_code: "side_scheme",
  type_name: "Side Scheme",
  faction_code: "encounter",
  faction_name: "Encounter",
  card_set_code: "aoa_mission",
  card_set_name: "Mission",
  card_set_type_name_code: "modular",
  linked_to_code: "45166b",
  position: 166,
  set_position: 1,
  code: "45166a",
  name: "Liberate the Seattle Core",
  real_name: "Liberate the Seattle Core",
  text: "<b>Forced Response</b>: After you resolve a mission attempt, place 1 attempt counter here and deal 1 damage to each ally at the mission. If there are 4 attempt counters here, remove Mission Team from the game and flip this card over.\n<b>When Defeated</b>: Shuffle each player card at the mission into its owner's deck. Flip Mission Team and this card over.",
  real_text:
    "<b>Forced Response</b>: After you resolve a mission attempt, place 1 attempt counter here and deal 1 damage to each ally at the mission. If there are 4 attempt counters here, remove Mission Team from the game and flip this card over.\n<b>When Defeated</b>: Shuffle each player card at the mission into its owner's deck. Flip Mission Team and this card over.",
  quantity: 1,
  base_threat: 5,
  base_threat_fixed: false,
  base_threat_per_group: false,
  traits: "Mission.",
  real_traits: "Mission.",
  hidden: false,
  imagesrc: "/bundles/cards/45166a.png",
  linked_card: {
    pack_code: "aoa",
    pack_name: "Age of Apocalypse",
    pack_wave: 8,
    type_code: "side_scheme",
    type_name: "Side Scheme",
    faction_code: "encounter",
    faction_name: "Encounter",
    card_set_code: "aoa_mission",
    card_set_name: "Mission",
    card_set_type_name_code: "modular",
    position: 166,
    set_position: 1,
    code: "45166b",
    name: "Liberate the Seattle Core",
    real_name: "Liberate the Seattle Core",
    text: '<p><b>Forced Response</b>: After you flip to this side, remove each card in the mission area from the game and do the following:</p><p>• If the mission was not defeated, place 2<span class="icon-per_hero" title="Per-Hero"></span> threat on the main scheme.</p><p>• If the mission was defeated, each player adds 1 copy of the Desperate Measures upgrade to their hand.</p>',
    real_text:
      "<b>Forced Response</b>: After you flip to this side, remove each card in the mission area from the game and do the following:\n• If the mission was not defeated, place 2[per_hero] threat on the main scheme.\n• If the mission was defeated, each player adds 1 copy of the Desperate Measures upgrade to their hand.",
    quantity: 1,
    base_threat: null,
    base_threat_fixed: true,
    base_threat_per_group: false,
    traits: "Finished.",
    real_traits: "Finished.",
    hidden: true,
    imagesrc: "/bundles/cards/45166b.png",
  },
} as unknown as RawCard;

describe('the mission b face ("Finished.", spec §1.24)', () => {
  it("is its own side scheme with fixed 0 threat once a cardNotes entry records the printed dash", () => {
    const curation = {
      ...bareCuration("aoa", LIBERATE_THE_SEATTLE_CORE),
      cardNotes: { "45166b": "prints a dash for its threat" },
    };
    const ctx = createContext([LIBERATE_THE_SEATTLE_CORE], curation);
    normalizeSingleCards(ctx, new Map());
    expect(ctx.errors).toEqual([]);
    const a = ctx.cards.find((c) => c.id === "45166a");
    const b = ctx.cards.find((c) => c.id === "45166b");
    expect(a?.type === "side_scheme" && [a.otherFaceId, a.startingThreat]).toEqual([
      "45166b",
      { base: 0, perPlayer: 5 },
    ]);
    expect(b?.type === "side_scheme" && [b.otherFaceId, b.startingThreat, b.traits]).toEqual([
      "45166a",
      { base: 0, perPlayer: 0 },
      ["FINISHED"],
    ]);
  });

  it("without a cardNotes entry the dash threat is still reported", () => {
    const ctx = createContext([LIBERATE_THE_SEATTLE_CORE], bareCuration("aoa", LIBERATE_THE_SEATTLE_CORE));
    normalizeSingleCards(ctx, new Map());
    expect(ctx.errors).toEqual(["45166b: side scheme without starting threat"]);
  });
});

/** The real MarvelCDB records for box card 104 and 105 (`aoa`), copied verbatim: 45104a's `linked_card` is the wrong one. */
const NO_LONGER_WORTHY = {
  ...{
    pack_code: "aoa",
    pack_name: "Age of Apocalypse",
    pack_legacy: false,
    pack_wave: 8,
    type_code: "attachment",
    type_name: "Attachment",
    faction_code: "encounter",
    faction_name: "Encounter",
    card_set_code: "apocalypse",
    card_set_name: "Apocalypse",
    card_set_type_name_code: "villain",
    card_set_parent_code: null,
    id: 3070,
    position: 105,
    set_position: 5,
    code: "45105b",
    name: "No Longer Worthy",
    real_name: "No Longer Worthy",
    subname: null,
    cost: null,
    cost_per_hero: false,
    cost_star: false,
    text: '<p>Attach to Apocalypse and heal 5<span class="icon-per_hero" title="Per-Hero"></span> hit points from him. He cannot take damage while a <b class="card-traits"><i>Prelate</i></b> minion is in play.</p><p>Ignore the "<b>Forced Interrupt</b>" on the main scheme.</p><p><b>Forced Interrupt</b>: When Apocalypse is defeated, the players win the game.</p>',
    real_text:
      'Attach to Apocalypse and heal 5[per_hero] hit points from him. He cannot take damage while a [[Prelate]] minion is in play.\nIgnore the "<b>Forced Interrupt</b>" on the main scheme.\n<b>Forced Interrupt</b>: When Apocalypse is defeated, the players win the game.',
    boost: null,
    quantity: 1,
    resource_energy: null,
    resource_physical: null,
    resource_mental: null,
    resource_wild: null,
    hand_size: null,
    health: null,
    health_per_group: false,
    health_per_hero: false,
    thwart: null,
    thwart_cost: null,
    scheme: null,
    attack: null,
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
    traits: "Condition.",
    real_traits: "Condition.",
    meta: null,
    deck_requirements: null,
    deck_options: null,
    restrictions: null,
    flavor: "",
    illustrator: "Sebastián Guidobono",
    is_unique: false,
    hidden: true,
    permanent: false,
    double_sided: false,
    back_text: null,
    back_flavor: null,
    back_name: null,
    octgn_id: "1ab538aa-6ad1-4d9d-83a6-3ebc3a045105",
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
    url: "https://marvelcdb.com/card/45105b",
    imagesrc: null,
    spoiler: 1,
    backimagesrc: null,
  },
  imagesrc: "/bundles/cards/45105b.png", // what `withLocalArt` adds from the scan folder
} as unknown as RawCard;

const HEART_OF_THE_EMPIRE = {
  imagesrc: "/bundles/cards/45104a.png", // what `withLocalArt` adds from the scan folder
  ...{
    pack_code: "aoa",
    pack_name: "Age of Apocalypse",
    pack_legacy: false,
    pack_wave: 8,
    type_code: "side_scheme",
    type_name: "Side Scheme",
    faction_code: "encounter",
    faction_name: "Encounter",
    card_set_code: "apocalypse",
    card_set_name: "Apocalypse",
    card_set_type_name_code: "villain",
    linked_to_code: "45105b",
    linked_to_name: "No Longer Worthy",
    position: 104,
    set_position: 4,
    code: "45104a",
    name: "Heart of the Empire",
    real_name: "Heart of the Empire",
    cost_per_hero: false,
    cost_star: false,
    text: "Threat cannot be removed from this scheme while a [[Prelate]] minion is in play.\n<b>When Defeated</b>: The first player reveals a random set-aside [[Prelate]] minion. Deal each other player an encounter card. Flip this card over.",
    real_text:
      "Threat cannot be removed from this scheme while a [[Prelate]] minion is in play.\n<b>When Defeated</b>: The first player reveals a random set-aside [[Prelate]] minion. Deal each other player an encounter card. Flip this card over.",
    quantity: 1,
    health_per_group: false,
    health_per_hero: false,
    base_threat: 2,
    base_threat_fixed: true,
    base_threat_per_group: false,
    base_threat_star: false,
    escalation_threat_fixed: false,
    scheme_acceleration: 1,
    threat_fixed: false,
    threat_per_group: false,
    flavor: "Before you can challenge Apocalypse, you must fight your way through his tower.",
    illustrator: "Sebastián Guidobono",
    is_unique: false,
    hidden: false,
    permanent: false,
    double_sided: false,
    octgn_id: "1ab538aa-6ad1-4d9d-83a6-3ebc3a045104",
    attack_star: false,
    thwart_star: false,
    defense_star: false,
    health_star: false,
    recover_star: false,
    scheme_star: false,
    boost_star: false,
    threat_star: false,
    escalation_threat_star: false,
    url: "https://marvelcdb.com/card/45104a",
    spoiler: 1,
  },
  linked_card: NO_LONGER_WORTHY,
} as unknown as RawCard;

const TYRANTS_THRONE = {
  imagesrc: "/bundles/cards/45105a.png",
  ...{
    pack_code: "aoa",
    pack_name: "Age of Apocalypse",
    pack_legacy: false,
    pack_wave: 8,
    type_code: "side_scheme",
    type_name: "Side Scheme",
    faction_code: "encounter",
    faction_name: "Encounter",
    card_set_code: "apocalypse",
    card_set_name: "Apocalypse",
    card_set_type_name_code: "villain",
    linked_to_code: "45105b",
    linked_to_name: "No Longer Worthy",
    position: 105,
    set_position: 5,
    code: "45105a",
    name: "The Tyrant's Throne",
    real_name: "The Tyrant's Throne",
    cost_per_hero: false,
    cost_star: false,
    text: "Threat cannot be removed from this scheme while a [[Prelate]] minion is in play.\n<b>When Defeated</b>: The first player reveals a random set-aside [[Prelate]] minion. Deal each other player an encounter card. Flip this card over and reveal No Longer Worthy.",
    real_text:
      "Threat cannot be removed from this scheme while a [[Prelate]] minion is in play.\n<b>When Defeated</b>: The first player reveals a random set-aside [[Prelate]] minion. Deal each other player an encounter card. Flip this card over and reveal No Longer Worthy.",
    quantity: 1,
    health_per_group: false,
    health_per_hero: false,
    base_threat: 4,
    base_threat_fixed: true,
    base_threat_per_group: false,
    base_threat_star: false,
    escalation_threat_fixed: false,
    scheme_acceleration: 3,
    threat_fixed: false,
    threat_per_group: false,
    illustrator: "Sebastián Guidobono",
    is_unique: false,
    hidden: false,
    permanent: false,
    double_sided: false,
    octgn_id: "1ab538aa-6ad1-4d9d-83a6-3ebc3a045105",
    attack_star: false,
    thwart_star: false,
    defense_star: false,
    health_star: false,
    recover_star: false,
    scheme_star: false,
    boost_star: false,
    threat_star: false,
    escalation_threat_star: false,
    url: "https://marvelcdb.com/card/45105a",
    spoiler: 1,
  },
  linked_card: NO_LONGER_WORTHY,
} as unknown as RawCard;

const ADDED = AOA_CURATION.addedRecords?.[0] as AddedRecord;
const LINK = AOA_CURATION.linkOverrides?.[0] as LinkOverride;

function normalizeAoa(raw: readonly RawCard[], extra: Partial<PackCuration> = {}) {
  return normalizePack(raw, {
    ...AOA_CURATION,
    scenarios: [],
    starterDecks: [],
    corrections: [],
    errata: [],
    cardNotes: {},
    scriptingNotes: {},
    encounterSets: {},
    addedRecords: [ADDED],
    linkOverrides: [LINK],
    ...extra,
  });
}

function errorOf(raw: readonly RawCard[], extra: Partial<PackCuration>): string {
  try {
    normalizeAoa(raw, extra);
  } catch (e) {
    return (e as Error).message;
  }
  return "";
}

describe("PackCuration.addedRecords and linkOverrides (box card 104)", () => {
  const out = normalizeAoa([HEART_OF_THE_EMPIRE, TYRANTS_THRONE]);
  const card = (id: string) => out.cards.find((c) => c.id === id);

  it("45104a's other face is the added 45104b, a side scheme with threat 3 and 2 acceleration icons", () => {
    const heart = card("45104a");
    expect(heart?.type === "side_scheme" && heart.otherFaceId).toBe("45104b");
    const citadel = card("45104b");
    expect(citadel?.name).toBe("The Towering Citadel");
    expect(citadel?.type).toBe("side_scheme");
    expect(citadel?.type === "side_scheme" && citadel.startingThreat).toEqual({ base: 3, perPlayer: 0 });
    expect(citadel?.type === "side_scheme" && citadel.icons).toEqual(["acceleration", "acceleration"]);
    expect(citadel?.type === "side_scheme" && citadel.otherFaceId).toBe("45104a");
  });

  it("45105a's other face is 45105b, which appears exactly once", () => {
    const throne = card("45105a");
    expect(throne?.type === "side_scheme" && throne.otherFaceId).toBe("45105b");
    expect(out.cards.filter((c) => c.id === "45105b").length).toBe(1);
  });

  it("an added record whose code already exists in raw is an error", () => {
    const dup = { ...ADDED, record: { ...ADDED.record, code: "45105a" } as RawCard };
    expect(errorOf([HEART_OF_THE_EMPIRE, TYRANTS_THRONE], { addedRecords: [dup], linkOverrides: [] })).toContain(
      "added record 45105a: MarvelCDB already has a record with this code",
    );
  });

  it("an override whose front is missing is an error", () => {
    const bad = { ...LINK, front: "45199a" };
    expect(errorOf([HEART_OF_THE_EMPIRE, TYRANTS_THRONE], { linkOverrides: [bad] })).toContain(
      "link override 45199a -> 45104b: front record 45199a is missing",
    );
  });

  it("an override whose target is missing is an error", () => {
    const bad = { ...LINK, back: "45199b" };
    expect(errorOf([HEART_OF_THE_EMPIRE, TYRANTS_THRONE], { addedRecords: [], linkOverrides: [bad] })).toContain(
      "link override 45104a -> 45199b: target record 45199b is missing",
    );
  });

  it("an override that restates the link MarvelCDB already has is an error", () => {
    const bad = { ...LINK, back: "45105b" };
    expect(errorOf([HEART_OF_THE_EMPIRE, TYRANTS_THRONE], { addedRecords: [], linkOverrides: [bad] })).toContain(
      "link override 45104a -> 45105b: MarvelCDB already links 45104a to 45105b",
    );
  });
});

describe("Age of Apocalypse starter decks (MC45 p. 22), checked against raw before the pack is emitted", () => {
  const raw = JSON.parse(readFileSync(new URL("../../raw/marvelcdb/aoa.json", import.meta.url), "utf8")) as {
    cards: RawCard[];
  };
  const byCode = new Map(raw.cards.map((c) => [c.code, c]));
  const sum = (d: { cards: Readonly<Record<string, number>> }, from: number, to: number) =>
    Object.entries(d.cards)
      .filter(([code]) => Number(code) >= from && Number(code) <= to)
      .reduce((n, [, q]) => n + q, 0);
  const expected = [
    { id: "bishop-leadership", hero: [45002, 45010, 15], aspect: [45011, 45019, 20], basic: [45020, 45024, 5] },
    { id: "magik-aggression", hero: [45031, 45040, 15], aspect: [45041, 45047, 16], basic: [45048, 45052, 9] },
  ] as const;

  for (const e of expected) {
    const deck = AOA_CURATION.starterDecks.find((d) => d.id === e.id);
    it(`${e.id} is 40 cards in the printed sections`, () => {
      expect(deck).toBeDefined();
      if (!deck) return;
      expect(sum(deck, 0, Infinity)).toBe(40);
      for (const [from, to, n] of [e.hero, e.aspect, e.basic]) expect(sum(deck, from, to)).toBe(n);
    });
    it(`${e.id} lists only raw codes within their raw quantity`, () => {
      if (!deck) throw new Error("deck missing");
      for (const [code, qty] of Object.entries(deck.cards)) {
        const card = byCode.get(code);
        expect(card, code).toBeDefined();
        expect(qty, `${code} ${card?.name}`).toBeLessThanOrEqual(card?.quantity ?? 0);
      }
      expect(byCode.get(deck.identityCode)).toBeDefined();
      expect(byCode.get(deck.obligationCode)).toBeDefined();
      for (const code of deck.nemesisCodes) expect(byCode.get(code), code).toBeDefined();
    });
  }
});

/**
 * The five Age of Apocalypse scenario records (docs/phase7-wave8.md section 1.10, 1.21, data step 5), against the real
 * raw pack. Two things stand in for work that is not this step's: 45015 Sidekick (gap 2, its attach rule is not parsed
 * yet) is left out with the starter decks that list it, and every record without an image gets a made-up local one,
 * because the scans are gitignored and a clean checkout has none.
 */
describe("Age of Apocalypse scenario records, normalized from the real raw pack", () => {
  const rawPack = JSON.parse(readFileSync(new URL("../../raw/marvelcdb/aoa.json", import.meta.url), "utf8")) as {
    cards: RawCard[];
  };
  const records = rawPack.cards.filter((c) => c.code !== "45015");
  const allCodes = new Set(records.flatMap((c) => [c.code, ...(c.linked_card ? [c.linked_card.code] : [])]));
  const out = normalizePack(withLocalArt(records, allCodes), { ...AOA_CURATION, starterDecks: [] });
  const cardById = new Map(out.cards.map((c) => [c.id as string, c]));
  const setIds = new Set(out.encounterSets.map((e) => e.id as string));
  const scenario = (id: string) => {
    const s = out.scenarios.find((x) => x.id === id);
    if (!s) throw new Error(`no scenario ${id}`);
    return s;
  };
  const villain = (id: string) => {
    const c = cardById.get(id);
    if (c?.type !== "villain") throw new Error(`${id} is not a villain card`);
    return c;
  };
  const stageNumbers = (id: string) => villain(id).sides.map((side) => side.stages.map((st) => st.stageNumber));

  it("emits exactly the five records, in box order, all in the aoa pack", () => {
    expect(out.scenarios.map((s) => s.id)).toEqual([
      "unus",
      "four-horsemen",
      "apocalypse",
      "dark-beast",
      "en-sabah-nur",
    ]);
    for (const s of out.scenarios) expect(s.packCode).toBe("aoa");
  });

  it("every card id, set id and main scheme a record names exists in the normalized pack (Core's Standard and Expert aside)", () => {
    const core = new Set(["standard", "expert"]);
    for (const s of out.scenarios) {
      const cardIds = [
        s.villainCardId,
        s.mainSchemeCardId,
        ...(s.setAsideCardIds ?? []),
        ...(s.setAsideVillainCardIds ?? []),
        ...(s.multipleVillains?.villains.flatMap((v) => [v.villainCardId, ...(v.sideBCardId ? [v.sideBCardId] : [])]) ??
          []),
      ];
      for (const id of cardIds) expect(cardById.has(id), `${s.id}: card ${id}`).toBe(true);
      const sets = [
        ...s.encounterSetIds,
        ...s.recommendedModularSetIds,
        ...s.standardEncounterSetIds,
        ...s.expertEncounterSetIds,
      ];
      for (const id of sets) expect(core.has(id) || setIds.has(id), `${s.id}: set ${id}`).toBe(true);
      expect(s.standardEncounterSetIds).toEqual(["standard"]);
      expect(s.expertEncounterSetIds).toEqual(["expert"]);
      expect(cardById.get(s.mainSchemeCardId)?.type).toBe("main_scheme");
    }
  });

  it("unus: Unus I to III in one card (II and III in expert), Hunting Gene Traitors, Unus and Infinites, Dystopian Nightmare", () => {
    const s = scenario("unus");
    expect(s.villainCardId).toBe("45059");
    expect(stageNumbers("45059")).toEqual([[1, 2, 3]]);
    expect(s.villainStages).toEqual({ standard: [1, 2], expert: [2, 3] });
    expect(s.mainSchemeCardId).toBe("45062a");
    expect(s.encounterSetIds).toEqual(["unus", "infinites"]);
    expect(s.recommendedModularSetIds).toEqual(["dystopian_nightmare"]);
    expect(s.modularSetCount).toBe(1);
    expect(s.multipleVillains).toBeUndefined();
    expect(s.victory).toBeUndefined();
    // Gene Pool is put into play by the setup keyword, so nothing is set aside.
    expect(s.setAsideCardIds).toBeUndefined();
  });

  it("four-horsemen: four A cards, each with its own B card, a shared deck, set aside until the 1A Setup", () => {
    const s = scenario("four-horsemen");
    const mv = s.multipleVillains;
    if (!mv) throw new Error("no multipleVillains");
    expect(s.villainCardId).toBe("45081a");
    expect(mv.villains.map((v) => v.villainCardId)).toEqual(["45081a", "45082a", "45083a", "45084a"]);
    expect(mv.villains.map((v) => v.sideBCardId)).toEqual(["45081b", "45082b", "45083b", "45084b"]);
    expect(mv.villains.map((v) => villain(v.villainCardId).name)).toEqual(["War", "Famine", "Pestilence", "Death"]);
    for (const v of mv.villains) {
      const b = villain(v.sideBCardId as string);
      expect(b.name).toBe(villain(v.villainCardId).name);
      expect(stageNumbers(v.villainCardId)).toEqual([[1]]);
      expect(stageNumbers(b.id as string)).toEqual([[2]]);
      expect(v.encounterSetIds).toEqual([]);
    }
    expect(mv.encounterDecks).toBe("shared");
    expect(mv.winCondition).toBe("allVillainsDefeated");
    expect(mv.atSetup).toBe("setAside");
    expect(s.villainStages).toEqual({ standard: [1, 1], expert: [2, 2] });
    expect(s.expertVillains).toBeUndefined();
    expect(s.mainSchemeCardId).toBe("45085a");
    expect(s.encounterSetIds).toEqual(["four_horsemen"]);
    expect(s.recommendedModularSetIds).toEqual(["dystopian_nightmare", "hounds"]);
    expect(s.modularSetCount).toBe(2);
  });

  it("apocalypse: one four-stage villain (II to IV, III and IV in expert), Prelates and The Tyrant's Throne set aside", () => {
    const s = scenario("apocalypse");
    expect(s.villainCardId).toBe("45101a");
    expect(stageNumbers("45101a")).toEqual([[1, 2, 3, 4]]);
    expect(s.villainStages).toEqual({ standard: [2, 4], expert: [3, 4] });
    expect(s.victory).toBe("cardAbility");
    expect(s.mainSchemeCardId).toBe("45103a");
    expect(s.encounterSetIds).toEqual(["apocalypse", "prelates"]);
    expect(s.recommendedModularSetIds).toEqual(["dark_riders", "infinites"]);
    expect(s.modularSetCount).toBe(2);
    expect(s.setAsideCardIds).toEqual(["45179b", "45180b", "45181b", "45182b", "45183b", "45105a"]);
    for (const id of s.setAsideCardIds?.slice(0, 5) ?? []) {
      const prelate = cardById.get(id);
      expect(prelate?.type).toBe("minion");
      expect(prelate && "encounterSetIds" in prelate && prelate.encounterSetIds).toEqual(["prelates"]);
    }
    expect(cardById.get("45105a")?.name).toBe("The Tyrant's Throne");
    // Heart of the Empire (45104a) is revealed from the deck, not set aside.
    expect(s.setAsideCardIds).not.toContain("45104a");
  });

  it("dark-beast: Dark Beast I to III (II and III in expert), the three Setting sets required and set aside whole", () => {
    const s = scenario("dark-beast");
    expect(s.villainCardId).toBe("45118");
    expect(stageNumbers("45118")).toEqual([[1, 2, 3]]);
    expect(s.villainStages).toEqual({ standard: [1, 2], expert: [2, 3] });
    expect(s.mainSchemeCardId).toBe("45121a");
    expect(s.encounterSetIds).toEqual(["dark_beast", "savage_land", "genosha", "blue_moon"]);
    expect(s.recommendedModularSetIds).toEqual(["dystopian_nightmare"]);
    expect(s.modularSetCount).toBe(1);
    const settingCards = out.cards
      .filter(
        (c) =>
          "encounterSetIds" in c &&
          c.encounterSetIds.some((id) => ["savage_land", "genosha", "blue_moon"].includes(id)),
      )
      .map((c) => c.id as string);
    expect(settingCards).toHaveLength(20);
    expect([...(s.setAsideCardIds ?? [])].sort()).toEqual([...settingCards].sort());
    expect(s.victory).toBeUndefined();
  });

  it("en-sabah-nur: the three-sided Apocalypse starting on Biomorph, a two-stage main scheme, two modular sets", () => {
    const s = scenario("en-sabah-nur");
    expect(s.villainCardId).toBe("45184a");
    const apoc = villain("45184a");
    expect(apoc.sides.map((side) => side.side)).toEqual(["A", "B", "C"]);
    expect(apoc.startingSide).toBe("A");
    expect(apoc.sides.map((side) => side.stages[0]?.traits)).toEqual([
      ["MUTANT", "BIOMORPH"],
      ["MUTANT", "CYBERPATH"],
      ["MUTANT", "GIANT"],
    ]);
    expect(stageNumbers("45184a")).toEqual([
      [1, 2, 3],
      [1, 2, 3],
      [1, 2, 3],
    ]);
    expect(s.villainStages).toEqual({ standard: [1, 2], expert: [2, 3] });
    expect(s.mainSchemeCardId).toBe("45147a");
    const deck = cardById.get("45147a");
    expect(deck?.type === "main_scheme" && deck.stages.map((st) => [st.stageNumber, st.name])).toEqual([
      [1, undefined],
      [2, "The Rise of Apocalypse"],
    ]);
    expect(s.encounterSetIds).toEqual(["en_sabah_nur"]);
    expect(s.recommendedModularSetIds).toEqual(["celestial_tech", "clan_akkaba"]);
    expect(s.modularSetCount).toBe(2);
    expect(s.victory).toBeUndefined();
  });
});

// Real raw records of the Nightcrawler pack's two side schemes whose scans disagree with MarvelCDB.
const BRIMSTONE_DIMENSION = {
  pack_code: "ncrawler",
  pack_name: "Nightcrawler",
  pack_legacy: false,
  pack_wave: 8,
  type_code: "side_scheme",
  type_name: "Side Scheme",
  faction_code: "encounter",
  faction_name: "Encounter",
  card_set_code: "nightcrawler_nemesis",
  card_set_name: "Nightcrawler Nemesis",
  card_set_type_name_code: "nemesis",
  position: 28,
  set_position: 2,
  code: "48028",
  name: "Brimstone Dimension",
  real_name: "Brimstone Dimension",
  cost_per_hero: false,
  cost_star: false,
  text: "<b>When Defeated</b>: The player who defeated this scheme finds Azazel and deals him to themself as a facedown encounter card.",
  real_text:
    "<b>When Defeated</b>: The player who defeated this scheme finds Azazel and deals him to themself as a facedown encounter card.",
  boost: 3,
  quantity: 1,
  health_per_group: false,
  health_per_hero: false,
  base_threat: 5,
  base_threat_fixed: true,
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
  url: "https://marvelcdb.com/card/48028",
  imagesrc: "/bundles/cards/48028.png",
  spoiler: 1,
} as unknown as RawCard;

const THE_CRAZY_GANG = {
  ...BRIMSTONE_DIMENSION,
  card_set_code: "crazy_gang",
  card_set_name: "Crazy Gang",
  card_set_type_name_code: "modular",
  position: 33,
  set_position: 1,
  code: "48033",
  name: "The Crazy Gang",
  real_name: "The Crazy Gang",
  text: "<b>Forced Response</b>: After a non-[[Elite]] minion schemes against a player, deal that minion to that player as a facedown encounter card. Then, if there is more than 1 player in the game, pass that facedown encounter card to the next player.",
  real_text:
    "<b>Forced Response</b>: After a non-[[Elite]] minion schemes against a player, deal that minion to that player as a facedown encounter card. Then, if there is more than 1 player in the game, pass that facedown encounter card to the next player.",
  boost: 2,
  base_threat: 2,
  scheme_acceleration: 1,
  url: "https://marvelcdb.com/card/48033",
  imagesrc: "/bundles/cards/48033.png",
} as unknown as RawCard;

const brimstoneCorrection: Correction = {
  code: "48028",
  schemeIcons: { hazard: 1 },
  reason: "MarvelCDB sends scheme_hazard null",
  evidence: "scan: assets/card-art/bundles/cards/48028.png prints one hazard icon",
};
const crazyGangCorrection: Correction = {
  code: "48033",
  startingThreatPerPlayer: true,
  reason: "MarvelCDB sends base_threat_fixed true",
  evidence: "scan: assets/card-art/bundles/cards/48033.png prints 2 with the per player icon",
};

describe("Correction.schemeIcons and Correction.startingThreatPerPlayer (side schemes whose scan disagrees with raw)", () => {
  const sideScheme = (ctx: ReturnType<typeof run>["ctx"], code: string) => {
    const card = ctx.cards.find((c) => c.id === code);
    if (card?.type !== "side_scheme") throw new Error(`${code} is not an emitted side scheme`);
    return card;
  };

  it("48028 emits the hazard icon with the correction, and none without it", () => {
    const withFix = run([BRIMSTONE_DIMENSION], [brimstoneCorrection]);
    expect(withFix.ctx.errors).toEqual([]);
    expect(sideScheme(withFix.ctx, "48028").icons).toEqual(["hazard"]);
    expect(sideScheme(withFix.ctx, "48028").startingThreat).toEqual({ base: 5, perPlayer: 0 });
    expect(sideScheme(withFix.ctx, "48028").boostIcons).toBe(3);
    expect([...withFix.ctx.usedCorrections]).toEqual([0]);
    const without = run([BRIMSTONE_DIMENSION]);
    expect(sideScheme(without.ctx, "48028").icons).toEqual([]);
  });

  it("48033 emits a per player starting threat with the correction and keeps its icon and boost", () => {
    const withFix = run([THE_CRAZY_GANG], [crazyGangCorrection]);
    expect(withFix.ctx.errors).toEqual([]);
    const card = sideScheme(withFix.ctx, "48033");
    expect(card.startingThreat).toEqual({ base: 0, perPlayer: 2 });
    expect(card.icons).toEqual(["acceleration"]);
    expect(card.boostIcons).toBe(2);
    expect([...withFix.ctx.usedCorrections]).toEqual([0]);
    const without = run([THE_CRAZY_GANG]);
    expect(sideScheme(without.ctx, "48033").startingThreat).toEqual({ base: 2, perPlayer: 0 });
    expect(sideScheme(without.ctx, "48033").icons).toEqual(["acceleration"]);
  });
});

describe("Trickster Takeover (`tt`), normalized from the real raw pack: per group values and the God of Lies shapes", () => {
  const rawPack = JSON.parse(readFileSync(new URL("../../raw/marvelcdb/tt.json", import.meta.url), "utf8")) as {
    cards: RawCard[];
  };
  const allCodes = new Set(rawPack.cards.flatMap((c) => [c.code, ...(c.linked_card ? [c.linked_card.code] : [])]));
  const out = normalizePack(withLocalArt(rawPack.cards, allCodes), TT_CURATION);
  const cardById = new Map(out.cards.map((c) => [c.id as string, c]));

  it("normalizes with no errors (normalizePack throws on any)", () => {
    expect(out.cards).toHaveLength(63);
  });

  it("per group values: 55028b target threat, 55041 hit points, 55046 starting threat; none emitted as per hero", () => {
    const worlds = cardById.get("55028a");
    expect(worlds?.type === "main_scheme" && worlds.stages[0]?.targetThreat).toEqual({
      base: 0,
      perPlayer: 0,
      perGroup: 2,
    });
    const mangog = cardById.get("55041");
    expect(mangog?.type === "minion" && [mangog.hp, mangog.hpPerGroup, mangog.hpPerPlayer]).toEqual([
      10,
      true,
      undefined,
    ]);
    const door = cardById.get("55046");
    expect(door?.type === "side_scheme" && door.startingThreat).toEqual({ base: 0, perPlayer: 0, perGroup: 7 });
  });

  it("a per hero value elsewhere in the pack carries no perGroup key", () => {
    const loki = cardById.get("55027a");
    expect(loki?.type === "villain" && loki.sides[0]?.stages[0]?.hp).toEqual({ base: 0, perPlayer: 20 });
    const tango = cardById.get("55060");
    expect(tango?.type === "side_scheme" && "perGroup" in tango.startingThreat).toBe(false);
  });

  it("Loki, God of Lies (digit labels 1 and 2) is one two-sided villain whose faces share a title", () => {
    const loki = cardById.get("55027a");
    if (loki?.type !== "villain") throw new Error("55027a is not a villain");
    expect(loki.sides.map((s) => [s.side, s.name, s.stages.map((st) => st.stageNumber)])).toEqual([
      ["A", "Loki, God of Lies", [1]],
      ["B", "Loki, God of Lies", [1]],
    ]);
    expect(loki.sides[0]?.stages[0]?.stageLabel).toBeUndefined();
  });

  it("each Avatar of Loki is one two-sided villain, side A the Avatar and side B Fading Figment", () => {
    for (const [code, name] of [
      ["55029a", "Loki the Rascal"],
      ["55030a", "Loki the Miscreant"],
      ["55031a", "Loki the Knave"],
      ["55032a", "Loki the Wretch"],
    ] as const) {
      const card = cardById.get(code);
      if (card?.type !== "villain") throw new Error(`${code} is not a villain`);
      expect(card.sides.map((s) => s.name)).toEqual([name, "Fading Figment"]);
      expect(card.sides[1]?.stages[0]?.hp).toEqual({ base: 99, perPlayer: 0 });
    }
  });

  it("differing face titles are an error unless the curation opts in", () => {
    expect(() =>
      normalizePack(withLocalArt(rawPack.cards, allCodes), { ...TT_CURATION, villainFaceNamesMayDiffer: [] }),
    ).toThrow(/villain face names differ/);
  });

  it("Worlds Collide (bare A/B labels) is its own one-stage main scheme beside Mischief and Mayhem's numbered chain", () => {
    const worlds = cardById.get("55028a");
    const mischief = cardById.get("55033a");
    if (worlds?.type !== "main_scheme" || mischief?.type !== "main_scheme")
      throw new Error("expected two main schemes");
    expect(worlds.stages.map((s) => [s.stageNumber, s.stageLetter, s.dashedValues])).toEqual([
      [1, "A", ["startingThreat", "acceleration"]],
    ]);
    expect(mischief.stages.map((s) => [s.stageNumber, s.name])).toEqual([[1, undefined]]);
    expect(mischief.stages[0]?.startingThreat).toEqual({ base: 0, perPlayer: 0 });
  });

  it("attachments with no attach sentence take the curated host (Hypnotic Gaze to each identity; Intense Focus to the Avatar)", () => {
    for (const code of ["55007a", "55008a", "55009a", "55010a", "55011a"]) {
      const card = cardById.get(code);
      expect(card?.type === "attachment" && card.attachesTo).toEqual({ kind: "yourIdentity" });
    }
    const focus = cardById.get("55034a");
    expect(focus?.type === "attachment" && focus.attachesTo).toEqual({
      kind: "qualified",
      category: "villain",
      trait: "AVATAR OF LOKI",
    });
    const scepter = cardById.get("55036");
    expect(scepter?.type === "attachment" && scepter.attachesTo).toEqual({
      kind: "qualified",
      category: "villain",
      trait: "AVATAR OF LOKI",
    });
  });
});
