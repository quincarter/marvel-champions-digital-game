# Phase 7, Wave 6: Cycle 6 – Mutant Genesis – Sources

> **Status:** In preparation for Phase 7 wave 6, cycle 6 (Mutant Genesis) card scripting.
> **Scope:** Campaign box MC32, hero packs Cyclops/Phoenix/Wolverine/Storm/Gambit/Rogue; scenario pack MojoMania (MC31).
> **Note on RRG citations:** printed page = PDF page index + 1. Checked against `mc_rulesreference_v18_compressed.pdf` (July 2026).

---

## 1. Pack list and release order

Cycle 6 is one campaign box, one scenario pack, and six hero packs. Per **RRG 1.8 Appendix VI, "Limited Environment", cycle 6** (printed page 71):

> **6.** The _Mutant Genesis_ campaign expansion, the _Cyclops Hero Pack_ , the _Phoenix Hero Pack_ , the _Wolverine Hero Pack_ , the _Storm Hero Pack_ , the _Gambit Hero Pack_ , and the _Rogue Hero Pack_ .

| Release date (Hall of Heroes) | Product                    | Type          | Contents                                                                        |
| ----------------------------- | -------------------------- | ------------- | ------------------------------------------------------------------------------- |
| September 30, 2022            | Mutant Genesis (`mut_gen`) | Campaign box  | Colossus (Piotr Rasputin), Shadowcat (Kitty Pryde); 5 scenarios; campaign cards |
| September 30, 2022            | Cyclops (`cyclops`)        | Hero pack     | Scott Summers / Cyclops                                                         |
| September 30, 2022            | Phoenix (`phoenix`)        | Hero pack     | Jean Grey / Phoenix                                                             |
| November 11, 2022             | Wolverine (`wolv`)         | Hero pack     | Logan / Wolverine                                                               |
| November 11, 2022             | Storm (`storm`)            | Hero pack     | Ororo Munroe / Storm                                                            |
| November 11, 2022             | Mojo Mania (`mojo`)        | Scenario pack | Mojo villain; Longshot; Spiral; environment scenarios with Wheel of Genres      |
| February 24, 2023             | Gambit (`gambit`)          | Hero pack     | Remy LeBeau / Gambit                                                            |
| February 24, 2023             | Rogue (`rogue`)            | Hero pack     | Anna Marie / Rogue                                                              |

- **Correction (main session, from the spec pass):** Appendix VI's cycle 6 line does not list Mojo Mania (checked in the RRG markdown); the scenario pack is in the cycle by release date and by the RRG FAQ, which files it under its own heading next to the Mutant Genesis entries.
- **Release order:** Mutant Genesis box and first three hero packs (Cyclops, Phoenix) released together on Sept 30, 2022; Wolverine, Storm, and Mojo Mania released together on Nov 11, 2022; Gambit and Rogue released together on Feb 24, 2023.

---

## 2. The Mutant Genesis box rulebook (MC32)

**Source documents:**

- PDF: `docs/campaign-modes/mc32_mutant_genesis_rulebook_v5-compressed.pdf` (24 pages)
- Markdown conversion: `docs/campaign-modes/markdown/mc32_mutant_genesis.md`

**Sections in the rulebook (from the markdown TOC):**

- Page 2: Components (5 scenarios, heroes Colossus and Shadowcat)
- Page 3: Featured Keywords (Hinder X, Team-Up, Villainous, Patrol, Permanent, Piercing, Ranged, Setup, Stalwart, Steady, Teamwork [trait], Victory X, Victory Display, Amplify icon; **Additional Forms** as a new rule)
- Pages 4–5: Campaign Mode Rules (campaign-specific cards 171–195; campaign log; prohibited cards; role-building mechanic with 4 roles: Brawler, Commander, Defender, Peacekeeper; role upgrades; expert campaign with persistent damage and elimination/victory rules; Future Past modular set)
- Pages 7–20: Five scenarios
  - Scenario 1 (Sabretooth): Robert Kelly ally (critical protection target)
  - Scenario 2 (Project Wideawake): Sentinel villain; Operation Zero Tolerance side scheme (loss condition)
  - Scenario 3 (Master Mold): Sentinel minion generation via Forced Interrupt
  - Scenario 4 (Mansion Attack): Four villains (Avalanche, Blob, Pyro, Toad); Save the School environment; variable main schemes
  - Scenario 5 (Magneto): Boarding Party/Sabotage Master Mold and Orbital Decay/Physical Strain double-sided side schemes; magnet counter on Magneto
- Page 22: Starter deck listings for Colossus (Protection) and Shadowcat (Aggression)
- Page 24: Campaign log sheet

**Notable features:**

- **Roles mechanic:** Campaign-mode-only customization layer that combines two aspects (Brawler = Aggression + Protection, etc.); each player chooses a different role and earns random upgrades by defeating campaign side schemes.
- **Persistent damage (expert mode):** Hit points carry over between scenarios (with cap at base).
- **Future Past modular set:** campaign-wide, themed around time-traveling Sentinels.
- **Double-sided side schemes** (Magneto scenario): Boarding Party → Sabotage Master Mold; Orbital Decay → Physical Strain.
- **Scenario mechanics named in rulebook:** Magneto gains magnet counters after attacking (p. 3 and p. 18).

**Conversions note:** The markdown conversion captures text and structure but does not include full-page illustrations or some callout graphics. Page numbers in the markdown correspond to printed page numbers in the PDF (printed page = PDF index + 1).

---

## 3. RRG 1.8 and official rulings for cycle 6

### 3.1 Keywords the cycle features

MC32 p. 3 lists featured keywords: Hinder X, Team-Up, Villainous, Patrol, Permanent, Piercing, Ranged, Setup, Stalwart, Steady, Teamwork (trait), Victory X. Most are not new; **new or prominent this cycle:**

- **Additional Forms** (MC32 p. 3, new rule): Heroes like Shadowcat come with double-sided form upgrades (e.g., Solid / Phased). Changing to an additional form does not count toward the once-per-turn hero/alter-ego flip limit, but does count as "changing forms" for card effects (e.g., Ready to Rumble).
- **Teamwork** (trait version, RRG 1.8; MC32 clarification on p. 3): After a minion with Teamwork enters play and engages, if at least one other minion shares the trait, each minion with that trait activates.
- **Piercing** (RRG 1.8 p. 39): An attack with Piercing discards Tough status cards from the target before dealing damage. Timing: Piercing (keyword) triggers before interrupt abilities like Aerial Evacuation (January 17, 2026 - Ruling 3).
- **Hinder X, Patrol, Permanent, Ranged, Setup, Stalwart, Steady, Victory X:** Defined in RRG 1.8, not new to this cycle; check the RRG for their mechanics.

### 3.1b RRG 1.8 FAQ and errata entries for the cycle (added by the main session)

The RRG's own FAQ has cycle 6 entries this doc first missed: Mutant Genesis Powerful Punch (#14), Mutant Protectors (#17), White Queen (#56), Operation Zero Tolerance (#104), Fabian Cortez (#159); Cyclops Ricochet Beam (#9); MojoMania Dial M for Mojo (#35), Wild Wild Mojo (#66); and Pixie (Storm #17) under Magik's entry. Errata for the cycle is on p. 68. Page numbers and each entry's use are in `docs/phase7-wave6.md` §0 and the sections that cite them.

### 3.2 FFG rulings in `marvel-champions-rulings-post-rrg-1-7.md` touching cycle 6 cards

Found by matching cycle 6 hero/villain card names and mechanics against the rulings file. Summaries below; **read each ruling in full** before scripting its card, as these are pointers only.

| Ruling (date heading)        | Card(s) / Context (pack)                  | Summary                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| December 17, 2025 - Ruling 3 | Storm's Flash Freeze (`storm`)            | Flash Freeze triggers "when the villain attacks" Storm, not the general "when an enemy would attack" condition; does not trigger on attacks against other players' characters. |
| January 17, 2026 - Ruling 1  | Rogue ally copying Hope Summers (`rogue`) | Star icon values are defined by their associated abilities (not treated as 0 per outdated RRG entry). Rogue copying Hope Summers adds the hero's base ATK/THW to Rogue's own.  |
| January 17, 2026 - Ruling 3  | Rogue's Bulletproof Belle (`rogue`)       | "Prevent all damage" prevents damage **taken**, not dealt. Piercing removes Tough before Aerial Evacuation triggers (keywords have timing priority over triggered abilities).  |
| April 30, 2026 - Ruling 3    | MojoMania setup, Longshot (`mojo`)        | Revealing Longshot during scenario setup **does** trigger his When Revealed ability. Toughness allies entering during setup gain a Tough status card.                          |
| June 2, 2026 - Ruling 1      | Jubilee ally + Wolverine (`wolv`)         | Jubilee's +2 ATK ability targets a chosen enemy, not specific card instances; stacks across multiple Jubilee triggers and works identically with Cameo/ally versions.          |
| July 9, 2026 - Ruling 4      | Wolverine's Berserker Barrage (`wolv`)    | Aggressive Energy increases damage **dealt to enemies**, not damage taken by Wolverine.                                                                                        |

---

## 4. Errata and taboo entries affecting cycle 6

### 4.1 Taboo list

The Hall of Heroes taboo list is **unofficial (community)** and is not an authority for this repo (per CLAUDE.md: RRG, FAQ, and errata only). Assume nothing from the taboo list is implemented unless confirmed in the official RRG or FFG rulings.

### 4.2 Errata (RRG 1.8)

Check RRG 1.8 Appendix VII (Errata) for any printed corrections to Cycle 6 cards. As of the rulings file dated August 13, 2026, no Cycle 6 errata has been transcribed into the rulings file; review the PDF directly if needed.

---

## 5. New mechanics the cycle introduces (from card text, not designed here)

From the MC32 rulebook and Cycle 6 hero packs, the following mechanics appear unique or prominent to this cycle. **The architect and scripting engineers should confirm these from the actual card data before implementing:**

- **Additional Forms** (Shadowcat): Phased/Solid form with conditions for flipping; Phased ignores guard/patrol and crisis icons; flips back to Solid after attacking/defending. This is a hero-identity-level mechanic, not a generic keyword.
- **Magnet counter** (Magneto villain): A custom counter type placed on the main scheme when Magneto attacks. Check whether a generic counter primitive exists or needs definition.
- **Leadership team-up allies** (Cyclops kit): Team-Up keyword pairs two characters (per MC32 p. 3); card can only be played if both named characters (identity or ally) are in play. This is a deckbuilding + play-time restriction.
- **Phoenix fire counters** (Phoenix kit): Likely a Phoenix-specific counter for fire/energy effects. Confirm from card data.
- **Wolverine healing and Berserk mechanics** (Wolverine kit): Healing as a primary damage-mitigation strategy (likely via Tough status or form flip); Berserk as a damage output enabler. Confirm mechanics from card text.
- **Storm weather/environmental control** (Storm kit): Flash Freeze and other weather effects tied to conditional play (e.g., "when Storm is attacked"). Confirm from card data.
- **Gambit charge counters** (Gambit kit): Likely a Gambit-specific counter for charging up effects. Confirm from card data.
- **Rogue copy/touched mechanic** (Rogue kit): Copying ally stats; "touched" keyword or similar for tracking copied cards. Confirm from card data.
- **Wheel of Genres environment** (MojoMania): A flipping environment representing different genres (Crime, Fantasy, Horror, Sci-Fi, Sitcom, Western). Confirm how flipping interacts with card effects (April 30, 2026 - Ruling 3 clarifies it does **not** count as "revealing").
- **Crime/Fantasy/Horror/Sci-Fi/Sitcom/Western traits** (MojoMania): Modular set organization; cards may have these traits and trigger effects based on the current genre. Confirm from card data.
- **Longshot When Revealed** (MojoMania): Triggers during setup (April 30, 2026 - Ruling 3).

---

## 6. Precon decklists (starter decks)

The Mutant Genesis campaign box includes two precon decks:

| Hero                   | Pack           | Release      | Starter Deck Location                                                    |
| ---------------------- | -------------- | ------------ | ------------------------------------------------------------------------ |
| Colossus (Protection)  | Mutant Genesis | Sep 30, 2022 | MC32 p. 22 (rulebook); cards listed in markdown `mc32_mutant_genesis.md` |
| Shadowcat (Aggression) | Mutant Genesis | Sep 30, 2022 | MC32 p. 22 (rulebook); cards listed in markdown `mc32_mutant_genesis.md` |

All six hero packs (Cyclops, Phoenix, Wolverine, Storm, Gambit, Rogue) include starter decks. Hall of Heroes pages for each pack carry deck images; the `card-data-pipeline` agent should verify decklists against those images.

**Status in the codebase:** Check `packages/content/src/data/<pack>/starterDecks.ts` for each pack to see whether decks are already registered.

---

## 7. For the rules architect

Grounded in the MC32 rulebook and cycle 6 rulings; hero-kit-specific mechanics are left to the architect's survey of card text.

- **Additional Forms** (MC32 p. 3): A new hero form type. Shadowcat's Solid / Phased form is double-sided; her Setup puts it into play Solid side up (corrected by the spec pass; see `docs/phase7-wave6.md` §2). The form-flip mechanic does not consume the once-per-turn limit on hero/alter-ego flips but does count as a "change form" trigger for cards like Ready to Rumble (51). Engine should track: (a) identity's current form (Alter-Ego, Hero, or additional form(s)); (b) once-per-turn flipping limit vs form-change triggers.
- **Magnet counter** (Magneto, MC32 p. 18): A scenario-specific counter type on the main scheme. Check if the engine needs a new counter type primitive or if "magnet" is just a label.
- **Teamwork trait mechanic** (MC32 p. 3; RRG 1.8): After a minion with Teamwork (trait X) enters and engages, if another minion shares trait X, each such minion activates. Engine should verify: (a) minion entry into play vs engagement order; (b) "other minion" definition (same player, any player, or global).
- **Piercing priority** (RRG 1.8 p. 39; January 17, 2026 - Ruling 3): Keywords execute before interrupt abilities. Piercing removes Tough before an interrupt like Aerial Evacuation triggers.
- **Longshot When Revealed during setup** (April 30, 2026 - Ruling 3): When Revealed abilities fire during scenario setup, not a special case.
- **Roles mechanic** (MC32 p. 5): Campaign-mode-only. Each player chooses a role (Brawler, Commander, Defender, Peacekeeper), earns upgrades by defeating campaign side schemes, and can role-build (add 1 event and/or 1 upgrade from role's associated aspects per game). This is campaign state, not core engine.
- **Persistent damage (expert mode, MC32 p. 5)**: Hit points carry between scenarios; recorded in campaign log; capped at base HP if player's remaining HP exceeds base.

---

## 8. Open items

1. **RRG 1.8 Errata (Appendix VII):** Cycle 6 errata list from the PDF; check whether any cards need corrections.
2. **Precons:** Verify starter deck lists in `starterDecks.ts` for all eight packs against their published decklists (Hall of Heroes and MC32 p. 22).
3. **Hero kits and mechanics:** Not surveyed here; the wave's spec will cover them from card text (Cyclops, Phoenix, Wolverine, Storm, Gambit, Rogue).
4. **Mojo Mania insert:** If the repo has a separate MC31 insert/rules document, review it for Mojo Mania scenario-specific mechanics not covered in the rulings summary above.

---

## Sources (Hall of Heroes pages)

- [Mutant Genesis](https://hallofheroeslcg.com/mutant-genesis/)
- [Scott Summers/Cyclops](https://hallofheroeslcg.com/scott-summers-cyclops/)
- [Jean Grey/Phoenix](https://hallofheroeslcg.com/jean-grey-phoenix/)
- [Logan/Wolverine](https://hallofheroeslcg.com/logan-wolverine/)
- [Ororo Munroe/Storm](https://hallofheroeslcg.com/ororo-munroe-storm/)
- [Gambit/Remy LeBeau](https://hallofheroeslcg.com/gambit-remy-lebeau/)
- [Rogue/Anna Marie](https://hallofheroeslcg.com/rogue-anna-marie/)
- [Mojo Mania](https://hallofheroeslcg.com/mojo-mania/)
- [Latest FFG Rulings (post-RRG 1.7 & 1.8)](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/)
- [Errata Pack](https://hallofheroeslcg.com/errata-pack/)

## Internal sources

- `mc_rulesreference_v18_compressed.pdf` (July 2026), Appendix VI (p. 71) and Appendix VII
- `docs/campaign-modes/mc32_mutant_genesis_rulebook_v5-compressed.pdf`
- `docs/campaign-modes/markdown/mc32_mutant_genesis.md`
- `marvel-champions-rulings-post-rrg-1-7.md` (December 17, 2025 through August 13, 2026)
- `docs/phase7-wave6-handoff.md`
