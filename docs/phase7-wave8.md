# Phase 7 working spec: wave 8 (cycle 8, Age of Apocalypse)

This is the shared brief for every agent working Phase 7's eighth content wave (`card-data-pipeline`,
`game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer`, `rules-qa-engineer`,
`game-client-engineer`). It turns the wave's scope into schema decisions (§1), per-scenario setup needs (§2), a list of
engine primitives with a status each (§3), open questions with the owner's answers (§4) and the build order (§8). The
model is `docs/phase7-wave7.md`; wave 1–7 §3 primitives are assumed. The definition of done is
`docs/wave-definition-of-done.md`: **the box's campaign ships in this wave.** If you change a decision here, update this
file in the same change. Agents do not edit statuses or open questions; they report, and the main session flips them.

**Wave 8** is our `cycleId("cycle8")`. RRG 1.8 Appendix VI (p. 71), item 8: "The _Age of Apocalypse_ campaign
expansion, the _Iceman Hero Pack_, the _Jubilee Hero Pack_, the _Nightcrawler Hero Pack_, and the _Magneto Hero
Pack_." Packs: `aoa` (MC45, with Bishop and Magik), `iceman`, `jubilee`, `ncrawler`, `magneto`. The spec is written in
passes so each stays small (the split of passes 1b to 3 is proposed; the main session decides it):

| Pass   | Scope                                                                                                    | State       |
| ------ | -------------------------------------------------------------------------------------------------------- | ----------- |
| **1a** | **The box's new rules and keyword list; Unus and the Four Horsemen; the six sets those two use**         | **written** |
| **1b** | **Apocalypse, Dark Beast, En Sabah Nur and their modular sets**                                          | **written** |
| **1c** | **The MC45 campaign, side missions, the Mission, Overseer, Age of Apocalypse and the two Campaign sets** | **written** |
| **2a** | **Bishop, Magik and the box's player cards**                                                             | **written** |
| **2b** | **Iceman, Jubilee**                                                                                      | **written** |
| **2c** | **Nightcrawler, Magneto**                                                                                | **written** |
| **3**  | **The owner's answers 11 to 40 written in and reconciled; the build order (§8)**                         | **written** |

- **Pass 1a's content.** MC45 p. 3 ("New Rules": find; "Featured Keywords"; the victory display; the amplify icon; the
  Standard III encounter set); scenario 1 Unus (villain 45059–45061, main scheme 45062a/b, set `unus` 45063–45068)
  with its required modular set Infinites (`infinites` 45069–45071); scenario 2 Four Horsemen (villains 45081a/b–
  45084a/b, main scheme 45085a/b, set `four_horsemen` 45086–45096); modular sets Dystopian Nightmare
  (`dystopian_nightmare` 45072–45074) and Hounds (`hounds` 45097–45100); Standard III (`standard_iii` 45075a/b–45080),
  here because p. 3 introduces it and either scenario may use it. 44 raw records, every one read. Sections 1.1–1.10,
  2.1–2.5, 3.1–3.17, questions 1–10 and §5.
- **Pass 1b's content.** Scenario 3 Apocalypse (MC45 p. 14: villain 45101a/b–45102a/b, main scheme 45103a/b, set
  `apocalypse` 45104a/b–45111, the five Prelate faces 45179b–45183b, modular set Dark Riders `dark_riders`
  45112–45117; its other modular set, Infinites, is pass 1a's); scenario 4 Dark Beast (p. 16: villain 45118–45120, main
  scheme 45121a/b, set `dark_beast` 45122–45126, the three required sets Savage Land `savage_land` 45127–45132,
  Genosha `genosha` 45133–45138 and Blue Moon `blue_moon` 45139–45146); scenario 5 En Sabah Nur (p. 19: the
  three-sided villain 45184a/b/c–45186a/b/c, main schemes 45147a/b and 45148a/b, set `en_sabah_nur` 45149–45155,
  modular sets Celestial Tech `celestial_tech` 45156–45158 and Clan Akkaba `clan_akkaba` 45159–45163). 73 raw records
  and the five nested Prelate faces, every one read. Sections 1.12–1.22, 2.6–2.10, 3.18–3.32, questions 11–17 and
  §5.1.
- **Pass 1c's content.** The campaign: MC45 pp. 4–6 (campaign mode rules, campaign-specific cards, the campaign log,
  side missions, mission attempts), the Campaign Instructions boxes on pp. 8, 12, 14, 16 and 20, the expert campaign
  (p. 20) and the log (p. 24); and its 28 cards in five sets: Age of Apocalypse (`age_of_apocalypse` 45164–45165), the
  five missions (`aoa_mission` 45166a/b–45170a/b), the player campaign cards (`aoa_basic_campaign` 45171a/b–45176),
  Campaign (`aoa_campaign` 45177–45178) and the Overseer faces (`overseer` 45179a–45183a). 20 raw records and the six
  nested b faces of the missions and Mission Team, every one read; the Mission Rules card has no record (§1.29).
  Sections 0.2, 1.23–1.31, 2.11–2.16, 3.33–3.47, questions 18–25 and §5.2.
- **Pass 2a's content.** The box's player cards: Bishop / Lucas Bishop (45001a/b), his cards 45002–45010, obligation
  45025 and nemesis set `bishop_nemesis` 45026–45029; Magik / Illyana Rasputin (45030a/b), her cards 45031–45040,
  obligation 45053 and nemesis set `magik_nemesis` 45054–45058; Leadership 45011–45019, Aggression 45041–45047 and the
  basic cards 45020–45024 and 45048–45052. 58 raw records and the two nested alter-ego faces, every one read, and a
  scan read for 54 of them (§0.3). The RRG's four FAQ entries on Magik (p. 64) and the Suit Up erratum (p. 69).
  Sections 0.3, 1.32, 3.48–3.60, questions 26–32, §5.3 and §7.1.
- **Pass 2b's content.** The Iceman pack: Iceman / Bobby Drake (46001a/b), Frostbite 46002 ×6, his cards 46003–46011,
  Aggression 46012–46018, basic 46019–46023, obligation 46024, nemesis set `iceman_nemesis` 46025–46028 and the modular
  set Sauron (`sauron` 46029–46032). The Jubilee pack: Jubilee / Jubilation Lee (47001a/b), her cards 47002–47010 with
  three versions each of 47007, 47008 and 47010, Justice 47011–47017, basic 47018–47022, obligation 47023, nemesis set
  `jubilee_nemesis` 47024–47027, the off-aspect events 47028 and 47029, and the modular set Arcade (`arcade`
  47030–47034). 72 raw records and the two nested alter-ego faces, every one read, and a scan read for 69 of the 74
  faces (§0.4); both packs' rules inserts, which are not in the repo. Sections 0.4, 3.61–3.70, questions 33–40, §5.4,
  §7.2 and §7.3. No schema change.
- **Pass 2c's content.** The Nightcrawler pack: Nightcrawler / Kurt Wagner (48001a/b), his cards 48002–48011, Protection
  48012–48020, basic 48021–48025, obligation 48026, nemesis set `nightcrawler_nemesis` 48027–48030, the off-aspect
  events 48031 and 48032, and the modular set The Crazy Gang (`crazy_gang` 48033–48038). The Magneto pack: Magneto /
  Erik Lehnsherr (49001a/b), his cards 49002–49011, Leadership 49012–49020, basic 49021–49026, obligation 49027, nemesis
  set `magneto_nemesis` 49028–49032, the four linked allies 49033–49036 with Children of the Atom 49037, and the modular
  set Hellfire Club (`hellfire` 49038–49042). 80 raw records and the two nested alter-ego faces, every one read, and a
  scan read for 74 of the 82 faces (§0.5); both packs' rules inserts, which are not in the repo; the five RRG p. 69
  errata, already in the curations. Sections 0.5, 3.71–3.81, questions 41–46, §5.5, §7.4 and §7.5. No schema change.
- **Pass 3's content.** The owner's answers to questions 11 to 40 in §4.1; every passage and test that assumed
  default A rewritten for the seven answers that are B (Q9, Q14, Q19, Q22, Q26, Q31, Q33), with the notes on Q1, Q5,
  Q13 and Q16; §1.4, §1.6, §1.10, §1.16, §1.18, §1.21, §2.3, §2.7 and §2.8 brought into line with the emitted data
  (eight one-stage Horsemen joined by `sideBCardId`, main scheme ids on the a cards, `setAsideCardIds`); and §8, the
  build order: the data left, 43 engine tasks, the proof for each "exists" row, the scripting order and the campaign,
  client and Guided mode work. Questions 41 to 46 are open. A card of a later pass named in an earlier section is
  there only to show that a primitive composes.
- **Data state (2026-10-07, HEAD e9805f4b):** all five packs are emitted under `packages/content/src/data/` (`aoa`:
  194 cards, 23 sets, 5 scenarios, 2 starter decks), with six starter decks, `AOA_CAMPAIGN` and the `WAVE8_*`
  exports; the wave is in `PLAYABLE_CARDS` and listed as unscripted. What is left for the data agent is §8.1. The
  data survey (`docs/phase7-wave8-data-survey.md`) landed after pass 1a; pass 1b answers its gaps 3, 7, 8, 14 and 17
  and its open questions 3 and 5 (§1.12–§1.22); pass 1c answers its gaps 4, 5, 6, 9, 10, 11 and 19 and its open
  questions 2, 3 and 10 (§1.23–§1.31).

## 0. Sources

Authorities, in the order they win (RRG 1.8 "The Golden Rules", p. 4: card text and scenario rules beat the Rules
Reference; FFG rulings clarify both):

1. **Card text and product rules.**
   - The Age of Apocalypse rulebook, `docs/campaign-modes/mc45_age_of_apocalypse_rulebook.pdf` (24 pages), converted
     in `docs/campaign-modes/markdown/mc45_age_of_apocalypse.md`, cited as "MC45 p. N" (PDF page = printed page).
     Pages read for pass 1a: 2, 3, 8, 11, 12; pp. 9, 10 and 13 are full-page art. Four conversion slips, each checked
     against the PDF's text layer (`pymupdf`) or a render:
     - p. 3: the "Villainous" heading is separated from its paragraph, which the markdown prints after "Steady".
     - p. 8: the four "Modular Difficulty" bullets are printed after the Campaign Instructions box, and the bullet
       "Expert Campaign Only: Record each identity's remaining hit points" belongs to that box's Victory list.
     - p. 8: the PDF text layer drops the per player icon; a render of the page shows "Standard Mode: Place
       1[per_hero] threat", "Expert Mode: Place 2[per_hero] threat", "Heroic Mode: Place 3[per_hero] threat" and
       "Skirmish Mode: Place 0 threat", as the markdown has them.
     - pp. 2 and 12: the callouts show the four Horsemen with "if he has at least 1 hit point remaining" and "cannot
       be defeated while another villain has hit points remaining". The printed cards (scan 45081a) and the raw data
       read "if he has at least 1 hit point" and "while another villain has at least 1 hit point". The card wins; the
       meaning is the same.
   - Card text: `packages/content/raw/marvelcdb/aoa.json`, every record of the six sets above pulled by script. Not an
     authority on its own. Five scans were read (`assets/card-art/bundles/cards/`, gitignored): 45062b, 45071, 45081a,
     45085b and 45090. They confirm: Hunting Gene Traitors 1B is 0 starting threat, target 11[per_hero], acceleration
     of 1[per_hero] with a star; The Horsemen of Apocalypse 1B is 0, 12[per_hero] and 1[per_hero]; Gene Pool is 4
     starting threat with no icons; Golden Horse prints +1 SCH, +1 ATK and two boost icons.
2. **RRG 1.8** (`mc_rulesreference_v18_compressed.md` for text, the PDF for page numbers). Entries this pass leans on:
   "Activation" (p. 6), "All-Purpose Counter" (p. 6), "Amplify Icon" (p. 7), "Attach To" (p. 8), "Attack (Enemy
   Activation)" (pp. 8–10), "Boost" (p. 11), "'Cannot'" (p. 11), "Choose (Option)" (p. 12), "Cost" (p. 13), "Defeat"
   (p. 15), "Find" (p. 19), "Guard" (p. 21), "Hit Points" (p. 22), "Nemesis Encounter Set" (p. 30), "Overkill"
   (p. 31), "Per Player Icon" (p. 32), "Permanent" (p. 32), "Piercing" (p. 32), "Player Deck" (p. 33), "Quickstrike"
   (p. 36), "Remaining Hit Points" (p. 36), "Reveal" (p. 38), "Setup (Keyword)" (p. 40), "Side Scheme" (p. 40),
   "Stalwart" (p. 40), "Standard Set" (p. 40), "Star Icon" (pp. 40–41), "Stun, Stunned" (p. 41), "Surge" (p. 42),
   "Text Box" (p. 44), "Tough" (p. 44), "Toughness" (p. 45), "Villain Defeat" (p. 47), "Villainous" (p. 47), "When
   Defeated Abilities" (p. 48), Appendix II "Setup" (p. 51), and the FAQ "Scenario #4 – The Sinister Six" (p. 62: with
   more than one villain in play, "the villain with the active counter takes the overkill damage").
   - The RRG's "Age of Apocalypse Expansion" FAQ (p. 64) is four entries on Magik (pass 2a). Its errata heading
     (p. 69) lists Rogue, Energy Transfer, Mystique's Manipulations and Bonebreaker, none a card of this pass. **No RRG
     FAQ or erratum names a card of pass 1a.**
3. **FFG rulings** (`marvel-champions-rulings-post-rrg-1-7.md`, cited by date heading). Every title of the six sets was
   matched against the file by script: no ruling names one. Rulings on the rules this pass uses:
   - December 17, 2025 – Ruling 4 (3): "The **Find** keyword can only search 'in game' areas" (RRG p. 19).
   - January 11, 2026 – Ruling 1 (1): a defeated side scheme "is considered in play until its When Defeated ability
     resolves. Its amplify icon remains in effect" (RRG pp. 7, 48). Applies to The Specter of Death (45089).
   - June 2, 2026 – Ruling 2 (1): "Damage is dealt **simultaneously**" to several enemies (RRG p. 14), the basis of
     the four Horsemen falling together (§3.9).
   - June 25, 2026 – Ruling 4 (3): "Environments flip, they are not revealed" (Pursued by the Past, §3.6).
   - June 25, 2026 – Ruling 5: "Finding and revealing an attachment already in play triggers its When Revealed
     abilities and keywords" (RRG p. 19; §3.1).
   - April 30, 2026 – Ruling 4 has two answers: (2), the Prelate minions of the Apocalypse scenario, is pass 1b's
     (below, §2.7); (1), Digging Deep in a mission attempt, is pass 1c's (§0.2, §3.38).
4. `docs/phase7-wave8-sources.md` and `docs/phase7-wave8-handoff.md` are pointers. Two lines of the sources page are
   superseded here: its §3.1 calls the amplify icon new to this cycle (it has been in the engine since wave 3 §3.6),
   and its §6 item 5 asks whether "[star]" and amplify are one primitive (they are not: RRG "Star Icon", p. 40, "has
   no effect; it is merely a reminder", and raw `[amplify]` is a different token).

No ruling of pass 1a disagrees with the RRG. One rulebook sentence disagrees with a card (§4.2 Q5).

### 0.1 Pass 1b's sources

1. **The rulebook.** Pages read: 14, 16 and 19; pp. 15, 17, 18 and 21 are full-page art (no text layer); p. 20 is
   the campaign (pass 1c). Slips, each checked against the PDF's text layer:
   - p. 14: the bold sentence "If Apocalypse is defeated with No Longer Worthy attached, the players win the game."
     closes "Stop the Apocalypse"; the markdown prints it after the Campaign Instructions box. The markdown also
     sorts the three "Expert Campaign Only" bullets into Setup (two) and Victory (one), where the text layer lists all
     three after the Victory list; pass 1c checks that box against a render.
   - p. 14: the rulebook quotes 1B as "discard each attachment **on** him"; the card (scan 45103b) reads "**from**
     him". Same meaning; the card wins.
   - p. 16: the markdown prints the Campaign Instructions Setup list between "Villain Deck" and "Main Scheme Deck",
     and the Victory list after the encounter deck paragraph. In the PDF the box is its own column and the scenario
     text is continuous.
   - p. 19: the three callouts are preview images (two read "© 2019 FFG" with the collector number "###"). The Giant
     face's callout and its scan (45184c) both print "179C", the number p. 14 gives the Prelates ("179-183"); the
     set line "EN SABAH NUR (1/16)" and raw place the card at 45184. Stats and text of the callouts match raw.
2. **Card text.** Every record of the nine sets and the five nested Prelate faces pulled from raw by script. Scans
   read: 45101a, 45101b, 45102b, 45103b, 45104a, 45104b, 45105a, 45105b, 45115, 45118, 45121b, 45126, 45128, 45140,
   45147b, 45148b, 45163, 45179b and 45184c. They settle:
   - **45104b exists and raw does not have it.** The back of Heart of the Empire is The Towering Citadel (the owner's
     scan, `assets/card-art/bundles/cards/45104b.png`, and Hall of Heroes' image of the same face): side scheme, 3
     starting threat with no per player icon, two acceleration icons, "Threat cannot be removed from this scheme while
     a [PRELATE] minion is in play. When Defeated: The first player reveals a random set-aside [PRELATE] minion. Deal
     each other player an encounter card. Reveal The Tyrant's Throne side scheme and remove this card from the game."
     Raw links 45104a to 45105b, which is wrong (§1.14).
   - The Age of Apocalypse 1B: starting threat 1[per_hero], target "X[per_hero]", acceleration +1[per_hero]. Dark
     Beast's Bogus Journey 1B: 1[per_hero], 10[per_hero], +1[per_hero]. En Sabah Nur's Pyramid 1B: 1[per_hero],
     8[per_hero], +1[per_hero] with a star. The Rise of Apocalypse 2B: 1[per_hero], 10[per_hero], +1[per_hero] with a
     star.
   - No Longer Worthy (45105b) reads "heal 5[per_hero] **damage** from him"; raw has "hit points". Gladiator (45140)
     reads "deal Gladiator **to** yourself"; raw has "by yourself". Pterosaur (45128) and Tusk (45115) print SCH 0;
     raw omits the field (the survey found Velociraptor 45129 prints SCH 1).
   - Heart of the Empire: 2 threat, one acceleration icon. The Tyrant's Throne: 4, three icons. Time-Travel
     Shenanigans: 2[per_hero], one icon. Ancient Ritual: 5 flat. Apocalypse IV: SCH 3, ATK 3 with a star, 11[per_hero].
     The Prelate faces print the set name "PRELATES (n/5)".
3. **RRG 1.8** entries pass 1b adds: "Attachment" (p. 8), "Crisis Icon" (p. 14), "Dash (Value)" (p. 15),
   "Double-Sided Card" (p. 17), "Encounter Deck" (p. 17: a "discard until" that empties the deck "is considered to be
   fulfilled"), "Engage" (p. 18), "Flip" (p. 20: "A foldable, 'three-sided' card is considered to have flipped any
   time the faceup side of the card changes"), "Hinder X" (p. 22), "Ignore" (p. 23), "Main Scheme, Main Scheme Deck"
   (p. 27), "Patrol" (p. 32), "Printed" (p. 35), "Removed from the Game" (p. 36), "Replacement Effect" (p. 37),
   "Retaliate X" (p. 38), "Set Aside" (p. 39), "Special" (p. 40), "Steady" (p. 41), "Target Threat" (p. 43),
   "Teamwork" (p. 43), "Victory X" (p. 46), "Villain, Villain Deck" (p. 46), "'Would'" (p. 48), "You, Your" (p. 49).
   **No RRG FAQ or erratum names a card of pass 1b.**
4. **FFG rulings.** Every title of the nine sets and the five Prelate faces was matched against the file by script.
   Two rulings name one (the matches on "Gauntlet" and "Barrage" are other cards: Gauntlet Guns, Infinity Gauntlet,
   Berserker Barrage):
   - **February 20, 2026 – Ruling 4** (Cruel Experiment 45124): "Reveal rules assume an attachment has 'attach to'
     text resolving upon being revealed. If an attachment lacks 'attach to' text, it attaches when its 'When
     Revealed' ability triggers (as with Cruel Experiment). Rules Reference wording will be clarified in a future
     update." **This ruling corrects RRG "Reveal" (p. 38), step 2**, which leaves such a card "on the table in front
     of the player revealing it. (It is not in play.)" The ruling is the later clarification and the intended result;
     §3.25 builds it.
   - **April 30, 2026 – Ruling 4 (2)**: "Prelate versions of minions remain available for the Apocalypse scenario
     even if their Overseer counterparts were crossed out of the campaign log." §2.7; the log itself is pass 1c.
   - Rulings on rules this pass uses, already quoted above: January 11, 2026 – Ruling 1 (1) (Source of Power 45153 and
     Trial by Combat 45146 print an amplify icon and a When Defeated); June 25, 2026 – Ruling 5 (Police State 45138
     finds and reveals an attachment that may be in play, §4.2 Q17).

### 0.2 Pass 1c's sources

1. **The rulebook.** Pages read: 4, 5, 6, 20 and 24, and the Campaign Instructions boxes on pp. 8, 12, 14, 16 and 20;
   p. 7 is a comic page with no rules. Pages 5, 6, 8, 12, 14 and 20 and the log sheet
   (`docs/campaign-modes/log-sheets/mc45_age_of_apocalypse_campaign_log.pdf`, the same sheet as p. 24) were read from
   130 dpi renders as well as the text layer. Slips:
   - p. 5: the markdown interleaves the Mission Rules card's six bullets with Sugar Man's stat box ("When a player
     plays an ally, they must be affected by card abilities…"). The text layer has the card clean; §1.29 quotes it.
   - p. 5 and the boxes: "the Age of Apocalypse **encounter set**" (p. 5) and "the Age of Apocalypse **modular set**"
     (pp. 8, 12, 14, 16, 20) are the same four cards (§1.28, §4.2 Q23).
   - p. 6: the resource icons of the example are glyphs the text layer drops. From the render and raw: Magik's Crown
     (45033, [mental]) is assigned to Randall (45003, [wild]), Clobber (45046, [physical]) to X-23 (45012,
     [physical]), Bloodgem (45050, [wild]) to Marrow (45021, [energy]). The page also prints "cannot take damage while
     another minion in the mission area" (a word is missing) and "strike its name from of the campaign log".
   - pp. 12, 14, 16 and 20: the renders settle §0.1's doubt. The two "Expert Campaign Only" Setup bullets are a shaded
     box that closes the Setup list, after the ally search; the third closes the Victory list. The markdown has
     pp. 14, 16 and 20 right, and the text layer's order (all three after Victory) is a reading-order artifact. On
     p. 12 the markdown prints the "VICTORY:" heading above "SETUP:" and the five Victory bullets inside the Setup
     list. Scenario 1's box (p. 8) has no expert Setup bullet: nothing is recorded yet.
   - p. 20: the shaded line "When playing expert campaign, the ally you choose during Setup must share a trait with
     your hero." stands at the foot of the Expert Campaign Rules column, not in scenario 5's box. The text layer
     prints it straight after scenario 5's bullets; the markdown has it right. It is read as a rule of every
     scenario's ally search (§2.16).
   - p. 24: the sheet's rows are Liberate the Seattle Core, Evacuate Survivors, Sabotage the Sea Wall, Find Lost
     Mutants, the cards' own order (1/5 to 4/5); the text layer lists them in another order. The Evacuate Survivors
     "Defeated" cell drops a word ("They may include 1 copy of card in their deck"); Sabotage the Sea Wall's cell
     prints "1 copy of that card". **The sheet has no box for whether a mission was defeated and no row for Protect
     the Professor** (§1.23).
   - Two repo documents have the sheet's columns the wrong way round: `docs/campaign-mode-design.md` §1.2 ("failing a
     mission lets each player add a free upgrade/support/ally … defeating it removes cards") and
     `docs/campaign-client-per-box.md` §3's MC45 row ("Missions whose 'not defeated' result is a reward"). On the
     sheet **Defeated** is the reward and **Not Defeated** the cost (§2.14). Reported, not edited here.
2. **Card text.** Every record of the five sets pulled from raw by script. Scans read: 45164, 45166b, 45171a, 45171b,
   45176, 45177, 45178, 45179a and 45181a. They settle:
   - A mission's b face prints SIDE SCHEME, the trait FINISHED, a **dash** where the threat goes and the a face's set
     line ("MISSION (1/5)"). The a face prints 5[per_hero] (the callouts on pp. 5 and 6).
   - Mission Team has no cost box, one [wild] icon, the trait MISSION (a) or FINISHED (b) and "BASIC / CAMPAIGN". The
     printed 45171a reads "the next ally played to the mission by 2": raw carries the current text (§1.26).
   - The Overseer a faces print a dash for SCH and for ATK, 5[per_hero] hit points and "OVERSEER (n/5)".
   - North American Sea Wall: 2 threat with no per player icon, two boost icons and a star, "CAMPAIGN (1/5)". Panicked
     Refugees: one acceleration icon in the text box, "CAMPAIGN (2/5)". Agent of Apocalypse: SCH 2, ATK 2, 3 hit
     points, a star and no boost icon, "AGE OF APOCALYPSE (1/4)". Desperate Measures: cost 1, one [wild] icon.
   - **The Mission Rules card has no raw record and no scan.** Its side A is quoted from p. 5's callout (text layer);
     its side B is not shown anywhere in the rulebook (§1.29).
3. **RRG 1.8** entries pass 1c adds: "Ally" (p. 7), "Ally Limit" (p. 7), "Campaign-Specific Card" (p. 11), "Discard"
   (p. 16), "Forced" (p. 20), "In Play and Out of Play" (p. 23), "Modes of Play" (pp. 28–29: "If a card is removed
   from a campaign, that card can no longer be used during the rest of the campaign, even if players retry the
   scenario wherein that card was removed"), "Obligation" (p. 30), "Ownership and Control" (p. 31), "Player Deck"
   (p. 33), "Player Elimination" (p. 34), "Remaining Hit Points" (p. 36), "Unique Icon" (pp. 45–46), "Wild Resource"
   (p. 48), Appendix II step 13 "Campaign Setup" (p. 51), the FAQ "Campaign Mode" (p. 61: an expert campaign does not
   force expert mode on any scenario) and the erratum "Mission Team (#171A)" (p. 69). **No RRG FAQ names a card of
   pass 1c; one erratum does** (Mission Team).
4. **FFG rulings.** Every title of the five sets was matched against the file by script. None of the fifteen titles
   of the mission, campaign and Age of Apocalypse sets is named. "Mister Sinister" and "Shadow King" appear once, in
   the question of the one ruling on this campaign:
   - **April 30, 2026 – Ruling 4 (1)**: "You can trigger Digging Deep's Response to add it to your hand; if you do, it
     does not count for the mission attempt and no replacement card is drawn." Digging Deep is `next_evol` 40060
     ("Response: After this card is discarded from the top of your deck, add it to your hand."). The engine already
     follows the ruling for every deck discard (wave 7 §3.55, §4.1 Q32: a card a response took away is no longer among
     the cards the discarding ability counts). §3.38.
   - **April 30, 2026 – Ruling 4 (2)**, quoted in §0.1: a struck Overseer does not take its Prelate face out of
     scenario 3. MC45 p. 14 says the converse: "Defeating a [PRELATE] minion does not remove its [OVERSEER] version
     from the campaign." §1.25, §3.46.

No ruling of pass 1c disagrees with the RRG. Two sentences of the rulebook depart from it, and the rulebook wins both
(RRG "The Golden Rules", p. 4): MC45 p. 6 lets a [wild] icon on a discarded card match any icon on an ally, and any
icon match an ally's [wild], where RRG "Wild Resource" (p. 48) says a wild resource not generated for a cost "does not
have any characteristic other than 'wild resource'"; and MC45 p. 4 calls cards 164–183 campaign cards, where RRG
"Campaign-Specific Card" (p. 11) names them by "the word 'Campaign' printed at the bottom of the card", which
45171a–45178 carry and the Age of Apocalypse, Mission and Overseer cards (45164–45170b, 45179a–45183a) do not (§4.2
Q23).

### 0.3 Pass 2a's sources

1. **The rulebook.** Pages read: 2 (the identity callouts) and 22 (the two decklists and their introductions). Slips
   and differences:
   - p. 2: the Bishop callout is a preview ("After Bishop takes X damage from an attack, discard X cards from the top
     of your deck"). The card (scan 45001a) reads "takes any amount of damage from an attack, discard an equal number
     of cards". Same meaning; the card wins.
   - p. 22: "When he takes any amount of damage, he discards an equal number of cards" drops "from an attack". The card
     wins: only damage from an attack (§3.52).
   - p. 22: Suit Up is described as printed ("an upgrade that can be played on that ally"), before the erratum.
   - p. 22: the markdown prints Soul Strike's condition as "the [energy] or [physical] icons"; a render of the page has
     [physical] or [wild], as the card does. The markdown's p. 2 callout of Magik's Crown has the same glyph slip
     ("[mental] or [physical]" for [mental] or [wild]).
   - p. 22 confirms two readings: "**While in hero form**, keep the top card of your deck faceup" (§3.48) and "Attach
     Sidekick to one of Bishop's **identity-specific allies**" (Malcolm, Randall; §3.53).
   - Both decklists were matched to raw by the data agent (data steps 6; `curation/aoa.ts`): 40 cards each, Bishop 15
     identity-specific, 20 Leadership and 5 basic; Magik 15, 16 Aggression and 9 basic.
2. **Card text.** Every record 45001a–45058 pulled from raw by script, with the nested faces 45001b and 45030b. Scans
   read (`assets/card-art/bundles/cards/`): 45001a, 45001b, 45030a and 45030b (300 px wide, read enlarged), and
   45002–45018, 45020, 45021, 45025–45029 and 45031–45058 except 45046 and 45047. Not read: the reprints 45019, 45046
   and 45047 (their text is the original's) and 45022–45024, which have no scan in the bundle. They settle:
   - **No raw slip in this pass.** Every text box, trait line, cost, stat and icon read matches raw.
   - **A slip in an earlier pack, found on the way** (§3.58): the basic ally Colossus of `mut_gen` (32048, reprinted
     as `wolv` 35021) prints the subtitle "Piotr Rasputin" (scan 32048); raw and the emitted data have none.
   - Resource icons of the box's ten allies (§3.36 pairs them in a mission attempt): Malcolm [wild], Randall [wild],
     Colossus [wild], Cable [mental], X-23 [physical], Legion [energy], Marrow [energy], Goldballs [physical], Tempus
     [mental], Triage [energy]. MC45 p. 6's example (Randall [wild], X-23 [physical], Marrow [energy], Magik's Crown
     [mental], Clobber [physical], Bloodgem [wild]) agrees with the five scans read (Clobber 45046 is a reprint).
   - "Play only if" lines: Marrow "Play only if **you have** the [X-FORCE] or [X-MEN] trait."; Tempus and Stepford
     Cuckoos "Play only if **your identity has** the [X-MEN] trait."; Bloodgem, Basic Spell and Spiritual Meditation
     "… the [MYSTIC] trait." No other ally of the box prints one.
   - Stats: Cable prints two consequential damage icons under ATK, every other ally one under each power. Legion
     prints a star on THW and on ATK, Goldballs on ATK only, Belasco on SCH and on ATK. Super-Charged, Energy
     Conversion, Advanced Suit, Scrying, Bloodgem and Spiritual Meditation print cost 0.
   - Encounter side: Portal Through Time prints 4 threat with no per player icon, one acceleration icon (the icon of
     45104a) and three boost icons; Ruler of Limbo 3 threat with no per player icon, one **amplify** icon and three
     boost icons; Battle for Limbo a boost star and no boost icon. Both obligations print two boost icons.
   - Stored Energy (45010) prints two different icons, [energy] and [physical], and no text.
3. **RRG 1.8** entries pass 2a adds: "Basic Power" (p. 10), "Cancel" (p. 11), "Cost" (pp. 13–14: resources generated
   beyond a cost "were not paid for that cost"; "A cost requiring 'any number' or 'up to' some number of game elements
   requires a minimum of one"), "Defend, Defense" (p. 15), "Hit Points" (p. 22: "The phrase 'starting hit points'
   refers to an identity's printed hit point value"), "Identity-Specific Card" (p. 23), "Initiating Abilities"
   (p. 24), "Limit" (p. 27), "Look, Looked-At" (p. 27), "Max, Maximum" (p. 28), "Play, Put into Play" (p. 32), "Play
   Restrictions and Permissions" (p. 33), "Printed" (p. 35), "Ranged" (p. 36), "Ready" (p. 36), "Resource Card"
   (p. 37), "Restricted" (p. 38), "Search" (p. 39), "Steady" (p. 41), "Subtitle" (p. 41), "'Swap'" (p. 42: "Swapped
   cards maintain the orientation (such as ready or exhausted, faceup or facedown) of the original card"), "Uses"
   (p. 46), "Wild Resource" (p. 48), Appendix I "Player Decks" (p. 50).
   - **FAQ "Magik (#30A)" (p. 64), four entries**, each a test in §3.48 or §3.49. One of them cites a step number
     that the same RRG does not have: "Magik moves the card she is playing to the table in front of her during **step
     3** of the process outlined in the Initiating Abilities section". In RRG 1.8 that is **step 1** (p. 24: "If
     playing a card, the player places that card faceup on the table in front of them"); step 3 is "Determine the
     cost". Either way the card has left the deck, and the next one is faceup, before the cost is paid in step 5.
     §3.49 builds step 1 and names the difference.
   - **Erratum "Suit Up (#17)" (p. 69)**: "an upgrade that can be attached to **an** ally" (§3.59; `curation/aoa.ts`
     already carries it). §0 above says the p. 69 heading lists Rogue, Energy Transfer, Mystique's Manipulations and
     Bonebreaker: that is the markdown's order. The PDF page lists Suit Up and Mission Team under "Age of Apocalypse
     Expansion".
4. **FFG rulings.** Every title and subtitle of the 58 records was matched against the file by script. **No ruling
   names a card of this pass.** The only hits are on the word "Energy": Energy Channel, Aggressive Energy, and one
   that does name the Core card 45022 reprints:
   - **April 30, 2026 – Ruling 3 (6)**: "Haywire does not affect resource icons; Energy still provides 2 icons." A
     card's printed icons are counted as printed (§3.52: Super-Charged, Advanced Suit, Temporal Trickery).
   - Rulings on rules this pass uses: **April 30, 2026 – Ruling 3 (7)**, "The deck is reshuffled **before** the
     currently resolving card enters the discard pile" (RRG p. 33; §3.48 test 5). **January 26, 2026 – Ruling 4 (7)**
     and **March 19, 2026 – Ruling 4**, a hero and an ally with the same title and no matching subtitle or alter-ego
     title "do not match" (RRG p. 45; §3.58). **February 28, 2026 – Ruling 7 (2)**, a card that was not in play when
     another was revealed does not give it surge (Portal Through Time, §7.1). **March 19, 2026 – Ruling 5**, an ability
     that reads a hidden top card "can trigger (paying cost with incomplete information …)" (the nearest ruling to §4.2
     Q26, answered B: Redwing's ability turns the hidden card over to read it, and nothing turns Magik's facedown top
     card over, so her cards can be played against it and their condition is not met). **March 19, 2026 – Ruling 6**,
     unique cards added during setup "can share titles with cards in player decks" (§3.58).

No ruling of pass 2a disagrees with the RRG, and none says a printed wording of these cards gives an unintended
result. The RRG disagrees with itself once (the FAQ's "step 3", above), and one card's wording needs the owner's
reading (Witchfire's "Otherwise", §4.2 Q31: answered B, built as printed and tagged "RAW pending FFG clarification").

### 0.4 Pass 2b's sources

1. **Card text and product rules.**
   - **Neither pack's rules insert is in the repo.** Both were read on 2026-10-07 from Hall of Heroes' photos of the
     printed sheets (`hallofheroeslcg.com/wp-content/uploads/2024/05/img_3025.jpg`, Iceman; `…/2024/07/img_3359.jpg`,
     Jubilee), which are a transcriber's copy of FFG's own text and are cited as "the Iceman insert" and "the Jubilee
     insert". They carry no page numbers.
     - The Iceman insert, "Frostbite Upgrade", in full: "Iceman comes with six copies of an identity-specific upgrade:
       Frostbite. These upgrades are set aside at the beginning of each game and do not count toward Iceman's deck size.
       His kit includes many abilities that attach set-aside copies of Frostbite to enemies. Each copy has a Forced
       Response that sets it aside after the enemy it is attached to activates or leaves play. When that happens, remove
       that copy of Frostbite from play and set it aside where it was at the beginning of the game." It also reprints
       the player side scheme rules and the entries for indirect damage, permanent and victory X.
     - The Jubilee insert reprints the player side scheme rules and the entries for alliance, piercing, team-up and
       victory X, and has no rule of its own. Its strategy box: "Use different resource types to pay for Firecracker and
       Flash of Light"; "Spend as many different resources as you can to play Three Steps Ahead to remove more threat
       from a scheme for each resource icon used!" (§3.62, §4.2 Q34).
     - **One insert sentence disagrees with a card.** Both inserts say "Each of the player side schemes in this product
       has the victory X keyword". Shopping Spree (scan 47003) prints none. The card wins (RRG "The Golden Rules", p.
       4): defeated, it goes to its owner's discard pile.
   - Card text: every record of `packages/content/raw/marvelcdb/iceman.json` (32 records and the nested alter-ego face)
     and `jubilee.json` (40 and one) pulled by script, and the emitted records of
     `packages/content/src/data/{iceman,jubilee}/cards.ts` read field by field against them.
   - **Scans read** (`assets/card-art/bundles/cards/`, on contact sheets at 520 px a card; the 300 px identity and
     version scans enlarged): 46001a, 46001b, 46002–46016, 46018–46020 and 46024–46032; 47001a, 47001b, 47002–47006,
     47007a/b/c, 47008a/b/c, 47009, 47010a/b/c, 47011–47019 and 47021–47034: 69 of the 74 faces. Not read: the reprints
     46017, 46021, 46022 and 46023 (their text is the original's) and X-Gene 47020, a reprint of 38019 with no scan in
     the bundle. They settle:
     - **Frostbite (46002)** prints a dash for its cost, no resource icon, "Permanent." and the set line "**FROSTBITE
       (1/6)**": its own six-card set beside "ICEMAN (n/15)" (Snow Clone is 1/15, Chill Out! 13/15). Bobby Drake
       (46001b) prints "Bobby Drake begins the game with 6 Frostbite upgrades set aside." above Cool Off. §3.61, §7.2.
     - **The three versions** of Firecracker, Flash of Light and Plasmoid Energy are the same card in title, cost, type,
       traits, text, flavor and art; they differ in the resource icon and the collector line, and each has its own
       number in the set of fifteen: Firecracker 7A [energy] "JUBILEE (6/15)", 7B [mental] (7/15), 7C [physical] (8/15);
       Flash of Light 8A [energy] (9/15), 8B [mental] (10/15), 8C [physical] (11/15); Plasmoid Energy 10A
       [energy][mental] (13/15), 10B [energy][physical] (14/15), 10C [mental][physical] (15/15). §3.69, §7.3.
     - **One raw slip in a text box:** Cryokinetic Perception (46005) prints "If that card has **the** ICE trait"; raw
       has "an". The title is "Cryokinetic" on the card (the decklist photo's "Cyrokinetic" was a soft read). Grand
       Finale (47009) prints that title (the curation already corrects raw's "Grande Finale"). Unlikely Duo (47022)
       prints "Team-Up (Jubilee and Wolverine). Max 1 per deck."; raw's quantity of 2 is the pack's count, one for each
       of the two decks that may hold it.
     - Resource icons of the nine allies (§3.36 pairs them in a mission attempt): Snow Clone [physical]; Shark-Girl,
       Glob, Beak, Chamber and Synch [energy]; Shadowcat [mental]; Husk [physical]; Wolverine [wild].
     - "Play only if your identity has the [X-MEN] trait.": Glob, Shadowcat and Synch. No other ally of the two packs
       prints a play restriction. X-Gene (reprint) prints the MUTANT line.
     - Subtitles, each as raw has it: Shark-Girl "Iara Dos Santos", Glob "Robert Herman", Shadowcat "Kitty Pryde", Beak
       "Barnell Bohusk", Wolverine "Logan", Chamber "Jono Starsmore", Husk "Paige Guthrie", Synch "Everett Thomas". Snow
       Clone has none and no unique icon.
     - Stats: Snow Clone prints a dash for THW and ATK 2 with a star; Shark-Girl THW 0 with one consequential icon and
       ATK 2 with a star; Glob two consequential icons under THW; Wolverine two under ATK and a star; Chamber a star on
       ATK; Husk a star on THW and on ATK. Suppressing Fire, Keep Up the Pressure, Shopping Spree and Generation X print
       cost 0 (raw omits the field).
     - Schemes: Keep Up the Pressure 2[per_hero] and Generation X 3[per_hero]; Shopping Spree 2 with no per player icon.
       Playing with Fire 3 flat, an acceleration icon, three boost icons; Sauron Lives! 3 flat, a crisis icon, three
       boost icons; Naughty Children 2 flat, a crisis icon, two boost icons; the three TRAP! schemes 2 flat with "Hinder
       1[per_hero]", two boost icons each and one icon each: hazard (Welcome to Murderworld), amplify (Arcade's
       Funhouse), crisis (Hall of Mirrors).
     - Encounter cards: Pyro SCH 1, ATK 3 with a star, 4 hit points, three boost icons; Pyro's Flamethrower "+0" ATK
       with a star, two boost icons; Burn! a boost star and no boost icon; Sauron SCH 2, ATK 2, 6, a boost star and no
       boost icon; Life Drain a star alone in its ATK box, two boost icons; The Eye of Sauron one. Nanny SCH 2, ATK 1
       with a star, 4, two boost icons; Battle Suit +1 ATK, two; "Lost" Child −1 SCH, one; Arcade SCH 2, ATK 2, 3,
       three; Elaborate Trap one. Both obligations print two.
   - The printed decklist cards (`docs/phase7-wave8-handoff.md`): Iceman's hero list is 21 cards with "Frostbite ×6" and
     15 without; Jubilee's deck is 40 with one Unlikely Duo.
2. **RRG 1.8** entries pass 2b adds: "Ability", Simultaneous Timing Priority (p. 5: a status card's Forced Interrupt,
   then Forced Interrupts, then Interrupts); "Alliance" (p. 6); "Attack (Player Ability Type)" (p. 10: "each instance of
   damage in that attack ability that does not use the word 'additional' is increased"); "Consequential Damage" (p. 13);
   "Copy" (p. 13: "A copy of a card is defined by title … regardless of card's type, text, artwork, or any other
   differing characteristics"); "Cost" (p. 13: "Resources generated beyond the specified cost … were not paid for that
   cost"; p. 14: "additional cost"); "Form, Change Form" (p. 21); "Indirect Damage" (p. 24); "Labeled Ability" (p. 26);
   "Permanent" (p. 32: "Permanent cards are set aside before step 1 of setup and are put into play later by abilities on
   other cards"; "do not count towards a player's minimum or maximum deck size"); "Player Side Scheme" and "Player Side
   Scheme Limit" (p. 34); "Replacement Effect" (p. 37); "Resolve" (p. 37); "Resource" (p. 37); "Set Aside, Set-Aside"
   (p. 39); "Simultaneous Resolution" (p. 40); "Team-Up" (p. 43); "Thwart" (p. 44); "Tough" (p. 44); "Upgrade" (p. 46:
   an upgrade not attached to another friendly character is "an extension of the controlling player's identity");
   "Villain Defeat" (p. 47: upgrades carry over to a stage of the same title); "Wild Resource" (p. 48: "When a player
   generates a wild resource, they may specify which resource type (energy, mental, physical, or wild) it is being used
   as"); "'Would'" (p. 48); Appendix I "Player Decks" (p. 50: the exact quantity of each identity-specific card; the
   Team-Up replacement); the erratum "Mutants at the Mall (#88A)" (p. 68: "discarding any other **ally** version of
   Jubilee from play").
   - **No RRG FAQ or erratum names a card of pass 2b.** The Mutants at the Mall erratum is about an earlier card and
     matters now that Jubilee is a hero (§3.68, §4.2 Q39).
3. **FFG rulings.** Every title, subtitle and ability name of the 72 records was matched against the file by script.
   **No ruling names a card of these two packs.** "Jubilee" and "Wolverine" are matched by one:
   - **June 2, 2026 – Ruling 1** reads the ally **Jubilee of the Wolverine pack** (`wolv` 35003: "Response: After
     Jubilee enters play, choose an enemy. Until the end of the phase, while Wolverine or Jubilee is making a basic
     attack against that enemy, they get +2 ATK for that attack."), not a card of this pass: "Jubilee's ability
     **targets the chosen enemy**, not specific card instances. Each instance of Jubilee's ability in a phase grants +2
     ATK to both Wolverine and Jubilee against that enemy, stacking across multiple triggers and functioning identically
     with Cameo / ally versions." It was built in wave 6 (§3.43 there;
     `wave6/wolv/wolverine/support-upgrades-allies.ts`, `titled("Wolverine", "Jubilee")`). This pass adds two cards its
     title match reaches, the hero Jubilee (47001a) and the ally Wolverine (47002): §3.68.
   - Rulings on rules this pass uses: **January 17, 2026 – Ruling 4 (1)**, "When generating a wild resource, you specify
     which resource type it represents, even when overpaying a cost" (§3.62). **February 8, 2026 – Ruling 1**
     (Coordinated Attack, `cyclops` 33016): as written the reduction is lost when the attack defeats the minion, and
     "FFG intends for players to play it such that an attack defeating the minion **still reduces consequential
     damage**"; Snow Clone and Chamber have the same shape (§3.67, §4.2 Q38). **January 26, 2026 – Ruling 4 (7)** and
     **March 19, 2026 – Ruling 4** (the unique match, §3.68).

No ruling of pass 2b disagrees with the RRG. One ruling states an intent its card's wording does not give (February 8,
2026 – Ruling 1), and this pass applies that intent to two cards the ruling does not name, as a question. One insert
sentence disagrees with a card (Shopping Spree), and one insert sentence reads more loosely than the RRG's rule on
overpaid resources (Q34).

### 0.5 Pass 2c's sources

1. **Card text and product rules.**
   - **Neither pack's rules insert is in the repo.** Both were read on 2026-10-07 from Hall of Heroes' photos of the
     printed sheets (`hallofheroeslcg.com/wp-content/uploads/2024/09/img_7696.jpeg`, Nightcrawler;
     `…/2024/11/img_4247.jpg`, Magneto), a transcriber's copy of FFG's text, cited as "the Nightcrawler insert" and "the
     Magneto insert". They carry no page numbers and neither has a rule of its own.
     - The Nightcrawler insert reprints the player side scheme rules and the entries for alliance and victory X, and one
       term: "Featured Term: Tuck. When an ability tells you to tuck a card under another card, place the tucked card
       faceup under the other card. The tucked card is not in play." (RRG "Tuck", p. 45, says the same.) Its strategy
       box: "Attach Bamf! to an enemy and use it to defend against that enemy without exhausting. Play Tally Ho! to
       return that copy of Bamf! to your hand and deal 3 damage to the attacking enemy. Play Bamf! again and follow it
       up with 'Port and Punch to damage each enemy with a copy of Bamf! attached!"
     - The Magneto insert reprints the player side scheme rules and the entries for linked, steady, villainous and
       victory X. Linked: "Card with the linked keyword cannot be included in a player's deck. Instead, they are set
       aside at the start of the game if any player's deck includes the card that brings the linked cards into play
       (indicated in the parentheses following the keyword). Linked cards do not count towards the minimum or maximum
       deck size." Its strategy box: "Use his 'Magnetic Pull' ability each turn to draw a MAGNETIC card from your deck.
       Play Magneto's Cape and Magneto's Armor to ready him and gain a stat boost each time you resolve his ability.
       Attach Wrapped in Metal to a minion to disable it; when the time is right, play Magnetic Missile to hurl that
       minion at an enemy for damage and a stun!"
     - Both inserts say "Each of the player side schemes in this product has the victory X keyword", and here both do
       (Astonishing X-Men and New Recruits print "Victory 0.").
   - Card text: every record of `packages/content/raw/marvelcdb/ncrawler.json` (38 records and the nested alter-ego
     face) and `magneto.json` (42 and one) pulled by script, and the emitted records of
     `packages/content/src/data/{ncrawler,magneto}/cards.ts` read field by field against them. **Raw carries the printed
     wording of three errata cards; the curations (commit fdd07b6d) already hold all five RRG p. 69 errata**, and this
     pass specifies from the current text: Rogue 48012 ("base THW and ATK"), Tweedledope 48037 (the star removed from
     the boost field), Magnetic Missile 49010 ("Discard a minion with Wrapped in Metal attached. Then, deal 5 damage to
     an enemy and stun it."), Deft Focus 49023 (classification Basic) and Exodus 49028 ("equal to his total ATK for that
     attack"). Both starter decks are in the curations (commit c8d41ca6).
   - **Scans read** (`assets/card-art/bundles/cards/`, on contact sheets at 560 px a card, the side schemes at 900 px;
     the 300 px identity scans enlarged): 48001a, 48001b, 48002–48016, 48018–48021 and 48026–48038; 49001a, 49001b,
     49002–49023 and 49027–49042: 74 of the 82 faces. Not read, because the bundle has no scan: the reprints 48017,
     48022–48025 and 49024–49026 (their text is the original's). For §3.80, the title bars of ten earlier cards: 32011,
     32056, 32159, 32172b, 33002, 34003, 37002, 37032, 38003 and 57027; for the scheme icons, 46026 and 47031 as
     references. They settle:
     - **Three raw slips in printed values, all in the Nightcrawler pack's encounter cards.** Brimstone Dimension
       (48028) prints a **hazard icon** in its text box (the glyph of Welcome to Murderworld 47031) and raw and the
       emitted record have no icon. The Crazy Gang (48033) prints **"2[per_hero]"** and raw has a fixed 2
       (`base_threat_fixed`). Tweedledope (48037) prints a **star and no boost icon** in its boost field; the erratum
       removes the star (RRG p. 69: "Removed the star icon from this card's boost field"), which leaves an empty field,
       and raw and the emitted record have 1 boost icon (§4.2 Q44).
     - **Two slips in text.** Selene (49039) prints "Allies cannot attack Selene." and raw drops the period. Sebastian
       Shaw (49038) prints "**Forced Respone**:", a misprint on the card; raw's "Forced Response" is what it means.
     - Deft Focus (49023) prints "PROTECTION" at the bottom, the classification the erratum corrects. Rogue (48012),
       Magnetic Missile (49010) and Exodus (49028) print the wording the errata replace.
     - Costs raw omits, each printed 0: Bamf! 48006, 'Port Away 48010, Under Control 48015, "Come Get Me, Bub!" 48016.
       Squared Off 49017, New Recruits 49020 and Face the Past 49022 print 0 as raw has it. Astonishing X-Men 48020
       prints cost 1 and a flat 5; New Recruits 2[per_hero].
     - Resource icons of the thirteen allies (§3.36 pairs them in a mission attempt): Daytripper [wild]; Rogue, M and
       Cyclops [physical]; Phoenix [mental]; Northstar, Gambit, Kid Omega, White Queen, Surge, Anole, Bling! and Indra
       [energy].
     - "Play only if your identity has the [X-FORCE] or [X-MEN] trait.": White Queen (ally) and Won't Stay Down
       (support). "Play only if your identity has the [X-MEN] trait.": New Recruits. No other ally of the two packs
       prints a play restriction; Moira MacTaggert (reprint) prints the MUTANT line.
     - Subtitles, each as raw has it: Daytripper "Amanda Sefton", Rogue "Anna Marie", Northstar "Jean-Paul Beaubier",
       Gambit "Remy LeBeau", M "Monet St. Croix", Kid Omega "Quentin Quire", Phoenix "Jean Grey", Cyclops "Scott
       Summers", White Queen "Emma Frost", Surge "Noriko Ashida", Anole "Victor Borkowski", Bling! "Roxanne Washington",
       Indra "Paras Gavaskar".
     - Stats: Gambit prints **X** for THW and for ATK, one consequential icon under each; M two consequential icons
       under ATK and one under THW; every other ally one under each. No ally of the two packs prints a star.
     - Collector lines: Bamf! "NIGHTCRAWLER (5/15)" and card number 6; Wrapped in Metal "MAGNETO (6/15)"; the four
       linked allies print "BASIC" and no set line; the nemesis sets "NIGHTCRAWLER NEMESIS (n/5)" and "MAGNETO NEMESIS
       (n/5)"; the modular sets "CRAZY GANG (n/6)" and "HELLFIRE (n/5)".
     - Schemes: Brimstone Dimension 5 flat, a hazard icon, three boost icons; The Crazy Gang 2[per_hero], an
       acceleration icon, two boost icons; Martyr for Mutants 3[per_hero], an amplify icon, three; The Inner Circle 4
       flat, an amplify icon, two.
     - Encounter cards: Azazel SCH 2, ATK 3, 3 hit points, a boost star and no icon; Azazel's Sword +1 ATK with a star,
       two boost icons; Brimstone Strike one; Queen of Hearts SCH 0, ATK 1, 4, three; Jester SCH 0, ATK 1, 5, one;
       Executioner SCH 0, ATK 2, 4, two; Tweedledope SCH 0, ATK 2, 6 (above); "Off with His Head!" one. Exodus SCH 2,
       ATK 2 with a star, 6, three; Fabian Cortez SCH 2, ATK 2, 4, a boost star and no icon; Frenzy SCH 2, ATK 2 with a
       star, 4, a boost star and no icon; Angry Acolyte two. Sebastian Shaw SCH 1, ATK 2, 5, three; Selene SCH 1, ATK 1,
       4, a boost star; Hellfire Pawn SCH 1, ATK 2, 3, a boost star, no unique icon; Power and Decadence a boost star.
       Both obligations print two.
   - The printed decklist cards (`docs/phase7-wave8-handoff.md`): Nightcrawler's deck is 40 (15 hero, 20 Protection, 5
     basic); Magneto's is 40 (15 hero, 17 Leadership, 8 basic) and lists neither the linked allies nor Children of the
     Atom.
2. **RRG 1.8** entries pass 2c adds: "Attack (Enemy Activation)" (pp. 8–9: a defender who is another player's character
   makes that player the target player; "Interrupts that trigger 'when [enemy name] attacks' have the same timing as
   interrupts that trigger 'when [the villain/an enemy] initiates an attack'"; "If an enemy attack ends before damage is
   dealt, abilities that trigger after an attack or after a character defends an attack resolve as normal"); "Attacks
   Against Allies" (p. 10); "Base Value" (p. 10); "Boost, Boost Icon" (p. 11: "A star icon is not itself considered a
   boost icon"; "If an enemy is dealt a boost card outside of its own activation, that boost card remains facedown on
   that enemy until that enemy activates", and a villainous minion "still gets dealt another boost card"); "Cost" (pp.
   13–14: "a player must pay costs with cards and/or game elements they control"; "If a cost targets a 'friendly' card,
   the player can target cards they do not control"; "If dealing damage is a cost, that cost is considered paid even if
   some or all of that damage is prevented"); "Defend, Defense" (p. 15: "When a card ability says to 'declare [a hero]
   the defender' of an attack, that hero is considered to be making a basic defense"; "can be used on an exhausted
   hero"); "Discard" and "Discard Pile" (p. 16: discards from a deck go "one at a time (without changing the order)";
   "The order of cards in a discard pile may not be changed"); "Form, Change Form" (p. 21: a change an ability causes
   "does not count against the one voluntary form change"); "In Player Order" (p. 24: "The phrase 'next player' always
   refers to the next (clockwise) player in player order"); "Lasting Effects" (p. 26: "Lasting effects update whenever
   the game state updates"); "Leaves Play" (p. 27: "Discard each card attached to or tucked under that card"; "Discard
   each boost card given to that card"; "no memory of its previous state"); "Limit" (p. 27); "Linked (Card Title)" (p.
   27); "Look, Looked-At" (p. 27: looked-at cards "are returned to that deck in the same order"); "Nemesis Encounter
   Set" (p. 30: with several minions in the set, the nemesis minion "is designated by parenthetical text");
   "Non-Numerical Variable" (p. 30); "Patrol" (p. 32); "Player Deck" (p. 33: "If the player's deck empties while the
   player was discarding cards from their deck, no further cards are discarded from the newly shuffled deck"); "Resolve"
   (p. 37); "Restricted" (p. 38); "Star Icon" (pp. 40–41: a star value "is defined in that card's text. If it is not
   defined (for instance, if the card's text is blanked), that value is treated as 0"); "Steady" (p. 41); "Text Box" (p.
   44: "that ability only references the printed abilities within that card's text box"; "Icons printed within a card's
   text box are considered abilities within that text box"); "'Then'" (p. 44); "Traits" (p. 45: "Traits are not
   considered to be part of a card's printed text box"); "Tuck" (p. 45); "Unique Icon" (pp. 45–46: "The players may
   choose a scenario even if one or more villains match one or more chosen identities"); "Villainous" (p. 47); "You,
   Your" (pp. 49–50: abilities on a player side scheme "are **not** considered to be performed by that player's
   identity"; "after you … defeat" is the identity's own doing).
   - **The RRG's errata for the two packs (p. 69)** are the five above. **Its FAQ names one card through a reprint:**
     "Powerful Punch (#14)" (p. 63; the Shadowcat pack's card, `mut_gen` 32014) is about when Shadowcat flips her mass
     form, and Nightcrawler's 48017 is that card's reprint (`duplicate_of_code`), so it needs no new behavior. The FAQ's
     "White Queen (#56)" (p. 63) and "Fabian Cortez (#159)" (p. 64) are _Mutant Genesis_ minions, not 49021 or 49030.
3. **FFG rulings.** Every title, subtitle and ability name of the 80 records was matched against the file by script,
   with the pack's terms ("Bamf", "Magnetic Pull", "tuck", "Linked", "boost icons", "defender"). The hits, placed:
   - **January 17, 2026 – Ruling 1 (1)** names the **Protection ally Rogue of this pack** (48012, with its erratum:
     "copies the base ATK and THW of her target (instead of printed)") and Hope Summers, whose values are stars: "the
     value of a star icon is defined by its associated ability (defaulting to 0 only when there is no associated
     ability)", so "Rogue copying Hope adds your hero's power values to her own". The ruling calls the RRG's star entry
     "outdated"; RRG 1.8 (pp. 40–41, above) now says the same thing, so they agree. It was built for wave 7
     (`ValueSpec stat { base }`, `StatModifierSpec.setBase`, §3.25 there) before the card it names was scripted;
     §3.74 places it, and applies it to the ally Gambit's X.
   - **January 17, 2026 – Ruling 5** names **Face the Past, and 49022 is the only card of that title in the pool**
     (every raw pack searched), so the survey's doubt is closed: "In The Wrecking Crew scenario, only the active
     villain's encounter deck can be interacted with … You can play Face the Past to find your set-aside nemesis minion;
     once defeated, it is placed in the active villain's encounter discard pile." The `encounter` selector already reads
     the active villain's deck and cites this ruling (`spec.ts`). §3.81.
   - **July 9, 2026 – Ruling 1** names Powerful Punch (through the reprint 48017): played into an attack on another
     player, it makes the player's identity the defender (a defense-labeled ability, RRG p. 15) and does not make that
     attack one "initiated against" them. §3.81.
   - **January 26, 2026 – Ruling 6 (2)**: "Limits apply to cards. An identity never leaves play when flipping; limits
     applied to its abilities persist across flips" (_Rapid Teleportation_'s phase, Kurt Wagner's round, _Magnetic
     Pull_'s round). **February 28, 2026 – Ruling 7 (1)**: a tucked card "is out of play and does not affect uniqueness"
     (the card under Gambit, §3.74). **April 30, 2026 – Ruling 4 (1)** (a card that takes itself out of a deck discard
     does not count for it; §3.71, §4.2 Q42). **March 6, 2026 – Ruling 3 (1)** (Ionic Physiology's cost arrow replaced
     by "Then", the same erratum Magnetic Missile has).
   - "Surge", "M", "Energy", "Rogue" (the hero's Bulletproof Belle, January 17, 2026 – Ruling 3) and "Magneto" (the
     villain) match rulings about other cards. **No ruling names Nightcrawler, Bamf!, Tally Ho!, Gambit's tuck, Magnetic
     Pull, Wrapped in Metal, New Recruits, The Crazy Gang or the Hellfire set.**

No ruling of pass 2c disagrees with the RRG. One erratum, read with the printed card, leaves a value the data does not
have (Tweedledope, Q44). No insert sentence disagrees with a card. Two cards meet a card of an earlier box under one
title in ways the unique rule decides and a test has to pin (the villain Magneto and his Helmet and Armor; the campaign
ally Magneto, Q45).

## 1. Schema decisions (owner: `game-rules-architect`)

> Status: **proposed (2026-10-07), nothing landed.** Searched `packages/content/src/schema` and `packages/engine/src`
> for each shape below. **This pass asks for no schema change.** Every keyword its cards print (guard, permanent,
> piercing, overkill, quickstrike, retaliate, setup, stalwart, surge, toughness) is a `KeywordInstance` in
> `packages/content/src/schema/keywords.ts`, as is every keyword MC45 p. 3 features (hinder, teamwork, victory,
> villainous, patrol, ranged, steady).

### 1.1 Find: an instruction, not a keyword on a card

RRG 1.8 "Find" (p. 19) and MC45 p. 3 define an instruction ("When instructed to find a card …"). No card of this pass
prints "Find" as a keyword line: it appears inside ability text (45075b, 45097). `keywords.ts` still lists a `find`
shape marked unconfirmed; the data agent emits no `find` keyword for these cards, and the instruction is the engine's
`findCard` effect and `find` ref (§3.1). **No schema change.**

### 1.2 Amplify: printed on one card, gained by another

- The Specter of Death (45089) prints one amplify icon: raw `scheme_amplify: 1` → `BaseCard.amplifyIcons: 1`
  (`schema/cards/base.ts`). The other three Four Horsemen side schemes print hazard (45086), acceleration (45087) and
  crisis (45088) → `schemeIcons`.
- Unus (45059–45061) "gains a [amplify] icon" in ability text. That is a script (`RuleSpec gainsIcon`, §3.2), not a
  data field. **No schema change.**

### 1.3 Unus: the ordinary staged villain

One `VillainCard`, stages I/II/III (45059, 45060, 45061), hit points per player (12, 15, 18; raw
`health_per_hero: true`), `villainStages: { standard: [1, 2], expert: [2, 3] }` (MC45 p. 8: "Remove Unus (I) and add
Unus (III) for expert mode"). Toughness on every stage. **No schema change.**

### 1.4 The two main schemes: one stage, two faces

| Card                                | Starting threat | Target                         | Acceleration | Notes                                            |
| ----------------------------------- | --------------- | ------------------------------ | ------------ | ------------------------------------------------ |
| Hunting Gene Traitors 45062a/b      | 0               | 11[per_hero] (`perPlayerOnly`) | +1[per_hero] | the star by the acceleration is 1B's [star] text |
| The Horsemen of Apocalypse 45085a/b | 0               | 12[per_hero]                   | +1[per_hero] | no star                                          |

Raw carries each scheme twice: a record with no face letter (45062, 45085; `double_sided: true`, `back_text` the 1A
text) and a record 45062a / 45085a whose `linked_card` is the b face. The data agent emits one `MainSchemeCard` each, as
every earlier box, **under the id of the a record** (45062a, 45085a; in pass 1b 45103a, 45121a and 45147a, the last
holding both of scenario 5's stages). A scenario's `mainSchemeCardId` and every script name that id. Raw
`base_threat_fixed: true` with `base_threat: 0`; `threat_fixed: false` and `escalation_threat_fixed: false` are the per
player icons the scans show. **No schema change.**

### 1.5 Gene Pool: a side scheme with permanent and setup

`SideSchemeCard`, `keywords: [permanent, setup]`, `startingThreat` 4 flat (raw `base_threat_fixed: true`), no icons, in
the modular set `infinites`. Both keywords exist; setup step 11 puts setup cards into play
(`packages/cards/src/setup-keyword-set-aside.test.ts`). **No schema change**; behavior in §3.4.

### 1.6 The four Horsemen: four villains in play, one stage each, an A and a B face

MC45 p. 11: "Each of the Horsemen villains has a side A and a side B … To play the scenario in skirmish or standard
mode, use each villain's side A. To play the scenario in expert or heroic mode, use each villain's side B."

- **Eight one-stage villain cards, not four two-stage ones** (as emitted, data step 5, commit e8f3725e). Each printed
  face is its own `VillainCard` with one stage: the A faces 45081a–45084a (War 9[per_hero] hit points, SCH 1, ATK 2;
  `stageNumber: 1`, `stageLabel: "A"`) and the B faces 45081b–45084b (War 12[per_hero], SCH 2, ATK 3;
  `stageNumber: 2`, `stageLabel: "B"`). All eight are in the `four_horsemen` set. This is the Mansion Attack shape,
  not The Wrecking Crew's (one card, an A and a B stage), because the choice of face is made per villain.
- **`ScenarioVillain.sideBCardId`** (`schema/sets.ts`, added in the same commit) joins each pair: the scenario's
  `multipleVillains.villains` lists the four A cards as `villainCardId`, each with its B card as `sideBCardId`.
  `validateScenario` requires the two ids to differ. A scenario with these has no `expertVillains`.
- **Which face a game uses is a per-villain choice** (§4.1 Q9 = B; MC45 p. 11: "Players may also customize their
  experience by using a mix of side A or B"). The four choices default from the difficulty, A/A/A/A for skirmish and
  standard and B/B/B/B for expert and heroic, and each can be overridden. The scenario builder passes, for each
  villain, the chosen card's id; the card not chosen is not in the game. There is no "extreme" mode for this scenario
  (an A card has no B stage under it), and no engine change: a one-stage villain card starts and ends on its stage
  index 0 whatever its `stageNumber`.
- The record still carries `villainStages: { standard: [1, 1], expert: [2, 2] }`: the stage numbers of the default
  faces. With a mixed table it describes no single range, so the builder reads `sideBCardId` and the per-villain
  choice and never indexes a card by it.
- **`Scenario.multipleVillains`** exists (`schema/sets.ts`): `villains` the four (each `encounterSetIds: []`),
  `encounterDecks: "shared"`, `activation: "activeVillainOnly"`, `winCondition: "allVillainsDefeated"`, `atSetup:
"setAside"` (the 1A Setup puts them into play in a random order, as Sinister Synchronization 1A does for the Sinister
  Six). The row order is game state, not data (§3.7).
- Death prints two traits (Aerial, Horsemen); the others one. All four are unique.
- Every ATK prints a star (raw `attack_star: true`): the reminder for the [star] Forced Response.

### 1.7 Standard III: a second Standard set, with an environment and an obligation in it

MC45 p. 3: "When a scenario requires the Standard set, you may replace it with the Standard III set."

- `EncounterSet.classification: "standard"` on `standard_iii` (the field The Hood's Standard II uses, wave 4 §1.9). No
  Expert III exists. A scenario's `standardEncounterSetIds` stays `[standard]`; the replacement is a choice made at
  setup (§3.6), not scenario data.
- Pursued by the Past (45075a/b): one `EnvironmentCard` with a `flipSide`, keywords permanent and setup on the a face,
  permanent on the b face, different ability text per face. The two-face environment shape of wave 6 §1.8 / wave 7
  §1.6 covers it.
- Drawing Near (45080): an `ObligationCard` that belongs to an encounter set and to no identity. `ObligationCard` has
  no identity field, so it is emitted like Hunted (§1.8). **No schema change.**

### 1.8 An obligation in a modular set, with an icon and boost icons

Hunted (45072 ×2, `dystopian_nightmare`): `ObligationCard`, `schemeIcons: ["hazard"]` (raw `scheme_hazard: 1`;
`BaseCard.schemeIcons` already serves non-scheme cards, wave 7 §3.63), boost 2. **No schema change.** The carried-over
normalizer note in the handoff applies: these obligations must be emitted with their `encounterSetIds`, not `[]`.

### 1.9 Attach hosts and stat boxes

| Card                      | Host (`AttachmentHost`, `schema/cards/attachment-host.ts`)                  | Stat box       |
| ------------------------- | --------------------------------------------------------------------------- | -------------- |
| Prelate Sidearm 45063     | named: Unus                                                                 | +1 ATK (star)  |
| Prelate Armor 45064       | named: Unus                                                                 | +1 SCH (star)  |
| Genetic Experiments 45066 | `qualified` minion, `trait: Infinite`                                       | +1 SCH, +1 ATK |
| Golden Horse 45090        | `superlative` among `villain`, lowest `remainingHp`, `withoutTrait: Aerial` | +1 SCH, +1 ATK |
| Metal Wings 45091         | named: Death                                                                | +1 SCH, +1 ATK |
| Ahab's Energy Spear 45099 | `ifAble`: named Ahab, `otherwise` the villain (Crossfire's Rifle shape)     | +2 ATK (star)  |

Every shape exists. "+2 hit points" (45066) is ability text. **No schema change.**

### 1.10 Scenario records

| Field                      | `unus`                                    | `four-horsemen`                                               |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| `villainCardId`            | Unus (45059)                              | War side A (45081a, the first of `multipleVillains.villains`) |
| `mainSchemeCardId`         | 45062a                                    | 45085a                                                        |
| `encounterSetIds`          | `unus`, `infinites` (required, MC45 p. 8) | `four_horsemen`                                               |
| `recommendedModularSetIds` | `dystopian_nightmare`                     | `dystopian_nightmare`, `hounds`                               |
| `modularSetCount`          | 1 (absent)                                | 2                                                             |
| `standardEncounterSetIds`  | `standard`                                | `standard`                                                    |
| `expertEncounterSetIds`    | `expert`                                  | `expert`                                                      |
| `villainStages`            | standard `[1, 2]`, expert `[2, 3]`        | standard `[1, 1]`, expert `[2, 2]` (the default faces; §1.6)  |
| `multipleVillains`         | absent                                    | §1.6: four A cards, each with its `sideBCardId`               |
| `victory`                  | absent (final villain stage)              | absent (`winCondition: "allVillainsDefeated"`)                |

Ids follow the hyphenated form of the earlier boxes (`morlock-siege`). 45062a: "Unus, Infinites, and Standard sets.
One modular set (Dystopian Nightmare)". 45085a: "Four Horsemen, Standard, and two modular sets (Dystopian Nightmare
and Hounds)". Neither 1A names the Expert set; expert mode adds it as in every scenario (RRG "Expert Set", p. 19).

**Corrections the data agent owes for these sets:** the duplicate main scheme records (§1.4); raw `[amplify]` in
Unus's text must survive as the amplify token, not "[star]"; 45075a's `linked_card` text is HTML (`<p>`, `<span
class="icon-star">`) and needs the same cleaning as the other b faces; the obligations' set membership (§1.8).

### 1.11 Placeholders

- The mission area, mission side schemes, the Overseer faces of the two-face minions (their Prelate faces are
  §1.15), Mission Team (45171a), the campaign record and log: written in pass 1c, §1.23–§1.31.
- **(pass 2)** Bishop, Magik and the four hero packs.

### 1.12 Pass 1b: Apocalypse of scenario 3, four stages on two cards

> Status of §1.12–§1.22: **proposed (2026-10-07), nothing landed.** Searched `packages/content/src/schema` for each
> shape. **Pass 1b asks for no schema change either**: every shape below exists; what is missing is one hand-added
> face (§1.14), one encounter set built from nested faces (§1.15) and the data survey's corrections (§1.22).

One `VillainCard`, one side, stages I–IV: 45101a (I: SCH 1, ATK 2, 8[per_hero]; toughness), 45101b (II: 2, 2,
9[per_hero]; steady, toughness), 45102a (III: 2, 3, 10[per_hero]; steady, toughness), 45102b (IV: 3, 3 with a star,
11[per_hero]; stalwart, toughness). The normalizer already builds the chain across the two cards (the survey's "not
gaps" list).

- 45103a: "Contents: Apocalypse (II) and Apocalypse (III). (Apocalypse (III) only for expert mode.)" MC45 p. 14:
  "Remove Apocalypse (II) and start with Apocalypse (III) for expert mode. For an easier game, begin with Apocalypse
  (I)." The names are the faces the two cards start on; the stages printed on their backs are reached in play.
- So `villainStages: { standard: [2, 4], expert: [3, 4] }` (`VillainStageRange` is first and last stage number). This
  answers the survey's open question 5. The easier start is `[1, 4]`, a setup choice (§4.2 Q12), not scenario data.
- No stage is reached by defeating the one before it: each is revealed when the main scheme is completed (§3.18), and
  stage IV loses the game instead. `victory: "cardAbility"` (No Longer Worthy, §3.21).

### 1.13 The Age of Apocalypse: a target threat of X per player

45103a/b, one stage. Starting threat 1[per_hero], acceleration +1[per_hero], target **X[per_hero]** with "X is the
numeral in Apocalypse's printed hit point value" (raw `threat: -1`). `MainSchemeStage.printedX: ["targetThreat"]`
(`schema/cards/schemes.ts`; Mutagen Cloud 2B prints an X acceleration the same way) holds `{ base: 0, perPlayer: 0 }`
and the stage's script supplies the value (§3.19). **No schema change.** Raw carries the scheme twice, as in §1.4.

### 1.14 Two cards, four faces: Heart of the Empire, The Towering Citadel, The Tyrant's Throne, No Longer Worthy

| Card | Face a                                                           | Face b                                                            |
| ---- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| 104  | Heart of the Empire: side scheme, 2 threat, 1 acceleration icon  | The Towering Citadel: side scheme, 3 threat, 2 acceleration icons |
| 105  | The Tyrant's Throne: side scheme, 4 threat, 3 acceleration icons | No Longer Worthy: attachment (Condition), host: Apocalypse        |

- Each face is its own card joined by `BaseCard.otherFaceId` (`schema/cards/base.ts`, wave 4 §1.7): a side scheme
  that flips to another side scheme (`mts` 21184a/b) or to an attachment (`mts` 21189a/b Open the Dungeons →
  Jormungand) is that shape. Starting threat is flat on all three (raw `base_threat_fixed: true`; scans).
- **45104b is not in raw.** Raw 45104a's `linked_card` is 45105b. The `aoa` curation adds 45104b by hand from the scan
  (text in §0.1) and points 45104a at it. This answers the survey's gap 8 and open question 1.
- No Longer Worthy heals "5[per_hero] damage" (scan; raw's "hit points" is wrong).

### 1.15 The Prelates: the b faces as their own encounter set

45179b–45183b are the reverse sides of the Overseer minions (MC45 p. 14: "The PRELATE minions (179-183) are found on
the reverse sides of the OVERSEER minions"). 45103a's Contents and MC45 p. 14 list "Prelates" as an encounter set, and
the cards print "PRELATES (n/5)".

- **Five `MinionCard`s in an encounter set `prelates`**, each joined to its Overseer face by `otherFaceId` (two cards,
  not a `flipSide`: the faces differ in set, stats and victory value). The Overseer faces stay in `overseer` and are
  pass 1c's. `normalizeEncounterSets` reads top-level records only, so the curation states the set for the nested
  faces (the survey's gap 7, open question 3). `prelates` is a scenario set of `apocalypse`, not a modular set
  players can add elsewhere: no card puts a Prelate into play except this scenario's own (§3.22).
- All five: [ELITE], [PRELATE], unique, 5[per_hero] hit points, toughness, victory 3, boost 3.

| Card                    | SCH      | ATK      | Also                                                                              |
| ----------------------- | -------- | -------- | --------------------------------------------------------------------------------- |
| Mister Sinister 45179b  | 1        | 1        | retaliate 1, villainous                                                           |
| The Shadow King 45180b  | 3        | 1 (star) | Forced Response after he attacks you (the ally with the highest THW)              |
| Abyss 45181b            | 2 (star) | 2 (star) | +2 hit points for each facedown card attached; attaches the top card of your deck |
| Sugar Man 45182b        | 1        | 3 (star) | his attacks gain piercing; heals 5 if the attack defeats a character              |
| Mikhail Rasputin 45183b | 2        | 2 (star) | Forced Interrupt when he attacks you: 1 damage to your identity                   |

### 1.16 Dark Beast and the three Setting environments

- Dark Beast: one `VillainCard`, stages I–III (45118–45120; 15, 18 and 22[per_hero]; SCH 2, 2, 3; ATK 2 with a star
  on each), `villainStages: { standard: [1, 2], expert: [2, 3] }`. The ordinary staged villain.
- The Savage Land 45127, Genosha 45133, Blue Area of the Moon 45139: `EnvironmentCard`, traits [LOCATION] and
  [SETTING], keyword setup, boost 3, one constant ability, one **Special** and one When Revealed each. A Special on an
  encounter card is an ordinary ability reference of kind special (the Infinity Stones, wave 4). **No schema
  change.**
- The three sets are `EncounterSet`s of the ordinary modular kind (MC45 p. 16: they "may be used in other scenarios,
  but they are required when playing Dark Beast"), listed in the scenario's `encounterSetIds` so customization cannot
  remove them. That they start **set aside** in this scenario is the scenario builder's statement, as for Mister
  Sinister's three sets (wave 7 §3.29): `GameSetupConfig.setAsideModularSets` and `setAsideUntilCalled`. **As
  emitted, the scenario record also lists them:** `setAsideCardIds` holds the 20 card records of the three sets
  (45127–45146: 6 of Savage Land, 6 of Genosha, 8 of Blue Moon; 24 cards with copies), so the builder derives the
  set-aside sets from the record and the client can show what starts out of the deck (the survey's gap 17). §3.23.

### 1.17 The three-sided Apocalypse of scenario 5

One `VillainCard` with three `sides` and three stages on each (`VillainSideLetter` "A" | "B" | "C",
`schema/cards/villain.ts`, written for this card in wave 2 §6.9): side A the Biomorph faces (45184a, 45185a, 45186a),
side B Cyberpath (…b), side C Giant (…c). `startingSide: "A"` (45147a: "Apocalypse begins the game in [BIOMORPH]
form"). `villainStages: { standard: [1, 2], expert: [2, 3] }`. **No schema change**; the normalizer's three-sided
branch exists (survey).

| Stage (hit points) | Biomorph (a): overkill                      | Cyberpath (b): retaliate 1         | Giant (c): stalwart  |
| ------------------ | ------------------------------------------- | ---------------------------------- | -------------------- |
| I (16[per_hero])   | SCH 1, ATK 2 (star); 1 indirect damage each | SCH 2, ATK 1; 1 threat each scheme | SCH 2, ATK 2; heal 1 |
| II (20[per_hero])  | SCH 1, ATK 3 (star); 2 indirect damage each | SCH 3, ATK 1; 2 threat each scheme | SCH 2, ATK 3; heal 2 |
| III (24[per_hero]) | SCH 2, ATK 3 (star); 3 indirect damage each | SCH 3, ATK 2; 3 threat each scheme | SCH 3, ATK 3; heal 3 |

The second half of each cell is the face's "Forced Response: After Apocalypse changes to this form, …". Every face is
[MUTANT] plus its form trait, and the form trait is how cards name the face. It is a different card from scenario 3's
Apocalypse; both are unique and titled Apocalypse, and no game holds both.

### 1.18 En Sabah Nur's two main scheme stages

| Card                             | Starting threat | Target       | Acceleration        | Notes                         |
| -------------------------------- | --------------- | ------------ | ------------------- | ----------------------------- |
| En Sabah Nur's Pyramid 45147a/b  | 1[per_hero]     | 8[per_hero]  | +1[per_hero] (star) | advances to stage 2 when done |
| The Rise of Apocalypse 45148a/b  | 1[per_hero]     | 10[per_hero] | +1[per_hero] (star) | 2A When Revealed; 2B loses    |
| Dark Beast's Bogus Journey 45121 | 1[per_hero]     | 10[per_hero] | +1[per_hero]        | one stage; "players lose"     |

One two-stage `MainSchemeCard` deck for scenario 5, emitted as the card 45147a with The Rise of Apocalypse as its
second stage, and a one-stage card for scenario 4, 45121a. The star is the reminder for
the [star] Forced Response (RRG "Star Icon", pp. 40–41). Power counters are all-purpose counters with a name (RRG
p. 6), not data. **No schema change.**

### 1.19 Ancient Ritual, and the other schemes of this pass

Ancient Ritual 45163: `SideSchemeCard`, `keywords: [permanent, setup]`, 5 flat, no icons, in `clan_akkaba`: Gene
Pool's shape (§1.5). The Dark Riders 45117, Village Under Attack 45132, Police State 45138 and Trial by Combat 45146
print 2 flat with hinder 1[per_hero]; Time-Travel Shenanigans 45126 prints 2[per_hero]; The Apocalypse Solution 45111
prints 3 flat; Source of Power, Plugged In and Giant Growth (45153–45155) print 5 flat and carry the [SUPERPOWER]
trait. Icons: crisis on 45111, 45132 and 45154; acceleration on 45126; hazard on 45138 and 45155; amplify on 45146 and
45153 (`amplifyIcons: 1`).

### 1.20 Attach hosts and stat boxes

| Card                                          | Host (`AttachmentHost`)                                         | Stat box       |
| --------------------------------------------- | --------------------------------------------------------------- | -------------- |
| Cyberpathy 45106                              | named: Apocalypse                                               | +1 SCH (star)  |
| Biomorphing 45107                             | named: Apocalypse                                               | +1 ATK (star)  |
| Molecular Control 45108                       | named: Apocalypse                                               | none           |
| The Fittest 45109                             | `minionWithHighestPrintedHp` (Genetically Enhanced, core 01163) | +1 SCH, +1 ATK |
| No Longer Worthy 45105b                       | named: Apocalypse                                               | none           |
| High-Tech Goggles 45122                       | named: Dark Beast                                               | +1 SCH         |
| Genetic Enhancement 45123                     | named: Dark Beast                                               | +1 ATK         |
| Cruel Experiment 45124                        | **none printed** (§3.25)                                        | +1 SCH, +1 ATK |
| Escaped Mutant 45137                          | `yourIdentity`                                                  | none           |
| Imperial Guardsman 45145                      | `minion`                                                        | none           |
| Staggering Strength 45149                     | named: Apocalypse                                               | +2 ATK (star)  |
| Celestial Armor 45156, Celestial Weapon 45157 | `villain`                                                       | none           |

"+5 hit points" (45109), "+2 hit points" (45124) and "+4 hit points" (45145) are ability text. The Fittest reads
"Attached **enemy** gets +5 hit points"; its host is still a minion. A Prelate prints 5[per_hero], so its printed hit
points scale with the players when hosts are ranked (RRG "Printed", p. 35; "Per Player Icon", p. 32).

### 1.21 Scenario records

| Field                      | `apocalypse`                       | `dark-beast`                                        | `en-sabah-nur`                     |
| -------------------------- | ---------------------------------- | --------------------------------------------------- | ---------------------------------- |
| `villainCardId`            | Apocalypse (45101a, four stages)   | Dark Beast                                          | Apocalypse (45184a, three sides)   |
| `mainSchemeCardId`         | 45103a                             | 45121a                                              | 45147a (stages 1 and 2)            |
| `encounterSetIds`          | `apocalypse`, `prelates`           | `dark_beast`, `savage_land`, `genosha`, `blue_moon` | `en_sabah_nur`                     |
| `recommendedModularSetIds` | `dark_riders`, `infinites`         | `dystopian_nightmare`                               | `celestial_tech`, `clan_akkaba`    |
| `modularSetCount`          | 2                                  | 1 (absent)                                          | 2                                  |
| `standardEncounterSetIds`  | `standard`                         | `standard`                                          | `standard`                         |
| `expertEncounterSetIds`    | `expert`                           | `expert`                                            | `expert`                           |
| `villainStages`            | standard `[2, 4]`, expert `[3, 4]` | standard `[1, 2]`, expert `[2, 3]`                  | standard `[1, 2]`, expert `[2, 3]` |
| `victory`                  | `"cardAbility"`                    | absent (final villain stage)                        | absent (final villain stage)       |
| `setAsideCardIds`          | 45179b–45183b, 45105a              | 45127–45146 (the three Setting sets, 20 records)    | absent                             |

45103a: "Apocalypse, Prelates, and Standard sets. Two modular sets (Dark Riders and Infinites)". 45121a: "Dark Beast,
Blue Moon, Genosha, Savage Land, and Standard sets. One modular set (Dystopian Nightmare)". 45147a: "En Sabah Nur and
Standard sets. Two modular sets (Celestial Tech and Clan Akkaba)". Each matches its rulebook page. No 1A names the
Expert set (§1.10). The ids and the `setAsideCardIds` row are the emitted records' (data step 5, commit e8f3725e):
each main scheme is its a card, and the cards a 1A Setup sets aside are listed on the record.

### 1.22 Corrections the data agent owes for these sets

- 45104b added by hand and the 45104a link fixed (§1.14); the `prelates` set built from the nested b faces (§1.15).
- Printed SCH where raw omits the field: Pterosaur 45128 and Tusk 45115 print **0**, Velociraptor 45129 prints **1**
  (the survey's gap 1). None is a dash. The Overseer a faces' dashes are pass 1c's.
- Text: 45105b "heal 5[per_hero] damage"; 45140 "deal Gladiator to yourself"; 45125 "for this attack" (raw: "this
  attacks"; read the scan at emit). The duplicate main scheme records 45103/45103a, 45121/45121a, 45147/45147a and
  45148/45148a collapse as in §1.4; their b faces' HTML needs the same cleaning as 45075a's.
- 45124 Cruel Experiment has no attach rule: `impliedAttachHost: "ownWhenRevealed"` (the survey's gap 3; §3.25).
- Scans still to read at emit, not read for this spec: 45102a, 45106–45111, 45112–45114, 45116, 45117, 45119, 45120,
  45122–45125, 45127, 45129–45139, 45141–45146, 45149–45162, 45180b–45183b, 45184a/b, 45185a–45186c. Raw is the only
  source for those texts here.

### 1.23 Pass 1c: the campaign record (`AOA_CAMPAIGN`)

> Status of §1.23–§1.31: **proposed (2026-10-07), nothing landed.** Searched `packages/content/src/schema`,
> `packages/content/scripts/marvelcdb` and `packages/engine/src/campaign.ts` for each shape. **Pass 1c asks for no
> schema change**: `Campaign`, `EncounterSet.campaignSpecific`, `otherFaceId`, `PlayerCardCommon.flipSide`,
> `PrintedStat` (`null` is a printed dash), `specialCost: "dash"` and every `LogFieldType` below exist. It asks the
> parser for one trigger header (§1.25) and the normalizer for two rules (§1.24, §1.25).

The hand-authored `packages/content/src/data/aoa/campaign.ts`, the `next_evol` shape
(`packages/content/src/data/next_evol/campaign.ts`).

- `id: campaignId("aoa")`, `name: "Age of Apocalypse"`, `boxCode: "MC45"`, `packCode: "aoa"`, `scenarioIds` in MC45
  p. 4's fixed order (`unus`, `four-horsemen`, `apocalypse`, `dark-beast`, `en-sabah-nur`), `logSheetReference` to
  `docs/campaign-modes/log-sheets/mc45_age_of_apocalypse_campaign_log.pdf`.
- `campaignSetIds`: the five sets below, each `campaignSpecific: true`, every card `specificTo: { kind: "campaign" }`
  (MC45 p. 4: "These cards cannot be included in any deck unless playing the Age of Apocalypse campaign and the
  players are directed to add them to a deck by the Campaign Instructions"). This is the survey's gap 11: only
  `aoa_basic_campaign` is detected from its faction; the other four need the curation flag.
- No `prohibited` (the rulebook forbids no card or set; "Professor X cannot enter play during this game" is a rule of
  one game, §3.43), no `perSeatSetIds`, no `roles`.

| Set id               | Printed in the set name area | Cards                           | How it gets into a game                                     |
| -------------------- | ---------------------------- | ------------------------------- | ----------------------------------------------------------- |
| `age_of_apocalypse`  | "AGE OF APOCALYPSE (n/4)"    | 45164 ×2, 45165 ×2              | shuffled into the encounter deck in all five scenarios      |
| `aoa_mission`        | "MISSION (n/5)"              | 45166a/b–45170a/b               | one per game, revealed into the mission area                |
| `overseer`           | "OVERSEER (n/5)"             | 45179a–45183a                   | one per game, put into play in the mission area             |
| `aoa_campaign`       | "CAMPAIGN (n/5)"             | 45177 ×1, 45178 ×4              | by a mission's row of the campaign log (§2.14)              |
| `aoa_basic_campaign` | none ("BASIC / CAMPAIGN")    | 45171a/b, 45172–45175, 45176 ×4 | Mission Team in every game; the rest by a mission's log row |

- **Names** (the survey's "two sets are both named Campaign"): `aoa_campaign` is "Campaign" as printed and is shown
  as "Age of Apocalypse Campaign"; `aoa_basic_campaign` is raw's grouping of the six "BASIC / CAMPAIGN" player
  records, not a printed encounter set, and is shown as "Age of Apocalypse Campaign (player cards)".
- **A flagged difference.** RRG "Campaign-Specific Card" (p. 11) designates a campaign card by the word "Campaign" at
  the bottom of the card. The Age of Apocalypse, Mission and Overseer cards do not print it; MC45 p. 4 says "Cards
  164–183 are cards that were created specifically for use in the Age of Apocalypse campaign", and the boxes call the
  first of them a "modular set". The data follows the rulebook (all five sets campaign-specific); whether the four
  Age of Apocalypse cards are also offered as a modular set is §4.2 Q23.

**Log fields** (MC45 p. 24), for the `CampaignDefinition`; every type is an existing `LogFieldType`
(`packages/engine/src/campaign.ts`). This answers the survey's gap 19.

| Field (id)                                                         | Scope    | Type                                            | The sheet's box                                                     |
| ------------------------------------------------------------------ | -------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| identity (the seat itself)                                         | per seat | the runner's `CampaignSeat`                     | "Player #N's Identity"                                              |
| `remainingHp`                                                      | per seat | `number`, expert campaign                       | "Remaining hit points"                                              |
| `missions`                                                         | shared   | `strikeList`, four options in the sheet's order | the "Mission Side Scheme" column; a struck name                     |
| `overseers`                                                        | shared   | `strikeList`, five options                      | "Available Overseer minions", five boxes                            |
| `resultLiberate`, `resultEvacuate`, `resultSabotage`, `resultFind` | shared   | `choice` over `defeated`, `notDefeated`         | **not on the sheet**: which of the struck row's two columns applied |
| `currentMission`, `currentOverseer`                                | shared   | `choice`, `working`                             | not on the sheet: this attempt's draw, for Victory to strike        |
| `missionDefeated`, `overseerDefeated`                              | shared   | `flag`, `working`                               | not on the sheet: what Victory read out of the finished game        |

- **The four result fields are the one thing the paper log does not hold.** Six of the sheet's eight outcome cells
  say "for the rest of the campaign", and the sheet records only a struck name; the table remembers the rest. The log
  cannot, so each mission's result is written when its name is struck, and the Dossier shows it on the struck row.
- The rewards themselves are `CampaignGrant`s on the seat (the chosen upgrade, support and campaign ally) and
  `removedFromCampaign` entries (Desperate Measures, Panicked Refugees, North American Sea Wall, the campaign allies),
  as every earlier box records them.
- Protect the Professor (45170a) is not on the sheet: it is never drawn and never struck (MC45 p. 5: "reserved for
  scenario 5").
- **Striking an Overseer is a strike, not a removal by face.** `CampaignCardFace` (`campaign.ts`) was written when
  the two versions were expected to be one `CardId` with a `flipSide`; §1.15 makes them two cards, so 45182a struck
  from `overseers` says nothing about 45182b, which is what ruling April 30, 2026 – Ruling 4 (2) requires. The comment
  on `CampaignCardFace` needs the correction when engine work next touches the file.

### 1.24 The five missions: a side scheme whose other face is "Finished"

| Card                            | a face (all five alike)             | b face, "If the mission was not defeated"              | b face, "If the mission was defeated"                                                         |
| ------------------------------- | ----------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Liberate the Seattle Core 45166 | side scheme, [MISSION], 5[per_hero] | place 2[per_hero] threat on the main scheme            | each player adds 1 copy of the Desperate Measures upgrade to their hand                       |
| Evacuate Survivors 45167        | the same                            | deal each player a facedown encounter card             | each player searches their deck and discard pile for 1 card and adds it to their hand         |
| Sabotage the Sea Wall 45168     | the same                            | find North American Sea Wall and reveal it. (Shuffle.) | find North American Sea Wall, remove it from the game, each player deals 3 damage to an enemy |
| Find Lost Mutants 45169         | the same                            | each player discards 1 card from their hand            | each player adds one set-aside campaign ally to their hand                                    |
| Protect the Professor 45170     | the same                            | the players lose the game                              | each player searches their deck and discard pile for an ally and adds it to their hand        |

- **a face.** `SideSchemeCard`, trait [MISSION], `startingThreat: perPlayerOnly(5)` (raw `base_threat: 5`, not fixed;
  the callouts show the per player icon), no scheme icons, no boost icons, no keywords, `otherFaceId` → its b face.
  One text on all five: "Forced Response: After you resolve a mission attempt, place 1 attempt counter here and deal 1
  damage to each ally at the mission. If there are 4 attempt counters here, remove Mission Team from the game and
  flip this card over. When Defeated: Shuffle each player card at the mission into its owner's deck. Flip Mission Team
  and this card over."
- **b face** (the survey's gap 4 and open question 10). Its own `SideSchemeCard`, as the card prints the type, trait
  [FINISHED], `otherFaceId` back to the a face: "Forced Response: After you flip to this side, remove each card in the
  mission area from the game and do the following:" and the two bullets of the table. Two cards, not a `flipSide`: a
  `SideSchemeCard` is not an `EncounterCardCommon` and has no `flipSide`; a side scheme that flips to another side
  scheme is the `otherFaceId` shape (`mts` 21184a/b, §1.14).
- **The dash.** The b face prints "–" for its threat. **No dash field is added for side schemes**: the face is
  emitted with `startingThreat: fixed(0)` and a `cardNotes` line that records the printed dash, and the normalizer
  accepts "side scheme without starting threat" when that note exists, as it accepts a minion's absent ATK
  (`normalize/encounter-cards.ts`). That clears the survey's five lines. The engine never reads the value: nothing
  can place threat on a card in the mission area unless it names the mission (§3.33), and the face does not outlast
  its own Forced Response (§4.2 Q20).

### 1.25 The Overseer faces, "Mission Response", and where a Prelate's stats live

Five `MinionCard`s in the set `overseer`, each `otherFaceId` → its Prelate face (§1.15) and back.

| Card                    | Printed                                                          | Its own line                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mister Sinister 45179a  | SCH –, ATK –, 5[per_hero], [ELITE] [OVERSEER], unique, victory 5 | "Players cannot assign cards with the same resource icon ([energy], [mental], [physical], or [wild]) to more than one ally each mission attempt."                       |
| The Shadow King 45180a  | the same                                                         | "Mission Response: After you discard cards, place 2 threat on the [MISSION] side scheme for each mental resource ([mental]) discarded."                                 |
| Abyss 45181a            | the same                                                         | "Mission Response: After you discard cards, attach each card with a wild resource ([wild]) discarded to Abyss facedown. (They cannot be used for the mission attempt.)" |
| Sugar Man 45182a        | the same                                                         | "Mission Response: After you discard cards, heal 3 damage from Sugar Man for each physical resource ([physical]) discarded."                                            |
| Mikhail Rasputin 45183a | the same                                                         | "Mission Response: After you discard cards, deal 1 damage to an ally at the mission for each energy resource ([energy]) discarded."                                     |

All five also print "Cannot take damage while another minion is at the mission." None has boost icons (raw; an
Overseer is never in a deck).

- **Where a Prelate's ATK, SCH, hit points, boost icons and Victory 3 live: on its own `MinionCard`** (45179b–45183b
  in `prelates`, §1.15), never on a `flipSide`. `CardFlipSide` (`schema/cards/encounter-cards.ts`) holds a name,
  traits, keywords, text and icons, and no SCH, ATK, hit points, boost icons or encounter set; the two faces differ
  in exactly those (SCH and ATK a dash against 1 to 3; no boost icons against three; `overseer` against `prelates`).
  The data agent's report that a `flipSide` has nowhere to put them is the reason, not a gap to fill: **no field is
  added to `flipSide`.**
- **The normalizer rule** (finishing gap 7): a nested `linked_card` of type minion, or one whose `card_set_code`
  differs from its parent's, is emitted as its own card with `otherFaceId` both ways and joins the set its own record
  names. This is the route `mut_gen` 32171a/b took for a face whose type changes (wave 6 §1.8).
- **One printed card, two sets** (the survey's open question 3): `overseer` is campaign-specific and `prelates` is
  not. A set is a property of a face's record, so nothing is special about the pair in data. That the two records are
  one piece of cardboard matters in one game only, a campaign game of scenario 3 (§3.46, §4.2 Q21).
- **The dashes** (gap 6): the ten `cardNotes` lines emit `atk: null` and `sch: null`, not 0 (`PrintedStat`,
  `schema/common.ts`). RRG "Dash (Value)" (p. 15): the character "cannot exhaust to use that power", and a reference
  to the value reads "an unmodifiable 0".
- **"Mission Response" as an ability kind** (gap 5; the ruling the data step asked for). MC45 p. 5: "Most [OVERSEER]
  minions have a **Mission Response** ability. This is a new type of **Forced Response** that only resolves after a
  player discards cards from the top of their deck during a mission attempt."
  - **It is a Forced Response. No new ability kind.** The parser adds `Mission Response` to `TRIGGER` and `kindOf`
    returns `forced-response` for it (`parse-text.ts`); nothing is added to the parser's `AbilityKind`, to the schema
    or to the engine's timing words. Every rule that reads "Forced Response" (forced responses initiate before other
    responses, RRG "Forced", p. 20; `cannotResolveTriggeredAbilities.timings`) then reads these four abilities with
    no further case.
  - The printed header stays in the card's text, so the client shows "Mission Response" as printed, and the glossary
    gets one entry with p. 5's sentence. `notesForScripting` on each of the four says: "answers the discard of a
    mission attempt only (§3.38)".
  - The condition "during a mission attempt" is the script's (§3.38), not data. Mister Sinister's line is a constant
    ability and parses as one today.

### 1.26 Mission Team (45171a/b)

One `SupportCard` with a `flipSide` (`PlayerCardCommon.flipSide`, the wave 2 shape): the two faces share a type, a
title and a first sentence and differ in trait and Action.

- Classification basic and campaign ("BASIC / CAMPAIGN"), one [wild] resource icon, **no cost box**: `cost: 0,
specialCost: "dash"` (gap 9). RRG "Dash (Value)" (p. 15): "that card cannot be played and can only enter play through
  other means". It is never in a deck or a hand: a campaign instruction puts it into play (§2.12).
- a face, trait [MISSION]: "Mission Team cannot be discarded and the first player gains control of it. Action: Exhaust
  Mission Team → choose: • Reduce the cost of the next ally played to the mission this phase by 2. • Make a mission
  attempt."
- b face, trait [FINISHED]: the same first sentence and "Action: Exhaust Mission Team → choose a player to draw 1
  card."
- **Errata** (RRG 1.8 p. 69, "Mission Team (#171A)": "The first bullet should read: 'Reduce the cost of the next ally
  played to the mission this phase by 2.' (Added 'this phase'.)"). Raw holds the current text and notes the change as
  first made in RRG 1.6; the printed card (scan) lacks the two words. `text.printed` is restored with
  `printedReplace`, `text.current` is raw's, and the `Errata` entry cites RRG 1.8 p. 69 (the survey's gap 20). The
  engine builds the current text: an unused discount ends with the phase.

### 1.27 The campaign allies and Desperate Measures

| Card                        | Printed                                                           | Text                                                                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Destiny 45172               | ally, cost 4, [wild], unique, [X-MEN], THW 3, ATK 1, 3 hit points | "Response: After Destiny enters your hand, remove 2 threat from the main scheme."                                                                                                         |
| Blink 45173                 | the same, THW 2, ATK 2                                            | "Response: After Blink enters your hand, deal 2 damage to the villain."                                                                                                                   |
| Morph 45174                 | the same, THW 2, ATK 2                                            | "Response: After Morph enters your hand, confuse the villain."                                                                                                                            |
| X-Man 45175                 | the same, THW 1, ATK 3                                            | "Response: After X-Man enters your hand, give your identity a tough status card."                                                                                                         |
| Desperate Measures 45176 ×4 | upgrade, cost 1, [wild]                                           | "Attach to an ally. Limit 1 per ally. Attached ally gets +1 THW, +1 ATK, +1 hit point, and is considered to have a wild ([wild]) resource icon in addition to its printed resource icon." |

`AllyCard` and `UpgradeCard`, basic and campaign, one consequential damage under each THW and ATK (raw `thwart_cost`
and `attack_cost` 1). Desperate Measures' host is `ally` (any player's, and an ally at the mission: §3.34) with one
per host. Its three stat changes are ability text; the considered [wild] icon is §3.42. **No schema change.**

### 1.28 The Age of Apocalypse set and the Campaign set

| Card                          | Type and printed values                                                                                      | Text                                                                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent of Apocalypse 45164 ×2  | minion, [CLAN AKKABA], SCH 2, ATK 2, 3 hit points, guard, a star and no boost icon                           | "When Revealed: Choose: Either add Agent of Apocalypse to the mission area, or it activates against you." / "[star] Boost: Deal 1 damage to an ally at the mission. Give the activating enemy an additional boost card."                    |
| Worldwide Crisis 45165 ×2     | treachery, a star and no boost icon (raw)                                                                    | "When Revealed: Choose: Either place 3 threat on the [MISSION] side scheme, or take 1 damage and this card gains surge." / "[star] Boost: Place 1 threat on the [MISSION] side scheme. Give the activating enemy an additional boost card." |
| North American Sea Wall 45177 | side scheme, 2 threat flat, hinder 2[per_hero], surge, victory 2, two boost icons and a star, no scheme icon | "The villain cannot take damage." / "[star] Boost: Deal this card to yourself as a facedown encounter card."                                                                                                                                |
| Panicked Refugees 45178 ×4    | obligation, one acceleration icon (`schemeIcons: ["acceleration"]`), no boost icon, no identity              | "Forced Response: After this card enters your hand, reveal it. Then, draw 1 card. Alter-Ego Action: Exhaust your identity → remove this card from the game."                                                                                |

Ordinary records. Panicked Refugees is emitted as Hunted is (§1.8): an `ObligationCard` with its set and no identity.
It is an encounter card that spends its life in a player's deck (§3.42). **No schema change.**

### 1.29 The Mission Rules card: no record

The survey's gap 10 and open question 2. MC45 pp. 5, 8, 12, 14, 16 and 20 put "the double-sided Mission Rules card"
into play beside the Overseer. It has no card number, no raw record and no scan; by the survey's count (an inference)
it is the box's 165th encounter card. Its side A, from p. 5's callout:

> Mission Rules. • Players cannot thwart the [MISSION] side scheme. • Cards in the mission area are in play but under
> no player's control. They cannot be affected by card abilities unless the ability refers to the mission area. • When
> a player plays an ally, they must choose: put that ally into play under their control, or put it in the mission
> area. • Treat the printed text box of each ally at the mission as if it were blank, except for [TRAITS]. • Upgrades
> can be attached to allies at the mission. • **The [MISSION] side scheme cannot be defeated while there are any
> minions in the mission area.** Flip this card over to see the steps to resolve a mission attempt.

- **Decision: no card record, no instance in a game.** The six bullets are rules of the mission area, and MC45 p. 5
  ties them to the scheme ("**While a [MISSION] side scheme is in play**, when a player plays an ally, they must
  choose …"), so the mission's a face carries them: one shared rules block in `@mc/cards` that all five a-face scripts
  include (§3.33, §3.34, §3.40). The engine names no card and holds no mission rule of its own.
- **The client shows it as a reference panel**, not a card on the table: side A as quoted, side B as MC45 p. 6's five
  steps (§2.13). Side B's own wording has not been read; if the owner scans the card, the panel's text and this
  section are checked against it.
- "Remove each card in the mission area from the game" (the b faces) therefore has no rules card to remove. Nothing
  reads it.

### 1.30 Scenario records: no change

The five `Scenario` records of §1.10 and §1.21 are not touched. What the campaign adds to a game is the
`CampaignDefinition`'s: the four Age of Apocalypse cards go in beside the scenario's sets (`composeEncounterSets`,
which does not use a modular slot), and everything else arrives set aside (`setAsideCards`). No node has
`requiredModularSetIds`: MC45 requires no modular set in the campaign that the scenario does not already require.

### 1.31 Corrections the data agent owes for pass 1c

- `campaignSpecific: true` on `age_of_apocalypse`, `aoa_mission`, `aoa_campaign` and `overseer`; the two set names of
  §1.23.
- The five mission b faces as their own `SideSchemeCard`s with `otherFaceId`, `fixed(0)` and a `cardNotes` dash
  (§1.24); their text is HTML in raw and needs the cleaning 45075a's does (§1.10).
- The five Overseer faces with `atk: null`, `sch: null`, `otherFaceId` to the Prelate faces of §1.15, and the
  normalizer rule of §1.25. `Mission Response` → `forced-response` in the parser, with a `parse-text.test.ts` case
  from 45180a's text (the survey's probe: it is a silent `constant` today).
- Mission Team: `specialCost: "dash"`, the `flipSide`, the `Errata` entry and `printedReplace` (§1.26).
- 45177: `startingThreat: fixed(2)` (raw `base_threat_fixed: true`; scan) beside hinder 2[per_hero]. 45178: the
  acceleration icon as `schemeIcons`, set membership, no identity.
- `[[Mission]]` in raw text (45165, 45180a) is the trait token [MISSION].
- Scans still to read at emit, not read for this spec: 45165, 45166a, 45167a/b–45170a/b, 45172–45175, 45180a, 45182a,
  45183a. Raw is the only source for those texts here (45182a's text is also p. 5's callout).
- The hand-authored `campaign.ts` (§1.23), after the five scenarios exist.

### 1.32 Pass 2a: an attach host by classification (Sidekick 45015; data survey gap 2)

Pass 2a asks for **one schema change**. Sidekick prints "Attach to an identity-specific ally you control." (scan
45015). `AttachmentHost` (`packages/content/src/schema/cards/attachment-host.ts`) has `qualified` hosts narrowed by
`HostQualifiers` (trait, keyword, title, `controlledBy: "you"`), and no qualifier reads a card's classification.

- **`HostQualifiers.classification?: "identitySpecific" | "aspect" | "basic"`**, the three player-card
  classifications the engine already reads (`classificationsOf`, `select.ts`; RRG 1.8 "Classifications", p. 12, and
  "Identity-Specific Card", p. 23: "designated by the identity icon printed in the bottom right corner of the card").
  Sidekick's host is `{ kind: "qualified", category: "ally", classification: "identitySpecific", controlledBy: "you" }`.
- **Any identity's set, not only yours.** The card says "identity-specific", not "a [your hero] ally": an ally of
  another identity's set that you control (Cameo, ruling March 19, 2026 – Ruling 6; a card taken under your control)
  is a legal host. The survey's gloss "an ally of the identity's own set" is narrower than the card.
- A campaign ally (45172–45175, "BASIC / CAMPAIGN") is not identity-specific. The identity card is not an ally.
- **Parser:** `parse-text.ts`'s host reader gains "an identity-specific ally you control" (and, with it, "an
  identity-specific [category]"); it already refuses to read the phrase as a named card (its comment at the
  `namedCard` fallback names this card). "Max 1 per deck." is `deck_limit: 1`, already carried.
- No other card of this pass needs a schema note. Stored Energy's two icons are two entries of the existing printed
  resources (as Molecular Acceleration, `gambit` 37010); Marrow's two-trait "Play only if" is scripted as `playOnlyIf`
  because `requiresIdentityTrait` holds one trait (the parser already leaves it for the script, as for Moon Girl,
  `nova` 28018); Advanced Suit's "an [X-FORCE] or [X-MEN] ally" is `anyOf` two `qualified` hosts.

## 2. Per-scenario setup needs

RRG 1.8 Appendix II (p. 51) with the wave 1–7 engine. The Campaign Instructions boxes on MC45 pp. 8 and 12 are
pass 1c's (§2.11–§2.16).

### 2.1 The two scenarios

| Scenario      | Main scheme deck                | Encounter sets (required) + modulars                                | Needs (§3)           |
| ------------- | ------------------------------- | ------------------------------------------------------------------- | -------------------- |
| Unus          | Hunting Gene Traitors (1 stage) | Unus, Infinites, Standard; Dystopian Nightmare (removable)          | 3.2–3.5, 3.12, 3.17  |
| Four Horsemen | The Horsemen of Apocalypse (1)  | Four Horsemen, Standard; Dystopian Nightmare and Hounds (removable) | 3.7–3.15, 3.16, 3.17 |

MC45 p. 8: "The Dystopian Nightmare set can be removed from this scenario and/or added to other scenarios … The
Infinites set may be used in other scenarios, but it is required when playing Unus." MC45 p. 11: "The Hounds and
Dystopian Nightmare sets can be removed from this scenario and/or added to other scenarios". Either scenario's
Standard set may be replaced by Standard III (MC45 p. 3; §2.5).

### 2.2 Unus (MC45 p. 8), step by step

1. Appendix II steps 1–9 as usual. The villain deck is Unus I and II (II and III in expert mode); the dial is set to
   12[per_hero] (15[per_hero] in expert).
2. **Step 10**: the encounter deck is `unus` (45063–45068, 10 cards), `infinites` without Gene Pool (7 cards), the
   Standard set (or Standard III), one modular set, the Expert set in expert mode, and the obligations. Gene Pool is
   permanent, so it is set aside before step 1 (RRG "Permanent", p. 32) and is not shuffled in.
3. **Step 11**: Gene Pool has setup, so it is put into play with its 4 starting threat (RRG "Setup (Keyword)", p. 40;
   "Side Scheme", p. 40). With Standard III, Pursued by the Past enters play here too, with no counters.
4. **Modular difficulty** (MC45 p. 8, optional): "they may place threat on Gene Pool during setup … Skirmish Mode:
   Place 0 threat. Standard Mode: Place 1[per_hero] threat. Expert Mode: Place 2[per_hero] threat. Heroic Mode: Place
   3[per_hero] threat." A setup option of the Infinites set, in any scenario that includes it, off unless the players
   turn it on (§3.5; §4.1 Q1 = A).
5. **Step 12a**, 45062a Setup: "Reveal the Gene Pool side scheme. In expert mode, deal each player a facedown
   encounter card."
   - Gene Pool is already in play from step 11. As read: revealing it does not make it enter play again (RRG "Find",
     p. 19, says so for a minion found in play: "**not** considered to be entering play"), it prints no When Revealed,
     and so the sentence changes nothing. Gene Pool has **4** threat after setup, plus any of step 4. The sentence
     matters only if a scenario includes the Unus set without the setup keyword having fired, which cannot happen.
   - Expert: one facedown encounter card per player, revealed in step four of the first villain phase.
6. **Step 12b**: flip to 1B. No When Revealed. **Step 12c**: Unus's toughness gives him a tough status card (RRG
   "Toughness", p. 45).
7. Steps 14–16 as usual.

**In play.** 1B: "[star] Forced Response: After resolving step one of the villain phase, place 1 threat on Gene Pool.
If this scheme is completed, the players lose the game." Unus reads Gene Pool's threat (§3.3): with the printed 4 he
has retaliate 1 from the first turn. Each new stage of Unus gets a tough status card (same title, RRG "Villain
Defeat", p. 47: status cards carry over, and toughness adds one as the stage enters play, as for every earlier staged
villain with toughness).

### 2.3 Four Horsemen (MC45 pp. 11–12), step by step

1. Appendix II steps 1–7 as usual. **Step 8**: four villain cards and the main scheme. For each Horseman the players
   use its A card or its B card (§1.6; §4.1 Q9 = B): four selectors that default from the difficulty (A/A/A/A for
   skirmish and standard, B/B/B/B for expert and heroic), each of which can be changed, so War B with three A sides
   is a legal table. The four cards not chosen are out of the game. **Step 9**: each villain has its own dial (MC45
   p. 11, "Multiple Villains"), 9[per_hero] for an A card and 12[per_hero] for a B card.
2. **Step 10**: one shared encounter deck: `four_horsemen` (45086–45096, 15 cards, the four side schemes included),
   the Standard set (or Standard III), two modular sets, the Expert set in expert mode, the obligations.
3. **Step 12a**, 45085a Setup: "Shuffle the four [HORSEMEN] villains, then reveal them in a row from left to right.
   Place the active counter on the leftmost villain (see rulebook). Each player reveals a random side scheme from the
   Four Horsemen encounter set."
   - The four villains get a random order from the game's seeded RNG; that order is the **row** (§3.7). The active
     counter starts on the first.
   - In player order, each player reveals one of the four side schemes 45086–45089 chosen at random among those still
     in the encounter deck; it enters play with 6 threat and its icon. The deck is shuffled after (RRG "Search",
     p. 39). With four players all four are in play; the rest stay in the deck.
4. **Step 12b**: flip to 1B, no When Revealed. **Step 12c**: no villain has a Setup or When Revealed ability.

**In play** (MC45 p. 11, "Active Villain").

- "only the active villain will activate during the villain phase. The active villain is the villain with the active
  counter". 1B: "Forced Response: After a villain activates, move the active counter to the next villain. If this
  stage is completed, the players lose the game." "The 'next villain' is immediately to the right of the current
  villain. If the current villain is the rightmost, then the 'next villain' is the leftmost."
- "Any encounter card that refers to 'the villain' only refers to the active villain. When a player triggers a player
  card ability that refers to 'the villain,' they choose which villain … If a constant ability or keyword refers to
  'the villain,' it only refers to the active villain." The engine already does both (`TargetRef villain`;
  `needsVillainChoice`, `resolve/effects-frame.ts`).
- "Players can attack any villain they choose regardless of which villain is the active villain." Guard is the
  exception by its own text: RRG "Guard" (p. 21), "The engaged player cannot attack **any** villain" (`canAttack`,
  `select.ts`; wave 1). A Hound engaged with you protects all four.
- Each villain: "[star] Forced Response: After [name] attacks you, if he has at least 1 hit point, [effect]. **[Name]
  cannot be defeated while another villain has at least 1 hit point.**" A Horseman at 0 hit points stays in play,
  still takes the active counter in turn, still activates, and can be healed (45092–45095). When the last one reaches
  0, all four are defeated together and the players win (§3.9).

### 2.4 The modular sets of this pass

| Set                 | Cards                                                   | Notes                                                                                |
| ------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Infinites           | Infinite Soldier ×5, Culling the Weak ×2, Gene Pool     | Gene Pool is permanent and setup in every scenario that uses the set. §3.3–§3.5.     |
| Dystopian Nightmare | Hunted ×2, War-Weary ×2, Targeted for Extermination ×2  | Hunted is an obligation with a hazard icon that stays in play (wave 7 §3.70). §3.17. |
| Hounds              | Ahab, Hound ×4, Ahab's Energy Spear, Release the Hounds | Ahab finds and reveals the side scheme; Hound forces hero form. §3.1, §3.16.         |

### 2.5 Standard III (MC45 p. 3)

"This set changes the way nemesis sets enter the game by replacing the Shadow of the Past treachery with the Pursued
by the Past environment. Pursued by the Past has both the permanent and setup keywords, so it always begins the game
in play and cannot leave play. The rest of the Standard III set places counters on the environment in order to bring
nemesis sets into play."

- Six cards, eight copies: Pursued by the Past (45075a/b), Dark Designs ×2, Sinister Strike ×2, Evil Alliance, Nowhere
  is Safe, Drawing Near. Seven go into the encounter deck; the environment is set aside and put into play at step 11.
- 45075a: "Forced Response: After you place a pursuit counter here, if the number of counters here is at least 3 more
  than the number of players, remove each counter here → if your nemesis minion is in play, it activates against you.
  Otherwise, flip this card over." 45075b: "Forced Response: After you flip to this side, find your nemesis minion
  and reveal it. Search the set-aside area for your nemesis side scheme and reveal it. Shuffle your remaining
  set-aside nemesis set into the encounter deck. Flip this card over."
- "You" is the player whose card placed the counter: the player revealing the treachery, the player a boost card's
  activation is against, the player whose turn began (Drawing Near). §3.6.

### 2.6 Pass 1b: the three scenarios

| Scenario     | Main scheme deck                                   | Encounter sets (required) + modulars                                       | Needs (§3)            |
| ------------ | -------------------------------------------------- | -------------------------------------------------------------------------- | --------------------- |
| Apocalypse   | The Age of Apocalypse (1 stage)                    | Apocalypse, Prelates, Standard; Dark Riders and Infinites (removable)      | 3.18–3.22, 3.30, 3.32 |
| Dark Beast   | Dark Beast's Bogus Journey (1)                     | Dark Beast, Blue Moon, Genosha, Savage Land, Standard; Dystopian Nightmare | 3.23–3.25, 3.31, 3.32 |
| En Sabah Nur | En Sabah Nur's Pyramid, The Rise of Apocalypse (2) | En Sabah Nur, Standard; Celestial Tech and Clan Akkaba (removable)         | 3.26–3.29, 3.32       |

MC45 p. 14: "The Dark Riders and Infinites sets can be removed from this scenario and/or added to other scenarios".
MC45 p. 16: "The Dystopian Nightmare set can be removed … The Blue Moon, Genosha, and Savage Land sets may be used in
other scenarios, but they are required when playing Dark Beast." MC45 p. 19: "The Celestial Tech and Clan Akkaba sets
can be removed from this scenario and/or added to other scenarios". The Campaign Instructions boxes on pp. 14, 16 and
20 are pass 1c's (§2.11–§2.16). Any of the three may replace Standard with Standard III (§2.5).

### 2.7 Apocalypse (MC45 p. 14), step by step

1. Appendix II steps 1–9. The villain deck is Apocalypse II, III and IV (III and IV in expert mode; I to IV with the
   easier start, §4.2 Q12); the dial is 9[per_hero] (10[per_hero] in expert, 8[per_hero] from stage I).
2. **Step 10**: the encounter deck is the `apocalypse` set without its two chained cards (10 cards: Cyberpathy,
   Biomorphing, Molecular Control, The Fittest ×2, Wolf Among Sheep ×3, The Apocalypse Solution ×2), the Standard set,
   two modular sets, the Expert set in expert mode and the obligations. The five Prelates are never in the deck.
3. **Step 11**: with Infinites, Gene Pool enters play with 4 threat (§3.4), and its setup option applies (§3.5).
4. **Step 12a**, 45103a Setup: "Set aside each unused villain card, each [PRELATE] minion, and The Tyrant's Throne
   side scheme. Reveal the Heart of the Empire side scheme. The first player reveals a random, set-aside [PRELATE]
   minion."
   - Set aside: the five Prelates and The Tyrant's Throne (the record's `setAsideCardIds`, 45179b–45183b and 45105a,
     passed by the scenario builder as `GameSetupConfig.setAside`). Heart
     of the Empire is revealed from the encounter deck: 2 threat, one acceleration icon.
   - One of the five Prelates, chosen by the seeded RNG, is revealed by the first player: it engages them and gets a
     tough status card (toughness).
5. **Step 12b**: flip to 1B: 1[per_hero] threat; the target is X[per_hero] (§3.19). **Step 12c**: Apocalypse's
   toughness gives him a tough status card.

**In play** (MC45 p. 14, "Stop the Apocalypse").

- **The main scheme never advances; Apocalypse does.** Each stage but IV: "Forced Interrupt: When the main scheme is
  completed, remove all threat from it (ignoring any crisis icons). Flip this card and reveal Apocalypse (II)" (II:
  "Remove this card from the game and reveal Apocalypse (III)"; III: "Flip this card and reveal Apocalypse (IV)"). IV:
  "When the main scheme is completed, the players lose the game." §3.18.
- **Defeating him does not win.** 1B: "Forced Interrupt: When Apocalypse would be defeated, discard each attachment
  from him and heal all damage from him instead. Remove X threat from this scheme (ignoring any crisis icons)." MC45
  p. 14: "Defeating Apocalypse this way does not win the game, but it does discard attachments from him and prevents
  him from growing stronger." X is the numeral alone, with no per player icon: 9 threat at stage II for any number of
  players. §3.20.
- **The chain.** Heart of the Empire → (flip) The Towering Citadel → (reveal) The Tyrant's Throne → (flip and reveal)
  No Longer Worthy. Each of the three schemes locks its threat "while a [PRELATE] minion is in play" and, when
  defeated, has the first player reveal another random set-aside Prelate and deals each other player an encounter
  card. A game reveals four of the five Prelates: one at setup and one per scheme. §3.22.
- **No Longer Worthy** (45105b): "Attach to Apocalypse and heal 5[per_hero] damage from him. He cannot take damage
  while a [PRELATE] minion is in play. Ignore the 'Forced Interrupt' on the main scheme. Forced Interrupt: When
  Apocalypse is defeated, the players win the game." It ignores 1B's interrupt only: Apocalypse's own interrupt still
  reveals his next stage when the main scheme is completed, and stage IV still loses. §3.21.
- **The clock** (1 player, standard, no other icons): step one places 1 + 1 (Heart of the Empire's icon), so the main
  scheme reads 3, 5, 7, 9 and Apocalypse III is revealed in round 4. The Towering Citadel adds 2 per round and The
  Tyrant's Throne 3.
- **In a campaign** all five Prelate faces are set aside for this scenario whatever the campaign log has struck
  (ruling April 30, 2026 – Ruling 4 (2)); the campaign's own additions are pass 1c.

### 2.8 Dark Beast (MC45 p. 16), step by step

1. Appendix II steps 1–9. The villain deck is Dark Beast I and II (II and III in expert); the dial is 15[per_hero]
   (18[per_hero]).
2. **Step 10**: the encounter deck is `dark_beast` (45122–45126, 9 cards), the Standard set, one modular set, the
   Expert set in expert mode and the obligations. **The Savage Land, Genosha and Blue Moon sets (8 cards each) are set
   aside whole**, environments included, and **step 11 does not put the three environments into play** although they
   print setup. 45121a's Setup says so ("Set the Blue Moon, Genosha, and Savage Land sets aside (including each
   environment card in those sets)") and card text beats the setup keyword's rule (RRG "The Golden Rules", p. 4). The
   printed order (the 1A Setup resolves at step 12, after steps 10 and 11) cannot be followed literally; the builder
   states the set-aside sets up front, from the record's `setAsideCardIds` (45127–45146). §3.23.
3. **Step 12a**: in expert mode, "reveal the High-Tech Goggles attachment": found in the encounter deck, attached to
   Dark Beast (+1 SCH), the deck shuffled. **Step 12b**: 1B with 1[per_hero] threat.
4. **Step 12c**, Dark Beast's When Revealed: "Reveal a random set-aside environment and shuffle the rest of its
   encounter set into the encounter deck." One of the three environments (seeded RNG) enters play; its own When
   Revealed ("Discard each other [SETTING] environment in play") finds none; the other 7 cards of its set are shuffled
   into the encounter deck. Stage II (expert) adds "Deal each player an encounter card."

**In play.**

- Dark Beast I, II and III: "[star] Forced Interrupt: When Dark Beast attacks you, resolve the 'Special' ability on
  the [SETTING] environment." Fourteen other cards resolve it too (§3.24). The three Specials are in the table below.
- When stage I is defeated, stage II's When Revealed reveals one of the two environments still set aside: the first
  environment is discarded to the encounter discard pile, the new set's 7 cards join the deck, and each player is
  dealt an encounter card. The first set's cards stay in the deck. **A game sees two of the three sets**; the third
  stays set aside unless a card finds it (Land Out of Time finds The Savage Land wherever it is).
- A discarded environment is an ordinary encounter card afterward: reshuffled with the discard pile, it can be dealt
  and revealed (it enters play and discards the current one, and nothing is shuffled in) or turned up as a boost
  card (3 icons).
- 1B: "If this stage is completed, the players lose the game." Genosha's Special is the scenario's second clock.

| Environment           | Constant                      | Special ("you" is the resolving player) |
| --------------------- | ----------------------------- | --------------------------------------- |
| The Savage Land       | The villain gains retaliate 1 | Discard the top 3 cards of your deck    |
| Genosha               | The villain gains steady      | Place 1 threat on the main scheme       |
| Blue Area of the Moon | Each minion gains guard       | Deal 1 damage to your identity          |

### 2.9 En Sabah Nur (MC45 p. 19), step by step

1. Appendix II steps 1–9. The villain deck is the three-sided Apocalypse I and II (II and III in expert); the dial is
   16[per_hero] (20[per_hero]).
2. **Step 10**: the encounter deck is `en_sabah_nur` (45149–45155, 11 cards, every one a [SUPERPOWER] card), the
   Standard set, two modular sets, the Expert set in expert mode and the obligations.
3. **Step 11**: with Clan Akkaba, Ancient Ritual enters play with 5 threat (MC45 p. 19: "it always begins the game in
   play and cannot leave play").
4. **Step 12a**, 45147a Setup: "Apocalypse begins the game in [BIOMORPH] form. Deal each player a facedown encounter
   card." The villain card's `startingSide`; nothing changes form, so no face's Forced Response resolves.
5. **Step 12b**: 1B with 1[per_hero] threat and no power counters.

**In play.**

- 1B and 2B: "[star] Forced Response: After resolving step 1 of the villain phase, place 1 power counter here. If
  there are at least 4 power counters here, the first player removes 4 of them and discards cards from the top of the
  encounter deck until a [SUPERPOWER] card is discarded and reveals it." §3.27.
- 1B at 8[per_hero] advances to 2A ("When Revealed: The first player discards cards from the top of the encounter
  deck until a [SUPERPOWER] card is discarded and reveals it"), then 2B, which loses at 10[per_hero].
- MC45 p. 19, "Three-Sided Villain": "various card abilities will cause Apocalypse to change forms. When this
  happens, change the Apocalypse villain card to the specified form of his card. This is NOT the same as 'defeating'
  or 'revealing' the villain, so do not reset his hit points or discard his attachments when he changes forms."
  §3.26.
- Each [SUPERPOWER] treachery and side scheme has two branches: in the form it names, Apocalypse activates;
  otherwise he changes to it (and the treachery adds a power counter, the side scheme a tough status card).

### 2.10 The modular sets of pass 1b

| Set            | Cards                                                                                                     | Notes                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Dark Riders    | Gauntlet, Barrage, Hard-Drive, Tusk, Psynapse, The Dark Riders                                            | Five unique minions with teamwork ([DARK RIDERS]); the scheme gives them toughness. §3.32. |
| Savage Land    | The Savage Land, Pterosaur, Velociraptor ×2, Giant Ape ×2, Land Out of Time, Village Under Attack         | Setting environment with setup. §3.23, §3.24.                                              |
| Genosha        | Genosha, Magistrate ×2, Armored Unibike ×2, Genoshan Mech, Escaped Mutant, Police State                   | Setting environment; Escaped Mutant attaches to an identity. §3.24, §3.31.                 |
| Blue Moon      | Blue Area of the Moon, Gladiator, Oracle, Manta, Earthquake, Warstar, Imperial Guardsman, Trial by Combat | Setting environment; teamwork ([IMPERIAL GUARD]); an amplify icon. §3.24, §3.32.           |
| Celestial Tech | Celestial Armor, Celestial Weapon, Celestial Tech ×2                                                      | Attachments that read the top card of your deck. §3.28.                                    |
| Clan Akkaba    | Ozymandias, Scarab, Clan Akkaba Zealot ×3, Tyrant Worship, Ancient Ritual                                 | Ancient Ritual is permanent and setup in every scenario that uses the set. §3.29.          |

A Setting set used **outside** Dark Beast follows its printed keyword: the environment is put into play at step 11
(RRG "Setup (Keyword)", p. 40) and its other 7 cards are shuffled into the encounter deck at step 10. Put into play is
not revealed, so its When Revealed does not resolve; two Setting sets in one such game is §4.2 Q15.

### 2.11 Pass 1c: the campaign (MC45 pp. 4–6, 8, 12, 14, 16, 20, 24)

Five scenarios in numerical order (p. 4: "the players must win all five scenarios in numerical order, starting with
scenario #1 – Unus and ending with scenario #5 – En Sabah Nur"). "Each player must use their chosen identity for the
entire campaign, but they are free to change aspects and alter the contents of their deck between scenarios". A lost
scenario may be reset "with no penalty" (p. 4; foundation row 11 of `docs/campaign-mode-design.md`). The foundation
was designed with this box in view (rows 1, 11, 16, 23, 24, 28, 30, 32, 40, 49 and 53), so the between-games half is
vocabulary that exists; what is new is inside the game (§3.33–§3.46).

| Scenario        | Campaign setup (in printed order)                                                                                                            | Campaign victory                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1 Unus          | Record identities ("Players cannot switch identities during a campaign"); the block                                                          | Strike the mission; its Defeated or Not Defeated row; strike the Overseer if defeated; expert: record hit points                 |
| 2 Four Horsemen | The block; expert: set hit points, heal for 3 threat on the mission                                                                          | the same                                                                                                                         |
| 3 Apocalypse    | the same                                                                                                                                     | the same                                                                                                                         |
| 4 Dark Beast    | the same                                                                                                                                     | the same                                                                                                                         |
| 5 En Sabah Nur  | The block with **Protect the Professor** in place of the random mission; "Professor X cannot enter play during this game"; expert: set, heal | Protect the Professor defeated: "win the campaign!" Not defeated: "the players failed to save Professor X and lose the campaign" |

**"The block"**, the five bullets every box prints (pp. 8, 12, 14, 16; p. 20 with its second bullet changed):

1. "Shuffle the Age of Apocalypse modular set into the encounter deck."
2. "Randomly select one of the available [MISSION] side schemes and follow the Setup directions for it in the
   campaign log."
3. "Randomly select one of the available [OVERSEER] minions and add it to the mission area. Put the double-sided
   Mission Rules card into play next to it."
4. "The first player takes control of the Mission Team (171A) support card, [MISSION] side faceup."
5. "Each player searches their deck for an ally and adds it to their hand. (This card counts towards your hand
   size.)"

- **Each of the four log missions is played exactly once.** Four missions, four scenarios, and every win strikes the
  one that started the game in play (p. 6), defeated or not. Their order comes from the campaign's seed and, after
  a loss, from how many times the scenario has been attempted (§3.45). Protect the Professor
  is always the fifth.
- **At least one Overseer is always available.** One is struck per win at most, and only if it was defeated that
  game; scenario 5 has between one and five to draw from.
- **A loss changes nothing.** The Victory list does not run, so the mission is not struck and the Overseer is not,
  even if it was defeated in the lost game; cards removed from the game during the game are back. **A retry draws
  again (§4.1 Q22 = B):** the mission and the Overseer are chosen during scenario setup, a retried scenario runs its
  setup again, and both are drawn afresh from the options still unstruck. The retry may meet a different mission, a
  different Overseer, both or neither; nothing excludes the pair the lost game had.
- **The campaign can be lost by winning.** A game of scenario 5 won with Protect the Professor still on its a face
  (neither defeated nor failed) ends the campaign as a loss: the Victory list reads "was not defeated" (p. 20). If the
  mission fails during the game, the b face ends the game as a loss first, and that game may be retried.

### 2.12 Campaign setup, bullet by bullet

RRG 1.8 Appendix II step 13 (p. 51): "Campaign Setup. If playing in campaign mode, resolve the Setup campaign
instructions listed for the scenario in its associated rulebook", after step 12 and before the starting hands. Every
instruction below resolves in the default window (`afterScenarioSetup`) in printed order, except the between-games
draws, which the runner makes before the game is built.

1. **Scenario 1 only:** each seat's identity is the campaign seat. Nothing happens in the game.
2. **The Age of Apocalypse set**: Agent of Apocalypse ×2 and Worldwide Crisis ×2 join the encounter deck
   (`composeEncounterSets`, into the deck). They are an addition, not one of the scenario's modular sets.
3. **The mission.** Between games the runner draws one unstruck option of `missions` from the campaign's RNG and
   writes it to `currentMission` (scenario 5: no draw, Protect the Professor). The draw is made again for every
   attempt of the scenario (§3.45's `perAttempt`; §4.1 Q22 = B). In the game the mission is revealed
   (p. 5: "randomly select one of the available [MISSION] side schemes … and reveal it"): it enters play in the
   **mission area** with 5[per_hero] threat. Then its row's Setup cell (§2.14).
4. **The Overseer.** One unstruck option of `overseers`, drawn per attempt as the mission is and written to
   `currentOverseer`; the minion is put into play
   in the mission area (p. 5), engaged with nobody. Put into play, not revealed: nothing on the a face reads the
   difference. The Mission Rules card is the mission's rules block (§1.29).
5. **Mission Team** (45171a) is put into play under the first player's control, [MISSION] face up, ready. RRG
   "Ownership and Control" (p. 31): "When a player takes control of a campaign-specific … player card … that player
   becomes the owner of that card until the game ends or another player takes control of that card."
6. **The ally search.** In player order each player searches their deck for an ally, adds it to their hand and
   shuffles. **It counts toward the starting hand**: at step 14 that player draws one card fewer, so a hand size of 6
   is the ally and 5 drawn cards, and the mulligan (step 15) may discard the ally like any other card. This is the
   box's own parenthesis, and it differs from NeXt Evolution's Morlock search, which the owner placed after the
   mulligan as an extra card (wave 7 §4.1 Q28). §3.44. A player with no ally in their deck adds nothing and draws a
   full hand. In an expert campaign the ally "must share a trait with your hero" (§2.16).
7. **Scenario 5 only:** "Professor X cannot enter play during this game" (§3.43).
8. **Expert campaign, scenarios 2 to 5:** hit points are set, then each player may place 3 threat on the mission to
   heal (§2.16).

**What a game then looks like** (MC45 p. 5's diagram): the villain's area as the scenario set it up; beside it the
mission area with the mission (5[per_hero] threat, no attempt counters), the Overseer (5[per_hero] hit points, no
damage) and no allies; Mission Team in front of the first player.

### 2.13 The mission area and a mission attempt (MC45 pp. 5–6)

**The area.** "[MISSION] side schemes begin the game in a separate game area called the 'mission area.'"

- "Players cannot thwart [MISSION] side schemes."
- "Cards in the mission area are in play but under no player's control. They cannot be affected by card abilities
  unless the ability refers to the mission area." Read as: a card there is never chosen and never changed by an
  ability that does not name the mission ("at the mission", "the mission area", "the [MISSION] side scheme"); what an
  ability merely counts or watches is §4.2 Q18. The abilities that do name it are all in the five campaign sets.
- "While a [MISSION] side scheme is in play, when a player plays an ally, they must choose: either play that ally
  into their game area per the normal rules of the game, or play it into the mission area." Its cost, its play
  restrictions and the unique rule apply as for any play (RRG "Unique Icon", pp. 45–46: a card that matches a card in
  play "cannot be played or put into play", and an ally at the mission is in play).
- "Allies in the mission area are used to make mission attempts. They do not count towards your ally limit." "Treat
  the printed text box of each ally in the mission area as blank, except for [TRAITS]." Its cost, stats, hit points
  and resource icon are not in the text box (RRG "Text Box", p. 44) and stay.
- "Players may attach upgrades to allies in the mission area." Attaching is allowed; it does not waive the sentence
  above (§4.1 Q19 = B). An ordinary upgrade there changes nothing about its host and cannot be triggered. Only an
  upgrade whose ability works with the mission has an effect there, and Desperate Measures is the one such card.
- "When a card in the mission area leaves play, place it in its owner's discard pile." A player's ally goes to that
  player's pile; an encounter card to the encounter discard pile; an Overseer, with victory 5, to the victory display
  (RRG "Victory X", p. 46).
- Nothing there activates: a minion at the mission is engaged with no player (RRG "Activation", p. 6), and an ally
  there is no player's to exhaust.

**Mission Team.** Its Action is the first player's (they control it), once a round: exhaust it and choose the
discount or an attempt. It moves with the first player token. It "cannot be discarded"; the mission's own text removes
it from the game or flips it.

**An attempt** (p. 6: "When a player makes a mission attempt, they resolve the following five steps in order").

1. "Discard X cards from the top of their deck, where X is the number of allies at the mission." If the deck runs
   out, it resets and deals its encounter card, and "no further cards are discarded from the newly shuffled deck"
   (RRG "Player Deck", p. 33), so fewer than X cards may be discarded.
   - **Now the Overseer's Mission Response resolves** (a Forced Response, first: RRG "Forced", p. 20), then any
     Response a discarded card has to its own discard (Digging Deep; ruling April 30, 2026 – Ruling 4 (1)). A card
     that is no longer in the discard pile after this "does not count for the mission attempt and no replacement card
     is drawn".
2. "Assign each of the discarded cards to a different ally at the mission." The attempting player pairs them.
   - "If a resource icon on the ally matches a resource icon on the card assigned to it, that ally participates."
   - "Wild resource icons ([wild]) on cards discarded for the mission attempt may be used to match any resource icon
     on an ally at the mission"; "Any resource icon … may be used to match an ally with a wild resource icon".
   - A card with no resource icon matches nothing. A card with two icons matches on either.
   - "Return the discarded cards to their discard pile after determining which allies will participate."
3. "Gather X damage tokens into a damage pool, where X is the total ATK of all participating allies."
4. "Deal damage from this pool to enemies at the mission one at a time until there is no damage in the pool or there
   are no enemies remaining at the mission." Read as one enemy at a time, the attempting player choosing each: an
   enemy that cannot take damage is not offered, each is settled (and defeated) before the next is chosen, and damage
   left with no enemy able to take it is lost.
5. "Remove X threat from the [MISSION] side scheme, where X is the total THW of all participating allies." Not a
   thwart: no ally exhausts and none takes consequential damage.

"When the [MISSION] side scheme has no threat remaining on it, it is defeated. The [MISSION] side scheme cannot be
defeated while there are any minions in the mission area. The [OVERSEER] minion cannot take damage while another
minion [is] in the mission area." Then the mission's own Forced Response: one attempt counter, and 1 damage to each
ally at the mission.

**The rulebook's example, with numbers** (1 player; Evacuate Survivors, 5 threat; Sugar Man, 5 hit points). Randall
([wild]; THW 2, ATK 1, 3 hit points), X-23 ([physical]; THW 1, ATK 3, 3 hit points) and Marrow ([energy]; THW 1,
ATK 2, 2 hit points) are at the mission. The player discards Magik's Crown ([mental]), Clobber ([physical]) and
Bloodgem ([wild]).

- Sugar Man's Mission Response: one [physical] discarded, heal 3 damage from him; he has none.
- Magik's Crown to Randall (any icon matches his [wild]), Clobber to X-23, Bloodgem to Marrow (a [wild] matches her
  [energy]): all three participate.
- Pool 1 + 3 + 2 = **6**. Sugar Man takes 5 and is defeated (victory display, 5 points); 1 is lost.
- THW 2 + 1 + 1 = **4**: the mission goes from 5 to 1.
- The mission's Forced Response: 1 attempt counter; Randall 1 damage of 3, X-23 1 of 3, Marrow 1 of 2.
- Next round, X-23 alone participating removes the last threat: the mission is defeated in step 5 with one counter
  on it. No second counter is placed (the a face is gone).

**How a mission ends.**

- **Defeated** (no threat, no minion in the area). "When Defeated: Shuffle each player card at the mission into its
  owner's deck. Flip Mission Team and this card over." The allies and their upgrades go back to their owners' decks
  (shuffled); Mission Team shows its [FINISHED] face ("choose a player to draw 1 card") for the rest of the game; the
  b face's "If the mission was defeated" bullet resolves.
- **Failed** (the fourth attempt counter). "Remove Mission Team from the game and flip this card over." The b face
  removes every card in the mission area from the game (the allies and their upgrades, the Overseer, any Agent of
  Apocalypse, cards attached to Abyss), then its "If the mission was not defeated" bullet resolves. Removed from the
  game is this game only: the allies are in their owners' decks again next scenario, and the Overseer is not struck.
- **Neither** when the game ends: for Victory this is "was not defeated".
- The fourth attempt can still succeed: step 5 defeats the mission before the Forced Response would place the fourth
  counter.

### 2.14 The four missions of the log (MC45 p. 24)

Each row has three cells: **Setup**, followed when the mission is drawn; and after a won game, **Defeated** or **Not
Defeated**. The b face's two bullets (§1.24) are the in-game half and resolve whether or not the game is then won.

| Mission                   | Setup (this game)                                                          | Defeated (after a win)                                                                                                                                                                                                                                       | Not Defeated (after a win)                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Liberate the Seattle Core | "Set each copy of Desperate Measures upgrade aside."                       | "For the rest of the campaign, each player may shuffle 1 copy of Desperate Measures into their deck at the start of each game. That card does not count against your minimum deck size."                                                                     | "Remove each copy of Desperate Measures from the campaign."                                                                     |
| Evacuate Survivors        | "Each player shuffles a copy of Panicked Refugees into their deck."        | "Remove each copy of Panicked Refugees from the campaign. Each player chooses an upgrade from any aspect. They may include 1 copy of [that] card in their deck for the rest of the campaign. That card does not count against your minimum deck size."       | "For the rest of the campaign, each player must shuffle a copy of Panicked Refugees into their deck at the start of each game." |
| Sabotage the Sea Wall     | "Shuffle the North American Sea Wall side scheme into the encounter deck." | "Remove the North American Sea Wall side scheme from the campaign. Each player chooses a support from any aspect. They may include 1 copy of that card in their deck for the rest of the campaign. That card does not count against your minimum deck size." | "For the rest of the campaign, shuffle the North American Sea Wall into the encounter deck during setup."                       |
| Find Lost Mutants         | "Set each campaign ally aside."                                            | "Each player chooses a campaign ally. They may include that ally in their deck for the rest of the campaign. That card does not count against your minimum deck size."                                                                                       | "Remove each campaign ally from the campaign."                                                                                  |

- **Defeated is the reward and Not Defeated the cost**, in every row (§0.2 corrects two repo documents on this).
- **Set aside** is where the game finds the cards the b face hands out: the four copies of Desperate Measures ("each
  player adds 1 copy … to their hand"), the four campaign allies ("each player adds one set-aside campaign ally to
  their hand", in player order, each ally to one player). The runner sets them aside for that game only.
- **"At the start of each game"** (Desperate Measures, Panicked Refugees) is a setup instruction of every later
  scenario, resolved in the default window, before the ally search and the starting hands: an offer for Desperate
  Measures ("may"), no choice for Panicked Refugees ("must"). Neither card is in the seat's deck list between games.
- **The picks** (an upgrade, a support, a campaign ally) are `CampaignGrant`s for the rest of the campaign: "from any
  aspect" is §4.2 Q24, "does not count against your minimum deck size" is Q25. A granted campaign ally is the same
  card for the log and the game: each of the four is unique and goes to one seat. The pick after a win is separate
  from the b face's in-game hand-out and need not be the same ally.
- **Removed from the campaign** survives a retry (RRG "Modes of Play", p. 29). It is only ever written by a Victory
  list here, so no lost game writes one.
- Sabotage the Sea Wall, defeated in the game: the b face finds North American Sea Wall in the encounter deck, the
  discard pile or in play (a card dealt facedown to a player is not searched, §3.1) and removes it from the game;
  then, after the win, the log removes it from the campaign.

### 2.15 Scenario by scenario

What the campaign's cards meet in each scenario. Nothing in the five scenario sets or their modular sets names the
mission, an Overseer or the [CLAN AKKABA] trait by card text (checked by script over every raw record of the box).

- **1 Unus.** The identities are recorded. No expert bullet at setup. The encounter deck gains four cards beside
  Unus, Infinites, Standard and one modular set.
- **2 Four Horsemen.** Death's "deal 1 damage to each character you control" and War's "discard an upgrade or support
  you control" do not reach the mission: nobody controls its cards. War can make the first player discard a support,
  and Mission Team "cannot be discarded" (§3.35). Famine's "discard the top 10 cards of your deck" is not a mission
  attempt and no Mission Response answers it.
- **3 Apocalypse.** The Overseer is an [OVERSEER], not a [PRELATE]: the three locked schemes, Wolf Among Sheep and No
  Longer Worthy do not read it. The Fittest ("the minion with the highest printed hit points") cannot attach to it,
  though its 5[per_hero] ties the Prelates for the highest: it attaches to the highest outside the mission.
  **All five Prelate faces are in the scenario whatever the log has struck** (ruling April 30, 2026 – Ruling 4 (2));
  that the Overseer in the mission area and one Prelate are the same printed card is §4.2 Q21.
- **4 Dark Beast.** Blue Area of the Moon's "Each minion gains guard" and Imperial Guardsman's "Attach to a minion"
  do not reach the mission. An Agent of Apocalypse that activates against a player is an ordinary [CLAN AKKABA]
  minion with guard.
- **5 En Sabah Nur.** Protect the Professor is revealed instead of a drawn mission; it has no row in the log and no
  Setup cell. Professor X (`mut_gen` 32019, reprinted `gambit` 37017) cannot be played or put into play by anyone. If
  the mission fails the players lose the game at once (45170b); if they win with it undefeated they lose the
  campaign (§2.11). Clan Akkaba's own cards do not name the trait, so the Agents gain nothing from that set.
- **In all five**, after the mission is finished the four Age of Apocalypse cards are still in the encounter deck.
  With no [MISSION] side scheme in play an option that names it cannot be chosen (RRG "Choose (Option)", p. 12): an
  Agent of Apocalypse activates, and Worldwide Crisis is 1 damage and surge. Their Boost abilities still give the
  extra boost card.

### 2.16 The expert campaign (MC45 p. 20)

- "Some Setup and Victory instructions are preceded by **Expert Campaign Only**. Ignore these instructions unless you
  are playing an expert campaign." RRG FAQ "Campaign Mode" (p. 61): an expert campaign does not put any scenario in
  expert mode; the two are separate choices.
- **Persistent damage.** After a win "each player must record their remaining hit points"; "If a player's remaining
  hit point value is greater than their base hit point value, record their base hit points … instead" (foundation
  row 18, `remainingHitPointsCappedAtBase`). Scenarios 1 to 4 record; scenario 5 does not (the campaign is over).
- **Setup of scenarios 2 to 5**, after the ally search: "Set each player's hit points to their remaining hit point
  value recorded in the campaign log for the previous scenario", then "Each player may place 3 threat on the
  [MISSION] side scheme to heal their identity to its full hit point value." Three threat flat, per player who heals:
  with 2 players the mission starts at 10 and is at 16 if both heal. The instruction names the mission, so it can
  place the threat (§3.33).
- **Elimination.** "If a player is defeated during a scenario that their teammates go on to win, the defeated player
  does not participate in the Victory steps of that scenario", and "can rejoin their teammates by placing 3 threat on
  that scenario's [MISSION] side scheme to restore their identity to full hit points." As in every earlier box
  (wave 6 §4.1 Q11, wave 7 §3.46): a seat with no recorded hit points must pay; it is not offered "Decline". A seat
  that sat out makes no pick in a Defeated row and records nothing; the shared strikes still happen.
- **The ally search:** "When playing expert campaign, the ally you choose during Setup must share a trait with your
  hero." Printed once, at the foot of the expert rules, for every scenario's search. The hero face's traits, as
  `CollectionFilter.sharesTraitWithIdentity` already reads them between games; a player with no such ally in their
  deck adds nothing.

## 3. Engine primitives (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card; card names say where each primitive is needed.
Every status below comes from a search by behavior (2026-10-07) of `packages/engine/src` (`spec.ts`, `abilities.ts`,
`rules.ts`, `query.ts`, `select.ts`, `state.ts`, `resolve/*`), the DSL in `packages/cards/src/dsl`, the content schema
and the wave 1–7 specs. Statuses: **exists** (found and exercised by an earlier wave's cards); **exists (verify)**
(found by name and doc comment, its behavior for this card not run: the scripting agent proves it in a test before
relying on it, and a failure becomes an extend here); **exists (compose)** (several existing pieces, no engine
change); **extend** (an existing primitive needs one more case); **new**. Each section is one agent, one commit.

| §    | Primitive                                                                                            | Needed by                                                      | Status           |
| ---- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------- |
| 3.1  | Find, and "find … and reveal it" when the card is already in play                                    | 45075b, 45097                                                  | extend           |
| 3.2  | An amplify icon a character gains under a condition                                                  | 45059–45061; printed on 45089                                  | exists (verify)  |
| 3.3  | Keywords, an icon and hit points gained at threat thresholds on a named card                         | 45059–45061, 45067, 45069                                      | exists (compose) |
| 3.4  | A permanent, setup side scheme that stays in play with no threat                                     | Gene Pool 45071; 45062a                                        | exists (verify)  |
| 3.5  | A setup option that belongs to a modular set                                                         | Infinites (MC45 p. 8, "Modular Difficulty")                    | extend           |
| 3.6  | Standard III: a counted environment that flips; replacing the Standard set                           | 45075a/b–45080                                                 | extend           |
| 3.7  | Villains in a random row; the active counter passes to the next in the row                           | 45085a/b, 45091, 45096                                         | extend           |
| 3.8  | "After a villain activates" with several villains                                                    | 45085b; 45092–45095                                            | exists (verify)  |
| 3.9  | Villains that cannot be defeated while another has hit points                                        | 45081–45084 a/b                                                | exists (verify)  |
| 3.10 | "Is considered to have at least 1 hit point"                                                         | Golden Horse 45090, Metal Wings 45091, 45096                   | new              |
| 3.11 | Another card's Forced Response resolved "as if it just attacked you"                                 | 45090, 45091, 45096                                            | extend           |
| 3.12 | A named enemy activates; no boost card; "after this activation"; extra boost                         | 45067, 45092–45095                                             | exists (compose) |
| 3.13 | An identity's text box blanked "until the next villain phase begins"                                 | Pestilence 45083a/b, Plague and Pestilence 45088               | extend           |
| 3.14 | Attach hosts of this pass; an attachment that moves the active counter                               | 45066, 45090, 45091, 45099                                     | exists (verify)  |
| 3.15 | A random side scheme of a set revealed by each player at setup                                       | 45085a                                                         | exists (verify)  |
| 3.16 | A forced change to hero form; the first copy revealed each phase gains surge                         | Hound 45098, Release the Hounds 45100                          | exists (verify)  |
| 3.17 | Reusable as is                                                                                       | the rest                                                       | checked          |
| 3.18 | A villain's next stage revealed when the main scheme is completed                                    | Apocalypse 45101a/b, 45102a/b                                  | extend           |
| 3.19 | A target threat of X per player, X read from the villain's printed hit points                        | 45103b, 45111                                                  | extend           |
| 3.20 | "When [the villain] would be defeated … instead", printed on the main scheme                         | 45103b                                                         | exists (compose) |
| 3.21 | An attachment that ignores a named ability; winning when the villain falls                           | No Longer Worthy 45105b                                        | new              |
| 3.22 | Chained side schemes locked while a trait's minion is in play                                        | 45104a/b, 45105a; Prelates 45179b–45183b                       | exists (verify)  |
| 3.23 | Whole sets set aside; one environment revealed at random, its set shuffled in                        | 45118–45120, 45121a, 45127, 45133, 45139                       | exists (verify)  |
| 3.24 | "Resolve the 'Special' ability on the [SETTING] environment"                                         | fifteen cards of scenario 4                                    | extend           |
| 3.25 | An attachment with no "attach to" that attaches from its own When Revealed                           | Cruel Experiment 45124                                         | extend           |
| 3.26 | A three-sided villain that changes to a named form                                                   | 45184–45186 a/b/c, 45149–45155                                 | extend           |
| 3.27 | Named counters on the main scheme that reveal a trait's card at a threshold                          | 45147b, 45148a/b, 45150–45152                                  | exists (compose) |
| 3.28 | An attachment's Forced Interrupt resolved "as if" its trigger just happened                          | Celestial Tech 45158; 45156, 45157                             | extend           |
| 3.29 | A permanent side scheme that sheds threat at a threshold; redirected threat                          | Ancient Ritual 45163, 45159–45162                              | exists (verify)  |
| 3.30 | Cards from a player's deck attached facedown to a minion, and counted                                | Abyss 45181b                                                   | exists (verify)  |
| 3.31 | An attachment on an identity that minions of a trait seek out                                        | Escaped Mutant 45137, 45134, 45135, 45138                      | exists (verify)  |
| 3.32 | Reusable as is (pass 1b)                                                                             | the rest                                                       | checked          |
| 3.33 | An in-play scenario area no player controls, closed to abilities that do not name it                 | every card of §1.24–§1.28; MC45 p. 5                           | new              |
| 3.34 | An ally played into that area: the choice, no controller, a blank text box, upgrades                 | every ally in a campaign game; 45176                           | extend           |
| 3.35 | A support the first player controls that cannot be discarded; a discount by destination              | Mission Team 45171a/b                                          | extend           |
| 3.36 | Discarded cards paired one each with characters, matched by resource icon                            | Mission Team 45171a; Mister Sinister 45179a                    | new              |
| 3.37 | A damage pool dealt to one enemy at a time; threat removed by a total that is not a thwart           | Mission Team 45171a                                            | extend           |
| 3.38 | A Forced Response to one ability's deck discard ("Mission Response"); a discarded card that leaves   | 45180a–45183a; Digging Deep 40060                              | exists (verify)  |
| 3.39 | A named moment a script raises and other cards answer                                                | 45166a–45170a ("After you resolve a mission attempt")          | new              |
| 3.40 | A side scheme nobody thwarts, kept in play by a minion, that flips to a face that clears the area    | 45166a/b–45170a/b                                              | exists (compose) |
| 3.41 | Minions in the area: dashed stats, never engaged, shielded by another minion                         | 45179a–45183a, Agent of Apocalypse 45164                       | exists (verify)  |
| 3.42 | A resource icon a character is considered to have; an obligation that lives in a player's deck       | Desperate Measures 45176; Panicked Refugees 45178; 45172–45175 | extend           |
| 3.43 | "[A title] cannot enter play during this game"                                                       | MC45 p. 20 (scenario 5)                                        | extend           |
| 3.44 | A card found at campaign setup that counts toward the starting hand                                  | MC45 pp. 8, 12, 14, 16, 20                                     | extend           |
| 3.45 | The campaign definition: random strike lists, three-cell rows, rewards, a win that loses             | the log (MC45 p. 24); all five scenarios                       | exists (verify)  |
| 3.46 | One printed card as two cards: an Overseer in play and its Prelate face                              | 45179a/b–45183a/b in scenario 3                                | extend           |
| 3.47 | Reusable as is (pass 1c)                                                                             | the rest                                                       | checked          |
| 3.48 | The top card of a player's deck kept faceup                                                          | Magik 45030a                                                   | new              |
| 3.49 | Playing the top card of your deck as if it was in your hand, for 1 less, once per phase              | Magik 45030a; RRG FAQ p. 64                                    | extend           |
| 3.50 | "The top card of your deck has a [type] or [wild] resource icon"                                     | 45033–45035, 45038–45040                                       | exists (verify)  |
| 3.51 | "If you paid for this event with a resource card"                                                    | 45007, 45008                                                   | extend           |
| 3.52 | Resource cards as a card type: discarded, counted in hand, kept from a deck discard                  | 45001a, 45002–45006, 45009, 45025, 45029                       | exists (compose) |
| 3.53 | An attach host by classification; "your sidekick"                                                    | Sidekick 45015, Side-by-Side 45016                             | extend           |
| 3.54 | A cost that readies a card                                                                           | Side-by-Side 45016                                             | extend           |
| 3.55 | A deck discard cost of a chosen size                                                                 | Goldballs 45041                                                | extend           |
| 3.56 | An ally that plays itself from hand into an attack and defends without exhausting                    | Colossus 45031                                                 | exists (verify)  |
| 3.57 | Player cards held facedown on a side scheme; a support returned when it is defeated                  | Belasco 45054, Ruler of Limbo 45055                            | exists (verify)  |
| 3.58 | The unique rule across printings: an ally whose subtitle is a hero's alter-ego                       | 45011, 45012, 45031; 45001a/b, 45030a/b                        | exists (verify)  |
| 3.59 | A search for "an upgrade that can be attached to an ally"                                            | Suit Up 45017 (erratum, RRG p. 69)                             | extend           |
| 3.60 | Reusable as is (pass 2a)                                                                             | the rest                                                       | checked          |
| 3.61 | Permanent copies in their owner's set-aside area: attached from it, set aside again                  | Frostbite 46002; 46001a/b, 46007–46011, 46024                  | exists (verify)  |
| 3.62 | The resource types a payment used                                                                    | 47004–47009, 47015; 47012, 47021                               | extend           |
| 3.63 | An additional cost to change form                                                                    | Grounded 47023                                                 | extend           |
| 3.64 | A player makes a basic attack or thwart on a card's instruction                                      | Cell Phone 47019                                               | extend           |
| 3.65 | Damage an identity would take from an enemy attack placed on a support                               | Ice Wall 46008                                                 | exists (verify)  |
| 3.66 | A player side scheme barred to heroes and allies, worked by any alter-ego, put into play by a search | Shopping Spree 47003, Jubilation Lee 47001b                    | exists (verify)  |
| 3.67 | An upgrade on an enemy as a condition; consequential damage reduced by what the target had           | 46003, 46012–46016, 47011                                      | exists (verify)  |
| 3.68 | Across packs: the unique rule, the Team-Up replacement and the ally Jubilee's +2 ATK                 | 46001a/b, 47001a/b, 46019, 47002, 47022, 46025; `wolv` 35003   | exists (verify)  |
| 3.69 | Three versions of one title in an identity set                                                       | 47007a/b/c, 47008a/b/c, 47010a/b/c                             | exists (verify)  |
| 3.70 | Reusable as is (pass 2b)                                                                             | the rest                                                       | checked          |
| 3.71 | A deck discarded until a trait's card is found; the whole discard read by cards that answer          | Magneto 49001a; 49004, 49005, 49027                            | extend           |
| 3.72 | An upgrade on an enemy that makes its owner's hero the defender; one named copy fetched and returned | Bamf! 48006; 48001a/b, 48002, 48007–48011                      | exists (verify)  |
| 3.73 | "Counts as 2 restricted cards" beside "1 additional upgrade that has the restricted keyword"         | Kurt's Cutlasses 48004, Prehensile Tail 48005                  | exists (verify)  |
| 3.74 | An encounter card tucked under an ally; X read from its boost icons; another character's base stats  | Gambit 48021, Rogue 48012                                      | exists (verify)  |
| 3.75 | A minion in play dealt to a player as a facedown encounter card, and passed to the next player       | The Crazy Gang 48033, Brimstone Dimension 48028                | extend           |
| 3.76 | An upgrade that stops a minion activating and blanks it; a minion discarded from play by a player    | Wrapped in Metal 49007, Magnetic Missile 49010                 | exists (verify)  |
| 3.77 | An attachment chosen by the label of an ability it prints ("Hero Action", "Hero Response")           | Electromagnetic Blast 49008; 48029                             | new              |
| 3.78 | Linked allies taken into hand from the set-aside area; allies outside the ally limit by a trait      | New Recruits 49020; 49033–49036, 49037                         | exists (verify)  |
| 3.79 | A boost card given to a minion outside its activation; a treachery that becomes one                  | Sebastian Shaw 49038, Power and Decadence 49042; 49039         | exists (verify)  |
| 3.80 | Across packs: the unique rule; a hero, a villain and their cards under one title                     | 48001a/b, 49001a/b, 48012, 48021, 49003, 49004, 49014, 49015   | exists (verify)  |
| 3.81 | Reusable as is (pass 2c)                                                                             | the rest                                                       | checked          |

### 3.1 Find, and "find … and reveal it" when the card is already in play

> **Status: extend.** `EffectSpec findCard` (`resolve/find.ts`) and `TargetRef find` (`spec.ts`) landed in wave 6
> §3.48: every in-game area in the order play, tucked, set aside, hand, discard pile, deck; never facedown encounter
> cards in an in-play area, the victory display, removed-from-game cards or anything outside the game; each deck
> searched is shuffled. `findCard.to` has hand, set aside, discard, attach and scenario-area destinations and **no
> "reveal"**. `revealCard` takes a ref, so "find X and reveal it" is `find` + `revealCard`; `resolve/reveal.ts` has a
> branch for a card already in play, written for main scheme faces, not checked for a minion or a side scheme.

**Cards.** Pursued by the Past 45075b ("find your nemesis minion and reveal it"); Ahab 45097 ("find the Release the
Hounds side scheme and reveal it"). Later: every "find" of passes 1b, 1c and 2.

**Rules.** RRG 1.8 "Find" (p. 19); MC45 p. 3 ("Do NOT look at facedown encounter cards currently dealt to players");
ruling December 17, 2025 – Ruling 4 (3); ruling June 25, 2026 – Ruling 5. RRG p. 19: "If a player is instructed to
'find and reveal' a minion that is already in play, that player engages that minion and resolves any keywords and/or
triggered abilities that resolve as a result of that minion being revealed … That minion retains all attached cards
and tokens on it. That minion is **not** considered to be entering play. That minion is considered to engage that
player unless it was already engaged with that player."

**Plan.** `revealCard` of a card found in play: a minion moves to the finding player and engages them (an `engaged`
event unless it already was), keeps damage, status cards, attachments and counters, raises no `entersPlay`, then its
When Revealed abilities and reveal keywords (surge, and quickstrike after them, RRG p. 36) resolve. A side scheme or
attachment found in play stays where it is, gains no starting threat (it does not enter play), and its When Revealed
and reveal keywords resolve (the June 25 ruling). Found out of play, the ordinary reveal.

**Tests (exact numbers).**

1. Nemesis minion engaged with player 2 with 2 damage and a stunned card; player 1 flips Pursued by the Past: the
   minion is engaged with player 1, still has 2 damage and the stunned card, no `entersPlay` in the log, its When
   Revealed resolved once for player 1.
2. Nemesis minion facedown as player 2's dealt encounter card, or as a boost card on the villain: not found; the flip
   reveals nothing and the dealt card stays facedown.
3. Nemesis minion in the victory display: not found.
4. Ahab revealed with Release the Hounds in the encounter discard pile: it enters play with 5 threat; the encounter
   deck is not shuffled (no deck was searched once it was found). In the deck: found, revealed, deck shuffled.
5. Ahab revealed with Release the Hounds in play at 2 threat: 5 threat (his own "place 3 threat on it" branch; the
   find branch is not reached).

**Composes with:** Rogue's Touched (wave 6), Face the Past (`magneto`, pass 2c).

### 3.2 An amplify icon a character gains under a condition

> **Status: exists (verify).** `RuleSpec gainsIcon { icon: "amplify", target, while }` (`abilities.ts`),
> `amplifyIconsInPlay` and `grantedIcons` (`modifiers.ts`, `rules.ts`), read when a boost card is turned faceup and
> again when its icons are counted (`resolve/enemy-activation.ts`). Wave 3 §3.6, wave 4 §3.57. Not yet granted to a
> villain by its own text.

**Cards.** Unus 45059–45061: "9 — Unus also gains a [amplify] icon." Printed: The Specter of Death 45089.

**Rules.** RRG 1.8 "Amplify Icon" (p. 7): "When a boost card is turned faceup **during an enemy activation**, add one
additional boost icon to that card for each amplify icon in play. Each amplify icon is equivalent to the following
constant ability: 'Each boost card gains [boost].'" MC45 p. 3 repeats it. Ruling January 11, 2026 – Ruling 1 (1).

**Tests.** Unus I (ATK 2), Gene Pool at 9, boost card with 1 printed icon: attack of 4. Gene Pool at 8: attack of 3. A
boost card with 0 printed icons at 9: attack of 3. A minion with villainous attacking at 9: its boost card gains the
icon too ("each boost card"). The Specter of Death and Gene Pool at 9 together: +2 per boost card.

### 3.3 Keywords, an icon and hit points gained at threat thresholds on a named card

> **Status: exists (compose).** `KeywordGrantSpec { keyword, target, while }` and `StatModifierSpec` inside a
> `constant` rule; `Predicate compare` over `ValueSpec threat` of a `named` card; `gainsIcon` (§3.2); `conditional`
> effects inside a When Revealed. One point needs a test, below.

**Cards.** Unus 45059–45061 ("If the amount of threat on Gene Pool is at least: 3 — Unus gains retaliate 1. 6 — Unus
also gains stalwart. 9 — Unus also gains a [amplify] icon."); Infinite Soldier 45069 ("3 — This minion gains
quickstrike. 6 — This minion also gains surge. 9 — This minion also gets +3 hit points."); Infinite Prelate 45067
("3 — Give Unus a tough status card. 6 — Heal 3 damage from Unus as well. 9 — Give Unus an additional boost card for
this activation as well.").

**Rules.** The tiers are cumulative ("also"). They are constant abilities read live (RRG "Ability", p. 4), so they
turn off when threat is removed from Gene Pool. RRG "Stalwart" (p. 40); "Hit Points" (p. 22: "If an ability that says
an ally or minion 'gets +X hit points' ceases to be in effect and causes that ally or minion to have damage on it
equal to or greater than its hit points, that ally or minion is defeated"); "Quickstrike" (p. 36: it resolves after
the minion's When Revealed abilities); "Surge" (p. 42).

**The point to verify.** Infinite Soldier grants itself surge and quickstrike. A minion enters play at step 2 of a
reveal and its When Revealed abilities, keywords included, resolve at step 3 (RRG "Reveal", p. 38), so the constant
ability is active in time. The test must show the engine reads a self-granted reveal keyword there.

**Tests (exact numbers).**

1. Gene Pool 2 → Unus has no retaliate. Place 1 → retaliate 1: a hero's basic attack deals its damage and the hero
   takes 1. Remove 1 → none again.
2. Gene Pool 5 → 6 while Unus has a stunned and a confused card: both are discarded as he gains stalwart; a later
   stun does nothing. Back to 5: he can be stunned again.
3. Infinite Soldier revealed to a hero-form player: at 2 threat no attack, 3 hit points, guard; at 3 it attacks for 2
   after engaging; at 6 the player is also dealt 1 facedown encounter card; at 9 it has 6 hit points.
4. Infinite Soldier with 4 damage at Gene Pool 9; a thwart takes Gene Pool to 8: the soldier (3 hit points, 4 damage)
   is defeated.
5. Infinite Prelate at 2: Unus activates, nothing else. At 9: tough, 3 healed, and two boost cards in that activation
   (order: §4.2 Q8).

### 3.4 A permanent, setup side scheme that stays in play with no threat

> **Status: exists (verify).** `resolve/event.ts` (~line 1685): a permanent side scheme whose last threat is removed
> is not defeated: "nothing is announced, no When Defeated resolves" (owner decision 2026-10-05, wave 7 §4.1, for
> Stryfe's Grasp). The setup keyword at step 11 is covered by `setup-keyword-set-aside.test.ts`. Not yet run for a
> side scheme that is both, in a modular set.

**Cards.** Gene Pool 45071; Hunting Gene Traitors 45062a ("Reveal the Gene Pool side scheme").

**Rules.** RRG 1.8 "Permanent" (p. 32): "cannot be defeated, leave play, or have any part of its text box blanked,
except by card abilities in the same set"; "Setup (Keyword)" (p. 40); Appendix II step 11 (p. 51). MC45 p. 8: "it
always begins the game in play and cannot leave play." Players may thwart it: it is a side scheme (crisis, "each side
scheme" and "defeat a side scheme" effects read it as one; an effect that would defeat or discard it does nothing).

**Tests.** After setup Gene Pool has exactly 4 threat in standard and expert mode with no modular difficulty (§2.2
step 5: the 1A "Reveal" adds nothing). Thwart it to 0: still in play, no `schemeDefeated`, no "after you defeat a side
scheme" response (Cable 40001a) fires. Next villain phase step one: 1 threat. "Discard a side scheme" from a player
card: not a valid target. An ally defeated by an attack: +3; by its own consequential damage: +0. The Infinites set in
another scenario (Rhino): Gene Pool is in play with 4 after setup, with no 1A naming it.

### 3.5 A setup option that belongs to a modular set

> **Status: extend.** Setup options exist per scenario in `@mc/cards` (`checkScenarioSetupOptions`,
> `packages/cards/src/wave4/setup.ts`; Tower Defense's `towerDefenseSetupDamage`, wave 4 §4 Q4) and on the client
> draft (`setup-draft.ts`). None is keyed by an encounter set.

**Rules.** MC45 p. 8, "Modular Difficulty": "If players wish to modify the difficulty of a scenario while using the
Infinites modular set, they may place threat on Gene Pool during setup … The amount of threat placed is up to the
players as a group", with the four recommendations of §2.2 step 4.

**Plan.** A setup option offered whenever the game's encounter sets include `infinites`, whatever the scenario: a
number of threat per player, 0 to 3, placed on Gene Pool after step 11 and before step 12, logged as a setup step
(`setupOptionApplied { option, amount }`) so a replay reproduces it. The value is part of the game's setup config, not
of the scenario. **Off unless the players turn it on (§4.1 Q1 = A):** the value is 0 until a player sets it, and the
mode's recommendation (0, 1, 2 or 3 per player) is only where the control starts when it is turned on. Neither the
builder nor the engine fills the amount in from the difficulty: threat is placed only when the setup config states an
amount, and the log records it. The rulebook's amounts are never applied silently.

**Tests.** 2 players, option 2 per player: Gene Pool 8 after setup, so Unus has retaliate 1 and stalwart at once.
Option 0: 4. Expert mode with the option left off: 4, not 8. The option is absent for a game without the Infinites
set.

### 3.6 Standard III: a counted environment that flips; replacing the Standard set

> **Status: extend.** The card behavior composes from existing vocabulary (table below). The gap is the choice of
> set: `alternateDifficultySetsFor` (`packages/client/src/view/setup-draft.ts`) offers a pack's alternate Standard and
> Expert sets only for that pack's own scenarios, as one switch for both, and Standard III has no Expert partner.

| Card text                                                                                         | Existing vocabulary                                                                                     |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| "After you place a pursuit counter here, if the number of counters here is at least 3 more than…" | `on.countersPlaced`, `counterAtLeast` / `compare` with a player count                                   |
| "remove each counter here → …" (a cost)                                                           | remove-all-counters cost (`remove-all-counters.test.ts`)                                                |
| "if your nemesis minion is in play, it activates against you. Otherwise, flip this card over."    | `exists` with `nemesisMinionOf`, `enemyActivation`, `orElse`, `flipCard`                                |
| "After you flip to this side, find your nemesis minion and reveal it. Search the set-aside area…" | §3.1; the Shadow of the Past script (`core/modular/standard.ts`): `nemesisSideSchemeOf`, `nemesisSetOf` |
| "Place 1 pursuit counter on Pursued by the Past. Then, if it has any counters on it, …"           | `addCounters` on a `named` card, `then`, `counterAtLeast`                                               |
| "the villain schemes" / "the villain attacks you" / "this card gains surge"                       | `enemyScheme`, `enemyAttack`, `gainSurge`                                                               |
| "When Revealed (Alter-Ego) … / When Revealed (Hero) …" (45077)                                    | form-split When Revealed (core Assault)                                                                 |
| "[star] Boost: After this activation resolves, place 1 pursuit counter …"                         | `atEndOfActivation`                                                                                     |
| "Each nemesis minion in play activates against you. If no minions activated this way, place 3 …"  | `enemyActivation` over a query, `eventResult` / a var count                                             |
| "discard an upgrade or support you control" (45079)                                               | `chooseCards` + `discardFromPlay` (a permanent card is no target, RRG p. 32)                            |
| Drawing Near: "After your turn begins, discard the top card of your deck. Place 1 … for each…"    | `on.yourTurnBegins`, deck discard, `totalPrintedResources`                                              |
| "Alter-Ego Action: Discard an identity-specific card from your hand → discard this card."         | `discardFromHand` cost with a classification filter; wave 7 §3.70                                       |

**Rules.** MC45 p. 3 (§2.5). RRG 1.8 "Standard Set" (p. 40), "Nemesis Encounter Set" (p. 30), "All-Purpose Counter"
(p. 6), "Permanent" (p. 32: the environment flips by its own text, which is "the same set"). Ruling June 25, 2026 –
Ruling 4 (3): "Environments flip, they are not revealed", so flipping raises no When Revealed and no "revealed"
trigger.

**As read.**

- Placing several counters at once (Evil Alliance's 3; Drawing Near's one per icon) is one placement and one check.
- The Forced Response resolves after the placement and before the treachery's "Then" sentence (§4.2 Q2).
- "The number of players": §4.2 Q3.
- "Your nemesis minion" is the acting player's own (`nemesisMinionOf: you`). In play engaged with someone else, it
  still "activates against you". With no nemesis set in the game (`usesIdentityEncounterSets: false`), 45075a's
  "Otherwise" flips the card and 45075b finds nothing, shuffles nothing and flips back.
- After the first flip the nemesis set is in the game. A later reset with the minion in a deck or discard pile finds
  it there and reveals it; with the minion in play it activates and the card does not flip.

**Plan for the choice.** `EncounterSet.classification: "standard"` already marks the set. The scenario builder's
standard set argument takes `standard_iii` for any scenario whose `standardEncounterSetIds` is `[standard]`; the
Expert set is unchanged. The setup screen offers it wherever §4.2 Q10 says.

**Tests (exact numbers, 1 player, threshold 4).**

1. 0 counters, Dark Designs revealed: 1 counter, the villain schemes.
2. 3 counters, Dark Designs revealed: the fourth counter resets the card to 0; nemesis not in play, so it flips, the
   nemesis minion and side scheme are revealed, the rest of the set is shuffled in, the card flips back; then "if it
   has any counters on it" is false and the villain does not scheme (Q2 = A).
3. 3 counters, nemesis minion in play: reset to 0, the minion activates against the revealing player, no flip.
4. 4 players: nothing at 6 counters, reset at the seventh.
5. Evil Alliance with no nemesis minion in play: 3 counters. With one in play: it activates, 0 counters.
6. Drawing Near: top card prints two resource icons → 2 counters; a card with none → 0 and no check.
7. Sinister Strike in alter-ego at 0 counters: 1 counter and surge. In hero form: 1 counter and the villain attacks.

### 3.7 Villains in a random row; the active counter passes to the next in the row

> **Status: extend.** In the engine: `Scenario.multipleVillains`, `GameState.activeVillainId`, `setActiveVillain`
> (logged `activeVillainChanged`), `addVillain` for set-aside villains, `moveActiveCounter { to:
"nextInActivationOrder" }` and `nextVillainInActivationOrder` (`query.ts`; The Sinister Six, wave 5 §3.1), which
> orders by a printed "Activation Order X". The Horsemen print none: their order is where they sit.

**Cards.** The Horsemen of Apocalypse 45085a ("reveal them in a row from left to right. Place the active counter on
the leftmost villain") and 45085b; Rough Riders 45096 ("Move the active counter to the next villain"); Metal Wings
45091 ("Attach to Death and move the active counter to him").

**Rules.** MC45 p. 11, "Active Villain" and "Multiple Villains" (§2.3). RRG 1.8 "All-Purpose Counter" (p. 6).

**Plan.**

- **`GameState.villainRow: readonly InstanceId[]`**: the villains in play, left to right, explicit state. A villain
  joins at the right end when it enters play and leaves the row when it leaves play; a villain at 0 hit points that is
  not defeated stays in it. Empty or absent in every earlier scenario.
- **Setup.** The 1A Setup takes the set-aside villains in a random order (the seeded RNG; logged
  `villainRowSet { order }`), adds each (`addVillain`), and sets the first active.
- **`moveActiveCounter { to: "nextInRow" }`**: from the villain holding the counter to the one after it in
  `villainRow`, wrapping; with one villain in the row it stays. Logged `activeVillainChanged { reason: "nextInRow" }`.
- "Move the active counter to him" (45091) is the existing `setActiveVillain`.
- The villain phase reads the active villain afresh for each player's activation (step 2 is "once per player, in
  player order", RRG p. 6), so with 1B the Horsemen take turns across the players.

**Tests (exact numbers).** Row [War, Famine, Pestilence, Death], hero form.

1. 1 player: round 1 War attacks, the counter goes to Famine; round 2 Famine; round 5 War again.
2. 2 players: round 1 War attacks player 1, Famine attacks player 2, the counter ends on Pestilence.
3. Rough Riders with the counter on Death: Death's Forced Response, the counter wraps to War, War's Forced Response.
   The counter moved once; no villain activated, so 1B does not move it again.
4. Metal Wings revealed with the counter on War: attached to Death, counter on Death.
5. Same seed, same row; a replay of the log rebuilds the row from `villainRowSet`.

### 3.8 "After a villain activates" with several villains

> **Status: exists (verify).** `on.enemyActivates` (after an `enemyAttack` or `enemyScheme` resolves) with a villain
> source; nested activations wait for the current one and its triggered abilities (RRG "Activation", p. 6;
> `resolve/enemy-activation.ts`). Not run with a counter that moves on every activation.

**Cards.** 45085b; Horseman of War / Famine / Pestilence / Death 45092–45095; Sinister Strike, Dark Designs (the
villain attacks or schemes from a treachery).

**Rules.** RRG 1.8 "Activation" (p. 6): "Whenever an enemy attacks or schemes, it is considered to have activated …
If an effect initiates an activation during the resolution of another activation, the newly initiated activation
resolves after the current activation has finished resolving … All abilities triggered by the initial activation
resolve before subsequent activations initiate." "Stun, Stunned" (p. 41): "that character is not considered to have
attacked"; "Confused" (p. 13) likewise for a scheme.

**As read.**

- 1B hears every villain activation: the step two activations, and one a treachery or boost ability starts.
- It moves the counter one place from the villain that **holds** it, whichever villain activated (§4.1 Q5 = A,
  firm). The owner cites an FFG ruling on Hall of Heroes' post-RRG-1.5 rulings page; that page is not in this repo
  and was not read for this spec, so the code comment cites the owner's decision and the card, not the ruling.
- An activation replaced by a stunned or confused card is not an activation, so the counter does not move (§4.2 Q4).
- Overkill from an attack that defeats a minion is dealt to the villain with the active counter (RRG p. 62 FAQ).

**Tests (exact numbers).** Row [War, Famine, Pestilence, Death], 1 player, counter on War.

1. Horseman of Death revealed in step four: Death heals 2, gets a tough card, attacks; the counter goes War → Famine.
2. War attacks with Horseman of Famine as his boost card: War's attack finishes; 1B moves the counter to Famine; then
   Famine activates with no boost card; 1B moves it to Pestilence. Next round Pestilence is active.
3. War stunned (one stunned card, no steady): the stunned card is discarded, no attack, counter still on War.
4. A hero's overkill attack defeats a Hound with 3 excess while the counter is on Famine: Famine takes 3.
5. **Q5, the owner's test.** Row [Death, Pestilence, War, Famine], counter on Death. Horseman of War is revealed in
   step four: War heals 2, gets a tough card and attacks. After War's activation the counter moves from Death to
   Pestilence, the villain immediately right of Death. It does not go to Famine, War's neighbor, and it does not
   stay. Next round Pestilence is the active villain.

### 3.9 Villains that cannot be defeated while another has hit points

> **Status: exists (verify).** `RuleSpec cannotBeDefeated { target, while }` (`abilities.ts`): "a matching character
> at zero remaining hit points is not defeated". `resolve/defeat.ts` (~line 570) decides every villain's defeat before
> any applies and already names "the Four Horsemen, `aoa` 45081–45084" beside Tower Defense's Proxima Midnight and
> Corvus Glaive (wave 4 §3.3). Built for two villains; not run with four, with healing from 0, or with §3.10.

**Cards.** War, Famine, Pestilence, Death 45081–45084 a/b: "[Name] cannot be defeated while another villain has at
least 1 hit point."

**Rules.** RRG 1.8 "'Cannot'" (p. 11, absolute); "Defeat" (p. 15); "Hit Points" (p. 22: a villain's dial is its
remaining hit points); ruling June 2, 2026 – Ruling 2 (1) (damage to several enemies is simultaneous). RRG "Text Box"
(p. 44) and "When Revealed Abilities" (p. 48: "Alternate win or loss conditions cannot be blanked or canceled") do
not reach this line: it is a constant ability, and a villain's text is not blanked by any card of this pass.

**As read.** A Horseman at 0 stays in play: it holds its place in the row, takes the counter, activates with its
printed ATK or SCH, keeps attachments and status cards, can be attacked (damage past 0 changes nothing: the dial
stops at 0) and can be healed. Its [star] Forced Response is off ("if he has at least 1 hit point") unless §3.10
applies. When the last villain above 0 reaches 0, the condition is false for all four at once; all four are defeated
in one step and `allVillainsDefeated` ends the game as a win.

**Tests (exact numbers).** 1 player, standard: four villains at 9.

1. 9 damage to War: War at 0, in play, no `characterDefeated`. 5 more damage to War: still 0.
2. War at 0 attacks: 2 damage plus boost; the player discards no upgrade or support.
3. Horseman of War with War at 0: War at 2 with a tough card, then he attacks and the player discards an upgrade.
4. War, Famine, Pestilence at 0, Death at 3; an attack deals 3 to Death: four `characterDefeated` events in one
   step, the game is won. An attack that deals 2: nobody falls.
5. Death at 1, the rest at 0, an "each enemy" 1-damage effect: all four fall together.

### 3.10 "Is considered to have at least 1 hit point"

> **Status: new.** Nothing in the engine or the raw data of any earlier pack reads a floor on remaining hit points
> (searched "considered to have" across every raw cache: no earlier card).

**Cards.** Golden Horse 45090 ("Attached villain gains the [AERIAL] trait and is considered to have at least 1 hit
point"); Metal Wings 45091 ("Death gains retaliate 1 and is considered to have at least 1 hit point remaining");
Rough Riders 45096 ("as if it has at least 1 hit point").

**Rules.** RRG 1.8 "Remaining Hit Points" (p. 36); "Hit Points" (p. 22); "Defeat" (p. 15: "If a character has zero or
fewer remaining hit points … it is defeated").

**Plan.** **`RuleSpec consideredRemainingHp { target, atLeast, while? }`**: every _reading_ of a matching character's
remaining hit points returns at least `atLeast`; the dial and the damage on the card are untouched. Read by
`ValueSpec remainingHp`, by the predicates built on it ("if he has at least 1 hit point", "while another villain has
at least 1 hit point") and, with §4.2 Q6 = A, by the defeat check. Hosts that rank by remaining hit points (§3.14)
read the true dial, so a second Golden Horse still goes to the villain that is really lowest. The rule's presence is
shown in the villain's inspect data (`consideredHp: 1`) so a player can see why nobody fell.

**Tests (exact numbers, Q6 = A).**

1. War at 0 with Golden Horse attacks: the player discards an upgrade or support.
2. All four at 0, Golden Horse on Famine: nobody is defeated. The player attacks Famine and uses Golden Horse's
   response (discard 10, discard the horse): all four fall, the game is won.
3. Metal Wings on Death at 4: an attack on Death deals its damage and the attacker takes 1 (retaliate 1).
4. Golden Horse on War: War has the Aerial trait; a second Golden Horse cannot attach to War.

### 3.11 Another card's Forced Response resolved "as if it just attacked you"

> **Status: extend.** `EffectSpec resolveSpecials { cards | of, player, trigger }` resolves a card's printed
> abilities by kind, `trigger: "special" | "whenRevealed" | "whenDefeated"`, with the resolving player as "you" and no
> event behind them (wave 4 §3.46, §3.56; wave 6 §3.17). It has no Forced Response case and no way to set a condition
> aside. As a **cost**, wave 7 §3.19 (b) built "an enemy attacks you →" (`AbilityCost.enemyAttack`).

**Cards.** Golden Horse 45090: "Hero Response: After you attack attached villain, resolve its 'Forced Response' as if
it just attacked you → discard this card." Metal Wings 45091, the same for Death. Rough Riders 45096: "Resolve the
'Forced Response' on the active villain as if it has at least 1 hit point and attacked you. Move the active counter to
the next villain and resolve its 'Forced Response' the same way."

**Rules.** RRG 1.8 "Cost" (p. 13: "pay cost → resolve effect"); "Self-Referential" (p. 39); "You, Your" (p. 49).

**Plan.**

- **`resolveSpecials.trigger: "forcedResponse"`**, with `abilities` naming the ability by ref id as the Special form
  already allows. The ability's effects resolve with `player` as "you" and the named card as its source; nothing is
  logged as an attack, so "after [villain] attacks" on other cards (Prelate Sidearm is not in this scenario; a hero's
  "after an enemy attacks you") does not fire.
- **`asIf: { remainingHpAtLeast?: number }`** on the same effect: while these effects resolve, §3.10's floor applies
  to the source. Rough Riders passes 1. Golden Horse and Metal Wings pass none: their own constant text supplies it.
- **As a cost**: `AbilityCost.resolveAbility { of, trigger: "forcedResponse" }`, paid by resolving it; the settle step
  follows `settleEnemyAttackCost`'s pattern (a cost that did not happen is not paid). When it counts as paid: §4.2 Q7.
- Only the villain's printed Forced Response is resolved, not one an attachment gives it.

**Tests (exact numbers).**

1. Golden Horse on Famine (at 5), player's deck 20 cards: after a basic attack on Famine the response is offered;
   used, 10 cards are discarded, the horse is discarded, Famine has not attacked (no boost card, no damage).
2. Rough Riders, counter on Pestilence at 0, next is Death at 0: the identity's text box is blank until the next
   villain phase begins; the counter is on Death; 1 damage to the identity and to each ally the player controls.
3. Golden Horse on War, the player controls no upgrade or support: per Q7.

### 3.12 A named enemy activates; no boost card; "after this activation"; extra boost

> **Status: exists (compose).** `enemyActivation` / `enemyAttack` / `enemyScheme` against a player by any named
> enemy, `boost: false` and the `noBoost` modifier (Master Mold, wave 6 §3.15), `extraBoostCards`, `atEndOfActivation`
> (delayed effects of a boost ability), `chooseOne` inside a Boost.

**Cards.** Infinite Prelate 45067 ("Unus activates against you … Give Unus an additional boost card for this
activation as well"); Horseman of War / Famine / Pestilence / Death 45092–45095 ("Heal 2 damage from War and give him
a tough status card. He activates against you." / "[star] Boost: After this activation, War activates against you. Do
not give War a boost card for that activation."); Infinite Hunter 45065 ("[star] Boost: Choose to either place 2
threat on Gene Pool, or the activating enemy gets +2 SCH and +2 ATK for this activation"); Culling the Weak 45070.

**Rules.** RRG 1.8 "Activation" (p. 6): a hero-form player is attacked, an alter-ego player is schemed against;
"Boost" (p. 11); "Choose (Option)" (p. 12): both of Infinite Hunter's options are always available (neither needs a
target that can be missing; Gene Pool is permanent). The player the activation is against chooses.

**Tests.** Horseman of War as a boost card on Famine's attack: after it, War attacks with exactly his printed ATK (2
on side A) plus attachments, no boost card. Infinite Hunter as Unus's boost card (0 printed icons; a star): option 2
makes Unus I attack for 4; option 1 leaves 2 and adds 2 to Gene Pool. Infinite Hunter's When Revealed: 3 damage to one
ally the revealing player controls; none controlled, nothing happens.

### 3.13 An identity's text box blanked "until the next villain phase begins"

> **Status: extend.** The lasting `EffectSpec blankTextBox { target, until: LastingUntil }` exists (Edison's Giant
> Robot), and the identity semantics exist on the constant form (`RuleSpec blankTextBox` on an identity, wave 7 §3.19,
> §4.1 Q12 = A: the blank is on the card, both faces, traits kept). `LastingUntil` is `endOfPhase | endOfRound |
endOfAttack | endOfTurn`: none ends where a phase **begins**.

**Cards.** Pestilence 45083a/b: "treat your identity's text box as if it were blank (except for [TRAITS]) until the
next villain phase begins." Plague and Pestilence 45088: "The player who defeated this scheme treats their identity's
text box as if it were blank (except for [TRAITS]) until the next villain phase begins."

**Rules.** RRG 1.8 "Text Box" (p. 44), "Traits" (p. 45), "Star Icon" (pp. 40–41: a star value whose text is blank is
0). A round is the player phase then the villain phase, so "end of the round" is the wrong moment: an effect made in
villain phase N must last through all of player phase N+1.

**Plan.** `LastingUntil` gains `"nextVillainPhaseBegins"`: the effect expires as the next villain phase starts, before
its step one. Made during a villain phase, it lasts the rest of that phase and the whole following player phase; made
during the player phase (45088 defeated by a thwart; Golden Horse's response on Pestilence), until that round's
villain phase starts. The lasting effect on an identity uses the constant form's semantics unchanged.

**Tests.** Pestilence attacks Spider-Man in round 1's villain phase: Spider-Sense cannot trigger for the rest of that
phase or in round 2's player phase; hand size, stats and traits are unchanged; in round 2's villain phase it triggers
again. A second blank from 45088 during round 2's player phase ends at the same moment as the first.

### 3.14 Attach hosts of this pass; an attachment that moves the active counter

> **Status: exists (verify).** Every host is an existing `AttachmentHost` kind (§1.9). "Otherwise, this card gains
> surge" has 25 earlier cards (Gene Therapy `cyclops` 33030), "Boost: Attach this card to …" has 12 (Adamantium Claws
> `mut_gen` 32067). New here only in combination: a `superlative` host among several **villains** by lowest remaining
> hit points with a trait excluded.

**Cards.** Golden Horse 45090 ×3; Metal Wings 45091; Genetic Experiments 45066 ("Attach to an [INFINITE] minion.
Otherwise, this card gains surge." / "[star] Boost: Attach this card to an [INFINITE] minion."); Ahab's Energy Spear
45099 ("Attach to Ahab. Otherwise, attach to the villain."); Prelate Sidearm 45063, Prelate Armor 45064.

**Rules.** RRG 1.8 "Attach To" (p. 8): "If the initial 'attach to' check does not pass, the card is not able to be
attached … If such a card cannot remain in its prior state or game area, discard it." The RRG has no entry on a tie
between hosts; `attachment-hosts.ts` returns every tied card and a player chooses, and the test pins which player.

**As read.** Golden Horse ranks villains by the dial (§3.10), a villain at 0 included. With every villain Aerial
(Death, and three horses on the others) a fourth cannot exist: there are three copies. Ahab's Energy Spear with no
Ahab attaches to the active villain, as "the villain" on an encounter card (MC45 p. 11).

**Tests.** Villains at 9, 4, 4 (Death), 6: Golden Horse goes to the non-Aerial villain at 4. Two non-Aerial villains
tied at 4: a choice between exactly those two is asked. Genetic Experiments revealed with no Infinite minion in
play: discarded, surge. As a boost card with two Infinite minions in play: the player the activation is against
chooses one; it has +2 hit points; defeated, Gene Pool gains 2 before the minion leaves play. Ahab's Energy Spear on
Ahab: his attack is 5 with overkill and piercing (a tough card on the defender is discarded first), and the spear is
discarded at the end of that attack; revealed with Ahab not in play in the Four Horsemen: attached to the villain
holding the counter.

### 3.15 A random side scheme of a set revealed by each player at setup

> **Status: exists (verify).** `forEachPlayer`, a `CardSelector` over the encounter deck with a query and `random`
> (`spec.ts` ~line 3721), `revealCard`, `shuffleEncounterDeck`. Not run for a reveal during setup step 12a.

**Cards.** The Horsemen of Apocalypse 45085a.

**Rules.** RRG 1.8 Appendix II step 12 (p. 51); "When Revealed Abilities" (p. 48: one that enters play during setup
resolves in that step); "Search" (p. 39). The four side schemes print no When Revealed; their icons count from the
first villain phase (the hazard icon of 45086 deals one more encounter card in step three).

**Tests.** 2 players, fixed seed: exactly two of 45086–45089 in play with 6 threat each, the other two in the
encounter deck, the deck shuffled once. 4 players: all four in play.

### 3.16 A forced change to hero form; the first copy revealed each phase gains surge

> **Status: exists (verify).** `EffectSpec changeForm` ("It never uses the once-per-round form change"; nine earlier
> cards change a player to hero form, Claustrophobia `storm` 36030); `RuleSpec firstRevealGainsSurge {
cards, each: "phase" }`; `dealAsEncounterCard` for a named card taken from the deck or discard pile (wave 7 §3.38).

**Cards.** Hound 45098 ("Guard. When Revealed: If you are in hero form, Hound attacks you. Otherwise, change your
identity to hero form."); Release the Hounds 45100 ("The first copy of Hound revealed each phase gains surge. When
Defeated: The player who defeated this scheme searches the encounter deck and discard pile for a copy of Hound and
deals it to themself as a facedown encounter card.").

**Rules.** RRG 1.8 "Form, Change Form" (p. 21); "Surge" (p. 42); "When Defeated Abilities" (p. 48). "The player who
defeated this scheme" when no player did follows the owner's wave 7 answer (§4.1 Q2 there: the When Defeated resolves
with no player as its source; here nobody is dealt the Hound).

**Tests.** Hound revealed to a hero: it attacks for 2. To an alter-ego: the identity flips to hero form, "after you
change to hero form" responses may trigger, the player's own once-per-round change is still available, and Hound does
not attack. With Release the Hounds in play, two Hounds revealed in one villain phase: the first deals 1 more
encounter card, the second does not; a Hound revealed in the following player phase (by an effect) gains surge again.
Release the Hounds defeated by a thwart with one Hound in the discard pile: that player has it facedown, revealed in
the next step four.

### 3.17 Reusable as is (checked against the engine unions)

| Card text                                                                                            | Existing vocabulary                                                                                                                          |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Featured keywords (MC45 p. 3): hinder, teamwork, victory, villainous, patrol, permanent, piercing, … | wave 2 (permanent, piercing, ranged, setup, villainous), wave 3 (hinder, patrol, stalwart, victory), wave 4 (steady), wave 6 §3.1 (teamwork) |
| "The victory display is an out-of-play game area shared by all players" (MC45 p. 3)                  | `GameState.victoryDisplay`; wave 7 §3.49                                                                                                     |
| "After resolving step one of the villain phase, place 1 threat on Gene Pool" (45062b)                | `on.villainStepResolved` (wave 7 §3.21), `placeThreat` on a `named` card                                                                     |
| "If this scheme / stage is completed, the players lose the game" (45062b, 45085b)                    | the final stage's loss (RRG p. 27); one stage each                                                                                           |
| "In expert mode, deal each player a facedown encounter card" (45062a)                                | `inMode`, `forEachPlayer`, `dealEncounterCard`                                                                                               |
| Toughness on each Unus stage; on Ahab                                                                | keyword                                                                                                                                      |
| "After Unus attacks and defeats an ally, place 1 threat on Gene Pool" (45063)                        | `on.villainAttacks` with `requireResults: { defeated: 1 }` and an ally target                                                                |
| "After Unus schemes, give him a tough status card" (45064)                                           | `on.enemySchemes`, `giveStatus`                                                                                                              |
| "Hero Response: After you make a basic attack against Unus, spend [energy] [physical] resources → …" | `on.attacks` with `attackKind: "basic"` and the host as target; typed `spendResources` cost                                                  |
| "After an ally is defeated by anything other than consequential damage, place 3 threat here" (45071) | `on.defeated` with `consequential: false` (wave 6 §3.57)                                                                                     |
| "When Defeated: Place 3 threat on Gene Pool" (45068); "When Revealed: Place 4 …" (45070)             | `whenDefeated`, `placeThreat`                                                                                                                |
| "Forced Interrupt: When attached minion is defeated, place 2 threat on Gene Pool" (45066)            | `on.attachedCardDefeated`                                                                                                                    |
| "You are stunned. If you were already stunned, take 2 damage instead." (45073)                       | 24 earlier cards (Waylay `gam` 18028): `hasStatus`, `giveStatus`, `orElse`                                                                   |
| "The player who defeated this scheme confuses their identity" (45074) and 45086–45089                | `defeatingPlayer`, `giveStatus`, `discardFromPlay`, deck discard, `dealDamage` over a query                                                  |
| "Alter-Ego Action: Discard a card from your hand → discard this card" (Hunted 45072), a hazard icon  | wave 7 §3.70, §3.63                                                                                                                          |
| "discard the top 10 cards of your deck" (Famine 45082, 45087)                                        | deck discard; RRG "Player Deck" (p. 33): an emptied deck reshuffles, no further cards are discarded                                          |
| "deal 1 damage to each character you control" (Death 45084, 45089)                                   | `dealDamage` over `controller: you` characters, simultaneous                                                                                 |
| "discard an upgrade or support you control" (War 45081, 45086, 45079)                                | `chooseCards` + `discardFromPlay`; permanent cards are no target                                                                             |
| "this attack gains overkill and piercing. At the end of this attack, discard [this]" (45099)         | `modifyAttack.keywords`, `atEndOfAttack`                                                                                                     |
| "If Release the Hounds is in play, place 3 threat on it. Otherwise, find …" (45097)                  | `conditional` on `exists(named)`; §3.1                                                                                                       |
| Death gains retaliate 1 (45091); attached villain gains the Aerial trait (45090)                     | `KeywordGrantSpec`, `TraitGrantSpec`                                                                                                         |
| "Heal 2 damage from War and give him a tough status card" (45092)                                    | `heal` and `giveStatus` on a `named` villain, active or not                                                                                  |

**One exact-number test for the deck rule.** Famine attacks a player with 7 cards in their deck: 7 are discarded, the
discard pile is shuffled into a new deck, the player is dealt 1 facedown encounter card, and no further card is
discarded (7, not 10).

### 3.18 A villain's next stage revealed when the main scheme is completed

> **Status: extend.** The trigger exists: `on.mainSchemeCompleting` (wave 4 §3.4; Tower Defense `mts` 21098b, MaGog,
> Juggernaut, and a player card in wave 7 §3.54), an interrupt window opened when a stage reaches its target, whose
> apply step (`applyMainSchemeCompleting`, `resolve/defeat.ts`) completes the stage only "if it still would be".
> `removeThreat { ignoreCrisis }` and `endGame` exist. **Missing:** an effect that reveals a villain's next stage with
> no defeat. Stages change today only through `checkDefeats` and `advanceToSetAsideVillain` (wave 4 §3.7).

**Cards.** Apocalypse I, II, III (45101a, 45101b, 45102a): "Forced Interrupt: When the main scheme is completed,
remove all threat from it (ignoring any crisis icons). Flip this card and reveal Apocalypse (II)." (II: "Remove this
card from the game and reveal Apocalypse (III)."; III: "Flip this card and reveal Apocalypse (IV).") Apocalypse IV
(45102b): "Forced Interrupt: When the main scheme is completed, the players lose the game."

**Rules.** RRG 1.8 "Main Scheme, Main Scheme Deck" (p. 27: "If the villain completes the final stage of the main
scheme deck, the villain wins the game"); "Villain Defeat" (p. 47), the only RRG text on revealing a stage: "The next
sequential stage of the villain deck is revealed. Set the villain's hit point dial as indicated by that stage … The
revealing of a villain cannot be canceled", and for a new stage with the same title "Attachments, upgrades, status
cards, counters, and non-damage tokens on a villain carry over"; "Toughness" (p. 45); "Crisis Icon" (p. 14); "'Would'"
(p. 48: an interrupt without "would" resolves after those with it).

**Plan.** **`EffectSpec revealNextVillainStage { villain }`**: the stage change of a villain defeat without the
defeat. The villain keeps its instance; the next sequential stage in the game's `villainStages` range becomes its
card; the old stage is removed from the game; the dial is set to the new stage's hit points (§4.2 Q11); attachments,
upgrades, status cards and counters stay; toughness and any When Revealed of the new stage resolve. No
`characterDefeated`, no When Defeated, no "after the villain is defeated" window. Logged as `villainStageRevealed`
with the two stage numbers and `cause: "effect"`. With no next stage it does nothing. "Flip this card" and "Remove
this card from the game" are the same effect: they describe which piece of cardboard carries the next stage.

**As read.**

- The interrupt removes the threat, so the apply step finds the stage below its target: nothing is completed, no When
  Completed resolves, the stage does not advance and nobody loses. The new stage raises the target at once (§3.19).
- It listens to the main scheme only (`query("mainScheme")`), not to a side scheme.
- A "would be completed" interrupt of a player card resolves first (RRG p. 48); if it removes the threat, Apocalypse's
  interrupt has nothing left to hear.
- "Remove all threat" does not step over a "threat cannot be removed from the main scheme" rule a custom modular set
  might bring (RRG "'Cannot'", p. 11). The stage is still revealed, the threat stays, the stage is then completed, and
  the one-stage deck loses the game. No set of this box does this.
- Apocalypse IV's line is the final stage's ordinary loss with the villain as its source.

**Tests (exact numbers, standard, Q11 = A).**

1. 1 player, Apocalypse II with 4 damage, a stunned card, Cyberpathy attached and no tough card; main scheme at 8.
   Step one places 1 (no icons): 9 ≥ 9. After the interrupt: main scheme 0; Apocalypse III in play (SCH 2 + 1, ATK 3)
   with 10 hit points and no damage, the stunned card, Cyberpathy and one tough card; target 10; the log has
   `villainStageRevealed` and no `mainSchemeCompleted` and no `characterDefeated`. He then activates as stage III.
2. The same with The Apocalypse Solution in play (a crisis icon): the threat is still removed.
3. 3 players, stage II: nothing at 26; at 27 stage III is revealed and the target is 30.
4. Expert, 1 player: stage III at 10 reveals IV (SCH 3, ATK 3, overkill, stalwart: a stunned card on him is discarded);
   stage IV at 11: the players lose.
5. The easier start (Q12): stage I at 8 reveals II (9 hit points).

### 3.19 A target threat of X per player, X read from the villain's printed hit points

> **Status: extend.** `MainSchemeStage.printedX` with a `setBase` modifier on a `SchemeValueName` (`mainSchemeValue`,
> `query.ts`; wave 1 §3.8; Mutagen Cloud 2B's X acceleration) exists, and so does `ValueSpec printedHp { of }`
> (`select.ts`). But `printedHp` of a villain is "its stage's printed value scaled per player"; the card asks for the
> **numeral**.

**Cards.** The Age of Apocalypse 45103b ("X is the numeral in Apocalypse's printed hit point value": the target
X[per_hero], and "Remove X threat from this scheme"); The Apocalypse Solution 45111 ("Discard the top X cards of the
encounter deck, where X is the numeral in Apocalypse's printed hit point value").

**Rules.** RRG 1.8 "Printed" (p. 35); "Per Player Icon" (p. 32); "Target Threat" (p. 43); "Encounter Deck" (p. 17).

**Plan.** `printedHp { of, numeral: true }`: the number printed before the per player icon (`hp.perPlayer` for a per
player value, else `hp.base`), read from the villain's current stage, never modified. 1B's script sets the base of
`targetThreat` to the numeral times the players who started the scenario; the removal and the discard use the bare
numeral.

**Tests (exact numbers).** Stage II, 1 player: target 9. Stage II, 3 players: target 27; "remove X" removes 9. Stage
III, 3 players: 30 and 10. The Fittest's +5 hit points on a minion and a hit point modifier on the villain change
nothing. The Apocalypse Solution defeated at stage IV with 20 cards in the encounter deck: 11 discarded; with 6 cards:
6 discarded, the discard pile becomes the deck, one acceleration token, and no more are discarded (RRG p. 17).

### 3.20 "When [the villain] would be defeated … instead", printed on the main scheme

> **Status: exists (compose).** A villain's defeat is "an event with an interrupt window when an ability could react to
> it" (`checkDefeats`, `resolve/defeat.ts`; wave 3 §3.1), with `would` priority (`abilities.ts`) and `instead`; 21
> earlier cards print "would be defeated … instead" (Batroc `aos` 50086a: "reset his hit points to 8 instead. Then,
> remove 6 threat from the main scheme"). Here the ability sits on the main scheme and discards attachments first.

**Cards.** The Age of Apocalypse 45103b.

**Rules.** RRG 1.8 "Replacement Effect" (p. 37: "it is no longer considered imminent and no further interrupts or
responses to that effect can be triggered"); "'Would'" (p. 48); "Attachment" (p. 8). MC45 p. 14.

**As read.**

- "Each attachment" is each card of the attachment type on him. A player's upgrade attached to him is an upgrade and
  stays; status cards and counters stay.
- He is not defeated: no "after the villain is defeated" response, no new stage, no tough status card (he does not
  enter play), and excess damage is lost.
- The threat removal is the scheme's own, by no player; X is the bare numeral (§3.19) and the scheme stops at 0.
- The order is printed: attachments, heal, threat.

**Tests (exact numbers).** 1 player, stage II (9 hit points) with Cyberpathy and Molecular Control attached and a
confused card, main scheme at 7. An attack deals 12: both attachments are discarded (he loses retaliate 1 and
stalwart), he has 0 damage and 9 hit points, the confused card stays, the main scheme is at 0, stage II is still in
play with no tough card. 3 players, main scheme at 20: 11 left.

### 3.21 An attachment that ignores a named ability; winning when the villain falls

> **Status: new** (the ignore). `ignoreBoost` (`abilities.ts`, wave 7 §3.67) is the only "ignore" rule; nothing makes
> the game ignore one printed ability of another card, and no earlier card prints "Ignore the …" as a constant line
> (searched every raw cache). The rest exists: `cannotTakeDamage { target, while }` (Ultron, core 01136), `endGame`
> with a win and `Scenario.victory: "cardAbility"` (M.O.D.O.K. `aos` 50103a), `flipCard { reveal }` onto another card
> type (wave 4 §3.10, wave 7 §3.34).

**Cards.** No Longer Worthy 45105b (text in §2.7).

**Rules.** RRG 1.8 "Ignore" (p. 23: an ignored ability is treated "as not being in effect or present"); "Flip" (p. 20:
a new face of a different card type discards "all attached cards, tucked cards, status cards, and tokens"); "Double-
Sided Card" (p. 17: leaving play, it "is removed from the game"); "Winning the Game" (p. 48). MC45 p. 14: "When
Apocalypse would be defeated, **if No Longer Worthy is not attached to him**, the players must resolve the Forced
Interrupt on The Age of Apocalypse 1B".

**Plan.** **`RuleSpec ignoreAbilities { on: TargetQuery, abilities: readonly AbilityId[], while? }`**: while the rule
is in effect, the named abilities of the matching cards neither trigger nor resolve. Here: the main scheme's one
Forced Interrupt, named by ref id, so the "X is the numeral …" line and the target stay. The card's own interrupt
(`on.defeated` of the host, `endGame` win) ends the game at any stage.

**As read.**

- Only the interrupt printed **on the main scheme** is ignored. Apocalypse's own (§3.18) is not.
- The Tyrant's Throne's When Defeated resolves in printed order: the fourth Prelate is revealed before No Longer
  Worthy attaches, so Apocalypse cannot take damage until that Prelate is defeated.
- If No Longer Worthy leaves play it is removed from the game and cannot return. A player card may legally discard
  it (§4.1 Q13 = A), which can leave the scenario unwinnable, and no rule asks for a confirmation: the engine offers
  it as a legal choice like any other attachment. The confirm step before a player's card discards it is this
  project's own warning, built in the client and worded as ours, not as a rule of the game (§5.1).

**Tests (exact numbers).** 2 players, Apocalypse III (20 hit points) with 14 damage; The Tyrant's Throne is defeated:
a Prelate engages the first player, player 2 is dealt 1 facedown encounter card, No Longer Worthy is attached and he
has 4 damage. An attack for 6 with the Prelate in play: 0 damage. Prelate defeated, then 16 damage: no heal, the game
is won. Main scheme reaching 20 with No Longer Worthy attached: stage IV is revealed, No Longer Worthy still attached.

### 3.22 Chained side schemes locked while a trait's minion is in play

> **Status: exists (verify).** Hela's chain is the same build (wave 4, `packages/cards/src/wave4/mts/hela.ts`: side
> schemes revealed in turn by the first player, each with a minion that "engages the first player" and a "threat
> cannot be removed" line). Pieces: `RuleSpec threatCannotBeRemoved { target, while }`; the `encounterSetAside` card
> selector with `filter` and `random`, and `revealCard(…, firstPlayer)`; `flipCard` onto an `otherFaceId` face, which
> "is then treated as entering play: a side scheme gets its starting threat" (`resolve/other-face.ts`; owner decision
> wave 4 §4 Q17); `flipCard { reveal }`. Not run: a `while` over a trait's minion, a random pick by trait.

**Cards.** Heart of the Empire 45104a ("… Flip this card over."), The Towering Citadel 45104b ("… Reveal The Tyrant's
Throne side scheme and remove this card from the game."), The Tyrant's Throne 45105a ("… Flip this card over and
reveal No Longer Worthy."); the Prelates 45179b–45183b ("[Name] engages the first player.").

**Rules.** RRG 1.8 "'Cannot'" (p. 11); "Side Scheme" (p. 40); "Flip" (p. 20); "Engage" (p. 18: "Unless otherwise
specified by the minion … the minion engages the player who is resolving the current encounter card"); "Victory X"
(p. 46); "Deal" (p. 15); "When Defeated Abilities" (p. 48). Ruling April 30, 2026 – Ruling 4 (2).

**As read.**

- The lock is a "cannot": thwarts, events, allies and supports remove nothing from a locked scheme, and a locked
  scheme is not a legal target for a removal. An effect that defeats or discards a side scheme without removing threat
  is not a removal (`threatCannotBeRemoved`'s own doc) and still works.
- Every Prelate is revealed by the first player, so "engages the first player" is true by construction, as for
  Garm (`mts` 21143); the script still carries Dreadpool's form (`deadpool` 44038: a forced interrupt on
  `on.entersPlay(self)` that runs `engage(self, firstPlayer)`), so the sentence holds if another card reveals one.
- "Deal each other player an encounter card": every player but the first, facedown.
- The Towering Citadel enters play by a flip, not a reveal: 3 threat, no "revealed" window. The Tyrant's Throne is
  revealed from the set-aside area: 4 threat. A defeated Prelate goes to the victory display and is never picked again.
- "Wolf Among Sheep" and No Longer Worthy say "the/a [PRELATE] minion"; at most one is in play in this scenario,
  because the next one arrives only when a scheme locked by the last one is defeated.

**Tests (exact numbers).** 3 players, standard.

1. After setup: Heart of the Empire 2 threat; one Prelate (15 hit points, a tough card) engaged with the first
   player; four set aside. Step one places 3 + 1.
2. A thwart of 2 against Heart of the Empire with the Prelate in play: not a legal target. Prelate defeated (victory
   display, 3 points). Thwart of 2: defeated; a second Prelate is revealed by the first player; players 2 and 3 have
   1 facedown card each; The Towering Citadel is in play with 3 threat; step one now places 3 + 2.
3. Citadel defeated: third Prelate; cards dealt; The Tyrant's Throne in play with 4 threat (3 + 3 per step one); the
   Citadel is removed from the game.
4. Throne defeated: fourth Prelate; cards dealt; No Longer Worthy attached; one Prelate still set aside.
5. Same seed, same four Prelates in the same order.

### 3.23 Whole sets set aside; one environment revealed at random, its set shuffled in

> **Status: exists (verify).** `GameSetupConfig.setAsideModularSets` and `GameState.setAsideModularSets`;
> `setAsideUntilCalled { encounterSetIds }`, which holds a set-aside card's setup keyword back at step 11 (wave 7
> §3.29, Mister Sinister's three sets); `EffectSpec shuffleInSetAsideModularSet { reveal, placement }` (wave 4 §3.18,
> wave 6 §3.62: a random set-aside set, one card of it revealed, the rest shuffled in, logged
> `setAsideModularSetShuffledIn`); a villain stage's When Revealed during setup (wave 7 §3.37). "Discard each other
> [SETTING] environment in play" is The Hood's (`hood` 24060–24062). Not run with **required** sets as the set-aside
> ones, nor from a villain stage revealed in play.

**Cards.** Dark Beast's Bogus Journey 45121a; Dark Beast 45118–45120 (When Revealed); The Savage Land 45127, Genosha
45133, Blue Area of the Moon 45139 ("Setup. … When Revealed: Discard each other [SETTING] environment in play.").

**Rules.** RRG 1.8 "Setup (Keyword)" (p. 40); "Set Aside" (p. 39); Appendix II steps 10–12 (p. 51); "The Golden
Rules" (p. 4); "Reveal" (p. 38); "Steady" (p. 41); "Guard" (p. 21).

**As read.**

- The card's own words pick the environment, not the set: "a random set-aside environment … the rest of **its**
  encounter set". With three whole sets set aside the two are the same pick.
- The environment is revealed first (its When Revealed discards the one in play), then the 7 cards are shuffled in.
- The constants are live keyword grants on "the villain" and "each minion". When Genosha leaves play, a villain
  holding one stunned card under steady is stunned from that moment (RRG p. 41).

**Tests (exact numbers).**

1. Standard, fixed seed: after setup exactly one Setting environment is in play, 7 cards of its set are in the
   encounter deck and 16 cards of the Setting sets are still set aside. Same seed, same environment.
2. Expert: also High-Tech Goggles on Dark Beast II (SCH 3) and 1 facedown encounter card per player.
3. 1 player, Dark Beast I takes 15 damage: stage II (18) is revealed, a second environment is in play, the first is
   in the encounter discard pile, 8 cards of the Setting sets are set aside, the player has 1 facedown encounter card.
4. Genosha in play, Dark Beast with one stunned card (not stunned: steady). The Savage Land is revealed: Genosha is
   discarded, he has retaliate 1 and is stunned; his next attack is replaced by discarding the card.
5. The Blue Moon set in a Rhino game: Blue Area of the Moon is in play after step 11 with no When Revealed, and a
   Hydra Mercenary revealed later has guard.

### 3.24 "Resolve the 'Special' ability on the [SETTING] environment"

> **Status: extend.** `EffectSpec resolveSpecials { cards | of, player, trigger, abilities, bind }` (`spec.ts`; wave 4
> §3.46) resolves a card's Special with a chosen player as "you", and hands back what the Special bound (its slots
> and `<bind>.count`). That covers every effect use here. **Missing: the cost form** ("… and resolve the 'Special'
> ability … → discard this card"), which is §3.11's `AbilityCost.resolveAbility` with `trigger: "special"`.

**Cards and who "you" is.**

| Card                                                                                          | The resolving player                                                       |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Dark Beast 45118–45120: "When Dark Beast attacks you"                                         | the attacked player, before the attack's damage                            |
| High-Tech Goggles 45122, Genetic Enhancement 45123: "Hero Action: Exhaust your hero and … →"  | the player using the action (a cost)                                       |
| Escaped Mutant 45137: "Alter-Ego Action: Resolve … → discard this card"                       | the player using the action (a cost)                                       |
| Pterosaur 45128, Oracle 45141, Manta 45142, Earthquake 45143, Warstar 45144; Land Out of Time | the revealing player                                                       |
| Giant Ape 45130: "The player who defeated Giant Ape resolves"                                 | that player; none if no player did (wave 7 §4.1 Q2)                        |
| Village Under Attack 45132: "Each player resolves"                                            | each player, in player order                                               |
| Armored Unibike 45135: "After Armored Unibike attacks, resolve"                               | the player it attacked                                                     |
| Genoshan Mech 45136: "attacks and defeats one of your allies, resolve … twice"                | that ally's controller, twice in a row                                     |
| Imperial Guardsman 45145: "When attached minion is defeated, resolve"                         | the player who defeated the minion; nobody if no player did (§4.1 Q14 = B) |

**Rules.** RRG 1.8 "Special" (p. 40: "Special abilities may only be resolved through the explicit instruction of
another card ability"); "You, Your" (p. 49); "Cost" (p. 13); "Player Deck" (p. 33); "Indirect Damage" (p. 24).

**As read.**

- "The [SETTING] environment" is the one in play. With none in play nothing resolves, and an ability whose cost is the
  Special cannot be used. With two in play (possible only outside Dark Beast): §4.2 Q15.
- Land Out of Time 45131 reads the Special's result: "resolve its 'Special' ability and take 1 indirect damage for
  each resource icon on the discarded cards". The Savage Land's Special binds its discarded cards; the treachery reads
  `totalPrintedResources` of `<bind>.discarded`.
- A cost that changes nothing follows §4.2 Q7 (The Savage Land with an empty deck and discard pile).
- **Imperial Guardsman (§4.1 Q14 = B).** The card names no player. The resolving player is the one who defeated the
  attached minion, not the one it was engaged with: the "player who defeated" the engine already records for Giant
  Ape and for a scheme's When Defeated (wave 7 §4.1 Q2), read here from the defeat the Forced Interrupt answers. An
  ally's attack, a hero's retaliate and a player card's damage each make that card's controller the player. A minion
  defeated by no player (an encounter card's damage) resolves no Special at all, Genosha's included, although its
  text names no "you". The owner's note calls the ability a When Defeated; the card prints a Forced Interrupt, and
  the answer is the same for both.
- "If you were already confused / stunned / exhausted" (45141–45143) is the existing "already" test made before the
  status is given (24 earlier cards, §3.17).

**Tests (exact numbers).**

1. The Savage Land; Dark Beast I attacks a hero with 20 cards in their deck: 3 are discarded, then the attack (2 plus
   boost). With 2 cards in the deck: 2 discarded, the deck is reset, 1 facedown encounter card, no third discard.
2. Genosha; Genoshan Mech attacks and defeats an ally: 2 threat on the main scheme. It attacks and does not: 0.
3. Blue Area of the Moon; Village Under Attack defeated with 3 players: each identity takes 1 damage, in player order.
4. Land Out of Time, The Savage Land in play, top three cards printing 1, 2 and 0 icons: 3 indirect damage. With
   Genosha in play and The Savage Land in the encounter discard pile: The Savage Land enters play, Genosha is
   discarded, no damage.
5. High-Tech Goggles with Blue Area of the Moon in play: the hero exhausts, takes 1 damage, Goggles is discarded.
   With the hero already exhausted: the action is not offered.
6. Oracle revealed to a confused player under Blue Area of the Moon: still one confused card, 1 damage. To a player
   who is not confused: confused, no damage.
7. Warstar's discard turns up Manta: Manta is revealed (stunned or the Special), then Manta's teamwork: Warstar is in
   play, so Manta activates against the player.
8. Giant Ape engaged with player 1, defeated by player 2's ally: player 2 resolves the Special.
9. **Q14 = B.** Imperial Guardsman on a minion with 3 printed hit points (7 with the attachment) engaged with
   player 1; Blue Area of the Moon in play. Player 2's ally deals the seventh damage: player 2's identity takes 1
   damage and player 1's takes 0. With The Savage Land in play instead: player 2 discards the top 3 cards of their
   deck and player 1 discards none. The same minion defeated by an encounter card's damage: no Special resolves, and
   under Genosha the main scheme gains 0 threat.

### 3.25 An attachment with no "attach to" that attaches from its own When Revealed

> **Status: extend.** `resolve/reveal.ts` attaches a revealed attachment at step 2 by its `AttachmentHost`; a card with
> none has no branch that waits for its own When Revealed. The `attach` effect and `discardEncounterUntil` exist.

**Cards.** Cruel Experiment 45124 ×2: "Attached minion gets +2 hit points and gains guard. When Revealed: Discard
cards from the top of the encounter deck until you discard a minion. Reveal that minion and attach Cruel Experiment to
it."

**Rules.** Ruling February 20, 2026 – Ruling 4 (§0.1), which corrects RRG 1.8 "Reveal" (p. 38) step 2. RRG "Attach
To" (p. 8: "If such a card cannot remain in its prior state or game area, discard it"); "Encounter Deck" (p. 17);
"Quickstrike" (p. 36).

**Plan (the intended behavior).** An attachment whose data has `impliedAttachHost: "ownWhenRevealed"` is turned
faceup in front of the revealing player, out of play, and its When Revealed resolves; the `attach` effect inside puts
it into play on the host. If it is unattached when its When Revealed has finished, it is discarded. Nothing about it
is in effect until it is attached.

**As read.** The printed order holds: the minion is revealed in full (it engages, its When Revealed, surge and
quickstrike resolve) and then the card attaches. If the deck runs out with no minion discarded the ability "is
considered to be fulfilled" (RRG p. 17) and Cruel Experiment is discarded. As a boost card it is 2 icons.

**Tests (exact numbers).**

1. Deck top: a treachery, a side scheme, Velociraptor. Two cards are discarded; Velociraptor is revealed to the
   player and its quickstrike attack resolves at ATK 1 plus its own discard; then Cruel Experiment attaches: 5 hit
   points, guard, SCH 2, ATK 2.
2. No minion in the encounter deck (4 cards): 4 discarded, the deck is reset with one acceleration token, nothing is
   revealed, Cruel Experiment is in the discard pile.
3. Attached minion with 4 damage; the attachment is discarded by a player card: 3 hit points, defeated (RRG p. 22).

### 3.26 A three-sided villain that changes to a named form

> **Status: extend** (one flag). The shape and the effect exist: three `VillainSide`s (§1.17);
> `EffectSpec changeVillainForm { villain, toFaceWithTrait }` (`spec.ts`, used by Spiral, `mojo` 39015a/39017), which
> "resolves as a flip", does nothing when the villain is "already in that form: nothing changes and nothing triggers"
> (`resolve/apply-effect.ts`), and raises `cardFlipped`, the trigger of "After you flip to this side" (§3.6). A flip
> to a face of the same type keeps attached cards, status cards and tokens (RRG p. 20). **The gap:** the effect also
> pushes `revealNewFaceFrame`, the Green Goblin rule ("Changing form will trigger Green Goblin's 'When Revealed'
> ability"). MC45 p. 19 says this change "is NOT the same as 'defeating' or 'revealing' the villain".

**Cards.** Apocalypse 45184a/b/c–45186a/b/c ("Forced Response: After Apocalypse changes to this form, …");
Staggering Strength 45149 ("Attach to Apocalypse and change him to [GIANT] form"); Biomorphic Blast 45150,
Technological Interface 45151, Giant-Sized Despot 45152 ("If Apocalypse is in [X] form, he activates against you.
Otherwise, change Apocalypse to [X] form and place 1 power counter on the main scheme." / "[star] Boost: After this
activation, change Apocalypse to [X] form."); Source of Power 45153, Plugged In 45154, Giant Growth 45155 ("When
Defeated: If Apocalypse is in [X] form, he activates against the player who defeated this scheme. Otherwise, change
Apocalypse to [X] form and give him a tough status card.").

**Rules.** MC45 p. 19 (§2.9). RRG 1.8 "Flip" (p. 20); "Villain Defeat" (p. 47); "Stalwart" (p. 40); "Retaliate X"
(p. 38); "Overkill" (p. 31); "Indirect Damage" (p. 24).

**Plan.** `changeVillainForm` gains `reveal?: false`, set by every card of this scenario: the face turns, `cardFlipped`
is raised, and no reveal step runs. "In [X] form" is the villain having the form trait (`hasTrait`), read from the
face showing. Each face's Forced Response is `on.cardFlipped` of itself to that side.

**As read.**

- Hit points, damage, attachments, status cards and counters do not change with the form; SCH, ATK and the face's
  keyword do, at once. Turning to Giant gives stalwart, which discards his stunned and confused cards (§3.3 test 2).
- A change to the form already showing is no change: no Forced Response, no power counter from a card whose
  "Otherwise" branch is not reached. Staggering Strength revealed while he is Giant attaches and nothing else.
- A boost card's "After this activation" change happens when the activation has fully resolved: the attack or scheme
  uses the face he had.
- Stage I defeated: stage II is revealed in the form he was in (§4.1 Q16 = A): defeated as Cyberpath, stage II is
  Cyberpath; as Giant, Giant. Biomorph is named for the start of the game only. It is a reveal, not a change of
  form, so no face's Forced Response resolves for it.

**Tests (exact numbers).** 1 player, stage I (16), Ancient Ritual in play at 5, main scheme at 3.

1. Biomorph, 7 damage. Technological Interface revealed: Cyberpath (SCH 2, ATK 1, retaliate 1); main scheme 4 and
   Ancient Ritual 6; 1 power counter; 7 damage still; no activation; the log has no reveal of the villain.
2. Cyberpath. Technological Interface revealed: he activates against the player; no change, no counter, no threat
   from the face.
3. Cyberpath, attacking with Giant-Sized Despot as the boost card (0 icons): the attack is 1; afterward he is Giant
   and heals 1 (7 → 6), and a stunned card on him is discarded.
4. Staggering Strength revealed while Cyberpath: attached, Giant, heal 1, ATK 2 + 2. His next attack: the identity
   gets a stunned card as the attack begins, the attack is 4 plus boost, and the card is discarded after the
   activation (ATK 2). Revealed while Giant: attached only.
5. Giant, 2 players. Biomorphic Blast revealed: Biomorph; each player assigns 1 indirect damage; his attacks have
   overkill.
6. Biomorph. Source of Power (an amplify icon) defeated by a hero's thwart: he attacks that player, and his boost card
   still gains 1 icon (ruling January 11, 2026 – Ruling 1 (1)): a 1-icon card makes the attack 2 + 2. While
   Cyberpath: he becomes Biomorph with a tough status card and 1 indirect damage is dealt; no activation.
7. A basic attack on him while Cyberpath: the attacker takes 1.
8. Stage II's faces print 2 in each Forced Response: Cyberpath II places 2 threat on each scheme.
9. **Q16 = A.** Stage I as Cyberpath takes his sixteenth damage: stage II is revealed as Cyberpath (20 hit points,
   SCH 3, ATK 1, retaliate 1), no threat is placed on any scheme and no power counter is added; the log has a stage
   reveal and no `cardFlipped`. Defeated as Giant instead: stage II Giant (SCH 2, ATK 3, stalwart), no heal.

### 3.27 Named counters on the main scheme that reveal a trait's card at a threshold

> **Status: exists (compose).** `on.villainStepResolved` (wave 7 §3.21), `addCounters` / `removeCounters` with a
> counter type, `counterAtLeast`, `discardEncounterUntil(filter, bind)` and `revealCard(…, firstPlayer)`. Precedents:
> The Island of Dr. Zola and The Mad Doctor (`trors` 04112, 04113: "place 1 test counter here. Then, if there are 3 or
> more … discard cards … until a minion is discarded"), Magneto's magnet counters (RRG errata, p. 68).

**Cards.** En Sabah Nur's Pyramid 45147b, The Rise of Apocalypse 45148a/b; the three treacheries 45150–45152 ("place
1 power counter on the main scheme").

**Rules.** RRG 1.8 "All-Purpose Counter" (p. 6); "Main Scheme, Main Scheme Deck" (p. 27: when the deck advances,
"Return all tokens (except acceleration tokens) that were on that card to the token pool"); "Encounter Deck" (p. 17).

**As read.**

- The threshold is checked only inside the step-one Forced Response. A treachery that brings the count to 4 does
  nothing more until the next step one, which makes 5, removes 4 and leaves 1.
- Stage 2B starts with no power counters (RRG p. 27).
- The first player reveals the card, so "you" on it is the first player.
- A deck with no [SUPERPOWER] card left is emptied, reset with an acceleration token, and nothing is revealed.

**Tests (exact numbers).** 1 player.

1. Rounds 1 to 3: 1, 2, 3 counters and 2, 3, 4 threat. Round 4: 4 counters, 4 removed; deck top Clan Akkaba Zealot,
   Advance, Giant Growth: 2 discarded, Giant Growth revealed with 5 threat and its hazard icon.
2. 3 counters; Biomorphic Blast (he is Giant) adds 1: 4, nothing revealed. Next step one: 5 → 1, a card revealed.
3. Stage 1B at 7 with 3 counters; step one places 1: 8 ≥ 8. Stage 2A's When Revealed: the first player discards until
   a [SUPERPOWER] card and reveals it. Stage 2B enters with 1 threat and 0 counters; step one has then resolved, so
   2B's own Forced Response places 1. At 10: the players lose.

### 3.28 An attachment's Forced Interrupt resolved "as if" its trigger just happened

> **Status: extend** (of §3.11). §3.11 adds `resolveSpecials.trigger: "forcedResponse"`; this is the same mechanism
> for a Forced Interrupt, with no `asIf` condition to set aside. The resource test composes: a deck discard with a
> bind, and a card's printed resource types (`resources.ts`; "for each resource icon discarded this way", Outlaw
> `next_evol` 40039).

**Cards.** Celestial Tech 45158 ×2: "When Revealed: For each [CELESTIAL] attachment in play, resolve its effect as if
the attached villain just schemed against you and attacked you. If there are no [CELESTIAL] attachments on the
villain, search the encounter deck and discard pile for a [CELESTIAL] attachment and reveal it. (Shuffle.)" Celestial
Armor 45156: "[star] Forced Interrupt: When the villain schemes against you, discard the top card of your deck. If
that card's resource has: [energy] — Heal 2 damage from the villain. [mental] — You are confused. Discard this card.
[physical] — Give the villain a tough status card. [wild] — Do all of the above." Celestial Weapon 45157: "When the
villain attacks you, …: [energy] — Deal 2 damage to your identity. [mental] — Discard a card from your hand.
[physical] — You are stunned. Discard this card. [wild] — Do all of the above."

**Rules.** RRG 1.8 "Resource Type" (p. 38); "Player Deck" (p. 33); "Search" (p. 39); "Self-Referential" (p. 39).

**Plan.** `resolveSpecials.trigger` takes `"forcedInterrupt"` as well, naming the ability by ref id, with the
revealing player as "you" and the attachment as its source. No attack or scheme is logged.

**As read.**

- Each attachment's ability resolves once, in an order the revealing player chooses; each discards its own card.
- Each of the three lines resolves at most once per discarded card: for each type the card prints, and all three for
  a wild. A card with no resource icon does nothing.
- The second sentence is checked after the first has resolved, as printed. If the first discarded the only Celestial
  attachment, the search runs and may bring the same card back from the discard pile.
- "On the villain" is the active villain in a game with several (MC45 p. 11).

**Tests (exact numbers).**

1. Celestial Armor on the villain, who schemes against an alter-ego player. Top card prints [energy]: 2 healed.
   [mental]: the player is confused and the Armor is discarded. [wild]: 2 healed, confused, a tough card, discarded.
2. Celestial Tech with Armor and Weapon in play, the two discards printing [physical] and [physical]: the villain has
   a tough card, the player is stunned, the Weapon is discarded, the Armor stays, no search.
3. Celestial Tech with none in play, Armor in the discard pile and Weapon in the deck: the player picks one; it is
   revealed and attached to the villain; the deck is shuffled.

### 3.29 A permanent side scheme that sheds threat at a threshold; redirected threat

> **Status: exists (verify).** Permanent and setup: §3.4. "After threat is placed here, if there is at least N threat
> here" is Consume the World (`phoenix` 34030). `RuleSpec schemeThreatDestination { enemy, scheme: TargetRef }` is
> Dark Phoenix's "place that threat on Consume the World" (wave 6 §3.37). "Choose: Either …, or this card gains
> [boost][boost][boost]" is Soldiers of Fortune (`aos` 50102). Not run: a threshold that removes threat from itself.

**Cards.** Ancient Ritual 45163 ("Forced Response: After threat is placed here, if there is at least 10 threat here,
remove 5 threat from this scheme and deal each player a facedown encounter card."); Ozymandias 45159 ("Toughness.
Villainous. [star] When Ozymandias schemes, place the threat on Ancient Ritual." and the boost choice); Scarab 45160
("After Scarab attacks, place 1 threat on Ancient Ritual (3 threat instead if the attack defeated an ally)"); Clan
Akkaba Zealot 45161; Tyrant Worship 45162.

**Rules.** RRG 1.8 "Permanent" (p. 32); "Villainous" (p. 47); "Scheme (Enemy Activation)" (p. 39); "Choose (Option)"
(p. 12).

**As read.** One check per placement, however much was placed; the removal is not a placement and does not check
again. Both boost options are always available (Ancient Ritual is permanent). The player the activation is against
chooses.

**Tests (exact numbers).** 2 players, Ancient Ritual at 5 after setup.

1. Tyrant Worship: 10 → 5; each player has 1 facedown encounter card.
2. At 9, a Zealot is defeated (+2): 11 → 6, cards dealt. At 14, Tyrant Worship: 19 → 14, one deal; the next single
   threat: 15 → 10, another deal.
3. Ozymandias schemes with a 2-icon boost card: 3 threat on Ancient Ritual, none on the main scheme.
4. At 8, Scarab attacks and defeats an ally: 11 → 6. He attacks an identity: 9.
5. Thwarted to 0: still in play (§3.4).

### 3.30 Cards from a player's deck attached facedown to a minion, and counted

> **Status: exists (verify).** `EffectSpec attach { card, to, facedown }` (`resolve/attach.ts`: a facedown attached
> card is a blank with no traits), written for player cards (Bruno Carrelli, `msm` 05007). Not run onto an enemy, from
> a deck, or with a hit point modifier counting them.

**Cards.** Abyss 45181b: "Abyss gets +2 hit points for each facedown card attached to him and engages the first
player. [star] Forced Response: After Abyss activates against you, attach the top card of your deck to him, facedown."
His Overseer face (45181a, pass 1c) attaches facedown cards too.

**Rules.** RRG 1.8 "Hit Points" (p. 22); "Leaves Play" (p. 27); "Victory X" (p. 46).

**To verify.** The card is attached facedown without being looked at; the modifier counts facedown attached cards
only; when Abyss leaves play each goes to its owner's discard pile and Abyss to the victory display.

**Tests.** 3 players: 15 hit points; after two activations, 19. With 16 damage and two cards: alive. Defeated: both
cards are in their owners' discard piles.

### 3.31 An attachment on an identity that minions of a trait seek out

> **Status: exists (verify).** `AttachmentHost yourIdentity`; `findCard { to: attach }` (§3.1); the engage redirect is
> Dreadpool's (`forcedInterrupt(on.entersPlay(self), engage(self, …))`); a keyword grant with an `engagedWith`
> condition; patrol (wave 3). Not run: a `PlayerRef` for "the player with [a named card] attached".

**Cards.** Escaped Mutant 45137 ("Attach to your identity. Each [GENOSHA] minion that engages you gains
quickstrike."); Magistrate 45134 ("Patrol. When Defeated: The defeating player finds Escaped Mutant and attaches it to
their identity." / "[star] Boost: If Escaped Mutant is attached to your identity, this card gains
[boost][boost][boost]."); Armored Unibike 45135 ("engages the player with Escaped Mutant attached, if able"); Police
State 45138 ("finds the Escaped Mutant attachment and reveals it").

**Rules.** RRG 1.8 "Find" (p. 19); "Engage" (p. 18); "Quickstrike" (p. 36); "Patrol" (p. 32). Ruling June 25, 2026 –
Ruling 5.

**As read.** Magistrate's "attaches it to their identity" moves the card from another identity. Police State's "finds
… and reveals it" with the card already attached: §4.2 Q17. The quickstrike grant must be in effect when the minion
engages (the point §3.3 verifies).

**Tests.** Player 2 has Escaped Mutant; player 1 reveals Armored Unibike: it engages player 2, attacks them for 2
(quickstrike), then player 2 resolves the Special. Nobody has it: it engages player 1 and does not attack. Magistrate
as a boost card against the player with Escaped Mutant: +3. Magistrate defeated by player 1 with the card on player 2:
it moves to player 1.

### 3.32 Reusable as is (pass 1b, checked against the engine unions)

| Card text                                                                                               | Existing vocabulary                                                                                        |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Teamwork ([DARK RIDERS]) on 45112–45116; Teamwork ([IMPERIAL GUARD]) on 45140–45144                     | wave 6 §3.1; RRG p. 43: only the entering minion activates, after its When Revealed                        |
| "After Gauntlet / Barrage / Hard-Drive / Tusk / Psynapse attacks you, …"                                | `on.enemyAttacks` against you; `discardFromPlay`, `dealDamage`, `placeThreat` on each scheme, `giveStatus` |
| "Hinder 1[per_hero]. Each [DARK RIDERS] minion gains toughness." (45117)                                | hinder (wave 3); `KeywordGrantSpec`: a minion that enters play while it is in play gets the tough card     |
| "Discard cards from the encounter deck until a [DARK RIDERS] minion is discarded and reveal it"         | `discardEncounterUntil` + `revealCard` (The Masters of Evil, core 01128)                                   |
| "Attach to Apocalypse" / "[star] Boost: Attach this card to Apocalypse" (45106–45108)                   | named host; 12 earlier boost attaches (§3.14)                                                              |
| "After Apocalypse schemes, place 1 threat on each side scheme" (45106)                                  | Program Transmitter (core 01141)                                                                           |
| "Apocalypse's attacks gain overkill" (45107, 45102b, the Biomorph faces)                                | 21 earlier cards (Badoon Warlord `gmw` 16121)                                                              |
| "Apocalypse gains retaliate 1 and stalwart" (45108)                                                     | `KeywordGrantSpec`                                                                                         |
| "Attach to the minion with the highest printed hit points and give it a tough status card. Otherwise…"  | `minionWithHighestPrintedHp`, "otherwise surge" (§3.14)                                                    |
| "The [PRELATE] minion activates against you. Otherwise, Apocalypse activates against you." (45110)      | `conditional` on `exists`, `enemyActivation` (§3.12)                                                       |
| Mister Sinister: retaliate 1, toughness, villainous, victory 3                                          | keywords                                                                                                   |
| The Shadow King: "choose an ally you control with the highest THW. Either discard that ally, or place…" | `chooseTarget` over a superlative query, `chooseOne`; no ally, nothing happens (RRG p. 12)                 |
| Sugar Man: "this attack gains piercing. If this attack defeats a character, heal 5 damage"              | `modifyAttack.keywords`; `atEndOfAttack` with the attack's results                                         |
| Mikhail Rasputin: "When Mikhail Rasputin attacks you, deal 1 damage to your identity"                   | `on.enemyAttacks` interrupt, `dealDamage`                                                                  |
| "If this stage is completed, the players lose the game" (45121b, 45148b)                                | the final stage's loss (RRG p. 27)                                                                         |
| "Dark Beast schemes. Give him a tough status card." / "attacks you. Give him an additional boost card"  | form-split When Revealed, `extraBoostCards` (§3.12; order as §4.2 Q8)                                      |
| Time-Travel Shenanigans: "a card from the same encounter set as the [SETTING] environment"              | `discardEncounterUntil` with `TargetQuery.encounterSetOf` (The Show Must Go On, `mojo` 39020)              |
| "The villain gains retaliate 1 / steady"; "Each minion gains guard" (45127, 45133, 45139)               | `KeywordGrantSpec` on the villain or a query                                                               |
| "If The Savage Land / Trial by Combat is in play, deal [this card] to yourself as a facedown…"          | `conditional` on `exists(named)`, `dealAsEncounterCard` (wave 7 §3.38)                                     |
| Velociraptor: "discard the top card of your deck … +1 ATK for this attack for each resource icon"       | Outlaw (`next_evol` 40039), Pyro's Flamethrower (`iceman` 46027)                                           |
| "While Trial by Combat is in play, Gladiator cannot take damage" (45140)                                | `cannotTakeDamage { while }` (Madame Hydra, core 01181)                                                    |
| "Exhaust your identity. If you were already exhausted, …" (45143)                                       | `exhaust`, an `isExhausted` test made first                                                                |
| "Discard the top card of the encounter deck. If that card is an [IMPERIAL GUARD] minion, reveal it"     | encounter deck discard with a bind, `conditional`, `revealCard`                                            |
| "Attach to a minion. Otherwise, this card gains surge. … +4 hit points and gains the [IMPERIAL GUARD]…" | `minion` host, `TraitGrantSpec` (52 earlier trait grants), `on.attachedCardDefeated`                       |
| "Shuffle each [IMPERIAL GUARD] minion in the encounter discard pile into the encounter deck" (45146)    | `moveCards` from the discard pile, shuffle                                                                 |
| An amplify icon printed on a side scheme (45146, 45153)                                                 | §3.2                                                                                                       |
| "discards cards … until a [SUPERPOWER] card is discarded and reveals it" (45147b, 45148a/b)             | §3.27                                                                                                      |
| "When Apocalypse attacks you, you are stunned. Discard this card after this activation." (45149)        | `on.enemyAttacks` interrupt, `giveStatus`, `atEndOfActivation`                                             |
| "[star] Boost: After this activation, reveal this card." (45149)                                        | Biogram Image (`gmw` 16074)                                                                                |
| "he activates against the player who defeated this scheme" (45153–45155)                                | `defeatingPlayer`, `enemyActivation`                                                                       |
| "When Defeated: Place 2 threat on Ancient Ritual" / "[star] Boost: Place 1 threat on Ancient Ritual"    | `whenDefeated`, `placeThreat` on a `named` card                                                            |

**Teamwork, one test each.** The Dark Riders (side scheme) in play, Barrage in play; Tusk revealed: he gets a tough
status card, then activates against the engaged player (ATK 2; in alter-ego he schemes with SCH 0). Gladiator revealed
with no other [IMPERIAL GUARD] minion in play: no activation; with a minion wearing Imperial Guardsman in play: he
activates.

### 3.33 An in-play scenario area no player controls, closed to abilities that do not name it

> **Status: new.** The engine has one scenario area, and it is out of play: `ZoneId scenarioArea` with
> `GameState.scenarioAreas` (The Collection, wave 3 §3.14). Cards in play that no player controls exist one at a time
> (`CardInstance.controllerId: null`: a Spell environment in a player's play area, `entersRevealersPlayArea`, wave 4
> §3.16; Robert Kelly attached to a side scheme, wave 6), but each is reachable by any ability. No zone is in play,
> shared, and closed. Searched `state.ts`, `spec.ts`, `select.ts`, `abilities.ts` and the DSL for "mission", "under no
> player's control" and an in-play scenario zone: nothing.

**Cards.** Every card of §1.24–§1.28 names it ("at the mission", "the mission area", "the [MISSION] side scheme").
MC45 p. 5; the Mission Rules card's first two bullets (§1.29).

**Rules.** MC45 p. 5: "[MISSION] side schemes begin the game in a separate game area called the 'mission area.'" /
"Cards in the mission area are in play but under no player's control. They cannot be affected by card abilities
unless the ability refers to the mission area." / "When a card in the mission area leaves play, place it in its
owner's discard pile." RRG 1.8 "In Play and Out of Play" (p. 23); "Ownership and Control" (p. 31: "Control of a card
remains constant unless an ability explicitly causes the card to change control"); "Unique Icon" (pp. 45–46); "Player
Elimination" (p. 34, step 4: "Place each card owned by the eliminated player in the eliminated player's discard
pile").

**Plan.**

- **`ZoneId { kind: "scenarioPlayArea"; name: string }`** and `GameState.scenarioPlayAreas`, the in-play sibling of
  `scenarioArea`, created by an effect (`createScenarioPlayArea { name, closed: true }`) the first time a card is put
  there. A card in it is in play, keeps its owner, has `controllerId: null` and `engagedWith: null`. Encounter cards
  and player cards share it.
- **Closed.** A card in a closed area is matched by a `TargetQuery` only when the query names the area:
  **`TargetQuery.inScenarioPlayArea: name`**. Every other query, selector and "each …" skips it when it picks what
  an effect chooses or changes: damage, healing, status cards, threat, counters, attachments, exhausting, readying,
  moving, discarding, defeating, blanking, keyword and stat grants. The filter is the engine's, in `select.ts`, so
  no existing card script changes.
- **An attachment does not open it (§4.1 Q19 = B).** MC45 p. 5 lets an upgrade be attached to an ally at the mission,
  and the upgrade is then a card in the area like its host. Its abilities are card abilities, so the same filter applies
  to them: a constant that changes "attached ally" finds no host there, a triggered ability has no controller to use it,
  and the upgrade does nothing while it is in the area. **`AbilityDefinition.reaches?: { scenarioPlayArea: name }`** is
  how an ability "refers to the mission area" when its printed words do not name it: every query and host reference of
  an ability that declares it may match cards in that area as well as outside it. The scripts that declare it are the
  campaign's own (Desperate Measures; the campaign instructions); no card outside the five campaign sets does.
  `inScenarioPlayArea` stays the form for an ability that names the area outright.
- **Reads** (a `Predicate`, a `ValueSpec` count, an event pattern) are §4.2 Q18. Default A: they see the card as what
  it is, a card in play that nobody controls. A query scoped to a player ("you control", "engaged with you") never
  matched it anyway.
- **Game steps are not card abilities.** The end-phase ready, the unique rule, player elimination and the defeat
  check apply to cards there as to any card in play. Nothing there activates in the villain phase: no minion in the
  area is engaged with a player.
- **Leaving it.** By its home (`CardHome`): a player card to its owner's discard pile, an encounter card to the
  encounter discard pile, a victory card to the victory display; removed from the game when the text says so. An
  attachment goes with its host (RRG "Attachment", p. 8).
- **Log:** `scenarioPlayAreaCreated { name }`, and the area's name on every `cardMoved` into or out of it.

**As read.** "Refers to the mission area" covers the three ways the cards say it: "at the mission", "the mission
area", and a card of the area named by its role ("the [MISSION] side scheme", Worldwide Crisis). A campaign
instruction that names the mission ("place 3 threat on the [MISSION] side scheme") is such a reference too.

**Tests (exact numbers).** 2 players; Evacuate Survivors (10 threat) and Sugar Man (10 hit points) in the area; X-23
(player 1's) at the mission with 1 damage.

1. An event that heals "an ally", one that readies "an ally" and a thwart of 2 against "a side scheme": X-23 and the
   mission are not offered. An attack event offers the villain and not Sugar Man.
2. An encounter effect that deals 1 damage to "each ally" or "each character you control": X-23 still has 1 damage.
   One that places 1 threat on "each side scheme": the mission stays at 10.
3. Worldwide Crisis's first option: the mission is at 13.
4. Player 1 is eliminated: X-23 is in player 1's discard pile, out of the game with it.
5. Q18 = A: a card that counts "side schemes in play" counts the mission.
6. **Q19 = B.** Reinforced Suit (`ant` 12018, cost 1: "Attach to an ally. Max 1 per ally. Attached ally gets +2 hit
   points.") is played on X-23 at the mission (3 hit points, 1 damage): 1 resource is paid, the upgrade is attached, and
   she still has 3 hit points, 2 remaining. Two more attempts deal her 1 damage each: she is defeated at 3 damage, and
   both cards are in their owners' discard piles. A fixture ability that declares
   `reaches: { scenarioPlayArea: "mission" }` and gives "attached ally" +2 hit points: 5 hit points.

**Composes with:** §3.34–§3.41; `scenarioArea` is untouched.

### 3.34 An ally played into that area: the choice, no controller, a blank text box, upgrades

> **Status: extend.** Playing a card puts it into its player's play area; no play has a second destination (searched
> the play command in `actions.ts` and `EffectSpec playCard`). The rest exists: `RuleSpec blankTextBox` over a class
> of cards, matched live, "except for traits" (Tech Theft, `ant` 12026; Inhibitor Collar, wave 7 §3.19); the ally
> limit counts allies a player controls (`allyLimit`, `excludedFromAllyLimit`); an upgrade whose host is `ally`.

**Cards.** Any ally in a campaign game; Desperate Measures 45176 ("Attach to an ally. Limit 1 per ally."); the
Mission Rules card's bullets 3 to 5 (§1.29).

**Rules.** MC45 p. 5 (quoted in §2.13). RRG 1.8 "Play, Put into Play" (p. 32); "Ally Limit" (p. 7: "Each player is
permitted to **control** a maximum of three allies"); "Text Box" (p. 44); "Unique Icon" (pp. 45–46); "Upgrade"
(p. 46); "Ownership and Control" (p. 31: "Upgrades attached to a card controlled by a player other than the upgrade's
owner are controlled by that other player").

**Plan.**

- **`RuleSpec playDestination { cards: TargetQuery, area: string, while? }`**, carried by the mission's rules block:
  while it is in effect, a player who plays a matching card (an ally) chooses the destination as part of the play
  (the play command gains `into?: { scenarioPlayArea: name }`; legal actions list both). Cost, play restrictions,
  "max per", the unique rule and `cannotPlay` are checked as for any play, before the destination matters. It is a
  play: "after you play an ally" answers it. Only a play has the choice; an ally put into play by an effect goes to
  its player's area as always.
- In the area the ally has no controller: the ally limit never counts it, and no player can exhaust it, attack,
  thwart or defend with it.
- **Blank.** The same rules block carries `blankTextBox` over allies in the area, except traits: no abilities and no
  printed keywords (a toughness ally gets no tough status card, an "enters play" ability does not resolve). Printed
  cost, THW, ATK, hit points, consequential icons and resource icon are not text box. A stat granted by an ability
  that reaches the area applies (Desperate Measures); no other grant does (§4.1 Q19 = B).
- **Upgrades.** A player may play an upgrade whose printed host is an ally onto an ally at the mission: the rules
  block names the area, so the play's host choice may reach into it (`inScenarioPlayArea` on the upgrade's host
  query while the rule is in effect). The upgrade is in the area with its host and under no player's control.
  **There it does nothing unless its ability refers to the mission (§4.1 Q19 = B):** the closed area's filter covers
  an attachment's own abilities (§3.33), so an ordinary upgrade's constant does not change its host and nobody can
  trigger it. Of the cards in the pool only Desperate Measures, a campaign card whose ability is written for the
  mission, declares the reach and applies there (§3.42). The cost is still paid, the upgrade stays attached, and it
  leaves the area with its host, to its owner's discard pile or deck.

**As read.**

- "They must choose" is a choice between two legal plays, not a forced move: with the mission finished (no [MISSION]
  side scheme in play) there is no choice.
- A unique ally at the mission stops every player from playing or putting into play a matching card (RRG pp. 45–46),
  and a player may not send a second copy there either.
- An ally's "Play only if …" line is checked before the card is in play, so it applies to a play to the mission.

**Tests (exact numbers).**

1. Player 1 controls three allies and plays X-23 (cost 3) to the mission: three resources paid; four allies in play,
   three under their control; nobody discards. A fourth ally played to their own area: they discard down to three.
2. Marrow (45021: "Play only if you have the [X-FORCE] or [X-MEN] trait." / "Response: After Marrow enters play, deal
   2 damage to an enemy.") played to the mission by an X-Men identity: in the area, no response offered. By an
   identity with neither trait: the play is refused for either destination.
3. X-23 at the mission: no player can play another X-23 to either place.
4. Desperate Measures (cost 1) played on Marrow at the mission: THW 2, ATK 3, 3 hit points; a second copy on her is
   refused ("Limit 1 per ally"). Marrow defeated at the mission: both cards in their owners' discard piles.
5. An ally with toughness played to the mission: no tough status card.
6. With the mission on its [FINISHED] face: playing an ally offers no destination.
7. **Q19 = B.** Reinforced Suit (`ant` 12018, cost 1) played on Marrow at the mission: 1 resource paid, the upgrade
   attached, and she has THW 1, ATK 2 and 2 hit points, not 4. Desperate Measures beside it on her: 2, 3 and 3, and
   an attempt she takes part in adds 3 to the pool and removes 2 threat. Reinforced Suit on Marrow in her
   controller's own area: 4 hit points.

### 3.35 A support the first player controls that cannot be discarded; a discount by destination

> **Status: extend** (the discount). Exists: `RuleSpec controlledByFirstPlayer` (the Milano, `gmw` 16142; Hope
> Summers, wave 7 §3.25), applied when the token passes and when a first player is eliminated; `cannotLeavePlay`
> with `by: "cardAbilities"` (wave 7 §3.10) and `playersCannotDiscard` (wave 4 §3.44); a player card's `flipSide`
> and `flipCard`; a lasting "reduce the cost of the next card … played this phase" with a `cardFilter` (Helicarrier,
> core; Avengers Tower, `cap`). The filter reads the card, not where it is played.

**Cards.** Mission Team 45171a/b (§1.26).

**Rules.** RRG 1.8 "'Cannot'" (p. 11); "First Player" (p. 19); "Ownership and Control" (p. 31); "Cost" (p. 13);
"Dash (Value)" (p. 15); the erratum (p. 69).

**Plan.**

- "The first player gains control of it": `controlledByFirstPlayer` on both faces. It moves, in whatever state it
  is in (RRG p. 31), when the token passes at the end of the villain phase. It readies with every other card at the
  end of the player phase, before the token passes, so each round's first player finds it ready: one use a round.
- "Cannot be discarded": **`cannotLeavePlay`'s narrow form gains `by: "discard"`**: any discard, by a player's card,
  an encounter card (War's "discard an upgrade or support you control") or a cost, does nothing to it and it is not
  a legal choice for one. Removal from the game and a flip are not discards: the mission's own text does both.
  Player elimination of the first player moves it to the new first player (the rule above) before step 3 of
  elimination looks at it.
- The Action's first option: the lasting discount gains **`into: { scenarioPlayArea: name }`**: it is consumed by
  the next ally any player plays to the mission this phase (the card says "the next ally played", not "you play"),
  −2 to a floor of 0, and ends with the phase unused (the errata). An ally played to a player's own area neither
  uses nor ends it.
- The second option runs the attempt (§3.36–§3.39). Both options are always choosable, an attempt with no ally at
  the mission included (it discards nothing and still counts, §3.40).
- The [FINISHED] face: `chooseTarget` of a player, `draw(1)`.

**Tests (exact numbers).**

1. Player 1 (first player) exhausts Mission Team for the discount. Player 2, given the chance to act, plays X-23
   (cost 3) to the mission for 1. A second ally to the mission that phase costs its printed cost.
2. The discount, then an ally played to the player's own area at full cost, then Marrow (cost 2) to the mission at
   no cost. Unused at the end of the player phase: gone; next round's first ally to the mission costs full.
3. War attacks the first player, whose only upgrade or support is Mission Team: nothing is discarded.
4. Round 2: Mission Team is in player 2's play area, ready. Player 1 cannot use it.
5. The first player is eliminated in the villain phase: Mission Team is under the next player's control.
6. The mission is defeated: Mission Team shows [FINISHED], keeps its exhausted state; next round its Action draws 1
   card for the chosen player.

### 3.36 Discarded cards paired one each with characters, matched by resource icon

> **Status: new.** Exists: the deck discard with its cards bound (`moveCards(topOfDeck(n), "discard", bind)`, with
> `<bind>.physical` and the other per-type totals; wave 7 §3.56) and every reader of a card's printed resource icons.
> Nothing pairs cards with cards, and nothing compares a discarded card's icons with the icons of a card in play.

**Cards.** Mission Team 45171a (steps 1 and 2 of an attempt); Mister Sinister 45179a (a limit on the pairing);
Desperate Measures 45176 and Abyss 45181a through what they change (§3.42, §3.38).

**Rules.** MC45 p. 6, steps 1 and 2 (quoted in §2.13). RRG 1.8 "Player Deck" (p. 33); "Wild Resource" (p. 48),
which the rulebook overrides for this match (§0.2); "Resource" (p. 37).

**Plan.** The attempt is a script in `@mc/cards` (one `missionAttempt()` used by Mission Team's Action); the engine
knows no "mission". It needs one new effect:

- **`EffectSpec pairCards { cards: TargetRef, with: TargetQuery, chooser: PlayerRef, match: "resourceIcon", wild:
"either", limit?: PairLimit, bind }`.** The chooser pairs each card of the slot with a different card `with`
  matches (a pending choice with every pairing laid out; a card may be left unpaired, and must be when the limit
  forbids it). A pair **matches** when the two share a resource type, where `wild: "either"` lets a [wild] on either
  side stand for any type. The icons of the card in play are its printed ones plus any it "is considered to have"
  (§3.42). Binds `<bind>.matched` (the characters whose pair matches), `<bind>.pairs` and `<bind>.count`.
- **`limit: { distinctBy: "resourceIcon" }`**, switched on by a rule (`RuleSpec pairLimit { area, while }`, Mister
  Sinister's constant): two paired cards may not share a resource type. A card with several types shares if any type
  is shared.
- Step 1 is the existing discard with X the number of allies in the area. The slot is settled before the pairing
  (`settleDeckDiscards`, wave 7 §3.55): a card a response took, or one Abyss attached, is not in it. A card the deck
  reset shuffled into the new deck is still in it (wave 7 §4.1 Q33).
- The discarded cards never leave the discard pile; "return the discarded cards to their discard pile" is already
  true.
- **Log:** `cardsPaired { playerId, pairs: [cardInstanceId, characterInstanceId, matched] }`, so a replay shows why
  an ally did or did not take part.

**As read.**

- Fewer cards than allies (a short deck, Digging Deep, Abyss): the chooser decides which allies get one.
- A card with no resource icon (an encounter card in the deck, Panicked Refugees) can be paired and matches nothing.
- Domino's "count each printed [wild] icon twice" (`deckDiscardIconCount`) is a count, not a second icon: it changes
  no match, and no Mission Response counts [wild] icons (Abyss attaches cards; he does not count).

**Tests (exact numbers).** Randall ([wild]), X-23 ([physical]) and Marrow ([energy]) at the mission.

1. Top of the deck Magik's Crown ([mental]), Clobber ([physical]), Bloodgem ([wild]); paired Crown–Randall,
   Clobber–X-23, Bloodgem–Marrow: three matched (MC45 p. 6).
2. The same cards paired Clobber–Marrow, Bloodgem–X-23, Crown–Randall: two matched (X-23, Randall).
3. Top of the deck Clobber, Clobber, Bloodgem. No limit: Clobber–X-23, Clobber–Randall, Bloodgem–Marrow, three
   matched. With Mister Sinister in the area: the second Clobber cannot be paired; at most two matched.
4. A deck of 2 cards: 2 are discarded, the deck resets with 1 facedown encounter card dealt, no third card is
   discarded; two pairs at most.
5. No ally at the mission: nothing is discarded, no choice is offered.
6. Marrow with Desperate Measures, paired with Magik's Crown ([mental]): matched (her considered [wild]).

### 3.37 A damage pool dealt to one enemy at a time; threat removed by a total that is not a thwart

> **Status: extend.** `EffectSpec assignDamage { amount, among, chooser }` places a pool "one point at a time; each
> character then takes its share as one damage event": every share lands together. `removeThreat` by a card ability
> that is not a thwart is in every wave. `repeatWhile` (wave 4 §3.54) repeats an effect list.

**Cards.** Mission Team 45171a (steps 3 to 5 of an attempt).

**Rules.** MC45 p. 6, steps 3 to 5. RRG 1.8 "Damage" (p. 14); "Defeat" (p. 15); "Thwart" (p. 44: a thwart is a basic
thwart or an ability labeled as one; this is neither).

**Plan.**

- **`assignDamage` gains `sequential: true`**: the chooser picks one character `among` matches that can take damage
  and an amount from 1 to the smaller of the pool and that character's remaining hit points; it is dealt and settled
  (a defeat with its When Defeated and Victory included) before the next pick. It ends when the pool is empty or no
  matching character can take damage; what is left is lost. This is what lets the pool reach an Overseer once the
  minion shielding it has fallen in the same step. If `repeatWhile` over a chosen target and a decreasing variable
  already expresses it, the scripting agent uses that and this row becomes "exists (compose)".
- The pool is the sum of the matched allies' ATK as it is now (Desperate Measures' +1 counts; a printed dash is 0,
  RRG "Dash (Value)", p. 15). The damage is not an attack: no attacker, no retaliate, no overkill, no "after …
  attacks".
- Step 5: `removeThreat` on the area's [MISSION] side scheme by the sum of the matched allies' THW. It is not a
  thwart: no `thwart` event, nothing "after you thwart" answers, a confused status or a crisis icon changes nothing.
  The source is Mission Team and the player is the one making the attempt.

**Tests (exact numbers).** 1 player; mission 5 threat; Sugar Man 5 hit points.

1. Pool 6 against Sugar Man alone: he takes 5 and is defeated (victory display); 1 is lost. THW 4: the mission is at 1.
2. Pool 6 with an Agent of Apocalypse (3 hit points) at the mission: Sugar Man is not offered first; 3 to the Agent
   (encounter discard pile), then 3 to Sugar Man (3 damage of 5).
3. Pool 2 against the Agent and Sugar Man: 2 to the Agent, who has 1 hit point left; Sugar Man is never offered.
4. No ally matched: pool 0, no threat removed; the attempt still resolves (§3.40).
5. The mission at 1 threat with THW 4: 1 removed, defeated if no minion is in the area.

### 3.38 A Forced Response to one ability's deck discard ("Mission Response"); a discarded card that leaves

> **Status: exists (verify).** `TriggerEvent cardDiscardedFromDeck { instanceId, playerId, sourceInstanceId, at }`,
> one per card in discard order, with `activeIn: "discard"` for a card answering its own discard and
> `settleDeckDiscards` dropping a card that a response moved (wave 7 §3.55, §4.1 Q32; the doc comment already cites
> ruling April 30, 2026 – Ruling 4 (1)). Not run: a forced response on a card nobody controls that answers only the
> discards of one source; that it resolves before the discarded card's own optional response (`resolve/triggers.ts`);
> facedown cards attached from a discard pile to an enemy.

**Cards.** The Shadow King 45180a, Abyss 45181a, Sugar Man 45182a, Mikhail Rasputin 45183a (§1.25); Digging Deep
(`next_evol` 40060); also Jackpot!, White Fox and The Painted Lady (wave 7 §3.55), which answer the same discard.

**Rules.** MC45 p. 5 ("a new type of Forced Response that only resolves after a player discards cards from the top
of their deck during a mission attempt"). RRG 1.8 "Forced" (p. 20: "forced responses take priority and initiate
before non-forced responses"; "If two or more forced abilities would initiate at the same moment, the first player
determines the order"). **Ruling April 30, 2026 – Ruling 4 (1).**

**Plan.** No engine change is expected.

- A Mission Response is `forcedResponse(on.cardDiscardedFromDeck(...))` limited to discards whose source is the card
  making the attempt (the event's `sourceInstanceId`), with "you" the player whose deck it is. It resolves **once for
  each discarded card**, reading that card's icons. For all four Overseers the per-card results add up to the
  printed "for each … discarded": 2 threat per [mental] icon, heal 3 per [physical] icon, 1 damage per [energy] icon
  (each to an ally at the mission the player chooses), each card with a [wild] attached. The log shows one line per
  card.
- **Order, per discarded card:** the Mission Response (forced), then the player's own responses to that card
  (Digging Deep, Jackpot!, White Fox, The Painted Lady). So:
  - Abyss attaches a discarded Digging Deep (a [wild]) before its Response is offered: it is not offered (the card
    is no longer where the discard put it).
  - Against the other three, Digging Deep's icon has been counted by the Mission Response (it is a [wild], which
    none of them counts) and the player may then take it: it is not in the slot the pairing reads, and no card is
    discarded in its place.
- **Abyss.** `attach { card, to: self, facedown }` from the discard pile (§3.30's effect). A facedown attached card
  is out of play (RRG p. 23) and blank. His a face has no "+2 hit points" line: the cards do nothing there. They go
  to their owners' discard piles when he leaves play, and are removed from the game with him if the mission fails
  (§2.13). This is the carry-over from §3.30: both faces attach facedown player cards, from the discard pile on this
  face and from the top of the deck on the other.
- "Cards discarded … during a mission attempt" excludes every other discard: Famine's ten cards, Bishop's Energy
  Absorption, a mill by an encounter card.

**Tests (exact numbers).** 1 player; three allies at the mission.

1. **The ruling.** Sugar Man with 4 damage. Discards: Digging Deep, Clobber, Bloodgem. Clobber's [physical]: he heals
   3 (1 damage). The player takes Digging Deep: hand +1, two cards left to pair, at most two allies matched, the
   deck is not touched again. Declining: three cards to pair, Digging Deep as a [wild].
2. The Shadow King, mission at 5: Genius (two [mental]) discarded: 9. With Domino as the identity nothing changes
   (her rule counts [wild] twice, and he counts [mental]).
3. Abyss: Digging Deep and Bloodgem discarded with Clobber: two cards attached facedown to Abyss, no Response
   offered, one card to pair. Abyss defeated later: both cards in their owner's discard pile.
4. Mikhail Rasputin: Energy (two [energy]) discarded: two separate 1-damage choices among the allies at the mission;
   both on Marrow (2 hit points) defeat her before the pairing, and X is not recounted: three cards were discarded
   and two allies remain to pair.
5. Mister Sinister has no Mission Response: only §3.36's limit.
6. Famine discards 10 cards of that player's deck with Sugar Man at 4 damage: no heal.

### 3.39 A named moment a script raises and other cards answer

> **Status: new.** Every trigger event is raised by an engine step (`trigger-events.ts`); a script cannot raise one.
> Searched `spec.ts`, `trigger-events.ts` and the DSL for a named, raised or custom event: none. "Resolve the
> [ability] on [card] as if …" (§3.11) calls one known ability; this is the reverse, a moment any card may answer.

**Cards.** The five missions' a faces ("Forced Response: After you resolve a mission attempt, …").

**Rules.** RRG 1.8 "Response" (p. 38); "Forced" (p. 20); "Triggered Ability" (p. 45). MC45 p. 6: "Mission attempts
are triggered by the Mission Team (171A) support card."

**Plan.** **`EffectSpec raiseMoment { name: string; player: PlayerRef }`** and
**`TriggerEvent momentRaised { name, playerId, sourceInstanceId }`** with the pattern `on.moment(name)`: a response
window like any other ("you" is `player`), opened where the effect stands in its list. Forced before optional, the
first player ordering ties. The engine attaches no meaning to the name; the attempt raises `"missionAttempt"` after
step 5. Logged as `momentRaised`.

- Not used for the discard (§3.38): that must be the same triggering condition as Digging Deep's Response, so that
  RRG p. 20's priority applies between them.
- A moment nobody answers costs nothing (the `heard` gate of wave 7 §3.55).

**Tests.** An attempt with the mission on its a face: one `momentRaised`, the mission's response resolves once. An
attempt whose step 5 defeated the mission: the moment is raised and nothing answers (the a face is gone). A second
card with `on.moment("missionAttempt")` in a fixture resolves in the order the first player picks.

**Composes with:** later boxes' named procedures; nothing in waves 1–7 needs it.

### 3.40 A side scheme nobody thwarts, kept in play by a minion, that flips to a face that clears the area

> **Status: exists (compose)**, on §3.33 and §3.39. Pieces: `RuleSpec cannotThwart { schemes }` with no player
> ("binds every player"; Life-Size Decoy, `sm` 27142); `notDefeatedWithoutThreat { target, while }` (the Wrecking
> Crew's signature schemes); named counters (`addCounters`); `flipCard` onto an `otherFaceId` face and a When
> Defeated that flips its own card (Find the Norn Stones, `mts`; §3.22); `moveCards` to `removedFromGame` and to each
> owner's deck, shuffled; `endGame`; `findCard` (§3.1). Not run together.

**Cards.** 45166a/b–45170a/b (§1.24). The Mission Rules card's bullets 1 and 6 (§1.29).

**Rules.** MC45 pp. 5–6. RRG 1.8 "Defeat" (p. 15); "Side Scheme" (p. 40); "Flip" (p. 20: with the same card type
"the card retains all attached cards, tucked cards, status cards, and tokens"); "Double-Sided Card" (p. 17);
"Removed from the Game" (p. 36); "When Defeated Abilities" (p. 48); "Target" (pp. 42–43: "A target that cannot be
thwarted is not a valid target for a thwart-labeled ability").

**As read.**

- **Not thwarted.** No basic thwart and no thwart-labeled ability can choose it. Threat leaves it only by an
  attempt's step 5.
- **Not defeated while a minion is in the area.** At no threat with a minion there it stays in play at 0; the moment
  the last minion leaves the area it is defeated (the state check, not a new attempt). An Overseer and every Agent of
  Apocalypse added to the area count.
- **The attempt counter** is placed by the a face's Forced Response, so an attempt that defeated the mission places
  none, and an attempt with no ally at the mission places one.
- **Which bullet.** The a face flips for one of two reasons, and the b face must know which. The When Defeated sets
  a named marker on the card (`addCounters(self, "defeated", 1)`) before it flips; counters survive a flip between
  two side schemes (RRG p. 20). The b face reads the marker. Explicit state, readable in the log.
- **When Defeated:** each player card in the area (allies and upgrades on them) is shuffled into its owner's deck;
  facedown cards on a defeated Abyss went to discard piles with him. Then Mission Team flips, then the mission.
- **The fourth counter:** Mission Team is removed from the game (not a discard, §3.35), then the mission flips.
- **The b face:** "remove each card in the mission area from the game", then its bullet. The [FINISHED] face itself
  is a card in the mission area: §4.2 Q20 (default A: it goes last, after its bullet resolves).
- **"Was defeated" for Victory** is the `schemeDefeated` event the When Defeated belongs to: `CampaignGameQuery
cardsDefeated { name }` reads it though the card flipped and no card of that name is left in play
  (`campaign.ts`'s own note on Find the Norn Stones).
- Sabotage the Sea Wall's b face is §3.1's `find`: "find … and reveal it" (not defeated) reveals North American Sea
  Wall from wherever it was, with hinder and surge; "find … remove it from the game" (defeated) takes it out of play
  if it is in play, without defeating it (no victory display). It is gone first, in printed order, so its "The
  villain cannot take damage" no longer holds when each player then deals 3 damage to an enemy of their choice.

**Tests (exact numbers).** 1 player unless said.

1. Mission 5, Sugar Man in the area; a basic thwart and a thwart event: the mission is no target.
2. Mission at 2, THW 4, Sugar Man alive: 0 threat, in play, one attempt counter. A later attempt defeats Sugar Man in
   step 4: the mission is defeated then; step 5 removes nothing; no counter is placed.
3. Four attempts that never empty it: after the fourth, Mission Team is removed from the game; the allies at the
   mission, the Overseer and an Agent there are removed from the game (not in a discard pile, not in the victory
   display); the b face's "not defeated" bullet resolves.
4. Evacuate Survivors, 2 players, failed: each player has 1 facedown encounter card. Defeated: each searches deck
   and discard pile for 1 card.
5. Liberate the Seattle Core, 3 players, failed: 6 threat on the main scheme. Defeated: each player has 1 Desperate
   Measures in hand and one copy is still set aside.
6. Find Lost Mutants defeated, 2 players: each has one campaign ally in hand, two stay set aside; each ally's
   "enters your hand" Response is offered (§3.42).
7. Protect the Professor failed: the game is lost at once.
8. Fourth attempt, mission at 1 threat, no minion, one ally matched with THW 1: defeated; Mission Team shows
   [FINISHED]; three counters.
9. A campaign game won with the mission defeated: `cardsDefeated { name }` has one entry. Won on its a face: none.

### 3.41 Minions in the area: dashed stats, never engaged, shielded by another minion

> **Status: exists (verify)**, on §3.33. `PrintedStat` `null` (a dash: Hulk's THW); `RuleSpec cannotTakeDamage {
target, while }` (Ultron, core 01136); victory (wave 3); `chooseOne` on a When Revealed with an activation as one
> option (wave 7 §3.11); `extraBoostCards` (§3.12). Not run: a minion in play engaged with no player and in no
> villain's area; "add [this card] to [an area]" as a When Revealed option.

**Cards.** 45179a–45183a; Agent of Apocalypse 45164; Worldwide Crisis 45165 (text in §1.25, §1.28).

**Rules.** RRG 1.8 "Dash (Value)" (p. 15); "Activation" (p. 6); "Engage" (p. 18); "Guard" (p. 21); "Victory X"
(p. 46); "Choose (Option)" (p. 12); "'Cannot'" (p. 11); "Boost" (p. 11).

**As read.**

- An Overseer is put into play in the area: not revealed, not engaged, 5[per_hero] hit points, no status card (it
  has no toughness). It never schemes or attacks.
- "Cannot take damage while another minion is at the mission": another minion in the same area, which in practice is
  an Agent of Apocalypse. The attempt's pool does not offer it (§3.37).
- Defeated, it goes to the victory display (5 points) and Victory strikes it after a win (§3.45). Removed from the
  game by a failed mission, it was not defeated.
- **Agent of Apocalypse.** The player who reveals it chooses. "Add … to the mission area": it enters play there, not
  engaged, with no activation; guard does nothing there (RRG p. 21 reads minions engaged with a player). "Or it
  activates against you": it engages the player as any revealed minion and activates (SCH 2 or ATK 2 by form). With
  no [MISSION] side scheme in play only the second option can be chosen.
- Its Boost and Worldwide Crisis's name the mission, so they reach into it: "Deal 1 damage to an ally at the mission"
  (the player the activation is against chooses; none there, nothing), "Place 1 threat on the [MISSION] side scheme".
  "Give the activating enemy an additional boost card" is a second sentence and happens either way.
- Worldwide Crisis's second option "take 1 damage and this card gains surge" is the player's identity.

**Tests (exact numbers).** 2 players.

1. Setup: Sugar Man in the area, 10 hit points, engaged with nobody. A full villain phase: he does not activate.
2. Agent of Apocalypse revealed by player 2, added to the mission: 3 hit points, not engaged; player 2's guard check
   for attacking the villain is unaffected. Sugar Man takes 0 of a pool while the Agent stands.
3. The same card, "activates against you" in hero form: engaged with player 2, attacks for 2.
4. As a boost card on the villain against player 1 with X-23 (1 damage) at the mission: X-23 has 2 damage; the
   villain has one more boost card.
5. Worldwide Crisis, mission at 10: first option 13. Second option: 1 damage to the player's identity, then one more
   encounter card for them. With the mission finished: only the second.
6. Sugar Man defeated: victory display. A game won: `overseers` has Sugar Man struck. A game lost: not struck.

### 3.42 A resource icon a character is considered to have; an obligation that lives in a player's deck

> **Status: extend** (the icon). Exists (verify) for the rest: an encounter card in a player's deck that answers
> `cardEntersHand` from the hand (`on.thisEntersYourHand()`, `activeIn: "hand"`; Mystique's treacheries, wave 6
> §3.10); an obligation that stays in its player's play area until its own Alter-Ego Action removes it (wave 7
> §3.70); a scheme icon on an obligation in play, counted at step one (wave 7 §3.63); `dealAsEncounterCard` (wave 7
> §3.38); hinder, surge and victory on a side scheme; `cannotTakeDamage` on the villain.

**Cards.** Desperate Measures 45176; Panicked Refugees 45178; Destiny, Blink, Morph and X-Man 45172–45175; North
American Sea Wall 45177 (text in §1.27, §1.28).

**Rules.** RRG 1.8 "Resource" (p. 37); "Obligation" (p. 30); "Discard" (p. 16: "If an encounter card is discarded,
it is placed faceup on top of the encounter discard pile"); "Ownership and Control" (p. 31: the scenario owns each
encounter card); "Acceleration Icon" (p. 5); "Hinder X" (p. 22); "Surge" (p. 42); "Victory X" (p. 46).

**Plan and reading.**

- **Desperate Measures.** +1 THW, +1 ATK and +1 hit point are stat modifiers on the host. "Is considered to have a wild
  ([wild]) resource icon in addition to its printed resource icon" is
  **`RuleSpec consideredResourceIcon { target, resource }`**, read by one reader today, §3.36's match. It does not
  change what the ally card would pay with from a hand (the upgrade is in play and so is the ally). On an ally in a
  player's own area it gives the stats and an icon nothing reads. **At the mission all four changes apply because its
  script declares `reaches: { scenarioPlayArea: "mission" }` on its constant (§3.33): it is the one upgrade that works
  there (§4.1 Q19 = B).**
- **Panicked Refugees.** In a player's deck by instruction (§2.14). Entering that player's hand by any route (drawn,
  searched for, the starting hand): its Forced Response reveals it and the player draws 1 card. Revealed, an
  obligation with no "choose" and no discard stays in that player's play area (wave 7 §3.70), where its acceleration
  icon adds 1 threat at step one of each villain phase (RRG p. 5). Its Alter-Ego Action, by that player only (RRG
  p. 30), exhausts their identity and removes the card from the game: this game, not the campaign. Discarded from a
  deck (a mission attempt, Famine) it goes to the encounter discard pile (RRG p. 16), matches no ally (it has no
  resource icon), and may come back as an encounter card: revealed from the encounter deck it enters the revealing
  player's play area and stays, with no card drawn (its response reads a hand).
- **The campaign allies.** "Response: After [this ally] enters your hand" is `on.thisEntersYourHand()`, optional,
  each time: the b face's hand-out, a draw, a search, the starting hand (Morph confuses the villain before the first
  turn). Played to the mission they are blank like any ally.
- **North American Sea Wall.** 2 threat plus hinder 2[per_hero], surge, victory 2; while it is in play "The villain
  cannot take damage" (every villain, with several). As a boost card it deals itself facedown to the player the
  activation is against. It is in the villain's area, not the mission's, and players thwart it normally.

**Tests (exact numbers).**

1. Marrow (THW 1, ATK 2, 2 hit points, [energy]) with Desperate Measures: 2, 3, 3; matched by a [physical] card
   (§3.36 test 6). Without it: not matched.
2. Panicked Refugees drawn in the end phase with a hand size of 6: the player holds 6 other cards and the obligation
   is in their play area. Next villain phase, 1 player, a main scheme with +1[per_hero]: 2 threat placed. In
   alter-ego, the Action: identity exhausted, the card removed from the game.
3. Panicked Refugees discarded by a mission attempt with two allies at the mission: one card left that can match;
   the obligation is in the encounter discard pile.
4. Blink searched for at campaign setup (§3.44): the villain takes 2 damage before the starting hands; a villain
   with a tough status card loses it instead.
5. North American Sea Wall revealed, 2 players: 6 threat, the revealing player is dealt another card (surge), the
   villain takes 0 from an attack of 5. Defeated: victory display (2 points); the villain takes damage again.
6. The same card as a boost card: 2 icons, and it is the attacked player's facedown encounter card afterward.

### 3.43 "[A title] cannot enter play during this game"

> **Status: extend.** `RuleSpec cannotPlay { player, cards, while }` stops a play. The unique rule's refusal covers
> both ways in ("it cannot be played or put into play. Any effect that attempts to do so has no effect", RRG
> pp. 45–46) but only against a matching card in play. Nothing stops a title from being put into play by an effect.

**Cards.** MC45 p. 20, scenario 5's Campaign Instructions: "Professor X cannot enter play during this game."
Professor X is `mut_gen` 32019 (reprinted `gambit` 37017), an ally.

**Rules.** RRG 1.8 "'Cannot'" (p. 11); "Enters Play" (p. 18); "Play, Put into Play" (p. 32).

**Plan.** **`RuleSpec cannotEnterPlay { cards: TargetQuery, while? }`**, a scenario-level rule the campaign
instruction creates for the game: a matching card cannot be played (refused before any cost, for either
destination of §3.34) and an effect that would put it into play does nothing to it, the card staying where it was.
Matched by title, so any printing. The card may be in a deck, be drawn, be discarded and pay for other cards.

**Tests.** A campaign game of scenario 5 with Professor X in a deck: in hand, it is not a legal play to either place;
spent as a resource, it works; an effect that puts an ally from the discard pile into play cannot choose it. The same
deck in scenario 4: playable.

### 3.44 A card found at campaign setup that counts toward the starting hand

> **Status: extend.** Campaign setup resolves before the starting hands (`afterScenarioSetup`, `campaign.ts`); a
> deck search to hand exists; `executeDrawStartingHands` (`flow.ts`) is "a counted draw of hand-size cards, not a
> refill" (maintainer decision 2026-09-23, `docs/campaign-mode-design.md` Q20). So a card found before step 14 is
> today an extra card.

**Cards.** The fifth bullet of every scenario's box: "Each player searches their deck for an ally and adds it to
their hand. (This card counts towards your hand size.)"

**Rules.** RRG 1.8 Appendix II steps 13 to 15 (p. 51); "Hand Size" (p. 21); "Search" (p. 39).

**Plan.** **`EffectSpec countTowardStartingHand { player, amount }`**, legal only before step 14: the starting draw
for that player is their hand size less the amount (never below 0), and the credit is cleared by the draw. The
instruction is the search followed by this with amount 1, only for a player who found a card. The counted draw of
Q20 is otherwise unchanged: other boxes and saved games draw as before, because no earlier instruction sets a
credit. The mulligan is the ordinary one: the ally may be discarded, and the player draws back up to hand size.

**As read.** In player order, each player looks at their whole deck, takes any ally (in an expert campaign one that
shares a trait with their hero face: `TargetQuery.sharesTraitWith`, Team-Building Exercise `ant` 12024; **verify**
that it reads the hero face's traits while the identity is still in alter-ego form), and shuffles. Cards the
mission's Setup cell shuffled into the deck are in it already (printed order). An ally whose text answers entering a
hand (§3.42) resolves then.

**Tests (exact numbers).** A hand size of 6: after campaign setup the player holds 1 card, draws 5, holds 6; a
mulligan of the ally and 2 others draws 3. A deck with no ally: nothing found, 6 drawn. Expert campaign, a hero
with [AVENGER] only and a deck whose allies are all [X-MEN]: nothing found. A standalone game of the same scenario:
6 drawn, no search.

### 3.45 The campaign definition: random strike lists, three-cell rows, rewards, a win that loses

> **Status: exists (verify).** The foundation was surveyed against this rulebook, and every piece is in
> `packages/engine/src/campaign.ts` citing it: `LogFieldType strikeList`; `CampaignOp random` over
> `fieldOptions { unstruckOnly }` ("MC45 p. 5"); `strike`; `CampaignPredicate notStruck`; `choose` from `collection`
> with `CollectionFilter.categories` ("MC45 p. 24") and `sharesTraitWithIdentity` ("MC45 p. 20"); `grantCard`,
> `removeFromCampaign`; `endCampaign` ("MC45 p. 20 … winning the last scenario can still lose the campaign");
> `everyNodeSetup` ("MC45 p. 20 prints the same mission-area block"); `composeEncounterSets`, `setAsideCards`;
> `CampaignGameQuery cardsDefeated`, `cardsInVictoryDisplay`; `EliminationPolicy`; the expert helpers of
> `packages/cards/src/campaigns/expert-helpers.ts`. None has been run by a definition of this shape.

**Cards.** The log (MC45 p. 24) and the five boxes. The definition is `packages/cards/src/campaigns/aoa.ts`, the
`next_evol.ts` shape: `graph: { kind: "linear" }`, five nodes, `loss: { retry: "free", retryBaseline: "nodeStart",
citation: "MC45 p. 4" }`, `elimination` as `mut_gen.ts`'s (expert campaign only).

**Rules.** MC45 pp. 4, 6, 20, 24. RRG 1.8 "Modes of Play" (pp. 28–29); "Campaign-Specific Card" (p. 11); FAQ
"Campaign Mode" (p. 61).

**Plan (definition level, in printed order).**

- **Setup, every node** (`everyNodeSetup`; scenario 5's own second bullet replaces the draw):
  - `composeEncounterSets [age_of_apocalypse]` into the deck.
  - `random` one option of `missions` (`unstruckOnly`), `setField currentMission`; then, by `currentMission`, the
    `setAsideCards` that game needs (the mission's a face; and its row's cards: four Desperate Measures, one Panicked
    Refugees for each seat, North American Sea Wall, or the four campaign allies) and the `inGame` Setup cell.
  - `random` one option of `overseers`, `setField currentOverseer`, `setAsideCards` of that minion; `inGame`: put
    the mission and the Overseer into the area (§3.33) and Mission Team under the first player's control.
  - The carried rows, each gated on its result field: `resultLiberate = defeated`: each player may shuffle 1
    Desperate Measures into their deck; `resultEvacuate = notDefeated`: each player shuffles 1 Panicked Refugees
    in; `resultSabotage = notDefeated`: North American Sea Wall is shuffled into the encounter deck.
  - The ally search (§3.44); scenario 5's `cannotEnterPlay` (§3.43); the expert pair (below).
- **A draw per attempt (§4.1 Q22 = B).** On a loss the runner restores the campaign's RNG with the log
  (`retryBaseline: "nodeStart"`, `campaign/runner.ts`), so a `random` op repeats its draw on every retry today.
  **`CampaignOp random` gains `perAttempt?: true`**, set on the two draws above. The op still takes one value from
  the campaign RNG, so every later draw of the block keeps its place (the game's seed included); the option is picked
  from that value mixed with the number of times the node has already been played, the mix `gameSeedFor` uses for
  the game's own seed. A node's first attempt is the plain draw, so no other box and no saved campaign changes;
  attempt n is a pure function of the log, so a replay reproduces it. The step is traced with its attempt number.
  This is the row's one engine change (§8.2 task 42) and it postdates the status line above.
  `choose.repeatOnRetry` (wave 7 §3.40, NeXt Evolution's own rule, MC40 p. 7) is the opposite flag and is not used.
- **Victory, nodes 1 to 4:** `record` `missionDefeated` (`cardsDefeated` by the mission's name) and
  `overseerDefeated` (`cardsInVictoryDisplay` with the [OVERSEER] trait); `strike` `currentMission`; write its
  result field; run that row's Defeated or Not Defeated cell (`removeFromCampaign`, `choose` + `grantCard`); `strike`
  `currentOverseer` if defeated; the expert hit point record.
- **Victory, node 5:** Protect the Professor defeated: the campaign is won. Not defeated: `endCampaign lost`.
- **Expert:** `hpRecord` and `hpSet` as they are; the heal is a third helper beside `healToFull` and
  `healWithFacedownCard`, whose price is `placeThreat(3)` on the area's [MISSION] side scheme, forced for a seat with
  no recorded hit points.

**To verify.**

- A later setup instruction's `when` reads a field an earlier instruction of the same list wrote (`currentMission`).
- `setAsideCards` copies by `seatCount` for Panicked Refugees; campaign set-aside cards exist before the
  `beforeScenarioSetup` window (§3.46 needs it).
- A granted campaign ally (unique, one copy in the box) cannot be granted to two seats: the Defeated cell's `choose`
  uses `excludeGranted`.
- "From any aspect" and the deck-size exemption: §4.1 Q24 = A and Q25 = A. A grant today is exempt from the minimum
  and the maximum (`CampaignSeatInput.grantedCardIds`; `deck.ts` leaves granted copies out of the count), which is
  not what this box prints. Q25 = A needs the grant's deck-size rule as data (§8.2 task 43), and its exact value
  needs one confirmation from the owner (§8.6 item 1).
- An expert campaign is not lost by losing scenario 5: this box prints no such sentence (foundation row 15 lists the
  boxes that do, and MC45 is not among them), so the definition has no `defeat` block.

**Tests (exact numbers).** A seeded standard campaign, 2 seats.

1. Scenarios 1 to 4 draw four different missions; the same seed with no loss draws the same order; after four wins
   `missions` has
   four struck names and four result fields are set.
2. Evacuate Survivors drawn in scenario 2 and not defeated: scenarios 3, 4 and 5 each start with 1 Panicked Refugees
   in each deck (2 in the game). Defeated instead: the four copies are removed from the campaign and each
   seat holds one granted upgrade.
3. Liberate the Seattle Core defeated in scenario 1: in scenario 2 each player is offered 1 Desperate Measures; one
   accepts: 1 copy is in that deck and none in the other.
4. Find Lost Mutants defeated: two seats pick different allies; the two unpicked are simply unused. Not defeated:
   all four are removed from the campaign.
5. Sugar Man defeated in a won scenario 1: scenarios 2 to 5 never draw him. Defeated in a lost scenario 1: he is not
   struck, and the retry draws from all five Overseers and all four missions again.
6. Scenario 5 won with Protect the Professor defeated: status `won`. Won with it on its a face: status `lost`.
   Lost because it failed: the node is retried.
7. Expert: a seat recorded at 4 of 12 starts scenario 2 at 4 hit points; paying, it is at 12 and the mission at
   10 + 3 = 13. A seat eliminated in a won scenario 1 has no record, must pay, and made no pick in scenario 1's
   Defeated cell.
8. **Q22 = B.** 200 seeds, scenario 1 lost once and retried. Every retry draws 1 of the 4 unstruck missions and 1 of
   the 5 unstruck Overseers; at least one seed's retry has a different mission from its first attempt and at least
   one has the same (a fresh draw, not one that excludes the last); replaying each log reproduces both attempts'
   draws and both game seeds; a second loss draws a third time. With `perAttempt` off (a fixture definition) all 200
   retries repeat the first draw, which is the runner's behavior today.

### 3.46 One printed card as two cards: an Overseer in play and its Prelate face

> **Status: extend**, if §4.2 Q21 is answered A; nothing to build if B. `otherFaceId` joins two card records, and
> the engine flips one instance between them (`resolve/other-face.ts`). No query asks "the other face of that card",
> and nothing stops two instances, one of each face, from being in one game.

**Cards.** 45179a/b–45183a/b, in a campaign game of scenario 3 only: the one game that has the `prelates` set and an
Overseer.

**Rules.** MC45 p. 14: "The [PRELATE] minions (179-183) are found on the reverse sides of the [OVERSEER] minions.
Defeating a [PRELATE] minion does not remove its [OVERSEER] version from the campaign." **Ruling April 30, 2026 –
Ruling 4 (2).** RRG 1.8 "Double-Sided Card" (p. 17).

**The point.** The ruling settles the log: a struck Overseer leaves its Prelate in scenario 3. It does not say what
happens inside one game, where one piece of cardboard cannot be the Overseer in the mission area and a set-aside
Prelate at once. On the table, scenario setup comes first (the 1A Setup reveals one of five Prelates), then the
campaign draws an Overseer from the cards that are left, and three Prelates remain set aside for the three schemes:
exactly enough, never one to spare.

**Plan (Q21 = A).** **`TargetQuery.otherFaceOf: TargetRef`** (a card whose id is the ref's `otherFaceId`). In node
3 the definition removes from the game, before the 1A Setup (`beforeScenarioSetup`), the set-aside Prelate that is
the other face of the Overseer drawn; the scenario then reveals one of four and three stay set aside. The draw
order is the reverse of the table's (the Overseer first, then the Prelate), because the runner draws between games;
the pairs that can occur are the same, their odds differ slightly. The Dossier says which Prelate is absent and why.

**Tests.** Scenario 3 in a campaign with Sugar Man drawn as the Overseer: 45182b is removed from the game at setup,
four Prelates are set aside, one is revealed, and after the three schemes none is left. With Sugar Man struck from
the log and Abyss drawn: 45182b is in the game (the ruling), 45181b is not. Standalone: five Prelates. Scenario 3
lost with Sugar Man as the Overseer and retried with Abyss drawn (Q22 = B): the retry removes 45181b and has 45182b
set aside again.

### 3.47 Reusable as is (pass 1c, checked against the engine unions)

| Card text or instruction                                                                             | Existing vocabulary                                                                                             |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| "Shuffle the Age of Apocalypse modular set into the encounter deck"                                  | `CampaignOp composeEncounterSets` (into the deck)                                                               |
| "Randomly select one of the available …"                                                             | `CampaignOp random` over `fieldOptions { unstruckOnly }`, from the campaign's RNG                               |
| "The first player takes control of the Mission Team (171A) support card"                             | `setAsideCards` + `putIntoPlay` under `firstPlayer` (Venom, `sm`, MC27 p. 13)                                   |
| "Each player shuffles a copy of Panicked Refugees into their deck"                                   | `moveCards` from the set-aside area to a player's deck, shuffled (encounter cards in player decks, wave 5 §3.5) |
| "Shuffle the North American Sea Wall side scheme into the encounter deck"                            | `moveCards` to the encounter deck, shuffled                                                                     |
| "Place 2[per_hero] threat on the main scheme"; "Deal each player a facedown encounter card"          | `placeThreat`, `dealEncounterCard(eachPlayer)`                                                                  |
| "Each player searches their deck and discard pile for 1 card / an ally and adds it to their hand"    | `forEachPlayer` + the search of deck and discard pile (Suit Up 45017)                                           |
| "Each player discards 1 card from their hand"; "each player deals 3 damage to an enemy"              | `forEachPlayer`, `discardFromHand`, `chooseTarget` + `dealDamage`                                               |
| "Each player adds 1 copy of the Desperate Measures upgrade / one set-aside campaign ally"            | `forEachPlayer`, a pick from `encounterSetAside`, `moveCards` to hand                                           |
| "The players lose the game"                                                                          | `endGame` (loss)                                                                                                |
| "Find North American Sea Wall and reveal it" / "remove it from the game"                             | §3.1; `moveCards` to `removedFromGame`                                                                          |
| "Hinder 2[per_hero]. Surge. Victory 2." / "The villain cannot take damage."                          | keywords; `cannotTakeDamage` (Madame Hydra, core 01181)                                                         |
| "[star] Boost: Deal this card to yourself as a facedown encounter card."                             | `dealAsEncounterCard` (wave 7 §3.38)                                                                            |
| "Give the activating enemy an additional boost card."                                                | `extraBoostCards` (§3.12)                                                                                       |
| "Take 1 damage and this card gains surge"                                                            | `dealDamage` to your identity, a gained surge (wave 1)                                                          |
| "Action: Exhaust Mission Team → choose a player to draw 1 card."                                     | `exhaustSelf` cost, `chooseTarget` of a player, `draw`                                                          |
| "Alter-Ego Action: Exhaust your identity → remove this card from the game."                          | a form-limited action on an obligation in play (wave 7 §3.70)                                                   |
| "Response: After [ally] enters your hand, …" (45172–45175)                                           | `on.thisEntersYourHand()` (wave 6 §3.10); `removeThreat`, `dealDamage`, `giveStatus`                            |
| "Attach to an ally. Limit 1 per ally."; "+1 THW, +1 ATK, +1 hit point"                               | host `ally` with one per host; `StatModifierSpec`                                                               |
| Expert: record, set, pay to heal; a defeated player sits out and must pay                            | `expert-helpers.ts` (wave 7 §3.46); `EliminationPolicy`                                                         |
| "Strike the [MISSION] side scheme"; "strike its name from the campaign log"                          | `CampaignOp strike`                                                                                             |
| "Each player chooses an upgrade / a support from any aspect … 1 copy … for the rest of the campaign" | `choose` (each seat) from `collection { categories }`, `grantCard` with `permanence: "campaign"`                |
| "Remove … from the campaign"                                                                         | `removeFromCampaign`                                                                                            |
| "The players … lose the campaign"                                                                    | `endCampaign { result: "lost" }`                                                                                |

### 3.48 The top card of a player's deck kept faceup

> **Status: new.** A deck is closed by rule whatever a card's `faceup` flag says (`visibility.ts`, `isDeckZone`). Two
> exceptions exist: the cards an open decision offers out of a deck (a search, `lookAt`), and one viewer's standing
> look at the top of the **encounter** deck (`RuleSpec mayLookAtTopOfEncounterDeck`, wave 5 §3.28). Nothing shows the
> top card of a **player** deck to every player. Searched `visibility.ts`, `rules.ts`, `abilities.ts` and the DSL for
> "faceup", "top of deck" and a deck-top rule.

**Cards.** Magik 45030a ("Play with the top card of your deck faceup.").

**Rules.** MC45 p. 22 ("While in hero form, keep the top card of your deck faceup"). RRG 1.8 "Player Deck" (p. 33:
"The order of cards within a player's deck cannot be changed unless …"); "Look, Looked-At" (p. 27); "'Swap'" (p. 42);
"Text Box" (p. 44); FAQ "Magik (#30A)" (p. 64), first entry. Ruling April 30, 2026 – Ruling 3 (7).

**Plan.**

- **`RuleSpec topOfDeckFaceup { player: PlayerRef; while? }`**, a constant on the hero face. While it is active the
  top card of that player's deck is visible to every viewer (`visibility.ts`: a third exception, read from the rule
  as `mayLookAtTopOfEncounterDeck` is). No flag is stored on the card: which card is visible is derived from the
  deck's order and the rule, so a save, a replay and a reconnect cannot disagree about it.
- **It is not a look, a reveal or a search.** Nothing triggers, the deck's order does not change, and the card is
  still in the deck for every rule (it is not in hand, not in play).
- **Log:** `deckTopShown { playerId, instanceId }` whenever the visible card changes while the rule is active (a
  draw, a discard, a play from the top, a swap, a shuffle, a deck reset, a card put on top) and when the rule turns
  on; `deckTopHidden { playerId }` when it turns off. A replay then shows what every player knew at each decision.
- **Checked after every card move**, one card at a time: a draw of 2 shows the second card before it is drawn, as
  the table does.
- **Off** in alter-ego form (the line is on the hero face) and while her text box is blank (Pestilence, §3.13): the
  card is facedown again. **A facedown top card satisfies no condition (§4.1 Q26 = B):** the game does not read a
  hidden card to answer a question about its icons, so every "the top card of your deck has" test is false while the
  rule is off, whatever the card is. **`Predicate topOfDeckFaceup { player }`** reads the rule, and §3.50's helper
  requires it.
- An empty deck shows nothing. A deck reset shows the new top card after the shuffle.
- Any card can be the top card: an encounter card that lives in a player deck (Panicked Refugees, §3.42) is shown
  like any other and stays there until it is drawn.

**The mission touch point (§3.36, §3.38).** When Magik makes a mission attempt the first card discarded is the card
everyone can see, so she knows one icon before she chooses the attempt, and Limbo, Stepping Disc, Scrying and her
alter-ego Interrupt each set it. After the X discards the next card is shown. No Mission Response reads the rule.

**Tests (exact numbers).**

1. Magik in hero form, deck top Clobber: every seat's view shows Clobber on her deck. The second card is hidden from
   every seat, hers included.
2. She plays Spiritual Meditation from her hand and draws 2: two `deckTopShown` entries (the second card, then the
   third).
3. She changes to alter-ego form: `deckTopHidden`, and no seat's view shows the card. Back to hero form with nothing
   moved: the same card is shown.
4. Limbo's Action with Soul Strike in hand and Clobber on top: Soul Strike is shown on the deck, Clobber is in her
   hand (RRG p. 42: the swapped card takes the faceup orientation).
5. A deck of 2 cards and 6 cards in her discard pile; she plays Spiritual Meditation: both are drawn, the 6 cards are
   shuffled into a new deck (Spiritual Meditation is not among them, ruling April 30, 2026 – Ruling 3 (7)), its top
   card is shown, she is dealt 1 facedown encounter card, then she discards 1 card from her hand.
6. Pestilence blanks her text box: hidden until the next villain phase begins, then shown. While it is hidden
   `topOfDeckFaceup` is false and no card's "top card has" condition is met (§3.50 test 7).
7. Magik makes a mission attempt with two allies at the mission and Magik's Crown on top: the Crown and the card
   under it are discarded; the third card is shown.

**Composes with:** §3.49, §3.50; any later "play with … faceup".

### 3.49 Playing the top card of your deck as if it was in your hand, for 1 less, once per phase

> **Status: extend.** The play-permission family exists: `playableFrom: ["discard"]` on the card itself (Lockjaw),
> `playableAttachments` on a host (Hawkeye's Quiver, wave 2 §3.10), and `EffectSpec playFromHand`, whose `from` is the
> hand, the set-aside area, the deck or a tuck, with a `costReduction`. None is a standing permission over the top of
> a deck, none carries its own per-phase limit, and none lets a "play a card from your hand" effect reach outside the
> hand.

**Cards.** Magik 45030a ("Once per phase, you may play the top card of your deck as if it was in your hand, reducing
its resource cost by 1."). Through it: Colossus 45031 (§3.56), Magic Barrier 45040, every card of her deck.

**Rules.** RRG 1.8 "Initiating Abilities" (p. 24); "Play, Put into Play" (p. 32: "A card that is put into play is not
considered to have been played"); "Play Restrictions and Permissions" (p. 33); "Limit" (p. 27: a canceled use still
counts); "Cost" (p. 13). **FAQ "Magik (#30A)" (p. 64), all four entries.** The FAQ's "step 3" is RRG p. 24's step 1
(§0.3).

**Plan.**

- **A constant `playableTopOfDeck { player: you, costReduction: 1, limit: "phase" }`** beside `playableAttachments`.
  While it is active, the top card of the player's deck is a candidate **wherever a card in their hand could be
  played**:
  - a play command on their turn (`legalActions` lists it with `from: "deckTop"`);
  - an event, or an `inHand` ability that plays its own card, offered in a timing window (Magic Barrier in the
    villain phase; Colossus's Interrupt);
  - the card choice of an `EffectSpec playFromHand` whose `from` is the hand (FAQ entry 2: "Any time Magik has an
    opportunity to play a card from her hand, she may choose to play the top card of her deck instead").
- **The same play sequence** (`resolve/play-card.ts`). Step 1 moves the card from the deck to the table, so the
  next card is the top card at once and §3.48 logs it **before** restrictions are checked and the cost is paid (FAQ
  entry 1). The cost is the card's cost less 1, to a floor of 0, with every other modifier applied as usual; it is
  paid from her hand and her resource abilities. The new top card is not in her hand and cannot pay.
- **It was played from her hand** (FAQ entry 3): the `cardBeingPlayed` / `cardPlayed` events report the hand as
  where it was played from, so "after you play [card] from your hand" answers, and every "played this turn / round /
  phase" count includes it. The log keeps the truth: `cardPlayed { from: "deckTop", countsAsFrom: "hand" }`.
- **Only playing.** The top card is in the deck for everything else: it cannot be put into play "from your hand"
  (FAQ entry 4), discarded to generate resources, chosen for a cost or an effect that names a card in hand (Malcolm,
  Limbo's swap, Temporal Trickery), or counted in her hand.
- **Limit.** Once per phase for the player, shared by all three routes above, used when step 1 moves the card, and
  still used if the play is then canceled (RRG p. 27). A new phase gives a new use: one in the player phase, one in
  the villain phase.
- **The reduction belongs to the permission**: it applies to that play and to nothing else. Whether it adds to the
  reduction of the effect she is playing through is §4.2 Q27 (default A: both apply).
- Off in alter-ego form and under a blank text box, with §3.48.

**As read.**

- A resource card or an encounter card on top cannot be played, so nothing is offered and the limit is not used.
- A card played from the top reads **the next card** when its own text says "the top card of your deck" (FAQ
  entry 1): Soul Strike off the top stuns by the card that was second.
- Form and timing are the played card's own: a Hero Action event only on her turn, a Hero Interrupt in its window.
- An ally played this way is played, so in a campaign game it may go to the mission (§3.34), and Mission Team's
  discount and this reduction both apply.
- Stepping Disc played from the top is on the table while it resolves, not in her discard pile.

**Tests (exact numbers).**

1. **FAQ entry 1.** Deck from the top: Soul Strike (cost 2), Strength, Clobber. She plays Soul Strike from the top:
   `deckTopShown` (Strength) is logged before any resource is spent; she pays 1; 4 damage, and the enemy is stunned
   (Strength prints [physical]). With Genius second instead: 4 damage, no stun.
2. **The limit.** Later that phase the new top card is not offered (`whyNot`: once per phase). In the next villain
   phase Magic Barrier (cost 1) is on top and an enemy initiates an attack of 5: she plays it from the top for 0, 3
   is prevented and she takes 2 (no DEF: a defense ability is not a basic defense, RRG p. 15).
3. **FAQ entry 2.** Team-Building Exercise (`ant` 12024: "play a card from your hand that shares a trait with your
   hero, reducing its resource cost by 1") with Colossus (X-MEN, cost 3) on top: he is offered beside her hand
   cards. Q27 = A: she pays 1. The once per phase is used.
4. **FAQ entry 3.** Pixie (`storm` 36017: "After you play Pixie from your hand, add an [X-MEN] ally from your discard
   pile to your hand.") on top, Colossus in her discard pile: she plays Pixie (cost 2) for 1, the Response is
   offered, Colossus is in her hand.
5. **FAQ entry 4.** Mutant Protectors (`mut_gen` 32017: "put an [X-MEN] ally into play from your hand") with Colossus
   on top and no ally in her hand: the event has no card to put into play and cannot be played. With Triage in hand:
   only Triage is offered.
6. **Paying.** Exorcism (cost 2) on top, a hand of one card: she pays 1 with it. With an empty hand and no resource
   ability: not offered. Stepping Disc (cost 1) on top with an empty hand: offered, costs 0.
7. Alter-ego form, or her text box blank: not offered; Team-Building Exercise offers hand cards only.
8. Energy on top, or Panicked Refugees: nothing offered, the limit unused.
9. A canceled play: an encounter ability cancels Soul Strike played from the top: the limit is used, the card is in
   her discard pile, the next card stays shown.
10. **Campaign.** Mission Team's discount in effect (§3.35) and Goldballs (cost 3) on top: played to the mission for 0.

**Composes with:** §3.48, §3.34, §3.35, §3.56; wave 2's `playFromHand`.

### 3.50 "The top card of your deck has a [type] or [wild] resource icon"

> **Status: exists (verify).** `topOfDeck(1)` is a `CardSelector`, `cards(ref, filter)` narrows a selection,
> `TargetQuery.anyPrintedResource` is the OR of printed icon types (Tombstone, `gob`), and `compare` over a count is a
> `Predicate`. Not run: a constant modifier whose `while` reads a deck zone, so that a stat changes the moment the top
> card does with no ability resolving (draw, discard, shuffle, swap, deck reset).

**Cards.** Magik's Crown 45033 (+1 THW, [mental] or [wild]); Soulsword 45034 (+1 ATK, [physical] or [wild]); Mystical
Armor 45035 (+1 DEF, [energy] or [wild]); Exorcism 45038 (confuse the villain, [mental] or [wild]); Soul Strike 45039
(stun that enemy, [physical] or [wild]); Magic Barrier 45040 (3 damage to the attacker, [energy] or [wild]).

**Rules.** RRG 1.8 "Printed" (p. 35); "Wild Resource" (p. 48: outside a cost a wild is only a wild, which is why each
card names it); "Constant Ability" (p. 13); "Modifiers" (p. 29). Ruling April 30, 2026 – Ruling 3 (6).

**Plan.** One helper in `@mc/cards`, `topOfYourDeckHas(type)`: the top card of your deck is faceup (`topOfDeckFaceup`,
§3.48; §4.1 Q26 = B) and at least 1 card of `topOfDeck(1, you)` matches `{ anyPrintedResource: [type, "wild"] }`. The
three upgrades use it as the `while` of a stat modifier on the identity named Magik; the three events use it as the
condition of their second sentence, read when that sentence resolves (after the threat is removed, after the damage is
dealt, when the prevention is applied).

- The icons are the card's printed ones. A card with two icons of one type (Genius) has that type once for this
  test; Stored Energy would satisfy two of the three.
- An empty deck, or a top card with no icon (an encounter card), satisfies none.
- **A facedown top card satisfies none (§4.1 Q26 = B).** The upgrades only change a hero's stats, so alter-ego form
  never asks the question; a blank hero text box does (Pestilence 45083a/b, Plague and Pestilence 45088). While it
  is blank the three upgrades give no bonus and the three events resolve their first sentence only, until the card
  is faceup again. The events can still be played: she pays knowing the second sentence will not happen. Nothing
  about the hidden card is shown or logged.
- If the verify fails, the fix is the modifier cache's dependency on the deck's top card, not a new predicate.

**Tests (exact numbers).**

1. Soulsword in play (ATK 2): Clobber on top, ATK 3; Bloodgem ([wild]) on top, 3; Genius on top, 2; an empty deck, 2.
   She draws Clobber and Genius is next: ATK is 2 with no ability resolving.
2. All three upgrades and The Power of Aggression ([wild]) on top: THW 2, ATK 3, DEF 3.
3. Exorcism on a scheme with 6 threat, Magik's Crown ([mental]) on top: 2 threat, the villain is confused. Clobber on
   top: 2 threat, no confused card.
4. Soul Strike that defeats its target: no stunned card is given to anything.
5. Magic Barrier against an attack of 5, Mystical Armor ([energy]) on top, played from her hand: 3 prevented, she
   takes 2, the attacker takes 3.
6. Soulsword and a basic attack against a tough minion with Clobber on top: the attack has piercing, the tough card
   is discarded and 3 damage is dealt.
7. **Q26 = B.** Soulsword in play and Clobber ([physical]) on top: ATK 3. Pestilence attacks her and blanks her text
   box: the top card is facedown and her ATK is 2 until the next villain phase begins, then 3 again with nothing
   moved. While it is blank: Soul Strike from her hand deals 4 damage and gives no stunned card; Exorcism on a scheme
   with 6 threat, Magik's Crown on top, leaves 2 and confuses nobody; Magic Barrier against an attack of 5, Mystical
   Armor on top, prevents 3, she takes 2 and the attacker takes 0.

### 3.51 "If you paid for this event with a resource card"

> **Status: extend.** A play records what was paid as vars on its frame (`paid.physical`, `paid.mental`,
> `paid.energy`, `paid.wild`, `paid.total`, `overpaid.<type>`, `paid.ability.<abilityId>`; `actions.ts`), read by
> `Predicate paidWith { resource }` and `paidWithOnly`. It records types and amounts, not which cards were discarded.

**Cards.** Concussive Blast 45007 ("If you paid for this event with a resource card, ready Bishop."); Command
Authority 45008 ("… draw 1 card.").

**Rules.** RRG 1.8 "Cost" (p. 13: "a player spends resources that they generate by discarding cards from their hand
or by using 'Resource' card abilities"; "Resources generated beyond the specified cost are considered to have been
overpaid for that cost and were not paid for that cost"); "Resource Card" (p. 37); FAQ "Unstoppable Force (#6)"
(p. 60: at a cost of 0 nothing was paid).

**Plan.** The payment also records `paid.cards.<cardType>`: how many cards of each type were discarded from hand to
generate its resources. **`Predicate paidWithCard { cardType: "resource"; of? }`** reads it, with `of` as `paidWith`
has it. A resource ability (Bloodgem) is not a resource card; The Power of Leadership is one. What counts when more
was generated than the cost is §4.2 Q28 (default A: the cost was at least 1 and a resource card was among the cards
discarded for it).

**Tests (exact numbers).**

1. Concussive Blast (cost 3) paid with Strength and Clobber, Bishop exhausted: 6 damage, Bishop readies.
2. Paid with three cards that are not resource cards: 6 damage, he stays exhausted.
3. Paid with Stored Energy ([energy][physical]) and one other card: he readies.
4. Command Authority (cost 2) paid with The Power of Leadership (1 [wild]: the event is not a Leadership card) and
   one other card: 3 threat removed, 1 card drawn.
5. Command Authority paid with a resource ability's [wild] (a fixture upgrade) and a card that is not a resource
   card: no draw.
6. Q28 = A: its cost reduced to 0 by a fixture, Energy discarded anyway: 3 threat removed, no draw.

### 3.52 Resource cards as a card type: discarded, counted in hand, kept from a deck discard

> **Status: exists (compose).** `"resource"` is a `TargetCategory`. Pieces: a hand-discard cost with a filter whose
> cards are bound (`discardFromHandCost(1, 1, bind, filter)`, slot `discard`); `totalPrintedResources` over a slot;
> `TargetQuery.printedResource` (a wild is only a wild); `handCountOf(you, filter)`, read live; a deck discard whose
> cards are bound and filtered (`moveCards(topOfDeck(n), "discard", bind)` then `cards(chosen(bind), filter)`: Aunt May
> & Uncle Ben, `spdr` 31007; wave 7 §3.55); `eventAmount` on a damage event; `maxDamageTaken` as a lasting rule
> (wave 3 §3.15, wave 6 §3.4); the obligation shape; a superlative over hand cards with any `ValueSpec` as its
> measure (Burn Notice); §3.39's named moment.

**Cards.** Bishop 45001a; Malcolm 45002; Randall 45003; Bishop's Rifle 45004; Bishop's Uniform 45005; Super-Charged
45006; Energy Conversion 45009; Fear the Future 45025; Temporal Trickery 45029; Advanced Suit 45014.

**Rules.** RRG 1.8 "Resource Card" (p. 37); "Player Deck" (p. 33: "If the player's deck empties while the player was
discarding cards from their deck, no further cards are discarded from the newly shuffled deck"); "Printed" (p. 35);
"Wild Resource" (p. 48); "Max, Maximum" (p. 28: "The parenthetical '(to a maximum of [value])' within an ability
imposes a maximum on that ability"); "Defend, Defense" (p. 15); "'Cannot'" (p. 11). Ruling April 30, 2026 – Ruling 3
(6).

**As read, card by card.**

- **Energy Absorption (45001a).** A Response to each damage event in which Bishop takes 1 or more damage from an
  attack, after defense and prevention: a basic attack or an attack ability of any enemy, and overkill damage that
  reaches him. Not retaliate, indirect damage, a treachery's damage or a cost. X cards are discarded from the top
  of his deck, then each resource card among them goes to his hand; the rest stay in the discard pile. The script
  then raises the moment `"energyAbsorption"` (§3.39) for Bishop's Uniform.
  - A deck of fewer than X cards: what is there is discarded, the deck resets with its facedown encounter card, and
    nothing more is discarded (RRG p. 33). A resource card discarded this way that the reset shuffled into the new
    deck is still one of "the cards discarded this way" and goes to his hand from the deck, which is not shuffled
    again (wave 7 §4.1 Q33, the Teen Spirit precedent).
  - These are ordinary deck discards: a card that answers its own discard answers them (wave 7 §3.55). They are not
    a mission attempt's discards (§3.38), whoever holds Mission Team.
- **Bishop's Uniform (45005).** "After you resolve Bishop's 'Energy Absorption' ability" is
  `on.moment("energyAbsorption")`: only when the Response was used and not canceled, after the resource cards reached
  his hand, which is why they count. Heals 1 per resource card in hand.
- **Malcolm, Randall.** The cost is one resource card from hand; the ally readies (an effect: he may already be
  ready); "If that card has a printed [physical] icon" reads the discarded card's printed icons, so a [wild] heals
  nobody and Stored Energy heals either. Limit once per phase, each.
- **Bishop's Rifle.** Damage is the number of resource cards in hand when the attack resolves, to the enemy chosen
  as part of the cost; the attack has ranged (`attackKeywords { via: self }`). With none in hand it is an attack
  for 0.
- **Super-Charged.** The Action places 1 charge counter per printed icon on the discarded resource card (Energy 2,
  Stored Energy 2, The Power of Leadership 1: its doubling is for paying a Leadership card). The Hero Interrupt, on
  a basic attack, discards the card for +2 ATK per counter to at most +8 for that attack. The cap is each copy's
  own (RRG p. 28): two copies with 4 counters each give +16.
- **Energy Conversion.** A defense: Bishop becomes the defender if there is none, with no DEF applied. Each resource
  card in his discard pile is shuffled into his deck (with none, nothing moves and the deck is not shuffled). "You
  cannot take more than 3 damage from this attack" is `maxDamageTaken` on his identity until the end of the attack:
  the excess is neither taken nor prevented (wave 6 §4.1 Q9). An ally of his that defends is not "you".
- **Fear the Future.** The standard obligation shape. Its second option discards the obligation and every resource
  card in hand; surge if none was discarded.
- **Temporal Trickery.** The player discards one card of their choice among those in hand with the most printed
  icons, and each scheme in play takes that many threat. An empty hand: nothing. In a campaign game "each scheme"
  does not reach the mission (§3.33).
- **Advanced Suit.** "For each resource on that card" is the discarded card's printed icons.

**Tests (exact numbers).**

1. Bishop (DEF 1) defends an attack of 5: he takes 4, discards 4 (Energy, Clobber, Stored Energy, Malcolm): Energy
   and Stored Energy are in his hand, two cards in his discard pile.
2. The same with Bishop's Uniform ready and 1 resource card already in hand: it exhausts, 3 damage healed.
3. A tough status card takes the attack: 0 damage, no Response offered.
4. Retaliate 1 after his basic attack: no Response.
5. A deck of 2 (Energy, Clobber) with Strength among 5 cards in his discard pile; he takes 4: 2 are discarded, the
   deck resets (7 cards), 1 encounter card is dealt, no third card is discarded; Energy is taken from the new deck
   into his hand, Strength is not.
6. Energy Conversion against an attack of 7 with Energy and Strength in his discard pile: both are shuffled into the
   deck, he takes 3, then Energy Absorption discards 3.
7. Malcolm exhausted with 1 damage: Stored Energy discarded: ready, 0 damage. Genius discarded: ready, 1 damage. A
   second use that phase: refused.
8. Bishop's Rifle with Energy, Stored Energy and Clobber in hand: 2 damage; against a retaliate 1 minion Bishop
   takes none.
9. Super-Charged: Energy, then Stored Energy, then Genius: 6 counters; a basic attack (ATK 2): +8, 10 damage, the
   card is discarded.
10. Fear the Future, second option, with Energy and Genius in hand: both discarded, the obligation discarded, no
    surge. With no resource card: surge.
11. Temporal Trickery with Energy (2 icons), Stored Energy (2) and Clobber (1) in hand, main scheme at 3 and a side
    scheme at 1: the player picks Energy or Stored Energy; 5 and 3.

### 3.53 An attach host by classification; "your sidekick"

> **Status: extend.** `classificationsOf` (`select.ts`) reads identity-specific, aspect and basic off card data, and
> `TargetQuery.sameClassificationAs` compares two cards (wave 6 §3.51). No query names a classification outright and
> no attach host is narrowed by one (§1.32). "Your sidekick" needs no engine concept: `hasAttachment` exists.

**Cards.** Sidekick 45015; Side-by-Side 45016.

**Rules.** RRG 1.8 "Attach To" (p. 8); "Identity-Specific Card" (p. 23); "Classifications" (p. 12); "Max, Maximum"
(p. 28: "Max X per deck"); "Upgrade" (p. 46); "Ownership and Control" (p. 31). MC45 p. 22.

**Plan.**

- **`TargetQuery.classification?: "identitySpecific" | "aspect" | "basic"`**, read through `classificationsOf`, and
  the host resolver's reading of §1.32's `HostQualifiers.classification`.
- **Sidekick.** Host: an identity-specific ally the player controls, of any identity's set. "+2 hit points" is a
  stat modifier on the host. "Is your 'sidekick'" is not state: `yourSidekick` in `@mc/cards` is
  `query("ally", { controller: "you", hasAttachment: { name: "Sidekick" } })`, so the designation is true exactly
  while the upgrade is attached with its text box. The Response answers `on.basicRecovery(your identity)`: heal 2
  from the host.
- **Side-by-Side** names `yourSidekick` in its cost (§3.54) and "both characters" is that ally and the hero.
- **At the mission (§3.33, §3.34).** An ally there has no controller, so it is not "an identity-specific ally you
  control" and Sidekick cannot be played on it, although MC45 p. 5 lets upgrades attach there: the upgrade's own
  host text still has to be met. Advanced Suit ("an [X-FORCE] or [X-MEN] ally") can attach there (traits survive the
  blank) and does nothing there: its Response has no controller, and an ordinary upgrade's abilities do not reach
  the area (§4.1 Q19 = B). Team Training's "each ally you control" does not reach the mission.

**Tests (exact numbers).**

1. Bishop controls Malcolm and X-23: Sidekick (cost 1) offers Malcolm only. With X-23 alone: it cannot be played
   (no valid host, RRG p. 24 step 2).
2. Malcolm (3 hit points) with Sidekick: 5; with Team Training too: 6. Sidekick discarded with 4 damage on him: he
   is defeated.
3. Lucas Bishop recovers (REC 4): 4 healed from him, then the Response heals 2 from Malcolm.
4. Malcolm at the mission: not offered as a host.
5. A second seat's Colossus (45031) under Bishop's control by a fixture: a legal host.

### 3.54 A cost that readies a card

> **Status: extend.** `AbilityCost` has `exhaustCards`, `returnToHand`, `discardCards` and `damageCards` over an
> `InPlayCostPick`, and no cost that readies. `ready` is an effect.

**Cards.** Side-by-Side 45016 ("Hero Action: Ready your sidekick → ready your hero and choose one: …").

**Rules.** RRG 1.8 "Cost" (pp. 13–14: paid in full or not at all); "Cost Arrow Icon" (p. 14); "Ready" (p. 36: "If a
player is instructed to ready an exhausted card, the card is returned to its ready state").

**Plan.** **`AbilityCost.readyCards: InPlayCostPick`**: the picked cards ready as the cost. Whether a card that is
already ready can pay it is §4.2 Q29 (default A: no; the pick offers exhausted cards only, as `exhaustCards` offers
ready ones). An additional cost to ready the card (`RuleSpec readyCost`, wave 4 §3.19) is paid with it or the cost
is not paid. "Ready your hero" after the arrow is the ordinary effect and does nothing to a ready hero.

**Tests (exact numbers).**

1. Malcolm (ATK 2, THW 1) with Sidekick, exhausted, 2 damage; Bishop (THW 2, ATK 2) exhausted, 3 damage. Side-by-Side
   (cost 2), first option: both ready; Malcolm 1 damage, Bishop 2.
2. Second option: Malcolm THW 2, ATK 3 and Bishop THW 3, ATK 3 until the end of the phase; back to printed in the
   villain phase.
3. Q29 = A: Malcolm ready: the event cannot be played. No Sidekick in play: it cannot be played.
4. Alter-ego form: not playable (Hero Action).

### 3.55 A deck discard cost of a chosen size

> **Status: extend.** `AbilityCost.discardFromDeck` is a number or a `ValueSpec` with `discardFromDeckSlot` binding
> the cards (wave 3 §3.33; Shield Spell's `eventAmount`). The paying player never chooses how many. `damageSelf` has
> the choice shape (`{ choose: { min, max } }`).

**Cards.** Goldballs 45041 ("[star] Interrupt: When Goldballs attacks, discard up to 3 cards from the top of your
deck → Goldballs gets +X ATK for this attack, where X is the number of cards discarded this way.").

**Rules.** RRG 1.8 "Cost" (p. 14: "A cost requiring 'any number' or 'up to' some number of game elements requires a
minimum of one such game element"); "Player Deck" (p. 33); "Star Icon" (pp. 40–41).

**Plan.** `discardFromDeck` also takes **`{ choose: { min: 1, max: 3 } }`**: the player picks a number from 1 to the
smaller of 3 and the cards in the deck, pays it, and the count is bound for the effect (`+X ATK` until the end of the
attack). A deck the cost empties resets at once; an empty deck with an empty discard pile cannot pay. The cards are
ordinary deck discards.

**Tests (exact numbers).**

1. Goldballs (ATK 1) attacks, 3 discarded: 4 damage, 1 consequential damage to him.
2. A deck of 2: 1 or 2 may be chosen; with 2 the deck resets, 1 facedown encounter card is dealt, +2 ATK.
3. Declined: 1 damage. Zero cannot be chosen as a payment.
4. Goldballs at the mission: no Interrupt (blank, §3.34); his ATK 1 counts in the pool.
5. In Magik's deck: after the discards the new top card is shown (§3.48).

### 3.56 An ally that plays itself from hand into an attack and defends without exhausting

> **Status: exists (verify).** `inHand(interrupt(…))` (an ability active in hand, wave 4 §3.13),
> `playFromHand { card: self }`, `declareDefender(character, { exhaust: false })` and the toughness keyword on
> entering play. Not run:
> an `inHand` interrupt that plays its own card and pays for it inside an enemy attack; an ally that enters play
> after the attack began and becomes its defender; the ally limit applied at that moment.

**Cards.** Colossus 45031 ("Toughness. Interrupt: When an enemy attacks you, play Colossus from your hand (paying his
resource cost) and declare him the defender without exhausting him.").

**Rules.** RRG 1.8 "Attack (Enemy Activation)" (pp. 8–9, step 2 "Declare defender"); "Defend, Defense" (p. 15: "When
a card ability says to 'declare [an ally] the defender' of an attack, that ally becomes the defender of the attack";
only one defender); "Toughness" (p. 45); "Ally Limit" (p. 7); "Play, Put into Play" (p. 32).

**Plan.** No engine change is expected. The Interrupt is offered to the attacked player before a defender is
declared, when the card is in their hand (or on top of Magik's deck, §3.49), the cost of 3 can be paid and the unique
rule lets him enter (§3.58). He enters play ready with a tough status card, is declared the defender ready, and the
attack's damage discards the tough card.

**As read.**

- It is a play: "after you play an ally" answers, he counts as played this round, and a fourth ally makes the
  player discard down to three at once (the player may keep him).
- He may also be played on the player's turn like any ally.
- Once another character has been declared the defender the Interrupt is no longer offered.
- In a campaign game the play's destination is §4.2 Q32 (default A: this play goes to the player's own area).

**Tests (exact numbers).**

1. A villain attacks Magik for 4 (ATK 3, boost 1). She plays Colossus for 3 before the boost card is turned: he is
   the defender and ready; the tough card is discarded; he and Magik take 0.
2. The same from the top of her deck: she pays 2 (§3.49 test, FAQ entry 2).
3. Three allies in play: after he enters she discards one ally of her choice; with Colossus discarded the attack is
   undefended.
4. Two resources available: not offered.
5. A Colossus hero in another seat: not offered (§3.58).

### 3.57 Player cards held facedown on a side scheme; a support returned when it is defeated

> **Status: exists (verify).** `attachCard(card, to, { facedown })` (The Painted Lady, wave 7 §3.58; Abyss, §3.30,
> §3.38), `findCard` with an attach destination (§3.1), "threat cannot be removed … while" (§3.22), `putIntoPlay`
> under an owner's control. Not run: a **side scheme** as the host of facedown player cards; a find that takes a
> support out of play; a card put back into play from an attachment when its host is defeated.

**Cards.** Belasco 45054; Ruler of Limbo 45055; through them S'ym 45056, Witchfire 45057, Battle for Limbo 45058.

**Rules.** RRG 1.8 "Find" (p. 19); "Attachment" (p. 8); "In Play and Out of Play" (p. 23: a facedown card is out of
play); "Villainous" (p. 47); "Amplify Icon" (p. 7); "Leaves Play" (p. 27); "Player Elimination" (p. 34).

**Plan.** No engine change is expected.

- **Ruler of Limbo, When Revealed.** "The Illyana Rasputin player" is the player whose identity card is 45030, in
  either form, whoever revealed the scheme; with no such player nothing is found. She finds Limbo in §3.1's order
  (in play, hand, discard pile, deck) and it is attached facedown to the scheme: out of play, blank, hers. Found in
  play it leaves play; found in the deck the deck is shuffled and §3.48 shows the new top card.
- **"When this scheme is defeated, put Limbo into play under its owner's control."** A Forced Interrupt on the
  scheme that looks for a facedown card named Limbo attached to it: none (the When Revealed was canceled, or Limbo
  was not found) means nothing happens. Limbo is put into play ready, not played.
- **Belasco.** After he activates against a player (a scheme or an attack, each with a boost card: villainous), that
  player discards 3 cards from the top of their deck; discards are settled (`settleDeckDiscards`), then, if Ruler
  of Limbo is in play, those cards are attached to it facedown. A short deck discards what it has and resets; a card
  the reset shuffled into the new deck is still one of "those cards" and is attached from it (wave 7 §4.1 Q33).
- **When the scheme leaves play** every facedown card on it goes to its owner's discard pile, Limbo too unless the
  scheme was defeated. An eliminated player's cards leave with them.
- "Threat cannot be removed from this scheme while Belasco is in play" is §3.22's rule with a named card. The
  amplify icon is the engine's (wave 3 §3.6).
- Nothing counts the facedown cards. The log names each card as it is attached, since each was discarded faceup
  first.

**Tests (exact numbers).** 2 players; Magik is player 2.

1. Player 1 reveals Ruler of Limbo (3 threat) with Limbo exhausted in Magik's play area: Limbo is attached facedown;
   her Limbo abilities are gone; a later boost card with 1 icon counts 2.
2. Belasco (SCH 1, ATK 1) is engaged with Magik in hero form and attacks: 1 boost card; she then discards 3 and all
   three are facedown on the scheme; her discard pile gained none.
3. The same without Ruler of Limbo in play: three cards in her discard pile.
4. Belasco in play: a thwart of 2 against Ruler of Limbo removes nothing and it is not offered as a target.
5. Belasco defeated, then 3 threat removed: Limbo is in play under Magik's control, ready; the three other cards are
   in her discard pile.
6. Limbo in her deck when the scheme is revealed: found, attached, deck shuffled, new top card shown.
7. A deck of 2 when Belasco activates: 2 discarded, the deck resets, both are taken from the new deck and attached.

### 3.58 The unique rule across printings: an ally whose subtitle is a hero's alter-ego

> **Status: exists (verify).** `uniqueEntryBlocker` compares title, subtitle and alter-ego title of faceup cards in
> play (`spec.ts`, `canEnterPlay`; RRG 1.7's rule, the Valkyrie rulings), and deck validation applies the same match
> with the identity included. Not run: an aspect ally of one box against a hero of another; the mission area as a
> place the blocked card cannot go.

**Cards.** Cable 45011 and X-23 45012 (Leadership allies, new printings of wave 7's heroes); Colossus 45031; the
identities 45001a/b and 45030a/b against earlier allies.

**Rules.** RRG 1.8 "Unique Icon" (pp. 45–46): two unique cards match if they "share a title, and both have no
subtitle and no alter-ego title", or if "the subtitle or alter-ego title of one matches the title, subtitle, or
alter-ego title of the other"; "During deckbuilding, a player cannot include multiple matching cards in their deck.
The identity is included in this evaluation"; "Once setup for a game has begun, a player is not prevented from adding
matching cards to their deck through game effects"; a player card out of play that matches a card in play "cannot be
played or put into play. Any effect that attempts to do so has no effect". "Subtitle" (p. 41). Appendix I "Player
Decks" (p. 50). Rulings January 26, 2026 – Ruling 4 (7), March 19, 2026 – Ruling 4 and Ruling 6.

**The matches** (searched every raw pack for these titles and subtitles):

| Card of this pass                       | Matches                                                                         | By                        |
| --------------------------------------- | ------------------------------------------------------------------------------- | ------------------------- |
| Cable 45011, subtitle Nathan Summers    | the hero Cable / Nathan Summers (`next_evol` 40001a/b); the ally Cable 44002    | alter-ego title; subtitle |
| X-23 45012, subtitle Laura Kinney       | the hero X-23 / Laura Kinney (`x23` 43001a/b)                                   | alter-ego title           |
| Colossus 45031, subtitle Piotr Rasputin | the hero Colossus / Piotr Rasputin (`mut_gen` 32001a/b); the ally 32048 / 35021 | alter-ego title; subtitle |
| Bishop / Lucas Bishop 45001a/b          | the ally Bishop, subtitle Lucas Bishop (`gambit` 37011)                         | alter-ego title           |
| Magik / Illyana Rasputin 45030a/b       | the ally Magik, subtitle Illyana Rasputin (`mut_gen` 32042)                     | alter-ego title           |

**What it means for Cable and X-23.**

- **In a deck.** A Cable deck cannot include 45011 and an X-23 deck cannot include 45012 (the identity is part of the
  evaluation). A Deadpool deck holds the identity-specific Cable 44002, so it cannot include 45011. Any other
  Leadership deck may include both, Bishop's starter deck among them.
- **At setup.** A Bishop deck with 45011 beside a Cable hero in another seat is a legal table: the deck rule reads
  one player's deck and identity. Appendix I's swap for a Team-Up card is for identity-specific cards only, and
  these are aspect cards.
- **In the game.** The hero's identity card is in play in either form and carries both titles, so while that hero
  is in the game 45011 (or 45012) cannot be played or put into play by anyone, to a play area or to the mission
  (§3.34). It is a [mental] (or [physical]) resource and nothing else. Suit Up may still fetch it.
- When that hero's player is eliminated the identity is out of the game and the ally can be played.

**Colossus.** Magik's identity-specific Colossus matches the Colossus hero, so beside him it cannot be played and its
Interrupt is not offered; Appendix I would let her swap it for a Team-Up card naming both identities, and none
exists (the Team-Up cards that name Colossus pair him with Shadowcat and Wolverine). It also matches the basic ally
Colossus by subtitle, **which the data does not show**: scan 32048 prints "PIOTR RASPUTIN" under the title, and raw
and the emitted `mut_gen` 32048 and `wolv` 35021 have no subtitle. Today the engine would let that ally into play
beside the Colossus hero and beside 45031. This is a data fix in two earlier packs (§5.3), not an engine change.

**Tests.**

1. Player 1 is Cable; player 2 (Bishop) holds 45011: no play is offered (`whyNot`: unique, matches Cable / Nathan
   Summers), in hero or alter-ego form of either player; it can be discarded for 1 [mental].
2. Player 1 is eliminated: player 2 can play it for 4.
3. Player 1 is X-23, a campaign game: 45012 is offered for neither destination.
4. Deck validation: Cable with 45011 illegal; X-23 with 45012 illegal; Deadpool / Leadership with 45011 illegal;
   Bishop with 37011 illegal; Magik with 32042 illegal; Bishop's starter deck legal.
5. After the data fix: Magik controls 45031; another player's Colossus 32048 cannot be played. A Colossus hero's deck
   with 32048 is illegal.

### 3.59 A search for "an upgrade that can be attached to an ally"

> **Status: extend.** `TargetQuery.canAttachTo: TargetRef` asks whether a card's printed "attach to" allows one of
> the cards a ref names, which must be in play (Deathlok, `next_evol` 40025). The erratum's "an ally" names no card.

**Cards.** Suit Up 45017, as corrected: "Alter-Ego Action: Search your deck and discard pile for an ally and an
upgrade that can be attached to an ally. Add them to your hand. (Shuffle.)"

**Rules.** RRG 1.8 errata, "Suit Up (#17)" (p. 69); "Search" (p. 39: the player "chooses among those options"; the
deck is shuffled); "Attach To" (p. 8); "Upgrade" (p. 46).

**Plan.** **`TargetQuery.canAttachToCategory?: "ally"`**: the card's printed host allows a card of that category,
read from card data (`AttachmentHost`), with no card in play consulted (§4.2 Q30, default A). Under A the hosts that
qualify are `ally`, a `qualified` or `superlative` host over allies, `anyCharacter`, `friendlyCharacter` and a
`qualified` host over `character` or `friendlyCharacter`; an upgrade with no "attach to" (it attaches to its
controller's identity, RRG p. 46) does not. The search is two optional picks over deck and discard pile, an ally and
such an upgrade, either of which may be missing; then one shuffle of the deck.

**Tests.**

1. Deck holds Malcolm, Sidekick, Advanced Suit, Bishop's Rifle: the ally pick offers Malcolm; the upgrade pick
   offers Sidekick and Advanced Suit, not the Rifle. Both to hand, the deck shuffled once.
2. No ally in deck or discard pile, Advanced Suit in the discard pile: Advanced Suit to hand.
3. Q30 = A: Sidekick is offered with no identity-specific ally in play.
4. Hero form: not playable.

### 3.60 Reusable as is (pass 2a, checked against the engine unions)

**Reprints** (raw `duplicate_of_code`; the wave's `reprints.ts` aliases them): Team Training 45013 → 04016, Lead from
the Front 45018 → 01070, The Power of Leadership 45019 → 01072, Energy / Genius / Strength 45022–45024 → 01088–01090,
Clobber 45046 → 18012, The Power of Aggression 45047 → 01055, Spiritual Meditation 45052 → 15019.

| Card text                                                                                          | Existing vocabulary                                                                                            |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| "After you change to this form, add a [TEMPORAL] card in your discard pile to your hand" (45001b)  | `on.playerChangesForm("alterEgo")`, `chooseCards` over the discard pile by trait, `moveCards` to hand          |
| "Interrupt: When you change to hero form, choose a [SPELL] in your discard pile and put it on top" | an interrupt on the form change, `chooseCards`, `moveCards` to `"deckTop"`; once per phase                     |
| "Restricted." / "Magik gains steady" / "retaliate 1" / "Magik's basic attacks gain piercing"       | keyword data; `gainsKeyword` on the identity titled Magik; `attackKeywords { attacker, basicOnly }`            |
| "After the villain phase begins, exhaust Limbo → swap a card in your hand with the top card"       | `on.phaseBeginning("villain")`; Domino's swap (`chooseCards` + `swapCards`, wave 7 §3.57)                      |
| "Look at the top 3 cards of your deck. Draw one, discard one, and put one back" (Scrying)          | `lookAt(topOfDeck(3))`, two `chooseCards`, `moveCards` to hand and to discard; with fewer cards, in that order |
| "Ready your hero. Choose a Magik card in your discard pile not named Stepping Disc …"              | `ready`, `chooseCards` with `identitySetTitled: Magik` and `not: { name }`, `moveCards` to `"deckTop"`         |
| "Prevent 3 damage from this attack … deal 3 damage to the attacking enemy" (Magic Barrier)         | a defense-labeled interrupt on the attack's initiation, `preventDamage(3)`, `dealDamage` to the attacker       |
| "After Cable thwarts and defeats a side scheme" / "After X-23 attacks and defeats an enemy"        | `on.schemeDefeated` / `on.defeats` by the ally's own thwart or attack; `draw`, `ready(self)`                   |
| "After attached ally defeats a minion or side scheme, discard 1 card from your hand → heal …"      | the same events with the host as source; a hand-discard cost; §3.52's icon count                               |
| "After Legion uses a basic power, discard the top card of your deck. If that card's printed …"     | `on.basicPowerUsed(self)`, a bound deck discard, one `if` per type on `printedResource`                        |
| "Play only if you have the [X-FORCE] or [X-MEN] trait." (Marrow)                                   | `playOnlyIf` with an OR of two identity traits; the one-trait lines are data (`requiresIdentityTrait`)         |
| "After Marrow enters play, deal 2 damage to an enemy" / "After Triage enters play, heal 2 …"       | `on.entersPlay(self)`, `chooseTarget`; Triage's target is a character with the X-MEN trait                     |
| "When the villain would scheme, discard Tempus → cancel that activation. Deal yourself 1 …"        | `on.enemyActivating(villain)` narrowed to a scheme, `cancelIt()` (wave 5 §3.2), `dealEncounterCard(you)`       |
| "After you defeat an enemy with a basic attack, exhaust Blood Rage and take 1 damage → draw 1"     | `on.defeats` by your identity's basic attack; `exhaustSelf` and `damageSelf` costs                             |
| "After you play an [ATTACK] event, place 1 test counter here. If there are 5 …" (Test the Defense) | `on.youPlayedCard`, `placeCounters`, `counterAtLeast`, `discard(self)`, `dealDamage`                           |
| "If your hero's remaining hit points are less than half your hero's starting hit points" (45045)   | `compare(remainingHpOf, <, printed hit points ÷ 2)`; `modifyAttack({ overkill })`                              |
| "Uses (3 psi counters). Interrupt: When a player reveals a treachery …" (Stepford Cuckoos)         | the uses keyword; `on.encounterCardRevealed(treachery)`, `cancelRevealedCard()`, `revealEncounterCard(them)`   |
| "Resource: Exhaust Bloodgem and take 2 damage → generate a [wild] resource."                       | a `resource` ability with `exhaustSelf` and `damageSelf: 2` (unpaid if any of it is prevented, RRG p. 14)      |
| "Choose one: heal 3 from an identity / remove 3 threat from a scheme / deal 3 damage to an enemy"  | `chooseOne`                                                                                                    |
| "You may flip to alter-ego form. Choose: exhaust [alter-ego] → remove … / [the other option]"      | the obligation shape (every wave); `dealDamage` to each character you control (Darkchilde)                     |
| "Quickstrike." / "Guard." / "Villainous." / "After [minion] attacks and defeats an ally, …"        | keywords; `on.defeats` of an ally by the minion's attack                                                       |
| "If Portal Through Time is in play, place 2 threat on it. Otherwise, find it and reveal it."       | `exists`, `placeThreat`, §3.1                                                                                  |
| "Forced Interrupt: When a [TEMPORAL] card is revealed, it gains surge. (Limit once per phase.)"    | a surge grant on `encounterCardRevealing` by trait (Mister Knife, wave 3), with a phase limit                  |
| "Each [LIMBO] minion in play activates against the player it is engaged with. If no … surge."      | `forEach` minion by trait in the first player's order, `enemyActivates`, a bound count, a gained surge         |
| "[star] Boost: If Ruler of Limbo is in play, place 2 threat on it."                                | a boost ability, `exists`, `placeThreat` (it has an amplify icon of its own: §3.57 test 1)                     |

### 3.61 Permanent copies in their owner's set-aside area: attached from it, set aside again

> **Status: exists (verify).** Setup moves every permanent player card from the deck list to its owner's set-aside area
> before step 1, faceup, never shuffled, drawn or mulliganed (`setup.ts`, `isPermanentCard`; wave 6 §3.74, §4.1 Q15 =
> B), and `validateDeck` leaves it out of the 40 to 50 and requires the identity set's exact quantity.
> `CardSelector setAside { player, filter }` reads that area, `attachCard(card, to)` attaches, the destination
> `"setAside"` returns a card to it (Touched, wave 6), and a permanent player attachment whose host leaves play is
> unattached in its controller's play area rather than discarded (`discardWithLeavingHost`, wave 5 §3.30). Not run: an
> upgrade attached to an **enemy** straight from the set-aside area; six copies of one permanent card; a Forced Response
> on the unattached card that answers its former host's leaving; the area empty.

**Cards.** Frostbite 46002 ×6; Iceman 46001a (_"Freeze!"_); Bobby Drake 46001b; Frozen Solid 46007; Ice Wall 46008;
Arctic Attack 46009; Ice Blast 46010; Chill Out! 46011; Hot-Headed 46024; read by Snow Clone 46003 and Cool Off.

**Rules.** RRG 1.8 "Permanent" (p. 32); "Set Aside, Set-Aside" (p. 39); "Upgrade" (p. 46); "Ownership and Control" (p.
31); "Activation" (p. 6: "Whenever an enemy attacks or schemes, it is considered to have activated"); "Leaves Play" (p.
27); "Villain Defeat" (p. 47); "Resolve" (p. 37); "Cost" (p. 13: a game element out of play comes from the paying
player's "own out-of-play areas"); Appendix I (p. 50). The Iceman insert, "Frostbite Upgrade" (§0.4).

**The decision (data survey gap 13 and question 8).** Frostbite is an ordinary identity-specific card with the permanent
keyword, **the model of X-23's Claws, Psylocke's two Psi-Knives and Wolverine's Claws** (wave 6 §3.74), and not Storm's
Weather deck (`separateDecks`, wave 6 §3.45: a shuffled, facedown deck with an order). The card's own keyword, Bobby
Drake's first line and the insert all say the same thing, and the engine already does it:

- The six copies are **in the deck list and never in the deck**: an Iceman deck lists 46002 ×6 (Appendix I: the exact
  quantity of each identity-specific card), setup sets them aside before step 1, and they do not count toward the
  deck's 40 to 50 cards. They are never in a hand, a deck or a discard pile at any point of a game.
- The emitted record is right as it stands: `aspect: "hero:46001a"`, `quantityInSet: 6`, `deckLimit: 6`,
  `keywords: [{ name: "permanent" }]`, a dash cost. `deckLimit: 6` is not a way into another deck: only an Iceman deck
  may list an Iceman card, and it must list six.
- What differs from the Claws: no Setup ability puts them into play. They wait in the set-aside area until an ability
  attaches one, and their own Forced Response sends them back, so the area is a supply that refills.

**As read.**

- **"Attach a set-aside copy of Frostbite to [an enemy]"** is `attachCard` of one card of
  `setAside(you, { name: "Frostbite" })`: one copy from the resolving player's own set-aside area. Every card that says
  it is an Iceman card, so the supply is always the Bobby Drake player's. The copy enters play attached, under its
  owner's control (the enemy has no controller to pass it to).
- **None set aside:** nothing is attached and the rest of the ability resolves (Arctic Attack's 4 damage, Chill Out!'s 3
  threat). _"Freeze!"_ with none attaches nothing, so it did not resolve (RRG p. 37) and Cryokinetic Perception has
  nothing to answer: the Interrupt is not offered.
- **Fewer copies than enemies** (Ice Blast): the player attaches what there is to enemies of their choice among those
  named.
- **No "Max 1 per enemy":** copies stack, −1 SCH and −1 ATK each, to a floor of 0 (RRG "Modifiers", p. 29).
- **"After attached enemy activates"**: after an attack or a scheme of that enemy has fully resolved, each copy on it is
  set aside by its own Forced Response. A villain that activates once per player loses it after the first. A quickstrike
  attack is an activation. An activation that a stunned or confused card, Frozen Solid or a cancel replaced did not
  happen (wave 5 §4.1 Q3; §4.1 Q4 here), and the copies stay.
- **A copy attached during an activation** (_"Freeze!"_ on a defense, Ice Wall) is attached when that activation ends,
  so it is set aside then: §4.2 Q35, default A. That is what makes a basic defense with _"Freeze!"_ worth −1 ATK for
  that attack and nothing after it.
- **"Or leaves play":** the host leaves, the permanent copy is unattached in its owner's play area (the engine's rule
  above), and its Forced Response sets it aside; the log shows both steps. A villain stage replaced by a stage of the
  **same title** keeps its upgrades (RRG p. 47) and the copy stays attached.
- **Permanent:** no card outside the Iceman set can discard a copy, move it, take it or blank it; "discard an upgrade
  you control" skips it (RRG p. 32). Its own Forced Response is an ability of its own card and gets through
  (`ofPermanentCardsSet`).
- **"Each copy of Frostbite in play"** (Cool Off), "an enemy with Frostbite attached" (Arctic Attack, Snow Clone) and
  "with a copy of Frostbite attached" (Ice Blast) are counts and queries by title over cards in play.
- **Hot-Headed** answers each attachment the Bobby Drake player makes, one at a time: three copies from one Ice Blast
  are three instances of 1 damage.
- **The mission (§3.33).** An Overseer and an Agent of Apocalypse cannot be chosen by any of these abilities: none
  refers to the mission area.

**Log.** `cardsSetAside { reason: "permanent" }` at setup (exists); `cardAttached { from: "setAside" }`;
`cardSetAside { instanceId, by: <ability id> }` when a copy returns. A replay can count the supply at any step.

**Tests (exact numbers).** Iceman THW 1, ATK 2, DEF 2, 11 hit points; a villain with SCH 1 and ATK 2.

1. Setup with the starter deck (46 entries): six Frostbite faceup in his set-aside area, a deck of 40, a hand of 6, no
   Frostbite drawn or offered in the mulligan.
2. A basic attack: _"Freeze!"_ attaches one copy (5 set aside), then 2 damage. In the villain phase the villain attacks
   at ATK 1 with a boost card of 1 icon; he defends and uses _"Freeze!"_ again (4 set aside, ATK 0): 1 less DEF 2 is 0
   damage. When the activation ends both copies are set aside (6).
3. Two players: the villain with one copy schemes against player 1 at SCH 0, the copy is set aside, and it attacks
   player 2 at ATK 2.
4. The villain is stunned with a copy attached: the stunned card is discarded, there is no activation and the copy
   stays.
5. A minion with a copy is defeated: the copy is unattached, then set aside; his discard pile gained nothing.
6. Stage I of a villain is defeated with a copy attached and stage II has the same title: the copy is on stage II.
7. Two copies on an enemy with SCH 1 and ATK 3: SCH 0, ATK 1.
8. All six attached: Chill Out! removes 3 threat and attaches nothing; _"Freeze!"_ is not offered; Arctic Attack's first
   option deals 4 damage.
9. A fixture encounter card, "discard an upgrade you control": Frostbite is not a legal choice.
10. Hot-Headed in play, Ice Blast on a player engaged with two minions: three copies, three instances of 1 damage, 11 to
    8; with a tough status card, 11 to 9.
11. Cool Off with three copies in play and Arctic Attack, Chill Out!, Ice Wall and Power Belt in his discard pile: the
    three ICE cards are shuffled into his deck; Power Belt stays.

**Composes with:** §3.39 (the moment `"freeze"`), §3.65, §3.67; wave 6 §3.74.

### 3.62 The resource types a payment used

> **Status: extend.** A play records the whole pool it generated as `paid.<type>` and `paid.total`, with
> `overpaid.total` and `overpaid.<type>` beside it (`actions.ts`); `paidWith` reads one type at a time, a wild counting
> as any (`resources.ts`); `distinctTypeCount(pool)` counts the most types a pool can be, each wild one more type not
> otherwise present, to four, and serves the **cost** "spend 2 different resources" (`spendDifferentResources`, wave 6
> §3.69); `ValueSpec resourceTypes` counts printed types on cards. Nothing counts the types of the resources **paid**
> for a card with the overpaid ones left out, nothing reads several types of one payment together, and a play's payment
> is readable only while that play resolves (`playPaymentVars`).

**Cards.** Blinding Flash 47006 ("X is the number of different resource types ([energy], [mental], [physical], and
[wild]) used to pay for this event"); Firecracker 47007a/b/c and Flash of Light 47008a/b/c ("If you paid for this card
using 2 different resource types"); Grand Finale 47009 and Three Steps Ahead 47015 ("For each different resource type …
you used to pay for this card"); Jubilee's Coat 47004 and Jubilee's Sunglasses 47005 ("for each different resource type
used to pay for that event"); Multitalented 47021 ("If you paid for this event using at least 1: [physical] … [mental] …
[energy] …"); Husk 47012 ("spend up to 3 resources → if you spent at least 1: [energy] … [mental] … [physical] …").

**Rules.** RRG 1.8 "Wild Resource" (p. 48); "Cost" (p. 13: overpaid resources "were not paid for that cost"; resources
paid for an ability on a card are paid for that card; p. 14: "up to" needs at least one); "Resource" (p. 37: "There are
four types of resources"); FAQ "Unstoppable Force (#6)" (p. 60: at a cost of 0 nothing was paid). Ruling January 17,
2026 – Ruling 4 (1). The Jubilee insert (§0.4).

**Plan.**

- **The paid resources.** A payment already knows its requirement. `paid.count` is the number of resources the cost
  took: the card's cost after every reduction, plus any resource cost of the same play. The rest of the pool is
  overpaid.
- **Declared wilds (§4.1 Q33 = B).** Each wild in a payment has a declared type: [energy], [mental], [physical], or
  [wild] when the player leaves it as itself. **The player declares it; the engine never takes the declaration that
  gives the most.** The pay command carries the declarations (`wildAs`, one per wild in the order generated) and the
  payment's pending choice asks for them (`declareWildTypes`, four options for each wild, none preselected). They
  are asked only on a payment something reads for types: the card or ability being paid for is marked
  `readsPaidTypes` (`{ count: true }`, `{ atLeast: 2 }` or `{ types: [...] }`), or a card the paying player controls
  carries `RuleSpec readsPaymentTypesOf { cards: TargetQuery }` that matches it (the Coat for a THWART event, the
  Sunglasses for an ATTACK event). Every other payment asks nothing and is unchanged.
- **The one shortcut.** The prompt is skipped only when every declaration is provably equivalent: the engine works out
  what each reader of this payment would read under every declaration of its wilds (four to the power of the wilds; 64
  at most with these cards) and skips when all the answers are the same. That holds when no wild was generated, when the
  cost is 0, when one wild pays alone for a card that only counts (one type, whatever it is called), and when the typed
  resources already fill everything the reader can read. It does not hold merely because one declaration is plainly
  best. A skipped wild stays [wild]. Logged `wildTypesDeclared { playerId, declared, skipped }`.
- **`ValueSpec paidTypeCount { of? }`**: the number of different declared types among the paid resources, never
  more than `paid.count`. A typed resource is its type; a wild is what the player declared, so two wilds are two
  types only when she declared them differently. `of` names another card's play, as `paidWith` has it.
- **`Predicate paidType { resource: TypedResource; of? }`** for a card that reads named types together
  (Multitalented, Husk): true when a paid resource is of that type or a paid wild was declared as it. A wild left
  [wild] is none of the three. This replaces pass 2b's `assignPaidTypes`, which chose for the player. `paidWith`,
  under which a wild counts as any type, is unchanged for the earlier cards that use it.
- **Which resources are the paid ones** when more was generated than the cost is Q34 = A as answered: the
  `paid.count` resources that give the most declared types. The declaration is made first, over every wild
  generated; a wild that ends up among the overpaid resources was not read.
- **A payment that outlives its play.** The count and the pool are stamped on the play's `cardPlayed` event, so a
  Response to the play reads them (the Coat, the Sunglasses) after the event has left the stack.
- **Husk.** "Spend up to 3 resources" is a resource cost of a chosen size, 1 to 3, with no type (Machine Man, `vision`
  26022, is the precedent; `discardFromDeck { choose }` of §3.55 is the shape). Everything spent was spent: there is no
  overpayment against a cost the player sizes, so `paidType` reads the whole spent pool, each wild as she declared
  it.
- **The player declares** (§4.1 Q33 = B, above); **overpaid resources do not count** (§4.1 Q34 = A; RRG p. 13).

**As read.**

- "Using 2 different resource types" is at least 2.
- The four types are energy, mental, physical and wild: a wild left as a wild is a type of its own, which is why three
  of the cards list it.
- A cost of 2 can be paid with at most 2 types and a cost of 3 with at most 3 under Q34 = A: Grand Finale deals at most
  2 + 2 + 2 + 2.
- A cost reduced to 0: no types. Firecracker does not stun, and the Coat's Response has nothing to remove and is not
  offered.
- **Blinding Flash:** exactly X enemies, or every enemy if there are fewer; each gets a stunned and a confused status
  card where it can.
- **Grand Finale:** each "choose an enemy and deal 2 damage" is its own instance of damage in one attack (RRG p. 10);
  the same enemy may be chosen again.
- **Three Steps Ahead:** one thwart that removes several instances of threat (RRG p. 44); the same scheme may be chosen
  again.
- **Multitalented** resolves its lines in the printed order: damage, threat, heal. It is one ability labeled attack and
  thwart (RRG p. 26): a stunned or confused identity cancels all of it and loses both cards.
- **Husk:** [energy] adds 1 to the basic power she is using, [mental] heals 1 from her, [physical] readies her after the
  use, each at most once however many resources of that type she spent. The player controlling her spends the resources.
- **The Coat and the Sunglasses** answer their controller's own event ("After you play"), by trait: Multitalented is
  both a THWART and an ATTACK event, Unlikely Duo and Waylay are ATTACK events.

**Tests (exact numbers).**

1. Firecracker (cost 2) paid with Plasmoid Energy 47010a ([energy][mental]): 4 damage and a stunned card. Paid with two
   [physical] cards, or with Genius alone ([mental][mental]): 4 damage, no stun.
2. **Q33 = B.** Paid with _"Like, totally!"_ ([wild]) and Firecracker 47007c ([physical]): she is asked to declare the
   wild. [energy], [mental] or left [wild]: two types, 4 damage and a stunned card. [physical]: one type, 4 damage, no
   stun. Paid with _"Like, totally!"_ and X-Gene, two wilds: two declarations; two different ones stun, the same one
   twice (both left [wild] included) does not.
3. Grand Finale (cost 3) paid with 47010a and Flash of Light 47008c ([physical]): three types: 2 damage, then three
   instances of 2: 8 on one enemy, or 2 each on four.
4. **Q34 = A.** Grand Finale paid with 47010a, 47008c and Strength ([physical]): four resources, three paid, three
   types. Paid with 47010a, 47008c and The Power of Justice (1 [wild]: not a Justice card): four types generated, three
   paid: 8 damage, not 10.
5. Three Steps Ahead (Justice, cost 3) paid with The Power of Justice (2 [wild]) and Firecracker 47007a ([energy]):
   she declares both wilds (ruling January 17, 2026: "you specify"). [mental] and [physical], or one of those with
   the other left [wild]: three types, three removals of 2. [energy] and [mental]: two types, two removals. Both
   [energy]: one type, one removal of 2.
6. Blinding Flash paid with three [energy]: X is 1.
7. Jubilee's Coat ready, Flash of Light paid with [energy] and [mental] on a scheme with 6 threat: 3 removed and an
   enemy confused; then the Response removes 2 from a scheme she chooses.
8. Firecracker at a cost of 0 by a fixture, Energy discarded anyway: 4 damage, no stun; the Sunglasses' Response is not
   offered.
9. Multitalented (cost 3) paid with two [physical] cards and _"Like, totally!"_: she is asked to declare the wild.
   [mental]: 2 damage and 2 threat removed. [energy]: 2 damage and 2 healed. [physical] or left [wild]: 2 damage
   only. Paid with one card of each type: all three lines, nothing asked.
10. Husk (THW 2) thwarts and her controller spends 47010a: 3 threat removed, 1 damage healed from her. Spends Strength
    instead: 2 removed, she readies after the thwart and its consequential damage. Declined: 2 removed.
11. **Q33 = B, the shortcut.** Firecracker at a cost of 1 by a fixture, paid with _"Like, totally!"_ alone: nothing is
    asked (every declaration is one type), 4 damage, no stun. Flash of Light paid with an [energy] card and a
    [mental] card: nothing is asked (no wild). Grand Finale (cost 3) paid with 47010a, 47008c and _"Like, totally!"_:
    four resources, three paid, three types whatever the wild is called: nothing is asked, 8 damage. Firecracker
    paid with _"Like, totally!"_ and Strength: asked, although one answer is plainly best.
12. **A reader in play.** Jubilee's Sunglasses and Wolverine in play; Unlikely Duo (cost 2, an ATTACK event that reads
    no types) paid with _"Like, totally!"_ and Strength ([physical]): she is asked. Declared [energy]: the
    Sunglasses' Response deals 2 damage. Declared [physical]: 1. Without the Sunglasses in play the same payment
    asks nothing.

**Composes with:** §3.51 (the same payment frame), §3.63; wave 6 §3.69.

### 3.63 An additional cost to change form

> **Status: extend.** `RuleSpec cannotChangeForm` stops a change, `RuleSpec readyCost` prices readying a card (wave 4
> §3.19) and `additionalThwartCost` a thwart. The `changeForm` command (`actions.ts`) and `EffectSpec changeForm` take
> no cost. `AbilityCost { resources, sameResourceType }` is "Spend 3 resources of the same type" (Kree Combat Armor,
> wave 3 §3.43).

**Cards.** Grounded 47023: "As an additional cost to change to hero form during your turn, you must spend 2 resources of
the same type." A later pack prints the family again (Work-Life Balance, `jj` 61030: "As an additional cost to change
forms, discard 1 card from your hand").

**Rules.** RRG 1.8 "Cost" (p. 14: "A player must pay all additional costs simultaneously with the cost that is being
added to … if they cannot pay for all of the costs at once, then they do not pay any of the costs and the effect
associated with the costs does not occur"); "Form, Change Form" (p. 21); "Player Turn" (p. 34); "Wild Resource" (p. 48);
"Obligation" (p. 30: "you" is the player whose play area it is in).

**Plan.** **`RuleSpec formChangeCost { player; to?: "hero" | "alterEgo"; during?: "ownTurn"; cost: AbilityCost }`**, a
constant on a card in play. The `changeForm` command for a covered change opens the cost's payment before the flip and
refuses when it cannot be paid (`whyNot`: the card and the cost); `legalActions` lists the change only when it can be
paid. Which changes are covered beyond the turn's own option is §4.2 Q37 (default A: a change the player chooses to make
during their own turn, by the option or by an ability of a card they control; a change an encounter card forces is not
theirs to pay for and happens).

**As read.**

- "2 resources of the same type": two of one type, a wild standing for any (`spendSameType(2)`); [energy] and [wild]
  pays, [energy] and [mental] does not. The resources come from her hand: neither X-Gene (a resource for an
  identity-specific event) nor _"Like, totally!"_ (on her hero face) can pay it.
- The cost is hers alone: no alliance, no other player.
- Changing to alter-ego form is free. A change to hero form outside her turn is free.
- **When Revealed: Change to alter-ego form.** A forced change (§3.16); already in alter-ego form, nothing happens. It
  does not use her one change for the round (RRG p. 21).
- **"After you play a Jubilee event"**: an event of her identity-specific set (Blinding Flash, Firecracker, Flash of
  Light, Grand Finale; `identitySetTitled`), played by the Jubilation Lee player. All four are Hero Actions, so she pays
  the cost once, or changes form by some effect outside her turn, before she can remove it.
- The obligation stays in her play area until that Response removes it from the game; it is not discarded and prints no
  way to flip and exhaust.

**Tests (exact numbers).**

1. Revealed while she is in hero form: she is in alter-ego form and the obligation is in her play area.
2. Her next turn with Firecracker 47007a and Flash of Light 47008a in hand (an [energy] each): the change to hero form
   is offered at "2 resources of the same type"; she discards both and flips.
3. A hand of one [energy] card and one [mental] card: not offered. With a [mental] card and The Power of Justice
   ([wild]): offered.
4. In hero form she plays Firecracker: the Response is offered and Grounded is removed from the game. She plays Three
   Steps Ahead: no Response.
5. She changes to alter-ego form with Grounded in play: no cost.
6. Q37 = A: a fixture Interrupt in the villain phase changes her to hero form: no cost. A fixture Action of her own on
   her turn that changes her form: the cost is asked.

**Composes with:** wave 3 §3.43, wave 4 §3.19; `jj` 61030 later.

### 3.64 A player makes a basic attack or thwart on a card's instruction

> **Status: extend.** A basic attack and a basic thwart are player commands with their own event frames (`actions.ts`);
> `friendlyCharacterAttacks` makes a friendly character attack a **player** (Old Rivals, wave 4 §3.26);
> `LastingGrantUntil nextBasicPower` and `modifyBasicPower` change a use in progress or the next one (Psychic Kicker,
> wave 6 §3.39; Leadership Skill, `storm` 36019). No effect has a chosen player make a basic attack or thwart now.
> Searched `spec.ts`, `abilities.ts` and the DSL for "basic" as an effect kind.

**Cards.** Cell Phone 47019: "Uses (3 charge counters). Action: Exhaust Cell Phone, remove 1 charge counter from here,
and choose a player → that player makes a basic attack or thwart with a character they control. That character gets +1
THW and +1 ATK for this use."

**Rules.** RRG 1.8 "Basic Power" (p. 10); "Attack (Player Ability Type)" (p. 10: "A character must exhaust to use this
power"; only "without exhausting" lets an exhausted character act); "Thwart" (p. 44); "Uses" (p. 46); "Cost" (p. 13: "If
a cost uses the word 'choose,' the player can choose targets they do not control"; no cost without a valid target).

**Plan.** **`EffectSpec basicPowerBy { player: PlayerRef; powers: ("attack" | "thwart")[]; bonus?: { thw?, atk? } }`**:
the named player chooses a ready character they control that could use one of those powers now, the power, and its
target, and the engine runs the ordinary basic power: the character exhausts, guard, patrol, crisis and "cannot" rules
apply, a stunned or confused character loses the status card instead, every interrupt and response to a basic attack or
thwart is offered, an ally takes its consequential damage. The bonus is a stat modifier on that character until the
power's event ends (`endOfEvent`). It is a use of the power for every reader: Synch, Husk, Leadership Skill, Generation
X, Surprise Move, _"Freeze!"_.

**As read.**

- The chosen player may be the controller. A player with no ready character that can attack or thwart cannot be chosen;
  with no such player the Action is not offered.
- An Action, so any action window: another player's turn, or between steps of the villain phase.
- The third counter spent discards it (RRG p. 46).
- An ally at the mission is no player's and cannot be the character (§3.34).

**Tests (exact numbers).**

1. Jubilee controls Cell Phone (3 counters) and chooses player 2, whose ready ally has ATK 2 and one consequential icon:
   2 counters left, the ally exhausts, deals 3, takes 1.
2. She chooses herself, exhausted: not a legal choice. Ready (THW 1): 2 threat removed, she exhausts, and Waylay may
   answer the thwart.
3. Against Generation X by an X-MEN hero with THW 2: 2 + 1 + 1 = 4 removed.
4. The chosen hero is stunned and attacks: the stunned card is discarded, the hero exhausts, the counter is spent.
5. Third use: the card is discarded after the power resolves.

### 3.65 Damage an identity would take from an enemy attack placed on a support

> **Status: exists (verify).** A forced interrupt on `when.damage(…)` that resolves `instead(placeDamage(eventAmount,
self))` and then discards itself at `damagedAtLeast(self, n)` is Armored Rhino Suit (Core 01098) and Stinger Tail
> (`mojo` 39028), on an attachment protecting its host. Not run: a
> **support** as the card that holds the damage; any player's identity as the protected card; "would take" (after
> defense) rather than "would be dealt"; damage narrowed to an enemy's attack; the attacking enemy named after the card
> is discarded.

**Cards.** Ice Wall 46008: "Forced Interrupt: When an identity would take any amount of damage from an enemy attack,
place that damage here instead. Then, if there is at least 8 damage here, discard this card and attach a set-aside copy
of Frostbite to the enemy that just attacked."

**Rules.** RRG 1.8 "Replacement Effect" (p. 37); "'Would'" (p. 48); "Ability", Simultaneous Timing Priority (p. 5);
"Tough" (p. 44); "Defend, Defense" (p. 15); "Indirect Damage" (p. 24); "Forced" (p. 20).

**As read.**

- **Any identity**, of any player, in hero or alter-ego form; forced, so it is not a choice.
- **The amount** is what the identity would take: after a basic defense's DEF, after prevention, and capped by any
  "cannot take more than" rule.
- **A tough status card comes first** (RRG p. 5: a status card's Forced Interrupt before other Forced Interrupts): the
  tough card is discarded, nothing would be taken and nothing is placed.
- **The identity took no damage:** nothing answers "after [identity] takes damage" (Bishop's Energy Absorption,
  Berserker Frenzy), and the attack is one in which the hero took none.
- **From an enemy attack:** a basic attack or an attack ability of a villain or minion, the identity's share of indirect
  damage from Pyro's attack, and overkill that reaches the identity. Not retaliate, a treachery's damage, or damage to
  an ally that defends.
- **All of it is placed**, past 8: at 6, an attack of 5 leaves 11, and the card is discarded.
- **"The enemy that just attacked"** is the attacker of the attack in progress. The copy is attached during that
  activation (§4.2 Q35) and the Bobby Drake player attached it (Hot-Headed).
- Damage on the support is counters of the engine's damage kind; nothing heals a support.

**Tests (exact numbers).**

1. A villain attacks Iceman for 5, undefended: 5 on Ice Wall, Iceman takes 0.
2. He defends an attack of 5 (DEF 2): 3 placed.
3. Ice Wall at 6, an attack of 5: 11 on it, it is discarded and a copy is on the attacker; with Hot-Headed in play
   Iceman takes 1. Q35 = A: the copy is set aside when the activation ends.
4. Iceman has a tough status card, an attack of 5: the tough card is discarded, 0 placed.
5. Player 2's identity is attacked for 3: 3 placed on Iceman's Ice Wall.
6. Pyro (ATK 3, indirect) attacks with no defender: the player assigns 2 to Iceman and 1 to Snow Clone: 2 placed, Snow
   Clone takes 1.
7. An ally defends; a treachery deals 2 damage to his identity; retaliate 1: nothing placed in any of the three.

### 3.66 A player side scheme barred to heroes and allies, worked by any alter-ego, put into play by a search

> **Status: exists (verify).** Player side schemes and their limit are wave 7's (§3.1, §3.2).
> `RuleSpec threatCannotBeRemoved { target, exceptBy }` bars every removal a character performs except one that matches
> (Technovirus Purge, wave 7 §3.51; §4.1 Q29 there = A: a removal no character performs is not barred). "Any player may
> trigger this ability" is Safehouse's (`next_evol` 40197). A search that puts a card into play is ordinary. Not run:
> `exceptBy` matching **a form** rather than a named identity; a triggered Action printed on a scheme in the villain's
> area that every player may use; a player side scheme put into play by an effect outside any player's turn to play one.

**Cards.** Shopping Spree 47003; Jubilation Lee 47001b (_Mall Rat_).

**Rules.** RRG 1.8 "Player Side Scheme" and "Player Side Scheme Limit" (p. 34); "Thwart" (p. 44); "Labeled Ability" (p.
26: a thwart is "made by that player's identity"); "Upgrade" (p. 46); "You, Your" (p. 49); "Play, Put into Play" (p.
32); "Search" (p. 39); "Unique Icon" (p. 46). The Jubilee insert's victory sentence does not apply (§0.4).

**Plan.** No engine change is expected.

- **"Threat cannot be removed from this scheme by heroes or allies"** is
  `threatCannotBeRemoved { target: self, exceptBy: <an identity in alter-ego form> }`: a removal performed by a
  hero-form identity or an ally is barred, whatever card it comes from (a basic thwart, a thwart event, an upgrade's
  ability: all are the identity's). The scheme is not a legal target for those. What else gets through is §4.2 Q36
  (default A, wave 7's answer: only characters are barred).
- **The Alter-Ego Action** is the scheme's own ability: any player in alter-ego form exhausts their own identity and
  removes 1 threat. The scheme performs the removal, and the player who used it is the one who defeated the scheme when
  it was the last threat.
- **When Defeated:** that player searches their own deck and discard pile for an ITEM card and puts it into play under
  their control: no cost, not played, a "Max 1 per player" or unique card they cannot take is not a legal pick, an
  upgrade with an "attach to" needs a host. One shuffle.
- **No Victory:** defeated, it goes to its owner's discard pile, comes back with a deck reset, and _Mall Rat_ can find
  it again.
- **_Mall Rat_** searches the deck only (a copy in hand or in the discard pile is not found), puts the scheme into play
  with its 2 threat under Jubilee's control, and shuffles. It is not a play, so it works in any action window, the
  villain phase included. The limit is checked as it enters (wave 7 §3.2): over the limit, the first player chooses
  which player side scheme is discarded.

**Tests (exact numbers).**

1. Jubilation Lee uses _Mall Rat_: Shopping Spree is in play with 2 threat, her deck is shuffled; a second use that
   phase is refused.
2. She exhausts: 1 threat. Player 2, in alter-ego form, exhausts: 0, defeated by player 2, who puts an ITEM of their own
   deck into play; the scheme is in Jubilee's discard pile, not the victory display.
3. A hero's basic thwart, an ally's, and Flash of Light played in hero form: the scheme is not offered as a target.
4. She controls Disguise in alter-ego form: exhausting it and her identity removes 2: defeated by her (Q36 = A); she
   puts Jubilee's Coat into play from her discard pile for nothing.
5. Two players, Generation X in play: _Mall Rat_ brings a second player side scheme: the first player discards one of
   the two, which is not defeated.
6. Shopping Spree in her discard pile: _Mall Rat_ finds nothing, the deck is shuffled, the phase's use is spent.
7. Played from her hand in hero form for 0: in play with 2 threat, and nothing she can do in hero form removes any.

### 3.67 An upgrade on an enemy as a condition; consequential damage reduced by what the target had

> **Status: exists (verify).** `TargetQuery.hasAttachment` narrowed to upgrades is Cyclops's "an enemy with an upgrade
> attached" (Optic Blast, Ricochet Beam, wave 6); `takesConsequentialDamage(target, -1, { from: "attack", if })` is
> Cannonball and Coordinated Attack (wave 6 §3.31), read with the attack's results; an attack target's statuses are
> snapshotted when the attack is made (`attack-target-status-snapshot.test.ts`). Not run: a count of upgrades on the
> attacked enemy as an ATK modifier during the attack; the reduction when the attack removes the thing it reads.

**Cards.** Snow Clone 46003; Shark-Girl 46012; Glob 46013; Suppressing Fire 46014; Surprise Move 46015; Take That!
46016; Chamber 47011.

**Rules.** RRG 1.8 "Consequential Damage" (p. 13: dealt "after resolving abilities that are triggered by the ally
attacking"); "Upgrade" (p. 46); "Attachment" (p. 8: an attachment is an encounter card type, not an upgrade). Ruling
February 8, 2026 – Ruling 1.

**As read.**

- **"An upgrade attached"** is a card of the upgrade type attached to that enemy, any player's: Frostbite, Frozen Solid,
  Suppressing Fire, a Cyclops tactic, Touched. An encounter attachment is not one.
- **Shark-Girl** gets +1 ATK per such upgrade on the enemy she is attacking, read when her damage is dealt, so an
  upgrade attached by an Interrupt to her attack counts.
- **Surprise Move** is checked when it is played: an upgrade that _"Freeze!"_ has just attached to the target makes it
  playable. "If this attack defeats that enemy, ready your hero" is read when the attack ends.
- **Suppressing Fire** is an Interrupt to the defeat, so the heal resolves while the minion and the upgrade are still in
  play. "You" is the player who controls the upgrade, and the attack is their hero's, basic or an ability's.
- **Snow Clone and Chamber** take 1 less consequential damage "after" attacking an enemy with Frostbite attached, or a
  confused enemy. An attack that defeats the enemy removes the Frostbite before consequential damage is dealt, the same
  gap the ruling of February 8, 2026 describes for Coordinated Attack, where FFG's intent is that the reduction still
  applies. §4.2 Q38, default A: the enemy is read as it was when the attack was made.
- Snow Clone's "Cannot have upgrades attached" is `cannotHaveAttachments` narrowed to upgrades: Sidekick, Advanced Suit
  and Desperate Measures cannot go on it, an encounter attachment ("Lost" Child) can. At the mission its text box is
  blank (§3.34) and an upgrade can, though only Desperate Measures does anything there (§4.1 Q19 = B).

**Tests (exact numbers).**

1. Snow Clone (ATK 2, 2 hit points) attacks a minion with Frostbite and 5 hit points: 2 damage, 0 consequential. Without
   Frostbite: 1, and it has 1 hit point left.
2. Q38 = A: the attack defeats a minion with Frostbite and 2 hit points: 0 consequential.
3. Chamber (ATK 2) attacks a confused villain: 0 consequential, the confused card stays. Not confused: 1.
4. Shark-Girl attacks a minion with Frostbite, Frozen Solid and Suppressing Fire attached and one encounter attachment:
   2 + 3 = 5 damage.
5. Take That! with no upgrade on any enemy: not playable. With Frostbite on the villain: 7 damage.
6. Iceman attacks a minion with 4 hit points and nothing attached: _"Freeze!"_ attaches a copy, Surprise Move (cost 1)
   is then playable: ATK 4, the minion is defeated, Iceman readies.
7. Glob enters play with no upgrade on any enemy: no Response. With one: 2 damage to that enemy.
8. A hero attacks a minion with Suppressing Fire and 3 hit points for 3: 2 damage healed from the hero.

### 3.68 Across packs: the unique rule, the Team-Up replacement and the ally Jubilee's +2 ATK

> **Status: exists (verify).** §3.58's rule and its deck half; the seat's replacement of a card that matches a seated
> hero (`name-conflicts.ts`, `replacement-candidates.ts`, wave 6); the Team-Up keyword's two checks (`deck.ts`,
> `titles.ts`); the unique rule for a revealed encounter card (`unique.ts`); the ally Jubilee's lasting bonus by title
> (wave 6 §3.43). Not run: any of them with these packs' cards.

**Cards.** The identities 46001a/b and 47001a/b; Shadowcat 46019; Wolverine 47002; Unlikely Duo 47022; Pyro 46025.

**Rules.** RRG 1.8 "Unique Icon" (pp. 45–46: a non-villain encounter card that matches a card in play "is discarded and
any effects of it entering play are ignored. If it was being revealed … the player revealing it is dealt a facedown
encounter card"); "Team-Up" (p. 43); Appendix I (p. 50); "Max, Maximum" (p. 28); erratum "Mutants at the Mall (#88A)"
(p. 68). Rulings June 2, 2026 – Ruling 1; January 26, 2026 – Ruling 4 (7); March 19, 2026 – Ruling 4.

**The matches** (every raw pack searched by script for these titles and subtitles; subtitles read on the scans):

| Card of this pass                     | Matches                                                                                     | By                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------- |
| Iceman / Bobby Drake 46001a/b         | the ally Iceman, subtitle Bobby Drake (`rogue` 38010, Protection)                           | alter-ego title           |
| Jubilee / Jubilation Lee 47001a/b     | the ally Jubilee, subtitle Jubilation Lee (`wolv` 35003, Wolverine's own); `mut_gen` 32088b | alter-ego title           |
| Wolverine 47002, subtitle Logan       | the hero Wolverine / Logan (`wolv` 35001a/b); the ally Wolverine (`mut_gen` 32041)          | alter-ego title; subtitle |
| Shadowcat 46019, subtitle Kitty Pryde | the hero Shadowcat / Kitty Pryde (`mut_gen` 32030a/b); the ally Shadowcat (`mut_gen` 32002) | alter-ego title; subtitle |
| Pyro 46025 (minion, no subtitle)      | the minion Pyro (`mut_gen` 32075) and the villain Pyro (`mut_gen` 32123a/b)                 | title, no subtitle        |

Shark-Girl, Glob, Beak, Chamber, Husk and Synch match nothing in the pool. No hero of waves 6 to 8 other than those
above shares a title, a subtitle or an alter-ego title with a card of the two packs.

**What it means.**

- **In a deck.** An Iceman deck cannot include 38010. A Jubilee deck cannot include the Aggression Wolverine 32041 (her
  own 47002 is required). A Shadowcat deck and a Colossus deck (whose set holds 32002) cannot include 46019.
- **In the game.** Beside the Iceman hero nobody can play 38010. Beside a Wolverine hero Jubilee cannot play 47002, and
  beside a Jubilee hero Wolverine cannot play 35003. Beside a Shadowcat hero nobody can play 46019, to a play area or to
  the mission. Each stays a resource.
- **The Team-Up replacement (Appendix I).** 47002 and 35003 are identity-specific cards that match the other player's
  identity, and Unlikely Duo names both identities, so each of the two players may replace that ally with Unlikely Duo.
  **Jubilee's starter deck already holds one, and the card prints "Max 1 per deck"**: she may make the replacement only
  from a deck without it. The Wolverine player may, which is what the pack's second copy is for.
- **Unlikely Duo** can be in a deck whose identity is Jubilee or Wolverine, and can be played while a friendly character
  titled Jubilee and one titled Wolverine are in play: the two heroes, Jubilee with her ally 47002 or the ally 32041,
  Wolverine with his ally 35003.
- **June 2, 2026 – Ruling 1** needs no change: the ally Jubilee's bonus is keyed on the chosen enemy and reaches any
  card titled Wolverine or Jubilee when it makes a basic attack, so it now reaches the hero Jubilee and the ally 47002.
  No legal table of the current pool has 35003 in play beside either (the unique rule above), so the regression test is
  a fixture.
- **Pyro.** In Mansion Attack with the villain Pyro in play, or beside the minion 32075, the nemesis minion 46025 cannot
  enter play: revealed, it is discarded and the player is dealt a facedown encounter card. "Attach to Pyro", "When Pyro
  attacks you" and "if Pyro is in play" are by title, so Pyro's Flamethrower attaches to the villain Pyro and Burn!
  discards 3.
- **Mutants at the Mall** (`mut_gen` 32088a, erratum p. 68) puts the ally Jubilee 32088b into play. With a Jubilee hero
  in the game she matches: §4.2 Q39.

**Tests.**

1. Deck validation: Iceman with 38010 illegal; Jubilee / Aggression with 32041 illegal; Colossus with 46019 illegal;
   Shadowcat with 46019 illegal; a Wolverine deck with Unlikely Duo and without 35003 legal at a table with a Jubilee
   hero.
2. Player 1 is Wolverine, player 2 Jubilee: 47002 and 35003 are offered for no play; Unlikely Duo (cost 2) is playable
   by either: an enemy is confused, 4 damage to a confused enemy.
3. Jubilee alone with 47002 in play: Unlikely Duo is playable. 47002 is defeated: not playable (`whyNot`: Team-Up).
4. **Ruling June 2, 2026.** By fixture the ally Jubilee's Response resolves twice in one phase on enemy E: the hero
   Jubilee (ATK 1) makes a basic attack on E for 5; the ally Wolverine 47002 (ATK 3) for 7, with piercing; Firecracker
   on E deals 4; a basic attack on another enemy deals 1.
5. Mansion Attack, the villain Pyro in play, Iceman reveals 46025: discarded, one facedown encounter card dealt to him.
   He reveals Pyro's Flamethrower: attached to the villain.
6. Q39 = A, a Jubilee hero in Mutants at the Mall's scenario: the scheme is defeated, the Sentinel is revealed, no ally
   Jubilee enters play.

### 3.69 Three versions of one title in an identity set

> **Status: exists (verify).** `validateDeck` requires each identity-set card at its `quantityInSet` by card id
> (`requiredIdentitySet`), applies the copies-by-title limit only to cards outside the identity set, and groups copies
> by title and subtitle (`byTitle`, RRG "Copy"). Each of the nine records is its own card with `quantityInSet: 1`. Not
> run: an identity set in which one title is three records.

**Cards.** Firecracker 47007a/b/c; Flash of Light 47008a/b/c; Plasmoid Energy 47010a/b/c.

**Rules.** RRG 1.8 "Copy" (p. 13); "Max, Maximum" (p. 28); Appendix I (p. 50: "The exact quantity of each card included
in that identity set must be included in the deck"; "No more than three copies (by title) of each nonunique card");
"Resource Card" (p. 37).

**The decision (data survey gap 21 and question 9).**

- **What differs:** the resource icon and the collector line, nothing else (§0.4). The versions exist so that her own
  cards pay in different types.
- **They are three copies of one card** (RRG p. 13: by title, "regardless of … any other differing characteristics"),
  and nine printed cards of her set of fifteen. A Jubilee deck holds **each of the nine records exactly once**. That is
  three copies of each title, which is also the most Appendix I allows.
- **`validateDeck` accepts** the nine records at one each and nothing else: a missing version is a missing identity-set
  card, a second copy of one version is one too many, and three of 47007a with no b or c is both. It must **not** read
  `deckLimit: 1` by title: the three records together are three copies of a title whose records each say 1, and the
  validator never applies that limit to an identity set. The data stays as emitted (`deckLimit: 1` is MarvelCDB's count
  per record; the cards print no "Max" line), with a `cardNotes` line saying so.
- **Title-level rules in play** treat them as copies of each other: a count or a search by name finds all three,
  "another copy of" and a "Max X per [period]" would count across them. No card of the pool names these titles today,
  and none of the nine prints a "Max" line, so nothing changes behavior; the rule is recorded so that a later card does
  not have to ask.
- **Rules that read the card** see each version's own icons: what it pays as, §3.36's pairing in a mission attempt,
  §3.50's top-card test, The Eye of Sauron and Burn!.
- **One script, three ids.** The three versions of an event are one ability definition registered under three ability
  ids; a reprint alias is not the mechanism (they are not duplicates in raw).

**Tests.**

1. Her starter deck: legal, 40 cards counted, the nine records once each.
2. Without 47007b: illegal (an identity-set card is missing). With 47007a ×2: illegal. With 47007a ×3 and no 47007b or
   47007c: illegal, three problems.
3. No "more than three copies" or deck-limit problem is reported for Firecracker, Flash of Light or Plasmoid Energy in a
   legal deck.
4. A Bishop deck listing 47010a: illegal (another identity's card).
5. A fixture count of cards named Firecracker in her discard pile holding 47007a, b and c: 3.
6. Generation X's search with 47007a in her deck and 47007c in her discard pile: both are offered as separate cards,
   each with its icon.
7. Plasmoid Energy 47010b discarded to pay: 1 [energy] and 1 [physical].

### 3.70 Reusable as is (pass 2b, checked against the engine unions)

**Reprints** (raw `duplicate_of_code`; the wave's `reprints.ts` aliases them): Looking for Trouble 46017 → 16043,
Team-Building Exercise 46021 → 12024, Recuperation 46022 → 15031, The Power in All of Us 46023 → 13024, The Power of
Justice 47017 → 01062, X-Gene 47020 → 38019.

**Deck discards, checked against §3.48–§3.50, §3.52 and §3.55 before any row was opened:** Playing with Fire, Pyro's
Flamethrower, Burn! and The Eye of Sauron discard from the top of a player's deck and count printed resource icons. They
are ordinary deck discards with a bound slot (`moveCards(topOfDeck(n), "discard", bind)`, `totalPrintedResources`, one
`if` per type on `printedResource`): a wild is only a wild (RRG p. 48), a short deck discards what it has and resets
without discarding more (RRG p. 33), a card that answers its own discard is not counted (wave 7 §3.55), Domino's
doubling applies (`deckDiscardIconCount`, wave 7 §3.56), and Magik's faceup card is the first to go (§3.48). None is a
mission attempt's discard (§3.38). **No new row.**

| Card text                                                                                           | Existing vocabulary                                                                                                   |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| "Interrupt: When Iceman makes a basic attack or defense against an enemy, attach …" (46001a)        | an interrupt on his basic attack and on being declared the defender by a basic defense; §3.61; `raiseMoment`          |
| "After you resolve your 'Freeze!' ability, exhaust this card → draw 1 card. If that card has …"     | `on.moment("freeze")` (§3.39), a bound draw, a trait test on the drawn card, `ready`                                  |
| "You get +3 hit points. Hero Resource: Exhaust Power Belt → generate a [wild] for an [ICE] card"    | `gets("hp", 3)`; a resource ability narrowed to what is paid for (Black Widow's Gauntlet, `bkw` 08007)                |
| "Iceman gets +1 THW, +1 ATK, and +1 DEF, and gains the [AERIAL] trait" / "shuffle this card into …" | `gets`, `gainsTrait` on the identity titled Iceman; a forced response on the change to alter-ego form                 |
| "Hero form only. Attach to an enemy. Max 1 per enemy." (Frozen Solid)                               | data (`attachesTo`, `playRestrictions`)                                                                               |
| "When attached enemy would activate, discard Frozen Solid instead. Then, attach …"                  | a forced interrupt on `enemyActivating` of the host with `instead` (Web Binding, `sm` 27006; wave 5 §3.2); §3.61      |
| "Choose: deal 4 damage … and attach … / deal 6 damage to an enemy with Frostbite attached"          | `chooseOne` with a gated option; `attack`; `hasAttachment { name }`                                                   |
| "Choose a player. Attach … to the villain and each minion engaged with that player. Deal 3 …"       | `choosePlayer`, `forEach`, §3.61, `dealDamage` to each enemy with the attachment                                      |
| "Shuffle 1 [ICE] card from your discard pile into your deck for each copy of Frostbite in play"     | `on.playerChangesForm("alterEgo")`, `chooseCards` up to a count, `moveCards` to the deck, one shuffle                 |
| "After you attach a Frostbite upgrade to an enemy, take 1 damage" / "After you make a basic …"      | a forced response on `cardAttached` by name and player; `on.basicRecovery`, `discard(self)`                           |
| "[Minion]'s attacks deal indirect damage" (Pyro)                                                    | Starshark (`gmw` 16137; wave 3 §3.16)                                                                                 |
| "Attach to Pyro. Otherwise, this card gains surge." / "Pyro gets +1 ATK for this attack for each …" | a named host with a surge fallback; a forced interrupt on the host's attack, a bound deck discard, `modifyAttack`     |
| "This card gets +1 boost icon for each resource icon on that card" (Burn!)                          | a boost ability with a bound deck discard and `boostIconsFor`                                                         |
| "Search the encounter deck and discard pile for the Life Drain attachment and reveal it"            | `searchAndReveal`                                                                                                     |
| "Heal 3 damage from the activating enemy and give it a tough status card" (Sauron's boost)          | `heal`, `giveStatus` on `activatingEnemy`                                                                             |
| "searches the encounter deck and discard pile for Sauron and deals him to themself as a facedown …" | `defeatingPlayer`, `dealAsEncounterCard` (Dreadpool, `deadpool` 44038)                                                |
| "Attach to the minion with the highest printed hit points. It activates against you. If no …"       | a superlative host (data), `enemyActivates`, a bound result, a gained surge                                           |
| "When attached enemy attacks you, take 2 damage and give the attacking enemy a tough status card"   | a forced interrupt on the host's attack; `dealDamage` to your identity; `giveStatus`                                  |
| "For each resource icon discarded this way … [energy] / [mental] / [physical] / [wild]"             | a bound deck discard and four counted loops, in the printed order                                                     |
| "While Shark-Girl is attacking an enemy, she gets +1 ATK for each upgrade attached to that enemy"   | a stat modifier whose `while` is `attackInProgress` and whose amount counts the target's upgrades (§3.67)             |
| "Until the end of the phase, each [ATTACK] event deals 1 additional damage" (46018)                 | a lasting `cardEffectBonus` over every player's events with the trait (Embiggen!, `msm`); each instance, RRG p. 10    |
| "Each player may search their deck and discard pile for an [ATTACK] event / identity-specific …"    | `forEachPlayer`, an optional search over two zones, `moveCards` to hand, a shuffle                                    |
| "that scheme loses each [acceleration], [amplify], [crisis], and [hazard] icon until the end of …"  | `on.youPlayedCard(self, fromHand)`, a chosen side scheme as the cost, a lasting `losesIcon` (wave 6 §3.38)            |
| "Remove 1 threat from a scheme for each [X-MEN] ally you control" (Beak)                            | `removeThreat` by a count                                                                                             |
| "Resource: Exhaust Jubilee → generate a [wild] resource."                                           | a `resource` ability on the hero face with `exhaustSelf`                                                              |
| "Wolverine's attacks gain piercing" / "After you change to alter-ego form, heal 3 damage from …"    | `attacksGainKeywords`; `on.playerChangesForm("alterEgo")`, `heal`                                                     |
| "Stun and confuse each chosen enemy" (Blinding Flash)                                               | `chooseTarget` with a count (§3.62), two `giveStatus`                                                                 |
| "Chamber takes -1 consequential damage after he attacks a confused enemy"                           | §3.67                                                                                                                 |
| "Play under any player's control. Max 1 per player. Action (thwart): Exhaust Disguise and your …"   | data (`anyPlayerControl`, `maxPerPlayer`); `exhaustSelf` and an identity exhaust as costs; `thwart`                   |
| "After your hero thwarts, deal 4 damage to an enemy (7 damage instead if that thwart removed …)"    | a hero response on the hero's thwart, basic or labeled; the thwart's `lastThreatRemoved` result                       |
| "Each [X-MEN] character gets +1 THW while making a basic thwart against this scheme"                | a stat modifier by trait whose `while` is the basic thwart in progress against `self`                                 |
| "Interrupt: When you use a basic power, exhaust Synch → you get +1 to that power for this use"      | `on.basicPowerUsed(your identity)`, `modifyBasicPower(1)`: attack, thwart, defense or recovery                        |
| "Team-Up (Jubilee and Wolverine). Max 1 per deck." / "Confuse an enemy. Deal 4 damage to a …"       | keyword and deck-limit data; `giveStatus`, then `attack` on a confused enemy (it may be another one)                  |
| "Toughness." / "After Nanny attacks you, if you control 1 or more allies, search … and reveal it"   | keyword; a forced response on her attack, a search over encounter deck, discard pile and the set-aside area           |
| "Place 1 threat here for each different resource type … on cards in your hand" (Naughty Children)   | `resourceTypesOf` over the hand: printed icons, a wild its own type                                                   |
| "Attach to the minion with the fewest remaining hit points. Otherwise … +3 hit points … [AERIAL]"   | a superlative host (data), a surge fallback, `gets`, `gainsTrait`                                                     |
| "Treat attached ally as a [REGRESSED] minion with a blank text box. …" ("Lost" Child)               | `treatAttachedAllyAsMinion([REGRESSED])`; 'Pool-ized (`deadpool` 44041) is the same card, word for word               |
| "Alliance. Choose an [X-FORCE] ally and an [X-MEN] ally and return them to their owners' hands …"   | the alliance keyword; a `returnToHand` cost over two chosen allies; `playFromHand` by each owner, cost ignored        |
| "Alliance. When any amount of threat would be placed on the main scheme, exhaust … → prevent …"     | an interrupt on threat placement on a main scheme, an `exhaustCards` cost of two picks, `preventThreat`, `giveStatus` |
| "Arcade cannot take damage while a [TRAP!] side scheme is in play" / "Discard cards … until …"      | `cannotTakeDamage` with a `while`; a discard-until that reveals (RRG p. 17 when the deck empties)                     |
| "Hinder 1[per_hero]." / "is stunned. If they were already stunned, they discard an ally or …"       | keyword data; `defeatingPlayer`, `giveStatus` with the "already" branch (RRG p. 7), `chooseCards`, `placeThreat`      |
| "Resolve the 'When Defeated' ability on each [TRAP!] side scheme as if you defeated it. If no …"    | `resolveSpecials { trigger: "whenDefeated" }` (wave 4 §3.46) with the resolving player as the defeater; a count       |

**As read, where the table is not enough.**

- **_"Freeze!"_** is an Interrupt to the basic attack or to the declaration, so the copy is on the enemy before damage:
  on a defense the attack is made at 1 less ATK. "A basic defense" is being declared the defender by exhausting or by an
  ability that declares him (RRG p. 15); a defense-labeled event is not one. The moment `"freeze"` is raised only when a
  copy was attached.
- **Cryokinetic Perception** resolves inside the attack or the defense: an ICE card drawn readies an Iceman who
  exhausted for it, and he may use the same basic power again later.
- **Frozen Solid.** The activation did not happen: no boost card, nothing "after [enemy] attacks", the copy attached by
  the "Then" stays (§3.61). A stunned or confused enemy loses that status card first (RRG p. 5) and Frozen Solid stays
  for the next activation. In a game of several players the villain goes on to activate against the next player.
- **Ice Blast** is not an attack (no label): guard does not stop it, retaliate does not answer it, Keep Up the Pressure
  does not raise it. An enemy with two copies takes 3 once. "The villain" with several villains in play is whichever the
  engine's rule for the phrase gives (wave 5; §3.7 here).
- **Keep Up the Pressure** raises every instance of damage that does not print "additional" in each event with the
  ATTACK trait, any player's, played after it is defeated in that phase: Grand Finale with three types deals 3 four
  times.
- **Shadowcat's cost** is choosing a side scheme in play: with none, no Response. A player side scheme can be chosen.
  The icons are lost until the end of the round even if the scheme gains one later (RRG "'Loses'", p. 27).
- **Waylay** answers a basic thwart or a thwart ability of the hero. "Removed the last threat from a scheme" is true if
  any scheme that thwart touched was left with none.
- **Generation X** reaches every player's X-MEN heroes and allies, and only a basic thwart.
- **Synch.** "You" is the identity: its basic attack, thwart, defense or recovery, in either form.
- **Mutant Mayhem.** The two allies are different cards, each with one of the traits, controlled by anyone; one owned by
  the scenario has no hand to return to and cannot be chosen, nor can an ally at the mission. Each owner then **plays**
  theirs: play restrictions, the unique rule and the ally limit apply, "after you play" and "enters play" abilities
  resolve again, and in a campaign game the destination is chosen (§3.34). An owner who cannot play theirs keeps it in
  hand.
- **Serve and Protect.** Any source of threat on the main scheme: the villain's scheme, step one of the villain phase,
  an encounter card. All of that placement is prevented. Whether one character with both traits can pay is §4.2 Q40
  (default A: two characters).
- **Life Drain.** The minion activates against the revealing player whoever it is engaged with: an attack in hero form,
  a scheme in alter-ego form. An ally under "Lost" Child is a minion and can be the host.
- **The Eye of Sauron** resolves all the [energy] icons, then [mental], [physical] and [wild], each icon once.
- **Elaborate Trap.** The schemes stay in play with their threat. With two or more, the first player orders them (RRG p.
  40). "If no abilities were resolved" is no TRAP! side scheme in play.
- **Arcade** cannot be assigned indirect damage while a TRAP! scheme is in play (RRG p. 24).
- **"Lost" Child** searches reach the set-aside area because the nemesis set starts there. The ally "engages its
  controller", keeps its damage and upgrades, and its SCH is its printed THW less 1 (the attachment's own −1), to a
  floor of 0; a Snow Clone's dash is 0.

### 3.71 A deck discarded until a trait's card is found; the whole discard read by cards that answer

> **Status: extend.** `EffectSpec discardDeckUntil { player, filter, bind }` (Teen Spirit, wave 2;
> `apply-effect.ts`) discards from the top of a player's deck until a card matches, binds **the match only**
> (`<bind>.count` is 0 or 1), stops at the discard that empties the deck (RRG p. 33) and marks
> `discardUntilFoundNothing` so a "then" after it is skipped. Every card it passes over is recorded as a deck discard on
> the frame (`recordDeckDiscard`, wave 7 §3.55), and `boundCardTotals` gives a bound set's count and printed icons.
> Nothing binds **the whole set** the effect discarded, and §3.39's moment (new, not built) carries no values to the
> cards that answer it. Checked before the row was opened against §3.48–§3.50, §3.52, §3.55 and §3.70: none binds a
> discard-until's passed-over cards.

**Cards.** Magneto 49001a (_Magnetic Pull_: "Action: Discard cards from the top of your deck until a [MAGNETIC] card is
discarded → add that card to your hand. (Limit once per round.)"); Magneto's Armor 49004 ("Response: After you resolve
your _'Magnetic Pull'_ ability, if you discarded at least 1 of the following resource icons: [mental] — Magneto gets +1
THW this round. [physical] — Magneto gets +1 ATK this round. [energy] — Magneto gets +1 DEF this round."); Magneto's
Cape 49005 ("Response: After you resolve your _'Magnetic Pull'_ ability, exhaust Magneto's Cape → ready Magneto."); Old
Grievances 49027 ("Forced Response: After you use your _'Magnetic Pull'_ ability, take 1 damage for each card discarded
by it.").

**Rules.** RRG 1.8 "Player Deck" (p. 33); "Discard" (p. 16); "Cost" (pp. 13–14) and "Cost Arrow Icon" (p. 14); "Resolve"
(p. 37: "An ability is resolved when it is triggered and one or more of its effects resolve"); "Limit" (p. 27: a
canceled ability "counts toward the limit"); "Wild Resource" (p. 48); "Forced" (p. 20). Rulings January 26, 2026 –
Ruling 6 (2); April 30, 2026 – Ruling 4 (1). The Magneto insert's strategy box (§0.5).

**Plan.**

- **`discardDeckUntil.bindAll?: string`**: every card the effect discarded, the match included, in discard order, with
  `boundCardTotals` over the slot (`<bindAll>.count`, `.physical`, `.mental`, `.energy`, `.wild`). A card a response of
  its own took out of the discard (wave 7 §3.55, `settleDeckDiscards`) is dropped from the slot as it is from every
  "discarded this way" set.
- **`raiseMoment { name, player, carry?: string[] }`** (§3.39): the named slots and their vars are stamped on the
  `momentRaised` event, so a card that answers the moment reads them after the raising ability's frame is gone. §3.62
  does the same for a payment on `cardPlayed`. A moment with no `carry` is unchanged.
- **_Magnetic Pull_** is then one script: an action on the hero face, limit once per round;
  `discardDeckUntil({ trait: MAGNETIC }, "found", { bindAll: "pulled" })`, the found card to hand,
  `raiseMoment("magneticPull", you, ["pulled"])`. The Armor, the Cape and Old Grievances are
  `on.moment("magneticPull")` with "you" its player, the same shape as Bishop's Uniform and Cryokinetic Perception
  (§3.39).
- **The arrow.** The printed text is a cost and an effect; the engine resolves a discard-until as an effect with the
  "then" rule, and both give the same result while a MAGNETIC card is found. What they give when none is found is §4.2
  Q41 (default A).

**As read.**

- **A MAGNETIC card** has the trait printed: all fifteen cards of his kit (Asteroid M, the Helmet, the Armor, the Cape,
  Magnetic Bubble, Wrapped in Metal ×2, Electromagnetic Blast ×2, Metal Shards ×2, Magnetic Missile ×2, Master of
  Magnetism ×2), 15 of the starter deck's 40. No other card of the pool has it on a player card.
- **An Action on the hero face:** any action window while he is in hero form, the villain phase's included (a Pull
  before the villain attacks can give +1 DEF for the round). The round's limit persists across a flip (ruling January
  26, 2026).
- **The found card** is discarded and then added to hand: it was in the discard pile for a moment, and whether it counts
  as "discarded" for the Armor and for Old Grievances is §4.2 Q42 (default A: it does).
- **Magneto's Armor** reads the printed icons of every card the Pull discarded. Each line resolves at most once however
  many icons of that type there were; a [wild] is none of the three (RRG p. 48; §3.70 reads deck discards the same way).
  The bonuses are stat modifiers on the hero until the end of the round. It does not exhaust.
- **Magneto's Cape** readies the hero; _Magnetic Pull_ does not exhaust him, so the Cape is a second basic power in the
  round.
- **Old Grievances** is forced and comes before the two Responses (RRG "Ability", p. 5). Its damage is one instance of
  X: a tough status card stops all of it, and Magnetic Bubble takes all of it (§3.81).
- **"Use" and "resolve".** Old Grievances answers a Pull that was used; the Armor and the Cape answer one that resolved.
  They differ only when no MAGNETIC card was found (Q41).
- **The deck resets in the middle:** the discard that empties the deck resets it and deals an encounter card, and the
  Pull stops there (RRG p. 33). A MAGNETIC card that was the deck's last card is found, in the new deck, and is taken
  from it (wave 3 §4 Q18).
- **Not a mission attempt** (§3.38): no Mission Response answers it and nothing is paired.

**Log.** `cardMoved` per discard (exists), the found card's `cardMoved` to hand,
`momentRaised { name: "magneticPull", carried: { pulled: […] } }`.

**Tests (exact numbers).** Magneto THW 2, ATK 2, DEF 2, 10 hit points.

1. The top of his deck is Squared Off ([physical]), Noble Sacrifice ([mental]), Metal Shards (MAGNETIC, [physical]): the
   Pull discards three cards, Metal Shards is in his hand and the other two are in his discard pile. A second Pull that
   round is refused; after a flip to Erik Lehnsherr and back in the same round it is still refused; next round it is
   offered.
2. Magneto's Armor in play, the top two cards Noble Sacrifice ([mental]) and Magnetic Bubble (MAGNETIC, [energy]): Q42 =
   A: THW 3 and DEF 3 until the end of the round, ATK 2. Q42 = B: THW 3 only.
3. The discard is Asteroid M alone (MAGNETIC, [wild]): no Armor line resolves and the Response is not offered.
4. Magneto's Cape ready: he thwarts for 2 and exhausts, uses the Pull, exhausts the Cape and readies, attacks for 2.
5. Old Grievances in play, test 1's Pull: Q42 = A: 3 damage, 10 to 7. Q42 = B: 2. With a tough status card: 0 and the
   card is gone. With Magnetic Bubble: 3 damage on the Bubble, 10 stays.
6. Old Grievances and the Armor both in play: the damage is dealt before the Armor is offered.
7. **Q41 = A.** A deck of four cards with no MAGNETIC card: four discarded, the deck resets, one facedown encounter card
   is dealt to him, nothing is added to his hand, the Armor and the Cape are not offered, Old Grievances deals 4, and
   the round's use is spent.
8. The MAGNETIC card is the last card of his deck: the deck resets, one facedown encounter card is dealt to him, and the
   card is taken into his hand from the new deck.

**Composes with:** §3.39 (which this extends), §3.62 (the same stamping on an event), wave 7 §3.55.

### 3.72 An upgrade on an enemy that makes its owner's hero the defender; one named copy fetched and returned

> **Status: exists (verify).** `declareDefender(character)` with no exhaust is Shieldmaiden's (wave 4 §3.22: "the first
> card `character` names becomes the defender of the innermost enemy attack; a hero is making a basic defense, so its
> DEF reduces the damage"; the effect's own comment lists Bamf!), `on.enemyAttacks(host)` an interrupt at the attack's
> initiation, `discardSelf` a cost, `attachesTo: enemy` with `maxPerHost` data, `cannotHaveAttachments` narrowed to
> upgrades a rule (§3.67), and a search that attaches is `chooseCards` + `attachCard`. Not run: a player upgrade on an
> enemy whose interrupt answers that enemy's attack **on another player or on an ally**; a hero declared the defender of
> an attack that began against another player; a moment (§3.39) raised by the upgrade's own ability with the discarded
> copy as its source; a copy attached straight from a deck or a discard pile; one ability bought back each phase.

**Cards.** Bamf! 48006 ×3; Nightcrawler 48001a (_Rapid Teleportation_); Kurt Wagner 48001b; Daytripper 48002; 'Port and
Punch 48007; Teleport Drop 48008; Scout Ahead 48009; 'Port Away 48010; Tally Ho! 48011. Azazel 48027 ("Azazel cannot
have upgrades attached").

**Rules.** RRG 1.8 "Attack (Enemy Activation)" (pp. 8–9); "Defend, Defense" (p. 15); "Attacks Against Allies" (p. 10);
"Upgrade" (p. 46: an upgrade attached to an enemy stays its player's, and one not attached to another friendly character
is "an extension of the controlling player's identity"); "Activation" (p. 6: "If an activating minion leaves play, that
minion's activation ends immediately"); "Stun, Stunned" (p. 41); "Cost" (p. 14); "Form, Change Form" (p. 21); "Search"
(p. 39); "Limit" (p. 27). Ruling January 26, 2026 – Ruling 6 (2). The Nightcrawler insert's strategy box (§0.5). **No
ruling names a card of the kit.**

**Checked against §3.49 first** (pass 2b's note): _Rapid Teleportation_ and Tally Ho! **return** a copy to hand; nothing
plays a card from a discard pile, so no play permission is involved. Bamf! is played from hand like any upgrade, for 0.

**As read.**

- **Bamf! is an upgrade with a host** (cost 0, no trait, [physical]): "Attach to an enemy. Max 1 per enemy." It prints
  no "Hero form only", so Kurt Wagner may play it on his turn; its ability is a Hero Interrupt. A minion in the mission
  area is not a legal host (§3.33). Azazel is not one either.
- **"When attached enemy attacks"** has no "you": any attack of that enemy, on the Nightcrawler player, on another
  player or on an ally (RRG p. 10), basic or made by a card. The interrupt has the timing of "initiates an attack" (RRG
  p. 9), so it resolves before a boost card is turned and before anyone else is declared; once another character is the
  defender it is too late and was never offered.
- **"Declare Nightcrawler as the defender without exhausting him":** the Bamf! controller's hero, by title. He is making
  a **basic defense** (RRG p. 15): his DEF reduces the damage, an exhausted Nightcrawler can be declared, and everything
  that answers a hero's defense answers it (Riposte, Under Control, Astonishing X-Men, Unflappable). He becomes the
  attack's target character and his player the target player (RRG p. 8): "after [enemy] attacks you" abilities, boost
  abilities that say "you", indirect damage and overkill are his.
- **A stunned enemy** does not attack (RRG p. 41): no interrupt, and the copy stays on it. An attack a cancel or Frozen
  Solid replaced is the same (wave 5 §4.1 Q3).
- **Tally Ho!** answers the moment Bamf!'s ability resolves, `"bamf"`, raised by the Bamf! script with the discarded
  copy as the moment's source: "that copy" is that card, returned from the discard pile to hand, and "the attacking
  enemy" is the attacker of the attack in progress. It resolves at once, before boost cards and damage. Its 3 damage is
  not an attack (the label is defense): no retaliate answers it. If it defeats a minion the attack ends there (RRG p.
  6), nobody takes damage, and "after … defends … and takes no damage" abilities still resolve (RRG p. 9).
- **_Rapid Teleportation_:** "Spend 1 resource of any type" is a resource cost of 1 paid like any other (a card from
  hand, a resource ability that may pay for an ability of the identity; Prehensile Tail's [wild] is for an event and
  cannot). With no copy in his discard pile it has no target and is not offered. Once per phase, so once in the player
  phase and once in the villain phase, where a copy spent on the villain's attack can be bought back before a minion's.
- **Kurt Wagner's Action** searches his deck only and shuffles it, found or not; once per round.
- **Daytripper** searches deck and discard pile (not the hand), and the copy is **attached**, not played: no cost, "Max
  1 per enemy" and "cannot have upgrades attached" still bind where it may go (RRG p. 32: a card put into play obeys the
  rules of playing it). With no legal enemy the copy stays where it was. Then 1 damage to each enemy that has a copy,
  hers or not. One shuffle.
- **'Port and Punch:** 3 damage to an enemy, then 3 to each enemy with a copy attached: the first enemy takes two
  instances if it has one. All of it is the attack's damage.
- **Teleport Drop:** the cost discards a copy he controls from an enemy he may attack, and that enemy is the target: 8
  damage and a stunned status card.
- **Scout Ahead:** the second removal needs a second scheme and a copy in hand; it is part of the same thwart.
- **'Port Away** (cost 0): an Action in any window, in either form. The change of form is an effect and does not use his
  one change for the round (RRG p. 21); a player who cannot change form cannot play it.
- **An upgrade on an enemy** is what §3.67's cards read: Take That!, Surprise Move, Glob and Shark-Girl count Bamf!,
  Under Control and Wrapped in Metal.

**Tests (exact numbers).** Nightcrawler THW 2, ATK 1, DEF 3, 9 hit points; a villain with ATK 2.

1. He plays Bamf! on the villain for 0. In the villain phase the villain attacks him: the copy is discarded, he is the
   defender and is not exhausted; the boost card has 2 icons: 4 less DEF 3 is 1 damage, 9 to 8.
2. He thwarted on his turn and is exhausted: test 1 resolves the same way.
3. Two players. The villain (a copy attached) attacks player 2, a hero: he uses Bamf!, takes the damage as in test 1,
   and a fixture "Forced Response: After the villain attacks you, discard 1 card" resolves on the Nightcrawler player.
4. A minion with 3 hit points and a copy attacks: Bamf!, then Tally Ho! (cost 1): the copy is in his hand, the minion is
   defeated before its damage, the attack ends, he takes 0. With Astonishing X-Men in play, 1 threat is removed from it.
5. The villain is stunned with a copy attached: the stunned card is discarded, no interrupt is offered, the copy stays.
6. Kurt Wagner, a copy on a minion that attacks player 2: the interrupt is not offered (Hero Interrupt).
7. _Rapid Teleportation_ with a copy in his discard pile: he discards a card, the copy is in hand; a second use that
   phase is refused; in the villain phase it is offered again. With no copy in the discard pile: not offered. Prehensile
   Tail is not offered as payment.
8. Kurt Wagner's Action with all three copies out of his deck: nothing is added, the deck is shuffled, the round's use
   is spent.
9. Daytripper enters play, a copy in his discard pile, the villain already has one, a minion does not: the copy goes on
   the minion and the villain and the minion each take 1. With Azazel the only enemy without a copy: nothing is
   attached, and the villain takes 1.
10. A second Bamf! is not playable on an enemy that has one (`whyNot`: max 1 per enemy).
11. 'Port and Punch on a villain with a copy, a minion also with one: 6 to the villain, 3 to the minion. Teleport Drop
    on that villain: the copy is discarded, 8 damage, stunned.
12. Scout Ahead with 5 threat on the main scheme and 3 on a side scheme: 3 removed from one; a copy discarded from hand:
    3 from the other. With one scheme in play the copy is not asked for.
13. On his turn, after his one change to hero form, 'Port Away: he is Kurt Wagner and ready.

**Composes with:** §3.39 (the moment `"bamf"`), §3.56, §3.67, §3.81; wave 4 §3.22.

### 3.73 "Counts as 2 restricted cards" beside "1 additional upgrade that has the restricted keyword"

> **Status: exists (verify).** `PlayerCard.restrictedWeight` is data (wave 7 §3.82; §4.1 Q52 there = B: the card "only
> weighs on the limit: text that names restricted cards does not see it, and the cards discarded for the limit must
> carry the keyword"); `restrictedLoadOf`, `restrictedStanding` and `checkRestricted` read it (`rules.ts`,
> `resolve/enter-play.ts`), and the schema refuses the field beside the keyword.
> `RuleSpec restrictedLimit { amount, cards? }` raises the limit, with `cards` only for as many held keyword cards
> as match (wave 3 §3.22; Side Holster). Not run: the two on one table; a weighted card that has not been emitted with
> its weight.

**Cards.** Kurt's Cutlasses 48004 ("Counts as 2 restricted cards. Nightcrawler gets +1 ATK, +1 DEF, and gains retaliate
1."); Prehensile Tail 48005 ("You can control 1 additional upgrade that has the restricted keyword. Resource: Exhaust
Prehensile Tail → generate a [wild] resource for an event.").

**Rules.** RRG 1.8 "Restricted" (p. 38: "if a player ever controls more than two restricted cards in play, they must
immediately choose and discard from play restricted cards they control until they have only two in play"); "Retaliate X"
(p. 38).

**The decision on Kurt's Cutlasses (the data survey's regen drift).** **The card is emitted with `restrictedWeight: 2`
and one constant ability id**, as Laser Swords 44055 is: the sentence is data, so it holds without the card's script,
and the script is the stat line alone. Today's emitted record has neither the field nor the right ids
(`[48004.kurts-cutlasses-constant, 48004.kurts-cutlasses-constant-2]`), so **in the current data the Cutlasses weigh
nothing**. The data agent regenerates this one card and reviews the diff by hand (§5.5). It is not a restricted card: it
has no keyword, and under wave 7's Q52 = B it is never the card discarded for the limit.

**As read.**

- **The Cutlasses alone fill the limit** (load 2 of 2). A restricted upgrade played beside them makes 3: the player
  discards a card with the keyword, which can only be the one just played. So without the Tail he controls no restricted
  card while the Cutlasses are in play.
- **The Tail** is `restrictedLimit(1, { cards: <an upgrade with the restricted keyword> })`, the form Side
  Holster has: room for one more card, and only a keyword upgrade fills it. The Cutlasses cannot use that room; they sit
  in the base two. With both in play he holds the Cutlasses and **one** restricted upgrade (load 3 of 3).
- **The Tail leaves play** with the Cutlasses and a restricted upgrade in play: load 3 of 2, and the restricted upgrade
  is discarded (the between-frames check, wave 7).
- **Venom's identity prints the Tail's sentence** and is scripted as the plain form (`restrictedLimit(1)`, `vnm`
  20001a/b). All 35 restricted cards of the pool are upgrades, so no table can tell the two forms apart today; the Tail
  takes the printed form and Venom's script is left alone. Reported, not a question.
- **"For an event"**: the Tail's [wild] pays for an event card only (`generatesFor`), not for _Rapid Teleportation_, an
  ally or an upgrade. It is a Resource with no form, so it works in alter-ego form too.
- The Cutlasses' bonuses are on the hero titled Nightcrawler: no ATK, DEF or retaliate as Kurt Wagner.

**Tests (exact numbers).**

1. After the regeneration: `restrictedWeightOf` the Cutlasses is 2 and `restrictedCardsOf` the player does not list
   them.
2. The Cutlasses in play (ATK 2, DEF 4, retaliate 1): he plays Plasma Pistol (`vnm` 20022, restricted): he must discard
   one restricted card and the Pistol is the only choice.
3. The Cutlasses and the Tail in play: Plasma Pistol stays (3 of 3). A second restricted upgrade: one of the two keyword
   upgrades is discarded, his choice; the Cutlasses are not offered.
4. Test 3's first state, then a fixture discards the Tail: Plasma Pistol is discarded.
5. The Tail with no Cutlasses: three restricted upgrades stay.
6. The Tail's resource: offered while paying for Tally Ho!, not for Bamf!, Daytripper or _Rapid Teleportation_.
7. A minion attacks him with the Cutlasses in play: it takes 1 after the attack. As Kurt Wagner, schemed against:
   nothing.

**Composes with:** wave 3 §3.22, wave 7 §3.82.

### 3.74 An encounter card tucked under an ally; X read from its boost icons; another character's base stats

> **Status: exists (verify).** `EffectSpec lookAt` (RRG p. 27; Jessica Drew), `tuckCards { cards, under }` and the
> `tucked` zone (discarded when the host leaves play), `ValueSpec boostIconsOn`, a printed `"X"` stat read as a base of
> 0 (`query.ts`) with `StatModifierSpec.setBase` to define it and `ValueSpec stat { base }` to read it (wave 7
> §3.25, built for ruling January 17, 2026 – Ruling 1), a damage cost on another card, a lasting trait grant and a
> lasting stat modifier. Not run: an **encounter** card tucked under a **player** card from a look at the top of the
> encounter deck; a base defined by a tucked card's boost icons; a base read from a card whose value is X; the
> Protection ally Rogue, which the ruling names and no script has used.

**Cards.** Gambit 48021 ("X is the number of boost icons ([boost]) on the card under Gambit. Response: After Gambit
enters play, look at the top 3 cards of the encounter deck and tuck one under him so that only the boost field is
visible."); Rogue 48012, erratum RRG p. 69 ("Action: Deal 1 damage to another friendly character → until the end of the
round, Rogue gains each of that character's Traits and adds that character's base THW and ATK to her matching powers.
(Limit once per round.)").

**Rules.** RRG 1.8 "Tuck" (p. 45); "Look, Looked-At" (p. 27); "Boost, Boost Icon" (p. 11); "Amplify Icon" (p. 7: the
extra icon is added "When a boost card is turned faceup during an enemy activation"); "Non-Numerical Variable" (p. 30);
"Star Icon" (pp. 40–41); "Base Value" (p. 10: "A defined value before modifiers are applied"); "Cost" (p. 14: a cost
that targets a "friendly" card may take one the player does not control; a cost of dealing damage is paid even if the
damage is prevented); "Lasting Effects" (p. 26); "Leaves Play" (p. 27); "Target" (p. 43: a character with a THW or ATK
of 0 can still use the power). Rulings January 17, 2026 – Ruling 1 (1); February 28, 2026 – Ruling 7 (1). The
Nightcrawler insert, "Tuck" (§0.5).

**As read: Gambit.**

- **The look** is the top three cards of the encounter deck, or what it holds; only his controller sees them, and the
  two not chosen go back on top in the same order (RRG p. 27). One must be tucked: the Response is optional, its tuck is
  not.
- **The tucked card** is faceup under him and out of play: it is not attached, nothing on it is active, it is no boost
  card, and a unique card there blocks nothing (ruling February 28, 2026). It is open information; the client shows its
  boost field first, as the card asks. When Gambit leaves play it goes to the encounter discard pile.
- **X** is the printed boost icons of that card: a star is not an icon (RRG p. 11), and an amplify icon in play adds
  none, because the card is never turned faceup as a boost card. X is both THW and ATK, defined as their **base**
  (`setBase`), so other modifiers add to it and Rogue reads it.
- **No card under him** (the Response declined, or his text box blank): X is 0 (RRG p. 30). He can still attack or
  thwart for 0 and takes his 1 consequential damage.
- **At the mission** (§3.34) his text box is blank: nothing is tucked and he adds 0 and 0 to an attempt.

**As read: Rogue.**

- **The cost** is 1 damage dealt to another friendly character, any player's, an identity included. Dealt is enough: a
  tough status card on the target is discarded and the cost is paid.
- **"Base THW and ATK"** is the character's value before modifiers: a hero's printed number (Nightcrawler with Kurt's
  Cutlasses gives ATK 1, not 2); a star or an X as its own text defines it (the ruling; Gambit's X; Hope Summers's
  stars). An alter-ego has neither power and gives 0 and 0; a dash gives 0 (RRG p. 15).
- **Traits** are the character's traits, printed and gained.
- **Until the end of the round** it is a lasting effect and is read from that character as the game changes (RRG p. 26).
  If the character leaves play, or the cost's own damage defeats it, there is nothing to read; whether Rogue keeps what
  she copied is §4.2 Q43 (default A: no).
- Once per round, on her own card; she need not be ready.

**Tests (exact numbers).**

1. Gambit enters play; the top three encounter cards print 0, 2 and 3 boost icons, the third with a star: he tucks the
   third: THW 3, ATK 3. The other two are the top two cards, in their order.
2. An amplify icon is in play: still 3 and 3.
3. He tucks a card with a star and no icon: THW 0; he thwarts, removes 0 and takes 1 consequential damage.
4. The tucked card is a unique minion: a second copy of that minion revealed from the encounter deck enters play.
5. Gambit is defeated: the tucked card is on top of the encounter discard pile.
6. Rogue (THW 2, ATK 2) deals 1 damage to test 1's Gambit: he has 2 hit points left; she has THW 5, ATK 5 and the THIEF
   trait until the end of the round.
7. Rogue deals 1 damage to Nightcrawler with Kurt's Cutlasses in play: THW 4, ATK 3.
8. Her target has a tough status card: the card is discarded, no damage, and she copies.
9. Q43 = A: her target is an ally with 1 hit point left: it is defeated and she gains nothing. Q43 = B: she has its
   traits and base powers until the end of the round.
10. Next round the bonus is gone and the Action is offered again.

**Composes with:** wave 7 §3.25; §3.80 (the hero Gambit and the hero Rogue).

### 3.75 A minion in play dealt to a player as a facedown encounter card, and passed to the next player

> **Status: extend.** `EffectSpec dealAsEncounterCard { cards, player }` deals a card that is **out of play** (You
> Dare Oppose Me?, wave 3 §3.47; Dreadpool; Sauron Lives!) and one that is defeated and waiting to leave; for any other
> card in play it does nothing, and its comment says why: "A card in play is not dealt: no printed card deals one"
> (`resolve/cards.ts`, `dealAsEncounterCards`). A boost card that deals itself is Ironheart's nemesis
> (`boost(dealAsEncounterCard(self))`, `ironheart` 29031). No effect moves a facedown encounter card from one player's
> queue to another's. Searched `spec.ts` and the DSL for "pass", "nextPlayer" and a dealt-card move: none.

**Cards.** The Crazy Gang 48033 ("Forced Response: After a non-[ELITE] minion schemes against a player, deal that minion
to that player as a facedown encounter card. Then, if there is more than 1 player in the game, pass that facedown
encounter card to the next player."); Brimstone Dimension 48028 ("When Defeated: The player who defeated this scheme
finds Azazel and deals him to themself as a facedown encounter card": a find reaches a card in play, §3.1). Composes
with Azazel 48027's Boost, which needs nothing new.

**Rules.** RRG 1.8 "Deal, Deal an Encounter Card" (p. 15: a card dealt "during step three or four of the villain phase …
is added to the queue of cards that are being dealt and revealed in those same steps"); "Leaves Play" (p. 27); "In Play
and Out of Play" (p. 23: "facedown encounter cards dealt to a player are out of play"); "In Player Order" (p. 24: "next
player"); "Scheme (Enemy Activation)" (p. 39); "Confuse, Confused" (p. 13: a confused minion "is not considered to have
… schemed"); "'Then'" (p. 44); "Find" (p. 19); "Permanent" (p. 32).

**Plan.**

- **`dealAsEncounterCard` takes a card in play.** It leaves play facedown to the named player's dealt queue through the
  ordinary leave (`leavePlay`): attachments and tucked cards are discarded (a permanent player upgrade is unattached and
  then follows its own text, as Frostbite does, §3.61), boost cards on it are discarded, damage, counters and status
  cards are gone (RRG p. 27). It is **not defeated**: no When Defeated, no victory display, no "after you defeat"
  response. A card that cannot leave play is not dealt, and then the "Then" does not resolve.
- **`EffectSpec passEncounterCard { cards, from: PlayerRef, to: PlayerRef }`**: a facedown dealt card moves from
  one player's queue to another's, still facedown. "The next player" is the next player in player order who is still in
  the game (`PlayerRef` `nextAfter(player)`; with one player the effect is not reached).
- **When it is revealed.** The card is revealed with its holder's other facedown cards in step four of the same villain
  phase when it was dealt in steps one to four (a minion schemes in step two), or in the next villain phase otherwise.
  Revealed, the minion enters play engaged with that player as a new copy: When Revealed, quickstrike and toughness
  resolve again.

**As read: The Crazy Gang.**

- **Any non-ELITE minion**, of any set, whose scheme activation resolved against a player: step two's against an
  alter-ego, or one a card made ("He schemes"). A scheme for 0 is a scheme (the set's four minions print SCH 0). A
  confused minion, a minion under Wrapped in Metal and a canceled activation did not scheme (§4.1 Q4's reading).
- **"That player"** is the player schemed against; with two or more players the card ends in front of the next player,
  who reveals it.
- The Forced Response resolves after the scheme's threat is placed and after the minion's own "after … schemes"
  abilities, in the order the first player sets.
- ELITE is read when the response resolves, gained traits included.

**As read: Brimstone Dimension.** The defeating player finds Azazel wherever a find reaches (in play, set aside, a
discard pile, the encounter deck; never a facedown dealt card, a boost card or the victory display, §3.1). In play, he
leaves it with whatever he carried and loses his damage. Found nowhere, nothing is dealt. The scheme's hazard icon
(§0.5) is data.

**Tests (exact numbers).**

1. Solo, The Crazy Gang in play (2 threat). Kurt Wagner is engaged with Jester (SCH 0, 2 damage on him, an Under Control
   attached). Step two: Jester schemes for 0; he is dealt to the player facedown, Under Control is in its owner's
   discard pile, and the main scheme gained nothing from him. Step four: the player reveals his own dealt card and then
   Jester, who enters play with 5 hit points and confuses him.
2. Two players, player 1 in alter-ego form with Executioner: after the scheme the card is in front of player 2, who
   reveals it in step four: Executioner is engaged with player 2 and attacks the friendly character with the fewest
   remaining hit points.
3. The minion is confused: the confused card is discarded, no scheme, it stays in play.
4. An ELITE minion (Azazel, SCH 2) schemes: 2 threat, it stays in play.
5. A minion with a Frostbite attached schemes with The Crazy Gang in play: the copy is unattached, set aside by its own
   Forced Response, and the minion is dealt.
6. Brimstone Dimension (5 threat) is defeated by player 1 while Azazel, with 2 damage, is engaged with player 2: Azazel
   is facedown in front of player 1 and is revealed in the next villain phase with 3 hit points; in hero form he then
   attacks (quickstrike).
7. Azazel is in the victory display by a fixture: nothing is dealt.
8. No `characterDefeated` is logged in tests 1, 2 and 6.

**Composes with:** §3.1, §3.61; wave 3 §3.47.

### 3.76 An upgrade that stops a minion activating and blanks it; a minion discarded from play by a player

> **Status: exists (verify).** `RuleSpec cannotActivate { target, while? }` ("the matching enemy's attack or scheme
> activation does not begin, wherever it would": the villain phase's, an effect's, quickstrike, teamwork; no boost card;
> logged `activationBlocked`), `RuleSpec blankTextBox` over a class of cards with traits kept (§3.34; Tech Theft;
> Inhibitor Collar), `attachesTo` a non-ELITE minion and `form: "hero"` (data, as emitted), `discard` of a card in play
> that is not a defeat. Not run: both rules on one host from a **player** upgrade; printed keywords of a blanked minion;
> a minion discarded by a player's event with the upgrade on it.

**Cards.** Wrapped in Metal 49007 ×2 ("Hero form only. Attach to a non-[ELITE] minion. Attached minion cannot activate.
Treat its printed text box as if it were blank."); Magnetic Missile 49010 ×2, erratum RRG p. 69 ("Hero Action: Discard a
minion with Wrapped in Metal attached. Then, deal 5 damage to an enemy and stun it.").

**Rules.** RRG 1.8 "Text Box" (p. 44); "Traits" (p. 45); "'Cannot'" (p. 11); "Activation" (p. 6); "'Then'" (p. 44);
"Cost" (p. 14: a cost is paid with cards the player controls, which is what the erratum's "Then" repairs; ruling March
6, 2026 – Ruling 3 (1) is the same change on another card); "Defeat" (p. 15) and "Discard" (p. 16); "Leaves Play" (p.
27); "Guard" (p. 21), "Patrol" (p. 32), "Quickstrike" (p. 36), "Villainous" (p. 47). The Magneto insert's strategy box.

**As read.**

- **Blank:** the minion's printed abilities, its printed keywords and the icons in its text box (RRG p. 44) are off: no
  guard, patrol, quickstrike, retaliate or villainous, no "When Defeated", no Forced Response. Its traits, its SCH, ATK
  and hit points, its boost icons and anything attached to it are not text box and stay. A tough status card it already
  has stays.
- **Cannot activate:** it neither attacks nor schemes, in step two or by a card. "Each minion activates … If no minion
  activates this way" (Angry Acolyte, "Off with His Head!") counts it as not activating. It stays engaged and can be
  attacked.
- **Not a legal host:** an ELITE minion (Azazel, Exodus), a minion in the mission area (§3.33). A minion that gains
  ELITE later keeps the upgrade.
- **Magnetic Missile** as errata: the discard is the first effect, not a cost, and the damage waits on it ("Then"). With
  no wrapped minion in play the event cannot be played: nothing it says could happen. The minion is **discarded, not
  defeated**: nothing answers a defeat, a Victory minion goes to the encounter discard pile, and Wrapped in Metal goes
  to its owner's discard pile. Any player's wrapped minion will do. Then 5 damage to an enemy and a stunned status card;
  no label, so it is not an attack (guard does not stop it, retaliate does not answer).
- **The Crazy Gang** (§3.75) never deals a wrapped minion: it does not scheme.

**Tests (exact numbers).**

1. Wrapped in Metal (cost 2) on Hellfire Pawn (guard, patrol): Magneto attacks the villain and thwarts the main scheme.
   In the villain phase the Pawn does not activate (`activationBlocked`).
2. On Fabian Cortez (guard, When Defeated: discard 4): defeated by an attack, no cards are discarded from the defeating
   player's deck.
3. Frenzy revealed (quickstrike) attacks; wrapped afterwards, she is found and revealed by a fixture: no quickstrike
   attack.
4. Exodus and Azazel are not offered as hosts. Erik Lehnsherr cannot play it.
5. Magnetic Missile (cost 1) with a wrapped Pawn at full health and a villain at 12 of 14: the Pawn and the upgrade are
   discarded, no `characterDefeated`, the villain is at 7 and stunned.
6. No wrapped minion in play: the Missile is not offered (`whyNot`).
7. Angry Acolyte revealed with a wrapped Frenzy the only ACOLYTE minion engaged: no activation, so encounter cards are
   discarded until an ACOLYTE minion, which is revealed.

**Composes with:** §3.34's blank, §3.67, §3.75.

### 3.77 An attachment chosen by the label of an ability it prints ("Hero Action", "Hero Response")

> **Status: new.** A `TargetQuery` can read a card's type, traits, name, keywords, attachments and stats; none reads
> what kind of ability a card prints. Searched `select.ts`, `spec.ts` and the DSL for an ability-label or text test on a
> target: none (`hasBoostAbility` is the one reader of a card's ability list, for boost cards).

**Cards.** Electromagnetic Blast 49008 ×2 ("Hero Action (thwart): Remove 3 threat from a scheme. If this removes the
last threat from that scheme, you may discard an attachment with the text **'Hero Action'** or **'Hero Response.'**").
What it can take in this wave: Azazel's Sword 48029 (Hero Response), Golden Horse 45090 and Metal Wings 45091, Prelate
Sidearm 45063 and Prelate Armor 45064, High-Tech Goggles 45122 and Genetic Enhancement 45123. Across the raw pool 118 of
311 attachments print one of the two labels, and 24 print only another player label.

**Rules.** RRG 1.8 "Attachment" (p. 8: an encounter card type; "Only the player who controls the card to which that
attachment is attached can trigger abilities … on that attachment"); "Text Box" (p. 44) and "Printed" (p. 35); "Ability"
(pp. 4–5: the bold label names the ability's type and form); "Permanent" (p. 32); "Thwart" (p. 44).

**Plan.** **`TargetQuery.printsAbility { kinds: ("action" | "response")[]; form: "hero" }`**: true for a card
whose own printed ability list (`printedAbilityRefs`, read through the registry) has a triggered ability of one of those
kinds limited to that form. It reads what is printed, so a blank text box does not hide it and a granted ability does
not add to it. The engine names no card; a later card that says "with the text 'Alter-Ego Action'" passes other values.

**As read.**

- **The two labels only.** "Hero Interrupt" (Bandolier of Stakes), a plain "Action" or "Response" with no form (Wrapped
  in Metal of _Mutant Genesis_, Telepathic Restraint) and "Alter-Ego Action" do not match. A **Forced** Response is
  another label and does not match.
- **An attachment** is the encounter card type: a player upgrade on an enemy is not one. It may be attached to anything,
  the villain, a minion, an identity, a scheme.
- **"If this removes the last threat"**: the thwart's removal left that scheme with none, whether it removed 3 or fewer.
  The discard is optional, is not a defeat, and cannot take a permanent attachment.
- With the scheme defeated its When Defeated resolves in the usual order; the discard is the event's own next effect.

**Tests (exact numbers).**

1. A side scheme with 3 threat, Azazel's Sword on the villain: Electromagnetic Blast (cost 2) removes 3, the scheme is
   defeated, he discards the Sword.
2. The scheme had 4: 1 left, no discard offered. It had 2: 2 removed, the discard is offered.
3. The only attachment in play is _Mutant Genesis_' Wrapped in Metal on a hero ("Action"): nothing is offered.
4. A fixture attachment with "Hero Interrupt" and one with "Forced Response": neither is offered.
5. Sauron's Life Drain (no player ability) and a Frostbite (an upgrade) on a minion: neither is offered.
6. He is confused: the confused card is discarded, no threat is removed, nothing is discarded, the event is spent.

### 3.78 Linked allies taken into hand from the set-aside area; allies outside the ally limit by a trait

> **Status: exists (verify).** Setup sets aside every linked card under the title a deck holds, with no owner
> (`setup.ts`, `linkedCardsByTitle`, `linkedCardsSetAside`; wave 7 §3.75, landed for X-23's Specialists), `validateDeck`
> refuses a linked card (`linked_card`), an ownerless set-aside player card put into play takes its controller as owner
> (`apply-effect.ts`), player side schemes and their limit are wave 7 §3.1–§3.2, and
> `excludedFromAllyLimit { target, while }` is Stinger's and Longshot's. Checked against wave 7's linked rule as
> pass 2b asked: the rule is the same, the card that brings them in differs. Not run: a linked card **added to a hand**
> rather than put into play, and owned from then on; linked cards that are unique allies; two decks that both hold the
> scheme; an ally-limit exclusion that depends on the identity's trait and can lapse on a flip.

**Cards.** New Recruits 49020 ("Victory 0. Play only if your identity has the [X-MEN] trait. When Defeated: Each player
chooses 1 set-aside [NEW] ally and adds it to their hand."); Surge 49033, Anole 49034, Bling! 49035, Indra 49036
("Linked (New Recruits). If you have the [MUTANT] or [X-MEN] trait, [name] gets +1 ATK / gets +1 THW / gains toughness /
gets +2 hit points and does not count against your ally limit."); Children of the Atom 49037.

**Rules.** RRG 1.8 "Linked (Card Title)" (p. 27: "The number of linked cards set aside during setup is equal to the
number of those cards included in the product"; "set aside the appropriate number of cards for each deck that contains
the named card"; "When a player takes control of a card with the linked keyword, that player becomes the owner of that
card"); "Ownership and Control" (p. 31: "A player controls the cards in their own out-of-play areas (such as the hand
…)"); "Player Side Scheme" and "Player Side Scheme Limit" (p. 34); "Ally Limit" (p. 7); "Toughness" (p. 45); "Unique
Icon" (pp. 45–46); "Hit Points" (p. 22). Ruling August 3, 2026 – Ruling 4 (3). The Magneto insert, "Linked" (§0.5).

**As read.**

- **Setup.** A deck that holds New Recruits sets aside one each of the four allies (the pack holds one of each); two
  such decks set aside two of each. They are in no deck, count toward no deck size and belong to nobody.
- **New Recruits** is checked against wave 7 §3.1, §3.2 and this file's §3.66 and needs nothing new: cost 0, played on
  its owner's turn by a player whose identity has the X-MEN trait as it stands (Magneto, not Erik Lehnsherr), 2 threat
  per player who started, thwarted like any side scheme by anyone, unique, Victory 0 to the victory display. One player
  side scheme in play in a game of one or two players.
- **When Defeated:** each player still in the game, in player order, chooses one set-aside NEW ally and takes it into
  hand; that player is its owner from then on (RRG pp. 27, 31). A player with none left to choose gets none. It is not
  optional.
- **In hand it is an ordinary ally:** cost 2, an [energy] resource, discarded to its owner's discard pile and shuffled
  into that player's deck at the next reset. The unique rule applies in play: a second Surge from a second set cannot
  enter play beside the first.
- **"If you have the [MUTANT] or [X-MEN] trait"** reads the controller's identity as it stands, gained traits included
  (Children of the Atom gives X-MEN to an X-FORCE or X-FACTOR identity). While true the ally has its bonus and is left
  out of the ally limit; when it stops being true (a flip to a face with neither trait) the bonus goes and the limit is
  checked at once: Indra with 3 damage is defeated, and a player with four allies discards one.
- **Bling!** gets her tough status card on entering play only if the condition is true then (RRG p. 45); gaining the
  keyword later gives none.
- **Children of the Atom:** each character its controller controls that has one of the three traits has all three, the
  identity included. It is what lets an X-FORCE hero play New Recruits and White Queen, and one character pay toward
  both halves of an alliance cost (§4.2 Q40).

**Tests (exact numbers).**

1. Setup with Magneto's starter deck: the four NEW allies are set aside with no owner, `linkedCardsSetAside` is logged,
   his deck is 40. A deck that lists 49033 is illegal (`linked_card`). A deck without New Recruits sets none aside.
2. Solo. He plays New Recruits for 0: 2 threat. His basic thwart removes 2: the scheme is in the victory display and he
   takes Surge into his hand; `ownerOf` Surge is his player. He plays her for 2: ATK 3. With three other allies in play
   she stays: four allies.
3. Erik Lehnsherr with New Recruits in hand: not playable (`whyNot`: the X-MEN trait).
4. Two players, Magneto and a hero with neither trait: 4 threat; defeated, each takes one. The second player's Anole has
   THW 2 and counts against their limit.
5. Two decks hold New Recruits: eight set aside. Player 1 has Surge in play: player 2's Surge is not playable (unique).
6. Bling! played by Magneto: a tough status card. Played by test 4's second player: none.
7. A fixture removes the trait from the controller's identity while Indra has 3 damage and three other allies are in
   play: Indra is defeated.
8. New Recruits is in play and a second player side scheme is put into play in a two-player game: the first player
   discards one of the two, and a discarded New Recruits gives no ally.

**Composes with:** wave 7 §3.1, §3.2, §3.75; §3.66.

### 3.79 A boost card given to a minion outside its activation; a treachery that becomes one

> **Status: exists (verify).** `giveBoostCard { enemy, count?, card? }` gives an enemy a facedown boost card
> outside its activation, from the encounter deck (Hired Gun) or one named card (Master of Magnetism, wave 6 §3.16: it
> "resolves in the activation that follows … before and in addition to the automatic one"); a waiting boost card is
> discarded when its holder leaves play; `cannotAttack { target, attacker?, while? }` is a rule and a rule can be
> granted for a duration (`ruleGrant`); "after this activation, it activates again with no boost card" is §3.12. Not
> run: a facedown boost card on a **minion** that then gets its villainous card as well; `giveBoostCard` with the
> treachery that is being revealed as the card; a granted "cannot be attacked" that ends with the phase.

**Cards.** Sebastian Shaw 49038 ("Toughness. Villainous. Forced Response: After Sebastian Shaw is attacked, give him a
facedown boost card. He cannot be attacked again this phase."); Power and Decadence 49042 ("When Revealed: Give the
villain a tough status card. Give this card to that villain as a facedown boost card." / "[star] Boost: After this
activation, the activating enemy activates against you again. Do not give it a boost card for that activation."); Selene
49039 ("Allies cannot attack Selene.").

**Rules.** RRG 1.8 "Boost, Boost Icon" (p. 11); "Villainous" (p. 47); "Attack (Enemy Activation)" (p. 9, step 6: "after
[character] is attacked" is a forced trigger of the attack's end); "Attack (Player Ability Type)" (p. 10); "Target" (p.
43: "A target that cannot be attacked is not a valid target for an attack-labeled ability"); "Toughness" (p. 45);
"Leaves Play" (p. 27); "Activation" (p. 6: an activation begun during another "resolves after the current activation has
finished").

**As read.**

- **Shaw is attacked** by a basic attack or an attack-labeled ability of any player's card, whether or not it dealt
  damage (his tough status card takes the first one). He must be in play after the attack. The boost card comes off the
  encounter deck facedown and waits on him (RRG p. 11).
- **"Cannot be attacked again this phase":** from then to the end of the phase he is no legal target of an attack;
  damage that is not an attack still reaches him. An attack that hits several enemies skips him.
- **When he activates** he has the waiting card or cards and the villainous one: all are turned up in the order dealt
  and add up. If he leaves play first they go to the encounter discard pile.
- **Selene** cannot be the target of an ally's attack, basic or labeled; a hero's attack and damage from an ally's
  non-attack ability are unaffected.
- **Power and Decadence, revealed:** the villain (with several, the one the engine's rule for "the villain" gives, §3.7)
  gets a tough status card where it can have one, and the treachery itself goes facedown onto that villain instead of to
  the discard pile. It resolves with that villain's next activation, before the automatic boost card: no icons, and its
  Boost.
- **Its Boost,** from any activation it is turned up in: when that activation has finished, the same enemy activates
  against the same player again, an attack or a scheme by that player's form then, with no boost card dealt for it. A
  boost card already waiting on the enemy still resolves.

**Tests (exact numbers).** Sebastian Shaw SCH 1, ATK 2, 5 hit points, a tough status card on entering play.

1. A hero attacks him for 3: the tough card is discarded, he takes 0 and has one facedown boost card. An ally's basic
   attack on him and Metal Shards are refused (`whyNot`). A fixture "deal 2 damage to a minion": 5 to 3.
2. Next player phase he is attacked for 3 (3 to 0): defeated, no boost card is dealt and none is left behind.
3. Test 1, then the villain phase: he attacks with two boost cards of 1 and 2 icons: 5 damage.
4. A hero attacks him, another player's hero in the same phase: refused. In the villain phase a Riposte's 3 damage (not
   an attack) reaches him.
5. An ally's attack on Selene is not offered; the hero's is.
6. Power and Decadence revealed: the villain has a tough status card and one facedown boost card; the encounter discard
   pile does not hold the treachery. The villain's next attack (ATK 2) turns it up first (0 icons), then the automatic
   card (2 icons): 4 damage. After it the villain attacks that player again with no boost card: 2 damage. The treachery
   is then in the discard pile.
7. The player flipped to alter-ego form in between by a fixture: the second activation is a scheme.
8. Power and Decadence turned up as Selene's villainous boost card: Selene activates again with no boost card.

**Composes with:** §3.12; wave 6 §3.16.

### 3.80 Across packs: the unique rule; a hero, a villain and their cards under one title

> **Status: exists (verify).** §3.58's rule and its deck half, §3.68's seat checks, the unique rule for a revealed
> encounter card (`unique.ts`), and the _Mutant Genesis_ Magneto scenario, whose script names its villain by type
> (`query("villain", { name: "Magneto" })`) and whose attachments' host is data (`attachesTo: villain`). Not run:
> any of them with these packs' cards; a hero in play against the villain of the same title.

**Cards.** The identities 48001a/b and 49001a/b; Rogue 48012; Gambit 48021; Phoenix 49014; Cyclops 49015; White Queen
49021; Magneto's Helmet 49003 and Magneto's Armor 49004; Exodus 49028; Fabian Cortez 49030; Jester 48035.

**Rules.** RRG 1.8 "Unique Icon" (pp. 45–46: two unique cards match if they "share a title, and both have no subtitle
and no alter-ego title", or if "the subtitle or alter-ego title of one matches the title, subtitle, or alter-ego title
of the other"; "The players may choose a scenario even if one or more villains match one or more chosen identities"; a
matching non-villain encounter card "is discarded … the player revealing it is dealt a facedown encounter card");
"Subtitle" (p. 41); Appendix I (p. 50). Rulings January 26, 2026 – Ruling 4 (7); March 19, 2026 – Ruling 4.

**The matches** (every raw pack searched by script for these titles and subtitles; subtitles and title bars read on the
scans, §0.5):

| Card of this pass                                        | Matches                                                                                                  | By                        |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------- |
| Nightcrawler / Kurt Wagner 48001a/b                      | the ally Nightcrawler, subtitle Kurt Wagner (`mut_gen` 32011, Protection)                                | alter-ego title           |
| Rogue 48012, subtitle Anna Marie                         | the hero Rogue / Anna Marie (`rogue` 38001a/b); the ally Rogue (`gambit` 37002, Gambit's own)            | alter-ego title; subtitle |
| Gambit 48021, subtitle Remy LeBeau                       | the hero Gambit / Remy LeBeau (`gambit` 37001a/b); the ally Gambit (`rogue` 38003, Rogue's own)          | alter-ego title; subtitle |
| Magneto / Erik Lehnsherr 49001a/b                        | the campaign ally Magneto, subtitle Erik Lehnsherr (`mut_gen` 32172b)                                    | alter-ego title           |
| Phoenix 49014, subtitle Jean Grey                        | the hero Phoenix / Jean Grey (`phoenix` 34001a/b); the ally Phoenix (`cyclops` 33002, Cyclops's own)     | alter-ego title; subtitle |
| Cyclops 49015, subtitle Scott Summers                    | the hero Cyclops / Scott Summers (`cyclops` 33001a/b); the ally Cyclops (`phoenix` 34003, Phoenix's own) | alter-ego title; subtitle |
| Magneto's Helmet 49003, Magneto's Armor 49004 (upgrades) | the attachments of those titles (`mut_gen` 32147, 32148), unique, no subtitle                            | title, no subtitle        |
| Exodus 49028 (minion)                                    | the minion Exodus (`gambit` 37032, the Exodus modular set)                                               | title, no subtitle        |
| Fabian Cortez 49030 (minion)                             | the minion Fabian Cortez (`mut_gen` 32159, Acolytes)                                                     | title, no subtitle        |
| Jester 48035 (minion)                                    | the minion Jester (`synthezoid` 57027, a later wave)                                                     | title, no subtitle        |

**What does not match**, by the same two sentences: the hero Magneto and the **villain** Magneto (`mut_gen` 32138–32140:
one has an alter-ego title, so the first sentence fails, and "Erik Lehnsherr" is not "Magneto"); the ally White Queen,
subtitle Emma Frost, and the minion White Queen (`mut_gen` 32056, no subtitle). Asteroid M the support is unique and the
main scheme of that title is not. Hellfire Pawn, Wrapped in Metal and Master of Magnetism share titles with _Mutant
Genesis_ cards and none is unique. Daytripper, Northstar, M, Kid Omega, the four NEW allies, Sebastian Shaw, Selene,
Azazel and the other Crazy Gang minions match nothing in the pool.

**What it means.**

- **In a deck.** A Nightcrawler deck cannot include 32011. A Rogue deck and a Gambit deck (whose set holds 37002) cannot
  include 48012; a Gambit deck and a Rogue deck (whose set holds 38003) cannot include 48021. A Phoenix deck and a
  Cyclops deck cannot include 49014 or 49015. Nightcrawler's and Magneto's starter decks hold these allies and are
  legal.
- **In the game.** Beside a Rogue hero nobody can play 48012, and beside a Gambit hero nobody can play 48021, to a play
  area or to the mission; with Gambit's ally Rogue 37002 in play 48012 cannot enter play, and the reverse. The same for
  Phoenix and Cyclops. Each stays a resource. No card of these two packs is an identity-specific ally that matches
  another seat's hero, so Appendix I's Team-Up replacement does not arise, and no Team-Up card names Nightcrawler or
  Magneto.
- **The hero Magneto against the villain Magneto** is a legal game (RRG p. 46), and the two never match. What can go
  wrong is a name: the hero's kit says "Magneto gains steady", "Magneto gets +1 THW", "ready Magneto", and the scenario
  says "Attach to Magneto", "Magneto cannot be confused", "give it to Magneto as a facedown boost card". **Each side's
  "Magneto" is its own card:** the kit's is its controller's identity while it shows the hero face, and the scenario's
  is the villain (its script already names the villain by type). A test pins both directions.
- **His Helmet and Armor in that scenario** do match the villain's attachments. While the hero's Helmet is in play, the
  attachment Magneto's Helmet cannot enter play: revealed, it is discarded and the player is dealt a facedown encounter
  card; put into play by the scenario's setup or stage text, it is discarded and that is all. While the villain's is in
  play, the hero's cannot be played, and _Magnetic Pull_ still takes it into hand.
- **Exodus and Fabian Cortez.** With the Exodus modular set, or with the Acolytes set (the _Mutant Genesis_ Magneto
  scenario recommends it), in the game beside the Magneto hero: whichever copy is in play keeps the other out, and "your
  nemesis minion" (Face the Past) is 49028 only (`nemesisMinionOf`).
- **The campaign ally Magneto** (`mut_gen` 32172b, the other face of Enemy of My Enemy 32172a: "Flip this card and put
  Magneto into play under the first player's control") matches the hero: §4.2 Q45.
- **The mission** (§3.34): a unique ally there blocks its matches like one in a play area.

**Tests.**

1. Deck validation: Nightcrawler with 32011 illegal; Rogue with 48012 illegal; Gambit with 48012 illegal and with 48021
   illegal; Rogue with 48021 illegal; Cyclops with 49014 illegal and with 49015 illegal; Phoenix with 49015 illegal;
   both starter decks legal.
2. Player 1 is Rogue, player 2 Nightcrawler with 48012 in hand: no play is offered (`whyNot`: unique, matches Rogue /
   Anna Marie); it pays 1 [physical].
3. Gambit controls his ally Rogue 37002: another player's 48012 is not playable. She is defeated: it is.
4. The Magneto hero against the _Mutant Genesis_ villain Magneto: setup is legal. The hero's Cape readies the hero and
   not the villain; his Armor's +1 ATK is on the hero and the villain's ATK is unchanged. The attachment Magneto's Armor
   is on the villain: the villain cannot be stunned and the hero can. Master of Magnetism (the treachery) gives its
   boost card to the villain and the villain activates.
5. Same game: the hero's Helmet is in play and the attachment Magneto's Helmet is revealed: discarded, one facedown
   encounter card dealt to the revealing player, the villain can be confused. The attachment in play first: the hero's
   Helmet is not playable and is still a [mental] resource.
6. Magneto's nemesis set in the game with the Acolytes set: Fabian Cortez 32159 engaged with a player, 49030 revealed:
   discarded, a facedown encounter card dealt.
7. White Queen 49021 is played while the minion White Queen 32056 is in play: she enters play.
8. Q45 = A, the Magneto hero in the scenario of Enemy of My Enemy: the scheme is defeated, the Future Past card is
   shuffled in, no ally Magneto enters play.

### 3.81 Reusable as is (pass 2c, checked against the engine unions)

**Reprints** (raw `duplicate_of_code`; the wave's `reprints.ts` aliases them): Powerful Punch 48017 → 32014, The Power
of Protection 48019 → 01079, Moira MacTaggert 48022 → 38018, Energy, Genius and Strength 48023–48025 and 49024–49026 →
01088–01090, Deft Focus 49023 → 16024 (its erratum is a classification, already `basic` in the data). Hellfire Pawn
49040 is `mut_gen` 32058 with a reminder text added and is not marked a duplicate: one script, registered under both
ids.

**Deck discards, checked against §3.48–§3.50, §3.52, §3.55 and §3.70 before any row was opened.** Exodus, Frenzy, Fabian
Cortez and Martyr for Mutants discard from the top of a player's deck by a number: ordinary deck discards
(`moveCards(topOfDeck(n), "discard")`), a short deck discards what it has and resets without discarding more (RRG p.
33), Magik's faceup card goes first (§3.48), and none is a mission attempt's (§3.38). Only _Magnetic Pull_ needed a row
(§3.71). Erik Lehnsherr's and Asteroid M's "top" and "topmost" of a discard pile are the pile's own order, newest first
(`atMost(3, …)`, `topmostOnly`; RRG p. 16).

**Named abilities, checked against §3.39:** _Magnetic Pull_ and Bamf! raise moments (§3.71, §3.72). **Payments, checked
against §3.51 and §3.62:** no card of the two packs reads what a payment was made with; Kid Omega's and _Rapid
Teleportation_'s resources are costs. **Permanent cards, checked against §3.61:** none. **Ally upgrades, checked against
§3.59:** none (below).

| Card text                                                                                                                                                                                                                     | Existing vocabulary                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Spend 1 resource of any type → return a copy of Bamf! from your discard pile to your hand. (Limit once per phase.)"                                                                                                          | a resource cost of 1 on an identity action; `moveCards` from the discard pile by name; a phase limit                                                                                                                                         |
| "Search your deck for a copy of Bamf! and add it to your hand. (Limit once per round.)"                                                                                                                                       | `chooseCards` over the deck by name, `moveCards` to hand, a shuffle                                                                                                                                                                          |
| "Kurt Wagner gets +1 REC" / "After you make a basic recovery, exhaust … and choose a player → that player draws 1 card"                                                                                                       | `gets("rec", 1)` on the identity titled Kurt Wagner; `on.basicRecovery`, `choosePlayer`, `draw`                                                                                                                                              |
| "Nightcrawler gets +1 ATK, +1 DEF, and gains retaliate 1"                                                                                                                                                                     | `gets`, `gainsKeyword` on the identity titled Nightcrawler                                                                                                                                                                                   |
| "Deal 1 damage to Northstar → cancel all boost icons ([boost]) on that card"                                                                                                                                                  | `on.boostCardTurnedFaceup` during an attack, a `damageThisCard` cost, `cancelBoostIcons` (Attacrobatics, Preemptive Strike)                                                                                                                  |
| "Play under any player's control. Max 1 per player." / "After you defeat an enemy during the villain phase, exhaust this card → draw 2 cards"                                                                                 | data; `on.defeated({ byYou: true })` with a phase test                                                                                                                                                                                       |
| "Attach to a minion. Max 1 per minion." / "After a hero defends against attached minion's attack and takes no damage, deal 4 damage to attached minion"                                                                       | data; `after.defends(query("hero"), { takingNoDamage: true })` narrowed to the host's attack (Unflappable; On the Run)                                                                                                                       |
| "Discard cards from the encounter deck until you discard a minion. Put that minion into play engaged with you → heal 3 … tough" / "→ play an ally from your hand, reducing its cost by 3"                                     | `discardEncounterUntil`, `putIntoPlay` engaged (Looking for Trouble, reprinted as 46017); `heal`, `giveStatus`; `playFromHand` with `costReduction` (Team-Building Exercise)                                                                 |
| "When your hero defends against an attack, it gets +2 DEF for that attack. If you take no damage from that attack, deal 3 damage to the attacking enemy"                                                                      | `on.defends(YOUR_IDENTITY)`, a stat modifier to `endOfAttack`, a delayed check of the attack's results (Desperate Defense)                                                                                                                   |
| "After an [X-MEN] character defends against an enemy attack and takes no damage, remove 1 threat from this scheme" / "Stun and confuse each enemy in play"                                                                    | a response on the scheme, its controller's; `after.defends` by trait; `removeThreat(self)`; `forEach` enemy, two `giveStatus`                                                                                                                |
| "You may flip to alter-ego form. Choose: Exhaust Kurt Wagner → remove … / Discard each [ATTACK] and [DEFENSE] event from your hand. Discard this obligation."                                                                 | the obligation frame of every hero; `moveCards` from hand by type and traits                                                                                                                                                                 |
| "Quickstrike. Azazel cannot have upgrades attached." / "[star] Boost: Deal Azazel to the Kurt Wagner player as a facedown encounter card"                                                                                     | keyword; `cannotHaveAttachments` narrowed to upgrades (§3.67); `boost(dealAsEncounterCard(self, ownerOf(self)))` (`ironheart` 29031)                                                                                                         |
| "Attach to Azazel. Otherwise, attach to the villain." / "[star] Attached enemy's attacks gain piercing." / "Hero Response: After attached enemy attacks you, discard 1 random card from your hand → discard this card"        | host data (`ifAble`, as emitted); `attacksGainKeywords`; a hero response with `discardRandomFromHand: 1`                                                                                                                                     |
| "When Revealed (Alter-Ego): Find Azazel and reveal him. He schemes." / "When Revealed (Hero): Find Azazel and reveal him."                                                                                                    | `whenRevealedAlterEgo`, `whenRevealedHero`; §3.1; `enemyScheme`                                                                                                                                                                              |
| "Alliance. Exhaust an [X-FORCE] character and an [X-MEN] character → defeat a non-[ELITE] minion"                                                                                                                             | the alliance keyword; `exhaustCards` with two picks (Serve and Protect, §3.70; Q40); `defeat`                                                                                                                                                |
| "→ remove X threat from among schemes in play and deal X damage among enemies in play, where X is the combined THW of the two exhausted characters"                                                                           | `sum(statOf(…, "thw"), …)` over the cost's two slots; `divide("threat", …)`; `assignDamage` among enemies (Phoenix's and Valkyrie's events)                                                                                                  |
| "Search the encounter deck and discard pile for The Crazy Gang side scheme and reveal it. If it is already in play, deal yourself a facedown encounter card."                                                                 | `searchAndReveal` by name with an in-play branch, `dealEncounterCard`                                                                                                                                                                        |
| "You are confused. If you were already confused, discard a support you control." / "You are stunned. If you were already stunned, discard an upgrade you control."                                                            | `giveStatus` with the "already" branch (Arcade's Funhouse, §3.70), `chooseCards`                                                                                                                                                             |
| "Executioner attacks the friendly character with the fewest remaining hit points. If this attack defeats an ally, remove that ally from the game."                                                                            | `enemyAttack(self, { targetCharacter: superlative("lowest", …, remainingHp) })` (Speed Demon; Juggernaut); the attack's `defeated` result; `removeFromGame`                                                                                  |
| "Each minion activates against the player it is engaged with. If no minion activates this way, discard cards from the top of the encounter deck until a minion is discarded and reveal that minion." / the same for [ACOLYTE] | `forEach` engaged minion `enemyActivates`, a bound result (Battle for Limbo 45058), `discardEncounterUntil`, `revealCard`                                                                                                                    |
| "After you change to this form, shuffle the top 3 cards of your discard pile into your deck"                                                                                                                                  | `on.playerChangesForm("alterEgo")`, `moveCards(atMost(3, discard pile), "deck")`, one shuffle                                                                                                                                                |
| "Exhaust Asteroid M → shuffle the topmost [MAGNETIC] card in your discard pile into your deck and heal 1 damage from your identity"                                                                                           | `exhaustSelf`; a `zone` selector with `topmostOnly` and a trait filter; `heal`                                                                                                                                                               |
| "Magneto gains steady." / "Resource: Exhaust … → generate a [wild] resource for a [MAGNETIC] card" / "Magneto gains the [AERIAL] trait"                                                                                       | `gainsKeyword`, `gainsTrait` on the identity titled Magneto; a resource ability with `generatesFor` (Power Belt, §3.70)                                                                                                                      |
| "Magneto gains retaliate 1. Forced Interrupt: When you would take any amount of damage, place it here. Then, if there is at least 6 damage here, discard Magnetic Bubble."                                                    | §3.65's shape on an upgrade: `instead(placeDamage(eventAmount, self))`, `damagedAtLeast(self, 6)`                                                                                                                                            |
| "Deal 7 damage to an enemy. If this attack defeats that enemy, gain a tough status card."                                                                                                                                     | `attack`, the attack's `defeated` result, `giveStatus`                                                                                                                                                                                       |
| "After M enters play, defeat a minion with fewer remaining hit points than M"                                                                                                                                                 | `on.entersPlay(self)`, a target query on `remainingHp` below hers, `defeat`                                                                                                                                                                  |
| "choose: Spend a [energy] resource → deal 1 damage to each enemy. / Spend a [mental] resource → remove 1 threat from each scheme."                                                                                            | `chooseOne` with options gated on `canPayResources`; `spendResources`; `forEach`                                                                                                                                                             |
| "choose an [X-MEN] ally → ready that ally and heal 1 damage from it"                                                                                                                                                          | a chosen target as the cost, `ready`, `heal`                                                                                                                                                                                                 |
| "choose an enemy. Until the end of the phase, increase the amount of damage that enemy takes from each attack by 1"                                                                                                           | a lasting grant of `increaseDamageTaken { fromAttack: true }` (Bell Tower, wave 5 §3.8); §4.2 Q46                                                                                                                                            |
| "Play only if your identity has the [X-FORCE] or [X-MEN] trait. Max 1 per player." / "Alter-Ego Action: Discard this card → return an [X-FORCE] or [X-MEN] ally from your discard pile to your hand"                          | `playOnlyIf` (Marrow, §3.60); data; `discardSelf`, `moveCards` by traits                                                                                                                                                                     |
| "Discard an ally you control → heal damage from your hero equal to that ally's printed hit points and give your hero a tough status card"                                                                                     | a `discardCards` cost (the engine's comment names this card), `printedStatOf(…, "hp")`, `heal`, `giveStatus`                                                                                                                                 |
| "After you exhaust your hero to make a basic thwart or attack, discard an ally you control → add that ally's matching power to your hero's power for this use. Ready your hero."                                              | `on.basicPowerUsed(your identity)` for thwart and attack, a `discardCards` cost, `modifyBasicPower(statOf(…))`, `ready`                                                                                                                      |
| "After White Queen enters play, discard a status card from a character"                                                                                                                                                       | `chooseTarget` a character with a status card, `removeStatus` of one the player picks                                                                                                                                                        |
| "Search the encounter deck, discard pile, and set-aside area for your nemesis minion and reveal it → ready your hero and draw 3 cards. You cannot attack the villain this phase. Remove this card from the game."             | `anyOf` [encounter deck and discard pile, your set-aside area] with `nemesisMinionOf: you` (the selector's comment names this card); `revealCard`; `ready`, `draw`; a granted `cannotAttack` to the end of the phase; `removeFromGame(self)` |
| "After Exodus attacks you, discard cards from the top of your deck equal to his total ATK for that attack" / "After Frenzy attacks you, discard the top 2 cards of your deck"                                                 | a forced response on the attack with its total ATK (printed, modifiers and boost icons); `moveCards(topOfDeck(n), "discard")`                                                                                                                |
| "When Defeated: The defeating player discards the top 9 / 4 cards of their deck" / "[star] Boost: Discard the top 4 cards of your deck"                                                                                       | `defeatingPlayer`, a deck discard; a boost ability                                                                                                                                                                                           |
| "Each [X-FACTOR], [X-FORCE], and [X-MEN] character you control gains the [X-FACTOR], [X-FORCE], and [X-MEN] traits"                                                                                                           | three `gainsTrait` over one query (the Giant and Tiny grants of wave 2)                                                                                                                                                                      |
| "Allies cannot attack Selene." / "[star] Boost: Discard an ally you control."                                                                                                                                                 | `cannotAttack { target: self, attacker: ally }` (§3.79); `chooseCards`, `discard`                                                                                                                                                            |
| "Guard. Patrol. Surge." / "[star] Boost: Put Hellfire Pawn into play engaged with you"                                                                                                                                        | keywords; `boost(putIntoPlay(self, you))`, the script of `mut_gen` 32058                                                                                                                                                                     |
| "When Revealed: Place 2 additional threat here for each [HELLFIRE] card in play"                                                                                                                                              | `placeThreat(self, count of cards in play with the trait × 2)`                                                                                                                                                                               |

**As read, where the table is not enough.**

- **Change of Fortune.** "You" is the identity (RRG p. 49): its attack, its event, its upgrade's ability or its
  retaliate defeated the enemy, in the villain phase. An ally's defeat does not count. Tally Ho!, Riposte, Under Control
  and Kurt's Cutlasses are how the starter deck does it.
- **Under Control** is controlled by the player who played it and answers any hero's defense against that minion, by a
  basic defense, by Bamf! or by a defense-labeled event. A defense against a minion that Tally Ho! defeated first finds
  the minion gone and deals nothing.
- **Riposte** reads the attack's end: "you" took no damage from it. Damage Magnetic Bubble or Ice Wall took in his place
  was not taken by him.
- **Northstar** answers any boost card turned faceup during any enemy's attack on anyone; its Boost ability still
  resolves and only the icons are canceled, an amplify icon's included. His cost is damage dealt, so a tough status card
  on him pays it (RRG p. 14).
- **Powerful Punch** (the reprint) is the wave 6 script. Played into an attack on another player it makes the player's
  identity the defender if there is none (RRG p. 15), which does not make the attack one initiated against them (ruling
  July 9, 2026 – Ruling 1); as an attack it obeys guard.
- **"Come Get Me, Bub!" and Squared Off.** The minion enters play engaged without being revealed: no When Revealed, no
  surge, but quickstrike and toughness answer its engaging and entering (RRG pp. 36, 45). If the encounter deck runs out
  with no minion the cost is unpaid and the event does nothing more (RRG p. 17). Squared Off's ally is played:
  restrictions, the unique rule and the ally limit apply, a cost of 3 or less is 0, Magik's top card may be the ally
  (§3.49, Q27), and in a campaign game the destination is chosen (§3.34).
- **Astonishing X-Men.** The Response is its controller's, each time any player's X-MEN hero or ally defends an enemy
  attack and takes none of its damage; an ally that defends and survives took damage unless something stopped it. The
  scheme performs the removal (RRG p. 50): it is not a thwart. Enemies in the mission area are not "in play" for its
  When Defeated (§3.33).
- **Crisis of Faith.** The second option may be chosen with no such event in hand: discarding the obligation is still
  its effect.
- **Azazel's Boost** deals the boost card itself to the nemesis set's own player, whoever is being attacked; that player
  reveals him in step four. With that player eliminated he is discarded.
- **Brimstone Strike** in alter-ego form: Azazel is found and revealed (engaging the player, §3.1), and then schemes
  with his SCH 2 and no boost card. Found nowhere, nothing else happens. In hero form his quickstrike follows the
  reveal.
- **Combine Forces and Gunboat Diplomacy** share Serve and Protect's cost, and Q40 decides whether one character can be
  both halves; under Q40 = B Gunboat Diplomacy's "combined THW of the two" is that one character's THW once. Gunboat
  Diplomacy is one ability labeled attack and thwart: a stunned or confused identity loses all of it (§3.62 reads
  Multitalented the same way). The player divides X threat among schemes and X damage among enemies as they like.
- **Executioner.** Every friendly character counts, identities and allies of every player, not those at the mission; the
  first player breaks a tie (RRG p. 19). The controller of the attacked character is the attacked player and may defend
  (RRG p. 10). "An ally" is any ally the attack's damage defeats, the target or a defender; it is removed from the game
  instead of resting in a discard pile.
- **"Off with His Head!" and Angry Acolyte.** A minion whose activation a status card or Wrapped in Metal stopped did
  not activate (§4.1 Q4's reading). The minion found by the discard is revealed by the resolving player.
- **Survivor** shuffles the three newest cards of the discard pile, or the one or two it has; with none there is no
  shuffle (RRG p. 16).
- **Asteroid M** heals 1 with no MAGNETIC card to shuffle, and shuffles one with no damage to heal.
- **Magneto's Helmet.** Steady is on the hero face only; a second stunned or confused status card can be placed while he
  has the keyword, and if it leaves with two on him the state check removes one (RRG p. 41).
- **Magnetic Bubble.** "You" is the identity in either form; any source: an attack after defense, a treachery, Old
  Grievances, retaliate, indirect damage assigned to him. A tough status card goes first and nothing is placed. All of
  it is placed, past 6, and then the Bubble is discarded. He took no damage: "takes no damage" abilities see that, and a
  cost of taking damage is unpaid (RRG p. 14).
- **M.** Her remaining hit points when the Response resolves (4 at full health), compared with each minion's; it is a
  defeat, so a tough status card does not help the minion and its When Defeated resolves with her controller as the
  defeating player.
- **Kid Omega.** One option, paid as chosen; a player who can pay neither is not offered the Response. Each enemy and
  each scheme in play, the mission area's excepted (§3.33).
- **Phoenix** may choose any player's X-MEN ally, herself included when there is something to ready or heal.
- **Cyclops.** The bonus is on the enemy for the rest of the phase, for every player's attacks. How it counts an attack
  with several instances of damage is §4.2 Q46.
- **Noble Sacrifice** heals by the printed number (Indra heals 2). **"You Got This!"** adds the ally's THW or ATK as it
  stood in play when it was discarded (Surge with her bonus adds 3 to an attack), a dash or an X with no card as 0; the
  hero is readied when the Response resolves and the basic power then finishes with the bonus. A basic thwart against an
  assault scheme uses ATK and adds the ally's ATK (wave 7 §3.3).
- **White Queen** discards one status card of the player's choice from any character, an enemy's tough card or a
  friend's stunned card.
- **Face the Past.** Not a find: the three areas named. With the nemesis minion in none of them (in play, in the victory
  display, a facedown card) the cost cannot be paid and the event is not offered. The minion is revealed to the player:
  Exodus arrives with a tough status card; Azazel and Frenzy attack by quickstrike. "You cannot attack the villain"
  covers the player's identity and allies to the end of the phase. In The Wrecking Crew the deck searched is the active
  villain's (ruling January 17, 2026 – Ruling 5). "Max 1 per deck" is deckbuilding.
- **Exodus.** His star is the Forced Response. The number is the attack's ATK with its boost icons; a defended attack
  discards as many. Steady, toughness and villainous are keyword data; he is ELITE, so neither Wrapped in Metal nor
  Combine Forces reaches him.
- **The Inner Circle** counts cards in play with the HELLFIRE trait, of any set: 4 + 2 each. Shadowcat's nemesis
  Hellfire Pawn (`mut_gen` 32058) prints it; her White Queen (ELITE, PSIONIC) does not. The scheme prints no trait.
- **Hellfire Pawn's Boost** puts it into play without revealing it: no surge.

## 4. Open questions (for the user or FFG)

### 4.1 Decided by the user

Questions 1 to 40 were answered by the owner on 2026-10-07 in three sets (the project thread; his notes in full are
in `docs/phase7-wave8-handoff.md`). **Seven answers are not the proposed default: Q9, Q14, Q19, Q22, Q26, Q31 and Q33,
all B.** Pass 3 rewrote every §1, §2, §3, §5 and §7 passage and test case that assumed A for those seven. Questions 41
to 46 are open, and every task that touches them builds on default A (§8.2).

| Q   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **A.** A setup control, off unless the players turn it on. The rulebook's amounts are recommendations and are never applied silently.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2   | **A.** Pursued by the Past's Forced Response resolves when the counter is placed and removes every counter before the treachery reaches "Then, if it has any counters".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 3   | **A.** The players in the game now; nothing snapshots the starting count.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 4   | **A.** A stun or confuse replaces the activation, so the villain did not activate and the active counter stays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5   | **A, firm.** Any Horseman's activation moves the counter, and always one place from the villain holding it, never from the villain that activated. The owner cites an FFG ruling on Hall of Heroes' post-RRG-1.5 rulings page (not in this repo). Test: Death holds the counter, a treachery makes War activate, the counter moves to the villain right of Death.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 6   | **A.** "Considered to have at least 1 hit point" is a game-state modifier every reader sees, including the other Horsemen's "cannot be defeated while another villain has at least 1 hit point".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 7   | **A.** The normal valid-target and initiation rule: Golden Horse and Metal Wings are not offered when the simulated Forced Response can do nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 8   | **A.** The extra boost card is set up for the activation; the tough status card and the heal resolve after it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 9   | **B.** A per-villain A/B picker for the Four Horsemen. The four selectors default from the difficulty (A/A/A/A for skirmish and standard, B/B/B/B for expert and heroic) and each can be overridden (MC45 p. 11). No "extreme" mode. §1.6, §2.3 and §5's client ask are read with this answer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 10  | **A.** Standard III may replace the Standard set on any scenario that uses it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 11  | **A.** Scenario 3 reveals Apocalypse's next stage; it is not a change of form. The new stage enters at its full printed hit points, and attachments and status cards stay. Scenario 5's form changes are the contrast: neither a defeat nor a reveal, and hit points are not reset.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 12  | **A.** "For an easier game, begin with Apocalypse (I)" is an optional setup change, off by default on standard. It is not what skirmish mode means.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 13  | **A, with a note.** A player card may legally discard No Longer Worthy, which can make the scenario unwinnable. No rule requires a confirmation: the confirm prompt is our UX protection, not an FFG rule, and the client must word it that way.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 14  | **B.** The player who defeated the attached minion resolves the Setting environment's Special; the text does not hand it to the engaged player. Nobody resolves it if no player defeated the minion. The owner's reasoning calls it a When Defeated ability; the card (45145) prints "Forced Interrupt: When attached minion is defeated", and the answer is the same either way. §3.24 and §2.8 are read with this answer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 15  | **A.** No rule limits a game to one environment or one Setting. Several can be in play, and where a card says "the Setting environment" and more than one qualifies, the resolving player chooses. No setup restriction.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 16  | **A.** The three-sided Apocalypse keeps his current form when stage II replaces stage I: defeated as Cyberpath, stage II is revealed as Cyberpath; as Giant, Giant. Biomorph is named for setup only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 17  | **A.** Police State finds Escaped Mutant where it is. If it is already attached to a player it stays there; nothing detaches or moves it (Magistrate, by contrast, says to attach it to the defeating player's identity).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 18  | **A.** Cards in the mission area are in play; counting or watching them does not affect them, so "side schemes in play" and "after a side scheme is defeated" see them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 19  | **B.** MC45 p. 5: cards in the mission area "cannot be affected by card abilities unless the ability refers to the mission area". Upgrades may be attached there, but that does not waive the restriction: an ordinary upgrade's constant ability does not modify the ally. Only a card whose ability works with the mission (Desperate Measures) has an effect there. §3.33, §3.34 and §3.42 are read with this answer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 20  | **A.** A finished mission is cleaned up with the rest of the mission area; the Finished face does not stay in play as a side scheme.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 21  | **A.** There are five physical Overseer / Prelate cards. The one serving as the mission's Overseer is not available as a Prelate in scenario 3: four Prelates are set aside.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 22  | **B.** Mission and Overseer are chosen at random during scenario setup, and the log changes only through the Victory instructions. A lost scenario that is retried runs setup again: redraw the mission and the Overseer from what is still available. The campaign runner restores the campaign's RNG on a retry today, so this needs a fresh draw per attempt (§2.11, §3.45).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 23  | **A.** Cards 164 to 183 are campaign cards (MC45 p. 4), including Agent of Apocalypse and Worldwide Crisis (45164, 45165): campaign only, never a standalone modular set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 24  | **A.** "An upgrade / support from any aspect" is an aspect card; basic is not an aspect.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 25  | **A.** As Age of Apocalypse prints it: the reward does not count against the minimum deck size only. A deck of 39 ordinary cards plus the reward is legal; a deck already at 50 must drop a card to take it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 26  | **B.** With Magik's text box blank her top card is facedown, and the game does not read a hidden card to answer an icon question: a facedown top card satisfies no condition. §3.48, §3.50 and §7.1 are read with this answer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 27  | **A.** Magik may play her top card through another "play a card from your hand" effect (the RRG p. 64 FAQ names Team-Building Exercise), and both cost reductions apply.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 28  | **A.** Overpaid resources were not paid (RRG "Cost"). Bishop's "paid with a resource card" is true only when a resource card's resource went toward a cost of at least 1; never at cost 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 29  | **A.** "Ready your sidekick" is a cost, and a cost that changes nothing cannot be paid: Side-by-Side is not playable while the sidekick is already ready.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 30  | **A.** Suit Up (errata, RRG p. 69): eligibility comes from the upgrade's own attach text; no ally host needs to be in play, and the board state is not evaluated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 31  | **B, "RAW pending FFG clarification".** Witchfire 45057 is built as printed: an attack of hers that does not defeat an ally sends the effect to the "Otherwise" clause, threat on the main scheme. No erratum or ruling says otherwise; if FFG rules it was meant to read like S'ym and Trevor Fitzroy, change it then. The script and its test carry this note (§7.1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 32  | **A.** Colossus 45031's Interrupt plays him and makes him the defender, which the mission area cannot satisfy: that play goes to the player's own area only. Ordinary ally plays keep the mission choice.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 33  | **B.** The player declares a wild resource's type; the engine does not pick "the best" for them. One shortcut is allowed: the prompt may be skipped when every declaration is provably equivalent. §3.62 and §7.3 are read with this answer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 34  | **A.** Overpaid resources are not "used to pay": a cost of 3 reads at most three types.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 35  | **A.** Frostbite attached during an activation is still set aside after that activation; no grace activation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 36  | **A.** Shopping Spree bars removal by heroes and allies; an alter-ego's Disguise removes threat from it (the owner cites FFG's Jubilee preview article, not in this repo).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 37  | **A.** Grounded's extra cost applies to a change to hero form "during your turn"; a forced change outside her turn does not pay it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 38  | **A.** Snow Clone and Chamber keep their consequential-damage reduction when the attack defeats the enemy (FFG's intent, ruling February 8, 2026 – Ruling 1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 39  | **A.** With a Jubilee hero in the game the ally Jubilee from Mutants at the Mall never enters play (the unique rule; RRG 1.8 errata for Mutants at the Mall #88A, p. 68).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 40  | **A.** Serve and Protect needs two characters, one X-Force and one X-Men; one character with both traits cannot be exhausted twice.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 41  | **A.** (Owner, 2026-10-07, citing an FFG ruling on Hall of Heroes' post-RRG-1.6 page, not in this repo.) The deck empties before a Magnetic card is found: Magnetic Pull is **used but not resolved**. The discards stand and the limit is spent; Old Grievances ("after you use") triggers and counts them; Magneto's Armor and Cape ("after you resolve") do not. The engine must keep "ability used" and "ability resolved" as separate facts (§3.71).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 42  | **A.** The Magnetic card Magnetic Pull takes was discarded and then added to hand: it counts for Magneto's Armor and for Old Grievances. "Discarded" does not mean "still in the discard pile".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 43  | **A.** (Owner, citing the same FFG rulings page.) The Rogue ally 48012 checks the chosen character continuously: if it leaves play she has no traits or stat bonus from it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 44  | **B (not the proposed default).** (Owner, citing an FFG correction dated October 7, 2024 on the same page: the printed star is a typo and the card "should have 1 boost icon, not 1 star icon".) Tweedledope 48037 has **1 boost icon and no star**: MarvelCDB and the emitted data are right, and no data change is owed. §0.5, §7.4 and §8.1 are read with this answer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 45  | **A.** The unique rule: the Mutant Genesis campaign's ally Magneto (Erik Lehnsherr) does not enter play while Magneto is a player's identity; the campaign instruction is no exception. The sibling of Q39.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 46  | **A.** (Owner, citing the same FFG rulings page, whose example is Grand Finale: 2 + 2 + 2 + 2 becomes 3 + 3 + 3 + 3 = 12.) The Cyclops ally 49015 adds 1 to every instance of attack damage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 47  | **A.** (Owner, 2026-10-07; raised by QA after pass 3, so it has no entry in §4.2. The question: FFG's Cyclops ruling, Q46, makes every instance of Grand Finale's damage "damage from an attack"; do other attack-labeled abilities that deal further damage after their attack work the same way?) **A general attack-resolution rule, not a Grand Finale exception:** an event or ability with the (attack) label is one attack; damage it deals to enemies while resolving is damage from that attack, even in separate instructions or against different enemies. All four cards follow it: Grand Finale 47009 (every instance), Flurry of Blades 41004 (the damage per Psi-Katana), 'Port and Punch 48007 (the damage to enemies with Bamf! attached), Dive Bomb 17028 (the damage to each other enemy). Cyclops 49015's +1 applies to each qualifying instance against the chosen enemy. **Kept distinct:** retaliate triggers once per surviving enemy attacked, not per instance; "after this attack" effects resolve after the whole ability, further damage included; several instances on one enemy each take applicable modifiers; damage an attack ability deals to the attacking identity (Defy Danger 16159) is not attack damage dealt to an enemy. |

**Two follow-ups, answered 2026-10-07 ("do recommended"):**

- **Q25 at the minimum:** the reward counts as one of the 40. A deck of 39 ordinary cards plus the reward is legal
  (the owner's note on Q25), and a deck at 50 must drop a card to take it. `CampaignGrant.deckSize` (§8.2 task 43) is
  built with this value.
- **Q33 with Q34, an overpaid payment:** the player declares each wild's type; the game then takes the paid resources
  to be the set that gives the most declared types, with no further prompt.

Questions 41 to 46 were first recorded as A on the owner's "do recommended", then answered one by one a minute
later with rulings checked; the rows above hold the second, fuller answer. Only Q44 differs from the default.

### 4.2 The questions as asked

Each is implemented the way stated, or not at all, and named here rather than decided silently. **A is the proposed
default in every question; none is implemented yet.**

1. **The Infinites "Modular Difficulty" threat: how is it offered?** (§3.5; MC45 p. 8: "If players wish to modify the
   difficulty … they may place threat on Gene Pool during setup", with 0 / 1 / 2 / 3 per player recommended for
   skirmish / standard / expert / heroic.)
   - **A (default):** a setup control on any game that includes the Infinites set, off (0) unless the players turn it
     on, as Tower Defense's setup damage is; turned on, it starts at the mode's recommendation and takes 0 to 3 per
     player.
   - B: on by default at the mode's recommendation (standard 1 per player, expert 2), adjustable.
   - C: no control; always the printed 4 only.
2. **Pursued by the Past's reset and a treachery's "Then, if it has any counters on it".** (§3.6; 45076, 45077,
   45079.)
   - **A (default):** the environment's Forced Response resolves as soon as the counter is placed, before the "Then"
     sentence. When that counter caused the reset there are no counters, so the villain does not scheme or attack,
     nothing is discarded and no surge is gained: the nemesis activation or arrival is the penalty instead.
   - B: the treachery resolves in full first (the "Then" sentence is true), then the reset.
3. **"The number of players" on Pursued by the Past.** (§3.6; no per player icon is printed. RRG "Per Player Icon",
   p. 32, ties "players who started the scenario" to the icon.)
   - **A (default):** the players in the game now; an eliminated player lowers the threshold by 1.
   - B: the players who started the scenario.
4. **A Horseman whose activation is replaced by a stunned or confused card: does the active counter move?** (§3.8;
   45085b "After a villain activates". RRG "Stun, Stunned", p. 41: "not considered to have attacked"; "Activation",
   p. 6.)
   - **A (default):** no. The counter stays, so in a game of several players the same villain activates against the
     next player.
   - B: the counter moves whenever a villain would have activated.
5. **Whose activation moves the counter, and from where?** The card (45085b): "After **a** villain activates, move the
   active counter to the next villain." MC45 p. 11: 1B "causes the active counter to pass to the 'next villain' after
   **the** villain activates", and "the villain" there is the active one. They differ when a treachery makes a
   non-active Horseman activate (45092–45095).
   - **A (default):** the card (RRG "The Golden Rules", p. 4): any villain's activation moves the counter one place
     from the villain holding it.
   - B: the rulebook's wording: only an activation by the villain holding the counter moves it.
6. **"Is considered to have at least 1 hit point" on a villain at 0.** (§3.10; Golden Horse 45090, Metal Wings 45091.)
   - **A (default):** every reading of its hit points sees at least 1: its own "if he has at least 1 hit point", the
     other villains' "while another villain has at least 1 hit point" and its own defeat check. The players cannot win
     while such a card is attached to a villain at 0; they remove it with its Hero Response.
   - B: only the villain's own Forced Response condition reads it; defeat and the win are unaffected.
7. **Golden Horse's and Metal Wings' cost when the Forced Response can do nothing.** "resolve its 'Forced Response' as
   if it just attacked you → discard this card" (§3.11). War with no upgrade or support under your control; Famine
   with an empty deck and discard pile. RRG "Cost" (p. 13) has no rule for a cost that is another ability.
   - **A (default):** a cost must be paid: the response cannot be used unless the Forced Response changes something
     (War needs an upgrade or support you control; Famine at least 1 card in your deck; Death and Pestilence always
     can). Famine with 1 to 9 cards discards them all and counts as paid.
   - B: the response can always be used; the Forced Response resolves as far as it can.
8. **Infinite Prelate (45067): when do the tough card and the heal happen?** The text orders "Unus activates against
   you", then the three tiers, and the third must act inside the activation ("for this activation").
   - **A (default):** the extra boost card is given as the activation begins; the tough card and the heal resolve
     after the activation, in printed order.
   - B: all three tiers resolve before the activation.
9. **Four Horsemen difficulty choices.** MC45 p. 11: side A for skirmish and standard, side B for expert and heroic,
   and "Players may also customize their experience by using a mix of side A or B". The setup screen today offers
   "extreme" (stage A then B) for every scenario with several villains (`difficultyOptionsFor`), which this scenario
   does not print.
   - **A (default):** standard is four A sides, expert four B sides; no "extreme" entry and no per-villain mix in this
     wave.
   - B: add a per-villain A/B picker.
10. **Where is Standard III offered?** (§3.6; MC45 p. 3: "When a scenario requires the Standard set, you may replace
    it with the Standard III set.")
    - **A (default):** a setup toggle on every scenario that uses the Standard set, from any pack, once Age of
      Apocalypse is in the player's pool; the Expert set is unchanged.
    - B: only on the five Age of Apocalypse scenarios (how Standard II is offered for The Hood today).

Pass 1b's questions:

11. **Apocalypse's next stage, revealed when the main scheme is completed: what are his hit points?** (§3.18; 45101a
    "Flip this card and reveal Apocalypse (II)". RRG "Villain Defeat", p. 47, sets the dial "as indicated by that
    stage" for a stage revealed by a defeat and is silent on a stage revealed any other way.)
    - **A (default):** the new stage's full printed hit points, with no damage, as for any revealed stage; attachments,
      status cards and counters stay, and toughness gives a tough status card.
    - B: the damage stays: the new stage's hit points less the damage he had.
12. **"For an easier game, begin with Apocalypse (I)."** (§1.12; MC45 p. 14. The card's Contents do not list stage I.)
    - **A (default):** a setup option on standard mode, off unless chosen: stages I to IV.
    - B: not offered.
    - C: it is what skirmish mode uses for this scenario.
13. **No Longer Worthy discarded by a player.** (§3.21.) Out of play it is removed from the game (RRG "Double-Sided
    Card", p. 17), the main scheme's interrupt is no longer ignored, and the players can no longer win.
    - **A (default):** as printed; the client asks the player to confirm before a card of theirs discards it.
    - B: player cards cannot choose it.
14. **Imperial Guardsman (45145): who resolves the Special?** "Forced Interrupt: When attached minion is defeated,
    resolve the 'Special' ability on the [SETTING] environment." No player is named (§3.24).
    - **A (default):** the player the minion is engaged with.
    - B: the player who defeated the minion (nobody, if no player did).
15. **Two Setting environments in play.** Outside Dark Beast each Setting set puts its environment into play by the
    setup keyword, with no reveal, so "Discard each other [SETTING] environment" never resolves (§2.10).
    - **A (default):** both stay; a player told to resolve "the [SETTING] environment's" Special chooses one each
      time.
    - B: the setup screen allows only one Setting set in a scenario other than Dark Beast.
16. **The three-sided Apocalypse: which form is stage II in when stage I is defeated?** (§3.26. 45147a names a form
    only for the start of the game; MC45 p. 19 is silent.)
    - **A (default):** the form he was in when defeated (the engine's rule for every two-sided villain). No "changes
      to this form" response resolves.
    - B: Biomorph, as at the start of the game; no response either.
17. **Police State (45138) finds Escaped Mutant already attached to another player.** "The player who defeated this
    scheme finds the Escaped Mutant attachment and reveals it." Escaped Mutant prints "Attach to your identity" and no
    When Revealed. RRG "Find" (p. 19) covers a minion found in play; ruling June 25, 2026 – Ruling 5 says its When
    Revealed abilities and keywords trigger, and neither says whether an attachment moves.
    - **A (default):** it stays where it is (§3.1's rule for an attachment found in play); nothing else happens.
    - B: it moves to the finding player's identity, as Magistrate's "attaches it to their identity" does.

Pass 1c's questions:

18. **A card in the mission area and an ability that only reads the table.** (§3.33. MC45 p. 5: "in play but under no
    player's control. They cannot be affected by card abilities unless the ability refers to the mission area.")
    Choosing or changing such a card is ruled out either way. This asks about counting and watching: "the number of
    side schemes in play", "if a minion is in play", "after a side scheme is defeated".
    - **A (default):** they see it. It is in play, and counting a card does not affect it.
    - B: they do not. The mission is its own board: nothing outside it reads it, and nothing answers what happens
      there.
19. **An upgrade attached to an ally at the mission.** (§3.34. MC45 p. 5: "Players may attach upgrades to allies in
    the mission area." Desperate Measures does not mention the mission, so "cannot be affected … unless the ability
    refers to the mission area" cannot be meant to switch it off.)
    - **A (default):** the upgrade's constant changes to its host apply (stats, hit points, a considered icon, a
      keyword). Nobody controls it, so its Actions, Responses and resource abilities cannot be used.
    - B: only an upgrade from the campaign sets works there (Desperate Measures); any other is inert.
20. **The [FINISHED] face after its Forced Response.** (§3.40. "Remove each card in the mission area from the game
    and do the following". The face is itself in the mission area.)
    - **A (default):** it resolves its bullet, then is removed from the game with the rest. No side scheme is left
      in play.
    - B: it stays in play for the rest of the game, a side scheme with a dash for threat that nothing can touch.
21. **One printed card as an Overseer and as a Prelate in the same game.** (§3.46. A campaign game of scenario 3;
    ruling April 30, 2026 – Ruling 4 (2) covers the log, not this.)
    - **A (default):** as the cardboard has it: the Prelate face of the Overseer in the mission area is out of that
      game, so four Prelates are set aside and all four are used.
    - B: the faces are independent: all five Prelates are set aside whichever Overseer is drawn.
22. **A retried scenario: the same mission and Overseer, or a new draw?** (§2.11. MC45 p. 4: "they may reset the
    scenario and try again with no penalty". The runner restores the campaign's RNG on a retry, so a between-games
    draw repeats; NeXt Evolution's rule that a retry keeps the same choice is that box's own, MC40 p. 7.)
    - **A (default):** the same two cards. A loss cannot be used to reroll the mission.
    - B: a new draw each attempt, as resetting the table would give.
23. **The four Age of Apocalypse cards outside the campaign.** (§1.23. The cards print "AGE OF APOCALYPSE (n/4)", not
    "Campaign"; the boxes call them a modular set; MC45 p. 4 lists 164–183 as campaign cards; RRG p. 61's FAQ counts
    a set as modular unless it prints its scenario's name or "Campaign".)
    - **A (default):** campaign only. Without a mission both cards are a plain activation and a 1 damage surge.
    - B: also offered as a modular set in standalone games.
24. **"An upgrade from any aspect" / "a support from any aspect".** (§2.14; the log, p. 24.)
    - **A (default):** an aspect card of any aspect, whatever the deck's aspect, that the identity may legally
      include (the foundation's rule for MC27's "aspect card in their collection", decided 2026-09-25); not a basic
      card and not an identity-specific one.
    - B: basic upgrades and supports as well.
25. **"That card does not count against your minimum deck size."** (§2.14. Earlier boxes print "minimum or maximum";
    a grant today is exempt from both.)
    - **A (default):** as printed: exempt from the minimum only. A 50-card deck must drop a card to take the
      reward; a 40-card deck becomes 41 and is legal.
    - B: exempt from both, as every earlier box's grants are.

Pass 2a's questions:

26. **Magik's top card is facedown and a card reads it.** (§3.48, §3.50. Her text box is blank, as under Pestilence,
    so the card is not shown; Soulsword, Magik's Crown, Mystical Armor, Exorcism, Soul Strike and Magic Barrier still
    say "the top card of your deck has". Ruling March 19, 2026 – Ruling 5 lets an ability be used against a hidden
    top card "with incomplete information".)
    - **A (default):** the condition reads the real card. A stat bonus that applies is shown with its reason, which
      tells the players that icon; nothing else about the card is shown.
    - B: a card nobody may look at satisfies no condition: no bonus and no extra effect until it is faceup again.
27. **The top card played through another "play a card from your hand" effect that reduces its cost.** (§3.49; RRG
    FAQ p. 64, second entry; Team-Building Exercise, "reducing its resource cost by 1".)
    - **A (default):** both reductions apply: Magik's is part of playing the top card by her ability, however the
      chance to play arose. Colossus (cost 3) costs 1.
    - B: only the effect's own reduction; Magik's applies to plays she starts herself.
28. **"If you paid for this event with a resource card" when more was generated than the cost.** (§3.51; Concussive
    Blast, Command Authority. RRG "Cost", p. 13: resources beyond the cost "were not paid for that cost", and the RRG
    does not say which of several cards' resources are the ones beyond it.)
    - **A (default):** true when the cost paid was at least 1 and a resource card was among the cards discarded to
      pay it; the player is taken to have spent that card's resources first. False at a cost of 0 (FAQ "Unstoppable
      Force (#6)", p. 60).
    - B: true whenever a resource card was discarded during the payment, at a cost of 0 too.
    - C: resources count in the order the cards were discarded; a resource card discarded after the cost was already
      covered does not count.
29. **Side-by-Side: "Ready your sidekick →" when the sidekick is already ready.** (§3.54. RRG "Ready", p. 36, speaks
    of readying "an exhausted card"; "Cost", p. 13, has a cost paid in full.)
    - **A (default):** the cost cannot be paid: the event needs an exhausted sidekick, as "exhaust →" needs a ready
      card.
    - B: it can: readying a ready card does nothing and the cost counts as paid, so the event is a hero ready plus
      its option.
30. **Suit Up's erratum: "an upgrade that can be attached to an ally".** (§3.59; RRG p. 69.)
    - **A (default):** by the upgrade's printed text: its "attach to" allows an ally (an ally, a kind of ally, a
      character, a friendly character). No ally has to be in play, and it need not fit the ally found with it.
    - B: only an upgrade with a legal ally host in play at that moment.
    - C: only an upgrade whose "attach to" names allies and nothing wider.
31. **Witchfire's "Otherwise".** (45057, scan read: "Forced Response: After Witchfire attacks and defeats an ally,
    place 1 threat on Ruler of Limbo. Otherwise, place 1 threat on the main scheme.")
    - **A (default):** the intended reading, as S'ym and Trevor Fitzroy print it: after she attacks and defeats an
      ally, 1 threat goes on Ruler of Limbo if it is in play, otherwise on the main scheme. An attack that defeats no
      ally places nothing.
    - B: as worded: 1 threat on the main scheme after every attack of hers that does not defeat an ally, and nothing
      when she defeats one while Ruler of Limbo is out of play.
32. **Colossus's Interrupt in a campaign game.** (§3.56, §3.34. MC45 p. 5: "When a player plays an ally, they must
    choose" the mission or their own area; his Interrupt plays him "and declare[s] him the defender".)
    - **A (default):** this play goes to the player's own area only: at the mission he has no controller and cannot
      defend, so the mission is not offered for it. Played on her turn he may go to either.
    - B: both destinations are offered; at the mission the attack goes on undefended and his cost is spent.

Pass 2b's questions:

33. **Who declares a wild resource's type for Jubilee's cards?** (§3.62. RRG "Wild Resource", p. 48: the player "may
    specify which resource type … it is being used as"; ruling January 17, 2026 – Ruling 4 (1): "you specify".)
    - **A (default):** the engine takes the declaration that gives the most (the most different types; every line of
      Multitalented or Husk that can be covered) and asks only when two declarations give different effects, as a wild
      that can be [mental] or [energy] for Multitalented. The payment prompt shows the count before it is confirmed.
    - B: the player declares every wild on every payment of a card that reads types.
    - C: always automatic, the lines taken in printed order when a wild cannot cover them all.
34. **Do overpaid resources count as "used to pay"?** (§3.62. RRG "Cost", p. 13: resources beyond the cost "were not
    paid for that cost". The Jubilee insert's strategy box says "Spend as many different resources as you can to play
    Three Steps Ahead … for each resource icon used".)
    - **A (default):** no. Only the resources the cost took count, so a cost of 3 reads at most 3 types; the player is
      taken to have paid with the resources that give the most types. The insert's box is advice, not a rule.
    - B: every resource generated during the payment counts, so four types can be read at a cost of 3.
35. **A copy of Frostbite attached during an enemy's activation: is it set aside when that activation ends?** (§3.61,
    §3.65. "Forced Response: After attached enemy activates or leaves play, set this card aside." _"Freeze!"_ on a basic
    defense and Ice Wall both attach one in the middle of an attack; Ice Wall says "the enemy that just attacked".)
    - **A (default):** yes, as worded: it is attached when the enemy finishes activating. _"Freeze!"_ on a defense is
      worth −1 ATK for that attack; Ice Wall's copy leaves at the end of the attack that broke the wall.
    - B: an activation counts only for copies that were attached when it began; a copy attached during it stays until
      the enemy's next one.
36. **Shopping Spree: what counts as removed "by heroes or allies"?** (§3.66. "Threat cannot be removed from this scheme
    by heroes or allies." Wave 7 §4.1 Q29 answered the sibling wording, "Characters other than Cable cannot remove
    threat", with A: only characters are barred.)
    - **A (default):** the same reading. A removal performed by a hero-form identity (its basic thwart, its events, its
      upgrades' abilities) or by an ally is barred. An alter-ego's removal is not (Disguise used in alter-ego form), nor
      one no character performs (the scheme's own Action, a support's unlabeled ability, an encounter card).
    - B: nothing but the scheme's own Alter-Ego Action removes threat from it.
37. **Grounded: which changes to hero form does the cost cover?** (§3.63. "As an additional cost to change to hero form
    during your turn, you must spend 2 resources of the same type." RRG "Cost", p. 14, has an additional cost paid with
    the cost it is added to; a forced change has no cost to add to.)
    - **A (default):** a change she chooses to make during her own turn: the turn's option, or an ability of a card she
      controls. Unpaid, the change does not happen. A change an encounter card forces during her turn happens without
      it, and so does any change outside her turn.
    - B: only the turn's own change-form option.
    - C: every change to hero form during her turn, forced ones included: unpaid, she stays in alter-ego form.
38. **Snow Clone and Chamber when the attack defeats the enemy.** (§3.67. "takes −1 consequential damage after it
    attacks an enemy with Frostbite attached" / "a confused enemy". Ruling February 8, 2026 – Ruling 1, on Coordinated
    Attack: as written the reduction is lost, and FFG intends that it still applies; "no formal errata is planned".)
    - **A (default):** the intent, applied to these two cards: the enemy is read as it was when the attack was made, so
      the reduction applies whether or not the attack defeats it.
    - B: as written: read when consequential damage is dealt. A defeated enemy has no Frostbite and no status card, and
      the ally takes the full amount.
39. **Mutants at the Mall's ally Jubilee in a game with a Jubilee hero.** (§3.68. `mut_gen` 32088a, erratum RRG p. 68:
    "put Jubilee into play, discarding any other **ally** version of Jubilee from play". RRG "Unique Icon", p. 46: a
    non-villain encounter card that matches a card in play "is discarded and any effects of it entering play are
    ignored".)
    - **A (default):** the unique rule: the hero stays, the ally does not enter play, and the campaign log never records
      her, so scenarios 2 to 4 are played without her.
    - B: the scheme's instruction is a scenario rule that wins (RRG "The Golden Rules", p. 4): the ally enters play
      beside the hero.
    - C: as A in the game, and the log records her as rescued when the scheme was defeated.
40. **Serve and Protect: "exhaust an [X-FORCE] character and an [X-MEN] character".** (§3.70. Mutant Mayhem's "an
    [X-FORCE] ally and an [X-MEN] ally" returns two cards.)
    - **A (default):** two different characters you control, one with each trait; a character with both may be either.
      Each gets a tough status card.
    - B: one character with both traits may pay the whole cost and gets one tough status card.

Pass 2c's questions:

41. **_Magnetic Pull_ when the deck runs out before a MAGNETIC card.** (§3.71. "Discard cards from the top of your deck
    until a [MAGNETIC] card is discarded → add that card to your hand." RRG "Player Deck", p. 33: "no further cards are
    discarded from the newly shuffled deck"; "Cost Arrow Icon", p. 14; "Resolve", p. 37; "Limit", p. 27.)
    - **A (default):** the discards stand, the deck resets and deals him an encounter card, and nothing is added to his
      hand. The cost was not paid, so the ability did not resolve: Magneto's Armor and Magneto's Cape are not offered.
      It was used: the round's limit is spent and Old Grievances ("After you use") deals 1 damage for each card
      discarded.
    - B: it resolved with nothing found: the Armor reads the icons and the Cape readies him as well.
    - C: an unpaid cost is no use at all: nothing answers it, Old Grievances included; the limit is still spent.
42. **Does the MAGNETIC card _Magnetic Pull_ takes count as discarded?** (§3.71. Magneto's Armor: "if you discarded at
    least 1 of the following resource icons"; Old Grievances: "for each card discarded by it". Ruling April 30, 2026 –
    Ruling 4 (1) leaves out of a discard a card whose own Response took it away.)
    - **A (default):** yes. It was discarded and then added to hand by the Pull itself: its icons count for the Armor
      and it is one of Old Grievances' cards. A Pull whose first card is MAGNETIC costs 1 damage.
    - B: no: only the cards left in the discard pile count. A Pull whose first card is MAGNETIC costs nothing and gives
      the Armor nothing.
43. **Rogue's copy when the character she damaged leaves play.** (§3.74. "Deal 1 damage to another friendly character →
    until the end of the round, Rogue gains each of that character's Traits and adds that character's base THW and ATK
    to her matching powers." RRG "Lasting Effects", p. 26: "Lasting effects update whenever the game state updates";
    "Leaves Play", p. 27: "no memory of its previous state".)
    - **A (default):** the effect reads the character while it is in play. If it leaves play, or the cost's 1 damage
      defeats it, Rogue has nothing from it.
    - B: a snapshot: what the character had when the cost was paid, kept to the end of the round whatever happens to it.
44. **Tweedledope's boost field.** (§0.5, §7.4. Scan 48037 prints a star and no boost icon; RRG p. 69: "Removed the star
    icon from this card's boost field"; MarvelCDB and the emitted record have 1 boost icon and no star.)
    - **A (default):** the printed card with the erratum: 0 boost icons, no star, no Boost ability. The data agent sets
      `boostIcons: 0` with the scan and the erratum as evidence.
    - B: keep MarvelCDB's 1 boost icon, on the reading that the erratum put an icon where the star was.
45. **The campaign ally Magneto in a game with a Magneto hero.** (§3.80. `mut_gen` 32172a, Enemy of My Enemy: "Flip this
    card and put Magneto into play under the first player's control"; its other face is the ally Magneto, subtitle Erik
    Lehnsherr. RRG "Unique Icon", p. 46. The sibling of Q39, to be answered with it.)
    - **A (default):** the unique rule: the scheme is defeated and resolves the rest of its text, the ally does not
      enter play, and the card is set aside out of play.
    - B: the scheme's instruction wins (RRG "The Golden Rules", p. 4): the ally enters play beside the hero.
46. **Cyclops (49015) and an attack with several instances of damage.** (§3.81. "Until the end of the phase, increase
    the amount of damage that enemy takes from each attack by 1." Wave 5 §4 Q7 read "Increase all damage Venom takes by
    1" as once per damage event.)
    - **A (default):** the same unit: each instance of attack damage the enemy takes is 1 higher, so Grand Finale's four
      instances on it deal 3 each. No engine change.
    - B: once per attack: only the first damage of each attack is 1 higher. This needs a per-attack count on
      `increaseDamageTaken`.

## 5. What this asks of the other agents (pass 1a)

- **`card-data-pipeline`:** emit the six sets of this pass with §1.2–§1.9: one main scheme record each from the
  duplicated raw pairs, under the a record's id (§1.4); the Horsemen as eight one-stage villain cards joined per
  villain by `ScenarioVillain.sideBCardId` (§1.6; emitted so in data step 5); Pursued by the Past as one two-face
  environment; `classification: "standard"` on `standard_iii`; the two obligations with their set membership (§1.8);
  the attach hosts of §1.9; the two scenario records of §1.10. Read scans 45059–45061 (the amplify token in Unus's
  text), 45075a/b, 45082a–45084b and 45091 against raw before emitting. No schema change is requested.
- **`ability-scripting-engineer`:** nothing until §3.1, §3.7, §3.10, §3.11 and §3.13 land. Then one agent per set:
  `unus` with `infinites`; `four_horsemen`; `dystopian_nightmare` with `hounds`; `standard_iii`. Each "exists
  (verify)" row is proved by a test in the set's own test file before it is relied on.
- **`encounter-ai-designer`:** two scenario tests from §2: the Unus threshold ladder across a Gene Pool that rises
  and is thwarted down (§3.3), and a full Horsemen rotation with a treachery activation and a villain standing at 0
  (§3.7–§3.9). The automated player's choice in Infinite Hunter's boost and its targets for Golden Horse's response.
- **`rules-qa-engineer`:** fixtures for the exact-number tests of §3.1, §3.6 and §3.9–§3.11; the four rulebook
  conversion slips of §0 need no test, but Q5 (card versus rulebook) does once answered.
- **`game-client-engineer`:** four villains in a row with the active counter visible and each dial readable; a
  villain at 0 shown as standing, with the reason ("cannot be defeated while …", or §3.10's considered hit point) in
  Inspect; Gene Pool's threat and the three thresholds readable from Unus and from Infinite Soldier; pursuit counters
  and the reset threshold on Pursued by the Past. **Setup controls** (answered, §4.1): Q1, the Infinites threat as a
  control that is off (0) until the players turn it on, starting at the mode's recommendation when they do, with the
  amount shown before the game starts and never applied without the control; Q9 = B, **four A/B selectors, one per
  Horseman**, preset from the difficulty and each changeable, with the face's hit points, SCH and ATK beside it, and
  no "extreme" entry for this scenario (`difficultyOptionsFor` offers it to every scenario with several villains
  today); Q10, the Standard III toggle on every scenario that uses the Standard set.

### 5.1 Pass 1b

- **`card-data-pipeline`:** the nine sets and the `prelates` set with §1.12–§1.22: 45104b by hand and the 45104a link
  (§1.14); the five Prelate faces as their own cards and set (§1.15); `printedX: ["targetThreat"]` on 45103b (§1.13);
  the four-stage Apocalypse with `villainStages` `[2, 4]` and `[3, 4]` (§1.12); the three-sided Apocalypse with
  `startingSide: "A"` (§1.17); the three scenario records (§1.21); the corrections of §1.22, the unread scans first.
- **`game-rules-architect`:** §3.18, §3.19, §3.21, §3.25 and §3.26 are engine changes, one agent each; §3.24 and
  §3.28 ride on §3.11's change. §3.20, §3.22, §3.23, §3.27 and §3.29–§3.31 need no engine change unless their tests
  fail.
- **`ability-scripting-engineer`:** nothing until those land. Then one agent per set or pair: `apocalypse` with
  `prelates`; `dark_riders`; `dark_beast`; `savage_land`; `genosha`; `blue_moon`; `en_sabah_nur`; `celestial_tech`
  with `clan_akkaba`. The three scenario builders state what starts set aside (§2.7 step 4, §2.8 step 2).
- **`encounter-ai-designer`:** three scenario tests from §2: Apocalypse's clock to stage III with one defeat that
  heals him and the full chain to No Longer Worthy; Dark Beast across a stage change with two environments; En Sabah
  Nur through all three forms and one power counter reveal. The automated player's choices: Ozymandias's and Tyrant
  Worship's boost, The Shadow King's ally, which Setting Special costs to pay.
- **`rules-qa-engineer`:** fixtures for the exact-number tests of §3.18–§3.22 and §3.24–§3.27; one regression test
  each for ruling February 20, 2026 – Ruling 4 (§3.25 test 1) and ruling April 30, 2026 – Ruling 4 (2) (all five
  Prelates set aside in a campaign game whose log has struck an Overseer; with pass 1c).
- **`game-client-engineer`:** Apocalypse's stage and the main scheme's moving target readable together ("9 of 9 per
  player reveals stage III"); why he healed instead of falling, and the win condition, in Inspect; a locked side
  scheme shown as locked with its reason; the Setting environment's Special readable from every card that resolves
  it; the three forms of the villain with the current one marked and each form's Forced Response in Inspect; power
  counters and the threshold of 4; the setup option of Q12 (answered A: "begin with Apocalypse (I)", off by default
  on standard, and not what skirmish means). **The confirmation of Q13 is our UX warning, not a rule:** before a
  player card discards No Longer Worthy the client asks once, in words that say whose warning it is ("The rules allow
  this. Without No Longer Worthy this scenario can no longer be won. This warning is the app's, not the game's."),
  and the engine treats the discard as an ordinary legal choice.

### 5.2 Pass 1c

- **`card-data-pipeline`:** the five campaign sets with §1.23–§1.31: `campaignSpecific` on four sets and the two set
  names; the mission b faces as their own side schemes with a `cardNotes` dash; the Overseer faces with `null` SCH
  and ATK joined to the Prelate faces by `otherFaceId`, and the normalizer rule that makes a nested minion face its
  own card; `Mission Response` parsed as `forced-response`; Mission Team's dash cost, `flipSide` and errata; the
  hand-authored `campaign.ts`. No Mission Rules record (§1.29). Read the scans listed in §1.31 before emitting. No
  schema change is requested.
- **`game-rules-architect`:** §3.33, §3.36 and §3.39 are new, one agent each, §3.33 first (everything else stands on
  it). §3.34, §3.35, §3.37, §3.42 (the considered icon), §3.43 and §3.44 are one more case each. §3.46 waits for
  Q21. §3.38, §3.40, §3.41 and §3.45 need no engine change unless their tests fail. When `campaign.ts` is next
  edited, correct the `CampaignCardFace` comment (§1.23).
- **`ability-scripting-engineer`:** nothing until §3.33–§3.39 land. Then, one agent each: (1) the mission rules
  block, the five missions and Mission Team, with `missionAttempt()`, in
  `packages/cards/src/wave8/aoa/campaign/missions.ts`; (2) the five Overseer faces; (3) `age_of_apocalypse` and
  `aoa_campaign`; (4) the campaign allies and Desperate Measures; (5) the `CampaignDefinition`
  `packages/cards/src/campaigns/aoa.ts` and its heal helper; (6) a campaign e2e. Each "exists (verify)" row is proved
  by a test in the module's own test file before it is relied on.
- **`encounter-ai-designer`:** the automated player's mission policy, as plain rules: when an ally goes to the
  mission and when to its player's area (the mission's remaining threat and hit points against attempts left);
  which Mission Team option to take (never an attempt with no ally there; the discount when an ally is about to be
  played to the mission); the pairing that matches the most ATK and THW (§3.36), under Mister Sinister's limit; the
  order of the pool (§3.37); Mikhail Rasputin's damage; Agent of Apocalypse's and Worldwide Crisis's choices; the
  expert heal. In scenario 5 it must not defeat the villain while Protect the Professor is undefeated and can still
  be. One scenario test: a mission defeated by round 3 in Unus, and one that fails on the fourth attempt.
- **`rules-qa-engineer`:** one regression test each for ruling April 30, 2026 – Ruling 4 (1) (§3.38 test 1, both
  branches, and the Abyss case of test 3), for answer (2) with §3.46's three games, and for the Mission Team erratum
  (§3.35 test 2: the discount does not outlive the phase). Fixtures for the exact-number tests of §3.33–§3.37 and §3.40.
  Campaign tests of §3.45: each mission won and failed, the reward and the cost carried to the next scenario, a retry
  after a loss in which the Overseer was defeated, with the retry's mission and Overseer drawn again (Q22 = B; §3.45
  test 8), scenario 5 won three ways, a seat eliminated in a won expert game. Report, do not fix, the two repo documents
  that read the log's columns backward (§0.2).
- **`game-client-engineer`** (design first; MC45 is a box that needs a design pass, `docs/campaign-client-per-box.md`
  §3, whose MC45 row is corrected by §0.2):
  - **Dossier (the log).** Per seat: identity and, in an expert campaign, remaining hit points. The four missions in
    the sheet's order with their three cells (Setup, Defeated, Not Defeated) readable in full; a struck row marked
    with the cell that applied (the result the paper sheet has no box for); the five Overseer boxes, struck ones
    marked. What carries: Desperate Measures on offer each game, Panicked Refugees each game, North American Sea
    Wall each game, each seat's granted upgrade, support and campaign ally; cards removed from the campaign shown as
    such.
  - **Briefing, every scenario.** The mission drawn and the Overseer drawn, shown as drawn, not chosen, with both faces
    of the mission and the Overseer's Mission Response in Inspect; on a retry both are drawn again and the Briefing says
    so ("new attempt, new draw") instead of carrying the lost game's pair over (Q22 = B); the row's Setup cell and what
    its Defeated and Not Defeated cells will do; what the log carries into this game; in an expert campaign each seat's
    hit points and the heal's price (3 threat on the mission), with "must pay" for a seat that was defeated. Scenario 3:
    which Prelate is absent and why (Q21). Scenario 5: Protect the Professor, with both ways it ends the campaign, and
    "Professor X cannot enter play".
  - **Aftermath.** The strike; the row's cell applied; the picks: an upgrade or a support from any aspect is a
    collection-wide searchable picker (MC27's), a campaign ally is four cards with the ones taken marked; the
    Overseer struck or not, with the reason; scenario 5's two endings, including a won game that lost the campaign.
  - **In-game mission UI.** The mission area as its own region of the table, visibly apart from the villain's area
    and from every player's: the mission with its threat and attempt counters ("2 of 4"), the Overseer with damage
    and hit points and dashes for SCH and ATK, any Agent of Apocalypse, the allies there with their resource icon
    shown large and their hit points, upgrades on them (an upgrade other than Desperate Measures drawn as inactive,
    with the reason "no effect at the mission" in Inspect and a warning in the play prompt before its cost is paid;
    Q19 = B), and facedown cards on Abyss as a count. A Mission Rules
    reference panel with both sides (§1.29).
  - **Playing an ally** while a mission is in play: a destination prompt (your area or the mission) with the cost
    after Mission Team's discount, and a short reason when a destination is refused (unique, "Play only if").
  - **A mission attempt as a stepper** that never auto-resolves a choice: the cards discarded; the Mission Response
    as it resolves; Digging Deep's prompt ("it will not count, and no card replaces it"); the pairing, with matches
    lit as cards are dragged to allies, the [wild] rule shown, and Mister Sinister's limit explained when it blocks
    a pair; the pool dealt enemy by enemy, with a shielded Overseer shown as shielded; the threat removed; then the
    counter and the 1 damage to each ally.
  - **Warnings and reasons.** Before a third counter becomes a fourth; in scenario 5 before an attack that would
    defeat the villain while Protect the Professor is undefeated ("winning now loses the campaign"), with a
    confirmation; why a mission cannot be thwarted or its cards chosen, in Inspect; why a mission at no threat is
    still in play.
  - **Setup pacing:** the choice frames this box adds before the first turn are the mission's Setup cell, the
    Desperate Measures offer, the ally search and each seat's expert heal.
  - **Teaching** (every wave: glossary, a tip, a tricky-wording hint, a Try-it): glossary entries for mission area,
    mission attempt, Mission Response, Overseer and attempt counter; a Try-it that plays one ally to the mission and
    makes one attempt with a known top card.

### 5.3 Pass 2a

- **`card-data-pipeline`:** §1.32's `HostQualifiers.classification` and the parser's "an identity-specific ally you
  control" (data survey gap 2). Check before emitting: Advanced Suit's two-trait host ("an [X-FORCE] or [X-MEN]
  ally") as `anyOf`; Marrow's two-trait "Play only if" left to the script; `requiresIdentityTrait` on Tempus,
  Stepford Cuckoos, Bloodgem, Basic Spell and Spiritual Meditation; `maxPerPlayer: 1` on Blood Rage, Test the Defense
  and Team Training; "Max 1 per ally" on Advanced Suit; the uses keyword on Stepford Cuckoos; Ruler of Limbo's
  amplify icon and Portal Through Time's acceleration icon; Battle for Limbo's boost star with no icon; the stars on
  Legion, Goldballs and Belasco; cost 0 on the six cards of §0.3. **Two earlier packs:** add the subtitle "Piotr
  Rasputin" to Colossus `mut_gen` 32048 and `wolv` 35021 (scan 32048; §3.58). No raw slip was found in pass 2a's own
  records.
- **`game-rules-architect`:** §3.48 is new and §3.49 stands on it; then §3.51, §3.53 with §1.32, §3.54, §3.55 and
  §3.59, one more case each, one agent each. §3.50, §3.52 and §3.56–§3.58 need no engine change unless their tests
  fail. §3.52's Uniform waits on §3.39.
- **`ability-scripting-engineer`:** per hero, the usual split under `packages/cards/src/wave8/aoa/<hero>/`:
  `identity.ts`, `events.ts`, `support-upgrades-allies.ts`, `obligation-nemesis.ts`, then a precon e2e. Bishop needs
  §3.39 and §3.51; Magik §3.48–§3.50 and, for her nemesis set, §3.1. The Leadership cards wait on §3.53, §3.54 and
  §3.59; Goldballs on §3.55; the other aspect and basic cards wait on nothing (§3.60). `topOfYourDeckHas` and
  `yourSidekick` are helpers in `@mc/cards`. Each "exists (verify)" row is proved by a test in the module's own test
  file before it is relied on.
- **`encounter-ai-designer`:** the automated player's choices: Magik's once-per-phase play (prefer it when the card
  under the top one satisfies the played card's condition); Limbo's swap at the start of the villain phase (a
  defense on top); Bishop taking an attack undefended when Energy Absorption pays for it; Fear the Future's and
  Darkchilde's options; which card Temporal Trickery discards; the order of Battle for Limbo's activations. With a
  Cable, X-23 or Colossus hero at the table it never keeps the matching ally for anything but its resource.
- **`rules-qa-engineer`:** one regression test for each of the four FAQ entries on Magik (tests 1, 3, 4 and 5 of §3.49)
  and for the Suit Up erratum (§3.59 test 1); ruling April 30, 2026 – Ruling 3 (7) with a faceup deck (§3.48 test 5);
  ruling February 28, 2026 – Ruling 7 (2) on Portal Through Time (§7.1); the unique matches of §3.58, including the
  Colossus data fix; fixtures for the exact-number tests of §3.50–§3.57; Witchfire's four cases (§7.1) in a test named
  "RAW pending FFG clarification (Q31)"; the facedown top card of §3.50 test 7 (Q26 = B). Deck tests (DoD §4b): both
  starter decks legal at 40 cards; the illegal decks of §3.58 test 4; two Sidekicks or two Bloodgems in one deck
  illegal.
- **`game-client-engineer`:**
  - **Magik's deck:** the top card drawn faceup on the deck for every seat, with its resource icons large enough to
    read at table zoom; a "play from deck (1 less)" affordance that shows the reduced cost and whether the phase's
    use is spent; when a card is played from the top, the next card turns over before the payment prompt opens. The
    three upgrades and three events show their condition met or unmet against the current top card; with the card
    facedown under a blank text box they show unmet with the reason "top card facedown" and no icon (Q26 = B).
  - **Bishop:** the cards Energy Absorption discards shown in order with the resource cards marked as they go to his
    hand; the count of resource cards in hand on the Rifle and the Uniform; charge counters and the +8 cap on
    Super-Charged; a "paid with a resource card" marker in the payment prompt of Concussive Blast and Command
    Authority.
  - **Sidekick:** a badge on the sidekick ally; Side-by-Side's reason when it cannot be played (no sidekick, or the
    sidekick is ready under Q29 = A).
  - **Ruler of Limbo:** the facedown cards on it as a count, Limbo marked among them, and "threat cannot be removed
    while Belasco is in play" as the scheme's locked reason.
  - **Unique blocks:** at deck selection and in hand, why Cable, X-23 or Colossus cannot be played beside the
    matching hero, and that the card still pays as a resource.
  - **Guided mode** (every wave: glossary, a tip, a tricky-wording hint, a Try-it):
    - Glossary: resource card (a card type, not any card spent as a resource); faceup top card; "as if it was in
      your hand"; sidekick; identity-specific ally; charge counter; psi counter.
    - Tips: Magik: "Check the card under the top one before you play from your deck." Bishop: "An attack you take
      refills your hand: resource cards discarded by Energy Absorption come to you." Leadership: "Sidekick only goes
      on an ally from a hero's own set."
    - Tricky-wording hints (Inspect notes): Magik's play counts as played from hand, and putting into play does not
      use it (RRG p. 64); a card played from the top reads the **next** card; "printed [physical] icon" on Malcolm
      is not met by a [wild]; "paid for this event with a resource card" needs a resource card, not a resource;
      Goldballs must discard at least 1; Full-Body Charge reads the printed hit points; Witchfire's "Otherwise"
      places 1 threat on the main scheme after any attack of hers that defeats no ally (Q31 = B, as printed); Energy
      Absorption answers attacks only.
    - Try-it lessons: (1) Magik with Soul Strike on top and a [physical] card under it: play it from the deck for 1
      and stun. (2) Bishop takes an undefended attack of 3 with two resource cards among his top three, then fires
      Bishop's Rifle. (3) Sidekick on Malcolm, then Side-by-Side.

### 5.4 Pass 2b

- **`card-data-pipeline`:** no schema change. **Iceman:** write the starter deck from the printed decklist card with
  **Frostbite 46002 ×6 listed** (46 entries, 40 counted; `verified`, the X-23 note's wording for a permanent card), no
  `separateDecks` entry and no deck-limit correction (§3.61); correct Cryokinetic Perception's text to "the ICE trait"
  with scan 46005 as evidence; rewrite the curation's header (it says the starter deck is not curated). Check before
  regenerating: Frostbite keeps `permanent`, `quantityInSet: 6`, `deckLimit: 6` and no `attachesTo`; Snow Clone's
  `thw: null`; Frozen Solid's `form: "hero"` and `maxPerHost`; `maxPerHost` on Suppressing Fire; Life Drain's
  superlative host; Pyro's and Life Drain's ATK stars; the boost stars with no icon on Burn! and Sauron; cost 0 on
  46014, 46017 and 46018. **Jubilee:** a `cardNotes` line on each of 47007a/b/c, 47008a/b/c and 47010a/b/c (one title,
  three versions, `deckLimit: 1` is per record; §3.69); an ability id for Grounded's constant line; a `cardNotes` line
  on Shopping Spree for the insert's victory sentence. Check: `producesIcons` on the three Plasmoid Energy records;
  `amplifyIcons: 1` on Arcade's Funhouse; `hinder` with `perPlayer: 1` on the three TRAP! schemes; `teamUp` names and
  `deckLimit: 1` on Unlikely Duo; `anyPlayerControl` and `maxPerPlayer` on Disguise; the uses keyword on Cell Phone;
  `alliance` on 47028 and 47029. Both packs: `sauron` and `arcade` flagged as modular sets the setup screen offers. No
  raw slip other than 46005's article, 47009's title (already corrected) and 47022's quantity (already handled).
- **`game-rules-architect`:** §3.62, §3.63 and §3.64 are one more case each, one agent each; §3.62 first (thirteen cards
  wait on it) and beside §3.51, which changes the same payment frame. §3.61 and §3.65–§3.69 need no engine change unless
  their tests fail; §3.61's Cryokinetic Perception waits on §3.39. Q35 changes one line of Frostbite's script, not the
  engine.
- **`ability-scripting-engineer`:** per hero, the usual split: `packages/cards/src/wave8/iceman/iceman/` and
  `packages/cards/src/wave8/jubilee/jubilee/`, each with `identity.ts`, `events.ts`, `support-upgrades-allies.ts`,
  `obligation-nemesis.ts`, then a precon e2e; each pack's aspect and basic cards in `player-cards.ts` and its modular
  set in `sauron.ts` / `arcade.ts`, one agent each. Iceman waits on §3.39 only; Frostbite's script lives in
  `identity.ts` with `attachFrostbite(enemy)` as a helper in `@mc/cards` that every other module calls. Jubilee waits on
  §3.62 (her events, the Coat, the Sunglasses, Three Steps Ahead, Multitalented, Husk), §3.63 (Grounded) and §3.64 (Cell
  Phone); a `versions(ids, definition)` helper registers one definition under the three version ids (§3.69). Each
  "exists (verify)" row is proved by a test in the module's own test file before it is relied on.
- **`encounter-ai-designer`:** the automated player's choices. Iceman: always _"Freeze!"_; which enemies get the copies
  when Ice Blast has fewer than it needs (the villain first); Arctic Attack's option (6 damage when a copy is already
  there); Cool Off's picks; defend with Ice Wall in play rather than exhaust. Jubilee: pay with the cards that give the
  most types when the card reads them, keep _"Like, totally!"_ for a payment one type short, and declare each wild
  itself as a type the payment lacks (Q33 = B: nobody's wild is declared by the engine, the automated player's
  included); _Mall Rat_ whenever she
  is in alter-ego form with Shopping Spree in her deck; pay Grounded's cost only with a Jubilee event in hand. Encounter
  side: the indirect damage of Pyro, Playing with Fire and Burn!; The Eye of Sauron's discard and exhaust; the order of
  Elaborate Trap's schemes; which ally or upgrade Arcade's Funhouse takes. It never keeps Shadowcat 46019, Wolverine
  47002 or `wolv` 35003 for anything but a resource beside the matching hero.
- **`rules-qa-engineer`:** one regression test each for ruling June 2, 2026 – Ruling 1 with this pass's cards (§3.68
  test 4), ruling January 17, 2026 – Ruling 4 (1) (§3.62 tests 2 and 5, with the declare prompt and its shortcut,
  tests 11 and 12; Q33 = B) and, once Q38 is answered, ruling February 8,
  2026 – Ruling 1's intent on Snow Clone and Chamber (§3.67 tests 2 and 3). Fixtures for the exact-number tests of
  §3.61–§3.67. Deck tests (DoD §4b): both starter decks legal (Iceman 46 entries and 40 counted, `requiredIdentitySet`
  returning Frostbite ×6; Jubilee the nine version records); the illegal decks of §3.68 test 1 and §3.69 tests 2 and 4;
  a second Unlikely Duo illegal; an Iceman deck with five Frostbite illegal. Each hero in a second aspect (DoD §4b):
  Iceman with no Aggression card, and Jubilee outside Justice, whose own events still read the types that paid.
- **`game-client-engineer`:**
  - **Iceman:** the set-aside supply beside his identity as a counted pile ("Frostbite 4 of 6"), each copy on an enemy
    drawn on that enemy with its −1 SCH and −1 ATK in the stat's reason, and a copy returning to the pile animated as a
    return, not a discard; Ice Wall's damage against its threshold ("6 of 8"); Frozen Solid on an enemy marked "next
    activation skipped"; the deck builder lists Frostbite ×6 under "set aside, not counted" and never offers it to
    another hero.
  - **Jubilee:** the payment prompt shows, for a card that reads types, the count as cards are added ("2 different
    types: stuns"), a type selector on each wild that she must set before confirming (four choices, none preselected;
    Q33 = B), no selector when the engine has skipped the prompt as equivalent, and the overpaid resources grayed
    (Q34); the three versions drawn
    as three cards with their icon in hand, in the deck builder and in decklists ("Firecracker ×3: [energy], [mental],
    [physical]"); Shopping Spree's locked reason for heroes and allies, its Alter-Ego Action offered to every player in
    alter-ego form, and _Mall Rat_ on Jubilation Lee; Grounded's cost on the change-form control with the reason when it
    cannot be paid; Cell Phone's player, character and power choice with its counters.
  - **Both:** "an upgrade attached" lit on enemies that qualify while Take That!, Surprise Move or Glob is in hand; the
    unique block and the Team-Up replacement at deck selection for Wolverine beside Jubilee (§3.68), with the "Max 1 per
    deck" reason when Jubilee's deck already holds Unlikely Duo; the pair's pictures in `art/teamups/jubilee-wolverine/`
    (DoD §5; the folder does not exist yet).
  - **Guided mode** (every wave: glossary, a tip, a tricky-wording hint, a Try-it):
    - Glossary: Frostbite; set-aside copy; permanent (set aside before setup, never in the deck); "an upgrade attached"
      (a player upgrade on an enemy, not an attachment); indirect damage; resource type (four: a wild is one of them, or
      stands for another); "different resource types"; overpaid; Team-Up; alliance; TRAP! side scheme.
    - Tips: Iceman: "Defend with Iceman himself: Freeze! takes 1 off that attack." Iceman: "Frostbite leaves after the
      enemy acts, so hit a frozen enemy before the villain phase." Jubilee: "Pay with two different icons: Plasmoid
      Energy is two on its own." Jubilee: "Change to Jubilation Lee to go shopping: only an alter-ego can work on
      Shopping Spree."
    - Tricky-wording hints (Inspect notes): Frostbite is set aside, not discarded, and does not count toward 40; a copy
      attached during an attack leaves when that attack ends (Q35); Ice Wall takes the damage of any player's identity
      and is discarded at 8, not destroyed at its own choice; Frozen Solid skips an activation, and a stunned enemy uses
      up its stunned card first; "an upgrade attached" does not count encounter attachments; overpaid resources are not
      "used to pay" (Q34) and a cost of 0 pays with no types; "2 different resource types" is at least 2; you say what a
      wild is when you pay, it may be a type you are missing, and the game never picks it for you (Q33); the three
      versions of Firecracker are one card for "copies" and three for icons; Shopping Spree has no Victory and comes
      back; Grounded's cost is 2 of one type and only for changing to hero form on your turn; Unlikely Duo needs both a
      Jubilee and a Wolverine in play, and may confuse one enemy and hit another; Cell Phone's character still exhausts.
    - Try-it lessons: (1) Iceman attacks, _"Freeze!"_ attaches Frostbite, then Take That! for 7. (2) Iceman defends an
      attack of 3 with _"Freeze!"_ and takes 0. (3) Jubilee plays Firecracker with Plasmoid Energy and stuns. (4)
      Jubilation Lee uses _Mall Rat_, exhausts twice over two turns and takes Jubilee's Coat.

### 5.5 Pass 2c

- **`card-data-pipeline`:** no schema change. **Nightcrawler:** regenerate **Kurt's Cutlasses 48004** by itself and
  review the diff by hand: `restrictedWeight: 2` and the one ability id `48004.kurts-cutlasses-constant` (§3.73; today
  the record has two constant ids and no weight, so the card weighs nothing). Three printed values, each with its scan
  as evidence (§0.5): `icons: ["hazard"]` on Brimstone Dimension 48028;
  `startingThreat: { base: 0, perPlayer: 2 }` on The Crazy Gang 48033; Tweedledope 48037's `boostIcons` stay 1 (Q44 = B, no change) once Q44
  is answered (default 0), with its `Errata` note rewritten, since the note says the current data has no star and does
  not say the print has no icon. Rewrite the curation's header (it says "no hand corrections needed"). Check before
  regenerating: Bamf!'s `attachesTo: enemy`, `maxPerHost` and cost 0; cost 0 on 48010, 48015 and 48016; Gambit's
  `thw: "X"`, `atk: "X"`; Azazel's Sword's `ifAble` host and ATK star; Azazel's boost star with `boostIcons: 0`;
  `anyPlayerControl` and `maxPerPlayer` on Change of Fortune; `alliance` on 48031 and 48032; Astonishing X-Men's flat 5
  and `victory 0`. **Magneto:** accept the regen of Magneto's Armor 49004 (one ability id,
  `49004.magnetos-armor-response`; the three `-constant` ids go); Selene 49039's text gains its period; a `cardNotes`
  line on Sebastian Shaw 49038 for the printed "Forced Respone" and one on New Recruits, White Queen and Won't Stay Down
  saying the two-trait "Play only if" line is a script rule (`playOnlyIf`), not a `playRestrictions` field. Check:
  `nemesisMinion: true` on Exodus and on no other card of the set; the ATK stars of Exodus and Frenzy and the boost
  stars of Fabian Cortez, Frenzy, Selene, Hellfire Pawn and Power and Decadence with `boostIcons: 0`;
  `amplifyIcons: 1` on Martyr for Mutants and The Inner Circle; the `linked` keyword with its title on 49033–49036;
  Wrapped in Metal's `form: "hero"` and non-ELITE minion host; Deft Focus's `aspect: "basic"`; `producesIcons` on
  Master of Magnetism. Both packs: `crazy_gang` and `hellfire` flagged as modular sets the setup screen offers. No other
  raw slip was found on a scan.
- **`game-rules-architect`:** §3.71, §3.75 and §3.77 are the engine work, one agent each. §3.71 lands with or after
  §3.39 (it adds `carry` to the moment that section builds) and beside §3.62, which stamps a payment on an event the
  same way. §3.75 is one more case of `dealAsEncounterCard` and one small effect. §3.77 is one `TargetQuery` field.
  §3.72–§3.74, §3.76 and §3.78–§3.80 need no engine change unless their tests fail. Q46 = B would add a per-attack count
  to `increaseDamageTaken`.
- **`ability-scripting-engineer`:** per hero, the usual split: `packages/cards/src/wave8/ncrawler/nightcrawler/` and
  `packages/cards/src/wave8/magneto/magneto/`, each with `identity.ts`, `events.ts`, `support-upgrades-allies.ts`,
  `obligation-nemesis.ts`, then a precon e2e; each pack's aspect and basic cards in `player-cards.ts` (Nightcrawler's
  with 48031 and 48032, Magneto's with 49033–49037) and its modular set in `crazy-gang.ts` / `hellfire.ts`, one agent
  each. Nightcrawler waits on §3.39 (Tally Ho!) and on the Cutlasses' regeneration; Bamf!'s script lives in
  `support-upgrades-allies.ts` and raises `"bamf"`. Magneto waits on §3.71 (the identity, the Armor, the Cape, Old
  Grievances) and §3.77 (Electromagnetic Blast); The Crazy Gang and Brimstone Dimension wait on §3.75. "Nightcrawler",
  "Kurt Wagner" and "Magneto" in a kit card's text are that card's controller's identity by face, never a title match
  across the table (§3.80). Hellfire Pawn 49040 registers `mut_gen` 32058's script. Each "exists (verify)" row is proved
  by a test in the module's own test file before it is relied on.
- **`encounter-ai-designer`:** the automated player's choices. Nightcrawler: Bamf! on the enemy that will attack him
  next, the villain first; always the interrupt when the attack would otherwise be undefended; Tally Ho! whenever it is
  in hand; _Rapid Teleportation_ in the villain phase before a second attacker; which card Gambit tucks (the most boost
  icons); Rogue's target (the highest base THW plus ATK among characters that survive 1 damage, under Q43 = A). Magneto:
  _Magnetic Pull_ every round unless Old Grievances would defeat him; Wrapped in Metal on the minion with the highest
  ATK or with guard or patrol; Magnetic Missile when the wrapped minion's remaining hit points are worth less than 5
  damage and a stun; which NEW ally to take. Encounter side: the player's pick for Selene's boost; Executioner's tie
  (the first player); the order of minion activations for "Off with His Head!" and Angry Acolyte; the villain Power and
  Decadence goes to when there are several. It never keeps Rogue 48012, Gambit 48021, Phoenix 49014 or Cyclops 49015 for
  anything but a resource beside the matching hero.
- **`rules-qa-engineer`:** one regression test each for ruling January 17, 2026 – Ruling 1 (1) on the card it names
  (§3.74 tests 6 and 7), ruling January 17, 2026 – Ruling 5 with Face the Past in The Wrecking Crew (the nemesis minion
  found in the set-aside area, defeated into the active villain's discard pile), ruling July 9, 2026 – Ruling 1 through
  the reprint 48017, ruling January 26, 2026 – Ruling 6 (2) on _Magnetic Pull_'s limit across a flip (§3.71 test 1), and
  the five RRG p. 69 errata as current text (Rogue's base, Magnetic Missile's "Then" with no wrapped minion, Exodus's
  "for that attack" with a boost card, Deft Focus in a non-Protection deck, Tweedledope's boost field under Q44).
  Fixtures for the exact-number tests of §3.71–§3.80. The cross-box game of §3.80 tests 4 and 5 (the hero Magneto
  against the villain Magneto) is a scenario replay of its own. Deck tests (DoD §4b): both starter decks legal at 40; a
  deck listing a NEW ally illegal; the illegal decks of §3.80 test 1; a second Face the Past illegal. Each hero in a
  second aspect (DoD §4b): Nightcrawler outside Protection, where Bamf! is his only defense trick, and Magneto outside
  Leadership, with New Recruits out of the deck and no NEW ally set aside.
- **`game-client-engineer`:**
  - **Nightcrawler:** each Bamf! drawn on its enemy with the defend prompt offering "Bamf!: defend without exhausting"
    beside the ordinary choices, and the copy's trip to the discard pile and back to hand shown as that card; _Rapid
    Teleportation_ and Kurt Wagner's search on the identity with their limits; the restricted load on his upgrades ("3
    of 3: Cutlasses count as 2") with the reason when a card would be discarded; the card under Gambit shown as a tucked
    card with its boost field in view and X resolved on his stats; Rogue's borrowed traits and numbers with their source
    and "until the end of the round".
  - **Magneto:** _Magnetic Pull_ as a reveal of the cards it discards, one at a time, ending on the MAGNETIC card, with
    the icons the Armor will read and Old Grievances' damage counted as it goes; the discard pile's order visible for
    Survivor and Asteroid M ("top 3"); Magnetic Bubble's damage against its threshold ("4 of 6"); a wrapped minion
    marked "cannot activate, text box blank" with its keywords struck through; the set-aside NEW allies visible from New
    Recruits, and the choice of one for each player when it is defeated; the linked allies listed in the deck builder as
    "set aside by New Recruits", never selectable.
  - **Both:** the setup screen offers The Crazy Gang and the Hellfire Club as modular sets; a minion The Crazy Gang
    deals animated from play to a facedown card and across to the next player; a facedown boost card waiting on
    Sebastian Shaw or on the villain shown on that enemy; "cannot be attacked again this phase" and "allies cannot
    attack" as target reasons; the unique block at deck selection and in hand for the four allies of §3.80, and the note
    at scenario selection that the hero and the villain Magneto may meet.
  - **Guided mode** (every wave: glossary, a tip, a tricky-wording hint, a Try-it):
    - Glossary: Bamf! (an upgrade on an enemy); "declare the defender without exhausting"; tuck (faceup under a card,
      not in play); "counts as 2 restricted cards"; base THW and ATK; MAGNETIC; Magnetic Pull; linked (set aside, never
      in a deck); NEW ally; steady; villainous; patrol; "discarded, not defeated".
    - Tips: Nightcrawler: "Put Bamf! on whoever is about to hit you: he defends for 3 and stays ready." Nightcrawler:
      "Tally Ho! brings that Bamf! straight back to your hand." Magneto: "Pull every round: the card you find is
      MAGNETIC, and every card it flips can feed the Armor." Magneto: "Wrap a minion, then throw it with Magnetic
      Missile."
    - Tricky-wording hints (Inspect notes): Bamf! works on any attack of that enemy, another player's included, and
      makes Nightcrawler the target; it is a basic defense, so DEF applies and Riposte can be played; Tally Ho!'s damage
      lands before the attack's; _Rapid Teleportation_ returns a copy to hand and does not play it; Kurt's Cutlasses are
      not a restricted card but fill both restricted slots, and Prehensile Tail's extra slot is for a card with the
      keyword; a star in a boost field is not a boost icon (Gambit); Rogue adds base numbers, not what upgrades have
      added; Northstar cancels icons, not the Boost ability; _Magnetic Pull_'s card counts as discarded (Q42) and an
      empty deck stops it (Q41); the Armor needs the icon discarded, a wild is none of them; Magnetic Bubble takes all
      the damage even past 6; a wrapped minion keeps its traits and stats and loses guard and patrol; Magnetic Missile
      discards the minion, so nothing "when defeated" happens; "Hero Action" and "Hero Response" are the only labels
      Electromagnetic Blast looks for; a NEW ally is yours once it is in your hand, and is free of the ally limit only
      for a MUTANT or X-MEN identity; Face the Past needs the nemesis minion out of play; Sebastian Shaw can be attacked
      once a phase; The Crazy Gang sends a scheming minion round the table to be revealed again.
    - Try-it lessons: (1) Nightcrawler plays Bamf! on the villain, defends its attack ready, and Tally Ho! returns the
      copy and deals 3. (2) Nightcrawler plays 'Port and Punch with Bamf! on two enemies. (3) Magneto uses _Magnetic
      Pull_ with the Armor in play and attacks at +1. (4) Magneto wraps a guard minion, attacks the villain past it,
      then plays Magnetic Missile. (5) Magneto defeats New Recruits and plays Surge as a fourth ally.

## 6. Later passes

None is left. The list of new and extend rows this section held after pass 2c is now the ordered engine queue of
§8.2 (pass 3), with the "exists (verify)" and "exists (compose)" rows in §8.3, the scripting order in §8.4 and the
campaign, client and Guided mode work in §8.5.

## 7. Pass 2: hero packs

### 7.1 Pass 2a: Bishop, Magik and the box's player cards

Read 2026-10-07: every raw record 45001a–45058 with the two nested alter-ego faces; the scans listed in §0.3; MC45
pp. 2 and 22; RRG pp. 64 and 69. Both starter decks are MC45 p. 22's lists (40 cards each, `curation/aoa.ts`).

| Identity                         | Obligation              | Nemesis set (nemesis minion in bold)                                                       | Setup, hand size, starter deck                                                 |
| -------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Bishop / Lucas Bishop (45001)    | Fear the Future (45025) | **Trevor Fitzroy** (45026, quickstrike), Portal Through Time, Bantam, Temporal Trickery ×2 | No Setup. 5 / 6, THW 2 ATK 2 DEF 1, REC 4, 12 hit points. Leadership, 40 cards |
| Magik / Illyana Rasputin (45030) | Darkchilde (45053)      | **Belasco** (45054, villainous), Ruler of Limbo, S'ym, Witchfire, Battle for Limbo         | No Setup. 5 / 6, THW 1 ATK 2 DEF 2, REC 3, 10 hit points. Aggression, 40 cards |

Traits: Bishop TEMPORAL, X-MEN; Lucas Bishop MUTANT, TEMPORAL; Magik MYSTIC, X-MEN; Illyana Rasputin MUTANT, MYSTIC.
Neither alter-ego has the X-MEN trait: Marrow, Tempus and Stepford Cuckoos cannot be played in alter-ego form. Magik
has MYSTIC on both faces.

#### Bishop: resource cards as fuel

He takes a hit, discards that many cards and keeps the resource cards (§3.52), then spends them: as payment that
readies him or draws (§3.51), as cards in hand that the Rifle and the Uniform count, as discards that ready Malcolm
and Randall or charge Super-Charged. Energy Conversion caps a hit at 3 and shuffles the spent resource cards back
under it. His starter deck holds 3 Stored Energy, 2 The Power of Leadership, Energy, Genius and Strength: 8 resource
cards.

| Card                                                  | As read                                                                                                                                               | Needs                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Bishop 45001a, _Energy Absorption_                    | Response: after he takes any amount of damage from an attack, discard that many cards from the top of the deck; each resource card among them to hand | §3.52; raises §3.39's moment |
| Lucas Bishop 45001b, _Temporally Displaced_           | Response: after changing to this form, a TEMPORAL card from the discard pile to hand                                                                  | §3.60                        |
| Malcolm 45002, Randall 45003 (allies, cost 3, [wild]) | Action, once per phase: discard a resource card from hand → ready; heal 1 if it prints [physical] (Malcolm) or [energy] (Randall)                     | §3.52                        |
| Bishop's Rifle 45004 (cost 2, restricted)             | Hero Action (attack): exhaust and choose an enemy → 1 damage per resource card in hand; ranged                                                        | §3.52                        |
| Bishop's Uniform 45005 (cost 2)                       | Response: after you resolve "Energy Absorption", exhaust → heal 1 from Bishop per resource card in hand                                               | §3.52, §3.39                 |
| Super-Charged 45006 ×2 (cost 0)                       | Action: discard a resource card → 1 charge counter per icon. Hero Interrupt on a basic attack: discard it → +2 ATK per counter, at most +8            | §3.52                        |
| Concussive Blast 45007 ×2 (cost 3)                    | Hero Action (attack): 6 damage; if paid with a resource card, ready Bishop                                                                            | §3.51, §4.2 Q28              |
| Command Authority 45008 ×2 (cost 2)                   | Hero Action (thwart): remove 3 threat; if paid with a resource card, draw 1                                                                           | §3.51, §4.2 Q28              |
| Energy Conversion 45009 ×2 (cost 0)                   | Hero Interrupt (defense): shuffle each resource card in the discard pile into the deck; you cannot take more than 3 damage from this attack           | §3.52                        |
| Stored Energy 45010 ×3                                | A resource card, [energy] and [physical], TEMPORAL, no text                                                                                           | data                         |
| Fear the Future 45025                                 | May flip to alter-ego. Exhaust Lucas Bishop → remove from the game; or discard it and each resource card in hand, surge if none was discarded         | §3.52                        |
| **Trevor Fitzroy** 45026 (SCH 2, ATK 3, 5)            | Quickstrike. After he attacks and defeats an ally: 2 threat on Portal Through Time if in play, otherwise find it and reveal it                        | §3.1, §3.60                  |
| Portal Through Time 45027 (4 threat)                  | One acceleration icon. Forced Interrupt: when a TEMPORAL card is revealed it gains surge, once per phase                                              | §3.60                        |
| Bantam 45028 (SCH 2, ATK 2, 3)                        | When Revealed: 2 threat on Portal Through Time if in play, otherwise find it and reveal it                                                            | §3.1                         |
| Temporal Trickery 45029 ×2                            | Discard a card in hand with the most printed icons; 1 threat on each scheme per icon on it                                                            | §3.52                        |

- **Portal Through Time** gives surge only to a card revealed while it is in play: Bantam, whose own When Revealed
  finds and reveals it, gains none (ruling February 28, 2026 – Ruling 7 (2)). Test: Portal in play, Trevor Fitzroy
  and then Temporal Trickery revealed in one phase: the first gains surge, the second does not (the limit). Only
  encounter cards are revealed, so Bishop's own TEMPORAL cards never matter to it; TEMPORAL cards of other sets do.
- **The mission (§3.36, §3.38).** Energy Absorption discards from the deck a mission attempt discards from, and is
  not a mission attempt: no Mission Response answers it and nothing is paired. What it changes is the deck the
  next attempt reads: resource cards leave it for his hand, and Energy Conversion shuffles them back in.

#### Magik: the top of the deck

Her top card is faceup in hero form (§3.48), six of her cards read its icon (§3.50), and once a phase she plays it
as if from hand for 1 less (§3.49). Limbo, Scrying, Stepping Disc and Illyana's Interrupt choose what is there.

| Card                                     | As read                                                                                                                                           | Needs                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Magik 45030a                             | Play with the top card of your deck faceup. Once per phase, play it as if it was in your hand for 1 less                                          | §3.48, §3.49; Q26, Q27 |
| Illyana Rasputin 45030b                  | Interrupt, once per phase: when you change to hero form, a SPELL from the discard pile onto the deck (it is the faceup card as she arrives)       | §3.60                  |
| Colossus 45031 (ally, cost 3, [wild])    | Toughness. Interrupt: when an enemy attacks you, play him from hand, paying his cost, and declare him the defender without exhausting him         | §3.56, §3.58; Q32      |
| Limbo 45032 (support, cost 1)            | Response after the villain phase begins, or Action: exhaust → swap a card in hand with the top card of the deck                                   | §3.60 (wave 7 §3.57)   |
| Magik's Crown 45033 (cost 2)             | Magik gains steady; +1 THW while the top card has [mental] or [wild]                                                                              | §3.50                  |
| Soulsword 45034 (cost 1, restricted)     | Magik's basic attacks gain piercing; +1 ATK while the top card has [physical] or [wild]                                                           | §3.50                  |
| Mystical Armor 45035 (cost 1)            | Magik gains retaliate 1; +1 DEF while the top card has [energy] or [wild]                                                                         | §3.50                  |
| Scrying 45036 (cost 0)                   | Action: look at the top 3 cards; draw one, discard one, put one back on top                                                                       | §3.60                  |
| Stepping Disc 45037 ×3 (cost 1)          | Hero Action: ready your hero; a Magik card in the discard pile not named Stepping Disc onto the deck                                              | §3.60                  |
| Exorcism 45038 ×2 (cost 2)               | Hero Action (thwart): remove 4 threat; confuse the villain if the top card has [mental] or [wild]                                                 | §3.50                  |
| Soul Strike 45039 ×2 (cost 2)            | Hero Action (attack): 4 damage; stun that enemy if the top card has [physical] or [wild]                                                          | §3.50                  |
| Magic Barrier 45040 ×2 (cost 1)          | Hero Interrupt (defense): prevent 3 damage from the attack; 3 damage to the attacker if the top card has [energy] or [wild]                       | §3.50                  |
| Darkchilde 45053                         | May flip to alter-ego. Exhaust Illyana Rasputin → remove from the game; or 1 damage to each character you control and discard it                  | §3.60                  |
| **Belasco** 45054 (SCH 1★, ATK 1★, 6)    | Villainous. After he activates against you, discard the top 3 cards of your deck; if Ruler of Limbo is in play they attach to it facedown         | §3.57                  |
| Ruler of Limbo 45055 (3 threat, amplify) | No threat removed while Belasco is in play. When Revealed: the Illyana Rasputin player finds Limbo, attached facedown; it returns when defeated   | §3.57, §3.1            |
| S'ym 45056 (SCH 2, ATK 2, 5)             | Guard. When Revealed: 2 threat on Ruler of Limbo if in play, otherwise on the main scheme                                                         | §3.60                  |
| Witchfire 45057 (SCH 1, ATK 3, 4)        | Quickstrike. After she attacks and defeats an ally: 1 threat on Ruler of Limbo; "Otherwise", on the main scheme                                   | §4.1 Q31 = B           |
| Battle for Limbo 45058                   | Each LIMBO minion in play activates against the player it is engaged with; surge if none did. Boost (star): 2 threat on Ruler of Limbo if in play | §3.60                  |

- **"A Magik card"** (Stepping Disc) is a card of her identity-specific set (`identitySetTitled`): the fifteen cards
  45031–45040, not Bloodgem or Basic Spell.
- **Illyana's Interrupt** resolves before the form changes, so the SPELL is put on a facedown deck and is the card
  shown when the hero face turns up. Her SPELL cards are Scrying, Exorcism, Soul Strike, Magic Barrier, Basic Spell
  and Spiritual Meditation.
- **Scrying with fewer than 3 cards:** she looks at what the deck has and resolves as much as it can in the printed
  order: draw one, then discard one, then put one back. Looking does not reset the deck.
- **Battle for Limbo:** an activation is an attack against a hero and a scheme against an alter-ego (RRG "Activation",
  p. 6). A minion whose activation a stunned or confused card replaced did not activate (the owner's reading of
  §4.1 Q4), so if every LIMBO minion was stopped that way the card gains surge. Belasco's activation gets a boost
  card and then his Forced Response.
- **The mission (§3.36).** Her faceup card is the first card her mission attempt discards (§3.48 test 7), and she
  may play an ally from the top of her deck to the mission (§3.49 test 10).
- **Witchfire (§4.1 Q31 = B; "RAW pending FFG clarification").** Built as printed. The Forced Response answers every
  attack of hers: if the attack defeated an ally, 1 threat goes on Ruler of Limbo; "Otherwise" (it hit an identity,
  or the defending ally survived) 1 threat goes on the main scheme. With the main scheme at 2 and Ruler of Limbo at
  3: her attack of 3 on a hero, defended or not, leaves the main scheme at 3 and Ruler of Limbo at 3; an ally with 2
  hit points remaining defends and is defeated: Ruler of Limbo 4, main scheme 2; the same with Ruler of Limbo out of
  play: nothing is placed (the first sentence's condition was met, so "Otherwise" is not reached, and its scheme is
  not there); an attack a stunned card replaced: no attack and no threat. Quickstrike makes the first of these
  happen on the turn she is revealed to a hero. No erratum or ruling says the card was meant to read as S'ym and
  Trevor Fitzroy do; if FFG says so, this script changes. **The script's comment and its test's name both carry
  "RAW pending FFG clarification (Q31)".**

#### The aspect and basic cards

| Card                                                  | As read                                                                                                                                                            | Needs             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| Cable 45011 (Leadership ally, cost 4, [mental])       | THW 2, ATK 3 (two consequential), 3 hit points. Response: after he thwarts and defeats a side scheme, draw 1                                                       | §3.58, §3.60      |
| X-23 45012 (Leadership ally, cost 3, [physical])      | THW 1, ATK 3, 3 hit points. Response: after she attacks and defeats an enemy, ready her                                                                            | §3.58, §3.60      |
| Team Training 45013 ×3                                | reprint of 04016                                                                                                                                                   | reprint           |
| Advanced Suit 45014 ×3 (cost 0)                       | Attach to an X-FORCE or X-MEN ally, max 1 per ally. After the ally defeats a minion or side scheme, discard 1 card → heal 1 per icon                               | §3.52, §3.60      |
| Sidekick 45015 (cost 1)                               | Attach to an identity-specific ally you control. Max 1 per deck. +2 hit points, "your sidekick"; heal 2 from it after a basic recovery                             | §1.32, §3.53      |
| Side-by-Side 45016 ×3 (cost 2)                        | Hero Action: ready your sidekick → ready your hero and heal 1 from both, or both get +1 THW and +1 ATK until the end of the phase                                  | §3.53, §3.54; Q29 |
| Suit Up 45017 ×3 (cost 2)                             | Alter-Ego Action: search deck and discard pile for an ally and an upgrade that can be attached to an ally (erratum)                                                | §3.59; Q30        |
| Lead from the Front 45018 ×3                          | reprint of 01070                                                                                                                                                   | reprint           |
| The Power of Leadership 45019 ×2                      | reprint of 01072                                                                                                                                                   | reprint           |
| Legion 45020 (basic ally, cost 3, [energy])           | THW 1★, ATK 1★, 3 hit points. After he uses a basic power, discard the top card of the deck: [energy] 2 damage, [mental] 2 threat, [physical] heal 2               | §3.60             |
| Marrow 45021 (basic ally, cost 2, [energy])           | THW 1, ATK 2, 2 hit points. Play only if you have the X-FORCE or X-MEN trait. After she enters play, 2 damage to an enemy                                          | §3.60             |
| Energy, Genius, Strength 45022–45024                  | reprints of 01088–01090                                                                                                                                            | reprint           |
| Goldballs 45041 (Aggression ally, cost 3, [physical]) | THW 1, ATK 1★, 3 hit points. Interrupt when he attacks: discard up to 3 cards from the top of the deck → +X ATK for this attack                                    | §3.55             |
| Tempus 45042 (Aggression ally, cost 2, [mental])      | THW 1, ATK 1, 2 hit points. X-MEN identity only. Interrupt: when the villain would scheme, discard her → cancel it; deal yourself 1 facedown encounter card        | §3.60             |
| Blood Rage 45043 ×3 (cost 1)                          | Max 1 per player. After you defeat an enemy with a basic attack, exhaust and take 1 damage → draw 1                                                                | §3.60             |
| Test the Defense 45044 ×3 (cost 1)                    | Max 1 per player. After you play an ATTACK event, 1 test counter; at 5, discard it to deal 5 damage to an enemy                                                    | §3.60             |
| Full-Body Charge 45045 ×3 (cost 4)                    | Hero Action (attack): 8 damage; overkill if remaining hit points are less than half the hero's starting hit points                                                 | §3.60             |
| Clobber 45046 ×3, The Power of Aggression 45047 ×2    | reprints of 18012 and 01055                                                                                                                                        | reprint           |
| Triage 45048 (basic ally, cost 2, [energy])           | THW 1, ATK 1, 2 hit points. After he enters play, heal 2 from an X-MEN character                                                                                   | §3.60             |
| Stepford Cuckoos 45049 (basic support, cost 3)        | X-MEN identity only. Uses (3 psi counters). Interrupt: when a player reveals a treachery, exhaust and spend 1 → cancel and discard it; that player reveals another | §3.60             |
| Bloodgem 45050 (basic upgrade, cost 0)                | MYSTIC identity only. Max 1 per deck. Resource: exhaust and take 2 damage → a [wild]                                                                               | §3.60             |
| Basic Spell 45051 ×3 (cost 2)                         | MYSTIC identity only. Hero Action: heal 3 from an identity, or remove 3 threat from a scheme, or 3 damage to an enemy                                              | §3.60             |
| Spiritual Meditation 45052 ×3                         | reprint of 15019                                                                                                                                                   | reprint           |

- **Cable and X-23 beside wave 7's heroes** are §3.58: the ally's subtitle is the hero's alter-ego title, so they
  match. The matching hero's own deck cannot include the ally, and while that hero is in the game no player can play
  the ally or send it to the mission; it stays a resource card in hand.
- **The allies at the mission (§3.34, §3.36).** Icons from the scans: Malcolm, Randall and Colossus [wild]; Cable and
  Tempus [mental]; X-23 and Goldballs [physical]; Legion, Marrow and Triage [energy]. The "Play only if" lines (Marrow,
  Tempus) are checked before the destination and bar the play to the mission too; in alter-ego form neither Bishop
  nor Magik can send either of those two anywhere. At the mission every one of the ten is blank: no Malcolm ready, no
  Colossus tough card, no Marrow or Triage Response, no Goldballs or Legion star ability, and Tempus cannot be
  discarded for her Interrupt. Their THW and ATK feed the attempt: Cable 2 and 3, X-23 1 and 3, Malcolm 1 and 2,
  Randall 2 and 1, Colossus 2 and 2, Marrow 1 and 2, the other four 1 and 1.
- **Legion.** One line resolves per type the discarded card prints, in the printed order; two icons of one type
  resolve that line once; a [wild] resolves none (RRG "Wild Resource", p. 48); Stored Energy resolves two lines. With
  an empty deck and discard pile nothing is discarded. "Uses a basic power" is his attack or his thwart.
- **Tempus.** A canceled activation did not happen (wave 5 §4.1 Q3): nothing "after the villain schemes" answers,
  no boost card is dealt for it, and in Four Horsemen the active counter does not move (§4.1 Q4). The encounter card
  she deals herself is revealed with her other facedown encounter cards.
- **Stepford Cuckoos.** Any player's treachery, but not one with peril revealed by another player (RRG "Peril",
  p. 32). The canceled treachery was still revealed and goes to the discard pile (RRG "Cancel", p. 11); "another
  encounter card" is revealed from the encounter deck by that player and is not a second dealt card. When the third
  counter is spent the support is discarded (RRG "Uses", p. 46).
- **Full-Body Charge.** "Starting hit points" is the printed value (RRG "Hit Points", p. 22): for Magik fewer than 5
  remaining, for Bishop fewer than 6, whatever raises their maximum.
- **Bloodgem.** A cost of damage is unpaid if any of it is prevented (RRG "Cost", p. 14): with a tough status card
  the resource is not generated and the tough card is gone.
- **Goldballs** must discard at least 1 card to use his Interrupt (RRG p. 14; §3.55).

**Card data fixes** (for `card-data-pipeline`): none in these 58 records. One in earlier packs: the subtitle of
Colossus 32048 / 35021 (§3.58). The checks before emitting are in §5.3.

**Deckbuilding (DoD §4b).**

- Neither identity prints a deckbuilding line. Both starter decks are 40 cards of one aspect and basic cards.
- "Max 1 per deck": Sidekick, Bloodgem, Energy, Genius, Strength. "Max 2 per deck": The Power of Leadership, The
  Power of Aggression.
- "Play only if" lines are play restrictions, not deckbuilding: Marrow, Tempus, Stepford Cuckoos, Bloodgem, Basic
  Spell and Spiritual Meditation may be in any deck that could never play them.
- The unique rule in a deck (§3.58 test 4): Bishop without `gambit` 37011, Magik without `mut_gen` 32042, Cable
  without 45011, X-23 without 45012, Deadpool without 45011.

### 7.2 Pass 2b: Iceman

Read 2026-10-07: every raw record 46001a–46032 with the nested alter-ego face; the scans listed in §0.4; the Iceman
insert (Hall of Heroes' photo, not in the repo); the printed decklist card. **This pass asks for no schema change.**

| Identity                     | Obligation         | Nemesis set (nemesis minion in bold)                                            | Setup, hand size, starter deck                                                                                                        |
| ---------------------------- | ------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Iceman / Bobby Drake (46001) | Hot-Headed (46024) | **Pyro** (46025, quickstrike), Playing with Fire, Pyro's Flamethrower, Burn! ×2 | Six Frostbite set aside before step 1 (permanent). 5 / 6, THW 1 ATK 2 DEF 2, REC 4, 11 hit points. Aggression, 40 cards + 6 set aside |

Traits: Iceman ICE, X-MEN; Bobby Drake MUTANT. The hero has the ICE trait himself, so Team-Building Exercise plays his
ICE cards and any X-MEN card for 1 less. Bobby Drake has neither X-MEN nor ICE: Glob and Shadowcat cannot be played in
alter-ego form. The pack's extra modular set is **Sauron** (`sauron` 46029–46032, "SAURON (n/6)").

#### Iceman: Frostbite

Six permanent upgrades wait in his set-aside area (§3.61). His basic attack and his basic defense each attach one to the
enemy (−1 SCH and −1 ATK), his events attach more, and each goes back when its enemy activates or leaves play. The
Aggression cards of the pack read "an enemy with an upgrade attached" (§3.67), which Frostbite, Frozen Solid and
Suppressing Fire all are.

**The starter deck** (the printed decklist card, §0.4) lists 46 cards: Frostbite ×6, which setup sets aside and the deck
size does not count, and 40 that are shuffled: 15 Iceman (Snow Clone ×2, Power Belt, Cryokinetic Perception, Ice Slide,
Frozen Solid ×2, Ice Wall, Arctic Attack ×2, Ice Blast ×2, Chill Out! ×3), 15 Aggression (Shark-Girl, Glob, Suppressing
Fire ×3, Surprise Move ×3, Take That! ×3, Looking for Trouble ×3, Keep Up the Pressure) and 10 basic (Shadowcat, Beak,
Team-Building Exercise ×3, Recuperation ×3, The Power in All of Us ×2). X-23's starter deck is the shape: 41 entries,
one of them permanent.

| Card                                             | As read                                                                                                                                                         | Needs             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Iceman 46001a, _"Freeze!"_                       | Interrupt: when he makes a basic attack or a basic defense against an enemy, attach a set-aside copy of Frostbite to that enemy                                 | §3.61, §3.70; Q35 |
| Bobby Drake 46001b, _Cool Off_                   | Begins the game with 6 Frostbite set aside. Response: after changing to this form, shuffle 1 ICE card from the discard pile into the deck per Frostbite in play | §3.61, §3.70      |
| Frostbite 46002 ×6 (cost —, no icon)             | Permanent. Attached enemy gets −1 SCH and −1 ATK. Forced Response: after the attached enemy activates or leaves play, set this card aside                       | §3.61; Q35        |
| Snow Clone 46003 ×2 (ally, cost 2, [physical])   | THW —, ATK 2★, 2 hit points. Cannot have upgrades attached. Takes 1 less consequential damage after attacking an enemy with Frostbite attached                  | §3.67; Q38        |
| Power Belt 46004 (cost 2)                        | You get +3 hit points. Hero Resource: exhaust → a [wild] for an ICE card                                                                                        | §3.70             |
| Cryokinetic Perception 46005 (cost 2)            | Hero Response: after you resolve _"Freeze!"_, exhaust → draw 1; if that card has the ICE trait, ready Iceman                                                    | §3.39, §3.70      |
| Ice Slide 46006 (cost 2)                         | Iceman gets +1 THW, +1 ATK and +1 DEF and gains AERIAL. Forced Response: after you change to alter-ego form, shuffle it into your deck                          | §3.70             |
| Frozen Solid 46007 ×2 (cost 3)                   | Hero form only. Attach to an enemy, max 1 per enemy. Forced Interrupt: when it would activate, discard this instead; then attach a set-aside Frostbite          | §3.61, §3.70      |
| Ice Wall 46008 (support, cost 4)                 | Forced Interrupt: damage an identity would take from an enemy attack is placed here instead; at 8 or more, discard it and Frostbite the attacker                | §3.65, §3.61; Q35 |
| Arctic Attack 46009 ×2 (cost 2)                  | Hero Action (attack): 4 damage and a set-aside Frostbite, or 6 damage to an enemy with Frostbite attached                                                       | §3.61, §3.70      |
| Ice Blast 46010 ×2 (cost 3)                      | Hero Action: choose a player; Frostbite the villain and each minion engaged with them; 3 damage to each enemy with a copy attached                              | §3.61, §3.70      |
| Chill Out! 46011 ×3 (cost 2)                     | Hero Action (thwart): remove 3 threat from a scheme; attach a set-aside Frostbite to an enemy                                                                   | §3.61             |
| Hot-Headed 46024                                 | Forced Response: after you attach a Frostbite to an enemy, take 1 damage. Alter-Ego Response: after a basic recovery, discard this card                         | §3.61, §3.70      |
| **Pyro** 46025 (SCH 1, ATK 3★, 4)                | Quickstrike. His attacks deal indirect damage                                                                                                                   | §3.70, §3.68      |
| Playing with Fire 46026 (3 threat, acceleration) | When Defeated: the defeating player discards the top 3 cards of their deck and takes 1 indirect damage per resource icon discarded                              | §3.70             |
| Pyro's Flamethrower 46027 (+0★ ATK)              | Attach to Pyro, otherwise surge. Forced Interrupt: when Pyro attacks you, discard the top card of your deck; +1 ATK for this attack per icon on it              | §3.70             |
| Burn! 46028 ×2 (boost ★)                         | Discard the top 2 cards of your deck (3 with Pyro in play); 1 indirect damage per icon. Boost: discard the top card; +1 boost icon per icon on it               | §3.70             |

- **A turn in numbers.** Iceman attacks the villain (SCH 2, ATK 2): _"Freeze!"_ attaches a copy, Cryokinetic Perception
  draws Arctic Attack (ICE) and readies him, the attack deals 2, he attacks again for 2 with a second copy. In the
  villain phase the villain schemes for 0 or attacks for 0 plus its boost icons, and both copies go back.
- **Hot-Headed** makes every copy cost him 1 damage until he recovers as Bobby Drake. It does not offer the usual flip
  and exhaust. A copy attached by Frozen Solid's or Ice Wall's forced ability is still attached by him.
- **The obligation and the nemesis set are his set** for the permanent rule: no card in them removes a Frostbite, so the
  question does not arise.
- **Pyro's attack** is divided by the attacked player among the characters they control (RRG p. 24); Frostbite lowers it
  first, and the part assigned to an identity goes to Ice Wall (§3.65 test 6). His Flamethrower's discard and Burn!'s
  are ordinary deck discards (§3.70).
- **The mission (§3.36, §3.38).** None of his cards reads or discards the top of a deck; his nemesis set does, and those
  discards are not a mission attempt's. Frostbite cannot be attached to an enemy in the mission area (§3.33).

#### The pack's Aggression and basic cards

| Card                                                    | As read                                                                                                                                              | Needs        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Shark-Girl 46012 (Aggression ally, cost 2, [energy])    | THW 0, ATK 2★, 2 hit points. While attacking an enemy she gets +1 ATK per upgrade attached to it                                                     | §3.67        |
| Glob 46013 (Aggression ally, cost 3, [energy])          | THW 2 (two consequential), ATK 2, 3 hit points. X-MEN identity only. Response: after he enters play, 2 damage to an enemy with an upgrade attached   | §3.67        |
| Suppressing Fire 46014 ×3 (cost 0)                      | Attach to a minion, max 1 per minion. Hero Interrupt: when you attack and defeat it, heal 2 from your hero                                           | §3.67        |
| Surprise Move 46015 ×3 (cost 1)                         | Hero Interrupt: on your basic attack against an enemy with an upgrade attached, +2 ATK; if the attack defeats it, ready your hero                    | §3.67        |
| Take That! 46016 ×3 (cost 3)                            | Hero Action (attack): 7 damage to an enemy with an upgrade attached                                                                                  | §3.67        |
| Looking for Trouble 46017 ×3                            | reprint of 16043                                                                                                                                     | reprint      |
| Keep Up the Pressure 46018 (player side scheme, cost 0) | 2 threat per player. Victory 0. When Defeated: each player may search deck and discard pile for an ATTACK event; ATTACK events deal +1 this phase    | §3.70        |
| Shadowcat 46019 (basic ally, cost 3, [mental])          | THW 2, ATK 1, 3 hit points. X-MEN identity only. Response after you play her from hand: choose a side scheme → it loses its icons until end of round | §3.68, §3.70 |
| Beak 46020 (basic ally, cost 2, [energy])               | THW 1, ATK 1, 2 hit points. Response after you play him from hand: remove 1 threat from a scheme per X-MEN ally you control                          | §3.70        |
| Team-Building Exercise 46021 ×3, Recuperation 46022 ×3  | reprints of 12024 and 15031                                                                                                                          | reprint      |
| The Power in All of Us 46023 ×2                         | reprint of 13024                                                                                                                                     | reprint      |

- **The allies at the mission (§3.34, §3.36).** Icons from the scans: Snow Clone [physical]; Shark-Girl, Glob and Beak
  [energy]; Shadowcat [mental]. Glob's and Shadowcat's "Play only if" lines bar the play to the mission too. There every
  one is blank: no Shark-Girl bonus, no Glob, Shadowcat or Beak Response (Beak's and Shadowcat's "after you play … from
  your hand" would otherwise answer a play to the mission), and Snow Clone's "Cannot have upgrades attached" is gone, so
  Desperate Measures can go on it. THW and ATK for the attempt: Snow Clone a dash (0) and 2, Shark-Girl 0 and 2, Glob 2
  and 2, Shadowcat 2 and 1, Beak 1 and 1.
- **Shadowcat beside the Shadowcat hero, or in a Colossus deck,** is §3.68.
- **Ally upgrades (§3.59, Q30).** No upgrade of this pack can be attached to an ally: Frostbite and Frozen Solid go on
  enemies, Suppressing Fire on a minion, the rest on nothing. Suit Up offers none of them. An ally under "Lost" Child is
  a minion, and Suppressing Fire's printed host is still not "an ally" for Suit Up.
- **Keep Up the Pressure** is checked against wave 7 §3.1 and §3.2 and needs nothing new: played on its owner's turn for
  0, 2 threat per player who started, thwarted like a side scheme, one in play in a game of one or two players, Victory
  0 to the victory display. Its lasting +1 is §3.70.

#### Sauron (the pack's modular set)

| Card                                    | As read                                                                                                                                                                                                                       | Needs |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Sauron 46029 (SCH 2, ATK 2, 6; boost ★) | When Revealed: search the encounter deck and discard pile for Life Drain and reveal it. Boost: heal 3 from the activating enemy and give it a tough status card                                                               | §3.70 |
| Sauron Lives! 46030 (3 threat, crisis)  | When Defeated: the defeating player searches the encounter deck and discard pile for Sauron and deals him to themself as a facedown encounter card                                                                            | §3.70 |
| Life Drain 46031 (ATK ★)                | Attach to the minion with the highest printed hit points; it activates against you; surge if none did. Forced Interrupt: when it attacks you, take 2 damage and give it a tough status card                                   | §3.70 |
| The Eye of Sauron 46032 ×3              | Discard the top 2 cards of your deck (3 with Sauron in play). Per icon: [energy] 1 threat on the main scheme, [mental] discard 1 card from hand, [physical] 1 damage to your identity, [wild] exhaust a character you control | §3.70 |

- Six cards with no scenario of their own: offered as a modular set wherever one is chosen (DoD §5). Sauron Lives! found
  with Sauron already in play or in the victory display finds nothing.
- Life Drain's host is chosen among every minion in play, Sauron included when his own When Revealed finds it (6 printed
  hit points).

**Card data fixes** (for `card-data-pipeline`): Cryokinetic Perception's text ("the ICE trait", scan 46005); the starter
deck (above); the curation's header comment, which still says the starter deck is not curated and calls
`auxiliaryHeroSetCodes` Storm's Weather mechanism (the alias is right; the Weather deck's `separateDecks` is not used
here). Nothing else: Frostbite's record is right as emitted. The checks are in §5.4.

**Deckbuilding (DoD §4b).**

- Bobby Drake prints no deckbuilding line. A legal Iceman deck lists Frostbite ×6 and 40 to 50 other cards; the builder
  starts a new deck with the six already in it and shows them as set aside, not counted.
- "Max 2 per deck": The Power in All of Us. "Max 1 per enemy" and "Max 1 per minion" are play restrictions.
- "Play only if" lines are play restrictions: Glob and Shadowcat may be in any deck.
- The unique rule in a deck (§3.68 test 1): Iceman without `rogue` 38010; Shadowcat and Colossus without 46019.

### 7.3 Pass 2b: Jubilee

Read 2026-10-07: every raw record 47001a–47034 with the nested alter-ego face; the scans listed in §0.4; the Jubilee
insert (Hall of Heroes' photo, not in the repo); the printed decklist card and `curation/jubilee.ts` (the starter deck
and the Grand Finale title are in). **This pass asks for no schema change.**

| Identity                         | Obligation       | Nemesis set (nemesis minion in bold)                                         | Setup, hand size, starter deck                                             |
| -------------------------------- | ---------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Jubilee / Jubilation Lee (47001) | Grounded (47023) | **Nanny** (47024, toughness), Naughty Children, Battle Suit, "Lost" Child ×2 | No Setup. 5 / 6, THW 1 ATK 1 DEF 2, REC 3, 9 hit points. Justice, 40 cards |

Traits: Jubilee X-MEN; Jubilation Lee MUTANT. Each "Play only if your identity has" line reads the face that is up:
Synch cannot be played in alter-ego form and X-Gene cannot be played in hero form (once in play its Resource works in
either). The pack's extra modular set is **Arcade** (`arcade` 47030–47034, "ARCADE (n/5)"). Mutant Mayhem (47028,
Leadership) and Serve and Protect (47029, Protection) are in the pack and not in the starter deck.

#### Jubilee: different resource types

Her events read how many different resource types paid for them (§3.62). Her hero face makes a [wild], her three
resource cards print two different icons each, and her signature events come in three versions so that the cards she
discards pay in different types (§3.69). As Jubilation Lee she fetches Shopping Spree and works it off in alter-ego form
for an ITEM (§3.66).

| Card                                                            | As read                                                                                                                                                      | Needs           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| Jubilee 47001a, _"Like, totally!"_                              | Resource: exhaust Jubilee → generate a [wild]                                                                                                                | §3.70, §3.62    |
| Jubilation Lee 47001b, _Mall Rat_                               | Action, once per phase: search your deck for Shopping Spree and put it into play                                                                             | §3.66           |
| Wolverine 47002 (ally, cost 4, [wild])                          | THW 1, ATK 3★ (two consequential), 4 hit points. His attacks gain piercing. Response: after you change to alter-ego form, heal 3 from him                    | §3.68, §3.70    |
| Shopping Spree 47003 (player side scheme, cost 0)               | 2 threat. No threat removed by heroes or allies. Alter-Ego Action, any player: exhaust your identity → remove 1. When Defeated: an ITEM into play            | §3.66; Q36      |
| Jubilee's Coat 47004 (cost 2)                                   | +1 THW. Hero Response (thwart): after you play a THWART event, exhaust and choose a scheme → remove 1 threat per type that paid for the event                | §3.62; Q33, Q34 |
| Jubilee's Sunglasses 47005 (cost 2)                             | +1 ATK. Hero Response (attack): after you play an ATTACK event, exhaust and choose an enemy → 1 damage per type that paid for the event                      | §3.62; Q33, Q34 |
| Blinding Flash 47006 (cost 3)                                   | Hero Action: choose X enemies, X the number of types that paid; stun and confuse each                                                                        | §3.62; Q33, Q34 |
| Firecracker 47007a/b/c (cost 2; [energy], [mental], [physical]) | Hero Action (attack): 4 damage to an enemy; stun it if 2 different types paid                                                                                | §3.62, §3.69    |
| Flash of Light 47008a/b/c (cost 2; the same three icons)        | Hero Action (thwart): remove 3 threat from a scheme; confuse an enemy if 2 different types paid                                                              | §3.62, §3.69    |
| Grand Finale 47009 (cost 3)                                     | Hero Action (attack): 2 damage to an enemy; per type that paid, choose an enemy and deal 2                                                                   | §3.62; Q33, Q34 |
| Plasmoid Energy 47010a/b/c                                      | A resource card with two icons and no text: [energy][mental], [energy][physical], [mental][physical]                                                         | §3.69, data     |
| Grounded 47023                                                  | To change to hero form during your turn, also spend 2 resources of one type. When Revealed: change to alter-ego form. Removed after you play a Jubilee event | §3.63; Q37      |
| **Nanny** 47024 (SCH 2, ATK 1★, 4)                              | Toughness. Forced Response: after she attacks you, if you control an ally, search for a copy of "Lost" Child and reveal it                                   | §3.70           |
| Naughty Children 47025 (2 threat, crisis)                       | When Revealed: 1 threat here per different resource type on cards in your hand                                                                               | §3.70           |
| Battle Suit 47026 (+1 ATK)                                      | Attach to the minion with the fewest remaining hit points, otherwise surge. +3 hit points and AERIAL                                                         | §3.70           |
| "Lost" Child 47027 ×2 (−1 SCH)                                  | The ally with the highest cost becomes a REGRESSED minion with a blank text box, SCH from its printed THW, engaged with its controller; otherwise surge      | §3.70           |

- **The three versions** are one card each under three records; the decision is §3.69. Each is in her deck once.
- **A payment in numbers.** Grand Finale (cost 3) paid with Plasmoid Energy 47010a and Flash of Light 47008c: three
  types, 8 damage. Flash of Light (cost 2) paid with _"Like, totally!"_ and Strength ([physical]): she declares the
  wild (Q33 = B). [energy], [mental] or left [wild]: two types, 3 threat removed, an enemy confused, and the Coat
  removes 2 more. [physical]: one type, 3 removed, nobody confused, and the Coat removes 1.
- **_"Like, totally!"_** is on the hero face: she exhausts, so she cannot also thwart, attack or defend with that
  exhaust. It cannot pay Grounded's cost (alter-ego form).
- **Wolverine** is hers and matches the Wolverine hero (§3.68). His heal is a Response of his own and resolves beside
  the form change's other responses; Grounded's forced change to alter-ego form triggers it.
- **Shopping Spree and Generation X** share the limit of one player side scheme in a game of one or two players (wave 7
  §3.2): _Mall Rat_ beside Generation X makes the first player discard one.
- **Naughty Children** counts printed types across her hand, a wild as its own type: a hand of 47010a, 47007c and The
  Power of Justice is 4.
- **"Lost" Child** on Wolverine: a REGRESSED minion with SCH 0 (THW 1 less 1) and ATK 3, engaged with her, blank, with
  no consequential damage and no piercing. Defeated, the ally goes to its owner's discard pile.
- **The mission (§3.36, §3.38).** None of her cards reads or discards the top of a deck. Her allies' icons are in the
  next list.

#### The pack's Justice, basic and off-aspect cards

| Card                                            | As read                                                                                                                                                   | Needs           |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Chamber 47011 (Justice ally, cost 4, [energy])  | THW 2, ATK 2★, 3 hit points. Takes 1 less consequential damage after he attacks a confused enemy                                                          | §3.67; Q38      |
| Husk 47012 (Justice ally, cost 4, [physical])   | THW 2★, ATK 2★, 3 hit points. Interrupt on her basic power: spend up to 3 resources → [energy] +1 to it, [mental] heal 1 from her, [physical] ready after | §3.62; Q33      |
| Disguise 47013 ×3 (cost 1)                      | Play under any player's control, max 1 per player. Action (thwart): exhaust it and your identity → remove 2 threat from a scheme                          | §3.70, §3.66    |
| Waylay 47014 ×3 (cost 3)                        | Hero Response (attack): after your hero thwarts, 4 damage to an enemy; 7 if that thwart removed the last threat from a scheme                             | §3.70           |
| Three Steps Ahead 47015 ×3 (cost 3)             | Hero Action (thwart): per type that paid, choose a scheme and remove 2 threat                                                                             | §3.62; Q33, Q34 |
| Generation X 47016 (player side scheme, cost 0) | 3 threat per player. Victory 0. X-MEN characters get +1 THW on a basic thwart against it. When Defeated: each player may fetch an identity-specific event | §3.70           |
| The Power of Justice 47017 ×2                   | reprint of 01062                                                                                                                                          | reprint         |
| Synch 47018 (basic ally, cost 3, [energy])      | THW 1, ATK 1, 3 hit points. X-MEN identity only. Interrupt: when you use a basic power, exhaust him → +1 to that power for this use                       | §3.70           |
| Cell Phone 47019 ×3 (cost 2)                    | Uses (3 charge counters). Action: exhaust, spend 1 and choose a player → they make a basic attack or thwart with a character, at +1 THW and +1 ATK        | §3.64           |
| X-Gene 47020 ×3                                 | reprint of 38019                                                                                                                                          | reprint         |
| Multitalented 47021 ×3 (cost 3)                 | Hero Action (attack/thwart): if paid with at least 1 [physical], 2 damage; [mental], remove 2 threat; [energy], heal 2 from your identity                 | §3.62; Q33      |
| Unlikely Duo 47022 (cost 2)                     | Team-Up (Jubilee and Wolverine). Max 1 per deck. Hero Action (attack): confuse an enemy; 4 damage to a confused enemy                                     | §3.68           |
| Mutant Mayhem 47028 ×3 (Leadership, cost 3)     | Alliance. Hero Action: return an X-FORCE ally and an X-MEN ally to their owners' hands → those players play them for nothing                              | §3.70           |
| Serve and Protect 47029 ×3 (Protection, cost 2) | Alliance. Hero Interrupt: when threat would be placed on the main scheme, exhaust an X-FORCE and an X-MEN character → prevent it; a tough card each       | §3.70; Q40      |

- **The allies at the mission (§3.34, §3.36).** Icons from the scans: Wolverine [wild]; Chamber and Synch [energy]; Husk
  [physical]. Synch's "Play only if" line bars the play to the mission too. There each is blank: no piercing and no heal
  for Wolverine, no Husk Interrupt, no Synch, Chamber takes his full consequential damage (none is dealt there anyway:
  an attempt deals 1 to each ally). THW and ATK for the attempt: Wolverine 1 and 3, Chamber 2 and 2, Husk 2 and 2, Synch
  1 and 1.
- **Ally upgrades (§3.59, Q30).** No upgrade of this pack prints an "attach to": Disguise is played under a player's
  control, the rest are their controller's. Suit Up offers none of them.
- **Unlikely Duo** is the wave's one Team-Up card (`docs/team-ups.md`, pair folder `jubilee-wolverine`). One copy is in
  her starter deck; the pack's second is for a Wolverine deck (§3.68). The confused enemy that takes the damage is the
  attack's target and obeys guard; the enemy that is confused need not be the same one.
- **Disguise in alter-ego form** is a thwart by an identity that is not a hero, which is what lets it work on Shopping
  Spree (§3.66 test 4). It is still a thwart: a confused identity loses the confused card instead.
- **Waylay after Flash of Light:** the event is a thwart by her hero, so Waylay answers it; if Flash of Light took the
  last threat off a scheme, 7 damage.
- **Generation X** is checked against wave 7 §3.1 and §3.2 and needs nothing new. "An identity-specific event" is an
  event of the searching player's own identity set (any player's deck holds only its own).
- **Mutant Mayhem and Serve and Protect** need an X-FORCE card and an X-MEN card in play; the alliance keyword lets the
  other players pay toward them (RRG p. 6). Neither is in a starter deck of the wave.

#### Arcade (the pack's modular set)

| Card                                            | As read                                                                                                                                              | Needs |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Arcade 47030 (SCH 2, ATK 2, 3)                  | Cannot take damage while a TRAP! side scheme is in play. When Revealed: discard from the encounter deck until a TRAP! side scheme; reveal it         | §3.70 |
| Welcome to Murderworld 47031 (2 threat, hazard) | Hinder 1 per player. When Defeated: the defeating player takes 2 damage                                                                              | §3.70 |
| Arcade's Funhouse 47032 (2 threat, amplify)     | Hinder 1 per player. When Defeated: the defeating player is stunned; already stunned, they discard an ally or upgrade they control                   | §3.70 |
| Hall of Mirrors 47033 (2 threat, crisis)        | Hinder 1 per player. When Defeated: the defeating player is confused; already confused, 2 threat on the main scheme                                  | §3.70 |
| Elaborate Trap 47034                            | Resolve the When Defeated ability of each TRAP! side scheme as if you defeated it; if none resolved, discard until a TRAP! side scheme and reveal it | §3.70 |

- Five cards, offered as a modular set wherever one is chosen (DoD §5). Each TRAP! scheme enters play with 2 + 1 per
  player threat.
- "The player who defeated this side scheme" is the player whose effect removed the last threat (`defeatingPlayer`, as
  every earlier When Defeated reads it). Under Elaborate Trap it is the revealing player.
- A permanent upgrade (a Frostbite, a Psi-Knife) is not a legal pick for Arcade's Funhouse's discard (RRG p. 32).

**Card data fixes** (for `card-data-pipeline`): none in the card records. A `cardNotes` line on each of the nine version
records (§3.69); an ability id for Grounded's constant line, which the emitted record does not carry (its three ids are
the obligation, the When Revealed and the Response); the insert's victory sentence noted on Shopping Spree (§0.4).
Unlikely Duo stays `quantityInSet: 2`, `deckLimit: 1`, one copy in the starter deck. The checks are in §5.4.

**Deckbuilding (DoD §4b).**

- Jubilation Lee prints no deckbuilding line. Her starter deck is 40 cards: 15 Jubilee (the nine version records among
  them), 14 Justice, 11 basic.
- "Max 1 per deck": Unlikely Duo. "Max 2 per deck": The Power of Justice. "Max 1 per player" (Disguise, X-Gene) is a
  play restriction.
- Team-Up: Unlikely Duo only in a Jubilee or a Wolverine deck.
- "Play only if" lines are play restrictions: Synch and X-Gene may be in any deck.
- The three versions (§3.69 tests 1 to 4) and the unique rule (§3.68 test 1: Jubilee without `mut_gen` 32041).

### 7.4 Pass 2c: Nightcrawler

Read 2026-10-07: every raw record 48001a–48038 with the nested alter-ego face; the scans listed in §0.5; the
Nightcrawler insert (Hall of Heroes' photo, not in the repo); the printed decklist card and `curation/ncrawler.ts` (the
starter deck and the two errata are in). **This pass asks for no schema change.**

| Identity                           | Obligation              | Nemesis set (nemesis minion in bold)                                                      | Setup, hand size, starter deck                                                |
| ---------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Nightcrawler / Kurt Wagner (48001) | Crisis of Faith (48026) | **Azazel** (48027, quickstrike), Brimstone Dimension, Azazel's Sword, Brimstone Strike ×2 | No Setup. 5 / 6, THW 2 ATK 1 DEF 3, REC 3, 9 hit points. Protection, 40 cards |

Traits: Nightcrawler X-MEN; Kurt Wagner MUTANT. Kurt Wagner has no X-MEN trait: Astonishing X-Men's Response does not
count a defense of his (he cannot defend in that form anyway), and X-MEN-only cards of other packs cannot be played in
alter-ego form. The pack's extra modular set is **The Crazy Gang** (`crazy_gang` 48033–48038, "CRAZY GANG (n/6)").
Combine Forces (48031, Aggression) and Gunboat Diplomacy (48032, Justice) are in the pack and not in the starter deck.

#### Nightcrawler: Bamf!

Three copies of a 0-cost upgrade go on enemies (§3.72). When that enemy attacks, anyone, he discards the copy and is the
defender without exhausting, at DEF 3; Tally Ho! brings the copy back and hits the attacker, _Rapid Teleportation_ buys
one back each phase, Kurt Wagner searches one out each round, and his events spend copies on enemies or in hand. Kurt's
Cutlasses fill his restricted limit by themselves (§3.73).

| Card                                         | As read                                                                                                                                                                              | Needs             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| Nightcrawler 48001a, _Rapid Teleportation_   | Action, once per phase: spend 1 resource of any type → return a copy of Bamf! from your discard pile to your hand                                                                    | §3.72             |
| Kurt Wagner 48001b                           | Action, once per round: search your deck for a copy of Bamf! and add it to your hand                                                                                                 | §3.72             |
| Daytripper 48002 (ally, cost 2, [wild])      | THW 2, ATK 2, 2 hit points. Response: after she enters play, search deck and discard pile for a copy of Bamf! and attach it to an enemy; 1 damage to each enemy with a copy attached | §3.72             |
| Kurt's Chapel 48003 (support, cost 1)        | Kurt Wagner gets +1 REC. Alter-Ego Response: after a basic recovery, exhaust it and choose a player → that player draws 1                                                            | §3.81             |
| Kurt's Cutlasses 48004 (cost 2)              | Counts as 2 restricted cards. Nightcrawler gets +1 ATK, +1 DEF and retaliate 1                                                                                                       | §3.73; data       |
| Prehensile Tail 48005 (cost 1)               | You can control 1 additional upgrade that has the restricted keyword. Resource: exhaust → a [wild] for an event                                                                      | §3.73             |
| Bamf! 48006 ×3 (upgrade, cost 0)             | Attach to an enemy, max 1 per enemy. Hero Interrupt (defense): when the attached enemy attacks, discard this card → declare Nightcrawler the defender without exhausting him         | §3.72, §3.39      |
| 'Port and Punch 48007 ×2 (cost 2)            | Hero Action (attack): 3 damage to an enemy; 3 damage to each enemy with Bamf! attached                                                                                               | §3.72             |
| Teleport Drop 48008 (cost 2)                 | Hero Action (attack): discard a copy of Bamf! from an enemy → 8 damage to that enemy and stun it                                                                                     | §3.72             |
| Scout Ahead 48009 ×2 (cost 1)                | Hero Action (thwart): remove 3 threat from a scheme; you may discard a copy of Bamf! from hand to remove 3 from another scheme                                                       | §3.72             |
| 'Port Away 48010 (cost 0)                    | Action: discard a copy of Bamf! from hand → change forms and ready your identity                                                                                                     | §3.72             |
| Tally Ho! 48011 ×2 (cost 1)                  | Hero Response (defense): after Bamf! makes Nightcrawler the defender of an attack, return that copy to hand; 3 damage to the attacking enemy                                         | §3.72, §3.39      |
| Crisis of Faith 48026                        | May flip to alter-ego. Exhaust Kurt Wagner → remove from the game; or discard each ATTACK and DEFENSE event from hand and discard it                                                 | §3.81             |
| **Azazel** 48027 (SCH 2, ATK 3, 3; boost ★)  | Quickstrike. Cannot have upgrades attached. Boost: deal Azazel to the Kurt Wagner player as a facedown encounter card                                                                | §3.81, §3.72      |
| Brimstone Dimension 48028 (5 threat, hazard) | When Defeated: the defeating player finds Azazel and deals him to themself as a facedown encounter card                                                                              | §3.75, §3.1; data |
| Azazel's Sword 48029 (+1★ ATK)               | Attach to Azazel, otherwise to the villain. Its attacks gain piercing. Hero Response: after it attacks you, discard 1 random card from hand → discard this card                      | §3.81, §3.77      |
| Brimstone Strike 48030 ×2                    | When Revealed (Alter-Ego): find Azazel and reveal him; he schemes. When Revealed (Hero): find Azazel and reveal him                                                                  | §3.1, §3.81       |

- **A villain phase in numbers.** Bamf! is on the villain (ATK 2) and on a minion (ATK 2, 3 hit points). The villain
  attacks: the copy is discarded, he defends ready at DEF 3, the boost card has 1 icon: 0 damage. He pays 1 for _Rapid
  Teleportation_ and has that copy in hand. The minion attacks: Bamf!, then Tally Ho! for 1: the copy is back in hand,
  the minion takes 3 and is defeated before its damage, and Change of Fortune, if he controls one, draws 2.
- **The starter deck's ready hero.** He never exhausts to defend through Bamf!, so his one exhaust each round is a
  thwart for 2 or an attack for 1.
- **Azazel** cannot carry Bamf! (or any other upgrade: no Under Control, no Wrapped in Metal, no Frostbite), has
  quickstrike, and comes back: his Boost deals him to the Kurt Wagner player whoever is being attacked, and Brimstone
  Dimension deals him to whoever defeats it, from play if he is there (§3.75).
- **Azazel's Sword** makes the attached enemy's attacks piercing, so a tough status card does not save the defender; any
  player it attacks may pay a random card to discard it, and Electromagnetic Blast can take it (§3.77).
- **Crisis of Faith** takes Tally Ho!, 'Port and Punch, Teleport Drop, Riposte and Powerful Punch out of his hand; Scout
  Ahead (THWART) and 'Port Away stay.
- **The mission (§3.36, §3.38).** None of his cards reads or discards the top of a deck. Bamf! cannot go on an enemy in
  the mission area (§3.33). His allies' icons are in the next list.

#### The pack's Protection, basic and off-aspect cards

| Card                                                 | As read                                                                                                                                                                                | Needs             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Rogue 48012 (Protection ally, cost 4, [physical])    | THW 2, ATK 2, 3 hit points. Action, once per round: deal 1 damage to another friendly character → to the end of the round she gains its traits and adds its base THW and ATK (erratum) | §3.74, §3.80; Q43 |
| Northstar 48013 (Protection ally, cost 3, [energy])  | THW 1, ATK 2, 3 hit points. Interrupt: when a boost card is turned faceup during an attack, deal 1 damage to him → cancel all boost icons on it                                        | §3.81             |
| Change of Fortune 48014 ×3 (cost 1)                  | Play under any player's control, max 1 per player. Response: after you defeat an enemy during the villain phase, exhaust → draw 2                                                      | §3.81             |
| Under Control 48015 ×3 (cost 0)                      | Attach to a minion, max 1 per minion. Response: after a hero defends against its attack and takes no damage, 4 damage to it                                                            | §3.81, §3.67      |
| "Come Get Me, Bub!" 48016 ×3 (cost 0)                | Hero Action: discard from the encounter deck until a minion and put it into play engaged with you → heal 3 from your identity and give it a tough status card                          | §3.81             |
| Powerful Punch 48017 ×3                              | reprint of 32014 (RRG FAQ p. 63; ruling July 9, 2026 – Ruling 1)                                                                                                                       | reprint           |
| Riposte 48018 ×3 (cost 1)                            | Hero Interrupt (defense): when your hero defends, +2 DEF for that attack; if you take no damage from it, 3 damage to the attacker                                                      | §3.81             |
| The Power of Protection 48019 ×2                     | reprint of 01079                                                                                                                                                                       | reprint           |
| Astonishing X-Men 48020 (player side scheme, cost 1) | 5 threat. Victory 0. Response: after an X-MEN character defends an enemy attack and takes no damage, remove 1 threat from it. When Defeated: stun and confuse each enemy               | §3.81             |
| Gambit 48021 (basic ally, cost 3, [energy])          | THW X, ATK X, 3 hit points; X is the boost icons on the card under him. Response: after he enters play, look at the top 3 encounter cards and tuck one under him                       | §3.74, §3.80      |
| Moira MacTaggert 48022                               | reprint of 38018                                                                                                                                                                       | reprint           |
| Energy, Genius, Strength 48023–48025                 | reprints of 01088–01090                                                                                                                                                                | reprint           |
| Combine Forces 48031 ×3 (Aggression, cost 1)         | Alliance. Hero Action: exhaust an X-FORCE character and an X-MEN character → defeat a non-ELITE minion                                                                                 | §3.81; Q40        |
| Gunboat Diplomacy 48032 ×3 (Justice, cost 1)         | Alliance. Hero Action (attack/thwart): the same cost → remove X threat among schemes and deal X damage among enemies, X the two characters' combined THW                               | §3.81; Q40        |

- **The allies at the mission (§3.34, §3.36).** Icons from the scans: Daytripper [wild]; Rogue [physical]; Northstar and
  Gambit [energy]. None prints a "Play only if" line. There each is blank: no Daytripper Response (a play to the mission
  attaches no Bamf!), no Rogue Action, no Northstar Interrupt, and Gambit tucks nothing, so his X is 0 (RRG p. 30). THW
  and ATK for the attempt: Daytripper 2 and 2, Rogue 2 and 2, Northstar 1 and 2, Gambit 0 and 0.
- **Rogue and Gambit beside the Rogue and Gambit heroes**, and in each other's decks, are §3.80.
- **Ally upgrades (§3.59, Q30).** No upgrade of this pack can be attached to an ally: Bamf! goes on an enemy, Under
  Control on a minion, Change of Fortune under a player's control, the rest are their controller's. Suit Up offers none
  of them.
- **Astonishing X-Men** is checked against wave 7 §3.1, §3.2 and §3.66 and needs nothing new: played on its owner's turn
  for 1, a flat 5 threat, thwarted like a side scheme by anyone, unique, one in play in a game of one or two players,
  Victory 0 to the victory display. Its Response is what the starter deck works it with: every Bamf! defense at DEF 3
  that takes nothing removes 1.
- **Under Control with Bamf!:** both may be on one minion (different titles); a Bamf! defense that takes no damage deals
  the minion 4.
- **Combine Forces and Gunboat Diplomacy** need an X-FORCE character; the starter deck has none, and the alliance
  keyword lets another player exhaust theirs (RRG p. 6).

#### The Crazy Gang (the pack's modular set)

| Card                                                     | As read                                                                                                                                                                      | Needs       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| The Crazy Gang 48033 (2 threat per player, acceleration) | Forced Response: after a non-ELITE minion schemes against a player, deal it to that player as a facedown encounter card; with more than 1 player, pass it to the next player | §3.75; data |
| Queen of Hearts 48034 (SCH 0, ATK 1, 4)                  | When Revealed: search the encounter deck and discard pile for The Crazy Gang and reveal it; if it is already in play, deal yourself a facedown encounter card                | §3.81       |
| Jester 48035 (SCH 0, ATK 1, 5)                           | When Revealed: you are confused; if you already were, discard a support you control                                                                                          | §3.81       |
| Executioner 48036 (SCH 0, ATK 2, 4)                      | When Revealed: he attacks the friendly character with the fewest remaining hit points; an ally this attack defeats is removed from the game                                  | §3.81       |
| Tweedledope 48037 (SCH 0, ATK 2, 6)                      | When Revealed: you are stunned; if you already were, discard an upgrade you control (erratum: no star in the boost field)                                                    | §3.81; Q44  |
| "Off with His Head!" 48038                               | When Revealed: each minion activates against the player it is engaged with; if none did, discard from the encounter deck until a minion and reveal it                        | §3.81       |

- Six cards with no scenario of their own: offered as a modular set wherever one is chosen (DoD §5). The four minions
  are unique and print SCH 0: against an alter-ego they scheme for nothing, and with the side scheme in play each scheme
  sends them round to be revealed again, healed, with their When Revealed.
- The side scheme's acceleration icon adds 1 threat to the main scheme each round while it is in play.
- A permanent upgrade (a Frostbite, a Psi-Knife) is not a legal pick for Tweedledope's discard (RRG p. 32).
- Jester matches the unique minion of that title in a later wave's pack (§3.80).

**Card data fixes** (for `card-data-pipeline`): the regeneration of Kurt's Cutlasses 48004 with `restrictedWeight: 2`
(§3.73); the hazard icon on Brimstone Dimension 48028; the per player starting threat of The Crazy Gang 48033;
Tweedledope 48037's boost icons (Q44 = B: 1 icon, as emitted; only the `Errata` note is rewritten); the curation's header comment. The two errata and the starter deck are
right as curated. The checks are in §5.5.

**Deckbuilding (DoD §4b).**

- Kurt Wagner prints no deckbuilding line. His starter deck is 40 cards: 15 Nightcrawler, 20 Protection, 5 basic.
- "Max 1 per deck": Energy, Genius, Strength. "Max 2 per deck": The Power of Protection. "Max 1 per enemy", "Max 1 per
  minion" and "Max 1 per player" (Bamf!, Under Control, Change of Fortune) are play restrictions.
- The Cutlasses' weight and the Tail's allowance are rules of play, not deckbuilding: a deck may hold any number of
  restricted cards.
- "Play only if" lines are play restrictions: Moira MacTaggert may be in any deck.
- The unique rule in a deck (§3.80 test 1): Nightcrawler without `mut_gen` 32011; Rogue and Gambit without 48012
  or 48021.

### 7.5 Pass 2c: Magneto

Read 2026-10-07: every raw record 49001a–49042 with the nested alter-ego face; the scans listed in §0.5; the Magneto
insert (Hall of Heroes' photo, not in the repo); the printed decklist card and `curation/magneto.ts` (the starter deck
and the three errata are in). **This pass asks for no schema change.**

| Identity                         | Obligation             | Nemesis set (nemesis minion in bold)                                                                        | Setup, hand size, starter deck                                                                                                               |
| -------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Magneto / Erik Lehnsherr (49001) | Old Grievances (49027) | **Exodus** (49028, steady, toughness, villainous), Martyr for Mutants, Fabian Cortez, Frenzy, Angry Acolyte | No Setup; the four NEW allies set aside if his deck holds New Recruits. 5 / 6, THW 2 ATK 2 DEF 2, REC 3, 10 hit points. Leadership, 40 cards |

Traits: Magneto X-MEN; Erik Lehnsherr MUTANT. Erik Lehnsherr has no X-MEN trait: New Recruits and White Queen need the
hero face (Won't Stay Down and White Queen also take X-FORCE), and Moira MacTaggert and the NEW allies' bonus hold on
both faces (MUTANT or X-MEN). The nemesis set has three minions and Exodus prints "(Magneto's nemesis minion.)" (RRG p.
30). The pack's extra modular set is the **Hellfire Club** (`hellfire` 49038–49042, "HELLFIRE (n/5)"). The four linked
allies (49033–49036) and Children of the Atom (49037, ×3) are in the pack and not in the starter deck's list; the allies
are never in any deck.

#### Magneto: Magnetic Pull

Once a round he discards from the top of his deck until a MAGNETIC card and takes it (§3.71): every card of his kit is
one. The Armor turns the icons discarded into +1 THW, ATK or DEF for the round, the Cape readies him, and Erik Lehnsherr
and Asteroid M shuffle the discards back. His obligation charges 1 damage a card, and his nemesis set empties the same
deck.

| Card                                                    | As read                                                                                                                                                                    | Needs           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Magneto 49001a, _Magnetic Pull_                         | Action, once per round: discard from the top of your deck until a MAGNETIC card is discarded → add that card to your hand                                                  | §3.71; Q41, Q42 |
| Erik Lehnsherr 49001b, _Survivor_                       | Response: after changing to this form, shuffle the top 3 cards of your discard pile into your deck                                                                         | §3.81           |
| Asteroid M 49002 (support, cost 2, [wild])              | Alter-Ego Action: exhaust → shuffle the topmost MAGNETIC card of your discard pile into your deck and heal 1 from your identity                                            | §3.81           |
| Magneto's Helmet 49003 (cost 3)                         | Magneto gains steady. Resource: exhaust → a [wild] for a MAGNETIC card                                                                                                     | §3.81, §3.80    |
| Magneto's Armor 49004 (cost 2)                          | Response: after you resolve _Magnetic Pull_, if you discarded at least 1 [mental]: +1 THW this round; [physical]: +1 ATK; [energy]: +1 DEF                                 | §3.71; Q41, Q42 |
| Magneto's Cape 49005 (cost 2)                           | Magneto gains AERIAL. Response: after you resolve _Magnetic Pull_, exhaust → ready Magneto                                                                                 | §3.71; Q41      |
| Magnetic Bubble 49006 (cost 3)                          | Magneto gains retaliate 1. Forced Interrupt: damage you would take is placed here instead; at 6 or more, discard it                                                        | §3.81 (§3.65)   |
| Wrapped in Metal 49007 ×2 (cost 2)                      | Hero form only. Attach to a non-ELITE minion. It cannot activate; its printed text box is treated as blank                                                                 | §3.76           |
| Electromagnetic Blast 49008 ×2 (cost 2)                 | Hero Action (thwart): remove 3 threat from a scheme; if that was its last threat, you may discard an attachment with the text "Hero Action" or "Hero Response"             | §3.77           |
| Metal Shards 49009 ×2 (cost 3)                          | Hero Action (attack): 7 damage to an enemy; if this attack defeats it, gain a tough status card                                                                            | §3.81           |
| Magnetic Missile 49010 ×2 (cost 1)                      | Hero Action: discard a minion with Wrapped in Metal attached. Then, 5 damage to an enemy and stun it (erratum)                                                             | §3.76           |
| Master of Magnetism 49011 ×2                            | A resource card with [energy] and [mental], MAGNETIC, no text                                                                                                              | data            |
| Old Grievances 49027                                    | Forced Response: after you use _Magnetic Pull_, take 1 damage for each card discarded by it. Alter-Ego Action: exhaust Erik Lehnsherr → discard it                         | §3.71; Q41, Q42 |
| **Exodus** 49028 (SCH 2, ATK 2★, 6)                     | Steady. Toughness. Villainous. Forced Response: after he attacks you, discard cards from the top of your deck equal to his total ATK for that attack (erratum)             | §3.81, §3.80    |
| Martyr for Mutants 49029 (3 threat per player, amplify) | When Defeated: the defeating player discards the top 9 cards of their deck                                                                                                 | §3.81           |
| Fabian Cortez 49030 (SCH 2, ATK 2, 4; boost ★)          | Guard. When Defeated: the defeating player discards the top 4 cards of their deck. Boost: discard the top 4 cards of your deck                                             | §3.81, §3.80    |
| Frenzy 49031 (SCH 2, ATK 2★, 4; boost ★)                | Quickstrike. Forced Response: after she attacks you, discard the top 2 cards of your deck. Boost: discard the top 4                                                        | §3.81           |
| Angry Acolyte 49032                                     | When Revealed: each ACOLYTE minion engaged with a player activates against that player; if none did, discard from the encounter deck until an ACOLYTE minion and reveal it | §3.81           |

- **A round in numbers.** The top of his deck is Noble Sacrifice ([mental]), Squared Off ([physical]), Magneto's Cape
  ([energy], MAGNETIC). The Pull discards three and the Cape is in hand; with the Armor in play and Q42 = A he has THW
  3, ATK 3 and DEF 3 until the end of the round. With Old Grievances in play he took 3 damage first.
- **Old Grievances** stays in his play area until Erik Lehnsherr exhausts to discard it. It does not offer the usual
  flip. Magnetic Bubble takes its damage.
- **His deck runs short.** Each Pull discards 2 or 3 cards on average, Exodus's attack discards 2 plus his boost icons,
  Frenzy 2, Fabian Cortez 4 on a boost and 4 when defeated, Martyr for Mutants 9. Each reset deals an encounter card
  (RRG p. 33); Survivor and Asteroid M put discards back before the deck empties. These are ordinary deck discards
  (§3.81); only the Pull is read by other cards.
- **Wrapped in Metal and Magnetic Missile** are §3.76: the wrapped minion sits engaged, harmless and without guard or
  patrol, until he throws it.
- **Magneto's Helmet and Armor against the villain Magneto's** attachments of those titles, and "Magneto" as a name on
  both sides of that table, are §3.80.
- **The mission (§3.36, §3.38).** _Magnetic Pull_ and the nemesis set discard from the deck a mission attempt discards
  from, and none of them is an attempt: no Mission Response answers and nothing is paired. What they change is the deck
  the next attempt reads. Wrapped in Metal cannot go on an Overseer or an Agent of Apocalypse (§3.33).

#### The pack's Leadership and basic cards

| Card                                                                                 | As read                                                                                                                                                                                                                              | Needs             |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| M 49012 (Leadership ally, cost 4, [physical])                                        | THW 2, ATK 3 (two consequential), 4 hit points. Response: after she enters play, defeat a minion with fewer remaining hit points than M                                                                                              | §3.81             |
| Kid Omega 49013 (Leadership ally, cost 2, [energy])                                  | THW 2, ATK 2, 2 hit points. Response: after he enters play, spend an [energy] → 1 damage to each enemy, or spend a [mental] → remove 1 threat from each scheme                                                                       | §3.81             |
| Phoenix 49014 (Leadership ally, cost 3, [mental])                                    | THW 2, ATK 1, 3 hit points. Response: after she enters play, choose an X-MEN ally → ready it and heal 1 from it                                                                                                                      | §3.81, §3.80      |
| Cyclops 49015 (Leadership ally, cost 3, [physical])                                  | THW 2, ATK 2, 2 hit points. Response: after he enters play, choose an enemy; to the end of the phase it takes 1 more damage from each attack                                                                                         | §3.81, §3.80; Q46 |
| Won't Stay Down 49016 ×3 (support, cost 1)                                           | X-FORCE or X-MEN identity only. Max 1 per player. Alter-Ego Action: discard it → return an X-FORCE or X-MEN ally from your discard pile to your hand                                                                                 | §3.81             |
| Squared Off 49017 ×3 (cost 0)                                                        | Hero Action: discard from the encounter deck until a minion and put it into play engaged with you → play an ally from your hand for 3 less                                                                                           | §3.81             |
| Noble Sacrifice 49018 ×3 (cost 1)                                                    | Hero Action: discard an ally you control → heal its printed hit points from your hero and give your hero a tough status card                                                                                                         | §3.81             |
| "You Got This!" 49019 ×3 (cost 1)                                                    | Hero Response: after you exhaust your hero for a basic thwart or attack, discard an ally you control → add its matching power for this use; ready your hero                                                                          | §3.81             |
| New Recruits 49020 (player side scheme, cost 0)                                      | 2 threat per player. Victory 0. X-MEN identity only. When Defeated: each player chooses 1 set-aside NEW ally and adds it to their hand                                                                                               | §3.78             |
| White Queen 49021 (basic ally, cost 3, [energy])                                     | THW 2, ATK 1, 3 hit points. X-FORCE or X-MEN identity only. Response: after she enters play, discard a status card from a character                                                                                                  | §3.81, §3.80      |
| Face the Past 49022 (cost 0)                                                         | Max 1 per deck. Hero Action: search the encounter deck, discard pile and set-aside area for your nemesis minion and reveal it → ready your hero and draw 3; you cannot attack the villain this phase; remove this card from the game | §3.81             |
| Deft Focus 49023 ×3                                                                  | reprint of 16024 (erratum: Basic, not Protection)                                                                                                                                                                                    | reprint           |
| Energy, Genius, Strength 49024–49026                                                 | reprints of 01088–01090                                                                                                                                                                                                              | reprint           |
| Surge 49033, Anole 49034, Bling! 49035, Indra 49036 (basic allies, cost 2, [energy]) | Linked (New Recruits). THW 2, ATK 2, 2 hit points. With a MUTANT or X-MEN identity: +1 ATK (Surge), +1 THW (Anole), toughness (Bling!), +2 hit points (Indra), and it does not count against your ally limit                         | §3.78             |
| Children of the Atom 49037 ×3 (basic support, cost 1)                                | Play under any player's control, max 1 per player. Each X-FACTOR, X-FORCE and X-MEN character you control gains all three traits                                                                                                     | §3.81, §3.78      |

- **The allies at the mission (§3.34, §3.36).** Icons from the scans: M and Cyclops [physical]; Phoenix [mental]; Kid
  Omega, White Queen, Surge, Anole, Bling! and Indra [energy]. White Queen's "Play only if" line bars the play to the
  mission too. There each is blank: no entering-play Response for M, Kid Omega, Phoenix, Cyclops or White Queen, and the
  NEW allies have no bonus (their exemption from the ally limit does not matter where nobody controls them). THW and ATK
  for the attempt: M 2 and 3, Kid Omega 2 and 2, Phoenix 2 and 1, Cyclops 2 and 2, White Queen 2 and 1, each NEW ally 2
  and 2.
- **Squared Off in a campaign game** plays the ally, so its destination is chosen (§3.34): sent to the mission for 3
  less, the ally arrives blank.
- **Phoenix and Cyclops beside the Phoenix and Cyclops heroes**, and White Queen beside the minion of her title, are
  §3.80.
- **Ally upgrades (§3.59, Q30).** No upgrade of this pack can be attached to an ally: Wrapped in Metal goes on a minion,
  the rest are their controller's. Suit Up offers none of them.
- **New Recruits** is §3.78. In the starter deck it is one card of forty that Magnetic Pull cannot find (it is not
  MAGNETIC); defeated in a solo game it is worth one 2-cost ally with a bonus and no ally slot.
- **Noble Sacrifice and "You Got This!"** spend the allies the entering-play Responses have already paid for; with Won't
  Stay Down an X-MEN ally comes back to hand.
- **Deft Focus** reduces the next SUPERPOWER card: Magnetic Bubble, Electromagnetic Blast, Metal Shards and Magnetic
  Missile here; every Nightcrawler event.

#### The Hellfire Club (the pack's modular set)

| Card                                           | As read                                                                                                                                                                                                            | Needs        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| Sebastian Shaw 49038 (SCH 1, ATK 2, 5)         | Toughness. Villainous. Forced Response: after he is attacked, give him a facedown boost card; he cannot be attacked again this phase                                                                               | §3.79        |
| Selene 49039 (SCH 1, ATK 1, 4; boost ★)        | Quickstrike. Villainous. Allies cannot attack Selene. Boost: discard an ally you control                                                                                                                           | §3.79, §3.81 |
| Hellfire Pawn 49040 (SCH 1, ATK 2, 3; boost ★) | Guard. Patrol. Surge. Boost: put Hellfire Pawn into play engaged with you                                                                                                                                          | §3.81        |
| The Inner Circle 49041 (4 threat, amplify)     | When Revealed: place 2 additional threat here for each HELLFIRE card in play                                                                                                                                       | §3.81        |
| Power and Decadence 49042 (boost ★)            | When Revealed: give the villain a tough status card and give this card to that villain as a facedown boost card. Boost: after this activation the activating enemy activates against you again, with no boost card | §3.79, §3.12 |

- Five cards with no scenario of their own: offered as a modular set wherever one is chosen (DoD §5). Sebastian Shaw and
  Selene are unique; Hellfire Pawn is not, and is the card of Shadowcat's nemesis set under a second number.
- The Inner Circle's amplify icon adds a boost icon to every boost card turned up while it is in play, Shaw's and
  Selene's villainous cards included.
- Selene's Boost: the player it resolves on picks the ally; with none it does nothing.

**Card data fixes** (for `card-data-pipeline`): the regeneration of Magneto's Armor 49004 to its one ability id; Selene
49039's period; `cardNotes` for Sebastian Shaw's misprinted label and for the two-trait "Play only if" lines of White
Queen and Won't Stay Down. The three errata, the starter deck, Exodus's `nemesisMinion` flag and the four `linked`
keywords are right as emitted. The checks are in §5.5.

**Deckbuilding (DoD §4b).**

- Erik Lehnsherr prints no deckbuilding line. His starter deck is 40 cards: 15 Magneto, 17 Leadership, 8 basic.
- **Linked:** Surge, Anole, Bling! and Indra can be in no deck (RRG p. 27; ruling August 3, 2026 – Ruling 4 (3)); the
  builder lists them under New Recruits as set aside and never offers them. A deck with New Recruits brings its own
  four.
- "Max 1 per deck": Face the Past, Energy, Genius, Strength. "Max 1 per player" (Won't Stay Down, Deft Focus, Children
  of the Atom) is a play restriction.
- "Play only if" lines are play restrictions: New Recruits, White Queen and Won't Stay Down may be in any deck.
- The unique rule in a deck (§3.80 test 1): Phoenix and Cyclops decks without 49014 or 49015.

## 8. Build order (pass 3)

Written 2026-10-07 from §3's status lines and Plan paragraphs and from the owner's answers 1 to 40 (§4.1), with the
data checked against HEAD e9805f4b. None of this wave's engine work has landed: none of the identifiers the plans
name (`raiseMoment`, `villainRow`, `consideredRemainingHp`, `scenarioPlayArea`, `pairCards`, `topOfDeckFaceup`,
`printsAbility`, `revealNextVillainStage`, `ignoreAbilities`, `formChangeCost`, `basicPowerBy`, `passEncounterCard`,
`paidTypeCount` and the rest) exists in `packages/engine/src` or `packages/cards/src/dsl`. §3's statuses are not
changed here; what the answers and the code add to them is in §8.6.

One queue task per agent and per commit. **At most one engine agent at a time** (`packages/engine`,
`packages/cards/src/dsl`, the shared scenario builders in `packages/cards/src/*/setup.ts`, and
`packages/content/src/schema` for a schema change); beside it, at most two other agents on files that do not overlap
(data fixes, card scripts, the campaign definition, tests). **At most three scripting agents at once and never two in
one file.** A hero module, a scenario or a set is scripted only once every queue task it waits on has landed.

### 8.1 Data: what is done and what is left

**Done** (`card-data-pipeline`, commits 2f679e07 to e9805f4b on `feature/wave-8`):

- All five packs are emitted under `packages/content/src/data/`: `aoa` (194 cards, 23 encounter sets, 5 scenario
  records, 2 starter decks), `iceman`, `jubilee`, `ncrawler`, `magneto`. The cycle is named Age of Apocalypse.
- Six starter decks: Bishop / Leadership and Magik / Aggression from MC45 p. 22; Iceman / Aggression (46 entries, 40
  counted, Frostbite ×6 permanent), Jubilee / Justice, Nightcrawler / Protection and Magneto / Leadership from the
  printed decklist cards.
- The five scenario records with `ScenarioVillain.sideBCardId`, the a-card main scheme ids and `setAsideCardIds`
  (§1.6, §1.10, §1.21). `AOA_CAMPAIGN` is hand-authored and exported, not yet in `CAMPAIGNS`.
- `WAVE8_CARDS`, `WAVE8_ENCOUNTER_SETS`, `WAVE8_SCENARIOS` and `WAVE8_STARTER_DECKS`; the wave is in `PLAYABLE_CARDS`
  and listed as unscripted, so nothing of it can be selected yet.
- Schema and normalizer work the spec asked for: `HostQualifiers.classification` with its parser rule (§1.32);
  `Correction.scheme`, `Correction.schemeIcons` and `startingThreatPerPlayer`; `addedRecords` and `linkOverrides`
  (45104b The Towering Citadel); Mission Response parsed as a Forced Response; the Overseer and Prelate faces as two
  cards joined by `otherFaceId`; dashed minion stats; the mission back faces as their own side schemes.
- Corrections: the five RRG p. 69 errata; Colossus's subtitle on `mut_gen` 32048 and `wolv` 35021; Cryokinetic
  Perception's "the ICE trait"; Grand Finale's title and ability id; Kurt's Cutlasses 48004 with
  `restrictedWeight: 2` and its one ability id; Brimstone Dimension 48028's hazard icon; The Crazy Gang 48033's
  2 threat per player; Selene 49039's period; Sebastian Shaw 49038's misprinted label noted in provenance.

**Left for the data agent** (collected from §5 and §7, each checked against the data at e9805f4b). None blocks an
engine task; the card group that waits on each is named.

1. Magneto's Armor 49004: accept the regeneration to one ability id (`49004.magnetos-armor-response`; the three
   `-constant` ids go). Waits: `magneto/magneto/support-upgrades-allies`.
2. Grounded 47023: an ability id for its constant line (today: the obligation, the When Revealed and the Response).
   Waits: `jubilee/jubilee/obligation-nemesis`.
3. Husk 47012: regenerate to `[husk-interrupt]` alone (today three extra `-constant` ids). Waits:
   `jubilee/aspect-basic`.
4. The Eye of Sauron 46032: regenerate to `[when-revealed]` alone (today four extra `-constant` ids). Waits:
   `iceman/sauron`.
5. Items 1, 3 and 4 are the survey's regeneration drift: regenerate each card by itself and reject the image
   extension hunks (`.png` for `.jpg`) the full regeneration brings.
6. Tweedledope 48037: **Q44 = B, `boostIcons` stays 1**; only the `Errata` note is rewritten to say the printed star is a typo for one boost icon (FFG correction of October 7, 2024, the owner's cite) (the earlier default was 0; the
   record has 1). Waits: `ncrawler/crazy-gang`.
7. `cardNotes` on the nine version records 47007a/b/c, 47008a/b/c and 47010a/b/c (one title, three versions, §3.69).
8. `cardNotes` on Shopping Spree 47003 for the insert's victory sentence (§0.4).
9. `cardNotes` on New Recruits 49020, White Queen 49021 and Won't Stay Down 49016: the two-trait "Play only if" line
   is a script rule (`playOnlyIf`), not a `playRestrictions` field.
10. `wolv` 35021's image path is `/bundles/cards/45031.jpg`, the Age of Apocalypse Colossus; it has no scan of its
    own and is a reprint of 32048 (`/bundles/cards/32048.png`).
11. A manifest row for 45104b in `assets/card-art/hall-of-heroes-manifest.tsv` (the scan is in place; the handoff
    says no row was added), and its width against the other scans.
12. The scans §1.22 and §1.31 list as "still to read at emit": confirm each was read when `aoa` was emitted, or read
    them before the set that holds them is scripted.
13. `AOA_CAMPAIGN` into `CAMPAIGNS`, in the same change as the campaign definition (§8.5 line 5).
14. Hero art for Bishop and Magik out of `art/heroes/_pending/` when the box becomes playable; the Jubilee and
    Wolverine pair's folder `art/teamups/jubilee-wolverine/` (§5.4).

### 8.2 Engine queue, in order

43 tasks: one for each of the 7 **new** rows and the 30 **extend** rows of §3, four rows split in two because they hold
two independent changes (§3.33, §3.35, §3.62, §3.75), and two tasks the owner's answers added to a row whose status is
"exists (verify)" (§3.45: Q22 = B and Q25 = A). No two rows are merged: every pair that shares code can land one after
the other. "After N" names a dependency, not just the order. The order is: the two changes most scripts need; then the
heroes' primitives, in the order the heroes are scripted (§8.4); then the five scenarios in box order; then the
campaign, which needs all five scenarios scripted first anyway.

File paths are under `packages/engine/src/` unless they start with `dsl/` (`packages/cards/src/dsl/`) or `cards/`
(`packages/cards/src/`). Every task adds its own colocated test file with the row's exact-number tests.
**Decisions:** a question number with its answer from §4.1; "(open)" means the owner has not answered and the task
builds on default A.

**What most scripts need**

| #   | §    | Change                                                                                                                                                                                                                       | Files                                                                                                                               | Decisions | Unblocks                                                                                                                                                                                                                     |
| --- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 3.39 | `EffectSpec raiseMoment { name, player }`, `TriggerEvent momentRaised`, the pattern `on.moment(name)`; forced before optional; the `heard` gate; log `momentRaised`                                                          | `spec.ts`, `trigger-events.ts`, `resolve/apply-effect.ts`, `resolve/triggers.ts`, `events.ts`, `dsl/effects.ts`, `dsl/abilities.ts` | none      | Bishop 45001a and Bishop's Uniform 45005; Iceman 46001a and Cryokinetic Perception 46005; Bamf! 48006 and Tally Ho! 48011; the five missions 45166a–45170a; task 12                                                          |
| 2   | 3.1  | `revealCard` of a card found in play: a minion engages the finder and keeps everything on it, no `entersPlay`, then When Revealed and reveal keywords; a side scheme or attachment stays where it is with no starting threat | `resolve/reveal.ts`, `resolve/find.ts`, `resolve/apply-effect.ts`, `events.ts`                                                      | Q17 = A   | Pursued by the Past 45075b; Ahab 45097; Gene Pool's reveal (45062a); Police State 45138; Land Out of Time 45131; Trevor Fitzroy 45026, Bantam 45028; Ruler of Limbo 45055; Brimstone Dimension 48028, Brimstone Strike 48030 |

**The heroes' primitives**

| #   | §                  | Change                                                                                                                                                                                                                                                                                          | Files                                                                                                                                                                                                                      | Decisions          | Unblocks                                                                                                               |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 3   | 3.75 (a)           | `dealAsEncounterCard` takes a card in play: it leaves play facedown to the player's dealt cards through the ordinary leave, not defeated; a card that cannot leave play is not dealt                                                                                                            | `resolve/cards.ts`, `resolve/apply-effect.ts`, `spec.ts`                                                                                                                                                                   | none               | Brimstone Dimension 48028 (with task 2); task 4                                                                        |
| 4   | 3.75 (b) (after 3) | `EffectSpec passEncounterCard { cards, from, to }` and `PlayerRef nextAfter(player)`; the passed card is revealed with its holder's other facedown cards                                                                                                                                        | `spec.ts`, `resolve/apply-effect.ts`, `resolve/cards.ts`, `select.ts`, `events.ts`, `dsl/effects.ts`, `dsl/values.ts`                                                                                                      | none               | The Crazy Gang 48033                                                                                                   |
| 5   | 3.51               | The payment records `paid.cards.<cardType>`; `Predicate paidWithCard { cardType, of? }`                                                                                                                                                                                                         | `actions.ts`, `stack.ts`, `spec.ts`, `select.ts`, `resources.ts`, `dsl/values.ts`                                                                                                                                          | Q28 = A            | Concussive Blast 45007, Command Authority 45008                                                                        |
| 6   | 3.48               | `RuleSpec topOfDeckFaceup { player, while? }` as a third visibility exception, derived and never stored; logs `deckTopShown` / `deckTopHidden` after every card move; `Predicate topOfDeckFaceup { player }`                                                                                    | `abilities.ts`, `rules.ts`, `visibility.ts`, `spec.ts`, `select.ts`, `resolve/cards.ts`, `resolve/state-checks.ts`, `events.ts`, `dsl/abilities.ts`, `dsl/values.ts`                                                       | Q26 = B            | Magik 45030a; 45033–45035 and 45038–45040 through `topOfYourDeckHas`                                                   |
| 7   | 3.49 (after 6)     | The constant `playableTopOfDeck { player, costReduction, limit: "phase" }`: the top card is a candidate wherever a hand card could be played (the play command, a timing window, `playFromHand` from the hand); `cardPlayed { from: "deckTop", countsAsFrom: "hand" }`                          | `abilities.ts`, `actions.ts`, `legal.ts`, `select.ts`, `resolve/play-card.ts`, `resolve/apply-effect.ts`, `why-not.ts`, `events.ts`, `dsl/abilities.ts`                                                                    | Q27 = A            | Magik 45030a; Colossus 45031 and Magic Barrier 45040 from the top; RRG FAQ p. 64's four entries                        |
| 8   | 3.62 (a) (after 5) | `paid.count`; declared wild types on the pay command (`wildAs`), the `declareWildTypes` choice and its equivalence shortcut; `readsPaidTypes` and `RuleSpec readsPaymentTypesOf`; `ValueSpec paidTypeCount`, `Predicate paidType`; the payment stamped on `cardPlayed`; log `wildTypesDeclared` | `actions.ts`, `commands.ts`, `choices.ts`, `payable.ts`, `resources.ts`, `stack.ts`, `spec.ts`, `select.ts`, `abilities.ts`, `rules.ts`, `trigger-events.ts`, `legal.ts`, `events.ts`, `dsl/abilities.ts`, `dsl/values.ts` | Q33 = B; Q34 = A   | 47004–47009 (the Coat, the Sunglasses and Jubilee's eight event records), Three Steps Ahead 47015, Multitalented 47021 |
| 9   | 3.62 (b) (after 8) | A resource cost of a chosen size, `AbilityCost resources { choose: { min, max } }`, with no overpayment; `paidType` read over an ability's spent pool                                                                                                                                           | `abilities.ts`, `payable.ts`, `actions.ts`, `legal.ts`, `dsl/abilities.ts`, `dsl/validate.ts`                                                                                                                              | Q33 = B            | Husk 47012                                                                                                             |
| 10  | 3.63               | `RuleSpec formChangeCost { player, to?, during?, cost }`: the `changeForm` command opens the payment before the flip and is not legal when it cannot be paid; a forced change pays nothing                                                                                                      | `abilities.ts`, `rules.ts`, `actions.ts`, `legal.ts`, `why-not.ts`, `resolve/apply-effect.ts`, `dsl/abilities.ts`                                                                                                          | Q37 = A            | Grounded 47023                                                                                                         |
| 11  | 3.64               | `EffectSpec basicPowerBy { player, powers, bonus? }`: the named player chooses a ready character, a power and a target, and the ordinary basic power runs; the bonus lasts until the power's event ends                                                                                         | `spec.ts`, `resolve/apply-effect.ts`, `actions.ts`, `choices.ts`, `lasting.ts`, `dsl/effects.ts`                                                                                                                           | none               | Cell Phone 47019                                                                                                       |
| 12  | 3.71 (after 1)     | `discardDeckUntil.bindAll` (every card discarded, the match included, settled); `raiseMoment.carry` (named slots stamped on `momentRaised`)                                                                                                                                                     | `spec.ts`, `resolve/deck-discard.ts`, `resolve/apply-effect.ts`, `trigger-events.ts`, `select.ts`, `dsl/effects.ts`                                                                                                        | Q41, Q42: A (open) | Magneto 49001a, Magneto's Armor 49004, Magneto's Cape 49005, Old Grievances 49027                                      |
| 13  | 3.77               | `TargetQuery.printsAbility { kinds, form }`, read from the card's printed ability list through the registry; a blank text box does not hide it                                                                                                                                                  | `spec.ts`, `select.ts`, `dsl/values.ts`                                                                                                                                                                                    | none               | Electromagnetic Blast 49008                                                                                            |
| 14  | 3.53               | `TargetQuery.classification`, and the host resolver's reading of `HostQualifiers.classification` (the schema field and parser rule landed in 4c75824d)                                                                                                                                          | `spec.ts`, `select.ts`, `attachment-hosts.ts`, `dsl/values.ts`                                                                                                                                                             | none               | Sidekick 45015; Side-by-Side 45016 (with task 15)                                                                      |
| 15  | 3.54               | `AbilityCost.readyCards: InPlayCostPick`, offering exhausted cards only, with any `readyCost` paid alongside                                                                                                                                                                                    | `abilities.ts`, `actions.ts`, `payable.ts`, `legal.ts`, `dsl/abilities.ts`, `dsl/validate.ts`                                                                                                                              | Q29 = A            | Side-by-Side 45016                                                                                                     |
| 16  | 3.59               | `TargetQuery.canAttachToCategory: "ally"`, read from the upgrade's printed host with no card in play consulted                                                                                                                                                                                  | `spec.ts`, `select.ts`, `attachment-hosts.ts`, `dsl/values.ts`                                                                                                                                                             | Q30 = A            | Suit Up 45017                                                                                                          |
| 17  | 3.55               | `AbilityCost.discardFromDeck { choose: { min, max } }`, the count bound for the effect                                                                                                                                                                                                          | `abilities.ts`, `actions.ts`, `payable.ts`, `choices.ts`, `dsl/abilities.ts`, `dsl/validate.ts`                                                                                                                            | none               | Goldballs 45041                                                                                                        |

**The five scenarios**

| #   | §               | Change                                                                                                                                                                                                        | Files                                                                                                                                                                                                              | Decisions                | Unblocks                                                                   |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | -------------------------------------------------------------------------- |
| 18  | 3.5             | A setup option keyed by an encounter set: 0 to 3 threat per player on Gene Pool after step 11, placed only when the setup config states an amount; log `setupOptionApplied { option, amount }`                | `cards/core/setup.ts` (`checkScenarioSetupOptions`), `cards/wave8/setup.ts`, `setup-steps.ts`, `events.ts`                                                                                                         | Q1 = A                   | Infinites in any scenario (Unus, Apocalypse); the setup control of §5      |
| 19  | 3.6             | The builders' standard set argument takes `standard_iii` for any scenario whose `standardEncounterSetIds` is `[standard]`, from any pack; the Expert set unchanged                                            | `cards/core/setup.ts` (`difficultyEncounterSetIds`), the waves' `setup.ts` checks (`checkWave4DifficultySets` and its siblings), `cards/modular-pool.ts`                                                           | Q10 = A                  | `standard_iii` 45075a/b–45080 on every scenario                            |
| 20  | 3.7             | `GameState.villainRow`; the 1A Setup's random order (log `villainRowSet`); `moveActiveCounter { to: "nextInRow" }`; the villain phase reads the active villain afresh for each player                         | `state.ts`, `spec.ts`, `query.ts`, `resolve/apply-effect.ts`, `resolve/game-areas.ts`, `villain/phase.ts`, `events.ts`, `dsl/effects.ts`                                                                           | Q4 = A; Q5 = A           | The Horsemen of Apocalypse 45085a/b, Rough Riders 45096, Metal Wings 45091 |
| 21  | 3.10            | `RuleSpec consideredRemainingHp { target, atLeast, while? }`, seen by every reading of remaining hit points and by the defeat check; superlative hosts read the true dial; `consideredHp` in the inspect data | `abilities.ts`, `rules.ts`, `select.ts`, `attachment-hosts.ts`, `resolve/defeat.ts`, `resolve/state-checks.ts`, `dsl/abilities.ts`                                                                                 | Q6 = A                   | Golden Horse 45090, Metal Wings 45091; task 22                             |
| 22  | 3.11 (after 21) | `resolveSpecials.trigger: "forcedResponse"` with `asIf: { remainingHpAtLeast }`; the cost form `AbilityCost.resolveAbility { of, trigger }` with its settle step, unpaid when the ability can change nothing  | `spec.ts`, `abilities.ts`, `resolve/apply-effect.ts`, `resolve/effects-frame.ts`, `payable.ts`, a settle module beside `enemy-attack-cost.ts`, `legal.ts`, `dsl/effects.ts`, `dsl/abilities.ts`, `dsl/validate.ts` | Q7 = A                   | Golden Horse 45090, Metal Wings 45091, Rough Riders 45096; tasks 27 and 30 |
| 23  | 3.13            | `LastingUntil "nextVillainPhaseBegins"`, expiring before step one of the next villain phase, on the identity semantics of the constant blank                                                                  | `state.ts`, `spec.ts`, `lasting.ts`, `villain/phase.ts`, `dsl/effects.ts`                                                                                                                                          | none                     | Pestilence 45083a/b, Plague and Pestilence 45088                           |
| 24  | 3.18            | `EffectSpec revealNextVillainStage { villain }`: the stage change of a defeat with no defeat; full printed hit points; everything on him stays; log `villainStageRevealed { cause: "effect" }`                | `spec.ts`, `resolve/apply-effect.ts`, `resolve/defeat.ts`, `resolve/villain-swap.ts`, `events.ts`, `dsl/effects.ts`                                                                                                | Q11 = A; Q12 = A         | Apocalypse 45101a/b, 45102a/b                                              |
| 25  | 3.19            | `ValueSpec printedHp { of, numeral: true }`: the number printed before the per player icon, from the current stage, never modified                                                                            | `spec.ts`, `select.ts`, `dsl/values.ts`                                                                                                                                                                            | none                     | The Age of Apocalypse 45103b, The Apocalypse Solution 45111                |
| 26  | 3.21            | `RuleSpec ignoreAbilities { on, abilities, while? }`: the named abilities neither trigger nor resolve                                                                                                         | `abilities.ts`, `rules.ts`, `resolve/triggers.ts`, `resolve/ability.ts`, `dsl/abilities.ts`                                                                                                                        | Q13 = A                  | No Longer Worthy 45105b                                                    |
| 27  | 3.24 (after 22) | The cost form with `trigger: "special"` ("resolve the Special → discard this card"), unpaid when no Setting environment is in play or the Special can change nothing                                          | `abilities.ts`, `payable.ts`, task 22's settle module, `legal.ts`, `dsl/abilities.ts`                                                                                                                              | Q14 = B; Q15 = A; Q7 = A | High-Tech Goggles 45122, Genetic Enhancement 45123, Escaped Mutant 45137   |
| 28  | 3.25            | An attachment with no printed host is turned faceup out of play, its When Revealed resolves, and it is discarded if still unattached afterward; nothing of it is in effect until it is attached               | `resolve/reveal.ts`, `resolve/attach.ts`, `resolve/host-step.ts`                                                                                                                                                   | none                     | Cruel Experiment 45124                                                     |
| 29  | 3.26            | `changeVillainForm.reveal?: false`: the face turns and `cardFlipped` is raised, with no reveal step                                                                                                           | `spec.ts`, `resolve/apply-effect.ts`, `dsl/effects.ts`                                                                                                                                                             | Q16 = A                  | Apocalypse 45184a/b/c–45186a/b/c, 45149–45155                              |
| 30  | 3.28 (after 22) | `resolveSpecials.trigger: "forcedInterrupt"`, the ability named by ref id, with no attack or scheme logged                                                                                                    | `spec.ts`, `resolve/apply-effect.ts`, `resolve/effects-frame.ts`, `dsl/effects.ts`                                                                                                                                 | none                     | Celestial Tech 45158 (with 45156, 45157)                                   |

**The campaign**

| #   | §                   | Change                                                                                                                                                                                                 | Files                                                                                                                                                   | Decisions          | Unblocks                                                                                  |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| 31  | 3.33 (a)            | `ZoneId scenarioPlayArea`, `GameState.scenarioPlayAreas`, `createScenarioPlayArea { name, closed }`: cards in play with no controller and no engagement; game steps apply; leaving by `CardHome`; logs | `state.ts`, `ids.ts`, `spec.ts`, `resolve/apply-effect.ts`, `resolve/cards.ts`, `resolve/game-areas.ts`, `visibility.ts`, `events.ts`, `dsl/effects.ts` | Q20 = A            | every card of §1.24–§1.28; tasks 32 to 38                                                 |
| 32  | 3.33 (b) (after 31) | The closed filter in every query, selector and "each": `TargetQuery.inScenarioPlayArea`; an attachment's abilities do not open it; `AbilityDefinition.reaches`; reads still see the card               | `select.ts`, `query.ts`, `spec.ts`, `abilities.ts`, `rules.ts`, `modifiers.ts`, `dsl/values.ts`, `dsl/abilities.ts`                                     | Q18 = A; Q19 = B   | the mission rules block; Desperate Measures 45176; Worldwide Crisis 45165                 |
| 33  | 3.34 (after 32)     | `RuleSpec playDestination { cards, area, while? }` and the play command's `into`; an ally there has no controller and a blank text box; an upgrade's host choice may reach into the area               | `abilities.ts`, `rules.ts`, `commands.ts`, `actions.ts`, `legal.ts`, `resolve/play-card.ts`, `resolve/enter-play.ts`, `why-not.ts`, `dsl/abilities.ts`  | Q19 = B; Q32 = A   | every ally in a campaign game; Desperate Measures 45176                                   |
| 34  | 3.35 (a)            | `cannotLeavePlay.by: "discard"`: no discard touches the card and no cost may choose it; removal from the game and a flip still work                                                                    | `abilities.ts`, `rules.ts`, `resolve/event.ts`, `payable.ts`                                                                                            | none               | Mission Team 45171a/b                                                                     |
| 35  | 3.35 (b) (after 33) | The lasting cost reduction gains `into: { scenarioPlayArea }`: used by the next ally any player plays to the area this phase, ended unused with the phase                                              | `lasting.ts`, `spec.ts`, `actions.ts`, `resolve/apply-effect.ts`, `dsl/effects.ts`                                                                      | none               | Mission Team 45171a's first option                                                        |
| 36  | 3.42                | `RuleSpec consideredResourceIcon { target, resource }`, read by the pairing of task 37                                                                                                                 | `abilities.ts`, `rules.ts`, `resources.ts`, `dsl/abilities.ts`                                                                                          | Q19 = B            | Desperate Measures 45176                                                                  |
| 37  | 3.36 (after 32, 36) | `EffectSpec pairCards { cards, with, chooser, match, wild, limit?, bind }` with its pending choice; `RuleSpec pairLimit`; log `cardsPaired`                                                            | `spec.ts`, `resolve/apply-effect.ts`, `choices.ts`, `abilities.ts`, `rules.ts`, `events.ts`, `dsl/effects.ts`                                           | none               | Mission Team 45171a (`missionAttempt()`), Mister Sinister 45179a                          |
| 38  | 3.37 (after 32)     | `assignDamage.sequential`: one character at a time, each settled before the next pick, the rest of the pool lost when nobody can take it                                                               | `spec.ts`, `resolve/apply-effect.ts`, `resolve/effects-frame.ts`, `dsl/effects.ts`                                                                      | none               | Mission Team 45171a (steps 3 to 5)                                                        |
| 39  | 3.43                | `RuleSpec cannotEnterPlay { cards, while? }` matched by title: refused before any cost for a play, and an effect that would put the card into play does nothing                                        | `abilities.ts`, `rules.ts`, `select.ts`, `actions.ts`, `resolve/enter-play.ts`, `why-not.ts`, `dsl/abilities.ts`                                        | none               | scenario 5's "Professor X cannot enter play during this game"                             |
| 40  | 3.44                | `EffectSpec countTowardStartingHand { player, amount }`: the starting draw is that much smaller and the credit is cleared by it                                                                        | `spec.ts`, `state.ts`, `flow.ts`, `resolve/apply-effect.ts`, `dsl/effects.ts`                                                                           | none               | the ally search of every scenario's Campaign Instructions                                 |
| 41  | 3.46                | `TargetQuery.otherFaceOf: TargetRef`                                                                                                                                                                   | `spec.ts`, `select.ts`, `dsl/values.ts`                                                                                                                 | Q21 = A            | scenario 3 in a campaign: the Prelate that is the drawn Overseer's other face             |
| 42  | 3.45                | `CampaignOp random.perAttempt`: the draw mixed with how many times the node was played, the campaign RNG advancing as before; the step traced with its attempt number                                  | `campaign.ts`, `campaign/ops.ts`, `campaign/runner.ts`                                                                                                  | Q22 = B            | the mission and Overseer draws of `campaigns/aoa.ts`                                      |
| 43  | 3.45                | A grant's deck-size rule as data, `CampaignGrant.deckSize: "exempt" (today's, the default), "maximumOnly" or "counted"`, read by `validateDeck` where it leaves granted copies out of the count        | `campaign.ts`, `campaign/ops.ts`, `deck.ts`                                                                                                             | Q25 = A (see §8.6) | the three rewards of the log (an upgrade, a support, a campaign ally), Desperate Measures |

**Notes on the order.**

- **Row to task:** 3.1 → 2; 3.5 → 18; 3.6 → 19; 3.7 → 20; 3.10 → 21; 3.11 → 22; 3.13 → 23; 3.18 → 24; 3.19 → 25;
  3.21 → 26; 3.24 → 27; 3.25 → 28; 3.26 → 29; 3.28 → 30; 3.33 → 31, 32; 3.34 → 33; 3.35 → 34, 35; 3.36 → 37;
  3.37 → 38; 3.39 → 1; 3.42 → 36; 3.43 → 39; 3.44 → 40; 3.45 → 42, 43; 3.46 → 41; 3.48 → 6; 3.49 → 7; 3.51 → 5;
  3.53 → 14; 3.54 → 15; 3.55 → 17; 3.59 → 16; 3.62 → 8, 9; 3.63 → 10; 3.64 → 11; 3.71 → 12; 3.75 → 3, 4; 3.77 → 13.
- **The three dependencies §6 named:** §3.34 needs §3.33's area (33 after 31 and 32); §3.71 builds on §3.39 (12
  after 1); §3.62 and §3.51 change the same payment frame, so 5 lands first and 8 is written on top of it, never
  beside it.
- Tasks 22, 27 and 30 are one mechanism in three steps (an ability of another card resolved by kind, as an effect
  and as a cost); 27 and 30 are small and may go to the agent that did 22.
- Tasks 18 and 19 change the shared scenario builders in `@mc/cards`, not the engine. They are in this queue because
  every wave's builder calls that code and only one agent may be in it at a time.
- Task 28 reads the absence of `attachesTo` on the emitted record: the curation's
  `impliedAttachHost: "ownWhenRevealed"` leaves the host off, and the card's own When Revealed attaches it.
- Task 38 may turn out to compose from `repeatWhile` (§3.37 says so); the first agent to reach it checks before
  adding the flag, and reports the row as "exists (compose)" if it does.
- Tasks 12 and 13 can move ahead of 8 to 11 if Magneto is to be scripted before Jubilee; nothing else depends on
  their place. Tasks 39 to 43 depend on nothing in the queue and can fill a gap while a scripting agent holds
  `dsl/`.
- **Four Horsemen's A and B faces (Q9 = B) need no engine task.** `VillainSetup` already takes a card id per
  villain; the wave's builder passes the chosen face (§8.4 line 1).
- **Open questions that touch a task:** Q41 and Q42 (task 12), both built on A; B or C is a change to the script
  and to what `bindAll` holds, not to the task's shape. Q43 to Q46 touch no task; Q46 = B would add one
  (`increaseDamageTaken` counted per attack, §3.81).

### 8.3 The "exists (verify)" and "exists (compose)" rows

Not engine tasks unless the proof fails. The first scripting agent to need a row writes the one test below in its
own module's test file, **before** relying on the primitive, and reports back at once if it does not behave as the
row says; the main session then adds an engine task to §8.2 rather than the script working around it. Module names
are §8.4's.

| §    | The one test that proves it                                                                                                                                                                     | First card group to need it                     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 3.2  | Unus with Gene Pool at 9 attacks with a 1-icon boost card: 2 icons counted; at 8 threat: 1                                                                                                      | `aoa/unus`                                      |
| 3.3  | compose: Gene Pool raised 2 → 3 → 6 → 9 and thwarted back to 2: Unus gains and loses retaliate 1, stalwart and the amplify icon at each step, with no ability resolving                         | `aoa/unus`                                      |
| 3.4  | Gene Pool is in play after step 11 with 4 threat; thwarted to 0 it stays in play, nothing is announced and no When Defeated resolves                                                            | `aoa/infinites`                                 |
| 3.8  | §3.8 tests 2 and 5: a boost-made second activation moves the counter a second time; the owner's Q5 test                                                                                         | `aoa/four-horsemen`                             |
| 3.9  | Four villains: three at 0 and one at 1 hit point, none is defeated; one healed from 0 to 2 activates normally; the last reaches 0: all four are defeated together and the players win           | `aoa/four-horsemen`                             |
| 3.12 | compose: Infinite Prelate at Gene Pool 9: the extra boost card is given for the activation, the tough card and the heal of 3 follow it (Q8 = A)                                                 | `aoa/unus`                                      |
| 3.14 | Golden Horse revealed with War at 2, Death (Aerial) at 1, Famine at 5 remaining: it attaches to War                                                                                             | `aoa/four-horsemen`                             |
| 3.15 | 2 players, step 12a: two different Four Horsemen side schemes are in play at 6 threat each, the other two are in the deck, and the deck was shuffled                                            | `aoa/four-horsemen`                             |
| 3.16 | Hound revealed to an alter-ego: the identity is in hero form and the once-per-round change is unused; the first Hound revealed in a phase surges and the second does not                        | `aoa/hounds`                                    |
| 3.20 | compose: Apocalypse III at 20 damage with no No Longer Worthy: his attachments are discarded, he heals, and the main scheme loses X threat; he is not defeated                                  | `aoa/apocalypse`                                |
| 3.22 | Heart of the Empire with a Prelate in play: a thwart of 2 removes 0; Prelate defeated, thwarted out: the chain reveals a random set-aside Prelate and flips to The Towering Citadel             | `aoa/apocalypse`                                |
| 3.23 | §3.23 tests 1 and 3: one random environment at setup with 7 cards shuffled in and 16 set aside; stage II revealed in play brings a second environment and leaves 8 set aside                    | `aoa/dark-beast`                                |
| 3.27 | compose: §3.27 test 1: counters 1, 2, 3 over three rounds; in round 4 the fourth is placed, 4 are removed, and the first player reveals the first SUPERPOWER card discarded                     | `aoa/en-sabah-nur`                              |
| 3.29 | Ancient Ritual at 9 threat takes 1: it is at 5 and each player has 1 facedown encounter card; Ozymandias's scheme threat lands on it and not on the main scheme                                 | `aoa/clan-akkaba`                               |
| 3.30 | Abyss activates against a player twice: two of that player's deck cards are on him facedown and he has 4 more hit points; defeated, both cards go to their owner's discard pile                 | `aoa/prelates`                                  |
| 3.31 | Escaped Mutant on player 2: Armored Unibike revealed by player 1 engages player 2 and has quickstrike; with nobody holding it, it engages the revealing player                                  | `aoa/genosha`                                   |
| 3.38 | Sugar Man's Mission Response heals 3 for a [physical] card a mission attempt discards and ignores Famine's ten; it resolves before Digging Deep's own Response, whose card does not count       | `aoa/campaign/overseer`                         |
| 3.40 | compose: a mission at 0 threat with a minion in the area is not defeated; the minion gone, it is defeated and flips; a fourth attempt counter flips it to the failed bullet instead             | `aoa/campaign/aoa-mission`                      |
| 3.41 | An Overseer in the area is engaged with nobody, never activates, shows dashes for SCH and ATK, and takes 0 damage while an Agent of Apocalypse is in the area                                   | `aoa/campaign/overseer`                         |
| 3.45 | The "To verify" bullets of §3.45 as one definition test: a later instruction reads `currentMission`; `setAsideCards` by seat count; `excludeGranted`; no `defeat` block in expert               | `campaigns/aoa.ts`                              |
| 3.50 | §3.50 test 1: Soulsword's +1 ATK comes and goes as the top card changes by a draw, with no ability resolving; test 7 for the facedown card (Q26 = B)                                            | `aoa/magik/support-upgrades-allies`             |
| 3.52 | compose: Energy Absorption after 3 damage with two resource cards among the top three: both are in his hand, the third is discarded, and the moment is raised once                              | `aoa/bishop/identity`                           |
| 3.56 | Colossus played by his Interrupt in an enemy attack with three allies in play: cost 3 paid, he enters with a tough card, defends ready, and the ally limit makes his player discard one         | `aoa/magik/support-upgrades-allies`             |
| 3.57 | Belasco's three discards attach facedown to Ruler of Limbo; Ruler of Limbo defeated: Limbo returns to play under its owner's control and the other cards go to the discard pile                 | `aoa/magik/obligation-nemesis`                  |
| 3.58 | The ally Cable 45011 cannot be played, or put into a deck, beside the Cable hero (alter-ego title Nathan Summers), and still pays as a resource                                                 | `aoa/aspect-basic`                              |
| 3.61 | Six Frostbite are set aside before step 1; one attached by _"Freeze!"_ gives −1 SCH and −1 ATK and is set aside after that enemy's activation (Q35 = A); with none set aside, no attach         | `iceman/iceman/support-upgrades-allies`         |
| 3.65 | Ice Wall takes the 4 damage another player's identity would take after defense; at 8 it is discarded and the enemy that just attacked gets a Frostbite                                          | `iceman/iceman/support-upgrades-allies`         |
| 3.66 | Shopping Spree: a hero's thwart and an ally's are refused, any alter-ego's Action removes 1, Disguise in alter-ego form removes 2 (Q36 = A); _Mall Rat_ puts it into play                       | `jubilee/jubilee/support-upgrades-allies`       |
| 3.67 | Snow Clone attacks an enemy with Frostbite and defeats it: 0 consequential damage (Q38 = A); Take That! is not playable against an enemy with no upgrade                                        | `iceman/iceman/support-upgrades-allies`         |
| 3.68 | §3.68 tests 1 and 4: the illegal decks (an ally beside the hero it matches), and ruling June 2, 2026 – Ruling 1 with these packs' cards                                                         | `iceman/aspect-basic`                           |
| 3.69 | `validateDeck` on Jubilee's starter deck: the nine version records at one copy each are legal; a second 47007a is not                                                                           | `jubilee/jubilee/events`                        |
| 3.72 | Bamf! on a villain attacking another player: the Interrupt discards it, Nightcrawler defends ready with his DEF, and the moment `"bamf"` is raised with the copy as its source                  | `ncrawler/nightcrawler/support-upgrades-allies` |
| 3.73 | Kurt's Cutlasses alone fill the limit: a restricted upgrade played beside them is discarded; with Prehensile Tail one card with the keyword fits and a second is discarded, never the Cutlasses | `ncrawler/nightcrawler/support-upgrades-allies` |
| 3.74 | Gambit tucks an encounter card with 2 boost icons: THW 2 and ATK 2; then §3.74 tests 6 and 7, Rogue reading another character's base (ruling January 17, 2026 – Ruling 1 (1))                   | `ncrawler/aspect-basic`                         |
| 3.76 | Wrapped in Metal on a guard minion: it does not activate, guard is gone, its traits and stats stay; Magnetic Missile discards it with no When Defeated                                          | `magneto/magneto/support-upgrades-allies`       |
| 3.78 | New Recruits defeated with 2 players: each takes a different NEW ally into hand and owns it; Surge played as a fourth ally by an X-MEN identity discards nobody                                 | `magneto/aspect-basic`                          |
| 3.79 | Sebastian Shaw attacked: he holds a facedown boost card and cannot be attacked again that phase; his next activation turns up that card and his villainous one                                  | `magneto/hellfire`                              |
| 3.80 | §3.80 tests 4 and 5: the hero Magneto against the villain Magneto, each card naming its own controller's identity                                                                               | `magneto/aspect-basic`, then a QA replay        |

### 8.4 Scripting order

`ability-scripting-engineer`, one agent per line, one module per line. The module map is the scaffold's
`packages/cards/src/wave8/card-groups.ts` (cut while this pass was written; uncommitted at e9805f4b), and the paths
below are relative to `packages/cards/src/wave8/`. "Waits on" lists §8.2 task numbers; a line with none can start
now. Each "exists (verify)" row of §8.3 is proved in the line that first needs it.

**The scaffold**

1. The registries, `CARD_GROUPS` and the coverage guard exist in the scaffold. Still to write: `setup.ts`
   (`wave8Scenario`, `wave8StarterDeckSetup`), with the Four Horsemen's four A or B faces chosen per villain from
   `sideBCardId` and preset from the difficulty (Q9 = B), the set-aside cards read from each record's
   `setAsideCardIds`, and Q12's easier start; the wave's `reprints.ts`; the wave joined to `playable/` only as packs
   are scripted. Waits on nothing (18 and 19 add the Infinites option and Standard III to it later).

**Heroes, in the order their kits clear the queue.** Per hero: identity; events; supports, upgrades and allies;
obligation and nemesis set; then a precon e2e game. The pack's aspect and basic cards and its modular set are one
module each.

Iceman (`iceman/`): the kit waits on task 1 only.

2. `iceman/identity` (46001a/b, _"Freeze!"_ raising `"freeze"`, _Cool Off_): waits on 1.
3. `iceman/support-upgrades-allies` (46002–46008; Frostbite and the `attachFrostbite` helper are here, so this line
   follows line 2 at once and lines 4 and 6 follow it): waits on 1 (Cryokinetic Perception).
4. `iceman/events` (46009–46011): waits on nothing beyond line 3.
5. `aspect-basic` (46012–46023): waits on nothing.
6. `iceman/obligation-nemesis` (46024–46028): waits on nothing beyond line 3.
7. `sauron` (46029–46032): waits on nothing; data item 4 first.
8. Iceman precon e2e.

Nightcrawler (`ncrawler/`): the kit waits on task 1; the nemesis set on 2 and 3.

9. `nightcrawler/identity` (48001a/b): waits on nothing.
10. `nightcrawler/support-upgrades-allies` (48002–48006; Bamf! raises `"bamf"`): waits on 1.
11. `nightcrawler/events` (48007–48011): waits on 1 (Tally Ho!), after line 10.
12. `aspect-basic` (48012–48025, 48031, 48032): waits on nothing.
13. `nightcrawler/obligation-nemesis` (48026–48030): waits on 2 and 3.
14. `crazy-gang` (48033–48038): waits on 3 and 4; Tweedledope keeps 1 boost icon (Q44 = B).
15. Nightcrawler precon e2e.

Bishop (`aoa/bishop/`): the kit waits on 1, 2 and 5.

16. `identity` (45001a/b, _Energy Absorption_ raising its moment): waits on 1.
17. `support-upgrades-allies` (45002–45006, 45010): waits on 1 (Bishop's Uniform).
18. `events` (45007–45009): waits on 5.
19. `obligation-nemesis` (45025–45029): waits on 2 (Trevor Fitzroy, Bantam).

Magik (`aoa/magik/`): the kit waits on 2, 6 and 7.

20. `identity` (45030a/b): waits on 6 and 7.
21. `support-upgrades-allies` (45031–45035): waits on 6; 7 for Colossus played from the top.
22. `events` (45036–45040): waits on 6.
23. `obligation-nemesis` (45053–45058; Witchfire as printed, tagged "RAW pending FFG clarification (Q31)"): waits on 2.
24. `aoa/aspect-basic` (45011–45024 and 45041–45052, one module, so one agent, Leadership and its basics first):
    waits on 14, 15 and 16 (Sidekick, Side-by-Side, Suit Up) and 17 (Goldballs); the other 22 cards wait on nothing.
25. Bishop precon e2e and Magik precon e2e, one agent each, after line 24.

Jubilee (`jubilee/`): the kit waits on 8 and 10; her aspect cards on 9 and 11.

26. `jubilee/identity` (47001a/b): waits on nothing.
27. `jubilee/events` (47006, 47007a/b/c, 47008a/b/c, 47009, with the `versions` helper): waits on 8.
28. `jubilee/support-upgrades-allies` (47002–47005, 47010a/b/c): waits on 8 (the Coat, the Sunglasses).
29. `aspect-basic` (47011–47022, 47028, 47029): waits on 8, 9 (Husk) and 11 (Cell Phone); data item 3 first.
30. `jubilee/obligation-nemesis` (47023–47027): waits on 10; data item 2 first.
31. `arcade` (47030–47034): waits on nothing.
32. Jubilee precon e2e.

Magneto (`magneto/`): the kit waits on 1, 12 and 13.

33. `magneto/identity` (49001a/b): waits on 12.
34. `magneto/support-upgrades-allies` (49002–49007, 49011): waits on 12 (the Armor, the Cape); data item 1 first.
35. `magneto/events` (49008–49010): waits on 13 (Electromagnetic Blast).
36. `aspect-basic` (49012–49026, 49033–49037): waits on nothing.
37. `magneto/obligation-nemesis` (49027–49032): waits on 12 (Old Grievances).
38. `hellfire` (49038–49042; Hellfire Pawn registers `mut_gen` 32058's script): waits on nothing.
39. Magneto precon e2e.

**The box's scenarios and sets** (`aoa/`), one agent per line, in box order. They run beside the hero lines as
their tasks land.

40. `dystopian-nightmare` (45072–45074): waits on nothing.
41. `hounds` (45097–45100): waits on 2.
42. `standard-iii` (45075a/b–45080): waits on 2 and 19.
43. `unus` (45059–45061, 45062a, 45063–45068) and `infinites` (45069–45071), one agent, two modules: waits on 2 and 18.
44. `four-horsemen` (45081a–45084b, 45085a, 45086–45096): waits on 20, 21, 22 and 23, and on line 1's builder.
45. `dark-riders` (45112–45117): waits on nothing.
46. `apocalypse` (45101a, 45103a, 45104a/b, 45105a/b, 45106–45111) and `prelates` (45179b–45183b), one agent, two
    modules: waits on 24, 25 and 26.
47. `blue-moon` (45139–45146; Imperial Guardsman under Q14 = B): waits on nothing.
48. `savage-land` (45127–45132): waits on 2 (Land Out of Time's find).
49. `genosha` (45133–45138): waits on 2 (Police State) and 27 (Escaped Mutant's Action).
50. `dark-beast` (45118–45120, 45121a, 45122–45126), after lines 47 to 49: waits on 27 and 28.
51. `clan-akkaba` (45159–45163): waits on nothing.
52. `celestial-tech` (45156–45158): waits on 22 and 30.
53. `en-sabah-nur` (45184a/b/c–45186a/b/c, 45147a, 45149–45155): waits on 29.

**Beside the engine agent, now:** lines 1, 5, 9, 12, 26, 31, 36, 38, 40, 45, 47 and 51, three at a time. After
task 1: Iceman's kit, then lines 10, 11, 16 and 17. After task 2: lines 19, 23, 41 and 48. Then as the queue runs:
13 after 3, 14 after 4, 18 after 5, Magik's kit after 7, Jubilee's after 8 (line 29 after 11), Magneto's after 13,
line 24 after 17, line 43 after 18, 42 after 19, 44 after 23, 46 after 26, 49 after 27, 50 after 28, 53 after 29,
52 after 30. The campaign's lines are in §8.5.

### 8.5 The campaign, the client and Guided mode

Each line is one task for one agent, in order; "waits on" names §8.2 tasks and the lines of §8.4 or of this list.

**The campaign** (wave definition of done §6: it ships in this wave's PR). Modules are under
`packages/cards/src/wave8/aoa/campaign/`.

1. `aoa-mission` (45166a/b–45170a/b): the shared mission rules block and the five missions. Waits on 1 and 31 to 34.
2. `aoa-basic-campaign` (45171a/b, 45172–45176): Mission Team with `missionAttempt()`, the four campaign allies and
   Desperate Measures, the one upgrade that declares the mission's reach (Q19 = B). Waits on 33 to 38, after line 1.
3. `overseer` (45179a–45183a): the five Mission Responses. Waits on 32, 37 and 38, after line 2.
4. `age-of-apocalypse` (45164, 45165) and `aoa-campaign` (45177, 45178), one agent: waits on 32, after line 1.
5. The `CampaignDefinition` `packages/cards/src/campaigns/aoa.ts` (§3.45): the two per-attempt draws, the four rows
   and their rewards, scenario 5's two endings, `AOA_CAMPAIGN` registered in `CAMPAIGNS`. Waits on 39 to 43, on §8.4
   lines 43, 44, 46, 50 and 53 (all five scenarios) and on lines 1 to 4.
6. The expert campaign (§2.16): `hpRecord`, `hpSet`, the heal priced at 3 threat on the mission, the ally search
   narrowed to a shared trait. Waits on line 5.
7. `encounter-ai-designer`: the automated player's mission policy and the scenario tests of §5 to §5.2. Waits on
   lines 1 to 4.
8. `rules-qa-engineer`: a full standard campaign with one retry that redraws (Q22 = B), each mission won and failed,
   scenario 5 won three ways, an expert run with a seat eliminated in a won game; the regression tests §5.1 to §5.5
   name by ruling. Waits on lines 5 and 6.

**The client** (`game-client-engineer`; DoD §5 and §6). Design first: MC45 needs a design pass
(`docs/campaign-client-per-box.md` §3), rendered to tiles before any brief.

9. Setup screen: the five scenarios and the wave's modular sets (the box's, `sauron`, `arcade`, `crazy_gang`,
   `hellfire`); the Infinites threat control (Q1); **four A/B selectors for the Horsemen and no "extreme"** (Q9 = B);
   the Standard III toggle (Q10); the easier Apocalypse start (Q12). Waits on §8.4 line 1 and tasks 18 and 19.
10. The table for the five scenarios (§5, §5.1): the Horsemen's row and active counter, a villain standing at 0 with
    its reason, Apocalypse's stage against the moving target, the Setting environment's Special, the three forms.
    **The confirm before a player card discards No Longer Worthy, worded as the app's warning and not a rule
    (Q13).** Waits on §8.4 lines 43 to 53.
11. The six heroes (§5.3 to §5.5): Magik's faceup top card and "play from deck", with "top card facedown" as the
    reason under a blank text box (Q26 = B); Jubilee's payment prompt with a type selector on each wild that the
    player sets (Q33 = B); Iceman's Frostbite pile; Bamf! on enemies; _Magnetic Pull_'s reveal; the unique and
    Team-Up blocks at deck selection. One agent per hero, after that hero's precon e2e.
12. The mission area and the attempt stepper (§5.2): the region, the destination prompt for an ally, an upgrade
    other than Desperate Measures drawn as inactive there (Q19 = B), the pairing, the pool. Waits on lines 1 to 3.
13. The campaign screens: Dossier, Briefing (a retry shown as a new draw, Q22 = B), Aftermath, the warnings of
    §5.2. Waits on lines 5 and 6.
14. Custom decks (DoD §4b): the deck tests §5.3 to §5.5 list, each hero in a second aspect, Frostbite ×6 as "set
    aside, not counted", the linked NEW allies never selectable. Waits on each hero's precon e2e.
15. Progression, art and shipping (DoD §7, §8): Bishop's and Magik's art out of `_pending`, the Jubilee and
    Wolverine pair, **the e2e pre-push hook restored before the last client pushes** (handoff), the whole
    Playwright suite, the changelog fragments.

**Guided mode** (DoD §5; every wave: glossary, a tip, a tricky-wording hint and a Try-it for each new mechanic). One
agent per line, after the pack's client line.

16. The box and its scenarios: find, amplify, the active counter, a Setting's Special, forms, the mission area, a
    mission attempt, Mission Response (§5.2's teaching list).
17. Bishop and Magik (§5.3's lists), with Witchfire's hint as printed (Q31 = B).
18. Iceman and Jubilee (§5.4's lists), with "you say what a wild is when you pay" (Q33 = B).
19. Nightcrawler and Magneto (§5.5's lists); the hints on Q41 and Q42 wait for the owner's answers.

### 8.6 Found while writing the queue

§3's status lines are left as written; the main session decides whether to change them.

1. **§3.45 is "exists (verify)" and two answers give it engine changes**: Q22 = B (task 42) and Q25 = A (task 43:
   a grant is exempt from the minimum and the maximum today, `deck.ts`). The rest of the row stands.
   **Q25 needs one confirmation before task 43 is built.** Option A's own example is "a 40-card deck becomes 41 and
   is legal" and "a 50-card deck must drop a card": the reward counts toward the maximum and not toward the minimum
   (`"maximumOnly"`). The owner's note adds "a deck of 39 ordinary cards plus the reward is legal", which is the
   reward counting as an ordinary card toward both limits (`"counted"`). The two agree at 50 and differ at 39. The
   task builds the field with all three values either way; the definition picks one when the owner says which.
2. **§3.5 and §3.6 are "extend" in `@mc/cards`, not in the engine.** Setup options and the choice of Standard set are
   built by the scenario builders (`scenarioSetupInstructions`, `difficultyEncounterSetIds`); the engine gains at
   most the `setupOptionApplied` log entry.
3. **§3.53's schema half has landed** (`HostQualifiers.classification`, commit 4c75824d); task 14 is the engine half.
4. **§3.62's plan changed shape with Q33 = B.** Pass 2b's `assignPaidTypes` (the engine covering as many lines as it
   could and asking only on a conflict) is replaced by a declaration made at payment and two plain readers.
   Q34 = A is kept as answered: when more is generated than the cost, the engine still takes the paid resources to
   be the ones that give the most declared types. If the owner wants the player to say which resources were the paid
   ones as well, that is the same prompt widened, and it is not built.
5. **Q19 = B is built as a flag a script sets** (`AbilityDefinition.reaches`), because Desperate Measures' printed
   text does not name the mission and the owner's answer names the card by what it is for. The list of cards that
   set it is the campaign's own; any other card that should work at the mission is a question for the owner.
6. **The scaffold's module map differs from §5 in three places**, and §8.4 follows the map: Frostbite 46002 is in
   `iceman/iceman/support-upgrades-allies` (§5.4 put its script in `identity.ts`); Mission Team 45171a is in
   `aoa/campaign/aoa-basic-campaign` (§5.2 put it with the missions); the box's Leadership, Aggression and basic
   cards are one module, `aoa/aspect-basic`, so they are one agent's work.
7. **Q5's ruling was not read.** The owner cites Hall of Heroes' post-RRG-1.5 rulings page, which is not in the
   repo. The behavior is the card's own text and is built on the owner's decision; a code comment should not cite
   the ruling by date until someone has read it.
