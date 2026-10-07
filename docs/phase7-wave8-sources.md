# Phase 7, Wave 8: Cycle 8 – Age of Apocalypse – Sources

> **Status:** In preparation for Phase 7 wave 8, cycle 8 (Age of Apocalypse) card scripting.
> **Scope:** Campaign box MC45, hero packs Bishop/Magik/Iceman/Jubilee/Nightcrawler/Magneto; five scenarios and side missions.
> **Note on RRG citations:** printed page = PDF page index + 1. Checked against `mc_rulesreference_v18_compressed.pdf` (July 2026).

---

## 1. Pack list and release order

Cycle 8 is one campaign box and four hero packs. Per **RRG 1.8 Appendix VI, "Limited Environment", cycle 8** (printed page 71):

> **8.** The _Age of Apocalypse_ campaign expansion, the _Iceman Hero Pack_ , the _Jubilee Hero Pack_ , the _Nightcrawler Hero Pack_ , and the _Magneto Hero Pack_ .

| Release date (Hall of Heroes) | Product                   | Type         | Contents                                                                     |
| ----------------------------- | ------------------------- | ------------ | ---------------------------------------------------------------------------- |
| March 29, 2024                | Age of Apocalypse (MC45)  | Campaign box | Bishop (Lucas Bishop), Magik (Illyana Rasputina); 5 scenarios; side missions |
| May 17, 2024                  | Iceman (`iceman`)         | Hero pack    | Bobby Drake / Iceman                                                         |
| July 19, 2024                 | Jubilee (`jubilee`)       | Hero pack    | Jubilation Lee / Jubilee                                                     |
| September 20, 2024            | Nightcrawler (`ncrawler`) | Hero pack    | Kurt Wagner / Nightcrawler                                                   |
| November 15, 2024             | Magneto (`magneto`)       | Hero pack    | Erik Lehnsherr / Magneto                                                     |

- **Release order:** the box first, then the four hero packs one at a time in the order above. Dates are Hall of Heroes' (a pointer, not an authority); the pack order is the RRG's.

---

## 2. The Age of Apocalypse campaign rulebook (MC45)

**Source documents:**

- PDF: `docs/campaign-modes/mc45_age_of_apocalypse_rulebook.pdf` (24 pages)
- Markdown conversion: `docs/campaign-modes/markdown/mc45_age_of_apocalypse.md`

**Status of this section:** the tracker's page-by-page summary, not checked line by line by the main session. The spec's author reads the rulebook itself; nothing here is a rules cite.

**Sections in the rulebook:**

- Page 2: Components (heroes Bishop and Magik; five scenarios; 271 total cards: 91 player, 15 villain, 165 encounter; campaign cards, mission side schemes)
- Page 3: New Rules — "Find" keyword (search game areas per instruction; don't look at facedown encounter cards); Featured Keywords (Hinder X, Teamwork trait, Victory X, Villainous, Patrol, Permanent, Piercing, Ranged, Setup, Stalwart, Steady); Victory Display (out-of-play shared area); Amplify icon (increases boost icons during enemy activation); Standard III Encounter Set (replaces Shadow of the Past with Pursued by the Past, permanent setup environment)
- Pages 4–5: Campaign Mode Rules (campaign-specific cards 171–176; campaign log; no penalty for losses; deck customization between scenarios; expert campaign with persistent damage)
- Page 5: Side Missions (new mechanic: mission area, mission side schemes 1/5–4/5 randomly selected scenarios 1–4; mission 5/5 reserved for scenario 5; Overseer minions defend missions; Mission Response abilities trigger after discarding cards during mission attempts)
- Pages 6–7: Mission attempt steps (discard X cards for X allies, assign to each, match resources, resolve, deal damage from pool, remove threat)
- Page 8: Scenario 1 (Unus): Unus the Untouchable with Gene Pool side scheme; threat scaling (retaliate/stalwart/[star] icon at 3/6/9); Prelate/Infinite minions
- Page 9–10: Scenario 1 continued
- Page 11: Scenario 2 (Four Horsemen): Multiple Horsemen villains (Famine, Pestilence, War, Death); each has Toughness and special effects
- Page 12–13: Scenario 2 continued
- Page 14: Scenario 3 (Apocalypse I): Main villain Apocalypse with Toughness; Forced Interrupt on scheme completion (removes threat, reveals Apocalypse II)
- Page 15–16: Scenario 3 continued with Apocalypse II
- Page 17: Scenario 4 (Dark Beast): Dark Beast (Brute/Genius) villain; Forced Interrupt when he attacks resolves "Special" from SETTING environment card
- Page 18: Scenario 4 continued
- Page 19: Scenario 5 (En Sabah Nur): En Sabah Nur (1/16 HP per hero) villain; Retaliate 1; Forced Response after form change places 1 threat on each scheme
- Page 20: Expert Campaign Rules (persistent damage capped at base HP; optional elimination rules for defeated players)
- Page 22: Starter decks (Bishop/Leadership, Magik/Aggression listed)
- Page 24: Campaign log sheet (track mission/overseer completion, campaign rewards)

**Notable mechanics:**

- **Mission side schemes:** New game area; players cannot thwart them; allies played into mission area have text boxes treated as blank except traits; Overseer minions defend missions; Mission Response abilities trigger after mission attempt card discards
- **Amplify icon ([star]):** Increases boost icons on boost cards when revealed during enemy activation
- **Standard III Encounter Set:** Campaign-specific alternative to Standard set; Pursued by the Past is permanent/setup
- **Mission attempts:** Five-step resolution (discard, assign, match resources, resolve, deal damage/remove threat)
- **Overseer minions:** Two-sided cards (Overseer side and Prelate side); available each scenario unless crossed out
- **Expert Campaign:** Persistent damage (heroes retain HP between scenarios, capped at base); optional rejoin for eliminated players

**Scenario identifiers (proposed):** `unus`, `four-horsemen`, `apocalypse`, `dark-beast`, `en-sabah-nur` (match rulebook section names)

---

## 3. RRG 1.8 and official rulings for cycle 8

Page numbers cited were checked by reading `mc_rulesreference_v18_compressed.pdf` (printed page = PDF index + 1).

### 3.1 Keywords and mechanics the cycle features

MC45 p. 3 lists featured keywords. **New or prominent to this cycle:**

- **Find** (MC45 p. 3; new): Search each relevant game area (play area, set-aside, player deck, discard, encounter deck, etc.) for a card; players need not search areas where the card cannot be. Do not look at facedown encounter cards currently dealt to players.
- **Mission side scheme** (MC45 p. 5; new card type): A side scheme in a separate mission area; players cannot thwart it; allies played there have text boxes blanked except traits; Overseer minions defend missions; defeated only after all Overseer minions leave play.
- **Mission Response** (MC45 p. 5; new ability type): A Forced Response that triggers after a player discards cards from their deck during a mission attempt.
- **Overseer minion** (MC45 p. 5; new card set): Two-sided minions representing Overseer and Prelate versions; Overseer defends missions; tracked in campaign log.
- **Amplify icon** (MC45 p. 3; RRG 1.8 "Amplify Icon", p. 3; new): Increases the number of boost icons on a boost card turned faceup during enemy activation (add 1 for each amplify icon in play).
- **Hinder X, Teamwork (trait), Victory X, Villainous, Patrol, Permanent, Piercing, Ranged, Setup, Stalwart, Steady:** Defined in RRG 1.8 and featured in MC45; not new to cycle 8. Teamwork is a minion trait that triggers when another minion with that trait enters and engages.

### 3.2 RRG 1.8 FAQ and errata entries for cycle 8

FAQ entries are on RRG 1.8 p. 64 (marked "AGE OF APOCALYPSE EXPANSION" starting line 4682); errata on p. 69 (marked "AGE OF APOCALYPSE EXPANSION" starting line 5058). Card numbers are RRG collector numbers.

| Card                     | RRG number | Printed page | Kind   | Summary                                                                                                                      | Note          |
| ------------------------ | ---------- | ------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Magik (#30A)             | Four Q&A   | 64           | FAQ    | Playing top card of deck (four detailed questions on play timing, hand abilities, triggering on play, putting into play)     | Campaign hero |
| Rogue (#1B)              | #1B        | 69           | Errata | Changed "Attach Touched..." to "Find Touched and attach it..."                                                               | Hero form     |
| Energy Transfer (#7)     | #7         | 69           | Errata | Changed "Attach Touched..." to "Find Touched and attach it..."                                                               | Rogue card    |
| Mystique's Manipulations | #26        | 69           | Errata | Specified defeating player searches encounter deck for Misled treachery                                                      | Minion card   |
| Bonebreaker (#31)        | #31        | 69           | Errata | Changed "Forced Interrupt" to "Forced Response" after Bonebreaker engages; takes 1 indirect damage per Reaver minion engaged | Minion card   |

---

## 4. Post-RRG-1.7 rulings on cycle 8 cards

Found by matching card names from the five raw caches against `marvel-champions-rulings-post-rrg-1-7.md`. **Read each ruling in full** before scripting its card.

| Ruling (date heading)         | Card (hero pack or context) | Summary                                                                                                                                                                           |
| ----------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| April 30, 2026 - Ruling 4 (2) | Age of Apocalypse campaign  | Prelate versions of minions remain available for the Apocalypse scenario even if their Overseer counterparts were crossed out of the campaign log (minion availability).          |
| June 2, 2026 - Ruling 1       | Jubilee ally's +2 ATK       | Jubilee's ability targets the chosen enemy, not card instances; stacks across multiple Jubilee triggers (Jubilee hero pack, likely ally or identity ability affecting Wolverine). |

**Ruling vs RRG:** No conflict found. The June 2 ruling clarifies ally ability stacking for the Jubilee ally (likely from the Jubilee hero pack).

---

## 5. Each hero pack

Card counts and facts from `packages/content/raw/marvelcdb/` caches. Card mechanics are the spec's responsibility; this section covers pack structure and identity powers only.

| Pack       | Cards (raw) | Hero-side identity text                                                                                 | Notes                                   |
| ---------- | ----------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| aoa (box)  | 226+        | Bishop: Energy Absorption Response (discard cards after damage, add resources); Magik: faceup deck play | Campaign heroes; two precon identities  |
| `iceman`   | 33          | Rapid Teleportation Interrupt (attach Frostbite during basic attack/defense)                            | Ice theme; Frostbite set-aside mechanic |
| `jubilee`  | 41          | "Like, totally!" Resource (exhaust → generate wild resource)                                            | X-Men; wild resource generation         |
| `ncrawler` | 39          | "Rapid Teleportation" Action (spend 1 resource → return Bamf! from discard, limit once per phase)       | Teleportation theme; Bamf! reuse        |
| `magneto`  | 43          | Magnetic Pull Action (discard until Magnetic card, add to hand, limit once per round)                   | Magnetic keyword; deck searching        |

---

## 6. Open points for the spec

1. **Scenario identifiers:** Confirm the five scenario IDs (proposed: `unus`, `four-horsemen`, `apocalypse`, `dark-beast`, `en-sabah-nur`). Cross-reference rulebook page 8–20 headings.

2. **Find keyword implementation:** Engine should support searching multiple game areas per card instruction; special rule to not reveal facedown encounter cards currently dealt to players.

3. **Mission system:** Novel rules for mission area (cards in play but not under player control, text blanked except traits), mission side schemes (cannot be thwarted, defeated only when Overseer minions leave), Overseer minions (two-sided per-scenario availability), mission attempts (five-step discard/assign/match/resolve/damage resolution).

4. **Mission Response ability type:** New trigger type that fires after player discards cards during mission attempt (not a standard Response).

5. **Amplify icon:** Boosts boost icons during enemy activation. Confirm whether [star] icons on cards are distinct from amplify mechanic or if they use the same primitive.

6. **Standard III Encounter Set:** Campaign-alternative to Standard set. Pursued by the Past is permanent/setup (always in play, cannot leave). Confirm whether engine treats Standard III as a scenario-selectable module.

7. **Magik faceup deck mechanic:** Hero-specific; play top card of deck faceup each phase, reducing cost by 1. Confirm "once per phase" limit and interaction with other play-from-hand effects. RRG FAQ clarifies that this counts as "playing from hand" for trigger purposes.

8. **Overseer/Prelate minion tracking:** Campaign log tracks which Overseer/Prelate minions have been used; crossed-out ones are unavailable for future scenarios. Prelate versions remain available even if Overseer counterparts were used.

9. **Persistent damage (expert mode):** Hit points carry between scenarios, capped at base HP if remaining HP exceeds base. Confirm campaign state tracks HP across scenarios.

10. **Precons:** Verify starter deck lists for Bishop (Leadership) and Magik (Aggression) against MC45 p. 22.

---

## 7. For the rules architect

- **Amplify icon scaling:** Clarify whether amplify is a boost-card-only mechanic or if hero/player cards can have amplify icons. MC45 p. 3 says "add one additional boost icon to that card for each amplify icon in play."
- **Mission attempt resolution order:** Five steps are sequential (discard, assign, match, damage pool, threat removal). Confirm which abilities (Mission Response, Overseer abilities, rescue effects) trigger after step 1 (discard).
- **Villain engagement vs mission area:** Overseer minions in mission area are "in play but not engaged" with any player. Confirm whether Overseer activations follow standard minion activation rules or are special-cased to mission area rules.

---

## Sources (Hall of Heroes pages)

- [The Age of Apocalypse](https://hallofheroeslcg.com/the-age-of-apocalypse/)
- [Iceman/Bobby Drake](https://hallofheroeslcg.com/iceman-bobby-drake/)
- [Jubilee/Jubilation Lee](https://hallofheroeslcg.com/jubilee-jubilation-lee/)
- [Nightcrawler/Kurt Wagner](https://hallofheroeslcg.com/nightcrawler-kurt-wagner/)
- [Magneto/Erik Lehnsherr](https://hallofheroeslcg.com/magneto-erik-lehnsherr/)
- [Latest FFG Rulings (post-RRG 1.7 & 1.8)](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/)
- [Errata Pack](https://hallofheroeslcg.com/errata-pack/)

## Internal sources

- `mc_rulesreference_v18_compressed.md` and `.pdf` (July 2026), Appendix VI (p. 71), Amplify Icon (p. 3), FAQ entries (p. 64), errata (p. 69)
- `docs/campaign-modes/mc45_age_of_apocalypse_rulebook.pdf` and `markdown/mc45_age_of_apocalypse.md`
- `marvel-champions-rulings-post-rrg-1-7.md` (April 30, 2026 - Ruling 4 #2; June 2, 2026 - Ruling 1)
- `packages/content/raw/marvelcdb/{aoa,iceman,jubilee,ncrawler,magneto}.json` (card data, fetched 2026-09-13)
