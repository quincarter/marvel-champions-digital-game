# Phase 7, Wave 7: Cycle 7 – NeXt Evolution – Sources

> **Status:** In preparation for Phase 7 wave 7, cycle 7 (NeXt Evolution) card scripting.
> **Scope:** Campaign box MC40, hero packs Psylocke/Angel/X-23/Deadpool; scenarios with Cable and Domino as campaign heroes.
> **Note on RRG citations:** printed page = PDF page index + 1. Checked against `mc_rulesreference_v18_compressed.pdf` (July 2026).

---

## 1. Pack list and release order

Cycle 7 is one campaign box and four hero packs. Per **RRG 1.8 Appendix VI, "Limited Environment", cycle 7** (printed page 71):

> **7.** The _NeXt Evolution_ campaign expansion, the _Psylocke Hero Pack_, the _Angel Hero Pack_, the _X-23 Hero Pack_, and the _Deadpool Hero Pack_.

| Release date (Hall of Heroes) | Product               | Type         | Contents                                                             |
| ----------------------------- | --------------------- | ------------ | -------------------------------------------------------------------- |
| August 18, 2023               | NeXt Evolution (MC40) | Campaign box | Cable, Domino; 5 scenarios; campaign cards; Hope Summers modular set |
| September 22, 2023            | Psylocke (`psylocke`) | Hero pack    | Betsy Braddock / Psylocke                                            |
| September 22, 2023            | Angel (`angel`)       | Hero pack    | Warren Worthington III / Angel (foldable double-sided identity)      |
| November 17, 2023             | X-23 (`x23`)          | Hero pack    | Laura Kinney / X-23                                                  |
| November 17, 2023             | Deadpool (`deadpool`) | Hero pack    | Wade Wilson / Deadpool; introduces 'Pool aspect                      |

- **Release order:** NeXt Evolution box released August 18, 2023; Psylocke and Angel released together September 22, 2023; X-23 and Deadpool released together November 17, 2023.

---

## 2. The NeXt Evolution box rulebook (MC40)

**Source documents:**

- PDF: `docs/campaign-modes/mc40_next_evolution_rulebook-web.pdf` (24 pages)
- Markdown conversion: `docs/campaign-modes/markdown/mc40_next_evolution.md`

**Sections in the rulebook:**

- Page 2: Components (heroes Cable and Domino; five scenarios; villain decks for Marauders, Juggernaut, Mister Sinister, Stryfe)
- Page 3: New card type — Player Side Scheme (plays during player's turn; enters play next to main scheme with threat equal to starting threat value; limit of 1 or 2 depending on player count; defeat when threat reaches 0)
- Page 4: Featured Keywords (Alliance, **Assault** [new], Hinder X, Incite X, Patrol, Permanent, Piercing, Ranged, Requirement, Setup, Steady, Team-Up, Teamwork [trait], Victory X, Villainous, Stalwart)
- Page 5: Hope Summers (the modular set and the "attacks you" notes). Pages 6–7: Campaign Mode Rules and the campaign player side schemes (five scenarios in order; Hope Summers ally + Captive Hope scheme modular set; campaign-specific cards 190–203; campaign log; prohibited card: Hope Summers (#204) basic ally; per player costs; victory display; amplify icon; persistent damage expert mode; elimination/victory expert mode rules)
- Pages 9–20: Five scenarios with setup and victory instructions
  - Scenario 1 (morlock-siege): Marauders (seven villains, randomized, defeat three to win); Morlock allies to save; Routed environment after first villain defeat
  - Scenario 2 (on-the-run): Same Marauders as Scenario 1; randomized single villain; Hope's Captor attachment (must defeat twice); link to Scenario 1 via Morlocks saved
  - Scenario 3 (juggernaut): Juggernaut with momentum counters; Hope Summers critical ally (if defeated, players lose); Black Tom Cassidy + Creeping Willow minions dealt facedown; momentum carried between Juggernaut stages
  - Scenario 4 (mister-sinister): Mister Sinister with three Sinister Experiments (randomized stages); Teleported Away side scheme; Flight/Super Strength/Telepathy attachment modular sets set aside; Hope Summers damage tracked
  - Scenario 5 (stryfe): Stryfe's ability references "most common card type in your hand" (tie-break: player choice); Stryfe's Grasp side scheme; Hope Summers damage/threat choice
- Page 22: Starter decks (Cable/Leadership, Domino/Justice with precons listed)
- Page 24: Campaign log sheet with player side scheme tracking (6 schemes with associated encounter cards and environments)

**Notable mechanics:**

- **Player Side Schemes:** New card type, used in standalone play as well (all five packs have them); the six campaign ones (190–195) are a campaign layer on top: players select one per scenario from campaign log; defeat scheme = earn environment card bonus for rest of campaign
- **Hope Summers modular set:** Optional; makes scenarios easier; can include in any scenario but doesn't count toward modular set requirement
- **Per Player costs** (marked [per_hero]): numeric cost × number of starting players
- **Momentum counters** (Juggernaut scenario): placed on main villain; increase ATK; can be removed via hero action on Juggernaut's Helmet; carry between villain stages
- **Campaign Environments:** Bonuses earned after defeating campaign player side schemes; carry forward to all future scenarios; add threat counters in subsequent scenarios
- **Expert Campaign:** Persistent damage (HP carryover capped at base), acceleration tokens to heal HP at scenario cost, optional rejoin for eliminated players

**Conversions note:** Markdown captures text and structure but not full illustrations. Page numbers in markdown correspond to printed page numbers in PDF (printed page = PDF index + 1).

---

## 3. RRG 1.8 and official rulings for cycle 7

Page numbers in this section were checked by the main session with pypdf against
`mc_rulesreference_v18_compressed.pdf` (printed page = PDF index + 1).

### 3.1 Keywords and mechanics the cycle features

MC40 p. 4 lists featured keywords. **New or prominent to this cycle:**

- **Assault** (RRG 1.8 p. 8; MC40 p. 4; new): see the RRG entry for the exact text before building it.
- **Player side scheme** (RRG 1.8 "Player Side Scheme" and "Player Side Scheme Limit", p. 34; MC40 p. 3; new card
  type): a side scheme that is a player card. All four hero packs and the box carry `player_side_scheme` cards.
- **Per player icon** (RRG 1.8 "Per Player Icon", p. 32): on a player card's cost in this cycle (Team Investigation
  40053, "3[per_hero] threat"; see the August 3, 2026 ruling in §4).
- **'Pool aspect** (RRG 1.8 "Aspect Card", p. 8, and p. 12; new with the Deadpool pack): a fifth aspect. MarvelCDB's
  faction code is `pool`.
- **Alliance** (RRG 1.8 p. 6; MC40 p. 4): the players can pay the card's costs as a group.
- **Hinder X, Incite X, Patrol, Permanent, Piercing, Ranged, Requirement, Setup, Steady, Team-Up, Teamwork, Victory
  X, Villainous, Stalwart:** defined in RRG 1.8; not new to cycle 7.

### 3.2 RRG 1.8 FAQ and errata entries for cycle 7

FAQ entries are on RRG 1.8 p. 64, errata on p. 69. Card numbers are the collector numbers the RRG prints; our ids
are in the last column.

| Card                         | RRG number | Printed page | Kind   | Summary                                                                                                                                                                                                     | Our id |
| ---------------------------- | ---------- | ------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Malice                       | #199       | 64           | FAQ    | Still a minion while attached to an ally: keeps the minion type and her damage, can be attacked and targeted but not defeated again, is not engaged so cannot activate, discarded when her host leaves play | 40199  |
| Honey Badger                 | #3         | 64           | FAQ    | Her Response cannot be triggered if the damage defeats her (she has already left play)                                                                                                                      | 43003  |
| Crisis of Infinite Deadpools | #37        | 64           | FAQ    | Included only if a player chose 'Pool as (one of) their chosen aspect(s); 'Pool cards allowed in from outside a chosen aspect do not count                                                                  | 44037  |
| Inhibitor Collar             | #92        | 69           | Errata | "**Action**: Choose to either exhaust a character you control or take 3 damage → discard this card. Any player can do this." (reminder text became rules text)                                              | 40092  |
| Front Line Specialist        | #36        | 69           | Errata | "Your identity gets +4 hit points." (changed "hero" to "identity"; the printed card says "hero", scan checked)                                                                                              | 43036  |
| 'Pool-ized                   | #41        | 69           | Errata | "**When Revealed**: Attach to the ally with the highest cost without 'Pool-ized attached. Attached ally engages its controller. Otherwise, this card gains surge." (added the engage sentence)              | 44041  |

**Not cycle 7 cards (corrected by the main session):** Suit Up (#17) and Mission Team (#171A) are Age of
Apocalypse errata. On p. 69 of the PDF they sit under the "AGE OF APOCALYPSE EXPANSION" heading; the RRG markdown
conversion puts them under NeXt Evolution because of the page's column order.

---

## 4. Post-RRG-1.7 rulings on cycle 7 cards

Found by matching every card title in the five packs' raw data against
`marvel-champions-rulings-post-rrg-1-7.md` (rewritten by the main session; the first draft listed one ruling of
ten). Cite each by its date heading. **Read each ruling in full** before scripting its card.

| Ruling (date heading)             | Card (our id, pack)                        | What it says                                                                                                                                                                                                                            |
| --------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| December 17, 2025 - Ruling 4 (#1) | Armed to the Teeth (44009, `deadpool`)     | "Once a card is removed from the game, it **cannot** be returned to the game by any means (e.g., _Armed to the Teeth_), and it does not become a part of the collection."                                                               |
| January 17, 2026 - Ruling 1 (#1)  | Hope Summers (40130, `next_evol`)          | "the value of a star icon is defined by its associated ability (defaulting to 0 only when there is no associated ability)"; Rogue copying Hope adds the hero's power values. RRG 1.8 p. 40 now says the same (see below)                |
| January 26, 2026 - Ruling 4 (#1)  | Headpool (44014, `deadpool`)               | "Headpool's controller resolves the minion's boost card."                                                                                                                                                                               |
| January 26, 2026 - Ruling 4 (#4)  | Psychic Override (40178, `next_evol`)      | "You can choose **any card type** that exists in Marvel Champions, even if not in your hand or deck."                                                                                                                                   |
| February 8, 2026 - Ruling 2       | Thumbelina (40182, `next_evol`)            | Hercules deals 6, Thumbelina takes 5, 2 overkill damage goes to the villain (excess taken), Prince of Power heals 3 (excess dealt): "**Yes, that sequence is correct.**"                                                                |
| April 30, 2026 - Ruling 4 (#1)    | Digging Deep (40060, `next_evol`)          | In an Age of Apocalypse mission attempt: "You can trigger Digging Deep's Response to add it to your hand; if you do, it does not count for the mission attempt and no replacement card is drawn." (matters when wave 8 builds missions) |
| June 2, 2026 - Ruling 5           | Exhausting Personality (44003, `deadpool`) | "**Yes.** Exhausting Personality specifically allows choosing any player's identity for its cost."                                                                                                                                      |
| June 25, 2026 - Ruling 4 (#3)     | Metaknowledge (44005, `deadpool`)          | Not usable on a flipped environment (Wheel of Genres): "**No.** Environments flip, they are not revealed."                                                                                                                              |
| July 9, 2026 - Ruling 3 (#1)      | Stryfe II (40164, `next_evol`)             | Stryfe II revealed during setup causing a form change: "**Yes.** Players always resolve Alter-Ego setup abilities regardless of setup form changes."                                                                                    |
| August 3, 2026 - Ruling 5         | Team Investigation (40053, `next_evol`)    | "Printed cost scales with player count: In a 2-player game, printed cost is **4**" (for effects that read the printed cost, e.g. Echo's Katana)                                                                                         |
| August 3, 2026 - Ruling 6         | Thumbelina (40182, `next_evol`)            | "Exactly defeat" means defeated by an attack that dealt no excess damage; "Characters that reduce damage taken generally cannot be exactly defeated"                                                                                    |

**Ruling versus RRG:** no conflict found. The January 17, 2026 ruling called the Star Icon entry outdated; RRG 1.8's
entry (p. 40) now agrees with it: a star value "is defined in that card's text. If it is not defined (for instance, if
the card's text is blanked), that value is treated as 0."

General rulings in the same file that cycle 7 cards will lean on (not card-specific, so not listed above): the June
25, 2026 - Ruling 4 answers on nemesis sets belonging to their identity and on characters not under a player's
control not being friendly (Malice, 'Pool-ized).

---

## 5. Each hero pack

Card facts below were read from `packages/content/raw/marvelcdb/` by the main session. The mechanics themselves are
the spec's job; the data survey covers each pack's cards and sets.

| Pack       | Cards (raw) | Hero-side identity text                                                                                                                                          | Encounter sets                  | Notes                                                                                       |
| ---------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| `psylocke` | 33          | _Psi-Energy Control_, Interrupt: when you use one of Psylocke's basic powers, flip 1 PSI-ENERGY upgrade                                                          | `psylocke_nemesis`              | Double-sided PSI-ENERGY upgrades; player side schemes                                       |
| `angel`    | 33          | Two hero faces: Angel (42001a, _Angel of Life_: after an AERIAL event, draw 1) and Archangel (42001c, _Angel of Death_: deal damage equal to the event's cost)   | `angel_nemesis`                 | A three-face identity (an additional form, as MC32's "Additional Forms" rule)               |
| `x23`      | 40          | _Living Weapon_, Response: after X-23 takes any amount of damage, ready X-23 (limit once per phase)                                                              | `x23_nemesis`                   | Honey Badger (43003) is an identity-set ally, not a form; RRG FAQ p. 64                     |
| `deadpool` | 58          | _The Regeneratin' Degenerate_, Forced Interrupt: when you would be defeated, instead set your hit point dial to 1, change to alter-ego, add 1 acceleration token | `deadpool_nemesis`, `dreadpool` | No Aggression/Justice/Leadership/Protection cards: only `hero`, `basic` and `pool` factions |

Deadpool: the `dreadpool` set (6 cards) is set aside and brought in by Crisis of Infinite Deadpools (44037), which
is in the encounter deck only when a player chose the 'Pool aspect (RRG FAQ p. 64). Armed to the Teeth (44009)
searches "your collection", which the December 17, 2025 ruling bounds.

---

## 6. Open points for the spec

1. **Hero pack mechanics:** Not surveyed here; the wave's spec will cover Psylocke, Angel, X-23, Deadpool from card text. Confirm form-change mechanics (particularly Angel's double-sided identity and any special form-flip semantics).

2. **Assault keyword implementation:** Reviewed in MC40 p. 4 and RRG 1.8 p. 8. Confirm in engine that Assault swaps ATK for THW on thwart, and consequences damage swaps to ally's ATK value.

3. **'Pool aspect wiring:** The `card-data-pipeline` agent should verify that all 'Pool aspect cards carry the correct aspect classification and that Crisis of Infinite Deadpools is properly gated to scenario decks (encountered only if a player chose 'Pool). Confirm in the codebase that a fifth aspect choice is present in deck customization logic.

4. **Campaign player side schemes:** Novel card type. Confirm placement logic (next to main scheme), threat tracking, limit enforcement (1 or 2 depending on player count), and defeat condition (zero threat → discard or victory display if Victory X). Modular set linking to campaign environments is a complex state machine.

5. **Per-player costs** ([per_hero] icon): Confirmed in MC40 p. 5. The multiplier is the number of players who started the game (RRG 1.8 "Per Player Icon", p. 32), not a value fixed at setup; see spec §3.4.

6. **Momentum counter (Juggernaut scenario):** Custom counter type; confirm whether generic counter primitive suffices or scenario-specific counter needed.

7. **Campaign environments:** Bonuses earned by defeating campaign player side schemes; carry forward to all future scenarios. Confirm campaign log state machine and environment re-entry logic.

8. **Hope Summers ally:** Critical to campaign. If Hope Summers (encounter set version, #130) leaves play at any time, players lose. Confirm in engine that losing condition is checked after any ally defeat.

9. **MC40 rulebook insert:** If the repo has a separate insert document for MC40, review it for scenario-specific mechanics not covered in the main rulebook markdown above.

10. **Precons:** Verify starter deck lists in `starterDecks.ts` for Cable and Domino against their decklists (MC40 p. 22).

---

## Sources (Hall of Heroes pages)

- [NeXt Evolution](https://hallofheroeslcg.com/next-evolution/)
- [Psylocke/Betsy Braddock](https://hallofheroeslcg.com/psylocke-betsy-braddock/)
- [Angel/Warren Worthington III](https://hallofheroeslcg.com/angel-warren-worthington-iii/)
- [X-23/Laura Kinney](https://hallofheroeslcg.com/x-23-laura-kinney/)
- [Deadpool/Wade Wilson](https://hallofheroeslcg.com/deadpool/)
- [Latest FFG Rulings (post-RRG 1.7 & 1.8)](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/)
- [Errata Pack](https://hallofheroeslcg.com/errata-pack/)

## Internal sources

- `mc_rulesreference_v18_compressed.md` and `.pdf` (July 2026), Appendix VI (p. 71), Aspect Card and Assault (p. 8), Per Player Icon (p. 32), Player Side Scheme (p. 34), FAQ entries (p. 64), errata (p. 69)
- `docs/campaign-modes/mc40_next_evolution_rulebook-web.pdf` and `markdown/mc40_next_evolution.md`
- `marvel-champions-rulings-post-rrg-1-7.md` (the ten rulings in §4)
- `packages/content/raw/marvelcdb/{next_evol,psylocke,angel,x23,deadpool}.json` (card data)

## Corrections after the spec's first pass (main session, 2026-10-04)

- The RRG FAQ entry "Assault (#197)" (p. 58) is the Core Set treachery, not the assault keyword and not a NeXt
  Evolution card (40197 is Safehouse).
- MC40 and RRG 1.8 disagree in two places, both taken to the owner as spec §4.2 Q4 and Q5: a Marauder minion
  revealed while the villain of its title is in play (MC40 p. 21 "must reveal an additional encounter card" versus
  RRG p. 46 "is dealt a facedown encounter card"), and "attacks you" abilities when an ally you control is attacked
  (MC40 p. 5 "do **not** trigger" versus RRG p. 10 "resolve against the attacked player").
- February 8, 2026 - Ruling 2 (Thumbelina, Prince of Power) is **not** followed as written: RRG 1.8 "Overkill"
  (p. 31) says an ability counting excess damage dealt counts the overkill value, and the owner decided for the RRG on
  2026-09-25 (`excessDamageOf`; `excess-equals-overkill.test.ts`). So §4's "no conflict found" covers the Star Icon
  ruling only. August 3, 2026 - Ruling 6 ("exactly defeat") is unaffected.
- "Hope Summers" (§6 item 8): the loss is on her leaving play by any route, not only defeat.
- July 9, 2026 - Ruling 3 (#1) speaks of Stryfe II causing a form change at setup; the spec found no card revealed
  at setup that does this, so the ruling's premise is still unexplained (spec §2.9).
- From spec pass 1c: the campaign environments add threat only in scenarios 4 and 5, and the expert-mode heal costs a
  facedown encounter card in scenarios 3 and 5, not acceleration tokens (§2 above states both too broadly). Raw 40199
  Malice reads "Threat attached ally as a ..." for "Treat attached ally as a ..." (a correction is owed in the
  curation, after the scan is read).
