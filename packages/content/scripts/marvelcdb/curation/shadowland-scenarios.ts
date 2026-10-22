/**
 * Shadowland (MC65) scenario records (spec docs/phase7-shadowland.md section 6, task D4), authored the way Fear No Evil's
 * were (`fne.ts` `SCENARIO_RECORDS`): three `ScenarioCuration`s for `shadows-in-the-night`, `shadow-labyrinth` and
 * `heart-of-shadow`, built from the box insert (docs/campaign-modes/markdown/mc65_shadowland.md, "insert", printed pages),
 * each scenario's main scheme 1A "Contents" and "Setup" lines, and the transcribed cards in `shadowland-encounter/`.
 * Wired in through `scenarios: SHADOWLAND_SCENARIO_RECORDS` in `shadowland.ts`.
 *
 * Insert facts used: three scenarios in order (p. 4); the three modular sets "can be used in any scenario" (p. 4); Black
 * Flower cannot be a modular set in the campaign (p. 5, see `SHADOWLAND_CAMPAIGN`).
 * Each main scheme's 1A Contents prints "One modular encounter set (Ninja Swarm)", so Ninja Swarm is the recommended
 * modular set of all three. The insert prints no "Encounter Deck" line; the modular pick is the 1A Contents' own.
 *
 * VILLAINS AND STAGES (how the normalizer emits them):
 * - Dark Protege villains (12A to 17A): each villain is ONE double-sided card with sides A (HP 15 per hero) and B (HP 18
 *   per hero), each a single stage 1 (`PackCuration.villainFlipSets`). The main scheme flips A to B (65001B/65002B
 *   Forced Interrupt: "When the villain would be defeated on side A, instead flip it to side B, reset its hit points ...
 *   If the villain is defeated on side B, the players win the game"), so the A->B change is NOT a stage advance:
 *   `villainStages` is [1, 1] in both modes and `victory` is the default `finalVillainStage` (defeat on side B wins).
 * - Krahllak (heart-of-shadow): one card with three one-sided stages I, II, III; Dark Invitation 1A: stages [1, 2] in
 *   standard mode, [2, 3] in expert mode.
 * - Shifting Corridors (shadow-labyrinth): one card, one stage, infinite hit points.
 */
import type { ScenarioCuration } from "./types.ts";

/**
 * The six Dark Protege villains with the five linked cards each brings in ("Linked (X, Y, or Z)" lines of the ten linked
 * cards; RRG p. 27 sets them aside, the 1A Setup lines of 65001A and 65038A shuffle the chosen villain's in; each linked card names three villains, so each villain has 5). The other five villains' cards stay
 * set aside; the test file re-derives this table from the emitted cards' printed Linked lines.
 */
export const SHADOWLAND_VILLAIN_CHOICE: readonly {
  readonly name: string;
  readonly villainCardCode: string;
  readonly linkedCardCodes: readonly string[];
}[] = [
  { name: "Archpriestess", villainCardCode: "65012a", linkedCardCodes: ["65019", "65022", "65023", "65024", "65026"] },
  { name: "Daredevil", villainCardCode: "65013a", linkedCardCodes: ["65019", "65021", "65023", "65025", "65027"] },
  { name: "Elektra", villainCardCode: "65014a", linkedCardCodes: ["65018", "65021", "65023", "65024", "65027"] },
  { name: "Gorgon", villainCardCode: "65015a", linkedCardCodes: ["65019", "65020", "65022", "65025", "65026"] },
  { name: "Lady Bullseye", villainCardCode: "65016a", linkedCardCodes: ["65018", "65020", "65021", "65025", "65026"] },
  { name: "White Tiger", villainCardCode: "65017a", linkedCardCodes: ["65018", "65020", "65022", "65024", "65027"] },
];

/** Default option (a reader that knows nothing of the choice, and the fallback when no random draw is made): the first. */
const DEFAULT_VILLAIN_CODE = "65012a";

const VILLAIN_CARD_OPTIONS = {
  options: SHADOWLAND_VILLAIN_CHOICE.map(({ villainCardCode, linkedCardCodes }) => ({
    villainCardCode,
    linkedCardCodes,
  })),
  defaultCardCode: DEFAULT_VILLAIN_CODE,
  // 1A Setup: "Choose 1 random villain from that set".
  selection: "random" as const,
};

export const SHADOWLAND_SCENARIO_RECORDS: readonly ScenarioCuration[] = [
  {
    id: "shadows-in-the-night",
    name: "Shadows in the Night",
    // The scenario's own set holds the main schemes and environments; the villain is a Dark Protege card (the set is set
    // aside whole by 1A Setup), named directly because six villains share that set.
    villainSetCode: "shadows_in_the_night",
    villainCardCode: DEFAULT_VILLAIN_CODE,
    mainSchemeSetCode: "shadows_in_the_night",
    recommendedModularSetCodes: ["ninja_swarm"],
    standardSetCodes: ["standard"],
    expertSetCodes: ["expert"],
    // One double-sided card flipped A to B by the main scheme, not by stage advance (see the file header).
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 1,
    villainCardOptions: {
      ...VILLAIN_CARD_OPTIONS,
      // The chosen villain is put into play with its side A revealed.
      chosenVillain: "inPlay",
    },
    evidence:
      'Main scheme 65001 1A Contents: "Shadows in the Night, Dark Protégé, and Standard encounter sets. One modular encounter set (Ninja Swarm)." Setup: "Set the Dark Protégé encounter set aside. Choose 1 random villain from that set and reveal its side A, then shuffle each card linked to that villain into the encounter deck." 65001B/65002B: the villain flips A to B (HP reset) instead of being defeated on side A; defeated on side B wins. Insert pp. 4, 7 to 10; campaign instructions (p. 9): +1 [per_hero] threat on the main scheme, Creeping Corruption from Black Flower. RRG "Linked" (p. 27): linked cards are never in a deck and are set aside at setup; the 1A Setup above shuffles the 5 cards linked to the chosen villain in, so the other 5 stay set aside.',
  },
  {
    id: "shadow-labyrinth",
    name: "Shadow Labyrinth",
    villainSetCode: "shadow_labyrinth",
    villainCardCode: "65037",
    mainSchemeSetCode: "shadow_labyrinth",
    // 1A Contents: "Shadow Labyrinth, Dark Protégé, Deadly Contraptions, and Standard encounter sets": Deadly Contraptions is
    // required (it builds the trap deck, with this set's Whisper in the Dark); Dark Protégé is set aside (below).
    additionalEncounterSetCodes: ["deadly_contraptions"],
    recommendedModularSetCodes: ["ninja_swarm"],
    standardSetCodes: ["standard"],
    expertSetCodes: ["expert"],
    // Shifting Corridors: one card, one stage (infinite hit points, 65037). Main scheme 1A/1B then 2A/2B (Into the
    // Labyrinth, Chamber of Vile Secrets).
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 1,
    villainCardOptions: {
      ...VILLAIN_CARD_OPTIONS,
      // "(keep the chosen villain set aside)": Whisper in the Dark brings it in, 2A reveals it.
      chosenVillain: "setAside",
    },
    evidence:
      'Main scheme 65038 1A Contents: "Shifting Corridors (A). Shadow Labyrinth, Dark Protégé, Deadly Contraptions, and Standard encounter sets. One modular encounter set (Ninja Swarm)." Setup: "Create the trap deck. Set the Dark Protégé encounter set aside. Choose 1 random villain from that set, then shuffle each card linked to that villain into the encounter deck (keep the chosen villain set aside)." Insert pp. 11 to 15 (trap deck p. 12, infinite hit points and passage counters p. 13); campaign instructions (p. 14): +3 [per_hero] threat on the main scheme. 1B places 10 [per_hero] passage counters (7 in expert mode). RRG "Linked" (p. 27) sets linked cards aside; the 1A Setup above shuffles the cards linked to the chosen villain in.',
  },
  {
    id: "heart-of-shadow",
    name: "Heart of Shadow",
    villainSetCode: "heart_of_shadow",
    villainCardCode: "65057",
    mainSchemeSetCode: "heart_of_shadow",
    // 1A Contents: "Heart of Shadow, Black Flower, and Standard encounter sets": Black Flower is required. In the campaign it
    // cannot be a modular pick (p. 5); the campaign instructions supply the upgrades.
    additionalEncounterSetCodes: ["black_flower"],
    recommendedModularSetCodes: ["ninja_swarm"],
    standardSetCodes: ["standard"],
    expertSetCodes: ["expert"],
    // Dark Invitation 1A: "Krahllak (I) and Krahllak (II). (Krahllak (II) and Krahllak (III) instead for expert mode.)"
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 1,
    evidence:
      'Main scheme 65060 1A Contents: "Krahllak (I) and Krahllak (II). (Krahllak (II) and Krahllak (III) instead for expert mode.) Heart of Shadow, Black Flower, and Standard encounter sets. One modular encounter set (Ninja Swarm)." Krahllak is 65057 (I, HP 18), 65058 (II, HP 21), 65059 (III, HP 25), each one-sided. Insert pp. 16 to 17; campaign instructions (p. 17): no extra main scheme threat is printed, the four minions of the Dark Protégé set (Archpriestess, Gorgon, Lady Bullseye, White Tiger) are dealt facedown at random, one per player.',
  },
];
