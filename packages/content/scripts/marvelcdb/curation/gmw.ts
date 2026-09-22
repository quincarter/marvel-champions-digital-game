/**
 * Galaxy's Most Wanted (Cycle 3 in this repo's numbering — see below) curation: Groot, Rocket Raccoon and five
 * scenarios (Brotherhood of Badoon, Infiltrate the Museum, Escape the Museum, Nebula, Ronan the Accuser).
 * docs/phase7-wave3.md is the shared spec this pass closes out (§1.1, §1.2, §1.4, §1.7, §2.2, §4 Q3/Q7, §5).
 *
 * Evidence abbreviations:
 * - "raw": `packages/content/raw/marvelcdb/gmw.json`.
 * - "MC16 p.N": `docs/campaign-modes/markdown/mc16_galaxys_most_wanted.md` (converted from
 *   `docs/campaign-modes/mc16_galaxys_most_wanted_rules_website-compressed.pdf`), cited by its printed page.
 * - "RRG 1.8 p.66/67": `mc_rulesreference_v18_compressed.pdf`'s printed errata page.
 * - "wave3 §N": docs/phase7-wave3.md section N.
 *
 * **Cycle id.** `stld`/`gam`/`drax`/`vnm` (the four hero packs released alongside this box) are already emitted
 * under `cycle: { id: "cycle3", ... }` — kept here for consistency with those siblings rather than switched to a
 * "cycle2" id that would split one FFG cycle across two `CycleId`s in this repo's data. (FFG's own cycle numbering
 * calls Galaxy's Most Wanted "Cycle 2"; this repo's `id: "cycle3"` is an internal label carried over from before
 * this pack was curated, not a disagreement with FFG.)
 *
 * **The Collector's villain shape (wave3 §1.1, landed in `game-rules-architect`'s schema pass and
 * `normalize/villains.ts`'s `MODE_LABEL_RE` branch, this pass).** Escape the Museum's Collector prints `"A1"`/
 * `"A2"` (standard) and `"B1"`/`"B2"` (expert) — two physical double-sided villain cards sharing one
 * `card_set_code` (`escape_the_museum`), not two stages of one card. `normalizeVillains` now emits each mode as
 * its own single-stage, two-sided `VillainCard` (`16080a` standard, `16081a` expert) and leaves `villainIdBySet`
 * unset for the set (the same convention The Once and Future Kang's colliding-stage sets use), so the scenario
 * below names each card directly (`villainCardCode` / `expertVillains.villainCardCode`).
 *
 * **The Collector's back face is infinite HP, not "no HP printed"** (`VillainStage.infiniteHp`, wave3 §1.1):
 * raw `health: 0` on `16080b`/`16081b`. Its ATK/SCH are **not** dashed — `16080b` (standard) prints explicit
 * `attack: 0, scheme: 0` and `16081b` (expert) prints `attack: 2, scheme: 2`, unchanged from its front face — see
 * wave3 §1.1's own table. **Q7 answer, confirmed against the printed card images** (fetched
 * `marvelcdb.com/bundles/cards/16080b.png` and `16081b.png` and viewed directly this pass — not stored anywhere in
 * the repo, per CLAUDE.md's art boundary): 16080b ("A2") prints solid numeral badges reading **"0" SCH / "0"
 * ATK**, and 16081b ("B2") prints **"2" SCH / "2" ATK** — plainly "0"/"2", not the dashed "—" stat-box art RRG 1.8
 * "Dash (Value)" (p. 15) describes elsewhere. Both cards also print "HIT POINTS ∞" in their footer, confirming
 * `infiniteHp` against the card face directly rather than only against raw's `health: 0` encoding.
 *
 * **Campaign Challenge side schemes are emitted one card per face** (wave3 §1.4, landed in
 * `normalize/single-cards.ts`'s side-scheme flip-side branch, this pass): `16178a`/`16178b` … `16182a`/`16182b`,
 * each its own `SideSchemeCard` (no `flipSide` — that field doesn't exist on `SideSchemeCard`). Nothing flips
 * them in play; a campaign setup instruction (not built yet, C2) picks the face.
 *
 * **Badoon Headhunter (wave3 §4 Q3), settled directly by the RRG's own FAQ.** RRG 1.8's "Galaxy's Most Wanted
 * Expansion", "Modular Encounter Sets" (p. 61): "Q: In the Galaxy's Most Wanted Expansion, which sets are
 * considered modular encounter sets? A: If an encounter set is not scenario-specific (containing the name of that
 * scenario in its encounter set name area) or campaign-specific (containing the word 'Campaign' in its encounter
 * set name area), then it is modular. The eight modular encounter sets in the Galaxy's Most Wanted Expansion are:
 * Badoon Headhunter, Band of Badoon, Galactic Artifacts, Kree Militants, Menagerie Medley, Power Stone, Space
 * Pirates, and Ship Command." (Also in `mc_rulesreference_v18_compressed.md`, the plain-text conversion, ~line
 * 4492 — no page markers there, so the citation above is checked against the PDF directly.) MC16 p. 4 calls cards
 * #178–187 (Campaign Challenge *and* Badoon Headhunter) "campaign-specific encounter cards" — a looser, plain-
 * English use of the phrase than the FAQ's own defined term, which the FAQ answer itself resolves for the schema:
 * modular is the RRG's residual category once scenario-specific and campaign-specific (the printed "Campaign"
 * word) are excluded, and Badoon Headhunter is named in the modular list explicitly. **Answer: modular, not
 * schema-`campaignSpecific`.** Raw agrees structurally: both Badoon Headhunter's and Campaign Challenge's cards
 * carry `faction_code: "encounter"`, not `"campaign"` — unlike The Market (`the_market`, `faction_code:
 * "campaign"` on every card), which does print the "Campaign" word (RRG 1.8 "Campaign-Specific Card", p. 11:
 * "designated by the word 'Campaign' printed at the bottom of the card"). `EncounterSet.campaignSpecific` tracks
 * that printed word, which neither set carries, so `normalizeEncounterSets` (unchanged this pass) correctly
 * leaves both `false`. Neither set appears in any scenario's `recommendedModularSetCodes` below regardless (none
 * of the five 1A "Contents" texts name them — confirmed against raw): both are introduced only by campaign setup
 * (not built yet, C2), so standalone play never draws either on its own.
 *
 * **Precons: Groot (Protection) and Rocket Raccoon (Aggression), MC16 p. 20**, transcribed item-by-item and
 * cross-checked against raw by name, code and quantity — every item matched exactly (including the two "Nemesis
 * set" lines printed together under Rocket's own section: Rocket's own nemesis set — Vendetta, Blackjack O'Hare,
 * Blackjack's Bazooka, Planetary Invasion x2 — and Groot's — Blazing Inferno, Furnax, Fan the Flames x3 — each
 * cross-checked against its own identity's `nemesisEncounterSetId` rather than assumed from page position).
 */
import type { PackCuration } from "./types.ts";

export const GMW_CURATION: PackCuration = {
  packCode: "gmw",
  cycle: { id: "cycle3", name: "Cycle 3", order: 3 },
  pack: {
    name: "Galaxy's Most Wanted",
    releaseDate: "2021-04-02",
    releaseDateSource:
      'Hall of Heroes Galaxy\'s Most Wanted page (https://hallofheroeslcg.com/galaxys-most-wanted/): "Release date: April 2, 2021"',
  },
  outDir: "src/data/gmw",
  exportPrefix: "GMW",

  corrections: [
    {
      code: "16142",
      reason:
        'The Milano enters play through Setup ("Permanent. Setup. The first player controls the Milano."), never paid for from hand: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/16142), "Cost: —"',
      specialCost: "dash",
    },
    {
      code: "16068",
      reason:
        'MarvelCDB\'s own transcription typo: the reminder parenthetical after "Hinder 3[per_hero]." is missing its opening "(" ("...here.)" with no matching open), unlike every other Hinder X reminder in this pack (16066, 16112, 16144, 16178a–16182a). Uncorrected this doesn\'t break parsing (the reminder is still dropped as a trailing sentence), but the printed text is wrong.',
      evidence:
        "raw (16068); wave3 §1.7 (raw-data typo list); compared against 16066/16112/16144's identical reminder wording",
      textReplace: {
        find: "Hinder 3[per_hero]. When revealed, place 3[per_hero] threat here.)",
        replace: "Hinder 3[per_hero]. (When revealed, place 3[per_hero] threat here.)",
      },
    },
    {
      code: "16125",
      reason:
        'MarvelCDB\'s own transcription typo: "the take 1 damage for each poison counter here" should read "then take 1 damage for each poison counter here" — the Forced Interrupt lists two consequences of the trigger ("place 1 poison counter here, then take 1 damage..."), and "the take" doesn\'t parse as English at all.',
      evidence: "raw (16125); wave3 §1.7 (raw-data typo list)",
      textReplace: {
        find: "the take 1 damage for each poison counter here.",
        replace: "then take 1 damage for each poison counter here.",
      },
    },
    {
      code: "16159",
      reason:
        'MarvelCDB\'s own transcription typo: "discard the top card of the encounter deck? Take 1 damage" — the "?" mid-sentence is not a printed question; two clauses of one Hero Action ("... and discard the top card of the encounter deck. Take 1 damage for each boost icon...").',
      evidence:
        "raw (16159); wave3 §1.7 (raw-data typo list). Not independently confirmed against a card scan this pass — no PDF/image renderer was available in this environment (poppler/pdftoppm failed to build); high-confidence from grammar alone, flagged for a future scan check.",
      textReplace: {
        find: "discard the top card of the encounter deck? Take 1 damage",
        replace: "discard the top card of the encounter deck. Take 1 damage",
      },
    },
  ],
  errata: [
    {
      code: "16123",
      version: "RRG 1.8 p. 66 (Obedience Potion #123)",
      changedFields: ["text"],
      note: 'RRG 1.8: "Should read: \'Hero Action: Take 1 damage and spend [mental][mental] resources → discard this card. Any player can do this.\' (Changed reminder text to rules text.)" — raw\'s current text already reads exactly this. The pre-errata printed wording (a bare reminder parenthetical, no "Hero Action:" header) is not reconstructed here: no card scan was available this pass to confirm its exact original wording, so `text.printed` is left equal to `text.current` rather than guessed. Revisit with a scan.',
      evidence: "raw (16123); RRG 1.8 p. 66",
    },
    {
      code: "16125",
      version: "RRG 1.8 p. 66 (The Poison #125)",
      changedFields: ["text"],
      note: "RRG 1.8: \"Should read: 'Hero Action: Spend 3 resources of different types → discard this card. Any player can do this.' (Changed reminder text to rules text.)\" — raw's current text already reads exactly this (after the 16125 typo correction above). Same caveat as Obedience Potion: the pre-errata printed wording isn't reconstructed without a scan, so `text.printed` is left equal to `text.current`.",
      evidence: "raw (16125); RRG 1.8 p. 66",
    },
  ],

  scriptingNotes: {},
  cardNotes: {
    "16080a":
      'Collector (standard mode, wave3 §1.1): 16080a is the front face (health 8/player, ATK/SCH 1/1); its linked back face 16080b is the infinite-HP "Wounded" face (health 0 read as ∞, ATK/SCH explicit 0/0 — not dashed). Emitted as one two-sided VillainCard by normalize/villains.ts\'s MODE_LABEL_RE branch; villainIdBySet is left unset for the "escape_the_museum" set (two physical villain cards share it — standard and expert), so the scenario below names this card directly via villainCardCode.',
    "16081a":
      "Collector (expert mode): 16081a front face (health 10/player, ATK/SCH 2/2); linked back face 16081b is infinite HP with ATK/SCH unchanged at 2/2 (not 0/0 — confirmed from raw's explicit numeric fields, wave3 §4 Q7). Named directly via the scenario's expertVillains.villainCardCode.",
  },

  scenarios: [
    {
      id: "brotherhood-of-badoon",
      name: "Brotherhood of Badoon",
      villainSetCode: "brotherhood_of_badoon",
      // 1A "Contents" (raw 16061a): "Drang (I) and Drang (II). (Drang (II) and Drang(III) instead for expert
      // mode.) Brotherhood of Badoon, Ship Command, and Standard encounter sets. One modular encounter set (Band
      // of Badoon)."
      additionalEncounterSetCodes: ["ship_command"],
      recommendedModularSetCodes: ["band_of_badoon"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      evidence: 'MC16 p. 8, "Scenario 1 - Brotherhood of Badoon"; 1A Contents text (raw 16061a); wave3 §2.2',
    },
    {
      id: "infiltrate-the-museum",
      name: "Infiltrate the Museum",
      villainSetCode: "infiltrate_the_museum",
      // 1A "Contents" (raw 16073a): "Collector (I) and Collector (II). (Collector (II) and Collector (III)
      // instead for expert mode.) Infiltrate the Museum, Galactic Artifacts, and Standard encounter sets. One
      // modular encounter set (Menagerie Medley)."
      additionalEncounterSetCodes: ["galactic_artifacts"],
      recommendedModularSetCodes: ["menagerie_medley"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      evidence: 'MC16 p. 10, "Scenario 2 - Infiltrate the Museum"; 1A Contents text (raw 16073a); wave3 §2.2',
    },
    {
      id: "escape-the-museum",
      name: "Escape the Museum",
      villainSetCode: "escape_the_museum",
      // Two physical villain cards share this set (wave3 §1.1) — villainIdBySet is unset, so both modes are
      // named directly.
      villainCardCode: "16080a",
      expertVillains: { villainCardCode: "16081a", setAsideVillainCardCodes: [] },
      // 1A "Contents" (raw 16082a): "Collector (A1) (Collector (B1) instead for expert mode.) Escape the Museum,
      // Galactic Artifacts, Ship Command, and Standard encounter sets. One modular encounter set (Menagerie
      // Medley)." Ship Command starts set aside (1A "Setup": "Set aside the Ship Command modular encounter set")
      // and is shuffled back in at 3A — still "always" in this scenario's deck (not a difficulty-time modular
      // choice), so it's listed here rather than in recommendedModularSetCodes. Setting it aside at setup is a
      // scripted 1A ability (wave3 §2.2), not scenario data.
      additionalEncounterSetCodes: ["galactic_artifacts", "ship_command"],
      recommendedModularSetCodes: ["menagerie_medley"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 1], expert: [1, 1] },
      // The Collector's back face is `cannotBeDefeated` (wave3 §1.1/§3.1) — the only printed win path is 3B's "If
      // there is no threat here, the players win the game" (wave3 §3.26), not defeating a final villain stage.
      victory: "cardAbility",
      evidence: 'MC16 p. 12, "Scenario 3 - Escape the Museum"; 1A Contents/Setup text (raw 16082a); wave3 §1.1, §2.2',
    },
    {
      id: "nebula",
      name: "Nebula",
      villainSetCode: "nebula",
      // 1A "Contents" (raw 16091a): "Nebula (I) and Nebula (II). (Nebula (II) and Nebula (III) instead for
      // expert mode.) Nebula, Power Stone, Ship Command, and Standard encounter sets. One modular encounter set
      // (Space Pirates)."
      additionalEncounterSetCodes: ["power_stone", "ship_command"],
      recommendedModularSetCodes: ["space_pirates"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      evidence: 'MC16 p. 14, "Scenario 4 - Nebula"; 1A Contents text (raw 16091a); wave3 §2.2',
    },
    {
      id: "ronan-the-accuser",
      name: "Ronan the Accuser",
      villainSetCode: "ronan",
      // 1A "Contents" (raw 16106a): "Ronan the Accuser (I) and Ronan the Accuser (II). (Ronan the Accuser (II)
      // and Ronan the Accuser (III) instead for expert mode.) Ronan the Accuser, Power Stone, Ship Command, and
      // Standard encounter sets. One modular encounter set (Kree Militants)."
      additionalEncounterSetCodes: ["power_stone", "ship_command"],
      recommendedModularSetCodes: ["kree_militant"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      evidence: 'MC16 p. 18, "Scenario 5 - Ronan the Accuser"; 1A Contents text (raw 16106a); wave3 §2.2',
    },
  ],

  starterDecks: [
    {
      id: "groot-protection",
      name: "Groot (Protection) — starter deck",
      identityCode: "16001a",
      aspect: "protection",
      cards: {
        // Groot cards (16002-16011), MC16 p. 20: "Fruition x2, "I Am Groot" x2, "I. AM. GROOT!" x2, Root Stomp
        // x3, "We Are Groot", Fertile Ground, Entangling Vines, Lashing Vines, Vine Shield, Vine Spikes".
        "16002": 2,
        "16003": 2,
        "16004": 2,
        "16005": 3,
        "16006": 1,
        "16007": 1,
        "16008": 1,
        "16009": 1,
        "16010": 1,
        "16011": 1,
        // Protection cards: "Starhawk, Desperate Defense x3, Fighting Fit x3, The Power of Protection x2,
        // Dauntless x3, Hard to Ignore x3, Indomitable x2".
        "16012": 1,
        "16013": 3,
        "16014": 3,
        "16015": 2,
        "16016": 3,
        "16017": 3,
        "16018": 2,
        // Basic cards: "Rocket Raccoon, Flora and Fauna, Energy, Genius, Strength, Deft Focus x3".
        "16019": 1,
        "16020": 1,
        "16021": 1,
        "16022": 1,
        "16023": 1,
        "16024": 3,
      },
      obligationCode: "16025",
      nemesisCodes: ["16026", "16027", "16028"],
      verified: true,
      sources: ['MC16 p. 20, "Starter Decks", "Groot / Protection"'],
      note: "40 cards = 15 Groot + 17 Protection + 8 Basic, matching the rulebook's own listed counts.",
    },
    {
      id: "rocket-raccoon-aggression",
      name: "Rocket Raccoon (Aggression) — starter deck",
      identityCode: "16029a",
      aspect: "aggression",
      cards: {
        // Rocket Raccoon cards (16030-16039): "I've Got a Plan x2, Reload x2, Schadenfreude, Salvage x2, Battery
        // Pack x2, Cybernetic Skeleton, Particle Cannon, Rocket Launcher, Rocket's Pistol x2, Thruster Boots".
        "16030": 2,
        "16031": 2,
        "16032": 1,
        "16033": 2,
        "16034": 2,
        "16035": 1,
        "16036": 1,
        "16037": 1,
        "16038": 2,
        "16039": 1,
        // Aggression cards: "Bug, Chase Them Down x2, Into the Fray x3, Looking for Trouble x3, Relentless
        // Assault x2, Follow Through x3, Hand Cannon x3".
        "16040": 1,
        "16041": 2,
        "16042": 3,
        "16043": 3,
        "16044": 2,
        "16045": 3,
        "16046": 3,
        // Basic cards: "Groot, Flora and Fauna, Energy, Genius, Strength, Booster Boots x3".
        "16047": 1,
        "16048": 1,
        "16049": 1,
        "16050": 1,
        "16051": 1,
        "16052": 3,
      },
      obligationCode: "16053",
      nemesisCodes: ["16054", "16055", "16056", "16057"],
      verified: true,
      sources: ['MC16 p. 20, "Starter Decks", "Rocket Raccoon / Aggression"'],
      note: "40 cards = 15 Rocket Raccoon + 17 Aggression + 8 Basic, matching the rulebook's own listed counts.",
    },
  ],
};
