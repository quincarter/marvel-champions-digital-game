/**
 * Shadowland (MC65) scenario records (spec docs/phase7-shadowland.md section 6, task D4), authored the way Fear No Evil's
 * were (`fne.ts` `SCENARIO_RECORDS`): three `ScenarioCuration`s for `shadows-in-the-night`, `shadow-labyrinth` and
 * `heart-of-shadow`, built from the box insert (docs/campaign-modes/markdown/mc65_shadowland.md, "insert", printed pages)
 * and the transcribed cards in `shadowland-encounter/`.
 *
 * NOT WIRED INTO `SHADOWLAND_CURATION.scenarios` YET. `normalizeScenarios` needs a main scheme card per scenario
 * (`mainSchemeIdBySet`, an A and a B face together) and none of the three exists in the data:
 * - Scenario #1: the main scheme faces and its 1A card are among the unseen Shadows in the Night faces (collector 1, 2, 6,
 *   7, 9);
 * - Scenario #2: Into the Labyrinth 38B and Chamber of Vile Secrets 39B are transcribed but held back in
 *   `SHADOW_LABYRINTH_B_FACES_PENDING_A` until the 38A and 39A scans exist;
 * - Scenario #3: Heart of Shadow's main scheme faces are among collector 58 to 63.
 * When those land, set `scenarios: SHADOWLAND_SCENARIO_RECORDS` in `shadowland.ts` (and re-emit); the sets, villains and
 * modular set codes below are already checked against the emitted data by `src/data/shadowland.test.ts`.
 *
 * Insert facts used: three scenarios in order (p. 4); the three modular sets "can be used in any scenario" (p. 4); Black
 * Flower cannot be a modular set in the campaign (p. 5, see `SHADOWLAND_CAMPAIGN`).
 * The insert prints NO "Encounter Deck: ..." line and no recommended modular sets (unlike MC60), so the modular picks are
 * engine defaults tied to each scenario's theme and are flagged [unchecked] for the owner.
 */
import type { ScenarioCuration } from "./types.ts";

/**
 * Scenario #1's villain choice. The six Dark Protege villains share ONE encounter set (`dark_protege`, 16 cards), unlike
 * Fear No Evil's five underlings, which each had a set of their own, so `ScenarioCuration.villainOptionSetCodes` (keyed by
 * encounter set; `Scenario.villainOptions` requires distinct sets) cannot express this choice. The choice is therefore
 * recorded here by villain card (code of the A face) with the linked cards each villain brings in; the schema extension
 * (a card-keyed option, linked cards set aside unless their villain is chosen) is an engine/schema follow-up.
 *
 * `linkedCardCodes` is each villain's linked cards (insert p. 2 "Linked (Card Title)": set aside unless a named card is in
 * the encounter deck), read off the printed "Linked (A, B, or C)" lines of the four transcribed linked cards: Art of the
 * Kill 65018, Krahllak's Blessing 65019, Darkness Within 65026, Embraced by Darkness 65027. Linked cards 65020 to 65025
 * (six faces) have no scan, so their villains' lists are incomplete and are NOT guessed.
 */
export const SHADOWLAND_VILLAIN_CHOICE: readonly {
  readonly name: string;
  readonly villainCardCode: string;
  readonly linkedCardCodes: readonly string[];
}[] = [
  { name: "Archpriestess", villainCardCode: "65012a", linkedCardCodes: ["65019", "65026"] },
  { name: "Daredevil", villainCardCode: "65013a", linkedCardCodes: ["65019", "65027"] },
  { name: "Elektra", villainCardCode: "65014a", linkedCardCodes: ["65018", "65027"] },
  { name: "Gorgon", villainCardCode: "65015a", linkedCardCodes: ["65019", "65026"] },
  { name: "Lady Bullseye", villainCardCode: "65016a", linkedCardCodes: ["65018", "65026"] },
  { name: "White Tiger", villainCardCode: "65017a", linkedCardCodes: ["65018", "65027"] },
];

/** Default villain for scenario #1: the first of the log's six (Archpriestess). */
const DEFAULT_VILLAIN_CODE = "65012a";

export const SHADOWLAND_SCENARIO_RECORDS: readonly ScenarioCuration[] = [
  {
    id: "shadows-in-the-night",
    name: "Shadows in the Night",
    // Villain: one of the six Dark Protege villains (`SHADOWLAND_VILLAIN_CHOICE`); their six cards collide on one set, so
    // the record names the default card directly (as Kang's does).
    villainSetCode: "dark_protege",
    villainCardCode: DEFAULT_VILLAIN_CODE,
    mainSchemeSetCode: "shadows_in_the_night",
    additionalEncounterSetCodes: ["shadows_in_the_night"],
    // [unchecked] The insert prints no pick. Ninja Swarm suits the story (p. 7: "countless ninjas surround the fortress").
    recommendedModularSetCodes: ["ninja_swarm"],
    standardSetCodes: ["standard"],
    expertSetCodes: ["expert"],
    // Each Dark Protege villain card shows one stage letter ("A") in the previews; the B sides are not seen, so one stage
    // in both modes until they are.
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 1,
    evidence:
      'Insert pp. 4, 7 to 10: "Scenario #1 Shadows in the Night"; the villain is one of the six Dark Protege villains (p. 4: "six villain cards and 10 other encounter cards linked to those villains"; FFG article: the villain selection compares to the non-Kingpin Fear No Evil scenarios). Campaign instructions (p. 9): +1 [per_hero] threat on the main scheme, Creeping Corruption from Black Flower. The scenario set is Shadows in the Night (13). No recommended modular set is printed: ninja_swarm is an engine default.',
  },
  {
    id: "shadow-labyrinth",
    name: "Shadow Labyrinth",
    villainSetCode: "shadow_labyrinth",
    villainCardCode: "65037",
    mainSchemeSetCode: "shadow_labyrinth",
    // [unchecked] p. 12: "The Deadly Contraptions modular set includes seven TRAP! treachery cards" and builds the trap
    // deck with this set's Whisper in the Dark; the scenario's cards reveal from the trap deck.
    recommendedModularSetCodes: ["deadly_contraptions"],
    standardSetCodes: ["standard"],
    expertSetCodes: ["expert"],
    // Shifting Corridors: one card, one stage (infinite hit points, 65037). Main scheme 1A/1B then 2A/2B (Into the
    // Labyrinth, Chamber of Vile Secrets).
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 1,
    evidence:
      'Insert pp. 11 to 15: "Scenario #2 Shadow Labyrinth"; pp. 12 to 13 (trap deck, infinite hit points, passage counters); campaign instructions (p. 14): +3 [per_hero] threat on the main scheme. Villain Shifting Corridors (65037); main schemes Into the Labyrinth (38) then Chamber of Vile Secrets (39), whose 1B text places passage counters (10 [per_hero], 7 in expert mode). No recommended modular set is printed: deadly_contraptions is an engine default.',
  },
  {
    id: "heart-of-shadow",
    name: "Heart of Shadow",
    villainSetCode: "heart_of_shadow",
    villainCardCode: "65057",
    mainSchemeSetCode: "heart_of_shadow",
    // [unchecked] Krahllak's own text counts corruption counters on Creeping Corruption, so a standalone game wants Black
    // Flower. In the campaign Black Flower cannot be picked (p. 5); the campaign instructions supply the upgrades.
    recommendedModularSetCodes: ["black_flower"],
    standardSetCodes: ["standard"],
    expertSetCodes: ["expert"],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 1,
    evidence:
      'Insert pp. 16 to 17: "Scenario #3 Heart of Shadow"; campaign instructions (p. 17): no extra main scheme threat is printed, the four minions of the Dark Protege set (Archpriestess, Gorgon, Lady Bullseye, White Tiger) are dealt facedown at random, one per player. Villain Krahllak (65057, one stage previewed, HP 18 [per_hero]). No recommended modular set is printed: black_flower is an engine default for a standalone game.',
  },
];
