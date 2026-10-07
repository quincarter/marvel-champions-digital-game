import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RawCard } from "./raw-types.ts";
import { bareCuration } from "./curation/empty.ts";
import type { AddedRecord, Correction, LinkOverride, PackCuration } from "./curation/types.ts";
import { AOA_CURATION } from "./curation/aoa.ts";
import { normalizePack } from "./normalize.ts";
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
    starterDecks: [],
    corrections: [],
    errata: [],
    cardNotes: {},
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
